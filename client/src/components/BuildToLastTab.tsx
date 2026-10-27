import { Fragment, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BTL_INTEREST_KEYS, BTL_INTEREST_LABELS } from "@shared/schema";
import { BTL_PAGE_FIELDS, BTL_PAGE_DEFAULTS } from "@shared/btl-page";
import { Download, Loader2, Plus, Send, Upload, Eye, Check, Printer, Pencil, Trash2, X } from "lucide-react";

type BtlRsvp = {
  id: number;
  name: string;
  email: string;
  role: string;
  companyOrHandle: string | null;
  workingOnNow: string;
  keyQuestion: string;
  topicInterests: string;
  contactSheetOptin: boolean;
  attendeeSource: string | null;
  adminCategory: string | null;
  confirmationSentAt: string | null;
  checkedInAt: string | null;
  unsubscribed: boolean;
  createdAt: string | null;
};

type BtlInvitee = {
  id: number;
  name: string;
  email: string;
  instagramHandle: string | null;
  category: string | null;
  priorityTier: number;
  initialInviteSentAt: string | null;
  secondWaveSentAt: string | null;
  rsvpStatus: string;
  unsubscribed: boolean;
  notes: string | null;
  interests: string;
  linkClickedAt: string | null;
  emailOpenedAt: string | null;
};

function inviteeInterests(i: BtlInvitee): string[] {
  try {
    const arr = JSON.parse(i.interests || "[]");
    return Array.isArray(arr) ? arr.filter((k) => typeof k === "string") : [];
  } catch {
    return [];
  }
}

type CadenceRow = {
  key: string;
  label: string;
  audience: string;
  audienceCount: number;
  sentCount: number;
  failedCount: number;
  sendAtEt: string | null;
  blocked: string | null;
};

type BtlSettings = {
  rsvpUrl: string;
  venueName: string;
  venueAddress: string;
  doorsTime: string;
  programStartTime: string;
  questionThemes: string;
  speakers: Array<{ name: string; credential: string; topic: string }>;
  photoGalleryUrl: string;
  recapVideoUrl: string;
  fieldNotesUrl: string;
  contactSheetUrl: string;
  sendAt: Record<string, string | null>;
};

const CATEGORIES = [
  { value: "venue_owner", label: "Venue owner" },
  { value: "planner", label: "Planner" },
  { value: "dj", label: "DJ" },
  { value: "influencer", label: "Influencer" },
  { value: "institutional", label: "Institutional" },
  { value: "other", label: "Other" },
];

const TOPIC_LABELS: Record<string, string> = {
  legal: "Legal protection",
  funding: "Grants & funding",
  venue: "Venue economics",
  market: "Newark next 3 years",
  general: "General",
};

