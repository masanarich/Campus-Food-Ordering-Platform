(function attachCheckoutValidation(globalScope) {
    "use strict";

    const MODULE_NAME = "checkout-validation";
    const DEFAULT_ALLOWED_CURRENCIES = Object.freeze(["ZAR"]);
    const DEFAULT_ALLOWED_PROVIDERS = Object.freeze(["paystack"]);

    function resolveCheckoutStatus(explicitCheckoutStatus) {
        if (
            explicitCheckoutStatus &&
            typeof explicitCheckoutStatus.normalizeCheckoutStatus === "function" &&
            typeof explicitCheckoutStatus.validateCheckoutStatusTransition === "function"
        ) {
            return explicitCheckoutStatus;
        }

        if (explicitCheckoutStatus !== undefined && explicitCheckoutStatus !== null) {
            return null;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.checkoutStatus &&
            typeof globalScope.checkoutStatus.normalizeCheckoutStatus === "function" &&
            typeof globalScope.checkoutStatus.validateCheckoutStatusTransition === "function"
        ) {
            return globalScope.checkoutStatus;
        }

        if (typeof require === "function") {
            try {
                const requiredCheckoutStatus = require("./checkout-status.js");

                if (
                    requiredCheckoutStatus &&
                    typeof requiredCheckoutStatus.normalizeCheckoutStatus === "function" &&
                    typeof requiredCheckoutStatus.validateCheckoutStatusTransition === "function"
                ) {
                    return requiredCheckoutStatus;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveCheckoutModel(explicitCheckoutModel) {
        if (
            explicitCheckoutModel &&
            typeof explicitCheckoutModel.createCheckoutSessionRecord === "function" &&
            typeof explicitCheckoutModel.normalizeCheckoutItem === "function"
        ) {
            return explicitCheckoutModel;
        }

        if (explicitCheckoutModel !== undefined && explicitCheckoutModel !== null) {
            return null;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.checkoutModel &&
            typeof globalScope.checkoutModel.createCheckoutSessionRecord === "function" &&
            typeof globalScope.checkoutModel.normalizeCheckoutItem === "function"
        ) {
            return globalScope.checkoutModel;
        }

        if (typeof require === "function") {
            try {
                const requiredCheckoutModel = require("./checkout-model.js");

                if (
                    requiredCheckoutModel &&
                    typeof requiredCheckoutModel.createCheckoutSessionRecord === "function" &&
                    typeof requiredCheckoutModel.normalizeCheckoutItem === "function"
                ) {
                    return requiredCheckoutModel;
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

    function isValidEmail(value) {
        const normalizedValue = normalizeLowerText(value);
        return normalizedValue.includes("@") && normalizedValue.includes(".");
    }

    function hasText(value) {
        return normalizeText(value) !== "";
    }

    function hasOwnField(source, fieldName) {
        return source && Object.prototype.hasOwnProperty.call(source, fieldName);
    }

    function getRawItemPrice(item) {
        const safeItem = item && typeof item === "object" ? item : {};

        if (hasOwnField(safeItem, "price")) {
            return safeItem.price;
        }

        if (hasOwnField(safeItem, "customerPrice")) {
            return safeItem.customerPrice;
        }

        if (hasOwnField(safeItem, "unitPrice")) {
            return safeItem.unitPrice;
        }

        if (hasOwnField(safeItem, "vendorPrice")) {
            return safeItem.vendorPrice;
        }

        if (hasOwnField(safeItem, "basePrice")) {
            return safeItem.basePrice;
        }

        return undefined;
    }

    function validateCustomerSnapshot(customerSnapshot, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeSnapshot = customerSnapshot && typeof customerSnapshot === "object" ? customerSnapshot : {};
        const checkoutModel = resolveCheckoutModel(safeOptions.checkoutModel);
        const value = checkoutModel
            ? checkoutModel.createCustomerSnapshot(customerSnapshot)
            : {
                customerUid: normalizeText(safeSnapshot.customerUid),
                customerName: normalizeText(safeSnapshot.customerName),
                customerEmail: normalizeLowerText(safeSnapshot.customerEmail)
            };
        const errors = {};
        const rawCustomerUid = normalizeText(
            safeSnapshot.customerUid ||
            safeSnapshot.uid ||
            safeSnapshot.userUid
        );
        const rawCustomerName = normalizeText(
            safeSnapshot.customerName ||
            safeSnapshot.displayName ||
            safeSnapshot.name
        );
        const rawCustomerEmail = normalizeLowerText(safeSnapshot.customerEmail || safeSnapshot.email);

        if (!rawCustomerUid) {
            setError(errors, "customerUid", "Customer UID is required.");
        }

        if (!rawCustomerName) {
            setError(errors, "customerName", "Customer name is required.");
        }

        if (safeOptions.requireEmail !== false) {
            if (!rawCustomerEmail) {
                setError(errors, "customerEmail", "Customer email is required.");
            } else if (!isValidEmail(rawCustomerEmail)) {
                setError(errors, "customerEmail", "Customer email must be a valid email address.");
            }
        }

        return createValidationResult(errors, { value });
    }

    function validateVendorSnapshot(vendorSnapshot, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeSnapshot = vendorSnapshot && typeof vendorSnapshot === "object" ? vendorSnapshot : {};
        const checkoutModel = resolveCheckoutModel(safeOptions.checkoutModel);
        const value = checkoutModel
            ? checkoutModel.createVendorSnapshot(vendorSnapshot)
            : {
                vendorUid: normalizeText(safeSnapshot.vendorUid),
                vendorName: normalizeText(safeSnapshot.vendorName)
            };
        const errors = {};
        const rawVendorUid = normalizeText(
            safeSnapshot.vendorUid ||
            safeSnapshot.uid ||
            safeSnapshot.userUid
        );
        const rawVendorName = normalizeText(
            safeSnapshot.vendorName ||
            safeSnapshot.shopName ||
            safeSnapshot.displayName ||
            safeSnapshot.name
        );

        if (!rawVendorUid) {
            setError(errors, "vendorUid", "Vendor UID is required.");
        }

        if (!rawVendorName) {
            setError(errors, "vendorName", "Vendor name is required.");
        }

        return createValidationResult(errors, { value });
    }

    function validateCheckoutItem(item, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeItem = item && typeof item === "object" ? item : {};
        const checkoutModel = resolveCheckoutModel(safeOptions.checkoutModel);
        const value = checkoutModel
            ? checkoutModel.normalizeCheckoutItem(safeItem, safeOptions.index || 0)
            : {
                menuItemId: normalizeText(safeItem.menuItemId || safeItem.productId || safeItem.itemId || safeItem.id),
                vendorUid: normalizeText(safeItem.vendorUid),
                vendorName: normalizeText(safeItem.vendorName),
                name: normalizeText(safeItem.name || safeItem.itemName),
                category: normalizeText(safeItem.category),
                price: normalizeCurrencyAmount(getRawItemPrice(safeItem)),
                quantity: Number.parseInt(safeItem.quantity, 10) > 0 ? Number.parseInt(safeItem.quantity, 10) : 1,
                lineTotal: normalizeCurrencyAmount(
                    normalizeCurrencyAmount(getRawItemPrice(safeItem)) *
                    (Number.parseInt(safeItem.quantity, 10) > 0 ? Number.parseInt(safeItem.quantity, 10) : 1)
                ),
                photoURL: normalizeText(safeItem.photoURL || safeItem.imageUrl || safeItem.imageURL),
                notes: normalizeText(safeItem.notes || safeItem.note)
            };
        const errors = {};
        const rawQuantity = safeItem.quantity !== undefined ? safeItem.quantity : safeItem.qty;
        const rawPrice = getRawItemPrice(safeItem);
        const rawMenuItemId = normalizeText(
            safeItem.menuItemId ||
            safeItem.productId ||
            safeItem.itemId ||
            safeItem.id
        );
        const rawName = normalizeText(safeItem.name || safeItem.itemName);
        const parsedRawQuantity = Number.parseInt(rawQuantity, 10);
        const parsedRawPrice = Number.parseFloat(rawPrice);

        if (!rawMenuItemId && !rawName) {
            setError(errors, "menuItemId", "Each checkout item needs a menu item ID or item name.");
        }

        if (!rawName) {
            setError(errors, "name", "Each checkout item needs a name.");
        }

        if (rawPrice === undefined || rawPrice === null || normalizeText(String(rawPrice)) === "") {
            setError(errors, "price", "Each checkout item needs a price.");
        } else if (!Number.isFinite(parsedRawPrice) || parsedRawPrice < 0) {
            setError(errors, "price", "Each checkout item price must be a valid non-negative amount.");
        }

        if (rawQuantity !== undefined && (!Number.isFinite(parsedRawQuantity) || parsedRawQuantity <= 0)) {
            setError(errors, "quantity", "Each checkout item quantity must be at least 1.");
        }

        if (safeOptions.requireVendorDetails === true && !value.vendorUid) {
            setError(errors, "vendorUid", "Each checkout item needs a vendor UID.");
        }

        return createValidationResult(errors, { value });
    }

    function validateCheckoutItems(items, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeItems = Array.isArray(items) ? items : [];
        const errors = {};
        const value = [];

        if (!Array.isArray(items) || safeItems.length === 0) {
            setError(errors, "items", "Add at least one checkout item.");
        }

        safeItems.forEach(function validateOneItem(item, index) {
            const result = validateCheckoutItem(item, {
                ...safeOptions,
                index
            });
            value.push(result.value);
            mergeErrors(errors, result.errors, `items.${index}`);
        });

        return createValidationResult(errors, { value });
    }

    function validateCheckoutTimeline(timeline, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeTimeline = Array.isArray(timeline) ? timeline : [];
        const checkoutStatus = resolveCheckoutStatus(safeOptions.checkoutStatus);
        const checkoutModel = resolveCheckoutModel(safeOptions.checkoutModel);
        const errors = {};
        const value = [];

        if (!Array.isArray(timeline) || safeTimeline.length === 0) {
            setError(errors, "timeline", "At least one checkout timeline entry is required.");
        }

        safeTimeline.forEach(function validateOneEntry(entry, index) {
            const safeEntry = entry && typeof entry === "object" ? entry : {};
            const normalizedEntry = checkoutModel
                ? checkoutModel.createCheckoutTimelineEntry(
                    safeEntry.status,
                    safeEntry,
                    checkoutStatus
                )
                : {
                    status: normalizeLowerText(safeEntry.status),
                    label: normalizeText(safeEntry.label),
                    actorRole: normalizeLowerText(safeEntry.actorRole),
                    actorUid: normalizeText(safeEntry.actorUid),
                    actorName: normalizeText(safeEntry.actorName),
                    note: normalizeText(safeEntry.note),
                    at: safeEntry.at !== undefined ? safeEntry.at : safeEntry.timestamp
                };

            value.push(normalizedEntry);

            if (!checkoutStatus || !checkoutStatus.isKnownCheckoutStatus(safeEntry.status)) {
                setError(
                    errors,
                    `timeline.${index}.status`,
                    "Timeline entries need a valid checkout status."
                );
            }

            if (
                !checkoutStatus ||
                typeof checkoutStatus.normalizeCheckoutActorRole !== "function" ||
                !checkoutStatus.normalizeCheckoutActorRole(safeEntry.actorRole)
            ) {
                setError(
                    errors,
                    `timeline.${index}.actorRole`,
                    "Timeline entries need a valid actor role."
                );
            }

            if (normalizedEntry.at === null || normalizedEntry.at === undefined) {
                setError(errors, `timeline.${index}.at`, "Timeline entries need a timestamp.");
            }
        });

        return createValidationResult(errors, { value });
    }

    function validateCheckoutTotals(checkoutRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const checkoutModel = resolveCheckoutModel(safeOptions.checkoutModel);
        const normalizedRecord = safeOptions.normalizedRecord || (
            checkoutModel
                ? checkoutModel.normalizeCheckoutSessionRecord(checkoutRecord, {
                    checkoutStatus: safeOptions.checkoutStatus
                })
                : checkoutRecord
        ) || {};
        const errors = {};
        const expectedSubtotal = checkoutModel
            ? checkoutModel.calculateCheckoutSubtotal(normalizedRecord.items)
            : normalizeCurrencyAmount(normalizedRecord.subtotal);
        const expectedVendorSubtotal = checkoutModel &&
            typeof checkoutModel.calculateCheckoutVendorSubtotal === "function"
            ? checkoutModel.calculateCheckoutVendorSubtotal(normalizedRecord.items)
            : normalizeCurrencyAmount(normalizedRecord.vendorSubtotal, normalizedRecord.vendorEarnings);
        const expectedPlatformFee = checkoutModel &&
            typeof checkoutModel.calculateCheckoutPlatformFee === "function"
            ? checkoutModel.calculateCheckoutPlatformFee(normalizedRecord.items)
            : normalizeCurrencyAmount(normalizedRecord.platformFee, normalizedRecord.platformEarnings);
        const subtotal = normalizeCurrencyAmount(normalizedRecord.subtotal);
        const total = normalizeCurrencyAmount(normalizedRecord.total);
        const vendorSubtotal = normalizeCurrencyAmount(normalizedRecord.vendorSubtotal, expectedVendorSubtotal);
        const vendorEarnings = normalizeCurrencyAmount(normalizedRecord.vendorEarnings, vendorSubtotal);
        const platformFee = normalizeCurrencyAmount(normalizedRecord.platformFee, expectedPlatformFee);
        const platformEarnings = normalizeCurrencyAmount(normalizedRecord.platformEarnings, platformFee);
        const customerTotal = normalizeCurrencyAmount(normalizedRecord.customerTotal, total);
        const paymentAmount = normalizeCurrencyAmount(normalizedRecord.paymentAmount);
        const paymentAmountInMinorUnits = normalizeAmountInMinorUnits(normalizedRecord.paymentAmountInMinorUnits);
        const expectedAmountInMinorUnits = Math.round(paymentAmount * 100);
        const hasFinanceFields = [
            "vendorSubtotal",
            "vendorEarnings",
            "platformFee",
            "platformEarnings",
            "customerTotal"
        ].some(function hasFinanceField(fieldName) {
            return hasOwnField(normalizedRecord, fieldName);
        });

        if (subtotal !== expectedSubtotal) {
            setError(
                errors,
                "subtotal",
                `Checkout subtotal must match the sum of its items (${expectedSubtotal}).`
            );
        }

        if (total < subtotal) {
            setError(errors, "total", "Checkout total cannot be less than subtotal.");
        }

        if (vendorSubtotal !== expectedVendorSubtotal) {
            setError(
                errors,
                "vendorSubtotal",
                `Vendor subtotal must match the vendor share of its items (${expectedVendorSubtotal}).`
            );
        }

        if (vendorEarnings !== vendorSubtotal) {
            setError(errors, "vendorEarnings", "Vendor earnings must match the vendor subtotal.");
        }

        if (platformFee !== expectedPlatformFee) {
            setError(
                errors,
                "platformFee",
                `Platform fee must match the platform share of its items (${expectedPlatformFee}).`
            );
        }

        if (platformEarnings !== platformFee) {
            setError(errors, "platformEarnings", "Platform earnings must match the platform fee.");
        }

        if (customerTotal !== total) {
            setError(errors, "customerTotal", "Customer total must match the checkout total.");
        }

        if ((checkoutModel || hasFinanceFields) && normalizeCurrencyAmount(vendorSubtotal + platformFee) !== customerTotal) {
            setError(errors, "financeTotal", "Vendor subtotal plus platform fee must match the customer total.");
        }

        if (paymentAmount !== total) {
            setError(errors, "paymentAmount", "Payment amount must match the checkout total.");
        }

        if (paymentAmountInMinorUnits !== expectedAmountInMinorUnits) {
            setError(
                errors,
                "paymentAmountInMinorUnits",
                "Payment amount in minor units must match the payment amount."
            );
        }

        return createValidationResult(errors, {
            value: {
                subtotal,
                total,
                vendorSubtotal,
                vendorEarnings,
                platformFee,
                platformEarnings,
                customerTotal,
                paymentAmount,
                paymentAmountInMinorUnits,
                expectedSubtotal,
                expectedVendorSubtotal,
                expectedPlatformFee,
                expectedAmountInMinorUnits
            }
        });
    }

    function validateCheckoutPaymentFields(checkoutRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeRecord = safeOptions.rawCheckoutRecord && typeof safeOptions.rawCheckoutRecord === "object"
            ? safeOptions.rawCheckoutRecord
            : (checkoutRecord && typeof checkoutRecord === "object" ? checkoutRecord : {});
        const checkoutStatus = resolveCheckoutStatus(safeOptions.checkoutStatus);
        const checkoutModel = resolveCheckoutModel(safeOptions.checkoutModel);
        const value = safeOptions.normalizedRecord || (
            checkoutModel
                ? checkoutModel.normalizeCheckoutSessionRecord(safeRecord, { checkoutStatus })
                : safeRecord
        ) || {};
        const errors = {};
        const rawStatus = safeRecord.status !== undefined ? safeRecord.status : value.status;
        const hasRawStatus = rawStatus !== undefined &&
            rawStatus !== null &&
            normalizeText(String(rawStatus)) !== "";
        const normalizedStatus = checkoutStatus
            ? checkoutStatus.normalizeCheckoutStatus(hasRawStatus ? rawStatus : value.status)
            : normalizeLowerText(value.status);
        const allowedProviders = normalizeAllowedValues(
            safeOptions.allowedPaymentProviders || DEFAULT_ALLOWED_PROVIDERS,
            normalizeLowerText
        );
        const allowedCurrencies = normalizeAllowedValues(
            safeOptions.allowedPaymentCurrencies || DEFAULT_ALLOWED_CURRENCIES,
            normalizeUpperText
        );
        const provider = normalizeLowerText(value.paymentProvider);
        const currency = normalizeUpperText(value.paymentCurrency);
        const paymentAmount = Number(value.paymentAmount);
        const total = Number(value.total);
        const paymentAmountInMinorUnits = Number.parseInt(value.paymentAmountInMinorUnits, 10);
        const rawPaymentAmount = safeRecord.paymentAmount !== undefined
            ? Number(safeRecord.paymentAmount)
            : paymentAmount;
        const rawPaymentAmountInMinorUnits = safeRecord.paymentAmountInMinorUnits !== undefined
            ? Number.parseInt(safeRecord.paymentAmountInMinorUnits, 10)
            : paymentAmountInMinorUnits;
        const expectedAmountInMinorUnits = Number.isFinite(paymentAmount)
            ? Math.round(paymentAmount * 100)
            : 0;
        const paymentStartedStatuses = ["payment_pending", "payment_failed", "paid", "converted"];

        if (
            !normalizedStatus ||
            (
                hasRawStatus &&
                checkoutStatus &&
                !checkoutStatus.isKnownCheckoutStatus(rawStatus)
            )
        ) {
            setError(errors, "status", "Checkout status must be valid.");
        }

        if (!provider) {
            setError(errors, "paymentProvider", "Payment provider is required.");
        } else if (allowedProviders.length > 0 && allowedProviders.indexOf(provider) === -1) {
            setError(errors, "paymentProvider", `Payment provider must be one of: ${allowedProviders.join(", ")}.`);
        }

        if (!currency) {
            setError(errors, "paymentCurrency", "Payment currency is required.");
        } else if (allowedCurrencies.length > 0 && allowedCurrencies.indexOf(currency) === -1) {
            setError(errors, "paymentCurrency", `Payment currency must be one of: ${allowedCurrencies.join(", ")}.`);
        }

        if (!Number.isFinite(rawPaymentAmount) || rawPaymentAmount < 0) {
            setError(errors, "paymentAmount", "Payment amount must be a valid non-negative amount.");
        } else if (Number.isFinite(total) && paymentAmount !== total) {
            setError(errors, "paymentAmount", "Payment amount must match the checkout total.");
        }

        if (!Number.isFinite(rawPaymentAmountInMinorUnits) || rawPaymentAmountInMinorUnits < 0) {
            setError(errors, "paymentAmountInMinorUnits", "Payment amount in minor units must be valid.");
        } else if (paymentAmountInMinorUnits !== expectedAmountInMinorUnits) {
            setError(
                errors,
                "paymentAmountInMinorUnits",
                "Payment amount in minor units must match the payment amount."
            );
        }

        if (paymentStartedStatuses.indexOf(normalizedStatus) >= 0 && !normalizeText(value.paymentReference)) {
            setError(errors, "paymentReference", "Payment reference is required once payment has started.");
        }

        if (normalizedStatus === "payment_pending") {
            if (!normalizeText(value.paymentAccessCode)) {
                setError(errors, "paymentAccessCode", "Pending payments must include a payment access code.");
            }

            if (!normalizeText(value.paymentAuthorizationUrl)) {
                setError(
                    errors,
                    "paymentAuthorizationUrl",
                    "Pending payments must include a payment authorization URL."
                );
            }
        }

        if ((normalizedStatus === "paid" || normalizedStatus === "converted") && !value.paymentVerifiedAt) {
            setError(
                errors,
                "paymentVerifiedAt",
                "Paid checkout sessions must include a payment verification timestamp."
            );
        }

        if (normalizedStatus === "payment_failed" && !hasText(value.paymentFailureReason)) {
            setError(errors, "paymentFailureReason", "Failed payments must include a failure reason.");
        }

        return createValidationResult(errors, {
            value: {
                status: normalizedStatus,
                paymentProvider: provider,
                paymentReference: normalizeText(value.paymentReference),
                paymentAccessCode: normalizeText(value.paymentAccessCode),
                paymentAuthorizationUrl: normalizeText(value.paymentAuthorizationUrl),
                paymentAmount,
                paymentAmountInMinorUnits,
                paymentCurrency: currency,
                paymentPaidAt: value.paymentPaidAt,
                paymentFailedAt: value.paymentFailedAt,
                paymentVerifiedAt: value.paymentVerifiedAt,
                paymentFailureReason: normalizeText(value.paymentFailureReason)
            }
        });
    }

    function validateCheckoutSessionRecord(checkoutRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeRecord = checkoutRecord && typeof checkoutRecord === "object" ? checkoutRecord : {};
        const checkoutStatus = resolveCheckoutStatus(safeOptions.checkoutStatus);
        const checkoutModel = resolveCheckoutModel(safeOptions.checkoutModel);
        const value = checkoutModel
            ? checkoutModel.normalizeCheckoutSessionRecord(safeRecord, { checkoutStatus })
            : safeRecord;
        const errors = {};
        const customerValidation = validateCustomerSnapshot(value, {
            checkoutModel,
            requireEmail: safeOptions.requireEmail !== false
        });
        const vendorValidation = validateVendorSnapshot(value, { checkoutModel });
        const itemsValidation = validateCheckoutItems(safeRecord.items, {
            checkoutModel,
            requireVendorDetails: false
        });
        const timelineValidation = validateCheckoutTimeline(
            Array.isArray(safeRecord.timeline) ? safeRecord.timeline : value.timeline,
            {
                checkoutModel,
                checkoutStatus
            }
        );
        const totalsValidation = validateCheckoutTotals(value, {
            checkoutModel,
            checkoutStatus,
            normalizedRecord: value
        });
        const paymentValidation = validateCheckoutPaymentFields(value, {
            checkoutModel,
            checkoutStatus,
            normalizedRecord: value,
            rawCheckoutRecord: safeRecord,
            allowedPaymentProviders: safeOptions.allowedPaymentProviders,
            allowedPaymentCurrencies: safeOptions.allowedPaymentCurrencies
        });

        mergeErrors(errors, customerValidation.errors);
        mergeErrors(errors, vendorValidation.errors);
        mergeErrors(errors, itemsValidation.errors);
        mergeErrors(errors, timelineValidation.errors);
        mergeErrors(errors, totalsValidation.errors);
        mergeErrors(errors, paymentValidation.errors);

        if (safeRecord.status !== undefined) {
            if (!checkoutStatus || !checkoutStatus.normalizeCheckoutStatus(safeRecord.status)) {
                setError(errors, "status", "Checkout status must be valid.");
            }
        }

        value.items.forEach(function validateItemVendorAlignment(item, index) {
            if (item.vendorUid && value.vendorUid && item.vendorUid !== value.vendorUid) {
                setError(
                    errors,
                    `items.${index}.vendorUid`,
                    "Each item in a checkout must belong to the same vendor as the checkout."
                );
            }
        });

        if (!value.createdAt) {
            setError(errors, "createdAt", "Checkout createdAt is required.");
        }

        if (!value.updatedAt) {
            setError(errors, "updatedAt", "Checkout updatedAt is required.");
        }

        if (value.status === "converted") {
            if (!value.convertedOrderId) {
                setError(errors, "convertedOrderId", "Converted checkouts must include the created order ID.");
            }

            if (!value.convertedAt) {
                setError(errors, "convertedAt", "Converted checkouts must include a conversion timestamp.");
            }
        }

        if (value.status === "cancelled" && !value.cancelledAt) {
            setError(errors, "cancelledAt", "Cancelled checkouts must include a cancellation timestamp.");
        }

        if (value.status === "expired" && !value.expiredAt) {
            setError(errors, "expiredAt", "Expired checkouts must include an expiry timestamp.");
        }

        return createValidationResult(errors, { value });
    }

    function validateCreateCheckoutInput(checkoutInput, options = {}) {
        const result = validateCheckoutSessionRecord(checkoutInput, options);
        const checkoutStatus = resolveCheckoutStatus(options && options.checkoutStatus);
        const errors = { ...result.errors };
        const status = result.value && result.value.status;

        if (checkoutStatus && checkoutStatus.isTerminalCheckoutStatus(status)) {
            setError(errors, "status", "New checkout sessions cannot start in a terminal status.");
        }

        return createValidationResult(errors, { value: result.value });
    }

    function validateCheckoutStatusChange(currentStatus, nextStatus, actorRole, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const checkoutStatus = resolveCheckoutStatus(safeOptions.checkoutStatus);

        if (!checkoutStatus) {
            return createValidationResult({
                status: "Checkout status helpers are unavailable."
            }, {
                transition: null
            });
        }

        const transition = checkoutStatus.validateCheckoutStatusTransition(
            currentStatus,
            nextStatus,
            actorRole
        );

        return createValidationResult(
            transition.isValid
                ? {}
                : { status: transition.message },
            { transition }
        );
    }

    function validateCheckoutCancellation(checkoutRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const checkoutStatus = resolveCheckoutStatus(safeOptions.checkoutStatus);
        const checkoutModel = resolveCheckoutModel(safeOptions.checkoutModel);
        const value = checkoutModel
            ? checkoutModel.normalizeCheckoutSessionRecord(checkoutRecord, { checkoutStatus })
            : (checkoutRecord || {});
        const actorRole = safeOptions.actorRole || "customer";
        const result = validateCheckoutStatusChange(
            value.status,
            "cancelled",
            actorRole,
            { checkoutStatus }
        );
        const errors = { ...result.errors };

        if (!value.checkoutId && safeOptions.requireCheckoutId !== false) {
            setError(errors, "checkoutId", "Checkout ID is required before cancelling checkout.");
        }

        return createValidationResult(errors, {
            value,
            transition: result.transition
        });
    }

    function validateCheckoutConversion(checkoutRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const checkoutStatus = resolveCheckoutStatus(safeOptions.checkoutStatus);
        const checkoutModel = resolveCheckoutModel(safeOptions.checkoutModel);
        const value = checkoutModel
            ? checkoutModel.normalizeCheckoutSessionRecord(checkoutRecord, { checkoutStatus })
            : (checkoutRecord || {});
        const errors = {};
        const paymentResult = validateCheckoutPaymentFields(value, {
            checkoutModel,
            checkoutStatus,
            normalizedRecord: value,
            rawCheckoutRecord: checkoutRecord,
            allowedPaymentProviders: safeOptions.allowedPaymentProviders,
            allowedPaymentCurrencies: safeOptions.allowedPaymentCurrencies
        });

        mergeErrors(errors, paymentResult.errors);

        if (value.status !== "paid") {
            setError(errors, "status", "Only paid checkout sessions can be converted into orders.");
        }

        if (!value.checkoutId) {
            setError(errors, "checkoutId", "Checkout ID is required before creating an order.");
        }

        if (safeOptions.requireOrderId === true && !normalizeText(safeOptions.orderId || value.convertedOrderId)) {
            setError(errors, "orderId", "Order ID is required before marking checkout as converted.");
        }

        return createValidationResult(errors, { value });
    }

    function validatePaymentInitializationInput(checkoutRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const checkoutStatus = resolveCheckoutStatus(safeOptions.checkoutStatus);
        const checkoutModel = resolveCheckoutModel(safeOptions.checkoutModel);
        const value = checkoutModel
            ? checkoutModel.normalizeCheckoutSessionRecord(checkoutRecord, { checkoutStatus })
            : (checkoutRecord || {});
        const errors = {};
        const customerValidation = validateCustomerSnapshot(value, {
            checkoutModel,
            requireEmail: safeOptions.requireEmail !== false
        });
        const vendorValidation = validateVendorSnapshot(value, { checkoutModel });
        const itemsValidation = validateCheckoutItems((checkoutRecord && checkoutRecord.items) || value.items, {
            checkoutModel,
            requireVendorDetails: false
        });
        const totalsValidation = validateCheckoutTotals(value, {
            checkoutModel,
            checkoutStatus,
            normalizedRecord: value
        });

        if (Number(value.paymentAmount) <= 0) {
            setError(errors, "paymentAmount", "Payment amount must be greater than zero before starting payment.");
        }

        mergeErrors(errors, customerValidation.errors);
        mergeErrors(errors, vendorValidation.errors);
        mergeErrors(errors, itemsValidation.errors);
        mergeErrors(errors, totalsValidation.errors);

        if (!value.checkoutId && safeOptions.requireCheckoutId !== false) {
            setError(errors, "checkoutId", "Checkout ID is required before starting payment.");
        }

        if (
            checkoutStatus &&
            !checkoutStatus.isRetryableCheckoutStatus(value.status) &&
            value.status !== "payment_pending"
        ) {
            setError(errors, "status", "Only draft, pending, or failed checkouts can start or resume payment.");
        }

        return createValidationResult(errors, { value });
    }

    const checkoutValidation = {
        MODULE_NAME,
        DEFAULT_ALLOWED_CURRENCIES,
        DEFAULT_ALLOWED_PROVIDERS,
        resolveCheckoutStatus,
        resolveCheckoutModel,
        normalizeText,
        normalizeLowerText,
        normalizeUpperText,
        normalizeCurrencyAmount,
        normalizeAmountInMinorUnits,
        createValidationResult,
        setError,
        mergeErrors,
        normalizeAllowedValues,
        isValidEmail,
        hasOwnField,
        getRawItemPrice,
        validateCustomerSnapshot,
        validateVendorSnapshot,
        validateCheckoutItem,
        validateCheckoutItems,
        validateCheckoutTimeline,
        validateCheckoutTotals,
        validateCheckoutPaymentFields,
        validateCheckoutSessionRecord,
        validateCreateCheckoutInput,
        validateCheckoutStatusChange,
        validateCheckoutCancellation,
        validateCheckoutConversion,
        validatePaymentInitializationInput
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = checkoutValidation;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.checkoutValidation = checkoutValidation;
    }
})(typeof window !== "undefined" ? window : globalThis);
