(function attachOrderFormatters(globalScope) {
    "use strict";

    const MODULE_NAME = "order-formatters";

    function logTesting() {
        const message = `${MODULE_NAME}: testing...`;
        console.log(message);
        return message;
    }

    const orderFormatters = {
        MODULE_NAME,
        logTesting
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = orderFormatters;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.orderFormatters = orderFormatters;
    }
})(typeof window !== "undefined" ? window : globalThis);
