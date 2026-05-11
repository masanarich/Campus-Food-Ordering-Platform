const paymentCallback = require("../../../public/customer/order-management/payment-callback.js");

describe("customer/order-management/payment-callback.js", () => {
    test("initializes the placeholder payment callback module", () => {
        expect(paymentCallback.init()).toEqual(expect.objectContaining({
            success: true,
            moduleName: "customer/order-management/payment-callback"
        }));
    });
});
