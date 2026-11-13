import { test, expect, request as playwrightRequest } from "@playwright/test";
import { resetData, USERS } from "./helpers";
import { CATALOG, expectedLineTotal, money } from "./support/oracle";
import { CartPage, ProductPage } from "./support/pages";
import { ShopApi } from "./support/shopApi";
import { goldenCheckout } from "./support/checkoutData";

const { chair } = CATALOG;

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

test("[BUG-07] checkout rejects a quantity above the available stock with 409 and keeps the stock", async ({ request }) => {
  const api = new ShopApi(request);
  await api.login();
  const ordersBefore = await api.orders();

  const res = await api.checkout(goldenCheckout({ items: [{ productId: chair.id, quantity: chair.stock + 1 }] }));

  expect(res.status()).toBe(409);
  expect((await api.product(chair.id)).stock).toBe(chair.stock);
  expect(await api.orders()).toHaveLength(ordersBefore.length);
});

test("[BUG-07] three customers buying the last two units at once: only two succeed and stock never goes negative", async ({ baseURL }) => {
  const contexts = await Promise.all([1, 2, 3].map(() => playwrightRequest.newContext({ baseURL })));
  const buyers = contexts.map((ctx) => new ShopApi(ctx));
  await buyers[0].login(USERS.ana);
  await buyers[1].login(USERS.bruno);
  await buyers[2].login(USERS.ana);

  const responses = await Promise.all(
    buyers.map((b) => b.checkout(goldenCheckout({ items: [{ productId: chair.id, quantity: 1 }] }))),
  );
  const statuses = responses.map((r) => r.status()).sort();

  expect(statuses).toEqual([201, 201, 409]);
  expect((await buyers[0].product(chair.id)).stock).toBe(0);
  await Promise.all(contexts.map((ctx) => ctx.dispose()));
});

test("[BUG-12] adding the same product twice from its page cannot exceed the available stock", async ({ page }) => {
  const product = new ProductPage(page);
  await product.open(chair.id);
  await product.add(chair.stock);
  await product.add(chair.stock);

  const cart = new CartPage(page);
  await cart.open();
  await expect(cart.quantity(chair.id)).toHaveValue(String(chair.stock));
  await expect(cart.lineTotal(chair.id)).toHaveText(money(expectedLineTotal(chair.price, chair.stock)));
});
