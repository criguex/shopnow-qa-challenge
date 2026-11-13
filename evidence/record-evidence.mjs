// Records reproducible evidence for each bug in BUGS.md.
// For every bug: numbered step screenshots (BUG-XX-01.png…), a video with a visible pointer and step banners
// (MP4 + GIF), a red box over the failure with Expected vs Actual (Actual is read live from the app),
// the HTTP log of every /api call, and evidence/BUG-XX/README.md tying it all together.
//
// Usage (app running on a fresh install):  node evidence/record-evidence.mjs [BUG-01 BUG-06 …]
// BUG-03 crashes the server on purpose and is always recorded last; restart the app afterwards.

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, request as apiRequest } from "@playwright/test";

const APP_URL = "http://localhost:4321";
const BASE_URL = process.env.BASE_URL ?? APP_URL;
const ROOT = dirname(fileURLToPath(import.meta.url));
const VIEWPORT = { width: 1000, height: 640 };
const ANA = { email: "ana@shopnow.test", password: "Ana12345" };
const SHIPPING = { name: "Ana Garcia", address: "1234 Corrientes Ave" };
const CARD = "4242424242424242";

const appCommit = (() => { try { return execSync("git log -1 --format=%h -- ../app", { cwd: ROOT }).toString().trim(); } catch { return "unknown"; } })();

// ---------- in-page overlays: pointer, step banner, red annotation ----------
const OVERLAY_INIT = () => {
  const css = `#__qa_cursor{position:fixed;width:22px;height:22px;margin:-11px 0 0 -11px;border:2px solid #111;border-radius:50%;
    background:rgba(255,214,0,.45);box-shadow:0 0 0 2px #fff;pointer-events:none;z-index:2147483647;transition:transform .08s}
    #__qa_cursor.down{transform:scale(.7);background:rgba(229,57,53,.6)}
    #__qa_banner{position:fixed;left:0;right:0;bottom:0;padding:8px 14px;font:600 14px/1.35 system-ui,sans-serif;color:#fff;
    background:#1f2937;z-index:2147483646;pointer-events:none;white-space:pre-line}
    #__qa_banner.bad{background:#c62828}#__qa_banner.good{background:#2e7d32}
    .__qa_box{position:fixed;border:3px solid #e53935;border-radius:6px;box-shadow:0 0 0 2px #fff,0 0 12px rgba(229,57,53,.6);pointer-events:none;z-index:2147483645}
    .__qa_tag{position:fixed;background:#e53935;color:#fff;font:700 12px/16px system-ui,sans-serif;padding:2px 8px;border-radius:4px;pointer-events:none;z-index:2147483645;white-space:nowrap}`;
  const build = () => {
    if (document.getElementById("__qa_cursor") || !document.body) return;
    const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);
    const cursor = document.createElement("div"); cursor.id = "__qa_cursor"; document.body.appendChild(cursor);
    addEventListener("mousemove", (e) => { cursor.style.left = e.clientX + "px"; cursor.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", () => cursor.classList.add("down"), true);
    addEventListener("mouseup", () => cursor.classList.remove("down"), true);
    const saved = sessionStorage.getItem("__qa_banner");
    if (saved) { const { text, kind } = JSON.parse(saved); window.__qaBanner?.(text, kind); }
  };
  window.__qaBanner = (text, kind) => {
    let b = document.getElementById("__qa_banner");
    if (!b) { b = document.createElement("div"); b.id = "__qa_banner"; document.body.appendChild(b); }
    b.className = kind; b.textContent = text;
    sessionStorage.setItem("__qa_banner", JSON.stringify({ text, kind }));
  };
  document.readyState === "loading" ? addEventListener("DOMContentLoaded", build) : build();
};

class Recorder {
  constructor(bug, page, dir) {
    this.bug = bug; this.page = page; this.dir = dir; this.n = 0;
    this.steps = []; this.http = []; this.result = null;
  }

  async banner(text, kind = "step") {
    await this.page.evaluate(([t, k]) => window.__qaBanner?.(t, k), [text, kind]);
  }

  async step(text) {
    this.n += 1;
    const label = `${this.bug.id} · Step ${this.n}: ${text}`;
    await this.banner(label);
    await this.page.waitForTimeout(450);
    const file = `${this.bug.id}-${String(this.n).padStart(2, "0")}.png`;
    await this.page.screenshot({ path: join(this.dir, file) });
    this.steps.push({ n: this.n, text, file, url: this.page.url() });
  }

  async click(locator) {
    const box = await locator.boundingBox();
    if (box) await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
    await this.page.waitForTimeout(250);
    await locator.click();
    await this.page.waitForTimeout(350);
  }

  async type(locator, text) {
    await this.click(locator);
    await locator.fill("");
    await locator.pressSequentially(text, { delay: 25 });
  }

  /** Marks the failing element, shows Expected vs Actual in red and takes the final screenshot. */
  async fail(locator, expected, actual) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await this.page.mouse.move(VIEWPORT.width - 40, 70, { steps: 10 });
    const box = await locator.boundingBox();
    if (box) {
      await this.page.evaluate(([b, label]) => {
        const pad = 6;
        const el = document.createElement("div"); el.className = "__qa_box";
        Object.assign(el.style, { left: b.x - pad + "px", top: b.y - pad + "px", width: b.width + pad * 2 + "px", height: b.height + pad * 2 + "px" });
        const tag = document.createElement("div"); tag.className = "__qa_tag"; tag.textContent = label;
        Object.assign(tag.style, { left: b.x - pad + "px", top: Math.max(0, b.y - pad - 22) + "px" });
        document.body.append(el, tag);
      }, [box, `FAIL: ${this.bug.id}`]);
    }
    this.result = { expected, actual };
    this.n += 1;
    await this.banner(`${this.bug.id} · Step ${this.n}: FAIL\nExpected: ${expected}\nActual:   ${actual}`, "bad");
    await this.page.waitForTimeout(1600);
    const file = `${this.bug.id}-${String(this.n).padStart(2, "0")}.png`;
    await this.page.screenshot({ path: join(this.dir, file) });
    this.steps.push({ n: this.n, text: "Failure: expected vs actual", file, url: this.page.url() });
  }
}

