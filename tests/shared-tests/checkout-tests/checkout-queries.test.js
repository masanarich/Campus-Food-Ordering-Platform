const checkoutQueries = require("../../../public/shared/checkout/checkout-queries.js");

describe("shared/checkout/checkout-queries.js", () => {
    test("placeholder module is wired", () => {
        expect(checkoutQueries.MODULE_NAME).toBe("checkout-queries");
    });
});
