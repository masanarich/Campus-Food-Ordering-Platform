const orderModel = require("../../../public/shared/orders/order-model.js");
const orderStatus = require("../../../public/shared/orders/order-status.js");
const paymentStatus = require("../../../public/shared/payments/payment-status.js");

describe("shared/orders/order-model.js", () => {
    test("exports a real shared model module", () => {
        expect(orderModel.MODULE_NAME).toBe("order-model");
        expect(orderModel.DEFAULT_PLATFORM_FEE_RATE).toBe(0.1);
        expect(orderModel.FINANCE_MODEL).toBe("vendor-price-plus-platform-fee");
        expect(orderModel.resolveOrderStatus(orderStatus)).toBe(orderStatus);
        expect(orderModel.resolvePaymentStatus(paymentStatus)).toBe(paymentStatus);
    });

    test("resolves order-status and payment-status from global scope and require fallback", () => {
        const originalGlobalOrderStatus = global.orderStatus;
        const originalGlobalPaymentStatus = global.paymentStatus;

        global.orderStatus = orderStatus;
        expect(orderModel.resolveOrderStatus()).toBe(orderStatus);

        delete global.orderStatus;
        expect(orderModel.resolveOrderStatus()).toBe(orderStatus);

        global.orderStatus = originalGlobalOrderStatus;

        global.paymentStatus = paymentStatus;
        expect(orderModel.resolvePaymentStatus()).toBe(paymentStatus);

        delete global.paymentStatus;
        expect(orderModel.resolvePaymentStatus()).toBe(paymentStatus);

        global.paymentStatus = originalGlobalPaymentStatus;
    });

    test("normalizes primitive values safely", () => {
        expect(orderModel.normalizeText("  Hello  ")).toBe("Hello");
        expect(orderModel.normalizeText(null)).toBe("");
        expect(orderModel.normalizeLowerText("  HeLLo  ")).toBe("hello");
        expect(orderModel.normalizeUpperText("  zar  ")).toBe("ZAR");
        expect(orderModel.normalizeTagList(" Halal, gluten free, halal ")).toEqual([
            "halal",
            "gluten free"
        ]);
        expect(orderModel.normalizeTagList([" Nuts ", "dairy", "nuts"])).toEqual([
            "nuts",
            "dairy"
        ]);
        expect(orderModel.normalizeTagList(null)).toEqual([]);

        expect(orderModel.normalizeCurrencyAmount("45.678")).toBe(45.68);
        expect(orderModel.normalizeCurrencyAmount(-50)).toBe(0);
        expect(orderModel.normalizeCurrencyAmount("bad", 12.5)).toBe(12.5);
        expect(orderModel.normalizeCurrencyAmount("bad")).toBe(0);

        expect(orderModel.normalizePositiveInteger("4")).toBe(4);
        expect(orderModel.normalizePositiveInteger(-1, 3)).toBe(3);
        expect(orderModel.normalizePositiveInteger("bad")).toBe(1);

        expect(orderModel.normalizeAmountInMinorUnits("1234")).toBe(1234);
        expect(orderModel.normalizeAmountInMinorUnits(-20, 500)).toBe(0);
        expect(orderModel.normalizeAmountInMinorUnits("bad", 500)).toBe(500);
        expect(orderModel.normalizePlatformFeeRate("10")).toBe(0.1);
        expect(orderModel.normalizePlatformFeeRate("0.125")).toBe(0.125);
        expect(orderModel.amountToMinorUnits(12.34)).toBe(1234);
        expect(orderModel.normalizePaymentProvider(" PayStack ")).toBe("paystack");
        expect(orderModel.normalizePaymentProvider("", "campus-pay")).toBe("campus-pay");
        expect(orderModel.normalizePaymentCurrency(" zar ")).toBe("ZAR");
        expect(orderModel.normalizePaymentCurrency("", "usd")).toBe("USD");

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
                dietaryTags: " Halal, High Protein, halal ",
                allergenTags: [" Gluten ", "Dairy", "gluten"],
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
            dietary: ["halal", "high protein"],
            allergens: ["gluten", "dairy"],
            vendorPrice: 50.45,
            basePrice: 50.45,
            platformFeeRate: 0.1,
            platformFee: 5.05,
            customerPrice: 55.5,
            price: 55.5,
            quantity: 2,
            vendorSubtotal: 100.9,
            lineVendorSubtotal: 100.9,
            platformFeeTotal: 10.1,
            linePlatformFee: 10.1,
            subtotal: 111,
            lineTotal: 111,
            lineCustomerTotal: 111,
            photoURL: "https://example.com/a.jpg",
            notes: "No mayo"
        });

        expect(
            orderModel.normalizeOrderItem({
                id: "vendor-priced",
                name: "Vendor Meal",
                vendorPrice: "100",
                quantity: 2
            })
        ).toEqual(expect.objectContaining({
            vendorPrice: 100,
            platformFee: 10,
            customerPrice: 110,
            price: 110,
            vendorSubtotal: 200,
            platformFeeTotal: 20,
            subtotal: 220,
            lineTotal: 220
        }));

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
                dietary: [],
                allergens: [],
                vendorPrice: 45.45,
                basePrice: 45.45,
                platformFeeRate: 0.1,
                platformFee: 4.55,
                customerPrice: 50,
                price: 50,
                quantity: 1,
                vendorSubtotal: 45.45,
                lineVendorSubtotal: 45.45,
                platformFeeTotal: 4.55,
                linePlatformFee: 4.55,
                subtotal: 50,
                lineTotal: 50,
                lineCustomerTotal: 50,
                photoURL: "",
                notes: ""
            },
            {
                menuItemId: "",
                vendorUid: "",
                vendorName: "",
                name: "Water",
                category: "",
                dietary: [],
                allergens: [],
                vendorPrice: 9.09,
                basePrice: 9.09,
                platformFeeRate: 0.1,
                platformFee: 0.91,
                customerPrice: 10,
                price: 10,
                quantity: 2,
                vendorSubtotal: 18.18,
                lineVendorSubtotal: 18.18,
                platformFeeTotal: 1.82,
                linePlatformFee: 1.82,
                subtotal: 20,
                lineTotal: 20,
                lineCustomerTotal: 20,
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
        expect(orderModel.calculateOrderVendorSubtotal(items)).toBe(153.17);
        expect(orderModel.calculateOrderPlatformFee(items)).toBe(15.33);
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
                        dietary: [],
                        allergens: [],
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
                    },
                    {
                        menuItemId: "chips",
                        vendorUid: "vendor-1",
                        vendorName: "",
                        name: "Chips",
                        category: "",
                        dietary: [],
                        allergens: [],
                        vendorPrice: 27.27,
                        basePrice: 27.27,
                        platformFeeRate: 0.1,
                        platformFee: 2.73,
                        customerPrice: 30,
                        price: 30,
                        quantity: 1,
                        vendorSubtotal: 27.27,
                        lineVendorSubtotal: 27.27,
                        platformFeeTotal: 2.73,
                        linePlatformFee: 2.73,
                        subtotal: 30,
                        lineTotal: 30,
                        lineCustomerTotal: 30,
                        photoURL: "",
                        notes: ""
                    }
                ],
                itemCount: 3,
                subtotal: 130,
                total: 130,
                vendorSubtotal: 118.17,
                vendorEarnings: 118.17,
                platformFee: 11.83,
                platformEarnings: 11.83,
                customerTotal: 130
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
                        dietary: [],
                        allergens: [],
                        vendorPrice: 16.82,
                        basePrice: 16.82,
                        platformFeeRate: 0.1,
                        platformFee: 1.68,
                        customerPrice: 18.5,
                        price: 18.5,
                        quantity: 1,
                        vendorSubtotal: 16.82,
                        lineVendorSubtotal: 16.82,
                        platformFeeTotal: 1.68,
                        linePlatformFee: 1.68,
                        subtotal: 18.5,
                        lineTotal: 18.5,
                        lineCustomerTotal: 18.5,
                        photoURL: "",
                        notes: ""
                    }
                ],
                itemCount: 1,
                subtotal: 18.5,
                total: 18.5,
                vendorSubtotal: 16.82,
                vendorEarnings: 16.82,
                platformFee: 1.68,
                platformEarnings: 1.68,
                customerTotal: 18.5
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
                        dietary: [],
                        allergens: [],
                        vendorPrice: 10.91,
                        basePrice: 10.91,
                        platformFeeRate: 0.1,
                        platformFee: 1.09,
                        customerPrice: 12,
                        price: 12,
                        quantity: 1,
                        vendorSubtotal: 10.91,
                        lineVendorSubtotal: 10.91,
                        platformFeeTotal: 1.09,
                        linePlatformFee: 1.09,
                        subtotal: 12,
                        lineTotal: 12,
                        lineCustomerTotal: 12,
                        photoURL: "",
                        notes: ""
                    },
                    {
                        menuItemId: "cake",
                        vendorUid: "vendor-5",
                        vendorName: "Bakery Bar",
                        name: "Cake",
                        category: "",
                        dietary: [],
                        allergens: [],
                        vendorPrice: 22.73,
                        basePrice: 22.73,
                        platformFeeRate: 0.1,
                        platformFee: 2.27,
                        customerPrice: 25,
                        price: 25,
                        quantity: 1,
                        vendorSubtotal: 22.73,
                        lineVendorSubtotal: 22.73,
                        platformFeeTotal: 2.27,
                        linePlatformFee: 2.27,
                        subtotal: 25,
                        lineTotal: 25,
                        lineCustomerTotal: 25,
                        photoURL: "",
                        notes: ""
                    }
                ],
                itemCount: 2,
                subtotal: 37,
                total: 37,
                vendorSubtotal: 33.64,
                vendorEarnings: 33.64,
                platformFee: 3.36,
                platformEarnings: 3.36,
                customerTotal: 37
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
                    dietary: [],
                    allergens: [],
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
                },
                {
                    menuItemId: "chips",
                    vendorUid: "vendor-1",
                    vendorName: "Campus Bites",
                    name: "Chips",
                    category: "",
                    dietary: [],
                    allergens: [],
                    vendorPrice: 27.27,
                    basePrice: 27.27,
                    platformFeeRate: 0.1,
                    platformFee: 2.73,
                    customerPrice: 30,
                    price: 30,
                    quantity: 1,
                    vendorSubtotal: 27.27,
                    lineVendorSubtotal: 27.27,
                    platformFeeTotal: 2.73,
                    linePlatformFee: 2.73,
                    subtotal: 30,
                    lineTotal: 30,
                    lineCustomerTotal: 30,
                    photoURL: "",
                    notes: ""
                }
            ],
            itemCount: 3,
            subtotal: 130,
            total: 130,
            totalAmount: 130,
            vendorSubtotal: 118.17,
            vendorEarnings: 118.17,
            platformFeeRate: 0.1,
            platformFee: 11.83,
            platformEarnings: 11.83,
            customerTotal: 130,
            financeModel: "vendor-price-plus-platform-fee",
            status: "accepted",
            paymentStatus: "unpaid",
            paymentProvider: "paystack",
            paymentReference: "",
            paymentAccessCode: "",
            paymentAuthorizationUrl: "",
            paymentAmount: 130,
            paymentAmountInMinorUnits: 13000,
            paymentCurrency: "ZAR",
            paymentPaidAt: null,
            paymentFailedAt: null,
            paymentVerifiedAt: null,
            paymentFailureReason: "",
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
            paymentStatus: "unpaid",
            paymentProvider: "paystack",
            paymentReference: "",
            paymentAccessCode: "",
            paymentAuthorizationUrl: "",
            paymentAmount: 30,
            paymentAmountInMinorUnits: 3000,
            paymentCurrency: "ZAR",
            paymentPaidAt: null,
            paymentFailedAt: null,
            paymentVerifiedAt: null,
            paymentFailureReason: "",
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

    test("normalizes payment fields on existing order records", () => {
        const normalized = orderModel.normalizeOrderRecord({
            orderId: "order-paid-1",
            customerUid: "customer-1",
            customerName: "Tshepo",
            customerEmail: "tshepo@example.com",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            items: [
                { id: "burger", vendorUid: "vendor-1", name: "Burger", price: 50, quantity: 1 }
            ],
            total: 50,
            paymentStatus: "success",
            paymentProvider: " PayStack ",
            paystackReference: " ref-123 ",
            paystackAccessCode: " access-123 ",
            paymentURL: " https://paystack.test/pay ",
            paymentAmount: "50.125",
            paymentCurrency: " zar ",
            paidAt: "paid-1",
            verifiedAt: "verified-1",
            paymentErrorMessage: " none "
        }, {
            orderStatus,
            paymentStatus
        });

        expect(normalized).toEqual(expect.objectContaining({
            paymentStatus: "paid",
            paymentProvider: "paystack",
            paymentReference: "ref-123",
            paymentAccessCode: "access-123",
            paymentAuthorizationUrl: "https://paystack.test/pay",
            paymentAmount: 50.13,
            paymentAmountInMinorUnits: 5013,
            paymentCurrency: "ZAR",
            paymentPaidAt: "paid-1",
            paymentFailedAt: null,
            paymentVerifiedAt: "verified-1",
            paymentFailureReason: "none"
        }));
    });

    test("creates one order record per vendor from a mixed cart", () => {
        const orders = orderModel.createOrderRecordsFromCart(
            [
                {
                    id: "burger",
                    vendorUid: "vendor-1",
                    vendorName: "Campus Bites",
                    name: "Burger",
                    price: 50,
                    quantity: 2,
                    dietary: [" Halal ", "high protein"],
                    allergens: "gluten, dairy, gluten"
                },
                {
                    id: "coffee",
                    vendorUid: "vendor-2",
                    vendorName: "Coffee Hub",
                    name: "Coffee",
                    price: 25,
                    quantity: 1,
                    dietaryTags: " vegetarian ",
                    allergenTags: [" dairy "]
                },
                { id: "ignore", name: "No Vendor", price: 10, quantity: 1 }
            ],
            {
                uid: "customer-1",
                displayName: "Tshepo",
                email: "tshepo@example.com"
            },
            {
                orderStatus,
                paymentStatus,
                status: "pending",
                initialPaymentStatus: "pending",
                paymentProvider: "paystack",
                paymentCurrency: "ZAR",
                notes: "Mixed vendor checkout",
                createdAt: "created-1"
            }
        );

        expect(orders).toHaveLength(2);
        expect(orders[0].vendorUid).toBe("vendor-1");
        expect(orders[0].customerUid).toBe("customer-1");
        expect(orders[0].status).toBe("pending");
        expect(orders[0].paymentStatus).toBe("pending");
        expect(orders[0].paymentAmount).toBe(100);
        expect(orders[0].paymentAmountInMinorUnits).toBe(10000);
        expect(orders[0].timeline[0].actorRole).toBe("customer");
        expect(orders[0].notes).toBe("Mixed vendor checkout");
        expect(orders[0].items[0]).toEqual(expect.objectContaining({
            dietary: ["halal", "high protein"],
            allergens: ["gluten", "dairy"]
        }));

        expect(orders[1].vendorUid).toBe("vendor-2");
        expect(orders[1].total).toBe(25);
        expect(orders[1].paymentStatus).toBe("pending");
        expect(orders[1].paymentAmount).toBe(25);
        expect(orders[1].paymentAmountInMinorUnits).toBe(2500);
        expect(orders[1].items[0]).toEqual(expect.objectContaining({
            dietary: ["vegetarian"],
            allergens: ["dairy"]
        }));
    });
});
