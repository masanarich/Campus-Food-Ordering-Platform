const paystackClient = require("../../../functions/payments/paystack-client.js");

describe("functions/payments/paystack-client.js", () => {
    test("creates a placeholder Paystack client configuration", () => {
        const client = paystackClient.createPaystackClient({
            secretKey: "sk_test_example"
        });

        expect(client.baseUrl).toBe(paystackClient.PAYSTACK_BASE_URL);
        expect(client.secretKey).toBe("sk_test_example");
        expect(client.environment).toBe("test");
    });
});
