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
  // Fall back to JS Date parser for natural-language ("Jun 11, 2026")
  const d = new Date(head);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return null;
}

const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many submissions, please try again later." },
});

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
    <loc>https://centralgroupevents.com/faq</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
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
      await storage.createSubscriber(input);
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
                <a href="https://centralgroupevents.com/blog" style="display: inline-block; background: #8B2FC9; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 15px; padding: 14px 32px; border-radius: 10px;">
                  View This Week's Events
                </a>
              </div>

              <hr style="border: none; border-top: 1px solid #1e1e1e; margin-bottom: 24px;" />

              <p style="color: #555555; font-size: 12px; text-align: center; margin: 0;">
                You're receiving this because you subscribed at centralgroupevents.com
              </p>
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
      // Auto-subscribe the booker to the newsletter (non-blocking, ON CONFLICT DO NOTHING via upsert)
      storage.upsertSubscriber(
        input.email.toLowerCase().trim(),
        "booking",
        input.contactName || undefined
      ).catch(() => {});
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
        const date = (row.date || "").trim();
        if (!title) {
          invalid.push({ rowIndex: i, title: "(no name)", reason: "Missing event name" });
          continue;
        }
        if (!date) {
          invalid.push({ rowIndex: i, title, reason: "Missing date" });
          continue;
        }
        // Events are filtered by `gte(events.date, CURRENT_DATE::text)` on read, so a non-ISO
        // date string would silently fail that lexical comparison and the event would never
        // appear. Reject anything that isn't YYYY-MM-DD up front so the user sees why.
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          invalid.push({ rowIndex: i, title, reason: `Unrecognized date format: "${row.date}". Expected YYYY-MM-DD or a value the importer can normalize (e.g. 5/19/2026).` });
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
    } catch (err) {
      res.status(400).json({ message: err instanceof Error ? err.message : "Invalid request" });
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

  // Public-by-slug fetch — returns the page ONLY if published. Used by the
  // public PageRenderer when the URL doesn't match a programmatic topic.
  app.get("/api/landing-pages/:slug", async (req: Request, res: Response) => {
    try {
      const page = await storage.getPageBySlug(req.params.slug as string);
      if (!page || !page.published) return res.status(404).json({ message: "Not found" });
      res.json(page);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Landing-page submissions (per-page user-submitted events) ───────────
  // Public: list approved submissions for a page (used by the embedded list)
  app.get("/api/landing-pages/:slug/submissions/approved", async (req: Request, res: Response) => {
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

      // Auto-subscribe (non-blocking)
      storage.upsertSubscriber(
        parsed.submitterEmail.toLowerCase().trim(),
        `page:${page.slug}`,
      ).catch(() => {});

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
        valid.map((r: any) => ({ email: r.email.trim().toLowerCase(), region: r.region || undefined }))
      );

      console.log(`[subscriber-import] Result: ${result.imported} imported, ${result.skipped} skipped`);
      res.json({ ...result, invalidFormat: invalidRows.length });
    } catch (err) {
      console.error("[subscriber-import] Error:", err);
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
      const subscribers = await storage.listSubscribers();
      let sent = 0;
      for (const sub of subscribers) {
        try {
          await transporter.sendMail({
            from: `"Central Group Events" <${process.env.GMAIL_USER}>`,
            to: sub.email,
            subject,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 32px; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #8B2FC9; margin: 0;">Central Group Events</h1>
                  <p style="color: #888; font-size: 12px; margin: 4px 0 0;">NJ Nightlife Newsletter</p>
                </div>
                <div style="color: #e0e0e0; line-height: 1.7; white-space: pre-wrap;">${body}</div>
                <hr style="border-color: #333; margin: 32px 0;" />
                <p style="color: #555; font-size: 12px; text-align: center;">
                  You're receiving this because you subscribed at centralgroupevents.com.<br/>
                  <a href="https://centralgroupevents.com" style="color: #8B2FC9;">Unsubscribe</a>
                </p>
              </div>
            `,
          });
          sent++;
        } catch (e) {
          console.error(`Failed to send to ${sub.email}:`, e);
        }
      }
      res.json({ message: "Newsletter sent", sent });
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
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 32px; border-radius: 12px;">
                <h1 style="color: #8B2FC9;">Welcome to the CGE insider list!</h1>
                <p>You now have full access to all CGE newsletter posts.</p>
                <p>Head back to the post you were reading or visit <a href="https://centralgroupevents.com/blog" style="color: #8B2FC9;">centralgroupevents.com/blog</a> to see everything.</p>
                <p style="color: #555; font-size: 12px; margin-top: 24px;">Central Group Events • centralgroupevents@gmail.com</p>
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

      // Auto-subscribe the submitter to the newsletter (non-blocking, ON CONFLICT DO NOTHING).
      // Matches the same pattern used for /api/bookings — every email captured is a lead.
      storage.upsertSubscriber(
        parsed.submitterEmail.toLowerCase().trim(),
        "world-cup-watch-party",
      ).catch(() => {});

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

      storage.upsertSubscriber(
        parsed.submitterEmail.toLowerCase().trim(),
        "nba-finals-watch-party",
      ).catch(() => {});

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
  const existingEvents = await storage.getEvents();
  if (existingEvents.length === 0) {
    const seedEvents = [
      {
        title: "Summer Vibes Day Party",
        description: "The hottest day party in Central NJ with live DJs and drinks.",
        date: "2026-07-15",
        region: "Central NJ",
        imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        ticketLink: "https://example.com/tickets",
      },
      {
        title: "Midnight R&B Lounge",
        description: "Smooth R&B hits all night long.",
        date: "2026-07-22",
        region: "North NJ",
        imageUrl: "https://images.unsplash.com/photo-1470229722913-7c090be5f5ae?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        ticketLink: "https://example.com/tickets",
      },
      {
        title: "Beachfront Bash",
        description: "Exclusive beachfront party to start the weekend right.",
        date: "2026-07-29",
        region: "South NJ",
        imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        ticketLink: "https://example.com/tickets",
      },
      {
        title: "Techno Warehouse",
        description: "Underground techno from 10PM to late.",
        date: "2026-08-05",
        region: "North NJ",
        imageUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        ticketLink: "https://example.com/tickets",
      }
    ];
    for (const event of seedEvents) {
      await storage.createEvent(event);
    }
  }
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
