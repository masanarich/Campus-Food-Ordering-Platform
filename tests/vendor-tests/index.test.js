/**
 * @jest-environment jsdom
 */

const vendorHomePage = require("../../public/vendor/index.js");
const platformPricing = require("../../public/shared/finance/platform-pricing.js");

const {
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
} = vendorHomePage;

function createVendorHomeDom() {
    document.body.innerHTML = `
        <main>
            <p id="vendor-home-status"></p>

            <img id="profile-photo" src="" alt="">
            <p id="profile-photo-caption"></p>

            <output id="profile-name-line"></output>
            <output id="profile-role-line"></output>
            <output id="profile-email-line"></output>
            <output id="profile-vendor-line"></output>

            <p id="portal-summary"></p>
            <p id="welcome-message"></p>
            <p id="vendor-portal-note"></p>
            <p id="vendor-workspace-note"></p>

            <p id="vendor-wallet-note"></p>
            <output id="vendor-wallet-available"></output>
            <output id="vendor-wallet-earned"></output>
            <output id="vendor-wallet-reserved"></output>
            <output id="vendor-wallet-orders"></output>

            <button id="go-profile-button" type="button">Profile</button>
            <button id="go-shop-button" type="button">Shop</button>
            <button id="go-products-button" type="button">Products</button>
            <button id="go-order-management-button" type="button">Manage Orders</button>
            <button id="go-order-detail-button" type="button">Order Detail</button>
            <button id="go-order-notifications-button" type="button">Order Notifications</button>
            <button id="go-wallet-button" type="button">Wallet</button>

            <a id="vendor-support-link" href="./support/index.html">Support & Disputes</a>
            <a id="wallet-link" href="./wallet.html">Wallet</a>
            <a id="analytics-link" href="./analytics.html">View Analytics</a>

            <button id="choose-portal-button" type="button">Choose Portal</button>
            <button id="sign-out-button" type="button">Sign Out</button>
            <button id="go-customer-portal-button" type="button">Customer Portal</button>
            <button id="go-vendor-portal-button" type="button">Vendor Portal</button>
            <button id="go-admin-portal-button" type="button">Admin Portal</button>
        </main>
    `;

    return getPageElements(document);
}

