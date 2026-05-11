const paymentValidation = require("../../../public/shared/payments/payment-validation.js");

describe("shared/payments/payment-validation.js", () => {
    test("validates positive payment amounts", () => {
        expect(paymentValidation.validatePaymentAmount(100).isValid).toBe(true);
        expect(paymentValidation.validatePaymentAmount(0).isValid).toBe(false);
    });
});
