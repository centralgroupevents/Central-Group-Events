import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { EventBrowser } from "@/components/EventBrowser";
import { RichTextViewer } from "@/components/RichTextEditor";
import type { Page } from "@shared/schema";

const SLUG = "things-to-do-in-nj";

interface AdSlot {
  imageUrl?: string;
  linkUrl?: string;
  alt?: string;
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

function AdBanner({ slot, label }: { slot: AdSlot | null; label: string }) {
  if (!slot || !slot.imageUrl) return null;
  const img = (
    <img
      src={slot.imageUrl}
      alt={slot.alt || label}
      className="w-full h-auto rounded-2xl border border-white/10"
      loading="lazy"
    />
  );
  return (
    <div className="my-10" data-testid={`ad-slot-${label.toLowerCase()}`}>
      {slot.linkUrl ? (
        <a href={slot.linkUrl} target="_blank" rel="noopener noreferrer sponsored" aria-label={slot.alt || label}>
          {img}
        </a>
      ) : (
        img
      )}
    </div>
  );
}

export default function ThingsToDo() {
  const { data: page } = useQuery<Page | null>({
    queryKey: [`/api/pages/${SLUG}`],
  });

  const adTop = parseAdSlot(page?.adSlotTop);
  const adMid = parseAdSlot(page?.adSlotMid);
  const adBottom = parseAdSlot(page?.adSlotBottom);

  const heroTitle = page?.title?.trim() || "Things to Do in NJ This Week";
  const description = "Fun and creative events across North, Central, and South New Jersey — curated weekly. Brunches, concerts, day parties, dance nights, and more.";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title={heroTitle}
        description={description}
        canonical={`https://www.centralgroupevents.com/${SLUG}`}
        keywords="things to do in nj, things to do in new jersey, events in nj, fun things to do nj, weekend events nj, nj nightlife, nj brunch"
      />
      <Navigation />

      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />

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

        {/* Events list */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <EventBrowser pinFeatured />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Mid ad slot */}
          <AdBanner slot={adMid} label="Mid" />

          {/* Bottom ad slot */}
          <AdBanner slot={adBottom} label="Bottom" />
        </div>
      </section>
    </div>
  );
}
