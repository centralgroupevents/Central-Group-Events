import { expect, test } from "@playwright/test";
import { PACKAGES, getIncludedPackageFeatures } from "../src/lib/promotion-packages";
import { ASSISTANT_SESSION_KEY } from "../src/lib/assistant-session";
import { BOOKING_DRAFT_KEY, BOOKING_ATTEMPT_KEY, BOOKING_DRAFT_TTL } from "../src/lib/booking-draft";

test.beforeEach(async ({ page }) => {
  // The preview proxy's banner is not application UI. Install on every document,
  // including reloads and history navigations, before measuring viewport geometry.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "#replit-dev-banner { display: none !important; }";
      document.head.appendChild(style);
    }, { once: true });
  });
  // Block every API write, not just bookings: no email, analytics, or model side effects.
  // Per-test routes registered later override these safe defaults.
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().method() === "GET"
      ? (path === "/api/auth/user" ? null : [])
      : path === "/api/assistant/chat"
        ? { reply: "Your Newark plans stay in this chat.", events: [], suggestedCriteria: [] }
        : {};
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
});

test("legacy pricing direct loads replace the bookmark without a history loop", async ({ page }) => {
  await page.goto("/faq");
  await page.goto("/#pricing");
  await expect(page).toHaveURL(/\/book$/);
  await expect(page.getByRole("heading", { name: "Choose Your Package", exact: true })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/book$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/faq$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/book$/);
});

