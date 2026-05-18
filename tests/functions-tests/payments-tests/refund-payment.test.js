const refundPayment = require("../../../functions/payments/refund-payment.js");

describe("functions/payments/refund-payment.js", () => {
    test("placeholder module is wired", async () => {
        await expect(refundPayment()).resolves.toEqual({
            success: false,
            placeholder: true,
            moduleName: "refund-payment"
        });
        expect(refundPayment.MODULE_NAME).toBe("refund-payment");
    });
});
