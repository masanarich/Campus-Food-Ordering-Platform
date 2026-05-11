const paymentService = require("../../../public/shared/payments/payment-service.js");

describe("shared/payments/payment-service.js", () => {
    test("creates a placeholder payment result", () => {
        expect(paymentService.createPaymentResult(true, {
            reference: "ref-1"
        })).toEqual(expect.objectContaining({
            success: true,
            provider: "paystack",
            reference: "ref-1"
        }));
    });
});
