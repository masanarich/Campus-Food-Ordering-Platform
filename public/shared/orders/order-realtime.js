(function attachOrderRealtime(globalScope) {
    "use strict";

    const MODULE_NAME = "order-realtime";

    function logTesting() {
        const message = `${MODULE_NAME}: testing...`;
        console.log(message);
        return message;
    }

    const orderRealtime = {
        MODULE_NAME,
        logTesting
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = orderRealtime;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.orderRealtime = orderRealtime;
    }
})(typeof window !== "undefined" ? window : globalThis);