function createFirestoreFnsWithDocs(docs) {
    return {
        collection: jest.fn((db, collectionName) => ({
            db,
            collectionName,
            type: "collectionRef"
        })),
        where: jest.fn((field, operator, value) => ({
            field,
            operator,
            value,
            type: "where"
        })),
        query: jest.fn((collectionRef, whereRef) => ({
            collectionRef,
            whereRef,
            type: "queryRef"
        })),
        getDocs: jest.fn(async () => ({
            docs: docs.map((doc) => ({
                id: doc.id,
                data: () => doc.data
            }))
        }))
    };
}

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("vendor/index.js helper functions", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.authUtils;
        delete window.authService;
        delete window.platformPricing;
        delete window.payoutModel;
        delete window.payoutQueries;
        delete window.orderService;
        delete window.db;
        delete window.firestoreFns;
    });

    test("exports the expected helper functions", () => {
        expect(typeof normalizeText).toBe("function");
        expect(typeof normalizeLowerText).toBe("function");
        expect(typeof normalizeCurrencyAmount).toBe("function");
        expect(typeof formatCurrency).toBe("function");
        expect(typeof fetchVendorOrders).toBe("function");
        expect(typeof fetchVendorPayouts).toBe("function");
        expect(typeof initializeVendorHomePage).toBe("function");
    });

    test("normalizers clean values consistently", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
        expect(normalizeText(undefined)).toBe("");
        expect(normalizeText(null)).toBe("");
        expect(normalizeLowerText(" APPROVED ")).toBe("approved");

        expect(normalizeCurrencyAmount("12.345")).toBe(12.35);
        expect(normalizeCurrencyAmount("-5")).toBe(0);
        expect(normalizeCurrencyAmount("bad", "7.239")).toBe(7.24);
        expect(normalizeCurrencyAmount("bad")).toBe(0);

        expect(formatCurrency(120)).toBe("R 120.00");
        expect(formatCurrency("120.5")).toBe("R 120.50");
        expect(formatCurrency("bad")).toBe("R 0.00");
        expect(formatCurrency(120, "USD")).toBe("USD 120.00");

        expect(normalizeVendorStatus("suspended")).toBe("blocked");
        expect(normalizeVendorStatus("approved")).toBe("approved");
        expect(normalizeVendorStatus("pending")).toBe("pending");
        expect(normalizeVendorStatus("rejected")).toBe("rejected");
        expect(normalizeVendorStatus("blocked")).toBe("blocked");
        expect(normalizeVendorStatus("mystery")).toBe("none");

        expect(normalizeAccountStatus("disabled")).toBe("disabled");
        expect(normalizeAccountStatus("blocked")).toBe("blocked");
        expect(normalizeAccountStatus("inactive")).toBe("active");
    });

    test("resolves globals, auth utils, platform pricing, payout model, and payout queries", () => {
        window.customThing = { value: 1 };
        expect(resolveGlobal("customThing")).toBe(window.customThing);
        expect(resolveGlobal("missingThing")).toBeNull();

        const explicitUtils = { value: "explicit" };
        window.authUtils = { value: "window" };

        expect(resolveAuthUtils(explicitUtils)).toBe(explicitUtils);
        expect(resolveAuthUtils()).toBe(window.authUtils);

        delete window.authUtils;
        expect(resolveAuthUtils()).toBeNull();

        expect(resolvePlatformPricing(platformPricing)).toBe(platformPricing);

        window.platformPricing = platformPricing;
        expect(resolvePlatformPricing()).toBe(platformPricing);

        const payoutModel = {
            normalizePayoutRecord: jest.fn()
        };

        const payoutModelByValidation = {
            validatePayoutRequestInput: jest.fn()
        };

        const payoutQueries = {
            fetchVendorPayouts: jest.fn()
        };

        expect(resolvePayoutModel(payoutModel)).toBe(payoutModel);
        expect(resolvePayoutModel(payoutModelByValidation)).toBe(payoutModelByValidation);

        window.payoutModel = payoutModel;
        expect(resolvePayoutModel()).toBe(payoutModel);

        expect(resolvePayoutQueries(payoutQueries)).toBe(payoutQueries);

        window.payoutQueries = payoutQueries;
        expect(resolvePayoutQueries()).toBe(payoutQueries);
    });

    test("fallback routes and portal routes are correct", () => {
        expect(getFallbackRoutes()).toEqual({
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
        });

        expect(getPortalRoute("customer")).toBe("../customer/index.html");
        expect(getPortalRoute("vendor")).toBe("./index.html");
        expect(getPortalRoute("admin")).toBe("../admin/index.html");
        expect(getPortalRoute("roleChoice")).toBe("../authentication/role-choice.html");
        expect(getPortalRoute("profile")).toBe("../authentication/profile.html");
        expect(getPortalRoute("shop")).toBe("./shop.html");
        expect(getPortalRoute("products")).toBe("./products.html");
        expect(getPortalRoute("orderManagement")).toBe("./order-management/index.html");
        expect(getPortalRoute("orderDetail")).toBe("./order-management/order-detail.html");
        expect(getPortalRoute("orderNotifications")).toBe("./order-management/notifications.html");
        expect(getPortalRoute("support")).toBe("./support/index.html");
        expect(getPortalRoute("wallet")).toBe("./wallet.html");
        expect(getPortalRoute("analytics")).toBe("./analytics.html");
        expect(getPortalRoute("signOut")).toBe("../authentication/login.html");
        expect(getPortalRoute("unknown")).toBe("../authentication/login.html");
    });

    test("portal routes use authUtils helpers when available", () => {
        const authUtils = {
            getPortalRoute: jest.fn((route) => `/custom/${route}.html`),
            PORTAL_ROUTES: {
                customer: "/portal/customer.html",
                vendor: "/portal/vendor.html",
                admin: "/portal/admin.html",
                roleChoice: "/portal/role-choice.html",
                login: "/portal/login.html"
            }
        };

        expect(getPortalRoute("customer", authUtils)).toBe("/custom/customer.html");
        expect(getPortalRoute("vendor", authUtils)).toBe("/custom/vendor.html");
        expect(getPortalRoute("admin", authUtils)).toBe("/custom/admin.html");
        expect(getPortalRoute("roleChoice", authUtils)).toBe("/portal/role-choice.html");
        expect(getPortalRoute("login", authUtils)).toBe("/portal/login.html");
        expect(getPortalRoute("signOut", authUtils)).toBe("/portal/login.html");
    });

    test("profile normalization works with built-in logic", () => {
        const result = normalizeProfile({
            uid: " user-1 ",
            vendorName: " Vendor Shop ",
            vendorOwnerName: " Owner Name ",
            email: " USER@example.com ",
            vendorEmail: " VENDOR@example.com ",
            phoneNumber: " 0712345678 ",
            photoURL: " https://example.com/p.jpg ",
            admin: true,
            vendorStatus: "suspended",
            rejectionReason: " Missing docs ",
            accountStatus: "inactive"
        });

        expect(result).toEqual({
            uid: "user-1",
            displayName: "Vendor Shop",
            email: "user@example.com",
            phoneNumber: "0712345678",
            photoURL: "https://example.com/p.jpg",
            isAdmin: true,
            vendorStatus: "blocked",
            vendorReason: "Missing docs",
            accountStatus: "active"
        });
    });

    test("profile normalization delegates to authUtils normalisers", () => {
        const normalized = {
            uid: "user-2",
            displayName: "Auth Utils User",
            email: "utils@example.com",
            phoneNumber: "",
            photoURL: "",
            isAdmin: false,
            vendorStatus: "approved",
            vendorReason: "",
            accountStatus: "active"
        };

        const britishUtils = {
            normaliseUserData: jest.fn(() => normalized)
        };

        const americanUtils = {
            normalizeUserData: jest.fn(() => normalized)
        };

        expect(normalizeProfile({ uid: "raw-1" }, britishUtils)).toBe(normalized);
        expect(britishUtils.normaliseUserData).toHaveBeenCalledWith({ uid: "raw-1" });

        expect(normalizeProfile({ uid: "raw-2" }, americanUtils)).toBe(normalized);
        expect(americanUtils.normalizeUserData).toHaveBeenCalledWith({ uid: "raw-2" });
    });

    test("identity, role, access, and status label helpers work", () => {
        expect(hasAuthenticatedIdentity({ uid: "abc123" })).toBe(true);
        expect(hasAuthenticatedIdentity({ email: "user@example.com" })).toBe(true);
        expect(hasAuthenticatedIdentity({ phoneNumber: "0712345678" })).toBe(true);
        expect(hasAuthenticatedIdentity({})).toBe(false);

        expect(getRoleLabel({ isAdmin: true, vendorStatus: "approved" })).toBe("Admin and Vendor");
        expect(getRoleLabel({ isAdmin: true })).toBe("Admin");
        expect(getRoleLabel({ vendorStatus: "approved" })).toBe("Vendor");
        expect(getRoleLabel({ uid: "user-1" })).toBe("Customer");

        expect(canAccessCustomerPortal({ uid: "user-1", accountStatus: "active" })).toBe(true);
        expect(canAccessCustomerPortal({ uid: "user-1", accountStatus: "blocked" })).toBe(false);

        expect(canAccessVendorPortal({ vendorStatus: "approved", accountStatus: "active" })).toBe(true);
        expect(canAccessVendorPortal({ isAdmin: true, accountStatus: "active" })).toBe(true);
        expect(canAccessVendorPortal({ vendorStatus: "pending", accountStatus: "active" })).toBe(false);

        expect(canAccessAdminPortal({ isAdmin: true, accountStatus: "active" })).toBe(true);
        expect(canAccessAdminPortal({ isAdmin: true, accountStatus: "disabled" })).toBe(false);

        const authUtils = {
            canAccessCustomerPortal: jest.fn(() => false),
            canAccessVendorPortal: jest.fn(() => true),
            canAccessAdminPortal: jest.fn(() => true)
        };

        expect(canAccessCustomerPortal({ uid: "user-1" }, authUtils)).toBe(false);
        expect(canAccessVendorPortal({ uid: "user-1" }, authUtils)).toBe(true);
        expect(canAccessAdminPortal({ uid: "user-1" }, authUtils)).toBe(true);

        expect(getVendorStatusLabel({ vendorStatus: "approved" })).toBe("Approved");
        expect(getVendorStatusLabel({ vendorStatus: "pending" })).toBe("Pending");
        expect(getVendorStatusLabel({ vendorStatus: "rejected" })).toBe("Rejected");
        expect(getVendorStatusLabel({ vendorStatus: "blocked" })).toBe("Blocked");
        expect(getVendorStatusLabel({ vendorStatus: "none" })).toBe("Not Applied");
    });

    test("summary and note helpers return expected messages", () => {
        expect(getPortalSummary({
            showCustomerPortal: true,
            showVendorPortal: true,
            showAdminPortal: true
        })).toBe("You can switch between the customer, vendor, and admin portals.");

        expect(getPortalSummary({
            showCustomerPortal: true,
            showVendorPortal: true,
            showAdminPortal: false
        })).toBe("You can switch between the customer and vendor portals.");

        expect(getPortalSummary({
            showCustomerPortal: false,
            showVendorPortal: true,
            showAdminPortal: true
        })).toBe("You can switch between the vendor and admin portals.");

        expect(getPortalSummary({
            showCustomerPortal: false,
            showVendorPortal: true,
            showAdminPortal: false
        })).toBe("You currently have vendor portal access only.");

        expect(getPortalSummary({
            showCustomerPortal: false,
            showVendorPortal: false,
            showAdminPortal: false
        })).toBe("You do not currently have portal access.");

        expect(getPortalSummary(null)).toBe("");

        expect(getVendorPortalNote({
            isAdmin: true,
            vendorStatus: "approved"
        })).toBe("You can work as both an admin and a vendor from this account.");

        expect(getVendorPortalNote({
            isAdmin: true,
            vendorStatus: "none"
        })).toBe("You are using the vendor workspace with admin access.");

        expect(getVendorPortalNote({
            vendorStatus: "approved"
        })).toBe("Your vendor account is approved and ready to manage a shop.");

        expect(getVendorPortalNote({
            vendorStatus: "pending"
        })).toBe("Your vendor application is still pending approval.");

        expect(getVendorPortalNote({
            vendorStatus: "rejected",
            vendorReason: "Missing docs"
        })).toBe("Your vendor application was rejected: Missing docs");

        expect(getVendorPortalNote({
            vendorStatus: "blocked",
            vendorReason: "Policy issue"
        })).toBe("Your vendor access is blocked: Policy issue");

        expect(getVendorPortalNote({ vendorStatus: "none" }))
            .toBe("Vendor access is not available right now.");

        expect(getVendorWorkspaceNote({ vendorStatus: "approved" }))
            .toContain("maintain your shop profile");

        expect(getVendorWorkspaceNote({ isAdmin: true }))
            .toContain("Admin access lets you inspect");

        expect(getVendorWorkspaceNote({ vendorStatus: "none" }))
            .toContain("will become fully active");

        expect(getWelcomeMessage({ displayName: "Faranani" }))
            .toBe("Welcome back, Faranani.");

        expect(getWelcomeMessage({}))
            .toBe("Welcome back, there.");
    });

    test("home state and redirect helpers work", () => {
        const state = getHomeState({
            uid: "user-1",
            displayName: "Faranani",
            email: "user@example.com",
            vendorStatus: "approved",
            accountStatus: "active"
        });

        expect(state.displayName).toBe("Faranani");
        expect(state.roleLabel).toBe("Vendor");
        expect(state.vendorStatusLabel).toBe("Approved");
        expect(state.showCustomerPortal).toBe(true);
        expect(state.showVendorPortal).toBe(true);
        expect(state.showAdminPortal).toBe(false);
        expect(state.showChoosePortal).toBe(true);
        expect(state.shopRoute).toBe("./shop.html");
        expect(state.productsRoute).toBe("./products.html");
        expect(state.orderManagementRoute).toBe("./order-management/index.html");
        expect(state.orderDetailRoute).toBe("./order-management/order-detail.html");
        expect(state.orderNotificationsRoute).toBe("./order-management/notifications.html");
        expect(state.supportRoute).toBe("./support/index.html");
        expect(state.walletRoute).toBe("./wallet.html");
        expect(state.analyticsRoute).toBe("./analytics.html");
        expect(state.signOutRoute).toBe("../authentication/login.html");
        expect(state.financeSummary).toEqual(getDefaultFinanceSummary("user-1"));

        expect(getDefaultAvatar("Faranani")).toContain("data:image/svg+xml");

        expect(
            getSafeRedirectRoute({
                uid: "user-1",
                vendorStatus: "none",
                accountStatus: "active"
            })
        ).toBe("../customer/index.html");

        expect(
            getSafeRedirectRoute({
                accountStatus: "blocked"
            })
        ).toBe("../authentication/login.html");

        const authUtils = {
            getDefaultPortalRoute: jest.fn(() => "/custom/default.html")
        };

        expect(getSafeRedirectRoute({ uid: "user-1" }, authUtils)).toBe("/custom/default.html");
    });
});

