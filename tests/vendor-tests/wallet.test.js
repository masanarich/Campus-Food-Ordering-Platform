/**
 * @jest-environment jsdom
 */

const vendorWalletPage = require("../../public/vendor/wallet.js");
const platformPricing = require("../../public/shared/finance/platform-pricing.js");
const payoutModel = require("../../public/shared/finance/payout-model.js");
const payoutService = require("../../public/shared/finance/payout-service.js");

function createWalletDom() {
    document.body.innerHTML = `
        <main>
            <p id="wallet-status"></p>
            <button id="refresh-wallet-button" type="button">Refresh</button>

            <output id="wallet-available-balance"></output>
            <output id="wallet-total-earned"></output>
            <output id="wallet-reserved-withdrawals"></output>
            <output id="wallet-completed-orders"></output>

            <form id="withdrawal-form">
                <input id="withdrawal-amount" name="amount" type="number">
                <span id="withdrawal-amount-error" hidden></span>

                <input id="fake-bank-name" name="fakeBankName">
                <span id="withdrawal-fakeBankName-error" hidden></span>

                <input id="fake-account-holder" name="fakeAccountHolder">
                <span id="withdrawal-fakeAccountHolder-error" hidden></span>

                <input id="fake-account-number" name="fakeAccountNumber">
                <span id="withdrawal-fakeAccountNumber-error" hidden></span>

                <input id="fake-branch-code" name="fakeBranchCode">
                <span id="withdrawal-fakeBranchCode-error" hidden></span>

                <select id="fake-account-type" name="fakeAccountType">
                    <option value="cheque">Cheque</option>
                    <option value="savings">Savings</option>
                </select>

                <textarea id="withdrawal-notes" name="notes"></textarea>
                <button id="request-withdrawal-button" type="submit">Request Withdrawal</button>
                <button id="clear-withdrawal-form-button" type="reset">Clear</button>
            </form>

            <p id="payout-history-summary"></p>
            <section id="payout-history-list"></section>
        </main>
    `;

    return vendorWalletPage.getPageElements(document);
}

