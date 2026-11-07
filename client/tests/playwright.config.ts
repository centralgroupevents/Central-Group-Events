import { defineConfig } from "@playwright/test";
import baseConfig from "../../playwright.config";

// Focused, mocked frontend suite; never includes the live Claude/DB suite.
export default defineConfig({
  ...baseConfig,
  testDir: ".",
  testMatch: "booking-funnel.spec.ts",
  outputDir: "../../generated-artifacts/playwright-funnel",
});
