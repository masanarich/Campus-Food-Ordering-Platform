"use strict";

const initializePayment = require("./payments/initialize-payment.js");
const verifyPayment = require("./payments/verify-payment.js");

module.exports = {
    initializePayment,
    verifyPayment
};
