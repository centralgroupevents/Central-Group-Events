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
      const publishedPosts = await storage.getPublishedPosts();
      const postEntries = publishedPosts
        .map(
          (p) => `
  <url>
    <loc>https://www.centralgroupevents.com/blog/${p.slug}</loc>
    <lastmod>${p.publishedAt ? new Date(p.publishedAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
        )
        .join("");
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.centralgroupevents.com</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.centralgroupevents.com/blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://www.centralgroupevents.com/faq</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>${postEntries}
</urlset>`;
      console.log(`[sitemap] returning ${publishedPosts.length} blog entries`);
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
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /booking-confirmation\nDisallow: /welcome\nSitemap: https://www.centralgroupevents.com/sitemap.xml`
    );
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
      await storage.createBooking(input);
      res.status(201).json({ message: "Booking request submitted successfully! We'll be in touch." });
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
                  <img src="https://www.centralgroupevents.com/favicon.png" alt="Central Group Events" style="height:64px;width:auto;" />
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
  app.get(api.events.list.path, async (req, res) => {
    try {
      const region = req.query.region as string;
      const eventList = await storage.getEvents(region);
      res.status(200).json(eventList);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/events", async (req: Request, res: Response) => {
    try {
      const { insertEventSchema } = await import("@shared/schema");
      const input = insertEventSchema.parse(req.body);
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
      const event = await storage.updateEvent(id, req.body);
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
      let skipped = rawRows.length;
      for (const row of rawRows) {
        try {
          const parsed = insertEventSchema.parse({
            title: row.name || row.title || "",
            date: row.date || "",
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
            imageUrl: "",
          });
          validRows.push(parsed);
        } catch (_) {
          // keep skipped count
        }
      }
      skipped = rawRows.length - validRows.length;
      const result = await storage.bulkImportEvents(validRows);
      res.json({ imported: result.imported, skipped: result.skipped + skipped });
    } catch (err) {
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
      const url = req.query.url as string;
      const postIdRaw = req.query.postId as string;
      if (!url || !url.startsWith("http")) {
        return res.status(400).json({ message: "Invalid URL" });
      }
      const postId = postIdRaw ? parseInt(postIdRaw, 10) : undefined;
      storage.recordClick(url, isNaN(postId as number) ? undefined : postId).catch(() => {});
      res.redirect(302, url);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Analytics route ───────────────────────────────────────────────────
  app.get("/api/analytics", requireAuth(), async (req: Request, res: Response) => {
    try {
      const data = await storage.getAnalytics();
      res.json(data);
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
  const realEvents = [
    { title: "COUNTRY LINE DANCING", city: "Asbury Park", region: "Central NJ" },
    { title: "AYA FRIDAYS", city: "Edison", region: "Central NJ" },
    { title: "FRIDAY NIGHT OUT", city: "Plainfield", region: "Central NJ" },
    { title: "UNDERGROUND FRIDAYS WITH DJ FIORELLA", city: "Somerville", region: "Central NJ" },
    { title: "90s vs 2000s BASH", city: "East Brunswick", region: "Central NJ" },
    { title: "SAK PASE AFRO - GHANA INDEPENDENCE DAY", city: "Roselle", region: "Central NJ" },
    { title: "THE BIGGIE BRUNCH", city: "Clifton", region: "North NJ" },
    { title: "JOJOS HAPPY HOUR", city: "Garfield", region: "North NJ" },
    { title: "COMMUNITY NIGHT: JOURNEYS HOME BY MOONLIGHT", city: "Newark", region: "North NJ" },
    { title: "JAZZY FRIDAYS", city: "Fort Lee", region: "North NJ" },
    { title: "DREAM: A LISTENING & VISUAL EXPERIENCE", city: "Jersey City", region: "North NJ" },
  ];

  const existingEvents = await storage.getEvents();
  const existingTitles = new Set(existingEvents.map(e => e.title));

  for (const event of realEvents) {
    if (!existingTitles.has(event.title)) {
      await storage.createEvent({
        title: event.title,
        description: `Live event in ${event.city}, NJ`,
        date: "2026-03-06",
        region: event.region,
        city: event.city,
        imageUrl: "",
        ticketLink: "#",
      });
    }
  }
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
