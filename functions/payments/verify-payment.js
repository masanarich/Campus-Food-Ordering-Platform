"use strict";

const { createPaystackClient } = require("./paystack-client.js");
const paymentStatus = require("../shared/payments/payment-status.js");
const paymentModel = require("../shared/payments/payment-model.js");
const paymentValidation = require("../shared/payments/payment-validation.js");
const paymentService = require("../shared/payments/payment-service.js");

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeUpperText(value) {
    return normalizeText(value).toUpperCase();
}

function normalizeLowerText(value) {
    return normalizeText(value).toLowerCase();
}

function createVerifyResult(success, details = {}) {
    const safeDetails = details && typeof details === "object" ? details : {};

    return {
        success: success === true,
        provider: "paystack",
        ...safeDetails
    };
}

function createVerifyError(code, message, details = {}) {
    const safeDetails = details && typeof details === "object" ? details : {};

    return {
        code: normalizeText(code) || "payments/verify-failed",
        message: normalizeText(message) || "Unable to verify payment.",
        ...safeDetails
    };
}

function normalizePaystackVerifyData(response) {
    const safeResponse = response && typeof response === "object" ? response : {};
    const data = safeResponse.data && typeof safeResponse.data === "object"
        ? safeResponse.data
        : safeResponse;
    const paidAt = data.paid_at || data.paidAt || data.created_at || data.createdAt || null;

    return {
        status: normalizeText(data.status),
        reference: normalizeText(data.reference),
        amountInMinorUnits: Number.parseInt(data.amount, 10),
        currency: normalizeUpperText(data.currency || "ZAR"),
        paidAt,
        channel: normalizeText(data.channel),
        gatewayResponse: normalizeText(data.gateway_response || data.gatewayResponse),
        raw: safeResponse
    };
}

function getPaymentServiceOptions(options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};

    return {
        ...safeOptions,
        paymentStatus: safeOptions.paymentStatus || paymentStatus,
        paymentModel: safeOptions.paymentModel || paymentModel,
        paymentValidation: safeOptions.paymentValidation || paymentValidation
    };
}

function resolvePaymentReference(paymentValues, options = {}) {
    const safePayment = paymentValues && typeof paymentValues === "object" ? paymentValues : {};
    const safeOptions = options && typeof options === "object" ? options : {};

    return normalizeText(
        safeOptions.reference ||
        safeOptions.paymentReference ||
        safeOptions.transactionReference ||
        safePayment.reference ||
        safePayment.paymentReference ||
        safePayment.paystackReference ||
        safePayment.transactionReference
    );
}

function isSuccessfulPaystackVerification(verificationValues) {
    const safeVerification = verificationValues && typeof verificationValues === "object"
        ? verificationValues
        : {};
    const status = normalizeLowerText(safeVerification.status);

    return ["success", "successful", "paid"].indexOf(status) >= 0;
}

function getVerificationFailureReason(verificationValues) {
    const safeVerification = verificationValues && typeof verificationValues === "object"
        ? verificationValues
        : {};
    const gatewayResponse = normalizeText(
        safeVerification.gatewayResponse ||
        safeVerification.message ||
        safeVerification.reason
    );
    const status = normalizeLowerText(safeVerification.status);

    if (gatewayResponse) {
        return gatewayResponse;
    }

    if (status) {
        return `Paystack payment status: ${status}.`;
    }

    return "Paystack did not confirm this payment.";
}

