# Payment System - API Reference

Quick reference for all payment-related APIs.

---

## Client-Side APIs (Browser)

### Payment Integration

```javascript
// paymentIntegration.generatePayFastCheckoutUrl(orderId)
// Generates a PayFast redirect URL for customer payment

Usage:
const { paymentUrl, paymentId, idempotencyKey } = 
  await paymentIntegration.generatePayFastCheckoutUrl(orderId);

Response: {
  paymentUrl: "https://sandbox.payfast.co.za/eng/process?merchant_id=...",
  paymentId: "pay_789",
  idempotencyKey: "uuid-123"
}

Errors:
- "Order ID is required"
- "Order not found"
- "Order already has status: X"
```

### Payment Service

```javascript
// paymentService.createPayment(paymentData)
// Creates a payment record

Usage:
const { paymentId, idempotencyKey } = await paymentService.createPayment({
  orderId: "ord_123",
  customerId: "user_456",
  amount: 165.00,
  currency: "ZAR"
});

// paymentService.getPayment(paymentId)
// Gets payment record

const payment = await paymentService.getPayment("pay_789");
// Returns: { paymentId, orderId, amount, paymentStatus, ... }

// paymentService.updatePaymentStatus(paymentId, updateData)
// Updates payment status (admin/webhook only)

await paymentService.updatePaymentStatus("pay_789", {
  paymentStatus: "successful",
  payFastPaymentId: "1234567890",
  amountNet: 160.60
});

// paymentService.getVendorBalance(vendorId)
// Gets vendor balance

const balance = await paymentService.getVendorBalance("vendor_1");
// Returns: { vendorId, balance, totalEarned, totalPaid, ... }

// paymentService.recordLedgerEntry(entryData)
// Creates a ledger entry

const entryId = await paymentService.recordLedgerEntry({
  debitAccount: "1000",
  creditAccount: "4100",
  debitAmount: 10.00,
  creditAmount: 10.00,
  entryType: "platform_fee",
  referenceId: "pay_789",
  description: "Platform fee"
});

// paymentService.getLedgerEntries(referenceId)
// Gets all ledger entries for a reference

const entries = await paymentService.getLedgerEntries("pay_789");
// Returns: [ { entryId, debitAccount, creditAccount, ... } ]
```

### Ledger System

```javascript
// ledgerSystem.recordPaymentReceived(paymentData)
// Records payment received entries (platform fee + vendor payable)

Usage:
const entries = await ledgerSystem.recordPaymentReceived({
  paymentId: "pay_789",
  orderId: "ord_123",
  amount: 165.00,
  platformFeeAmount: 15.00,
  vendorShareAmount: 150.00
});

Returns: { platformFee: "entry_1", vendorPayable: "entry_2" }

// ledgerSystem.recordRefund(refundData)
// Reverses payment entries for a refund

Usage:
const entries = await ledgerSystem.recordRefund({
  refundId: "ref_456",
  paymentId: "pay_789",
  orderId: "ord_123",
  refundAmount: 165.00,
  reason: "customer_request"
});

// ledgerSystem.recordPayout(payoutData)
// Records vendor payout (vendor payables → bank)

Usage:
const entryId = await ledgerSystem.recordPayout({
  payoutId: "payout_123",
  vendorId: "vendor_1",
  amount: 850.00
});

// ledgerSystem.getAccountBalance(accountCode)
// Gets current balance for account

const balance = await ledgerSystem.getAccountBalance("1000");
// Returns: 5000.00

Accounts:
- "1000": Clearing Account (asset)
- "2100": Vendor Payables (liability)
- "4100": Platform Fees (revenue)

// ledgerSystem.getTrialBalance(startDate, endDate)
// Gets trial balance for period

const trial = await ledgerSystem.getTrialBalance(
  new Date("2024-01-01"),
  new Date("2024-01-31")
);
// Returns: { "1000": 5000, "2100": -3000, "4100": -2000, ... }
```

### Payout System

```javascript
// payoutSystem.createPayoutBatch()
// Creates payouts for all vendors with pending balance

Usage:
const batch = await payoutSystem.createPayoutBatch();

Response: {
  batchId: "batch_456",
  payouts: 12,
  totalAmount: 8500.00
}

// payoutSystem.getPayoutBatch(batchId)
// Gets payout batch details

const batch = await payoutSystem.getPayoutBatch("batch_456");
// Returns: { batchId, status, totalAmount, payoutIds, ... }

// payoutSystem.getPayout(payoutId)
// Gets individual payout

const payout = await payoutSystem.getPayout("payout_123");
// Returns: { payoutId, vendorId, amount, status, ... }

// payoutSystem.confirmPayout(payoutId, confirmData)
// Marks payout as completed

Usage:
await payoutSystem.confirmPayout("payout_123", {
  reference: "EFT123456",
  method: "eft",
  processedBy: "admin_1"
});

// payoutSystem.getVendorPayoutHistory(vendorId, limit)
// Gets vendor's payout history

Usage:
const history = await payoutSystem.getVendorPayoutHistory("vendor_1", 10);
// Returns: [ { payoutId, amount, completedAt, ... }, ... ]

// payoutSystem.getProjectedPayout(vendorId)
// Gets vendor's projected payout amount

const projected = await payoutSystem.getProjectedPayout("vendor_1");
// Returns: { vendorId, currentBalance, totalEarned, nextPayoutEligible, ... }

// payoutSystem.getBatchSummary(batchId)
// Gets payout batch summary

const summary = await payoutSystem.getBatchSummary("batch_456");
// Returns: { batchId, status, totalAmount, payoutStatuses, ... }
```

