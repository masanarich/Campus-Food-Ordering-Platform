const paymentStatus = require("../../../public/shared/payments/payment-status.js");

describe("shared/payments/payment-status.js", () => {
    test("normalizes supported payment statuses", () => {
        expect(paymentStatus.normalizePaymentStatus("PAID")).toBe("paid");
        expect(paymentStatus.normalizePaymentStatus("unknown")).toBe("unpaid");
    });
});
