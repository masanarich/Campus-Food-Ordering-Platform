"use strict";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

function createPaystackClient(options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};

    return {
        baseUrl: safeOptions.baseUrl || PAYSTACK_BASE_URL,
        secretKey: safeOptions.secretKey || process.env.PAYSTACK_SECRET_KEY || "",
        environment: safeOptions.environment || process.env.PAYSTACK_ENV || "test"
    };
}

module.exports = {
    PAYSTACK_BASE_URL,
    createPaystackClient
};
