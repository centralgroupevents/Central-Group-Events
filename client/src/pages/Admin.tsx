import { useState, useEffect, useRef, Fragment } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import cgeLogo from "@assets/CGE_logo_1772075137138.png";
import { SEO } from "@/components/SEO";

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
};

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
  { id: "analytics", label: "Analytics", icon: BarChart2 },
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
        {value && (
          <img
            src={value}
            alt="Preview"
            className="h-9 w-16 object-cover rounded border border-white/10"
          />
        )}
      </div>
      {uploadError && <p className="text-red-400 text-xs">{uploadError}</p>}
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setUploadError(""); }}
        placeholder="Or paste image URL…"
        className="bg-black/40 border-white/10 h-11 text-sm"
        data-testid="input-image-url"
      />
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
            <div className="py-4">
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
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
  });

  return (
    <div className="space-y-8">
      {/* Subscriber stat card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-secondary/30 border border-white/10 rounded-xl p-5 sm:col-span-1">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Total Subscribers</p>
          {isLoading ? (
            <Skeleton className="h-9 w-20 mt-1" />
          ) : (
            <p className="text-3xl font-black text-white">{(data?.totalSubscribers ?? 0).toLocaleString()}</p>
          )}
        </div>
        <div className="bg-secondary/30 border border-white/10 rounded-xl p-5 sm:col-span-1">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Total Post Views</p>
          {isLoading ? (
            <Skeleton className="h-9 w-20 mt-1" />
          ) : (
            <p className="text-3xl font-black text-white">
              {(data?.postViews?.reduce((s, p) => s + p.views, 0) ?? 0).toLocaleString()}
            </p>
          )}
        </div>
        <div className="bg-secondary/30 border border-white/10 rounded-xl p-5 sm:col-span-1">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Outbound Clicks</p>
          {isLoading ? (
            <Skeleton className="h-9 w-20 mt-1" />
          ) : (
            <p className="text-3xl font-black text-white">
              {(data?.linkClicks?.reduce((s, c) => s + c.count, 0) ?? 0).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Post Views table */}
      <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="font-bold text-white">Post Views</h3>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !data?.postViews?.length ? (
          <div className="py-10 text-center text-muted-foreground text-sm">No view data yet.</div>
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
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="font-bold text-white">Top Outbound Links</h3>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !data?.linkClicks?.length ? (
          <div className="py-10 text-center text-muted-foreground text-sm">No click data yet.</div>
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
function normalizeEventDate(input: string): string {
  if (!input) return "";
  const s = String(input).trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // YYYY/MM/DD or YYYY-MM-DD with single-digit month/day
  let m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // M/D/YYYY, M-D-YYYY, M.D.YY, etc. (US-style; default for this site)
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (m) {
    let [, mo, d, y] = m;
    if (y.length === 2) y = (parseInt(y, 10) >= 70 ? "19" : "20") + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Excel serial number (days since 1899-12-30, with Excel's 1900 leap-year quirk)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = parseFloat(s);
    if (serial > 20000 && serial < 80000) {
      const ms = Math.round((serial - 25569) * 86400 * 1000);
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      }
    }
  }

  // Fallback: let JS Date try ("May 1, 2026", "1 May 2026", "Fri May 01 2026...", ISO timestamps)
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  }

  return "";
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
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; invalidFormat?: number } | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [genreIsOther, setGenreIsOther] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [inlineEdit, setInlineEdit] = useState<{ id: number; field: string; value: string } | null>(null);
  const [inlineSaved, setInlineSaved] = useState<{ id: number; field: string } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

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
    { key: "date",            label: "Date",             required: true },
    { key: "time",            label: "Time",             required: false },
    { key: "venue",           label: "Venue",            required: false },
    { key: "city",            label: "City",             required: false },
    { key: "region",          label: "Region",           required: false },
    { key: "organizer",       label: "Organizer",        required: false },
    { key: "influencer",      label: "Influencer",       required: false },
    { key: "genre",           label: "Genre",            required: false },
    { key: "instagramHandle", label: "Instagram Handle", required: false },
    { key: "ticketLink",      label: "Ticket Link",      required: false },
  ];

  const IMPORT_ALIASES: Record<string, string[]> = {
    name:            ["name", "title", "event", "event name"],
    date:            ["date", "event date", "day", "event_date"],
    time:            ["time", "event time", "start time", "start_time"],
    venue:           ["venue", "location", "place"],
    city:            ["city", "town"],
    region:          ["region", "area"],
    organizer:       ["organizer", "host", "promoter"],
    influencer:      ["influencer"],
    genre:           ["genre", "type", "music type"],
    instagramHandle: ["instagram", "ig", "handle", "insta", "instagramhandle"],
    ticketLink:      ["ticket", "link", "url", "tickets", "ticketlink"],
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
      if (obj.date) obj.date = normalizeEventDate(obj.date);
      return obj;
    });
    try {
      const res = await apiRequest("POST", "/api/events/bulk-import", mapped);
      const data = await res.json();
      setImportResult(data as { imported: number; skipped: number });
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
    const headers = "name,date,time,venue,city,region,organizer,influencer,genre,instagramHandle,ticketLink";
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
    <div className="min-h-screen bg-background text-foreground">
      <SEO title="Admin Dashboard" description="" canonical="https://www.centralgroupevents.com/admin" noindex />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

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

            {/* Batch delete bar */}
            {selectedEventIds.size > 0 && (
              <div className="flex items-center gap-3 mb-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5">
                <span className="text-sm text-red-300 font-medium">{selectedEventIds.size} event{selectedEventIds.size !== 1 ? "s" : ""} selected</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="ml-auto"
                  data-testid="button-delete-selected-events"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Selected ({selectedEventIds.size})
                </Button>
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
                              onClick={() => setInlineEdit({ id: event.id, field, value: value || "" })}
                              title="Click to edit"
                            >
                              {isSaved && <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />}
                              <span className={shownText ? "text-white" : "text-white/20 italic"}>{shownText || (placeholder || "—")}</span>
                              <Pencil className="w-2.5 h-2.5 text-white/20 group-hover:text-white/50 ml-auto flex-shrink-0" />
                            </span>
                          );
                        }

                        return (
                          <tr key={event.id} className={`border-b border-white/5 hover:bg-white/5 ${rowBg}`}>
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
                                    {importRawHeaders.map(h => (
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
                        disabled={!importMapping["name"] || !importMapping["date"]}
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
                        {importResult.imported} event{importResult.imported !== 1 ? "s" : ""} imported, {importResult.skipped} duplicate{importResult.skipped !== 1 ? "s" : ""} skipped
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => { setShowImportModal(false); resetImportModal(); }} className="border-white/20 text-white/70">
                      Close
                    </Button>
                  </div>
                )}
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
                        <span className="text-sm text-red-300 font-medium">{selectedBookingIds.size} booking{selectedBookingIds.size !== 1 ? "s" : ""} selected</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowBookingDeleteConfirm(true)}
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                          data-testid="button-delete-selected-bookings"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Selected ({selectedBookingIds.size})
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
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Status</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Package</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Contact</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Email</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Event Name</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Event Date</th>
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
                                <td className="px-4 py-4 text-muted-foreground whitespace-nowrap" data-testid={`text-contact-${booking.id}`}>{booking.contactName || "—"}</td>
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
                                <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">
                                  {booking.city ? `${booking.city}, ` : ""}
                                  <span className="inline-block px-2 py-0.5 rounded-full text-xs border border-primary/30 text-primary bg-primary/10">{booking.region}</span>
                                </td>
                                <td className="px-4 py-4 text-muted-foreground whitespace-nowrap" data-testid={`text-submitted-${booking.id}`}>{formatDate(booking.createdAt)}</td>
                              </tr>
                              {isExpanded && (
                                <tr key={`${booking.id}-detail`} className="border-b border-white/5 bg-white/[0.03]">
                                  <td colSpan={10} className="px-6 py-5">
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
        {activeTab === "team" && <TeamTab currentRole={user.role} />}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  THIS WEEK TAB — edits the /things-to-do-in-nj page         */

const PAGE_SLUG = "things-to-do-in-nj";

type AdSlotData = { imageUrl: string; linkUrl: string; alt: string };

function emptyAdSlot(): AdSlotData {
  return { imageUrl: "", linkUrl: "", alt: "" };
}

function parseAdSlot(raw: string | null | undefined): AdSlotData {
  if (!raw) return emptyAdSlot();
  try {
    const p = JSON.parse(raw);
    return {
      imageUrl: p.imageUrl || "",
      linkUrl: p.linkUrl || "",
      alt: p.alt || "",
    };
  } catch {
    return emptyAdSlot();
  }
}

function serializeAdSlot(s: AdSlotData): string | null {
  if (!s.imageUrl.trim()) return null;
  return JSON.stringify({ imageUrl: s.imageUrl.trim(), linkUrl: s.linkUrl.trim() || undefined, alt: s.alt.trim() || undefined });
}

function AdSlotEditor({ label, value, onChange }: { label: string; value: AdSlotData; onChange: (v: AdSlotData) => void }) {
  return (
    <div className="border border-white/10 rounded-2xl p-5 bg-white/[0.02] space-y-3">
      <h4 className="font-semibold text-white">{label}</h4>
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
          <AdSlotEditor label="Top banner" value={adTop} onChange={setAdTop} />
          <AdSlotEditor label="Mid-list (in-feed)" value={adMid} onChange={setAdMid} />
          <AdSlotEditor label="Sidebar (sticky on desktop)" value={adSidebar} onChange={setAdSidebar} />
          <AdSlotEditor label="Bottom" value={adBottom} onChange={setAdBottom} />
        </div>
      </div>
    </div>
  );
}
