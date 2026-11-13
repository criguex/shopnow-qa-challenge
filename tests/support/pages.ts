import { expect, type Page } from "@playwright/test";

/** Page objects: one class per screen, locators only through data-testid. */

export class CatalogPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async open() {
    await this.page.goto("/");
    await expect(this.page.getByTestId("product-card-1")).toBeVisible();
  }

  async quickAdd(productId: number) {
    await this.page.getByTestId(`quick-add-${productId}`).click();
    await expect(this.page.getByTestId("catalog-message")).toBeVisible();
  }
}

export class ProductPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async open(productId: number) {
    await this.page.goto(`/product/${productId}`);
    await expect(this.page.getByTestId("product-name")).toBeVisible();
  }

  async add(quantity: number) {
    await this.page.getByTestId("quantity-select").selectOption(String(quantity));
    await this.page.getByTestId("add-to-cart").click();
  }
}

export class CartPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  readonly subtotal = () => this.page.getByTestId("cart-subtotal");
  readonly discount = () => this.page.getByTestId("cart-discount");
  readonly total = () => this.page.getByTestId("cart-total");
  readonly line = (productId: number) => this.page.getByTestId(`cart-line-${productId}`);
  readonly lineTotal = (productId: number) => this.page.getByTestId(`cart-line-total-${productId}`);
  readonly quantity = (productId: number) => this.page.getByTestId(`cart-qty-${productId}`);
  readonly appliedCoupons = () => this.page.getByTestId("coupon-applied");
  readonly couponError = () => this.page.getByTestId("coupon-error");

  async open() {
    await this.page.goto("/cart");
  }

  async applyCoupon(code: string) {
    await this.page.getByTestId("coupon-input").fill(code);
    await this.page.getByTestId("coupon-apply").click();
  }
}

export class CheckoutPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  readonly error = () => this.page.getByTestId("checkout-error");

  async open() {
    await this.page.goto("/checkout");
    await expect(this.page.getByTestId("pay-button")).toBeVisible();
  }

  async pay(details: { name: string; address: string; card: string }) {
    await this.page.getByTestId("shipping-name").fill(details.name);
    await this.page.getByTestId("shipping-address").fill(details.address);
    await this.page.getByTestId("card-number").fill(details.card);
    await this.page.getByTestId("pay-button").click();
  }
}

export class OrderPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  readonly success = () => this.page.getByTestId("order-success");
  readonly date = () => this.page.getByTestId("order-date");
  readonly shipping = () => this.page.getByTestId("order-shipping");
  readonly total = () => this.page.getByTestId("order-total");
  readonly error = () => this.page.getByTestId("order-error");

  async open(orderId: number) {
    await this.page.goto(`/orders/${orderId}`);
  }
}
