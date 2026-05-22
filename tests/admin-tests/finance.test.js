/**
 * @jest-environment jsdom
 */

const adminFinancePage = require("../../public/admin/finance.js");
const platformPricing = require("../../public/shared/finance/platform-pricing.js");
const payoutModel = require("../../public/shared/finance/payout-model.js");
const payoutService = require("../../public/shared/finance/payout-service.js");

function createFinanceDom() {
    document.body.innerHTML = `
        <main>
            <p id="admin-finance-status"></p>
            <button id="refresh-finance-button" type="button">Refresh</button>

            <output id="platform-balance"></output>
            <output id="customer-revenue"></output>
            <output id="vendor-earnings"></output>
            <output id="completed-orders"></output>
            <output id="pending-payout-count"></output>
            <output id="approved-payout-count"></output>
            <output id="paid-payout-total"></output>
            <output id="reserved-payout-total"></output>
            <output id="finance-next-action"></output>
            <small id="finance-next-action-detail"></small>

            <p id="payout-admin-summary"></p>
            <select id="payout-status-filter">
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
            </select>
            <section id="payout-admin-list"></section>
        </main>
    `;

    return adminFinancePage.getPageElements(document);
}

function createOrder(overrides = {}) {
    return {
        orderId: "order-1",
        vendorUid: "vendor-1",
        vendorName: "Campus Bites",
        status: "completed",
        paymentStatus: "paid",
        vendorEarnings: 100,
        platformEarnings: 10,
        paymentAmount: 110,
        total: 110,
        createdAt: "2026-05-20T10:00:00.000Z",
        ...overrides
    };
}

function createPayout(overrides = {}) {
    return payoutModel.createPayoutRequestRecord({
        payoutId: "payout-1",
        vendorUid: "vendor-1",
        vendorName: "Campus Bites",
        vendorEmail: "vendor@example.com",
        amount: 40,
        fakeBankName: "Campus Test Bank",
        fakeAccountHolder: "Campus Bites",
        fakeAccountNumber: "1234567890",
        fakeBranchCode: "250655",
        status: "pending",
        createdAt: "2026-05-20T10:00:00.000Z",
        requestedAt: "2026-05-20T10:00:00.000Z",
        updatedAt: "2026-05-20T10:00:00.000Z",
        ...overrides
    });
}

function createSnapshot(records, idKey) {
    return {
        docs: records.map(function mapRecord(record, index) {
            return {
                id: record[idKey] || `doc-${index + 1}`,
                data() {
                    return record;
                }
            };
        })
    };
}

