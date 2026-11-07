import assert from "node:assert/strict";
import express from "express";
import { eq } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";
import { db, pool } from "./db";
import { events, eventOrganizerContacts } from "@shared/schema";
import { easternToday, submitAssistantEventSchema } from "@shared/assistant";
import { submitAssistantEvent, isFlyerImage, uploadAssistantFlyer } from "./assistant-submission";
import { registerAssistantRoutes } from "./assistant-routes";

async function main() {
  const payload = { title: "Assistant test fixture", description: "", date: easternToday(),
    eventTime: "19:30", region: "North NJ", city: "Newark", venue: "Test venue",
    organizerEmail: "test@example.com" };
  assert.equal(submitAssistantEventSchema.safeParse({ ...payload, organizerEmail: undefined }).success, false);
  assert.equal(submitAssistantEventSchema.safeParse({ ...payload, organizerEmail: "invalid" }).success, false);
  assert.equal(submitAssistantEventSchema.safeParse({ ...payload, isFeatured: true }).success, false);
  assert.equal(submitAssistantEventSchema.safeParse({ ...payload, ticketLink: "javascript:alert(1)" }).success, false);
  assert.equal(submitAssistantEventSchema.safeParse({ ...payload, imageUrl: "https://res.cloudinary.com.evil.test/a.png" }).success, false);
  assert.equal(submitAssistantEventSchema.safeParse({ ...payload, date: "2020-01-01" }).success, false);
  const sentinel = new Error("rollback");
  try {
    await db.transaction(async tx => {
      const response = await submitAssistantEvent(payload, tx);
      assert.deepEqual(Object.keys(response).sort(), ["id", "message"]);
      const [event] = await tx.select().from(events).where(eq(events.id, response.id));
      assert.equal(event.isFeatured, false);
      assert.equal(event.description, payload.title);
      assert.ok(!("organizerEmail" in event) && !("email" in event));
      const [contact] = await tx.select().from(eventOrganizerContacts).where(eq(eventOrganizerContacts.eventId, response.id));
      assert.equal(contact.email, "test@example.com");
      throw sentinel;
    });
  } catch (error) { if (error !== sentinel) throw error; }

  const app = express();
  app.use(express.json());
  registerAssistantRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const invalid = await fetch(`${base}/api/assistant/submit-event`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(invalid.status, 400);
    const fake = new FormData();
    fake.append("file", new Blob(["not an image"], { type: "image/png" }), "fake.png");
    assert.equal((await fetch(`${base}/api/assistant/upload-flyer`, { method: "POST", body: fake })).status, 400);
    const oversized = new FormData();
    oversized.append("file", new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/png" }), "large.png");
    assert.equal((await fetch(`${base}/api/assistant/upload-flyer`, { method: "POST", body: oversized })).status, 400);
  } finally { server.close(); }
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=", "base64");
  assert.ok(isFlyerImage(png, "image/png"));
  assert.ok(!isFlyerImage(Buffer.from("<svg/>"), "image/png"));
  if (process.env.LIVE_UPLOAD === "1") {
    const url = await uploadAssistantFlyer(png);
    assert.ok(url.startsWith("https://res.cloudinary.com/"));
    const match = new URL(url).pathname.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    assert.ok(match);
    await cloudinary.uploader.destroy(match![1]);
    console.log("Live Cloudinary upload passed; test image deleted.");
  }
  console.log("Submission validation, contact privacy, image validation and upload-size checks passed; test rows rolled back.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
