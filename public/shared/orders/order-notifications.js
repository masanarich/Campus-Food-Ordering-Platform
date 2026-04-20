(function attachOrderNotifications(globalScope) {
    "use strict";

    const MODULE_NAME = "order-notifications";

    function logTesting() {
        const message = `${MODULE_NAME}: testing...`;
        console.log(message);
        return message;
    }

    const orderNotifications = {
        MODULE_NAME,
        logTesting
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = orderNotifications;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.orderNotifications = orderNotifications;
    }
})(typeof window !== "undefined" ? window : globalThis);
