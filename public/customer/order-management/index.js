(function attachCustomerOrderManagementPage(globalScope) {
    "use strict";

    const MODULE_NAME = "customer/order-management/index";

    function initializeOrderManagementPage(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const documentRef = safeOptions.document || globalScope.document;
        const statusElement = documentRef
            ? documentRef.getElementById("order-management-status")
            : null;
        const message = `${MODULE_NAME}: testing...`;

        if (statusElement) {
            statusElement.textContent = message;
        }

        return message;
    }

    const customerOrderManagementPage = {
        MODULE_NAME,
        initializeOrderManagementPage
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerOrderManagementPage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.customerOrderManagementPage = customerOrderManagementPage;
    }
})(typeof window !== "undefined" ? window : globalThis);
