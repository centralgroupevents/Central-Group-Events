import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { EventBrowser } from "@/components/EventBrowser";
import { RichTextViewer } from "@/components/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getQueryFn } from "@/lib/queryClient";
import type { Page } from "@shared/schema";

const SLUG = "things-to-do-in-nj";

interface AdSlot {
  imageUrl?: string;
  linkUrl?: string;
  alt?: string;
  caption?: string;
}

function parseAdSlot(raw: string | null | undefined): AdSlot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.imageUrl) return parsed;
    return null;
  } catch {
    return null;
  }
}

function AdCaption({ caption }: { caption: string | undefined }) {
  if (!caption || !caption.trim()) return null;
  return (
    <p className="text-xs text-white/60 mt-2 px-1 leading-relaxed">{caption}</p>
  );
}

function AdBanner({ slot, label }: { slot: AdSlot | null; label: string }) {
  if (!slot || !slot.imageUrl) return null;
  const frame = (
    <div className="aspect-[2/1] overflow-hidden rounded-2xl border border-white/10">
      <img
        src={slot.imageUrl}
        alt={slot.alt || label}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
  return (
    <div className="my-10" data-testid={`ad-slot-${label.toLowerCase()}`}>
      {slot.linkUrl ? (
        <a href={slot.linkUrl} target="_blank" rel="noopener noreferrer sponsored" aria-label={slot.alt || label}>
          {frame}
        </a>
      ) : (
        frame
      )}
      <AdCaption caption={slot.caption} />
    </div>
  );
}

function UnlockPrompt() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setError("");
    setLoading(true);
    try {
      const subRes = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, region: region || undefined, name: "" }),
        credentials: "include",
      });
      if (!subRes.ok && subRes.status !== 409) {
        const body = await subRes.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message || "Failed to subscribe");
      }
      const checkRes = await fetch("/api/subscriber/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, referrer: document.referrer }),
        credentials: "include",
      });
      if (!checkRes.ok) throw new Error("Could not verify access. Try again.");
      if (typeof window !== "undefined") {
        localStorage.setItem("cge_newsletter_subscribed", "true");
      }
      await qc.invalidateQueries({ queryKey: ["/api/subscriber/verify"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto my-10" data-testid="things-to-do-unlock-prompt">
      <div className="bg-primary/10 border border-primary/30 rounded-3xl p-8 backdrop-blur-md text-center space-y-5 shadow-2xl">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-white">Want the full list?</h2>
          <p className="text-sm text-muted-foreground">
            Drop your email to unlock the rest of this week's events — plus our weekly NJ newsletter. Free, no spam.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-black/40 border-white/10 h-11 text-white rounded-xl"
            data-testid="input-things-to-do-email"
          />
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="h-11 bg-black/40 border-white/10 text-sm rounded-xl" data-testid="select-things-to-do-region">
              <SelectValue placeholder="Region (optional)" />
            </SelectTrigger>
            <SelectContent className="bg-secondary border-white/10 text-white">
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="North NJ">North NJ</SelectItem>
              <SelectItem value="Central NJ">Central NJ</SelectItem>
              <SelectItem value="South NJ">South NJ</SelectItem>
            </SelectContent>
          </Select>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl"
            data-testid="button-things-to-do-subscribe"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Unlock the full list"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function ThingsToDo() {
  const { data: page } = useQuery<Page | null>({
    queryKey: [`/api/pages/${SLUG}`],
  });

  const { data: subVerify, isLoading: verifyLoading } = useQuery<{ access: boolean }>({
    queryKey: ["/api/subscriber/verify"],
  });
  // Admins bypass the email gate so they can preview what they've published
  // (saved sponsored slots, hero image, etc.) without having to subscribe.
  const { data: adminMe } = useQuery<{ email: string; role: string } | null>({
    queryKey: ["/api/admin/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });
  const isAdmin = !!adminMe?.email;
  const hasAccess = !!subVerify?.access || isAdmin;

  const adTop = parseAdSlot(page?.adSlotTop);
  const adMid = parseAdSlot(page?.adSlotMid);
  const adBottom = parseAdSlot(page?.adSlotBottom);
  const adSidebar = parseAdSlot((page as any)?.adSlotSidebar);

  const heroTitle = page?.title?.trim() || "Things to Do in NJ This Week";
  const description = "Fun and creative events across North, Central, and South New Jersey — curated weekly. Brunches, concerts, day parties, dance nights, and more.";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title={heroTitle}
        description={description}
        canonical={`https://www.centralgroupevents.com/${SLUG}`}
        keywords="things to do in nj, things to do in new jersey, events in nj, fun things to do nj, weekend events nj, nj nightlife, nj brunch"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.centralgroupevents.com/" },
            { "@type": "ListItem", "position": 2, "name": "Things to Do in NJ", "item": `https://www.centralgroupevents.com/${SLUG}` },
          ],
        }}
      />
      <Navigation />

      <section className="pt-32 pb-20 relative overflow-clip">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />

        {verifyLoading ? (
          <div className="flex justify-center items-center min-h-[60vh]">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : (
        <>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Hero / cover */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4">
              {heroTitle}
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {description}
            </p>
          </motion.div>

          {page?.heroImageUrl && (
            <div className="mb-10">
              <img
                src={page.heroImageUrl}
                alt={heroTitle}
                className="w-full h-auto rounded-3xl border border-white/10"
              />
            </div>
          )}

          {/* Top ad slot */}
          <AdBanner slot={adTop} label="Top" />

          {/* Editor content (admin-curated intro / picks) */}
          {page?.editorContent && page.editorContent.trim().length > 0 && (
            <article className="mb-12">
              <RichTextViewer content={page.editorContent} />
            </article>
          )}
        </div>

        {/* Events list with optional sticky sidebar ad. Mid ad renders inline inside the list. */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* `items-stretch` (default) is required for the sidebar `position: sticky`
              to behave correctly — flex `items-start` would shrink the aside to its
              natural height and the sticky child would scroll out of view with it. */}
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 min-w-0">
              <EventBrowser
                pinFeatured
                maxItems={hasAccess ? undefined : 5}
                inlineAd={
                  adMid && adMid.imageUrl ? (
                    <div>
                      {adMid.linkUrl ? (
                        <a
                          href={adMid.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer sponsored"
                          aria-label={adMid.alt || "Sponsored"}
                          className="block aspect-[2/1] overflow-hidden rounded-xl border border-white/10"
                        >
                          <img src={adMid.imageUrl} alt={adMid.alt || "Sponsored"} className="w-full h-full object-cover" loading="lazy" />
                        </a>
                      ) : (
                        <div className="aspect-[2/1] overflow-hidden rounded-xl border border-white/10">
                          <img src={adMid.imageUrl} alt={adMid.alt || "Sponsored"} className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      )}
                      <AdCaption caption={adMid.caption} />
                    </div>
                  ) : undefined
                }
              />
            </div>

            {adSidebar && adSidebar.imageUrl && (
              <aside className="lg:w-72 lg:flex-shrink-0" data-testid="ad-slot-sidebar">
                <div className="lg:sticky lg:top-24">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2 px-1">Sponsored</p>
                  {adSidebar.linkUrl ? (
                    <a href={adSidebar.linkUrl} target="_blank" rel="noopener noreferrer sponsored" aria-label={adSidebar.alt || "Sponsored"} className="block aspect-[2/1] overflow-hidden rounded-2xl border border-white/10">
                      <img src={adSidebar.imageUrl} alt={adSidebar.alt || "Sponsored"} className="w-full h-full object-cover" loading="lazy" />
                    </a>
                  ) : (
                    <div className="aspect-[2/1] overflow-hidden rounded-2xl border border-white/10">
                      <img src={adSidebar.imageUrl} alt={adSidebar.alt || "Sponsored"} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  )}
                  <AdCaption caption={adSidebar.caption} />
                </div>
              </aside>
            )}
          </div>
        </div>

        {/* Inline unlock prompt — replaces the old hard email gate so 5 teaser events
            are crawl-able and visible to first-time visitors. */}
        {!hasAccess && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <UnlockPrompt />
          </div>
        )}

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Bottom ad slot */}
          <AdBanner slot={adBottom} label="Bottom" />
        </div>
        </>
        )}
      </section>
    </div>
  );
}
