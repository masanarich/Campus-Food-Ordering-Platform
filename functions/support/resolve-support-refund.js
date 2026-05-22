"use strict";

const refundPaymentService = require("../payments/refund-payment.js");
// Mirrored from public/shared/support/ at deploy time by scripts/sync-shared-support.js
// (wired via firebase.json predeploy). Cloud Functions only ships the functions/ folder,
// so reaching up into ../../public would crash the container on cold start.
const ticketService = require("../shared/support/ticket-service.js");

const SUPPORT_TICKETS_COLLECTION = "supportTickets";
const ORDERS_COLLECTION = "orders";
const USERS_COLLECTION = "users";

function optionalRequire(moduleName) {
    try {
        return require(moduleName);
    } catch (error) {
        return null;
    }
}

const firebaseAdmin = optionalRequire("firebase-admin");

class LocalHttpsError extends Error {
    constructor(code, message, details) {
        super(message);
        this.name = "HttpsError";
        this.code = code;
        this.details = details;
    }
}

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeLowerText(value) {
    return normalizeText(value).toLowerCase();
}

function normalizeNumber(value, fallbackValue = 0) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : fallbackValue;
}

function normalizeCurrencyAmount(value, fallbackValue = 0) {
    return Math.max(0, Math.round((normalizeNumber(value, fallbackValue) + Number.EPSILON) * 100) / 100);
}

function normalizeCallableData(request) {
    const safeRequest = request && typeof request === "object" ? request : {};
    return safeRequest.data && typeof safeRequest.data === "object"
        ? safeRequest.data
        : {};
}

function normalizeAuthContext(request) {
    const safeRequest = request && typeof request === "object" ? request : {};
    const auth = safeRequest.auth && typeof safeRequest.auth === "object"
        ? safeRequest.auth
        : null;

    if (!auth) {
        return {
            uid: "",
            token: {}
        };
    }

    return {
        uid: typeof auth.uid === "string" ? auth.uid : "",
        token: auth.token && typeof auth.token === "object" ? auth.token : {}
    };
}

function createCallableError(code, message, details, explicitFactory) {
    if (typeof explicitFactory === "function") {
        return explicitFactory(code, message, details);
    }

    return new LocalHttpsError(code, message, details);
}

function sanitizeForCallable(value) {
    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            code: value.code || ""
        };
    }

    if (Array.isArray(value)) {
        return value.map(sanitizeForCallable);
    }

    if (value && typeof value === "object") {
        return Object.keys(value).reduce(function sanitizeObject(result, key) {
            if (key !== "cause") {
                result[key] = sanitizeForCallable(value[key]);
            }

            return result;
        }, {});
    }

    return value;
}

function resolveAdminFirestore(explicitDb) {
    if (explicitDb && typeof explicitDb.collection === "function") {
        return explicitDb;
    }

    if (!firebaseAdmin || typeof firebaseAdmin.firestore !== "function") {
        return null;
    }

    try {
        firebaseAdmin.app();
    } catch (error) {
        return null;
    }

    return firebaseAdmin.firestore();
}

function createAdminFirestoreFns() {
    return {
        collection(db, ...segments) {
            if (!db || typeof db.collection !== "function" || segments.length === 0) {
                return null;
            }

            let ref = db.collection(segments[0]);

            for (let index = 1; index < segments.length; index += 2) {
                const docId = segments[index];
                const nextCollection = segments[index + 1];
                ref = ref.doc(docId);

                if (nextCollection) {
                    ref = ref.collection(nextCollection);
                }
            }

            return ref;
        },
        doc(dbOrCollection, ...segments) {
            if (!dbOrCollection) {
                return null;
            }

            if (segments.length === 0 && typeof dbOrCollection.doc === "function") {
                return dbOrCollection.doc();
            }

            if (typeof dbOrCollection.collection === "function" && segments.length >= 2) {
                let ref = dbOrCollection.collection(segments[0]).doc(segments[1]);

                for (let index = 2; index < segments.length; index += 2) {
                    const collectionName = segments[index];
                    const docId = segments[index + 1];

                    if (collectionName && docId) {
                        ref = ref.collection(collectionName).doc(docId);
                    }
                }

                return ref;
            }

            if (typeof dbOrCollection.doc === "function" && segments.length === 1) {
                return dbOrCollection.doc(segments[0]);
            }

            return null;
        },
        async updateDoc(docRef, patch) {
            return docRef.update(patch);
        },
        async setDoc(docRef, patch, options) {
            return docRef.set(patch, options);
        }
    };
}

