const checkoutStatus = require("../../../public/shared/checkout/checkout-status.js");

describe("shared/checkout/checkout-status.js", () => {
    test("placeholder module is wired", () => {
        expect(checkoutStatus.MODULE_NAME).toBe("checkout-status");
    });
});
