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

    function getCheckoutId(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const explicit = normalizeText(safeOptions.checkoutId || safeOptions.sessionId);

        if (explicit) {
            return explicit;
        }

        const params = new URLSearchParams(getLocationSearch(safeOptions));
        return normalizeText(params.get("checkoutId") || params.get("sessionId"));
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

    function resolveCheckoutStatus(explicitCheckoutStatus) {
        if (explicitCheckoutStatus && typeof explicitCheckoutStatus.normalizeCheckoutStatus === "function") {
            return explicitCheckoutStatus;
        }

        if (globalScope.checkoutStatus && typeof globalScope.checkoutStatus.normalizeCheckoutStatus === "function") {
            return globalScope.checkoutStatus;
        }

        if (typeof require === "function") {
            try {
                return require("../../shared/checkout/checkout-status.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveCheckoutModel(explicitCheckoutModel) {
        if (explicitCheckoutModel && typeof explicitCheckoutModel.createOrderDraftFromCheckout === "function") {
            return explicitCheckoutModel;
        }

        if (globalScope.checkoutModel && typeof globalScope.checkoutModel.createOrderDraftFromCheckout === "function") {
            return globalScope.checkoutModel;
        }

        if (typeof require === "function") {
            try {
                return require("../../shared/checkout/checkout-model.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveCheckoutValidation(explicitCheckoutValidation) {
        if (explicitCheckoutValidation && typeof explicitCheckoutValidation.validateCheckoutConversion === "function") {
            return explicitCheckoutValidation;
        }

        if (
            globalScope.checkoutValidation &&
            typeof globalScope.checkoutValidation.validateCheckoutConversion === "function"
        ) {
            return globalScope.checkoutValidation;
        }

        if (typeof require === "function") {
            try {
                return require("../../shared/checkout/checkout-validation.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveCheckoutQueries(explicitCheckoutQueries) {
        if (
            explicitCheckoutQueries &&
            (
                typeof explicitCheckoutQueries.fetchCheckoutById === "function" ||
                typeof explicitCheckoutQueries.fetchCheckoutByPaymentReference === "function"
            )
        ) {
            return explicitCheckoutQueries;
        }

        if (
            globalScope.checkoutQueries &&
            (
                typeof globalScope.checkoutQueries.fetchCheckoutById === "function" ||
                typeof globalScope.checkoutQueries.fetchCheckoutByPaymentReference === "function"
            )
        ) {
            return globalScope.checkoutQueries;
        }

        if (typeof require === "function") {
            try {
                return require("../../shared/checkout/checkout-queries.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveCheckoutService(explicitCheckoutService) {
        if (
            explicitCheckoutService &&
            (
                typeof explicitCheckoutService.convertCheckoutToOrder === "function" ||
                typeof explicitCheckoutService.applyVerifiedPayment === "function" ||
                typeof explicitCheckoutService.applyFailedPayment === "function" ||
                typeof explicitCheckoutService.getCheckoutById === "function"
            )
        ) {
            return explicitCheckoutService;
        }

        if (explicitCheckoutService !== undefined) {
            return null;
        }

        if (
            globalScope.checkoutService &&
            (
                typeof globalScope.checkoutService.convertCheckoutToOrder === "function" ||
                typeof globalScope.checkoutService.applyVerifiedPayment === "function" ||
                typeof globalScope.checkoutService.applyFailedPayment === "function" ||
                typeof globalScope.checkoutService.getCheckoutById === "function"
            )
        ) {
            return globalScope.checkoutService;
        }

        if (typeof require === "function") {
            try {
                return require("../../shared/checkout/checkout-service.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveOrderService(explicitOrderService) {
        if (explicitOrderService && typeof explicitOrderService.createOrders === "function") {
            return explicitOrderService;
        }

        if (explicitOrderService !== undefined) {
            return null;
        }

        if (globalScope.orderService && typeof globalScope.orderService.createOrders === "function") {
            return globalScope.orderService;
        }

        if (typeof require === "function") {
            try {
                return require("../../shared/orders/order-service.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function buildCheckoutDependencyOptions(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        return {
            checkoutStatus: resolveCheckoutStatus(safeOptions.checkoutStatus),
            checkoutModel: resolveCheckoutModel(safeOptions.checkoutModel),
            checkoutValidation: resolveCheckoutValidation(safeOptions.checkoutValidation),
            checkoutQueries: resolveCheckoutQueries(safeOptions.checkoutQueries)
        };
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

    function resolveConvertCheckoutToOrderCallable(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        if (typeof safeOptions.convertCheckoutToOrderCallable === "function") {
            return safeOptions.convertCheckoutToOrderCallable;
        }

        if (
            safeOptions.paymentFunctions &&
            typeof safeOptions.paymentFunctions.convertCheckoutToOrder === "function"
        ) {
            return safeOptions.paymentFunctions.convertCheckoutToOrder;
        }

        const functions = resolveFunctions(safeOptions.functions);
        const functionsFns = resolveFunctionsFns(safeOptions.functionsFns);

        if (
            functions &&
            functionsFns &&
            typeof functionsFns.httpsCallable === "function"
        ) {
            return functionsFns.httpsCallable(functions, "convertCheckoutToOrder");
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

    function buildPaymentSliceFromCheckout(checkoutData, reference) {
        const safeCheckout = checkoutData && typeof checkoutData === "object" ? checkoutData : {};
        const safeReference = normalizeText(reference || safeCheckout.paymentReference);
        const amount = safeCheckout.paymentAmount !== undefined
            ? normalizeNumber(safeCheckout.paymentAmount)
            : normalizeNumber(safeCheckout.total);
        const amountInMinorUnits = safeCheckout.paymentAmountInMinorUnits !== undefined
            ? Number.parseInt(safeCheckout.paymentAmountInMinorUnits, 10)
            : (amount !== null ? Math.round(amount * 100) : null);

        return {
            orderId: normalizeText(safeCheckout.checkoutId || safeCheckout.id),
            checkoutId: normalizeText(safeCheckout.checkoutId || safeCheckout.id),
            customerUid: normalizeText(safeCheckout.customerUid),
            customerEmail: normalizeText(safeCheckout.customerEmail),
            customerName: normalizeText(safeCheckout.customerName),
            vendorUid: normalizeText(safeCheckout.vendorUid),
            vendorName: normalizeText(safeCheckout.vendorName),
            provider: normalizeText(safeCheckout.paymentProvider) || "paystack",
            reference: safeReference,
            paymentReference: safeReference,
            accessCode: normalizeText(safeCheckout.paymentAccessCode),
            authorizationUrl: normalizeText(safeCheckout.paymentAuthorizationUrl),
            amount: amount !== null ? amount : 0,
            amountInMinorUnits: Number.isFinite(amountInMinorUnits) ? amountInMinorUnits : 0,
            currency: normalizeUpperText(safeCheckout.paymentCurrency) || "ZAR",
            status: normalizeText(safeCheckout.paymentStatus || safeCheckout.status) || "pending",
            metadata: {
                checkoutId: normalizeText(safeCheckout.checkoutId || safeCheckout.id),
                source: "checkout-session"
            }
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

    async function findCheckoutForCallback(reference, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const checkoutQueries = resolveCheckoutQueries(safeOptions.checkoutQueries);
        const checkoutService = resolveCheckoutService(safeOptions.checkoutService);
        const db = safeOptions.db || resolveFirestore();
        const firestoreFns = resolveFirestoreFns(safeOptions.firestoreFns);
        const checkoutId = getCheckoutId(safeOptions);
        const safeReference = normalizeText(reference);

        if (!db) {
            return {
                success: false,
                skipped: true,
                error: {
                    code: "payment-callback/checkout-firestore-unavailable",
                    message: "Firestore is not available to look up the checkout."
                }
            };
        }

        try {
            if (checkoutId) {
                let checkout = null;

                if (checkoutService && typeof checkoutService.getCheckoutById === "function") {
                    checkout = await checkoutService.getCheckoutById({
                        ...safeOptions,
                        ...buildCheckoutDependencyOptions(safeOptions),
                        db,
                        firestoreFns,
                        checkoutId
                    });
                } else if (checkoutQueries && typeof checkoutQueries.fetchCheckoutById === "function") {
                    checkout = await checkoutQueries.fetchCheckoutById({
                        ...safeOptions,
                        ...buildCheckoutDependencyOptions(safeOptions),
                        db,
                        firestoreFns,
                        checkoutId
                    });
                }

                if (checkout) {
                    return {
                        success: true,
                        checkoutId,
                        data: checkout
                    };
                }

                return {
                    success: false,
                    error: {
                        code: "payment-callback/checkout-not-found",
                        message: "No checkout session matches that callback."
                    }
                };
            }

            if (
                safeReference &&
                checkoutQueries &&
                typeof checkoutQueries.fetchCheckoutByPaymentReference === "function"
            ) {
                const checkout = await checkoutQueries.fetchCheckoutByPaymentReference({
                    ...safeOptions,
                    ...buildCheckoutDependencyOptions(safeOptions),
                    db,
                    firestoreFns,
                    paymentReference: safeReference
                });

                if (checkout) {
                    return {
                        success: true,
                        checkoutId: normalizeText(checkout.checkoutId),
                        data: checkout
                    };
                }
            }

            return {
                success: false,
                skipped: !checkoutId,
                error: {
                    code: "payment-callback/checkout-not-found",
                    message: "No checkout session matches that callback."
                }
            };
        } catch (error) {
            console.error(`${MODULE_NAME}: findCheckoutForCallback failed:`, error);

            return {
                success: false,
                error: {
                    code: error?.code || "payment-callback/checkout-lookup-failed",
                    message: error?.message || "Failed to look up the checkout for this payment."
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

    async function verifyPaymentForCheckout(reference, checkoutRecord, options = {}) {
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

        const paymentSlice = buildPaymentSliceFromCheckout(checkoutRecord, safeReference);

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
            console.error(`${MODULE_NAME}: verifyPaymentForCheckout failed:`, error);

            return {
                success: false,
                error: {
                    code: error?.code || "payment-callback/verify-failed",
                    message: error?.message || "Payment verification failed."
                }
            };
        }
    }

    async function applyCheckoutPaymentFailure(checkoutRecord, verifyResult, options = {}) {
        const checkoutService = resolveCheckoutService(options.checkoutService);

        if (
            !checkoutService ||
            typeof checkoutService.applyFailedPayment !== "function" ||
            typeof checkoutService.updateCheckoutWithPlan !== "function"
        ) {
            return {
                success: false,
                skipped: true,
                checkout: checkoutRecord
            };
        }

        const plan = checkoutService.applyFailedPayment(
            checkoutRecord,
            (verifyResult && verifyResult.error) || {},
            {
                ...options,
                ...buildCheckoutDependencyOptions(options),
                actorRole: "system"
            }
        );

        return checkoutService.updateCheckoutWithPlan(plan, {
            ...options,
            ...buildCheckoutDependencyOptions(options)
        });
    }

    async function applyCheckoutPaymentSuccess(checkoutRecord, verifyResult, options = {}) {
        const checkoutService = resolveCheckoutService(options.checkoutService);

        if (
            !checkoutService ||
            typeof checkoutService.applyVerifiedPayment !== "function" ||
            typeof checkoutService.updateCheckoutWithPlan !== "function"
        ) {
            return {
                success: false,
                skipped: true,
                checkout: checkoutRecord
            };
        }

        const payment = verifyResult && verifyResult.payment && typeof verifyResult.payment === "object"
            ? verifyResult.payment
            : {};
        const verification = verifyResult && verifyResult.verification && typeof verifyResult.verification === "object"
            ? verifyResult.verification
            : {};
        const reference = normalizeText(
            payment.reference ||
            verification.reference ||
            (verifyResult && verifyResult.reference)
        );
        const amountInMinorUnits =
            verification.amountInMinorUnits !== undefined
                ? verification.amountInMinorUnits
                : (
                    payment.amountInMinorUnits !== undefined
                        ? payment.amountInMinorUnits
                        : (
                            payment.amount !== undefined
                                ? Math.round(Number(payment.amount) * 100)
                                : checkoutRecord.paymentAmountInMinorUnits
                        )
                );
        const currency = payment.currency || verification.currency || checkoutRecord.paymentCurrency;
        const plan = checkoutService.applyVerifiedPayment(
            checkoutRecord,
            {
                status: verification.status || payment.status || "success",
                reference,
                amountInMinorUnits,
                currency
            },
            {
                ...options,
                ...buildCheckoutDependencyOptions(options),
                actorRole: "system",
                allowReferenceRefresh: true
            }
        );

        return checkoutService.updateCheckoutWithPlan(plan, {
            ...options,
            ...buildCheckoutDependencyOptions(options)
        });
    }

    function createOrderIdFromCheckout(checkoutRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const checkout = checkoutRecord && typeof checkoutRecord === "object" ? checkoutRecord : {};
        const explicit = normalizeText(safeOptions.orderId || checkout.convertedOrderId);

        if (explicit) {
            return explicit;
        }

        if (typeof safeOptions.orderIdFactory === "function") {
            const factoryId = normalizeText(safeOptions.orderIdFactory(checkout));

            if (factoryId) {
                return factoryId;
            }
        }

        const checkoutId = normalizeText(checkout.checkoutId || checkout.id);
        return checkoutId ? `order-${checkoutId}` : `order-${Date.now()}`;
    }

    async function createOrderFromPaidCheckout(checkoutRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const checkout = checkoutRecord && typeof checkoutRecord === "object" ? checkoutRecord : {};
        const existingOrderId = normalizeText(checkout.convertedOrderId);

        if (existingOrderId) {
            return {
                success: true,
                skipped: true,
                orderId: existingOrderId,
                order: {
                    orderId: existingOrderId,
                    checkoutId: normalizeText(checkout.checkoutId),
                    ...checkout
                }
            };
        }

        const db = safeOptions.db || resolveFirestore();
        const firestoreFns = resolveFirestoreFns(safeOptions.firestoreFns);
        const orderId = createOrderIdFromCheckout(checkout, safeOptions);
        const orderService = resolveOrderService(safeOptions.orderService);

        if (orderService && typeof orderService.createOrders === "function") {
            const result = await orderService.createOrders({
                ...safeOptions,
                db,
                firestoreFns,
                cartItems: checkout.items || [],
                customer: {
                    customerUid: checkout.customerUid,
                    customerName: checkout.customerName,
                    customerEmail: checkout.customerEmail
                },
                status: "pending",
                initialPaymentStatus: "paid",
                paymentProvider: checkout.paymentProvider,
                paymentReference: checkout.paymentReference,
                paymentAccessCode: checkout.paymentAccessCode,
                paymentAuthorizationUrl: checkout.paymentAuthorizationUrl,
                paymentCurrency: checkout.paymentCurrency,
                notes: checkout.notes,
                createdByRole: "system",
                orderIdFactory: function useConvertedOrderId() {
                    return orderId;
                }
            });

            if (!result.success) {
                return result;
            }

            const order = Array.isArray(result.orders) ? result.orders[0] : null;

            return {
                success: true,
                orderId: normalizeText(order && order.orderId) || orderId,
                order,
                result
            };
        }

        if (!db || !firestoreFns || typeof firestoreFns.doc !== "function" || typeof firestoreFns.setDoc !== "function") {
            return {
                success: false,
                error: {
                    code: "payment-callback/order-create-unavailable",
                    message: "Order service or Firestore setDoc is required to create the paid order."
                }
            };
        }

        const checkoutModel = resolveCheckoutModel(safeOptions.checkoutModel);
        const now = typeof firestoreFns.serverTimestamp === "function"
            ? firestoreFns.serverTimestamp()
            : new Date().toISOString();
        const order = checkoutModel && typeof checkoutModel.createOrderDraftFromCheckout === "function"
            ? checkoutModel.createOrderDraftFromCheckout(checkout, {
                orderId,
                status: "pending",
                createdAt: now,
                updatedAt: now
            })
            : {
                orderId,
                checkoutId: normalizeText(checkout.checkoutId),
                customerUid: normalizeText(checkout.customerUid),
                customerName: normalizeText(checkout.customerName),
                customerEmail: normalizeText(checkout.customerEmail),
                vendorUid: normalizeText(checkout.vendorUid),
                vendorName: normalizeText(checkout.vendorName),
                items: Array.isArray(checkout.items) ? checkout.items.slice() : [],
                itemCount: Number.parseInt(checkout.itemCount, 10) || 0,
                subtotal: normalizeNumber(checkout.subtotal) || 0,
                total: normalizeNumber(checkout.total) || 0,
                totalAmount: normalizeNumber(checkout.total) || 0,
                status: "pending",
                paymentStatus: "paid",
                paymentProvider: normalizeText(checkout.paymentProvider) || "paystack",
                paymentReference: normalizeText(checkout.paymentReference),
                paymentAccessCode: normalizeText(checkout.paymentAccessCode),
                paymentAuthorizationUrl: normalizeText(checkout.paymentAuthorizationUrl),
                paymentAmount: normalizeNumber(checkout.paymentAmount) || 0,
                paymentAmountInMinorUnits: Number.parseInt(checkout.paymentAmountInMinorUnits, 10) || 0,
                paymentCurrency: normalizeUpperText(checkout.paymentCurrency) || "ZAR",
                paymentPaidAt: checkout.paymentPaidAt || now,
                paymentVerifiedAt: checkout.paymentVerifiedAt || now,
                paymentFailureReason: "",
                notes: normalizeText(checkout.notes),
                createdAt: now,
                updatedAt: now
            };

        const docRef = firestoreFns.doc(db, "orders", orderId);
        await firestoreFns.setDoc(docRef, order);

        return {
            success: true,
            orderId,
            order,
            docRef
        };
    }

    async function convertCheckoutAfterOrder(checkoutRecord, orderId, options = {}) {
        const checkoutService = resolveCheckoutService(options.checkoutService);

        if (checkoutService && typeof checkoutService.convertCheckoutToOrder === "function") {
            return checkoutService.convertCheckoutToOrder({
                ...options,
                ...buildCheckoutDependencyOptions(options),
                checkout: checkoutRecord,
                orderId,
                actorRole: "system"
            });
        }

        const db = options.db || resolveFirestore();
        const firestoreFns = resolveFirestoreFns(options.firestoreFns);
        const checkoutId = normalizeText(checkoutRecord && checkoutRecord.checkoutId);

        if (!db || !checkoutId || typeof firestoreFns.doc !== "function" || typeof firestoreFns.updateDoc !== "function") {
            return {
                success: false,
                skipped: true,
                checkout: checkoutRecord,
                error: {
                    code: "payment-callback/checkout-conversion-skipped",
                    message: "Checkout conversion patch could not be saved."
                }
            };
        }

        const now = typeof firestoreFns.serverTimestamp === "function"
            ? firestoreFns.serverTimestamp()
            : new Date().toISOString();
        const patch = {
            status: "converted",
            convertedOrderId: normalizeText(orderId),
            convertedAt: now,
            updatedAt: now
        };
        await firestoreFns.updateDoc(firestoreFns.doc(db, "checkoutSessions", checkoutId), patch);

        return {
            success: true,
            checkout: {
                ...checkoutRecord,
                ...patch
            },
            patch
        };
    }

    async function convertPaidCheckoutOnServer(checkoutRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const checkout = checkoutRecord && typeof checkoutRecord === "object" ? checkoutRecord : {};
        const checkoutId = normalizeText(checkout.checkoutId || checkout.id || safeOptions.checkoutId);
        const callable = resolveConvertCheckoutToOrderCallable(safeOptions);

        if (!callable) {
            return {
                success: false,
                skipped: true,
                checkout,
                error: {
                    code: "payment-callback/checkout-conversion-callable-unavailable",
                    message: "Checkout conversion service is not available."
                }
            };
        }

        try {
            const callableResult = await callable({
                checkoutId,
                checkout,
                orderId: normalizeText(safeOptions.orderId)
            });
            const result = normalizeCallableResult(callableResult) || {};

            if (result.success !== true) {
                return {
                    success: false,
                    checkout,
                    order: result.order || null,
                    orderId: normalizeText(result.orderId),
                    result,
                    error: result.error || {
                        code: "payment-callback/checkout-conversion-failed",
                        message: "Payment was verified, but the checkout could not be converted into an order."
                    }
                };
            }

            return {
                success: true,
                checkout: result.checkout || checkout,
                order: result.order || null,
                orderId: normalizeText(result.orderId || (result.order && result.order.orderId)),
                result
            };
        } catch (error) {
            console.error(`${MODULE_NAME}: convertPaidCheckoutOnServer failed:`, error);

            return {
                success: false,
                checkout,
                error: {
                    code: error?.code || "payment-callback/checkout-conversion-failed",
                    message: error?.message || "Payment was verified, but the checkout could not be converted into an order."
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
        appendDetail("Checkout ID", normalizeText(safeInfo.checkoutId));
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
            const query = [];

            if (safeInfo.vendorUid) {
                query.push(`vendorUid=${encodeURIComponent(safeInfo.vendorUid)}`);
            }

            if (safeInfo.checkoutId) {
                query.push(`checkoutId=${encodeURIComponent(safeInfo.checkoutId)}`);
            }

            const checkoutHref = query.length > 0
                ? `${routes.checkout}?${query.join("&")}`
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
            checkoutId: normalizeText(safeOrder.checkoutId),
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
            checkoutId: normalizeText(safeOrder.checkoutId),
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

        const checkoutLookup = await findCheckoutForCallback(reference, safeOptions);

        if (checkoutLookup.success) {
            const checkoutRecord = checkoutLookup.data;
            const verifyResult = await verifyPaymentForCheckout(reference, checkoutRecord, safeOptions);

            if (!verifyResult.success) {
                const checkoutPatchResult = await applyCheckoutPaymentFailure(
                    checkoutRecord,
                    verifyResult,
                    safeOptions
                );

                return {
                    success: false,
                    outcome: "failed",
                    reference,
                    checkout: checkoutPatchResult.checkout || checkoutRecord,
                    verifyResult,
                    checkoutPatchResult
                };
            }

            const paidResult = await applyCheckoutPaymentSuccess(checkoutRecord, verifyResult, safeOptions);

            if (!paidResult.success) {
                return {
                    success: false,
                    outcome: "failed",
                    reference,
                    checkout: paidResult.checkout || checkoutRecord,
                    verifyResult: {
                        ...verifyResult,
                        error: paidResult.error || verifyResult.error || {
                            code: "payment-callback/checkout-payment-update-failed",
                            message: "Payment was verified, but the checkout could not be marked as paid."
                        }
                    },
                    checkoutPatchResult: paidResult
                };
            }

            const paidCheckout = paidResult.checkout || checkoutRecord;
            const serverConversionResult = await convertPaidCheckoutOnServer(paidCheckout, safeOptions);

            if (serverConversionResult.success) {
                return {
                    success: true,
                    outcome: "success",
                    reference,
                    checkout: serverConversionResult.checkout || paidCheckout,
                    order: serverConversionResult.order || {
                        orderId: serverConversionResult.orderId,
                        checkoutId: normalizeText(paidCheckout.checkoutId),
                        ...paidCheckout
                    },
                    orderId: serverConversionResult.orderId,
                    verifyResult,
                    checkoutPatchResult: paidResult,
                    orderResult: serverConversionResult,
                    conversionResult: serverConversionResult,
                    completedByServer: true
                };
            }

            if (!serverConversionResult.skipped) {
                return {
                    success: false,
                    outcome: "order-create-failed",
                    reference,
                    checkout: paidCheckout,
                    verifyResult,
                    checkoutPatchResult: paidResult,
                    orderResult: serverConversionResult,
                    conversionResult: serverConversionResult,
                    error: serverConversionResult.error
                };
            }

            const orderResult = await createOrderFromPaidCheckout(paidCheckout, safeOptions);

            if (!orderResult.success) {
                return {
                    success: false,
                    outcome: "order-create-failed",
                    reference,
                    checkout: paidCheckout,
                    verifyResult,
                    checkoutPatchResult: paidResult,
                    orderResult,
                    error: orderResult.error
                };
            }

            const conversionResult = await convertCheckoutAfterOrder(
                paidCheckout,
                orderResult.orderId,
                safeOptions
            );

            return {
                success: true,
                outcome: "success",
                reference,
                checkout: conversionResult.checkout || paidCheckout,
                order: orderResult.order,
                orderId: orderResult.orderId,
                verifyResult,
                checkoutPatchResult: paidResult,
                orderResult,
                conversionResult
            };
        }

        if (!checkoutLookup.skipped && getCheckoutId(safeOptions)) {
            return {
                success: false,
                outcome: "checkout-not-found",
                reference,
                error: checkoutLookup.error
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
            const summaryInfo = buildSuccessSummary(
                safeResult.verifyResult,
                safeResult.order || safeResult.checkout
            );
            setStatusMessage(
                safeElements.statusElement,
                "Payment confirmed. Your order has been sent to the vendor.",
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

        if (safeResult.outcome === "checkout-not-found") {
            setStatusMessage(
                safeElements.statusElement,
                "We could not find the checkout session for that payment.",
                "error"
            );
            renderPaymentSummary(safeElements.summaryElement, {
                tone: "error",
                heading: "Checkout Not Found",
                reference: safeResult.reference,
                message: safeResult.error && safeResult.error.message
                    ? safeResult.error.message
                    : "No checkout session matches that payment callback."
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

        if (safeResult.outcome === "order-create-failed") {
            const failureInfo = buildFailureSummary(
                {
                    error: safeResult.error || {
                        message: "Payment was verified, but the order could not be created."
                    }
                },
                safeResult.checkout,
                safeResult.reference
            );

            failureInfo.heading = "Order Could Not Be Created";
            setStatusMessage(
                safeElements.statusElement,
                failureInfo.message,
                "error"
            );
            renderPaymentSummary(safeElements.summaryElement, failureInfo);
            renderActions(safeElements.actionsElement, failureInfo);
            return failureInfo;
        }

        const failureInfo = buildFailureSummary(
            safeResult.verifyResult,
            safeResult.order || safeResult.checkout,
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
        getCheckoutId,
        resolveFirestore,
        resolveAuth,
        resolveAuthFns,
        resolveFirestoreFns,
        resolveFunctions,
        resolveFunctionsFns,
        resolvePaymentFormatters,
        resolvePaymentStatus,
        resolveCheckoutStatus,
        resolveCheckoutModel,
        resolveCheckoutValidation,
        resolveCheckoutQueries,
        resolveCheckoutService,
        resolveOrderService,
        buildCheckoutDependencyOptions,
        formatAmount,
        getPaymentStatusLabel,
        setStatusMessage,
        createBackButton,
        normalizeCallableResult,
        resolveVerifyPaymentCallable,
        resolveConvertCheckoutToOrderCallable,
        buildPaymentSliceFromOrder,
        buildPaymentSliceFromCheckout,
        supportsOrderQuery,
        supportsOrderUpdate,
        findOrderByReference,
        findCheckoutForCallback,
        updateOrderPatch,
        verifyPaymentForOrder,
        verifyPaymentForCheckout,
        applyCheckoutPaymentFailure,
        applyCheckoutPaymentSuccess,
        createOrderIdFromCheckout,
        createOrderFromPaidCheckout,
        convertCheckoutAfterOrder,
        convertPaidCheckoutOnServer,
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
