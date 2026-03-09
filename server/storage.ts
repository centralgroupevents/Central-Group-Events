import { db } from "./db";
import {
  newsletterSubscribers,
  promotionBookings,
  events,
  type InsertSubscriber,
  type Subscriber,
  type InsertBooking,
  type Booking,
  type InsertEvent,
  type Event
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Subscribers
  createSubscriber(subscriber: InsertSubscriber): Promise<Subscriber>;

  // Bookings
  createBooking(booking: InsertBooking): Promise<Booking>;

  // Events
  getEvents(region?: string): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, event: Partial<InsertEvent>): Promise<Event>;
  deleteEvent(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createSubscriber(subscriber: InsertSubscriber): Promise<Subscriber> {
    const [newSubscriber] = await db.insert(newsletterSubscribers).values(subscriber).returning();
    return newSubscriber;
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const [newBooking] = await db.insert(promotionBookings).values(booking).returning();
    return newBooking;
  }

  async getEvents(region?: string): Promise<Event[]> {
    if (region && region !== "All") {
      return await db.select().from(events).where(eq(events.region, region));
    }
    return await db.select().from(events);
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  }

  async updateEvent(id: number, data: Partial<InsertEvent>): Promise<Event> {
    const [updated] = await db.update(events).set(data).where(eq(events.id, id)).returning();
    return updated;
  }

  async deleteEvent(id: number): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }
}

export const storage = new DatabaseStorage();