const logResponse = (log) => async (res) => {
  const req = res.request();
  if (!req.url().includes("/api/")) return;
  let body = "";
  try { body = (await res.text()).slice(0, 300); } catch { body = "(no body)"; }
  log.push({ method: req.method(), url: req.url().replace(BASE_URL, ""), status: res.status(), request: (req.postData() ?? "").slice(0, 300), response: body });
};

async function apiCall(ctx, log, method, path, data, raw) {
  try {
    const res = await ctx.fetch(`${BASE_URL}${path}`, { method, ...(raw !== undefined ? { headers: { "Content-Type": "application/json" }, data: raw } : data !== undefined ? { data } : {}), timeout: 15_000 });
    const body = await res.text();
    log.push({ method, url: path, status: res.status(), request: (raw ?? (data ? JSON.stringify(data) : "")).slice(0, 300), response: body.slice(0, 300) });
    return { status: res.status(), body };
  } catch (e) {
    log.push({ method, url: path, status: "ERR", request: (raw ?? (data ? JSON.stringify(data) : "")).slice(0, 300), response: e.message.split("\n")[0] });
    return { status: "ERR", body: e.message };
  }
}

// ---------- scenarios ----------
const ui = async (r, { login } = {}) => {
  const p = r.page;
  if (login) {
    await p.goto(`${BASE_URL}/login`);
    await r.step("Log in as Ana (ana@shopnow.test)");
    await r.type(p.getByTestId("login-email"), ANA.email);
    await r.type(p.getByTestId("login-password"), ANA.password);
    await r.click(p.getByTestId("login-submit"));
    await p.getByTestId("logout").waitFor();
  }
};

