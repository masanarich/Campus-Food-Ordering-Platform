const verifyPayment = require("../../../functions/payments/verify-payment.js");

function createPayment(overrides = {}) {
    return {
        paymentId: "payment-1",
        orderId: "order-1",
        customerUid: "customer-1",
        customerEmail: "student@example.com",
        vendorUid: "vendor-1",
        provider: "paystack",
        status: "pending",
        reference: "paystack-ref",
        amount: 75,
        amountInMinorUnits: 7500,
        currency: "ZAR",
        createdAt: "created-time",
        updatedAt: "created-time",
        ...overrides
    };
}

describe("functions/payments/verify-payment.js", () => {
    test("exports helper functions and normalizes Paystack verify data", () => {
        expect(verifyPayment.normalizeText("  hello  ")).toBe("hello");
        expect(verifyPayment.normalizeUpperText(" zar ")).toBe("ZAR");
        expect(verifyPayment.createVerifyResult(true, { value: 1 })).toEqual({
            success: true,
            provider: "paystack",
            value: 1
        });
        expect(verifyPayment.createVerifyError("code", "Message")).toEqual({
            code: "code",
            message: "Message"
        });
        expect(
            verifyPayment.normalizePaystackVerifyData({
                data: {
                    status: " success ",
                    reference: " paystack-ref ",
                    amount: "7500",
                    currency: " zar ",
                    paid_at: "paid-time",
                    channel: "bank",
                    gateway_response: "Successful"
                }
            })
        ).toEqual({
            status: "success",
            reference: "paystack-ref",
            amountInMinorUnits: 7500,
            currency: "ZAR",
            paidAt: "paid-time",
            channel: "bank",
            gatewayResponse: "Successful",
            raw: {
                data: {
                    status: " success ",
                    reference: " paystack-ref ",
                    amount: "7500",
                    currency: " zar ",
                    paid_at: "paid-time",
                    channel: "bank",
                    gateway_response: "Successful"
                }
            }
        });
        expect(verifyPayment.resolvePaymentReference({}, { reference: " ref-1 " })).toBe("ref-1");
        expect(verifyPayment.resolvePaymentReference({ paymentReference: " order-ref " })).toBe("order-ref");
    });

    test("verifies a successful Paystack payment and returns a paid patch", async () => {
        const client = {
            verifyTransaction: jest.fn(async () => ({
                status: true,
                message: "Verification successful",
                data: {
                    status: "success",
                    reference: "paystack-ref",
                    amount: 7500,
                    currency: "ZAR",
                    paid_at: "paid-time",
                    channel: "bank",
                    gateway_response: "Successful"
                }
            }))
        };

        const result = await verifyPayment(createPayment(), {
            client,
            timestampValue: "verified-time"
        });

        expect(result.success).toBe(true);
        expect(result.provider).toBe("paystack");
        expect(result.reference).toBe("paystack-ref");
        expect(result.payment).toEqual(
            expect.objectContaining({
                orderId: "order-1",
                status: "paid",
                reference: "paystack-ref",
                amount: 75,
                amountInMinorUnits: 7500,
                currency: "ZAR",
                paidAt: "paid-time",
                verifiedAt: "verified-time",
                updatedAt: "verified-time",
                failureReason: ""
            })
        );
        expect(result.patch).toEqual(
            expect.objectContaining({
                paymentStatus: "paid",
                paymentReference: "paystack-ref",
                paymentAmount: 75,
                paymentAmountInMinorUnits: 7500,
                paymentCurrency: "ZAR",
                paymentPaidAt: "paid-time",
                paymentVerifiedAt: "verified-time",
                paymentFailureReason: ""
            })
        );
        expect(result.verification).toEqual({
            status: "success",
            reference: "paystack-ref",
            amountInMinorUnits: 7500,
            currency: "ZAR"
        });
        expect(client.verifyTransaction).toHaveBeenCalledWith("paystack-ref");
    });

    test("returns failed payment details when Paystack verification does not match", async () => {
        const result = await verifyPayment(createPayment(), {
            client: {
                verifyTransaction: jest.fn(async () => ({
                    data: {
                        status: "failed",
                        reference: "paystack-ref",
                        amount: 7500,
                        currency: "ZAR"
                    }
                }))
            },
            timestampValue: "failed-time"
        });

        expect(result.success).toBe(false);
        expect(result.error).toEqual(
            expect.objectContaining({
                code: "payments/verification-mismatch"
            })
        );
        expect(result.validationErrors).toEqual({
            status: "Paystack payment must have a successful verification status."
        });
        expect(result.payment).toEqual(
            expect.objectContaining({
                status: "failed",
                failedAt: "failed-time",
                failureReason: "Payment verification failed."
            })
        );
        expect(result.patch).toEqual(
            expect.objectContaining({
                paymentStatus: "failed",
                paymentFailedAt: "failed-time",
                paymentFailureReason: "Payment verification failed."
            })
        );
    });

    test("requires a payment reference before contacting Paystack", async () => {
        const client = {
            verifyTransaction: jest.fn()
        };

        const result = await verifyPayment(createPayment({
            reference: ""
        }), {
            client
        });

        expect(result.success).toBe(false);
        expect(result.reference).toBe("");
        expect(result.error).toEqual(
            expect.objectContaining({
                code: "payments/missing-reference"
            })
        );
        expect(client.verifyTransaction).not.toHaveBeenCalled();
    });

    test("requires a usable Paystack client", async () => {
        await expect(
            verifyPayment(createPayment(), {
                client: {}
            })
        ).resolves.toEqual(
            expect.objectContaining({
                success: false,
                reference: "paystack-ref",
                error: expect.objectContaining({
                    code: "payments/paystack-client-unavailable"
                })
            })
        );
    });

    test("wraps Paystack client errors", async () => {
        const paystackError = new Error("network down");
        paystackError.code = "paystack/network-error";

        const result = await verifyPayment(createPayment(), {
            client: {
                verifyTransaction: jest.fn(async () => {
                    throw paystackError;
                })
            }
        });

        expect(result.success).toBe(false);
        expect(result.error).toEqual(
            expect.objectContaining({
                code: "paystack/network-error",
                message: "network down",
                cause: paystackError
            })
        );
    });

    test("uses injected shared payment helpers when provided", async () => {
        const paymentService = {
            applyVerifiedPayment: jest.fn(() => ({
                success: true,
                payment: {
                    orderId: "order-custom",
                    status: "paid"
                },
                patch: {
                    paymentStatus: "paid"
                },
                verification: {
                    status: "success"
                }
            }))
        };
        const client = {
            verifyTransaction: jest.fn(async () => ({
                data: {
                    status: "success",
                    reference: "paystack-ref",
                    amount: 7500,
                    currency: "ZAR"
                }
            }))
        };

        jest.resetModules();
        jest.doMock("../../../public/shared/payments/payment-service.js", () => paymentService);

        let isolatedVerifyPayment;
        jest.isolateModules(() => {
            isolatedVerifyPayment = require("../../../functions/payments/verify-payment.js");
        });

        const result = await isolatedVerifyPayment(createPayment(), {
            client
        });

        expect(result.success).toBe(true);
        expect(result.payment).toEqual({
            orderId: "order-custom",
            status: "paid"
        });
        expect(result.patch).toEqual({
            paymentStatus: "paid"
        });
        expect(paymentService.applyVerifiedPayment).toHaveBeenCalledTimes(1);

        jest.dontMock("../../../public/shared/payments/payment-service.js");
        jest.resetModules();
    });
});
