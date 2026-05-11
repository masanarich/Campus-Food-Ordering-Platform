(function attachPaymentCallback(globalScope) {
    "use strict";

    const MODULE_NAME = "customer/order-management/payment-callback";
    let initInFlight = null;

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeUpperText(value) {
        return normalizeText(value).toUpperCase();
    }

    function normalizeNumber(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function getFallbackRoutes() {
        return {
            home: "../index.html",
            browseVendors: "./browse-vendors.html",
            cart: "./cart.html",
            checkout: "./checkout.html",
            orders: "../order-tracking/index.html"
        };
    }

    function getLocationSearch(options = {}) {
        if (typeof options.search === "string") {
            return options.search;
        }

        return globalScope.location?.search || "";
    }

    function getPaymentReference(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const explicit = normalizeText(safeOptions.reference);

        if (explicit) {
            return explicit;
        }

        const params = new URLSearchParams(getLocationSearch(safeOptions));
        return normalizeText(params.get("reference") || params.get("trxref"));
    }

    function resolveFirestore(explicitDb) {
        if (explicitDb) {
            return explicitDb;
        }

        if (globalScope.db) {
            return globalScope.db;
        }

        return null;
    }

    function resolveAuth(explicitAuth) {
        if (explicitAuth) {
            return explicitAuth;
        }

        if (globalScope.auth) {
            return globalScope.auth;
        }

        return null;
    }

    function resolveAuthFns(explicitAuthFns) {
        if (explicitAuthFns && typeof explicitAuthFns === "object") {
            return explicitAuthFns;
        }

        if (globalScope.authFns && typeof globalScope.authFns === "object") {
            return globalScope.authFns;
        }

        return {};
    }

    function resolveFirestoreFns(explicitFirestoreFns) {
        if (explicitFirestoreFns && typeof explicitFirestoreFns === "object") {
            return explicitFirestoreFns;
        }

        if (globalScope.firestoreFns && typeof globalScope.firestoreFns === "object") {
            return globalScope.firestoreFns;
        }

        return {};
    }

    function resolveFunctions(explicitFunctions) {
        if (explicitFunctions) {
            return explicitFunctions;
        }

        if (globalScope.functions) {
            return globalScope.functions;
        }

        return null;
    }

    function resolveFunctionsFns(explicitFunctionsFns) {
        if (explicitFunctionsFns && typeof explicitFunctionsFns === "object") {
            return explicitFunctionsFns;
        }

        if (globalScope.functionsFns && typeof globalScope.functionsFns === "object") {
            return globalScope.functionsFns;
        }

        return {};
    }

    function resolvePaymentFormatters(explicitPaymentFormatters) {
        if (
            explicitPaymentFormatters &&
            typeof explicitPaymentFormatters.formatPaymentAmount === "function"
        ) {
            return explicitPaymentFormatters;
        }

        if (
            globalScope.paymentFormatters &&
            typeof globalScope.paymentFormatters.formatPaymentAmount === "function"
        ) {
            return globalScope.paymentFormatters;
        }

        return null;
    }

    function resolvePaymentStatus(explicitPaymentStatus) {
        if (
            explicitPaymentStatus &&
            typeof explicitPaymentStatus.getPaymentStatusLabel === "function"
        ) {
            return explicitPaymentStatus;
        }

        if (
            globalScope.paymentStatus &&
            typeof globalScope.paymentStatus.getPaymentStatusLabel === "function"
        ) {
            return globalScope.paymentStatus;
        }

        return null;
    }

    function formatAmount(amount, currency, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const paymentFormatters = resolvePaymentFormatters(safeOptions.paymentFormatters);
        const safeCurrency = normalizeUpperText(currency) || "ZAR";

        if (paymentFormatters && typeof paymentFormatters.formatPaymentAmount === "function") {
            return paymentFormatters.formatPaymentAmount(amount, safeCurrency);
        }

        const numeric = normalizeNumber(amount);

        if (numeric === null) {
            return safeCurrency === "ZAR" ? "R0.00" : `${safeCurrency} 0.00`;
        }

        const prefix = safeCurrency === "ZAR" ? "R" : `${safeCurrency} `;
        return `${prefix}${numeric.toFixed(2)}`;
    }

    function getPaymentStatusLabel(status, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const paymentStatus = resolvePaymentStatus(safeOptions.paymentStatus);

        if (paymentStatus && typeof paymentStatus.getPaymentStatusLabel === "function") {
            return paymentStatus.getPaymentStatusLabel(status);
        }

        const normalized = normalizeText(status).toLowerCase();

        if (normalized === "paid") {
            return "Paid";
        }

        if (normalized === "pending") {
            return "Payment Pending";
        }

        if (normalized === "failed") {
            return "Payment Failed";
        }

        if (normalized === "unpaid") {
            return "Unpaid";
        }

        return "Unknown Payment Status";
    }

    function setStatusMessage(element, message, state = "info") {
        if (!element) {
            return;
        }

        element.textContent = normalizeText(message);
        element.setAttribute("data-state", normalizeText(state) || "info");
    }

    function createBackButton(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const button = globalScope.document.createElement("button");
        const fallbackRoute = normalizeText(safeOptions.fallbackRoute) || getFallbackRoutes().orders;

        button.type = "button";
        button.className = "button-secondary payment-callback-back-button";
        button.textContent = normalizeText(safeOptions.label) || "Back";

        button.addEventListener("click", function handleBackClick() {
            if (
                globalScope.history &&
                typeof globalScope.history.back === "function" &&
                globalScope.history.length > 1
            ) {
                globalScope.history.back();
                return;
            }

            globalScope.location.href = fallbackRoute;
        });

        return button;
    }

    function normalizeCallableResult(result) {
        if (result && typeof result === "object" && "data" in result) {
            return result.data;
        }

        return result;
    }

    function resolveVerifyPaymentCallable(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        if (typeof safeOptions.verifyPaymentCallable === "function") {
            return safeOptions.verifyPaymentCallable;
        }

        if (
            safeOptions.paymentFunctions &&
            typeof safeOptions.paymentFunctions.verifyPayment === "function"
        ) {
            return safeOptions.paymentFunctions.verifyPayment;
        }

        const functions = resolveFunctions(safeOptions.functions);
        const functionsFns = resolveFunctionsFns(safeOptions.functionsFns);

        if (
            functions &&
            functionsFns &&
            typeof functionsFns.httpsCallable === "function"
        ) {
            return functionsFns.httpsCallable(functions, "verifyPayment");
        }

        return null;
    }

    function buildPaymentSliceFromOrder(orderData, reference) {
        const safeOrder = orderData && typeof orderData === "object" ? orderData : {};
        const safeReference = normalizeText(reference || safeOrder.paymentReference);
        const amount = safeOrder.paymentAmount !== undefined
            ? normalizeNumber(safeOrder.paymentAmount)
            : normalizeNumber(safeOrder.total);
        const amountInMinorUnits = safeOrder.paymentAmountInMinorUnits !== undefined
            ? Number.parseInt(safeOrder.paymentAmountInMinorUnits, 10)
            : (amount !== null ? Math.round(amount * 100) : null);

        return {
            orderId: normalizeText(safeOrder.orderId || safeOrder.id),
            customerUid: normalizeText(safeOrder.customerUid),
            customerEmail: normalizeText(safeOrder.customerEmail),
            customerName: normalizeText(safeOrder.customerName),
            vendorUid: normalizeText(safeOrder.vendorUid),
            vendorName: normalizeText(safeOrder.vendorName),
            provider: normalizeText(safeOrder.paymentProvider) || "paystack",
            reference: safeReference,
            paymentReference: safeReference,
            accessCode: normalizeText(safeOrder.paymentAccessCode),
            authorizationUrl: normalizeText(safeOrder.paymentAuthorizationUrl),
            amount: amount !== null ? amount : 0,
            amountInMinorUnits: Number.isFinite(amountInMinorUnits) ? amountInMinorUnits : 0,
            currency: normalizeUpperText(safeOrder.paymentCurrency) || "ZAR",
            status: normalizeText(safeOrder.paymentStatus) || "pending"
        };
    }

    function supportsOrderQuery(firestoreFns) {
        return !!(
            firestoreFns &&
            typeof firestoreFns.collection === "function" &&
            typeof firestoreFns.query === "function" &&
            typeof firestoreFns.where === "function" &&
            typeof firestoreFns.getDocs === "function"
        );
    }

    function supportsOrderUpdate(firestoreFns) {
        return !!(
            firestoreFns &&
            typeof firestoreFns.doc === "function" &&
            typeof firestoreFns.updateDoc === "function"
        );
    }

    async function findOrderByReference(reference, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const firestoreFns = resolveFirestoreFns(safeOptions.firestoreFns);
        const db = safeOptions.db || resolveFirestore();
        const safeReference = normalizeText(reference);

        if (!safeReference) {
            return {
                success: false,
                error: {
                    code: "payment-callback/missing-reference",
                    message: "Payment reference is required to find the order."
                }
            };
        }

        if (!db || !supportsOrderQuery(firestoreFns)) {
            return {
                success: false,
                error: {
                    code: "payment-callback/firestore-unavailable",
                    message: "Firestore is not available to look up the order."
                }
            };
        }

        try {
            const ordersCollection = firestoreFns.collection(db, "orders");
            const queryArgs = [ordersCollection, firestoreFns.where("paymentReference", "==", safeReference)];

            if (typeof firestoreFns.limit === "function") {
                queryArgs.push(firestoreFns.limit(1));
            }

            const orderQuery = firestoreFns.query.apply(null, queryArgs);
            const snapshot = await firestoreFns.getDocs(orderQuery);
            const docs = [];

            if (snapshot && typeof snapshot.forEach === "function") {
                snapshot.forEach(function collectDoc(docSnapshot) {
                    docs.push(docSnapshot);
                });
            } else if (snapshot && Array.isArray(snapshot.docs)) {
                snapshot.docs.forEach(function collectDoc(docSnapshot) {
                    docs.push(docSnapshot);
                });
            }

            if (docs.length === 0) {
                return {
                    success: false,
                    error: {
                        code: "payment-callback/order-not-found",
                        message: "No order matches that payment reference."
                    }
                };
            }

            const docSnapshot = docs[0];
            const orderData = typeof docSnapshot.data === "function" ? docSnapshot.data() : {};

            return {
                success: true,
                orderId: docSnapshot.id,
                data: {
                    orderId: docSnapshot.id,
                    ...orderData
                }
            };
        } catch (error) {
            console.error(`${MODULE_NAME}: findOrderByReference failed:`, error);

            return {
                success: false,
                error: {
                    code: error?.code || "payment-callback/order-lookup-failed",
                    message: error?.message || "Failed to look up the order for this payment."
                }
            };
        }
    }

    async function updateOrderPatch(orderId, patch, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safePatch = patch && typeof patch === "object" ? patch : {};
        const firestoreFns = resolveFirestoreFns(safeOptions.firestoreFns);
        const db = safeOptions.db || resolveFirestore();
        const safeOrderId = normalizeText(orderId);

        if (
            !db ||
            !safeOrderId ||
            Object.keys(safePatch).length === 0 ||
            !supportsOrderUpdate(firestoreFns)
        ) {
            return {
                success: false,
                skipped: true,
                error: {
                    code: "payment-callback/patch-skipped",
                    message: "Payment patch could not be saved."
                }
            };
        }

        try {
            const docRef = firestoreFns.doc(db, "orders", safeOrderId);
            await firestoreFns.updateDoc(docRef, safePatch);

            return {
                success: true,
                docRef,
                patch: safePatch
            };
        } catch (error) {
            console.error(`${MODULE_NAME}: updateOrderPatch failed:`, error);

            return {
                success: false,
                error: {
                    code: error?.code || "payment-callback/patch-failed",
                    message: error?.message || "Failed to update the order with payment result."
                }
            };
        }
    }

    async function verifyPaymentForOrder(reference, orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeReference = normalizeText(reference);
        const callable = resolveVerifyPaymentCallable(safeOptions);

        if (!callable) {
            return {
                success: false,
                error: {
                    code: "payment-callback/verify-unavailable",
                    message: "Payment verification service is not available."
                }
            };
        }

        const paymentSlice = buildPaymentSliceFromOrder(orderRecord, safeReference);

        try {
            const callableResult = await callable({
                payment: paymentSlice,
                reference: safeReference
            });
            const result = normalizeCallableResult(callableResult) || {};

            if (result.success !== true) {
                return {
                    success: false,
                    payment: result.payment || null,
                    patch: result.patch || null,
                    verification: result.verification || null,
                    error: result.error || {
                        code: "payment-callback/verify-failed",
                        message: "Payment verification failed."
                    }
                };
            }

            return {
                success: true,
                payment: result.payment || null,
                patch: result.patch || null,
                verification: result.verification || null,
                reference: result.reference || safeReference
            };
        } catch (error) {
            console.error(`${MODULE_NAME}: verifyPaymentForOrder failed:`, error);

            return {
                success: false,
                error: {
                    code: error?.code || "payment-callback/verify-failed",
                    message: error?.message || "Payment verification failed."
                }
            };
        }
    }

    function renderPaymentSummary(summaryElement, info = {}) {
        if (!summaryElement) {
            return;
        }

        const safeInfo = info && typeof info === "object" ? info : {};
        const doc = globalScope.document;
        summaryElement.innerHTML = "";

        const article = doc.createElement("article");
        article.className = "payment-callback-summary-card";

        if (safeInfo.tone) {
            article.setAttribute("data-tone", normalizeText(safeInfo.tone));
        }

        const heading = doc.createElement("h4");
        heading.className = "payment-callback-summary-heading";
        heading.textContent = normalizeText(safeInfo.heading) || "Payment Details";
        article.appendChild(heading);

        const list = doc.createElement("ul");
        list.className = "payment-callback-summary-list";

        function appendDetail(label, value) {
            const safeValue = normalizeText(value);

            if (!safeValue) {
                return;
            }

            const item = doc.createElement("li");
            item.className = "payment-callback-summary-item";
            item.textContent = `${label}: ${safeValue}`;
            list.appendChild(item);
        }

        appendDetail("Status", normalizeText(safeInfo.statusLabel));
        appendDetail("Reference", normalizeText(safeInfo.reference));
        appendDetail("Order ID", normalizeText(safeInfo.orderId));
        appendDetail("Vendor", normalizeText(safeInfo.vendorName));
        appendDetail("Amount", normalizeText(safeInfo.amountLabel));

        article.appendChild(list);

        if (normalizeText(safeInfo.message)) {
            const message = doc.createElement("p");
            message.className = "payment-callback-summary-message";
            message.textContent = normalizeText(safeInfo.message);
            article.appendChild(message);
        }

        summaryElement.appendChild(article);
    }

    function clearActions(actionsElement) {
        if (!actionsElement) {
            return;
        }

        actionsElement.innerHTML = "";
    }

    function appendActionLink(actionsElement, label, href, variant = "secondary") {
        if (!actionsElement) {
            return;
        }

        const safeLabel = normalizeText(label);
        const safeHref = normalizeText(href);

        if (!safeLabel || !safeHref) {
            return;
        }

        const doc = globalScope.document;
        const item = doc.createElement("li");
        const link = doc.createElement("a");

        link.href = safeHref;
        link.textContent = safeLabel;
        link.className = variant === "primary" ? "button-primary" : "button-secondary";

        item.appendChild(link);
        actionsElement.appendChild(item);
    }

    function renderActions(actionsElement, info = {}) {
        if (!actionsElement) {
            return;
        }

        const safeInfo = info && typeof info === "object" ? info : {};
        const routes = getFallbackRoutes();
        clearActions(actionsElement);

        if (safeInfo.outcome === "success") {
            appendActionLink(actionsElement, "View My Orders", routes.orders, "primary");
            appendActionLink(actionsElement, "Browse More Vendors", routes.browseVendors);
            appendActionLink(actionsElement, "Back to Dashboard", routes.home);
            return;
        }

        if (safeInfo.outcome === "failed") {
            const checkoutHref = safeInfo.vendorUid
                ? `${routes.checkout}?vendorUid=${encodeURIComponent(safeInfo.vendorUid)}`
                : routes.checkout;

            appendActionLink(actionsElement, "Retry from Checkout", checkoutHref, "primary");
            appendActionLink(actionsElement, "Back to Cart", routes.cart);
            appendActionLink(actionsElement, "View My Orders", routes.orders);
            return;
        }

        appendActionLink(actionsElement, "View My Orders", routes.orders);
        appendActionLink(actionsElement, "Back to Cart", routes.cart);
    }

    function buildSuccessSummary(verifyResult, orderRecord) {
        const safeOrder = orderRecord && typeof orderRecord === "object" ? orderRecord : {};
        const safeVerify = verifyResult && typeof verifyResult === "object" ? verifyResult : {};
        const payment = safeVerify.payment && typeof safeVerify.payment === "object"
            ? safeVerify.payment
            : {};
        const verification = safeVerify.verification && typeof safeVerify.verification === "object"
            ? safeVerify.verification
            : {};
        const amount = payment.amount !== undefined
            ? payment.amount
            : (
                verification.amountInMinorUnits !== undefined
                    ? Number.parseInt(verification.amountInMinorUnits, 10) / 100
                    : safeOrder.paymentAmount
            );
        const currency = payment.currency || verification.currency || safeOrder.paymentCurrency || "ZAR";
        const reference = normalizeText(payment.reference || verification.reference || safeVerify.reference);

        return {
            outcome: "success",
            tone: "success",
            heading: "Payment Confirmed",
            statusLabel: getPaymentStatusLabel("paid"),
            reference,
            orderId: normalizeText(safeOrder.orderId || safeOrder.id),
            vendorName: normalizeText(safeOrder.vendorName),
            amountLabel: formatAmount(amount, currency),
            message: "Your payment was successful. The vendor can now prepare your order."
        };
    }

    function buildFailureSummary(verifyResult, orderRecord, reference) {
        const safeOrder = orderRecord && typeof orderRecord === "object" ? orderRecord : {};
        const safeVerify = verifyResult && typeof verifyResult === "object" ? verifyResult : {};
        const error = safeVerify.error && typeof safeVerify.error === "object" ? safeVerify.error : {};

        return {
            outcome: "failed",
            tone: "error",
            heading: "Payment Not Completed",
            statusLabel: getPaymentStatusLabel("failed"),
            reference: normalizeText(reference || safeOrder.paymentReference),
            orderId: normalizeText(safeOrder.orderId || safeOrder.id),
            vendorUid: normalizeText(safeOrder.vendorUid),
            vendorName: normalizeText(safeOrder.vendorName),
            amountLabel: formatAmount(safeOrder.paymentAmount, safeOrder.paymentCurrency),
            message: normalizeText(error.message) || "Your payment could not be verified. Please try again."
        };
    }

    async function processPaymentCallback(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const reference = getPaymentReference(safeOptions);

        if (!reference) {
            return {
                success: false,
                outcome: "missing-reference",
                error: {
                    code: "payment-callback/missing-reference",
                    message: "Payment reference is missing from the callback URL."
                }
            };
        }

        const lookup = await findOrderByReference(reference, safeOptions);

        if (!lookup.success) {
            return {
                success: false,
                outcome: "order-not-found",
                reference,
                error: lookup.error
            };
        }

        const orderRecord = lookup.data;
        const verifyResult = await verifyPaymentForOrder(reference, orderRecord, safeOptions);

        if (!verifyResult.success) {
            await updateOrderPatch(lookup.orderId, verifyResult.patch || {}, safeOptions);

            return {
                success: false,
                outcome: "failed",
                reference,
                order: orderRecord,
                verifyResult
            };
        }

        const patchResult = await updateOrderPatch(
            lookup.orderId,
            verifyResult.patch || {},
            safeOptions
        );

        return {
            success: true,
            outcome: "success",
            reference,
            order: orderRecord,
            verifyResult,
            patchResult
        };
    }

    function renderProcessingState(elements) {
        const safeElements = elements && typeof elements === "object" ? elements : {};

        setStatusMessage(
            safeElements.statusElement,
            "Verifying your payment with Paystack...",
            "loading"
        );

        if (safeElements.summaryElement) {
            renderPaymentSummary(safeElements.summaryElement, {
                tone: "loading",
                heading: "Payment Verification In Progress",
                statusLabel: getPaymentStatusLabel("pending"),
                message: "Please wait while we confirm your payment."
            });
        }

        if (safeElements.actionsElement) {
            clearActions(safeElements.actionsElement);
        }
    }

    function renderResult(elements, processResult) {
        const safeElements = elements && typeof elements === "object" ? elements : {};
        const safeResult = processResult && typeof processResult === "object" ? processResult : {};

        if (safeResult.outcome === "success") {
            const summaryInfo = buildSuccessSummary(safeResult.verifyResult, safeResult.order);
            setStatusMessage(
                safeElements.statusElement,
                "Payment confirmed. Your order is on its way.",
                "success"
            );
            renderPaymentSummary(safeElements.summaryElement, summaryInfo);
            renderActions(safeElements.actionsElement, summaryInfo);
            return summaryInfo;
        }

        if (safeResult.outcome === "missing-reference") {
            setStatusMessage(
                safeElements.statusElement,
                "Payment reference is missing from the callback URL.",
                "error"
            );
            renderPaymentSummary(safeElements.summaryElement, {
                tone: "error",
                heading: "No Payment Reference",
                message: "Open this page from a Paystack redirect to verify your payment."
            });
            renderActions(safeElements.actionsElement, { outcome: "failed" });
            return null;
        }

        if (safeResult.outcome === "order-not-found") {
            setStatusMessage(
                safeElements.statusElement,
                "We could not find an order for that payment reference.",
                "error"
            );
            renderPaymentSummary(safeElements.summaryElement, {
                tone: "error",
                heading: "Order Not Found",
                reference: safeResult.reference,
                message: safeResult.error && safeResult.error.message
                    ? safeResult.error.message
                    : "No order matches that payment reference."
            });
            renderActions(safeElements.actionsElement, { outcome: "failed" });
            return null;
        }

        const failureInfo = buildFailureSummary(
            safeResult.verifyResult,
            safeResult.order,
            safeResult.reference
        );
        setStatusMessage(
            safeElements.statusElement,
            failureInfo.message,
            "error"
        );
        renderPaymentSummary(safeElements.summaryElement, failureInfo);
        renderActions(safeElements.actionsElement, failureInfo);
        return failureInfo;
    }

    function setupBackButton(backButtonHost) {
        if (!backButtonHost) {
            return;
        }

        if (backButtonHost.querySelector(".payment-callback-back-button")) {
            return;
        }

        backButtonHost.appendChild(createBackButton({
            fallbackRoute: getFallbackRoutes().orders,
            label: "Back to My Orders"
        }));
    }

    async function init(options = {}) {
        if (initInFlight) {
            return initInFlight;
        }

        initInFlight = (async function runInit() {
            const safeOptions = options && typeof options === "object" ? options : {};
            const statusSelector = safeOptions.statusSelector || "#payment-callback-status";
            const summarySelector = safeOptions.summarySelector || "#payment-callback-summary";
            const actionsSelector = safeOptions.actionsSelector || "#payment-callback-actions";
            const backButtonHostSelector =
                safeOptions.backButtonHostSelector || "#payment-callback-back-host";

            const doc = globalScope.document;
            const statusElement = doc ? doc.querySelector(statusSelector) : null;
            const summaryElement = doc ? doc.querySelector(summarySelector) : null;
            const actionsElement = doc ? doc.querySelector(actionsSelector) : null;
            const backButtonHost = doc ? doc.querySelector(backButtonHostSelector) : null;

            const elements = {
                statusElement,
                summaryElement,
                actionsElement,
                backButtonHost
            };

            setupBackButton(backButtonHost);
            renderProcessingState(elements);

            const result = await processPaymentCallback(safeOptions);
            const summary = renderResult(elements, result);

            return {
                success: result.success === true,
                outcome: result.outcome,
                summary,
                result
            };
        })();

        try {
            return await initInFlight;
        } finally {
            initInFlight = null;
        }
    }

    const paymentCallback = {
        MODULE_NAME,
        normalizeText,
        normalizeUpperText,
        normalizeNumber,
        getFallbackRoutes,
        getLocationSearch,
        getPaymentReference,
        resolveFirestore,
        resolveAuth,
        resolveAuthFns,
        resolveFirestoreFns,
        resolveFunctions,
        resolveFunctionsFns,
        resolvePaymentFormatters,
        resolvePaymentStatus,
        formatAmount,
        getPaymentStatusLabel,
        setStatusMessage,
        createBackButton,
        normalizeCallableResult,
        resolveVerifyPaymentCallable,
        buildPaymentSliceFromOrder,
        supportsOrderQuery,
        supportsOrderUpdate,
        findOrderByReference,
        updateOrderPatch,
        verifyPaymentForOrder,
        renderPaymentSummary,
        clearActions,
        appendActionLink,
        renderActions,
        buildSuccessSummary,
        buildFailureSummary,
        processPaymentCallback,
        renderProcessingState,
        renderResult,
        setupBackButton,
        init
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = paymentCallback;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.paymentCallback = paymentCallback;
    }
})(typeof window !== "undefined" ? window : globalThis);
