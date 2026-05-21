const refundStatus = require("../../../public/shared/payments/refund-status.js");

describe("shared/payments/refund-status.js", () => {
    test("exports refund status constants and list helpers", () => {
        expect(refundStatus.MODULE_NAME).toBe("refund-status");
        expect(refundStatus.REFUND_STATUSES).toEqual({
            NOT_REQUESTED: "not_requested",
            REQUESTED: "requested",
            PROCESSING: "processing",
            REFUNDED: "refunded",
            FAILED: "failed",
            CANCELLED: "cancelled"
        });
        expect(refundStatus.getDefaultRefundStatus()).toBe("not_requested");
        expect(refundStatus.getRefundStatusList()).toEqual([
            "not_requested",
            "requested",
            "processing",
            "refunded",
            "failed",
            "cancelled"
        ]);
        expect(refundStatus.getActiveRefundStatusList()).toEqual([
            "requested",
            "processing"
        ]);
        expect(refundStatus.getTerminalRefundStatusList()).toEqual([
            "refunded",
            "cancelled"
        ]);
        expect(refundStatus.getRetryableRefundStatusList()).toEqual(["failed"]);
    });

    test("normalizes refund status aliases", () => {
        expect(refundStatus.normalizeRefundStatus("NOT_REQUESTED")).toBe("not_requested");
        expect(refundStatus.normalizeRefundStatus(" no refund ")).toBe("not_requested");
        expect(refundStatus.normalizeRefundStatus("refund-pending")).toBe("requested");
        expect(refundStatus.normalizeRefundStatus("awaiting refund")).toBe("requested");
        expect(refundStatus.normalizeRefundStatus("provider_processing")).toBe("processing");
        expect(refundStatus.normalizeRefundStatus("initiated")).toBe("processing");
        expect(refundStatus.normalizeRefundStatus("processed")).toBe("refunded");
        expect(refundStatus.normalizeRefundStatus("successful")).toBe("refunded");
        expect(refundStatus.normalizeRefundStatus("provider failed")).toBe("failed");
        expect(refundStatus.normalizeRefundStatus("voided")).toBe("cancelled");
        expect(refundStatus.normalizeRefundStatus("unknown")).toBe("");
        expect(refundStatus.normalizeRefundStatus("unknown", "failed")).toBe("failed");
    });

    test("normalizes status keys and text safely", () => {
        expect(refundStatus.normalizeText("  Refunded  ")).toBe("Refunded");
        expect(refundStatus.normalizeText(null)).toBe("");
        expect(refundStatus.normalizeLowerText(" REFUND PENDING ")).toBe("refund pending");
        expect(refundStatus.normalizeStatusKey("Refund Pending")).toBe("refundpending");
        expect(refundStatus.normalizeStatusKey("refund_pending")).toBe("refundpending");
        expect(refundStatus.normalizeStatusKey("refund-pending")).toBe("refundpending");
    });

    test("identifies known, active, terminal, retryable, and specific statuses", () => {
        expect(refundStatus.isKnownRefundStatus("processed")).toBe(true);
        expect(refundStatus.isKnownRefundStatus("mystery")).toBe(false);

        expect(refundStatus.isActiveRefundStatus("requested")).toBe(true);
        expect(refundStatus.isActiveRefundStatus("processing")).toBe(true);
        expect(refundStatus.isActiveRefundStatus("refunded")).toBe(false);

        expect(refundStatus.isTerminalRefundStatus("refunded")).toBe(true);
        expect(refundStatus.isTerminalRefundStatus("cancelled")).toBe(true);
        expect(refundStatus.isTerminalRefundStatus("failed")).toBe(false);

        expect(refundStatus.isRetryableRefundStatus("failed")).toBe(true);
        expect(refundStatus.isRetryableRefundStatus("requested")).toBe(false);

        expect(refundStatus.isRefundRequested("pending")).toBe(true);
        expect(refundStatus.isRefundProcessing("submitted")).toBe(true);
        expect(refundStatus.isRefunded("success")).toBe(true);
        expect(refundStatus.isRefundFailed("declined")).toBe(true);
    });

    test("returns metadata and label helpers for known statuses", () => {
        expect(refundStatus.getRefundStatusMetadata("requested")).toEqual({
            key: "requested",
            label: "Refund Started",
            shortLabel: "Started",
            description: "The automatic refund has started and is waiting to be sent to the provider.",
            tone: "loading",
            actionLabel: "Continue Refund"
        });
        expect(refundStatus.getRefundStatusLabel("processing")).toBe("Refund Processing");
        expect(refundStatus.getRefundStatusShortLabel("not_requested")).toBe("No Refund");
        expect(refundStatus.getRefundStatusDescription("refunded")).toBe(
            "The customer has been refunded."
        );
        expect(refundStatus.getRefundStatusTone("failed")).toBe("error");
        expect(refundStatus.getRefundStatusActionLabel("failed")).toBe("Retry Refund");
    });

    test("returns safe metadata for unknown statuses", () => {
        expect(refundStatus.getRefundStatusMetadata("unknown")).toEqual({
            key: "",
            label: "Unknown Refund Status",
            shortLabel: "Unknown",
            description: "The refund status is not recognized yet.",
            tone: "neutral",
            actionLabel: "Review Refund"
        });
        expect(refundStatus.getRefundStatusLabel("unknown")).toBe("Unknown Refund Status");
    });

    test("returns allowed next refund statuses", () => {
        expect(refundStatus.getAllowedNextRefundStatuses("not_requested")).toEqual([
            "requested"
        ]);
        expect(refundStatus.getAllowedNextRefundStatuses("requested")).toEqual([
            "processing",
            "refunded",
            "failed",
            "cancelled"
        ]);
        expect(refundStatus.getAllowedNextRefundStatuses("processing")).toEqual([
            "refunded",
            "failed"
        ]);
        expect(refundStatus.getAllowedNextRefundStatuses("failed")).toEqual([
            "requested",
            "processing",
            "cancelled"
        ]);
        expect(refundStatus.getAllowedNextRefundStatuses("refunded")).toEqual([]);
        expect(refundStatus.getAllowedNextRefundStatuses("cancelled")).toEqual([]);
        expect(refundStatus.getAllowedNextRefundStatuses("unknown")).toEqual([]);
    });

    test("validates allowed refund status transitions", () => {
        expect(refundStatus.canTransitionRefundStatus("not_requested", "requested")).toBe(true);
        expect(refundStatus.canTransitionRefundStatus("requested", "processing")).toBe(true);
        expect(refundStatus.canTransitionRefundStatus("requested", "refunded")).toBe(true);
        expect(refundStatus.canTransitionRefundStatus("requested", "failed")).toBe(true);
        expect(refundStatus.canTransitionRefundStatus("requested", "cancelled")).toBe(true);
        expect(refundStatus.canTransitionRefundStatus("processing", "refunded")).toBe(true);
        expect(refundStatus.canTransitionRefundStatus("processing", "failed")).toBe(true);
        expect(refundStatus.canTransitionRefundStatus("failed", "requested")).toBe(true);
        expect(refundStatus.canTransitionRefundStatus("failed", "processing")).toBe(true);

        expect(refundStatus.validateRefundStatusTransition("requested", "processing")).toEqual({
            isValid: true,
            currentStatus: "requested",
            nextStatus: "processing",
            message: "Refunds can move from Refund Started to Refund Processing."
        });
    });

    test("rejects invalid refund status transitions", () => {
        expect(refundStatus.validateRefundStatusTransition("unknown", "requested")).toEqual({
            isValid: false,
            currentStatus: "",
            nextStatus: "requested",
            message: "The current refund status is invalid."
        });
        expect(refundStatus.validateRefundStatusTransition("requested", "unknown")).toEqual({
            isValid: false,
            currentStatus: "requested",
            nextStatus: "",
            message: "The next refund status is invalid."
        });
        expect(refundStatus.validateRefundStatusTransition("processing", "processing")).toEqual({
            isValid: false,
            currentStatus: "processing",
            nextStatus: "processing",
            message: "The refund is already marked as Refund Processing."
        });
        expect(refundStatus.validateRefundStatusTransition("refunded", "failed")).toEqual({
            isValid: false,
            currentStatus: "refunded",
            nextStatus: "failed",
            message: "Refunded refunds cannot transition to another status."
        });
        expect(refundStatus.validateRefundStatusTransition("not_requested", "refunded")).toEqual({
            isValid: false,
            currentStatus: "not_requested",
            nextStatus: "refunded",
            message: "Refunds cannot move from Refund Not Requested to Refunded."
        });
    });

    test("attaches the module to a browser-like global scope", () => {
        jest.isolateModules(() => {
            const originalWindow = global.window;

            try {
                global.window = {};
                require("../../../public/shared/payments/refund-status.js");

                expect(global.window.refundStatus).toBeDefined();
                expect(global.window.refundStatus.normalizeRefundStatus("processed")).toBe("refunded");
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