function applyPaystackVerificationResult(paymentValues, verificationValues = {}, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const safePayment = paymentValues && typeof paymentValues === "object" ? paymentValues : {};
    const safeVerification = verificationValues && typeof verificationValues === "object"
        ? verificationValues
        : {};
    const serviceOptions = getPaymentServiceOptions(safeOptions);
    const reference = resolvePaymentReference(safePayment, safeOptions);
    const verification = {
        ...safeVerification,
        reference: normalizeText(safeVerification.reference) || reference
    };

    if (!isSuccessfulPaystackVerification(verification)) {
        const failedResult = paymentService.applyFailedPayment(
            {
                ...safePayment,
                reference
            },
            {
                reason: getVerificationFailureReason(verification),
                verification
            },
            serviceOptions
        );
        const failedDetails = failedResult && typeof failedResult === "object"
            ? { ...failedResult }
            : {};

        delete failedDetails.success;
        delete failedDetails.provider;

        return createVerifyResult(false, {
            ...failedDetails,
            paymentSucceeded: false,
            verification,
            reference,
            error: createVerifyError(
                "payments/payment-not-successful",
                "Paystack did not confirm this payment.",
                {
                    gatewayStatus: normalizeText(verification.status),
                    gatewayResponse: normalizeText(verification.gatewayResponse)
                }
            )
        });
    }

    const appliedResult = paymentService.applyVerifiedPayment(
        {
            ...safePayment,
            reference
        },
        verification,
        {
            ...serviceOptions,
            expectedReference: reference,
            paidAt: verification.paidAt || safeOptions.paidAt
        }
    );

    if (!appliedResult.success) {
        return createVerifyResult(false, {
            ...appliedResult,
            paymentSucceeded: false,
            verification,
            reference,
            error: appliedResult.error
        });
    }

    return createVerifyResult(true, {
        payment: appliedResult.payment,
        patch: appliedResult.patch,
        paymentSucceeded: true,
        verification: appliedResult.verification,
        reference
    });
}

async function verifyPayment(paymentValues, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const safePayment = paymentValues && typeof paymentValues === "object" ? paymentValues : {};
    const reference = resolvePaymentReference(safePayment, safeOptions);

    if (!reference) {
        return createVerifyResult(false, {
            payment: safePayment,
            reference: "",
            error: createVerifyError(
                "payments/missing-reference",
                "Payment reference is required before verifying payment."
            )
        });
    }

    const client = safeOptions.client || createPaystackClient(safeOptions.clientOptions);

    if (!client || typeof client.verifyTransaction !== "function") {
        return createVerifyResult(false, {
            payment: safePayment,
            reference,
            error: createVerifyError(
                "payments/paystack-client-unavailable",
                "Paystack client is required before verifying payment."
            )
        });
    }

    try {
        const paystackResponse = await client.verifyTransaction(reference);
        const normalizedVerification = normalizePaystackVerifyData(paystackResponse);
        const verification = {
            ...normalizedVerification,
            reference: normalizeText(normalizedVerification.reference) || reference
        };
        const appliedResult = applyPaystackVerificationResult(
            {
                ...safePayment,
                reference
            },
            verification,
            safeOptions
        );

        if (!appliedResult.success) {
            return createVerifyResult(false, {
                ...appliedResult,
                reference,
                paystackResponse,
                verification,
                error: appliedResult.error
            });
        }

        return createVerifyResult(true, {
            payment: appliedResult.payment,
            patch: appliedResult.patch,
            paymentSucceeded: appliedResult.paymentSucceeded,
            reference,
            verification: appliedResult.verification,
            paystackResponse
        });
    } catch (error) {
        return createVerifyResult(false, {
            payment: safePayment,
            reference,
            error: createVerifyError(
                error && error.code ? error.code : "payments/paystack-verify-failed",
                error && error.message ? error.message : "Paystack payment verification failed.",
                {
                    cause: error || null
                }
            )
        });
    }
}

module.exports = verifyPayment;
module.exports.normalizeText = normalizeText;
module.exports.normalizeUpperText = normalizeUpperText;
module.exports.normalizeLowerText = normalizeLowerText;
module.exports.createVerifyResult = createVerifyResult;
module.exports.createVerifyError = createVerifyError;
module.exports.normalizePaystackVerifyData = normalizePaystackVerifyData;
module.exports.getPaymentServiceOptions = getPaymentServiceOptions;
module.exports.resolvePaymentReference = resolvePaymentReference;
module.exports.isSuccessfulPaystackVerification = isSuccessfulPaystackVerification;
module.exports.getVerificationFailureReason = getVerificationFailureReason;
module.exports.applyPaystackVerificationResult = applyPaystackVerificationResult;
