# AI usage

I worked with one AI agent in the terminal, driven by a written working agreement. The AI did the reading, scripting and drafting at speed; I set the direction, the risk calls and the verdicts, and nothing went into `BUGS.md` until it was reproduced against the running app.

## Tools and models

- **Claude Code** (CLI agent) with **Claude Opus 5.5** — code reading, API/UI probes, Playwright tests, drafts of the documents, GIF evidence.
- **Context files in the repo:** `AGENTS.md` (method, validation rules, the challenge's test rules) loaded through `CLAUDE.md`. They were the first thing committed, so every step of the agent followed the same rules.
- **Claude in Chrome** — only to open the challenge invitation from my email and read the statement.
- **Playwright 1.48.2** (already in the repo), **Node fetch** for API probes, **ffmpeg** to turn test videos into GIFs.

## What I delegated to AI

| Step | What the AI did | My part |
|---|---|---|
| Setup | Cloned the repo, installed, adapted my generic QA working agreement (`AGENTS.md`) to this challenge's rules | Decided that the challenge README overrides my kit |
| Understanding | Read `README`, `SPEC`, `USER_REPORTS`, `docs/API.md`, the seed data and the app code to list suspects | Chose to test money, auth and availability first |
| Hunting | Wrote ~70 API probes (boundaries, mutants, concurrency, sessions) and UI scripts, and ran them against the app | Asked for strict mutants, boundary values, performance and maximum coverage; reviewed every result |
| Automation | Wrote the support layer (`ShopApi`, page objects, oracle, mutant data) and the specs | Asked for SOLID/clean structure, reviewed selectors, data and above all the assertions |
| Reporting | Drafted `BUGS.md`, `ANALYSIS.md`, `TESTING.md` with diagrams, the CI workflow, the latency probe and the GIFs | Severity/priority calls, what is a bug vs. a question vs. a suggestion |

## What I verified and how

- **Every bug was reproduced live** before being reported: API probes with exact request/response, UI flows with Playwright, server logs for the crash (`TypeError … api.ts:145`, then the process exits).
- **Every test was run and triaged.** All 36 failing tests were checked to fail *for the bug* (e.g. expected `$25.05` received `$25.04`; expected `10` received `0`; expected `409` received `201`), not because of a selector or timing. The 3 control tests pass.
- **Expected values come from the spec, not from the app.** The oracle (`tests/support/oracle.ts`) recomputes money in integer cents and dates in Argentina time on its own; it never imports from `app/`.
- **Numbers in the reports were re-checked** before writing them: e.g. "negative quantity raises stock 40 → 42 and records an approved payment of -$28.70" was re-run against a fresh reset.
- **The GIFs** are the real tests recorded; I checked their last frames (the error message on BUG-01, Bruno's address on BUG-02).

## What I discarded or corrected from the output, and why

- **My own kit said "mark known bugs with `test.fail()`".** The challenge forbids it (tests must be plain and fail today), so that rule was removed from `AGENTS.md` before the first commit.
- **Inflated bug count.** The AI listed "declined card shows a generic message on orders > $100" as a separate bug. Same root cause as report 1, so it went inside BUG-01.
- **Not everything odd is a bug.** Double submit creating two orders, no login rate limit, 5,000-character names, a `$1.435` discount rounding to `$1.43`: the spec doesn't define these, so they became PO questions or suggestions, not bugs.
- **BUG-09 is written as an assumption** ("if the PO confirms ASCII-only, this is only a misleading message"), because the spec doesn't restrict characters.
- **A false first reading:** the first UI probe for report 3 used a full navigation that also reloads the page, so it looked like *nothing* reached the cart. Re-done with a proper reload to confirm the real pattern (catalog "Add" lost, product page "Add to cart" kept).
- **Node 26 broke two things:** the Chromium extraction hung during `npm install` (unzipped the cached archive by hand), and TypeScript parameter properties failed in Playwright's loader (rewritten with explicit fields so the suite runs on Node 22 and 26).
- **The perf probe** first used the $89.90 keyboard as the "> $100" case; corrected to 3 backpacks ($119.70).
- **The CI workflow** first used `npx wait-on`, an extra dependency; replaced with a `curl` loop.
- **An inverted assertion message** in BUG-02 (it read "expected 200, received [403, 404]") was rewritten so a failure explains itself.
- **The crash tests run last** (`zz-…`): if they ran earlier they would kill the server and make unrelated tests fail for the wrong reason.

## Evidence

- `AGENTS.md` / `CLAUDE.md` — the context the agent worked from (first commit).
- `ai/probes/` — the exploratory API probe scripts the AI wrote and I ran; their output is what the bug reports are built on.
- Excerpt of a probe run (fresh data):

```text
coupon flock10                                   200 {"code":"flock10","percent":0}
IDOR ana -> order 3 (bruno)                      200 {"id":3,"userId":2,…"shipping":{"name":"Bruno Diaz",…}}
order 2 date (02:30Z = 23:30 ART 14-oct)         200 {"displayDate":"10/15/2026","displayTime":"23:30"}
checkout 3 mugs (8.35x3=25.05)                   201 {"subtotal":25.04,"total":25.04}
checkout coupons x11 (110%)                      201 {"subtotal":14.35,"discount":15.84,"total":-1.49}
checkout qty -2                                  201 {"subtotal":-28.7,"total":-28.7}
checkout chair qty 5 > stock 2                   201 … then GET /products/8 → {"stock":-3}
checkout name with accent                        400 {"error":"Please fill in the shipping details."}
checkout name as number                          ERR fetch failed   ← server process exited
--- concurrency: race for last units (chair stock 2, 3 buyers x1)
  buyer #1 201 · buyer #2 201 · buyer #3 201 → chair stock: -1
```

- Git history: small commits, one per step, each reviewed before it went in.
