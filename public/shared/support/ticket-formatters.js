(function attachTicketFormatters(globalScope) {
    "use strict";

    const MODULE_NAME = "ticket-formatters";

    const EVENT_TYPE_LABELS = Object.freeze({
        created: "Filed",
        status_changed: "Status Changed",
        replied: "Replied",
        resolved: "Resolved",
        reopened: "Reopened",
        closed: "Closed",
        escalated: "Escalated"
    });

    const PRIORITY_METADATA = Object.freeze({
        normal: Object.freeze({ label: "Normal", tone: "neutral" }),
        high: Object.freeze({ label: "High", tone: "warning" })
    });

    function resolveTicketStatus(explicitTicketStatus) {
        if (
            explicitTicketStatus &&
            typeof explicitTicketStatus.normalizeTicketStatus === "function" &&
            typeof explicitTicketStatus.getTicketStatusLabel === "function"
        ) {
            return explicitTicketStatus;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.ticketStatus &&
            typeof globalScope.ticketStatus.normalizeTicketStatus === "function" &&
            typeof globalScope.ticketStatus.getTicketStatusLabel === "function"
        ) {
            return globalScope.ticketStatus;
        }

        if (typeof require === "function") {
            try {
                const requiredTicketStatus = require("./ticket-status.js");

                if (
                    requiredTicketStatus &&
                    typeof requiredTicketStatus.normalizeTicketStatus === "function" &&
                    typeof requiredTicketStatus.getTicketStatusLabel === "function"
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
            typeof explicitTicketCategories.getTicketCategoryLabel === "function"
        ) {
            return explicitTicketCategories;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.ticketCategories &&
            typeof globalScope.ticketCategories.normalizeTicketCategory === "function" &&
            typeof globalScope.ticketCategories.getTicketCategoryLabel === "function"
        ) {
            return globalScope.ticketCategories;
        }

        if (typeof require === "function") {
            try {
                const requiredTicketCategories = require("./ticket-categories.js");

                if (
                    requiredTicketCategories &&
                    typeof requiredTicketCategories.normalizeTicketCategory === "function" &&
                    typeof requiredTicketCategories.getTicketCategoryLabel === "function"
                ) {
                    return requiredTicketCategories;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveTicketModel(explicitTicketModel) {
        if (
            explicitTicketModel &&
            typeof explicitTicketModel.normalizeTicketRecord === "function"
        ) {
            return explicitTicketModel;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.ticketModel &&
            typeof globalScope.ticketModel.normalizeTicketRecord === "function"
        ) {
            return globalScope.ticketModel;
        }

        if (typeof require === "function") {
            try {
                const requiredTicketModel = require("./ticket-model.js");

                if (
                    requiredTicketModel &&
                    typeof requiredTicketModel.normalizeTicketRecord === "function"
                ) {
                    return requiredTicketModel;
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

    function normalizeNumber(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function normalizePositiveInteger(value, fallbackValue) {
        const parsed = Number.parseInt(value, 10);
        const fallbackParsed = Number.parseInt(fallbackValue, 10);

        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }

        if (Number.isFinite(fallbackParsed) && fallbackParsed > 0) {
            return fallbackParsed;
        }

        return 0;
    }

    function normalizeNonNegativeInteger(value) {
        const parsed = Number.parseInt(value, 10);

        if (Number.isFinite(parsed) && parsed >= 0) {
            return parsed;
        }

        return 0;
    }

    function normalizeTicketRecord(ticketRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketModel = resolveTicketModel(safeOptions.ticketModel);
        const safeRecord = ticketRecord && typeof ticketRecord === "object" ? ticketRecord : {};

        if (ticketModel) {
            return ticketModel.normalizeTicketRecord(safeRecord, {
                ticketStatus: safeOptions.ticketStatus,
                ticketCategories: safeOptions.ticketCategories
            });
        }

        return safeRecord;
    }

    function toDateInstance(value) {
        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
        }

        if (value && typeof value.toDate === "function") {
            return toDateInstance(value.toDate());
        }

        if (value && typeof value === "object") {
            const seconds = normalizeNumber(
                value.seconds !== undefined ? value.seconds : value._seconds
            );
            const nanoseconds = normalizeNumber(
                value.nanoseconds !== undefined ? value.nanoseconds : value._nanoseconds
            ) || 0;

            if (seconds !== null) {
                return new Date((seconds * 1000) + Math.floor(nanoseconds / 1000000));
            }
        }

        if (typeof value === "number" || typeof value === "string") {
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        return null;
    }

    function formatDateTime(value, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const date = toDateInstance(value);
        const emptyValue = safeOptions.emptyValue !== undefined
            ? `${safeOptions.emptyValue}`
            : "Unknown time";

        if (!date) {
            return emptyValue;
        }

        const locale = normalizeText(safeOptions.locale) || "en-ZA";
        const includeTime = safeOptions.includeTime !== false;
        const formatterOptions = {
            year: "numeric",
            month: "short",
            day: "numeric"
        };

        if (includeTime) {
            formatterOptions.hour = "2-digit";
            formatterOptions.minute = "2-digit";
            formatterOptions.hour12 = safeOptions.hour12 === true;
        }

        if (normalizeText(safeOptions.timeZone)) {
            formatterOptions.timeZone = normalizeText(safeOptions.timeZone);
        }

        if (typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function") {
            return new Intl.DateTimeFormat(locale, formatterOptions).format(date);
        }

        return includeTime
            ? date.toISOString().replace("T", " ").slice(0, 16)
            : date.toISOString().slice(0, 10);
    }

    function formatRelativeTime(value, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const date = toDateInstance(value);
        const emptyValue = safeOptions.emptyValue !== undefined
            ? `${safeOptions.emptyValue}`
            : "Unknown time";

        if (!date) {
            return emptyValue;
        }

        const referenceDate = toDateInstance(safeOptions.now) || new Date();
        const diffMs = date.getTime() - referenceDate.getTime();
        const absoluteMs = Math.abs(diffMs);
        const minuteMs = 60 * 1000;
        const hourMs = 60 * minuteMs;
        const dayMs = 24 * hourMs;

        if (absoluteMs < 45 * 1000) {
            return diffMs >= 0 ? "In moments" : "Just now";
        }

        if (absoluteMs < 90 * 1000) {
            return diffMs >= 0 ? "In 1 min" : "1 min ago";
        }

        if (absoluteMs < 45 * minuteMs) {
            const minutes = Math.round(absoluteMs / minuteMs);
            return diffMs >= 0 ? `In ${minutes} min` : `${minutes} min ago`;
        }

        if (absoluteMs < 90 * minuteMs) {
            return diffMs >= 0 ? "In 1 hr" : "1 hr ago";
        }

        if (absoluteMs < 22 * hourMs) {
            const hours = Math.round(absoluteMs / hourMs);
            return diffMs >= 0 ? `In ${hours} hr` : `${hours} hr ago`;
        }

        if (absoluteMs < 36 * hourMs) {
            return diffMs >= 0 ? "Tomorrow" : "Yesterday";
        }

        if (absoluteMs < 7 * dayMs) {
            const days = Math.round(absoluteMs / dayMs);
            return diffMs >= 0 ? `In ${days} days` : `${days} days ago`;
        }

        return formatDateTime(date, {
            ...safeOptions,
            includeTime: false
        });
    }

    function formatTicketId(ticketId, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeTicketId = normalizeText(ticketId);
        const emptyValue = safeOptions.emptyValue !== undefined
            ? `${safeOptions.emptyValue}`
            : "Ticket";
        const prefix = safeOptions.prefix !== undefined
            ? normalizeText(safeOptions.prefix)
            : "Ticket";
        const visibleChars = normalizePositiveInteger(safeOptions.visibleChars, 6) || 6;

        if (!safeTicketId) {
            return emptyValue;
        }

        const visibleSegment = safeTicketId.length > (visibleChars + 2)
            ? safeTicketId.slice(-visibleChars)
            : safeTicketId;

        if (!prefix) {
            return `#${visibleSegment}`;
        }

        return `${prefix} #${visibleSegment}`;
    }

    function formatActorRole(actorRole, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const fallback = safeOptions.fallback !== undefined
            ? `${safeOptions.fallback}`
            : "Someone";
        const normalizedActorRole = normalizeLowerText(actorRole);

        if (
            normalizedActorRole === "customer" ||
            normalizedActorRole === "student" ||
            normalizedActorRole === "buyer" ||
            normalizedActorRole === "reporter"
        ) {
            return "Customer";
        }

        if (
            normalizedActorRole === "vendor" ||
            normalizedActorRole === "shop" ||
            normalizedActorRole === "merchant" ||
            normalizedActorRole === "seller"
        ) {
            return "Vendor";
        }

        if (
            normalizedActorRole === "admin" ||
            normalizedActorRole === "support" ||
            normalizedActorRole === "staff"
        ) {
            return "Admin";
        }

        if (
            normalizedActorRole === "system" ||
            normalizedActorRole === "app" ||
            normalizedActorRole === "bot" ||
            normalizedActorRole === "automation"
        ) {
            return "System";
        }

        return fallback;
    }

    function getTicketStatusLabel(status, explicitTicketStatus) {
        const ticketStatus = resolveTicketStatus(explicitTicketStatus);

        if (ticketStatus) {
            return ticketStatus.getTicketStatusLabel(status);
        }

        return normalizeText(status) || "Unknown Status";
    }

    function getTicketStatusShortLabel(status, explicitTicketStatus) {
        const ticketStatus = resolveTicketStatus(explicitTicketStatus);

        if (ticketStatus && typeof ticketStatus.getTicketStatusShortLabel === "function") {
            return ticketStatus.getTicketStatusShortLabel(status);
        }

        return getTicketStatusLabel(status, ticketStatus);
    }

    function getTicketStatusDescription(status, explicitTicketStatus) {
        const ticketStatus = resolveTicketStatus(explicitTicketStatus);

        if (ticketStatus && typeof ticketStatus.getTicketStatusDescription === "function") {
            return ticketStatus.getTicketStatusDescription(status);
        }

        return "The ticket status is still being resolved.";
    }

    function getTicketStatusTone(status, explicitTicketStatus) {
        const ticketStatus = resolveTicketStatus(explicitTicketStatus);

        if (ticketStatus && typeof ticketStatus.getTicketStatusTone === "function") {
            return ticketStatus.getTicketStatusTone(status);
        }

        return "info";
    }

    function getTicketStatusActionLabel(status, explicitTicketStatus) {
        const ticketStatus = resolveTicketStatus(explicitTicketStatus);

        if (ticketStatus && typeof ticketStatus.getTicketStatusActionLabel === "function") {
            return ticketStatus.getTicketStatusActionLabel(status);
        }

        return "Update Ticket";
    }

    function getTicketCategoryLabel(category, explicitTicketCategories) {
        const ticketCategories = resolveTicketCategories(explicitTicketCategories);

        if (ticketCategories) {
            return ticketCategories.getTicketCategoryLabel(category);
        }

        return normalizeText(category) || "General";
    }

    function getTicketCategoryShortLabel(category, explicitTicketCategories) {
        const ticketCategories = resolveTicketCategories(explicitTicketCategories);

        if (ticketCategories && typeof ticketCategories.getTicketCategoryShortLabel === "function") {
            return ticketCategories.getTicketCategoryShortLabel(category);
        }

        return getTicketCategoryLabel(category, ticketCategories);
    }

    function getTicketCategoryDescription(category, explicitTicketCategories) {
        const ticketCategories = resolveTicketCategories(explicitTicketCategories);

        if (ticketCategories && typeof ticketCategories.getTicketCategoryDescription === "function") {
            return ticketCategories.getTicketCategoryDescription(category);
        }

        return "";
    }

    function getTicketCategoryTone(category, explicitTicketCategories) {
        const ticketCategories = resolveTicketCategories(explicitTicketCategories);

        if (ticketCategories && typeof ticketCategories.getTicketCategoryTone === "function") {
            return ticketCategories.getTicketCategoryTone(category);
        }

        return "info";
    }

    function getTicketPriorityKey(priority) {
        const normalized = normalizeLowerText(priority);
        return Object.prototype.hasOwnProperty.call(PRIORITY_METADATA, normalized)
            ? normalized
            : "normal";
    }

    function getTicketPriorityLabel(priority) {
        return PRIORITY_METADATA[getTicketPriorityKey(priority)].label;
    }

    function getTicketPriorityTone(priority) {
        return PRIORITY_METADATA[getTicketPriorityKey(priority)].tone;
    }

    function getTimelineEventLabel(eventType) {
        const key = normalizeLowerText(eventType);

        if (Object.prototype.hasOwnProperty.call(EVENT_TYPE_LABELS, key)) {
            return EVENT_TYPE_LABELS[key];
        }

        return "Update";
    }

    function formatTicketHeadline(ticketRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const normalizedTicket = normalizeTicketRecord(ticketRecord, safeOptions);
        const subject = normalizeText(normalizedTicket.subject);

        if (subject) {
            return subject;
        }

        return formatTicketId(normalizedTicket.ticketId);
    }

    function formatReplyCount(value, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const count = normalizeNonNegativeInteger(value);
        const emptyLabel = normalizeText(safeOptions.emptyLabel) || "No replies yet";
        const singularLabel = normalizeText(safeOptions.singularLabel) || "reply";
        const pluralLabel = normalizeText(safeOptions.pluralLabel) || "replies";

        if (count === 0) {
            return emptyLabel;
        }

        return `${count} ${count === 1 ? singularLabel : pluralLabel}`;
    }

    function formatLastReplyAt(value, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const emptyLabel = normalizeText(safeOptions.emptyLabel) || "No replies yet";

        if (value === null || value === undefined) {
            return emptyLabel;
        }

        const relative = formatRelativeTime(value, safeOptions);

        if (relative === safeOptions.emptyValue || relative === "Unknown time") {
            return emptyLabel;
        }

        const prefix = safeOptions.prefix !== undefined
            ? `${safeOptions.prefix}`
            : "Last reply ";

        return `${prefix}${relative}`;
    }

    function formatReporter(ticketRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const normalizedTicket = normalizeTicketRecord(ticketRecord, safeOptions);
        const reporterName = normalizeText(normalizedTicket.reporterName);
        const reporterRoleLabel = formatActorRole(normalizedTicket.reporterRole, {
            fallback: "Customer"
        });

        if (reporterName && reporterRoleLabel) {
            return `${reporterName} (${reporterRoleLabel})`;
        }

        if (reporterName) {
            return reporterName;
        }

        return reporterRoleLabel;
    }

    function formatResolutionStatement(ticketRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const normalizedTicket = normalizeTicketRecord(ticketRecord, safeOptions);
        const ticketStatus = resolveTicketStatus(safeOptions.ticketStatus);
        const isResolved = ticketStatus
            ? ticketStatus.normalizeTicketStatus(normalizedTicket.status) === "resolved"
            : normalizeLowerText(normalizedTicket.status) === "resolved";

        if (!isResolved) {
            return "";
        }

        const resolverName = normalizeText(normalizedTicket.resolvedByName);
        const when = formatRelativeTime(normalizedTicket.resolvedAt, safeOptions);
        const segments = ["Resolved"];

        if (resolverName) {
            segments.push(`by ${resolverName}`);
        }

        if (when && when !== "Unknown time") {
            segments.push(`· ${when}`);
        }

        return segments.join(" ");
    }

    function formatTimelineEntry(entry, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketStatus = resolveTicketStatus(safeOptions.ticketStatus);
        const safeEntry = entry && typeof entry === "object" ? entry : {};
        const eventType = normalizeLowerText(safeEntry.eventType) || "status_changed";
        const normalizedStatus = ticketStatus
            ? ticketStatus.normalizeTicketStatus(
                safeEntry.status,
                ticketStatus.getDefaultTicketStatus()
            )
            : normalizeLowerText(safeEntry.status) || "open";
        const actorName = normalizeText(safeEntry.actorName);
        const actorRole = normalizeLowerText(safeEntry.actorRole) || "system";
        const at = safeEntry.at !== undefined ? safeEntry.at : safeEntry.timestamp;

        return {
            eventType,
            eventLabel: getTimelineEventLabel(eventType),
            status: normalizedStatus,
            statusLabel: normalizeText(safeEntry.label) ||
                getTicketStatusLabel(normalizedStatus, ticketStatus),
            statusTone: getTicketStatusTone(normalizedStatus, ticketStatus),
            actorRole,
            actorName,
            actorLabel: actorName || formatActorRole(actorRole),
            note: normalizeText(safeEntry.note),
            at,
            timestampText: formatDateTime(at, safeOptions),
            relativeText: formatRelativeTime(at, safeOptions)
        };
    }

    function formatTimeline(ticketRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeRecord = ticketRecord && typeof ticketRecord === "object" ? ticketRecord : null;

        if (!safeRecord) {
            return [];
        }

        const normalizedTicket = normalizeTicketRecord(safeRecord, safeOptions);
        const timeline = Array.isArray(normalizedTicket.timeline)
            ? normalizedTicket.timeline
            : [];
        const formatted = timeline.map(function mapEntry(entry) {
            return formatTimelineEntry(entry, safeOptions);
        });

        if (safeOptions.reverse === true) {
            return formatted.reverse();
        }

        return formatted;
    }

    function formatReplyAuthor(reply) {
        const safeReply = reply && typeof reply === "object" ? reply : {};
        const authorName = normalizeText(safeReply.authorName);
        const roleLabel = formatActorRole(safeReply.authorRole);

        if (authorName && roleLabel) {
            return `${authorName} (${roleLabel})`;
        }

        return authorName || roleLabel;
    }

    function formatReplyEntry(reply, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeReply = reply && typeof reply === "object" ? reply : {};

        return {
            replyId: normalizeText(safeReply.replyId),
            ticketId: normalizeText(safeReply.ticketId),
            authorRole: normalizeLowerText(safeReply.authorRole) || "system",
            authorRoleLabel: formatActorRole(safeReply.authorRole),
            authorName: normalizeText(safeReply.authorName),
            authorLabel: formatReplyAuthor(safeReply),
            body: normalizeText(safeReply.body),
            isInternalNote: safeReply.isInternalNote === true,
            badgeLabel: safeReply.isInternalNote === true ? "Internal note" : "",
            createdAt: safeReply.createdAt !== undefined ? safeReply.createdAt : null,
            timestampText: formatDateTime(safeReply.createdAt, safeOptions),
            relativeText: formatRelativeTime(safeReply.createdAt, safeOptions)
        };
    }

    function formatReplyEntries(replies, options = {}) {
        const safeReplies = Array.isArray(replies) ? replies : [];
        const safeOptions = options && typeof options === "object" ? options : {};
        const includeInternal = safeOptions.includeInternalNotes !== false;

        return safeReplies
            .filter(function keepReply(reply) {
                if (includeInternal) {
                    return true;
                }

                return !(reply && reply.isInternalNote === true);
            })
            .map(function formatOne(reply) {
                return formatReplyEntry(reply, safeOptions);
            });
    }

    function formatTicketSummary(ticketRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const normalizedTicket = normalizeTicketRecord(ticketRecord, safeOptions);
        const segments = [];
        const headline = formatTicketHeadline(normalizedTicket, safeOptions);

        if (headline) {
            segments.push(headline);
        }

        const categoryLabel = getTicketCategoryLabel(
            normalizedTicket.category,
            safeOptions.ticketCategories
        );
        if (categoryLabel) {
            segments.push(categoryLabel);
        }

        if (safeOptions.includeStatus !== false) {
            segments.push(getTicketStatusLabel(normalizedTicket.status, safeOptions.ticketStatus));
        }

        if (safeOptions.includeReplyCount === true) {
            segments.push(formatReplyCount(normalizedTicket.replyCount, safeOptions));
        }

        return segments.join(" • ");
    }

    function buildStatusTimelineSteps(ticketRecordOrStatus, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketStatus = resolveTicketStatus(safeOptions.ticketStatus);
        const lifecycle = ticketStatus && typeof ticketStatus.getTicketLifecycleList === "function"
            ? ticketStatus.getTicketLifecycleList()
            : ["open", "in_progress", "awaiting_user", "resolved", "closed"];

        const sourceIsRecord = ticketRecordOrStatus && typeof ticketRecordOrStatus === "object";
        const normalizedTicket = sourceIsRecord
            ? normalizeTicketRecord(ticketRecordOrStatus, safeOptions)
            : null;
        const rawStatus = sourceIsRecord ? normalizedTicket.status : ticketRecordOrStatus;
        const currentStatus = ticketStatus
            ? ticketStatus.normalizeTicketStatus(rawStatus, ticketStatus.getDefaultTicketStatus())
            : normalizeLowerText(rawStatus) || "open";

        const timelineStatuses = sourceIsRecord && Array.isArray(normalizedTicket.timeline)
            ? normalizedTicket.timeline
                .map(function mapEntryStatus(entry) {
                    return ticketStatus
                        ? ticketStatus.normalizeTicketStatus(entry && entry.status)
                        : normalizeLowerText(entry && entry.status);
                })
                .filter(Boolean)
            : [];

        const currentIndex = ticketStatus && typeof ticketStatus.getStatusProgressIndex === "function"
            ? ticketStatus.getStatusProgressIndex(currentStatus)
            : lifecycle.indexOf(currentStatus);

        return lifecycle.map(function buildStep(status, index) {
            const reachedFromTimeline = timelineStatuses.indexOf(status) >= 0;
            const reachedFromProgress = currentIndex >= 0 && currentIndex > index;
            const isCurrent = currentStatus === status;
            const isComplete = !isCurrent && (reachedFromTimeline || reachedFromProgress);

            return {
                status,
                label: getTicketStatusLabel(status, ticketStatus),
                description: getTicketStatusDescription(status, ticketStatus),
                tone: getTicketStatusTone(status, ticketStatus),
                state: isCurrent ? "current" : (isComplete ? "complete" : "upcoming"),
                isCurrent,
                isComplete,
                isUpcoming: !isCurrent && !isComplete
            };
        });
    }

    const ticketFormatters = {
        MODULE_NAME,
        EVENT_TYPE_LABELS,
        PRIORITY_METADATA,
        resolveTicketStatus,
        resolveTicketCategories,
        resolveTicketModel,
        normalizeText,
        normalizeLowerText,
        normalizeNumber,
        normalizePositiveInteger,
        normalizeNonNegativeInteger,
        normalizeTicketRecord,
        toDateInstance,
        formatDateTime,
        formatRelativeTime,
        formatTicketId,
        formatActorRole,
        getTicketStatusLabel,
        getTicketStatusShortLabel,
        getTicketStatusDescription,
        getTicketStatusTone,
        getTicketStatusActionLabel,
        getTicketCategoryLabel,
        getTicketCategoryShortLabel,
        getTicketCategoryDescription,
        getTicketCategoryTone,
        getTicketPriorityKey,
        getTicketPriorityLabel,
        getTicketPriorityTone,
        getTimelineEventLabel,
        formatTicketHeadline,
        formatReplyCount,
        formatLastReplyAt,
        formatReporter,
        formatResolutionStatement,
        formatTimelineEntry,
        formatTimeline,
        formatReplyAuthor,
        formatReplyEntry,
        formatReplyEntries,
        formatTicketSummary,
        buildStatusTimelineSteps
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = ticketFormatters;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.ticketFormatters = ticketFormatters;
    }
})(typeof window !== "undefined" ? window : globalThis);
