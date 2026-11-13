import { test, expect } from "@playwright/test";
import { login, resetData } from "./helpers";
import { trace } from "./support/trace";

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

test("[EXAMPLE] a test user can log in", trace({ caseKey: "AUTH-01", ac: ["AC-10"], requirement: "README › test users can log in", layer: "ui", priority: "P2" }), async ({ page }) => {
  await login(page);
  await expect(page.getByTestId("nav-orders")).toBeVisible();
});
