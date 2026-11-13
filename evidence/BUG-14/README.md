# BUG-14 — Malformed JSON gets an HTML error page instead of a JSON error

- **Environment:** ShopNow local (`npm run dev`) · app version: commit `40bc732` · Chromium (Playwright 1.48.2) · timezone America/Argentina/Buenos_Aires · fresh data (`POST /api/test/reset`) · users ana@shopnow.test / bruno@shopnow.test · recorded 2026-11-13 15:46 UTC on http://localhost:4322 (port 4321 was in use on the recording machine; same app and data)
- **Resource:** [http://localhost:4321/api/login](http://localhost:4321/api/login)
- **Acceptance criteria:** AC-14 (see docs/TRACEABILITY.md) · **Report:** [BUGS.md](../../BUGS.md) › BUG-14
- **Automated test:** `tests/checkout-validation.spec.ts (CHK-10)`

## Expected vs actual

- **Expected:** 400 with a JSON body { error }
- **Actual:** 400 with an HTML page: <!DOCTYPE html>
<html lang="en">
<head>
…

## HTTP log

| # | Request | Status | Request body | Response (first 300 chars) |
|---|---|---|---|---|
| 1 | `POST /api/login` | **400** | `{bad json` | `<!DOCTYPE html> <html lang="en"> <head> <meta charset="utf-8"> <title>Error</title> </head> <body> <pre>SyntaxError: Unexpected token &#39;&quot;&#39;, &quot;&quot;{bad json&quot;&quot; is not valid JSON<br> &nbsp; &nbsp;at JSON.parse (&lt;anonymous&gt;)<br> &nbsp; &nbsp;at createStrictSyntaxError (` |
