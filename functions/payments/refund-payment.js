"use strict";

const { createPaystackClient } = require("./paystack-client.js");

const MODULE_NAME = "refund-payment";
const DEFAULT_PROVIDER = "paystack";
const DEFAULT_CURRENCY = "ZAR";
const REFUND_STATUSES = Object.freeze({
    NOT_REQUESTED: "not_requested",
    REQUESTED: "requested",
    PROCESSING: "processing",
    REFUNDED: "refunded",
    FAILED: "failed",
    CANCELLED: "cancelled"
});

const REFUND_STATUS_ALIASES = Object.freeze({
    none: REFUND_STATUSES.NOT_REQUESTED,
    no: REFUND_STATUSES.NOT_REQUESTED,
    norefund: REFUND_STATUSES.NOT_REQUESTED,
    notrequested: REFUND_STATUSES.NOT_REQUESTED,

    requested: REFUND_STATUSES.REQUESTED,
    request: REFUND_STATUSES.REQUESTED,
    refundrequested: REFUND_STATUSES.REQUESTED,
    queued: REFUND_STATUSES.REQUESTED,

    processing: REFUND_STATUSES.PROCESSING,
    inprogress: REFUND_STATUSES.PROCESSING,
    submitted: REFUND_STATUSES.PROCESSING,
    initiated: REFUND_STATUSES.PROCESSING,
    pending: REFUND_STATUSES.PROCESSING,
    refundpending: REFUND_STATUSES.PROCESSING,
    providerprocessing: REFUND_STATUSES.PROCESSING,

    refunded: REFUND_STATUSES.REFUNDED,
    processed: REFUND_STATUSES.REFUNDED,
    success: REFUND_STATUSES.REFUNDED,
    successful: REFUND_STATUSES.REFUNDED,
    complete: REFUND_STATUSES.REFUNDED,
    completed: REFUND_STATUSES.REFUNDED,

    failed: REFUND_STATUSES.FAILED,
    failure: REFUND_STATUSES.FAILED,
    declined: REFUND_STATUSES.FAILED,
    rejected: REFUND_STATUSES.FAILED,
    error: REFUND_STATUSES.FAILED,

    cancelled: REFUND_STATUSES.CANCELLED,
    canceled: REFUND_STATUSES.CANCELLED,
    void: REFUND_STATUSES.CANCELLED,
    voided: REFUND_STATUSES.CANCELLED
});

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeLowerText(value) {
    return normalizeText(value).toLowerCase();
}

function normalizeUpperText(value) {
    return normalizeText(value).toUpperCase();
}

function normalizeStatusKey(value) {
    return normalizeLowerText(value).replace(/[\s_-]+/g, "");
}

function normalizeRefundStatus(status, fallbackStatus) {
    const statusKey = normalizeStatusKey(status);
    const fallbackKey = normalizeStatusKey(fallbackStatus);

    if (Object.prototype.hasOwnProperty.call(REFUND_STATUS_ALIASES, statusKey)) {
        return REFUND_STATUS_ALIASES[statusKey];
    }

    if (Object.prototype.hasOwnProperty.call(REFUND_STATUS_ALIASES, fallbackKey)) {
        return REFUND_STATUS_ALIASES[fallbackKey];
    }

    return "";
}

function isRefundActive(status) {
    const normalizedStatus = normalizeRefundStatus(status);

    return normalizedStatus === REFUND_STATUSES.REQUESTED ||
        normalizedStatus === REFUND_STATUSES.PROCESSING;
}

function isRefundAlreadyCompleted(status) {
    return normalizeRefundStatus(status) === REFUND_STATUSES.REFUNDED;
}

function normalizeCurrencyAmount(value, fallbackValue) {
    const parsed = Number.parseFloat(value);
    const fallbackParsed = Number.parseFloat(fallbackValue);

    if (Number.isFinite(parsed)) {
        return Math.max(0, Math.round((parsed + Number.EPSILON) * 100) / 100);
    }

    if (Number.isFinite(fallbackParsed)) {
        return Math.max(0, Math.round((fallbackParsed + Number.EPSILON) * 100) / 100);
    }

    return 0;
}

function normalizeAmountInMinorUnits(value, fallbackValue) {
    const parsed = Number.parseInt(value, 10);
    const fallbackParsed = Number.parseInt(fallbackValue, 10);

    if (Number.isFinite(parsed)) {
        return Math.max(0, parsed);
    }

    if (Number.isFinite(fallbackParsed)) {
        return Math.max(0, fallbackParsed);
    }

    return 0;
}

