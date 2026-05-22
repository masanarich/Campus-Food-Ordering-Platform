(function attachAdminFinancePage(globalScope) {
    "use strict";

    const MODULE_NAME = "admin/finance";
    const ORDERS_COLLECTION = "orders";
    const USERS_COLLECTION = "users";
    const DEFAULT_CURRENCY = "ZAR";
    const DEFAULT_AUTH_TIMEOUT_MS = 5000;
    const STATUS_MESSAGES = Object.freeze({
        loading: "Loading finance...",
        ready: "Finance dashboard loaded.",
        signedOut: "Please sign in as an admin to view finance.",
        denied: "This finance dashboard is only available to admins.",
        failed: "We could not load finance right now.",
        updated: "Payout status updated."
    });

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
    }

    /**
     * Turn a raw error (Firebase or otherwise) into a short, user-friendly
     * status message. Firebase's "missing index" errors include a long URL
     * we don't want to surface to admins.
     */
    function summarizeFinanceError(error) {
        if (!error) return STATUS_MESSAGES.failed;
        const code = typeof error.code === "string" ? error.code : "";
        const message = typeof error.message === "string" ? error.message : "";
        const looksLikeIndexError =
            code === "failed-precondition" ||
            (/\bindex\b/i.test(message) && /\b(building|require[ds]?|create[ds]?|composite)\b/i.test(message));
        if (looksLikeIndexError) {
            return "Finance data is still preparing (Firestore indexes are building). Please try Refresh again in a minute or two.";
        }
        if (code === "permission-denied") {
            return "You don't have permission to view finance data.";
        }
        return STATUS_MESSAGES.failed;
    }

    function normalizeCurrencyAmount(value, fallbackValue) {
        const parsed = Number.parseFloat(value);
        const fallbackParsed = Number.parseFloat(fallbackValue);

        if (Number.isFinite(parsed)) {
            return Math.max(0, Math.round((parsed + Number.EPSILON) * 100) / 100);
        }

        if (Number.isFinite(fallbackParsed)) {
            return Math.max(0, Math.round((fallbackParsed + Number.EPSILON) * 100) / 100);
        }

        return 0;
    }

    function formatCurrency(amount, currency) {
        const safeCurrency = normalizeText(currency) || DEFAULT_CURRENCY;

        try {
            return new Intl.NumberFormat("en-ZA", {
                style: "currency",
                currency: safeCurrency,
                currencyDisplay: "narrowSymbol"
            }).format(normalizeCurrencyAmount(amount));
        } catch (error) {
            return `R${normalizeCurrencyAmount(amount).toFixed(2)}`;
        }
    }

    function resolveGlobal(name) {
        if (globalScope && globalScope[name]) {
            return globalScope[name];
        }

        if (typeof globalThis !== "undefined" && globalThis[name]) {
            return globalThis[name];
        }

        return null;
    }

    function resolveAuth(explicitAuth) {
        return explicitAuth || resolveGlobal("auth") || null;
    }

    function resolveFirestore(explicitDb) {
        return explicitDb || resolveGlobal("db") || null;
    }

    function resolveAuthFns(explicitAuthFns) {
        return explicitAuthFns && typeof explicitAuthFns === "object"
            ? explicitAuthFns
            : resolveGlobal("authFns") || {};
    }

    function resolveFirestoreFns(explicitFirestoreFns) {
        return explicitFirestoreFns && typeof explicitFirestoreFns === "object"
            ? explicitFirestoreFns
            : resolveGlobal("firestoreFns") || {};
    }

    function resolveAuthUtils(explicitAuthUtils) {
        return explicitAuthUtils || resolveGlobal("authUtils") || null;
    }

    function resolvePlatformPricing(explicitPlatformPricing) {
        if (explicitPlatformPricing && typeof explicitPlatformPricing.calculatePlatformBalance === "function") {
            return explicitPlatformPricing;
        }

        const globalPlatformPricing = resolveGlobal("platformPricing");

        if (globalPlatformPricing && typeof globalPlatformPricing.calculatePlatformBalance === "function") {
            return globalPlatformPricing;
        }

        if (typeof require === "function") {
            try {
                return require("../shared/finance/platform-pricing.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolvePayoutModel(explicitPayoutModel) {
        if (explicitPayoutModel && typeof explicitPayoutModel.normalizePayoutRecord === "function") {
            return explicitPayoutModel;
        }

        const globalPayoutModel = resolveGlobal("payoutModel");

        if (globalPayoutModel && typeof globalPayoutModel.normalizePayoutRecord === "function") {
            return globalPayoutModel;
        }

        if (typeof require === "function") {
            try {
                return require("../shared/finance/payout-model.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolvePayoutQueries(explicitPayoutQueries) {
        if (explicitPayoutQueries && typeof explicitPayoutQueries.fetchAdminPayouts === "function") {
            return explicitPayoutQueries;
        }

        const globalPayoutQueries = resolveGlobal("payoutQueries");

        if (globalPayoutQueries && typeof globalPayoutQueries.fetchAdminPayouts === "function") {
            return globalPayoutQueries;
        }

        if (typeof require === "function") {
            try {
                return require("../shared/finance/payout-queries.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolvePayoutService(explicitPayoutService) {
        if (explicitPayoutService && typeof explicitPayoutService.updatePayoutStatus === "function") {
            return explicitPayoutService;
        }

        const globalPayoutService = resolveGlobal("payoutService");

        if (globalPayoutService && typeof globalPayoutService.updatePayoutStatus === "function") {
            return globalPayoutService;
        }

        if (typeof require === "function") {
            try {
                return require("../shared/finance/payout-service.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function waitForAuthReady(auth, authFns, timeoutMs = DEFAULT_AUTH_TIMEOUT_MS) {
        if (!auth || !authFns || typeof authFns.onAuthStateChanged !== "function") {
            return Promise.resolve(auth && auth.currentUser ? auth.currentUser : null);
        }

        return new Promise(function waitForAuth(resolve) {
            let settled = false;
            let unsubscribe = null;
            const timer = setTimeout(function onTimeout() {
                if (settled) {
                    return;
                }

                settled = true;
                if (typeof unsubscribe === "function") {
                    unsubscribe();
                }
                resolve(auth.currentUser || null);
            }, timeoutMs);

            unsubscribe = authFns.onAuthStateChanged(auth, function onUser(user) {
                if (settled) {
                    return;
                }

                settled = true;
                clearTimeout(timer);
                if (typeof unsubscribe === "function") {
                    unsubscribe();
                }
                resolve(user || null);
            });
        });
    }

    function normalizeAdminProfile(profile) {
        const safeProfile = profile && typeof profile === "object" ? profile : {};

        return {
            uid: normalizeText(safeProfile.uid),
            displayName: normalizeText(safeProfile.displayName || safeProfile.fullName),
            email: normalizeLowerText(safeProfile.email),
            isAdmin: safeProfile.isAdmin === true || safeProfile.admin === true,
            accountStatus: normalizeLowerText(safeProfile.accountStatus) || "active"
        };
    }

    function canAccessAdminFinance(profile, authUtils) {
        const safeProfile = normalizeAdminProfile(profile);

        if (authUtils && typeof authUtils.canAccessAdminPortal === "function") {
            return authUtils.canAccessAdminPortal(safeProfile) && safeProfile.accountStatus !== "disabled";
        }

        return safeProfile.isAdmin === true &&
            safeProfile.accountStatus !== "disabled" &&
            safeProfile.accountStatus !== "blocked";
    }

    async function fetchAdminProfile(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const currentUser = safeOptions.currentUser && typeof safeOptions.currentUser === "object"
            ? safeOptions.currentUser
            : {};
        const authService = safeOptions.authService || resolveGlobal("authService");
        const db = resolveFirestore(safeOptions.db);
        const firestoreFns = resolveFirestoreFns(safeOptions.firestoreFns);
        const uid = normalizeText(currentUser.uid);

        if (!uid) {
            return normalizeAdminProfile(currentUser);
        }

        if (authService && typeof authService.getCurrentUserProfile === "function") {
            try {
                const profile = await authService.getCurrentUserProfile(uid);

                if (profile) {
                    return normalizeAdminProfile({
                        uid,
                        displayName: currentUser.displayName,
                        email: currentUser.email,
                        ...profile
                    });
                }
            } catch (error) {
                console.error(`${MODULE_NAME}: Failed to load admin profile through authService.`, error);
            }
        }

        if (db && typeof firestoreFns.doc === "function" && typeof firestoreFns.getDoc === "function") {
            try {
                const snapshot = await firestoreFns.getDoc(firestoreFns.doc(db, USERS_COLLECTION, uid));
                const exists = snapshot && typeof snapshot.exists === "function"
                    ? snapshot.exists()
                    : snapshot && snapshot.exists !== false;
                const data = exists && typeof snapshot.data === "function" ? snapshot.data() || {} : {};

                return normalizeAdminProfile({
                    uid,
                    displayName: currentUser.displayName,
                    email: currentUser.email,
                    ...data
                });
            } catch (error) {
                console.error(`${MODULE_NAME}: Failed to load admin profile from Firestore.`, error);
            }
        }

        return normalizeAdminProfile(currentUser);
    }

    function getSnapshotDocuments(snapshot) {
        if (!snapshot) {
            return [];
        }

        if (Array.isArray(snapshot.docs)) {
            return snapshot.docs;
        }

        const docs = [];

        if (typeof snapshot.forEach === "function") {
            snapshot.forEach(function collectDoc(docSnapshot) {
                docs.push(docSnapshot);
            });
        }

        return docs;
    }

    function mapDocument(snapshot, idKey) {
        const data = snapshot && typeof snapshot.data === "function" ? snapshot.data() || {} : {};
        const id = normalizeText(snapshot && snapshot.id);

        return {
            [idKey]: id || normalizeText(data[idKey]),
            ...data
        };
    }

    async function fetchFinanceOrders(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderService = safeOptions.orderService || resolveGlobal("orderService");
        const db = resolveFirestore(safeOptions.db);
        const firestoreFns = resolveFirestoreFns(safeOptions.firestoreFns);

        if (typeof safeOptions.orderReader === "function") {
            const orders = await safeOptions.orderReader(safeOptions);
            return Array.isArray(orders) ? orders : [];
        }

        if (orderService && typeof orderService.getAllOrders === "function") {
            const orders = await orderService.getAllOrders({
                ...safeOptions,
                db,
                firestoreFns
            });

            return Array.isArray(orders) ? orders : [];
        }

        if (
            !db ||
            typeof firestoreFns.collection !== "function" ||
            typeof firestoreFns.getDocs !== "function"
        ) {
            return [];
        }

        const collectionRef = firestoreFns.collection(db, ORDERS_COLLECTION);
        const ordersQuery = typeof firestoreFns.query === "function" && typeof firestoreFns.orderBy === "function"
            ? firestoreFns.query(collectionRef, firestoreFns.orderBy("createdAt", "desc"))
            : collectionRef;
        const snapshot = await firestoreFns.getDocs(ordersQuery);

        return getSnapshotDocuments(snapshot).map(function mapOrder(docSnapshot) {
            return mapDocument(docSnapshot, "orderId");
        });
    }

    async function fetchAdminPayouts(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const payoutQueries = resolvePayoutQueries(safeOptions.payoutQueries);

        if (typeof safeOptions.payoutReader === "function") {
            const payouts = await safeOptions.payoutReader(safeOptions);
            return Array.isArray(payouts) ? payouts : [];
        }

        if (payoutQueries && typeof payoutQueries.fetchAdminPayouts === "function") {
            return payoutQueries.fetchAdminPayouts({
                ...safeOptions,
                payoutModel: resolvePayoutModel(safeOptions.payoutModel)
            });
        }

        return [];
    }

    function isCompletedPaidOrder(order, options = {}) {
        const platformPricing = resolvePlatformPricing(options.platformPricing);

        if (platformPricing && typeof platformPricing.isCompletedPaidOrder === "function") {
            return platformPricing.isCompletedPaidOrder(order);
        }

        const safeOrder = order && typeof order === "object" ? order : {};
        const status = normalizeLowerText(safeOrder.status || safeOrder.orderStatus);
        const paymentStatus = normalizeLowerText(safeOrder.paymentStatus || safeOrder.paymentState);

        return status === "completed" && (!paymentStatus || paymentStatus === "paid");
    }

    function getOrderVendorEarnings(order, options = {}) {
        const platformPricing = resolvePlatformPricing(options.platformPricing);

        if (platformPricing && typeof platformPricing.getOrderVendorEarnings === "function") {
            return platformPricing.getOrderVendorEarnings(order, options);
        }

        const safeOrder = order && typeof order === "object" ? order : {};

        return normalizeCurrencyAmount(
            safeOrder.vendorEarnings !== undefined
                ? safeOrder.vendorEarnings
                : safeOrder.vendorSubtotal !== undefined
                    ? safeOrder.vendorSubtotal
                    : safeOrder.total
        );
    }

    function calculateFinanceSummary(orders, payouts, options = {}) {
        const safeOrders = Array.isArray(orders) ? orders : [];
        const safePayouts = Array.isArray(payouts) ? payouts : [];
        const platformPricing = resolvePlatformPricing(options.platformPricing);
        const platformBalance = platformPricing && typeof platformPricing.calculatePlatformBalance === "function"
            ? platformPricing.calculatePlatformBalance(safeOrders, options)
            : calculateFallbackPlatformBalance(safeOrders, options);
        const completedOrders = safeOrders.filter(function matchCompleted(order) {
            return isCompletedPaidOrder(order, options);
        });
        const vendorEarnings = completedOrders.reduce(function sumVendor(total, order) {
            return total + getOrderVendorEarnings(order, options);
        }, 0);
        const payoutSummary = calculatePayoutSummary(safePayouts, options);

        return {
            completedOrders: platformBalance.completedOrders || completedOrders.length,
            customerRevenue: normalizeCurrencyAmount(platformBalance.customerRevenue),
            platformEarnings: normalizeCurrencyAmount(platformBalance.platformEarnings),
            platformBalance: normalizeCurrencyAmount(platformBalance.platformBalance),
            vendorEarnings: normalizeCurrencyAmount(vendorEarnings),
            ...payoutSummary
        };
    }

    function calculateFallbackPlatformBalance(orders, options = {}) {
        const completedOrders = (Array.isArray(orders) ? orders : []).filter(function matchCompleted(order) {
            return isCompletedPaidOrder(order, options);
        });
        const platformEarnings = completedOrders.reduce(function sumPlatform(total, order) {
            const safeOrder = order && typeof order === "object" ? order : {};
            return total + normalizeCurrencyAmount(
                safeOrder.platformEarnings !== undefined
                    ? safeOrder.platformEarnings
                    : safeOrder.platformFee
            );
        }, 0);
        const customerRevenue = completedOrders.reduce(function sumRevenue(total, order) {
            const safeOrder = order && typeof order === "object" ? order : {};
            return total + normalizeCurrencyAmount(
                safeOrder.paymentAmount !== undefined
                    ? safeOrder.paymentAmount
                    : safeOrder.total !== undefined
                        ? safeOrder.total
                        : safeOrder.totalAmount
            );
        }, 0);

        return {
            completedOrders: completedOrders.length,
            customerRevenue: normalizeCurrencyAmount(customerRevenue),
            platformEarnings: normalizeCurrencyAmount(platformEarnings),
            platformBalance: normalizeCurrencyAmount(platformEarnings)
        };
    }

    function calculatePayoutSummary(payouts, options = {}) {
        const payoutModel = resolvePayoutModel(options.payoutModel);
        const safePayouts = Array.isArray(payouts) ? payouts : [];
        const byStatus = {
            pending: 0,
            approved: 0,
            paid: 0,
            rejected: 0,
            cancelled: 0
        };
        let totalRequested = 0;
        let paidPayoutTotal = 0;
        let reservedPayoutTotal = 0;

        safePayouts.forEach(function countPayout(payout) {
            const safePayout = payout && typeof payout === "object" ? payout : {};
            const status = payoutModel && typeof payoutModel.normalizePayoutStatus === "function"
                ? payoutModel.normalizePayoutStatus(safePayout.status)
                : normalizeLowerText(safePayout.status) || "pending";
            const amount = normalizeCurrencyAmount(safePayout.amount);
            const reservesBalance = payoutModel && typeof payoutModel.payoutReservesBalance === "function"
                ? payoutModel.payoutReservesBalance(status)
                : ["pending", "approved", "paid"].indexOf(status) >= 0;

            if (Object.prototype.hasOwnProperty.call(byStatus, status)) {
                byStatus[status] += 1;
            }

            totalRequested += amount;

            if (status === "paid") {
                paidPayoutTotal += amount;
            }

            if (reservesBalance) {
                reservedPayoutTotal += amount;
            }
        });

        return {
            payoutCount: safePayouts.length,
            pendingPayoutCount: byStatus.pending,
            approvedPayoutCount: byStatus.approved,
            paidPayoutCount: byStatus.paid,
            rejectedPayoutCount: byStatus.rejected,
            cancelledPayoutCount: byStatus.cancelled,
            totalRequested: normalizeCurrencyAmount(totalRequested),
            paidPayoutTotal: normalizeCurrencyAmount(paidPayoutTotal),
            reservedPayoutTotal: normalizeCurrencyAmount(reservedPayoutTotal)
        };
    }

    function getTimestampDate(value) {
        if (!value) {
            return null;
        }

        if (value instanceof Date) {
            return value;
        }

        if (typeof value.toDate === "function") {
            return value.toDate();
        }

        if (typeof value.seconds === "number") {
            return new Date(value.seconds * 1000);
        }

        const parsed = new Date(value);

        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function formatDateTime(value) {
        const date = getTimestampDate(value);

        if (!date) {
            return "Not recorded";
        }

        return new Intl.DateTimeFormat("en-ZA", {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(date);
    }

    function sortPayoutsNewestFirst(payouts) {
        return (Array.isArray(payouts) ? payouts.slice() : []).sort(function comparePayouts(left, right) {
            const leftDate = getTimestampDate(left.updatedAt || left.requestedAt || left.createdAt);
            const rightDate = getTimestampDate(right.updatedAt || right.requestedAt || right.createdAt);
            const leftTime = leftDate ? leftDate.getTime() : 0;
            const rightTime = rightDate ? rightDate.getTime() : 0;

            return rightTime - leftTime;
        });
    }

    function sortPayoutsOldestFirst(payouts) {
        return (Array.isArray(payouts) ? payouts.slice() : []).sort(function comparePayouts(left, right) {
            const leftDate = getTimestampDate(left.requestedAt || left.createdAt || left.updatedAt);
            const rightDate = getTimestampDate(right.requestedAt || right.createdAt || right.updatedAt);
            const leftTime = leftDate ? leftDate.getTime() : Number.MAX_SAFE_INTEGER;
            const rightTime = rightDate ? rightDate.getTime() : Number.MAX_SAFE_INTEGER;

            return leftTime - rightTime;
        });
    }

    function getNextFinanceAction(summary, payouts, options = {}) {
        const safeSummary = summary && typeof summary === "object"
            ? summary
            : calculateFinanceSummary([], [], options);
        const payoutList = Array.isArray(payouts) ? payouts : [];
        const approvedPayout = sortPayoutsOldestFirst(payoutList).find(function findApproved(payout) {
            return normalizeLowerText(payout && payout.status) === "approved";
        });
        const pendingPayout = sortPayoutsOldestFirst(payoutList).find(function findPending(payout) {
            const status = normalizeLowerText(payout && payout.status) || "pending";
            return status === "pending";
        });

        if (approvedPayout) {
            const payoutId = normalizeText(approvedPayout.payoutId || approvedPayout.id) || "this payout";
            const vendorName = normalizeText(approvedPayout.vendorName) || "Unknown Vendor";

            return {
                label: "Next: mark payout paid",
                detail: `${payoutId} for ${vendorName} is approved for ${formatCurrency(approvedPayout.amount)}.`
            };
        }

        if (pendingPayout) {
            const payoutId = normalizeText(pendingPayout.payoutId || pendingPayout.id) || "this payout";
            const requestedAt = formatDateTime(pendingPayout.requestedAt || pendingPayout.createdAt);

            return {
                label: "Next: review payout",
                detail: `${payoutId} has been waiting since ${requestedAt}.`
            };
        }

        if (normalizeCurrencyAmount(safeSummary.platformBalance) > 0) {
            return {
                label: "Next: monitor earnings",
                detail: `${formatCurrency(safeSummary.platformBalance)} is available in simulated platform earnings.`
            };
        }

        return {
            label: "Next: wait for sales",
            detail: "Completed paid orders will add platform earnings and vendor payout activity."
        };
    }

    function filterPayouts(payouts, statusFilter) {
        const normalizedFilter = normalizeLowerText(statusFilter) || "all";

        if (normalizedFilter === "all") {
            return Array.isArray(payouts) ? payouts.slice() : [];
        }

        return (Array.isArray(payouts) ? payouts : []).filter(function matchStatus(payout) {
            return normalizeLowerText(payout && payout.status) === normalizedFilter;
        });
    }

    function setText(element, value) {
        if (element) {
            element.textContent = value === undefined || value === null ? "" : String(value);
        }
    }

    function setStatusMessage(element, message, state) {
        if (!element) {
            return;
        }

        element.textContent = normalizeText(message);

        if (state) {
            element.setAttribute("data-state", normalizeLowerText(state));
        } else {
            element.removeAttribute("data-state");
        }
    }

    function getPageElements(rootDocument) {
        const doc = rootDocument || (globalScope && globalScope.document);

        if (!doc) {
            return {};
        }

        return {
            statusElement: doc.getElementById("admin-finance-status"),
            refreshButton: doc.getElementById("refresh-finance-button"),
            statusFilter: doc.getElementById("payout-status-filter"),
            platformBalanceElement: doc.getElementById("platform-balance"),
            customerRevenueElement: doc.getElementById("customer-revenue"),
            vendorEarningsElement: doc.getElementById("vendor-earnings"),
            completedOrdersElement: doc.getElementById("completed-orders"),
            pendingPayoutCountElement: doc.getElementById("pending-payout-count"),
            approvedPayoutCountElement: doc.getElementById("approved-payout-count"),
            paidPayoutTotalElement: doc.getElementById("paid-payout-total"),
            reservedPayoutTotalElement: doc.getElementById("reserved-payout-total"),
            nextActionElement: doc.getElementById("finance-next-action"),
            nextActionDetailElement: doc.getElementById("finance-next-action-detail"),
            payoutSummaryElement: doc.getElementById("payout-admin-summary"),
            payoutListElement: doc.getElementById("payout-admin-list")
        };
    }

    function renderFinanceSummary(summary, elements, options = {}) {
        const safeSummary = summary && typeof summary === "object"
            ? summary
            : calculateFinanceSummary([], [], options);
        const safeElements = elements && typeof elements === "object" ? elements : {};
        const nextAction = getNextFinanceAction(safeSummary, options.payouts, options);

        setText(safeElements.platformBalanceElement, formatCurrency(safeSummary.platformBalance));
        setText(safeElements.customerRevenueElement, formatCurrency(safeSummary.customerRevenue));
        setText(safeElements.vendorEarningsElement, formatCurrency(safeSummary.vendorEarnings));
        setText(safeElements.completedOrdersElement, String(safeSummary.completedOrders || 0));
        setText(safeElements.pendingPayoutCountElement, String(safeSummary.pendingPayoutCount || 0));
        setText(safeElements.approvedPayoutCountElement, String(safeSummary.approvedPayoutCount || 0));
        setText(safeElements.paidPayoutTotalElement, formatCurrency(safeSummary.paidPayoutTotal));
        setText(safeElements.reservedPayoutTotalElement, formatCurrency(safeSummary.reservedPayoutTotal));
        setText(safeElements.nextActionElement, nextAction.label);
        setText(safeElements.nextActionDetailElement, nextAction.detail);
    }

    function getPayoutStatusLabel(status, payoutModel) {
        const resolvedPayoutModel = resolvePayoutModel(payoutModel);

        if (resolvedPayoutModel && typeof resolvedPayoutModel.getPayoutStatusLabel === "function") {
            return resolvedPayoutModel.getPayoutStatusLabel(status);
        }

        const normalized = normalizeLowerText(status) || "pending";

        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    function createElement(doc, tagName, className, textContent) {
        const element = doc.createElement(tagName);

        if (className) {
            element.className = className;
        }

        if (textContent !== undefined) {
            element.textContent = textContent;
        }

        return element;
    }

    function createActionButton(doc, payoutId, nextStatus, label, className) {
        const button = createElement(doc, "button", className || "button-secondary", label);

        button.type = "button";
        button.setAttribute("data-payout-action", nextStatus);
        button.setAttribute("data-payout-id", payoutId);

        return button;
    }

    function renderPayoutList(payouts, elements, options = {}) {
        const safeElements = elements && typeof elements === "object" ? elements : {};
        const container = safeElements.payoutListElement;
        const summaryElement = safeElements.payoutSummaryElement;
        const statusFilter = safeElements.statusFilter ? safeElements.statusFilter.value : options.statusFilter;
        const filteredPayouts = sortPayoutsNewestFirst(filterPayouts(payouts, statusFilter));
        const doc = container ? container.ownerDocument : null;

        if (summaryElement) {
            const statusText = normalizeLowerText(statusFilter) && normalizeLowerText(statusFilter) !== "all"
                ? ` matching ${normalizeLowerText(statusFilter)}`
                : "";
            summaryElement.textContent = filteredPayouts.length === 0
                ? `No payout requests${statusText}.`
                : `${filteredPayouts.length} payout request${filteredPayouts.length === 1 ? "" : "s"}${statusText}.`;
        }

        if (!container || !doc) {
            return;
        }

        container.innerHTML = "";

        if (filteredPayouts.length === 0) {
            container.appendChild(createElement(doc, "p", "finance-empty-state", "No payout requests to show."));
            return;
        }

        filteredPayouts.forEach(function renderOnePayout(payout) {
            const safePayout = payout && typeof payout === "object" ? payout : {};
            const payoutId = normalizeText(safePayout.payoutId || safePayout.id);
            const status = normalizeLowerText(safePayout.status) || "pending";
            const article = createElement(doc, "article", "admin-payout-card");
            const header = createElement(doc, "header", "admin-payout-header");
            const titleWrap = createElement(doc, "section", "admin-payout-title-wrap");
            const title = createElement(
                doc,
                "h4",
                "admin-payout-title",
                `${normalizeText(safePayout.vendorName) || "Unknown Vendor"}`
            );
            const amount = createElement(doc, "span", "admin-payout-amount", formatCurrency(safePayout.amount));
            const statusPill = createElement(doc, "span", "payout-status", getPayoutStatusLabel(status, options.payoutModel));
            const details = createElement(doc, "section", "admin-payout-details");
            const actions = createElement(doc, "menu", "action-menu admin-payout-actions");

            statusPill.setAttribute("data-status", status);
            titleWrap.appendChild(title);
            titleWrap.appendChild(amount);
            header.appendChild(titleWrap);
            header.appendChild(statusPill);

            [
                `Payout ID: ${payoutId || "Not recorded"}`,
                `Vendor email: ${normalizeText(safePayout.vendorEmail) || "Not recorded"}`,
                `Requested: ${formatDateTime(safePayout.requestedAt || safePayout.createdAt)}`,
                `Fake bank: ${normalizeText(safePayout.fakeBankName) || "Not recorded"}`,
                `Fake account: ${normalizeText(safePayout.fakeAccountNumberMasked) || "No masked account"}`
            ].forEach(function addDetail(text) {
                details.appendChild(createElement(doc, "p", "", text));
            });

            if (status === "pending") {
                const approveItem = createElement(doc, "li");
                approveItem.appendChild(createActionButton(doc, payoutId, "approved", "Approve", "button-secondary"));
                actions.appendChild(approveItem);
            }

            if (status === "pending" || status === "approved") {
                const paidItem = createElement(doc, "li");
                const rejectItem = createElement(doc, "li");
                paidItem.appendChild(createActionButton(doc, payoutId, "paid", "Mark Paid", "button-primary"));
                rejectItem.appendChild(createActionButton(doc, payoutId, "rejected", "Reject", "button-danger"));
                actions.appendChild(paidItem);
                actions.appendChild(rejectItem);
            }

            article.appendChild(header);
            article.appendChild(details);

            if (actions.children.length > 0) {
                article.appendChild(actions);
            }

            container.appendChild(article);
        });
    }

    function renderFinancePage(summary, payouts, elements, options = {}) {
        renderFinanceSummary(summary, elements, {
            ...options,
            payouts
        });
        renderPayoutList(payouts, elements, options);
    }

    function findPayoutById(payouts, payoutId) {
        const normalizedId = normalizeText(payoutId);

        return (Array.isArray(payouts) ? payouts : []).find(function matchPayout(payout) {
            return normalizeText(payout && (payout.payoutId || payout.id)) === normalizedId;
        }) || null;
    }

    function replacePayoutById(payouts, updatedPayout) {
        const payoutId = normalizeText(updatedPayout && (updatedPayout.payoutId || updatedPayout.id));

        if (!payoutId) {
            return Array.isArray(payouts) ? payouts.slice() : [];
        }

        return (Array.isArray(payouts) ? payouts : []).map(function replaceOne(payout) {
            const currentId = normalizeText(payout && (payout.payoutId || payout.id));
            return currentId === payoutId ? updatedPayout : payout;
        });
    }

    function createAdminFinancePage(dependencies = {}) {
        const elements = dependencies.elements || getPageElements(dependencies.document);
        const state = {
            currentUser: null,
            adminProfile: null,
            orders: [],
            payouts: [],
            summary: calculateFinanceSummary([], [], dependencies),
            loading: false
        };

        async function loadFinanceData(loadOptions = {}) {
            const options = {
                ...dependencies,
                ...loadOptions
            };
            const auth = resolveAuth(options.auth);
            const authFns = resolveAuthFns(options.authFns);
            const authUtils = resolveAuthUtils(options.authUtils);
            const db = resolveFirestore(options.db);
            const firestoreFns = resolveFirestoreFns(options.firestoreFns);

            state.loading = true;
            setStatusMessage(elements.statusElement, STATUS_MESSAGES.loading, "loading");

            try {
                const currentUser = options.currentUser || await waitForAuthReady(auth, authFns, options.authTimeoutMs);

                if (!currentUser || !normalizeText(currentUser.uid)) {
                    state.currentUser = null;
                    state.adminProfile = null;
                    state.orders = [];
                    state.payouts = [];
                    state.summary = calculateFinanceSummary([], [], options);
                    renderFinancePage(state.summary, state.payouts, elements, options);
                    setStatusMessage(elements.statusElement, STATUS_MESSAGES.signedOut, "error");

                    return {
                        success: false,
                        error: { code: "finance/signed-out", message: STATUS_MESSAGES.signedOut }
                    };
                }

                const adminProfile = await fetchAdminProfile({
                    ...options,
                    currentUser,
                    db,
                    firestoreFns
                });

                if (!canAccessAdminFinance(adminProfile, authUtils)) {
                    state.currentUser = currentUser;
                    state.adminProfile = adminProfile;
                    state.orders = [];
                    state.payouts = [];
                    state.summary = calculateFinanceSummary([], [], options);
                    renderFinancePage(state.summary, state.payouts, elements, options);
                    setStatusMessage(elements.statusElement, STATUS_MESSAGES.denied, "error");

                    return {
                        success: false,
                        adminProfile,
                        error: { code: "finance/access-denied", message: STATUS_MESSAGES.denied }
                    };
                }

                const orders = await fetchFinanceOrders({
                    ...options,
                    db,
                    firestoreFns
                });
                const payouts = await fetchAdminPayouts({
                    ...options,
                    db,
                    firestoreFns
                });
                const summary = calculateFinanceSummary(orders, payouts, options);

                state.currentUser = currentUser;
                state.adminProfile = adminProfile;
                state.orders = orders;
                state.payouts = payouts;
                state.summary = summary;

                renderFinancePage(summary, payouts, elements, options);
                setStatusMessage(elements.statusElement, STATUS_MESSAGES.ready, "success");

                return {
                    success: true,
                    currentUser,
                    adminProfile,
                    orders,
                    payouts,
                    summary
                };
            } catch (error) {
                console.error(`${MODULE_NAME}: Failed to load finance.`, error);
                setStatusMessage(
                    elements.statusElement,
                    summarizeFinanceError(error),
                    "error"
                );

                return {
                    success: false,
                    error
                };
            } finally {
                state.loading = false;
            }
        }

        async function updatePayoutStatus(payoutId, nextStatus, updateOptions = {}) {
            const options = {
                ...dependencies,
                ...updateOptions
            };
            const payoutService = resolvePayoutService(options.payoutService);
            const payoutModel = resolvePayoutModel(options.payoutModel);
            const payout = findPayoutById(state.payouts, payoutId);
            const normalizedNextStatus = normalizeLowerText(nextStatus);

            if (!payout) {
                setStatusMessage(elements.statusElement, "The selected payout could not be found.", "error");
                return {
                    success: false,
                    error: { code: "finance/payout-not-found" }
                };
            }

            if (!payoutService || typeof payoutService.updatePayoutStatus !== "function") {
                setStatusMessage(elements.statusElement, "Payout service is not available.", "error");
                return {
                    success: false,
                    error: { code: "finance/payout-service-missing" }
                };
            }

            setStatusMessage(elements.statusElement, "Updating payout status...", "loading");

            const result = await payoutService.updatePayoutStatus({
                ...options,
                db: resolveFirestore(options.db),
                firestoreFns: resolveFirestoreFns(options.firestoreFns),
                payoutModel,
                payout,
                payoutId,
                nextStatus: normalizedNextStatus,
                actorRole: "admin",
                actorUid: normalizeText(state.adminProfile && state.adminProfile.uid),
                actorName: normalizeText(state.adminProfile && state.adminProfile.displayName) || "Admin User",
                note: normalizeText(options.note) || getDefaultStatusNote(normalizedNextStatus)
            });

            if (!result || result.success !== true) {
                const message = result && result.error && result.error.message
                    ? result.error.message
                    : "Payout status could not be updated.";
                setStatusMessage(elements.statusElement, message, "error");

                return {
                    success: false,
                    result
                };
            }

            state.payouts = replacePayoutById(state.payouts, result.payout);
            state.summary = calculateFinanceSummary(state.orders, state.payouts, options);
            renderFinancePage(state.summary, state.payouts, elements, options);
            setStatusMessage(elements.statusElement, STATUS_MESSAGES.updated, "success");

            return {
                success: true,
                payout: result.payout,
                summary: state.summary,
                result
            };
        }

        function handlePayoutAction(event) {
            const target = event && event.target && typeof event.target.closest === "function"
                ? event.target.closest("[data-payout-action]")
                : null;

            if (!target) {
                return null;
            }

            if (event && typeof event.preventDefault === "function") {
                event.preventDefault();
            }

            const payoutId = target.getAttribute("data-payout-id");
            const nextStatus = target.getAttribute("data-payout-action");

            return updatePayoutStatus(payoutId, nextStatus);
        }

        function attachHandlers() {
            if (elements.refreshButton) {
                elements.refreshButton.addEventListener("click", function onRefreshClick() {
                    loadFinanceData();
                });
            }

            if (elements.statusFilter) {
                elements.statusFilter.addEventListener("change", function onFilterChange() {
                    renderPayoutList(state.payouts, elements, dependencies);
                });
            }

            if (elements.payoutListElement) {
                elements.payoutListElement.addEventListener("click", handlePayoutAction);
            }
        }

        return {
            elements,
            state,
            loadFinanceData,
            updatePayoutStatus,
            handlePayoutAction,
            attachHandlers,
            renderFinancePage: function renderCurrentFinancePage() {
                renderFinancePage(state.summary, state.payouts, elements, dependencies);
            }
        };
    }

    function getDefaultStatusNote(status) {
        const normalized = normalizeLowerText(status);

        if (normalized === "approved") {
            return "Admin approved the simulated payout.";
        }

        if (normalized === "paid") {
            return "Admin marked the simulated payout as paid.";
        }

        if (normalized === "rejected") {
            return "Admin rejected the simulated payout.";
        }

        return "Admin updated the simulated payout.";
    }

    async function initializeAdminFinancePage(options = {}) {
        const page = createAdminFinancePage(options);

        page.attachHandlers();
        const result = await page.loadFinanceData(options);

        return {
            ...result,
            page
        };
    }

    const adminFinancePage = {
        MODULE_NAME,
        ORDERS_COLLECTION,
        USERS_COLLECTION,
        DEFAULT_CURRENCY,
        STATUS_MESSAGES,
        normalizeText,
        normalizeLowerText,
        normalizeCurrencyAmount,
        formatCurrency,
        resolveAuth,
        resolveFirestore,
        resolveAuthFns,
        resolveFirestoreFns,
        resolveAuthUtils,
        resolvePlatformPricing,
        resolvePayoutModel,
        resolvePayoutQueries,
        resolvePayoutService,
        waitForAuthReady,
        normalizeAdminProfile,
        canAccessAdminFinance,
        fetchAdminProfile,
        getSnapshotDocuments,
        mapDocument,
        fetchFinanceOrders,
        fetchAdminPayouts,
        isCompletedPaidOrder,
        getOrderVendorEarnings,
        calculateFinanceSummary,
        calculateFallbackPlatformBalance,
        calculatePayoutSummary,
        getTimestampDate,
        formatDateTime,
        sortPayoutsNewestFirst,
        sortPayoutsOldestFirst,
        getNextFinanceAction,
        filterPayouts,
        setText,
        setStatusMessage,
        getPageElements,
        renderFinanceSummary,
        getPayoutStatusLabel,
        renderPayoutList,
        renderFinancePage,
        findPayoutById,
        replacePayoutById,
        getDefaultStatusNote,
        createAdminFinancePage,
        initializeAdminFinancePage
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = adminFinancePage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.adminFinancePage = adminFinancePage;
    }
})(typeof window !== "undefined" ? window : globalThis);