test("legacy pricing hash changes redirect and leave Back usable", async ({ page }) => {
  await page.goto("/#events");
  await expect(page.getByTestId("button-submit-event")).toBeAttached();
  await page.evaluate(() => { window.location.hash = "pricing"; });
  await expect(page).toHaveURL(/\/book$/);
  await expect(page.getByRole("heading", { name: "Choose Your Package", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/#events$/);
  // A remounted homepage must still handle later hash changes.
  await expect(page.getByTestId("button-submit-event")).toBeAttached();
  await page.evaluate(() => { window.location.hash = "pricing"; });
  await expect(page).toHaveURL(/\/book$/);
});

test("other homepage anchors and pricing hashes on other pages stay unchanged", async ({ page }) => {
  await page.goto("/#events");
  await expect(page.getByTestId("button-submit-event")).toBeAttached();
  await expect(page).toHaveURL(/\/#events$/);
  for (const hash of ["newsletter", "book", "services"]) {
    await page.evaluate(hash => { window.location.hash = hash; }, hash);
    await expect(page).toHaveURL(new RegExp(`/\\#${hash}$`));
    await expect(page.locator(`#${hash}`)).toBeAttached();
  }
  await page.goto("/faq#pricing");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/faq#pricing$/);
});

test("Step 1 hides every price and shows the Eastern promotion window", async ({ page }) => {
  // UTC Monday is still Sunday in NJ; the visitor timezone must not matter.
  await page.clock.setFixedTime(new Date("2026-07-06T03:30:00Z"));
  await page.goto("/book");
  await expect(page.getByText("Select the level of promotion that fits your event.", { exact: true })).toBeVisible();
  await expect(page.getByTestId("button-next-step")).toBeDisabled();
  for (const pkg of PACKAGES) {
    const card = page.getByTestId(pkg.testId);
    await expect(card).toContainText(pkg.label);
    for (const feature of pkg.features) await expect(card).toContainText(feature);
    await expect(card).not.toContainText(/\$|\bFREE\b/);
  }
  await expect(page.getByText("We run promotions on a weekly cycle. Slots for the current week fill up by Tuesday.", { exact: true })).toBeVisible();
  await expect(page.getByText("Next available promotion window: July 6, 2026", { exact: true })).toBeVisible();
  await expect(page.getByTestId("promotion-package-summary")).toHaveCount(0);
});

test("Monday uses the following Monday", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-06T04:00:00Z"));
  await page.goto("/book");
  await expect(page.getByText("Next available promotion window: July 13, 2026", { exact: true })).toBeVisible();
});

for (const pkg of PACKAGES) {
  test(`${pkg.label} reveals the full package only at Payment and preserves submission data`, async ({ page }) => {
    const submissions: Record<string, unknown>[] = [];
    await page.route("**/api/bookings", async route => {
      submissions.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201, contentType: "application/json",
        body: JSON.stringify({ referenceId: "frontend-test-booking" }),
      });
    });
    await page.goto(`/book?package=${pkg.id.toLowerCase()}`);
    const next = page.getByTestId("button-next-step");
    await expect(next).toBeEnabled();
    await expect(page.getByTestId(pkg.testId)).not.toContainText(/\$|\bFREE\b/);
    await next.click();
    await page.getByTestId("input-event-name").fill("Garden State Rooftop Sessions");
    await page.getByTestId("select-event-type").click();
    await page.getByRole("option", { name: "Concert", exact: true }).click();
    await next.click();
    await page.getByTestId("input-event-date").fill("2027-07-24");
    await page.getByTestId("input-event-time").fill("19:30");
    await next.click();
    await page.getByTestId("input-venue-name").fill("Riverfront Hall");
    await page.getByTestId("input-city").fill("Newark");
    await page.getByTestId("select-region").click();
    await page.getByRole("option", { name: "North NJ", exact: true }).click();
    await next.click();
    await page.getByTestId("input-contact-name").fill("Morgan Rivera");
    await page.getByTestId("input-email").fill("morgan@example.com");
    await page.getByTestId("checkbox-booking-newsletter-opt-in").uncheck();
    await next.click();
    await page.getByTestId("input-phone").fill("2015550194");
    await page.getByTestId("input-instagram-handle").fill("rooftopsessionsnj");
    await next.click();
    await expect(page.getByTestId("promotion-package-summary")).toHaveCount(0);
    await page.getByTestId("checkbox-terms").check();
    // Recovery deliberately requires contacts and fresh acceptance of terms.
    await page.reload();
    await expect(page.getByTestId("input-contact-name")).toHaveValue("");
    await expect(page.getByTestId("input-email")).toHaveValue("");
    await expect(page.getByTestId("checkbox-booking-newsletter-opt-in")).not.toBeChecked();
    const draft = await page.evaluate(key => sessionStorage.getItem(key), BOOKING_DRAFT_KEY);
    expect(draft).not.toMatch(/Morgan|morgan@|2015550194|rooftopsessionsnj|agreedToTerms/);
    await page.getByTestId("input-contact-name").fill("Morgan Rivera");
    await page.getByTestId("input-email").fill("morgan@example.com");
    await next.click();
    await expect(page.getByTestId("input-phone")).toHaveValue("");
    await expect(page.getByTestId("input-instagram-handle")).toHaveValue("");
    await page.getByTestId("input-phone").fill("2015550194");
    await page.getByTestId("input-instagram-handle").fill("rooftopsessionsnj");
    await next.click();
    await expect(page.getByTestId("checkbox-terms")).not.toBeChecked();
    await page.getByTestId("checkbox-terms").check();
    await next.click();

    const reveal = page.getByTestId("promotion-package-summary");
    await expect(reveal.getByRole("heading", { name: "Here’s your promotion package", exact: true })).toBeVisible();
    await expect(reveal.getByText(pkg.label, { exact: true })).toBeVisible();
    await expect(reveal.getByText(pkg.price, { exact: true })).toBeVisible();
    const features = getIncludedPackageFeatures(pkg.id);
    await expect(reveal.getByRole("listitem")).toHaveCount(features.length);
    for (const feature of features) await expect(reveal.getByText(feature, { exact: true })).toBeVisible();
    await expect(reveal).not.toContainText("Everything in");
    await expect(page.getByText("Booking saved", { exact: true })).toBeVisible();
    expect(submissions).toHaveLength(1);
    expect(submissions[0]).toMatchObject({
      mode: pkg.id, budgetRange: pkg.price, eventName: "Garden State Rooftop Sessions",
      email: "morgan@example.com", newsletterOptIn: false,
    });
    expect(await page.evaluate(key => sessionStorage.getItem(key), BOOKING_DRAFT_KEY)).toBeNull();
    await page.reload();
    await expect(page.getByText("Booking saved", { exact: true })).toBeVisible();
    expect(submissions).toHaveLength(1);
    if (pkg.id === "Basic") {
      await expect(page.getByTestId("button-pay-now")).toHaveCount(0);
      await expect(page.getByText(/No payment is required for this Basic calendar listing/)).toBeVisible();
    } else {
      await expect(page.getByTestId("button-pay-now")).toHaveAttribute("href", "https://cash.app/$centralgroupevents");
    }
    await page.getByTestId("step-indicator-1").click();
    await expect(page.getByTestId(pkg.testId)).not.toContainText(/\$|\bFREE\b/);
    await expect(page.getByTestId("promotion-package-summary")).toHaveCount(0);
    await next.click();
    await expect(page.getByTestId("input-event-name")).toHaveValue("Garden State Rooftop Sessions");
  });
}

test("draft survives event and logistics refreshes, stays in one tab, and can be discarded", async ({ page, context }) => {
  await page.goto("/book?package=starter");
  await page.getByTestId("button-next-step").click();
  await page.getByTestId("input-event-name").fill("Unfinished concert");
  await page.reload();
  await expect(page.getByTestId("input-event-name")).toHaveValue("Unfinished concert");
  await page.getByTestId("select-event-type").click();
  await page.getByRole("option", { name: "Concert", exact: true }).click();
  await page.getByTestId("button-next-step").click();
  await page.getByTestId("input-event-date").fill("2027-07-24");
  await page.getByTestId("input-event-time").fill("19:30");
  await page.getByTestId("button-next-step").click();
  await page.getByTestId("input-city").fill("Newark");
  await page.reload();
  await expect(page.getByTestId("input-city")).toHaveValue("Newark");
  const other = await context.newPage();
  await other.route("**/api/**", route => route.fulfill({ json: [] }));
  await other.goto("/book");
  await expect(other.getByTestId("button-next-step")).toBeDisabled();
  expect(await other.evaluate(key => sessionStorage.getItem(key), BOOKING_DRAFT_KEY)).toBeNull();
  await other.close();
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByTestId("button-start-over").click();
  await expect(page.getByTestId("input-city")).toHaveValue("Newark");
  page.once("dialog", dialog => dialog.accept());
  await page.getByTestId("button-start-over").click();
  await expect(page.getByTestId("button-next-step")).toBeDisabled();
  expect(await page.evaluate(key => sessionStorage.getItem(key), BOOKING_DRAFT_KEY)).toBeNull();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Choose Your Package", exact: true })).toBeVisible();
});

const safeDraft = {
  mode: "Basic", eventName: "Draft event", eventType: "Concert", eventTypeOther: "",
  eventDate: "2027-07-24", eventTime: "19:30", venueName: "Hall", city: "Newark",
  region: "North NJ", newsletterOptIn: false,
};

for (const invalid of ["malformed", "expired", "future", "version", "type", "step", "date", "oversized"]) {
  test(`ignores ${invalid} draft without submitting`, async ({ page }) => {
    let writes = 0;
    await page.route("**/api/bookings", route => { writes++; return route.fulfill({ json: {} }); });
    await page.goto("/book");
    await page.evaluate(({ key, data, ttl, invalid }) => {
      const envelope = { version: 1, expiresAt: Date.now() + ttl, data, position: 6 };
      if (invalid === "expired") envelope.expiresAt = Date.now() - 1;
      if (invalid === "future") envelope.expiresAt += ttl;
      if (invalid === "version") envelope.version = 99;
      if (invalid === "type") (envelope.data as any).newsletterOptIn = "true";
      if (invalid === "step") envelope.position = 99;
      if (invalid === "date") envelope.data.eventDate = "2027-02-31";
      sessionStorage.setItem(key, invalid === "malformed" ? "{" : invalid === "oversized" ? "x".repeat(10001) : JSON.stringify(envelope));
    }, { key: BOOKING_DRAFT_KEY, data: safeDraft, ttl: BOOKING_DRAFT_TTL, invalid });
    await page.reload();
    await expect(page.getByTestId("button-next-step")).toBeDisabled();
    expect(writes).toBe(0);
    expect(await page.evaluate(key => sessionStorage.getItem(key), BOOKING_DRAFT_KEY)).toBeNull();
  });
}

test("pending submission recovery blocks replay and false confirmation", async ({ page }) => {
  let submissions = 0;
  await page.route("**/api/bookings", route => { submissions++; return route.fulfill({ json: {} }); });
  await page.goto("/book");
  await page.evaluate(({ key, data, ttl }) => {
    sessionStorage.setItem(key, JSON.stringify({
      version: 1, expiresAt: Date.now() + ttl, data: { ...data, mode: "Starter" }, position: 4, status: "pending",
    }));
  }, { key: BOOKING_ATTEMPT_KEY, data: safeDraft, ttl: BOOKING_DRAFT_TTL });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("cannot confirm");
  await expect(page.getByTestId("button-view-confirmation")).toBeDisabled();
  await expect(page.getByTestId("button-pay-now")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("cannot confirm");
  expect(submissions).toBe(0);
});

test("AI human-format time survives refresh and submits with refresh protection", async ({ page }) => {
  let submissions = 0;
  await page.route("**/api/ai/extract-event", route => route.fulfill({ json: {
    extracted: { eventName: "AI Concert", eventDate: "2027-07-24", eventTime: "9:00 PM",
      venue: "AI Hall", city: "Newark", instagramHandle: "privatehandle" },
  } }));
  await page.route("**/api/bookings", async route => {
    submissions++;
    expect(route.request().postDataJSON().eventTime).toBe("21:00");
    const marker = await page.evaluate(key => sessionStorage.getItem(key), BOOKING_ATTEMPT_KEY);
    expect(JSON.parse(marker!).status).toBe("pending");
    await route.fulfill({ status: 201, json: { referenceId: "ai-test-booking" } });
  });
  await page.goto("/book?package=starter");
  const next = page.getByTestId("button-next-step");
  await next.click();
  await page.getByTestId("ai-extract-file-input").setInputFiles({
    name: "flyer.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"),
  });
  await expect(page.getByTestId("input-event-name")).toHaveValue("AI Concert");
  await page.getByTestId("select-event-type").click();
  await page.getByRole("option", { name: "Concert", exact: true }).click();
  await next.click();
  await page.reload();
  await expect(page.getByTestId("input-event-date")).toHaveValue("2027-07-24");
  await expect(page.getByTestId("input-event-time")).toHaveValue("21:00");
  const draft = await page.evaluate(key => sessionStorage.getItem(key), BOOKING_DRAFT_KEY);
  expect(draft).not.toMatch(/flyer|base64|blob:|privatehandle/);
  await next.click();
  await expect(page.getByTestId("input-venue-name")).toHaveValue("AI Hall");
  await page.getByTestId("select-region").click();
  await page.getByRole("option", { name: "North NJ", exact: true }).click();
  await next.click();
  await page.getByTestId("input-contact-name").fill("Test Contact");
  await page.getByTestId("input-email").fill("test@example.com");
  await next.click();
  await page.getByTestId("input-instagram-handle").fill("testhandle");
  await next.click();
  await page.getByTestId("checkbox-terms").check();
  await next.click();
  await expect(page.getByText("Booking saved", { exact: true })).toBeVisible();
  await expect(page.getByTestId("button-pay-now")).toBeVisible();
  expect(submissions).toBe(1);
});

for (const blockedRead of [true, false]) {
test(`unavailable storage permits explicitly approved submission (blocked reads: ${blockedRead})`, async ({ page }) => {
  let submissions = 0;
  await page.route("**/api/bookings", route => {
    submissions++;
    return route.fulfill({ status: 201, json: { referenceId: "no-storage-booking" } });
  });
  await page.addInitScript(blockedRead => {
    Storage.prototype.setItem = () => { throw new DOMException("Blocked", "SecurityError"); };
    if (blockedRead) Storage.prototype.getItem = () => { throw new DOMException("Blocked", "SecurityError"); };
  }, blockedRead);
  await page.goto("/book?package=basic");
  await expect(page.getByRole("status")).toContainText("cannot be recovered");
  const next = page.getByTestId("button-next-step");
  await next.click();
  await page.getByTestId("input-event-name").fill("x".repeat(501));
  await expect(page.getByTestId("input-event-name")).toHaveValue("x".repeat(500));
  await page.getByTestId("input-event-name").fill("Still usable");
  await page.getByTestId("select-event-type").click();
  await page.getByRole("option", { name: "Concert", exact: true }).click();
  await next.click();
  await page.getByTestId("input-event-date").fill("2027-07-24");
  await page.getByTestId("input-event-time").fill("19:30");
  await next.click();
  await page.getByTestId("input-venue-name").fill("Hall");
  await page.getByTestId("input-city").fill("Newark");
  await page.getByTestId("select-region").click();
  await page.getByRole("option", { name: "North NJ", exact: true }).click();
  await next.click();
  await page.getByTestId("input-contact-name").fill("Test Contact");
  await page.getByTestId("input-email").fill("test@example.com");
  await next.click();
  await page.getByTestId("input-instagram-handle").fill("testhandle");
  await next.click();
  await page.getByTestId("checkbox-terms").check();
  page.once("dialog", async dialog => {
    expect(dialog.message()).toContain("without refresh protection");
    await dialog.dismiss();
  });
  await next.click();
  await expect(page.getByTestId("checkbox-terms")).toBeVisible();
  expect(submissions).toBe(0);
  page.once("dialog", dialog => dialog.accept());
  await next.click();
  await expect(page.getByText("Booking saved", { exact: true })).toBeVisible();
  expect(submissions).toBe(1);
});
}

test("a lost submission response retains the draft and never retries on refresh", async ({ page }) => {
  let submissions = 0;
  await page.route("**/api/bookings", route => {
    submissions++;
    return route.abort("failed");
  });
  await page.goto("/book");
  await page.evaluate(({ key, data, ttl }) => {
    sessionStorage.setItem(key, JSON.stringify({
      version: 1, expiresAt: Date.now() + ttl, data, position: 4,
    }));
  }, { key: BOOKING_DRAFT_KEY, data: safeDraft, ttl: BOOKING_DRAFT_TTL });
  await page.reload();
  await page.getByTestId("input-contact-name").fill("Test Contact");
  await page.getByTestId("input-email").fill("test@example.com");
  await page.getByTestId("button-next-step").click();
  await page.getByTestId("input-instagram-handle").fill("testhandle");
  await page.getByTestId("button-next-step").click();
  await page.getByTestId("checkbox-terms").check();
  await page.getByTestId("button-next-step").click();
  await expect(page.getByText("Submission unconfirmed", { exact: true })).toBeVisible();
  expect(submissions).toBe(1);
  expect(await page.evaluate(key => sessionStorage.getItem(key), BOOKING_DRAFT_KEY)).not.toBeNull();
  const marker = await page.evaluate(key => sessionStorage.getItem(key), BOOKING_ATTEMPT_KEY);
  expect(JSON.parse(marker!).status).toBe("pending");
  expect(marker).not.toMatch(/Test Contact|test@example.com|testhandle/);
  await page.reload();
  await expect(page.getByText("Submission unconfirmed", { exact: true })).toBeVisible();
  await expect(page.getByTestId("button-view-confirmation")).toBeDisabled();
  expect(submissions).toBe(1);
});

test("homepage removes the entire pricing section and keeps FAQ price facts with wizard guidance", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#pricing")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Pick Your Package", exact: true })).toHaveCount(0);
  await expect(page.locator("table")).toHaveCount(0);
  await expect(page.locator('a[href="#pricing"], a[href="/#pricing"]')).toHaveCount(0);
  await expect(page.getByText(/Pricing section above/)).toHaveCount(0);
  await page.getByRole("button", { name: "How do I submit my event or book promotion?" }).click();
  await expect(page.getByText(/Visit \/book to compare Packages/)).toBeVisible();
  await page.getByRole("button", { name: "How much does event promotion in NJ cost?" }).click();
  await expect(page.getByText(/Compare Packages in the booking wizard at \/book/)).toBeVisible();
  await expect(page.getByText(/Four tiers: Basic \(free calendar listing\), Starter \(\$70 per event\)/)).toBeVisible();
  // The newsletter now flows into discovery/services, without a leftover pricing wrapper.
  expect(await page.locator("#newsletter").evaluate(section => section.nextElementSibling?.id)).not.toBe("pricing");
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
  { width: 375, height: 812 },
]) {
  test(`Step 1 availability and all features fit the initial ${viewport.width}x${viewport.height} viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/book");
    const options = page.getByTestId("package-options");
    const availability = page.getByTestId("promotion-availability");
    await expect(availability).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId("button-next-step")).toBeInViewport({ ratio: 1 });
    for (const pkg of PACKAGES) {
      const card = page.getByTestId(pkg.testId);
      await expect(card).toBeInViewport({ ratio: 1 });
      for (const feature of pkg.features) await expect(card.getByText(feature, { exact: true })).toBeVisible();
    }
    expect(await availability.evaluate(element => element.previousElementSibling?.getAttribute("data-testid"))).toBe("package-options");
    const cardsBox = await options.boundingBox();
    const noteBox = await availability.boundingBox();
    const nextBox = await page.getByTestId("button-next-step").boundingBox();
    expect(noteBox!.y).toBeGreaterThanOrEqual(cardsBox!.y + cardsBox!.height);
    expect(noteBox!.y + noteBox!.height).toBeLessThanOrEqual(nextBox!.y);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const path of ["/", "/faq"]) {
  for (const mobile of [false, true]) {
    test(`${mobile ? "mobile" : "desktop"} Packages routes directly to /book from ${path}`, async ({ page }) => {
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1600, height: 900 });
      await page.goto(path);
      await page.addStyleTag({ content: "#replit-dev-banner { display: none !important; }" });
      await expect(page.getByRole("link", { name: "Pricing", exact: true })).toHaveCount(0);
      if (mobile) await page.getByTestId("button-mobile-menu-toggle").click();
      const packages = page.getByRole("link", { name: "Packages", exact: true }).filter({ visible: true });
      await expect(packages).toHaveAttribute("href", "/book");
      await packages.click();
      await expect(page).toHaveURL(/\/book$/);
      await expect(page.getByRole("heading", { name: "Choose Your Package", exact: true })).toBeVisible();
      await expect(page.getByTestId("assistant-search-bar")).toHaveCount(0);
    });
  }
}

for (const mobile of [false, true]) {
  test(`assistant suppresses at booking entry and restores without reopening manually closed chat (${mobile ? "mobile" : "desktop"})`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Ask about New Jersey events" }).fill("Newark tonight");
    await page.getByRole("button", { name: "Search events", exact: true }).click();
    await expect(page.getByText("Your Newark plans stay in this chat.")).toBeVisible();
    const saved = await page.evaluate(key => sessionStorage.getItem(key), ASSISTANT_SESSION_KEY);
    const bar = page.getByTestId("assistant-search-bar");
    const scrollBeforeBooking = async () => {
      await page.locator("#book").evaluate(element => window.scrollTo({
        top: element.getBoundingClientRect().top + window.scrollY - innerHeight - 80, behavior: "instant",
      }));
      await expect(bar).toHaveCSS("position", "fixed");
    };
    const enterBooking = async () => {
      // Only the first 30px enters; don't wait for the section heading to reach the top.
      await page.locator("#book").evaluate(element => window.scrollTo({
        top: element.getBoundingClientRect().top + window.scrollY - innerHeight + 30, behavior: "instant",
      }));
      await expect(bar).toBeHidden();
    };
    await scrollBeforeBooking();
    await enterBooking();
    await scrollBeforeBooking();
    await expect(bar).toBeVisible();
    expect(await page.evaluate(key => sessionStorage.getItem(key), ASSISTANT_SESSION_KEY)).toBe(saved);
    await page.getByRole("button", { name: "Close chat", exact: true }).click();
    await expect(page.locator("#cge-assistant-results")).toBeHidden();
    await enterBooking();
    await page.locator("#events").evaluate(element => element.scrollIntoView({ behavior: "instant" }));
    await expect(bar).toHaveCSS("position", "relative");
    await expect(page.locator("#cge-assistant-results")).toBeHidden();
    await expect(page.getByRole("button", { name: "Reopen chat", exact: true })).toHaveCount(1);
    expect(await page.evaluate(key => sessionStorage.getItem(key), ASSISTANT_SESSION_KEY)).toBe(saved);
  });
}

test("wizard stays assistant-free on direct loads, client navigation, reload, and history with saved chat", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Ask about New Jersey events" }).fill("Newark tonight");
  await page.getByRole("button", { name: "Search events", exact: true }).click();
  await expect(page.getByText("Your Newark plans stay in this chat.")).toBeVisible();
  const saved = await page.evaluate(key => sessionStorage.getItem(key), ASSISTANT_SESSION_KEY);
  const noAssistant = async () => {
    await expect(page).toHaveURL(/\/book$/);
    await expect(page.locator(".cge-assistant")).toHaveCount(0);
    expect(await page.evaluate(key => sessionStorage.getItem(key), ASSISTANT_SESSION_KEY)).toBe(saved);
  };
  await page.getByRole("button", { name: "Submit my event", exact: true }).click();
  await noAssistant();
  await page.goBack();
  await expect(page.getByText("Your Newark plans stay in this chat.")).toBeVisible();
  await page.goForward();
  await noAssistant();
  await page.reload();
  await noAssistant();
  await page.goto("/book");
  await noAssistant();
});

test("homepage booking CTAs all point directly to the wizard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("button-submit-event")).toHaveAttribute("href", "/book");
  await expect(page.getByRole("link", { name: "Promote Your Event", exact: true })).toHaveAttribute("href", "/book");
  await expect(page.getByRole("link", { name: "Book Promotion", exact: true })).toHaveAttribute("href", "/book");
  await page.getByTestId("button-submit-event").click();
  await expect(page).toHaveURL(/\/book$/);
  await expect(page.getByRole("heading", { name: "Choose Your Package", exact: true })).toBeVisible();
});

for (const path of ["/", "/faq"]) {
  test(`mobile Book Promotion routes to /book from ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    // The development proxy banner is not part of the app and covers its mobile menu.
    await page.addStyleTag({ content: "#replit-dev-banner { display: none !important; }" });
    await page.getByTestId("button-mobile-menu-toggle").click();
    const cta = page.getByRole("link", { name: "Book Promotion", exact: true }).filter({ visible: true });
    await expect(cta).toHaveAttribute("href", "/book");
    await cta.click();
    await expect(page).toHaveURL(/\/book$/);
    await expect(page.getByRole("heading", { name: "Choose Your Package", exact: true })).toBeVisible();
  });
}
