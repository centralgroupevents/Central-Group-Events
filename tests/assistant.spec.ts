import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "../server/db";
import { events, eventOrganizerContacts } from "../shared/schema";
import { easternToday } from "../shared/assistant";

const marker = `assistant-browser-${randomUUID()}`;
let ids: number[] = [];
let submittedId: number | undefined;
const tomorrow = new Date(`${easternToday()}T12:00:00Z`);
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const eventDate = tomorrow.toISOString().slice(0, 10);

test.beforeAll(async () => {
  const fixtures = await db.insert(events).values([
    { title: "CGE Test Karaoke Tickets", ticketLink: "https://example.com/cge-test-tickets", instagramHandle: null },
    { title: "CGE Test Karaoke Social", ticketLink: null, instagramHandle: "centralgroupevents" },
    { title: "CGE Test Karaoke Unlinked", ticketLink: null, instagramHandle: null },
  ].map(row => ({
    ...row, description: "Temporary browser test fixture", date: eventDate, eventTime: "19:30",
    region: "North NJ", city: "Newark", venue: "CGE Test Venue", genre: "Karaoke",
    sourceId: marker, imageUrl: "/images/event-placeholder.svg", isFeatured: false,
  }))).returning({ id: events.id });
  ids = fixtures.map(row => row.id);
});
test.afterAll(async () => {
  await db.delete(events).where(inArray(events.id, submittedId ? [...ids, submittedId] : ids));
  await pool.end();
});

test("desktop live Claude recommendations, sticky bar, ticket nudge, persistence and admin exclusion", async ({ page, context }) => {
  await context.route("https://example.com/cge-test-tickets", route => route.fulfill({ body: "Test ticket destination" }));
  await page.goto("/");
  const input = page.getByRole("searchbox", { name: "Ask about New Jersey events" });
  await expect(input).toBeVisible();
  await input.fill(`Find CGE Test Karaoke in North Jersey on ${eventDate}`);
  await page.getByRole("button", { name: "Search events", exact: true }).click();
  await expect(page.getByRole("heading", { name: "CGE Test Karaoke Tickets", exact: true })).toBeVisible({ timeout: 45000 });
  await expect(page.getByRole("link", { name: "Learn more for CGE Test Karaoke Social (opens in a new tab)", exact: true })).toHaveAttribute("href", "https://www.instagram.com/centralgroupevents/");
  const noLink = page.locator("article").filter({ has: page.getByRole("heading", { name: "CGE Test Karaoke Unlinked", exact: true }) });
  await expect(noLink.locator("a")).toHaveCount(0);
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Get tickets for CGE Test Karaoke Tickets (opens in a new tab)", exact: true }).click();
  const popup = await popupPromise;
  await popup.close();
  await expect(page.getByText("Next time just ask the assistant -- it’ll find this for you faster", { exact: true })).toBeVisible({ timeout: 6000 });
  await page.evaluate(() => window.scrollTo(0, 1600));
  await expect(input).toBeInViewport();
  const position = await input.evaluate(el => {
    const nav = document.querySelector("header")!.getBoundingClientRect();
    return { top: el.getBoundingClientRect().top, navBottom: nav.bottom };
  });
  expect(position.top).toBeGreaterThanOrEqual(position.navBottom);
  await input.fill("same place tomorrow");
  await expect(input).toBeFocused();
  await page.goto("/blog");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "CGE Test Karaoke Tickets", exact: true })).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByRole("searchbox", { name: "Ask about New Jersey events" })).toHaveCount(0);
  const newTab = await context.newPage();
  await newTab.goto("/");
  await expect(newTab.getByRole("heading", { name: "CGE Test Karaoke Tickets", exact: true })).toHaveCount(0);
  await newTab.close();
});

test("mobile error retry, live off-topic guardrail and homepage booking navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const input = page.getByRole("searchbox", { name: "Ask about New Jersey events" });
  await page.route("**/api/assistant/chat", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Test temporary failure" }) }));
  await input.fill("Explain quantum computing");
  await page.getByRole("button", { name: "Search events", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Test temporary failure");
  await expect(input).toHaveValue("Explain quantum computing");
  await page.unroute("**/api/assistant/chat");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText(/Yo, I’m only plugged into the NJ scene/)).toBeVisible({ timeout: 45000 });
  await page.getByRole("button", { name: "Submit my event", exact: true }).click();
  await expect(page).toHaveURL(/#book$/);
  await expect(page.locator("#cge-assistant-results")).toBeHidden();
  await expect(page.getByTestId("button-get-started")).toBeInViewport();
  await expect(page.getByTestId("button-get-started")).toHaveAttribute("href", "/book");
});
