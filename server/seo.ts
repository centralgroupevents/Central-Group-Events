// Server-side SEO meta + JSON-LD injection.
//
// Background: this is a Vite SPA — the client renders content (and updates head
// tags via react-helmet-async) after JS loads. Modern Googlebot runs JS so it
// eventually sees the right tags, but most AI crawlers (Perplexity, ChatGPT,
// older bots) do not. For those, the only HTML they see is index.html as served
// from disk, which by default has the homepage's title/description/og tags on
// every URL.
//
// This module fixes that: when the SPA catch-all serves index.html, we rewrite
// the head with per-route meta + JSON-LD before sending. For /blog/:slug we
// fetch the post by slug for an accurate title and Article schema.

import { storage } from "./storage";
import { getTopicConfig, countMatchingEvents } from "@shared/seo-topics";

const SITE = "https://centralgroupevents.com";
const DEFAULT_IMAGE = `${SITE}/og-image.jpg`;
const SITE_NAME = "Central Group Events";

interface SeoMeta {
  title: string; // includes " | Central Group Events" suffix
  description: string;
  canonical: string;
  image: string;
  type: "website" | "article";
  publishedAt?: string | null;
  noindex?: boolean;
  jsonLd: object[];
}

const ORG_ID = `${SITE}/#organization`;

const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "@id": ORG_ID,
  "name": SITE_NAME,
  "alternateName": "CGE",
  "url": SITE,
  "logo": { "@type": "ImageObject", "url": `${SITE}/favicon.png` },
  "image": DEFAULT_IMAGE,
  "description":
    "New Jersey's #1 event discovery and promotion platform covering North, Central, and South NJ.",
  "email": "centralgroupevents@gmail.com",
  "priceRange": "$70-$300+",
  "serviceType": "Event Promotion",
  "areaServed": [
    { "@type": "State", "name": "New Jersey" },
    { "@type": "City", "name": "Newark" },
    { "@type": "City", "name": "Jersey City" },
    { "@type": "City", "name": "Hoboken" },
    { "@type": "City", "name": "Paterson" },
    { "@type": "City", "name": "Elizabeth" },
    { "@type": "City", "name": "Trenton" },
    { "@type": "City", "name": "New Brunswick" },
    { "@type": "City", "name": "Atlantic City" },
    { "@type": "City", "name": "Cherry Hill" },
    { "@type": "City", "name": "Montclair" },
  ],
  "sameAs": [
    "https://www.instagram.com/centralgroupevents/",
    "https://www.tiktok.com/@centralgroupevents",
    "https://www.facebook.com/p/Central-Group-Events-61551661541206/",
  ],
};

const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE}/#website`,
  "url": SITE,
  "name": SITE_NAME,
  "publisher": { "@id": ORG_ID },
};

function breadcrumb(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": item.name,
      "item": item.url,
    })),
  };
}

const HOME_META: SeoMeta = {
  title: `Central Group Events — NJ's #1 Event Hub | ${SITE_NAME}`,
  description:
    "Discover the best events in New Jersey every week. North, Central, and South NJ nightlife, brunch spots, live music, R&B nights, and more. Submit or promote your event with CGE.",
  canonical: SITE,
  image: DEFAULT_IMAGE,
  type: "website",
  jsonLd: [ORG_SCHEMA, WEBSITE_SCHEMA],
};