function snapshotToRecord(snapshot, id) {
    if (!snapshot || snapshot.exists === false) {
        return null;
    }

    const data = typeof snapshot.data === "function" ? snapshot.data() : {};
    const safeData = data && typeof data === "object" ? data : {};
    const recordId = normalizeText(id || snapshot.id);

    return {
        ...(recordId ? { id: recordId } : {}),
        ...safeData
    };
}

async function fetchAdminDocument(collectionName, documentId, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const safeCollection = normalizeText(collectionName);
    const safeDocumentId = normalizeText(documentId);

    if (!safeCollection || !safeDocumentId) {
        return null;
    }

    const readerName = `${safeCollection}Reader`;
    if (typeof safeOptions[readerName] === "function") {
        return safeOptions[readerName](safeDocumentId, safeOptions);
    }

    const db = resolveAdminFirestore(safeOptions.adminDb);

    if (!db) {
        return null;
    }

    const snapshot = await db.collection(safeCollection).doc(safeDocumentId).get();
    return snapshotToRecord(snapshot, safeDocumentId);
}

async function fetchUserRecord(uid, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const safeUid = normalizeText(uid);

    if (!safeUid) {
        return null;
    }

    if (typeof safeOptions.userReader === "function") {
        return safeOptions.userReader(safeUid, safeOptions);
    }

    return fetchAdminDocument(USERS_COLLECTION, safeUid, safeOptions);
}

async function isCallableAdmin(auth, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const safeAuth = auth && typeof auth === "object" ? auth : {};
    const token = safeAuth.token && typeof safeAuth.token === "object" ? safeAuth.token : {};

    if (!normalizeText(safeAuth.uid)) {
        return false;
    }

    if (token.isAdmin === true || token.admin === true || token.role === "admin") {
        return true;
    }

    if (typeof safeOptions.adminAuthorizer === "function") {
        return safeOptions.adminAuthorizer(safeAuth, safeOptions) === true;
    }

    const userRecord = await fetchUserRecord(safeAuth.uid, safeOptions);

    return Boolean(
        userRecord &&
        userRecord.isAdmin === true &&
        normalizeLowerText(userRecord.accountStatus || "active") === "active"
    );
}

async function fetchSupportTicket(ticketId, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const safeTicketId = normalizeText(ticketId);

    if (!safeTicketId) {
        return null;
    }

    if (typeof safeOptions.supportTicketReader === "function") {
        return safeOptions.supportTicketReader(safeTicketId, safeOptions);
    }

    const ticket = await fetchAdminDocument(SUPPORT_TICKETS_COLLECTION, safeTicketId, safeOptions);

    return ticket ? { ticketId: safeTicketId, ...ticket } : null;
}

async function fetchOrderRecord(orderId, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const safeOrderId = normalizeText(orderId);

    if (!safeOrderId) {
        return null;
    }

    if (typeof safeOptions.orderReader === "function") {
        return safeOptions.orderReader(safeOrderId, safeOptions);
    }

    const order = await fetchAdminDocument(ORDERS_COLLECTION, safeOrderId, safeOptions);

    return order ? { orderId: safeOrderId, ...order } : null;
}

function getRefundCaseFromTicket(ticketRecord) {
    const safeTicket = ticketRecord && typeof ticketRecord === "object" ? ticketRecord : {};

    return safeTicket.refundCase && typeof safeTicket.refundCase === "object"
        ? safeTicket.refundCase
        : {};
}

function buildSupportRefundPaymentOptions(ticketRecord, orderRecord, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const safeTicket = ticketRecord && typeof ticketRecord === "object" ? ticketRecord : {};
    const safeOrder = orderRecord && typeof orderRecord === "object" ? orderRecord : {};
    const refundCase = getRefundCaseFromTicket(safeTicket);
    const timestamp = safeOptions.timestampValue !== undefined
        ? safeOptions.timestampValue
        : safeOptions.now !== undefined
            ? safeOptions.now
            : new Date().toISOString();

    return {
        ...safeOptions.paymentOptions,
        reference: safeOrder.paymentReference || refundCase.paymentReference,
        paymentReference: safeOrder.paymentReference || refundCase.paymentReference,
        refundAmount: refundCase.amount,
        refundAmountInMinorUnits: refundCase.amountInMinorUnits,
        amount: refundCase.amount,
        amountInMinorUnits: refundCase.amountInMinorUnits,
        reason: refundCase.reason,
        refundReason: refundCase.reason,
        customerNote:
            safeOptions.customerNote ||
            refundCase.customerNote ||
            "Your payment is being refunded after support reviewed this order.",
        metadata: {
            ...(safeOptions.metadata && typeof safeOptions.metadata === "object" ? safeOptions.metadata : {}),
            ticketId: normalizeText(safeTicket.ticketId),
            orderId: normalizeText(safeOrder.orderId || safeTicket.orderId),
            customerUid: normalizeText(safeOrder.customerUid || safeTicket.customerUid),
            vendorUid: normalizeText(safeOrder.vendorUid || safeTicket.vendorUid),
            refundCaseStatus: normalizeText(refundCase.status)
        },
        requestedAt: timestamp,
        updatedAt: timestamp,
        timestampValue: timestamp,
        actorUid: normalizeText(safeOptions.actorUid),
        auth: safeOptions.auth
    };
}

