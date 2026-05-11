const functionsIndex = require("../../functions/index.js");

describe("functions/index.js", () => {
    test("exports callable payment functions and helper utilities", () => {
        expect(functionsIndex.DEFAULT_REGION).toBe("africa-south1");
        expect(typeof functionsIndex.initializePayment).toBe("function");
        expect(typeof functionsIndex.verifyPayment).toBe("function");
        expect(typeof functionsIndex.createInitializePaymentHandler).toBe("function");
        expect(typeof functionsIndex.createVerifyPaymentHandler).toBe("function");
        expect(functionsIndex.optionalRequire("definitely-not-installed-module")).toBeNull();
    });

    test("normalizes callable data and auth context", () => {
        expect(
            functionsIndex.normalizeCallableData({
                data: {
                    orderId: "order-1"
                }
            })
        ).toEqual({
            orderId: "order-1"
        });
        expect(functionsIndex.normalizeCallableData({ data: null })).toEqual({});

        expect(
            functionsIndex.normalizeAuthContext({
                auth: {
                    uid: "customer-1",
                    token: {
                        email: "student@example.com"
                    }
                }
            })
        ).toEqual({
            uid: "customer-1",
            token: {
                email: "student@example.com"
            }
        });
        expect(functionsIndex.normalizeAuthContext({})).toEqual({
            uid: "",
            token: {}
        });
    });

    test("creates local callable wrappers for tests and fallback environments", async () => {
        const handler = jest.fn(async request => ({
            data: functionsIndex.normalizeCallableData(request)
        }));
        const callable = functionsIndex.createLocalCallable({
            region: "africa-south1"
        }, handler);

        await expect(callable({
            data: {
                ok: true
            }
        })).resolves.toEqual({
            data: {
                ok: true
            }
        });
        expect(callable.__isLocalCallable).toBe(true);
        expect(callable.__triggerOptions).toEqual({
            region: "africa-south1"
        });
        expect(handler).toHaveBeenCalledTimes(1);
    });

    test("sanitizes callable results and converts failures to callable errors", () => {
        const cause = new Error("secret stack should not be returned");
        cause.code = "paystack/network-error";
        const result = {
            success: false,
            error: {
                code: "payments/problem",
                message: "Payment failed.",
                cause
            }
        };

        expect(functionsIndex.sanitizeForCallable(result)).toEqual({
            success: false,
            error: {
                code: "payments/problem",
                message: "Payment failed."
            }
        });

        expect(() => functionsIndex.assertSuccessfulPaymentResult(result, "Fallback"))
            .toThrow("Payment failed.");
        expect(
            functionsIndex.assertSuccessfulPaymentResult({
                success: true,
                error: {
                    cause
                }
            }, "Fallback")
        ).toEqual({
            success: true,
            error: {}
        });
    });

    test("creates initialize payment handler with injected dependency", async () => {
        const initializePayment = jest.fn(async () => ({
            success: true,
            payment: {
                orderId: "order-1"
            },
            authorizationUrl: "https://checkout.paystack.com/test"
        }));
        const handler = functionsIndex.createInitializePaymentHandler({
            initializePayment
        });

        await expect(
            handler({
                data: {
                    order: {
                        orderId: "order-1"
                    },
                    options: {
                        callbackUrl: "https://example.com/callback.html"
                    }
                },
                auth: {
                    uid: "customer-1",
                    token: {
                        email: "student@example.com"
                    }
                }
            })
        ).resolves.toEqual({
            success: true,
            payment: {
                orderId: "order-1"
            },
            authorizationUrl: "https://checkout.paystack.com/test"
        });

        expect(initializePayment).toHaveBeenCalledWith(
            {
                orderId: "order-1"
            },
            {
                callbackUrl: "https://example.com/callback.html",
                actorUid: "customer-1",
                auth: {
                    uid: "customer-1",
                    token: {
                        email: "student@example.com"
                    }
                }
            }
        );
    });

    test("creates verify payment handler with injected dependency", async () => {
        const verifyPayment = jest.fn(async () => ({
            success: true,
            payment: {
                orderId: "order-1",
                status: "paid"
            },
            patch: {
                paymentStatus: "paid"
            }
        }));
        const handler = functionsIndex.createVerifyPaymentHandler({
            verifyPayment
        });

        await expect(
            handler({
                data: {
                    payment: {
                        orderId: "order-1"
                    },
                    reference: "paystack-ref",
                    options: {
                        timestampValue: "server-time"
                    }
                },
                auth: {
                    uid: "customer-1"
                }
            })
        ).resolves.toEqual({
            success: true,
            payment: {
                orderId: "order-1",
                status: "paid"
            },
            patch: {
                paymentStatus: "paid"
            }
        });

        expect(verifyPayment).toHaveBeenCalledWith(
            {
                orderId: "order-1"
            },
            {
                reference: "paystack-ref",
                timestampValue: "server-time",
                actorUid: "customer-1",
                auth: {
                    uid: "customer-1",
                    token: {}
                }
            }
        );
    });

    test("builds payment callables with custom onCall", async () => {
        const onCall = jest.fn((options, handler) => ({
            options,
            handler
        }));
        const initializePayment = jest.fn(async () => ({
            success: true,
            marker: "initialized"
        }));
        const verifyPayment = jest.fn(async () => ({
            success: true,
            marker: "verified"
        }));

        const paymentFunctions = functionsIndex.createPaymentFunctions({
            region: "europe-west1",
            cors: false,
            onCall,
            dependencies: {
                initializePayment,
                verifyPayment
            }
        });

        expect(onCall).toHaveBeenCalledTimes(2);
        expect(paymentFunctions.initializePayment.options).toEqual({
            region: "europe-west1",
            cors: false
        });
        expect(paymentFunctions.verifyPayment.options).toEqual({
            region: "europe-west1",
            cors: false
        });

        await expect(
            paymentFunctions.initializePayment.handler({
                data: {
                    order: {}
                }
            })
        ).resolves.toEqual({
            success: true,
            marker: "initialized"
        });
        await expect(
            paymentFunctions.verifyPayment.handler({
                data: {
                    payment: {},
                    reference: "ref-1"
                }
            })
        ).resolves.toEqual({
            success: true,
            marker: "verified"
        });
    });

    test("handlers throw callable errors when payment work fails", async () => {
        const handler = functionsIndex.createInitializePaymentHandler({
            initializePayment: jest.fn(async () => ({
                success: false,
                error: {
                    code: "payments/problem",
                    message: "Could not initialize."
                }
            }))
        });

        await expect(handler({
            data: {
                order: {}
            }
        })).rejects.toMatchObject({
            name: "HttpsError",
            code: "failed-precondition",
            message: "Could not initialize."
        });
    });
});
