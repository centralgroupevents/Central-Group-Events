import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
 * Email-capture banner used as a gate on the two watch-party pages. Captures
 * name + email + region so we can segment newsletter sends. POSTs to the
 * existing /api/subscribers endpoint, then /api/subscriber/check to set the
 * access cookie so gated content reveals immediately.
 */
export function WorldCupEmailBanner({ source, headline, subhead, buttonLabel }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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
      const res = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, name: trimmedName, region, referrer: source }),
        credentials: "include",
      });
      if (!res.ok && res.status !== 409) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message || "Failed to subscribe");
      }
      await fetch("/api/subscriber/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, referrer: document.referrer }),
        credentials: "include",
      }).catch(() => {});
      if (typeof window !== "undefined") {
        localStorage.setItem("cge_newsletter_subscribed", "true");
      }
      await qc.invalidateQueries({ queryKey: ["/api/subscriber/verify"] });
      setSubmitted(true);
      toast({ title: "You're in", description: "Watch for NJ updates in your inbox." });
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
          <p className="text-green-400 font-semibold">You're in, {name}.</p>
          <p className="text-sm text-white/70">We'll send NJ event picks to {email}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary/10 border border-primary/30 rounded-2xl p-5" data-testid={`wc-email-banner-${source}`}>
      <div className="flex items-center gap-2 mb-2">
        <Mail className="w-4 h-4 text-primary" />
        <h3 className="font-bold text-white text-base">
          {headline || "Get NJ event picks in your inbox"}
        </h3>
      </div>
      <p className="text-sm text-white/70 mb-4">
        {subhead || "Watch parties, day parties, brunches, festivals across NJ — straight to your inbox each week."}
      </p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            type="text"
            required
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-black/40 border-white/10 h-11"
            data-testid={`wc-name-input-${source}`}
          />
          <Input
            type="email"
            required
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-black/40 border-white/10 h-11"
            data-testid={`wc-email-input-${source}`}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="bg-black/40 border-white/10 h-11 flex-1" data-testid={`wc-region-select-${source}`}>
              <SelectValue placeholder="What part of NJ are you in?" />
            </SelectTrigger>
            <SelectContent className="bg-secondary border-white/10 text-white">
              <SelectItem value="North NJ">North NJ</SelectItem>
              <SelectItem value="Central NJ">Central NJ</SelectItem>
              <SelectItem value="South NJ">South NJ</SelectItem>
              <SelectItem value="All">All over / not sure</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="submit"
            disabled={loading}
            className="bg-primary hover:bg-primary/90 h-11 px-6 font-semibold whitespace-nowrap"
            data-testid={`wc-email-submit-${source}`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (buttonLabel || "Subscribe")}
          </Button>
        </div>
      </form>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      <p className="text-[11px] text-white/40 mt-3">Free. No spam. Unsubscribe anytime.</p>
    </div>
  );
}
