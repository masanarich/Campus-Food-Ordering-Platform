/**
 * Cloud Functions for Payment System
 * Handles PayFast integration, ITN webhooks, ledger entries, payouts, and Xero sync
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();

// Configuration
const PLATFORM_CONFIG = {
    merchantId: process.env.PAYFAST_MERCHANT_ID || "",
    merchantKey: process.env.PAYFAST_MERCHANT_KEY || "",
    secretKey: process.env.PAYFAST_SECRET_KEY || "",
    mode: process.env.PAYFAST_MODE || "sandbox", // sandbox or live
    platformFeePercentage: parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || "0.1"),
    xeroClientId: process.env.XERO_CLIENT_ID || "",
    xeroTenantId: process.env.XERO_TENANT_ID || "",
    xeroRefreshToken: process.env.XERO_REFRESH_TOKEN || ""
};

const PAYFAST_URLS = {
    sandbox: "https://sandbox.payfast.co.za/eng/process",
    live: "https://www.payfast.co.za/eng/process"
};

const ENVIRONMENT = {
    mode: PLATFORM_CONFIG.mode === "live" ? "live" : "sandbox",
    payfastUrl: PAYFAST_URLS[PLATFORM_CONFIG.mode === "live" ? "live" : "sandbox"]
};

/**
 * Creates a PayFast payment signature using MD5
 */
function generatePayFastSignature(params, merchantKey) {
    const sortedKeys = Object.keys(params)
        .filter(key => params[key] !== null && params[key] !== undefined && params[key] !== "")
        .sort();

    const signatureString = sortedKeys
        .map(key => `${key}=${String(params[key]).trim()}`)
        .join("&");

    const signatureWithKey = `${signatureString}&merchant_key=${merchantKey}`;
    return crypto.createHash("md5").update(signatureWithKey).digest("hex");
}

/**
 * Validates a PayFast ITN signature
 */
function validatePayFastITNSignature(itnData, signature, merchantKey) {
    const validationParams = {
        merchant_id: itnData.merchant_id,
        pf_payment_id: itnData.pf_payment_id,
        payment_status: itnData.payment_status,
        amount_gross: itnData.amount_gross,
        amount_fee: itnData.amount_fee,
        amount_net: itnData.amount_net,
        custom_str1: itnData.custom_str1,
        custom_str2: itnData.custom_str2,
        custom_str3: itnData.custom_str3,
        custom_str4: itnData.custom_str4,
        custom_str5: itnData.custom_str5,
        item_name: itnData.item_name,
        item_description: itnData.item_description,
        name_first: itnData.name_first,
        name_last: itnData.name_last,
        email_address: itnData.email_address,
        merchant_key: merchantKey
    };

    const sortedKeys = Object.keys(validationParams)
        .filter(key => validationParams[key])
        .sort();

    const signatureString = sortedKeys
        .map(key => `${key}=${String(validationParams[key]).trim()}`)
        .join("&");

    const calculatedSignature = crypto.createHash("md5").update(signatureString).digest("hex");
    return calculatedSignature === signature;
}

/**
 * Cloud Function: Create PayFast Checkout
 * Generates a PayFast payment URL for an order
 * 
 * POST /createPayfastCheckout
 * Body: { orderId: string }
 */
