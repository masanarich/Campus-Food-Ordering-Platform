(function attachCustomerCheckout(globalScope) {
    "use strict";

    function logTesting() {
        const message = "customer/order-management/checkout: testing...";
        console.log(message);
        return message;
    }

    const customerCheckout = {
        logTesting
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerCheckout;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.customerCheckout = customerCheckout;
    }
})(typeof window !== "undefined" ? window : globalThis);
