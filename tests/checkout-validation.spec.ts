import { test, expect } from "@playwright/test";
import { resetData } from "./helpers";
import { CATALOG } from "./support/oracle";
import { ShopApi } from "./support/shopApi";
import { goldenCheckout, QUANTITY_MUTANTS } from "./support/checkoutData";
import { trace } from "./support/trace";

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

test("golden path: the unmutated checkout payload is accepted", trace({ caseKey: "CHK-01", ac: ["AC-11", "AC-14"], requirement: "SPEC › Checkout; docs/API.md › POST /checkout 201", layer: "api", priority: "P1" }), async ({ request }) => {
  const api = new ShopApi(request);
  await api.login();

  const res = await api.checkout(goldenCheckout());

  expect(res.status()).toBe(201);
  expect((await api.product(CATALOG.tshirt.id)).stock).toBe(CATALOG.tshirt.stock - 1);
});

test.describe("quantity mutants are rejected", () => {
  for (const mutant of QUANTITY_MUTANTS) {
    test(`[BUG-04] checkout with ${mutant.name} returns 400, creates no order and leaves stock untouched`, trace({ caseKey: `CHK-0${2 + QUANTITY_MUTANTS.indexOf(mutant)}`, ac: ["AC-05", "AC-14"], requirement: "SPEC › Cart: quantities (minimum 1); docs/API.md › 400 invalid data", defect: "BUG-04", layer: "api", priority: "P1" }), async ({ request }) => {
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
    test(`[BUG-09] checkout accepts "${shipping.name}, ${shipping.address}" and stores it unchanged`, trace({ caseKey: `CHK-0${7 + shippings.indexOf(shipping)}`, ac: ["AC-11"], requirement: "SPEC › Checkout: shipping details (name and address)", defect: "BUG-09", layer: "api", priority: "P2" }), async ({ request }) => {
      const api = new ShopApi(request);
      await api.login();

      const res = await api.checkout(goldenCheckout({ shipping }));

      expect(res.status()).toBe(201);
      expect((await res.json()).shipping).toEqual(shipping);
    });
  }
});

test("[BUG-14] a malformed JSON body gets a JSON 400 error, as the API contract says", trace({ caseKey: "CHK-10", ac: ["AC-14"], requirement: "docs/API.md › all requests and responses are JSON", defect: "BUG-14", layer: "api", priority: "P3" }), async ({ request }) => {
  const res = await request.post("/api/login", {
    headers: { "Content-Type": "application/json" },
    data: "{bad json",
  });

  expect(res.status()).toBe(400);
  expect(res.headers()["content-type"]).toContain("application/json");
  expect(await res.json()).toHaveProperty("error");
});

test("[BUG-15] checkout rejects a coupons field that is not a list instead of charging full price", trace({ caseKey: "CHK-11", ac: ["AC-14", "AC-07"], requirement: "docs/API.md › POST /checkout coupons is a list; 400 invalid data", defect: "BUG-15", layer: "api", priority: "P3" }), async ({ request }) => {
  const api = new ShopApi(request);
  await api.login();
  const ordersBefore = await api.orders();

  const res = await api.checkout(goldenCheckout({ coupons: "FLOCK10" }));

  expect(res.status()).toBe(400);
  expect(await api.orders()).toHaveLength(ordersBefore.length);
});
