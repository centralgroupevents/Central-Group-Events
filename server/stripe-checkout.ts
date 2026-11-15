import type { RequestHandler } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

// Scenario B placeholders from Checkout Studio; see STRIPE_INTEGRATION_TODO.md.
export const CHECKOUT_PRICE_ID = "price_...";

export function checkoutParameters(domain: string, priceId = CHECKOUT_PRICE_ID) {
  return new URLSearchParams({
    ui_mode: "hosted_page",
    mode: "payment",
    billing_address_collection: "auto",
    "phone_number_collection[enabled]": "false",
    "automatic_tax[enabled]": "false",
    allow_promotion_codes: "false",
    submit_type: "auto",
    "name_collection[individual][enabled]": "true",
    "name_collection[individual][optional]": "true",
    integration_identifier: "hosted_web_0001",
    origin_context: "web",
    success_url: `${domain}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: domain,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
  });
}

type CheckoutDependencies = {
  domain?: string;
  priceId?: string;
  request?: (body: string) => Promise<Response>;
};

export function createCheckoutHandler(options: CheckoutDependencies = {}): RequestHandler {
  return async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const domain = options.domain ?? process.env.DOMAIN;
    const priceId = options.priceId ?? CHECKOUT_PRICE_ID;
    // Do not create unusable sessions while the Studio placeholders remain.
    if (!domain || !/^https?:\/\/[^/]+$/.test(domain) || priceId === "price_...") {
      return res.status(503).json({ message: "Checkout setup is incomplete. See STRIPE_INTEGRATION_TODO.md." });
    }
    try {
      const request = options.request ?? ((body: string) =>
        new ReplitConnectors().proxy("stripe", "/v1/checkout/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
          signal: AbortSignal.timeout(15000),
        }));
      const response = await request(checkoutParameters(domain, priceId).toString());
      if (!response.ok) throw new Error("Checkout provider rejected request");
      const session = await response.json() as { url?: string };
      if (!session.url || new URL(session.url).protocol !== "https:") {
        throw new Error("Checkout URL missing or invalid");
      }
      return res.redirect(303, session.url);
    } catch {
      // Never expose provider bodies, customer data, or credentials.
      console.error("[stripe/checkout] Session creation failed");
      return res.status(502).json({ message: "Unable to start checkout. Please try again later." });
    }
  };
}
