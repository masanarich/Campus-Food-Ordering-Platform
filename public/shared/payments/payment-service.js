(function attachPaymentService(globalScope) {
    "use strict";

    function createPaymentResult(success, details = {}) {
        const safeDetails = details && typeof details === "object" ? details : {};

        return {
            success: success === true,
            provider: safeDetails.provider || "paystack",
            ...safeDetails
        };
    }

    const paymentService = {
        createPaymentResult
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = paymentService;
    }

    if (globalScope) {
        globalScope.paymentService = paymentService;
    }
})(typeof window !== "undefined" ? window : globalThis);
