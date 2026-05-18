(function attachCheckoutService(globalScope) {
    "use strict";

    const MODULE_NAME = "checkout-service";

    console.log("test checkout-service");

    const checkoutService = {
        MODULE_NAME
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = checkoutService;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.checkoutService = checkoutService;
    }
})(typeof window !== "undefined" ? window : globalThis);
