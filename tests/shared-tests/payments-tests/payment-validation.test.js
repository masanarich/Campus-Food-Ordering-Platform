const paymentValidation = require("../../../public/shared/payments/payment-validation.js");
const paymentStatus = require("../../../public/shared/payments/payment-status.js");
const paymentModel = require("../../../public/shared/payments/payment-model.js");

describe("shared/payments/payment-validation.js", () => {
    test("exports constants and utility helpers", () => {
        expect(paymentValidation.MODULE_NAME).toBe("payment-validation");
        expect(paymentValidation.DEFAULT_ALLOWED_CURRENCIES).toEqual(["ZAR"]);
        expect(paymentValidation.DEFAULT_ALLOWED_PROVIDERS).toEqual(["paystack"]);

        expect(paymentValidation.normalizeText(" ref ")).toBe("ref");
        expect(paymentValidation.normalizeText(null)).toBe("");
        expect(paymentValidation.normalizeLowerText(" PAYSTACK ")).toBe("paystack");
        expect(paymentValidation.normalizeUpperText(" zar ")).toBe("ZAR");
        expect(paymentValidation.normalizeCurrencyAmount("12.345")).toBe(12.35);
        expect(paymentValidation.normalizeCurrencyAmount("bad", 5.129)).toBe(5.13);
        expect(paymentValidation.normalizeAmountInMinorUnits("1234")).toBe(1234);
        expect(paymentValidation.normalizeAmountInMinorUnits("bad", 99)).toBe(99);
    });

    test("creates validation results and manages errors", () => {
        expect(paymentValidation.createValidationResult({})).toEqual({
            isValid: true,
            errors: {}
        });
        expect(paymentValidation.createValidationResult({
            amount: "Payment amount is required."
        }, {
            value: 0
        })).toEqual({
            isValid: false,
            errors: {
                amount: "Payment amount is required."
            },
            value: 0
        });

        const errors = {};
        paymentValidation.setError(errors, "amount", "First error");
        paymentValidation.setError(errors, "amount", "Second error");
        paymentValidation.mergeErrors(errors, {
            reference: "Reference is required."
        }, "payment");

        expect(errors).toEqual({
            amount: "First error",
            "payment.reference": "Reference is required."
        });
    });

    test("resolves payment helper dependencies", () => {
        expect(paymentValidation.resolvePaymentStatus(paymentStatus)).toBe(paymentStatus);
        expect(paymentValidation.resolvePaymentModel(paymentModel)).toBe(paymentModel);

        const originalGlobalPaymentStatus = global.paymentStatus;
        const originalGlobalPaymentModel = global.paymentModel;

        try {
            global.paymentStatus = paymentStatus;
            global.paymentModel = paymentModel;

            expect(paymentValidation.resolvePaymentStatus()).toBe(paymentStatus);
            expect(paymentValidation.resolvePaymentModel()).toBe(paymentModel);
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
        }
    });

    test("validates payment amounts", () => {
        expect(paymentValidation.validatePaymentAmount(100)).toEqual({
            isValid: true,
            errors: {},
            value: 100
        });
        expect(paymentValidation.validatePaymentAmount("")).toEqual({
            isValid: false,
            errors: {
                amount: "Payment amount is required."
            },
            value: 0
        });
        expect(paymentValidation.validatePaymentAmount(0)).toEqual({
            isValid: false,
            errors: {
                amount: "Payment amount must be at least 0.01."
            },
            value: 0
        });
        expect(paymentValidation.validatePaymentAmount(1000, {
            maximumAmount: 500
        })).toEqual({
            isValid: false,
            errors: {
                amount: "Payment amount cannot exceed 500."
            },
            value: 1000
        });
    });

    test("validates payment amounts in minor units", () => {
        expect(paymentValidation.validatePaymentAmountInMinorUnits(1000)).toEqual({
            isValid: true,
            errors: {},
            value: 1000
        });
        expect(paymentValidation.validatePaymentAmountInMinorUnits(null)).toEqual({
            isValid: false,
            errors: {
                amountInMinorUnits: "Payment amount in minor units is required."
            },
            value: 0
        });
        expect(paymentValidation.validatePaymentAmountInMinorUnits(0)).toEqual({
            isValid: false,
            errors: {
                amountInMinorUnits: "Payment amount must be at least 1 cents."
            },
            value: 0
        });
        expect(paymentValidation.validatePaymentAmountInMinorUnits(2000, {
            maximumAmountInMinorUnits: 1000
        })).toEqual({
            isValid: false,
            errors: {
                amountInMinorUnits: "Payment amount cannot exceed 1000 cents."
            },
            value: 2000
        });
    });

    test("validates currency and provider", () => {
        expect(paymentValidation.validatePaymentCurrency("zar")).toEqual({
            isValid: true,
            errors: {},
            value: "ZAR"
        });
        expect(paymentValidation.validatePaymentCurrency("USD")).toEqual({
            isValid: false,
            errors: {
                currency: "Payment currency must be one of: ZAR."
            },
            value: "USD"
        });
        expect(paymentValidation.validatePaymentCurrency("USD", {
            allowedCurrencies: ["ZAR", "USD"]
        }).isValid).toBe(true);

        expect(paymentValidation.validatePaymentProvider("PayStack")).toEqual({
            isValid: true,
            errors: {},
            value: "paystack"
        });
        expect(paymentValidation.validatePaymentProvider("cash")).toEqual({
            isValid: false,
            errors: {
                provider: "Payment provider must be one of: paystack."
            },
            value: "cash"
        });
    });

    test("validates payment references", () => {
        expect(paymentValidation.validatePaymentReference("ref-123")).toEqual({
            isValid: true,
            errors: {},
            value: "ref-123"
        });
        expect(paymentValidation.validatePaymentReference("")).toEqual({
            isValid: false,
            errors: {
                reference: "Payment reference is required."
            },
            value: ""
        });
        expect(paymentValidation.validatePaymentReference("", {
            required: false
        })).toEqual({
            isValid: true,
            errors: {},
            value: ""
        });
        expect(paymentValidation.validatePaymentReference("abc")).toEqual({
            isValid: false,
            errors: {
                reference: "Payment reference must be at least 4 characters."
            },
            value: "abc"
        });
    });

    test("validates payment customer details", () => {
        expect(paymentValidation.validatePaymentCustomer({
            userUid: "customer-1",
            email: "TSHEPO@EXAMPLE.COM"
        })).toEqual({
            isValid: true,
            errors: {},
            value: {
                customerUid: "customer-1",
                customerEmail: "tshepo@example.com"
            }
        });
        expect(paymentValidation.validatePaymentCustomer({})).toEqual({
            isValid: false,
            errors: {
                customerUid: "Customer UID is required before starting payment.",
                customerEmail: "Customer email is required before starting payment."
            },
            value: {
                customerUid: "",
                customerEmail: ""
            }
        });
        expect(paymentValidation.validatePaymentCustomer({
            customerUid: "customer-1",
            customerEmail: "bad-email"
        })).toEqual({
            isValid: false,
            errors: {
                customerEmail: "Customer email must be a valid email address."
            },
            value: {
                customerUid: "customer-1",
                customerEmail: "bad-email"
            }
        });
    });

    test("validates payment records", () => {
        const result = paymentValidation.validatePaymentRecord({
            orderId: "order-1",
            customerUid: "customer-1",
            customerEmail: "tshepo@example.com",
            status: "pending",
            provider: "paystack",
            amount: 50,
            currency: "ZAR"
        }, {
            paymentStatus,
            paymentModel
        });

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual({});
        expect(result.value).toEqual(expect.objectContaining({
            orderId: "order-1",
            customerUid: "customer-1",
            customerEmail: "tshepo@example.com",
            status: "pending",
            amount: 50,
            amountInMinorUnits: 5000
        }));
    });

    test("returns combined errors for invalid payment records", () => {
        expect(paymentValidation.validatePaymentRecord({
            status: "mystery",
            provider: "cash",
            amount: 0,
            currency: "USD"
        }, {
            paymentStatus,
            paymentModel
        })).toEqual(expect.objectContaining({
            isValid: false,
            errors: {
                amount: "Payment amount must be at least 0.01.",
                amountInMinorUnits: "Payment amount must be at least 1 cents.",
                currency: "Payment currency must be one of: ZAR.",
                provider: "Payment provider must be one of: paystack.",
                customerUid: "Customer UID is required before starting payment.",
                customerEmail: "Customer email is required before starting payment.",
                orderId: "Order ID is required before starting payment.",
                status: "Payment status is invalid."
            }
        }));
    });

    test("validates initialize and verify payment inputs", () => {
        expect(paymentValidation.validateInitializePaymentInput({
            orderId: "order-1",
            customerUid: "customer-1",
            customerEmail: "tshepo@example.com",
            status: "pending",
            provider: "paystack",
            amount: 30,
            currency: "ZAR"
        }, {
            paymentStatus,
            paymentModel
        }).isValid).toBe(true);

        expect(paymentValidation.validateVerifyPaymentInput({
            orderId: "order-1",
            customerUid: "customer-1",
            customerEmail: "tshepo@example.com",
            status: "pending",
            provider: "paystack",
            reference: "",
            amount: 30,
            currency: "ZAR"
        }, {
            paymentStatus,
            paymentModel
        }).errors).toEqual({
            reference: "Payment reference is required."
        });
    });

    test("validates payment status changes", () => {
        expect(paymentValidation.validatePaymentStatusChange("pending", "paid", {
            paymentStatus
        })).toEqual({
            isValid: true,
            currentStatus: "pending",
            nextStatus: "paid",
            message: "Payments can move from Payment Pending to Paid."
        });
        expect(paymentValidation.validatePaymentStatusChange("paid", "failed", {
            paymentStatus
        }).isValid).toBe(false);
        expect(paymentValidation.validatePaymentStatusChange("pending", "paid", {
            paymentStatus: {}
        })).toEqual({
            isValid: false,
            currentStatus: "pending",
            nextStatus: "paid",
            message: "Payment status helpers are required before changing payment status."
        });
    });

    test("validates verified Paystack payments", () => {
        expect(paymentValidation.validateVerifiedPayment({
            reference: "ref-1",
            amountInMinorUnits: 7500,
            currency: "ZAR"
        }, {
            status: "success",
            reference: "ref-1",
            amount: 7500,
            currency: "zar"
        })).toEqual({
            isValid: true,
            errors: {},
            value: {
                status: "success",
                reference: "ref-1",
                amountInMinorUnits: 7500,
                currency: "ZAR"
            }
        });
    });

    test("rejects mismatched verified Paystack payments", () => {
        expect(paymentValidation.validateVerifiedPayment({
            reference: "ref-1",
            amountInMinorUnits: 7500,
            currency: "ZAR"
        }, {
            status: "failed",
            reference: "ref-2",
            amount: 7000,
            currency: "USD"
        })).toEqual({
            isValid: false,
            errors: {
                status: "Paystack payment must have a successful verification status.",
                reference: "Verified payment reference does not match the expected reference.",
                amount: "Verified payment amount does not match the expected amount.",
                currency: "Verified payment currency does not match the expected currency."
            },
            value: {
                status: "failed",
                reference: "ref-2",
                amountInMinorUnits: 7000,
                currency: "USD"
            }
        });
    });

    test("attaches the module to a browser-like global scope", () => {
        jest.isolateModules(() => {
            const originalWindow = global.window;

            try {
                global.window = {
                    paymentStatus,
                    paymentModel
                };
                require("../../../public/shared/payments/payment-validation.js");

                expect(global.window.paymentValidation).toBeDefined();
                expect(global.window.paymentValidation.validatePaymentAmount(10).isValid).toBe(true);
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
