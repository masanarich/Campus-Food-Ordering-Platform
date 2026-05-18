(function attachTicketModel(globalScope) {
    "use strict";

    const MODULE_NAME = "ticket-model";

    const DEFAULT_STATUS = "open";
    const KNOWN_STATUSES = [
        "open",
        "in_progress",
        "awaiting_user",
        "resolved",
        "closed"
    ];
    const STATUS_LABELS = {
        open: "Open",
        in_progress: "In Progress",
        awaiting_user: "Awaiting User",
        resolved: "Resolved",
        closed: "Closed"
    };

    const DEFAULT_CATEGORY = "general";
    const KNOWN_CATEGORIES = [
        "order_issue",
        "payment",
        "refund",
        "account",
        "abuse",
        "general"
    ];
    const CATEGORY_LABELS = {
        order_issue: "Order Issue",
        payment: "Payment Issue",
        refund: "Refund Request",
        account: "Account",
        abuse: "Abuse or Safety",
        general: "General"
    };

    const DEFAULT_PRIORITY = "normal";
    const KNOWN_PRIORITIES = ["normal", "high"];

    const DEFAULT_REPORTER_ROLE = "customer";
    const KNOWN_REPORTER_ROLES = ["customer", "vendor"];

    const DEFAULT_AUTHOR_ROLE = "system";
    const KNOWN_AUTHOR_ROLES = ["customer", "vendor", "admin", "system"];

    const KNOWN_TIMELINE_EVENTS = [
        "created",
        "status_changed",
        "replied",
        "resolved",
        "reopened",
        "closed",
        "escalated"
    ];

    const SUBJECT_MAX_LENGTH = 120;
    const BODY_MAX_LENGTH = 4000;

    function resolveTicketStatus(explicitTicketStatus) {
        if (
            explicitTicketStatus &&
            typeof explicitTicketStatus.normalizeTicketStatus === "function" &&
            typeof explicitTicketStatus.getDefaultTicketStatus === "function"
        ) {
            return explicitTicketStatus;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.ticketStatus &&
            typeof globalScope.ticketStatus.normalizeTicketStatus === "function" &&
            typeof globalScope.ticketStatus.getDefaultTicketStatus === "function"
        ) {
            return globalScope.ticketStatus;
        }

        if (typeof require === "function") {
            try {
                const requiredTicketStatus = require("./ticket-status.js");

                if (
                    requiredTicketStatus &&
                    typeof requiredTicketStatus.normalizeTicketStatus === "function" &&
                    typeof requiredTicketStatus.getDefaultTicketStatus === "function"
                ) {
                    return requiredTicketStatus;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveTicketCategories(explicitTicketCategories) {
        if (
            explicitTicketCategories &&
            typeof explicitTicketCategories.normalizeTicketCategory === "function" &&
            typeof explicitTicketCategories.getDefaultTicketCategory === "function"
        ) {
            return explicitTicketCategories;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.ticketCategories &&
            typeof globalScope.ticketCategories.normalizeTicketCategory === "function" &&
            typeof globalScope.ticketCategories.getDefaultTicketCategory === "function"
        ) {
            return globalScope.ticketCategories;
        }

        if (typeof require === "function") {
            try {
                const requiredTicketCategories = require("./ticket-categories.js");

                if (
                    requiredTicketCategories &&
                    typeof requiredTicketCategories.normalizeTicketCategory === "function" &&
                    typeof requiredTicketCategories.getDefaultTicketCategory === "function"
                ) {
                    return requiredTicketCategories;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
    }

    function clampText(value, maxLength) {
        const text = normalizeText(value);

        if (!Number.isFinite(maxLength) || maxLength <= 0) {
            return text;
        }

        if (text.length <= maxLength) {
            return text;
        }

        return text.slice(0, maxLength);
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

        const normalizedValue = normalizeLowerText(value);

        if (normalizedValue === "true" || normalizedValue === "yes") {
            return true;
        }

        if (normalizedValue === "false" || normalizedValue === "no") {
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

    function normalizeNonNegativeInteger(value, fallbackValue) {
        const parsed = Number.parseInt(value, 10);
        const fallbackParsed = Number.parseInt(fallbackValue, 10);

        if (Number.isFinite(parsed) && parsed >= 0) {
            return parsed;
        }

        if (Number.isFinite(fallbackParsed) && fallbackParsed >= 0) {
            return fallbackParsed;
        }

        return 0;
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

    function normalizeReporterRole(value, fallbackValue) {
        return normalizeFromWhitelist(
            value,
            KNOWN_REPORTER_ROLES,
            fallbackValue || DEFAULT_REPORTER_ROLE
        );
    }

    function normalizeAuthorRole(value, fallbackValue) {
        return normalizeFromWhitelist(
            value,
            KNOWN_AUTHOR_ROLES,
            fallbackValue || DEFAULT_AUTHOR_ROLE
        );
    }

    function normalizeTicketStatus(value, fallbackValue, explicitTicketStatus) {
        const ticketStatus = resolveTicketStatus(explicitTicketStatus);

        if (ticketStatus) {
            const moduleDefault = ticketStatus.getDefaultTicketStatus();
            return ticketStatus.normalizeTicketStatus(
                value,
                fallbackValue || moduleDefault
            );
        }

        return normalizeFromWhitelist(
            value,
            KNOWN_STATUSES,
            fallbackValue || DEFAULT_STATUS
        );
    }

    function normalizeTicketCategory(value, fallbackValue, explicitTicketCategories) {
        const ticketCategories = resolveTicketCategories(explicitTicketCategories);

        if (ticketCategories) {
            const moduleDefault = ticketCategories.getDefaultTicketCategory();
            return ticketCategories.normalizeTicketCategory(
                value,
                fallbackValue || moduleDefault
            );
        }

        return normalizeFromWhitelist(
            value,
            KNOWN_CATEGORIES,
            fallbackValue || DEFAULT_CATEGORY
        );
    }

    function normalizeTicketPriority(value, fallbackValue) {
        return normalizeFromWhitelist(
            value,
            KNOWN_PRIORITIES,
            fallbackValue || DEFAULT_PRIORITY
        );
    }

    function normalizeTimelineEventType(value, fallbackValue) {
        return normalizeFromWhitelist(
            value,
            KNOWN_TIMELINE_EVENTS,
            fallbackValue || "status_changed"
        );
    }

    function getTicketStatusLabel(status, explicitTicketStatus) {
        const ticketStatus = resolveTicketStatus(explicitTicketStatus);

        if (
            ticketStatus &&
            typeof ticketStatus.getTicketStatusLabel === "function"
        ) {
            return ticketStatus.getTicketStatusLabel(status);
        }

        const normalized = normalizeTicketStatus(status);

        return STATUS_LABELS[normalized] || STATUS_LABELS[DEFAULT_STATUS];
    }

    function getTicketCategoryLabel(category, explicitTicketCategories) {
        const ticketCategories = resolveTicketCategories(explicitTicketCategories);

        if (
            ticketCategories &&
            typeof ticketCategories.getTicketCategoryLabel === "function"
        ) {
            return ticketCategories.getTicketCategoryLabel(category);
        }

        const normalized = normalizeTicketCategory(category);

        return CATEGORY_LABELS[normalized] || CATEGORY_LABELS[DEFAULT_CATEGORY];
    }

    function createReporterSnapshot(reporter) {
        const safeReporter = reporter && typeof reporter === "object" ? reporter : {};

        return {
            reporterUid: normalizeText(
                safeReporter.reporterUid ||
                safeReporter.uid ||
                safeReporter.userUid
            ),
            reporterRole: normalizeReporterRole(
                safeReporter.reporterRole ||
                safeReporter.role
            ),
            reporterName: normalizeText(
                safeReporter.reporterName ||
                safeReporter.displayName ||
                safeReporter.fullName ||
                safeReporter.name
            ),
            reporterEmail: normalizeLowerText(
                safeReporter.reporterEmail ||
                safeReporter.email
            )
        };
    }

    function createCustomerSnapshot(customer) {
        const safeCustomer = customer && typeof customer === "object" ? customer : {};

        return {
            customerUid: normalizeText(
                safeCustomer.customerUid ||
                safeCustomer.uid ||
                safeCustomer.userUid
            ),
            customerName: normalizeText(
                safeCustomer.customerName ||
                safeCustomer.displayName ||
                safeCustomer.fullName ||
                safeCustomer.name
            )
        };
    }

    function createVendorSnapshot(vendor) {
        const safeVendor = vendor && typeof vendor === "object" ? vendor : {};

        return {
            vendorUid: normalizeText(
                safeVendor.vendorUid ||
                safeVendor.uid ||
                safeVendor.userUid
            ),
            vendorName: normalizeText(
                safeVendor.vendorName ||
                safeVendor.businessName ||
                safeVendor.shopName ||
                safeVendor.displayName ||
                safeVendor.name
            )
        };
    }

    function createTicketTimelineEntry(eventType, options = {}, explicitTicketStatus) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const normalizedEventType = normalizeTimelineEventType(eventType);
        const normalizedStatus = normalizeTicketStatus(
            safeOptions.status,
            safeOptions.fallbackStatus,
            explicitTicketStatus
        );

        return {
            eventType: normalizedEventType,
            status: normalizedStatus,
            label: getTicketStatusLabel(normalizedStatus, explicitTicketStatus),
            actorRole: normalizeAuthorRole(
                safeOptions.actorRole || safeOptions.role,
                "system"
            ),
            actorUid: normalizeText(safeOptions.actorUid || safeOptions.uid),
            actorName: normalizeText(safeOptions.actorName || safeOptions.name),
            note: normalizeText(safeOptions.note),
            at: normalizeTimestampValue(
                safeOptions.at,
                normalizeTimestampValue(safeOptions.timestamp, null)
            )
        };
    }

    function createReplyRecord(replyValues = {}, options = {}) {
        const safeValues = replyValues && typeof replyValues === "object" ? replyValues : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const createdAt = normalizeTimestampValue(
            safeValues.createdAt,
            safeOptions.createdAt || null
        );

        return {
            replyId: normalizeText(safeValues.replyId || safeValues.id),
            ticketId: normalizeText(safeValues.ticketId),
            authorUid: normalizeText(
                safeValues.authorUid || safeValues.uid
            ),
            authorRole: normalizeAuthorRole(
                safeValues.authorRole || safeValues.role,
                safeOptions.defaultAuthorRole
            ),
            authorName: normalizeText(
                safeValues.authorName ||
                safeValues.displayName ||
                safeValues.name
            ),
            body: clampText(safeValues.body || safeValues.message, BODY_MAX_LENGTH),
            isInternalNote: normalizeBoolean(safeValues.isInternalNote || safeValues.internalNote),
            createdAt
        };
    }

    function createTicketRecord(ticketValues = {}, options = {}) {
        const safeValues = ticketValues && typeof ticketValues === "object" ? ticketValues : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketStatus = resolveTicketStatus(safeOptions.ticketStatus);
        const ticketCategories = resolveTicketCategories(safeOptions.ticketCategories);

        const reporter = createReporterSnapshot(
            safeValues.reporter || safeValues
        );
        const customer = safeValues.customer
            ? createCustomerSnapshot(safeValues.customer)
            : {
                customerUid: reporter.reporterRole === "customer" ? reporter.reporterUid : "",
                customerName: reporter.reporterRole === "customer" ? reporter.reporterName : ""
            };
        const vendor = safeValues.vendor
            ? createVendorSnapshot(safeValues.vendor)
            : {
                vendorUid: reporter.reporterRole === "vendor" ? reporter.reporterUid : "",
                vendorName: reporter.reporterRole === "vendor" ? reporter.reporterName : ""
            };

        const status = normalizeTicketStatus(safeValues.status, DEFAULT_STATUS, ticketStatus);
        const category = normalizeTicketCategory(
            safeValues.category,
            DEFAULT_CATEGORY,
            ticketCategories
        );
        const priority = normalizeTicketPriority(safeValues.priority, DEFAULT_PRIORITY);

        const createdAt = normalizeTimestampValue(
            safeValues.createdAt,
            safeOptions.createdAt || null
        );
        const updatedAt = normalizeTimestampValue(safeValues.updatedAt, createdAt);
        const lastReplyAt = normalizeTimestampValue(safeValues.lastReplyAt, null);

        const providedTimeline = Array.isArray(safeValues.timeline) ? safeValues.timeline : [];
        const timeline = providedTimeline.length > 0
            ? providedTimeline.map(function normalizeEntry(entry) {
                const safeEntry = entry && typeof entry === "object" ? entry : {};

                return createTicketTimelineEntry(
                    safeEntry.eventType || "status_changed",
                    {
                        status: safeEntry.status || status,
                        fallbackStatus: status,
                        actorRole: safeEntry.actorRole,
                        actorUid: safeEntry.actorUid,
                        actorName: safeEntry.actorName,
                        note: safeEntry.note,
                        at: normalizeTimestampValue(safeEntry.at, safeEntry.timestamp)
                    },
                    ticketStatus
                );
            })
            : [
                createTicketTimelineEntry(
                    "created",
                    {
                        status,
                        actorRole: reporter.reporterRole,
                        actorUid: reporter.reporterUid,
                        actorName: reporter.reporterName,
                        note: safeValues.statusNote || "",
                        at: createdAt
                    },
                    ticketStatus
                )
            ];

        return {
            ticketId: normalizeText(safeValues.ticketId || safeValues.id),
            reporterUid: reporter.reporterUid,
            reporterRole: reporter.reporterRole,
            reporterName: reporter.reporterName,
            reporterEmail: reporter.reporterEmail,
            customerUid: customer.customerUid,
            customerName: customer.customerName,
            vendorUid: vendor.vendorUid,
            vendorName: vendor.vendorName,
            orderId: normalizeText(safeValues.orderId),
            category,
            categoryLabel: getTicketCategoryLabel(category, ticketCategories),
            subject: clampText(safeValues.subject || safeValues.title, SUBJECT_MAX_LENGTH),
            description: clampText(
                safeValues.description || safeValues.body || safeValues.message,
                BODY_MAX_LENGTH
            ),
            status,
            statusLabel: getTicketStatusLabel(status, ticketStatus),
            priority,
            replyCount: normalizeNonNegativeInteger(safeValues.replyCount, 0),
            lastReplyAt,
            resolvedAt: normalizeTimestampValue(safeValues.resolvedAt, null),
            resolvedByUid: normalizeText(safeValues.resolvedByUid),
            resolvedByName: normalizeText(safeValues.resolvedByName),
            resolutionNote: clampText(safeValues.resolutionNote, BODY_MAX_LENGTH),
            timeline,
            createdAt,
            updatedAt
        };
    }

    function normalizeTicketRecord(ticketValues = {}, options = {}) {
        return createTicketRecord(ticketValues, options);
    }

    function createTicketFromForm(formValues = {}, options = {}) {
        const safeValues = formValues && typeof formValues === "object" ? formValues : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const reporter = createReporterSnapshot(safeOptions.reporter || safeValues.reporter || safeValues);

        return createTicketRecord(
            {
                reporter,
                customer: safeOptions.customer || safeValues.customer,
                vendor: safeOptions.vendor || safeValues.vendor,
                orderId: safeValues.orderId,
                category: safeValues.category,
                subject: safeValues.subject || safeValues.title,
                description: safeValues.description || safeValues.body || safeValues.message,
                status: DEFAULT_STATUS,
                priority: safeValues.priority,
                createdAt: safeOptions.createdAt,
                updatedAt: safeOptions.createdAt,
                statusNote: safeValues.statusNote
            },
            {
                ticketStatus: safeOptions.ticketStatus,
                ticketCategories: safeOptions.ticketCategories,
                createdAt: safeOptions.createdAt
            }
        );
    }

    function createTicketPatch(patchValues = {}, options = {}) {
        const safeValues = patchValues && typeof patchValues === "object" ? patchValues : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const patch = {};

        if (safeValues.status !== undefined) {
            patch.status = normalizeTicketStatus(
                safeValues.status,
                undefined,
                safeOptions.ticketStatus
            );
            patch.statusLabel = getTicketStatusLabel(patch.status, safeOptions.ticketStatus);
        }

        if (safeValues.priority !== undefined) {
            patch.priority = normalizeTicketPriority(safeValues.priority);
        }

        if (safeValues.category !== undefined) {
            patch.category = normalizeTicketCategory(
                safeValues.category,
                undefined,
                safeOptions.ticketCategories
            );
            patch.categoryLabel = getTicketCategoryLabel(
                patch.category,
                safeOptions.ticketCategories
            );
        }

        if (safeValues.replyCount !== undefined) {
            patch.replyCount = normalizeNonNegativeInteger(safeValues.replyCount, 0);
        }

        if (safeValues.lastReplyAt !== undefined) {
            patch.lastReplyAt = normalizeTimestampValue(safeValues.lastReplyAt, null);
        }

        if (safeValues.resolvedAt !== undefined) {
            patch.resolvedAt = normalizeTimestampValue(safeValues.resolvedAt, null);
        }

        if (safeValues.resolvedByUid !== undefined) {
            patch.resolvedByUid = normalizeText(safeValues.resolvedByUid);
        }

        if (safeValues.resolvedByName !== undefined) {
            patch.resolvedByName = normalizeText(safeValues.resolvedByName);
        }

        if (safeValues.resolutionNote !== undefined) {
            patch.resolutionNote = clampText(safeValues.resolutionNote, BODY_MAX_LENGTH);
        }

        if (safeValues.updatedAt !== undefined) {
            patch.updatedAt = normalizeTimestampValue(safeValues.updatedAt, null);
        }

        return patch;
    }

    const ticketModel = {
        MODULE_NAME,
        DEFAULT_STATUS,
        KNOWN_STATUSES,
        STATUS_LABELS,
        DEFAULT_CATEGORY,
        KNOWN_CATEGORIES,
        CATEGORY_LABELS,
        DEFAULT_PRIORITY,
        KNOWN_PRIORITIES,
        DEFAULT_REPORTER_ROLE,
        KNOWN_REPORTER_ROLES,
        DEFAULT_AUTHOR_ROLE,
        KNOWN_AUTHOR_ROLES,
        KNOWN_TIMELINE_EVENTS,
        SUBJECT_MAX_LENGTH,
        BODY_MAX_LENGTH,
        resolveTicketStatus,
        resolveTicketCategories,
        normalizeText,
        normalizeLowerText,
        clampText,
        normalizeBoolean,
        normalizeTimestampValue,
        normalizeNonNegativeInteger,
        normalizeFromWhitelist,
        normalizeReporterRole,
        normalizeAuthorRole,
        normalizeTicketStatus,
        normalizeTicketCategory,
        normalizeTicketPriority,
        normalizeTimelineEventType,
        getTicketStatusLabel,
        getTicketCategoryLabel,
        createReporterSnapshot,
        createCustomerSnapshot,
        createVendorSnapshot,
        createTicketTimelineEntry,
        createReplyRecord,
        createTicketRecord,
        normalizeTicketRecord,
        createTicketFromForm,
        createTicketPatch
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = ticketModel;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.ticketModel = ticketModel;
    }
})(typeof window !== "undefined" ? window : globalThis);
