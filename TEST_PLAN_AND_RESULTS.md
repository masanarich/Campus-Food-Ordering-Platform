# Test Plan and Results

## Purpose

This document describes the testing strategy for the Campus Food Ordering Platform, the main areas covered by automated and manual tests, and the latest recorded test results.

## Scope

The test plan covers:

- Authentication and role access.
- Customer ordering and checkout.
- Paystack payment initialization and verification.
- Vendor order management, menu management, analytics, wallet, and payout flows.
- Admin dashboard, user management, finance, disputes, and support workflows.
- Shared domain models, validation, formatters, query builders, and services.
- Firebase Cloud Functions for payments and support refunds.
- Firestore security rule shape and key access-control contracts.
- Semantic HTML checks for important static pages.

## Test Environment

Latest local test run:

| Item | Value |
| --- | --- |
| Date | 2026-05-22 |
| Operating system | Windows |
| Shell | PowerShell |
| Node.js | v20.18.0 |
| npm | 11.12.1 |
| Firebase CLI | 15.13.0 |
| Test runner | Jest |
| DOM test environment | jsdom |

## Test Strategy

### Automated Unit Tests

Unit tests verify pure functions and browser-page helpers without needing live Firebase services. These tests cover:

- Data normalization.
- Form validation.
- Role and account status checks.
- Currency and minor-unit calculations.
- Payment and refund model behavior.
- Ticket, reply, category, status, and refund-case modeling.
- Query builder output and fallback behavior.
- Page rendering helpers and error messaging.

### Automated Integration-Style Tests

Integration-style Jest tests use mocked Firebase helpers and DOM fixtures to verify that pages interact correctly with services and Firestore wrappers. These tests cover:

- Customer checkout, payment callback, cart, order tracking, and support pages.
- Vendor order detail, order list, wallet, support list, and support detail pages.
- Admin finance, disputes, support ticket detail, analytics, and user management pages.
- Cloud Function handlers with mocked Paystack and Firebase Admin dependencies.

### Security Rule Shape Tests

The repository includes tests that inspect `firestore.rules` for important security contracts. These do not replace Firebase emulator rule tests, but they protect against accidental rule regressions such as:

- Removing participant-scoped ticket visibility.
- Removing admin-only internal notes.
- Weakening payout create/update key whitelists.
- Weakening order participant read rules.
- Removing support refund case ownership checks.
- Breaking notification read/write ownership rules.

### Manual End-to-End Checks

Manual checks are still required for browser-only and external-service flows:

- Firebase Authentication login/register/reset flows.
- Paystack hosted test checkout redirect.
- Firebase Hosting routing.
- Firestore production rule behavior against real signed-in users.
- Cross-role support ticket visibility.
- Browser cache and local static-server behavior.

## Test Data Strategy

Automated tests use in-memory fixtures and mocked Firebase functions. Test data is grouped by feature and role:

- Customer fixtures for carts, checkouts, orders, support tickets, and payment callbacks.
- Vendor fixtures for shops, menu items, order state, wallet balances, payout records, and support tickets.
- Admin fixtures for finance summaries, disputes, users, refunds, and support moderation.
- Shared fixtures for payment records, refund cases, recommendations, ratings, and Firestore rule documents.

No automated test requires real Paystack credentials or production Firebase data.

## Automated Test Areas

| Area | Directory | Examples of Coverage |
| --- | --- | --- |
| Authentication | `tests/authentication-tests/` | Registration, login, reset, profile, vendor applications, role choice, auth helpers. |
| Customer portal | `tests/customer-tests/` | Dashboard, vendor browsing, menu browsing, cart, checkout, payment callback, order tracking, support inbox/new/detail. |
| Vendor portal | `tests/vendor-tests/` | Dashboard, shop, menu products, analytics, wallet, order management, support inbox/new/detail. |
| Admin portal | `tests/admin-tests/` | Admin dashboard, analytics, users, finance, disputes, ticket detail. |
| Shared checkout | `tests/shared-tests/checkout-tests/` | Checkout model, validation, status, service, and query helpers. |
| Shared finance | `tests/shared-tests/finance-tests/` | Platform pricing, payout model, payout service, payout queries. |
| Shared orders | `tests/shared-tests/orders-tests/` | Order model, status, service, queries, notifications, validation, realtime helpers. |
| Shared payments | `tests/shared-tests/payments-tests/` | Payment model, service, validation, formatters, statuses, refund statuses. |
| Shared support | `tests/shared-tests/support-tests/` | Ticket model, queries, service, validation, refund case model, rule shape. |
| Cloud Functions | `tests/functions-tests/` | Initialize payment, verify payment, refund payment, Paystack client, support refund resolution. |
| Semantic HTML | `tests/shared-tests/semantic-html.test.js` | Structural checks for key HTML pages. |

## Representative Test Cases

