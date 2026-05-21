/**
 * vendor/index.js
 *
 * Vendor dashboard logic for authenticated vendor users.
 * This file:
 * - loads the signed-in user's profile
 * - renders access and workspace summaries
 * - loads live wallet summary data
 * - supports portal switching and sign out
 * - links to shop details, menu management, orders, wallet, support, and analytics
 */

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
    const safeCurrency = normalizeText(currency) || "ZAR";
    const label = safeCurrency.toUpperCase() === "ZAR"
        ? "R"
        : safeCurrency.toUpperCase();

    return `${label} ${normalizeCurrencyAmount(amount).toFixed(2)}`;
}

function normalizeVendorStatus(status) {
    const value = normalizeLowerText(status);

    if (value === "suspended") {
        return "blocked";
    }

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

function resolveGlobal(name) {
    if (typeof window !== "undefined" && window[name]) {
        return window[name];
    }

    if (typeof globalThis !== "undefined" && globalThis[name]) {
        return globalThis[name];
    }

    return null;
}

function resolveAuthUtils(explicitUtils) {
    if (explicitUtils) {
        return explicitUtils;
    }

    if (typeof window !== "undefined" && window.authUtils) {
        return window.authUtils;
    }

    return null;
}

function resolvePlatformPricing(explicitPlatformPricing) {
    if (
        explicitPlatformPricing &&
        typeof explicitPlatformPricing.calculateVendorBalance === "function"
    ) {
        return explicitPlatformPricing;
    }

    const globalPlatformPricing = resolveGlobal("platformPricing");

    if (
        globalPlatformPricing &&
        typeof globalPlatformPricing.calculateVendorBalance === "function"
    ) {
        return globalPlatformPricing;
    }

    if (typeof require === "function") {
        try {
            const requiredPlatformPricing = require("../shared/finance/platform-pricing.js");

            if (
                requiredPlatformPricing &&
                typeof requiredPlatformPricing.calculateVendorBalance === "function"
            ) {
                return requiredPlatformPricing;
            }
        } catch (error) {
            return null;
        }
    }

    return null;
}

function resolvePayoutModel(explicitPayoutModel) {
    if (
        explicitPayoutModel &&
        (
            typeof explicitPayoutModel.normalizePayoutRecord === "function" ||
            typeof explicitPayoutModel.validatePayoutRequestInput === "function"
        )
    ) {
        return explicitPayoutModel;
    }

    const globalPayoutModel = resolveGlobal("payoutModel");

    if (
        globalPayoutModel &&
        (
            typeof globalPayoutModel.normalizePayoutRecord === "function" ||
            typeof globalPayoutModel.validatePayoutRequestInput === "function"
        )
    ) {
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
    if (
        explicitPayoutQueries &&
        typeof explicitPayoutQueries.fetchVendorPayouts === "function"
    ) {
        return explicitPayoutQueries;
    }

    const globalPayoutQueries = resolveGlobal("payoutQueries");

    if (
        globalPayoutQueries &&
        typeof globalPayoutQueries.fetchVendorPayouts === "function"
    ) {
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

function getFallbackRoutes() {
    return {
        customer: "../customer/index.html",
        vendor: "./index.html",
        admin: "../admin/index.html",
        rolechoice: "../authentication/role-choice.html",
        profile: "../authentication/profile.html",
        shop: "./shop.html",
        products: "./products.html",
        ordermanagement: "./order-management/index.html",
        orderdetail: "./order-management/order-detail.html",
        ordernotifications: "./order-management/notifications.html",
        support: "./support/index.html",
        wallet: "./wallet.html",
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
        if (key === "customer") {
            return authUtils.PORTAL_ROUTES.customer || routes.customer;
        }

        if (key === "vendor") {
            return authUtils.PORTAL_ROUTES.vendor || routes.vendor;
        }

        if (key === "admin") {
            return authUtils.PORTAL_ROUTES.admin || routes.admin;
        }

        if (key === "rolechoice") {
            return authUtils.PORTAL_ROUTES.roleChoice || routes.rolechoice;
        }

        if (key === "login" || key === "signout") {
            return authUtils.PORTAL_ROUTES.login || routes.login;
        }
    }

    if (Object.prototype.hasOwnProperty.call(routes, key)) {
        return routes[key];
    }

    if (key === "signout") {
        return routes.login;
    }

    return routes.login;
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
        displayName: normalizeText(
            safeProfile.displayName ||
            safeProfile.fullName ||
            safeProfile.vendorName ||
            safeProfile.vendorOwnerName
        ),
        email: normalizeLowerText(safeProfile.email || safeProfile.vendorEmail),
        phoneNumber: normalizeText(safeProfile.phoneNumber),
        photoURL: normalizeText(safeProfile.photoURL),
        isAdmin,
        vendorStatus: normalizeVendorStatus(safeProfile.vendorStatus),
        vendorReason: normalizeText(
            safeProfile.vendorReason ||
            safeProfile.rejectionReason ||
            safeProfile.blockReason
        ),
        accountStatus: normalizeAccountStatus(safeProfile.accountStatus)
    };
}

function getRoleLabel(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (safeProfile.isAdmin === true && safeProfile.vendorStatus === "approved") {
        return "Admin and Vendor";
    }

    if (safeProfile.isAdmin === true) {
        return "Admin";
    }

    if (safeProfile.vendorStatus === "approved") {
        return "Vendor";
    }

    return "Customer";
}

function canAccessCustomerPortal(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (authUtils && typeof authUtils.canAccessCustomerPortal === "function") {
        return authUtils.canAccessCustomerPortal(safeProfile);
    }

    return (
        safeProfile.accountStatus === "active" &&
        hasAuthenticatedIdentity(safeProfile)
    );
}

function canAccessVendorPortal(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (authUtils && typeof authUtils.canAccessVendorPortal === "function") {
        return authUtils.canAccessVendorPortal(safeProfile);
    }

    return (
        safeProfile.accountStatus === "active" &&
        (
            safeProfile.isAdmin === true ||
            safeProfile.vendorStatus === "approved"
        )
    );
}

function canAccessAdminPortal(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (authUtils && typeof authUtils.canAccessAdminPortal === "function") {
        return authUtils.canAccessAdminPortal(safeProfile);
    }

    return (
        safeProfile.accountStatus === "active" &&
        safeProfile.isAdmin === true
    );
}

function getVendorStatusLabel(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (safeProfile.vendorStatus === "approved") {
        return "Approved";
    }

    if (safeProfile.vendorStatus === "pending") {
        return "Pending";
    }

    if (safeProfile.vendorStatus === "rejected") {
        return "Rejected";
    }

    if (safeProfile.vendorStatus === "blocked") {
        return "Blocked";
    }

    return "Not Applied";
}

function getPortalSummary(state) {
    if (!state) {
        return "";
    }

    if (
        state.showCustomerPortal &&
        state.showVendorPortal &&
        state.showAdminPortal
    ) {
        return "You can switch between the customer, vendor, and admin portals.";
    }

    if (state.showCustomerPortal && state.showVendorPortal) {
        return "You can switch between the customer and vendor portals.";
    }

    if (state.showVendorPortal && state.showAdminPortal) {
        return "You can switch between the vendor and admin portals.";
    }

    if (state.showVendorPortal) {
        return "You currently have vendor portal access only.";
    }

    return "You do not currently have portal access.";
}

function getVendorPortalNote(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (safeProfile.isAdmin === true && safeProfile.vendorStatus === "approved") {
        return "You can work as both an admin and a vendor from this account.";
    }

    if (safeProfile.isAdmin === true) {
        return "You are using the vendor workspace with admin access.";
    }

    if (safeProfile.vendorStatus === "approved") {
        return "Your vendor account is approved and ready to manage a shop.";
    }

    if (safeProfile.vendorStatus === "pending") {
        return "Your vendor application is still pending approval.";
    }

    if (safeProfile.vendorStatus === "rejected") {
        return safeProfile.vendorReason
            ? `Your vendor application was rejected: ${safeProfile.vendorReason}`
            : "Your vendor application was rejected.";
    }

    if (safeProfile.vendorStatus === "blocked") {
        return safeProfile.vendorReason
            ? `Your vendor access is blocked: ${safeProfile.vendorReason}`
            : "Your vendor access is blocked.";
    }

    return "Vendor access is not available right now.";
}

function getVendorWorkspaceNote(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (safeProfile.vendorStatus === "approved") {
        return "From here you can maintain your shop profile, keep your menu updated, and prepare for order management.";
    }

    if (safeProfile.isAdmin === true) {
        return "Admin access lets you inspect the vendor workspace even when vendor approval is not active.";
    }

    return "Your vendor workspace will become fully active once vendor access is approved.";
}

function getWelcomeMessage(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);
    const name = normalizeText(safeProfile.displayName) || "there";

    return `Welcome back, ${name}.`;
}

function getDefaultFinanceSummary(vendorUid) {
    return {
        vendorUid: normalizeText(vendorUid),
        completedOrders: 0,
        totalEarned: 0,
        reservedWithdrawals: 0,
        availableBalance: 0
    };
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

    if (!vendorUid) {
        return [];
    }

    if (typeof safeOptions.orderReader === "function") {
        const orders = await safeOptions.orderReader(vendorUid, safeOptions);
        return Array.isArray(orders) ? orders : [];
    }

    const orderService = safeOptions.orderService || resolveGlobal("orderService");

    if (orderService && typeof orderService.getVendorOrders === "function") {
        const orders = await orderService.getVendorOrders({
            ...safeOptions,
            vendorUid
        });

        return Array.isArray(orders) ? orders : [];
    }

    const db = safeOptions.db || resolveGlobal("db");
    const firestoreFns = safeOptions.firestoreFns || resolveGlobal("firestoreFns") || {};

    if (
        !db ||
        typeof firestoreFns.collection !== "function" ||
        typeof firestoreFns.getDocs !== "function"
    ) {
        return [];
    }

    const collectionRef = firestoreFns.collection(db, "orders");
    let ordersQuery = collectionRef;

    if (typeof firestoreFns.query === "function" && typeof firestoreFns.where === "function") {
        ordersQuery = firestoreFns.query(
            collectionRef,
            firestoreFns.where("vendorUid", "==", vendorUid)
        );
    }

    const snapshot = await firestoreFns.getDocs(ordersQuery);

    return getSnapshotDocuments(snapshot).map(function mapOrder(docSnapshot) {
        return mapDocument(docSnapshot, "orderId");
    });
}

async function fetchVendorPayouts(options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const vendorUid = normalizeText(safeOptions.vendorUid);

    if (!vendorUid) {
        return [];
    }

    if (typeof safeOptions.payoutReader === "function") {
        const payouts = await safeOptions.payoutReader(vendorUid, safeOptions);
        return Array.isArray(payouts) ? payouts : [];
    }

    const payoutQueries = resolvePayoutQueries(safeOptions.payoutQueries);

    if (payoutQueries && typeof payoutQueries.fetchVendorPayouts === "function") {
        const payouts = await payoutQueries.fetchVendorPayouts({
            ...safeOptions,
            vendorUid,
            payoutModel: resolvePayoutModel(safeOptions.payoutModel)
        });

        return Array.isArray(payouts) ? payouts : [];
    }

    return [];
}

function calculateVendorHomeFinanceSummary(orders, payouts, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const platformPricing = resolvePlatformPricing(safeOptions.platformPricing);
    const vendorUid = normalizeText(safeOptions.vendorUid);

    if (platformPricing && typeof platformPricing.calculateVendorBalance === "function") {
        return {
            ...getDefaultFinanceSummary(vendorUid),
            ...platformPricing.calculateVendorBalance(orders, payouts, {
                ...safeOptions,
                vendorUid
            })
        };
    }

    const completedOrders = (Array.isArray(orders) ? orders : []).filter(function keepOrder(order) {
        const safeOrder = order && typeof order === "object" ? order : {};
        const orderVendorUid = normalizeText(safeOrder.vendorUid);
        const status = normalizeLowerText(safeOrder.status || safeOrder.orderStatus);
        const paymentStatus = normalizeLowerText(safeOrder.paymentStatus || safeOrder.paymentState);

        return status === "completed" &&
            (!paymentStatus || paymentStatus === "paid") &&
            (!vendorUid || orderVendorUid === vendorUid);
    });

    const totalEarned = completedOrders.reduce(function sumEarned(total, order) {
        const safeOrder = order && typeof order === "object" ? order : {};
        const amount = safeOrder.vendorEarnings !== undefined
            ? safeOrder.vendorEarnings
            : safeOrder.vendorSubtotal !== undefined
                ? safeOrder.vendorSubtotal
                : safeOrder.total;

        return normalizeCurrencyAmount(total + normalizeCurrencyAmount(amount));
    }, 0);

    const reservedWithdrawals = (Array.isArray(payouts) ? payouts : [])
        .filter(function keepPayout(payout) {
            const safePayout = payout && typeof payout === "object" ? payout : {};
            const payoutVendorUid = normalizeText(safePayout.vendorUid);
            const status = normalizeLowerText(safePayout.status) || "pending";

            return (!vendorUid || payoutVendorUid === vendorUid) &&
                ["pending", "approved", "paid"].indexOf(status) >= 0;
        })
        .reduce(function sumReserved(total, payout) {
            return normalizeCurrencyAmount(total + normalizeCurrencyAmount(payout && payout.amount));
        }, 0);

    return {
        vendorUid,
        completedOrders: completedOrders.length,
        totalEarned,
        reservedWithdrawals,
        availableBalance: normalizeCurrencyAmount(totalEarned - reservedWithdrawals)
    };
}

async function loadVendorFinanceSummary(profile, dependencies = {}) {
    const safeDependencies = dependencies && typeof dependencies === "object" ? dependencies : {};
    const safeProfile = normalizeProfile(profile, safeDependencies.authUtils);
    const vendorUid = normalizeText(safeDependencies.vendorUid || safeProfile.uid);

    try {
        if (typeof safeDependencies.financeLoader === "function") {
            const financeData = await safeDependencies.financeLoader({
                ...safeDependencies,
                vendorUid,
                profile: safeProfile
            });
            const safeFinanceData = financeData && typeof financeData === "object" ? financeData : {};

            return {
                summary: calculateVendorHomeFinanceSummary(
                    safeFinanceData.orders,
                    safeFinanceData.payouts,
                    {
                        ...safeDependencies,
                        vendorUid
                    }
                ),
                error: null
            };
        }

        const orders = Array.isArray(safeDependencies.orders)
            ? safeDependencies.orders
            : await fetchVendorOrders({
                ...safeDependencies,
                vendorUid
            });

        const payouts = Array.isArray(safeDependencies.payouts)
            ? safeDependencies.payouts
            : await fetchVendorPayouts({
                ...safeDependencies,
                vendorUid
            });

        return {
            summary: calculateVendorHomeFinanceSummary(
                orders,
                payouts,
                {
                    ...safeDependencies,
                    vendorUid
                }
            ),
            error: null
        };
    } catch (error) {
        console.error("vendor/index: Failed to load wallet summary.", error);

        return {
            summary: getDefaultFinanceSummary(vendorUid),
            error
        };
    }
}

function getHomeState(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);
    const showCustomerPortal = canAccessCustomerPortal(safeProfile, authUtils);
    const showVendorPortal = canAccessVendorPortal(safeProfile, authUtils);
    const showAdminPortal = canAccessAdminPortal(safeProfile, authUtils);
    const displayName = normalizeText(safeProfile.displayName) || "Vendor User";

    return {
        profile: safeProfile,
        displayName,
        roleLabel: getRoleLabel(safeProfile, authUtils),
        vendorStatusLabel: getVendorStatusLabel(safeProfile, authUtils),
        welcomeMessage: getWelcomeMessage(safeProfile, authUtils),
        vendorPortalNote: getVendorPortalNote(safeProfile, authUtils),
        vendorWorkspaceNote: getVendorWorkspaceNote(safeProfile, authUtils),
        portalSummary: getPortalSummary({
            showCustomerPortal,
            showVendorPortal,
            showAdminPortal
        }),
        showCustomerPortal,
        showVendorPortal,
        showAdminPortal,
        showChoosePortal: [showCustomerPortal, showVendorPortal, showAdminPortal].filter(Boolean).length > 1,
        shopRoute: getPortalRoute("shop", authUtils),
        productsRoute: getPortalRoute("products", authUtils),
        orderManagementRoute: getPortalRoute("orderManagement", authUtils),
        orderDetailRoute: getPortalRoute("orderDetail", authUtils),
        orderNotificationsRoute: getPortalRoute("orderNotifications", authUtils),
        supportRoute: getPortalRoute("support", authUtils),
        walletRoute: getPortalRoute("wallet", authUtils),
        analyticsRoute: getPortalRoute("analytics", authUtils),
        signOutRoute: getPortalRoute("signOut", authUtils),
        financeSummary: getDefaultFinanceSummary(safeProfile.uid),
        financeStatusMessage: "Open your wallet to review completed-order earnings and request a fake payout."
    };
}

function getDefaultAvatar(name) {
    const trimmedName = normalizeText(name) || "U";
    const firstLetter = trimmedName.charAt(0).toUpperCase();

    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">` +
        `<rect width="240" height="240" rx="120" fill="#f0dfd1"></rect>` +
        `<text x="120" y="138" text-anchor="middle" font-size="92" font-family="Arial" fill="#8a5b3e">${firstLetter}</text>` +
        `</svg>`;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getSafeRedirectRoute(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (authUtils && typeof authUtils.getDefaultPortalRoute === "function") {
        return authUtils.getDefaultPortalRoute(safeProfile);
    }

    if (canAccessCustomerPortal(safeProfile, authUtils)) {
        return getPortalRoute("customer", authUtils);
    }

    return getPortalRoute("login", authUtils);
}

function setText(element, value) {
    if (!element) {
        return;
    }

    element.textContent = value === undefined || value === null ? "" : String(value);
}

function setHidden(element, isHidden) {
    if (!element) {
        return;
    }

    element.hidden = !!isHidden;
    element.setAttribute("aria-hidden", isHidden ? "true" : "false");
}

function setStatusMessage(element, message, stateName) {
    if (!element) {
        return;
    }

    element.textContent = message || "";
    element.dataset.state = stateName || "";
}

function setImage(imageElement, imageUrl, altText, fallbackName) {
    if (!imageElement) {
        return;
    }

    imageElement.src = normalizeText(imageUrl) || getDefaultAvatar(fallbackName);
    imageElement.alt = normalizeText(altText) || "User profile picture";
}

function renderFinanceSummary(elements, financeSummary, options = {}) {
    if (!elements) {
        return;
    }

    const summary = {
        ...getDefaultFinanceSummary(),
        ...(financeSummary && typeof financeSummary === "object" ? financeSummary : {})
    };
    const safeOptions = options && typeof options === "object" ? options : {};
    const hasBalance = summary.totalEarned > 0 ||
        summary.reservedWithdrawals > 0 ||
        summary.completedOrders > 0;
    const message = normalizeText(safeOptions.message) || (
        hasBalance
            ? "These figures use completed paid orders and reserved withdrawal requests."
            : "No completed paid orders have added to your wallet yet."
    );

    setText(elements.walletNoteElement, message);
    setText(elements.walletAvailableElement, formatCurrency(summary.availableBalance));
    setText(elements.walletEarnedElement, formatCurrency(summary.totalEarned));
    setText(elements.walletReservedElement, formatCurrency(summary.reservedWithdrawals));
    setText(elements.walletOrdersElement, String(summary.completedOrders || 0));
}

function renderVendorHomePage(elements, state) {
    if (!elements || !state) {
        return;
    }

    setStatusMessage(elements.statusElement, "Vendor dashboard loaded.", "success");

    setText(elements.nameLine, state.displayName);
    setText(elements.roleLine, state.roleLabel);
    setText(
        elements.emailLine,
        normalizeText(state.profile.email) || "No email available"
    );
    setText(elements.vendorLine, state.vendorStatusLabel);
    setText(elements.portalSummaryElement, state.portalSummary);
    setText(elements.welcomeMessageElement, state.welcomeMessage);
    setText(elements.vendorPortalNoteElement, state.vendorPortalNote);
    setText(elements.vendorWorkspaceNoteElement, state.vendorWorkspaceNote);
    renderFinanceSummary(elements, state.financeSummary, {
        message: state.financeStatusMessage
    });

    if (elements.photoCaptionElement) {
        setText(
            elements.photoCaptionElement,
            normalizeText(state.profile.photoURL)
                ? "Your current profile picture is shown here."
                : "No profile picture was found, so a default avatar is being shown."
        );
    }

    setImage(
        elements.profilePhoto,
        state.profile.photoURL,
        `${state.displayName} profile picture`,
        state.displayName
    );

    setHidden(elements.customerPortalButton, !state.showCustomerPortal);
    setHidden(elements.vendorPortalButton, !state.showVendorPortal);
    setHidden(elements.adminPortalButton, !state.showAdminPortal);
    setHidden(elements.choosePortalButton, !state.showChoosePortal);
}

function attachNavigationHandler(options = {}) {
    const button = options.button;
    const route = options.route;
    const navigate =
        typeof options.navigate === "function"
            ? options.navigate
            : function fallbackNavigate(nextRoute) {
                window.location.href = nextRoute;
            };

    if (!button || !route) {
        return null;
    }

    function handleClick(event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        navigate(route);
        return route;
    }

    button.addEventListener("click", handleClick);

    return {
        handleClick
    };
}

function getSignOutFunction(authService) {
    if (!authService || typeof authService !== "object") {
        return null;
    }

    if (typeof authService.signOutUser === "function") {
        return authService.signOutUser.bind(authService);
    }

    if (typeof authService.signOut === "function") {
        return authService.signOut.bind(authService);
    }

    if (typeof authService.logout === "function") {
        return authService.logout.bind(authService);
    }

    return null;
}

function attachSignOutHandler(options = {}) {
    const button = options.button;
    const authService = options.authService;
    const signOutFn = getSignOutFunction(authService);
    const navigate =
        typeof options.navigate === "function"
            ? options.navigate
            : function fallbackNavigate(nextRoute) {
                window.location.href = nextRoute;
            };
    const nextRoute = options.nextRoute;
    const statusElement = options.statusElement || null;

    if (!button || !signOutFn || !nextRoute) {
        return null;
    }

    async function handleClick(event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        setStatusMessage(statusElement, "Signing you out...", "loading");

        try {
            await signOutFn();
            navigate(nextRoute);
            return {
                success: true,
                nextRoute
            };
        } catch (error) {
            const message =
                error && error.message
                    ? error.message
                    : "Unable to sign out right now.";

            setStatusMessage(statusElement, message, "error");

            return {
                success: false,
                error,
                message
            };
        }
    }

    button.addEventListener("click", handleClick);

    return {
        handleClick
    };
}

async function loadVendorHomeState(dependencies = {}) {
    const authService = dependencies.authService;
    const authUtils = resolveAuthUtils(dependencies.authUtils);

    if (!authService || typeof authService.getCurrentUser !== "function") {
        throw new Error("authService.getCurrentUser is required.");
    }

    if (!authService || typeof authService.getCurrentUserProfile !== "function") {
        throw new Error("authService.getCurrentUserProfile is required.");
    }

    const user = await Promise.resolve(authService.getCurrentUser());

    if (!user || !user.uid) {
        return {
            success: false,
            message: "No user is currently signed in.",
            nextRoute: getPortalRoute("login", authUtils)
        };
    }

    const profile = await authService.getCurrentUserProfile(user.uid);

    const fallbackProfile = {
        uid: user.uid,
        displayName: user.displayName || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        photoURL: user.photoURL || "",
        vendorStatus: user.vendorStatus || "none",
        accountStatus: user.accountStatus || "active",
        isAdmin: user.isAdmin === true || user.admin === true
    };

    const state = getHomeState(profile || fallbackProfile, authUtils);

    if (!state.showVendorPortal) {
        return {
            success: false,
            message: "You do not have access to the vendor portal.",
            nextRoute: getSafeRedirectRoute(state.profile, authUtils)
        };
    }

    const finance = await loadVendorFinanceSummary(state.profile, {
        ...dependencies,
        authUtils
    });

    state.financeSummary = finance.summary;
    state.financeStatusMessage = finance.error
        ? "Wallet figures could not be loaded here. Open Wallet for the full view."
        : state.financeSummary.completedOrders > 0
            ? "Completed paid orders are reflected in this wallet snapshot."
            : "Open your wallet to review completed-order earnings and request a fake payout.";

    return {
        success: true,
        user,
        profile: state.profile,
        state
    };
}

function getPageElements(doc) {
    const root = doc || (typeof document !== "undefined" ? document : null);

    if (!root) {
        return {};
    }

    return {
        statusElement: root.querySelector("#vendor-home-status"),
        profilePhoto: root.querySelector("#profile-photo"),
        photoCaptionElement: root.querySelector("#profile-photo-caption"),
        nameLine: root.querySelector("#profile-name-line"),
        roleLine: root.querySelector("#profile-role-line"),
        emailLine: root.querySelector("#profile-email-line"),
        vendorLine: root.querySelector("#profile-vendor-line"),
        portalSummaryElement: root.querySelector("#portal-summary"),
        welcomeMessageElement: root.querySelector("#welcome-message"),
        vendorPortalNoteElement: root.querySelector("#vendor-portal-note"),
        vendorWorkspaceNoteElement: root.querySelector("#vendor-workspace-note"),
        walletNoteElement: root.querySelector("#vendor-wallet-note"),
        walletAvailableElement: root.querySelector("#vendor-wallet-available"),
        walletEarnedElement: root.querySelector("#vendor-wallet-earned"),
        walletReservedElement: root.querySelector("#vendor-wallet-reserved"),
        walletOrdersElement: root.querySelector("#vendor-wallet-orders"),
        profileButton: root.querySelector("#go-profile-button"),
        shopButton: root.querySelector("#go-shop-button"),
        productsButton: root.querySelector("#go-products-button"),
        orderManagementButton: root.querySelector("#go-order-management-button"),
        orderDetailButton: root.querySelector("#go-order-detail-button"),
        orderNotificationsButton: root.querySelector("#go-order-notifications-button"),
        supportLink: root.querySelector("#vendor-support-link"),
        walletButton: root.querySelector("#go-wallet-button"),
        walletLink: root.querySelector("#wallet-link"),
        analyticsLink: root.querySelector("#analytics-link"),
        choosePortalButton: root.querySelector("#choose-portal-button"),
        signOutButton: root.querySelector("#sign-out-button"),
        customerPortalButton: root.querySelector("#go-customer-portal-button"),
        vendorPortalButton: root.querySelector("#go-vendor-portal-button"),
        adminPortalButton: root.querySelector("#go-admin-portal-button")
    };
}

async function initializeVendorHomePage(options = {}) {
    const authService =
        options.authService ||
        (typeof window !== "undefined" ? window.authService : undefined);

    const authUtils = resolveAuthUtils(options.authUtils);

    if (!authService) {
        throw new Error("authService is required.");
    }

    const navigate =
        typeof options.navigate === "function"
            ? options.navigate
            : function goToRoute(nextRoute) {
                window.location.href = nextRoute;
            };

    const elements = options.elements || getPageElements(options.document);

    setStatusMessage(elements.statusElement, "Loading your vendor dashboard...", "loading");

    try {
        const result = await loadVendorHomeState({
            ...options,
            authService,
            authUtils
        });

        if (!result.success) {
            setStatusMessage(
                elements.statusElement,
                result.message || "Unable to load your vendor dashboard right now.",
                "error"
            );

            if (result.nextRoute) {
                navigate(result.nextRoute);
            }

            return {
                redirected: true,
                nextRoute: result.nextRoute || getPortalRoute("login", authUtils)
            };
        }

        renderVendorHomePage(elements, result.state);

        const profileController = attachNavigationHandler({
            button: elements.profileButton,
            route: getPortalRoute("profile", authUtils),
            navigate
        });

        const shopController = attachNavigationHandler({
            button: elements.shopButton,
            route: result.state.shopRoute,
            navigate
        });

        const productsController = attachNavigationHandler({
            button: elements.productsButton,
            route: result.state.productsRoute,
            navigate
        });

        const orderManagementController = attachNavigationHandler({
            button: elements.orderManagementButton,
            route: result.state.orderManagementRoute,
            navigate
        });

        const orderDetailController = attachNavigationHandler({
            button: elements.orderDetailButton,
            route: result.state.orderDetailRoute,
            navigate
        });

        const orderNotificationsController = attachNavigationHandler({
            button: elements.orderNotificationsButton,
            route: result.state.orderNotificationsRoute,
            navigate
        });

        const supportController = attachNavigationHandler({
            button: elements.supportLink,
            route: result.state.supportRoute,
            navigate
        });

        const walletButtonController = attachNavigationHandler({
            button: elements.walletButton,
            route: result.state.walletRoute,
            navigate
        });

        const walletLinkController = attachNavigationHandler({
            button: elements.walletLink,
            route: result.state.walletRoute,
            navigate
        });

        const analyticsController = attachNavigationHandler({
            button: elements.analyticsLink,
            route: result.state.analyticsRoute,
            navigate
        });

        const choosePortalController = result.state.showChoosePortal
            ? attachNavigationHandler({
                button: elements.choosePortalButton,
                route: getPortalRoute("roleChoice", authUtils),
                navigate
            })
            : null;

        const customerPortalController = result.state.showCustomerPortal
            ? attachNavigationHandler({
                button: elements.customerPortalButton,
                route: getPortalRoute("customer", authUtils),
                navigate
            })
            : null;

        const vendorPortalController = result.state.showVendorPortal
            ? attachNavigationHandler({
                button: elements.vendorPortalButton,
                route: getPortalRoute("vendor", authUtils),
                navigate
            })
            : null;

        const adminPortalController = result.state.showAdminPortal
            ? attachNavigationHandler({
                button: elements.adminPortalButton,
                route: getPortalRoute("admin", authUtils),
                navigate
            })
            : null;

        const signOutController = attachSignOutHandler({
            button: elements.signOutButton,
            authService,
            navigate,
            nextRoute: result.state.signOutRoute,
            statusElement: elements.statusElement
        });

        return {
            redirected: false,
            state: result.state,
            profileController,
            shopController,
            productsController,
            orderManagementController,
            orderDetailController,
            orderNotificationsController,
            supportController,
            walletButtonController,
            walletLinkController,
            analyticsController,
            choosePortalController,
            customerPortalController,
            vendorPortalController,
            adminPortalController,
            signOutController
        };
    } catch (error) {
        const message =
            error && error.message
                ? error.message
                : "Unable to load your vendor dashboard right now.";

        setStatusMessage(elements.statusElement, message, "error");

        return {
            redirected: false,
            error,
            message
        };
    }
}

const vendorHomePage = {
    normalizeText,
    normalizeLowerText,
    normalizeCurrencyAmount,
    formatCurrency,
    normalizeVendorStatus,
    normalizeAccountStatus,
    resolveGlobal,
    resolveAuthUtils,
    resolvePlatformPricing,
    resolvePayoutModel,
    resolvePayoutQueries,
    getFallbackRoutes,
    getPortalRoute,
    hasAuthenticatedIdentity,
    normalizeProfile,
    getRoleLabel,
    canAccessCustomerPortal,
    canAccessVendorPortal,
    canAccessAdminPortal,
    getVendorStatusLabel,
    getPortalSummary,
    getVendorPortalNote,
    getVendorWorkspaceNote,
    getWelcomeMessage,
    getDefaultFinanceSummary,
    getSnapshotDocuments,
    mapDocument,
    fetchVendorOrders,
    fetchVendorPayouts,
    calculateVendorHomeFinanceSummary,
    loadVendorFinanceSummary,
    getHomeState,
    getDefaultAvatar,
    getSafeRedirectRoute,
    setText,
    setHidden,
    setStatusMessage,
    setImage,
    renderFinanceSummary,
    renderVendorHomePage,
    attachNavigationHandler,
    getSignOutFunction,
    attachSignOutHandler,
    loadVendorHomeState,
    getPageElements,
    initializeVendorHomePage
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = vendorHomePage;
}

if (typeof window !== "undefined") {
    window.vendorHomePage = vendorHomePage;
}