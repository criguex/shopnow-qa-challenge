const B = `http://localhost:${process.env.PORT ?? 4321}/api`;
const jar = {};
async function call(user, method, path, body) {
  const t0 = Date.now();
  const res = await fetch(B + path, {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(jar[user] ? { cookie: jar[user] } : {}) },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const sc = res.headers.get("set-cookie");
  if (sc && user) jar[user] = sc.split(";")[0];
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text.slice(0, 80); }
  return { status: res.status, data, ms: Date.now() - t0 };
}
const ship = { name: "Ana Garcia", address: "1234 Corrientes Ave" };
const card = { number: "4242424242424242" };
const co = (items, extra = {}) => ({ items, coupons: [], shipping: ship, card, ...extra });
const show = (label, r) => {
  const d = r.data;
  const brief = d && typeof d === "object" && !Array.isArray(d)
    ? JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k]) => ["error", "id", "userId", "subtotal", "discount", "total", "coupons", "code", "percent", "displayDate", "displayTime", "createdAt", "stock", "name", "items", "shipping"].includes(k))))
    : JSON.stringify(d)?.slice(0, 160);
  console.log(`${label.padEnd(48)} ${r.status} ${String(r.ms).padStart(5)}ms ${brief}`);
};
const reset = () => call(null, "POST", "/test/reset");

const cases = [];
const c = (label, fn) => cases.push([label, fn]);

c("login ana", () => call("ana", "POST", "/login", { email: "ana@shopnow.test", password: "Ana12345" }));
c("login bruno", () => call("bruno", "POST", "/login", { email: "bruno@shopnow.test", password: "Bruno12345" }));
c("login ANA uppercase email", () => call("x", "POST", "/login", { email: "ANA@SHOPNOW.TEST", password: "Ana12345" }));
c("login wrong pass", () => call("x", "POST", "/login", { email: "ana@shopnow.test", password: "ana12345" }));
c("login password as array", () => call("x", "POST", "/login", { email: "ana@shopnow.test", password: ["Ana12345"] }));
c("login malformed json", () => call("x", "POST", "/login", "{bad"));
c("me without session", () => call(null, "GET", "/me"));

c("coupon FLOCK10", () => call(null, "POST", "/coupons/validate", { code: "FLOCK10" }));
c("coupon flock10", () => call(null, "POST", "/coupons/validate", { code: "flock10" }));
c("coupon Flock10", () => call(null, "POST", "/coupons/validate", { code: "Flock10" }));
c("coupon ' FLOCK10 '", () => call(null, "POST", "/coupons/validate", { code: " FLOCK10 " }));
c("coupon bienvenida15", () => call(null, "POST", "/coupons/validate", { code: "bienvenida15" }));
c("coupon NOPE", () => call(null, "POST", "/coupons/validate", { code: "NOPE" }));
c("coupon empty", () => call(null, "POST", "/coupons/validate", { code: "" }));
c("coupon __proto__", () => call(null, "POST", "/coupons/validate", { code: "__proto__" }));
c("coupon constructor", () => call(null, "POST", "/coupons/validate", { code: "constructor" }));

c("products all", () => call(null, "GET", "/products").then((r) => ({ ...r, data: r.data.length })));
c("products q=MUG", () => call(null, "GET", "/products?q=MUG").then((r) => ({ ...r, data: r.data.map((p) => p.name) })));
c("products category=home (lowercase)", () => call(null, "GET", "/products?category=home").then((r) => ({ ...r, data: r.data.length })));
c("products q=' mug'", () => call(null, "GET", "/products?q=%20mug").then((r) => ({ ...r, data: r.data.length })));
c("product 999", () => call(null, "GET", "/products/999"));
c("product abc", () => call(null, "GET", "/products/abc"));
c("product 1.0", () => call(null, "GET", "/products/1.0"));
c("product -1", () => call(null, "GET", "/products/-1"));

c("orders as ana", () => call("ana", "GET", "/orders").then((r) => ({ ...r, data: r.data.map((o) => `${o.id}:${o.userId}:${o.displayDate} ${o.displayTime}`) })));
c("IDOR ana -> order 3 (bruno)", () => call("ana", "GET", "/orders/3"));
c("order 2 date (02:30Z = 23:30 ART 14-oct)", () => call("ana", "GET", "/orders/2"));
c("payments as ana", () => call("ana", "GET", "/payments").then((r) => ({ ...r, data: r.data.map((p) => `${p.id}:${p.orderId}:${p.amount}:${p.createdAt}`) })));
c("orders unauth", () => call(null, "GET", "/orders"));