function createOrder(overrides = {}) {
    return {
        orderId: "order-1",
        vendorUid: "vendor-1",
        status: "completed",
        paymentStatus: "paid",
        vendorEarnings: 100,
        platformEarnings: 10,
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

function fillValidWithdrawalForm() {
    document.getElementById("withdrawal-amount").value = "60";
    document.getElementById("fake-bank-name").value = "Campus Test Bank";
    document.getElementById("fake-account-holder").value = "Campus Bites";
    document.getElementById("fake-account-number").value = "1234567890";
    document.getElementById("fake-branch-code").value = "250655";
    document.getElementById("fake-account-type").value = "cheque";
    document.getElementById("withdrawal-notes").value = "Please process in test mode.";
}

describe("vendor/wallet.js helpers", () => {
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

    test("normalizes values and calculates vendor wallet balance from completed paid orders", () => {
        expect(vendorWalletPage.normalizeText("  Campus Bites  ")).toBe("Campus Bites");
        expect(vendorWalletPage.normalizeLowerText(" PAID ")).toBe("paid");
        expect(vendorWalletPage.normalizeCurrencyAmount("12.345")).toBe(12.35);
        expect(vendorWalletPage.formatCurrency(110)).toContain("110");

        const orders = [
            createOrder({ orderId: "paid-completed", vendorEarnings: 100 }),
            createOrder({ orderId: "not-completed", status: "ready", vendorEarnings: 80 }),
            createOrder({ orderId: "not-paid", paymentStatus: "pending", vendorEarnings: 70 }),
            createOrder({ orderId: "other-vendor", vendorUid: "vendor-2", vendorEarnings: 300 })
        ];
        const payouts = [
            createPayout({ payoutId: "pending", amount: 30, status: "pending" }),
            createPayout({ payoutId: "rejected", amount: 20, status: "rejected" })
        ];

        const summary = vendorWalletPage.calculateWalletSummary(orders, payouts, {
            vendorUid: "vendor-1",
            platformPricing
        });

        expect(summary).toEqual({
            vendorUid: "vendor-1",
            completedOrders: 1,
            totalEarned: 100,
            reservedWithdrawals: 30,
            availableBalance: 70,
            paidWithdrawals: 0,
            pendingPayouts: 1,
            payoutCount: 2
        });
    });

    test("renders balance metrics and payout history", () => {
        const elements = createWalletDom();
        const summary = {
            availableBalance: 70,
            totalEarned: 100,
            reservedWithdrawals: 30,
            completedOrders: 1
        };
        const payouts = [
            createPayout({
                payoutId: "older-paid",
                amount: 20,
                status: "paid",
                requestedAt: "2026-05-19T10:00:00.000Z",
                updatedAt: "2026-05-19T10:00:00.000Z"
            }),
            createPayout({
                payoutId: "newer-pending",
                amount: 30,
                status: "pending",
                requestedAt: "2026-05-20T10:00:00.000Z",
                updatedAt: "2026-05-20T10:00:00.000Z"
            })
        ];

        vendorWalletPage.renderWallet(summary, payouts, elements, { payoutModel });

        expect(elements.availableBalanceElement.textContent).toContain("70");
        expect(elements.totalEarnedElement.textContent).toContain("100");
        expect(elements.reservedWithdrawalsElement.textContent).toContain("30");
        expect(elements.completedOrdersElement.textContent).toBe("1");
        expect(elements.payoutHistorySummaryElement.textContent).toBe("2 requests total, 1 active.");
        expect(elements.payoutHistoryListElement.querySelectorAll(".payout-card")).toHaveLength(2);
        expect(elements.payoutHistoryListElement.querySelector(".payout-card-title").textContent).toBe("newer-pending");
        expect(elements.payoutHistoryListElement.textContent).toContain("****7890");
    });

    test("validates withdrawal values against fake bank rules and available balance", () => {
        const result = vendorWalletPage.validateWithdrawal(
            {
                amount: "200",
                fakeBankName: "",
                fakeAccountHolder: "",
                fakeAccountNumber: "123",
                fakeBranchCode: ""
            },
            {
                payoutModel,
                availableBalance: 100,
                vendorUid: "vendor-1",
                vendorName: "Campus Bites",
                vendorEmail: "vendor@example.com"
            }
        );

        expect(result.isValid).toBe(false);
        expect(result.errors).toMatchObject({
            amount: "Withdrawal amount cannot exceed the available balance.",
            fakeBankName: "Fake bank name is required.",
            fakeAccountHolder: "Fake account holder is required.",
            fakeAccountNumber: "Fake account number must have at least 6 digits.",
            fakeBranchCode: "Fake branch code is required."
        });
    });

    test("loads wallet data through readers and renders the ready state", async () => {
        const elements = createWalletDom();
        const orderReader = jest.fn(async () => [
            createOrder({ orderId: "order-1", vendorEarnings: 100 }),
            createOrder({ orderId: "order-2", vendorEarnings: 50 })
        ]);
        const payoutReader = jest.fn(async () => [
            createPayout({ payoutId: "payout-1", amount: 40, status: "pending" })
        ]);
        const page = vendorWalletPage.createVendorWalletPage({
            elements,
            platformPricing,
            payoutModel,
            auth: {
                currentUser: {
                    uid: "vendor-1",
                    displayName: "Campus Bites",
                    email: "vendor@example.com",
                    vendorStatus: "approved"
                }
            },
            orderReader,
            payoutReader
        });

        const result = await page.loadWalletData();

        expect(result.success).toBe(true);
        expect(orderReader).toHaveBeenCalledWith("vendor-1", expect.any(Object));
        expect(payoutReader).toHaveBeenCalledWith("vendor-1", expect.any(Object));
        expect(page.state.summary.availableBalance).toBe(110);
        expect(elements.statusElement.textContent).toBe(vendorWalletPage.STATUS_MESSAGES.ready);
        expect(elements.statusElement.getAttribute("data-state")).toBe("success");
    });

    test("fetches vendor orders with Firestore helpers when no reader is supplied", async () => {
        const firestoreFns = {
            collection: jest.fn((db, name) => ({ db, name })),
            where: jest.fn((field, operator, value) => ({ field, operator, value })),
            query: jest.fn((collectionRef, ...constraints) => ({ collectionRef, constraints })),
            getDocs: jest.fn(async () => createSnapshot([
                createOrder({ orderId: "order-1", vendorEarnings: 100 })
            ], "orderId"))
        };

        const orders = await vendorWalletPage.fetchVendorOrders({
            db: { name: "db" },
            firestoreFns,
            vendorUid: "vendor-1"
        });

        expect(firestoreFns.collection).toHaveBeenCalledWith({ name: "db" }, "orders");
        expect(firestoreFns.where).toHaveBeenCalledWith("vendorUid", "==", "vendor-1");
        expect(orders).toEqual([
            expect.objectContaining({
                orderId: "order-1",
                vendorUid: "vendor-1"
            })
        ]);
    });

    test("submits a valid withdrawal, reserves the amount, and resets the form", async () => {
        const elements = createWalletDom();
        const createdPayout = createPayout({ payoutId: "payout-new", amount: 60, status: "pending" });
        const payoutService = {
            createPayoutRequest: jest.fn(async () => ({
                success: true,
                payout: createdPayout,
                emailNotification: {
                    notificationId: "payout-new-email"
                }
            }))
        };
        const page = vendorWalletPage.createVendorWalletPage({
            elements,
            platformPricing,
            payoutModel,
            payoutService
        });
        page.state.currentUser = { uid: "vendor-1" };
        page.state.vendorProfile = {
            uid: "vendor-1",
            displayName: "Campus Bites",
            email: "vendor@example.com",
            vendorStatus: "approved",
            accountStatus: "active"
        };
        page.state.orders = [
            createOrder({ orderId: "order-1", vendorEarnings: 100 })
        ];
        page.state.payouts = [];
        page.state.summary = vendorWalletPage.calculateWalletSummary(page.state.orders, [], {
            vendorUid: "vendor-1",
            platformPricing
        });
        fillValidWithdrawalForm();

        const result = await page.submitWithdrawalRequest({ preventDefault: jest.fn() });

        expect(result.success).toBe(true);
        expect(payoutService.createPayoutRequest).toHaveBeenCalledWith(expect.objectContaining({
            payoutModel,
            availableBalance: 100,
            payout: expect.objectContaining({
                amount: 60,
                vendorUid: "vendor-1",
                vendorName: "Campus Bites",
                vendorEmail: "vendor@example.com",
                fakeBankName: "Campus Test Bank"
            })
        }));
        expect(page.state.summary.availableBalance).toBe(40);
        expect(elements.statusElement.textContent).toBe(vendorWalletPage.STATUS_MESSAGES.saved);
        expect(elements.inputs.amount.value).toBe("");
    });

    test("submits through the real payout service prepare path with raw fake account details", async () => {
        const elements = createWalletDom();
        const page = vendorWalletPage.createVendorWalletPage({
            elements,
            platformPricing,
            payoutModel,
            payoutService,
            persist: false,
            timestampSeed: "wallet-test",
            now: "2026-05-21T10:00:00.000Z"
        });
        page.state.vendorProfile = {
            uid: "vendor-1",
            displayName: "Campus Bites",
            email: "vendor@example.com",
            vendorStatus: "approved",
            accountStatus: "active"
        };
        page.state.orders = [
            createOrder({ orderId: "order-1", vendorEarnings: 100 })
        ];
        page.state.summary = vendorWalletPage.calculateWalletSummary(page.state.orders, [], {
            vendorUid: "vendor-1",
            platformPricing
        });
        fillValidWithdrawalForm();

        const result = await page.submitWithdrawalRequest({ preventDefault: jest.fn() });

        expect(result.success).toBe(true);
        expect(result.payout).toEqual(expect.objectContaining({
            payoutId: "payout-wallettest",
            amount: 60,
            fakeAccountNumberMasked: "****7890",
            testEmailQueued: true
        }));
        expect(result.result.emailNotification).toEqual(expect.objectContaining({
            channel: "test_email",
            recipientUid: "vendor-1"
        }));
    });

    test("shows form errors and does not call payout service for invalid withdrawals", async () => {
        const elements = createWalletDom();
        const payoutService = {
            createPayoutRequest: jest.fn()
        };
        const page = vendorWalletPage.createVendorWalletPage({
            elements,
            payoutModel,
            payoutService
        });
        page.state.vendorProfile = {
            uid: "vendor-1",
            displayName: "Campus Bites",
            email: "vendor@example.com",
            vendorStatus: "approved",
            accountStatus: "active"
        };
        page.state.summary = {
            availableBalance: 20
        };
        document.getElementById("withdrawal-amount").value = "60";

        const result = await page.submitWithdrawalRequest({ preventDefault: jest.fn() });

        expect(result.success).toBe(false);
        expect(payoutService.createPayoutRequest).not.toHaveBeenCalled();
        expect(elements.errorElements.amount.hidden).toBe(false);
        expect(elements.errorElements.amount.textContent).toBe("Withdrawal amount cannot exceed the available balance.");
        expect(elements.statusElement.getAttribute("data-state")).toBe("error");
    });

    test("initializes by attaching handlers and loading wallet data", async () => {
        const elements = createWalletDom();
        const result = await vendorWalletPage.initializeVendorWalletPage({
            elements,
            platformPricing,
            payoutModel,
            auth: {
                currentUser: {
                    uid: "vendor-1",
                    displayName: "Campus Bites",
                    email: "vendor@example.com",
                    vendorStatus: "approved"
                }
            },
            orderReader: jest.fn(async () => [
                createOrder({ orderId: "order-1", vendorEarnings: 100 })
            ]),
            payoutReader: jest.fn(async () => [])
        });

        expect(result.success).toBe(true);
        expect(result.page.state.summary.availableBalance).toBe(100);
        expect(typeof result.page.submitWithdrawalRequest).toBe("function");
    });
});
