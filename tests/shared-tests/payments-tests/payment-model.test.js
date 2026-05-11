const paymentModel = require("../../../public/shared/payments/payment-model.js");

describe("shared/payments/payment-model.js", () => {
    test("creates a placeholder payment record", () => {
        expect(paymentModel.createPaymentRecord({
            reference: "ref-1",
            amount: 12000
        })).toEqual(expect.objectContaining({
            provider: "paystack",
            reference: "ref-1",
            amount: 12000,
            currency: "ZAR"
        }));
    });
});
