(function attachPaymentModel(globalScope) {
    "use strict";

    const MODULE_NAME = "payment-model";
    const DEFAULT_PROVIDER = "paystack";
    const DEFAULT_CURRENCY = "ZAR";

    function resolvePaymentStatus(explicitPaymentStatus) {
        if (
            explicitPaymentStatus &&
            typeof explicitPaymentStatus.getDefaultPaymentStatus === "function" &&
            typeof explicitPaymentStatus.normalizePaymentStatus === "function"
        ) {
            return explicitPaymentStatus;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.paymentStatus &&
            typeof globalScope.paymentStatus.getDefaultPaymentStatus === "function" &&
            typeof globalScope.paymentStatus.normalizePaymentStatus === "function"
        ) {
            return globalScope.paymentStatus;
        }

        if (typeof require === "function") {
            try {
                const requiredPaymentStatus = require("./payment-status.js");

                if (
                    requiredPaymentStatus &&
                    typeof requiredPaymentStatus.getDefaultPaymentStatus === "function" &&
                    typeof requiredPaymentStatus.normalizePaymentStatus === "function"
                ) {
                    return requiredPaymentStatus;
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

    function normalizeUpperText(value) {
        return normalizeText(value).toUpperCase();
    }

    function normalizeProvider(value, fallbackValue) {
        return normalizeLowerText(value || fallbackValue) || DEFAULT_PROVIDER;
    }

    function normalizeCurrency(value, fallbackValue) {
        return normalizeUpperText(value || fallbackValue) || DEFAULT_CURRENCY;
    }

    function normalizeCurrencyAmount(value, fallbackValue) {
        const parsed = Number.parseFloat(value);
        const fallbackParsed = Number.parseFloat(fallbackValue);

        if (Number.isFinite(parsed)) {
            return Math.max(0, Number(parsed.toFixed(2)));
        }

        if (Number.isFinite(fallbackParsed)) {
            return Math.max(0, Number(fallbackParsed.toFixed(2)));
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

    function amountFromMinorUnits(amountInMinorUnits) {
        return normalizeCurrencyAmount(normalizeAmountInMinorUnits(amountInMinorUnits) / 100);
    }

    function normalizeTimestampValue(value, fallbackValue) {
        if (value !== undefined && value !== null) {
            return value;
        }

        if (fallbackValue !== undefined) {
            return fallbackValue;
        }

        return null;
    }

    function normalizeMetadata(metadata) {
        if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
            return {};
        }

        return { ...metadata };
    }

    function createPaymentTimelineEntry(status, options = {}, explicitPaymentStatus) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const paymentStatus = resolvePaymentStatus(explicitPaymentStatus);
        const fallbackStatus = paymentStatus
            ? paymentStatus.getDefaultPaymentStatus()
            : "unpaid";
        const normalizedStatus = paymentStatus
            ? paymentStatus.normalizePaymentStatus(status, fallbackStatus)
            : normalizeLowerText(status) || fallbackStatus;
        const label = paymentStatus && typeof paymentStatus.getPaymentStatusLabel === "function"
            ? paymentStatus.getPaymentStatusLabel(normalizedStatus)
            : normalizeText(status) || "Unpaid";

        return {
            status: normalizedStatus || fallbackStatus,
            label,
            provider: normalizeProvider(safeOptions.provider),
            reference: normalizeText(safeOptions.reference),
            actorRole: normalizeLowerText(safeOptions.actorRole || safeOptions.role) || "system",
            actorUid: normalizeText(safeOptions.actorUid || safeOptions.uid),
            actorName: normalizeText(safeOptions.actorName || safeOptions.name),
            note: normalizeText(safeOptions.note),
            at: normalizeTimestampValue(
                safeOptions.at,
                normalizeTimestampValue(safeOptions.timestamp, null)
            )
        };
    }

    function createPaymentRecord(paymentValues = {}, options = {}) {
        const safeValues = paymentValues && typeof paymentValues === "object" ? paymentValues : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const paymentStatus = resolvePaymentStatus(safeOptions.paymentStatus);
        const defaultStatus = paymentStatus
            ? paymentStatus.getDefaultPaymentStatus()
            : "unpaid";
        const normalizedStatus = paymentStatus
            ? paymentStatus.normalizePaymentStatus(safeValues.status || safeValues.paymentStatus, defaultStatus)
            : normalizeLowerText(safeValues.status || safeValues.paymentStatus) || defaultStatus;
        const amount = safeValues.amount !== undefined
            ? normalizeCurrencyAmount(safeValues.amount)
            : amountFromMinorUnits(safeValues.amountInMinorUnits || safeValues.amountMinor);
        const amountInMinorUnits = safeValues.amountInMinorUnits !== undefined || safeValues.amountMinor !== undefined
            ? normalizeAmountInMinorUnits(safeValues.amountInMinorUnits, safeValues.amountMinor)
            : amountToMinorUnits(amount);
        const createdAt = normalizeTimestampValue(safeValues.createdAt, safeOptions.createdAt || null);
        const updatedAt = normalizeTimestampValue(safeValues.updatedAt, createdAt);
        const providedTimeline = Array.isArray(safeValues.timeline) ? safeValues.timeline : [];
        const provider = normalizeProvider(safeValues.provider || safeValues.paymentProvider);
        const reference = normalizeText(
            safeValues.reference ||
            safeValues.paymentReference ||
            safeValues.paystackReference
        );
        const timeline = providedTimeline.length > 0
            ? providedTimeline.map(function normalizeTimelineEntry(entry) {
                const safeEntry = entry && typeof entry === "object" ? entry : {};

                return createPaymentTimelineEntry(
                    safeEntry.status || normalizedStatus,
                    {
                        provider: safeEntry.provider || provider,
                        reference: safeEntry.reference || reference,
                        actorRole: safeEntry.actorRole,
                        actorUid: safeEntry.actorUid,
                        actorName: safeEntry.actorName,
                        note: safeEntry.note,
                        at: normalizeTimestampValue(safeEntry.at, safeEntry.timestamp)
                    },
                    paymentStatus
                );
            })
            : [
                createPaymentTimelineEntry(
                    normalizedStatus,
                    {
                        provider,
                        reference,
                        actorRole: safeValues.createdByRole || safeOptions.createdByRole || "system",
                        actorUid: safeValues.createdByUid,
                        actorName: safeValues.createdByName,
                        note: safeValues.statusNote || safeValues.note || "",
                        at: createdAt
                    },
                    paymentStatus
                )
            ];

        return {
            paymentId: normalizeText(safeValues.paymentId || safeValues.id),
            orderId: normalizeText(safeValues.orderId),
            customerUid: normalizeText(safeValues.customerUid || safeValues.userUid),
            customerEmail: normalizeLowerText(safeValues.customerEmail || safeValues.email),
            vendorUid: normalizeText(safeValues.vendorUid),
            provider,
            status: normalizedStatus || defaultStatus,
            reference,
            accessCode: normalizeText(safeValues.accessCode || safeValues.paystackAccessCode),
            authorizationUrl: normalizeText(
                safeValues.authorizationUrl ||
                safeValues.authorizationURL ||
                safeValues.paymentUrl ||
                safeValues.paymentURL
            ),
            amount,
            amountInMinorUnits,
            currency: normalizeCurrency(safeValues.currency),
            paidAt: normalizeTimestampValue(safeValues.paidAt, null),
            failedAt: normalizeTimestampValue(safeValues.failedAt, null),
            verifiedAt: normalizeTimestampValue(safeValues.verifiedAt, null),
            failureReason: normalizeText(safeValues.failureReason || safeValues.errorMessage),
            metadata: normalizeMetadata(safeValues.metadata),
            timeline,
            createdAt,
            updatedAt
        };
    }

    function normalizePaymentRecord(paymentValues = {}, options = {}) {
        return createPaymentRecord(paymentValues, options);
    }

    function createPaymentRecordFromOrder(order, options = {}) {
        const safeOrder = order && typeof order === "object" ? order : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const amount = safeOptions.amount !== undefined
            ? safeOptions.amount
            : safeOrder.total;

        return createPaymentRecord(
            {
                paymentId: safeOptions.paymentId,
                orderId: safeOrder.orderId || safeOrder.id,
                customerUid: safeOrder.customerUid,
                customerEmail: safeOrder.customerEmail,
                vendorUid: safeOrder.vendorUid,
                provider: safeOptions.provider,
                status: safeOptions.status,
                reference: safeOptions.reference,
                accessCode: safeOptions.accessCode,
                authorizationUrl: safeOptions.authorizationUrl,
                amount,
                currency: safeOptions.currency,
                metadata: {
                    orderId: safeOrder.orderId || safeOrder.id || "",
                    customerUid: safeOrder.customerUid || "",
                    vendorUid: safeOrder.vendorUid || "",
                    ...(safeOptions.metadata && typeof safeOptions.metadata === "object"
                        ? safeOptions.metadata
                        : {})
                },
                createdAt: safeOptions.createdAt,
                updatedAt: safeOptions.updatedAt,
                createdByRole: safeOptions.createdByRole || "customer",
                createdByUid: safeOptions.createdByUid || safeOrder.customerUid,
                createdByName: safeOptions.createdByName || safeOrder.customerName
            },
            {
                paymentStatus: safeOptions.paymentStatus,
                createdAt: safeOptions.createdAt,
                createdByRole: safeOptions.createdByRole || "customer"
            }
        );
    }

    function createPaymentPatch(paymentValues = {}) {
        const paymentRecord = createPaymentRecord(paymentValues);

        return {
            paymentId: paymentRecord.paymentId,
            paymentStatus: paymentRecord.status,
            paymentProvider: paymentRecord.provider,
            paymentReference: paymentRecord.reference,
            paymentAccessCode: paymentRecord.accessCode,
            paymentAuthorizationUrl: paymentRecord.authorizationUrl,
            paymentAmount: paymentRecord.amount,
            paymentAmountInMinorUnits: paymentRecord.amountInMinorUnits,
            paymentCurrency: paymentRecord.currency,
            paymentPaidAt: paymentRecord.paidAt,
            paymentFailedAt: paymentRecord.failedAt,
            paymentVerifiedAt: paymentRecord.verifiedAt,
            paymentFailureReason: paymentRecord.failureReason
        };
    }

    const paymentModel = {
        MODULE_NAME,
        DEFAULT_PROVIDER,
        DEFAULT_CURRENCY,
        resolvePaymentStatus,
        normalizeText,
        normalizeLowerText,
        normalizeUpperText,
        normalizeProvider,
        normalizeCurrency,
        normalizeCurrencyAmount,
        normalizeAmountInMinorUnits,
        amountToMinorUnits,
        amountFromMinorUnits,
        normalizeTimestampValue,
        normalizeMetadata,
        createPaymentTimelineEntry,
        createPaymentRecord,
        normalizePaymentRecord,
        createPaymentRecordFromOrder,
        createPaymentPatch
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = paymentModel;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.paymentModel = paymentModel;
    }
})(typeof window !== "undefined" ? window : globalThis);
