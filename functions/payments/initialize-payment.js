"use strict";

const { createPaystackClient } = require("./paystack-client.js");
const paymentStatus = require("../shared/payments/payment-status.js");
const paymentModel = require("../shared/payments/payment-model.js");
const paymentValidation = require("../shared/payments/payment-validation.js");
const paymentService = require("../shared/payments/payment-service.js");

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function createInitializeResult(success, details = {}) {
    const safeDetails = details && typeof details === "object" ? details : {};

    return {
        success: success === true,
        provider: "paystack",
        ...safeDetails
    };
}

function createInitializeError(code, message, details = {}) {
    const safeDetails = details && typeof details === "object" ? details : {};

    return {
        code: normalizeText(code) || "payments/initialize-failed",
        message: normalizeText(message) || "Unable to initialize payment.",
        ...safeDetails
    };
}

function normalizePaystackInitializeData(response) {
    const safeResponse = response && typeof response === "object" ? response : {};
    const data = safeResponse.data && typeof safeResponse.data === "object"
        ? safeResponse.data
        : safeResponse;

    return {
        authorizationUrl: normalizeText(data.authorization_url || data.authorizationUrl),
        accessCode: normalizeText(data.access_code || data.accessCode),
        reference: normalizeText(data.reference),
        raw: safeResponse
    };
}

function getCallbackUrl(options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};

    return normalizeText(
        safeOptions.callbackUrl ||
        safeOptions.callbackURL ||
        (
            typeof process !== "undefined" && process.env
                ? process.env.PAYSTACK_CALLBACK_URL
                : ""
        )
    );
}

function getPaymentServiceOptions(options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};

    return {
        ...safeOptions,
        callbackUrl: getCallbackUrl(safeOptions),
        paymentStatus: safeOptions.paymentStatus || paymentStatus,
        paymentModel: safeOptions.paymentModel || paymentModel,
        paymentValidation: safeOptions.paymentValidation || paymentValidation
    };
}

async function initializePayment(order, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const serviceOptions = getPaymentServiceOptions(safeOptions);
    const preparedResult = paymentService.prepareInitializePayment(order, serviceOptions);

    if (!preparedResult.success) {
        return createInitializeResult(false, {
            ...preparedResult,
            payment: preparedResult.payment || null,
            payload: preparedResult.payload || null,
            error: preparedResult.error
        });
    }

    const client = safeOptions.client || createPaystackClient(safeOptions.clientOptions);

    if (!client || typeof client.initializeTransaction !== "function") {
        return createInitializeResult(false, {
            payment: preparedResult.payment,
            payload: preparedResult.payload,
            error: createInitializeError(
                "payments/paystack-client-unavailable",
                "Paystack client is required before initializing payment."
            )
        });
    }

    try {
        const paystackResponse = await client.initializeTransaction(preparedResult.payload);
        const initializeData = normalizePaystackInitializeData(paystackResponse);

        if (!initializeData.authorizationUrl || !initializeData.accessCode || !initializeData.reference) {
            return createInitializeResult(false, {
                payment: preparedResult.payment,
                payload: preparedResult.payload,
                paystackResponse,
                error: createInitializeError(
                    "payments/invalid-paystack-initialize-response",
                    "Paystack did not return a usable authorization URL, access code, and reference."
                )
            });
        }

        const appliedResult = paymentService.applyInitializedPayment(
            preparedResult.payment,
            initializeData,
            serviceOptions
        );

        if (!appliedResult.success) {
            return createInitializeResult(false, {
                payment: preparedResult.payment,
                payload: preparedResult.payload,
                paystackResponse,
                error: appliedResult.error
            });
        }

        return createInitializeResult(true, {
            payment: appliedResult.payment,
            patch: appliedResult.patch,
            payload: preparedResult.payload,
            authorizationUrl: initializeData.authorizationUrl,
            accessCode: initializeData.accessCode,
            reference: initializeData.reference,
            paystackResponse
        });
    } catch (error) {
        return createInitializeResult(false, {
            payment: preparedResult.payment,
            payload: preparedResult.payload,
            error: createInitializeError(
                error && error.code ? error.code : "payments/paystack-initialize-failed",
                error && error.message ? error.message : "Paystack payment initialization failed.",
                {
                    cause: error || null
                }
            )
        });
    }
}

module.exports = initializePayment;
module.exports.normalizeText = normalizeText;
module.exports.createInitializeResult = createInitializeResult;
module.exports.createInitializeError = createInitializeError;
module.exports.normalizePaystackInitializeData = normalizePaystackInitializeData;
module.exports.getCallbackUrl = getCallbackUrl;
module.exports.getPaymentServiceOptions = getPaymentServiceOptions;