c("checkout unauth", () => call(null, "POST", "/checkout", co([{ productId: 1, quantity: 1 }])));
c("checkout happy 1 mug", () => call("ana", "POST", "/checkout", co([{ productId: 1, quantity: 1 }])));
c("checkout 3 mugs (8.35x3=25.05)", () => call("ana", "POST", "/checkout", co([{ productId: 1, quantity: 3 }])));
c("checkout 3 backpacks (39.9x3=119.70)", () => call("ana", "POST", "/checkout", co([{ productId: 4, quantity: 3 }])));
c("checkout flock10 lowercase", () => call("ana", "POST", "/checkout", co([{ productId: 3, quantity: 2 }], { coupons: ["flock10"] })));
c("checkout 2 coupons stacked", () => call("ana", "POST", "/checkout", co([{ productId: 3, quantity: 2 }], { coupons: ["FLOCK10", "BIENVENIDA15"] })));
c("checkout same coupon twice", () => call("ana", "POST", "/checkout", co([{ productId: 3, quantity: 2 }], { coupons: ["FLOCK10", "FLOCK10"] })));
c("checkout coupons x11 (110%)", () => call("ana", "POST", "/checkout", co([{ productId: 3, quantity: 1 }], { coupons: Array(11).fill("FLOCK10") })));
c("checkout qty 0", () => call("ana", "POST", "/checkout", co([{ productId: 3, quantity: 0 }])));
c("checkout qty -2", () => call("ana", "POST", "/checkout", co([{ productId: 3, quantity: -2 }])));
c("checkout qty 1.5", () => call("ana", "POST", "/checkout", co([{ productId: 3, quantity: 1.5 }])));
c("checkout qty 'abc'", () => call("ana", "POST", "/checkout", co([{ productId: 3, quantity: "abc" }])));
c("checkout qty missing", () => call("ana", "POST", "/checkout", co([{ productId: 3 }])));
c("checkout duplicated product lines", () => call("ana", "POST", "/checkout", co([{ productId: 2, quantity: 2 }, { productId: 2, quantity: 2 }])));
c("checkout chair qty 5 > stock 2", () => call("ana", "POST", "/checkout", co([{ productId: 8, quantity: 5 }])));
c("product 8 stock after", () => call(null, "GET", "/products/8"));
c("product 3 stock after negatives", () => call(null, "GET", "/products/3"));
c("checkout declined 0000", () => call("ana", "POST", "/checkout", co([{ productId: 1, quantity: 1 }], { card: { number: "4242424242420000" } })));
c("checkout card 15 digits", () => call("ana", "POST", "/checkout", co([{ productId: 1, quantity: 1 }], { card: { number: "424242424242424" } })));
c("checkout card with spaces", () => call("ana", "POST", "/checkout", co([{ productId: 1, quantity: 1 }], { card: { number: "4242 4242 4242 4242" } })));
c("checkout card with dashes", () => call("ana", "POST", "/checkout", co([{ productId: 1, quantity: 1 }], { card: { number: "4242-4242-4242-4242" } })));
c("checkout card as number type", () => call("ana", "POST", "/checkout", co([{ productId: 1, quantity: 1 }], { card: { number: 4242424242424242 } })));
c("checkout name with accent", () => call("ana", "POST", "/checkout", co([{ productId: 1, quantity: 1 }], { shipping: { name: "Ana García", address: "1234 Corrientes Ave" } })));
c("checkout name O'Brien", () => call("ana", "POST", "/checkout", co([{ productId: 1, quantity: 1 }], { shipping: { name: "Liam O'Brien", address: "1234 Corrientes Ave" } })));
c("checkout name Muñoz", () => call("ana", "POST", "/checkout", co([{ productId: 1, quantity: 1 }], { shipping: { name: "Ana Muñoz", address: "Av. Corrientes 1234, 3°B" } })));
c("checkout name as number", () => call("ana", "POST", "/checkout", co([{ productId: 1, quantity: 1 }], { shipping: { name: 123, address: "x" } })));
c("checkout name 5000 chars", () => call("ana", "POST", "/checkout", co([{ productId: 1, quantity: 1 }], { shipping: { name: "A".repeat(5000), address: "x" } })));
c("checkout productId 999", () => call("ana", "POST", "/checkout", co([{ productId: 999, quantity: 1 }])));
c("checkout items not array", () => call("ana", "POST", "/checkout", co({ productId: 1, quantity: 1 })));
c("checkout items [null]", () => call("ana", "POST", "/checkout", co([null])));
c("checkout coupon unknown", () => call("ana", "POST", "/checkout", co([{ productId: 1, quantity: 1 }], { coupons: ["NOPE"] })));
c("checkout coupons as string", () => call("ana", "POST", "/checkout", co([{ productId: 1, quantity: 1 }], { coupons: "FLOCK10" })));
c("checkout total>100 latency (chair)", () => call("ana", "POST", "/checkout", co([{ productId: 8, quantity: 1 }])));
c("payments ana after", () => call("ana", "GET", "/payments").then((r) => ({ ...r, data: r.data.map((p) => `${p.id}:o${p.orderId}:${p.amount}`) })));
c("orders ana after", () => call("ana", "GET", "/orders").then((r) => ({ ...r, data: r.data.map((o) => `${o.id}:${o.total}:${o.displayDate}`) })));
c("logout ana", () => call("ana", "POST", "/logout"));
c("orders with old cookie", () => call("ana", "GET", "/orders"));

await reset();
for (const [label, fn] of cases) {
  try { show(label, await fn()); } catch (e) { console.log(label.padEnd(48), "ERR", e.message); }
}