function amountToMinorUnits(amount) {
    return Math.round(normalizeCurrencyAmount(amount) * 100);
}

function createRefundResult(success, details = {}) {
    const safeDetails = details && typeof details === "object" ? details : {};

    return {
        success: success === true,
        provider: DEFAULT_PROVIDER,
        ...safeDetails
    };
}

function createRefundError(code, message, details = {}) {
    const safeDetails = details && typeof details === "object" ? details : {};

    return {
        code: normalizeText(code) || "payments/refund-failed",
        message: normalizeText(message) || "Unable to refund payment.",
        ...safeDetails
    };
}

function resolveTimestampValue(options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};

    if (safeOptions.timestampValue !== undefined) {
        return safeOptions.timestampValue;
    }

    if (typeof safeOptions.nowFactory === "function") {
        return safeOptions.nowFactory();
    }

    if (safeOptions.now !== undefined) {
        return safeOptions.now;
    }

    return new Date().toISOString();
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

function resolvePaymentStatus(paymentValues) {
    const safePayment = paymentValues && typeof paymentValues === "object" ? paymentValues : {};

    return normalizeLowerText(safePayment.status || safePayment.paymentStatus);
}

function resolveExistingRefundStatus(paymentValues) {
    const safePayment = paymentValues && typeof paymentValues === "object" ? paymentValues : {};

    return normalizeRefundStatus(
        safePayment.refundStatus ||
        safePayment.paymentRefundStatus ||
        safePayment.refundState
    );
}

function resolveRefundReason(paymentValues, options = {}) {
    const safePayment = paymentValues && typeof paymentValues === "object" ? paymentValues : {};
    const safeOptions = options && typeof options === "object" ? options : {};

    return normalizeText(
        safeOptions.reason ||
        safeOptions.refundReason ||
        safeOptions.merchantNote ||
        safePayment.refundReason ||
        "Customer must be refunded for a paid order that cannot be fulfilled."
    );
}

function resolveRefundCurrency(paymentValues, options = {}) {
    const safePayment = paymentValues && typeof paymentValues === "object" ? paymentValues : {};
    const safeOptions = options && typeof options === "object" ? options : {};

    return normalizeUpperText(
        safeOptions.currency ||
        safeOptions.refundCurrency ||
        safePayment.currency ||
        safePayment.paymentCurrency ||
        DEFAULT_CURRENCY
    ) || DEFAULT_CURRENCY;
}

function resolveRefundAmountInMinorUnits(paymentValues, options = {}) {
    const safePayment = paymentValues && typeof paymentValues === "object" ? paymentValues : {};
    const safeOptions = options && typeof options === "object" ? options : {};
    const explicitMinor = safeOptions.amountInMinorUnits !== undefined
        ? safeOptions.amountInMinorUnits
        : safeOptions.refundAmountInMinorUnits;
    const explicitAmount = safeOptions.amount !== undefined
        ? safeOptions.amount
        : safeOptions.refundAmount;
    const paymentMinor = safePayment.amountInMinorUnits !== undefined
        ? safePayment.amountInMinorUnits
        : safePayment.paymentAmountInMinorUnits;
    const paymentAmount = safePayment.amount !== undefined
        ? safePayment.amount
        : safePayment.paymentAmount;

    if (explicitMinor !== undefined) {
        return normalizeAmountInMinorUnits(explicitMinor);
    }

    if (explicitAmount !== undefined) {
        return amountToMinorUnits(explicitAmount);
    }

    if (paymentMinor !== undefined) {
        return normalizeAmountInMinorUnits(paymentMinor);
    }

    return amountToMinorUnits(paymentAmount);
}