describe("vendor/index.js finance loading helpers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.orderService;
        delete window.db;
        delete window.firestoreFns;
        delete window.payoutQueries;
        delete window.payoutModel;
    });

    test("default finance summary is empty", () => {
        expect(getDefaultFinanceSummary("vendor-1")).toEqual({
            vendorUid: "vendor-1",
            completedOrders: 0,
            totalEarned: 0,
            reservedWithdrawals: 0,
            availableBalance: 0
        });
    });

    test("snapshot and document mapping helpers support docs and forEach", () => {
        const docs = [
            {
                id: "doc-1",
                data: () => ({ name: "First" })
            }
        ];

        expect(getSnapshotDocuments({ docs })).toBe(docs);

        const forEachSnapshot = {
            forEach(callback) {
                docs.forEach(callback);
            }
        };

        expect(getSnapshotDocuments(forEachSnapshot)).toEqual(docs);
        expect(getSnapshotDocuments(null)).toEqual([]);

        expect(mapDocument(docs[0], "orderId")).toEqual({
            orderId: "doc-1",
            name: "First"
        });

        expect(mapDocument({
            id: "",
            data: () => ({ orderId: "fallback-id", name: "Fallback" })
        }, "orderId")).toEqual({
            orderId: "fallback-id",
            name: "Fallback"
        });
    });

    test("fetchVendorOrders uses orderReader, orderService, Firestore, and safe fallbacks", async () => {
        const orderReader = jest.fn(async () => [
            { orderId: "reader-order" }
        ]);

        await expect(fetchVendorOrders({
            vendorUid: "vendor-1",
            orderReader
        })).resolves.toEqual([
            { orderId: "reader-order" }
        ]);

        expect(orderReader).toHaveBeenCalledWith("vendor-1", expect.any(Object));

        const orderService = {
            getVendorOrders: jest.fn(async () => [
                { orderId: "service-order" }
            ])
        };

        await expect(fetchVendorOrders({
            vendorUid: "vendor-1",
            orderService
        })).resolves.toEqual([
            { orderId: "service-order" }
        ]);

        expect(orderService.getVendorOrders).toHaveBeenCalledWith(expect.objectContaining({
            vendorUid: "vendor-1"
        }));

        const db = { name: "mock-db" };
        const firestoreFns = createFirestoreFnsWithDocs([
            {
                id: "order-1",
                data: {
                    vendorUid: "vendor-1",
                    status: "completed",
                    paymentStatus: "paid",
                    vendorEarnings: 100
                }
            }
        ]);

        await expect(fetchVendorOrders({
            vendorUid: "vendor-1",
            db,
            firestoreFns
        })).resolves.toEqual([
            {
                orderId: "order-1",
                vendorUid: "vendor-1",
                status: "completed",
                paymentStatus: "paid",
                vendorEarnings: 100
            }
        ]);

        expect(firestoreFns.collection).toHaveBeenCalledWith(db, "orders");
        expect(firestoreFns.where).toHaveBeenCalledWith("vendorUid", "==", "vendor-1");
        expect(firestoreFns.query).toHaveBeenCalledTimes(1);
        expect(firestoreFns.getDocs).toHaveBeenCalledTimes(1);

        await expect(fetchVendorOrders({ vendorUid: "" })).resolves.toEqual([]);
        await expect(fetchVendorOrders({ vendorUid: "vendor-1", db: null, firestoreFns })).resolves.toEqual([]);
        await expect(fetchVendorOrders({ vendorUid: "vendor-1", db, firestoreFns: {} })).resolves.toEqual([]);
    });

    test("fetchVendorPayouts uses payoutReader, payoutQueries, and safe fallbacks", async () => {
        const payoutReader = jest.fn(async () => [
            { payoutId: "reader-payout" }
        ]);

        await expect(fetchVendorPayouts({
            vendorUid: "vendor-1",
            payoutReader
        })).resolves.toEqual([
            { payoutId: "reader-payout" }
        ]);

        expect(payoutReader).toHaveBeenCalledWith("vendor-1", expect.any(Object));

        const payoutQueries = {
            fetchVendorPayouts: jest.fn(async () => [
                { payoutId: "query-payout" }
            ])
        };

        const payoutModel = {
            normalizePayoutRecord: jest.fn()
        };

        await expect(fetchVendorPayouts({
            vendorUid: "vendor-1",
            payoutQueries,
            payoutModel
        })).resolves.toEqual([
            { payoutId: "query-payout" }
        ]);

        expect(payoutQueries.fetchVendorPayouts).toHaveBeenCalledWith(expect.objectContaining({
            vendorUid: "vendor-1",
            payoutModel
        }));

        await expect(fetchVendorPayouts({ vendorUid: "" })).resolves.toEqual([]);
        await expect(fetchVendorPayouts({ vendorUid: "vendor-1" })).resolves.toEqual([]);
    });

    test("calculateVendorHomeFinanceSummary uses platform pricing and fallback logic", () => {
        const orders = [
            {
                orderId: "order-1",
                vendorUid: "vendor-1",
                status: "completed",
                paymentStatus: "paid",
                vendorEarnings: 100,
                platformEarnings: 10
            },
            {
                orderId: "order-2",
                vendorUid: "vendor-1",
                status: "ready",
                paymentStatus: "paid",
                vendorEarnings: 50
            },
            {
                orderId: "order-3",
                vendorUid: "vendor-2",
                status: "completed",
                paymentStatus: "paid",
                vendorEarnings: 500
            }
        ];

        const payouts = [
            {
                payoutId: "payout-1",
                vendorUid: "vendor-1",
                amount: 35,
                status: "pending"
            },
            {
                payoutId: "payout-2",
                vendorUid: "vendor-1",
                amount: 10,
                status: "rejected"
            },
            {
                payoutId: "payout-3",
                vendorUid: "vendor-2",
                amount: 99,
                status: "approved"
            }
        ];

        // platform-pricing path: includes the gross/net/refund breakdown that
        // calculateVendorBalance now surfaces alongside the legacy fields.
        expect(calculateVendorHomeFinanceSummary(orders, payouts, {
            vendorUid: "vendor-1",
            platformPricing
        })).toEqual({
            vendorUid: "vendor-1",
            completedOrders: 1,
            grossVendorEarnings: 100,
            refundDeductions: 0,
            netVendorEarnings: 100,
            totalEarned: 100,
            reservedWithdrawals: 35,
            availableBalance: 65
        });

        // Passing `null` doesn't actually disable platform pricing — the
        // resolver falls back to globalThis.platformPricing, and then to a
        // direct require() of the shared module. Since the test file already
        // imported it at the top, the cached module wins and we get the same
        // 8-field shape. See the dedicated "manual fallback" test below for
        // the truly-no-platform-pricing path.
        expect(calculateVendorHomeFinanceSummary(orders, payouts, {
            vendorUid: "vendor-1",
            platformPricing: null
        })).toEqual({
            vendorUid: "vendor-1",
            completedOrders: 1,
            grossVendorEarnings: 100,
            refundDeductions: 0,
            netVendorEarnings: 100,
            totalEarned: 100,
            reservedWithdrawals: 35,
            availableBalance: 65
        });
    });

    test("calculateVendorHomeFinanceSummary falls back to manual computation when no platform pricing is resolvable", () => {
        // Disable every resolver path: the explicit argument, the global,
        // and the require'd module's calculateVendorBalance. This forces the
        // function down the manual filter/reduce branch that computes the
        // 5-field legacy shape directly from orders + payouts.
        const cachedModule = require.cache[require.resolve("../../public/shared/finance/platform-pricing.js")];
        const savedCalculate = cachedModule.exports.calculateVendorBalance;
        const previousGlobal = globalThis.platformPricing;

        cachedModule.exports.calculateVendorBalance = undefined;
        delete globalThis.platformPricing;

        try {
            const orders = [
                {
                    vendorUid: "vendor-1",
                    status: "completed",
                    paymentStatus: "paid",
                    vendorEarnings: 90
                },
                // Different vendor — must be excluded.
                {
                    vendorUid: "vendor-2",
                    status: "completed",
                    paymentStatus: "paid",
                    vendorEarnings: 1000
                },
                // Wrong status — must be excluded.
                {
                    vendorUid: "vendor-1",
                    status: "ready",
                    paymentStatus: "paid",
                    vendorEarnings: 70
                },
                // Order missing vendorEarnings but with vendorSubtotal — fallback chain.
                {
                    vendorUid: "vendor-1",
                    status: "completed",
                    paymentStatus: "paid",
                    vendorSubtotal: 30
                }
            ];
            const payouts = [
                { vendorUid: "vendor-1", amount: 15, status: "pending" },
                // Different vendor — must be excluded.
                { vendorUid: "vendor-2", amount: 200, status: "pending" },
                // Not a reserving status — must be excluded.
                { vendorUid: "vendor-1", amount: 5, status: "rejected" }
            ];

            expect(calculateVendorHomeFinanceSummary(orders, payouts, {
                vendorUid: "vendor-1",
                platformPricing: null
            })).toEqual({
                vendorUid: "vendor-1",
                completedOrders: 2,
                totalEarned: 120,
                reservedWithdrawals: 15,
                availableBalance: 105
            });
        } finally {
            cachedModule.exports.calculateVendorBalance = savedCalculate;
            if (previousGlobal !== undefined) {
                globalThis.platformPricing = previousGlobal;
            }
        }
    });

    test("calculateVendorHomeFinanceSummary subtracts vendor refund deductions through platform pricing", () => {
        // A completed paid order with a vendor refund deduction should reduce
        // net earnings (and therefore the available balance) by the deduction.
        const orders = [
            {
                orderId: "order-refund",
                vendorUid: "vendor-1",
                status: "completed",
                paymentStatus: "paid",
                vendorEarnings: 100,
                vendorRefundDeduction: 25
            }
        ];

        expect(calculateVendorHomeFinanceSummary(orders, [], {
            vendorUid: "vendor-1",
            platformPricing
        })).toEqual({
            vendorUid: "vendor-1",
            completedOrders: 1,
            grossVendorEarnings: 100,
            refundDeductions: 25,
            netVendorEarnings: 75,
            totalEarned: 75,
            reservedWithdrawals: 0,
            availableBalance: 75
        });
    });

    test("loadVendorFinanceSummary uses financeLoader, direct arrays, fetchers, and error fallback", async () => {
        const financeLoader = jest.fn(async () => ({
            orders: [
                {
                    vendorUid: "vendor-1",
                    status: "completed",
                    paymentStatus: "paid",
                    vendorEarnings: 80
                }
            ],
            payouts: []
        }));

        await expect(loadVendorFinanceSummary({
            uid: "vendor-1",
            vendorStatus: "approved"
        }, {
            platformPricing,
            financeLoader
        })).resolves.toEqual({
            summary: {
                vendorUid: "vendor-1",
                completedOrders: 1,
                grossVendorEarnings: 80,
                refundDeductions: 0,
                netVendorEarnings: 80,
                totalEarned: 80,
                reservedWithdrawals: 0,
                availableBalance: 80
            },
            error: null
        });

        expect(financeLoader).toHaveBeenCalledWith(expect.objectContaining({
            vendorUid: "vendor-1"
        }));

        await expect(loadVendorFinanceSummary({
            uid: "vendor-1",
            vendorStatus: "approved"
        }, {
            platformPricing,
            orders: [
                {
                    vendorUid: "vendor-1",
                    status: "completed",
                    paymentStatus: "paid",
                    vendorEarnings: 120
                }
            ],
            payouts: [
                {
                    vendorUid: "vendor-1",
                    amount: 20,
                    status: "approved"
                }
            ]
        })).resolves.toEqual({
            summary: {
                vendorUid: "vendor-1",
                completedOrders: 1,
                grossVendorEarnings: 120,
                refundDeductions: 0,
                netVendorEarnings: 120,
                totalEarned: 120,
                reservedWithdrawals: 20,
                availableBalance: 100
            },
            error: null
        });

        const orderReader = jest.fn(async () => [
            {
                vendorUid: "vendor-1",
                status: "completed",
                paymentStatus: "paid",
                vendorEarnings: 200
            }
        ]);
        const payoutReader = jest.fn(async () => [
            {
                vendorUid: "vendor-1",
                amount: 50,
                status: "paid"
            }
        ]);

        await expect(loadVendorFinanceSummary({
            uid: "vendor-1",
            vendorStatus: "approved"
        }, {
            platformPricing,
            orderReader,
            payoutReader
        })).resolves.toEqual({
            summary: {
                vendorUid: "vendor-1",
                completedOrders: 1,
                grossVendorEarnings: 200,
                refundDeductions: 0,
                netVendorEarnings: 200,
                totalEarned: 200,
                reservedWithdrawals: 50,
                availableBalance: 150
            },
            error: null
        });

        const failed = await loadVendorFinanceSummary({
            uid: "vendor-1"
        }, {
            financeLoader: jest.fn(async () => {
                throw new Error("wallet failed");
            })
        });

        expect(failed.summary).toEqual(getDefaultFinanceSummary("vendor-1"));
        expect(failed.error).toBeInstanceOf(Error);
        expect(failed.error.message).toBe("wallet failed");
    });
});

