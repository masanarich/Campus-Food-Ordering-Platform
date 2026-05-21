/**
 * @jest-environment jsdom
 */

const adminHomePage = require("../../public/admin/index.js");
const platformPricing = require("../../public/shared/finance/platform-pricing.js");

const {
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
} = adminHomePage;

function createAdminHomeDom() {
    document.body.innerHTML = `
        <main>
            <p id="admin-home-status"></p>

            <img id="profile-photo" src="" alt="">
            <p id="profile-photo-caption"></p>

            <output id="profile-name-line"></output>
            <output id="profile-role-line"></output>
            <output id="profile-email-line"></output>
            <output id="profile-vendor-line"></output>
            <output id="profile-admin-line"></output>

            <p id="portal-summary"></p>
            <p id="welcome-message"></p>
            <p id="management-summary"></p>
            <p id="admin-access-note"></p>

            <p id="admin-finance-note"></p>
            <output id="admin-platform-balance"></output>
            <output id="admin-customer-revenue"></output>
            <output id="admin-vendor-earnings"></output>
            <output id="admin-completed-orders"></output>

            <button id="go-profile-button" type="button">Profile</button>
            <button id="manage-users-button" type="button">Manage Users</button>
            <button id="finance-button" type="button">Finance</button>
            <button id="review-disputes-button" type="button">Review Disputes</button>
            <button id="admin-ticket-detail-link" type="button">Open Ticket Detail</button>
            <button id="analytics-button" type="button">View Analytics</button>
            <button id="choose-portal-button" type="button">Choose Portal</button>
            <button id="sign-out-button" type="button">Sign Out</button>
            <button id="go-customer-portal-button" type="button">Customer Portal</button>
            <button id="go-vendor-portal-button" type="button">Vendor Portal</button>
        </main>
    `;

    return {
        statusElement: document.getElementById("admin-home-status"),
        profilePhoto: document.getElementById("profile-photo"),
        photoCaptionElement: document.getElementById("profile-photo-caption"),
        nameLine: document.getElementById("profile-name-line"),
        roleLine: document.getElementById("profile-role-line"),
        emailLine: document.getElementById("profile-email-line"),
        vendorLine: document.getElementById("profile-vendor-line"),
        adminLine: document.getElementById("profile-admin-line"),
        portalSummaryElement: document.getElementById("portal-summary"),
        welcomeMessageElement: document.getElementById("welcome-message"),
        managementSummaryElement: document.getElementById("management-summary"),
        adminAccessNoteElement: document.getElementById("admin-access-note"),
        financeNoteElement: document.getElementById("admin-finance-note"),
        platformBalanceElement: document.getElementById("admin-platform-balance"),
        customerRevenueElement: document.getElementById("admin-customer-revenue"),
        vendorEarningsElement: document.getElementById("admin-vendor-earnings"),
        completedOrdersElement: document.getElementById("admin-completed-orders"),
        profileButton: document.getElementById("go-profile-button"),
        manageUsersButton: document.getElementById("manage-users-button"),
        financeButton: document.getElementById("finance-button"),
        reviewDisputesButton: document.getElementById("review-disputes-button"),
        ticketDetailButton: document.getElementById("admin-ticket-detail-link"),
        analyticsButton: document.getElementById("analytics-button"),
        choosePortalButton: document.getElementById("choose-portal-button"),
        signOutButton: document.getElementById("sign-out-button"),
        customerPortalButton: document.getElementById("go-customer-portal-button"),
        vendorPortalButton: document.getElementById("go-vendor-portal-button")
    };
}

