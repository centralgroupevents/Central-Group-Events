import { pgTable, text, serial, timestamp, boolean, integer, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Existing tables ───────────────────────────────────────────────────────

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  region: text("region"),
  referrer: text("referrer"),
  hasAccess: boolean("has_access").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const promotionBookings = pgTable("promotion_bookings", {
  id: serial("id").primaryKey(),
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
  url: text("url").notNull(),
  clickedAt: timestamp("clicked_at").defaultNow(),
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
export const insertBookingSchema = createInsertSchema(promotionBookings).omit({ id: true, createdAt: true }).extend({
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
export const insertCommentSchema = createInsertSchema(comments).omit({ id: true, createdAt: true }).extend({
  body: z.string().min(1, "Comment cannot be empty").max(2000),
  parentId: z.number().optional().nullable(),
});

// ─── Types ────────────────────────────────────────────────────────────────

export type Subscriber = typeof newsletterSubscribers.$inferSelect;
export type InsertSubscriber = z.infer<typeof insertSubscriberSchema>;

export type Booking = typeof promotionBookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

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

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
