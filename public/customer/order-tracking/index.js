(function attachCustomerOrderTrackingPage(globalScope) {
    "use strict";

    const MODULE_NAME = "customer/order-tracking/index";
    let initInFlight = null;

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

    function getFallbackRoutes() {
        return {
            home: "../index.html",
            notifications: "./notifications.html",
            browseVendors: "../order-management/browse-vendors.html",
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
            updatedAt: safeOrder.updatedAt || safeOrder.createdAt || null
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

        article.appendChild(heading);
        article.appendChild(statusLine);
        article.appendChild(itemsLine);
        article.appendChild(totalLine);
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
            message.textContent = "You do not have any orders to track yet.";
            container.appendChild(message);
            return;
        }

        safeOrders.forEach(function appendOrder(order) {
            container.appendChild(createOrderCard(order, options));
        });
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

            if (!container) {
                return {
                    success: false,
                    error: "Tracked orders container not found."
                };
            }

            setStatusMessage(statusElement, "Loading your orders...", "loading");

            const currentUser = options.currentUser || await waitForAuthReady(auth, authFns);

            if (!currentUser || !normalizeText(currentUser.uid)) {
                renderOrders([], container, options);
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

            if (!result.success) {
                renderOrders([], container, options);
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

            renderOrders(result.orders, container, options);

            if (result.orders.length === 0) {
                setStatusMessage(statusElement, "You do not have any orders to track yet.", "info");
            } else {
                setStatusMessage(
                    statusElement,
                    `Tracking ${result.orders.length} order${result.orders.length === 1 ? "" : "s"}.`,
                    "success"
                );
            }

            return {
                success: true,
                orders: result.orders
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
        normalizeText,
        resolveFirestore,
        resolveAuth,
        resolveAuthFns,
        resolveFirestoreFns,
        resolveOrderService,
        resolveOrderStatus,
        resolveOrderFormatters,
        getFallbackRoutes,
        waitForAuthReady,
        mapOrderRecord,
        fetchCustomerOrders,
        setStatusMessage,
        buildOrderDetailUrl,
        createOrderCard,
        renderOrders,
        init
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerOrderTrackingPage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.customerOrderTrackingPage = customerOrderTrackingPage;
    }
})(typeof window !== "undefined" ? window : globalThis);
