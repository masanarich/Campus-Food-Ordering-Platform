(function attachCheckoutValidation(globalScope) {
    "use strict";

    const MODULE_NAME = "checkout-validation";

    console.log("test checkout-validation");

    const checkoutValidation = {
        MODULE_NAME
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = checkoutValidation;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.checkoutValidation = checkoutValidation;
    }
})(typeof window !== "undefined" ? window : globalThis);
