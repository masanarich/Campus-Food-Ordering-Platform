# Campus-Food-Ordering-Platform
Web-based campus food ordering platform for students and vendors to browse menus, place orders, and track order status in real time. Built using Firebase and modern web technologies by Team 404 Team Not Found for the Wits Software Design course.

## Local Configuration

The real Firebase config is intentionally not committed. To run the app locally, copy `public/authentication/config.example.js` to `public/authentication/config.js` and fill in your Firebase web app values.

Optional environment variables can be documented in `.env.example` and placed in a local `.env` file when needed.

## Paystack Test-Mode Payments

Online payment at checkout is wired through [Paystack](https://paystack.com/) in **test mode**. No real money is charged — this is a student project. The flow is:

1. Customer reviews the cart for a single vendor on `checkout.html`.
2. The browser calls the `initializePayment` Cloud Function, which talks to Paystack server-to-server using the secret key, and gets back a hosted authorization URL.
3. The customer is redirected to Paystack's test checkout, pays with a test card, and is sent to `payment-callback.html?reference=...`.
4. The callback page calls `verifyPayment`, which re-checks the transaction with Paystack and writes the `paid`/`failed` patch to the order.
5. Customer and vendor pages display the payment status, amount, and reference. Vendors can only accept orders once payment is confirmed.

### Backend environment variables

These live on the Cloud Functions runtime (set them with `firebase functions:secrets:set` or your provider's env panel). The browser never sees the secret key.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PAYSTACK_SECRET_KEY` | yes | Paystack test secret (`sk_test_...`) used by the backend to call Paystack. |
| `PAYSTACK_CALLBACK_URL` | yes | Absolute URL Paystack redirects to after payment. Should point to your deployed `payment-callback.html`. |
| `PAYSTACK_ENV` | no | Defaults to `test`. Used to label logs and guard against accidental live use. |

Local copy of `.env.example` is provided for reference; it is not loaded automatically by the browser.

### Tutor / grader demo steps

1. From the customer portal, add items from one vendor to the cart and open **Checkout**.
2. Click **Place Order and Pay**. The order is created with `paymentStatus: "pending"` and the browser is redirected to the Paystack test checkout.
3. Pay with one of Paystack's documented test cards, for example:
   - Card number: `4084 0840 8408 4081`
   - CVV: `408`
   - Expiry: any future date (e.g. `12/30`)
   - PIN: `0000`
   - OTP: `123456`
4. Paystack redirects to `payment-callback.html`, which shows **Verifying payment** and then either **Payment Confirmed** or **Payment Not Completed**.
5. Open the order in **My Orders → Order Detail** to see the payment status, amount, provider, and reference. From the vendor portal, open the same order — the **Accept Order** button is disabled (with a banner) until payment is confirmed.

For a failure path, use any test card from Paystack's documented "declined" list, or close the Paystack page; the callback will show **Payment Failed** with a **Retry Payment** action that links back to checkout with the vendor pre-selected.

## Tests and Coverage

Run the test suite with coverage using:

```bash
npm run test:coverage
```

GitHub Actions runs the same coverage command on pushes and pull requests, then uploads the generated `coverage/` folder as a workflow artifact. The local `coverage/` folder is ignored because it is generated output.
