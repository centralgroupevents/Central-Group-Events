# Stripe Checkout setup — single source of truth

## Status

Scenario B: no Checkout Session creation call existed. Added a minimal
`POST /api/create-checkout-session` endpoint using the connected Stripe API.
It intentionally returns **503** until the sample Price ID and domain are
configured. No payments have been tested against Stripe or enabled in the UI.
Existing booking buttons, database tables and payment status behavior are unchanged.

## Verified sandbox products

Created with user approval on November 14, 2026. Stripe confirmed `livemode: false`
for every product and price, with one-time USD prices. These are test-only resources;
the existing live-account products were not changed. Checkout is not yet wired to them.

| Package | Amount | Test Price ID | Test Product ID |
|---|---|---|---|
| Starter | $125 USD | `price_1UbuIuAR94PpJesws4E2Tf5b` | `prod_VdAeR0IlzPZqVN` |
| Growth | $250 USD | `price_1UbuIuAR94PpJesw2YWAPq0A` | `prod_VdAeSz95hF4mJ1` |
| Custom | $500 USD | `price_1UbuIvAR94PpJeswbfOTPxzs` | `prod_VdAeiFUKBozSq5` |

Use these IDs only with this sandbox connection. Do not substitute the supplied
live-account IDs into test checkout or enable live payments as part of testing.

## Values to Replace

**Files containing placeholders:**
- [server/stripe-checkout.ts](server/stripe-checkout.ts)

| Field | Current value | What to set |
|---|---|---|
| mode | `payment` | Already appropriate for one-time promotion packages; change only if introducing recurring billing. |
| success_url | `${DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}` | A real post-payment page. `/success` is a sample, not a new page built by this task. Keep the session-ID template. Never mark a booking paid based solely on a redirect. |
| cancel_url | `${DOMAIN}` | Your intended return page, such as the booking wizard. |
| line_items[0].price | `price_...` | An actual Stripe Price ID in the same test/live mode as the connected account. |
| DOMAIN | unset by this change; sample `http://localhost:3000` | Configure the actual staging origin in Replit environment settings, with no trailing slash. Use the verified production origin only for an approved live release. |

The single sample Price ID is not a completed package selector. Before wiring
the booking UI, select prices on the server using a validated booking/package.
Confirm Stripe prices match Starter $125, Growth $250, Custom $500; Basic stays free.
Do not accept amounts or arbitrary redirect URLs supplied by the browser.

## Configured Parameters

**File:** [server/stripe-checkout.ts](server/stripe-checkout.ts)

| Parameter | Value |
|---|---|
| ui_mode | `hosted_page` |
| billing_address_collection | `auto` |
| phone_number_collection.enabled | `false` |
| automatic_tax.enabled | `false` |
| allow_promotion_codes | `false` |
| submit_type | `auto` |
| name_collection.individual.enabled | `true` |
| name_collection.individual.optional | `true` |
| integration_identifier | `hosted_web_0001` |
| origin_context | `web` |

`payment_method_collection: always` is deliberately omitted for `payment` mode,
as required by the supplied instructions. Include it only for subscriptions.

## Dependencies and credentials

- Installed `@replit/connectors-sdk`; it securely authenticates to the connected
  Stripe account. No secret values are placed in source or `.env`.
- Uses the Stripe REST equivalent of `stripe.checkout.sessions.create`, via
  `POST /v1/checkout/sessions`. No Stripe SDK or API version is pinned.
- Because there is no Stripe SDK version, `ui_mode` defaults to `hosted_page`
  per the provided versioning rule. Verify these Studio fields against the
  connected account's API version in test mode before enabling checkout.
- No publishable key is needed for a server-redirect-only flow. No new webhook
  secret is needed until webhook fulfillment is implemented. Do not add server
  secrets with a `VITE_` prefix.
- Do not reuse live credentials in staging. Confirm the connected account is
  in test/sandbox mode before creating test sessions.

## Flow and files

1. A form POSTs to `/api/create-checkout-session` (not wired into the UI yet).
2. The existing form rate limiter applies.
3. The server validates configuration and sends the fixed Studio parameters.
4. Stripe returns a hosted URL; the server redirects with HTTP 303.
5. Provider failures return a generic 502; placeholder setup returns 503.

Files added:
- [server/stripe-checkout.ts](server/stripe-checkout.ts): parameters and handler.
- [server/stripe-checkout.test.ts](server/stripe-checkout.test.ts): mocked tests.
- This checklist.

Route registered in [server/routes.ts](server/routes.ts).

## Testing and next steps

1. Replace placeholders in staging; verify test mode and all configured fields.
2. Run `npx tsx --test server/stripe-checkout.test.ts`, `npm run check`, and
   `npm run build`. Mock tests do not prove Stripe accepts the configuration.
3. In Stripe test mode, use `4242 4242 4242 4242`, a future expiry and any
   three-digit CVC. Never use real cards in tests. Test decline behavior with
   `4000 0000 0000 0002` and authentication with `4000 0025 0000 3155`.
4. Before live use, associate sessions with bookings, persist identifiers using
   the application's data model, and implement signature-verified, idempotent
   webhook fulfillment/order tracking. No existing Stripe-ID persistence pattern
   was found, so none was invented for this minimal task.
5. Implement a verified success page and connect the booking UI only after the
   payment lifecycle is tested. A successful redirect is not proof of payment.
6. Review refunds, failed/cancelled payments, retries, duplicate submissions,
   package-price matching and production credentials before publishing.

Resources: https://support.stripe.com and https://docs.stripe.com/mcp
