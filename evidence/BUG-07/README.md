# BUG-07 — Checkout never checks stock: overselling and negative stock

- **Environment:** ShopNow local (`npm run dev`) · app version: commit `29a3e61` · Chromium (Playwright 1.48.2) · timezone America/Argentina/Buenos_Aires · fresh data (`POST /api/test/reset`) · users ana@shopnow.test / bruno@shopnow.test · recorded 2026-11-13 15:46 UTC on http://localhost:4322 (port 4321 was in use on the recording machine; same app and data)
- **Resource:** [http://localhost:4321/api/checkout](http://localhost:4321/api/checkout)
- **Acceptance criteria:** AC-03, AC-14 (see docs/TRACEABILITY.md) · **Report:** [BUGS.md](../../BUGS.md) › BUG-07
- **Automated test:** `tests/stock.spec.ts (STK-01, STK-02)`

## Expected vs actual

- **Expected:** 409 out of stock; chair stock stays 2
- **Actual:** 201 for 3 chairs with stock 2; chair stock is now -1

## What the user sees

### Step 1 — Open the Ergonomic chair page

![BUG-07 step 1](BUG-07-01.png)

### Step 2 — Failure: expected vs actual

![BUG-07 step 2](BUG-07-02.png)

## HTTP log

| # | Request | Status | Request body | Response (first 300 chars) |
|---|---|---|---|---|
| 1 | `POST /api/login` | **200** | `{"email":"ana@shopnow.test","password":"Ana12345"}` | `{"id":1,"name":"Ana Garcia","email":"ana@shopnow.test"}` |
| 2 | `GET /api/products/8` | **200** |  | `{"id":8,"name":"Ergonomic chair","category":"Home","price":129,"stock":2,"description":"Office chair with adjustable lumbar support and 3D armrests."}` |
| 3 | `POST /api/checkout` | **201** | `{"items":[{"productId":8,"quantity":3}],"coupons":[],"shipping":{"name":"Ana Garcia","address":"1234 Corrientes Ave"},"card":{"number":"4242424242424242"}}` | `{"id":4,"userId":1,"createdAt":"2026-11-13T15:46:04.189Z","items":[{"productId":8,"name":"Ergonomic chair","price":129,"quantity":3}],"coupons":[],"subtotal":387,"discount":0,"total":387,"shipping":{"name":"Ana Garcia","address":"1234 Corrientes Ave"},"paymentId":4,"displayDate":"11/13/2026","displa` |
| 4 | `GET /api/products/8` | **200** |  | `{"id":8,"name":"Ergonomic chair","category":"Home","price":129,"stock":-1,"description":"Office chair with adjustable lumbar support and 3D armrests."}` |
