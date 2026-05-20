"use strict";

const initializePaymentService = require("./payments/initialize-payment.js");
const verifyPaymentService = require("./payments/verify-payment.js");
const refundPaymentService = require("./payments/refund-payment.js");

const DEFAULT_REGION = "africa-south1";
const CHECKOUTS_COLLECTION = "checkoutSessions";
const ORDERS_COLLECTION = "orders";

function optionalRequire(moduleName) {
    try {
        return require(moduleName);
    } catch (error) {
        return null;
    }
}

const httpsFunctions = optionalRequire("firebase-functions/v2/https");
const firebaseAdmin = optionalRequire("firebase-admin");

if (firebaseAdmin && typeof firebaseAdmin.initializeApp === "function" && process.env.FIREBASE_CONFIG) {
    try {
        firebaseAdmin.app();
    } catch (error) {
        try {
            firebaseAdmin.initializeApp();
        } catch (initError) {
            // Admin SDK initialization failed - downstream callers will treat it as unavailable.
        }
    }
}

class LocalHttpsError extends Error {
    constructor(code, message, details) {
        super(message);
        this.name = "HttpsError";
        this.code = code;
        this.details = details;
    }
}

const HttpsError = httpsFunctions && typeof httpsFunctions.HttpsError === "function"
    ? httpsFunctions.HttpsError
    : LocalHttpsError;

function createLocalCallable(options, handler) {
    const callable = async function localCallable(request) {
        return handler(request || {});
    };

    callable.__isLocalCallable = true;
    callable.__triggerOptions = options;

    return callable;
}

