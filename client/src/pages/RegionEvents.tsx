import { Link, useParams } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { EventBrowser } from "@/components/EventBrowser";
import { EventsJsonLd } from "@/components/EventsJsonLd";

// Durable SEO landing pages: the events inside rotate every week, but these
// URLs never churn — so weekly turnover reads as freshness, not dead links.
// Each page targets one query family ("events in north nj", "things to do in
// nj this weekend") with real intro copy, a locked-region event list, and
// per-event JSON-LD for Google's event rich results.
const REGION_PAGES: Record<string, {
  region?: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  cities: string[];
}> = {
  "north-nj": {
    region: "North NJ",
    title: "Events in North Jersey",
    metaTitle: "North NJ Events This Weekend — Newark, Jersey City, Hoboken | Central Group Events",
    metaDescription: "The curated list of North Jersey events this weekend: parties, brunches, concerts, and nightlife in Newark, Jersey City, Hoboken, Montclair, and more. Updated every week.",
    intro: "North Jersey runs the state's nightlife. From Newark's downtown lounges and Ironbound restaurants to Jersey City rooftops, Hoboken bars, and Montclair's food-and-music scene — this is the live list of what's happening in North NJ this week, curated and refreshed every single week.",
    cities: ["newark", "jersey-city", "hoboken", "montclair", "paterson", "elizabeth", "east-rutherford", "bloomfield", "west-orange", "englewood"],
  },
  "central-nj": {
    region: "Central NJ",
    title: "Events in Central Jersey",
    metaTitle: "Central NJ Events This Weekend — New Brunswick, Edison, Trenton | Central Group Events",
    metaDescription: "What's happening in Central Jersey this weekend: parties, day events, concerts, and nightlife in New Brunswick, Edison, Trenton, Plainfield, and more. Updated weekly.",
    intro: "Central Jersey holds its own — New Brunswick's college-town energy, Edison and Iselin's food scenes, Trenton's culture, Plainfield's party circuit. This is the live, weekly-updated list of what's happening in Central NJ.",
    cities: ["new-brunswick", "edison", "trenton", "plainfield", "somerville", "iselin", "hamilton", "westfield", "linden", "roselle-park"],
  },
  "south-nj": {
    region: "South NJ",
    title: "Events in South Jersey",
    metaTitle: "South NJ Events This Weekend — Atlantic City, Camden, Cherry Hill | Central Group Events",
    metaDescription: "The South Jersey weekend list: Atlantic City nightlife, Camden waterfront shows, Cherry Hill socials, and shore-town events. Curated and updated every week.",
    intro: "From Atlantic City's casinos and beach clubs to Camden's waterfront and Cherry Hill's social scene, South Jersey shows up every weekend. This list is curated and refreshed weekly so you always know where the move is.",
    cities: ["atlantic-city", "camden", "cherry-hill"],
  },
  "this-weekend-in-nj": {
    title: "This Weekend in NJ",
    metaTitle: "Things to Do in NJ This Weekend — The Full Events List | Central Group Events",
    metaDescription: "Every event worth knowing about in New Jersey this weekend — North, Central, and South. 100+ curated parties, brunches, concerts, and nightlife picks, refreshed every week.",
    intro: "The question every Thursday: what's happening this weekend? Here's the whole answer — every curated event across North, Central, and South Jersey for the next seven days, refreshed weekly by the team that promotes 100+ NJ events a week.",
    cities: ["newark", "jersey-city", "hoboken", "new-brunswick", "atlantic-city", "trenton", "montclair", "edison"],
  },
};

export default function RegionEvents() {
  const params = useParams<{ slug: string }>();
  const cfg = REGION_PAGES[params.slug || ""] ?? REGION_PAGES["this-weekend-in-nj"];
  const canonicalSlug = REGION_PAGES[params.slug || ""] ? params.slug : "this-weekend-in-nj";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title={cfg.metaTitle}
        description={cfg.metaDescription}
        canonical={`https://centralgroupevents.com/events/${canonicalSlug}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "name": cfg.title,
          "description": cfg.metaDescription,
          "url": `https://centralgroupevents.com/events/${canonicalSlug}`,
          "isPartOf": { "@type": "WebSite", "name": "Central Group Events", "url": "https://centralgroupevents.com" },
        }}
      />
      <EventsJsonLd region={cfg.region} />
      <Navigation />

      <div className="pt-28 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-10">
            <p className="text-sm font-bold text-primary tracking-widest uppercase mb-3">Updated weekly</p>
            <h1 className="text-4xl md:text-6xl font-black mb-5">{cfg.title}</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">{cfg.intro}</p>
          </header>

          <EventBrowser lockedRegion={cfg.region} pinFeatured />

          <div className="mt-14 border-t border-white/10 pt-10">
            <h2 className="text-xl font-black mb-4">Browse by city</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-10">
              {cfg.cities.map((slug) => {
                const name = slug.split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join(" ");
                return (
                  <a key={slug} href={`/things-to-do-in-${slug}`} className="text-sm text-white/70 hover:text-primary transition-colors py-1">
                    Things to do in {name} →
                  </a>
                );
              })}
            </div>
            <h2 className="text-xl font-black mb-4">More NJ events</h2>
            <div className="flex flex-wrap gap-3">
              {Object.entries(REGION_PAGES)
                .filter(([slug]) => slug !== canonicalSlug)
                .map(([slug, p]) => (
                  <Link key={slug} href={`/events/${slug}`} className="text-sm px-4 py-2 rounded-full border border-white/15 text-white/80 hover:border-primary hover:text-primary transition-colors">
                    {p.title}
                  </Link>
                ))}
              <a href="/things-to-do-in-nj" className="text-sm px-4 py-2 rounded-full border border-white/15 text-white/80 hover:border-primary hover:text-primary transition-colors">
                The full NJ list
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
