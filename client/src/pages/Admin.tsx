import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor, RichTextViewer } from "@/components/RichTextEditor";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  BookOpen,
  BarChart2,
  Users,
  ClipboardList,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Globe,
  Lock,
  History,
  RotateCcw,
  Send,
  X,
  Eye,
  Loader2,
  Download,
  Upload,
  Mail,
  ImagePlus,
  CheckCircle2,
  FileText,
  Copy,
  ChevronDown,
  ChevronUp,
  Search,
  Megaphone,
  Star,
  Phone,
  MessageCircle,
  Instagram,
} from "lucide-react";
import cgeLogo from "@assets/CGE_logo_1772075137138.png";
import { SEO } from "@/components/SEO";
import { LineChart, Line, ResponsiveContainer } from "recharts";

type AdminUser = { email: string; role: string };

type Event = {
  id: number;
  title: string;
  city: string | null;
  region: string;
  date: string;
  imageUrl: string;
  ticketLink: string | null;
  description: string;
  eventTime: string | null;
  venue: string | null;
  organizer: string | null;
  influencer: string | null;
  genre: string | null;
  instagramHandle: string | null;
  isFeatured?: boolean;
};

type Booking = {
  id: number;
  mode: string | null;
  eventName: string | null;
  venueName: string;
  contactName: string | null;
  phone: string | null;
  email: string;
  eventDate: string;
  eventTime: string | null;
  city: string | null;
  region: string;
  eventType: string;
  eventTypeOther: string | null;
  adminNotes: string | null;
  budgetRange: string | null;
  instagramHandle: string | null;
  readyToMoveForward: string | null;
  status: string | null;
  createdAt: string | null;
};

type Subscriber = {
  id: number;
  name: string;
  email: string;
  region: string | null;
  referrer: string | null;
  createdAt: string | null;
};

type EventForm = {
  title: string;
  date: string;
  eventTime: string;
  venue: string;
  city: string;
  region: string;
  instagramHandle: string;
  organizer: string;
  influencer: string;
  genre: string;
  ticketLink: string;
  imageUrl: string;
};

type Post = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  coverImageUrl: string | null;
  isGated: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PostVersion = {
  id: number;
  postId: number;
  title: string;
  content: string;
  savedAt: string;
};

type AnalyticsData = {
  totalSubscribers: number;
  postViews: { postId: number; title: string; views: number }[];
  linkClicks: { url: string; count: number; sourcePage: string | null }[];
  memberSources: { referrer: string; count: number }[];
  window: {
    days: number | null;
    subscribers: number;
    postViews: number;
    linkClicks: number;
    prior: { subscribers: number; postViews: number; linkClicks: number };
  };
  daily: {
    subscribers: { date: string; count: number }[];
    postViews: { date: string; count: number }[];
    linkClicks: { date: string; count: number }[];
  };
};

type EventAnalyticsData = {
  events: { eventId: number; title: string; date: string; region: string; city: string | null; clicks: number }[];
  regions: { region: string; clicks: number; events: number }[];
  cities: { city: string; region: string; clicks: number }[];
  sources: {
    subscriberSources: { referrer: string; count: number }[];
    clickSourcePages: { sourcePage: string; count: number }[];
  };
  funnel: { step: string; sessions: number }[];
};

const FUNNEL_STEPS_ORDER = ["Package", "Event Details", "Logistics", "Contact Info", "Terms", "Payment", "Submitted"];

const ANALYTICS_RANGES = [
  { label: "7d",  days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: null as number | null },
] as const;

function fillDailySeries(rows: { date: string; count: number }[], days: number): { date: string; count: number }[] {
  const byDate = new Map(rows.map((r) => [r.date, r.count]));
  const out: { date: string; count: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: byDate.get(key) ?? 0 });
  }
  return out;
}

