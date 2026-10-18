import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Download, Loader2 } from "lucide-react";

type BtlRsvp = {
  id: number;
  name: string;
  email: string;
  role: string;
  companyOrHandle: string | null;
  workingOnNow: string;
  keyQuestion: string;
  topicInterests: string; // JSON array
  contactSheetOptin: boolean;
  attendeeSource: string | null;
  adminCategory: string | null;
  confirmationSentAt: string | null;
  checkedInAt: string | null;
  unsubscribed: boolean;
  createdAt: string | null;
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
  legal: "Legal",
  funding: "Funding",
  venue: "Venue econ",
  market: "Newark next 3y",
};

function topicsOf(r: BtlRsvp): string[] {
  try {
    const arr = JSON.parse(r.topicInterests);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function BuildToLastTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: rsvps = [], isLoading } = useQuery<BtlRsvp[]>({ queryKey: ["/api/admin/btl/rsvps"] });
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

  const optIns = rsvps.filter((r) => r.contactSheetOptin).length;

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
      ["Name", "Email", "Role", "Company/Handle", "Category", "Working on", "Key question", "Topics", "Contact sheet", "Source", "RSVP'd at"],
      ...rsvps.map((r) => [
        r.name, r.email, r.role, r.companyOrHandle ?? "", r.adminCategory ?? "",
        r.workingOnNow, r.keyQuestion, topicsOf(r).join("; "),
        r.contactSheetOptin ? "yes" : "no", r.attendeeSource ?? "",
        r.createdAt ? new Date(r.createdAt).toLocaleString("en-US") : "",
      ]),
    ];
    const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "build-to-last-rsvps.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="bg-secondary/30 border border-white/10 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-black">Build to Last Vol. 1</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Thursday, Nov 12 · Equal Space, Newark · RSVP page at{" "}
              <a href="/build-to-last" target="_blank" rel="noopener noreferrer" className="text-primary underline">/build-to-last</a>
            </p>
          </div>
          <Button variant="outline" onClick={exportCsv} className="border-white/20 text-white/80 hover:bg-white/5" data-testid="button-btl-export">
            <Download className="w-4 h-4 mr-1.5" /> Export CSV
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            ["Confirmed", rsvps.length],
            ["Contact-sheet opt-ins", optIns],
            ["Categorized", rsvps.filter((r) => r.adminCategory).length],
            ["Unsubscribed", rsvps.filter((r) => r.unsubscribed).length],
          ].map(([label, n]) => (
            <div key={String(label)} className="bg-black/30 border border-white/10 rounded-xl p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className="text-2xl font-black text-white" data-testid={`stat-btl-${String(label).toLowerCase().replace(/[^a-z]+/g, "-")}`}>{n}</p>
            </div>
          ))}
        </div>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search RSVPs — name, email, role, question…"
        className="bg-secondary/30 border-white/10 h-10"
        data-testid="input-btl-search"
      />

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
                          <span key={t} className="px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[11px]">{TOPIC_LABELS[t] ?? t}</span>
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
