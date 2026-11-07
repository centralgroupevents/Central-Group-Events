import { and, asc, gte, ilike, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { events } from "@shared/schema";
import { regionSection } from "@shared/region";
import { db } from "./db";
import { calendarDate as isoDate, easternToday } from "@shared/assistant";
export { easternToday } from "@shared/assistant";

export const eventSearchFiltersSchema = z.object({
  region: z.string().trim().max(80).optional(),
  dateRange: z.object({ start: isoDate.optional(), end: isoDate.optional() })
    .refine(r => !r.start || !r.end || r.start <= r.end, "Start must precede end").optional(),
  keyword: z.string().trim().max(200).optional(),
  genre: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
});
export type EventSearchFilters = z.infer<typeof eventSearchFiltersSchema>;

const projection = {
  id: events.id, title: events.title, description: events.description,
  date: events.date, eventTime: events.eventTime, region: events.region,
  city: events.city, venue: events.venue, genre: events.genre,
  ticketLink: events.ticketLink, imageUrl: events.imageUrl,
  instagramHandle: events.instagramHandle,
};

// Treat user wildcards literally; values remain parameterized by Drizzle.
const contains = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;

export function buildEventSearchQuery(filters: EventSearchFilters = {}, now = new Date(), database: Pick<typeof db, "select"> = db) {
  const parsed = eventSearchFiltersSchema.parse(filters);
  const conditions = [
    gte(events.date, easternToday(now)),
    sql`${events.date} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`,
  ];
  if (parsed.dateRange?.start) conditions.push(gte(events.date, parsed.dateRange.start));
  if (parsed.dateRange?.end) conditions.push(lte(events.date, parsed.dateRange.end));
  if (parsed.region && parsed.region.toLowerCase() !== "all") {
    const section = regionSection(parsed.region);
    conditions.push(section
      ? sql`lower(${events.region}) ~ ${`\\m${section}\\M`}`
      : ilike(events.region, parsed.region.replace(/[\\%_]/g, "\\$&")));
  }
  if (parsed.keyword) {
    const pattern = contains(parsed.keyword);
    conditions.push(or(...[events.title, events.description, events.genre, events.venue, events.city]
      .map(column => ilike(column, pattern)))!);
  }
  if (parsed.genre) conditions.push(ilike(events.genre, contains(parsed.genre)));
  if (parsed.city) conditions.push(ilike(events.city, contains(parsed.city)));
  return database.select(projection).from(events).where(and(...conditions))
    .orderBy(asc(events.date), asc(events.id)).limit(8);
}

export async function searchEvents(filters: EventSearchFilters = {}) {
  return await buildEventSearchQuery(filters);
}

export type AssistantEvent = Awaited<ReturnType<typeof searchEvents>>[number];
