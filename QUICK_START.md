# Payment System - Quick Start Checklist

### FILES STRUCTURE
```
✅ public/shared/payment/
   ├── payment-integration.js
   ├── payment-service.js
   ├── ledger-system.js
   └── payout-system.js

✅ functions/
   ├── index.js
   ├── xero-integration.js
   ├── package.json
   └── .env (YOU CREATE THIS)

✅ Root
   ├── PAYMENT_SYSTEM.md (Schema & Design)
   ├── PAYMENT_INTEGRATION.md (Integration Guide)
   ├── PAYMENT_HOW_IT_WORKS.md (This System Explained)
   ├── firestore.rules (Updated with payment rules)
   └── firestore.indexes.json (Updated with payment indexes)
```

---

## 📋 Your Action Items (Priority Order)

### Phase 1: Get Credentials (1 hour)

- [ ] **Get PayFast Merchant Credentials**
  - Go to: https://www.payfast.co.za/onboard
  - Sign up for a business account
  - Go to Settings → Integration
  - Copy: Merchant ID, Merchant Key, Secret Key
  - For testing, use Sandbox mode first

- [ ] **Get Firebase Configuration**
  - Already configured in your project ✓
  - Cloud Functions: Read deployment status

- [ ] **Create Environment File**
  ```bash
  cd functions
  touch .env
  # Add the content below
  ```
  
  File: `functions/.env`
  ```env
  PAYFAST_MERCHANT_ID=10000100
  PAYFAST_MERCHANT_KEY=YOUR_KEY_HERE
  PAYFAST_SECRET_KEY=YOUR_SECRET_HERE
  PAYFAST_MODE=sandbox
  PLATFORM_FEE_PERCENTAGE=0.1
  ```

### Phase 2: Deploy (1 hour)

- [ ] **Install Cloud Functions Dependencies**
  ```bash
  cd functions
  npm install
  cd ..
  ```

- [ ] **Deploy Cloud Functions**
  ```bash
  firebase deploy --only functions
  ```
  Expected output: 5 functions deployed successfully

- [ ] **Deploy Firestore Security Rules**
  ```bash
  firebase deploy --only firestore:rules
  ```

- [ ] **Deploy Firestore Indexes**
  ```bash
  firebase deploy --only firestore:indexes
  ```
  Note: Indexes may take 5-10 minutes to build

- [ ] **Configure PayFast Webhook**
  1. Log in to PayFast
  2. Go to Settings → Integration
  3. Find "Instant Transaction Notification (ITN)"
  4. Set ITN URL to:
     ```
     https://YOUR_FIREBASE_PROJECT.web.app/.netlify/functions/handlePayfastITN
     ```
     (Replace YOUR_FIREBASE_PROJECT with actual project name)
  5. Check: "Enable ITN notifications"
  6. Check: "Run ITN in background"
  7. Save

### Phase 3: Update Checkout (2 hours)

- [ ] **Link Payment Modules in Checkout HTML**
  
  File: `public/customer/order-management/checkout.html`
  
  Add before closing `</body>`:
  ```html
  <script src="/shared/payment/payment-integration.js"></script>
  <script src="/shared/payment/payment-service.js"></script>
  <script src="checkout.js"></script>
  ```

- [ ] **Update Checkout Button**
  
  File: `public/customer/order-management/checkout.js`
  
  Find the checkout/payment button handler and add:
  ```javascript
  document.getElementById("payButton").addEventListener("click", async function() {
    try {
      const orderId = getCurrentOrderId(); // Your existing logic
      
      // Generate PayFast URL
      const { paymentUrl } = await paymentIntegration.generatePayFastCheckoutUrl(orderId);
      
      // Redirect to PayFast
      window.location.href = paymentUrl;
    } catch (error) {
      console.error("Payment error:", error);
      alert("Payment failed. Please try again.");
    }
  });
  ```

- [ ] **Handle Return from PayFast**
  
  Add to `checkout.js`:
  ```javascript
  // After PayFast redirects back
  document.addEventListener("DOMContentLoaded", function() {
    const urlParams = new URLSearchParams(window.location.search);
    const payment = urlParams.get("payment");
    
    if (payment === "success") {
      // Wait for ITN to confirm payment (usually < 5 seconds)
      setTimeout(() => {
        location.reload(); // Reload to check payment status
      }, 3000);
    } else if (payment === "cancelled") {
      alert("Payment cancelled. Please try again.");
      // Redirect back to cart or checkout
    }
  });
  ```

- [ ] **Test in Sandbox**
  ```
  Test Card Number: 4111111111111111
  Expiry: Any future date
  CVC: 123
  
  Test transaction should complete in < 10 seconds
  ```

### Phase 4: Vendor Payout Setup (1-2 hours)

- [ ] **Create Vendor Bank Details Collection**
  
  Add to `vendorBalances` collection in Firestore console:
  ```javascript
  {
    vendorId: "vendor_uid",
    vendorName: "Pizza Place",
    currency: "ZAR",
    balance: 0,
    totalPaid: 0,
    totalEarned: 0,
    lastUpdated: now,
    lastPayoutAt: null,
    nextPayoutDate: null,
    bankDetails: {
      accountHolder: "Pizza Place (Pty) Ltd",
      accountNumber: "1234567890",
      bankCode: "632005",
      branchCode: "632005"
    }
  }
  ```

