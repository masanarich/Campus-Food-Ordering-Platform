# Campus Food Ordering Platform - Payment System Documentation

## Architecture Overview

This payment system integrates PayFast as the payment gateway with Firestore as the source of truth and Xero as the accounting system of record.

### Key Components

1. **PayFast Integration** - Redirect-based checkout with ITN webhooks
2. **Firestore Database** - Primary data store with collections for payments, ledgers, payouts, and webhooks
3. **Cloud Functions** - Backend payment processing (ITN handling, refunds, payouts)
4. **Ledger System** - Double-entry accounting for all financial transactions
5. **Payout System** - Tracks vendor payouts (manual or automated)
6. **Xero Sync** - Mirrors payments, invoices, and settlements to Xero

---

## Firestore Schema

### 1. `orders` Collection (Enhanced)

```
/orders/{orderId}
├── orderId: string
├── customerId: string
├── customerName: string
├── customerEmail: string
├── vendorUids: string[] (array of vendors in order)
├── items: object[]
│   ├── menuItemId: string
│   ├── vendorUid: string
│   ├── name: string
│   ├── price: number
│   ├── quantity: number
│   └── subtotal: number
├── subtotal: number (before fees)
├── platformFeeAmount: number (calculated)
├── total: number (amount_gross for PayFast)
├── status: string (pending, awaiting_payment, paid, completed, cancelled, refunded)
├── paymentId: string (reference to payments collection)
├── paymentStatus: string (none, pending, successful, failed, cancelled)
├── createdAt: timestamp
├── updatedAt: timestamp
└── vendorGroupings: object[] (for payout calculation)
    ├── vendorUid: string
    ├── vendorName: string
    ├── items: object[]
    ├── subtotal: number
    ├── vendorShare: number (subtotal - platform fee share)
    └── status: string (pending_payout, paid_out)
```

### 2. `payments` Collection

```
/payments/{paymentId}
├── paymentId: string (UUID)
├── orderId: string
├── customerId: string
├── amount: number (gross amount paid)
├── amountNet: number (after PayFast fees)
├── currency: string (e.g., "ZAR")
├── paymentMethod: string ("payfast")
├── paymentStatus: string (pending, successful, failed, cancelled)
├── paymentStatusReason: string (optional)
├── payFastPaymentId: string (pf_payment_id from PayFast)
├── payFastSignatureValid: boolean
├── idempotencyKey: string (UUID generated before redirecting to PayFast)
├── signature: string (PayFast signature)
├── paymentUrl: string (PayFast redirect URL)
├── customString: string (custom_str1 for order ID)
├── createdAt: timestamp
├── confirmedAt: timestamp (when ITN confirmed payment)
├── completedAt: timestamp (when marked complete)
├── webhookEventIds: string[] (webhookEvents that processed this payment)
└── metadata: object
    ├── ipAddress: string
    ├── userAgent: string
    └── itemCount: number
```

### 3. `vendorBalances` Collection

```
/vendorBalances/{vendorId}
├── vendorId: string
├── vendorName: string
├── currency: string
├── balance: number (amount owed to vendor)
├── totalPaid: number (lifetime payouts)
├── totalEarned: number (lifetime earnings before fees)
├── lastUpdated: timestamp
├── lastPayoutAt: timestamp (null if never paid)
├── nextPayoutDate: timestamp (calculated or scheduled)
└── bankDetails: object (optional)
    ├── accountHolder: string
    ├── accountNumber: string
    ├── bankCode: string
    └── branchCode: string
```

### 4. `payouts` Collection

```
/payouts/{payoutId}
├── payoutId: string (UUID)
├── batchId: string (reference to payoutBatches)
├── vendorId: string
├── vendorName: string
├── amount: number
├── currency: string
├── status: string (pending, processing, completed, failed)
├── payoutMethod: string ("eft", "bank_transfer", "manual")
├── payoutReference: string (e.g., bank transfer reference)
├── relatedPaymentIds: string[] (payments included in this payout)
├── createdAt: timestamp
├── processedAt: timestamp
├── completedAt: timestamp
├── failureReason: string (optional)
├── bankDetails: object
│   ├── accountHolder: string
│   ├── accountNumber: string
│   ├── bankCode: string
│   └── branchCode: string
└── xeroPaymentId: string (if synced to Xero)
```

### 5. `payoutBatches` Collection

```
/payoutBatches/{batchId}
├── batchId: string (UUID)
├── status: string (pending, processing, completed, failed)
├── totalAmount: number
├── currency: string
├── payoutIds: string[] (references to payouts collection)
├── payoutCount: number
├── vendorCount: number
├── createdAt: timestamp
├── processedAt: timestamp
├── completedAt: timestamp
├── processedBy: string (admin/system user ID)
└── notes: string
```

### 6. `refunds` Collection

```
/refunds/{refundId}
├── refundId: string (UUID)
├── paymentId: string
├── orderId: string
├── amount: number
├── reason: string (customer_request, payment_error, order_cancelled, partial)
├── status: string (requested, pending, approved, processing, completed, failed, rejected)
├── requestedBy: string (customer_uid or admin_uid)
├── approvedBy: string (admin_uid)
├── processedBy: string (payment processor)
├── requestedAt: timestamp
├── approvedAt: timestamp
├── processedAt: timestamp
├── createdAt: timestamp
├── failureReason: string (optional)
├── reversingLedgerEntryIds: string[] (ledger entries that reverse original payment)
└── metadata: object
    ├── reason: string (detailed reason)
    └── notes: string
```

### 7. `webhookEvents` Collection

