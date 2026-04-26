const orderStatus = require("../../../public/shared/orders/order-status.js");

describe("shared/orders/order-status.js", () => {
    test("exports canonical order statuses and roles", () => {
        expect(orderStatus.MODULE_NAME).toBe("order-status");
        expect(orderStatus.ORDER_STATUSES.PENDING).toBe("pending");
        expect(orderStatus.ORDER_STATUSES.READY).toBe("ready");
        expect(orderStatus.ORDER_ACTOR_ROLES.CUSTOMER).toBe("customer");
        expect(orderStatus.ORDER_ACTOR_ROLES.VENDOR).toBe("vendor");
    });

    test("normalizes order status aliases into canonical values", () => {
        expect(orderStatus.normalizeOrderStatus(" Order Received ")).toBe("pending");
        expect(orderStatus.normalizeOrderStatus("approved")).toBe("accepted");
        expect(orderStatus.normalizeOrderStatus("in_progress")).toBe("preparing");
        expect(orderStatus.normalizeOrderStatus("ready-for-pickup")).toBe("ready");
        expect(orderStatus.normalizeOrderStatus("Collected")).toBe("completed");
        expect(orderStatus.normalizeOrderStatus("declined")).toBe("rejected");
        expect(orderStatus.normalizeOrderStatus("canceled")).toBe("cancelled");
        expect(orderStatus.normalizeOrderStatus("mystery")).toBe("");
        expect(orderStatus.normalizeOrderStatus("", "ready_for_collection")).toBe("ready");
    });

    test("normalizes actor role aliases", () => {
        expect(orderStatus.normalizeOrderActorRole("student")).toBe("customer");
        expect(orderStatus.normalizeOrderActorRole("shop")).toBe("vendor");
        expect(orderStatus.normalizeOrderActorRole("app")).toBe("system");
        expect(orderStatus.normalizeOrderActorRole("unknown")).toBe("");
    });

    test("returns friendly metadata for known and unknown statuses", () => {
        expect(orderStatus.getOrderStatusLabel("pending")).toBe("Order Received");
        expect(orderStatus.getOrderStatusShortLabel("ready")).toBe("Ready");
        expect(orderStatus.getOrderStatusDescription("completed"))
            .toBe("The order has been collected and the ticket is now closed.");
        expect(orderStatus.getOrderStatusTone("rejected")).toBe("error");
        expect(orderStatus.getOrderStatusActionLabel("ready")).toBe("Mark Ready for Pickup");

        expect(orderStatus.getOrderStatusMetadata("unknown")).toEqual({
            key: "",
            label: "Unknown Status",
            shortLabel: "Unknown",
            description: "The order status is not recognized yet.",
            tone: "info",
            actionLabel: "Update Order"
        });
    });

    test("returns ordered status lists and progress positions", () => {
        expect(orderStatus.getDefaultOrderStatus()).toBe("pending");
        expect(orderStatus.getOrderStatusList()).toEqual([
            "pending",
            "accepted",
            "preparing",
            "ready",
            "completed",
            "rejected",
            "cancelled"
        ]);
        expect(orderStatus.getPrimaryOrderStatusList()).toEqual([
            "pending",
            "accepted",
            "preparing",
            "ready",
            "completed"
        ]);
        expect(orderStatus.getTrackingOrderStatusList()).toEqual([
            "pending",
            "accepted",
            "preparing",
            "ready",
            "completed"
        ]);
        expect(orderStatus.getTerminalOrderStatusList()).toEqual([
            "completed",
            "rejected",
            "cancelled"
        ]);
        expect(orderStatus.getStatusProgressIndex("preparing")).toBe(2);
        expect(orderStatus.getStatusProgressIndex("rejected")).toBe(-1);
    });

    test("identifies known and terminal statuses", () => {
        expect(orderStatus.isKnownOrderStatus("ready for pickup")).toBe(true);
        expect(orderStatus.isKnownOrderStatus("unknown")).toBe(false);
        expect(orderStatus.isTerminalOrderStatus("completed")).toBe(true);
        expect(orderStatus.isTerminalOrderStatus("cancelled")).toBe(true);
        expect(orderStatus.isTerminalOrderStatus("accepted")).toBe(false);
    });

    test("returns allowed next statuses for each actor", () => {
        expect(orderStatus.getAllowedNextStatuses("pending", "vendor")).toEqual([
            "accepted",
            "rejected"
        ]);
        expect(orderStatus.getAllowedNextStatuses("pending", "customer")).toEqual([
            "cancelled"
        ]);
        expect(orderStatus.getAllowedNextStatuses("accepted", "admin")).toEqual([
            "preparing",
            "rejected",
            "cancelled"
        ]);
        expect(orderStatus.getAllowedNextStatuses("completed", "vendor")).toEqual([]);
        expect(orderStatus.getAllowedNextStatuses("unknown", "vendor")).toEqual([]);
        expect(orderStatus.getAllowedNextStatuses("pending", "unknown")).toEqual([]);
    });

    test("validates successful transitions", () => {
        expect(orderStatus.canTransitionOrderStatus("pending", "accepted", "vendor")).toBe(true);
        expect(orderStatus.canTransitionOrderStatus("pending", "cancelled", "customer")).toBe(true);
        expect(orderStatus.canTransitionOrderStatus("ready", "completed", "customer")).toBe(true);
        expect(orderStatus.canTransitionOrderStatus("accepted", "cancelled", "system")).toBe(true);

        expect(
            orderStatus.validateOrderStatusTransition("preparing", "ready", "vendor")
        ).toEqual({
            isValid: true,
            currentStatus: "preparing",
            nextStatus: "ready",
            actorRole: "vendor",
            message: "Vendors can move an order from Preparing to Ready for Pickup."
        });
    });

    test("rejects invalid transitions with helpful reasons", () => {
        expect(
            orderStatus.validateOrderStatusTransition("pending", "pending", "vendor")
        ).toEqual({
            isValid: false,
            currentStatus: "pending",
            nextStatus: "pending",
            actorRole: "vendor",
            message: "The order is already marked as Order Received."
        });

        expect(
            orderStatus.validateOrderStatusTransition("completed", "cancelled", "admin")
        ).toEqual({
            isValid: false,
            currentStatus: "completed",
            nextStatus: "cancelled",
            actorRole: "admin",
            message: "Completed orders cannot transition to another status."
        });

        expect(
            orderStatus.validateOrderStatusTransition("pending", "ready", "vendor")
        ).toEqual({
            isValid: false,
            currentStatus: "pending",
            nextStatus: "ready",
            actorRole: "vendor",
            message: "Vendors cannot move an order from Order Received to Ready for Pickup."
        });

        expect(
            orderStatus.validateOrderStatusTransition("pending", "accepted", "unknown")
        ).toEqual({
            isValid: false,
            currentStatus: "pending",
            nextStatus: "accepted",
            actorRole: "",
            message: "A valid actor role is required before changing order status."
        });

        expect(
            orderStatus.validateOrderStatusTransition("mystery", "accepted", "vendor")
        ).toEqual({
            isValid: false,
            currentStatus: "",
            nextStatus: "accepted",
            actorRole: "vendor",
            message: "The current order status is invalid."
        });

        expect(
            orderStatus.validateOrderStatusTransition("pending", "mystery", "vendor")
        ).toEqual({
            isValid: false,
            currentStatus: "pending",
            nextStatus: "",
            actorRole: "vendor",
            message: "The next order status is invalid."
        });
    });
});
