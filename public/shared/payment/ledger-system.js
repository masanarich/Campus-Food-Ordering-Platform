/**
 * Ledger System - Double-Entry Accounting
 * Ensures all financial transactions are recorded accurately and reversible
 */

(function attachLedgerSystem(globalScope) {
    "use strict";

    const MODULE_NAME = "ledger-system";
    const LEDGER_ENTRIES_COLLECTION = "ledgerEntries";

    // Account codes (Chart of Accounts)
    const ACCOUNTS = {
        // Assets
        CLEARING_ACCOUNT: "1000", // Temporary holding for received payments
        CASH_ACCOUNT: "1010",
        BANK_ACCOUNT: "1020",

        // Liabilities
        VENDOR_PAYABLES: "2100", // Amounts owed to vendors
        CUSTOMER_REFUNDABLE: "2200", // Refund liability

        // Revenue
        PLATFORM_FEES: "4100", // Platform fees revenue
        PAYMENT_PROCESSING_FEES: "4200", // PayFast fees (expense)

        // Expenses
        PAYMENT_FEES_EXPENSE: "5100", // PayFast processing fees
        REFUND_EXPENSE: "5200" // Refunds issued
    };

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
     * Records a ledger entry
     * Idempotent using idempotencyKey
     * 
     * @param {object} entry - Entry details
     * @returns {Promise<string>} entryId
     */
    async function recordEntry(entry, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const {
            debitAccount,
            creditAccount,
            debitAmount,
            creditAmount,
            entryType,
            referenceId,
            description,
            idempotencyKey,
            relatedPaymentId,
            relatedOrderId,
            relatedVendorId,
            relatedRefundId,
            currency = "ZAR"
        } = entry;

        if (!debitAccount || !creditAccount) {
            throw new Error("Both debit and credit accounts are required");
        }

        if (!debitAmount || !creditAmount) {
            throw new Error("Both debit and credit amounts are required");
        }

        if (Math.abs(debitAmount - creditAmount) > 0.01) {
            throw new Error("Debit and credit amounts must be equal");
        }

        // Check for duplicate using idempotency key
        if (idempotencyKey) {
            const existing = await db
                .collection(LEDGER_ENTRIES_COLLECTION)
                .where("idempotencyKey", "==", idempotencyKey)
                .limit(1)
                .get();

            if (!existing.empty) {
                return existing.docs[0].data().entryId;
            }
        }

        const entryId = generateUUID();
        const timestamp = new Date();

        const ledgerEntry = {
            entryId,
            debitAccount,
            creditAccount,
            debitAmount: Number(debitAmount),
            creditAmount: Number(creditAmount),
            amount: Number(debitAmount),
            currency,
            entryType: entryType || "general",
            referenceId: referenceId || null,
            relatedPaymentId: relatedPaymentId || null,
            relatedOrderId: relatedOrderId || null,
            relatedVendorId: relatedVendorId || null,
            relatedRefundId: relatedRefundId || null,
            status: "posted",
            description: description || "",
            createdAt: timestamp,
            postedAt: timestamp,
            reversingEntryId: null,
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
     * Records payment received entries
     * Debits clearing account, credits vendor payables and platform fees
     * 
     * @param {object} paymentData - Payment information
     * @returns {Promise<object>} Entries created
     */
    async function recordPaymentReceived(paymentData, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const {
            paymentId,
            orderId,
            amount,
            platformFeeAmount,
            vendorShareAmount,
            idempotencyKeyBase = paymentId
        } = paymentData;

        if (!amount || amount <= 0) {
            throw new Error("Amount must be greater than 0");
        }

        if (!platformFeeAmount || !vendorShareAmount) {
            throw new Error("Fee and vendor share amounts are required");
        }

        const entries = {};

        // Entry 1: Platform fees
        // Debit: Clearing Account | Credit: Platform Fees Revenue
        entries.platformFee = await recordEntry(
            {
                debitAccount: ACCOUNTS.CLEARING_ACCOUNT,
                creditAccount: ACCOUNTS.PLATFORM_FEES,
                debitAmount: platformFeeAmount,
                creditAmount: platformFeeAmount,
                entryType: "platform_fee",
                referenceId: paymentId,
                relatedPaymentId: paymentId,
                relatedOrderId: orderId,
                description: `Platform fee for order ${orderId}`,
                idempotencyKey: `${idempotencyKeyBase}-platform-fee`,
                currency: "ZAR"
            },
            db
        );

        // Entry 2: Vendor payables
        // Debit: Clearing Account | Credit: Vendor Payables
        entries.vendorPayable = await recordEntry(
            {
                debitAccount: ACCOUNTS.CLEARING_ACCOUNT,
                creditAccount: ACCOUNTS.VENDOR_PAYABLES,
                debitAmount: vendorShareAmount,
                creditAmount: vendorShareAmount,
                entryType: "vendor_payable",
                referenceId: paymentId,
                relatedPaymentId: paymentId,
                relatedOrderId: orderId,
                description: `Vendor payable for order ${orderId}`,
                idempotencyKey: `${idempotencyKeyBase}-vendor-payable`,
                currency: "ZAR"
            },
            db
        );

        return entries;
    }

    /**
     * Records a refund
     * Reverses payment entries and records refund liability
     * 
     * @param {object} refundData - Refund information
     * @returns {Promise<object>} Entries created
     */
    async function recordRefund(refundData, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const {
            refundId,
            paymentId,
            orderId,
            refundAmount,
            reason,
            idempotencyKeyBase = refundId
        } = refundData;

        if (!refundAmount || refundAmount <= 0) {
            throw new Error("Refund amount must be greater than 0");
        }

        // Get original payment entries to reverse
        const originalEntries = await db
            .collection(LEDGER_ENTRIES_COLLECTION)
            .where("relatedPaymentId", "==", paymentId)
            .get();

        if (originalEntries.empty) {
            throw new Error("Original payment entries not found");
        }

        const entries = {};

        // Reverse each original entry
        for (const originalDoc of originalEntries.docs) {
            const original = originalDoc.data();

            // Create reversing entry
            const reversingEntryId = await recordEntry(
                {
                    debitAccount: original.creditAccount,
                    creditAccount: original.debitAccount,
                    debitAmount: refundAmount,
                    creditAmount: refundAmount,
                    entryType: "refund_reversal",
                    referenceId: refundId,
                    relatedPaymentId: paymentId,
                    relatedOrderId: orderId,
                    relatedRefundId: refundId,
                    description: `Reversal of ${original.description} for refund ${reason}`,
                    idempotencyKey: `${idempotencyKeyBase}-reversal-${original.entryId}`,
                    currency: "ZAR"
                },
                db
            );

            entries[`reversal-${original.entryId}`] = reversingEntryId;

            // Mark original entry as reversed
            await db
                .collection(LEDGER_ENTRIES_COLLECTION)
                .doc(original.entryId)
                .update({
                    reversingEntryId,
                    status: "reversed"
                });
        }

        return entries;
    }

    /**
     * Records a payout to vendor
     * Debits vendor payables, credits bank account
     * 
     * @param {object} payoutData - Payout information
     * @returns {Promise<string>} Entry ID
     */
    async function recordPayout(payoutData, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const {
            payoutId,
            vendorId,
            amount,
            idempotencyKeyBase = payoutId
        } = payoutData;

        if (!amount || amount <= 0) {
            throw new Error("Payout amount must be greater than 0");
        }

        // Debit: Vendor Payables | Credit: Bank Account
        const entryId = await recordEntry(
            {
                debitAccount: ACCOUNTS.VENDOR_PAYABLES,
                creditAccount: ACCOUNTS.BANK_ACCOUNT,
                debitAmount: amount,
                creditAmount: amount,
                entryType: "vendor_payout",
                referenceId: payoutId,
                relatedVendorId: vendorId,
                description: `Payout to vendor ${vendorId}`,
                idempotencyKey: `${idempotencyKeyBase}-payout`,
                currency: "ZAR"
            },
            db
        );

        return entryId;
    }

    /**
     * Gets all entries for a reference (payment, order, refund)
     * 
     * @param {string} referenceId - Reference ID
     * @returns {Promise<object[]>}
     */
    async function getEntriesByReference(referenceId, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const snapshot = await db
            .collection(LEDGER_ENTRIES_COLLECTION)
            .where("referenceId", "==", referenceId)
            .orderBy("createdAt", "asc")
            .get();

        return snapshot.docs.map(doc => doc.data());
    }

    /**
     * Gets trial balance for a period
     * 
     * @param {Date} startDate - Period start
     * @param {Date} endDate - Period end
     * @returns {Promise<object>} Trial balance
     */
    async function getTrialBalance(startDate, endDate, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const snapshot = await db
            .collection(LEDGER_ENTRIES_COLLECTION)
            .where("postedAt", ">=", startDate)
            .where("postedAt", "<=", endDate)
            .where("status", "==", "posted")
            .get();

        const balances = {};

        snapshot.docs.forEach(doc => {
            const entry = doc.data();

            if (!balances[entry.debitAccount]) {
                balances[entry.debitAccount] = 0;
            }
            if (!balances[entry.creditAccount]) {
                balances[entry.creditAccount] = 0;
            }

            balances[entry.debitAccount] += entry.debitAmount;
            balances[entry.creditAccount] -= entry.creditAmount;
        });

        return balances;
    }

    /**
     * Gets account balance
     * 
     * @param {string} accountCode - Account code
     * @returns {Promise<number>}
     */
    async function getAccountBalance(accountCode, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const debits = await db
            .collection(LEDGER_ENTRIES_COLLECTION)
            .where("debitAccount", "==", accountCode)
            .where("status", "==", "posted")
            .get();

        const credits = await db
            .collection(LEDGER_ENTRIES_COLLECTION)
            .where("creditAccount", "==", accountCode)
            .where("status", "==", "posted")
            .get();

        let balance = 0;

        debits.docs.forEach(doc => {
            balance += doc.data().debitAmount;
        });

        credits.docs.forEach(doc => {
            balance -= doc.data().creditAmount;
        });

        return balance;
    }

    /**
     * Simple UUID generator
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
        recordEntry,
        recordPaymentReceived,
        recordRefund,
        recordPayout,
        getEntriesByReference,
        getTrialBalance,
        getAccountBalance,
        ACCOUNTS
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else if (typeof globalScope !== "undefined") {
        globalScope.ledgerSystem = api;
    }
})(typeof window !== "undefined" ? window : global);
