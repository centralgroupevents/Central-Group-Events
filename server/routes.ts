import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { body, validationResult } from "express-validator";
import nodemailer from "nodemailer";

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
      try {
        await transporter.sendMail({
          from: `"CGE Website" <${process.env.GMAIL_USER}>`,
          to: "centralgroupevents@gmail.com",
          subject: `🎉 New Event Promotion Request — ${input.venueName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 32px; border-radius: 12px;">
              <h1 style="color: #8B2FC9; margin-bottom: 4px;">New Promotion Request</h1>
              <p style="color: #999; margin-bottom: 32px;">Submitted via centralgroupevents.com</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999; width: 40%;">Venue Name</td>
                  <td style="padding: 12px 0; color: #fff; font-weight: bold;">${input.venueName}</td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Contact Name</td>
                  <td style="padding: 12px 0; color: #fff;">${input.contactName}</td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Email</td>
                  <td style="padding: 12px 0; color: #fff;"><a href="mailto:${input.email}" style="color: #8B2FC9;">${input.email}</a></td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Phone</td>
                  <td style="padding: 12px 0; color: #fff;">${input.phone}</td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Event Date</td>
                  <td style="padding: 12px 0; color: #fff;">${input.eventDate}</td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Region</td>
                  <td style="padding: 12px 0; color: #fff;">${input.region}</td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Event Type</td>
                  <td style="padding: 12px 0; color: #fff;">${input.eventType}</td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Budget Range</td>
                  <td style="padding: 12px 0; color: #fff;">${input.budgetRange}</td>
                </tr>
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 12px 0; color: #999;">Instagram</td>
                  <td style="padding: 12px 0; color: #fff;">${input.instagramHandle || "Not provided"}</td>
                </tr>
              </table>
              <div style="margin-top: 32px; padding: 16px; background: #8B2FC9; border-radius: 8px; text-align: center;">
                <a href="mailto:${input.email}" style="color: white; font-weight: bold; font-size: 16px; text-decoration: none;">
                  Reply to ${input.contactName} →
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
  await seedRealEvents();

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