describe("vendor/index.js DOM helpers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("getPageElements returns the dashboard elements", () => {
        const elements = createVendorHomeDom();

        expect(elements.statusElement).toBe(document.querySelector("#vendor-home-status"));
        expect(elements.walletAvailableElement).toBe(document.querySelector("#vendor-wallet-available"));
        expect(elements.adminPortalButton).toBe(document.querySelector("#go-admin-portal-button"));
        expect(getPageElements(null)).toEqual(expect.any(Object));
    });

    test("basic DOM setters work safely", () => {
        const paragraph = document.createElement("p");
        const image = document.createElement("img");

        setText(paragraph, "Hello");
        expect(paragraph.textContent).toBe("Hello");

        setText(paragraph, null);
        expect(paragraph.textContent).toBe("");

        setHidden(paragraph, true);
        expect(paragraph.hidden).toBe(true);
        expect(paragraph.getAttribute("aria-hidden")).toBe("true");

        setHidden(paragraph, false);
        expect(paragraph.hidden).toBe(false);
        expect(paragraph.getAttribute("aria-hidden")).toBe("false");

        setStatusMessage(paragraph, "Loaded", "success");
        expect(paragraph.textContent).toBe("Loaded");
        expect(paragraph.dataset.state).toBe("success");

        setImage(image, "https://example.com/photo.jpg", "Photo alt", "Faranani");
        expect(image.src).toContain("https://example.com/photo.jpg");
        expect(image.alt).toBe("Photo alt");

        setImage(image, "", "", "Faranani");
        expect(image.src).toContain("data:image/svg+xml");
        expect(image.alt).toBe("User profile picture");

        expect(() => setText(null, "Hello")).not.toThrow();
        expect(() => setHidden(null, true)).not.toThrow();
        expect(() => setStatusMessage(null, "Hello", "success")).not.toThrow();
        expect(() => setImage(null, "", "", "User")).not.toThrow();
    });

    test("renderFinanceSummary renders wallet values and default message", () => {
        const elements = createVendorHomeDom();

        renderFinanceSummary(elements, {
            availableBalance: 65,
            totalEarned: 100,
            reservedWithdrawals: 35,
            completedOrders: 1
        });

        expect(elements.walletNoteElement.textContent)
            .toBe("These figures use completed paid orders and reserved withdrawal requests.");
        expect(elements.walletAvailableElement.textContent).toBe("R 65.00");
        expect(elements.walletEarnedElement.textContent).toBe("R 100.00");
        expect(elements.walletReservedElement.textContent).toBe("R 35.00");
        expect(elements.walletOrdersElement.textContent).toBe("1");

        renderFinanceSummary(elements, null);

        expect(elements.walletNoteElement.textContent)
            .toBe("No completed paid orders have added to your wallet yet.");
        expect(elements.walletAvailableElement.textContent).toBe("R 0.00");
        expect(elements.walletOrdersElement.textContent).toBe("0");

        expect(() => renderFinanceSummary(null, null)).not.toThrow();
    });

    test("renderVendorHomePage renders dashboard state", () => {
        const elements = createVendorHomeDom();

        renderVendorHomePage(elements, {
            profile: {
                email: "user@example.com",
                photoURL: ""
            },
            displayName: "Faranani",
            roleLabel: "Vendor",
            vendorStatusLabel: "Approved",
            portalSummary: "You can switch between the customer and vendor portals.",
            welcomeMessage: "Welcome back, Faranani.",
            vendorPortalNote: "Your vendor account is approved and ready to manage a shop.",
            vendorWorkspaceNote: "From here you can maintain your shop profile, keep your menu updated, and prepare for order management.",
            financeSummary: {
                availableBalance: 65,
                totalEarned: 100,
                reservedWithdrawals: 35,
                completedOrders: 1
            },
            financeStatusMessage: "Completed paid orders are reflected in this wallet snapshot.",
            showCustomerPortal: true,
            showVendorPortal: true,
            showAdminPortal: false,
            showChoosePortal: true
        });

        expect(elements.statusElement.textContent).toBe("Vendor dashboard loaded.");
        expect(elements.statusElement.dataset.state).toBe("success");
        expect(elements.nameLine.textContent).toBe("Faranani");
        expect(elements.roleLine.textContent).toBe("Vendor");
        expect(elements.emailLine.textContent).toBe("user@example.com");
        expect(elements.vendorLine.textContent).toBe("Approved");
        expect(elements.portalSummaryElement.textContent)
            .toBe("You can switch between the customer and vendor portals.");
        expect(elements.vendorPortalNoteElement.textContent)
            .toBe("Your vendor account is approved and ready to manage a shop.");
        expect(elements.vendorWorkspaceNoteElement.textContent)
            .toContain("maintain your shop profile");
        expect(elements.walletNoteElement.textContent)
            .toBe("Completed paid orders are reflected in this wallet snapshot.");
        expect(elements.walletAvailableElement.textContent).toBe("R 65.00");
        expect(elements.walletEarnedElement.textContent).toBe("R 100.00");
        expect(elements.walletReservedElement.textContent).toBe("R 35.00");
        expect(elements.walletOrdersElement.textContent).toBe("1");
        expect(elements.photoCaptionElement.textContent)
            .toBe("No profile picture was found, so a default avatar is being shown.");
        expect(elements.customerPortalButton.hidden).toBe(false);
        expect(elements.vendorPortalButton.hidden).toBe(false);
        expect(elements.adminPortalButton.hidden).toBe(true);
        expect(elements.choosePortalButton.hidden).toBe(false);

        expect(() => renderVendorHomePage(null, null)).not.toThrow();
    });

    test("navigation helpers work", async () => {
        const button = document.createElement("button");
        const navigate = jest.fn();

        const navController = attachNavigationHandler({
            button,
            route: "/next-page.html",
            navigate
        });

        expect(navController).toBeTruthy();

        expect(
            navController.handleClick({
                preventDefault: jest.fn()
            })
        ).toBe("/next-page.html");

        expect(navigate).toHaveBeenCalledWith("/next-page.html");

        expect(attachNavigationHandler({ button: null, route: "/x" })).toBeNull();
        expect(attachNavigationHandler({ button, route: "" })).toBeNull();
    });

    test("sign out helpers support signOutUser, signOut, logout, and failures", async () => {
        const button = document.createElement("button");
        const statusElement = document.createElement("p");
        const navigate = jest.fn();

        const signOutUser = jest.fn().mockResolvedValue(true);
        const signOut = jest.fn().mockResolvedValue(true);
        const logout = jest.fn().mockResolvedValue(true);

        expect(getSignOutFunction({ signOutUser })).toEqual(expect.any(Function));
        expect(getSignOutFunction({ signOut })).toEqual(expect.any(Function));
        expect(getSignOutFunction({ logout })).toEqual(expect.any(Function));
        expect(getSignOutFunction({})).toBeNull();
        expect(getSignOutFunction(null)).toBeNull();

        const controller = attachSignOutHandler({
            button,
            authService: { signOutUser },
            navigate,
            nextRoute: "/signed-out.html",
            statusElement
        });

        expect(controller).toBeTruthy();

        await expect(controller.handleClick({
            preventDefault: jest.fn()
        })).resolves.toEqual({
            success: true,
            nextRoute: "/signed-out.html"
        });

        expect(signOutUser).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith("/signed-out.html");

        const failedController = attachSignOutHandler({
            button: document.createElement("button"),
            authService: {
                signOutUser: jest.fn().mockRejectedValue(new Error("Sign out failed"))
            },
            navigate,
            nextRoute: "/login.html",
            statusElement
        });

        const failed = await failedController.handleClick({
            preventDefault: jest.fn()
        });

        expect(failed.success).toBe(false);
        expect(failed.message).toBe("Sign out failed");
        expect(statusElement.textContent).toBe("Sign out failed");
        expect(statusElement.dataset.state).toBe("error");

        expect(attachSignOutHandler({ button: null })).toBeNull();
        expect(attachSignOutHandler({ button, authService: {}, nextRoute: "/x" })).toBeNull();
    });
});

