"use strict";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const PAYSTACK_INITIALIZE_TRANSACTION_PATH = "/transaction/initialize";
const PAYSTACK_VERIFY_TRANSACTION_PATH = "/transaction/verify";

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeLowerText(value) {
    return normalizeText(value).toLowerCase();
}

function normalizeBaseUrl(value) {
    const normalizedValue = normalizeText(value) || PAYSTACK_BASE_URL;
    return normalizedValue.replace(/\/+$/g, "");
}

function createPaystackError(code, message, details = {}) {
    const error = new Error(
        normalizeText(message) || "Paystack request failed."
    );
    const safeDetails = details && typeof details === "object" ? details : {};

    error.code = normalizeText(code) || "paystack/request-failed";
    Object.keys(safeDetails).forEach(function assignDetail(key) {
        error[key] = safeDetails[key];
    });

    return error;
}

function resolveSecretKey(options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const hasExplicitSecretKey = Object.prototype.hasOwnProperty.call(safeOptions, "secretKey");
    const envSecretKey = typeof process !== "undefined" && process.env
        ? process.env.PAYSTACK_SECRET_KEY
        : "";

    return normalizeText(
        hasExplicitSecretKey ? safeOptions.secretKey : envSecretKey
    );
}

function resolveEnvironment(options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const hasExplicitEnvironment = Object.prototype.hasOwnProperty.call(safeOptions, "environment");
    const envEnvironment = typeof process !== "undefined" && process.env
        ? process.env.PAYSTACK_ENV
        : "";

    return normalizeLowerText(
        hasExplicitEnvironment ? safeOptions.environment : envEnvironment
    ) || "test";
}

function buildQueryString(query = {}) {
    const safeQuery = query && typeof query === "object" ? query : {};
    const params = new URLSearchParams();

    Object.keys(safeQuery).forEach(function appendOneParam(key) {
        const value = safeQuery[key];

        if (value !== undefined && value !== null && normalizeText(String(value))) {
            params.append(key, String(value));
        }
    });

    const queryString = params.toString();
    return queryString ? `?${queryString}` : "";
}

function buildPaystackUrl(path, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const baseUrl = normalizeBaseUrl(safeOptions.baseUrl);
    const safePath = Array.isArray(path)
        ? path
            .map(function normalizePathSegment(segment) {
                return encodeURIComponent(normalizeText(segment).replace(/^\/+|\/+$/g, ""));
            })
            .filter(Boolean)
            .join("/")
        : normalizeText(path).replace(/^\/+/g, "");
    const queryString = buildQueryString(safeOptions.query);

    return `${baseUrl}/${safePath}${queryString}`;
}

function createAuthorizationHeaders(secretKey, extraHeaders = {}) {
    const safeSecretKey = normalizeText(secretKey);
    const safeExtraHeaders = extraHeaders && typeof extraHeaders === "object"
        ? extraHeaders
        : {};

    if (!safeSecretKey) {
        throw createPaystackError(
            "paystack/missing-secret-key",
            "PAYSTACK_SECRET_KEY is required before contacting Paystack."
        );
    }

    return {
        Authorization: `Bearer ${safeSecretKey}`,
        ...safeExtraHeaders
    };
}

async function parsePaystackResponse(response) {
    if (!response) {
        return null;
    }

    if (typeof response.json === "function") {
        try {
            return await response.json();
        } catch (error) {
            return null;
        }
    }

    if (typeof response.text === "function") {
        const text = await response.text();

        if (!normalizeText(text)) {
            return null;
        }

        try {
            return JSON.parse(text);
        } catch (error) {
            return { message: text };
        }
    }

    return null;
}

function assertFetchAvailable(fetchFn) {
    if (typeof fetchFn !== "function") {
        throw createPaystackError(
            "paystack/fetch-unavailable",
            "A fetch implementation is required before contacting Paystack."
        );
    }
}

function createPaystackClient(options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const hasExplicitFetchFn = Object.prototype.hasOwnProperty.call(safeOptions, "fetchFn");
    const client = {
        baseUrl: normalizeBaseUrl(safeOptions.baseUrl),
        secretKey: resolveSecretKey(safeOptions),
        environment: resolveEnvironment(safeOptions),
        fetchFn: hasExplicitFetchFn ? safeOptions.fetchFn : globalThis.fetch
    };

    async function request(path, requestOptions = {}) {
        const safeRequestOptions = requestOptions && typeof requestOptions === "object"
            ? requestOptions
            : {};
        const method = normalizeText(safeRequestOptions.method || "GET").toUpperCase();
        const hasBody = safeRequestOptions.body !== undefined || safeRequestOptions.payload !== undefined;
        const bodyValue = safeRequestOptions.body !== undefined
            ? safeRequestOptions.body
            : safeRequestOptions.payload;
        const headers = createAuthorizationHeaders(client.secretKey, {
            ...(hasBody ? { "Content-Type": "application/json" } : {}),
            ...(safeRequestOptions.headers || {})
        });
        const fetchFn = safeRequestOptions.fetchFn || client.fetchFn;
        const url = buildPaystackUrl(path, {
            baseUrl: client.baseUrl,
            query: safeRequestOptions.query
        });
        const fetchOptions = {
            method,
            headers
        };

        assertFetchAvailable(fetchFn);

        if (hasBody) {
            fetchOptions.body = typeof bodyValue === "string"
                ? bodyValue
                : JSON.stringify(bodyValue || {});
        }

        let response;

        try {
            response = await fetchFn(url, fetchOptions);
        } catch (error) {
            throw createPaystackError(
                "paystack/network-error",
                error && error.message
                    ? error.message
                    : "Paystack could not be reached.",
                { cause: error || null, url, method }
            );
        }

        const parsedBody = await parsePaystackResponse(response);
        const httpOk = response && response.ok !== false;

        if (!httpOk) {
            throw createPaystackError(
                "paystack/http-error",
                parsedBody && parsedBody.message
                    ? parsedBody.message
                    : "Paystack returned an error response.",
                {
                    status: response ? response.status : null,
                    statusText: response ? response.statusText : "",
                    body: parsedBody,
                    url,
                    method
                }
            );
        }

        return parsedBody;
    }

    async function initializeTransaction(payload) {
        return request(PAYSTACK_INITIALIZE_TRANSACTION_PATH, {
            method: "POST",
            payload
        });
    }

    async function verifyTransaction(reference) {
        const safeReference = normalizeText(reference);

        if (!safeReference) {
            throw createPaystackError(
                "paystack/missing-reference",
                "A payment reference is required before verifying a Paystack transaction."
            );
        }

        return request([
            "transaction",
            "verify",
            safeReference
        ]);
    }

    return {
        baseUrl: client.baseUrl,
        secretKey: client.secretKey,
        environment: client.environment,
        request,
        initializeTransaction,
        verifyTransaction
    };
}

module.exports = {
    PAYSTACK_BASE_URL,
    PAYSTACK_INITIALIZE_TRANSACTION_PATH,
    PAYSTACK_VERIFY_TRANSACTION_PATH,
    normalizeText,
    normalizeLowerText,
    normalizeBaseUrl,
    createPaystackError,
    resolveSecretKey,
    resolveEnvironment,
    buildQueryString,
    buildPaystackUrl,
    createAuthorizationHeaders,
    parsePaystackResponse,
    assertFetchAvailable,
    createPaystackClient
};
