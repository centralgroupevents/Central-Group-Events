import { useEffect } from "react";
import { useLocation } from "wouter";
import { SEO } from "@/components/SEO";
import cgeLogo from "@assets/CGE_logo_1772075137138.png";

export default function Welcome() {
  const [, setLocation] = useLocation();


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect") || "/things-to-do-in-nj";
    const timer = setTimeout(() => {
      setLocation(redirect);
    }, 3000);
    return () => clearTimeout(timer);
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <SEO title="Welcome" description="" canonical="https://www.centralgroupevents.com/welcome" noindex />
      <div className="text-center max-w-lg">
        <img
          src={cgeLogo}
          alt="Central Group Events"
          className="h-24 w-auto object-contain mx-auto mb-8"
          data-testid="img-cge-logo"
        />
        <div className="mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 border border-primary/30 text-primary text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            You're on the list
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white mb-4" data-testid="text-welcome-heading">
          You're in! Welcome to the CGE insider list.
        </h1>
        <p className="text-lg text-muted-foreground mb-8" data-testid="text-welcome-subtext">
          You now have access to all CGE newsletter posts.
        </p>
        <p className="text-sm text-muted-foreground">
          Redirecting you in a moment…
        </p>
        <div className="mt-6 h-1 bg-white/10 rounded-full overflow-hidden max-w-xs mx-auto">
          <div className="h-full bg-primary rounded-full animate-[progress_3s_linear_forwards]" />
        </div>
      </div>
    </div>
  );
}