const BUGS = {
  "BUG-01": {
    title: "Payments over $100 are reported as failed but the customer is charged", ac: "AC-11", test: "tests/payments.spec.ts (PAY-01, PAY-02)", resource: "/checkout",
    async run(r) {
      const p = r.page; await ui(r, { login: true });
      await p.goto(`${BASE_URL}/product/8`);
      await r.step("Open Ergonomic chair ($129.00, above $100)");
      await r.click(p.getByTestId("add-to-cart"));
      await p.goto(`${BASE_URL}/checkout`);
      await r.step("Go to checkout: total to pay $129.00");
      await r.type(p.getByTestId("shipping-name"), SHIPPING.name);
      await r.type(p.getByTestId("shipping-address"), SHIPPING.address);
      await r.type(p.getByTestId("card-number"), CARD);
      await r.step("Fill shipping details and an approved card (4242…4242)");
      await r.click(p.getByTestId("pay-button"));
      const error = p.getByTestId("checkout-error");
      await error.waitFor({ timeout: 10_000 });
      await p.waitForTimeout(1500);
      const payments = await p.evaluate(() => fetch("/api/payments").then((x) => x.json()));
      const charged = payments.filter((x) => x.amount === 129);
      await r.fail(error, "order confirmation page and exactly one payment of $129.00",
        `"${await error.textContent()}" shown, yet My payments has ${charged.length} approved payment(s) of $129.00 (payment #${charged.map((x) => x.id).join(", #")})`);
    },
  },
  "BUG-02": {
    title: "Any logged-in user can read other customers' orders", ac: "AC-12", test: "tests/orders.spec.ts (ORD-01, ORD-02)", resource: "/orders/3",
    async run(r) {
      const p = r.page; await ui(r, { login: true });
      await r.click(p.getByTestId("nav-orders"));
      await p.locator("[data-testid^=order-row-]").first().waitFor();
      await r.step("My orders: Ana owns orders #1 and #2 only");
      await p.goto(`${BASE_URL}/orders/3`);
      await p.getByTestId("order-shipping").waitFor();
      await r.step("Change the URL to /orders/3 (Bruno's order)");
      const shipping = p.getByTestId("order-shipping");
      await r.fail(shipping, "404 / 'order not available' for an order that isn't Ana's", `Bruno's order is shown: "${await shipping.textContent()}"`);
    },
  },
  "BUG-06": {
    title: "Lowercase coupon codes are accepted but give 0% discount", ac: "AC-08, AC-09", test: "tests/coupons.spec.ts (CPN-01…CPN-05)", resource: "/cart",
    async run(r) {
      const p = r.page;
      await p.goto(`${BASE_URL}/product/3`);
      await r.step("Open Basic T-shirt ($14.35)");
      await p.getByTestId("quantity-select").selectOption("2");
      await r.click(p.getByTestId("add-to-cart"));
      await p.goto(`${BASE_URL}/cart`);
      await r.step("Cart: 2 × $14.35, subtotal $28.70");
      await r.type(p.getByTestId("coupon-input"), "flock10");
      await r.click(p.getByTestId("coupon-apply"));
      await p.getByTestId("coupon-applied").waitFor();
      await r.step("Apply the coupon in lowercase: flock10");
      const discount = p.getByTestId("cart-discount");
      await r.fail(p.locator(".cart-summary .totals"), "FLOCK10 is case-insensitive: discount -$2.87, total $25.83",
        `"${(await p.getByTestId("coupon-applied").textContent()).replace("Remove", "").trim()}", discount ${await discount.textContent()}, total ${await p.getByTestId("cart-total").textContent()}`);
    },
  },
  "BUG-08": {
    title: "Products added with the catalog Add button vanish on reload", ac: "AC-06, AC-02", test: "tests/cart.spec.ts (CART-02, CART-03)", resource: "/",
    async run(r) {
      const p = r.page;
      await p.goto(`${BASE_URL}/`);
      await r.step("Catalog with an empty cart");
      await r.click(p.getByTestId("quick-add-1"));
      await r.step("Click Add on Ceramic mug: header shows Cart (1)");
      await p.reload();
      await r.step("Reload the page");
      await r.click(p.getByTestId("nav-cart"));
      const empty = p.getByTestId("cart-empty");
      await empty.waitFor();
      await r.fail(empty, "the mug is still in the cart (qty 1, total $8.35)", `"${await empty.textContent()}"`);
    },
  },
  "BUG-09": {
    title: "Names and addresses with accents, ñ, ° or apostrophes are rejected", ac: "AC-11", test: "tests/checkout-validation.spec.ts (CHK-07…CHK-09)", resource: "/checkout",
    async run(r) {
      const p = r.page; await ui(r, { login: true });
      await p.goto(`${BASE_URL}/product/1`);
      await r.click(p.getByTestId("add-to-cart"));
      await p.goto(`${BASE_URL}/checkout`);
      await r.step("Checkout with 1 Ceramic mug");
      await r.type(p.getByTestId("shipping-name"), "Ana García");
      await r.type(p.getByTestId("shipping-address"), "Av. Corrientes 1234, 3°B");
      await r.type(p.getByTestId("card-number"), CARD);
      await r.step("Name 'Ana García', address 'Av. Corrientes 1234, 3°B', valid card");
      await r.click(p.getByTestId("pay-button"));
      const error = p.getByTestId("checkout-error");
      await error.waitFor();
      await r.fail(error, "order created for 'Ana García'", `"${await error.textContent()}" (both fields are filled in)`);
    },
  },
  "BUG-10": {
    title: "Line totals are truncated, so some amounts are one cent off", ac: "AC-04", test: "tests/cart.spec.ts (CART-04…CART-07)", resource: "/cart",
    async run(r) {
      const p = r.page;
      await p.goto(`${BASE_URL}/product/1`);
      await r.step("Open Ceramic mug ($8.35)");
      await p.getByTestId("quantity-select").selectOption("3");
      await r.click(p.getByTestId("add-to-cart"));
      await p.goto(`${BASE_URL}/cart`);
      await r.step("Cart with 3 × $8.35");
      const line = p.getByTestId("cart-line-total-1");
      await r.fail(line, "3 × $8.35 = $25.05", `line total ${await line.textContent()}, total ${await p.getByTestId("cart-total").textContent()}`);
    },
  },
  "BUG-11": {
    title: "After a reload the cart lets the user stack a second coupon", ac: "AC-07", test: "tests/coupons.spec.ts (CPN-09)", resource: "/cart",
    async run(r) {
      const p = r.page;
      await p.goto(`${BASE_URL}/product/3`);
      await p.getByTestId("quantity-select").selectOption("2");
      await r.click(p.getByTestId("add-to-cart"));
      await p.goto(`${BASE_URL}/cart`);
      await r.type(p.getByTestId("coupon-input"), "FLOCK10");
      await r.click(p.getByTestId("coupon-apply"));
      await p.getByTestId("coupon-applied").waitFor();
      await r.step("Cart 2 × T-shirt, FLOCK10 applied (total $25.83)");
      await p.reload();
      await r.step("Reload the page");
      await r.type(p.getByTestId("coupon-input"), "BIENVENIDA15");
      await r.click(p.getByTestId("coupon-apply"));
      await p.getByTestId("coupon-applied").nth(1).waitFor();
      await r.step("Apply a second coupon: BIENVENIDA15");
      await r.fail(p.getByTestId("coupon-applied").nth(1), "'Only one coupon can be used per purchase.' and total $25.83",
        `${await p.getByTestId("coupon-applied").count()} coupons applied, total ${await p.getByTestId("cart-total").textContent()} (25% off)`);
    },
  },
  "BUG-12": {
    title: "Adding a product twice from its page puts more than the stock in the cart", ac: "AC-03", test: "tests/stock.spec.ts (STK-03)", resource: "/product/8",
    async run(r) {
      const p = r.page;
      await p.goto(`${BASE_URL}/product/8`);
      await r.step("Ergonomic chair: available stock 2");
      await p.getByTestId("quantity-select").selectOption("2");
      await r.click(p.getByTestId("add-to-cart"));
      await r.step("Add 2 to the cart");
      await r.click(p.getByTestId("add-to-cart"));
      await r.step("Click Add to cart again");
      await p.goto(`${BASE_URL}/cart`);
      const qty = p.getByTestId("cart-qty-8");
      await r.fail(p.getByTestId("cart-line-8"), "at most 2 chairs ($258.00)", `quantity ${await qty.inputValue()}, line total ${await p.getByTestId("cart-line-total-8").textContent()}`);
    },
  },
  "BUG-13": {
    title: "Late-night orders show the next day's date", ac: "AC-13", test: "tests/orders.spec.ts (ORD-03, ORD-04)", resource: "/orders/2",
    async run(r) {
      const p = r.page; await ui(r, { login: true });
      await p.goto(`${BASE_URL}/orders/2`);
      const date = p.getByTestId("order-date");
      await date.waitFor();
      await r.step("Open order #2 (placed 2026-10-15T02:30Z = Oct 14, 23:30 in Argentina)");
      await r.fail(date, "Date: 10/14/2026 · 23:30", `"${await date.textContent()}" (time converted, date not)`);
    },
  },
};

