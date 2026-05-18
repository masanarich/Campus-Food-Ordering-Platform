(function attachCheckoutQueries(globalScope) {
    "use strict";

    const MODULE_NAME = "checkout-queries";

    console.log("test checkout-queries");

    const checkoutQueries = {
        MODULE_NAME
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = checkoutQueries;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.checkoutQueries = checkoutQueries;
    }
})(typeof window !== "undefined" ? window : globalThis);
