/**
 * Traceability for every test, independent of any test-management tool.
 * Each test carries a stable case key, the acceptance criterion and requirement it proves,
 * the defect it guards against, and tags to run it by layer, priority, bug or criterion:
 *   npx playwright test --grep @P1        npx playwright test --grep @api
 *   npx playwright test --grep @BUG-06    npx playwright test --grep @AC-07
 * The full matrix is in docs/TRACEABILITY.md.
 */

export const ACCEPTANCE_CRITERIA = {
  "AC-01": "Catalog: search by name and filter by category",
  "AC-02": "Products can be added to the cart from the catalog and from the product page",
  "AC-03": "Users can't buy more than the available stock",
  "AC-04": "Cart and order show line totals and totals exact to the cent, in dollars with two decimals",
  "AC-05": "Quantities are whole numbers, minimum 1",
  "AC-06": "The cart persists after reloading or closing the browser",
  "AC-07": "Only one coupon per purchase",
  "AC-08": "Coupon codes are case-insensitive",
  "AC-09": "The discount is a percentage of the subtotal",
  "AC-10": "Users must log in before paying",
  "AC-11": "Checkout takes name, address and card; the payment is processed, the order is created and the user sees the real outcome",
  "AC-12": "Users only see their own orders and payments",
  "AC-13": "Dates and times are shown in Argentina time",
  "AC-14": "API contract: invalid data → 400, out of stock → 409, JSON responses, the service stays available",
} as const;

export type AcceptanceCriterion = keyof typeof ACCEPTANCE_CRITERIA;
type Layer = "ui" | "api";
type Priority = "P1" | "P2" | "P3";

export interface Trace {
  caseKey: string;
  ac: AcceptanceCriterion[];
  requirement: string;
  defect?: string;
  layer: Layer;
  priority: Priority;
}

export function trace(t: Trace) {
  const tags = [`@${t.layer}`, `@${t.priority}`, `@${t.caseKey}`, ...t.ac.map((ac) => `@${ac}`)];
  if (t.defect) tags.push(`@${t.defect}`);
  return {
    tag: tags,
    annotation: [
      { type: "case_key", description: t.caseKey },
      { type: "ac", description: t.ac.map((ac) => `${ac}: ${ACCEPTANCE_CRITERIA[ac]}`).join(" | ") },
      { type: "requirement", description: t.requirement },
      ...(t.defect ? [{ type: "defect", description: `${t.defect} (BUGS.md)` }] : []),
    ],
  };
}
