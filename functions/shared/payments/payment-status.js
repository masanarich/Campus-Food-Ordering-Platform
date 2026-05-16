(function attachPaymentStatus(globalScope) {
    "use strict";

    const MODULE_NAME = "payment-status";

    const PAYMENT_STATUSES = Object.freeze({
        UNPAID: "unpaid",
        PENDING: "pending",
        PAID: "paid",
        FAILED: "failed"
    });

    const PAYMENT_STATUS_LIST = Object.freeze([
        PAYMENT_STATUSES.UNPAID,
        PAYMENT_STATUSES.PENDING,
        PAYMENT_STATUSES.PAID,
        PAYMENT_STATUSES.FAILED
    ]);

    const TERMINAL_PAYMENT_STATUSES = Object.freeze([
        PAYMENT_STATUSES.PAID
    ]);

    const RETRYABLE_PAYMENT_STATUSES = Object.freeze([
        PAYMENT_STATUSES.UNPAID,
        PAYMENT_STATUSES.FAILED
    ]);

    const PAYMENT_STATUS_METADATA = Object.freeze({
        [PAYMENT_STATUSES.UNPAID]: Object.freeze({
            label: "Unpaid",
            shortLabel: "Unpaid",
            description: "Payment has not been started for this order.",
            tone: "neutral",
            actionLabel: "Start Payment"
        }),
        [PAYMENT_STATUSES.PENDING]: Object.freeze({
            label: "Payment Pending",
            shortLabel: "Pending",
            description: "Payment has been started and is waiting for verification.",
            tone: "loading",
            actionLabel: "Verify Payment"
        }),
        [PAYMENT_STATUSES.PAID]: Object.freeze({
            label: "Paid",
            shortLabel: "Paid",
            description: "Payment was successfully verified.",
            tone: "success",
            actionLabel: "View Payment"
        }),
        [PAYMENT_STATUSES.FAILED]: Object.freeze({
            label: "Payment Failed",
            shortLabel: "Failed",
            description: "Payment could not be verified or was not completed.",
            tone: "error",
            actionLabel: "Retry Payment"
        })
    });

    const PAYMENT_STATUS_ALIASES = Object.freeze({
        unpaid: PAYMENT_STATUSES.UNPAID,
        none: PAYMENT_STATUSES.UNPAID,
        new: PAYMENT_STATUSES.UNPAID,
        notpaid: PAYMENT_STATUSES.UNPAID,
        awaitingpayment: PAYMENT_STATUSES.UNPAID,

        pending: PAYMENT_STATUSES.PENDING,
        paymentpending: PAYMENT_STATUSES.PENDING,
        processing: PAYMENT_STATUSES.PENDING,
        verifying: PAYMENT_STATUSES.PENDING,
        inprogress: PAYMENT_STATUSES.PENDING,
        initialized: PAYMENT_STATUSES.PENDING,
        awaitingverification: PAYMENT_STATUSES.PENDING,

        paid: PAYMENT_STATUSES.PAID,
        success: PAYMENT_STATUSES.PAID,
        successful: PAYMENT_STATUSES.PAID,
        verified: PAYMENT_STATUSES.PAID,
        complete: PAYMENT_STATUSES.PAID,
        completed: PAYMENT_STATUSES.PAID,

        failed: PAYMENT_STATUSES.FAILED,
        failure: PAYMENT_STATUSES.FAILED,
        declined: PAYMENT_STATUSES.FAILED,
        rejected: PAYMENT_STATUSES.FAILED,
        cancelled: PAYMENT_STATUSES.FAILED,
        canceled: PAYMENT_STATUSES.FAILED,
        abandoned: PAYMENT_STATUSES.FAILED
    });

    const PAYMENT_STATUS_TRANSITIONS = Object.freeze({
        [PAYMENT_STATUSES.UNPAID]: Object.freeze([
            PAYMENT_STATUSES.PENDING,
            PAYMENT_STATUSES.FAILED
        ]),
        [PAYMENT_STATUSES.PENDING]: Object.freeze([
            PAYMENT_STATUSES.PAID,
            PAYMENT_STATUSES.FAILED
        ]),
        [PAYMENT_STATUSES.FAILED]: Object.freeze([
            PAYMENT_STATUSES.PENDING
        ]),
        [PAYMENT_STATUSES.PAID]: Object.freeze([])
    });

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
    }

    function normalizeStatusKey(value) {
        return normalizeLowerText(value).replace(/[\s_-]+/g, "");
    }

    function normalizePaymentStatus(status, fallbackStatus) {
        const statusKey = normalizeStatusKey(status);
        const fallbackKey = normalizeStatusKey(fallbackStatus);

        if (Object.prototype.hasOwnProperty.call(PAYMENT_STATUS_ALIASES, statusKey)) {
            return PAYMENT_STATUS_ALIASES[statusKey];
        }

        if (Object.prototype.hasOwnProperty.call(PAYMENT_STATUS_ALIASES, fallbackKey)) {
            return PAYMENT_STATUS_ALIASES[fallbackKey];
        }

        return "";
    }

    function getDefaultPaymentStatus() {
        return PAYMENT_STATUSES.UNPAID;
    }

    function getPaymentStatusList() {
        return PAYMENT_STATUS_LIST.slice();
    }

    function getTerminalPaymentStatusList() {
        return TERMINAL_PAYMENT_STATUSES.slice();
    }

    function getRetryablePaymentStatusList() {
        return RETRYABLE_PAYMENT_STATUSES.slice();
    }

    function isKnownPaymentStatus(status) {
        return normalizePaymentStatus(status) !== "";
    }

    function isTerminalPaymentStatus(status) {
        return TERMINAL_PAYMENT_STATUSES.indexOf(normalizePaymentStatus(status)) >= 0;
    }

    function isPaymentPaid(status) {
        return normalizePaymentStatus(status) === PAYMENT_STATUSES.PAID;
    }

    function isPaymentPending(status) {
        return normalizePaymentStatus(status) === PAYMENT_STATUSES.PENDING;
    }

    function isPaymentFailed(status) {
        return normalizePaymentStatus(status) === PAYMENT_STATUSES.FAILED;
    }

    function isPaymentRetryable(status) {
        return RETRYABLE_PAYMENT_STATUSES.indexOf(normalizePaymentStatus(status)) >= 0;
    }

    function getPaymentStatusMetadata(status) {
        const normalizedStatus = normalizePaymentStatus(status);
        const metadata = PAYMENT_STATUS_METADATA[normalizedStatus];

        if (!metadata) {
            return {
                key: "",
                label: "Unknown Payment Status",
                shortLabel: "Unknown",
                description: "The payment status is not recognized yet.",
                tone: "neutral",
                actionLabel: "Review Payment"
            };
        }

        return {
            key: normalizedStatus,
            label: metadata.label,
            shortLabel: metadata.shortLabel,
            description: metadata.description,
            tone: metadata.tone,
            actionLabel: metadata.actionLabel
        };
    }

    function getPaymentStatusLabel(status) {
        return getPaymentStatusMetadata(status).label;
    }

    function getPaymentStatusShortLabel(status) {
        return getPaymentStatusMetadata(status).shortLabel;
    }

    function getPaymentStatusDescription(status) {
        return getPaymentStatusMetadata(status).description;
    }

    function getPaymentStatusTone(status) {
        return getPaymentStatusMetadata(status).tone;
    }

    function getPaymentStatusActionLabel(status) {
        return getPaymentStatusMetadata(status).actionLabel;
    }

    function getAllowedNextPaymentStatuses(currentStatus) {
        const normalizedStatus = normalizePaymentStatus(currentStatus);
        const transitions = PAYMENT_STATUS_TRANSITIONS[normalizedStatus];

        return Array.isArray(transitions) ? transitions.slice() : [];
    }

    function canTransitionPaymentStatus(currentStatus, nextStatus) {
        return validatePaymentStatusTransition(currentStatus, nextStatus).isValid;
    }

    function validatePaymentStatusTransition(currentStatus, nextStatus) {
        const normalizedCurrentStatus = normalizePaymentStatus(currentStatus);
        const normalizedNextStatus = normalizePaymentStatus(nextStatus);
        const currentLabel = getPaymentStatusLabel(normalizedCurrentStatus);
        const nextLabel = getPaymentStatusLabel(normalizedNextStatus);

        if (!normalizedCurrentStatus) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                message: "The current payment status is invalid."
            };
        }

        if (!normalizedNextStatus) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                message: "The next payment status is invalid."
            };
        }

        if (normalizedCurrentStatus === normalizedNextStatus) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                message: `The payment is already marked as ${nextLabel}.`
            };
        }

        if (isTerminalPaymentStatus(normalizedCurrentStatus)) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                message: `${currentLabel} payments cannot transition to another status.`
            };
        }

        if (getAllowedNextPaymentStatuses(normalizedCurrentStatus).indexOf(normalizedNextStatus) === -1) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                message: `Payments cannot move from ${currentLabel} to ${nextLabel}.`
            };
        }

        return {
            isValid: true,
            currentStatus: normalizedCurrentStatus,
            nextStatus: normalizedNextStatus,
            message: `Payments can move from ${currentLabel} to ${nextLabel}.`
        };
    }

    const paymentStatus = {
        MODULE_NAME,
        PAYMENT_STATUSES,
        normalizeText,
        normalizeLowerText,
        normalizeStatusKey,
        normalizePaymentStatus,
        getDefaultPaymentStatus,
        getPaymentStatusList,
        getTerminalPaymentStatusList,
        getRetryablePaymentStatusList,
        isKnownPaymentStatus,
        isTerminalPaymentStatus,
        isPaymentPaid,
        isPaymentPending,
        isPaymentFailed,
        isPaymentRetryable,
        getPaymentStatusMetadata,
        getPaymentStatusLabel,
        getPaymentStatusShortLabel,
        getPaymentStatusDescription,
        getPaymentStatusTone,
        getPaymentStatusActionLabel,
        getAllowedNextPaymentStatuses,
        canTransitionPaymentStatus,
        validatePaymentStatusTransition
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = paymentStatus;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.paymentStatus = paymentStatus;
    }
})(typeof window !== "undefined" ? window : globalThis);
