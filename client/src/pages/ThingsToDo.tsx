import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { EventBrowser } from "@/components/EventBrowser";
import { EventsJsonLd } from "@/components/EventsJsonLd";
import { RichTextViewer } from "@/components/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getQueryFn } from "@/lib/queryClient";
import { ConsentNotice } from "@/components/ConsentNotice";
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

interface AdCarousel {
  images?: string[];
  linkUrl?: string;
  alt?: string;
  caption?: string;
}

function parseAdCarousel(raw: string | null | undefined): AdCarousel | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.images) && parsed.images.filter(Boolean).length > 0) {
      return { ...parsed, images: parsed.images.filter(Boolean) };
    }
    return null;
  } catch {
    return null;
  }
}

// Rotating sponsored photo slot — any number of images, cycled with a fade.
// Starts at a random image per page load so every client gets fair
// first-position time.
function AdPhotoCarousel({ slot }: { slot: AdCarousel | null }) {
  const images = slot?.images ?? [];
  const [idx, setIdx] = useState(() => (images.length > 0 ? Math.floor(Math.random() * images.length) : 0));
  useEffect(() => {
    if (images.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % images.length), 3500);
    return () => clearInterval(t);
  }, [images.length]);
  if (!slot || images.length === 0) return null;
  const frame = (
    <div className="relative aspect-[2/1] overflow-hidden rounded-2xl border border-white/10" data-testid="ad-slot-carousel">
      {images.map((src, i) => (
        <img
          key={`${i}-${src.slice(-24)}`}
          src={src}
          alt={slot.alt || "Sponsored"}
          loading={i === idx ? "eager" : "lazy"}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          style={{ opacity: i === idx ? 1 : 0 }}
        />
      ))}
      {images.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
          {images.map((_, i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === idx ? "bg-white" : "bg-white/35"}`} />
          ))}
        </div>
      )}
    </div>
  );
  return (
    <div>
      {slot.linkUrl ? (
        <a href={slot.linkUrl} target="_blank" rel="noopener noreferrer sponsored" aria-label={slot.alt || "Sponsored"}>{frame}</a>
      ) : frame}
      <AdCaption caption={slot.caption} />
    </div>
  );
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    if (!trimmedEmail || !trimmedName || !region) {
      setError("Please fill in your name, email, and NJ region.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const landingPath = typeof window !== "undefined" ? window.location.pathname : undefined;
      const referrer = typeof document !== "undefined" ? document.referrer || undefined : undefined;
      const utmSource = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("utm_source") || undefined
        : undefined;
      const subRes = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, region, name: trimmedName, referrer, landingPath, utmSource }),
        credentials: "include",
      });
      if (!subRes.ok && subRes.status !== 409) {
        const body = await subRes.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message || "Failed to subscribe");
      }
      const checkRes = await fetch("/api/subscriber/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, referrer: document.referrer }),
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
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="bg-black/40 border-white/10 h-11 text-white rounded-xl"
            data-testid="input-things-to-do-name"
          />
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
              <SelectValue placeholder="What part of NJ are you in?" />
            </SelectTrigger>
            <SelectContent className="bg-secondary border-white/10 text-white">
              <SelectItem value="North NJ">North NJ</SelectItem>
              <SelectItem value="Central NJ">Central NJ</SelectItem>
              <SelectItem value="South NJ">South NJ</SelectItem>
              <SelectItem value="All">All over / not sure</SelectItem>
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
          <ConsentNotice className="text-center" />
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
  const adSidebar2 = parseAdSlot((page as any)?.adSlotSidebar2);
  const adCarousel = parseAdCarousel((page as any)?.adSlotCarousel);

  const heroTitle = page?.title?.trim() || "Things to Do in NJ This Week";
  const description = "Fun and creative events across North, Central, and South New Jersey — curated weekly. Brunches, concerts, day parties, dance nights, and more.";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title={heroTitle}
        description={description}
        canonical={`https://centralgroupevents.com/${SLUG}`}
        keywords="things to do in nj, things to do in new jersey, events in nj, fun things to do nj, weekend events nj, nj nightlife, nj brunch"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://centralgroupevents.com/" },
            { "@type": "ListItem", "position": 2, "name": "Things to Do in NJ", "item": `https://centralgroupevents.com/${SLUG}` },
          ],
        }}
      />
      <EventsJsonLd maxItems={hasAccess ? 30 : 5} />
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

            {((adSidebar && adSidebar.imageUrl) || (adSidebar2 && adSidebar2.imageUrl) || adCarousel) && (
              <aside className="lg:w-72 lg:flex-shrink-0" data-testid="ad-slot-sidebar">
                {/* Two sticky sponsor cards + the rotating photo slot travel
                    together as the list scrolls. On mobile the rail stacks
                    under the list so events stay first. */}
                <div className="lg:sticky lg:top-24 space-y-6">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 px-1">Sponsored</p>
                  {[adSidebar, adSidebar2].map((slot, i) =>
                    slot && slot.imageUrl ? (
                      <div key={i} data-testid={`ad-slot-sidebar-${i + 1}`}>
                        {slot.linkUrl ? (
                          <a href={slot.linkUrl} target="_blank" rel="noopener noreferrer sponsored" aria-label={slot.alt || "Sponsored"} className="block aspect-[2/1] overflow-hidden rounded-2xl border border-white/10">
                            <img src={slot.imageUrl} alt={slot.alt || "Sponsored"} className="w-full h-full object-cover" loading="lazy" />
                          </a>
                        ) : (
                          <div className="aspect-[2/1] overflow-hidden rounded-2xl border border-white/10">
                            <img src={slot.imageUrl} alt={slot.alt || "Sponsored"} className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        )}
                        <AdCaption caption={slot.caption} />
                      </div>
                    ) : null,
                  )}
                  <AdPhotoCarousel slot={adCarousel} />
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

        {/* Browse-by sections — internal links to all topic landing pages.
            Topical-authority signal for Google, navigation aid for users. */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-12 space-y-12 border-t border-white/5 mt-12">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white mb-2">Browse by region</h2>
            <p className="text-muted-foreground text-sm mb-6">Weekly-updated landing pages for each part of the state.</p>
            <div className="flex flex-wrap gap-3 mb-10">
              {[
                ["this-weekend-in-nj", "This Weekend in NJ"],
                ["north-nj", "Events in North Jersey"],
                ["central-nj", "Events in Central Jersey"],
                ["south-nj", "Events in South Jersey"],
              ].map(([slug, label]) => (
                <a key={slug} href={`/events/${slug}`} className="text-sm px-4 py-2 rounded-full border border-white/15 text-white/80 hover:border-primary hover:text-primary transition-colors" data-testid={`browse-region-${slug}`}>
                  {label} →
                </a>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white mb-2">Browse by city</h2>
            <p className="text-muted-foreground text-sm mb-6">Jump straight to the events happening in any New Jersey city.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {[
                "newark","jersey-city","hoboken","trenton","atlantic-city",
                "east-rutherford","montclair","new-brunswick","edison","cherry-hill",
                "bloomfield","camden","paterson","elizabeth","passaic",
                "plainfield","westfield","englewood","hamilton","iselin",
                "linden","madison","roselle-park","somerville","west-orange","edgewater",
              ].map((slug) => {
                const name = slug.split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join(" ");
                return (
                  <a
                    key={slug}
                    href={`/things-to-do-in-${slug}`}
                    className="text-sm text-white/70 hover:text-primary transition-colors py-1.5"
                    data-testid={`browse-city-${slug}`}
                  >
                    Things to do in {name} →
                  </a>
                );
              })}
            </div>
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white mb-2">Browse by event type</h2>
            <p className="text-muted-foreground text-sm mb-6">Filter the NJ events scene by what you're in the mood for.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                { slug: "brunches-in-nj", label: "Brunches in NJ" },
                { slug: "day-parties-in-nj", label: "Day Parties in NJ" },
                { slug: "concerts-in-nj", label: "Concerts in NJ" },
                { slug: "comedy-shows-in-nj", label: "Comedy Shows in NJ" },
                { slug: "happy-hours-in-nj", label: "Happy Hours in NJ" },
                { slug: "live-music-in-nj", label: "Live Music in NJ" },
                { slug: "nightlife-in-nj", label: "Nightlife in NJ" },
                { slug: "festivals-in-nj", label: "Festivals in NJ" },
              ].map((t) => (
                <a
                  key={t.slug}
                  href={`/${t.slug}`}
                  className="text-sm text-white/70 hover:text-primary transition-colors py-1.5"
                  data-testid={`browse-type-${t.slug}`}
                >
                  {t.label} →
                </a>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white mb-2">Plan around your week</h2>
            <p className="text-muted-foreground text-sm mb-6">Time-targeted lists for casual scrolling.</p>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <a href="/things-to-do-in-nj-this-weekend" className="text-sm text-white/70 hover:text-primary transition-colors py-1.5">Things to do in NJ this weekend →</a>
              <a href="/things-to-do-in-nj-tonight" className="text-sm text-white/70 hover:text-primary transition-colors py-1.5">Things to do in NJ tonight →</a>
              <a href="/free-things-to-do-in-nj" className="text-sm text-white/70 hover:text-primary transition-colors py-1.5">Free things to do in NJ →</a>
              <a href="/world-cup-2026-nj-guide" className="text-sm text-white/70 hover:text-primary transition-colors py-1.5">World Cup 2026 NJ Guide →</a>
            </div>
          </div>
        </div>
        </>
        )}
      </section>
    </div>
  );
}
