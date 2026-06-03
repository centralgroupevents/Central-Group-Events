import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Lock, ArrowRight, BookOpen, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Post = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  isGated: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function truncate(str: string | null, max: number) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max).trimEnd() + "…" : str;
}

function NewsletterSignup() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscribers", { name, email, region });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "You're subscribed! Welcome to the CGE insider list." });
      setName("");
      setEmail("");
      setRegion("");
    },
    onError: () => {
      toast({ title: "Failed to subscribe. Try again.", variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    subscribeMutation.mutate();
  }

  return (
    <div className="mt-20 glass-panel rounded-3xl p-8 box-glow" id="blog-newsletter">
      <div className="max-w-2xl mx-auto text-center">
        <h3 className="text-2xl font-black mb-2">Never Miss an Event</h3>
        <p className="text-muted-foreground mb-8">
          Get the hottest NJ nightlife roundup every week — straight to your inbox.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="bg-black/40 border-white/10 h-11 flex-1"
            data-testid="input-blog-newsletter-name"
          />
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-black/40 border-white/10 h-11 flex-1"
            data-testid="input-blog-newsletter-email"
          />
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="bg-black/40 border-white/10 h-11 w-full sm:w-44">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent className="bg-secondary border-white/10 text-white">
              <SelectItem value="North NJ">North NJ</SelectItem>
              <SelectItem value="Central NJ">Central NJ</SelectItem>
              <SelectItem value="South NJ">South NJ</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="submit"
            disabled={subscribeMutation.isPending}
            className="bg-primary hover:bg-primary/90 h-11 px-6 font-semibold whitespace-nowrap"
            data-testid="button-blog-newsletter-subscribe"
          >
            {subscribeMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>Join Free <ArrowRight className="w-4 h-4 ml-1" /></>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function Blog() {
  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="NJ Weekly Newsletter & Event Roundups — Central Group Events"
        description="Get the weekly NJ event roundup from Central Group Events. Discover the hottest events across North, Central, and South New Jersey every week."
        keywords="NJ events blog, New Jersey weekend events, NJ nightlife guide, weekly events New Jersey, things to do NJ this weekend"
        canonical="https://www.centralgroupevents.com/blog"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Blog",
            "name": "Central Group Events Blog",
            "url": "https://www.centralgroupevents.com/blog",
            "description": "Weekly NJ event roundups and nightlife guides",
            "publisher": { "@id": "https://www.centralgroupevents.com/#organization" },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.centralgroupevents.com/" },
              { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://www.centralgroupevents.com/blog" },
            ],
          },
        ]}
      />
      <Navigation />

      {/* Header */}
      <section className="pt-28 pb-12 text-center px-4">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm font-bold text-primary tracking-widest uppercase mb-3">The CGE Newsletter</p>
          <h1 className="text-4xl md:text-6xl font-black mb-4">NJ Nightlife, Served Weekly.</h1>
          <p className="text-lg text-muted-foreground">
            Weekly NJ event roundups delivered to your inbox. Subscribe for free.
          </p>
        </div>
      </section>

      {/* Posts grid */}
      <section className="max-w-5xl mx-auto px-4 pb-24">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <div className="p-5 space-y-3">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-bold mb-2">No posts yet</h3>
            <p className="text-muted-foreground">Check back soon — content is coming!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <article
                  data-testid={`card-post-${post.id}`}
                  className="group bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden hover:border-primary/40 hover:bg-secondary/50 transition-all duration-300 cursor-pointer h-full flex flex-col"
                >
                  {/* Cover Image */}
                  <div className="relative h-48 overflow-hidden">
                    {post.coverImageUrl ? (
                      <img
                        src={post.coverImageUrl}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/10 to-transparent" />
                    )}
                    {post.isGated && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/70 border border-white/20 text-white/80 text-xs font-medium backdrop-blur-sm">
                        <Lock className="w-3 h-3" />
                        Subscribers Only
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5 flex flex-col flex-1">
                    {post.publishedAt && (
                      <p className="text-xs text-muted-foreground mb-2">{formatDate(post.publishedAt)}</p>
                    )}
                    <h2 className="text-lg font-bold text-white mb-2 leading-snug group-hover:text-primary transition-colors">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                        {truncate(post.excerpt, 120)}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-4 text-sm text-primary font-medium">
                      Read More <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}

        {/* Inline newsletter signup */}
        <NewsletterSignup />
      </section>
    </div>
  );
}
