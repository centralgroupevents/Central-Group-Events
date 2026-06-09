import { useRoute, Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { EventBrowser } from "@/components/EventBrowser";
import { WorldCupEmailBanner } from "@/components/WorldCupEmailBanner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  getTopicConfig,
  getRelatedCityLinks,
  getRelatedTypeLinks,
} from "@shared/seo-topics";
import NotFound from "@/pages/not-found";

const SITE = "https://centralgroupevents.com";

export default function TopicLanding() {
  // Catch-all /:slug — only matches when no earlier route does.
  const [, params] = useRoute<{ slug: string }>("/:slug");
  const slug = params?.slug || "";
  const config = getTopicConfig(slug);

  if (!config) {
    return <NotFound />;
  }

  const canonical = `${SITE}/${config.slug}`;

  const faqJsonLd =
    config.faqItems && config.faqItems.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": config.faqItems.map((item) => ({
            "@type": "Question",
            "name": item.q,
            "acceptedAnswer": { "@type": "Answer", "text": item.a },
          })),
        }
      : null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": `${SITE}/` },
      { "@type": "ListItem", "position": 2, "name": "Things to Do in NJ", "item": `${SITE}/things-to-do-in-nj` },
      { "@type": "ListItem", "position": 3, "name": config.h1, "item": canonical },
    ],
  };

  const jsonLd: object[] = [breadcrumbJsonLd];
  if (faqJsonLd) jsonLd.push(faqJsonLd);

  const relatedCities = getRelatedCityLinks().slice(0, 12);
  const relatedTypes = getRelatedTypeLinks();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title={config.metaTitle}
        description={config.metaDescription}
        canonical={canonical}
        jsonLd={jsonLd}
      />
      <Navigation />

      <section className="pt-28 pb-2 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Visible breadcrumb bar — UX + reinforces the BreadcrumbList schema for crawlers */}
          <nav aria-label="Breadcrumb" className="text-xs text-white/50 flex items-center gap-1.5 flex-wrap">
            <Link href="/" className="hover:text-primary transition-colors" data-testid="breadcrumb-home">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/things-to-do-in-nj" className="hover:text-primary transition-colors" data-testid="breadcrumb-things-to-do">Things to Do in NJ</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white/80" data-testid="breadcrumb-current">{config.h1}</span>
          </nav>
        </div>
      </section>

      <section className="pt-6 pb-10 relative overflow-clip">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6">{config.h1}</h1>
          <div className="space-y-4 text-white/80 text-base leading-relaxed">
            {config.introParagraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {/* Cross-link CTAs for the World Cup tentpole — sit between intro and events list */}
          {slug === "world-cup-2026-nj-guide" && (
            <>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/world-cup-2026-nj-watch-parties"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors"
                  data-testid="cta-watch-parties"
                >
                  ⚽ See NJ World Cup watch parties →
                </Link>
                <Link
                  href="/submit-world-cup-watch-party"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-white/15 text-white/80 font-semibold text-sm hover:bg-white/5 transition-colors"
                  data-testid="cta-submit-watch-party"
                >
                  Submit your venue's watch party
                </Link>
              </div>
              <div className="mt-6">
                <WorldCupEmailBanner source="world-cup-guide" />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Events list filtered to topic — search bar stays functional */}
      <section className="pb-16 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <EventBrowser
            pinFeatured
            lockedCity={config.filter.city}
            lockedGenre={config.filter.genre}
            lockedDays={config.filter.days}
          />
        </div>
      </section>

      {/* FAQ block — also emits FAQPage JSON-LD via the SEO prop */}
      {config.faqItems && config.faqItems.length > 0 && (
        <section className="py-16 border-t border-white/5">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl md:text-3xl font-black mb-6">Frequently Asked</h2>
            <Accordion type="single" collapsible className="space-y-3">
              {config.faqItems.map((item, idx) => (
                <AccordionItem
                  key={idx}
                  value={`faq-${idx}`}
                  className="glass-panel border border-white/10 rounded-xl px-4"
                >
                  <AccordionTrigger className="text-left font-semibold text-white hover:text-primary hover:no-underline py-5">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      )}

      {/* Internal linking grid — gives Google + AI agents a path to crawl all topic pages */}
      <section className="py-16 border-t border-white/5 bg-black/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div>
            <h2 className="text-xl font-black text-white mb-4">Explore other NJ cities</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {relatedCities.map((c) => (
                <Link
                  key={c.slug}
                  href={`/${c.slug}`}
                  className="text-sm text-white/70 hover:text-primary transition-colors py-1.5"
                  data-testid={`related-city-${c.slug}`}
                >
                  {c.name} →
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-black text-white mb-4">Browse by event type</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {relatedTypes.map((t) => (
                <Link
                  key={t.slug}
                  href={`/${t.slug}`}
                  className="text-sm text-white/70 hover:text-primary transition-colors py-1.5"
                  data-testid={`related-type-${t.slug}`}
                >
                  {t.label} →
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