function createFirestoreFnsWithDocs(docs) {
    return {
        collection: jest.fn((db, collectionName) => ({
            db,
            collectionName,
            type: "collectionRef"
        })),
        orderBy: jest.fn((field, direction) => ({
            field,
            direction,
            type: "orderBy"
        })),
        query: jest.fn((collectionRef, orderByRef) => ({
            collectionRef,
            orderByRef,
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

function resetWindowPath() {
    window.history.pushState({}, "", "/admin/index.html");
}

describe("admin/index.js constants and helper functions", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.authUtils;
        delete window.platformPricing;
        delete window.authService;
        delete window.auth;
        delete window.authFns;
        delete window.db;
        delete window.firestoreFns;
        delete window.orderService;
        resetWindowPath();
    });

    test("exports expected constants", () => {
        expect(MODULE_NAME).toBe("admin/index");
        expect(ORDERS_COLLECTION).toBe("orders");
        expect(DEFAULT_CURRENCY).toBe("ZAR");
    });

    test("normalizes text, lower-case text, money, and currency consistently", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
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
    });

    test("normalizes vendor, admin application, and account statuses", () => {
        expect(normalizeVendorStatus("suspended")).toBe("blocked");
        expect(normalizeVendorStatus("approved")).toBe("approved");
        expect(normalizeVendorStatus("pending")).toBe("pending");
        expect(normalizeVendorStatus("rejected")).toBe("rejected");
        expect(normalizeVendorStatus("blocked")).toBe("blocked");
        expect(normalizeVendorStatus("mystery")).toBe("none");

        expect(normalizeAdminApplicationStatus("anything", true)).toBe("approved");
        expect(normalizeAdminApplicationStatus("suspended", false)).toBe("blocked");
        expect(normalizeAdminApplicationStatus("pending", false)).toBe("pending");
        expect(normalizeAdminApplicationStatus("mystery", false)).toBe("none");

        expect(normalizeAccountStatus("disabled")).toBe("disabled");
        expect(normalizeAccountStatus("blocked")).toBe("blocked");
        expect(normalizeAccountStatus("inactive")).toBe("active");
    });

    test("resolves auth utilities and platform pricing from explicit and global values", () => {
        const explicitAuthUtils = { value: "explicit" };
        window.authUtils = { value: "window" };

        expect(resolveAuthUtils(explicitAuthUtils)).toBe(explicitAuthUtils);
        expect(resolveAuthUtils()).toBe(window.authUtils);

        delete window.authUtils;
        expect(resolveAuthUtils()).toBeNull();

        expect(resolvePlatformPricing(platformPricing)).toBe(platformPricing);

        window.platformPricing = platformPricing;
        expect(resolvePlatformPricing()).toBe(platformPricing);

        delete window.platformPricing;
        expect(resolvePlatformPricing({ bad: true })).not.toBe({ bad: true });
    });

    test("returns fallback routes and resolves portal routes", () => {
        expect(getFallbackRoutes()).toEqual({
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
        });

        expect(getPortalRoute("customer")).toBe("../customer/index.html");
        expect(getPortalRoute("vendor")).toBe("../vendor/index.html");
        expect(getPortalRoute("admin")).toBe("./index.html");
        expect(getPortalRoute("roleChoice")).toBe("../authentication/role-choice.html");
        expect(getPortalRoute("profile")).toBe("../authentication/profile.html");
        expect(getPortalRoute("users")).toBe("./users.html");
        expect(getPortalRoute("finance")).toBe("./finance.html");
        expect(getPortalRoute("disputes")).toBe("./disputes.html");
        expect(getPortalRoute("ticketDetail")).toBe("./ticket-detail.html");
        expect(getPortalRoute("analytics")).toBe("./analytics.html");
        expect(getPortalRoute("signOut")).toBe("../authentication/login.html");
        expect(getPortalRoute("unknown")).toBe("../authentication/login.html");
    });

    test("uses authUtils route helpers when available", () => {
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

    test("normalizes profile with built-in logic", () => {
        const result = normalizeProfile({
            uid: " user-1 ",
            fullName: " Faranani ",
            email: " USER@example.com ",
            phoneNumber: " 0712345678 ",
            photoURL: " https://example.com/p.jpg ",
            admin: true,
            vendorStatus: "suspended",
            rejectionReason: " Missing docs ",
            adminRejectionReason: " Missing explanation ",
            accountStatus: "inactive"
        });

        expect(result).toEqual({
            uid: "user-1",
            displayName: "Faranani",
            email: "user@example.com",
            phoneNumber: "0712345678",
            photoURL: "https://example.com/p.jpg",
            isAdmin: true,
            vendorStatus: "blocked",
            vendorReason: "Missing docs",
            adminApplicationStatus: "approved",
            adminApplicationReason: "Missing explanation",
            accountStatus: "active"
        });
    });

    test("normalizes profile through authUtils normalisers when provided", () => {
        const normalized = {
            uid: "user-2",
            displayName: "Auth Utils User",
            email: "utils@example.com",
            phoneNumber: "",
            photoURL: "",
            isAdmin: true,
            vendorStatus: "approved",
            vendorReason: "",
            adminApplicationStatus: "approved",
            adminApplicationReason: "",
            accountStatus: "active"
        };

        const authUtilsBritish = {
            normaliseUserData: jest.fn(() => normalized)
        };

        const authUtilsAmerican = {
            normalizeUserData: jest.fn(() => normalized)
        };

        expect(normalizeProfile({ uid: "raw-1" }, authUtilsBritish)).toBe(normalized);
        expect(authUtilsBritish.normaliseUserData).toHaveBeenCalledWith({ uid: "raw-1" });

        expect(normalizeProfile({ uid: "raw-2" }, authUtilsAmerican)).toBe(normalized);
        expect(authUtilsAmerican.normalizeUserData).toHaveBeenCalledWith({ uid: "raw-2" });
    });

    test("identity, access, and role helpers work", () => {
        expect(hasAuthenticatedIdentity({ uid: "user-1" })).toBe(true);
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
        expect(canAccessVendorPortal({ vendorStatus: "pending", accountStatus: "active" })).toBe(false);
        expect(canAccessAdminPortal({ isAdmin: true, accountStatus: "active" })).toBe(true);
        expect(canAccessAdminPortal({ isAdmin: true, accountStatus: "disabled" })).toBe(false);
    });

    test("access helpers delegate to authUtils when available", () => {
        const authUtils = {
            canAccessCustomerPortal: jest.fn(() => false),
            canAccessVendorPortal: jest.fn(() => true),
            canAccessAdminPortal: jest.fn(() => true)
        };

        expect(canAccessCustomerPortal({ uid: "user-1" }, authUtils)).toBe(false);
        expect(canAccessVendorPortal({ uid: "user-1" }, authUtils)).toBe(true);
        expect(canAccessAdminPortal({ uid: "user-1" }, authUtils)).toBe(true);

        expect(authUtils.canAccessCustomerPortal).toHaveBeenCalled();
        expect(authUtils.canAccessVendorPortal).toHaveBeenCalled();
        expect(authUtils.canAccessAdminPortal).toHaveBeenCalled();
    });

    test("label and message helpers return expected values", () => {
        expect(getVendorStatusLabel({ vendorStatus: "approved" })).toBe("Approved");
        expect(getVendorStatusLabel({ vendorStatus: "pending" })).toBe("Pending");
        expect(getVendorStatusLabel({ vendorStatus: "rejected" })).toBe("Rejected");
        expect(getVendorStatusLabel({ vendorStatus: "blocked" })).toBe("Blocked");
        expect(getVendorStatusLabel({ vendorStatus: "none" })).toBe("Not Applied");

        expect(getAdminStatusLabel({ isAdmin: true })).toBe("Approved");
        expect(getAdminStatusLabel({ adminApplicationStatus: "pending" })).toBe("Pending");
        expect(getAdminStatusLabel({ adminApplicationStatus: "rejected" })).toBe("Rejected");
        expect(getAdminStatusLabel({ adminApplicationStatus: "blocked" })).toBe("Blocked");
        expect(getAdminStatusLabel({ adminApplicationStatus: "none" })).toBe("Not Applied");

        expect(getPortalSummary({
            showCustomerPortal: true,
            showVendorPortal: true,
            showAdminPortal: true
        })).toBe("You can switch between the customer, vendor, and admin portals.");

        expect(getPortalSummary({
            showCustomerPortal: true,
            showVendorPortal: false,
            showAdminPortal: true
        })).toBe("You can switch between the customer and admin portals.");

        expect(getPortalSummary({
            showCustomerPortal: false,
            showVendorPortal: true,
            showAdminPortal: true
        })).toBe("You can switch between the vendor and admin portals.");

        expect(getPortalSummary({
            showCustomerPortal: false,
            showVendorPortal: false,
            showAdminPortal: true
        })).toBe("You currently have admin portal access only.");

        expect(getPortalSummary({
            showCustomerPortal: false,
            showVendorPortal: false,
            showAdminPortal: false
        })).toBe("You do not currently have portal access.");

        expect(getPortalSummary(null)).toBe("");

        expect(getManagementSummary({ vendorStatus: "approved" })).toContain("still having vendor access");
        expect(getManagementSummary({ vendorStatus: "none" })).toContain("customer support disputes");
        expect(getAdminAccessNote({ isAdmin: true })).toBe("Your admin access is approved and active.");
        expect(getAdminAccessNote({})).toBe("Admin access is not available right now.");
        expect(getWelcomeMessage({ displayName: "Faranani" })).toBe("Welcome back, Faranani.");
        expect(getWelcomeMessage({})).toBe("Welcome back, there.");
    });

    test("builds home state for an admin", () => {
        const state = getHomeState({
            uid: "user-1",
            displayName: "Faranani",
            email: "user@example.com",
            isAdmin: true,
            vendorStatus: "approved",
            accountStatus: "active"
        });

        expect(state.displayName).toBe("Faranani");
        expect(state.roleLabel).toBe("Admin and Vendor");
        expect(state.vendorStatusLabel).toBe("Approved");
        expect(state.adminStatusLabel).toBe("Approved");
        expect(state.adminAccessNote).toBe("Your admin access is approved and active.");
        expect(state.managementSummary).toContain("still having vendor access");
        expect(state.welcomeMessage).toBe("Welcome back, Faranani.");
        expect(state.showCustomerPortal).toBe(true);
        expect(state.showVendorPortal).toBe(true);
        expect(state.showAdminPortal).toBe(true);
    });
});

describe("admin/index.js finance helpers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.db;
        delete window.firestoreFns;
        delete window.orderService;
        resetWindowPath();
    });

    test("identifies completed paid orders", () => {
        expect(isCompletedPaidOrder({
            status: "completed",
            paymentStatus: "paid"
        })).toBe(true);

        expect(isCompletedPaidOrder({
            orderStatus: "completed",
            paymentState: ""
        })).toBe(true);

        expect(isCompletedPaidOrder({
            status: "ready",
            paymentStatus: "paid"
        })).toBe(false);

        expect(isCompletedPaidOrder(null)).toBe(false);
    });

    test("returns default finance summary", () => {
        expect(getDefaultFinanceSummary()).toEqual({
            completedOrders: 0,
            customerRevenue: 0,
            platformEarnings: 0,
            platformBalance: 0,
            vendorEarnings: 0
        });
    });

    test("calculates finance summary with platformPricing", () => {
        const summary = calculateAdminFinanceSummary([
            {
                orderId: "order-1",
                status: "completed",
                paymentStatus: "paid",
                paymentAmount: 110,
                vendorEarnings: 100,
                platformEarnings: 10
            },
            {
                orderId: "order-2",
                status: "ready",
                paymentStatus: "paid",
                paymentAmount: 55,
                vendorEarnings: 50,
                platformEarnings: 5
            }
        ], {
            platformPricing
        });

        expect(summary).toEqual({
            completedOrders: 1,
            customerRevenue: 110,
            platformEarnings: 10,
            platformBalance: 10,
            vendorEarnings: 100
        });
    });

    test("calculates finance summary without platformPricing fallback", () => {
        const summary = calculateAdminFinanceSummary([
            {
                orderId: "order-1",
                status: "completed",
                paymentStatus: "paid",
                paymentAmount: 220,
                vendorSubtotal: 200,
                platformFee: 20
            },
            {
                orderId: "order-2",
                status: "cancelled",
                paymentStatus: "paid",
                paymentAmount: 999,
                vendorSubtotal: 999,
                platformFee: 999
            }
        ], {
            platformPricing: null
        });

        expect(summary).toEqual({
            completedOrders: 1,
            customerRevenue: 220,
            platformEarnings: 20,
            platformBalance: 20,
            vendorEarnings: 200
        });
    });

    test("fetchFinanceOrders uses orderReader when provided", async () => {
        const orderReader = jest.fn(async () => [
            { orderId: "order-1" }
        ]);

        await expect(fetchFinanceOrders({ orderReader })).resolves.toEqual([
            { orderId: "order-1" }
        ]);

        expect(orderReader).toHaveBeenCalledTimes(1);
    });

    test("fetchFinanceOrders uses orderService when provided", async () => {
        const orderService = {
            getAllOrders: jest.fn(async () => [
                { orderId: "order-service-1" }
            ])
        };

        await expect(fetchFinanceOrders({ orderService })).resolves.toEqual([
            { orderId: "order-service-1" }
        ]);

        expect(orderService.getAllOrders).toHaveBeenCalledTimes(1);
    });

    test("fetchFinanceOrders reads Firestore docs", async () => {
        const db = { name: "mock-db" };
        const firestoreFns = createFirestoreFnsWithDocs([
            {
                id: "order-1",
                data: {
                    status: "completed",
                    paymentStatus: "paid",
                    paymentAmount: 110
                }
            }
        ]);

        const result = await fetchFinanceOrders({
            db,
            firestoreFns
        });

        expect(result).toEqual([
            {
                orderId: "order-1",
                status: "completed",
                paymentStatus: "paid",
                paymentAmount: 110
            }
        ]);

        expect(firestoreFns.collection).toHaveBeenCalledWith(db, "orders");
        expect(firestoreFns.orderBy).toHaveBeenCalledWith("createdAt", "desc");
        expect(firestoreFns.query).toHaveBeenCalledTimes(1);
        expect(firestoreFns.getDocs).toHaveBeenCalledTimes(1);
    });

    test("fetchFinanceOrders supports snapshot.forEach and missing Firestore dependencies", async () => {
        const db = { name: "mock-db" };
        const firestoreFns = {
            collection: jest.fn(() => ({ name: "orders" })),
            getDocs: jest.fn(async () => ({
                forEach(callback) {
                    callback({
                        id: "order-for-each",
                        data: () => ({
                            status: "completed",
                            paymentStatus: "paid",
                            paymentAmount: 55
                        })
                    });
                }
            }))
        };

        await expect(fetchFinanceOrders({
            db,
            firestoreFns
        })).resolves.toEqual([
            {
                orderId: "order-for-each",
                status: "completed",
                paymentStatus: "paid",
                paymentAmount: 55
            }
        ]);

        await expect(fetchFinanceOrders({ db: null, firestoreFns })).resolves.toEqual([]);
        await expect(fetchFinanceOrders({ db, firestoreFns: {} })).resolves.toEqual([]);
    });

    test("loadAdminFinanceSummary uses financeLoader and direct orders", async () => {
        await expect(loadAdminFinanceSummary({
            platformPricing,
            financeLoader: jest.fn(async () => ({
                orders: [
                    {
                        status: "completed",
                        paymentStatus: "paid",
                        paymentAmount: 110,
                        vendorEarnings: 100,
                        platformEarnings: 10
                    }
                ]
            }))
        })).resolves.toEqual({
            summary: {
                completedOrders: 1,
                customerRevenue: 110,
                platformEarnings: 10,
                platformBalance: 10,
                vendorEarnings: 100
            },
            error: null
        });

        await expect(loadAdminFinanceSummary({
            platformPricing,
            orders: [
                {
                    status: "completed",
                    paymentStatus: "paid",
                    paymentAmount: 220,
                    vendorEarnings: 200,
                    platformEarnings: 20
                }
            ]
        })).resolves.toEqual({
            summary: {
                completedOrders: 1,
                customerRevenue: 220,
                platformEarnings: 20,
                platformBalance: 20,
                vendorEarnings: 200
            },
            error: null
        });
    });

    test("loadAdminFinanceSummary returns default summary on loader error", async () => {
        const result = await loadAdminFinanceSummary({
            financeLoader: jest.fn(async () => {
                throw new Error("finance failed");
            })
        });

        expect(result.summary).toEqual(getDefaultFinanceSummary());
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe("finance failed");
    });

    test("renders finance summary to the admin card", async () => {
        createAdminHomeDom();

        renderAdminFinanceSummary({
            completedOrders: 2,
            customerRevenue: 330,
            platformBalance: 30,
            platformEarnings: 30,
            vendorEarnings: 300
        });

        expect(document.getElementById("admin-platform-balance").textContent).toBe("R 30.00");
        expect(document.getElementById("admin-customer-revenue").textContent).toBe("R 330.00");
        expect(document.getElementById("admin-vendor-earnings").textContent).toBe("R 300.00");
        expect(document.getElementById("admin-completed-orders").textContent).toBe("2");
        expect(document.getElementById("admin-finance-note").textContent)
            .toBe("Showing live figures from 2 completed paid order(s).");

        renderAdminFinanceSummary(getDefaultFinanceSummary());

        expect(document.getElementById("admin-finance-note").textContent)
            .toBe("No completed paid orders have been counted yet.");

        renderAdminFinanceSummary(getDefaultFinanceSummary(), new Error("no permission"));

        expect(document.getElementById("admin-finance-note").textContent)
            .toBe("Finance figures could not be loaded. Open Finance to refresh or check permissions.");
    });

    test("refreshAdminFinanceSummary loads and renders figures", async () => {
        createAdminHomeDom();

        const result = await refreshAdminFinanceSummary({
            platformPricing,
            orders: [
                {
                    status: "completed",
                    paymentStatus: "paid",
                    paymentAmount: 110,
                    vendorEarnings: 100,
                    platformEarnings: 10
                }
            ]
        });

        expect(result.summary.platformBalance).toBe(10);
        expect(document.getElementById("admin-finance-note").textContent)
            .toBe("Showing live figures from 1 completed paid order(s).");
    });
});

