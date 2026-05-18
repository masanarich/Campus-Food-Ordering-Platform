const paymentStatus = require("../../../public/shared/payments/payment-status.js");

describe("shared/payments/payment-status.js", () => {
    test("exports payment status constants and list helpers", () => {
        expect(paymentStatus.MODULE_NAME).toBe("payment-status");
        expect(paymentStatus.PAYMENT_STATUSES).toEqual({
            UNPAID: "unpaid",
            PENDING: "pending",
            PAID: "paid",
            FAILED: "failed"
        });
        expect(paymentStatus.ACTIVE_PAYMENT_STATUSES).toEqual(["pending"]);
        expect(paymentStatus.CUSTOMER_ACTION_PAYMENT_STATUSES).toEqual(["unpaid", "failed"]);
        expect(paymentStatus.RETRYABLE_PAYMENT_STATUSES).toEqual(["unpaid", "failed"]);
        expect(paymentStatus.ORDER_BLOCKING_PAYMENT_STATUSES).toEqual(["unpaid", "pending", "failed"]);
        expect(paymentStatus.REFUNDABLE_PAYMENT_STATUSES).toEqual(["paid"]);
        expect(paymentStatus.getDefaultPaymentStatus()).toBe("unpaid");
        expect(paymentStatus.getPaymentStatusList()).toEqual([
            "unpaid",
            "pending",
            "paid",
            "failed"
        ]);
        expect(paymentStatus.getTerminalPaymentStatusList()).toEqual(["paid"]);
        expect(paymentStatus.getActivePaymentStatusList()).toEqual(["pending"]);
        expect(paymentStatus.getCustomerActionPaymentStatusList()).toEqual(["unpaid", "failed"]);
        expect(paymentStatus.getRetryablePaymentStatusList()).toEqual(["unpaid", "failed"]);
        expect(paymentStatus.getOrderBlockingPaymentStatusList()).toEqual(["unpaid", "pending", "failed"]);
        expect(paymentStatus.getRefundablePaymentStatusList()).toEqual(["paid"]);
    });

    test("normalizes payment status aliases", () => {
        expect(paymentStatus.normalizePaymentStatus("PAID")).toBe("paid");
        expect(paymentStatus.normalizePaymentStatus(" payment-pending ")).toBe("pending");
        expect(paymentStatus.normalizePaymentStatus("awaiting verification")).toBe("pending");
        expect(paymentStatus.normalizePaymentStatus("not_paid")).toBe("unpaid");
        expect(paymentStatus.normalizePaymentStatus("cancelled")).toBe("failed");
        expect(paymentStatus.normalizePaymentStatus("unknown")).toBe("");
        expect(paymentStatus.normalizePaymentStatus("unknown", "failed")).toBe("failed");
    });

    test("normalizes status keys and text safely", () => {
        expect(paymentStatus.normalizeText("  Paid  ")).toBe("Paid");
        expect(paymentStatus.normalizeText(null)).toBe("");
        expect(paymentStatus.normalizeLowerText(" PAID ")).toBe("paid");
        expect(paymentStatus.normalizeStatusKey("Payment Pending")).toBe("paymentpending");
        expect(paymentStatus.normalizeStatusKey("payment_pending")).toBe("paymentpending");
    });

    test("returns fresh status lists that callers can mutate safely", () => {
        const active = paymentStatus.getActivePaymentStatusList();
        const customerAction = paymentStatus.getCustomerActionPaymentStatusList();
        const retryable = paymentStatus.getRetryablePaymentStatusList();
        const blocking = paymentStatus.getOrderBlockingPaymentStatusList();
        const refundable = paymentStatus.getRefundablePaymentStatusList();

        active.push("mutated");
        customerAction.push("mutated");
        retryable.push("mutated");
        blocking.push("mutated");
        refundable.push("mutated");

        expect(paymentStatus.getActivePaymentStatusList()).not.toContain("mutated");
        expect(paymentStatus.getCustomerActionPaymentStatusList()).not.toContain("mutated");
        expect(paymentStatus.getRetryablePaymentStatusList()).not.toContain("mutated");
        expect(paymentStatus.getOrderBlockingPaymentStatusList()).not.toContain("mutated");
        expect(paymentStatus.getRefundablePaymentStatusList()).not.toContain("mutated");
    });

    test("identifies known, terminal, active, customer-action, blocking, and refundable statuses", () => {
        expect(paymentStatus.isKnownPaymentStatus("verified")).toBe(true);
        expect(paymentStatus.isKnownPaymentStatus("mystery")).toBe(false);

        expect(paymentStatus.isTerminalPaymentStatus("paid")).toBe(true);
        expect(paymentStatus.isTerminalPaymentStatus("pending")).toBe(false);

        expect(paymentStatus.isPaymentPaid("success")).toBe(true);
        expect(paymentStatus.isPaymentUnpaid("awaiting payment")).toBe(true);
        expect(paymentStatus.isPaymentPending("initialized")).toBe(true);
        expect(paymentStatus.isPaymentFailed("declined")).toBe(true);
        expect(paymentStatus.isPaymentActive("verifying")).toBe(true);
        expect(paymentStatus.isPaymentActive("paid")).toBe(false);
        expect(paymentStatus.isPaymentAwaitingCustomerAction("not paid")).toBe(true);
        expect(paymentStatus.isPaymentAwaitingCustomerAction("failure")).toBe(true);
        expect(paymentStatus.isPaymentAwaitingCustomerAction("pending")).toBe(false);

        expect(paymentStatus.isPaymentRetryable("unpaid")).toBe(true);
        expect(paymentStatus.isPaymentRetryable("failed")).toBe(true);
        expect(paymentStatus.isPaymentRetryable("paid")).toBe(false);
        expect(paymentStatus.isPaymentBlockingOrder("unpaid")).toBe(true);
        expect(paymentStatus.isPaymentBlockingOrder("payment pending")).toBe(true);
        expect(paymentStatus.isPaymentBlockingOrder("declined")).toBe(true);
        expect(paymentStatus.isPaymentBlockingOrder("verified")).toBe(false);
        expect(paymentStatus.isPaymentBlockingOrder("mystery")).toBe(false);
        expect(paymentStatus.isPaymentRefundable("paid")).toBe(true);
        expect(paymentStatus.isPaymentRefundable("pending")).toBe(false);
    });

    test("returns metadata and label helpers for known statuses", () => {
        expect(paymentStatus.getPaymentStatusMetadata("paid")).toEqual({
            key: "paid",
            label: "Paid",
            shortLabel: "Paid",
            description: "Payment was successfully verified.",
            tone: "success",
            actionLabel: "View Payment"
        });
        expect(paymentStatus.getPaymentStatusLabel("pending")).toBe("Payment Pending");
        expect(paymentStatus.getPaymentStatusShortLabel("failed")).toBe("Failed");
        expect(paymentStatus.getPaymentStatusDescription("unpaid")).toBe(
            "Payment has not been started for this order."
        );
        expect(paymentStatus.getPaymentStatusTone("failed")).toBe("error");
        expect(paymentStatus.getPaymentStatusActionLabel("failed")).toBe("Retry Payment");
    });

    test("returns safe metadata for unknown statuses", () => {
        expect(paymentStatus.getPaymentStatusMetadata("unknown")).toEqual({
            key: "",
            label: "Unknown Payment Status",
            shortLabel: "Unknown",
            description: "The payment status is not recognized yet.",
            tone: "neutral",
            actionLabel: "Review Payment"
        });
        expect(paymentStatus.getPaymentStatusLabel("unknown")).toBe("Unknown Payment Status");
    });

    test("returns allowed next payment statuses", () => {
        expect(paymentStatus.getAllowedNextPaymentStatuses("unpaid")).toEqual([
            "pending",
            "failed"
        ]);
        expect(paymentStatus.getAllowedNextPaymentStatuses("pending")).toEqual([
            "paid",
            "failed"
        ]);
        expect(paymentStatus.getAllowedNextPaymentStatuses("failed")).toEqual(["pending"]);
        expect(paymentStatus.getAllowedNextPaymentStatuses("paid")).toEqual([]);
        expect(paymentStatus.getAllowedNextPaymentStatuses("unknown")).toEqual([]);
    });

    test("validates allowed payment status transitions", () => {
        expect(paymentStatus.canTransitionPaymentStatus("unpaid", "pending")).toBe(true);
        expect(paymentStatus.canTransitionPaymentStatus("pending", "paid")).toBe(true);
        expect(paymentStatus.canTransitionPaymentStatus("pending", "failed")).toBe(true);
        expect(paymentStatus.canTransitionPaymentStatus("failed", "pending")).toBe(true);

        expect(paymentStatus.validatePaymentStatusTransition("pending", "paid")).toEqual({
            isValid: true,
            currentStatus: "pending",
            nextStatus: "paid",
            message: "Payments can move from Payment Pending to Paid."
        });
    });

    test("rejects invalid payment status transitions", () => {
        expect(paymentStatus.validatePaymentStatusTransition("unknown", "paid")).toEqual({
            isValid: false,
            currentStatus: "",
            nextStatus: "paid",
            message: "The current payment status is invalid."
        });
        expect(paymentStatus.validatePaymentStatusTransition("pending", "unknown")).toEqual({
            isValid: false,
            currentStatus: "pending",
            nextStatus: "",
            message: "The next payment status is invalid."
        });
        expect(paymentStatus.validatePaymentStatusTransition("paid", "failed")).toEqual({
            isValid: false,
            currentStatus: "paid",
            nextStatus: "failed",
            message: "Paid payments cannot transition to another status."
        });
        expect(paymentStatus.validatePaymentStatusTransition("pending", "pending")).toEqual({
            isValid: false,
            currentStatus: "pending",
            nextStatus: "pending",
            message: "The payment is already marked as Payment Pending."
        });
        expect(paymentStatus.validatePaymentStatusTransition("failed", "paid")).toEqual({
            isValid: false,
            currentStatus: "failed",
            nextStatus: "paid",
            message: "Payments cannot move from Payment Failed to Paid."
        });
    });

    test("attaches the module to a browser-like global scope", () => {
        jest.isolateModules(() => {
            const originalWindow = global.window;

            try {
                global.window = {};
                require("../../../public/shared/payments/payment-status.js");

                expect(global.window.paymentStatus).toBeDefined();
                expect(global.window.paymentStatus.normalizePaymentStatus("success")).toBe("paid");
            } finally {
                if (originalWindow === undefined) {
                    delete global.window;
                } else {
                    global.window = originalWindow;
                }
            }
        });
    });
});