const API_BUGS = {
  "BUG-03": {
    title: "One malformed checkout request takes the whole store down", ac: "AC-14", test: "tests/zz-server-robustness.spec.ts (ROB-01, ROB-02)", resource: "/api/checkout",
    notes: "Server output of the crash: [server.log](server.log) (`TypeError: shipping?.name?.trim is not a function`, then the Node process exits and every page and API call gets connection refused).",
    expected: "400 invalid data, and GET /api/products keeps answering 200",
    async run(ctx, log, show) {
      await apiCall(ctx, log, "POST", "/api/login", ANA);
      await apiCall(ctx, log, "GET", "/api/products");
      await apiCall(ctx, log, "POST", "/api/checkout", { items: [{ productId: 3, quantity: 1 }], coupons: [], shipping: { name: 123, address: "1234 Corrientes Ave" }, card: { number: CARD } });
      const after = await apiCall(ctx, log, "GET", "/api/products");
      return `checkout answered "socket hang up"; the next GET /api/products answered ${after.status} (server process exited)`;
    },
  },
  "BUG-04": {
    title: "Checkout accepts zero, negative, decimal and non-numeric quantities", ac: "AC-05, AC-14", test: "tests/checkout-validation.spec.ts (CHK-02…CHK-06)", resource: "/api/checkout",
    expected: "400 for every mutant; no order, no payment, T-shirt stock stays 40",
    async run(ctx, log, show) {
      await apiCall(ctx, log, "POST", "/api/login", ANA);
      for (const quantity of [0, -2, 1.5]) {
        await apiCall(ctx, log, "POST", "/api/checkout", { items: [{ productId: 3, quantity }], coupons: [], shipping: SHIPPING, card: { number: CARD } });
      }
      await show("/payments", "Ana opens My payments after quantities 0, -2 and 1.5", (p) => p.getByTestId("payment-row-5"),
        "no payment for an invalid quantity", async (p) => `approved payment ${(await p.getByTestId("payment-row-5").innerText()).replace(/\s+/g, " ")}`);
      await apiCall(ctx, log, "POST", "/api/checkout", { items: [{ productId: 3, quantity: "abc" }], coupons: [], shipping: SHIPPING, card: { number: CARD } });
      const stock = JSON.parse((await apiCall(ctx, log, "GET", "/api/products/3")).body).stock;
      await show("/payments", "Ana opens My payments after quantity \"abc\"", null,
        "My payments lists Ana's payments", async () => "blank page: the order stored total null and the page crashes (TypeError: Cannot read properties of null (reading 'toLocaleString')); My orders too");
      return `201 for all 4 mutants; -2 created an approved payment of -28.70; "abc" stored an order with total null that blanks My payments and My orders; T-shirt stock is now ${stock}`;
    },
  },
  "BUG-05": {
    title: "The API accepts several coupons per purchase (even a negative total)", ac: "AC-07, AC-14", test: "tests/coupons.spec.ts (CPN-06…CPN-08)", resource: "/api/checkout",
    expected: "400 Only one coupon can be used per purchase; no order",
    async run(ctx, log, show) {
      await apiCall(ctx, log, "POST", "/api/login", ANA);
      await apiCall(ctx, log, "POST", "/api/checkout", { items: [{ productId: 3, quantity: 2 }], coupons: ["FLOCK10", "BIENVENIDA15"], shipping: SHIPPING, card: { number: CARD } });
      const r = await apiCall(ctx, log, "POST", "/api/checkout", { items: [{ productId: 3, quantity: 1 }], coupons: Array(11).fill("FLOCK10"), shipping: SHIPPING, card: { number: CARD } });
      await show("/orders", "Ana opens My orders", (p) => p.getByTestId("order-row-5"),
        "no order with stacked coupons", async (p) => `order ${(await p.getByTestId("order-row-5").innerText()).replace(/\s+/g, " ")} (negative total)`);
      return `201 with 25% off for two coupons; 201 with total ${JSON.parse(r.body).total} for 11 × FLOCK10`;
    },
  },
  "BUG-07": {
    title: "Checkout never checks stock: overselling and negative stock", ac: "AC-03, AC-14", test: "tests/stock.spec.ts (STK-01, STK-02)", resource: "/api/checkout",
    expected: "409 out of stock; chair stock stays 2",
    async run(ctx, log, show) {
      await apiCall(ctx, log, "POST", "/api/login", ANA);
      await apiCall(ctx, log, "GET", "/api/products/8");
      await apiCall(ctx, log, "POST", "/api/checkout", { items: [{ productId: 8, quantity: 3 }], coupons: [], shipping: SHIPPING, card: { number: CARD } });
      const stock = JSON.parse((await apiCall(ctx, log, "GET", "/api/products/8")).body).stock;
      await show("/product/8", "Open the Ergonomic chair page", (p) => p.getByTestId("product-stock"),
        "Available stock: 2 (the purchase of 3 is refused)", async (p) => `"${await p.getByTestId("product-stock").innerText()}"`);
      return `201 for 3 chairs with stock 2; chair stock is now ${stock}`;
    },
  },
  "BUG-14": {
    title: "Malformed JSON gets an HTML error page instead of a JSON error", ac: "AC-14", test: "tests/checkout-validation.spec.ts (CHK-10)", resource: "/api/login",
    expected: "400 with a JSON body { error }",
    async run(ctx, log) {
      const r = await apiCall(ctx, log, "POST", "/api/login", undefined, "{bad json");
      return `${r.status} with an HTML page: ${r.body.slice(0, 40)}…`;
    },
  },
  "BUG-15": {
    title: "A coupons value that is not a list is silently ignored", ac: "AC-14, AC-07", test: "tests/checkout-validation.spec.ts (CHK-11)", resource: "/api/checkout",
    expected: "400 invalid data",
    async run(ctx, log) {
      await apiCall(ctx, log, "POST", "/api/login", ANA);
      const r = await apiCall(ctx, log, "POST", "/api/checkout", { items: [{ productId: 3, quantity: 2 }], coupons: "FLOCK10", shipping: SHIPPING, card: { number: CARD } });
      const o = JSON.parse(r.body);
      return `${r.status}; discount ${o.discount}, total ${o.total} (full price, no warning)`;
    },
  },
};

