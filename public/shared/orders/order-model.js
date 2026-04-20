(function attachOrderModel(globalScope) {
    "use strict";

    const MODULE_NAME = "order-model";

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

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
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
        const price = normalizeCurrencyAmount(safeItem.price, safeItem.unitPrice);
        const quantity = normalizePositiveInteger(safeItem.quantity, safeItem.qty);

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
            price,
            quantity,
            subtotal: Number((price * quantity).toFixed(2)),
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
                    total: 0
                };
            }

            groupsByVendor[vendorUid].items.push(item);
            groupsByVendor[vendorUid].itemCount += item.quantity;
            groupsByVendor[vendorUid].subtotal = Number(
                (groupsByVendor[vendorUid].subtotal + item.subtotal).toFixed(2)
            );
            groupsByVendor[vendorUid].total = groupsByVendor[vendorUid].subtotal;

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
                total: groupsByVendor[vendorUid].total
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
        const defaultStatus = orderStatus ? orderStatus.getDefaultOrderStatus() : "pending";
        const normalizedStatus = orderStatus
            ? orderStatus.normalizeOrderStatus(safeValues.status, defaultStatus)
            : normalizeLowerText(safeValues.status) || defaultStatus;
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
            status: normalizedStatus || defaultStatus,
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
                    notes: safeOptions.notes,
                    createdByRole: safeOptions.createdByRole || "customer",
                    createdByUid: safeOptions.createdByUid || customerSnapshot.customerUid,
                    createdByName: safeOptions.createdByName || customerSnapshot.customerName,
                    createdAt: safeOptions.createdAt,
                    updatedAt: safeOptions.updatedAt
                },
                {
                    orderStatus: orderStatus,
                    createdAt: safeOptions.createdAt,
                    createdByRole: safeOptions.createdByRole || "customer"
                }
            );
        });
    }

    const orderModel = {
        MODULE_NAME,
        resolveOrderStatus,
        normalizeText,
        normalizeLowerText,
        normalizeCurrencyAmount,
        normalizePositiveInteger,
        normalizeBoolean,
        normalizeTimestampValue,
        createCustomerSnapshot,
        createVendorSnapshot,
        normalizeOrderItem,
        normalizeOrderItems,
        calculateOrderItemCount,
        calculateOrderSubtotal,
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
