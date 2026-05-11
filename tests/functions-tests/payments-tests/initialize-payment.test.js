const initializePayment = require("../../../functions/payments/initialize-payment.js");

describe("functions/payments/initialize-payment.js", () => {
    test("returns a placeholder initialize payment response", () => {
        const result = initializePayment({
            clientOptions: {
                secretKey: "sk_test_example"
            }
        });

        expect(result.success).toBe(false);
        expect(result.provider).toBe("paystack");
        expect(result.message).toContain("not implemented yet");
    });
});