function buildSupportRefundOrderPatch(refundPatch, refundCase) {
    const safePatch = refundPatch && typeof refundPatch === "object" ? refundPatch : {};
    const safeCase = refundCase && typeof refundCase === "object" ? refundCase : {};
    const impact = safeCase.impact && typeof safeCase.impact === "object" ? safeCase.impact : {};

    return {
        ...safePatch,
        supportRefundTicketId: normalizeText(safeCase.ticketId),
        supportRefundCaseStatus: normalizeText(safeCase.status),
        supportRefundCustomerDecision: normalizeText(safeCase.customerDecision),
        supportRefundVendorDecision: normalizeText(safeCase.vendorDecision),
        supportRefundVendorDeduction: normalizeCurrencyAmount(impact.vendorDeduction),
        supportRefundPlatformDeduction: normalizeCurrencyAmount(impact.platformDeduction)
    };
}

function createSupportRefundFailure(code, message, details = {}) {
    const safeDetails = details && typeof details === "object" ? details : {};

    return {
        success: false,
        error: {
            code: normalizeText(code) || "support-refunds/failed",
            message: normalizeText(message) || "Support refund could not be executed.",
            ...safeDetails
        }
    };
}

async function executeApprovedSupportRefund(input = {}, dependencies = {}) {
    const safeInput = input && typeof input === "object" ? input : {};
    const safeDependencies = dependencies && typeof dependencies === "object" ? dependencies : {};
    const supportTickets = safeDependencies.ticketService || ticketService;
    const refundPayment = typeof safeDependencies.refundPayment === "function"
        ? safeDependencies.refundPayment
        : refundPaymentService;
    const writeOrderPaymentPatch = typeof safeDependencies.writeOrderPaymentPatch === "function"
        ? safeDependencies.writeOrderPaymentPatch
        : null;
    const timestamp = safeInput.timestampValue !== undefined
        ? safeInput.timestampValue
        : safeInput.now !== undefined
            ? safeInput.now
            : new Date().toISOString();
    const adminDb = resolveAdminFirestore(safeDependencies.adminDb);
    const firestoreFns = safeDependencies.firestoreFns || createAdminFirestoreFns();
    const ticketId = normalizeText(safeInput.ticketId);

    if (!ticketId) {
        return createSupportRefundFailure(
            "support-refunds/ticket-id-required",
            "Ticket ID is required before executing a support refund."
        );
    }

    const ticket = safeInput.ticket && typeof safeInput.ticket === "object"
        ? safeInput.ticket
        : await fetchSupportTicket(ticketId, safeDependencies);

    if (!ticket) {
        return createSupportRefundFailure(
            "support-refunds/ticket-not-found",
            "The support ticket could not be found."
        );
    }

    const refundCase = getRefundCaseFromTicket(ticket);
    const orderId = normalizeText(safeInput.orderId || ticket.orderId || refundCase.orderId);
    const order = safeInput.order && typeof safeInput.order === "object"
        ? safeInput.order
        : await fetchOrderRecord(orderId, safeDependencies);

    if (!order) {
        return createSupportRefundFailure(
            "support-refunds/order-not-found",
            "The linked order could not be found."
        );
    }

    const sharedOptions = {
        ...safeDependencies,
        db: safeDependencies.db || adminDb,
        firestoreFns,
        order,
        actorUid: normalizeText(safeInput.actorUid),
        actorRole: "admin",
        actorName: normalizeText(safeInput.actorName || "Admin"),
        now: timestamp,
        timestampValue: timestamp
    };

    const processingResult = await supportTickets.markRefundProcessing({
        ...sharedOptions,
        ticket,
        execution: {
            ...(safeInput.execution || {}),
            status: "processing",
            actorRole: "admin",
            actorUid: sharedOptions.actorUid,
            actorName: sharedOptions.actorName,
            note: normalizeText(safeInput.note) || "Support refund sent to payment provider."
        }
    });

    if (!processingResult || processingResult.success !== true) {
        return createSupportRefundFailure(
            "support-refunds/processing-update-failed",
            "The refund case could not be marked as processing.",
            { details: sanitizeForCallable(processingResult || {}) }
        );
    }

    const paymentOptions = buildSupportRefundPaymentOptions(
        processingResult.ticket || ticket,
        order,
        {
            ...safeInput,
            auth: safeInput.auth,
            actorUid: sharedOptions.actorUid,
            timestampValue: timestamp
        }
    );
    const refundResult = await refundPayment(order, {
        ...paymentOptions,
        ...(safeDependencies.paymentOptions || {})
    });

    if (!refundResult || refundResult.success !== true) {
        const failureMessage = refundResult &&
            refundResult.error &&
            refundResult.error.message
            ? refundResult.error.message
            : "Payment provider did not complete the refund.";
        const failedTicketResult = await supportTickets.markRefundFailed({
            ...sharedOptions,
            ticket: processingResult.ticket,
            refundFailureReason: failureMessage,
            execution: {
                status: "failed",
                actorRole: "admin",
                actorUid: sharedOptions.actorUid,
                actorName: sharedOptions.actorName,
                refundFailureReason: failureMessage
            }
        });

        return createSupportRefundFailure(
            "support-refunds/provider-failed",
            failureMessage,
            {
                refundResult: sanitizeForCallable(refundResult || {}),
                ticketResult: sanitizeForCallable(failedTicketResult || {})
            }
        );
    }

    const completedRefundCase = {
        ...(processingResult.refundCase || {}),
        status: "refunded",
        refundId: refundResult.refund && refundResult.refund.refundId,
        refundReference: refundResult.refund && refundResult.refund.refundReference,
        refundPaymentReference: refundResult.refund && refundResult.refund.paymentReference
    };
    const completedRefundPatch = buildSupportRefundOrderPatch(
        refundResult.patch,
        completedRefundCase
    );
    const orderPatchResult = writeOrderPaymentPatch
        ? await writeOrderPaymentPatch(orderId, completedRefundPatch, safeDependencies)
        : await defaultWriteOrderPaymentPatch(orderId, completedRefundPatch, {
            adminDb,
            orderPaymentPatchWriter: safeDependencies.orderPaymentPatchWriter
        });

    if (!orderPatchResult.success) {
        const failedTicketResult = await supportTickets.markRefundFailed({
            ...sharedOptions,
            ticket: processingResult.ticket,
            refundFailureReason: "Refund provider succeeded, but the order refund record could not be saved.",
            execution: {
                status: "failed",
                actorRole: "admin",
                actorUid: sharedOptions.actorUid,
                actorName: sharedOptions.actorName,
                refundFailureReason: "Order refund patch failed."
            }
        });

        return createSupportRefundFailure(
            "support-refunds/order-patch-failed",
            "Refund provider succeeded, but the order refund record could not be saved.",
            {
                refundResult: sanitizeForCallable(refundResult),
                orderPatchResult: sanitizeForCallable(orderPatchResult),
                ticketResult: sanitizeForCallable(failedTicketResult || {})
            }
        );
    }

    const completedTicketResult = await supportTickets.markRefundCompleted({
        ...sharedOptions,
        ticket: processingResult.ticket,
        execution: {
            status: "refunded",
            success: true,
            actorRole: "admin",
            actorUid: sharedOptions.actorUid,
            actorName: sharedOptions.actorName,
            refundId: refundResult.refund && refundResult.refund.refundId,
            refundReference: refundResult.refund && refundResult.refund.refundReference,
            refundPaymentReference: refundResult.refund && refundResult.refund.paymentReference,
            refundProvider: refundResult.provider || "paystack",
            refundAmount: refundResult.refund && refundResult.refund.amount,
            refundAmountInMinorUnits: refundResult.refund && refundResult.refund.amountInMinorUnits,
            note: normalizeText(safeInput.completedNote) || "Support refund completed."
        }
    });

    if (!completedTicketResult || completedTicketResult.success !== true) {
        return createSupportRefundFailure(
            "support-refunds/completion-update-failed",
            "The refund was paid, but the ticket could not be marked completed.",
            {
                refundResult: sanitizeForCallable(refundResult),
                orderPatchResult: sanitizeForCallable(orderPatchResult),
                ticketResult: sanitizeForCallable(completedTicketResult || {})
            }
        );
    }

    return {
        success: true,
        ticketId,
        orderId,
        ticket: sanitizeForCallable(completedTicketResult.ticket),
        refundCase: sanitizeForCallable(completedTicketResult.refundCase),
        refund: sanitizeForCallable(refundResult.refund),
        refundResult: sanitizeForCallable(refundResult),
        orderPatchResult: sanitizeForCallable(orderPatchResult),
        processingResult: sanitizeForCallable(processingResult)
    };
}

