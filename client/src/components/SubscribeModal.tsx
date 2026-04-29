import { useState } from "react";
import { useLocation } from "wouter";
import { X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSubscribeNewsletter } from "@/hooks/use-landing";
import cgeLogo from "@assets/CGE_logo_1772075137138.png";

interface SubscribeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectAfter?: string;
}

export function SubscribeModal({ open, onOpenChange, redirectAfter }: SubscribeModalProps) {
  const [, setLocation] = useLocation();
  const subscribeMutation = useSubscribeNewsletter();

  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [gateLoading, setGateLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setEmail("");
    setRegion("");
    setSuccess(false);
    setError("");
    setGateLoading(false);
    subscribeMutation.reset();
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

    if (redirectAfter) {
      setGateLoading(true);
      try {
        const res = await fetch("/api/subscriber/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed, referrer: document.referrer }),
          credentials: "include",
        });
        if (!res.ok) throw new Error();
        setLocation(`/welcome?redirect=/blog/${redirectAfter}`);
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setGateLoading(false);
      }
    } else {
      subscribeMutation.mutate(
        { email: trimmed, region: region || undefined, name: "" },
        {
          onSuccess: () => setSuccess(true),
          onError: (err) => setError(err.message || "Failed to subscribe. Try again."),
        }
      );
    }
  }

  const isLoading = gateLoading || subscribeMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#0e0e0e] border border-white/10 rounded-2xl p-0 max-w-md w-full shadow-2xl overflow-hidden">
        <button
          onClick={() => handleOpenChange(false)}
          className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-white transition-colors"
          data-testid="button-close-subscribe-modal"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <DialogTitle className="sr-only">Subscribe to the CGE Newsletter</DialogTitle>
        <DialogDescription className="sr-only">Enter your email to get the weekly NJ event list.</DialogDescription>

        <div className="p-8 text-center space-y-5">
          <img src={cgeLogo} alt="CGE Logo" className="w-14 h-14 mx-auto object-contain" />

          {success ? (
            <div className="space-y-3 py-4">
              <p className="text-xl font-bold text-white">You're in!</p>
              <p className="text-muted-foreground text-sm">Check your inbox for the weekly NJ event list.</p>
              <Button
                className="mt-2 bg-primary hover:bg-primary/90 text-white rounded-xl px-6"
                onClick={() => handleOpenChange(false)}
                data-testid="button-subscribe-modal-done"
              >
                Done
              </Button>
            </div>
          ) : (
            <>
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
                    <SelectItem value="All">All NJ</SelectItem>
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
                  disabled={isLoading}
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl"
                  data-testid="button-subscribe-modal-submit"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Subscribe"}
                </Button>
              </form>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
