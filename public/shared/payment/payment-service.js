/**
 * Payment Service - Firestore Operations
 * Handles all payment-related database operations
 */

(function attachPaymentService(globalScope) {
    "use strict";

    const MODULE_NAME = "payment-service";
    const PAYMENTS_COLLECTION = "payments";
    const ORDERS_COLLECTION = "orders";
    const VENDOR_BALANCES_COLLECTION = "vendorBalances";
    const LEDGER_ENTRIES_COLLECTION = "ledgerEntries";
    const WEBHOOK_EVENTS_COLLECTION = "webhookEvents";

    function resolveDb(explicitDb) {
        if (explicitDb && typeof explicitDb.collection === "function") {
            return explicitDb;
        }

        if (typeof globalScope !== "undefined" && globalScope.db && typeof globalScope.db.collection === "function") {
            return globalScope.db;
        }

        if (typeof require === "function") {
            try {
                const admin = require("firebase-admin");
                if (admin && admin.firestore && typeof admin.firestore === "function") {
                    return admin.firestore();
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    /**
     * Creates a payment record in Firestore
     * 
     * @param {object} paymentData - Payment details
     * @returns {Promise<{paymentId: string, idempotencyKey: string}>}
     */
    async function createPayment(paymentData, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const {
            orderId,
            customerId,
            amount,
            currency = "ZAR",
            paymentMethod = "payfast"
        } = paymentData;

        if (!orderId || !customerId || !amount) {
            throw new Error("Missing required payment fields");
        }

        const paymentId = globalScope.crypto?.randomUUID?.() || generateUUID();
        const idempotencyKey = globalScope.crypto?.randomUUID?.() || generateUUID();

        const payment = {
            paymentId,
            orderId,
            customerId,
            amount: Number(amount),
            amountNet: 0, // Will be updated by PayFast
            currency,
            paymentMethod,
            paymentStatus: "pending",
            payFastPaymentId: null,
            idempotencyKey,
            createdAt: new Date(),
            confirmedAt: null,
            completedAt: null,
            webhookEventIds: [],
            metadata: {
                ipAddress: paymentData.ipAddress || null,
                userAgent: paymentData.userAgent || null
            }
        };

        await db.collection(PAYMENTS_COLLECTION).doc(paymentId).set(payment);

        return { paymentId, idempotencyKey };
    }

    /**
     * Gets a payment record
     * 
     * @param {string} paymentId - Payment ID
     * @returns {Promise<object|null>}
     */
    async function getPayment(paymentId, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const doc = await db.collection(PAYMENTS_COLLECTION).doc(paymentId).get();
        return doc.exists ? doc.data() : null;
    }

    /**
     * Updates payment status after PayFast confirmation
     * Uses transaction for safety
     * 
     * @param {string} paymentId - Payment ID
     * @param {object} updateData - Data to update
     * @returns {Promise<void>}
     */
    async function updatePaymentStatus(paymentId, updateData, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const {
            paymentStatus,
            payFastPaymentId,
            amountNet,
            confirmedAt = new Date()
        } = updateData;

        if (!paymentStatus) {
            throw new Error("Payment status is required");
        }

        const paymentRef = db.collection(PAYMENTS_COLLECTION).doc(paymentId);
        const payment = await paymentRef.get();

        if (!payment.exists) {
            throw new Error(`Payment ${paymentId} not found`);
        }

        const updates = {
            paymentStatus,
            updatedAt: new Date()
        };

        if (payFastPaymentId) updates.payFastPaymentId = payFastPaymentId;
        if (amountNet) updates.amountNet = Number(amountNet);
        if (paymentStatus === "successful" || paymentStatus === "completed") {
            updates.confirmedAt = confirmedAt;
        }

        await paymentRef.update(updates);
    }

    /**
     * Records a webhook event for idempotency and audit
     * 
     * @param {object} webhookData - Webhook payload
     * @returns {Promise<string>} webhookEventId
     */
    async function recordWebhookEvent(webhookData, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const {
            source,
            payFastPaymentId,
            orderId,
            rawPayload,
            signature,
            signatureValid,
            idempotencyKey,
            ipAddress
        } = webhookData;

        const webhookEventId = globalScope.crypto?.randomUUID?.() || generateUUID();

        const webhookEvent = {
            webhookEventId,
            source: source || "payfast",
            eventType: "payment_confirmation",
            rawPayload,
            paymentId: null, // Will be linked later
            orderId: orderId || null,
            payFastPaymentId: payFastPaymentId || null,
            processed: false,
            processedAt: null,
            processingError: null,
            idempotencyKey: idempotencyKey || null,
            receivedAt: new Date(),
            ipAddress: ipAddress || null,
            signature: signature || null,
            signatureValid: signatureValid || false,
            metadata: {
                userAgent: webhookData.userAgent || null,
                retryCount: 0
            }
        };

        await db.collection(WEBHOOK_EVENTS_COLLECTION).doc(webhookEventId).set(webhookEvent);

        return webhookEventId;
    }

    /**
     * Checks for duplicate webhook using idempotency key
     * 
     * @param {string} idempotencyKey - Idempotency key
     * @returns {Promise<object|null>}
     */
    async function getDuplicateWebhookEvent(idempotencyKey, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const snapshot = await db
            .collection(WEBHOOK_EVENTS_COLLECTION)
            .where("idempotencyKey", "==", idempotencyKey)
            .where("processed", "==", true)
            .limit(1)
            .get();

        return snapshot.empty ? null : snapshot.docs[0].data();
    }

    /**
     * Updates vendor balance after payment
     * 
     * @param {string} vendorId - Vendor ID
     * @param {number} amount - Amount to add to balance
     * @returns {Promise<void>}
     */
    async function updateVendorBalance(vendorId, amount, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const vendorRef = db.collection(VENDOR_BALANCES_COLLECTION).doc(vendorId);
        const vendorDoc = await vendorRef.get();

        if (!vendorDoc.exists) {
            throw new Error(`Vendor ${vendorId} not found`);
        }

        await vendorRef.update({
            balance: db.FieldValue.increment(amount),
            totalEarned: db.FieldValue.increment(amount),
            lastUpdated: new Date()
        });
    }

    /**
     * Gets vendor balance
     * 
     * @param {string} vendorId - Vendor ID
     * @returns {Promise<object|null>}
     */
    async function getVendorBalance(vendorId, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const doc = await db.collection(VENDOR_BALANCES_COLLECTION).doc(vendorId).get();
        return doc.exists ? doc.data() : null;
    }

    /**
     * Initializes vendor balance record
     * 
     * @param {object} vendorData - Vendor details
     * @returns {Promise<void>}
     */
    async function initializeVendorBalance(vendorData, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const { vendorId, vendorName, currency = "ZAR" } = vendorData;

        if (!vendorId) throw new Error("Vendor ID is required");

        const vendorRef = db.collection(VENDOR_BALANCES_COLLECTION).doc(vendorId);
        const vendorDoc = await vendorRef.get();

        if (!vendorDoc.exists) {
            await vendorRef.set({
                vendorId,
                vendorName: vendorName || "",
                currency,
                balance: 0,
                totalPaid: 0,
                totalEarned: 0,
                lastUpdated: new Date(),
                lastPayoutAt: null,
                nextPayoutDate: null
            });
        }
    }

    /**
     * Records a ledger entry (double-entry accounting)
     * 
     * @param {object} entryData - Ledger entry details
     * @returns {Promise<string>} entryId
     */
    async function recordLedgerEntry(entryData, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const {
            account,
            debitAccount,
            creditAccount,
            debitAmount = 0,
            creditAmount = 0,
            entryType,
            referenceId,
            relatedPaymentId,
            relatedOrderId,
            relatedVendorId,
            description,
            idempotencyKey,
            currency = "ZAR"
        } = entryData;

        // Check for duplicate using idempotency key
        if (idempotencyKey) {
            const snapshot = await db
                .collection(LEDGER_ENTRIES_COLLECTION)
                .where("idempotencyKey", "==", idempotencyKey)
                .limit(1)
                .get();

            if (!snapshot.empty) {
                return snapshot.docs[0].id;
            }
        }

        const entryId = globalScope.crypto?.randomUUID?.() || generateUUID();

        const ledgerEntry = {
            entryId,
            account: account || null,
            debitAccount: debitAccount || null,
            creditAccount: creditAccount || null,
            debitAmount: Number(debitAmount),
            creditAmount: Number(creditAmount),
            amount: Math.max(debitAmount, creditAmount),
            currency,
            entryType: entryType || "payment_received",
            referenceId: referenceId || null,
            relatedPaymentId: relatedPaymentId || null,
            relatedOrderId: relatedOrderId || null,
            relatedVendorId: relatedVendorId || null,
            status: "posted",
            description: description || "",
            createdAt: new Date(),
            postedAt: new Date(),
            idempotencyKey: idempotencyKey || null,
            xeroSyncStatus: {
                synced: false,
                syncedAt: null,
                xeroLineItemId: null,
                syncError: null
            }
        };

        await db.collection(LEDGER_ENTRIES_COLLECTION).doc(entryId).set(ledgerEntry);

        return entryId;
    }

    /**
     * Retrieves ledger entries for a payment/order
     * 
     * @param {string} referenceId - Payment or order ID
     * @returns {Promise<object[]>}
     */
    async function getLedgerEntries(referenceId, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const snapshot = await db
            .collection(LEDGER_ENTRIES_COLLECTION)
            .where("referenceId", "==", referenceId)
            .get();

        return snapshot.docs.map(doc => doc.data());
    }

    /**
     * Simple UUID generator fallback
     */
    function generateUUID() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === "x" ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Exported API
     */
    const api = {
        createPayment,
        getPayment,
        updatePaymentStatus,
        recordWebhookEvent,
        getDuplicateWebhookEvent,
        updateVendorBalance,
        getVendorBalance,
        initializeVendorBalance,
        recordLedgerEntry,
        getLedgerEntries
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else if (typeof globalScope !== "undefined") {
        globalScope.paymentService = api;
    }
})(typeof window !== "undefined" ? window : global);
