(function attachPaymentFormatters(globalScope) {
    "use strict";

    function formatPaymentAmount(amount, currency = "ZAR") {
        const parsed = Number(amount);
        const safeAmount = Number.isFinite(parsed) ? parsed : 0;

        return `${currency} ${safeAmount.toFixed(2)}`;
    }

    const paymentFormatters = {
        formatPaymentAmount
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = paymentFormatters;
    }

    if (globalScope) {
        globalScope.paymentFormatters = paymentFormatters;
    }
})(typeof window !== "undefined" ? window : globalThis);
