import { useState, useEffect, useRef, Fragment } from "react";
import Papa from "papaparse";
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
  linkClicks: { url: string; count: number }[];
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
function SubscribersTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState<"csv" | "paste">("csv");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; invalidFormat?: number } | null>(null);

  const { data: subscribers = [], isLoading } = useQuery<Subscriber[]>({
    queryKey: ["/api/admin/subscribers"],
  });

  const filtered = subscribers.filter((s) =>
    s.email.toLowerCase().includes(search.toLowerCase())
  );

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

  async function handleImport() {
    setImporting(true);
    setImportResult(null);
    try {
      let rows: Array<{ email: string }> = [];

      if (importTab === "csv" && csvFile) {
        const text = await csvFile.text();

        // Use papaparse for robust CSV parsing (handles quoted commas, Ghost exports, etc.)
        const parsed = Papa.parse<Record<string, string>>(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim().toLowerCase(),
        });

        console.log("[subscriber-import] CSV headers detected:", parsed.meta.fields);
        console.log("[subscriber-import] CSV total data rows:", parsed.data.length);

        if (!parsed.meta.fields?.includes("email")) {
          toast({
            title: "CSV Error",
            description: `No 'email' column found. Columns found: ${parsed.meta.fields?.join(", ") || "none"}`,
            variant: "destructive",
          });
          setImporting(false);
          return;
        }

        rows = parsed.data
          .map((row) => ({ email: (row["email"] || "").trim().toLowerCase() }))
          .filter((r) => r.email.includes("@"));

        console.log(`[subscriber-import] CSV valid email rows after filter: ${rows.length}`);

      } else if (importTab === "paste") {
        rows = pasteText
          .split(/[\r\n,;]+/)
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.includes("@"))
          .map((email) => ({ email }));

        console.log(`[subscriber-import] Paste valid emails parsed: ${rows.length}`);
      }

      if (rows.length === 0) {
        toast({ title: "No emails found", description: "Please provide at least one valid email.", variant: "destructive" });
        setImporting(false);
        return;
      }

      console.log(`[subscriber-import] Sending ${rows.length} rows to backend`);
      const res = await apiRequest("POST", "/api/subscribers/import", rows);
      const result = await res.json();
      console.log("[subscriber-import] Result:", result);
      setImportResult(result);
      qc.invalidateQueries({ queryKey: ["/api/admin/subscribers"] });
    } catch (err) {
      console.error("[subscriber-import] Error:", err);
      toast({ title: "Import failed", description: "An error occurred during import.", variant: "destructive" });
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-secondary/30 border border-white/10 rounded-xl p-5">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Total Subscribers</p>
          {isLoading ? (
            <Skeleton className="h-9 w-20 mt-1" />
          ) : (
            <p className="text-3xl font-black text-white">{subscribers.length.toLocaleString()}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email…"
          className="bg-black/40 border-white/10 h-10 max-w-sm"
          data-testid="input-subscriber-search"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={exportCsv}
          disabled={subscribers.length === 0}
          className="border-white/20 text-white/70 hover:bg-white/10"
          data-testid="button-export-subscribers"
        >
          <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { resetImportModal(); setImportOpen(true); }}
          className="border-white/20 text-white/70 hover:bg-white/10"
          data-testid="button-import-subscribers"
        >
          <Upload className="w-3.5 h-3.5 mr-1.5" /> Import Subscribers
        </Button>
      </div>

      <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>{search ? "No subscribers match your search." : "No subscribers yet."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-muted-foreground text-left">
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Region</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Date Joined</th>
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
                    <td className="px-4 py-3 text-muted-foreground">{sub.region || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{sub.referrer || "direct"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(sub.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Import Modal */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) resetImportModal(); }}>
        <DialogContent className="bg-[#0d0d0d] border border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Import Subscribers</DialogTitle>
          </DialogHeader>

          {/* Tab switcher */}
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
              <p className="text-xs text-muted-foreground">Upload a CSV file with an <code className="text-primary">email</code> column. Other columns are ignored.</p>
              <input
                type="file"
                accept=".csv,text/csv"
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
              {importResult.invalidFormat > 0 && (
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
                  <th className="px-4 py-3 font-medium text-right">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {data.linkClicks.map((c, i) => (
                  <tr key={i} className={`border-b border-white/5 ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`}>
                    <td className="px-6 py-4 text-primary truncate max-w-xs">{decodeURIComponent(c.url)}</td>
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
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
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

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    setUser(null);
    setSessionChecked(true);
  }

  function openAdd() {
    setEditingEvent(null);
    setForm(emptyEventForm);
    setFormErrors({});
    setShowEventModal(true);
  }

  function openEdit(event: Event) {
    setEditingEvent(event);
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
      genre: event.genre || "",
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

  function handleCsvFile(file: File) {
    setCsvErrors([]);
    setImportResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errs: string[] = [];
        const valid: Record<string, string>[] = [];
        results.data.forEach((row, i) => {
          const name = row.name || row.title || "";
          const date = row.date || "";
          if (!name) { errs.push(`Row ${i + 1}: missing name`); return; }
          if (!date) { errs.push(`Row ${i + 1}: missing date`); return; }
          valid.push(row);
        });
        setCsvRows(valid);
        setCsvErrors(errs);
      },
      error: (err: Error) => setCsvErrors([err.message]),
    });
  }

  async function submitBulkImport() {
    try {
      const res = await apiRequest("POST", "/api/events/bulk-import", csvRows);
      const data = await res.json();
      setImportResult(data);
      setCsvRows([]);
      qc.invalidateQueries({ queryKey: ["/api/events"] });
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    }
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
            <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-white">Events <span className="text-muted-foreground font-normal text-sm ml-1">({events.length} total)</span></h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setShowImportModal(true); setCsvRows([]); setCsvErrors([]); setImportResult(null); }} className="border-white/20 hover:bg-white/10 text-white/70" data-testid="button-import-csv">
                  <Upload className="w-4 h-4 mr-1.5" /> Import CSV
                </Button>
                <Button onClick={openAdd} className="bg-primary hover:bg-primary/90 font-semibold" data-testid="button-add-event">
                  <Plus className="w-4 h-4 mr-1" /> Add New Event
                </Button>
              </div>
            </div>

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
                        <th className="px-4 py-3 font-medium whitespace-nowrap sticky left-0 z-10 bg-[#1a1a2e] min-w-[200px]">Name of Event</th>
                        <th className="px-4 py-3 font-medium whitespace-nowrap min-w-[110px]">Day of Event</th>
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

                        function InlineCell({ field, value, placeholder }: { field: string; value: string | null; placeholder?: string }) {
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
                          return (
                            <span
                              className="cursor-pointer hover:bg-white/10 rounded px-1 py-0.5 transition-colors flex items-center gap-1 group"
                              onClick={() => setInlineEdit({ id: event.id, field, value: value || "" })}
                              title="Click to edit"
                            >
                              {isSaved && <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />}
                              <span className={value ? "text-white" : "text-white/20 italic"}>{value || (placeholder || "—")}</span>
                              <Pencil className="w-2.5 h-2.5 text-white/20 group-hover:text-white/50 ml-auto flex-shrink-0" />
                            </span>
                          );
                        }

                        return (
                          <tr key={event.id} className={`border-b border-white/5 hover:bg-white/5 ${rowBg}`}>
                            <td className={`px-4 py-3 font-medium sticky left-0 z-10 ${stickyBg}`}>
                              <InlineCell field="title" value={event.title} />
                            </td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{event.date}</td>
                            <td className="px-4 py-3">
                              <InlineCell field="eventTime" value={event.eventTime} placeholder="add time" />
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
                    <Input value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} placeholder="e.g. Afrobeats, Hip-Hop" className="bg-black/40 border-white/10 h-11" />
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

            {/* CSV Import Modal */}
            <Dialog open={showImportModal} onOpenChange={(open) => { if (!open) { setShowImportModal(false); setCsvRows([]); setCsvErrors([]); setImportResult(null); } }}>
              <DialogContent className="bg-secondary border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Import Events from CSV</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <p className="text-sm text-muted-foreground">
                    Upload a CSV file with the following headers (in any order):<br />
                    <code className="text-primary text-xs">name, date, time, venue, city, region, organizer, influencer, genre, instagramHandle, ticketLink</code><br />
                    Date format: <code className="text-xs">YYYY-MM-DD</code> &nbsp;·&nbsp; Time format: <code className="text-xs">HH:MM</code>
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={downloadCsvTemplate} className="border-white/20 hover:bg-white/10 text-white/70">
                      <Download className="w-3.5 h-3.5 mr-1.5" /> Download Template
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => csvInputRef.current?.click()} className="border-white/20 hover:bg-white/10 text-white/70">
                      <Upload className="w-3.5 h-3.5 mr-1.5" /> Choose CSV File
                    </Button>
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); e.target.value = ""; }}
                    />
                  </div>

                  {csvErrors.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-1">
                      {csvErrors.map((err, i) => <p key={i} className="text-red-400 text-xs">{err}</p>)}
                    </div>
                  )}

                  {csvRows.length > 0 && !importResult && (
                    <>
                      <p className="text-sm text-white/70">{csvRows.length} row(s) ready to import. Preview (first 5):</p>
                      <div className="overflow-x-auto rounded-lg border border-white/10">
                        <table className="text-xs w-full">
                          <thead>
                            <tr className="border-b border-white/10 bg-white/5 text-muted-foreground">
                              {["name","date","time","venue","city","region"].map(h => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {csvRows.slice(0, 5).map((row, i) => (
                              <tr key={i} className="border-b border-white/5">
                                {["name","date","time","venue","city","region"].map(h => (
                                  <td key={h} className="px-3 py-2 text-white/80 whitespace-nowrap">{row[h] || "—"}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {importResult && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <p className="text-green-400 text-sm font-medium">
                        {importResult.imported} event{importResult.imported !== 1 ? "s" : ""} imported, {importResult.skipped} duplicate{importResult.skipped !== 1 ? "s" : ""} skipped
                      </p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setShowImportModal(false); setCsvRows([]); setCsvErrors([]); setImportResult(null); }} className="border-white/20 text-white/70">
                    {importResult ? "Close" : "Cancel"}
                  </Button>
                  {csvRows.length > 0 && !importResult && (
                    <Button onClick={submitBulkImport} className="bg-primary hover:bg-primary/90 font-semibold">
                      Import {csvRows.length} Event{csvRows.length !== 1 ? "s" : ""}
                    </Button>
                  )}
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
                <div className="px-6 py-4 border-b border-white/10">
                  <h2 className="font-bold text-white">
                    All Submissions
                    <span className="text-muted-foreground font-normal text-sm ml-2">
                      ({filteredBookings.length}{bookingStatusFilter !== "All" || bookingSearch ? " matching" : ""} of {bookings.length} total)
                    </span>
                  </h2>
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
                          <th className="px-4 py-3 font-medium whitespace-nowrap w-6"></th>
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
                                <td className="px-4 py-4 text-muted-foreground">
                                  {isExpanded
                                    ? <ChevronUp className="w-4 h-4" />
                                    : <ChevronDown className="w-4 h-4" />}
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
                                  <td colSpan={9} className="px-6 py-5">
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
            </div>
          );
        })()}

        {activeTab === "subscribers" && <SubscribersTab />}
        {activeTab === "blog" && <BlogPostsTab />}
        {activeTab === "analytics" && <AnalyticsTab />}
        {activeTab === "team" && <TeamTab currentRole={user.role} />}
      </div>
    </div>
  );
}
