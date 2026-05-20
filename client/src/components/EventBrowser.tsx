import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Loader2, Search, MapPin, Calendar } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEvents } from "@/hooks/use-landing";
import { normalizeRegion } from "@shared/region";

interface EventBrowserProps {
  /** Cap the number of rows shown. Defaults to no cap. */
  maxItems?: number;
  /** Show a "See Full List" button when results exceed maxItems. */
  showSeeMoreButton?: boolean;
  /** Click handler for the See Full List button. Defaults to navigating to /things-to-do-in-nj. */
  onSeeMore?: () => void;
  /** When true, events with isFeatured=true float to the top with a Featured badge. */
  pinFeatured?: boolean;
  /** Optional sponsored content rendered as a row inside the events list. */
  inlineAd?: ReactNode;
  /** Zero-indexed position to insert the inlineAd. Defaults to after the 5th visible row. */
  inlineAdAfterIndex?: number;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDayOfWeek(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const date = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  return DAY_NAMES[date.getDay()] || "";
}

export function EventBrowser({ maxItems, showSeeMoreButton = false, onSeeMore, pinFeatured = false, inlineAd, inlineAdAfterIndex = 4 }: EventBrowserProps) {
  const [, navigate] = useLocation();
  const [activeRegion, setActiveRegion] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("All Days");
  const [eventType, setEventType] = useState("All Types");
  const { data: events, isLoading } = useEvents(activeRegion);

  const allEvents = events || [];

  const availableEventTypes = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of allEvents) {
      const g = (e.genre || "").trim();
      if (g && !seen.has(g.toLowerCase())) {
        seen.add(g.toLowerCase());
        out.push(g);
      }
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [allEvents]);

  // Only show days in the filter dropdown that actually have events.
  // Order: Mon → Sun (workweek-first), regardless of upload order.
  const availableDays = useMemo(() => {
    const calendarOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const present = new Set<string>();
    for (const e of allEvents) {
      const d = getDayOfWeek(e.date);
      if (d) present.add(d);
    }
    return calendarOrder.filter((d) => present.has(d));
  }, [allEvents]);

  // If the user had a day selected and then events changed so that day no
  // longer has any matches, snap back to "All Days" instead of showing an
  // empty list with a now-invisible filter chip.
  useEffect(() => {
    if (dayOfWeek !== "All Days" && !availableDays.includes(dayOfWeek)) {
      setDayOfWeek("All Days");
    }
  }, [dayOfWeek, availableDays]);

  const filteredEvents = allEvents.filter((e) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        e.title.toLowerCase().includes(q) ||
        (e.city || "").toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    if (dayOfWeek !== "All Days") {
      if (getDayOfWeek(e.date) !== dayOfWeek) return false;
    }
    if (eventType !== "All Types") {
      if ((e.genre || "").trim().toLowerCase() !== eventType.toLowerCase()) return false;
    }
    return true;
  });

  const sortedEvents = pinFeatured
    ? [...filteredEvents].sort((a, b) => {
        const af = (a as any).isFeatured ? 1 : 0;
        const bf = (b as any).isFeatured ? 1 : 0;
        if (af !== bf) return bf - af;
        return a.date.localeCompare(b.date);
      })
    : filteredEvents;

  const visibleEvents = maxItems ? sortedEvents.slice(0, maxItems) : sortedEvents;
  const hasMore = maxItems !== undefined && sortedEvents.length > maxItems;

  const handleSeeMore = () => {
    if (onSeeMore) onSeeMore();
    else navigate("/things-to-do-in-nj");
  };

  return (
    <>
      {/* Search bar */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search events by name or city…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="input-event-search"
          className="w-full pl-11 pr-5 py-3.5 rounded-full bg-white/5 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 transition"
        />
      </div>

      {/* Region tabs + filter dropdowns */}
      <Tabs defaultValue="All" className="w-full" onValueChange={(val) => { setActiveRegion(val); setSearchQuery(""); }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
          <TabsList className="bg-white/5 border border-white/10 p-1 rounded-2xl flex overflow-x-auto hide-scrollbar">
            {["All", "North NJ", "Central NJ", "South NJ"].map((region) => (
              <TabsTrigger
                key={region}
                value={region}
                data-testid={`tab-region-${region.replace(/\s/g, "-").toLowerCase()}`}
                className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white px-6 py-2.5"
              >
                {region === "All" ? "All Regions" : region.replace(" NJ", "")}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger
                className="h-9 rounded-xl bg-white/5 border-white/10 text-sm text-foreground focus:ring-primary min-w-[140px]"
                data-testid="select-day-of-week"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-secondary border-white/10 text-white">
                {["All Days", ...availableDays].map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger
                className="h-9 rounded-xl bg-white/5 border-white/10 text-sm text-foreground focus:ring-primary min-w-[140px]"
                data-testid="select-event-type"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-secondary border-white/10 text-white">
                <SelectItem value="All Types">All Types</SelectItem>
                {availableEventTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value={activeRegion} className="min-h-[400px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          ) : visibleEvents.length > 0 ? (
            <>
              <div className="divide-y divide-white/10 rounded-2xl border border-white/10 overflow-hidden">
                {visibleEvents.map((event, idx) => (
                  <Fragment key={event.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    data-testid={`row-event-${event.id}`}
                    className="flex items-center justify-between gap-4 px-6 py-5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-base leading-snug truncate" data-testid={`text-event-title-${event.id}`}>{event.title}</p>
                        {pinFeatured && (event as any).isFeatured && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                            Featured
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {(() => {
                          const parts = [event.venue, event.city]
                            .map((p) => (p || "").trim())
                            .filter(Boolean);
                          // Region is intentionally not shown — it's used only as
                          // a backend filter via the region tabs above.
                          return parts.length > 0
                            ? parts.join(", ")
                            : normalizeRegion(event.region) || event.region;
                        })()}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <p className="text-sm text-accent font-medium hidden sm:block">
                        {new Date(event.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full border-white/20 hover:bg-primary hover:border-primary hover:text-white transition-all duration-200"
                        asChild
                        data-testid={`button-tickets-${event.id}`}
                      >
                        <a href={event.ticketLink || "#"} target="_blank" rel="noopener noreferrer">
                          Learn more
                        </a>
                      </Button>
                    </div>
                  </motion.div>
                  {inlineAd && idx === inlineAdAfterIndex && (
                    <div className="px-6 py-4 bg-white/[0.04]" data-testid="event-list-inline-ad">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Sponsored</span>
                      </div>
                      {inlineAd}
                    </div>
                  )}
                  </Fragment>
                ))}
              </div>
              {showSeeMoreButton && hasMore && (
                <div className="flex justify-center mt-6">
                  <Button
                    variant="outline"
                    className="rounded-full border-white/20 hover:bg-primary hover:border-primary hover:text-white transition-all duration-200 px-8"
                    data-testid="button-see-full-list"
                    onClick={handleSeeMore}
                  >
                    See Full List
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center glass-panel rounded-3xl border-dashed">
              <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
              <h4 className="text-xl font-bold mb-2">
                {searchQuery ? "No events match your search" : "No events to show"}
              </h4>
              <p className="text-muted-foreground max-w-md">
                {searchQuery
                  ? `Try a different name or city, or clear the search to see all events.`
                  : "No events in this region. Check back soon or submit your event!"}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
