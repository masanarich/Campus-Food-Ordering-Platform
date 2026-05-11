(function attachPaymentValidation(globalScope) {
    "use strict";

    const MODULE_NAME = "payment-validation";
    const DEFAULT_ALLOWED_CURRENCIES = Object.freeze(["ZAR"]);
    const DEFAULT_ALLOWED_PROVIDERS = Object.freeze(["paystack"]);

    function resolvePaymentStatus(explicitPaymentStatus) {
        if (
            explicitPaymentStatus &&
            typeof explicitPaymentStatus.normalizePaymentStatus === "function" &&
            typeof explicitPaymentStatus.validatePaymentStatusTransition === "function"
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
            typeof globalScope.paymentStatus.validatePaymentStatusTransition === "function"
        ) {
            return globalScope.paymentStatus;
        }

        if (typeof require === "function") {
            try {
                const requiredPaymentStatus = require("./payment-status.js");

                if (
                    requiredPaymentStatus &&
                    typeof requiredPaymentStatus.normalizePaymentStatus === "function" &&
                    typeof requiredPaymentStatus.validatePaymentStatusTransition === "function"
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
            typeof explicitPaymentModel.createPaymentRecord === "function" &&
            typeof explicitPaymentModel.normalizeCurrencyAmount === "function"
        ) {
            return explicitPaymentModel;
        }

        if (explicitPaymentModel !== undefined && explicitPaymentModel !== null) {
            return null;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.paymentModel &&
            typeof globalScope.paymentModel.createPaymentRecord === "function" &&
            typeof globalScope.paymentModel.normalizeCurrencyAmount === "function"
        ) {
            return globalScope.paymentModel;
        }

        if (typeof require === "function") {
            try {
                const requiredPaymentModel = require("./payment-model.js");

                if (
                    requiredPaymentModel &&
                    typeof requiredPaymentModel.createPaymentRecord === "function" &&
                    typeof requiredPaymentModel.normalizeCurrencyAmount === "function"
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

    function createValidationResult(errors, details = {}) {
        const safeErrors = errors && typeof errors === "object" ? errors : {};
        const safeDetails = details && typeof details === "object" ? details : {};

        return {
            isValid: Object.keys(safeErrors).length === 0,
            errors: safeErrors,
            ...safeDetails
        };
    }

    function setError(errors, key, message) {
        if (!errors || !key || !message) {
            return errors;
        }

        if (!Object.prototype.hasOwnProperty.call(errors, key)) {
            errors[key] = message;
        }

        return errors;
    }

    function mergeErrors(targetErrors, sourceErrors, prefix) {
        const safeTarget = targetErrors && typeof targetErrors === "object" ? targetErrors : {};
        const safeSource = sourceErrors && typeof sourceErrors === "object" ? sourceErrors : {};
        const safePrefix = normalizeText(prefix);

        Object.keys(safeSource).forEach(function mergeOne(key) {
            const finalKey = safePrefix ? `${safePrefix}.${key}` : key;
            setError(safeTarget, finalKey, safeSource[key]);
        });

        return safeTarget;
    }

    function normalizeAllowedValues(values, normalizer) {
        return (Array.isArray(values) && values.length > 0 ? values : [])
            .map(function normalizeOne(value) {
                return normalizer(value);
            })
            .filter(Boolean);
    }

    function validatePaymentAmount(amount, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const paymentModel = resolvePaymentModel(safeOptions.paymentModel);
        const value = paymentModel && typeof paymentModel.normalizeCurrencyAmount === "function"
            ? paymentModel.normalizeCurrencyAmount(amount, safeOptions.fallbackAmount)
            : normalizeCurrencyAmount(amount, safeOptions.fallbackAmount);
        const errors = {};
        const minimumAmount = Number.isFinite(Number(safeOptions.minimumAmount))
            ? Number(safeOptions.minimumAmount)
            : 0.01;
        const maximumAmount = Number.isFinite(Number(safeOptions.maximumAmount))
            ? Number(safeOptions.maximumAmount)
            : null;

        if (amount === undefined || amount === null || normalizeText(String(amount)) === "") {
            setError(errors, "amount", "Payment amount is required.");
        } else if (value < minimumAmount) {
            setError(errors, "amount", `Payment amount must be at least ${minimumAmount}.`);
        } else if (maximumAmount !== null && value > maximumAmount) {
            setError(errors, "amount", `Payment amount cannot exceed ${maximumAmount}.`);
        }

        return createValidationResult(errors, { value });
    }

    function validatePaymentAmountInMinorUnits(amountInMinorUnits, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const paymentModel = resolvePaymentModel(safeOptions.paymentModel);
        const value = paymentModel && typeof paymentModel.normalizeAmountInMinorUnits === "function"
            ? paymentModel.normalizeAmountInMinorUnits(amountInMinorUnits, safeOptions.fallbackAmountInMinorUnits)
            : normalizeAmountInMinorUnits(amountInMinorUnits, safeOptions.fallbackAmountInMinorUnits);
        const errors = {};
        const minimumAmountInMinorUnits = Number.isFinite(Number(safeOptions.minimumAmountInMinorUnits))
            ? Number(safeOptions.minimumAmountInMinorUnits)
            : 1;
        const maximumAmountInMinorUnits = Number.isFinite(Number(safeOptions.maximumAmountInMinorUnits))
            ? Number(safeOptions.maximumAmountInMinorUnits)
            : null;

        if (
            amountInMinorUnits === undefined ||
            amountInMinorUnits === null ||
            normalizeText(String(amountInMinorUnits)) === ""
        ) {
            setError(errors, "amountInMinorUnits", "Payment amount in minor units is required.");
        } else if (value < minimumAmountInMinorUnits) {
            setError(errors, "amountInMinorUnits", `Payment amount must be at least ${minimumAmountInMinorUnits} cents.`);
        } else if (maximumAmountInMinorUnits !== null && value > maximumAmountInMinorUnits) {
            setError(errors, "amountInMinorUnits", `Payment amount cannot exceed ${maximumAmountInMinorUnits} cents.`);
        }

        return createValidationResult(errors, { value });
    }

    function validatePaymentCurrency(currency, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const allowedCurrencies = normalizeAllowedValues(
            safeOptions.allowedCurrencies || DEFAULT_ALLOWED_CURRENCIES,
            normalizeUpperText
        );
        const value = normalizeUpperText(currency || safeOptions.fallbackCurrency || "ZAR");
        const errors = {};

        if (!value) {
            setError(errors, "currency", "Payment currency is required.");
        } else if (allowedCurrencies.length > 0 && allowedCurrencies.indexOf(value) === -1) {
            setError(errors, "currency", `Payment currency must be one of: ${allowedCurrencies.join(", ")}.`);
        }

        return createValidationResult(errors, { value });
    }

    function validatePaymentProvider(provider, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const allowedProviders = normalizeAllowedValues(
            safeOptions.allowedProviders || DEFAULT_ALLOWED_PROVIDERS,
            normalizeLowerText
        );
        const value = normalizeLowerText(provider || safeOptions.fallbackProvider || "paystack");
        const errors = {};

        if (!value) {
            setError(errors, "provider", "Payment provider is required.");
        } else if (allowedProviders.length > 0 && allowedProviders.indexOf(value) === -1) {
            setError(errors, "provider", `Payment provider must be one of: ${allowedProviders.join(", ")}.`);
        }

        return createValidationResult(errors, { value });
    }

    function validatePaymentReference(reference, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const value = normalizeText(reference);
        const errors = {};
        const isRequired = safeOptions.required !== false;
        const minimumLength = Number.isFinite(Number(safeOptions.minimumLength))
            ? Number(safeOptions.minimumLength)
            : 4;

        if (!value) {
            if (isRequired) {
                setError(errors, "reference", "Payment reference is required.");
            }
        } else if (value.length < minimumLength) {
            setError(errors, "reference", `Payment reference must be at least ${minimumLength} characters.`);
        }

        return createValidationResult(errors, { value });
    }

    function validatePaymentCustomer(paymentValues, options = {}) {
        const safeValues = paymentValues && typeof paymentValues === "object" ? paymentValues : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const value = {
            customerUid: normalizeText(safeValues.customerUid || safeValues.userUid),
            customerEmail: normalizeLowerText(safeValues.customerEmail || safeValues.email)
        };
        const errors = {};

        if (!value.customerUid) {
            setError(errors, "customerUid", "Customer UID is required before starting payment.");
        }

        if (safeOptions.requireEmail !== false && !value.customerEmail) {
            setError(errors, "customerEmail", "Customer email is required before starting payment.");
        } else if (value.customerEmail && (!value.customerEmail.includes("@") || !value.customerEmail.includes("."))) {
            setError(errors, "customerEmail", "Customer email must be a valid email address.");
        }

        return createValidationResult(errors, { value });
    }

    function validatePaymentRecord(paymentValues, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const rawValues = paymentValues && typeof paymentValues === "object" ? paymentValues : {};
        const rawStatus = rawValues.status || rawValues.paymentStatus;
        const hasRawStatus = rawStatus !== undefined &&
            rawStatus !== null &&
            normalizeText(String(rawStatus)) !== "";
        const paymentModel = resolvePaymentModel(safeOptions.paymentModel);
        const paymentStatus = resolvePaymentStatus(safeOptions.paymentStatus);
        const value = paymentModel
            ? paymentModel.createPaymentRecord(paymentValues, { paymentStatus })
            : paymentValues;
        const errors = {};
        const safeValue = value && typeof value === "object" ? value : {};
        const amountResult = validatePaymentAmount(safeValue.amount, safeOptions);
        const amountInMinorUnitsResult = validatePaymentAmountInMinorUnits(
            safeValue.amountInMinorUnits,
            safeOptions
        );
        const currencyResult = validatePaymentCurrency(safeValue.currency, safeOptions);
        const providerResult = validatePaymentProvider(safeValue.provider, safeOptions);
        const customerResult = validatePaymentCustomer(safeValue, safeOptions);
        const statusValue = paymentStatus
            ? paymentStatus.normalizePaymentStatus(hasRawStatus ? rawStatus : safeValue.status)
            : normalizeLowerText(safeValue.status);

        mergeErrors(errors, amountResult.errors);
        mergeErrors(errors, amountInMinorUnitsResult.errors);
        mergeErrors(errors, currencyResult.errors);
        mergeErrors(errors, providerResult.errors);
        mergeErrors(errors, customerResult.errors);

        if (!normalizeText(safeValue.orderId) && safeOptions.requireOrderId !== false) {
            setError(errors, "orderId", "Order ID is required before starting payment.");
        }

        if (!statusValue) {
            setError(errors, "status", "Payment status is invalid.");
        }

        if (safeOptions.requireReference === true) {
            mergeErrors(errors, validatePaymentReference(safeValue.reference).errors);
        }

        return createValidationResult(errors, { value });
    }

    function validateInitializePaymentInput(paymentValues, options = {}) {
        return validatePaymentRecord(paymentValues, {
            ...options,
            requireReference: false
        });
    }

    function validateVerifyPaymentInput(paymentValues, options = {}) {
        return validatePaymentRecord(paymentValues, {
            ...options,
            requireReference: true
        });
    }

    function validatePaymentStatusChange(currentStatus, nextStatus, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const paymentStatus = resolvePaymentStatus(safeOptions.paymentStatus);

        if (!paymentStatus || typeof paymentStatus.validatePaymentStatusTransition !== "function") {
            return {
                isValid: false,
                currentStatus: normalizeLowerText(currentStatus),
                nextStatus: normalizeLowerText(nextStatus),
                message: "Payment status helpers are required before changing payment status."
            };
        }

        return paymentStatus.validatePaymentStatusTransition(currentStatus, nextStatus);
    }

    function validateVerifiedPayment(paymentValues, verificationValues, options = {}) {
        const safePayment = paymentValues && typeof paymentValues === "object" ? paymentValues : {};
        const safeVerification = verificationValues && typeof verificationValues === "object"
            ? verificationValues
            : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const expectedAmount = normalizeAmountInMinorUnits(
            safeOptions.expectedAmountInMinorUnits,
            safePayment.amountInMinorUnits
        );
        const actualAmount = normalizeAmountInMinorUnits(
            safeVerification.amountInMinorUnits,
            safeVerification.amount
        );
        const expectedCurrency = normalizeUpperText(safeOptions.expectedCurrency || safePayment.currency || "ZAR");
        const actualCurrency = normalizeUpperText(safeVerification.currency || expectedCurrency);
        const expectedReference = normalizeText(safeOptions.expectedReference || safePayment.reference);
        const actualReference = normalizeText(safeVerification.reference);
        const status = normalizeLowerText(safeVerification.status);
        const errors = {};

        if (status !== "success") {
            setError(errors, "status", "Paystack payment must have a successful verification status.");
        }

        if (!actualReference) {
            setError(errors, "reference", "Verified payment reference is required.");
        } else if (expectedReference && actualReference !== expectedReference) {
            setError(errors, "reference", "Verified payment reference does not match the expected reference.");
        }

        if (actualAmount !== expectedAmount) {
            setError(errors, "amount", "Verified payment amount does not match the expected amount.");
        }

        if (actualCurrency !== expectedCurrency) {
            setError(errors, "currency", "Verified payment currency does not match the expected currency.");
        }

        return createValidationResult(errors, {
            value: {
                status,
                reference: actualReference,
                amountInMinorUnits: actualAmount,
                currency: actualCurrency
            }
        });
    }

    const paymentValidation = {
        MODULE_NAME,
        DEFAULT_ALLOWED_CURRENCIES,
        DEFAULT_ALLOWED_PROVIDERS,
        resolvePaymentStatus,
        resolvePaymentModel,
        normalizeText,
        normalizeLowerText,
        normalizeUpperText,
        normalizeCurrencyAmount,
        normalizeAmountInMinorUnits,
        createValidationResult,
        setError,
        mergeErrors,
        validatePaymentAmount,
        validatePaymentAmountInMinorUnits,
        validatePaymentCurrency,
        validatePaymentProvider,
        validatePaymentReference,
        validatePaymentCustomer,
        validatePaymentRecord,
        validateInitializePaymentInput,
        validateVerifyPaymentInput,
        validatePaymentStatusChange,
        validateVerifiedPayment
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = paymentValidation;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.paymentValidation = paymentValidation;
    }
})(typeof window !== "undefined" ? window : globalThis);
