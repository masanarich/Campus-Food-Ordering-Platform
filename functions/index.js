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

        return assertSuccessfulPaymentResult(
            result,
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

        return assertSuccessfulPaymentResult(
            result,
            "Payment could not be verified."
        );
    };
}

function createPaymentFunctions(options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const onCall = resolveOnCall(safeOptions.onCall);
    const triggerOptions = {
        region: safeOptions.region || DEFAULT_REGION,
        cors: safeOptions.cors !== undefined ? safeOptions.cors : true
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
    assertSuccessfulPaymentResult,
    createInitializePaymentHandler,
    createVerifyPaymentHandler,
    createPaymentFunctions,
    ...paymentFunctions
};
