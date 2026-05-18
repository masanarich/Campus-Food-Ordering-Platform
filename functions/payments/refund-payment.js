"use strict";

const MODULE_NAME = "refund-payment";

console.log("test refund-payment");

async function refundPayment() {
    return {
        success: false,
        placeholder: true,
        moduleName: MODULE_NAME
    };
}

module.exports = refundPayment;
module.exports.MODULE_NAME = MODULE_NAME;
