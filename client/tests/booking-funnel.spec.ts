import { expect, test } from "@playwright/test";
import { PACKAGES, getIncludedPackageFeatures } from "../src/lib/promotion-packages";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/funnel/track", route => route.fulfill({
    status: 200, contentType: "application/json", body: "{}",
  }));
});

test("Step 1 hides every price and shows the Eastern promotion window", async ({ page }) => {
  // UTC Monday is still Sunday in NJ; the visitor timezone must not matter.
  await page.clock.setFixedTime(new Date("2026-07-06T03:30:00Z"));
  await page.goto("/book");
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
    await next.click();
    await page.getByTestId("input-phone").fill("2015550194");
    await page.getByTestId("input-instagram-handle").fill("rooftopsessionsnj");
    await next.click();
    await expect(page.getByTestId("promotion-package-summary")).toHaveCount(0);
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
      email: "morgan@example.com", newsletterOptIn: true,
    });
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
