# BUG-13 — Late-night orders show the next day's date

- **Environment:** ShopNow local (`npm run dev`) · app version: commit `40bc732` · Chromium (Playwright 1.48.2) · timezone America/Argentina/Buenos_Aires · fresh data (`POST /api/test/reset`) · users ana@shopnow.test / bruno@shopnow.test · recorded 2026-11-13 15:38 UTC on http://localhost:4322 (port 4321 was in use on the recording machine; same app and data)
- **Resource:** [http://localhost:4321/orders/2](http://localhost:4321/orders/2)
- **Acceptance criteria:** AC-13 (see docs/TRACEABILITY.md) · **Report:** [BUGS.md](../../BUGS.md) › BUG-13
- **Automated test:** `tests/orders.spec.ts (ORD-03, ORD-04)`

## Expected vs actual

- **Expected:** Date: 10/14/2026 · 23:30
- **Actual:** "Date: 10/15/2026 · 23:30" (time converted, date not)

## Video

![BUG-13](BUG-13.gif)

Full quality: [BUG-13.mp4](BUG-13.mp4) (pointer visible, step banners, failure marked in red).

## Steps

### Step 1 — Log in as Ana (ana@shopnow.test)

![BUG-13 step 1](BUG-13-01.png)

### Step 2 — Open order #2 (placed 2026-10-15T02:30Z = Oct 14, 23:30 in Argentina)

![BUG-13 step 2](BUG-13-02.png)

### Step 3 — Failure: expected vs actual

![BUG-13 step 3](BUG-13-03.png)

## HTTP log

| # | Request | Status | Request body | Response (first 300 chars) |
|---|---|---|---|---|
| 1 | `GET /api/me` | **401** |  | `{"error":"Not logged in."}` |
| 2 | `POST /api/login` | **200** | `{"email":"ana@shopnow.test","password":"Ana12345"}` | `{"id":1,"name":"Ana Garcia","email":"ana@shopnow.test"}` |
| 3 | `GET /api/products?` | **200** |  | `[{"id":1,"name":"Ceramic mug","category":"Home","price":8.35,"stock":25,"description":"350 ml glazed ceramic mug. Microwave safe."},{"id":2,"name":"Bluetooth headphones","category":"Tech","price":49.99,"stock":3,"description":"Wireless headphones with 20 hours of battery and a charging case."},{"id"` |
| 4 | `GET /api/me` | **200** |  | `{"id":1,"name":"Ana Garcia","email":"ana@shopnow.test"}` |
| 5 | `GET /api/orders/2` | **200** |  | `{"id":2,"userId":1,"createdAt":"2026-10-15T02:30:00.000Z","items":[{"productId":5,"name":"Desk lamp","price":24.55,"quantity":1}],"coupons":[],"subtotal":24.55,"discount":0,"total":24.55,"shipping":{"name":"Ana Garcia","address":"1234 Corrientes Ave, Buenos Aires"},"paymentId":2,"displayDate":"10/15` |