---

## Cloud Functions (Server-Side)

### POST /.netlify/functions/createPayfastCheckout

**Purpose**: Generate PayFast payment URL

**Request**:
```javascript
{
  orderId: "ord_123"
}
```

**Response**:
```javascript
{
  paymentUrl: "https://sandbox.payfast.co.za/eng/process?...",
  paymentId: "pay_789",
  idempotencyKey: "uuid-123"
}
```

**Status Codes**:
- 200: Success
- 400: Missing order ID or invalid order
- 404: Order not found
- 500: Server error

---

### POST /.netlify/functions/handlePayfastITN

**Purpose**: Handle PayFast Instant Transaction Notification

**Request** (Form Data from PayFast):
```
pf_payment_id: "1234567890"
merchant_id: "10000100"
payment_status: "COMPLETE"
amount_gross: "100.00"
amount_fee: "2.50"
amount_net: "97.50"
custom_str1: "ord_123"
custom_str2: "pay_789"
custom_str3: "user_456"
custom_str4: "uuid-123"
item_name: "Campus Food Order"
item_description: "Order for Pizza Place"
name_first: "John"
name_last: "Doe"
email_address: "john@example.com"
signature: "md5_hash"
```

**Response**:
```javascript
{
  success: true
}
// or
{
  error: "Duplicate event, already processed"
}
```

**Payment Statuses**:
- "COMPLETE": Payment successful
- "FAILED": Payment failed
- "PENDING": Payment pending

**Flow**:
1. ✓ Validates MD5 signature
2. ✓ Checks for duplicate using idempotencyKey
3. ✓ Verifies order and amount
4. ✓ Creates ledger entries
5. ✓ Updates vendor balances
6. ✓ Optionally syncs to Xero
7. ✓ Marks webhook as processed

---

### GET /.netlify/functions/getVendorBalance

**Purpose**: Get vendor's account balance

**Query Parameters**:
```
vendorId: "vendor_1"
```

**Response**:
```javascript
{
  vendorId: "vendor_1",
  vendorName: "Pizza Place",
  currency: "ZAR",
  balance: 850.00,
  totalPaid: 5000.00,
  totalEarned: 5850.00,
  lastPayoutAt: Timestamp,
  bankDetails: {
    accountHolder: "Pizza Place (Pty) Ltd",
    accountNumber: "1234567890",
    bankCode: "632005",
    branchCode: "632005"
  }
}
```

**Status Codes**:
- 200: Success
- 400: Missing vendor ID
- 404: Vendor not found
- 500: Server error

---

### POST /.netlify/functions/createRefund

**Purpose**: Request a refund for an order

**Request**:
```javascript
{
  orderId: "ord_123",
  reason: "customer_request",
  amount: 165.00  // optional, defaults to full order
}
```

**Response**:
```javascript
{
  refundId: "ref_456",
  message: "Refund request created"
}
```

**Status Codes**:
- 200: Success
- 400: Missing order ID or reason
- 404: Order or payment not found
- 500: Server error

**Refund Reasons**:
- "customer_request"
- "payment_error"
- "order_cancelled"
- "partial"

---

### POST /.netlify/functions/runPayoutBatch

**Purpose**: Create payout batch for all vendors with pending balance

**Request**:
```javascript
{}
```

**Response**:
```javascript
{
  batchId: "batch_456",
  payouts: 12,
  totalAmount: 8500.00
}
// or if no vendors
{
  batchId: null,
  payouts: 0,
  totalAmount: 0,
  message: "No vendors with pending balance"
}
```

**Status Codes**:
- 200: Success (batch created or no vendors)
- 500: Server error

**After Response**:
- Admin reviews payout details
- Admin initiates EFT transfers
- Admin calls confirmPayout() for each payout

---

### POST /.netlify/functions/confirmPayout

**Purpose**: Mark individual payout as completed

**Request**:
```javascript
{
  payoutId: "payout_123",
  reference: "EFT123456",
  method: "eft"
}
```

**Response**:
```javascript
{
  success: true,
  message: "Payout confirmed"
}
```

**Payout Methods**:
- "eft": Electronic Funds Transfer
- "bank_transfer": Manual bank transfer
- "manual": Manual tracking

---

## Firestore Collections

