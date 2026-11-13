import { test, expect } from "@playwright/test";
import { resetData } from "./helpers";
import { CATALOG } from "./support/oracle";
import { ShopApi } from "./support/shopApi";
import { goldenCheckout, QUANTITY_MUTANTS } from "./support/checkoutData";

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

test("golden path: the unmutated checkout payload is accepted", async ({ request }) => {
  const api = new ShopApi(request);
  await api.login();

  const res = await api.checkout(goldenCheckout());

  expect(res.status()).toBe(201);
  expect((await api.product(CATALOG.tshirt.id)).stock).toBe(CATALOG.tshirt.stock - 1);
});

test.describe("quantity mutants are rejected", () => {
  for (const mutant of QUANTITY_MUTANTS) {
    test(`[BUG-04] checkout with ${mutant.name} returns 400, creates no order and leaves stock untouched`, async ({ request }) => {
      const api = new ShopApi(request);
      await api.login();
      const ordersBefore = await api.orders();
      const paymentsBefore = await api.payments();

      const res = await api.checkout(mutant.payload);

      expect(res.status()).toBe(400);
      expect(await api.orders()).toHaveLength(ordersBefore.length);
      expect(await api.payments()).toHaveLength(paymentsBefore.length);
      expect((await api.product(CATALOG.tshirt.id)).stock).toBe(CATALOG.tshirt.stock);
    });
  }
});

test.describe("real customer names and addresses are accepted", () => {
  const shippings = [
    { name: "Ana García", address: "Av. Corrientes 1234" },
    { name: "Martín Muñoz", address: "Av. Corrientes 1234, 3°B" },
    { name: "Liam O'Brien", address: "1234 Corrientes Ave" },
  ];

  for (const shipping of shippings) {
    test(`[BUG-09] checkout accepts "${shipping.name}, ${shipping.address}" and stores it unchanged`, async ({ request }) => {
      const api = new ShopApi(request);
      await api.login();

      const res = await api.checkout(goldenCheckout({ shipping }));

      expect(res.status()).toBe(201);
      expect((await res.json()).shipping).toEqual(shipping);
    });
  }
});

test("[BUG-14] a malformed JSON body gets a JSON 400 error, as the API contract says", async ({ request }) => {
  const res = await request.post("/api/login", {
    headers: { "Content-Type": "application/json" },
    data: "{bad json",
  });

  expect(res.status()).toBe(400);
  expect(res.headers()["content-type"]).toContain("application/json");
  expect(await res.json()).toHaveProperty("error");
});

test("[BUG-15] checkout rejects a coupons field that is not a list instead of charging full price", async ({ request }) => {
  const api = new ShopApi(request);
  await api.login();
  const ordersBefore = await api.orders();

  const res = await api.checkout(goldenCheckout({ coupons: "FLOCK10" }));

  expect(res.status()).toBe(400);
  expect(await api.orders()).toHaveLength(ordersBefore.length);
});
