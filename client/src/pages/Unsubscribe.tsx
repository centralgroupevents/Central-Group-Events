import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, MailX } from "lucide-react";

/**
 * Landing page for the signed unsubscribe links in every marketing email
 * (?e=<encoded email>&t=<signature>). Confirms the opt-out with one click —
 * no login, no "enter your email again", no dark patterns.
 */
export default function Unsubscribe() {
  const [status, setStatus] = useState<"working" | "done" | "invalid">("working");
  const [message, setMessage] = useState("");
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const e = params.get("e") || "";
    const t = params.get("t") || "";
    if (!e || !t) {
      setStatus("invalid");
      return;
    }
    fetch(`/api/unsubscribe?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`, { method: "POST" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (res.ok) {
          setMessage((body as { message?: string }).message || "");
          setStatus("done");
        } else {
          setMessage((body as { message?: string }).message || "");
          setStatus("invalid");
        }
      })
      .catch(() => setStatus("invalid"));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO title="Unsubscribe" description="Unsubscribe from Central Group Events emails." canonical="https://centralgroupevents.com/unsubscribe" noindex />
      <Navigation />
      <div className="max-w-md mx-auto px-4 py-40 text-center space-y-6">
        {status === "working" && (
          <>
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
            <h1 className="text-2xl font-black">Unsubscribing you…</h1>
          </>
        )}

        {status === "done" && (
          <>
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-400" />
            <h1 className="text-2xl font-black" data-testid="text-unsubscribe-success">You're unsubscribed</h1>
            <p className="text-muted-foreground">
              {message || "You won't receive any more marketing emails from Central Group Events."}
            </p>
            <p className="text-sm text-muted-foreground">
              Changed your mind? You can re-subscribe any time from the site.
            </p>
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link href="/">Back to the site</Link>
            </Button>
          </>
        )}

        {status === "invalid" && (
          <>
            <MailX className="w-12 h-12 mx-auto text-red-400" />
            <h1 className="text-2xl font-black">This link didn't work</h1>
            <p className="text-muted-foreground">
              {message || "The unsubscribe link is missing or invalid."} Email{" "}
              <a href="mailto:centralgroupevents@gmail.com?subject=Unsubscribe" className="text-primary hover:underline">
                centralgroupevents@gmail.com
              </a>{" "}
              with the subject "Unsubscribe" and we'll remove you right away.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
