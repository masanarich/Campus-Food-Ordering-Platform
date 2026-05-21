(function attachOrderModel(globalScope) {
    "use strict";

    const MODULE_NAME = "order-model";
    const DEFAULT_PLATFORM_FEE_RATE = 0.1;
    const FINANCE_MODEL = "vendor-price-plus-platform-fee";

    function resolveOrderStatus(explicitOrderStatus) {
        if (
            explicitOrderStatus &&
            typeof explicitOrderStatus.getDefaultOrderStatus === "function" &&
            typeof explicitOrderStatus.normalizeOrderStatus === "function"
        ) {
            return explicitOrderStatus;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.orderStatus &&
            typeof globalScope.orderStatus.getDefaultOrderStatus === "function" &&
            typeof globalScope.orderStatus.normalizeOrderStatus === "function"
        ) {
            return globalScope.orderStatus;
        }

        if (typeof require === "function") {
            try {
                const requiredOrderStatus = require("./order-status.js");

                if (
                    requiredOrderStatus &&
                    typeof requiredOrderStatus.getDefaultOrderStatus === "function" &&
                    typeof requiredOrderStatus.normalizeOrderStatus === "function"
                ) {
                    return requiredOrderStatus;
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
                const requiredPaymentStatus = require("../payments/payment-status.js");

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

    function normalizeCurrencyAmount(value, fallbackValue) {
        const parsed = Number.parseFloat(value);

        if (Number.isFinite(parsed)) {
            return Math.max(0, Number(parsed.toFixed(2)));
        }

        if (Number.isFinite(fallbackValue)) {
            return Math.max(0, Number(Number(fallbackValue).toFixed(2)));
        }

        return 0;
    }

    function normalizePlatformFeeRate(value, fallbackValue) {
        const parsed = Number.parseFloat(value);
        const fallbackParsed = Number.parseFloat(fallbackValue);

        if (Number.isFinite(parsed) && parsed >= 0) {
            return parsed > 1 ? Number((parsed / 100).toFixed(4)) : Number(parsed.toFixed(4));
        }

        if (Number.isFinite(fallbackParsed) && fallbackParsed >= 0) {
            return fallbackParsed > 1
                ? Number((fallbackParsed / 100).toFixed(4))
                : Number(fallbackParsed.toFixed(4));
        }

        return DEFAULT_PLATFORM_FEE_RATE;
    }

    function normalizePositiveInteger(value, fallbackValue) {
        const parsed = Number.parseInt(value, 10);
        const fallbackParsed = Number.parseInt(fallbackValue, 10);

        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
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

        if (fallbackValue !== undefined) {
            return fallbackValue;
        }

        return null;
    }

    function hasOwnField(source, fieldName) {
        return source && Object.prototype.hasOwnProperty.call(source, fieldName);
    }

    function getCustomerFacingPrice(item) {
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

        return undefined;
    }

    function calculateOrderItemPricing(itemValues = {}, options = {}) {
        const safeItem = itemValues && typeof itemValues === "object" ? itemValues : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const platformFeeRate = normalizePlatformFeeRate(
            safeItem.platformFeeRate !== undefined
                ? safeItem.platformFeeRate
                : safeOptions.platformFeeRate,
            DEFAULT_PLATFORM_FEE_RATE
        );
        const hasVendorPrice = hasOwnField(safeItem, "vendorPrice") || hasOwnField(safeItem, "basePrice");
        const hasPlatformFee = hasOwnField(safeItem, "platformFee");
        const rawCustomerPrice = getCustomerFacingPrice(safeItem);
        const hasCustomerPrice = rawCustomerPrice !== undefined && rawCustomerPrice !== null;
        let vendorPrice;

        if (hasOwnField(safeItem, "vendorPrice")) {
            vendorPrice = normalizeCurrencyAmount(safeItem.vendorPrice);
        } else if (hasOwnField(safeItem, "basePrice")) {
            vendorPrice = normalizeCurrencyAmount(safeItem.basePrice);
        } else if (hasCustomerPrice && hasPlatformFee) {
            vendorPrice = normalizeCurrencyAmount(
                normalizeCurrencyAmount(rawCustomerPrice) - normalizeCurrencyAmount(safeItem.platformFee)
            );
        } else if (hasCustomerPrice) {
            vendorPrice = normalizeCurrencyAmount(normalizeCurrencyAmount(rawCustomerPrice) / (1 + platformFeeRate));
        } else {
            vendorPrice = 0;
        }

        const platformFee = hasPlatformFee
            ? normalizeCurrencyAmount(safeItem.platformFee)
            : hasCustomerPrice
                ? normalizeCurrencyAmount(normalizeCurrencyAmount(rawCustomerPrice) - vendorPrice)
                : hasVendorPrice
                    ? normalizeCurrencyAmount(vendorPrice * platformFeeRate)
                    : 0;
        const customerPrice = hasCustomerPrice
            ? normalizeCurrencyAmount(rawCustomerPrice)
            : normalizeCurrencyAmount(vendorPrice + platformFee);

        return {
            vendorPrice,
            basePrice: vendorPrice,
            platformFeeRate,
            platformFee,
            customerPrice,
            price: customerPrice
        };
    }

    function amountToMinorUnits(amount) {
        return Math.round(normalizeCurrencyAmount(amount) * 100);
    }

    function normalizePaymentProvider(value, fallbackValue) {
        return normalizeLowerText(value || fallbackValue) || "paystack";
    }

    function normalizePaymentCurrency(value, fallbackValue) {
        return normalizeUpperText(value || fallbackValue) || "ZAR";
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
            ),
            customerEmail: normalizeLowerText(
                safeCustomer.customerEmail ||
                safeCustomer.email
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

    function normalizeOrderItem(item) {
        const safeItem = item && typeof item === "object" ? item : {};
        const pricing = calculateOrderItemPricing(safeItem);
        const quantity = normalizePositiveInteger(safeItem.quantity, safeItem.qty);
        const vendorSubtotal = normalizeCurrencyAmount(pricing.vendorPrice * quantity);
        const platformFeeTotal = normalizeCurrencyAmount(pricing.platformFee * quantity);
        const lineTotal = normalizeCurrencyAmount(pricing.price * quantity);

        return {
            menuItemId: normalizeText(
                safeItem.menuItemId ||
                safeItem.id ||
                safeItem.productId
            ),
            vendorUid: normalizeText(safeItem.vendorUid),
            vendorName: normalizeText(
                safeItem.vendorName ||
                safeItem.businessName ||
                safeItem.shopName
            ),
            name: normalizeText(
                safeItem.name ||
                safeItem.title ||
                safeItem.itemName
            ),
            category: normalizeText(safeItem.category),
            vendorPrice: pricing.vendorPrice,
            basePrice: pricing.basePrice,
            platformFeeRate: pricing.platformFeeRate,
            platformFee: pricing.platformFee,
            customerPrice: pricing.customerPrice,
            price: pricing.price,
            quantity,
            vendorSubtotal,
            lineVendorSubtotal: vendorSubtotal,
            platformFeeTotal,
            linePlatformFee: platformFeeTotal,
            subtotal: lineTotal,
            lineTotal,
            lineCustomerTotal: lineTotal,
            photoURL: normalizeText(
                safeItem.photoURL ||
                safeItem.imageUrl ||
                safeItem.photoUrl
            ),
            notes: normalizeText(
                safeItem.notes ||
                safeItem.note ||
                safeItem.specialInstructions
            )
        };
    }

    function normalizeOrderItems(items) {
        const safeItems = Array.isArray(items) ? items : [];

        return safeItems
            .map(function normalizeItem(item) {
                return normalizeOrderItem(item);
            })
            .filter(function keepItem(item) {
                return item.menuItemId !== "" || item.name !== "";
            });
    }

    function calculateOrderItemCount(items) {
        return normalizeOrderItems(items).reduce(function countItems(total, item) {
            return total + item.quantity;
        }, 0);
    }

    function calculateOrderSubtotal(items) {
        return Number(
            normalizeOrderItems(items)
                .reduce(function sumSubtotal(total, item) {
                    return total + item.subtotal;
                }, 0)
                .toFixed(2)
        );
    }

    function calculateOrderVendorSubtotal(items) {
        return normalizeCurrencyAmount(
            normalizeOrderItems(items).reduce(function sumVendorSubtotal(total, item) {
                return total + item.vendorSubtotal;
            }, 0)
        );
    }

    function calculateOrderPlatformFee(items) {
        return normalizeCurrencyAmount(
            normalizeOrderItems(items).reduce(function sumPlatformFee(total, item) {
                return total + item.platformFeeTotal;
            }, 0)
        );
    }

    function groupOrderItemsByVendor(items) {
        const groupsByVendor = {};

        normalizeOrderItems(items).forEach(function addItemToGroup(item) {
            const vendorUid = normalizeText(item.vendorUid);

            if (!vendorUid) {
                return;
            }

            if (!groupsByVendor[vendorUid]) {
                groupsByVendor[vendorUid] = {
                    vendorUid,
                    vendorName: normalizeText(item.vendorName),
                    items: [],
                    itemCount: 0,
                    subtotal: 0,
                    total: 0,
                    vendorSubtotal: 0,
                    vendorEarnings: 0,
                    platformFee: 0,
                    platformEarnings: 0,
                    customerTotal: 0
                };
            }

            groupsByVendor[vendorUid].items.push(item);
            groupsByVendor[vendorUid].itemCount += item.quantity;
            groupsByVendor[vendorUid].subtotal = Number(
                (groupsByVendor[vendorUid].subtotal + item.subtotal).toFixed(2)
            );
            groupsByVendor[vendorUid].total = groupsByVendor[vendorUid].subtotal;
            groupsByVendor[vendorUid].vendorSubtotal = normalizeCurrencyAmount(
                groupsByVendor[vendorUid].vendorSubtotal + item.vendorSubtotal
            );
            groupsByVendor[vendorUid].vendorEarnings = groupsByVendor[vendorUid].vendorSubtotal;
            groupsByVendor[vendorUid].platformFee = normalizeCurrencyAmount(
                groupsByVendor[vendorUid].platformFee + item.platformFeeTotal
            );
            groupsByVendor[vendorUid].platformEarnings = groupsByVendor[vendorUid].platformFee;
            groupsByVendor[vendorUid].customerTotal = groupsByVendor[vendorUid].total;

            if (!groupsByVendor[vendorUid].vendorName && item.vendorName) {
                groupsByVendor[vendorUid].vendorName = item.vendorName;
            }
        });

        return Object.keys(groupsByVendor).map(function mapGroup(vendorUid) {
            return {
                vendorUid: vendorUid,
                vendorName: groupsByVendor[vendorUid].vendorName,
                items: groupsByVendor[vendorUid].items.slice(),
                itemCount: groupsByVendor[vendorUid].itemCount,
                subtotal: groupsByVendor[vendorUid].subtotal,
                total: groupsByVendor[vendorUid].total,
                vendorSubtotal: groupsByVendor[vendorUid].vendorSubtotal,
                vendorEarnings: groupsByVendor[vendorUid].vendorEarnings,
                platformFee: groupsByVendor[vendorUid].platformFee,
                platformEarnings: groupsByVendor[vendorUid].platformEarnings,
                customerTotal: groupsByVendor[vendorUid].customerTotal
            };
        });
    }

    function createOrderTimelineEntry(status, options = {}, explicitOrderStatus) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderStatus = resolveOrderStatus(explicitOrderStatus);
        const fallbackStatus = orderStatus ? orderStatus.getDefaultOrderStatus() : "pending";
        const normalizedStatus = orderStatus
            ? orderStatus.normalizeOrderStatus(status, fallbackStatus)
            : normalizeLowerText(status) || fallbackStatus;
        const normalizedActorRole = orderStatus && typeof orderStatus.normalizeOrderActorRole === "function"
            ? orderStatus.normalizeOrderActorRole(safeOptions.actorRole || safeOptions.role || "system") || "system"
            : normalizeLowerText(safeOptions.actorRole || safeOptions.role) || "system";
        const label = orderStatus && typeof orderStatus.getOrderStatusLabel === "function"
            ? orderStatus.getOrderStatusLabel(normalizedStatus)
            : normalizeText(status) || "Order Received";

        return {
            status: normalizedStatus || fallbackStatus,
            label,
            actorRole: normalizedActorRole,
            actorUid: normalizeText(safeOptions.actorUid || safeOptions.uid),
            actorName: normalizeText(safeOptions.actorName || safeOptions.name),
            note: normalizeText(safeOptions.note),
            at: normalizeTimestampValue(
                safeOptions.at,
                normalizeTimestampValue(safeOptions.timestamp, null)
            )
        };
    }

    function createOrderRecord(orderValues = {}, options = {}) {
        const safeValues = orderValues && typeof orderValues === "object" ? orderValues : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const paymentStatus = resolvePaymentStatus(safeOptions.paymentStatus);
        const defaultStatus = orderStatus ? orderStatus.getDefaultOrderStatus() : "pending";
        const normalizedStatus = orderStatus
            ? orderStatus.normalizeOrderStatus(safeValues.status, defaultStatus)
            : normalizeLowerText(safeValues.status) || defaultStatus;
        const defaultPaymentStatus = paymentStatus
            ? paymentStatus.getDefaultPaymentStatus()
            : "unpaid";
        const normalizedPaymentStatus = paymentStatus
            ? paymentStatus.normalizePaymentStatus(safeValues.paymentStatus, defaultPaymentStatus)
            : normalizeLowerText(safeValues.paymentStatus) || defaultPaymentStatus;
        const customer = createCustomerSnapshot(safeValues.customer || safeValues);
        const vendor = createVendorSnapshot(safeValues.vendor || safeValues);
        const items = normalizeOrderItems(safeValues.items);
        const createdAt = normalizeTimestampValue(safeValues.createdAt, safeOptions.createdAt || null);
        const updatedAt = normalizeTimestampValue(safeValues.updatedAt, createdAt);
        const providedTimeline = Array.isArray(safeValues.timeline) ? safeValues.timeline : [];
        const timeline = providedTimeline.length > 0
            ? providedTimeline.map(function normalizeTimelineEntry(entry) {
                const safeEntry = entry && typeof entry === "object" ? entry : {};

                return createOrderTimelineEntry(
                    safeEntry.status || normalizedStatus,
                    {
                        actorRole: safeEntry.actorRole,
                        actorUid: safeEntry.actorUid,
                        actorName: safeEntry.actorName,
                        note: safeEntry.note,
                        at: normalizeTimestampValue(safeEntry.at, safeEntry.timestamp)
                    },
                    orderStatus
                );
            })
            : [
                createOrderTimelineEntry(
                    normalizedStatus,
                    {
                        actorRole: safeValues.createdByRole || safeOptions.createdByRole || "customer",
                        actorUid: safeValues.createdByUid || customer.customerUid,
                        actorName: safeValues.createdByName || customer.customerName,
                        note: safeValues.statusNote || safeValues.note || "",
                        at: createdAt
                    },
                    orderStatus
                )
            ];
        const subtotal = safeValues.subtotal !== undefined
            ? normalizeCurrencyAmount(safeValues.subtotal, calculateOrderSubtotal(items))
            : calculateOrderSubtotal(items);
        const total = safeValues.total !== undefined
            ? normalizeCurrencyAmount(safeValues.total, subtotal)
            : subtotal;
        const calculatedVendorSubtotal = calculateOrderVendorSubtotal(items);
        const calculatedPlatformFee = calculateOrderPlatformFee(items);
        const vendorSubtotal = safeValues.vendorSubtotal !== undefined
            ? normalizeCurrencyAmount(safeValues.vendorSubtotal, calculatedVendorSubtotal)
            : safeValues.vendorEarnings !== undefined
                ? normalizeCurrencyAmount(safeValues.vendorEarnings, calculatedVendorSubtotal)
                : calculatedVendorSubtotal;
        const platformFee = safeValues.platformFee !== undefined
            ? normalizeCurrencyAmount(safeValues.platformFee, calculatedPlatformFee)
            : safeValues.platformEarnings !== undefined
                ? normalizeCurrencyAmount(safeValues.platformEarnings, calculatedPlatformFee)
                : calculatedPlatformFee;
        const platformFeeRate = normalizePlatformFeeRate(
            safeValues.platformFeeRate,
            items[0] ? items[0].platformFeeRate : DEFAULT_PLATFORM_FEE_RATE
        );
        const customerTotal = safeValues.customerTotal !== undefined
            ? normalizeCurrencyAmount(safeValues.customerTotal, total)
            : total;
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

        return {
            orderId: normalizeText(
                safeValues.orderId ||
                safeValues.id
            ),
            customerUid: customer.customerUid,
            customerName: customer.customerName,
            customerEmail: customer.customerEmail,
            vendorUid: vendor.vendorUid,
            vendorName: vendor.vendorName,
            items,
            itemCount: calculateOrderItemCount(items),
            subtotal,
            total,
            totalAmount: total,
            vendorSubtotal,
            vendorEarnings: vendorSubtotal,
            platformFeeRate,
            platformFee,
            platformEarnings: platformFee,
            customerTotal,
            financeModel: normalizeText(safeValues.financeModel || safeValues.pricingModel) || FINANCE_MODEL,
            status: normalizedStatus || defaultStatus,
            paymentStatus: normalizedPaymentStatus || defaultPaymentStatus,
            paymentProvider: normalizePaymentProvider(safeValues.paymentProvider),
            paymentReference: normalizeText(
                safeValues.paymentReference ||
                safeValues.paystackReference
            ),
            paymentAccessCode: normalizeText(
                safeValues.paymentAccessCode ||
                safeValues.paystackAccessCode
            ),
            paymentAuthorizationUrl: normalizeText(
                safeValues.paymentAuthorizationUrl ||
                safeValues.paymentAuthorizationURL ||
                safeValues.paymentUrl ||
                safeValues.paymentURL
            ),
            paymentAmount,
            paymentAmountInMinorUnits,
            paymentCurrency: normalizePaymentCurrency(safeValues.paymentCurrency),
            paymentPaidAt: normalizeTimestampValue(safeValues.paymentPaidAt, safeValues.paidAt),
            paymentFailedAt: normalizeTimestampValue(safeValues.paymentFailedAt, safeValues.failedAt),
            paymentVerifiedAt: normalizeTimestampValue(safeValues.paymentVerifiedAt, safeValues.verifiedAt),
            paymentFailureReason: normalizeText(
                safeValues.paymentFailureReason ||
                safeValues.failureReason ||
                safeValues.paymentErrorMessage
            ),
            timeline,
            notes: normalizeText(safeValues.notes || safeValues.note),
            customerConfirmedCollected: normalizeBoolean(safeValues.customerConfirmedCollected),
            vendorConfirmedCollected: normalizeBoolean(safeValues.vendorConfirmedCollected),
            createdAt,
            updatedAt
        };
    }

    function normalizeOrderRecord(orderValues = {}, options = {}) {
        return createOrderRecord(orderValues, options);
    }

    function createOrderRecordsFromCart(cartItems, customer, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const groupedItems = groupOrderItemsByVendor(cartItems);
        const customerSnapshot = createCustomerSnapshot(customer);

        return groupedItems.map(function createVendorOrder(group) {
            return createOrderRecord(
                {
                    customerUid: customerSnapshot.customerUid,
                    customerName: customerSnapshot.customerName,
                    customerEmail: customerSnapshot.customerEmail,
                    vendorUid: group.vendorUid,
                    vendorName: group.vendorName,
                    items: group.items,
                    status: safeOptions.status,
                    paymentStatus: safeOptions.paymentRecordStatus || safeOptions.initialPaymentStatus,
                    paymentProvider: safeOptions.paymentProvider,
                    paymentReference: safeOptions.paymentReference,
                    paymentAccessCode: safeOptions.paymentAccessCode,
                    paymentAuthorizationUrl: safeOptions.paymentAuthorizationUrl,
                    paymentCurrency: safeOptions.paymentCurrency,
                    notes: safeOptions.notes,
                    createdByRole: safeOptions.createdByRole || "customer",
                    createdByUid: safeOptions.createdByUid || customerSnapshot.customerUid,
                    createdByName: safeOptions.createdByName || customerSnapshot.customerName,
                    createdAt: safeOptions.createdAt,
                    updatedAt: safeOptions.updatedAt
                },
                {
                    orderStatus: orderStatus,
                    paymentStatus: safeOptions.paymentStatus,
                    createdAt: safeOptions.createdAt,
                    createdByRole: safeOptions.createdByRole || "customer"
                }
            );
        });
    }

    const orderModel = {
        MODULE_NAME,
        DEFAULT_PLATFORM_FEE_RATE,
        FINANCE_MODEL,
        resolveOrderStatus,
        resolvePaymentStatus,
        normalizeText,
        normalizeLowerText,
        normalizeUpperText,
        normalizeCurrencyAmount,
        normalizePlatformFeeRate,
        normalizePositiveInteger,
        normalizeAmountInMinorUnits,
        normalizeBoolean,
        normalizeTimestampValue,
        hasOwnField,
        getCustomerFacingPrice,
        calculateOrderItemPricing,
        amountToMinorUnits,
        normalizePaymentProvider,
        normalizePaymentCurrency,
        createCustomerSnapshot,
        createVendorSnapshot,
        normalizeOrderItem,
        normalizeOrderItems,
        calculateOrderItemCount,
        calculateOrderSubtotal,
        calculateOrderVendorSubtotal,
        calculateOrderPlatformFee,
        groupOrderItemsByVendor,
        createOrderTimelineEntry,
        createOrderRecord,
        normalizeOrderRecord,
        createOrderRecordsFromCart
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = orderModel;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.orderModel = orderModel;
    }
})(typeof window !== "undefined" ? window : globalThis);
