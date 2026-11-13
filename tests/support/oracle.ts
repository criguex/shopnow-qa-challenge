/**
 * Test oracle: the expected values come from SPEC.md, computed here independently
 * of the app code (never imported from app/). Money is handled in integer cents
 * and rounded half-up, which is what "dollars with two decimals" means for a shopper.
 */

export const CATALOG = {
  mug: { id: 1, price: 8.35, stock: 25 },
  headphones: { id: 2, price: 49.99, stock: 3 },
  tshirt: { id: 3, price: 14.35, stock: 40 },
  backpack: { id: 4, price: 39.9, stock: 12 },
  lamp: { id: 5, price: 24.55, stock: 8 },
  keyboard: { id: 6, price: 89.9, stock: 5 },
  bottle: { id: 7, price: 18.55, stock: 30 },
  chair: { id: 8, price: 129, stock: 2 },
} as const;

export const COUPONS = { flock10: 10, bienvenida15: 15 } as const;

const toCents = (dollars: number) => Math.round(dollars * 100);
const toDollars = (cents: number) => cents / 100;

export function expectedLineTotal(price: number, quantity: number): number {
  return toDollars(toCents(price) * quantity);
}

export function expectedTotals(lines: { price: number; quantity: number }[], couponPercent = 0) {
  const subtotalCents = lines.reduce((sum, l) => sum + toCents(l.price) * l.quantity, 0);
  const discountCents = Math.round((subtotalCents * couponPercent) / 100);
  return {
    subtotal: toDollars(subtotalCents),
    discount: toDollars(discountCents),
    total: toDollars(subtotalCents - discountCents),
  };
}

export function money(value: number): string {
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Date of an ISO instant as seen in Argentina, in the app's display format (MM/DD/YYYY). */
export function argentinaDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function argentinaTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