describe("admin/finance.js helpers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.platformPricing;
        delete window.payoutModel;
        delete window.payoutQueries;
        delete window.payoutService;
        delete window.auth;
        delete window.db;
        delete window.authFns;
        delete window.firestoreFns;
    });

    test("normalizes values and checks admin access", () => {
        expect(adminFinancePage.normalizeText("  Finance  ")).toBe("Finance");
        expect(adminFinancePage.normalizeLowerText(" PAID ")).toBe("paid");
        expect(adminFinancePage.normalizeCurrencyAmount("10.235")).toBe(10.24);
        expect(adminFinancePage.formatCurrency(110)).toContain("110");

        expect(adminFinancePage.normalizeAdminProfile({
            uid: " admin-1 ",
            fullName: " Admin One ",
            email: " ADMIN@example.com ",
            admin: true,
            accountStatus: "active"
        })).toEqual({
            uid: "admin-1",
            displayName: "Admin One",
            email: "admin@example.com",
            isAdmin: true,
            accountStatus: "active"
        });

        expect(adminFinancePage.canAccessAdminFinance({ isAdmin: true, accountStatus: "active" })).toBe(true);
        expect(adminFinancePage.canAccessAdminFinance({ isAdmin: false, accountStatus: "active" })).toBe(false);
        expect(adminFinancePage.canAccessAdminFinance({ isAdmin: true, accountStatus: "disabled" })).toBe(false);
    });

    test("calculates platform earnings and payout summary", () => {
        const orders = [
            createOrder({ orderId: "order-1", vendorEarnings: 100, platformEarnings: 10, paymentAmount: 110 }),
            createOrder({ orderId: "order-2", vendorEarnings: 50, platformEarnings: 5, paymentAmount: 55 }),
            createOrder({ orderId: "unpaid", paymentStatus: "pending", vendorEarnings: 200, platformEarnings: 20, paymentAmount: 220 })
        ];
        const payouts = [
            createPayout({ payoutId: "pending", amount: 30, status: "pending" }),
            createPayout({ payoutId: "approved", amount: 20, status: "approved" }),
            createPayout({ payoutId: "paid", amount: 10, status: "paid" }),
            createPayout({ payoutId: "rejected", amount: 99, status: "rejected" })
        ];

        const summary = adminFinancePage.calculateFinanceSummary(orders, payouts, {
            platformPricing,
            payoutModel
        });

        expect(summary).toEqual({
            completedOrders: 2,
            customerRevenue: 165,
            platformEarnings: 15,
            platformBalance: 15,
            vendorEarnings: 150,
            payoutCount: 4,
            pendingPayoutCount: 1,
            approvedPayoutCount: 1,
            paidPayoutCount: 1,
            rejectedPayoutCount: 1,
            cancelledPayoutCount: 0,
            totalRequested: 159,
            paidPayoutTotal: 10,
            reservedPayoutTotal: 60
        });
    });

    test("renders finance summary and payout action cards", () => {
        const elements = createFinanceDom();
        const payouts = [
            createPayout({
                payoutId: "old-paid",
                amount: 10,
                status: "paid",
                requestedAt: "2026-05-19T10:00:00.000Z",
                updatedAt: "2026-05-19T10:00:00.000Z"
            }),
            createPayout({
                payoutId: "new-pending",
                amount: 30,
                status: "pending",
                requestedAt: "2026-05-20T10:00:00.000Z",
                updatedAt: "2026-05-20T10:00:00.000Z"
            })
        ];
        const summary = adminFinancePage.calculateFinanceSummary([
            createOrder({ vendorEarnings: 100, platformEarnings: 10, paymentAmount: 110 })
        ], payouts, { platformPricing, payoutModel });

        adminFinancePage.renderFinancePage(summary, payouts, elements, { payoutModel });

        expect(elements.platformBalanceElement.textContent).toContain("10");
        expect(elements.customerRevenueElement.textContent).toContain("110");
        expect(elements.vendorEarningsElement.textContent).toContain("100");
        expect(elements.completedOrdersElement.textContent).toBe("1");
        expect(elements.pendingPayoutCountElement.textContent).toBe("1");
        expect(elements.paidPayoutTotalElement.textContent).toContain("10");
        expect(elements.nextActionElement.textContent).toBe("Next: review payout");
        expect(elements.nextActionDetailElement.textContent).toContain("new-pending");
        expect(elements.payoutSummaryElement.textContent).toBe("2 payout requests.");
        expect(elements.payoutListElement.querySelectorAll(".admin-payout-card")).toHaveLength(2);
        expect(elements.payoutListElement.querySelector(".admin-payout-title").textContent).toBe("Campus Bites");
        expect(elements.payoutListElement.querySelector("[data-payout-action='approved']")).toBeTruthy();
        expect(elements.payoutListElement.textContent).toContain("****7890");
    });

    test("chooses the next finance action from payout queue or platform balance", () => {
        const approvedAction = adminFinancePage.getNextFinanceAction(
            { platformBalance: 15 },
            [
                createPayout({ payoutId: "pending-new", status: "pending", requestedAt: "2026-05-20T10:00:00.000Z" }),
                createPayout({ payoutId: "approved-old", status: "approved", amount: 45, requestedAt: "2026-05-19T10:00:00.000Z" })
            ]
        );

        expect(approvedAction.label).toBe("Next: mark payout paid");
        expect(approvedAction.detail).toContain("approved-old");
        expect(approvedAction.detail).toContain("Campus Bites");
        expect(approvedAction.detail).toContain("45");

        const monitorAction = adminFinancePage.getNextFinanceAction(
            { platformBalance: 20 },
            []
        );

        expect(monitorAction.label).toBe("Next: monitor earnings");
        expect(monitorAction.detail).toContain("20");
        expect(monitorAction.detail).toContain("simulated platform earnings");

        expect(adminFinancePage.getNextFinanceAction(
            { platformBalance: 0 },
            []
        )).toEqual({
            label: "Next: wait for sales",
            detail: "Completed paid orders will add platform earnings and vendor payout activity."
        });
    });

    test("filters payout cards by status", () => {
        const elements = createFinanceDom();
        const payouts = [
            createPayout({ payoutId: "pending", status: "pending" }),
            createPayout({ payoutId: "approved", status: "approved" })
        ];

        elements.statusFilter.value = "approved";
        adminFinancePage.renderPayoutList(payouts, elements, { payoutModel });

        expect(elements.payoutSummaryElement.textContent).toBe("1 payout request matching approved.");
        expect(elements.payoutListElement.textContent).toContain("approved");
        expect(elements.payoutListElement.querySelectorAll(".admin-payout-card")).toHaveLength(1);
    });

    test("fetches finance orders with Firestore helpers", async () => {
        const firestoreFns = {
            collection: jest.fn((db, name) => ({ db, name })),
            orderBy: jest.fn((field, direction) => ({ field, direction })),
            query: jest.fn((collectionRef, ...constraints) => ({ collectionRef, constraints })),
            getDocs: jest.fn(async () => createSnapshot([
                createOrder({ orderId: "order-1" })
            ], "orderId"))
        };

        const orders = await adminFinancePage.fetchFinanceOrders({
            db: { name: "db" },
            firestoreFns
        });

        expect(firestoreFns.collection).toHaveBeenCalledWith({ name: "db" }, "orders");
        expect(firestoreFns.orderBy).toHaveBeenCalledWith("createdAt", "desc");
        expect(orders).toEqual([
            expect.objectContaining({
                orderId: "order-1",
                vendorUid: "vendor-1"
            })
        ]);
    });

    test("loads finance data through readers and renders ready state", async () => {
        const elements = createFinanceDom();
        const orderReader = jest.fn(async () => [
            createOrder({ orderId: "order-1", vendorEarnings: 100, platformEarnings: 10, paymentAmount: 110 })
        ]);
        const payoutReader = jest.fn(async () => [
            createPayout({ payoutId: "payout-1", amount: 40, status: "pending" })
        ]);
        const page = adminFinancePage.createAdminFinancePage({
            elements,
            platformPricing,
            payoutModel,
            auth: {
                currentUser: {
                    uid: "admin-1",
                    displayName: "Admin One",
                    email: "admin@example.com",
                    isAdmin: true,
                    accountStatus: "active"
                }
            },
            orderReader,
            payoutReader
        });

        const result = await page.loadFinanceData();

        expect(result.success).toBe(true);
        expect(orderReader).toHaveBeenCalled();
        expect(payoutReader).toHaveBeenCalled();
        expect(page.state.summary.platformBalance).toBe(10);
        expect(elements.statusElement.textContent).toBe(adminFinancePage.STATUS_MESSAGES.ready);
        expect(elements.statusElement.getAttribute("data-state")).toBe("success");
    });

    test("updates payout status through the real payout service in test mode", async () => {
        const elements = createFinanceDom();
        const pendingPayout = createPayout({
            payoutId: "payout-pending",
            amount: 40,
            status: "pending"
        });
        const page = adminFinancePage.createAdminFinancePage({
            elements,
            platformPricing,
            payoutModel,
            payoutService,
            persist: false,
            now: "2026-05-21T10:00:00.000Z"
        });
        page.state.adminProfile = {
            uid: "admin-1",
            displayName: "Admin One",
            email: "admin@example.com",
            isAdmin: true,
            accountStatus: "active"
        };
        page.state.orders = [
            createOrder({ vendorEarnings: 100, platformEarnings: 10, paymentAmount: 110 })
        ];
        page.state.payouts = [pendingPayout];
        page.state.summary = adminFinancePage.calculateFinanceSummary(page.state.orders, page.state.payouts, {
            platformPricing,
            payoutModel
        });

        const result = await page.updatePayoutStatus("payout-pending", "approved");

        expect(result.success).toBe(true);
        expect(result.payout.status).toBe("approved");
        expect(page.state.payouts[0].status).toBe("approved");
        expect(page.state.summary.approvedPayoutCount).toBe(1);
        expect(elements.statusElement.textContent).toBe(adminFinancePage.STATUS_MESSAGES.updated);
    });

    test("clicking a rendered payout action updates the payout", async () => {
        const elements = createFinanceDom();
        const payoutServiceStub = {
            updatePayoutStatus: jest.fn(async ({ payout, nextStatus }) => ({
                success: true,
                payout: {
                    ...payout,
                    status: nextStatus,
                    statusLabel: payoutModel.getPayoutStatusLabel(nextStatus)
                }
            }))
        };
        const page = adminFinancePage.createAdminFinancePage({
            elements,
            platformPricing,
            payoutModel,
            payoutService: payoutServiceStub
        });
        page.state.adminProfile = {
            uid: "admin-1",
            displayName: "Admin One",
            isAdmin: true,
            accountStatus: "active"
        };
        page.state.orders = [];
        page.state.payouts = [
            createPayout({ payoutId: "payout-click", status: "pending" })
        ];
        page.state.summary = adminFinancePage.calculateFinanceSummary([], page.state.payouts, {
            payoutModel
        });
        page.renderFinancePage();

        const button = elements.payoutListElement.querySelector("[data-payout-action='approved']");
        const result = await page.handlePayoutAction({
            target: button,
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(true);
        expect(payoutServiceStub.updatePayoutStatus).toHaveBeenCalledWith(expect.objectContaining({
            payoutId: "payout-click",
            nextStatus: "approved",
            actorRole: "admin"
        }));
    });

    test("initializes by attaching handlers and loading finance data", async () => {
        const elements = createFinanceDom();
        const result = await adminFinancePage.initializeAdminFinancePage({
            elements,
            platformPricing,
            payoutModel,
            auth: {
                currentUser: {
                    uid: "admin-1",
                    displayName: "Admin One",
                    email: "admin@example.com",
                    isAdmin: true,
                    accountStatus: "active"
                }
            },
            orderReader: jest.fn(async () => [
                createOrder({ orderId: "order-1", vendorEarnings: 100, platformEarnings: 10, paymentAmount: 110 })
            ]),
            payoutReader: jest.fn(async () => [])
        });

        expect(result.success).toBe(true);
        expect(result.page.state.summary.platformBalance).toBe(10);
        expect(typeof result.page.updatePayoutStatus).toBe("function");
    });
});
