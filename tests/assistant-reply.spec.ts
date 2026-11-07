import { test, expect } from "@playwright/test";

// All assistant requests are intercepted; no DB fixtures or live model calls.
const chatResponse = (reply: string) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ reply, events: [], suggestedCriteria: [] }),
});

test("bottom reply sends conversation history and retains failed drafts", async ({ page }) => {
  const requests: Array<{ message: string; history: Array<{ role: string; content: string }> }> = [];
  await page.route("**/api/assistant/chat", async route => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 2) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Please try that again." }) });
    } else {
      await route.fulfill(chatResponse(requests.length === 1 ? "Newark has your kind of night." : "Let's narrow it down to house music."));
    }
  });
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Ask about New Jersey events" }).fill("Find a night out in Newark");
  await page.getByRole("button", { name: "Search events", exact: true }).click();
  await expect(page.getByText("Newark has your kind of night.")).toBeVisible();
  const reply = page.getByRole("textbox", { name: "Your reply", exact: true });
  await expect(reply).toBeVisible();
  await reply.fill("Make it house music");
  await reply.press("Enter");
  await expect(page.getByRole("alert")).toContainText("Please try that again.");
  await expect(reply).toHaveValue("Make it house music");
  expect(requests[1]).toEqual({
    message: "Make it house music",
    history: [
      { role: "user", content: "Find a night out in Newark" },
      { role: "assistant", content: "Newark has your kind of night." },
    ],
  });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText("Let's narrow it down to house music.")).toBeVisible();
  await expect(reply).toHaveValue("");
  expect(requests[2]).toEqual(requests[1]);
});

test("closing during a pending request stays closed; reopen preserves completed history", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/assistant/chat", async route => {
    await gate;
    await route.fulfill(chatResponse("Your Newark plans are saved here."));
  });
  await page.goto("/");
  const input = page.getByRole("searchbox", { name: "Ask about New Jersey events" });
  await input.fill("Newark tonight");
  const pending = page.waitForRequest("**/api/assistant/chat");
  await input.press("Enter");
  await pending;
  const close = page.getByRole("button", { name: "Close chat", exact: true });
  await expect(close).toBeEnabled();
  await close.click();
  const results = page.locator("#cge-assistant-results");
  await expect(results).toBeHidden();
  const reopen = page.getByRole("button", { name: "Reopen chat", exact: true });
  await expect(reopen).toBeFocused();
  const completed = page.waitForResponse("**/api/assistant/chat");
  release();
  await completed;
  // Wait for the hook's completion while keeping the rendered conversation hidden.
  await expect(results).toContainText("Your Newark plans are saved here.");
  await expect(results).toBeHidden();
  await expect(page.getByTestId("assistant-search-bar")).toHaveCSS("position", "relative");
  await reopen.click();
  await expect(page.getByText("Your Newark plans are saved here.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Your reply", exact: true })).toBeFocused();
  await expect(results).toContainText("Newark tonight");
  await page.getByRole("textbox", { name: "Your reply", exact: true }).press("Escape");
  await expect(results).toBeHidden();
  await expect(reopen).toBeFocused();
  // A new hero query explicitly reopens the saved conversation.
  await input.fill("Try Jersey City instead");
  await expect(results).toBeVisible();
  await expect(results).toContainText("Newark tonight");
});

test("mobile sticky close remains available below the conversation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/assistant/chat", route => route.fulfill(chatResponse(
    Array.from({ length: 16 }, (_, index) => `Plan ${index + 1}: find your next night in Newark.`).join("\n\n"),
  )));
  await page.goto("/");
  const input = page.getByRole("searchbox", { name: "Ask about New Jersey events" });
  await input.fill("Give me a few plans");
  await input.press("Enter");
  const reply = page.getByRole("textbox", { name: "Your reply", exact: true });
  await expect(reply).toBeVisible();
  await reply.scrollIntoViewIfNeeded();
  const bar = page.getByTestId("assistant-search-bar");
  await expect(bar).toHaveCSS("position", "fixed");
  const close = page.getByRole("button", { name: "Close chat", exact: true });
  await expect(close).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await close.click();
  await expect(page.locator("#cge-assistant-results")).toBeHidden();
  await expect(bar).toHaveCSS("position", "relative");
  await page.getByRole("button", { name: "Reopen chat", exact: true }).click();
  await expect(reply).toBeVisible();
});

test("submit my event opens the booking wizard and preserves stored chat", async ({ page }) => {
  await page.route("**/api/assistant/chat", route => route.fulfill(chatResponse("Your chat is still here.")));
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Ask about New Jersey events" }).fill("Newark tonight");
  await page.getByRole("button", { name: "Search events", exact: true }).click();
  await expect(page.getByText("Your chat is still here.")).toBeVisible();
  await page.getByRole("button", { name: "Submit my event", exact: true }).click();
  await expect(page).toHaveURL(/\/book$/);
  await expect(page.getByRole("heading", { name: "Choose Your Package", exact: true })).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("Your chat is still here.")).toBeVisible();
});
