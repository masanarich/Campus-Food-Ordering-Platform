const verifyPayment = require("../../../functions/payments/verify-payment.js");

describe("functions/payments/verify-payment.js", () => {
    test("returns a placeholder verify payment response", () => {
        const result = verifyPayment({
            reference: "test-reference"
        });

        expect(result.success).toBe(false);
        expect(result.provider).toBe("paystack");
        expect(result.reference).toBe("test-reference");
    });
});
