import { z } from "zod";
import { PACKAGES } from "./promotion-packages";

export const BOOKING_DRAFT_KEY = "cge_booking_draft_v1";
export const BOOKING_ATTEMPT_KEY = "cge_booking_attempt_v1";
export const BOOKING_DRAFT_TTL = 24 * 60 * 60 * 1000;
export const BOOKING_TEXT_LIMIT = 500;
const text = z.string().max(BOOKING_TEXT_LIMIT);
const safeDataSchema = z.object({
  mode: z.enum(["", "Basic", "Starter", "Growth", "Custom"]),
  eventName: text,
  eventType: z.enum(["", "Club Night", "Concert", "Day Party", "Festival", "Brunch", "Networking Event", "Comedy Show", "Pop-Up", "Lounge Event", "Other"]),
  eventTypeOther: text,
  eventDate: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).refine(value =>
    !value || (!Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value)),
  eventTime: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/),
  venueName: text,
  city: text,
  region: z.enum(["", "North NJ", "Central NJ", "South NJ"]),
  newsletterOptIn: z.boolean(),
});
const envelopeSchema = z.object({
  version: z.literal(1),
  expiresAt: z.number().finite(),
  data: safeDataSchema,
  position: z.number().int().min(0).max(6),
});
const attemptSchema = envelopeSchema.extend({
  status: z.enum(["pending", "saved"]),
  referenceId: z.string().max(100).optional(),
});
export type SafeBookingData = z.infer<typeof safeDataSchema>;

export function normalizeBookingDate(value: unknown): string {
  const result = safeDataSchema.shape.eventDate.safeParse(value);
  return result.success ? result.data : "";
}

export function normalizeBookingTime(value: unknown): string {
  if (typeof value !== "string") return "";
  const input = value.trim();
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(input)) return input;
  const match = input.match(/^(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(AM|PM)$/i);
  if (!match) return "";
  const hour = Number(match[1]) % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${match[2] ?? "00"}`;
}

// Explicit allowlist: never persist contacts, consent to terms, extraction input,
// files, URLs from uploads, or arbitrary properties supplied by the caller.
export function safeBookingData(data: unknown): SafeBookingData {
  return safeDataSchema.parse(data);
}

export function removeBookingStorage(key: string) {
  try { sessionStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
}

function readStored<T>(key: string, schema: z.ZodType<T>): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    if (raw.length > 10000) throw new Error("Oversized draft");
    const parsed = schema.parse(JSON.parse(raw));
    const { expiresAt } = parsed as { expiresAt: number };
    if (expiresAt <= Date.now() || expiresAt > Date.now() + BOOKING_DRAFT_TTL) {
      throw new Error("Expired draft");
    }
    return parsed;
  } catch {
    removeBookingStorage(key);
    return null;
  }
}

export function readBookingRecovery() {
  const attempt = readStored(BOOKING_ATTEMPT_KEY, attemptSchema);
  const draft = readStored(BOOKING_DRAFT_KEY, envelopeSchema);
  const stored = attempt ?? draft;
  if (!stored) return null;
  const data = {
    ...stored.data,
    budgetRange: PACKAGES.find(pkg => pkg.id === stored.data.mode)?.price ?? "",
  };
  // Never restore past missing required fields, or into an automatic submission.
  let maxPosition = 0;
  if (data.mode) {
    maxPosition = 1;
    if (data.eventName.trim() && data.eventType && (data.eventType !== "Other" || data.eventTypeOther.trim())) {
      maxPosition = 2;
      if (data.eventDate && data.eventTime) {
        maxPosition = 3;
        if (data.venueName.trim() && data.city.trim() && data.region) maxPosition = 4;
      }
    }
  }
  return { data, position: Math.min(stored.position, maxPosition), attempt };
}

export function writeBookingDraft(data: unknown, position: number) {
  try {
    sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify({
      version: 1, expiresAt: Date.now() + BOOKING_DRAFT_TTL,
      data: safeBookingData(data), position: Math.min(position, 6),
    }));
    return true;
  } catch { return false; }
}

export function writeBookingAttempt(data: unknown, status: "pending" | "saved", referenceId?: string) {
  // Callers must handle failure before making any request: submitting without
  // this marker requires an explicit warning about lost refresh protection.
  sessionStorage.setItem(BOOKING_ATTEMPT_KEY, JSON.stringify({
    version: 1, expiresAt: Date.now() + BOOKING_DRAFT_TTL,
    data: safeBookingData(data), position: 4, status, referenceId,
  }));
}
