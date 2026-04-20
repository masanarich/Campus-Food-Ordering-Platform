(function attachCustomerBrowseVendors(globalScope) {
    "use strict";

    function logTesting() {
        const message = "customer/order-management/browse-vendors: testing...";
        console.log(message);
        return message;
    }

    const customerBrowseVendors = {
        logTesting
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerBrowseVendors;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.customerBrowseVendors = customerBrowseVendors;
    }
})(typeof window !== "undefined" ? window : globalThis);