- [ ] **Create Admin Payout Dashboard Page**
  
  New file: `public/admin/payouts.html`
  
  Show:
  - List of vendors with pending balance
  - Total payout amount
  - Create batch button

- [ ] **Create Payout Processing Page**
  
  New file: `public/admin/process-payout.js`
  
  Functionality:
  - Call `runPayoutBatch()` Cloud Function
  - Display payout details
  - Mark as "completed" with EFT reference

---

## 🧪 Testing Checklist

### Before Going Live

- [ ] **Test Payment Flow (Sandbox)**
  - Create test order
  - Redirect to PayFast
  - Complete test payment
  - Verify order marked as "paid" in Firestore
  - Check vendor balance updated

- [ ] **Test Webhook**
  - Verify ITN webhook in Cloud Functions logs
  - Check `webhookEvents` collection has entry
  - Verify payment status shows as "successful"

- [ ] **Test Ledger**
  - Check `ledgerEntries` collection
  - Verify double-entry: debit = credit
  - Verify idempotencyKey prevents duplicates

- [ ] **Test Payout**
  - Create payout batch
  - Verify payouts created for each vendor
  - Mark payout as completed
  - Verify vendor balance reset to 0

- [ ] **Test Error Cases**
  - Cancel payment on PayFast
  - Verify order stays "awaiting_payment"
  - Retry payment
  - Verify no duplicate entries

---

## 📞 Immediate Needs from You

Please provide or confirm:

1. **PayFast Credentials** (for Phase 1)
   - Merchant ID
   - Merchant Key
   - Secret Key

2. **Firebase Project Details**
   - Project ID
   - Current Firebase region (for Cloud Functions)

3. **Platform Fee Configuration**
   - What percentage? (Default: 10%)
   - Minimum fee? (Optional)

4. **Payout Schedule**
   - Weekly? Biweekly? Monthly?
   - What day of week/month?

5. **Xero Integration** (Optional)
   - Do you want Xero sync?
   - If yes, provide: Client ID, Tenant ID, Refresh Token

---

## 🎯 Expected Timeline

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Get PayFast credentials | 15 min | Need your action |
| 1 | Configure environment | 10 min | Need your action |
| 2 | Deploy Cloud Functions | 10 min | You can do now |
| 2 | Deploy rules & indexes | 5 min | You can do now |
| 2 | Configure PayFast webhook | 10 min | Need your action |
| 3 | Update checkout UI | 45 min | Need your action |
| 3 | Test in sandbox | 30 min | You can do now |
| 4 | Setup payout dashboard | 60 min | Optional, nice-to-have |
| 4 | Full end-to-end testing | 30 min | You can do now |
| — | **Total Time** | ~3 hours | — |

---

## 🚀 Go Live Checklist

Before switching from sandbox to production:

- [ ] All tests passing
- [ ] PayFast security settings reviewed
- [ ] Webhook URL confirmed correct
- [ ] Firestore backup configured
- [ ] Monitoring/alerts set up
- [ ] Support team trained on payout process
- [ ] Documentation shared with team
- [ ] Test payment with real card (low amount) in production mode
- [ ] Verify in production Firestore
- [ ] Switch PAYFAST_MODE from "sandbox" to "live"
- [ ] Redeploy Cloud Functions
- [ ] Monitor closely for first 24 hours

---

## 📚 Documentation for Your Team

Share these with your team:

1. **Customers** → Share: `PAYMENT_HOW_IT_WORKS.md` (How the flow works)
2. **Vendors** → Share: Payout dashboard guide (new feature)
3. **Admins** → Share: `PAYMENT_INTEGRATION.md` (Full integration details)
4. **Developers** → Share: All docs + code files

---

## ⚠️ Critical Points

1. **NEVER commit `.env` to git**
   - Add to `.gitignore`: `functions/.env`

2. **Keep Merchant Key Secret**
   - Only in `.env` file
   - Not in code, logs, or documentation

3. **Validate Amounts Server-Side**
   - Always verify order total matches payment
   - Don't trust client-side calculations

4. **Test Thoroughly Before Production**
   - Use PayFast sandbox first
   - At least 5 test transactions
   - Test cancellations and errors

5. **Monitor Webhook Logs**
   - Check Cloud Functions logs daily for first week
   - Set up alerts for webhook failures

---

## 🆘 Troubleshooting Links

| Issue | Solution |
|-------|----------|
| Cloud Functions won't deploy | Check `functions/package.json` dependencies |
| Webhook not firing | Verify ITN URL in PayFast settings |
| Payment not confirming | Check Cloud Functions logs & `webhookEvents` |
| Vendor balance wrong | Run ledger reconciliation query |
| Xero not syncing | Check credentials & token expiry |

---

## 💡 Next Call with Me

When you're ready for next steps, let me know:

1. When you get PayFast credentials
2. After you deploy Cloud Functions
3. When you start testing
4. If any errors occur

---

## 📞 What I Need from You

Before proceeding further:

- [ ] **PayFast Credentials** - To configure environment variables
- [ ] **Confirmation** - That you want to use Xero integration or not
- [ ] **Payout Details** - Fee percentage, minimum amount, payout schedule
- [ ] **Timeline** - When do you want to go live?

Once you provide these, you're ready to start Phase 1! 🚀

