import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { checkoutParameters, createCheckoutHandler } from "./stripe-checkout";

test("Studio parameters preserve one-time payment settings and sample values", () => {
  const params = checkoutParameters("http://localhost:3000");
  assert.deepEqual(Object.fromEntries(params), {
    ui_mode: "hosted_page", mode: "payment", billing_address_collection: "auto",
    "phone_number_collection[enabled]": "false", "automatic_tax[enabled]": "false",
    allow_promotion_codes: "false", submit_type: "auto",
    "name_collection[individual][enabled]": "true",
    "name_collection[individual][optional]": "true",
    integration_identifier: "hosted_web_0001", origin_context: "web",
    success_url: "http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "http://localhost:3000",
    "line_items[0][price]": "price_...", "line_items[0][quantity]": "1",
  });
  assert.equal(params.has("payment_method_collection"), false);
});

test("endpoint blocks placeholders, redirects success, and sanitizes failures", async () => {
  const app = express();
  app.post("/unconfigured", createCheckoutHandler({
    domain: "https://example.com", request: async () => { throw Error("Must not call Stripe"); },
  }));
  app.post("/success", createCheckoutHandler({
    domain: "https://example.com", priceId: "price_test_fixture",
    request: async body => {
      assert.equal(new URLSearchParams(body).get("line_items[0][price]"), "price_test_fixture");
      return Response.json({ url: "https://checkout.stripe.com/test-fixture" });
    },
  }));
  app.post("/failure", createCheckoutHandler({
    domain: "https://example.com", priceId: "price_test_fixture",
    request: async () => new Response("sensitive provider detail", { status: 400 }),
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  try {
    const post = (path: string) => fetch(`http://127.0.0.1:${address.port}${path}`, { method: "POST", redirect: "manual" });
    assert.equal((await post("/unconfigured")).status, 503);
    const success = await post("/success");
    assert.equal(success.status, 303);
    assert.equal(success.headers.get("location"), "https://checkout.stripe.com/test-fixture");
    const failure = await post("/failure");
    assert.equal(failure.status, 502);
    assert.equal((await failure.text()).includes("sensitive provider detail"), false);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
