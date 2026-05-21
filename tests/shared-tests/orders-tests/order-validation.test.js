const orderValidation = require("../../../public/shared/orders/order-validation.js");
const orderStatus = require("../../../public/shared/orders/order-status.js");
const orderModel = require("../../../public/shared/orders/order-model.js");
const paymentStatus = require("../../../public/shared/payments/payment-status.js");

describe("shared/orders/order-validation.js", () => {
    test("exports a real validation module and basic helpers", () => {
        expect(orderValidation.MODULE_NAME).toBe("order-validation");
        expect(orderValidation.resolveOrderStatus(orderStatus)).toBe(orderStatus);
        expect(orderValidation.resolveOrderModel(orderModel)).toBe(orderModel);
        expect(orderValidation.resolvePaymentStatus(paymentStatus)).toBe(paymentStatus);
        expect(orderValidation.normalizeText("  Hello  ")).toBe("Hello");
        expect(orderValidation.normalizeLowerText("  HeLLo  ")).toBe("hello");
        expect(orderValidation.normalizeUpperText("  zar  ")).toBe("ZAR");
        expect(orderValidation.isValidEmail("user@example.com")).toBe(true);
        expect(orderValidation.isValidEmail("bad-email")).toBe(false);
        expect(orderValidation.getRawItemPrice({ customerPrice: "55" })).toBe("55");
        expect(orderValidation.getRawItemPrice({ vendorPrice: "50" })).toBe("50");
    });

    test("resolves shared dependencies from global scope and require fallback", () => {
        const originalGlobalOrderStatus = global.orderStatus;
        const originalGlobalOrderModel = global.orderModel;
        const originalGlobalPaymentStatus = global.paymentStatus;

        global.orderStatus = orderStatus;
        global.orderModel = orderModel;
        global.paymentStatus = paymentStatus;
        expect(orderValidation.resolveOrderStatus()).toBe(orderStatus);
        expect(orderValidation.resolveOrderModel()).toBe(orderModel);
        expect(orderValidation.resolvePaymentStatus()).toBe(paymentStatus);

        delete global.orderStatus;
        delete global.orderModel;
        delete global.paymentStatus;
        expect(orderValidation.resolveOrderStatus()).toBe(orderStatus);
        expect(orderValidation.resolveOrderModel()).toBe(orderModel);
        expect(orderValidation.resolvePaymentStatus()).toBe(paymentStatus);

        global.orderStatus = originalGlobalOrderStatus;
        global.orderModel = originalGlobalOrderModel;
        global.paymentStatus = originalGlobalPaymentStatus;
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
                vendorPrice: 45.45,
                basePrice: 45.45,
                platformFeeRate: 0.1,
                platformFee: 4.55,
                customerPrice: 50,
                price: 50,
                quantity: 2,
                vendorSubtotal: 90.9,
                lineVendorSubtotal: 90.9,
                platformFeeTotal: 9.1,
                linePlatformFee: 9.1,
                subtotal: 100,
                lineTotal: 100,
                lineCustomerTotal: 100,
                photoURL: "",
                notes: ""
            }
        });

        expect(
            orderValidation.validateOrderItem({
                id: "vendor-meal",
                vendorUid: "vendor-1",
                name: "Vendor Meal",
                vendorPrice: 100,
                quantity: 1
            }, { orderModel, requireVendorDetails: true })
        ).toEqual({
            isValid: true,
            errors: {},
            value: expect.objectContaining({
                vendorPrice: 100,
                platformFee: 10,
                customerPrice: 110,
                price: 110,
                subtotal: 110,
                lineTotal: 110
            })
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
                vendorPrice: 0,
                basePrice: 0,
                platformFeeRate: 0.1,
                platformFee: 0,
                customerPrice: 0,
                price: 0,
                quantity: 1,
                vendorSubtotal: 0,
                lineVendorSubtotal: 0,
                platformFeeTotal: 0,
                linePlatformFee: 0,
                subtotal: 0,
                lineTotal: 0,
                lineCustomerTotal: 0,
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
                expectedSubtotal: 100,
                vendorSubtotal: 90.9,
                vendorEarnings: 90.9,
                platformFee: 9.1,
                platformEarnings: 9.1,
                customerTotal: 110,
                expectedVendorSubtotal: 90.9,
                expectedPlatformFee: 9.1
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
                total: "Order total cannot be less than subtotal.",
                customerTotal: "Customer total must match the order total."
            },
            value: {
                subtotal: 99,
                total: 90,
                expectedSubtotal: 100,
                vendorSubtotal: 90.9,
                vendorEarnings: 90.9,
                platformFee: 9.1,
                platformEarnings: 9.1,
                customerTotal: 110,
                expectedVendorSubtotal: 90.9,
                expectedPlatformFee: 9.1
            }
        });
    });

    test("validates order payment fields", () => {
        const validOrder = orderModel.createOrderRecord({
            customerUid: "customer-1",
            customerName: "Tshepo",
            customerEmail: "tshepo@example.com",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            items: [
                { id: "burger", vendorUid: "vendor-1", name: "Burger", price: 50, quantity: 1 }
            ],
            paymentStatus: "paid",
            paymentReference: "ref-123",
            paymentVerifiedAt: "verified-at",
            createdAt: "t-1",
            updatedAt: "t-1"
        }, { orderStatus, paymentStatus });

        expect(
            orderValidation.validateOrderPaymentFields(validOrder, {
                orderStatus,
                orderModel,
                paymentStatus
            })
        ).toEqual({
            isValid: true,
            errors: {},
            value: {
                paymentStatus: "paid",
                paymentProvider: "paystack",
                paymentReference: "ref-123",
                paymentAccessCode: "",
                paymentAuthorizationUrl: "",
                paymentAmount: 50,
                paymentAmountInMinorUnits: 5000,
                paymentCurrency: "ZAR",
                paymentPaidAt: null,
                paymentFailedAt: null,
                paymentVerifiedAt: "verified-at",
                paymentFailureReason: ""
            }
        });

        expect(
            orderValidation.validateOrderPaymentFields({
                total: 50,
                paymentStatus: "mystery",
                paymentProvider: "cash",
                paymentAmount: 40,
                paymentAmountInMinorUnits: 4001,
                paymentCurrency: "USD"
            }, {
                paymentStatus
            })
        ).toEqual({
            isValid: false,
            errors: {
                paymentStatus: "Payment status must be valid.",
                paymentProvider: "Payment provider must be one of: paystack.",
                paymentCurrency: "Payment currency must be one of: ZAR.",
                paymentAmount: "Payment amount must match the order total.",
                paymentAmountInMinorUnits: "Payment amount in minor units must match the payment amount."
            },
            value: {
                paymentStatus: "",
                paymentProvider: "cash",
                paymentReference: "",
                paymentAccessCode: "",
                paymentAuthorizationUrl: "",
                paymentAmount: 40,
                paymentAmountInMinorUnits: 4001,
                paymentCurrency: "USD",
                paymentPaidAt: null,
                paymentFailedAt: null,
                paymentVerifiedAt: null,
                paymentFailureReason: ""
            }
        });

        const paidWithoutVerification = orderValidation.validateOrderPaymentFields({
            total: 50,
            paymentStatus: "paid",
            paymentProvider: "paystack",
            paymentReference: "",
            paymentAmount: 50,
            paymentAmountInMinorUnits: 5000,
            paymentCurrency: "ZAR"
        }, { paymentStatus });

        expect(paidWithoutVerification.isValid).toBe(false);
        expect(paidWithoutVerification.errors.paymentReference)
            .toBe("Payment reference is required once payment has started.");
        expect(paidWithoutVerification.errors.paymentVerifiedAt)
            .toBe("Paid orders must include a payment verification timestamp.");
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
                orderStatus,
                paymentStatus
            })
        ).toEqual({
            isValid: true,
            errors: {},
            value: orderModel.normalizeOrderRecord(validOrder, { orderStatus, paymentStatus })
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
            paymentStatus: "unknown",
            paymentProvider: "cash",
            paymentAmount: 20,
            paymentAmountInMinorUnits: 2001,
            paymentCurrency: "USD",
            createdAt: null,
            updatedAt: null
        };

        const result = orderValidation.validateOrderRecord(invalidOrder, {
            orderModel,
            orderStatus,
            paymentStatus
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
        expect(result.errors.paymentStatus).toBe("Payment status must be valid.");
        expect(result.errors.paymentProvider).toBe("Payment provider must be one of: paystack.");
        expect(result.errors.paymentCurrency).toBe("Payment currency must be one of: ZAR.");
        expect(result.errors.paymentAmount).toBe("Payment amount must match the order total.");
        expect(result.errors.paymentAmountInMinorUnits)
            .toBe("Payment amount in minor units must match the payment amount.");
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
