(function attachRefundCaseModel(globalScope) {
    "use strict";

    const MODULE_NAME = "refund-case-model";
    const DEFAULT_CURRENCY = "ZAR";
    const DEFAULT_REFUND_CASE_STATUS = "not_requested";
    const DEFAULT_REFUND_TYPE = "partial";
    const DEFAULT_DECISION = "pending";

    const REFUND_CASE_STATUSES = Object.freeze({
        NOT_REQUESTED: "not_requested",
        PROPOSED: "proposed",
        CUSTOMER_APPROVED: "customer_approved",
        VENDOR_APPROVED: "vendor_approved",
        APPROVED: "approved",
        PROCESSING: "processing",
        REFUNDED: "refunded",
        DECLINED: "declined",
        FAILED: "failed",
        CANCELLED: "cancelled"
    });

    const REFUND_CASE_STATUS_LIST = Object.freeze([
        REFUND_CASE_STATUSES.NOT_REQUESTED,
        REFUND_CASE_STATUSES.PROPOSED,
        REFUND_CASE_STATUSES.CUSTOMER_APPROVED,
        REFUND_CASE_STATUSES.VENDOR_APPROVED,
        REFUND_CASE_STATUSES.APPROVED,
        REFUND_CASE_STATUSES.PROCESSING,
        REFUND_CASE_STATUSES.REFUNDED,
        REFUND_CASE_STATUSES.DECLINED,
        REFUND_CASE_STATUSES.FAILED,
        REFUND_CASE_STATUSES.CANCELLED
    ]);

    const REFUND_CASE_STATUS_ALIASES = Object.freeze({
        none: REFUND_CASE_STATUSES.NOT_REQUESTED,
        no: REFUND_CASE_STATUSES.NOT_REQUESTED,
        notrequested: REFUND_CASE_STATUSES.NOT_REQUESTED,
        notrequired: REFUND_CASE_STATUSES.NOT_REQUESTED,
        new: REFUND_CASE_STATUSES.NOT_REQUESTED,

        proposed: REFUND_CASE_STATUSES.PROPOSED,
        proposal: REFUND_CASE_STATUSES.PROPOSED,
        requested: REFUND_CASE_STATUSES.PROPOSED,
        refundrequested: REFUND_CASE_STATUSES.PROPOSED,

        customerapproved: REFUND_CASE_STATUSES.CUSTOMER_APPROVED,
        customeragreed: REFUND_CASE_STATUSES.CUSTOMER_APPROVED,
        approvedbycustomer: REFUND_CASE_STATUSES.CUSTOMER_APPROVED,

        vendorapproved: REFUND_CASE_STATUSES.VENDOR_APPROVED,
        vendoragreed: REFUND_CASE_STATUSES.VENDOR_APPROVED,
        approvedbyvendor: REFUND_CASE_STATUSES.VENDOR_APPROVED,

        approved: REFUND_CASE_STATUSES.APPROVED,
        agreed: REFUND_CASE_STATUSES.APPROVED,
        bothapproved: REFUND_CASE_STATUSES.APPROVED,
        ready: REFUND_CASE_STATUSES.APPROVED,

        processing: REFUND_CASE_STATUSES.PROCESSING,
        inprogress: REFUND_CASE_STATUSES.PROCESSING,
        submitted: REFUND_CASE_STATUSES.PROCESSING,
        providerprocessing: REFUND_CASE_STATUSES.PROCESSING,

        refunded: REFUND_CASE_STATUSES.REFUNDED,
        paid: REFUND_CASE_STATUSES.REFUNDED,
        complete: REFUND_CASE_STATUSES.REFUNDED,
        completed: REFUND_CASE_STATUSES.REFUNDED,
        processed: REFUND_CASE_STATUSES.REFUNDED,
        successful: REFUND_CASE_STATUSES.REFUNDED,
        success: REFUND_CASE_STATUSES.REFUNDED,

        declined: REFUND_CASE_STATUSES.DECLINED,
        rejected: REFUND_CASE_STATUSES.DECLINED,
        denied: REFUND_CASE_STATUSES.DECLINED,

        failed: REFUND_CASE_STATUSES.FAILED,
        failure: REFUND_CASE_STATUSES.FAILED,
        error: REFUND_CASE_STATUSES.FAILED,

        cancelled: REFUND_CASE_STATUSES.CANCELLED,
        canceled: REFUND_CASE_STATUSES.CANCELLED,
        void: REFUND_CASE_STATUSES.CANCELLED
    });

    const REFUND_CASE_STATUS_METADATA = Object.freeze({
        [REFUND_CASE_STATUSES.NOT_REQUESTED]: Object.freeze({
            label: "Refund Not Requested",
            shortLabel: "No Refund",
            tone: "neutral",
            description: "No refund workflow has been opened for this ticket."
        }),
        [REFUND_CASE_STATUSES.PROPOSED]: Object.freeze({
            label: "Refund Proposed",
            shortLabel: "Proposed",
            tone: "warning",
            description: "An admin has proposed a refund and both parties must respond."
        }),
        [REFUND_CASE_STATUSES.CUSTOMER_APPROVED]: Object.freeze({
            label: "Customer Approved",
            shortLabel: "Customer Agreed",
            tone: "loading",
            description: "The customer agreed to the refund. The vendor still needs to respond."
        }),
        [REFUND_CASE_STATUSES.VENDOR_APPROVED]: Object.freeze({
            label: "Vendor Approved",
            shortLabel: "Vendor Agreed",
            tone: "loading",
            description: "The vendor agreed to the refund. The customer still needs to respond."
        }),
        [REFUND_CASE_STATUSES.APPROVED]: Object.freeze({
            label: "Refund Approved",
            shortLabel: "Approved",
            tone: "success",
            description: "Both parties agreed. An admin can now execute the refund."
        }),
        [REFUND_CASE_STATUSES.PROCESSING]: Object.freeze({
            label: "Refund Processing",
            shortLabel: "Processing",
            tone: "loading",
            description: "The refund has been sent for payment-provider processing."
        }),
        [REFUND_CASE_STATUSES.REFUNDED]: Object.freeze({
            label: "Customer Refunded",
            shortLabel: "Refunded",
            tone: "success",
            description: "The customer has been refunded and finance totals should reflect it."
        }),
        [REFUND_CASE_STATUSES.DECLINED]: Object.freeze({
            label: "Refund Declined",
            shortLabel: "Declined",
            tone: "error",
            description: "At least one party declined the proposed refund."
        }),
        [REFUND_CASE_STATUSES.FAILED]: Object.freeze({
            label: "Refund Failed",
            shortLabel: "Failed",
            tone: "error",
            description: "The refund could not be completed and needs admin review."
        }),
        [REFUND_CASE_STATUSES.CANCELLED]: Object.freeze({
            label: "Refund Cancelled",
            shortLabel: "Cancelled",
            tone: "muted",
            description: "The refund workflow was cancelled before completion."
        })
    });

    const REFUND_TYPES = Object.freeze({
        PARTIAL: "partial",
        FULL: "full"
    });

    const REFUND_TYPE_LIST = Object.freeze([
        REFUND_TYPES.PARTIAL,
        REFUND_TYPES.FULL
    ]);

    const DECISIONS = Object.freeze({
        PENDING: "pending",
        APPROVED: "approved",
        DECLINED: "declined"
    });

    const DECISION_LIST = Object.freeze([
        DECISIONS.PENDING,
        DECISIONS.APPROVED,
        DECISIONS.DECLINED
    ]);

    const DECISION_ACTOR_ROLES = Object.freeze({
        CUSTOMER: "customer",
        VENDOR: "vendor",
        ADMIN: "admin",
        SYSTEM: "system"
    });

    const TERMINAL_REFUND_CASE_STATUSES = Object.freeze([
        REFUND_CASE_STATUSES.REFUNDED,
        REFUND_CASE_STATUSES.DECLINED,
        REFUND_CASE_STATUSES.CANCELLED
    ]);

    const ACTIVE_REFUND_CASE_STATUSES = Object.freeze([
        REFUND_CASE_STATUSES.PROPOSED,
        REFUND_CASE_STATUSES.CUSTOMER_APPROVED,
        REFUND_CASE_STATUSES.VENDOR_APPROVED,
        REFUND_CASE_STATUSES.APPROVED,
        REFUND_CASE_STATUSES.PROCESSING,
        REFUND_CASE_STATUSES.FAILED
    ]);

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

    function normalizeBoolean(value) {
        if (value === true || value === false) {
            return value;
        }

        if (value === 1 || value === "1") {
            return true;
        }

        if (value === 0 || value === "0") {
            return false;
        }

        const normalized = normalizeLowerText(value);

        if (normalized === "true" || normalized === "yes") {
            return true;
        }

        if (normalized === "false" || normalized === "no") {
            return false;
        }

        return false;
    }

    function normalizeTimestampValue(value, fallbackValue) {
        if (value !== undefined && value !== null) {
            return value;
        }

        if (fallbackValue !== undefined && fallbackValue !== null) {
            return fallbackValue;
        }

        return null;
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

    function minorUnitsToAmount(amountInMinorUnits) {
        return normalizeCurrencyAmount(normalizeAmountInMinorUnits(amountInMinorUnits) / 100);
    }

    function normalizeFromWhitelist(value, whitelist, fallbackValue) {
        const normalized = normalizeLowerText(value);

        if (normalized && whitelist.indexOf(normalized) !== -1) {
            return normalized;
        }

        const normalizedFallback = normalizeLowerText(fallbackValue);

        if (normalizedFallback && whitelist.indexOf(normalizedFallback) !== -1) {
            return normalizedFallback;
        }

        return whitelist[0];
    }

    function normalizeRefundCaseStatus(value, fallbackValue) {
        const key = normalizeStatusKey(value);
        const fallbackKey = normalizeStatusKey(fallbackValue);

        if (Object.prototype.hasOwnProperty.call(REFUND_CASE_STATUS_ALIASES, key)) {
            return REFUND_CASE_STATUS_ALIASES[key];
        }

        if (Object.prototype.hasOwnProperty.call(REFUND_CASE_STATUS_ALIASES, fallbackKey)) {
            return REFUND_CASE_STATUS_ALIASES[fallbackKey];
        }

        return DEFAULT_REFUND_CASE_STATUS;
    }

    function normalizeRefundType(value, fallbackValue) {
        const normalized = normalizeLowerText(value).replace(/[\s_-]+/g, "");
        const fallback = normalizeLowerText(fallbackValue).replace(/[\s_-]+/g, "");

        if (normalized === "full" || normalized === "complete" || normalized === "total") {
            return REFUND_TYPES.FULL;
        }

        if (normalized === "partial" || normalized === "part") {
            return REFUND_TYPES.PARTIAL;
        }

        if (fallback === "full" || fallback === "complete" || fallback === "total") {
            return REFUND_TYPES.FULL;
        }

        return DEFAULT_REFUND_TYPE;
    }

    function normalizeDecision(value, fallbackValue) {
        const normalized = normalizeLowerText(value).replace(/[\s_-]+/g, "");
        const fallback = normalizeLowerText(fallbackValue).replace(/[\s_-]+/g, "");

        if (normalized === "approved" || normalized === "approve" || normalized === "yes" || normalized === "agreed") {
            return DECISIONS.APPROVED;
        }

        if (normalized === "declined" || normalized === "decline" || normalized === "rejected" || normalized === "no") {
            return DECISIONS.DECLINED;
        }

        if (normalized === "pending" || normalized === "waiting") {
            return DECISIONS.PENDING;
        }

        if (fallback === "approved" || fallback === "approve" || fallback === "yes" || fallback === "agreed") {
            return DECISIONS.APPROVED;
        }

        if (fallback === "declined" || fallback === "decline" || fallback === "rejected" || fallback === "no") {
            return DECISIONS.DECLINED;
        }

        return DEFAULT_DECISION;
    }

    function normalizeActorRole(value, fallbackValue) {
        return normalizeFromWhitelist(
            value,
            [
                DECISION_ACTOR_ROLES.CUSTOMER,
                DECISION_ACTOR_ROLES.VENDOR,
                DECISION_ACTOR_ROLES.ADMIN,
                DECISION_ACTOR_ROLES.SYSTEM
            ],
            fallbackValue || DECISION_ACTOR_ROLES.SYSTEM
        );
    }

    function getDefaultRefundCaseStatus() {
        return DEFAULT_REFUND_CASE_STATUS;
    }

    function getRefundCaseStatusList() {
        return REFUND_CASE_STATUS_LIST.slice();
    }

    function getRefundTypeList() {
        return REFUND_TYPE_LIST.slice();
    }

    function getDecisionList() {
        return DECISION_LIST.slice();
    }

    function getRefundCaseStatusMetadata(status) {
        const normalizedStatus = normalizeRefundCaseStatus(status);
        const metadata = REFUND_CASE_STATUS_METADATA[normalizedStatus];

        if (!metadata) {
            return {
                key: DEFAULT_REFUND_CASE_STATUS,
                label: "Refund Not Requested",
                shortLabel: "No Refund",
                tone: "neutral",
                description: "No refund workflow has been opened for this ticket."
            };
        }

        return {
            key: normalizedStatus,
            label: metadata.label,
            shortLabel: metadata.shortLabel,
            tone: metadata.tone,
            description: metadata.description
        };
    }

    function getRefundCaseStatusLabel(status) {
        return getRefundCaseStatusMetadata(status).label;
    }

    function getRefundCaseStatusShortLabel(status) {
        return getRefundCaseStatusMetadata(status).shortLabel;
    }

    function getRefundCaseStatusTone(status) {
        return getRefundCaseStatusMetadata(status).tone;
    }

    function isTerminalRefundCaseStatus(status) {
        return TERMINAL_REFUND_CASE_STATUSES.indexOf(normalizeRefundCaseStatus(status)) >= 0;
    }

    function isActiveRefundCaseStatus(status) {
        return ACTIVE_REFUND_CASE_STATUSES.indexOf(normalizeRefundCaseStatus(status)) >= 0;
    }

    function isRefundCaseApproved(refundCase) {
        const safeCase = refundCase && typeof refundCase === "object" ? refundCase : {};

        return normalizeDecision(safeCase.customerDecision) === DECISIONS.APPROVED &&
            normalizeDecision(safeCase.vendorDecision) === DECISIONS.APPROVED;
    }

    function isRefundCaseExecutable(refundCase) {
        const safeCase = refundCase && typeof refundCase === "object" ? refundCase : {};
        const status = normalizeRefundCaseStatus(safeCase.status);

        return isRefundCaseApproved(safeCase) &&
            status !== REFUND_CASE_STATUSES.PROCESSING &&
            status !== REFUND_CASE_STATUSES.REFUNDED &&
            status !== REFUND_CASE_STATUSES.CANCELLED;
    }

    function deriveRefundCaseStatus(values = {}, fallbackStatus) {
        const safeValues = values && typeof values === "object" ? values : {};
        const explicitStatus = normalizeRefundCaseStatus(safeValues.status, fallbackStatus);

        if (
            explicitStatus === REFUND_CASE_STATUSES.PROCESSING ||
            explicitStatus === REFUND_CASE_STATUSES.REFUNDED ||
            explicitStatus === REFUND_CASE_STATUSES.FAILED ||
            explicitStatus === REFUND_CASE_STATUSES.CANCELLED
        ) {
            return explicitStatus;
        }

        const customerDecision = normalizeDecision(safeValues.customerDecision);
        const vendorDecision = normalizeDecision(safeValues.vendorDecision);

        if (
            customerDecision === DECISIONS.DECLINED ||
            vendorDecision === DECISIONS.DECLINED ||
            explicitStatus === REFUND_CASE_STATUSES.DECLINED
        ) {
            return REFUND_CASE_STATUSES.DECLINED;
        }

        if (
            customerDecision === DECISIONS.APPROVED &&
            vendorDecision === DECISIONS.APPROVED
        ) {
            return REFUND_CASE_STATUSES.APPROVED;
        }

        if (customerDecision === DECISIONS.APPROVED) {
            return REFUND_CASE_STATUSES.CUSTOMER_APPROVED;
        }

        if (vendorDecision === DECISIONS.APPROVED) {
            return REFUND_CASE_STATUSES.VENDOR_APPROVED;
        }

        if (
            explicitStatus === REFUND_CASE_STATUSES.PROPOSED ||
            normalizeCurrencyAmount(safeValues.amount) > 0 ||
            normalizeAmountInMinorUnits(safeValues.amountInMinorUnits) > 0
        ) {
            return REFUND_CASE_STATUSES.PROPOSED;
        }

        return REFUND_CASE_STATUSES.NOT_REQUESTED;
    }

    function resolvePaidAmount(orderOrPayment) {
        const safeOrder = orderOrPayment && typeof orderOrPayment === "object" ? orderOrPayment : {};

        return normalizeCurrencyAmount(
            safeOrder.paymentAmount !== undefined
                ? safeOrder.paymentAmount
                : safeOrder.total !== undefined
                    ? safeOrder.total
                    : safeOrder.totalAmount
        );
    }

    function resolvePaidAmountInMinorUnits(orderOrPayment) {
        const safeOrder = orderOrPayment && typeof orderOrPayment === "object" ? orderOrPayment : {};

        return normalizeAmountInMinorUnits(
            safeOrder.paymentAmountInMinorUnits !== undefined
                ? safeOrder.paymentAmountInMinorUnits
                : safeOrder.amountInMinorUnits,
            amountToMinorUnits(resolvePaidAmount(safeOrder))
        );
    }

    function resolveRefundAmount(values = {}, orderOrPayment = {}) {
        const safeValues = values && typeof values === "object" ? values : {};
        const type = normalizeRefundType(safeValues.type || safeValues.refundType);
        const paidAmount = resolvePaidAmount(orderOrPayment);
        const explicitMinor = normalizeAmountInMinorUnits(
            safeValues.amountInMinorUnits !== undefined
                ? safeValues.amountInMinorUnits
                : safeValues.refundAmountInMinorUnits
        );
        const explicitAmount = normalizeCurrencyAmount(
            safeValues.amount !== undefined
                ? safeValues.amount
                : safeValues.refundAmount
        );

        if (type === REFUND_TYPES.FULL && paidAmount > 0) {
            return paidAmount;
        }

        if (explicitMinor > 0) {
            return minorUnitsToAmount(explicitMinor);
        }

        return explicitAmount;
    }

    function resolveRefundAmountInMinorUnits(values = {}, orderOrPayment = {}) {
        const safeValues = values && typeof values === "object" ? values : {};
        const type = normalizeRefundType(safeValues.type || safeValues.refundType);
        const explicitMinor = normalizeAmountInMinorUnits(
            safeValues.amountInMinorUnits !== undefined
                ? safeValues.amountInMinorUnits
                : safeValues.refundAmountInMinorUnits
        );

        if (type === REFUND_TYPES.FULL) {
            const paidMinor = resolvePaidAmountInMinorUnits(orderOrPayment);

            if (paidMinor > 0) {
                return paidMinor;
            }
        }

        if (explicitMinor > 0) {
            return explicitMinor;
        }

        return amountToMinorUnits(resolveRefundAmount(safeValues, orderOrPayment));
    }

    function createRefundCaseTimelineEntry(eventType, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const status = normalizeRefundCaseStatus(safeOptions.status);
        const actorRole = normalizeActorRole(safeOptions.actorRole || safeOptions.role);

        return {
            eventType: normalizeLowerText(eventType) || "refund_case_updated",
            status,
            statusLabel: getRefundCaseStatusLabel(status),
            actorRole,
            actorUid: normalizeText(safeOptions.actorUid || safeOptions.uid),
            actorName: normalizeText(safeOptions.actorName || safeOptions.name),
            note: normalizeText(safeOptions.note),
            at: normalizeTimestampValue(safeOptions.at, safeOptions.timestamp)
        };
    }

    function normalizeRefundCaseTimeline(timeline) {
        return Array.isArray(timeline)
            ? timeline.map(function normalizeEntry(entry) {
                const safeEntry = entry && typeof entry === "object" ? entry : {};

                return createRefundCaseTimelineEntry(
                    safeEntry.eventType || safeEntry.type || "refund_case_updated",
                    safeEntry
                );
            })
            : [];
    }

    function createRefundCaseRecord(values = {}, options = {}) {
        const safeValues = values && typeof values === "object" ? values : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderOrPayment = safeOptions.order || safeOptions.payment || safeValues.order || safeValues.payment || {};
        const createdAt = normalizeTimestampValue(safeValues.createdAt, safeOptions.createdAt || null);
        const updatedAt = normalizeTimestampValue(safeValues.updatedAt, createdAt);
        const type = normalizeRefundType(safeValues.type || safeValues.refundType, safeOptions.type);
        const amount = resolveRefundAmount({ ...safeValues, type }, orderOrPayment);
        const amountInMinorUnits = resolveRefundAmountInMinorUnits({ ...safeValues, type, amount }, orderOrPayment);
        const customerDecision = normalizeDecision(
            safeValues.customerDecision,
            safeValues.customerApproved === true ? DECISIONS.APPROVED : DEFAULT_DECISION
        );
        const vendorDecision = normalizeDecision(
            safeValues.vendorDecision,
            safeValues.vendorApproved === true ? DECISIONS.APPROVED : DEFAULT_DECISION
        );
        const status = deriveRefundCaseStatus({
            ...safeValues,
            amount,
            amountInMinorUnits,
            customerDecision,
            vendorDecision
        }, safeOptions.status);
        const timeline = normalizeRefundCaseTimeline(safeValues.timeline);

        return {
            refundCaseId: normalizeText(safeValues.refundCaseId || safeValues.id),
            ticketId: normalizeText(safeValues.ticketId || safeOptions.ticketId),
            orderId: normalizeText(safeValues.orderId || safeOptions.orderId || orderOrPayment.orderId),
            checkoutId: normalizeText(safeValues.checkoutId || orderOrPayment.checkoutId),
            customerUid: normalizeText(safeValues.customerUid || safeOptions.customerUid || orderOrPayment.customerUid),
            vendorUid: normalizeText(safeValues.vendorUid || safeOptions.vendorUid || orderOrPayment.vendorUid),
            status,
            statusLabel: getRefundCaseStatusLabel(status),
            statusTone: getRefundCaseStatusTone(status),
            type,
            amount,
            amountInMinorUnits,
            currency: normalizeUpperText(safeValues.currency || safeValues.refundCurrency || orderOrPayment.paymentCurrency) || DEFAULT_CURRENCY,
            reason: normalizeText(safeValues.reason || safeValues.refundReason),
            customerNote: normalizeText(safeValues.customerNote),
            vendorNote: normalizeText(safeValues.vendorNote),
            adminNote: normalizeText(safeValues.adminNote),
            proposedByUid: normalizeText(safeValues.proposedByUid || safeOptions.actorUid),
            proposedByName: normalizeText(safeValues.proposedByName || safeOptions.actorName),
            proposedAt: normalizeTimestampValue(safeValues.proposedAt, safeOptions.proposedAt || createdAt),
            customerDecision,
            customerDecisionByUid: normalizeText(safeValues.customerDecisionByUid),
            customerDecisionByName: normalizeText(safeValues.customerDecisionByName),
            customerDecisionAt: normalizeTimestampValue(safeValues.customerDecisionAt, null),
            customerDecisionNote: normalizeText(safeValues.customerDecisionNote),
            vendorDecision,
            vendorDecisionByUid: normalizeText(safeValues.vendorDecisionByUid),
            vendorDecisionByName: normalizeText(safeValues.vendorDecisionByName),
            vendorDecisionAt: normalizeTimestampValue(safeValues.vendorDecisionAt, null),
            vendorDecisionNote: normalizeText(safeValues.vendorDecisionNote),
            executedByUid: normalizeText(safeValues.executedByUid),
            executedByName: normalizeText(safeValues.executedByName),
            executedAt: normalizeTimestampValue(safeValues.executedAt, null),
            refundProvider: normalizeLowerText(safeValues.refundProvider || safeValues.provider),
            refundId: normalizeText(safeValues.refundId),
            refundReference: normalizeText(safeValues.refundReference),
            refundPaymentReference: normalizeText(safeValues.refundPaymentReference || orderOrPayment.paymentReference),
            refundFailureReason: normalizeText(safeValues.refundFailureReason),
            vendorDeduction: normalizeCurrencyAmount(safeValues.vendorDeduction),
            platformDeduction: normalizeCurrencyAmount(safeValues.platformDeduction),
            requiresBothPartyAgreement: safeValues.requiresBothPartyAgreement === undefined
                ? true
                : normalizeBoolean(safeValues.requiresBothPartyAgreement),
            timeline,
            createdAt,
            updatedAt
        };
    }

    function createRefundCaseFromProposal(proposalValues = {}, options = {}) {
        const safeValues = proposalValues && typeof proposalValues === "object" ? proposalValues : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const proposedAt = normalizeTimestampValue(
            safeValues.proposedAt,
            safeOptions.proposedAt || safeOptions.now || safeOptions.createdAt
        );
        const baseCase = createRefundCaseRecord(
            {
                ...safeValues,
                status: REFUND_CASE_STATUSES.PROPOSED,
                customerDecision: DECISIONS.PENDING,
                vendorDecision: DECISIONS.PENDING,
                proposedAt,
                createdAt: safeValues.createdAt || proposedAt,
                updatedAt: safeValues.updatedAt || proposedAt
            },
            safeOptions
        );
        const timelineEntry = createRefundCaseTimelineEntry("refund_proposed", {
            status: baseCase.status,
            actorRole: safeOptions.actorRole || DECISION_ACTOR_ROLES.ADMIN,
            actorUid: baseCase.proposedByUid,
            actorName: baseCase.proposedByName,
            note: baseCase.reason,
            at: proposedAt
        });

        return {
            ...baseCase,
            timeline: normalizeRefundCaseTimeline(baseCase.timeline).concat(timelineEntry)
        };
    }

    function applyRefundDecision(refundCaseValues = {}, decisionValues = {}, options = {}) {
        const safeDecision = decisionValues && typeof decisionValues === "object" ? decisionValues : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const currentCase = createRefundCaseRecord(refundCaseValues, safeOptions);
        const actorRole = normalizeActorRole(
            safeDecision.actorRole || safeDecision.role || safeOptions.actorRole
        );
        const decision = normalizeDecision(safeDecision.decision || safeDecision.status || safeOptions.decision);
        const decidedAt = normalizeTimestampValue(
            safeDecision.decidedAt,
            safeOptions.decidedAt || safeOptions.now
        );
        const patch = {
            updatedAt: decidedAt
        };

        if (actorRole === DECISION_ACTOR_ROLES.CUSTOMER) {
            patch.customerDecision = decision;
            patch.customerDecisionByUid = normalizeText(safeDecision.actorUid || safeOptions.actorUid);
            patch.customerDecisionByName = normalizeText(safeDecision.actorName || safeOptions.actorName);
            patch.customerDecisionAt = decidedAt;
            patch.customerDecisionNote = normalizeText(safeDecision.note || safeOptions.note);
        } else if (actorRole === DECISION_ACTOR_ROLES.VENDOR) {
            patch.vendorDecision = decision;
            patch.vendorDecisionByUid = normalizeText(safeDecision.actorUid || safeOptions.actorUid);
            patch.vendorDecisionByName = normalizeText(safeDecision.actorName || safeOptions.actorName);
            patch.vendorDecisionAt = decidedAt;
            patch.vendorDecisionNote = normalizeText(safeDecision.note || safeOptions.note);
        } else {
            patch.adminNote = normalizeText(safeDecision.note || safeOptions.note || currentCase.adminNote);
        }

        const nextCase = createRefundCaseRecord({
            ...currentCase,
            ...patch
        }, safeOptions);
        const eventType = decision === DECISIONS.DECLINED
            ? "refund_decision_declined"
            : "refund_decision_approved";
        const timelineEntry = createRefundCaseTimelineEntry(eventType, {
            status: nextCase.status,
            actorRole,
            actorUid: normalizeText(safeDecision.actorUid || safeOptions.actorUid),
            actorName: normalizeText(safeDecision.actorName || safeOptions.actorName),
            note: normalizeText(safeDecision.note || safeOptions.note),
            at: decidedAt
        });

        return {
            ...nextCase,
            timeline: normalizeRefundCaseTimeline(currentCase.timeline).concat(timelineEntry)
        };
    }

    function applyRefundExecution(refundCaseValues = {}, executionValues = {}, options = {}) {
        const safeExecution = executionValues && typeof executionValues === "object" ? executionValues : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const currentCase = createRefundCaseRecord(refundCaseValues, safeOptions);
        const executedAt = normalizeTimestampValue(
            safeExecution.executedAt,
            safeOptions.executedAt || safeOptions.now
        );
        const success = safeExecution.success === true || normalizeRefundCaseStatus(safeExecution.status) === REFUND_CASE_STATUSES.REFUNDED;
        const status = success
            ? REFUND_CASE_STATUSES.REFUNDED
            : normalizeText(safeExecution.refundFailureReason || safeExecution.failureReason)
                ? REFUND_CASE_STATUSES.FAILED
                : REFUND_CASE_STATUSES.PROCESSING;
        const nextCase = createRefundCaseRecord({
            ...currentCase,
            status,
            executedByUid: safeExecution.executedByUid || safeOptions.actorUid || currentCase.executedByUid,
            executedByName: safeExecution.executedByName || safeOptions.actorName || currentCase.executedByName,
            executedAt: status === REFUND_CASE_STATUSES.PROCESSING ? currentCase.executedAt : executedAt,
            refundProvider: safeExecution.refundProvider || safeExecution.provider || currentCase.refundProvider,
            refundId: safeExecution.refundId || currentCase.refundId,
            refundReference: safeExecution.refundReference || currentCase.refundReference,
            refundPaymentReference: safeExecution.refundPaymentReference || currentCase.refundPaymentReference,
            refundFailureReason: safeExecution.refundFailureReason || safeExecution.failureReason || "",
            updatedAt: executedAt
        }, safeOptions);
        const timelineEntry = createRefundCaseTimelineEntry(
            status === REFUND_CASE_STATUSES.REFUNDED
                ? "refund_completed"
                : status === REFUND_CASE_STATUSES.FAILED
                    ? "refund_failed"
                    : "refund_processing",
            {
                status,
                actorRole: safeOptions.actorRole || DECISION_ACTOR_ROLES.ADMIN,
                actorUid: safeExecution.executedByUid || safeOptions.actorUid,
                actorName: safeExecution.executedByName || safeOptions.actorName,
                note: safeExecution.note || safeExecution.refundFailureReason || safeExecution.failureReason,
                at: executedAt
            }
        );

        return {
            ...nextCase,
            timeline: normalizeRefundCaseTimeline(currentCase.timeline).concat(timelineEntry)
        };
    }

    function createRefundCasePatch(values = {}, options = {}) {
        const normalized = createRefundCaseRecord(values, options);
        const source = values && typeof values === "object" ? values : {};
        const patch = {};

        [
            "status",
            "statusLabel",
            "statusTone",
            "type",
            "amount",
            "amountInMinorUnits",
            "currency",
            "reason",
            "customerNote",
            "vendorNote",
            "adminNote",
            "proposedByUid",
            "proposedByName",
            "proposedAt",
            "customerDecision",
            "customerDecisionByUid",
            "customerDecisionByName",
            "customerDecisionAt",
            "customerDecisionNote",
            "vendorDecision",
            "vendorDecisionByUid",
            "vendorDecisionByName",
            "vendorDecisionAt",
            "vendorDecisionNote",
            "executedByUid",
            "executedByName",
            "executedAt",
            "refundProvider",
            "refundId",
            "refundReference",
            "refundPaymentReference",
            "refundFailureReason",
            "vendorDeduction",
            "platformDeduction",
            "requiresBothPartyAgreement",
            "timeline",
            "updatedAt"
        ].forEach(function copyKnownKey(key) {
            if (source[key] !== undefined || key === "status" || key === "statusLabel" || key === "statusTone") {
                patch[key] = normalized[key];
            }
        });

        return patch;
    }

    function calculateRefundFinancialImpact(orderOrPayment = {}, refundCaseValues = {}) {
        const safeOrder = orderOrPayment && typeof orderOrPayment === "object" ? orderOrPayment : {};
        const refundCase = createRefundCaseRecord(refundCaseValues, {
            order: safeOrder
        });
        const paidAmount = resolvePaidAmount(safeOrder);
        const refundAmount = Math.min(refundCase.amount, paidAmount || refundCase.amount);
        const vendorEarnings = normalizeCurrencyAmount(
            safeOrder.vendorEarnings !== undefined
                ? safeOrder.vendorEarnings
                : safeOrder.vendorSubtotal
        );
        const platformEarnings = normalizeCurrencyAmount(
            safeOrder.platformEarnings !== undefined
                ? safeOrder.platformEarnings
                : safeOrder.platformFee
        );
        const vendorRatio = paidAmount > 0
            ? vendorEarnings / paidAmount
            : vendorEarnings > 0 && platformEarnings === 0
                ? 1
                : 0;
        const vendorDeduction = Math.min(
            vendorEarnings,
            normalizeCurrencyAmount(refundAmount * vendorRatio)
        );
        const platformDeduction = Math.min(
            platformEarnings,
            normalizeCurrencyAmount(refundAmount - vendorDeduction)
        );

        return {
            orderId: normalizeText(safeOrder.orderId),
            refundAmount,
            refundAmountInMinorUnits: amountToMinorUnits(refundAmount),
            paidAmount,
            vendorEarnings,
            platformEarnings,
            vendorDeduction,
            platformDeduction,
            netVendorEarnings: normalizeCurrencyAmount(vendorEarnings - vendorDeduction),
            netPlatformEarnings: normalizeCurrencyAmount(platformEarnings - platformDeduction)
        };
    }

    const refundCaseModel = {
        MODULE_NAME,
        DEFAULT_CURRENCY,
        DEFAULT_REFUND_CASE_STATUS,
        DEFAULT_REFUND_TYPE,
        DEFAULT_DECISION,
        REFUND_CASE_STATUSES,
        REFUND_CASE_STATUS_LIST,
        REFUND_CASE_STATUS_ALIASES,
        REFUND_CASE_STATUS_METADATA,
        REFUND_TYPES,
        REFUND_TYPE_LIST,
        DECISIONS,
        DECISION_LIST,
        DECISION_ACTOR_ROLES,
        TERMINAL_REFUND_CASE_STATUSES,
        ACTIVE_REFUND_CASE_STATUSES,
        normalizeText,
        normalizeLowerText,
        normalizeUpperText,
        normalizeStatusKey,
        normalizeBoolean,
        normalizeTimestampValue,
        normalizeCurrencyAmount,
        normalizeAmountInMinorUnits,
        amountToMinorUnits,
        minorUnitsToAmount,
        normalizeFromWhitelist,
        normalizeRefundCaseStatus,
        normalizeRefundType,
        normalizeDecision,
        normalizeActorRole,
        getDefaultRefundCaseStatus,
        getRefundCaseStatusList,
        getRefundTypeList,
        getDecisionList,
        getRefundCaseStatusMetadata,
        getRefundCaseStatusLabel,
        getRefundCaseStatusShortLabel,
        getRefundCaseStatusTone,
        isTerminalRefundCaseStatus,
        isActiveRefundCaseStatus,
        isRefundCaseApproved,
        isRefundCaseExecutable,
        deriveRefundCaseStatus,
        resolvePaidAmount,
        resolvePaidAmountInMinorUnits,
        resolveRefundAmount,
        resolveRefundAmountInMinorUnits,
        createRefundCaseTimelineEntry,
        normalizeRefundCaseTimeline,
        createRefundCaseRecord,
        createRefundCaseFromProposal,
        applyRefundDecision,
        applyRefundExecution,
        createRefundCasePatch,
        calculateRefundFinancialImpact
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = refundCaseModel;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.refundCaseModel = refundCaseModel;
    }
})(typeof window !== "undefined" ? window : globalThis);
