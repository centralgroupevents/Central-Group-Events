import { test, expect, type Page } from "@playwright/test";

async function openInvoices(page: Page, today: string, yesterday: string, tomorrow: string) {
  // Browser-only fixtures; never send emails or write real invoices.
  const invoices = [
    { status: "sent", dueDate: yesterday },
    { status: "sent", dueDate: today },
    { status: "sent", dueDate: tomorrow },
    { status: "sent", dueDate: null },
    { status: "paid", dueDate: yesterday },
    { status: "draft", dueDate: yesterday },
    { status: "void", dueDate: yesterday },
  ].map((invoice, index) => ({
    id: index + 1, invoiceNumber: `OVERDUE-${index + 1}`,
    clientName: "Test Client", clientEmail: "client@example.test",
    totalCents: 15000, publicUrl: "/invoice/test", ...invoice,
  }));
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path === "/api/admin/me"
      ? { email: "admin@example.test", role: "superadmin" }
      : path === "/api/admin/invoices" ? invoices : [] });
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Invoices", exact: true }).click();
}

for (const boundary of [
  { name: "west of UTC late on New Year's Eve", zone: "America/Los_Angeles", now: "2027-01-01T07:59:00Z", today: "2026-12-31", yesterday: "2026-12-30", tomorrow: "2027-01-01" },
  { name: "east of UTC just after New Year", zone: "Pacific/Auckland", now: "2026-12-31T11:01:00Z", today: "2027-01-01", yesterday: "2026-12-31", tomorrow: "2027-01-02" },
  { name: "after leap day at local midnight", zone: "America/New_York", now: "2028-03-01T05:00:00Z", today: "2028-03-01", yesterday: "2028-02-29", tomorrow: "2028-03-02" },
]) {
  test.describe(boundary.name, () => {
    test.use({ timezoneId: boundary.zone });
    test("only past-due sent invoices are highlighted", async ({ page }) => {
      await page.clock.setFixedTime(new Date(boundary.now));
      await openInvoices(page, boundary.today, boundary.yesterday, boundary.tomorrow);
      await expect(page.getByTestId("badge-overdue-invoice-1")).toHaveText("Overdue");
      await expect(page.getByTestId("row-invoice-1").locator("td").nth(5)).toHaveClass(/text-amber-400/);
      await expect(page.getByTestId("row-invoice-1").locator("td").nth(4)).toHaveText("sent");
      for (let id = 2; id <= 7; id++) {
        await expect(page.getByTestId(`badge-overdue-invoice-${id}`)).toHaveCount(0);
        await expect(page.getByTestId(`row-invoice-${id}`).locator("td").nth(5)).not.toHaveClass(/text-amber-400/);
      }
      await expect(page.getByTestId("row-invoice-2").locator("td").nth(5)).toHaveText(boundary.today);
      await expect(page.getByTestId("row-invoice-4").locator("td").nth(5)).toHaveText("—");
    });
  });
}

test("marking paid clears overdue immediately and a failed save restores it", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-07T12:00:00Z"));
  await openInvoices(page, "2026-11-07", "2026-11-06", "2026-11-08");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/admin/invoices/1/status", async (route) => {
    await gate;
    await route.fulfill({ status: 500, json: { message: "Could not save" } });
  });
  const badge = page.getByTestId("badge-overdue-invoice-1");
  await expect(badge).toBeVisible();
  await page.getByTestId("button-paid-invoice-1").click();
  await expect(badge).toHaveCount(0);
  release();
  await expect(page.getByText("Update failed", { exact: true })).toBeVisible();
  await expect(badge).toBeVisible();
});