function normalizePaystackRefundData(response) {
    const safeResponse = response && typeof response === "object" ? response : {};
    const data = safeResponse.data && typeof safeResponse.data === "object"
        ? safeResponse.data
        : safeResponse;
    const transaction = data.transaction && typeof data.transaction === "object"
        ? data.transaction
        : {};
    const amountInMinorUnits = normalizeAmountInMinorUnits(data.amount);
    const status = normalizeRefundStatus(data.status, REFUND_STATUSES.PROCESSING);

    return {
        refundId: normalizeText(data.id !== undefined && data.id !== null ? String(data.id) : data.refundId),
        refundReference: normalizeText(data.reference || data.refundReference),
        paymentReference: normalizeText(
            data.transaction_reference ||
            data.transactionReference ||
            transaction.reference
        ),
        status: status || REFUND_STATUSES.PROCESSING,
        amount: normalizeCurrencyAmount(amountInMinorUnits / 100),
        amountInMinorUnits,
        currency: normalizeUpperText(data.currency || transaction.currency || DEFAULT_CURRENCY),
        refundedAt: data.refunded_at || data.refundedAt || data.created_at || data.createdAt || null,
        raw: safeResponse
    };
}

function buildRefundPayload(paymentValues, options = {}) {
    const safePayment = paymentValues && typeof paymentValues === "object" ? paymentValues : {};
    const safeOptions = options && typeof options === "object" ? options : {};
    const reference = resolvePaymentReference(safePayment, safeOptions);
    const amountInMinorUnits = resolveRefundAmountInMinorUnits(safePayment, safeOptions);
    const currency = resolveRefundCurrency(safePayment, safeOptions);
    const reason = resolveRefundReason(safePayment, safeOptions);
    const customerNote = normalizeText(
        safeOptions.customerNote ||
        safeOptions.customer_note ||
        "Your payment is being refunded because this order cannot be fulfilled."
    );

    return {
        transaction: reference,
        amount: amountInMinorUnits,
        currency,
        merchant_note: reason,
        customer_note: customerNote,
        metadata: {
            ...(safePayment.metadata && typeof safePayment.metadata === "object" ? safePayment.metadata : {}),
            ...(safeOptions.metadata && typeof safeOptions.metadata === "object" ? safeOptions.metadata : {}),
            orderId: normalizeText(safeOptions.orderId || safePayment.orderId || safePayment.paymentOrderId),
            checkoutId: normalizeText(safeOptions.checkoutId || safePayment.checkoutId),
            customerUid: normalizeText(safeOptions.customerUid || safePayment.customerUid),
            vendorUid: normalizeText(safeOptions.vendorUid || safePayment.vendorUid),
            reason
        }
    };
}

function validateRefundInput(paymentValues, options = {}) {
    const safePayment = paymentValues && typeof paymentValues === "object" ? paymentValues : {};
    const safeOptions = options && typeof options === "object" ? options : {};
    const errors = {};
    const reference = resolvePaymentReference(safePayment, safeOptions);
    const amountInMinorUnits = resolveRefundAmountInMinorUnits(safePayment, safeOptions);
    const originalAmountInMinorUnits = normalizeAmountInMinorUnits(
        safePayment.amountInMinorUnits,
        safePayment.paymentAmountInMinorUnits
    ) || amountToMinorUnits(safePayment.amount || safePayment.paymentAmount);
    const status = resolvePaymentStatus(safePayment);
    const paidStatuses = ["paid", "success", "successful", "verified", "complete", "completed"];
    const reason = resolveRefundReason(safePayment, safeOptions);
    const existingRefundStatus = resolveExistingRefundStatus(safePayment);

    if (!reference) {
        errors.reference = "Payment reference is required before refunding payment.";
    }

    if (amountInMinorUnits <= 0) {
        errors.amount = "Refund amount must be greater than zero.";
    }

    if (
        safeOptions.allowOverRefund !== true &&
        originalAmountInMinorUnits > 0 &&
        amountInMinorUnits > originalAmountInMinorUnits
    ) {
        errors.amount = "Refund amount cannot be greater than the paid amount.";
    }

    if (safeOptions.allowNonPaid !== true && paidStatuses.indexOf(status) === -1) {
        errors.status = "Only paid payments can be refunded.";
    }

    if (safeOptions.allowExistingRefund !== true && isRefundAlreadyCompleted(existingRefundStatus)) {
        errors.refundStatus = "This payment has already been refunded.";
    }

    if (safeOptions.allowExistingRefund !== true && isRefundActive(existingRefundStatus)) {
        errors.refundStatus = "A refund is already active for this payment.";
    }

    if (safeOptions.requireReason === true && !reason) {
        errors.reason = "Refund reason is required.";
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
        value: {
            reference,
            status,
            amountInMinorUnits,
            amount: normalizeCurrencyAmount(amountInMinorUnits / 100),
            currency: resolveRefundCurrency(safePayment, safeOptions),
            existingRefundStatus,
            reason
        }
    };
}

