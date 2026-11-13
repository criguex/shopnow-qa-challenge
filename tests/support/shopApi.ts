import { expect, type APIRequestContext, type APIResponse } from "@playwright/test";
import { USERS } from "../helpers";

export type Credentials = { email: string; password: string };

export interface CheckoutPayload {
  items: unknown;
  coupons?: unknown;
  shipping?: unknown;
  card?: unknown;
}

export interface ApiOrder {
  id: number;
  userId: number;
  createdAt: string;
  items: { productId: number; name: string; price: number; quantity: number }[];
  coupons: { code: string; percent: number }[];
  subtotal: number;
  discount: number;
  total: number;
  shipping: { name: string; address: string };
  paymentId: number;
  displayDate: string;
  displayTime: string;
}

export interface ApiPayment { id: number; orderId: number; amount: number; cardLast4: string; status: string }
export interface ApiProduct { id: number; name: string; category: string; price: number; stock: number }

/**
 * Thin client over the documented API (docs/API.md). One instance = one user session,
 * because Playwright keeps the `sid` cookie per request context.
 */
export class ShopApi {
  private readonly request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  async login(user: Credentials = USERS.ana): Promise<void> {
    const res = await this.request.post("/api/login", { data: user });
    expect(res.status(), `login as ${user.email}`).toBe(200);
  }

  checkout(payload: CheckoutPayload): Promise<APIResponse> {
    return this.request.post("/api/checkout", { data: payload, timeout: 15_000 });
  }

  validateCoupon(code: string): Promise<APIResponse> {
    return this.request.post("/api/coupons/validate", { data: { code } });
  }

  order(id: number): Promise<APIResponse> {
    return this.request.get(`/api/orders/${id}`);
  }

  async orders(): Promise<ApiOrder[]> {
    const res = await this.request.get("/api/orders");
    expect(res.status()).toBe(200);
    return res.json();
  }

  async payments(): Promise<ApiPayment[]> {
    const res = await this.request.get("/api/payments");
    expect(res.status()).toBe(200);
    return res.json();
  }

  async product(id: number): Promise<ApiProduct> {
    const res = await this.request.get(`/api/products/${id}`);
    expect(res.status()).toBe(200);
    return res.json();
  }

  async isAlive(): Promise<boolean> {
    try {
      const res = await this.request.get("/api/products", { timeout: 5_000 });
      return res.status() === 200;
    } catch {
      return false;
    }
  }
}
