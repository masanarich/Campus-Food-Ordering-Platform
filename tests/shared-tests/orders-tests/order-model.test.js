const orderModel = require("../../../public/shared/orders/order-model.js");
const orderStatus = require("../../../public/shared/orders/order-status.js");

describe("shared/orders/order-model.js", () => {
    test("exports a real shared model module", () => {
        expect(orderModel.MODULE_NAME).toBe("order-model");
        expect(orderModel.resolveOrderStatus(orderStatus)).toBe(orderStatus);
    });

    test("resolves order-status from global scope and require fallback", () => {
        const originalGlobalOrderStatus = global.orderStatus;

        global.orderStatus = orderStatus;
        expect(orderModel.resolveOrderStatus()).toBe(orderStatus);

        delete global.orderStatus;
        expect(orderModel.resolveOrderStatus()).toBe(orderStatus);

        global.orderStatus = originalGlobalOrderStatus;
    });

    test("normalizes primitive values safely", () => {
        expect(orderModel.normalizeText("  Hello  ")).toBe("Hello");
        expect(orderModel.normalizeText(null)).toBe("");
        expect(orderModel.normalizeLowerText("  HeLLo  ")).toBe("hello");

        expect(orderModel.normalizeCurrencyAmount("45.678")).toBe(45.68);
        expect(orderModel.normalizeCurrencyAmount(-50)).toBe(0);
        expect(orderModel.normalizeCurrencyAmount("bad", 12.5)).toBe(12.5);
        expect(orderModel.normalizeCurrencyAmount("bad")).toBe(0);

        expect(orderModel.normalizePositiveInteger("4")).toBe(4);
        expect(orderModel.normalizePositiveInteger(-1, 3)).toBe(3);
        expect(orderModel.normalizePositiveInteger("bad")).toBe(1);

        expect(orderModel.normalizeBoolean(true)).toBe(true);
        expect(orderModel.normalizeBoolean(1)).toBe(true);
        expect(orderModel.normalizeBoolean("YES")).toBe(true);
        expect(orderModel.normalizeBoolean("no")).toBe(false);
        expect(orderModel.normalizeBoolean("0")).toBe(false);
        expect(orderModel.normalizeBoolean("unknown")).toBe(false);

        expect(orderModel.normalizeTimestampValue("now", "later")).toBe("now");
        expect(orderModel.normalizeTimestampValue(undefined, "later")).toBe("later");
        expect(orderModel.normalizeTimestampValue(undefined, undefined)).toBeNull();
    });

    test("creates customer and vendor snapshots from different field names", () => {
        expect(
            orderModel.createCustomerSnapshot({
                uid: "customer-1",
                displayName: "Tshepo",
                email: " T@example.com "
            })
        ).toEqual({
            customerUid: "customer-1",
            customerName: "Tshepo",
            customerEmail: "t@example.com"
        });

        expect(
            orderModel.createVendorSnapshot({
                userUid: "vendor-1",
                businessName: "Campus Bites"
            })
        ).toEqual({
            vendorUid: "vendor-1",
            vendorName: "Campus Bites"
        });

        expect(orderModel.createCustomerSnapshot(null)).toEqual({
            customerUid: "",
            customerName: "",
            customerEmail: ""
        });
    });

    test("normalizes order items and filters empty entries", () => {
        expect(
            orderModel.normalizeOrderItem({
                id: "item-1",
                vendorUid: "vendor-1",
                vendorName: "Campus Bites",
                itemName: "Chicken Wrap",
                price: "55.5",
                qty: "2",
                photoUrl: "https://example.com/a.jpg",
                specialInstructions: "No mayo"
            })
        ).toEqual({
            menuItemId: "item-1",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            name: "Chicken Wrap",
            category: "",
            price: 55.5,
            quantity: 2,
            subtotal: 111,
            photoURL: "https://example.com/a.jpg",
            notes: "No mayo"
        });

        expect(
            orderModel.normalizeOrderItems([
                { id: "item-1", name: "Burger", price: 50, quantity: 1 },
                { title: "Water", price: 10, qty: 2 },
                { price: 99 }
            ])
        ).toEqual([
            {
                menuItemId: "item-1",
                vendorUid: "",
                vendorName: "",
                name: "Burger",
                category: "",
                price: 50,
                quantity: 1,
                subtotal: 50,
                photoURL: "",
                notes: ""
            },
            {
                menuItemId: "",
                vendorUid: "",
                vendorName: "",
                name: "Water",
                category: "",
                price: 10,
                quantity: 2,
                subtotal: 20,
                photoURL: "",
                notes: ""
            }
        ]);
    });

    test("calculates counts, subtotals, and vendor groupings", () => {
        const items = [
            { id: "burger", vendorUid: "vendor-1", vendorName: "Campus Bites", name: "Burger", price: 50, quantity: 2 },
            { id: "chips", vendorUid: "vendor-1", name: "Chips", price: 30, quantity: 1 },
            { id: "juice", vendorUid: "vendor-2", vendorName: "Fresh Corner", name: "Juice", price: 18.5, quantity: 1 },
            { id: "skip-me", name: "Missing Vendor", price: 20, quantity: 1 }
        ];

        expect(orderModel.calculateOrderItemCount(items)).toBe(5);
        expect(orderModel.calculateOrderSubtotal(items)).toBe(168.5);
        expect(orderModel.groupOrderItemsByVendor(items)).toEqual([
            {
                vendorUid: "vendor-1",
                vendorName: "Campus Bites",
                items: [
                    {
                        menuItemId: "burger",
                        vendorUid: "vendor-1",
                        vendorName: "Campus Bites",
                        name: "Burger",
                        category: "",
                        price: 50,
                        quantity: 2,
                        subtotal: 100,
                        photoURL: "",
                        notes: ""
                    },
                    {
                        menuItemId: "chips",
                        vendorUid: "vendor-1",
                        vendorName: "",
                        name: "Chips",
                        category: "",
                        price: 30,
                        quantity: 1,
                        subtotal: 30,
                        photoURL: "",
                        notes: ""
                    }
                ],
                itemCount: 3,
                subtotal: 130,
                total: 130
            },
            {
                vendorUid: "vendor-2",
                vendorName: "Fresh Corner",
                items: [
                    {
                        menuItemId: "juice",
                        vendorUid: "vendor-2",
                        vendorName: "Fresh Corner",
                        name: "Juice",
                        category: "",
                        price: 18.5,
                        quantity: 1,
                        subtotal: 18.5,
                        photoURL: "",
                        notes: ""
                    }
                ],
                itemCount: 1,
                subtotal: 18.5,
                total: 18.5
            }
        ]);

        expect(
            orderModel.groupOrderItemsByVendor([
                { id: "tea", vendorUid: "vendor-5", name: "Tea", price: 12, quantity: 1 },
                { id: "cake", vendorUid: "vendor-5", vendorName: "Bakery Bar", name: "Cake", price: 25, quantity: 1 }
            ])
        ).toEqual([
            {
                vendorUid: "vendor-5",
                vendorName: "Bakery Bar",
                items: [
                    {
                        menuItemId: "tea",
                        vendorUid: "vendor-5",
                        vendorName: "",
                        name: "Tea",
                        category: "",
                        price: 12,
                        quantity: 1,
                        subtotal: 12,
                        photoURL: "",
                        notes: ""
                    },
                    {
                        menuItemId: "cake",
                        vendorUid: "vendor-5",
                        vendorName: "Bakery Bar",
                        name: "Cake",
                        category: "",
                        price: 25,
                        quantity: 1,
                        subtotal: 25,
                        photoURL: "",
                        notes: ""
                    }
                ],
                itemCount: 2,
                subtotal: 37,
                total: 37
            }
        ]);
    });

    test("creates timeline entries with canonical statuses and defaults", () => {
        expect(
            orderModel.createOrderTimelineEntry("ready for pickup", {
                actorRole: "student",
                actorUid: "user-1",
                actorName: "Tshepo",
                note: "Order is outside the kitchen.",
                at: "timestamp-1"
            }, orderStatus)
        ).toEqual({
            status: "ready",
            label: "Ready for Pickup",
            actorRole: "customer",
            actorUid: "user-1",
            actorName: "Tshepo",
            note: "Order is outside the kitchen.",
            at: "timestamp-1"
        });

        expect(orderModel.createOrderTimelineEntry("", {}, orderStatus)).toEqual({
            status: "pending",
            label: "Order Received",
            actorRole: "system",
            actorUid: "",
            actorName: "",
            note: "",
            at: null
        });

        expect(
            orderModel.createOrderTimelineEntry("Preparing", {
                actorRole: "Vendor",
                actorUid: "vendor-1",
                name: "Campus Bites",
                timestamp: "timestamp-2"
            })
        ).toEqual({
            status: "preparing",
            label: "Preparing",
            actorRole: "vendor",
            actorUid: "vendor-1",
            actorName: "Campus Bites",
            note: "",
            at: "timestamp-2"
        });
    });

    test("creates normalized order records with default timeline and totals", () => {
        const order = orderModel.createOrderRecord({
            id: "order-1",
            customer: {
                uid: "customer-1",
                displayName: "Tshepo",
                email: " TSHEPO@example.com "
            },
            vendor: {
                uid: "vendor-1",
                businessName: "Campus Bites"
            },
            items: [
                { id: "burger", vendorUid: "vendor-1", vendorName: "Campus Bites", name: "Burger", price: 50, quantity: 2 },
                { id: "chips", vendorUid: "vendor-1", vendorName: "Campus Bites", name: "Chips", price: 30, quantity: 1 }
            ],
            status: "approved",
            note: "Please add sauce",
            customerConfirmedCollected: "yes",
            vendorConfirmedCollected: "0",
            createdAt: "created-1"
        }, { orderStatus });

        expect(order).toEqual({
            orderId: "order-1",
            customerUid: "customer-1",
            customerName: "Tshepo",
            customerEmail: "tshepo@example.com",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            items: [
                {
                    menuItemId: "burger",
                    vendorUid: "vendor-1",
                    vendorName: "Campus Bites",
                    name: "Burger",
                    category: "",
                    price: 50,
                    quantity: 2,
                    subtotal: 100,
                    photoURL: "",
                    notes: ""
                },
                {
                    menuItemId: "chips",
                    vendorUid: "vendor-1",
                    vendorName: "Campus Bites",
                    name: "Chips",
                    category: "",
                    price: 30,
                    quantity: 1,
                    subtotal: 30,
                    photoURL: "",
                    notes: ""
                }
            ],
            itemCount: 3,
            subtotal: 130,
            total: 130,
            status: "accepted",
            timeline: [
                {
                    status: "accepted",
                    label: "Accepted",
                    actorRole: "customer",
                    actorUid: "customer-1",
                    actorName: "Tshepo",
                    note: "Please add sauce",
                    at: "created-1"
                }
            ],
            notes: "Please add sauce",
            customerConfirmedCollected: true,
            vendorConfirmedCollected: false,
            createdAt: "created-1",
            updatedAt: "created-1"
        });
    });

    test("normalizes existing order records and preserves provided timeline and totals", () => {
        const normalized = orderModel.normalizeOrderRecord({
            orderId: "order-2",
            customerUid: "customer-2",
            customerName: "Lerato",
            customerEmail: "lerato@example.com",
            vendorUid: "vendor-9",
            vendorName: "Coffee Hub",
            items: [
                { id: "coffee", vendorUid: "vendor-9", vendorName: "Coffee Hub", title: "Coffee", price: 25, qty: 1 }
            ],
            subtotal: 25,
            total: 30,
            status: "ready",
            timeline: [
                {
                    status: "pending",
                    actorRole: "customer",
                    actorUid: "customer-2",
                    actorName: "Lerato",
                    note: "Please make it hot.",
                    timestamp: "t-1"
                },
                {
                    status: "ready",
                    actorRole: "vendor",
                    actorUid: "vendor-9",
                    actorName: "Coffee Hub",
                    at: "t-2"
                }
            ],
            notes: "Please make it hot.",
            customerConfirmedCollected: false,
            vendorConfirmedCollected: true,
            createdAt: "t-1",
            updatedAt: "t-2"
        }, { orderStatus });

        expect(normalized.timeline).toEqual([
            {
                status: "pending",
                label: "Order Received",
                actorRole: "customer",
                actorUid: "customer-2",
                actorName: "Lerato",
                note: "Please make it hot.",
                at: "t-1"
            },
            {
                status: "ready",
                label: "Ready for Pickup",
                actorRole: "vendor",
                actorUid: "vendor-9",
                actorName: "Coffee Hub",
                note: "",
                at: "t-2"
            }
        ]);
        expect(normalized.total).toBe(30);
        expect(normalized.vendorConfirmedCollected).toBe(true);
    });

    test("creates one order record per vendor from a mixed cart", () => {
        const orders = orderModel.createOrderRecordsFromCart(
            [
                { id: "burger", vendorUid: "vendor-1", vendorName: "Campus Bites", name: "Burger", price: 50, quantity: 2 },
                { id: "coffee", vendorUid: "vendor-2", vendorName: "Coffee Hub", name: "Coffee", price: 25, quantity: 1 },
                { id: "ignore", name: "No Vendor", price: 10, quantity: 1 }
            ],
            {
                uid: "customer-1",
                displayName: "Tshepo",
                email: "tshepo@example.com"
            },
            {
                orderStatus,
                status: "pending",
                notes: "Mixed vendor checkout",
                createdAt: "created-1"
            }
        );

        expect(orders).toHaveLength(2);
        expect(orders[0].vendorUid).toBe("vendor-1");
        expect(orders[0].customerUid).toBe("customer-1");
        expect(orders[0].status).toBe("pending");
        expect(orders[0].timeline[0].actorRole).toBe("customer");
        expect(orders[0].notes).toBe("Mixed vendor checkout");

        expect(orders[1].vendorUid).toBe("vendor-2");
        expect(orders[1].total).toBe(25);
    });
});
