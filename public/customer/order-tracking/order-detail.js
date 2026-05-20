(function attachCustomerOrderDetailPage(globalScope) {
    "use strict";

    const MODULE_NAME = "customer/order-tracking/order-detail";
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

    function resolveOrderService(explicitOrderService) {
        if (explicitOrderService && typeof explicitOrderService.getOrderById === "function") {
            return explicitOrderService;
        }

        if (globalScope.orderService && typeof globalScope.orderService.getOrderById === "function") {
            return globalScope.orderService;
        }

        return null;
    }

    function resolveOrderCollectionService(explicitOrderService) {
        if (explicitOrderService && typeof explicitOrderService.confirmOrderCollection === "function") {
            return explicitOrderService;
        }

        if (
            globalScope.orderService &&
            typeof globalScope.orderService.confirmOrderCollection === "function"
        ) {
            return globalScope.orderService;
        }

        return null;
    }

    function resolveOrderFormatters(explicitOrderFormatters) {
        if (explicitOrderFormatters && typeof explicitOrderFormatters.formatOrderId === "function") {
            return explicitOrderFormatters;
        }

        if (globalScope.orderFormatters && typeof globalScope.orderFormatters.formatOrderId === "function") {
            return globalScope.orderFormatters;
        }

        return null;
    }

    function resolveOrderStatus(explicitOrderStatus) {
        if (explicitOrderStatus && typeof explicitOrderStatus.normalizeOrderStatus === "function") {
            return explicitOrderStatus;
        }

        if (globalScope.orderStatus && typeof globalScope.orderStatus.normalizeOrderStatus === "function") {
            return globalScope.orderStatus;
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

    function resolveCheckoutStatus(explicitCheckoutStatus) {
        if (
            explicitCheckoutStatus &&
            typeof explicitCheckoutStatus.normalizeCheckoutStatus === "function"
        ) {
            return explicitCheckoutStatus;
        }

        if (
            globalScope.checkoutStatus &&
            typeof globalScope.checkoutStatus.normalizeCheckoutStatus === "function"
        ) {
            return globalScope.checkoutStatus;
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

    function getFallbackRoutes() {
        return {
            home: "../index.html",
            tracking: "./index.html",
            notifications: "./notifications.html",
            browseVendors: "../order-management/browse-vendors.html",
            checkout: "../order-management/checkout.html",
            cart: "../order-management/cart.html",
            vendorOrderDetail: "../../vendor/order-management/order-detail.html"
        };
    }

    function buildRetryPaymentUrl(orderRecord) {
        const route = getFallbackRoutes().checkout;
        const checkoutId = normalizeText(
            orderRecord && (orderRecord.checkoutId || orderRecord.sessionId)
        );
        const vendorUid = normalizeText(orderRecord && orderRecord.vendorUid);
        const vendorName = normalizeText(orderRecord && orderRecord.vendorName);
        const params = new URLSearchParams();

        if (checkoutId) {
            params.set("checkoutId", checkoutId);
        }

        if (vendorUid) {
            params.set("vendorUid", vendorUid);
        }

        if (vendorName) {
            params.set("vendorName", vendorName);
        }

        const query = params.toString();
        return query ? `${route}?${query}` : route;
    }

    function buildVendorDetailUrl(orderId) {
        const route = getFallbackRoutes().vendorOrderDetail;
        const id = normalizeText(orderId);

        if (!id) {
            return route;
        }

        return `${route}?orderId=${encodeURIComponent(id)}`;
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
            });

            globalScope.setTimeout(function onTimeout() {
                finish(auth.currentUser || null);
            }, timeoutMs);
        });
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
                    message: "Open this page from an order link so we know which order to show."
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
                    message: "Firestore order detail access is not available right now."
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
                    message: normalizeText(error && error.message) || "Failed to load the order detail."
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
        const formattedOrderId = orderFormatters && typeof orderFormatters.formatOrderId === "function"
            ? orderFormatters.formatOrderId(orderRecord.orderId)
            : `Order #${normalizeText(orderRecord.orderId)}`;
        const statusLabel = orderFormatters && typeof orderFormatters.getOrderStatusLabel === "function"
            ? orderFormatters.getOrderStatusLabel(orderRecord.status, orderStatus)
            : normalizeText(orderRecord.status) || "Unknown Status";
        const tone = orderFormatters && typeof orderFormatters.getOrderStatusTone === "function"
            ? orderFormatters.getOrderStatusTone(orderRecord.status, orderStatus)
            : "info";
        const totalText = orderFormatters && typeof orderFormatters.formatOrderTotal === "function"
            ? orderFormatters.formatOrderTotal(orderRecord)
            : `R${Number(orderRecord.total || 0).toFixed(2)}`;
        const itemCountText = orderFormatters && typeof orderFormatters.formatItemCount === "function"
            ? orderFormatters.formatItemCount(orderRecord.itemCount || 0)
            : `${Number(orderRecord.itemCount || 0)} items`;
        const updatedText = orderFormatters && typeof orderFormatters.formatDateTime === "function"
            ? orderFormatters.formatDateTime(orderRecord.updatedAt || orderRecord.createdAt)
            : "Unknown time";
        const list = globalScope.document.createElement("ol");
        list.className = "order-summary-list";

        [
            `${formattedOrderId}`,
            `Vendor: ${normalizeText(orderRecord.vendorName) || "Unknown Vendor"}`,
            `Status: ${statusLabel}`,
            `Items: ${itemCountText}`,
            `Total: ${totalText}`,
            `Last update: ${updatedText}`
        ].forEach(function appendLine(text, index) {
            const item = globalScope.document.createElement("li");
            item.textContent = text;

            if (index === 2) {
                item.className = "order-detail-state";
                item.setAttribute("data-tone", tone);
            }

            list.appendChild(item);
        });

        container.appendChild(list);
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
        list.className = "order-items-list";

        items.forEach(function appendItem(itemRecord) {
            const item = itemRecord && typeof itemRecord === "object" ? itemRecord : {};
            const listItem = globalScope.document.createElement("li");
            const name = globalScope.document.createElement("p");
            const meta = globalScope.document.createElement("p");
            const note = globalScope.document.createElement("p");
            const subtotalText = orderFormatters && typeof orderFormatters.formatCurrency === "function"
                ? orderFormatters.formatCurrency(Number(item.subtotal || 0))
                : `R${Number(item.subtotal || 0).toFixed(2)}`;

            name.className = "order-item-name";
            name.textContent = normalizeText(item.name) || "Menu item";

            meta.className = "order-item-meta";
            meta.textContent =
                `Quantity: ${Number(item.quantity || 0)} • Price: ${orderFormatters && typeof orderFormatters.formatCurrency === "function"
                    ? orderFormatters.formatCurrency(Number(item.price || 0))
                    : `R${Number(item.price || 0).toFixed(2)}`} • Subtotal: ${subtotalText}`;

            listItem.appendChild(name);
            listItem.appendChild(meta);

            if (normalizeText(item.notes)) {
                note.className = "order-item-meta";
                note.textContent = `Notes: ${normalizeText(item.notes)}`;
                listItem.appendChild(note);
            }

            list.appendChild(listItem);
        });

        container.appendChild(list);
    }

    function getPaymentDateValue(rawValue) {
        if (!rawValue) {
            return null;
        }

        if (typeof rawValue.toDate === "function") {
            try {
                return rawValue.toDate();
            } catch (error) {
                return null;
            }
        }

        if (rawValue instanceof Date) {
            return rawValue;
        }

        if (typeof rawValue === "string" || typeof rawValue === "number") {
            const parsed = new Date(rawValue);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        return null;
    }

    function formatPaymentDate(rawValue, options = {}) {
        const orderFormatters = resolveOrderFormatters(options.orderFormatters);

        if (orderFormatters && typeof orderFormatters.formatDateTime === "function") {
            const formatted = normalizeText(orderFormatters.formatDateTime(rawValue));

            if (formatted) {
                return formatted;
            }
        }

        const date = getPaymentDateValue(rawValue);

        if (!date) {
            return "";
        }

        try {
            return date.toLocaleString();
        } catch (error) {
            return date.toISOString();
        }
    }

    function normalizeOrderPaymentStatus(orderRecord, options = {}) {
        const safeOrder = orderRecord && typeof orderRecord === "object" ? orderRecord : {};
        const paymentStatus = resolvePaymentStatus(options.paymentStatus);
        const rawPaymentStatus = normalizeText(safeOrder.paymentStatus);

        if (paymentStatus && typeof paymentStatus.normalizePaymentStatus === "function") {
            return paymentStatus.normalizePaymentStatus(rawPaymentStatus, "unpaid");
        }

        return rawPaymentStatus.toLowerCase() || "unpaid";
    }

    function isOrderPaymentPaid(orderRecord, options = {}) {
        const status = normalizeOrderPaymentStatus(orderRecord, options);
        const paymentStatus = resolvePaymentStatus(options.paymentStatus);

        if (paymentStatus && typeof paymentStatus.isPaymentPaid === "function") {
            return paymentStatus.isPaymentPaid(status);
        }

        return status === "paid";
    }

    function isOrderPaymentResumable(orderRecord, options = {}) {
        const status = normalizeOrderPaymentStatus(orderRecord, options);
        const paymentStatus = resolvePaymentStatus(options.paymentStatus);

        if (paymentStatus && typeof paymentStatus.isPaymentPaid === "function" && paymentStatus.isPaymentPaid(status)) {
            return false;
        }

        if (paymentStatus && typeof paymentStatus.isPaymentPending === "function" && paymentStatus.isPaymentPending(status)) {
            return true;
        }

        if (paymentStatus && typeof paymentStatus.isPaymentRetryable === "function") {
            return paymentStatus.isPaymentRetryable(status);
        }

        return status === "unpaid" || status === "pending" || status === "failed";
    }

    function getPaymentActionLabel(status, paymentStatus) {
        const normalizedStatus = normalizeLowerText(status);

        if (normalizedStatus === "pending") {
            return "Resume Payment";
        }

        if (normalizedStatus === "failed") {
            return "Retry Payment";
        }

        if (paymentStatus && typeof paymentStatus.getPaymentStatusActionLabel === "function") {
            const label = normalizeText(paymentStatus.getPaymentStatusActionLabel(normalizedStatus));

            if (label && label !== "Start Payment") {
                return label;
            }
        }

        return "Pay Now";
    }

    function buildPaymentView(orderRecord, options = {}) {
        const safeOrder = orderRecord && typeof orderRecord === "object" ? orderRecord : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const paymentStatus = resolvePaymentStatus(safeOptions.paymentStatus);
        const checkoutStatus = resolveCheckoutStatus(safeOptions.checkoutStatus);
        const refundStatus = resolveRefundStatus(safeOptions.refundStatus);
        const paymentFormatters = resolvePaymentFormatters(safeOptions.paymentFormatters);
        const normalizedPaymentStatus = normalizeOrderPaymentStatus(safeOrder, safeOptions);
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
        const reference = normalizeText(safeOrder.paymentReference);
        const checkoutId = normalizeText(safeOrder.checkoutId || safeOrder.sessionId);
        const rawCheckoutStatus = normalizeText(safeOrder.checkoutStatus || safeOrder.checkoutSessionStatus);
        const normalizedCheckoutStatus =
            checkoutStatus && typeof checkoutStatus.normalizeCheckoutStatus === "function"
                ? checkoutStatus.normalizeCheckoutStatus(rawCheckoutStatus, "")
                : rawCheckoutStatus.toLowerCase();
        const checkoutStatusLabel =
            normalizedCheckoutStatus && checkoutStatus && typeof checkoutStatus.getCheckoutStatusLabel === "function"
                ? checkoutStatus.getCheckoutStatusLabel(normalizedCheckoutStatus)
                : normalizedCheckoutStatus;
        const paidAtText = safeOrder.paymentPaidAt || safeOrder.paymentVerifiedAt
            ? formatPaymentDate(safeOrder.paymentPaidAt || safeOrder.paymentVerifiedAt, safeOptions)
            : "";
        const failedAtText = safeOrder.paymentFailedAt
            ? formatPaymentDate(safeOrder.paymentFailedAt, safeOptions)
            : "";
        const failureReason = normalizeText(safeOrder.paymentFailureReason);
        const rawRefundStatus = normalizeText(safeOrder.refundStatus || safeOrder.paymentRefundStatus);
        const defaultRefundStatus = refundStatus && typeof refundStatus.getDefaultRefundStatus === "function"
            ? refundStatus.getDefaultRefundStatus()
            : "not_requested";
        const normalizedRefundStatus =
            refundStatus && typeof refundStatus.normalizeRefundStatus === "function"
                ? refundStatus.normalizeRefundStatus(rawRefundStatus, defaultRefundStatus)
                : (rawRefundStatus.toLowerCase() || defaultRefundStatus);
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
            : amount;
        const refundAmountText =
            paymentFormatters && typeof paymentFormatters.formatPaymentAmount === "function"
                ? paymentFormatters.formatPaymentAmount(refundAmount, currency)
                : (currency === "ZAR"
                    ? `R${refundAmount.toFixed(2)}`
                    : `${currency} ${refundAmount.toFixed(2)}`);
        const refundReference = normalizeText(safeOrder.refundReference || safeOrder.paymentRefundReference);
        const refundReason = normalizeText(safeOrder.refundReason || safeOrder.paymentRefundReason);
        const refundedAtText = safeOrder.refundedAt || safeOrder.paymentRefundedAt || safeOrder.refundProcessedAt
            ? formatPaymentDate(
                safeOrder.refundedAt || safeOrder.paymentRefundedAt || safeOrder.refundProcessedAt,
                safeOptions
            )
            : "";
        const isRejected = normalizeLowerText(safeOrder.status) === "rejected";
        const isPaid =
            paymentStatus && typeof paymentStatus.isPaymentPaid === "function"
                ? paymentStatus.isPaymentPaid(normalizedPaymentStatus)
                : normalizedPaymentStatus === "paid";
        const refundIsVisible = normalizedRefundStatus !== defaultRefundStatus || (isRejected && isPaid);
        const refundIsComplete =
            refundStatus && typeof refundStatus.isRefunded === "function"
                ? refundStatus.isRefunded(normalizedRefundStatus)
                : normalizedRefundStatus === "refunded";
        const refundIsActive =
            refundStatus && typeof refundStatus.isActiveRefundStatus === "function"
                ? refundStatus.isActiveRefundStatus(normalizedRefundStatus)
                : normalizedRefundStatus === "requested" || normalizedRefundStatus === "processing";
        const refundIsFailed =
            refundStatus && typeof refundStatus.isRefundFailed === "function"
                ? refundStatus.isRefundFailed(normalizedRefundStatus)
                : normalizedRefundStatus === "failed";
        let refundNotice = "";

        if (refundIsComplete) {
            refundNotice = "Your payment was returned because the vendor rejected this order. A refund notification and email confirmation were sent for this test payment.";
        } else if (refundIsActive) {
            refundNotice = "Your refund has been started because the vendor rejected this order. A refund notification and email confirmation will be sent once it is marked refunded.";
        } else if (refundIsFailed) {
            refundNotice = "The refund could not be completed. Please contact support so this paid rejected order can be settled.";
        } else if (refundIsVisible) {
            refundNotice = "This paid rejected order still needs a refund before it is settled.";
        }

        const canRetry = isOrderPaymentResumable(safeOrder, safeOptions);
        const actionLabel = canRetry ? getPaymentActionLabel(normalizedPaymentStatus, paymentStatus) : "";

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
            reference,
            checkoutId,
            checkoutStatus: normalizedCheckoutStatus,
            checkoutStatusLabel,
            paidAtText,
            failedAtText,
            failureReason,
            refundStatus: normalizedRefundStatus,
            refundStatusLabel,
            refundTone,
            refundAmount,
            refundAmountText,
            refundReference,
            refundReason,
            refundedAtText,
            refundIsVisible,
            refundNotice,
            canRetry,
            actionLabel,
            guardMessage: canRetry
                ? "Complete payment before this order can move through vendor fulfilment."
                : "",
            retryUrl: canRetry ? buildRetryPaymentUrl(safeOrder) : ""
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
        statusLine.className = "order-detail-payment-status";
        statusLine.textContent = `Status: ${view.statusLabel}`;
        statusLine.setAttribute("data-tone", view.tone);
        statusLine.setAttribute("data-payment-status", view.status);
        container.appendChild(statusLine);

        if (view.description) {
            container.appendChild(createParagraph(view.description, "order-detail-payment-description"));
        }

        const list = doc.createElement("ul");
        list.className = "order-detail-payment-list";

        function appendDetail(label, value, className) {
            const safeValue = normalizeText(value);

            if (!safeValue) {
                return;
            }

            const item = doc.createElement("li");
            item.className = className || "order-detail-payment-item";
            item.textContent = `${label}: ${safeValue}`;
            list.appendChild(item);
        }

        appendDetail("Amount", view.amountText, "order-detail-payment-amount");
        appendDetail("Provider", view.providerLabel, "order-detail-payment-provider");
        appendDetail("Reference", view.reference, "order-detail-payment-reference");
        appendDetail("Checkout ID", view.checkoutId, "order-detail-payment-checkout-id");
        appendDetail("Checkout status", view.checkoutStatusLabel, "order-detail-payment-checkout-status");
        appendDetail("Paid at", view.paidAtText, "order-detail-payment-paid-at");
        appendDetail("Failed at", view.failedAtText, "order-detail-payment-failed-at");
        appendDetail("Failure reason", view.failureReason, "order-detail-payment-failure-reason");

        if (view.refundIsVisible) {
            appendDetail("Refund status", view.refundStatusLabel, "order-detail-refund-status");
            appendDetail("Refund amount", view.refundAmountText, "order-detail-refund-amount");
            appendDetail("Refund reference", view.refundReference, "order-detail-refund-reference");
            appendDetail("Refund reason", view.refundReason, "order-detail-refund-reason");
            appendDetail("Refunded at", view.refundedAtText, "order-detail-refunded-at");
        }

        container.appendChild(list);

        const refundStatusLine = container.querySelector(".order-detail-refund-status");
        if (refundStatusLine) {
            refundStatusLine.setAttribute("data-tone", view.refundTone);
            refundStatusLine.setAttribute("data-refund-status", view.refundStatus);
        }

        if (view.refundNotice) {
            const refundNotice = createParagraph(view.refundNotice, "order-detail-refund-notice");
            refundNotice.setAttribute("data-tone", view.refundTone);
            container.appendChild(refundNotice);
        }

        if (view.guardMessage) {
            container.appendChild(createParagraph(view.guardMessage, "order-detail-payment-guard"));
        }

        if (view.canRetry && view.retryUrl) {
            const menu = doc.createElement("menu");
            menu.className = "action-menu order-detail-payment-actions";
            menu.setAttribute("aria-label", "Payment actions");

            const item = doc.createElement("li");
            const link = doc.createElement("a");
            link.href = view.retryUrl;
            link.className = "button-primary";
            link.textContent = view.actionLabel;

            item.appendChild(link);
            menu.appendChild(item);
            container.appendChild(menu);
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
        const trackingSteps = orderFormatters && typeof orderFormatters.buildTrackingSteps === "function"
            ? orderFormatters.buildTrackingSteps(orderRecord, { orderStatus })
            : [];

        if (timeline.length === 0 && trackingSteps.length === 0) {
            container.appendChild(createParagraph("No timeline has been recorded for this order yet.", "empty-state-message"));
            return;
        }

        if (trackingSteps.length > 0) {
            const progressHeading = globalScope.document.createElement("p");
            progressHeading.className = "order-detail-caption";
            progressHeading.textContent = "Progress";
            container.appendChild(progressHeading);

            const progressList = globalScope.document.createElement("ol");
            progressList.className = "order-timeline-list";

            trackingSteps.forEach(function appendStep(step) {
                const listItem = globalScope.document.createElement("li");
                const state = globalScope.document.createElement("p");
                const meta = globalScope.document.createElement("p");

                state.className = "order-timeline-label";
                state.textContent = `${step.label}`;

                meta.className = "order-timeline-meta";
                meta.textContent = step.description;
                meta.setAttribute("data-tone", step.tone || "info");

                listItem.appendChild(state);
                listItem.appendChild(meta);
                progressList.appendChild(listItem);
            });

            container.appendChild(progressList);
        }

        if (timeline.length > 0) {
            const historyHeading = globalScope.document.createElement("p");
            historyHeading.className = "order-detail-caption";
            historyHeading.textContent = "Recorded Updates";
            container.appendChild(historyHeading);

            const historyList = globalScope.document.createElement("ol");
            historyList.className = "order-timeline-list";

            timeline.forEach(function appendEntry(entry) {
                const listItem = globalScope.document.createElement("li");
                const label = globalScope.document.createElement("p");
                const meta = globalScope.document.createElement("p");

                label.className = "order-timeline-label";
                label.textContent = entry.label;

                meta.className = "order-timeline-meta";
                meta.textContent = `${entry.actorLabel} • ${entry.timestampText}`;
                meta.setAttribute("data-tone", entry.tone || "info");

                listItem.appendChild(label);
                listItem.appendChild(meta);

                if (normalizeText(entry.note)) {
                    listItem.appendChild(createParagraph(entry.note, "order-timeline-note"));
                }

                historyList.appendChild(listItem);
            });

            container.appendChild(historyList);
        }
    }

    function renderEmptyState(containers) {
        const safeContainers = containers && typeof containers === "object" ? containers : {};

        if (safeContainers.summary) {
            safeContainers.summary.innerHTML = "";
            safeContainers.summary.appendChild(createParagraph("No order summary available.", "empty-state-message"));
        }

        if (safeContainers.items) {
            safeContainers.items.innerHTML = "";
            safeContainers.items.appendChild(createParagraph("No items available.", "empty-state-message"));
        }

        if (safeContainers.timeline) {
            safeContainers.timeline.innerHTML = "";
            safeContainers.timeline.appendChild(createParagraph("No timeline available.", "empty-state-message"));
        }

        if (safeContainers.payment) {
            safeContainers.payment.innerHTML = "";
            safeContainers.payment.appendChild(createParagraph("No payment details available.", "empty-state-message"));
        }

        if (safeContainers.actions) {
            safeContainers.actions.innerHTML = "";
        }
    }

    function getCustomerCollectionAction(orderRecord, options = {}) {
        const orderStatus = resolveOrderStatus(options.orderStatus);
        const status = normalizeLowerText(orderRecord && orderRecord.status);
        const readyStatus = orderStatus && orderStatus.ORDER_STATUSES
            ? orderStatus.ORDER_STATUSES.READY
            : "ready";

        if (status !== readyStatus) {
            return null;
        }

        if (!isOrderPaymentPaid(orderRecord, options)) {
            return null;
        }

        if (orderRecord && orderRecord.customerConfirmedCollected === true) {
            return null;
        }

        // The confirm-collection button is only meaningful for the customer who
        // placed the order. If we can tell who's signed in and they're not the
        // customer (e.g. they're the vendor or an admin browsing), suppress it.
        const currentUser = options.currentUser && typeof options.currentUser === "object"
            ? options.currentUser
            : null;
        const orderCustomerUid = normalizeText(orderRecord && orderRecord.customerUid);
        const viewerUid = normalizeText(currentUser && currentUser.uid);

        if (orderCustomerUid && viewerUid && orderCustomerUid !== viewerUid) {
            return null;
        }

        return {
            type: "confirm_collection",
            label: "Confirm I Received This Order",
            tone: "success"
        };
    }

    function renderActionButtons(orderRecord, container, options = {}) {
        if (!container) {
            return;
        }

        container.innerHTML = "";

        const action = getCustomerCollectionAction(orderRecord, options);

        if (!action) {
            if (orderRecord && !isOrderPaymentPaid(orderRecord, options)) {
                container.appendChild(createParagraph(
                    "Complete payment before customer order actions become available.",
                    "empty-state-message"
                ));
                return;
            }

            if (
                orderRecord &&
                normalizeLowerText(orderRecord.status) === "ready" &&
                orderRecord.customerConfirmedCollected === true &&
                orderRecord.vendorConfirmedCollected !== true
            ) {
                container.appendChild(createParagraph(
                    "Thanks — we have logged your collection. Waiting for the vendor to confirm.",
                    "empty-state-message"
                ));
            }
            return;
        }

        const intro = createParagraph(
            "Once you have collected your order, confirm here so the vendor can close the ticket.",
            "order-detail-caption"
        );
        container.appendChild(intro);

        const menu = globalScope.document.createElement("menu");
        menu.className = "action-menu";
        menu.setAttribute("aria-label", "Customer order actions");

        const item = globalScope.document.createElement("li");
        const button = globalScope.document.createElement("button");

        button.type = "button";
        button.className = "button-primary";
        button.textContent = action.label;
        button.dataset.actionType = action.type;
        button.dataset.tone = action.tone;
        button.addEventListener("click", function onClick() {
            return handleConfirmCollection(action, options);
        });

        item.appendChild(button);
        menu.appendChild(item);
        container.appendChild(menu);
    }

    async function handleConfirmCollection(action, options = {}) {
        const orderService = resolveOrderCollectionService(options.orderService);
        const statusElement = globalScope.document.querySelector(
            options.statusSelector || "#order-tracking-detail-status"
        );
        const currentOrder = options.currentOrder && typeof options.currentOrder === "object"
            ? options.currentOrder
            : null;
        const currentUser = options.currentUser && typeof options.currentUser === "object"
            ? options.currentUser
            : null;

        if (!orderService || !currentOrder) {
            setStatusMessage(statusElement, "Confirming collection is not available right now.", "error");
            return {
                success: false,
                error: "Confirming collection is not available right now."
            };
        }

        setStatusMessage(statusElement, "Confirming you received this order...", "loading");

        const result = await orderService.confirmOrderCollection({
            db: options.db || resolveFirestore(),
            firestoreFns: resolveFirestoreFns(options.firestoreFns),
            order: currentOrder,
            actorRole: "customer",
            actorUid: normalizeText(currentUser && currentUser.uid),
            actorName: normalizeText(currentUser && currentUser.displayName) || "Customer"
        });

        if (!result || result.success !== true) {
            setStatusMessage(
                statusElement,
                result && result.error && result.error.message
                    ? result.error.message
                    : "Failed to confirm collection.",
                "error"
            );
            return {
                success: false,
                error: result && result.error ? result.error.message : "Failed to confirm collection."
            };
        }

        setStatusMessage(statusElement, "Thanks for confirming you received your order.", "success");

        if (lastInitOptions) {
            await init({
                ...lastInitOptions,
                currentUser,
                orderId: currentOrder.orderId
            });
        }

        return {
            success: true,
            order: result.order
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
            const statusElement = globalScope.document.querySelector(
                options.statusSelector || "#order-tracking-detail-status"
            );
            const summaryContainer = globalScope.document.querySelector(
                options.summarySelector || "#order-detail-summary"
            );
            const itemsContainer = globalScope.document.querySelector(
                options.itemsSelector || "#order-detail-items"
            );
            const timelineContainer = globalScope.document.querySelector(
                options.timelineSelector || "#order-detail-timeline"
            );
            const paymentContainer = globalScope.document.querySelector(
                options.paymentSelector || "#order-detail-payment"
            );
            const actionContainer = globalScope.document.querySelector(
                options.actionSelector || "#order-detail-actions"
            );

            if (!summaryContainer || !itemsContainer || !timelineContainer) {
                return {
                    success: false,
                    error: "Order detail containers were not found."
                };
            }

            setStatusMessage(statusElement, "Loading your order detail...", "loading");

            const currentUser = options.currentUser || await waitForAuthReady(auth, authFns);

            if (!currentUser || !normalizeText(currentUser.uid)) {
                renderEmptyState({
                    summary: summaryContainer,
                    items: itemsContainer,
                    timeline: timelineContainer,
                    payment: paymentContainer,
                    actions: actionContainer
                });
                setStatusMessage(statusElement, "Please sign in to view order details.", "error");
                return {
                    success: false,
                    error: "Please sign in to view order details."
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
                    summary: summaryContainer,
                    items: itemsContainer,
                    timeline: timelineContainer,
                    payment: paymentContainer,
                    actions: actionContainer
                });
                setStatusMessage(
                    statusElement,
                    result.error && result.error.message
                        ? result.error.message
                        : "Failed to load order detail.",
                    "error"
                );
                return {
                    success: false,
                    error: result.error && result.error.message
                        ? result.error.message
                        : "Failed to load order detail."
                };
            }

            const nextOptions = {
                ...options,
                db,
                firestoreFns,
                currentUser,
                currentOrder: result.order
            };

            renderOrderSummary(result.order, summaryContainer, nextOptions);
            renderOrderItems(result.order, itemsContainer, nextOptions);
            renderOrderTimeline(result.order, timelineContainer, nextOptions);
            renderOrderPayment(result.order, paymentContainer, nextOptions);
            renderActionButtons(result.order, actionContainer, nextOptions);

            const orderFormatters = resolveOrderFormatters(options.orderFormatters);
            const headline = orderFormatters && typeof orderFormatters.formatOrderSummary === "function"
                ? orderFormatters.formatOrderSummary(result.order, {
                    viewerRole: "customer",
                    includeStatus: true
                })
                : "Order loaded.";

            setStatusMessage(statusElement, headline, "success");

            lastInitOptions = nextOptions;

            return {
                success: true,
                order: result.order
            };
        })();

        try {
            return await initInFlight;
        } finally {
            initInFlight = null;
        }
    }

    const customerOrderDetailPage = {
        MODULE_NAME,
        normalizeText,
        normalizeLowerText,
        resolveFirestore,
        resolveAuth,
        resolveAuthFns,
        resolveFirestoreFns,
        resolveOrderService,
        resolveOrderCollectionService,
        resolveOrderFormatters,
        resolveOrderStatus,
        resolvePaymentStatus,
        resolvePaymentFormatters,
        resolveCheckoutStatus,
        resolveRefundStatus,
        getFallbackRoutes,
        buildVendorDetailUrl,
        buildRetryPaymentUrl,
        waitForAuthReady,
        getOrderIdFromLocation,
        fetchOrderDetail,
        setStatusMessage,
        renderOrderSummary,
        renderOrderItems,
        renderOrderTimeline,
        getPaymentDateValue,
        formatPaymentDate,
        normalizeOrderPaymentStatus,
        isOrderPaymentPaid,
        isOrderPaymentResumable,
        getPaymentActionLabel,
        buildPaymentView,
        renderOrderPayment,
        renderEmptyState,
        getCustomerCollectionAction,
        renderActionButtons,
        handleConfirmCollection,
        init
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerOrderDetailPage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.customerOrderDetailPage = customerOrderDetailPage;
    }
})(typeof window !== "undefined" ? window : globalThis);
