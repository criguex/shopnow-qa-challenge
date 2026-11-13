import { randomUUID } from "node:crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import { cartTotals, type Coupon } from "../shared/money.js";
import { load, nextId, resetData, save, type Order, type User } from "./db.js";

const COUPONS: Record<string, number> = {
  FLOCK10: 10,
  BIENVENIDA15: 15,
};

const TIME_ZONE = "America/Argentina/Buenos_Aires";
const sessions = new Map<string, number>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function findCoupon(code: string): Coupon | null {
  const typed = code.trim();
  const key = Object.keys(COUPONS).find((k) => k.toLowerCase() === typed.toLowerCase());
  if (!key) return null;
  return { code: key, percent: COUPONS[key] };
}

function formatOrderDate(iso: string) {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  const displayDate = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return { displayDate, displayTime: time };
}

function presentOrder(order: Order) {
  return { ...order, ...formatOrderDate(order.createdAt) };
}

function currentUser(req: Request): User | null {
  const token = req.headers.cookie?.split(";").map((c) => c.trim()).find((c) => c.startsWith("sid="))?.slice(4);
  const userId = token ? sessions.get(token) : undefined;
  if (!userId) return null;
  return load().users.find((u) => u.id === userId) ?? null;
}

function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ error: "You need to log in." });
    return;
  }
  res.locals.user = user;
  next();
}

export const api = Router();

api.post("/test/reset", (_req, res) => {
  resetData();
  res.json({ ok: true });
});

api.post("/login", (req, res) => {
  const { email, password } = req.body ?? {};
  const user = load().users.find((u) => u.email.toLowerCase() === String(email ?? "").trim().toLowerCase() && u.password === password);
  if (!user) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }
  const token = randomUUID();
  sessions.set(token, user.id);
  res.setHeader("Set-Cookie", `sid=${token}; Path=/; HttpOnly; SameSite=Lax`);
  res.json({ id: user.id, name: user.name, email: user.email });
});

api.post("/logout", (req, res) => {
  const token = req.headers.cookie?.split(";").map((c) => c.trim()).find((c) => c.startsWith("sid="))?.slice(4);
  if (token) sessions.delete(token);
  res.setHeader("Set-Cookie", "sid=; Path=/; Max-Age=0");
  res.json({ ok: true });
});

api.get("/me", (req, res) => {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Not logged in." });
    return;
  }
  res.json({ id: user.id, name: user.name, email: user.email });
});

api.get("/products", (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const category = String(req.query.category ?? "").trim();
  const products = load().products.filter(
    (p) => (!q || p.name.toLowerCase().includes(q)) && (!category || p.category === category),
  );
  res.json(products);
});

api.get("/products/:id", (req, res) => {
  const product = load().products.find((p) => p.id === Number(req.params.id));
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  res.json(product);
});

api.post("/coupons/validate", (req, res) => {
  const coupon = findCoupon(String(req.body?.code ?? ""));
  if (!coupon) {
    res.status(404).json({ error: "This coupon does not exist." });
    return;
  }
  res.json(coupon);
});

api.get("/orders", requireUser, (_req, res) => {
  const user = res.locals.user as User;
  const orders = load().orders.filter((o) => o.userId === user.id).sort((a, b) => b.id - a.id);
  res.json(orders.map(presentOrder));
});

api.get("/orders/:id", requireUser, (req, res) => {
  const user = res.locals.user as User;
  const order = load().orders.find((o) => o.id === Number(req.params.id) && o.userId === user.id);
  if (!order) {
    res.status(404).json({ error: "Order not found." });
    return;
  }
  res.json(presentOrder(order));
});

api.get("/payments", requireUser, (_req, res) => {
  const user = res.locals.user as User;
  const payments = load().payments.filter((p) => p.userId === user.id).sort((a, b) => b.id - a.id);
  res.json(payments);
});

