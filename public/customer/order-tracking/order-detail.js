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

    function getFallbackRoutes() {
        return {
            home: "../index.html",
            tracking: "./index.html",
            notifications: "./notifications.html",
            browseVendors: "../order-management/browse-vendors.html",
            vendorOrderDetail: "../../vendor/order-management/order-detail.html"
        };
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
        getFallbackRoutes,
        buildVendorDetailUrl,
        waitForAuthReady,
        getOrderIdFromLocation,
        fetchOrderDetail,
        setStatusMessage,
        renderOrderSummary,
        renderOrderItems,
        renderOrderTimeline,
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