export async function getMetaForRoute(rawPath: string): Promise<SeoMeta> {
  const path = rawPath.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";

  if (path === "/") return HOME_META;

  if (path === "/faq") {
    return {
      title: `FAQ — Central Group Events | ${SITE_NAME}`,
      description:
        "Frequently asked questions about Central Group Events. Pricing, regions, event types, and how to book promotion for your New Jersey event.",
      canonical: `${SITE}/faq`,
      image: DEFAULT_IMAGE,
      type: "website",
      jsonLd: [
        breadcrumb([
          { name: "Home", url: `${SITE}/` },
          { name: "FAQ", url: `${SITE}/faq` },
        ]),
      ],
    };
  }

  if (path === "/blog") {
    return {
      title: `NJ Weekly Newsletter & Event Roundups — Central Group Events | ${SITE_NAME}`,
      description:
        "Get the weekly NJ event roundup from Central Group Events. Discover the hottest events across North, Central, and South New Jersey every week.",
      canonical: `${SITE}/blog`,
      image: DEFAULT_IMAGE,
      type: "website",
      jsonLd: [
        breadcrumb([
          { name: "Home", url: `${SITE}/` },
          { name: "Blog", url: `${SITE}/blog` },
        ]),
      ],
    };
  }

  if (path === "/things-to-do-in-nj") {
    return {
      title: `Things to Do in NJ This Week | ${SITE_NAME}`,
      description:
        "Fun and creative events across North, Central, and South New Jersey — curated weekly. Brunches, concerts, day parties, dance nights, and more.",
      canonical: `${SITE}/things-to-do-in-nj`,
      image: DEFAULT_IMAGE,
      type: "website",
      jsonLd: [
        breadcrumb([
          { name: "Home", url: `${SITE}/` },
          { name: "Things to Do in NJ", url: `${SITE}/things-to-do-in-nj` },
        ]),
      ],
    };
  }

  if (path === "/book") {
    return {
      title: `Book Event Promotion — Central Group Events | ${SITE_NAME}`,
      description:
        "Get your NJ event promoted with Central Group Events. Choose a package and get started in minutes.",
      canonical: `${SITE}/book`,
      image: DEFAULT_IMAGE,
      type: "website",
      noindex: true,
      jsonLd: [],
    };
  }

  if (path === "/world-cup-2026-nj-watch-parties") {
    return {
      title: `2026 FIFA World Cup Watch Parties in NJ | ${SITE_NAME}`,
      description:
        "Find every New Jersey venue hosting an official 2026 FIFA World Cup watch party. Listings by week and match — Newark, Jersey City, Hoboken, Atlantic City, and across NJ.",
      canonical: `${SITE}/world-cup-2026-nj-watch-parties`,
      image: DEFAULT_IMAGE,
      type: "website",
      jsonLd: [
        breadcrumb([
          { name: "Home", url: `${SITE}/` },
          { name: "World Cup 2026 NJ Guide", url: `${SITE}/world-cup-2026-nj-guide` },
          { name: "Watch Parties", url: `${SITE}/world-cup-2026-nj-watch-parties` },
        ]),
      ],
    };
  }

  if (path === "/submit-world-cup-watch-party") {
    return {
      title: `Submit a World Cup 2026 Watch Party in NJ | ${SITE_NAME}`,
      description:
        "Hosting a 2026 FIFA World Cup watch party at your New Jersey venue? Submit it here for free listing on our public watch parties page.",
      canonical: `${SITE}/submit-world-cup-watch-party`,
      image: DEFAULT_IMAGE,
      type: "website",
      noindex: true,
      jsonLd: [],
    };
  }

  if (path === "/booking-confirmation" || path === "/welcome" || path === "/admin" || path.startsWith("/admin/")) {
    return { ...HOME_META, canonical: `${SITE}${path}`, noindex: true, jsonLd: [] };
  }

  // /blog/:slug — fetch post for accurate title + Article schema
  if (path.startsWith("/blog/")) {
    const slug = path.slice("/blog/".length).split("/")[0];
    try {
      const post = await storage.getPostBySlug(slug);
      if (post && post.isPublished) {
        const canonical = `${SITE}/blog/${slug}`;
        return {
          title: `${post.title} | ${SITE_NAME}`,
          description: post.excerpt || `${post.title} — ${SITE_NAME}`,
          canonical,
          image: post.coverImageUrl || DEFAULT_IMAGE,
          type: "article",
          publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString() : null,
          jsonLd: [
            {
              "@context": "https://schema.org",
              "@type": "Article",
              "headline": post.title,
              "description": post.excerpt,
              "image": post.coverImageUrl,
              "datePublished": post.publishedAt ? new Date(post.publishedAt).toISOString() : null,
              "mainEntityOfPage": canonical,
              "author": { "@type": "Organization", "name": SITE_NAME },
              "publisher": { "@id": ORG_ID },
            },
            breadcrumb([
              { name: "Home", url: `${SITE}/` },
              { name: "Blog", url: `${SITE}/blog` },
              { name: post.title, url: canonical },
            ]),
          ],
        };
      }
    } catch {
      // fall through to default
    }
  }

  // Programmatic topic landing pages (city, type, city-type combos, time, tentpole).
  // Each topic is configured in shared/seo-topics.ts. Slug = the path minus leading /.
  const topicSlug = path.replace(/^\//, "");
  const topic = getTopicConfig(topicSlug);
  if (topic) {
    const canonical = `${SITE}/${topic.slug}`;
    let noindex = false;
    if (!topic.alwaysIndex) {
      try {
        const events = await storage.getEvents(undefined, false);
        const matching = countMatchingEvents(events, topic.filter);
        if (matching < 3) noindex = true;
      } catch {
        // If the count query fails, default to indexing (less destructive).
      }
    }

    const breadcrumbJsonLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": `${SITE}/` },
        { "@type": "ListItem", "position": 2, "name": "Things to Do in NJ", "item": `${SITE}/things-to-do-in-nj` },
        { "@type": "ListItem", "position": 3, "name": topic.h1, "item": canonical },
      ],
    };
    const faqJsonLd = topic.faqItems && topic.faqItems.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": topic.faqItems.map((item) => ({
            "@type": "Question",
            "name": item.q,
            "acceptedAnswer": { "@type": "Answer", "text": item.a },
          })),
        }
      : null;
    const jsonLd: object[] = [breadcrumbJsonLd];
    if (faqJsonLd) jsonLd.push(faqJsonLd);

    return {
      title: topic.metaTitle,
      description: topic.metaDescription,
      canonical,
      image: DEFAULT_IMAGE,
      type: "website",
      noindex,
      jsonLd,
    };
  }

  // Default: serve homepage meta but mark canonical to the actual path so we
  // don't accidentally canonicalize unknown URLs to root.
  return { ...HOME_META, canonical: `${SITE}${path}` };
}

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function injectSeoIntoHtml(html: string, meta: SeoMeta): string {
  const title = escAttr(meta.title);
  const desc = escAttr(meta.description);
  const can = escAttr(meta.canonical);
  const img = escAttr(meta.image);
  const robots = meta.noindex ? "noindex, nofollow" : "index, follow";

  const jsonLdHtml = meta.jsonLd
    .map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
    .join("\n    ");

  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description"[^>]*\/>/, `<meta name="description" content="${desc}" />`)
    .replace(/<meta name="robots"[^>]*\/>/, `<meta name="robots" content="${robots}" />`)
    .replace(/<link rel="canonical"[^>]*\/>/, `<link rel="canonical" href="${can}" />`)
    .replace(/<meta property="og:type"[^>]*\/>/, `<meta property="og:type" content="${meta.type}" />`)
    .replace(/<meta property="og:url"[^>]*\/>/, `<meta property="og:url" content="${can}" />`)
    .replace(/<meta property="og:title"[^>]*\/>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description"[^>]*\/>/, `<meta property="og:description" content="${desc}" />`)
    .replace(/<meta property="og:image"[^>]*\/>/, `<meta property="og:image" content="${img}" />`)
    .replace(/<meta name="twitter:url"[^>]*\/>/, `<meta name="twitter:url" content="${can}" />`)
    .replace(/<meta name="twitter:title"[^>]*\/>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta name="twitter:description"[^>]*\/>/, `<meta name="twitter:description" content="${desc}" />`)
    .replace(/<meta name="twitter:image"[^>]*\/>/, `<meta name="twitter:image" content="${img}" />`)
    .replace("</head>", jsonLdHtml ? `    ${jsonLdHtml}\n  </head>` : "</head>");
}