function resolveOnCall(explicitOnCall) {
    if (typeof explicitOnCall === "function") {
        return explicitOnCall;
    }

    if (httpsFunctions && typeof httpsFunctions.onCall === "function") {
        return httpsFunctions.onCall;
    }

    return createLocalCallable;
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

function createCallableError(code, message, details) {
    return new HttpsError(code, message, details);
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

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeLowerText(value) {
    return normalizeText(value).toLowerCase();
}

function normalizeUpperText(value) {
    return normalizeText(value).toUpperCase();
}

function normalizeNumber(value, fallbackValue = 0) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : fallbackValue;
}

function normalizePositiveInteger(value, fallbackValue = 0) {
    const parsed = Number.parseInt(value, 10);

    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallbackValue;
}

function resolveOrderId(value, fallbackValue) {
    const safeValue = value && typeof value === "object" ? value : {};
    const safeFallback = fallbackValue && typeof fallbackValue === "object" ? fallbackValue : {};

    return normalizeText(
        safeValue.orderId ||
        safeValue.id ||
        safeValue.paymentOrderId ||
        safeFallback.orderId ||
        safeFallback.id
    );
}

function resolveCheckoutId(value, fallbackValue) {
    const safeValue = value && typeof value === "object" ? value : {};
    const safeFallback = fallbackValue && typeof fallbackValue === "object" ? fallbackValue : {};

    return normalizeText(
        safeValue.checkoutId ||
        safeValue.sessionId ||
        safeValue.id ||
        safeFallback.checkoutId ||
        safeFallback.sessionId ||
        safeFallback.id
    );
}

function createOrderIdFromCheckout(checkoutRecord, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const checkout = checkoutRecord && typeof checkoutRecord === "object" ? checkoutRecord : {};
    const explicitOrderId = normalizeText(
        safeOptions.orderId ||
        checkout.convertedOrderId ||
        checkout.orderId
    );

    if (explicitOrderId) {
        return explicitOrderId;
    }

    if (typeof safeOptions.orderIdFactory === "function") {
        const factoryOrderId = normalizeText(safeOptions.orderIdFactory(checkout));

        if (factoryOrderId) {
            return factoryOrderId;
        }
    }

    const checkoutId = resolveCheckoutId(checkout, safeOptions);
    return checkoutId ? `order-${checkoutId}` : `order-${Date.now()}`;
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

function buildCheckoutConversionPatch(orderId, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const convertedAt = safeOptions.convertedAt !== undefined
        ? safeOptions.convertedAt
        : safeOptions.timestampValue !== undefined
            ? safeOptions.timestampValue
            : new Date().toISOString();

    return {
        status: "converted",
        convertedOrderId: normalizeText(orderId),
        convertedAt,
        updatedAt: safeOptions.updatedAt !== undefined ? safeOptions.updatedAt : convertedAt
    };
}

function normalizeCheckoutItem(item) {
    const safeItem = item && typeof item === "object" ? item : {};
    const quantity = normalizePositiveInteger(safeItem.quantity, 1) || 1;
    const price = normalizeNumber(
        safeItem.price !== undefined ? safeItem.price : safeItem.unitPrice,
        0
    );
    const lineTotal = normalizeNumber(
        safeItem.lineTotal !== undefined ? safeItem.lineTotal : safeItem.total,
        price * quantity
    );

    return {
        ...safeItem,
        itemId: normalizeText(safeItem.itemId || safeItem.menuItemId || safeItem.id),
        name: normalizeText(safeItem.name || safeItem.itemName || safeItem.title),
        vendorUid: normalizeText(safeItem.vendorUid),
        vendorName: normalizeText(safeItem.vendorName),
        quantity,
        price,
        unitPrice: normalizeNumber(safeItem.unitPrice, price),
        lineTotal
    };
}

function normalizeCheckoutItems(items) {
    return Array.isArray(items) ? items.map(normalizeCheckoutItem) : [];
}

function calculateCheckoutSubtotal(items) {
    return normalizeCheckoutItems(items).reduce(function sumItems(total, item) {
        return total + normalizeNumber(item.lineTotal, item.price * item.quantity);
    }, 0);
}

function buildOrderFromCheckoutSession(checkoutRecord, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const checkout = checkoutRecord && typeof checkoutRecord === "object" ? checkoutRecord : {};
    const orderId = createOrderIdFromCheckout(checkout, safeOptions);
    const checkoutId = resolveCheckoutId(checkout, safeOptions);
    const timestamp = safeOptions.orderCreatedAt !== undefined
        ? safeOptions.orderCreatedAt
        : safeOptions.timestampValue !== undefined
            ? safeOptions.timestampValue
            : new Date().toISOString();
    const items = normalizeCheckoutItems(checkout.items || checkout.cartItems);
    const subtotal = normalizeNumber(checkout.subtotal, calculateCheckoutSubtotal(items));
    const total = normalizeNumber(
        checkout.total !== undefined ? checkout.total : checkout.totalAmount,
        subtotal
    );
    const paymentAmount = normalizeNumber(checkout.paymentAmount, total);
    const paymentAmountInMinorUnits = normalizePositiveInteger(
        checkout.paymentAmountInMinorUnits !== undefined
            ? checkout.paymentAmountInMinorUnits
            : checkout.paymentAmountMinor,
        Math.round(paymentAmount * 100)
    );

    return {
        orderId,
        checkoutId,
        customerUid: normalizeText(checkout.customerUid),
        customerName: normalizeText(checkout.customerName),
        customerEmail: normalizeText(checkout.customerEmail),
        vendorUid: normalizeText(checkout.vendorUid),
        vendorName: normalizeText(checkout.vendorName),
        items,
        itemCount: normalizePositiveInteger(checkout.itemCount, items.length),
        subtotal,
        total,
        totalAmount: total,
        status: normalizeText(safeOptions.orderStatus) || "pending",
        paymentStatus: "paid",
        paymentProvider: normalizeLowerText(checkout.paymentProvider || checkout.provider) || "paystack",
        paymentReference: normalizeText(
            checkout.paymentReference ||
            checkout.reference ||
            checkout.paystackReference
        ),
        paymentAccessCode: normalizeText(checkout.paymentAccessCode || checkout.accessCode),
        paymentAuthorizationUrl: normalizeText(
            checkout.paymentAuthorizationUrl ||
            checkout.authorizationUrl ||
            checkout.paymentUrl
        ),
        paymentAmount,
        paymentAmountInMinorUnits,
        paymentCurrency: normalizeUpperText(checkout.paymentCurrency || checkout.currency) || "ZAR",
        paymentPaidAt: checkout.paymentPaidAt || checkout.paidAt || timestamp,
        paymentVerifiedAt: checkout.paymentVerifiedAt || checkout.verifiedAt || timestamp,
        paymentFailureReason: "",
        refundStatus: normalizeText(checkout.refundStatus),
        refundReference: normalizeText(checkout.refundReference),
        notes: normalizeText(checkout.notes || checkout.note),
        metadata: checkout.metadata && typeof checkout.metadata === "object" ? { ...checkout.metadata } : {},
        createdAt: timestamp,
        updatedAt: safeOptions.orderUpdatedAt !== undefined ? safeOptions.orderUpdatedAt : timestamp,
        timeline: [
            {
                status: "pending",
                actorRole: "system",
                actorUid: normalizeText(safeOptions.actorUid),
                actorName: "System",
                note: "Paid checkout converted into an order.",
                at: timestamp
            }
        ]
    };
}

function isCheckoutPaid(checkoutRecord) {
    const checkout = checkoutRecord && typeof checkoutRecord === "object" ? checkoutRecord : {};
    const status = normalizeLowerText(checkout.status || checkout.checkoutStatus);
    const paymentStatus = normalizeLowerText(checkout.paymentStatus || checkout.paymentState);

    return status === "paid" || paymentStatus === "paid";
}

function isCheckoutConverted(checkoutRecord) {
    const checkout = checkoutRecord && typeof checkoutRecord === "object" ? checkoutRecord : {};

    return normalizeLowerText(checkout.status || checkout.checkoutStatus) === "converted" &&
        Boolean(normalizeText(checkout.convertedOrderId || checkout.orderId));
}

async function fetchCheckoutSession(checkoutId, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const safeCheckoutId = normalizeText(checkoutId);

    if (!safeCheckoutId) {
        return null;
    }

    if (typeof safeOptions.checkoutSessionReader === "function") {
        return safeOptions.checkoutSessionReader(safeCheckoutId, safeOptions);
    }

    const db = resolveAdminFirestore(safeOptions.adminDb);

    if (!db) {
        return null;
    }

    const snapshot = await db.collection(CHECKOUTS_COLLECTION).doc(safeCheckoutId).get();

    if (!snapshot || snapshot.exists === false) {
        return null;
    }

    const snapshotData = typeof snapshot.data === "function" ? snapshot.data() : {};

    return {
        checkoutId: safeCheckoutId,
        id: safeCheckoutId,
        ...(snapshotData && typeof snapshotData === "object" ? snapshotData : {})
    };
}

async function resolveCheckoutForConversion(checkoutRecord, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const fallbackCheckout = checkoutRecord && typeof checkoutRecord === "object" ? checkoutRecord : {};
    const checkoutId = resolveCheckoutId(fallbackCheckout, safeOptions);
    const fetchedCheckout = await fetchCheckoutSession(checkoutId, safeOptions);

    return fetchedCheckout || fallbackCheckout;
}

async function writeOrderPaymentPatch(orderId, patch, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const safeOrderId = normalizeText(orderId);
    const safePatch = patch && typeof patch === "object" ? patch : {};
    const patchKeys = Object.keys(safePatch);

    if (!safeOrderId || patchKeys.length === 0) {
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
        await db.collection("orders").doc(safeOrderId).update(safePatch);

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

async function persistCheckoutOrderConversion(checkoutRecord, order, checkoutPatch, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const checkout = checkoutRecord && typeof checkoutRecord === "object" ? checkoutRecord : {};
    const safeOrder = order && typeof order === "object" ? order : {};
    const safePatch = checkoutPatch && typeof checkoutPatch === "object" ? checkoutPatch : {};
    const checkoutId = resolveCheckoutId(checkout, safeOptions);
    const orderId = resolveOrderId(safeOrder, safeOptions);

    if (!checkoutId || !orderId) {
        return {
            success: false,
            skipped: true,
            checkoutId,
            orderId,
            order: safeOrder,
            checkoutPatch: safePatch,
            error: {
                code: "checkout/conversion-missing-id",
                message: "Checkout ID and order ID are required to convert checkout into an order."
            }
        };
    }

    if (typeof safeOptions.checkoutOrderConverter === "function") {
        return safeOptions.checkoutOrderConverter(checkout, safeOrder, safePatch, safeOptions);
    }

    const db = resolveAdminFirestore(safeOptions.adminDb);

    if (!db) {
        return {
            success: false,
            skipped: true,
            checkoutId,
            orderId,
            order: safeOrder,
            checkoutPatch: safePatch,
            error: {
                code: "checkout/admin-db-unavailable",
                message: "Admin Firestore is not available to convert checkout into an order."
            }
        };
    }

    const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
    const checkoutRef = db.collection(CHECKOUTS_COLLECTION).doc(checkoutId);

    try {
        if (typeof db.runTransaction === "function") {
            await db.runTransaction(async function writeConversionTransaction(transaction) {
                transaction.set(orderRef, safeOrder);
                transaction.update(checkoutRef, safePatch);
            });
        } else {
            await orderRef.set(safeOrder);
            await checkoutRef.update(safePatch);
        }

        return {
            success: true,
            checkoutId,
            orderId,
            order: safeOrder,
            checkoutPatch: safePatch
        };
    } catch (error) {
        return {
            success: false,
            checkoutId,
            orderId,
            order: safeOrder,
            checkoutPatch: safePatch,
            error: sanitizeForCallable(error)
        };
    }
}

async function convertCheckoutToOrder(checkoutRecord, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const checkout = await resolveCheckoutForConversion(checkoutRecord, safeOptions);
    const checkoutId = resolveCheckoutId(checkout, safeOptions);

    if (!checkoutId) {
        return {
            success: false,
            checkout,
            error: {
                code: "checkout/id-required",
                message: "Checkout ID is required to convert checkout into an order."
            }
        };
    }

    if (isCheckoutConverted(checkout)) {
        const orderId = resolveOrderId(checkout, {
            orderId: checkout.convertedOrderId
        });

        return {
            success: true,
            skipped: true,
            alreadyConverted: true,
            checkoutId,
            orderId,
            checkout
        };
    }

    if (!isCheckoutPaid(checkout)) {
        return {
            success: false,
            checkoutId,
            checkout,
            error: {
                code: "checkout/not-paid",
                message: "Only paid checkout sessions can be converted into orders."
            }
        };
    }

    const order = buildOrderFromCheckoutSession(checkout, safeOptions);
    const checkoutPatch = buildCheckoutConversionPatch(order.orderId, safeOptions);
    const persistResult = await persistCheckoutOrderConversion(
        checkout,
        order,
        checkoutPatch,
        safeOptions
    );

    if (!persistResult.success) {
        return persistResult;
    }

    return {
        ...persistResult,
        checkout: {
            ...checkout,
            ...checkoutPatch
        }
    };
}

async function attachPersistedPaymentPatch(callableResult, fallbackOrder, dependencies = {}) {
    const safeResult = callableResult && typeof callableResult === "object" ? callableResult : {};
    const orderId = resolveOrderId(safeResult.payment, fallbackOrder);
    const patchResult = await writeOrderPaymentPatch(orderId, safeResult.patch, dependencies);

    if (patchResult.success) {
        return {
            ...safeResult,
            patchResult: sanitizeForCallable(patchResult)
        };
    }

    return safeResult;
}

async function persistThenAssertPaymentResult(result, fallbackOrder, dependencies, fallbackMessage) {
    const resultWithPatch = await attachPersistedPaymentPatch(
        result,
        fallbackOrder,
        dependencies
    );

    return assertSuccessfulPaymentResult(resultWithPatch, fallbackMessage);
}

function assertSuccessfulPaymentResult(result, fallbackMessage) {
    if (result && result.success === true) {
        return sanitizeForCallable(result);
    }

    const error = result && result.error && typeof result.error === "object"
        ? result.error
        : {};

    throw createCallableError(
        "failed-precondition",
        error.message || fallbackMessage,
        sanitizeForCallable(result || {})
    );
}

function createInitializePaymentHandler(dependencies = {}) {
    const safeDependencies = dependencies && typeof dependencies === "object" ? dependencies : {};
    const initializePayment = typeof safeDependencies.initializePayment === "function"
        ? safeDependencies.initializePayment
        : initializePaymentService;

    return async function initializePaymentHandler(request) {
        const data = normalizeCallableData(request);
        const auth = normalizeAuthContext(request);
        const result = await initializePayment(data.order || {}, {
            ...data.options,
            actorUid: auth.uid,
            auth
        });

        return persistThenAssertPaymentResult(
            result,
            data.order || {},
            safeDependencies,
            "Payment could not be initialized."
        );
    };
}

function createVerifyPaymentHandler(dependencies = {}) {
    const safeDependencies = dependencies && typeof dependencies === "object" ? dependencies : {};
    const verifyPayment = typeof safeDependencies.verifyPayment === "function"
        ? safeDependencies.verifyPayment
        : verifyPaymentService;

    return async function verifyPaymentHandler(request) {
        const data = normalizeCallableData(request);
        const auth = normalizeAuthContext(request);
        const payment = data.payment && typeof data.payment === "object"
            ? data.payment
            : {};
        const result = await verifyPayment(payment, {
            ...data.options,
            reference: data.reference,
            actorUid: auth.uid,
            auth
        });

        return persistThenAssertPaymentResult(
            result,
            payment,
            safeDependencies,
            "Payment could not be verified."
        );
    };
}

function createRefundPaymentHandler(dependencies = {}) {
    const safeDependencies = dependencies && typeof dependencies === "object" ? dependencies : {};
    const refundPayment = typeof safeDependencies.refundPayment === "function"
        ? safeDependencies.refundPayment
        : refundPaymentService;

    return async function refundPaymentHandler(request) {
        const data = normalizeCallableData(request);
        const auth = normalizeAuthContext(request);
        const payment = data.payment && typeof data.payment === "object"
            ? data.payment
            : data.order && typeof data.order === "object"
                ? data.order
                : {};
        const result = await refundPayment(payment, {
            ...data.options,
            reference: data.reference,
            paymentReference: data.paymentReference,
            refundAmount: data.refundAmount,
            refundAmountInMinorUnits: data.refundAmountInMinorUnits,
            amount: data.amount,
            amountInMinorUnits: data.amountInMinorUnits,
            reason: data.reason,
            refundReason: data.refundReason,
            customerNote: data.customerNote,
            metadata: data.metadata,
            actorUid: auth.uid,
            auth
        });

        return persistThenAssertPaymentResult(
            result,
            payment,
            safeDependencies,
            "Payment could not be refunded."
        );
    };
}

function createConvertCheckoutToOrderHandler(dependencies = {}) {
    const safeDependencies = dependencies && typeof dependencies === "object" ? dependencies : {};
    const converter = typeof safeDependencies.convertCheckoutToOrder === "function"
        ? safeDependencies.convertCheckoutToOrder
        : convertCheckoutToOrder;

    return async function convertCheckoutToOrderHandler(request) {
        const data = normalizeCallableData(request);
        const auth = normalizeAuthContext(request);
        const checkout = data.checkout && typeof data.checkout === "object"
            ? data.checkout
            : {};
        const result = await converter(checkout, {
            ...data.options,
            checkoutId: data.checkoutId || data.sessionId,
            orderId: data.orderId,
            actorUid: auth.uid,
            auth,
            ...safeDependencies
        });

        return assertSuccessfulPaymentResult(
            result,
            "Checkout could not be converted into an order."
        );
    };
}

function createPaymentFunctions(options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const onCall = resolveOnCall(safeOptions.onCall);
    const triggerOptions = {
        region: safeOptions.region || DEFAULT_REGION,
        cors: safeOptions.cors !== undefined ? safeOptions.cors : true,
        invoker: safeOptions.invoker || "public"
    };

    return {
        initializePayment: onCall(
            triggerOptions,
            createInitializePaymentHandler(safeOptions.dependencies)
        ),
        verifyPayment: onCall(
            triggerOptions,
            createVerifyPaymentHandler(safeOptions.dependencies)
        ),
        refundPayment: onCall(
            triggerOptions,
            createRefundPaymentHandler(safeOptions.dependencies)
        ),
        convertCheckoutToOrder: onCall(
            triggerOptions,
            createConvertCheckoutToOrderHandler(safeOptions.dependencies)
        )
    };
}

const paymentFunctions = createPaymentFunctions();

module.exports = {
    DEFAULT_REGION,
    optionalRequire,
    HttpsError,
    createLocalCallable,
    resolveOnCall,
    normalizeCallableData,
    normalizeAuthContext,
    createCallableError,
    sanitizeForCallable,
    normalizeText,
    normalizeLowerText,
    normalizeUpperText,
    normalizeNumber,
    normalizePositiveInteger,
    resolveOrderId,
    resolveCheckoutId,
    createOrderIdFromCheckout,
    resolveAdminFirestore,
    buildCheckoutConversionPatch,
    normalizeCheckoutItem,
    normalizeCheckoutItems,
    calculateCheckoutSubtotal,
    buildOrderFromCheckoutSession,
    isCheckoutPaid,
    isCheckoutConverted,
    fetchCheckoutSession,
    resolveCheckoutForConversion,
    writeOrderPaymentPatch,
    persistCheckoutOrderConversion,
    convertCheckoutSessionToOrder: convertCheckoutToOrder,
    attachPersistedPaymentPatch,
    persistThenAssertPaymentResult,
    assertSuccessfulPaymentResult,
    createInitializePaymentHandler,
    createVerifyPaymentHandler,
    createRefundPaymentHandler,
    createConvertCheckoutToOrderHandler,
    createPaymentFunctions,
    ...paymentFunctions
};