describe("vendor/index.js loading and initialization", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.authUtils;
        delete window.authService;
        delete window.platformPricing;
        delete window.payoutQueries;
    });

    test("loadVendorHomeState validates auth service dependencies", async () => {
        await expect(
            loadVendorHomeState({
                authService: {
                    getCurrentUserProfile: jest.fn()
                }
            })
        ).rejects.toThrow("authService.getCurrentUser is required.");

        await expect(
            loadVendorHomeState({
                authService: {
                    getCurrentUser: jest.fn(() => ({ uid: "user-1" }))
                }
            })
        ).rejects.toThrow("authService.getCurrentUserProfile is required.");
    });

    test("loadVendorHomeState redirects signed-out users to login", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => null),
            getCurrentUserProfile: jest.fn()
        };

        const result = await loadVendorHomeState({ authService });

        expect(result).toEqual({
            success: false,
            message: "No user is currently signed in.",
            nextRoute: "../authentication/login.html"
        });
    });

    test("loadVendorHomeState rejects customer-only users", async () => {
        const result = await loadVendorHomeState({
            authService: {
                getCurrentUser: jest.fn(() => ({
                    uid: "user-1"
                })),
                getCurrentUserProfile: jest.fn().mockResolvedValue({
                    uid: "user-1",
                    displayName: "Customer User",
                    email: "user@example.com",
                    vendorStatus: "none",
                    accountStatus: "active"
                })
            }
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("You do not have access to the vendor portal.");
        expect(result.nextRoute).toBe("../customer/index.html");
    });

    test("loadVendorHomeState returns state for vendor and loads wallet summary", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-2",
                displayName: "Vendor User",
                email: "vendor@example.com",
                phoneNumber: "+27712345678",
                photoURL: "https://example.com/fallback.jpg"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-2",
                displayName: "Vendor User",
                email: "vendor@example.com",
                phoneNumber: "+27712345678",
                photoURL: "https://example.com/fallback.jpg",
                vendorStatus: "approved",
                accountStatus: "active"
            })
        };

        const financeLoader = jest.fn(async () => ({
            orders: [
                {
                    vendorUid: "user-2",
                    status: "completed",
                    paymentStatus: "paid",
                    vendorEarnings: 120
                }
            ],
            payouts: [
                {
                    vendorUid: "user-2",
                    amount: 20,
                    status: "pending"
                }
            ]
        }));

        const result = await loadVendorHomeState({
            authService,
            financeLoader,
            platformPricing
        });

        expect(result.success).toBe(true);
        expect(result.profile.uid).toBe("user-2");
        expect(result.state.displayName).toBe("Vendor User");
        expect(result.state.financeSummary.availableBalance).toBe(100);
        expect(result.state.financeStatusMessage).toBe("Completed paid orders are reflected in this wallet snapshot.");
        expect(financeLoader).toHaveBeenCalledWith(expect.objectContaining({
            vendorUid: "user-2"
        }));
    });

    test("loadVendorHomeState uses fallback profile when profile is missing", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "fallback-user",
                displayName: "Fallback Vendor",
                email: "fallback@example.com",
                vendorStatus: "approved",
                accountStatus: "active"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue(null)
        };

        const result = await loadVendorHomeState({
            authService,
            orders: [],
            payouts: []
        });

        expect(result.success).toBe(true);
        expect(result.profile.uid).toBe("fallback-user");
        expect(result.state.displayName).toBe("Fallback Vendor");
    });

    test("initializeVendorHomePage throws when authService is missing", async () => {
        createVendorHomeDom();

        await expect(initializeVendorHomePage()).rejects.toThrow("authService is required.");
    });

    test("initializeVendorHomePage redirects signed-out users", async () => {
        const elements = createVendorHomeDom();
        const navigate = jest.fn();

        const result = await initializeVendorHomePage({
            authService: {
                getCurrentUser: jest.fn(() => null),
                getCurrentUserProfile: jest.fn()
            },
            navigate
        });

        expect(result).toEqual({
            redirected: true,
            nextRoute: "../authentication/login.html"
        });

        expect(navigate).toHaveBeenCalledWith("../authentication/login.html");
        expect(elements.statusElement.textContent).toBe("No user is currently signed in.");
        expect(elements.statusElement.dataset.state).toBe("error");
    });

    test("initializeVendorHomePage renders state and wires navigation", async () => {
        const elements = createVendorHomeDom();
        const navigate = jest.fn();

        const result = await initializeVendorHomePage({
            authService: {
                getCurrentUser: jest.fn(() => ({
                    uid: "user-3"
                })),
                getCurrentUserProfile: jest.fn().mockResolvedValue({
                    uid: "user-3",
                    displayName: "Admin Vendor",
                    email: "admin@example.com",
                    isAdmin: true,
                    vendorStatus: "approved",
                    accountStatus: "active"
                }),
                signOutUser: jest.fn().mockResolvedValue(true)
            },
            navigate,
            platformPricing,
            orders: [
                {
                    vendorUid: "user-3",
                    status: "completed",
                    paymentStatus: "paid",
                    vendorEarnings: 200
                }
            ],
            payouts: [
                {
                    vendorUid: "user-3",
                    amount: 50,
                    status: "approved"
                }
            ]
        });

        expect(result.redirected).toBe(false);
        expect(result.state.financeSummary.availableBalance).toBe(150);

        expect(result.profileController).toBeTruthy();
        expect(result.shopController).toBeTruthy();
        expect(result.productsController).toBeTruthy();
        expect(result.orderManagementController).toBeTruthy();
        expect(result.orderDetailController).toBeTruthy();
        expect(result.orderNotificationsController).toBeTruthy();
        expect(result.supportController).toBeTruthy();
        expect(result.walletButtonController).toBeTruthy();
        expect(result.walletLinkController).toBeTruthy();
        expect(result.analyticsController).toBeTruthy();
        expect(result.choosePortalController).toBeTruthy();
        expect(result.customerPortalController).toBeTruthy();
        expect(result.vendorPortalController).toBeTruthy();
        expect(result.adminPortalController).toBeTruthy();
        expect(result.signOutController).toBeTruthy();

        expect(elements.roleLine.textContent).toBe("Admin and Vendor");
        expect(elements.walletAvailableElement.textContent).toBe("R 150.00");
        expect(elements.walletEarnedElement.textContent).toBe("R 200.00");
        expect(elements.walletReservedElement.textContent).toBe("R 50.00");
        expect(elements.walletOrdersElement.textContent).toBe("1");

        elements.profileButton.click();
        elements.shopButton.click();
        elements.productsButton.click();
        elements.orderManagementButton.click();
        elements.orderDetailButton.click();
        elements.orderNotificationsButton.click();
        elements.supportLink.click();
        elements.walletButton.click();
        elements.walletLink.click();
        elements.analyticsLink.click();
        elements.customerPortalButton.click();
        elements.vendorPortalButton.click();
        elements.adminPortalButton.click();

        await result.signOutController.handleClick({
            preventDefault: jest.fn()
        });

        await flushPromises();

        expect(navigate).toHaveBeenCalledWith("../authentication/profile.html");
        expect(navigate).toHaveBeenCalledWith("./shop.html");
        expect(navigate).toHaveBeenCalledWith("./products.html");
        expect(navigate).toHaveBeenCalledWith("./order-management/index.html");
        expect(navigate).toHaveBeenCalledWith("./order-management/order-detail.html");
        expect(navigate).toHaveBeenCalledWith("./order-management/notifications.html");
        expect(navigate).toHaveBeenCalledWith("./support/index.html");
        expect(navigate).toHaveBeenCalledWith("./wallet.html");
        expect(navigate).toHaveBeenCalledWith("./analytics.html");
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
        expect(navigate).toHaveBeenCalledWith("./index.html");
        expect(navigate).toHaveBeenCalledWith("../admin/index.html");
        expect(navigate).toHaveBeenCalledWith("../authentication/login.html");
    });

    test("initializeVendorHomePage handles loading failures", async () => {
        const elements = createVendorHomeDom();

        const failed = await initializeVendorHomePage({
            authService: {
                getCurrentUser: jest.fn(() => ({
                    uid: "user-4"
                })),
                getCurrentUserProfile: jest.fn().mockRejectedValue(new Error("Failed to load profile")),
                signOutUser: jest.fn()
            }
        });

        expect(failed.redirected).toBe(false);
        expect(failed.message).toBe("Failed to load profile");
        expect(elements.statusElement.textContent).toBe("Failed to load profile");
        expect(elements.statusElement.dataset.state).toBe("error");
    });

    test("initializeVendorHomePage uses window.authService fallback", async () => {
        createVendorHomeDom();

        window.authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-5"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-5",
                displayName: "Window Vendor",
                email: "window@example.com",
                vendorStatus: "approved",
                accountStatus: "active"
            }),
            signOutUser: jest.fn().mockResolvedValue(true)
        };

        const result = await initializeVendorHomePage({
            orders: [],
            payouts: []
        });

        expect(result.redirected).toBe(false);
        expect(window.authService.getCurrentUser).toHaveBeenCalledTimes(1);
        expect(document.querySelector("#profile-name-line").textContent).toBe("Window Vendor");
    });
});