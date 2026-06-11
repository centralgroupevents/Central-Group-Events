import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { WorldCupEmailBanner } from "@/components/WorldCupEmailBanner";
import { Button } from "@/components/ui/button";
import { ChevronRight, Instagram, MapPin, Lock } from "lucide-react";
import { getQueryFn } from "@/lib/queryClient";
import { NBA_FINALS_2026_GAMES, getNbaGameByNumber } from "@shared/nba-finals-schedule";
import { getRegionForTown, REGIONS, type NjRegion } from "@shared/nj-town-regions";

const SITE = "https://centralgroupevents.com";
const TEASER_LIMIT = 5;

interface ApprovedNbaSubmission {
  id: number;
  gameNumber: number;
  gameDate: string;
  venueName: string;
  town: string;
  region: string | null;
  eventName: string | null;
  instagramHandle: string | null;
  learnMoreUrl: string | null;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function NbaFinalsWatchParties() {
  const [selectedGame, setSelectedGame] = useState<number | "all">("all");
  const [selectedRegion, setSelectedRegion] = useState<NjRegion | "all">("all");

  const { data: allSubmissions, isLoading } = useQuery<ApprovedNbaSubmission[]>({
    queryKey: ["/api/nba-finals-submissions/approved", selectedGame],
    queryFn: async () => {
      const url = selectedGame === "all"
        ? "/api/nba-finals-submissions/approved"
        : `/api/nba-finals-submissions/approved?game=${selectedGame}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const submissions = useMemo(() => {
    if (!allSubmissions) return undefined;
    if (selectedRegion === "all") return allSubmissions;
    return allSubmissions.filter((s) => (s.region ?? getRegionForTown(s.town)) === selectedRegion);
  }, [allSubmissions, selectedRegion]);

  const { data: subVerify } = useQuery<{ access: boolean }>({
    queryKey: ["/api/subscriber/verify"],
  });
  const { data: adminMe } = useQuery<{ email: string; role: string } | null>({
    queryKey: ["/api/admin/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });
  const hasAccess = !!subVerify?.access || !!adminMe?.email;

  const visibleSubmissions = useMemo(() => {
    if (!submissions) return [] as ApprovedNbaSubmission[];
    return hasAccess ? submissions : submissions.slice(0, TEASER_LIMIT);
  }, [submissions, hasAccess]);
  const hiddenCount = submissions ? Math.max(0, submissions.length - visibleSubmissions.length) : 0;

  type RegionBucket = { region: NjRegion | "Other"; items: ApprovedNbaSubmission[] };
  type DateGroup = { date: string; regions: RegionBucket[] };
  const grouped = useMemo<DateGroup[]>(() => {
    if (!visibleSubmissions.length) return [];
    const byDate = new Map<string, ApprovedNbaSubmission[]>();
    for (const s of visibleSubmissions) {
      const arr = byDate.get(s.gameDate) || [];
      arr.push(s);
      byDate.set(s.gameDate, arr);
    }
    const ordering: (NjRegion | "Other")[] = [...REGIONS, "Other"];
    return Array.from(byDate.entries())
      .map(([date, items]) => {
        const byRegion = new Map<NjRegion | "Other", ApprovedNbaSubmission[]>();
        for (const s of items) {
          const r = ((s.region as NjRegion | null) ?? getRegionForTown(s.town) ?? "Other") as NjRegion | "Other";
          const arr = byRegion.get(r) || [];
          arr.push(s);
          byRegion.set(r, arr);
        }
        const regions: RegionBucket[] = ordering
          .filter((r) => byRegion.has(r))
          .map((r) => ({ region: r, items: byRegion.get(r)! }));
        return { date, regions };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [visibleSubmissions]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="2026 NBA Finals Watch Parties in NJ"
        description="Find every New Jersey venue hosting a 2026 NBA Finals watch party. Listings by game — Newark, Jersey City, Hoboken, Atlantic City, and across NJ."
        canonical={`${SITE}/nba-finals-2026-nj-watch-parties`}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": `${SITE}/` },
              { "@type": "ListItem", "position": 2, "name": "NBA Finals Watch Parties", "item": `${SITE}/nba-finals-2026-nj-watch-parties` },
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
            <span className="text-white/80">NBA Finals Watch Parties</span>
          </nav>
        </div>
      </section>

      <section className="pt-6 pb-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            2026 NBA Finals Watch Parties in NJ
          </h1>
          <p className="text-white/80 leading-relaxed mb-6">
            Every NJ venue hosting a 2026 NBA Finals watch party for Games 5-7. Updated as new submissions are reviewed.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/submit-nba-finals-watch-party"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors"
              data-testid="cta-submit-nba-watch-party"
            >
              + Submit your watch party
            </Link>
          </div>

          {!hasAccess && (
            <div className="mt-6">
              <WorldCupEmailBanner
                source="nba-finals-watch-parties"
                headline="🔓 Unlock the full NBA Finals watch party list"
                subhead="Drop your email to see every approved venue — free, no spam. You'll also get our weekly NJ event newsletter."
                buttonLabel="Unlock the list"
              />
            </div>
          )}
        </div>
      </section>

      {/* Game + Region filters */}
      <section className="pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          <div>
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">By game</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedGame("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedGame === "all" ? "bg-primary border-primary text-white" : "border-white/15 text-white/60 hover:text-white"}`}
                data-testid="filter-nba-game-all"
              >
                All games
              </button>
              {NBA_FINALS_2026_GAMES.map((g) => (
                <button
                  key={g.gameNumber}
                  onClick={() => setSelectedGame(g.gameNumber)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedGame === g.gameNumber ? "bg-primary border-primary text-white" : "border-white/15 text-white/60 hover:text-white"}`}
                  data-testid={`filter-nba-game-${g.gameNumber}`}
                >
                  Game {g.gameNumber}{g.ifNecessary ? "*" : ""}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-white/40 mt-2">* Games 5-7 only happen if the series isn't decided.</p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2">By NJ region</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedRegion("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedRegion === "all" ? "bg-primary border-primary text-white" : "border-white/15 text-white/60 hover:text-white"}`}
                data-testid="filter-nba-region-all"
              >
                All NJ
              </button>
              {REGIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRegion(r)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedRegion === r ? "bg-primary border-primary text-white" : "border-white/15 text-white/60 hover:text-white"}`}
                  data-testid={`filter-nba-region-${r.split(" ")[0].toLowerCase()}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-12">Loading…</p>
          ) : !submissions || submissions.length === 0 ? (
            <div className="text-center py-16 border border-white/10 rounded-3xl bg-white/[0.02]">
              <p className="text-white/80 font-semibold mb-2">No watch parties listed yet for this game.</p>
              <p className="text-sm text-muted-foreground mb-6">Be the first venue on the list.</p>
              <Button asChild className="bg-primary hover:bg-primary/90">
                <Link href="/submit-nba-finals-watch-party">Submit your watch party</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {grouped.map(({ date, regions }) => (
                <div key={date}>
                  <h2 className="text-2xl font-black text-primary mb-4">{formatDate(date)}</h2>
                  <div className="space-y-6">
                    {regions.map(({ region, items }) => (
                      <div key={region}>
                        <div className="flex items-baseline gap-2 mb-3">
                          <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider">{region}</h3>
                          <span className="text-xs text-white/40">{items.length} {items.length === 1 ? "venue" : "venues"}</span>
                        </div>
                        <div className="space-y-3">
                          {items.map((s) => {
                            const game = getNbaGameByNumber(s.gameNumber);
                            return (
                              <div key={s.id} className="bg-secondary/30 border border-white/10 rounded-2xl p-5" data-testid={`nba-watch-party-${s.id}`}>
                                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                                  <h4 className="text-lg font-black text-white">{s.eventName || s.venueName}</h4>
                                  {s.eventName && <p className="text-sm text-white/60">at {s.venueName}</p>}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70 mb-3">
                                  <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {s.town}, NJ</span>
                                  {game && <span className="text-white/80 font-semibold">🏀 Game {game.gameNumber}</span>}
                                  {game && <span className="text-white/50">{game.timeEt}</span>}
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
                                        data-testid={`nba-watch-party-ig-${s.id}`}
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
                                      data-testid={`nba-watch-party-learn-more-${s.id}`}
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
                  </div>
                </div>
              ))}

              {!hasAccess && hiddenCount > 0 && (
                <div className="relative pt-6 mt-6 border-t border-white/10">
                  <div className="bg-primary/10 border border-primary/30 rounded-2xl p-6 text-center" data-testid="nba-unlock-inline">
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