```
/webhookEvents/{webhookEventId}
├── webhookEventId: string (UUID)
├── source: string ("payfast")
├── eventType: string ("payment_confirmation")
├── rawPayload: object (full PayFast ITN data)
├── paymentId: string (reference to payments)
├── orderId: string (from custom_str1)
├── payFastPaymentId: string
├── processed: boolean
├── processedAt: timestamp
├── processingError: string (if failed)
├── idempotencyKey: string (for deduplication)
├── receivedAt: timestamp
├── ipAddress: string
├── signature: string
├── signatureValid: boolean
└── metadata: object
    ├── userAgent: string
    ├── retryCount: number
    └── sourceUrl: string
```

### 8. `ledgerEntries` Collection

```
/ledgerEntries/{entryId}
├── entryId: string (UUID)
├── ledgerId: string (account reference)
├── account: string (asset, liability, revenue, expense account code)
├── debitAccount: string (account debited, if applicable)
├── creditAccount: string (account credited, if applicable)
├── debitAmount: number
├── creditAmount: number
├── amount: number (for convenience)
├── currency: string
├── entryType: string (payment_received, vendor_payable, platform_fee, refund, payout_record)
├── referenceId: string (paymentId, orderId, refundId, or payoutId)
├── relatedPaymentId: string (for traceability)
├── relatedOrderId: string
├── relatedVendorId: string
├── relatedRefundId: string
├── status: string (pending, posted, reversed)
├── description: string
├── createdAt: timestamp
├── postedAt: timestamp
├── reversingEntryId: string (if reversed)
├── idempotencyKey: string (prevent duplicates)
└── xeroSyncStatus: object
    ├── synced: boolean
    ├── syncedAt: timestamp
    ├── xeroLineItemId: string
    └── syncError: string
```

### 9. `xeroMappings` Collection

```
/xeroMappings/{mappingId}
├── mappingId: string
├── source: string (order, payment, payout, refund)
├── sourceId: string (orderId, paymentId, etc.)
├── xeroEntityType: string (Invoice, Payment, BankTransaction)
├── xeroEntityId: string (Xero invoice ID, payment ID, etc.)
├── xeroContactId: string (Xero customer contact ID)
├── status: string (pending, synced, failed, needs_review)
├── syncedAt: timestamp
├── createdAt: timestamp
└── metadata: object
    ├── syncAttempts: number
    ├── lastError: string
    └── xeroResponse: object
```

### 10. `platformConfig` Collection

```
/platformConfig/payments
├── platformFeePercentage: number (e.g., 0.1 for 10%)
├── platformFeeMinimum: number (minimum fee in currency)
├── payFastMerchantId: string
├── payFastMerchantKey: string
├── payFastRedirectUrl: string
├── payFastCancelUrl: string
├── payFastNotifyUrl: string
├── payFastSecretKey: string
├── xeroClientId: string
├── xeroTenantId: string
├── xeroApiUrl: string
├── payoutSchedule: string (weekly, biweekly, monthly)
├── payoutNextDate: timestamp
├── autoPayoutEnabled: boolean
├── defaultCurrency: string
└── updatedAt: timestamp
```

---

## Key Design Decisions

1. **Idempotency**: Each payment has an `idempotencyKey` generated before redirecting to PayFast. This prevents duplicate charges if a user retries payment.

2. **ITN Deduplication**: `webhookEvents` stores all PayFast ITN calls. Repeated ITNs are deduplicated using the `idempotencyKey` and PayFast payment ID.

3. **Firestore is Source of Truth**: All payment state lives in Firestore. Xero is synced asynchronously and is read-only for accounting.

4. **Ledger Entries**: Double-entry accounting ensures all transactions are recorded. Refunds and payouts reverse ledger entries.

5. **Vendor Payouts Tracked Locally**: Since PayFast doesn't offer Stripe Connect-like payouts, we calculate and track payouts in Firestore. Actual transfers (EFT, manual) are recorded separately.

6. **Platform Fees**: Calculated at payment time and recorded in ledger. Vendors receive their share after fees.

---

## Status Flows

### Payment Status Lifecycle

```
pending → successful → (completed or disputed/failed)
       ↘ failed (immediate PayFast rejection)
       ↘ cancelled (user cancels at PayFast)
```

### Order Payment Status

```
awaiting_payment → (payment processing via ITN)
                ↘ paid (confirmed by ITN)
                ↘ refunded (if refund processed)
```

### Payout Status

```
pending → processing → completed
       ↘ failed (retry or manual intervention)
```

### Refund Status

```
requested → approved → processing → completed
         ↘ rejected
```

---

## Financial Calculations

### For a ZAR 100 order with 10% platform fee:

```
Order Total (Gross):           ZAR 100.00
Platform Fee (10%):            ZAR 10.00
Vendor Share:                  ZAR 90.00
PayFast Fee (~2.5%):           ZAR 2.50
Amount Net to Platform:        ZAR 97.50
Vendor Receives (from shares): ZAR 90.00
Platform Profit (net):         ZAR 7.50
```

---

## Integration Checklist

- [ ] Create payment.js module (client-side PayFast integration)
- [ ] Create payment-service.js (Firestore payment operations)
- [ ] Create Cloud Functions for ITN handling
- [ ] Create Cloud Functions for payouts
- [ ] Create Cloud Functions for Xero sync
- [ ] Create ledger system
- [ ] Create refund system
- [ ] Update orders to include paymentId and paymentStatus
- [ ] Update checkout flow to generate PayFast URLs
- [ ] Deploy Cloud Functions
- [ ] Configure PayFast webhook URL
- [ ] Test payment flow end-to-end
- [ ] Set up monitoring and alerting

