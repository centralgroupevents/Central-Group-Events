import { z } from "zod";

export function easternToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Use a valid calendar date (YYYY-MM-DD)");

export const assistantEventSchema = z.object({
  id: z.number().int(), title: z.string(), description: z.string(), date: z.string(),
  eventTime: z.string().nullable(), region: z.string(), city: z.string().nullable(),
  venue: z.string().nullable(), genre: z.string().nullable(), ticketLink: z.string().nullable(),
  imageUrl: z.string(), instagramHandle: z.string().nullable(),
});
export type AssistantEvent = z.infer<typeof assistantEventSchema>;
export const chatInputSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000),
  })).max(12).default([]),
});
export type ChatInput = z.infer<typeof chatInputSchema>;
export const chatResponseSchema = z.object({
  reply: z.string().max(2000), events: z.array(assistantEventSchema).max(8),
  suggestedCriteria: z.array(z.string().max(100)).max(3).optional(),
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
const httpUrl = z.string().trim().max(2000).refine(value => {
  if (!value) return true;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}, "Use a valid http or https link");
export const submitAssistantEventSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: optionalText(4000),
  date: calendarDate.refine(date => date >= easternToday(), "Choose today or an upcoming date"),
  eventTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time").or(z.literal("")).optional().default(""),
  region: z.enum(["North NJ", "Central NJ", "South NJ"]),
  city: z.string().trim().min(1).max(100),
  venue: z.string().trim().min(1).max(180),
  genre: optionalText(100),
  ticketLink: httpUrl.optional().default(""),
  instagramHandle: z.string().trim().max(31).regex(/^@?[a-zA-Z0-9_.]*$/, "Enter an Instagram handle, not a URL").optional().default(""),
  imageUrl: z.string().trim().max(2000).refine(value => {
    if (!value) return true;
    try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "res.cloudinary.com" && !url.username && !url.password; } catch { return false; }
  }, "Upload a flyer to Cloudinary").optional().default(""),
  organizerEmail: z.string().trim().email().max(254),
}).strict();
export type AssistantEventSubmission = z.infer<typeof submitAssistantEventSchema>;
