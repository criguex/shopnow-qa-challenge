import type { CheckoutPayload } from "./shopApi";

export const VALID_CARD = "4242424242424242";
export const DECLINED_CARD = "4242424242420000";
export const VALID_SHIPPING = { name: "Ana Garcia", address: "1234 Corrientes Ave" };

/** Golden checkout payload: the one request the API must accept. */
export function goldenCheckout(overrides: Partial<CheckoutPayload> = {}): CheckoutPayload {
  return {
    items: [{ productId: 3, quantity: 1 }],
    coupons: [],
    shipping: { ...VALID_SHIPPING },
    card: { number: VALID_CARD },
    ...overrides,
  };
}

export interface Mutant {
  name: string;
  payload: CheckoutPayload;
}

/**
 * Mutants: each one changes a single field of the golden payload.
 * docs/API.md says invalid data must be rejected with 400.
 */
export const QUANTITY_MUTANTS: Mutant[] = [
  { name: "quantity 0", payload: goldenCheckout({ items: [{ productId: 3, quantity: 0 }] }) },
  { name: "negative quantity", payload: goldenCheckout({ items: [{ productId: 3, quantity: -2 }] }) },
  { name: "decimal quantity", payload: goldenCheckout({ items: [{ productId: 3, quantity: 1.5 }] }) },
  { name: "non-numeric quantity", payload: goldenCheckout({ items: [{ productId: 3, quantity: "abc" }] }) },
  { name: "missing quantity", payload: goldenCheckout({ items: [{ productId: 3 }] }) },
];

export const MALFORMED_MUTANTS: Mutant[] = [
  { name: "shipping name is a number", payload: goldenCheckout({ shipping: { name: 123, address: "1234 Corrientes Ave" } }) },
  { name: "null cart item", payload: goldenCheckout({ items: [null] }) },
];
