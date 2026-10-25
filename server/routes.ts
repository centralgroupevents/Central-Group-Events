import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { body, validationResult } from "express-validator";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth, verifyAdminToken } from "./auth";
import { complianceFooter, listUnsubscribeHeaders, decodeEmail, verifyUnsubscribeToken, signToken, verifySignedToken, postalAddress } from "./email-compliance";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"));
    }
  },
});

// Validate Cloudinary env vars at startup
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.warn("[cloudinary] WARNING: CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET not set. Image uploads will fail.");
} else {
  console.log("[cloudinary] Cloudinary credentials loaded.");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// ── Email blast tracking helpers ──────────────────────────────────────
// Public site URL — used in the tracking pixel + click-redirect URLs we
// embed in outbound emails. Falls back to prod hostname.
function emailTrackingBase(): string {
  return process.env.PUBLIC_SITE_URL || "https://centralgroupevents.com";
}
function encodeRecipient(email: string): string {
  return Buffer.from(email).toString("base64url");
}
function decodeRecipient(b64: string): string {
  try { return Buffer.from(b64, "base64url").toString("utf8"); } catch { return ""; }
}
// Append a 1x1 transparent tracking pixel to outbound email HTML. Fires
// a GET on render, which we log as an "open" event. Note: some clients
// (Gmail) proxy images, so the IP isn't a real visitor — opens are
// still useful as a directional metric but never exact.
function appendTrackingPixel(html: string, blastId: number, email: string): string {
  const r = encodeRecipient(email);
  const tag = `<img src="${emailTrackingBase()}/api/email/track/open?b=${blastId}&r=${r}" width="1" height="1" alt="" style="display:block;border:0;outline:none;text-decoration:none;height:1px;width:1px" />`;
  return html.includes("</body>") ? html.replace("</body>", `${tag}</body>`) : `${html}${tag}`;
}
// Rewrite every absolute http(s) href in the email through our click
// redirect, so we get a "click" event with the destination URL when
// recipients tap a link. Skips our own tracker URLs so we don't double-wrap.
function wrapEmailLinks(html: string, blastId: number, email: string): string {
  const r = encodeRecipient(email);
  const base = emailTrackingBase();
  return html.replace(/href="(https?:\/\/[^"]+)"/gi, (match, url) => {
    if (url.includes("/api/email/track/")) return match;
    // Unsubscribe must keep working even if the click tracker doesn't —
    // never route opt-outs through the redirect.
    if (url.includes("/unsubscribe")) return match;
    const tracked = `${base}/api/email/track/click?b=${blastId}&r=${r}&u=${encodeURIComponent(url)}`;
    return `href="${tracked}"`;
  });
}

// Normalize a free-text URL field: prepend https:// if missing, treat empty
// as null. Doesn't validate the URL beyond that — admin imports often have
// bare domains like "posh.vip/event/foo" or "instagram.com/handle".
function normalizeUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Looks like a bare domain or path — prepend https://
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

// Flexible date parser used by the admin World Cup CSV bulk import.
// Accepts YYYY-MM-DD, MM/DD/YYYY, MM/DD/YY, "Jun 11 2026", "Jun 11, 2026",
// and date ranges (any "–", "-", "to", "through" separator) by taking the
// start date. Returns "YYYY-MM-DD" or null if it can't make sense of it.
// Re-host Instagram CDN images on our Cloudinary account so they don't expire
// after a few days (the IG CDN signs URLs with short-lived tokens). Pass-through
// anything that isn't an IG/FB CDN URL, and fall back to the original on any
// error so a single bad image never fails the whole import.
// Re-hosts Instagram/Facebook CDN URLs on Cloudinary so the image persists.
// On any failure (expired token, non-image content-type, network blip,
// Cloudinary error) returns "" so the caller saves nothing and the placeholder
// renders instead of a broken-image thumbnail. Non-IG URLs pass through.
async function rehostInstagramImage(srcUrl: string | null | undefined): Promise<string> {
  if (!srcUrl) return "";
  const url = String(srcUrl).trim();
  if (!url) return "";
  const isIgCdn = /(cdninstagram\.com|fbcdn\.net)/i.test(url);
  if (!isIgCdn) return url;
  try {
    // Hand the URL directly to Cloudinary — Cloudinary's own servers fetch the
    // image, not ours. IG blocks our Replit IP with 403 even with browser
    // headers, but Cloudinary's infrastructure usually gets through. If
    // Cloudinary also fails, we get an error and fall through to "".
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const result = await cloudinary.uploader.upload(url, {
      folder: "cge/events",
      resource_type: "image",
    });
    if (!result?.secure_url) {
      console.warn("[rehost] Cloudinary returned no secure_url for", url.slice(0, 100));
      return "";
    }
    console.log(`[rehost] OK ${url.slice(0, 80)}… → ${result.secure_url}`);
    return result.secure_url;
  } catch (err) {
    console.warn("[rehost] failed for", url.slice(0, 100), err instanceof Error ? err.message : err);
    return "";
  }
}

function parseFlexibleWcDate(input: string): string | null {
  if (!input) return null;
  let raw = String(input).trim();
  // Excel serial date fallback (e.g. "46184" → 2026-06-11). Triggers when an
  // XLSX cell came through as the raw number (cellDates/raw:false missed it).
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber > 30000 && asNumber < 80000 && /^\d+(\.\d+)?$/.test(raw)) {
    const ms = Date.UTC(1899, 11, 30) + asNumber * 86_400_000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    }
  }
  // Strip any range — take the first half (e.g., "Jun 11 – Jul 19, 2026" → "Jun 11")
  // Range separators: en-dash, em-dash, hyphen between dates, "to", "through".
  // We split, but preserve the year from the second half if first half lacks it.
  const rangeSplit = raw.split(/\s+(?:[–—\-]|to|through)\s+/i);
  let head = rangeSplit[0].trim();
  if (rangeSplit.length > 1 && !/\d{4}/.test(head)) {
    // Year sits at the end of the second half → append it to the head
    const yearMatch = rangeSplit[1].match(/(\d{4})/);
    if (yearMatch) head = `${head}, ${yearMatch[1]}`;
  }
  // Try ISO first
  const iso = head.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // Try MM/DD/YYYY or MM/DD/YY
  const slash = head.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const yr = slash[3].length === 2 ? "20" + slash[3] : slash[3];
    return `${yr}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
  }
  // Bare M/D with no year (e.g. "7/18" in the weekly events export) —
  // assume the nearest sensible occurrence: current year, rolling to next
  // year when that date is more than ~6 months in the past.
  const bare = head.match(/^(\d{1,2})[/.\-](\d{1,2})$/);
  if (bare) {
    const mo = parseInt(bare[1], 10);
    const dy = parseInt(bare[2], 10);
    if (mo >= 1 && mo <= 12 && dy >= 1 && dy <= 31) {
      const now = new Date();
      let yr = now.getFullYear();
      if ((now.getTime() - new Date(yr, mo - 1, dy).getTime()) / 86_400_000 > 180) yr += 1;
      return `${yr}-${String(mo).padStart(2, "0")}-${String(dy).padStart(2, "0")}`;
    }
  }
  // Fall back to JS Date parser for natural-language ("Jun 11, 2026").
  // Reject the V8 "year 2001" default (fires for year-less inputs) and
  // anything outside a sane range — better to flag the row than to
  // silently import an event dated two decades ago.
  const d = new Date(head);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    if (year === 2001 && !/2001/.test(head)) return null;
    if (year < 1970 || year > 2100) return null;
    return `${year}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return null;
}

const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many submissions, please try again later." },
});

// Generous limit for public read endpoints (landing-page lookup, approved
// submissions). Stops scraper abuse without affecting real visitors.
const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  message: { error: "Too many requests, please try again in a minute." },
});

// IndexNow — instant URL submission to Bing/Yandex/Seznam/Naver. Free, no
// auth, no API setup. Key is published at /<KEY>.txt so search engines can
// verify ownership. Override with INDEXNOW_KEY env var to rotate.
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || "7c2a9e5f3b8d1c6e4a2f9b8d5c3e1a7f";

