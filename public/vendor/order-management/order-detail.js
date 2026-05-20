(function attachVendorOrderDetailPage(globalScope) {
    "use strict";

    const MODULE_NAME = "vendor/order-management/order-detail";
    let initInFlight = null;
    let lastInitOptions = null;

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
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

    function normalizeCallableResult(result) {
        if (result && typeof result === "object" && "data" in result) {
            return result.data;
        }

        return result;
    }

    function resolveRefundPaymentCallable(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        if (typeof safeOptions.refundPaymentCallable === "function") {
            return safeOptions.refundPaymentCallable;
        }

        if (
            safeOptions.paymentFunctions &&
            typeof safeOptions.paymentFunctions.refundPayment === "function"
        ) {
            return safeOptions.paymentFunctions.refundPayment;
        }

        const functions = resolveFunctions(safeOptions.functions);
        const functionsFns = resolveFunctionsFns(safeOptions.functionsFns);

        if (
            functions &&
            functionsFns &&
            typeof functionsFns.httpsCallable === "function"
        ) {
            return functionsFns.httpsCallable(functions, "refundPayment");
        }

        return null;
    }

    function resolveOrderService(explicitOrderService) {
        if (explicitOrderService && typeof explicitOrderService.getOrderById === "function") {
            return explicitOrderService;
        }

        if (globalScope.orderService && typeof globalScope.orderService.getOrderById === "function") {
            return globalScope.orderService;
        }

        return null;
    }

    function resolveOrderStatus(explicitOrderStatus) {
        if (explicitOrderStatus && typeof explicitOrderStatus.getAllowedNextStatuses === "function") {
            return explicitOrderStatus;
        }

        if (globalScope.orderStatus && typeof globalScope.orderStatus.getAllowedNextStatuses === "function") {
            return globalScope.orderStatus;
        }

        return null;
    }

    function resolveOrderFormatters(explicitOrderFormatters) {
        if (explicitOrderFormatters && typeof explicitOrderFormatters.formatOrderSummary === "function") {
            return explicitOrderFormatters;
        }

        if (globalScope.orderFormatters && typeof globalScope.orderFormatters.formatOrderSummary === "function") {
            return globalScope.orderFormatters;
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

    function resolveRefundStatus(explicitRefundStatus) {
        if (
            explicitRefundStatus &&
            typeof explicitRefundStatus.getRefundStatusLabel === "function"
        ) {
            return explicitRefundStatus;
        }

        if (
            globalScope.refundStatus &&
            typeof globalScope.refundStatus.getRefundStatusLabel === "function"
        ) {
            return globalScope.refundStatus;
        }

        return null;
    }

    function waitForAuthReady(auth, authFns, timeoutMs = 5000) {
        if (!auth || !authFns || typeof authFns.onAuthStateChanged !== "function") {
            return Promise.resolve(auth?.currentUser || null);
        }

        return new Promise(function resolveAuthState(resolve) {
            let settled = false;
            let unsubscribe = function noop() {
                return undefined;
            };

            function finish(user) {
                if (settled) {
                    return;
                }

                settled = true;
                unsubscribe();
                resolve(user || null);
            }

            unsubscribe = authFns.onAuthStateChanged(auth, function onChange(user) {
                finish(user);
            }, function onError() {
                finish(auth.currentUser || null);
            }) || function noop() {
                return undefined;
            };

            globalScope.setTimeout(function onTimeout() {
                finish(auth.currentUser || null);
            }, timeoutMs);
        });
    }

    function normalizeVendorProfile(profile) {
        const safeProfile = profile && typeof profile === "object" ? profile : {};

        return {
            uid: normalizeText(safeProfile.uid),
            displayName: normalizeText(safeProfile.displayName || safeProfile.vendorOwnerName),
            vendorStatus: normalizeLowerText(safeProfile.vendorStatus),
            accountStatus: normalizeLowerText(safeProfile.accountStatus) || "active",
            isAdmin: safeProfile.isAdmin === true
        };
    }

    function canAccessVendorWorkspace(profile) {
        const safeProfile = normalizeVendorProfile(profile);
        const hasVendorAccess = safeProfile.vendorStatus === "approved" || safeProfile.isAdmin === true;
        const accountAllowed = safeProfile.accountStatus !== "disabled" && safeProfile.accountStatus !== "blocked";

        return hasVendorAccess && accountAllowed;
    }

    async function fetchVendorProfile(options = {}) {
        const authService = options.authService || globalScope.authService || null;
        const currentUser = options.currentUser && typeof options.currentUser === "object"
            ? options.currentUser
            : null;
        const firestoreFns = resolveFirestoreFns(options.firestoreFns);
        const db = options.db || resolveFirestore();

        if (
            authService &&
            currentUser &&
            typeof authService.getCurrentUserProfile === "function" &&
            normalizeText(currentUser.uid)
        ) {
            try {
                const loadedProfile = await authService.getCurrentUserProfile(currentUser.uid);

                if (loadedProfile) {
                    return normalizeVendorProfile({
                        uid: currentUser.uid,
                        ...loadedProfile
                    });
                }
            } catch (error) {
                console.error(`${MODULE_NAME}: Failed to load vendor profile via authService:`, error);
            }
        }

        if (
            db &&
            currentUser &&
            normalizeText(currentUser.uid) &&
            typeof firestoreFns.doc === "function" &&
            typeof firestoreFns.getDoc === "function"
        ) {
            try {
                const snapshot = await firestoreFns.getDoc(
                    firestoreFns.doc(db, "users", currentUser.uid)
                );

                if (!snapshot || (typeof snapshot.exists === "function" && !snapshot.exists())) {
                    return normalizeVendorProfile(currentUser);
                }

                const data = typeof snapshot.data === "function" ? (snapshot.data() || {}) : {};

                return normalizeVendorProfile({
                    uid: currentUser.uid,
                    displayName: currentUser.displayName,
                    ...data
                });
            } catch (error) {
                console.error(`${MODULE_NAME}: Failed to load vendor profile from Firestore:`, error);
            }
        }

        return normalizeVendorProfile(currentUser);
    }

    function getOrderIdFromLocation(locationObject = globalScope.location) {
        const href = locationObject && typeof locationObject.href === "string"
            ? locationObject.href
            : "";

        if (!href) {
            return "";
        }

        const url = new URL(href, "http://localhost/");
        return normalizeText(url.searchParams.get("orderId"));
    }

    async function fetchOrderDetail(options = {}) {
        const db = options.db || resolveFirestore();
        const firestoreFns = resolveFirestoreFns(options.firestoreFns);
        const orderService = resolveOrderService(options.orderService);
        const orderId = normalizeText(options.orderId);

        if (!orderId) {
            return {
                success: false,
                order: null,
                error: {
                    code: "missing-order-id",
                    message: "Open this page from a vendor order link so the order can be loaded."
                }
            };
        }

        if (orderService && db) {
            try {
                const order = await orderService.getOrderById({
                    db,
                    firestoreFns,
                    orderId
                });

                if (order) {
                    return {
                        success: true,
                        order
                    };
                }
            } catch (error) {
                console.error(`${MODULE_NAME}: Error fetching order via service:`, error);
            }
        }

        if (
            !db ||
            typeof firestoreFns.doc !== "function" ||
            typeof firestoreFns.getDoc !== "function"
        ) {
            return {
                success: false,
                order: null,
                error: {
                    code: "no-firestore",
                    message: "Order detail access is not available right now."
                }
            };
        }

        try {
            const snapshot = await firestoreFns.getDoc(
                firestoreFns.doc(db, "orders", orderId)
            );

            if (!snapshot || (typeof snapshot.exists === "function" && !snapshot.exists())) {
                return {
                    success: false,
                    order: null,
                    error: {
                        code: "not-found",
                        message: "That order could not be found."
                    }
                };
            }

            const data = typeof snapshot.data === "function" ? (snapshot.data() || {}) : {};

            return {
                success: true,
                order: {
                    orderId: normalizeText(snapshot.id) || orderId,
                    ...data
                }
            };
        } catch (error) {
            return {
                success: false,
                order: null,
                error: {
                    code: normalizeText(error && error.code) || "fetch-error",
                    message: normalizeText(error && error.message) || "Failed to load the vendor order detail."
                }
            };
        }
    }

    function setStatusMessage(element, message, state = "info") {
        if (!element) {
            return;
        }

        element.textContent = normalizeText(message);
        element.setAttribute("data-state", normalizeText(state) || "info");
    }

    function getAllowedVendorActions(orderRecord, options = {}) {
        const orderStatus = resolveOrderStatus(options.orderStatus);
        const currentStatus = normalizeLowerText(orderRecord && orderRecord.status);

        if (!orderStatus || !currentStatus) {
            return [];
        }

        const nextStatuses = orderStatus.getAllowedNextStatuses(currentStatus, "vendor");

        return nextStatuses.map(function mapStatus(status) {
            return {
                type: status === orderStatus.ORDER_STATUSES.COMPLETED ? "confirm_collection" : "status_change",
                nextStatus: status,
                label: orderStatus.getOrderStatusActionLabel(status),
                tone: orderStatus.getOrderStatusTone(status)
            };
        });
    }

    function createParagraph(text, className) {
        const paragraph = globalScope.document.createElement("p");
        paragraph.textContent = text;

        if (className) {
            paragraph.className = className;
        }

        return paragraph;
    }

    function renderOrderSummary(orderRecord, container, options = {}) {
        if (!container) {
            return;
        }

        container.innerHTML = "";

        if (!orderRecord || typeof orderRecord !== "object") {
            container.appendChild(createParagraph("Order summary is unavailable right now.", "empty-state-message"));
            return;
        }

        const orderFormatters = resolveOrderFormatters(options.orderFormatters);
        const orderStatus = resolveOrderStatus(options.orderStatus);
        const summaryList = globalScope.document.createElement("ol");
        const orderIdText = orderFormatters && typeof orderFormatters.formatOrderId === "function"
            ? orderFormatters.formatOrderId(orderRecord.orderId)
            : `Order #${normalizeText(orderRecord.orderId)}`;
        const statusText = orderFormatters && typeof orderFormatters.getOrderStatusLabel === "function"
            ? orderFormatters.getOrderStatusLabel(orderRecord.status, orderStatus)
            : normalizeText(orderRecord.status) || "Unknown Status";
        const totalText = orderFormatters && typeof orderFormatters.formatOrderTotal === "function"
            ? orderFormatters.formatOrderTotal(orderRecord)
            : `R${Number(orderRecord.total || 0).toFixed(2)}`;
        const itemCountText = orderFormatters && typeof orderFormatters.formatItemCount === "function"
            ? orderFormatters.formatItemCount(orderRecord.itemCount || 0)
            : `${Number(orderRecord.itemCount || 0)} items`;
        const updatedText = orderFormatters && typeof orderFormatters.formatDateTime === "function"
            ? orderFormatters.formatDateTime(orderRecord.updatedAt || orderRecord.createdAt)
            : "Unknown time";

        [
            orderIdText,
            `Customer: ${normalizeText(orderRecord.customerName) || "Customer"}`,
            `Vendor: ${normalizeText(orderRecord.vendorName) || "Vendor"}`,
            `Status: ${statusText}`,
            `Items: ${itemCountText}`,
            `Total: ${totalText}`,
            `Last update: ${updatedText}`
        ].forEach(function appendLine(text) {
            const item = globalScope.document.createElement("li");
            item.textContent = text;
            summaryList.appendChild(item);
        });

        container.appendChild(summaryList);
    }

    function renderOrderItems(orderRecord, container, options = {}) {
        if (!container) {
            return;
        }

        container.innerHTML = "";

        const items = Array.isArray(orderRecord && orderRecord.items) ? orderRecord.items : [];
        const orderFormatters = resolveOrderFormatters(options.orderFormatters);

        if (items.length === 0) {
            container.appendChild(createParagraph("This order does not have any saved items yet.", "empty-state-message"));
            return;
        }

        const list = globalScope.document.createElement("ol");

        items.forEach(function appendItem(itemRecord) {
            const safeItem = itemRecord && typeof itemRecord === "object" ? itemRecord : {};
            const listItem = globalScope.document.createElement("li");
            const name = createParagraph(normalizeText(safeItem.name) || "Menu item");
            const meta = createParagraph(
                `Quantity: ${Number(safeItem.quantity || 0)} • Price: ${orderFormatters && typeof orderFormatters.formatCurrency === "function"
                    ? orderFormatters.formatCurrency(Number(safeItem.price || 0))
                    : `R${Number(safeItem.price || 0).toFixed(2)}`} • Subtotal: ${orderFormatters && typeof orderFormatters.formatCurrency === "function"
                    ? orderFormatters.formatCurrency(Number(safeItem.subtotal || 0))
                    : `R${Number(safeItem.subtotal || 0).toFixed(2)}`}`
            );

            name.className = "vendor-order-item-name";
            meta.className = "vendor-order-item-meta";
            listItem.appendChild(name);
            listItem.appendChild(meta);

            if (normalizeText(safeItem.notes)) {
                listItem.appendChild(createParagraph(`Notes: ${normalizeText(safeItem.notes)}`, "vendor-order-item-meta"));
            }

            list.appendChild(listItem);
        });

        container.appendChild(list);
    }

    function buildPaymentView(orderRecord, options = {}) {
        const safeOrder = orderRecord && typeof orderRecord === "object" ? orderRecord : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const paymentStatus = resolvePaymentStatus(safeOptions.paymentStatus);
        const paymentFormatters = resolvePaymentFormatters(safeOptions.paymentFormatters);
        const refundStatus = resolveRefundStatus(safeOptions.refundStatus);
        const rawPaymentStatus = normalizeText(safeOrder.paymentStatus);
        const normalizedPaymentStatus =
            paymentStatus && typeof paymentStatus.normalizePaymentStatus === "function"
                ? paymentStatus.normalizePaymentStatus(rawPaymentStatus, "unpaid")
                : rawPaymentStatus.toLowerCase() || "unpaid";
        const isPaid =
            paymentStatus && typeof paymentStatus.isPaymentPaid === "function"
                ? paymentStatus.isPaymentPaid(normalizedPaymentStatus)
                : normalizedPaymentStatus === "paid";
        const statusLabel =
            paymentStatus && typeof paymentStatus.getPaymentStatusLabel === "function"
                ? paymentStatus.getPaymentStatusLabel(normalizedPaymentStatus)
                : normalizedPaymentStatus;
        const description =
            paymentStatus && typeof paymentStatus.getPaymentStatusDescription === "function"
                ? paymentStatus.getPaymentStatusDescription(normalizedPaymentStatus)
                : "";
        const tone =
            paymentStatus && typeof paymentStatus.getPaymentStatusTone === "function"
                ? paymentStatus.getPaymentStatusTone(normalizedPaymentStatus)
                : "neutral";

        const currency = normalizeText(safeOrder.paymentCurrency) || "ZAR";
        const amount = Number.isFinite(Number(safeOrder.paymentAmount))
            ? Number(safeOrder.paymentAmount)
            : Number(safeOrder.total) || 0;
        const amountText =
            paymentFormatters && typeof paymentFormatters.formatPaymentAmount === "function"
                ? paymentFormatters.formatPaymentAmount(amount, currency)
                : (currency === "ZAR"
                    ? `R${amount.toFixed(2)}`
                    : `${currency} ${amount.toFixed(2)}`);

        const provider = normalizeText(safeOrder.paymentProvider) || "paystack";
        const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);
        const orderFormatters = resolveOrderFormatters(safeOptions.orderFormatters);
        const paidAtSource = safeOrder.paymentPaidAt || safeOrder.paymentVerifiedAt;
        const paidAtText = orderFormatters && typeof orderFormatters.formatDateTime === "function" && paidAtSource
            ? normalizeText(orderFormatters.formatDateTime(paidAtSource))
            : "";
        const failedAtText = orderFormatters && typeof orderFormatters.formatDateTime === "function" && safeOrder.paymentFailedAt
            ? normalizeText(orderFormatters.formatDateTime(safeOrder.paymentFailedAt))
            : "";
        const rawRefundStatus = normalizeText(safeOrder.refundStatus || safeOrder.paymentRefundStatus);
        const defaultRefundStatus = refundStatus && typeof refundStatus.getDefaultRefundStatus === "function"
            ? refundStatus.getDefaultRefundStatus()
            : "not_requested";
        const normalizedRefundStatus =
            refundStatus && typeof refundStatus.normalizeRefundStatus === "function"
                ? refundStatus.normalizeRefundStatus(rawRefundStatus, defaultRefundStatus)
                : rawRefundStatus.toLowerCase() || defaultRefundStatus;
        const refundStatusLabel =
            refundStatus && typeof refundStatus.getRefundStatusLabel === "function"
                ? refundStatus.getRefundStatusLabel(normalizedRefundStatus)
                : normalizedRefundStatus;
        const refundTone =
            refundStatus && typeof refundStatus.getRefundStatusTone === "function"
                ? refundStatus.getRefundStatusTone(normalizedRefundStatus)
                : "neutral";
        const refundAmount = Number.isFinite(Number(safeOrder.refundAmount || safeOrder.paymentRefundAmount))
            ? Number(safeOrder.refundAmount || safeOrder.paymentRefundAmount)
            : 0;
        const refundAmountText = refundAmount > 0
            ? (paymentFormatters && typeof paymentFormatters.formatPaymentAmount === "function"
                ? paymentFormatters.formatPaymentAmount(refundAmount, currency)
                : (currency === "ZAR"
                    ? `R${refundAmount.toFixed(2)}`
                    : `${currency} ${refundAmount.toFixed(2)}`))
            : "";
        const refundRequested =
            normalizedRefundStatus &&
            normalizedRefundStatus !== "not_requested";
        const requiresRefund =
            isPaid &&
            normalizeLowerText(safeOrder.status) === "rejected" &&
            normalizedRefundStatus === "not_requested";

        return {
            status: normalizedPaymentStatus,
            statusLabel,
            description,
            tone,
            amount,
            amountText,
            currency,
            provider,
            providerLabel,
            reference: normalizeText(safeOrder.paymentReference),
            checkoutId: normalizeText(safeOrder.checkoutId),
            paidAtText,
            failedAtText,
            failureReason: normalizeText(safeOrder.paymentFailureReason),
            isPaid,
            refundStatus: normalizedRefundStatus,
            refundStatusLabel,
            refundTone,
            refundRequested,
            refundAmount,
            refundAmountText,
            refundReference: normalizeText(safeOrder.refundReference || safeOrder.paymentRefundReference),
            refundReason: normalizeText(safeOrder.refundReason || safeOrder.paymentRefundReason),
            requiresRefund
        };
    }

    function shouldRefundRejectedOrder(orderRecord, options = {}) {
        const view = buildPaymentView(orderRecord, options);
        const refundStatus = normalizeLowerText(view.refundStatus);

        return view.isPaid &&
            normalizeLowerText(orderRecord && orderRecord.status) !== "cancelled" &&
            refundStatus !== "requested" &&
            refundStatus !== "processing" &&
            refundStatus !== "refunded";
    }

    function buildRefundPaymentRequest(orderRecord, options = {}) {
        const safeOrder = orderRecord && typeof orderRecord === "object" ? orderRecord : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const view = buildPaymentView(safeOrder, safeOptions);
        const currentUser = safeOptions.currentUser && typeof safeOptions.currentUser === "object"
            ? safeOptions.currentUser
            : {};
        const reason = normalizeText(
            safeOptions.refundReason ||
            safeOrder.refundReason ||
            "Vendor rejected the paid order."
        );

        return {
            payment: {
                orderId: normalizeText(safeOrder.orderId || safeOrder.id),
                checkoutId: normalizeText(safeOrder.checkoutId),
                customerUid: normalizeText(safeOrder.customerUid),
                vendorUid: normalizeText(safeOrder.vendorUid),
                provider: view.provider,
                status: view.status,
                reference: view.reference,
                paymentReference: view.reference,
                amount: view.amount,
                paymentAmount: view.amount,
                amountInMinorUnits: Number.parseInt(safeOrder.paymentAmountInMinorUnits || 0, 10) || Math.round(view.amount * 100),
                paymentAmountInMinorUnits: Number.parseInt(safeOrder.paymentAmountInMinorUnits || 0, 10) || Math.round(view.amount * 100),
                currency: view.currency,
                paymentCurrency: view.currency,
                refundStatus: view.refundStatus
            },
            reference: view.reference,
            refundAmount: view.amount,
            reason,
            customerNote: "Your payment is being refunded because the vendor rejected this order.",
            metadata: {
                orderId: normalizeText(safeOrder.orderId || safeOrder.id),
                checkoutId: normalizeText(safeOrder.checkoutId),
                customerUid: normalizeText(safeOrder.customerUid),
                vendorUid: normalizeText(safeOrder.vendorUid),
                rejectedByUid: normalizeText(currentUser.uid),
                rejectedByName: normalizeText(currentUser.displayName) || "Vendor"
            }
        };
    }

    async function refundRejectedOrder(orderRecord, options = {}) {
        const callable = resolveRefundPaymentCallable(options);
        const request = buildRefundPaymentRequest(orderRecord, options);

        if (!callable) {
            return {
                success: false,
                request,
                error: {
                    code: "vendor-order/refund-unavailable",
                    message: "Refund service is not available. Please ask an admin to refund this paid rejected order."
                }
            };
        }

        try {
            const callableResult = await callable(request);
            const result = normalizeCallableResult(callableResult) || {};

            if (result.success !== true) {
                return {
                    success: false,
                    request,
                    refund: result.refund || null,
                    patch: result.patch || null,
                    error: result.error || {
                        code: "vendor-order/refund-failed",
                        message: "The order was rejected, but the refund could not be started."
                    }
                };
            }

            return {
                success: true,
                request,
                refund: result.refund || null,
                patch: result.patch || null,
                patchResult: result.patchResult || null,
                reference: result.reference || request.reference
            };
        } catch (error) {
            return {
                success: false,
                request,
                error: {
                    code: normalizeText(error && error.code) || "vendor-order/refund-failed",
                    message: normalizeText(error && error.message) || "The order was rejected, but the refund could not be started."
                }
            };
        }
    }

    function getPaymentGate(orderRecord, options = {}) {
        const safeOrder = orderRecord && typeof orderRecord === "object" ? orderRecord : {};
        const view = buildPaymentView(safeOrder, options);
        const orderStatus = normalizeLowerText(safeOrder.status);
        const orderStatusHelpers = resolveOrderStatus(options.orderStatus);
        const requiresPayment =
            orderStatusHelpers && typeof orderStatusHelpers.orderStatusRequiresPaidPayment === "function"
                ? orderStatusHelpers.orderStatusRequiresPaidPayment(orderStatus)
                : ["completed", "rejected", "cancelled"].indexOf(orderStatus) === -1;

        if (!requiresPayment || view.isPaid) {
            return {
                blocked: false,
                paymentStatus: view.status,
                statusLabel: view.statusLabel
            };
        }

        return {
            blocked: true,
            paymentStatus: view.status,
            statusLabel: view.statusLabel,
            reason: `Customer payment is ${view.statusLabel}. Do not accept, prepare, complete, or fulfil this order until payment is completed. You can still reject the order.`
        };
    }

    function renderOrderPayment(orderRecord, container, options = {}) {
        if (!container) {
            return;
        }

        container.innerHTML = "";

        if (!orderRecord || typeof orderRecord !== "object") {
            container.appendChild(createParagraph(
                "Payment details are unavailable right now.",
                "empty-state-message"
            ));
            return;
        }

        const view = buildPaymentView(orderRecord, options);
        const doc = globalScope.document;

        const statusLine = doc.createElement("p");
        statusLine.className = "vendor-order-payment-status";
        statusLine.textContent = `Status: ${view.statusLabel}`;
        statusLine.setAttribute("data-tone", view.tone);
        statusLine.setAttribute("data-payment-status", view.status);
        container.appendChild(statusLine);

        if (view.description) {
            container.appendChild(createParagraph(view.description, "vendor-order-payment-description"));
        }

        const list = doc.createElement("ul");
        list.className = "vendor-order-payment-list";

        function appendDetail(label, value, className) {
            const safeValue = normalizeText(value);

            if (!safeValue) {
                return;
            }

            const item = doc.createElement("li");
            item.className = className || "vendor-order-payment-item";
            item.textContent = `${label}: ${safeValue}`;
            list.appendChild(item);
        }

        appendDetail("Amount", view.amountText, "vendor-order-payment-amount");
        appendDetail("Checkout ID", view.checkoutId, "vendor-order-payment-checkout-id");
        appendDetail("Provider", view.providerLabel, "vendor-order-payment-provider");
        appendDetail("Reference", view.reference, "vendor-order-payment-reference");
        appendDetail("Paid at", view.paidAtText, "vendor-order-payment-paid-at");
        appendDetail("Failed at", view.failedAtText, "vendor-order-payment-failed-at");
        appendDetail("Failure reason", view.failureReason, "vendor-order-payment-failure-reason");
        appendDetail("Refund status", view.refundStatusLabel, "vendor-order-refund-status");
        appendDetail("Refund amount", view.refundAmountText, "vendor-order-refund-amount");
        appendDetail("Refund reference", view.refundReference, "vendor-order-refund-reference");
        appendDetail("Refund reason", view.refundReason, "vendor-order-refund-reason");

        container.appendChild(list);

        const refundStatusLine = container.querySelector(".vendor-order-refund-status");
        if (refundStatusLine) {
            refundStatusLine.setAttribute("data-tone", view.refundTone);
            refundStatusLine.setAttribute("data-refund-status", view.refundStatus);
        }

        if (view.requiresRefund) {
            const refundNotice = createParagraph(
                "This paid rejected order must be refunded before it is considered settled.",
                "vendor-order-refund-notice"
            );
            refundNotice.setAttribute("data-tone", "warning");
            container.appendChild(refundNotice);
        }
    }

    function renderOrderTimeline(orderRecord, container, options = {}) {
        if (!container) {
            return;
        }

        container.innerHTML = "";

        const orderFormatters = resolveOrderFormatters(options.orderFormatters);
        const orderStatus = resolveOrderStatus(options.orderStatus);
        const timeline = orderFormatters && typeof orderFormatters.formatTimeline === "function"
            ? orderFormatters.formatTimeline(orderRecord, { orderStatus })
            : [];

        if (timeline.length === 0) {
            container.appendChild(createParagraph("No order timeline has been recorded yet.", "empty-state-message"));
            return;
        }

        const list = globalScope.document.createElement("ol");

        timeline.forEach(function appendEntry(entry) {
            const listItem = globalScope.document.createElement("li");
            const label = createParagraph(entry.label);
            const meta = createParagraph(`${entry.actorLabel} • ${entry.timestampText}`);

            label.className = "vendor-order-timeline-label";
            meta.className = "vendor-order-timeline-meta";

            listItem.appendChild(label);
            listItem.appendChild(meta);

            if (normalizeText(entry.note)) {
                listItem.appendChild(createParagraph(entry.note, "vendor-order-timeline-note"));
            }

            list.appendChild(listItem);
        });

        container.appendChild(list);
    }

    function renderActionButtons(orderRecord, container, options = {}) {
        if (!container) {
            return;
        }

        container.innerHTML = "";

        const orderStatus = resolveOrderStatus(options.orderStatus);
        const orderFormatters = resolveOrderFormatters(options.orderFormatters);
        const actions = getAllowedVendorActions(orderRecord, options);
        const gate = getPaymentGate(orderRecord, options);

        if (gate.blocked) {
            const banner = createParagraph(gate.reason, "vendor-order-payment-gate");
            banner.setAttribute("data-tone", "error");
            banner.setAttribute("data-payment-status", gate.paymentStatus);
            container.appendChild(banner);
        }

        if (actions.length === 0) {
            const currentStatusLabel = orderFormatters && typeof orderFormatters.getOrderStatusLabel === "function"
                ? orderFormatters.getOrderStatusLabel(orderRecord && orderRecord.status, orderStatus)
                : normalizeText(orderRecord && orderRecord.status) || "current";
            container.appendChild(createParagraph(
                `No further vendor actions are available for this order while it is ${currentStatusLabel.toLowerCase()}.`,
                "empty-state-message"
            ));
            return;
        }

        const menu = globalScope.document.createElement("menu");
        menu.className = "action-menu";
        menu.setAttribute("aria-label", "Vendor order actions");

        actions.forEach(function appendAction(action) {
            const item = globalScope.document.createElement("li");
            const button = globalScope.document.createElement("button");
            const isRejection = normalizeLowerText(action.nextStatus) === "rejected";
            const blockedByPayment = gate.blocked && !isRejection;

            button.type = "button";
            button.textContent = action.label;
            button.dataset.actionType = action.type;
            button.dataset.nextStatus = action.nextStatus;
            button.dataset.tone = action.tone;

            if (blockedByPayment) {
                button.disabled = true;
                button.dataset.blockedReason = "payment-not-confirmed";
                button.setAttribute("aria-disabled", "true");
                button.title = gate.reason;
            } else {
                button.addEventListener("click", function onClick() {
                    return handleOrderAction(action, options);
                });
            }

            item.appendChild(button);
            menu.appendChild(item);
        });

        container.appendChild(menu);
    }

    function renderEmptyState(containers) {
        const safeContainers = containers && typeof containers === "object" ? containers : {};

        Object.keys(safeContainers).forEach(function clearContainer(key) {
            if (!safeContainers[key]) {
                return;
            }

            safeContainers[key].innerHTML = "";
            safeContainers[key].appendChild(createParagraph("No order information is available.", "empty-state-message"));
        });
    }

    async function handleOrderAction(action, options = {}) {
        const safeAction = action && typeof action === "object" ? action : {};
        const orderService = resolveOrderService(options.orderService);
        const statusElement = globalScope.document.querySelector(options.statusSelector || "#vendor-order-detail-status");
        const currentOrder = options.currentOrder && typeof options.currentOrder === "object"
            ? options.currentOrder
            : null;
        const currentUser = options.currentUser && typeof options.currentUser === "object"
            ? options.currentUser
            : null;

        if (!orderService || !currentOrder) {
            return {
                success: false,
                error: "Order actions are not available right now."
            };
        }

        const gate = getPaymentGate(currentOrder, options);
        const isRejection = normalizeLowerText(safeAction.nextStatus) === "rejected";
        const refundRequired = isRejection && shouldRefundRejectedOrder(currentOrder, options);

        if (gate.blocked && !isRejection) {
            setStatusMessage(statusElement, gate.reason, "error");

            return {
                success: false,
                error: gate.reason,
                blockedByPayment: true
            };
        }

        setStatusMessage(
            statusElement,
            refundRequired
                ? "Rejecting order and starting customer refund..."
                : "Updating order status...",
            "loading"
        );

        let result;

        if (safeAction.type === "confirm_collection") {
            result = await orderService.confirmOrderCollection({
                db: options.db || resolveFirestore(),
                firestoreFns: resolveFirestoreFns(options.firestoreFns),
                order: currentOrder,
                actorRole: "vendor",
                actorUid: normalizeText(currentUser && currentUser.uid),
                actorName: normalizeText(currentUser && currentUser.displayName) || "Vendor"
            });
        } else {
            result = await orderService.updateOrderStatus({
                db: options.db || resolveFirestore(),
                firestoreFns: resolveFirestoreFns(options.firestoreFns),
                order: currentOrder,
                nextStatus: safeAction.nextStatus,
                actorRole: "vendor",
                actorUid: normalizeText(currentUser && currentUser.uid),
                actorName: normalizeText(currentUser && currentUser.displayName) || "Vendor"
            });
        }

        if (!result || result.success !== true) {
            setStatusMessage(
                statusElement,
                result && result.error && result.error.message
                    ? result.error.message
                    : "Failed to update the order.",
                "error"
            );

            return {
                success: false,
                error: result && result.error ? result.error.message : "Failed to update the order."
            };
        }

        let refundResult = null;

        if (refundRequired) {
            refundResult = await refundRejectedOrder(
                result.order || currentOrder,
                {
                    ...options,
                    currentUser
                }
            );

            if (!refundResult.success) {
                const refundMessage =
                    refundResult.error && refundResult.error.message
                        ? refundResult.error.message
                        : "Order rejected, but the refund could not be started.";

                setStatusMessage(statusElement, refundMessage, "error");

                return {
                    success: false,
                    order: result.order,
                    orderUpdated: true,
                    refundRequired: true,
                    refundResult,
                    error: refundMessage
                };
            }
        }

        setStatusMessage(
            statusElement,
            refundRequired
                ? "Order rejected and customer refund started successfully."
                : "Order updated successfully.",
            "success"
        );

        if (lastInitOptions) {
            await init({
                ...lastInitOptions,
                currentUser,
                orderId: currentOrder.orderId
            });
        }

        return {
            success: true,
            order: result.order,
            refundRequired,
            refundResult
        };
    }

    async function init(options = {}) {
        if (initInFlight) {
            return initInFlight;
        }

        initInFlight = (async function runInit() {
            lastInitOptions = { ...options };

            const auth = options.auth || resolveAuth();
            const authFns = resolveAuthFns(options.authFns);
            const db = options.db || resolveFirestore();
            const firestoreFns = resolveFirestoreFns(options.firestoreFns);
            const statusElement = globalScope.document.querySelector(options.statusSelector || "#vendor-order-detail-status");
            const actionContainer = globalScope.document.querySelector(options.actionSelector || "#vendor-order-action-container");
            const summaryContainer = globalScope.document.querySelector(options.summarySelector || "#vendor-order-summary");
            const itemsContainer = globalScope.document.querySelector(options.itemsSelector || "#vendor-order-items");
            const timelineContainer = globalScope.document.querySelector(options.timelineSelector || "#vendor-order-timeline");
            const paymentContainer = globalScope.document.querySelector(options.paymentSelector || "#vendor-order-payment");

            if (!actionContainer || !summaryContainer || !itemsContainer || !timelineContainer) {
                return {
                    success: false,
                    error: "Vendor order detail containers were not found."
                };
            }

            setStatusMessage(statusElement, "Loading order detail...", "loading");

            const currentUser = options.currentUser || await waitForAuthReady(auth, authFns);

            if (!currentUser || !normalizeText(currentUser.uid)) {
                renderEmptyState({
                    actions: actionContainer,
                    summary: summaryContainer,
                    items: itemsContainer,
                    timeline: timelineContainer,
                    payment: paymentContainer
                });
                setStatusMessage(statusElement, "Please sign in to manage this order.", "error");
                return {
                    success: false,
                    error: "Please sign in to manage this order."
                };
            }

            const vendorProfile = await fetchVendorProfile({
                ...options,
                db,
                firestoreFns,
                currentUser
            });

            if (!canAccessVendorWorkspace(vendorProfile)) {
                renderEmptyState({
                    actions: actionContainer,
                    summary: summaryContainer,
                    items: itemsContainer,
                    timeline: timelineContainer,
                    payment: paymentContainer
                });
                setStatusMessage(statusElement, "You do not have vendor access for order management.", "error");
                return {
                    success: false,
                    error: "You do not have vendor access for order management."
                };
            }

            const orderId = normalizeText(options.orderId) || getOrderIdFromLocation(options.locationObject);
            const result = await fetchOrderDetail({
                ...options,
                db,
                firestoreFns,
                orderId
            });

            if (!result.success || !result.order) {
                renderEmptyState({
                    actions: actionContainer,
                    summary: summaryContainer,
                    items: itemsContainer,
                    timeline: timelineContainer,
                    payment: paymentContainer
                });
                setStatusMessage(
                    statusElement,
                    result.error && result.error.message ? result.error.message : "Failed to load the order.",
                    "error"
                );
                return {
                    success: false,
                    error: result.error && result.error.message ? result.error.message : "Failed to load the order."
                };
            }

            if (normalizeText(result.order.vendorUid) !== normalizeText(currentUser.uid)) {
                renderEmptyState({
                    actions: actionContainer,
                    summary: summaryContainer,
                    items: itemsContainer,
                    timeline: timelineContainer,
                    payment: paymentContainer
                });
                setStatusMessage(statusElement, "You do not have permission to manage this order.", "error");
                return {
                    success: false,
                    error: "You do not have permission to manage this order."
                };
            }

            const nextOptions = {
                ...options,
                db,
                firestoreFns,
                currentUser,
                currentOrder: result.order
            };

            renderActionButtons(result.order, actionContainer, nextOptions);
            renderOrderSummary(result.order, summaryContainer, nextOptions);
            renderOrderItems(result.order, itemsContainer, nextOptions);
            renderOrderPayment(result.order, paymentContainer, nextOptions);
            renderOrderTimeline(result.order, timelineContainer, nextOptions);

            const orderFormatters = resolveOrderFormatters(options.orderFormatters);
            const summaryText = orderFormatters && typeof orderFormatters.formatOrderSummary === "function"
                ? orderFormatters.formatOrderSummary(result.order, {
                    viewerRole: "vendor",
                    includeStatus: true
                })
                : "Order detail loaded.";

            setStatusMessage(statusElement, summaryText, "success");

            lastInitOptions = nextOptions;

            return {
                success: true,
                vendorProfile,
                order: result.order
            };
        })();

        try {
            return await initInFlight;
        } finally {
            initInFlight = null;
        }
    }

    const vendorOrderDetailPage = {
        MODULE_NAME,
        normalizeText,
        normalizeLowerText,
        resolveFirestore,
        resolveAuth,
        resolveAuthFns,
        resolveFirestoreFns,
        resolveFunctions,
        resolveFunctionsFns,
        normalizeCallableResult,
        resolveRefundPaymentCallable,
        resolveOrderService,
        resolveOrderStatus,
        resolveOrderFormatters,
        resolvePaymentStatus,
        resolvePaymentFormatters,
        resolveRefundStatus,
        waitForAuthReady,
        normalizeVendorProfile,
        canAccessVendorWorkspace,
        fetchVendorProfile,
        getOrderIdFromLocation,
        fetchOrderDetail,
        setStatusMessage,
        getAllowedVendorActions,
        buildPaymentView,
        shouldRefundRejectedOrder,
        buildRefundPaymentRequest,
        refundRejectedOrder,
        getPaymentGate,
        renderOrderSummary,
        renderOrderItems,
        renderOrderPayment,
        renderOrderTimeline,
        renderActionButtons,
        renderEmptyState,
        handleOrderAction,
        init
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = vendorOrderDetailPage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.vendorOrderDetailPage = vendorOrderDetailPage;
    }
})(typeof window !== "undefined" ? window : globalThis);
