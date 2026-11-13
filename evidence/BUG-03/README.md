# BUG-03 — One malformed checkout request takes the whole store down

- **Environment:** ShopNow local (`npm run dev`) · app version: commit `40bc732` · Chromium (Playwright 1.48.2) · timezone America/Argentina/Buenos_Aires · fresh data (`POST /api/test/reset`) · users ana@shopnow.test / bruno@shopnow.test · recorded 2026-11-13 15:46 UTC on http://localhost:4322 (port 4321 was in use on the recording machine; same app and data)
- **Resource:** [http://localhost:4321/api/checkout](http://localhost:4321/api/checkout)
- **Acceptance criteria:** AC-14 (see docs/TRACEABILITY.md) · **Report:** [BUGS.md](../../BUGS.md) › BUG-03
- **Automated test:** `tests/zz-server-robustness.spec.ts (ROB-01, ROB-02)`

## Expected vs actual

- **Expected:** 400 invalid data, and GET /api/products keeps answering 200
- **Actual:** checkout answered "socket hang up"; the next GET /api/products answered ERR (server process exited)
- **Logs:** Server output of the crash: [server.log](server.log) (`TypeError: shipping?.name?.trim is not a function`, then the Node process exits and every page and API call gets connection refused).

## HTTP log

| # | Request | Status | Request body | Response (first 300 chars) |
|---|---|---|---|---|
| 1 | `POST /api/login` | **200** | `{"email":"ana@shopnow.test","password":"Ana12345"}` | `{"id":1,"name":"Ana Garcia","email":"ana@shopnow.test"}` |
| 2 | `GET /api/products` | **200** |  | `[{"id":1,"name":"Ceramic mug","category":"Home","price":8.35,"stock":25,"description":"350 ml glazed ceramic mug. Microwave safe."},{"id":2,"name":"Bluetooth headphones","category":"Tech","price":49.99,"stock":3,"description":"Wireless headphones with 20 hours of battery and a charging case."},{"id"` |
| 3 | `POST /api/checkout` | **ERR** | `{"items":[{"productId":3,"quantity":1}],"coupons":[],"shipping":{"name":123,"address":"1234 Corrientes Ave"},"card":{"number":"4242424242424242"}}` | `apiRequestContext.fetch: socket hang up` |
| 4 | `GET /api/products` | **ERR** |  | `apiRequestContext.fetch: connect ECONNREFUSED ::1:4322` |
