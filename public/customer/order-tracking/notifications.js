(function attachCustomerOrderNotificationsPage(globalScope) {
    "use strict";

    function initializeNotificationsPage() {
        const message = "customer/order-tracking/notifications: testing...";
        console.log(message);

        const statusElement = document.getElementById("order-tracking-notifications-status");

        if (statusElement) {
            statusElement.textContent = message;
        }

        return message;
    }

    const customerOrderNotificationsPage = {
        initializeNotificationsPage
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerOrderNotificationsPage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.customerOrderNotificationsPage = customerOrderNotificationsPage;
    }

    if (typeof document !== "undefined") {
        document.addEventListener("DOMContentLoaded", initializeNotificationsPage);
    }
})(typeof window !== "undefined" ? window : globalThis);
