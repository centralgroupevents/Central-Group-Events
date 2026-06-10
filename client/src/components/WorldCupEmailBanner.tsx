import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, Mail } from "lucide-react";

interface Props {
  /** Tagged on the newsletter_subscribers.referrer column so source is attributable. */
  source: string;
  /** Optional custom headline. Defaults to a World Cup–themed message. */
  headline?: string;
  /** Optional custom subhead under the headline. */
  subhead?: string;
  /** Optional CTA button label. Defaults to "Subscribe". */
  buttonLabel?: string;
}

/**
 * Slim email-capture banner used on the two World Cup pages. POSTs to the
 * existing /api/subscribers endpoint so it lands in newsletter_subscribers
 * with `referrer = source` for attribution. Existing subscribers don't
 * double-subscribe (ON CONFLICT DO NOTHING server-side).
 */
export function WorldCupEmailBanner({ source, headline, subhead, buttonLabel }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, region: "All", name: "", referrer: source }),
        credentials: "include",
      });
      if (!res.ok && res.status !== 409) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message || "Failed to subscribe");
      }
      // Also call /api/subscriber/check so the access cookie is set — this lets
      // gated pages (like /world-cup-2026-nj-watch-parties) immediately reveal
      // their full content after submit.
      await fetch("/api/subscriber/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, referrer: document.referrer }),
        credentials: "include",
      }).catch(() => {});
      if (typeof window !== "undefined") {
        localStorage.setItem("cge_newsletter_subscribed", "true");
      }
      await qc.invalidateQueries({ queryKey: ["/api/subscriber/verify"] });
      setSubmitted(true);
      toast({ title: "You're in", description: "Watch for NJ World Cup updates in your inbox." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 flex items-center gap-3" data-testid={`wc-email-banner-${source}-success`}>
        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-green-400 font-semibold">You're in.</p>
          <p className="text-sm text-white/70">We'll send NJ World Cup updates to {email}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary/10 border border-primary/30 rounded-2xl p-5" data-testid={`wc-email-banner-${source}`}>
      <div className="flex items-center gap-2 mb-2">
        <Mail className="w-4 h-4 text-primary" />
        <h3 className="font-bold text-white text-base">
          {headline || "Get NJ World Cup updates in your inbox"}
        </h3>
      </div>
      <p className="text-sm text-white/70 mb-4">
        {subhead || "Watch parties, schedules, and event picks across NJ — straight to your inbox each week."}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <Input
          type="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 bg-black/40 border-white/10 h-11"
          data-testid={`wc-email-input-${source}`}
        />
        <Button
          type="submit"
          disabled={loading}
          className="bg-primary hover:bg-primary/90 h-11 px-6 font-semibold whitespace-nowrap"
          data-testid={`wc-email-submit-${source}`}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (buttonLabel || "Subscribe")}
        </Button>
      </form>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      <p className="text-[11px] text-white/40 mt-3">Free. No spam. Unsubscribe anytime.</p>
    </div>
  );
}
