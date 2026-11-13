import { test, expect } from "@playwright/test";
import { login, resetData, USERS } from "./helpers";
import { argentinaDate, argentinaTime } from "./support/oracle";
import { OrderPage } from "./support/pages";
import { ShopApi } from "./support/shopApi";
import { trace } from "./support/trace";

// Seed data: order 2 belongs to Ana and was placed at 2026-10-15T02:30Z (= Oct 14, 23:30 in Argentina).
// Order 3 belongs to Bruno.
const ANA_LATE_NIGHT_ORDER = 2;
const BRUNO_ORDER = 3;

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

test("[BUG-02] the API does not return another customer's order", trace({ caseKey: "ORD-01", ac: ["AC-12"], requirement: "SPEC › My orders: a logged-in user can see their orders", defect: "BUG-02", layer: "api", priority: "P1" }), async ({ request }) => {
  const ana = new ShopApi(request);
  await ana.login(USERS.ana);

  const res = await ana.order(BRUNO_ORDER);

  expect([403, 404], `GET /orders/${BRUNO_ORDER} as Ana answered ${res.status()}`).toContain(res.status());
  const body = await res.text();
  expect(body).not.toContain("Bruno");
  expect(body).not.toContain("Evergreen");
});

test("[BUG-02] a customer cannot open another customer's order page", trace({ caseKey: "ORD-02", ac: ["AC-12"], requirement: "SPEC › My orders: a logged-in user can see their orders", defect: "BUG-02", layer: "ui", priority: "P1" }), async ({ page }) => {
  await login(page, USERS.ana);
  const order = new OrderPage(page);

  await order.open(BRUNO_ORDER);

  await expect(order.error()).toBeVisible();
  await expect(page.getByTestId("order-shipping")).toHaveCount(0);
  await expect(page.getByText("Bruno Diaz")).toHaveCount(0);
});

test("[BUG-13] the API shows the order date in Argentina time for a late-night order", trace({ caseKey: "ORD-03", ac: ["AC-13"], requirement: "SPEC › My orders: dates and times in Argentina time", defect: "BUG-13", layer: "api", priority: "P2" }), async ({ request }) => {
  const ana = new ShopApi(request);
  await ana.login(USERS.ana);

  const res = await ana.order(ANA_LATE_NIGHT_ORDER);
  expect(res.status()).toBe(200);
  const order = await res.json();

  expect(order.displayTime).toBe(argentinaTime(order.createdAt));
  expect(order.displayDate).toBe(argentinaDate(order.createdAt));
  expect(order.displayDate).toBe("10/14/2026");
});

test("[BUG-13] My orders and the order detail show the Argentina date for a late-night order", trace({ caseKey: "ORD-04", ac: ["AC-13"], requirement: "SPEC › My orders: dates and times in Argentina time", defect: "BUG-13", layer: "ui", priority: "P2" }), async ({ page }) => {
  await login(page, USERS.ana);

  await page.getByTestId("nav-orders").click();
  await expect(page.getByTestId(`order-row-${ANA_LATE_NIGHT_ORDER}`)).toContainText("10/14/2026");

  const order = new OrderPage(page);
  await order.open(ANA_LATE_NIGHT_ORDER);
  await expect(order.date()).toHaveText("Date: 10/14/2026 · 23:30");
});
