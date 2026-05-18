const checkoutModel = require("../../../public/shared/checkout/checkout-model.js");

describe("shared/checkout/checkout-model.js", () => {
    test("placeholder module is wired", () => {
        expect(checkoutModel.MODULE_NAME).toBe("checkout-model");
    });
});
