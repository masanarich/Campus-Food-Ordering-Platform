const refundStatus = require("../../../public/shared/payments/refund-status.js");

describe("shared/payments/refund-status.js", () => {
    test("placeholder module is wired", () => {
        expect(refundStatus.MODULE_NAME).toBe("refund-status");
    });
});
