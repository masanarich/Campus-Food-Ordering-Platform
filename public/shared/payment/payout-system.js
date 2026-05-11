/**
 * Payout System
 * Manages vendor payouts, payout batches, and payout tracking
 */

(function attachPayoutSystem(globalScope) {
    "use strict";

    const MODULE_NAME = "payout-system";
    const PAYOUTS_COLLECTION = "payouts";
    const PAYOUT_BATCHES_COLLECTION = "payoutBatches";
    const VENDOR_BALANCES_COLLECTION = "vendorBalances";
    const LEDGER_ENTRIES_COLLECTION = "ledgerEntries";

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
     * Creates a payout batch for all vendors with pending balance
     * 
     * @returns {Promise<{batchId: string, payouts: number, totalAmount: number}>}
     */
    async function createPayoutBatch(explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        // Get all vendors with balance > 0
        const vendorSnapshot = await db
            .collection(VENDOR_BALANCES_COLLECTION)
            .where("balance", ">", 0)
            .get();

        if (vendorSnapshot.empty) {
            return { batchId: null, payouts: 0, totalAmount: 0, message: "No vendors with pending balance" };
        }

        const batchId = generateUUID();
        const payoutIds = [];
        const batch = db.batch();
        let totalAmount = 0;

        for (const vendorDoc of vendorSnapshot.docs) {
            const vendor = vendorDoc.data();
            const payoutId = generateUUID();

            const payout = {
                payoutId,
                batchId,
                vendorId: vendor.vendorId,
                vendorName: vendor.vendorName,
                amount: vendor.balance,
                currency: vendor.currency || "ZAR",
                status: "pending",
                payoutMethod: "manual",
                payoutReference: null,
                relatedPaymentIds: [],
                createdAt: new Date(),
                processedAt: null,
                completedAt: null,
                failureReason: null,
                bankDetails: vendor.bankDetails || {},
                xeroPaymentId: null
            };

            batch.set(db.collection(PAYOUTS_COLLECTION).doc(payoutId), payout);
            payoutIds.push(payoutId);
            totalAmount += vendor.balance;
        }

        // Create batch record
        const payoutBatch = {
            batchId,
            status: "pending",
            totalAmount,
            currency: "ZAR",
            payoutIds,
            payoutCount: payoutIds.length,
            vendorCount: vendorSnapshot.size,
            createdAt: new Date(),
            processedAt: null,
            completedAt: null,
            processedBy: "system",
            notes: ""
        };

        batch.set(db.collection(PAYOUT_BATCHES_COLLECTION).doc(batchId), payoutBatch);

        await batch.commit();

        return {
            batchId,
            payouts: payoutIds.length,
            totalAmount
        };
    }

    /**
     * Gets a payout batch
     * 
     * @param {string} batchId - Batch ID
     * @returns {Promise<object|null>}
     */
    async function getPayoutBatch(batchId, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const doc = await db.collection(PAYOUT_BATCHES_COLLECTION).doc(batchId).get();
        return doc.exists ? doc.data() : null;
    }

    /**
     * Gets a payout
     * 
     * @param {string} payoutId - Payout ID
     * @returns {Promise<object|null>}
     */
    async function getPayout(payoutId, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const doc = await db.collection(PAYOUTS_COLLECTION).doc(payoutId).get();
        return doc.exists ? doc.data() : null;
    }

    /**
     * Marks a payout as completed
     * Updates vendor balance and records ledger entry
     * 
     * @param {string} payoutId - Payout ID
     * @param {object} confirmData - Confirmation data (reference, method, etc)
     * @returns {Promise<void>}
     */
    async function confirmPayout(payoutId, confirmData, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const payoutDoc = await db.collection(PAYOUTS_COLLECTION).doc(payoutId).get();
        if (!payoutDoc.exists) {
            throw new Error("Payout not found");
        }

        const payout = payoutDoc.data();

        const batch = db.batch();

        // Update payout status
        batch.update(db.collection(PAYOUTS_COLLECTION).doc(payoutId), {
            status: "completed",
            payoutReference: confirmData.reference || null,
            payoutMethod: confirmData.method || "manual",
            completedAt: new Date(),
            processedAt: new Date(),
            processedBy: confirmData.processedBy || "system"
        });

        // Update vendor balance
        batch.update(db.collection(VENDOR_BALANCES_COLLECTION).doc(payout.vendorId), {
            balance: 0, // Reset balance after payout
            totalPaid: (await db.collection(VENDOR_BALANCES_COLLECTION).doc(payout.vendorId).get()).data().totalPaid + payout.amount,
            lastPayoutAt: new Date()
        });

        // Record ledger entry
        const entryId = generateUUID();
        const ledgerEntry = {
            entryId,
            debitAccount: "2100", // Vendor payables
            creditAccount: "1020", // Bank account
            debitAmount: payout.amount,
            creditAmount: payout.amount,
            currency: "ZAR",
            entryType: "vendor_payout",
            referenceId: payoutId,
            relatedVendorId: payout.vendorId,
            status: "posted",
            description: `Payout to ${payout.vendorName}: ${confirmData.reference || ""}`,
            createdAt: new Date(),
            postedAt: new Date(),
            idempotencyKey: `payout-${payoutId}`,
            xeroSyncStatus: {
                synced: false,
                syncedAt: null,
                xeroLineItemId: null,
                syncError: null
            }
        };

        batch.set(db.collection(LEDGER_ENTRIES_COLLECTION).doc(entryId), ledgerEntry);

        await batch.commit();
    }

    /**
     * Marks a payout as failed
     * 
     * @param {string} payoutId - Payout ID
     * @param {string} reason - Failure reason
     * @returns {Promise<void>}
     */
    async function failPayout(payoutId, reason, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const payoutDoc = await db.collection(PAYOUTS_COLLECTION).doc(payoutId).get();
        if (!payoutDoc.exists) {
            throw new Error("Payout not found");
        }

        await db.collection(PAYOUTS_COLLECTION).doc(payoutId).update({
            status: "failed",
            failureReason: reason || "Unknown error",
            processedAt: new Date()
        });
    }

    /**
     * Gets payouts for a batch
     * 
     * @param {string} batchId - Batch ID
     * @returns {Promise<object[]>}
     */
    async function getPayoutsForBatch(batchId, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const snapshot = await db
            .collection(PAYOUTS_COLLECTION)
            .where("batchId", "==", batchId)
            .get();

        return snapshot.docs.map(doc => doc.data());
    }

    /**
     * Gets vendor's payout history
     * 
     * @param {string} vendorId - Vendor ID
     * @param {number} limit - Number of results
     * @returns {Promise<object[]>}
     */
    async function getVendorPayoutHistory(vendorId, limit = 10, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const snapshot = await db
            .collection(PAYOUTS_COLLECTION)
            .where("vendorId", "==", vendorId)
            .where("status", "==", "completed")
            .orderBy("completedAt", "desc")
            .limit(limit)
            .get();

        return snapshot.docs.map(doc => doc.data());
    }

    /**
     * Calculates projected payout for vendor
     * 
     * @param {string} vendorId - Vendor ID
     * @returns {Promise<object>}
     */
    async function getProjectedPayout(vendorId, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const vendorDoc = await db.collection(VENDOR_BALANCES_COLLECTION).doc(vendorId).get();
        if (!vendorDoc.exists) {
            throw new Error("Vendor not found");
        }

        const vendor = vendorDoc.data();

        return {
            vendorId,
            vendorName: vendor.vendorName,
            currentBalance: vendor.balance,
            totalEarned: vendor.totalEarned,
            totalPaid: vendor.totalPaid,
            lastPayoutDate: vendor.lastPayoutAt,
            nextPayoutEligible: vendor.balance >= 100 // Minimum payout amount
        };
    }

    /**
     * Gets batch status summary
     * 
     * @param {string} batchId - Batch ID
     * @returns {Promise<object>}
     */
    async function getBatchSummary(batchId, explicitDb) {
        const db = resolveDb(explicitDb);
        if (!db) throw new Error("Database not configured");

        const batchDoc = await db.collection(PAYOUT_BATCHES_COLLECTION).doc(batchId).get();
        if (!batchDoc.exists) {
            throw new Error("Batch not found");
        }

        const batch = batchDoc.data();
        const payouts = await getPayoutsForBatch(batchId, db);

        const summary = {
            batchId: batch.batchId,
            status: batch.status,
            totalAmount: batch.totalAmount,
            payoutCount: batch.payoutCount,
            createdAt: batch.createdAt,
            completedAt: batch.completedAt,
            payoutStatuses: {
                pending: 0,
                processing: 0,
                completed: 0,
                failed: 0
            }
        };

        payouts.forEach(payout => {
            if (payout.status in summary.payoutStatuses) {
                summary.payoutStatuses[payout.status]++;
            }
        });

        return summary;
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
        createPayoutBatch,
        getPayoutBatch,
        getPayout,
        confirmPayout,
        failPayout,
        getPayoutsForBatch,
        getVendorPayoutHistory,
        getProjectedPayout,
        getBatchSummary
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else if (typeof globalScope !== "undefined") {
        globalScope.payoutSystem = api;
    }
})(typeof window !== "undefined" ? window : global);
