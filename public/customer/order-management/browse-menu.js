(function attachCustomerBrowseMenu(globalScope) {
    "use strict";

    function logTesting() {
        const message = "customer/order-management/browse-menu: testing...";
        console.log(message);
        return message;
    }

    const customerBrowseMenu = {
        logTesting
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerBrowseMenu;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.customerBrowseMenu = customerBrowseMenu;
    }
})(typeof window !== "undefined" ? window : globalThis);
