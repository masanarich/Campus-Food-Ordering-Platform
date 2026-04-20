(function attachVendorOrderNotifications(globalScope) {
    "use strict";

    function logTesting() {
        const message = "vendor/order-management/notifications: testing...";
        console.log(message);
        return message;
    }

    const vendorOrderNotifications = {
        logTesting
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = vendorOrderNotifications;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.vendorOrderNotifications = vendorOrderNotifications;
    }
})(typeof window !== "undefined" ? window : globalThis);
