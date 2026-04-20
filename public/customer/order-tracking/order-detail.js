(function attachCustomerOrderDetailPage(globalScope) {
    "use strict";

    function initializeOrderDetailPage() {
        const message = "customer/order-tracking/order-detail: testing...";
        console.log(message);

        const statusElement = document.getElementById("order-tracking-detail-status");

        if (statusElement) {
            statusElement.textContent = message;
        }

        return message;
    }

    const customerOrderDetailPage = {
        initializeOrderDetailPage
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerOrderDetailPage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.customerOrderDetailPage = customerOrderDetailPage;
    }

    if (typeof document !== "undefined") {
        document.addEventListener("DOMContentLoaded", initializeOrderDetailPage);
    }
})(typeof window !== "undefined" ? window : globalThis);
