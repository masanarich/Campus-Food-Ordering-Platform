const initializePayment = require("../../../functions/payments/initialize-payment.js");

function createOrder(overrides = {}) {
    return {
        orderId: "order-1",
        customerUid: "customer-1",
        customerEmail: "student@example.com",
        vendorUid: "vendor-1",
        total: 75,
        paymentAmount: 75,
        paymentAmountInMinorUnits: 7500,
        paymentCurrency: "ZAR",
        ...overrides
    };
}

describe("functions/payments/initialize-payment.js", () => {
    test("exports helper functions and reads callback URL from options or env", () => {
        const originalCallbackUrl = process.env.PAYSTACK_CALLBACK_URL;

        process.env.PAYSTACK_CALLBACK_URL = "https://example.com/from-env.html";

        expect(initializePayment.normalizeText("  hello  ")).toBe("hello");
        expect(initializePayment.createInitializeResult(true, { value: 1 })).toEqual({
            success: true,
            provider: "paystack",
            value: 1
        });
        expect(initializePayment.createInitializeError("code", "Message")).toEqual({
            code: "code",
            message: "Message"
        });
        expect(initializePayment.getCallbackUrl({ callbackUrl: "https://example.com/direct.html" }))
            .toBe("https://example.com/direct.html");
        expect(initializePayment.getCallbackUrl()).toBe("https://example.com/from-env.html");
        expect(initializePayment.hasExistingPaymentAttempt({})).toBe(false);
        expect(initializePayment.hasExistingPaymentAttempt({
            paymentStatus: "pending"
        })).toBe(true);
        expect(
            initializePayment.normalizePaystackInitializeData({
                data: {
                    authorization_url: " https://checkout.paystack.com/test ",
                    access_code: " access-code ",
                    reference: " ref-1 "
                }
            })
        ).toEqual({
            authorizationUrl: "https://checkout.paystack.com/test",
            accessCode: "access-code",
            reference: "ref-1",
            raw: {
                data: {
                    authorization_url: " https://checkout.paystack.com/test ",
                    access_code: " access-code ",
                    reference: " ref-1 "
                }
            }
        });

        process.env.PAYSTACK_CALLBACK_URL = originalCallbackUrl;
    });

    test("reuses an existing pending Paystack authorization without creating another transaction", async () => {
        const client = {
            initializeTransaction: jest.fn()
        };
        const result = await initializePayment(createOrder({
            checkoutId: "checkout-1",
            paymentStatus: "pending",
            paymentProvider: "paystack",
            paymentReference: "existing-ref",
            paymentAccessCode: "existing-access",
            paymentAuthorizationUrl: "https://checkout.paystack.com/resume",
            paymentAmount: 75,
            paymentAmountInMinorUnits: 7500,
            paymentCurrency: "ZAR"
        }), {
            client,
            callbackUrl: "https://campus.example.com/payment-callback.html"
        });

        expect(result.success).toBe(true);
        expect(result.resumed).toBe(true);
        expect(result.reusedAuthorization).toBe(true);
        expect(result.resumeAction).toBe("redirect");
        expect(result.payload).toBeNull();
        expect(result.authorizationUrl).toBe("https://checkout.paystack.com/resume");
        expect(result.accessCode).toBe("existing-access");
        expect(result.reference).toBe("existing-ref");
        expect(result.lifecycle).toEqual(expect.objectContaining({
            status: "pending",
            canResume: true,
            resumeAction: "redirect"
        }));
        expect(result.payment).toEqual(expect.objectContaining({
            checkoutId: "checkout-1",
            status: "pending",
            reference: "existing-ref",
            authorizationUrl: "https://checkout.paystack.com/resume"
        }));
        expect(result.patch).toEqual(expect.objectContaining({
            paymentStatus: "pending",
            paymentReference: "existing-ref",
            paymentAccessCode: "existing-access",
            paymentAuthorizationUrl: "https://checkout.paystack.com/resume"
        }));
        expect(client.initializeTransaction).not.toHaveBeenCalled();
    });

    test("starts a fresh Paystack transaction when a saved authorization is refreshed", async () => {
        const client = {
            initializeTransaction: jest.fn(async payload => ({
                data: {
                    authorizationUrl: "https://checkout.paystack.com/fresh",
                    accessCode: "fresh-access",
                    reference: "fresh-ref",
                    receivedPayload: payload
                }
            }))
        };

        const result = await initializePayment(createOrder({
            checkoutId: "checkout-1",
            paymentStatus: "pending",
            paymentProvider: "paystack",
            paymentReference: "existing-ref",
            paymentAccessCode: "existing-access",
            paymentAuthorizationUrl: "https://checkout.paystack.com/stale",
            paymentAmount: 75,
            paymentAmountInMinorUnits: 7500,
            paymentCurrency: "ZAR"
        }), {
            client,
            callbackUrl: "https://campus.example.com/payment-callback.html",
            forceNewTransaction: true,
            refreshPayment: true
        });

        expect(result.success).toBe(true);
        expect(result.resumed).toBeUndefined();
        expect(result.reusedAuthorization).toBeUndefined();
        expect(result.authorizationUrl).toBe("https://checkout.paystack.com/fresh");
        expect(result.accessCode).toBe("fresh-access");
        expect(result.reference).toBe("fresh-ref");
        expect(client.initializeTransaction).toHaveBeenCalledWith(expect.objectContaining({
            reference: undefined,
            callback_url: "https://campus.example.com/payment-callback.html"
        }));
    });

    test("refuses to initialize an already paid payment", async () => {
        const client = {
            initializeTransaction: jest.fn()
        };
        const result = await initializePayment(createOrder({
            paymentStatus: "paid",
            paymentProvider: "paystack",
            paymentReference: "paid-ref",
            paymentAuthorizationUrl: "https://checkout.paystack.com/paid"
        }), {
            client,
            callbackUrl: "https://campus.example.com/payment-callback.html"
        });

        expect(result.success).toBe(false);
        expect(result.payload).toBeNull();
        expect(result.payment).toEqual(expect.objectContaining({
            status: "paid",
            reference: "paid-ref"
        }));
        expect(result.error).toEqual(expect.objectContaining({
            code: "payments/already-paid"
        }));
        expect(client.initializeTransaction).not.toHaveBeenCalled();
    });

    test("initializes a Paystack payment and returns an order payment patch", async () => {
        const client = {
            initializeTransaction: jest.fn(async () => ({
                status: true,
                message: "Authorization URL created",
                data: {
                    authorization_url: "https://checkout.paystack.com/test",
                    access_code: "access-code",
                    reference: "paystack-ref"
                }
            }))
        };

        const result = await initializePayment(createOrder(), {
            client,
            callbackUrl: "https://campus.example.com/payment-callback.html",
            timestampValue: "server-time"
        });

        expect(result.success).toBe(true);
        expect(result.provider).toBe("paystack");
        expect(result.authorizationUrl).toBe("https://checkout.paystack.com/test");
        expect(result.accessCode).toBe("access-code");
        expect(result.reference).toBe("paystack-ref");
        expect(result.payment).toEqual(
            expect.objectContaining({
                orderId: "order-1",
                customerUid: "customer-1",
                customerEmail: "student@example.com",
                status: "pending",
                provider: "paystack",
                reference: "paystack-ref",
                accessCode: "access-code",
                authorizationUrl: "https://checkout.paystack.com/test",
                amount: 75,
                amountInMinorUnits: 7500,
                currency: "ZAR",
                updatedAt: "server-time"
            })
        );
        expect(result.patch).toEqual(
            expect.objectContaining({
                paymentStatus: "pending",
                paymentProvider: "paystack",
                paymentReference: "paystack-ref",
                paymentAccessCode: "access-code",
                paymentAuthorizationUrl: "https://checkout.paystack.com/test",
                paymentAmount: 75,
                paymentAmountInMinorUnits: 7500,
                paymentCurrency: "ZAR"
            })
        );
        expect(client.initializeTransaction).toHaveBeenCalledWith({
            email: "student@example.com",
            amount: 7500,
            currency: "ZAR",
            reference: undefined,
            callback_url: "https://campus.example.com/payment-callback.html",
            metadata: {
                orderId: "order-1",
                customerUid: "customer-1",
                vendorUid: "vendor-1",
                provider: "paystack"
            }
        });
    });

    test("starts a fresh transaction for incomplete pending attempts that have no resume URL", async () => {
        const client = {
            initializeTransaction: jest.fn(async () => ({
                data: {
                    authorizationUrl: "https://checkout.paystack.com/new",
                    accessCode: "new-access",
                    reference: "new-ref"
                }
            }))
        };

        const result = await initializePayment(createOrder({
            paymentStatus: "pending",
            paymentReference: "stale-ref",
            paymentAuthorizationUrl: ""
        }), {
            client,
            callbackURL: "https://campus.example.com/payment-callback.html",
            timestampValue: "server-time"
        });

        expect(result.success).toBe(true);
        expect(result.resumed).toBeUndefined();
        expect(result.authorizationUrl).toBe("https://checkout.paystack.com/new");
        expect(result.reference).toBe("new-ref");
        expect(result.accessCode).toBe("new-access");
        expect(client.initializeTransaction).toHaveBeenCalledTimes(1);
    });

    test("builds a resume result helper and ignores retryable payments that need a new attempt", () => {
        const resumeResult = initializePayment.buildExistingPaymentResumeResult(createOrder({
            paymentStatus: "pending",
            paymentReference: "resume-ref",
            paymentAuthorizationUrl: "https://checkout.paystack.com/resume"
        }));
        const retryResult = initializePayment.buildExistingPaymentResumeResult(createOrder({
            paymentStatus: "failed",
            paymentReference: "failed-ref"
        }));

        expect(resumeResult).toEqual(expect.objectContaining({
            success: true,
            resumed: true,
            authorizationUrl: "https://checkout.paystack.com/resume",
            reference: "resume-ref"
        }));
        expect(retryResult).toBeNull();
    });

    test("returns validation failures before contacting Paystack", async () => {
        const client = {
            initializeTransaction: jest.fn()
        };
        const result = await initializePayment(createOrder({
            customerEmail: "",
            paymentAmount: 0,
            paymentAmountInMinorUnits: 0
        }), {
            client
        });

        expect(result.success).toBe(false);
        expect(result.error).toEqual(
            expect.objectContaining({
                code: "payments/invalid-initialize-input"
            })
        );
        expect(result.validationErrors).toEqual(
            expect.objectContaining({
                customerEmail: "Customer email is required before starting payment."
            })
        );
        expect(client.initializeTransaction).not.toHaveBeenCalled();
    });

    test("requires a usable Paystack client", async () => {
        await expect(
            initializePayment(createOrder(), {
                client: {},
                callbackUrl: "https://example.com/callback.html"
            })
        ).resolves.toEqual(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: "payments/paystack-client-unavailable"
                })
            })
        );
    });

    test("rejects incomplete Paystack initialize responses", async () => {
        const result = await initializePayment(createOrder(), {
            client: {
                initializeTransaction: jest.fn(async () => ({
                    status: true,
                    data: {
                        reference: "ref-only"
                    }
                }))
            },
            callbackUrl: "https://example.com/callback.html"
        });

        expect(result.success).toBe(false);
        expect(result.error).toEqual(
            expect.objectContaining({
                code: "payments/invalid-paystack-initialize-response"
            })
        );
        expect(result.paystackResponse).toEqual({
            status: true,
            data: {
                reference: "ref-only"
            }
        });
    });

    test("wraps Paystack client errors", async () => {
        const paystackError = new Error("network down");
        paystackError.code = "paystack/network-error";

        const result = await initializePayment(createOrder(), {
            client: {
                initializeTransaction: jest.fn(async () => {
                    throw paystackError;
                })
            },
            callbackUrl: "https://example.com/callback.html"
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
            prepareInitializePayment: jest.fn(() => ({
                success: true,
                payment: {
                    orderId: "order-custom",
                    reference: "local-ref"
                },
                payload: {
                    email: "student@example.com",
                    amount: 1000
                }
            })),
            applyInitializedPayment: jest.fn(() => ({
                success: true,
                payment: {
                    orderId: "order-custom",
                    reference: "paystack-ref"
                },
                patch: {
                    paymentReference: "paystack-ref"
                }
            }))
        };
        const client = {
            initializeTransaction: jest.fn(async () => ({
                data: {
                    authorization_url: "https://checkout.paystack.com/test",
                    access_code: "access-code",
                    reference: "paystack-ref"
                }
            }))
        };

        jest.resetModules();
        jest.doMock("../../../functions/shared/payments/payment-service.js", () => paymentService);

        let isolatedInitializePayment;
        jest.isolateModules(() => {
            isolatedInitializePayment = require("../../../functions/payments/initialize-payment.js");
        });

        const result = await isolatedInitializePayment(createOrder(), {
            client,
            callbackUrl: "https://example.com/callback.html"
        });

        expect(result.success).toBe(true);
        expect(result.payment).toEqual({
            orderId: "order-custom",
            reference: "paystack-ref"
        });
        expect(result.patch).toEqual({
            paymentReference: "paystack-ref"
        });
        expect(paymentService.prepareInitializePayment).toHaveBeenCalledTimes(1);
        expect(paymentService.applyInitializedPayment).toHaveBeenCalledTimes(1);

        jest.dontMock("../../../functions/shared/payments/payment-service.js");
        jest.resetModules();
    });
});
