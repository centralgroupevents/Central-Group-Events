import { useState } from "react";
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
import { RichTextEditor } from "@/components/RichTextEditor";
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
  Eye,
  Globe,
  Lock,
  History,
  RotateCcw,
  Send,
  ChevronDown,
  ChevronUp,
  X,
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

type AnalyticsPost = {
  postId: number;
  title: string;
  slug: string;
  totalViews: number;
  totalClicks: number;
};

type AdminMember = {
  id: number;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

type Subscriber = {
  id: number;
  email: string;
  referrer: string | null;
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
  { id: "blog", label: "Blog Posts", icon: BookOpen },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "team", label: "Team & Subscribers", icon: Users },
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
      onLogin(data);
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
/*  BLOG POSTS TAB                                            */
/* ─────────────────────────────────────────────────────────── */
function BlogPostsTab({ role }: { role: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showVersionsFor, setShowVersionsFor] = useState<number | null>(null);

  const [postForm, setPostForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverImageUrl: "",
    isGated: false,
  });

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
      toast({ title: "Post created" });
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

  const publishPost = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/posts/${id}/publish`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/posts/admin"] });
      toast({ title: "Post published" });
    },
    onError: () => toast({ title: "Failed to publish", variant: "destructive" }),
  });

  const unpublishPost = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/posts/${id}/unpublish`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/posts/admin"] });
      toast({ title: "Post unpublished" });
    },
    onError: () => toast({ title: "Failed to unpublish", variant: "destructive" }),
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

  function handlePostSubmit(e: React.FormEvent) {
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

  const isPending = createPost.isPending || updatePost.isPending;

  if (showEditor) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {editingPost ? `Editing: ${editingPost.title}` : "New Post"}
          </h2>
          <Button variant="outline" size="sm" onClick={closeEditor} className="border-white/20 text-white/70">
            <X className="w-4 h-4 mr-1" /> Discard
          </Button>
        </div>

        <form onSubmit={handlePostSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-white/80">Title *</Label>
              <Input
                value={postForm.title}
                onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
                placeholder="Post title"
                className="bg-black/40 border-white/10 h-11"
                data-testid="input-post-title"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-white/80">Slug (auto-generated if blank)</Label>
              <Input
                value={postForm.slug}
                onChange={(e) => setPostForm({ ...postForm, slug: e.target.value })}
                placeholder="my-post-slug"
                className="bg-black/40 border-white/10 h-11"
                data-testid="input-post-slug"
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-white/80">Cover Image URL</Label>
              <Input
                value={postForm.coverImageUrl}
                onChange={(e) => setPostForm({ ...postForm, coverImageUrl: e.target.value })}
                placeholder="https://..."
                className="bg-black/40 border-white/10 h-11"
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
            <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90 font-semibold px-8" data-testid="button-save-post">
              {isPending ? "Saving…" : editingPost ? "Save Changes" : "Create Post"}
            </Button>
            <Button type="button" variant="outline" onClick={closeEditor} className="border-white/20 hover:bg-white/10 text-white/70">
              Cancel
            </Button>
          </div>
        </form>
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
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id}>
              <div
                className="bg-secondary/30 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                data-testid={`card-admin-post-${post.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-white truncate">{post.title}</span>
                    {post.isGated && (
                      <Badge variant="outline" className="border-yellow-500/40 text-yellow-400 text-xs shrink-0">
                        <Lock className="w-2.5 h-2.5 mr-1" /> Gated
                      </Badge>
                    )}
                    {post.isPublished ? (
                      <Badge variant="outline" className="border-green-500/40 text-green-400 text-xs shrink-0">
                        <Globe className="w-2.5 h-2.5 mr-1" /> Published
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-white/20 text-white/40 text-xs shrink-0">
                        Draft
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    /blog/{post.slug} · Updated {formatDate(post.updatedAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {post.isPublished ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => unpublishPost.mutate(post.id)}
                      disabled={unpublishPost.isPending}
                      className="border-white/20 text-white/60 text-xs h-8"
                    >
                      Unpublish
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => publishPost.mutate(post.id)}
                      disabled={publishPost.isPending}
                      className="border-green-500/30 text-green-400 text-xs h-8 hover:bg-green-500/10"
                      data-testid={`button-publish-post-${post.id}`}
                    >
                      <Globe className="w-3 h-3 mr-1" /> Publish
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowVersionsFor(showVersionsFor === post.id ? null : post.id)}
                    className="border-white/20 text-white/60 text-xs h-8"
                    data-testid={`button-versions-${post.id}`}
                  >
                    <History className="w-3 h-3 mr-1" /> Versions
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditPost(post)}
                    className="border-white/20 text-white/60 text-xs h-8"
                    data-testid={`button-edit-post-${post.id}`}
                  >
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (window.confirm(`Delete "${post.title}"?`)) deletePost.mutate(post.id);
                    }}
                    disabled={deletePost.isPending}
                    className="border-red-500/30 text-red-400 text-xs h-8 hover:bg-red-500/10"
                    data-testid={`button-delete-post-${post.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Versions panel */}
              {showVersionsFor === post.id && (
                <div className="ml-4 mt-2 bg-black/30 border border-white/5 rounded-xl p-4">
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
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  ANALYTICS TAB                                             */
/* ─────────────────────────────────────────────────────────── */
function AnalyticsTab() {
  const { data: analyticsData = [], isLoading } = useQuery<AnalyticsPost[]>({
    queryKey: ["/api/admin/analytics"],
  });

  const { data: subscribers = [], isLoading: subsLoading } = useQuery<Subscriber[]>({
    queryKey: ["/api/admin/subscribers"],
  });

  return (
    <div className="space-y-8">
      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-secondary/30 border border-white/10 rounded-xl p-5">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Total Views</p>
          <p className="text-3xl font-black text-white">
            {analyticsData.reduce((s, p) => s + (p.totalViews ?? 0), 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-secondary/30 border border-white/10 rounded-xl p-5">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Total Clicks</p>
          <p className="text-3xl font-black text-white">
            {analyticsData.reduce((s, p) => s + (p.totalClicks ?? 0), 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-secondary/30 border border-white/10 rounded-xl p-5 col-span-2 sm:col-span-1">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Subscribers</p>
          <p className="text-3xl font-black text-white">{subscribers.length.toLocaleString()}</p>
        </div>
      </div>

      {/* Per-post analytics */}
      <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="font-bold text-white">Post Performance</h3>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : analyticsData.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <BarChart2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>No analytics data yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-muted-foreground text-left">
                  <th className="px-6 py-3 font-medium">Post</th>
                  <th className="px-4 py-3 font-medium text-right">Views</th>
                  <th className="px-4 py-3 font-medium text-right">Clicks</th>
                  <th className="px-4 py-3 font-medium text-right">CTR</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.map((p, i) => {
                  const ctr = p.totalViews > 0 ? ((p.totalClicks / p.totalViews) * 100).toFixed(1) : "0.0";
                  return (
                    <tr key={p.postId} className={`border-b border-white/5 hover:bg-white/5 ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`}>
                      <td className="px-6 py-4 font-medium text-white max-w-xs">
                        <span className="truncate block">{p.title}</span>
                        <span className="text-xs text-muted-foreground">/blog/{p.slug}</span>
                      </td>
                      <td className="px-4 py-4 text-right text-white/80">{p.totalViews.toLocaleString()}</td>
                      <td className="px-4 py-4 text-right text-white/80">{p.totalClicks.toLocaleString()}</td>
                      <td className="px-4 py-4 text-right">
                        <span className={`font-medium ${parseFloat(ctr) > 5 ? "text-green-400" : "text-white/60"}`}>{ctr}%</span>
                      </td>
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
}

/* ─────────────────────────────────────────────────────────── */
/*  TEAM & SUBSCRIBERS TAB                                    */
/* ─────────────────────────────────────────────────────────── */
function TeamTab({ currentRole }: { currentRole: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [sendOpen, setSendOpen] = useState(false);
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");

  const { data: team = [], isLoading: teamLoading } = useQuery<AdminMember[]>({
    queryKey: ["/api/admin/team"],
  });

  const { data: subscribers = [], isLoading: subsLoading } = useQuery<Subscriber[]>({
    queryKey: ["/api/admin/subscribers"],
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/invite", { email: inviteEmail, role: inviteRole });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/team"] });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("editor");
      toast({ title: "Invite sent!" });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to send invite";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/team/${id}/deactivate`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/team"] });
      toast({ title: "Account deactivated" });
    },
    onError: () => toast({ title: "Failed to deactivate", variant: "destructive" }),
  });

  const reactivateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/team/${id}/reactivate`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/team"] });
      toast({ title: "Account reactivated" });
    },
    onError: () => toast({ title: "Failed to reactivate", variant: "destructive" }),
  });

  const sendNewsletterMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/newsletter/send", {
        subject: sendSubject,
        body: sendBody,
      });
      return res.json();
    },
    onSuccess: (data) => {
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
              <Plus className="w-4 h-4 mr-1" /> Invite Admin
            </Button>
          )}
        </div>

        {teamLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {team.map((member) => (
              <div
                key={member.id}
                className="bg-secondary/30 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-3"
                data-testid={`row-team-${member.id}`}
              >
                <div>
                  <p className="font-medium text-white">{member.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{member.role} · Joined {formatDate(member.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!member.isActive && (
                    <Badge variant="outline" className="border-red-500/30 text-red-400 text-xs">Deactivated</Badge>
                  )}
                  {currentRole === "superadmin" && (
                    member.isActive ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deactivateMutation.mutate(member.id)}
                        disabled={deactivateMutation.isPending}
                        className="border-red-500/30 text-red-400 text-xs h-8 hover:bg-red-500/10"
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reactivateMutation.mutate(member.id)}
                        disabled={reactivateMutation.isPending}
                        className="border-green-500/30 text-green-400 text-xs h-8 hover:bg-green-500/10"
                      >
                        Reactivate
                      </Button>
                    )
                  )}
                </div>
              </div>
            ))}
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

      {/* Subscribers */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4">
          Subscribers
          <span className="ml-2 text-sm font-normal text-muted-foreground">({subscribers.length} total)</span>
        </h3>
        {subsLoading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : subscribers.length === 0 ? (
          <p className="text-muted-foreground text-sm">No subscribers yet.</p>
        ) : (
          <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-secondary/70 backdrop-blur">
                  <tr className="border-b border-white/10 text-muted-foreground text-left">
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((sub, i) => (
                    <tr key={sub.id} className={`border-b border-white/5 ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`}>
                      <td className="px-4 py-3 text-white/80">{sub.email}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{sub.referrer || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(sub.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="bg-secondary border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite Admin</DialogTitle>
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
            <div className="space-y-2">
              <Label className="text-white/80">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="bg-black/40 border-white/10 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-secondary border-white/10 text-white">
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                </SelectContent>
              </Select>
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
  const [activeTab, setActiveTab] = useState<TabId>("events");
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [form, setForm] = useState<EventForm>(emptyEventForm);

  const { toast } = useToast();
  const qc = useQueryClient();

  /* On mount, check session */
  useQuery<AdminUser>({
    queryKey: ["/api/admin/me"],
    queryFn: async () => {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      if (!res.ok) return null as unknown as AdminUser;
      return res.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select: (data: any) => {
      if (data && data.email) setUser(data);
      return data;
    },
  });

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    enabled: !!user,
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
    enabled: !!user && activeTab === "bookings",
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
                    <Input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. JAZZY FRIDAYS"
                      className="bg-black/40 border-white/10 h-11"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80">City</Label>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="e.g. Fort Lee"
                      className="bg-black/40 border-white/10 h-11"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80">Region *</Label>
                    <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
                      <SelectTrigger className="bg-black/40 border-white/10 h-11">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent className="bg-secondary border-white/10 text-white">
                        <SelectItem value="North NJ">North NJ</SelectItem>
                        <SelectItem value="Central NJ">Central NJ</SelectItem>
                        <SelectItem value="South NJ">South NJ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80">Date *</Label>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="bg-black/40 border-white/10 h-11"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/80">Ticket Link</Label>
                    <Input
                      value={form.ticketLink}
                      onChange={(e) => setForm({ ...form, ticketLink: e.target.value })}
                      placeholder="https://..."
                      className="bg-black/40 border-white/10 h-11"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-white/80">Image URL</Label>
                    <Input
                      value={form.imageUrl}
                      onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                      placeholder="https://..."
                      className="bg-black/40 border-white/10 h-11"
                    />
                  </div>
                  <div className="sm:col-span-2 flex gap-3 pt-2">
                    <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90 font-semibold px-8">
                      {isPending ? "Saving…" : editingEvent ? "Save Changes" : "Create Event"}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm} className="border-white/20 hover:bg-white/10 text-white/70">
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10">
                <h2 className="font-bold text-white">
                  All Events <span className="text-muted-foreground font-normal text-sm ml-2">({events.length} total)</span>
                </h2>
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
                          <td className="px-4 py-4">
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs border border-primary/30 text-primary bg-primary/10">
                              {event.region}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">{event.date}</td>
                          <td className="px-4 py-4 text-muted-foreground max-w-[160px]">
                            {event.ticketLink && event.ticketLink !== "#" ? (
                              <a href={event.ticketLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block">
                                {event.ticketLink}
                              </a>
                            ) : (
                              <span className="text-white/20">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right whitespace-nowrap">
                            <Button variant="outline" size="sm" onClick={() => openEdit(event)} className="border-white/20 hover:bg-white/10 text-white/70 mr-2 text-xs">
                              Edit
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => { if (window.confirm(`Delete "${event.title}"?`)) deleteMutation.mutate(event.id); }} disabled={deleteMutation.isPending} className="border-red-500/30 hover:bg-red-500/10 text-red-400 text-xs">
                              Delete
                            </Button>
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
        {activeTab === "bookings" && (
          <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10">
              <h2 className="font-bold text-white">
                All Submissions <span className="text-muted-foreground font-normal text-sm ml-2">({bookings.length} total)</span>
              </h2>
            </div>
            {bookingsLoading ? (
              <div className="flex justify-center items-center h-40 text-muted-foreground">Loading…</div>
            ) : bookings.length === 0 ? (
              <div className="flex justify-center items-center h-40 text-muted-foreground">No submissions yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-muted-foreground text-left">
                      <th className="px-4 py-3 font-medium">Mode</th>
                      <th className="px-4 py-3 font-medium">Event Name</th>
                      <th className="px-4 py-3 font-medium">Venue</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Region</th>
                      <th className="px-4 py-3 font-medium">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((booking, i) => (
                      <tr key={booking.id} data-testid={`row-booking-${booking.id}`} className={`border-b border-white/5 hover:bg-white/5 ${i % 2 !== 0 ? "bg-white/[0.02]" : ""}`}>
                        <td className="px-4 py-4">
                          <span className={`inline-block px-3 py-0.5 rounded-full text-xs font-semibold border ${booking.mode === "Premium" ? "bg-primary/15 border-primary/40 text-primary" : "bg-white/5 border-white/20 text-white/60"}`}>
                            {booking.mode || "Standard"}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-medium text-white max-w-[180px]"><span className="line-clamp-1">{booking.eventName || "—"}</span></td>
                        <td className="px-4 py-4 text-muted-foreground max-w-[160px]"><span className="line-clamp-1">{booking.venueName}</span></td>
                        <td className="px-4 py-4 text-muted-foreground">
                          <a href={`mailto:${booking.email}`} className="text-primary hover:underline">{booking.email}</a>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs border border-primary/30 text-primary bg-primary/10">
                            {booking.region}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">{formatDate(booking.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "blog" && <BlogPostsTab role={user.role} />}
        {activeTab === "analytics" && <AnalyticsTab />}
        {activeTab === "team" && <TeamTab currentRole={user.role} />}
      </div>
    </div>
  );
}
