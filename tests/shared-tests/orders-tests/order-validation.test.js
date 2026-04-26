const orderValidation = require("../../../public/shared/orders/order-validation.js");
const orderStatus = require("../../../public/shared/orders/order-status.js");
const orderModel = require("../../../public/shared/orders/order-model.js");

describe("shared/orders/order-validation.js", () => {
    test("exports a real validation module and basic helpers", () => {
        expect(orderValidation.MODULE_NAME).toBe("order-validation");
        expect(orderValidation.resolveOrderStatus(orderStatus)).toBe(orderStatus);
        expect(orderValidation.resolveOrderModel(orderModel)).toBe(orderModel);
        expect(orderValidation.normalizeText("  Hello  ")).toBe("Hello");
        expect(orderValidation.normalizeLowerText("  HeLLo  ")).toBe("hello");
        expect(orderValidation.isValidEmail("user@example.com")).toBe(true);
        expect(orderValidation.isValidEmail("bad-email")).toBe(false);
    });

    test("resolves shared dependencies from global scope and require fallback", () => {
        const originalGlobalOrderStatus = global.orderStatus;
        const originalGlobalOrderModel = global.orderModel;

        global.orderStatus = orderStatus;
        global.orderModel = orderModel;
        expect(orderValidation.resolveOrderStatus()).toBe(orderStatus);
        expect(orderValidation.resolveOrderModel()).toBe(orderModel);

        delete global.orderStatus;
        delete global.orderModel;
        expect(orderValidation.resolveOrderStatus()).toBe(orderStatus);
        expect(orderValidation.resolveOrderModel()).toBe(orderModel);

        global.orderStatus = originalGlobalOrderStatus;
        global.orderModel = originalGlobalOrderModel;
    });

    test("creates validation result objects and merges errors safely", () => {
        expect(orderValidation.createValidationResult({})).toEqual({
            isValid: true,
            errors: {}
        });

        expect(orderValidation.createValidationResult({ status: "Problem" }, { value: 1 })).toEqual({
            isValid: false,
            errors: { status: "Problem" },
            value: 1
        });

        const errors = {};
        orderValidation.setError(errors, "status", "Invalid");
        orderValidation.setError(errors, "status", "Ignored");
        orderValidation.mergeErrors(errors, {
            customerEmail: "Email is missing."
        }, "customer");

        expect(orderValidation.setError(null, "status", "Ignored")).toBeNull();
        expect(errors).toEqual({
            status: "Invalid",
            "customer.customerEmail": "Email is missing."
        });
    });

    test("validates customer snapshots", () => {
        expect(
            orderValidation.validateCustomerSnapshot({
                uid: "customer-1",
                displayName: "Tshepo",
                email: "tshepo@example.com"
            }, { orderModel })
        ).toEqual({
            isValid: true,
            errors: {},
            value: {
                customerUid: "customer-1",
                customerName: "Tshepo",
                customerEmail: "tshepo@example.com"
            }
        });

        expect(
            orderValidation.validateCustomerSnapshot({
                uid: "",
                displayName: "",
                email: "not-an-email"
            }, { orderModel })
        ).toEqual({
            isValid: false,
            errors: {
                customerUid: "Customer UID is required.",
                customerName: "Customer name is required.",
                customerEmail: "Customer email must be a valid email address."
            },
            value: {
                customerUid: "",
                customerName: "",
                customerEmail: "not-an-email"
            }
        });

        expect(
            orderValidation.validateCustomerSnapshot({
                uid: "customer-3",
                displayName: "Neo"
            }, { orderModel })
        ).toEqual({
            isValid: false,
            errors: {
                customerEmail: "Customer email is required."
            },
            value: {
                customerUid: "customer-3",
                customerName: "Neo",
                customerEmail: ""
            }
        });

        expect(
            orderValidation.validateCustomerSnapshot({
                uid: "customer-2",
                displayName: "Lerato"
            }, { orderModel, requireEmail: false })
        ).toEqual({
            isValid: true,
            errors: {},
            value: {
                customerUid: "customer-2",
                customerName: "Lerato",
                customerEmail: ""
            }
        });
    });

    test("validates vendor snapshots", () => {
        expect(
            orderValidation.validateVendorSnapshot({
                uid: "vendor-1",
                businessName: "Campus Bites"
            }, { orderModel })
        ).toEqual({
            isValid: true,
            errors: {},
            value: {
                vendorUid: "vendor-1",
                vendorName: "Campus Bites"
            }
        });

        expect(
            orderValidation.validateVendorSnapshot({}, { orderModel })
        ).toEqual({
            isValid: false,
            errors: {
                vendorUid: "Vendor UID is required.",
                vendorName: "Vendor name is required."
            },
            value: {
                vendorUid: "",
                vendorName: ""
            }
        });
    });

    test("validates individual order items and item lists", () => {
        expect(
            orderValidation.validateOrderItem({
                id: "burger",
                vendorUid: "vendor-1",
                vendorName: "Campus Bites",
                name: "Burger",
                price: 50,
                quantity: 2
            }, { orderModel, requireVendorDetails: true })
        ).toEqual({
            isValid: true,
            errors: {},
            value: {
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
            }
        });

        expect(
            orderValidation.validateOrderItem({
                quantity: 0
            }, { orderModel, requireVendorDetails: true })
        ).toEqual({
            isValid: false,
            errors: {
                menuItemId: "Each order item needs a menu item ID or item name.",
                name: "Each order item needs a name.",
                price: "Each order item needs a price.",
                quantity: "Each order item quantity must be at least 1.",
                vendorUid: "Each order item needs a vendor UID."
            },
            value: {
                menuItemId: "",
                vendorUid: "",
                vendorName: "",
                name: "",
                category: "",
                price: 0,
                quantity: 1,
                subtotal: 0,
                photoURL: "",
                notes: ""
            }
        });

        expect(
            orderValidation.validateOrderItems("not-an-array", { orderModel })
        ).toEqual({
            isValid: false,
            errors: {
                items: "Add at least one order item."
            },
            value: []
        });
    });

    test("validates timeline entries", () => {
        expect(
            orderValidation.validateOrderTimeline([], { orderStatus, orderModel })
        ).toEqual({
            isValid: false,
            errors: {
                timeline: "At least one timeline entry is required."
            },
            value: []
        });

        expect(
            orderValidation.validateOrderTimeline([
                {
                    status: "pending",
                    actorRole: "customer",
                    actorUid: "customer-1",
                    actorName: "Tshepo",
                    timestamp: "t-1"
                },
                {
                    status: "ready for pickup",
                    actorRole: "vendor",
                    actorUid: "vendor-1",
                    actorName: "Campus Bites",
                    at: "t-2"
                }
            ], { orderStatus, orderModel })
        ).toEqual({
            isValid: true,
            errors: {},
            value: [
                {
                    status: "pending",
                    label: "Order Received",
                    actorRole: "customer",
                    actorUid: "customer-1",
                    actorName: "Tshepo",
                    note: "",
                    at: "t-1"
                },
                {
                    status: "ready",
                    label: "Ready for Pickup",
                    actorRole: "vendor",
                    actorUid: "vendor-1",
                    actorName: "Campus Bites",
                    note: "",
                    at: "t-2"
                }
            ]
        });

        expect(
            orderValidation.validateOrderTimeline([
                {
                    status: "mystery",
                    actorRole: "ghost"
                }
            ], { orderStatus, orderModel })
        ).toEqual({
            isValid: false,
            errors: {
                "timeline.0.status": "Timeline entries need a valid order status.",
                "timeline.0.actorRole": "Timeline entries need a valid actor role.",
                "timeline.0.at": "Timeline entries need a timestamp."
            },
            value: [
                {
                    status: "pending",
                    label: "Order Received",
                    actorRole: "system",
                    actorUid: "",
                    actorName: "",
                    note: "",
                    at: null
                }
            ]
        });
    });

    test("validates order totals and allows totals above subtotal", () => {
        const validRecord = orderModel.createOrderRecord({
            customerUid: "customer-1",
            customerName: "Tshepo",
            customerEmail: "tshepo@example.com",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            items: [
                { id: "burger", vendorUid: "vendor-1", name: "Burger", price: 50, quantity: 2 }
            ],
            total: 110,
            createdAt: "t-1",
            updatedAt: "t-1"
        }, { orderStatus });

        expect(
            orderValidation.validateOrderTotals(validRecord, {
                orderModel,
                orderStatus
            })
        ).toEqual({
            isValid: true,
            errors: {},
            value: {
                subtotal: 100,
                total: 110,
                expectedSubtotal: 100
            }
        });

        expect(
            orderValidation.validateOrderTotals({
                ...validRecord,
                subtotal: 99,
                total: 90
            }, {
                orderModel,
                orderStatus
            })
        ).toEqual({
            isValid: false,
            errors: {
                subtotal: "Order subtotal must match the sum of its items (100).",
                total: "Order total cannot be less than subtotal."
            },
            value: {
                subtotal: 99,
                total: 90,
                expectedSubtotal: 100
            }
        });
    });

    test("validates full order records and catches consistency problems", () => {
        const validOrder = {
            orderId: "order-1",
            customerUid: "customer-1",
            customerName: "Tshepo",
            customerEmail: "tshepo@example.com",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            items: [
                { id: "burger", vendorUid: "vendor-1", vendorName: "Campus Bites", name: "Burger", price: 50, quantity: 2 }
            ],
            status: "pending",
            createdAt: "t-1",
            updatedAt: "t-1"
        };

        expect(
            orderValidation.validateOrderRecord(validOrder, {
                orderModel,
                orderStatus
            })
        ).toEqual({
            isValid: true,
            errors: {},
            value: orderModel.normalizeOrderRecord(validOrder, { orderStatus })
        });

        const invalidOrder = {
            customerUid: "",
            customerName: "",
            customerEmail: "bad-email",
            vendorUid: "vendor-1",
            vendorName: "",
            items: [
                { id: "burger", vendorUid: "vendor-2", name: "Burger", price: 50, quantity: 1 }
            ],
            status: "unknown",
            timeline: [
                { status: "mystery", actorRole: "ghost" }
            ],
            subtotal: 40,
            total: 30,
            createdAt: null,
            updatedAt: null
        };

        const result = orderValidation.validateOrderRecord(invalidOrder, {
            orderModel,
            orderStatus
        });

        expect(result.isValid).toBe(false);
        expect(result.errors.customerUid).toBe("Customer UID is required.");
        expect(result.errors.customerName).toBe("Customer name is required.");
        expect(result.errors.customerEmail).toBe("Customer email must be a valid email address.");
        expect(result.errors.vendorName).toBe("Vendor name is required.");
        expect(result.errors.status).toBe("Order status must be valid.");
        expect(result.errors["timeline.0.status"]).toBe("Timeline entries need a valid order status.");
        expect(result.errors["timeline.0.actorRole"]).toBe("Timeline entries need a valid actor role.");
        expect(result.errors["timeline.0.at"]).toBe("Timeline entries need a timestamp.");
        expect(result.errors.subtotal).toBe("Order subtotal must match the sum of its items (50).");
        expect(result.errors.total).toBe("Order total cannot be less than subtotal.");
        expect(result.errors["items.0.vendorUid"])
            .toBe("Each item in an order must belong to the same vendor as the order.");
        expect(result.errors.createdAt).toBe("Order createdAt is required.");
        expect(result.errors.updatedAt).toBe("Order updatedAt is required.");
    });

    test("requires both collection confirmations before completion", () => {
        const result = orderValidation.validateOrderRecord({
            customerUid: "customer-1",
            customerName: "Tshepo",
            customerEmail: "tshepo@example.com",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            items: [
                { id: "burger", vendorUid: "vendor-1", vendorName: "Campus Bites", name: "Burger", price: 50, quantity: 1 }
            ],
            status: "completed",
            customerConfirmedCollected: true,
            vendorConfirmedCollected: false,
            createdAt: "t-1",
            updatedAt: "t-2"
        }, {
            orderModel,
            orderStatus
        });

        expect(result.isValid).toBe(false);
        expect(result.errors.completedCollection)
            .toBe("Completed orders must be confirmed by both the customer and vendor.");
    });

    test("validates create-order input and status change requests", () => {
        const createResult = orderValidation.validateCreateOrderInput({
            customerUid: "customer-1",
            customerName: "Tshepo",
            customerEmail: "tshepo@example.com",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            items: [
                { id: "burger", vendorUid: "vendor-1", vendorName: "Campus Bites", name: "Burger", price: 50, quantity: 1 }
            ],
            status: "pending",
            createdAt: "t-1",
            updatedAt: "t-1"
        }, {
            orderModel,
            orderStatus
        });

        expect(createResult.isValid).toBe(true);

        expect(
            orderValidation.validateOrderStatusChange(
                "pending",
                "accepted",
                "vendor",
                { orderStatus }
            )
        ).toEqual({
            isValid: true,
            errors: {},
            transition: {
                isValid: true,
                currentStatus: "pending",
                nextStatus: "accepted",
                actorRole: "vendor",
                message: "Vendors can move an order from Order Received to Accepted."
            }
        });

        expect(
            orderValidation.validateOrderStatusChange(
                "pending",
                "ready",
                "vendor",
                { orderStatus }
            )
        ).toEqual({
            isValid: false,
            errors: {
                status: "Vendors cannot move an order from Order Received to Ready for Pickup."
            },
            transition: {
                isValid: false,
                currentStatus: "pending",
                nextStatus: "ready",
                actorRole: "vendor",
                message: "Vendors cannot move an order from Order Received to Ready for Pickup."
            }
        });
    });
});
