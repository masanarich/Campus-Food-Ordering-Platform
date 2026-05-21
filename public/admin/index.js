/**
 * admin/index.js
 *
 * Admin dashboard logic for authenticated admin users.
 * This file:
 * - loads the signed-in user's profile
 * - renders account and access summaries
 * - separates admin tools from portal switching
 * - loads real finance summary data from Firestore orders
 * - supports sign out
 */

(function attachAdminHomePage(globalScope) {
    "use strict";

    const MODULE_NAME = "admin/index";
    const ORDERS_COLLECTION = "orders";
    const DEFAULT_CURRENCY = "ZAR";
    const DEFAULT_AUTH_TIMEOUT_MS = 5000;

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
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
        const label = safeCurrency.toUpperCase() === "ZAR"
            ? "R"
            : safeCurrency.toUpperCase();

        return `${label} ${normalizeCurrencyAmount(amount).toFixed(2)}`;
    }

    function setText(elementOrId, value) {
        const element = typeof elementOrId === "string"
            ? document.getElementById(elementOrId)
            : elementOrId;

        if (element) {
            element.textContent = value === undefined || value === null ? "" : String(value);
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

    function resolveAuthUtils(explicitUtils) {
        return explicitUtils || resolveGlobal("authUtils") || null;
    }

    function resolvePlatformPricing(explicitPlatformPricing) {
        if (
            explicitPlatformPricing &&
            typeof explicitPlatformPricing.calculatePlatformBalance === "function"
        ) {
            return explicitPlatformPricing;
        }

        const globalPlatformPricing = resolveGlobal("platformPricing");

        if (
            globalPlatformPricing &&
            typeof globalPlatformPricing.calculatePlatformBalance === "function"
        ) {
            return globalPlatformPricing;
        }

        if (typeof require === "function") {
            try {
                const requiredPlatformPricing = require("../shared/finance/platform-pricing.js");

                if (
                    requiredPlatformPricing &&
                    typeof requiredPlatformPricing.calculatePlatformBalance === "function"
                ) {
                    return requiredPlatformPricing;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function getFallbackRoutes() {
        return {
            customer: "../customer/index.html",
            vendor: "../vendor/index.html",
            admin: "./index.html",
            rolechoice: "../authentication/role-choice.html",
            profile: "../authentication/profile.html",
            users: "./users.html",
            finance: "./finance.html",
            disputes: "./disputes.html",
            ticketdetail: "./ticket-detail.html",
            analytics: "./analytics.html",
            login: "../authentication/login.html"
        };
    }

    function getPortalRoute(routeName, authUtils) {
        const routes = getFallbackRoutes();
        const key = normalizeLowerText(routeName);

        if (
            authUtils &&
            typeof authUtils.getPortalRoute === "function" &&
            (key === "customer" || key === "vendor" || key === "admin")
        ) {
            return authUtils.getPortalRoute(key);
        }

        if (
            authUtils &&
            authUtils.PORTAL_ROUTES &&
            typeof authUtils.PORTAL_ROUTES === "object"
        ) {
            if (key === "customer") return authUtils.PORTAL_ROUTES.customer || routes.customer;
            if (key === "vendor") return authUtils.PORTAL_ROUTES.vendor || routes.vendor;
            if (key === "admin") return authUtils.PORTAL_ROUTES.admin || routes.admin;
            if (key === "rolechoice") return authUtils.PORTAL_ROUTES.roleChoice || routes.rolechoice;
            if (key === "login" || key === "signout") return authUtils.PORTAL_ROUTES.login || routes.login;
        }

        if (Object.prototype.hasOwnProperty.call(routes, key)) {
            return routes[key];
        }

        return routes.login;
    }

    function navigateTo(route) {
        if (!route) return;

        if (typeof window !== "undefined" && window.location) {
            window.location.href = route;
        }
    }

    function normalizeVendorStatus(status) {
        const value = normalizeLowerText(status);

        if (value === "suspended") return "blocked";

        if (
            value === "none" ||
            value === "pending" ||
            value === "approved" ||
            value === "rejected" ||
            value === "blocked"
        ) {
            return value;
        }

        return "none";
    }

    function normalizeAdminApplicationStatus(status, isAdmin = false) {
        const value = normalizeLowerText(status);

        if (isAdmin === true) return "approved";
        if (value === "suspended") return "blocked";

        if (
            value === "none" ||
            value === "pending" ||
            value === "approved" ||
            value === "rejected" ||
            value === "blocked"
        ) {
            return value;
        }

        return "none";
    }

    function normalizeAccountStatus(status) {
        const value = normalizeLowerText(status);

        if (value === "disabled" || value === "blocked") {
            return value;
        }

        return "active";
    }

    function hasAuthenticatedIdentity(profile) {
        const safeProfile = profile && typeof profile === "object" ? profile : {};

        return (
            normalizeText(safeProfile.uid).length > 0 ||
            normalizeText(safeProfile.email).length > 0 ||
            normalizeText(safeProfile.phoneNumber).length > 0
        );
    }

    function normalizeProfile(profile, authUtils) {
        if (authUtils && typeof authUtils.normaliseUserData === "function") {
            return authUtils.normaliseUserData(profile);
        }

        if (authUtils && typeof authUtils.normalizeUserData === "function") {
            return authUtils.normalizeUserData(profile);
        }

        const safeProfile = profile && typeof profile === "object" ? profile : {};
        const isAdmin = safeProfile.isAdmin === true || safeProfile.admin === true;

        return {
            uid: normalizeText(safeProfile.uid),
            displayName: normalizeText(safeProfile.displayName || safeProfile.fullName),
            email: normalizeLowerText(safeProfile.email),
            phoneNumber: normalizeText(safeProfile.phoneNumber),
            photoURL: normalizeText(safeProfile.photoURL),
            isAdmin,
            vendorStatus: normalizeVendorStatus(safeProfile.vendorStatus),
            vendorReason: normalizeText(
                safeProfile.vendorReason ||
                safeProfile.rejectionReason ||
                safeProfile.blockReason
            ),
            adminApplicationStatus: normalizeAdminApplicationStatus(
                safeProfile.adminApplicationStatus,
                isAdmin
            ),
            adminApplicationReason: normalizeText(
                safeProfile.adminApplicationReason ||
                safeProfile.adminRejectionReason ||
                safeProfile.adminBlockReason
            ),
            accountStatus: normalizeAccountStatus(safeProfile.accountStatus)
        };
    }

    function canAccessCustomerPortal(profile, authUtils) {
        const safeProfile = normalizeProfile(profile, authUtils);

        if (authUtils && typeof authUtils.canAccessCustomerPortal === "function") {
            return authUtils.canAccessCustomerPortal(safeProfile);
        }

        return safeProfile.accountStatus === "active" && hasAuthenticatedIdentity(safeProfile);
    }

    function canAccessVendorPortal(profile, authUtils) {
        const safeProfile = normalizeProfile(profile, authUtils);

        if (authUtils && typeof authUtils.canAccessVendorPortal === "function") {
            return authUtils.canAccessVendorPortal(safeProfile);
        }

        return safeProfile.accountStatus === "active" && safeProfile.vendorStatus === "approved";
    }

    function canAccessAdminPortal(profile, authUtils) {
        const safeProfile = normalizeProfile(profile, authUtils);

        if (authUtils && typeof authUtils.canAccessAdminPortal === "function") {
            return authUtils.canAccessAdminPortal(safeProfile);
        }

        return safeProfile.accountStatus === "active" && safeProfile.isAdmin === true;
    }

    function getRoleLabel(profile, authUtils) {
        const safeProfile = normalizeProfile(profile, authUtils);

        if (safeProfile.isAdmin === true && safeProfile.vendorStatus === "approved") {
            return "Admin and Vendor";
        }

        if (safeProfile.isAdmin === true) return "Admin";
        if (safeProfile.vendorStatus === "approved") return "Vendor";

        return "Customer";
    }

    function getVendorStatusLabel(profile, authUtils) {
        const safeProfile = normalizeProfile(profile, authUtils);

        if (safeProfile.vendorStatus === "approved") return "Approved";
        if (safeProfile.vendorStatus === "pending") return "Pending";
        if (safeProfile.vendorStatus === "rejected") return "Rejected";
        if (safeProfile.vendorStatus === "blocked") return "Blocked";

        return "Not Applied";
    }

    function getAdminStatusLabel(profile, authUtils) {
        const safeProfile = normalizeProfile(profile, authUtils);

        if (safeProfile.isAdmin === true) return "Approved";
        if (safeProfile.adminApplicationStatus === "pending") return "Pending";
        if (safeProfile.adminApplicationStatus === "rejected") return "Rejected";
        if (safeProfile.adminApplicationStatus === "blocked") return "Blocked";

        return "Not Applied";
    }

    function getPortalSummary(state) {
        if (!state) return "";

        if (state.showCustomerPortal && state.showVendorPortal && state.showAdminPortal) {
            return "You can switch between the customer, vendor, and admin portals.";
        }

        if (state.showCustomerPortal && state.showAdminPortal) {
            return "You can switch between the customer and admin portals.";
        }

        if (state.showVendorPortal && state.showAdminPortal) {
            return "You can switch between the vendor and admin portals.";
        }

        if (state.showAdminPortal) {
            return "You currently have admin portal access only.";
        }

        return "You do not currently have portal access.";
    }

    function getManagementSummary(profile, authUtils) {
        const safeProfile = normalizeProfile(profile, authUtils);

        if (safeProfile.vendorStatus === "approved") {
            return "Manage users, review applications, and keep an eye on platform issues while still having vendor access.";
        }

        return "Manage users, review applications, and prepare to handle customer support disputes from this portal.";
    }

    function getAdminAccessNote(profile, authUtils) {
        const safeProfile = normalizeProfile(profile, authUtils);

        if (safeProfile.isAdmin === true) {
            return "Your admin access is approved and active.";
        }

        return "Admin access is not available right now.";
    }

    function getWelcomeMessage(profile, authUtils) {
        const safeProfile = normalizeProfile(profile, authUtils);
        const name = normalizeText(safeProfile.displayName) || "there";

        return `Welcome back, ${name}.`;
    }

    function getHomeState(profile, authUtils) {
        const safeProfile = normalizeProfile(profile, authUtils);
        const showCustomerPortal = canAccessCustomerPortal(safeProfile, authUtils);
        const showVendorPortal = canAccessVendorPortal(safeProfile, authUtils);
        const showAdminPortal = canAccessAdminPortal(safeProfile, authUtils);
        const displayName = normalizeText(safeProfile.displayName) || "Admin User";

        return {
            profile: safeProfile,
            displayName,
            roleLabel: getRoleLabel(safeProfile, authUtils),
            vendorStatusLabel: getVendorStatusLabel(safeProfile, authUtils),
            adminStatusLabel: getAdminStatusLabel(safeProfile, authUtils),
            adminAccessNote: getAdminAccessNote(safeProfile, authUtils),
            managementSummary: getManagementSummary(safeProfile, authUtils),
            welcomeMessage: getWelcomeMessage(safeProfile, authUtils),
            showCustomerPortal,
            showVendorPortal,
            showAdminPortal
        };
    }

    function isCompletedPaidOrder(order) {
        const safeOrder = order && typeof order === "object" ? order : {};
        const status = normalizeLowerText(safeOrder.status || safeOrder.orderStatus);
        const paymentStatus = normalizeLowerText(safeOrder.paymentStatus || safeOrder.paymentState);

        return status === "completed" && (!paymentStatus || paymentStatus === "paid");
    }

    function getDefaultFinanceSummary() {
        return {
            completedOrders: 0,
            customerRevenue: 0,
            platformEarnings: 0,
            platformBalance: 0,
            vendorEarnings: 0
        };
    }

    function calculateAdminFinanceSummary(orders, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeOrders = Array.isArray(orders) ? orders : [];
        const platformPricing = resolvePlatformPricing(safeOptions.platformPricing);

        const completedOrders = safeOrders.filter(function matchCompleted(order) {
            if (platformPricing && typeof platformPricing.isCompletedPaidOrder === "function") {
                return platformPricing.isCompletedPaidOrder(order);
            }

            return isCompletedPaidOrder(order);
        });

        const platformBalance = platformPricing && typeof platformPricing.calculatePlatformBalance === "function"
            ? platformPricing.calculatePlatformBalance(safeOrders, safeOptions)
            : null;

        const vendorEarnings = completedOrders.reduce(function sumVendor(total, order) {
            if (platformPricing && typeof platformPricing.getOrderVendorEarnings === "function") {
                return normalizeCurrencyAmount(total + platformPricing.getOrderVendorEarnings(order, safeOptions));
            }

            const safeOrder = order && typeof order === "object" ? order : {};
            const amount = safeOrder.vendorEarnings !== undefined
                ? safeOrder.vendorEarnings
                : safeOrder.vendorSubtotal !== undefined
                    ? safeOrder.vendorSubtotal
                    : safeOrder.total;

            return normalizeCurrencyAmount(total + normalizeCurrencyAmount(amount));
        }, 0);

        if (platformBalance) {
            return {
                ...getDefaultFinanceSummary(),
                completedOrders: platformBalance.completedOrders || completedOrders.length,
                customerRevenue: normalizeCurrencyAmount(platformBalance.customerRevenue),
                platformEarnings: normalizeCurrencyAmount(platformBalance.platformEarnings),
                platformBalance: normalizeCurrencyAmount(platformBalance.platformBalance),
                vendorEarnings: normalizeCurrencyAmount(vendorEarnings)
            };
        }

        const customerRevenue = completedOrders.reduce(function sumRevenue(total, order) {
            const safeOrder = order && typeof order === "object" ? order : {};
            const amount = safeOrder.paymentAmount !== undefined
                ? safeOrder.paymentAmount
                : safeOrder.total !== undefined
                    ? safeOrder.total
                    : safeOrder.totalAmount;

            return normalizeCurrencyAmount(total + normalizeCurrencyAmount(amount));
        }, 0);

        const platformEarnings = completedOrders.reduce(function sumPlatform(total, order) {
            const safeOrder = order && typeof order === "object" ? order : {};
            const amount = safeOrder.platformEarnings !== undefined
                ? safeOrder.platformEarnings
                : safeOrder.platformFee;

            return normalizeCurrencyAmount(total + normalizeCurrencyAmount(amount));
        }, 0);

        return {
            completedOrders: completedOrders.length,
            customerRevenue,
            platformEarnings,
            platformBalance: platformEarnings,
            vendorEarnings: normalizeCurrencyAmount(vendorEarnings)
        };
    }

    function getSnapshotDocuments(snapshot) {
        if (!snapshot) return [];

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

    function mapOrderDocument(docSnapshot) {
        const data = docSnapshot && typeof docSnapshot.data === "function"
            ? docSnapshot.data() || {}
            : {};
        const id = normalizeText(docSnapshot && docSnapshot.id);

        return {
            orderId: id || normalizeText(data.orderId),
            ...data
        };
    }

    async function fetchFinanceOrders(dependencies = {}) {
        const safeDependencies = dependencies && typeof dependencies === "object" ? dependencies : {};

        if (typeof safeDependencies.orderReader === "function") {
            const orders = await safeDependencies.orderReader(safeDependencies);
            return Array.isArray(orders) ? orders : [];
        }

        const orderService = safeDependencies.orderService || resolveGlobal("orderService");

        if (orderService && typeof orderService.getAllOrders === "function") {
            const orders = await orderService.getAllOrders(safeDependencies);
            return Array.isArray(orders) ? orders : [];
        }

        const db = safeDependencies.db || resolveGlobal("db");
        const firestoreFns = safeDependencies.firestoreFns || resolveGlobal("firestoreFns") || {};

        if (
            !db ||
            typeof firestoreFns.collection !== "function" ||
            typeof firestoreFns.getDocs !== "function"
        ) {
            return [];
        }

        const collectionRef = firestoreFns.collection(db, ORDERS_COLLECTION);
        let ordersQuery = collectionRef;

        if (typeof firestoreFns.query === "function" && typeof firestoreFns.orderBy === "function") {
            ordersQuery = firestoreFns.query(collectionRef, firestoreFns.orderBy("createdAt", "desc"));
        }

        const snapshot = await firestoreFns.getDocs(ordersQuery);

        return getSnapshotDocuments(snapshot).map(mapOrderDocument);
    }

    async function loadAdminFinanceSummary(dependencies = {}) {
        const safeDependencies = dependencies && typeof dependencies === "object" ? dependencies : {};

        try {
            if (typeof safeDependencies.financeLoader === "function") {
                const financeData = await safeDependencies.financeLoader(safeDependencies);
                const safeFinanceData = financeData && typeof financeData === "object" ? financeData : {};
                const orders = Array.isArray(safeFinanceData.orders) ? safeFinanceData.orders : [];

                return {
                    summary: calculateAdminFinanceSummary(orders, safeDependencies),
                    error: null
                };
            }

            const orders = Array.isArray(safeDependencies.orders)
                ? safeDependencies.orders
                : await fetchFinanceOrders(safeDependencies);

            return {
                summary: calculateAdminFinanceSummary(orders, safeDependencies),
                error: null
            };
        } catch (error) {
            console.error(`${MODULE_NAME}: Failed to load finance summary.`, error);

            return {
                summary: getDefaultFinanceSummary(),
                error
            };
        }
    }

    function renderAdminFinanceSummary(summary, error) {
        const safeSummary = summary && typeof summary === "object"
            ? summary
            : getDefaultFinanceSummary();

        setText("admin-platform-balance", formatCurrency(safeSummary.platformBalance));
        setText("admin-customer-revenue", formatCurrency(safeSummary.customerRevenue));
        setText("admin-vendor-earnings", formatCurrency(safeSummary.vendorEarnings));
        setText("admin-completed-orders", safeSummary.completedOrders || 0);

        if (error) {
            setText("admin-finance-note", "Finance figures could not be loaded. Open Finance to refresh or check permissions.");
            return;
        }

        if ((safeSummary.completedOrders || 0) === 0) {
            setText("admin-finance-note", "No completed paid orders have been counted yet.");
            return;
        }

        setText(
            "admin-finance-note",
            `Showing live figures from ${safeSummary.completedOrders} completed paid order(s).`
        );
    }

    async function refreshAdminFinanceSummary(dependencies = {}) {
        setText("admin-finance-note", "Loading platform finance figures...");

        const result = await loadAdminFinanceSummary(dependencies);

        renderAdminFinanceSummary(result.summary, result.error);

        return result;
    }

    function renderProfileSnapshot(state) {
        const profile = state.profile || {};

        setText("profile-name-line", state.displayName || "Admin User");
        setText("profile-role-line", state.roleLabel || "Admin");
        setText("profile-email-line", profile.email || "No email recorded");
        setText("profile-vendor-line", state.vendorStatusLabel || "Not Applied");
        setText("profile-admin-line", state.adminStatusLabel || "Not Applied");

        const photo = document.getElementById("profile-photo");
        const photoURL = normalizeText(profile.photoURL);

        if (photo) {
            photo.src = photoURL || "../assets/default-profile.png";
            photo.alt = `${state.displayName || "User"} profile picture`;
        }

        setText(
            "profile-photo-caption",
            photoURL ? "Your profile picture is loaded." : "No profile picture has been uploaded yet."
        );
    }

    function renderHomeState(state) {
        setText("admin-access-note", state.adminAccessNote);
        setText("portal-summary", getPortalSummary(state));
        setText("welcome-message", state.welcomeMessage);
        setText("management-summary", state.managementSummary);
        setText("admin-home-status", "Admin dashboard loaded.");

        renderProfileSnapshot(state);

        const customerButton = document.getElementById("go-customer-portal-button");
        const vendorButton = document.getElementById("go-vendor-portal-button");

        if (customerButton) {
            customerButton.disabled = !state.showCustomerPortal;
            customerButton.hidden = !state.showCustomerPortal;
        }

        if (vendorButton) {
            vendorButton.disabled = !state.showVendorPortal;
            vendorButton.hidden = !state.showVendorPortal;
        }
    }

    function waitForAuthReady(auth, authFns, timeoutMs = DEFAULT_AUTH_TIMEOUT_MS) {
        if (!auth || !authFns || typeof authFns.onAuthStateChanged !== "function") {
            return Promise.resolve(auth && auth.currentUser ? auth.currentUser : null);
        }

        return new Promise(function waitForAuth(resolve) {
            let settled = false;
            let unsubscribe = null;

            const timer = setTimeout(function onTimeout() {
                if (settled) return;

                settled = true;

                if (typeof unsubscribe === "function") {
                    unsubscribe();
                }

                resolve(auth.currentUser || null);
            }, timeoutMs);

            unsubscribe = authFns.onAuthStateChanged(auth, function onUser(user) {
                if (settled) return;

                settled = true;
                clearTimeout(timer);

                if (typeof unsubscribe === "function") {
                    unsubscribe();
                }

                resolve(user || null);
            });
        });
    }

    async function loadCurrentUser(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const authService = safeOptions.authService || resolveGlobal("authService");

        if (authService && typeof authService.getCurrentUser === "function") {
            const user = await authService.getCurrentUser();

            if (user) return user;
        }

        const auth = safeOptions.auth || resolveGlobal("auth");
        const authFns = safeOptions.authFns || resolveGlobal("authFns") || {};

        return waitForAuthReady(auth, authFns, safeOptions.authTimeoutMs);
    }

    async function loadCurrentUserProfile(currentUser, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const authService = safeOptions.authService || resolveGlobal("authService");
        const safeUser = currentUser && typeof currentUser === "object" ? currentUser : {};
        const uid = normalizeText(safeUser.uid);

        if (authService && typeof authService.getCurrentUserProfile === "function") {
            try {
                const profile = await authService.getCurrentUserProfile(uid);

                if (profile) {
                    return {
                        uid,
                        displayName: safeUser.displayName,
                        email: safeUser.email,
                        photoURL: safeUser.photoURL,
                        ...profile
                    };
                }
            } catch (error) {
                console.error(`${MODULE_NAME}: Failed to load profile from authService.`, error);
            }
        }

        return safeUser;
    }

    function bindNavigationButtons(authUtils, authService) {
        const routes = getFallbackRoutes();

        const bindings = [
            ["go-profile-button", "profile"],
            ["manage-users-button", "users"],
            ["review-disputes-button", "disputes"],
            ["admin-ticket-detail-link", "ticketdetail"],
            ["finance-button", "finance"],
            ["choose-portal-button", "rolechoice"],
            ["analytics-button", "analytics"],
            ["go-customer-portal-button", "customer"],
            ["go-vendor-portal-button", "vendor"]
        ];

        bindings.forEach(function bindOne(pair) {
            const button = document.getElementById(pair[0]);
            const routeName = pair[1];

            if (!button) return;

            button.addEventListener("click", function onClick() {
                navigateTo(getPortalRoute(routeName, authUtils));
            });
        });

        const signOutButton = document.getElementById("sign-out-button");

        if (signOutButton) {
            signOutButton.addEventListener("click", async function onSignOut() {
                try {
                    if (authService && typeof authService.signOut === "function") {
                        await authService.signOut();
                    } else if (authService && typeof authService.logout === "function") {
                        await authService.logout();
                    }
                } catch (error) {
                    console.error(`${MODULE_NAME}: Sign out failed.`, error);
                } finally {
                    navigateTo(getPortalRoute("login", authUtils) || routes.login);
                }
            });
        }
    }

    async function initializeAdminHomePage(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const authUtils = resolveAuthUtils(safeOptions.authUtils);
        const authService = safeOptions.authService || resolveGlobal("authService");

        setText("admin-home-status", "Loading admin dashboard...");
        setText("admin-finance-note", "Loading platform finance figures...");

        bindNavigationButtons(authUtils, authService);

        const currentUser = await loadCurrentUser(safeOptions);

        if (!currentUser) {
            setText("admin-home-status", "Please sign in to view the admin dashboard.");
            renderAdminFinanceSummary(getDefaultFinanceSummary(), new Error("Not signed in"));
            navigateTo(getPortalRoute("login", authUtils));
            return {
                success: false,
                reason: "signed-out"
            };
        }

        const profile = await loadCurrentUserProfile(currentUser, safeOptions);
        const state = getHomeState(profile, authUtils);

        if (!state.showAdminPortal) {
            setText("admin-home-status", "This dashboard is only available to admins.");
            renderAdminFinanceSummary(getDefaultFinanceSummary(), new Error("Access denied"));
            return {
                success: false,
                reason: "access-denied",
                profile: state.profile
            };
        }

        renderHomeState(state);

        const financeResult = await refreshAdminFinanceSummary({
            ...safeOptions,
            platformPricing: resolvePlatformPricing(safeOptions.platformPricing)
        });

        return {
            success: true,
            profile: state.profile,
            state,
            financeSummary: financeResult.summary
        };
    }

    const adminHomePage = {
        MODULE_NAME,
        ORDERS_COLLECTION,
        DEFAULT_CURRENCY,
        normalizeText,
        normalizeLowerText,
        normalizeCurrencyAmount,
        formatCurrency,
        normalizeVendorStatus,
        normalizeAdminApplicationStatus,
        normalizeAccountStatus,
        resolveAuthUtils,
        resolvePlatformPricing,
        getFallbackRoutes,
        getPortalRoute,
        hasAuthenticatedIdentity,
        normalizeProfile,
        canAccessCustomerPortal,
        canAccessVendorPortal,
        canAccessAdminPortal,
        getRoleLabel,
        getVendorStatusLabel,
        getAdminStatusLabel,
        getPortalSummary,
        getManagementSummary,
        getAdminAccessNote,
        getWelcomeMessage,
        getHomeState,
        isCompletedPaidOrder,
        getDefaultFinanceSummary,
        calculateAdminFinanceSummary,
        fetchFinanceOrders,
        loadAdminFinanceSummary,
        renderAdminFinanceSummary,
        refreshAdminFinanceSummary,
        waitForAuthReady,
        loadCurrentUser,
        loadCurrentUserProfile,
        initializeAdminHomePage
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = adminHomePage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.adminHomePage = adminHomePage;
    }
})(typeof window !== "undefined" ? window : globalThis);