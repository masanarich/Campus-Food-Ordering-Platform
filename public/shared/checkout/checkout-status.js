(function attachCheckoutStatus(globalScope) {
    "use strict";

    const MODULE_NAME = "checkout-status";

    const CHECKOUT_STATUSES = Object.freeze({
        DRAFT: "draft",
        PAYMENT_PENDING: "payment_pending",
        PAYMENT_FAILED: "payment_failed",
        CANCELLED: "cancelled",
        EXPIRED: "expired",
        PAID: "paid",
        CONVERTED: "converted"
    });

    const CHECKOUT_ACTOR_ROLES = Object.freeze({
        CUSTOMER: "customer",
        ADMIN: "admin",
        SYSTEM: "system"
    });

    const CHECKOUT_STATUS_LIST = Object.freeze([
        CHECKOUT_STATUSES.DRAFT,
        CHECKOUT_STATUSES.PAYMENT_PENDING,
        CHECKOUT_STATUSES.PAYMENT_FAILED,
        CHECKOUT_STATUSES.CANCELLED,
        CHECKOUT_STATUSES.EXPIRED,
        CHECKOUT_STATUSES.PAID,
        CHECKOUT_STATUSES.CONVERTED
    ]);

    const ACTIVE_CHECKOUT_STATUSES = Object.freeze([
        CHECKOUT_STATUSES.DRAFT,
        CHECKOUT_STATUSES.PAYMENT_PENDING,
        CHECKOUT_STATUSES.PAYMENT_FAILED,
        CHECKOUT_STATUSES.PAID
    ]);

    const TERMINAL_CHECKOUT_STATUSES = Object.freeze([
        CHECKOUT_STATUSES.CANCELLED,
        CHECKOUT_STATUSES.EXPIRED,
        CHECKOUT_STATUSES.CONVERTED
    ]);

    const RETRYABLE_CHECKOUT_STATUSES = Object.freeze([
        CHECKOUT_STATUSES.DRAFT,
        CHECKOUT_STATUSES.PAYMENT_FAILED
    ]);

    const RESUMABLE_CHECKOUT_STATUSES = Object.freeze([
        CHECKOUT_STATUSES.DRAFT,
        CHECKOUT_STATUSES.PAYMENT_PENDING,
        CHECKOUT_STATUSES.PAYMENT_FAILED
    ]);

    const CANCELLABLE_CHECKOUT_STATUSES = Object.freeze([
        CHECKOUT_STATUSES.DRAFT,
        CHECKOUT_STATUSES.PAYMENT_PENDING,
        CHECKOUT_STATUSES.PAYMENT_FAILED
    ]);

    const CHECKOUT_STATUS_METADATA = Object.freeze({
        [CHECKOUT_STATUSES.DRAFT]: Object.freeze({
            label: "Checkout Draft",
            shortLabel: "Draft",
            description: "The checkout session has been created but payment has not started yet.",
            tone: "neutral",
            actionLabel: "Start Payment"
        }),
        [CHECKOUT_STATUSES.PAYMENT_PENDING]: Object.freeze({
            label: "Payment Pending",
            shortLabel: "Pending",
            description: "Payment has started and is waiting for confirmation.",
            tone: "loading",
            actionLabel: "Resume Payment"
        }),
        [CHECKOUT_STATUSES.PAYMENT_FAILED]: Object.freeze({
            label: "Payment Failed",
            shortLabel: "Failed",
            description: "Payment failed or could not be verified.",
            tone: "error",
            actionLabel: "Retry Payment"
        }),
        [CHECKOUT_STATUSES.CANCELLED]: Object.freeze({
            label: "Checkout Cancelled",
            shortLabel: "Cancelled",
            description: "The customer cancelled the checkout before payment was completed.",
            tone: "error",
            actionLabel: "View Cart"
        }),
        [CHECKOUT_STATUSES.EXPIRED]: Object.freeze({
            label: "Checkout Expired",
            shortLabel: "Expired",
            description: "The checkout session expired before payment was completed.",
            tone: "warning",
            actionLabel: "Start Again"
        }),
        [CHECKOUT_STATUSES.PAID]: Object.freeze({
            label: "Payment Verified",
            shortLabel: "Paid",
            description: "Payment was verified and the session is ready to become an order.",
            tone: "success",
            actionLabel: "Create Order"
        }),
        [CHECKOUT_STATUSES.CONVERTED]: Object.freeze({
            label: "Order Created",
            shortLabel: "Converted",
            description: "The paid checkout session has been converted into an order.",
            tone: "success",
            actionLabel: "View Order"
        })
    });

    const CHECKOUT_STATUS_ALIASES = Object.freeze({
        draft: CHECKOUT_STATUSES.DRAFT,
        new: CHECKOUT_STATUSES.DRAFT,
        open: CHECKOUT_STATUSES.DRAFT,
        checkoutopen: CHECKOUT_STATUSES.DRAFT,
        notstarted: CHECKOUT_STATUSES.DRAFT,

        pending: CHECKOUT_STATUSES.PAYMENT_PENDING,
        paymentpending: CHECKOUT_STATUSES.PAYMENT_PENDING,
        awaitingpayment: CHECKOUT_STATUSES.PAYMENT_PENDING,
        awaitingverification: CHECKOUT_STATUSES.PAYMENT_PENDING,
        initialized: CHECKOUT_STATUSES.PAYMENT_PENDING,
        processing: CHECKOUT_STATUSES.PAYMENT_PENDING,
        inprogress: CHECKOUT_STATUSES.PAYMENT_PENDING,

        failed: CHECKOUT_STATUSES.PAYMENT_FAILED,
        paymentfailed: CHECKOUT_STATUSES.PAYMENT_FAILED,
        failure: CHECKOUT_STATUSES.PAYMENT_FAILED,
        declined: CHECKOUT_STATUSES.PAYMENT_FAILED,
        abandoned: CHECKOUT_STATUSES.PAYMENT_FAILED,
        unsuccessful: CHECKOUT_STATUSES.PAYMENT_FAILED,

        cancelled: CHECKOUT_STATUSES.CANCELLED,
        canceled: CHECKOUT_STATUSES.CANCELLED,
        customercancelled: CHECKOUT_STATUSES.CANCELLED,

        expired: CHECKOUT_STATUSES.EXPIRED,
        stale: CHECKOUT_STATUSES.EXPIRED,
        timedout: CHECKOUT_STATUSES.EXPIRED,
        timeout: CHECKOUT_STATUSES.EXPIRED,

        paid: CHECKOUT_STATUSES.PAID,
        verified: CHECKOUT_STATUSES.PAID,
        paymentverified: CHECKOUT_STATUSES.PAID,
        successful: CHECKOUT_STATUSES.PAID,
        success: CHECKOUT_STATUSES.PAID,

        converted: CHECKOUT_STATUSES.CONVERTED,
        ordercreated: CHECKOUT_STATUSES.CONVERTED,
        submitted: CHECKOUT_STATUSES.CONVERTED,
        complete: CHECKOUT_STATUSES.CONVERTED,
        completed: CHECKOUT_STATUSES.CONVERTED
    });

    const CHECKOUT_ACTOR_ROLE_ALIASES = Object.freeze({
        customer: CHECKOUT_ACTOR_ROLES.CUSTOMER,
        student: CHECKOUT_ACTOR_ROLES.CUSTOMER,
        user: CHECKOUT_ACTOR_ROLES.CUSTOMER,

        admin: CHECKOUT_ACTOR_ROLES.ADMIN,
        administrator: CHECKOUT_ACTOR_ROLES.ADMIN,

        system: CHECKOUT_ACTOR_ROLES.SYSTEM,
        app: CHECKOUT_ACTOR_ROLES.SYSTEM,
        server: CHECKOUT_ACTOR_ROLES.SYSTEM,
        firebasefunction: CHECKOUT_ACTOR_ROLES.SYSTEM,
        function: CHECKOUT_ACTOR_ROLES.SYSTEM
    });

    const CHECKOUT_STATUS_TRANSITIONS = Object.freeze({
        [CHECKOUT_ACTOR_ROLES.CUSTOMER]: Object.freeze({
            [CHECKOUT_STATUSES.DRAFT]: Object.freeze([
                CHECKOUT_STATUSES.PAYMENT_PENDING,
                CHECKOUT_STATUSES.CANCELLED
            ]),
            [CHECKOUT_STATUSES.PAYMENT_PENDING]: Object.freeze([
                CHECKOUT_STATUSES.CANCELLED
            ]),
            [CHECKOUT_STATUSES.PAYMENT_FAILED]: Object.freeze([
                CHECKOUT_STATUSES.PAYMENT_PENDING,
                CHECKOUT_STATUSES.CANCELLED
            ]),
            [CHECKOUT_STATUSES.CANCELLED]: Object.freeze([]),
            [CHECKOUT_STATUSES.EXPIRED]: Object.freeze([]),
            [CHECKOUT_STATUSES.PAID]: Object.freeze([]),
            [CHECKOUT_STATUSES.CONVERTED]: Object.freeze([])
        }),
        [CHECKOUT_ACTOR_ROLES.ADMIN]: Object.freeze({
            [CHECKOUT_STATUSES.DRAFT]: Object.freeze([
                CHECKOUT_STATUSES.PAYMENT_PENDING,
                CHECKOUT_STATUSES.CANCELLED,
                CHECKOUT_STATUSES.EXPIRED
            ]),
            [CHECKOUT_STATUSES.PAYMENT_PENDING]: Object.freeze([
                CHECKOUT_STATUSES.PAID,
                CHECKOUT_STATUSES.PAYMENT_FAILED,
                CHECKOUT_STATUSES.CANCELLED,
                CHECKOUT_STATUSES.EXPIRED
            ]),
            [CHECKOUT_STATUSES.PAYMENT_FAILED]: Object.freeze([
                CHECKOUT_STATUSES.PAYMENT_PENDING,
                CHECKOUT_STATUSES.CANCELLED,
                CHECKOUT_STATUSES.EXPIRED
            ]),
            [CHECKOUT_STATUSES.CANCELLED]: Object.freeze([]),
            [CHECKOUT_STATUSES.EXPIRED]: Object.freeze([]),
            [CHECKOUT_STATUSES.PAID]: Object.freeze([
                CHECKOUT_STATUSES.CONVERTED
            ]),
            [CHECKOUT_STATUSES.CONVERTED]: Object.freeze([])
        }),
        [CHECKOUT_ACTOR_ROLES.SYSTEM]: Object.freeze({
            [CHECKOUT_STATUSES.DRAFT]: Object.freeze([
                CHECKOUT_STATUSES.PAYMENT_PENDING,
                CHECKOUT_STATUSES.CANCELLED,
                CHECKOUT_STATUSES.EXPIRED
            ]),
            [CHECKOUT_STATUSES.PAYMENT_PENDING]: Object.freeze([
                CHECKOUT_STATUSES.PAID,
                CHECKOUT_STATUSES.PAYMENT_FAILED,
                CHECKOUT_STATUSES.CANCELLED,
                CHECKOUT_STATUSES.EXPIRED
            ]),
            [CHECKOUT_STATUSES.PAYMENT_FAILED]: Object.freeze([
                CHECKOUT_STATUSES.PAYMENT_PENDING,
                CHECKOUT_STATUSES.CANCELLED,
                CHECKOUT_STATUSES.EXPIRED
            ]),
            [CHECKOUT_STATUSES.CANCELLED]: Object.freeze([]),
            [CHECKOUT_STATUSES.EXPIRED]: Object.freeze([]),
            [CHECKOUT_STATUSES.PAID]: Object.freeze([
                CHECKOUT_STATUSES.CONVERTED
            ]),
            [CHECKOUT_STATUSES.CONVERTED]: Object.freeze([])
        })
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

    function normalizeCheckoutStatus(status, fallbackStatus) {
        const statusKey = normalizeStatusKey(status);
        const fallbackKey = normalizeStatusKey(fallbackStatus);

        if (Object.prototype.hasOwnProperty.call(CHECKOUT_STATUS_ALIASES, statusKey)) {
            return CHECKOUT_STATUS_ALIASES[statusKey];
        }

        if (Object.prototype.hasOwnProperty.call(CHECKOUT_STATUS_ALIASES, fallbackKey)) {
            return CHECKOUT_STATUS_ALIASES[fallbackKey];
        }

        return "";
    }

    function normalizeCheckoutActorRole(actorRole) {
        const roleKey = normalizeStatusKey(actorRole);

        if (Object.prototype.hasOwnProperty.call(CHECKOUT_ACTOR_ROLE_ALIASES, roleKey)) {
            return CHECKOUT_ACTOR_ROLE_ALIASES[roleKey];
        }

        return "";
    }

    function getDefaultCheckoutStatus() {
        return CHECKOUT_STATUSES.DRAFT;
    }

    function getCheckoutStatusList() {
        return CHECKOUT_STATUS_LIST.slice();
    }

    function getActiveCheckoutStatusList() {
        return ACTIVE_CHECKOUT_STATUSES.slice();
    }

    function getTerminalCheckoutStatusList() {
        return TERMINAL_CHECKOUT_STATUSES.slice();
    }

    function getRetryableCheckoutStatusList() {
        return RETRYABLE_CHECKOUT_STATUSES.slice();
    }

    function getResumableCheckoutStatusList() {
        return RESUMABLE_CHECKOUT_STATUSES.slice();
    }

    function getCancellableCheckoutStatusList() {
        return CANCELLABLE_CHECKOUT_STATUSES.slice();
    }

    function isKnownCheckoutStatus(status) {
        return normalizeCheckoutStatus(status) !== "";
    }

    function isActiveCheckoutStatus(status) {
        return ACTIVE_CHECKOUT_STATUSES.indexOf(normalizeCheckoutStatus(status)) >= 0;
    }

    function isTerminalCheckoutStatus(status) {
        return TERMINAL_CHECKOUT_STATUSES.indexOf(normalizeCheckoutStatus(status)) >= 0;
    }

    function isRetryableCheckoutStatus(status) {
        return RETRYABLE_CHECKOUT_STATUSES.indexOf(normalizeCheckoutStatus(status)) >= 0;
    }

    function isResumableCheckoutStatus(status) {
        return RESUMABLE_CHECKOUT_STATUSES.indexOf(normalizeCheckoutStatus(status)) >= 0;
    }

    function isCancellableCheckoutStatus(status) {
        return CANCELLABLE_CHECKOUT_STATUSES.indexOf(normalizeCheckoutStatus(status)) >= 0;
    }

    function isCheckoutAwaitingPayment(status) {
        return normalizeCheckoutStatus(status) === CHECKOUT_STATUSES.PAYMENT_PENDING;
    }

    function isCheckoutPaid(status) {
        return normalizeCheckoutStatus(status) === CHECKOUT_STATUSES.PAID;
    }

    function isCheckoutConverted(status) {
        return normalizeCheckoutStatus(status) === CHECKOUT_STATUSES.CONVERTED;
    }

    function getCheckoutStatusMetadata(status) {
        const normalizedStatus = normalizeCheckoutStatus(status);
        const metadata = CHECKOUT_STATUS_METADATA[normalizedStatus];

        if (!metadata) {
            return {
                key: "",
                label: "Unknown Checkout Status",
                shortLabel: "Unknown",
                description: "The checkout status is not recognized yet.",
                tone: "neutral",
                actionLabel: "Review Checkout"
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

    function getCheckoutStatusLabel(status) {
        return getCheckoutStatusMetadata(status).label;
    }

    function getCheckoutStatusShortLabel(status) {
        return getCheckoutStatusMetadata(status).shortLabel;
    }

    function getCheckoutStatusDescription(status) {
        return getCheckoutStatusMetadata(status).description;
    }

    function getCheckoutStatusTone(status) {
        return getCheckoutStatusMetadata(status).tone;
    }

    function getCheckoutStatusActionLabel(status) {
        return getCheckoutStatusMetadata(status).actionLabel;
    }

    function getAllowedNextCheckoutStatuses(currentStatus, actorRole) {
        const normalizedStatus = normalizeCheckoutStatus(currentStatus);
        const normalizedRole = normalizeCheckoutActorRole(actorRole);
        const roleTransitions = CHECKOUT_STATUS_TRANSITIONS[normalizedRole];
        const transitions = roleTransitions && roleTransitions[normalizedStatus];

        return Array.isArray(transitions) ? transitions.slice() : [];
    }

    function canTransitionCheckoutStatus(currentStatus, nextStatus, actorRole) {
        return validateCheckoutStatusTransition(currentStatus, nextStatus, actorRole).isValid;
    }

    function getActorRoleLabel(actorRole) {
        const normalizedRole = normalizeCheckoutActorRole(actorRole);

        if (normalizedRole === CHECKOUT_ACTOR_ROLES.CUSTOMER) {
            return "Customers";
        }

        if (normalizedRole === CHECKOUT_ACTOR_ROLES.ADMIN) {
            return "Admins";
        }

        if (normalizedRole === CHECKOUT_ACTOR_ROLES.SYSTEM) {
            return "The system";
        }

        return "This actor";
    }

    function validateCheckoutStatusTransition(currentStatus, nextStatus, actorRole) {
        const normalizedCurrentStatus = normalizeCheckoutStatus(currentStatus);
        const normalizedNextStatus = normalizeCheckoutStatus(nextStatus);
        const normalizedActorRole = normalizeCheckoutActorRole(actorRole);
        const currentLabel = getCheckoutStatusLabel(normalizedCurrentStatus);
        const nextLabel = getCheckoutStatusLabel(normalizedNextStatus);

        if (!normalizedActorRole) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                actorRole: normalizedActorRole,
                message: "A valid actor role is required before changing checkout status."
            };
        }

        if (!normalizedCurrentStatus) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                actorRole: normalizedActorRole,
                message: "The current checkout status is invalid."
            };
        }

        if (!normalizedNextStatus) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                actorRole: normalizedActorRole,
                message: "The next checkout status is invalid."
            };
        }

        if (normalizedCurrentStatus === normalizedNextStatus) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                actorRole: normalizedActorRole,
                message: `The checkout is already marked as ${nextLabel}.`
            };
        }

        if (isTerminalCheckoutStatus(normalizedCurrentStatus)) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                actorRole: normalizedActorRole,
                message: `${currentLabel} checkouts cannot transition to another status.`
            };
        }

        if (
            getAllowedNextCheckoutStatuses(normalizedCurrentStatus, normalizedActorRole)
                .indexOf(normalizedNextStatus) === -1
        ) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                actorRole: normalizedActorRole,
                message: `${getActorRoleLabel(normalizedActorRole)} cannot move a checkout from ${currentLabel} to ${nextLabel}.`
            };
        }

        return {
            isValid: true,
            currentStatus: normalizedCurrentStatus,
            nextStatus: normalizedNextStatus,
            actorRole: normalizedActorRole,
            message: `${getActorRoleLabel(normalizedActorRole)} can move a checkout from ${currentLabel} to ${nextLabel}.`
        };
    }

    const checkoutStatus = {
        MODULE_NAME,
        CHECKOUT_STATUSES,
        CHECKOUT_ACTOR_ROLES,
        normalizeText,
        normalizeLowerText,
        normalizeStatusKey,
        normalizeCheckoutStatus,
        normalizeCheckoutActorRole,
        getDefaultCheckoutStatus,
        getCheckoutStatusList,
        getActiveCheckoutStatusList,
        getTerminalCheckoutStatusList,
        getRetryableCheckoutStatusList,
        getResumableCheckoutStatusList,
        getCancellableCheckoutStatusList,
        isKnownCheckoutStatus,
        isActiveCheckoutStatus,
        isTerminalCheckoutStatus,
        isRetryableCheckoutStatus,
        isResumableCheckoutStatus,
        isCancellableCheckoutStatus,
        isCheckoutAwaitingPayment,
        isCheckoutPaid,
        isCheckoutConverted,
        getCheckoutStatusMetadata,
        getCheckoutStatusLabel,
        getCheckoutStatusShortLabel,
        getCheckoutStatusDescription,
        getCheckoutStatusTone,
        getCheckoutStatusActionLabel,
        getAllowedNextCheckoutStatuses,
        canTransitionCheckoutStatus,
        getActorRoleLabel,
        validateCheckoutStatusTransition
    };

    /* istanbul ignore else */
    if (typeof module !== "undefined" && module.exports) {
        module.exports = checkoutStatus;
    }

    /* istanbul ignore else */
    if (typeof globalScope !== "undefined") {
        globalScope.checkoutStatus = checkoutStatus;
    }
/* istanbul ignore next */
})(typeof window !== "undefined" ? window : globalThis);
