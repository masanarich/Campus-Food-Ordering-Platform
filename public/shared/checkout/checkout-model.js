(function attachCheckoutModel(globalScope) {
    "use strict";

    const MODULE_NAME = "checkout-model";

    console.log("test checkout-model");

    const checkoutModel = {
        MODULE_NAME
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = checkoutModel;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.checkoutModel = checkoutModel;
    }
})(typeof window !== "undefined" ? window : globalThis);
