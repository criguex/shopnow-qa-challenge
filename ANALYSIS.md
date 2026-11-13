# Spec analysis

How I read `SPEC.md`: for each sentence I asked "what would I assert here, and what value would I expect?". Where I couldn't answer from the spec, it became a question. Questions are sorted by risk (money and data first). Each one notes what I assumed in the meantime and which bug or test depends on it.

## Questions for the PO (prioritized)

1. **What happens when the payment is slow?** The spec says "the payment is processed and the order is created" but not how long the user waits or what they see. Can a payment be "pending"? Today the browser gives up after 3 s while the processor takes up to 4 s, and the user is charged without a confirmation (BUG-01).
2. **Is stock reserved when an item is added to the cart, or checked only at payment?** And what does the user see if the stock ran out between cart and payment? (Today it is never checked: BUG-07, BUG-12.)
3. **What exactly are the coupon rules?** One per purchase (spec), but: can the same coupon be used in several purchases? Do coupons expire? Is there a minimum amount? Is the discount on the subtotal before or after shipping (there is no shipping cost in the spec — is shipping free)?
4. **How is money rounded?** "Two decimals" doesn't say how. Example: 10% of $14.35 is $1.435 — is the discount $1.43 or $1.44? I assume half-up on cents and exact cents for line totals (3 × $8.35 = $25.05, BUG-10).
5. **Is the cart tied to the browser or to the user?** "The cart persists even if the user closes the browser": if Ana logs out and Bruno logs in on the same browser, should he see Ana's cart? Should Ana see her cart on another device?
6. **Should declined payments appear in "My payments"?** Today only approved ones are stored.
7. **Which characters are valid in names and addresses?** The spec doesn't restrict them; the app rejects accents, ñ, ° and apostrophes (BUG-09). Are there length limits?
8. **Card validation:** only "16 digits"? Should we validate the Luhn checksum, expiry date and CVV? Should the UI accept spaces or dashes (`4242 4242 4242 4242`)? Today spaces are accepted, dashes are not.
9. **Who receives the confirmation email, with what content, and what if it fails?** Can't be verified in this environment (no mail server).
10. **What does a user see when opening an order that isn't theirs?** I assume 404 (don't reveal it exists) — BUG-02.
11. **Search and filters:** is search only by name or also by description? Should it ignore accents? Is the category filter case-sensitive? Should out-of-stock products be listed?
12. **Product page quantity:** the selector stops at 10 even when the stock is 25. Is 10 a business limit per purchase? The spec only says "can't buy more than the available stock".
13. **Date format:** the app shows `MM/DD/YYYY` (US style) for an Argentina audience, where `DD/MM/YYYY` is expected. Which one is correct?
14. **Order of "My orders" and "My payments":** newest first? Pagination?

## Ambiguities found

- "Users can't buy more than the available stock" — enforced where? (selector, cart, server). Only the server is trustworthy; the client can be bypassed through the API.
- "The user can change quantities (minimum 1)" — what happens when they type 0 or delete the number: remove the line, block it, or reset to 1? (Today it resets to 1.)
- "Only one per purchase" — per cart, per order or per user? A coupon that can be reused forever is a different risk.
- "Codes are case-insensitive" — what about spaces (`" FLOCK10 "`)? Today they are trimmed; I consider that correct.
- "The discount is a percentage of the subtotal" — is the discount shown and stored rounded? Which value is charged?
- "If the user isn't logged in, they must log in before paying" — after login, do they return to checkout? (They do.) Does the cart merge with a cart saved for that user?
- "Totals are shown in dollars with two decimals" — which currency is charged in Argentina? Thousand separators?
- "Dates and times are shown in Argentina time" — for every screen? "My payments" shows no date at all.
- "Afterwards the user receives a confirmation email" — after what: order created or payment approved? Not verifiable here.
- Nothing is said about what happens to the cart when a payment fails or is declined.

## Assumptions I make to move forward

- The documented API (`docs/API.md`) is part of the contract: invalid data → `400`, out of stock → `409`, all responses JSON.
- Business rules must hold on the server, not just in the browser, because the API is public (BUG-04, BUG-05, BUG-07).
- Money is calculated in integer cents; line totals are exact; discounts are rounded half-up to the cent.
- A customer can only see their own orders and payments; another customer's order returns `404` (or `403`).
- Names and addresses accept any letters used in Spanish (accents, ñ), apostrophes and `°`. If the PO says ASCII-only, BUG-09 becomes "the error message is misleading".
- The `MM/DD/YYYY` format the app uses today is accepted (question 13 is open); my tests assert the Argentina **date**, not the format.
- The confirmation email, a real payment processor and multiple devices are out of reach in this local environment; I list them as questions, not bugs.
- "Approved" is the only payment status the app shows; I don't treat the missing "declined" history as a bug (question 6).
