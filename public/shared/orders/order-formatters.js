(function attachOrderFormatters(globalScope) {
    "use strict";

    const MODULE_NAME = "order-formatters";

    function resolveOrderStatus(explicitOrderStatus) {
        if (
            explicitOrderStatus &&
            typeof explicitOrderStatus.normalizeOrderStatus === "function" &&
            typeof explicitOrderStatus.getOrderStatusLabel === "function" &&
            typeof explicitOrderStatus.getTrackingOrderStatusList === "function"
        ) {
            return explicitOrderStatus;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.orderStatus &&
            typeof globalScope.orderStatus.normalizeOrderStatus === "function" &&
            typeof globalScope.orderStatus.getOrderStatusLabel === "function" &&
            typeof globalScope.orderStatus.getTrackingOrderStatusList === "function"
        ) {
            return globalScope.orderStatus;
        }

        if (typeof require === "function") {
            try {
                const requiredOrderStatus = require("./order-status.js");

                if (
                    requiredOrderStatus &&
                    typeof requiredOrderStatus.normalizeOrderStatus === "function" &&
                    typeof requiredOrderStatus.getOrderStatusLabel === "function" &&
                    typeof requiredOrderStatus.getTrackingOrderStatusList === "function"
                ) {
                    return requiredOrderStatus;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveOrderModel(explicitOrderModel) {
        if (
            explicitOrderModel &&
            typeof explicitOrderModel.normalizeOrderRecord === "function"
        ) {
            return explicitOrderModel;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.orderModel &&
            typeof globalScope.orderModel.normalizeOrderRecord === "function"
        ) {
            return globalScope.orderModel;
        }

        if (typeof require === "function") {
            try {
                const requiredOrderModel = require("./order-model.js");

                if (
                    requiredOrderModel &&
                    typeof requiredOrderModel.normalizeOrderRecord === "function"
                ) {
                    return requiredOrderModel;
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

    function normalizeOrderRecord(orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const orderModel = resolveOrderModel(safeOptions.orderModel);
        const safeRecord = orderRecord && typeof orderRecord === "object" ? orderRecord : {};

        if (orderModel) {
            return orderModel.normalizeOrderRecord(safeRecord, { orderStatus });
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

    function formatGroupedNumber(value, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const parsedDecimals = Number.parseInt(
            safeOptions.decimals !== undefined
                ? safeOptions.decimals
                : safeOptions.minimumFractionDigits,
            10
        );
        const decimals = Number.isFinite(parsedDecimals) && parsedDecimals >= 0
            ? parsedDecimals
            : 2;
        const parsed = normalizeNumber(value);

        if (parsed === null) {
            return "";
        }

        const absoluteValue = Math.abs(parsed);
        const fixedValue = absoluteValue.toFixed(decimals);
        const parts = fixedValue.split(".");
        const wholePart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        const decimalPart = parts[1] ? `.${parts[1]}` : "";
        const sign = parsed < 0 ? "-" : "";

        return `${sign}${wholePart}${decimalPart}`;
    }

    function formatCurrency(value, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const symbol = safeOptions.symbol !== undefined
            ? normalizeText(safeOptions.symbol)
            : "R";
        const emptyValue = safeOptions.emptyValue !== undefined
            ? `${safeOptions.emptyValue}`
            : `${symbol}0.00`;
        const formattedNumber = formatGroupedNumber(value, {
            decimals: safeOptions.decimals !== undefined
                ? safeOptions.decimals
                : 2,
            minimumFractionDigits: safeOptions.minimumFractionDigits
        });

        if (!formattedNumber) {
            return emptyValue;
        }

        return `${symbol}${formattedNumber}`;
    }

    function formatItemCount(value, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const parsed = Number.parseInt(value, 10);
        const count = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
        const singularLabel = normalizeText(safeOptions.singularLabel) || "item";
        const pluralLabel = normalizeText(safeOptions.pluralLabel) || `${singularLabel}s`;

        return `${count} ${count === 1 ? singularLabel : pluralLabel}`;
    }

    function getOrderStatusLabel(status, explicitOrderStatus) {
        const orderStatus = resolveOrderStatus(explicitOrderStatus);

        if (orderStatus) {
            return orderStatus.getOrderStatusLabel(status);
        }

        return normalizeText(status) || "Unknown Status";
    }

    function getOrderStatusDescription(status, explicitOrderStatus) {
        const orderStatus = resolveOrderStatus(explicitOrderStatus);

        if (orderStatus && typeof orderStatus.getOrderStatusDescription === "function") {
            return orderStatus.getOrderStatusDescription(status);
        }

        return "The order status is still being resolved.";
    }

    function getOrderStatusTone(status, explicitOrderStatus) {
        const orderStatus = resolveOrderStatus(explicitOrderStatus);

        if (orderStatus && typeof orderStatus.getOrderStatusTone === "function") {
            return orderStatus.getOrderStatusTone(status);
        }

        return "info";
    }

    function getOrderStatusActionLabel(status, explicitOrderStatus) {
        const orderStatus = resolveOrderStatus(explicitOrderStatus);

        if (orderStatus && typeof orderStatus.getOrderStatusActionLabel === "function") {
            return orderStatus.getOrderStatusActionLabel(status);
        }

        return "Update Order";
    }

    function formatOrderId(orderId, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeOrderId = normalizeText(orderId);
        const emptyValue = safeOptions.emptyValue !== undefined
            ? `${safeOptions.emptyValue}`
            : "Order";
        const prefix = safeOptions.prefix !== undefined
            ? normalizeText(safeOptions.prefix)
            : "Order";
        const visibleChars = normalizePositiveInteger(safeOptions.visibleChars, 6) || 6;

        if (!safeOrderId) {
            return emptyValue;
        }

        const visibleSegment = safeOrderId.length > (visibleChars + 2)
            ? safeOrderId.slice(-visibleChars)
            : safeOrderId;

        if (!prefix) {
            return `#${visibleSegment}`;
        }

        return `${prefix} #${visibleSegment}`;
    }

    function formatActorRole(actorRole) {
        const normalizedActorRole = normalizeLowerText(actorRole);

        if (normalizedActorRole === "customer" || normalizedActorRole === "student") {
            return "Customer";
        }

        if (normalizedActorRole === "vendor" || normalizedActorRole === "shop") {
            return "Vendor";
        }

        if (normalizedActorRole === "admin") {
            return "Admin";
        }

        if (normalizedActorRole === "system" || normalizedActorRole === "app") {
            return "System";
        }

        return "Someone";
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

    function formatOrderHeadline(orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const normalizedOrder = normalizeOrderRecord(orderRecord, safeOptions);
        const viewerRole = orderStatus && typeof orderStatus.normalizeOrderActorRole === "function"
            ? orderStatus.normalizeOrderActorRole(safeOptions.viewerRole)
            : normalizeLowerText(safeOptions.viewerRole);

        if (viewerRole === "vendor") {
            return normalizedOrder.customerName || formatOrderId(normalizedOrder.orderId);
        }

        if (viewerRole === "customer") {
            return normalizedOrder.vendorName || formatOrderId(normalizedOrder.orderId);
        }

        return (
            normalizedOrder.vendorName ||
            normalizedOrder.customerName ||
            formatOrderId(normalizedOrder.orderId)
        );
    }

    function formatOrderTotal(orderRecord, options = {}) {
        const normalizedOrder = normalizeOrderRecord(orderRecord, options);
        const amount = normalizedOrder.total !== undefined
            ? normalizedOrder.total
            : normalizedOrder.subtotal;

        return formatCurrency(amount, options);
    }

    function formatOrderSummary(orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const normalizedOrder = normalizeOrderRecord(orderRecord, safeOptions);
        const segments = [];
        const headline = formatOrderHeadline(normalizedOrder, safeOptions);
        const itemCount = normalizedOrder.itemCount !== undefined
            ? normalizedOrder.itemCount
            : (Array.isArray(normalizedOrder.items) ? normalizedOrder.items.length : 0);

        if (headline) {
            segments.push(headline);
        }

        segments.push(formatItemCount(itemCount, safeOptions));
        segments.push(formatOrderTotal(normalizedOrder, safeOptions));

        if (safeOptions.includeStatus === true) {
            segments.push(getOrderStatusLabel(normalizedOrder.status, safeOptions.orderStatus));
        }

        return segments.join(" • ");
    }

    function buildTrackingSteps(orderRecordOrStatus, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const normalizedOrder = normalizeOrderRecord(
            orderRecordOrStatus && typeof orderRecordOrStatus === "object"
                ? orderRecordOrStatus
                : {},
            safeOptions
        );
        const currentStatus = orderStatus
            ? orderStatus.normalizeOrderStatus(
                typeof orderRecordOrStatus === "object"
                    ? normalizedOrder.status
                    : orderRecordOrStatus,
                orderStatus.getDefaultOrderStatus()
            )
            : normalizeLowerText(
                typeof orderRecordOrStatus === "object"
                    ? normalizedOrder.status
                    : orderRecordOrStatus
            ) || "pending";
        const timelineStatuses = Array.isArray(normalizedOrder.timeline)
            ? normalizedOrder.timeline
                .map(function mapOneEntry(entry) {
                    return orderStatus
                        ? orderStatus.normalizeOrderStatus(entry && entry.status)
                        : normalizeLowerText(entry && entry.status);
                })
                .filter(Boolean)
            : [];
        const trackingStatuses = orderStatus
            ? orderStatus.getTrackingOrderStatusList()
            : ["pending", "accepted", "preparing", "ready", "completed"];
        const currentIndex = orderStatus && typeof orderStatus.getStatusProgressIndex === "function"
            ? orderStatus.getStatusProgressIndex(currentStatus)
            : trackingStatuses.indexOf(currentStatus);
        const steps = trackingStatuses.map(function mapStatus(status, index) {
            const reachedFromTimeline = timelineStatuses.indexOf(status) >= 0;
            const reachedFromProgress = currentIndex >= 0 && currentIndex > index;
            const isCurrent = currentStatus === status;
            const isComplete = !isCurrent && (reachedFromTimeline || reachedFromProgress);

            return {
                status,
                label: getOrderStatusLabel(status, orderStatus),
                description: getOrderStatusDescription(status, orderStatus),
                tone: getOrderStatusTone(status, orderStatus),
                state: isCurrent ? "current" : (isComplete ? "complete" : "upcoming"),
                isCurrent,
                isComplete,
                isUpcoming: !isCurrent && !isComplete,
                isTerminal: false
            };
        });

        if (
            orderStatus &&
            typeof orderStatus.isTerminalOrderStatus === "function" &&
            orderStatus.isTerminalOrderStatus(currentStatus) &&
            trackingStatuses.indexOf(currentStatus) === -1
        ) {
            steps.push({
                status: currentStatus,
                label: getOrderStatusLabel(currentStatus, orderStatus),
                description: getOrderStatusDescription(currentStatus, orderStatus),
                tone: getOrderStatusTone(currentStatus, orderStatus),
                state: "current",
                isCurrent: true,
                isComplete: false,
                isUpcoming: false,
                isTerminal: true
            });
        }

        return steps;
    }

    function formatTimelineEntry(entry, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const safeEntry = entry && typeof entry === "object" ? entry : {};
        const normalizedStatus = orderStatus
            ? orderStatus.normalizeOrderStatus(
                safeEntry.status,
                orderStatus.getDefaultOrderStatus()
            )
            : normalizeLowerText(safeEntry.status) || "pending";
        const actorName = normalizeText(safeEntry.actorName);
        const actorRole = orderStatus && typeof orderStatus.normalizeOrderActorRole === "function"
            ? orderStatus.normalizeOrderActorRole(safeEntry.actorRole) || "system"
            : normalizeLowerText(safeEntry.actorRole) || "system";
        const at = safeEntry.at !== undefined ? safeEntry.at : safeEntry.timestamp;

        return {
            status: normalizedStatus,
            label: normalizeText(safeEntry.label) || getOrderStatusLabel(normalizedStatus, orderStatus),
            description: getOrderStatusDescription(normalizedStatus, orderStatus),
            tone: getOrderStatusTone(normalizedStatus, orderStatus),
            actorRole,
            actorName,
            actorLabel: actorName || formatActorRole(actorRole),
            note: normalizeText(safeEntry.note),
            at,
            timestampText: formatDateTime(at, safeOptions),
            relativeText: formatRelativeTime(at, safeOptions)
        };
    }

    function formatTimeline(orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeOrderRecord = orderRecord && typeof orderRecord === "object" ? orderRecord : null;

        if (
            !safeOrderRecord ||
            (
                !Array.isArray(safeOrderRecord.timeline) &&
                !normalizeText(safeOrderRecord.orderId || safeOrderRecord.id) &&
                !normalizeText(safeOrderRecord.status) &&
                safeOrderRecord.createdAt === undefined &&
                safeOrderRecord.updatedAt === undefined
            )
        ) {
            return [];
        }

        const normalizedOrder = normalizeOrderRecord(orderRecord, safeOptions);
        const timeline = Array.isArray(normalizedOrder.timeline)
            ? normalizedOrder.timeline
            : [];
        const formattedTimeline = timeline.map(function mapEntry(entry) {
            return formatTimelineEntry(entry, safeOptions);
        });

        if (safeOptions.reverse === true) {
            return formattedTimeline.reverse();
        }

        return formattedTimeline;
    }

    const orderFormatters = {
        MODULE_NAME,
        resolveOrderStatus,
        resolveOrderModel,
        normalizeText,
        normalizeLowerText,
        normalizeNumber,
        normalizePositiveInteger,
        normalizeOrderRecord,
        toDateInstance,
        formatGroupedNumber,
        formatCurrency,
        formatItemCount,
        getOrderStatusLabel,
        getOrderStatusDescription,
        getOrderStatusTone,
        getOrderStatusActionLabel,
        formatOrderId,
        formatActorRole,
        formatDateTime,
        formatRelativeTime,
        formatOrderHeadline,
        formatOrderTotal,
        formatOrderSummary,
        buildTrackingSteps,
        formatTimelineEntry,
        formatTimeline
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = orderFormatters;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.orderFormatters = orderFormatters;
    }
})(typeof window !== "undefined" ? window : globalThis);
