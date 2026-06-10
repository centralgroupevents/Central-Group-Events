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
  editorContent: text("editor_content").notNull().default(""),
  // Each ad slot stored as JSON-encoded text: { imageUrl, linkUrl, alt }.
  adSlotTop: text("ad_slot_top"),
  adSlotMid: text("ad_slot_mid"),
  adSlotBottom: text("ad_slot_bottom"),
  adSlotSidebar: text("ad_slot_sidebar"),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  referrer: z.string().optional(),
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
    gameNumber: z.number().int().min(4).max(7),
    gameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    venueName: z.string().min(1).max(200),
    town: z.string().min(1).max(100),
    eventName: z.string().max(200).optional().nullable(),
    instagramHandle: z.string().max(80).optional().nullable(),
    learnMoreUrl: z.string().max(500).optional().nullable().or(z.literal("")),
  });

// Admin bulk-import schema for NBA Finals (looser — matches WC pattern).
export const adminBulkNbaFinalsRowSchema = z.object({
  gameNumber: z.number().int().min(4).max(7).optional(),
  gameDate: z.string().min(1).max(120),
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

export type WorldCupSubmission = typeof worldCupSubmissions.$inferSelect;
export type InsertWorldCupSubmission = z.infer<typeof insertWorldCupSubmissionSchema>;

export type NbaFinalsSubmission = typeof nbaFinalsSubmissions.$inferSelect;
export type InsertNbaFinalsSubmission = z.infer<typeof insertNbaFinalsSubmissionSchema>;

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
