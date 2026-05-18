(function attachRefundStatus(globalScope) {
    "use strict";

    const MODULE_NAME = "refund-status";

    console.log("test refund-status");

    const refundStatus = {
        MODULE_NAME
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = refundStatus;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.refundStatus = refundStatus;
    }
})(typeof window !== "undefined" ? window : globalThis);