function percentChange(current: number, prior: number): { pct: number; direction: "up" | "down" | "flat" } | null {
  if (prior === 0) {
    if (current === 0) return { pct: 0, direction: "flat" };
    return null;
  }
  const pct = ((current - prior) / prior) * 100;
  if (Math.abs(pct) < 0.5) return { pct: 0, direction: "flat" };
  return { pct, direction: pct > 0 ? "up" : "down" };
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Sparkline({ data, color = "hsl(280 62% 48%)" }: { data: { date: string; count: number }[]; color?: string }) {
  if (!data.length || data.every((d) => d.count === 0)) {
    return <div className="h-10 flex items-end text-[10px] text-muted-foreground/60">no activity</div>;
  }
  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <Line type="monotone" dataKey="count" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

type AdminMember = {
  id: number;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

const emptyEventForm: EventForm = {
  title: "",
  date: "",
  eventTime: "",
  venue: "",
  city: "",
  region: "",
  instagramHandle: "",
  organizer: "",
  influencer: "",
  genre: "",
  ticketLink: "",
  imageUrl: "",
};

const TABS = [
  { id: "events", label: "Events", icon: Calendar },
  { id: "this-week", label: "This Week", icon: Megaphone },
  { id: "bookings", label: "Bookings", icon: ClipboardList },
  { id: "subscribers", label: "Subscribers", icon: Mail },
  { id: "blog", label: "Blog Posts", icon: BookOpen },
  { id: "pages", label: "Pages", icon: BookOpen },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "world-cup", label: "World Cup", icon: Star },
  { id: "nba-finals", label: "NBA Finals", icon: Star },
  { id: "team", label: "Team Members", icon: Users },
] as const;

type TabId = (typeof TABS)[number]["id"];

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ─────────────────────────────────────────────────────────── */
/*  LOGIN SCREEN                                              */
/* ─────────────────────────────────────────────────────────── */
function LoginScreen({ onLogin }: { onLogin: (user: AdminUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid credentials");
      onLogin(data as AdminUser);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <img src={cgeLogo} alt="Central Group Events" className="h-16 w-auto object-contain mx-auto mb-6" />
          <h1 className="text-2xl font-black text-white">CGE Admin</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to your dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-secondary/40 border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-white/80">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="bg-black/40 border-white/10 h-11"
              autoFocus
              required
              data-testid="input-admin-email"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-black/40 border-white/10 h-11"
              required
              data-testid="input-admin-password"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 h-11 font-semibold"
            data-testid="button-admin-login"
          >
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  IMAGE UPLOAD COMPONENT                                    */
/* ─────────────────────────────────────────────────────────── */
function ImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");
      onChange(data.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
            data-testid="input-image-file"
          />
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              uploading
                ? "border-white/10 text-white/30 cursor-not-allowed"
                : "border-white/20 text-white/70 hover:bg-white/10 cursor-pointer"
            }`}
          >
            {uploading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
            ) : (
              <><ImagePlus className="w-3.5 h-3.5" /> Upload Image</>
            )}
          </span>
        </label>
      </div>
      {uploadError && <p className="text-red-400 text-xs">{uploadError}</p>}
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setUploadError(""); }}
        placeholder="Or paste image URL…"
        className="bg-black/40 border-white/10 h-11 text-sm"
        data-testid="input-image-url"
      />
      {value && (
        <div className="rounded-lg border border-white/10 overflow-hidden bg-black/40">
          <img
            src={value}
            alt="Cover preview"
            className="w-full max-h-48 object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  SUBSCRIBERS TAB                                           */
/* ─────────────────────────────────────────────────────────── */

const SUB_REGIONS = ["All", "North NJ", "Central NJ", "South NJ", "No Region"] as const;
const SUB_SOURCES = ["All", "direct", "instagram", "newsletter", "booking", "wizard", "gate"] as const;
type SubSortCol = "email" | "name" | "region" | "source" | "joined";

function SubscribersTab() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // ── filter + sort state ──────────────────────────────────
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("All");
  const [sourceFilter, setSourceFilter] = useState<string>("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortCol, setSortCol] = useState<SubSortCol>("joined");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // ── import state ─────────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState<"csv" | "paste">("csv");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; invalidFormat?: number } | null>(null);

  const { data: subscribers = [], isLoading } = useQuery<Subscriber[]>({
    queryKey: ["/api/admin/subscribers"],
  });

  const deleteSubscriberMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/subscribers/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/subscribers"] });
      toast({ title: "Subscriber deleted" });
    },
    onError: () => toast({ title: "Failed to delete subscriber", variant: "destructive" }),
  });

  // ── combined filter ───────────────────────────────────────
  const filtered: Subscriber[] = (() => {
    let list = subscribers;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.email.toLowerCase().includes(q));
    }
    if (regionFilter !== "All") {
      if (regionFilter === "No Region") {
        list = list.filter(s => !s.region);
      } else {
        list = list.filter(s => s.region === regionFilter);
      }
    }
    if (sourceFilter !== "All") {
      const src = sourceFilter === "direct" ? "" : sourceFilter;
      list = list.filter(s => {
        const ref = (s.referrer ?? "").toLowerCase().trim();
        return sourceFilter === "direct" ? (!ref || ref === "direct") : ref === src;
      });
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      list = list.filter(s => s.createdAt && new Date(s.createdAt).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86_400_000; // inclusive end-of-day
      list = list.filter(s => s.createdAt && new Date(s.createdAt).getTime() <= to);
    }

    // ── sort ─────────────────────────────────────────────────
    list = [...list].sort((a, b) => {
      let aVal = "";
      let bVal = "";
      switch (sortCol) {
        case "email":   aVal = a.email; bVal = b.email; break;
        case "name":    aVal = a.name ?? ""; bVal = b.name ?? ""; break;
        case "region":  aVal = a.region ?? ""; bVal = b.region ?? ""; break;
        case "source":  aVal = a.referrer ?? "direct"; bVal = b.referrer ?? "direct"; break;
        case "joined":  aVal = a.createdAt ?? ""; bVal = b.createdAt ?? ""; break;
      }
      const cmp = aVal.localeCompare(bVal);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  })();

  const hasActiveFilter = search.trim() || regionFilter !== "All" || sourceFilter !== "All" || dateFrom || dateTo;

  function handleSortClick(col: SubSortCol) {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function SortIcon({ col }: { col: SubSortCol }) {
    if (sortCol !== col) return <ChevronDown className="w-3.5 h-3.5 text-white/20 inline ml-1" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3.5 h-3.5 text-primary inline ml-1" />
      : <ChevronDown className="w-3.5 h-3.5 text-primary inline ml-1" />;
  }

  function exportCsv() {
    const rows = [
      ["Email", "Name", "Region", "Referrer", "Date Joined"],
      ...subscribers.map((s) => [
        s.email,
        s.name ?? "",
        s.region ?? "",
        s.referrer ?? "",
        s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-US") : "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cge-subscribers.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function parseCsvSubscriberFile(file: File) {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeaderValue,
    });

    const headers = parsed.meta.fields ?? [];
    const emailHeader = findEmailHeader(headers);
    if (!emailHeader) {
      throw new Error(`No email column found. Columns found: ${headers.join(", ") || "none"}`);
    }

    const rows: { email: string }[] = [];
    let invalidCount = 0;
    for (const row of parsed.data) {
      const email = normalizeEmail(String(row[emailHeader] ?? ""));
      if (email && EMAIL_REGEX.test(email)) {
        rows.push({ email });
      } else {
        invalidCount++;
      }
    }

    return { rows, invalidCount };
  }

  async function parseXlsxSubscriberFile(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    const rows = Array.isArray(allRows) ? allRows.filter((row) => Array.isArray(row) && row.some((cell) => String(cell).trim() !== "")) : [];

    if (rows.length < 2) {
      throw new Error("Spreadsheet appears to be empty or has only headers.");
    }

    const headers = (rows[0] as unknown[]).map((cell) => normalizeHeaderValue(String(cell ?? "")));
    const emailHeader = findEmailHeader(headers);
    if (!emailHeader) {
      throw new Error(`No email column found. Columns found: ${headers.join(", ") || "none"}`);
    }

    const emailColumnIndex = headers.indexOf(emailHeader);
    const parsedRows: { email: string }[] = [];
    let invalidCount = 0;

    for (const row of rows.slice(1)) {
      const value = String((row as unknown[])[emailColumnIndex] ?? "");
      const email = normalizeEmail(value);
      if (email && EMAIL_REGEX.test(email)) {
        parsedRows.push({ email });
      } else {
        invalidCount++;
      }
    }

    return { rows: parsedRows, invalidCount };
  }

  async function handleImport() {
    setImporting(true);
    setImportResult(null);
    try {
      let rows: Array<{ email: string }> = [];
      let invalidCount = 0;

      if (importTab === "csv" && csvFile) {
        const isExcel = /\.(xlsx|xls)$/i.test(csvFile.name) ||
          csvFile.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
          csvFile.type === "application/vnd.ms-excel";

        const parsed = isExcel
          ? await parseXlsxSubscriberFile(csvFile)
          : await parseCsvSubscriberFile(csvFile);

        rows = parsed.rows;
        invalidCount = parsed.invalidCount;
      } else if (importTab === "paste") {
        const parsedRows = pasteText
          .split(/[\r\n,;]+/)
          .map((e) => normalizeEmail(e))
          .filter((e) => EMAIL_REGEX.test(e));

        rows = parsedRows.map((email) => ({ email }));
        invalidCount = pasteText
          .split(/[\r\n,;]+/)
          .map((e) => normalizeEmail(e))
          .filter((e) => e && !EMAIL_REGEX.test(e)).length;
      }

      if (rows.length === 0) {
        toast({ title: "No valid emails found", description: "Please provide at least one valid email.", variant: "destructive" });
        setImporting(false);
        return;
      }

      const res = await apiRequest("POST", "/api/subscribers/import", rows);
      const result = await res.json();
      setImportResult({ ...result, invalidFormat: invalidCount > 0 ? invalidCount : result.invalidFormat });
      qc.invalidateQueries({ queryKey: ["/api/admin/subscribers"] });
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("No email column found")) {
        toast({ title: "CSV Error", description: err.message, variant: "destructive" });
      } else {
        toast({ title: "Import failed", description: "An error occurred during import.", variant: "destructive" });
      }
    } finally {
      setImporting(false);
    }
  }

  function resetImportModal() {
    setImportTab("csv");
    setCsvFile(null);
    setPasteText("");
    setImportResult(null);
    setImporting(false);
  }

  return (
    <div className="space-y-5">
      {/* ── Stat cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-secondary/30 border border-white/10 rounded-xl p-5">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Total Subscribers</p>
          {isLoading ? (
            <Skeleton className="h-9 w-20 mt-1" />
          ) : (
            <p className="text-3xl font-black text-white">{subscribers.length.toLocaleString()}</p>
          )}
        </div>
        <div className="bg-secondary/30 border border-white/10 rounded-xl p-5">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Total Shown</p>
          {isLoading ? (
            <Skeleton className="h-9 w-20 mt-1" />
          ) : (
            <p className={`text-3xl font-black ${hasActiveFilter ? "text-primary" : "text-white"}`}>
              {filtered.length.toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* ── Action bar ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email…"
          className="bg-black/40 border-white/10 h-9 w-52"
          data-testid="input-subscriber-search"
        />
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={subscribers.length === 0}
          className="border-white/20 text-white/70 hover:bg-white/10" data-testid="button-export-subscribers">
          <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
        </Button>
        <Button size="sm" variant="outline" onClick={() => { resetImportModal(); setImportOpen(true); }}
          className="border-white/20 text-white/70 hover:bg-white/10" data-testid="button-import-subscribers">
          <Upload className="w-3.5 h-3.5 mr-1.5" /> Import
        </Button>
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mr-1 shrink-0">Filter:</span>

        {/* Region */}
        <Select value={regionFilter} onValueChange={setRegionFilter}>
          <SelectTrigger className="h-8 w-36 bg-black/40 border-white/10 text-xs" data-testid="select-region-filter">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent className="bg-secondary border-white/10 text-white text-xs">
            {SUB_REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Source */}
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="h-8 w-36 bg-black/40 border-white/10 text-xs" data-testid="select-source-filter">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent className="bg-secondary border-white/10 text-white text-xs">
            {SUB_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 rounded-md bg-black/40 border border-white/10 text-xs text-white px-2 focus:outline-none focus:ring-1 focus:ring-primary"
            data-testid="input-date-from"
          />
          <span className="text-xs text-muted-foreground">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 rounded-md bg-black/40 border border-white/10 text-xs text-white px-2 focus:outline-none focus:ring-1 focus:ring-primary"
            data-testid="input-date-to"
          />
        </div>

        {/* Clear filters */}
        {hasActiveFilter && (
          <button
            onClick={() => { setSearch(""); setRegionFilter("All"); setSourceFilter("All"); setDateFrom(""); setDateTo(""); }}
            className="text-xs text-primary hover:text-primary/80 transition-colors ml-auto"
            data-testid="button-clear-filters"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>{hasActiveFilter ? "No subscribers match the active filters." : "No subscribers yet."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-secondary/60 text-muted-foreground text-left select-none">
                  {(
                    [
                      { col: "email" as SubSortCol, label: "Email" },
                      { col: "name" as SubSortCol, label: "Name" },
                      { col: "region" as SubSortCol, label: "Region" },
                      { col: "source" as SubSortCol, label: "Source" },
                      { col: "joined" as SubSortCol, label: "Date Joined" },
                    ] as const
                  ).map(({ col, label }) => (
                    <th
                      key={col}
                      className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors whitespace-nowrap"
                      onClick={() => handleSortClick(col)}
                      data-testid={`th-${col}`}
                    >
                      {label}
                      <SortIcon col={col} />
                    </th>
                  ))}
                  <th className="px-4 py-3 font-medium text-right text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub, i) => (
                  <tr
                    key={sub.id}
                    data-testid={`row-subscriber-${sub.id}`}
                    className={`border-b border-white/5 hover:bg-white/5 ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-white">
                      <a href={`mailto:${sub.email}`} className="hover:text-primary transition-colors">{sub.email}</a>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{sub.name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{sub.region || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        !sub.referrer || sub.referrer === "direct"
                          ? "bg-white/10 text-white/60"
                          : "bg-primary/15 text-primary/90"
                      }`}>
                        {sub.referrer || "direct"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(sub.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete subscriber ${sub.email}?`)) {
                            deleteSubscriberMutation.mutate(sub.id);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10 transition"
                        data-testid={`button-delete-subscriber-${sub.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Import Modal ───────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) resetImportModal(); }}>
        <DialogContent className="bg-[#0d0d0d] border border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Import Subscribers</DialogTitle>
          </DialogHeader>

          <div className="flex gap-1 bg-white/5 rounded-lg p-1 mb-4">
            {(["csv", "paste"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setImportTab(t)}
                data-testid={`tab-import-${t}`}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${importTab === t ? "bg-primary text-white" : "text-white/50 hover:text-white/80"}`}
              >
                {t === "csv" ? "Upload CSV" : "Paste Emails"}
              </button>
            ))}
          </div>

          {importTab === "csv" ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Upload a CSV or Excel file with an <code className="text-primary">email</code> column. Other columns are ignored.</p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv"
                data-testid="input-csv-file"
                onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-white/70 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer"
              />
              {csvFile && <p className="text-xs text-white/50">{csvFile.name}</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Paste emails separated by newlines, commas, or semicolons.</p>
              <Textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="user@example.com&#10;another@email.com"
                rows={6}
                data-testid="textarea-paste-emails"
                className="bg-black/40 border-white/10 text-white text-sm resize-none"
              />
            </div>
          )}

          {importResult && (
            <div className="mt-2 p-3 rounded-lg bg-white/5 border border-white/10 text-sm space-y-0.5">
              <p className="text-green-400 font-semibold">✓ {importResult.imported} imported</p>
              {importResult.skipped > 0 && (
                <p className="text-white/50">⟳ {importResult.skipped} skipped (already subscribed)</p>
              )}
              {(importResult.invalidFormat ?? 0) > 0 && (
                <p className="text-yellow-500/80">⚠ {importResult.invalidFormat} invalid email format (ignored)</p>
              )}
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" className="border-white/20 text-white/70" onClick={() => setImportOpen(false)} data-testid="button-cancel-import">
              {importResult ? "Close" : "Cancel"}
            </Button>
            {!importResult && (
              <Button
                onClick={handleImport}
                disabled={importing || (importTab === "csv" ? !csvFile : !pasteText.trim())}
                className="bg-primary hover:bg-primary/80"
                data-testid="button-confirm-import"
              >
                {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing…</> : "Import"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  BLOG POSTS TAB                                            */
/* ─────────────────────────────────────────────────────────── */
function BlogPostsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showVersionsFor, setShowVersionsFor] = useState<number | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  const [postForm, setPostForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverImageUrl: "",
    isGated: false,
  });

  function slugify(str: string) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts/admin"],
  });

  const { data: versions = [], isLoading: versionsLoading } = useQuery<PostVersion[]>({
    queryKey: ["/api/posts", showVersionsFor, "versions"],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${showVersionsFor}/versions`, { credentials: "include" });
      return res.json();
    },
    enabled: !!showVersionsFor,
  });

  const createPost = useMutation({
    mutationFn: async (data: typeof postForm) => {
      const res = await apiRequest("POST", "/api/posts", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/posts/admin"] });
      closeEditor();
      toast({ title: "Post saved as draft" });
    },
    onError: () => toast({ title: "Failed to create post", variant: "destructive" }),
  });

  const updatePost = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof postForm }) => {
      const res = await apiRequest("PUT", `/api/posts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/posts/admin"] });
      closeEditor();
      toast({ title: "Post saved" });
    },
    onError: () => toast({ title: "Failed to save post", variant: "destructive" }),
  });

  const saveAndPublish = useMutation({
    mutationFn: async () => {
      let postId = editingPost?.id;
      if (!postId) {
        const res = await apiRequest("POST", "/api/posts", postForm);
        const created: Post = await res.json();
        postId = created.id;
      } else {
        await apiRequest("PUT", `/api/posts/${postId}`, postForm);
      }
      await apiRequest("PATCH", `/api/posts/${postId}/publish`);
      return postId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/posts/admin"] });
      closeEditor();
      toast({ title: "Post published!" });
    },
    onError: () => toast({ title: "Failed to publish", variant: "destructive" }),
  });

  const togglePublish = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/posts/${id}/publish`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/posts/admin"] });
    },
    onError: () => toast({ title: "Failed to toggle publish", variant: "destructive" }),
  });

  const toggleGate = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/posts/${id}/gate`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/posts/admin"] });
    },
    onError: () => toast({ title: "Failed to toggle gate", variant: "destructive" }),
  });

  const deletePost = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/posts/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/posts/admin"] });
      toast({ title: "Post deleted" });
    },
    onError: () => toast({ title: "Failed to delete post", variant: "destructive" }),
  });

  const restoreVersion = useMutation({
    mutationFn: async ({ postId, versionId }: { postId: number; versionId: number }) => {
      const res = await apiRequest("POST", `/api/posts/${postId}/restore/${versionId}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/posts/admin"] });
      setShowVersionsFor(null);
      toast({ title: "Version restored" });
    },
    onError: () => toast({ title: "Failed to restore version", variant: "destructive" }),
  });

  function openNewPost() {
    setEditingPost(null);
    setPostForm({ title: "", slug: "", excerpt: "", content: "", coverImageUrl: "", isGated: false });
    setShowEditor(true);
  }

  function openEditPost(post: Post) {
    setEditingPost(post);
    setPostForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt ?? "",
      content: post.content ?? "",
      coverImageUrl: post.coverImageUrl ?? "",
      isGated: post.isGated,
    });
    setShowEditor(true);
  }

  function closeEditor() {
    setShowEditor(false);
    setEditingPost(null);
  }

  function handleSaveDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!postForm.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (editingPost) {
      updatePost.mutate({ id: editingPost.id, data: postForm });
    } else {
      createPost.mutate(postForm);
    }
  }

  const isSaving = createPost.isPending || updatePost.isPending;

  if (showEditor) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {editingPost ? `Editing: ${editingPost.title}` : "New Post"}
          </h2>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPreviewContent(postForm.content)}
              className="border-white/20 text-white/70 h-8 text-xs"
              data-testid="button-preview-post"
            >
              <Eye className="w-3 h-3 mr-1" /> Preview
            </Button>
            <Button variant="outline" size="sm" onClick={closeEditor} className="border-white/20 text-white/70 h-8 text-xs">
              <X className="w-3 h-3 mr-1" /> Discard
            </Button>
          </div>
        </div>

        <form onSubmit={handleSaveDraft} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-white/80">Title *</Label>
              <Input
                value={postForm.title}
                onChange={(e) => {
                  const title = e.target.value;
                  const autoSlug = slugify(title);
                  setPostForm({ ...postForm, title, slug: postForm.slug && postForm.slug !== slugify(postForm.title) ? postForm.slug : autoSlug });
                }}
                placeholder="Post title"
                className="bg-black/40 border-white/10 h-11"
                data-testid="input-post-title"
              />
              {postForm.title && (
                <p className="text-xs text-muted-foreground mt-1">
                  Slug preview: <span className="text-primary font-mono">/blog/{postForm.slug || slugify(postForm.title)}</span>
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-white/80">Slug (auto-filled from title)</Label>
              <Input
                value={postForm.slug}
                onChange={(e) => setPostForm({ ...postForm, slug: e.target.value })}
                placeholder="my-post-slug"
                className="bg-black/40 border-white/10 h-11 font-mono text-sm"
                data-testid="input-post-slug"
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-white/80">Cover Image</Label>
              <ImageUpload
                value={postForm.coverImageUrl}
                onChange={(url) => setPostForm({ ...postForm, coverImageUrl: url })}
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-white/80">Excerpt</Label>
              <Textarea
                value={postForm.excerpt}
                onChange={(e) => setPostForm({ ...postForm, excerpt: e.target.value })}
                placeholder="Short description shown in blog listing…"
                className="bg-black/40 border-white/10 min-h-[80px] resize-none"
                data-testid="textarea-post-excerpt"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-white/80">Content</Label>
            <RichTextEditor
              content={postForm.content}
              onChange={(html) => setPostForm({ ...postForm, content: html })}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="is-gated"
              checked={postForm.isGated}
              onCheckedChange={(v) => setPostForm({ ...postForm, isGated: v })}
              data-testid="switch-post-gated"
            />
            <Label htmlFor="is-gated" className="text-white/80 cursor-pointer">
              Subscribers only (gated)
            </Label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={isSaving}
              variant="outline"
              className="border-white/20 hover:bg-white/10 text-white/80 font-semibold px-6"
              data-testid="button-save-draft"
            >
              {isSaving ? "Saving…" : "Save Draft"}
            </Button>
            <Button
              type="button"
              disabled={saveAndPublish.isPending}
              onClick={() => {
                if (!postForm.title.trim()) {
                  toast({ title: "Title is required", variant: "destructive" });
                  return;
                }
                saveAndPublish.mutate();
              }}
              className="bg-primary hover:bg-primary/90 font-semibold px-8"
              data-testid="button-publish-post"
            >
              {saveAndPublish.isPending ? "Publishing…" : "Publish"}
            </Button>
            <Button type="button" variant="outline" onClick={closeEditor} className="border-white/20 hover:bg-white/10 text-white/70">
              Cancel
            </Button>
          </div>
        </form>

        {/* Preview Modal */}
        <Dialog open={previewContent !== null} onOpenChange={() => setPreviewContent(null)}>
          <DialogContent className="bg-secondary border-white/10 text-white max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Preview — {postForm.title || "Untitled"}</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {postForm.coverImageUrl && (
                <img
                  src={postForm.coverImageUrl}
                  alt={postForm.title || "Cover"}
                  className="w-full rounded-lg border border-white/10 max-h-80 object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <RichTextViewer content={previewContent ?? ""} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">All Posts</h2>
        <Button onClick={openNewPost} className="bg-primary hover:bg-primary/90 font-semibold" data-testid="button-new-post">
          <Plus className="w-4 h-4 mr-1" /> New Post
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No posts yet. Create your first one.</p>
        </div>
      ) : (
        <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-muted-foreground text-left">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Gated</th>
                  <th className="px-4 py-3 font-medium">Published Date</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post, i) => (
                  <>
                    <tr
                      key={post.id}
                      data-testid={`row-admin-post-${post.id}`}
                      className={`border-b border-white/5 hover:bg-white/5 ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`}
                    >
                      <td className="px-4 py-4">
                        <div className="font-medium text-white max-w-xs">
                          <div className="truncate">{post.title}</div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">/blog/{post.slug}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {post.isPublished ? (
                          <Badge variant="outline" className="border-green-500/40 text-green-400 text-xs">
                            <Globe className="w-2.5 h-2.5 mr-1" /> Published
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-white/20 text-white/40 text-xs">
                            Draft
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {post.isGated ? (
                          <Badge variant="outline" className="border-yellow-500/40 text-yellow-400 text-xs">
                            <Lock className="w-2.5 h-2.5 mr-1" /> Yes
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-white/20 text-white/40 text-xs">No</Badge>
                        )}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground whitespace-nowrap text-xs">
                        {formatDate(post.publishedAt)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 justify-end flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => togglePublish.mutate(post.id)}
                            disabled={togglePublish.isPending}
                            className={
                              post.isPublished
                                ? "border-white/20 text-white/60 text-xs h-7"
                                : "border-green-500/30 text-green-400 text-xs h-7 hover:bg-green-500/10"
                            }
                            data-testid={`button-toggle-publish-${post.id}`}
                          >
                            <Globe className="w-3 h-3 mr-1" />
                            {post.isPublished ? "Unpublish" : "Publish"}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleGate.mutate(post.id)}
                            disabled={toggleGate.isPending}
                            className={
                              post.isGated
                                ? "border-yellow-500/30 text-yellow-400 text-xs h-7 hover:bg-yellow-500/10"
                                : "border-white/20 text-white/60 text-xs h-7"
                            }
                            data-testid={`button-toggle-gate-${post.id}`}
                          >
                            <Lock className="w-3 h-3 mr-1" />
                            {post.isGated ? "Ungate" : "Gate"}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowVersionsFor(showVersionsFor === post.id ? null : post.id)}
                            className="border-white/20 text-white/60 text-xs h-7"
                            data-testid={`button-versions-${post.id}`}
                          >
                            <History className="w-3 h-3 mr-1" /> Versions
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditPost(post)}
                            className="border-white/20 text-white/60 text-xs h-7"
                            data-testid={`button-edit-post-${post.id}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (window.confirm(`Delete "${post.title}"?`)) deletePost.mutate(post.id);
                            }}
                            disabled={deletePost.isPending}
                            className="border-red-500/30 text-red-400 text-xs h-7 hover:bg-red-500/10"
                            data-testid={`button-delete-post-${post.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {/* Versions panel inline row */}
                    {showVersionsFor === post.id && (
                      <tr key={`versions-${post.id}`} className="border-b border-white/5 bg-black/20">
                        <td colSpan={5} className="px-6 py-4">
                          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Saved Versions</p>
                          {versionsLoading ? (
                            <Skeleton className="h-10 w-full" />
                          ) : versions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No versions saved yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {versions.map((v) => (
                                <div key={v.id} className="flex items-center justify-between gap-3">
                                  <span className="text-sm text-white/70">"{v.title}" — {formatDate(v.savedAt)}</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => restoreVersion.mutate({ postId: post.id, versionId: v.id })}
                                    disabled={restoreVersion.isPending}
                                    className="border-white/20 text-white/60 text-xs h-7"
                                  >
                                    <RotateCcw className="w-3 h-3 mr-1" /> Restore
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  ANALYTICS TAB                                             */
/* ─────────────────────────────────────────────────────────── */
function AnalyticsTab() {
  const [rangeDays, setRangeDays] = useState<number | null>(30);
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics", rangeDays],
    queryFn: async () => {
      const url = rangeDays ? `/api/analytics?days=${rangeDays}` : "/api/analytics";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const { data: eventData } = useQuery<EventAnalyticsData>({
    queryKey: ["/api/analytics/events", rangeDays],
    queryFn: async () => {
      const url = rangeDays ? `/api/analytics/events?days=${rangeDays}` : "/api/analytics/events";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const isAll = rangeDays === null;
  const rangeLabel = isAll ? "All time" : `Last ${rangeDays}d`;
  const sparkSpan = rangeDays ?? 30;

  // Stat values: window-scoped for a finite range; lifetime when "All".
  const subsValue = isAll ? (data?.totalSubscribers ?? 0) : (data?.window?.subscribers ?? 0);
  const viewsLifetime = data?.postViews?.reduce((s, p) => s + p.views, 0) ?? 0;
  const viewsValue = isAll ? viewsLifetime : (data?.window?.postViews ?? 0);
  const clicksLifetime = data?.linkClicks?.reduce((s, c) => s + c.count, 0) ?? 0;
  const clicksValue = isAll ? clicksLifetime : (data?.window?.linkClicks ?? 0);

  const subsChange = isAll ? null : percentChange(data?.window?.subscribers ?? 0, data?.window?.prior?.subscribers ?? 0);
  const viewsChange = isAll ? null : percentChange(data?.window?.postViews ?? 0, data?.window?.prior?.postViews ?? 0);
  const clicksChange = isAll ? null : percentChange(data?.window?.linkClicks ?? 0, data?.window?.prior?.linkClicks ?? 0);

  const subsSpark = fillDailySeries(data?.daily?.subscribers ?? [], sparkSpan);
  const viewsSpark = fillDailySeries(data?.daily?.postViews ?? [], sparkSpan);
  const clicksSpark = fillDailySeries(data?.daily?.linkClicks ?? [], sparkSpan);

  function renderChange(change: ReturnType<typeof percentChange>) {
    if (change === null) {
      return <span className="text-[11px] text-muted-foreground">no prior data</span>;
    }
    const sign = change.direction === "up" ? "+" : change.direction === "down" ? "" : "";
    const color = change.direction === "up" ? "text-green-400" : change.direction === "down" ? "text-red-400" : "text-muted-foreground";
    return (
      <span className={`text-[11px] font-medium ${color}`}>
        {sign}{change.pct.toFixed(change.direction === "flat" ? 0 : 1)}% vs prior {rangeDays}d
      </span>
    );
  }

  return (
    <div className="space-y-8">
      {/* Range tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
          {ANALYTICS_RANGES.map((r) => {
            const active = rangeDays === r.days;
            return (
              <button
                key={r.label}
                onClick={() => setRangeDays(r.days)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${active ? "bg-primary text-white" : "text-white/60 hover:text-white"}`}
                data-testid={`analytics-range-${r.label}`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{rangeLabel}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-secondary/30 border border-white/10 rounded-xl p-5 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Subscribers</p>
          {isLoading ? <Skeleton className="h-9 w-20 mt-1" /> : (
            <>
              <p className="text-3xl font-black text-white" data-testid="stat-subscribers">{subsValue.toLocaleString()}</p>
              {renderChange(subsChange)}
            </>
          )}
          <Sparkline data={subsSpark} />
        </div>
        <div className="bg-secondary/30 border border-white/10 rounded-xl p-5 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Post Views</p>
          {isLoading ? <Skeleton className="h-9 w-20 mt-1" /> : (
            <>
              <p className="text-3xl font-black text-white" data-testid="stat-post-views">{viewsValue.toLocaleString()}</p>
              {renderChange(viewsChange)}
            </>
          )}
          <Sparkline data={viewsSpark} />
        </div>
        <div className="bg-secondary/30 border border-white/10 rounded-xl p-5 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Outbound Clicks</p>
          {isLoading ? <Skeleton className="h-9 w-20 mt-1" /> : (
            <>
              <p className="text-3xl font-black text-white" data-testid="stat-outbound-clicks">{clicksValue.toLocaleString()}</p>
              {renderChange(clicksChange)}
            </>
          )}
          <Sparkline data={clicksSpark} />
        </div>
      </div>

      {/* Post Views table */}
      <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-white">Post Views</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Lifetime totals per post</p>
          </div>
          {!!data?.postViews?.length && (
            <Button
              size="sm"
              variant="outline"
              className="border-white/20 text-white/70 h-8"
              onClick={() => downloadCsv("post-views.csv", ["Post", "Views"], data.postViews.map((p) => [p.title, p.views]))}
              data-testid="button-export-post-views"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
            </Button>
          )}
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !data?.postViews?.length ? (
          <div className="py-10 px-6 text-center text-muted-foreground text-sm">
            No post views yet. Views are tracked when readers open published blog posts.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-muted-foreground text-left">
                  <th className="px-6 py-3 font-medium">Post</th>
                  <th className="px-4 py-3 font-medium text-right">Views</th>
                </tr>
              </thead>
              <tbody>
                {data.postViews.map((p, i) => (
                  <tr key={p.postId} className={`border-b border-white/5 ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`}>
                    <td className="px-6 py-4 font-medium text-white">{p.title}</td>
                    <td className="px-4 py-4 text-right text-white/80">{p.views.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Outbound Links table */}
      <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-white">Top Outbound Links</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Lifetime clicks per destination URL</p>
          </div>
          {!!data?.linkClicks?.length && (
            <Button
              size="sm"
              variant="outline"
              className="border-white/20 text-white/70 h-8"
              onClick={() => downloadCsv(
                "outbound-links.csv",
                ["URL", "Source Page", "Clicks"],
                data.linkClicks.map((c) => [decodeURIComponent(c.url), c.sourcePage ?? "", c.count]),
              )}
              data-testid="button-export-outbound-links"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
            </Button>
          )}
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !data?.linkClicks?.length ? (
          <div className="py-10 px-6 text-center text-muted-foreground text-sm">
            No outbound clicks yet. Clicks are tracked when readers click links inside published posts.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-muted-foreground text-left">
                  <th className="px-6 py-3 font-medium">URL</th>
                  <th className="px-4 py-3 font-medium">Source Page</th>
                  <th className="px-4 py-3 font-medium text-right">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {data.linkClicks.map((c, i) => (
                  <tr key={i} className={`border-b border-white/5 ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`}>
                    <td className="px-6 py-4 text-primary truncate max-w-xs">{decodeURIComponent(c.url)}</td>
                    <td className="px-4 py-4 text-muted-foreground text-xs truncate max-w-[200px]">
                      {c.sourcePage ? (
                        <span title={c.sourcePage}>{c.sourcePage.replace(/^https?:\/\/[^/]+/, "")}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-4 text-right text-white/80">{c.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Member Sources table */}
      <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="font-bold text-white">Member Sources</h3>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !data?.memberSources?.length ? (
          <div className="py-10 text-center text-muted-foreground text-sm">No source data yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-muted-foreground text-left">
                  <th className="px-6 py-3 font-medium">Referrer</th>
                  <th className="px-4 py-3 font-medium text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.memberSources.map((s, i) => (
                  <tr key={i} className={`border-b border-white/5 ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`}>
                    <td className="px-6 py-4 text-white/80">{s.referrer}</td>
                    <td className="px-4 py-4 text-right text-white/80">{s.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Event Performance ─── */}
      <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-white">Top Events by Ticket Clicks</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Events ranked by clicks on their "Learn more" link {rangeLabel.toLowerCase()}</p>
          </div>
          {!!eventData?.events?.length && (
            <Button
              size="sm"
              variant="outline"
              className="border-white/20 text-white/70 h-8"
              onClick={() => downloadCsv(
                "event-performance.csv",
                ["Event", "Date", "Region", "City", "Clicks"],
                eventData.events.map((e) => [e.title, e.date, e.region, e.city ?? "", e.clicks]),
              )}
              data-testid="button-export-event-performance"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
            </Button>
          )}
        </div>
        {!eventData?.events?.length ? (
          <div className="py-10 px-6 text-center text-muted-foreground text-sm">
            No event ticket clicks yet. Clicks are tracked when visitors click the "Learn more" button on an event card.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-muted-foreground text-left">
                  <th className="px-6 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium text-right">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {eventData.events.map((e, i) => (
                  <tr key={e.eventId} className={`border-b border-white/5 ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`}>
                    <td className="px-6 py-3 font-medium text-white max-w-xs truncate">{e.title}</td>
                    <td className="px-4 py-3 text-white/70 whitespace-nowrap">
                      {new Date(e.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-white/70">{[e.city, e.region].filter(Boolean).join(", ")}</td>
                    <td className="px-4 py-3 text-right text-white font-semibold">{e.clicks.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Top Regions + Top Cities side-by-side ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h3 className="font-bold text-white">Top Regions</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Where the clicks are happening</p>
          </div>
          {!eventData?.regions?.length ? (
            <div className="py-8 px-6 text-center text-muted-foreground text-sm">
              No regional data yet. Populates as visitors click "Learn more" on events.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {(() => {
                const maxClicks = Math.max(...eventData.regions.map((r) => r.clicks), 1);
                return eventData.regions.map((r) => (
                  <div key={r.region} className="px-6 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white font-medium">{r.region}</span>
                      <span className="text-white/60 text-xs">
                        <span className="text-white font-semibold">{r.clicks.toLocaleString()}</span> click{r.clicks !== 1 ? "s" : ""} · {r.events} event{r.events !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(r.clicks / maxClicks) * 100}%` }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
        <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h3 className="font-bold text-white">Top Cities</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Top 10 by event ticket clicks</p>
          </div>
          {!eventData?.cities?.length ? (
            <div className="py-8 px-6 text-center text-muted-foreground text-sm">
              No city data yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {eventData.cities.map((c, i) => (
                  <tr key={`${c.city}-${i}`} className={`border-b border-white/5 ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`}>
                    <td className="px-6 py-3 text-white">{c.city}<span className="text-white/40 text-xs ml-1.5">{c.region}</span></td>
                    <td className="px-4 py-3 text-right text-white/80 font-semibold">{c.clicks.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ─── Traffic Sources ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h3 className="font-bold text-white">Subscriber Sources</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Where new subscribers came from</p>
          </div>
          {!eventData?.sources?.subscriberSources?.length ? (
            <div className="py-8 px-6 text-center text-muted-foreground text-sm">No subscriber sources yet.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {eventData.sources.subscriberSources.map((s, i) => (
                  <tr key={i} className={`border-b border-white/5 ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`}>
                    <td className="px-6 py-3 text-white">{s.referrer || "direct"}</td>
                    <td className="px-4 py-3 text-right text-white/80 font-semibold">{s.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h3 className="font-bold text-white">Click Source Pages</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Pages that drove the most outbound clicks</p>
          </div>
          {!eventData?.sources?.clickSourcePages?.length ? (
            <div className="py-8 px-6 text-center text-muted-foreground text-sm">No source page data yet.</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {eventData.sources.clickSourcePages.map((s, i) => (
                  <tr key={i} className={`border-b border-white/5 ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`}>
                    <td className="px-6 py-3 text-white/80 text-xs truncate max-w-xs" title={s.sourcePage}>
                      {s.sourcePage.replace(/^https?:\/\/[^/]+/, "") || "/"}
                    </td>
                    <td className="px-4 py-3 text-right text-white/80 font-semibold">{s.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ─── Booking Funnel ─── */}
      <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="font-bold text-white">Booking Wizard Funnel</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Unique sessions that reached each step of /book {rangeLabel.toLowerCase()}</p>
        </div>
        {!eventData?.funnel?.length ? (
          <div className="py-10 px-6 text-center text-muted-foreground text-sm">
            No funnel data yet. Sessions are tracked as visitors progress through the booking wizard at /book.
          </div>
        ) : (
          <div className="px-6 py-4 space-y-2">
            {(() => {
              const byStep = new Map(eventData.funnel.map((f) => [f.step, f.sessions]));
              const ordered = FUNNEL_STEPS_ORDER.map((step) => ({ step, sessions: byStep.get(step) ?? 0 }));
              const top = ordered[0]?.sessions ?? 1;
              return ordered.map((row, i) => {
                const prev = i > 0 ? ordered[i - 1].sessions : null;
                const dropoff = prev && prev > 0 ? Math.round(((prev - row.sessions) / prev) * 100) : null;
                const widthPct = top > 0 ? (row.sessions / top) * 100 : 0;
                return (
                  <div key={row.step}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white font-medium w-32 shrink-0">{row.step}</span>
                      <span className="text-white/60 text-xs flex items-center gap-2">
                        <span className="text-white font-semibold">{row.sessions.toLocaleString()}</span>
                        {dropoff !== null && dropoff > 0 && (
                          <span className="text-red-400 text-[11px]">−{dropoff}%</span>
                        )}
                      </span>
                    </div>
                    <div className="mt-1 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.step === "Submitted" ? "bg-green-500" : "bg-primary"}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  TEAM MEMBERS TAB                                          */
/* ─────────────────────────────────────────────────────────── */
function TeamTab({ currentRole }: { currentRole: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendOpen, setSendOpen] = useState(false);
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");

  const { data: team = [], isLoading: teamLoading } = useQuery<AdminMember[]>({
    queryKey: ["/api/admin/users"],
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/invite", { email: inviteEmail, role: "editor" });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setInviteOpen(false);
      setInviteEmail("");
      toast({ title: "Invite sent!" });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to send invite";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/deactivate`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Account deactivated" });
    },
    onError: () => toast({ title: "Failed to deactivate", variant: "destructive" }),
  });

  const sendNewsletterMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/newsletter/send", {
        subject: sendSubject,
        body: sendBody,
      });
      return res.json();
    },
    onSuccess: (data: { sent?: number }) => {
      toast({ title: `Newsletter sent to ${data.sent ?? "all"} subscribers!` });
      setSendOpen(false);
      setSendSubject("");
      setSendBody("");
    },
    onError: () => toast({ title: "Failed to send newsletter", variant: "destructive" }),
  });

  return (
    <div className="space-y-10">
      {/* Team */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Admin Team</h3>
          {currentRole === "superadmin" && (
            <Button
              size="sm"
              onClick={() => setInviteOpen(true)}
              className="bg-primary hover:bg-primary/90 font-semibold"
              data-testid="button-invite-admin"
            >
              <Plus className="w-4 h-4 mr-1" /> Invite Editor
            </Button>
          )}
        </div>

        {teamLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : (
          <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-muted-foreground text-left">
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  {currentRole === "superadmin" && <th className="px-4 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {team.map((member, i) => (
                  <tr key={member.id} className={`border-b border-white/5 hover:bg-white/5 ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`} data-testid={`row-team-${member.id}`}>
                    <td className="px-4 py-4 font-medium text-white">{member.email}</td>
                    <td className="px-4 py-4">
                      <Badge variant="outline" className="border-primary/30 text-primary text-xs capitalize">
                        {member.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      {member.isActive ? (
                        <Badge variant="outline" className="border-green-500/30 text-green-400 text-xs">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="border-red-500/30 text-red-400 text-xs">Inactive</Badge>
                      )}
                    </td>
                    {currentRole === "superadmin" && (
                      <td className="px-4 py-4 text-right">
                        {member.isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deactivateMutation.mutate(member.id)}
                            disabled={deactivateMutation.isPending}
                            className="border-red-500/30 text-red-400 text-xs h-8 hover:bg-red-500/10"
                          >
                            Deactivate
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Newsletter Blast */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Newsletter Blast</h3>
            <p className="text-sm text-muted-foreground">Send an email to all subscribers</p>
          </div>
          <Button
            size="sm"
            onClick={() => setSendOpen(true)}
            className="bg-primary hover:bg-primary/90 font-semibold"
            data-testid="button-send-newsletter"
          >
            <Send className="w-4 h-4 mr-1" /> Send Newsletter
          </Button>
        </div>
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="bg-secondary border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite Editor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-white/80">Email</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="team@example.com"
                className="bg-black/40 border-white/10 h-11"
                data-testid="input-invite-email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} className="border-white/20 text-white/70">
              Cancel
            </Button>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={inviteMutation.isPending || !inviteEmail.trim()}
              className="bg-primary hover:bg-primary/90 font-semibold"
              data-testid="button-confirm-invite"
            >
              {inviteMutation.isPending ? "Sending…" : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Newsletter Blast Dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="bg-secondary border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Newsletter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-white/80">Subject</Label>
              <Input
                value={sendSubject}
                onChange={(e) => setSendSubject(e.target.value)}
                placeholder="This week in NJ nightlife…"
                className="bg-black/40 border-white/10 h-11"
                data-testid="input-newsletter-subject"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Body</Label>
              <Textarea
                value={sendBody}
                onChange={(e) => setSendBody(e.target.value)}
                placeholder="Write your newsletter…"
                className="bg-black/40 border-white/10 min-h-[160px] resize-none"
                data-testid="textarea-newsletter-body"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)} className="border-white/20 text-white/70">
              Cancel
            </Button>
            <Button
              onClick={() => sendNewsletterMutation.mutate()}
              disabled={sendNewsletterMutation.isPending || !sendSubject.trim() || !sendBody.trim()}
              className="bg-primary hover:bg-primary/90 font-semibold"
              data-testid="button-confirm-send-newsletter"
            >
              {sendNewsletterMutation.isPending ? "Sending…" : "Send to All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  MAIN ADMIN COMPONENT                                      */
const GENRE_OPTIONS = [
  "Brunch", "Concert", "DJ Set", "Happy Hour", "Live Music",
  "Party", "Festival", "Dance Class", "Special Event", "Other",
];

function formatEventDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  // en-US locale produces "Fri, Apr 4, 2026" — strip the comma before the 4-digit year
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    .replace(/,(\s+\d{4})$/, "$1");
}

function formatEventTime(timeStr: string | null): string {
  if (!timeStr) return "—";
  if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

const EMAIL_HEADER_ALIASES = [
  "email",
  "e-mail",
  "email address",
  "email_address",
  "emailaddress",
  "subscriber email",
  "contact email",
  "email addr",
  "emailaddr",
];

function normalizeHeaderValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");
}

function findEmailHeader(headers: string[]) {
  return headers.find((header) => EMAIL_HEADER_ALIASES.includes(normalizeHeaderValue(header)));
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Accepts common date formats from CSV / Excel and returns YYYY-MM-DD,
// the format the server stores and the formatter on the page expects.
// Returns "" for unrecognized input so the server can reject the row.
const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

// When the input has no year, pick the year that puts the date closest to today.
// If the candidate this-year date is more than 180 days in the past, assume the
// user meant next year (e.g. uploading "15-Jan" in December → next January).
function inferYearForMonthDay(month: number, day: number): number {
  const now = new Date();
  const year = now.getFullYear();
  const candidate = new Date(year, month - 1, day);
  const daysInPast = (now.getTime() - candidate.getTime()) / (1000 * 60 * 60 * 24);
  return daysInPast > 180 ? year + 1 : year;
}

function buildIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function packageDealValue(mode: string | null | undefined): { label: string; numeric: number } {
  switch ((mode || "").toLowerCase()) {
    case "basic":   return { label: "FREE",   numeric: 0 };
    case "starter": return { label: "$70",    numeric: 70 };
    case "growth":  return { label: "$150",   numeric: 150 };
    case "custom":  return { label: "$300+",  numeric: 300 };
    default:        return { label: "—",      numeric: 0 };
  }
}

function phoneDigits(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

const DAY_OF_WEEK_OFFSET: Record<string, number> = {
  mon: 0, monday: 0,
  tue: 1, tues: 1, tuesday: 1,
  wed: 2, weds: 2, wednesday: 2,
  thu: 3, thur: 3, thurs: 3, thursday: 3,
  fri: 4, friday: 4,
  sat: 5, saturday: 5,
  sun: 6, sunday: 6,
};

function resolveDayToIsoDate(day: string, weekStartIso: string): string {
  const key = day.trim().toLowerCase().replace(/[.,]/g, "");
  const offset = DAY_OF_WEEK_OFFSET[key];
  if (offset === undefined) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartIso)) return "";
  const [y, m, d] = weekStartIso.split("-").map(Number);
  const anchor = new Date(y, m - 1, d);
  if (isNaN(anchor.getTime())) return "";
  anchor.setDate(anchor.getDate() + offset);
  return buildIsoDate(anchor.getFullYear(), anchor.getMonth() + 1, anchor.getDate());
}

function getUpcomingMondayIso(): string {
  const today = new Date();
  const dow = today.getDay();
  const daysUntilMon = dow === 1 ? 0 : (8 - dow) % 7;
  today.setDate(today.getDate() + daysUntilMon);
  return buildIsoDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
}

function normalizeEventDate(input: string): string {
  if (!input) return "";
  const s = String(input).trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // YYYY/MM/DD or YYYY-MM-DD with single-digit month/day
  let m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return buildIsoDate(parseInt(y, 10), parseInt(mo, 10), parseInt(d, 10));
  }

  // M/D/YYYY, M-D-YYYY, M.D.YY, etc. (US-style; default for this site)
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (m) {
    let [, mo, d, y] = m;
    if (y.length === 2) y = (parseInt(y, 10) >= 70 ? "19" : "20") + y;
    return buildIsoDate(parseInt(y, 10), parseInt(mo, 10), parseInt(d, 10));
  }

  // Numeric day + month name: "15-May", "15 May", "15/May"
  m = s.match(/^(\d{1,2})[-/\s]+([A-Za-z]+)(?:[-/\s]+(\d{2,4}))?$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = MONTH_NAME_MAP[m[2].toLowerCase()];
    if (month && day >= 1 && day <= 31) {
      let year: number;
      if (m[3]) {
        year = parseInt(m[3], 10);
        if (m[3].length === 2) year = (year >= 70 ? 1900 : 2000) + year;
      } else {
        year = inferYearForMonthDay(month, day);
      }
      return buildIsoDate(year, month, day);
    }
  }

  // Month name + day: "May 15", "May-15", "May 15, 2026"
  m = s.match(/^([A-Za-z]+)[-/\s,]+(\d{1,2})(?:[-/\s,]+(\d{2,4}))?$/);
  if (m) {
    const month = MONTH_NAME_MAP[m[1].toLowerCase()];
    const day = parseInt(m[2], 10);
    if (month && day >= 1 && day <= 31) {
      let year: number;
      if (m[3]) {
        year = parseInt(m[3], 10);
        if (m[3].length === 2) year = (year >= 70 ? 1900 : 2000) + year;
      } else {
        year = inferYearForMonthDay(month, day);
      }
      return buildIsoDate(year, month, day);
    }
  }

  // Excel serial number (days since 1899-12-30, with Excel's 1900 leap-year quirk)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = parseFloat(s);
    if (serial > 20000 && serial < 80000) {
      const ms = Math.round((serial - 25569) * 86400 * 1000);
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        return buildIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      }
    }
  }

  // Final fallback: JS Date parser. Reject results that look like the V8 "year 2001"
  // default that fires when an input has no year — we'd rather mark the row invalid
  // than silently mangle the date.
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    if (year === 2001 && !/2001/.test(s)) return "";
    if (year < 1970 || year > 2100) return "";
    return buildIsoDate(year, parsed.getMonth() + 1, parsed.getDate());
  }

  return "";
}

/* ─────────────────────────────────────────────────────────── */
/*  Shared sort helper for admin list tabs                     */
/* ─────────────────────────────────────────────────────────── */
type SortDirection = "asc" | "desc";
interface SortState { field: string; direction: SortDirection }

function sortRows<T extends Record<string, any>>(rows: T[], field: string, dir: SortDirection): T[] {
  const arr = [...rows];
  arr.sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    // Nulls/undefined sort last regardless of direction
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return 0;
  });
  return arr;
}

function SortHeader({ columns, sort, onChange }: {
  columns: { field: string; label: string }[];
  sort: SortState;
  onChange: (next: SortState) => void;
}) {
  return (
    <div className="px-6 py-2 border-b border-white/10 bg-white/[0.02] flex gap-4 flex-wrap text-[11px]" data-testid="sort-header">
      <span className="text-white/30 font-bold uppercase tracking-wider">Sort by:</span>
      {columns.map((col) => {
        const isActive = sort.field === col.field;
        return (
          <button
            key={col.field}
            onClick={() => onChange({ field: col.field, direction: isActive && sort.direction === "asc" ? "desc" : "asc" })}
            className={`flex items-center gap-1 font-bold uppercase tracking-wider ${isActive ? "text-primary" : "text-white/40 hover:text-white/70"}`}
            data-testid={`sort-${col.field}`}
          >
            {col.label}
            {isActive && <span className="text-xs">{sort.direction === "asc" ? "↑" : "↓"}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  WORLD CUP WATCH PARTIES TAB                               */
/* ─────────────────────────────────────────────────────────── */
interface WorldCupSubmissionRow {
  id: number;
  weekIndex: number;
  matchDate: string;
  matchSlot: string | null;
  matchLabel: string | null;
  venueName: string;
  town: string;
  region: string | null;
  eventName: string | null;
  instagramHandle: string | null;
  learnMoreUrl: string | null;
  submitterEmail: string;
  status: string;
  adminNotes: string | null;
  createdAt: string | null;
}

const WC_IMPORT_FIELDS: { key: string; label: string; required: boolean }[] = [
  { key: "matchDate",       label: "Match Date (YYYY-MM-DD)", required: true },
  { key: "matchLabel",      label: "Match (e.g. USA vs Wales)", required: true },
  { key: "venueName",       label: "Venue Name",   required: true },
  { key: "town",            label: "Town / City",  required: true },
  { key: "eventName",       label: "Event Name",   required: false },
  { key: "instagramHandle", label: "Instagram Handle", required: false },
  { key: "learnMoreUrl",    label: "Learn-more URL", required: false },
];

const WC_IMPORT_ALIASES: Record<string, string[]> = {
  matchDate:       ["date", "matchdate", "match date", "event date", "day"],
  matchLabel:      ["match", "matchlabel", "match label", "fixture", "game", "teams", "matchup"],
  venueName:       ["venue", "venuename", "venue name", "location", "place"],
  town:            ["town", "city", "area"],
  eventName:       ["event", "eventname", "event name", "name", "title"],
  instagramHandle: ["instagram", "ig", "handle", "insta", "instagramhandle"],
  learnMoreUrl:    ["url", "link", "learnmoreurl", "learn more url", "learn more", "learnmore", "ticket", "tickets", "ticketlink"],
};

function wcAutoMatch(headers: string[], key: string): string {
  const aliases = WC_IMPORT_ALIASES[key] || [key];
  return headers.find((h) => aliases.some((a) => h.toLowerCase().trim() === a.toLowerCase())) ||
         headers.find((h) => aliases.some((a) => h.toLowerCase().trim().includes(a.toLowerCase()))) || "";
}

function WorldCupTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  // Import wizard state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<"input" | "mapping">("input");
  const [importRawHeaders, setImportRawHeaders] = useState<string[]>([]);
  const [importRawRows, setImportRawRows] = useState<string[][]>([]);
  const [importMapping, setImportMapping] = useState<Record<string, string>>({});
  const [importError, setImportError] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; invalid: { rowIndex: number; reason: string }[] } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  function downloadCsvTemplate() {
    const headers = "matchDate,matchLabel,venueName,town,eventName,instagramHandle,learnMoreUrl";
    const sample = "2026-06-15,USA vs Wales,Little Tijuana,Newark,The Big USA Watch Party,@littletijuanaNJ,https://posh.vip/e/example";
    const blob = new Blob([headers + "\n" + sample + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "world-cup-watch-parties-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetImportWizard() {
    setImportStep("input");
    setImportRawHeaders([]);
    setImportRawRows([]);
    setImportMapping({});
    setImportError("");
    setImportResult(null);
    setImportBusy(false);
  }

  function buildInitialWcMapping(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    for (const { key } of WC_IMPORT_FIELDS) {
      mapping[key] = wcAutoMatch(headers, key);
    }
    return mapping;
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");
    setImportResult(null);

    const isExcel = /\.(xlsx|xls)$/i.test(file.name) ||
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.type === "application/vnd.ms-excel";

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
          // cellDates+raw:false ensures Excel date cells come through as
          // YYYY-MM-DD strings instead of serial numbers like 46184.
          const workbook = XLSX.read(data, { type: "array", cellDates: true });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false, dateNF: "yyyy-mm-dd" }) as any[][];
          const nonEmpty = allRows.filter((r) => r.some((c) => String(c).trim() !== ""));
          if (nonEmpty.length < 2) { setImportError("Spreadsheet appears to be empty or has only headers."); return; }
          const headers = nonEmpty[0].map((h) => String(h).trim());
          const dataRows = nonEmpty.slice(1).map((row) => row.map((c) => String(c).trim()));
          setImportRawHeaders(headers);
          setImportRawRows(dataRows);
          setImportMapping(buildInitialWcMapping(headers));
          setImportStep("mapping");
        } catch {
          setImportError("Could not read the spreadsheet file. Make sure it's a valid .xlsx or .xls file.");
        }
      };
      reader.onerror = () => setImportError("Failed to read the file.");
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse<string[]>(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const allRows = results.data as string[][];
          if (allRows.length < 2) { setImportError("File appears to be empty or has only headers."); return; }
          const headers = allRows[0].map((h) => h.trim());
          const dataRows = allRows.slice(1);
          setImportRawHeaders(headers);
          setImportRawRows(dataRows);
          setImportMapping(buildInitialWcMapping(headers));
          setImportStep("mapping");
        },
        error: (err: Error) => setImportError(err.message),
      });
    }
    e.target.value = "";
  }

  async function submitMappedImport() {
    setImportBusy(true);
    const mapped = importRawRows.map((row) => {
      const obj: Record<string, string> = {};
      for (const { key } of WC_IMPORT_FIELDS) {
        const col = importMapping[key];
        if (col) {
          const idx = importRawHeaders.indexOf(col);
          obj[key] = idx >= 0 ? (row[idx] || "").trim() : "";
        }
      }
      return obj;
    }).map((r) => ({
      matchDate: r.matchDate,
      matchLabel: r.matchLabel || undefined,
      venueName: r.venueName,
      town: r.town,
      eventName: r.eventName || undefined,
      instagramHandle: r.instagramHandle || undefined,
      learnMoreUrl: r.learnMoreUrl || undefined,
    }));
    try {
      const res = await apiRequest("POST", "/api/admin/world-cup-submissions/bulk", mapped);
      const result = await res.json();
      setImportResult(result);
      qc.invalidateQueries({ queryKey: ["/api/admin/world-cup-submissions"] });
      toast({ title: `Imported ${result.imported} watch ${result.imported === 1 ? "party" : "parties"}` });
    } catch (err) {
      toast({ title: "Import failed", description: String(err), variant: "destructive" });
    } finally {
      setImportBusy(false);
    }
  }

  const { data: submissions = [], isLoading } = useQuery<WorldCupSubmissionRow[]>({
    queryKey: ["/api/admin/world-cup-submissions", statusFilter],
    queryFn: async () => {
      const url = statusFilter === "all"
        ? "/api/admin/world-cup-submissions"
        : `/api/admin/world-cup-submissions?status=${statusFilter}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/world-cup-submissions/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/world-cup-submissions"] });
      toast({ title: "Updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  // Edit-submission modal state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    venueName: "", town: "", matchDate: "", matchLabel: "",
    eventName: "", instagramHandle: "", learnMoreUrl: "", region: "",
  });
  const [editBusy, setEditBusy] = useState(false);

  function openEdit(s: WorldCupSubmissionRow) {
    setEditingId(s.id);
    setEditForm({
      venueName: s.venueName || "",
      town: s.town || "",
      matchDate: s.matchDate || "",
      matchLabel: s.matchLabel || s.matchSlot || "",
      eventName: s.eventName || "",
      instagramHandle: s.instagramHandle || "",
      learnMoreUrl: s.learnMoreUrl || "",
      region: s.region || "",
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    setEditBusy(true);
    try {
      const payload: Record<string, string | null> = {
        venueName: editForm.venueName.trim(),
        town: editForm.town.trim(),
        matchDate: editForm.matchDate.trim(),
        matchLabel: editForm.matchLabel.trim() || null,
        eventName: editForm.eventName.trim() || null,
        instagramHandle: editForm.instagramHandle.trim() || null,
        learnMoreUrl: editForm.learnMoreUrl.trim() || null,
        region: editForm.region.trim() || null,
      };
      const res = await apiRequest("PATCH", `/api/admin/world-cup-submissions/${editingId}`, payload);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Save failed");
      qc.invalidateQueries({ queryKey: ["/api/admin/world-cup-submissions"] });
      toast({ title: "Saved" });
      setEditingId(null);
    } catch (err) {
      toast({ title: "Save failed", description: String((err as Error).message || err), variant: "destructive" });
    } finally {
      setEditBusy(false);
    }
  }

  // Multi-select state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      const res = await apiRequest("POST", "/api/admin/world-cup-submissions/bulk-status", { ids: Array.from(selectedIds), status });
      return res.json();
    },
    onSuccess: (data: { updated: number }) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/world-cup-submissions"] });
      toast({ title: `Updated ${data.updated}` });
      setSelectedIds(new Set());
    },
    onError: () => toast({ title: "Bulk update failed", variant: "destructive" }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/world-cup-submissions/bulk-delete", { ids: Array.from(selectedIds) });
      return res.json();
    },
    onSuccess: (data: { deleted: number }) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/world-cup-submissions"] });
      toast({ title: `Deleted ${data.deleted}` });
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
    },
    onError: () => toast({ title: "Bulk delete failed", variant: "destructive" }),
  });

  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditFields, setBulkEditFields] = useState<{ region: string }>({ region: "" });

  const bulkEditMutation = useMutation({
    mutationFn: async () => {
      const fields: Record<string, string | null> = {};
      if (bulkEditFields.region) {
        fields.region = bulkEditFields.region === "__clear__" ? null : bulkEditFields.region;
      }
      const res = await apiRequest("POST", "/api/admin/world-cup-submissions/bulk-edit", { ids: Array.from(selectedIds), fields });
      return res.json();
    },
    onSuccess: (data: { updated: number }) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/world-cup-submissions"] });
      toast({ title: `Updated ${data.updated}` });
      setSelectedIds(new Set());
      setShowBulkEditModal(false);
      setBulkEditFields({ region: "" });
    },
    onError: () => toast({ title: "Bulk edit failed", variant: "destructive" }),
  });

  // Sort state — defaults to newest submissions first.
  const [sort, setSort] = useState<SortState>({ field: "createdAt", direction: "desc" });
  const WC_SORT_COLUMNS = [
    { field: "matchDate", label: "Match Date" },
    { field: "venueName", label: "Venue" },
    { field: "town", label: "Town" },
    { field: "status", label: "Status" },
    { field: "createdAt", label: "Submitted" },
  ];
  const sortedSubmissions = useMemo(() => sortRows(submissions, sort.field, sort.direction), [submissions, sort]);

  const STATUS_FILTERS = ["pending", "approved", "rejected", "all"];

  return (
    <div className="space-y-4 min-w-0 max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground font-medium">Filter:</span>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${statusFilter === s ? "bg-primary border-primary text-white" : "border-white/10 text-white/40 hover:text-white/60"}`}
              data-testid={`filter-wc-status-${s}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar — visible only when at least one row is selected */}
      {selectedIds.size > 0 && (
        <div className="bg-primary/15 border border-primary/40 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3" data-testid="wc-bulk-bar">
          <span className="text-sm text-white font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-2 flex-wrap ml-auto">
            <Button size="sm" disabled={bulkStatusMutation.isPending} onClick={() => bulkStatusMutation.mutate({ status: "approved" })} className="bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30">Approve all</Button>
            <Button size="sm" disabled={bulkStatusMutation.isPending} onClick={() => bulkStatusMutation.mutate({ status: "rejected" })} className="bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30">Reject all</Button>
            <Button size="sm" disabled={bulkStatusMutation.isPending} onClick={() => bulkStatusMutation.mutate({ status: "pending" })} variant="outline" className="border-white/20 text-white/70">Reopen all</Button>
            <Button size="sm" onClick={() => setShowBulkEditModal(true)} className="bg-blue-500/20 border border-blue-500/40 text-blue-300 hover:bg-blue-500/30" data-testid="wc-bulk-edit-btn">
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit selected
            </Button>
            <Button size="sm" disabled={bulkDeleteMutation.isPending} onClick={() => setShowBulkDeleteConfirm(true)} className="bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete all
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())} className="border-white/15 text-white/50">Clear</Button>
          </div>
        </div>
      )}

      <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {submissions.length > 0 && (
              <Checkbox
                checked={selectedIds.size === submissions.length && submissions.length > 0}
                onCheckedChange={(checked) => {
                  if (checked) setSelectedIds(new Set(submissions.map((s) => s.id)));
                  else setSelectedIds(new Set());
                }}
                data-testid="wc-select-all"
              />
            )}
            <h2 className="font-bold text-white">World Cup Watch Party Submissions <span className="text-muted-foreground font-normal text-sm ml-2">({submissions.length})</span></h2>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="border-white/20 text-white/70 h-8" onClick={downloadCsvTemplate} data-testid="wc-download-template">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Template
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90 h-8" onClick={() => { resetImportWizard(); setShowImportModal(true); }} data-testid="wc-import-btn">
              <Upload className="w-3.5 h-3.5 mr-1.5" /> Import CSV / XLSX
            </Button>
          </div>
        </div>
        {submissions.length > 0 && (
          <SortHeader columns={WC_SORT_COLUMNS} sort={sort} onChange={setSort} />
        )}
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : submissions.length === 0 ? (
          <div className="py-10 px-6 text-center text-muted-foreground text-sm">No submissions match this filter.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {sortedSubmissions.map((s) => {
              const isRowSelected = selectedIds.has(s.id);
              return (
              <div key={s.id} className={`px-6 py-5 ${isRowSelected ? "bg-primary/5" : ""}`} data-testid={`wc-row-${s.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 flex items-start gap-3">
                    <Checkbox
                      checked={isRowSelected}
                      onCheckedChange={(checked) => {
                        const next = new Set(selectedIds);
                        if (checked) next.add(s.id); else next.delete(s.id);
                        setSelectedIds(next);
                      }}
                      className="mt-1"
                      data-testid={`wc-select-${s.id}`}
                    />
                    <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-white">{s.eventName || s.venueName}</h3>
                      {s.eventName && <span className="text-sm text-white/50">at {s.venueName}</span>}
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        s.status === "approved" ? "border-green-500/40 text-green-400 bg-green-500/10" :
                        s.status === "rejected" ? "border-red-500/40 text-red-400 bg-red-500/10" :
                        "border-yellow-500/40 text-yellow-400 bg-yellow-500/10"
                      }`}>{s.status}</span>
                    </div>
                    <div className="text-sm text-white/70 space-y-0.5 min-w-0">
                      <p className="break-words">📍 {s.town}, NJ · 📅 {s.matchDate} · ⚽ {s.matchLabel || s.matchSlot || "(no match)"}</p>
                      <p className="text-xs text-white/50 break-all">
                        <a href={`mailto:${s.submitterEmail}`} className="text-primary hover:underline">{s.submitterEmail}</a>
                        {s.instagramHandle && <> · <a href={`https://instagram.com/${s.instagramHandle.replace("@","")}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@{s.instagramHandle.replace("@","")}</a></>}
                        {s.learnMoreUrl && <> · <a href={s.learnMoreUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Learn-more link ↗</a></>}
                      </p>
                    </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => openEdit(s)} className="border-white/15 text-white/70" data-testid={`wc-edit-${s.id}`}>
                      <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                    </Button>
                    {s.status !== "approved" && (
                      <Button size="sm" onClick={() => updateMutation.mutate({ id: s.id, status: "approved" })} className="bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25" data-testid={`wc-approve-${s.id}`}>
                        Approve
                      </Button>
                    )}
                    {s.status !== "rejected" && (
                      <Button size="sm" onClick={() => updateMutation.mutate({ id: s.id, status: "rejected" })} className="bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25" data-testid={`wc-reject-${s.id}`}>
                        Reject
                      </Button>
                    )}
                    {s.status !== "pending" && (
                      <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: s.id, status: "pending" })} className="border-white/15 text-white/60" data-testid={`wc-reopen-${s.id}`}>
                        Reopen
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk delete confirmation */}
      <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <DialogContent className="bg-secondary border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} submission{selectedIds.size !== 1 ? "s" : ""}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/70 py-2">
            This permanently deletes {selectedIds.size} selected watch party submission{selectedIds.size !== 1 ? "s" : ""}. Cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(false)} className="border-white/20 text-white/70">Cancel</Button>
            <Button onClick={() => bulkDeleteMutation.mutate()} disabled={bulkDeleteMutation.isPending} className="bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30">
              {bulkDeleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Delete ${selectedIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk edit modal — apply a field value to all selected rows */}
      <Dialog open={showBulkEditModal} onOpenChange={(o) => { setShowBulkEditModal(o); if (!o) setBulkEditFields({ region: "" }); }}>
        <DialogContent className="bg-secondary border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {selectedIds.size} submission{selectedIds.size !== 1 ? "s" : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-white/50">Leave a field blank to keep its current value. Select "Auto from town" to clear the override and fall back to the auto-derived region.</p>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Region override</Label>
              <Select value={bulkEditFields.region || "__none__"} onValueChange={(v) => setBulkEditFields({ ...bulkEditFields, region: v === "__none__" ? "" : v })}>
                <SelectTrigger className="bg-black/40 border-white/10 h-10"><SelectValue placeholder="No change" /></SelectTrigger>
                <SelectContent className="bg-secondary border-white/10 text-white">
                  <SelectItem value="__none__">— No change —</SelectItem>
                  <SelectItem value="North NJ">North NJ</SelectItem>
                  <SelectItem value="Central NJ">Central NJ</SelectItem>
                  <SelectItem value="South NJ">South NJ</SelectItem>
                  <SelectItem value="__clear__">Auto from town (clear override)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBulkEditModal(false)} className="border-white/20 text-white/70">Cancel</Button>
            <Button onClick={() => bulkEditMutation.mutate()} disabled={bulkEditMutation.isPending || !bulkEditFields.region} className="bg-primary hover:bg-primary/90">
              {bulkEditMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Apply to ${selectedIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import wizard modal */}
      <Dialog open={showImportModal} onOpenChange={(o) => { setShowImportModal(o); if (!o) resetImportWizard(); }}>
        <DialogContent className="bg-secondary border-white/10 text-white max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Watch Parties from CSV or Excel</DialogTitle>
          </DialogHeader>

          {/* Step 1: upload */}
          {importStep === "input" && !importResult && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Upload a <strong>.csv</strong>, <strong>.xlsx</strong>, or <strong>.xls</strong> file with one watch party per row. You'll map the columns in the next step.
              </p>
              <div className="border-2 border-dashed border-white/15 rounded-2xl p-8 text-center">
                <Upload className="w-8 h-8 mx-auto text-white/40 mb-3" />
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  className="hidden"
                  onChange={handleImportFile}
                  data-testid="wc-import-file"
                />
                <Button onClick={() => importInputRef.current?.click()} className="bg-primary hover:bg-primary/90">
                  Choose file
                </Button>
                <p className="text-xs text-muted-foreground mt-3">CSV, XLSX, or XLS</p>
              </div>
              {importError && <p className="text-sm text-red-400">{importError}</p>}
              <p className="text-xs text-muted-foreground">
                Don't have a file yet? <button type="button" onClick={downloadCsvTemplate} className="text-primary hover:underline">Download a CSV template</button> to start from.
              </p>
            </div>
          )}

          {/* Step 2: column mapping */}
          {importStep === "mapping" && !importResult && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Map your file's columns to our fields. Required fields are marked <span className="text-red-400">*</span>. The tournament week is auto-derived from the match date.
              </p>
              <div className="rounded-lg border border-white/10 overflow-hidden">
                <table className="text-sm w-full">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10 text-muted-foreground text-left">
                      <th className="px-3 py-2 font-medium w-1/2">CGE Field</th>
                      <th className="px-3 py-2 font-medium w-1/2">Your Column</th>
                    </tr>
                  </thead>
                  <tbody>
                    {WC_IMPORT_FIELDS.map(({ key, label, required }) => (
                      <tr key={key} className="border-b border-white/5">
                        <td className="px-3 py-2 text-white/80">{label}{required && <span className="text-red-400 ml-1">*</span>}</td>
                        <td className="px-3 py-2">
                          <Select
                            value={importMapping[key] || "__none__"}
                            onValueChange={(v) => setImportMapping({ ...importMapping, [key]: v === "__none__" ? "" : v })}
                          >
                            <SelectTrigger className="h-8 bg-black/40 border-white/10 text-xs" data-testid={`wc-map-${key}`}>
                              <SelectValue placeholder="— skip —" />
                            </SelectTrigger>
                            <SelectContent className="bg-secondary border-white/10 text-white">
                              <SelectItem value="__none__">— skip —</SelectItem>
                              {importRawHeaders.filter(h => h && h.trim().length > 0).map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {importRawRows.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Preview (first 3 rows with current mapping):</p>
                  <div className="overflow-x-auto rounded-lg border border-white/10">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10 text-muted-foreground">
                          {WC_IMPORT_FIELDS.filter(f => importMapping[f.key]).map(f => (
                            <th key={f.key} className="px-3 py-2 text-left font-medium whitespace-nowrap">{f.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importRawRows.slice(0, 3).map((row, ri) => (
                          <tr key={ri} className="border-b border-white/5">
                            {WC_IMPORT_FIELDS.filter(f => importMapping[f.key]).map(f => {
                              const idx = importRawHeaders.indexOf(importMapping[f.key]);
                              return <td key={f.key} className="px-3 py-2 text-white/80 whitespace-nowrap max-w-[160px] truncate">{idx >= 0 ? (row[idx] || "—") : "—"}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 pt-2">
                <Button variant="outline" onClick={() => setImportStep("input")} className="border-white/20 text-white/70">Back</Button>
                <Button
                  onClick={submitMappedImport}
                  disabled={importBusy || !importMapping["matchDate"] || !importMapping["matchLabel"] || !importMapping["venueName"] || !importMapping["town"]}
                  className="bg-primary hover:bg-primary/90 font-semibold"
                  data-testid="wc-confirm-import"
                >
                  {importBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing…</> : <>Import {importRawRows.length} row{importRawRows.length !== 1 ? "s" : ""}</>}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Result */}
          {importResult && (
            <div className="py-4 space-y-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                <p className="text-green-400 text-sm font-medium">
                  {importResult.imported} watch {importResult.imported === 1 ? "party" : "parties"} imported
                  {importResult.invalid.length > 0 && `, ${importResult.invalid.length} invalid row${importResult.invalid.length !== 1 ? "s" : ""} skipped`}
                </p>
              </div>
              {importResult.invalid.length > 0 && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <p className="text-xs font-semibold text-yellow-300 mb-2">Skipped rows:</p>
                  <ul className="text-xs text-white/70 space-y-1">
                    {importResult.invalid.map((iv, i) => <li key={i}>Row {iv.rowIndex + 1}: {iv.reason}</li>)}
                  </ul>
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => { setShowImportModal(false); resetImportWizard(); }} className="bg-primary hover:bg-primary/90">Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit submission modal — clean up details before approving */}
      <Dialog open={editingId !== null} onOpenChange={(o) => { if (!o) setEditingId(null); }}>
        <DialogContent className="bg-secondary border-white/10 text-white max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit watch party submission</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Venue name *</Label>
              <Input value={editForm.venueName} onChange={(e) => setEditForm({ ...editForm, venueName: e.target.value })} className="bg-black/40 border-white/10 h-10" data-testid="edit-venue" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Town *</Label>
              <Input value={editForm.town} onChange={(e) => setEditForm({ ...editForm, town: e.target.value })} className="bg-black/40 border-white/10 h-10" data-testid="edit-town" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Region override <span className="text-white/40">(optional)</span></Label>
              <Select value={editForm.region || "__auto__"} onValueChange={(v) => setEditForm({ ...editForm, region: v === "__auto__" ? "" : v })}>
                <SelectTrigger className="bg-black/40 border-white/10 h-10"><SelectValue placeholder="Auto from town" /></SelectTrigger>
                <SelectContent className="bg-secondary border-white/10 text-white">
                  <SelectItem value="__auto__">Auto from town</SelectItem>
                  <SelectItem value="North NJ">North NJ</SelectItem>
                  <SelectItem value="Central NJ">Central NJ</SelectItem>
                  <SelectItem value="South NJ">South NJ</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-white/40">Leave on "Auto" unless the town isn't recognized and you need to force a region.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Match date *</Label>
              <Input type="date" value={editForm.matchDate} onChange={(e) => setEditForm({ ...editForm, matchDate: e.target.value })} className="bg-black/40 border-white/10 h-10" data-testid="edit-match-date" />
              <p className="text-[11px] text-white/40">Must be in the World Cup window (Jun 11 – Jul 19, 2026). Week is auto-derived.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Match label / fixture</Label>
              <Input value={editForm.matchLabel} onChange={(e) => setEditForm({ ...editForm, matchLabel: e.target.value })} placeholder="USA vs Wales" className="bg-black/40 border-white/10 h-10" data-testid="edit-match-label" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Event name <span className="text-white/40">(optional)</span></Label>
              <Input value={editForm.eventName} onChange={(e) => setEditForm({ ...editForm, eventName: e.target.value })} className="bg-black/40 border-white/10 h-10" data-testid="edit-event-name" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Instagram handle <span className="text-white/40">(optional)</span></Label>
              <Input value={editForm.instagramHandle} onChange={(e) => setEditForm({ ...editForm, instagramHandle: e.target.value })} placeholder="@venue" className="bg-black/40 border-white/10 h-10" data-testid="edit-ig" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Learn-more URL <span className="text-white/40">(optional)</span></Label>
              <Input value={editForm.learnMoreUrl} onChange={(e) => setEditForm({ ...editForm, learnMoreUrl: e.target.value })} placeholder="posh.vip/e/your-event" className="bg-black/40 border-white/10 h-10" data-testid="edit-url" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingId(null)} className="border-white/20 text-white/70">Cancel</Button>
            <Button onClick={saveEdit} disabled={editBusy} className="bg-primary hover:bg-primary/90" data-testid="edit-save">
              {editBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  NBA FINALS WATCH PARTIES TAB                              */
/* ─────────────────────────────────────────────────────────── */
interface NbaFinalsSubmissionRow {
  id: number;
  gameNumber: number;
  gameDate: string;
  venueName: string;
  town: string;
  region: string | null;
  eventName: string | null;
  instagramHandle: string | null;
  learnMoreUrl: string | null;
  submitterEmail: string;
  status: string;
  adminNotes: string | null;
  createdAt: string | null;
}

const NBA_IMPORT_FIELDS = [
  { key: "gameDate",        label: "Game Date (YYYY-MM-DD)", required: true },
  { key: "venueName",       label: "Venue Name",   required: true },
  { key: "town",            label: "Town / City",  required: true },
  { key: "eventName",       label: "Event Name",   required: false },
  { key: "instagramHandle", label: "Instagram Handle", required: false },
  { key: "learnMoreUrl",    label: "Learn-more URL", required: false },
];

const NBA_IMPORT_ALIASES: Record<string, string[]> = {
  gameDate:        ["date", "gamedate", "game date", "event date"],
  venueName:       ["venue", "venuename", "venue name", "location", "place"],
  town:            ["town", "city", "area"],
  eventName:       ["event", "eventname", "event name", "name", "title"],
  instagramHandle: ["instagram", "ig", "handle", "insta"],
  learnMoreUrl:    ["url", "link", "learnmoreurl", "ticket", "tickets"],
};

function nbaAutoMatch(headers: string[], key: string): string {
  const aliases = NBA_IMPORT_ALIASES[key] || [key];
  return headers.find((h) => aliases.some((a) => h.toLowerCase().trim() === a.toLowerCase())) ||
         headers.find((h) => aliases.some((a) => h.toLowerCase().trim().includes(a.toLowerCase()))) || "";
}

function NbaFinalsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  // Import wizard state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<"input" | "mapping">("input");
  const [importRawHeaders, setImportRawHeaders] = useState<string[]>([]);
  const [importRawRows, setImportRawRows] = useState<string[][]>([]);
  const [importMapping, setImportMapping] = useState<Record<string, string>>({});
  const [importError, setImportError] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; invalid: { rowIndex: number; reason: string }[] } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Edit modal state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ venueName: "", town: "", gameDate: "", eventName: "", instagramHandle: "", learnMoreUrl: "", region: "" });
  const [editBusy, setEditBusy] = useState(false);

  const { data: submissions = [], isLoading } = useQuery<NbaFinalsSubmissionRow[]>({
    queryKey: ["/api/admin/nba-finals-submissions", statusFilter],
    queryFn: async () => {
      const url = statusFilter === "all"
        ? "/api/admin/nba-finals-submissions"
        : `/api/admin/nba-finals-submissions?status=${statusFilter}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/nba-finals-submissions/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/nba-finals-submissions"] });
      toast({ title: "Updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  function openEdit(s: NbaFinalsSubmissionRow) {
    setEditingId(s.id);
    setEditForm({
      venueName: s.venueName || "",
      town: s.town || "",
      gameDate: s.gameDate || "",
      eventName: s.eventName || "",
      instagramHandle: s.instagramHandle || "",
      learnMoreUrl: s.learnMoreUrl || "",
      region: s.region || "",
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    setEditBusy(true);
    try {
      const payload: Record<string, string | null> = {
        venueName: editForm.venueName.trim(),
        town: editForm.town.trim(),
        gameDate: editForm.gameDate.trim(),
        eventName: editForm.eventName.trim() || null,
        instagramHandle: editForm.instagramHandle.trim() || null,
        learnMoreUrl: editForm.learnMoreUrl.trim() || null,
        region: editForm.region.trim() || null,
      };
      const res = await apiRequest("PATCH", `/api/admin/nba-finals-submissions/${editingId}`, payload);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Save failed");
      qc.invalidateQueries({ queryKey: ["/api/admin/nba-finals-submissions"] });
      toast({ title: "Saved" });
      setEditingId(null);
    } catch (err) {
      toast({ title: "Save failed", description: String((err as Error).message || err), variant: "destructive" });
    } finally {
      setEditBusy(false);
    }
  }

  function downloadCsvTemplate() {
    const headers = "gameDate,venueName,town,eventName,instagramHandle,learnMoreUrl";
    const sample = "2026-06-12,The Sports Bar,Newark,Game 4 Watch Party,@yourvenue,https://posh.vip/e/example";
    const blob = new Blob([headers + "\n" + sample + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nba-finals-watch-parties-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetImportWizard() {
    setImportStep("input"); setImportRawHeaders([]); setImportRawRows([]); setImportMapping({});
    setImportError(""); setImportResult(null); setImportBusy(false);
  }

  function buildInitialMapping(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    for (const { key } of NBA_IMPORT_FIELDS) mapping[key] = nbaAutoMatch(headers, key);
    return mapping;
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(""); setImportResult(null);
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array", cellDates: true });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false, dateNF: "yyyy-mm-dd" }) as any[][];
          const nonEmpty = allRows.filter((r) => r.some((c) => String(c).trim() !== ""));
          if (nonEmpty.length < 2) { setImportError("File empty / only headers."); return; }
          const headers = nonEmpty[0].map((h) => String(h).trim());
          const dataRows = nonEmpty.slice(1).map((row) => row.map((c) => String(c).trim()));
          setImportRawHeaders(headers); setImportRawRows(dataRows);
          setImportMapping(buildInitialMapping(headers)); setImportStep("mapping");
        } catch { setImportError("Could not read the spreadsheet."); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse<string[]>(file, {
        header: false, skipEmptyLines: true,
        complete: (results) => {
          const allRows = results.data as string[][];
          if (allRows.length < 2) { setImportError("File empty / only headers."); return; }
          const headers = allRows[0].map((h) => h.trim());
          const dataRows = allRows.slice(1);
          setImportRawHeaders(headers); setImportRawRows(dataRows);
          setImportMapping(buildInitialMapping(headers)); setImportStep("mapping");
        },
        error: (err: Error) => setImportError(err.message),
      });
    }
    e.target.value = "";
  }

  async function submitMappedImport() {
    setImportBusy(true);
    const mapped = importRawRows.map((row) => {
      const obj: Record<string, string> = {};
      for (const { key } of NBA_IMPORT_FIELDS) {
        const col = importMapping[key];
        if (col) {
          const idx = importRawHeaders.indexOf(col);
          obj[key] = idx >= 0 ? (row[idx] || "").trim() : "";
        }
      }
      return obj;
    }).map((r) => ({
      gameDate: r.gameDate,
      venueName: r.venueName,
      town: r.town,
      eventName: r.eventName || undefined,
      instagramHandle: r.instagramHandle || undefined,
      learnMoreUrl: r.learnMoreUrl || undefined,
    }));
    try {
      const res = await apiRequest("POST", "/api/admin/nba-finals-submissions/bulk", mapped);
      const result = await res.json();
      setImportResult(result);
      qc.invalidateQueries({ queryKey: ["/api/admin/nba-finals-submissions"] });
      toast({ title: `Imported ${result.imported}` });
    } catch (err) {
      toast({ title: "Import failed", description: String(err), variant: "destructive" });
    } finally {
      setImportBusy(false);
    }
  }

  // Multi-select state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      const res = await apiRequest("POST", "/api/admin/nba-finals-submissions/bulk-status", { ids: Array.from(selectedIds), status });
      return res.json();
    },
    onSuccess: (data: { updated: number }) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/nba-finals-submissions"] });
      toast({ title: `Updated ${data.updated}` });
      setSelectedIds(new Set());
    },
    onError: () => toast({ title: "Bulk update failed", variant: "destructive" }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/nba-finals-submissions/bulk-delete", { ids: Array.from(selectedIds) });
      return res.json();
    },
    onSuccess: (data: { deleted: number }) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/nba-finals-submissions"] });
      toast({ title: `Deleted ${data.deleted}` });
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
    },
    onError: () => toast({ title: "Bulk delete failed", variant: "destructive" }),
  });

  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditFields, setBulkEditFields] = useState<{ region: string }>({ region: "" });

  const bulkEditMutation = useMutation({
    mutationFn: async () => {
      const fields: Record<string, string | null> = {};
      if (bulkEditFields.region) {
        fields.region = bulkEditFields.region === "__clear__" ? null : bulkEditFields.region;
      }
      const res = await apiRequest("POST", "/api/admin/nba-finals-submissions/bulk-edit", { ids: Array.from(selectedIds), fields });
      return res.json();
    },
    onSuccess: (data: { updated: number }) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/nba-finals-submissions"] });
      toast({ title: `Updated ${data.updated}` });
      setSelectedIds(new Set());
      setShowBulkEditModal(false);
      setBulkEditFields({ region: "" });
    },
    onError: () => toast({ title: "Bulk edit failed", variant: "destructive" }),
  });

  const [sort, setSort] = useState<SortState>({ field: "createdAt", direction: "desc" });
  const NBA_SORT_COLUMNS = [
    { field: "gameDate", label: "Game Date" },
    { field: "venueName", label: "Venue" },
    { field: "town", label: "Town" },
    { field: "status", label: "Status" },
    { field: "createdAt", label: "Submitted" },
  ];
  const sortedSubmissions = useMemo(() => sortRows(submissions, sort.field, sort.direction), [submissions, sort]);

  const STATUS_FILTERS = ["pending", "approved", "rejected", "all"];

  return (
    <div className="space-y-4 min-w-0 max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground font-medium">Filter:</span>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${statusFilter === s ? "bg-primary border-primary text-white" : "border-white/10 text-white/40 hover:text-white/60"}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* NBA Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="bg-primary/15 border border-primary/40 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3" data-testid="nba-bulk-bar">
          <span className="text-sm text-white font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-2 flex-wrap ml-auto">
            <Button size="sm" disabled={bulkStatusMutation.isPending} onClick={() => bulkStatusMutation.mutate({ status: "approved" })} className="bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30">Approve all</Button>
            <Button size="sm" disabled={bulkStatusMutation.isPending} onClick={() => bulkStatusMutation.mutate({ status: "rejected" })} className="bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30">Reject all</Button>
            <Button size="sm" disabled={bulkStatusMutation.isPending} onClick={() => bulkStatusMutation.mutate({ status: "pending" })} variant="outline" className="border-white/20 text-white/70">Reopen all</Button>
            <Button size="sm" onClick={() => setShowBulkEditModal(true)} className="bg-blue-500/20 border border-blue-500/40 text-blue-300 hover:bg-blue-500/30" data-testid="nba-bulk-edit-btn">
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit selected
            </Button>
            <Button size="sm" disabled={bulkDeleteMutation.isPending} onClick={() => setShowBulkDeleteConfirm(true)} className="bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete all
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())} className="border-white/15 text-white/50">Clear</Button>
          </div>
        </div>
      )}

      <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {submissions.length > 0 && (
              <Checkbox
                checked={selectedIds.size === submissions.length && submissions.length > 0}
                onCheckedChange={(checked) => {
                  if (checked) setSelectedIds(new Set(submissions.map((s) => s.id)));
                  else setSelectedIds(new Set());
                }}
                data-testid="nba-select-all"
              />
            )}
            <h2 className="font-bold text-white">NBA Finals Watch Party Submissions <span className="text-muted-foreground font-normal text-sm ml-2">({submissions.length})</span></h2>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="border-white/20 text-white/70 h-8" onClick={downloadCsvTemplate}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Template
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90 h-8" onClick={() => { resetImportWizard(); setShowImportModal(true); }}>
              <Upload className="w-3.5 h-3.5 mr-1.5" /> Import CSV / XLSX
            </Button>
          </div>
        </div>
        {submissions.length > 0 && (
          <SortHeader columns={NBA_SORT_COLUMNS} sort={sort} onChange={setSort} />
        )}
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : submissions.length === 0 ? (
          <div className="py-10 px-6 text-center text-muted-foreground text-sm">No submissions match this filter.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {sortedSubmissions.map((s) => {
              const isRowSelected = selectedIds.has(s.id);
              return (
              <div key={s.id} className={`px-6 py-5 ${isRowSelected ? "bg-primary/5" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 flex items-start gap-3">
                    <Checkbox
                      checked={isRowSelected}
                      onCheckedChange={(checked) => {
                        const next = new Set(selectedIds);
                        if (checked) next.add(s.id); else next.delete(s.id);
                        setSelectedIds(next);
                      }}
                      className="mt-1"
                      data-testid={`nba-select-${s.id}`}
                    />
                    <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-white">{s.eventName || s.venueName}</h3>
                      {s.eventName && <span className="text-sm text-white/50">at {s.venueName}</span>}
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        s.status === "approved" ? "border-green-500/40 text-green-400 bg-green-500/10" :
                        s.status === "rejected" ? "border-red-500/40 text-red-400 bg-red-500/10" :
                        "border-yellow-500/40 text-yellow-400 bg-yellow-500/10"
                      }`}>{s.status}</span>
                    </div>
                    <div className="text-sm text-white/70 space-y-0.5 min-w-0">
                      <p className="break-words">📍 {s.town}, NJ · 📅 {s.gameDate} · 🏀 Game {s.gameNumber}</p>
                      <p className="text-xs text-white/50 break-all">
                        <a href={`mailto:${s.submitterEmail}`} className="text-primary hover:underline">{s.submitterEmail}</a>
                        {s.instagramHandle && <> · <a href={`https://instagram.com/${s.instagramHandle.replace("@","")}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@{s.instagramHandle.replace("@","")}</a></>}
                        {s.learnMoreUrl && <> · <a href={s.learnMoreUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Learn-more link ↗</a></>}
                      </p>
                    </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => openEdit(s)} className="border-white/15 text-white/70">
                      <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                    </Button>
                    {s.status !== "approved" && (
                      <Button size="sm" onClick={() => updateMutation.mutate({ id: s.id, status: "approved" })} className="bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25">Approve</Button>
                    )}
                    {s.status !== "rejected" && (
                      <Button size="sm" onClick={() => updateMutation.mutate({ id: s.id, status: "rejected" })} className="bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25">Reject</Button>
                    )}
                    {s.status !== "pending" && (
                      <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: s.id, status: "pending" })} className="border-white/15 text-white/60">Reopen</Button>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* NBA Bulk delete confirmation */}
      <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <DialogContent className="bg-secondary border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} submission{selectedIds.size !== 1 ? "s" : ""}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/70 py-2">
            This permanently deletes {selectedIds.size} selected watch party submission{selectedIds.size !== 1 ? "s" : ""}. Cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(false)} className="border-white/20 text-white/70">Cancel</Button>
            <Button onClick={() => bulkDeleteMutation.mutate()} disabled={bulkDeleteMutation.isPending} className="bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30">
              {bulkDeleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Delete ${selectedIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import wizard modal */}
      <Dialog open={showImportModal} onOpenChange={(o) => { setShowImportModal(o); if (!o) resetImportWizard(); }}>
        <DialogContent className="bg-secondary border-white/10 text-white max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import NBA Finals Watch Parties</DialogTitle>
          </DialogHeader>
          {importStep === "input" && !importResult && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Upload a CSV or Excel file with one watch party per row. You'll map the columns next.</p>
              <div className="border-2 border-dashed border-white/15 rounded-2xl p-8 text-center">
                <Upload className="w-8 h-8 mx-auto text-white/40 mb-3" />
                <input ref={importInputRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={handleImportFile} />
                <Button onClick={() => importInputRef.current?.click()} className="bg-primary hover:bg-primary/90">Choose file</Button>
                <p className="text-xs text-muted-foreground mt-3">CSV, XLSX, or XLS</p>
              </div>
              {importError && <p className="text-sm text-red-400">{importError}</p>}
              <p className="text-xs text-muted-foreground">
                Don't have a file yet? <button type="button" onClick={downloadCsvTemplate} className="text-primary hover:underline">Download a CSV template</button>.
              </p>
            </div>
          )}
          {importStep === "mapping" && !importResult && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Map your file's columns to our fields. Required fields are marked <span className="text-red-400">*</span>.</p>
              <div className="rounded-lg border border-white/10 overflow-hidden">
                <table className="text-sm w-full">
                  <thead><tr className="bg-white/5 border-b border-white/10 text-muted-foreground text-left"><th className="px-3 py-2 font-medium w-1/2">CGE Field</th><th className="px-3 py-2 font-medium w-1/2">Your Column</th></tr></thead>
                  <tbody>
                    {NBA_IMPORT_FIELDS.map(({ key, label, required }) => (
                      <tr key={key} className="border-b border-white/5">
                        <td className="px-3 py-2 text-white/80">{label}{required && <span className="text-red-400 ml-1">*</span>}</td>
                        <td className="px-3 py-2">
                          <Select value={importMapping[key] || "__none__"} onValueChange={(v) => setImportMapping({ ...importMapping, [key]: v === "__none__" ? "" : v })}>
                            <SelectTrigger className="h-8 bg-black/40 border-white/10 text-xs"><SelectValue placeholder="— skip —" /></SelectTrigger>
                            <SelectContent className="bg-secondary border-white/10 text-white">
                              <SelectItem value="__none__">— skip —</SelectItem>
                              {importRawHeaders.filter(h => h && h.trim().length > 0).map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button variant="outline" onClick={() => setImportStep("input")} className="border-white/20 text-white/70">Back</Button>
                <Button onClick={submitMappedImport} disabled={importBusy || !importMapping["gameDate"] || !importMapping["venueName"] || !importMapping["town"]} className="bg-primary hover:bg-primary/90">
                  {importBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing…</> : <>Import {importRawRows.length} row{importRawRows.length !== 1 ? "s" : ""}</>}
                </Button>
              </DialogFooter>
            </div>
          )}
          {importResult && (
            <div className="py-4 space-y-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                <p className="text-green-400 text-sm font-medium">{importResult.imported} imported{importResult.invalid.length > 0 && `, ${importResult.invalid.length} skipped`}</p>
              </div>
              {importResult.invalid.length > 0 && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <p className="text-xs font-semibold text-yellow-300 mb-2">Skipped rows:</p>
                  <ul className="text-xs text-white/70 space-y-1">
                    {importResult.invalid.map((iv, i) => <li key={i}>Row {iv.rowIndex + 1}: {iv.reason}</li>)}
                  </ul>
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => { setShowImportModal(false); resetImportWizard(); }} className="bg-primary hover:bg-primary/90">Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={editingId !== null} onOpenChange={(o) => { if (!o) setEditingId(null); }}>
        <DialogContent className="bg-secondary border-white/10 text-white max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit NBA Finals watch party</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Venue name *</Label>
              <Input value={editForm.venueName} onChange={(e) => setEditForm({ ...editForm, venueName: e.target.value })} className="bg-black/40 border-white/10 h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Town *</Label>
              <Input value={editForm.town} onChange={(e) => setEditForm({ ...editForm, town: e.target.value })} className="bg-black/40 border-white/10 h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Region override <span className="text-white/40">(optional)</span></Label>
              <Select value={editForm.region || "__auto__"} onValueChange={(v) => setEditForm({ ...editForm, region: v === "__auto__" ? "" : v })}>
                <SelectTrigger className="bg-black/40 border-white/10 h-10"><SelectValue placeholder="Auto from town" /></SelectTrigger>
                <SelectContent className="bg-secondary border-white/10 text-white">
                  <SelectItem value="__auto__">Auto from town</SelectItem>
                  <SelectItem value="North NJ">North NJ</SelectItem>
                  <SelectItem value="Central NJ">Central NJ</SelectItem>
                  <SelectItem value="South NJ">South NJ</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-white/40">Leave on "Auto" unless the town isn't recognized.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Game date *</Label>
              <Input type="date" value={editForm.gameDate} onChange={(e) => setEditForm({ ...editForm, gameDate: e.target.value })} className="bg-black/40 border-white/10 h-10" />
              <p className="text-[11px] text-white/40">Must match an NBA Finals game date. Game number is auto-derived.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Event name <span className="text-white/40">(optional)</span></Label>
              <Input value={editForm.eventName} onChange={(e) => setEditForm({ ...editForm, eventName: e.target.value })} className="bg-black/40 border-white/10 h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Instagram handle <span className="text-white/40">(optional)</span></Label>
              <Input value={editForm.instagramHandle} onChange={(e) => setEditForm({ ...editForm, instagramHandle: e.target.value })} placeholder="@venue" className="bg-black/40 border-white/10 h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Learn-more URL <span className="text-white/40">(optional)</span></Label>
              <Input value={editForm.learnMoreUrl} onChange={(e) => setEditForm({ ...editForm, learnMoreUrl: e.target.value })} placeholder="posh.vip/e/your-event" className="bg-black/40 border-white/10 h-10" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingId(null)} className="border-white/20 text-white/70">Cancel</Button>
            <Button onClick={saveEdit} disabled={editBusy} className="bg-primary hover:bg-primary/90">
              {editBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  PAGES TAB — admin-created landing pages CMS               */
/* ─────────────────────────────────────────────────────────── */
interface PageRow {
  id: number;
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  heroImageUrl: string | null;
  editorContent: string;
  indexable: boolean;
  gateEnabled: boolean;
  submissionsEnabled: boolean;
  published: boolean;
  sitemapPriority: string;
  faqItems: string;
  updatedAt: string | null;
}

function PagesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");

  const { data: allPages = [], isLoading } = useQuery<PageRow[]>({
    queryKey: ["/api/admin/pages"],
  });
  // Hide the legacy /things-to-do-in-nj row from the Pages tab — it has its
  // own dedicated admin view under the "This Week" tab.
  const pages = allPages.filter((p) => p.slug !== "things-to-do-in-nj");

  async function createPage() {
    const slug = newSlug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const title = newTitle.trim();
    if (!slug || !title) {
      toast({ title: "Slug and title are required", variant: "destructive" });
      return;
    }
    try {
      await apiRequest("PUT", `/api/pages/${slug}`, {
        title,
        metaTitle: title,
        metaDescription: "",
        editorContent: "",
        published: false,
        indexable: true,
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/pages"] });
      toast({ title: "Page created (draft)" });
      setShowCreate(false);
      setNewSlug(""); setNewTitle("");
      setEditingSlug(slug);
    } catch (err) {
      toast({ title: "Create failed", description: String((err as Error).message || err), variant: "destructive" });
    }
  }

  async function deletePage(slug: string) {
    if (!window.confirm(`Delete page "${slug}"? This cannot be undone.`)) return;
    try {
      await apiRequest("DELETE", `/api/admin/pages/${slug}`);
      qc.invalidateQueries({ queryKey: ["/api/admin/pages"] });
      toast({ title: "Deleted" });
      if (editingSlug === slug) setEditingSlug(null);
    } catch (err) {
      toast({ title: "Delete failed", description: String((err as Error).message || err), variant: "destructive" });
    }
  }

  // Edit view: full-screen-ish form for the selected page.
  if (editingSlug) {
    return <PageEditor slug={editingSlug} onClose={() => setEditingSlug(null)} onDeleted={() => setEditingSlug(null)} />;
  }

  return (
    <div className="space-y-4 min-w-0 max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Pages</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Create and manage landing pages with SEO meta, hero image, body content, and FAQ.</p>
        </div>
        <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => setShowCreate(true)} data-testid="button-create-page">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> New Page
        </Button>
      </div>

      <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : pages.length === 0 ? (
          <div className="py-10 px-6 text-center text-sm text-muted-foreground">No pages yet. Click "New Page" to start.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {pages.map((p) => (
              <div key={p.slug} className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap" data-testid={`row-page-${p.slug}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-white">{p.title || "(untitled)"}</h3>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      p.published ? "border-green-500/40 text-green-400 bg-green-500/10" : "border-yellow-500/40 text-yellow-400 bg-yellow-500/10"
                    }`}>
                      {p.published ? "Published" : "Draft"}
                    </span>
                    {!p.indexable && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-white/15 text-white/50">noindex</span>
                    )}
                  </div>
                  <p className="text-xs text-white/50 break-all">/{p.slug}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {p.published && (
                    <Button size="sm" variant="outline" className="border-white/15 text-white/60" asChild>
                      <a href={`/${p.slug}`} target="_blank" rel="noopener noreferrer">View ↗</a>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="border-white/15 text-white/70" onClick={() => setEditingSlug(p.slug)} data-testid={`button-edit-page-${p.slug}`}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => deletePage(p.slug)} data-testid={`button-delete-page-${p.slug}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-secondary border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Create new page</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Title *</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="2026 NJ Summer Festival Guide" className="bg-black/40 border-white/10 h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">URL slug *</Label>
              <Input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="2026-summer-festival-guide" className="bg-black/40 border-white/10 h-10 font-mono text-sm" />
              <p className="text-[11px] text-white/40">Will be reachable at <span className="font-mono">centralgroupevents.com/{newSlug || "your-slug"}</span></p>
            </div>
            <p className="text-[11px] text-white/40">Created as a draft. You can edit and publish on the next screen.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-white/20 text-white/70">Cancel</Button>
            <Button onClick={createPage} className="bg-primary hover:bg-primary/90" data-testid="button-confirm-create-page">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Per-page edit form (separate component so each render gets its own data) */
function PageEditor({ slug, onClose, onDeleted }: { slug: string; onClose: () => void; onDeleted: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: page, isLoading } = useQuery<PageRow>({
    queryKey: ["/api/pages", slug],
    queryFn: async () => {
      const res = await fetch(`/api/pages/${slug}`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  // Tab switch inside the editor — Content (body + settings) or Submissions
  const [view, setView] = useState<"content" | "submissions">("content");

  const [title, setTitle] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [heroImageAlt, setHeroImageAlt] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [indexable, setIndexable] = useState(true);
  const [published, setPublished] = useState(false);
  const [gateEnabled, setGateEnabled] = useState(false);
  const [submissionsEnabled, setSubmissionsEnabled] = useState(false);
  const [faqJson, setFaqJson] = useState("[]");
  const [saving, setSaving] = useState(false);

  // Sync server state into form once page loads.
  useEffect(() => {
    if (!page) return;
    setTitle(page.title);
    setMetaTitle(page.metaTitle || "");
    setMetaDescription(page.metaDescription || "");
    setHeroImageUrl(page.heroImageUrl || "");
    setHeroImageAlt((page as any).heroImageAlt || "");
    setEditorContent(page.editorContent || "");
    setIndexable(page.indexable);
    setPublished(page.published);
    setGateEnabled(page.gateEnabled);
    setSubmissionsEnabled(page.submissionsEnabled);
    setFaqJson(page.faqItems || "[]");
  }, [page]);

  async function save() {
    setSaving(true);
    try {
      // Validate FAQ JSON before sending.
      try { JSON.parse(faqJson || "[]"); } catch { throw new Error("FAQ items must be valid JSON"); }
      await apiRequest("PUT", `/api/pages/${slug}`, {
        title,
        metaTitle,
        metaDescription,
        heroImageUrl: heroImageUrl || null,
        heroImageAlt: heroImageAlt || "",
        editorContent,
        indexable,
        published,
        gateEnabled,
        submissionsEnabled,
        faqItems: faqJson,
      });
      qc.invalidateQueries({ queryKey: ["/api/pages", slug] });
      qc.invalidateQueries({ queryKey: ["/api/admin/pages"] });
      toast({ title: "Saved" });
    } catch (err) {
      toast({ title: "Save failed", description: String((err as Error).message || err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !page) {
    return <div className="text-center py-12 text-white/50">Loading…</div>;
  }

  return (
    <div className="space-y-6 min-w-0 max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" className="border-white/20 text-white/70" onClick={onClose}>← Back to Pages</Button>
          <div>
            <h2 className="text-xl font-bold text-white">{title || "(untitled)"}</h2>
            <p className="text-xs text-muted-foreground">/{slug}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {published && (
            <Button size="sm" variant="outline" className="border-white/15 text-white/60" asChild>
              <a href={`/${slug}`} target="_blank" rel="noopener noreferrer">Preview ↗</a>
            </Button>
          )}
          {view === "content" && (
            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={save} disabled={saving} data-testid="button-save-page">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save"}
            </Button>
          )}
        </div>
      </div>

      {/* Tab switch — Content (body + settings) vs Submissions queue */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setView("content")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${view === "content" ? "border-primary text-white" : "border-transparent text-white/50 hover:text-white/80"}`}
          data-testid="tab-page-content"
        >
          Content
        </button>
        {submissionsEnabled && (
          <button
            onClick={() => setView("submissions")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${view === "submissions" ? "border-primary text-white" : "border-transparent text-white/50 hover:text-white/80"}`}
            data-testid="tab-page-submissions"
          >
            Submissions
          </button>
        )}
      </div>

      {view === "submissions" && page && (
        <PageSubmissionsView pageId={page.id} slug={slug} />
      )}

      {view === "content" && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/main: body */}
        <div className="lg:col-span-2 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-white/80">Title (shown as H1 on the page)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-black/40 border-white/10 h-11 text-lg font-semibold" data-testid="input-page-title" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/80">Body content</Label>
            <p className="text-[11px] text-white/40">Rich text — paste from Google Docs / Word, format with the toolbar. Embedded events list will be added in a follow-up.</p>
            <RichTextEditor content={editorContent} onChange={setEditorContent} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/80">FAQ items (JSON array)</Label>
            <p className="text-[11px] text-white/40">Format: <span className="font-mono">[{`{"q": "Question?", "a": "Answer."}`}]</span>. Generates FAQPage JSON-LD for Google.</p>
            <textarea
              value={faqJson}
              onChange={(e) => setFaqJson(e.target.value)}
              rows={4}
              className="w-full bg-black/40 border border-white/10 rounded-md p-2 font-mono text-xs text-white/80"
              data-testid="input-page-faq"
            />
          </div>
        </div>

        {/* Right sidebar: settings */}
        <aside className="space-y-5">
          <div className="bg-secondary/30 border border-white/10 rounded-2xl p-4 space-y-4">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider">Publish</h3>
            <label className="flex items-center justify-between gap-3 text-sm cursor-pointer">
              <span className="text-white/80">Published</span>
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} data-testid="toggle-page-published" className="h-4 w-4" />
            </label>
            <p className="text-[11px] text-white/40">Drafts are visible only to admins (logged-in). Publishing puts the page live and adds it to the sitemap.</p>
          </div>

          <div className="bg-secondary/30 border border-white/10 rounded-2xl p-4 space-y-4">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider">SEO</h3>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Meta title <span className="text-white/30">(≤60 chars)</span></Label>
              <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} maxLength={70} placeholder="(defaults to title)" className="bg-black/40 border-white/10 h-9 text-sm" />
              <p className="text-[10px] text-white/40">{metaTitle.length}/60</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Meta description <span className="text-white/30">(≤160 chars)</span></Label>
              <textarea
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                maxLength={180}
                rows={3}
                className="w-full bg-black/40 border border-white/10 rounded-md p-2 text-sm text-white/80"
              />
              <p className="text-[10px] text-white/40">{metaDescription.length}/160</p>
            </div>
            <label className="flex items-center justify-between gap-3 text-sm cursor-pointer">
              <span className="text-white/80">Index in Google</span>
              <input type="checkbox" checked={indexable} onChange={(e) => setIndexable(e.target.checked)} data-testid="toggle-page-indexable" className="h-4 w-4" />
            </label>
            <p className="text-[11px] text-white/40">Off = page renders with a noindex tag and is excluded from the sitemap.</p>
          </div>

          <div className="bg-secondary/30 border border-white/10 rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider">Hero image</h3>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">URL</Label>
              <Input value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)} placeholder="Paste Cloudinary URL" className="bg-black/40 border-white/10 h-9 text-sm" data-testid="input-page-hero-url" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Alt text {heroImageUrl && <span className="text-red-400">*</span>}</Label>
              <Input value={heroImageAlt} onChange={(e) => setHeroImageAlt(e.target.value)} placeholder="Describe what's in the image" className="bg-black/40 border-white/10 h-9 text-sm" data-testid="input-page-hero-alt" />
              <p className="text-[10px] text-white/40">For screen readers + image SEO. Be specific: "Crowd at MetLife Stadium watching World Cup match" beats "stadium".</p>
            </div>
            {heroImageUrl && <img src={heroImageUrl} alt={heroImageAlt || ""} className="w-full rounded-lg border border-white/10" />}
          </div>

          <div className="bg-secondary/30 border border-white/10 rounded-2xl p-4 space-y-4">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider">Engagement</h3>
            <label className="flex items-center justify-between gap-3 text-sm cursor-pointer">
              <span className="text-white/80">Enable public submissions</span>
              <input type="checkbox" checked={submissionsEnabled} onChange={(e) => setSubmissionsEnabled(e.target.checked)} className="h-4 w-4" data-testid="toggle-page-submissions" />
            </label>
            <p className="text-[11px] text-white/40">Adds a public form at the bottom of the page so visitors can submit venues. Submissions appear in a new "Submissions" tab above for review.</p>
            <label className="flex items-center justify-between gap-3 text-sm cursor-pointer">
              <span className="text-white/80">Email gate (cap list at 5 until unlock)</span>
              <input type="checkbox" checked={gateEnabled} onChange={(e) => setGateEnabled(e.target.checked)} className="h-4 w-4" data-testid="toggle-page-gate" />
            </label>
            <p className="text-[11px] text-white/40">When on: anonymous visitors see the first 5 approved listings + an email-unlock banner. After they submit their email, the full list reveals. Admins always see everything.</p>
          </div>

          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
            <Button variant="outline" className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={async () => {
              if (!window.confirm(`Delete page "${slug}"? This cannot be undone.`)) return;
              try {
                await apiRequest("DELETE", `/api/admin/pages/${slug}`);
                qc.invalidateQueries({ queryKey: ["/api/admin/pages"] });
                toast({ title: "Deleted" });
                onDeleted();
              } catch (err) {
                toast({ title: "Delete failed", description: String((err as Error).message || err), variant: "destructive" });
              }
            }} data-testid="button-delete-page-from-editor">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete page
            </Button>
          </div>
        </aside>
      </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  PAGE SUBMISSIONS SUB-VIEW (review queue)                  */
/* ─────────────────────────────────────────────────────────── */
interface PageSubmissionRow {
  id: number;
  pageId: number;
  submitterEmail: string;
  submitterName: string | null;
  submitterRegion: string | null;
  eventDate: string;
  venueName: string;
  town: string;
  eventName: string | null;
  instagramHandle: string | null;
  learnMoreUrl: string | null;
  region: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string | null;
}

function PageSubmissionsView({ pageId, slug }: { pageId: number; slug: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ venueName: "", town: "", eventDate: "", eventName: "", instagramHandle: "", learnMoreUrl: "", region: "" });
  const [editBusy, setEditBusy] = useState(false);

  const { data: submissions = [], isLoading } = useQuery<PageSubmissionRow[]>({
    queryKey: ["/api/admin/pages", slug, "submissions", statusFilter],
    queryFn: async () => {
      const url = statusFilter === "all"
        ? `/api/admin/pages/${slug}/submissions`
        : `/api/admin/pages/${slug}/submissions?status=${statusFilter}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/landing-page-submissions/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/pages", slug, "submissions"] });
      toast({ title: "Updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  async function bulkStatus(status: string) {
    if (selectedIds.size === 0) return;
    try {
      const res = await apiRequest("POST", `/api/admin/landing-page-submissions/bulk-status`, {
        ids: Array.from(selectedIds), status,
      });
      const body = await res.json();
      toast({ title: `Updated ${body.updated}` });
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["/api/admin/pages", slug, "submissions"] });
    } catch (err) {
      toast({ title: "Bulk update failed", description: String((err as Error).message), variant: "destructive" });
    }
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} submission${selectedIds.size !== 1 ? "s" : ""}? Cannot be undone.`)) return;
    try {
      const res = await apiRequest("POST", `/api/admin/landing-page-submissions/bulk-delete`, {
        ids: Array.from(selectedIds),
      });
      const body = await res.json();
      toast({ title: `Deleted ${body.deleted}` });
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["/api/admin/pages", slug, "submissions"] });
    } catch (err) {
      toast({ title: "Bulk delete failed", description: String((err as Error).message), variant: "destructive" });
    }
  }

  function openEdit(s: PageSubmissionRow) {
    setEditingId(s.id);
    setEditForm({
      venueName: s.venueName,
      town: s.town,
      eventDate: s.eventDate,
      eventName: s.eventName || "",
      instagramHandle: s.instagramHandle || "",
      learnMoreUrl: s.learnMoreUrl || "",
      region: s.region || "",
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    setEditBusy(true);
    try {
      const res = await apiRequest("PATCH", `/api/admin/landing-page-submissions/${editingId}`, {
        venueName: editForm.venueName.trim(),
        town: editForm.town.trim(),
        eventDate: editForm.eventDate.trim(),
        eventName: editForm.eventName.trim() || null,
        instagramHandle: editForm.instagramHandle.trim() || null,
        learnMoreUrl: editForm.learnMoreUrl.trim() || null,
        region: editForm.region.trim() || null,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Save failed");
      qc.invalidateQueries({ queryKey: ["/api/admin/pages", slug, "submissions"] });
      toast({ title: "Saved" });
      setEditingId(null);
    } catch (err) {
      toast({ title: "Save failed", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setEditBusy(false);
    }
  }

  const STATUS_FILTERS = ["pending", "approved", "rejected", "all"];

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground font-medium">Filter:</span>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${statusFilter === s ? "bg-primary border-primary text-white" : "border-white/10 text-white/40 hover:text-white/60"}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-primary/15 border border-primary/40 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-white font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-2 flex-wrap ml-auto">
            <Button size="sm" className="bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30" onClick={() => bulkStatus("approved")}>Approve all</Button>
            <Button size="sm" className="bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30" onClick={() => bulkStatus("rejected")}>Reject all</Button>
            <Button size="sm" variant="outline" className="border-red-500/30 text-red-400" onClick={bulkDelete}>Delete all</Button>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-white/40 hover:text-white">Clear</button>
          </div>
        </div>
      )}

      <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-3 border-b border-white/10 flex items-center gap-3">
          <input
            type="checkbox"
            checked={submissions.length > 0 && selectedIds.size === submissions.length}
            onChange={(e) => {
              if (e.target.checked) setSelectedIds(new Set(submissions.map((s) => s.id)));
              else setSelectedIds(new Set());
            }}
            className="h-4 w-4"
          />
          <span className="text-sm font-bold text-white">Submissions <span className="text-muted-foreground font-normal text-xs ml-2">({submissions.length})</span></span>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : submissions.length === 0 ? (
          <div className="py-10 px-6 text-center text-muted-foreground text-sm">No submissions match this filter.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {submissions.map((s) => (
              <div key={s.id} className="px-6 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={(e) => {
                        const next = new Set(selectedIds);
                        if (e.target.checked) next.add(s.id);
                        else next.delete(s.id);
                        setSelectedIds(next);
                      }}
                      className="h-4 w-4 mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-white">{s.venueName}</h3>
                        {s.eventName && <span className="text-sm text-white/50">— {s.eventName}</span>}
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          s.status === "approved" ? "border-green-500/40 text-green-400 bg-green-500/10" :
                          s.status === "rejected" ? "border-red-500/40 text-red-400 bg-red-500/10" :
                          "border-yellow-500/40 text-yellow-400 bg-yellow-500/10"
                        }`}>{s.status}</span>
                      </div>
                      <div className="text-sm text-white/70 space-y-0.5 min-w-0">
                        <p className="break-words">📍 {s.town}, NJ · 📅 {s.eventDate}</p>
                        <p className="text-xs text-white/50 break-all">
                          {s.submitterName && <>{s.submitterName} · </>}
                          <a href={`mailto:${s.submitterEmail}`} className="text-primary hover:underline">{s.submitterEmail}</a>
                          {s.instagramHandle && <> · @{s.instagramHandle.replace("@", "")}</>}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => openEdit(s)} className="border-white/15 text-white/70">
                      <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                    </Button>
                    {s.status !== "approved" && (
                      <Button size="sm" onClick={() => updateStatus.mutate({ id: s.id, status: "approved" })} className="bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25">Approve</Button>
                    )}
                    {s.status !== "rejected" && (
                      <Button size="sm" onClick={() => updateStatus.mutate({ id: s.id, status: "rejected" })} className="bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25">Reject</Button>
                    )}
                    {s.status !== "pending" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: s.id, status: "pending" })} className="border-white/15 text-white/60">Reopen</Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={editingId !== null} onOpenChange={(o) => { if (!o) setEditingId(null); }}>
        <DialogContent className="bg-secondary border-white/10 text-white max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit submission</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Venue name *</Label>
              <Input value={editForm.venueName} onChange={(e) => setEditForm({ ...editForm, venueName: e.target.value })} className="bg-black/40 border-white/10 h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Town *</Label>
              <Input value={editForm.town} onChange={(e) => setEditForm({ ...editForm, town: e.target.value })} className="bg-black/40 border-white/10 h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Event date *</Label>
              <Input value={editForm.eventDate} onChange={(e) => setEditForm({ ...editForm, eventDate: e.target.value })} className="bg-black/40 border-white/10 h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Event name</Label>
              <Input value={editForm.eventName} onChange={(e) => setEditForm({ ...editForm, eventName: e.target.value })} className="bg-black/40 border-white/10 h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Instagram</Label>
              <Input value={editForm.instagramHandle} onChange={(e) => setEditForm({ ...editForm, instagramHandle: e.target.value })} placeholder="@venue" className="bg-black/40 border-white/10 h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Learn-more URL</Label>
              <Input value={editForm.learnMoreUrl} onChange={(e) => setEditForm({ ...editForm, learnMoreUrl: e.target.value })} className="bg-black/40 border-white/10 h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/70">Region override</Label>
              <Select value={editForm.region} onValueChange={(v) => setEditForm({ ...editForm, region: v })}>
                <SelectTrigger className="bg-black/40 border-white/10 h-10"><SelectValue placeholder="Auto-derive from town" /></SelectTrigger>
                <SelectContent className="bg-secondary border-white/10 text-white">
                  <SelectItem value="">Auto-derive from town</SelectItem>
                  <SelectItem value="North NJ">North NJ</SelectItem>
                  <SelectItem value="Central NJ">Central NJ</SelectItem>
                  <SelectItem value="South NJ">South NJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingId(null)} className="border-white/20 text-white/70">Cancel</Button>
            <Button onClick={saveEdit} disabled={editBusy} className="bg-primary hover:bg-primary/90">
              {editBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
export default function Admin() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("events");
  const [showForm, setShowForm] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [form, setForm] = useState<EventForm>(emptyEventForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof EventForm, string>>>({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState<"input" | "mapping">("input");
  const [importActiveTab, setImportActiveTab] = useState<"file" | "paste">("file");
  const [importRawHeaders, setImportRawHeaders] = useState<string[]>([]);
  const [importRawRows, setImportRawRows] = useState<string[][]>([]);
  const [importMapping, setImportMapping] = useState<Record<string, string>>({});
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{
    imported: number;
    duplicates: { title: string; existingId: number; existingDate: string }[];
    invalid: { rowIndex: number; title: string; reason: string }[];
  } | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [weekAnchor, setWeekAnchor] = useState<string>(getUpcomingMondayIso());
  const [genreIsOther, setGenreIsOther] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<number>>(new Set());
  const [lastClickedEventIndex, setLastClickedEventIndex] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [inlineEdit, setInlineEdit] = useState<{ id: number; field: string; value: string } | null>(null);
  const [inlineSaved, setInlineSaved] = useState<{ id: number; field: string } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Image upload modal state — works for both single-event (imageEventId set) and bulk (imageEventId = "bulk").
  const [imageTarget, setImageTarget] = useState<number | "bulk" | null>(null);
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const imageFileRef = useRef<HTMLInputElement>(null);

  async function uploadImageFile(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form, credentials: "include" });
    if (!res.ok) throw new Error("Upload failed");
    const body = await res.json();
    return body.url as string;
  }

  async function applyImageToEvents(imageUrl: string, target: number | "bulk") {
    setImageBusy(true);
    try {
      if (target === "bulk") {
        const ids = Array.from(selectedEventIds);
        const res = await apiRequest("POST", "/api/events/bulk-image", { ids, imageUrl });
        const body = await res.json();
        // Empty imageUrl in the response = rehost failed (expired IG token,
        // non-image content-type, etc.) — server returns "" so we save nothing.
        if (!body.imageUrl && imageUrl) {
          toast({
            title: "Image couldn't be saved",
            description: "The URL likely expired or isn't an image. Right-click the Instagram image and pick 'Copy image address' for a fresh URL.",
            variant: "destructive",
          });
          return;
        }
        toast({ title: `Updated ${body.updated} event${body.updated !== 1 ? "s" : ""}` });
      } else {
        const res = await apiRequest("PUT", `/api/events/${target}`, { imageUrl });
        const updated = await res.json();
        if (!updated.imageUrl && imageUrl) {
          toast({
            title: "Image couldn't be saved",
            description: "The URL likely expired or isn't an image. Right-click the Instagram image and pick 'Copy image address' for a fresh URL.",
            variant: "destructive",
          });
          return;
        }
        toast({ title: "Image updated" });
      }
      await qc.invalidateQueries({ queryKey: ["/api/events"] });
      setImageTarget(null);
      setImageUrlInput("");
      setImageMode("upload");
    } catch (err) {
      toast({ title: "Failed to update image", description: String((err as Error).message || err), variant: "destructive" });
    } finally {
      setImageBusy(false);
    }
  }

  async function handleImageSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (imageTarget === null) return;
    if (imageMode === "url") {
      const url = imageUrlInput.trim();
      if (!url) { toast({ title: "Paste an image URL first", variant: "destructive" }); return; }
      await applyImageToEvents(url, imageTarget);
    } else {
      const file = imageFileRef.current?.files?.[0];
      if (!file) { toast({ title: "Choose a file first", variant: "destructive" }); return; }
      setImageBusy(true);
      try {
        const url = await uploadImageFile(file);
        await applyImageToEvents(url, imageTarget);
      } catch (err) {
        toast({ title: "Upload failed", description: String((err as Error).message || err), variant: "destructive" });
      } finally {
        setImageBusy(false);
      }
    }
  }

  const { toast } = useToast();
  const qc = useQueryClient();

  /* On mount: restore session via /api/admin/me */
  useEffect(() => {
    fetch("/api/admin/me", { credentials: "include" })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data: AdminUser | null) => {
        if (data && data.email) setUser(data);
      })
      .catch(() => {})
      .finally(() => setSessionChecked(true));
  }, []);

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    queryFn: async () => {
      // Admins see all events (past + future) so they can verify what they
      // uploaded. The server gates `?all=1` on the admin JWT cookie.
      const res = await fetch("/api/events?all=1", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: !!user,
  });

  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>("All");
  const [bookingSearch, setBookingSearch] = useState<string>("");
  const [bookingSortDir, setBookingSortDir] = useState<"desc" | "asc">("desc");
  const [selectedBookingIds, setSelectedBookingIds] = useState<Set<number>>(new Set());
  const [showBookingDeleteConfirm, setShowBookingDeleteConfirm] = useState(false);
  const [expandedBookingId, setExpandedBookingId] = useState<number | null>(null);

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ["/api/admin/bookings"],
    enabled: !!user && activeTab === "bookings",
  });

  const updateBookingStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/bookings/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
    },
    onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
  });

  const updateBookingNotesMutation = useMutation({
    mutationFn: async ({ id, adminNotes }: { id: number; adminNotes: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/bookings/${id}/notes`, { adminNotes });
      return res.json();
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      setBookingNotesDraft((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast({ title: "Notes saved" });
    },
    onError: () => toast({ title: "Failed to save notes", variant: "destructive" }),
  });

  const batchDeleteBookingsMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await apiRequest("DELETE", "/api/admin/bookings/batch", { ids });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      setSelectedBookingIds(new Set());
      setShowBookingDeleteConfirm(false);
      toast({ title: "Bookings deleted" });
    },
    onError: () => toast({ title: "Failed to delete bookings", variant: "destructive" }),
  });

  const bulkUpdateBookingStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: number[]; status: string }) => {
      const res = await apiRequest("PATCH", "/api/admin/bookings/batch/status", { ids, status });
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      setSelectedBookingIds(new Set());
      toast({ title: `Updated ${data.updated} booking${data.updated !== 1 ? "s" : ""}` });
    },
    onError: () => toast({ title: "Failed to update bookings", variant: "destructive" }),
  });

  const [bookingNotesDraft, setBookingNotesDraft] = useState<Record<number, string>>({});

  const createMutation = useMutation({
    mutationFn: async (data: EventForm) => {
      const res = await apiRequest("POST", "/api/events", {
        title: data.title,
        date: data.date,
        region: data.region,
        eventTime: data.eventTime || null,
        venue: data.venue || null,
        city: data.city || null,
        instagramHandle: data.instagramHandle || null,
        organizer: data.organizer || null,
        influencer: data.influencer || null,
        genre: data.genre || null,
        ticketLink: data.ticketLink || null,
        imageUrl: data.imageUrl || "",
        description: data.city ? `Live event in ${data.city}, NJ` : "CGE Event",
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      setShowEventModal(false);
      setEditingEvent(null);
      setForm(emptyEventForm);
      toast({ title: "Event created" });
    },
    onError: () => toast({ title: "Failed to create event", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<EventForm> }) => {
      const res = await apiRequest("PUT", `/api/events/${id}`, {
        title: data.title,
        date: data.date,
        region: data.region,
        eventTime: data.eventTime ?? null,
        venue: data.venue ?? null,
        city: data.city ?? null,
        instagramHandle: data.instagramHandle ?? null,
        organizer: data.organizer ?? null,
        influencer: data.influencer ?? null,
        genre: data.genre ?? null,
        ticketLink: data.ticketLink ?? null,
        imageUrl: data.imageUrl ?? "",
        description: data.city ? `Live event in ${data.city}, NJ` : "CGE Event",
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      setShowEventModal(false);
      setEditingEvent(null);
      setForm(emptyEventForm);
      toast({ title: "Event updated" });
    },
    onError: () => toast({ title: "Failed to update event", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/events/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Event deleted" });
    },
    onError: () => toast({ title: "Failed to delete event", variant: "destructive" }),
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: async ({ id, isFeatured }: { id: number; isFeatured: boolean }) => {
      const res = await apiRequest("PATCH", `/api/events/${id}/featured`, { isFeatured });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: () => toast({ title: "Failed to toggle featured", variant: "destructive" }),
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await apiRequest("DELETE", "/api/events/batch", { ids });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      setSelectedEventIds(new Set());
      setShowDeleteConfirm(false);
      toast({ title: "Events deleted" });
    },
    onError: () => toast({ title: "Failed to delete events", variant: "destructive" }),
  });

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    setUser(null);
    setSessionChecked(true);
  }

  function openAdd() {
    setEditingEvent(null);
    setForm(emptyEventForm);
    setFormErrors({});
    setGenreIsOther(false);
    setShowEventModal(true);
  }

  function openEdit(event: Event) {
    setEditingEvent(event);
    const currentGenre = event.genre || "";
    const isOther = !!currentGenre && !GENRE_OPTIONS.slice(0, -1).includes(currentGenre);
    setGenreIsOther(isOther);
    setForm({
      title: event.title,
      date: event.date,
      eventTime: event.eventTime || "",
      venue: event.venue || "",
      city: event.city || "",
      region: event.region,
      instagramHandle: event.instagramHandle || "",
      organizer: event.organizer || "",
      influencer: event.influencer || "",
      genre: currentGenre,
      ticketLink: event.ticketLink || "",
      imageUrl: event.imageUrl || "",
    });
    setFormErrors({});
    setShowEventModal(true);
  }

  function resetForm() {
    setShowForm(false);
    setShowEventModal(false);
    setEditingEvent(null);
    setForm(emptyEventForm);
    setFormErrors({});
    setGenreIsOther(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors: Partial<Record<keyof EventForm, string>> = {};
    if (!form.title.trim()) errors.title = "Event name is required";
    if (!form.region) errors.region = "Region is required";
    if (!form.date) errors.date = "Date is required";
    if (!form.eventTime) errors.eventTime = "Time is required";
    if (!form.venue.trim()) errors.venue = "Venue is required";
    if (!form.city.trim()) errors.city = "City is required";
    if (!form.instagramHandle.trim()) errors.instagramHandle = "Instagram handle is required";
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  async function saveInlineEdit() {
    if (!inlineEdit) return;
    try {
      await apiRequest("PUT", `/api/events/${inlineEdit.id}`, {
        [inlineEdit.field]: inlineEdit.value || null,
      });
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      setInlineSaved({ id: inlineEdit.id, field: inlineEdit.field });
      setTimeout(() => setInlineSaved(null), 2000);
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
    setInlineEdit(null);
  }

  // ── Import modal helpers ─────────────────────────────────────────────

  const CGE_IMPORT_FIELDS: { key: string; label: string; required: boolean }[] = [
    { key: "name",            label: "Name",             required: true },
    { key: "date",            label: "Date",             required: false },
    { key: "day",             label: "Day of Week",      required: false },
    { key: "time",            label: "Time",             required: false },
    { key: "venue",           label: "Venue",            required: false },
    { key: "city",            label: "City",             required: false },
    { key: "region",          label: "Region",           required: false },
    { key: "organizer",       label: "Organizer",        required: false },
    { key: "influencer",      label: "Influencer",       required: false },
    { key: "genre",           label: "Genre",            required: false },
    { key: "instagramHandle", label: "Instagram Handle", required: false },
    { key: "ticketLink",      label: "Ticket Link",      required: false },
    { key: "imageUrl",        label: "Image URL",        required: false },
  ];

  const IMPORT_ALIASES: Record<string, string[]> = {
    name:            ["name", "title", "event", "event name"],
    date:            ["date", "event date", "event_date"],
    day:             ["day", "weekday", "day of week", "dow"],
    time:            ["time", "event time", "start time", "start_time"],
    venue:           ["venue", "location", "place"],
    city:            ["city", "town", "area"],
    region:          ["region"],
    organizer:       ["organizer", "host", "promoter"],
    influencer:      ["influencer"],
    genre:           ["genre", "type", "music type", "category"],
    instagramHandle: ["instagram", "ig", "handle", "insta", "instagramhandle"],
    ticketLink:      ["ticket link", "ticketlink", "ticket", "tickets", "url", "link"],
    imageUrl:        ["image", "image url", "imageurl", "image_url", "media", "media url", "mediaurl", "thumbnail", "thumb", "pic", "picture", "photo", "flyer", "img", "display", "display image", "display_image", "displayimage", "display url", "displayurl"],
  };

  function autoMatchHeader(headers: string[], cgeKey: string): string {
    const aliases = IMPORT_ALIASES[cgeKey] || [cgeKey];
    return headers.find(h =>
      aliases.some(a => h.toLowerCase().includes(a.toLowerCase()))
    ) || "";
  }

  function buildInitialMapping(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    for (const { key } of CGE_IMPORT_FIELDS) {
      mapping[key] = autoMatchHeader(headers, key);
    }
    return mapping;
  }

  function parsePasteData(text: string): { headers: string[]; rows: string[][] } | null {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return null;
    const sep = lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ""));
    const rows = lines.slice(1).map(l =>
      l.split(sep).map(c => c.trim().replace(/^"|"$/g, ""))
    );
    return { headers, rows };
  }

  function handleCsvFile(file: File) {
    setImportErrors([]);
    setImportResult(null);

    const isExcel = /\.(xlsx|xls)$/i.test(file.name) ||
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.type === "application/vnd.ms-excel";

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const allRows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as string[][];
          const nonEmpty = allRows.filter(r => r.some(c => String(c).trim() !== ""));
          if (nonEmpty.length < 2) {
            setImportErrors(["Spreadsheet appears to be empty or has only headers."]);
            return;
          }
          const headers = nonEmpty[0].map(h => String(h).trim());
          const dataRows = nonEmpty.slice(1).map(row => row.map(c => String(c).trim()));
          setImportRawHeaders(headers);
          setImportRawRows(dataRows);
          setImportMapping(buildInitialMapping(headers));
          setImportStep("mapping");
        } catch {
          setImportErrors(["Could not read the spreadsheet file. Make sure it's a valid .xlsx or .xls file."]);
        }
      };
      reader.onerror = () => setImportErrors(["Failed to read the file."]);
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse<string[]>(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const allRows = results.data as string[][];
          if (allRows.length < 2) {
            setImportErrors(["File appears to be empty or has only headers."]);
            return;
          }
          const headers = allRows[0].map(h => h.trim());
          const dataRows = allRows.slice(1);
          setImportRawHeaders(headers);
          setImportRawRows(dataRows);
          setImportMapping(buildInitialMapping(headers));
          setImportStep("mapping");
        },
        error: (err: Error) => setImportErrors([err.message]),
      });
    }
  }

  function handlePasteConfirm() {
    const parsed = parsePasteData(pasteText);
    if (!parsed) {
      setImportErrors(["Could not parse pasted data. Make sure the first row is headers and rows are comma- or tab-separated."]);
      return;
    }
    setImportErrors([]);
    setImportRawHeaders(parsed.headers);
    setImportRawRows(parsed.rows);
    setImportMapping(buildInitialMapping(parsed.headers));
    setImportStep("mapping");
  }

  async function submitMappedImport() {
    const mapped: Record<string, string>[] = importRawRows.map(row => {
      const obj: Record<string, string> = {};
      for (const { key } of CGE_IMPORT_FIELDS) {
        const col = importMapping[key];
        if (col) {
          const colIdx = importRawHeaders.indexOf(col);
          obj[key] = colIdx >= 0 ? (row[colIdx] || "") : "";
        }
      }
      if (obj.date) {
        obj.date = normalizeEventDate(obj.date);
      } else if (obj.day) {
        obj.date = resolveDayToIsoDate(obj.day, weekAnchor);
      }
      delete obj.day;
      return obj;
    });
    try {
      const res = await apiRequest("POST", "/api/events/bulk-import", mapped);
      const data = await res.json();
      // Tolerate the old `{imported, skipped}` server response shape during a deploy
      // window where the server might still be running pre-update code.
      setImportResult({
        imported: data.imported ?? 0,
        duplicates: Array.isArray(data.duplicates) ? data.duplicates : [],
        invalid: Array.isArray(data.invalid) ? data.invalid : [],
      });
      qc.invalidateQueries({ queryKey: ["/api/events"] });
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    }
  }

  function resetImportModal() {
    setImportStep("input");
    setImportActiveTab("file");
    setImportRawHeaders([]);
    setImportRawRows([]);
    setImportMapping({});
    setImportErrors([]);
    setImportResult(null);
    setPasteText("");
  }

  function downloadCsvTemplate() {
    const headers = "name,date,time,venue,city,region,organizer,influencer,genre,instagramHandle,ticketLink,imageUrl";
    const blob = new Blob([headers + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "events-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  /* Show nothing until session check completes */
  if (!sessionChecked) return null;

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <SEO title="Admin Dashboard" description="" canonical="https://www.centralgroupevents.com/admin" noindex />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 min-w-0 overflow-x-hidden">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img src={cgeLogo} alt="CGE" className="h-9 w-auto object-contain" />
            <div>
              <h1 className="text-xl font-black text-white leading-none">CGE Dashboard</h1>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">{user.role} · {user.email}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="border-white/20 hover:bg-white/10 text-white/70"
            data-testid="button-admin-logout"
          >
            <LogOut className="w-4 h-4 mr-1.5" /> Logout
          </Button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 mb-8 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              data-testid={`admin-tab-${id}`}
              onClick={() => { setActiveTab(id); if (id !== "events") resetForm(); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                activeTab === id
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* EVENTS TAB */}
        {activeTab === "events" && (
          <>
            {/* Header row */}
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-white">Events <span className="text-muted-foreground font-normal text-sm ml-1">({events.length} total)</span></h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { resetImportModal(); setShowImportModal(true); }} className="border-white/20 hover:bg-white/10 text-white/70" data-testid="button-import-csv">
                  <Upload className="w-4 h-4 mr-1.5" /> Import CSV
                </Button>
                <Button onClick={openAdd} className="bg-primary hover:bg-primary/90 font-semibold" data-testid="button-add-event">
                  <Plus className="w-4 h-4 mr-1" /> Add New Event
                </Button>
              </div>
            </div>

            {/* Batch action bar */}
            {selectedEventIds.size > 0 && (
              <div className="flex items-center gap-3 mb-3 bg-primary/10 border border-primary/30 rounded-xl px-4 py-2.5 flex-wrap">
                <span className="text-sm text-white font-medium">{selectedEventIds.size} event{selectedEventIds.size !== 1 ? "s" : ""} selected</span>
                <div className="flex gap-2 ml-auto flex-wrap">
                  <Button
                    size="sm"
                    onClick={() => { setImageMode("upload"); setImageUrlInput(""); setImageTarget("bulk"); }}
                    className="bg-blue-500/20 border border-blue-500/40 text-blue-300 hover:bg-blue-500/30"
                    data-testid="button-apply-image-selected-events"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" /> Apply Image
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                    data-testid="button-delete-selected-events"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Selected ({selectedEventIds.size})
                  </Button>
                </div>
                <button
                  onClick={() => setSelectedEventIds(new Set())}
                  className="text-white/40 hover:text-white/70 transition-colors text-xs"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Scrollable table */}
            <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
              {isLoading ? (
                <div className="flex justify-center items-center h-40 text-muted-foreground">Loading…</div>
              ) : events.length === 0 ? (
                <div className="flex justify-center items-center h-40 text-muted-foreground">No events yet. Add one above.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="text-sm" style={{ minWidth: "1100px", width: "100%" }}>
                    <thead>
                      <tr className="border-b border-white/10 text-muted-foreground text-left bg-secondary/60">
                        <th className="px-3 py-3 w-8">
                          <input
                            type="checkbox"
                            className="accent-primary cursor-pointer"
                            checked={selectedEventIds.size === events.length && events.length > 0}
                            onChange={(e) => setSelectedEventIds(e.target.checked ? new Set(events.map(ev => ev.id)) : new Set())}
                            data-testid="checkbox-select-all-events"
                            title="Select all"
                          />
                        </th>
                        <th className="px-4 py-3 font-medium whitespace-nowrap sticky left-0 z-10 bg-[#1a1a2e] min-w-[200px]">Name of Event</th>
                        <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[160px]">Day of Event</th>
                        <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[100px]">Time</th>
                        <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[140px]">Venue</th>
                        <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[120px]">City</th>
                        <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[110px]">Region</th>
                        <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[130px]">Organizer</th>
                        <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[130px]">Influencer</th>
                        <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[110px]">Genre</th>
                        <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[140px]">Instagram</th>
                        <th className="px-4 py-3 font-medium whitespace-nowrap text-right min-w-[100px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((event, i) => {
                        const rowBg = i % 2 !== 0 ? "bg-white/[0.02]" : "";
                        const stickyBg = i % 2 !== 0 ? "bg-[#161624]" : "bg-[#111120]";

                        function InlineCell({ field, value, displayValue, placeholder }: { field: string; value: string | null; displayValue?: string; placeholder?: string }) {
                          const isEditing = inlineEdit?.id === event.id && inlineEdit?.field === field;
                          const isSaved = inlineSaved?.id === event.id && inlineSaved?.field === field;
                          if (isEditing) {
                            return (
                              <Input
                                autoFocus
                                value={inlineEdit.value}
                                onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                onBlur={saveInlineEdit}
                                onKeyDown={(e) => { if (e.key === "Enter") saveInlineEdit(); if (e.key === "Escape") setInlineEdit(null); }}
                                className="bg-black/60 border-primary/50 h-7 text-xs px-2 w-full min-w-[100px]"
                              />
                            );
                          }
                          const shownText = displayValue ?? value;
                          return (
                            <span
                              className="cursor-pointer hover:bg-white/10 rounded px-1 py-0.5 transition-colors flex items-center gap-1 group"
                              onClick={(e) => { e.stopPropagation(); setInlineEdit({ id: event.id, field, value: value || "" }); }}
                              title="Click to edit"
                            >
                              {isSaved && <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />}
                              <span className={shownText ? "text-white" : "text-white/20 italic"}>{shownText || (placeholder || "—")}</span>
                              <Pencil className="w-2.5 h-2.5 text-white/20 group-hover:text-white/50 ml-auto flex-shrink-0" />
                            </span>
                          );
                        }

                        const isRowSelected = selectedEventIds.has(event.id);
                        const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
                          // Skip if click landed on any interactive element — preserves inline editing,
                          // edit/delete buttons, featured toggle, and links.
                          const target = e.target as HTMLElement;
                          if (target.closest('input, button, a, textarea, [contenteditable="true"]')) return;
                          const next = new Set(selectedEventIds);
                          if (e.shiftKey && lastClickedEventIndex !== null) {
                            // Range select: include every row between last-clicked and current
                            const lo = Math.min(lastClickedEventIndex, i);
                            const hi = Math.max(lastClickedEventIndex, i);
                            for (let j = lo; j <= hi; j++) {
                              const idAtJ = events[j]?.id;
                              if (idAtJ !== undefined) next.add(idAtJ);
                            }
                          } else if (e.metaKey || e.ctrlKey) {
                            // Toggle a single row without disturbing others
                            if (next.has(event.id)) next.delete(event.id);
                            else next.add(event.id);
                          } else {
                            // Plain click: toggle just this row
                            if (next.has(event.id)) next.delete(event.id);
                            else next.add(event.id);
                          }
                          setSelectedEventIds(next);
                          setLastClickedEventIndex(i);
                        };
                        return (
                          <tr
                            key={event.id}
                            onClick={handleRowClick}
                            className={`border-b border-white/5 cursor-pointer transition-colors ${
                              isRowSelected
                                ? "bg-primary/10 hover:bg-primary/15 border-l-2 border-l-primary"
                                : `hover:bg-white/5 ${rowBg}`
                            }`}
                            data-testid={`row-event-${event.id}`}
                          >
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                className="accent-primary cursor-pointer"
                                checked={selectedEventIds.has(event.id)}
                                onChange={(e) => {
                                  const next = new Set(selectedEventIds);
                                  if (e.target.checked) next.add(event.id);
                                  else next.delete(event.id);
                                  setSelectedEventIds(next);
                                }}
                                data-testid={`checkbox-event-${event.id}`}
                              />
                            </td>
                            <td className={`px-4 py-3 font-medium sticky left-0 z-10 ${stickyBg}`}>
                              <InlineCell field="title" value={event.title} />
                            </td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatEventDate(event.date)}</td>
                            <td className="px-4 py-3">
                              <InlineCell field="eventTime" value={event.eventTime} displayValue={event.eventTime ? formatEventTime(event.eventTime) : undefined} placeholder="add time" />
                            </td>
                            <td className="px-4 py-3">
                              <InlineCell field="venue" value={event.venue} placeholder="add venue" />
                            </td>
                            <td className="px-4 py-3">
                              <InlineCell field="city" value={event.city} placeholder="add city" />
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs border border-primary/30 text-primary bg-primary/10 whitespace-nowrap">{event.region}</span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{event.organizer || <span className="text-white/20">—</span>}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{event.influencer || <span className="text-white/20">—</span>}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{event.genre || <span className="text-white/20">—</span>}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{event.instagramHandle || <span className="text-white/20">—</span>}</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <button
                                onClick={() => toggleFeaturedMutation.mutate({ id: event.id, isFeatured: !event.isFeatured })}
                                className={`inline-flex items-center justify-center w-7 h-7 rounded transition-colors mr-1 ${
                                  event.isFeatured
                                    ? "bg-primary/20 text-primary hover:bg-primary/30"
                                    : "hover:bg-white/10 text-white/30 hover:text-white/70"
                                }`}
                                title={event.isFeatured ? "Unfeature on This Week page" : "Feature on This Week page"}
                                data-testid={`button-feature-event-${event.id}`}
                              >
                                <Star className={`w-3.5 h-3.5 ${event.isFeatured ? "fill-current" : ""}`} />
                              </button>
                              <button
                                onClick={() => { setImageMode(event.imageUrl ? "url" : "upload"); setImageUrlInput(event.imageUrl || ""); setImageTarget(event.id); }}
                                className={`inline-flex items-center justify-center w-7 h-7 rounded transition-colors mr-1 ${event.imageUrl ? "text-primary/70 hover:text-primary hover:bg-primary/10" : "text-white/30 hover:text-white/70 hover:bg-white/10"}`}
                                title={event.imageUrl ? "Replace image" : "Add image"}
                                data-testid={`button-image-event-${event.id}`}
                              >
                                {event.imageUrl ? (
                                  <img src={event.imageUrl} alt="" className="w-5 h-5 rounded object-cover" />
                                ) : (
                                  <Upload className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button onClick={() => openEdit(event)} className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors mr-1" title="Edit" data-testid={`button-edit-event-${event.id}`}>
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => { if (window.confirm(`Delete "${event.title}"?`)) deleteMutation.mutate(event.id); }}
                                className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-red-500/20 text-red-400/50 hover:text-red-400 transition-colors"
                                title="Delete"
                                data-testid={`button-delete-event-${event.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Add / Edit Event Modal */}
            <Dialog open={showEventModal} onOpenChange={(open) => { if (!open) resetForm(); }}>
              <DialogContent className="bg-secondary border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingEvent ? `Edit: ${editingEvent.title}` : "Add New Event"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                  {/* Required fields */}
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-white/80">Name of Event <span className="text-red-400">*</span></Label>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. JAZZY FRIDAYS" className="bg-black/40 border-white/10 h-11" data-testid="input-event-title" />
                    {formErrors.title && <p className="text-red-400 text-xs">{formErrors.title}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80">Region <span className="text-red-400">*</span></Label>
                    <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
                      <SelectTrigger className="bg-black/40 border-white/10 h-11"><SelectValue placeholder="Select region" /></SelectTrigger>
                      <SelectContent className="bg-secondary border-white/10 text-white">
                        <SelectItem value="North NJ">North NJ</SelectItem>
                        <SelectItem value="Central NJ">Central NJ</SelectItem>
                        <SelectItem value="South NJ">South NJ</SelectItem>
                      </SelectContent>
                    </Select>
                    {formErrors.region && <p className="text-red-400 text-xs">{formErrors.region}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80">Day of Event <span className="text-red-400">*</span></Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-black/40 border-white/10 h-11" data-testid="input-event-date" />
                    {formErrors.date && <p className="text-red-400 text-xs">{formErrors.date}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80">Time of Event <span className="text-red-400">*</span></Label>
                    <Input type="time" value={form.eventTime} onChange={(e) => setForm({ ...form, eventTime: e.target.value })} className="bg-black/40 border-white/10 h-11" data-testid="input-event-time" />
                    {formErrors.eventTime && <p className="text-red-400 text-xs">{formErrors.eventTime}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80">Venue <span className="text-red-400">*</span></Label>
                    <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="e.g. Club Nova" className="bg-black/40 border-white/10 h-11" data-testid="input-event-venue" />
                    {formErrors.venue && <p className="text-red-400 text-xs">{formErrors.venue}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80">City <span className="text-red-400">*</span></Label>
                    <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Fort Lee" className="bg-black/40 border-white/10 h-11" data-testid="input-event-city" />
                    {formErrors.city && <p className="text-red-400 text-xs">{formErrors.city}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80">Instagram Handle <span className="text-red-400">*</span></Label>
                    <Input value={form.instagramHandle} onChange={(e) => setForm({ ...form, instagramHandle: e.target.value })} placeholder="@handle" className="bg-black/40 border-white/10 h-11" data-testid="input-event-instagram" />
                    {formErrors.instagramHandle && <p className="text-red-400 text-xs">{formErrors.instagramHandle}</p>}
                  </div>
                  {/* Optional fields */}
                  <div className="space-y-1">
                    <Label className="text-white/80">Organizer</Label>
                    <Input value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })} placeholder="Optional" className="bg-black/40 border-white/10 h-11" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80">Influencer</Label>
                    <Input value={form.influencer} onChange={(e) => setForm({ ...form, influencer: e.target.value })} placeholder="Optional" className="bg-black/40 border-white/10 h-11" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80">Genre</Label>
                    <Select
                      value={genreIsOther ? "Other" : form.genre}
                      onValueChange={(v) => {
                        if (v !== "Other") {
                          setGenreIsOther(false);
                          setForm({ ...form, genre: v });
                        } else {
                          setGenreIsOther(true);
                          setForm({ ...form, genre: "" });
                        }
                      }}
                    >
                      <SelectTrigger className="bg-black/40 border-white/10 h-11" data-testid="select-event-genre">
                        <SelectValue placeholder="Select genre (optional)" />
                      </SelectTrigger>
                      <SelectContent className="bg-secondary border-white/10 text-white">
                        {GENRE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {genreIsOther && (
                      <Input
                        value={form.genre}
                        onChange={(e) => setForm({ ...form, genre: e.target.value })}
                        placeholder="Describe genre (e.g. Afrobeats, Hip-Hop)"
                        className="bg-black/40 border-white/10 h-11 mt-1"
                        autoFocus
                        data-testid="input-event-genre-other"
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80">Ticket Link</Label>
                    <Input value={form.ticketLink} onChange={(e) => setForm({ ...form, ticketLink: e.target.value })} placeholder="https://..." className="bg-black/40 border-white/10 h-11" />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-white/80">Image URL</Label>
                    <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." className="bg-black/40 border-white/10 h-11" />
                  </div>
                  <div className="sm:col-span-2 flex gap-3 pt-2">
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-primary hover:bg-primary/90 font-semibold px-8">
                      {(createMutation.isPending || updateMutation.isPending) ? "Saving…" : editingEvent ? "Save Changes" : "Create Event"}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm} className="border-white/20 hover:bg-white/10 text-white/70">Cancel</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Import Events Modal */}
            <Dialog open={showImportModal} onOpenChange={(open) => { if (!open) { setShowImportModal(false); resetImportModal(); } }}>
              <DialogContent className="bg-secondary border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Import Events</DialogTitle>
                </DialogHeader>

                {importStep === "input" && (
                  <div className="space-y-4 py-2">
                    {/* Tab bar */}
                    <div className="flex gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
                      {(["file", "paste"] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => { setImportActiveTab(t); setImportErrors([]); }}
                          className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${importActiveTab === t ? "bg-primary text-white" : "text-muted-foreground hover:text-white"}`}
                          data-testid={`import-tab-${t}`}
                        >
                          {t === "file" ? "Upload File" : "Paste Data"}
                        </button>
                      ))}
                    </div>

                    {importActiveTab === "file" ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">Upload a CSV or Excel file. You'll map columns in the next step.</p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={downloadCsvTemplate} className="border-white/20 hover:bg-white/10 text-white/70">
                            <Download className="w-3.5 h-3.5 mr-1.5" /> Download Template
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => csvInputRef.current?.click()} className="border-white/20 hover:bg-white/10 text-white/70" data-testid="button-choose-csv">
                            <Upload className="w-3.5 h-3.5 mr-1.5" /> Choose File
                          </Button>
                          <input
                            ref={csvInputRef}
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); e.target.value = ""; }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">Paste rows from Google Sheets or Excel. First row must be column headers. Supports tab-separated or comma-separated.</p>
                        <Textarea
                          value={pasteText}
                          onChange={(e) => setPasteText(e.target.value)}
                          placeholder={"Name\tDate\tVenue\nJazzy Fridays\t2026-07-15\tClub Nova"}
                          className="bg-black/40 border-white/10 text-xs font-mono min-h-[140px]"
                          data-testid="textarea-import-paste"
                        />
                        <Button
                          onClick={handlePasteConfirm}
                          disabled={!pasteText.trim()}
                          className="bg-primary hover:bg-primary/90"
                          data-testid="button-parse-paste"
                        >
                          Parse & Map Columns
                        </Button>
                      </div>
                    )}

                    {importErrors.length > 0 && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-1">
                        {importErrors.map((err, i) => <p key={i} className="text-red-400 text-xs">{err}</p>)}
                      </div>
                    )}
                  </div>
                )}

                {importStep === "mapping" && !importResult && (
                  <div className="space-y-4 py-2">
                    <p className="text-sm text-muted-foreground">
                      Map your file's columns to CGE event fields. Required fields are marked <span className="text-red-400">*</span>.
                    </p>

                    {/* Mapping table */}
                    <div className="rounded-lg border border-white/10 overflow-hidden">
                      <table className="text-sm w-full">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/10 text-muted-foreground text-left">
                            <th className="px-3 py-2 font-medium w-1/2">CGE Field</th>
                            <th className="px-3 py-2 font-medium w-1/2">Your Column</th>
                          </tr>
                        </thead>
                        <tbody>
                          {CGE_IMPORT_FIELDS.map(({ key, label, required }) => (
                            <tr key={key} className="border-b border-white/5">
                              <td className="px-3 py-2 text-white/80">
                                {label}{required && <span className="text-red-400 ml-1">*</span>}
                              </td>
                              <td className="px-3 py-2">
                                <Select
                                  value={importMapping[key] || "__none__"}
                                  onValueChange={(v) => setImportMapping({ ...importMapping, [key]: v === "__none__" ? "" : v })}
                                >
                                  <SelectTrigger className="h-8 bg-black/40 border-white/10 text-xs" data-testid={`map-${key}`}>
                                    <SelectValue placeholder="— skip —" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-secondary border-white/10 text-white">
                                    <SelectItem value="__none__">— skip —</SelectItem>
                                    {importRawHeaders.filter(h => h && h.trim().length > 0).map(h => (
                                      <SelectItem key={h} value={h}>{h}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Week-anchor picker — shown when day is mapped but date isn't */}
                    {importMapping["day"] && !importMapping["date"] && (
                      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <Label className="text-xs text-white/80 sm:w-32 shrink-0">Week starting</Label>
                          <Input
                            type="date"
                            value={weekAnchor}
                            onChange={(e) => setWeekAnchor(e.target.value)}
                            className="h-8 bg-black/40 border-white/10 text-xs"
                            data-testid="input-week-anchor"
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Your file has weekday names instead of dates. Pick the Monday of the week these events fall in — we'll convert Mon/Tue/…/Sun into real dates.
                        </p>
                        {(() => {
                          const dayColIdx = importRawHeaders.indexOf(importMapping["day"]);
                          if (dayColIdx < 0) return null;
                          const preview = importRawRows.slice(0, 5).map((r, i) => {
                            const dayVal = r[dayColIdx] || "";
                            const resolved = resolveDayToIsoDate(dayVal, weekAnchor);
                            return { i, dayVal, resolved };
                          });
                          return (
                            <div className="text-[11px] text-white/70 space-y-0.5 pt-1">
                              <p className="text-muted-foreground">Resolved dates (first 5 rows):</p>
                              {preview.map(({ i, dayVal, resolved }) => (
                                <p key={i} className="font-mono">
                                  <span className="text-white/50">Row {i + 1}:</span> {dayVal || "—"} → <span className={resolved ? "text-primary" : "text-red-400"}>{resolved || "could not resolve"}</span>
                                </p>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* 3-row data preview */}
                    {importRawRows.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Preview (first 3 rows with current mapping):</p>
                        <div className="overflow-x-auto rounded-lg border border-white/10">
                          <table className="text-xs w-full">
                            <thead>
                              <tr className="bg-white/5 border-b border-white/10 text-muted-foreground">
                                {CGE_IMPORT_FIELDS.filter(f => importMapping[f.key]).map(f => (
                                  <th key={f.key} className="px-3 py-2 text-left font-medium whitespace-nowrap">{f.label}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {importRawRows.slice(0, 3).map((row, ri) => (
                                <tr key={ri} className="border-b border-white/5">
                                  {CGE_IMPORT_FIELDS.filter(f => importMapping[f.key]).map(f => {
                                    const colIdx = importRawHeaders.indexOf(importMapping[f.key]);
                                    return (
                                      <td key={f.key} className="px-3 py-2 text-white/80 whitespace-nowrap max-w-[160px] truncate">
                                        {colIdx >= 0 ? (row[colIdx] || "—") : "—"}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" onClick={() => { setImportStep("input"); setImportErrors([]); }} className="border-white/20 text-white/70">
                        Back
                      </Button>
                      <Button
                        onClick={submitMappedImport}
                        className="bg-primary hover:bg-primary/90 font-semibold"
                        disabled={!importMapping["name"] || (!importMapping["date"] && !importMapping["day"])}
                        data-testid="button-confirm-import"
                      >
                        Import {importRawRows.length} Row{importRawRows.length !== 1 ? "s" : ""}
                      </Button>
                    </div>
                  </div>
                )}

                {importResult && (
                  <div className="py-4 space-y-4">
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <p className="text-green-400 text-sm font-medium">
                        {importResult.imported} event{importResult.imported !== 1 ? "s" : ""} imported
                        {importResult.duplicates.length > 0 && `, ${importResult.duplicates.length} duplicate${importResult.duplicates.length !== 1 ? "s" : ""} skipped`}
                        {importResult.invalid.length > 0 && `, ${importResult.invalid.length} invalid row${importResult.invalid.length !== 1 ? "s" : ""} skipped`}
                      </p>
                    </div>

                    {importResult.duplicates.length > 0 && (
                      <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg overflow-hidden">
                        <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
                          <p className="text-yellow-300 text-xs font-semibold uppercase tracking-wider">
                            Duplicates skipped — matched an existing event with the same title + date
                          </p>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-black/30 sticky top-0">
                              <tr className="text-white/60 text-xs">
                                <th className="text-left px-4 py-2 font-medium">Title</th>
                                <th className="text-left px-4 py-2 font-medium">Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {importResult.duplicates.map((d, i) => (
                                <tr key={i} className="border-t border-white/5 text-white/80">
                                  <td className="px-4 py-2">{d.title}</td>
                                  <td className="px-4 py-2 text-white/60">{d.existingDate}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {importResult.invalid.length > 0 && (
                      <div className="border border-red-500/30 bg-red-500/5 rounded-lg overflow-hidden">
                        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20">
                          <p className="text-red-300 text-xs font-semibold uppercase tracking-wider">
                            Invalid rows skipped — fix and re-upload these
                          </p>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-black/30 sticky top-0">
                              <tr className="text-white/60 text-xs">
                                <th className="text-left px-4 py-2 font-medium w-12">Row</th>
                                <th className="text-left px-4 py-2 font-medium">Title</th>
                                <th className="text-left px-4 py-2 font-medium">Reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {importResult.invalid.map((r, i) => (
                                <tr key={i} className="border-t border-white/5 text-white/80">
                                  <td className="px-4 py-2 text-white/60 font-mono text-xs">{r.rowIndex + 2}</td>
                                  <td className="px-4 py-2">{r.title}</td>
                                  <td className="px-4 py-2 text-red-300/90 text-xs">{r.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <Button variant="outline" onClick={() => { setShowImportModal(false); resetImportModal(); }} className="border-white/20 text-white/70">
                      Close
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Image upload / replace modal — single event OR bulk (when imageTarget === "bulk") */}
            <Dialog open={imageTarget !== null} onOpenChange={(o) => { if (!o) { setImageTarget(null); setImageUrlInput(""); } }}>
              <DialogContent className="bg-secondary border-white/10 text-white max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {imageTarget === "bulk"
                      ? `Apply image to ${selectedEventIds.size} event${selectedEventIds.size !== 1 ? "s" : ""}`
                      : "Add / replace event image"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleImageSubmit} className="space-y-4 py-2">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setImageMode("upload")} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${imageMode === "upload" ? "bg-primary border-primary text-white" : "border-white/15 text-white/60"}`}>Upload file</button>
                    <button type="button" onClick={() => setImageMode("url")} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${imageMode === "url" ? "bg-primary border-primary text-white" : "border-white/15 text-white/60"}`}>Paste URL</button>
                  </div>
                  {imageMode === "upload" ? (
                    <div className="border-2 border-dashed border-white/15 rounded-xl p-6 text-center">
                      <input ref={imageFileRef} type="file" accept="image/*" className="hidden" data-testid="input-image-file" onChange={() => setImageUrlInput("")} />
                      <Button type="button" variant="outline" onClick={() => imageFileRef.current?.click()} className="border-white/20 text-white/80">
                        <Upload className="w-3.5 h-3.5 mr-1.5" /> Choose image
                      </Button>
                      <p className="text-[11px] text-white/40 mt-2">JPG, PNG, WebP. Uploaded to Cloudinary.</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs text-white/70">Image URL (Instagram CDN, any image link)</Label>
                      <Input value={imageUrlInput} onChange={(e) => setImageUrlInput(e.target.value)} placeholder="https://scontent...cdninstagram.com/..." className="bg-black/40 border-white/10 h-10" data-testid="input-image-url" />
                      <p className="text-[11px] text-yellow-300/70">⚠ Instagram blocks most server-side fetches even when the URL works in your browser. For reliable uploads, switch to the <strong>Upload file</strong> tab and save the image to your computer first.</p>
                    </div>
                  )}
                  <DialogFooter className="gap-2">
                    <Button type="button" variant="outline" onClick={() => setImageTarget(null)} className="border-white/20 text-white/70">Cancel</Button>
                    <Button type="submit" disabled={imageBusy} className="bg-primary hover:bg-primary/90" data-testid="button-submit-image">
                      {imageBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : (imageTarget === "bulk" ? `Apply to ${selectedEventIds.size}` : "Save image")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {/* Batch delete confirmation dialog */}
            <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
              <DialogContent className="bg-secondary border-white/10 text-white max-w-sm">
                <DialogHeader>
                  <DialogTitle>Delete {selectedEventIds.size} Event{selectedEventIds.size !== 1 ? "s" : ""}?</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground py-2">
                  This will permanently delete {selectedEventIds.size} selected event{selectedEventIds.size !== 1 ? "s" : ""}. This cannot be undone.
                </p>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="border-white/20 text-white/70">
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => batchDeleteMutation.mutate(Array.from(selectedEventIds))}
                    disabled={batchDeleteMutation.isPending}
                    data-testid="button-confirm-batch-delete"
                  >
                    {batchDeleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Delete ${selectedEventIds.size}`}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

        {/* BOOKINGS TAB */}
        {activeTab === "bookings" && (() => {
          const BOOKING_STATUSES = ["All", "New", "Contacted", "Paid", "Completed", "Cancelled"];
          const statusBadge: Record<string, string> = {
            New: "border-white/20 text-white/50 bg-white/5",
            Contacted: "border-blue-500/40 text-blue-400 bg-blue-500/10",
            Paid: "border-green-500/40 text-green-400 bg-green-500/10",
            Completed: "border-purple-500/40 text-purple-400 bg-purple-500/10",
            Cancelled: "border-red-500/40 text-red-400 bg-red-500/10",
          };

          const searchLower = bookingSearch.toLowerCase();
          const filteredBookings = bookings
            .filter((b) => bookingStatusFilter === "All" || (b.status || "New") === bookingStatusFilter)
            .filter((b) => {
              if (!searchLower) return true;
              return (
                (b.contactName || "").toLowerCase().includes(searchLower) ||
                (b.email || "").toLowerCase().includes(searchLower)
              );
            })
            .slice()
            .sort((a, b) => {
              const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const db_ = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return bookingSortDir === "desc" ? db_ - da : da - db_;
            });

          const handleExportCSV = () => {
            const escape = (val: string | null | undefined) => {
              const s = val ?? "";
              return `"${s.replace(/"/g, '""')}"`;
            };
            const headers = ["Submitted", "Contact Name", "Email", "Package", "Event Name", "Event Date", "City/Region", "Status"];
            const rows = filteredBookings.map((b) => [
              escape(b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-US") : ""),
              escape(b.contactName),
              escape(b.email),
              escape(b.mode || "Standard"),
              escape(b.eventName),
              escape(b.eventDate ? new Date(b.eventDate + "T00:00:00").toLocaleDateString("en-US") : ""),
              escape(b.city ? `${b.city}, ${b.region}` : b.region),
              escape(b.status || "New"),
            ]);
            const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `bookings-export-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          };

          return (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap flex-1">
                  <span className="text-sm text-muted-foreground font-medium">Filter:</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {BOOKING_STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setBookingStatusFilter(s)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                          bookingStatusFilter === s
                            ? s === "All"
                              ? "bg-primary border-primary text-white"
                              : statusBadge[s] + " opacity-100 border-opacity-100"
                            : "border-white/10 text-white/40 hover:text-white/60"
                        }`}
                        data-testid={`filter-booking-status-${s}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    placeholder="Search name or email…"
                    className="pl-8 h-8 text-xs bg-secondary/40 border-white/10 text-white placeholder:text-muted-foreground w-52"
                    data-testid="input-booking-search"
                  />
                </div>
              </div>

              <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3">
                  <h2 className="font-bold text-white">
                    All Submissions
                    <span className="text-muted-foreground font-normal text-sm ml-2">
                      ({filteredBookings.length}{bookingStatusFilter !== "All" || bookingSearch ? " matching" : ""} of {bookings.length} total)
                    </span>
                  </h2>
                  <div className="flex items-center gap-2">
                    {selectedBookingIds.size > 0 && (
                      <>
                        <span className="text-sm text-white/70 font-medium">{selectedBookingIds.size} selected</span>
                        <Select
                          value=""
                          onValueChange={(val) => {
                            if (!val) return;
                            bulkUpdateBookingStatusMutation.mutate({
                              ids: Array.from(selectedBookingIds),
                              status: val,
                            });
                          }}
                        >
                          <SelectTrigger className="h-8 w-[180px] bg-secondary/40 border-white/20 text-xs text-white/80" data-testid="select-bulk-status">
                            <SelectValue placeholder="Mark all as…" />
                          </SelectTrigger>
                          <SelectContent className="bg-secondary border-white/10 text-white">
                            <SelectItem value="New">New</SelectItem>
                            <SelectItem value="Contacted">Contacted</SelectItem>
                            <SelectItem value="Paid">Paid</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowBookingDeleteConfirm(true)}
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                          data-testid="button-delete-selected-bookings"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete ({selectedBookingIds.size})
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedBookingIds(new Set())}
                          className="border-white/20 text-white/70 hover:bg-white/10"
                        >
                          Clear
                        </Button>
                      </>
                    )}
                    <button
                      onClick={handleExportCSV}
                      disabled={filteredBookings.length === 0}
                      data-testid="button-export-csv"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/15 text-white/70 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </button>
                  </div>
                </div>
                {bookingsLoading ? (
                  <div className="flex justify-center items-center h-40 text-muted-foreground">Loading…</div>
                ) : filteredBookings.length === 0 ? (
                  <div className="flex justify-center items-center h-40 text-muted-foreground">
                    {bookings.length === 0 ? "No submissions yet." : "No submissions match your filters."}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-muted-foreground text-left">
                          <th className="px-4 py-3 font-medium whitespace-nowrap w-6">
                            <input
                              type="checkbox"
                              checked={selectedBookingIds.size === filteredBookings.length && filteredBookings.length > 0}
                              onChange={(e) => setSelectedBookingIds(e.target.checked ? new Set(filteredBookings.map(b => b.id)) : new Set())}
                              className="rounded border-white/20 bg-black/40"
                            />
                          </th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Ref #</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Status</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Package</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap text-right">Deal Value</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Contact</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Email</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Event Name</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Event Date</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Budget</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">City / Region</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">
                            <button
                              onClick={() => setBookingSortDir(d => d === "desc" ? "asc" : "desc")}
                              className="flex items-center gap-1 hover:text-white transition-colors"
                              data-testid="button-sort-submitted"
                            >
                              Submitted
                              {bookingSortDir === "desc"
                                ? <ChevronDown className="w-3 h-3" />
                                : <ChevronUp className="w-3 h-3" />}
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBookings.map((booking, i) => {
                          const currentStatus = booking.status || "New";
                          const isExpanded = expandedBookingId === booking.id;
                          const eventType = booking.eventTypeOther || booking.eventType || "—";
                          return (
                            <Fragment key={booking.id}>
                              <tr
                                data-testid={`row-booking-${booking.id}`}
                                className={`border-b border-white/5 hover:bg-white/5 cursor-pointer ${i % 2 !== 0 ? "bg-white/[0.02]" : ""} ${isExpanded ? "bg-white/5" : ""}`}
                                onClick={() => setExpandedBookingId(isExpanded ? null : booking.id)}
                              >
                                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={selectedBookingIds.has(booking.id)}
                                    onChange={(e) => {
                                      const next = new Set(selectedBookingIds);
                                      if (e.target.checked) {
                                        next.add(booking.id);
                                      } else {
                                        next.delete(booking.id);
                                      }
                                      setSelectedBookingIds(next);
                                    }}
                                    className="rounded border-white/20 bg-black/40"
                                  />
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap" data-testid={`text-reference-${booking.id}`}>
                                  {booking.referenceId ? (
                                    <span className="font-mono text-xs font-semibold text-primary/80 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                                      {booking.referenceId}
                                    </span>
                                  ) : (
                                    <span className="text-white/20 text-xs">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                  <Select
                                    value={currentStatus}
                                    onValueChange={(val) => updateBookingStatusMutation.mutate({ id: booking.id, status: val })}
                                  >
                                    <SelectTrigger
                                      className={`h-7 text-xs border rounded-full px-2.5 w-[110px] ${statusBadge[currentStatus] ?? statusBadge["New"]}`}
                                      data-testid={`select-booking-status-${booking.id}`}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-secondary border-white/10 text-white">
                                      <SelectItem value="New">New</SelectItem>
                                      <SelectItem value="Contacted">Contacted</SelectItem>
                                      <SelectItem value="Paid">Paid</SelectItem>
                                      <SelectItem value="Completed">Completed</SelectItem>
                                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="px-4 py-4">
                                  <span className={`inline-block px-3 py-0.5 rounded-full text-xs font-semibold border ${booking.mode === "Premium" ? "bg-primary/15 border-primary/40 text-primary" : "bg-white/5 border-white/20 text-white/60"}`}>
                                    {booking.mode || "Standard"}
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-right whitespace-nowrap font-semibold text-white" data-testid={`text-dealvalue-${booking.id}`}>
                                  {packageDealValue(booking.mode).label}
                                </td>
                                <td className="px-4 py-4 text-muted-foreground whitespace-nowrap" onClick={(e) => e.stopPropagation()} data-testid={`text-contact-${booking.id}`}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/80">{booking.contactName || "—"}</span>
                                    {booking.phone && (
                                      <>
                                        <a
                                          href={`tel:${booking.phone}`}
                                          title={`Call ${booking.phone}`}
                                          data-testid={`button-call-${booking.id}`}
                                          className="text-muted-foreground hover:text-primary transition-colors"
                                        >
                                          <Phone className="w-3.5 h-3.5" />
                                        </a>
                                        <a
                                          href={`https://wa.me/${phoneDigits(booking.phone)}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title={`WhatsApp ${booking.phone}`}
                                          data-testid={`button-whatsapp-${booking.id}`}
                                          className="text-muted-foreground hover:text-green-400 transition-colors"
                                        >
                                          <MessageCircle className="w-3.5 h-3.5" />
                                        </a>
                                      </>
                                    )}
                                    {booking.instagramHandle && (
                                      <a
                                        href={`https://instagram.com/${booking.instagramHandle.replace("@","")}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={`@${booking.instagramHandle.replace("@","")}`}
                                        data-testid={`button-ig-${booking.id}`}
                                        className="text-muted-foreground hover:text-pink-400 transition-colors"
                                      >
                                        <Instagram className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-2 whitespace-nowrap">
                                    <a href={`mailto:${booking.email}`} className="text-primary hover:underline">{booking.email}</a>
                                    <button
                                      title="Copy email"
                                      data-testid={`button-copy-email-${booking.id}`}
                                      onClick={() => {
                                        navigator.clipboard.writeText(booking.email);
                                        toast({ title: "Email copied", description: booking.email });
                                      }}
                                      className="text-muted-foreground hover:text-white transition-colors"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                                <td className="px-4 py-4 font-medium text-white max-w-[180px]"><span className="line-clamp-1">{booking.eventName || "—"}</span></td>
                                <td className="px-4 py-4 text-muted-foreground whitespace-nowrap" data-testid={`text-eventdate-${booking.id}`}>
                                  {booking.eventDate
                                    ? new Date(booking.eventDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                    : "—"}
                                </td>
                                <td className="px-4 py-4 text-muted-foreground whitespace-nowrap" data-testid={`text-budget-${booking.id}`}>
                                  {booking.budgetRange || "—"}
                                </td>
                                <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">
                                  {booking.city ? `${booking.city}, ` : ""}
                                  <span className="inline-block px-2 py-0.5 rounded-full text-xs border border-primary/30 text-primary bg-primary/10">{booking.region}</span>
                                </td>
                                <td className="px-4 py-4 text-muted-foreground whitespace-nowrap" data-testid={`text-submitted-${booking.id}`}>{formatDate(booking.createdAt)}</td>
                              </tr>
                              {isExpanded && (
                                <tr key={`${booking.id}-detail`} className="border-b border-white/5 bg-white/[0.03]">
                                  <td colSpan={13} className="px-6 py-5">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                                      <div>
                                        <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Contact Name</p>
                                        <p className="text-white">{booking.contactName || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Email</p>
                                        <div className="flex items-center gap-2">
                                          <a href={`mailto:${booking.email}`} className="text-primary hover:underline">{booking.email}</a>
                                          <button
                                            data-testid={`button-copy-email-detail-${booking.id}`}
                                            onClick={() => {
                                              navigator.clipboard.writeText(booking.email);
                                              toast({ title: "Email copied", description: booking.email });
                                            }}
                                            className="text-muted-foreground hover:text-white transition-colors"
                                          >
                                            <Copy className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Phone</p>
                                        <p className="text-white">{booking.phone || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Instagram</p>
                                        <p className="text-white">
                                          {booking.instagramHandle
                                            ? <a href={`https://instagram.com/${booking.instagramHandle.replace("@","")}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@{booking.instagramHandle.replace("@","")}</a>
                                            : "—"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Event Name</p>
                                        <p className="text-white">{booking.eventName || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Venue</p>
                                        <p className="text-white">{booking.venueName || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Event Date</p>
                                        <p className="text-white">
                                          {booking.eventDate
                                            ? new Date(booking.eventDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                                            : "—"}
                                          {booking.eventTime ? ` at ${booking.eventTime}` : ""}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Location</p>
                                        <p className="text-white">{[booking.city, booking.region].filter(Boolean).join(", ") || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Event Type</p>
                                        <p className="text-white">{eventType}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Package</p>
                                        <p className="text-white">{booking.mode || "Standard"}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Budget Range</p>
                                        <p className="text-white">{booking.budgetRange || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Ready to Move Forward</p>
                                        <p className="text-white">{booking.readyToMoveForward || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Submitted</p>
                                        <p className="text-white">{formatDate(booking.createdAt)}</p>
                                      </div>
                                    </div>
                                    <div className="mt-5 pt-4 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                                      <p className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Internal Notes</p>
                                      <textarea
                                        data-testid={`textarea-admin-notes-${booking.id}`}
                                        className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                                        rows={3}
                                        placeholder="Add internal notes for your team…"
                                        value={bookingNotesDraft[booking.id] ?? (booking.adminNotes || "")}
                                        onChange={(e) => setBookingNotesDraft((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                                      />
                                      <div className="flex justify-end mt-2">
                                        <button
                                          data-testid={`button-save-notes-${booking.id}`}
                                          disabled={updateBookingNotesMutation.isPending}
                                          onClick={() => {
                                            const notes = bookingNotesDraft[booking.id] ?? (booking.adminNotes || "");
                                            updateBookingNotesMutation.mutate({ id: booking.id, adminNotes: notes });
                                          }}
                                          className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                        >
                                          {updateBookingNotesMutation.isPending ? "Saving…" : "Save Notes"}
                                        </button>
                                      </div>
                                    </div>
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

              {/* Batch delete confirmation dialog */}
              <Dialog open={showBookingDeleteConfirm} onOpenChange={setShowBookingDeleteConfirm}>
                <DialogContent className="bg-secondary border-white/10 text-white max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Delete {selectedBookingIds.size} Booking{selectedBookingIds.size !== 1 ? "s" : ""}?</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground py-2">
                    This will permanently delete {selectedBookingIds.size} selected booking{selectedBookingIds.size !== 1 ? "s" : ""}. This cannot be undone.
                  </p>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowBookingDeleteConfirm(false)} className="border-white/20 text-white/70">
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => batchDeleteBookingsMutation.mutate(Array.from(selectedBookingIds))}
                      disabled={batchDeleteBookingsMutation.isPending}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {batchDeleteBookingsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Delete ${selectedBookingIds.size}`}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          );
        })()}

        {activeTab === "subscribers" && <SubscribersTab />}
        {activeTab === "blog" && <BlogPostsTab />}
        {activeTab === "this-week" && <ThisWeekTab />}
        {activeTab === "analytics" && <AnalyticsTab />}
        {activeTab === "world-cup" && <WorldCupTab />}
        {activeTab === "nba-finals" && <NbaFinalsTab />}
        {activeTab === "pages" && <PagesTab />}
        {activeTab === "team" && <TeamTab currentRole={user.role} />}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  THIS WEEK TAB — edits the /things-to-do-in-nj page         */

const PAGE_SLUG = "things-to-do-in-nj";

type AdSlotData = { imageUrl: string; linkUrl: string; alt: string; caption: string };

function emptyAdSlot(): AdSlotData {
  return { imageUrl: "", linkUrl: "", alt: "", caption: "" };
}

function parseAdSlot(raw: string | null | undefined): AdSlotData {
  if (!raw) return emptyAdSlot();
  try {
    const p = JSON.parse(raw);
    return {
      imageUrl: p.imageUrl || "",
      linkUrl: p.linkUrl || "",
      alt: p.alt || "",
      caption: p.caption || "",
    };
  } catch {
    return emptyAdSlot();
  }
}

function serializeAdSlot(s: AdSlotData): string | null {
  if (!s.imageUrl.trim()) return null;
  return JSON.stringify({
    imageUrl: s.imageUrl.trim(),
    linkUrl: s.linkUrl.trim() || undefined,
    alt: s.alt.trim() || undefined,
    caption: s.caption.trim() || undefined,
  });
}

function AdSlotEditor({ label, value, onChange, hint }: { label: string; value: AdSlotData; onChange: (v: AdSlotData) => void; hint?: string }) {
  return (
    <div className="border border-white/10 rounded-2xl p-5 bg-white/[0.02] space-y-3">
      <div>
        <h4 className="font-semibold text-white">{label}</h4>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="space-y-1">
        <Label className="text-white/70 text-xs">Image</Label>
        <ImageUpload value={value.imageUrl} onChange={(url) => onChange({ ...value, imageUrl: url })} />
      </div>
      <div className="space-y-1">
        <Label className="text-white/70 text-xs">Click-through URL (optional)</Label>
        <Input
          value={value.linkUrl}
          onChange={(e) => onChange({ ...value, linkUrl: e.target.value })}
          placeholder="https://..."
          className="bg-black/40 border-white/10"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-white/70 text-xs">Alt text</Label>
        <Input
          value={value.alt}
          onChange={(e) => onChange({ ...value, alt: e.target.value })}
          placeholder="What the ad is about"
          className="bg-black/40 border-white/10"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-white/70 text-xs">Caption (optional)</Label>
        <Input
          value={value.caption}
          onChange={(e) => onChange({ ...value, caption: e.target.value })}
          placeholder="Short text shown under the ad for context"
          className="bg-black/40 border-white/10"
        />
      </div>
      {value.imageUrl && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(emptyAdSlot())}
          className="border-white/20 text-white/60 hover:bg-white/10 text-xs"
        >
          Clear slot
        </Button>
      )}
    </div>
  );
}

// Parses the apiRequest error string ("400: {...json...}" or "500: <text>")
// into a status code and a human-readable message. Returns the status code,
// a short reason, and the full raw text in case the dev wants more context.
function describeApiError(err: unknown): { status: number | null; reason: string; raw: string } {
  if (!(err instanceof Error)) {
    return { status: null, reason: "Unknown error", raw: String(err) };
  }
  const m = err.message.match(/^(\d{3}):\s*([\s\S]*)$/);
  if (!m) {
    return { status: null, reason: err.message, raw: err.message };
  }
  const status = parseInt(m[1], 10);
  const body = m[2];
  let reason = body;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object") {
      if (parsed.message) reason = parsed.message;
      else if (parsed.error) reason = parsed.error;
      else reason = JSON.stringify(parsed);
    }
  } catch {
    // Leave reason as the raw body text.
  }
  return { status, reason, raw: err.message };
}

function ErrorPanel({ title, status, reason, raw, onClose }: { title: string; status: number | null; reason: string; raw: string; onClose: () => void }) {
  const [showRaw, setShowRaw] = useState(false);
  function copyAll() {
    const txt = `${title}\nStatus: ${status ?? "(none)"}\nMessage: ${reason}\nRaw:\n${raw}`;
    navigator.clipboard?.writeText(txt);
  }
  return (
    <div className="border border-red-500/40 bg-red-500/10 rounded-2xl p-4 space-y-2" data-testid="this-week-error-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-300 text-sm">{title}</p>
          <p className="text-sm text-white/80 mt-1 break-words">
            {status !== null && <span className="font-mono text-xs text-white/60 mr-2">[{status}]</span>}
            {reason}
          </p>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white" aria-label="Dismiss"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="text-xs text-white/60 hover:text-white underline underline-offset-2"
        >
          {showRaw ? "Hide raw response" : "Show raw response"}
        </button>
        <span className="text-white/30 text-xs">·</span>
        <button
          type="button"
          onClick={copyAll}
          className="text-xs text-white/60 hover:text-white underline underline-offset-2"
        >
          Copy details
        </button>
      </div>
      {showRaw && (
        <pre className="mt-2 text-[11px] leading-relaxed font-mono bg-black/40 border border-white/10 rounded-lg p-3 text-white/70 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
          {raw}
        </pre>
      )}
    </div>
  );
}

function ThisWeekTab() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: page, isLoading, error: loadError, refetch } = useQuery<any>({
    queryKey: [`/api/pages/${PAGE_SLUG}`],
  });

  const [title, setTitle] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [adTop, setAdTop] = useState<AdSlotData>(emptyAdSlot());
  const [adMid, setAdMid] = useState<AdSlotData>(emptyAdSlot());
  const [adBottom, setAdBottom] = useState<AdSlotData>(emptyAdSlot());
  const [adSidebar, setAdSidebar] = useState<AdSlotData>(emptyAdSlot());
  const [hydrated, setHydrated] = useState(false);
  const [saveError, setSaveError] = useState<{ status: number | null; reason: string; raw: string } | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (page && !hydrated) {
      setTitle(page.title || "");
      setHeroImageUrl(page.heroImageUrl || "");
      setEditorContent(page.editorContent || "");
      setAdTop(parseAdSlot(page.adSlotTop));
      setAdMid(parseAdSlot(page.adSlotMid));
      setAdBottom(parseAdSlot(page.adSlotBottom));
      setAdSidebar(parseAdSlot(page.adSlotSidebar));
      setHydrated(true);
    }
  }, [page, hydrated]);

  const savePage = useMutation({
    mutationFn: async () => {
      const body = {
        title: title.trim(),
        heroImageUrl: heroImageUrl.trim() || null,
        editorContent,
        adSlotTop: serializeAdSlot(adTop),
        adSlotMid: serializeAdSlot(adMid),
        adSlotBottom: serializeAdSlot(adBottom),
        adSlotSidebar: serializeAdSlot(adSidebar),
      };
      const res = await apiRequest("PUT", `/api/pages/${PAGE_SLUG}`, body);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/pages/${PAGE_SLUG}`] });
      setSaveError(null);
      setSavedAt(new Date());
      toast({ title: "Page saved" });
    },
    onError: (err) => {
      const info = describeApiError(err);
      setSaveError(info);
      toast({
        title: `Save failed${info.status ? ` (${info.status})` : ""}`,
        description: info.reason.slice(0, 220),
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (loadError) {
    const info = describeApiError(loadError);
    return (
      <div className="space-y-4">
        <ErrorPanel
          title="Couldn't load the This Week page settings"
          status={info.status}
          reason={info.reason}
          raw={info.raw}
          onClose={() => refetch()}
        />
        <Button onClick={() => refetch()} variant="outline" className="border-white/20">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">This Week ("Things to Do in NJ")</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Edits the public page at <code className="text-white/80">/{PAGE_SLUG}</code>. Visitors must subscribe before viewing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && !saveError && (
            <span className="text-xs text-green-400 hidden sm:inline" data-testid="this-week-save-stamp">
              Saved {savedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
          <Button
            onClick={() => savePage.mutate()}
            disabled={savePage.isPending}
            className="bg-primary hover:bg-primary/90 font-semibold"
            data-testid="button-save-this-week"
          >
            {savePage.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
          </Button>
        </div>
      </div>

      {saveError && (
        <ErrorPanel
          title="Save failed"
          status={saveError.status}
          reason={saveError.reason}
          raw={saveError.raw}
          onClose={() => setSaveError(null)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: cover + content */}
        <div className="lg:col-span-2 space-y-5">
          <div className="space-y-2">
            <Label className="text-white/80">Page title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Things to Do in NJ This Week"
              className="bg-black/40 border-white/10"
              data-testid="input-this-week-title"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-white/80">Hero image (optional)</Label>
            <ImageUpload value={heroImageUrl} onChange={setHeroImageUrl} />
          </div>

          <div className="space-y-2">
            <Label className="text-white/80">Cover content</Label>
            <p className="text-xs text-muted-foreground">
              2–3 paragraphs introducing the week. Format with the toolbar; paste from Google Docs / Word — formatting is preserved.
            </p>
            <RichTextEditor content={editorContent} onChange={setEditorContent} />
          </div>
        </div>

        {/* Right: ad slots */}
        <div className="space-y-4">
          <div>
            <h3 className="font-bold text-white mb-1">Ad slots</h3>
            <p className="text-xs text-muted-foreground">Leave any slot empty to hide it. Image-only slots show without a click-through.</p>
          </div>
          <AdSlotEditor label="Top banner" value={adTop} onChange={setAdTop} hint="Wide banner above the page. Recommended 1600×400 (4:1) JPG/PNG." />
          <AdSlotEditor label="Mid-list (in-feed)" value={adMid} onChange={setAdMid} hint="Appears as a row inside the events list. Recommended 1200×400 (3:1) JPG/PNG." />
          <AdSlotEditor label="Sidebar (sticky on desktop)" value={adSidebar} onChange={setAdSidebar} hint="Horizontal rectangle, sticks alongside the events list. Recommended 600×300 (2:1) JPG/PNG." />
          <AdSlotEditor label="Bottom" value={adBottom} onChange={setAdBottom} hint="Wide banner below the page. Recommended 1600×400 (4:1) JPG/PNG." />
        </div>
      </div>
    </div>
  );
}