async function defaultWriteOrderPaymentPatch(orderId, patch, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const safeOrderId = normalizeText(orderId);
    const safePatch = patch && typeof patch === "object" ? patch : {};

    if (!safeOrderId || Object.keys(safePatch).length === 0) {
        return {
            success: false,
            skipped: true,
            orderId: safeOrderId,
            patch: safePatch
        };
    }

    if (typeof safeOptions.orderPaymentPatchWriter === "function") {
        return safeOptions.orderPaymentPatchWriter(safeOrderId, safePatch);
    }

    const db = resolveAdminFirestore(safeOptions.adminDb);

    if (!db) {
        return {
            success: false,
            skipped: true,
            orderId: safeOrderId,
            patch: safePatch,
            error: {
                code: "payments/admin-db-unavailable",
                message: "Admin Firestore is not available to save the payment patch."
            }
        };
    }

    try {
        await db.collection(ORDERS_COLLECTION).doc(safeOrderId).update(safePatch);

        return {
            success: true,
            orderId: safeOrderId,
            patch: safePatch
        };
    } catch (error) {
        return {
            success: false,
            orderId: safeOrderId,
            patch: safePatch,
            error: sanitizeForCallable(error)
        };
    }
}

function assertSuccessfulSupportRefundResult(result, fallbackMessage, options = {}) {
    if (result && result.success === true) {
        return sanitizeForCallable(result);
    }

    const safeOptions = options && typeof options === "object" ? options : {};
    const error = result && result.error && typeof result.error === "object"
        ? result.error
        : {};

    throw createCallableError(
        "failed-precondition",
        error.message || fallbackMessage,
        sanitizeForCallable(result || {}),
        safeOptions.createCallableError
    );
}

