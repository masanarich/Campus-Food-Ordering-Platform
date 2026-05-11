(function attachPaymentValidation(globalScope) {
    "use strict";

    function validatePaymentAmount(amount) {
        const parsed = Number(amount);

        return {
            isValid: Number.isFinite(parsed) && parsed > 0,
            amount: Number.isFinite(parsed) ? parsed : 0
        };
    }

    const paymentValidation = {
        validatePaymentAmount
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = paymentValidation;
    }

    if (globalScope) {
        globalScope.paymentValidation = paymentValidation;
    }
})(typeof window !== "undefined" ? window : globalThis);
