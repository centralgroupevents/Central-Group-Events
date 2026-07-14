import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ExternalLink, Loader2, Plus, Send, Trash2, X } from "lucide-react";

type InvoiceRow = {
  id: number;
  invoiceNumber: string;
  bookingId: number | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  eventName: string | null;
  items: string;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  notes: string | null;
  paymentInstructions: string | null;
  status: string;
  dueDate: string | null;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string | null;
  publicUrl: string;
};

type BookingRow = {
  id: number;
  eventName: string | null;
  venueName: string;
  contactName: string | null;
  email: string;
  phone: string | null;
  eventDate: string;
  mode: string | null;
};

type ItemDraft = { description: string; quantity: string; unitPrice: string };

const EMPTY_ITEM: ItemDraft = { description: "", quantity: "1", unitPrice: "" };

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// "150", "150.5", "$1,500.00" → integer cents (or null when unparseable)
function dollarsToCents(s: string): number | null {
  const cleaned = s.replace(/[$,\s]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-white/10 text-white/60",
  sent: "bg-blue-500/15 text-blue-400",
  paid: "bg-green-500/15 text-green-400",
  void: "bg-red-500/15 text-red-400",
};

export function InvoicesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery<InvoiceRow[]>({ queryKey: ["/api/admin/invoices"] });
  const { data: bookings = [] } = useQuery<BookingRow[]>({ queryKey: ["/api/admin/bookings"] });

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [eventName, setEventName] = useState("");
  const [bookingId, setBookingId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([{ ...EMPTY_ITEM }]);
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");

  const totals = useMemo(() => {
    let subtotal = 0;
    for (const it of items) {
      const cents = dollarsToCents(it.unitPrice);
      const qty = parseInt(it.quantity, 10);
      if (cents == null || !Number.isFinite(qty) || qty < 1) continue;
      subtotal += cents * qty;
    }
    const d = dollarsToCents(discount) ?? 0;
    const t = dollarsToCents(tax) ?? 0;
    return { subtotal, total: Math.max(0, subtotal - d + t) };
  }, [items, discount, tax]);

  function resetForm() {
    setEditingId(null);
    setClientName(""); setClientEmail(""); setClientPhone(""); setEventName("");
    setBookingId(""); setDueDate(""); setItems([{ ...EMPTY_ITEM }]);
    setDiscount(""); setTax(""); setNotes(""); setPaymentInstructions("");
  }

  function openCreate() {
    resetForm();
    setFormOpen(true);
  }

  function openEdit(inv: InvoiceRow) {
    setEditingId(inv.id);
    setClientName(inv.clientName);
    setClientEmail(inv.clientEmail);
    setClientPhone(inv.clientPhone || "");
    setEventName(inv.eventName || "");
    setBookingId(inv.bookingId ? String(inv.bookingId) : "");
    setDueDate(inv.dueDate || "");
    setDiscount(inv.discountCents ? (inv.discountCents / 100).toFixed(2) : "");
    setTax(inv.taxCents ? (inv.taxCents / 100).toFixed(2) : "");
    setNotes(inv.notes || "");
    setPaymentInstructions(inv.paymentInstructions || "");
    try {
      const parsed = JSON.parse(inv.items) as Array<{ description: string; quantity: number; unitPriceCents: number }>;
      setItems(parsed.map((it) => ({ description: it.description, quantity: String(it.quantity), unitPrice: (it.unitPriceCents / 100).toFixed(2) })));
    } catch {
      setItems([{ ...EMPTY_ITEM }]);
    }
    setFormOpen(true);
  }

  function prefillFromBooking(idStr: string) {
    setBookingId(idStr);
    const b = bookings.find((x) => String(x.id) === idStr);
    if (!b) return;
    if (!clientName) setClientName(b.contactName || "");
    if (!clientEmail) setClientEmail(b.email);
    if (!clientPhone) setClientPhone(b.phone || "");
    if (!eventName) setEventName(b.eventName || b.venueName);
    if (items.length === 1 && !items[0].description) {
      setItems([{ description: `Event promotion — ${b.eventName || b.venueName}${b.mode ? ` (${b.mode} package)` : ""}`, quantity: "1", unitPrice: "" }]);
    }
  }

  async function save() {
    const validItems = [];
    for (const it of items) {
      if (!it.description.trim()) continue;
      const cents = dollarsToCents(it.unitPrice);
      const qty = parseInt(it.quantity, 10);
      if (cents == null || !Number.isFinite(qty) || qty < 1) {
        toast({ title: "Check your line items", description: `"${it.description}" has an invalid quantity or price.`, variant: "destructive" });
        return;
      }
      validItems.push({ description: it.description.trim(), quantity: qty, unitPriceCents: cents });
    }
    if (!clientName.trim() || !clientEmail.trim()) {
      toast({ title: "Client name and email are required", variant: "destructive" });
      return;
    }
    if (validItems.length === 0) {
      toast({ title: "Add at least one line item", variant: "destructive" });
      return;
    }
    const d = dollarsToCents(discount);
    const t = dollarsToCents(tax);
    if (d == null || t == null) {
      toast({ title: "Discount / tax must be valid amounts", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim().toLowerCase(),
        clientPhone: clientPhone.trim() || null,
        eventName: eventName.trim() || null,
        bookingId: bookingId ? parseInt(bookingId, 10) : null,
        items: validItems,
        discountCents: d,
        taxCents: t,
        dueDate: dueDate || null,
        notes: notes.trim() || null,
        paymentInstructions: paymentInstructions.trim() || null,
      };
      const res = editingId
        ? await apiRequest("PUT", `/api/admin/invoices/${editingId}`, payload)
        : await apiRequest("POST", "/api/admin/invoices", payload);
      const json = await res.json();
      toast({ title: editingId ? `Invoice ${json.invoiceNumber} updated` : `Invoice ${json.invoiceNumber} created (draft)` });
      qc.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
      setFormOpen(false);
      resetForm();
    } catch (err) {
      toast({ title: "Save failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function sendInvoice(inv: InvoiceRow) {
    if (!confirm(`Email invoice ${inv.invoiceNumber} (${money(inv.totalCents)}) to ${inv.clientEmail}?`)) return;
    setBusyId(inv.id);
    try {
      await apiRequest("POST", `/api/admin/invoices/${inv.id}/send`, {});
      toast({ title: `Invoice ${inv.invoiceNumber} sent to ${inv.clientEmail}` });
      qc.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
    } catch (err) {
      toast({ title: "Send failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function setStatus(inv: InvoiceRow, status: string) {
    setBusyId(inv.id);
    try {
      await apiRequest("POST", `/api/admin/invoices/${inv.id}/status`, { status });
      toast({ title: `Invoice ${inv.invoiceNumber} marked ${status}` });
      qc.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
    } catch (err) {
      toast({ title: "Update failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(inv: InvoiceRow) {
    if (!confirm(`Delete invoice ${inv.invoiceNumber}? This can't be undone.`)) return;
    setBusyId(inv.id);
    try {
      await apiRequest("DELETE", `/api/admin/invoices/${inv.id}`);
      toast({ title: `Invoice ${inv.invoiceNumber} deleted` });
      qc.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
    } catch (err) {
      toast({ title: "Delete failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  const inputClass = "bg-black/40 border-white/10 h-10";

  return (
    <div className="space-y-6">
      <div className="bg-secondary/30 border border-white/10 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-black">Invoices</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Create an invoice (optionally pre-filled from a booking), email it to the client with a
              view/print link, and track draft → sent → paid.
            </p>
          </div>
          <Button onClick={formOpen ? () => { setFormOpen(false); resetForm(); } : openCreate} className="bg-primary hover:bg-primary/90" data-testid="button-new-invoice">
            {formOpen ? <><X className="w-4 h-4 mr-2" />Close</> : <><Plus className="w-4 h-4 mr-2" />New invoice</>}
          </Button>
        </div>
      </div>

      {formOpen && (
        <div className="bg-secondary/30 border border-white/10 rounded-2xl p-6 space-y-5">
          <h3 className="font-bold text-lg">{editingId ? "Edit invoice" : "New invoice"}</h3>

          <div className="space-y-1.5">
            <Label className="text-white/80">Prefill from a booking <span className="text-white/40 text-xs">(optional)</span></Label>
            <Select value={bookingId} onValueChange={prefillFromBooking}>
              <SelectTrigger className={inputClass} data-testid="select-invoice-booking">
                <SelectValue placeholder="Pick a booking to copy client + event details" />
              </SelectTrigger>
              <SelectContent className="bg-secondary border-white/10 text-white max-h-72">
                {bookings.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    #{b.id} · {b.eventName || b.venueName} · {b.contactName || b.email} · {b.eventDate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-white/80">Client name *</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputClass} data-testid="input-invoice-client-name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/80">Client email *</Label>
              <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={inputClass} data-testid="input-invoice-client-email" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/80">Client phone</Label>
              <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/80">Event name</Label>
              <Input value={eventName} onChange={(e) => setEventName(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/80">Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-white/80">Line items *</Label>
            {items.map((it, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  placeholder="Description (e.g. Growth package — IG reels + newsletter feature)"
                  value={it.description}
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                  className={`${inputClass} flex-1`}
                  data-testid={`input-invoice-item-desc-${i}`}
                />
                <Input
                  placeholder="Qty"
                  value={it.quantity}
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))}
                  className={`${inputClass} w-16 text-center`}
                />
                <Input
                  placeholder="$ each"
                  value={it.unitPrice}
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, unitPrice: e.target.value } : x)))}
                  className={`${inputClass} w-28 text-right`}
                  data-testid={`input-invoice-item-price-${i}`}
                />
                <button
                  type="button"
                  onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== i) : [{ ...EMPTY_ITEM }])}
                  className="text-white/40 hover:text-red-400 p-1"
                  aria-label="Remove line item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { ...EMPTY_ITEM }])} className="border-white/20 text-white/70">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add line
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-white/80">Discount ($)</Label>
              <Input value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/80">Tax ($)</Label>
              <Input value={tax} onChange={(e) => setTax(e.target.value)} placeholder="0.00" className={inputClass} />
            </div>
            <div className="col-span-2 text-right">
              <p className="text-sm text-muted-foreground">Subtotal {money(totals.subtotal)}</p>
              <p className="text-xl font-black text-white" data-testid="text-invoice-total">Total {money(totals.total)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-white/80">How to pay <span className="text-white/40 text-xs">(shown on the invoice)</span></Label>
              <Textarea
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                placeholder={"e.g. Zelle or Cash App to (xxx) xxx-xxxx — include the invoice number in the memo."}
                className="bg-black/40 border-white/10 min-h-[80px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/80">Notes <span className="text-white/40 text-xs">(optional)</span></Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-black/40 border-white/10 min-h-[80px]" />
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90" data-testid="button-save-invoice">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? "Save changes" : "Create draft"}
            </Button>
            <Button variant="outline" onClick={() => { setFormOpen(false); resetForm(); }} className="border-white/20 text-white/70">Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : invoices.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No invoices yet. Create your first one above.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-white/10 bg-white/[0.02]">
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => (
                <tr key={inv.id} className={`border-b border-white/5 hover:bg-white/5 ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`} data-testid={`row-invoice-${inv.id}`}>
                  <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">
                    <p className="text-white">{inv.clientName}</p>
                    <p className="text-xs text-muted-foreground">{inv.clientEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.eventName || "—"}</td>
                  <td className="px-4 py-3 text-right text-white font-medium whitespace-nowrap">{money(inv.totalCents)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[inv.status] || STATUS_STYLES.draft}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{inv.dueDate || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      <a
                        href={inv.publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10"
                        data-testid={`link-view-invoice-${inv.id}`}
                      >
                        <ExternalLink className="w-3 h-3" /> View
                      </a>
                      {inv.status !== "void" && (
                        <button
                          onClick={() => sendInvoice(inv)}
                          disabled={busyId === inv.id}
                          className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/20"
                          data-testid={`button-send-invoice-${inv.id}`}
                        >
                          <Send className="w-3 h-3" /> {inv.status === "draft" ? "Send" : "Resend"}
                        </button>
                      )}
                      {inv.status !== "paid" && inv.status !== "void" && (
                        <button
                          onClick={() => setStatus(inv, "paid")}
                          disabled={busyId === inv.id}
                          className="inline-flex items-center rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1 text-xs text-green-400 hover:bg-green-500/20"
                          data-testid={`button-paid-invoice-${inv.id}`}
                        >
                          Mark paid
                        </button>
                      )}
                      {inv.status !== "paid" && (
                        <button
                          onClick={() => openEdit(inv)}
                          disabled={busyId === inv.id}
                          className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => remove(inv)}
                        disabled={busyId === inv.id}
                        className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/60 hover:text-red-400 hover:bg-white/10"
                        data-testid={`button-delete-invoice-${inv.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
