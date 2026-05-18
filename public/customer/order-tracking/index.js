(function attachCustomerOrderTrackingPage(globalScope) {
    "use strict";

    const MODULE_NAME = "customer/order-tracking/index";
    const DEFAULT_PAGE_SIZE = 6;
    const DEFAULT_SORT = "newest";
    let initInFlight = null;
    const pageState = {
        allOrders: [],
        allCheckouts: [],
        filters: {
            search: "",
            status: "all",
            payment: "all",
            sort: DEFAULT_SORT
        },
        currentPage: 1,
        pageSize: DEFAULT_PAGE_SIZE
    };

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
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
        if (explicitOrderService && typeof explicitOrderService.getCustomerOrders === "function") {
            return explicitOrderService;
        }

        if (globalScope.orderService && typeof globalScope.orderService.getCustomerOrders === "function") {
            return globalScope.orderService;
        }

        return null;
    }

    function resolveOrderStatus(explicitOrderStatus) {
        if (explicitOrderStatus && typeof explicitOrderStatus.getOrderStatusLabel === "function") {
            return explicitOrderStatus;
        }

        if (globalScope.orderStatus && typeof globalScope.orderStatus.getOrderStatusLabel === "function") {
            return globalScope.orderStatus;
        }

        return null;
    }

    function resolveOrderFormatters(explicitOrderFormatters) {
        if (explicitOrderFormatters && typeof explicitOrderFormatters.formatCurrency === "function") {
            return explicitOrderFormatters;
        }

        if (globalScope.orderFormatters && typeof globalScope.orderFormatters.formatCurrency === "function") {
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

    function resolveCheckoutQueries(explicitCheckoutQueries) {
        if (explicitCheckoutQueries && typeof explicitCheckoutQueries.fetchCustomerCheckouts === "function") {
            return explicitCheckoutQueries;
        }

        if (explicitCheckoutQueries !== undefined) {
            return null;
        }

        if (globalScope.checkoutQueries && typeof globalScope.checkoutQueries.fetchCustomerCheckouts === "function") {
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

    function resolveCheckoutStatus(explicitCheckoutStatus) {
        if (explicitCheckoutStatus && typeof explicitCheckoutStatus.getCheckoutStatusLabel === "function") {
            return explicitCheckoutStatus;
        }

        if (explicitCheckoutStatus !== undefined) {
            return null;
        }

        if (globalScope.checkoutStatus && typeof globalScope.checkoutStatus.getCheckoutStatusLabel === "function") {
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

    function getFallbackRoutes() {
        return {
            home: "../index.html",
            notifications: "./notifications.html",
            browseVendors: "../order-management/browse-vendors.html",
            checkout: "../order-management/checkout.html",
            detail: "./order-detail.html"
        };
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

    function mapOrderRecord(orderRecord, options = {}) {
        const safeOrder = orderRecord && typeof orderRecord === "object" ? orderRecord : {};
        const orderStatus = resolveOrderStatus(options.orderStatus);
        const orderFormatters = resolveOrderFormatters(options.orderFormatters);
        const paymentStatus = resolvePaymentStatus(options.paymentStatus);
        const paymentFormatters = resolvePaymentFormatters(options.paymentFormatters);
        const normalizedStatus =
            orderStatus && typeof orderStatus.normalizeOrderStatus === "function"
                ? orderStatus.normalizeOrderStatus(safeOrder.status, "pending")
                : normalizeText(safeOrder.status).toLowerCase() || "pending";
        const statusLabel =
            orderStatus && typeof orderStatus.getOrderStatusLabel === "function"
                ? orderStatus.getOrderStatusLabel(normalizedStatus)
                : normalizedStatus;
        const tone =
            orderStatus && typeof orderStatus.getOrderStatusTone === "function"
                ? orderStatus.getOrderStatusTone(normalizedStatus)
                : "info";
        const totalText =
            orderFormatters && typeof orderFormatters.formatCurrency === "function"
                ? orderFormatters.formatCurrency(safeOrder.total || 0)
                : `R${Number(safeOrder.total || 0).toFixed(2)}`;

        const rawPaymentStatus = normalizeText(safeOrder.paymentStatus);
        const normalizedPaymentStatus =
            paymentStatus && typeof paymentStatus.normalizePaymentStatus === "function"
                ? paymentStatus.normalizePaymentStatus(rawPaymentStatus, "unpaid")
                : rawPaymentStatus.toLowerCase() || "unpaid";
        const paymentStatusLabel =
            paymentStatus && typeof paymentStatus.getPaymentStatusLabel === "function"
                ? paymentStatus.getPaymentStatusLabel(normalizedPaymentStatus)
                : normalizedPaymentStatus;
        const paymentTone =
            paymentStatus && typeof paymentStatus.getPaymentStatusTone === "function"
                ? paymentStatus.getPaymentStatusTone(normalizedPaymentStatus)
                : "neutral";
        const paymentCurrency = normalizeText(safeOrder.paymentCurrency) || "ZAR";
        const paymentAmount = Number.isFinite(Number(safeOrder.paymentAmount))
            ? Number(safeOrder.paymentAmount)
            : Number(safeOrder.total) || 0;
        const paymentAmountText =
            paymentFormatters && typeof paymentFormatters.formatPaymentAmount === "function"
                ? paymentFormatters.formatPaymentAmount(paymentAmount, paymentCurrency)
                : (paymentCurrency === "ZAR"
                    ? `R${paymentAmount.toFixed(2)}`
                    : `${paymentCurrency} ${paymentAmount.toFixed(2)}`);

        return {
            orderId: normalizeText(safeOrder.orderId || safeOrder.id),
            vendorUid: normalizeText(safeOrder.vendorUid),
            vendorName: normalizeText(safeOrder.vendorName) || "Unknown Vendor",
            itemCount: Number.isFinite(Number(safeOrder.itemCount)) ? Number(safeOrder.itemCount) : 0,
            total: Number.isFinite(Number(safeOrder.total)) ? Number(safeOrder.total) : 0,
            totalText,
            status: normalizedStatus,
            statusLabel,
            tone,
            paymentStatus: normalizedPaymentStatus,
            paymentStatusLabel,
            paymentTone,
            paymentAmount,
            paymentAmountText,
            paymentCurrency,
            paymentReference: normalizeText(safeOrder.paymentReference),
            paymentProvider: normalizeText(safeOrder.paymentProvider) || "paystack",
            updatedAt: safeOrder.updatedAt || safeOrder.createdAt || null
        };
    }

    function getDefaultResumableCheckoutStatuses(options = {}) {
        const checkoutStatus = resolveCheckoutStatus(options.checkoutStatus);

        if (checkoutStatus && typeof checkoutStatus.getResumableCheckoutStatusList === "function") {
            return checkoutStatus.getResumableCheckoutStatusList();
        }

        return ["draft", "payment_pending", "payment_failed"];
    }

    function mapCheckoutRecord(checkoutRecord, options = {}) {
        const safeCheckout = checkoutRecord && typeof checkoutRecord === "object" ? checkoutRecord : {};
        const checkoutStatus = resolveCheckoutStatus(options.checkoutStatus);
        const orderFormatters = resolveOrderFormatters(options.orderFormatters);
        const paymentFormatters = resolvePaymentFormatters(options.paymentFormatters);
        const rawStatus = normalizeText(safeCheckout.status);
        const normalizedStatus =
            checkoutStatus && typeof checkoutStatus.normalizeCheckoutStatus === "function"
                ? checkoutStatus.normalizeCheckoutStatus(rawStatus, "draft")
                : rawStatus.toLowerCase() || "draft";
        const statusLabel =
            checkoutStatus && typeof checkoutStatus.getCheckoutStatusLabel === "function"
                ? checkoutStatus.getCheckoutStatusLabel(normalizedStatus)
                : normalizedStatus;
        const tone =
            checkoutStatus && typeof checkoutStatus.getCheckoutStatusTone === "function"
                ? checkoutStatus.getCheckoutStatusTone(normalizedStatus)
                : "info";
        const actionLabel =
            checkoutStatus && typeof checkoutStatus.getCheckoutStatusActionLabel === "function"
                ? checkoutStatus.getCheckoutStatusActionLabel(normalizedStatus)
                : "Resume Payment";
        const total = Number.isFinite(Number(safeCheckout.total)) ? Number(safeCheckout.total) : 0;
        const totalText =
            orderFormatters && typeof orderFormatters.formatCurrency === "function"
                ? orderFormatters.formatCurrency(total)
                : `R${total.toFixed(2)}`;
        const paymentCurrency = normalizeText(safeCheckout.paymentCurrency) || "ZAR";
        const paymentAmount = Number.isFinite(Number(safeCheckout.paymentAmount))
            ? Number(safeCheckout.paymentAmount)
            : total;
        const paymentAmountText =
            paymentFormatters && typeof paymentFormatters.formatPaymentAmount === "function"
                ? paymentFormatters.formatPaymentAmount(paymentAmount, paymentCurrency)
                : (paymentCurrency === "ZAR"
                    ? `R${paymentAmount.toFixed(2)}`
                    : `${paymentCurrency} ${paymentAmount.toFixed(2)}`);

        return {
            checkoutId: normalizeText(safeCheckout.checkoutId || safeCheckout.id),
            vendorUid: normalizeText(safeCheckout.vendorUid),
            vendorName: normalizeText(safeCheckout.vendorName) || "Unknown Vendor",
            itemCount: Number.isFinite(Number(safeCheckout.itemCount)) ? Number(safeCheckout.itemCount) : 0,
            total,
            totalText,
            status: normalizedStatus,
            statusLabel,
            tone,
            actionLabel,
            paymentAmount,
            paymentAmountText,
            paymentCurrency,
            paymentReference: normalizeText(safeCheckout.paymentReference),
            updatedAt: safeCheckout.updatedAt || safeCheckout.createdAt || null
        };
    }

    async function fetchCustomerOrders(options = {}) {
        const db = options.db || resolveFirestore();
        const firestoreFns = resolveFirestoreFns(options.firestoreFns);
        const orderService = resolveOrderService(options.orderService);
        const customerUid = normalizeText(options.customerUid);

        if (!customerUid) {
            return {
                success: false,
                orders: [],
                error: {
                    code: "no-customer-uid",
                    message: "A signed-in customer is required."
                }
            };
        }

        if (orderService && typeof orderService.getCustomerOrders === "function" && db) {
            try {
                const orders = await orderService.getCustomerOrders({
                    db,
                    firestoreFns,
                    customerUid
                });

                return {
                    success: true,
                    orders: Array.isArray(orders) ? orders : []
                };
            } catch (error) {
                console.error(`${MODULE_NAME}: Error fetching orders via service:`, error);
            }
        }

        if (
            !db ||
            typeof firestoreFns.collection !== "function" ||
            typeof firestoreFns.getDocs !== "function"
        ) {
            return {
                success: false,
                orders: [],
                error: {
                    code: "no-firestore",
                    message: "Firestore order access is not available right now."
                }
            };
        }

        try {
            const ordersCollection = firestoreFns.collection(db, "orders");
            const ordersQuery =
                typeof firestoreFns.query === "function" &&
                typeof firestoreFns.where === "function"
                    ? firestoreFns.query(
                        ordersCollection,
                        firestoreFns.where("customerUid", "==", customerUid)
                    )
                    : ordersCollection;
            const snapshot = await firestoreFns.getDocs(ordersQuery);
            const orders = [];
            const iterate = typeof snapshot?.forEach === "function"
                ? snapshot.forEach.bind(snapshot)
                : function iterateDocs(callback) {
                    const docs = Array.isArray(snapshot?.docs) ? snapshot.docs : [];
                    docs.forEach(callback);
                };

            iterate(function onEachOrder(docSnapshot) {
                const data = typeof docSnapshot.data === "function" ? (docSnapshot.data() || {}) : {};
                orders.push({
                    orderId: normalizeText(docSnapshot.id) || normalizeText(data.orderId),
                    ...data
                });
            });

            return {
                success: true,
                orders
            };
        } catch (error) {
            return {
                success: false,
                orders: [],
                error: {
                    code: normalizeText(error && error.code) || "fetch-error",
                    message: normalizeText(error && error.message) || "Failed to load customer orders."
                }
            };
        }
    }

    async function fetchCustomerCheckouts(options = {}) {
        const db = options.db || resolveFirestore();
        const firestoreFns = resolveFirestoreFns(options.firestoreFns);
        const checkoutQueries = resolveCheckoutQueries(options.checkoutQueries);
        const checkoutStatus = resolveCheckoutStatus(options.checkoutStatus);
        const customerUid = normalizeText(options.customerUid);
        const statuses = Array.isArray(options.checkoutStatuses)
            ? options.checkoutStatuses
            : getDefaultResumableCheckoutStatuses({ checkoutStatus });

        if (!customerUid) {
            return {
                success: false,
                checkouts: [],
                error: {
                    code: "no-customer-uid",
                    message: "A signed-in customer is required."
                }
            };
        }

        if (checkoutQueries && typeof checkoutQueries.fetchCustomerCheckouts === "function" && db) {
            try {
                const checkouts = await checkoutQueries.fetchCustomerCheckouts({
                    db,
                    firestoreFns,
                    customerUid,
                    statuses,
                    checkoutStatus
                });

                return {
                    success: true,
                    checkouts: Array.isArray(checkouts) ? checkouts : []
                };
            } catch (error) {
                console.error(`${MODULE_NAME}: Error fetching checkout sessions via query helper:`, error);
            }
        }

        if (
            !db ||
            typeof firestoreFns.collection !== "function" ||
            typeof firestoreFns.getDocs !== "function"
        ) {
            return {
                success: true,
                checkouts: []
            };
        }

        try {
            const checkoutsCollection = firestoreFns.collection(db, "checkoutSessions");
            const constraints = [];

            if (typeof firestoreFns.where === "function") {
                constraints.push(firestoreFns.where("customerUid", "==", customerUid));

                if (statuses.length === 1) {
                    constraints.push(firestoreFns.where("status", "==", statuses[0]));
                } else if (statuses.length > 1) {
                    constraints.push(firestoreFns.where("status", "in", statuses));
                }
            }

            const checkoutsQuery =
                typeof firestoreFns.query === "function" && constraints.length > 0
                    ? firestoreFns.query(checkoutsCollection, ...constraints)
                    : checkoutsCollection;
            const snapshot = await firestoreFns.getDocs(checkoutsQuery);
            const checkouts = [];
            const iterate = typeof snapshot?.forEach === "function"
                ? snapshot.forEach.bind(snapshot)
                : function iterateDocs(callback) {
                    const docs = Array.isArray(snapshot?.docs) ? snapshot.docs : [];
                    docs.forEach(callback);
                };

            iterate(function onEachCheckout(docSnapshot) {
                const data = typeof docSnapshot.data === "function" ? (docSnapshot.data() || {}) : {};
                const checkout = {
                    checkoutId: normalizeText(docSnapshot.id) || normalizeText(data.checkoutId),
                    ...data
                };

                if (statuses.indexOf(normalizeText(checkout.status).toLowerCase()) >= 0) {
                    checkouts.push(checkout);
                }
            });

            return {
                success: true,
                checkouts
            };
        } catch (error) {
            return {
                success: false,
                checkouts: [],
                error: {
                    code: normalizeText(error && error.code) || "fetch-checkouts-error",
                    message: normalizeText(error && error.message) || "Failed to load unfinished checkout payments."
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

    function buildOrderDetailUrl(orderId) {
        const url = new URL(getFallbackRoutes().detail, globalScope.location.href);
        url.searchParams.set("orderId", normalizeText(orderId));
        return url.toString();
    }

    function buildCheckoutUrl(checkoutRecord) {
        const checkout = checkoutRecord && typeof checkoutRecord === "object" ? checkoutRecord : {};
        const url = new URL(getFallbackRoutes().checkout, globalScope.location.href);
        const checkoutId = normalizeText(checkout.checkoutId);
        const vendorUid = normalizeText(checkout.vendorUid);

        if (checkoutId) {
            url.searchParams.set("checkoutId", checkoutId);
        }

        if (vendorUid) {
            url.searchParams.set("vendorUid", vendorUid);
        }

        if (normalizeText(checkout.vendorName)) {
            url.searchParams.set("vendorName", normalizeText(checkout.vendorName));
        }

        return url.toString();
    }

    function canReportIssueOnOrder(order) {
        if (!order || typeof order !== "object") {
            return false;
        }

        const status = normalizeText(order.status).toLowerCase();
        const paymentStatus = normalizeText(order.paymentStatus).toLowerCase();

        // Customer can lodge a complaint once they have actually paid OR once the order is done.
        // Unpaid / failed-payment / cancelled orders are not "real" enough yet to support against.
        return paymentStatus === "paid" || status === "completed";
    }

    function buildReportIssueUrl(orderId) {
        const safeOrderId = normalizeText(orderId);
        const url = new URL("../support/new.html", globalScope.location.href);
        if (safeOrderId) {
            url.searchParams.set("orderId", safeOrderId);
        }
        return url.toString();
    }

    function createOrderCard(orderRecord, options = {}) {
        const order = mapOrderRecord(orderRecord, options);
        const article = globalScope.document.createElement("article");
        article.className = "tracking-order-card";
        article.setAttribute("data-order-id", order.orderId);

        const heading = globalScope.document.createElement("h3");
        heading.className = "tracking-order-heading";
        heading.textContent = order.vendorName;

        const statusLine = globalScope.document.createElement("p");
        statusLine.className = "tracking-order-status";
        statusLine.textContent = `Status: ${order.statusLabel}`;
        statusLine.setAttribute("data-tone", order.tone);

        const itemsLine = globalScope.document.createElement("p");
        itemsLine.className = "tracking-order-items";
        itemsLine.textContent = `${order.itemCount} item${order.itemCount === 1 ? "" : "s"}`;

        const totalLine = globalScope.document.createElement("p");
        totalLine.className = "tracking-order-total";
        totalLine.textContent = `Total: ${order.totalText}`;

        const paymentStatusLine = globalScope.document.createElement("p");
        paymentStatusLine.className = "tracking-order-payment-status";
        paymentStatusLine.textContent = `Payment: ${order.paymentStatusLabel}`;
        paymentStatusLine.setAttribute("data-tone", order.paymentTone);
        paymentStatusLine.setAttribute("data-payment-status", order.paymentStatus);

        const paymentAmountLine = globalScope.document.createElement("p");
        paymentAmountLine.className = "tracking-order-payment-amount";
        paymentAmountLine.textContent = `Payment Amount: ${order.paymentAmountText}`;

        const footer = globalScope.document.createElement("menu");
        footer.className = "action-menu tracking-order-actions";
        footer.setAttribute("aria-label", `${order.vendorName} order actions`);

        const detailItem = globalScope.document.createElement("li");
        const detailLink = globalScope.document.createElement("a");
        detailLink.href = buildOrderDetailUrl(order.orderId);
        detailLink.className = "button-primary";
        detailLink.textContent = "Track Order";
        detailItem.appendChild(detailLink);

        footer.appendChild(detailItem);

        if (canReportIssueOnOrder(order)) {
            const reportItem = globalScope.document.createElement("li");
            const reportLink = globalScope.document.createElement("a");
            reportLink.href = buildReportIssueUrl(order.orderId);
            reportLink.className = "button-secondary tracking-order-report-link";
            reportLink.setAttribute("data-order-id", order.orderId);
            reportLink.textContent = "Report an issue";
            reportItem.appendChild(reportLink);
            footer.appendChild(reportItem);
        }

        article.appendChild(heading);
        article.appendChild(statusLine);
        article.appendChild(itemsLine);
        article.appendChild(totalLine);
        article.appendChild(paymentStatusLine);
        article.appendChild(paymentAmountLine);

        if (order.paymentReference) {
            const paymentReferenceLine = globalScope.document.createElement("p");
            paymentReferenceLine.className = "tracking-order-payment-reference";
            paymentReferenceLine.textContent = `Reference: ${order.paymentReference}`;
            article.appendChild(paymentReferenceLine);
        }

        article.appendChild(footer);

        return article;
    }

    function createCheckoutCard(checkoutRecord, options = {}) {
        const checkout = mapCheckoutRecord(checkoutRecord, options);
        const article = globalScope.document.createElement("article");
        article.className = "tracking-order-card tracking-checkout-card";
        article.setAttribute("data-checkout-id", checkout.checkoutId);

        const heading = globalScope.document.createElement("h3");
        heading.className = "tracking-order-heading";
        heading.textContent = checkout.vendorName;

        const statusLine = globalScope.document.createElement("p");
        statusLine.className = "tracking-order-status";
        statusLine.textContent = `Checkout: ${checkout.statusLabel}`;
        statusLine.setAttribute("data-tone", checkout.tone);

        const itemsLine = globalScope.document.createElement("p");
        itemsLine.className = "tracking-order-items";
        itemsLine.textContent = `${checkout.itemCount} item${checkout.itemCount === 1 ? "" : "s"}`;

        const totalLine = globalScope.document.createElement("p");
        totalLine.className = "tracking-order-total";
        totalLine.textContent = `Total: ${checkout.totalText}`;

        const paymentAmountLine = globalScope.document.createElement("p");
        paymentAmountLine.className = "tracking-order-payment-amount";
        paymentAmountLine.textContent = `Payment Amount: ${checkout.paymentAmountText}`;

        const noteLine = globalScope.document.createElement("p");
        noteLine.className = "tracking-order-payment-status";
        noteLine.setAttribute("data-tone", checkout.tone);
        noteLine.setAttribute("data-checkout-status", checkout.status);
        noteLine.textContent = "This checkout has not become an order yet.";

        const footer = globalScope.document.createElement("menu");
        footer.className = "action-menu tracking-order-actions";
        footer.setAttribute("aria-label", `${checkout.vendorName} checkout actions`);

        const resumeItem = globalScope.document.createElement("li");
        const resumeLink = globalScope.document.createElement("a");
        resumeLink.href = buildCheckoutUrl(checkout);
        resumeLink.className = "button-primary";
        resumeLink.textContent = checkout.actionLabel || "Resume Payment";
        resumeItem.appendChild(resumeLink);
        footer.appendChild(resumeItem);

        article.appendChild(heading);
        article.appendChild(statusLine);
        article.appendChild(itemsLine);
        article.appendChild(totalLine);
        article.appendChild(paymentAmountLine);
        article.appendChild(noteLine);

        if (checkout.paymentReference) {
            const paymentReferenceLine = globalScope.document.createElement("p");
            paymentReferenceLine.className = "tracking-order-payment-reference";
            paymentReferenceLine.textContent = `Reference: ${checkout.paymentReference}`;
            article.appendChild(paymentReferenceLine);
        }

        article.appendChild(footer);

        return article;
    }

    function renderOrders(orders, container, options = {}) {
        if (!container) {
            return;
        }

        container.innerHTML = "";
        const safeOrders = Array.isArray(orders) ? orders : [];

        if (safeOrders.length === 0) {
            const message = globalScope.document.createElement("p");
            message.className = "empty-state-message";
            message.textContent = normalizeText(options.emptyMessage)
                || "You do not have any orders to track yet.";
            container.appendChild(message);
            return;
        }

        safeOrders.forEach(function appendOrder(order) {
            container.appendChild(createOrderCard(order, options));
        });
    }

    function renderCheckouts(checkouts, container, options = {}) {
        if (!container) {
            return;
        }

        container.innerHTML = "";
        const safeCheckouts = Array.isArray(checkouts) ? checkouts : [];

        if (safeCheckouts.length === 0) {
            const message = globalScope.document.createElement("p");
            message.className = "empty-state-message";
            message.textContent = normalizeText(options.emptyMessage)
                || "You do not have any unfinished checkout payments.";
            container.appendChild(message);
            return;
        }

        safeCheckouts.forEach(function appendCheckout(checkout) {
            container.appendChild(createCheckoutCard(checkout, options));
        });
    }

    function getOrderTimestamp(orderRecord) {
        const safeOrder = orderRecord && typeof orderRecord === "object" ? orderRecord : {};
        const value = safeOrder.updatedAt || safeOrder.createdAt;

        if (!value) {
            return 0;
        }

        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === "string") {
            const parsed = Date.parse(value);
            return Number.isFinite(parsed) ? parsed : 0;
        }

        if (typeof value.toMillis === "function") {
            const millis = value.toMillis();
            return Number.isFinite(millis) ? millis : 0;
        }

        if (value instanceof Date) {
            return value.getTime();
        }

        if (typeof value.seconds === "number" && Number.isFinite(value.seconds)) {
            return value.seconds * 1000;
        }

        return 0;
    }

    function sortOrders(orders, sortKey) {
        const safeOrders = Array.isArray(orders) ? orders.slice() : [];
        const key = normalizeText(sortKey).toLowerCase() || DEFAULT_SORT;

        if (key === "oldest") {
            safeOrders.sort(function byOldest(a, b) {
                return getOrderTimestamp(a) - getOrderTimestamp(b);
            });
            return safeOrders;
        }

        if (key === "price-desc") {
            safeOrders.sort(function byPriceDesc(a, b) {
                return Number(b && b.total || 0) - Number(a && a.total || 0);
            });
            return safeOrders;
        }

        if (key === "price-asc") {
            safeOrders.sort(function byPriceAsc(a, b) {
                return Number(a && a.total || 0) - Number(b && b.total || 0);
            });
            return safeOrders;
        }

        safeOrders.sort(function byNewest(a, b) {
            return getOrderTimestamp(b) - getOrderTimestamp(a);
        });
        return safeOrders;
    }

    function filterOrders(orders, filters = {}) {
        const safeOrders = Array.isArray(orders) ? orders : [];
        const searchTerm = normalizeText(filters.search).toLowerCase();
        const statusFilter = normalizeText(filters.status).toLowerCase() || "all";
        const paymentFilter = normalizeText(filters.payment).toLowerCase() || "all";

        return safeOrders.filter(function byFilters(order) {
            if (!order) {
                return false;
            }

            if (statusFilter !== "all" && normalizeText(order.status).toLowerCase() !== statusFilter) {
                return false;
            }

            if (paymentFilter !== "all" && normalizeText(order.paymentStatus).toLowerCase() !== paymentFilter) {
                return false;
            }

            if (searchTerm) {
                const vendorName = normalizeText(order.vendorName).toLowerCase();
                const orderId = normalizeText(order.orderId).toLowerCase();
                const reference = normalizeText(order.paymentReference).toLowerCase();
                if (
                    vendorName.indexOf(searchTerm) === -1 &&
                    orderId.indexOf(searchTerm) === -1 &&
                    reference.indexOf(searchTerm) === -1
                ) {
                    return false;
                }
            }

            return true;
        });
    }

    function paginateOrders(orders, page, pageSize) {
        const safeOrders = Array.isArray(orders) ? orders : [];
        const size = Number.isFinite(Number(pageSize)) && Number(pageSize) > 0
            ? Math.floor(Number(pageSize))
            : DEFAULT_PAGE_SIZE;
        const totalPages = Math.max(1, Math.ceil(safeOrders.length / size));
        const safePage = Math.min(Math.max(1, Math.floor(Number(page) || 1)), totalPages);
        const start = (safePage - 1) * size;
        const pageOrders = safeOrders.slice(start, start + size);

        return {
            pageOrders,
            page: safePage,
            pageSize: size,
            totalPages,
            totalCount: safeOrders.length
        };
    }

    function updatePaginationControls(paginationElement, statusElement, paginationInfo) {
        if (!paginationElement) {
            return;
        }

        const totalCount = paginationInfo && Number(paginationInfo.totalCount) || 0;

        if (totalCount === 0) {
            paginationElement.setAttribute("hidden", "");
        } else {
            paginationElement.removeAttribute("hidden");
        }

        if (statusElement) {
            statusElement.textContent = `Page ${paginationInfo.page} of ${paginationInfo.totalPages}`;
        }

        const prevButton = paginationElement.querySelector('[data-page-action="prev"]');
        const nextButton = paginationElement.querySelector('[data-page-action="next"]');

        if (prevButton) {
            prevButton.disabled = paginationInfo.page <= 1;
        }

        if (nextButton) {
            nextButton.disabled = paginationInfo.page >= paginationInfo.totalPages;
        }
    }

    function buildResultSummary(filteredCount, totalCount) {
        if (totalCount === 0) {
            return "";
        }

        if (filteredCount === totalCount) {
            return `Showing all ${totalCount} order${totalCount === 1 ? "" : "s"}.`;
        }

        return `Showing ${filteredCount} of ${totalCount} order${totalCount === 1 ? "" : "s"}.`;
    }

    function buildCheckoutSummary(count) {
        const total = Number.isFinite(Number(count)) ? Number(count) : 0;

        if (total === 0) {
            return "";
        }

        return `${total} unfinished checkout payment${total === 1 ? "" : "s"} can still be resumed or cancelled.`;
    }

    function renderCheckoutPanel(elements, options = {}) {
        const container = elements && elements.checkoutsContainer;
        const summary = elements && elements.checkoutsSummary;

        if (!container) {
            if (summary) {
                summary.textContent = buildCheckoutSummary(pageState.allCheckouts.length);
            }
            return;
        }

        renderCheckouts(pageState.allCheckouts, container, {
            ...options,
            emptyMessage: "You do not have any unfinished checkout payments."
        });

        if (summary) {
            summary.textContent = buildCheckoutSummary(pageState.allCheckouts.length);
        }
    }

    function renderCurrentPage(elements, options = {}) {
        const container = elements && elements.container;
        if (!container) {
            return null;
        }

        const filtered = filterOrders(pageState.allOrders, pageState.filters);
        const sorted = sortOrders(filtered, pageState.filters.sort);
        const paginated = paginateOrders(sorted, pageState.currentPage, pageState.pageSize);
        pageState.currentPage = paginated.page;

        const hasOrders = pageState.allOrders.length > 0;
        const emptyMessage = hasOrders
            ? "No orders match your filters. Try clearing them to see more."
            : "You do not have any orders to track yet.";

        renderOrders(paginated.pageOrders, container, {
            ...options,
            emptyMessage
        });

        if (elements.summary) {
            elements.summary.textContent = buildResultSummary(sorted.length, pageState.allOrders.length);
        }

        updatePaginationControls(elements.pagination, elements.paginationStatus, paginated);

        return paginated;
    }

    function readFiltersFromForm(form) {
        if (!form) {
            return null;
        }

        const data = new globalScope.FormData(form);

        return {
            search: normalizeText(data.get("search")),
            status: normalizeText(data.get("status")) || "all",
            payment: normalizeText(data.get("payment")) || "all",
            sort: normalizeText(data.get("sort")) || DEFAULT_SORT
        };
    }

    function attachToolbarHandlers(elements, options = {}) {
        const form = elements && elements.form;

        if (form && !form.dataset.trackingFormBound) {
            form.dataset.trackingFormBound = "true";

            form.addEventListener("input", function onInput() {
                const next = readFiltersFromForm(form);
                if (next) {
                    pageState.filters = next;
                    pageState.currentPage = 1;
                    renderCurrentPage(elements, options);
                }
            });

            form.addEventListener("change", function onChange() {
                const next = readFiltersFromForm(form);
                if (next) {
                    pageState.filters = next;
                    pageState.currentPage = 1;
                    renderCurrentPage(elements, options);
                }
            });

            form.addEventListener("reset", function onReset() {
                globalScope.setTimeout(function applyReset() {
                    pageState.filters = {
                        search: "",
                        status: "all",
                        payment: "all",
                        sort: DEFAULT_SORT
                    };
                    pageState.currentPage = 1;
                    renderCurrentPage(elements, options);
                }, 0);
            });
        }

        const pagination = elements && elements.pagination;

        if (pagination && !pagination.dataset.trackingPaginationBound) {
            pagination.dataset.trackingPaginationBound = "true";

            pagination.addEventListener("click", function onPaginationClick(event) {
                const target = event.target.closest("[data-page-action]");
                if (!target) {
                    return;
                }

                const action = target.getAttribute("data-page-action");
                if (action === "prev") {
                    pageState.currentPage = Math.max(1, pageState.currentPage - 1);
                } else if (action === "next") {
                    pageState.currentPage = pageState.currentPage + 1;
                }

                renderCurrentPage(elements, options);
            });
        }
    }

    async function init(options = {}) {
        if (initInFlight) {
            return initInFlight;
        }

        initInFlight = (async function runInit() {
            const auth = options.auth || resolveAuth();
            const authFns = resolveAuthFns(options.authFns);
            const db = options.db || resolveFirestore();
            const firestoreFns = resolveFirestoreFns(options.firestoreFns);
            const containerSelector = options.containerSelector || "#tracked-orders-container";
            const statusSelector = options.statusSelector || "#order-tracking-status";

            const container = globalScope.document.querySelector(containerSelector);
            const statusElement = globalScope.document.querySelector(statusSelector);
            const summaryElement = globalScope.document.querySelector(
                options.summarySelector || "#tracked-orders-summary"
            );
            const formElement = globalScope.document.querySelector(
                options.formSelector || "#orders-filter-form"
            );
            const paginationElement = globalScope.document.querySelector(
                options.paginationSelector || "#tracked-orders-pagination"
            );
            const paginationStatusElement = globalScope.document.querySelector(
                options.paginationStatusSelector || "#orders-pagination-status"
            );
            const checkoutsContainer = globalScope.document.querySelector(
                options.checkoutsContainerSelector || "#active-checkouts-container"
            );
            const checkoutsSummary = globalScope.document.querySelector(
                options.checkoutsSummarySelector || "#active-checkouts-summary"
            );

            if (!container) {
                return {
                    success: false,
                    error: "Tracked orders container not found."
                };
            }

            const elements = {
                container,
                summary: summaryElement,
                form: formElement,
                pagination: paginationElement,
                paginationStatus: paginationStatusElement,
                checkoutsContainer,
                checkoutsSummary
            };

            const initialFilters = readFiltersFromForm(formElement);
            if (initialFilters) {
                pageState.filters = initialFilters;
            } else {
                pageState.filters = {
                    search: "",
                    status: "all",
                    payment: "all",
                    sort: DEFAULT_SORT
                };
            }
            pageState.currentPage = 1;
            pageState.pageSize = Number(options.pageSize) > 0
                ? Math.floor(Number(options.pageSize))
                : DEFAULT_PAGE_SIZE;

            setStatusMessage(statusElement, "Loading your orders...", "loading");

            const currentUser = options.currentUser || await waitForAuthReady(auth, authFns);

            if (!currentUser || !normalizeText(currentUser.uid)) {
                pageState.allOrders = [];
                pageState.allCheckouts = [];
                renderOrders([], container, options);
                renderCheckoutPanel(elements, options);
                if (summaryElement) {
                    summaryElement.textContent = "";
                }
                if (paginationElement) {
                    paginationElement.setAttribute("hidden", "");
                }
                setStatusMessage(statusElement, "Please sign in to track your orders.", "error");
                return {
                    success: false,
                    error: "Please sign in to track your orders."
                };
            }

            const result = await fetchCustomerOrders({
                ...options,
                db,
                firestoreFns,
                customerUid: currentUser.uid
            });
            const checkoutResult = await fetchCustomerCheckouts({
                ...options,
                db,
                firestoreFns,
                customerUid: currentUser.uid
            });

            if (!result.success) {
                pageState.allOrders = [];
                pageState.allCheckouts = [];
                renderOrders([], container, options);
                renderCheckoutPanel(elements, options);
                if (summaryElement) {
                    summaryElement.textContent = "";
                }
                if (paginationElement) {
                    paginationElement.setAttribute("hidden", "");
                }
                setStatusMessage(
                    statusElement,
                    result.error && result.error.message
                        ? result.error.message
                        : "Failed to load your orders.",
                    "error"
                );
                return {
                    success: false,
                    error: result.error && result.error.message
                        ? result.error.message
                        : "Failed to load your orders."
                };
            }

            pageState.allOrders = Array.isArray(result.orders)
                ? result.orders.map(function mapAndKeep(order) {
                    return mapOrderRecord(order, options);
                })
                : [];
            pageState.allCheckouts = checkoutResult.success && Array.isArray(checkoutResult.checkouts)
                ? checkoutResult.checkouts.map(function mapAndKeepCheckout(checkout) {
                    return mapCheckoutRecord(checkout, options);
                })
                : [];

            attachToolbarHandlers(elements, options);
            renderCheckoutPanel(elements, options);
            renderCurrentPage(elements, options);

            if (pageState.allOrders.length === 0 && pageState.allCheckouts.length === 0) {
                setStatusMessage(statusElement, "You do not have any orders to track yet.", "info");
            } else {
                const orderCount = pageState.allOrders.length;
                const checkoutCount = pageState.allCheckouts.length;
                const orderPart = `${orderCount} order${orderCount === 1 ? "" : "s"}`;
                const checkoutPart = `${checkoutCount} unfinished checkout${checkoutCount === 1 ? "" : "s"}`;
                setStatusMessage(
                    statusElement,
                    checkoutCount > 0
                        ? `Tracking ${orderPart} and ${checkoutPart}.`
                        : `Tracking ${orderPart}.`,
                    "success"
                );
            }

            return {
                success: true,
                orders: result.orders,
                checkouts: checkoutResult.checkouts || []
            };
        })();

        try {
            return await initInFlight;
        } finally {
            initInFlight = null;
        }
    }

    const customerOrderTrackingPage = {
        MODULE_NAME,
        DEFAULT_PAGE_SIZE,
        DEFAULT_SORT,
        normalizeText,
        resolveFirestore,
        resolveAuth,
        resolveAuthFns,
        resolveFirestoreFns,
        resolveOrderService,
        resolveOrderStatus,
        resolveOrderFormatters,
        resolvePaymentStatus,
        resolvePaymentFormatters,
        resolveCheckoutQueries,
        resolveCheckoutStatus,
        getFallbackRoutes,
        waitForAuthReady,
        mapOrderRecord,
        getDefaultResumableCheckoutStatuses,
        mapCheckoutRecord,
        fetchCustomerOrders,
        fetchCustomerCheckouts,
        setStatusMessage,
        buildOrderDetailUrl,
        buildCheckoutUrl,
        canReportIssueOnOrder,
        buildReportIssueUrl,
        createOrderCard,
        createCheckoutCard,
        renderOrders,
        renderCheckouts,
        getOrderTimestamp,
        sortOrders,
        filterOrders,
        paginateOrders,
        buildResultSummary,
        buildCheckoutSummary,
        renderCheckoutPanel,
        init
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerOrderTrackingPage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.customerOrderTrackingPage = customerOrderTrackingPage;
    }
})(typeof window !== "undefined" ? window : globalThis);
