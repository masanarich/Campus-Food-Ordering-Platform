(function attachVendorWalletPage(globalScope) {
    "use strict";

    const MODULE_NAME = "vendor/wallet";
    const ORDERS_COLLECTION = "orders";
    const USERS_COLLECTION = "users";
    const DEFAULT_CURRENCY = "ZAR";
    const DEFAULT_AUTH_TIMEOUT_MS = 5000;
    const STATUS_MESSAGES = Object.freeze({
        loading: "Loading wallet...",
        ready: "Wallet loaded. Completed paid orders are included in the available balance.",
        signedOut: "Please sign in as an approved vendor to view your wallet.",
        denied: "This wallet is only available to approved vendors.",
        saved: "Withdrawal request submitted. A test email notification was queued.",
        failed: "We could not load the wallet right now."
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
     * that we don't want to display to vendors.
     */
    function summarizeWalletError(error) {
        if (!error) return STATUS_MESSAGES.failed;
        const code = typeof error.code === "string" ? error.code : "";
        const message = typeof error.message === "string" ? error.message : "";
        const looksLikeIndexError =
            code === "failed-precondition" ||
            (/\bindex\b/i.test(message) && /\b(building|require[ds]?|create[ds]?|composite)\b/i.test(message));
        if (looksLikeIndexError) {
            return "Wallet data is still preparing (Firestore indexes are building). Please try Refresh again in a minute or two.";
        }
        if (code === "permission-denied") {
            return "You don't have permission to view this wallet.";
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
        if (explicitPlatformPricing && typeof explicitPlatformPricing.calculateVendorBalance === "function") {
            return explicitPlatformPricing;
        }

        const globalPlatformPricing = resolveGlobal("platformPricing");

        if (globalPlatformPricing && typeof globalPlatformPricing.calculateVendorBalance === "function") {
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
        if (explicitPayoutModel && typeof explicitPayoutModel.validatePayoutRequestInput === "function") {
            return explicitPayoutModel;
        }

        const globalPayoutModel = resolveGlobal("payoutModel");

        if (globalPayoutModel && typeof globalPayoutModel.validatePayoutRequestInput === "function") {
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
        if (explicitPayoutQueries && typeof explicitPayoutQueries.fetchVendorPayouts === "function") {
            return explicitPayoutQueries;
        }

        const globalPayoutQueries = resolveGlobal("payoutQueries");

        if (globalPayoutQueries && typeof globalPayoutQueries.fetchVendorPayouts === "function") {
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
        if (explicitPayoutService && typeof explicitPayoutService.createPayoutRequest === "function") {
            return explicitPayoutService;
        }

        const globalPayoutService = resolveGlobal("payoutService");

        if (globalPayoutService && typeof globalPayoutService.createPayoutRequest === "function") {
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

    function normalizeVendorProfile(profile) {
        const safeProfile = profile && typeof profile === "object" ? profile : {};

        return {
            uid: normalizeText(safeProfile.uid),
            displayName: normalizeText(
                safeProfile.displayName ||
                safeProfile.fullName ||
                safeProfile.vendorName ||
                safeProfile.vendorOwnerName
            ),
            email: normalizeLowerText(safeProfile.email || safeProfile.vendorEmail),
            vendorStatus: normalizeLowerText(safeProfile.vendorStatus),
            accountStatus: normalizeLowerText(safeProfile.accountStatus) || "active",
            isAdmin: safeProfile.isAdmin === true || safeProfile.admin === true
        };
    }

    function canAccessVendorWallet(profile, authUtils) {
        const safeProfile = normalizeVendorProfile(profile);

        if (authUtils && typeof authUtils.canAccessVendorPortal === "function") {
            return authUtils.canAccessVendorPortal(safeProfile) && safeProfile.accountStatus !== "disabled";
        }

        const hasVendorAccess = safeProfile.vendorStatus === "approved" || safeProfile.isAdmin === true;
        const accountAllowed = safeProfile.accountStatus !== "disabled" && safeProfile.accountStatus !== "blocked";

        return hasVendorAccess && accountAllowed;
    }

    async function fetchVendorProfile(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const currentUser = safeOptions.currentUser && typeof safeOptions.currentUser === "object"
            ? safeOptions.currentUser
            : {};
        const authService = safeOptions.authService || resolveGlobal("authService");
        const db = resolveFirestore(safeOptions.db);
        const firestoreFns = resolveFirestoreFns(safeOptions.firestoreFns);
        const uid = normalizeText(currentUser.uid);

        if (!uid) {
            return normalizeVendorProfile(currentUser);
        }

        if (authService && typeof authService.getCurrentUserProfile === "function") {
            try {
                const profile = await authService.getCurrentUserProfile(uid);

                if (profile) {
                    return normalizeVendorProfile({
                        uid,
                        displayName: currentUser.displayName,
                        email: currentUser.email,
                        ...profile
                    });
                }
            } catch (error) {
                console.error(`${MODULE_NAME}: Failed to load vendor profile through authService.`, error);
            }
        }

        if (db && typeof firestoreFns.doc === "function" && typeof firestoreFns.getDoc === "function") {
            try {
                const snapshot = await firestoreFns.getDoc(firestoreFns.doc(db, USERS_COLLECTION, uid));
                const exists = snapshot && typeof snapshot.exists === "function"
                    ? snapshot.exists()
                    : snapshot && snapshot.exists !== false;
                const data = exists && typeof snapshot.data === "function" ? snapshot.data() || {} : {};

                return normalizeVendorProfile({
                    uid,
                    displayName: currentUser.displayName,
                    email: currentUser.email,
                    ...data
                });
            } catch (error) {
                console.error(`${MODULE_NAME}: Failed to load vendor profile from Firestore.`, error);
            }
        }

        return normalizeVendorProfile({
            uid,
            displayName: currentUser.displayName,
            email: currentUser.email,
            vendorStatus: currentUser.vendorStatus || "approved",
            accountStatus: currentUser.accountStatus || "active",
            isAdmin: currentUser.isAdmin
        });
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

    async function fetchVendorOrders(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const vendorUid = normalizeText(safeOptions.vendorUid);
        const orderService = safeOptions.orderService || resolveGlobal("orderService");
        const db = resolveFirestore(safeOptions.db);
        const firestoreFns = resolveFirestoreFns(safeOptions.firestoreFns);

        if (!vendorUid) {
            return [];
        }

        if (typeof safeOptions.orderReader === "function") {
            const orders = await safeOptions.orderReader(vendorUid, safeOptions);
            return Array.isArray(orders) ? orders : [];
        }

        if (orderService && typeof orderService.getVendorOrders === "function") {
            const orders = await orderService.getVendorOrders({
                ...safeOptions,
                db,
                firestoreFns,
                vendorUid
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
        const ordersQuery = typeof firestoreFns.query === "function" && typeof firestoreFns.where === "function"
            ? firestoreFns.query(collectionRef, firestoreFns.where("vendorUid", "==", vendorUid))
            : collectionRef;
        const snapshot = await firestoreFns.getDocs(ordersQuery);

        return getSnapshotDocuments(snapshot).map(function mapOrder(docSnapshot) {
            return mapDocument(docSnapshot, "orderId");
        });
    }

    async function fetchVendorPayouts(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const vendorUid = normalizeText(safeOptions.vendorUid);
        const payoutQueries = resolvePayoutQueries(safeOptions.payoutQueries);

        if (!vendorUid) {
            return [];
        }

        if (typeof safeOptions.payoutReader === "function") {
            const payouts = await safeOptions.payoutReader(vendorUid, safeOptions);
            return Array.isArray(payouts) ? payouts : [];
        }

        if (payoutQueries && typeof payoutQueries.fetchVendorPayouts === "function") {
            return payoutQueries.fetchVendorPayouts({
                ...safeOptions,
                vendorUid,
                payoutModel: resolvePayoutModel(safeOptions.payoutModel)
            });
        }

        return [];
    }

    function calculateWalletSummary(orders, payouts, options = {}) {
        const platformPricing = resolvePlatformPricing(options.platformPricing);
        const safeOrders = Array.isArray(orders) ? orders : [];
        const safePayouts = Array.isArray(payouts) ? payouts : [];
        const vendorUid = normalizeText(options.vendorUid);
        const balance = platformPricing && typeof platformPricing.calculateVendorBalance === "function"
            ? platformPricing.calculateVendorBalance(safeOrders, safePayouts, options)
            : calculateFallbackVendorBalance(safeOrders, safePayouts, vendorUid);

        const paidWithdrawals = safePayouts
            .filter(function matchPaidPayout(payout) {
                return normalizeLowerText(payout && payout.status) === "paid";
            })
            .reduce(function sumPaid(total, payout) {
                return total + normalizeCurrencyAmount(payout && payout.amount);
            }, 0);
        const pendingPayouts = safePayouts
            .filter(function matchActivePayout(payout) {
                const status = normalizeLowerText(payout && payout.status) || "pending";
                return status === "pending" || status === "approved";
            }).length;

        return {
            vendorUid: balance.vendorUid || vendorUid,
            completedOrders: balance.completedOrders || 0,
            totalEarned: normalizeCurrencyAmount(balance.totalEarned),
            reservedWithdrawals: normalizeCurrencyAmount(balance.reservedWithdrawals),
            availableBalance: normalizeCurrencyAmount(balance.availableBalance),
            paidWithdrawals: normalizeCurrencyAmount(paidWithdrawals),
            pendingPayouts,
            payoutCount: safePayouts.length
        };
    }

    function calculateFallbackVendorBalance(orders, payouts, vendorUid) {
        const completedOrders = orders.filter(function matchCompleted(order) {
            const status = normalizeLowerText(order && (order.status || order.orderStatus));
            const paymentStatus = normalizeLowerText(order && (order.paymentStatus || order.paymentState));
            const orderVendorUid = normalizeText(order && order.vendorUid);

            return status === "completed" &&
                (!paymentStatus || paymentStatus === "paid") &&
                (!vendorUid || orderVendorUid === vendorUid);
        });
        const totalEarned = completedOrders.reduce(function sumOrders(total, order) {
            return total + normalizeCurrencyAmount(
                order.vendorEarnings !== undefined
                    ? order.vendorEarnings
                    : order.vendorSubtotal !== undefined
                        ? order.vendorSubtotal
                        : order.total
            );
        }, 0);
        const reservedWithdrawals = payouts.reduce(function sumPayouts(total, payout) {
            const status = normalizeLowerText(payout && payout.status) || "pending";
            const payoutVendorUid = normalizeText(payout && payout.vendorUid);
            const reservesBalance = ["pending", "approved", "paid"].indexOf(status) >= 0;

            return reservesBalance && (!vendorUid || payoutVendorUid === vendorUid)
                ? total + normalizeCurrencyAmount(payout && payout.amount)
                : total;
        }, 0);

        return {
            vendorUid,
            completedOrders: completedOrders.length,
            totalEarned: normalizeCurrencyAmount(totalEarned),
            reservedWithdrawals: normalizeCurrencyAmount(reservedWithdrawals),
            availableBalance: normalizeCurrencyAmount(totalEarned - reservedWithdrawals)
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

    function getNextWalletAction(summary, payouts, options = {}) {
        const safeSummary = summary && typeof summary === "object"
            ? summary
            : calculateWalletSummary([], [], options);
        const payoutList = Array.isArray(payouts) ? payouts : [];
        const approvedPayout = sortPayoutsOldestFirst(payoutList).find(function findApproved(payout) {
            return normalizeLowerText(payout && payout.status) === "approved";
        });
        const pendingPayout = sortPayoutsOldestFirst(payoutList).find(function findPending(payout) {
            const status = normalizeLowerText(payout && payout.status) || "pending";
            return status === "pending";
        });
        const activePayout = approvedPayout || pendingPayout;

        if (activePayout) {
            const status = normalizeLowerText(activePayout.status) || "pending";
            const amount = formatCurrency(activePayout.amount);
            const payoutId = normalizeText(activePayout.payoutId) || "this request";
            const requestedAt = formatDateTime(activePayout.requestedAt || activePayout.createdAt);

            if (status === "approved") {
                return {
                    label: "Next: payout processing",
                    detail: `${payoutId} for ${amount} is approved and waiting to be marked paid.`
                };
            }

            return {
                label: "Next: admin review",
                detail: `${payoutId} for ${amount} has been waiting since ${requestedAt}.`
            };
        }

        if (normalizeCurrencyAmount(safeSummary.availableBalance) > 0) {
            return {
                label: "Next: request withdrawal",
                detail: `${formatCurrency(safeSummary.availableBalance)} is available for a simulated payout request.`
            };
        }

        return {
            label: "Next: keep earning",
            detail: "Completed paid orders will increase the available balance."
        };
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

    function setFieldError(input, errorElement, message) {
        const text = normalizeText(message);

        if (input) {
            input.setAttribute("aria-invalid", text ? "true" : "false");
        }

        if (errorElement) {
            errorElement.textContent = text;
            errorElement.hidden = !text;
        }
    }

    function clearWithdrawalErrors(elements) {
        const safeElements = elements && typeof elements === "object" ? elements : getPageElements();
        Object.keys(safeElements.errorElements || {}).forEach(function clearOneError(field) {
            setFieldError(safeElements.inputs[field], safeElements.errorElements[field], "");
        });
    }

    function getPageElements(rootDocument) {
        const doc = rootDocument || (globalScope && globalScope.document);

        if (!doc) {
            return {};
        }

        const inputs = {
            amount: doc.getElementById("withdrawal-amount"),
            fakeBankName: doc.getElementById("fake-bank-name"),
            fakeAccountHolder: doc.getElementById("fake-account-holder"),
            fakeAccountNumber: doc.getElementById("fake-account-number"),
            fakeBranchCode: doc.getElementById("fake-branch-code"),
            fakeAccountType: doc.getElementById("fake-account-type"),
            notes: doc.getElementById("withdrawal-notes")
        };

        return {
            statusElement: doc.getElementById("wallet-status"),
            refreshButton: doc.getElementById("refresh-wallet-button"),
            form: doc.getElementById("withdrawal-form"),
            requestButton: doc.getElementById("request-withdrawal-button"),
            clearButton: doc.getElementById("clear-withdrawal-form-button"),
            availableBalanceElement: doc.getElementById("wallet-available-balance"),
            totalEarnedElement: doc.getElementById("wallet-total-earned"),
            reservedWithdrawalsElement: doc.getElementById("wallet-reserved-withdrawals"),
            completedOrdersElement: doc.getElementById("wallet-completed-orders"),
            nextActionElement: doc.getElementById("wallet-next-action"),
            nextActionDetailElement: doc.getElementById("wallet-next-action-detail"),
            payoutHistorySummaryElement: doc.getElementById("payout-history-summary"),
            payoutHistoryListElement: doc.getElementById("payout-history-list"),
            inputs,
            errorElements: {
                amount: doc.getElementById("withdrawal-amount-error"),
                fakeBankName: doc.getElementById("withdrawal-fakeBankName-error"),
                fakeAccountHolder: doc.getElementById("withdrawal-fakeAccountHolder-error"),
                fakeAccountNumber: doc.getElementById("withdrawal-fakeAccountNumber-error"),
                fakeBranchCode: doc.getElementById("withdrawal-fakeBranchCode-error")
            }
        };
    }

    function renderWalletSummary(summary, elements, options = {}) {
        const safeSummary = summary && typeof summary === "object"
            ? summary
            : calculateWalletSummary([], [], options);
        const safeElements = elements && typeof elements === "object" ? elements : {};
        const nextAction = getNextWalletAction(safeSummary, options.payouts, options);

        setText(safeElements.availableBalanceElement, formatCurrency(safeSummary.availableBalance));
        setText(safeElements.totalEarnedElement, formatCurrency(safeSummary.totalEarned));
        setText(safeElements.reservedWithdrawalsElement, formatCurrency(safeSummary.reservedWithdrawals));
        setText(safeElements.completedOrdersElement, String(safeSummary.completedOrders || 0));
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

    function renderPayoutHistory(payouts, elements, options = {}) {
        const safeElements = elements && typeof elements === "object" ? elements : {};
        const container = safeElements.payoutHistoryListElement;
        const summaryElement = safeElements.payoutHistorySummaryElement;
        const doc = container ? container.ownerDocument : null;
        const payoutList = sortPayoutsNewestFirst(payouts);

        if (summaryElement) {
            const activeCount = payoutList.filter(function matchActive(payout) {
                const status = normalizeLowerText(payout && payout.status) || "pending";
                return status === "pending" || status === "approved";
            }).length;

            summaryElement.textContent = payoutList.length === 0
                ? "No withdrawal requests yet."
                : `${payoutList.length} request${payoutList.length === 1 ? "" : "s"} total, ${activeCount} active.`;
        }

        if (!container || !doc) {
            return;
        }

        container.innerHTML = "";

        if (payoutList.length === 0) {
            container.appendChild(createElement(
                doc,
                "p",
                "wallet-empty-state",
                "No simulated payout requests yet."
            ));
            return;
        }

        payoutList.forEach(function renderOnePayout(payout) {
            const safePayout = payout && typeof payout === "object" ? payout : {};
            const status = normalizeLowerText(safePayout.status) || "pending";
            const article = createElement(doc, "article", "payout-card");
            const header = createElement(doc, "header", "payout-card-header");
            const titleWrap = createElement(doc, "section", "payout-card-title-wrap");
            const title = createElement(doc, "h4", "payout-card-title", safePayout.payoutId || "Withdrawal request");
            const amount = createElement(doc, "span", "payout-card-amount", formatCurrency(safePayout.amount));
            const statusPill = createElement(doc, "span", "payout-status", getPayoutStatusLabel(status, options.payoutModel));
            const details = createElement(doc, "section", "payout-card-details");

            statusPill.setAttribute("data-status", status);
            titleWrap.appendChild(title);
            titleWrap.appendChild(amount);
            header.appendChild(titleWrap);
            header.appendChild(statusPill);

            [
                `Requested: ${formatDateTime(safePayout.requestedAt || safePayout.createdAt)}`,
                `Bank: ${normalizeText(safePayout.fakeBankName) || "Fake bank not recorded"}`,
                `Account: ${normalizeText(safePayout.fakeAccountNumberMasked) || "No masked account"}`
            ].forEach(function addDetail(text) {
                details.appendChild(createElement(doc, "p", "", text));
            });

            if (normalizeText(safePayout.notes)) {
                details.appendChild(createElement(doc, "p", "", `Notes: ${normalizeText(safePayout.notes)}`));
            }

            article.appendChild(header);
            article.appendChild(details);
            container.appendChild(article);
        });
    }

    function renderWallet(summary, payouts, elements, options = {}) {
        renderWalletSummary(summary, elements, {
            ...options,
            payouts
        });
        renderPayoutHistory(payouts, elements, options);
    }

    function collectWithdrawalFormValues(elements) {
        const safeElements = elements && typeof elements === "object" ? elements : getPageElements();
        const inputs = safeElements.inputs || {};

        return {
            amount: inputs.amount ? inputs.amount.value : "",
            fakeBankName: inputs.fakeBankName ? inputs.fakeBankName.value : "",
            fakeAccountHolder: inputs.fakeAccountHolder ? inputs.fakeAccountHolder.value : "",
            fakeAccountNumber: inputs.fakeAccountNumber ? inputs.fakeAccountNumber.value : "",
            fakeBranchCode: inputs.fakeBranchCode ? inputs.fakeBranchCode.value : "",
            fakeAccountType: inputs.fakeAccountType ? inputs.fakeAccountType.value : "cheque",
            notes: inputs.notes ? inputs.notes.value : ""
        };
    }

    function validateWithdrawal(values, context = {}) {
        const payoutModel = resolvePayoutModel(context.payoutModel);
        const safeValues = values && typeof values === "object" ? values : {};
        const availableBalance = normalizeCurrencyAmount(context.availableBalance);
        const payload = {
            ...safeValues,
            amount: normalizeCurrencyAmount(safeValues.amount),
            vendorUid: normalizeText(context.vendorUid || safeValues.vendorUid),
            vendorName: normalizeText(context.vendorName || safeValues.vendorName) || "Vendor User",
            vendorEmail: normalizeLowerText(context.vendorEmail || safeValues.vendorEmail)
        };

        if (payoutModel && typeof payoutModel.validatePayoutRequestInput === "function") {
            return payoutModel.validatePayoutRequestInput(payload, {
                availableBalance,
                vendorUid: payload.vendorUid,
                vendorName: payload.vendorName,
                vendorEmail: payload.vendorEmail
            });
        }

        const errors = {};

        if (!payload.vendorUid) {
            errors.vendorUid = "Vendor UID is required.";
        }

        if (normalizeCurrencyAmount(payload.amount) <= 0) {
            errors.amount = "Withdrawal amount must be greater than zero.";
        } else if (normalizeCurrencyAmount(payload.amount) > availableBalance) {
            errors.amount = "Withdrawal amount cannot exceed the available balance.";
        }

        if (!normalizeText(payload.fakeBankName)) {
            errors.fakeBankName = "Fake bank name is required.";
        }

        if (!normalizeText(payload.fakeAccountHolder)) {
            errors.fakeAccountHolder = "Fake account holder is required.";
        }

        if (normalizeText(payload.fakeAccountNumber).replace(/\D+/g, "").length < 6) {
            errors.fakeAccountNumber = "Fake account number must have at least 6 digits.";
        }

        if (!normalizeText(payload.fakeBranchCode)) {
            errors.fakeBranchCode = "Fake branch code is required.";
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors,
            value: payload
        };
    }

    function renderWithdrawalErrors(errors, elements) {
        const safeErrors = errors && typeof errors === "object" ? errors : {};
        const safeElements = elements && typeof elements === "object" ? elements : {};
        const errorElements = safeElements.errorElements || {};
        const inputs = safeElements.inputs || {};

        ["amount", "fakeBankName", "fakeAccountHolder", "fakeAccountNumber", "fakeBranchCode"].forEach(function renderOneError(field) {
            setFieldError(inputs[field], errorElements[field], safeErrors[field] || "");
        });
    }

    function resetWithdrawalForm(elements) {
        const safeElements = elements && typeof elements === "object" ? elements : getPageElements();

        if (safeElements.form && typeof safeElements.form.reset === "function") {
            safeElements.form.reset();
        }

        clearWithdrawalErrors(safeElements);
    }

    function setRequestButtonBusy(elements, isBusy) {
        const button = elements && elements.requestButton;

        if (!button) {
            return;
        }

        button.disabled = isBusy === true;
        button.textContent = isBusy === true ? "Submitting..." : "Request Withdrawal";
    }

    function createVendorWalletPage(dependencies = {}) {
        const elements = dependencies.elements || getPageElements(dependencies.document);
        const state = {
            currentUser: null,
            vendorProfile: null,
            orders: [],
            payouts: [],
            summary: calculateWalletSummary([], [], dependencies),
            loading: false
        };

        async function loadWalletData(loadOptions = {}) {
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
                    state.vendorProfile = null;
                    state.orders = [];
                    state.payouts = [];
                    state.summary = calculateWalletSummary([], [], options);
                    renderWallet(state.summary, state.payouts, elements, options);
                    setStatusMessage(elements.statusElement, STATUS_MESSAGES.signedOut, "error");

                    return {
                        success: false,
                        error: { code: "wallet/signed-out", message: STATUS_MESSAGES.signedOut }
                    };
                }

                const vendorProfile = await fetchVendorProfile({
                    ...options,
                    currentUser,
                    db,
                    firestoreFns
                });

                if (!canAccessVendorWallet(vendorProfile, authUtils)) {
                    state.currentUser = currentUser;
                    state.vendorProfile = vendorProfile;
                    state.orders = [];
                    state.payouts = [];
                    state.summary = calculateWalletSummary([], [], options);
                    renderWallet(state.summary, state.payouts, elements, options);
                    setStatusMessage(elements.statusElement, STATUS_MESSAGES.denied, "error");

                    return {
                        success: false,
                        vendorProfile,
                        error: { code: "wallet/access-denied", message: STATUS_MESSAGES.denied }
                    };
                }

                const vendorUid = normalizeText(vendorProfile.uid || currentUser.uid);
                const orders = await fetchVendorOrders({
                    ...options,
                    db,
                    firestoreFns,
                    vendorUid
                });
                const payouts = await fetchVendorPayouts({
                    ...options,
                    db,
                    firestoreFns,
                    vendorUid
                });
                const summary = calculateWalletSummary(orders, payouts, {
                    ...options,
                    vendorUid
                });

                state.currentUser = currentUser;
                state.vendorProfile = vendorProfile;
                state.orders = orders;
                state.payouts = payouts;
                state.summary = summary;

                renderWallet(summary, payouts, elements, options);
                setStatusMessage(elements.statusElement, STATUS_MESSAGES.ready, "success");

                return {
                    success: true,
                    currentUser,
                    vendorProfile,
                    orders,
                    payouts,
                    summary
                };
            } catch (error) {
                console.error(`${MODULE_NAME}: Failed to load wallet.`, error);
                setStatusMessage(
                    elements.statusElement,
                    summarizeWalletError(error),
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

        async function submitWithdrawalRequest(event, submitOptions = {}) {
            if (event && typeof event.preventDefault === "function") {
                event.preventDefault();
            }

            const options = {
                ...dependencies,
                ...submitOptions
            };
            const payoutModel = resolvePayoutModel(options.payoutModel);
            const payoutService = resolvePayoutService(options.payoutService);
            const vendorProfile = normalizeVendorProfile(state.vendorProfile);
            const values = collectWithdrawalFormValues(elements);
            const validation = validateWithdrawal(values, {
                payoutModel,
                availableBalance: state.summary.availableBalance,
                vendorUid: vendorProfile.uid,
                vendorName: vendorProfile.displayName,
                vendorEmail: vendorProfile.email
            });

            renderWithdrawalErrors(validation.errors, elements);

            if (!validation.isValid) {
                setStatusMessage(elements.statusElement, "Please fix the withdrawal form errors.", "error");

                return {
                    success: false,
                    validation
                };
            }

            if (!payoutService || typeof payoutService.createPayoutRequest !== "function") {
                setStatusMessage(elements.statusElement, "Payout service is not available.", "error");

                return {
                    success: false,
                    error: { code: "wallet/payout-service-missing", message: "Payout service is not available." }
                };
            }

            setRequestButtonBusy(elements, true);
            setStatusMessage(elements.statusElement, "Submitting withdrawal request...", "loading");

            try {
                const db = resolveFirestore(options.db);
                const firestoreFns = resolveFirestoreFns(options.firestoreFns);
                const result = await payoutService.createPayoutRequest({
                    ...options,
                    db,
                    firestoreFns,
                    payoutModel,
                    payout: {
                        ...values,
                        amount: normalizeCurrencyAmount(values.amount),
                        vendorUid: vendorProfile.uid,
                        vendorName: vendorProfile.displayName,
                        vendorEmail: vendorProfile.email
                    },
                    availableBalance: state.summary.availableBalance
                });

                if (!result || result.success !== true) {
                    const message = result && result.error && result.error.message
                        ? result.error.message
                        : "Withdrawal request could not be submitted.";
                    setStatusMessage(elements.statusElement, message, "error");

                    return {
                        success: false,
                        result
                    };
                }

                const createdPayout = result.payout;
                state.payouts = createdPayout
                    ? [createdPayout].concat(state.payouts)
                    : state.payouts.slice();
                state.summary = calculateWalletSummary(state.orders, state.payouts, {
                    ...options,
                    vendorUid: vendorProfile.uid
                });

                renderWallet(state.summary, state.payouts, elements, options);
                resetWithdrawalForm(elements);
                setStatusMessage(elements.statusElement, STATUS_MESSAGES.saved, "success");

                return {
                    success: true,
                    payout: createdPayout,
                    summary: state.summary,
                    result
                };
            } catch (error) {
                console.error(`${MODULE_NAME}: Failed to submit withdrawal request.`, error);
                // Use summarizeWalletError so vendors see a friendly message
                // rather than the raw Firestore text (e.g. "Missing or
                // insufficient permissions.") when the rules deny the write.
                setStatusMessage(
                    elements.statusElement,
                    summarizeWalletError(error),
                    "error"
                );

                return {
                    success: false,
                    error
                };
            } finally {
                setRequestButtonBusy(elements, false);
            }
        }

        function attachHandlers() {
            if (elements.refreshButton) {
                elements.refreshButton.addEventListener("click", function onRefreshClick() {
                    loadWalletData();
                });
            }

            if (elements.form) {
                elements.form.addEventListener("submit", submitWithdrawalRequest);
                elements.form.addEventListener("reset", function onReset() {
                    setTimeout(function afterReset() {
                        clearWithdrawalErrors(elements);
                    }, 0);
                });
            }
        }

        return {
            elements,
            state,
            loadWalletData,
            submitWithdrawalRequest,
            attachHandlers,
            renderWallet: function renderCurrentWallet() {
                renderWallet(state.summary, state.payouts, elements, dependencies);
            }
        };
    }

    async function initializeVendorWalletPage(options = {}) {
        const page = createVendorWalletPage(options);

        page.attachHandlers();
        const result = await page.loadWalletData(options);

        return {
            ...result,
            page
        };
    }

    const vendorWalletPage = {
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
        normalizeVendorProfile,
        canAccessVendorWallet,
        fetchVendorProfile,
        getSnapshotDocuments,
        mapDocument,
        fetchVendorOrders,
        fetchVendorPayouts,
        calculateFallbackVendorBalance,
        calculateWalletSummary,
        getTimestampDate,
        formatDateTime,
        sortPayoutsNewestFirst,
        sortPayoutsOldestFirst,
        getNextWalletAction,
        setText,
        setStatusMessage,
        setFieldError,
        clearWithdrawalErrors,
        getPageElements,
        renderWalletSummary,
        getPayoutStatusLabel,
        renderPayoutHistory,
        renderWallet,
        collectWithdrawalFormValues,
        validateWithdrawal,
        renderWithdrawalErrors,
        resetWithdrawalForm,
        createVendorWalletPage,
        initializeVendorWalletPage
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = vendorWalletPage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.vendorWalletPage = vendorWalletPage;
    }
})(typeof window !== "undefined" ? window : globalThis);
