import { test, expect } from "@playwright/test";
import { resetData } from "./helpers";
import { trace } from "./support/trace";

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

test("search by name ignores case and finds only matching products", trace({ caseKey: "CAT-01", ac: ["AC-01"], requirement: "SPEC › Catalog: search products by name", layer: "ui", priority: "P3" }), async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("search-input").fill("MUG");

  await expect(page.locator("[data-testid^=product-card-]")).toHaveCount(1);
  await expect(page.getByTestId("product-link-1")).toHaveText("Ceramic mug");
});

test("filtering by category shows only that category", trace({ caseKey: "CAT-02", ac: ["AC-01"], requirement: "SPEC › Catalog: filter by category", layer: "ui", priority: "P3" }), async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("category-select").selectOption("Tech");

  await expect(page.locator("[data-testid^=product-card-]")).toHaveCount(2);
  await expect(page.getByTestId("product-card-2")).toContainText("Tech");
  await expect(page.getByTestId("product-card-6")).toContainText("Tech");
});

test("a search with no match tells the user", trace({ caseKey: "CAT-03", ac: ["AC-01"], requirement: "SPEC › Catalog: search products by name", layer: "ui", priority: "P3" }), async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("search-input").fill("zzz");

  await expect(page.getByTestId("catalog-empty")).toHaveText("No products match your search.");
});
