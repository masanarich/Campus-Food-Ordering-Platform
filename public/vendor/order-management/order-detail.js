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

            button.type = "button";
            button.textContent = action.label;
            button.dataset.actionType = action.type;
            button.dataset.nextStatus = action.nextStatus;
            button.dataset.tone = action.tone;
            button.addEventListener("click", function onClick() {
                return handleOrderAction(action, options);
            });

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

        setStatusMessage(statusElement, "Updating order status...", "loading");

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

        setStatusMessage(statusElement, "Order updated successfully.", "success");

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
            const statusElement = globalScope.document.querySelector(options.statusSelector || "#vendor-order-detail-status");
            const actionContainer = globalScope.document.querySelector(options.actionSelector || "#vendor-order-action-container");
            const summaryContainer = globalScope.document.querySelector(options.summarySelector || "#vendor-order-summary");
            const itemsContainer = globalScope.document.querySelector(options.itemsSelector || "#vendor-order-items");
            const timelineContainer = globalScope.document.querySelector(options.timelineSelector || "#vendor-order-timeline");

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
                    timeline: timelineContainer
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
                    timeline: timelineContainer
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
                    timeline: timelineContainer
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
                    timeline: timelineContainer
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
        resolveOrderService,
        resolveOrderStatus,
        resolveOrderFormatters,
        waitForAuthReady,
        normalizeVendorProfile,
        canAccessVendorWorkspace,
        fetchVendorProfile,
        getOrderIdFromLocation,
        fetchOrderDetail,
        setStatusMessage,
        getAllowedVendorActions,
        renderOrderSummary,
        renderOrderItems,
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
