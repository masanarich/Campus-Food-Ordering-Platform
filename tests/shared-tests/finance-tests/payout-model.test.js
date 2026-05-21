const payoutModel = require("../../../public/shared/finance/payout-model.js");

describe("shared/finance/payout-model.js", () => {
    test("exports constants and normalization helpers", () => {
        expect(payoutModel.MODULE_NAME).toBe("payout-model");
        expect(payoutModel.DEFAULT_CURRENCY).toBe("ZAR");
        expect(payoutModel.DEFAULT_STATUS).toBe("pending");
        expect(payoutModel.PAYOUT_STATUSES.PAID).toBe("paid");

        expect(payoutModel.normalizeText("  hi  ")).toBe("hi");
        expect(payoutModel.normalizeText(null)).toBe("");
        expect(payoutModel.normalizeLowerText(" PAID ")).toBe("paid");
        expect(payoutModel.normalizeUpperText(" zar ")).toBe("ZAR");
        expect(payoutModel.normalizeCurrencyAmount("12.349")).toBe(12.35);
        expect(payoutModel.normalizeCurrencyAmount("-1")).toBe(0);
        expect(payoutModel.normalizeCurrencyAmount("bad", 8.239)).toBe(8.24);
        expect(payoutModel.amountToMinorUnits(123.45)).toBe(12345);
    });

    test("normalizes payout statuses and labels", () => {
        expect(payoutModel.normalizePayoutStatus(" APPROVED ")).toBe("approved");
        expect(payoutModel.normalizePayoutStatus("unknown", "paid")).toBe("paid");
        expect(payoutModel.normalizePayoutStatus("unknown")).toBe("pending");

        expect(payoutModel.isActivePayoutStatus("pending")).toBe(true);
        expect(payoutModel.isActivePayoutStatus("approved")).toBe(true);
        expect(payoutModel.isActivePayoutStatus("paid")).toBe(false);

        expect(payoutModel.payoutReservesBalance("pending")).toBe(true);
        expect(payoutModel.payoutReservesBalance("paid")).toBe(true);
        expect(payoutModel.payoutReservesBalance("rejected")).toBe(false);
        expect(payoutModel.getPayoutStatusLabel("cancelled")).toBe("Cancelled");
    });

    test("creates a safe fake bank snapshot without storing full account number", () => {
        const bank = payoutModel.createFakeBankSnapshot({
            fakeBankName: " Test Bank ",
            fakeAccountHolder: " Vendor One ",
            fakeAccountNumber: "1234 5678 9012",
            fakeBranchCode: " 250-655 ",
            fakeAccountType: " Savings "
        });

        expect(bank).toEqual({
            fakeBankName: "Test Bank",
            fakeAccountHolder: "Vendor One",
            fakeAccountNumberLast4: "9012",
            fakeAccountNumberMasked: "****9012",
            fakeBranchCode: "250655",
            fakeAccountType: "savings"
        });
        expect(JSON.stringify(bank)).not.toContain("123456789012");
    });

    test("creates payout records with defaults, timeline, and masked fake bank fields", () => {
        const payout = payoutModel.createPayoutRequestRecord(
            {
                vendorUid: " vendor-1 ",
                vendorName: " Kota Spot ",
                vendorEmail: " SHOP@Example.com ",
                amount: "125.499",
                fakeBankName: "Demo Bank",
                fakeAccountHolder: "Kota Spot Pty",
                fakeAccountNumber: "0001234567",
                fakeBranchCode: "470010",
                notes: " Please pay out. "
            },
            {
                payoutId: "payout-1",
                createdAt: "2026-05-21T10:00:00Z"
            }
        );

        expect(payout).toMatchObject({
            payoutId: "payout-1",
            vendorUid: "vendor-1",
            vendorName: "Kota Spot",
            vendorEmail: "shop@example.com",
            amount: 125.5,
            amountInMinorUnits: 12550,
            currency: "ZAR",
            status: "pending",
            statusLabel: "Pending",
            fakeBankName: "Demo Bank",
            fakeAccountHolder: "Kota Spot Pty",
            fakeAccountNumberLast4: "4567",
            fakeAccountNumberMasked: "****4567",
            fakeBranchCode: "470010",
            notes: "Please pay out.",
            testMode: true,
            testEmailQueued: false,
            requestedAt: "2026-05-21T10:00:00Z",
            createdAt: "2026-05-21T10:00:00Z",
            updatedAt: "2026-05-21T10:00:00Z"
        });
        expect(payout.timeline).toHaveLength(1);
        expect(payout.timeline[0]).toMatchObject({
            status: "pending",
            actorRole: "vendor",
            actorUid: "vendor-1",
            actorName: "Kota Spot"
        });
    });

    test("validates payout request input against required fields and available balance", () => {
        const valid = payoutModel.validatePayoutRequestInput(
            {
                vendorUid: "v-1",
                amount: 100,
                fakeBankName: "Demo Bank",
                fakeAccountHolder: "Vendor",
                fakeAccountNumber: "123456",
                fakeBranchCode: "250655"
            },
            { availableBalance: 150 }
        );

        expect(valid.isValid).toBe(true);
        expect(valid.errors).toEqual({});
        expect(valid.value.amount).toBe(100);

        const invalid = payoutModel.validatePayoutRequestInput(
            {
                amount: 200,
                fakeAccountNumber: "123"
            },
            { availableBalance: 150 }
        );

        expect(invalid.isValid).toBe(false);
        expect(invalid.errors).toEqual({
            vendorUid: "Vendor UID is required.",
            amount: "Withdrawal amount cannot exceed the available balance.",
            fakeBankName: "Fake bank name is required.",
            fakeAccountHolder: "Fake account holder is required.",
            fakeAccountNumber: "Fake account number must have at least 6 digits.",
            fakeBranchCode: "Fake branch code is required."
        });
    });

    test("validates zero amount before available balance checks", () => {
        const result = payoutModel.validatePayoutRequestInput(
            {
                vendorUid: "v-1",
                amount: 0,
                fakeBankName: "Demo Bank",
                fakeAccountHolder: "Vendor",
                fakeAccountNumber: "123456",
                fakeBranchCode: "250655"
            },
            { availableBalance: 0 }
        );

        expect(result.isValid).toBe(false);
        expect(result.errors.amount).toBe("Withdrawal amount must be greater than zero.");
    });

    test("checks payout status transitions for vendors and admins", () => {
        expect(
            payoutModel.canTransitionPayoutStatus("pending", "cancelled", "vendor")
        ).toMatchObject({
            isValid: true,
            currentStatus: "pending",
            nextStatus: "cancelled",
            actorRole: "vendor"
        });

        expect(
            payoutModel.canTransitionPayoutStatus("approved", "paid", "vendor")
        ).toMatchObject({
            isValid: false,
            message: "Vendors can only cancel pending payout requests."
        });

        expect(
            payoutModel.canTransitionPayoutStatus("pending", "approved", "admin")
        ).toMatchObject({
            isValid: true,
            currentStatus: "pending",
            nextStatus: "approved",
            actorRole: "admin"
        });

        expect(
            payoutModel.canTransitionPayoutStatus("paid", "rejected", "admin")
        ).toMatchObject({
            isValid: false,
            message: "Paid payouts cannot move to Rejected."
        });
    });

    test("applies payout status updates with timeline and admin processing fields", () => {
        const payout = payoutModel.createPayoutRequestRecord(
            {
                payoutId: "p-1",
                vendorUid: "v-1",
                vendorName: "Vendor",
                amount: 100,
                fakeBankName: "Demo Bank",
                fakeAccountHolder: "Vendor",
                fakeAccountNumber: "1234567890",
                fakeBranchCode: "250655"
            },
            { createdAt: "2026-05-21T10:00:00Z" }
        );

        const approved = payoutModel.applyPayoutStatus(payout, "approved", {
            actorRole: "admin",
            actorUid: "admin-1",
            actorName: "Admin User",
            timestamp: "2026-05-21T11:00:00Z",
            note: "Looks fine."
        });

        expect(approved.success).toBe(true);
        expect(approved.payout).toMatchObject({
            status: "approved",
            statusLabel: "Approved",
            approvedAt: "2026-05-21T11:00:00Z",
            processedByUid: "admin-1",
            processedByName: "Admin User",
            updatedAt: "2026-05-21T11:00:00Z"
        });
        expect(approved.patch.timeline).toHaveLength(2);
        expect(approved.timelineEntry).toMatchObject({
            status: "approved",
            actorRole: "admin",
            actorUid: "admin-1"
        });

        const paid = payoutModel.applyPayoutStatus(approved.payout, "paid", {
            actorRole: "admin",
            actorUid: "admin-1",
            actorName: "Admin User",
            timestamp: "2026-05-21T12:00:00Z"
        });

        expect(paid.success).toBe(true);
        expect(paid.payout).toMatchObject({
            status: "paid",
            paidAt: "2026-05-21T12:00:00Z",
            processedAt: "2026-05-21T12:00:00Z"
        });
    });

    test("rejects invalid status updates without changing payout", () => {
        const payout = payoutModel.createPayoutRequestRecord({
            payoutId: "p-1",
            vendorUid: "v-1",
            amount: 100,
            status: "paid"
        });

        const result = payoutModel.applyPayoutStatus(payout, "rejected", {
            actorRole: "admin"
        });

        expect(result.success).toBe(false);
        expect(result.error).toEqual({
            code: "payout/invalid-status-transition",
            message: "Paid payouts cannot move to Rejected."
        });
        expect(result.payout.status).toBe("paid");
    });

    test("applies rejection and cancellation metadata", () => {
        const payout = payoutModel.createPayoutRequestRecord({
            payoutId: "p-2",
            vendorUid: "v-1",
            amount: 100
        });

        const rejected = payoutModel.applyPayoutStatus(payout, "rejected", {
            actorRole: "admin",
            actorUid: "admin-1",
            actorName: "Admin User",
            rejectionReason: "Fake bank details are incomplete.",
            timestamp: "2026-05-21T13:00:00Z"
        });

        expect(rejected.success).toBe(true);
        expect(rejected.payout).toMatchObject({
            status: "rejected",
            rejectedAt: "2026-05-21T13:00:00Z",
            processedAt: "2026-05-21T13:00:00Z",
            rejectionReason: "Fake bank details are incomplete."
        });

        const cancellable = payoutModel.createPayoutRequestRecord({
            payoutId: "p-3",
            vendorUid: "v-1",
            amount: 100
        });
        const cancelled = payoutModel.applyPayoutStatus(cancellable, "cancelled", {
            actorRole: "vendor",
            actorUid: "v-1",
            timestamp: "2026-05-21T14:00:00Z"
        });

        expect(cancelled.success).toBe(true);
        expect(cancelled.payout).toMatchObject({
            status: "cancelled",
            cancelledAt: "2026-05-21T14:00:00Z"
        });
    });

    test("creates a test email notification payload for payout submission", () => {
        const payout = payoutModel.createPayoutRequestRecord(
            {
                payoutId: "payout-7",
                vendorUid: "v-7",
                vendorEmail: "vendor@example.com",
                amount: 88
            },
            { createdAt: "2026-05-21T10:00:00Z" }
        );

        const notification = payoutModel.createPayoutEmailNotification(payout, {
            queuedAt: "2026-05-21T10:01:00Z"
        });

        expect(notification).toEqual({
            notificationId: "payout-7-email",
            recipientUid: "v-7",
            recipientRole: "vendor",
            channel: "test_email",
            type: "payout_request_submitted",
            title: "Withdrawal request submitted",
            message: "Your simulated withdrawal request for ZAR 88.00 was submitted.",
            payoutId: "payout-7",
            vendorUid: "v-7",
            vendorEmail: "vendor@example.com",
            read: false,
            isRead: false,
            testMode: true,
            queuedAt: "2026-05-21T10:01:00Z"
        });
    });
});