async function callPaystackRefund(client, payload) {
    if (client && typeof client.refundTransaction === "function") {
        return client.refundTransaction(payload);
    }

    if (client && typeof client.createRefund === "function") {
        return client.createRefund(payload);
    }

    if (client && typeof client.refund === "function") {
        return client.refund(payload);
    }

    if (client && typeof client.request === "function") {
        return client.request("/refund", {
            method: "POST",
            payload
        });
    }

    return null;
}

function isGeneratedPaymentReference(reference) {
    const safeReference = normalizeLowerText(reference);

    return Boolean(safeReference) &&
        (
            safeReference.indexOf("-generated") >= 0 ||
            safeReference.indexOf("generated-") >= 0
        );
}

function createSimulatedRefundData(paymentValues, options = {}) {
    const safePayment = paymentValues && typeof paymentValues === "object" ? paymentValues : {};
    const safeOptions = options && typeof options === "object" ? options : {};
    const reference = resolvePaymentReference(safePayment, safeOptions);
    const amountInMinorUnits = resolveRefundAmountInMinorUnits(safePayment, safeOptions);
    const refundedAt = resolveTimestampValue(safeOptions);

    return {
        refundId: `simulated-refund-${reference || Date.now()}`,
        refundReference: `refund-${reference || Date.now()}`,
        paymentReference: reference,
        status: REFUND_STATUSES.REFUNDED,
        amount: normalizeCurrencyAmount(amountInMinorUnits / 100),
        amountInMinorUnits,
        currency: resolveRefundCurrency(safePayment, safeOptions),
        refundedAt,
        raw: {
            simulated: true,
            reason: "Generated test payment reference refunded without contacting Paystack."
        }
    };
}

function createRefundPatch(paymentValues, refundData, options = {}) {
    const safePayment = paymentValues && typeof paymentValues === "object" ? paymentValues : {};
    const safeOptions = options && typeof options === "object" ? options : {};
    const requestedAt = safeOptions.requestedAt !== undefined
        ? safeOptions.requestedAt
        : resolveTimestampValue(safeOptions);
    const reason = resolveRefundReason(safePayment, safeOptions);
    const normalizedRefundStatus = normalizeRefundStatus(refundData.status, REFUND_STATUSES.PROCESSING);
    const patch = {
        paymentStatus: normalizeLowerText(safePayment.paymentStatus || safePayment.status) || "paid",
        refundStatus: normalizedRefundStatus,
        refundProvider: DEFAULT_PROVIDER,
        refundReference: normalizeText(refundData.refundReference),
        refundId: normalizeText(refundData.refundId),
        refundPaymentReference: normalizeText(refundData.paymentReference || resolvePaymentReference(safePayment, safeOptions)),
        refundAmount: normalizeCurrencyAmount(refundData.amount),
        refundAmountInMinorUnits: normalizeAmountInMinorUnits(refundData.amountInMinorUnits),
        refundCurrency: normalizeUpperText(refundData.currency || resolveRefundCurrency(safePayment, safeOptions)),
        refundReason: reason,
        refundRequestedAt: requestedAt,
        refundedAt: refundData.refundedAt || null,
        updatedAt: safeOptions.updatedAt !== undefined ? safeOptions.updatedAt : requestedAt
    };
    const existingTimeline = Array.isArray(safePayment.timeline) ? safePayment.timeline.slice() : [];

    if (normalizedRefundStatus === REFUND_STATUSES.REFUNDED && existingTimeline.length > 0) {
        patch.timeline = existingTimeline.concat({
            status: "rejected",
            label: "Customer Refunded",
            actorRole: "system",
            actorUid: normalizeText(safeOptions.actorUid),
            actorName: "System",
            note: "Customer was refunded and the rejected order is now closed.",
            at: patch.refundedAt || patch.updatedAt
        });
    }

    return patch;
}

