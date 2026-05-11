# Payment System Integration Guide

## Overview

The payment system has been fully integrated into the Campus Food Ordering Platform. It includes:

- **PayFast integration** for payment processing
- **Firestore collections** for payment data, ledger, and payouts
- **Cloud Functions** for webhook handling, refunds, and payouts
- **Double-entry ledger system** for accounting
- **Vendor payout system** for managing payments to vendors
- **Xero integration** for accounting records

---

## Directory Structure

```
campus-food-ordering-platform/
├── functions/                          # Cloud Functions
│   ├── index.js                       # Main Cloud Functions (PayFast, ITN, payouts)
│   ├── xero-integration.js            # Xero API integration
│   ├── package.json                   # Functions dependencies
│   └── .env                           # Environment variables (not in git)
│
├── public/shared/payment/             # Payment client modules
│   ├── payment-integration.js         # PayFast checkout URL generation
│   ├── payment-service.js             # Firestore payment operations
│   ├── ledger-system.js               # Double-entry accounting
│   └── payout-system.js               # Vendor payout management
│
├── public/customer/order-management/
│   └── checkout.html                  # Modified to use payment system
│   └── checkout.js                    # Uses payment-integration.js
│
└── PAYMENT_SYSTEM.md                  # This file

```

---

## Setup Instructions

### 1. Install Dependencies

**Root project:**
```bash
npm install
```

**Cloud Functions:**
```bash
cd functions
npm install
cd ..
```

### 2. Environment Variables

Create `.env` file in the `functions/` directory:

```env
# PayFast Configuration
PAYFAST_MERCHANT_ID=your_merchant_id
PAYFAST_MERCHANT_KEY=your_merchant_key
PAYFAST_SECRET_KEY=your_secret_key
PAYFAST_MODE=sandbox  # or 'live'

# Platform Configuration
PLATFORM_FEE_PERCENTAGE=0.1  # 10% platform fee

# Xero Configuration (Optional)
XERO_CLIENT_ID=your_xero_client_id
XERO_TENANT_ID=your_xero_tenant_id
XERO_REFRESH_TOKEN=your_xero_refresh_token
```

### 3. Deploy Cloud Functions

```bash
firebase deploy --only functions
```

### 4. Configure PayFast Webhook

1. Log in to your PayFast account
2. Go to Settings → Integration
3. Set **Instant Transaction Notification (ITN)** URL to:
   ```
   https://your-firebase-project.web.app/.netlify/functions/handlePayfastITN
   ```
4. Enable ITN notifications
5. Test the integration

### 5. Update Existing Order Flow

Modify your checkout flow to trigger payment:

```javascript
// In checkout.js
const { paymentUrl, paymentId, idempotencyKey } = await paymentIntegration.generatePayFastCheckoutUrl(orderId, config);

// Redirect user to PayFast
window.location.href = paymentUrl;

// PayFast redirects back to return_url with payment result
```

---

## How the Payment Flow Works

### Customer Checkout

1. **Customer places order** → Order stored in Firestore with `paymentStatus: "awaiting_payment"`
2. **Generate PayFast URL** → Cloud Function `createPayfastCheckout` creates payment record and signature
3. **Redirect to PayFast** → Customer enters payment details on PayFast
4. **PayFast processes payment** → Charge appears on customer's card
5. **PayFast sends ITN** → ITN webhook confirms payment status

### Payment Confirmation (ITN Webhook)

1. **PayFast sends ITN** → POST request to `handlePayfastITN` Cloud Function
2. **Validate signature** → Verify PayFast signature using merchant key
3. **Check for duplicates** → Prevent duplicate processing using idempotencyKey
4. **Update Firestore**:
   - Mark `payments` collection as "successful"
   - Update `orders` collection to "paid"
   - Create ledger entries for accounting
5. **Update vendor balances** → Add earned amount to `vendorBalances`
6. **Sync to Xero** → Async: Create invoice and record payment in Xero

### Order Completion

- Order moves from "paid" → "preparing" → "ready_for_pickup" → "completed"
- All ledger entries already posted at payment confirmation
- Vendor can track balance and request payout

### Vendor Payout

1. **Admin triggers payout batch** → `runPayoutBatch` Cloud Function
2. **Creates payout records** → One payout per vendor with pending balance
3. **Vendor balance reset** → After payout confirmed, balance = 0
4. **Ledger entry created** → Records transfer from vendor payables to bank
5. **Xero updated** → Records bill and payment in Xero

---

## Data Models

### Orders Collection (Enhanced)

