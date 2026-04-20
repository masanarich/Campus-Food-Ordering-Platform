(function attachOrderService(globalScope) {
    "use strict";

    const MODULE_NAME = "order-service";

    function logTesting() {
        const message = `${MODULE_NAME}: testing...`;
        console.log(message);
        return message;
    }

    const orderService = {
        MODULE_NAME,
        logTesting
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = orderService;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.orderService = orderService;
    }
})(typeof window !== "undefined" ? window : globalThis);
