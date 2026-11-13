# Bugs found

15 bugs, sorted by priority (money, security and availability first). Every one was reproduced against the running app (UI and/or API) before it was written here, and every one has at least one Playwright test in `tests/` that fails today because of it. Improvement suggestions that are not bugs are at the end.

| ID | Title | Source | Severity | Priority |
|---|---|---|---|---|
| BUG-01 | Payments over $100 are reported as failed but the customer is charged | User report 1 | Critical | P1 |
| BUG-02 | Any logged-in user can read other customers' orders | Found by me | Critical | P1 |
| BUG-03 | One malformed checkout request takes the whole store down | Found by me | Critical | P1 |
| BUG-04 | Checkout accepts zero, negative, decimal and non-numeric quantities | Found by me | Critical | P1 |
| BUG-05 | The API accepts several coupons per purchase (even a negative total) | Found by me | Critical | P1 |
| BUG-06 | Lowercase coupon codes are accepted but give 0% discount | User report 2 | High | P1 |
| BUG-07 | Checkout never checks stock: overselling and negative stock | Found by me | High | P1 |
| BUG-08 | Products added with the catalog "Add" button vanish on reload | User report 3 | High | P2 |
| BUG-09 | Names and addresses with accents, ñ, ° or apostrophes are rejected | Found by me | High | P2 |
| BUG-10 | Line totals are truncated, so some amounts are one cent off | Found by me | Medium | P2 |
| BUG-11 | After a reload the cart lets the user stack a second coupon | Found by me | High | P2 |
| BUG-12 | Adding a product twice from its page puts more than the stock in the cart | Found by me | Medium | P2 |
| BUG-13 | Late-night orders show the next day's date | Found by me | Medium | P2 |
| BUG-14 | Malformed JSON gets an HTML error page instead of a JSON error | Found by me | Low | P3 |
| BUG-15 | A `coupons` value that is not a list is silently ignored | Found by me | Low | P3 |

Environment for all reports: local ShopNow (`npm run dev`, `http://localhost:4321`), Chromium (Playwright 1.48.2), timezone America/Argentina/Buenos_Aires, fresh data (`npm run reset` / `POST /api/test/reset`), users `ana@shopnow.test` and `bruno@shopnow.test`.

---

## BUG-01 — Payments over $100 are reported as failed but the customer is charged

- **Source:** user report 1 ("Sometimes when I pay it says it failed, but I still got charged.")
- **Type:** Integration
- **Severity:** Critical
- **Priority:** P1 — the customer is charged without a confirmation, and the cart is kept, so the natural reaction (press Pay again) charges them a second time. Direct money loss and support tickets.
- **Preconditions:** logged in as Ana; cart with a total above $100 (e.g. 1 × Ergonomic chair, $129.00).
- **Steps to reproduce:**
  1. Go to `/checkout`.
  2. Fill name `Ana Garcia`, address `1234 Corrientes Ave`, card `4242424242424242`.
  3. Click **Pay** and wait.
  4. Open **My payments** (or `GET /api/payments`).
