import { test, expect } from "@playwright/test";
import { login, resetData } from "./helpers";
import { CATALOG, money } from "./support/oracle";
import { CheckoutPage, OrderPage, ProductPage } from "./support/pages";
import { ShopApi } from "./support/shopApi";
import { DECLINED_CARD, VALID_CARD, VALID_SHIPPING } from "./support/checkoutData";
import { trace } from "./support/trace";

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

test("[BUG-01] a payment over $100 that the bank approves ends in the order confirmation, with exactly one charge", trace({ caseKey: "PAY-01", ac: ["AC-11"], requirement: "SPEC › Checkout: on confirmation the payment is processed and the order is created", defect: "BUG-01", layer: "ui", priority: "P1" }), async ({ page }) => {
  await login(page);
  const api = new ShopApi(page.request);
  const paymentsBefore = await api.payments();

  await new ProductPage(page).open(CATALOG.chair.id);
  await new ProductPage(page).add(1);
  const checkout = new CheckoutPage(page);
  await checkout.open();
  await checkout.pay({ ...VALID_SHIPPING, card: VALID_CARD });

  const order = new OrderPage(page);
  await expect(order.success()).toBeVisible({ timeout: 10_000 });
  await expect(order.total()).toHaveText(money(CATALOG.chair.price));
  await expect(checkout.error()).toHaveCount(0);

  const paymentsAfter = await api.payments();
  expect(paymentsAfter).toHaveLength(paymentsBefore.length + 1);
  expect(paymentsAfter[0].amount).toBe(CATALOG.chair.price);
});

test("[BUG-01] a declined card on an order over $100 tells the user the bank declined it", trace({ caseKey: "PAY-02", ac: ["AC-11"], requirement: "docs/API.md › 402 payment declined (cards ending in 0000)", defect: "BUG-01", layer: "ui", priority: "P1" }), async ({ page }) => {
  await login(page);
  await new ProductPage(page).open(CATALOG.chair.id);
  await new ProductPage(page).add(1);
  const checkout = new CheckoutPage(page);
  await checkout.open();
  await checkout.pay({ ...VALID_SHIPPING, card: DECLINED_CARD });

  await expect(checkout.error()).toHaveText("The payment was declined by the bank.", { timeout: 10_000 });
});
