"use strict";

const initializePaymentService = require("./payments/initialize-payment.js");
const verifyPaymentService = require("./payments/verify-payment.js");

const DEFAULT_REGION = "africa-south1";

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
        const callableResult = assertSuccessfulPaymentResult(
            result,
            "Payment could not be initialized."
        );

        return attachPersistedPaymentPatch(
            callableResult,
            data.order || {},
            safeDependencies
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
        const callableResult = assertSuccessfulPaymentResult(
            result,
            "Payment could not be verified."
        );

        return attachPersistedPaymentPatch(
            callableResult,
            payment,
            safeDependencies
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
    resolveOrderId,
    resolveAdminFirestore,
    writeOrderPaymentPatch,
    attachPersistedPaymentPatch,
    assertSuccessfulPaymentResult,
    createInitializePaymentHandler,
    createVerifyPaymentHandler,
    createPaymentFunctions,
    ...paymentFunctions
};