describe("admin/index.js auth loading and initialization", () => {
    beforeEach(() => {
        jest.useRealTimers();
        document.body.innerHTML = "";
        delete window.authService;
        delete window.auth;
        delete window.authFns;
        delete window.db;
        delete window.firestoreFns;
        resetWindowPath();
    });

    test("waitForAuthReady resolves current user when onAuthStateChanged is unavailable", async () => {
        await expect(waitForAuthReady({
            currentUser: {
                uid: "user-1"
            }
        }, {})).resolves.toEqual({
            uid: "user-1"
        });

        await expect(waitForAuthReady(null, null)).resolves.toBeNull();
    });

    test("waitForAuthReady resolves user from onAuthStateChanged", async () => {
        const auth = { currentUser: null };
        const authFns = {
            onAuthStateChanged: jest.fn((receivedAuth, callback) => {
                callback({
                    uid: "user-auth"
                });

                return jest.fn();
            })
        };

        await expect(waitForAuthReady(auth, authFns)).resolves.toEqual({
            uid: "user-auth"
        });

        expect(authFns.onAuthStateChanged).toHaveBeenCalledWith(auth, expect.any(Function));
    });

    test("loadCurrentUser prefers authService and falls back to Firebase auth", async () => {
        await expect(loadCurrentUser({
            authService: {
                getCurrentUser: jest.fn(async () => ({
                    uid: "service-user"
                }))
            }
        })).resolves.toEqual({
            uid: "service-user"
        });

        await expect(loadCurrentUser({
            authService: {
                getCurrentUser: jest.fn(async () => null)
            },
            auth: {
                currentUser: {
                    uid: "firebase-user"
                }
            },
            authFns: {}
        })).resolves.toEqual({
            uid: "firebase-user"
        });
    });

    test("loadCurrentUserProfile loads profile through authService and falls back to user", async () => {
        const authService = {
            getCurrentUserProfile: jest.fn(async () => ({
                displayName: "Profile Name",
                email: "profile@example.com",
                isAdmin: true
            }))
        };

        await expect(loadCurrentUserProfile({
            uid: "user-1",
            displayName: "Auth Name",
            email: "auth@example.com",
            photoURL: "photo.jpg"
        }, {
            authService
        })).resolves.toEqual({
            uid: "user-1",
            displayName: "Profile Name",
            email: "profile@example.com",
            photoURL: "photo.jpg",
            isAdmin: true
        });

        await expect(loadCurrentUserProfile({
            uid: "user-2",
            displayName: "Fallback User"
        }, {
            authService: {
                getCurrentUserProfile: jest.fn(async () => null)
            }
        })).resolves.toEqual({
            uid: "user-2",
            displayName: "Fallback User"
        });

        await expect(loadCurrentUserProfile({
            uid: "user-3",
            displayName: "Error User"
        }, {
            authService: {
                getCurrentUserProfile: jest.fn(async () => {
                    throw new Error("profile failed");
                })
            }
        })).resolves.toEqual({
            uid: "user-3",
            displayName: "Error User"
        });
    });

    test("initializeAdminHomePage redirects signed-out users", async () => {
        createAdminHomeDom();

        const result = await initializeAdminHomePage({
            authService: {
                getCurrentUser: jest.fn(async () => null)
            },
            authUtils: null
        });

        expect(result).toEqual({
            success: false,
            reason: "signed-out"
        });

        expect(document.getElementById("admin-home-status").textContent)
            .toBe("Please sign in to view the admin dashboard.");
        expect(document.getElementById("admin-finance-note").textContent)
            .toBe("Finance figures could not be loaded. Open Finance to refresh or check permissions.");
    });

    test("initializeAdminHomePage rejects non-admin users", async () => {
        createAdminHomeDom();

        const result = await initializeAdminHomePage({
            authService: {
                getCurrentUser: jest.fn(async () => ({
                    uid: "customer-1",
                    email: "customer@example.com"
                })),
                getCurrentUserProfile: jest.fn(async () => ({
                    uid: "customer-1",
                    email: "customer@example.com",
                    isAdmin: false,
                    vendorStatus: "none",
                    accountStatus: "active"
                }))
            }
        });

        expect(result.success).toBe(false);
        expect(result.reason).toBe("access-denied");
        expect(document.getElementById("admin-home-status").textContent)
            .toBe("This dashboard is only available to admins.");
    });

    test("initializeAdminHomePage renders admin state and live finance summary", async () => {
        const elements = createAdminHomeDom();

        const result = await initializeAdminHomePage({
            authService: {
                getCurrentUser: jest.fn(async () => ({
                    uid: "admin-1",
                    displayName: "Admin Auth",
                    email: "admin-auth@example.com",
                    photoURL: ""
                })),
                getCurrentUserProfile: jest.fn(async () => ({
                    uid: "admin-1",
                    displayName: "Admin User",
                    email: "admin@example.com",
                    isAdmin: true,
                    vendorStatus: "approved",
                    accountStatus: "active"
                })),
                signOut: jest.fn(async () => true)
            },
            platformPricing,
            orders: [
                {
                    status: "completed",
                    paymentStatus: "paid",
                    paymentAmount: 165,
                    vendorEarnings: 150,
                    platformEarnings: 15
                }
            ]
        });

        expect(result.success).toBe(true);
        expect(result.profile.uid).toBe("admin-1");
        expect(result.state.displayName).toBe("Admin User");
        expect(result.financeSummary.platformBalance).toBe(15);

        expect(elements.statusElement.textContent).toBe("Admin dashboard loaded.");
        expect(elements.nameLine.textContent).toBe("Admin User");
        expect(elements.roleLine.textContent).toBe("Admin and Vendor");
        expect(elements.emailLine.textContent).toBe("admin@example.com");
        expect(elements.vendorLine.textContent).toBe("Approved");
        expect(elements.adminLine.textContent).toBe("Approved");
        expect(elements.portalSummaryElement.textContent)
            .toBe("You can switch between the customer, vendor, and admin portals.");
        expect(elements.platformBalanceElement.textContent).toBe("R 15.00");
        expect(elements.customerRevenueElement.textContent).toBe("R 165.00");
        expect(elements.vendorEarningsElement.textContent).toBe("R 150.00");
        expect(elements.completedOrdersElement.textContent).toBe("1");
        expect(elements.financeNoteElement.textContent)
            .toBe("Showing live figures from 1 completed paid order(s).");
        expect(elements.customerPortalButton.hidden).toBe(false);
        expect(elements.vendorPortalButton.hidden).toBe(false);
    });

    test("initializeAdminHomePage wires navigation buttons without crashing in jsdom", async () => {
        const elements = createAdminHomeDom();

        await initializeAdminHomePage({
            authService: {
                getCurrentUser: jest.fn(async () => ({
                    uid: "admin-2",
                    email: "admin@example.com"
                })),
                getCurrentUserProfile: jest.fn(async () => ({
                    uid: "admin-2",
                    displayName: "Admin User",
                    email: "admin@example.com",
                    isAdmin: true,
                    vendorStatus: "approved",
                    accountStatus: "active"
                })),
                signOut: jest.fn(async () => true)
            },
            platformPricing,
            orders: []
        });

        expect(() => elements.profileButton.click()).not.toThrow();
        expect(() => elements.manageUsersButton.click()).not.toThrow();
        expect(() => elements.reviewDisputesButton.click()).not.toThrow();
        expect(() => elements.ticketDetailButton.click()).not.toThrow();
        expect(() => elements.financeButton.click()).not.toThrow();
        expect(() => elements.choosePortalButton.click()).not.toThrow();
        expect(() => elements.analyticsButton.click()).not.toThrow();
        expect(() => elements.customerPortalButton.click()).not.toThrow();
        expect(() => elements.vendorPortalButton.click()).not.toThrow();
    });

    test("initializeAdminHomePage signs out with signOut or logout fallback", async () => {
        const elements = createAdminHomeDom();
        const signOut = jest.fn(async () => true);

        await initializeAdminHomePage({
            authService: {
                getCurrentUser: jest.fn(async () => ({
                    uid: "admin-3"
                })),
                getCurrentUserProfile: jest.fn(async () => ({
                    uid: "admin-3",
                    displayName: "Admin User",
                    email: "admin@example.com",
                    isAdmin: true,
                    vendorStatus: "none",
                    accountStatus: "active"
                })),
                signOut
            },
            orders: []
        });

        elements.signOutButton.click();

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(signOut).toHaveBeenCalledTimes(1);

        createAdminHomeDom();

        const logout = jest.fn(async () => true);

        await initializeAdminHomePage({
            authService: {
                getCurrentUser: jest.fn(async () => ({
                    uid: "admin-4"
                })),
                getCurrentUserProfile: jest.fn(async () => ({
                    uid: "admin-4",
                    displayName: "Admin User",
                    email: "admin@example.com",
                    isAdmin: true,
                    vendorStatus: "none",
                    accountStatus: "active"
                })),
                logout
            },
            orders: []
        });

        document.getElementById("sign-out-button").click();

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(logout).toHaveBeenCalledTimes(1);
    });

    test("initializeAdminHomePage can use window.authService when options are empty", async () => {
        createAdminHomeDom();

        window.authService = {
            getCurrentUser: jest.fn(async () => ({
                uid: "window-admin"
            })),
            getCurrentUserProfile: jest.fn(async () => ({
                uid: "window-admin",
                displayName: "Window Admin",
                email: "window@example.com",
                isAdmin: true,
                vendorStatus: "none",
                accountStatus: "active"
            })),
            signOut: jest.fn(async () => true)
        };

        const result = await initializeAdminHomePage({
            orders: []
        });

        expect(result.success).toBe(true);
        expect(window.authService.getCurrentUser).toHaveBeenCalledTimes(1);
        expect(document.getElementById("profile-name-line").textContent).toBe("Window Admin");
    });
});