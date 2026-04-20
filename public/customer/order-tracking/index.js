(function attachCustomerOrderTrackingPage(globalScope) {
    "use strict";

    function initializeOrderTrackingPage() {
        const message = "customer/order-tracking/index: testing...";
        console.log(message);

        const statusElement = document.getElementById("order-tracking-status");

        if (statusElement) {
            statusElement.textContent = message;
        }

        return message;
    }

    const customerOrderTrackingPage = {
        initializeOrderTrackingPage
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerOrderTrackingPage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.customerOrderTrackingPage = customerOrderTrackingPage;
    }

    if (typeof document !== "undefined") {
        document.addEventListener("DOMContentLoaded", initializeOrderTrackingPage);
    }
})(typeof window !== "undefined" ? window : globalThis);
