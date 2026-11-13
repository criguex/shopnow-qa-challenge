import { test, expect } from "@playwright/test";
import { resetData } from "./helpers";
import { CATALOG, COUPONS, expectedTotals, money } from "./support/oracle";
import { CartPage, ProductPage } from "./support/pages";
import { ShopApi } from "./support/shopApi";
import { goldenCheckout } from "./support/checkoutData";
import { trace } from "./support/trace";

const twoTshirts = [{ productId: CATALOG.tshirt.id, quantity: 2 }];
const twoTshirtsWithFlock10 = expectedTotals([{ price: CATALOG.tshirt.price, quantity: 2 }], COUPONS.flock10);

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

test.describe("coupon codes are case-insensitive", () => {
  for (const code of ["flock10", "Flock10", "fLoCk10"]) {
    test(`[BUG-06] validating "${code}" returns the FLOCK10 discount`, trace({ caseKey: `CPN-0${1 + ["flock10", "Flock10", "fLoCk10"].indexOf(code)}`, ac: ["AC-08"], requirement: "SPEC › Discount coupons: codes are case-insensitive", defect: "BUG-06", layer: "api", priority: "P1" }), async ({ request }) => {
      const res = await new ShopApi(request).validateCoupon(code);
      expect(res.status()).toBe(200);
      expect((await res.json()).percent).toBe(COUPONS.flock10);
    });
  }

  test("[BUG-06] paying with a lowercase coupon discounts 10% of the subtotal", trace({ caseKey: "CPN-04", ac: ["AC-08", "AC-09"], requirement: "SPEC › Discount coupons: case-insensitive; percentage of the subtotal", defect: "BUG-06", layer: "api", priority: "P1" }), async ({ request }) => {
    const api = new ShopApi(request);
    await api.login();

    const res = await api.checkout(goldenCheckout({ items: twoTshirts, coupons: ["flock10"] }));

    expect(res.status()).toBe(201);
    const order = await res.json();
    expect(order.subtotal).toBe(twoTshirtsWithFlock10.subtotal);
    expect(order.discount).toBe(twoTshirtsWithFlock10.discount);
    expect(order.total).toBe(twoTshirtsWithFlock10.total);
  });

  test("[BUG-06] a lowercase coupon changes the cart total", trace({ caseKey: "CPN-05", ac: ["AC-08", "AC-09"], requirement: "SPEC › Discount coupons: case-insensitive; percentage of the subtotal", defect: "BUG-06", layer: "ui", priority: "P1" }), async ({ page }) => {
    await new ProductPage(page).open(CATALOG.tshirt.id);
    await new ProductPage(page).add(2);
    const cart = new CartPage(page);
    await cart.open();

    await cart.applyCoupon("flock10");

    await expect(cart.appliedCoupons()).toHaveCount(1);
    await expect(cart.subtotal()).toHaveText(money(twoTshirtsWithFlock10.subtotal));
    await expect(cart.discount()).toHaveText(`-${money(twoTshirtsWithFlock10.discount)}`);
    await expect(cart.total()).toHaveText(money(twoTshirtsWithFlock10.total));
  });
});

test.describe("only one coupon per purchase", () => {
  const stacked = [
    { name: "two different coupons", coupons: ["FLOCK10", "BIENVENIDA15"] },
    { name: "the same coupon twice", coupons: ["FLOCK10", "FLOCK10"] },
    { name: "the same coupon 11 times (110%)", coupons: Array(11).fill("FLOCK10") },
  ];

  for (const mutant of stacked) {
    test(`[BUG-05] checkout rejects ${mutant.name} and creates no order`, trace({ caseKey: `CPN-0${6 + stacked.indexOf(mutant)}`, ac: ["AC-07", "AC-14"], requirement: "SPEC › Discount coupons: only one per purchase", defect: "BUG-05", layer: "api", priority: "P1" }), async ({ request }) => {
      const api = new ShopApi(request);
      await api.login();
      const ordersBefore = await api.orders();

      const res = await api.checkout(goldenCheckout({ items: twoTshirts, coupons: mutant.coupons }));

      expect(res.status()).toBe(400);
      expect(await api.orders()).toHaveLength(ordersBefore.length);
    });
  }

  test("[BUG-11] the cart still allows only one coupon after the page is reloaded", trace({ caseKey: "CPN-09", ac: ["AC-07"], requirement: "SPEC › Discount coupons: another one can't be added while one is applied", defect: "BUG-11", layer: "ui", priority: "P2" }), async ({ page }) => {
    await new ProductPage(page).open(CATALOG.tshirt.id);
    await new ProductPage(page).add(2);
    const cart = new CartPage(page);
    await cart.open();
    await cart.applyCoupon("FLOCK10");
    await expect(cart.appliedCoupons()).toHaveCount(1);

    await page.reload();
    await cart.applyCoupon("BIENVENIDA15");

    await expect(cart.couponError()).toHaveText("Only one coupon can be used per purchase.");
    await expect(cart.appliedCoupons()).toHaveCount(1);
    await expect(cart.total()).toHaveText(money(twoTshirtsWithFlock10.total));
  });
});
