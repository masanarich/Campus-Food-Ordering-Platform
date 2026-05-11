(function attachPaymentStatus(globalScope) {
    "use strict";

    const PAYMENT_STATUSES = {
        UNPAID: "unpaid",
        PENDING: "pending",
        PAID: "paid",
        FAILED: "failed"
    };

    function normalizePaymentStatus(value) {
        const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";

        return Object.values(PAYMENT_STATUSES).includes(normalized)
            ? normalized
            : PAYMENT_STATUSES.UNPAID;
    }

    const paymentStatus = {
        PAYMENT_STATUSES,
        normalizePaymentStatus
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = paymentStatus;
    }

    if (globalScope) {
        globalScope.paymentStatus = paymentStatus;
    }
})(typeof window !== "undefined" ? window : globalThis);
