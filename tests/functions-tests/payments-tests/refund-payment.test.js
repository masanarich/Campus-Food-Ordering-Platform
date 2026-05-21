const refundPayment = require("../../../functions/payments/refund-payment.js");

function createPaidPayment(overrides = {}) {
    return {
        paymentId: "payment-1",
        orderId: "order-1",
        checkoutId: "checkout-1",
        customerUid: "customer-1",
        vendorUid: "vendor-1",
        status: "paid",
        provider: "paystack",
        reference: "paystack-ref",
        amount: 75,
        amountInMinorUnits: 7500,
        currency: "ZAR",
        metadata: {
            source: "test"
        },
        ...overrides
    };
}

describe("functions/payments/refund-payment.js", () => {
    test("exports helpers and normalizes primitive values", () => {
        expect(refundPayment.MODULE_NAME).toBe("refund-payment");
        expect(refundPayment.DEFAULT_PROVIDER).toBe("paystack");
        expect(refundPayment.DEFAULT_CURRENCY).toBe("ZAR");
        expect(refundPayment.normalizeText("  hello  ")).toBe("hello");
        expect(refundPayment.normalizeLowerText(" PAID ")).toBe("paid");
        expect(refundPayment.normalizeUpperText(" zar ")).toBe("ZAR");
        expect(refundPayment.normalizeCurrencyAmount("10.235")).toBe(10.24);
        expect(refundPayment.normalizeCurrencyAmount(null, "5.5")).toBe(5.5);
        expect(refundPayment.normalizeCurrencyAmount()).toBe(0);
        expect(refundPayment.normalizeAmountInMinorUnits("-5")).toBe(0);
        expect(refundPayment.normalizeAmountInMinorUnits(null, "250")).toBe(250);
        expect(refundPayment.normalizeAmountInMinorUnits()).toBe(0);
        expect(refundPayment.amountToMinorUnits("12.34")).toBe(1234);
        expect(refundPayment.createRefundResult(true, { value: 1 })).toEqual({
            success: true,
            provider: "paystack",
            value: 1
        });
        expect(refundPayment.createRefundError(" code ", " Message ", { detail: true })).toEqual({
            code: "code",
            message: "Message",
            detail: true
        });
    });

    test("resolves timestamps, references, status, reason, currency, and refund amount", () => {
        expect(refundPayment.resolveTimestampValue({ timestampValue: "manual-time" })).toBe("manual-time");
        expect(refundPayment.resolveTimestampValue({ nowFactory: () => "factory-time" })).toBe("factory-time");
        expect(refundPayment.resolveTimestampValue({ now: "now-time" })).toBe("now-time");
        expect(refundPayment.resolveTimestampValue()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(refundPayment.resolvePaymentReference({}, { reference: " ref-1 " })).toBe("ref-1");
        expect(refundPayment.resolvePaymentReference({ paymentReference: " payment-ref " })).toBe("payment-ref");
        expect(refundPayment.resolvePaymentStatus({ paymentStatus: " PAID " })).toBe("paid");
        expect(refundPayment.resolveRefundReason({}, { reason: " vendor rejected " })).toBe("vendor rejected");
        expect(refundPayment.resolveRefundReason({ refundReason: " stale order " })).toBe("stale order");
        expect(refundPayment.resolveRefundCurrency({}, { currency: " zar " })).toBe("ZAR");
        expect(refundPayment.resolveRefundAmountInMinorUnits({}, { amountInMinorUnits: "500" })).toBe(500);
        expect(refundPayment.resolveRefundAmountInMinorUnits({}, { amount: "5.25" })).toBe(525);
        expect(refundPayment.resolveRefundAmountInMinorUnits({ paymentAmountInMinorUnits: "700" })).toBe(700);
        expect(refundPayment.resolveRefundAmountInMinorUnits({ paymentAmount: "7.5" })).toBe(750);
    });

    test("normalizes Paystack refund responses", () => {
        expect(refundPayment.normalizePaystackRefundData({
            data: {
                id: 123,
                reference: " refund-ref ",
                transaction: {
                    reference: "paystack-ref",
                    currency: "zar"
                },
                amount: "7500",
                status: " processed ",
                created_at: "created-time"
            }
        })).toEqual({
            refundId: "123",
            refundReference: "refund-ref",
            paymentReference: "paystack-ref",
            status: "processed",
            amount: 75,
            amountInMinorUnits: 7500,
            currency: "ZAR",
            refundedAt: "created-time",
            raw: {
                data: {
                    id: 123,
                    reference: " refund-ref ",
                    transaction: {
                        reference: "paystack-ref",
                        currency: "zar"
                    },
                    amount: "7500",
                    status: " processed ",
                    created_at: "created-time"
                }
            }
        });

        expect(refundPayment.normalizePaystackRefundData({
            refundId: "refund-1",
            transaction_reference: "paystack-ref"
        })).toEqual(expect.objectContaining({
            refundId: "refund-1",
            paymentReference: "paystack-ref",
            status: "pending",
            amount: 0,
            currency: "ZAR"
        }));
    });

    test("builds refund payloads and validates refund input", () => {
        const payload = refundPayment.buildRefundPayload(createPaidPayment(), {
            refundAmount: 25,
            reason: "Vendor rejected the order.",
            customerNote: "Your order was rejected.",
            metadata: {
                rejectionCode: "vendor_busy"
            }
        });

        expect(payload).toEqual({
            transaction: "paystack-ref",
            amount: 2500,
            currency: "ZAR",
            merchant_note: "Vendor rejected the order.",
            customer_note: "Your order was rejected.",
            metadata: {
                source: "test",
                rejectionCode: "vendor_busy",
                orderId: "order-1",
                checkoutId: "checkout-1",
                customerUid: "customer-1",
                vendorUid: "vendor-1",
                reason: "Vendor rejected the order."
            }
        });

        expect(refundPayment.validateRefundInput(createPaidPayment(), {
            amountInMinorUnits: 7500,
            reason: "Vendor rejected"
        })).toEqual({
            isValid: true,
            errors: {},
            value: {
                reference: "paystack-ref",
                status: "paid",
                amountInMinorUnits: 7500,
                amount: 75,
                currency: "ZAR",
                reason: "Vendor rejected"
            }
        });

        expect(refundPayment.validateRefundInput(createPaidPayment({
            reference: "",
            status: "pending"
        }), {
            amountInMinorUnits: 9000,
            requireReason: true,
            reason: ""
        }).errors).toEqual({
            reference: "Payment reference is required before refunding payment.",
            amount: "Refund amount cannot be greater than the paid amount.",
            status: "Only paid payments can be refunded."
        });

        expect(refundPayment.validateRefundInput(createPaidPayment(), {
            amountInMinorUnits: 0
        }).errors.amount).toBe("Refund amount must be greater than zero.");
        expect(refundPayment.validateRefundInput(createPaidPayment({
            status: "pending"
        }), {
            allowNonPaid: true
        }).isValid).toBe(true);
        expect(refundPayment.validateRefundInput(createPaidPayment(), {
            amountInMinorUnits: 9999,
            allowOverRefund: true
        }).isValid).toBe(true);
    });

    test("creates refund patches", () => {
        const patch = refundPayment.createRefundPatch(createPaidPayment({
            paymentStatus: "paid"
        }), {
            refundId: "refund-1",
            refundReference: "refund-ref",
            paymentReference: "paystack-ref",
            status: "processed",
            amount: 75,
            amountInMinorUnits: 7500,
            currency: "ZAR",
            refundedAt: "refunded-time"
        }, {
            reason: "Vendor rejected",
            requestedAt: "requested-time",
            updatedAt: "updated-time"
        });

        expect(patch).toEqual({
            paymentStatus: "paid",
            refundStatus: "processed",
            refundProvider: "paystack",
            refundReference: "refund-ref",
            refundId: "refund-1",
            refundPaymentReference: "paystack-ref",
            refundAmount: 75,
            refundAmountInMinorUnits: 7500,
            refundCurrency: "ZAR",
            refundReason: "Vendor rejected",
            refundRequestedAt: "requested-time",
            refundedAt: "refunded-time",
            updatedAt: "updated-time"
        });
    });

    test("calls supported Paystack client refund methods", async () => {
        const payload = { transaction: "ref-1" };
        const refundTransactionClient = {
            refundTransaction: jest.fn(async value => ({ method: "refundTransaction", value }))
        };
        const createRefundClient = {
            createRefund: jest.fn(async value => ({ method: "createRefund", value }))
        };
        const refundClient = {
            refund: jest.fn(async value => ({ method: "refund", value }))
        };
        const requestClient = {
            request: jest.fn(async (path, options) => ({ path, options }))
        };

        await expect(refundPayment.callPaystackRefund(refundTransactionClient, payload))
            .resolves.toEqual({ method: "refundTransaction", value: payload });
        await expect(refundPayment.callPaystackRefund(createRefundClient, payload))
            .resolves.toEqual({ method: "createRefund", value: payload });
        await expect(refundPayment.callPaystackRefund(refundClient, payload))
            .resolves.toEqual({ method: "refund", value: payload });
        await expect(refundPayment.callPaystackRefund(requestClient, payload))
            .resolves.toEqual({
                path: "/refund",
                options: {
                    method: "POST",
                    payload
                }
            });
        await expect(refundPayment.callPaystackRefund({}, payload)).resolves.toBeNull();
    });

    test("refunds a paid payment and returns a refund patch", async () => {
        const client = {
            createRefund: jest.fn(async () => ({
                status: true,
                data: {
                    id: "refund-1",
                    reference: "refund-ref",
                    transaction: {
                        reference: "paystack-ref"
                    },
                    amount: 7500,
                    currency: "ZAR",
                    status: "processed",
                    refunded_at: "refunded-time"
                }
            }))
        };

        const result = await refundPayment(createPaidPayment(), {
            client,
            reason: "Vendor rejected the paid order.",
            requestedAt: "requested-time"
        });

        expect(result.success).toBe(true);
        expect(result.provider).toBe("paystack");
        expect(result.payload).toEqual(expect.objectContaining({
            transaction: "paystack-ref",
            amount: 7500,
            merchant_note: "Vendor rejected the paid order."
        }));
        expect(result.refund).toEqual(expect.objectContaining({
            refundId: "refund-1",
            refundReference: "refund-ref",
            paymentReference: "paystack-ref",
            status: "processed",
            reason: "Vendor rejected the paid order."
        }));
        expect(result.patch).toEqual(expect.objectContaining({
            paymentStatus: "paid",
            refundStatus: "processed",
            refundReference: "refund-ref",
            refundAmountInMinorUnits: 7500,
            refundRequestedAt: "requested-time",
            refundedAt: "refunded-time"
        }));
        expect(client.createRefund).toHaveBeenCalledWith(result.payload);
    });

    test("returns validation failures before contacting Paystack", async () => {
        const client = {
            createRefund: jest.fn()
        };
        const result = await refundPayment(createPaidPayment({
            reference: "",
            status: "pending"
        }), {
            client,
            amountInMinorUnits: 0
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("payments/invalid-refund-input");
        expect(result.payload).toBeNull();
        expect(result.validationErrors).toEqual({
            reference: "Payment reference is required before refunding payment.",
            amount: "Refund amount must be greater than zero.",
            status: "Only paid payments can be refunded."
        });
        expect(client.createRefund).not.toHaveBeenCalled();
    });

    test("requires a usable Paystack client", async () => {
        const result = await refundPayment(createPaidPayment(), {
            client: {}
        });

        expect(result.success).toBe(false);
        expect(result.error).toEqual(expect.objectContaining({
            code: "payments/paystack-client-unavailable"
        }));
        expect(result.payload).toEqual(expect.objectContaining({
            transaction: "paystack-ref"
        }));
    });

    test("rejects incomplete Paystack refund responses", async () => {
        const result = await refundPayment(createPaidPayment(), {
            client: {
                createRefund: jest.fn(async () => ({
                    status: true,
                    data: {
                        amount: 7500
                    }
                }))
            }
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("payments/invalid-paystack-refund-response");
        expect(result.refund).toEqual(expect.objectContaining({
            amountInMinorUnits: 7500
        }));
    });

    test("wraps Paystack client errors", async () => {
        const paystackError = new Error("network down");
        paystackError.code = "paystack/network-error";
        const result = await refundPayment(createPaidPayment(), {
            client: {
                createRefund: jest.fn(async () => {
                    throw paystackError;
                })
            }
        });

        expect(result.success).toBe(false);
        expect(result.error).toEqual(expect.objectContaining({
            code: "paystack/network-error",
            message: "network down",
            cause: paystackError
        }));
        expect(result.payload.transaction).toBe("paystack-ref");
    });

    test("can use a request-only Paystack client", async () => {
        const client = {
            request: jest.fn(async () => ({
                data: {
                    reference: "refund-ref",
                    transaction_reference: "paystack-ref",
                    amount: 2500,
                    currency: "ZAR",
                    status: "pending"
                }
            }))
        };

        const result = await refundPayment(createPaidPayment(), {
            client,
            refundAmount: 25
        });

        expect(result.success).toBe(true);
        expect(result.patch.refundAmount).toBe(25);
        expect(client.request).toHaveBeenCalledWith("/refund", {
            method: "POST",
            payload: expect.objectContaining({
                transaction: "paystack-ref",
                amount: 2500
            })
        });
    });
});
