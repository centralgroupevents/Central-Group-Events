import { pgTable, text, serial, timestamp, boolean, integer, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Existing tables ───────────────────────────────────────────────────────

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().unique(),
  region: text("region"),
  referrer: text("referrer"),
  // Attribution captured at subscribe time. landingPath = the CGE URL the
  // user was on when they hit subscribe (e.g. "/", "/blog/post-slug",
  // "/juneteenth-in-nj"). utmSource = ?utm_source= query param if present.
  // Both are optional — only filled for subscribes from pages that capture them.
  landingPath: text("landing_path"),
  utmSource: text("utm_source"),
  hasAccess: boolean("has_access").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const promotionBookings = pgTable("promotion_bookings", {
  id: serial("id").primaryKey(),
  referenceId: text("reference_id").unique(),
  mode: text("mode"),
  eventName: text("event_name"),
  venueName: text("venue_name").notNull(),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email").notNull(),
  eventDate: text("event_date").notNull(),
  eventTime: text("event_time"),
  city: text("city"),
  region: text("region").notNull(),
  eventType: text("event_type").notNull(),
  eventTypeOther: text("event_type_other"),
  budgetRange: text("budget_range"),
  instagramHandle: text("instagram_handle"),
  readyToMoveForward: text("ready_to_move_forward"),
  status: text("status").default("New"),
  adminNotes: text("admin_notes"),
  contactedAt: timestamp("contacted_at"),
  paidAt: timestamp("paid_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  date: text("date").notNull(),
  region: text("region").notNull(),
  city: text("city"),
  imageUrl: text("image_url").notNull(),
  ticketLink: text("ticket_link"),
  eventTime: text("event_time"),
  venue: text("venue"),
  organizer: text("organizer"),
  influencer: text("influencer"),
  genre: text("genre"),
  instagramHandle: text("instagram_handle"),
  isFeatured: boolean("is_featured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pages = pgTable("pages", {
  id: serial("id").primaryKey(),
  slug: text("slug").unique().notNull(),
  title: text("title").notNull().default(""),
  heroImageUrl: text("hero_image_url"),
  // Required for screen readers + SEO. Descriptive sentence of what's in the
  // image. Required by the admin form when heroImageUrl is set; falls back to
  // empty if missing (still better than no field).
  heroImageAlt: text("hero_image_alt").notNull().default(""),
  editorContent: text("editor_content").notNull().default(""),
  // Each ad slot stored as JSON-encoded text: { imageUrl, linkUrl, alt }.
  adSlotTop: text("ad_slot_top"),
  adSlotMid: text("ad_slot_mid"),
  adSlotBottom: text("ad_slot_bottom"),
  adSlotSidebar: text("ad_slot_sidebar"),
  // Landing-page CMS fields (used for admin-created pages with their own /:slug URL).
  // The legacy /things-to-do-in-nj row ignores these and keeps using its hardcoded
  // route + component; new admin-created pages render dynamically via these fields.
  metaTitle: text("meta_title").notNull().default(""),
  metaDescription: text("meta_description").notNull().default(""),
  indexable: boolean("indexable").notNull().default(true),
  gateEnabled: boolean("gate_enabled").notNull().default(false),
  submissionsEnabled: boolean("submissions_enabled").notNull().default(false),
  published: boolean("published").notNull().default(false),
  sitemapPriority: text("sitemap_priority").notNull().default("0.7"),
  // JSON-encoded array of {q, a} for FAQPage JSON-LD
  faqItems: text("faq_items").notNull().default("[]"),
  // Separate OG/social-card image (1200x630). Falls back to heroImageUrl
  // when not set. Lets you optimize the social preview vs the page hero.
  ogImageUrl: text("og_image_url"),
  // Public-render hit counter (incremented on each /api/landing-pages/:slug fetch).
  viewCount: integer("view_count").notNull().default(0),
  // Controls which field on each submission card renders as the prominent
  // big H3. Values: "venueName" (default) | "eventName" | "eventDate".
  // Useful for pages where the EVENT is the headline (a festival named
  // "Juneteenth Celebration" hosted at "City Hall Lawn") vs the VENUE.
  listingHeaderField: text("listing_header_field").notNull().default("venueName"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Redirect table for slug renames. When admin renames a published page's
// slug, the old slug gets logged here so requests for /<old> 301 to /<new>
// — preserving inbound Google traffic.
export const pageRedirects = pgTable("page_redirects", {
  id: serial("id").primaryKey(),
  oldSlug: text("old_slug").unique().notNull(),
  newSlug: text("new_slug").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── New tables ────────────────────────────────────────────────────────────

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("editor"),
  inviteToken: text("invite_token"),
  inviteAccepted: boolean("invite_accepted").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").unique().notNull(),
  excerpt: text("excerpt"),
  content: text("content"),
  coverImageUrl: text("cover_image_url"),
  isPublished: boolean("is_published").default(false),
  isGated: boolean("is_gated").default(false),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const postVersions = pgTable("post_versions", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => posts.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  savedAt: timestamp("saved_at").defaultNow(),
  savedBy: integer("saved_by").references(() => adminUsers.id),
});

export const postViews = pgTable("post_views", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => posts.id),
  viewedAt: timestamp("viewed_at").defaultNow(),
});

export const linkClicks = pgTable("link_clicks", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => posts.id),
  eventId: integer("event_id").references(() => events.id),
  url: text("url").notNull(),
  sourcePage: text("source_page"),
  clickedAt: timestamp("clicked_at").defaultNow(),
});

export const funnelEvents = pgTable("funnel_events", {
  id: serial("id").primaryKey(),
  step: text("step").notNull(),
  sessionId: text("session_id"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// One row per (booking × kind). Idempotent backfill on every cron tick:
// rows get created when a booking first becomes eligible (paid, not
// cancelled, has a parseable eventDate), then flipped sent / failed /
// skipped when the daily cron fires. Lets us survive double-pings and
// gives the admin "Scheduled Emails" tab its data source.
export const scheduledEmailSends = pgTable("scheduled_email_sends", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => promotionBookings.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // "reminder_t4" | "feedback_t1"
  scheduledFor: text("scheduled_for").notNull(), // YYYY-MM-DD (ET-anchored)
  recipientEmail: text("recipient_email").notNull(),
  status: text("status").notNull().default("pending"), // pending | sent | failed | skipped
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
  dryRun: boolean("dry_run").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Simple key/value settings table. Currently used for `cronDryRun`
// (string "true"/"false"), but reusable for future runtime flags.
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Standalone arbitrary reminders. Free-text title + optional body, one
// or more comma-separated recipients, a sendAt timestamp. Processed by
// the same cron tick as scheduled emails — fires the next time the tick
// runs at or after sendAt. Recurring reminders intentionally not in v1.
export const reminders = pgTable("reminders", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body"),
  sendAt: timestamp("send_at").notNull(),
  recipientEmails: text("recipient_emails").notNull(),
  tag: text("tag"),
  status: text("status").notNull().default("pending"), // pending | sent | failed | cancelled
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// One row per email blast we send. `kind` distinguishes the all-subscriber
// newsletter from a per-page submitter blast; `pageSlug` is set for the
// latter so we can filter by page in admin.
export const emailBlasts = pgTable("email_blasts", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(), // "newsletter" | "page-blast"
  subject: text("subject").notNull(),
  recipientCount: integer("recipient_count").notNull().default(0),
  pageSlug: text("page_slug"),
  sentAt: timestamp("sent_at").defaultNow(),
});

// One row per recorded event (open / click) for a blast. Per (blast,
// recipient, eventType) we keep all occurrences — open counts go up if
// the recipient previews + opens, click rows include the URL so we can
// show top destinations.
export const emailBlastEvents = pgTable("email_blast_events", {
  id: serial("id").primaryKey(),
  blastId: integer("blast_id").notNull().references(() => emailBlasts.id, { onDelete: "cascade" }),
  recipientEmail: text("recipient_email").notNull(),
  eventType: text("event_type").notNull(), // "open" | "click"
  url: text("url"), // null for opens, the destination URL for clicks
  ts: timestamp("ts").defaultNow(),
});

export const worldCupSubmissions = pgTable("world_cup_submissions", {
  id: serial("id").primaryKey(),
  weekIndex: integer("week_index").notNull(),
  matchDate: text("match_date").notNull(),
  // matchSlot is the canonical schedule identifier (set when submitter picks
  // from the dropdown). For admin CSV bulk-imports where the fixture is just
  // free text, matchSlot may be null and matchLabel carries the human label.
  matchSlot: text("match_slot"),
  matchLabel: text("match_label"),
  venueName: text("venue_name").notNull(),
  town: text("town").notNull(),
  // Optional admin-set region override. NULL = client falls back to
  // auto-deriving region from `town` via shared/nj-town-regions.
  region: text("region"),
  eventName: text("event_name"),
  instagramHandle: text("instagram_handle"),
  learnMoreUrl: text("learn_more_url"),
  submitterEmail: text("submitter_email").notNull(),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  source: text("source").notNull().default("public-form"),
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

// NBA Finals 2026 watch party submissions — same shape as worldCupSubmissions
// but keyed on game number (4-7) instead of weekIndex + matchSlot.
export const nbaFinalsSubmissions = pgTable("nba_finals_submissions", {
  id: serial("id").primaryKey(),
  gameNumber: integer("game_number").notNull(),
  gameDate: text("game_date").notNull(),
  venueName: text("venue_name").notNull(),
  town: text("town").notNull(),
  // Optional admin-set region override. NULL = client falls back to
  // auto-deriving region from `town` via shared/nj-town-regions.
  region: text("region"),
  eventName: text("event_name"),
  instagramHandle: text("instagram_handle"),
  learnMoreUrl: text("learn_more_url"),
  submitterEmail: text("submitter_email").notNull(),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  source: text("source").notNull().default("public-form"),
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

// Generic submissions table for admin-created landing pages. Keyed to the
// page by FK; each page that has `submissionsEnabled` collects rows here.
export const landingPageSubmissions = pgTable("landing_page_submissions", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").references(() => pages.id, { onDelete: "cascade" }).notNull(),
  submitterEmail: text("submitter_email").notNull(),
  submitterName: text("submitter_name"),
  submitterRegion: text("submitter_region"),
  eventDate: text("event_date").notNull(),
  venueName: text("venue_name").notNull(),
  town: text("town").notNull(),
  eventName: text("event_name"),
  instagramHandle: text("instagram_handle"),
  learnMoreUrl: text("learn_more_url"),
  // Admin override; NULL → client derives region from town.
  region: text("region"),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  source: text("source").notNull().default("public-form"),
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => posts.id).notNull(),
  parentId: integer("parent_id").references((): AnyPgColumn => comments.id),
  email: text("email").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Insert schemas ────────────────────────────────────────────────────────

export const insertSubscriberSchema = createInsertSchema(newsletterSubscribers).omit({ id: true, createdAt: true }).extend({
  email: z.string().email(),
  referrer: z.string().max(500).optional(),
  landingPath: z.string().max(500).optional(),
  utmSource: z.string().max(120).optional(),
  hasAccess: z.boolean().optional(),
});
export const insertBookingSchema = createInsertSchema(promotionBookings).omit({ id: true, createdAt: true, adminNotes: true, referenceId: true }).extend({
  email: z.string().email(),
  mode: z.string().optional(),
  eventName: z.string().optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  eventTime: z.string().optional(),
  city: z.string().optional(),
  eventTypeOther: z.string().optional(),
  budgetRange: z.string().optional(),
  instagramHandle: z.string().optional(),
  readyToMoveForward: z.string().optional(),
});
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true }).extend({
  description: z.string().optional().default(""),
  imageUrl: z.string().optional().default(""),
  eventTime: z.string().optional().nullable(),
  venue: z.string().optional().nullable(),
  organizer: z.string().optional().nullable(),
  influencer: z.string().optional().nullable(),
  genre: z.string().optional().nullable(),
  instagramHandle: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  ticketLink: z.string().optional().nullable(),
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({ id: true, createdAt: true });
export const insertPostSchema = createInsertSchema(posts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPostVersionSchema = createInsertSchema(postVersions).omit({ id: true, savedAt: true });
export const insertPostViewSchema = createInsertSchema(postViews).omit({ id: true, viewedAt: true });
export const insertLinkClickSchema = createInsertSchema(linkClicks).omit({ id: true, clickedAt: true });
export const insertFunnelEventSchema = createInsertSchema(funnelEvents).omit({ id: true, createdAt: true });
// NBA Finals public form schema (gameDate must be ISO since it comes from a
// strict dropdown derived from the hardcoded schedule).
export const insertNbaFinalsSubmissionSchema = createInsertSchema(nbaFinalsSubmissions)
  .omit({ id: true, createdAt: true, reviewedAt: true, status: true, adminNotes: true, source: true })
  .extend({
    submitterEmail: z.string().email(),
    gameNumber: z.number().int().min(5).max(7),
    gameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    venueName: z.string().min(1).max(200),
    town: z.string().min(1).max(100),
    eventName: z.string().max(200).optional().nullable(),
    instagramHandle: z.string().max(80).optional().nullable(),
    learnMoreUrl: z.string().max(500).optional().nullable().or(z.literal("")),
  });

// Admin bulk-import schema for NBA Finals (looser — matches WC pattern).
export const adminBulkNbaFinalsRowSchema = z.object({
  gameNumber: z.number().int().min(5).max(7).optional(),
  gameDate: z.string().min(1).max(120),
  venueName: z.string().min(1).max(200),
  town: z.string().min(1).max(100),
  eventName: z.string().max(200).optional().nullable(),
  instagramHandle: z.string().max(80).optional().nullable(),
  learnMoreUrl: z.string().max(500).optional().nullable().or(z.literal("")),
});

// Public submission schema for landing pages. Free-text date (the page may be
// for a specific day, a range, or generic event series).
export const insertLandingPageSubmissionSchema = createInsertSchema(landingPageSubmissions)
  .omit({ id: true, createdAt: true, reviewedAt: true, status: true, adminNotes: true, source: true })
  .extend({
    pageId: z.number().int().positive(),
    submitterEmail: z.string().email(),
    submitterName: z.string().max(120).optional().nullable(),
    submitterRegion: z.string().max(80).optional().nullable(),
    eventDate: z.string().min(1).max(120),
    venueName: z.string().min(1).max(200),
    town: z.string().min(1).max(100),
    eventName: z.string().max(200).optional().nullable(),
    instagramHandle: z.string().max(80).optional().nullable(),
    learnMoreUrl: z.string().max(500).optional().nullable().or(z.literal("")),
    region: z.string().max(80).optional().nullable(),
  });

// Admin bulk-import row (loose — admin is source of truth, dates accepted as
// any string and normalized server-side via parseFlexibleWcDate).
export const adminBulkLandingPageRowSchema = z.object({
  eventDate: z.string().min(1).max(120),
  venueName: z.string().min(1).max(200),
  town: z.string().min(1).max(100),
  eventName: z.string().max(200).optional().nullable(),
  instagramHandle: z.string().max(80).optional().nullable(),
  learnMoreUrl: z.string().max(500).optional().nullable().or(z.literal("")),
});

export const insertWorldCupSubmissionSchema = createInsertSchema(worldCupSubmissions)
  .omit({ id: true, createdAt: true, reviewedAt: true, status: true, adminNotes: true, matchLabel: true, source: true })
  .extend({
    submitterEmail: z.string().email(),
    weekIndex: z.number().int().min(1).max(6),
    matchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    matchSlot: z.string().min(1).max(200),
    venueName: z.string().min(1).max(200),
    town: z.string().min(1).max(100),
    eventName: z.string().max(200).optional().nullable(),
    instagramHandle: z.string().max(80).optional().nullable(),
    learnMoreUrl: z.string().url("Must be a valid URL starting with http or https").max(500).optional().nullable(),
  });

// Admin bulk-import schema: matchSlot is optional (admin may provide free-text
// matchLabel instead of picking from the official schedule). Status is forced
// to "approved" since admin is the source of truth. weekIndex is auto-derived
// server-side from matchDate, so it's optional in the wire format.
// matchDate accepts any free-text date string. The server normalizes it via
// parseFlexibleWcDate() — supports YYYY-MM-DD, "Jun 11, 2026", "6/11/2026",
// and date ranges like "Jun 11 – Jul 19, 2026" (start date is used).
export const adminBulkWorldCupRowSchema = z.object({
  weekIndex: z.number().int().min(1).max(6).optional(),
  matchDate: z.string().min(1).max(120),
  matchSlot: z.string().max(200).optional().nullable(),
  matchLabel: z.string().max(300).optional().nullable(),
  venueName: z.string().min(1).max(200),
  town: z.string().min(1).max(100),
  eventName: z.string().max(200).optional().nullable(),
  instagramHandle: z.string().max(80).optional().nullable(),
  // Admin bulk imports often carry bare URLs (posh.vip/foo, instagram.com/bar).
  // Server normalizes by auto-prepending https:// — so accept any short-ish string
  // here and let the route handler do the cleanup.
  learnMoreUrl: z.string().max(500).optional().nullable().or(z.literal("")),
});
export const insertCommentSchema = createInsertSchema(comments).omit({ id: true, createdAt: true }).extend({
  body: z.string().min(1, "Comment cannot be empty").max(2000),
  parentId: z.number().optional().nullable(),
});

export const insertPageSchema = createInsertSchema(pages).omit({ id: true, updatedAt: true }).extend({
  heroImageUrl: z.string().optional().nullable(),
  adSlotTop: z.string().optional().nullable(),
  adSlotMid: z.string().optional().nullable(),
  adSlotBottom: z.string().optional().nullable(),
  adSlotSidebar: z.string().optional().nullable(),
});

// ─── Types ────────────────────────────────────────────────────────────────

export type Subscriber = typeof newsletterSubscribers.$inferSelect;
export type InsertSubscriber = z.infer<typeof insertSubscriberSchema>;

export type Booking = typeof promotionBookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type Page = typeof pages.$inferSelect;
export type InsertPage = z.infer<typeof insertPageSchema>;

export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;

export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;

export type PostVersion = typeof postVersions.$inferSelect;
export type InsertPostVersion = z.infer<typeof insertPostVersionSchema>;

export type PostView = typeof postViews.$inferSelect;
export type InsertPostView = z.infer<typeof insertPostViewSchema>;

export type LinkClick = typeof linkClicks.$inferSelect;
export type InsertLinkClick = z.infer<typeof insertLinkClickSchema>;

export type FunnelEvent = typeof funnelEvents.$inferSelect;
export type InsertFunnelEvent = z.infer<typeof insertFunnelEventSchema>;

export type ScheduledEmailSend = typeof scheduledEmailSends.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type EmailBlast = typeof emailBlasts.$inferSelect;
export type EmailBlastEvent = typeof emailBlastEvents.$inferSelect;

export type WorldCupSubmission = typeof worldCupSubmissions.$inferSelect;
export type InsertWorldCupSubmission = z.infer<typeof insertWorldCupSubmissionSchema>;

export type NbaFinalsSubmission = typeof nbaFinalsSubmissions.$inferSelect;
export type LandingPageSubmission = typeof landingPageSubmissions.$inferSelect;
export type InsertLandingPageSubmission = z.infer<typeof insertLandingPageSubmissionSchema>;
export type InsertNbaFinalsSubmission = z.infer<typeof insertNbaFinalsSubmissionSchema>;

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
