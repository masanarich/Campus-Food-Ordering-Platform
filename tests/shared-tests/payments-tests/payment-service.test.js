const paymentService = require("../../../public/shared/payments/payment-service.js");
const paymentStatus = require("../../../public/shared/payments/payment-status.js");
const paymentModel = require("../../../public/shared/payments/payment-model.js");
const paymentValidation = require("../../../public/shared/payments/payment-validation.js");

function createReadyPayment(overrides = {}) {
    return paymentModel.createPaymentRecord({
        orderId: "order-1",
        customerUid: "customer-1",
        customerEmail: "tshepo@example.com",
        vendorUid: "vendor-1",
        status: "pending",
        provider: "paystack",
        reference: "ref-1",
        amount: 75.5,
        currency: "ZAR",
        ...overrides
    }, {
        paymentStatus
    });
}

describe("shared/payments/payment-service.js", () => {
    test("exports helpers and creates service errors/results", () => {
        expect(paymentService.MODULE_NAME).toBe("payment-service");
        expect(paymentService.normalizeText(" ref ")).toBe("ref");
        expect(paymentService.normalizeText(null)).toBe("");
        expect(paymentService.normalizeLowerText(" PAYSTACK ")).toBe("paystack");

        expect(paymentService.createServiceError(" payments/test ", " Broken ", {
            details: true
        })).toEqual({
            code: "payments/test",
            message: "Broken",
            details: true
        });
        expect(paymentService.createPaymentResult(true, {
            reference: "ref-1"
        })).toEqual({
            success: true,
            provider: "paystack",
            reference: "ref-1"
        });
        expect(paymentService.createPaymentFailure("payments/bad", "Bad payment")).toEqual({
            success: false,
            provider: "paystack",
            error: {
                code: "payments/bad",
                message: "Bad payment"
            }
        });
    });

    test("resolves dependencies from explicit and global helpers", () => {
        expect(paymentService.resolvePaymentStatus(paymentStatus)).toBe(paymentStatus);
        expect(paymentService.resolvePaymentModel(paymentModel)).toBe(paymentModel);
        expect(paymentService.resolvePaymentValidation(paymentValidation)).toBe(paymentValidation);

        const originalGlobalPaymentStatus = global.paymentStatus;
        const originalGlobalPaymentModel = global.paymentModel;
        const originalGlobalPaymentValidation = global.paymentValidation;

        try {
            global.paymentStatus = paymentStatus;
            global.paymentModel = paymentModel;
            global.paymentValidation = paymentValidation;

            expect(paymentService.getPaymentDependencies()).toEqual({
                paymentStatus,
                paymentModel,
                paymentValidation
            });
        } finally {
            if (originalGlobalPaymentStatus === undefined) {
                delete global.paymentStatus;
            } else {
                global.paymentStatus = originalGlobalPaymentStatus;
            }

            if (originalGlobalPaymentModel === undefined) {
                delete global.paymentModel;
            } else {
                global.paymentModel = originalGlobalPaymentModel;
            }

            if (originalGlobalPaymentValidation === undefined) {
                delete global.paymentValidation;
            } else {
                global.paymentValidation = originalGlobalPaymentValidation;
            }
        }
    });

    test("resolves timestamp values", () => {
        expect(paymentService.resolveTimestampValue({
            timestampValue: "t-1"
        })).toBe("t-1");
        expect(paymentService.resolveTimestampValue({
            firestoreFns: {
                serverTimestamp: jest.fn(() => "server-time")
            }
        })).toBe("server-time");
        expect(paymentService.resolveTimestampValue()).toBeNull();
    });

    test("creates payment records from orders", () => {
        const result = paymentService.createPaymentRecordFromOrder({
            orderId: "order-1",
            customerUid: "customer-1",
            customerName: "Tshepo",
            customerEmail: "tshepo@example.com",
            vendorUid: "vendor-1",
            total: 80
        }, {
            paymentStatus,
            paymentModel,
            reference: "ref-1",
            createdAt: "t-1"
        });

        expect(result.success).toBe(true);
        expect(result.payment).toEqual(expect.objectContaining({
            orderId: "order-1",
            customerUid: "customer-1",
            customerEmail: "tshepo@example.com",
            vendorUid: "vendor-1",
            status: "pending",
            reference: "ref-1",
            amount: 80,
            amountInMinorUnits: 8000
        }));
    });

    test("returns dependency errors when creating payment records without helpers", () => {
        expect(paymentService.createPaymentRecordFromOrder({}, {
            paymentStatus: {},
            paymentModel: {}
        })).toEqual({
            success: false,
            provider: "paystack",
            error: {
                code: "payments/dependencies-missing",
                message: "Payment model and status helpers are required before creating a payment record."
            }
        });
    });

    test("prepares initialize payment payloads", () => {
        const result = paymentService.prepareInitializePayment({
            orderId: "order-1",
            customerUid: "customer-1",
            customerName: "Tshepo",
            customerEmail: "tshepo@example.com",
            vendorUid: "vendor-1",
            total: 95.25
        }, {
            paymentStatus,
            paymentModel,
            paymentValidation,
            reference: "ref-1",
            callbackUrl: "https://example.test/payment-callback.html",
            createdAt: "t-1"
        });

        expect(result.success).toBe(true);
        expect(result.payment).toEqual(expect.objectContaining({
            orderId: "order-1",
            reference: "ref-1",
            amount: 95.25,
            amountInMinorUnits: 9525
        }));
        expect(result.payload).toEqual({
            email: "tshepo@example.com",
            amount: 9525,
            currency: "ZAR",
            reference: "ref-1",
            callback_url: "https://example.test/payment-callback.html",
            metadata: {
                orderId: "order-1",
                customerUid: "customer-1",
                vendorUid: "vendor-1",
                provider: "paystack"
            }
        });
    });

    test("returns validation errors for invalid initialize payment inputs", () => {
        const result = paymentService.prepareInitializePayment({
            orderId: "",
            customerUid: "",
            customerEmail: "",
            total: 0
        }, {
            paymentStatus,
            paymentModel,
            paymentValidation
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("payments/invalid-initialize-input");
        expect(result.validationErrors).toEqual(expect.objectContaining({
            amount: "Payment amount must be at least 0.01.",
            customerUid: "Customer UID is required before starting payment.",
            customerEmail: "Customer email is required before starting payment.",
            orderId: "Order ID is required before starting payment."
        }));
    });

    test("applies initialized payment responses", () => {
        const result = paymentService.applyInitializedPayment(createReadyPayment({
            reference: ""
        }), {
            reference: "ref-2",
            access_code: "access-1",
            authorization_url: "https://paystack.test/pay"
        }, {
            paymentStatus,
            paymentModel,
            timestampValue: "t-updated"
        });

        expect(result.success).toBe(true);
        expect(result.payment).toEqual(expect.objectContaining({
            status: "pending",
            reference: "ref-2",
            accessCode: "access-1",
            authorizationUrl: "https://paystack.test/pay",
            updatedAt: "t-updated"
        }));
        expect(result.patch).toEqual(expect.objectContaining({
            paymentStatus: "pending",
            paymentReference: "ref-2",
            paymentAccessCode: "access-1",
            paymentAuthorizationUrl: "https://paystack.test/pay"
        }));
    });

    test("applies verified payment responses", () => {
        const result = paymentService.applyVerifiedPayment(createReadyPayment(), {
            status: "success",
            reference: "ref-1",
            amount: 7550,
            currency: "ZAR"
        }, {
            paymentStatus,
            paymentModel,
            paymentValidation,
            timestampValue: "t-verified"
        });

        expect(result.success).toBe(true);
        expect(result.payment).toEqual(expect.objectContaining({
            status: "paid",
            reference: "ref-1",
            amount: 75.5,
            amountInMinorUnits: 7550,
            paidAt: "t-verified",
            verifiedAt: "t-verified",
            updatedAt: "t-verified",
            failureReason: ""
        }));
        expect(result.patch).toEqual(expect.objectContaining({
            paymentStatus: "paid",
            paymentPaidAt: "t-verified",
            paymentVerifiedAt: "t-verified"
        }));
        expect(result.verification).toEqual({
            status: "success",
            reference: "ref-1",
            amountInMinorUnits: 7550,
            currency: "ZAR"
        });
    });

    test("marks payments failed when verification mismatches", () => {
        const result = paymentService.applyVerifiedPayment(createReadyPayment(), {
            status: "failed",
            reference: "wrong-ref",
            amount: 7000,
            currency: "USD"
        }, {
            paymentStatus,
            paymentModel,
            paymentValidation,
            timestampValue: "t-failed"
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("payments/verification-mismatch");
        expect(result.payment).toEqual(expect.objectContaining({
            status: "failed",
            failedAt: "t-failed",
            failureReason: "Payment verification failed."
        }));
        expect(result.patch).toEqual(expect.objectContaining({
            paymentStatus: "failed",
            paymentFailedAt: "t-failed"
        }));
        expect(result.validationErrors).toEqual(expect.objectContaining({
            status: "Paystack payment must have a successful verification status.",
            reference: "Verified payment reference does not match the expected reference.",
            amount: "Verified payment amount does not match the expected amount.",
            currency: "Verified payment currency does not match the expected currency."
        }));
    });

    test("applies failed payment details", () => {
        const result = paymentService.applyFailedPayment(createReadyPayment(), {
            reason: "card declined"
        }, {
            paymentStatus,
            paymentModel,
            failedAt: "t-failed"
        });

        expect(result.success).toBe(true);
        expect(result.payment).toEqual(expect.objectContaining({
            status: "failed",
            failedAt: "t-failed",
            failureReason: "card declined"
        }));
        expect(result.patch).toEqual(expect.objectContaining({
            paymentStatus: "failed",
            paymentFailedAt: "t-failed",
            paymentFailureReason: "card declined"
        }));
    });

    test("builds order payment patches", () => {
        const result = paymentService.buildOrderPaymentPatch(createReadyPayment({
            status: "paid",
            paidAt: "t-paid"
        }), {
            paymentStatus,
            paymentModel
        });

        expect(result.success).toBe(true);
        expect(result.patch).toEqual(expect.objectContaining({
            paymentStatus: "paid",
            paymentProvider: "paystack",
            paymentReference: "ref-1",
            paymentAmount: 75.5,
            paymentAmountInMinorUnits: 7550,
            paymentCurrency: "ZAR",
            paymentPaidAt: "t-paid"
        }));
    });

    test("attaches the module to a browser-like global scope", () => {
        jest.isolateModules(() => {
            const originalWindow = global.window;

            try {
                global.window = {
                    paymentStatus,
                    paymentModel,
                    paymentValidation
                };
                require("../../../public/shared/payments/payment-service.js");

                expect(global.window.paymentService).toBeDefined();
                expect(global.window.paymentService.createPaymentResult(true).success).toBe(true);
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
