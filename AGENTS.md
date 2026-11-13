# Working agreement for AI assistants (QA)

This is the context every AI assistant on this repo works from (Claude Code loads it through `CLAUDE.md`). It describes how I test, and the assistant follows it. When this file and the challenge `README.md` disagree, the README wins.

## Roles
- I own the test strategy, the risk calls and every verdict: bug, not a bug, or question for the PO.
- The assistant reads the code, proposes scenarios, writes test code and drafts reports. I review every diff before it is committed.
- Nothing is reported as a bug until it has been reproduced against the running app (UI or API), with evidence.

## Loop
1. **Understand.** Read `README.md`, `SPEC.md`, `USER_REPORTS.md`, `docs/API.md`, the seed data and the existing tests.
2. **Analyze the spec.** Questions for the PO, ambiguities and assumptions go to `ANALYSIS.md`.
3. **Risk map.** Money, payments, stock, auth and data integrity first; cosmetic issues last.
4. **Hunt.** Reproduce the 3 user reports, then look for unreported bugs through the UI and the API. Code reading is allowed to find suspects, but a bug only counts once it is reproduced.
5. **Report.** Each bug goes to `BUGS.md` (`BUG-01`, `BUG-02`...), sorted by priority, with steps, expected vs actual and the requirement it breaks.
6. **Automate.** One Playwright test per bug in `tests/`. Run it, confirm it fails for the right reason (the bug, not the test).
7. **Log AI usage** in `ai/README.md`: what was delegated, what was verified, what was discarded.

## Validation rules
- Assert business outcomes: totals, prices, discounts, stock, order and payment records, persisted state, status codes and error messages. "Element is visible" on its own is not a validation.
- The expected value comes from `SPEC.md` / `docs/API.md`, not from what the app returns today. If the product is wrong, the test stays red. Never weaken an assertion to make a test pass.
- UI for user journeys, API for business rules and edge cases.

## Test rules (from the challenge README)
- Bug ID in the test name: `test("[BUG-03] <what should happen>", ...)`.
- `resetData` in `beforeEach`. Locators by `data-testid`.
- Only the UI or the documented API. Never read or modify `app/` from tests. No mocks.
- Plain tests that fail today: no `test.fail`, `test.fixme`, `test.skip` or `test.only`.
- Do not touch the URL/port in `playwright.config.ts`. No new dependencies.
- No fixed waits; web-first assertions only.

## Do not
- Invent requirements. If the spec is ambiguous, write the assumption down ("I assume X; if the PO confirms Y, this is a bug").
- Mark anything as done without running it.
- Edit `README.md` or add scope the brief did not ask for.
