// Light performance probe for ShopNow. Plain Node (no extra dependencies).
// Usage: node perf/latency.mjs   (app running; BASE_URL defaults to http://localhost:4321)
// Exit code 1 when a budget is broken, so it can gate a pipeline.

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const CHECKOUT_BUDGET_MS = 3000; // the web client aborts the payment request after 3 s (see BUG-01)
const CATALOG_P95_BUDGET_MS = 200;

async function call(method, path, body, cookie) {
  const started = performance.now();
  const res = await fetch(BASE_URL + "/api" + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  await res.text();
  return { status: res.status, ms: performance.now() - started, cookie: res.headers.get("set-cookie")?.split(";")[0] };
}

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};

async function catalogUnderLoad({ requests = 300, concurrency = 30 } = {}) {
  const times = [];
  for (let sent = 0; sent < requests; sent += concurrency) {
    const batch = await Promise.all(Array.from({ length: concurrency }, () => call("GET", "/products")));
    times.push(...batch.map((r) => r.ms));
  }
  return { p50: percentile(times, 50), p95: percentile(times, 95), max: Math.max(...times) };
}

async function checkoutLatency(cookie, items, label) {
  const times = [];
  for (let i = 0; i < 3; i++) {
    const r = await call("POST", "/checkout", {
      items,
      coupons: [],
      shipping: { name: "Perf Probe", address: "1 Test St" },
      card: { number: "4242424242424242" },
    }, cookie);
    times.push(r.ms);
  }
  return { label, max: Math.max(...times) };
}

await call("POST", "/test/reset");
const { cookie } = await call("POST", "/login", { email: "ana@shopnow.test", password: "Ana12345" });

const catalog = await catalogUnderLoad();
const cheap = await checkoutLatency(cookie, [{ productId: 1, quantity: 1 }], "POST /checkout, total <= $100 (1 mug)");
const expensive = await checkoutLatency(cookie, [{ productId: 4, quantity: 3 }], "POST /checkout, total > $100 (3 backpacks)");
await call("POST", "/test/reset");

const rows = [
  { check: "GET /products p95 (30 concurrent)", measured: catalog.p95, budget: CATALOG_P95_BUDGET_MS },
  { check: cheap.label + " max", measured: cheap.max, budget: CHECKOUT_BUDGET_MS },
  { check: expensive.label + " max", measured: expensive.max, budget: CHECKOUT_BUDGET_MS },
];
console.table(rows.map((r) => ({ ...r, measured: `${Math.round(r.measured)} ms`, budget: `${r.budget} ms`, ok: r.measured <= r.budget ? "yes" : "NO" })));
process.exitCode = rows.some((r) => r.measured > r.budget) ? 1 : 0;
