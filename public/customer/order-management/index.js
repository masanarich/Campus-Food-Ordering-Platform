(function attachCustomerOrderManagementPage(globalScope) {
    "use strict";

    function initializeOrderManagementPage() {
        const message = "customer/order-management/index: testing...";
        console.log(message);

        const statusElement = document.getElementById("order-management-status");

        if (statusElement) {
            statusElement.textContent = message;
        }

        return message;
    }

    const customerOrderManagementPage = {
        initializeOrderManagementPage
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerOrderManagementPage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.customerOrderManagementPage = customerOrderManagementPage;
    }

    if (typeof document !== "undefined") {
        document.addEventListener("DOMContentLoaded", initializeOrderManagementPage);
    }
})(typeof window !== "undefined" ? window : globalThis);