async function pingIndexNow(urls: string[]): Promise<{ ok: boolean; status?: number }> {
  if (urls.length === 0) return { ok: true };
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: "centralgroupevents.com",
        key: INDEXNOW_KEY,
        keyLocation: `https://centralgroupevents.com/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
    });
    // 200 or 202 both indicate success per the IndexNow spec.
    if (res.ok || res.status === 202) {
      console.log(`[indexnow] ${res.status} — pinged ${urls.length} URL(s): ${urls.join(", ")}`);
      return { ok: true, status: res.status };
    }
    console.warn(`[indexnow] ${res.status} for ${urls.join(", ")}`);
    return { ok: false, status: res.status };
  } catch (err) {
    console.warn("[indexnow] failed:", err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

const bookingValidators = [
  body("email").isEmail().withMessage("Invalid email address").normalizeEmail(),
  body("phone").optional({ checkFalsy: true }).matches(/^[\d\s\-\+\(\)]+$/).withMessage("Invalid phone number"),
  body("eventDate").notEmpty().withMessage("Event date is required"),
  body("eventName").optional().trim().escape(),
  body("eventTime").optional().trim().escape(),
  body("city").optional().trim().escape(),
  body("mode").optional().trim().escape(),
  body("venueName").trim().escape(),
  body("contactName").optional().trim().escape(),
  body("instagramHandle").optional().trim().escape(),
  body("region").trim().escape(),
  body("eventType").trim().escape(),
  body("eventTypeOther").optional().trim().escape(),
  body("budgetRange").optional().trim().escape(),
  body("additionalInfo").optional().trim().escape(),
];

const JWT_SECRET = () => {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET environment variable is not set");
  return s;
};
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
};

function issueAdminJwt(res: Response, payload: { id: number; email: string; role: string }) {
  const token = jwt.sign(payload, JWT_SECRET(), { expiresIn: "7d" });
  res.cookie("cge_admin_jwt", token, {
    ...COOKIE_OPTS,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ── Sitemap & Robots — registered FIRST, before any catch-alls ───────
  app.get("/sitemap.xml", async (_req: Request, res: Response) => {
    console.log("[sitemap] GET /sitemap.xml hit");
    try {
      const { getAllTopics, countMatchingEvents } = await import("@shared/seo-topics");
      const [publishedPosts, allEvents, landingPages] = await Promise.all([
        storage.getPublishedPosts(),
        storage.getEvents(undefined, false),
        storage.listPublishedLandingPages(),
      ]);

      const landingPageEntries = landingPages
        .filter((p) => p.indexable)
        .map(
          (p) => `
  <url>
    <loc>https://centralgroupevents.com/${p.slug}</loc>
    <lastmod>${(p.updatedAt instanceof Date ? p.updatedAt : new Date()).toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${p.sitemapPriority || "0.7"}</priority>
  </url>`,
        )
        .join("");

      const postEntries = publishedPosts
        .map(
          (p) => `
  <url>
    <loc>https://centralgroupevents.com/blog/${p.slug}</loc>
    <lastmod>${p.publishedAt ? new Date(p.publishedAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
        )
        .join("");

      // Topic landing pages — Tier 2 pages are only included if they have at least
      // 3 matching events this week (otherwise they're noindex anyway).
      const topicEntries = getAllTopics()
        .filter((t) => t.alwaysIndex || countMatchingEvents(allEvents, t.filter) >= 3)
        .map(
          (t) => `
  <url>
    <loc>https://centralgroupevents.com/${t.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>${t.pageType === "tentpole" ? "0.9" : t.alwaysIndex ? "0.8" : "0.7"}</priority>
  </url>`,
        )
        .join("");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://centralgroupevents.com</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://centralgroupevents.com/blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://centralgroupevents.com/things-to-do-in-nj</loc>
    <changefreq>daily</changefreq>
    <priority>0.95</priority>
  </url>
  <url>
    <loc>https://centralgroupevents.com/events/this-weekend-in-nj</loc>
    <changefreq>daily</changefreq>
    <priority>0.95</priority>
  </url>
  <url>
    <loc>https://centralgroupevents.com/events/north-nj</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://centralgroupevents.com/events/central-nj</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://centralgroupevents.com/events/south-nj</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://centralgroupevents.com/faq</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://centralgroupevents.com/guides</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://centralgroupevents.com/world-cup-2026-nj-watch-parties</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://centralgroupevents.com/submit-world-cup-watch-party</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://centralgroupevents.com/nba-finals-2026-nj-watch-parties</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://centralgroupevents.com/submit-nba-finals-watch-party</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>${topicEntries}${landingPageEntries}${postEntries}
</urlset>`;
      console.log(`[sitemap] returning ${publishedPosts.length} blog entries + topic landings`);
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.status(200).send(xml);
    } catch (err) {
      console.error("[sitemap] error:", err);
      res.status(500).send("Error generating sitemap");
    }
  });

  app.get("/robots.txt", (_req: Request, res: Response) => {
    console.log("[robots] GET /robots.txt hit");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.status(200).send(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /booking-confirmation\nDisallow: /welcome\nSitemap: https://centralgroupevents.com/sitemap.xml`
    );
  });

  // Google Search Console HTML-file ownership verification (backup #2 to the
  // HTML-tag method in client/index.html). Serves the exact token Google expects
  // at https://centralgroupevents.com/google5fb54af821f6cd6d.html.
  app.get("/google5fb54af821f6cd6d.html", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send("google-site-verification: google5fb54af821f6cd6d.html");
  });

  // IndexNow key file. The filename IS the key — that's the IndexNow ownership
  // convention. Bing/Yandex/etc. fetch this to verify we own the host before
  // accepting our URL submissions.
  app.get(`/${INDEXNOW_KEY}.txt`, (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.status(200).send(INDEXNOW_KEY);
  });

  // ── /llms.txt — concise overview for AI crawlers (Anthropic-proposed convention)
  app.get("/llms.txt", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.status(200).send(
`# Central Group Events

> New Jersey's #1 event discovery and promotion platform. We cover North, Central, and South NJ with curated weekly event listings, paid event promotion across newsletter, Instagram reels, paid ads, SMS blasts, and influencer campaigns.

## About
Central Group Events (CGE) is a New Jersey event promotion agency. We promote 100+ events weekly. Pricing tiers: Basic (free calendar listing), Starter ($70/event), Growth ($150/event with premium newsletter placement + SMS blast), and Custom ($300+/event with influencer reposts).

## Service area
All of New Jersey — Newark, Jersey City, Hoboken, Paterson, Elizabeth, Montclair, Trenton, New Brunswick, Edison, Atlantic City, Cherry Hill, Camden, and surrounding areas.

## Important URLs
- [Homepage](https://centralgroupevents.com/): event discovery + pricing
- [Things to Do in NJ This Week](https://centralgroupevents.com/things-to-do-in-nj): curated weekly event listings
- [Blog / Newsletter](https://centralgroupevents.com/blog): weekly NJ event roundups
- [Book Event Promotion](https://centralgroupevents.com/book): submit and pay for event promotion
- [FAQ](https://centralgroupevents.com/faq): pricing, lead times, regions covered
- [Sitemap](https://centralgroupevents.com/sitemap.xml): all indexable URLs
- [Full LLM context](https://centralgroupevents.com/llms-full.txt): expanded details for AI agents

## Contact
Email: centralgroupevents@gmail.com
Instagram: @centralgroupevents
`,
    );
  });

  // ── /llms-full.txt — expanded context including FAQs and recent blog posts
  app.get("/llms-full.txt", async (_req: Request, res: Response) => {
    try {
      const posts = await storage.getPublishedPosts();
      const recent = posts.slice(0, 10);
      const blogList = recent.map((p) => {
        const date = p.publishedAt ? new Date(p.publishedAt).toISOString().split("T")[0] : "";
        return `- [${p.title}](https://centralgroupevents.com/blog/${p.slug}) — ${date}${p.excerpt ? `: ${p.excerpt}` : ""}`;
      }).join("\n");

      const faqText = [
        ["How do I submit my event?", "Use the Book Promotion form on our homepage or visit /book to pick a package and submit your details."],
        ["What does NJ event promotion cost?", "Basic (free calendar listing), Starter ($70/event), Growth ($150/event with reels, premium newsletter placement, and SMS blast), Custom ($300+/event for influencer reposts and dedicated campaign timelines)."],
        ["How far in advance should I book event promotion?", "At least 7 days before your event. For time-sensitive events (holidays, special weekends), 2 weeks in advance is recommended."],
        ["Which New Jersey regions do you cover?", "All of New Jersey — North NJ (Newark, Jersey City, Hoboken, Paterson, Elizabeth, Montclair), Central NJ (Trenton, New Brunswick, Edison, Plainfield), and South NJ (Atlantic City, Cherry Hill, Camden)."],
        ["What kinds of events do you promote?", "Club nights, concerts, day parties, brunches, festivals, comedy shows, pop-ups, networking events, and lounge events. Any public, attendee-facing event in New Jersey."],
        ["Do you do influencer promotion?", "Yes — included in our Custom package. We have a network of NJ-based content creators who repost and feature events to their audiences."],
        ["When does my event get posted after I book?", "Our team confirms scheduling and invoicing within 24 hours. Content goes live on your agreed posting date, typically the week of your event."],
        ["Is the newsletter free?", "Yes, completely free. Weekly NJ events roundup with no spam."],
      ].map(([q, a]) => `### ${q}\n${a}`).join("\n\n");

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.status(200).send(
`# Central Group Events — Full Context for AI Agents

> Comprehensive context about CGE, our services, our content, and recent publications. This file is intended for LLM crawlers and agents that want richer information than what's in /llms.txt.

## What we do
Central Group Events (CGE) is a curated New Jersey event promotion agency operating since 2026. We act as a hub for NJ social, nightlife, brunch, day-party, concert, festival, and community events. We help event organizers reach audiences through:

- Weekly curated newsletter (free to subscribers)
- Instagram reels and stories
- Premium newsletter placement
- SMS blasts to engaged subscribers
- Targeted Meta ad campaigns
- Influencer reposts via our content creator network
- Calendar listings in our public event hub

## Service packages

### Basic — Free
Event calendar listing only. Best for organizers who want exposure without paying for promotion.

### Starter — $70 per event
- Event calendar listing
- Instagram story feature
- Newsletter mention
- Facebook post

### Growth — $150 per event ("Most Popular")
- Everything in Starter
- Instagram reel feature
- Premium newsletter placement
- SMS blast to engaged subscribers

### Custom — $300+ per event
- Everything in Growth
- Influencer reposts
- Strategy call included
- Custom campaign timeline

## Service area
North NJ: Newark, Jersey City, Hoboken, Paterson, Elizabeth, Montclair, Bloomfield, Edgewater.
Central NJ: Trenton, New Brunswick, Edison, Plainfield, Hamilton, Iselin, Somerville.
South NJ: Atlantic City, Cherry Hill, Camden, Mt. Laurel.

## Frequently asked questions

${faqText}

## Recent posts on our blog

${blogList || "_No recent posts yet._"}

## Contact

- Email: centralgroupevents@gmail.com
- Instagram: https://www.instagram.com/centralgroupevents/
- TikTok: https://www.tiktok.com/@centralgroupevents
- Booking: https://centralgroupevents.com/book
`,
      );
    } catch {
      res.status(500).send("Error generating /llms-full.txt");
    }
  });

  // ── /blog/rss.xml — RSS 2.0 feed of published posts
  app.get("/blog/rss.xml", async (_req: Request, res: Response) => {
    try {
      const posts = await storage.getPublishedPosts();
      const items = posts.slice(0, 20).map((p) => {
        const url = `https://centralgroupevents.com/blog/${p.slug}`;
        const pubDate = p.publishedAt ? new Date(p.publishedAt).toUTCString() : new Date().toUTCString();
        const escapeXml = (s: string | null | undefined) =>
          (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
        return `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(p.excerpt || "")}</description>
    </item>`;
      }).join("");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Central Group Events Blog</title>
    <link>https://centralgroupevents.com/blog</link>
    <atom:link href="https://centralgroupevents.com/blog/rss.xml" rel="self" type="application/rss+xml" />
    <description>Weekly NJ event roundups and nightlife guides from Central Group Events.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}
  </channel>
</rss>`;
      res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.status(200).send(xml);
    } catch {
      res.status(500).send("Error generating RSS feed");
    }
  });

  // ── Existing newsletter subscriber route ─────────────────────────────
  app.post(api.subscribers.create.path, formLimiter, async (req, res) => {
    try {
      const input = api.subscribers.create.input.parse(req.body);
      input.email = input.email.toLowerCase().trim();
      // An explicit signup by the person themselves is fresh consent — it may
      // reactivate a previously-unsubscribed email. Anything else (duplicate
      // active subscriber) stays a 409 like before.
      const existing = await storage.findSubscriberByEmail(input.email);
      if (existing?.unsubscribedAt) {
        await storage.reactivateSubscriber(input.email, {
          region: input.region ?? undefined,
          referrer: input.referrer,
          landingPath: input.landingPath,
          utmSource: input.utmSource,
        });
      } else {
        await storage.createSubscriber(input);
      }
      res.status(201).json({ message: "Successfully subscribed to the newsletter!" });
      try {
        await transporter.sendMail({
          from: `"CGE Website" <${process.env.GMAIL_USER}>`,
          to: "centralgroupevents@gmail.com",
          subject: `📧 New Newsletter Signup — ${input.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 32px; border-radius: 12px;">
              <h1 style="color: #8B2FC9; margin-bottom: 4px;">New Newsletter Subscriber</h1>
              <p style="color: #999; margin-bottom: 32px;">Submitted via centralgroupevents.com</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999; width: 40%;">Name</td>
                  <td style="padding: 12px 0; color: #fff; font-weight: bold;">${input.name}</td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Email</td>
                  <td style="padding: 12px 0; color: #fff;"><a href="mailto:${input.email}" style="color: #8B2FC9;">${input.email}</a></td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Region</td>
                  <td style="padding: 12px 0; color: #fff;">${input.region || "Not specified"}</td>
                </tr>
              </table>
              <p style="color: #555; font-size: 12px; margin-top: 24px; text-align: center;">
                Central Group Events • centralgroupevents@gmail.com
              </p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Email notification failed:", emailError);
      }

      // Welcome email to the subscriber
      try {
        await transporter.sendMail({
          from: `"Central Group Events" <${process.env.GMAIL_USER}>`,
          to: input.email,
          subject: "Welcome to the CGE Newsletter 🎉",
          headers: listUnsubscribeHeaders(input.email),
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 40px 32px; border-radius: 12px; border: 1px solid #1e1e1e;">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #8B2FC9; font-size: 28px; margin: 0 0 4px;">CGE</h1>
                <p style="color: #666; font-size: 12px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Central Group Events</p>
              </div>

              <h2 style="font-size: 24px; font-weight: 900; color: #ffffff; text-align: center; margin-bottom: 16px;">You're on the list!</h2>

              <p style="color: #cccccc; font-size: 16px; line-height: 1.6; text-align: center; margin-bottom: 32px;">
                Thanks for subscribing to the CGE Newsletter. Every week we send the hottest events across North, Central, and South NJ straight to your inbox. No spam. Just the best events.
              </p>

              <div style="text-align: center; margin-bottom: 40px;">
                <a href="https://centralgroupevents.com/things-to-do-in-nj" style="display: inline-block; background: #8B2FC9; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 15px; padding: 14px 32px; border-radius: 10px;">
                  See What's Happening in NJ
                </a>
              </div>

              ${complianceFooter(input.email, "You're receiving this because you subscribed to the weekly newsletter at centralgroupevents.com.")}
            </div>
          `,
        });
      } catch (welcomeEmailError) {
        console.error("Welcome email to subscriber failed:", welcomeEmailError);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      // PostgreSQL unique-constraint violation on email column
      const pgErr = err as { code?: string };
      if (pgErr.code === "23505") {
        return res.status(409).json({ message: "Email already subscribed." });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Build to Last Vol. 1 — RSVP + cadence ────────────────────────────

  // Public RSVP submit. Validates per the brief (140-char guest-book line,
  // at least one topic), blocks duplicate emails per event, fires the
  // confirmation email immediately.
  app.post("/api/build-to-last/rsvp", formLimiter, async (req: Request, res: Response) => {
    try {
      const { btlRsvpInputSchema } = await import("@shared/schema");
      const input = btlRsvpInputSchema.parse(req.body);
      // Personalized links (from the thank-you email) carry a signed
      // identity: e = base64url email, t = HMAC. A valid pair overrides the
      // typed email and allows re-submitting to update earlier answers.
      const tokenE = String((req.body as { e?: string })?.e || "");
      const tokenT = String((req.body as { t?: string })?.t || "");
      let verifiedEmail: string | null = null;
      if (tokenE || tokenT) {
        const dec = decodeEmail(tokenE);
        if (!dec || !verifySignedToken(dec, tokenT)) {
          return res.status(400).json({ message: "This personalized link is invalid — open the link from your email again." });
        }
        verifiedEmail = dec;
      }
      const email = (verifiedEmail || input.email).toLowerCase().trim();
      const { BTL_SLUG: slug } = await import("./btl-emails");
      // Canonical interest keys + the free-text "Other" in one array; the
      // breakdown/filters ignore non-key entries, the admin chips show them.
      const interestsJson = JSON.stringify([
        ...input.topicInterests,
        ...(input.otherInterest ? [`Other: ${input.otherInterest}`] : []),
      ]);

      const existing = await storage.getBtlRsvpByEmail(slug, email);
      if (existing) {
        if (verifiedEmail) {
          await storage.updateBtlRsvp(existing.id, {
            name: input.name,
            workingOnNow: input.workingOnNow,
            keyQuestion: input.keyQuestion,
            contactSheetOptin: input.contactSheetOptin,
            topicInterests: interestsJson,
          });
          // Keep the invite row's mirror of their answer current too.
          try {
            const invitees = await storage.listBtlInvitees(slug);
            const match = invitees.find((i) => i.email === email);
            if (match) {
              await storage.updateBtlInvitee(match.id, {
                rsvpStatus: "confirmed",
                interests: interestsJson,
              });
            }
          } catch (err) {
            console.warn("[btl] invite-status sync failed:", err);
          }
          return res.json({ message: "Your answers are in — see you November 12th." });
        }
        return res.status(409).json({ message: "You're already on the list for Build to Last — check your inbox for the confirmation." });
      }

      const rsvp = await storage.createBtlRsvp({
        eventSlug: slug,
        name: input.name,
        email,
        role: input.role,
        companyOrHandle: input.companyOrHandle || null,
        workingOnNow: input.workingOnNow,
        keyQuestion: input.keyQuestion,
        topicInterests: interestsJson,
        contactSheetOptin: input.contactSheetOptin,
        attendeeSource: input.attendeeSource || null,
      });

      res.status(201).json({ message: "You're in. Check your email for confirmation." });

      // Mark a matching invite-list row confirmed so the second wave skips them.
      try {
        const invitees = await storage.listBtlInvitees(slug);
        const match = invitees.find((i) => i.email === email);
        if (match) {
          await storage.updateBtlInvitee(match.id, {
            rsvpStatus: "confirmed",
            // Mirror their "walk away with" answer onto the invite row so the
            // admin sees it inline.
            interests: interestsJson,
          });
        }
      } catch (err) {
        console.warn("[btl] invite-status sync failed:", err);
      }

      // Confirmation email (Touch 2A) — non-blocking for the response.
      try {
        const { renderBtlTemplate, buildBtlRenderCtx } = await import("./btl-cadence");
        const { deliverBtlEmail } = await import("./btl-mailer");
        const ctx = await buildBtlRenderCtx();
        const tpl = await renderBtlTemplate("confirmation", { name: input.name, email, contactSheetOptin: input.contactSheetOptin }, ctx);
        if (!tpl) throw new Error("confirmation template missing");
        const outcome = await deliverBtlEmail({ email, rsvpId: rsvp.id }, "confirmation", tpl);
        if (outcome === "sent") {
          await storage.updateBtlRsvp(rsvp.id, { confirmationSentAt: new Date() });
        }
      } catch (err) {
        console.error("[btl] confirmation email failed:", err);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      // Unique-index race: two submits of the same email at once.
      if ((err as { code?: string }).code === "23505") {
        return res.status(409).json({ message: "You're already on the list for Build to Last — check your inbox for the confirmation." });
      }
      console.error("[btl/rsvp] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Unsubscribe from the Build to Last cadence. GET shows a tiny confirm
  // page (so inbox link-scanners can't opt people out); the POST does it.
  app.get("/api/build-to-last/unsubscribe", (req: Request, res: Response) => {
    const e = String(req.query.e || "");
    const t = String(req.query.t || "");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe — Build to Last</title></head>
      <body style="margin:0;background:#faf8f4;font-family:Georgia,serif;color:#262118">
        <div style="max-width:480px;margin:80px auto;padding:0 20px;text-align:center">
          <h1 style="font-size:22px">Build to Last emails</h1>
          <p style="line-height:1.7">Click below to stop receiving emails about Build to Last Vol. 1.</p>
          <form method="POST" action="/api/build-to-last/unsubscribe?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}">
            <button type="submit" style="background:#262118;color:#faf8f4;border:0;padding:12px 28px;font-size:15px;font-family:Georgia,serif;cursor:pointer">Unsubscribe</button>
          </form>
        </div>
      </body></html>`);
  });

  app.post("/api/build-to-last/unsubscribe", async (req: Request, res: Response) => {
    try {
      const e = String(req.query.e || (req.body as { e?: string } | undefined)?.e || "");
      const t = String(req.query.t || (req.body as { t?: string } | undefined)?.t || "");
      const email = decodeEmail(e);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      if (!email || !verifySignedToken(email, t)) {
        return res.status(400).send("<p style=\"font-family:Georgia,serif;text-align:center;margin-top:80px\">This unsubscribe link is invalid. Reply to any Build to Last email and we'll remove you by hand.</p>");
      }
      const { BTL_SLUG: slug } = await import("./btl-emails");
      await storage.unsubscribeBtlEmail(slug, email);
      res.send("<p style=\"font-family:Georgia,serif;text-align:center;margin-top:80px\">Done — no more Build to Last emails. If this was a mistake, just reply to any earlier email.</p>");
    } catch (err) {
      console.error("[btl/unsubscribe] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: RSVP list + category assignment (category powers Touch-6 counts).
  app.get("/api/admin/btl/rsvps", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const { BTL_SLUG: slug } = await import("./btl-emails");
      const rows = await storage.listBtlRsvps(slug);
      res.json(rows);
    } catch (err) {
      console.error("[btl/admin rsvps] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/btl/rsvps/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
      const { adminCategory } = req.body as { adminCategory?: string | null };
      const allowed = ["venue_owner", "planner", "dj", "influencer", "institutional", "other", null];
      if (adminCategory !== undefined && !allowed.includes(adminCategory as string | null)) {
        return res.status(400).json({ message: "Invalid category" });
      }
      const updated = await storage.updateBtlRsvp(id, { adminCategory: adminCategory ?? null });
      if (!updated) return res.status(404).json({ message: "RSVP not found" });
      res.json(updated);
    } catch (err) {
      console.error("[btl/admin rsvp patch] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: check-in toggle (day-of). followup_48h only goes to checked-in.
  app.patch("/api/admin/btl/rsvps/:id/checkin", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
      const { checkedIn } = req.body as { checkedIn?: boolean };
      const updated = await storage.updateBtlRsvp(id, { checkedInAt: checkedIn === false ? null : new Date() });
      if (!updated) return res.status(404).json({ message: "RSVP not found" });
      res.json(updated);
    } catch (err) {
      console.error("[btl/checkin] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: invite list
  app.get("/api/admin/btl/invitees", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const { BTL_SLUG: slug } = await import("./btl-emails");
      res.json(await storage.listBtlInvitees(slug));
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Import rows (from CSV parsed client-side, or a single manual add).
  app.post("/api/admin/btl/invitees/import", requireAuth(), async (req: Request, res: Response) => {
    try {
      const rows = (req.body as { rows?: unknown[] })?.rows;
      if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ message: "rows[] required" });
      if (rows.length > 1000) return res.status(400).json({ message: "Max 1000 rows per import" });
      const cleaned = rows
        .map((r) => r as Record<string, unknown>)
        .map((r) => ({
          name: String(r.name ?? "").trim(),
          email: String(r.email ?? "").trim().toLowerCase(),
          instagramHandle: String(r.instagramHandle ?? r.instagram ?? "").trim() || null,
          category: String(r.category ?? "").trim() || null,
          priorityTier: Number(r.priorityTier ?? r.tier ?? 2) === 1 ? 1 : 2,
        }))
        .filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email));
      const { BTL_SLUG: slug } = await import("./btl-emails");
      const result = await storage.upsertBtlInvitees(slug, cleaned);
      res.json({ ...result, invalid: rows.length - cleaned.length });
    } catch (err) {
      console.error("[btl/invitees import] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/btl/invitees/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
      const { rsvpStatus, notes, priorityTier, category, name, email, interests } = req.body as { rsvpStatus?: string; notes?: string; priorityTier?: number; category?: string; name?: string; email?: string; interests?: string[] };
      const patch: Record<string, unknown> = {};
      if (name !== undefined) {
        const v = String(name).trim();
        if (!v) return res.status(400).json({ message: "Name can't be empty" });
        patch.name = v.slice(0, 200);
      }
      if (email !== undefined) {
        const v = String(email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return res.status(400).json({ message: "Enter a valid email" });
        patch.email = v;
      }
      if (interests !== undefined) {
        const { BTL_INTEREST_KEYS } = await import("@shared/schema");
        // Canonical keys pass through; free-text entries (the RSVP form's
        // "Other: …") are kept too, sanitized and capped.
        const clean = (Array.isArray(interests) ? interests : [])
          .map((k) => String(k).trim().slice(0, 220))
          .filter((k, idx, arr) => k.length > 0 && arr.indexOf(k) === idx)
          .filter((k) => (BTL_INTEREST_KEYS as readonly string[]).includes(k) || !/[<>]/.test(k))
          .slice(0, 20);
        patch.interests = JSON.stringify(clean);
      }
      if (rsvpStatus !== undefined) {
        if (!["pending", "confirmed", "declined"].includes(rsvpStatus)) return res.status(400).json({ message: "Invalid rsvpStatus" });
        patch.rsvpStatus = rsvpStatus;
      }
      if (notes !== undefined) patch.notes = String(notes).slice(0, 2000) || null;
      if (priorityTier !== undefined) patch.priorityTier = Number(priorityTier) === 1 ? 1 : 2;
      if (category !== undefined) patch.category = String(category).trim() || null;
      const updated = await storage.updateBtlInvitee(id, patch);
      if (!updated) return res.status(404).json({ message: "Invitee not found" });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: bulk delete invitees (multi-select in the Invites view).
  app.post("/api/admin/btl/invitees/bulk-delete", requireAuth(), async (req: Request, res: Response) => {
    try {
      const ids = ((req.body as { ids?: unknown[] })?.ids ?? []).map(Number).filter(Number.isFinite);
      if (ids.length === 0) return res.status(400).json({ message: "ids[] required" });
      const deleted = await storage.deleteBtlInvitees(ids);
      res.json({ deleted });
    } catch (err) {
      console.error("[btl/invitees bulk-delete] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: resend the initial invite to ONE invitee, bypassing the
  // no-duplicate gate — built for test inboxes.
  app.post("/api/admin/btl/invitees/:id/resend", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
      const { BTL_SLUG: slug } = await import("./btl-emails");
      const { getBtlTemplateTexts, renderBtlFromTexts, buildBtlRenderCtx } = await import("./btl-cadence");
      const { deliverBtlEmail } = await import("./btl-mailer");
      const invitees = await storage.listBtlInvitees(slug);
      const invitee = invitees.find((i) => i.id === id);
      if (!invitee) return res.status(404).json({ message: "Invitee not found" });
      const texts = await getBtlTemplateTexts("initial_invite");
      if (!texts) return res.status(500).json({ message: "initial_invite template missing" });
      const ctx = await buildBtlRenderCtx();
      const tpl = renderBtlFromTexts(texts, { name: invitee.name, email: invitee.email }, ctx);
      const errorOut: { message?: string } = {};
      const outcome = await deliverBtlEmail({ email: invitee.email, inviteeId: invitee.id }, "initial_invite", tpl, { force: true, errorOut });
      if (outcome === "sent" && !invitee.initialInviteSentAt) {
        await storage.updateBtlInvitee(invitee.id, { initialInviteSentAt: new Date() });
      }
      res.json({ outcome, to: invitee.email, ...(errorOut.message ? { error: errorOut.message } : {}) });
    } catch (err) {
      console.error("[btl/invitee resend] error:", err);
      const detail = err instanceof Error ? err.message.slice(0, 200) : "unknown";
      res.status(500).json({ message: `Resend failed: ${detail}` });
    }
  });

  // Admin: bulk sends. Initial invites → anyone not yet sent; second wave →
  // pending invitees who got the first one and never RSVP'd. Both stamp the
  // per-row *SentAt so re-clicks never re-send (plus the send-log dedup).
  app.post("/api/admin/btl/invites/send-initial", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { BTL_SLUG: slug } = await import("./btl-emails");
      const { getBtlTemplateTexts, renderBtlFromTexts, buildBtlRenderCtx } = await import("./btl-cadence");
      const { deliverBtlEmail, btlSendPause } = await import("./btl-mailer");
      const texts = await getBtlTemplateTexts("initial_invite");
      if (!texts) return res.status(500).json({ message: "initial_invite template missing" });
      const ctx = await buildBtlRenderCtx();
      const invitees = await storage.listBtlInvitees(slug);
      // Optional ids[] narrows the send to the admin's current selection;
      // without it, everyone who hasn't gotten the invite yet is targeted.
      const rawIds = (req.body as { ids?: unknown[] })?.ids;
      const onlyIds = Array.isArray(rawIds) ? new Set(rawIds.map(Number).filter(Number.isFinite)) : null;
      const targets = invitees.filter((i) =>
        !i.initialInviteSentAt && !i.unsubscribed && i.rsvpStatus !== "declined" &&
        (!onlyIds || onlyIds.has(i.id)));
      // Selected rows that already got the invite are reported as skipped —
      // the per-row Resend button is the deliberate way to send again.
      let sent = 0, failed = 0;
      let skipped = onlyIds ? invitees.filter((i) => onlyIds.has(i.id) && !!i.initialInviteSentAt).length : 0;
      for (const i of targets) {
        const tpl = renderBtlFromTexts(texts, { name: i.name, email: i.email }, ctx);
        const outcome = await deliverBtlEmail({ email: i.email, inviteeId: i.id }, "initial_invite", tpl);
        if (outcome === "sent") {
          sent++;
          await storage.updateBtlInvitee(i.id, { initialInviteSentAt: new Date() });
          await btlSendPause();
        } else if (outcome === "skipped") {
          skipped++;
          await storage.updateBtlInvitee(i.id, { initialInviteSentAt: new Date() });
        } else failed++;
      }
      res.json({ sent, skipped, failed, total: targets.length });
    } catch (err) {
      console.error("[btl/send-initial] error:", err);
      const detail = err instanceof Error ? err.message.slice(0, 200) : "unknown";
      res.status(500).json({ message: `Send failed: ${detail}` });
    }
  });

  app.post("/api/admin/btl/invites/send-second-wave", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const { sendBtlTemplate } = await import("./btl-cadence");
      const result = await sendBtlTemplate("touch_5");
      if (result.blocked) return res.status(400).json({ message: result.blocked });
      // Stamp secondWaveSentAt on everyone the send reached.
      const { BTL_SLUG: slug } = await import("./btl-emails");
      const invitees = await storage.listBtlInvitees(slug);
      for (const i of invitees) {
        if (!i.secondWaveSentAt && (await storage.hasBtlEmailSend(slug, i.email, "touch_5"))) {
          await storage.updateBtlInvitee(i.id, { secondWaveSentAt: new Date() });
        }
      }
      res.json(result);
    } catch (err) {
      console.error("[btl/send-second-wave] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Public: the 1×1 open-tracking pixel inside BTL emails. A valid signed
  // e/t pair stamps emailOpenedAt (first open only) on the matching
  // invitee; always answers with the gif so broken tokens stay invisible.
  app.get("/api/build-to-last/open", async (req: Request, res: Response) => {
    const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    try {
      const email = decodeEmail(String(req.query.e || ""));
      if (email && verifySignedToken(email, String(req.query.t || ""))) {
        const { BTL_SLUG: slug } = await import("./btl-emails");
        const invitees = await storage.listBtlInvitees(slug);
        const match = invitees.find((i) => i.email === email.toLowerCase().trim());
        if (match && !match.emailOpenedAt) {
          await storage.updateBtlInvitee(match.id, { emailOpenedAt: new Date() });
        }
      }
    } catch { /* never block the pixel */ }
    res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate", "Content-Length": String(GIF.length) });
    res.end(GIF);
  });

  // Public: a personalized invite link was opened. The page fires this
  // beacon with the link's signed e/t pair; a valid signature stamps
  // linkClickedAt (first open only) on the matching invitee, so the admin
  // sees exactly who clicked. Forged tokens are ignored.
  app.post("/api/build-to-last/link-open", formLimiter, async (req: Request, res: Response) => {
    try {
      const { e, t } = (req.body ?? {}) as { e?: string; t?: string };
      const email = decodeEmail(String(e || ""));
      if (!email || !verifySignedToken(email, String(t || ""))) return res.status(204).end();
      const { BTL_SLUG: slug } = await import("./btl-emails");
      const invitees = await storage.listBtlInvitees(slug);
      const match = invitees.find((i) => i.email === email.toLowerCase().trim());
      if (match && !match.linkClickedAt) {
        await storage.updateBtlInvitee(match.id, { linkClickedAt: new Date() });
      }
      res.status(204).end();
    } catch {
      res.status(204).end();
    }
  });

  // ── Build to Last page copy ──────────────────────────────────────────
  // Every prose block on /build-to-last is editable from the admin's Page
  // view. Overrides live in app_settings as btl.page.<key>; a blank
  // override falls back to the default copy in shared/btl-page.ts.

  async function loadBtlPageContent(): Promise<Record<string, string>> {
    const { BTL_PAGE_FIELDS, BTL_PAGE_DEFAULTS } = await import("@shared/btl-page");
    const out: Record<string, string> = {};
    for (const f of BTL_PAGE_FIELDS) {
      const override = await storage.getSetting(`btl.page.${f.key}`);
      out[f.key] = override && override.trim() ? override : BTL_PAGE_DEFAULTS[f.key];
    }
    return out;
  }

  app.get("/api/build-to-last/content", async (_req: Request, res: Response) => {
    try {
      res.json(await loadBtlPageContent());
    } catch (err) {
      console.error("[btl/page content] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/btl/page", requireAuth(), async (_req: Request, res: Response) => {
    try {
      res.json(await loadBtlPageContent());
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/admin/btl/page", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { BTL_PAGE_FIELDS, BTL_PAGE_DEFAULTS } = await import("@shared/btl-page");
      const body = (req.body ?? {}) as Record<string, unknown>;
      for (const f of BTL_PAGE_FIELDS) {
        if (body[f.key] === undefined) continue;
        const value = String(body[f.key]).slice(0, 5000);
        // Saving text identical to the default clears the override, so
        // future default-copy updates flow through automatically.
        await storage.setSetting(`btl.page.${f.key}`, value.trim() === BTL_PAGE_DEFAULTS[f.key].trim() ? "" : value);
      }
      res.json(await loadBtlPageContent());
    } catch (err) {
      console.error("[btl/page save] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: cadence status board — every template with audience size, sends
  // so far, schedule, and any blocker.
  app.get("/api/admin/btl/cadence", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const { BTL_CADENCE, btlSendAtFor, buildBtlRenderCtx } = await import("./btl-cadence");
      const { BTL_SLUG: slug } = await import("./btl-emails");
      const sends = await storage.listBtlEmailSends(slug);
      const rsvps = await storage.listBtlRsvps(slug);
      const invitees = await storage.listBtlInvitees(slug);
      const ctx = await buildBtlRenderCtx();
      const activeRsvps = rsvps.filter((r) => !r.unsubscribed).length;
      const checkedIn = rsvps.filter((r) => !r.unsubscribed && r.checkedInAt).length;
      const rsvpEmails = new Set(rsvps.map((r) => r.email));
      const secondWave = invitees.filter((i) => !i.unsubscribed && i.rsvpStatus === "pending" && i.initialInviteSentAt && !rsvpEmails.has(i.email)).length;
      const uninvited = invitees.filter((i) => !i.initialInviteSentAt && !i.unsubscribed && i.rsvpStatus !== "declined").length;
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const nudgeable = invitees.filter((i) => !i.unsubscribed && i.rsvpStatus === "pending" && !rsvpEmails.has(i.email) && !!i.initialInviteSentAt && new Date(i.initialInviteSentAt).getTime() <= dayAgo).length;
      const out = [] as unknown[];
      for (const entry of BTL_CADENCE) {
        const sentCount = sends.filter((x) => x.templateKey === entry.key && x.status === "sent").reduce((a, x) => a + x.count, 0);
        const failedCount = sends.filter((x) => x.templateKey === entry.key && x.status === "failed").reduce((a, x) => a + x.count, 0);
        const audienceCount = entry.audience === "rsvps" ? activeRsvps
          : entry.audience === "checked_in" ? checkedIn
          : entry.audience === "invitees_second_wave" ? secondWave
          : entry.audience === "invitees_all" ? invitees.filter((i) => !i.unsubscribed && i.rsvpStatus !== "declined").length
          : entry.audience === "invitees_nudge" ? nudgeable
          : uninvited;
        const missing = (entry.requiresSettings ?? []).filter((k) => {
          const v = (ctx.settings as unknown as Record<string, unknown>)[k];
          return Array.isArray(v) ? v.length === 0 : !String(v ?? "").trim();
        });
        out.push({
          key: entry.key,
          label: entry.label,
          audience: entry.audience,
          audienceCount,
          sentCount,
          failedCount,
          sendAtEt: await btlSendAtFor(entry.key),
          blocked: missing.length > 0 ? `needs ${missing.join(", ")}` : null,
        });
      }
      res.json(out);
    } catch (err) {
      console.error("[btl/cadence] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/btl/cadence/:key/preview", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { renderBtlTemplate, buildBtlRenderCtx } = await import("./btl-cadence");
      const { btlShell } = await import("./btl-emails");
      const { btlUnsubscribeUrl } = await import("./btl-mailer");
      const ctx = await buildBtlRenderCtx();
      const tpl = await renderBtlTemplate(String(req.params.key), { name: "Jordan", email: "preview@example.com", contactSheetOptin: true }, ctx);
      if (!tpl) return res.status(404).json({ message: "Unknown template" });
      // Real sends embed the logo as a CID attachment; the browser preview
      // can't resolve cid:, so point it at the served file instead.
      const html = btlShell(tpl.body, btlUnsubscribeUrl("preview@example.com"))
        .replace("cid:cge-logo", `${req.protocol}://${req.get("host")}/cge-logo.png`);
      res.json({ subject: tpl.subject, html });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/btl/cadence/:key/send-now", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { sendBtlTemplate } = await import("./btl-cadence");
      const result = await sendBtlTemplate(String(req.params.key));
      if (result.blocked) return res.status(400).json({ message: result.blocked });
      res.json(result);
    } catch (err) {
      console.error("[btl/send-now] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: send a [TEST] copy of any cadence template to an inbox (default:
  // the Gmail account itself). No dedup, no send-log row — and the raw SMTP
  // error comes back so a broken email setup is visible in the UI.
  app.post("/api/admin/btl/cadence/:key/test", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { getBtlTemplateTexts, renderBtlFromTexts, buildBtlRenderCtx } = await import("./btl-cadence");
      const { sendBtlTestEmail } = await import("./btl-mailer");
      const key = String(req.params.key);
      const texts = await getBtlTemplateTexts(key);
      if (!texts) return res.status(404).json({ message: `Unknown template "${key}"` });
      const raw = String((req.body as { email?: string })?.email || "").trim().toLowerCase();
      const to = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : "centralgroupevents@gmail.com";
      const ctx = await buildBtlRenderCtx();
      const tpl = renderBtlFromTexts(texts, { name: "Anthony", email: to }, ctx);
      const result = await sendBtlTestEmail(to, tpl);
      if (!result.ok) return res.status(502).json({ message: result.error, to });
      res.json({ sent: true, to });
    } catch (err) {
      console.error("[btl/cadence test] error:", err);
      const detail = err instanceof Error ? err.message.slice(0, 300) : "unknown";
      res.status(500).json({ message: `Test send failed: ${detail}` });
    }
  });

  // Admin: recent delivery failures with their SMTP errors.
  app.get("/api/admin/btl/email-failures", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const { BTL_SLUG: slug } = await import("./btl-emails");
      res.json(await storage.listBtlEmailFailures(slug, 15));
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: event settings (venue, times, themes, speakers, follow-up URLs,
  // per-template send-date overrides "sendAt.<key>" as ET "YYYY-MM-DDTHH:mm").
  app.get("/api/admin/btl/settings", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const { getBtlSettings } = await import("./btl-mailer");
      const { BTL_CADENCE, btlSendAtFor } = await import("./btl-cadence");
      const settings = await getBtlSettings();
      const sendAt: Record<string, string | null> = {};
      for (const c of BTL_CADENCE) sendAt[c.key] = await btlSendAtFor(c.key);
      res.json({ ...settings, sendAt });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/admin/btl/settings", requireAuth(), async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const stringKeys = ["rsvpUrl", "venueName", "venueAddress", "doorsTime", "programStartTime", "questionThemes", "photoGalleryUrl", "recapVideoUrl", "fieldNotesUrl", "contactSheetUrl"];
      for (const key of stringKeys) {
        if (typeof body[key] === "string") await storage.setSetting(`btl.${key}`, String(body[key]).slice(0, 4000));
      }
      if (Array.isArray(body.speakers)) {
        const speakers = (body.speakers as Record<string, unknown>[])
          .map((sp) => ({
            name: String(sp.name ?? "").trim(),
            credential: String(sp.credential ?? "").trim(),
            topic: String(sp.topic ?? "").trim(),
          }))
          .filter((sp) => sp.name);
        await storage.setSetting("btl.speakers", JSON.stringify(speakers));
      }
      if (body.sendAt && typeof body.sendAt === "object") {
        for (const [key, val] of Object.entries(body.sendAt as Record<string, unknown>)) {
          if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(val)) {
            await storage.setSetting(`btl.sendAt.${key}`, val);
          }
        }
      }
      res.json({ saved: true });
    } catch (err) {
      console.error("[btl/settings] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: editable email templates (Resend-style). Edits are stored as
  // overrides in app_settings; the code defaults stay as the fallback, so
  // "Reset to default" just clears the override. {{placeholders}} are
  // substituted per recipient at send time.
  app.get("/api/admin/btl/templates", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const { BTL_TEMPLATE_DEFS } = await import("./btl-emails");
      const { getBtlTemplateTexts } = await import("./btl-cadence");
      const out = [];
      for (const def of BTL_TEMPLATE_DEFS) {
        const texts = await getBtlTemplateTexts(def.key);
        out.push({
          key: def.key,
          label: def.label,
          placeholders: def.placeholders,
          subject: texts!.subject,
          body: texts!.body,
          customized: texts!.customized,
          defaultSubject: def.subject,
          defaultBody: def.body,
        });
      }
      res.json(out);
    } catch (err) {
      console.error("[btl/templates] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/admin/btl/templates/:key", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { btlTemplateDef } = await import("./btl-emails");
      const key = String(req.params.key);
      const def = btlTemplateDef(key);
      if (!def) return res.status(404).json({ message: "Unknown template" });
      const { subject, body } = (req.body ?? {}) as { subject?: string; body?: string };
      if (typeof subject !== "string" || typeof body !== "string" || !subject.trim() || !body.trim()) {
        return res.status(400).json({ message: "subject and body are both required" });
      }
      // Saving text identical to the default clears the override instead,
      // so future default improvements flow through automatically.
      const sameAsDefault = subject.trim() === def.subject.trim() && body.trim() === def.body.trim();
      await storage.setSetting(`btl.tpl.${key}.subject`, sameAsDefault ? "" : subject.trim().slice(0, 500));
      await storage.setSetting(`btl.tpl.${key}.body`, sameAsDefault ? "" : body.trim().slice(0, 20000));
      res.json({ saved: true, customized: !sameAsDefault });
    } catch (err) {
      console.error("[btl/templates put] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/btl/templates/:key", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { btlTemplateDef } = await import("./btl-emails");
      const key = String(req.params.key);
      if (!btlTemplateDef(key)) return res.status(404).json({ message: "Unknown template" });
      await storage.setSetting(`btl.tpl.${key}.subject`, "");
      await storage.setSetting(`btl.tpl.${key}.body`, "");
      res.json({ reset: true });
    } catch (err) {
      console.error("[btl/templates reset] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Unsubscribe (CAN-SPAM / RFC 8058 one-click) ──────────────────────
  // Every marketing email carries a signed link: ?e=<base64url email>&t=<hmac>.
  // The same URL is used in the List-Unsubscribe header, which mailbox
  // providers POST to for one-click unsubscribe, and by the /unsubscribe
  // page for people who click the footer link.
  app.post("/api/unsubscribe", async (req: Request, res: Response) => {
    try {
      const e = String(req.query.e || (req.body as { e?: string } | undefined)?.e || "");
      const t = String(req.query.t || (req.body as { t?: string } | undefined)?.t || "");
      const email = decodeEmail(e);
      if (!email || !verifyUnsubscribeToken(email, t)) {
        return res.status(400).json({ message: "Invalid or expired unsubscribe link. Email centralgroupevents@gmail.com and we'll remove you manually." });
      }
      await storage.unsubscribeByEmail(email);
      res.json({ message: "You've been unsubscribed. You won't receive any more marketing emails from us." });
    } catch (err) {
      console.error("[unsubscribe] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Some mail clients open the header URL with GET instead of the one-click
  // POST — send them to the confirmation page rather than silently opting
  // out on a prefetchable GET.
  app.get("/api/unsubscribe", (req: Request, res: Response) => {
    const qs = new URLSearchParams({ e: String(req.query.e || ""), t: String(req.query.t || "") });
    res.redirect(`/unsubscribe?${qs.toString()}`);
  });

  // ── Existing booking route ───────────────────────────────────────────
  app.post(api.bookings.create.path, formLimiter, ...bookingValidators, async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: errors.array()[0].msg,
        field: (errors.array()[0] as { msg: string; path?: string }).path,
      });
    }
    try {
      const input = api.bookings.create.input.parse(req.body);
      const booking = await storage.createBooking(input);
      res.status(201).json({ message: "Booking request submitted successfully! We'll be in touch.", referenceId: booking.referenceId });
      // Subscribe the booker to the newsletter only if they ticked the
      // opt-in box on the form (non-blocking, ON CONFLICT DO NOTHING via
      // upsert — never resurrects an unsubscribed email).
      if (req.body.newsletterOptIn === true) {
        storage.upsertSubscriber(
          input.email.toLowerCase().trim(),
          "booking",
          input.contactName || undefined
        ).catch(() => {});
      }
      try {
        const submissionMode = input.mode || "Standard";
        const replyName = input.contactName || input.email;
        await transporter.sendMail({
          from: `"CGE Website" <${process.env.GMAIL_USER}>`,
          to: "centralgroupevents@gmail.com",
          subject: `🎉 New ${submissionMode} Promotion Request — ${input.venueName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 32px; border-radius: 12px;">
              <h1 style="color: #8B2FC9; margin-bottom: 4px;">New ${submissionMode} Promotion Request</h1>
              <p style="color: #999; margin-bottom: 32px;">Submitted via centralgroupevents.com</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999; width: 40%;">Submission Type</td>
                  <td style="padding: 12px 0; color: #fff; font-weight: bold;">${submissionMode}</td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Event Name</td>
                  <td style="padding: 12px 0; color: #fff; font-weight: bold;">${input.eventName || "Not provided"}</td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Venue Name</td>
                  <td style="padding: 12px 0; color: #fff;">${input.venueName}</td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Contact Name</td>
                  <td style="padding: 12px 0; color: #fff;">${input.contactName || "Not provided"}</td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Email</td>
                  <td style="padding: 12px 0; color: #fff;"><a href="mailto:${input.email}" style="color: #8B2FC9;">${input.email}</a></td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Phone</td>
                  <td style="padding: 12px 0; color: #fff;">${input.phone || "Not provided"}</td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Event Date</td>
                  <td style="padding: 12px 0; color: #fff;">${input.eventDate}</td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Event Time</td>
                  <td style="padding: 12px 0; color: #fff;">${input.eventTime || "Not provided"}</td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">City</td>
                  <td style="padding: 12px 0; color: #fff;">${input.city || "Not provided"}</td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Region</td>
                  <td style="padding: 12px 0; color: #fff;">${input.region}</td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Event Type</td>
                  <td style="padding: 12px 0; color: #fff;">${input.eventType}${input.eventTypeOther ? ` — ${input.eventTypeOther}` : ""}</td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Budget Range</td>
                  <td style="padding: 12px 0; color: #fff;">${input.budgetRange || "Not provided"}</td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Instagram</td>
                  <td style="padding: 12px 0; color: #fff;">${input.instagramHandle || "Not provided"}</td>
                </tr>
              </table>
              <div style="margin-top: 32px; padding: 16px; background: #8B2FC9; border-radius: 8px; text-align: center;">
                <a href="mailto:${input.email}" style="color: white; font-weight: bold; font-size: 16px; text-decoration: none;">
                  Reply to ${replyName} →
                </a>
              </div>
              <p style="color: #555; font-size: 12px; margin-top: 24px; text-align: center;">
                Central Group Events • centralgroupevents@gmail.com
              </p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Email notification failed:", emailError);
      }
      // Confirmation email to the submitter
      try {
        const packageLabel = input.mode && input.budgetRange
          ? `${input.mode} — ${input.budgetRange}`
          : input.mode || input.budgetRange || null;
        const eventDisplayType = input.eventType === "Other" && input.eventTypeOther
          ? `${input.eventType} — ${input.eventTypeOther}`
          : input.eventType;
        await transporter.sendMail({
          from: `"Central Group Events" <${process.env.GMAIL_USER}>`,
          to: input.email,
          subject: `Booking Received — Central Group Events`,
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
            <body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
              <div style="max-width:600px;margin:0 auto;background:#111111;border-radius:12px;overflow:hidden;">
                <!-- Header -->
                <div style="background:#0a0a0a;padding:32px;text-align:center;border-bottom:1px solid #222;">
                  <img src="https://centralgroupevents.com/favicon.png" alt="Central Group Events" style="height:64px;width:auto;" />
                </div>
                <!-- Body -->
                <div style="padding:40px 32px;">
                  <h1 style="color:#ffffff;font-size:24px;margin:0 0 16px;">You're all set, ${input.contactName || "there"}!</h1>
                  <p style="color:#cccccc;font-size:15px;line-height:1.6;margin:0 0 32px;">
                    We've received your booking and will confirm within 24 hours. Here's a summary of what you submitted:
                  </p>
                  <!-- Summary Table -->
                  <table style="width:100%;border-collapse:collapse;margin-bottom:32px;">
                    ${packageLabel ? `
                    <tr style="border-bottom:1px solid #222;">
                      <td style="padding:12px 0;color:#999;font-size:14px;width:42%;">Package</td>
                      <td style="padding:12px 0;color:#8B2FC9;font-size:14px;font-weight:bold;">${packageLabel}</td>
                    </tr>` : ""}
                    <tr style="border-bottom:1px solid #222;">
                      <td style="padding:12px 0;color:#999;font-size:14px;">Event Name</td>
                      <td style="padding:12px 0;color:#ffffff;font-size:14px;font-weight:bold;">${input.eventName || "Not provided"}</td>
                    </tr>
                    <tr style="border-bottom:1px solid #222;">
                      <td style="padding:12px 0;color:#999;font-size:14px;">Event Type</td>
                      <td style="padding:12px 0;color:#ffffff;font-size:14px;">${eventDisplayType}</td>
                    </tr>
                    <tr style="border-bottom:1px solid #222;">
                      <td style="padding:12px 0;color:#999;font-size:14px;">Event Date</td>
                      <td style="padding:12px 0;color:#ffffff;font-size:14px;">${input.eventDate}${input.eventTime ? ` at ${input.eventTime}` : ""}</td>
                    </tr>
                    <tr style="border-bottom:1px solid #222;">
                      <td style="padding:12px 0;color:#999;font-size:14px;">Venue</td>
                      <td style="padding:12px 0;color:#ffffff;font-size:14px;">${[input.venueName, input.city].filter(Boolean).join(", ")}</td>
                    </tr>
                    <tr style="border-bottom:1px solid #222;">
                      <td style="padding:12px 0;color:#999;font-size:14px;">Region</td>
                      <td style="padding:12px 0;color:#ffffff;font-size:14px;">${input.region}</td>
                    </tr>
                    ${input.instagramHandle ? `
                    <tr style="border-bottom:1px solid #222;">
                      <td style="padding:12px 0;color:#999;font-size:14px;">Instagram</td>
                      <td style="padding:12px 0;color:#ffffff;font-size:14px;">@${input.instagramHandle}</td>
                    </tr>` : ""}
                  </table>

                  <!-- CashApp Payment Instructions -->
                  <div style="background:#001a04;border:1px solid #00D63233;border-radius:10px;padding:24px;margin-bottom:32px;">
                    <table style="width:100%;border-collapse:collapse;">
                      <tr>
                        <td style="vertical-align:top;width:48px;padding-right:16px;">
                          <div style="width:44px;height:44px;background:#00D63215;border:1px solid #00D63240;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;line-height:44px;">
                            <span style="font-size:20px;">💸</span>
                          </div>
                        </td>
                        <td style="vertical-align:top;">
                          <p style="color:#ffffff;font-size:15px;font-weight:bold;margin:0 0 8px;">Complete your payment on CashApp</p>
                          <p style="color:#aaaaaa;font-size:14px;line-height:1.6;margin:0 0 16px;">
                            Your booking is saved, but your promotion won't be scheduled until payment is received.
                            Send ${input.budgetRange ? `<strong style="color:#ffffff;">${input.budgetRange}</strong>` : "your package amount"} to
                            <strong style="color:#00D632;">$centralgroupevents</strong> on CashApp
                            and include <strong style="color:#ffffff;">${input.eventName || "your event name"}</strong> in the note.
                          </p>
                          <a href="https://cash.app/$centralgroupevents"
                             style="display:inline-block;background:#00D632;color:#000000;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 24px;border-radius:8px;">
                            Pay via CashApp →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- What Happens Next -->
                  <h2 style="color:#ffffff;font-size:16px;font-weight:bold;margin:0 0 16px;text-transform:uppercase;letter-spacing:1px;">What Happens Next</h2>
                  <table style="width:100%;border-collapse:collapse;margin-bottom:32px;">
                    <tr>
                      <td style="vertical-align:top;width:40px;padding-right:12px;padding-bottom:20px;">
                        <div style="width:36px;height:36px;background:#8B2FC915;border:1px solid #8B2FC940;border-radius:50%;text-align:center;line-height:36px;font-size:12px;font-weight:bold;color:#8B2FC9;">01</div>
                      </td>
                      <td style="vertical-align:top;padding-bottom:20px;">
                        <p style="color:#ffffff;font-size:14px;font-weight:bold;margin:0 0 4px;">Payment Confirmation</p>
                        <p style="color:#888;font-size:13px;margin:0;">We'll verify your CashApp payment and send you a confirmation within 24 hours.</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="vertical-align:top;width:40px;padding-right:12px;padding-bottom:20px;">
                        <div style="width:36px;height:36px;background:#8B2FC915;border:1px solid #8B2FC940;border-radius:50%;text-align:center;line-height:36px;font-size:12px;font-weight:bold;color:#8B2FC9;">02</div>
                      </td>
                      <td style="vertical-align:top;padding-bottom:20px;">
                        <p style="color:#ffffff;font-size:14px;font-weight:bold;margin:0 0 4px;">Content Review</p>
                        <p style="color:#888;font-size:13px;margin:0;">Our team reviews your event details and begins crafting your promotional content.</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="vertical-align:top;width:40px;padding-right:12px;">
                        <div style="width:36px;height:36px;background:#8B2FC915;border:1px solid #8B2FC940;border-radius:50%;text-align:center;line-height:36px;font-size:12px;font-weight:bold;color:#8B2FC9;">03</div>
                      </td>
                      <td style="vertical-align:top;">
                        <p style="color:#ffffff;font-size:14px;font-weight:bold;margin:0 0 4px;">Your Event Goes Live</p>
                        <p style="color:#888;font-size:13px;margin:0;">We post across our platforms on your scheduled date. Sit back and watch the buzz build.</p>
                      </td>
                    </tr>
                  </table>

                  <!-- Social Buttons -->
                  <p style="color:#aaaaaa;font-size:14px;margin:0 0 16px;">Stay connected with us for the latest NJ events:</p>
                  <table style="width:100%;margin-bottom:40px;">
                    <tr>
                      <td style="text-align:center;padding:0 6px;">
                        <a href="https://www.instagram.com/centralgroupevents/" target="_blank"
                           style="display:inline-block;background:#E1306C;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:bold;">
                          Instagram
                        </a>
                      </td>
                      <td style="text-align:center;padding:0 6px;">
                        <a href="https://www.tiktok.com/@centralgroupevents" target="_blank"
                           style="display:inline-block;background:#010101;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:bold;border:1px solid #333;">
                          TikTok
                        </a>
                      </td>
                      <td style="text-align:center;padding:0 6px;">
                        <a href="https://www.facebook.com/p/Central-Group-Events-61551661541206/" target="_blank"
                           style="display:inline-block;background:#1877F2;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:bold;">
                          Facebook
                        </a>
                      </td>
                    </tr>
                  </table>
                </div>
                <!-- Footer -->
                <div style="background:#0a0a0a;padding:24px 32px;text-align:center;border-top:1px solid #222;">
                  <p style="color:#555;font-size:12px;margin:0;">
                    © Central Group Events | centralgroupevents@gmail.com | centralgroupevents.com
                  </p>
                </div>
              </div>
            </body>
            </html>
          `,
        });
      } catch (confirmEmailError) {
        console.error("Confirmation email to submitter failed:", confirmEmailError);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/bookings", requireAuth(), async (req: Request, res: Response) => {
    try {
      const bookings = await storage.getBookings();
      res.status(200).json(bookings);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Integration endpoints for CGE Tools ───────────────────────────────
  // Authed by a shared bearer token (CGE_INTEGRATION_TOKEN) — NOT the admin JWT.
  const requireIntegrationToken = (req: Request, res: Response, next: NextFunction) => {
    const expected = (process.env.CGE_INTEGRATION_TOKEN || "").trim();
    if (!expected) {
      return res.status(503).json({ error: "not_configured", message: "CGE_INTEGRATION_TOKEN is not set on the website." });
    }
    const auth = req.headers.authorization || "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: "unauthorized" });
    }
    next();
  };

  // Pull-based: CGE Tools fetches promoter bookings. Newest first, max 200.
  // Optional ?since=<ISO timestamp> filters by created_at.
  app.get("/api/integrations/bookings", publicReadLimiter, requireIntegrationToken, async (req: Request, res: Response) => {
    try {
      let bookings = await storage.getBookings();

      const sinceRaw = String(req.query.since || "").trim();
      if (sinceRaw) {
        const since = new Date(sinceRaw);
        if (isNaN(since.getTime())) {
          return res.status(400).json({ error: "bad_request", message: "Invalid 'since' timestamp — use ISO 8601, e.g. 2026-07-01T00:00:00Z" });
        }
        bookings = bookings.filter(bk => bk.createdAt && new Date(bk.createdAt) >= since);
      }

      // Newest first, capped at 200 rows.
      bookings = bookings
        .slice()
        .sort((x, y) => new Date(y.createdAt ?? 0).getTime() - new Date(x.createdAt ?? 0).getTime())
        .slice(0, 200);

      // snake_case keys to match the schema CGE Tools expects.
      res.json({
        bookings: bookings.map(bk => ({
          id: bk.id,
          reference_id: bk.referenceId,
          event_name: bk.eventName,
          venue_name: bk.venueName,
          contact_name: bk.contactName,
          phone: bk.phone,
          email: bk.email,
          event_date: bk.eventDate,
          event_time: bk.eventTime,
          city: bk.city,
          region: bk.region,
          event_type: bk.eventType,
          event_type_other: bk.eventTypeOther,
          budget_range: bk.budgetRange,
          instagram_handle: bk.instagramHandle,
          ready_to_move_forward: bk.readyToMoveForward,
          status: bk.status,
          created_at: bk.createdAt,
        })),
      });
    } catch (err) {
      console.error("[integrations/bookings] error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // Publish a whole curated guide (page + listings) from CGE Tools in one call.
  // Creates the page if the slug is new, else updates it, then REPLACES the
  // integration-sourced listings with the provided array (public-form and
  // admin-imported submissions on the same page are left untouched).
  app.post("/api/integrations/pages/upsert", requireIntegrationToken, async (req: Request, res: Response) => {
    try {
      const INTEGRATION_SOURCE = "cge-tools";
      const slug = String(req.body?.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
      const title = String(req.body?.title || "").trim();
      if (!slug || !title) {
        return res.status(400).json({ error: "bad_request", message: "slug and title are required" });
      }
      const listings = Array.isArray(req.body?.listings) ? req.body.listings : [];

      const page = await storage.upsertPage(slug, {
        title,
        editorContent: String(req.body?.body_content || ""),
        ...(req.body?.hero_image_url ? { heroImageUrl: String(req.body.hero_image_url) } : {}),
        published: Boolean(req.body?.published),
        // Guide pages headline the event name, not the venue.
        listingHeaderField: "eventName",
      });

      // Replace this integration's listings.
      await storage.deleteLandingPageSubmissionsBySource(page.id, INTEGRATION_SOURCE);
      let inserted = 0;
      const errors: Array<{ index: number; message: string }> = [];
      for (let i = 0; i < listings.length; i++) {
        const l = listings[i];
        try {
          const name = String(l?.name || "").trim();
          const date = String(l?.date || "").trim();
          if (!name || !date) {
            errors.push({ index: i, message: "name and date are required" });
            continue;
          }
          await storage.createLandingPageSubmissionRaw({
            pageId: page.id,
            submitterEmail: "integration@cge-tools",
            eventDate: date,
            eventName: name,
            venueName: String(l?.event_type || "").trim() || name,
            town: String(l?.city || "").trim() || "NJ",
            region: l?.region ? String(l.region) : null,
            instagramHandle: l?.instagram_handle ? String(l.instagram_handle) : null,
            learnMoreUrl: l?.learn_more_url ? String(l.learn_more_url) : null,
            status: "approved",
            source: INTEGRATION_SOURCE,
            reviewedAt: new Date(),
          });
          inserted++;
        } catch (rowErr) {
          errors.push({ index: i, message: String((rowErr as Error)?.message || rowErr) });
        }
      }

      res.status(200).json(errors.length
        ? { ok: true, slug: page.slug, listings: inserted, errors }
        : { ok: true, slug: page.slug, listings: inserted });
    } catch (err) {
      console.error("[integrations/pages/upsert] error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // Upsert events pushed from CGE Tools. Matches existing rows by source_id.
  app.post("/api/integrations/events/upsert", requireIntegrationToken, async (req: Request, res: Response) => {
    try {
      const incoming = Array.isArray(req.body?.events) ? req.body.events : null;
      if (!incoming) {
        return res.status(400).json({ error: "bad_request", message: "Body must be { events: [...] }" });
      }

      const PLACEHOLDER_IMAGE = "https://res.cloudinary.com/demo/image/upload/v1/samples/placeholder-event.jpg";
      let upserted = 0;
      const errors: Array<{ index: number; message: string }> = [];

      for (let i = 0; i < incoming.length; i++) {
        const e = incoming[i];
        try {
          const sourceId = String(e?.source_id || "").trim();
          const title = String(e?.title || "").trim();
          const date = String(e?.date || "").trim();
          const region = String(e?.region || "").trim();
          if (!sourceId || !title || !date || !region) {
            errors.push({ index: i, message: "source_id, title, date, and region are required" });
            continue;
          }
          await storage.upsertIntegrationEvent({
            sourceId,
            title,
            date,
            region,
            description: String(e?.description || "").trim() || title,
            imageUrl: String(e?.image_url || "").trim() || PLACEHOLDER_IMAGE,
            eventTime: e?.event_time ?? null,
            city: e?.city ?? null,
            venue: e?.venue ?? null,
            ticketLink: e?.ticket_link ?? null,
            genre: e?.genre ?? null,
            instagramHandle: e?.instagram_handle ?? null,
            isFeatured: Boolean(e?.is_featured),
          });
          upserted++;
        } catch (rowErr) {
          errors.push({ index: i, message: String((rowErr as Error)?.message || rowErr) });
        }
      }

      res.status(200).json(errors.length ? { upserted, errors } : { upserted });
    } catch (err) {
      console.error("[integrations/events/upsert] error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  app.get("/api/admin/bookings", requireAuth(), async (req: Request, res: Response) => {
    try {
      const bookings = await storage.getBookings();
      res.status(200).json(bookings);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/bookings/:id/status", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid booking id" });
      const { status } = req.body;
      const validStatuses = ["New", "Contacted", "Paid", "Completed", "Cancelled"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const booking = await storage.updateBookingStatus(id, status);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      res.json(booking);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/bookings/:id/status", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid booking id" });
      const { status } = req.body;
      const validStatuses = ["New", "Contacted", "Paid", "Completed", "Cancelled"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const booking = await storage.updateBookingStatus(id, status);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      res.json(booking);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/bookings/:id/notes", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid booking id" });
      const { adminNotes } = req.body;
      if (typeof adminNotes !== "string") {
        return res.status(400).json({ message: "adminNotes must be a string" });
      }
      const booking = await storage.updateBookingNotes(id, adminNotes);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      res.json(booking);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/bookings/batch", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || !ids.every((id) => typeof id === "number")) {
        return res.status(400).json({ message: "ids must be an array of numbers" });
      }
      await storage.batchDeleteBookings(ids);
      res.json({ message: "Deleted" });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/bookings/batch/status", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { ids, status } = req.body;
      if (!Array.isArray(ids) || !ids.every((id) => typeof id === "number")) {
        return res.status(400).json({ message: "ids must be an array of numbers" });
      }
      if (typeof status !== "string" || !status.trim()) {
        return res.status(400).json({ message: "status is required" });
      }
      const count = await storage.bulkUpdateBookingStatus(ids, status);
      res.json({ updated: count });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // AI-powered event extraction from a flyer / screenshot / poster image.
  // Public — used by every submission form on the site (page submissions,
  // /book, watch parties). Rate-limited via formLimiter to prevent abuse.
  // Uses Gemini 2.5 Flash Lite for cost efficiency (~$0.019 per image).
  //
  // Model is called with a strict JSON schema so the response is always
  // valid to parse. Any field the model can't determine comes back null,
  // never invented — the user reviews + edits before submitting.
  app.post("/api/ai/extract-event", formLimiter, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No image provided" });
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ message: "AI extraction not configured (GEMINI_API_KEY missing on server)" });
      }
      const { GoogleGenerativeAI, SchemaType } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              eventName:        { type: SchemaType.STRING, nullable: true, description: "Full event name / title as printed on the flyer" },
              eventDate:        { type: SchemaType.STRING, nullable: true, description: "Date in YYYY-MM-DD. If year isn't shown, infer to the next upcoming year." },
              eventTime:        { type: SchemaType.STRING, nullable: true, description: "Start time in human format, e.g. '9:00 PM' or '10 PM - 2 AM'" },
              venue:            { type: SchemaType.STRING, nullable: true, description: "Venue name (e.g. 'The Sports Bar')" },
              city:             { type: SchemaType.STRING, nullable: true, description: "City name only (e.g. 'Newark')" },
              instagramHandle:  { type: SchemaType.STRING, nullable: true, description: "Instagram handle WITHOUT the @, or the promoter/venue account visible on the flyer" },
              ticketUrl:        { type: SchemaType.STRING, nullable: true, description: "Full ticket / RSVP URL if visible" },
              description:      { type: SchemaType.STRING, nullable: true, description: "1-2 sentence pitch summarizing what the event is" },
            },
          },
        },
      });
      const prompt = `You are extracting event details from a flyer, screenshot, or poster image for a New Jersey event promotion site.

Return every field you can confidently determine. Set null for any field the image doesn't show — don't invent details. For the date, output YYYY-MM-DD; if only "June 19" is shown, use the next upcoming year. For time, keep human formatting like "9:00 PM" or "10 PM - 2 AM". For the Instagram handle, strip the @ sign.`;

      const imagePart = {
        inlineData: {
          data: req.file.buffer.toString("base64"),
          mimeType: req.file.mimetype,
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const text = result.response.text();
      let parsed: Record<string, string | null>;
      try {
        parsed = JSON.parse(text);
      } catch {
        return res.status(502).json({ message: "AI returned an unparseable response — try a clearer image" });
      }
      res.json({ extracted: parsed });
    } catch (err) {
      console.error("[ai/extract-event] error:", err);
      const msg = err instanceof Error ? err.message.slice(0, 500) : "Extraction failed";
      res.status(500).json({ message: msg });
    }
  });

  app.post("/api/upload", requireAuth(), upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file provided" });
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "cge", resource_type: "image" },
          (error, result) => {
            if (error || !result) reject(error ?? new Error("Upload failed"));
            else resolve(result as { secure_url: string });
          }
        );
        stream.end(req.file!.buffer);
      });
      res.json({ url: result.secure_url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      res.status(500).json({ message: msg });
    }
  });

  // ── Existing event routes ────────────────────────────────────────────
  // Public and admin both see everything the admin has uploaded. Admins manage
  // visibility by deleting events they no longer want shown — the server does
  // not apply a date filter. Keep no-cache so refetches reflect new uploads
  // and deletions immediately.
  app.get(api.events.list.path, async (req, res) => {
    try {
      const region = req.query.region as string;
      const eventList = await storage.getEvents(region, true);
      res.setHeader("Cache-Control", "no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.status(200).json(eventList);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/events", async (req: Request, res: Response) => {
    try {
      const { insertEventSchema } = await import("@shared/schema");
      const input = insertEventSchema.parse(req.body);
      if (input.imageUrl) input.imageUrl = await rehostInstagramImage(input.imageUrl);
      const event = await storage.createEvent(input);
      res.status(201).json(event);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/events/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid event id" });
      const body = { ...req.body };
      if (body.imageUrl) body.imageUrl = await rehostInstagramImage(body.imageUrl);
      const event = await storage.updateEvent(id, body);
      res.status(200).json(event);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // batch delete must be registered before /:id to avoid param capture
  app.delete("/api/events/batch", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { ids } = req.body as { ids?: unknown[] };
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Expected non-empty ids array" });
      }
      const numIds = ids.map((id) => Number(id)).filter((id) => !isNaN(id) && Number.isInteger(id));
      if (numIds.length === 0) {
        return res.status(400).json({ message: "No valid numeric event IDs provided" });
      }
      await storage.bulkDeleteEvents(numIds);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Apply one image URL to many events at once. URL goes through
  // rehostInstagramImage so IG CDN URLs get re-hosted on Cloudinary first.
  app.post("/api/events/bulk-image", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { ids, imageUrl } = req.body as { ids?: unknown[]; imageUrl?: string };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids[] required" });
      if (typeof imageUrl !== "string") return res.status(400).json({ message: "imageUrl required" });
      const numIds = ids.map((id) => Number(id)).filter((id) => !isNaN(id) && Number.isInteger(id));
      if (numIds.length === 0) return res.status(400).json({ message: "No valid event IDs" });
      const finalImageUrl = imageUrl ? await rehostInstagramImage(imageUrl) : "";
      let updated = 0;
      for (const id of numIds) {
        try {
          await storage.updateEvent(id, { imageUrl: finalImageUrl } as any);
          updated++;
        } catch { /* skip failed */ }
      }
      res.json({ updated, imageUrl: finalImageUrl });
    } catch (err) {
      console.error("[events-bulk-image] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Clear the ticket/learn-more link on selected events (bulk). The public
  // event card then falls back to the CGE Instagram profile.
  app.post("/api/events/bulk-clear-link", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { ids } = req.body as { ids?: unknown[] };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids[] required" });
      const numIds = ids.map((id) => Number(id)).filter((id) => !isNaN(id) && Number.isInteger(id));
      if (numIds.length === 0) return res.status(400).json({ message: "No valid event IDs" });
      const updated = await storage.bulkClearEventLinks(numIds);
      res.json({ updated });
    } catch (err) {
      console.error("[events-bulk-clear-link] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/events/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid event id" });
      await storage.deleteEvent(id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/events/bulk-import", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { insertEventSchema } = await import("@shared/schema");
      const rawRows = req.body as Record<string, string>[];
      if (!Array.isArray(rawRows)) return res.status(400).json({ message: "Expected an array of event rows" });
      const validRows: any[] = [];
      const invalid: { rowIndex: number; title: string; reason: string }[] = [];
      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        const title = (row.name || row.title || "").trim();
        const rawDate = (row.date || "").trim();
        if (!title) {
          invalid.push({ rowIndex: i, title: "(no name)", reason: "Missing event name" });
          continue;
        }
        if (!rawDate) {
          invalid.push({ rowIndex: i, title, reason: "Missing date" });
          continue;
        }
        // Belt-and-suspenders date normalization — handles Excel serial
        // numbers (e.g. 46199), slash dates (6/19/2026), and spelled-out
        // dates ("Jun 19, 2026"). Returns the original string if already
        // ISO or completely unparseable.
        const date = parseFlexibleWcDate(rawDate) || rawDate;
        // Events are filtered by `gte(events.date, CURRENT_DATE::text)` on read, so a non-ISO
        // date string would silently fail that lexical comparison and the event would never
        // appear. Reject anything that isn't YYYY-MM-DD up front so the user sees why.
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          invalid.push({ rowIndex: i, title, reason: `Unrecognized date format: "${rawDate}". Expected YYYY-MM-DD or a value the importer can normalize (e.g. 5/19/2026).` });
          continue;
        }
        try {
          // Accept several common column names for the image URL — Apify dumps
          // usually have one of these. Re-host IG CDN URLs onto Cloudinary so
          // they don't expire after a few days.
          const rawImage = (row.imageUrl || row.image_url || row.image || row.media || row.mediaUrl || row.thumbnail || "").trim();
          const finalImageUrl = rawImage ? await rehostInstagramImage(rawImage) : "";
          const parsed = insertEventSchema.parse({
            title,
            date,
            region: row.region || "Central NJ",
            eventTime: row.time || row.eventTime || null,
            venue: row.venue || null,
            city: row.city || null,
            organizer: row.organizer || null,
            influencer: row.influencer || null,
            genre: row.genre || null,
            instagramHandle: row.instagramHandle || null,
            ticketLink: row.ticketLink || null,
            description: "",
            imageUrl: finalImageUrl,
          });
          validRows.push(parsed);
        } catch (err) {
          const reason = err instanceof z.ZodError ? err.errors[0].message : "Could not validate row";
          invalid.push({ rowIndex: i, title, reason });
        }
      }
      const result = await storage.bulkImportEvents(validRows);
      res.json({
        imported: result.imported,
        duplicates: result.duplicates,
        invalid,
      });
      // The weekly import turns the list over — tell search engines to
      // recrawl the event pages right away so churn reads as freshness.
      if (result.imported > 0) {
        pingIndexNow([
          "https://centralgroupevents.com/things-to-do-in-nj",
          "https://centralgroupevents.com/events/this-weekend-in-nj",
          "https://centralgroupevents.com/events/north-nj",
          "https://centralgroupevents.com/events/central-nj",
          "https://centralgroupevents.com/events/south-nj",
        ]).catch(() => {});
      }
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Toggle the is_featured flag on an event (admin only).
  app.patch("/api/events/:id/featured", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const isFeatured = !!req.body.isFeatured;
      const updated = await storage.updateEvent(id, { isFeatured } as any);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Pages ─────────────────────────────────────────────────────────────

  app.get("/api/pages/:slug", async (req: Request, res: Response) => {
    try {
      const page = await storage.getPageBySlug(req.params.slug as string);
      res.json(page);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/pages/:slug", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { insertPageSchema } = await import("@shared/schema");
      const parsed = insertPageSchema.partial().parse(req.body);
      const updated = await storage.upsertPage(req.params.slug as string, parsed);
      res.json(updated);
      // Auto-ping IndexNow when a published page is saved. Fire-and-forget so
      // the admin save doesn't wait on Bing's response.
      if (updated.published && updated.slug !== "things-to-do-in-nj") {
        pingIndexNow([`https://centralgroupevents.com/${updated.slug}`]).catch(() => {});
      }
    } catch (err) {
      res.status(400).json({ message: err instanceof Error ? err.message : "Invalid request" });
    }
  });

  // ── CGE tool integration: "Publish to Guide" ─────────────────────────
  // External publishes land here and write ONLY to pages +
  // landing_page_submissions — never to blog posts. Uses the same
  // CGE_INTEGRATION_TOKEN bearer auth as /api/integrations/bookings and
  // /api/integrations/events/upsert.
  // Re-publishing the same slug replaces the page fields and swaps out the
  // previous integration-sourced listings (source-scoped delete), leaving
  // public-form and admin-imported submissions untouched.
  const INTEGRATION_LISTING_SOURCE = "cge-integration";
  // Slugs owned by real app routes — a guide publish must never shadow them.
  const INTEGRATION_RESERVED_SLUGS = new Set([
    "admin", "blog", "book", "booking-confirmation", "faq", "guides",
    "welcome", "unsubscribe", "invoice", "legal", "api", "build-to-last",
    "submit-world-cup-watch-party", "world-cup-2026-nj-watch-parties",
    "submit-nba-finals-watch-party", "nba-finals-2026-nj-watch-parties",
  ]);
  app.post("/api/integrations/pages/upsert", requireIntegrationToken, async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const slug = String(body.slug ?? "").trim().toLowerCase();
      const title = String(body.title ?? "").trim();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return res.status(400).json({ message: "slug is required and must be kebab-case (letters, numbers, hyphens)" });
      }
      if (INTEGRATION_RESERVED_SLUGS.has(slug)) {
        return res.status(400).json({ message: `slug "${slug}" is reserved by an app route` });
      }
      if (!title) return res.status(400).json({ message: "title is required" });

      // Accept both snake_case (documented) and camelCase field names.
      const bodyContent = typeof body.body_content === "string" ? body.body_content
        : typeof body.bodyContent === "string" ? body.bodyContent : undefined;
      const heroImageUrl = typeof body.hero_image_url === "string" ? body.hero_image_url
        : typeof body.heroImageUrl === "string" ? body.heroImageUrl : undefined;
      const listings = Array.isArray(body.listings) ? (body.listings as Record<string, unknown>[]) : null;

      const patch: Record<string, unknown> = { title };
      if (bodyContent !== undefined) patch.editorContent = bodyContent;
      if (heroImageUrl !== undefined) patch.heroImageUrl = heroImageUrl.trim() || null;
      if (typeof body.published === "boolean") patch.published = body.published;
      // A guide arriving with listings should render them on the page.
      if (listings && listings.length > 0) patch.submissionsEnabled = true;

      const page = await storage.upsertPage(slug, patch);

      const errors: string[] = [];
      let listingCount = 0;
      if (listings) {
        await storage.deleteLandingPageSubmissionsBySource(page.id, INTEGRATION_LISTING_SOURCE);
        for (let i = 0; i < listings.length; i++) {
          const l = listings[i] ?? {};
          const eventDate = parseFlexibleWcDate(String(l.event_date ?? l.eventDate ?? l.date ?? "")) || "";
          const venueName = String(l.venue_name ?? l.venueName ?? l.venue ?? "").trim();
          const town = String(l.town ?? l.city ?? "").trim();
          if (!eventDate || !venueName || !town) {
            errors.push(`listing ${i + 1}: missing/invalid ${!eventDate ? "event_date" : !venueName ? "venue_name" : "town"}`);
            continue;
          }
          try {
            await storage.createLandingPageSubmissionRaw({
              pageId: page.id,
              submitterEmail: String(l.submitter_email ?? l.submitterEmail ?? "integration@centralgroupevents.com").trim().toLowerCase(),
              submitterName: String(l.submitter_name ?? l.submitterName ?? "").trim() || null,
              eventDate,
              venueName,
              town,
              eventName: String(l.event_name ?? l.eventName ?? "").trim() || null,
              instagramHandle: String(l.instagram_handle ?? l.instagramHandle ?? "").trim() || null,
              learnMoreUrl: normalizeUrl(String(l.learn_more_url ?? l.learnMoreUrl ?? "")),
              region: String(l.region ?? "").trim() || null,
              status: "approved",
              source: INTEGRATION_LISTING_SOURCE,
              reviewedAt: new Date(),
            });
            listingCount++;
          } catch (err) {
            errors.push(`listing ${i + 1}: ${err instanceof Error ? err.message.slice(0, 150) : "insert failed"}`);
          }
        }
      }

      if (page.published) {
        pingIndexNow([`https://centralgroupevents.com/${page.slug}`]).catch(() => {});
      }
      res.json({ slug: page.slug, listings: listingCount, errors });
    } catch (err) {
      console.error("[integrations/pages/upsert] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // List all pages (admin Pages tab). Returns drafts + published.
  app.get("/api/admin/pages", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const all = await storage.listPages();
      res.json(all);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Duplicate an existing page as a new draft (Tier 1 QoL). New slug is
  // `<source>-copy` (or `-copy-N` if taken); published flag forced to false.
  app.post("/api/admin/pages/:slug/duplicate", requireAuth(), async (req: Request, res: Response) => {
    try {
      const created = await storage.duplicatePage(req.params.slug as string);
      if (!created) return res.status(404).json({ message: "Source page not found" });
      res.status(201).json(created);
    } catch (err) {
      console.error("[pages-duplicate] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Rename a page's slug. Body: { newSlug }. Auto-creates a redirect from
  // old → new so existing inbound Google traffic doesn't 404.
  app.post("/api/admin/pages/:slug/rename", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { newSlug } = req.body as { newSlug?: string };
      if (!newSlug || typeof newSlug !== "string") return res.status(400).json({ message: "newSlug required" });
      const cleaned = newSlug.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      if (!cleaned) return res.status(400).json({ message: "newSlug must contain a-z, 0-9, or -" });
      const updated = await storage.renamePageSlug(req.params.slug as string, cleaned);
      if (!updated) return res.status(409).json({ message: "Rename conflict (target slug in use or source not found)" });
      res.json(updated);
      // Ping the NEW URL — old URL is now a 301 so search engines will pick it
      // up via crawl, but we want the new URL indexed fast.
      if (updated.published) {
        pingIndexNow([`https://centralgroupevents.com/${updated.slug}`]).catch(() => {});
      }
    } catch (err) {
      console.error("[pages-rename] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Manual IndexNow ping for a specific page (admin button). Useful after
  // major content updates when you want to nudge Bing/Yandex to re-crawl.
  app.post("/api/admin/pages/:slug/ping-indexnow", requireAuth(), async (req: Request, res: Response) => {
    try {
      const page = await storage.getPageBySlug(req.params.slug as string);
      if (!page) return res.status(404).json({ message: "Page not found" });
      if (!page.published) return res.status(400).json({ message: "Page must be published before pinging" });
      const result = await pingIndexNow([`https://centralgroupevents.com/${page.slug}`]);
      res.json(result);
    } catch (err) {
      console.error("[indexnow-manual] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete a landing page. Returns 404 if the slug doesn't exist or is a
  // protected page (e.g. things-to-do-in-nj which has its own hardcoded route).
  app.delete("/api/admin/pages/:slug", requireAuth(), async (req: Request, res: Response) => {
    try {
      const ok = await storage.deletePage(req.params.slug as string);
      if (!ok) return res.status(404).json({ message: "Not found or protected" });
      res.json({ deleted: true });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Public list of published landing pages. Powers the /guides hub, the
  // homepage guides strip, and the footer's auto-populated Guides column.
  // Returns lean projection (no heavy body/faqItems) — good for lists.
  app.get("/api/landing-pages", publicReadLimiter, async (_req: Request, res: Response) => {
    try {
      const pages = await storage.listPublishedLandingPages();
      res.json(pages.map((p) => ({
        slug: p.slug,
        title: p.title,
        metaTitle: p.metaTitle,
        metaDescription: p.metaDescription,
        heroImageUrl: p.heroImageUrl,
        heroImageAlt: p.heroImageAlt,
        ogImageUrl: p.ogImageUrl,
        updatedAt: p.updatedAt,
      })));
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Public-by-slug fetch — returns the page ONLY if published. Used by the
  // public PageRenderer when the URL doesn't match a programmatic topic.
  app.get("/api/landing-pages/:slug", publicReadLimiter, async (req: Request, res: Response) => {
    try {
      const slug = req.params.slug as string;
      // Check redirect first — if this slug was renamed, send a 410-equivalent
      // hint with the new slug so the client can client-side navigate. The
      // SPA-level server redirect (further down) handles 301 for HTML.
      const redirectTo = await storage.getPageRedirect(slug);
      if (redirectTo) {
        return res.status(301).json({ redirect: `/${redirectTo}` });
      }
      const page = await storage.getPageBySlug(slug);
      if (!page || !page.published) return res.status(404).json({ message: "Not found" });
      // Fire-and-forget view increment (don't block the response on the write).
      storage.incrementPageViewCount(slug).catch(() => {});
      res.json(page);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Landing-page submissions (per-page user-submitted events) ───────────
  // Public: list approved submissions for a page (used by the embedded list)
  app.get("/api/landing-pages/:slug/submissions/approved", publicReadLimiter, async (req: Request, res: Response) => {
    try {
      const page = await storage.getPageBySlug(req.params.slug as string);
      if (!page || !page.published) return res.status(404).json({ message: "Not found" });
      const rows = await storage.getApprovedLandingPageSubmissions(page.id);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Public: submit to a page (rate-limited; auto-subscribes submitter)
  app.post("/api/landing-pages/:slug/submissions", formLimiter, async (req: Request, res: Response) => {
    try {
      const page = await storage.getPageBySlug(req.params.slug as string);
      if (!page || !page.published || !page.submissionsEnabled) {
        return res.status(404).json({ message: "Submissions are not enabled for this page" });
      }
      const { insertLandingPageSubmissionSchema } = await import("@shared/schema");
      const parsed = insertLandingPageSubmissionSchema.parse({ ...req.body, pageId: page.id });
      const cleaned = { ...parsed, learnMoreUrl: normalizeUrl(parsed.learnMoreUrl) };
      const created = await storage.createLandingPageSubmission(cleaned);

      // Subscribe only with explicit opt-in from the form (non-blocking)
      if (req.body.newsletterOptIn === true) {
        storage.upsertSubscriber(
          parsed.submitterEmail.toLowerCase().trim(),
          `page:${page.slug}`,
        ).catch(() => {});
      }

      // Submitter auto-reply
      transporter.sendMail({
        from: `"CGE Submissions" <${process.env.GMAIL_USER}>`,
        to: parsed.submitterEmail,
        subject: `Submission received — ${parsed.venueName}`,
        html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px">
          <h2 style="color:#9333ea">Thanks — we got your submission.</h2>
          <p>We're reviewing your event at <strong>${escapeHtml(parsed.venueName)}</strong> in <strong>${escapeHtml(parsed.town)}</strong> for the <strong>${escapeHtml(page.title)}</strong> page.</p>
          <p>Once approved (usually within 24-48 hours), it goes live at <a href="https://centralgroupevents.com/${page.slug}">centralgroupevents.com/${page.slug}</a>.</p>
          <p style="color:#777;font-size:12px;margin-top:32px">— Central Group Events</p>
        </div>`,
      }).catch(() => {});

      // Admin alert
      transporter.sendMail({
        from: `"CGE Website" <${process.env.GMAIL_USER}>`,
        to: "centralgroupevents@gmail.com",
        subject: `📥 New submission on "${page.title}": ${parsed.venueName}, ${parsed.town}`,
        html: `<div style="font-family:Arial,Helvetica,sans-serif">
          <h2>New submission</h2>
          <p>Page: <a href="https://centralgroupevents.com/${page.slug}">${escapeHtml(page.title)}</a></p>
          <table style="border-collapse:collapse;font-size:14px">
            <tr><td style="padding:4px 12px;color:#555">Venue</td><td>${escapeHtml(parsed.venueName)}</td></tr>
            <tr><td style="padding:4px 12px;color:#555">Town</td><td>${escapeHtml(parsed.town)}</td></tr>
            <tr><td style="padding:4px 12px;color:#555">Date</td><td>${escapeHtml(parsed.eventDate)}</td></tr>
            <tr><td style="padding:4px 12px;color:#555">Event name</td><td>${escapeHtml(parsed.eventName || "(none)")}</td></tr>
            <tr><td style="padding:4px 12px;color:#555">Submitter</td><td>${escapeHtml(parsed.submitterEmail)}</td></tr>
          </table>
          <p><a href="https://centralgroupevents.com/admin">Review in admin →</a></p>
        </div>`,
      }).catch(() => {});

      res.status(201).json({ id: created.id, status: created.status });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid submission" });
      }
      console.error("[landing-submit] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: list submissions for a page
  app.get("/api/admin/pages/:slug/submissions", requireAuth(), async (req: Request, res: Response) => {
    try {
      const page = await storage.getPageBySlug(req.params.slug as string);
      if (!page) return res.status(404).json({ message: "Not found" });
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const rows = await storage.listLandingPageSubmissions(page.id, { status });
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: status update (approve / reject / reopen) on one submission
  app.patch("/api/admin/landing-page-submissions/:id/status", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const { status, adminNotes } = req.body as { status?: string; adminNotes?: string };
      if (!status || !["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "status must be pending/approved/rejected" });
      }
      const updated = await storage.updateLandingPageSubmissionStatus(id, status, adminNotes);
      if (!updated) return res.status(404).json({ message: "Not found" });

      // Approval email
      if (status === "approved" && updated.submitterEmail) {
        const page = await storage.getPageById(updated.pageId);
        if (page) {
          transporter.sendMail({
            from: `"CGE Submissions" <${process.env.GMAIL_USER}>`,
            to: updated.submitterEmail,
            subject: `🟢 Your submission is live — ${updated.venueName}`,
            html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px">
              <h2 style="color:#9333ea">You're live!</h2>
              <p>Your event at <strong>${escapeHtml(updated.venueName)}</strong> in <strong>${escapeHtml(updated.town)}</strong> has been approved on <strong>${escapeHtml(page.title)}</strong>.</p>
              <p>It's now visible at: <a href="https://centralgroupevents.com/${page.slug}">centralgroupevents.com/${page.slug}</a></p>
              <p style="color:#777;font-size:12px;margin-top:32px">— Central Group Events</p>
            </div>`,
          }).catch(() => {});
        }
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: edit any field on one submission
  app.patch("/api/admin/landing-page-submissions/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const body = req.body as Record<string, any>;
      const allowed: Record<string, unknown> = {};
      const STRING_FIELDS = ["venueName", "town", "eventDate", "eventName", "instagramHandle", "learnMoreUrl", "region", "adminNotes"];
      for (const k of STRING_FIELDS) {
        if (k in body) {
          const v = body[k];
          allowed[k] = v == null || v === "" ? null : String(v).slice(0, 500);
        }
      }
      if ("venueName" in allowed && !allowed.venueName) return res.status(400).json({ message: "venueName cannot be empty" });
      if ("town" in allowed && !allowed.town) return res.status(400).json({ message: "town cannot be empty" });
      if ("learnMoreUrl" in allowed) allowed.learnMoreUrl = normalizeUrl(allowed.learnMoreUrl as string | null);
      const updated = await storage.updateLandingPageSubmissionFields(id, allowed as any);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err) {
      console.error("[landing-edit] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: bulk status update (multi-select approve/reject/reopen)
  app.post("/api/admin/landing-page-submissions/bulk-status", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { ids, status } = req.body as { ids?: unknown; status?: string };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids[] required" });
      if (!status || !["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "status must be pending/approved/rejected" });
      }
      const numIds = ids.map((id) => Number(id)).filter((n) => Number.isInteger(n));
      const updated = await storage.bulkUpdateLandingPageSubmissionStatus(numIds, status);
      res.json({ updated });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: bulk delete (multi-select)
  app.post("/api/admin/landing-page-submissions/bulk-delete", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { ids } = req.body as { ids?: unknown };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids[] required" });
      const numIds = ids.map((id) => Number(id)).filter((n) => Number.isInteger(n));
      const deleted = await storage.bulkDeleteLandingPageSubmissions(numIds);
      res.json({ deleted });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: bulk-import from CSV / XLSX (auto-approved). Free-text dates accepted.
  app.post("/api/admin/pages/:slug/submissions/bulk-import", requireAuth(), async (req: Request, res: Response) => {
    try {
      const page = await storage.getPageBySlug(req.params.slug as string);
      if (!page) return res.status(404).json({ message: "Page not found" });
      const { adminBulkLandingPageRowSchema } = await import("@shared/schema");
      const raw = req.body as unknown[];
      if (!Array.isArray(raw)) return res.status(400).json({ message: "Expected an array of rows" });
      const invalid: { rowIndex: number; reason: string }[] = [];
      let imported = 0;
      for (let i = 0; i < raw.length; i++) {
        try {
          const parsed = adminBulkLandingPageRowSchema.parse(raw[i]);
          const normalizedDate = parseFlexibleWcDate(parsed.eventDate) || parsed.eventDate;
          await storage.createLandingPageSubmissionRaw({
            pageId: page.id,
            eventDate: normalizedDate,
            venueName: parsed.venueName,
            town: parsed.town,
            eventName: parsed.eventName || null,
            instagramHandle: parsed.instagramHandle || null,
            learnMoreUrl: normalizeUrl(parsed.learnMoreUrl ?? null),
            submitterEmail: "centralgroupevents@gmail.com",
            status: "approved",
            source: "admin-import",
            reviewedAt: new Date(),
          });
          imported++;
        } catch (err) {
          const reason = err instanceof z.ZodError ? err.errors[0]?.message || "Validation failed" : "Unknown error";
          invalid.push({ rowIndex: i, reason });
        }
      }
      res.json({ imported, invalid });
    } catch (err) {
      console.error("[landing-bulk] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: per-page email blast to approved submitters. Body: { subject, html }
  // Sends sequentially with a small delay between sends so Gmail's per-second
  // rate limit doesn't trip. Returns { sent, failed, total }.
  app.post("/api/admin/pages/:slug/email-blast", requireAuth(), async (req: Request, res: Response) => {
    try {
      const page = await storage.getPageBySlug(req.params.slug as string);
      if (!page) return res.status(404).json({ message: "Page not found" });
      const { subject, html } = req.body as { subject?: string; html?: string };
      if (!subject || typeof subject !== "string" || !subject.trim()) {
        return res.status(400).json({ message: "subject is required" });
      }
      if (!html || typeof html !== "string" || !html.trim()) {
        return res.status(400).json({ message: "html body is required" });
      }
      const approved = await storage.getApprovedLandingPageSubmissions(page.id);
      const allRecipients = Array.from(new Set(approved.map((s) => s.submitterEmail?.toLowerCase().trim()).filter(Boolean))) as string[];
      // Honor the suppression list — submitters who unsubscribed from any
      // CGE email never get blasted again.
      const suppressed = await storage.getUnsubscribedEmails(allRecipients);
      const recipients = allRecipients.filter((e) => !suppressed.has(e));
      if (recipients.length === 0) {
        return res.status(400).json({ message: "No approved submitters to email." });
      }
      // Record the blast first so we have an ID to embed in the tracking pixel
      // + link wrappers. Open/click events FK back to this row.
      const blastId = await storage.createEmailBlast("page-blast", subject.slice(0, 200), recipients.length, page.slug);
      const reason = `You're receiving this because you submitted a venue on <a href="https://centralgroupevents.com/${page.slug}" style="color:#8B2FC9;">${escapeHtml(page.title)}</a> at Central Group Events.`;
      let sent = 0;
      let failed = 0;
      for (const to of recipients) {
        try {
          const wrapped = wrapEmailLinks(`${html}${complianceFooter(to, reason, { dark: false })}`, blastId, to);
          const withPixel = appendTrackingPixel(wrapped, blastId, to);
          await transporter.sendMail({
            from: `"Central Group Events" <${process.env.GMAIL_USER}>`,
            to,
            subject: subject.slice(0, 200),
            headers: listUnsubscribeHeaders(to),
            html: withPixel,
          });
          sent++;
          // Small delay between sends to stay within Gmail's burst limits.
          await new Promise((r) => setTimeout(r, 250));
        } catch (err) {
          console.warn("[email-blast] send failed for", to, err);
          failed++;
        }
      }
      res.json({ sent, failed, total: recipients.length, suppressed: suppressed.size, blastId });
    } catch (err) {
      console.error("[email-blast] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Admin auth routes ────────────────────────────────────────────────

  app.post("/api/admin/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const user = await storage.findAdminByEmail(email);
      if (!user || !user.isActive || !user.inviteAccepted) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      if (!user.passwordHash) {
        return res.status(401).json({ message: "Account setup not complete" });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      issueAdminJwt(res, { id: user.id, email: user.email, role: user.role });
      res.json({ email: user.email, role: user.role });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/logout", (req: Request, res: Response) => {
    res.clearCookie("cge_admin_jwt", COOKIE_OPTS);
    res.json({ message: "Logged out" });
  });

  app.post("/api/admin/invite", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { email, role: inviteRole = "editor" } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });
      const validRoles = ["editor", "admin", "superadmin"];
      const role = validRoles.includes(inviteRole) ? inviteRole : "editor";
      const token = crypto.randomBytes(16).toString("hex");
      const existing = await storage.findAdminByEmail(email);
      if (existing) {
        await storage.updateAdminUser(existing.id, { inviteToken: token, inviteAccepted: false, role });
      } else {
        await storage.createAdminUser({
          email,
          role,
          inviteToken: token,
          inviteAccepted: false,
          isActive: true,
        });
      }
      const baseUrl = process.env.NODE_ENV === "production"
        ? "https://centralgroupevents.com"
        : `http://localhost:${process.env.PORT || 5000}`;
      const link = `${baseUrl}/accept-invite?token=${token}`;
      try {
        await transporter.sendMail({
          from: `"CGE Website" <${process.env.GMAIL_USER}>`,
          to: email,
          subject: "You've been invited to the CGE admin team",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 32px; border-radius: 12px;">
              <h1 style="color: #8B2FC9;">You're invited to the CGE admin team</h1>
              <p>You've been added as an editor on the CGE website. Click the link below to set your password and activate your account:</p>
              <div style="margin: 32px 0; text-align: center;">
                <a href="${link}" style="background: #8B2FC9; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">Activate Your Account</a>
              </div>
              <p style="color: #555; font-size: 12px;">Or copy this link: ${link}</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Invite email failed:", emailError);
      }
      res.json({ message: "Invite sent" });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/accept-invite", async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }
      const user = await storage.findAdminByToken(token);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired invite token" });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      await storage.updateAdminUser(user.id, {
        passwordHash,
        inviteAccepted: true,
        inviteToken: null,
        isActive: true,
      });
      res.json({ message: "Account activated" });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/users", requireAuth(), async (req: Request, res: Response) => {
    try {
      const users = await storage.listAdminUsers();
      res.json(users);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/users/:id/deactivate", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid user id" });
      await storage.deactivateAdmin(id);
      res.json({ message: "User deactivated" });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── New admin management routes ───────────────────────────────────────

  app.get("/api/admin/me", requireAuth(), (req: Request, res: Response) => {
    if (!req.adminUser) return res.status(401).json({ message: "Not authenticated" });
    res.json({ email: req.adminUser.email, role: req.adminUser.role });
  });

  app.get("/api/admin/team", requireAuth(), async (req: Request, res: Response) => {
    try {
      const users = await storage.listAdminUsers();
      res.json(users);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/team/:id/deactivate", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      await storage.deactivateAdmin(id);
      res.json({ message: "Deactivated" });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/team/:id/reactivate", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      await storage.reactivateAdmin(id);
      res.json({ message: "Reactivated" });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/subscribers", requireAuth(), async (req: Request, res: Response) => {
    try {
      const subs = await storage.listSubscribers();
      res.json(subs);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/subscribers/import", requireAuth(), async (req: Request, res: Response) => {
    try {
      const rows = req.body;
      if (!Array.isArray(rows)) return res.status(400).json({ message: "Expected an array of { email, region? } objects" });

      console.log(`[subscriber-import] Received ${rows.length} rows from client`);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidRows: string[] = [];
      const valid = rows.filter((r: any) => {
        if (!r || typeof r.email !== "string") {
          invalidRows.push("(no email field)");
          return false;
        }
        const email = r.email.trim().toLowerCase();
        if (!emailRegex.test(email)) {
          invalidRows.push(email || "(empty)");
          return false;
        }
        return true;
      });

      if (invalidRows.length > 0) {
        console.log(`[subscriber-import] ${invalidRows.length} rows failed regex validation:`, invalidRows.slice(0, 10));
      }
      console.log(`[subscriber-import] ${valid.length} rows passed validation, sending to storage`);

      const result = await storage.importSubscribers(
        valid.map((r: any) => ({
          email: r.email.trim().toLowerCase(),
          name: typeof r.name === "string" && r.name.trim() ? r.name.trim() : undefined,
          region: typeof r.region === "string" && r.region.trim() ? r.region.trim() : undefined,
          referrer: typeof r.referrer === "string" && r.referrer.trim() ? r.referrer.trim() : undefined,
        }))
      );

      console.log(`[subscriber-import] Result: ${result.imported} imported, ${result.skipped} skipped`);
      res.json({ ...result, invalidFormat: invalidRows.length });
    } catch (err) {
      console.error("[subscriber-import] Error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Bulk delete subscribers (multi-select).
  app.post("/api/admin/subscribers/bulk-delete", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { ids } = req.body as { ids?: unknown };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids[] required" });
      const numIds = ids.map((id) => Number(id)).filter((n) => Number.isInteger(n));
      const deleted = await storage.bulkDeleteSubscribers(numIds);
      res.json({ deleted });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Bulk-edit region and/or source on selected subscribers.
  // Body: { ids: number[], region?: string | null, referrer?: string | null }
  // Use null to clear a field, undefined / omit to leave unchanged.
  app.post("/api/admin/subscribers/bulk-edit", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { ids, region, referrer } = req.body as { ids?: unknown; region?: string | null; referrer?: string | null };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids[] required" });
      const numIds = ids.map((id) => Number(id)).filter((n) => Number.isInteger(n));
      const fields: { region?: string | null; referrer?: string | null } = {};
      if (region !== undefined) fields.region = region === null || region === "" ? null : String(region).trim();
      if (referrer !== undefined) fields.referrer = referrer === null || referrer === "" ? null : String(referrer).trim();
      if (Object.keys(fields).length === 0) return res.status(400).json({ message: "Provide at least one of region or referrer" });
      const updated = await storage.bulkEditSubscribers(numIds, fields);
      res.json({ updated });
    } catch (err) {
      console.error("[subscribers-bulk-edit] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/subscribers/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      await storage.deleteSubscriber(id);
      res.json({ message: "Deleted" });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/analytics", requireAuth(), async (req: Request, res: Response) => {
    try {
      const allPosts = await storage.getAllPosts();
      const result = await Promise.all(
        allPosts.map(async (post) => {
          const viewRows = await storage.getViewsByPost(post.id);
          const clickStats = await storage.getClickStats();
          const postClicks = clickStats
            .filter((c) => c.url.includes(`postId=${post.id}`))
            .reduce((s, c) => s + c.count, 0);
          return {
            postId: post.id,
            title: post.title,
            slug: post.slug,
            totalViews: viewRows,
            totalClicks: postClicks,
          };
        })
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/newsletter/send", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { subject, body } = req.body;
      if (!subject || !body) return res.status(400).json({ message: "Subject and body are required" });
      // Only active subscribers — anyone who unsubscribed is suppressed.
      const subscribers = await storage.listActiveSubscribers();
      const blastId = await storage.createEmailBlast("newsletter", String(subject).slice(0, 200), subscribers.length);
      // Footer is per-recipient (signed unsubscribe link), so build the body
      // shell once and stamp the footer inside the send loop.
      const htmlFor = (email: string) => `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 32px; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #8B2FC9; margin: 0;">Central Group Events</h1>
                  <p style="color: #888; font-size: 12px; margin: 4px 0 0;">NJ Nightlife Newsletter</p>
                </div>
                <div style="color: #e0e0e0; line-height: 1.7; white-space: pre-wrap;">${body}</div>
                ${complianceFooter(email, "You're receiving this because you subscribed to the weekly newsletter at centralgroupevents.com.")}
              </div>
            `;
      let sent = 0;
      for (const sub of subscribers) {
        try {
          const wrapped = wrapEmailLinks(htmlFor(sub.email), blastId, sub.email);
          const withPixel = appendTrackingPixel(wrapped, blastId, sub.email);
          await transporter.sendMail({
            from: `"Central Group Events" <${process.env.GMAIL_USER}>`,
            to: sub.email,
            subject,
            headers: listUnsubscribeHeaders(sub.email),
            html: withPixel,
          });
          sent++;
        } catch (e) {
          console.error(`Failed to send to ${sub.email}:`, e);
        }
      }
      res.json({ message: "Newsletter sent", sent, blastId });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Posts routes ─────────────────────────────────────────────────────

  // IMPORTANT: /api/posts/admin must be before /api/posts/:slug to avoid slug capturing "admin"
  app.get("/api/posts/admin", requireAuth(), async (req: Request, res: Response) => {
    try {
      const allPosts = await storage.getAllPosts();
      res.json(allPosts);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/posts", async (req: Request, res: Response) => {
    try {
      const published = await storage.getPublishedPosts();
      res.json(published);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/posts/:slug", async (req: Request, res: Response) => {
    try {
      const post = await storage.getPostBySlug(req.params.slug as string);
      if (!post) return res.status(404).json({ message: "Post not found" });

      // Draft posts: only verified admins can see
      if (!post.isPublished) {
        const adminToken: string | undefined = req.cookies?.cge_admin_jwt;
        const admin = adminToken ? await verifyAdminToken(adminToken) : null;
        if (!admin) return res.status(404).json({ message: "Post not found" });
      }

      // Gated posts: only subscribers with hasAccess can see full content
      if (post.isGated) {
        const adminToken: string | undefined = req.cookies?.cge_admin_jwt;
        const isAdmin = adminToken ? !!(await verifyAdminToken(adminToken)) : false;
        if (!isAdmin) {
          const subEmail: string | undefined = req.signedCookies?.cge_subscriber;
          const hasAccess = subEmail
            ? await storage.findSubscriberByEmail(subEmail).then((s) => !!s && s.hasAccess !== false)
            : false;
          if (!hasAccess) {
            const { content: _content, ...meta } = post;
            return res.status(403).json({ ...meta, gated: true, message: "Subscriber access required" });
          }
        }
      }

      storage.recordView(post.id).catch(() => {});
      res.json(post);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/posts", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { title, excerpt, content, coverImageUrl, isGated } = req.body;
      if (!title) return res.status(400).json({ message: "Title is required" });
      const post = await storage.createPost({ title, excerpt, content, coverImageUrl, isGated: !!isGated });
      res.status(201).json(post);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/posts/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid post id" });
      const { title, excerpt, content, coverImageUrl, isGated } = req.body;
      const post = await storage.updatePost(id, { title, excerpt, content, coverImageUrl, isGated }, req.adminUser?.id);
      res.json(post);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/posts/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid post id" });
      await storage.deletePost(id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/posts/:id/publish", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid post id" });
      const post = await storage.togglePublish(id);
      res.json(post);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/posts/:id/gate", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid post id" });
      const post = await storage.toggleGate(id);
      res.json(post);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/posts/:id/versions", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid post id" });
      const versions = await storage.getVersionsForPost(id);
      res.json(versions);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/posts/:id/restore/:versionId", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const versionId = parseInt(req.params.versionId as string, 10);
      if (isNaN(id) || isNaN(versionId)) return res.status(400).json({ message: "Invalid ids" });
      const post = await storage.restoreVersion(id, versionId, req.adminUser?.id);
      res.json(post);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Internal server error";
      if (msg.includes("not found") || msg.includes("does not belong")) {
        return res.status(404).json({ message: msg });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Comments routes ──────────────────────────────────────────────────

  app.get("/api/posts/:id/comments", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid post id" });
      const allComments = await storage.getCommentsByPost(id);
      res.json(allComments);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/posts/:id/comments", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid post id" });
      const emailFromCookie = req.signedCookies?.cge_subscriber;
      if (!emailFromCookie) {
        return res.status(401).json({ message: "Subscriber access required to comment" });
      }
      const sub = await storage.findSubscriberByEmail(emailFromCookie);
      if (!sub || sub.hasAccess === false) {
        return res.status(401).json({ message: "Subscriber access required to comment" });
      }
      const { body: commentBody, parentId } = req.body;
      if (!commentBody || commentBody.trim().length === 0) {
        return res.status(400).json({ message: "Comment cannot be empty" });
      }
      const comment = await storage.createComment({
        postId: id,
        email: emailFromCookie,
        body: commentBody.trim().slice(0, 2000),
        parentId: parentId ?? null,
      });
      res.status(201).json(comment);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Subscriber gating routes ─────────────────────────────────────────

  app.post("/api/subscriber/check", formLimiter, async (req: Request, res: Response) => {
    try {
      const emailRaw = req.body.email;
      const referrer = req.body.referrer;
      if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
        return res.status(400).json({ message: "Valid email is required" });
      }
      const email = emailRaw.toLowerCase().trim();
      const { subscriber, isNew } = await storage.upsertSubscriber(email, referrer);
      res.cookie("cge_subscriber", email, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        signed: true,
      });
      if (isNew) {
        try {
          await transporter.sendMail({
            from: `"CGE Website" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: "You're on the CGE insider list 🎉",
            headers: listUnsubscribeHeaders(email),
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 32px; border-radius: 12px;">
                <h1 style="color: #8B2FC9;">Welcome to the CGE insider list!</h1>
                <p>You now have full access to all CGE newsletter posts.</p>
                <p>Head over to <a href="https://centralgroupevents.com/things-to-do-in-nj" style="color: #8B2FC9;">centralgroupevents.com/things-to-do-in-nj</a> to see what's happening across NJ this week.</p>
                ${complianceFooter(email, "You're receiving this because you signed up for the CGE list at centralgroupevents.com.")}
              </div>
            `,
          });
        } catch (emailError) {
          console.error("Welcome email failed:", emailError);
        }
        return res.json({ access: true, isNew: true });
      }
      res.json({ access: true });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/subscriber/verify", async (req: Request, res: Response) => {
    try {
      const email: string | undefined = req.signedCookies?.cge_subscriber;
      if (!email) return res.json({ access: false });
      const sub = await storage.findSubscriberByEmail(email);
      res.json({ access: !!sub && sub.hasAccess !== false });
    } catch (err) {
      res.json({ access: false });
    }
  });

  // ── Link click tracking ───────────────────────────────────────────────
  app.get("/go", async (req: Request, res: Response) => {
    try {
      const raw = req.query.url as string;
      const postIdRaw = req.query.postId as string;
      const eventIdRaw = req.query.eventId as string;
      if (!raw) return res.status(400).json({ message: "Invalid URL" });
      // Auto-prepend https:// for stored URLs that came in as bare domains
      // (e.g. "posh.vip/e/foo", "www.venue.com"). Old rows pre-normalizeUrl()
      // and any path that skipped the normalizer end up here.
      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
      const postId = postIdRaw ? parseInt(postIdRaw, 10) : undefined;
      const eventId = eventIdRaw ? parseInt(eventIdRaw, 10) : undefined;
      const referer = (req.headers.referer || req.headers.referrer) as string | undefined;
      const sourcePage = referer && referer.trim() ? referer.trim() : undefined;
      storage.recordClick(
        url,
        isNaN(postId as number) ? undefined : postId,
        sourcePage,
        isNaN(eventId as number) ? undefined : eventId,
      ).catch(() => {});
      res.redirect(302, url);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Email blast tracking endpoints ─────────────────────────────────
  // Open pixel — returns a 1x1 transparent gif, records the open. Always
  // 200 even if logging fails so the recipient's client doesn't show a
  // broken-image icon.
  const TRANSPARENT_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  app.get("/api/email/track/open", async (req: Request, res: Response) => {
    try {
      const blastId = parseInt(req.query.b as string, 10);
      const email = decodeRecipient((req.query.r as string) || "");
      if (Number.isFinite(blastId) && email) {
        storage.recordEmailBlastEvent(blastId, email, "open").catch(() => {});
      }
    } catch {}
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.status(200).send(TRANSPARENT_GIF);
  });

  // Click redirect — records the click then 302's to the original URL.
  app.get("/api/email/track/click", async (req: Request, res: Response) => {
    try {
      const blastId = parseInt(req.query.b as string, 10);
      const email = decodeRecipient((req.query.r as string) || "");
      const url = (req.query.u as string) || "";
      if (!url) return res.status(400).send("Missing destination");
      if (Number.isFinite(blastId) && email) {
        storage.recordEmailBlastEvent(blastId, email, "click", url).catch(() => {});
      }
      res.redirect(302, url);
    } catch {
      res.status(500).send("Error");
    }
  });

  // Admin: list every blast with aggregated open/click counts.
  app.get("/api/admin/email-blasts", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const rows = await storage.listEmailBlastsWithStats();
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/funnel/track", async (req: Request, res: Response) => {
    try {
      const { step, sessionId, metadata } = req.body as { step?: string; sessionId?: string; metadata?: unknown };
      if (typeof step !== "string" || !step.trim() || step.length > 100) {
        return res.status(400).json({ message: "step is required" });
      }
      const meta = metadata !== undefined ? JSON.stringify(metadata).slice(0, 1000) : undefined;
      storage.recordFunnelStep(step, typeof sessionId === "string" ? sessionId.slice(0, 100) : undefined, meta).catch(() => {});
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Scheduled emails (T-4 reminder + T+1 feedback) ──────────────────────
  // Returns today's date in America/New_York as YYYY-MM-DD. The cron fires
  // at 9am ET via cron-job.org, so "today in ET" is the correct frame for
  // both backfill (scheduledFor calc) and pending lookup.
  function todayInET(): string {
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
    return fmt.format(new Date()); // en-CA gives YYYY-MM-DD
  }
  // Add `days` to a YYYY-MM-DD string and return YYYY-MM-DD. Anchored to
  // UTC noon so daylight-savings transitions never roll into an adjacent day.
  function shiftIsoDate(iso: string, days: number): string {
    const [y, m, d] = iso.split("-").map(Number);
    const ms = Date.UTC(y, m - 1, d, 12) + days * 86_400_000;
    const dt = new Date(ms);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  }

  const INTERNAL_REMINDER_RECIPIENTS = ["centralgroupevents@gmail.com", "aagu1999@gmail.com"];
  const FEEDBACK_FORM_URL = "https://form.jotform.com/261385070354051";

  function buildReminderEmail(b: any): { subject: string; html: string } {
    const subject = `Booking heads-up: ${b.eventName || b.venueName} in 4 days`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0a0a0a; color: #fff; border-radius: 12px;">
        <p style="color:#8B2FC9;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:bold;margin:0 0 6px">T-4 heads-up</p>
        <h2 style="margin:0 0 16px;font-size:22px">${escapeHtml(b.eventName || b.venueName)} is in 4 days</h2>
        <table style="width:100%;font-size:14px;color:#ddd;line-height:1.7">
          <tr><td style="color:#888;width:120px">Event</td><td>${escapeHtml(b.eventName || "—")}</td></tr>
          <tr><td style="color:#888">Venue</td><td>${escapeHtml(b.venueName)}</td></tr>
          <tr><td style="color:#888">Where</td><td>${escapeHtml([b.city, b.region].filter(Boolean).join(", "))}</td></tr>
          <tr><td style="color:#888">Date / time</td><td>${escapeHtml(b.eventDate)}${b.eventTime ? " · " + escapeHtml(b.eventTime) : ""}</td></tr>
          <tr><td style="color:#888">Booker</td><td>${escapeHtml(b.contactName || "—")}</td></tr>
          <tr><td style="color:#888">Email</td><td>${escapeHtml(b.email)}</td></tr>
          <tr><td style="color:#888">Phone</td><td>${escapeHtml(b.phone || "—")}</td></tr>
          <tr><td style="color:#888">Package</td><td>${escapeHtml(b.mode || "—")}</td></tr>
          <tr><td style="color:#888">Status</td><td>${escapeHtml(b.status || "—")}</td></tr>
          ${b.instagramHandle ? `<tr><td style="color:#888">IG</td><td>@${escapeHtml(b.instagramHandle.replace(/^@/, ""))}</td></tr>` : ""}
        </table>
        <p style="margin-top:24px;color:#aaa;font-size:13px">Time to schedule the social posts, queue the newsletter slot, and send any final assets.</p>
      </div>`;
    return { subject, html };
  }

  function buildFeedbackEmail(b: any): { subject: string; html: string } {
    const eventLabel = b.eventName || b.venueName;
    // First name only — feels more personal than the full booking
    // contactName. Falls back to "there" when contactName is missing.
    const firstName = (b.contactName || "").trim().split(/\s+/)[0] || "there";
    const subject = `Reflecting on ${eventLabel} — and a quick favor`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #0a0a0a; color: #fff; border-radius: 12px; line-height: 1.65;">
        <p style="color:#ddd;font-size:15px;margin:0 0 16px">Hi ${escapeHtml(firstName)},</p>

        <p style="color:#e0e0e0;font-size:15px;margin:0 0 16px">
          Yesterday was the day. Whether <strong>${escapeHtml(eventLabel)}</strong> went exactly to plan or threw a few curveballs at you, you put something into the world that wasn't there before — and we got to be part of it. That's not lost on us.
        </p>

        <p style="color:#e0e0e0;font-size:15px;margin:0 0 22px">
          We'd love to hear how it went from your side. Not just the numbers (though those matter too) but the human stuff — what surprised you, what you'd do differently, the small detail that made the night. It'll take two minutes.
        </p>

        <p style="text-align:center;margin:28px 0">
          <a href="${FEEDBACK_FORM_URL}" style="display:inline-block;padding:14px 32px;background:#8B2FC9;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px">Tell us how it went →</a>
        </p>

        <p style="color:#e0e0e0;font-size:15px;margin:22px 0 16px">
          ${b.paidAt
            ? "We don't take it for granted that you trusted us with your event. There are a hundred ways you could have spent that promotion budget — our hope is we earned the choice. And if we didn't quite hit the mark, that's exactly what we need to hear."
            : "We don't take it for granted that you trusted us with your event. Our hope is we made getting the word out a little easier — and if we didn't quite hit the mark, that's exactly what we need to hear."}
        </p>

        <p style="color:#e0e0e0;font-size:15px;margin:0 0 24px">
          Whatever's next — another event, a breather, something new entirely — we're rooting for you.
        </p>

        <p style="color:#aaa;font-size:14px;margin:0 0 18px">
          — The Central Group Events Team
        </p>

        <p style="color:#888;font-size:13px;font-style:italic;margin:0;padding-top:18px;border-top:1px solid #222">
          P.S. Got photos or videos from the night you'd love to see featured? Just reply with them — we'd love to share.
        </p>
      </div>`;
    return { subject, html };
  }

  // Build the actual email body for a single scheduled row given the
  // booking — extracted so the admin preview + send-now endpoints can
  // reuse the exact same renderer as the cron tick.
  function renderScheduledEmail(row: { id: number; kind: string; recipientEmail: string; bookingId: number }, booking: any, dryRun: boolean) {
    const tpl = row.kind === "reminder_t4" ? buildReminderEmail(booking) : buildFeedbackEmail(booking);
    const subject = dryRun ? `[TEST] ${tpl.subject}` : tpl.subject;
    const to = dryRun ? "centralgroupevents@gmail.com" : row.recipientEmail;
    const html = dryRun
      ? `<div style="background:#fff3cd;border:1px solid #ffeaa7;padding:12px;margin-bottom:16px;color:#5b4a00;font-family:Arial,sans-serif;font-size:13px"><strong>[DRY RUN]</strong> Would have sent this to: <code>${escapeHtml(row.recipientEmail)}</code> for booking #${row.bookingId} (${row.kind}).</div>${tpl.html}`
      : tpl.html;
    return { subject, html, to };
  }

  // The whole "process scheduled emails" loop, extracted so both the
  // secret-protected cron endpoint AND the admin "Run now" button can
  // call the same logic. Backfills rows, sends pending ones.
  async function runScheduledEmailsTick(): Promise<{ today: string; dryRun: boolean; backfilled: number; sent: number; failed: number; skipped: number; pendingProcessed: number; remindersSent: number; remindersFailed: number; errors: string[] }> {
    const today = todayInET();
    const dryRunSetting = await storage.getSetting("cronDryRun");
    const dryRun = dryRunSetting !== "false";
    // Sub-step failures land here instead of 500ing the whole tick, so one
    // bad booking row or a missing table can't block every other send.
    const errors: string[] = [];

    const allBookings = await storage.getBookings();
    let backfilled = 0;
    for (const b of allBookings) {
      if (b.status && b.status.toLowerCase() === "cancelled") continue;
      const iso = parseFlexibleWcDate(b.eventDate);
      if (!iso) continue;
      try {
        // T-4 heads-up is internal prep for a *paid* promotion — paid only.
        if (b.paidAt) {
          const t4 = shiftIsoDate(iso, -4);
          await storage.ensureScheduledEmailRows(b.id, "reminder_t4", t4, INTERNAL_REMINDER_RECIPIENTS.join(","));
        }
        // T+1 feedback survey goes to every booker, paid or not — anyone
        // who ran an event with us can tell us how it went.
        const t1 = shiftIsoDate(iso, 1);
        await storage.ensureScheduledEmailRows(b.id, "feedback_t1", t1, b.email);
        backfilled++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[scheduled-emails] backfill failed for booking #${b.id}:`, err);
        errors.push(`backfill booking #${b.id}: ${msg.slice(0, 200)}`);
      }
    }

    const pending = await storage.listPendingScheduledEmails(today);
    let sent = 0, failed = 0, skipped = 0;
    for (const row of pending) {
      const booking = allBookings.find((b) => b.id === row.bookingId);
      if (!booking) {
        await storage.markScheduledEmailSent(row.id, "skipped", { error: "booking not found", dryRun });
        skipped++;
        continue;
      }
      if (booking.status && booking.status.toLowerCase() === "cancelled") {
        await storage.markScheduledEmailSent(row.id, "skipped", { error: "booking cancelled", dryRun });
        skipped++;
        continue;
      }
      // Hard guard: re-derive the due date from the booking's CURRENT event
      // date before sending. The feedback email must never go out before
      // the event has happened (and the T-4 heads-up never before T-4),
      // even if this row was created from an older/garbled event date.
      {
        const isoNow = parseFlexibleWcDate(booking.eventDate);
        if (!isoNow) {
          await storage.markScheduledEmailSent(row.id, "skipped", { error: `event date unparseable: "${String(booking.eventDate).slice(0, 40)}"`, dryRun });
          skipped++;
          continue;
        }
        const dueFor = shiftIsoDate(isoNow, row.kind === "reminder_t4" ? -4 : 1);
        if (dueFor > today) {
          // Not due yet — leave the row pending (backfill has already
          // resynced its date); it fires on the right day.
          skipped++;
          continue;
        }
      }
      const { subject, html, to } = renderScheduledEmail(row, booking, dryRun);
      try {
        await transporter.sendMail({
          from: `"Central Group Events" <${process.env.GMAIL_USER}>`,
          to,
          subject,
          html,
        });
        await storage.markScheduledEmailSent(row.id, "sent", { dryRun });
        sent++;
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 500) : "unknown";
        await storage.markScheduledEmailSent(row.id, "failed", { error: msg, dryRun });
        failed++;
      }
    }

    // Standalone reminders piggyback on the same tick. Any reminder
    // with sendAt <= now and status='pending' gets fired and marked sent.
    // Same dry-run honored — preview lands in centralgroupevents@gmail.com.
    // If the reminders table isn't reachable (e.g. schema not pushed yet),
    // the scheduled emails above still count as a successful run.
    let dueReminders: Awaited<ReturnType<typeof storage.listDueReminders>> = [];
    try {
      dueReminders = await storage.listDueReminders(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[scheduled-emails] listDueReminders failed:", err);
      errors.push(`reminders lookup: ${msg.slice(0, 200)}`);
    }
    let remindersSent = 0;
    let remindersFailed = 0;
    for (const r of dueReminders) {
      const recipients = r.recipientEmails.split(",").map((s) => s.trim()).filter(Boolean);
      const subject = dryRun ? `[TEST] Reminder: ${r.title}` : `Reminder: ${r.title}`;
      const baseHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #0a0a0a; color: #fff; border-radius: 12px; line-height: 1.6;">
          <p style="color:#8B2FC9;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:bold;margin:0 0 8px">Reminder</p>
          <h2 style="margin:0 0 16px;font-size:22px;color:#fff">${escapeHtml(r.title)}</h2>
          ${r.body ? `<div style="color:#ddd;font-size:15px;white-space:pre-wrap;margin:0 0 18px">${escapeHtml(r.body)}</div>` : ""}
          <p style="color:#888;font-size:12px;margin-top:24px;border-top:1px solid #222;padding-top:12px">Scheduled for ${r.sendAt.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" })} ET · sent by Central Group Events admin.</p>
        </div>`;
      const html = dryRun
        ? `<div style="background:#fff3cd;border:1px solid #ffeaa7;padding:12px;margin-bottom:16px;color:#5b4a00;font-family:Arial,sans-serif;font-size:13px"><strong>[DRY RUN]</strong> Would have sent to: <code>${escapeHtml(r.recipientEmails)}</code></div>${baseHtml}`
        : baseHtml;
      const to = dryRun ? "centralgroupevents@gmail.com" : recipients.join(",");
      try {
        await transporter.sendMail({
          from: `"Central Group Events" <${process.env.GMAIL_USER}>`,
          to,
          subject,
          html,
        });
        await storage.markReminderSent(r.id, "sent");
        remindersSent++;
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 500) : "unknown";
        await storage.markReminderSent(r.id, "failed", { error: msg });
        remindersFailed++;
      }
    }

    return { today, dryRun, backfilled, sent, failed, skipped, pendingProcessed: pending.length, remindersSent, remindersFailed, errors };
  }

  // Public, secret-protected. Pinged daily at 9am ET by cron-job.org.
  // ── Weekly events digest (Fridays 1 PM ET) ───────────────────────────
  // One email per subscriber per week: the next 7 days of events grouped by
  // region (the subscriber's own region first), with rotating sponsored
  // slots filled from paid bookings whose event is coming up. Rides the
  // existing blast machinery (open/click tracking, compliance footer,
  // one-click unsubscribe). Gmail-friendly: at most DIGEST_MAX_PER_TICK
  // sends per cron tick; a cursor continues on later ticks until the list
  // is covered, so any list size works without tripping daily caps.
  const DIGEST_MAX_PER_TICK = 350;

  function digestRegionOf(raw: string | null | undefined): string {
    const r = (raw || "").toLowerCase();
    if (r.includes("north")) return "North NJ";
    if (r.includes("central")) return "Central NJ";
    if (r.includes("south")) return "South NJ";
    return "Across NJ";
  }

  /** Most recent Friday in ET — the digest's week key (YYYY-MM-DD). */
  function currentDigestWeek(): string {
    const today = todayInET();
    const [y, m, d] = today.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); // 0=Sun…5=Fri
    return shiftIsoDate(today, -((dow - 5 + 7) % 7));
  }

  function hourInET(): number {
    return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date())) % 24;
  }

  function digestDateLabel(iso: string): string {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  }

  // Admin-managed sponsored image slots inside the digest — same JSON shapes
  // as the events-page slots (top/bottom single-image + a multi-photo
  // carousel). The carousel can't slide in email, so it rotates instead:
  // each recipient gets the next photo in the cycle (seeded by subscriber id),
  // and the whole cycle shifts week to week.
  type DigestAdSlot = { imageUrl?: string; linkUrl?: string; alt?: string; caption?: string };
  type DigestAdCarousel = { images?: string[]; linkUrl?: string; alt?: string; caption?: string };

  async function loadDigestAdSlots(): Promise<{ top: DigestAdSlot | null; bottom: DigestAdSlot | null; carousel: DigestAdCarousel | null }> {
    const parseSlot = (raw: string | null): DigestAdSlot | null => {
      if (!raw) return null;
      try {
        const p = JSON.parse(raw);
        return p && typeof p === "object" && p.imageUrl ? p : null;
      } catch { return null; }
    };
    const parseCarousel = (raw: string | null): DigestAdCarousel | null => {
      if (!raw) return null;
      try {
        const p = JSON.parse(raw);
        if (p && typeof p === "object" && Array.isArray(p.images)) {
          const images = p.images.filter((s: unknown) => typeof s === "string" && s.trim());
          return images.length > 0 ? { ...p, images } : null;
        }
        return null;
      } catch { return null; }
    };
    return {
      top: parseSlot(await storage.getSetting("digest.adSlotTop")),
      bottom: parseSlot(await storage.getSetting("digest.adSlotBottom")),
      carousel: parseCarousel(await storage.getSetting("digest.adCarousel")),
    };
  }

  async function buildDigestData() {
    const today = todayInET();
    const until = shiftIsoDate(today, 7);
    const all = await storage.getEvents();
    const upcoming = all
      .map((e) => ({ e, iso: parseFlexibleWcDate(e.date) as string | null }))
      .filter((x): x is { e: (typeof all)[number]; iso: string } => !!x.iso && x.iso! >= today && x.iso! <= until)
      .sort((a, b) => a.iso.localeCompare(b.iso));

    // Sponsors: paid, not cancelled, event within 10 days; least recently
    // featured first (rotation log in app_settings), stable for the week.
    const slots = Math.max(0, parseInt((await storage.getSetting("digest.sponsorSlots")) || "2", 10) || 0);
    let weekSponsorIds: number[] = [];
    try { weekSponsorIds = JSON.parse((await storage.getSetting("digest.weekSponsors")) || "[]"); } catch { /* fresh */ }
    const bookings = await storage.getBookings();
    const eligible = bookings.filter((b) => {
      if (!b.paidAt || (b.status && b.status.toLowerCase() === "cancelled")) return false;
      const iso = parseFlexibleWcDate(b.eventDate);
      return !!iso && iso >= today && iso <= shiftIsoDate(today, 10);
    });
    let sponsors = eligible.filter((b) => weekSponsorIds.includes(b.id));
    if (sponsors.length === 0 && eligible.length > 0 && slots > 0) {
      let log: Record<string, string> = {};
      try { log = JSON.parse((await storage.getSetting("digest.sponsorLog")) || "{}"); } catch { /* fresh */ }
      eligible.sort((a, b) => (log[String(a.id)] || "").localeCompare(log[String(b.id)] || ""));
      sponsors = eligible.slice(0, slots);
      for (const s of sponsors) log[String(s.id)] = new Date().toISOString();
      await storage.setSetting("digest.sponsorLog", JSON.stringify(log));
      await storage.setSetting("digest.weekSponsors", JSON.stringify(sponsors.map((s) => s.id)));
    }
    return { upcoming, sponsors, adSlots: await loadDigestAdSlots() };
  }

  function buildDigestHtml(
    data: Awaited<ReturnType<typeof buildDigestData>>,
    firstRegion?: string | null,
    rotateSeed = 0,
  ): { subject: string; html: string } {
    const { upcoming, sponsors, adSlots } = data;
    const byRegion: Record<string, typeof upcoming> = {};
    for (const x of upcoming) (byRegion[digestRegionOf(x.e.region)] ??= []).push(x);
    const regionOrder = ["North NJ", "Central NJ", "South NJ", "Across NJ"];
    const preferred = digestRegionOf(firstRegion);
    regionOrder.sort((a, b) => (a === preferred ? -1 : 0) - (b === preferred ? 1 : 0));

    const go = (url: string, eventId?: number) =>
      `https://centralgroupevents.com/go?url=${encodeURIComponent(url)}${eventId ? `&eventId=${eventId}` : ""}`;

    // One sponsored image block (shared by the fixed slots and the carousel).
    const adImageHtml = (src: string, slot: { linkUrl?: string; alt?: string; caption?: string }) => {
      const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(slot.alt || "Sponsored")}" width="576" style="display:block;width:100%;max-width:576px;height:auto;border-radius:12px;border:1px solid #eee" />`;
      return `
      <div style="margin:0 0 18px">
        <p style="margin:0 0 6px;font-size:10px;letter-spacing:2px;color:#8B2FC9;font-weight:bold">SPONSORED</p>
        ${slot.linkUrl ? `<a href="${go(slot.linkUrl)}" style="text-decoration:none">${img}</a>` : img}
        ${slot.caption ? `<p style="margin:6px 0 0;font-size:12.5px;color:#777">${escapeHtml(slot.caption)}</p>` : ""}
      </div>`;
    };
    const adTopHtml = adSlots.top?.imageUrl ? adImageHtml(adSlots.top.imageUrl, adSlots.top) : "";
    const adBottomHtml = adSlots.bottom?.imageUrl ? adImageHtml(adSlots.bottom.imageUrl, adSlots.bottom) : "";
    // Email can't slide, so the carousel rotates: each send picks the next
    // photo in the cycle (rotateSeed = subscriber id).
    const carouselImages = adSlots.carousel?.images ?? [];
    const adCarouselHtml = carouselImages.length > 0
      ? adImageHtml(carouselImages[((rotateSeed % carouselImages.length) + carouselImages.length) % carouselImages.length], adSlots.carousel!)
      : "";

    const sponsorHtml = sponsors.map((b) => `
      <div style="border:1px solid #e8ddf5;background:#faf7ff;border-radius:12px;padding:16px 18px;margin:0 0 14px">
        <p style="margin:0 0 6px;font-size:10px;letter-spacing:2px;color:#8B2FC9;font-weight:bold">SPONSORED</p>
        <p style="margin:0 0 4px;font-size:17px;font-weight:bold;color:#1a1a1a">${escapeHtml(b.eventName || b.venueName)}</p>
        <p style="margin:0;font-size:13.5px;color:#555">${escapeHtml([b.venueName, b.city, b.eventDate, b.eventTime].filter(Boolean).join(" · "))}</p>
        ${b.instagramHandle ? `<p style="margin:8px 0 0"><a href="${go(`https://instagram.com/${b.instagramHandle.replace(/^@/, "")}`)}" style="color:#8B2FC9;font-size:13.5px;font-weight:bold">See the event →</a></p>` : ""}
      </div>`).join("");

    const sections = regionOrder
      .filter((r) => (byRegion[r] || []).length > 0)
      .map((r) => `
        <h2 style="margin:28px 0 10px;font-size:14px;letter-spacing:2px;color:#8B2FC9;text-transform:uppercase">${r}</h2>
        ${(byRegion[r] || []).map(({ e, iso }) => `
          <div style="padding:10px 0;border-bottom:1px solid #f0ecf5">
            <p style="margin:0 0 2px;font-size:15.5px;font-weight:bold;color:#1a1a1a">
              ${e.ticketLink ? `<a href="${go(e.ticketLink, e.id)}" style="color:#1a1a1a;text-decoration:none">${escapeHtml(e.title)}</a>` : escapeHtml(e.title)}
            </p>
            <p style="margin:0;font-size:13px;color:#666">${escapeHtml([digestDateLabel(iso), e.eventTime, e.venue, e.city].filter(Boolean).join(" · "))}</p>
          </div>`).join("")}`).join("");

    const weekLabel = digestDateLabel(todayInET());
    const subject = `This Weekend in NJ — ${upcoming.length} events (${weekLabel})`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 28px 22px; background:#ffffff; color:#1a1a1a;">
        <img src="cid:cge-logo" alt="Central Group Events" width="120" style="display:block;width:120px;height:auto;margin:0 0 14px;border:0" />
        <h1 style="margin:0 0 6px;font-size:26px">This Weekend in NJ</h1>
        <p style="margin:0 0 22px;color:#666;font-size:14px">${upcoming.length} events across New Jersey over the next 7 days.</p>
        ${adTopHtml}
        ${sponsorHtml}
        ${adCarouselHtml}
        ${sections || '<p style="color:#666">The new list is loading — check <a href="https://centralgroupevents.com/things-to-do-in-nj" style="color:#8B2FC9">the live calendar</a>.</p>'}
        ${adBottomHtml}
        <p style="text-align:center;margin:30px 0 6px">
          <a href="https://centralgroupevents.com/things-to-do-in-nj" style="display:inline-block;padding:13px 30px;background:#8B2FC9;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14.5px">See the full list →</a>
        </p>
      </div>`;
    return { subject, html };
  }

  /** Cron hook: start Fridays at/after 1 PM ET; continue on later ticks
   *  until every active subscriber is covered for the week. */
  async function runWeeklyDigestTick(force = false): Promise<Record<string, unknown>> {
    if ((await storage.getSetting("digest.enabled")) !== "true") return { digest: "disabled" };
    const week = currentDigestWeek();
    if ((await storage.getSetting("digest.doneWeek")) === week) return { digest: "done for the week" };
    const started = (await storage.getSetting("digest.week")) === week;
    if (!started) {
      const isFriday = todayInET() === week;
      if (!force && !(isFriday && hourInET() >= 13)) return { digest: "waiting for Friday 1 PM ET" };
      await storage.setSetting("digest.week", week);
      await storage.setSetting("digest.cursor", "0");
      await storage.setSetting("digest.weekSponsors", "[]");
      await storage.setSetting("digest.blastId", "");
    }
    const data = await buildDigestData();
    const subs = (await storage.listActiveSubscribers()).sort((a, b) => a.id - b.id);
    let blastId = parseInt((await storage.getSetting("digest.blastId")) || "0", 10);
    if (!blastId) {
      blastId = await storage.createEmailBlast("weekly-digest", `This Weekend in NJ (${week})`, subs.length, null);
      await storage.setSetting("digest.blastId", String(blastId));
    }
    const cursor = parseInt((await storage.getSetting("digest.cursor")) || "0", 10);
    const batch = subs.filter((s) => s.id > cursor).slice(0, DIGEST_MAX_PER_TICK);
    let lastId = cursor;
    const reason = "You're receiving this because you subscribed to the weekly newsletter at centralgroupevents.com.";
    let sent = 0, failed = 0;
    for (const sub of batch) {
      const to = sub.email.toLowerCase().trim();
      try {
        const { cgeLogoAttachment, stripLogoImg } = await import("./btl-mailer");
        const logo = cgeLogoAttachment();
        const { subject, html } = buildDigestHtml(data, sub.region, sub.id);
        const wrapped = wrapEmailLinks(`${logo ? html : stripLogoImg(html)}${complianceFooter(to, reason, { dark: false })}`, blastId, to);
        await transporter.sendMail({
          from: `"Central Group Events" <${process.env.GMAIL_USER}>`,
          to,
          subject,
          html: appendTrackingPixel(wrapped, blastId, to),
          headers: listUnsubscribeHeaders(to),
          attachments: logo ? [logo] : undefined,
        });
        sent++;
      } catch (err) {
        failed++;
        console.error(`[digest] send to ${to} failed:`, err instanceof Error ? err.message.slice(0, 200) : err);
      }
      lastId = sub.id;
      await storage.setSetting("digest.cursor", String(sub.id));
      await new Promise((r) => setTimeout(r, 300));
    }
    const remaining = subs.filter((s) => s.id > lastId).length;
    if (remaining === 0) await storage.setSetting("digest.doneWeek", week);
    return { digest: { week, sent, failed, remaining } };
  }

  app.get("/api/admin/digest/status", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const subs = await storage.listActiveSubscribers();
      const data = await buildDigestData();
      res.json({
        enabled: (await storage.getSetting("digest.enabled")) === "true",
        sponsorSlots: parseInt((await storage.getSetting("digest.sponsorSlots")) || "2", 10),
        week: currentDigestWeek(),
        doneWeek: await storage.getSetting("digest.doneWeek"),
        cursor: await storage.getSetting("digest.cursor"),
        subscribers: subs.length,
        upcomingEvents: data.upcoming.length,
        sponsors: data.sponsors.map((b) => ({ id: b.id, name: b.eventName || b.venueName, eventDate: b.eventDate })),
        adSlotTop: data.adSlots.top,
        adSlotBottom: data.adSlots.bottom,
        adCarousel: data.adSlots.carousel,
      });
    } catch (err) {
      console.error("[digest/status]", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/admin/digest/settings", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { enabled, sponsorSlots, adSlotTop, adSlotBottom, adCarousel } = (req.body ?? {}) as {
        enabled?: boolean; sponsorSlots?: number;
        adSlotTop?: Record<string, unknown> | null;
        adSlotBottom?: Record<string, unknown> | null;
        adCarousel?: Record<string, unknown> | null;
      };
      if (typeof enabled === "boolean") await storage.setSetting("digest.enabled", enabled ? "true" : "false");
      if (typeof sponsorSlots === "number" && sponsorSlots >= 0 && sponsorSlots <= 5) {
        await storage.setSetting("digest.sponsorSlots", String(Math.floor(sponsorSlots)));
      }
      // Image slots: a null / imageless object clears the slot. Only string
      // fields are stored, capped so a bad payload can't bloat settings.
      const cleanSlot = (v: Record<string, unknown> | null | undefined): string => {
        if (!v || typeof v !== "object" || !String(v.imageUrl ?? "").trim()) return "";
        return JSON.stringify({
          imageUrl: String(v.imageUrl).trim().slice(0, 2000),
          linkUrl: String(v.linkUrl ?? "").trim().slice(0, 2000),
          alt: String(v.alt ?? "").trim().slice(0, 300),
          caption: String(v.caption ?? "").trim().slice(0, 500),
        });
      };
      if (adSlotTop !== undefined) await storage.setSetting("digest.adSlotTop", cleanSlot(adSlotTop));
      if (adSlotBottom !== undefined) await storage.setSetting("digest.adSlotBottom", cleanSlot(adSlotBottom));
      if (adCarousel !== undefined) {
        const images = Array.isArray(adCarousel?.images)
          ? (adCarousel!.images as unknown[]).map((s) => String(s).trim()).filter(Boolean).slice(0, 50)
          : [];
        await storage.setSetting("digest.adCarousel", images.length === 0 ? "" : JSON.stringify({
          images: images.map((s) => s.slice(0, 2000)),
          linkUrl: String(adCarousel?.linkUrl ?? "").trim().slice(0, 2000),
          alt: String(adCarousel?.alt ?? "").trim().slice(0, 300),
          caption: String(adCarousel?.caption ?? "").trim().slice(0, 500),
        }));
      }
      res.json({ saved: true });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/digest/preview", requireAuth(), async (req: Request, res: Response) => {
    try {
      const data = await buildDigestData();
      // seed rotates the carousel photo — preview with ?seed=1,2,… to see the cycle.
      const { subject, html } = buildDigestHtml(data, String(req.query.region || "") || null, Number(req.query.seed) || 0);
      // cid: images only resolve inside a sent email — swap for the served file.
      const previewHtml = html.replace("cid:cge-logo", `${req.protocol}://${req.get("host")}/cge-logo.png`);
      res.json({ subject, html: `${previewHtml}${complianceFooter("preview@example.com", "You're receiving this because you subscribed to the weekly newsletter at centralgroupevents.com.", { dark: false })}` });
    } catch (err) {
      console.error("[digest/preview]", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Force a tick now (skips the Friday-1PM gate, keeps the once-per-week
  // dedupe and the per-tick send cap — click again to continue a big list).
  app.post("/api/admin/digest/run-now", requireAuth(), async (_req: Request, res: Response) => {
    try {
      res.json(await runWeeklyDigestTick(true));
    } catch (err) {
      console.error("[digest/run-now]", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // One test email to the CGE inbox — the exact Friday product.
  app.post("/api/admin/digest/test", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const data = await buildDigestData();
      // Random seed so repeated test sends walk through the carousel photos.
      const { subject, html } = buildDigestHtml(data, null, Math.floor(Math.random() * 1000));
      const { cgeLogoAttachment, stripLogoImg } = await import("./btl-mailer");
      const logo = cgeLogoAttachment();
      const to = "centralgroupevents@gmail.com";
      await transporter.sendMail({
        from: `"Central Group Events" <${process.env.GMAIL_USER}>`,
        to,
        subject: `[TEST] ${subject}`,
        html: `${logo ? html : stripLogoImg(html)}${complianceFooter(to, "Test send of the weekly digest.", { dark: false })}`,
        attachments: logo ? [logo] : undefined,
      });
      res.json({ sent: true, to });
    } catch (err) {
      console.error("[digest/test]", err);
      const detail = err instanceof Error ? err.message.slice(0, 200) : "unknown";
      res.status(500).json({ message: `Test send failed: ${detail}` });
    }
  });

  app.get("/api/cron/scheduled-emails", async (req: Request, res: Response) => {
    try {
      const secret = (req.query.secret as string) || "";
      if (!process.env.CRON_SECRET) {
        return res.status(500).json({ message: "CRON_SECRET not configured" });
      }
      if (secret !== process.env.CRON_SECRET) return res.status(401).json({ message: "Unauthorized" });
      const result = await runScheduledEmailsTick();
      // Build to Last cadence rides the same tick — dedup makes it idempotent
      // however often the external cron fires.
      let btl: unknown[] = [];
      try {
        const { runBtlCadenceTick } = await import("./btl-cadence");
        btl = await runBtlCadenceTick();
      } catch (err) {
        console.error("[cron] btl cadence tick failed:", err);
      }
      // Weekly digest rides the hourly tick too — it gates itself to
      // Friday 1 PM ET and continues chunked sends on later ticks.
      let digest: unknown = null;
      try {
        digest = await runWeeklyDigestTick();
      } catch (err) {
        console.error("[cron] weekly digest tick failed:", err);
      }
      res.json({ ...result, btl, digest });
    } catch (err) {
      console.error("[cron/scheduled-emails] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: list all scheduled email rows (for the new Scheduled Emails tab).
  app.get("/api/admin/scheduled-emails", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const rows = await storage.listAllScheduledEmails(500);
      const dryRun = (await storage.getSetting("cronDryRun")) !== "false";
      res.json({ rows, dryRun });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: trigger the daily scheduler manually (same logic as the cron
  // tick, no need to remember the secret-protected URL).
  app.post("/api/admin/scheduled-emails/run-now", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const result = await runScheduledEmailsTick();
      res.json(result);
    } catch (err) {
      console.error("[scheduled-emails/run-now] error:", err);
      // Admin-only endpoint — include the real reason so the dashboard
      // toast says what actually broke instead of a generic 500.
      const detail = err instanceof Error ? err.message.slice(0, 300) : "unknown";
      res.status(500).json({ message: `Run failed: ${detail}` });
    }
  });

  // Admin: render a single scheduled row as the exact email that would
  // send. Used by the inline preview in the Email Schedule tab.
  app.get("/api/admin/scheduled-emails/:id/preview", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
      const row = await storage.getScheduledEmailRow(id);
      if (!row) return res.status(404).json({ message: "Row not found" });
      const bookings = await storage.getBookings();
      const booking = bookings.find((b) => b.id === row.bookingId);
      if (!booking) return res.status(404).json({ message: "Linked booking missing" });
      const dryRun = (await storage.getSetting("cronDryRun")) !== "false";
      const rendered = renderScheduledEmail(row, booking, dryRun);
      res.json({ ...rendered, kind: row.kind, recipient: row.recipientEmail, scheduledFor: row.scheduledFor, status: row.status, dryRun });
    } catch (err) {
      console.error("[scheduled-emails/preview] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: send a single pending scheduled row immediately. Marks sent
  // on success. Respects the dry-run toggle so testing stays safe.
  app.post("/api/admin/scheduled-emails/:id/send-now", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
      const row = await storage.getScheduledEmailRow(id);
      if (!row) return res.status(404).json({ message: "Row not found" });
      if (row.status !== "pending") return res.status(400).json({ message: `Row already ${row.status}` });
      const bookings = await storage.getBookings();
      const booking = bookings.find((b) => b.id === row.bookingId);
      if (!booking) {
        await storage.markScheduledEmailSent(id, "skipped", { error: "booking not found" });
        return res.status(404).json({ message: "Linked booking missing — marked skipped" });
      }
      const dryRun = (await storage.getSetting("cronDryRun")) !== "false";
      const { subject, html, to } = renderScheduledEmail(row, booking, dryRun);
      try {
        await transporter.sendMail({
          from: `"Central Group Events" <${process.env.GMAIL_USER}>`,
          to,
          subject,
          html,
        });
        await storage.markScheduledEmailSent(id, "sent", { dryRun });
        res.json({ sent: true, to, subject, dryRun });
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 500) : "unknown";
        await storage.markScheduledEmailSent(id, "failed", { error: msg, dryRun });
        res.status(500).json({ message: `Send failed: ${msg}`, dryRun });
      }
    } catch (err) {
      console.error("[scheduled-emails/send-now] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: flip the dry-run toggle.
  app.post("/api/admin/scheduled-emails/dry-run", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { enabled } = req.body as { enabled?: boolean };
      if (typeof enabled !== "boolean") return res.status(400).json({ message: "enabled must be boolean" });
      await storage.setSetting("cronDryRun", enabled ? "true" : "false");
      res.json({ dryRun: enabled });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Invoices ─────────────────────────────────────────────────────────
  // Admin-generated client invoices. The client-facing copy lives at
  // /invoice/:number?t=<hmac> — signed link, no login needed, printable.

  function invoiceMoney(cents: number): string {
    return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  }

  function invoicePublicUrl(invoiceNumber: string): string {
    return `${emailTrackingBase()}/invoice/${encodeURIComponent(invoiceNumber)}?t=${signToken(invoiceNumber)}`;
  }

  function computeInvoiceTotals(items: Array<{ quantity: number; unitPriceCents: number }>, discountCents: number, taxCents: number) {
    const subtotalCents = items.reduce((sum, it) => sum + it.quantity * it.unitPriceCents, 0);
    const totalCents = Math.max(0, subtotalCents - discountCents + taxCents);
    return { subtotalCents, totalCents };
  }

  function buildInvoiceEmail(inv: { invoiceNumber: string; clientName: string; eventName: string | null; items: string; discountCents: number; taxCents: number; totalCents: number; dueDate: string | null; notes: string | null; paymentInstructions: string | null }): { subject: string; html: string } {
    const items = JSON.parse(inv.items) as Array<{ description: string; quantity: number; unitPriceCents: number }>;
    const { subtotalCents } = computeInvoiceTotals(items, inv.discountCents, inv.taxCents);
    const firstName = (inv.clientName || "").trim().split(/\s+/)[0] || "there";
    const subject = `Invoice ${inv.invoiceNumber} from Central Group Events${inv.eventName ? ` — ${inv.eventName}` : ""}`;
    const rows = items.map((it) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;color:#222">${escapeHtml(it.description)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;color:#222;text-align:center">${it.quantity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;color:#222;text-align:right">${invoiceMoney(it.unitPriceCents)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eee;color:#222;text-align:right">${invoiceMoney(it.quantity * it.unitPriceCents)}</td>
      </tr>`).join("");
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; background:#ffffff; color:#111; padding: 32px; border:1px solid #e5e5e5; border-radius: 12px;">
        <table style="width:100%;margin-bottom:24px"><tr>
          <td><h1 style="color:#8B2FC9;font-size:22px;margin:0">Central Group Events</h1>
              <p style="color:#888;font-size:12px;margin:4px 0 0">NJ event promotion</p></td>
          <td style="text-align:right"><p style="font-size:18px;font-weight:bold;margin:0">INVOICE</p>
              <p style="color:#555;font-size:13px;margin:4px 0 0">${escapeHtml(inv.invoiceNumber)}</p>
              ${inv.dueDate ? `<p style="color:#555;font-size:13px;margin:2px 0 0">Due ${escapeHtml(inv.dueDate)}</p>` : ""}</td>
        </tr></table>
        <p style="font-size:14px;color:#333;margin:0 0 6px">Hi ${escapeHtml(firstName)},</p>
        <p style="font-size:14px;color:#333;margin:0 0 20px">Here's your invoice${inv.eventName ? ` for <strong>${escapeHtml(inv.eventName)}</strong>` : ""}. You can view and print it any time from the button below.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="background:#f7f2fb">
            <th style="padding:10px 8px;text-align:left;color:#555;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Description</th>
            <th style="padding:10px 8px;text-align:center;color:#555;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Qty</th>
            <th style="padding:10px 8px;text-align:right;color:#555;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Unit</th>
            <th style="padding:10px 8px;text-align:right;color:#555;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Amount</th>
          </tr>
          ${rows}
          <tr><td colspan="3" style="padding:10px 8px;text-align:right;color:#666">Subtotal</td><td style="padding:10px 8px;text-align:right;color:#222">${invoiceMoney(subtotalCents)}</td></tr>
          ${inv.discountCents ? `<tr><td colspan="3" style="padding:4px 8px;text-align:right;color:#666">Discount</td><td style="padding:4px 8px;text-align:right;color:#0a7d33">−${invoiceMoney(inv.discountCents)}</td></tr>` : ""}
          ${inv.taxCents ? `<tr><td colspan="3" style="padding:4px 8px;text-align:right;color:#666">Tax</td><td style="padding:4px 8px;text-align:right;color:#222">${invoiceMoney(inv.taxCents)}</td></tr>` : ""}
          <tr><td colspan="3" style="padding:12px 8px;text-align:right;font-weight:bold;color:#111;border-top:2px solid #111">Total due</td><td style="padding:12px 8px;text-align:right;font-weight:bold;font-size:16px;color:#111;border-top:2px solid #111">${invoiceMoney(inv.totalCents)}</td></tr>
        </table>
        ${inv.paymentInstructions ? `<div style="margin-top:20px;padding:14px;background:#f7f7f7;border-radius:8px"><p style="font-size:12px;color:#555;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px;font-weight:bold">How to pay</p><p style="font-size:13px;color:#333;margin:0;white-space:pre-wrap">${escapeHtml(inv.paymentInstructions)}</p></div>` : ""}
        ${inv.notes ? `<p style="font-size:13px;color:#555;margin:16px 0 0;white-space:pre-wrap">${escapeHtml(inv.notes)}</p>` : ""}
        <p style="text-align:center;margin:28px 0 8px">
          <a href="${invoicePublicUrl(inv.invoiceNumber)}" style="display:inline-block;padding:12px 28px;background:#8B2FC9;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px">View / print invoice</a>
        </p>
        <p style="color:#999;font-size:11px;text-align:center;margin:16px 0 0">Questions? Just reply to this email.<br/>Central Group Events · ${postalAddress()}</p>
      </div>`;
    return { subject, html };
  }

  app.get("/api/admin/invoices", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const rows = await storage.listInvoices();
      // Ship the signed public URL so the admin UI can open/print any invoice.
      res.json(rows.map((r) => ({ ...r, publicUrl: invoicePublicUrl(r.invoiceNumber) })));
    } catch (err) {
      console.error("[invoices] list error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/invoices", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { invoiceInputSchema } = await import("@shared/schema");
      const input = invoiceInputSchema.parse(req.body);
      const { totalCents } = computeInvoiceTotals(input.items, input.discountCents, input.taxCents);
      const invoiceNumber = await storage.nextInvoiceNumber(new Date().getFullYear());
      const created = await storage.createInvoice({
        invoiceNumber,
        bookingId: input.bookingId ?? null,
        clientName: input.clientName.trim(),
        clientEmail: input.clientEmail.toLowerCase().trim(),
        clientPhone: input.clientPhone?.trim() || null,
        eventName: input.eventName?.trim() || null,
        items: JSON.stringify(input.items),
        discountCents: input.discountCents,
        taxCents: input.taxCents,
        totalCents,
        notes: input.notes?.trim() || null,
        paymentInstructions: input.paymentInstructions?.trim() || null,
        status: "draft",
        dueDate: input.dueDate || null,
      });
      res.status(201).json({ ...created, publicUrl: invoicePublicUrl(created.invoiceNumber) });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      console.error("[invoices] create error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/admin/invoices/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
      const existing = await storage.getInvoice(id);
      if (!existing) return res.status(404).json({ message: "Invoice not found" });
      if (existing.status === "paid") return res.status(400).json({ message: "Paid invoices can't be edited — void it and issue a new one." });
      const { invoiceInputSchema } = await import("@shared/schema");
      const input = invoiceInputSchema.parse(req.body);
      const { totalCents } = computeInvoiceTotals(input.items, input.discountCents, input.taxCents);
      const updated = await storage.updateInvoice(id, {
        bookingId: input.bookingId ?? null,
        clientName: input.clientName.trim(),
        clientEmail: input.clientEmail.toLowerCase().trim(),
        clientPhone: input.clientPhone?.trim() || null,
        eventName: input.eventName?.trim() || null,
        items: JSON.stringify(input.items),
        discountCents: input.discountCents,
        taxCents: input.taxCents,
        totalCents,
        notes: input.notes?.trim() || null,
        paymentInstructions: input.paymentInstructions?.trim() || null,
        dueDate: input.dueDate || null,
      });
      res.json({ ...updated, publicUrl: invoicePublicUrl(existing.invoiceNumber) });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      console.error("[invoices] update error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/invoices/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
      const ok = await storage.deleteInvoice(id);
      if (!ok) return res.status(404).json({ message: "Invoice not found" });
      res.json({ deleted: true });
    } catch (err) {
      console.error("[invoices] delete error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Email the invoice to the client and flip draft → sent. Transactional
  // email (it's about their purchase), so no marketing footer required —
  // the postal address + reply contact are included anyway.
  app.post("/api/admin/invoices/:id/send", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
      const inv = await storage.getInvoice(id);
      if (!inv) return res.status(404).json({ message: "Invoice not found" });
      if (inv.status === "void") return res.status(400).json({ message: "This invoice is void." });
      const { subject, html } = buildInvoiceEmail(inv);
      await transporter.sendMail({
        from: `"Central Group Events" <${process.env.GMAIL_USER}>`,
        to: inv.clientEmail,
        bcc: "centralgroupevents@gmail.com",
        subject,
        html,
      });
      const updated = await storage.updateInvoice(id, {
        status: inv.status === "paid" ? "paid" : "sent",
        sentAt: new Date(),
      });
      res.json({ ...updated, publicUrl: invoicePublicUrl(inv.invoiceNumber) });
    } catch (err) {
      console.error("[invoices] send error:", err);
      const detail = err instanceof Error ? err.message.slice(0, 300) : "unknown";
      res.status(500).json({ message: `Send failed: ${detail}` });
    }
  });

  app.post("/api/admin/invoices/:id/status", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { status } = req.body as { status?: string };
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
      if (!status || !["draft", "sent", "paid", "void"].includes(status)) {
        return res.status(400).json({ message: "status must be draft | sent | paid | void" });
      }
      const inv = await storage.getInvoice(id);
      if (!inv) return res.status(404).json({ message: "Invoice not found" });
      const updated = await storage.updateInvoice(id, {
        status,
        paidAt: status === "paid" ? new Date() : null,
      });
      res.json({ ...updated, publicUrl: invoicePublicUrl(inv.invoiceNumber) });
    } catch (err) {
      console.error("[invoices] status error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Public, signed-link invoice fetch for the client-facing /invoice page.
  // The HMAC token proves the link came from us; no login required.
  app.get("/api/invoices/:number", async (req: Request, res: Response) => {
    try {
      const number = String(req.params.number || "");
      const token = String(req.query.t || "");
      if (!number || !verifySignedToken(number, token)) {
        return res.status(403).json({ message: "Invalid invoice link" });
      }
      const inv = await storage.getInvoiceByNumber(number);
      if (!inv || inv.status === "void") return res.status(404).json({ message: "Invoice not found" });
      const items = JSON.parse(inv.items) as Array<{ description: string; quantity: number; unitPriceCents: number }>;
      const { subtotalCents } = computeInvoiceTotals(items, inv.discountCents, inv.taxCents);
      res.json({
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.clientName,
        clientEmail: inv.clientEmail,
        eventName: inv.eventName,
        items,
        subtotalCents,
        discountCents: inv.discountCents,
        taxCents: inv.taxCents,
        totalCents: inv.totalCents,
        notes: inv.notes,
        paymentInstructions: inv.paymentInstructions,
        status: inv.status,
        dueDate: inv.dueDate,
        createdAt: inv.createdAt,
        paidAt: inv.paidAt,
      });
    } catch (err) {
      console.error("[invoices] public fetch error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Standalone reminders ────────────────────────────────────────────
  app.get("/api/admin/reminders", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const rows = await storage.listReminders(200);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/reminders", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { title, body, sendAt, recipientEmails, tag } = req.body as {
        title?: string; body?: string; sendAt?: string; recipientEmails?: string; tag?: string;
      };
      if (!title || typeof title !== "string" || !title.trim()) return res.status(400).json({ message: "title is required" });
      if (!sendAt || typeof sendAt !== "string") return res.status(400).json({ message: "sendAt (ISO datetime) is required" });
      const dt = new Date(sendAt);
      if (isNaN(dt.getTime())) return res.status(400).json({ message: "sendAt is not a valid datetime" });
      const recips = (recipientEmails || "centralgroupevents@gmail.com").trim();
      if (!recips) return res.status(400).json({ message: "recipientEmails required" });
      const created = await storage.createReminder({
        title: title.trim(),
        body: body && body.trim() ? body.trim() : null,
        sendAt: dt,
        recipientEmails: recips,
        tag: tag && tag.trim() ? tag.trim() : null,
      });
      res.status(201).json(created);
    } catch (err) {
      console.error("[reminders/create] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/reminders/:id/cancel", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
      const r = await storage.getReminder(id);
      if (!r) return res.status(404).json({ message: "Reminder not found" });
      if (r.status !== "pending") return res.status(400).json({ message: `Already ${r.status}` });
      await storage.markReminderSent(id, "cancelled");
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/reminders/:id/send-now", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
      const r = await storage.getReminder(id);
      if (!r) return res.status(404).json({ message: "Reminder not found" });
      if (r.status !== "pending") return res.status(400).json({ message: `Already ${r.status}` });
      const dryRun = (await storage.getSetting("cronDryRun")) !== "false";
      const recipients = r.recipientEmails.split(",").map((s) => s.trim()).filter(Boolean);
      const subject = dryRun ? `[TEST] Reminder: ${r.title}` : `Reminder: ${r.title}`;
      const baseHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #0a0a0a; color: #fff; border-radius: 12px; line-height: 1.6;">
          <p style="color:#8B2FC9;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:bold;margin:0 0 8px">Reminder</p>
          <h2 style="margin:0 0 16px;font-size:22px;color:#fff">${escapeHtml(r.title)}</h2>
          ${r.body ? `<div style="color:#ddd;font-size:15px;white-space:pre-wrap;margin:0 0 18px">${escapeHtml(r.body)}</div>` : ""}
          <p style="color:#888;font-size:12px;margin-top:24px;border-top:1px solid #222;padding-top:12px">Sent manually from Central Group Events admin.</p>
        </div>`;
      const html = dryRun
        ? `<div style="background:#fff3cd;border:1px solid #ffeaa7;padding:12px;margin-bottom:16px;color:#5b4a00;font-family:Arial,sans-serif;font-size:13px"><strong>[DRY RUN]</strong> Would have sent to: <code>${escapeHtml(r.recipientEmails)}</code></div>${baseHtml}`
        : baseHtml;
      const to = dryRun ? "centralgroupevents@gmail.com" : recipients.join(",");
      try {
        await transporter.sendMail({
          from: `"Central Group Events" <${process.env.GMAIL_USER}>`,
          to,
          subject,
          html,
        });
        await storage.markReminderSent(id, "sent");
        res.json({ sent: true, to, dryRun });
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 500) : "unknown";
        await storage.markReminderSent(id, "failed", { error: msg });
        res.status(500).json({ message: `Send failed: ${msg}`, dryRun });
      }
    } catch (err) {
      console.error("[reminders/send-now] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/reminders/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
      const ok = await storage.deleteReminder(id);
      if (!ok) return res.status(404).json({ message: "Reminder not found" });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── World Cup watch party submissions ────────────────────────────────────
  app.post("/api/world-cup-submissions", formLimiter, async (req: Request, res: Response) => {
    try {
      const { insertWorldCupSubmissionSchema } = await import("@shared/schema");
      const { getMatchBySlot } = await import("@shared/world-cup-schedule");
      const parsed = insertWorldCupSubmissionSchema.parse(req.body);
      if (!getMatchBySlot(parsed.matchSlot)) {
        return res.status(400).json({ message: "Unknown match slot" });
      }
      const created = await storage.createWorldCupSubmission(parsed);

      // Subscribe the submitter only if they ticked the opt-in box on the
      // form (non-blocking, ON CONFLICT DO NOTHING).
      if (req.body.newsletterOptIn === true) {
        storage.upsertSubscriber(
          parsed.submitterEmail.toLowerCase().trim(),
          "world-cup-watch-party",
        ).catch(() => {});
      }

      // Auto-reply to submitter
      transporter.sendMail({
        from: `"CGE Watch Parties" <${process.env.GMAIL_USER}>`,
        to: parsed.submitterEmail,
        subject: `Watch party submission received — ${parsed.venueName}`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px">
            <h2 style="color:#9333ea">Thanks — we got your submission.</h2>
            <p>We're reviewing your World Cup 2026 watch party at <strong>${escapeHtml(parsed.venueName)}</strong> in <strong>${escapeHtml(parsed.town)}</strong>.</p>
            <p>Once approved (usually within 24-48 hours), it goes live at <a href="https://centralgroupevents.com/world-cup-2026-nj-watch-parties">centralgroupevents.com/world-cup-2026-nj-watch-parties</a> and you'll get a confirmation email.</p>
            <p style="color:#777;font-size:13px">Questions? Reply to this email.</p>
            <p style="color:#777;font-size:12px;margin-top:32px">— Central Group Events</p>
          </div>`,
      }).catch(() => {});

      // Admin alert
      transporter.sendMail({
        from: `"CGE Website" <${process.env.GMAIL_USER}>`,
        to: "centralgroupevents@gmail.com",
        subject: `⚽ New watch party submission: ${parsed.venueName}, ${parsed.town}`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif">
            <h2>New watch party submission</h2>
            <table style="border-collapse:collapse;font-size:14px">
              <tr><td style="padding:4px 12px;color:#555">Venue</td><td>${escapeHtml(parsed.venueName)}</td></tr>
              <tr><td style="padding:4px 12px;color:#555">Town</td><td>${escapeHtml(parsed.town)}</td></tr>
              <tr><td style="padding:4px 12px;color:#555">Match</td><td>${escapeHtml(parsed.matchSlot)}</td></tr>
              <tr><td style="padding:4px 12px;color:#555">Date</td><td>${escapeHtml(parsed.matchDate)}</td></tr>
              <tr><td style="padding:4px 12px;color:#555">Event name</td><td>${escapeHtml(parsed.eventName || "(none)")}</td></tr>
              <tr><td style="padding:4px 12px;color:#555">Instagram</td><td>${escapeHtml(parsed.instagramHandle || "(none)")}</td></tr>
              <tr><td style="padding:4px 12px;color:#555">Submitter</td><td>${escapeHtml(parsed.submitterEmail)}</td></tr>
            </table>
            <p><a href="https://centralgroupevents.com/admin">Review in admin →</a></p>
          </div>`,
      }).catch(() => {});

      res.status(201).json({ id: created.id, status: created.status });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid submission" });
      }
      console.error("[world-cup-submissions] create error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Public: list approved watch parties (optionally filter by week)
  app.get("/api/world-cup-submissions/approved", async (req: Request, res: Response) => {
    try {
      const weekRaw = req.query.week;
      const week = typeof weekRaw === "string" ? parseInt(weekRaw, 10) : undefined;
      const weekIndex = Number.isFinite(week as number) ? (week as number) : undefined;
      const rows = await storage.getApprovedWorldCupSubmissions(weekIndex);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: list all (with optional status filter)
  app.get("/api/admin/world-cup-submissions", requireAuth(), async (req: Request, res: Response) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const rows = await storage.listWorldCupSubmissions({ status });
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: approve / reject / set adminNotes
  app.patch("/api/admin/world-cup-submissions/:id/status", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const { status, adminNotes } = req.body as { status?: string; adminNotes?: string };
      if (!status || !["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "status must be one of pending/approved/rejected" });
      }
      const updated = await storage.updateWorldCupSubmissionStatus(id, status, adminNotes);
      if (!updated) return res.status(404).json({ message: "Not found" });

      // Notify submitter on approval
      if (status === "approved" && updated.submitterEmail) {
        transporter.sendMail({
          from: `"CGE Watch Parties" <${process.env.GMAIL_USER}>`,
          to: updated.submitterEmail,
          subject: `🟢 Your World Cup watch party is live — ${updated.venueName}`,
          html: `
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px">
              <h2 style="color:#9333ea">You're live!</h2>
              <p>Your World Cup 2026 watch party at <strong>${escapeHtml(updated.venueName)}</strong> in <strong>${escapeHtml(updated.town)}</strong> has been approved.</p>
              <p>It's now visible at: <a href="https://centralgroupevents.com/world-cup-2026-nj-watch-parties">centralgroupevents.com/world-cup-2026-nj-watch-parties</a></p>
              <p style="color:#777;font-size:13px">Share the link with your audience. See you at the match.</p>
              <p style="color:#777;font-size:12px;margin-top:32px">— Central Group Events</p>
            </div>`,
        }).catch(() => {});
      }

      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: edit submission fields (used when a row comes in with off details).
  // Re-derives weekIndex if matchDate changes.
  app.patch("/api/admin/world-cup-submissions/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const { getWeekIndexForDate } = await import("@shared/world-cup-schedule");
      const body = req.body as Record<string, any>;
      const allowed: Record<string, unknown> = {};
      const STRING_FIELDS = ["venueName", "town", "matchDate", "matchSlot", "matchLabel", "eventName", "instagramHandle", "learnMoreUrl", "adminNotes", "region"];
      for (const k of STRING_FIELDS) {
        if (k in body) {
          const v = body[k];
          allowed[k] = v == null || v === "" ? null : String(v).slice(0, 500);
        }
      }
      // Required-field guards (only when fields are present in the patch)
      if ("venueName" in allowed && !allowed.venueName) return res.status(400).json({ message: "venueName cannot be empty" });
      if ("town" in allowed && !allowed.town) return res.status(400).json({ message: "town cannot be empty" });
      if ("matchDate" in allowed && allowed.matchDate) {
        const md = String(allowed.matchDate);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(md)) return res.status(400).json({ message: "matchDate must be YYYY-MM-DD" });
        const wk = getWeekIndexForDate(md);
        if (!wk) return res.status(400).json({ message: `matchDate ${md} is outside the 2026 World Cup tournament window` });
        allowed.weekIndex = wk;
      }
      // URL normalize
      if ("learnMoreUrl" in allowed) {
        allowed.learnMoreUrl = normalizeUrl(allowed.learnMoreUrl as string | null);
      }
      const updated = await storage.updateWorldCupSubmissionFields(id, allowed as any);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err) {
      console.error("[wc-edit] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: bulk-import watch parties from an uploaded CSV/Excel.
  // Each row is auto-approved (admin is the source of truth).
  app.post("/api/admin/world-cup-submissions/bulk", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { adminBulkWorldCupRowSchema } = await import("@shared/schema");
      const { getWeekIndexForDate } = await import("@shared/world-cup-schedule");
      const raw = req.body as unknown[];
      if (!Array.isArray(raw)) return res.status(400).json({ message: "Expected an array of rows" });
      const valid: any[] = [];
      const invalid: { rowIndex: number; reason: string }[] = [];
      for (let i = 0; i < raw.length; i++) {
        try {
          const parsed = adminBulkWorldCupRowSchema.parse(raw[i]);
          if (!parsed.matchSlot && !parsed.matchLabel) {
            invalid.push({ rowIndex: i, reason: "Row needs either Match (matchLabel) or matchSlot" });
            continue;
          }
          const normalizedDate = parseFlexibleWcDate(parsed.matchDate);
          if (!normalizedDate) {
            invalid.push({ rowIndex: i, reason: `Could not parse date "${parsed.matchDate}". Use YYYY-MM-DD, MM/DD/YYYY, "Jun 11, 2026", or a range like "Jun 11 – Jul 19, 2026".` });
            continue;
          }
          const weekIndex = parsed.weekIndex ?? getWeekIndexForDate(normalizedDate);
          if (!weekIndex) {
            invalid.push({ rowIndex: i, reason: `Date ${normalizedDate} is outside the 2026 World Cup tournament window (Jun 11 – Jul 19, 2026)` });
            continue;
          }
          valid.push({
            weekIndex,
            matchDate: normalizedDate,
            matchSlot: parsed.matchSlot || null,
            matchLabel: parsed.matchLabel || null,
            venueName: parsed.venueName,
            town: parsed.town,
            eventName: parsed.eventName || null,
            instagramHandle: parsed.instagramHandle || null,
            learnMoreUrl: normalizeUrl(parsed.learnMoreUrl),
            submitterEmail: "centralgroupevents@gmail.com",
            status: "approved",
            source: "admin-import",
            reviewedAt: new Date(),
          });
        } catch (err) {
          const reason = err instanceof z.ZodError ? err.errors[0]?.message || "Validation failed" : "Unknown error";
          invalid.push({ rowIndex: i, reason });
        }
      }
      let imported = 0;
      for (const row of valid) {
        await storage.createWorldCupSubmissionRaw(row);
        imported++;
      }
      res.json({ imported, invalid });
    } catch (err) {
      console.error("[wc-bulk] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: bulk status update on World Cup submissions (multi-select approve/reject/reopen).
  app.post("/api/admin/world-cup-submissions/bulk-status", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { ids, status } = req.body as { ids?: unknown; status?: string };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids[] required" });
      if (!status || !["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "status must be pending/approved/rejected" });
      }
      const numIds = ids.map((id) => Number(id)).filter((n) => Number.isInteger(n));
      const updated = await storage.bulkUpdateWorldCupSubmissionStatus(numIds, status);
      res.json({ updated });
    } catch (err) {
      console.error("[wc-bulk-status] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: bulk delete World Cup submissions (multi-select).
  app.post("/api/admin/world-cup-submissions/bulk-delete", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { ids } = req.body as { ids?: unknown };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids[] required" });
      const numIds = ids.map((id) => Number(id)).filter((n) => Number.isInteger(n));
      const deleted = await storage.bulkDeleteWorldCupSubmissions(numIds);
      res.json({ deleted });
    } catch (err) {
      console.error("[wc-bulk-delete] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: bulk-edit shared fields across selected submissions.
  // Body: { ids: number[], fields: { region?, eventName?, ... } }. NULL clears, missing key = no change.
  app.post("/api/admin/world-cup-submissions/bulk-edit", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { ids, fields } = req.body as { ids?: unknown; fields?: Record<string, any> };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids[] required" });
      if (!fields || typeof fields !== "object") return res.status(400).json({ message: "fields object required" });
      const numIds = ids.map((id) => Number(id)).filter((n) => Number.isInteger(n));
      const ALLOWED = ["region", "eventName", "instagramHandle", "learnMoreUrl", "adminNotes"];
      const clean: Record<string, unknown> = {};
      for (const k of ALLOWED) {
        if (k in fields) {
          const v = fields[k];
          clean[k] = v == null || v === "" ? null : String(v).slice(0, 500);
        }
      }
      if ("learnMoreUrl" in clean) clean.learnMoreUrl = normalizeUrl(clean.learnMoreUrl as string | null);
      const updated = await storage.bulkEditWorldCupSubmissions(numIds, clean as any);
      res.json({ updated });
    } catch (err) {
      console.error("[wc-bulk-edit] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── NBA Finals 2026 watch party submissions ──────────────────────────────
  app.post("/api/nba-finals-submissions", formLimiter, async (req: Request, res: Response) => {
    try {
      const { insertNbaFinalsSubmissionSchema } = await import("@shared/schema");
      const { getNbaGameByNumber } = await import("@shared/nba-finals-schedule");
      const parsed = insertNbaFinalsSubmissionSchema.parse(req.body);
      if (!getNbaGameByNumber(parsed.gameNumber)) {
        return res.status(400).json({ message: "Unknown game number" });
      }
      const cleaned = { ...parsed, learnMoreUrl: normalizeUrl(parsed.learnMoreUrl) };
      const created = await storage.createNbaFinalsSubmission(cleaned);

      if (req.body.newsletterOptIn === true) {
        storage.upsertSubscriber(
          parsed.submitterEmail.toLowerCase().trim(),
          "nba-finals-watch-party",
        ).catch(() => {});
      }

      transporter.sendMail({
        from: `"CGE Watch Parties" <${process.env.GMAIL_USER}>`,
        to: parsed.submitterEmail,
        subject: `Watch party submission received — ${parsed.venueName}`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px">
            <h2 style="color:#9333ea">Thanks — we got your submission.</h2>
            <p>We're reviewing your NBA Finals Game ${parsed.gameNumber} watch party at <strong>${escapeHtml(parsed.venueName)}</strong> in <strong>${escapeHtml(parsed.town)}</strong>.</p>
            <p>Once approved (usually within 24-48 hours), it goes live at <a href="https://centralgroupevents.com/nba-finals-2026-nj-watch-parties">centralgroupevents.com/nba-finals-2026-nj-watch-parties</a> and you'll get a confirmation email.</p>
            <p style="color:#777;font-size:12px;margin-top:32px">— Central Group Events</p>
          </div>`,
      }).catch(() => {});

      transporter.sendMail({
        from: `"CGE Website" <${process.env.GMAIL_USER}>`,
        to: "centralgroupevents@gmail.com",
        subject: `🏀 NBA Finals watch party submission: ${parsed.venueName}, ${parsed.town} (Game ${parsed.gameNumber})`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif">
            <h2>New NBA Finals watch party submission</h2>
            <table style="border-collapse:collapse;font-size:14px">
              <tr><td style="padding:4px 12px;color:#555">Venue</td><td>${escapeHtml(parsed.venueName)}</td></tr>
              <tr><td style="padding:4px 12px;color:#555">Town</td><td>${escapeHtml(parsed.town)}</td></tr>
              <tr><td style="padding:4px 12px;color:#555">Game</td><td>Game ${parsed.gameNumber}</td></tr>
              <tr><td style="padding:4px 12px;color:#555">Date</td><td>${escapeHtml(parsed.gameDate)}</td></tr>
              <tr><td style="padding:4px 12px;color:#555">Event name</td><td>${escapeHtml(parsed.eventName || "(none)")}</td></tr>
              <tr><td style="padding:4px 12px;color:#555">Instagram</td><td>${escapeHtml(parsed.instagramHandle || "(none)")}</td></tr>
              <tr><td style="padding:4px 12px;color:#555">Submitter</td><td>${escapeHtml(parsed.submitterEmail)}</td></tr>
            </table>
            <p><a href="https://centralgroupevents.com/admin">Review in admin →</a></p>
          </div>`,
      }).catch(() => {});

      res.status(201).json({ id: created.id, status: created.status });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid submission" });
      }
      console.error("[nba-submissions] create error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/nba-finals-submissions/approved", async (req: Request, res: Response) => {
    try {
      const gameRaw = req.query.game;
      const game = typeof gameRaw === "string" ? parseInt(gameRaw, 10) : undefined;
      const gameNumber = Number.isFinite(game as number) ? (game as number) : undefined;
      const rows = await storage.getApprovedNbaFinalsSubmissions(gameNumber);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/nba-finals-submissions", requireAuth(), async (req: Request, res: Response) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const rows = await storage.listNbaFinalsSubmissions({ status });
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/nba-finals-submissions/:id/status", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const { status, adminNotes } = req.body as { status?: string; adminNotes?: string };
      if (!status || !["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "status must be pending/approved/rejected" });
      }
      const updated = await storage.updateNbaFinalsSubmissionStatus(id, status, adminNotes);
      if (!updated) return res.status(404).json({ message: "Not found" });

      if (status === "approved" && updated.submitterEmail) {
        transporter.sendMail({
          from: `"CGE Watch Parties" <${process.env.GMAIL_USER}>`,
          to: updated.submitterEmail,
          subject: `🟢 Your NBA Finals watch party is live — ${updated.venueName}`,
          html: `
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px">
              <h2 style="color:#9333ea">You're live!</h2>
              <p>Your NBA Finals Game ${updated.gameNumber} watch party at <strong>${escapeHtml(updated.venueName)}</strong> in <strong>${escapeHtml(updated.town)}</strong> has been approved.</p>
              <p>It's now visible at: <a href="https://centralgroupevents.com/nba-finals-2026-nj-watch-parties">centralgroupevents.com/nba-finals-2026-nj-watch-parties</a></p>
              <p style="color:#777;font-size:12px;margin-top:32px">— Central Group Events</p>
            </div>`,
        }).catch(() => {});
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/nba-finals-submissions/:id", requireAuth(), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const { getNbaGameNumberForDate } = await import("@shared/nba-finals-schedule");
      const body = req.body as Record<string, any>;
      const allowed: Record<string, unknown> = {};
      const STRING_FIELDS = ["venueName", "town", "gameDate", "eventName", "instagramHandle", "learnMoreUrl", "adminNotes", "region"];
      for (const k of STRING_FIELDS) {
        if (k in body) {
          const v = body[k];
          allowed[k] = v == null || v === "" ? null : String(v).slice(0, 500);
        }
      }
      if ("venueName" in allowed && !allowed.venueName) return res.status(400).json({ message: "venueName cannot be empty" });
      if ("town" in allowed && !allowed.town) return res.status(400).json({ message: "town cannot be empty" });
      if ("gameDate" in allowed && allowed.gameDate) {
        const gd = String(allowed.gameDate);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(gd)) return res.status(400).json({ message: "gameDate must be YYYY-MM-DD" });
        const gn = getNbaGameNumberForDate(gd);
        if (!gn) return res.status(400).json({ message: `${gd} doesn't match any scheduled NBA Finals game date` });
        allowed.gameNumber = gn;
      }
      if ("learnMoreUrl" in allowed) {
        allowed.learnMoreUrl = normalizeUrl(allowed.learnMoreUrl as string | null);
      }
      const updated = await storage.updateNbaFinalsSubmissionFields(id, allowed as any);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err) {
      console.error("[nba-edit] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/nba-finals-submissions/bulk", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { adminBulkNbaFinalsRowSchema } = await import("@shared/schema");
      const { getNbaGameNumberForDate } = await import("@shared/nba-finals-schedule");
      const raw = req.body as unknown[];
      if (!Array.isArray(raw)) return res.status(400).json({ message: "Expected an array of rows" });
      const valid: any[] = [];
      const invalid: { rowIndex: number; reason: string }[] = [];
      for (let i = 0; i < raw.length; i++) {
        try {
          const parsed = adminBulkNbaFinalsRowSchema.parse(raw[i]);
          const normalizedDate = parseFlexibleWcDate(parsed.gameDate);
          if (!normalizedDate) {
            invalid.push({ rowIndex: i, reason: `Could not parse date "${parsed.gameDate}".` });
            continue;
          }
          const gameNumber = parsed.gameNumber ?? getNbaGameNumberForDate(normalizedDate);
          if (!gameNumber) {
            invalid.push({ rowIndex: i, reason: `Date ${normalizedDate} doesn't match a scheduled NBA Finals game date. Pass an explicit gameNumber to override.` });
            continue;
          }
          valid.push({
            gameNumber,
            gameDate: normalizedDate,
            venueName: parsed.venueName,
            town: parsed.town,
            eventName: parsed.eventName || null,
            instagramHandle: parsed.instagramHandle || null,
            learnMoreUrl: normalizeUrl(parsed.learnMoreUrl ?? null),
            submitterEmail: "centralgroupevents@gmail.com",
            status: "approved",
            source: "admin-import",
            reviewedAt: new Date(),
          });
        } catch (err) {
          const reason = err instanceof z.ZodError ? err.errors[0]?.message || "Validation failed" : "Unknown error";
          invalid.push({ rowIndex: i, reason });
        }
      }
      let imported = 0;
      for (const row of valid) {
        await storage.createNbaFinalsSubmissionRaw(row);
        imported++;
      }
      res.json({ imported, invalid });
    } catch (err) {
      console.error("[nba-bulk] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/nba-finals-submissions/bulk-status", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { ids, status } = req.body as { ids?: unknown; status?: string };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids[] required" });
      if (!status || !["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "status must be pending/approved/rejected" });
      }
      const numIds = ids.map((id) => Number(id)).filter((n) => Number.isInteger(n));
      const updated = await storage.bulkUpdateNbaFinalsSubmissionStatus(numIds, status);
      res.json({ updated });
    } catch (err) {
      console.error("[nba-bulk-status] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/nba-finals-submissions/bulk-delete", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { ids } = req.body as { ids?: unknown };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids[] required" });
      const numIds = ids.map((id) => Number(id)).filter((n) => Number.isInteger(n));
      const deleted = await storage.bulkDeleteNbaFinalsSubmissions(numIds);
      res.json({ deleted });
    } catch (err) {
      console.error("[nba-bulk-delete] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/nba-finals-submissions/bulk-edit", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { ids, fields } = req.body as { ids?: unknown; fields?: Record<string, any> };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids[] required" });
      if (!fields || typeof fields !== "object") return res.status(400).json({ message: "fields object required" });
      const numIds = ids.map((id) => Number(id)).filter((n) => Number.isInteger(n));
      const ALLOWED = ["region", "eventName", "instagramHandle", "learnMoreUrl", "adminNotes"];
      const clean: Record<string, unknown> = {};
      for (const k of ALLOWED) {
        if (k in fields) {
          const v = fields[k];
          clean[k] = v == null || v === "" ? null : String(v).slice(0, 500);
        }
      }
      if ("learnMoreUrl" in clean) clean.learnMoreUrl = normalizeUrl(clean.learnMoreUrl as string | null);
      const updated = await storage.bulkEditNbaFinalsSubmissions(numIds, clean as any);
      res.json({ updated });
    } catch (err) {
      console.error("[nba-bulk-edit] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Cron-triggered email digests (called by external scheduler) ─────
  function checkCronAuth(req: Request, res: Response): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      res.status(500).json({ message: "CRON_SECRET not configured" });
      return false;
    }
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (token !== secret) {
      res.status(401).json({ message: "Unauthorized" });
      return false;
    }
    return true;
  }

  app.post("/api/cron/daily-stuck-leads", async (req: Request, res: Response) => {
    if (!checkCronAuth(req, res)) return;
    try {
      const stuck = await storage.getStuckBookings(24);
      if (stuck.length === 0) {
        return res.json({ sent: false, reason: "no stuck leads" });
      }
      const rows = stuck.map((b) => {
        const lastChange = b.contactedAt ?? b.createdAt;
        const hoursStuck = lastChange ? Math.floor((Date.now() - new Date(lastChange).getTime()) / (60 * 60 * 1000)) : 0;
        const days = Math.floor(hoursStuck / 24);
        const hours = hoursStuck % 24;
        const ageLabel = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
        return `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(b.contactName || "—")}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(b.email)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(b.mode || "Standard")}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(b.status || "New")}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#c2410c;font-weight:600">${ageLabel}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(b.eventName || "—")}</td>
          </tr>`;
      }).join("");
      await transporter.sendMail({
        from: `"CGE Website" <${process.env.GMAIL_USER}>`,
        to: "centralgroupevents@gmail.com",
        subject: `⏰ ${stuck.length} lead${stuck.length !== 1 ? "s" : ""} need follow-up`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px">
            <h2 style="margin:0 0 8px">Stuck leads — ${stuck.length}</h2>
            <p style="color:#555;margin:0 0 20px">These bookings are <strong>New</strong> or <strong>Contacted</strong> and haven't had a status change in over 24 hours.</p>
            <table style="border-collapse:collapse;width:100%;font-size:14px">
              <thead>
                <tr style="background:#f5f5f5;text-align:left">
                  <th style="padding:8px 12px">Contact</th>
                  <th style="padding:8px 12px">Email</th>
                  <th style="padding:8px 12px">Package</th>
                  <th style="padding:8px 12px">Status</th>
                  <th style="padding:8px 12px">Stuck</th>
                  <th style="padding:8px 12px">Event</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <p style="margin-top:24px"><a href="https://centralgroupevents.com/admin" style="color:#9333ea;font-weight:600">Open admin dashboard →</a></p>
          </div>`,
      });
      res.json({ sent: true, count: stuck.length });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/cron/weekly-events-digest", async (req: Request, res: Response) => {
    if (!checkCronAuth(req, res)) return;
    try {
      const all = await storage.getEvents(undefined, false);
      const now = new Date();
      const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const upcoming = all
        .filter((e) => {
          if (!e.date) return false;
          const d = new Date(e.date + "T00:00:00");
          return d >= new Date(now.toISOString().slice(0, 10) + "T00:00:00") && d <= horizon;
        })
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

      const subject = upcoming.length === 0
        ? `📅 No events on the calendar for next week`
        : `📅 ${upcoming.length} event${upcoming.length !== 1 ? "s" : ""} this week`;

      const body = upcoming.length === 0
        ? `<p style="color:#555">Nothing is scheduled for the next 7 days. Now's a good time to import or feature new events.</p>`
        : (() => {
            const byDay = new Map<string, typeof upcoming>();
            for (const e of upcoming) {
              const arr = byDay.get(e.date) || [];
              arr.push(e);
              byDay.set(e.date, arr);
            }
            return Array.from(byDay.entries()).map(([date, items]) => {
              const dayLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
              const list = items.map((e) => `
                <li style="margin:4px 0">
                  <strong>${escapeHtml(e.title)}</strong>
                  ${e.eventTime ? ` <span style="color:#777">at ${escapeHtml(e.eventTime)}</span>` : ""}
                  ${e.venue ? ` — ${escapeHtml(e.venue)}` : ""}
                  ${e.city ? `, ${escapeHtml(e.city)}` : ""}
                </li>`).join("");
              return `<h3 style="margin:20px 0 6px;color:#9333ea">${dayLabel}</h3><ul style="margin:0;padding-left:20px;font-size:14px">${list}</ul>`;
            }).join("");
          })();

      await transporter.sendMail({
        from: `"CGE Website" <${process.env.GMAIL_USER}>`,
        to: "centralgroupevents@gmail.com",
        subject,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px">
            <h2 style="margin:0 0 12px">This week on CGE</h2>
            ${body}
            <p style="margin-top:24px"><a href="https://centralgroupevents.com" style="color:#9333ea;font-weight:600">View calendar →</a></p>
          </div>`,
      });
      res.json({ sent: true, count: upcoming.length });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Analytics route ───────────────────────────────────────────────────
  app.get("/api/analytics", requireAuth(), async (req: Request, res: Response) => {
    try {
      const raw = req.query.days;
      const parsed = typeof raw === "string" ? parseInt(raw, 10) : NaN;
      const days = Number.isFinite(parsed) && parsed > 0 && parsed <= 365 ? parsed : undefined;
      const data = await storage.getAnalytics(days);
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Per-page funnel for the landing-page CMS (views → engagement →
  // submissions → approved). Reads existing tables only.
  app.get("/api/analytics/pages-funnel", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const data = await storage.getPagesFunnel();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // SEO health snapshot — every public URL scored on SEO basics
  app.get("/api/admin/seo-health", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const data = await storage.getSeoHealth();
      res.json(data);
    } catch (err) {
      console.error("[seo-health] error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/analytics/events", requireAuth(), async (req: Request, res: Response) => {
    try {
      const raw = req.query.days;
      const parsed = typeof raw === "string" ? parseInt(raw, 10) : NaN;
      const days = Number.isFinite(parsed) && parsed > 0 && parsed <= 365 ? parsed : undefined;
      const [events, regions, cities, sources, funnel] = await Promise.all([
        storage.getEventPerformance(days, 20),
        storage.getTopRegions(days),
        storage.getTopCities(days, 10),
        storage.getTrafficSources(days),
        storage.getBookingFunnel(days),
      ]);
      res.json({ events, regions, cities, sources, funnel });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Seed data ────────────────────────────────────────────────────────
  await seedDatabase();

  await seedRealEvents();
  await seedSuperadmin();

  return httpServer;
}

async function seedDatabase() {
  // No-op. This function used to re-insert 4 demo events ("Summer Vibes Day
  // Party", "Midnight R&B Lounge", "Beachfront Bash", "Techno Warehouse")
  // whenever the events table was empty. The user runs real data through
  // CSV/XLSX imports; the demo entries just confused things every time a
  // fresh DB instance booted (Replit Autoscale, prod DB reset, etc.).
}

async function seedRealEvents() {
  // No-op. This function used to re-insert 11 hardcoded events on every server
  // start, which on Replit Autoscale meant deleted events kept coming back
  // whenever a fresh instance booted. Seeding is now strictly a one-time job
  // for an empty database via seedDatabase() above.
}

async function seedSuperadmin() {
  const count = await storage.countAdminUsers();
  if (count === 0) {
    const passwordHash = await bcrypt.hash("Cgevents2023", 12);
    await storage.createAdminUser({
      email: "centralgroupevents@gmail.com",
      passwordHash,
      role: "superadmin",
      inviteAccepted: true,
      isActive: true,
    });
    console.log("[CGE] Superadmin seeded: centralgroupevents@gmail.com");
  }
}
