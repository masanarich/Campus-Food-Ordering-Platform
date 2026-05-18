const checkoutStatus = require("../../../public/shared/checkout/checkout-status.js");

describe("shared/checkout/checkout-status.js", () => {
    test("exports canonical checkout statuses, actor roles, and default status", () => {
        expect(checkoutStatus.MODULE_NAME).toBe("checkout-status");
        expect(checkoutStatus.CHECKOUT_STATUSES).toEqual({
            DRAFT: "draft",
            PAYMENT_PENDING: "payment_pending",
            PAYMENT_FAILED: "payment_failed",
            CANCELLED: "cancelled",
            EXPIRED: "expired",
            PAID: "paid",
            CONVERTED: "converted"
        });
        expect(checkoutStatus.CHECKOUT_ACTOR_ROLES).toEqual({
            CUSTOMER: "customer",
            ADMIN: "admin",
            SYSTEM: "system"
        });
        expect(checkoutStatus.getDefaultCheckoutStatus()).toBe("draft");
    });

    test("returns defensive copies of all checkout status groups", () => {
        const allStatuses = checkoutStatus.getCheckoutStatusList();
        const activeStatuses = checkoutStatus.getActiveCheckoutStatusList();
        const terminalStatuses = checkoutStatus.getTerminalCheckoutStatusList();
        const retryableStatuses = checkoutStatus.getRetryableCheckoutStatusList();
        const resumableStatuses = checkoutStatus.getResumableCheckoutStatusList();
        const cancellableStatuses = checkoutStatus.getCancellableCheckoutStatusList();

        expect(allStatuses).toEqual([
            "draft",
            "payment_pending",
            "payment_failed",
            "cancelled",
            "expired",
            "paid",
            "converted"
        ]);
        expect(activeStatuses).toEqual([
            "draft",
            "payment_pending",
            "payment_failed",
            "paid"
        ]);
        expect(terminalStatuses).toEqual(["cancelled", "expired", "converted"]);
        expect(retryableStatuses).toEqual(["draft", "payment_failed"]);
        expect(resumableStatuses).toEqual([
            "draft",
            "payment_pending",
            "payment_failed"
        ]);
        expect(cancellableStatuses).toEqual([
            "draft",
            "payment_pending",
            "payment_failed"
        ]);

        allStatuses.push("mutated");
        expect(checkoutStatus.getCheckoutStatusList()).not.toContain("mutated");
    });

    test("normalizes text, lower text, and status keys safely", () => {
        expect(checkoutStatus.normalizeText("  Draft  ")).toBe("Draft");
        expect(checkoutStatus.normalizeText(null)).toBe("");
        expect(checkoutStatus.normalizeText(123)).toBe("");
        expect(checkoutStatus.normalizeLowerText(" Payment Pending ")).toBe("payment pending");
        expect(checkoutStatus.normalizeStatusKey("payment_pending")).toBe("paymentpending");
        expect(checkoutStatus.normalizeStatusKey(" payment-pending ")).toBe("paymentpending");
        expect(checkoutStatus.normalizeStatusKey("Payment Pending")).toBe("paymentpending");
    });

    test("normalizes checkout status aliases and fallback values", () => {
        expect(checkoutStatus.normalizeCheckoutStatus(" New ")).toBe("draft");
        expect(checkoutStatus.normalizeCheckoutStatus("checkout-open")).toBe("draft");
        expect(checkoutStatus.normalizeCheckoutStatus("awaiting payment")).toBe("payment_pending");
        expect(checkoutStatus.normalizeCheckoutStatus("awaiting_verification")).toBe("payment_pending");
        expect(checkoutStatus.normalizeCheckoutStatus("in-progress")).toBe("payment_pending");
        expect(checkoutStatus.normalizeCheckoutStatus("payment failed")).toBe("payment_failed");
        expect(checkoutStatus.normalizeCheckoutStatus("declined")).toBe("payment_failed");
        expect(checkoutStatus.normalizeCheckoutStatus("customer_cancelled")).toBe("cancelled");
        expect(checkoutStatus.normalizeCheckoutStatus("canceled")).toBe("cancelled");
        expect(checkoutStatus.normalizeCheckoutStatus("timed out")).toBe("expired");
        expect(checkoutStatus.normalizeCheckoutStatus("payment verified")).toBe("paid");
        expect(checkoutStatus.normalizeCheckoutStatus("success")).toBe("paid");
        expect(checkoutStatus.normalizeCheckoutStatus("order created")).toBe("converted");
        expect(checkoutStatus.normalizeCheckoutStatus("complete")).toBe("converted");
        expect(checkoutStatus.normalizeCheckoutStatus("mystery")).toBe("");
        expect(checkoutStatus.normalizeCheckoutStatus("mystery", "payment_failed")).toBe("payment_failed");
    });

    test("normalizes checkout actor role aliases", () => {
        expect(checkoutStatus.normalizeCheckoutActorRole("student")).toBe("customer");
        expect(checkoutStatus.normalizeCheckoutActorRole("USER")).toBe("customer");
        expect(checkoutStatus.normalizeCheckoutActorRole("administrator")).toBe("admin");
        expect(checkoutStatus.normalizeCheckoutActorRole("server")).toBe("system");
        expect(checkoutStatus.normalizeCheckoutActorRole("firebase function")).toBe("system");
        expect(checkoutStatus.normalizeCheckoutActorRole("vendor")).toBe("");
        expect(checkoutStatus.normalizeCheckoutActorRole(null)).toBe("");
    });

    test("identifies known, active, terminal, retryable, resumable, and cancellable statuses", () => {
        expect(checkoutStatus.isKnownCheckoutStatus("payment pending")).toBe(true);
        expect(checkoutStatus.isKnownCheckoutStatus("unknown")).toBe(false);

        expect(checkoutStatus.isActiveCheckoutStatus("draft")).toBe(true);
        expect(checkoutStatus.isActiveCheckoutStatus("paid")).toBe(true);
        expect(checkoutStatus.isActiveCheckoutStatus("converted")).toBe(false);

        expect(checkoutStatus.isTerminalCheckoutStatus("cancelled")).toBe(true);
        expect(checkoutStatus.isTerminalCheckoutStatus("expired")).toBe(true);
        expect(checkoutStatus.isTerminalCheckoutStatus("converted")).toBe(true);
        expect(checkoutStatus.isTerminalCheckoutStatus("payment_failed")).toBe(false);

        expect(checkoutStatus.isRetryableCheckoutStatus("draft")).toBe(true);
        expect(checkoutStatus.isRetryableCheckoutStatus("payment_failed")).toBe(true);
        expect(checkoutStatus.isRetryableCheckoutStatus("payment_pending")).toBe(false);

        expect(checkoutStatus.isResumableCheckoutStatus("draft")).toBe(true);
        expect(checkoutStatus.isResumableCheckoutStatus("payment_pending")).toBe(true);
        expect(checkoutStatus.isResumableCheckoutStatus("payment_failed")).toBe(true);
        expect(checkoutStatus.isResumableCheckoutStatus("converted")).toBe(false);

        expect(checkoutStatus.isCancellableCheckoutStatus("draft")).toBe(true);
        expect(checkoutStatus.isCancellableCheckoutStatus("payment_pending")).toBe(true);
        expect(checkoutStatus.isCancellableCheckoutStatus("payment_failed")).toBe(true);
        expect(checkoutStatus.isCancellableCheckoutStatus("paid")).toBe(false);

        expect(checkoutStatus.isCheckoutAwaitingPayment("initialized")).toBe(true);
        expect(checkoutStatus.isCheckoutAwaitingPayment("paid")).toBe(false);
        expect(checkoutStatus.isCheckoutPaid("verified")).toBe(true);
        expect(checkoutStatus.isCheckoutPaid("converted")).toBe(false);
        expect(checkoutStatus.isCheckoutConverted("order_created")).toBe(true);
        expect(checkoutStatus.isCheckoutConverted("paid")).toBe(false);
    });

    test("returns metadata for every known checkout status", () => {
        expect(checkoutStatus.getCheckoutStatusMetadata("draft")).toEqual({
            key: "draft",
            label: "Checkout Draft",
            shortLabel: "Draft",
            description: "The checkout session has been created but payment has not started yet.",
            tone: "neutral",
            actionLabel: "Start Payment"
        });
        expect(checkoutStatus.getCheckoutStatusMetadata("payment_pending")).toEqual({
            key: "payment_pending",
            label: "Payment Pending",
            shortLabel: "Pending",
            description: "Payment has started and is waiting for confirmation.",
            tone: "loading",
            actionLabel: "Resume Payment"
        });
        expect(checkoutStatus.getCheckoutStatusMetadata("payment_failed")).toEqual({
            key: "payment_failed",
            label: "Payment Failed",
            shortLabel: "Failed",
            description: "Payment failed or could not be verified.",
            tone: "error",
            actionLabel: "Retry Payment"
        });
        expect(checkoutStatus.getCheckoutStatusMetadata("cancelled")).toEqual({
            key: "cancelled",
            label: "Checkout Cancelled",
            shortLabel: "Cancelled",
            description: "The customer cancelled the checkout before payment was completed.",
            tone: "error",
            actionLabel: "View Cart"
        });
        expect(checkoutStatus.getCheckoutStatusMetadata("expired")).toEqual({
            key: "expired",
            label: "Checkout Expired",
            shortLabel: "Expired",
            description: "The checkout session expired before payment was completed.",
            tone: "warning",
            actionLabel: "Start Again"
        });
        expect(checkoutStatus.getCheckoutStatusMetadata("paid")).toEqual({
            key: "paid",
            label: "Payment Verified",
            shortLabel: "Paid",
            description: "Payment was verified and the session is ready to become an order.",
            tone: "success",
            actionLabel: "Create Order"
        });
        expect(checkoutStatus.getCheckoutStatusMetadata("converted")).toEqual({
            key: "converted",
            label: "Order Created",
            shortLabel: "Converted",
            description: "The paid checkout session has been converted into an order.",
            tone: "success",
            actionLabel: "View Order"
        });
    });

    test("returns label helpers and unknown metadata safely", () => {
        expect(checkoutStatus.getCheckoutStatusLabel("draft")).toBe("Checkout Draft");
        expect(checkoutStatus.getCheckoutStatusShortLabel("payment_pending")).toBe("Pending");
        expect(checkoutStatus.getCheckoutStatusDescription("paid"))
            .toBe("Payment was verified and the session is ready to become an order.");
        expect(checkoutStatus.getCheckoutStatusTone("expired")).toBe("warning");
        expect(checkoutStatus.getCheckoutStatusActionLabel("converted")).toBe("View Order");

        expect(checkoutStatus.getCheckoutStatusMetadata("unknown")).toEqual({
            key: "",
            label: "Unknown Checkout Status",
            shortLabel: "Unknown",
            description: "The checkout status is not recognized yet.",
            tone: "neutral",
            actionLabel: "Review Checkout"
        });
        expect(checkoutStatus.getCheckoutStatusLabel("unknown")).toBe("Unknown Checkout Status");
    });

    test("returns actor role labels", () => {
        expect(checkoutStatus.getActorRoleLabel("customer")).toBe("Customers");
        expect(checkoutStatus.getActorRoleLabel("admin")).toBe("Admins");
        expect(checkoutStatus.getActorRoleLabel("system")).toBe("The system");
        expect(checkoutStatus.getActorRoleLabel("unknown")).toBe("This actor");
    });

    test("returns allowed next checkout statuses by actor", () => {
        expect(checkoutStatus.getAllowedNextCheckoutStatuses("draft", "customer")).toEqual([
            "payment_pending",
            "cancelled"
        ]);
        expect(checkoutStatus.getAllowedNextCheckoutStatuses("payment_pending", "customer")).toEqual([
            "cancelled"
        ]);
        expect(checkoutStatus.getAllowedNextCheckoutStatuses("payment_failed", "customer")).toEqual([
            "payment_pending",
            "cancelled"
        ]);
        expect(checkoutStatus.getAllowedNextCheckoutStatuses("payment_pending", "system")).toEqual([
            "paid",
            "payment_failed",
            "cancelled",
            "expired"
        ]);
        expect(checkoutStatus.getAllowedNextCheckoutStatuses("paid", "system")).toEqual([
            "converted"
        ]);
        expect(checkoutStatus.getAllowedNextCheckoutStatuses("draft", "admin")).toEqual([
            "payment_pending",
            "cancelled",
            "expired"
        ]);
        expect(checkoutStatus.getAllowedNextCheckoutStatuses("converted", "admin")).toEqual([]);
        expect(checkoutStatus.getAllowedNextCheckoutStatuses("unknown", "system")).toEqual([]);
        expect(checkoutStatus.getAllowedNextCheckoutStatuses("draft", "vendor")).toEqual([]);
    });

    test("validates allowed checkout transitions", () => {
        expect(checkoutStatus.canTransitionCheckoutStatus("draft", "payment_pending", "customer")).toBe(true);
        expect(checkoutStatus.canTransitionCheckoutStatus("payment_failed", "payment_pending", "customer")).toBe(true);
        expect(checkoutStatus.canTransitionCheckoutStatus("payment_pending", "paid", "system")).toBe(true);
        expect(checkoutStatus.canTransitionCheckoutStatus("paid", "converted", "system")).toBe(true);
        expect(checkoutStatus.canTransitionCheckoutStatus("payment_pending", "expired", "admin")).toBe(true);

        expect(
            checkoutStatus.validateCheckoutStatusTransition("payment_pending", "paid", "system")
        ).toEqual({
            isValid: true,
            currentStatus: "payment_pending",
            nextStatus: "paid",
            actorRole: "system",
            message: "The system can move a checkout from Payment Pending to Payment Verified."
        });
    });

    test("rejects invalid checkout transitions with helpful reasons", () => {
        expect(
            checkoutStatus.validateCheckoutStatusTransition("draft", "payment_pending", "vendor")
        ).toEqual({
            isValid: false,
            currentStatus: "draft",
            nextStatus: "payment_pending",
            actorRole: "",
            message: "A valid actor role is required before changing checkout status."
        });

        expect(
            checkoutStatus.validateCheckoutStatusTransition("mystery", "payment_pending", "system")
        ).toEqual({
            isValid: false,
            currentStatus: "",
            nextStatus: "payment_pending",
            actorRole: "system",
            message: "The current checkout status is invalid."
        });

        expect(
            checkoutStatus.validateCheckoutStatusTransition("draft", "mystery", "customer")
        ).toEqual({
            isValid: false,
            currentStatus: "draft",
            nextStatus: "",
            actorRole: "customer",
            message: "The next checkout status is invalid."
        });

        expect(
            checkoutStatus.validateCheckoutStatusTransition("draft", "draft", "customer")
        ).toEqual({
            isValid: false,
            currentStatus: "draft",
            nextStatus: "draft",
            actorRole: "customer",
            message: "The checkout is already marked as Checkout Draft."
        });

        expect(
            checkoutStatus.validateCheckoutStatusTransition("cancelled", "payment_pending", "system")
        ).toEqual({
            isValid: false,
            currentStatus: "cancelled",
            nextStatus: "payment_pending",
            actorRole: "system",
            message: "Checkout Cancelled checkouts cannot transition to another status."
        });

        expect(
            checkoutStatus.validateCheckoutStatusTransition("payment_pending", "paid", "customer")
        ).toEqual({
            isValid: false,
            currentStatus: "payment_pending",
            nextStatus: "paid",
            actorRole: "customer",
            message: "Customers cannot move a checkout from Payment Pending to Payment Verified."
        });
    });

    test("attaches the module to a browser-like global scope", () => {
        jest.isolateModules(() => {
            const originalWindow = global.window;

            try {
                global.window = {};
                require("../../../public/shared/checkout/checkout-status.js");

                expect(global.window.checkoutStatus).toBeDefined();
                expect(global.window.checkoutStatus.normalizeCheckoutStatus("order-created"))
                    .toBe("converted");
            } finally {
                if (originalWindow === undefined) {
                    delete global.window;
                } else {
                    global.window = originalWindow;
                }
            }
        });
    });

    test("attaches the module to globalThis when window is unavailable", () => {
        jest.isolateModules(() => {
            const originalWindow = global.window;
            const originalCheckoutStatus = global.checkoutStatus;

            try {
                delete global.window;
                delete global.checkoutStatus;

                require("../../../public/shared/checkout/checkout-status.js");

                expect(global.checkoutStatus).toBeDefined();
                expect(global.checkoutStatus.normalizeCheckoutStatus("payment-failed"))
                    .toBe("payment_failed");
            } finally {
                if (originalWindow === undefined) {
                    delete global.window;
                } else {
                    global.window = originalWindow;
                }

                if (originalCheckoutStatus === undefined) {
                    delete global.checkoutStatus;
                } else {
                    global.checkoutStatus = originalCheckoutStatus;
                }
            }
        });
    });
});
