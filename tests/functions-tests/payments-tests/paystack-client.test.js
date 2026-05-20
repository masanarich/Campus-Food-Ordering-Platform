const paystackClient = require("../../../functions/payments/paystack-client.js");

function createJsonResponse(body, overrides = {}) {
    return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: jest.fn(async () => body),
        ...overrides
    };
}

describe("functions/payments/paystack-client.js", () => {
    test("exports constants and normalizes client configuration", () => {
        const originalSecretKey = process.env.PAYSTACK_SECRET_KEY;
        const originalEnvironment = process.env.PAYSTACK_ENV;

        process.env.PAYSTACK_SECRET_KEY = "  sk_test_env  ";
        process.env.PAYSTACK_ENV = " TEST ";

        const client = paystackClient.createPaystackClient({
            baseUrl: "https://api.paystack.co///",
            fetchFn: jest.fn()
        });

        expect(paystackClient.PAYSTACK_BASE_URL).toBe("https://api.paystack.co");
        expect(paystackClient.PAYSTACK_INITIALIZE_TRANSACTION_PATH).toBe("/transaction/initialize");
        expect(paystackClient.PAYSTACK_VERIFY_TRANSACTION_PATH).toBe("/transaction/verify");
        expect(paystackClient.PAYSTACK_REFUND_PATH).toBe("/refund");
        expect(client.baseUrl).toBe("https://api.paystack.co");
        expect(client.secretKey).toBe("sk_test_env");
        expect(client.environment).toBe("test");
        expect(paystackClient.normalizeText("  hello  ")).toBe("hello");
        expect(paystackClient.normalizeLowerText(" TEST ")).toBe("test");
        expect(paystackClient.normalizeBaseUrl("https://example.com///")).toBe("https://example.com");

        process.env.PAYSTACK_SECRET_KEY = originalSecretKey;
        process.env.PAYSTACK_ENV = originalEnvironment;
    });

    test("builds URLs, query strings, and authorization headers", () => {
        expect(
            paystackClient.buildQueryString({
                page: 1,
                empty: "",
                ignored: null,
                search: "Campus Bites"
            })
        ).toBe("?page=1&search=Campus+Bites");

        expect(
            paystackClient.buildPaystackUrl([
                "transaction",
                "verify",
                "ref/with space"
            ], {
                baseUrl: "https://api.paystack.co/",
                query: { channel: "bank" }
            })
        ).toBe("https://api.paystack.co/transaction/verify/ref%2Fwith%20space?channel=bank");

        expect(
            paystackClient.buildPaystackUrl("/transaction/initialize", {
                baseUrl: "https://api.paystack.co/"
            })
        ).toBe("https://api.paystack.co/transaction/initialize");

        expect(
            paystackClient.createAuthorizationHeaders("sk_test_example", {
                "Content-Type": "application/json"
            })
        ).toEqual({
            Authorization: "Bearer sk_test_example",
            "Content-Type": "application/json"
        });

        expect(() => paystackClient.createAuthorizationHeaders(""))
            .toThrow("PAYSTACK_SECRET_KEY is required before contacting Paystack.");
    });

    test("parses JSON and text responses", async () => {
        await expect(
            paystackClient.parsePaystackResponse(createJsonResponse({ status: true }))
        ).resolves.toEqual({ status: true });

        await expect(
            paystackClient.parsePaystackResponse({
                text: jest.fn(async () => "{\"message\":\"ok\"}")
            })
        ).resolves.toEqual({ message: "ok" });

        await expect(
            paystackClient.parsePaystackResponse({
                text: jest.fn(async () => "plain error")
            })
        ).resolves.toEqual({ message: "plain error" });

        await expect(
            paystackClient.parsePaystackResponse({
                json: jest.fn(async () => {
                    throw new Error("bad json");
                })
            })
        ).resolves.toBeNull();

        await expect(
            paystackClient.parsePaystackResponse({
                text: jest.fn(async () => "   ")
            })
        ).resolves.toBeNull();

        await expect(paystackClient.parsePaystackResponse(null)).resolves.toBeNull();
        await expect(paystackClient.parsePaystackResponse({})).resolves.toBeNull();
    });

    test("initializes Paystack transactions through the backend client", async () => {
        const fetchFn = jest.fn(async () => createJsonResponse({
            status: true,
            message: "Authorization URL created",
            data: {
                authorization_url: "https://checkout.paystack.com/test",
                access_code: "access-code",
                reference: "order-ref"
            }
        }));
        const client = paystackClient.createPaystackClient({
            secretKey: "sk_test_example",
            fetchFn
        });

        await expect(
            client.initializeTransaction({
                email: "student@example.com",
                amount: 7500,
                currency: "ZAR",
                reference: "order-ref",
                callback_url: "https://example.com/payment-callback.html"
            })
        ).resolves.toEqual({
            status: true,
            message: "Authorization URL created",
            data: {
                authorization_url: "https://checkout.paystack.com/test",
                access_code: "access-code",
                reference: "order-ref"
            }
        });

        expect(fetchFn).toHaveBeenCalledWith(
            "https://api.paystack.co/transaction/initialize",
            {
                method: "POST",
                headers: {
                    Authorization: "Bearer sk_test_example",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: "student@example.com",
                    amount: 7500,
                    currency: "ZAR",
                    reference: "order-ref",
                    callback_url: "https://example.com/payment-callback.html"
                })
            }
        );
    });

    test("verifies Paystack transactions by encoded reference", async () => {
        const fetchFn = jest.fn(async () => createJsonResponse({
            status: true,
            message: "Verification successful",
            data: {
                status: "success",
                reference: "order ref"
            }
        }));
        const client = paystackClient.createPaystackClient({
            secretKey: "sk_test_example",
            fetchFn
        });

        await expect(client.verifyTransaction(" order ref "))
            .resolves.toEqual({
                status: true,
                message: "Verification successful",
                data: {
                    status: "success",
                    reference: "order ref"
                }
            });

        expect(fetchFn).toHaveBeenCalledWith(
            "https://api.paystack.co/transaction/verify/order%20ref",
            {
                method: "GET",
                headers: {
                    Authorization: "Bearer sk_test_example"
                }
            }
        );

        await expect(client.verifyTransaction(""))
            .rejects.toMatchObject({
                code: "paystack/missing-reference"
            });
    });

    test("creates Paystack refunds through first-class refund helpers", async () => {
        const fetchFn = jest.fn(async () => createJsonResponse({
            status: true,
            message: "Refund created",
            data: {
                id: "refund-1",
                reference: "refund-ref",
                amount: 2500,
                status: "pending"
            }
        }));
        const client = paystackClient.createPaystackClient({
            secretKey: "sk_test_example",
            fetchFn
        });
        const payload = {
            transaction: "paystack-ref",
            amount: 2500,
            currency: "ZAR",
            merchant_note: "Vendor rejected"
        };

        await expect(client.createRefund(payload)).resolves.toEqual({
            status: true,
            message: "Refund created",
            data: {
                id: "refund-1",
                reference: "refund-ref",
                amount: 2500,
                status: "pending"
            }
        });
        await expect(client.refundTransaction(payload)).resolves.toEqual({
            status: true,
            message: "Refund created",
            data: {
                id: "refund-1",
                reference: "refund-ref",
                amount: 2500,
                status: "pending"
            }
        });
        await expect(client.refund(payload)).resolves.toEqual({
            status: true,
            message: "Refund created",
            data: {
                id: "refund-1",
                reference: "refund-ref",
                amount: 2500,
                status: "pending"
            }
        });

        expect(fetchFn).toHaveBeenNthCalledWith(
            1,
            "https://api.paystack.co/refund",
            {
                method: "POST",
                headers: {
                    Authorization: "Bearer sk_test_example",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            }
        );
        expect(fetchFn).toHaveBeenCalledTimes(3);
    });

    test("sends custom request headers, query strings, and pre-serialized bodies", async () => {
        const fetchFn = jest.fn(async () => createJsonResponse({
            status: true
        }));
        const client = paystackClient.createPaystackClient({
            secretKey: "sk_test_example",
            fetchFn
        });

        await expect(client.request("/custom/path", {
            method: "post",
            body: "{\"ok\":true}",
            query: {
                page: 1
            },
            headers: {
                "X-Trace-Id": "trace-1"
            }
        })).resolves.toEqual({
            status: true
        });

        expect(fetchFn).toHaveBeenCalledWith(
            "https://api.paystack.co/custom/path?page=1",
            {
                method: "POST",
                headers: {
                    Authorization: "Bearer sk_test_example",
                    "Content-Type": "application/json",
                    "X-Trace-Id": "trace-1"
                },
                body: "{\"ok\":true}"
            }
        );
    });

    test("rejects requests when configuration or Paystack responses fail", async () => {
        const missingFetchClient = paystackClient.createPaystackClient({
            secretKey: "sk_test_example",
            fetchFn: null
        });
        const missingSecretClient = paystackClient.createPaystackClient({
            secretKey: "",
            fetchFn: jest.fn()
        });
        const httpFailureClient = paystackClient.createPaystackClient({
            secretKey: "sk_test_example",
            fetchFn: jest.fn(async () => createJsonResponse(
                {
                    status: false,
                    message: "Invalid key"
                },
                {
                    ok: false,
                    status: 401,
                    statusText: "Unauthorized"
                }
            ))
        });
        const networkFailureClient = paystackClient.createPaystackClient({
            secretKey: "sk_test_example",
            fetchFn: jest.fn(async () => {
                throw new Error("network down");
            })
        });

        await expect(missingFetchClient.request("/transaction/initialize"))
            .rejects.toMatchObject({
                code: "paystack/fetch-unavailable"
            });

        await expect(missingSecretClient.request("/transaction/initialize"))
            .rejects.toMatchObject({
                code: "paystack/missing-secret-key"
            });

        await expect(httpFailureClient.request("/transaction/initialize"))
            .rejects.toMatchObject({
                code: "paystack/http-error",
                status: 401,
                body: {
                    status: false,
                    message: "Invalid key"
                }
            });

        await expect(networkFailureClient.request("/transaction/initialize"))
            .rejects.toMatchObject({
                code: "paystack/network-error",
                url: "https://api.paystack.co/transaction/initialize",
                method: "GET"
            });
    });
});
