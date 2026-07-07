import { useQuery } from "@tanstack/react-query";
import { Compass, ArrowRight } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";

const SITE = "https://centralgroupevents.com";

type GuideLite = {
  slug: string;
  title: string;
  metaDescription: string;
  heroImageUrl: string | null;
  ogImageUrl: string | null;
  updatedAt: string | null;
};

export default function Guides() {
  const { data: guides = [], isLoading } = useQuery<GuideLite[]>({
    queryKey: ["/api/landing-pages"],
    queryFn: async () => {
      const r = await fetch("/api/landing-pages");
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="NJ Event Guides — Central Group Events"
        description="Every curated NJ topic guide from Central Group Events — evergreen resources for major holidays, tentpole events, and neighborhood deep-dives."
        canonical={`${SITE}/guides`}
      />
      <Navigation />

      <section className="pt-28 pb-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-accent tracking-widest uppercase mb-3">
            <Compass className="w-3.5 h-3.5" /> NJ Guides
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Every NJ event guide, one place</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Curated topic hubs for the biggest NJ holidays, tentpole events, and neighborhood spotlights. Updated as the calendar warrants.
          </p>
        </div>
      </section>

      <section className="pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {isLoading ? (
            <p className="text-center py-16 text-white/50">Loading guides…</p>
          ) : guides.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>No guides published yet. Check back soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {guides.map((g) => {
                const cover = g.ogImageUrl || g.heroImageUrl;
                return (
                  <a
                    key={g.slug}
                    href={`/${g.slug}`}
                    className="group block bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-primary/40 rounded-2xl overflow-hidden transition-colors"
                    data-testid={`guide-card-${g.slug}`}
                  >
                    {cover ? (
                      <div className="aspect-[16/9] overflow-hidden bg-black/40">
                        <img
                          src={cover}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                    ) : (
                      <div className="aspect-[16/9] bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
                        <Compass className="w-10 h-10 text-white/30" />
                      </div>
                    )}
                    <div className="p-5">
                      <h2 className="font-black text-xl text-white group-hover:text-primary transition-colors line-clamp-2">
                        {g.title}
                      </h2>
                      {g.metaDescription && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{g.metaDescription}</p>
                      )}
                      <div className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary font-semibold">
                        Read guide <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
