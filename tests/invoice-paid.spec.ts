import { test, expect } from "@playwright/test";

// Browser-only fixtures: no credentials, database writes, or client emails.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/admin/me") {
      return route.fulfill({ json: { email: "admin@example.test", role: "superadmin" } });
    }
    if (path === "/api/admin/invoices") {
      return route.fulfill({ json: ["draft", "sent", "paid", "void"].map((status, index) => ({
        id: index + 1, invoiceNumber: `TEST-${index + 1}`, clientName: "Test Client",
        clientEmail: "client@example.test", eventName: "Test Event", items: "[]",
        discountCents: 0, taxCents: 0, totalCents: 15000, status,
        publicUrl: "/invoice/test", dueDate: null, paidAt: null,
      })) });
    }
    return route.fulfill({ json: [] });
  });
});

for (const [id, status] of [[1, "draft"], [2, "sent"]] as const) {
  test(`marks a ${status} invoice Paid before the request completes`, async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let saved = false;
    let calls = 0;
    await page.route(`**/api/admin/invoices/${id}/status`, async (route) => {
      calls++;
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({ status: "paid" });
      await gate;
      saved = true;
      await route.fulfill({ json: { id, invoiceNumber: `TEST-${id}`, status: "paid" } });
    });
    // Persist the saved fixture through the post-save list refresh.
    await page.route("**/api/admin/invoices", async (route) => {
      await route.fulfill({ json: [{
        id, invoiceNumber: `TEST-${id}`, clientName: "Test Client",
        clientEmail: "client@example.test", totalCents: 15000,
        status: saved ? "paid" : status, publicUrl: "/invoice/test",
      }] });
    });
    await page.goto("/admin");
    await page.getByRole("button", { name: "Invoices", exact: true }).click();
    const row = page.getByTestId(`row-invoice-${id}`);
    const button = page.getByTestId(`button-paid-invoice-${id}`);
    await expect(button.locator("svg")).toHaveCount(1);
    await button.click();
    await expect(row.locator("td").nth(4)).toHaveText("paid");
    await expect(button).toHaveCount(0);
    await expect(page.getByTestId(`button-send-invoice-${id}`)).toBeDisabled();
    await expect(page.getByTestId(`button-delete-invoice-${id}`)).toBeDisabled();
    expect(calls).toBe(1);
    release();
    await expect(page.getByText(`Invoice TEST-${id} marked Paid`, { exact: true })).toBeVisible();
    await expect(page.getByTestId(`button-send-invoice-${id}`)).toBeEnabled();
    await expect(row.locator("td").nth(4)).toHaveText("paid");
    await expect(button).toHaveCount(0);
  });
}

test("failed saves restore the original status and allow retry; paid and void have no action", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/admin/invoices/2/status", async (route) => {
    await gate;
    await route.fulfill({ status: 500, json: { message: "Could not save" } });
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Invoices", exact: true }).click();
  await expect(page.getByTestId("button-paid-invoice-1")).toBeVisible();
  await expect(page.getByTestId("button-paid-invoice-3")).toHaveCount(0);
  await expect(page.getByTestId("button-paid-invoice-4")).toHaveCount(0);
  await expect(page.getByTestId("row-invoice-3").locator("td").nth(4)).toHaveText("paid");
  await page.getByTestId("button-paid-invoice-2").click();
  const status = page.getByTestId("row-invoice-2").locator("td").nth(4);
  await expect(status).toHaveText("paid");
  release();
  await expect(page.getByText("Update failed", { exact: true })).toBeVisible();
  await expect(status).toHaveText("sent");
  await expect(page.getByTestId("button-paid-invoice-2")).toBeEnabled();
  await expect(page.getByTestId("button-send-invoice-2")).toBeEnabled();
});
