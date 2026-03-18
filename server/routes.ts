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
import { requireAuth, verifyAdminToken } from "./auth";

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

  app.get("/api/bookings", async (req: Request, res: Response) => {
    try {
      const bookings = await storage.getBookings();
      res.status(200).json(bookings);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
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
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });
      const token = crypto.randomBytes(32).toString("hex");
      const existing = await storage.findAdminByEmail(email);
      if (existing) {
        await storage.updateAdminUser(existing.id, { inviteToken: token, inviteAccepted: false });
      } else {
        await storage.createAdminUser({
          email,
          role: "editor",
          inviteToken: token,
          inviteAccepted: false,
          isActive: true,
        });
      }
      const baseUrl = process.env.NODE_ENV === "production"
        ? "https://centralgroupevents.com"
        : `http://localhost:${process.env.PORT || 5000}`;
      const link = `${baseUrl}/admin/accept-invite?token=${token}`;
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
      if (!post.isPublished) {
        const adminToken: string | undefined = req.cookies?.cge_admin_jwt;
        const admin = adminToken ? await verifyAdminToken(adminToken) : null;
        if (!admin) return res.status(404).json({ message: "Post not found" });
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
    } catch (err) {
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