```javascript
{
  orderId: "ord_123",
  customerId: "user_456",
  customerName: "John Doe",
  customerEmail: "john@example.com",
  vendorUids: ["vendor_1", "vendor_2"],
  items: [...],
  subtotal: 150.00,
  platformFeeAmount: 15.00,
  total: 165.00,
  
  // Payment tracking
  status: "paid",              // pending, awaiting_payment, paid, completed, cancelled
  paymentId: "pay_789",        // Reference to payments collection
  paymentStatus: "successful", // none, pending, successful, failed, cancelled
  
  // Vendor breakdown
  vendorGroupings: [
    {
      vendorUid: "vendor_1",
      vendorName: "Pizza Place",
      items: [...],
      subtotal: 100.00,
      vendorShare: 85.00,  // After platform fee
      status: "pending_payout"
    }
  ],
  
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Payments Collection

```javascript
{
  paymentId: "pay_789",
  orderId: "ord_123",
  customerId: "user_456",
  amount: 165.00,
  amountNet: 160.60,        // After PayFast fees
  currency: "ZAR",
  paymentMethod: "payfast",
  paymentStatus: "successful",
  
  payFastPaymentId: "1234567890",
  idempotencyKey: "uuid-123",  // Prevents duplicate charges
  signature: "md5_hash",
  
  createdAt: Timestamp,
  confirmedAt: Timestamp,    // When ITN confirmed
  completedAt: Timestamp,
  
  webhookEventIds: ["webhook_123"],
  metadata: {
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0...",
    itemCount: 5
  }
}
```

### Ledger Entries

```javascript
{
  entryId: "entry_123",
  
  // Double-entry bookkeeping
  debitAccount: "1000",   // Asset: Clearing Account
  creditAccount: "4100",  // Revenue: Platform Fees
  
  debitAmount: 15.00,
  creditAmount: 15.00,
  
  currency: "ZAR",
  entryType: "platform_fee",
  
  referenceId: "pay_789",
  relatedPaymentId: "pay_789",
  relatedOrderId: "ord_123",
  relatedVendorId: "vendor_1",
  
  status: "posted",
  description: "Platform fee for order ord_123",
  
  createdAt: Timestamp,
  postedAt: Timestamp,
  
  idempotencyKey: "key_123",
  
  xeroSyncStatus: {
    synced: false,
    syncedAt: null,
    xeroLineItemId: null,
    syncError: null
  }
}
```

### Vendor Balances

```javascript
{
  vendorId: "vendor_1",
  vendorName: "Pizza Place",
  currency: "ZAR",
  
  balance: 850.00,            // Pending payout
  totalPaid: 5000.00,         // Lifetime payouts
  totalEarned: 5850.00,       // Lifetime earnings
  
  lastUpdated: Timestamp,
  lastPayoutAt: Timestamp,
  nextPayoutDate: Timestamp,
  
  bankDetails: {
    accountHolder: "Pizza Place (Pty) Ltd",
    accountNumber: "123456789",
    bankCode: "632005",
    branchCode: "632005"
  }
}
```

### Payouts

```javascript
{
  payoutId: "payout_123",
  batchId: "batch_456",
  
  vendorId: "vendor_1",
  vendorName: "Pizza Place",
  
  amount: 850.00,
  currency: "ZAR",
  
  status: "completed",  // pending, processing, completed, failed
  payoutMethod: "eft",  // eft, bank_transfer, manual
  payoutReference: "EFT123456",
  
  createdAt: Timestamp,
  processedAt: Timestamp,
  completedAt: Timestamp,
  
  bankDetails: {...},
  xeroPaymentId: "xero_123",
  
  relatedPaymentIds: ["pay_789", "pay_790"]
}
```

---

## API Endpoints

### Cloud Functions

#### 1. Create PayFast Checkout
```
POST /.netlify/functions/createPayfastCheckout
Body: { orderId: "ord_123" }
Response: {
  paymentUrl: "https://sandbox.payfast.co.za/eng/process?...",
  paymentId: "pay_789",
  idempotencyKey: "uuid-123"
}
```

#### 2. Handle PayFast ITN (Webhook)
```
POST /.netlify/functions/handlePayfastITN
Body: FormData from PayFast
- pf_payment_id
- payment_status (COMPLETE, FAILED, PENDING)
- amount_gross
- amount_net
- custom_str1 (orderId)
- custom_str2 (paymentId)
- signature
- ...
```

#### 3. Get Vendor Balance
```
GET /.netlify/functions/getVendorBalance?vendorId=vendor_1
Response: {
  vendorId: "vendor_1",
  balance: 850.00,
  totalEarned: 5850.00,
  totalPaid: 5000.00,
  ...
}
```

#### 4. Create Refund
```
POST /.netlify/functions/createRefund
Body: {
  orderId: "ord_123",
  reason: "customer_request",
  amount: 165.00
}
Response: { refundId: "ref_123" }
```

#### 5. Run Payout Batch
```
POST /.netlify/functions/runPayoutBatch
Response: {
  batchId: "batch_456",
  payouts: 12,
  totalAmount: 8500.00
}
```

---

## Client-Side Usage

### In Checkout Page

```html
<!-- checkout.html -->
<script src="/shared/payment/payment-integration.js"></script>
<script src="/shared/payment/payment-service.js"></script>

