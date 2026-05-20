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
        expect(typeof paymentService.createFallbackPaymentRecord).toBe("function");
        expect(typeof paymentService.normalizePaymentForService).toBe("function");
        expect(typeof paymentService.getPaymentLifecycle).toBe("function");
        expect(typeof paymentService.buildResumePaymentPlan).toBe("function");
        expect(typeof paymentService.buildOrderPaymentGuard).toBe("function");

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
        expect(paymentService.resolvePaymentStatus()).toBe(paymentStatus);
        expect(paymentService.resolvePaymentModel()).toBe(paymentModel);
        expect(paymentService.resolvePaymentValidation()).toBe(paymentValidation);
        expect(paymentService.resolvePaymentStatus({})).toBeNull();
        expect(paymentService.resolvePaymentModel({})).toBeNull();
        expect(paymentService.resolvePaymentValidation({})).toBeNull();

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

    test("resolves dependencies through CommonJS fallbacks when globals are absent", () => {
        jest.isolateModules(() => {
            const originalPaymentStatus = global.paymentStatus;
            const originalPaymentModel = global.paymentModel;
            const originalPaymentValidation = global.paymentValidation;

            try {
                delete global.paymentStatus;
                delete global.paymentModel;
                delete global.paymentValidation;

                const isolatedService = require("../../../public/shared/payments/payment-service.js");

                expect(isolatedService.resolvePaymentStatus().MODULE_NAME).toBe("payment-status");
                expect(isolatedService.resolvePaymentModel().MODULE_NAME).toBe("payment-model");
                expect(isolatedService.resolvePaymentValidation().MODULE_NAME).toBe("payment-validation");
            } finally {
                if (originalPaymentStatus === undefined) {
                    delete global.paymentStatus;
                } else {
                    global.paymentStatus = originalPaymentStatus;
                }

                if (originalPaymentModel === undefined) {
                    delete global.paymentModel;
                } else {
                    global.paymentModel = originalPaymentModel;
                }

                if (originalPaymentValidation === undefined) {
                    delete global.paymentValidation;
                } else {
                    global.paymentValidation = originalPaymentValidation;
                }
            }
        });
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

    test("normalizes payment lifecycle details for checkout recovery and fulfilment guards", () => {
        const pending = paymentService.getPaymentLifecycle(createReadyPayment({
            authorizationUrl: "https://checkout.paystack.com/resume",
            metadata: {
                checkoutId: "checkout-1"
            }
        }), {
            paymentStatus,
            paymentModel
        });
        const failed = paymentService.getPaymentLifecycle(createReadyPayment({
            status: "failed",
            authorizationUrl: ""
        }), {
            paymentStatus,
            paymentModel
        });
        const paid = paymentService.getPaymentLifecycle(createReadyPayment({
            status: "paid",
            paidAt: "t-paid"
        }), {
            paymentStatus,
            paymentModel
        });

        expect(pending).toEqual(expect.objectContaining({
            status: "pending",
            statusLabel: "Payment Pending",
            checkoutId: "checkout-1",
            authorizationUrl: "https://checkout.paystack.com/resume",
            isPending: true,
            isOrderBlocking: true,
            canResume: true,
            resumeAction: "redirect",
            requiresVerification: true
        }));
        expect(failed).toEqual(expect.objectContaining({
            status: "failed",
            isFailed: true,
            isRetryable: true,
            isAwaitingCustomerAction: true,
            isOrderBlocking: true,
            canResume: true,
            resumeAction: "initialize"
        }));
        expect(paid).toEqual(expect.objectContaining({
            status: "paid",
            isPaid: true,
            isOrderBlocking: false,
            isRefundable: true,
            canResume: false
        }));
    });

    test("normalizes fallback payment records without payment model helpers", () => {
        const payment = paymentService.createFallbackPaymentRecord({
            orderId: "order-1",
            checkoutId: "checkout-1",
            paymentStatus: "payment pending",
            paymentProvider: "Paystack",
            paymentReference: " ref-1 ",
            paymentAccessCode: " access-1 ",
            paymentAuthorizationUrl: " https://checkout.paystack.com/resume ",
            paymentAmount: "75.50",
            paymentAmountInMinorUnits: "7550",
            paymentCurrency: "zar",
            paymentFailureReason: " "
        }, {
            paymentStatus
        });

        expect(payment).toEqual(expect.objectContaining({
            orderId: "order-1",
            checkoutId: "checkout-1",
            status: "pending",
            provider: "paystack",
            reference: "ref-1",
            accessCode: "access-1",
            authorizationUrl: "https://checkout.paystack.com/resume",
            amount: 75.5,
            amountInMinorUnits: 7550,
            currency: "ZAR",
            failureReason: ""
        }));
    });

    test("builds resume payment plans for pending, failed, paid, and incomplete pending payments", () => {
        const reviewStatus = {
            ...paymentStatus,
            normalizePaymentStatus: jest.fn(() => "manual_review"),
            getDefaultPaymentStatus: jest.fn(() => "manual_review"),
            getPaymentStatusLabel: jest.fn(() => "Manual Review"),
            isPaymentPaid: jest.fn(() => false),
            isPaymentPending: jest.fn(() => false),
            isPaymentFailed: jest.fn(() => false),
            isPaymentUnpaid: jest.fn(() => false),
            isPaymentRetryable: jest.fn(() => false),
            isPaymentAwaitingCustomerAction: jest.fn(() => false),
            isPaymentBlockingOrder: jest.fn(() => true),
            isPaymentRefundable: jest.fn(() => false)
        };
        const redirectPlan = paymentService.buildResumePaymentPlan(createReadyPayment({
            authorizationUrl: "https://checkout.paystack.com/resume"
        }), {
            paymentStatus,
            paymentModel
        });
        const initializePlan = paymentService.buildResumePaymentPlan(createReadyPayment({
            status: "failed",
            authorizationUrl: ""
        }), {
            paymentStatus,
            paymentModel
        });
        const missingUrlPlan = paymentService.buildResumePaymentPlan(createReadyPayment({
            status: "pending",
            authorizationUrl: ""
        }), {
            paymentStatus,
            paymentModel
        });
        const alreadyPaidPlan = paymentService.buildResumePaymentPlan(createReadyPayment({
            status: "paid"
        }), {
            paymentStatus,
            paymentModel
        });
        const notAllowedPlan = paymentService.buildResumePaymentPlan({
            status: "manual_review",
            reference: "ref-review"
        }, {
            paymentStatus: reviewStatus
        });

        expect(redirectPlan).toEqual(expect.objectContaining({
            success: true,
            action: "redirect",
            authorizationUrl: "https://checkout.paystack.com/resume",
            reference: "ref-1"
        }));
        expect(initializePlan).toEqual(expect.objectContaining({
            success: true,
            action: "initialize",
            authorizationUrl: ""
        }));
        expect(missingUrlPlan).toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({
                code: "payments/resume-url-missing"
            })
        }));
        expect(alreadyPaidPlan).toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({
                code: "payments/already-paid"
            })
        }));
        expect(notAllowedPlan).toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({
                code: "payments/resume-not-allowed"
            })
        }));
    });

    test("builds order payment guards from payment lifecycle", () => {
        const pendingGuard = paymentService.buildOrderPaymentGuard(createReadyPayment({
            status: "pending"
        }), {
            paymentStatus,
            paymentModel
        });
        const paidGuard = paymentService.buildOrderPaymentGuard(createReadyPayment({
            status: "paid"
        }), {
            paymentStatus,
            paymentModel
        });

        expect(pendingGuard).toEqual(expect.objectContaining({
            blocked: true,
            status: "pending",
            statusLabel: "Payment Pending"
        }));
        expect(pendingGuard.reason).toContain("Do not fulfil");
        expect(paidGuard).toEqual(expect.objectContaining({
            blocked: false,
            status: "paid",
            reason: ""
        }));
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

    test("preserves checkout ids in payment records and Paystack metadata", () => {
        const record = paymentService.createPaymentRecordFromOrder({
            orderId: "order-1",
            checkoutId: "checkout-1",
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
        const prepared = paymentService.prepareInitializePayment({
            orderId: "order-1",
            checkoutId: "checkout-1",
            customerUid: "customer-1",
            customerName: "Tshepo",
            customerEmail: "tshepo@example.com",
            vendorUid: "vendor-1",
            total: 80
        }, {
            paymentStatus,
            paymentModel,
            paymentValidation,
            reference: "ref-1",
            callbackUrl: "https://example.test/payment-callback.html",
            createdAt: "t-1"
        });

        expect(record.success).toBe(true);
        expect(record.payment.metadata.checkoutId).toBe("checkout-1");
        expect(prepared.success).toBe(true);
        expect(prepared.payload.metadata.checkoutId).toBe("checkout-1");
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
        expect(paymentService.prepareInitializePayment({}, {
            paymentStatus: {},
            paymentModel: {}
        })).toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({
                code: "payments/dependencies-missing"
            })
        }));
        expect(paymentService.applyInitializedPayment({}, {}, {
            paymentStatus: {},
            paymentModel: {}
        })).toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({
                code: "payments/dependencies-missing"
            })
        }));
        expect(paymentService.applyVerifiedPayment({}, {}, {
            paymentStatus: {},
            paymentModel: {},
            paymentValidation: {}
        })).toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({
                code: "payments/dependencies-missing"
            })
        }));
        expect(paymentService.applyFailedPayment({}, {}, {
            paymentStatus: {},
            paymentModel: {}
        })).toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({
                code: "payments/dependencies-missing"
            })
        }));
        expect(paymentService.buildOrderPaymentPatch({}, {
            paymentModel: {}
        })).toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({
                code: "payments/dependencies-missing"
            })
        }));
    });

    test("returns a dependency error when initialization validation helpers are missing", () => {
        const result = paymentService.prepareInitializePayment({
            orderId: "order-1",
            customerUid: "customer-1",
            customerEmail: "tshepo@example.com",
            vendorUid: "vendor-1",
            total: 80
        }, {
            paymentStatus,
            paymentModel,
            paymentValidation: {}
        });

        expect(result).toEqual(expect.objectContaining({
            success: false,
            payment: expect.objectContaining({
                orderId: "order-1"
            }),
            error: expect.objectContaining({
                code: "payments/dependencies-missing"
            })
        }));
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
