import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { body, validationResult } from "express-validator";

const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many submissions, please try again later." },
});

const bookingValidators = [
  body("email").isEmail().withMessage("Invalid email address").normalizeEmail(),
  body("phone").matches(/^[\d\s\-\+\(\)]+$/).withMessage("Invalid phone number"),
  body("eventDate").notEmpty().withMessage("Event date is required"),
  body("venueName").trim().escape(),
  body("contactName").trim().escape(),
  body("instagramHandle").optional().trim().escape(),
  body("region").trim().escape(),
  body("eventType").trim().escape(),
  body("budgetRange").trim().escape(),
  body("additionalInfo").optional().trim().escape(),
];

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post(api.subscribers.create.path, formLimiter, async (req, res) => {
    try {
      const input = api.subscribers.create.input.parse(req.body);
      await storage.createSubscriber(input);
      res.status(201).json({ message: "Successfully subscribed to the newsletter!" });
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

  app.post(api.bookings.create.path, formLimiter, ...bookingValidators, async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: errors.array()[0].msg,
        field: (errors.array()[0] as any).path,
      });
    }
    try {
      const input = api.bookings.create.input.parse(req.body);
      await storage.createBooking(input);
      res.status(201).json({ message: "Booking request submitted successfully! We'll be in touch." });
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

  app.get(api.events.list.path, async (req, res) => {
    try {
      const region = req.query.region as string;
      const eventList = await storage.getEvents(region);
      res.status(200).json(eventList);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Seed data function
  await seedDatabase();

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