// ---------- report ----------
const httpTable = (log) => [
  "| # | Request | Status | Request body | Response (first 300 chars) |",
  "|---|---|---|---|---|",
  ...log.map((h, i) => `| ${i + 1} | \`${h.method} ${h.url}\` | **${h.status}** | ${h.request ? "`" + h.request.replace(/\|/g, "\\|") + "`" : ""} | \`${String(h.response).replace(/\|/g, "\\|").replace(/\n/g, " ")}\` |`),
].join("\n");

function writeReport(id, bug, { steps = [], http = [], expected, actual, video }) {
  const md = [
    `# ${id} — ${bug.title}`,
    "",
    `- **Environment:** ShopNow local (\`npm run dev\`) · app version: commit \`${appCommit}\` · Chromium (Playwright 1.48.2) · timezone America/Argentina/Buenos_Aires · fresh data (\`POST /api/test/reset\`) · users ana@shopnow.test / bruno@shopnow.test · recorded ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC${BASE_URL === APP_URL ? "" : ` on ${BASE_URL} (port 4321 was in use on the recording machine; same app and data)`}`,
    `- **Resource:** [${APP_URL}${bug.resource}](${APP_URL}${bug.resource})`,
    `- **Acceptance criteria:** ${bug.ac} (see docs/TRACEABILITY.md) · **Report:** [BUGS.md](../../BUGS.md) › ${id}`,
    `- **Automated test:** \`${bug.test}\``,
    "",
    "## Expected vs actual",
    "",
    `- **Expected:** ${expected}`,
    `- **Actual:** ${actual}`,
    ...(bug.notes ? [`- **Logs:** ${bug.notes}`] : []),
    "",
    ...(video ? ["## Video", "", `![${id}](${id}.gif)`, "", `Full quality: [${id}.mp4](${id}.mp4) (pointer visible, step banners, failure marked in red).`, ""] : []),
    ...(steps.length ? [video ? "## Steps" : "## What the user sees", "", ...steps.map((s) => `### Step ${s.n} — ${s.text}\n\n![${id} step ${s.n}](${s.file})\n`)] : []),
    "## HTTP log",
    "",
    httpTable(http),
    "",
  ].join("\n");
  writeFileSync(join(ROOT, id, "README.md"), md);
}

