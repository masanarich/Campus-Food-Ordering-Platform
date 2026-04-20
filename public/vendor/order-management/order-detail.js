(function attachVendorOrderDetailPage(globalScope) {
    "use strict";

    function initializeVendorOrderDetailPage() {
        const message = "vendor/order-management/order-detail: testing...";
        console.log(message);

        const statusElement = document.getElementById("vendor-order-detail-status");

        if (statusElement) {
            statusElement.textContent = message;
        }

        return message;
    }

    const vendorOrderDetailPage = {
        initializeVendorOrderDetailPage
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = vendorOrderDetailPage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.vendorOrderDetailPage = vendorOrderDetailPage;
    }

    if (typeof document !== "undefined") {
        document.addEventListener("DOMContentLoaded", initializeVendorOrderDetailPage);
    }
})(typeof window !== "undefined" ? window : globalThis);
