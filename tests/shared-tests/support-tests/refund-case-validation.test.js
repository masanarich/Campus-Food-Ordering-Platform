const refundCaseValidation = require("../../../public/shared/support/refund-case-validation.js");
const refundCaseModel = require("../../../public/shared/support/refund-case-model.js");

function createPaidOrder(overrides = {}) {
    return {
        orderId: "order-1",
        checkoutId: "checkout-1",
        customerUid: "customer-1",
        vendorUid: "vendor-1",
        status: "completed",
        paymentStatus: "paid",
        paymentReference: "paystack-ref-1",
        paymentAmount: 110,
        paymentAmountInMinorUnits: 11000,
        paymentCurrency: "ZAR",
        vendorEarnings: 100,
        platformEarnings: 10,
        ...overrides
    };
}

function createApprovedRefundCase(overrides = {}) {
    return refundCaseModel.createRefundCaseRecord({
        ticketId: "ticket-1",
        orderId: "order-1",
        customerUid: "customer-1",
        vendorUid: "vendor-1",
        type: "partial",
        amount: 55,
        reason: "Food quality issue",
        customerDecision: "approved",
        vendorDecision: "approved",
        ...overrides
    }, {
        order: createPaidOrder()
    });
}

describe("shared/support/refund-case-validation.js", () => {
    afterEach(() => {
        if (typeof global !== "undefined") {
            delete global.refundCaseModel;
        }
    });

    test("exports the expected module surface and constants", () => {
        expect(refundCaseValidation.MODULE_NAME).toBe("refund-case-validation");
        expect(refundCaseValidation.DEFAULT_REASON_MIN_LENGTH).toBeGreaterThan(0);
        expect(refundCaseValidation.DEFAULT_REASON_MAX_LENGTH).toBeGreaterThan(
            refundCaseValidation.DEFAULT_REASON_MIN_LENGTH
        );
        expect(refundCaseValidation.DEFAULT_NOTE_MAX_LENGTH).toBeGreaterThan(0);

        [
            "resolveRefundCaseModel",
            "createValidationResult",
            "setError",
            "mergeErrors",
            "normalizeOrderForRefund",
            "isPaidOrder",
            "validateRefundActor",
            "validateLinkedOrder",
            "validateReason",
            "validateNote",
            "validateRefundAmount",
            "validateRefundCaseRecord",
            "validateRefundProposalInput",
            "validateRefundDecisionInput",
            "validateRefundExecutionInput",
            "validateRefundStatusTransition"
        ].forEach((name) => expect(typeof refundCaseValidation[name]).toBe("function"));
    });

    test("resolves refund-case model from explicit, global, and require fallbacks", () => {
        const fakeModel = {
            createRefundCaseRecord: jest.fn(),
            normalizeRefundCaseStatus: jest.fn(),
            calculateRefundFinancialImpact: jest.fn()
        };

        expect(refundCaseValidation.resolveRefundCaseModel(fakeModel)).toBe(fakeModel);
        global.refundCaseModel = fakeModel;
        expect(refundCaseValidation.resolveRefundCaseModel()).toBe(fakeModel);
        delete global.refundCaseModel;
        expect(refundCaseValidation.resolveRefundCaseModel()).toBe(refundCaseModel);
        expect(refundCaseValidation.resolveRefundCaseModel({ wrong: true })).toBe(refundCaseModel);
    });

    test("primitive validation helpers compose error objects", () => {
        expect(refundCaseValidation.normalizeText("  hi ")).toBe("hi");
        expect(refundCaseValidation.normalizeText(null)).toBe("");
        expect(refundCaseValidation.normalizeLowerText(" HELLO ")).toBe("hello");
        expect(refundCaseValidation.normalizeCurrencyAmount("10.235")).toBe(10.24);
        expect(refundCaseValidation.normalizeAmountInMinorUnits("-5")).toBe(0);
        expect(refundCaseValidation.amountToMinorUnits("12.34")).toBe(1234);

        const valid = refundCaseValidation.createValidationResult({});
        expect(valid).toEqual({ isValid: true, errors: {} });

        const invalid = refundCaseValidation.createValidationResult({ amount: "bad" }, { value: 1 });
        expect(invalid).toEqual({ isValid: false, errors: { amount: "bad" }, value: 1 });

        const errors = {};
        refundCaseValidation.setError(errors, "field", "first");
        refundCaseValidation.setError(errors, "field", "second");
        refundCaseValidation.setError(errors, "", "ignored");
        expect(errors).toEqual({ field: "first" });

        const merged = refundCaseValidation.mergeErrors({ existing: "kept" }, { amount: "bad" }, "refund");
        expect(merged).toEqual({
            existing: "kept",
            "refund.amount": "bad"
        });
    });

    test("normalizes and validates linked paid orders", () => {
        expect(refundCaseValidation.normalizeOrderForRefund(createPaidOrder())).toEqual(
            expect.objectContaining({
                orderId: "order-1",
                customerUid: "customer-1",
                vendorUid: "vendor-1",
                paymentStatus: "paid",
                paymentReference: "paystack-ref-1",
                paymentAmount: 110,
                paymentAmountInMinorUnits: 11000
            })
        );
        expect(refundCaseValidation.isPaidOrder(createPaidOrder())).toBe(true);
        expect(refundCaseValidation.isPaidOrder(createPaidOrder({ paymentStatus: "pending" }))).toBe(false);
        expect(refundCaseValidation.isPaidOrder(createPaidOrder({
            paymentStatus: "",
            status: "completed",
            paymentAmount: 10
        }))).toBe(true);

        const ok = refundCaseValidation.validateLinkedOrder(createPaidOrder(), {
            requirePaymentReference: true
        });
        expect(ok.isValid).toBe(true);

        const bad = refundCaseValidation.validateLinkedOrder({
            paymentStatus: "pending",
            paymentAmount: 0
        }, {
            requirePaymentReference: true
        });
        expect(bad.isValid).toBe(false);
        expect(bad.errors).toEqual({
            orderId: expect.any(String),
            customerUid: expect.any(String),
            vendorUid: expect.any(String),
            paymentAmount: expect.any(String),
            paymentStatus: expect.any(String),
            paymentReference: expect.any(String)
        });
    });

    test("validates actors, reasons, and notes", () => {
        expect(refundCaseValidation.validateRefundActor({
            uid: "admin-1",
            role: "admin",
            displayName: "Admin"
        })).toEqual({
            isValid: true,
            errors: {},
            value: {
                actorUid: "admin-1",
                actorRole: "admin",
                actorName: "Admin"
            }
        });

        expect(refundCaseValidation.validateRefundActor({
            role: "ghost"
        }).errors).toEqual({
            actorUid: expect.any(String),
            actorRole: expect.any(String)
        });

        expect(refundCaseValidation.validateReason("Food issue").isValid).toBe(true);
        expect(refundCaseValidation.validateReason("").errors.reason).toMatch(/required/i);
        expect(refundCaseValidation.validateReason("abc").errors.reason).toMatch(/at least/i);
        expect(refundCaseValidation.validateReason("x".repeat(601)).errors.reason).toMatch(/at most/i);

        expect(refundCaseValidation.validateNote("short", "adminNote").isValid).toBe(true);
        expect(refundCaseValidation.validateNote("x".repeat(1001), "adminNote").errors.adminNote)
            .toMatch(/at most/i);
    });

    test("validates partial and full refund amounts against the paid order", () => {
        expect(refundCaseValidation.validateRefundAmount({
            type: "partial",
            amount: 55
        }, createPaidOrder()).isValid).toBe(true);

        const full = refundCaseValidation.validateRefundAmount({
            type: "full"
        }, createPaidOrder());
        expect(full.isValid).toBe(true);
        expect(full.value).toEqual(expect.objectContaining({
            type: "full",
            amount: 110,
            amountInMinorUnits: 11000,
            paidAmount: 110
        }));

        expect(refundCaseValidation.validateRefundAmount({
            type: "partial",
            amount: 110
        }, createPaidOrder()).errors.amount).toMatch(/partial refund/i);

        expect(refundCaseValidation.validateRefundAmount({
            type: "partial",
            amount: 111
        }, createPaidOrder()).errors.amount).toMatch(/greater than the paid amount/i);

        expect(refundCaseValidation.validateRefundAmount({
            type: "partial",
            amount: 0
        }, createPaidOrder()).errors.amount).toMatch(/greater than zero/i);

        expect(refundCaseValidation.validateRefundAmount({
            type: "partial",
            amountInMinorUnits: 11100
        }, createPaidOrder()).errors.amountInMinorUnits).toMatch(/greater than the paid amount/i);
    });

    test("validates complete refund case records", () => {
        const ok = refundCaseValidation.validateRefundCaseRecord({
            type: "partial",
            amount: 30,
            reason: "Missing item",
            customerDecision: "pending",
            vendorDecision: "pending"
        }, {
            order: createPaidOrder()
        });

        expect(ok.isValid).toBe(true);
        expect(ok.value).toEqual(expect.objectContaining({
            orderId: "order-1",
            customerUid: "customer-1",
            vendorUid: "vendor-1",
            amount: 30,
            reason: "Missing item"
        }));

        const bad = refundCaseValidation.validateRefundCaseRecord({
            amount: 0,
            reason: "",
            customerNote: "x".repeat(1001)
        }, {
            order: createPaidOrder({ customerUid: "", vendorUid: "" })
        });

        expect(bad.isValid).toBe(false);
        expect(bad.errors).toEqual(expect.objectContaining({
            amount: expect.any(String),
            reason: expect.any(String),
            customerNote: expect.any(String),
            customerUid: expect.any(String),
            vendorUid: expect.any(String)
        }));
    });

    test("only admins can propose valid refund cases", () => {
        const ok = refundCaseValidation.validateRefundProposalInput({
            type: "partial",
            amount: 30,
            reason: "Food was cold"
        }, {
            order: createPaidOrder(),
            actorUid: "admin-1",
            actorRole: "admin",
            actorName: "Admin"
        });

        expect(ok.isValid).toBe(true);
        expect(ok.actor.actorRole).toBe("admin");
        expect(ok.value).toEqual(expect.objectContaining({
            status: "proposed",
            proposedByUid: "admin-1",
            proposedByName: "Admin",
            amount: 30
        }));

        const customerAttempt = refundCaseValidation.validateRefundProposalInput({
            amount: 30,
            reason: "Food was cold"
        }, {
            order: createPaidOrder(),
            actorUid: "customer-1",
            actorRole: "customer"
        });

        expect(customerAttempt.isValid).toBe(false);
        expect(customerAttempt.errors.actorRole).toBe("Only an admin can propose a refund.");

        const terminalAttempt = refundCaseValidation.validateRefundProposalInput({
            status: "refunded",
            amount: 30,
            reason: "Food was cold"
        }, {
            order: createPaidOrder(),
            actorUid: "admin-1",
            actorRole: "admin"
        });

        expect(terminalAttempt.errors.status).toMatch(/terminal/i);
    });

    test("validates customer and vendor refund decisions", () => {
        const proposed = refundCaseModel.createRefundCaseFromProposal({
            amount: 30,
            reason: "Missing item"
        }, {
            order: createPaidOrder(),
            actorUid: "admin-1",
            actorName: "Admin",
            now: "T1"
        });

        const customerDecision = refundCaseValidation.validateRefundDecisionInput(proposed, {
            actorRole: "customer",
            actorUid: "customer-1",
            decision: "approved",
            note: "I agree"
        });

        expect(customerDecision.isValid).toBe(true);
        expect(customerDecision.value).toEqual(expect.objectContaining({
            decision: "approved",
            actorRole: "customer",
            actorUid: "customer-1"
        }));

        const wrongCustomer = refundCaseValidation.validateRefundDecisionInput(proposed, {
            actorRole: "customer",
            actorUid: "someone-else",
            decision: "approved"
        });
        expect(wrongCustomer.errors.actorUid).toMatch(/linked party/i);

        const adminDecision = refundCaseValidation.validateRefundDecisionInput(proposed, {
            actorRole: "admin",
            actorUid: "admin-1",
            decision: "approved"
        });
        expect(adminDecision.errors.actorRole).toMatch(/customer or vendor/i);

        const pendingDecision = refundCaseValidation.validateRefundDecisionInput(proposed, {
            actorRole: "vendor",
            actorUid: "vendor-1",
            decision: "pending"
        });
        expect(pendingDecision.errors.decision).toMatch(/approved or declined/i);

        const terminalDecision = refundCaseValidation.validateRefundDecisionInput({
            ...proposed,
            status: "refunded"
        }, {
            actorRole: "vendor",
            actorUid: "vendor-1",
            decision: "approved"
        });
        expect(terminalDecision.errors.status).toMatch(/terminal/i);

        const notProposed = refundCaseValidation.validateRefundDecisionInput({
            ...proposed,
            status: "not_requested",
            amount: 0
        }, {
            actorRole: "vendor",
            actorUid: "vendor-1",
            decision: "approved"
        });
        expect(notProposed.errors.status).toMatch(/proposed/i);
    });

    test("validates execution requires admin, matching paid order, both approvals, and payment reference", () => {
        const approved = createApprovedRefundCase();
        const ok = refundCaseValidation.validateRefundExecutionInput(approved, createPaidOrder(), {
            actorUid: "admin-1",
            actorRole: "admin",
            actorName: "Admin"
        });

        expect(ok.isValid).toBe(true);
        expect(ok.value.impact).toEqual(expect.objectContaining({
            refundAmount: 55,
            vendorDeduction: 50,
            platformDeduction: 5
        }));

        const vendorAttempt = refundCaseValidation.validateRefundExecutionInput(approved, createPaidOrder(), {
            actorUid: "vendor-1",
            actorRole: "vendor"
        });
        expect(vendorAttempt.errors.actorRole).toMatch(/Only an admin/i);

        const missingApproval = refundCaseValidation.validateRefundExecutionInput({
            ...approved,
            vendorDecision: "pending",
            status: "customer_approved"
        }, createPaidOrder(), {
            actorUid: "admin-1",
            actorRole: "admin"
        });
        expect(missingApproval.errors.approval).toMatch(/Both customer and vendor/i);
        expect(missingApproval.errors.status).toMatch(/not ready/i);

        const noReference = refundCaseValidation.validateRefundExecutionInput(approved, createPaidOrder({
            paymentReference: ""
        }), {
            actorUid: "admin-1",
            actorRole: "admin"
        });
        expect(noReference.errors["order.paymentReference"]).toMatch(/Payment reference/i);

        const mismatchedOrder = refundCaseValidation.validateRefundExecutionInput(approved, createPaidOrder({
            orderId: "order-2"
        }), {
            actorUid: "admin-1",
            actorRole: "admin"
        });
        expect(mismatchedOrder.errors.orderId).toMatch(/does not match/i);
    });

    test("validates refund status transitions", () => {
        expect(refundCaseValidation.validateRefundStatusTransition({
            status: "not_requested"
        }, "proposed")).toEqual(expect.objectContaining({
            isValid: true,
            currentStatus: "not_requested",
            nextStatus: "proposed"
        }));

        expect(refundCaseValidation.validateRefundStatusTransition({
            status: "proposed"
        }, "refunded").errors.status).toMatch(/cannot move/i);

        expect(refundCaseValidation.validateRefundStatusTransition({
            status: "approved"
        }, "processing").isValid).toBe(true);

        expect(refundCaseValidation.validateRefundStatusTransition({
            status: "refunded"
        }, "processing").errors.status).toMatch(/cannot move/i);

        expect(refundCaseValidation.validateRefundStatusTransition({
            status: "processing"
        }, "processing").errors.status).toMatch(/already/i);
    });
});
