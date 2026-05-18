const checkoutValidation = require("../../../public/shared/checkout/checkout-validation.js");

describe("shared/checkout/checkout-validation.js", () => {
    test("placeholder module is wired", () => {
        expect(checkoutValidation.MODULE_NAME).toBe("checkout-validation");
    });
});