exports.createPayfastCheckout = functions.https.onRequest(async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ error: "Order ID is required" });
        }

        // Get order from Firestore
        const orderRef = db.collection("orders").doc(orderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            return res.status(404).json({ error: "Order not found" });
        }

        const order = orderDoc.data();

        // Validate order is awaiting payment
        if (order.paymentStatus && order.paymentStatus !== "none" && order.paymentStatus !== "pending") {
            return res.status(400).json({ error: `Order already has status: ${order.paymentStatus}` });
        }

        // Calculate fees
        const platformFeeAmount = Math.ceil(order.total * PLATFORM_CONFIG.platformFeePercentage * 100) / 100;
        const amount = order.total;

        // Create payment record
        const paymentId = admin.firestore().collection("payments").doc().id;
        const idempotencyKey = crypto.randomUUID();

        const payment = {
            paymentId,
            orderId,
            customerId: order.customerId,
            amount: Number(amount),
            amountNet: 0,
            currency: "ZAR",
            paymentMethod: "payfast",
            paymentStatus: "pending",
            payFastPaymentId: null,
            idempotencyKey,
            createdAt: admin.firestore.Timestamp.now(),
            confirmedAt: null,
            completedAt: null,
            webhookEventIds: [],
            metadata: {
                ipAddress: req.ip || null,
                userAgent: req.get("user-agent") || null
            }
        };

        // Save payment record
        await db.collection("payments").doc(paymentId).set(payment);

        // Build PayFast parameters
        const payfastParams = {
            merchant_id: PLATFORM_CONFIG.merchantId,
            merchant_key: PLATFORM_CONFIG.merchantKey,
            return_url: `${req.protocol}://${req.get("host")}/order/${orderId}?payment=success`,
            cancel_url: `${req.protocol}://${req.get("host")}/order/${orderId}?payment=cancelled`,
            notify_url: `${req.protocol}://${req.get("host")}/.netlify/functions/handlePayfastITN`,
            name_first: order.customerName?.split(" ")[0] || "Customer",
            name_last: order.customerName?.split(" ").slice(1).join(" ") || "",
            email_address: order.customerEmail || "",
            item_name: `Campus Food Order #${orderId.substring(0, 8)}`,
            item_description: `Order for ${order.vendorNames?.join(", ") || "vendors"}`,
            amount: Number(amount).toFixed(2),
            custom_str1: orderId,
            custom_str2: paymentId,
            custom_str3: order.customerId,
            custom_str4: idempotencyKey
        };

        // Generate signature
        const signature = generatePayFastSignature(payfastParams, PLATFORM_CONFIG.merchantKey);
        payfastParams.signature = signature;

        // Build full PayFast URL
        const queryString = Object.keys(payfastParams)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(payfastParams[key]))}`)
            .join("&");

        const paymentUrl = `${ENVIRONMENT.payfastUrl}?${queryString}`;

        // Update payment with PayFast URL
        await db.collection("payments").doc(paymentId).update({
            paymentUrl,
            signature
        });

        res.json({
            paymentUrl,
            paymentId,
            idempotencyKey
        });
    } catch (error) {
        console.error("Error creating PayFast checkout:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Cloud Function: Handle PayFast ITN (Instant Transaction Notification)
 * Webhook endpoint for PayFast payment confirmations
 * 
 * POST /handlePayfastITN
 */
exports.handlePayfastITN = functions.https.onRequest(async (req, res) => {
    try {
        const itnData = req.body;

        console.log("ITN Received:", JSON.stringify(itnData, null, 2));

        // Validate signature
        const signature = itnData.signature;
        if (!validatePayFastITNSignature(itnData, signature, PLATFORM_CONFIG.merchantKey)) {
            console.error("Invalid ITN signature");
            return res.status(400).json({ error: "Invalid signature" });
        }

        // Extract key fields
        const orderId = itnData.custom_str1;
        const paymentId = itnData.custom_str2;
        const idempotencyKey = itnData.custom_str4;
        const payFastPaymentId = itnData.pf_payment_id;

        if (!orderId || !paymentId) {
            console.error("Missing order or payment ID in ITN");
            return res.status(400).json({ error: "Missing order or payment ID" });
        }

        // Check for duplicate ITN
        const existingEvent = await db
            .collection("webhookEvents")
            .where("idempotencyKey", "==", idempotencyKey)
            .where("processed", "==", true)
            .limit(1)
            .get();

        if (!existingEvent.empty) {
            console.log("Duplicate ITN detected, already processed");
            return res.json({ message: "Duplicate event, already processed" });
        }

        // Record webhook event
        const webhookEventId = admin.firestore().collection("webhookEvents").doc().id;
        const webhookEvent = {
            webhookEventId,
            source: "payfast",
            eventType: "payment_confirmation",
            rawPayload: itnData,
            paymentId,
            orderId,
            payFastPaymentId,
            processed: false,
            processedAt: null,
            idempotencyKey,
            receivedAt: admin.firestore.Timestamp.now(),
            ipAddress: req.ip || null,
            signature,
            signatureValid: true,
            metadata: {
                userAgent: req.get("user-agent") || null,
                retryCount: 0
            }
        };

        await db.collection("webhookEvents").doc(webhookEventId).set(webhookEvent);

        // Verify payment record exists
        const paymentDoc = await db.collection("payments").doc(paymentId).get();
        if (!paymentDoc.exists) {
            console.error(`Payment ${paymentId} not found`);
            await db.collection("webhookEvents").doc(webhookEventId).update({
                processed: true,
                processedAt: admin.firestore.Timestamp.now(),
                processingError: "Payment record not found"
            });
            return res.status(404).json({ error: "Payment not found" });
        }

        const payment = paymentDoc.data();

        // Verify order and amount
        const orderDoc = await db.collection("orders").doc(orderId).get();
        if (!orderDoc.exists) {
            console.error(`Order ${orderId} not found`);
            await db.collection("webhookEvents").doc(webhookEventId).update({
                processed: true,
                processedAt: admin.firestore.Timestamp.now(),
                processingError: "Order not found"
            });
            return res.status(404).json({ error: "Order not found" });
        }

        const order = orderDoc.data();
        const expectedAmount = parseFloat(order.total).toFixed(2);
        const receivedAmount = parseFloat(itnData.amount_gross).toFixed(2);

        if (expectedAmount !== receivedAmount) {
            console.error(`Amount mismatch. Expected: ${expectedAmount}, Got: ${receivedAmount}`);
            await db.collection("webhookEvents").doc(webhookEventId).update({
                processed: true,
                processedAt: admin.firestore.Timestamp.now(),
                processingError: `Amount mismatch: expected ${expectedAmount}, got ${receivedAmount}`
            });
            return res.status(400).json({ error: "Amount mismatch" });
        }

        // Process payment based on status
        if (itnData.payment_status === "COMPLETE") {
            await processSuccessfulPayment(orderId, paymentId, webhookEventId, itnData, order);
        } else if (itnData.payment_status === "FAILED") {
            await processFailedPayment(paymentId, webhookEventId, itnData);
        } else if (itnData.payment_status === "PENDING") {
            await processPendingPayment(paymentId, webhookEventId, itnData);
        }

        return res.json({ success: true });
    } catch (error) {
        console.error("Error handling PayFast ITN:", error);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * Process successful payment
 */
async function processSuccessfulPayment(orderId, paymentId, webhookEventId, itnData, order) {
    const batch = db.batch();

    // Update payment
    batch.update(db.collection("payments").doc(paymentId), {
        paymentStatus: "successful",
        payFastPaymentId: itnData.pf_payment_id,
        amountNet: parseFloat(itnData.amount_net) || 0,
        confirmedAt: admin.firestore.Timestamp.now(),
        webhookEventIds: admin.firestore.FieldValue.arrayUnion(webhookEventId)
    });

    // Update order
    batch.update(db.collection("orders").doc(orderId), {
        status: "paid",
        paymentStatus: "successful",
        paymentId,
        updatedAt: admin.firestore.Timestamp.now()
    });

    // Mark webhook as processed
    batch.update(db.collection("webhookEvents").doc(webhookEventId), {
        processed: true,
        processedAt: admin.firestore.Timestamp.now(),
        paymentId
    });

    // Create ledger entries
    const platformFeeAmount = Math.ceil(order.total * PLATFORM_CONFIG.platformFeePercentage * 100) / 100;
    const vendorShareTotal = order.total - platformFeeAmount;

    // Debit clearing account, credit platform fees
    const ledgerId1 = admin.firestore().collection("ledgerEntries").doc().id;
    batch.set(db.collection("ledgerEntries").doc(ledgerId1), {
        entryId: ledgerId1,
        debitAccount: "1000", // Clearing account
        creditAccount: "4100", // Platform fees revenue
        debitAmount: platformFeeAmount,
        creditAmount: platformFeeAmount,
        currency: "ZAR",
        entryType: "platform_fee",
        referenceId: paymentId,
        relatedPaymentId: paymentId,
        relatedOrderId: orderId,
        status: "posted",
        description: `Platform fee for order ${orderId}`,
        createdAt: admin.firestore.Timestamp.now(),
        idempotencyKey: `fee-${paymentId}`
    });

    // Debit clearing account, credit vendor payables
    const ledgerId2 = admin.firestore().collection("ledgerEntries").doc().id;
    batch.set(db.collection("ledgerEntries").doc(ledgerId2), {
        entryId: ledgerId2,
        debitAccount: "1000", // Clearing account
        creditAccount: "2100", // Vendor payables
        debitAmount: vendorShareTotal,
        creditAmount: vendorShareTotal,
        currency: "ZAR",
        entryType: "vendor_payable",
        referenceId: paymentId,
        relatedPaymentId: paymentId,
        relatedOrderId: orderId,
        status: "posted",
        description: `Vendor payable for order ${orderId}`,
        createdAt: admin.firestore.Timestamp.now(),
        idempotencyKey: `vendor-payable-${paymentId}`
    });

    // Update vendor balances (proportional share of order)
    if (order.vendorGroupings && Array.isArray(order.vendorGroupings)) {
        for (const vendorGroup of order.vendorGroupings) {
            const vendorId = vendorGroup.vendorUid;
            const vendorShare = vendorGroup.subtotal - (vendorGroup.subtotal / order.subtotal * platformFeeAmount);

            // Initialize vendor balance if not exists
            const vendorBalanceRef = db.collection("vendorBalances").doc(vendorId);
            const vendorBalanceDoc = await vendorBalanceRef.get();

            if (!vendorBalanceDoc.exists) {
                batch.set(vendorBalanceRef, {
                    vendorId,
                    vendorName: vendorGroup.vendorName,
                    currency: "ZAR",
                    balance: vendorShare,
                    totalPaid: 0,
                    totalEarned: vendorShare,
                    lastUpdated: admin.firestore.Timestamp.now()
                });
            } else {
                batch.update(vendorBalanceRef, {
                    balance: admin.firestore.FieldValue.increment(vendorShare),
                    totalEarned: admin.firestore.FieldValue.increment(vendorShare),
                    lastUpdated: admin.firestore.Timestamp.now()
                });
            }
        }
    }

    await batch.commit();

    // Async: Sync to Xero
    try {
        await syncToXero(orderId, paymentId, "payment");
    } catch (error) {
        console.error("Error syncing to Xero:", error);
        // Don't fail the payment if Xero sync fails
    }
}

/**
 * Process failed payment
 */
async function processFailedPayment(paymentId, webhookEventId, itnData) {
    const batch = db.batch();

    batch.update(db.collection("payments").doc(paymentId), {
        paymentStatus: "failed",
        payFastPaymentId: itnData.pf_payment_id,
        confirmedAt: admin.firestore.Timestamp.now(),
        webhookEventIds: admin.firestore.FieldValue.arrayUnion(webhookEventId)
    });

    batch.update(db.collection("webhookEvents").doc(webhookEventId), {
        processed: true,
        processedAt: admin.firestore.Timestamp.now(),
        paymentId
    });

    await batch.commit();
}

/**
 * Process pending payment
 */
async function processPendingPayment(paymentId, webhookEventId, itnData) {
    const batch = db.batch();

    batch.update(db.collection("payments").doc(paymentId), {
        paymentStatus: "pending",
        payFastPaymentId: itnData.pf_payment_id,
        webhookEventIds: admin.firestore.FieldValue.arrayUnion(webhookEventId)
    });

    batch.update(db.collection("webhookEvents").doc(webhookEventId), {
        processed: true,
        processedAt: admin.firestore.Timestamp.now(),
        paymentId
    });

    await batch.commit();
}

/**
 * Get Vendor Balance Cloud Function
 */
exports.getVendorBalance = functions.https.onRequest(async (req, res) => {
    try {
        const { vendorId } = req.query;

        if (!vendorId) {
            return res.status(400).json({ error: "Vendor ID is required" });
        }

        const vendorBalanceDoc = await db.collection("vendorBalances").doc(vendorId).get();

        if (!vendorBalanceDoc.exists) {
            return res.status(404).json({ error: "Vendor not found" });
        }

        res.json(vendorBalanceDoc.data());
    } catch (error) {
        console.error("Error getting vendor balance:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create Refund Cloud Function
 */
exports.createRefund = functions.https.onRequest(async (req, res) => {
    try {
        const { orderId, reason, amount } = req.body;

        if (!orderId || !reason) {
            return res.status(400).json({ error: "Order ID and reason are required" });
        }

        // Get order and payment
        const orderDoc = await db.collection("orders").doc(orderId).get();
        if (!orderDoc.exists) {
            return res.status(404).json({ error: "Order not found" });
        }

        const order = orderDoc.data();
        const paymentId = order.paymentId;

        const paymentDoc = await db.collection("payments").doc(paymentId).get();
        if (!paymentDoc.exists) {
            return res.status(404).json({ error: "Payment not found" });
        }

        const payment = paymentDoc.data();

        const refundAmount = amount || payment.amount;

        // Create refund record
        const refundId = admin.firestore().collection("refunds").doc().id;
        const refund = {
            refundId,
            paymentId,
            orderId,
            amount: refundAmount,
            reason: reason || "Manual refund",
            status: "requested",
            requestedBy: req.user?.uid || "system",
            approvedBy: null,
            processedBy: null,
            requestedAt: admin.firestore.Timestamp.now(),
            approvedAt: null,
            processedAt: null,
            reversingLedgerEntryIds: []
        };

        await db.collection("refunds").doc(refundId).set(refund);

        res.json({ refundId, message: "Refund request created" });
    } catch (error) {
        console.error("Error creating refund:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Run Payout Batch Cloud Function
 * Creates payouts for all vendors with pending balances
 */
exports.runPayoutBatch = functions.https.onRequest(async (req, res) => {
    try {
        // Get all vendors with balance > 0
        const vendorsSnapshot = await db
            .collection("vendorBalances")
            .where("balance", ">", 0)
            .get();

        if (vendorsSnapshot.empty) {
            return res.json({ message: "No vendors with pending balance" });
        }

        const batchId = admin.firestore().collection("payoutBatches").doc().id;
        const payoutIds = [];
        const batch = db.batch();

        for (const vendorDoc of vendorsSnapshot.docs) {
            const vendor = vendorDoc.data();
            const payoutId = admin.firestore().collection("payouts").doc().id;

            const payout = {
                payoutId,
                batchId,
                vendorId: vendor.vendorId,
                vendorName: vendor.vendorName,
                amount: vendor.balance,
                currency: vendor.currency,
                status: "pending",
                payoutMethod: "manual",
                createdAt: admin.firestore.Timestamp.now(),
                processedAt: null,
                completedAt: null
            };

            batch.set(db.collection("payouts").doc(payoutId), payout);
            payoutIds.push(payoutId);
        }

        // Create batch record
        const payoutBatch = {
            batchId,
            status: "pending",
            totalAmount: vendorsSnapshot.docs.reduce((sum, doc) => sum + doc.data().balance, 0),
            currency: "ZAR",
            payoutIds,
            payoutCount: payoutIds.length,
            vendorCount: vendorsSnapshot.size,
            createdAt: admin.firestore.Timestamp.now(),
            processedBy: req.user?.uid || "system"
        };

        batch.set(db.collection("payoutBatches").doc(batchId), payoutBatch);

        await batch.commit();

        res.json({
            batchId,
            payoutCount: payoutIds.length,
            totalAmount: payoutBatch.totalAmount
        });
    } catch (error) {
        console.error("Error running payout batch:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Sync to Xero Cloud Function
 * Records payments and invoices in Xero
 */
async function syncToXero(orderId, paymentId, syncType) {
    try {
        // Implementation depends on Xero API setup
        // This is a placeholder that shows the structure
        console.log(`Syncing ${syncType} for order ${orderId} to Xero`);

        // In production, you would:
        // 1. Get Xero access token
        // 2. Create/update contact
        // 3. Create invoice
        // 4. Record payment
        // 5. Update mapping in Firestore

        const mapping = {
            mappingId: admin.firestore().collection("xeroMappings").doc().id,
            source: "order",
            sourceId: orderId,
            xeroEntityType: "Invoice",
            status: "pending",
            syncedAt: admin.firestore.Timestamp.now()
        };

        await db.collection("xeroMappings").doc(mapping.mappingId).set(mapping);
    } catch (error) {
        console.error("Error syncing to Xero:", error);
        throw error;
    }
}

// Export all functions
module.exports = {
    createPayfastCheckout: exports.createPayfastCheckout,
    handlePayfastITN: exports.handlePayfastITN,
    getVendorBalance: exports.getVendorBalance,
    createRefund: exports.createRefund,
    runPayoutBatch: exports.runPayoutBatch
};
