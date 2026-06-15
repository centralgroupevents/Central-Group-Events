import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { ChevronRight } from "lucide-react";
import NotFound from "@/pages/not-found";

const SITE = "https://centralgroupevents.com";

interface LandingPage {
  id: number;
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  heroImageUrl: string | null;
  editorContent: string;
  indexable: boolean;
  gateEnabled: boolean;
  submissionsEnabled: boolean;
  published: boolean;
  faqItems: string;
}

interface Props {
  slug: string;
}

/**
 * Renders an admin-created landing page from the `pages` table. Used by
 * TopicLanding as a fallback when the slug isn't in the static topics config.
 * If the page isn't published or doesn't exist, returns NotFound.
 */
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

  let faqItems: { q: string; a: string }[] = [];
  try {
    faqItems = JSON.parse(page.faqItems || "[]");
  } catch {
    faqItems = [];
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

      {/* Breadcrumb */}
      <section className="pt-28 pb-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="text-xs text-white/50 flex items-center gap-1.5 flex-wrap">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white/80">{page.title}</span>
          </nav>
        </div>
      </section>

      {/* Hero */}
      <section className="pt-6 pb-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6" data-testid="text-page-title">
            {page.title}
          </h1>
          {page.heroImageUrl && (
            <img
              src={page.heroImageUrl}
              alt=""
              className="w-full rounded-3xl border border-white/10 mb-8"
              loading="lazy"
              data-testid="img-page-hero"
            />
          )}
        </div>
      </section>

      {/* Body (rich text) */}
      <section className="pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* eslint-disable-next-line react/no-danger -- admin-authored HTML, sanitized in the editor */}
          <article
            className="prose prose-invert max-w-none prose-headings:text-white prose-a:text-primary"
            dangerouslySetInnerHTML={{ __html: page.editorContent || "" }}
            data-testid="page-body"
          />
        </div>
      </section>

      {/* FAQ (if any) */}
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