api.post("/checkout", requireUser, async (req, res) => {
  const user = res.locals.user as User;
  const { items, coupons, shipping, card } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Your cart is empty." });
    return;
  }
  if (items.some((item) => typeof item !== "object" || item === null)) {
    res.status(400).json({ error: "Invalid cart items." });
    return;
  }
  if (typeof shipping?.name !== "string" || typeof shipping?.address !== "string") {
    res.status(400).json({ error: "Please fill in the shipping details." });
    return;
  }
  if (!shipping.name.trim() || !shipping.address.trim()) {
    res.status(400).json({ error: "Please fill in the shipping details." });
    return;
  }
  const SAFE_TEXT = /^[\p{L}\p{M}0-9 .,#/°º'’-]+$/u;
  if (!SAFE_TEXT.test(shipping.name.trim()) || !SAFE_TEXT.test(shipping.address.trim())) {
    res.status(400).json({ error: "Please fill in the shipping details." });
    return;
  }
  const cardNumber = String(card?.number ?? "").replace(/\s/g, "");
  if (!/^\d{16}$/.test(cardNumber)) {
    res.status(400).json({ error: "The card number must have 16 digits." });
    return;
  }

  const data = load();
  const lines = [];
  for (const item of items) {
    const product = data.products.find((p) => p.id === Number(item.productId));
    if (!product) {
      res.status(400).json({ error: "One of the products no longer exists." });
      return;
    }
    const quantity = item.quantity;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
      res.status(400).json({ error: "Quantities must be whole numbers of at least 1." });
      return;
    }
    lines.push({ productId: product.id, name: product.name, price: product.price, quantity });
  }

  if (coupons !== undefined && !Array.isArray(coupons)) {
    res.status(400).json({ error: "Coupons must be a list." });
    return;
  }
  const codes: string[] = Array.isArray(coupons) ? coupons.map(String) : [];
  if (codes.length > 1) {
    res.status(400).json({ error: "Only one coupon can be used per purchase." });
    return;
  }
  const appliedCoupons: Coupon[] = [];
  for (const code of codes) {
    const coupon = findCoupon(code);
    if (!coupon) {
      res.status(400).json({ error: `Coupon ${code} does not exist.` });
      return;
    }
    appliedCoupons.push(coupon);
  }

  const outOfStock = (products: { id: number; stock: number }[]) =>
    lines.some((line) => {
      const requested = lines.filter((l) => l.productId === line.productId).reduce((sum, l) => sum + l.quantity, 0);
      return requested > (products.find((p) => p.id === line.productId)?.stock ?? 0);
    });
  if (outOfStock(data.products)) {
    res.status(409).json({ error: "Some products are out of stock." });
    return;
  }

  const totals = cartTotals(lines, appliedCoupons);

  await sleep(totals.total > 100 ? 4000 : 700);

  if (cardNumber.endsWith("0000")) {
    res.status(402).json({ error: "The payment was declined by the bank." });
    return;
  }

  const fresh = load();
  if (outOfStock(fresh.products)) {
    res.status(409).json({ error: "Some products are out of stock." });
    return;
  }
  const now = new Date().toISOString();
  const orderId = nextId(fresh.orders);
  const paymentId = nextId(fresh.payments);
  fresh.payments.push({ id: paymentId, userId: user.id, orderId, amount: totals.total, cardLast4: cardNumber.slice(-4), status: "approved", createdAt: now });
  const order: Order = {
    id: orderId,
    userId: user.id,
    createdAt: now,
    items: lines,
    coupons: appliedCoupons,
    ...totals,
    shipping: { name: shipping.name.trim(), address: shipping.address.trim() },
    paymentId,
  };
  fresh.orders.push(order);
  for (const line of lines) {
    const product = fresh.products.find((p) => p.id === line.productId);
    if (product) product.stock -= line.quantity;
  }
  save(fresh);
  res.status(201).json(presentOrder(order));
});
