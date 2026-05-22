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

    function resolveRatingsModel(explicit) {
        if (explicit && typeof explicit.validateReview === "function") {
            return explicit;
        }
        if (globalScope.ratingsModel && typeof globalScope.ratingsModel.validateReview === "function") {
            return globalScope.ratingsModel;
        }
        if (typeof require === "function") {
            try {
                return require("../../shared/ratings/ratings-model.js");
            } catch (error) {
                return null;
            }
        }
        return null;
    }

    function resolveRatingsService(explicit) {
        if (explicit && typeof explicit.submitReview === "function") {
            return explicit;
        }
        if (globalScope.ratingsService && typeof globalScope.ratingsService.submitReview === "function") {
            return globalScope.ratingsService;
        }
        if (typeof require === "function") {
            try {
                return require("../../shared/ratings/ratings-service.js");
            } catch (error) {
                return null;
            }
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

        const items = Array.isArray(safeOrder.items)
            ? safeOrder.items.map(function mapItem(rawItem) {
                const safeItem = rawItem && typeof rawItem === "object" ? rawItem : {};
                return {
                    menuItemId: normalizeText(safeItem.menuItemId || safeItem.id || safeItem.productId),
                    name: normalizeText(safeItem.name || safeItem.itemName || safeItem.title) || "Item",
                    quantity: Number.isFinite(Number(safeItem.quantity)) ? Number(safeItem.quantity) : 1,
                    photoURL: normalizeText(safeItem.photoURL || safeItem.imageUrl)
                };
            })
            : [];

        return {
            orderId: normalizeText(safeOrder.orderId || safeOrder.id),
            vendorUid: normalizeText(safeOrder.vendorUid),
            vendorName: normalizeText(safeOrder.vendorName) || "Unknown Vendor",
            itemCount: Number.isFinite(Number(safeOrder.itemCount)) ? Number(safeOrder.itemCount) : 0,
            items,
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
            updatedAt: safeOrder.updatedAt || safeOrder.createdAt || null,
            customerUid: normalizeText(safeOrder.customerUid),
            customerName: normalizeText(safeOrder.customerName)
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

    function canRateOrder(order) {
        if (!order || typeof order !== "object") {
            return false;
        }
        const status = normalizeText(order.status).toLowerCase();
        return status === "completed";
    }

    function getStarDisplay(rating, max = 5) {
        const safe = Math.max(0, Math.min(max, Math.round(Number(rating) || 0)));
        return "★".repeat(safe) + "☆".repeat(max - safe);
    }

    function buildRatingButton(order) {
        // The button gets a fixed dataset; the click handler attached on the
        // container delegates to the modal so we don't need a closure per row.
        const button = globalScope.document.createElement("button");
        button.type = "button";
        button.className = "button-secondary tracking-order-rate-button";
        button.setAttribute("data-action", "open-rate-modal");
        button.setAttribute("data-order-id", order.orderId);
        button.textContent = "Rate Order";
        return button;
    }

    function buildExistingReviewBadge(order, existingReview) {
        // When a customer revisits a completed order they've already rated,
        // we surface the stars they gave plus an "Edit" affordance.
        const wrap = globalScope.document.createElement("section");
        wrap.className = "tracking-order-rating-summary";

        const stars = globalScope.document.createElement("p");
        stars.className = "tracking-order-rating-stars";
        stars.textContent = `Your rating: ${getStarDisplay(existingReview.vendorRating)} (${existingReview.vendorRating}/5)`;
        wrap.appendChild(stars);

        if (existingReview.vendorComment) {
            const comment = globalScope.document.createElement("p");
            comment.className = "tracking-order-rating-comment";
            comment.textContent = `"${existingReview.vendorComment}"`;
            wrap.appendChild(comment);
        }

        return wrap;
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

        if (canRateOrder(order)) {
            const existingReview = options.existingReviews && options.existingReviews[order.orderId]
                ? options.existingReviews[order.orderId]
                : null;

            const rateItem = globalScope.document.createElement("li");
            const rateButton = buildRatingButton(order);
            if (existingReview) {
                rateButton.textContent = "Edit your rating";
                rateButton.setAttribute("data-has-review", "true");
            }
            rateItem.appendChild(rateButton);
            footer.appendChild(rateItem);
        }

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

        if (canRateOrder(order)) {
            const existingReview = options.existingReviews && options.existingReviews[order.orderId]
                ? options.existingReviews[order.orderId]
                : null;
            if (existingReview && existingReview.vendorRating) {
                article.appendChild(buildExistingReviewBadge(order, existingReview));
            }
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

    function buildRatingModal() {
        // Reuses one modal across all cards. We update its contents per-order
        // on open and parse the form on submit. The dialog is appended once on
        // first use to keep tear-down simple.
        let dialog = globalScope.document.getElementById("rating-modal");
        if (dialog) {
            return dialog;
        }
        dialog = globalScope.document.createElement("dialog");
        dialog.id = "rating-modal";
        dialog.className = "rating-modal";
        dialog.innerHTML = ""
            + '<form id="rating-form" class="rating-modal-card" method="dialog" novalidate>'
            +   '<header class="rating-modal-head">'
            +     '<h3 id="rating-modal-heading">Rate your order</h3>'
            +     '<p id="rating-modal-subheading" class="rating-modal-subheading"></p>'
            +     '<button id="rating-modal-close" type="button" class="button-secondary">Close</button>'
            +   '</header>'
            +   '<section class="rating-modal-body">'
            +     '<fieldset class="rating-vendor-block">'
            +       '<legend>How was the shop overall?</legend>'
            +       '<section id="rating-vendor-stars" class="rating-stars" aria-label="Shop star rating"></section>'
            +       '<label class="rating-comment-label" for="rating-vendor-comment">'
            +         '<strong>Comment (optional)</strong>'
            +         '<textarea id="rating-vendor-comment" name="vendorComment" maxlength="500" rows="3"></textarea>'
            +       '</label>'
            +     '</fieldset>'
            +     '<fieldset class="rating-items-block">'
            +       '<legend>Rate the items you ordered</legend>'
            +       '<ul id="rating-items-list" class="rating-items-list"></ul>'
            +     '</fieldset>'
            +     '<label class="rating-anonymous-row" for="rating-anonymous">'
            +       '<input id="rating-anonymous" name="isAnonymous" type="checkbox">'
            +       '<strong>Post this review anonymously</strong>'
            +     '</label>'
            +     '<p id="rating-error" class="rating-error" aria-live="polite" hidden></p>'
            +   '</section>'
            +   '<menu class="rating-modal-actions action-menu">'
            +     '<li><button id="rating-submit" type="submit" class="button-primary">Submit rating</button></li>'
            +     '<li><button id="rating-cancel" type="button" class="button-secondary">Cancel</button></li>'
            +   '</menu>'
            + '</form>';

        globalScope.document.body.appendChild(dialog);
        return dialog;
    }

    function applyStarFillStateToContainer(container, fillValue) {
        // Walk every star label in the container and turn the .is-filled
        // class on for the chosen star plus every lower-value star. We use
        // an explicit JS-driven class because `:has(:checked) ~ *` was not
        // applying consistently — driving the class avoids any CSS quirks.
        if (!container) {
            return;
        }
        const safeValue = Number.isFinite(Number(fillValue)) ? Number(fillValue) : 0;
        Array.from(container.querySelectorAll(".rating-star-button")).forEach(function paint(label) {
            const buttonValue = Number(label.getAttribute("data-rating-value")) || 0;
            if (safeValue > 0 && buttonValue <= safeValue) {
                label.classList.add("is-filled");
            } else {
                label.classList.remove("is-filled");
            }
        });
    }

    function clearStarPreviewState(container) {
        if (!container) return;
        Array.from(container.querySelectorAll(".rating-star-button.is-previewed"))
            .forEach(function clear(label) { label.classList.remove("is-previewed"); });
    }

    function applyStarPreviewState(container, previewValue) {
        if (!container) return;
        clearStarPreviewState(container);
        const safeValue = Number.isFinite(Number(previewValue)) ? Number(previewValue) : 0;
        if (safeValue <= 0) return;
        Array.from(container.querySelectorAll(".rating-star-button")).forEach(function paint(label) {
            const buttonValue = Number(label.getAttribute("data-rating-value")) || 0;
            if (buttonValue <= safeValue) {
                label.classList.add("is-previewed");
            }
        });
    }

    function renderStarPicker(container, currentValue, namePrefix) {
        if (!container) {
            return;
        }
        container.innerHTML = "";
        const max = 5;
        // Render in 1 → 5 order — straightforward and matches reading order.
        // Highlight state is set via JS classes on `change` / hover events so
        // it doesn't depend on `:has()` or sibling-combinator CSS tricks.
        for (let i = 1; i <= max; i += 1) {
            const label = globalScope.document.createElement("label");
            label.className = "rating-star-button";
            label.setAttribute("data-rating-value", String(i));
            const input = globalScope.document.createElement("input");
            input.type = "radio";
            input.name = namePrefix;
            input.value = String(i);
            input.className = "rating-star-input";
            if (currentValue === i) {
                input.checked = true;
            }
            const symbol = globalScope.document.createElement("output");
            symbol.className = "rating-star-symbol";
            symbol.textContent = "★";
            symbol.setAttribute("aria-hidden", "true");
            const srLabel = globalScope.document.createElement("small");
            srLabel.className = "rating-star-sr";
            srLabel.textContent = `${i} star${i === 1 ? "" : "s"}`;
            label.appendChild(input);
            label.appendChild(symbol);
            label.appendChild(srLabel);
            container.appendChild(label);
        }

        // Paint the initial fill state if a value was supplied.
        applyStarFillStateToContainer(container, currentValue);

        // Update the fill whenever the user clicks a different star.
        container.addEventListener("change", function onStarChange(event) {
            const target = event.target;
            if (!target || target.type !== "radio") return;
            applyStarFillStateToContainer(container, Number(target.value));
            clearStarPreviewState(container);
        });

        // Hover preview: mouseenter on a label paints 1..N in preview state.
        container.addEventListener("mouseover", function onStarHover(event) {
            const label = event.target && typeof event.target.closest === "function"
                ? event.target.closest(".rating-star-button")
                : null;
            if (!label || !container.contains(label)) return;
            applyStarPreviewState(container, Number(label.getAttribute("data-rating-value")));
        });

        container.addEventListener("mouseleave", function onStarLeave() {
            clearStarPreviewState(container);
        });
    }

    function fillRatingModal(order, existingReview) {
        const dialog = buildRatingModal();
        const heading = dialog.querySelector("#rating-modal-heading");
        const sub = dialog.querySelector("#rating-modal-subheading");
        const vendorStars = dialog.querySelector("#rating-vendor-stars");
        const commentBox = dialog.querySelector("#rating-vendor-comment");
        const itemsList = dialog.querySelector("#rating-items-list");
        const anonymousBox = dialog.querySelector("#rating-anonymous");
        const errorEl = dialog.querySelector("#rating-error");

        if (heading) {
            heading.textContent = existingReview ? "Update your rating" : "Rate your order";
        }
        if (sub) {
            sub.textContent = `${order.vendorName} — order ${order.orderId.slice(0, 8)}`;
        }
        if (errorEl) {
            errorEl.hidden = true;
            errorEl.textContent = "";
        }

        renderStarPicker(
            vendorStars,
            existingReview ? Number(existingReview.vendorRating) : null,
            "vendorRating"
        );

        if (commentBox) {
            commentBox.value = existingReview ? String(existingReview.vendorComment || "") : "";
        }

        if (anonymousBox) {
            anonymousBox.checked = !!(existingReview && existingReview.isAnonymous);
        }

        if (itemsList) {
            itemsList.innerHTML = "";
            const safeItems = Array.isArray(order.items) ? order.items : [];

            if (safeItems.length === 0) {
                const empty = globalScope.document.createElement("p");
                empty.className = "rating-items-empty";
                empty.textContent = "This order didn't store individual menu items.";
                itemsList.appendChild(empty);
            } else {
                safeItems.forEach(function appendItemRow(item, index) {
                    const existingItem = existingReview && Array.isArray(existingReview.itemRatings)
                        ? existingReview.itemRatings.find(function matchItem(entry) {
                            return entry.menuItemId === item.menuItemId;
                        })
                        : null;

                    const row = globalScope.document.createElement("li");
                    row.className = "rating-item-row";
                    row.dataset.menuItemId = item.menuItemId;
                    row.dataset.menuItemName = item.name;

                    const name = globalScope.document.createElement("strong");
                    name.className = "rating-item-name";
                    name.textContent = item.name;
                    row.appendChild(name);

                    const stars = globalScope.document.createElement("section");
                    stars.className = "rating-stars rating-item-stars";
                    stars.setAttribute("aria-label", `${item.name} star rating`);
                    renderStarPicker(
                        stars,
                        existingItem && existingItem.rating ? Number(existingItem.rating) : null,
                        `itemRating-${index}`
                    );
                    row.appendChild(stars);

                    const commentLabel = globalScope.document.createElement("label");
                    commentLabel.className = "rating-comment-label";
                    commentLabel.textContent = "Comment (optional)";
                    const commentInput = globalScope.document.createElement("input");
                    commentInput.type = "text";
                    commentInput.name = `itemComment-${index}`;
                    commentInput.maxLength = 300;
                    commentInput.value = existingItem ? String(existingItem.comment || "") : "";
                    commentLabel.appendChild(commentInput);
                    row.appendChild(commentLabel);

                    itemsList.appendChild(row);
                });
            }
        }

        return dialog;
    }

    function readRatingFormValues(dialog, order) {
        const form = dialog.querySelector("#rating-form");
        const vendorRatingInput = form.querySelector('input[name="vendorRating"]:checked');
        const vendorComment = form.querySelector("#rating-vendor-comment").value;
        const isAnonymous = form.querySelector("#rating-anonymous").checked === true;

        const safeItems = Array.isArray(order.items) ? order.items : [];
        const itemRatings = safeItems.map(function readItem(item, index) {
            const ratingInput = form.querySelector(`input[name="itemRating-${index}"]:checked`);
            const commentInput = form.querySelector(`input[name="itemComment-${index}"]`);
            return {
                menuItemId: item.menuItemId,
                name: item.name,
                rating: ratingInput ? Number(ratingInput.value) : null,
                comment: commentInput ? commentInput.value : ""
            };
        });

        return {
            vendorRating: vendorRatingInput ? Number(vendorRatingInput.value) : null,
            vendorComment,
            itemRatings,
            isAnonymous
        };
    }

    function showRatingError(dialog, message) {
        const errorEl = dialog.querySelector("#rating-error");
        if (!errorEl) return;
        errorEl.hidden = !message;
        errorEl.textContent = message || "";
    }

    function closeRatingModal(dialog) {
        if (!dialog) return;
        if (typeof dialog.close === "function" && dialog.open) {
            dialog.close();
        } else {
            dialog.removeAttribute("open");
            dialog.open = false;
        }
    }

    function openRatingModal(dialog) {
        if (!dialog) return;
        if (typeof dialog.showModal === "function") {
            if (!dialog.open) {
                dialog.showModal();
            }
        } else {
            dialog.setAttribute("open", "open");
            dialog.open = true;
        }
    }

    async function loadExistingReviews(deps, currentUser, orders) {
        // Fetch the customer's existing reviews for completed orders so cards
        // can show "Edit your rating" instead of "Rate Order" when applicable.
        const ratingsService = resolveRatingsService(deps.ratingsService);
        const ratingsModel = resolveRatingsModel(deps.ratingsModel);

        if (!ratingsService || !ratingsModel || !currentUser || !currentUser.uid) {
            return {};
        }

        const completed = (Array.isArray(orders) ? orders : []).filter(function isComplete(o) {
            return ratingsModel.isOrderRateable(o);
        });

        const map = {};
        // Fetch one-by-one; a small `in` query is also possible but composite
        // IDs make point reads cheap and avoid index requirements.
        for (let i = 0; i < completed.length; i += 1) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const review = await ratingsService.getReviewByOrder(deps, completed[i].orderId, currentUser.uid);
                if (review) {
                    map[completed[i].orderId] = ratingsModel.normalizeReview(review);
                }
            } catch (error) {
                // Swallow individual fetch errors so a single bad doc doesn't
                // wreck the entire order list.
                if (typeof console !== "undefined" && console.warn) {
                    console.warn("Failed to load review for order", completed[i].orderId, error);
                }
            }
        }
        return map;
    }

    function attachRatingHandlers(elements, deps, options) {
        // Click-delegation: a single listener on the orders container handles
        // every "Rate Order" / "Edit your rating" button without per-card
        // closures.
        const container = elements && elements.container;
        if (!container || container.dataset.ratingClickBound === "true") {
            return;
        }
        container.dataset.ratingClickBound = "true";

        container.addEventListener("click", function onContainerClick(event) {
            const button = event.target && typeof event.target.closest === "function"
                ? event.target.closest('[data-action="open-rate-modal"]')
                : null;
            if (!button) {
                return;
            }
            event.preventDefault();
            const orderId = button.getAttribute("data-order-id");
            const order = pageState.allOrders.find(function matchOrder(o) {
                return o.orderId === orderId;
            });
            if (!order) {
                return;
            }
            const existing = pageState.existingReviews && pageState.existingReviews[orderId];
            const dialog = fillRatingModal(order, existing);
            // Capture the latest order on the dialog so the submit handler
            // always works against the most recently opened card.
            dialog._ratingOrder = order;
            openRatingModal(dialog);
            bindRatingDialogHandlers(dialog, order, deps, options, elements);
        });
    }

    function bindRatingDialogHandlers(dialog, order, deps, options, elements) {
        if (dialog.dataset.ratingBound === "true") {
            return;
        }
        dialog.dataset.ratingBound = "true";

        const form = dialog.querySelector("#rating-form");
        const cancelBtn = dialog.querySelector("#rating-cancel");
        const closeBtn = dialog.querySelector("#rating-modal-close");

        if (cancelBtn) {
            cancelBtn.addEventListener("click", function onCancel(event) {
                event.preventDefault();
                closeRatingModal(dialog);
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener("click", function onClose(event) {
                event.preventDefault();
                closeRatingModal(dialog);
            });
        }

        if (form) {
            form.addEventListener("submit", async function onSubmit(event) {
                event.preventDefault();
                const currentOrder = dialog._ratingOrder || order;
                const ratingsModel = resolveRatingsModel(deps.ratingsModel);
                const ratingsService = resolveRatingsService(deps.ratingsService);
                if (!ratingsModel || !ratingsService) {
                    showRatingError(dialog, "Ratings module is not available.");
                    return;
                }

                const values = readRatingFormValues(dialog, currentOrder);
                const build = ratingsModel.buildReviewRecord({
                    order: currentOrder,
                    customerUid: deps.currentUser && deps.currentUser.uid,
                    customerName: (deps.currentUser && deps.currentUser.displayName) || currentOrder.customerName,
                    values
                });

                if (!build.ok) {
                    showRatingError(dialog, build.errors.vendorRating || "Please fix the highlighted fields.");
                    return;
                }

                try {
                    await ratingsService.submitReview({
                        db: deps.db,
                        firestoreFns: deps.firestoreFns,
                        ratingsModel
                    }, build.record);

                    pageState.existingReviews = pageState.existingReviews || {};
                    pageState.existingReviews[currentOrder.orderId] = ratingsModel.normalizeReview(build.record);

                    closeRatingModal(dialog);
                    renderCurrentPage(elements, Object.assign({}, options, {
                        existingReviews: pageState.existingReviews
                    }));
                } catch (error) {
                    showRatingError(
                        dialog,
                        (error && error.message) || "Failed to submit your rating. Please try again."
                    );
                }
            });
        }

        // Remember the order on the dialog so the submit handler doesn't close
        // over a stale reference if the same modal is reused for a different
        // card afterwards.
        dialog._ratingOrder = order;
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

            // Load any existing reviews for this customer's completed orders so
            // we can swap "Rate Order" for "Edit your rating" on those cards.
            pageState.existingReviews = await loadExistingReviews(
                {
                    db,
                    firestoreFns,
                    ratingsService: options.ratingsService,
                    ratingsModel: options.ratingsModel
                },
                currentUser,
                pageState.allOrders
            );

            const renderOptions = Object.assign({}, options, {
                existingReviews: pageState.existingReviews
            });

            attachToolbarHandlers(elements, renderOptions);
            attachRatingHandlers(elements, {
                db,
                firestoreFns,
                currentUser,
                ratingsService: options.ratingsService,
                ratingsModel: options.ratingsModel
            }, renderOptions);
            renderCheckoutPanel(elements, renderOptions);
            renderCurrentPage(elements, renderOptions);

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
        canRateOrder,
        getStarDisplay,
        buildRatingButton,
        buildRatingModal,
        renderStarPicker,
        fillRatingModal,
        readRatingFormValues,
        showRatingError,
        closeRatingModal,
        openRatingModal,
        loadExistingReviews,
        attachRatingHandlers,
        bindRatingDialogHandlers,
        resolveRatingsModel,
        resolveRatingsService,
        init
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerOrderTrackingPage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.customerOrderTrackingPage = customerOrderTrackingPage;
    }
})(typeof window !== "undefined" ? window : globalThis);
