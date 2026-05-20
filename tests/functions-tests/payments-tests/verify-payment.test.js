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
        expect(verifyPayment.normalizeLowerText(" SUCCESS ")).toBe("success");
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
        expect(verifyPayment.resolvePaymentReference({}, { transactionReference: " tx-ref " })).toBe("tx-ref");
        expect(verifyPayment.resolvePaymentReference({ paymentReference: " order-ref " })).toBe("order-ref");
        expect(verifyPayment.isSuccessfulPaystackVerification({ status: "successful" })).toBe(true);
        expect(verifyPayment.isSuccessfulPaystackVerification({ status: "failed" })).toBe(false);
        expect(verifyPayment.getVerificationFailureReason({ gatewayResponse: "Declined" })).toBe("Declined");
        expect(verifyPayment.getVerificationFailureReason({ status: "abandoned" }))
            .toBe("Paystack payment status: abandoned.");
        expect(verifyPayment.getVerificationFailureReason()).toBe("Paystack did not confirm this payment.");
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
        expect(result.paymentSucceeded).toBe(true);
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

    test("uses the requested reference when Paystack omits it from a successful response", async () => {
        const client = {
            verifyTransaction: jest.fn(async () => ({
                data: {
                    status: "success",
                    amount: 7500,
                    currency: "ZAR",
                    paid_at: "paid-time"
                }
            }))
        };

        const result = await verifyPayment(createPayment(), {
            client,
            reference: "paystack-ref",
            timestampValue: "verified-time"
        });

        expect(result.success).toBe(true);
        expect(result.reference).toBe("paystack-ref");
        expect(result.verification).toEqual({
            status: "success",
            reference: "paystack-ref",
            amountInMinorUnits: 7500,
            currency: "ZAR"
        });
        expect(result.patch).toEqual(expect.objectContaining({
            paymentStatus: "paid",
            paymentReference: "paystack-ref"
        }));
    });

    test("returns failed payment details when Paystack reports an unsuccessful payment", async () => {
        const result = await verifyPayment(createPayment(), {
            client: {
                verifyTransaction: jest.fn(async () => ({
                    data: {
                        status: "failed",
                        reference: "paystack-ref",
                        amount: 7500,
                        currency: "ZAR",
                        gateway_response: "Card declined"
                    }
                }))
            },
            timestampValue: "failed-time"
        });

        expect(result.success).toBe(false);
        expect(result.paymentSucceeded).toBe(false);
        expect(result.error).toEqual(
            expect.objectContaining({
                code: "payments/payment-not-successful",
                gatewayStatus: "failed",
                gatewayResponse: "Card declined"
            })
        );
        expect(result.payment).toEqual(
            expect.objectContaining({
                status: "failed",
                failedAt: "failed-time",
                failureReason: "Card declined"
            })
        );
        expect(result.patch).toEqual(
            expect.objectContaining({
                paymentStatus: "failed",
                paymentFailedAt: "failed-time",
                paymentFailureReason: "Card declined"
            })
        );
    });

    test("returns mismatch errors when successful gateway details do not match the expected payment", async () => {
        const result = await verifyPayment(createPayment(), {
            client: {
                verifyTransaction: jest.fn(async () => ({
                    data: {
                        status: "success",
                        reference: "wrong-ref",
                        amount: 7000,
                        currency: "USD"
                    }
                }))
            },
            timestampValue: "failed-time"
        });

        expect(result.success).toBe(false);
        expect(result.paymentSucceeded).toBe(false);
        expect(result.error).toEqual(expect.objectContaining({
            code: "payments/verification-mismatch"
        }));
        expect(result.validationErrors).toEqual(expect.objectContaining({
            reference: "Verified payment reference does not match the expected reference.",
            amount: "Verified payment amount does not match the expected amount.",
            currency: "Verified payment currency does not match the expected currency."
        }));
        expect(result.patch).toEqual(expect.objectContaining({
            paymentStatus: "failed",
            paymentFailedAt: "failed-time"
        }));
    });

    test("applies Paystack verification results through the exported helper", () => {
        const failedResult = verifyPayment.applyPaystackVerificationResult(
            createPayment(),
            {
                status: "abandoned",
                reference: "paystack-ref",
                amountInMinorUnits: 7500,
                currency: "ZAR"
            },
            {
                timestampValue: "failed-time"
            }
        );

        expect(failedResult.success).toBe(false);
        expect(failedResult.paymentSucceeded).toBe(false);
        expect(failedResult.error.code).toBe("payments/payment-not-successful");
        expect(failedResult.patch).toEqual(expect.objectContaining({
            paymentStatus: "failed",
            paymentFailureReason: "Paystack payment status: abandoned."
        }));
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
        jest.doMock("../../../functions/shared/payments/payment-service.js", () => paymentService);

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

        jest.dontMock("../../../functions/shared/payments/payment-service.js");
        jest.resetModules();
    });
});
