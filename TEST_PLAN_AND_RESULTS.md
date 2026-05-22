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


example of the output: 

------------------------------------|---------|----------|---------|---------|-----------------------------------
File                                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s                 
------------------------------------|---------|----------|---------|---------|-----------------------------------
All files                           |   86.72 |    74.35 |   89.71 |   87.58 |                                   
 public                             |     100 |       80 |     100 |     100 |                                   
  index.js                          |     100 |       80 |     100 |     100 | 26-30                             
 public/admin                       |   68.21 |    60.65 |   72.25 |   70.54 |                                   
  analytics.js                      |   31.72 |     35.3 |   36.36 |   31.56 | ...3,422-1180,1191-1284,1326-1330 
  disputes.js                       |    77.1 |    65.76 |   84.12 |   80.38 | ...44-649,658-671,677-683,780,796 
  finance.js                        |    69.5 |    53.54 |   85.52 |   69.65 | ...-1034,1059,1075,1081,1110-1118 
  index.js                          |   91.24 |    76.49 |   94.54 |      93 | ...40-447,461-481,683-691,701,789 
  ticket-detail.js                  |   80.49 |    65.25 |   89.58 |   84.42 | ...02,532-538,613-614,623-628,642 
  users.js                          |   89.77 |    67.75 |    97.1 |   89.77 | ...925,933,971-973,1013,1029-1031 
 public/authentication              |   94.92 |     81.3 |   96.41 |   94.91 |                                   
  auth-core.js                      |   96.73 |    77.82 |     100 |   96.71 | ...71,281,299,319-329,503,510-514 
  auth-utils.js                     |   99.09 |    84.37 |     100 |   99.08 | 130,454                           
  login.js                          |   97.94 |    86.52 |      88 |   97.94 | 377,395,404                       
  pending-vendor.js                 |   99.04 |     89.1 |   93.33 |   99.04 | 274                               
  profile.js                        |   88.82 |    75.16 |   96.84 |   88.81 | ...,1768,1775,1838,1978,2024-2027 
  register.js                       |   97.77 |    90.98 |   90.32 |   97.77 | 173,498,553,593,602               
  reset.js                          |   98.96 |    84.04 |   94.44 |   98.96 | 257                               
  role-choice.js                    |   96.18 |     84.1 |   97.05 |   96.18 | ...01,210,236,313,364,411,423,757 
  vendor-application.js             |   99.08 |    85.98 |   94.44 |   99.08 | 296                               
 public/customer                    |   92.68 |    74.24 |   96.99 |   92.68 |                                   
  admin-application.js              |   96.42 |    73.39 |    97.5 |   96.42 | 74,169,177,185,447-449,555,578    
  index.js                          |   87.78 |    75.18 |      94 |   87.78 | ...9,911,1043,1073,1176,1266-1272 
  vendor-application.js             |   97.31 |    73.19 |     100 |   97.31 | 99,209,217,225,580-582,685        
 public/customer/customer-analytics |   36.75 |    40.88 |   35.53 |   37.62 |                                   
  customer-analytics.js             |   36.75 |    40.88 |   35.53 |   37.62 | 369,411-906,916-1029,1065-1069    
 public/customer/order-management   |   87.01 |    71.13 |   93.42 |   87.37 |                                   
  browse-menu.js                    |   80.02 |    65.26 |   88.76 |   81.35 | ...,1775-1780,1799-1801,1809-1811 
  browse-vendors.js                 |   92.94 |    82.04 |   90.59 |   92.98 | ...,1547,1577,1595-1596,1682-1688 
  cart.js                           |   94.38 |    74.76 |   96.55 |   94.58 | ...02,209-213,427-436,842,853,885 
  checkout.js                       |   83.79 |    69.76 |   96.15 |   83.79 | ...,1984-1993,2013-2046,2054-2084 
  index.js                          |     100 |    68.42 |     100 |     100 | 7,9-33                            
  payment-callback.js               |   87.38 |    67.15 |   97.18 |   87.38 | ...-1941,1963-1981,2001,2005,2016 
 public/customer/order-tracking     |    82.4 |    68.58 |   79.27 |   82.72 |                                   
  index.js                          |   75.96 |    59.85 |   73.26 |   76.63 | ...,1699,1741,1744,1767-1784,1832 
  notifications.js                  |      80 |     66.2 |   76.11 |   79.91 | ...54,884,923,926,929,946-964,985 
  order-detail.js                   |   94.62 |    80.76 |   94.44 |   94.62 | ...,1096,1152,1167,1197,1231-1245 
 public/customer/support            |    91.2 |    76.01 |   91.21 |    91.2 |                                   
  index.js                          |   92.87 |    76.03 |   94.64 |   92.87 | ...55,663,684,739-743,778,783,795 
  new.js                            |   93.17 |    82.53 |      90 |   93.17 | ...17,122,214,220,236,269,416,520 
  ticket-detail.js                  |   88.29 |    72.38 |   88.46 |   88.29 | ...55,793-798,812-837,883,910-915 
 public/shared/checkout             |   93.65 |       81 |     100 |   93.65 |                                   
  checkout-model.js                 |   93.71 |    84.57 |     100 |   93.71 | 150,189-202,230,232,234           
  checkout-queries.js               |   91.35 |    81.43 |     100 |   91.35 | 27-42,65-80                       
  checkout-service.js               |   89.32 |    75.97 |     100 |   89.32 | ...330-334,347-351,1442-1470,1628 
  checkout-status.js                |     100 |    97.36 |     100 |     100 | 544                               
  checkout-validation.js            |   98.04 |       85 |     100 |   98.04 | 42-46,83-87,226,515,527           
 public/shared/finance              |   94.39 |    80.78 |   96.38 |   94.39 |                                   
  payout-model.js                   |   95.32 |    81.51 |     100 |   95.18 | 87-91,239-242,382,407             
  payout-queries.js                 |   93.72 |    80.53 |   93.75 |    93.8 | 29-45,326,344,405,548-551         
  payout-service.js                 |   93.82 |    81.44 |     100 |   93.82 | 18-45,236,556                     
  platform-pricing.js               |   94.97 |    79.13 |      96 |   94.97 | 67-71,255-257,341,349,376,380     
 public/shared/institutions         |     100 |    83.33 |     100 |     100 |                                   
  south-african-institutions.js     |     100 |    83.33 |     100 |     100 | 554-561                           
 public/shared/orders               |   96.26 |    80.65 |   99.31 |   96.26 |                                   
  order-formatters.js               |   96.38 |    80.03 |     100 |   96.38 | ...73,107-110,144-147,540,559,706 
  order-model.js                    |    95.5 |    85.71 |     100 |    95.5 | 38-42,75,139,169,222,226,250,252  
  order-notifications.js            |   98.87 |    80.44 |     100 |   98.87 | 90,124,161                        
  order-queries.js                  |    94.7 |       80 |      95 |    94.7 | 33-37,67-71,168-174,373           
  order-realtime.js                 |   97.15 |    78.94 |     100 |   97.15 | 46,80,114,302,310                 
  order-service.js                  |   97.05 |    81.58 |     100 |   97.04 | ...73,110-113,147-150,184-187,221 
  order-status.js                   |   97.87 |    88.63 |     100 |   97.87 | 355,362                           
  order-validation.js               |   92.63 |    76.03 |     100 |   92.63 | ...50,458,469,540,546,552,558,691 
 public/shared/payments             |    93.6 |     78.8 |     100 |    93.6 |                                   
  payment-formatters.js             |    91.5 |    82.58 |     100 |    91.5 | 28-44,56,78-82,112,299,356        
  payment-model.js                  |   91.02 |    78.19 |     100 |   91.02 | 26-42                             
  payment-service.js                |   96.47 |    76.83 |     100 |   96.47 | 40-44,84-88,125-129               
  payment-status.js                 |     100 |    89.28 |     100 |     100 | 385-392                           
  payment-validation.js             |      89 |    77.11 |     100 |      89 | ...,71-87,114,129,145,240,258,411 
  refund-status.js                  |     100 |    89.28 |     100 |     100 | 377-384                           
 public/shared/ratings              |   95.05 |     81.5 |     100 |   95.03 |                                   
  ratings-model.js                  |   97.53 |    85.79 |     100 |   97.53 | 123,130,237,267                   
  ratings-service.js                |   91.08 |    71.95 |     100 |      91 | 11-21,70,190                      
 public/shared/recommendations      |   90.22 |    66.66 |     100 |   90.22 |                                   
  campus-recommendation-queries.js  |   88.52 |    67.98 |     100 |   88.52 | ...25,132,142,157,189,283,487,527 
  recommendation-model.js           |   94.61 |    76.21 |     100 |   94.61 | ...28-129,133,137,141,161,293,316 
  recommendation-queries.js         |   87.23 |    58.18 |     100 |   87.23 | ...,81-85,149,164,339,348,414,525 
 public/shared/shop-schedule        |      96 |    86.06 |     100 |   95.94 |                                   
  shop-schedule.js                  |      96 |    86.06 |     100 |   95.94 | 38,51,165,241,270,278             
 public/shared/support              |   94.67 |    80.82 |   96.28 |   94.76 |                                   
  refund-case-model.js              |   96.98 |    81.56 |     100 |   96.98 | 216,230,272,299,357,397,744       
  refund-case-validation.js         |   85.22 |    66.34 |   69.44 |   85.87 | ...-69,84,133-215,401,421,479,586 
  ticket-categories.js              |     100 |    81.25 |     100 |     100 | 267-274                           
  ticket-formatters.js              |   98.34 |    90.98 |     100 |   98.34 | 51,88,122,245,551                 
  ticket-model.js                   |   93.26 |    81.69 |     100 |   93.26 | ...77,298,316,349-351,364-366,503 
  ticket-queries.js                 |   98.31 |    87.89 |     100 |   98.31 | 35,69,103                         
  ticket-service.js                 |    93.6 |    77.73 |   98.27 |    93.6 | ...,1693,1711,1729,1747,1765,1783 
  ticket-status.js                  |     100 |     90.9 |     100 |     100 | 319,445-452                       
  ticket-validation.js              |   95.96 |    86.18 |     100 |   95.96 | ...84,117-121,151-155,185-189,526 
 public/vendor                      |   87.63 |    71.06 |   91.34 |   87.88 |                                   
  analytics.js                      |   96.55 |    86.42 |   95.37 |   98.53 | ...,1472-1473,1486,1491,1584-1588 
  index.js                          |   96.54 |     85.3 |   94.73 |   96.54 | ...,237,241,590,891,942,1057,1110 
  products.js                       |   88.73 |    68.42 |   91.05 |   88.73 | ...,1726-1727,1754-1755,1886-1888 
  shop.js                           |   84.36 |    66.57 |    87.8 |   84.49 | ...-1803,1810-1811,1840,1881-1882 
  wallet.js                         |   72.19 |    57.97 |   86.66 |   72.19 | ...,1463-1466,1478,1485-1486,1499 
 public/vendor/order-management     |   92.36 |    81.16 |      92 |   92.35 |                                   
  index.js                          |   91.65 |    80.82 |   94.28 |   91.65 | ...,1164,1167,1188,1191,1212,1215 
  notifications.js                  |   87.97 |    78.16 |   85.91 |   87.92 | ...,1024,1027,1030,1050,1053,1056 
  order-detail.js                   |   97.58 |    83.37 |   96.61 |   97.58 | ...,329,340-344,822,935,1094,1278 
 public/vendor/support              |   76.19 |    64.81 |   81.69 |    79.6 |                                   
  index.js                          |   75.55 |    66.87 |   80.32 |   77.99 | ...37-642,651-664,670-676,772,788 
  new.js                            |   84.08 |    67.12 |    87.5 |   88.46 | ...91,323-324,341-349,400-404,411 
  ticket-detail.js                  |   71.97 |    61.61 |   78.84 |   76.21 | ...91,599-617,665,683-684,719,734 
------------------------------------|---------|----------|---------|---------|-----------------------------------

Test Suites: 88 passed, 88 total
Tests:       2525 passed, 2525 total
Snapshots:   0 total
Time:        23.858 s
Ran all test suites.
PS C:\Users\user\Music\3rd year\S1 SD\Campus-Food-Ordering-Platform> 