<button id="payButton">Pay with PayFast</button>

<script>
  document.getElementById("payButton").addEventListener("click", async function() {
    try {
      const orderId = getCurrentOrderId(); // Your logic
      
      // Generate PayFast URL
      const { paymentUrl } = await paymentIntegration.generatePayFastCheckoutUrl(orderId);
      
      // Redirect to PayFast
      window.location.href = paymentUrl;
    } catch (error) {
      console.error("Payment error:", error);
      alert("Payment failed. Please try again.");
    }
  });
</script>
```

### After Payment (Return URL)

```javascript
// checkout.js - After PayFast redirects back
const urlParams = new URLSearchParams(window.location.search);
const payment = urlParams.get("payment"); // success or cancelled

if (payment === "success") {
  // Poll or wait for ITN webhook to confirm payment
  // Or redirect to order tracking page
  window.location.href = `/order/${orderId}`;
} else if (payment === "cancelled") {
  alert("Payment cancelled. Please try again.");
}
```

---

## Testing the System

### 1. Sandbox Testing

Use PayFast sandbox environment:
```
Merchant ID: 10000100
Test cards available on PayFast docs
```

### 2. Manual Testing

```bash
# Test PayFast checkout URL generation
curl -X POST http://localhost:5000/createPayfastCheckout \
  -H "Content-Type: application/json" \
  -d '{"orderId": "test_order_123"}'

# Simulate ITN webhook (manual)
curl -X POST http://localhost:5000/handlePayfastITN \
  -d "pf_payment_id=123&payment_status=COMPLETE&amount_gross=100&custom_str1=test_order_123&signature=..."
```

### 3. Unit Tests

Tests are in `tests/` directory:
```bash
npm test
```

---

## Important Considerations

### 1. Idempotency
Every payment has an `idempotencyKey` to prevent duplicate charges if:
- User refreshes page during payment
- Network fails during confirmation
- ITN webhook is retried by PayFast

### 2. Ledger Safety
- All financial transactions use double-entry accounting
- Each entry has an `idempotencyKey` to prevent duplicates
- Refunds create reversing entries for audit trail

### 3. Amount Verification
- Server validates order amount matches payment amount
- Prevents manipulation of order total

### 4. PayFast Signature Validation
- All ITN webhooks must have valid MD5 signature
- Signature is calculated using merchant key
- Prevents fake/spoofed payments

### 5. Firestore as Source of Truth
- All payment state lives in Firestore
- Xero is synced asynchronously
- If Xero sync fails, payment is still confirmed in Firestore

---

## Monitoring and Alerts

### Key Metrics to Track

1. **Payment Success Rate**
   - Monitor `payments` collection for success/failed ratio
   - Alert if success rate drops below 95%

2. **ITN Processing**
   - Monitor `webhookEvents` for processing errors
   - Alert if ITN takes > 2 minutes to process

3. **Vendor Balance Accuracy**
   - Compare `vendorBalances.balance` with sum of `ledgerEntries`
   - Reconcile weekly

4. **Payout Status**
   - Track `payouts` collection for failed payouts
   - Alert admin for manual intervention

### Database Queries

```javascript
// Get failed payments in last 24 hours
db.collection("payments")
  .where("paymentStatus", "==", "failed")
  .where("createdAt", ">=", new Date(Date.now() - 86400000))
  .get()

// Get pending payouts
db.collection("payouts")
  .where("status", "==", "pending")
  .orderBy("createdAt", "asc")
  .get()

// Get unsynced ledger entries
db.collection("ledgerEntries")
  .where("xeroSyncStatus.synced", "==", false)
  .get()
```

---

## Troubleshooting

### Issue: Payment marked successful but balance not updated

**Solution**: Check webhook events for processing errors. Manually run the payment processing function.

### Issue: Vendor balance doesn't match ledger

**Solution**: Run reconciliation query to find mismatches. Check for duplicated entries using idempotencyKey.

### Issue: Xero sync failing

**Solution**: Verify Xero credentials and token. Check `xeroMappings` collection for error messages.

### Issue: PayFast signature invalid

**Solution**: Verify merchant key is correct. Check that all required fields are included in signature.

---

## Next Steps

1. ✅ Deploy Cloud Functions
2. ✅ Configure PayFast webhook URL
3. ✅ Test payment flow in sandbox
4. ✅ Set up monitoring and alerts
5. ✅ Deploy to production
6. ✅ Train admin team on payout process

---

## Support

For issues, check:
- Cloud Functions logs in Firebase Console
- Webhook events in `webhookEvents` collection
- Firestore indexes in `.indexes.json`

Contact PayFast support for payment-specific issues.

