const refundCaseModel = require("../../../public/shared/support/refund-case-model.js");

function createPaidOrder(overrides = {}) {
    return {
        orderId: "order-1",
        checkoutId: "checkout-1",
        customerUid: "customer-1",
        vendorUid: "vendor-1",
        paymentReference: "paystack-ref-1",
        paymentAmount: 110,
        paymentAmountInMinorUnits: 11000,
        paymentCurrency: "ZAR",
        vendorEarnings: 100,
        platformEarnings: 10,
        ...overrides
    };
}

describe("shared/support/refund-case-model.js", () => {
    test("exports the expected constants and module surface", () => {
        expect(refundCaseModel.MODULE_NAME).toBe("refund-case-model");
        expect(refundCaseModel.DEFAULT_CURRENCY).toBe("ZAR");
        expect(refundCaseModel.DEFAULT_REFUND_CASE_STATUS).toBe("not_requested");
        expect(refundCaseModel.DEFAULT_REFUND_TYPE).toBe("partial");
        expect(refundCaseModel.DEFAULT_DECISION).toBe("pending");
        expect(refundCaseModel.REFUND_CASE_STATUS_LIST).toEqual([
            "not_requested",
            "proposed",
            "customer_approved",
            "vendor_approved",
            "approved",
            "processing",
            "refunded",
            "declined",
            "failed",
            "cancelled"
        ]);
        expect(refundCaseModel.REFUND_TYPE_LIST).toEqual(["partial", "full"]);
        expect(refundCaseModel.DECISION_LIST).toEqual(["pending", "approved", "declined"]);

        [
            "normalizeRefundCaseStatus",
            "normalizeRefundType",
            "normalizeDecision",
            "deriveRefundCaseStatus",
            "createRefundCaseRecord",
            "createRefundCaseFromProposal",
            "applyRefundDecision",
            "applyRefundExecution",
            "createRefundCasePatch",
            "calculateRefundFinancialImpact"
        ].forEach((name) => expect(typeof refundCaseModel[name]).toBe("function"));
    });

    test("normalizes primitive values and money safely", () => {
        expect(refundCaseModel.normalizeText("  Hello  ")).toBe("Hello");
        expect(refundCaseModel.normalizeText(null)).toBe("");
        expect(refundCaseModel.normalizeLowerText(" REFUND ")).toBe("refund");
        expect(refundCaseModel.normalizeUpperText(" zar ")).toBe("ZAR");
        expect(refundCaseModel.normalizeStatusKey("customer-approved")).toBe("customerapproved");

        expect(refundCaseModel.normalizeBoolean(true)).toBe(true);
        expect(refundCaseModel.normalizeBoolean("yes")).toBe(true);
        expect(refundCaseModel.normalizeBoolean("0")).toBe(false);
        expect(refundCaseModel.normalizeBoolean("maybe")).toBe(false);

        expect(refundCaseModel.normalizeTimestampValue("now", "later")).toBe("now");
        expect(refundCaseModel.normalizeTimestampValue(null, "later")).toBe("later");
        expect(refundCaseModel.normalizeTimestampValue()).toBeNull();

        expect(refundCaseModel.normalizeCurrencyAmount("10.235")).toBe(10.24);
        expect(refundCaseModel.normalizeCurrencyAmount(null, "5.5")).toBe(5.5);
        expect(refundCaseModel.normalizeCurrencyAmount("-1")).toBe(0);
        expect(refundCaseModel.normalizeAmountInMinorUnits("250")).toBe(250);
        expect(refundCaseModel.normalizeAmountInMinorUnits("-10")).toBe(0);
        expect(refundCaseModel.amountToMinorUnits("12.34")).toBe(1234);
        expect(refundCaseModel.minorUnitsToAmount(1234)).toBe(12.34);
    });

    test("normalizes statuses, refund types, decisions, and actor roles", () => {
        expect(refundCaseModel.normalizeRefundCaseStatus("customer approved")).toBe("customer_approved");
        expect(refundCaseModel.normalizeRefundCaseStatus("approved-by-vendor")).toBe("vendor_approved");
        expect(refundCaseModel.normalizeRefundCaseStatus("processed")).toBe("refunded");
        expect(refundCaseModel.normalizeRefundCaseStatus("bad", "processing")).toBe("processing");
        expect(refundCaseModel.normalizeRefundCaseStatus("bad")).toBe("not_requested");

        expect(refundCaseModel.normalizeRefundType("complete")).toBe("full");
        expect(refundCaseModel.normalizeRefundType("part")).toBe("partial");
        expect(refundCaseModel.normalizeRefundType("unknown", "full")).toBe("full");

        expect(refundCaseModel.normalizeDecision("yes")).toBe("approved");
        expect(refundCaseModel.normalizeDecision("rejected")).toBe("declined");
        expect(refundCaseModel.normalizeDecision("waiting")).toBe("pending");
        expect(refundCaseModel.normalizeDecision("unknown", "approve")).toBe("approved");

        expect(refundCaseModel.normalizeActorRole("vendor")).toBe("vendor");
        expect(refundCaseModel.normalizeActorRole("ghost")).toBe("system");
        expect(refundCaseModel.normalizeActorRole(null, "admin")).toBe("admin");
    });

    test("returns status metadata, lists, and state predicates", () => {
        expect(refundCaseModel.getDefaultRefundCaseStatus()).toBe("not_requested");
        expect(refundCaseModel.getRefundCaseStatusList()).toEqual(refundCaseModel.REFUND_CASE_STATUS_LIST);
        expect(refundCaseModel.getRefundTypeList()).toEqual(["partial", "full"]);
        expect(refundCaseModel.getDecisionList()).toEqual(["pending", "approved", "declined"]);

        expect(refundCaseModel.getRefundCaseStatusMetadata("approved")).toEqual({
            key: "approved",
            label: "Refund Approved",
            shortLabel: "Approved",
            tone: "success",
            description: "Both parties agreed. An admin can now execute the refund."
        });
        expect(refundCaseModel.getRefundCaseStatusLabel("failed")).toBe("Refund Failed");
        expect(refundCaseModel.getRefundCaseStatusShortLabel("refunded")).toBe("Refunded");
        expect(refundCaseModel.getRefundCaseStatusTone("processing")).toBe("loading");

        expect(refundCaseModel.isTerminalRefundCaseStatus("refunded")).toBe(true);
        expect(refundCaseModel.isTerminalRefundCaseStatus("failed")).toBe(false);
        expect(refundCaseModel.isActiveRefundCaseStatus("failed")).toBe(true);
        expect(refundCaseModel.isActiveRefundCaseStatus("cancelled")).toBe(false);
    });

    test("derives workflow status from party decisions", () => {
        expect(refundCaseModel.deriveRefundCaseStatus({})).toBe("not_requested");
        expect(refundCaseModel.deriveRefundCaseStatus({ amount: 10 })).toBe("proposed");
        expect(refundCaseModel.deriveRefundCaseStatus({
            customerDecision: "approved",
            vendorDecision: "pending"
        })).toBe("customer_approved");
        expect(refundCaseModel.deriveRefundCaseStatus({
            customerDecision: "pending",
            vendorDecision: "approved"
        })).toBe("vendor_approved");
        expect(refundCaseModel.deriveRefundCaseStatus({
            customerDecision: "approved",
            vendorDecision: "approved"
        })).toBe("approved");
        expect(refundCaseModel.deriveRefundCaseStatus({
            customerDecision: "approved",
            vendorDecision: "declined"
        })).toBe("declined");
        expect(refundCaseModel.deriveRefundCaseStatus({
            status: "processing",
            customerDecision: "declined"
        })).toBe("processing");
    });

    test("resolves full and partial refund amounts from orders and explicit values", () => {
        const order = createPaidOrder();

        expect(refundCaseModel.resolvePaidAmount(order)).toBe(110);
        expect(refundCaseModel.resolvePaidAmountInMinorUnits(order)).toBe(11000);
        expect(refundCaseModel.resolveRefundAmount({ type: "full" }, order)).toBe(110);
        expect(refundCaseModel.resolveRefundAmountInMinorUnits({ type: "full" }, order)).toBe(11000);
        expect(refundCaseModel.resolveRefundAmount({ type: "partial", amountInMinorUnits: 2550 }, order)).toBe(25.5);
        expect(refundCaseModel.resolveRefundAmountInMinorUnits({ type: "partial", amount: 25.5 }, order)).toBe(2550);
    });

    test("creates normalized refund case records", () => {
        const refundCase = refundCaseModel.createRefundCaseRecord({
            refundCaseId: " refund-1 ",
            ticketId: "ticket-1",
            type: "full",
            reason: " Food was unsafe ",
            customerApproved: true,
            vendorDecision: "approved",
            proposedByUid: "admin-1",
            proposedByName: "Admin",
            proposedAt: "T1",
            timeline: [
                {
                    eventType: "refund_proposed",
                    status: "proposed",
                    actorRole: "admin",
                    actorUid: "admin-1",
                    note: "Proposed",
                    at: "T1"
                }
            ]
        }, {
            order: createPaidOrder(),
            createdAt: "T0"
        });

        expect(refundCase).toEqual(expect.objectContaining({
            refundCaseId: "refund-1",
            ticketId: "ticket-1",
            orderId: "order-1",
            checkoutId: "checkout-1",
            customerUid: "customer-1",
            vendorUid: "vendor-1",
            status: "approved",
            statusLabel: "Refund Approved",
            statusTone: "success",
            type: "full",
            amount: 110,
            amountInMinorUnits: 11000,
            currency: "ZAR",
            reason: "Food was unsafe",
            customerDecision: "approved",
            vendorDecision: "approved",
            proposedByUid: "admin-1",
            proposedByName: "Admin",
            proposedAt: "T1",
            refundPaymentReference: "paystack-ref-1",
            requiresBothPartyAgreement: true,
            createdAt: "T0",
            updatedAt: "T0"
        }));
        expect(refundCase.timeline).toEqual([
            expect.objectContaining({
                eventType: "refund_proposed",
                status: "proposed",
                statusLabel: "Refund Proposed",
                actorRole: "admin"
            })
        ]);
    });

    test("creates proposal records with a proposal timeline entry", () => {
        const refundCase = refundCaseModel.createRefundCaseFromProposal({
            ticketId: "ticket-1",
            type: "partial",
            amount: 30,
            reason: "Missing item"
        }, {
            order: createPaidOrder(),
            actorUid: "admin-1",
            actorName: "Admin User",
            now: "T1"
        });

        expect(refundCase).toEqual(expect.objectContaining({
            status: "proposed",
            customerDecision: "pending",
            vendorDecision: "pending",
            amount: 30,
            amountInMinorUnits: 3000,
            proposedByUid: "admin-1",
            proposedByName: "Admin User",
            proposedAt: "T1",
            createdAt: "T1",
            updatedAt: "T1"
        }));
        expect(refundCase.timeline).toEqual([
            expect.objectContaining({
                eventType: "refund_proposed",
                status: "proposed",
                actorRole: "admin",
                actorUid: "admin-1",
                actorName: "Admin User",
                note: "Missing item",
                at: "T1"
            })
        ]);
    });

    test("applies customer and vendor decisions and marks cases executable only after both approve", () => {
        const proposed = refundCaseModel.createRefundCaseFromProposal({
            amount: 30,
            reason: "Missing item"
        }, {
            order: createPaidOrder(),
            now: "T1",
            actorUid: "admin-1"
        });
        const customerApproved = refundCaseModel.applyRefundDecision(proposed, {
            actorRole: "customer",
            actorUid: "customer-1",
            actorName: "Naledi",
            decision: "approved",
            note: "I agree.",
            decidedAt: "T2"
        });

        expect(customerApproved).toEqual(expect.objectContaining({
            status: "customer_approved",
            customerDecision: "approved",
            customerDecisionByUid: "customer-1",
            customerDecisionByName: "Naledi",
            customerDecisionAt: "T2",
            customerDecisionNote: "I agree.",
            vendorDecision: "pending",
            updatedAt: "T2"
        }));
        expect(refundCaseModel.isRefundCaseApproved(customerApproved)).toBe(false);
        expect(refundCaseModel.isRefundCaseExecutable(customerApproved)).toBe(false);

        const vendorApproved = refundCaseModel.applyRefundDecision(customerApproved, {
            actorRole: "vendor",
            actorUid: "vendor-1",
            actorName: "Shop",
            decision: "approved",
            note: "Agreed.",
            decidedAt: "T3"
        });

        expect(vendorApproved).toEqual(expect.objectContaining({
            status: "approved",
            vendorDecision: "approved",
            vendorDecisionByUid: "vendor-1",
            vendorDecisionByName: "Shop",
            vendorDecisionAt: "T3",
            vendorDecisionNote: "Agreed.",
            updatedAt: "T3"
        }));
        expect(refundCaseModel.isRefundCaseApproved(vendorApproved)).toBe(true);
        expect(refundCaseModel.isRefundCaseExecutable(vendorApproved)).toBe(true);
        expect(vendorApproved.timeline.map((entry) => entry.eventType)).toEqual([
            "refund_proposed",
            "refund_decision_approved",
            "refund_decision_approved"
        ]);
    });

    test("declined decisions put the case into a non-executable declined state", () => {
        const proposed = refundCaseModel.createRefundCaseFromProposal({
            amount: 30
        }, {
            order: createPaidOrder(),
            now: "T1"
        });
        const declined = refundCaseModel.applyRefundDecision(proposed, {
            actorRole: "vendor",
            actorUid: "vendor-1",
            decision: "declined",
            note: "Order was correct.",
            decidedAt: "T2"
        });

        expect(declined.status).toBe("declined");
        expect(declined.vendorDecision).toBe("declined");
        expect(refundCaseModel.isRefundCaseExecutable(declined)).toBe(false);
        expect(declined.timeline[1]).toEqual(expect.objectContaining({
            eventType: "refund_decision_declined",
            status: "declined",
            note: "Order was correct."
        }));
    });

    test("applies refund execution states for processing, success, and failure", () => {
        const approved = refundCaseModel.createRefundCaseRecord({
            amount: 40,
            customerDecision: "approved",
            vendorDecision: "approved",
            timeline: []
        }, {
            order: createPaidOrder()
        });

        const processing = refundCaseModel.applyRefundExecution(approved, {
            provider: "paystack",
            refundReference: "refund-ref-1"
        }, {
            actorUid: "admin-1",
            actorName: "Admin",
            now: "T4"
        });

        expect(processing).toEqual(expect.objectContaining({
            status: "processing",
            refundProvider: "paystack",
            refundReference: "refund-ref-1",
            executedAt: null,
            updatedAt: "T4"
        }));

        const refunded = refundCaseModel.applyRefundExecution(approved, {
            success: true,
            refundId: "refund-1",
            refundReference: "refund-ref-1",
            refundPaymentReference: "paystack-ref-1",
            executedAt: "T5"
        }, {
            actorUid: "admin-1",
            actorName: "Admin"
        });

        expect(refunded).toEqual(expect.objectContaining({
            status: "refunded",
            executedByUid: "admin-1",
            executedByName: "Admin",
            executedAt: "T5",
            refundId: "refund-1",
            refundReference: "refund-ref-1",
            refundPaymentReference: "paystack-ref-1",
            refundFailureReason: ""
        }));
        expect(refundCaseModel.isRefundCaseExecutable(refunded)).toBe(false);
        expect(refunded.timeline[0]).toEqual(expect.objectContaining({
            eventType: "refund_completed",
            status: "refunded"
        }));

        const failed = refundCaseModel.applyRefundExecution(approved, {
            refundFailureReason: "Paystack timeout"
        }, {
            actorUid: "admin-1",
            actorName: "Admin",
            now: "T6"
        });

        expect(failed).toEqual(expect.objectContaining({
            status: "failed",
            refundFailureReason: "Paystack timeout",
            updatedAt: "T6"
        }));
        expect(failed.timeline[0]).toEqual(expect.objectContaining({
            eventType: "refund_failed",
            status: "failed",
            note: "Paystack timeout"
        }));
    });

    test("creates compact patches from normalized refund cases", () => {
        const patch = refundCaseModel.createRefundCasePatch({
            amount: "30.5",
            customerDecision: "approved",
            vendorDecision: "approved",
            refundReference: " refund-ref ",
            updatedAt: "T1"
        }, {
            order: createPaidOrder()
        });

        expect(patch).toEqual({
            status: "approved",
            statusLabel: "Refund Approved",
            statusTone: "success",
            amount: 30.5,
            customerDecision: "approved",
            vendorDecision: "approved",
            refundReference: "refund-ref",
            updatedAt: "T1"
        });
    });

    test("calculates proportional finance impact for partial and full refunds", () => {
        const partial = refundCaseModel.calculateRefundFinancialImpact(createPaidOrder(), {
            amount: 55,
            amountInMinorUnits: 5500
        });

        expect(partial).toEqual({
            orderId: "order-1",
            refundAmount: 55,
            refundAmountInMinorUnits: 5500,
            paidAmount: 110,
            vendorEarnings: 100,
            platformEarnings: 10,
            vendorDeduction: 50,
            platformDeduction: 5,
            netVendorEarnings: 50,
            netPlatformEarnings: 5
        });

        const full = refundCaseModel.calculateRefundFinancialImpact(createPaidOrder(), {
            type: "full"
        });

        expect(full).toEqual(expect.objectContaining({
            refundAmount: 110,
            vendorDeduction: 100,
            platformDeduction: 10,
            netVendorEarnings: 0,
            netPlatformEarnings: 0
        }));

        const overRefund = refundCaseModel.calculateRefundFinancialImpact(createPaidOrder(), {
            amount: 999
        });

        expect(overRefund).toEqual(expect.objectContaining({
            refundAmount: 110,
            vendorDeduction: 100,
            platformDeduction: 10
        }));
    });
});