### payments
```javascript
{
  paymentId: "pay_789",
  orderId: "ord_123",
  customerId: "user_456",
  amount: 165.00,
  amountNet: 160.60,
  currency: "ZAR",
  paymentMethod: "payfast",
  paymentStatus: "successful",  // pending, successful, failed, cancelled
  payFastPaymentId: "1234567890",
  idempotencyKey: "uuid-123",
  createdAt: Timestamp,
  confirmedAt: Timestamp,
  webhookEventIds: ["webhook_123"]
}
```

### vendorBalances
```javascript
{
  vendorId: "vendor_1",
  vendorName: "Pizza Place",
  currency: "ZAR",
  balance: 850.00,
  totalPaid: 5000.00,
  totalEarned: 5850.00,
  lastUpdated: Timestamp,
  lastPayoutAt: Timestamp,
  bankDetails: {...}
}
```

### payouts
```javascript
{
  payoutId: "payout_123",
  batchId: "batch_456",
  vendorId: "vendor_1",
  vendorName: "Pizza Place",
  amount: 850.00,
  currency: "ZAR",
  status: "completed",  // pending, processing, completed, failed
  payoutMethod: "eft",
  payoutReference: "EFT123456",
  createdAt: Timestamp,
  completedAt: Timestamp
}
```

### ledgerEntries
```javascript
{
  entryId: "entry_123",
  debitAccount: "1000",
  creditAccount: "4100",
  debitAmount: 15.00,
  creditAmount: 15.00,
  currency: "ZAR",
  entryType: "platform_fee",
  referenceId: "pay_789",
  status: "posted",
  description: "Platform fee for order ord_123",
  createdAt: Timestamp,
  postedAt: Timestamp,
  idempotencyKey: "key_123"
}
```

---

## Common Patterns

### Complete Payment Flow

```javascript
// 1. Customer clicks Pay
const { paymentUrl } = await paymentIntegration.generatePayFastCheckoutUrl(orderId);
window.location.href = paymentUrl;

// 2. PayFast processes payment

// 3. PayFast calls Cloud Function handlePayfastITN (automatic)

// 4. Frontend polls or waits for order update
const order = await db.collection("orders").doc(orderId).get();
if (order.data().paymentStatus === "successful") {
  // Show success
}
```

### Vendor Sees Their Balance

```javascript
const balance = await paymentService.getVendorBalance(vendorId);
console.log(`You have earned ZAR ${balance.balance} waiting for payout`);
console.log(`Lifetime earnings: ZAR ${balance.totalEarned}`);
console.log(`Lifetime payouts: ZAR ${balance.totalPaid}`);
```

### Admin Creates Payout Batch

```javascript
// Step 1: Create batch
const batch = await payoutSystem.createPayoutBatch();
console.log(`Created payout batch: ${batch.batchId}`);
console.log(`Total: ${batch.payouts} vendors, ZAR ${batch.totalAmount}`);

// Step 2: Review details
const payouts = await payoutSystem.getPayoutsForBatch(batch.batchId);
// Show in UI for admin review

// Step 3: Process EFT transfers manually or with banking API

// Step 4: Confirm each payout
for (const payout of payouts) {
  await payoutSystem.confirmPayout(payout.payoutId, {
    reference: "EFT123456",
    method: "eft"
  });
}
```

### Get Vendor Payout History

```javascript
const history = await payoutSystem.getVendorPayoutHistory(vendorId, 20);
history.forEach(payout => {
  console.log(`Payout ${payout.payoutId}: ZAR ${payout.amount} on ${payout.completedAt}`);
});
```

### Check Ledger for an Order

```javascript
const entries = await paymentService.getLedgerEntries(paymentId);
console.log("Ledger entries for this payment:");
entries.forEach(entry => {
  console.log(`  Debit ${entry.debitAccount}: ${entry.debitAmount}`);
  console.log(`  Credit ${entry.creditAccount}: ${entry.creditAmount}`);
});
```

---

## Error Codes

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid signature" | PayFast signature doesn't match | Check merchant key in .env |
| "Amount mismatch" | Payment amount != order total | Verify order hasn't been modified |
| "Order not found" | Order ID doesn't exist in Firestore | Check order was created first |
| "Duplicate event" | ITN already processed | This is normal, ITN retried by PayFast |
| "Payment record not found" | Payment ID invalid | Check payment was created before redirect |
| "Cloud Functions timeout" | Function took > 60 seconds | Check logs for errors |

---

## Rate Limits

- Cloud Functions: 5,000 invocations/day (free tier), unlimited paid
- Firestore: 50,000 reads/day (free tier)
- PayFast: No stated limit, typically millions/day
- Xero API: 5,000 API calls per minute per tenant

---

## Security Best Practices

1. **Always validate signatures** from PayFast webhooks
2. **Verify order amounts** before creating payment
3. **Use idempotencyKey** to prevent duplicate charges
4. **Never log sensitive data** (card details, signatures)
5. **Use HTTPS only** for all payment endpoints
6. **Rotate secrets regularly** in production
7. **Monitor webhook logs** for failures
8. **Set up alerts** for payment anomalies

