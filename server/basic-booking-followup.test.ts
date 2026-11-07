import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, pool } from "./db";
import { storage } from "./storage";
import { promotionBookings, scheduledEmailSends, newsletterSubscribers } from "@shared/schema";
import { BASIC_FOLLOWUP_KIND, basicFollowupDueAt, buildBasicFollowupEmail, queueBasicFollowup, runBasicFollowups } from "./basic-booking-followup";

async function main() {
  const submittedAt = new Date("2026-10-31T16:30:00Z");
  const due = basicFollowupDueAt(submittedAt);
  assert.equal(due, "2026-11-03T16:30:00.000Z", "72 elapsed hours across DST, not three local midnights");
  const template = buildBasicFollowupEmail({ contactName: "<Alex>", email: "fixture@example.com" }, "https://example.com");
  assert.equal(template.subject, "Your event is live on CGE.");
  assert.equal(template.text, "Hey <Alex>, your event is live on the CGE calendar. Want us to push it to our 6,100+ NJ followers? Reply to this email or upgrade your package at https://example.com/book.");
  assert.ok(template.html.includes("&lt;Alex&gt;"));
  assert.ok(!template.html.includes("<Alex>"));
  const base = { mode: "Basic", contactName: "Test", email: "basic-followup-fixture@example.com", venueName: "Test", eventDate: "2030-01-01", region: "North NJ", eventType: "Concert" };
  // Exercise the actual booking write, including its atomic durable enqueue.
  const booking = await storage.createBooking(base);
  try {
    const jobs = await db.select().from(scheduledEmailSends).where(eq(scheduledEmailSends.bookingId, booking.id));
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].kind, BASIC_FOLLOWUP_KIND);
    assert.equal(jobs[0].scheduledFor, basicFollowupDueAt(booking.createdAt!));
    assert.equal(jobs[0].recipientEmail, base.email);
  } finally {
    await db.delete(promotionBookings).where(eq(promotionBookings.id, booking.id));
  }
  const rollback = new Error("rollback");
  try {
    await db.transaction(async tx => {
      const [b] = await tx.insert(promotionBookings).values({ ...base, createdAt: submittedAt }).returning();
      await queueBasicFollowup(tx, b);
      const [job] = await tx.select().from(scheduledEmailSends).where(eq(scheduledEmailSends.bookingId, b.id));
      const mail: any[] = [];
      const options = { database: tx, onlyId: job.id, dryRun: false, sendMail: async (message: any) => { mail.push(message); } };
      await runBasicFollowups({ ...options, now: new Date(new Date(due).getTime() - 1) });
      assert.equal(mail.length, 0, "never send early");
      await runBasicFollowups({ ...options, now: new Date(due), dryRun: true });
      assert.equal(mail.length, 0, "dry run does not send or consume queue");
      const failure = await runBasicFollowups({ ...options, now: new Date(due), sendMail: async () => { throw new Error("test SMTP failure"); } });
      assert.equal(failure.failed, 1);
      assert.equal((await tx.select().from(scheduledEmailSends).where(eq(scheduledEmailSends.id, job.id)))[0].status, "pending");
      const sent = await runBasicFollowups({ ...options, now: new Date(due) });
      assert.equal(sent.sent, 1);
      assert.equal(mail[0].to, base.email);
      await runBasicFollowups({ ...options, now: new Date(due) });
      assert.equal(mail.length, 1, "repeat ticks cannot resend sent jobs");
      for (const state of ["paid", "cancelled", "upgraded", "unsubscribed"]) {
        const email = `${state}-basic-followup-fixture@example.com`;
        const [candidate] = await tx.insert(promotionBookings).values({ ...base, email, createdAt: submittedAt }).returning();
        await queueBasicFollowup(tx, candidate);
        if (state === "paid") await tx.update(promotionBookings).set({ paidAt: submittedAt }).where(eq(promotionBookings.id, candidate.id));
        if (state === "cancelled") await tx.update(promotionBookings).set({ status: "Cancelled" }).where(eq(promotionBookings.id, candidate.id));
        if (state === "upgraded") await tx.update(promotionBookings).set({ mode: "Growth" }).where(eq(promotionBookings.id, candidate.id));
        if (state === "unsubscribed") await tx.insert(newsletterSubscribers).values({ email, unsubscribedAt: submittedAt }).onConflictDoUpdate({ target: newsletterSubscribers.email, set: { unsubscribedAt: submittedAt } });
        const [candidateJob] = await tx.select().from(scheduledEmailSends).where(eq(scheduledEmailSends.bookingId, candidate.id));
        const result = await runBasicFollowups({ ...options, onlyId: candidateJob.id, now: new Date(due) });
        assert.equal(result.skipped, 1, state);
      }
      const [paidPackage] = await tx.insert(promotionBookings).values({ ...base, mode: "Starter" }).returning();
      await queueBasicFollowup(tx, paidPackage);
      assert.equal((await tx.select().from(scheduledEmailSends).where(eq(scheduledEmailSends.bookingId, paidPackage.id))).length, 0);
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  console.log("Basic follow-up checks passed: durable booking enqueue, exact 72h/DST, dry-run, retry, deduplication, cancellation/upgrade/unsubscribe; no real emails sent.");
  console.log("Scheduled email delivery mode:", (await storage.getSetting("cronDryRun")) === "false" ? "live" : "dry run");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
