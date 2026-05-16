(function attachCustomerOrderNotificationsPage(globalScope) {
    "use strict";

    const MODULE_NAME = "customer/order-tracking/notifications";
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
        if (explicitOrderService && typeof explicitOrderService.getNotifications === "function") {
            return explicitOrderService;
        }

        if (globalScope.orderService && typeof globalScope.orderService.getNotifications === "function") {
            return globalScope.orderService;
        }

        return null;
    }

    function getFallbackRoutes() {
        return {
            home: "../index.html",
            tracking: "./index.html",
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

    function mapNotificationRecord(notificationRecord) {
        const safeRecord = notificationRecord && typeof notificationRecord === "object" ? notificationRecord : {};
        const isRead = safeRecord.read === true || safeRecord.isRead === true;

        return {
            notificationId: normalizeText(safeRecord.notificationId || safeRecord.id),
            recipientUid: normalizeText(safeRecord.recipientUid),
            orderId: normalizeText(safeRecord.orderId),
            type: normalizeText(safeRecord.type),
            title: normalizeText(safeRecord.title) || "Order Update",
            message: normalizeText(safeRecord.message) || "There is a new update for your order.",
            read: isRead,
            createdAt: safeRecord.createdAt || null
        };
    }

    async function markNotificationRead(notificationId, options = {}) {
        const id = normalizeText(notificationId);

        if (!id) {
            return { success: false, error: "Missing notification id." };
        }

        const db = options.db || resolveFirestore();
        const firestoreFns = resolveFirestoreFns(options.firestoreFns);

        if (
            !db ||
            typeof firestoreFns.doc !== "function" ||
            typeof firestoreFns.updateDoc !== "function"
        ) {
            return { success: false, error: "Notification update is not available right now." };
        }

        try {
            const docRef = firestoreFns.doc(db, "notifications", id);
            const patch = {
                read: true,
                isRead: true
            };

            if (typeof firestoreFns.serverTimestamp === "function") {
                patch.updatedAt = firestoreFns.serverTimestamp();
            }

            await firestoreFns.updateDoc(docRef, patch);
            return { success: true };
        } catch (error) {
            console.error(`${MODULE_NAME}: Failed to mark notification as read:`, error);
            return {
                success: false,
                error: error && error.message ? error.message : "Failed to mark notification as read."
            };
        }
    }

    function applyReadStateToCard(article) {
        if (!article || typeof article.querySelector !== "function") {
            return;
        }

        article.setAttribute("data-read", "true");

        const stateLine = article.querySelector(".tracking-notification-state");

        if (stateLine) {
            stateLine.textContent = "Read";
            stateLine.setAttribute("data-tone", "info");
        }
    }

    async function fetchNotifications(options = {}) {
        const db = options.db || resolveFirestore();
        const firestoreFns = resolveFirestoreFns(options.firestoreFns);
        const orderService = resolveOrderService(options.orderService);
        const recipientUid = normalizeText(options.recipientUid);

        if (!recipientUid) {
            return {
                success: false,
                notifications: [],
                error: {
                    code: "no-recipient",
                    message: "A signed-in customer is required."
                }
            };
        }

        if (orderService && typeof orderService.getNotifications === "function" && db) {
            try {
                const notifications = await orderService.getNotifications({
                    db,
                    firestoreFns,
                    recipientUid
                });

                return {
                    success: true,
                    notifications: Array.isArray(notifications) ? notifications : []
                };
            } catch (error) {
                console.error(`${MODULE_NAME}: Error fetching notifications via service:`, error);
            }
        }

        if (
            !db ||
            typeof firestoreFns.collection !== "function" ||
            typeof firestoreFns.getDocs !== "function"
        ) {
            return {
                success: false,
                notifications: [],
                error: {
                    code: "no-firestore",
                    message: "Notification access is not available right now."
                }
            };
        }

        try {
            const notificationsCollection = firestoreFns.collection(db, "notifications");
            const notificationsQuery =
                typeof firestoreFns.query === "function" &&
                typeof firestoreFns.where === "function"
                    ? firestoreFns.query(
                        notificationsCollection,
                        firestoreFns.where("recipientUid", "==", recipientUid)
                    )
                    : notificationsCollection;
            const snapshot = await firestoreFns.getDocs(notificationsQuery);
            const notifications = [];
            const iterate = typeof snapshot?.forEach === "function"
                ? snapshot.forEach.bind(snapshot)
                : function iterateDocs(callback) {
                    const docs = Array.isArray(snapshot?.docs) ? snapshot.docs : [];
                    docs.forEach(callback);
                };

            iterate(function onEachNotification(docSnapshot) {
                const data = typeof docSnapshot.data === "function" ? (docSnapshot.data() || {}) : {};
                notifications.push({
                    notificationId: normalizeText(docSnapshot.id) || normalizeText(data.notificationId),
                    ...data
                });
            });

            return {
                success: true,
                notifications
            };
        } catch (error) {
            return {
                success: false,
                notifications: [],
                error: {
                    code: normalizeText(error && error.code) || "fetch-error",
                    message: normalizeText(error && error.message) || "Failed to load notifications."
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

    function createNotificationArticle(notificationRecord, options = {}) {
        const notification = mapNotificationRecord(notificationRecord);
        const article = globalScope.document.createElement("article");
        article.className = "tracking-notification-card";
        article.setAttribute("data-notification-id", notification.notificationId);
        article.setAttribute("data-read", notification.read ? "true" : "false");

        const heading = globalScope.document.createElement("h3");
        heading.className = "tracking-notification-heading";
        heading.textContent = notification.title;

        const message = globalScope.document.createElement("p");
        message.className = "tracking-notification-message";
        message.textContent = notification.message;

        const stateLine = globalScope.document.createElement("p");
        stateLine.className = "tracking-notification-state";
        stateLine.textContent = notification.read ? "Read" : "Unread";
        stateLine.setAttribute("data-tone", notification.read ? "info" : "success");

        article.appendChild(heading);
        article.appendChild(message);
        article.appendChild(stateLine);

        const actions = globalScope.document.createElement("menu");
        actions.className = "action-menu tracking-notification-actions";
        actions.setAttribute("aria-label", `${notification.title} actions`);

        function persistReadState() {
            if (article.getAttribute("data-read") === "true") {
                return Promise.resolve();
            }

            applyReadStateToCard(article);

            return markNotificationRead(notification.notificationId, options)
                .catch(function onError(error) {
                    console.warn(`${MODULE_NAME}: mark-as-read failed.`, error);
                });
        }

        function navigateAfterRead(href) {
            try {
                if (typeof globalScope.location.assign === "function") {
                    globalScope.location.assign(href);
                    return;
                }
            } catch (assignError) {
                // Some test environments throw on navigation; fall through.
            }

            try {
                globalScope.location.href = href;
            } catch (hrefError) {
                // Test environment without real navigation — nothing to do.
            }
        }

        if (notification.orderId) {
            const detailItem = globalScope.document.createElement("li");
            const detailLink = globalScope.document.createElement("a");
            detailLink.href = buildOrderDetailUrl(notification.orderId);
            detailLink.className = "button-primary";
            detailLink.textContent = "Open Order";
            detailLink.addEventListener("click", async function onOpenOrder(event) {
                if (article.getAttribute("data-read") === "true") {
                    return;
                }

                // Modifier-clicks open in a new tab — the current page stays
                // open, so a fire-and-forget update is safe.
                const opensInNewTab = event && (
                    event.ctrlKey === true ||
                    event.metaKey === true ||
                    event.shiftKey === true ||
                    event.button === 1
                );

                if (opensInNewTab) {
                    persistReadState();
                    return;
                }

                // Same-tab navigation — we MUST wait for the write to commit
                // before letting the page unload, otherwise the request is
                // cancelled mid-flight and the notification stays unread.
                event.preventDefault();
                await persistReadState();
                navigateAfterRead(detailLink.href);
            });
            detailItem.appendChild(detailLink);
            actions.appendChild(detailItem);
        }

        if (!notification.read) {
            const markItem = globalScope.document.createElement("li");
            const markButton = globalScope.document.createElement("button");
            markButton.type = "button";
            markButton.className = "button-secondary";
            markButton.textContent = "Mark as read";
            markButton.dataset.actionType = "mark_read";
            markButton.addEventListener("click", function onMarkRead() {
                persistReadState();
                markButton.remove();
            });
            markItem.appendChild(markButton);
            actions.appendChild(markItem);
        }

        if (actions.children.length > 0) {
            article.appendChild(actions);
        }

        return article;
    }

    function renderNotifications(notifications, container, options = {}) {
        if (!container) {
            return;
        }

        container.innerHTML = "";
        const safeNotifications = Array.isArray(notifications) ? notifications : [];

        if (safeNotifications.length === 0) {
            const message = globalScope.document.createElement("p");
            message.className = "empty-state-message";
            message.textContent = "You do not have any notifications yet.";
            container.appendChild(message);
            return;
        }

        safeNotifications.forEach(function appendNotification(notification) {
            container.appendChild(createNotificationArticle(notification, options));
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
            const containerSelector = options.containerSelector || "#notifications-container";
            const statusSelector = options.statusSelector || "#order-tracking-notifications-status";

            const container = globalScope.document.querySelector(containerSelector);
            const statusElement = globalScope.document.querySelector(statusSelector);

            if (!container) {
                return {
                    success: false,
                    error: "Notifications container not found."
                };
            }

            setStatusMessage(statusElement, "Loading your notifications...", "loading");

            const currentUser = options.currentUser || await waitForAuthReady(auth, authFns);

            if (!currentUser || !normalizeText(currentUser.uid)) {
                renderNotifications([], container);
                setStatusMessage(statusElement, "Please sign in to view your notifications.", "error");
                return {
                    success: false,
                    error: "Please sign in to view your notifications."
                };
            }

            const result = await fetchNotifications({
                ...options,
                db,
                firestoreFns,
                recipientUid: currentUser.uid
            });

            if (!result.success) {
                renderNotifications([], container);
                setStatusMessage(
                    statusElement,
                    result.error && result.error.message
                        ? result.error.message
                        : "Failed to load notifications.",
                    "error"
                );
                return {
                    success: false,
                    error: result.error && result.error.message
                        ? result.error.message
                        : "Failed to load notifications."
                };
            }

            renderNotifications(result.notifications, container, {
                db,
                firestoreFns
            });

            if (result.notifications.length === 0) {
                setStatusMessage(statusElement, "You do not have any notifications yet.", "info");
            } else {
                setStatusMessage(
                    statusElement,
                    `You have ${result.notifications.length} notification${result.notifications.length === 1 ? "" : "s"}.`,
                    "success"
                );
            }

            return {
                success: true,
                notifications: result.notifications
            };
        })();

        try {
            return await initInFlight;
        } finally {
            initInFlight = null;
        }
    }

    const customerOrderNotificationsPage = {
        MODULE_NAME,
        normalizeText,
        resolveFirestore,
        resolveAuth,
        resolveAuthFns,
        resolveFirestoreFns,
        resolveOrderService,
        getFallbackRoutes,
        waitForAuthReady,
        mapNotificationRecord,
        fetchNotifications,
        markNotificationRead,
        applyReadStateToCard,
        setStatusMessage,
        buildOrderDetailUrl,
        createNotificationArticle,
        renderNotifications,
        init
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerOrderNotificationsPage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.customerOrderNotificationsPage = customerOrderNotificationsPage;
    }
})(typeof window !== "undefined" ? window : globalThis);
