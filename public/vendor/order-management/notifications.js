(function attachVendorOrderNotificationsPage(globalScope) {
    "use strict";

    const MODULE_NAME = "vendor/order-management/notifications";
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
        if (explicitOrderService && typeof explicitOrderService.getNotifications === "function") {
            return explicitOrderService;
        }

        if (globalScope.orderService && typeof globalScope.orderService.getNotifications === "function") {
            return globalScope.orderService;
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
                    code: "missing-recipient",
                    message: "A signed-in vendor is required."
                }
            };
        }

        if (orderService && db) {
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
                    message: "Vendor notification access is not available right now."
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
                    message: normalizeText(error && error.message) || "Failed to load vendor notifications."
                }
            };
        }
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

        const stateLine = article.querySelector(".vendor-notification-state");

        if (stateLine) {
            stateLine.textContent = "Read";
            stateLine.setAttribute("data-tone", "info");
        }
    }

    function filterVendorNotifications(notifications) {
        const safeNotifications = Array.isArray(notifications) ? notifications : [];

        return safeNotifications.filter(function keepVendorNotification(notification) {
            return normalizeLowerText(notification && notification.recipientRole) === "vendor";
        });
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

    function createNotificationCard(notificationRecord, options = {}) {
        const safeNotification = notificationRecord && typeof notificationRecord === "object"
            ? notificationRecord
            : {};
        const isRead = safeNotification.read === true || safeNotification.isRead === true;
        const notificationId = normalizeText(safeNotification.notificationId);
        const article = globalScope.document.createElement("article");
        article.className = "vendor-notification-card";
        article.setAttribute("data-notification-id", notificationId);
        article.setAttribute("data-read", isRead ? "true" : "false");

        const heading = globalScope.document.createElement("h4");
        heading.className = "vendor-notification-heading";
        heading.textContent = normalizeText(safeNotification.title) || "Order Update";

        const message = globalScope.document.createElement("p");
        message.className = "vendor-notification-message";
        message.textContent = normalizeText(safeNotification.message) || "There is a new update for this order.";

        const state = globalScope.document.createElement("p");
        state.className = "vendor-notification-state";
        state.textContent = isRead ? "Read" : "Unread";
        state.setAttribute("data-tone", isRead ? "info" : "success");

        article.appendChild(heading);
        article.appendChild(message);
        article.appendChild(state);

        function persistReadState() {
            if (article.getAttribute("data-read") === "true") {
                return Promise.resolve();
            }

            applyReadStateToCard(article);

            return markNotificationRead(notificationId, options)
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

        const actions = globalScope.document.createElement("menu");
        actions.className = "action-menu vendor-notification-actions";
        actions.setAttribute("aria-label", `${heading.textContent} actions`);

        if (normalizeText(safeNotification.orderId)) {
            const item = globalScope.document.createElement("li");
            const link = globalScope.document.createElement("a");
            link.href = buildOrderDetailUrl(safeNotification.orderId);
            link.textContent = "Open Order";
            link.addEventListener("click", async function onOpenOrder(event) {
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
                navigateAfterRead(link.href);
            });
            item.appendChild(link);
            actions.appendChild(item);
        }

        if (!isRead) {
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
            message.textContent = "There are no vendor notifications to review right now.";
            container.appendChild(message);
            return;
        }

        safeNotifications.forEach(function appendNotification(notification) {
            container.appendChild(createNotificationCard(notification, options));
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
                options.statusSelector || "#vendor-order-notifications-status"
            );
            const container = globalScope.document.querySelector(
                options.containerSelector || "#vendor-notifications-container"
            );

            if (!container) {
                return {
                    success: false,
                    error: "Vendor notification container not found."
                };
            }

            setStatusMessage(statusElement, "Loading your vendor notifications...", "loading");

            const currentUser = options.currentUser || await waitForAuthReady(auth, authFns);

            if (!currentUser || !normalizeText(currentUser.uid)) {
                renderNotifications([], container);
                setStatusMessage(statusElement, "Please sign in to review vendor notifications.", "error");
                return {
                    success: false,
                    error: "Please sign in to review vendor notifications."
                };
            }

            const vendorProfile = await fetchVendorProfile({
                ...options,
                db,
                firestoreFns,
                currentUser
            });

            if (!canAccessVendorWorkspace(vendorProfile)) {
                renderNotifications([], container);
                setStatusMessage(statusElement, "You do not have vendor notification access right now.", "error");
                return {
                    success: false,
                    error: "You do not have vendor notification access right now."
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
                        : "Failed to load vendor notifications.",
                    "error"
                );
                return {
                    success: false,
                    error: result.error && result.error.message
                        ? result.error.message
                        : "Failed to load vendor notifications."
                };
            }

            const vendorNotifications = filterVendorNotifications(result.notifications);
            renderNotifications(vendorNotifications, container, {
                db,
                firestoreFns
            });

            if (vendorNotifications.length === 0) {
                setStatusMessage(statusElement, "There are no vendor notifications to review right now.", "info");
            } else {
                setStatusMessage(
                    statusElement,
                    `Loaded ${vendorNotifications.length} vendor notification${vendorNotifications.length === 1 ? "" : "s"}.`,
                    "success"
                );
            }

            return {
                success: true,
                vendorProfile,
                notifications: vendorNotifications
            };
        })();

        try {
            return await initInFlight;
        } finally {
            initInFlight = null;
        }
    }

    const vendorOrderNotificationsPage = {
        MODULE_NAME,
        normalizeText,
        normalizeLowerText,
        resolveFirestore,
        resolveAuth,
        resolveAuthFns,
        resolveFirestoreFns,
        resolveOrderService,
        waitForAuthReady,
        normalizeVendorProfile,
        canAccessVendorWorkspace,
        fetchVendorProfile,
        fetchNotifications,
        filterVendorNotifications,
        markNotificationRead,
        applyReadStateToCard,
        setStatusMessage,
        buildOrderDetailUrl,
        createNotificationCard,
        renderNotifications,
        init
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = vendorOrderNotificationsPage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.vendorOrderNotificationsPage = vendorOrderNotificationsPage;
    }
})(typeof window !== "undefined" ? window : globalThis);
