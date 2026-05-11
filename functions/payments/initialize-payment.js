"use strict";

const { createPaystackClient } = require("./paystack-client.js");

function initializePayment(options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};

    return {
        success: false,
        provider: "paystack",
        client: createPaystackClient(safeOptions.clientOptions),
        message: "Paystack initialize payment function is not implemented yet."
    };
}

module.exports = initializePayment;
