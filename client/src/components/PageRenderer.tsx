import { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { WorldCupEmailBanner } from "@/components/WorldCupEmailBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, Instagram, MapPin, Lock, CheckCircle2, Loader2 } from "lucide-react";
import { getQueryFn } from "@/lib/queryClient";
import NotFound from "@/pages/not-found";

const SITE = "https://centralgroupevents.com";
const TEASER_LIMIT = 5;

interface LandingPage {
  id: number;
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  heroImageUrl: string | null;
  heroImageAlt: string;
  editorContent: string;
  indexable: boolean;
  gateEnabled: boolean;
  submissionsEnabled: boolean;
  published: boolean;
  faqItems: string;
  updatedAt: string | null;
  /** Which submission field renders as the prominent H3. */
  listingHeaderField?: "venueName" | "eventName" | "eventDate";
}

interface ApprovedSubmission {
  id: number;
  pageId: number;
  eventDate: string;
  venueName: string;
  town: string;
  eventName: string | null;
  instagramHandle: string | null;
  learnMoreUrl: string | null;
  region: string | null;
}

function formatDateLoose(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }
  return s; // free-form dates pass through as-is
}

interface Props {
  slug: string;
}

export function PageRenderer({ slug }: Props) {
  const { data: page, isLoading, error } = useQuery<LandingPage>({
    queryKey: ["/api/landing-pages", slug],
    queryFn: async () => {
      const res = await fetch(`/api/landing-pages/${slug}`);
      if (res.status === 404) throw new Error("not-found");
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    retry: false,
  });

  // Gate access check (mirrors WatchParties pattern)
  const { data: subVerify } = useQuery<{ access: boolean }>({
    queryKey: ["/api/subscriber/verify"],
    enabled: !!page?.gateEnabled,
  });
  const { data: adminMe } = useQuery<{ email: string; role: string } | null>({
    queryKey: ["/api/admin/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    enabled: !!page?.gateEnabled,
  });
  const hasAccess = !page?.gateEnabled || !!subVerify?.access || !!adminMe?.email;

  // Approved submissions — only fetched when the page has submissions enabled
  const { data: submissions = [] } = useQuery<ApprovedSubmission[]>({
    queryKey: [`/api/landing-pages/${slug}/submissions/approved`],
    enabled: !!page?.submissionsEnabled,
  });

  const visibleSubmissions = useMemo(() => {
    return hasAccess ? submissions : submissions.slice(0, TEASER_LIMIT);
  }, [submissions, hasAccess]);
  const hiddenCount = Math.max(0, submissions.length - visibleSubmissions.length);

  let faqItems: { q: string; a: string }[] = [];
  try {
    faqItems = JSON.parse(page?.faqItems || "[]");
  } catch {
    faqItems = [];
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <div className="pt-32 text-center text-white/50">Loading…</div>
      </div>
    );
  }

  if (error || !page) {
    return <NotFound />;
  }

  const canonical = `${SITE}/${page.slug}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title={page.metaTitle || page.title}
        description={page.metaDescription || ""}
        canonical={canonical}
        image={page.heroImageUrl || undefined}
        noindex={!page.indexable}
      />
      <Navigation />

      <section className="pt-28 pb-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="text-xs text-white/50 flex items-center gap-1.5 flex-wrap">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white/80">{page.title}</span>
          </nav>
        </div>
      </section>

      <section className="pt-6 pb-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-3" data-testid="text-page-title">
            {page.title}
          </h1>
          {page.updatedAt && (
            <p className="text-xs text-white/40 mb-6" data-testid="text-page-updated">
              Updated {new Date(page.updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
          {page.heroImageUrl && (
            <img
              src={page.heroImageUrl}
              alt={page.heroImageAlt || ""}
              className="w-full rounded-3xl border border-white/10 mb-8"
              loading="lazy"
              data-testid="img-page-hero"
            />
          )}
        </div>
      </section>

      {/* Body (rich text) */}
      <section className="pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <article
            className="prose prose-invert max-w-none prose-headings:text-white prose-a:text-primary"
            dangerouslySetInnerHTML={{ __html: page.editorContent || "" }}
            data-testid="page-body"
          />
        </div>
      </section>

      {/* Gate banner — shows above the embedded list when gate enabled and user not unlocked */}
      {page.gateEnabled && !hasAccess && page.submissionsEnabled && (
        <section className="pb-6">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <WorldCupEmailBanner
              source={`page-${page.slug}`}
              headline={`🔓 Unlock the full list on ${page.title}`}
              subhead="Drop your email to see every approved entry — free, no spam."
              buttonLabel="Unlock the list"
            />
          </div>
        </section>
      )}

      {/* Embedded approved list */}
      {page.submissionsEnabled && submissions.length > 0 && (
        <section className="pb-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black mb-4">Approved listings</h2>
            <div className="space-y-3">
              {visibleSubmissions.map((s) => {
                // Page admin chooses which field is the big H3; others render
                // smaller below. Defaults to "venueName" for backwards-compat.
                const headerField = page.listingHeaderField || "venueName";
                const dateLabel = formatDateLoose(s.eventDate);
                const headerText =
                  headerField === "eventName" ? (s.eventName || s.venueName) :
                  headerField === "eventDate" ? dateLabel :
                  s.venueName;
                // Suppress the venue/event sublines when they'd just repeat the
                // H3 (e.g. headerField=eventName but the row has no eventName,
                // so headerText falls back to venueName — without this, the
                // same string rendered twice and the page looked unchanged).
                const showVenueLine = headerField !== "venueName" && headerText !== s.venueName;
                const showEventLine = headerField !== "eventName" && !!s.eventName && headerText !== s.eventName;
                const showDateLine = headerField !== "eventDate";
                return (
                <div key={s.id} className="bg-secondary/30 border border-white/10 rounded-2xl p-5" data-testid={`page-submission-${s.id}`}>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                    <h3 className="text-lg font-black text-white">{headerText}</h3>
                    {showEventLine && headerField === "venueName" && <p className="text-sm text-white/60">— {s.eventName}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70 mb-3">
                    {showVenueLine && <span className="inline-flex items-center gap-1.5 text-white/80 font-semibold">{s.venueName}</span>}
                    {showEventLine && headerField !== "venueName" && <span className="text-white/60">— {s.eventName}</span>}
                    <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {s.town}, NJ</span>
                    {showDateLine && <span className="text-white/50">{dateLabel}</span>}
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    {s.instagramHandle && (
                      <a
                        href={`/go?url=${encodeURIComponent(`https://instagram.com/${s.instagramHandle.replace("@", "")}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <Instagram className="w-3.5 h-3.5" />
                        @{s.instagramHandle.replace("@", "")}
                      </a>
                    )}
                    {s.learnMoreUrl && (
                      <a
                        href={`/go?url=${encodeURIComponent(s.learnMoreUrl)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors"
                      >
                        Learn more →
                      </a>
                    )}
                  </div>
                </div>
                );
              })}

              {!hasAccess && hiddenCount > 0 && (
                <div className="relative pt-6 mt-6 border-t border-white/10">
                  <div className="bg-primary/10 border border-primary/30 rounded-2xl p-6 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 border border-primary/40 mb-3">
                      <Lock className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-xl font-black text-white mb-1">
                      {hiddenCount} more {hiddenCount === 1 ? "listing" : "listings"} hidden
                    </h3>
                    <p className="text-sm text-white/70 mb-4">Drop your email above to unlock the full list — free, no spam.</p>
                    <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-primary hover:underline text-sm font-semibold">↑ Jump to the unlock form</a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Submission form */}
      {page.submissionsEnabled && (
        <section className="pb-16">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-secondary/30 border border-white/10 rounded-3xl p-6">
              <h2 className="text-2xl font-black mb-2">Submit your venue</h2>
              <p className="text-sm text-white/70 mb-6">Hosting an event for this page? Submit below. Once approved, you'll appear on the list above.</p>
              <SubmitForm slug={page.slug} pageTitle={page.title} />
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {faqItems.length > 0 && (
        <section className="pb-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black mb-6">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqItems.map((f, i) => (
                <div key={i} className="bg-secondary/30 border border-white/10 rounded-2xl p-5">
                  <h3 className="font-bold text-white mb-2">{f.q}</h3>
                  <p className="text-sm text-white/70 leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function SubmitForm({ slug, pageTitle }: { slug: string; pageTitle: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [submitterRegion, setSubmitterRegion] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venueName, setVenueName] = useState("");
  const [town, setTown] = useState("");
  const [eventName, setEventName] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [learnMoreUrl, setLearnMoreUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // Funnel tracking: fire one engagement event the first time the user
  // interacts with this submission form. Drives the per-page funnel in
  // admin analytics (views → engagements → submissions → approved).
  const engagedRef = useRef(false);
  const sessionIdRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36),
  );
  function trackEngagement() {
    if (engagedRef.current) return;
    engagedRef.current = true;
    fetch("/api/funnel/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: `landing-form-engaged:${slug}`, sessionId: sessionIdRef.current }),
      keepalive: true,
    }).catch(() => {});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!submitterName.trim() || !submitterEmail.trim() || !eventDate.trim() || !venueName.trim() || !town.trim()) {
      setError("Please complete the required fields.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/landing-pages/${slug}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submitterName: submitterName.trim(),
          submitterEmail: submitterEmail.trim().toLowerCase(),
          submitterRegion: submitterRegion || null,
          eventDate: eventDate.trim(),
          venueName: venueName.trim(),
          town: town.trim(),
          eventName: eventName.trim() || null,
          instagramHandle: instagramHandle.trim() || null,
          learnMoreUrl: learnMoreUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Submission failed");
      }
      setSubmitted(true);
      toast({ title: "Submission received", description: "We'll review and email you within 24-48 hours." });
      qc.invalidateQueries({ queryKey: [`/api/landing-pages/${slug}/submissions/approved`] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-green-400 font-semibold">Submission received.</p>
          <p className="text-sm text-white/70 mt-1">We're reviewing your entry at <strong>{venueName}</strong>. Once approved (usually within 24-48 hours), it appears above.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} onFocus={trackEngagement} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-white/80 text-xs">Your name <span className="text-red-400">*</span></Label>
          <Input value={submitterName} onChange={(e) => setSubmitterName(e.target.value)} placeholder="First Last" className="bg-black/40 border-white/10 h-10" required />
        </div>
        <div className="space-y-1">
          <Label className="text-white/80 text-xs">Your email <span className="text-red-400">*</span></Label>
          <Input type="email" value={submitterEmail} onChange={(e) => setSubmitterEmail(e.target.value)} placeholder="you@venue.com" className="bg-black/40 border-white/10 h-10" required />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-white/80 text-xs">What part of NJ are you in?</Label>
        <Select value={submitterRegion} onValueChange={setSubmitterRegion}>
          <SelectTrigger className="bg-black/40 border-white/10 h-10"><SelectValue placeholder="Optional" /></SelectTrigger>
          <SelectContent className="bg-secondary border-white/10 text-white">
            <SelectItem value="North NJ">North NJ</SelectItem>
            <SelectItem value="Central NJ">Central NJ</SelectItem>
            <SelectItem value="South NJ">South NJ</SelectItem>
            <SelectItem value="All">All over / not sure</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-white/80 text-xs">Venue name <span className="text-red-400">*</span></Label>
          <Input value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="The Sports Bar" className="bg-black/40 border-white/10 h-10" required />
        </div>
        <div className="space-y-1">
          <Label className="text-white/80 text-xs">Town <span className="text-red-400">*</span></Label>
          <Input value={town} onChange={(e) => setTown(e.target.value)} placeholder="Newark" className="bg-black/40 border-white/10 h-10" required />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-white/80 text-xs">Event date <span className="text-red-400">*</span></Label>
        <Input value={eventDate} onChange={(e) => setEventDate(e.target.value)} placeholder="2026-07-04 or Jul 4, 2026" className="bg-black/40 border-white/10 h-10" required />
      </div>
      <div className="space-y-1">
        <Label className="text-white/80 text-xs">Event name <span className="text-white/40">(optional)</span></Label>
        <Input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="4th of July Block Party" className="bg-black/40 border-white/10 h-10" />
      </div>
      <div className="space-y-1">
        <Label className="text-white/80 text-xs">Instagram handle <span className="text-white/40">(optional)</span></Label>
        <Input value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} placeholder="@yourvenue" className="bg-black/40 border-white/10 h-10" />
      </div>
      <div className="space-y-1">
        <Label className="text-white/80 text-xs">Learn-more URL <span className="text-white/40">(optional)</span></Label>
        <Input type="url" value={learnMoreUrl} onChange={(e) => setLearnMoreUrl(e.target.value)} placeholder="https://your-event-page.com" className="bg-black/40 border-white/10 h-10" />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold">
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</> : `Submit to "${pageTitle}"`}
      </Button>
    </form>
  );
}
