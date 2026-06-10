import { useState, useMemo } from "react";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { NBA_FINALS_2026_GAMES, getNbaGameByNumber } from "@shared/nba-finals-schedule";

const SITE = "https://centralgroupevents.com";

export default function SubmitNbaFinalsWatchParty() {
  const { toast } = useToast();
  const [submittedRef, setSubmittedRef] = useState<{ venue: string; town: string } | null>(null);

  const [gameNumber, setGameNumber] = useState<number | null>(null);
  const [venueName, setVenueName] = useState("");
  const [town, setTown] = useState("");
  const [eventName, setEventName] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [learnMoreUrl, setLearnMoreUrl] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedGame = useMemo(() => (gameNumber ? getNbaGameByNumber(gameNumber) : null), [gameNumber]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!gameNumber || !selectedGame || !venueName.trim() || !town.trim() || !submitterEmail.trim()) {
      setError("Please complete all required fields.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/nba-finals-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameNumber,
          gameDate: selectedGame.date,
          venueName: venueName.trim(),
          town: town.trim(),
          eventName: eventName.trim() || null,
          instagramHandle: instagramHandle.trim() || null,
          learnMoreUrl: learnMoreUrl.trim() || null,
          submitterEmail: submitterEmail.trim().toLowerCase(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Submission failed.");
      }
      setSubmittedRef({ venue: venueName.trim(), town: town.trim() });
      toast({ title: "Submission received", description: "We'll review and email you within 24-48 hours." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (submittedRef) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SEO
          title="NBA Finals Watch Party Submission Received — Central Group Events"
          description="Thanks for submitting your NBA Finals 2026 watch party. We'll review and confirm within 24-48 hours."
          canonical={`${SITE}/submit-nba-finals-watch-party`}
          noindex
        />
        <Navigation />
        <section className="pt-32 pb-24 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-4">Submission received</h1>
          <p className="text-white/70 leading-relaxed">
            Your NBA Finals watch party at <strong className="text-white">{submittedRef.venue}</strong>
            {" in "}
            <strong className="text-white">{submittedRef.town}</strong> is in our review queue.
          </p>
          <p className="text-white/70 leading-relaxed mt-3">
            We'll review and publish within 24-48 hours. Watch your inbox at <span className="text-primary">{submitterEmail}</span>.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild className="bg-primary hover:bg-primary/90">
              <a href="/nba-finals-2026-nj-watch-parties">See approved watch parties →</a>
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Submit a 2026 NBA Finals Watch Party in NJ — Central Group Events"
        description="Hosting a 2026 NBA Finals watch party at your NJ venue? Submit it here — once approved, it appears on our public watch party page for free."
        canonical={`${SITE}/submit-nba-finals-watch-party`}
        noindex
      />
      <Navigation />
      <section className="pt-32 pb-24 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-black mb-3">Submit your NBA Finals watch party</h1>
        <p className="text-white/70 mb-10 leading-relaxed">
          Hosting a 2026 NBA Finals watch party for Games 4-7 at your NJ venue? Fill out the form below — once approved, your watch party is published on our public page so fans across NJ can find it.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-white/80">Game <span className="text-red-400">*</span></Label>
            <Select value={gameNumber ? String(gameNumber) : ""} onValueChange={(v) => setGameNumber(parseInt(v, 10))}>
              <SelectTrigger className="bg-black/40 border-white/10 h-auto min-h-11 py-2" data-testid="select-nba-game">
                <SelectValue placeholder="Pick a game" />
              </SelectTrigger>
              <SelectContent className="bg-secondary border-white/10 text-white max-h-80">
                {NBA_FINALS_2026_GAMES.map((g) => (
                  <SelectItem key={g.gameNumber} value={String(g.gameNumber)}>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-semibold">{g.fixture}{g.ifNecessary ? " (if necessary)" : ""}</span>
                      <span className="text-[11px] text-white/50">{g.date} · {g.timeEt}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/80">Venue name <span className="text-red-400">*</span></Label>
            <Input value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="e.g. The Sports Bar" className="bg-black/40 border-white/10 h-11" data-testid="input-nba-venue" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/80">Town <span className="text-red-400">*</span></Label>
            <Input value={town} onChange={(e) => setTown(e.target.value)} placeholder="e.g. Newark" className="bg-black/40 border-white/10 h-11" data-testid="input-nba-town" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/80">Event name <span className="text-white/40 text-xs">(optional)</span></Label>
            <Input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="e.g. Game 4 Watch Party" className="bg-black/40 border-white/10 h-11" data-testid="input-nba-event-name" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/80">Instagram handle <span className="text-white/40 text-xs">(optional)</span></Label>
            <Input value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} placeholder="@yourvenue" className="bg-black/40 border-white/10 h-11" data-testid="input-nba-instagram" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/80">Learn-more URL <span className="text-white/40 text-xs">(optional)</span></Label>
            <Input type="url" value={learnMoreUrl} onChange={(e) => setLearnMoreUrl(e.target.value)} placeholder="https://your-event-page.com" className="bg-black/40 border-white/10 h-11" data-testid="input-nba-learn-more-url" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/80">Your email <span className="text-red-400">*</span></Label>
            <Input type="email" value={submitterEmail} onChange={(e) => setSubmitterEmail(e.target.value)} placeholder="you@venue.com" className="bg-black/40 border-white/10 h-11" data-testid="input-nba-submitter-email" required />
            <p className="text-xs text-muted-foreground">We email you when your watch party is approved.</p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="pt-2">
            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 h-12 px-8 font-semibold" data-testid="button-submit-nba-watch-party">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</> : "Submit watch party"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
