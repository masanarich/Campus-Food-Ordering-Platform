(function attachOrderStatus(globalScope) {
    "use strict";

    const MODULE_NAME = "order-status";

    const ORDER_STATUSES = Object.freeze({
        PENDING: "pending",
        ACCEPTED: "accepted",
        PREPARING: "preparing",
        READY: "ready",
        COMPLETED: "completed",
        REJECTED: "rejected",
        CANCELLED: "cancelled"
    });

    const ORDER_ACTOR_ROLES = Object.freeze({
        CUSTOMER: "customer",
        VENDOR: "vendor",
        ADMIN: "admin",
        SYSTEM: "system"
    });

    const ORDER_STATUS_LIST = Object.freeze([
        ORDER_STATUSES.PENDING,
        ORDER_STATUSES.ACCEPTED,
        ORDER_STATUSES.PREPARING,
        ORDER_STATUSES.READY,
        ORDER_STATUSES.COMPLETED,
        ORDER_STATUSES.REJECTED,
        ORDER_STATUSES.CANCELLED
    ]);

    const PRIMARY_ORDER_STATUS_LIST = Object.freeze([
        ORDER_STATUSES.PENDING,
        ORDER_STATUSES.ACCEPTED,
        ORDER_STATUSES.PREPARING,
        ORDER_STATUSES.READY,
        ORDER_STATUSES.COMPLETED
    ]);

    const TERMINAL_ORDER_STATUSES = Object.freeze([
        ORDER_STATUSES.COMPLETED,
        ORDER_STATUSES.REJECTED,
        ORDER_STATUSES.CANCELLED
    ]);

    const STATUS_METADATA = Object.freeze({
        [ORDER_STATUSES.PENDING]: Object.freeze({
            label: "Order Received",
            shortLabel: "Pending",
            description: "The order was placed and is waiting for the vendor to respond.",
            tone: "info",
            actionLabel: "Mark as Received"
        }),
        [ORDER_STATUSES.ACCEPTED]: Object.freeze({
            label: "Accepted",
            shortLabel: "Accepted",
            description: "The vendor accepted the order and will start working on it soon.",
            tone: "info",
            actionLabel: "Accept Order"
        }),
        [ORDER_STATUSES.PREPARING]: Object.freeze({
            label: "Preparing",
            shortLabel: "Preparing",
            description: "The vendor is actively preparing the order.",
            tone: "loading",
            actionLabel: "Start Preparing"
        }),
        [ORDER_STATUSES.READY]: Object.freeze({
            label: "Ready for Pickup",
            shortLabel: "Ready",
            description: "The order is ready for collection.",
            tone: "success",
            actionLabel: "Mark Ready for Pickup"
        }),
        [ORDER_STATUSES.COMPLETED]: Object.freeze({
            label: "Completed",
            shortLabel: "Completed",
            description: "The order has been collected and the ticket is now closed.",
            tone: "success",
            actionLabel: "Complete Order"
        }),
        [ORDER_STATUSES.REJECTED]: Object.freeze({
            label: "Rejected",
            shortLabel: "Rejected",
            description: "The vendor declined the order and it will not be prepared.",
            tone: "error",
            actionLabel: "Reject Order"
        }),
        [ORDER_STATUSES.CANCELLED]: Object.freeze({
            label: "Cancelled",
            shortLabel: "Cancelled",
            description: "The order was cancelled before it could be completed.",
            tone: "error",
            actionLabel: "Cancel Order"
        })
    });

    const ORDER_STATUS_ALIASES = Object.freeze({
        pending: ORDER_STATUSES.PENDING,
        received: ORDER_STATUSES.PENDING,
        created: ORDER_STATUSES.PENDING,
        orderreceived: ORDER_STATUSES.PENDING,

        accepted: ORDER_STATUSES.ACCEPTED,
        approved: ORDER_STATUSES.ACCEPTED,
        confirmed: ORDER_STATUSES.ACCEPTED,

        preparing: ORDER_STATUSES.PREPARING,
        processing: ORDER_STATUSES.PREPARING,
        inprogress: ORDER_STATUSES.PREPARING,

        ready: ORDER_STATUSES.READY,
        readyforpickup: ORDER_STATUSES.READY,
        readyforcollection: ORDER_STATUSES.READY,

        completed: ORDER_STATUSES.COMPLETED,
        complete: ORDER_STATUSES.COMPLETED,
        collected: ORDER_STATUSES.COMPLETED,
        closed: ORDER_STATUSES.COMPLETED,

        rejected: ORDER_STATUSES.REJECTED,
        declined: ORDER_STATUSES.REJECTED,

        cancelled: ORDER_STATUSES.CANCELLED,
        canceled: ORDER_STATUSES.CANCELLED
    });

    const ORDER_ACTOR_ROLE_ALIASES = Object.freeze({
        customer: ORDER_ACTOR_ROLES.CUSTOMER,
        student: ORDER_ACTOR_ROLES.CUSTOMER,
        vendor: ORDER_ACTOR_ROLES.VENDOR,
        shop: ORDER_ACTOR_ROLES.VENDOR,
        admin: ORDER_ACTOR_ROLES.ADMIN,
        system: ORDER_ACTOR_ROLES.SYSTEM,
        app: ORDER_ACTOR_ROLES.SYSTEM
    });

    const ORDER_STATUS_TRANSITIONS = Object.freeze({
        [ORDER_ACTOR_ROLES.CUSTOMER]: Object.freeze({
            [ORDER_STATUSES.PENDING]: Object.freeze([ORDER_STATUSES.CANCELLED]),
            [ORDER_STATUSES.ACCEPTED]: Object.freeze([]),
            [ORDER_STATUSES.PREPARING]: Object.freeze([]),
            [ORDER_STATUSES.READY]: Object.freeze([ORDER_STATUSES.COMPLETED]),
            [ORDER_STATUSES.COMPLETED]: Object.freeze([]),
            [ORDER_STATUSES.REJECTED]: Object.freeze([]),
            [ORDER_STATUSES.CANCELLED]: Object.freeze([])
        }),
        [ORDER_ACTOR_ROLES.VENDOR]: Object.freeze({
            [ORDER_STATUSES.PENDING]: Object.freeze([ORDER_STATUSES.ACCEPTED, ORDER_STATUSES.REJECTED]),
            [ORDER_STATUSES.ACCEPTED]: Object.freeze([ORDER_STATUSES.PREPARING]),
            [ORDER_STATUSES.PREPARING]: Object.freeze([ORDER_STATUSES.READY]),
            [ORDER_STATUSES.READY]: Object.freeze([ORDER_STATUSES.COMPLETED]),
            [ORDER_STATUSES.COMPLETED]: Object.freeze([]),
            [ORDER_STATUSES.REJECTED]: Object.freeze([]),
            [ORDER_STATUSES.CANCELLED]: Object.freeze([])
        }),
        [ORDER_ACTOR_ROLES.ADMIN]: Object.freeze({
            [ORDER_STATUSES.PENDING]: Object.freeze([ORDER_STATUSES.ACCEPTED, ORDER_STATUSES.REJECTED, ORDER_STATUSES.CANCELLED]),
            [ORDER_STATUSES.ACCEPTED]: Object.freeze([ORDER_STATUSES.PREPARING, ORDER_STATUSES.REJECTED, ORDER_STATUSES.CANCELLED]),
            [ORDER_STATUSES.PREPARING]: Object.freeze([ORDER_STATUSES.READY, ORDER_STATUSES.CANCELLED]),
            [ORDER_STATUSES.READY]: Object.freeze([ORDER_STATUSES.COMPLETED]),
            [ORDER_STATUSES.COMPLETED]: Object.freeze([]),
            [ORDER_STATUSES.REJECTED]: Object.freeze([]),
            [ORDER_STATUSES.CANCELLED]: Object.freeze([])
        }),
        [ORDER_ACTOR_ROLES.SYSTEM]: Object.freeze({
            [ORDER_STATUSES.PENDING]: Object.freeze([ORDER_STATUSES.ACCEPTED, ORDER_STATUSES.REJECTED, ORDER_STATUSES.CANCELLED]),
            [ORDER_STATUSES.ACCEPTED]: Object.freeze([ORDER_STATUSES.PREPARING, ORDER_STATUSES.REJECTED, ORDER_STATUSES.CANCELLED]),
            [ORDER_STATUSES.PREPARING]: Object.freeze([ORDER_STATUSES.READY, ORDER_STATUSES.CANCELLED]),
            [ORDER_STATUSES.READY]: Object.freeze([ORDER_STATUSES.COMPLETED]),
            [ORDER_STATUSES.COMPLETED]: Object.freeze([]),
            [ORDER_STATUSES.REJECTED]: Object.freeze([]),
            [ORDER_STATUSES.CANCELLED]: Object.freeze([])
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

    function normalizeOrderStatus(status, fallbackStatus) {
        const statusKey = normalizeStatusKey(status);
        const fallbackKey = normalizeStatusKey(fallbackStatus);

        if (Object.prototype.hasOwnProperty.call(ORDER_STATUS_ALIASES, statusKey)) {
            return ORDER_STATUS_ALIASES[statusKey];
        }

        if (Object.prototype.hasOwnProperty.call(ORDER_STATUS_ALIASES, fallbackKey)) {
            return ORDER_STATUS_ALIASES[fallbackKey];
        }

        return "";
    }

    function normalizeOrderActorRole(role) {
        const key = normalizeStatusKey(role);

        if (Object.prototype.hasOwnProperty.call(ORDER_ACTOR_ROLE_ALIASES, key)) {
            return ORDER_ACTOR_ROLE_ALIASES[key];
        }

        return "";
    }

    function getDefaultOrderStatus() {
        return ORDER_STATUSES.PENDING;
    }

    function getOrderStatusList() {
        return ORDER_STATUS_LIST.slice();
    }

    function getPrimaryOrderStatusList() {
        return PRIMARY_ORDER_STATUS_LIST.slice();
    }

    function getTrackingOrderStatusList() {
        return getPrimaryOrderStatusList();
    }

    function getTerminalOrderStatusList() {
        return TERMINAL_ORDER_STATUSES.slice();
    }

    function isKnownOrderStatus(status) {
        return normalizeOrderStatus(status).length > 0;
    }

    function isTerminalOrderStatus(status) {
        const normalizedStatus = normalizeOrderStatus(status);
        return TERMINAL_ORDER_STATUSES.indexOf(normalizedStatus) >= 0;
    }

    function getOrderStatusMetadata(status) {
        const normalizedStatus = normalizeOrderStatus(status);
        const metadata = STATUS_METADATA[normalizedStatus];

        if (!metadata) {
            return {
                key: "",
                label: "Unknown Status",
                shortLabel: "Unknown",
                description: "The order status is not recognized yet.",
                tone: "info",
                actionLabel: "Update Order"
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

    function getOrderStatusLabel(status) {
        return getOrderStatusMetadata(status).label;
    }

    function getOrderStatusShortLabel(status) {
        return getOrderStatusMetadata(status).shortLabel;
    }

    function getOrderStatusDescription(status) {
        return getOrderStatusMetadata(status).description;
    }

    function getOrderStatusTone(status) {
        return getOrderStatusMetadata(status).tone;
    }

    function getOrderStatusActionLabel(status) {
        return getOrderStatusMetadata(status).actionLabel;
    }

    function getStatusProgressIndex(status) {
        return PRIMARY_ORDER_STATUS_LIST.indexOf(normalizeOrderStatus(status));
    }

    function getAllowedNextStatuses(currentStatus, actorRole) {
        const normalizedStatus = normalizeOrderStatus(currentStatus);
        const normalizedRole = normalizeOrderActorRole(actorRole);

        if (!normalizedStatus || !normalizedRole) {
            return [];
        }

        const roleTransitions = ORDER_STATUS_TRANSITIONS[normalizedRole];
        const transitions = roleTransitions && roleTransitions[normalizedStatus];

        return Array.isArray(transitions) ? transitions.slice() : [];
    }

    function canTransitionOrderStatus(currentStatus, nextStatus, actorRole) {
        return validateOrderStatusTransition(currentStatus, nextStatus, actorRole).isValid;
    }

    function getActorRoleLabel(actorRole) {
        const normalizedRole = normalizeOrderActorRole(actorRole);

        if (normalizedRole === ORDER_ACTOR_ROLES.CUSTOMER) {
            return "Customers";
        }

        if (normalizedRole === ORDER_ACTOR_ROLES.VENDOR) {
            return "Vendors";
        }

        if (normalizedRole === ORDER_ACTOR_ROLES.ADMIN) {
            return "Admins";
        }

        if (normalizedRole === ORDER_ACTOR_ROLES.SYSTEM) {
            return "The system";
        }

        return "This actor";
    }

    function validateOrderStatusTransition(currentStatus, nextStatus, actorRole) {
        const normalizedCurrentStatus = normalizeOrderStatus(currentStatus);
        const normalizedNextStatus = normalizeOrderStatus(nextStatus);
        const normalizedActorRole = normalizeOrderActorRole(actorRole);
        const currentLabel = getOrderStatusLabel(normalizedCurrentStatus);
        const nextLabel = getOrderStatusLabel(normalizedNextStatus);

        if (!normalizedActorRole) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                actorRole: normalizedActorRole,
                message: "A valid actor role is required before changing order status."
            };
        }

        if (!normalizedCurrentStatus) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                actorRole: normalizedActorRole,
                message: "The current order status is invalid."
            };
        }

        if (!normalizedNextStatus) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                actorRole: normalizedActorRole,
                message: "The next order status is invalid."
            };
        }

        if (normalizedCurrentStatus === normalizedNextStatus) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                actorRole: normalizedActorRole,
                message: `The order is already marked as ${nextLabel}.`
            };
        }

        if (isTerminalOrderStatus(normalizedCurrentStatus)) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                actorRole: normalizedActorRole,
                message: `${currentLabel} orders cannot transition to another status.`
            };
        }

        if (getAllowedNextStatuses(normalizedCurrentStatus, normalizedActorRole).indexOf(normalizedNextStatus) === -1) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                actorRole: normalizedActorRole,
                message: `${getActorRoleLabel(normalizedActorRole)} cannot move an order from ${currentLabel} to ${nextLabel}.`
            };
        }

        return {
            isValid: true,
            currentStatus: normalizedCurrentStatus,
            nextStatus: normalizedNextStatus,
            actorRole: normalizedActorRole,
            message: `${getActorRoleLabel(normalizedActorRole)} can move an order from ${currentLabel} to ${nextLabel}.`
        };
    }

    const orderStatus = {
        MODULE_NAME,
        ORDER_STATUSES,
        ORDER_ACTOR_ROLES,
        normalizeText,
        normalizeLowerText,
        normalizeStatusKey,
        normalizeOrderStatus,
        normalizeOrderActorRole,
        getDefaultOrderStatus,
        getOrderStatusList,
        getPrimaryOrderStatusList,
        getTrackingOrderStatusList,
        getTerminalOrderStatusList,
        isKnownOrderStatus,
        isTerminalOrderStatus,
        getOrderStatusMetadata,
        getOrderStatusLabel,
        getOrderStatusShortLabel,
        getOrderStatusDescription,
        getOrderStatusTone,
        getOrderStatusActionLabel,
        getStatusProgressIndex,
        getAllowedNextStatuses,
        canTransitionOrderStatus,
        validateOrderStatusTransition
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = orderStatus;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.orderStatus = orderStatus;
    }
})(typeof window !== "undefined" ? window : globalThis);
