(function attachVendorOrderManagementPage(globalScope) {
    "use strict";

    const MODULE_NAME = "vendor/order-management/index";
    let initInFlight = null;

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
        if (explicitOrderService && typeof explicitOrderService.getVendorOrders === "function") {
            return explicitOrderService;
        }

        if (globalScope.orderService && typeof globalScope.orderService.getVendorOrders === "function") {
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
        if (explicitOrderFormatters && typeof explicitOrderFormatters.formatOrderSummary === "function") {
            return explicitOrderFormatters;
        }

        if (globalScope.orderFormatters && typeof globalScope.orderFormatters.formatOrderSummary === "function") {
            return globalScope.orderFormatters;
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
            email: normalizeLowerText(safeProfile.email || safeProfile.vendorEmail),
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
                    email: currentUser.email,
                    ...data
                });
            } catch (error) {
                console.error(`${MODULE_NAME}: Failed to load vendor profile from Firestore:`, error);
            }
        }

        return normalizeVendorProfile(currentUser);
    }

    function mapOrderRecord(orderRecord, options = {}) {
        const safeOrder = orderRecord && typeof orderRecord === "object" ? orderRecord : {};
        const orderStatus = resolveOrderStatus(options.orderStatus);
        const orderFormatters = resolveOrderFormatters(options.orderFormatters);
        const normalizedStatus =
            orderStatus && typeof orderStatus.normalizeOrderStatus === "function"
                ? orderStatus.normalizeOrderStatus(safeOrder.status, "pending")
                : normalizeLowerText(safeOrder.status) || "pending";
        const statusLabel =
            orderFormatters && typeof orderFormatters.getOrderStatusLabel === "function"
                ? orderFormatters.getOrderStatusLabel(normalizedStatus, orderStatus)
                : normalizedStatus;
        const tone =
            orderFormatters && typeof orderFormatters.getOrderStatusTone === "function"
                ? orderFormatters.getOrderStatusTone(normalizedStatus, orderStatus)
                : "info";
        const summaryText =
            orderFormatters && typeof orderFormatters.formatOrderSummary === "function"
                ? orderFormatters.formatOrderSummary(safeOrder, {
                    viewerRole: "vendor",
                    includeStatus: false
                })
                : `${normalizeText(safeOrder.customerName) || "Customer"} • ${Number(safeOrder.itemCount || 0)} items`;
        const totalText =
            orderFormatters && typeof orderFormatters.formatOrderTotal === "function"
                ? orderFormatters.formatOrderTotal(safeOrder)
                : `R${Number(safeOrder.total || 0).toFixed(2)}`;
        const updatedText =
            orderFormatters && typeof orderFormatters.formatDateTime === "function"
                ? orderFormatters.formatDateTime(safeOrder.updatedAt || safeOrder.createdAt)
                : "Unknown time";

        return {
            orderId: normalizeText(safeOrder.orderId || safeOrder.id),
            customerName: normalizeText(safeOrder.customerName) || "Customer",
            itemCount: Number.isFinite(Number(safeOrder.itemCount)) ? Number(safeOrder.itemCount) : 0,
            totalText,
            status: normalizedStatus,
            statusLabel,
            tone,
            summaryText,
            updatedText
        };
    }

    async function fetchVendorOrders(options = {}) {
        const db = options.db || resolveFirestore();
        const firestoreFns = resolveFirestoreFns(options.firestoreFns);
        const orderService = resolveOrderService(options.orderService);
        const vendorUid = normalizeText(options.vendorUid);

        if (!vendorUid) {
            return {
                success: false,
                orders: [],
                error: {
                    code: "missing-vendor",
                    message: "A signed-in vendor is required."
                }
            };
        }

        if (orderService && db) {
            try {
                const orders = await orderService.getVendorOrders({
                    db,
                    firestoreFns,
                    vendorUid
                });

                return {
                    success: true,
                    orders: Array.isArray(orders) ? orders : []
                };
            } catch (error) {
                console.error(`${MODULE_NAME}: Error fetching vendor orders via service:`, error);
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
                    message: "Vendor order access is not available right now."
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
                        firestoreFns.where("vendorUid", "==", vendorUid)
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
                    message: normalizeText(error && error.message) || "Failed to load vendor orders."
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
        const url = new URL("./order-detail.html", globalScope.location.href);
        url.searchParams.set("orderId", normalizeText(orderId));
        return url.toString();
    }

    function createOrderCard(orderRecord, options = {}) {
        const order = mapOrderRecord(orderRecord, options);
        const article = globalScope.document.createElement("article");
        article.className = "vendor-order-card";
        article.setAttribute("data-order-id", order.orderId);

        const heading = globalScope.document.createElement("h4");
        heading.className = "vendor-order-card-heading";
        heading.textContent = order.customerName;

        const summary = globalScope.document.createElement("p");
        summary.className = "vendor-order-card-summary";
        summary.textContent = order.summaryText;

        const statusLine = globalScope.document.createElement("p");
        statusLine.className = "vendor-order-card-status";
        statusLine.textContent = `Status: ${order.statusLabel}`;
        statusLine.setAttribute("data-tone", order.tone);

        const totalLine = globalScope.document.createElement("p");
        totalLine.className = "vendor-order-card-total";
        totalLine.textContent = `Total: ${order.totalText}`;

        const updatedLine = globalScope.document.createElement("p");
        updatedLine.className = "vendor-order-card-updated";
        updatedLine.textContent = `Last update: ${order.updatedText}`;

        const actions = globalScope.document.createElement("menu");
        actions.className = "action-menu vendor-order-card-actions";
        actions.setAttribute("aria-label", `${order.customerName} order actions`);

        const detailItem = globalScope.document.createElement("li");
        const detailLink = globalScope.document.createElement("a");
        detailLink.href = buildOrderDetailUrl(order.orderId);
        detailLink.textContent = "Open Order";
        detailItem.appendChild(detailLink);

        actions.appendChild(detailItem);

        article.appendChild(heading);
        article.appendChild(summary);
        article.appendChild(statusLine);
        article.appendChild(totalLine);
        article.appendChild(updatedLine);
        article.appendChild(actions);

        return article;
    }

    function renderSummary(summaryElement, orders, vendorProfile, options = {}) {
        if (!summaryElement) {
            return;
        }

        summaryElement.innerHTML = "";

        const safeOrders = Array.isArray(orders) ? orders : [];
        const orderFormatters = resolveOrderFormatters(options.orderFormatters);
        const activeStatuses = ["pending", "accepted", "preparing", "ready"];
        const activeCount = safeOrders.filter(function keepActive(order) {
            const status = normalizeLowerText(order && order.status);
            return activeStatuses.indexOf(status) >= 0;
        }).length;
        const readyCount = safeOrders.filter(function keepReady(order) {
            return normalizeLowerText(order && order.status) === "ready";
        }).length;
        const totalValue = safeOrders.reduce(function sumOrderTotals(total, order) {
            return total + Number(order && order.total ? order.total : 0);
        }, 0);
        const totalValueText =
            orderFormatters && typeof orderFormatters.formatCurrency === "function"
                ? orderFormatters.formatCurrency(totalValue)
                : `R${totalValue.toFixed(2)}`;
        const summaryList = globalScope.document.createElement("ol");

        [
            `Vendor: ${normalizeText(vendorProfile && vendorProfile.displayName) || "Vendor User"}`,
            `Orders loaded: ${safeOrders.length}`,
            `Active orders: ${activeCount}`,
            `Ready for pickup: ${readyCount}`,
            `Combined order value: ${totalValueText}`
        ].forEach(function appendSummaryLine(text) {
            const item = globalScope.document.createElement("li");
            item.textContent = text;
            summaryList.appendChild(item);
        });

        summaryElement.appendChild(summaryList);
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
            message.textContent = "There are no vendor orders to manage right now.";
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
            const statusElement = globalScope.document.querySelector(
                options.statusSelector || "#vendor-order-management-status"
            );
            const summaryElement = globalScope.document.querySelector(
                options.summarySelector || "#vendor-order-management-summary"
            );
            const container = globalScope.document.querySelector(
                options.containerSelector || "#vendor-orders-container"
            );

            if (!summaryElement || !container) {
                return {
                    success: false,
                    error: "Vendor order management containers not found."
                };
            }

            setStatusMessage(statusElement, "Loading your vendor orders...", "loading");

            const currentUser = options.currentUser || await waitForAuthReady(auth, authFns);

            if (!currentUser || !normalizeText(currentUser.uid)) {
                renderSummary(summaryElement, [], null, options);
                renderOrders([], container, options);
                setStatusMessage(statusElement, "Please sign in to manage vendor orders.", "error");
                return {
                    success: false,
                    error: "Please sign in to manage vendor orders."
                };
            }

            const vendorProfile = await fetchVendorProfile({
                ...options,
                db,
                firestoreFns,
                currentUser
            });

            if (!canAccessVendorWorkspace(vendorProfile)) {
                renderSummary(summaryElement, [], vendorProfile, options);
                renderOrders([], container, options);
                setStatusMessage(statusElement, "You do not have vendor order access right now.", "error");
                return {
                    success: false,
                    error: "You do not have vendor order access right now."
                };
            }

            const result = await fetchVendorOrders({
                ...options,
                db,
                firestoreFns,
                vendorUid: currentUser.uid
            });

            if (!result.success) {
                renderSummary(summaryElement, [], vendorProfile, options);
                renderOrders([], container, options);
                setStatusMessage(
                    statusElement,
                    result.error && result.error.message
                        ? result.error.message
                        : "Failed to load vendor orders.",
                    "error"
                );
                return {
                    success: false,
                    error: result.error && result.error.message
                        ? result.error.message
                        : "Failed to load vendor orders."
                };
            }

            renderSummary(summaryElement, result.orders, vendorProfile, options);
            renderOrders(result.orders, container, options);

            if (result.orders.length === 0) {
                setStatusMessage(statusElement, "There are no vendor orders to manage right now.", "info");
            } else {
                setStatusMessage(
                    statusElement,
                    `Loaded ${result.orders.length} vendor order${result.orders.length === 1 ? "" : "s"}.`,
                    "success"
                );
            }

            return {
                success: true,
                vendorProfile,
                orders: result.orders
            };
        })();

        try {
            return await initInFlight;
        } finally {
            initInFlight = null;
        }
    }

    const vendorOrderManagementPage = {
        MODULE_NAME,
        normalizeText,
        normalizeLowerText,
        resolveFirestore,
        resolveAuth,
        resolveAuthFns,
        resolveFirestoreFns,
        resolveOrderService,
        resolveOrderStatus,
        resolveOrderFormatters,
        waitForAuthReady,
        normalizeVendorProfile,
        canAccessVendorWorkspace,
        fetchVendorProfile,
        mapOrderRecord,
        fetchVendorOrders,
        setStatusMessage,
        buildOrderDetailUrl,
        createOrderCard,
        renderSummary,
        renderOrders,
        init
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = vendorOrderManagementPage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.vendorOrderManagementPage = vendorOrderManagementPage;
    }
})(typeof window !== "undefined" ? window : globalThis);
