import assert from "node:assert/strict";
import test from "node:test";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { api } from "../shared/routes";
import { insertEventSchema, invoiceInputSchema } from "../shared/schema";

test("Drizzle-generated booking validation strips server-only fields", () => {
  const booking = api.bookings.create.input.parse({
    venueName: "Fixture venue", eventDate: "2030-01-01", region: "North NJ",
    eventType: "Concert", email: "fixture@example.test",
    id: 999, referenceId: "untrusted", adminNotes: "untrusted",
  });
  assert.equal(booking.email, "fixture@example.test");
  for (const key of ["id", "referenceId", "adminNotes"]) {
    assert.equal(key in booking, false);
  }
});

test("validation failures retain the API's message and field shape", () => {
  const result = api.subscribers.create.input.safeParse({ email: "not-an-email" });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.ok(result.error instanceof z.ZodError);
  const issue = result.error.issues[0];
  assert.equal(issue.path.join("."), "email");
  assert.ok(api.subscribers.create.responses[400].parse({
    message: issue.message, field: issue.path.join("."),
  }).message);
  assert.match(fromError(result.error).message, /email/i);
});

test("generated schemas and invoice schemas retain defaults and limits", () => {
  const event = insertEventSchema.parse({
    title: "Fixture event", date: "2030-01-01", region: "North NJ",
  });
  assert.equal(event.description, "");
  assert.equal(event.imageUrl, "");
  const invoice = {
    clientName: "Fixture", clientEmail: "fixture@example.test",
    items: [{ description: "Promotion", quantity: 1, unitPriceCents: 7000 }],
  };
  assert.equal(invoiceInputSchema.parse(invoice).discountCents, 0);
  assert.equal(invoiceInputSchema.parse(invoice).taxCents, 0);
  assert.equal(invoiceInputSchema.safeParse({ ...invoice, items: [] }).success, false);
  assert.equal(invoiceInputSchema.safeParse({
    ...invoice, items: Array.from({ length: 51 }, () => invoice.items[0]),
  }).success, false);
});

test("React Hook Form resolver supports patched Zod errors and successful values", async () => {
  const schema = z.object({ email: z.string().email("Invalid email address") });
  const resolve = zodResolver(schema);
  const options = { fields: {}, shouldUseNativeValidation: false };
  const invalid = await resolve({ email: "invalid" }, undefined, options);
  assert.equal(invalid.errors.email?.message, "Invalid email address");
  assert.deepEqual(invalid.values, {});
  const valid = await resolve({ email: "fixture@example.test" }, undefined, options);
  assert.deepEqual(valid.errors, {});
  assert.deepEqual(valid.values, { email: "fixture@example.test" });
});
