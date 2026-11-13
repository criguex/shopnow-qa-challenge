const B = `http://localhost:${process.env.PORT ?? 4321}/api`;
const jar = {};
async function call(user, method, path, body) {
  const t0 = Date.now();
  const res = await fetch(B + path, {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(jar[user] ? { cookie: jar[user] } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = res.headers.get("set-cookie");
  if (sc && user) jar[user] = sc.split(";")[0];
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text.slice(0, 80); }
  return { status: res.status, data, ms: Date.now() - t0, headers: Object.fromEntries(res.headers) };
}
const ship = { name: "Ana Garcia", address: "1234 Corrientes Ave" };
const card = { number: "4242424242424242" };
const co = (items, extra = {}) => ({ items, coupons: [], shipping: ship, card, ...extra });
const log = (l, r) => console.log(l.padEnd(44), r.status, `${r.ms}ms`, JSON.stringify(r.data?.error ?? r.data?.total ?? r.data).slice(0, 140));

await call(null, "POST", "/test/reset");
const login = await call("ana", "POST", "/login", { email: "ana@shopnow.test", password: "Ana12345" });
console.log("login set-cookie:", login.headers["set-cookie"]);
log("coupon unknown", await call("ana", "POST", "/checkout", co([{ productId: 1, quantity: 1 }], { coupons: ["NOPE"] })));
log("coupons as string", await call("ana", "POST", "/checkout", co([{ productId: 1, quantity: 1 }], { coupons: "FLOCK10" })));
log("declined card total>100 (chair)", await call("ana", "POST", "/checkout", co([{ productId: 8, quantity: 1 }], { card: { number: "4111111111110000" } })));
log("approved total>100 (chair) latency", await call("ana", "POST", "/checkout", co([{ productId: 8, quantity: 1 }])));
log("total exactly 100? 4x mug+... skip", { status: "-", ms: 0, data: "" });

console.log("--- concurrency: double submit same cart x2 (double charge?)");
await call(null, "POST", "/test/reset");
await call("ana", "POST", "/login", { email: "ana@shopnow.test", password: "Ana12345" });
const dbl = await Promise.all([1, 2].map(() => call("ana", "POST", "/checkout", co([{ productId: 6, quantity: 1 }]))));
dbl.forEach((r, i) => log(`  submit #${i + 1}`, r));
const pays = await call("ana", "GET", "/payments");
console.log("  payments:", pays.data.map((p) => `${p.id}:o${p.orderId}:${p.amount}`).join(" "));

console.log("--- concurrency: race for last units (chair stock 2, 3 buyers x1)");
await call(null, "POST", "/test/reset");
await call("bruno", "POST", "/login", { email: "bruno@shopnow.test", password: "Bruno12345" });
await call("ana", "POST", "/login", { email: "ana@shopnow.test", password: "Ana12345" });
const race = await Promise.all(["ana", "bruno", "ana"].map((u) => call(u, "POST", "/checkout", co([{ productId: 8, quantity: 1 }]))));
race.forEach((r, i) => log(`  buyer #${i + 1}`, r));
console.log("  chair stock:", (await call(null, "GET", "/products/8")).data.stock);
const orders = await call("ana", "GET", "/orders");
console.log("  ana orders ids:", orders.data.map((o) => o.id).join(","));

console.log("--- perf: 200 GET /products, 20 concurrent");
const times = [];
for (let b = 0; b < 10; b++) {
  const rs = await Promise.all(Array.from({ length: 20 }, () => call(null, "GET", "/products")));
  rs.forEach((r) => times.push(r.ms));
}
times.sort((a, b) => a - b);
console.log("  p50", times[100], "p95", times[190], "max", times[199]);

console.log("--- session: logout then reuse cookie");
const cookie = jar.ana;
await call("ana", "POST", "/logout");
jar.ana = cookie;
log("  /orders with logged-out cookie", await call("ana", "GET", "/orders"));
console.log("--- login brute force: 20 wrong passwords");
let st = [];
for (let i = 0; i < 20; i++) st.push((await call("x", "POST", "/login", { email: "ana@shopnow.test", password: "x" + i })).status);
console.log("  statuses:", [...new Set(st)].join(","), "then right pwd:", (await call("x", "POST", "/login", { email: "ana@shopnow.test", password: "Ana12345" })).status);
