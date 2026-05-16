(function attachTicketStatus(globalScope) {
    "use strict";

    const MODULE_NAME = "ticket-status";

    const TICKET_STATUSES = Object.freeze({
        OPEN: "open",
        IN_PROGRESS: "in_progress",
        AWAITING_USER: "awaiting_user",
        RESOLVED: "resolved",
        CLOSED: "closed"
    });

    const TICKET_ACTOR_ROLES = Object.freeze({
        CUSTOMER: "customer",
        VENDOR: "vendor",
        ADMIN: "admin",
        SYSTEM: "system"
    });

    const TICKET_STATUS_LIST = Object.freeze([
        TICKET_STATUSES.OPEN,
        TICKET_STATUSES.IN_PROGRESS,
        TICKET_STATUSES.AWAITING_USER,
        TICKET_STATUSES.RESOLVED,
        TICKET_STATUSES.CLOSED
    ]);

    const TICKET_LIFECYCLE_LIST = Object.freeze([
        TICKET_STATUSES.OPEN,
        TICKET_STATUSES.IN_PROGRESS,
        TICKET_STATUSES.AWAITING_USER,
        TICKET_STATUSES.RESOLVED,
        TICKET_STATUSES.CLOSED
    ]);

    const ACTIVE_TICKET_STATUSES = Object.freeze([
        TICKET_STATUSES.OPEN,
        TICKET_STATUSES.IN_PROGRESS,
        TICKET_STATUSES.AWAITING_USER
    ]);

    const CLOSED_TICKET_STATUSES = Object.freeze([
        TICKET_STATUSES.RESOLVED,
        TICKET_STATUSES.CLOSED
    ]);

    const STATUS_METADATA = Object.freeze({
        [TICKET_STATUSES.OPEN]: Object.freeze({
            label: "Open",
            shortLabel: "Open",
            description: "The ticket has been filed and is waiting for the support team to pick it up.",
            tone: "info",
            actionLabel: "Open Ticket"
        }),
        [TICKET_STATUSES.IN_PROGRESS]: Object.freeze({
            label: "In Progress",
            shortLabel: "Active",
            description: "An admin is actively working on this ticket.",
            tone: "loading",
            actionLabel: "Mark In Progress"
        }),
        [TICKET_STATUSES.AWAITING_USER]: Object.freeze({
            label: "Awaiting User",
            shortLabel: "Awaiting User",
            description: "The support team has asked the reporter for more information and is waiting for a reply.",
            tone: "info",
            actionLabel: "Request More Info"
        }),
        [TICKET_STATUSES.RESOLVED]: Object.freeze({
            label: "Resolved",
            shortLabel: "Resolved",
            description: "The support team has resolved the ticket. The reporter can confirm or reopen it.",
            tone: "success",
            actionLabel: "Mark Resolved"
        }),
        [TICKET_STATUSES.CLOSED]: Object.freeze({
            label: "Closed",
            shortLabel: "Closed",
            description: "The ticket is closed. It can be reopened if the issue happens again.",
            tone: "muted",
            actionLabel: "Close Ticket"
        })
    });

    const TICKET_STATUS_ALIASES = Object.freeze({
        open: TICKET_STATUSES.OPEN,
        opened: TICKET_STATUSES.OPEN,
        new: TICKET_STATUSES.OPEN,
        filed: TICKET_STATUSES.OPEN,
        submitted: TICKET_STATUSES.OPEN,
        reopened: TICKET_STATUSES.OPEN,

        inprogress: TICKET_STATUSES.IN_PROGRESS,
        active: TICKET_STATUSES.IN_PROGRESS,
        triage: TICKET_STATUSES.IN_PROGRESS,
        working: TICKET_STATUSES.IN_PROGRESS,

        awaitinguser: TICKET_STATUSES.AWAITING_USER,
        awaiting: TICKET_STATUSES.AWAITING_USER,
        awaitingreply: TICKET_STATUSES.AWAITING_USER,
        pendinguser: TICKET_STATUSES.AWAITING_USER,
        waitingforuser: TICKET_STATUSES.AWAITING_USER,

        resolved: TICKET_STATUSES.RESOLVED,
        fixed: TICKET_STATUSES.RESOLVED,
        solved: TICKET_STATUSES.RESOLVED,
        done: TICKET_STATUSES.RESOLVED,

        closed: TICKET_STATUSES.CLOSED,
        archived: TICKET_STATUSES.CLOSED,
        complete: TICKET_STATUSES.CLOSED,
        completed: TICKET_STATUSES.CLOSED
    });

    const TICKET_ACTOR_ROLE_ALIASES = Object.freeze({
        customer: TICKET_ACTOR_ROLES.CUSTOMER,
        student: TICKET_ACTOR_ROLES.CUSTOMER,
        buyer: TICKET_ACTOR_ROLES.CUSTOMER,
        reporter: TICKET_ACTOR_ROLES.CUSTOMER,

        vendor: TICKET_ACTOR_ROLES.VENDOR,
        shop: TICKET_ACTOR_ROLES.VENDOR,
        merchant: TICKET_ACTOR_ROLES.VENDOR,
        seller: TICKET_ACTOR_ROLES.VENDOR,

        admin: TICKET_ACTOR_ROLES.ADMIN,
        support: TICKET_ACTOR_ROLES.ADMIN,
        staff: TICKET_ACTOR_ROLES.ADMIN,

        system: TICKET_ACTOR_ROLES.SYSTEM,
        app: TICKET_ACTOR_ROLES.SYSTEM,
        bot: TICKET_ACTOR_ROLES.SYSTEM,
        automation: TICKET_ACTOR_ROLES.SYSTEM
    });

    const REPORTER_TRANSITIONS = Object.freeze({
        [TICKET_STATUSES.OPEN]: Object.freeze([TICKET_STATUSES.CLOSED]),
        [TICKET_STATUSES.IN_PROGRESS]: Object.freeze([]),
        [TICKET_STATUSES.AWAITING_USER]: Object.freeze([TICKET_STATUSES.IN_PROGRESS]),
        [TICKET_STATUSES.RESOLVED]: Object.freeze([TICKET_STATUSES.IN_PROGRESS, TICKET_STATUSES.CLOSED]),
        [TICKET_STATUSES.CLOSED]: Object.freeze([TICKET_STATUSES.OPEN])
    });

    const ADMIN_TRANSITIONS = Object.freeze({
        [TICKET_STATUSES.OPEN]: Object.freeze([
            TICKET_STATUSES.IN_PROGRESS,
            TICKET_STATUSES.AWAITING_USER,
            TICKET_STATUSES.RESOLVED,
            TICKET_STATUSES.CLOSED
        ]),
        [TICKET_STATUSES.IN_PROGRESS]: Object.freeze([
            TICKET_STATUSES.OPEN,
            TICKET_STATUSES.AWAITING_USER,
            TICKET_STATUSES.RESOLVED,
            TICKET_STATUSES.CLOSED
        ]),
        [TICKET_STATUSES.AWAITING_USER]: Object.freeze([
            TICKET_STATUSES.IN_PROGRESS,
            TICKET_STATUSES.RESOLVED,
            TICKET_STATUSES.CLOSED
        ]),
        [TICKET_STATUSES.RESOLVED]: Object.freeze([
            TICKET_STATUSES.IN_PROGRESS,
            TICKET_STATUSES.CLOSED
        ]),
        [TICKET_STATUSES.CLOSED]: Object.freeze([
            TICKET_STATUSES.OPEN,
            TICKET_STATUSES.IN_PROGRESS
        ])
    });

    const TICKET_STATUS_TRANSITIONS = Object.freeze({
        [TICKET_ACTOR_ROLES.CUSTOMER]: REPORTER_TRANSITIONS,
        [TICKET_ACTOR_ROLES.VENDOR]: REPORTER_TRANSITIONS,
        [TICKET_ACTOR_ROLES.ADMIN]: ADMIN_TRANSITIONS,
        [TICKET_ACTOR_ROLES.SYSTEM]: ADMIN_TRANSITIONS
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

    function normalizeTicketStatus(status, fallbackStatus) {
        const statusKey = normalizeStatusKey(status);
        const fallbackKey = normalizeStatusKey(fallbackStatus);

        if (Object.prototype.hasOwnProperty.call(TICKET_STATUS_ALIASES, statusKey)) {
            return TICKET_STATUS_ALIASES[statusKey];
        }

        if (Object.prototype.hasOwnProperty.call(TICKET_STATUS_ALIASES, fallbackKey)) {
            return TICKET_STATUS_ALIASES[fallbackKey];
        }

        return "";
    }

    function normalizeTicketActorRole(role) {
        const key = normalizeStatusKey(role);

        if (Object.prototype.hasOwnProperty.call(TICKET_ACTOR_ROLE_ALIASES, key)) {
            return TICKET_ACTOR_ROLE_ALIASES[key];
        }

        return "";
    }

    function getDefaultTicketStatus() {
        return TICKET_STATUSES.OPEN;
    }

    function getTicketStatusList() {
        return TICKET_STATUS_LIST.slice();
    }

    function getTicketLifecycleList() {
        return TICKET_LIFECYCLE_LIST.slice();
    }

    function getActiveTicketStatusList() {
        return ACTIVE_TICKET_STATUSES.slice();
    }

    function getClosedTicketStatusList() {
        return CLOSED_TICKET_STATUSES.slice();
    }

    function isKnownTicketStatus(status) {
        const normalized = normalizeStatusKey(status);
        return Object.prototype.hasOwnProperty.call(TICKET_STATUS_ALIASES, normalized);
    }

    function isActiveTicketStatus(status) {
        const normalized = normalizeTicketStatus(status);
        return ACTIVE_TICKET_STATUSES.indexOf(normalized) !== -1;
    }

    function isClosedTicketStatus(status) {
        const normalized = normalizeTicketStatus(status);
        return CLOSED_TICKET_STATUSES.indexOf(normalized) !== -1;
    }

    function isTerminalTicketStatus(status) {
        // No status is strictly terminal in the ticket lifecycle — closed and
        // resolved tickets can both be reopened by the right actor. This helper
        // is kept so the model API stays parallel to order-status.
        return false; // eslint-disable-line no-unused-vars
    }

    function getTicketStatusMetadata(status) {
        const normalizedStatus = normalizeTicketStatus(status);
        const metadata = STATUS_METADATA[normalizedStatus];

        if (!metadata) {
            return {
                key: "",
                label: "Unknown Status",
                shortLabel: "Unknown",
                description: "The ticket status is not recognised yet.",
                tone: "info",
                actionLabel: "Update Ticket"
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

    function getTicketStatusLabel(status) {
        return getTicketStatusMetadata(status).label;
    }

    function getTicketStatusShortLabel(status) {
        return getTicketStatusMetadata(status).shortLabel;
    }

    function getTicketStatusDescription(status) {
        return getTicketStatusMetadata(status).description;
    }

    function getTicketStatusTone(status) {
        return getTicketStatusMetadata(status).tone;
    }

    function getTicketStatusActionLabel(status) {
        return getTicketStatusMetadata(status).actionLabel;
    }

    function getStatusProgressIndex(status) {
        return TICKET_LIFECYCLE_LIST.indexOf(normalizeTicketStatus(status));
    }

    function getAllowedNextStatuses(currentStatus, actorRole) {
        const normalizedStatus = normalizeTicketStatus(currentStatus);
        const normalizedRole = normalizeTicketActorRole(actorRole);

        if (!normalizedRole || !normalizedStatus) {
            return [];
        }

        const roleTransitions = TICKET_STATUS_TRANSITIONS[normalizedRole];
        const transitions = roleTransitions && roleTransitions[normalizedStatus];

        return Array.isArray(transitions) ? transitions.slice() : [];
    }

    function canTransitionTicketStatus(currentStatus, nextStatus, actorRole) {
        return validateTicketStatusTransition(currentStatus, nextStatus, actorRole).isValid;
    }

    function getActorRoleLabel(actorRole) {
        const normalizedRole = normalizeTicketActorRole(actorRole);

        if (normalizedRole === TICKET_ACTOR_ROLES.CUSTOMER) {
            return "Customers";
        }

        if (normalizedRole === TICKET_ACTOR_ROLES.VENDOR) {
            return "Vendors";
        }

        if (normalizedRole === TICKET_ACTOR_ROLES.ADMIN) {
            return "Admins";
        }

        if (normalizedRole === TICKET_ACTOR_ROLES.SYSTEM) {
            return "The system";
        }

        return "This actor";
    }

    function validateTicketStatusTransition(currentStatus, nextStatus, actorRole) {
        const normalizedCurrentStatus = normalizeTicketStatus(currentStatus);
        const normalizedNextStatus = normalizeTicketStatus(nextStatus);
        const normalizedActorRole = normalizeTicketActorRole(actorRole);
        const currentLabel = getTicketStatusLabel(normalizedCurrentStatus);
        const nextLabel = getTicketStatusLabel(normalizedNextStatus);

        if (!normalizedActorRole) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                actorRole: normalizedActorRole,
                message: "A valid actor role is required before changing ticket status."
            };
        }

        if (!normalizedCurrentStatus) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                actorRole: normalizedActorRole,
                message: "The current ticket status is invalid."
            };
        }

        if (!normalizedNextStatus) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                actorRole: normalizedActorRole,
                message: "The next ticket status is invalid."
            };
        }

        if (normalizedCurrentStatus === normalizedNextStatus) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                actorRole: normalizedActorRole,
                message: `The ticket is already marked as ${nextLabel}.`
            };
        }

        if (getAllowedNextStatuses(normalizedCurrentStatus, normalizedActorRole).indexOf(normalizedNextStatus) === -1) {
            return {
                isValid: false,
                currentStatus: normalizedCurrentStatus,
                nextStatus: normalizedNextStatus,
                actorRole: normalizedActorRole,
                message: `${getActorRoleLabel(normalizedActorRole)} cannot move a ticket from ${currentLabel} to ${nextLabel}.`
            };
        }

        return {
            isValid: true,
            currentStatus: normalizedCurrentStatus,
            nextStatus: normalizedNextStatus,
            actorRole: normalizedActorRole,
            message: `${getActorRoleLabel(normalizedActorRole)} can move a ticket from ${currentLabel} to ${nextLabel}.`
        };
    }

    const ticketStatus = {
        MODULE_NAME,
        TICKET_STATUSES,
        TICKET_ACTOR_ROLES,
        normalizeText,
        normalizeLowerText,
        normalizeStatusKey,
        normalizeTicketStatus,
        normalizeTicketActorRole,
        getDefaultTicketStatus,
        getTicketStatusList,
        getTicketLifecycleList,
        getActiveTicketStatusList,
        getClosedTicketStatusList,
        isKnownTicketStatus,
        isActiveTicketStatus,
        isClosedTicketStatus,
        isTerminalTicketStatus,
        getTicketStatusMetadata,
        getTicketStatusLabel,
        getTicketStatusShortLabel,
        getTicketStatusDescription,
        getTicketStatusTone,
        getTicketStatusActionLabel,
        getStatusProgressIndex,
        getAllowedNextStatuses,
        canTransitionTicketStatus,
        getActorRoleLabel,
        validateTicketStatusTransition
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = ticketStatus;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.ticketStatus = ticketStatus;
    }
})(typeof window !== "undefined" ? window : globalThis);
