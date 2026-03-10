import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  region: text("region").notNull(),
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubscriberSchema = createInsertSchema(newsletterSubscribers).omit({ id: true, createdAt: true }).extend({
  email: z.string().email(),
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
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true });

export type Subscriber = typeof newsletterSubscribers.$inferSelect;
export type InsertSubscriber = z.infer<typeof insertSubscriberSchema>;

export type Booking = typeof promotionBookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
