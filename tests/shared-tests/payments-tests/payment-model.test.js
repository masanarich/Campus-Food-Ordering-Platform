const paymentModel = require("../../../public/shared/payments/payment-model.js");
const paymentStatus = require("../../../public/shared/payments/payment-status.js");

describe("shared/payments/payment-model.js", () => {
    test("exports constants and utility helpers", () => {
        expect(paymentModel.MODULE_NAME).toBe("payment-model");
        expect(paymentModel.DEFAULT_PROVIDER).toBe("paystack");
        expect(paymentModel.DEFAULT_CURRENCY).toBe("ZAR");

        expect(paymentModel.normalizeText("  ref-1  ")).toBe("ref-1");
        expect(paymentModel.normalizeText(null)).toBe("");
        expect(paymentModel.normalizeLowerText(" PAYSTACK ")).toBe("paystack");
        expect(paymentModel.normalizeUpperText(" zar ")).toBe("ZAR");
        expect(paymentModel.normalizeProvider(" PayStack ")).toBe("paystack");
        expect(paymentModel.normalizeProvider("", "custom")).toBe("custom");
        expect(paymentModel.normalizeCurrency(" usd ")).toBe("USD");
        expect(paymentModel.normalizeCurrency("", "zar")).toBe("ZAR");
    });

    test("normalizes currency amounts and minor units", () => {
        expect(paymentModel.normalizeCurrencyAmount("12.349")).toBe(12.35);
        expect(paymentModel.normalizeCurrencyAmount("-4")).toBe(0);
        expect(paymentModel.normalizeCurrencyAmount("bad", 8.239)).toBe(8.24);
        expect(paymentModel.normalizeCurrencyAmount("bad")).toBe(0);

        expect(paymentModel.normalizeAmountInMinorUnits("1234")).toBe(1234);
        expect(paymentModel.normalizeAmountInMinorUnits("-20")).toBe(0);
        expect(paymentModel.normalizeAmountInMinorUnits("bad", 450)).toBe(450);
        expect(paymentModel.normalizeAmountInMinorUnits("bad")).toBe(0);

        expect(paymentModel.amountToMinorUnits(12.34)).toBe(1234);
        expect(paymentModel.amountFromMinorUnits(1234)).toBe(12.34);
    });

    test("normalizes timestamps and metadata", () => {
        expect(paymentModel.normalizeTimestampValue("t-1")).toBe("t-1");
        expect(paymentModel.normalizeTimestampValue(null, "fallback")).toBe("fallback");
        expect(paymentModel.normalizeTimestampValue(undefined)).toBe(null);

        const metadata = { orderId: "order-1" };
        const normalizedMetadata = paymentModel.normalizeMetadata(metadata);

        expect(normalizedMetadata).toEqual(metadata);
        expect(normalizedMetadata).not.toBe(metadata);
        expect(paymentModel.normalizeMetadata(null)).toEqual({});
        expect(paymentModel.normalizeMetadata(["bad"])).toEqual({});
    });

    test("resolves payment status dependencies", () => {
        expect(paymentModel.resolvePaymentStatus(paymentStatus)).toBe(paymentStatus);

        const originalGlobalPaymentStatus = global.paymentStatus;

        try {
            global.paymentStatus = paymentStatus;
            expect(paymentModel.resolvePaymentStatus()).toBe(paymentStatus);
        } finally {
            if (originalGlobalPaymentStatus === undefined) {
                delete global.paymentStatus;
            } else {
                global.paymentStatus = originalGlobalPaymentStatus;
            }
        }
    });

    test("creates payment timeline entries", () => {
        expect(paymentModel.createPaymentTimelineEntry("success", {
            provider: " PayStack ",
            reference: " ref-1 ",
            actorRole: "Customer",
            actorUid: "customer-1",
            actorName: "Tshepo",
            note: " Paid online ",
            at: "t-1"
        }, paymentStatus)).toEqual({
            status: "paid",
            label: "Paid",
            provider: "paystack",
            reference: "ref-1",
            actorRole: "customer",
            actorUid: "customer-1",
            actorName: "Tshepo",
            note: "Paid online",
            at: "t-1"
        });
    });

    test("creates a normalized default payment record", () => {
        const record = paymentModel.createPaymentRecord({}, {
            paymentStatus,
            createdAt: "t-created"
        });

        expect(record).toEqual({
            paymentId: "",
            orderId: "",
            customerUid: "",
            customerEmail: "",
            vendorUid: "",
            provider: "paystack",
            status: "unpaid",
            reference: "",
            accessCode: "",
            authorizationUrl: "",
            amount: 0,
            amountInMinorUnits: 0,
            currency: "ZAR",
            paidAt: null,
            failedAt: null,
            verifiedAt: null,
            failureReason: "",
            metadata: {},
            timeline: [
                {
                    status: "unpaid",
                    label: "Unpaid",
                    provider: "paystack",
                    reference: "",
                    actorRole: "system",
                    actorUid: "",
                    actorName: "",
                    note: "",
                    at: "t-created"
                }
            ],
            createdAt: "t-created",
            updatedAt: "t-created"
        });
    });

    test("creates a normalized Paystack payment record from messy values", () => {
        const record = paymentModel.createPaymentRecord({
            id: " payment-1 ",
            orderId: " order-1 ",
            userUid: " customer-1 ",
            email: " TSHEPO@EXAMPLE.COM ",
            vendorUid: " vendor-1 ",
            paymentProvider: " PayStack ",
            paymentStatus: "awaiting verification",
            paymentReference: " ref-123 ",
            paystackAccessCode: " access-code ",
            paymentURL: " https://paystack.test/pay ",
            amount: "123.456",
            currency: " zar ",
            paidAt: "t-paid",
            failedAt: undefined,
            verifiedAt: "t-verified",
            errorMessage: " none ",
            metadata: {
                cartId: "cart-1"
            },
            createdAt: "t-created"
        }, {
            paymentStatus
        });

        expect(record).toEqual(expect.objectContaining({
            paymentId: "payment-1",
            orderId: "order-1",
            customerUid: "customer-1",
            customerEmail: "tshepo@example.com",
            vendorUid: "vendor-1",
            provider: "paystack",
            status: "pending",
            reference: "ref-123",
            accessCode: "access-code",
            authorizationUrl: "https://paystack.test/pay",
            amount: 123.46,
            amountInMinorUnits: 12346,
            currency: "ZAR",
            paidAt: "t-paid",
            failedAt: null,
            verifiedAt: "t-verified",
            failureReason: "none",
            metadata: {
                cartId: "cart-1"
            },
            createdAt: "t-created",
            updatedAt: "t-created"
        }));
        expect(record.timeline).toHaveLength(1);
        expect(record.timeline[0]).toEqual(expect.objectContaining({
            status: "pending",
            label: "Payment Pending",
            provider: "paystack",
            reference: "ref-123"
        }));
    });

    test("uses minor-unit amount when no decimal amount is supplied", () => {
        const record = paymentModel.createPaymentRecord({
            amountInMinorUnits: 9999
        });

        expect(record.amount).toBe(99.99);
        expect(record.amountInMinorUnits).toBe(9999);
    });

    test("normalizes provided payment timeline entries", () => {
        const record = paymentModel.createPaymentRecord({
            status: "paid",
            reference: "ref-1",
            timeline: [
                {
                    status: "pending",
                    reference: "ref-1",
                    actorRole: "customer",
                    note: "Started",
                    timestamp: "t-1"
                },
                {
                    status: "success",
                    note: "Verified",
                    at: "t-2"
                }
            ]
        }, {
            paymentStatus
        });

        expect(record.timeline).toEqual([
            expect.objectContaining({
                status: "pending",
                label: "Payment Pending",
                reference: "ref-1",
                note: "Started",
                at: "t-1"
            }),
            expect.objectContaining({
                status: "paid",
                label: "Paid",
                reference: "ref-1",
                note: "Verified",
                at: "t-2"
            })
        ]);
    });

    test("normalizes payment records through an alias", () => {
        expect(paymentModel.normalizePaymentRecord({
            status: "successful",
            amount: 25
        }, {
            paymentStatus
        })).toEqual(expect.objectContaining({
            status: "paid",
            amount: 25,
            amountInMinorUnits: 2500
        }));
    });

    test("creates payment records from orders", () => {
        const record = paymentModel.createPaymentRecordFromOrder({
            orderId: "order-1",
            customerUid: "customer-1",
            customerName: "Tshepo",
            customerEmail: "tshepo@example.com",
            vendorUid: "vendor-1",
            total: 75.5
        }, {
            paymentStatus,
            status: "pending",
            reference: "ref-1",
            createdAt: "t-1",
            metadata: {
                source: "checkout"
            }
        });

        expect(record).toEqual(expect.objectContaining({
            orderId: "order-1",
            customerUid: "customer-1",
            customerEmail: "tshepo@example.com",
            vendorUid: "vendor-1",
            provider: "paystack",
            status: "pending",
            reference: "ref-1",
            amount: 75.5,
            amountInMinorUnits: 7550,
            currency: "ZAR",
            metadata: {
                orderId: "order-1",
                customerUid: "customer-1",
                vendorUid: "vendor-1",
                source: "checkout"
            },
            createdAt: "t-1"
        }));
        expect(record.timeline[0]).toEqual(expect.objectContaining({
            actorRole: "customer",
            actorUid: "customer-1",
            actorName: "Tshepo"
        }));
    });

    test("creates order payment patches", () => {
        expect(paymentModel.createPaymentPatch({
            paymentId: "payment-1",
            status: "paid",
            provider: "paystack",
            reference: "ref-1",
            accessCode: "access-1",
            authorizationUrl: "https://paystack.test/pay",
            amount: 10,
            currency: "ZAR",
            paidAt: "t-paid",
            verifiedAt: "t-verified"
        })).toEqual({
            paymentId: "payment-1",
            paymentStatus: "paid",
            paymentProvider: "paystack",
            paymentReference: "ref-1",
            paymentAccessCode: "access-1",
            paymentAuthorizationUrl: "https://paystack.test/pay",
            paymentAmount: 10,
            paymentAmountInMinorUnits: 1000,
            paymentCurrency: "ZAR",
            paymentPaidAt: "t-paid",
            paymentFailedAt: null,
            paymentVerifiedAt: "t-verified",
            paymentFailureReason: ""
        });
    });

    test("attaches the module to a browser-like global scope", () => {
        jest.isolateModules(() => {
            const originalWindow = global.window;

            try {
                global.window = {
                    paymentStatus
                };
                require("../../../public/shared/payments/payment-model.js");

                expect(global.window.paymentModel).toBeDefined();
                expect(global.window.paymentModel.createPaymentRecord({
                    status: "success"
                }).status).toBe("paid");
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
