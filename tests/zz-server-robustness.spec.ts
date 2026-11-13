import { test, expect } from "@playwright/test";
import { resetData } from "./helpers";
import { ShopApi } from "./support/shopApi";
import { MALFORMED_MUTANTS } from "./support/checkoutData";
import { trace } from "./support/trace";

// This file runs last on purpose (workers: 1, files in alphabetical order):
// while BUG-03 is open, these requests kill the server and every later test would fail.

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

for (const mutant of MALFORMED_MUTANTS) {
  test(`[BUG-03] a checkout with ${mutant.name} gets a 400 and the store stays up`, trace({ caseKey: `ROB-0${1 + MALFORMED_MUTANTS.indexOf(mutant)}`, ac: ["AC-14"], requirement: "docs/API.md › 400 invalid data", defect: "BUG-03", layer: "api", priority: "P1" }), async ({ request }) => {
    const api = new ShopApi(request);
    await api.login();

    const res = await api.checkout(mutant.payload);

    expect(res.status()).toBe(400);
    expect(await api.isAlive()).toBe(true);
  });
}
