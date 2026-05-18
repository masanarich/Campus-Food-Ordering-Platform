(function attachVendorOrderManagementPage(globalScope) {
    "use strict";

    const MODULE_NAME = "vendor/order-management/index";
    const DEFAULT_PAGE_SIZE = 6;
    const DEFAULT_SORT = "newest";
    const DEFAULT_PAYMENT_FILTER = "paid";
    const INCOMING_STATUSES = ["pending", "accepted"];
    const BLOCKED_PAYMENT_STATUSES = ["unpaid", "pending", "failed"];
    let initInFlight = null;
    const pageState = {
        allOrders: [],
        filters: {
            search: "",
            status: "all",
            payment: DEFAULT_PAYMENT_FILTER,
            sort: DEFAULT_SORT
        },
        currentPage: 1,
        pageSize: DEFAULT_PAGE_SIZE
    };

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

    function normalizePaymentState(orderRecord, options = {}) {
        const safeOrder = orderRecord && typeof orderRecord === "object" ? orderRecord : {};
        const paymentStatus = resolvePaymentStatus(options.paymentStatus);
        const rawPaymentStatus = normalizeText(safeOrder.paymentStatus);

        if (paymentStatus && typeof paymentStatus.normalizePaymentStatus === "function") {
            return paymentStatus.normalizePaymentStatus(rawPaymentStatus, "unpaid");
        }

        return rawPaymentStatus.toLowerCase() || "unpaid";
    }

    function isPaidOrder(orderRecord, options = {}) {
        const normalizedStatus = normalizePaymentState(orderRecord, options);
        const paymentStatus = resolvePaymentStatus(options.paymentStatus);

        if (paymentStatus && typeof paymentStatus.isPaymentPaid === "function") {
            return paymentStatus.isPaymentPaid(normalizedStatus);
        }

        return normalizedStatus === "paid";
    }

    function isPaymentBlockedOrder(orderRecord, options = {}) {
        const normalizedStatus = normalizePaymentState(orderRecord, options);
        const paymentStatus = resolvePaymentStatus(options.paymentStatus);

        if (paymentStatus && typeof paymentStatus.isPaymentBlockingOrder === "function") {
            return paymentStatus.isPaymentBlockingOrder(normalizedStatus);
        }

        return !isPaidOrder(orderRecord, options) &&
            BLOCKED_PAYMENT_STATUSES.indexOf(normalizedStatus) >= 0;
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
        const paymentStatus = resolvePaymentStatus(options.paymentStatus);
        const paymentFormatters = resolvePaymentFormatters(options.paymentFormatters);
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

        const normalizedPaymentStatus = normalizePaymentState(safeOrder, options);
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
            customerName: normalizeText(safeOrder.customerName) || "Customer",
            itemCount: Number.isFinite(Number(safeOrder.itemCount)) ? Number(safeOrder.itemCount) : 0,
            totalText,
            status: normalizedStatus,
            statusLabel,
            tone,
            summaryText,
            updatedText,
            paymentStatus: normalizedPaymentStatus,
            paymentStatusLabel,
            paymentTone,
            paymentAmount,
            paymentAmountText,
            paymentCurrency,
            paymentReference: normalizeText(safeOrder.paymentReference),
            paymentProvider: normalizeText(safeOrder.paymentProvider) || "paystack",
            isPaid: isPaidOrder(safeOrder, options),
            isPaymentBlocked: isPaymentBlockedOrder(safeOrder, options),
            paymentGuardMessage: normalizedPaymentStatus === "paid"
                ? ""
                : "Payment is not confirmed. Do not accept, prepare, or fulfil this order until payment is completed."
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
        article.setAttribute("data-status", order.status);
        article.setAttribute("data-payment-status", order.paymentStatus);
        article.setAttribute("data-fulfillment-ready", order.isPaid ? "true" : "false");

        if (order.isPaymentBlocked) {
            article.classList.add("vendor-order-card-payment-blocked");
        }

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

        const paymentStatusLine = globalScope.document.createElement("p");
        paymentStatusLine.className = "vendor-order-card-payment-status";
        paymentStatusLine.textContent = `Payment: ${order.paymentStatusLabel}`;
        paymentStatusLine.setAttribute("data-tone", order.paymentTone);
        paymentStatusLine.setAttribute("data-payment-status", order.paymentStatus);

        const paymentAmountLine = globalScope.document.createElement("p");
        paymentAmountLine.className = "vendor-order-card-payment-amount";
        paymentAmountLine.textContent = `Payment Amount: ${order.paymentAmountText}`;

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
        article.appendChild(paymentStatusLine);
        article.appendChild(paymentAmountLine);

        if (order.paymentGuardMessage) {
            const guardLine = globalScope.document.createElement("p");
            guardLine.className = "vendor-order-card-payment-guard";
            guardLine.textContent = order.paymentGuardMessage;
            guardLine.setAttribute("data-payment-status", order.paymentStatus);
            article.appendChild(guardLine);
        }

        if (order.paymentReference) {
            const paymentReferenceLine = globalScope.document.createElement("p");
            paymentReferenceLine.className = "vendor-order-card-payment-reference";
            paymentReferenceLine.textContent = `Reference: ${order.paymentReference}`;
            article.appendChild(paymentReferenceLine);
        }

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
            return activeStatuses.indexOf(status) >= 0 && isPaidOrder(order, options);
        }).length;
        const readyCount = safeOrders.filter(function keepReady(order) {
            return normalizeLowerText(order && order.status) === "ready" && isPaidOrder(order, options);
        }).length;
        const paidOrders = safeOrders.filter(function keepPaidOrder(order) {
            return isPaidOrder(order, options);
        });
        const totalValue = paidOrders.reduce(function sumOrderTotals(total, order) {
            return total + Number(order && order.total ? order.total : 0);
        }, 0);
        const totalValueText =
            orderFormatters && typeof orderFormatters.formatCurrency === "function"
                ? orderFormatters.formatCurrency(totalValue)
                : `R${totalValue.toFixed(2)}`;
        const paidCount = paidOrders.length;
        const unpaidCount = safeOrders.length - paidCount;
        const summaryList = globalScope.document.createElement("ol");

        [
            `Vendor: ${normalizeText(vendorProfile && vendorProfile.displayName) || "Vendor User"}`,
            `Orders loaded: ${safeOrders.length}`,
            `Fulfilment-ready paid orders: ${paidCount}`,
            `Active paid orders: ${activeCount}`,
            `Ready for pickup: ${readyCount}`,
            `Blocked unpaid records: ${unpaidCount}`,
            `Paid order value: ${totalValueText}`
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
            message.textContent = normalizeText(options.emptyMessage)
                || "There are no vendor orders to manage right now.";
            container.appendChild(message);
            return;
        }

        safeOrders.forEach(function appendOrder(order) {
            container.appendChild(createOrderCard(order, options));
        });
    }

    function getOrderTimestamp(orderRecord) {
        const safe = orderRecord && typeof orderRecord === "object" ? orderRecord : {};
        const value = safe.updatedAt || safe.createdAt;

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
        const safe = Array.isArray(orders) ? orders.slice() : [];
        const key = normalizeLowerText(sortKey) || DEFAULT_SORT;

        if (key === "oldest") {
            safe.sort(function byOldest(a, b) {
                return getOrderTimestamp(a) - getOrderTimestamp(b);
            });
            return safe;
        }

        if (key === "price-desc") {
            safe.sort(function byPriceDesc(a, b) {
                return Number(b && b.total || 0) - Number(a && a.total || 0);
            });
            return safe;
        }

        if (key === "price-asc") {
            safe.sort(function byPriceAsc(a, b) {
                return Number(a && a.total || 0) - Number(b && b.total || 0);
            });
            return safe;
        }

        if (key === "customer-asc") {
            safe.sort(function byCustomerAsc(a, b) {
                return normalizeLowerText(a && a.customerName).localeCompare(
                    normalizeLowerText(b && b.customerName)
                );
            });
            return safe;
        }

        if (key === "customer-desc") {
            safe.sort(function byCustomerDesc(a, b) {
                return normalizeLowerText(b && b.customerName).localeCompare(
                    normalizeLowerText(a && a.customerName)
                );
            });
            return safe;
        }

        safe.sort(function byNewest(a, b) {
            return getOrderTimestamp(b) - getOrderTimestamp(a);
        });
        return safe;
    }

    function filterOrders(orders, filters = {}) {
        const safe = Array.isArray(orders) ? orders : [];
        const searchTerm = normalizeLowerText(filters.search);
        const statusFilter = normalizeLowerText(filters.status) || "all";
        const paymentFilter = normalizeLowerText(filters.payment) || DEFAULT_PAYMENT_FILTER;

        return safe.filter(function byFilters(order) {
            if (!order) {
                return false;
            }

            const orderStatus = normalizeLowerText(order.status);

            if (statusFilter === "incoming") {
                if (INCOMING_STATUSES.indexOf(orderStatus) < 0) {
                    return false;
                }
            } else if (statusFilter !== "all" && orderStatus !== statusFilter) {
                return false;
            }

            const paymentStatusValue = normalizePaymentState(order, filters);
            const paymentStatus = resolvePaymentStatus(filters.paymentStatus);

            if (paymentFilter === "blocked") {
                if (
                    paymentStatus && typeof paymentStatus.isPaymentBlockingOrder === "function"
                        ? !paymentStatus.isPaymentBlockingOrder(paymentStatusValue)
                        : BLOCKED_PAYMENT_STATUSES.indexOf(paymentStatusValue) < 0
                ) {
                    return false;
                }
            } else if (paymentFilter !== "all" && paymentStatusValue !== paymentFilter) {
                return false;
            }

            if (searchTerm) {
                const customer = normalizeLowerText(order.customerName);
                const orderId = normalizeLowerText(order.orderId);
                const reference = normalizeLowerText(order.paymentReference);
                if (
                    customer.indexOf(searchTerm) === -1 &&
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
        const safe = Array.isArray(orders) ? orders : [];
        const size = Number.isFinite(Number(pageSize)) && Number(pageSize) > 0
            ? Math.floor(Number(pageSize))
            : DEFAULT_PAGE_SIZE;
        const totalPages = Math.max(1, Math.ceil(safe.length / size));
        const safePage = Math.min(Math.max(1, Math.floor(Number(page) || 1)), totalPages);
        const start = (safePage - 1) * size;
        const pageItems = safe.slice(start, start + size);

        return {
            pageOrders: pageItems,
            page: safePage,
            pageSize: size,
            totalPages,
            totalCount: safe.length
        };
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

    function updateQuickFilterActiveState(quickFiltersElement, filters) {
        if (!quickFiltersElement) {
            return;
        }

        const buttons = quickFiltersElement.querySelectorAll("[data-quick-filter]");
        const status = normalizeLowerText(filters && filters.status) || "all";
        const payment = normalizeLowerText(filters && filters.payment) || DEFAULT_PAYMENT_FILTER;
        let activeKey;

        if (payment === "paid" && status === "all") {
            activeKey = "paid";
        } else if (payment === "blocked" && status === "all") {
            activeKey = "blocked-payment";
        } else if (status === "all" && payment === "all") {
            activeKey = "all";
        } else if (status === "incoming" && payment === DEFAULT_PAYMENT_FILTER) {
            activeKey = "incoming";
        } else if (status === "preparing" && payment === DEFAULT_PAYMENT_FILTER) {
            activeKey = "preparing";
        } else if (status === "ready" && payment === DEFAULT_PAYMENT_FILTER) {
            activeKey = "ready";
        } else if (status === "cancelled" && payment === DEFAULT_PAYMENT_FILTER) {
            activeKey = "cancelled";
        } else {
            activeKey = null;
        }

        buttons.forEach(function syncButton(button) {
            const key = button.getAttribute("data-quick-filter");
            if (key === activeKey) {
                button.setAttribute("aria-pressed", "true");
                button.dataset.active = "true";
            } else {
                button.setAttribute("aria-pressed", "false");
                delete button.dataset.active;
            }
        });
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
            : "There are no vendor orders to manage right now.";

        renderOrders(paginated.pageOrders, container, {
            ...options,
            emptyMessage
        });

        if (elements.resultsSummary) {
            elements.resultsSummary.textContent = buildResultSummary(
                sorted.length,
                pageState.allOrders.length
            );
        }

        updateQuickFilterActiveState(elements.quickFilters, pageState.filters);
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

    function applyQuickFilter(form, quickFilterKey) {
        if (!form) {
            return null;
        }

        const statusSelect = form.querySelector('select[name="status"]');
        const paymentSelect = form.querySelector('select[name="payment"]');
        const key = normalizeLowerText(quickFilterKey);

        if (!statusSelect || !paymentSelect) {
            return null;
        }

        switch (key) {
            case "all":
                statusSelect.value = "all";
                paymentSelect.value = DEFAULT_PAYMENT_FILTER;
                break;
            case "incoming":
                statusSelect.value = "incoming";
                paymentSelect.value = DEFAULT_PAYMENT_FILTER;
                break;
            case "preparing":
                statusSelect.value = "preparing";
                paymentSelect.value = DEFAULT_PAYMENT_FILTER;
                break;
            case "ready":
                statusSelect.value = "ready";
                paymentSelect.value = DEFAULT_PAYMENT_FILTER;
                break;
            case "cancelled":
                statusSelect.value = "cancelled";
                paymentSelect.value = DEFAULT_PAYMENT_FILTER;
                break;
            case "paid":
                statusSelect.value = "all";
                paymentSelect.value = "paid";
                break;
            case "blocked-payment":
                statusSelect.value = "all";
                paymentSelect.value = "blocked";
                break;
            default:
                return null;
        }

        return readFiltersFromForm(form);
    }

    function attachToolbarHandlers(elements, options = {}) {
        const form = elements && elements.form;

        if (form && !form.dataset.vendorOrdersFormBound) {
            form.dataset.vendorOrdersFormBound = "true";

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
                        payment: DEFAULT_PAYMENT_FILTER,
                        sort: DEFAULT_SORT
                    };
                    pageState.currentPage = 1;
                    renderCurrentPage(elements, options);
                }, 0);
            });
        }

        const pagination = elements && elements.pagination;

        if (pagination && !pagination.dataset.vendorOrdersPaginationBound) {
            pagination.dataset.vendorOrdersPaginationBound = "true";

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

        const quickFilters = elements && elements.quickFilters;

        if (quickFilters && !quickFilters.dataset.vendorOrdersQuickFiltersBound) {
            quickFilters.dataset.vendorOrdersQuickFiltersBound = "true";

            quickFilters.addEventListener("click", function onQuickFilterClick(event) {
                const target = event.target.closest("[data-quick-filter]");
                if (!target) {
                    return;
                }

                const next = applyQuickFilter(form, target.getAttribute("data-quick-filter"));
                if (next) {
                    pageState.filters = next;
                    pageState.currentPage = 1;
                    renderCurrentPage(elements, options);
                }
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
            const statusElement = globalScope.document.querySelector(
                options.statusSelector || "#vendor-order-management-status"
            );
            const summaryElement = globalScope.document.querySelector(
                options.summarySelector || "#vendor-order-management-summary"
            );
            const container = globalScope.document.querySelector(
                options.containerSelector || "#vendor-orders-container"
            );
            const resultsSummaryElement = globalScope.document.querySelector(
                options.resultsSummarySelector || "#vendor-orders-results-summary"
            );
            const formElement = globalScope.document.querySelector(
                options.formSelector || "#vendor-orders-filter-form"
            );
            const paginationElement = globalScope.document.querySelector(
                options.paginationSelector || "#vendor-orders-pagination"
            );
            const paginationStatusElement = globalScope.document.querySelector(
                options.paginationStatusSelector || "#vendor-orders-pagination-status"
            );
            const quickFiltersElement = globalScope.document.querySelector(
                options.quickFiltersSelector || ".vendor-orders-quick-filters"
            );

            if (!summaryElement || !container) {
                return {
                    success: false,
                    error: "Vendor order management containers not found."
                };
            }

            const elements = {
                container,
                resultsSummary: resultsSummaryElement,
                form: formElement,
                pagination: paginationElement,
                paginationStatus: paginationStatusElement,
                quickFilters: quickFiltersElement
            };

            const initialFilters = readFiltersFromForm(formElement);
            if (initialFilters) {
                pageState.filters = initialFilters;
            } else {
                pageState.filters = {
                    search: "",
                    status: "all",
                    payment: DEFAULT_PAYMENT_FILTER,
                    sort: DEFAULT_SORT
                };
            }
            pageState.currentPage = 1;
            pageState.pageSize = Number(options.pageSize) > 0
                ? Math.floor(Number(options.pageSize))
                : DEFAULT_PAGE_SIZE;

            setStatusMessage(statusElement, "Loading your vendor orders...", "loading");

            const currentUser = options.currentUser || await waitForAuthReady(auth, authFns);

            if (!currentUser || !normalizeText(currentUser.uid)) {
                pageState.allOrders = [];
                renderSummary(summaryElement, [], null, options);
                renderOrders([], container, options);
                if (resultsSummaryElement) {
                    resultsSummaryElement.textContent = "";
                }
                if (paginationElement) {
                    paginationElement.setAttribute("hidden", "");
                }
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
                pageState.allOrders = [];
                renderSummary(summaryElement, [], vendorProfile, options);
                renderOrders([], container, options);
                if (resultsSummaryElement) {
                    resultsSummaryElement.textContent = "";
                }
                if (paginationElement) {
                    paginationElement.setAttribute("hidden", "");
                }
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
                pageState.allOrders = [];
                renderSummary(summaryElement, [], vendorProfile, options);
                renderOrders([], container, options);
                if (resultsSummaryElement) {
                    resultsSummaryElement.textContent = "";
                }
                if (paginationElement) {
                    paginationElement.setAttribute("hidden", "");
                }
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

            pageState.allOrders = Array.isArray(result.orders) ? result.orders.slice() : [];

            renderSummary(summaryElement, pageState.allOrders, vendorProfile, options);

            if (formElement || paginationElement || quickFiltersElement) {
                attachToolbarHandlers(elements, options);
                renderCurrentPage(elements, options);
            } else {
                renderOrders(pageState.allOrders, container, options);
            }

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
        DEFAULT_PAGE_SIZE,
        DEFAULT_SORT,
        DEFAULT_PAYMENT_FILTER,
        INCOMING_STATUSES,
        BLOCKED_PAYMENT_STATUSES,
        normalizeText,
        normalizeLowerText,
        resolveFirestore,
        resolveAuth,
        resolveAuthFns,
        resolveFirestoreFns,
        resolveOrderService,
        resolveOrderStatus,
        resolveOrderFormatters,
        resolvePaymentStatus,
        resolvePaymentFormatters,
        normalizePaymentState,
        isPaidOrder,
        isPaymentBlockedOrder,
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
        getOrderTimestamp,
        sortOrders,
        filterOrders,
        paginateOrders,
        buildResultSummary,
        applyQuickFilter,
        init
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = vendorOrderManagementPage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.vendorOrderManagementPage = vendorOrderManagementPage;
    }
})(typeof window !== "undefined" ? window : globalThis);
