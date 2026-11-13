# BUG-15 — A coupons value that is not a list is silently ignored

- **Environment:** ShopNow local (`npm run dev`) · app version: commit `40bc732` · Chromium (Playwright 1.48.2) · timezone America/Argentina/Buenos_Aires · fresh data (`POST /api/test/reset`) · users ana@shopnow.test / bruno@shopnow.test · recorded 2026-11-13 15:38 UTC on http://localhost:4322 (port 4321 was in use on the recording machine; same app and data)
- **Resource:** [http://localhost:4321/api/checkout](http://localhost:4321/api/checkout)
- **Acceptance criteria:** AC-14, AC-07 (see docs/TRACEABILITY.md) · **Report:** [BUGS.md](../../BUGS.md) › BUG-15
- **Automated test:** `tests/checkout-validation.spec.ts (CHK-11)`

## Expected vs actual

- **Expected:** 400 invalid data
- **Actual:** 201; discount 0, total 28.7 (full price, no warning)

## HTTP log

| # | Request | Status | Request body | Response (first 300 chars) |
|---|---|---|---|---|
| 1 | `POST /api/login` | **200** | `{"email":"ana@shopnow.test","password":"Ana12345"}` | `{"id":1,"name":"Ana Garcia","email":"ana@shopnow.test"}` |
| 2 | `POST /api/checkout` | **201** | `{"items":[{"productId":3,"quantity":2}],"coupons":"FLOCK10","shipping":{"name":"Ana Garcia","address":"1234 Corrientes Ave"},"card":{"number":"4242424242424242"}}` | `{"id":4,"userId":1,"createdAt":"2026-11-13T15:38:07.027Z","items":[{"productId":3,"name":"Basic T-shirt","price":14.35,"quantity":2}],"coupons":[],"subtotal":28.7,"discount":0,"total":28.7,"shipping":{"name":"Ana Garcia","address":"1234 Corrientes Ave"},"paymentId":4,"displayDate":"11/13/2026","disp` |
