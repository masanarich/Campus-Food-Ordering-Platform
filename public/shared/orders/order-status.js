(function attachOrderStatus(globalScope) {
    "use strict";

    const MODULE_NAME = "order-status";

    function logTesting() {
        const message = `${MODULE_NAME}: testing...`;
        console.log(message);
        return message;
    }

    const orderStatus = {
        MODULE_NAME,
        logTesting
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = orderStatus;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.orderStatus = orderStatus;
    }
})(typeof window !== "undefined" ? window : globalThis);
