/**
 * Use the New Jersey calendar day, not the visitor's timezone or a fixed UTC
 * offset. UTC below is only a calendar-arithmetic carrier, never an instant
 * representing the promotion's start time.
 */
export function getNextPromotionWindow(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(value => value.type === type)!.value);
  const day = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  // Monday itself must roll forward a full week.
  const daysUntilMonday = (8 - day.getUTCDay()) % 7 || 7;
  day.setUTCDate(day.getUTCDate() + daysUntilMonday);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(day);
}