- **Expected result:** the bank approves the card, so the order confirmation page is shown and exactly one payment of $129.00 exists.
- **Actual result:** after 3 s the checkout shows "We couldn't process your payment. Please try again." and stays on the form with the cart intact. One second later the order and an approved payment of $129.00 exist. Pressing Pay again creates a second order and a second charge. A declined card (`…0000`) on an order above $100 also gets the generic message instead of "The payment was declined by the bank."
- **Evidence:** [evidence/BUG-01](evidence/BUG-01/README.md) — numbered step screenshots, video with pointer (MP4/GIF), expected vs actual, HTTP log. Orders of $100 or less respond in ~0.7 s and work; orders above $100 respond in ~4.0 s (`perf/latency.mjs`).
- **Resource:** [http://localhost:4321/checkout](http://localhost:4321/checkout)
- **Automated test:** `tests/payments.spec.ts` (both `[BUG-01]` tests) — cases PAY-01, PAY-02
- **Traceability:** AC-11 (docs/TRACEABILITY.md) · fix: commit `fix(BUG-01)` on branch `fixes`
- **Root cause in the code (optional):** `app/web/src/pages/Checkout.tsx` aborts the request after `PAYMENT_TIMEOUT_MS = 3000`, while `app/server/api.ts` waits 4000 ms for totals above $100 (`sleep(totals.total > 100 ? 4000 : 700)`) and then creates the order anyway. The abort is shown as a payment failure, and the server has no idempotency key to stop the retry from charging twice.

## BUG-02 — Any logged-in user can read other customers' orders

- **Source:** found by me
- **Type:** Security
- **Severity:** Critical
- **Priority:** P1 — exposes other customers' name, shipping address, products and totals (personal data) just by changing a number in the URL. Order IDs are sequential, so all orders can be enumerated.
- **Preconditions:** logged in as Ana. Order #3 belongs to Bruno (seed data).
- **Steps to reproduce:**
  1. As Ana, open `/orders/3` (or `GET /api/orders/3`).
- **Expected result:** `404` (or `403`), and the page says the order is not available. Ana only sees her own orders (SPEC: "A logged-in user can see their orders").
- **Actual result:** `200` with Bruno's order: "Ship to: Bruno Diaz, 742 Evergreen St, Rosario", Mechanical keyboard, total $80.91.
- **Evidence:** [evidence/BUG-02](evidence/BUG-02/README.md) — numbered step screenshots, video with pointer (MP4/GIF), expected vs actual, HTTP log
- **Resource:** [http://localhost:4321/orders/3](http://localhost:4321/orders/3)
- **Automated test:** `tests/orders.spec.ts` (both `[BUG-02]` tests) — cases ORD-01, ORD-02
- **Traceability:** AC-12 (docs/TRACEABILITY.md) · fix: commit `fix(BUG-02)` on branch `fixes`
- **Root cause in the code (optional):** `GET /orders/:id` in `app/server/api.ts` looks the order up by ID only; it never compares `order.userId` with the logged-in user (the list endpoint does).

## BUG-03 — One malformed checkout request takes the whole store down

- **Source:** found by me (boundary/mutant testing on the API)
- **Type:** Security / Integration (availability)
- **Severity:** Critical
- **Priority:** P1 — any logged-in user (or a buggy client) can stop the store for everyone with one request. Nothing restarts it.
- **Preconditions:** logged in (any user).
- **Steps to reproduce:**
  1. `POST /api/checkout` with `"shipping": { "name": 123, "address": "1234 Corrientes Ave" }` (rest valid), **or** with `"items": [null]`.
  2. Request any page or `GET /api/products`.
- **Expected result:** `400` "invalid data", and the store keeps working.
- **Actual result:** the request hangs up (`socket hang up`) and the Node process exits with `TypeError: shipping?.name?.trim is not a function` (or `Cannot read properties of null (reading 'productId')`). Every following request gets `ECONNREFUSED`.
- **Evidence:** [evidence/BUG-03](evidence/BUG-03/README.md) — HTTP log with requests, status codes and responses, plus the [server log](evidence/BUG-03/server.log) of the crash (`TypeError: shipping?.name?.trim is not a function`, then the process exits).
- **Resource:** [http://localhost:4321/api/checkout](http://localhost:4321/api/checkout)
- **Automated test:** `tests/zz-server-robustness.spec.ts` (runs last on purpose because it kills the server while the bug is open) — cases ROB-01, ROB-02
- **Traceability:** AC-14 (docs/TRACEABILITY.md) · fix: commit `fix(BUG-03)` on branch `fixes`
- **Root cause in the code (optional):** the checkout handler in `app/server/api.ts` assumes string/object types without checking them, and it is an `async` Express 4 handler with no `try/catch` or error middleware, so the rejected promise is unhandled and Node terminates.

## BUG-04 — Checkout accepts zero, negative, decimal and non-numeric quantities

- **Source:** found by me (mutants of the golden checkout payload)
- **Type:** Logic / Data
- **Severity:** Critical
- **Priority:** P1 — a negative quantity creates an order with a negative total ("approved" payment of -$28.70, i.e. a refund to the attacker) and *increases* stock; non-numeric quantities corrupt stock to `null`.
- **Preconditions:** logged in.
- **Steps to reproduce:** `POST /api/checkout` with a valid body, changing only `items[0].quantity` to `0`, `-2`, `1.5`, `"abc"`, or removing it.
- **Expected result:** `400` invalid data, no order, no payment, stock unchanged (SPEC: quantity minimum 1; docs/API.md: `400` invalid data).
- **Actual result:** `201` every time. `-2` → order total `-28.70`, payment `-28.70` approved, T-shirt stock 40 → 42. `1.5` → total `21.52`. `"abc"`/missing → order with `subtotal: null`, `total: null` and product stock becomes `null`; from then on **My payments and My orders render a blank page** for that user (`TypeError: Cannot read properties of null (reading 'toLocaleString')`).
- **Evidence:** [evidence/BUG-04](evidence/BUG-04/README.md) — HTTP log with requests, status codes and responses, plus screenshots of what the customer then sees (red box, expected vs actual). request/response: `{"items":[{"productId":3,"quantity":-2}],…}` → `201 {"subtotal":-28.7,"discount":0,"total":-28.7}`
- **Resource:** [http://localhost:4321/api/checkout](http://localhost:4321/api/checkout)
- **Automated test:** `tests/checkout-validation.spec.ts` (5 `[BUG-04]` mutants) — cases CHK-02, CHK-03, CHK-04, CHK-05, CHK-06
- **Traceability:** AC-05, AC-14 (docs/TRACEABILITY.md) · fix: commit `fix(BUG-04)` on branch `fixes`
- **Root cause in the code (optional):** `app/server/api.ts` does `Number(item.quantity)` without checking it is a positive integer.

## BUG-05 — The API accepts several coupons per purchase (even a negative total)

- **Source:** found by me
- **Type:** Logic / Security
- **Severity:** Critical
- **Priority:** P1 — SPEC says "only one per purchase". Through the API anyone can stack coupons: FLOCK10 + BIENVENIDA15 = 25% off; FLOCK10 × 11 = 110% off, which produces an order with total -$1.49 and an approved negative payment.
- **Preconditions:** logged in.
- **Steps to reproduce:** `POST /api/checkout` with 2 T-shirts and `"coupons": ["FLOCK10","BIENVENIDA15"]` (or `["FLOCK10","FLOCK10"]`, or 11 × `"FLOCK10"`).
- **Expected result:** `400` (only one coupon per purchase), no order.
- **Actual result:** `201`; discount `7.18` (25%), `5.74` (same coupon twice), and for 11 coupons `total: -1.49`.
- **Evidence:** [evidence/BUG-05](evidence/BUG-05/README.md) — HTTP log with requests, status codes and responses, plus screenshots of what the customer then sees (red box, expected vs actual). response for 11 coupons: `{"subtotal":14.35,"discount":15.84,"total":-1.49}`
- **Resource:** [http://localhost:4321/api/checkout](http://localhost:4321/api/checkout)
- **Automated test:** `tests/coupons.spec.ts` (3 `[BUG-05]` tests) — cases CPN-06, CPN-07, CPN-08
- **Traceability:** AC-07, AC-14 (docs/TRACEABILITY.md) · fix: commit `fix(BUG-05)` on branch `fixes`
- **Root cause in the code (optional):** the one-coupon rule only exists in the browser (`cart.tsx`); `app/server/api.ts` loops over every code and `cartTotals` sums all discounts with no cap.

## BUG-06 — Lowercase coupon codes are accepted but give 0% discount

- **Source:** user report 2 ("The discount code is accepted but the price doesn't change.")
- **Type:** Logic
- **Severity:** High
- **Priority:** P1 — customers who type the code in lowercase believe they got the discount and pay full price; marketing campaigns lose effect.
- **Preconditions:** cart with 2 × Basic T-shirt (subtotal $28.70).
- **Steps to reproduce:**
  1. In the cart, type `flock10` (or `Flock10`) and click **Apply**.
- **Expected result:** codes are case-insensitive (SPEC), so 10% off: discount -$2.87, total $25.83.
- **Actual result:** "Coupon flock10 applied (0%)", discount -$0.00, total $28.70. `POST /api/coupons/validate {"code":"flock10"}` returns `{"code":"flock10","percent":0}`; checkout with `["flock10"]` charges full price.
- **Evidence:** [evidence/BUG-06](evidence/BUG-06/README.md) — numbered step screenshots, video with pointer (MP4/GIF), expected vs actual, HTTP log
- **Resource:** [http://localhost:4321/cart](http://localhost:4321/cart)
- **Automated test:** `tests/coupons.spec.ts` (`[BUG-06]`: 3 API casings, checkout total, cart UI) — cases CPN-01, CPN-02, CPN-03, CPN-04, CPN-05
- **Traceability:** AC-08, AC-09 (docs/TRACEABILITY.md) · fix: commit `fix(BUG-06)` on branch `fixes`
- **Root cause in the code (optional):** `findCoupon` in `app/server/api.ts` finds the key case-insensitively but then reads `COUPONS[typed]` with the typed text instead of the matched key, so the percent falls back to `0`.

## BUG-07 — Checkout never checks stock: overselling and negative stock

- **Source:** found by me
- **Type:** Logic / Data
- **Severity:** High
- **Priority:** P1 — the store sells products it doesn't have; stock goes negative and the documented `409 out of stock` never happens. Two customers buying the last unit at the same time both succeed.
- **Preconditions:** logged in; Ergonomic chair has stock 2.
- **Steps to reproduce:**
  1. `POST /api/checkout` with `{"productId":8,"quantity":3}`.
  2. `GET /api/products/8`.
  3. (Concurrency) three sessions buy 1 chair each at the same time.
- **Expected result:** `409` and stock stays 2 (SPEC: "Users can't buy more than the available stock"; docs/API.md: `409 out of stock`). With three simultaneous buyers, two succeed and one gets `409`; stock ends at 0.
- **Actual result:** `201`, chair stock becomes `-1`. All three simultaneous buyers get `201`; stock `-1`.
- **Evidence:** [evidence/BUG-07](evidence/BUG-07/README.md) — HTTP log with requests, status codes and responses, plus screenshots of what the customer then sees (red box, expected vs actual). `GET /api/products/8` → `{"id":8,"stock":-3}` after buying 5.
- **Resource:** [http://localhost:4321/api/checkout](http://localhost:4321/api/checkout)
- **Automated test:** `tests/stock.spec.ts` (`[BUG-07]` over-stock and race) — cases STK-01, STK-02
- **Traceability:** AC-03, AC-14 (docs/TRACEABILITY.md) · fix: commit `fix(BUG-07)` on branch `fixes`
- **Root cause in the code (optional):** `app/server/api.ts` subtracts `line.quantity` from stock without comparing it with the current stock, and the read-sleep-write sequence has no locking.

## BUG-08 — Products added with the catalog "Add" button vanish on reload

- **Source:** user report 3 ("Some things disappear from my cart when I reload the page.")
- **Type:** Logic (UI state)
- **Severity:** High
- **Priority:** P2 — lost carts mean lost sales; "Add" in the catalog is the fastest path to buy. Not P1 because the product page path works and no money is lost.
- **Preconditions:** empty cart.
- **Steps to reproduce:**
  1. On `/`, click **Add** on "Ceramic mug" ("Ceramic mug was added to your cart.").
  2. Reload the page and open the cart.
- **Expected result:** the mug is in the cart, quantity 1, total $8.35 (SPEC: "The cart persists even if the user closes the browser").
- **Actual result:** "Your cart is empty." Products added from the product page do survive, which is why users say "some things" disappear.
- **Evidence:** [evidence/BUG-08](evidence/BUG-08/README.md) — numbered step screenshots, video with pointer (MP4/GIF), expected vs actual, HTTP log. ; `localStorage["shopnow.cart"]` is `null` after a catalog Add.
- **Resource:** [http://localhost:4321/](http://localhost:4321/)
- **Automated test:** `tests/cart.spec.ts` (both `[BUG-08]` tests) — cases CART-02, CART-03
- **Traceability:** AC-02, AC-06 (docs/TRACEABILITY.md) · fix: commit `fix(BUG-08)` on branch `fixes`
- **Root cause in the code (optional):** `Catalog.tsx` calls `cart.setItems(...)` directly, which updates React state but skips `persist()`, the only function that writes to `localStorage`.

## BUG-09 — Names and addresses with accents, ñ, ° or apostrophes are rejected

- **Source:** found by me
- **Type:** Logic / UI
- **Severity:** High
- **Priority:** P2 — the store ships in Argentina (dates in Argentina time, addresses on Corrientes Ave). "Ana García", "Martín Muñoz", "3°B" or "O'Brien" cannot pay at all, and the message ("Please fill in the shipping details.") tells them they left the fields empty.
- **Assumption:** the SPEC does not restrict characters. I assume real names must be accepted; if the PO confirms an ASCII-only rule, this becomes a wrong-error-message bug (Low).
- **Steps to reproduce:** at checkout, name `Ana García`, address `Av. Corrientes 1234`, valid card → **Pay**.
- **Expected result:** order created with the name exactly as typed.
- **Actual result:** "Please fill in the shipping details." / `400`.
- **Evidence:** [evidence/BUG-09](evidence/BUG-09/README.md) — numbered step screenshots, video with pointer (MP4/GIF), expected vs actual, HTTP log
- **Resource:** [http://localhost:4321/checkout](http://localhost:4321/checkout)
- **Automated test:** `tests/checkout-validation.spec.ts` (3 `[BUG-09]` cases) — cases CHK-07, CHK-08, CHK-09
- **Traceability:** AC-11 (docs/TRACEABILITY.md) · fix: commit `fix(BUG-09)` on branch `fixes`
- **Root cause in the code (optional):** `SAFE_TEXT = /^[A-Za-z0-9 .,#/-]+$/` in `app/server/api.ts`.

## BUG-10 — Line totals are truncated, so some amounts are one cent off

- **Source:** found by me (boundary values over the seed prices)
- **Type:** Logic
- **Severity:** Medium
- **Priority:** P2 — wrong money amounts on cart, order and payment; small per order but systematic and a reconciliation/accounting problem.
- **Steps to reproduce:** add 3 × Ceramic mug ($8.35) to the cart; or buy them.
- **Expected result:** 3 × $8.35 = **$25.05** in cart, order and payment (also 6 × $8.35 = $50.10, 3 × $39.90 = $119.70).
- **Actual result:** $25.04, $50.09, $119.69. The payment is recorded as 25.04.
- **Evidence:** [evidence/BUG-10](evidence/BUG-10/README.md) — numbered step screenshots, video with pointer (MP4/GIF), expected vs actual, HTTP log
- **Resource:** [http://localhost:4321/cart](http://localhost:4321/cart)
- **Automated test:** `tests/cart.spec.ts` (4 `[BUG-10]` tests: 3 UI amounts + order/payment) — cases CART-04, CART-05, CART-06, CART-07
- **Traceability:** AC-04 (docs/TRACEABILITY.md) · fix: commit `fix(BUG-10)` on branch `fixes`
- **Root cause in the code (optional):** `lineTotal` in `app/shared/money.ts` uses `Math.floor(price * quantity * 100) / 100`; `8.35 * 3 = 25.049999…` in floating point, and floor drops the cent. It should work in integer cents and round.

## BUG-11 — After a reload the cart lets the user stack a second coupon

- **Source:** found by me (state-transition testing: apply → reload → apply)
- **Type:** Logic (UI state)
- **Severity:** High
- **Priority:** P2 — reachable by any shopper with an F5: FLOCK10 + BIENVENIDA15 = 25% off. Needs BUG-05 fixed on the server too.
- **Steps to reproduce:**
  1. Cart with 2 × Basic T-shirt; apply `FLOCK10`.
  2. Reload the page; apply `BIENVENIDA15`.
- **Expected result:** "Only one coupon can be used per purchase."; one coupon, total $25.83.
- **Actual result:** both coupons are listed and applied; total $21.52 (25% off). Without the reload the rule works.
- **Evidence:** [evidence/BUG-11](evidence/BUG-11/README.md) — numbered step screenshots, video with pointer (MP4/GIF), expected vs actual, HTTP log
- **Resource:** [http://localhost:4321/cart](http://localhost:4321/cart)
- **Automated test:** `tests/coupons.spec.ts` (`[BUG-11]`) — cases CPN-09
- **Traceability:** AC-07 (docs/TRACEABILITY.md) · fix: commit `fix(BUG-11)` on branch `fixes`
- **Root cause in the code (optional):** `couponAppliedRef` in `cart.tsx` starts as `false` on every load instead of being derived from the stored coupons.

## BUG-12 — Adding a product twice from its page puts more than the stock in the cart

- **Source:** found by me
- **Type:** Logic
- **Severity:** Medium
- **Priority:** P2 — the quantity selector limits each add to the stock, but repeated adds don't; combined with BUG-07 the order goes through.
- **Steps to reproduce:** on `/product/8` (Ergonomic chair, stock 2) select 2 → **Add to cart**, click **Add to cart** again, open the cart.
- **Expected result:** quantity 2 at most (or a message), line total $258.00.
- **Actual result:** quantity 4, line total $516.00; checkout accepts it.
- **Evidence:** [evidence/BUG-12](evidence/BUG-12/README.md) — numbered step screenshots, video with pointer (MP4/GIF), expected vs actual, HTTP log
- **Resource:** [http://localhost:4321/product/8](http://localhost:4321/product/8)
- **Automated test:** `tests/stock.spec.ts` (`[BUG-12]`) — cases STK-03
- **Traceability:** AC-03 (docs/TRACEABILITY.md) · fix: commit `fix(BUG-12)` on branch `fixes`
- **Root cause in the code (optional):** `mergeItem` in `cart.tsx` adds quantities without capping at `product.stock`.

## BUG-13 — Late-night orders show the next day's date

- **Source:** found by me (seed data review: order #2 at 02:30 UTC)
- **Type:** Logic
- **Severity:** Medium
- **Priority:** P2 — every order placed between 21:00 and 23:59 Argentina time shows tomorrow's date with tonight's time; confusing for customers and support.
- **Steps to reproduce:** as Ana, open **My orders** and order #2 (created `2026-10-15T02:30:00Z`).
- **Expected result:** "10/14/2026 · 23:30" (SPEC: dates and times in Argentina time).
- **Actual result:** "10/15/2026 · 23:30" — the time is converted, the date is not.
- **Evidence:** [evidence/BUG-13](evidence/BUG-13/README.md) — numbered step screenshots, video with pointer (MP4/GIF), expected vs actual, HTTP log
- **Resource:** [http://localhost:4321/orders/2](http://localhost:4321/orders/2)
- **Automated test:** `tests/orders.spec.ts` (`[BUG-13]` API + UI) — cases ORD-03, ORD-04
- **Traceability:** AC-13 (docs/TRACEABILITY.md) · fix: commit `fix(BUG-13)` on branch `fixes`
- **Root cause in the code (optional):** `formatOrderDate` in `app/server/api.ts` takes the date from `iso.slice(0, 10)` (UTC) and only the time through `Intl` with the Argentina time zone.

## BUG-14 — Malformed JSON gets an HTML error page instead of a JSON error

- **Source:** found by me
- **Type:** Integration
- **Severity:** Low
- **Priority:** P3 — breaks the contract ("All requests and responses are JSON"); clients get an HTML stack-style page they can't parse. No data impact.
- **Steps to reproduce:** `POST /api/login` with header `Content-Type: application/json` and body `{bad json`.
- **Expected result:** `400` with a JSON body `{ "error": … }`.
- **Actual result:** `400` with `text/html` ("<!DOCTYPE html>… Error").
- **Evidence:** [evidence/BUG-14](evidence/BUG-14/README.md) — HTTP log with requests, status codes and responses
- **Resource:** [http://localhost:4321/api/login](http://localhost:4321/api/login)
- **Automated test:** `tests/checkout-validation.spec.ts` (`[BUG-14]`) — cases CHK-10
- **Traceability:** AC-14 (docs/TRACEABILITY.md) · fix: commit `fix(BUG-14)` on branch `fixes`
- **Root cause in the code (optional):** no Express error handler after `express.json()`.

## BUG-15 — A `coupons` value that is not a list is silently ignored

- **Source:** found by me
- **Type:** Integration
- **Severity:** Low
- **Priority:** P3 — a client that sends `"coupons": "FLOCK10"` gets `201` and the customer pays full price without any warning.
- **Steps to reproduce:** `POST /api/checkout` with `"coupons": "FLOCK10"` (string instead of array).
- **Expected result:** `400` invalid data.
- **Actual result:** `201`, discount 0.
- **Evidence:** [evidence/BUG-15](evidence/BUG-15/README.md) — HTTP log with requests, status codes and responses
- **Resource:** [http://localhost:4321/api/checkout](http://localhost:4321/api/checkout)
- **Automated test:** `tests/checkout-validation.spec.ts` (`[BUG-15]`) — cases CHK-11
- **Traceability:** AC-07, AC-14 (docs/TRACEABILITY.md) · fix: commit `fix(BUG-15)` on branch `fixes`
- **Root cause in the code (optional):** `Array.isArray(coupons) ? … : []` in `app/server/api.ts`.

---

## Improvement suggestions (not bugs)

1. **Idempotent checkout.** Two identical checkouts sent at the same time create two orders and two charges. Add an idempotency key per payment attempt; it also closes the retry path of BUG-01.
2. **Login rate limiting.** 20 wrong passwords in a row are all answered `401` and the right one still works: no lockout or delay.
3. **Field limits.** A 5,000-character name is accepted and stored. Define max lengths for name/address.
4. **Clear messages.** Show "the payment is taking longer than usual" instead of a failure while a payment is still pending; tell the user when the cart quantity is capped at the stock (typing 99 silently becomes 8).
5. **Declined payments are invisible.** A declined attempt leaves no trace in My payments; support cannot see it (see ANALYSIS.md, question 6).
6. **Shared device.** Logging out does not clear the cart, so the next person on the same browser sees it (see ANALYSIS.md, question 5).
7. **Error boundary in the web app.** One bad record (BUG-04) blanks whole pages; a React error boundary and defensive formatting would limit the damage.
8. **Session cookie.** `sid` has `HttpOnly` and `SameSite=Lax` but not `Secure`; add it outside localhost.
9. **The team's existing test** `the cart total is calculated correctly` only checked that the total was visible; it now asserts the value ($16.70).
