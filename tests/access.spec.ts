import { test, expect } from "@playwright/test";
import { resetData, USERS } from "./helpers";
import { ProductPage } from "./support/pages";
import { trace } from "./support/trace";

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

test("a guest who goes to checkout is asked to log in and returns to checkout", trace({ caseKey: "AUTH-02", ac: ["AC-10"], requirement: "SPEC › Checkout: if the user isn't logged in, they must log in before paying", layer: "ui", priority: "P2" }), async ({ page }) => {
  await new ProductPage(page).open(1);
  await new ProductPage(page).add(1);

  await page.goto("/checkout");
  await expect(page.getByTestId("login-required")).toBeVisible();
  await page.getByTestId("login-email").fill(USERS.ana.email);
  await page.getByTestId("login-password").fill(USERS.ana.password);
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByTestId("checkout-total")).toHaveText("$8.35");
});

test("the API refuses checkout, orders and payments without a session", trace({ caseKey: "AUTH-03", ac: ["AC-10", "AC-12"], requirement: "docs/API.md › 401 not logged in", layer: "api", priority: "P2" }), async ({ request }) => {
  expect((await request.post("/api/checkout", { data: {} })).status()).toBe(401);
  expect((await request.get("/api/orders")).status()).toBe(401);
  expect((await request.get("/api/payments")).status()).toBe(401);
});
