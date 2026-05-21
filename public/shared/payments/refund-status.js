(function attachRefundStatus(globalScope) {
    "use strict";

    const MODULE_NAME = "refund-status";

    const REFUND_STATUSES = Object.freeze({
        NOT_REQUESTED: "not_requested",
        REQUESTED: "requested",
        PROCESSING: "processing",
        REFUNDED: "refunded",
        FAILED: "failed",
        CANCELLED: "cancelled"
    });

    const REFUND_STATUS_LIST = Object.freeze([
        REFUND_STATUSES.NOT_REQUESTED,
        REFUND_STATUSES.REQUESTED,
        REFUND_STATUSES.PROCESSING,
        REFUND_STATUSES.REFUNDED,
        REFUND_STATUSES.FAILED,
        REFUND_STATUSES.CANCELLED
    ]);

    const ACTIVE_REFUND_STATUSES = Object.freeze([
        REFUND_STATUSES.REQUESTED,
        REFUND_STATUSES.PROCESSING
    ]);

    const TERMINAL_REFUND_STATUSES = Object.freeze([
        REFUND_STATUSES.REFUNDED,
        REFUND_STATUSES.CANCELLED
    ]);

    const RETRYABLE_REFUND_STATUSES = Object.freeze([
        REFUND_STATUSES.FAILED
    ]);

    const REFUND_STATUS_METADATA = Object.freeze({
        [REFUND_STATUSES.NOT_REQUESTED]: Object.freeze({
            label: "Refund Not Requested",
            shortLabel: "No Refund",
            description: "No automatic refund has been started for this payment.",
            tone: "neutral",
            actionLabel: "Start Refund"
        }),
        [REFUND_STATUSES.REQUESTED]: Object.freeze({
            label: "Refund Started",
            shortLabel: "Started",
            description: "The automatic refund has started and is waiting to be sent to the provider.",
            tone: "loading",
            actionLabel: "Continue Refund"
        }),
        [REFUND_STATUSES.PROCESSING]: Object.freeze({
            label: "Refund Processing",
            shortLabel: "Processing",
            description: "The refund has been sent to the payment provider.",
            tone: "loading",
            actionLabel: "Check Refund"
        }),
        [REFUND_STATUSES.REFUNDED]: Object.freeze({
            label: "Refunded",
            shortLabel: "Refunded",
            description: "The customer has been refunded.",
            tone: "success",
            actionLabel: "View Refund"
        }),
        [REFUND_STATUSES.FAILED]: Object.freeze({
            label: "Refund Failed",
            shortLabel: "Failed",
            description: "The refund could not be completed.",
            tone: "error",
            actionLabel: "Retry Refund"
        }),
        [REFUND_STATUSES.CANCELLED]: Object.freeze({
            label: "Refund Cancelled",
            shortLabel: "Cancelled",
            description: "The automatic refund was stopped before completion.",
            tone: "warning",
            actionLabel: "View Payment"
        })
    });

    const REFUND_STATUS_ALIASES = Object.freeze({
        none: REFUND_STATUSES.NOT_REQUESTED,
        no: REFUND_STATUSES.NOT_REQUESTED,
        norefund: REFUND_STATUSES.NOT_REQUESTED,
        notrequired: REFUND_STATUSES.NOT_REQUESTED,
        notrequested: REFUND_STATUSES.NOT_REQUESTED,
        notneeded: REFUND_STATUSES.NOT_REQUESTED,
        new: REFUND_STATUSES.NOT_REQUESTED,

        requested: REFUND_STATUSES.REQUESTED,
        request: REFUND_STATUSES.REQUESTED,
        refundrequested: REFUND_STATUSES.REQUESTED,
        pending: REFUND_STATUSES.REQUESTED,
        refundpending: REFUND_STATUSES.REQUESTED,
        queued: REFUND_STATUSES.REQUESTED,
        awaitingrefund: REFUND_STATUSES.REQUESTED,

        processing: REFUND_STATUSES.PROCESSING,
        inprogress: REFUND_STATUSES.PROCESSING,
        submitted: REFUND_STATUSES.PROCESSING,
        providerprocessing: REFUND_STATUSES.PROCESSING,
        initiated: REFUND_STATUSES.PROCESSING,

        refunded: REFUND_STATUSES.REFUNDED,
        refundcomplete: REFUND_STATUSES.REFUNDED,
        refundcompleted: REFUND_STATUSES.REFUNDED,
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
        providerfailed: REFUND_STATUSES.FAILED,

        cancelled: REFUND_STATUSES.CANCELLED,
        canceled: REFUND_STATUSES.CANCELLED,
        void: REFUND_STATUSES.CANCELLED,
        voided: REFUND_STATUSES.CANCELLED,
        stopped: REFUND_STATUSES.CANCELLED
    });

    const REFUND_STATUS_TRANSITIONS = Object.freeze({
        [REFUND_STATUSES.NOT_REQUESTED]: Object.freeze([
            REFUND_STATUSES.REQUESTED
        ]),
        [REFUND_STATUSES.REQUESTED]: Object.freeze([
            REFUND_STATUSES.PROCESSING,
            REFUND_STATUSES.REFUNDED,
            REFUND_STATUSES.FAILED,
            REFUND_STATUSES.CANCELLED
        ]),
        [REFUND_STATUSES.PROCESSING]: Object.freeze([
            REFUND_STATUSES.REFUNDED,
            REFUND_STATUSES.FAILED
        ]),
        [REFUND_STATUSES.FAILED]: Object.freeze([
            REFUND_STATUSES.REQUESTED,
            REFUND_STATUSES.PROCESSING,
            REFUND_STATUSES.CANCELLED
        ]),
        [REFUND_STATUSES.REFUNDED]: Object.freeze([]),
        [REFUND_STATUSES.CANCELLED]: Object.freeze([])
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

    function getDefaultRefundStatus() {
        return REFUND_STATUSES.NOT_REQUESTED;
    }

    function getRefundStatusList() {
        return REFUND_STATUS_LIST.slice();
    }

    function getActiveRefundStatusList() {
        return ACTIVE_REFUND_STATUSES.slice();
    }

    function getTerminalRefundStatusList() {
        return TERMINAL_REFUND_STATUSES.slice();
    }

    function getRetryableRefundStatusList() {
        return RETRYABLE_REFUND_STATUSES.slice();
    }

    function isKnownRefundStatus(status) {
        return normalizeRefundStatus(status) !== "";
    }

    function isActiveRefundStatus(status) {
        return ACTIVE_REFUND_STATUSES.indexOf(normalizeRefundStatus(status)) >= 0;
    }

    function isTerminalRefundStatus(status) {
        return TERMINAL_REFUND_STATUSES.indexOf(normalizeRefundStatus(status)) >= 0;
    }

    function isRetryableRefundStatus(status) {
        return RETRYABLE_REFUND_STATUSES.indexOf(normalizeRefundStatus(status)) >= 0;
    }

    function isRefundRequested(status) {
        return normalizeRefundStatus(status) === REFUND_STATUSES.REQUESTED;
    }

    function isRefundProcessing(status) {
        return normalizeRefundStatus(status) === REFUND_STATUSES.PROCESSING;
    }

    function isRefunded(status) {
        return normalizeRefundStatus(status) === REFUND_STATUSES.REFUNDED;
    }

    function isRefundFailed(status) {
        return normalizeRefundStatus(status) === REFUND_STATUSES.FAILED;
    }

    function getRefundStatusMetadata(status) {
        const normalizedStatus = normalizeRefundStatus(status);
        const metadata = REFUND_STATUS_METADATA[normalizedStatus];

        if (!metadata) {
            return {
                key: "",
                label: "Unknown Refund Status",
                shortLabel: "Unknown",
                description: "The refund status is not recognized yet.",
                tone: "neutral",
                actionLabel: "Review Refund"
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

    function getRefundStatusLabel(status) {
        return getRefundStatusMetadata(status).label;
    }

    function getRefundStatusShortLabel(status) {
        return getRefundStatusMetadata(status).shortLabel;
    }

    function getRefundStatusDescription(status) {
        return getRefundStatusMetadata(status).description;
    }

    function getRefundStatusTone(status) {
        return getRefundStatusMetadata(status).tone;
    }

    function getRefundStatusActionLabel(status) {
        return getRefundStatusMetadata(status).actionLabel;
    }

    function getAllowedNextRefundStatuses(currentStatus) {
        const normalizedStatus = normalizeRefundStatus(currentStatus);
        const transitions = REFUND_STATUS_TRANSITIONS[normalizedStatus];

        return Array.isArray(transitions) ? transitions.slice() : [];
    }

    function canTransitionRefundStatus(currentStatus, nextStatus) {
        return validateRefundStatusTransition(currentStatus, nextStatus).isValid;
    }

    function validateRefundStatusTransition(currentStatus, nextStatus) {
        const normalizedCurrentStatus = normalizeRefundStatus(currentStatus);
        const normalizedNextStatus = normalizeRefundStatus(nextStatus);
        const currentLabel = getRefundStatusLabel(normalizedCurrentStatus);
        const nextLabel = getRefundStatusLabel(normalizedNextStatus);

        if (!normalizedCurrentStatus) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                message: "The current refund status is invalid."
            };
        }

        if (!normalizedNextStatus) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                message: "The next refund status is invalid."
            };
        }

        if (normalizedCurrentStatus === normalizedNextStatus) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                message: `The refund is already marked as ${nextLabel}.`
            };
        }

        if (isTerminalRefundStatus(normalizedCurrentStatus)) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                message: `${currentLabel} refunds cannot transition to another status.`
            };
        }

        if (getAllowedNextRefundStatuses(normalizedCurrentStatus).indexOf(normalizedNextStatus) === -1) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                message: `Refunds cannot move from ${currentLabel} to ${nextLabel}.`
            };
        }

        return {
            isValid: true,
            currentStatus: normalizedCurrentStatus,
            nextStatus: normalizedNextStatus,
            message: `Refunds can move from ${currentLabel} to ${nextLabel}.`
        };
    }

    const refundStatus = {
        MODULE_NAME,
        REFUND_STATUSES,
        normalizeText,
        normalizeLowerText,
        normalizeStatusKey,
        normalizeRefundStatus,
        getDefaultRefundStatus,
        getRefundStatusList,
        getActiveRefundStatusList,
        getTerminalRefundStatusList,
        getRetryableRefundStatusList,
        isKnownRefundStatus,
        isActiveRefundStatus,
        isTerminalRefundStatus,
        isRetryableRefundStatus,
        isRefundRequested,
        isRefundProcessing,
        isRefunded,
        isRefundFailed,
        getRefundStatusMetadata,
        getRefundStatusLabel,
        getRefundStatusShortLabel,
        getRefundStatusDescription,
        getRefundStatusTone,
        getRefundStatusActionLabel,
        getAllowedNextRefundStatuses,
        canTransitionRefundStatus,
        validateRefundStatusTransition
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = refundStatus;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.refundStatus = refundStatus;
    }
})(typeof window !== "undefined" ? window : globalThis);
