(function attachPaymentFormatters(globalScope) {
    "use strict";

    const MODULE_NAME = "payment-formatters";

    function resolvePaymentStatus(explicitPaymentStatus) {
        if (
            explicitPaymentStatus &&
            typeof explicitPaymentStatus.normalizePaymentStatus === "function" &&
            typeof explicitPaymentStatus.getPaymentStatusLabel === "function"
        ) {
            return explicitPaymentStatus;
        }

        if (explicitPaymentStatus !== undefined && explicitPaymentStatus !== null) {
            return null;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.paymentStatus &&
            typeof globalScope.paymentStatus.normalizePaymentStatus === "function" &&
            typeof globalScope.paymentStatus.getPaymentStatusLabel === "function"
        ) {
            return globalScope.paymentStatus;
        }

        if (typeof require === "function") {
            try {
                const requiredPaymentStatus = require("./payment-status.js");

                if (
                    requiredPaymentStatus &&
                    typeof requiredPaymentStatus.normalizePaymentStatus === "function" &&
                    typeof requiredPaymentStatus.getPaymentStatusLabel === "function"
                ) {
                    return requiredPaymentStatus;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolvePaymentModel(explicitPaymentModel) {
        if (
            explicitPaymentModel &&
            typeof explicitPaymentModel.createPaymentRecord === "function"
        ) {
            return explicitPaymentModel;
        }

        if (explicitPaymentModel !== undefined && explicitPaymentModel !== null) {
            return null;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.paymentModel &&
            typeof globalScope.paymentModel.createPaymentRecord === "function"
        ) {
            return globalScope.paymentModel;
        }

        if (typeof require === "function") {
            try {
                const requiredPaymentModel = require("./payment-model.js");

                if (
                    requiredPaymentModel &&
                    typeof requiredPaymentModel.createPaymentRecord === "function"
                ) {
                    return requiredPaymentModel;
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

    function normalizeNumber(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function normalizePaymentRecord(paymentRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const paymentStatus = resolvePaymentStatus(safeOptions.paymentStatus);
        const paymentModel = resolvePaymentModel(safeOptions.paymentModel);
        const safeRecord = paymentRecord && typeof paymentRecord === "object" ? paymentRecord : {};

        if (paymentModel) {
            return paymentModel.createPaymentRecord(safeRecord, { paymentStatus });
        }

        return safeRecord;
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

    function getCurrencySymbol(currency) {
        const normalizedCurrency = normalizeUpperText(currency) || "ZAR";

        if (normalizedCurrency === "ZAR") {
            return "R";
        }

        if (normalizedCurrency === "USD") {
            return "$";
        }

        if (normalizedCurrency === "EUR") {
            return "EUR ";
        }

        if (normalizedCurrency === "GBP") {
            return "GBP ";
        }

        return `${normalizedCurrency} `;
    }

    function formatPaymentAmount(amount, currencyOrOptions = "ZAR", maybeOptions = {}) {
        const optionsFromSecondArg = currencyOrOptions && typeof currencyOrOptions === "object"
            ? currencyOrOptions
            : {};
        const safeOptions = {
            ...(maybeOptions && typeof maybeOptions === "object" ? maybeOptions : {}),
            ...optionsFromSecondArg
        };
        const currency = normalizeUpperText(
            typeof currencyOrOptions === "string"
                ? currencyOrOptions
                : safeOptions.currency
        ) || "ZAR";
        const symbol = safeOptions.symbol !== undefined
            ? `${safeOptions.symbol}`
            : getCurrencySymbol(currency);
        const emptyValue = safeOptions.emptyValue !== undefined
            ? `${safeOptions.emptyValue}`
            : `${symbol}0.00`;
        const formattedNumber = formatGroupedNumber(amount, {
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

    function formatPaymentAmountInMinorUnits(amountInMinorUnits, currencyOrOptions = "ZAR", maybeOptions = {}) {
        const parsed = Number.parseInt(amountInMinorUnits, 10);
        const amount = Number.isFinite(parsed) ? parsed / 100 : 0;

        return formatPaymentAmount(amount, currencyOrOptions, maybeOptions);
    }

    function getPaymentStatusLabel(status, explicitPaymentStatus) {
        const paymentStatus = resolvePaymentStatus(explicitPaymentStatus);

        if (paymentStatus && typeof paymentStatus.getPaymentStatusLabel === "function") {
            return paymentStatus.getPaymentStatusLabel(status);
        }

        return normalizeText(status) || "Unknown Payment Status";
    }

    function getPaymentStatusShortLabel(status, explicitPaymentStatus) {
        const paymentStatus = resolvePaymentStatus(explicitPaymentStatus);

        if (paymentStatus && typeof paymentStatus.getPaymentStatusShortLabel === "function") {
            return paymentStatus.getPaymentStatusShortLabel(status);
        }

        return normalizeText(status) || "Unknown";
    }

    function getPaymentStatusDescription(status, explicitPaymentStatus) {
        const paymentStatus = resolvePaymentStatus(explicitPaymentStatus);

        if (paymentStatus && typeof paymentStatus.getPaymentStatusDescription === "function") {
            return paymentStatus.getPaymentStatusDescription(status);
        }

        return "The payment status is still being resolved.";
    }

    function getPaymentStatusTone(status, explicitPaymentStatus) {
        const paymentStatus = resolvePaymentStatus(explicitPaymentStatus);

        if (paymentStatus && typeof paymentStatus.getPaymentStatusTone === "function") {
            return paymentStatus.getPaymentStatusTone(status);
        }

        return "neutral";
    }

    function getPaymentStatusActionLabel(status, explicitPaymentStatus) {
        const paymentStatus = resolvePaymentStatus(explicitPaymentStatus);

        if (paymentStatus && typeof paymentStatus.getPaymentStatusActionLabel === "function") {
            return paymentStatus.getPaymentStatusActionLabel(status);
        }

        return "Review Payment";
    }

    function formatPaymentProvider(provider) {
        const normalizedProvider = normalizeLowerText(provider);

        if (normalizedProvider === "paystack") {
            return "Paystack";
        }

        return normalizeText(provider) || "Payment Provider";
    }

    function formatPaymentReference(reference, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeReference = normalizeText(reference);
        const emptyValue = safeOptions.emptyValue !== undefined
            ? `${safeOptions.emptyValue}`
            : "No reference";
        const prefix = safeOptions.prefix !== undefined
            ? normalizeText(safeOptions.prefix)
            : "Ref";
        const visibleChars = Number.parseInt(safeOptions.visibleChars, 10);
        const finalVisibleChars = Number.isFinite(visibleChars) && visibleChars > 0
            ? visibleChars
            : 8;

        if (!safeReference) {
            return emptyValue;
        }

        const visibleSegment = safeReference.length > (finalVisibleChars + 2)
            ? safeReference.slice(-finalVisibleChars)
            : safeReference;

        if (!prefix) {
            return `#${visibleSegment}`;
        }

        return `${prefix} #${visibleSegment}`;
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

    function formatPaymentTimestamp(paymentRecord, options = {}) {
        const normalizedPayment = normalizePaymentRecord(paymentRecord, options);
        const timestamp = normalizedPayment.paidAt ||
            normalizedPayment.verifiedAt ||
            normalizedPayment.failedAt ||
            normalizedPayment.updatedAt ||
            normalizedPayment.createdAt;

        return formatDateTime(timestamp, options);
    }

    function formatPaymentSummary(paymentRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const paymentStatus = resolvePaymentStatus(safeOptions.paymentStatus);
        const normalizedPayment = normalizePaymentRecord(paymentRecord, safeOptions);

        return {
            providerLabel: formatPaymentProvider(normalizedPayment.provider),
            status: normalizedPayment.status || "",
            statusLabel: getPaymentStatusLabel(normalizedPayment.status, paymentStatus),
            statusShortLabel: getPaymentStatusShortLabel(normalizedPayment.status, paymentStatus),
            statusDescription: getPaymentStatusDescription(normalizedPayment.status, paymentStatus),
            statusTone: getPaymentStatusTone(normalizedPayment.status, paymentStatus),
            actionLabel: getPaymentStatusActionLabel(normalizedPayment.status, paymentStatus),
            amountLabel: formatPaymentAmount(normalizedPayment.amount, normalizedPayment.currency),
            referenceLabel: formatPaymentReference(normalizedPayment.reference),
            timestampLabel: formatPaymentTimestamp(normalizedPayment, safeOptions)
        };
    }

    const paymentFormatters = {
        MODULE_NAME,
        resolvePaymentStatus,
        resolvePaymentModel,
        normalizeText,
        normalizeLowerText,
        normalizeUpperText,
        normalizeNumber,
        normalizePaymentRecord,
        formatGroupedNumber,
        getCurrencySymbol,
        formatPaymentAmount,
        formatPaymentAmountInMinorUnits,
        getPaymentStatusLabel,
        getPaymentStatusShortLabel,
        getPaymentStatusDescription,
        getPaymentStatusTone,
        getPaymentStatusActionLabel,
        formatPaymentProvider,
        formatPaymentReference,
        toDateInstance,
        formatDateTime,
        formatPaymentTimestamp,
        formatPaymentSummary
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = paymentFormatters;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.paymentFormatters = paymentFormatters;
    }
})(typeof window !== "undefined" ? window : globalThis);
