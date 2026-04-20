(function attachOrderValidation(globalScope) {
    "use strict";

    const MODULE_NAME = "order-validation";

    function logTesting() {
        const message = `${MODULE_NAME}: testing...`;
        console.log(message);
        return message;
    }

    const orderValidation = {
        MODULE_NAME,
        logTesting
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = orderValidation;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.orderValidation = orderValidation;
    }
})(typeof window !== "undefined" ? window : globalThis);
