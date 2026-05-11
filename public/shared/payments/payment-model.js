(function attachPaymentModel(globalScope) {
    "use strict";

    function createPaymentRecord(details = {}) {
        const safeDetails = details && typeof details === "object" ? details : {};

        return {
            provider: safeDetails.provider || "paystack",
            reference: safeDetails.reference || "",
            status: safeDetails.status || "unpaid",
            amount: Number.isFinite(Number(safeDetails.amount)) ? Number(safeDetails.amount) : 0,
            currency: safeDetails.currency || "ZAR"
        };
    }

    const paymentModel = {
        createPaymentRecord
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = paymentModel;
    }

    if (globalScope) {
        globalScope.paymentModel = paymentModel;
    }
})(typeof window !== "undefined" ? window : globalThis);
