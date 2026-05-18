(function attachCustomerOrderNotificationsPage(globalScope) {
    "use strict";

    const MODULE_NAME = "customer/order-tracking/notifications";
    const DEFAULT_PAGE_SIZE = 6;
    const DEFAULT_SORT = "newest";
    let initInFlight = null;
    const pageState = {
        allNotifications: [],
        filters: {
            search: "",
            read: "all",
            type: "all",
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

        const markButton = article.querySelector('button[data-action-type="mark_read"]');
        if (markButton) {
            markButton.remove();
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
            const target = pageState.allNotifications.find(function matchesId(item) {
                return item && item.notificationId === notification.notificationId;
            });
            if (target) {
                target.read = true;
            }

            if (typeof options.onReadStateChange === "function") {
                try {
                    options.onReadStateChange();
                } catch (callbackError) {
                    // Callback errors should not break the click handler.
                }
            }

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
            message.textContent = normalizeText(options.emptyMessage)
                || "You do not have any notifications yet.";
            container.appendChild(message);
            return;
        }

        safeNotifications.forEach(function appendNotification(notification) {
            container.appendChild(createNotificationArticle(notification, options));
        });
    }

    function getNotificationTimestamp(notificationRecord) {
        const safe = notificationRecord && typeof notificationRecord === "object" ? notificationRecord : {};
        const value = safe.createdAt || safe.updatedAt;

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

    function sortNotifications(notifications, sortKey) {
        const safe = Array.isArray(notifications) ? notifications.slice() : [];
        const key = normalizeText(sortKey).toLowerCase() || DEFAULT_SORT;

        if (key === "oldest") {
            safe.sort(function byOldest(a, b) {
                return getNotificationTimestamp(a) - getNotificationTimestamp(b);
            });
            return safe;
        }

        if (key === "unread-first") {
            safe.sort(function byUnreadFirst(a, b) {
                const aRead = a && (a.read === true || a.isRead === true) ? 1 : 0;
                const bRead = b && (b.read === true || b.isRead === true) ? 1 : 0;
                if (aRead !== bRead) {
                    return aRead - bRead;
                }
                return getNotificationTimestamp(b) - getNotificationTimestamp(a);
            });
            return safe;
        }

        safe.sort(function byNewest(a, b) {
            return getNotificationTimestamp(b) - getNotificationTimestamp(a);
        });
        return safe;
    }

    function filterNotifications(notifications, filters = {}) {
        const safe = Array.isArray(notifications) ? notifications : [];
        const searchTerm = normalizeText(filters.search).toLowerCase();
        const readFilter = normalizeText(filters.read).toLowerCase() || "all";
        const typeFilter = normalizeText(filters.type).toLowerCase() || "all";

        return safe.filter(function byFilters(notification) {
            if (!notification) {
                return false;
            }

            const isRead = notification.read === true || notification.isRead === true;

            if (readFilter === "read" && !isRead) {
                return false;
            }

            if (readFilter === "unread" && isRead) {
                return false;
            }

            if (typeFilter !== "all") {
                const itemType = normalizeText(notification.type).toLowerCase();
                if (itemType !== typeFilter) {
                    return false;
                }
            }

            if (searchTerm) {
                const title = normalizeText(notification.title).toLowerCase();
                const messageText = normalizeText(notification.message).toLowerCase();
                const orderId = normalizeText(notification.orderId).toLowerCase();
                const notificationId = normalizeText(notification.notificationId).toLowerCase();
                if (
                    title.indexOf(searchTerm) === -1 &&
                    messageText.indexOf(searchTerm) === -1 &&
                    orderId.indexOf(searchTerm) === -1 &&
                    notificationId.indexOf(searchTerm) === -1
                ) {
                    return false;
                }
            }

            return true;
        });
    }

    function paginateNotifications(notifications, page, pageSize) {
        const safe = Array.isArray(notifications) ? notifications : [];
        const size = Number.isFinite(Number(pageSize)) && Number(pageSize) > 0
            ? Math.floor(Number(pageSize))
            : DEFAULT_PAGE_SIZE;
        const totalPages = Math.max(1, Math.ceil(safe.length / size));
        const safePage = Math.min(Math.max(1, Math.floor(Number(page) || 1)), totalPages);
        const start = (safePage - 1) * size;
        const pageItems = safe.slice(start, start + size);

        return {
            pageNotifications: pageItems,
            page: safePage,
            pageSize: size,
            totalPages,
            totalCount: safe.length
        };
    }

    function buildResultSummary(filteredCount, totalCount, unreadCount) {
        if (totalCount === 0) {
            return "";
        }

        const unreadSuffix = Number.isFinite(Number(unreadCount)) && Number(unreadCount) > 0
            ? ` (${unreadCount} unread)`
            : "";

        if (filteredCount === totalCount) {
            return `Showing all ${totalCount} notification${totalCount === 1 ? "" : "s"}${unreadSuffix}.`;
        }

        return `Showing ${filteredCount} of ${totalCount} notification${totalCount === 1 ? "" : "s"}${unreadSuffix}.`;
    }

    function countUnread(notifications) {
        const safe = Array.isArray(notifications) ? notifications : [];
        let count = 0;
        for (let i = 0; i < safe.length; i += 1) {
            const item = safe[i];
            if (item && (item.read === true || item.isRead === true)) {
                continue;
            }
            count += 1;
        }
        return count;
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

    function populateTypeFilter(form, notifications) {
        if (!form) {
            return;
        }
        const select = form.querySelector('select[name="type"]');
        if (!select) {
            return;
        }

        const previousValue = normalizeText(select.value) || "all";
        const safe = Array.isArray(notifications) ? notifications : [];
        const types = new Set();
        safe.forEach(function collectTypes(notification) {
            const itemType = normalizeText(notification && notification.type).toLowerCase();
            if (itemType) {
                types.add(itemType);
            }
        });

        while (select.options.length > 1) {
            select.remove(1);
        }

        Array.from(types).sort().forEach(function addOption(typeValue) {
            const option = globalScope.document.createElement("option");
            option.value = typeValue;
            option.textContent = typeValue
                .split(/[_-]+/)
                .map(function capitalize(word) {
                    return word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
                })
                .join(" ");
            select.appendChild(option);
        });

        if (Array.from(select.options).some(function matches(opt) { return opt.value === previousValue; })) {
            select.value = previousValue;
        } else {
            select.value = "all";
        }
    }

    function updateBulkActions(bulkButton, unreadCount) {
        if (!bulkButton) {
            return;
        }

        if (Number(unreadCount) > 0) {
            bulkButton.removeAttribute("hidden");
            bulkButton.textContent = `Mark all as read (${unreadCount})`;
            bulkButton.disabled = false;
        } else {
            bulkButton.setAttribute("hidden", "");
        }
    }

    function renderCurrentPage(elements, options = {}) {
        const container = elements && elements.container;
        if (!container) {
            return null;
        }

        const filtered = filterNotifications(pageState.allNotifications, pageState.filters);
        const sorted = sortNotifications(filtered, pageState.filters.sort);
        const paginated = paginateNotifications(sorted, pageState.currentPage, pageState.pageSize);
        pageState.currentPage = paginated.page;

        const hasNotifications = pageState.allNotifications.length > 0;
        const emptyMessage = hasNotifications
            ? "No notifications match your filters. Try clearing them to see more."
            : "You do not have any notifications yet.";

        renderNotifications(paginated.pageNotifications, container, {
            ...options,
            emptyMessage,
            onReadStateChange: function onReadStateChange() {
                renderCurrentPage(elements, options);
            }
        });

        const unreadCount = countUnread(pageState.allNotifications);

        if (elements.summary) {
            elements.summary.textContent = buildResultSummary(
                sorted.length,
                pageState.allNotifications.length,
                unreadCount
            );
        }

        updateBulkActions(elements.bulkMarkAllButton, unreadCount);
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
            read: normalizeText(data.get("read")) || "all",
            type: normalizeText(data.get("type")) || "all",
            sort: normalizeText(data.get("sort")) || DEFAULT_SORT
        };
    }

    async function markAllAsRead(elements, options = {}) {
        const unread = pageState.allNotifications.filter(function isUnread(item) {
            return item && item.read !== true && item.isRead !== true;
        });

        if (unread.length === 0) {
            return;
        }

        if (elements.bulkMarkAllButton) {
            elements.bulkMarkAllButton.disabled = true;
        }

        unread.forEach(function setLocal(item) {
            item.read = true;
        });

        renderCurrentPage(elements, options);

        await Promise.all(unread.map(function persistOne(item) {
            return markNotificationRead(item.notificationId, options).catch(function onError(error) {
                console.warn(`${MODULE_NAME}: bulk mark-as-read failed for ${item.notificationId}.`, error);
            });
        }));
    }

    function attachToolbarHandlers(elements, options = {}) {
        const form = elements && elements.form;

        if (form && !form.dataset.notificationsFormBound) {
            form.dataset.notificationsFormBound = "true";

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
                        read: "all",
                        type: "all",
                        sort: DEFAULT_SORT
                    };
                    pageState.currentPage = 1;
                    renderCurrentPage(elements, options);
                }, 0);
            });
        }

        const pagination = elements && elements.pagination;

        if (pagination && !pagination.dataset.notificationsPaginationBound) {
            pagination.dataset.notificationsPaginationBound = "true";

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

        const bulkButton = elements && elements.bulkMarkAllButton;
        if (bulkButton && !bulkButton.dataset.notificationsBulkBound) {
            bulkButton.dataset.notificationsBulkBound = "true";
            bulkButton.addEventListener("click", function onMarkAll() {
                markAllAsRead(elements, options);
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
            const containerSelector = options.containerSelector || "#notifications-container";
            const statusSelector = options.statusSelector || "#order-tracking-notifications-status";

            const container = globalScope.document.querySelector(containerSelector);
            const statusElement = globalScope.document.querySelector(statusSelector);
            const summaryElement = globalScope.document.querySelector(
                options.summarySelector || "#notifications-results-summary"
            );
            const formElement = globalScope.document.querySelector(
                options.formSelector || "#notifications-filter-form"
            );
            const paginationElement = globalScope.document.querySelector(
                options.paginationSelector || "#notifications-pagination"
            );
            const paginationStatusElement = globalScope.document.querySelector(
                options.paginationStatusSelector || "#notifications-pagination-status"
            );
            const bulkMarkAllButton = globalScope.document.querySelector(
                options.bulkMarkAllSelector || "#notifications-mark-all-read"
            );

            if (!container) {
                return {
                    success: false,
                    error: "Notifications container not found."
                };
            }

            const elements = {
                container,
                summary: summaryElement,
                form: formElement,
                pagination: paginationElement,
                paginationStatus: paginationStatusElement,
                bulkMarkAllButton
            };

            const initialFilters = readFiltersFromForm(formElement);
            if (initialFilters) {
                pageState.filters = initialFilters;
            } else {
                pageState.filters = {
                    search: "",
                    read: "all",
                    type: "all",
                    sort: DEFAULT_SORT
                };
            }
            pageState.currentPage = 1;
            pageState.pageSize = Number(options.pageSize) > 0
                ? Math.floor(Number(options.pageSize))
                : DEFAULT_PAGE_SIZE;

            setStatusMessage(statusElement, "Loading your notifications...", "loading");

            const currentUser = options.currentUser || await waitForAuthReady(auth, authFns);

            if (!currentUser || !normalizeText(currentUser.uid)) {
                pageState.allNotifications = [];
                renderNotifications([], container);
                if (summaryElement) {
                    summaryElement.textContent = "";
                }
                if (paginationElement) {
                    paginationElement.setAttribute("hidden", "");
                }
                if (bulkMarkAllButton) {
                    bulkMarkAllButton.setAttribute("hidden", "");
                }
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
                pageState.allNotifications = [];
                renderNotifications([], container);
                if (summaryElement) {
                    summaryElement.textContent = "";
                }
                if (paginationElement) {
                    paginationElement.setAttribute("hidden", "");
                }
                if (bulkMarkAllButton) {
                    bulkMarkAllButton.setAttribute("hidden", "");
                }
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

            pageState.allNotifications = Array.isArray(result.notifications)
                ? result.notifications.map(function mapAndKeep(notification) {
                    return mapNotificationRecord(notification);
                })
                : [];

            populateTypeFilter(formElement, pageState.allNotifications);
            attachToolbarHandlers(elements, { db, firestoreFns });
            renderCurrentPage(elements, { db, firestoreFns });

            const unread = countUnread(pageState.allNotifications);

            if (pageState.allNotifications.length === 0) {
                setStatusMessage(statusElement, "You do not have any notifications yet.", "info");
            } else {
                const total = pageState.allNotifications.length;
                const unreadSuffix = unread > 0 ? ` (${unread} unread)` : "";
                setStatusMessage(
                    statusElement,
                    `You have ${total} notification${total === 1 ? "" : "s"}${unreadSuffix}.`,
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
        DEFAULT_PAGE_SIZE,
        DEFAULT_SORT,
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
        getNotificationTimestamp,
        sortNotifications,
        filterNotifications,
        paginateNotifications,
        buildResultSummary,
        countUnread,
        init
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerOrderNotificationsPage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.customerOrderNotificationsPage = customerOrderNotificationsPage;
    }
})(typeof window !== "undefined" ? window : globalThis);