| ID | Feature | Test Case | Expected Result | Status |
| --- | --- | --- | --- | --- |
| AUTH-01 | Authentication | Register user with valid profile data. | User model is normalized and validation accepts required fields. | Passed |
| AUTH-02 | Authentication | Attempt role access with inactive or blocked account. | Access helper denies portal access. | Passed |
| CUST-01 | Browse vendors | Render vendor cards from query results. | Only valid vendor data is rendered with expected text and links. | Passed |
| CUST-02 | Cart | Add, remove, and summarize cart items. | Cart totals and item counts are calculated correctly. | Passed |
| CUST-03 | Checkout | Create checkout for one vendor. | Checkout payload includes customer, vendor, items, payment amount, and finance split. | Passed |
| PAY-01 | Payment init | Initialize Paystack payment. | Function returns authorization URL and stores expected payment metadata. | Passed |
| PAY-02 | Payment verify | Verify successful Paystack reference. | Checkout/order payment status becomes paid with provider reference. | Passed |
| PAY-03 | Payment failure | Verify failed or mismatched payment response. | Error/failure status is surfaced and invalid payment is rejected. | Passed |
| VEND-01 | Vendor orders | Vendor reads and updates assigned orders. | Only vendor-owned order data is processed. | Passed |
| VEND-02 | Vendor wallet | Calculate wallet from completed paid orders and reserved payouts. | Available balance, total earned, reserved withdrawals, and payout list are correct. | Passed |
| VEND-03 | Vendor wallet | Read payouts through simple vendor-owned queries. | Wallet avoids fragile composite payout query path and keeps vendor ownership. | Passed |
| VEND-04 | Vendor payout | Submit payout with fake bank details. | Valid payout record is built with amount, masked account, status, timeline, and notification metadata. | Passed |
| ADMIN-01 | Finance | Calculate platform finance summary. | Vendor earnings, platform earnings, refunds, and payout summaries are rendered correctly. | Passed |
| ADMIN-02 | Disputes | Render support/dispute list and filters. | Admin sees dispute records with correct statuses and metadata. | Passed |
| SUP-01 | Customer support | Create new support ticket. | Ticket payload validates category, visibility, order context, and reporter fields. | Passed |
| SUP-02 | Ticket detail | Customer/vendor/admin reply to visible tickets. | Reply visibility respects participant and internal-note rules. | Passed |
| SUP-03 | Refund case | Admin prepares support refund case. | Refund amount, customer/vendor decisions, and impact fields validate correctly. | Passed |
| FUNC-01 | Refund function | Resolve approved support refund. | Function writes refund/payment/order/ticket updates with expected values. | Passed |
| RULE-01 | Firestore rules | Payout create/update rule shape. | Rules require vendor ownership, valid amount fields, pending create status, and admin/owner update paths. | Passed |
| RULE-02 | Firestore rules | Ticket reply visibility. | Internal notes remain admin-only; participants can read public replies. | Passed |
| HTML-01 | Semantic HTML | Key pages have expected landmarks and controls. | Required structure is present. | Passed |

## Manual Test Checklist

Use this checklist before submission or demo:

| ID | Flow | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| MAN-01 | Public landing | Open `public/index.html` through a local server. | Landing page loads without console errors. | To verify |
| MAN-02 | Authentication | Register or sign in with a test user. | User reaches the correct portal after role selection. | To verify |
| MAN-03 | Customer checkout | Add one vendor's items to cart and start checkout. | Checkout summary and Paystack redirect are correct. | To verify |
| MAN-04 | Paystack success | Pay with Paystack test card and return to callback page. | Callback verifies payment and order becomes paid. | To verify |
| MAN-05 | Vendor orders | Sign in as vendor and open order management. | Vendor sees only assigned orders and can update valid statuses. | To verify |
| MAN-06 | Vendor wallet | Open wallet and submit simulated withdrawal. | Wallet loads, payout is created, and balance/payout list update. | To verify |
| MAN-07 | Customer support | Create a payment/order support ticket. | Ticket appears in customer inbox and admin disputes. | To verify |
| MAN-08 | Vendor support | Open vendor support inbox and ticket detail. | Vendor sees only tickets/replies visible to vendor. | To verify |
| MAN-09 | Admin refund | Admin opens payment dispute and resolves refund if needed. | Refund function updates ticket, order, payment/refund state, and finance impact. | To verify |
| MAN-10 | Rules deploy | Deploy Firestore rules and retest role-specific pages. | No valid role sees missing-permission errors for owned data. | To verify |

## Latest Automated Test Results

Command:

```bash
npm test -- --runInBand
```

Result:

```text
Test Suites: 88 passed, 88 total
Tests:       2525 passed, 2525 total
Snapshots:   0 total
Time:        38.042 s
```

Overall automated result: Passed.

## Coverage Command

Coverage can be generated with:

```bash
npm run test:coverage
```

The generated `coverage/` directory is intentionally ignored by Git because it is build output.

## Risks and Follow-Up Testing

- Run Firebase Emulator Suite tests for Firestore rules if emulator-based rule assertions are added later.
- Repeat the manual Paystack redirect flow after every Functions deployment.
- Retest vendor wallet permissions with real vendor accounts after Firestore rule changes.
- Retest cross-role support ticket visibility when adding new support categories or message visibility modes.
- Retest refund finance impact after changing order, payment, payout, or support refund models.
