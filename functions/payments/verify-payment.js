"use strict";

const { createPaystackClient } = require("./paystack-client.js");

function verifyPayment(options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};

    return {
        success: false,
        provider: "paystack",
        reference: safeOptions.reference || "",
        client: createPaystackClient(safeOptions.clientOptions),
        message: "Paystack verify payment function is not implemented yet."
    };
}

module.exports = verifyPayment;
