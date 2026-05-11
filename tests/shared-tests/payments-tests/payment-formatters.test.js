const paymentFormatters = require("../../../public/shared/payments/payment-formatters.js");

describe("shared/payments/payment-formatters.js", () => {
    test("formats placeholder payment amounts", () => {
        expect(paymentFormatters.formatPaymentAmount(120, "ZAR")).toBe("ZAR 120.00");
    });
});
