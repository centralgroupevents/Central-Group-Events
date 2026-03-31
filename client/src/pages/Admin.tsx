import { useState, useEffect } from "react";
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
} from "lucide-react";
import cgeLogo from "@assets/CGE_logo_1772075137138.png";

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
  city: string;
  region: string;
  date: string;
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
  city: "",
  region: "",
  date: "",
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
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

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
        const lines = text.split(/\r?\n/).filter(Boolean);
        const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/"/g, ""));
        const emailIdx = header.findIndex((h) => h === "email");
        if (emailIdx === -1) {
          toast({ title: "CSV Error", description: "No 'email' column found.", variant: "destructive" });
          setImporting(false);
          return;
        }
        rows = lines.slice(1).map((line) => {
          const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));
          return { email: cols[emailIdx] };
        }).filter((r) => r.email);
      } else if (importTab === "paste") {
        rows = pasteText
          .split(/[\r\n,;]+/)
          .map((e) => e.trim())
          .filter((e) => e.includes("@"))
          .map((email) => ({ email }));
      }
      if (rows.length === 0) {
        toast({ title: "No emails found", description: "Please provide at least one valid email.", variant: "destructive" });
        setImporting(false);
        return;
      }
      const res = await apiRequest("POST", "/api/subscribers/import", rows);
      const result = await res.json();
      setImportResult(result);
      qc.invalidateQueries({ queryKey: ["/api/admin/subscribers"] });
    } catch {
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
            <div className="mt-2 p-3 rounded-lg bg-white/5 border border-white/10 text-sm">
              <p className="text-green-400 font-semibold">✓ {importResult.imported} imported</p>
              {importResult.skipped > 0 && <p className="text-white/50 mt-0.5">{importResult.skipped} skipped (duplicates or invalid)</p>}
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
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [form, setForm] = useState<EventForm>(emptyEventForm);

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

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
    enabled: !!user && activeTab === "bookings",
  });

  const updateBookingStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/bookings/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bookings"] });
    },
    onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: async (data: EventForm) => {
      const res = await apiRequest("POST", "/api/events", {
        title: data.title,
        city: data.city || null,
        region: data.region,
        date: data.date,
        ticketLink: data.ticketLink || "#",
        imageUrl: data.imageUrl || "",
        description: data.city ? `Live event in ${data.city}, NJ` : "CGE Event",
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      resetForm();
      toast({ title: "Event created" });
    },
    onError: () => toast({ title: "Failed to create event", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EventForm }) => {
      const res = await apiRequest("PUT", `/api/events/${id}`, {
        title: data.title,
        city: data.city || null,
        region: data.region,
        date: data.date,
        ticketLink: data.ticketLink || "#",
        imageUrl: data.imageUrl || "",
        description: data.city ? `Live event in ${data.city}, NJ` : "CGE Event",
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      resetForm();
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
    setShowForm(true);
  }

  function openEdit(event: Event) {
    setEditingEvent(event);
    setForm({
      title: event.title,
      city: event.city || "",
      region: event.region,
      date: event.date,
      ticketLink: event.ticketLink || "",
      imageUrl: event.imageUrl || "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setShowForm(false);
    setEditingEvent(null);
    setForm(emptyEventForm);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.region || !form.date) {
      toast({ title: "Title, Region, and Date are required", variant: "destructive" });
      return;
    }
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  /* Show nothing until session check completes */
  if (!sessionChecked) return null;

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-background text-foreground">
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
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Events</h2>
              {!showForm && (
                <Button onClick={openAdd} className="bg-primary hover:bg-primary/90 font-semibold" data-testid="button-add-event">
                  <Plus className="w-4 h-4 mr-1" /> Add Event
                </Button>
              )}
            </div>

            {showForm && (
              <div className="bg-secondary/40 border border-white/10 rounded-2xl p-6 mb-8">
                <h2 className="text-xl font-bold text-white mb-6">
                  {editingEvent ? `Editing: ${editingEvent.title}` : "Add New Event"}
                </h2>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-white/80">Event Title *</Label>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. JAZZY FRIDAYS" className="bg-black/40 border-white/10 h-11" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80">City</Label>
                    <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Fort Lee" className="bg-black/40 border-white/10 h-11" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80">Region *</Label>
                    <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
                      <SelectTrigger className="bg-black/40 border-white/10 h-11"><SelectValue placeholder="Select region" /></SelectTrigger>
                      <SelectContent className="bg-secondary border-white/10 text-white">
                        <SelectItem value="North NJ">North NJ</SelectItem>
                        <SelectItem value="Central NJ">Central NJ</SelectItem>
                        <SelectItem value="South NJ">South NJ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80">Date *</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-black/40 border-white/10 h-11" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80">Ticket Link</Label>
                    <Input value={form.ticketLink} onChange={(e) => setForm({ ...form, ticketLink: e.target.value })} placeholder="https://..." className="bg-black/40 border-white/10 h-11" />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-white/80">Event Image</Label>
                    <ImageUpload
                      value={form.imageUrl}
                      onChange={(url) => setForm({ ...form, imageUrl: url })}
                    />
                  </div>
                  <div className="sm:col-span-2 flex gap-3 pt-2">
                    <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90 font-semibold px-8">
                      {isPending ? "Saving…" : editingEvent ? "Save Changes" : "Create Event"}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm} className="border-white/20 hover:bg-white/10 text-white/70">Cancel</Button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10">
                <h2 className="font-bold text-white">All Events <span className="text-muted-foreground font-normal text-sm ml-2">({events.length} total)</span></h2>
              </div>
              {isLoading ? (
                <div className="flex justify-center items-center h-40 text-muted-foreground">Loading…</div>
              ) : events.length === 0 ? (
                <div className="flex justify-center items-center h-40 text-muted-foreground">No events yet. Add one above.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-muted-foreground text-left">
                        <th className="px-6 py-3 font-medium">Title</th>
                        <th className="px-4 py-3 font-medium">City</th>
                        <th className="px-4 py-3 font-medium">Region</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Ticket Link</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((event, i) => (
                        <tr key={event.id} className={`border-b border-white/5 hover:bg-white/5 ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`}>
                          <td className="px-6 py-4 font-medium text-white max-w-xs"><span className="line-clamp-2">{event.title}</span></td>
                          <td className="px-4 py-4 text-muted-foreground">{event.city || "—"}</td>
                          <td className="px-4 py-4"><span className="inline-block px-2 py-0.5 rounded-full text-xs border border-primary/30 text-primary bg-primary/10">{event.region}</span></td>
                          <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">{event.date}</td>
                          <td className="px-4 py-4 text-muted-foreground max-w-[160px]">
                            {event.ticketLink && event.ticketLink !== "#" ? (
                              <a href={event.ticketLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block">{event.ticketLink}</a>
                            ) : (
                              <span className="text-white/20">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right whitespace-nowrap">
                            <Button variant="outline" size="sm" onClick={() => openEdit(event)} className="border-white/20 hover:bg-white/10 text-white/70 mr-2 text-xs">Edit</Button>
                            <Button variant="outline" size="sm" onClick={() => { if (window.confirm(`Delete "${event.title}"?`)) deleteMutation.mutate(event.id); }} disabled={deleteMutation.isPending} className="border-red-500/30 hover:bg-red-500/10 text-red-400 text-xs">Delete</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
          const filteredBookings = bookingStatusFilter === "All"
            ? bookings
            : bookings.filter((b) => (b.status || "New") === bookingStatusFilter);

          return (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-muted-foreground font-medium">Filter by status:</span>
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

              <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10">
                  <h2 className="font-bold text-white">
                    All Submissions
                    <span className="text-muted-foreground font-normal text-sm ml-2">
                      ({filteredBookings.length}{bookingStatusFilter !== "All" ? ` ${bookingStatusFilter}` : ""} of {bookings.length} total)
                    </span>
                  </h2>
                </div>
                {bookingsLoading ? (
                  <div className="flex justify-center items-center h-40 text-muted-foreground">Loading…</div>
                ) : filteredBookings.length === 0 ? (
                  <div className="flex justify-center items-center h-40 text-muted-foreground">
                    {bookings.length === 0 ? "No submissions yet." : `No ${bookingStatusFilter} submissions.`}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-muted-foreground text-left">
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Status</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Mode</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Event Name</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Venue</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Contact</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Phone</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Email</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">City</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Region</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Event Date</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Time</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Event Type</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Budget</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Instagram</th>
                          <th className="px-4 py-3 font-medium whitespace-nowrap">Submitted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBookings.map((booking, i) => {
                          const currentStatus = booking.status || "New";
                          const eventType = (booking as any).eventTypeOther || (booking as any).eventType || "—";
                          return (
                            <tr key={booking.id} data-testid={`row-booking-${booking.id}`} className={`border-b border-white/5 hover:bg-white/5 ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`}>
                              <td className="px-4 py-4">
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
                              <td className="px-4 py-4 font-medium text-white max-w-[180px]"><span className="line-clamp-1">{booking.eventName || "—"}</span></td>
                              <td className="px-4 py-4 text-muted-foreground max-w-[160px]"><span className="line-clamp-1">{booking.venueName || "—"}</span></td>
                              <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">{(booking as any).contactName || "—"}</td>
                              <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">{(booking as any).phone || "—"}</td>
                              <td className="px-4 py-4 text-muted-foreground">
                                <a href={`mailto:${booking.email}`} className="text-primary hover:underline whitespace-nowrap">{booking.email}</a>
                              </td>
                              <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">{(booking as any).city || "—"}</td>
                              <td className="px-4 py-4">
                                <span className="inline-block px-2 py-0.5 rounded-full text-xs border border-primary/30 text-primary bg-primary/10">{booking.region}</span>
                              </td>
                              <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">
                                {(booking as any).eventDate
                                  ? new Date((booking as any).eventDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                  : "—"}
                              </td>
                              <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">{(booking as any).eventTime || "—"}</td>
                              <td className="px-4 py-4 text-muted-foreground max-w-[140px]"><span className="line-clamp-1">{eventType}</span></td>
                              <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">{(booking as any).budgetRange || "—"}</td>
                              <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">
                                {(booking as any).instagramHandle
                                  ? <a href={`https://instagram.com/${(booking as any).instagramHandle.replace("@","")}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@{(booking as any).instagramHandle.replace("@","")}</a>
                                  : "—"}
                              </td>
                              <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">{formatDate(booking.createdAt)}</td>
                            </tr>
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
