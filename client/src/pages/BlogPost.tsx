import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Lock, MessageSquare, Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RichTextViewer } from "@/components/RichTextEditor";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { SubscribeModal } from "@/components/SubscribeModal";
import { useToast } from "@/hooks/use-toast";

type Post = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  coverImageUrl: string | null;
  isGated: boolean;
  gated?: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  message?: string;
};

type Comment = {
  id: number;
  postId: number;
  parentId: number | null;
  email: string;
  body: string;
  createdAt: string;
};

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local[0]}***@${domain}`;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function getTeaser(html: string | null, wordLimit = 150) {
  if (!html) return "";
  const text = stripHtml(html);
  const words = text.split(" ");
  return words.length <= wordLimit ? text : words.slice(0, wordLimit).join(" ") + "…";
}

function rewriteLinks(html: string, postId: number): string {
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (_match, url) => {
    const encoded = encodeURIComponent(url);
    return `href="/go?url=${encoded}&postId=${postId}"`;
  });
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface CommentItemProps {
  comment: Comment;
  replies: Comment[];
  hasAccess: boolean;
  postId: number;
  onReply: (parentId: number) => void;
}

function CommentItem({ comment, replies, hasAccess, postId, onReply }: CommentItemProps) {
  return (
    <div className="space-y-3">
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-primary">{maskEmail(comment.email)}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(comment.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
        <p className="text-sm text-white/80 leading-relaxed">{comment.body}</p>
        {hasAccess && (
          <button
            onClick={() => onReply(comment.id)}
            className="mt-2 text-xs text-muted-foreground hover:text-white transition-colors"
          >
            Reply
          </button>
        )}
      </div>
      {replies.length > 0 && (
        <div className="ml-6 space-y-3">
          {replies.map((reply) => (
            <div key={reply.id} className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-primary">{maskEmail(reply.email)}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(reply.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <p className="text-sm text-white/80 leading-relaxed">{reply.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BlogPost({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const { toast } = useToast();
  const qc = useQueryClient();

  const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [replyToId, setReplyToId] = useState<number | null>(null);

  const { data: post, isLoading: postLoading } = useQuery<Post>({
    queryKey: ["/api/posts", slug],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${slug}`, { credentials: "include" });
      if (res.status === 404) throw new Error("Post not found");
      return res.json();
    },
    retry: false,
  });

  const { data: subVerify } = useQuery<{ access: boolean }>({
    queryKey: ["/api/subscriber/verify"],
  });

  const hasAccess = !!subVerify?.access;
  // Backend returns `gated: true` (without content) for unauthorized gated posts
  // We treat the post as requiring a gate if isGated is true AND we don't have access
  const isGated = !!(post?.isGated || post?.gated);

  const { data: comments = [], isLoading: commentsLoading } = useQuery<Comment[]>({
    queryKey: ["/api/posts", post?.id, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${post!.id}/comments`, { credentials: "include" });
      return res.json();
    },
    enabled: !!post?.id && !postLoading,
  });

  const commentMutation = useMutation({
    mutationFn: async ({ body, parentId }: { body: string; parentId: number | null }) => {
      const res = await fetch(`/api/posts/${post!.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, parentId }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to post comment");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/posts", post?.id, "comments"] });
      setCommentBody("");
      setReplyToId(null);
      toast({ title: "Comment posted!" });
    },
    onError: () => toast({ title: "Failed to post comment", variant: "destructive" }),
  });

  function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    commentMutation.mutate({ body: commentBody.trim(), parentId: replyToId });
  }

  const topComments = comments.filter((c) => c.parentId === null);
  const getReplies = (id: number) => comments.filter((c) => c.parentId === id);

  if (postLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <div className="max-w-3xl mx-auto px-4 pt-28 pb-24 space-y-6">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-4 w-1/4" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!post && !postLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <div className="max-w-3xl mx-auto px-4 pt-28 pb-24 text-center">
          <h1 className="text-3xl font-black text-white mb-4">Post Not Found</h1>
          <p className="text-muted-foreground mb-6">The post you're looking for doesn't exist or has been removed.</p>
          <Link href="/blog" className="text-primary hover:underline">← Back to Blog</Link>
        </div>
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {post && !postLoading && (
        <>
          <SEO
            title={post.title}
            description={post.excerpt || `${post.title} — Central Group Events`}
            keywords={`NJ events, New Jersey nightlife, Central Group Events, ${post.title}`}
            canonical={`https://www.centralgroupevents.com/blog/${slug}`}
            image={post.coverImageUrl || undefined}
            type="article"
            publishedAt={post.publishedAt}
            jsonLd={[
              {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": post.title,
                "description": post.excerpt,
                "image": post.coverImageUrl,
                "datePublished": post.publishedAt,
                "mainEntityOfPage": `https://www.centralgroupevents.com/blog/${slug}`,
                "author": { "@type": "Organization", "name": "Central Group Events" },
                "publisher": {
                  "@type": "Organization",
                  "name": "Central Group Events",
                  "url": "https://www.centralgroupevents.com",
                  "logo": { "@type": "ImageObject", "url": "https://www.centralgroupevents.com/favicon.png" },
                },
              },
              {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                  { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.centralgroupevents.com/" },
                  { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://www.centralgroupevents.com/blog" },
                  { "@type": "ListItem", "position": 3, "name": post.title, "item": `https://www.centralgroupevents.com/blog/${slug}` },
                ],
              },
            ]}
          />
        </>
      )}
      <Navigation />
      <div className="max-w-3xl mx-auto px-4 pt-28 pb-24">
        {/* Back link */}
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Blog
        </Link>

        {/* Cover image */}
        {post.coverImageUrl && (
          <div className="h-64 md:h-80 rounded-2xl overflow-hidden mb-8">
            <img src={post.coverImageUrl} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Title + meta */}
        <div className="mb-8">
          {post.isGated && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-medium mb-4">
              <Lock className="w-3 h-3" /> Subscribers Only
            </div>
          )}
          <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-3">{post.title}</h1>
          {post.publishedAt && (
            <p className="text-sm text-muted-foreground">{formatDate(post.publishedAt)}</p>
          )}
        </div>

        {/* Content or Gate */}
        {isGated && !hasAccess ? (
          <div className="relative">
            {/* Teaser — use excerpt if content was omitted by backend's gated response */}
            <div className="text-white/80 leading-relaxed text-base line-clamp-6">
              {post.content
                ? getTeaser(post.content)
                : post.excerpt ?? "Subscribe to read this post."}
            </div>

            {/* Gate overlay */}
            <div className="relative mt-4 rounded-2xl overflow-hidden border border-white/10">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background backdrop-blur-md" />
              <div className="relative z-10 p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-white">This post is for CGE subscribers only.</h3>
                <p className="text-muted-foreground text-sm">Enter your email to get instant access — it's free.</p>
                <Button
                  className="bg-primary hover:bg-primary/90 h-11 px-8 font-semibold mx-auto"
                  onClick={() => setSubscribeModalOpen(true)}
                  data-testid="button-get-access"
                >
                  Get Access
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-12">
            <RichTextViewer content={rewriteLinks(post.content ?? "", post.id)} />
          </div>
        )}

        {/* Newsletter CTA */}
        {(!isGated || hasAccess) && (
          <div className="glass-panel rounded-2xl p-6 text-center mb-12">
            <p className="text-muted-foreground text-sm mb-3">
              Enjoying CGE content? Join the insider newsletter — free, every week.
            </p>
            <a
              href="/#newsletter"
              className="inline-flex items-center gap-2 text-sm text-primary font-medium hover:underline"
            >
              Subscribe for free →
            </a>
          </div>
        )}

        {/* Comments Section */}
        <div className="border-t border-white/10 pt-10">
          <div className="flex items-center gap-2 mb-6">
            <MessageSquare className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-bold text-white">
              Comments {comments.length > 0 && <span className="text-muted-foreground font-normal text-sm">({comments.length})</span>}
            </h3>
          </div>

          {commentsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-muted-foreground text-sm mb-6">No comments yet. Be the first!</p>
          ) : (
            <div className="space-y-4 mb-8">
              {topComments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  replies={getReplies(comment.id)}
                  hasAccess={hasAccess}
                  postId={post.id}
                  onReply={(id) => { setReplyToId(id); setCommentBody(""); }}
                />
              ))}
            </div>
          )}

          {/* Comment input */}
          {hasAccess ? (
            <form onSubmit={handleCommentSubmit} className="space-y-3">
              {replyToId && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  Replying to comment #{replyToId}
                  <button type="button" onClick={() => setReplyToId(null)} className="text-primary hover:underline">
                    Cancel
                  </button>
                </div>
              )}
              <Textarea
                placeholder="Write a comment…"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                className="bg-black/40 border-white/10 min-h-[100px] resize-none"
                data-testid="textarea-comment"
              />
              <Button
                type="submit"
                disabled={commentMutation.isPending || !commentBody.trim()}
                className="bg-primary hover:bg-primary/90 font-semibold"
                data-testid="button-submit-comment"
              >
                <Send className="w-4 h-4 mr-2" />
                {commentMutation.isPending ? "Posting…" : "Post Comment"}
              </Button>
            </form>
          ) : (
            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5 text-center">
              <p className="text-muted-foreground text-sm mb-4">
                Log in as a subscriber to join the discussion.
              </p>
              <Button
                className="bg-primary hover:bg-primary/90 h-10 px-6 font-semibold text-sm"
                onClick={() => setSubscribeModalOpen(true)}
                data-testid="button-comments-get-access"
              >
                Get Access
              </Button>
            </div>
          )}
        </div>
      </div>

      <SubscribeModal
        open={subscribeModalOpen}
        onOpenChange={setSubscribeModalOpen}
        redirectAfter={slug}
      />
    </div>
  );
}
