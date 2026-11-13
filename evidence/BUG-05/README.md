# BUG-05 — The API accepts several coupons per purchase (even a negative total)

- **Environment:** ShopNow local (`npm run dev`) · app version: commit `40bc732` · Chromium (Playwright 1.48.2) · timezone America/Argentina/Buenos_Aires · fresh data (`POST /api/test/reset`) · users ana@shopnow.test / bruno@shopnow.test · recorded 2026-11-13 15:36 UTC on http://localhost:4322 (port 4321 was in use on the recording machine; same app and data)
- **Resource:** [http://localhost:4321/api/checkout](http://localhost:4321/api/checkout)
- **Acceptance criteria:** AC-07, AC-14 (see docs/TRACEABILITY.md) · **Report:** [BUGS.md](../../BUGS.md) › BUG-05
- **Automated test:** `tests/coupons.spec.ts (CPN-06…CPN-08)`

## Expected vs actual

- **Expected:** 400 Only one coupon can be used per purchase; no order
- **Actual:** 201 with 25% off for two coupons; 201 with total -1.49 for 11 × FLOCK10

## HTTP log

| # | Request | Status | Request body | Response (first 300 chars) |
|---|---|---|---|---|
| 1 | `POST /api/login` | **200** | `{"email":"ana@shopnow.test","password":"Ana12345"}` | `{"id":1,"name":"Ana Garcia","email":"ana@shopnow.test"}` |
| 2 | `POST /api/checkout` | **201** | `{"items":[{"productId":3,"quantity":2}],"coupons":["FLOCK10","BIENVENIDA15"],"shipping":{"name":"Ana Garcia","address":"1234 Corrientes Ave"},"card":{"number":"4242424242424242"}}` | `{"id":4,"userId":1,"createdAt":"2026-11-13T15:36:48.616Z","items":[{"productId":3,"name":"Basic T-shirt","price":14.35,"quantity":2}],"coupons":[{"code":"FLOCK10","percent":10},{"code":"BIENVENIDA15","percent":15}],"subtotal":28.7,"discount":7.18,"total":21.52,"shipping":{"name":"Ana Garcia","addres` |
| 3 | `POST /api/checkout` | **201** | `{"items":[{"productId":3,"quantity":1}],"coupons":["FLOCK10","FLOCK10","FLOCK10","FLOCK10","FLOCK10","FLOCK10","FLOCK10","FLOCK10","FLOCK10","FLOCK10","FLOCK10"],"shipping":{"name":"Ana Garcia","address":"1234 Corrientes Ave"},"card":{"number":"4242424242424242"}}` | `{"id":5,"userId":1,"createdAt":"2026-11-13T15:36:49.325Z","items":[{"productId":3,"name":"Basic T-shirt","price":14.35,"quantity":1}],"coupons":[{"code":"FLOCK10","percent":10},{"code":"FLOCK10","percent":10},{"code":"FLOCK10","percent":10},{"code":"FLOCK10","percent":10},{"code":"FLOCK10","percent"` |
