const checkoutService = require("../../../public/shared/checkout/checkout-service.js");

describe("shared/checkout/checkout-service.js", () => {
    test("placeholder module is wired", () => {
        expect(checkoutService.MODULE_NAME).toBe("checkout-service");
    });
});
