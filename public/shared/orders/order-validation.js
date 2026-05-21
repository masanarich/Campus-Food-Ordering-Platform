(function attachOrderValidation(globalScope) {
    "use strict";

    const MODULE_NAME = "order-validation";

    function resolveOrderStatus(explicitOrderStatus) {
        if (
            explicitOrderStatus &&
            typeof explicitOrderStatus.normalizeOrderStatus === "function" &&
            typeof explicitOrderStatus.validateOrderStatusTransition === "function"
        ) {
            return explicitOrderStatus;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.orderStatus &&
            typeof globalScope.orderStatus.normalizeOrderStatus === "function" &&
            typeof globalScope.orderStatus.validateOrderStatusTransition === "function"
        ) {
            return globalScope.orderStatus;
        }

        if (typeof require === "function") {
            try {
                const requiredOrderStatus = require("./order-status.js");

                if (
                    requiredOrderStatus &&
                    typeof requiredOrderStatus.normalizeOrderStatus === "function" &&
                    typeof requiredOrderStatus.validateOrderStatusTransition === "function"
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
            typeof explicitOrderModel.normalizeOrderRecord === "function" &&
            typeof explicitOrderModel.normalizeOrderItem === "function"
        ) {
            return explicitOrderModel;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.orderModel &&
            typeof globalScope.orderModel.normalizeOrderRecord === "function" &&
            typeof globalScope.orderModel.normalizeOrderItem === "function"
        ) {
            return globalScope.orderModel;
        }

        if (typeof require === "function") {
            try {
                const requiredOrderModel = require("./order-model.js");

                if (
                    requiredOrderModel &&
                    typeof requiredOrderModel.normalizeOrderRecord === "function" &&
                    typeof requiredOrderModel.normalizeOrderItem === "function"
                ) {
                    return requiredOrderModel;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolvePaymentStatus(explicitPaymentStatus) {
        if (
            explicitPaymentStatus &&
            typeof explicitPaymentStatus.getDefaultPaymentStatus === "function" &&
            typeof explicitPaymentStatus.normalizePaymentStatus === "function" &&
            typeof explicitPaymentStatus.isKnownPaymentStatus === "function"
        ) {
            return explicitPaymentStatus;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.paymentStatus &&
            typeof globalScope.paymentStatus.getDefaultPaymentStatus === "function" &&
            typeof globalScope.paymentStatus.normalizePaymentStatus === "function" &&
            typeof globalScope.paymentStatus.isKnownPaymentStatus === "function"
        ) {
            return globalScope.paymentStatus;
        }

        if (typeof require === "function") {
            try {
                const requiredPaymentStatus = require("../payments/payment-status.js");

                if (
                    requiredPaymentStatus &&
                    typeof requiredPaymentStatus.getDefaultPaymentStatus === "function" &&
                    typeof requiredPaymentStatus.normalizePaymentStatus === "function" &&
                    typeof requiredPaymentStatus.isKnownPaymentStatus === "function"
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

    function createValidationResult(errors, details = {}) {
        const safeErrors = errors && typeof errors === "object" ? errors : {};

        return {
            isValid: Object.keys(safeErrors).length === 0,
            errors: safeErrors,
            ...details
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

    function isValidEmail(value) {
        const normalizedValue = normalizeLowerText(value);
        return normalizedValue.includes("@") && normalizedValue.includes(".");
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
        const orderModel = resolveOrderModel(safeOptions.orderModel);
        const value = orderModel
            ? orderModel.createCustomerSnapshot(customerSnapshot)
            : {
                customerUid: normalizeText(customerSnapshot && customerSnapshot.customerUid),
                customerName: normalizeText(customerSnapshot && customerSnapshot.customerName),
                customerEmail: normalizeLowerText(customerSnapshot && customerSnapshot.customerEmail)
            };
        const errors = {};

        if (!value.customerUid) {
            setError(errors, "customerUid", "Customer UID is required.");
        }

        if (!value.customerName) {
            setError(errors, "customerName", "Customer name is required.");
        }

        if (safeOptions.requireEmail !== false) {
            if (!value.customerEmail) {
                setError(errors, "customerEmail", "Customer email is required.");
            } else if (!isValidEmail(value.customerEmail)) {
                setError(errors, "customerEmail", "Customer email must be a valid email address.");
            }
        }

        return createValidationResult(errors, { value });
    }

    function validateVendorSnapshot(vendorSnapshot, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderModel = resolveOrderModel(safeOptions.orderModel);
        const value = orderModel
            ? orderModel.createVendorSnapshot(vendorSnapshot)
            : {
                vendorUid: normalizeText(vendorSnapshot && vendorSnapshot.vendorUid),
                vendorName: normalizeText(vendorSnapshot && vendorSnapshot.vendorName)
            };
        const errors = {};

        if (!value.vendorUid) {
            setError(errors, "vendorUid", "Vendor UID is required.");
        }

        if (!value.vendorName) {
            setError(errors, "vendorName", "Vendor name is required.");
        }

        return createValidationResult(errors, { value });
    }

    function validateOrderItem(item, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeItem = item && typeof item === "object" ? item : {};
        const orderModel = resolveOrderModel(safeOptions.orderModel);
        const value = orderModel
            ? orderModel.normalizeOrderItem(safeItem)
            : {
                menuItemId: normalizeText(safeItem.menuItemId || safeItem.id),
                vendorUid: normalizeText(safeItem.vendorUid),
                vendorName: normalizeText(safeItem.vendorName),
                name: normalizeText(safeItem.name),
                category: normalizeText(safeItem.category),
                price: 0,
                quantity: 1,
                subtotal: 0,
                photoURL: "",
                notes: ""
            };
        const errors = {};
        const rawQuantity = safeItem.quantity !== undefined ? safeItem.quantity : safeItem.qty;
        const rawPrice = getRawItemPrice(safeItem);

        if (!value.menuItemId && !value.name) {
            setError(errors, "menuItemId", "Each order item needs a menu item ID or item name.");
        }

        if (!value.name) {
            setError(errors, "name", "Each order item needs a name.");
        }

        if (rawPrice === undefined || rawPrice === null || normalizeText(String(rawPrice)) === "") {
            setError(errors, "price", "Each order item needs a price.");
        } else if (!Number.isFinite(Number.parseFloat(rawPrice)) || Number.parseFloat(rawPrice) < 0) {
            setError(errors, "price", "Each order item price must be a valid non-negative amount.");
        }

        if (
            rawQuantity !== undefined &&
            (!Number.isFinite(Number.parseInt(rawQuantity, 10)) || Number.parseInt(rawQuantity, 10) <= 0)
        ) {
            setError(errors, "quantity", "Each order item quantity must be at least 1.");
        }

        if (safeOptions.requireVendorDetails === true && !value.vendorUid) {
            setError(errors, "vendorUid", "Each order item needs a vendor UID.");
        }

        return createValidationResult(errors, { value });
    }

    function validateOrderItems(items, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeItems = Array.isArray(items) ? items : [];
        const errors = {};
        const value = [];

        if (!Array.isArray(items) || safeItems.length === 0) {
            setError(errors, "items", "Add at least one order item.");
        }

        safeItems.forEach(function validateOneItem(item, index) {
            const result = validateOrderItem(item, safeOptions);
            value.push(result.value);
            mergeErrors(errors, result.errors, `items.${index}`);
        });

        return createValidationResult(errors, { value });
    }

    function validateOrderTimeline(timeline, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeTimeline = Array.isArray(timeline) ? timeline : [];
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const orderModel = resolveOrderModel(safeOptions.orderModel);
        const errors = {};
        const value = [];

        if (!Array.isArray(timeline) || safeTimeline.length === 0) {
            setError(errors, "timeline", "At least one timeline entry is required.");
        }

        safeTimeline.forEach(function validateOneEntry(entry, index) {
            const safeEntry = entry && typeof entry === "object" ? entry : {};
            const normalizedEntry = orderModel
                ? orderModel.createOrderTimelineEntry(
                    safeEntry.status,
                    safeEntry,
                    orderStatus
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

            if (!orderStatus || !orderStatus.isKnownOrderStatus(safeEntry.status)) {
                setError(errors, `timeline.${index}.status`, "Timeline entries need a valid order status.");
            }

            if (
                !orderStatus ||
                typeof orderStatus.normalizeOrderActorRole !== "function" ||
                !orderStatus.normalizeOrderActorRole(safeEntry.actorRole)
            ) {
                setError(errors, `timeline.${index}.actorRole`, "Timeline entries need a valid actor role.");
            }

            if (normalizedEntry.at === null || normalizedEntry.at === undefined) {
                setError(errors, `timeline.${index}.at`, "Timeline entries need a timestamp.");
            }
        });

        return createValidationResult(errors, { value });
    }

    function validateOrderTotals(orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderModel = resolveOrderModel(safeOptions.orderModel);
        const normalizedRecord = safeOptions.normalizedRecord || (
            orderModel
                ? orderModel.normalizeOrderRecord(orderRecord, { orderStatus: safeOptions.orderStatus })
                : orderRecord
        ) || {};
        const errors = {};
        const expectedSubtotal = orderModel
            ? orderModel.calculateOrderSubtotal(normalizedRecord.items)
            : 0;
        const expectedVendorSubtotal = orderModel &&
            typeof orderModel.calculateOrderVendorSubtotal === "function"
            ? orderModel.calculateOrderVendorSubtotal(normalizedRecord.items)
            : Number(normalizedRecord.vendorSubtotal || normalizedRecord.vendorEarnings || 0);
        const expectedPlatformFee = orderModel &&
            typeof orderModel.calculateOrderPlatformFee === "function"
            ? orderModel.calculateOrderPlatformFee(normalizedRecord.items)
            : Number(normalizedRecord.platformFee || normalizedRecord.platformEarnings || 0);
        const vendorSubtotal = Number(normalizedRecord.vendorSubtotal || 0);
        const vendorEarnings = Number(normalizedRecord.vendorEarnings || vendorSubtotal);
        const platformFee = Number(normalizedRecord.platformFee || 0);
        const platformEarnings = Number(normalizedRecord.platformEarnings || platformFee);
        const customerTotal = Number(
            normalizedRecord.customerTotal !== undefined
                ? normalizedRecord.customerTotal
                : normalizedRecord.total
        );

        if (normalizedRecord.subtotal !== expectedSubtotal) {
            setError(
                errors,
                "subtotal",
                `Order subtotal must match the sum of its items (${expectedSubtotal}).`
            );
        }

        if (Number(normalizedRecord.total) < Number(normalizedRecord.subtotal)) {
            setError(errors, "total", "Order total cannot be less than subtotal.");
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

        if (customerTotal !== Number(normalizedRecord.total)) {
            setError(errors, "customerTotal", "Customer total must match the order total.");
        }

        if (
            Number(normalizedRecord.total) === expectedSubtotal &&
            Number((vendorSubtotal + platformFee).toFixed(2)) !== customerTotal
        ) {
            setError(errors, "financeTotal", "Vendor subtotal plus platform fee must match the customer total.");
        }

        return createValidationResult(errors, {
            value: {
                subtotal: normalizedRecord.subtotal,
                total: normalizedRecord.total,
                expectedSubtotal,
                vendorSubtotal,
                vendorEarnings,
                platformFee,
                platformEarnings,
                customerTotal,
                expectedVendorSubtotal,
                expectedPlatformFee
            }
        });
    }

    function validateOrderPaymentFields(orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeRecord = safeOptions.rawOrderRecord && typeof safeOptions.rawOrderRecord === "object"
            ? safeOptions.rawOrderRecord
            : (orderRecord && typeof orderRecord === "object" ? orderRecord : {});
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const paymentStatus = resolvePaymentStatus(safeOptions.paymentStatus);
        const orderModel = resolveOrderModel(safeOptions.orderModel);
        const value = safeOptions.normalizedRecord || (
            orderModel
                ? orderModel.normalizeOrderRecord(safeRecord, { orderStatus, paymentStatus })
                : safeRecord
        );
        const errors = {};
        const rawPaymentStatus = safeRecord.paymentStatus !== undefined
            ? safeRecord.paymentStatus
            : value.paymentStatus;
        const hasRawPaymentStatus = rawPaymentStatus !== undefined &&
            rawPaymentStatus !== null &&
            normalizeText(String(rawPaymentStatus)) !== "";
        const normalizedPaymentStatus = paymentStatus
            ? paymentStatus.normalizePaymentStatus(hasRawPaymentStatus ? rawPaymentStatus : value.paymentStatus)
            : normalizeLowerText(value.paymentStatus);
        const allowedProviders = Array.isArray(safeOptions.allowedPaymentProviders) &&
            safeOptions.allowedPaymentProviders.length > 0
            ? safeOptions.allowedPaymentProviders.map(normalizeLowerText).filter(Boolean)
            : ["paystack"];
        const allowedCurrencies = Array.isArray(safeOptions.allowedPaymentCurrencies) &&
            safeOptions.allowedPaymentCurrencies.length > 0
            ? safeOptions.allowedPaymentCurrencies.map(normalizeUpperText).filter(Boolean)
            : ["ZAR"];
        const provider = normalizeLowerText(value.paymentProvider);
        const currency = normalizeUpperText(value.paymentCurrency);
        const paymentAmount = Number(value.paymentAmount);
        const total = Number(value.total);
        const paymentAmountInMinorUnits = Number.parseInt(value.paymentAmountInMinorUnits, 10);
        const expectedAmountInMinorUnits = Number.isFinite(paymentAmount)
            ? Math.round(paymentAmount * 100)
            : 0;

        if (
            !normalizedPaymentStatus ||
            (
                hasRawPaymentStatus &&
                paymentStatus &&
                !paymentStatus.isKnownPaymentStatus(rawPaymentStatus)
            )
        ) {
            setError(errors, "paymentStatus", "Payment status must be valid.");
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

        if (!Number.isFinite(paymentAmount) || paymentAmount < 0) {
            setError(errors, "paymentAmount", "Payment amount must be a valid non-negative amount.");
        } else if (Number.isFinite(total) && paymentAmount !== total) {
            setError(errors, "paymentAmount", "Payment amount must match the order total.");
        }

        if (!Number.isFinite(paymentAmountInMinorUnits) || paymentAmountInMinorUnits < 0) {
            setError(errors, "paymentAmountInMinorUnits", "Payment amount in minor units must be valid.");
        } else if (paymentAmountInMinorUnits !== expectedAmountInMinorUnits) {
            setError(
                errors,
                "paymentAmountInMinorUnits",
                "Payment amount in minor units must match the payment amount."
            );
        }

        if (
            (normalizedPaymentStatus === "pending" || normalizedPaymentStatus === "paid") &&
            !normalizeText(value.paymentReference)
        ) {
            setError(errors, "paymentReference", "Payment reference is required once payment has started.");
        }

        if (normalizedPaymentStatus === "paid" && !value.paymentVerifiedAt) {
            setError(errors, "paymentVerifiedAt", "Paid orders must include a payment verification timestamp.");
        }

        return createValidationResult(errors, {
            value: {
                paymentStatus: normalizedPaymentStatus,
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

    function validateOrderRecord(orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeRecord = orderRecord && typeof orderRecord === "object" ? orderRecord : {};
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const paymentStatus = resolvePaymentStatus(safeOptions.paymentStatus);
        const orderModel = resolveOrderModel(safeOptions.orderModel);
        const value = orderModel
            ? orderModel.normalizeOrderRecord(safeRecord, { orderStatus, paymentStatus })
            : safeRecord;
        const errors = {};
        const customerValidation = validateCustomerSnapshot(value, {
            orderModel,
            requireEmail: safeOptions.requireEmail !== false
        });
        const vendorValidation = validateVendorSnapshot(value, { orderModel });
        const itemsValidation = validateOrderItems(safeRecord.items, {
            orderModel,
            requireVendorDetails: false
        });
        const timelineValidation = validateOrderTimeline(
            Array.isArray(safeRecord.timeline) ? safeRecord.timeline : value.timeline,
            {
            orderModel,
            orderStatus
            }
        );
        const totalsValidation = validateOrderTotals(value, {
            orderModel,
            orderStatus,
            normalizedRecord: value
        });
        const paymentValidation = validateOrderPaymentFields(value, {
            orderModel,
            orderStatus,
            paymentStatus,
            normalizedRecord: value,
            rawOrderRecord: safeRecord,
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
            if (!orderStatus || !orderStatus.normalizeOrderStatus(safeRecord.status)) {
                setError(errors, "status", "Order status must be valid.");
            }
        }

        value.items.forEach(function validateItemVendorAlignment(item, index) {
            if (item.vendorUid && value.vendorUid && item.vendorUid !== value.vendorUid) {
                setError(
                    errors,
                    `items.${index}.vendorUid`,
                    "Each item in an order must belong to the same vendor as the order."
                );
            }
        });

        if (!value.createdAt) {
            setError(errors, "createdAt", "Order createdAt is required.");
        }

        if (!value.updatedAt) {
            setError(errors, "updatedAt", "Order updatedAt is required.");
        }

        if (
            value.status === "completed" &&
            (!value.customerConfirmedCollected || !value.vendorConfirmedCollected)
        ) {
            setError(
                errors,
                "completedCollection",
                "Completed orders must be confirmed by both the customer and vendor."
            );
        }

        return createValidationResult(errors, { value });
    }

    function validateCreateOrderInput(orderInput, options = {}) {
        return validateOrderRecord(orderInput, options);
    }

    function validateOrderStatusChange(currentStatus, nextStatus, actorRole, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);

        if (!orderStatus) {
            return createValidationResult({
                status: "Order status helpers are unavailable."
            }, {
                transition: null
            });
        }

        const transition = orderStatus.validateOrderStatusTransition(
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

    const orderValidation = {
        MODULE_NAME,
        resolveOrderStatus,
        resolveOrderModel,
        resolvePaymentStatus,
        normalizeText,
        normalizeLowerText,
        normalizeUpperText,
        createValidationResult,
        setError,
        mergeErrors,
        isValidEmail,
        hasOwnField,
        getRawItemPrice,
        validateCustomerSnapshot,
        validateVendorSnapshot,
        validateOrderItem,
        validateOrderItems,
        validateOrderTimeline,
        validateOrderTotals,
        validateOrderPaymentFields,
        validateOrderRecord,
        validateCreateOrderInput,
        validateOrderStatusChange
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = orderValidation;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.orderValidation = orderValidation;
    }
})(typeof window !== "undefined" ? window : globalThis);
