import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Loader2, Printer, FileX } from "lucide-react";

type InvoiceData = {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  eventName: string | null;
  items: Array<{ description: string; quantity: number; unitPriceCents: number }>;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  notes: string | null;
  paymentInstructions: string | null;
  status: string;
  dueDate: string | null;
  createdAt: string | null;
  paidAt: string | null;
};

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Client-facing invoice view, reached from the signed link in the invoice
 * email (/invoice/:number?t=hmac). Deliberately styled light + minimal so
 * the browser's Print / Save-as-PDF output looks like a real document.
 */
export default function Invoice() {
  const [, params] = useRoute("/invoice/:number");
  const [data, setData] = useState<InvoiceData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const number = params?.number;
    const token = new URLSearchParams(window.location.search).get("t") || "";
    if (!number) {
      setError("Invalid invoice link.");
      return;
    }
    fetch(`/api/invoices/${encodeURIComponent(number)}?t=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((body as { message?: string }).message || "Could not load invoice");
        setData(body as InvoiceData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load invoice"));
  }, [params?.number]);

  if (error) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-sm">
          <FileX className="w-10 h-10 mx-auto text-red-500" />
          <h1 className="text-xl font-bold">Invoice unavailable</h1>
          <p className="text-sm text-gray-600">
            {error} If you think this is a mistake, email{" "}
            <a href="mailto:centralgroupevents@gmail.com" className="text-purple-700 underline">centralgroupevents@gmail.com</a>.
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 py-8 px-4 print:bg-white print:py-0">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-end mb-4 print:hidden">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg"
            data-testid="button-print-invoice"
          >
            <Printer className="w-4 h-4" /> Print / Save as PDF
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 print:shadow-none print:border-0 print:p-0">
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-xl font-black text-purple-700">Central Group Events</h1>
              <p className="text-xs text-gray-500 mt-1">NJ event promotion · centralgroupevents.com</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold tracking-wide">INVOICE</p>
              <p className="text-sm text-gray-600">{data.invoiceNumber}</p>
              {data.dueDate && <p className="text-sm text-gray-600">Due {data.dueDate}</p>}
              {data.status === "paid" && (
                <p className="inline-block mt-1 text-xs font-bold text-green-700 border border-green-600 rounded px-2 py-0.5">PAID</p>
              )}
            </div>
          </div>

          <div className="mb-8">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Billed to</p>
            <p className="font-semibold">{data.clientName}</p>
            <p className="text-sm text-gray-600">{data.clientEmail}</p>
            {data.eventName && <p className="text-sm text-gray-600 mt-1">Event: {data.eventName}</p>}
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-purple-50">
                <th className="text-left px-3 py-2.5 text-xs uppercase tracking-wide text-gray-600">Description</th>
                <th className="text-center px-3 py-2.5 text-xs uppercase tracking-wide text-gray-600">Qty</th>
                <th className="text-right px-3 py-2.5 text-xs uppercase tracking-wide text-gray-600">Unit</th>
                <th className="text-right px-3 py-2.5 text-xs uppercase tracking-wide text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-3 py-2.5">{it.description}</td>
                  <td className="px-3 py-2.5 text-center">{it.quantity}</td>
                  <td className="px-3 py-2.5 text-right">{money(it.unitPriceCents)}</td>
                  <td className="px-3 py-2.5 text-right">{money(it.quantity * it.unitPriceCents)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className="px-3 py-2.5 text-right text-gray-500">Subtotal</td>
                <td className="px-3 py-2.5 text-right">{money(data.subtotalCents)}</td>
              </tr>
              {data.discountCents > 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-1.5 text-right text-gray-500">Discount</td>
                  <td className="px-3 py-1.5 text-right text-green-700">−{money(data.discountCents)}</td>
                </tr>
              )}
              {data.taxCents > 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-1.5 text-right text-gray-500">Tax</td>
                  <td className="px-3 py-1.5 text-right">{money(data.taxCents)}</td>
                </tr>
              )}
              <tr className="border-t-2 border-gray-900">
                <td colSpan={3} className="px-3 py-3 text-right font-bold">Total due</td>
                <td className="px-3 py-3 text-right font-bold text-base">{money(data.totalCents)}</td>
              </tr>
            </tbody>
          </table>

          {data.paymentInstructions && (
            <div className="mt-6 bg-gray-50 rounded-lg p-4 print:bg-white print:border print:border-gray-200">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-1">How to pay</p>
              <p className="text-sm whitespace-pre-wrap">{data.paymentInstructions}</p>
            </div>
          )}

          {data.notes && <p className="mt-4 text-sm text-gray-600 whitespace-pre-wrap">{data.notes}</p>}

          <p className="mt-8 text-xs text-gray-400 text-center">
            Questions about this invoice? Email centralgroupevents@gmail.com
          </p>
        </div>
      </div>
    </div>
  );
}
