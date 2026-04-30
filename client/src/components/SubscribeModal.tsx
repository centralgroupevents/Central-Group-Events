import { useState } from "react";
import { useLocation } from "wouter";
import { X, Loader2 } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import cgeLogo from "@assets/CGE_logo_1772075137138.png";

interface SubscribeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Redirect target after a successful subscribe. Full path like "/blog" or blog slug like "post-slug". */
  redirectAfter?: string;
  /** Called after a successful non-gated subscribe so parent can show inline success */
  onSuccess?: () => void;
}

export function SubscribeModal({ open, onOpenChange, redirectAfter, onSuccess }: SubscribeModalProps) {
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setEmail("");
    setRegion("");
    setLoading(false);
    setError("");
  }

  function handleOpenChange(val: boolean) {
    if (!val) reset();
    onOpenChange(val);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setError("");
    setLoading(true);

    try {
      // Step 1: always add to the subscriber list (handles both normal + gated flows)
      const subRes = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, region: region || undefined, name: "" }),
        credentials: "include",
      });
      // 409 conflict (already subscribed) is acceptable — we still proceed
      if (!subRes.ok && subRes.status !== 409) {
        const body = await subRes.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message || "Failed to subscribe");
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("cge_newsletter_subscribed", "true");
      }

      if (redirectAfter) {
        // Step 2 (gated): set subscriber cookie then redirect to welcome page
        const checkRes = await fetch("/api/subscriber/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed, referrer: document.referrer }),
          credentials: "include",
        });
        if (!checkRes.ok) throw new Error("Could not verify access. Try again.");
        // Close modal first, then redirect
        onOpenChange(false);
        reset();
        const target = redirectAfter.startsWith("/") ? redirectAfter : `/blog/${redirectAfter}`;
        setLocation(`/welcome?redirect=${encodeURIComponent(target)}`);
      } else {
        // Normal flow: close modal and notify parent for inline success message
        onOpenChange(false);
        reset();
        onSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* [&>button:last-child]:hidden suppresses the default DialogContent close button so only our styled one renders */}
      <DialogContent className="bg-[#0e0e0e] border border-white/10 rounded-2xl p-0 max-w-md w-full shadow-2xl overflow-hidden [&>button:last-child]:hidden">
        <DialogClose
          className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-white transition-colors"
          data-testid="button-close-subscribe-modal"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </DialogClose>

        <DialogTitle className="sr-only">Subscribe to the CGE Newsletter</DialogTitle>
        <DialogDescription className="sr-only">Enter your email to get the weekly NJ event list.</DialogDescription>

        <div className="p-8 text-center space-y-5">
          <img src={cgeLogo} alt="CGE Logo" className="w-14 h-14 mx-auto object-contain" />

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">Get the Weekly NJ Event List</h2>
            <p className="text-sm text-muted-foreground">
              {redirectAfter
                ? "Enter your email for instant access — it's free."
                : "Free every week. No spam, just events."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 text-left">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="bg-black/40 border-white/10 h-11 text-white placeholder:text-muted-foreground rounded-xl"
              data-testid="input-subscribe-modal-email"
            />

            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger
                className="h-11 bg-black/40 border-white/10 text-sm rounded-xl"
                data-testid="select-subscribe-modal-region"
              >
                <SelectValue placeholder="Region (optional)" />
              </SelectTrigger>
              <SelectContent className="bg-secondary border-white/10 text-white">
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="North NJ">North NJ</SelectItem>
                <SelectItem value="Central NJ">Central NJ</SelectItem>
                <SelectItem value="South NJ">South NJ</SelectItem>
              </SelectContent>
            </Select>

            {error && (
              <p className="text-sm text-red-400" data-testid="text-subscribe-modal-error">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl"
              data-testid="button-subscribe-modal-submit"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Subscribe"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
