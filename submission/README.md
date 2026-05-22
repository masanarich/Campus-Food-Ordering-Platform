# Campus Food Ordering Platform

Campus Food Ordering Platform is a Firebase-backed web application for campus food ordering. It supports customers, vendors, and administrators through separate browser portals for menu browsing, checkout, order tracking, vendor order management, support tickets, disputes, refunds, analytics, and simulated vendor payouts.

The repository is public at `masanarich/Campus-Food-Ordering-Platform` and is intended for assessment and review. It was built by Team 404 Team Not Found for the Wits Software Design course.

## Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Running the App Locally](#running-the-app-locally)
- [Firebase and Paystack Configuration](#firebase-and-paystack-configuration)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Features

### Customer Portal

- Register, sign in, reset password, and manage profile information.
- Browse vendors and vendor menus.
- Add menu items to cart and checkout through Paystack test-mode payments.
- Track orders, payment state, collection status, and notifications.
- Create and manage support tickets for payment, safety, order, refund, and general issues.
- Participate in support refund decisions when a refund case involves the customer.

### Vendor Portal

- Manage vendor dashboard, shop details, menu items, and order status.
- View vendor analytics.
- Track wallet earnings from completed paid orders.
- Submit simulated withdrawal/payout requests with fake bank details.
- View support inbox and ticket detail pages.
- Participate in support refund decisions when a refund case involves the vendor.

### Admin Portal

- Review users, vendor applications, disputes, support tickets, and finance activity.
- View platform earnings, vendor earnings, refund impact, and payout history.
- Manage support ticket status, replies, internal notes, refund cases, and resolution state.
- Process support-driven refunds through Firebase Cloud Functions and Paystack test-mode refund logic.

## Technology Stack

- Frontend: HTML, CSS, and vanilla JavaScript modules.
- Backend: Firebase Authentication, Firestore, Storage, Hosting, and Cloud Functions.
- Payments: Paystack test-mode initialization, verification, and refund flows.
- Tests: Jest with jsdom and Testing Library DOM matchers.
- CI: GitHub Actions runs Jest coverage on pushes and pull requests.

## Repository Structure

```text
.
|-- public/
|   |-- admin/                 Admin dashboard, finance, disputes, and ticket pages
|   |-- authentication/        Auth pages, auth helpers, and Firebase browser config
|   |-- customer/              Customer dashboard, ordering, tracking, and support
|   |-- legal/                 Static terms, privacy, and cookie pages
|   |-- shared/                Shared models, services, formatters, validation, and queries
|   `-- vendor/                Vendor dashboard, orders, menu, wallet, analytics, and support
|-- functions/
|   |-- payments/              Paystack initialize, verify, and refund functions
|   |-- support/               Support refund resolution function
|   |-- shared/                Synced shared modules used by Cloud Functions
|   `-- scripts/               Shared-code sync script
|-- tests/
|   |-- admin-tests/
|   |-- authentication-tests/
|   |-- customer-tests/
|   |-- functions-tests/
|   |-- shared-tests/
|   `-- vendor-tests/
|-- firestore.rules
|-- firestore.indexes.json
|-- storage.rules
|-- firebase.json
|-- TEST_PLAN_AND_RESULTS.md
`-- package.json
```

## Prerequisites

- Node.js 20 or newer for local tests. The checked local version used for the latest test run was `v20.18.0`.
- npm 11 or newer. The checked local version used for the latest test run was `11.12.1`.
- Firebase CLI. The checked local version used for the latest deploy/test workflow was `15.13.0`.
- A Firebase project with Authentication, Firestore, Storage, Hosting, and Functions enabled.
- A Paystack test account if you want to exercise payment and refund flows end to end.
- A local static server, such as VS Code Live Server or `http-server`.

## Local Setup

1. Clone the repository.

   ```bash
   git clone https://github.com/masanarich/Campus-Food-Ordering-Platform.git
   cd Campus-Food-Ordering-Platform
   ```

2. Install root dependencies.

   ```bash
   npm install
   ```

3. Install Cloud Functions dependencies.

   ```bash
   cd functions
   npm install
   cd ..
   ```

4. Create the local Firebase browser config.

   ```bash
   cp public/authentication/config.example.js public/authentication/config.js
   ```

   On Windows PowerShell:

   ```powershell
   Copy-Item public/authentication/config.example.js public/authentication/config.js
   ```

5. Edit `public/authentication/config.js` and replace the placeholder values with your Firebase web app configuration.

6. Optional: copy `.env.example` to `.env` for local reference. Do not commit real secrets.

   ```bash
   cp .env.example .env
   ```

## Running the App Locally

The app is static frontend code that imports Firebase browser SDK modules. Serve the `public` folder over HTTP; do not open the HTML files directly from the filesystem.

### Option 1: VS Code Live Server

1. Open the repository in VS Code.
2. Start Live Server from the `public` folder.
3. Open `http://127.0.0.1:5500/index.html`.

Common routes:

- Landing page: `http://127.0.0.1:5500/index.html`
- Login: `http://127.0.0.1:5500/authentication/login.html`
- Customer dashboard: `http://127.0.0.1:5500/customer/index.html`
- Vendor dashboard: `http://127.0.0.1:5500/vendor/index.html`
- Vendor wallet: `http://127.0.0.1:5500/vendor/wallet.html`
- Admin dashboard: `http://127.0.0.1:5500/admin/index.html`

### Option 2: http-server

```bash
npx http-server public -p 5500
```

Then open `http://127.0.0.1:5500/index.html`.

## Firebase and Paystack Configuration

### Firebase Browser Config

`public/authentication/config.js` is intentionally not committed. It should be created from `public/authentication/config.example.js`.

The config exports:

- `app`
- `auth`
- `db`
- `storage`
- `functions`
- `analytics`
- `googleProvider`
- `appleProvider`

Cloud Functions are configured for the `africa-south1` region in the browser config.

### Firestore, Storage, and Indexes

The Firebase project uses:

- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`
- `firebase.json`

Deploy rules and indexes with:

```bash
firebase deploy --only firestore
firebase deploy --only storage
```

Deploy rules only with:

```bash
firebase deploy --only firestore:rules
```

### Paystack Test-Mode Payments

Online checkout is wired through Paystack in test mode. No real money is charged. The flow is:

1. The customer opens checkout for a single vendor.
2. The browser calls the `initializePayment` Cloud Function.
3. The function creates a Paystack test transaction and returns an authorization URL.
4. Paystack redirects back to `payment-callback.html?reference=...`.
5. The callback page calls `verifyPayment`.
6. Verified payments update the order and checkout state.

Backend environment variables live in the Cloud Functions runtime:

| Variable | Required | Purpose |
| --- | --- | --- |
| `PAYSTACK_SECRET_KEY` | Yes | Paystack test secret key used by Cloud Functions. |
| `PAYSTACK_CALLBACK_URL` | Yes | Absolute callback URL for Paystack redirects. |
| `PAYSTACK_ENV` | No | Defaults to `test`; used to label and guard payment behavior. |

Example Firebase secret setup:

```bash
firebase functions:secrets:set PAYSTACK_SECRET_KEY
```

### Paystack Test Card

For a successful Paystack test payment, use:

```text
Card number: 4084 0840 8408 4081
CVV: 408
Expiry: Any future date, for example 12/30
PIN: 0000
OTP: 123456
```

## Testing

Run the full test suite:

```bash
npm test -- --runInBand
```

Run coverage:

```bash
npm run test:coverage
```

Run a focused test file:

```bash
npm test -- --runTestsByPath tests/vendor-tests/wallet.test.js
```

The root `pretest` script automatically runs:

```bash
npm run sync:functions-shared
```

This copies shared payment and support modules into `functions/shared/` so browser logic and Cloud Functions use matching models and validation logic.

See [TEST_PLAN_AND_RESULTS.md](./TEST_PLAN_AND_RESULTS.md) for the testing strategy, test areas, representative test cases, and the latest local test result.

Latest documented local result:

```text
Test Suites: 88 passed, 88 total
Tests: 2525 passed, 2525 total
Snapshots: 0 total
```

## Deployment

Deploy Hosting, Firestore, Storage, and Functions:

```bash
firebase deploy
```

Deploy only Hosting:

```bash
firebase deploy --only hosting
```

Deploy only Functions:

```bash
firebase deploy --only functions
```

Deploy only Firestore rules:

```bash
firebase deploy --only firestore:rules
```

The `functions` predeploy hook in `firebase.json` runs `functions/scripts/sync-shared.js` before function deployment.

## Troubleshooting

### Browser shows stale JavaScript behavior

Use a hard refresh:

```text
Ctrl+F5
```

If the issue remains, stop and restart the local static server.

### Firebase says "Missing or insufficient permissions"

Check:

- The user is signed in.
- The user document in `users/{uid}` has the expected role fields.
- The app is querying records owned by `auth.currentUser.uid`.
- The latest `firestore.rules` file has been deployed.

Deploy rules again:

```bash
firebase deploy --only firestore:rules
```

### Payment functions fail locally or in production

Check:

- `PAYSTACK_SECRET_KEY` is configured for the Functions runtime.
- `PAYSTACK_CALLBACK_URL` points to the correct deployed callback page.
- The Firebase project has Cloud Functions enabled in `africa-south1`.
- The browser config points to the same Firebase project as the deployed functions.

### Tests fail after editing shared support or payment modules

Run:

```bash
npm run sync:functions-shared
npm test -- --runInBand
```

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