function topicsOf(r: BtlRsvp): string[] {
  try {
    const arr = JSON.parse(r.topicInterests);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

const VIEWS = ["RSVPs", "Invites", "Cadence", "Templates", "Page", "Questions", "Guest Book", "Check-in", "Settings"] as const;
type View = (typeof VIEWS)[number];

export function BuildToLastTab() {
  const [view, setView] = useState<View>("RSVPs");
  const { data: rsvps = [], isLoading } = useQuery<BtlRsvp[]>({ queryKey: ["/api/admin/btl/rsvps"] });

  return (
    <div className="space-y-5">
      <div className="bg-secondary/30 border border-white/10 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-black">Build to Last Vol. 1</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Thursday, Nov 12 · Equal Space, Newark · public page:{" "}
              <a href="/build-to-last" target="_blank" rel="noopener noreferrer" className="text-primary underline">/build-to-last</a>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-center">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Confirmed</p>
              <p className="text-xl font-black text-white" data-testid="stat-btl-confirmed">{rsvps.length}</p>
            </div>
            <div className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-center">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Checked in</p>
              <p className="text-xl font-black text-white">{rsvps.filter((r) => r.checkedInAt).length}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5 flex-wrap">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition ${view === v ? "bg-primary text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
              data-testid={`button-btl-view-${v.toLowerCase().replace(/[^a-z]+/g, "-")}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "RSVPs" && <RsvpsView rsvps={rsvps} isLoading={isLoading} />}
      {view === "Invites" && <InvitesView />}
      {view === "Page" && <PageView />}
      {view === "Cadence" && <CadenceView />}
      {view === "Templates" && <TemplatesView />}
      {view === "Questions" && <QuestionsView rsvps={rsvps} />}
      {view === "Guest Book" && <GuestBookView rsvps={rsvps} />}
      {view === "Check-in" && <CheckinView rsvps={rsvps} />}
      {view === "Settings" && <SettingsView />}
    </div>
  );
}

/* ── RSVPs ─────────────────────────────────────────────────────────────── */

function RsvpsView({ rsvps, isLoading }: { rsvps: BtlRsvp[]; isLoading: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rsvps;
    return rsvps.filter((r) =>
      [r.name, r.email, r.role, r.companyOrHandle, r.workingOnNow, r.keyQuestion, r.adminCategory]
        .filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [rsvps, search]);

  async function setCategory(id: number, adminCategory: string) {
    try {
      await apiRequest("PATCH", `/api/admin/btl/rsvps/${id}`, { adminCategory });
      qc.invalidateQueries({ queryKey: ["/api/admin/btl/rsvps"] });
    } catch (err) {
      toast({ title: "Category update failed", description: String((err as Error).message), variant: "destructive" });
    }
  }

  function exportCsv() {
    const rows = [
      ["Name", "Email", "Role", "Company/Handle", "Category", "Working on", "Key question", "Topics", "Contact sheet", "Source", "RSVP'd at", "Checked in"],
      ...rsvps.map((r) => [
        r.name, r.email, r.role, r.companyOrHandle ?? "", r.adminCategory ?? "",
        r.workingOnNow, r.keyQuestion, topicsOf(r).join("; "),
        r.contactSheetOptin ? "yes" : "no", r.attendeeSource ?? "",
        r.createdAt ? new Date(r.createdAt).toLocaleString("en-US") : "",
        r.checkedInAt ? "yes" : "",
      ]),
    ];
    const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "build-to-last-rsvps.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center flex-wrap">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search RSVPs — name, email, role, question…"
          className="bg-secondary/30 border-white/10 h-10 flex-1 min-w-[240px]"
          data-testid="input-btl-search"
        />
        <Button variant="outline" onClick={exportCsv} className="border-white/20 text-white/80 hover:bg-white/5" data-testid="button-btl-export">
          <Download className="w-4 h-4 mr-1.5" /> Export CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          {rsvps.length === 0 ? "No RSVPs yet — share /build-to-last to start filling the room." : "No RSVPs match that search."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm" style={{ minWidth: "900px" }}>
            <thead>
              <tr className="text-left text-muted-foreground border-b border-white/10 bg-white/[0.02]">
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Topics</th>
                <th className="px-4 py-3 font-medium">Sheet</th>
                <th className="px-4 py-3 font-medium">RSVP'd</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <>
                  <tr
                    key={r.id}
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    className={`border-b border-white/5 hover:bg-white/5 cursor-pointer ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`}
                    data-testid={`row-btl-rsvp-${r.id}`}
                  >
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">
                        {r.name}
                        {r.unsubscribed && <span className="ml-2 text-xs text-red-400">(unsubscribed)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{r.email}{r.companyOrHandle ? ` · ${r.companyOrHandle}` : ""}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.role}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Select value={r.adminCategory ?? ""} onValueChange={(v) => setCategory(r.id, v)}>
                        <SelectTrigger className="h-8 w-36 bg-black/30 border-white/10 text-xs" data-testid={`select-btl-category-${r.id}`}>
                          <SelectValue placeholder="Assign…" />
                        </SelectTrigger>
                        <SelectContent className="bg-secondary border-white/10 text-white">
                          {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {topicsOf(r).map((t) => (
                          <span key={t} className="px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[11px]">{TOPIC_LABELS[t]?.split(" ")[0] ?? t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">{r.contactSheetOptin ? <span className="text-green-400 text-xs font-medium">opted in</span> : <span className="text-white/30 text-xs">no</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr key={`${r.id}-detail`} className="border-b border-white/5 bg-black/20">
                      <td colSpan={6} className="px-4 py-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Working on now (guest book line)</p>
                        <p className="text-white/90 mb-3">{r.workingOnNow}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Their question for the room</p>
                        <p className="text-white/90 whitespace-pre-wrap">{r.keyQuestion}</p>
                        {r.attendeeSource && <p className="text-xs text-muted-foreground mt-3">Source: {r.attendeeSource}</p>}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Invites ───────────────────────────────────────────────────────────── */

// "Send now / schedule" picker. Value is a datetime-local string read as
// Eastern time ("" = send now).
function WhenPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const scheduling = value !== "";
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
        <Checkbox checked={scheduling} onCheckedChange={(c) => onChange(c ? defaultScheduleValue() : "")} data-testid="checkbox-btl-schedule" />
        Schedule for later
      </label>
      {scheduling && (
        <>
          <Input
            type="datetime-local"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-black/40 border-white/10 h-9 w-[220px] text-xs"
            data-testid="input-btl-schedule-at"
          />
          <span className="text-[11px] text-muted-foreground">Eastern time · fires on the hourly cron, within the hour after</span>
        </>
      )}
    </div>
  );
}

// Tomorrow 9:00 AM ET-ish default for the picker (string math only; the
// server validates the real instant).
function defaultScheduleValue(): string {
  const d = new Date(Date.now() + 24 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`;
}

type ScheduledSend = {
  id: number;
  kind: string;
  templateKey: string;
  recipientName: string | null;
  recipientEmail: string | null;
  cc: string | null;
  inviteeIds: string | null;
  sendAt: string;
  status: string;
  resultMessage: string | null;
};

function etLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET";
}

function InvitesView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: invitees = [], isLoading } = useQuery<BtlInvitee[]>({ queryKey: ["/api/admin/btl/invitees"] });
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"" | "import" | "initial" | "second" | "delete">("");
  const [manual, setManual] = useState({ name: "", email: "", instagram: "", category: "", tier: "2" });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedAt, setSchedAt] = useState(defaultScheduleValue());

  async function scheduleInvites() {
    const useSelection = selected.size > 0;
    const count = useSelection ? selected.size : pendingInitial;
    if (!window.confirm(`Schedule the initial invite for ${schedAt.replace("T", " ")} ET to ${useSelection ? `the ${count} selected` : `all ${count} not-yet-invited`} ${count === 1 ? "person" : "people"}? You can cancel it from the Cadence view until it fires.`)) return;
    setBusy("initial");
    try {
      await apiRequest("POST", "/api/admin/btl/scheduled", { kind: "invitees", sendAtEt: schedAt, ...(useSelection ? { inviteeIds: Array.from(selected) } : {}) });
      toast({ title: "Invites scheduled", description: `Fires ${schedAt.replace("T", " ")} ET — see the Cadence view to cancel.` });
      setSchedOpen(false);
      if (useSelection) setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["/api/admin/btl/scheduled"] });
    } catch (err) {
      toast({ title: "Couldn't schedule", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setBusy("");
    }
  }

  const allSelected = invitees.length > 0 && invitees.every((i) => selected.has(i.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(invitees.map((i) => i.id)));
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const names = invitees.filter((i) => selected.has(i.id)).map((i) => i.name || i.email);
    const preview = names.slice(0, 5).join(", ") + (names.length > 5 ? ` and ${names.length - 5} more` : "");
    if (!window.confirm(`Delete ${ids.length} invitee${ids.length === 1 ? "" : "s"} (${preview})? This removes them from the invite list permanently.`)) return;
    setBusy("delete");
    try {
      const res = await apiRequest("POST", "/api/admin/btl/invitees/bulk-delete", { ids });
      const body = await res.json();
      toast({ title: `Deleted ${body.deleted} invitee${body.deleted === 1 ? "" : "s"}` });
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["/api/admin/btl/invitees"] });
    } catch (err) {
      toast({ title: "Delete failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setBusy("");
    }
  }

  const pendingInitial = invitees.filter((i) => !i.initialInviteSentAt && !i.unsubscribed && i.rsvpStatus !== "declined").length;

  async function importRows(rows: Array<Record<string, unknown>>) {
    setBusy("import");
    try {
      const res = await apiRequest("POST", "/api/admin/btl/invitees/import", { rows });
      const body = await res.json();
      toast({ title: `Imported ${body.imported}, skipped ${body.skipped} duplicate${body.skipped !== 1 ? "s" : ""}${body.invalid ? `, ${body.invalid} invalid email${body.invalid !== 1 ? "s" : ""}` : ""}` });
      qc.invalidateQueries({ queryKey: ["/api/admin/btl/invitees"] });
    } catch (err) {
      toast({ title: "Import failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setBusy("");
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/[^a-z]/g, ""),
      complete: (results) => {
        const rows = (results.data as Record<string, string>[]).map((r) => ({
          name: r.name ?? r.fullname ?? "",
          email: r.email ?? r.emailaddress ?? "",
          instagram: r.instagram ?? r.instagramhandle ?? r.ig ?? "",
          category: r.category ?? "",
          tier: r.tier ?? r.prioritytier ?? "2",
        }));
        if (rows.length === 0) {
          toast({ title: "No rows found", description: "The CSV needs a header row with at least name and email columns.", variant: "destructive" });
          return;
        }
        importRows(rows);
      },
      error: (err) => toast({ title: "Could not parse CSV", description: err.message, variant: "destructive" }),
    });
    e.target.value = "";
  }

  async function addManual() {
    if (!manual.email.trim()) return;
    await importRows([{ ...manual }]);
    setManual({ name: "", email: "", instagram: "", category: "", tier: "2" });
  }

  // With rows selected, the invite goes only to the selection; otherwise to
  // everyone who hasn't received it yet. Already-invited selections are
  // skipped (the per-row Resend button is the way to send again).
  async function sendInitial() {
    const useSelection = selected.size > 0;
    const who = useSelection
      ? `the ${selected.size} selected ${selected.size === 1 ? "person" : "people"} (anyone already invited is skipped)`
      : `all ${pendingInitial} ${pendingInitial === 1 ? "person" : "people"} who haven't received it yet`;
    if (!window.confirm(`Send the initial invite email to ${who}? It comes from centralgroupevents@gmail.com as Anthony.`)) return;
    setBusy("initial");
    try {
      const res = await apiRequest("POST", "/api/admin/btl/invites/send-initial", useSelection ? { ids: Array.from(selected) } : {});
      const body = await res.json();
      toast({ title: `Initial invites: ${body.sent} sent${body.failed ? `, ${body.failed} failed` : ""}${body.skipped ? `, ${body.skipped} already had it` : ""}` });
      if (useSelection) setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["/api/admin/btl/invitees"] });
    } catch (err) {
      toast({ title: "Send failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setBusy("");
    }
  }

  async function sendSecondWave() {
    if (!window.confirm("Send the second-wave nudge to invitees who got the first invite but haven't RSVP'd?")) return;
    setBusy("second");
    try {
      const res = await apiRequest("POST", "/api/admin/btl/invites/send-second-wave", {});
      const body = await res.json();
      toast({ title: `Second wave: ${body.sent} sent${body.failed ? `, ${body.failed} failed` : ""}${body.skipped ? `, ${body.skipped} already had it` : ""}` });
      qc.invalidateQueries({ queryKey: ["/api/admin/btl/invitees"] });
    } catch (err) {
      toast({ title: "Send failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-secondary/30 border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">
            {invitees.length} on the invite list · {invitees.filter((i) => i.rsvpStatus === "confirmed").length} confirmed · {pendingInitial} not yet invited
          </p>
          <div className="flex gap-2 flex-wrap">
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} data-testid="input-btl-invite-csv" />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy !== ""} className="border-white/20 text-white/80">
              <Upload className="w-4 h-4 mr-1.5" /> Import CSV
            </Button>
            <Button onClick={sendInitial} disabled={busy !== "" || (selected.size === 0 && pendingInitial === 0)} className="bg-primary hover:bg-primary/90" data-testid="button-btl-send-initial">
              {busy === "initial" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              {selected.size > 0 ? `Send Invite to Selected (${selected.size})` : `Send Initial Invites (${pendingInitial})`}
            </Button>
            <Button onClick={() => setSchedOpen((v) => !v)} disabled={busy !== "" || (selected.size === 0 && pendingInitial === 0)} variant="outline" className="border-white/20 text-white/80" data-testid="button-btl-schedule-invites">
              Schedule…
            </Button>
            <Button onClick={sendSecondWave} disabled={busy !== ""} variant="outline" className="border-primary/40 text-primary hover:bg-primary/10" data-testid="button-btl-send-second">
              {busy === "second" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              Send Second Wave
            </Button>
          </div>
        </div>
        {schedOpen && (
          <div className="bg-black/30 border border-primary/25 rounded-xl p-4 flex items-center gap-3 flex-wrap" data-testid="panel-btl-schedule-invites">
            <span className="text-xs text-white/80">
              Schedule the initial invite for {selected.size > 0 ? `the ${selected.size} selected` : `all ${pendingInitial} not-yet-invited`}:
            </span>
            <Input type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)} className="bg-black/40 border-white/10 h-9 w-[220px] text-xs" data-testid="input-btl-invites-schedule-at" />
            <span className="text-[11px] text-muted-foreground">Eastern time · hourly cron</span>
            <Button size="sm" onClick={scheduleInvites} disabled={busy !== "" || !schedAt} className="bg-primary hover:bg-primary/90 h-9" data-testid="button-btl-invites-schedule-confirm">
              Schedule
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
          <Input placeholder="Name" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} className="bg-black/30 border-white/10 h-9" />
          <Input placeholder="email@…" value={manual.email} onChange={(e) => setManual({ ...manual, email: e.target.value })} className="bg-black/30 border-white/10 h-9 sm:col-span-2" />
          <Input placeholder="@instagram" value={manual.instagram} onChange={(e) => setManual({ ...manual, instagram: e.target.value })} className="bg-black/30 border-white/10 h-9" />
          <Select value={manual.category} onValueChange={(v) => setManual({ ...manual, category: v })}>
            <SelectTrigger className="h-9 bg-black/30 border-white/10 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent className="bg-secondary border-white/10 text-white">
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={addManual} disabled={busy !== "" || !manual.email.trim()} className="border-white/20 h-9">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">CSV columns: name, email, instagram, category, tier (1 = your personal top list). Duplicate emails are skipped automatically.</p>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 bg-red-950/30 border border-red-500/30 rounded-xl px-4 py-2.5">
          <p className="text-sm text-white/90">{selected.size} selected</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="text-white/70 h-8">
              <X className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
            <Button size="sm" variant="destructive" onClick={deleteSelected} disabled={busy !== ""} className="h-8" data-testid="button-btl-bulk-delete">
              {busy === "delete" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
              Delete selected
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : invitees.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">No invitees yet — import the CSV when the list is ready.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm" style={{ minWidth: "980px" }}>
            <thead>
              <tr className="text-left text-muted-foreground border-b border-white/10 bg-white/[0.02]">
                <th className="px-4 py-3 w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all invitees" data-testid="checkbox-btl-select-all" />
                </th>
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">Interests</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Invited</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invitees.map((i, idx) => {
                const chips = inviteeInterests(i);
                return (
                  <Fragment key={i.id}>
                    <tr className={`border-b border-white/5 ${selected.has(i.id) ? "bg-primary/[0.08]" : idx % 2 !== 0 ? "bg-white/[0.02]" : ""}`} data-testid={`row-btl-invitee-${i.id}`}>
                      <td className="px-4 py-3">
                        <Checkbox checked={selected.has(i.id)} onCheckedChange={() => toggleOne(i.id)} aria-label={`Select ${i.name}`} data-testid={`checkbox-btl-invitee-${i.id}`} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{i.name}{i.unsubscribed && <span className="ml-2 text-xs text-red-400">(unsubscribed)</span>}</p>
                        <p className="text-xs text-muted-foreground">{i.email}{i.instagramHandle ? ` · ${i.instagramHandle}` : ""}</p>
                      </td>
                      <td className="px-4 py-3">
                        {chips.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {chips.map((k) => (
                              <span key={k} className="text-[10px] bg-primary/15 text-primary border border-primary/25 rounded-full px-2 py-0.5 whitespace-nowrap">
                                {BTL_INTEREST_LABELS[k as (typeof BTL_INTEREST_KEYS)[number]] ?? k}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{CATEGORIES.find((c) => c.value === i.category)?.label ?? i.category ?? "—"}</td>
                      <td className="px-4 py-3 text-xs">{i.priorityTier === 1 ? <span className="text-amber-300 font-bold">Tier 1</span> : "2"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {i.initialInviteSentAt ? new Date(i.initialInviteSentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                        {i.secondWaveSentAt ? <span className="block text-[10px]">2nd: {new Date(i.secondWaveSentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span> : null}
                        {i.emailOpenedAt ? (
                          <span className="block text-[10px] text-sky-300" data-testid={`text-btl-opened-${i.id}`}>
                            opened {new Date(i.emailOpenedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        ) : null}
                        {i.linkClickedAt ? (
                          <span className="block text-[10px] text-green-400" data-testid={`text-btl-clicked-${i.id}`}>
                            clicked {new Date(i.linkClickedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <StatusSelect invitee={i} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(editingId === i.id ? null : i.id)} className="h-8 px-2 text-white/70 hover:text-white" data-testid={`button-btl-edit-${i.id}`}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <ResendButton invitee={i} />
                      </td>
                    </tr>
                    {editingId === i.id && (
                      <tr className="border-b border-white/5 bg-black/30">
                        <td colSpan={8} className="px-4 py-4">
                          <InviteeEditor invitee={i} onDone={() => setEditingId(null)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Inline row editor: name, email, and the "walking away with" interests —
// the same keys the public RSVP form writes, so admin edits and RSVPs stay
// in one vocabulary.
function InviteeEditor({ invitee, onDone }: { invitee: BtlInvitee; onDone: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(invitee.name);
  const [email, setEmail] = useState(invitee.email);
  const [interests, setInterests] = useState<Set<string>>(new Set(inviteeInterests(invitee)));
  const [saving, setSaving] = useState(false);

  function toggle(key: string) {
    setInterests((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/admin/btl/invitees/${invitee.id}`, {
        name: name.trim(),
        email: email.trim(),
        interests: Array.from(interests),
      });
      toast({ title: "Invitee updated" });
      qc.invalidateQueries({ queryKey: ["/api/admin/btl/invitees"] });
      onDone();
    } catch (err) {
      toast({ title: "Save failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-black/30 border-white/10 h-9" data-testid={`input-btl-edit-name-${invitee.id}`} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} className="bg-black/30 border-white/10 h-9" data-testid={`input-btl-edit-email-${invitee.id}`} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Most interested in (what they're walking away with)</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
          {BTL_INTEREST_KEYS.map((key) => (
            <label key={key} className="flex items-start gap-2 text-xs text-white/80 cursor-pointer">
              <Checkbox checked={interests.has(key)} onCheckedChange={() => toggle(key)} className="mt-0.5" data-testid={`checkbox-btl-edit-interest-${key}-${invitee.id}`} />
              {BTL_INTEREST_LABELS[key]}
            </label>
          ))}
        </div>
        {/* Free-text answers from the RSVP form's "Other" option — kept on
            save; ✕ removes one. */}
        {Array.from(interests).filter((k) => !(BTL_INTEREST_KEYS as readonly string[]).includes(k)).length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {Array.from(interests).filter((k) => !(BTL_INTEREST_KEYS as readonly string[]).includes(k)).map((k) => (
              <span key={k} className="inline-flex items-center gap-1 text-[11px] bg-amber-400/10 text-amber-200 border border-amber-400/25 rounded-full px-2 py-0.5">
                {k}
                <button type="button" onClick={() => toggle(k)} className="text-amber-200/60 hover:text-amber-200" aria-label={`Remove ${k}`}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving || !name.trim() || !email.trim()} className="bg-primary hover:bg-primary/90 h-8" data-testid={`button-btl-save-invitee-${invitee.id}`}>
          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} disabled={saving} className="text-white/70 h-8">Cancel</Button>
      </div>
    </div>
  );
}

// Re-send the initial invite to one person, bypassing the duplicate guard —
// built so a test inbox can receive the email repeatedly while iterating.
function ResendButton({ invitee }: { invitee: BtlInvitee }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [sending, setSending] = useState(false);

  async function resend() {
    if (!window.confirm(`Resend the initial invite to ${invitee.email}? This skips the "already sent" guard — use it for test inboxes.`)) return;
    setSending(true);
    try {
      const res = await apiRequest("POST", `/api/admin/btl/invitees/${invitee.id}/resend`, {});
      const body = await res.json();
      if (body.outcome === "sent") {
        toast({ title: `Invite re-sent to ${body.to}` });
      } else {
        toast({ title: `Resend ${body.outcome}`, description: body.error || "No error detail — check the Cadence view's failure panel.", variant: "destructive" });
      }
      qc.invalidateQueries({ queryKey: ["/api/admin/btl/invitees"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/btl/email-failures"] });
    } catch (err) {
      toast({ title: "Resend failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <Button size="sm" variant="ghost" onClick={resend} disabled={sending} className="h-8 px-2 text-primary/80 hover:text-primary" title="Resend initial invite (bypasses dedup)" data-testid={`button-btl-resend-${invitee.id}`}>
      {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
    </Button>
  );
}

function StatusSelect({ invitee }: { invitee: BtlInvitee }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  async function change(v: string) {
    try {
      await apiRequest("PATCH", `/api/admin/btl/invitees/${invitee.id}`, { rsvpStatus: v });
      qc.invalidateQueries({ queryKey: ["/api/admin/btl/invitees"] });
    } catch (err) {
      toast({ title: "Update failed", description: String((err as Error).message), variant: "destructive" });
    }
  }
  return (
    <Select value={invitee.rsvpStatus} onValueChange={change}>
      <SelectTrigger className="h-8 w-28 bg-black/30 border-white/10 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent className="bg-secondary border-white/10 text-white">
        <SelectItem value="pending">pending</SelectItem>
        <SelectItem value="confirmed">confirmed</SelectItem>
        <SelectItem value="declined">declined</SelectItem>
      </SelectContent>
    </Select>
  );
}

/* ── Page copy editor ──────────────────────────────────────────────────── */

// Every prose block on /build-to-last, editable in place. Saving text that
// matches the default clears the override, so emptying a field (or putting
// the original back) returns that section to the built-in copy.
function PageView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: content, isLoading } = useQuery<Record<string, string>>({ queryKey: ["/api/admin/btl/page"] });
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);

  const values = draft ?? content ?? BTL_PAGE_DEFAULTS;
  const dirty = draft !== null && content !== undefined && BTL_PAGE_FIELDS.some((f) => (draft[f.key] ?? "") !== (content[f.key] ?? ""));

  function setField(key: string, value: string) {
    setDraft({ ...(draft ?? content ?? BTL_PAGE_DEFAULTS), [key]: value });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await apiRequest("PUT", "/api/admin/btl/page", draft);
      const fresh = await res.json();
      qc.setQueryData(["/api/admin/btl/page"], fresh);
      qc.invalidateQueries({ queryKey: ["/api/build-to-last/content"] });
      setDraft(null);
      toast({ title: "Page saved — it's live on /build-to-last" });
    } catch (err) {
      toast({ title: "Save failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Edit the public page copy below — changes go live the moment you save.{" "}
          <a href="/build-to-last" target="_blank" rel="noopener noreferrer" className="text-primary underline">Open the page</a> to see it.
          To restore a section's original copy, clear the field and save.
        </p>
        <Button onClick={save} disabled={!dirty || saving} className="bg-primary hover:bg-primary/90" data-testid="button-btl-page-save">
          {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
          Save Page
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {BTL_PAGE_FIELDS.map((f) => {
          const isDefault = (values[f.key] ?? "").trim() === BTL_PAGE_DEFAULTS[f.key].trim();
          return (
            <div key={f.key} className={`bg-secondary/30 border border-white/10 rounded-2xl p-4 space-y-2 ${f.multiline ? "" : "lg:col-span-1"}`}>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-semibold text-white">{f.label}</Label>
                {!isDefault && <span className="text-[10px] bg-amber-400/15 text-amber-300 border border-amber-400/25 rounded-full px-2 py-0.5">edited</span>}
              </div>
              {f.multiline ? (
                <Textarea
                  value={values[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  rows={Math.max(3, (values[f.key] ?? "").split("\n").length + 1)}
                  className="bg-black/30 border-white/10 text-sm leading-relaxed"
                  placeholder={BTL_PAGE_DEFAULTS[f.key]}
                  data-testid={`textarea-btl-page-${f.key}`}
                />
              ) : (
                <Input
                  value={values[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className="bg-black/30 border-white/10"
                  placeholder={BTL_PAGE_DEFAULTS[f.key]}
                  data-testid={`input-btl-page-${f.key}`}
                />
              )}
              <p className="text-xs text-muted-foreground">{f.help}</p>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={!dirty || saving} className="bg-primary hover:bg-primary/90">
          {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
          Save Page
        </Button>
      </div>
    </div>
  );
}

/* ── Cadence ───────────────────────────────────────────────────────────── */

type EmailFailure = {
  id: number;
  recipientEmail: string;
  templateKey: string;
  errorMessage: string | null;
  sentAt: string | null;
};

function CadenceView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery<CadenceRow[]>({ queryKey: ["/api/admin/btl/cadence"] });
  const { data: failures = [] } = useQuery<EmailFailure[]>({ queryKey: ["/api/admin/btl/email-failures"] });
  const { data: scheduled = [] } = useQuery<ScheduledSend[]>({ queryKey: ["/api/admin/btl/scheduled"] });
  const { data: tplDefs = [] } = useQuery<Array<{ key: string; label: string }>>({ queryKey: ["/api/admin/btl/templates"] });

  async function cancelScheduled(id: number) {
    if (!window.confirm("Cancel this scheduled send?")) return;
    try {
      await apiRequest("DELETE", `/api/admin/btl/scheduled/${id}`);
      toast({ title: "Scheduled send cancelled" });
      qc.invalidateQueries({ queryKey: ["/api/admin/btl/scheduled"] });
    } catch (err) {
      toast({ title: "Couldn't cancel", description: String((err as Error).message), variant: "destructive" });
    }
  }
  const [preview, setPreview] = useState<{ key: string; subject: string; html: string } | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [testKey, setTestKey] = useState("");

  async function sendTest(row: CadenceRow) {
    setTestKey(row.key);
    try {
      const res = await apiRequest("POST", `/api/admin/btl/cadence/${row.key}/test`, {});
      const body = await res.json();
      toast({ title: `Test sent to ${body.to}`, description: `"[TEST] …" — check the inbox for "${row.label}".` });
    } catch (err) {
      toast({ title: "Test send failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setTestKey("");
    }
  }

  async function openPreview(key: string) {
    try {
      const res = await fetch(`/api/admin/btl/cadence/${key}/preview`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const body = await res.json();
      setPreview({ key, subject: body.subject, html: body.html });
    } catch (err) {
      toast({ title: "Preview failed", description: String((err as Error).message), variant: "destructive" });
    }
  }

  async function sendNow(row: CadenceRow) {
    if (!window.confirm(`Send "${row.label}" to ${row.audienceCount} ${row.audienceCount === 1 ? "person" : "people"} right now? Anyone who already got it is skipped automatically.`)) return;
    setBusyKey(row.key);
    try {
      const res = await apiRequest("POST", `/api/admin/btl/cadence/${row.key}/send-now`, {});
      const body = await res.json();
      toast({ title: `${row.label}: ${body.sent} sent${body.failed ? `, ${body.failed} failed` : ""}${body.skipped ? `, ${body.skipped} already had it` : ""}` });
      qc.invalidateQueries({ queryKey: ["/api/admin/btl/cadence"] });
    } catch (err) {
      toast({ title: "Send failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Scheduled sends fire automatically on the hourly cron (times below are ET, editable in Settings).
        Everything is duplicate-safe: a template never reaches the same inbox twice.
        "Test" emails a [TEST] copy to centralgroupevents@gmail.com without touching the real send history.
      </p>
      {scheduled.length > 0 && (
        <div className="bg-secondary/30 border border-primary/25 rounded-xl px-4 py-3 space-y-2" data-testid="panel-btl-scheduled">
          <p className="text-sm font-semibold text-white">Scheduled sends</p>
          {scheduled.slice(0, 12).map((r) => {
            const label = tplDefs.find((t) => t.key === r.templateKey)?.label ?? r.templateKey;
            const who = r.kind === "person"
              ? `${r.recipientName} <${r.recipientEmail}>${r.cc ? ` · cc ${r.cc}` : ""}`
              : `${(() => { try { return JSON.parse(r.inviteeIds || "[]").length; } catch { return 0; } })()} invitees`;
            const badge = r.status === "pending" ? "text-amber-300 border-amber-400/30 bg-amber-400/10"
              : r.status === "sent" ? "text-green-300 border-green-400/30 bg-green-400/10"
              : r.status === "failed" ? "text-red-300 border-red-400/30 bg-red-400/10"
              : "text-white/50 border-white/15 bg-white/5";
            return (
              <div key={r.id} className="flex items-center justify-between gap-3 flex-wrap text-xs" data-testid={`row-btl-scheduled-${r.id}`}>
                <div className="min-w-[240px] flex-1">
                  <p className="text-white/90">{label} → {who}</p>
                  <p className="text-muted-foreground">
                    {etLabel(r.sendAt)}{r.resultMessage ? ` · ${r.resultMessage}` : ""}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider ${badge}`}>{r.status}</span>
                {r.status === "pending" && (
                  <Button size="sm" variant="ghost" onClick={() => cancelScheduled(r.id)} className="h-7 text-red-300 hover:text-red-200" data-testid={`button-btl-scheduled-cancel-${r.id}`}>
                    Cancel
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {failures.length > 0 && (
        <div className="bg-red-950/30 border border-red-500/30 rounded-xl px-4 py-3 space-y-1.5" data-testid="panel-btl-email-failures">
          <p className="text-sm font-semibold text-red-300">Recent delivery failures — this is why emails aren't going through:</p>
          {failures.slice(0, 5).map((f) => (
            <p key={f.id} className="text-xs text-white/80">
              <span className="text-muted-foreground">{f.sentAt ? new Date(f.sentAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}</span>
              {" · "}{f.templateKey} → {f.recipientEmail}
              <span className="block text-red-300/90 pl-3">{f.errorMessage || "no error recorded"}</span>
            </p>
          ))}
          <p className="text-xs text-muted-foreground">
            "Missing credentials" or "Username and Password not accepted" means the GMAIL_USER / GMAIL_APP_PASSWORD
            secrets are missing or the app password was revoked — generate a new Google app password and update the secret.
          </p>
        </div>
      )}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="bg-secondary/30 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap" data-testid={`row-btl-cadence-${row.key}`}>
              <div className="flex-1 min-w-[220px]">
                <p className="text-white font-medium">{row.label}</p>
                <p className="text-xs text-muted-foreground">
                  {row.sendAtEt ? `${row.sendAtEt.replace("T", " · ")} ET` : "manual send only"} · audience {row.audienceCount}
                  {row.sentCount > 0 && <span className="text-green-400"> · {row.sentCount} sent</span>}
                  {row.failedCount > 0 && <span className="text-red-400"> · {row.failedCount} failed</span>}
                </p>
                {row.blocked && <p className="text-xs text-amber-300 mt-1">⚠ Won't send yet — {row.blocked}</p>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openPreview(row.key)} className="border-white/20 text-white/70">
                  <Eye className="w-3.5 h-3.5 mr-1" /> Preview
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={testKey !== ""}
                  onClick={() => sendTest(row)}
                  className="border-primary/40 text-primary hover:bg-primary/10"
                  title="Email a [TEST] copy to centralgroupevents@gmail.com"
                  data-testid={`button-btl-test-${row.key}`}
                >
                  {testKey === row.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5 mr-1" /> Test</>}
                </Button>
                {row.key !== "initial_invite" && (
                  <Button
                    size="sm"
                    disabled={busyKey !== "" || !!row.blocked || row.audienceCount === 0}
                    onClick={() => sendNow(row)}
                    className="bg-primary hover:bg-primary/90"
                    data-testid={`button-btl-sendnow-${row.key}`}
                  >
                    {busyKey === row.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5 mr-1" /> Send now</>}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={preview !== null} onOpenChange={() => setPreview(null)}>
        {/* Don't auto-focus the iframe: it swallows Escape and the dialog can't be closed from the keyboard. */}
        <DialogContent className="max-w-2xl bg-secondary border-white/10" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-white">Preview — {preview?.subject}</DialogTitle>
          </DialogHeader>
          {preview && (
            <iframe title="email preview" tabIndex={-1} srcDoc={preview.html} className="w-full bg-white rounded-lg" style={{ height: "60vh", border: 0 }} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Templates (editable, Resend-style) ────────────────────────────────── */

type BtlTemplate = {
  key: string;
  label: string;
  placeholders: string[];
  subject: string;
  body: string;
  customized: boolean;
  defaultSubject: string;
  defaultBody: string;
};

function TemplatesView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: templates = [], isLoading, error } = useQuery<BtlTemplate[]>({ queryKey: ["/api/admin/btl/templates"] });
  const [selectedKey, setSelectedKey] = useState<string>("initial_invite");
  const [draft, setDraft] = useState<{ key: string; subject: string; body: string } | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "reset" | "send">("");
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // "Send to…" — fire the selected template at one person (name + email).
  // Built for the speaker emails; works for any template.
  const [sendOpen, setSendOpen] = useState(false);
  const [sendName, setSendName] = useState("");
  const [sendEmail, setSendEmail] = useState("");
  const [sendCc, setSendCc] = useState("");
  const [sendWhen, setSendWhen] = useState(""); // "" = now, else ET datetime-local

  async function sendToPerson() {
    if (!selected) return;
    if (dirty) {
      toast({ title: "Save the template first", description: "Sends use the saved version — hit Save template, then send.", variant: "destructive" });
      return;
    }
    const scheduling = sendWhen !== "";
    const ccPart = sendCc.trim() ? ` (cc: ${sendCc.trim()})` : "";
    const confirmMsg = scheduling
      ? `Schedule "${selected.label}" to ${sendName.trim()} <${sendEmail.trim()}>${ccPart} for ${sendWhen.replace("T", " ")} ET? You can cancel it from the Cadence view until it fires.`
      : `Send "${selected.label}" to ${sendName.trim()} <${sendEmail.trim()}>${ccPart} now? It comes from centralgroupevents@gmail.com as Anthony.`;
    if (!window.confirm(confirmMsg)) return;
    setBusy("send");
    try {
      if (scheduling) {
        await apiRequest("POST", "/api/admin/btl/scheduled", { kind: "person", templateKey: selected.key, name: sendName.trim(), email: sendEmail.trim(), cc: sendCc.trim(), sendAtEt: sendWhen });
        toast({ title: "Send scheduled", description: `Fires ${sendWhen.replace("T", " ")} ET — see the Cadence view to cancel.` });
        qc.invalidateQueries({ queryKey: ["/api/admin/btl/scheduled"] });
      } else {
        const res = await apiRequest("POST", `/api/admin/btl/templates/${selected.key}/send`, { name: sendName.trim(), email: sendEmail.trim(), cc: sendCc.trim() });
        const body = await res.json();
        toast({ title: `Sent to ${body.to}${body.cc?.length ? ` (cc: ${body.cc.join(", ")})` : ""}` });
      }
      setSendOpen(false);
      setSendName("");
      setSendEmail("");
      setSendCc("");
      setSendWhen("");
    } catch (err) {
      toast({ title: scheduling ? "Couldn't schedule" : "Send failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setBusy("");
    }
  }

  const selected = templates.find((t) => t.key === selectedKey) ?? templates[0];
  const subject = draft && draft.key === selected?.key ? draft.subject : selected?.subject ?? "";
  const body = draft && draft.key === selected?.key ? draft.body : selected?.body ?? "";
  const dirty = !!selected && (subject !== selected.subject || body !== selected.body);

  function pick(key: string) {
    if (dirty && !window.confirm("Discard unsaved changes to this template?")) return;
    setSelectedKey(key);
    setDraft(null);
  }

  function insertPlaceholder(ph: string) {
    const token = `{{${ph}}}`;
    const el = bodyRef.current;
    if (el && document.activeElement === el) {
      const start = el.selectionStart ?? body.length;
      const next = body.slice(0, start) + token + body.slice(el.selectionEnd ?? start);
      setDraft({ key: selected!.key, subject, body: next });
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); });
    } else {
      navigator.clipboard?.writeText(token).catch(() => {});
      toast({ title: `${token} copied — paste it where you want it` });
    }
  }

  async function save() {
    if (!selected) return;
    setBusy("save");
    try {
      await apiRequest("PUT", `/api/admin/btl/templates/${selected.key}`, { subject, body });
      toast({ title: "Template saved — every future send uses this version." });
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["/api/admin/btl/templates"] });
    } catch (err) {
      toast({ title: "Save failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setBusy("");
    }
  }

  async function resetToDefault() {
    if (!selected) return;
    if (!window.confirm(`Reset "${selected.label}" to the original template? Your edits to it are discarded.`)) return;
    setBusy("reset");
    try {
      await apiRequest("DELETE", `/api/admin/btl/templates/${selected.key}`);
      toast({ title: "Back to the original template." });
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["/api/admin/btl/templates"] });
    } catch (err) {
      toast({ title: "Reset failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setBusy("");
    }
  }

  async function openPreview() {
    if (!selected) return;
    try {
      // Preview renders the saved template, so unsaved edits save first.
      if (dirty) {
        if (!window.confirm("Preview shows the saved template — save your edits now and preview?")) return;
        await apiRequest("PUT", `/api/admin/btl/templates/${selected.key}`, { subject, body });
        setDraft(null);
        qc.invalidateQueries({ queryKey: ["/api/admin/btl/templates"] });
      }
      const res = await fetch(`/api/admin/btl/cadence/${selected.key}/preview`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setPreview({ subject: data.subject, html: data.html });
    } catch (err) {
      toast({ title: "Preview failed", description: String((err as Error).message), variant: "destructive" });
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (error || !selected) {
    return (
      <div className="bg-secondary/30 border border-amber-400/30 rounded-2xl p-6 text-center space-y-2">
        <p className="text-amber-300 font-medium">Couldn't load the email templates{error ? ` (${String((error as Error).message)})` : ""}.</p>
        <p className="text-sm text-muted-foreground">
          This usually means the server is running older code — on Replit, stop and restart the app after pulling,
          then reload this page. The live site needs a redeploy to pick up new code.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Edit any email in the sequence — subject and body — without touching code. Pieces in {"{{double_braces}}"} are
        filled in per person at send time (name, venue, times, links). Already-sent emails never change.
      </p>

      <div className="flex gap-2 flex-wrap">
        {templates.map((t) => (
          <button
            key={t.key}
            onClick={() => pick(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${selected.key === t.key ? "bg-primary text-white border-primary" : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"}`}
            data-testid={`button-btl-template-${t.key}`}
          >
            {t.label}
            {t.customized && <span className="ml-1.5 text-amber-300">●</span>}
          </button>
        ))}
      </div>

      <div className="bg-secondary/30 border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-bold text-white">
            {selected.label}
            {selected.customized && <span className="ml-2 text-xs font-normal text-amber-300">edited — original saved underneath</span>}
          </h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={openPreview} className="border-white/20 text-white/70" data-testid="button-btl-template-preview">
              <Eye className="w-3.5 h-3.5 mr-1" /> Preview
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSendOpen((v) => !v)} className="border-primary/40 text-primary hover:bg-primary/10" data-testid="button-btl-template-sendto">
              <Send className="w-3.5 h-3.5 mr-1" /> Send to…
            </Button>
            {selected.customized && (
              <Button size="sm" variant="outline" onClick={resetToDefault} disabled={busy !== ""} className="border-white/20 text-white/70" data-testid="button-btl-template-reset">
                {busy === "reset" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Reset to original"}
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={busy !== "" || !dirty} className="bg-primary hover:bg-primary/90" data-testid="button-btl-template-save">
              {busy === "save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save template"}
            </Button>
          </div>
        </div>

        {sendOpen && (
          <div className="bg-black/30 border border-primary/25 rounded-xl p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Sends this template to one person (CC anyone who should see it, separated by commas) — their name fills {"{{name}}"} / {"{{first_name}}"}. Real send, no [TEST] tag.
              Made for the speaker emails, but any template works.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-white/70 text-xs">Name</Label>
                <Input value={sendName} onChange={(e) => setSendName(e.target.value)} placeholder="Alnazir Blackman" className="bg-black/40 border-white/10 h-9" data-testid="input-btl-sendto-name" />
              </div>
              <div className="space-y-1">
                <Label className="text-white/70 text-xs">Email</Label>
                <Input value={sendEmail} onChange={(e) => setSendEmail(e.target.value)} placeholder="them@example.com" className="bg-black/40 border-white/10 h-9" data-testid="input-btl-sendto-email" />
              </div>
              <div className="space-y-1">
                <Label className="text-white/70 text-xs">CC (optional)</Label>
                <Input value={sendCc} onChange={(e) => setSendCc(e.target.value)} placeholder="manager@…, team@…" className="bg-black/40 border-white/10 h-9" data-testid="input-btl-sendto-cc" />
              </div>
              <Button size="sm" onClick={sendToPerson} disabled={busy !== "" || !sendName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sendEmail.trim())} className="bg-primary hover:bg-primary/90 h-9" data-testid="button-btl-sendto-send">
                {busy === "send" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                {sendWhen ? "Schedule send" : "Send now"}
              </Button>
            </div>
            <WhenPicker value={sendWhen} onChange={setSendWhen} />
          </div>
        )}

        <div>
          <Label className="text-white/70 text-xs">Subject</Label>
          <Input
            value={subject}
            onChange={(e) => setDraft({ key: selected.key, subject: e.target.value, body })}
            className="bg-black/30 border-white/10 h-10"
            data-testid="input-btl-template-subject"
          />
        </div>

        <div>
          <Label className="text-white/70 text-xs">Body (plain text — blank line = new paragraph, a “✦ TITLE” line becomes a gold section header)</Label>
          <Textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setDraft({ key: selected.key, subject, body: e.target.value })}
            className="bg-black/30 border-white/10 min-h-[380px] font-mono text-[13px] leading-relaxed"
            data-testid="input-btl-template-body"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap items-center">
          <span className="text-xs text-muted-foreground mr-1">Fill-ins:</span>
          {selected.placeholders.map((ph) => (
            <button
              key={ph}
              onClick={() => insertPlaceholder(ph)}
              className="px-2 py-0.5 rounded bg-primary/15 text-primary text-[11px] hover:bg-primary/25 transition"
              title="Click to insert at the cursor (or copy)"
            >
              {"{{"}{ph}{"}}"}
            </button>
          ))}
        </div>
      </div>

      <Dialog open={preview !== null} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-2xl bg-secondary border-white/10" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-white">Preview — {preview?.subject}</DialogTitle>
          </DialogHeader>
          {preview && (
            <iframe title="email preview" tabIndex={-1} srcDoc={preview.html} className="w-full bg-white rounded-lg" style={{ height: "60vh", border: 0 }} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Questions ─────────────────────────────────────────────────────────── */

function QuestionsView({ rsvps }: { rsvps: BtlRsvp[] }) {
  const { toast } = useToast();
  const { data: settings } = useQuery<BtlSettings>({ queryKey: ["/api/admin/btl/settings"] });
  const [themes, setThemes] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const value = themes ?? settings?.questionThemes ?? "";

  const grouped = useMemo(() => {
    const byTopic: Record<string, BtlRsvp[]> = {};
    for (const r of rsvps) {
      const topics = topicsOf(r);
      // The slim form skips topic checkboxes — those questions land in "General".
      for (const t of topics.length > 0 ? topics : ["general"]) {
        (byTopic[t] ??= []).push(r);
      }
    }
    return byTopic;
  }, [rsvps]);

  async function saveThemes() {
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/admin/btl/settings", { questionThemes: value });
      toast({ title: "Themes saved — the 'What this room wants to know' email can now send." });
    } catch (err) {
      toast({ title: "Save failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-secondary/30 border border-white/10 rounded-2xl p-5 space-y-3">
        <h3 className="font-bold text-white">Paraphrased themes for the "What this room wants to know" email</h3>
        <p className="text-xs text-muted-foreground">Read the questions below, write 3 short paraphrased themes (one per line). This fills the {"{{question_themes}}"} slot — the email refuses to send until this is filled.</p>
        <Textarea value={value} onChange={(e) => setThemes(e.target.value)} placeholder={"1. How do I protect my brand when a venue books me?\n2. What grants actually fund NJ creatives?\n3. …"} className="bg-black/30 border-white/10 min-h-[110px]" data-testid="input-btl-themes" />
        <Button onClick={saveThemes} disabled={saving} className="bg-primary hover:bg-primary/90">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save themes"}
        </Button>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Questions appear here as RSVPs come in.</p>
      ) : (
        Object.entries(grouped).map(([topic, people]) => (
          <div key={topic} className="bg-secondary/30 border border-white/10 rounded-2xl p-5">
            <h3 className="font-bold text-primary mb-3">{TOPIC_LABELS[topic] ?? topic} <span className="text-muted-foreground font-normal text-sm">({people.length})</span></h3>
            <div className="space-y-3">
              {people.map((r) => (
                <div key={`${topic}-${r.id}`} className="border-l-2 border-white/10 pl-3">
                  <p className="text-white/90 text-sm whitespace-pre-wrap">{r.keyQuestion}</p>
                  <p className="text-xs text-muted-foreground mt-1">— {r.name}, {r.role}</p>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ── Guest Book ────────────────────────────────────────────────────────── */

function GuestBookView({ rsvps }: { rsvps: BtlRsvp[] }) {
  const [sort, setSort] = useState<"alpha" | "category">("alpha");

  const sorted = useMemo(() => {
    const list = [...rsvps];
    if (sort === "alpha") list.sort((a, b) => a.name.localeCompare(b.name));
    else list.sort((a, b) => (a.adminCategory ?? "zz").localeCompare(b.adminCategory ?? "zz") || a.name.localeCompare(b.name));
    return list;
  }, [rsvps, sort]);

  function printIt() {
    const entries = sorted.map((r) => `
      <div style="break-inside:avoid;margin:0 0 22px">
        <p style="margin:0;font-size:15px"><strong>${r.name}</strong>${r.companyOrHandle ? ` · ${r.companyOrHandle}` : ""}</p>
        <p style="margin:2px 0 4px;font-size:12px;color:#777;text-transform:uppercase;letter-spacing:1px">${r.role}</p>
        <p style="margin:0;font-size:13.5px;line-height:1.5">${r.workingOnNow}</p>
      </div>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Build to Last Vol. 1 — Guest Book</title></head>
      <body style="font-family:Georgia,serif;color:#1a1611;max-width:640px;margin:40px auto;padding:0 24px">
        <div style="text-align:center;margin-bottom:36px">
          <h1 style="font-size:30px;margin:0;letter-spacing:2px">BUILD TO LAST</h1>
          <p style="margin:6px 0 0;font-style:italic">Vol. 1 — The Room · November 12, 2026 · Newark</p>
        </div>
        ${entries}
        <p style="text-align:center;color:#999;font-size:11px;margin-top:40px">Central Group Events</p>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">The printed guest book handed to every attendee — built live from RSVPs.</p>
        <div className="flex gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as "alpha" | "category")}>
            <SelectTrigger className="h-9 w-40 bg-black/30 border-white/10 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-secondary border-white/10 text-white">
              <SelectItem value="alpha">Alphabetical</SelectItem>
              <SelectItem value="category">By category</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={printIt} className="bg-primary hover:bg-primary/90" data-testid="button-btl-print-guestbook">
            <Printer className="w-4 h-4 mr-1.5" /> Print / Save PDF
          </Button>
        </div>
      </div>
      <div className="bg-white text-neutral-900 rounded-2xl p-8 max-w-xl mx-auto" style={{ fontFamily: "Georgia, serif" }}>
        <div className="text-center mb-7">
          <p className="text-2xl font-bold tracking-widest">BUILD TO LAST</p>
          <p className="italic text-sm mt-1">Vol. 1 — The Room · November 12, 2026 · Newark</p>
        </div>
        {sorted.length === 0 ? (
          <p className="text-center text-neutral-400 text-sm py-6">Guest book entries appear as RSVPs come in.</p>
        ) : (
          sorted.map((r) => (
            <div key={r.id} className="mb-5">
              <p className="text-[15px]"><strong>{r.name}</strong>{r.companyOrHandle ? ` · ${r.companyOrHandle}` : ""}</p>
              <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-0.5">{r.role}</p>
              <p className="text-[13.5px] leading-relaxed">{r.workingOnNow}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Check-in ──────────────────────────────────────────────────────────── */

function CheckinView({ rsvps }: { rsvps: BtlRsvp[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? rsvps.filter((r) => (r.name + " " + r.email).toLowerCase().includes(q)) : rsvps;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [rsvps, search]);

  async function toggle(r: BtlRsvp) {
    setBusyId(r.id);
    try {
      await apiRequest("PATCH", `/api/admin/btl/rsvps/${r.id}/checkin`, { checkedIn: !r.checkedInAt });
      qc.invalidateQueries({ queryKey: ["/api/admin/btl/rsvps"] });
    } catch (err) {
      toast({ title: "Check-in failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <p className="text-sm text-muted-foreground text-center">
        Day-of check-in. Only checked-in attendees get the 48-hour follow-up (photos, recap, contact sheet).
      </p>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name…"
        className="bg-secondary/30 border-white/10 h-12 text-lg"
        data-testid="input-btl-checkin-search"
      />
      <div className="space-y-2">
        {filtered.map((r) => (
          <button
            key={r.id}
            onClick={() => toggle(r)}
            disabled={busyId === r.id}
            className={`w-full flex items-center justify-between rounded-xl border px-4 py-4 text-left transition ${r.checkedInAt ? "bg-green-500/15 border-green-500/40" : "bg-secondary/30 border-white/10 hover:bg-white/5"}`}
            data-testid={`button-btl-checkin-${r.id}`}
          >
            <span>
              <span className="block text-white font-semibold text-base">{r.name}</span>
              <span className="block text-xs text-muted-foreground">{r.role}</span>
            </span>
            {busyId === r.id
              ? <Loader2 className="w-5 h-5 animate-spin text-white/50" />
              : r.checkedInAt
                ? <span className="inline-flex items-center gap-1 text-green-400 text-sm font-bold"><Check className="w-5 h-5" /> In</span>
                : <span className="text-white/30 text-sm">Tap to check in</span>}
          </button>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No matches.</p>}
      </div>
    </div>
  );
}

/* ── Settings ──────────────────────────────────────────────────────────── */

const SPEAKER_TOPIC_DEFAULTS = [
  "legal protection for creators",
  "grants and non-dilutive funding in Newark",
  "venue economics from the operator's seat",
  "where Newark is actually heading in the next three years",
];

function SettingsView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery<BtlSettings>({ queryKey: ["/api/admin/btl/settings"] });
  const [draft, setDraft] = useState<BtlSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const s = draft ?? settings;

  function set<K extends keyof BtlSettings>(key: K, value: BtlSettings[K]) {
    if (!s) return;
    setDraft({ ...s, [key]: value });
  }

  function setSpeaker(i: number, field: "name" | "credential", value: string) {
    if (!s) return;
    const speakers = [0, 1, 2, 3].map((idx) => s.speakers[idx] ?? { name: "", credential: "", topic: SPEAKER_TOPIC_DEFAULTS[idx] });
    speakers[i] = { ...speakers[i], [field]: value, topic: speakers[i].topic || SPEAKER_TOPIC_DEFAULTS[i] };
    setDraft({ ...s, speakers });
  }

  async function save() {
    if (!s) return;
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/admin/btl/settings", {
        ...s,
        speakers: s.speakers.filter((sp) => sp.name.trim()),
      });
      toast({ title: "Settings saved" });
      qc.invalidateQueries({ queryKey: ["/api/admin/btl/settings"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/btl/cadence"] });
      setDraft(null);
    } catch (err) {
      toast({ title: "Save failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !s) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const inputCls = "bg-black/30 border-white/10 h-10";
  const sendAtKeys = Object.keys(s.sendAt).filter((k) => k !== "initial_invite");

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="bg-secondary/30 border border-white/10 rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-white">Venue & times (fill into every email)</h3>
        <div>
          <Label className="text-white/70 text-xs">Sign-up link (sponsor/AisleGo) — every RSVP button in the emails points here; leave blank to use /build-to-last</Label>
          <Input value={s.rsvpUrl ?? ""} onChange={(e) => set("rsvpUrl", e.target.value)} placeholder="https://www.aislego.com/…" className={inputCls} data-testid="input-btl-rsvp-url" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label className="text-white/70 text-xs">Venue name</Label><Input value={s.venueName} onChange={(e) => set("venueName", e.target.value)} className={inputCls} data-testid="input-btl-venue-name" /></div>
          <div><Label className="text-white/70 text-xs">Venue address (shown in logistics + "Tomorrow" email)</Label><Input value={s.venueAddress} onChange={(e) => set("venueAddress", e.target.value)} className={inputCls} data-testid="input-btl-venue-address" /></div>
          <div><Label className="text-white/70 text-xs">Doors time</Label><Input value={s.doorsTime} onChange={(e) => set("doorsTime", e.target.value)} className={inputCls} /></div>
          <div><Label className="text-white/70 text-xs">Programming starts</Label><Input value={s.programStartTime} onChange={(e) => set("programStartTime", e.target.value)} className={inputCls} /></div>
        </div>
      </div>

      <div className="bg-secondary/30 border border-white/10 rounded-2xl p-5 space-y-3">
        <h3 className="font-bold text-white">Speakers (unlocks the speaker-announcement email)</h3>
        {[0, 1, 2, 3].map((i) => {
          const sp = s.speakers[i] ?? { name: "", credential: "", topic: SPEAKER_TOPIC_DEFAULTS[i] };
          return (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input placeholder={`Speaker ${i + 1} name`} value={sp.name} onChange={(e) => setSpeaker(i, "name", e.target.value)} className={inputCls} data-testid={`input-btl-speaker-name-${i}`} />
              <Input placeholder="Credential (e.g. Esq., entertainment attorney)" value={sp.credential} onChange={(e) => setSpeaker(i, "credential", e.target.value)} className={inputCls} />
              <p className="text-xs text-muted-foreground sm:col-span-2">on {sp.topic || SPEAKER_TOPIC_DEFAULTS[i]}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-secondary/30 border border-white/10 rounded-2xl p-5 space-y-3">
        <h3 className="font-bold text-white">48-hour follow-up links (unlock the follow-up email)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label className="text-white/70 text-xs">Photo gallery URL</Label><Input value={s.photoGalleryUrl} onChange={(e) => set("photoGalleryUrl", e.target.value)} className={inputCls} /></div>
          <div><Label className="text-white/70 text-xs">Recap video URL</Label><Input value={s.recapVideoUrl} onChange={(e) => set("recapVideoUrl", e.target.value)} className={inputCls} /></div>
          <div><Label className="text-white/70 text-xs">Field notes URL</Label><Input value={s.fieldNotesUrl} onChange={(e) => set("fieldNotesUrl", e.target.value)} className={inputCls} /></div>
          <div><Label className="text-white/70 text-xs">Contact sheet URL (opt-ins only see this)</Label><Input value={s.contactSheetUrl} onChange={(e) => set("contactSheetUrl", e.target.value)} className={inputCls} /></div>
        </div>
      </div>

      <div className="bg-secondary/30 border border-white/10 rounded-2xl p-5 space-y-3">
        <h3 className="font-bold text-white">Send schedule (Eastern Time)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sendAtKeys.map((key) => (
            <div key={key}>
              <Label className="text-white/70 text-xs">{key}</Label>
              <Input
                type="datetime-local"
                value={s.sendAt[key] ?? ""}
                onChange={(e) => setDraft({ ...s, sendAt: { ...s.sendAt, [key]: e.target.value } })}
                className={inputCls}
                data-testid={`input-btl-sendat-${key}`}
              />
            </div>
          ))}
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90" data-testid="button-btl-save-settings">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save settings"}
      </Button>
    </div>
  );
}
