(function attachCustomerOrderManagementCart(globalScope) {
    "use strict";

    function logTesting() {
        const message = "customer/order-management/cart: testing...";
        console.log(message);
        return message;
    }

    const customerOrderManagementCart = {
        logTesting
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerOrderManagementCart;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.customerOrderManagementCart = customerOrderManagementCart;
    }
})(typeof window !== "undefined" ? window : globalThis);
