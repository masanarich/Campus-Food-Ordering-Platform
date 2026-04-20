(function attachOrderModel(globalScope) {
    "use strict";

    const MODULE_NAME = "order-model";

    function logTesting() {
        const message = `${MODULE_NAME}: testing...`;
        console.log(message);
        return message;
    }

    const orderModel = {
        MODULE_NAME,
        logTesting
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = orderModel;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.orderModel = orderModel;
    }
})(typeof window !== "undefined" ? window : globalThis);
