const checkoutModel = require("../../../public/shared/checkout/checkout-model.js");
const checkoutStatus = require("../../../public/shared/checkout/checkout-status.js");

describe("shared/checkout/checkout-model.js", () => {
    test("exports constants and normalization helpers", () => {
        expect(checkoutModel.MODULE_NAME).toBe("checkout-model");
        expect(checkoutModel.DEFAULT_PROVIDER).toBe("paystack");
        expect(checkoutModel.DEFAULT_CURRENCY).toBe("ZAR");
        expect(checkoutModel.DEFAULT_PLATFORM_FEE_RATE).toBe(0.1);
        expect(checkoutModel.FINANCE_MODEL).toBe("vendor-price-plus-platform-fee");

        expect(checkoutModel.normalizeText("  hello  ")).toBe("hello");
        expect(checkoutModel.normalizeText(null)).toBe("");
        expect(checkoutModel.normalizeLowerText(" PAYSTACK ")).toBe("paystack");
        expect(checkoutModel.normalizeUpperText(" zar ")).toBe("ZAR");
        expect(checkoutModel.normalizeTagList(" Halal, gluten free, halal ")).toEqual([
            "halal",
            "gluten free"
        ]);
        expect(checkoutModel.normalizeTagList([" Nuts ", "dairy", "nuts"])).toEqual([
            "nuts",
            "dairy"
        ]);
        expect(checkoutModel.normalizeTagList(null)).toEqual([]);
        expect(checkoutModel.normalizeProvider(" PayStack ")).toBe("paystack");
        expect(checkoutModel.normalizeProvider("", "custom")).toBe("custom");
        expect(checkoutModel.normalizeCurrency(" usd ")).toBe("USD");
        expect(checkoutModel.normalizeCurrency("", "zar")).toBe("ZAR");
    });

    test("normalizes amounts, quantities, minor units, timestamps, and metadata", () => {
        expect(checkoutModel.normalizeCurrencyAmount("12.349")).toBe(12.35);
        expect(checkoutModel.normalizeCurrencyAmount("-4")).toBe(0);
        expect(checkoutModel.normalizeCurrencyAmount("bad", 8.239)).toBe(8.24);
        expect(checkoutModel.normalizeCurrencyAmount("bad")).toBe(0);

        expect(checkoutModel.normalizePositiveInteger("3")).toBe(3);
        expect(checkoutModel.normalizePositiveInteger("-2", 4)).toBe(4);
        expect(checkoutModel.normalizePositiveInteger("bad", "2")).toBe(2);
        expect(checkoutModel.normalizePositiveInteger("bad")).toBe(1);

        expect(checkoutModel.normalizeAmountInMinorUnits("1234")).toBe(1234);
        expect(checkoutModel.normalizeAmountInMinorUnits("-5")).toBe(0);
        expect(checkoutModel.normalizeAmountInMinorUnits("bad", 450)).toBe(450);
        expect(checkoutModel.normalizeAmountInMinorUnits("bad")).toBe(0);
        expect(checkoutModel.amountToMinorUnits(12.34)).toBe(1234);

        expect(checkoutModel.normalizeTimestampValue("t-1")).toBe("t-1");
        expect(checkoutModel.normalizeTimestampValue(null, "fallback")).toBe("fallback");
        expect(checkoutModel.normalizeTimestampValue(undefined)).toBe(null);

        const metadata = { source: "cart" };
        const normalizedMetadata = checkoutModel.normalizeMetadata(metadata);
        expect(normalizedMetadata).toEqual(metadata);
        expect(normalizedMetadata).not.toBe(metadata);
        expect(checkoutModel.normalizeMetadata(null)).toEqual({});
        expect(checkoutModel.normalizeMetadata(["bad"])).toEqual({});
    });

    test("resolves checkout status dependencies", () => {
        expect(checkoutModel.resolveCheckoutStatus(checkoutStatus)).toBe(checkoutStatus);

        const originalGlobalCheckoutStatus = global.checkoutStatus;

        try {
            global.checkoutStatus = checkoutStatus;
            expect(checkoutModel.resolveCheckoutStatus()).toBe(checkoutStatus);
        } finally {
            if (originalGlobalCheckoutStatus === undefined) {
                delete global.checkoutStatus;
            } else {
                global.checkoutStatus = originalGlobalCheckoutStatus;
            }
        }
    });

    test("resolves checkout status through require when no explicit or global dependency exists", () => {
        jest.isolateModules(() => {
            const originalWindow = global.window;
            const originalCheckoutStatus = global.checkoutStatus;

            try {
                delete global.window;
                delete global.checkoutStatus;

                const isolatedModel = require("../../../public/shared/checkout/checkout-model.js");

                expect(isolatedModel.resolveCheckoutStatus().MODULE_NAME).toBe("checkout-status");
            } finally {
                if (originalWindow === undefined) {
                    delete global.window;
                } else {
                    global.window = originalWindow;
                }

                if (originalCheckoutStatus === undefined) {
                    delete global.checkoutStatus;
                } else {
                    global.checkoutStatus = originalCheckoutStatus;
                }
            }
        });
    });

    test("creates customer and vendor snapshots", () => {
        expect(checkoutModel.createCustomerSnapshot({
            uid: " customer-1 ",
            displayName: " Naledi ",
            email: " NALEDI@EXAMPLE.COM "
        })).toEqual({
            customerUid: "customer-1",
            customerName: "Naledi",
            customerEmail: "naledi@example.com"
        });

        expect(checkoutModel.createCustomerSnapshot(null)).toEqual({
            customerUid: "",
            customerName: "Customer",
            customerEmail: ""
        });

        expect(checkoutModel.createVendorSnapshot({
            uid: " vendor-1 ",
            shopName: " Campus Bites "
        })).toEqual({
            vendorUid: "vendor-1",
            vendorName: "Campus Bites"
        });

        expect(checkoutModel.createVendorSnapshot(null)).toEqual({
            vendorUid: "",
            vendorName: "Unknown Vendor"
        });
    });

    test("normalizes checkout items and calculates totals", () => {
        const item = checkoutModel.normalizeCheckoutItem({
            productId: " burger-1 ",
            vendorUid: " vendor-1 ",
            vendorName: " Campus Bites ",
            itemName: " Burger ",
            category: " Meals ",
            dietaryTags: " Halal, Gluten Free, halal ",
            allergenTags: [" Gluten ", "Dairy", "gluten"],
            price: "49.995",
            quantity: "2",
            imageUrl: " https://example.test/burger.jpg ",
            note: " No onions "
        });

        expect(item).toEqual({
            menuItemId: "burger-1",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            name: "Burger",
            category: "Meals",
            dietary: ["halal", "gluten free"],
            allergens: ["gluten", "dairy"],
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
            lineTotal: 100,
            lineCustomerTotal: 100,
            photoURL: "https://example.test/burger.jpg",
            notes: "No onions",
            itemKey: "vendor-1::burger-1"
        });

        expect(checkoutModel.normalizeCheckoutItem(null, 3)).toEqual({
            menuItemId: "item-4",
            vendorUid: "",
            vendorName: "Unknown Vendor",
            name: "Unknown Item",
            category: "Other",
            dietary: [],
            allergens: [],
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
            lineTotal: 0,
            lineCustomerTotal: 0,
            photoURL: "",
            notes: "",
            itemKey: "vendor::item-4"
        });

        expect(checkoutModel.normalizeCheckoutItem({
            id: "priced",
            vendorPrice: 100,
            platformFee: 10,
            customerPrice: 110,
            price: 110
        })).toEqual(expect.objectContaining({
            vendorPrice: 100,
            platformFee: 10,
            customerPrice: 110,
            price: 110,
            lineTotal: 110
        }));

        expect(checkoutModel.normalizeCheckoutItem({
            id: "vendor-priced",
            vendorPrice: 100,
            quantity: 2
        })).toEqual(expect.objectContaining({
            vendorPrice: 100,
            platformFee: 10,
            customerPrice: 110,
            price: 110,
            vendorSubtotal: 200,
            platformFeeTotal: 20,
            lineTotal: 220
        }));

        const items = checkoutModel.normalizeCheckoutItems([
            item,
            { id: "chips", vendorUid: "vendor-1", name: "Chips", price: 15, quantity: 3 }
        ]);

        expect(items).toHaveLength(2);
        expect(checkoutModel.normalizeCheckoutItems(null)).toEqual([]);
        expect(checkoutModel.calculateCheckoutItemCount(items)).toBe(5);
        expect(checkoutModel.calculateCheckoutVendorSubtotal(items)).toBeCloseTo(131.82);
        expect(checkoutModel.calculateCheckoutPlatformFee(items)).toBeCloseTo(13.18);
        expect(checkoutModel.calculateCheckoutSubtotal(items)).toBe(145);
    });

    test("creates checkout timeline entries with status labels", () => {
        expect(checkoutModel.createCheckoutTimelineEntry("awaiting payment", {
            actorRole: "Customer",
            actorUid: "customer-1",
            actorName: "Naledi",
            note: " Started payment ",
            at: "t-1"
        }, checkoutStatus)).toEqual({
            status: "payment_pending",
            label: "Payment Pending",
            actorRole: "customer",
            actorUid: "customer-1",
            actorName: "Naledi",
            note: "Started payment",
            at: "t-1"
        });

        expect(checkoutModel.createCheckoutTimelineEntry("", {
            timestamp: "t-2"
        })).toEqual(expect.objectContaining({
            status: "draft",
            label: "Checkout Draft",
            actorRole: "system",
            at: "t-2"
        }));
    });

    test("creates a normalized default checkout session record", () => {
        const record = checkoutModel.createCheckoutSessionRecord({}, {
            checkoutStatus,
            createdAt: "t-created"
        });

        expect(record).toEqual({
            checkoutId: "",
            customerUid: "",
            customerName: "Customer",
            customerEmail: "",
            vendorUid: "",
            vendorName: "Unknown Vendor",
            items: [],
            itemCount: 0,
            subtotal: 0,
            total: 0,
            vendorSubtotal: 0,
            vendorEarnings: 0,
            platformFeeRate: 0.1,
            platformFee: 0,
            platformEarnings: 0,
            customerTotal: 0,
            financeModel: "vendor-price-plus-platform-fee",
            status: "draft",
            paymentProvider: "paystack",
            paymentReference: "",
            paymentAccessCode: "",
            paymentAuthorizationUrl: "",
            paymentAmount: 0,
            paymentAmountInMinorUnits: 0,
            paymentCurrency: "ZAR",
            paymentPaidAt: null,
            paymentFailedAt: null,
            paymentVerifiedAt: null,
            paymentFailureReason: "",
            convertedOrderId: "",
            convertedAt: null,
            cancelledAt: null,
            expiredAt: null,
            metadata: {},
            timeline: [
                {
                    status: "draft",
                    label: "Checkout Draft",
                    actorRole: "customer",
                    actorUid: "",
                    actorName: "Customer",
                    note: "",
                    at: "t-created"
                }
            ],
            notes: "",
            createdAt: "t-created",
            updatedAt: "t-created"
        });
    });

    test("creates a normalized checkout session from messy values", () => {
        const record = checkoutModel.createCheckoutSessionRecord({
            sessionId: " checkout-1 ",
            uid: " customer-1 ",
            name: " Naledi ",
            email: " NALEDI@EXAMPLE.COM ",
            vendorUid: " vendor-1 ",
            shopName: " Campus Bites ",
            cartItems: [
                { id: "burger", vendorUid: "vendor-1", vendorName: "Campus Bites", name: "Burger", price: 45.5, quantity: 2 }
            ],
            checkoutStatus: "awaiting verification",
            paymentProvider: " PayStack ",
            paymentReference: " ref-1 ",
            paystackAccessCode: " access-1 ",
            paymentURL: " https://paystack.test/pay ",
            paymentAmount: "91",
            paymentCurrency: " zar ",
            paymentPaidAt: "t-paid",
            verifiedAt: "t-verified",
            paymentErrorMessage: " none ",
            convertedOrderId: " order-1 ",
            convertedAt: "t-converted",
            cancelledAt: undefined,
            expiredAt: "t-expired",
            metadata: { source: "checkout" },
            notes: " Please hurry ",
            createdAt: "t-created"
        }, {
            checkoutStatus
        });

        expect(record).toEqual(expect.objectContaining({
            checkoutId: "checkout-1",
            customerUid: "customer-1",
            customerName: "Naledi",
            customerEmail: "naledi@example.com",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            itemCount: 2,
            subtotal: 91,
            total: 91,
            vendorSubtotal: 82.72,
            vendorEarnings: 82.72,
            platformFee: 8.28,
            platformEarnings: 8.28,
            customerTotal: 91,
            status: "payment_pending",
            paymentProvider: "paystack",
            paymentReference: "ref-1",
            paymentAccessCode: "access-1",
            paymentAuthorizationUrl: "https://paystack.test/pay",
            paymentAmount: 91,
            paymentAmountInMinorUnits: 9100,
            paymentCurrency: "ZAR",
            paymentPaidAt: "t-paid",
            paymentFailedAt: null,
            paymentVerifiedAt: "t-verified",
            paymentFailureReason: "none",
            convertedOrderId: "order-1",
            convertedAt: "t-converted",
            cancelledAt: null,
            expiredAt: "t-expired",
            metadata: { source: "checkout" },
            notes: "Please hurry",
            createdAt: "t-created",
            updatedAt: "t-created"
        }));
        expect(record.items).toEqual([
            expect.objectContaining({
                menuItemId: "burger",
                vendorPrice: 41.36,
                platformFee: 4.14,
                customerPrice: 45.5,
                lineTotal: 91
            })
        ]);
        expect(record.timeline[0]).toEqual(expect.objectContaining({
            status: "payment_pending",
            label: "Payment Pending",
            actorRole: "customer",
            actorUid: "customer-1",
            actorName: "Naledi"
        }));
    });

    test("honours explicit totals and minor-unit payment amount", () => {
        const record = checkoutModel.createCheckoutSessionRecord({
            items: [
                { id: "item-1", price: 100, quantity: 2 }
            ],
            subtotal: "150.239",
            total: "160.239",
            paymentAmountInMinorUnits: "16024",
            paymentAmount: "160.239"
        });

        expect(record.subtotal).toBe(150.24);
        expect(record.total).toBe(160.24);
        expect(record.paymentAmount).toBe(160.24);
        expect(record.paymentAmountInMinorUnits).toBe(16024);
    });

    test("preserves dietary and allergen tags from cart items into sessions and order drafts", () => {
        const session = checkoutModel.createCheckoutSessionFromCart([
            {
                id: "wrap",
                vendorUid: "vendor-1",
                vendorName: "Campus Bites",
                name: "Chicken Wrap",
                price: 65,
                quantity: 1,
                dietaryTags: " Halal, High Protein, halal ",
                allergenTags: [" Gluten ", "Dairy", "gluten"]
            },
            {
                id: "salad",
                vendorUid: "vendor-2",
                vendorName: "Green Bowl",
                name: "Garden Salad",
                price: 40,
                quantity: 1,
                dietary: [" Vegan ", "gluten free"],
                allergens: "nuts"
            }
        ], {
            uid: "customer-1",
            displayName: "Naledi"
        }, {
            checkoutStatus,
            vendorUid: "vendor-1"
        });

        expect(session.items).toHaveLength(1);
        expect(session.items[0]).toEqual(expect.objectContaining({
            menuItemId: "wrap",
            dietary: ["halal", "high protein"],
            allergens: ["gluten", "dairy"]
        }));

        const orderDraft = checkoutModel.createOrderDraftFromCheckout(session, {
            orderId: "order-1"
        });

        expect(orderDraft.items[0]).toEqual(expect.objectContaining({
            menuItemId: "wrap",
            dietary: ["halal", "high protein"],
            allergens: ["gluten", "dairy"]
        }));
    });

    test("accepts alternate field names and nested customer/vendor values", () => {
        const record = checkoutModel.createCheckoutSessionRecord({
            id: "checkout-alt",
            customer: {
                customerUid: "customer-alt",
                customerName: "Alt Customer",
                customerEmail: "ALT@EXAMPLE.COM"
            },
            vendor: {
                vendorUid: "vendor-alt",
                vendorName: "Alt Vendor"
            },
            items: [
                {
                    itemId: "item-alt",
                    vendorUid: "vendor-alt",
                    unitPrice: "12.345",
                    quantity: "bad",
                    photoURL: "https://example.test/item.jpg",
                    notes: "Alt note"
                }
            ],
            status: "failed",
            provider: "CustomPay",
            reference: "ref-alt",
            accessCode: "access-alt",
            authorizationURL: "https://pay.test/alt",
            currency: "usd",
            paidAt: "t-paid",
            failedAt: "t-failed",
            failureReason: "Alt failure",
            orderId: "order-alt",
            canceledAt: "t-cancelled",
            note: "Alt checkout note",
            updatedAt: "t-updated"
        }, {
            checkoutStatus,
            createdAt: "t-created"
        });

        expect(record).toEqual(expect.objectContaining({
            checkoutId: "checkout-alt",
            customerUid: "customer-alt",
            customerName: "Alt Customer",
            customerEmail: "alt@example.com",
            vendorUid: "vendor-alt",
            vendorName: "Alt Vendor",
            status: "payment_failed",
            paymentProvider: "custompay",
            paymentReference: "ref-alt",
            paymentAccessCode: "access-alt",
            paymentAuthorizationUrl: "https://pay.test/alt",
            paymentAmount: 12.35,
            paymentAmountInMinorUnits: 1235,
            paymentCurrency: "USD",
            paymentPaidAt: "t-paid",
            paymentFailedAt: "t-failed",
            paymentFailureReason: "Alt failure",
            convertedOrderId: "order-alt",
            cancelledAt: "t-cancelled",
            notes: "Alt checkout note",
            subtotal: 12.35,
            total: 12.35,
            vendorSubtotal: 11.23,
            vendorEarnings: 11.23,
            platformFee: 1.12,
            platformEarnings: 1.12,
            customerTotal: 12.35,
            createdAt: "t-created",
            updatedAt: "t-updated"
        }));
        expect(record.items[0]).toEqual(expect.objectContaining({
            menuItemId: "item-alt",
            vendorPrice: 11.23,
            platformFee: 1.12,
            customerPrice: 12.35,
            price: 12.35,
            quantity: 1,
            lineTotal: 12.35
        }));
    });

    test("normalizes provided checkout timeline entries", () => {
        const record = checkoutModel.createCheckoutSessionRecord({
            status: "paid",
            timeline: [
                {
                    status: "draft",
                    actorRole: "customer",
                    note: "Created",
                    timestamp: "t-1"
                },
                {
                    status: "payment verified",
                    actorRole: "system",
                    note: "Verified",
                    at: "t-2"
                }
            ]
        }, {
            checkoutStatus
        });

        expect(record.timeline).toEqual([
            expect.objectContaining({
                status: "draft",
                label: "Checkout Draft",
                note: "Created",
                at: "t-1"
            }),
            expect.objectContaining({
                status: "paid",
                label: "Payment Verified",
                note: "Verified",
                at: "t-2"
            })
        ]);
    });

    test("normalizes checkout session records through an alias", () => {
        expect(checkoutModel.normalizeCheckoutSessionRecord({
            status: "payment failed",
            items: [
                { id: "item-1", price: 10, quantity: 2 }
            ]
        }, {
            checkoutStatus
        })).toEqual(expect.objectContaining({
            status: "payment_failed",
            itemCount: 2,
            vendorSubtotal: 18.18,
            platformFee: 1.82,
            total: 20
        }));
    });

    test("creates a checkout session from cart items for one vendor", () => {
        const session = checkoutModel.createCheckoutSessionFromCart([
            { id: "burger", vendorUid: "vendor-1", vendorName: "Campus Bites", name: "Burger", price: 50, quantity: 1 },
            { id: "chips", vendorUid: "vendor-1", vendorName: "Campus Bites", name: "Chips", price: 15, quantity: 2 },
            { id: "coffee", vendorUid: "vendor-2", vendorName: "Coffee Bar", name: "Coffee", price: 20, quantity: 1 }
        ], {
            uid: "customer-1",
            displayName: "Naledi",
            email: "naledi@example.com"
        }, {
            checkoutStatus,
            vendorUid: "vendor-1",
            createdAt: "t-created"
        });

        expect(session).toEqual(expect.objectContaining({
            customerUid: "customer-1",
            customerName: "Naledi",
            customerEmail: "naledi@example.com",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            itemCount: 3,
            subtotal: 80,
            total: 80,
            vendorSubtotal: 72.73,
            vendorEarnings: 72.73,
            platformFee: 7.27,
            platformEarnings: 7.27,
            customerTotal: 80,
            createdAt: "t-created"
        }));
        expect(session.items.map((item) => item.menuItemId)).toEqual(["burger", "chips"]);
    });

    test("creates a checkout session from cart items without a requested vendor", () => {
        const session = checkoutModel.createCheckoutSessionFromCart([
            { id: "coffee", vendorUid: "vendor-2", vendorName: "Coffee Bar", name: "Coffee", price: 20, quantity: 1 }
        ], {
            customerUid: "customer-2",
            customerName: "Sam"
        }, {
            checkoutStatus,
            vendorName: "Override Vendor"
        });

        expect(session.vendorUid).toBe("vendor-2");
        expect(session.vendorName).toBe("Override Vendor");
        expect(session.customerUid).toBe("customer-2");
        expect(session.customerName).toBe("Sam");
        expect(session.vendorSubtotal).toBe(18.18);
        expect(session.platformFee).toBe(1.82);
        expect(session.total).toBe(20);
    });

    test("creates checkout payment patches", () => {
        expect(checkoutModel.createCheckoutPaymentPatch({
            status: "payment verified",
            paymentProvider: "paystack",
            paymentReference: "ref-1",
            paymentAccessCode: "access-1",
            paymentAuthorizationUrl: "https://paystack.test/pay",
            paymentAmount: 75.5,
            paymentCurrency: "ZAR",
            paymentPaidAt: "t-paid",
            paymentVerifiedAt: "t-verified",
            updatedAt: "t-updated"
        })).toEqual({
            status: "paid",
            paymentProvider: "paystack",
            paymentReference: "ref-1",
            paymentAccessCode: "access-1",
            paymentAuthorizationUrl: "https://paystack.test/pay",
            paymentAmount: 75.5,
            paymentAmountInMinorUnits: 7550,
            paymentCurrency: "ZAR",
            paymentPaidAt: "t-paid",
            paymentFailedAt: null,
            paymentVerifiedAt: "t-verified",
            paymentFailureReason: "",
            updatedAt: "t-updated"
        });
    });

    test("creates an order draft from a paid checkout session", () => {
        const orderDraft = checkoutModel.createOrderDraftFromCheckout({
            checkoutId: "checkout-1",
            customerUid: "customer-1",
            customerName: "Naledi",
            customerEmail: "naledi@example.com",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            items: [
                { id: "burger", vendorUid: "vendor-1", name: "Burger", price: 55, quantity: 1 }
            ],
            status: "paid",
            paymentReference: "ref-1",
            paymentPaidAt: "t-paid",
            paymentVerifiedAt: "t-verified",
            notes: "No onions",
            createdAt: "t-created",
            updatedAt: "t-updated"
        }, {
            orderId: "order-1"
        });

        expect(orderDraft).toEqual({
            orderId: "order-1",
            checkoutId: "checkout-1",
            customerUid: "customer-1",
            customerName: "Naledi",
            customerEmail: "naledi@example.com",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            items: [
                {
                    basePrice: 50,
                    category: "Other",
                    customerPrice: 55,
                    dietary: [],
                    allergens: [],
                    itemKey: "vendor-1::burger",
                    lineCustomerTotal: 55,
                    linePlatformFee: 5,
                    lineTotal: 55,
                    lineVendorSubtotal: 50,
                    menuItemId: "burger",
                    name: "Burger",
                    notes: "",
                    photoURL: "",
                    platformFee: 5,
                    platformFeeRate: 0.1,
                    platformFeeTotal: 5,
                    price: 55,
                    quantity: 1,
                    vendorName: "Unknown Vendor",
                    vendorPrice: 50,
                    vendorSubtotal: 50,
                    vendorUid: "vendor-1"
                }
            ],
            itemCount: 1,
            subtotal: 55,
            total: 55,
            totalAmount: 55,
            vendorSubtotal: 50,
            vendorEarnings: 50,
            platformFeeRate: 0.1,
            platformFee: 5,
            platformEarnings: 5,
            customerTotal: 55,
            financeModel: "vendor-price-plus-platform-fee",
            status: "pending",
            paymentStatus: "paid",
            paymentProvider: "paystack",
            paymentReference: "ref-1",
            paymentAccessCode: "",
            paymentAuthorizationUrl: "",
            paymentAmount: 55,
            paymentAmountInMinorUnits: 5500,
            paymentCurrency: "ZAR",
            paymentPaidAt: "t-paid",
            paymentFailedAt: null,
            paymentVerifiedAt: "t-verified",
            paymentFailureReason: "",
            notes: "No onions",
            createdAt: "t-created",
            updatedAt: "t-updated"
        });
    });

    test("handles null option objects and empty conversion helpers safely", () => {
        expect(checkoutModel.createCheckoutTimelineEntry("draft", null, checkoutStatus))
            .toEqual(expect.objectContaining({
                status: "draft",
                actorRole: "system",
                actorUid: "",
                at: null
            }));

        expect(checkoutModel.createCheckoutSessionRecord(null, null))
            .toEqual(expect.objectContaining({
                checkoutId: "",
                status: "draft",
                itemCount: 0,
                total: 0
            }));

        expect(checkoutModel.createCheckoutSessionFromCart(null, null, null))
            .toEqual(expect.objectContaining({
                vendorUid: "",
                vendorName: "Unknown Vendor",
                itemCount: 0,
                total: 0
            }));

        expect(checkoutModel.createCheckoutPaymentPatch()).toEqual(expect.objectContaining({
            status: "draft",
            paymentProvider: "paystack",
            paymentAmount: 0,
            updatedAt: null
        }));

        expect(checkoutModel.createOrderDraftFromCheckout()).toEqual(expect.objectContaining({
            orderId: "",
            checkoutId: "",
            status: "pending",
            paymentStatus: "paid",
            total: 0
        }));
    });

    test("attaches the module to a browser-like global scope", () => {
        jest.isolateModules(() => {
            const originalWindow = global.window;

            try {
                global.window = {
                    checkoutStatus
                };
                require("../../../public/shared/checkout/checkout-model.js");

                expect(global.window.checkoutModel).toBeDefined();
                expect(global.window.checkoutModel.createCheckoutSessionRecord({
                    status: "order-created"
                }).status).toBe("converted");
            } finally {
                if (originalWindow === undefined) {
                    delete global.window;
                } else {
                    global.window = originalWindow;
                }
            }
        });
    });
});
