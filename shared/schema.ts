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
  venueName: text("venue_name").notNull(),
  contactName: text("contact_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  eventDate: text("event_date").notNull(),
  region: text("region").notNull(),
  eventType: text("event_type").notNull(),
  budgetRange: text("budget_range").notNull(),
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
  imageUrl: text("image_url").notNull(),
  ticketLink: text("ticket_link"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubscriberSchema = createInsertSchema(newsletterSubscribers).omit({ id: true, createdAt: true }).extend({
  email: z.string().email(),
});
export const insertBookingSchema = createInsertSchema(promotionBookings).omit({ id: true, createdAt: true }).extend({
  email: z.string().email(),
  readyToMoveForward: z.string().optional(),
});
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true });

export type Subscriber = typeof newsletterSubscribers.$inferSelect;
export type InsertSubscriber = z.infer<typeof insertSubscriberSchema>;

export type Booking = typeof promotionBookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
