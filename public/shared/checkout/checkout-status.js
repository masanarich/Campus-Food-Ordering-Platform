(function attachCheckoutStatus(globalScope) {
    "use strict";

    const MODULE_NAME = "checkout-status";

    console.log("test checkout-status");

    const checkoutStatus = {
        MODULE_NAME
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = checkoutStatus;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.checkoutStatus = checkoutStatus;
    }
})(typeof window !== "undefined" ? window : globalThis);
