import { test, expect } from "@playwright/test";
import { resetData } from "./helpers";
import { CATALOG, expectedLineTotal, expectedTotals, money } from "./support/oracle";
import { CartPage, CatalogPage, ProductPage } from "./support/pages";
import { ShopApi } from "./support/shopApi";
import { goldenCheckout } from "./support/checkoutData";
import { trace } from "./support/trace";

const { mug, backpack } = CATALOG;

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

// The team's original test only checked that the total was visible. It now checks the value.
test("the cart total is calculated correctly", trace({ caseKey: "CART-01", ac: ["AC-04"], requirement: "SPEC › Cart: total per product and order total", layer: "ui", priority: "P2" }), async ({ page }) => {
  await page.goto("/product/1");
  await page.getByTestId("quantity-select").selectOption("2");
  await page.getByTestId("add-to-cart").click();
  await page.goto("/cart");
  await expect(page.getByTestId("cart-line-1")).toBeVisible();
  await expect(page.getByTestId("cart-line-total-1")).toHaveText(money(expectedLineTotal(mug.price, 2)));
  await expect(page.getByTestId("cart-total")).toHaveText(money(expectedTotals([{ price: mug.price, quantity: 2 }]).total));
});

test("[BUG-08] a product added with the catalog Add button is still in the cart after reloading", trace({ caseKey: "CART-02", ac: ["AC-06", "AC-02"], requirement: "SPEC › Cart: the cart persists even if the user closes the browser", defect: "BUG-08", layer: "ui", priority: "P2" }), async ({ page }) => {
  const catalog = new CatalogPage(page);
  await catalog.open();
  await catalog.quickAdd(mug.id);

  await page.reload();
  const cart = new CartPage(page);
  await cart.open();

  await expect(cart.line(mug.id)).toBeVisible();
  await expect(cart.quantity(mug.id)).toHaveValue("1");
  await expect(cart.total()).toHaveText(money(mug.price));
});

test("[BUG-08] catalog and product-page additions both survive a reload", trace({ caseKey: "CART-03", ac: ["AC-06", "AC-02"], requirement: "SPEC › Cart: the cart persists even if the user closes the browser", defect: "BUG-08", layer: "ui", priority: "P2" }), async ({ page }) => {
  await new ProductPage(page).open(CATALOG.headphones.id);
  await new ProductPage(page).add(1);
  const catalog = new CatalogPage(page);
  await catalog.open();
  await catalog.quickAdd(mug.id);

  await page.reload();
  const cart = new CartPage(page);
  await cart.open();

  await expect(cart.line(CATALOG.headphones.id)).toBeVisible();
  await expect(cart.line(mug.id)).toBeVisible();
  await expect(cart.total()).toHaveText(money(expectedTotals([{ price: CATALOG.headphones.price, quantity: 1 }, { price: mug.price, quantity: 1 }]).total));
});

test.describe("line totals are exact to the cent", () => {
  const cases = [
    { product: mug, quantity: 3 },
    { product: mug, quantity: 6 },
    { product: backpack, quantity: 3 },
  ];

  for (const [index, { product, quantity }] of cases.entries()) {
    const expected = expectedLineTotal(product.price, quantity);

    test(`[BUG-10] cart shows ${quantity} × ${money(product.price)} = ${money(expected)}`, trace({ caseKey: `CART-0${4 + index}`, ac: ["AC-04"], requirement: "SPEC › Checkout: totals in dollars with two decimals", defect: "BUG-10", layer: "ui", priority: "P2" }), async ({ page }) => {
      await new ProductPage(page).open(product.id);
      await new ProductPage(page).add(quantity);
      const cart = new CartPage(page);
      await cart.open();

      await expect(cart.lineTotal(product.id)).toHaveText(money(expected));
      await expect(cart.total()).toHaveText(money(expected));
    });
  }

  test("[BUG-10] the order and the payment charge 3 × $8.35 = $25.05", trace({ caseKey: "CART-07", ac: ["AC-04"], requirement: "SPEC › Checkout: totals in dollars with two decimals", defect: "BUG-10", layer: "api", priority: "P2" }), async ({ request }) => {
    const api = new ShopApi(request);
    await api.login();

    const res = await api.checkout(goldenCheckout({ items: [{ productId: mug.id, quantity: 3 }] }));

    expect(res.status()).toBe(201);
    const order = await res.json();
    expect(order.subtotal).toBe(25.05);
    expect(order.total).toBe(25.05);
    const [payment] = await api.payments();
    expect(payment.amount).toBe(25.05);
  });
});
