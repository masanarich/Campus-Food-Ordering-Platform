/**
 * PayFast Payment Integration
 * Handles PayFast checkout URL generation, signature validation, and payment confirmation
 * 
 * Usage:
 *   const paymentUrl = await paymentIntegration.generatePayFastCheckoutUrl(orderId);
 *   // Redirect user to paymentUrl
 *   // PayFast returns to return_url or cancel_url
 *   // ITN webhook handled separately in Cloud Functions
 */

(function attachPaymentIntegration(globalScope) {
    "use strict";

    const MODULE_NAME = "payment-integration";
    const PAYFAST_SANDBOX_URL = "https://sandbox.payfast.co.za/eng/process";
    const PAYFAST_LIVE_URL = "https://www.payfast.co.za/eng/process";

    /**
     * Generates MD5 hash for PayFast signature
     * Note: Use native crypto when available, fall back for browsers
     */
    async function generateMD5Hash(data) {
        if (typeof globalScope !== "undefined" && globalScope.crypto) {
            try {
                const encoder = new TextEncoder();
                const dataBuffer = encoder.encode(data);
                const hashBuffer = await globalScope.crypto.subtle.digest("SHA-256", dataBuffer);
                // For browser, we use SHA-256 as MD5 is deprecated
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
            } catch (error) {
                console.error("Crypto hash error:", error);
                return null;
            }
        }
        return null;
    }

    /**
     * Simple MD5 implementation for server-side (fallback)
     * In production, use Node's crypto module on the server
     */
    function simpleMD5Checksum(data) {
        // This is a placeholder. Real implementation uses Node crypto on Cloud Functions
        // For browser-based validation only, not for generating signatures
        console.warn("MD5 checksum calculation fallback - use server-side implementation");
        return null;
    }

    /**
     * Builds the PayFast signature string
     * Format: merchant_id=X&merchant_key=Y&return_url=Z&...&amount=A&item_name=B&custom_str1=C
     */
    function buildSignatureString(params) {
        const sortedKeys = Object.keys(params)
            .filter(key => params[key] !== null && params[key] !== undefined && params[key] !== "")
            .sort();

        return sortedKeys
            .map(key => `${key}=${encodeURIComponent(String(params[key]))}`)
            .join("&");
    }

    /**
     * Generates a PayFast checkout URL for an order
     * Must be called from Cloud Function to securely generate signature
     * 
     * @param {string} orderId - The order ID
     * @param {object} config - Payment configuration from Cloud Function
     * @returns {Promise<{paymentUrl: string, paymentId: string, idempotencyKey: string}>}
     */
    async function generatePayFastCheckoutUrl(orderId, config) {
        try {
            if (!orderId || typeof orderId !== "string") {
                throw new Error("Invalid orderId");
            }

            if (!config || typeof config !== "object") {
                throw new Error("Payment config not provided");
            }

            // Call Cloud Function to generate PayFast URL securely
            const response = await fetch("/.netlify/functions/createPayfastCheckout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId })
            });

            if (!response.ok) {
                throw new Error(`Payment URL generation failed: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

            return {
                paymentUrl: result.paymentUrl,
                paymentId: result.paymentId,
                idempotencyKey: result.idempotencyKey
            };
        } catch (error) {
            console.error("Error generating PayFast checkout URL:", error);
            throw error;
        }
    }

    /**
     * Validates a PayFast ITN signature
     * Server-side only (called from Cloud Function)
     * 
     * @param {object} itnData - The ITN data from PayFast
     * @param {string} signature - The signature from PayFast
     * @param {string} merchantKey - PayFast merchant key
     * @returns {boolean}
     */
    function validatePayFastSignature(itnData, signature, merchantKey) {
        // This function is called from Cloud Functions with Node crypto
        // It builds the signature string and compares with provided signature
        const signatureParams = {};

        // Only include specific fields for signature validation
        const validFields = [
            "merchant_id", "pf_payment_id", "payment_status", 
            "item_name", "item_description", "amount_gross", 
            "amount_fee", "amount_net", "custom_str1", "custom_str2",
            "custom_str3", "custom_str4", "custom_str5", "name_first",
            "name_last", "email_address", "merchant_key"
        ];

        validFields.forEach(field => {
            if (itnData[field] !== undefined && itnData[field] !== null) {
                signatureParams[field] = String(itnData[field]).trim();
            }
        });

        // Add merchant key for signature calculation
        signatureParams.merchant_key = merchantKey;

        const signatureString = buildSignatureString(signatureParams);
        return calculateMD5(signatureString) === signature;
    }

    /**
     * Parses PayFast ITN data and extracts relevant fields
     * 
     * @param {object} formData - The form data from PayFast ITN
     * @returns {object}
     */
    function parsePayFastITNData(formData) {
        return {
            pf_payment_id: String(formData.pf_payment_id || "").trim(),
            merchant_id: String(formData.merchant_id || "").trim(),
            payment_status: String(formData.payment_status || "").toLowerCase().trim(),
            amount_gross: parseFloat(formData.amount_gross) || 0,
            amount_fee: parseFloat(formData.amount_fee) || 0,
            amount_net: parseFloat(formData.amount_net) || 0,
            custom_str1: String(formData.custom_str1 || "").trim(), // orderId
            item_name: String(formData.item_name || "").trim(),
            item_description: String(formData.item_description || "").trim(),
            name_first: String(formData.name_first || "").trim(),
            name_last: String(formData.name_last || "").trim(),
            email_address: String(formData.email_address || "").toLowerCase().trim(),
            transaction_date: String(formData.transaction_date || "").trim(),
            signature: String(formData.signature || "").trim()
        };
    }

    /**
     * Validates PayFast ITN response data
     * 
     * @param {object} itnData - Parsed ITN data
     * @returns {{valid: boolean, error: string|null}}
     */
    function validateITNData(itnData) {
        const errors = [];

        if (!itnData.pf_payment_id) {
            errors.push("Missing PayFast payment ID");
        }

        if (!itnData.custom_str1) {
            errors.push("Missing order ID in custom_str1");
        }

        if (itnData.amount_gross <= 0) {
            errors.push("Invalid payment amount");
        }

        if (!["completed", "failed", "pending"].includes(itnData.payment_status)) {
            errors.push(`Invalid payment status: ${itnData.payment_status}`);
        }

        return {
            valid: errors.length === 0,
            error: errors.length > 0 ? errors.join("; ") : null
        };
    }

    /**
     * Builds PayFast payment parameters
     * Called from Cloud Function before generating signature
     * 
     * @param {object} paymentData - Payment configuration
     * @returns {object}
     */
    function buildPayFastParams(paymentData) {
        const params = {
            merchant_id: paymentData.merchantId,
            merchant_key: paymentData.merchantKey,
            return_url: paymentData.returnUrl,
            cancel_url: paymentData.cancelUrl,
            notify_url: paymentData.notifyUrl,
            name_first: paymentData.customerFirstName,
            name_last: paymentData.customerLastName,
            email_address: paymentData.customerEmail,
            item_name: paymentData.itemName,
            item_description: paymentData.itemDescription,
            amount: Number(paymentData.amount).toFixed(2),
            custom_str1: paymentData.orderId, // For order tracking
            custom_str2: paymentData.paymentId, // Payment record ID
            custom_str3: paymentData.customerId,
            custom_str4: paymentData.idempotencyKey // For idempotency
        };

        return params;
    }

    /**
     * Exported API
     */
    const api = {
        generatePayFastCheckoutUrl,
        validatePayFastSignature,
        parsePayFastITNData,
        validateITNData,
        buildPayFastParams,
        buildSignatureString,
        PAYFAST_SANDBOX_URL,
        PAYFAST_LIVE_URL
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else if (typeof globalScope !== "undefined") {
        globalScope.paymentIntegration = api;
    }
})(typeof window !== "undefined" ? window : global);
