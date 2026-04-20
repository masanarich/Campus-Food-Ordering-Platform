(function attachOrderQueries(globalScope) {
    "use strict";

    const MODULE_NAME = "order-queries";

    function logTesting() {
        const message = `${MODULE_NAME}: testing...`;
        console.log(message);
        return message;
    }

    const orderQueries = {
        MODULE_NAME,
        logTesting
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = orderQueries;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.orderQueries = orderQueries;
    }
})(typeof window !== "undefined" ? window : globalThis);
