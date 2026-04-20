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

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
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

        if (!value.menuItemId && !value.name) {
            setError(errors, "menuItemId", "Each order item needs a menu item ID or item name.");
        }

        if (!value.name) {
            setError(errors, "name", "Each order item needs a name.");
        }

        if (safeItem.price === undefined && safeItem.unitPrice === undefined) {
            setError(errors, "price", "Each order item needs a price.");
        }

        if (rawQuantity !== undefined && Number.parseInt(rawQuantity, 10) <= 0) {
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

        return createValidationResult(errors, {
            value: {
                subtotal: normalizedRecord.subtotal,
                total: normalizedRecord.total,
                expectedSubtotal
            }
        });
    }

    function validateOrderRecord(orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeRecord = orderRecord && typeof orderRecord === "object" ? orderRecord : {};
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const orderModel = resolveOrderModel(safeOptions.orderModel);
        const value = orderModel
            ? orderModel.normalizeOrderRecord(safeRecord, { orderStatus })
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

        mergeErrors(errors, customerValidation.errors);
        mergeErrors(errors, vendorValidation.errors);
        mergeErrors(errors, itemsValidation.errors);
        mergeErrors(errors, timelineValidation.errors);
        mergeErrors(errors, totalsValidation.errors);

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
        normalizeText,
        normalizeLowerText,
        createValidationResult,
        setError,
        mergeErrors,
        isValidEmail,
        validateCustomerSnapshot,
        validateVendorSnapshot,
        validateOrderItem,
        validateOrderItems,
        validateOrderTimeline,
        validateOrderTotals,
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
