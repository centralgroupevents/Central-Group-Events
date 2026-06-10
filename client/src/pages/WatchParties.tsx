import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { WorldCupEmailBanner } from "@/components/WorldCupEmailBanner";
import { Button } from "@/components/ui/button";
import { ChevronRight, Instagram, MapPin, Lock } from "lucide-react";
import { getQueryFn } from "@/lib/queryClient";
import {
  WORLD_CUP_2026_WEEKS,
  getMatchBySlot,
} from "@shared/world-cup-schedule";

const SITE = "https://centralgroupevents.com";

interface ApprovedSubmission {
  id: number;
  weekIndex: number;
  matchDate: string;
  matchSlot: string | null;
  matchLabel: string | null;
  venueName: string;
  town: string;
  eventName: string | null;
  instagramHandle: string | null;
  learnMoreUrl: string | null;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

const TEASER_LIMIT = 5;

export default function WatchParties() {
  const [selectedWeek, setSelectedWeek] = useState<number | "all">("all");

  const { data: submissions, isLoading } = useQuery<ApprovedSubmission[]>({
    queryKey: ["/api/world-cup-submissions/approved", selectedWeek],
    queryFn: async () => {
      const url = selectedWeek === "all"
        ? "/api/world-cup-submissions/approved"
        : `/api/world-cup-submissions/approved?week=${selectedWeek}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  // Gate the full list behind an email — admin bypass via existing session cookie.
  const { data: subVerify } = useQuery<{ access: boolean }>({
    queryKey: ["/api/subscriber/verify"],
  });
  const { data: adminMe } = useQuery<{ email: string; role: string } | null>({
    queryKey: ["/api/admin/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });
  const hasAccess = !!subVerify?.access || !!adminMe?.email;

  // Limit visible submissions to a teaser when the visitor hasn't unlocked yet.
  const visibleSubmissions = useMemo(() => {
    if (!submissions) return [] as ApprovedSubmission[];
    return hasAccess ? submissions : submissions.slice(0, TEASER_LIMIT);
  }, [submissions, hasAccess]);
  const hiddenCount = submissions ? Math.max(0, submissions.length - visibleSubmissions.length) : 0;

  const grouped = useMemo(() => {
    if (!visibleSubmissions.length) return [] as { date: string; items: ApprovedSubmission[] }[];
    const map = new Map<string, ApprovedSubmission[]>();
    for (const s of visibleSubmissions) {
      const arr = map.get(s.matchDate) || [];
      arr.push(s);
      map.set(s.matchDate, arr);
    }
    return Array.from(map.entries())
      .map(([date, items]) => ({ date, items }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [submissions]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="2026 FIFA World Cup Watch Parties in NJ"
        description="Find every New Jersey venue hosting an official 2026 FIFA World Cup watch party. Listings by week and match — Newark, Jersey City, Hoboken, and across NJ."
        canonical={`${SITE}/world-cup-2026-nj-watch-parties`}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": `${SITE}/` },
              { "@type": "ListItem", "position": 2, "name": "World Cup 2026 NJ Guide", "item": `${SITE}/world-cup-2026-nj-guide` },
              { "@type": "ListItem", "position": 3, "name": "Watch Parties", "item": `${SITE}/world-cup-2026-nj-watch-parties` },
            ],
          },
        ]}
      />
      <Navigation />

      <section className="pt-28 pb-2 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="text-xs text-white/50 flex items-center gap-1.5 flex-wrap">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/world-cup-2026-nj-guide" className="hover:text-primary transition-colors">World Cup 2026 NJ Guide</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white/80">Watch Parties</span>
          </nav>
        </div>
      </section>

      <section className="pt-6 pb-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            2026 World Cup Watch Parties in NJ
          </h1>
          <p className="text-white/80 leading-relaxed mb-6">
            Every venue hosting a 2026 FIFA World Cup watch party across New Jersey. Updated as new submissions are reviewed.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/submit-world-cup-watch-party"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors"
              data-testid="cta-submit-watch-party"
            >
              + Submit your watch party
            </Link>
            <Link
              href="/world-cup-2026-nj-guide"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-white/15 text-white/80 font-semibold text-sm hover:bg-white/5 transition-colors"
              data-testid="cta-wc-guide"
            >
              What's happening in NJ during the World Cup →
            </Link>
          </div>

          {!hasAccess && (
            <div className="mt-6">
              <WorldCupEmailBanner
                source="world-cup-watch-parties"
                headline="🔓 Unlock the full NJ watch party list"
                subhead="Drop your email to see every approved venue — free, no spam. You'll also get our weekly NJ event newsletter."
                buttonLabel="Unlock the list"
              />
            </div>
          )}
        </div>
      </section>

      {/* Week filter */}
      <section className="pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedWeek("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedWeek === "all" ? "bg-primary border-primary text-white" : "border-white/15 text-white/60 hover:text-white"}`}
              data-testid="filter-week-all"
            >
              All weeks
            </button>
            {WORLD_CUP_2026_WEEKS.map((w) => (
              <button
                key={w.index}
                onClick={() => setSelectedWeek(w.index)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedWeek === w.index ? "bg-primary border-primary text-white" : "border-white/15 text-white/60 hover:text-white"}`}
                data-testid={`filter-week-${w.index}`}
              >
                Week {w.index}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Listings */}
      <section className="pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-12">Loading…</p>
          ) : !submissions || submissions.length === 0 ? (
            <div className="text-center py-16 border border-white/10 rounded-3xl bg-white/[0.02]">
              <p className="text-white/80 font-semibold mb-2">No watch parties listed yet for this week.</p>
              <p className="text-sm text-muted-foreground mb-6">Be the first venue on the list.</p>
              <Button asChild className="bg-primary hover:bg-primary/90">
                <Link href="/submit-world-cup-watch-party">Submit your watch party</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {grouped.map(({ date, items }) => (
                <div key={date}>
                  <h2 className="text-lg font-black text-primary mb-3">{formatDate(date)}</h2>
                  <div className="space-y-3">
                    {items.map((s) => {
                      const match = s.matchSlot ? getMatchBySlot(s.matchSlot) : null;
                      const fixtureLabel = match?.fixture || s.matchLabel || null;
                      const timeLabel = match?.timeEt || null;
                      return (
                        <div key={s.id} className="bg-secondary/30 border border-white/10 rounded-2xl p-5" data-testid={`watch-party-${s.id}`}>
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                            <h3 className="text-lg font-black text-white">{s.eventName || s.venueName}</h3>
                            {s.eventName && <p className="text-sm text-white/60">at {s.venueName}</p>}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70 mb-3">
                            <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {s.town}, NJ</span>
                            {fixtureLabel && (
                              <span className="text-white/80 font-semibold">⚽ {fixtureLabel}</span>
                            )}
                            {timeLabel && (
                              <span className="text-white/50">{timeLabel}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 flex-wrap">
                            {s.instagramHandle && (() => {
                              const igUrl = `https://instagram.com/${s.instagramHandle.replace("@", "")}`;
                              return (
                                <a
                                  href={`/go?url=${encodeURIComponent(igUrl)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                                  data-testid={`watch-party-ig-${s.id}`}
                                >
                                  <Instagram className="w-3.5 h-3.5" />
                                  @{s.instagramHandle.replace("@", "")}
                                </a>
                              );
                            })()}
                            {s.learnMoreUrl && (
                              <a
                                href={`/go?url=${encodeURIComponent(s.learnMoreUrl)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors"
                                data-testid={`watch-party-learn-more-${s.id}`}
                              >
                                Learn more →
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Inline unlock prompt after the teaser list — only when gated AND there's more */}
              {!hasAccess && hiddenCount > 0 && (
                <div className="relative pt-6 mt-6 border-t border-white/10">
                  <div className="bg-primary/10 border border-primary/30 rounded-2xl p-6 text-center" data-testid="wc-unlock-inline">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 border border-primary/40 mb-3">
                      <Lock className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-xl font-black text-white mb-1">
                      {hiddenCount} more watch {hiddenCount === 1 ? "party" : "parties"} hidden
                    </h3>
                    <p className="text-sm text-white/70 mb-4">
                      Drop your email above to unlock the full list — free, no spam.
                    </p>
                    <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-primary hover:underline text-sm font-semibold">
                      ↑ Jump to the unlock form
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
