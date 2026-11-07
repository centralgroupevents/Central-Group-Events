import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({
    contentType: "application/json",
    body: new URL(route.request().url()).pathname === "/api/auth/user" ? "null" : "[]",
  }));
});

for (const width of [1440, 390]) {
  test(`static photo treatments at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const instagramRequests: string[] = [];
    page.on("request", request => {
      if (request.url().includes("/api/instagram")) instagramRequests.push(request.url());
    });
    await page.goto("/");
    const strip = page.getByTestId("homepage-photo-strip");
    const originals = page.getByTestId("photo-strip-originals");
    await expect(originals.locator(":scope > div")).toHaveCount(8);
    await expect(originals.locator(":scope > div").first()).toHaveText("CGE EVENT PHOTO");
    await expect(originals.locator(":scope > div").first()).toHaveCSS("width", "400px");
    await expect(originals.locator(":scope > div").first()).toHaveCSS("height", "500px");
    await expect(page.getByTestId("photo-strip-duplicate")).toHaveAttribute("aria-hidden", "true");
    expect(await strip.evaluate(el =>
      !!(document.querySelector("#events")!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
      && !!(el.compareDocumentPosition(document.querySelector("#newsletter")!) & Node.DOCUMENT_POSITION_FOLLOWING)
    )).toBe(true);
    const track = page.getByTestId("photo-strip-track");
    await expect(track).toHaveCSS("animation-name", "cge-photo-loop");
    await strip.hover();
    await expect(track).toHaveCSS("animation-play-state", "paused");
    await page.getByTestId("button-photo-strip-pause").click();
    await expect(page.getByTestId("button-photo-strip-pause")).toHaveAttribute("aria-pressed", "true");
    await page.mouse.move(0, 0);
    await expect(track).toHaveCSS("animation-play-state", "paused");
    const grid = page.getByTestId("instagram-feed-grid");
    await expect(grid.locator(":scope > div")).toHaveCount(12);
    expect(await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(width === 390 ? 2 : 3);
    await expect(grid.locator("svg")).toHaveCount(12);
    for (const id of ["homepage-services", "homepage-process"]) {
      const section = page.getByTestId(id);
      expect(await section.evaluate(el => getComputedStyle(el).backgroundImage)).toContain("gradient");
      expect(await section.evaluate(el => getComputedStyle(el).backgroundImage)).not.toContain("url(");
    }
    await expect(page.getByRole("link", { name: "@centralgroupevents", exact: true })).toBeAttached();
    expect(instagramRequests).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await grid.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `generated-artifacts/instagram-placeholders-${width}.png` });
    await strip.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `generated-artifacts/photo-strip-${width}.png` });
  });
}

test("reduced motion disables the strip loop", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByTestId("photo-strip-track")).toHaveCSS("animation-name", "none");
  await expect(page.getByTestId("photo-strip-duplicate")).toBeHidden();
  await expect(page.getByTestId("button-photo-strip-pause")).toBeDisabled();
});
