import { calendarDate, easternToday } from "@shared/assistant";

function addDays(day: string, days: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Work on ET calendar dates at UTC noon, not 24-hour local timestamps.
// This keeps DST transitions from shifting the requested calendar day.
export function resolveDateIntent(intent: string | null, explicit: { start?: string; end?: string } | null, now = new Date()) {
  const today = easternToday(now);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const text = (intent || "").trim().toLowerCase();
  const single = (day: string) => ({ start: day, end: day });
  if (/^(today|tonight)$/.test(text)) return single(today);
  if (text === "tomorrow") return single(addDays(today, 1));
  if (/^(this |next )?weekend$/.test(text)) {
    let offset = weekday === 0 ? -2 : (5 - weekday + 7) % 7;
    if (weekday === 6) offset = -1;
    if (text === "next weekend") offset += 7;
    const start = addDays(today, offset);
    return { start, end: addDays(start, 2) };
  }
  if (/^(this|next) week$/.test(text)) {
    const start = addDays(today, -((weekday + 6) % 7) + (text === "next week" ? 7 : 0));
    return { start, end: addDays(start, 6) };
  }
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const match = text.match(/^(?:(this|next) )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (match) {
    const offset = (dayNames.indexOf(match[2]) - weekday + 7) % 7;
    return single(addDays(today, offset + (match[1] === "next" ? 7 : 0)));
  }
  if (calendarDate.safeParse(text).success) return single(text);
  if (explicit) {
    const start = explicit.start ? calendarDate.parse(explicit.start) : undefined;
    const end = explicit.end ? calendarDate.parse(explicit.end) : undefined;
    if (start && end && start > end) throw new Error("Invalid date range");
    if (start || end) return { start, end };
  }
  if (text && text !== "any" && text !== "upcoming") {
    throw new Error("Unresolved date intent");
  }
  return undefined;
}
