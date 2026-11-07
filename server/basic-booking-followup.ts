import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "./db";
import { promotionBookings, scheduledEmailSends, newsletterSubscribers } from "@shared/schema";
import { complianceFooter, listUnsubscribeHeaders } from "./email-compliance";

export const BASIC_FOLLOWUP_KIND = "basic_upgrade_72h";
export const BASIC_FOLLOWUP_DELAY_MS = 72 * 60 * 60 * 1000;
type Database = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export function basicFollowupDueAt(submittedAt: Date): string {
  return new Date(submittedAt.getTime() + BASIC_FOLLOWUP_DELAY_MS).toISOString();
}

export async function queueBasicFollowup(
  database: Database,
  booking: { id: number; mode: string | null; email: string; createdAt: Date | null },
) {
  if (booking.mode !== "Basic") return;
  await database.insert(scheduledEmailSends).values({
    bookingId: booking.id,
    kind: BASIC_FOLLOWUP_KIND,
    scheduledFor: basicFollowupDueAt(booking.createdAt ?? new Date()),
    recipientEmail: booking.email,
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character]!));
}

export function buildBasicFollowupEmail(
  booking: { contactName: string | null; email: string },
  siteUrl = process.env.PUBLIC_SITE_URL || "https://centralgroupevents.com",
) {
  const name = booking.contactName?.trim() || "there";
  const link = new URL("/book", siteUrl).toString();
  const text = `Hey ${name}, your event is live on the CGE calendar. Want us to push it to our 6,100+ NJ followers? Reply to this email or upgrade your package at ${link}.`;
  return {
    subject: "Your event is live on CGE.",
    text,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;max-width:600px"><p>Hey ${escapeHtml(name)}, your event is live on the CGE calendar. Want us to push it to our 6,100+ NJ followers? Reply to this email or upgrade your package at <a href="${escapeHtml(link)}">${escapeHtml(link)}</a>.</p>${complianceFooter(booking.email, "You’re receiving this follow-up because you submitted a Basic event listing to CGE.", { dark: false })}</div>`,
  };
}

type Mail = ReturnType<typeof buildBasicFollowupEmail> & {
  from: string; to: string; replyTo: string | undefined; headers: Record<string, string>;
};

/** Durable queue, processed by the existing secret-protected scheduled-email tick.
 * Row locks prevent concurrent ticks/manual sends from sending the same row.
 * SMTP failures remain pending for retry on the next tick. Dry runs do not consume jobs.
 */
export async function runBasicFollowups(options: {
  sendMail: (mail: Mail) => Promise<unknown>;
  dryRun: boolean;
  now?: Date;
  database?: Database;
  onlyId?: number;
}) {
  const database = options.database ?? db;
  const now = options.now ?? new Date();
  const result = { sent: 0, skipped: 0, failed: 0, dryRun: options.dryRun };
  if (options.dryRun) return result;
  await database.transaction(async tx => {
    const rows = await tx.select().from(scheduledEmailSends).where(and(
      eq(scheduledEmailSends.kind, BASIC_FOLLOWUP_KIND),
      eq(scheduledEmailSends.status, "pending"),
      lte(scheduledEmailSends.scheduledFor, now.toISOString()),
      options.onlyId === undefined ? undefined : eq(scheduledEmailSends.id, options.onlyId),
    )).orderBy(scheduledEmailSends.scheduledFor).limit(25).for("update", { skipLocked: true });
    for (const row of rows) {
      const [booking] = await tx.select().from(promotionBookings).where(eq(promotionBookings.id, row.bookingId));
      const [unsubscribed] = await tx.select({ id: newsletterSubscribers.id }).from(newsletterSubscribers).where(and(
        sql`lower(${newsletterSubscribers.email}) = ${row.recipientEmail.trim().toLowerCase()}`,
        sql`${newsletterSubscribers.unsubscribedAt} IS NOT NULL`,
      )).limit(1);
      if (!booking || booking.mode !== "Basic" || booking.paidAt ||
          booking.status?.toLowerCase() === "cancelled" || unsubscribed) {
        await tx.update(scheduledEmailSends).set({
          status: "skipped", errorMessage: "Booking cancelled, upgraded, removed, or recipient unsubscribed",
        }).where(eq(scheduledEmailSends.id, row.id));
        result.skipped++;
        continue;
      }
      // Recheck the exact elapsed duration; never send early across DST changes.
      if (!booking.createdAt || basicFollowupDueAt(booking.createdAt) > now.toISOString()) continue;
      try {
        await options.sendMail({
          ...buildBasicFollowupEmail({ ...booking, email: row.recipientEmail }),
          from: `"Central Group Events" <${process.env.GMAIL_USER}>`,
          to: row.recipientEmail,
          replyTo: process.env.GMAIL_USER,
          headers: listUnsubscribeHeaders(row.recipientEmail),
        });
        await tx.update(scheduledEmailSends).set({
          status: "sent", sentAt: now, errorMessage: null, dryRun: false,
        }).where(eq(scheduledEmailSends.id, row.id));
        result.sent++;
      } catch {
        // Avoid storing SMTP messages that can contain credentials or recipient data.
        await tx.update(scheduledEmailSends).set({
          errorMessage: "SMTP send failed; will retry on the next scheduled tick",
        }).where(eq(scheduledEmailSends.id, row.id));
        result.failed++;
      }
    }
  });
  return result;
}