async function refundPayment(paymentValues = {}, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const safePayment = paymentValues && typeof paymentValues === "object" ? paymentValues : {};
    const validation = validateRefundInput(safePayment, safeOptions);

    if (!validation.isValid) {
        return createRefundResult(false, {
            payment: safePayment,
            refund: validation.value,
            payload: null,
            validationErrors: validation.errors,
            error: createRefundError(
                "payments/invalid-refund-input",
                "Refund details are invalid."
            )
        });
    }

    const client = safeOptions.client || createPaystackClient(safeOptions.clientOptions);
    const payload = buildRefundPayload(safePayment, safeOptions);
    const generatedReference = isGeneratedPaymentReference(validation.value.reference);

    if (generatedReference || safeOptions.allowSimulatedRefund === true) {
        const refundData = createSimulatedRefundData(safePayment, safeOptions);
        const patch = createRefundPatch(safePayment, refundData, safeOptions);

        return createRefundResult(true, {
            payment: safePayment,
            refund: {
                ...refundData,
                reason: validation.value.reason
            },
            patch,
            payload,
            simulated: true
        });
    }

    if (
        !client ||
        (
            typeof client.refundTransaction !== "function" &&
            typeof client.createRefund !== "function" &&
            typeof client.refund !== "function" &&
            typeof client.request !== "function"
        )
    ) {
        return createRefundResult(false, {
            payment: safePayment,
            refund: validation.value,
            payload,
            error: createRefundError(
                "payments/paystack-client-unavailable",
                "Paystack client is required before refunding payment."
            )
        });
    }

    try {
        const paystackResponse = await callPaystackRefund(client, payload);
        const refundData = normalizePaystackRefundData(paystackResponse);
        const refundReference = normalizeText(refundData.refundReference || refundData.refundId);

        if (!refundReference && !refundData.paymentReference) {
            return createRefundResult(false, {
                payment: safePayment,
                refund: refundData,
                payload,
                paystackResponse,
                error: createRefundError(
                    "payments/invalid-paystack-refund-response",
                    "Paystack did not return a usable refund reference."
                )
            });
        }

        const patch = createRefundPatch(safePayment, refundData, safeOptions);

        return createRefundResult(true, {
            payment: safePayment,
            refund: {
                ...refundData,
                reason: validation.value.reason
            },
            patch,
            payload,
            paystackResponse
        });
    } catch (error) {
        return createRefundResult(false, {
            payment: safePayment,
            refund: validation.value,
            payload,
            error: createRefundError(
                error && error.code ? error.code : "payments/paystack-refund-failed",
                error && error.message ? error.message : "Paystack refund failed.",
                {
                    cause: error || null
                }
            )
        });
    }
}

module.exports = refundPayment;
module.exports.MODULE_NAME = MODULE_NAME;
module.exports.DEFAULT_PROVIDER = DEFAULT_PROVIDER;
module.exports.DEFAULT_CURRENCY = DEFAULT_CURRENCY;
module.exports.REFUND_STATUSES = REFUND_STATUSES;
module.exports.normalizeText = normalizeText;
module.exports.normalizeLowerText = normalizeLowerText;
module.exports.normalizeUpperText = normalizeUpperText;
module.exports.normalizeStatusKey = normalizeStatusKey;
module.exports.normalizeRefundStatus = normalizeRefundStatus;
module.exports.isRefundActive = isRefundActive;
module.exports.isRefundAlreadyCompleted = isRefundAlreadyCompleted;
module.exports.normalizeCurrencyAmount = normalizeCurrencyAmount;
module.exports.normalizeAmountInMinorUnits = normalizeAmountInMinorUnits;
module.exports.amountToMinorUnits = amountToMinorUnits;
module.exports.createRefundResult = createRefundResult;
module.exports.createRefundError = createRefundError;
module.exports.resolveTimestampValue = resolveTimestampValue;
module.exports.resolvePaymentReference = resolvePaymentReference;
module.exports.resolvePaymentStatus = resolvePaymentStatus;
module.exports.resolveExistingRefundStatus = resolveExistingRefundStatus;
module.exports.resolveRefundReason = resolveRefundReason;
module.exports.resolveRefundCurrency = resolveRefundCurrency;
module.exports.resolveRefundAmountInMinorUnits = resolveRefundAmountInMinorUnits;
module.exports.normalizePaystackRefundData = normalizePaystackRefundData;
module.exports.buildRefundPayload = buildRefundPayload;
module.exports.validateRefundInput = validateRefundInput;
module.exports.callPaystackRefund = callPaystackRefund;
module.exports.isGeneratedPaymentReference = isGeneratedPaymentReference;
module.exports.createSimulatedRefundData = createSimulatedRefundData;
module.exports.createRefundPatch = createRefundPatch;