function createExecuteSupportRefundHandler(dependencies = {}) {
    const safeDependencies = dependencies && typeof dependencies === "object" ? dependencies : {};
    const executor = typeof safeDependencies.executeApprovedSupportRefund === "function"
        ? safeDependencies.executeApprovedSupportRefund
        : executeApprovedSupportRefund;

    return async function executeSupportRefundHandler(request) {
        const data = normalizeCallableData(request);
        const auth = normalizeAuthContext(request);

        if (!auth.uid) {
            throw createCallableError(
                "unauthenticated",
                "You must be signed in as an admin to execute a support refund.",
                undefined,
                safeDependencies.createCallableError
            );
        }

        const adminAllowed = await isCallableAdmin(auth, safeDependencies);

        if (!adminAllowed) {
            throw createCallableError(
                "permission-denied",
                "Only active admins can execute support refunds.",
                undefined,
                safeDependencies.createCallableError
            );
        }

        const result = await executor({
            ...data,
            ticketId: data.ticketId,
            orderId: data.orderId,
            actorUid: auth.uid,
            actorName: data.actorName || auth.token.name || auth.token.email || "Admin",
            auth,
            timestampValue:
                data.timestampValue !== undefined
                    ? data.timestampValue
                    : data.options && data.options.timestampValue
        }, safeDependencies);

        return assertSuccessfulSupportRefundResult(
            result,
            "Support refund could not be executed.",
            safeDependencies
        );
    };
}

module.exports = {
    SUPPORT_TICKETS_COLLECTION,
    ORDERS_COLLECTION,
    USERS_COLLECTION,
    optionalRequire,
    LocalHttpsError,
    normalizeText,
    normalizeLowerText,
    normalizeNumber,
    normalizeCurrencyAmount,
    normalizeCallableData,
    normalizeAuthContext,
    createCallableError,
    sanitizeForCallable,
    resolveAdminFirestore,
    createAdminFirestoreFns,
    snapshotToRecord,
    fetchAdminDocument,
    fetchUserRecord,
    isCallableAdmin,
    fetchSupportTicket,
    fetchOrderRecord,
    getRefundCaseFromTicket,
    buildSupportRefundPaymentOptions,
    buildSupportRefundOrderPatch,
    createSupportRefundFailure,
    executeApprovedSupportRefund,
    defaultWriteOrderPaymentPatch,
    assertSuccessfulSupportRefundResult,
    createExecuteSupportRefundHandler
};
