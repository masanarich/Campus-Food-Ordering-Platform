(function attachVendorOrderManagementPage(globalScope) {
    "use strict";

    function initializeVendorOrderManagementPage() {
        const message = "vendor/order-management/index: testing...";
        console.log(message);

        const statusElement = document.getElementById("vendor-order-management-status");

        if (statusElement) {
            statusElement.textContent = message;
        }

        return message;
    }

    const vendorOrderManagementPage = {
        initializeVendorOrderManagementPage
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = vendorOrderManagementPage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.vendorOrderManagementPage = vendorOrderManagementPage;
    }

    if (typeof document !== "undefined") {
        document.addEventListener("DOMContentLoaded", initializeVendorOrderManagementPage);
    }
})(typeof window !== "undefined" ? window : globalThis);