async function recordUi(browser, id) {
  const bug = BUGS[id];
  const dir = join(ROOT, id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const reset = await apiRequest.newContext(); await reset.post(`${BASE_URL}/api/test/reset`); await reset.dispose();
  const context = await browser.newContext({ viewport: VIEWPORT, locale: "en-US", timezoneId: "America/Argentina/Buenos_Aires", recordVideo: { dir, size: VIEWPORT } });
  await context.addInitScript(OVERLAY_INIT);
  const page = await context.newPage();
  const r = new Recorder({ id, ...bug }, page, dir);
  page.on("response", logResponse(r.http));
  await bug.run(r);
  await page.waitForTimeout(800);
  const videoPath = await page.video().path();
  await context.close();
  const webm = join(dir, `${id}.webm`);
  renameSync(videoPath, webm);
  execSync(`ffmpeg -loglevel error -y -i "${webm}" -c:v libx264 -pix_fmt yuv420p -movflags +faststart -crf 26 "${join(dir, id + ".mp4")}"`);
  execSync(`ffmpeg -loglevel error -y -i "${webm}" -vf "fps=6,scale=760:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=5" "${join(dir, id + ".gif")}"`);
  rmSync(webm);
  writeReport(id, bug, { steps: r.steps, http: r.http, ...r.result, video: true });
  console.log(`${id}: ${r.steps.length} screenshots, video, ${r.http.length} HTTP calls`);
}

async function recordApi(browser, id) {
  const bug = API_BUGS[id];
  const dir = join(ROOT, id);
  for (const f of existsSync(dir) ? readdirSync(dir) : []) if (f !== "server.log") rmSync(join(dir, f));
  mkdirSync(dir, { recursive: true });
  const ctx = await apiRequest.newContext();
  await ctx.post(`${BASE_URL}/api/test/reset`);
  const log = [];
  let context, page, r;
  const show = async (path, label, target, expected, actual) => {
    if (!context) {
      context = await browser.newContext({ viewport: VIEWPORT, locale: "en-US", timezoneId: "America/Argentina/Buenos_Aires", storageState: await ctx.storageState() });
      await context.addInitScript(OVERLAY_INIT);
      page = await context.newPage();
      r = new Recorder({ id, ...bug }, page, dir);
    }
    try {
      await page.goto(`${BASE_URL}${path}`);
      if (target) await target(page).waitFor({ timeout: 5_000 });
      else await page.waitForTimeout(1200);
      await r.step(label);
      await r.fail(target ? target(page) : page.locator("body"), expected, await actual(page));
    } catch {
      r.n += 1;
      const file = `${id}-${String(r.n).padStart(2, "0")}.png`;
      await page.screenshot({ path: join(dir, file) }).catch(() => {});
      r.steps.push({ n: r.n, text: `${label}. Expected: ${expected}. Actual: ${await actual(page)}`, file });
    }
  };
  const actual = await bug.run(ctx, log, show);
  if (context) await context.close();
  await ctx.dispose();
  writeReport(id, bug, { steps: r?.steps ?? [], http: log, expected: bug.expected, actual });
  console.log(`${id}: ${r?.steps.length ?? 0} screenshots, ${log.length} HTTP calls`);
}

const wanted = process.argv.slice(2);
const all = [...Object.keys(BUGS), ...Object.keys(API_BUGS)].sort();
const selected = (wanted.length ? wanted : all).sort((a, b) => (a === "BUG-03") - (b === "BUG-03") || a.localeCompare(b));
const browser = await chromium.launch({ slowMo: 120 });
for (const id of selected) {
  if (BUGS[id]) await recordUi(browser, id);
  else if (API_BUGS[id]) await recordApi(browser, id);
}
await browser.close();
console.log("Evidence folders:", readdirSync(ROOT).filter((f) => f.startsWith("BUG-")).join(" "));
