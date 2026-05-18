(function attachCheckoutModel(globalScope) {
    "use strict";

    const MODULE_NAME = "checkout-model";
    const DEFAULT_PROVIDER = "paystack";
    const DEFAULT_CURRENCY = "ZAR";

    function resolveCheckoutStatus(explicitCheckoutStatus) {
        if (
            explicitCheckoutStatus &&
            typeof explicitCheckoutStatus.getDefaultCheckoutStatus === "function" &&
            typeof explicitCheckoutStatus.normalizeCheckoutStatus === "function"
        ) {
            return explicitCheckoutStatus;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.checkoutStatus &&
            typeof globalScope.checkoutStatus.getDefaultCheckoutStatus === "function" &&
            typeof globalScope.checkoutStatus.normalizeCheckoutStatus === "function"
        ) {
            return globalScope.checkoutStatus;
        }

        if (typeof require === "function") {
            try {
                const requiredCheckoutStatus = require("./checkout-status.js");

                if (
                    requiredCheckoutStatus &&
                    typeof requiredCheckoutStatus.getDefaultCheckoutStatus === "function" &&
                    typeof requiredCheckoutStatus.normalizeCheckoutStatus === "function"
                ) {
                    return requiredCheckoutStatus;
                }
            /* istanbul ignore next */
            } catch (error) {
                /* istanbul ignore next */
                return null;
            }
        }

        /* istanbul ignore next */
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

    function normalizePositiveInteger(value, fallbackValue) {
        const parsed = Number.parseInt(value, 10);
        const fallbackParsed = Number.parseInt(fallbackValue, 10);

        if (Number.isFinite(parsed) && parsed > 0) {
            return Math.floor(parsed);
        }

        if (Number.isFinite(fallbackParsed) && fallbackParsed > 0) {
            return Math.floor(fallbackParsed);
        }

        return 1;
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

    function normalizeTimestampValue(value, fallbackValue) {
        if (value !== undefined && value !== null) {
            return value;
        }

        if (fallbackValue !== undefined) {
            return fallbackValue;
        }

        return null;
    }

    function normalizeProvider(value, fallbackValue) {
        return normalizeLowerText(value || fallbackValue) || DEFAULT_PROVIDER;
    }

    function normalizeCurrency(value, fallbackValue) {
        return normalizeUpperText(value || fallbackValue) || DEFAULT_CURRENCY;
    }

    function normalizeMetadata(metadata) {
        if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
            return {};
        }

        return { ...metadata };
    }

    function createCustomerSnapshot(customerValues = {}) {
        const safeCustomer = customerValues && typeof customerValues === "object" ? customerValues : {};

        return {
            customerUid: normalizeText(safeCustomer.customerUid || safeCustomer.uid || safeCustomer.userUid),
            customerName: normalizeText(
                safeCustomer.customerName ||
                safeCustomer.displayName ||
                safeCustomer.name
            ) || "Customer",
            customerEmail: normalizeLowerText(safeCustomer.customerEmail || safeCustomer.email)
        };
    }

    function createVendorSnapshot(vendorValues = {}) {
        const safeVendor = vendorValues && typeof vendorValues === "object" ? vendorValues : {};

        return {
            vendorUid: normalizeText(safeVendor.vendorUid || safeVendor.uid || safeVendor.userUid),
            vendorName: normalizeText(
                safeVendor.vendorName ||
                safeVendor.shopName ||
                safeVendor.displayName ||
                safeVendor.name
            ) || "Unknown Vendor"
        };
    }

    function normalizeCheckoutItem(itemValues = {}, fallbackIndex = 0) {
        const safeItem = itemValues && typeof itemValues === "object" ? itemValues : {};
        const menuItemId = normalizeText(
            safeItem.menuItemId ||
            safeItem.productId ||
            safeItem.itemId ||
            safeItem.id
        ) || `item-${fallbackIndex + 1}`;
        const vendorUid = normalizeText(safeItem.vendorUid);
        const price = normalizeCurrencyAmount(safeItem.price, safeItem.unitPrice);
        const quantity = normalizePositiveInteger(safeItem.quantity, 1);

        return {
            menuItemId,
            vendorUid,
            vendorName: normalizeText(safeItem.vendorName) || "Unknown Vendor",
            name: normalizeText(safeItem.name || safeItem.itemName) || "Unknown Item",
            category: normalizeText(safeItem.category) || "Other",
            price,
            quantity,
            lineTotal: normalizeCurrencyAmount(price * quantity),
            photoURL: normalizeText(safeItem.photoURL || safeItem.imageUrl || safeItem.imageURL),
            notes: normalizeText(safeItem.notes || safeItem.note),
            itemKey: `${vendorUid || "vendor"}::${menuItemId}`
        };
    }

    function normalizeCheckoutItems(items) {
        if (!Array.isArray(items)) {
            return [];
        }

        return items.map(function normalizeOneItem(item, index) {
            return normalizeCheckoutItem(item, index);
        });
    }

    function calculateCheckoutItemCount(items) {
        return normalizeCheckoutItems(items).reduce(function sumQuantity(total, item) {
            return total + item.quantity;
        }, 0);
    }

    function calculateCheckoutSubtotal(items) {
        return normalizeCurrencyAmount(
            normalizeCheckoutItems(items).reduce(function sumSubtotal(total, item) {
                return total + item.lineTotal;
            }, 0)
        );
    }

    function createCheckoutTimelineEntry(status, options = {}, explicitCheckoutStatus) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const checkoutStatus = resolveCheckoutStatus(explicitCheckoutStatus);
        const fallbackStatus = checkoutStatus
            ? checkoutStatus.getDefaultCheckoutStatus()
            : "draft";
        const normalizedStatus = checkoutStatus
            ? checkoutStatus.normalizeCheckoutStatus(status, fallbackStatus)
            : normalizeLowerText(status) || fallbackStatus;
        const label =
            checkoutStatus && typeof checkoutStatus.getCheckoutStatusLabel === "function"
                ? checkoutStatus.getCheckoutStatusLabel(normalizedStatus)
                : normalizeText(status) || "Checkout Draft";

        return {
            status: normalizedStatus || fallbackStatus,
            label,
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

    function createCheckoutSessionRecord(sessionValues = {}, options = {}) {
        const safeValues = sessionValues && typeof sessionValues === "object" ? sessionValues : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const checkoutStatus = resolveCheckoutStatus(safeOptions.checkoutStatus);
        const defaultStatus = checkoutStatus
            ? checkoutStatus.getDefaultCheckoutStatus()
            : "draft";
        const normalizedStatus = checkoutStatus
            ? checkoutStatus.normalizeCheckoutStatus(safeValues.status || safeValues.checkoutStatus, defaultStatus)
            : normalizeLowerText(safeValues.status || safeValues.checkoutStatus) || defaultStatus;
        const customer = createCustomerSnapshot(safeValues.customer || safeValues);
        const vendor = createVendorSnapshot(safeValues.vendor || safeValues);
        const items = normalizeCheckoutItems(safeValues.items || safeValues.cartItems);
        const subtotal = safeValues.subtotal !== undefined
            ? normalizeCurrencyAmount(safeValues.subtotal, calculateCheckoutSubtotal(items))
            : calculateCheckoutSubtotal(items);
        const total = safeValues.total !== undefined
            ? normalizeCurrencyAmount(safeValues.total, subtotal)
            : subtotal;
        const paymentAmount = safeValues.paymentAmount !== undefined
            ? normalizeCurrencyAmount(safeValues.paymentAmount, total)
            : total;
        const paymentAmountInMinorUnits =
            safeValues.paymentAmountInMinorUnits !== undefined ||
            safeValues.paymentAmountMinor !== undefined
                ? normalizeAmountInMinorUnits(
                    safeValues.paymentAmountInMinorUnits,
                    safeValues.paymentAmountMinor
                )
                : amountToMinorUnits(paymentAmount);
        const createdAt = normalizeTimestampValue(safeValues.createdAt, safeOptions.createdAt || null);
        const updatedAt = normalizeTimestampValue(safeValues.updatedAt, createdAt);
        const providedTimeline = Array.isArray(safeValues.timeline) ? safeValues.timeline : [];
        const timeline = providedTimeline.length > 0
            ? providedTimeline.map(function normalizeTimelineEntry(entry) {
                const safeEntry = entry && typeof entry === "object" ? entry : {};

                return createCheckoutTimelineEntry(
                    safeEntry.status || normalizedStatus,
                    {
                        actorRole: safeEntry.actorRole,
                        actorUid: safeEntry.actorUid,
                        actorName: safeEntry.actorName,
                        note: safeEntry.note,
                        at: normalizeTimestampValue(safeEntry.at, safeEntry.timestamp)
                    },
                    checkoutStatus
                );
            })
            : [
                createCheckoutTimelineEntry(
                    normalizedStatus,
                    {
                        actorRole: safeValues.createdByRole || safeOptions.createdByRole || "customer",
                        actorUid: safeValues.createdByUid || customer.customerUid,
                        actorName: safeValues.createdByName || customer.customerName,
                        note: safeValues.statusNote || safeValues.note || "",
                        at: createdAt
                    },
                    checkoutStatus
                )
            ];

        return {
            checkoutId: normalizeText(safeValues.checkoutId || safeValues.sessionId || safeValues.id),
            customerUid: customer.customerUid,
            customerName: customer.customerName,
            customerEmail: customer.customerEmail,
            vendorUid: vendor.vendorUid,
            vendorName: vendor.vendorName,
            items,
            itemCount: calculateCheckoutItemCount(items),
            subtotal,
            total,
            status: normalizedStatus || defaultStatus,
            paymentProvider: normalizeProvider(safeValues.paymentProvider || safeValues.provider),
            paymentReference: normalizeText(
                safeValues.paymentReference ||
                safeValues.reference ||
                safeValues.paystackReference
            ),
            paymentAccessCode: normalizeText(
                safeValues.paymentAccessCode ||
                safeValues.accessCode ||
                safeValues.paystackAccessCode
            ),
            paymentAuthorizationUrl: normalizeText(
                safeValues.paymentAuthorizationUrl ||
                safeValues.authorizationUrl ||
                safeValues.authorizationURL ||
                safeValues.paymentUrl ||
                safeValues.paymentURL
            ),
            paymentAmount,
            paymentAmountInMinorUnits,
            paymentCurrency: normalizeCurrency(safeValues.paymentCurrency || safeValues.currency),
            paymentPaidAt: normalizeTimestampValue(safeValues.paymentPaidAt, safeValues.paidAt),
            paymentFailedAt: normalizeTimestampValue(safeValues.paymentFailedAt, safeValues.failedAt),
            paymentVerifiedAt: normalizeTimestampValue(safeValues.paymentVerifiedAt, safeValues.verifiedAt),
            paymentFailureReason: normalizeText(
                safeValues.paymentFailureReason ||
                safeValues.failureReason ||
                safeValues.paymentErrorMessage
            ),
            convertedOrderId: normalizeText(
                safeValues.convertedOrderId ||
                safeValues.orderId ||
                safeValues.createdOrderId
            ),
            convertedAt: normalizeTimestampValue(safeValues.convertedAt, null),
            cancelledAt: normalizeTimestampValue(safeValues.cancelledAt, safeValues.canceledAt),
            expiredAt: normalizeTimestampValue(safeValues.expiredAt, null),
            metadata: normalizeMetadata(safeValues.metadata),
            timeline,
            notes: normalizeText(safeValues.notes || safeValues.note),
            createdAt,
            updatedAt
        };
    }

    function normalizeCheckoutSessionRecord(sessionValues = {}, options = {}) {
        return createCheckoutSessionRecord(sessionValues, options);
    }

    function createCheckoutSessionFromCart(cartItems, customer, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const normalizedItems = normalizeCheckoutItems(cartItems);
        const requestedVendorUid = normalizeText(safeOptions.vendorUid);
        const vendorUid = requestedVendorUid ||
            normalizeText(normalizedItems[0] && normalizedItems[0].vendorUid);
        const vendorItems = vendorUid
            ? normalizedItems.filter(function matchVendor(item) {
                return item.vendorUid === vendorUid;
            })
            : normalizedItems;
        const vendorName =
            normalizeText(safeOptions.vendorName) ||
            normalizeText(vendorItems[0] && vendorItems[0].vendorName) ||
            "Unknown Vendor";

        return createCheckoutSessionRecord(
            {
                ...safeOptions,
                customer,
                vendor: {
                    vendorUid,
                    vendorName
                },
                items: vendorItems,
                createdByUid: safeOptions.createdByUid || (customer && customer.customerUid) || (customer && customer.uid),
                createdByName: safeOptions.createdByName || (customer && customer.customerName) || (customer && customer.displayName)
            },
            safeOptions
        );
    }

    function createCheckoutPaymentPatch(sessionValues = {}) {
        const session = createCheckoutSessionRecord(sessionValues);

        return {
            status: session.status,
            paymentProvider: session.paymentProvider,
            paymentReference: session.paymentReference,
            paymentAccessCode: session.paymentAccessCode,
            paymentAuthorizationUrl: session.paymentAuthorizationUrl,
            paymentAmount: session.paymentAmount,
            paymentAmountInMinorUnits: session.paymentAmountInMinorUnits,
            paymentCurrency: session.paymentCurrency,
            paymentPaidAt: session.paymentPaidAt,
            paymentFailedAt: session.paymentFailedAt,
            paymentVerifiedAt: session.paymentVerifiedAt,
            paymentFailureReason: session.paymentFailureReason,
            updatedAt: session.updatedAt
        };
    }

    function createOrderDraftFromCheckout(sessionValues = {}, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const session = createCheckoutSessionRecord(sessionValues, safeOptions);

        return {
            orderId: normalizeText(safeOptions.orderId || session.convertedOrderId),
            checkoutId: session.checkoutId,
            customerUid: session.customerUid,
            customerName: session.customerName,
            customerEmail: session.customerEmail,
            vendorUid: session.vendorUid,
            vendorName: session.vendorName,
            items: session.items,
            itemCount: session.itemCount,
            subtotal: session.subtotal,
            total: session.total,
            totalAmount: session.total,
            status: normalizeText(safeOptions.status) || "pending",
            paymentStatus: "paid",
            paymentProvider: session.paymentProvider,
            paymentReference: session.paymentReference,
            paymentAccessCode: session.paymentAccessCode,
            paymentAuthorizationUrl: session.paymentAuthorizationUrl,
            paymentAmount: session.paymentAmount,
            paymentAmountInMinorUnits: session.paymentAmountInMinorUnits,
            paymentCurrency: session.paymentCurrency,
            paymentPaidAt: session.paymentPaidAt,
            paymentFailedAt: session.paymentFailedAt,
            paymentVerifiedAt: session.paymentVerifiedAt,
            paymentFailureReason: session.paymentFailureReason,
            notes: session.notes,
            createdAt: safeOptions.createdAt !== undefined ? safeOptions.createdAt : session.createdAt,
            updatedAt: safeOptions.updatedAt !== undefined ? safeOptions.updatedAt : session.updatedAt
        };
    }

    const checkoutModel = {
        MODULE_NAME,
        DEFAULT_PROVIDER,
        DEFAULT_CURRENCY,
        resolveCheckoutStatus,
        normalizeText,
        normalizeLowerText,
        normalizeUpperText,
        normalizeCurrencyAmount,
        normalizePositiveInteger,
        normalizeAmountInMinorUnits,
        amountToMinorUnits,
        normalizeTimestampValue,
        normalizeProvider,
        normalizeCurrency,
        normalizeMetadata,
        createCustomerSnapshot,
        createVendorSnapshot,
        normalizeCheckoutItem,
        normalizeCheckoutItems,
        calculateCheckoutItemCount,
        calculateCheckoutSubtotal,
        createCheckoutTimelineEntry,
        createCheckoutSessionRecord,
        normalizeCheckoutSessionRecord,
        createCheckoutSessionFromCart,
        createCheckoutPaymentPatch,
        createOrderDraftFromCheckout
    };

    /* istanbul ignore else */
    if (typeof module !== "undefined" && module.exports) {
        module.exports = checkoutModel;
    }

    /* istanbul ignore else */
    if (typeof globalScope !== "undefined") {
        globalScope.checkoutModel = checkoutModel;
    }
/* istanbul ignore next */
})(typeof window !== "undefined" ? window : globalThis);
