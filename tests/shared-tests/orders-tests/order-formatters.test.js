const orderFormatters = require("../../../public/shared/orders/order-formatters.js");
const orderStatus = require("../../../public/shared/orders/order-status.js");
const orderModel = require("../../../public/shared/orders/order-model.js");

function createOrderRecord(overrides = {}) {
    return orderModel.createOrderRecord(
        {
            orderId: "order-123456789",
            customerUid: "customer-1",
            customerName: "Tshepo",
            customerEmail: "tshepo@example.com",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            items: [
                {
                    id: "burger",
                    vendorUid: "vendor-1",
                    vendorName: "Campus Bites",
                    name: "Burger",
                    price: 50,
                    quantity: 1
                },
                {
                    id: "juice",
                    vendorUid: "vendor-1",
                    vendorName: "Campus Bites",
                    name: "Juice",
                    price: 25,
                    quantity: 1
                }
            ],
            status: "preparing",
            createdAt: "2026-04-20T10:00:00.000Z",
            updatedAt: "2026-04-20T10:10:00.000Z",
            timeline: [
                {
                    status: "pending",
                    actorRole: "customer",
                    actorUid: "customer-1",
                    actorName: "Tshepo",
                    note: "Placed the order.",
                    at: "2026-04-20T10:00:00.000Z"
                },
                {
                    status: "accepted",
                    actorRole: "vendor",
                    actorUid: "vendor-1",
                    actorName: "Campus Bites",
                    note: "Accepted the order.",
                    at: "2026-04-20T10:05:00.000Z"
                },
                {
                    status: "preparing",
                    actorRole: "vendor",
                    actorUid: "vendor-1",
                    actorName: "Campus Bites",
                    note: "Now preparing.",
                    at: "2026-04-20T10:10:00.000Z"
                }
            ],
            ...overrides
        },
        { orderStatus }
    );
}

describe("shared/orders/order-formatters.js", () => {
    test("exports a real formatter module and resolves dependencies", () => {
        expect(orderFormatters.MODULE_NAME).toBe("order-formatters");
        expect(orderFormatters.resolveOrderStatus(orderStatus)).toBe(orderStatus);
        expect(orderFormatters.resolveOrderModel(orderModel)).toBe(orderModel);
        expect(orderFormatters.normalizeText("  Hello  ")).toBe("Hello");
        expect(orderFormatters.normalizeLowerText("  HeLLo  ")).toBe("hello");
        expect(orderFormatters.normalizeNumber("55.5")).toBe(55.5);
        expect(orderFormatters.normalizeNumber("bad")).toBeNull();
        expect(orderFormatters.normalizePositiveInteger("6", 2)).toBe(6);
        expect(orderFormatters.normalizePositiveInteger("bad", 2)).toBe(2);
        expect(orderFormatters.normalizePositiveInteger("bad", "bad")).toBe(0);

        const originalGlobalOrderStatus = global.orderStatus;
        const originalGlobalOrderModel = global.orderModel;

        global.orderStatus = orderStatus;
        global.orderModel = orderModel;

        expect(orderFormatters.resolveOrderStatus()).toBe(orderStatus);
        expect(orderFormatters.resolveOrderModel()).toBe(orderModel);

        global.orderStatus = originalGlobalOrderStatus;
        global.orderModel = originalGlobalOrderModel;
    });

    test("normalizes order records and converts multiple date shapes", () => {
        const normalized = orderFormatters.normalizeOrderRecord(
            {
                customerUid: "customer-1",
                customerName: "Tshepo",
                customerEmail: "tshepo@example.com",
                vendorUid: "vendor-1",
                vendorName: "Campus Bites",
                items: [
                    {
                        id: "burger",
                        vendorUid: "vendor-1",
                        vendorName: "Campus Bites",
                        name: "Burger",
                        price: 50,
                        quantity: 1
                    }
                ],
                status: "approved",
                createdAt: "2026-04-20T10:00:00.000Z",
                updatedAt: "2026-04-20T10:00:00.000Z"
            },
            {
                orderStatus,
                orderModel
            }
        );

        expect(normalized.status).toBe("accepted");
        expect(normalized.itemCount).toBe(1);

        const dateValue = new Date("2026-04-20T10:00:00.000Z");
        expect(orderFormatters.toDateInstance(dateValue)).toEqual(dateValue);
        expect(
            orderFormatters.toDateInstance("2026-04-20T10:00:00.000Z").toISOString()
        ).toBe("2026-04-20T10:00:00.000Z");
        expect(
            orderFormatters.toDateInstance({
                toDate: () => new Date("2026-04-20T10:00:00.000Z")
            }).toISOString()
        ).toBe("2026-04-20T10:00:00.000Z");
        expect(
            orderFormatters.toDateInstance({
                seconds: 1713607200,
                nanoseconds: 0
            }).toISOString()
        ).toBe("2024-04-20T10:00:00.000Z");
        expect(orderFormatters.toDateInstance("not-a-date")).toBeNull();
    });

    test("formats grouped numbers and currency values", () => {
        expect(orderFormatters.formatGroupedNumber(1250.5)).toBe("1,250.50");
        expect(orderFormatters.formatGroupedNumber(-50, { decimals: 0 })).toBe("-50");
        expect(orderFormatters.formatGroupedNumber("bad")).toBe("");

        expect(orderFormatters.formatCurrency(1250.5)).toBe("R1,250.50");
        expect(orderFormatters.formatCurrency(-20)).toBe("R-20.00");
        expect(orderFormatters.formatCurrency("bad")).toBe("R0.00");
        expect(
            orderFormatters.formatCurrency("bad", {
                emptyValue: "-"
            })
        ).toBe("-");
        expect(
            orderFormatters.formatCurrency(45, {
                symbol: "$",
                decimals: 0
            })
        ).toBe("$45");
    });

    test("formats item counts, IDs, actor roles, and status wrappers", () => {
        expect(orderFormatters.formatItemCount(1)).toBe("1 item");
        expect(orderFormatters.formatItemCount(2)).toBe("2 items");
        expect(
            orderFormatters.formatItemCount(3, {
                singularLabel: "meal",
                pluralLabel: "meals"
            })
        ).toBe("3 meals");

        expect(orderFormatters.formatOrderId("order-123456789")).toBe("Order #456789");
        expect(
            orderFormatters.formatOrderId("abc", {
                prefix: ""
            })
        ).toBe("#abc");
        expect(orderFormatters.formatOrderId("")).toBe("Order");

        expect(orderFormatters.formatActorRole("customer")).toBe("Customer");
        expect(orderFormatters.formatActorRole("shop")).toBe("Vendor");
        expect(orderFormatters.formatActorRole("admin")).toBe("Admin");
        expect(orderFormatters.formatActorRole("app")).toBe("System");
        expect(orderFormatters.formatActorRole("random")).toBe("Someone");

        expect(orderFormatters.getOrderStatusLabel("ready", orderStatus)).toBe("Ready for Pickup");
        expect(orderFormatters.getOrderStatusDescription("ready", orderStatus)).toMatch(/ready/i);
        expect(orderFormatters.getOrderStatusTone("ready", orderStatus)).toBe("success");
        expect(orderFormatters.getOrderStatusActionLabel("ready", orderStatus)).toBe(
            "Mark Ready for Pickup"
        );
        expect(orderFormatters.getOrderStatusLabel("", null)).toBe("Unknown Status");
        expect(orderFormatters.getOrderStatusDescription("", null)).toBe(
            "The order status is not recognized yet."
        );
        expect(orderFormatters.getOrderStatusTone("", null)).toBe("info");
        expect(orderFormatters.getOrderStatusActionLabel("", null)).toBe("Update Order");
    });

    test("formats absolute and relative dates predictably", () => {
        expect(
            orderFormatters.formatDateTime("2026-04-20T10:00:00.000Z", {
                timeZone: "UTC",
                locale: "en-ZA"
            })
        ).toContain("2026");
        expect(
            orderFormatters.formatDateTime("2026-04-20T10:00:00.000Z", {
                timeZone: "UTC",
                includeTime: false
            })
        ).toContain("2026");
        expect(orderFormatters.formatDateTime("bad-date")).toBe("Unknown time");

        expect(
            orderFormatters.formatRelativeTime("2026-04-20T10:00:20.000Z", {
                now: "2026-04-20T10:00:00.000Z"
            })
        ).toBe("In moments");
        expect(
            orderFormatters.formatRelativeTime("2026-04-20T09:59:50.000Z", {
                now: "2026-04-20T10:00:00.000Z"
            })
        ).toBe("Just now");
        expect(
            orderFormatters.formatRelativeTime("2026-04-20T10:05:00.000Z", {
                now: "2026-04-20T10:00:00.000Z"
            })
        ).toBe("In 5 min");
        expect(
            orderFormatters.formatRelativeTime("2026-04-20T10:01:00.000Z", {
                now: "2026-04-20T10:00:00.000Z"
            })
        ).toBe("In 1 min");
        expect(
            orderFormatters.formatRelativeTime("2026-04-20T08:00:00.000Z", {
                now: "2026-04-20T10:00:00.000Z"
            })
        ).toBe("2 hr ago");
        expect(
            orderFormatters.formatRelativeTime("2026-04-20T11:00:00.000Z", {
                now: "2026-04-20T10:00:00.000Z"
            })
        ).toBe("In 1 hr");
        expect(
            orderFormatters.formatRelativeTime("2026-04-21T10:00:00.000Z", {
                now: "2026-04-20T10:00:00.000Z"
            })
        ).toBe("Tomorrow");
        expect(
            orderFormatters.formatRelativeTime("2026-04-23T10:00:00.000Z", {
                now: "2026-04-20T10:00:00.000Z"
            })
        ).toBe("In 3 days");
        expect(
            orderFormatters.formatRelativeTime("2026-04-17T10:00:00.000Z", {
                now: "2026-04-20T10:00:00.000Z"
            })
        ).toBe("3 days ago");
        expect(
            orderFormatters.formatRelativeTime("2026-04-10T10:00:00.000Z", {
                now: "2026-04-20T10:00:00.000Z",
                timeZone: "UTC"
            })
        ).toContain("2026");
        expect(orderFormatters.formatRelativeTime("bad-date")).toBe("Unknown time");
    });

    test("falls back to ISO-like date formatting when Intl is unavailable", () => {
        const originalIntl = global.Intl;

        try {
            global.Intl = undefined;

            expect(
                orderFormatters.formatDateTime("2026-04-20T10:00:00.000Z")
            ).toBe("2026-04-20 10:00");
            expect(
                orderFormatters.formatDateTime("2026-04-20T10:00:00.000Z", {
                    includeTime: false
                })
            ).toBe("2026-04-20");
        } finally {
            global.Intl = originalIntl;
        }
    });

    test("formats order headline, total, and summary for different viewers", () => {
        const orderRecord = createOrderRecord();

        expect(
            orderFormatters.formatOrderHeadline(orderRecord, {
                orderStatus,
                orderModel,
                viewerRole: "customer"
            })
        ).toBe("Campus Bites");

        expect(
            orderFormatters.formatOrderHeadline(orderRecord, {
                orderStatus,
                orderModel,
                viewerRole: "vendor"
            })
        ).toBe("Tshepo");

        expect(
            orderFormatters.formatOrderHeadline(
                {
                    orderId: "order-1"
                },
                {}
            )
        ).toBe("Order #order-1");

        expect(
            orderFormatters.formatOrderTotal(orderRecord, {
                orderStatus,
                orderModel
            })
        ).toBe("R75.00");

        expect(
            orderFormatters.formatOrderSummary(orderRecord, {
                orderStatus,
                orderModel,
                viewerRole: "customer",
                includeStatus: true
            })
        ).toBe("Campus Bites • 2 items • R75.00 • Preparing");
    });

    test("builds tracking steps for active and terminal orders", () => {
        const activeSteps = orderFormatters.buildTrackingSteps(createOrderRecord(), {
            orderStatus,
            orderModel
        });

        expect(activeSteps).toEqual([
            {
                status: "pending",
                label: "Order Received",
                description: "The order was placed and is waiting for the vendor to respond.",
                tone: "info",
                state: "complete",
                isCurrent: false,
                isComplete: true,
                isUpcoming: false,
                isTerminal: false
            },
            {
                status: "accepted",
                label: "Accepted",
                description: "The vendor accepted the order and will start working on it soon.",
                tone: "info",
                state: "complete",
                isCurrent: false,
                isComplete: true,
                isUpcoming: false,
                isTerminal: false
            },
            {
                status: "preparing",
                label: "Preparing",
                description: "The vendor is actively preparing the order.",
                tone: "loading",
                state: "current",
                isCurrent: true,
                isComplete: false,
                isUpcoming: false,
                isTerminal: false
            },
            {
                status: "ready",
                label: "Ready for Pickup",
                description: "The order is ready for collection.",
                tone: "success",
                state: "upcoming",
                isCurrent: false,
                isComplete: false,
                isUpcoming: true,
                isTerminal: false
            },
            {
                status: "completed",
                label: "Completed",
                description: "The order has been collected and the ticket is now closed.",
                tone: "success",
                state: "upcoming",
                isCurrent: false,
                isComplete: false,
                isUpcoming: true,
                isTerminal: false
            }
        ]);

        const rejectedSteps = orderFormatters.buildTrackingSteps(
            createOrderRecord({
                status: "rejected",
                timeline: [
                    {
                        status: "pending",
                        actorRole: "customer",
                        at: "2026-04-20T10:00:00.000Z"
                    }
                ]
            }),
            {
                orderStatus,
                orderModel
            }
        );

        expect(rejectedSteps[0].state).toBe("complete");
        expect(rejectedSteps[1].state).toBe("upcoming");
        expect(rejectedSteps[rejectedSteps.length - 1]).toEqual({
            status: "rejected",
            label: "Rejected",
            description: "The vendor declined the order and it will not be prepared.",
            tone: "error",
            state: "current",
            isCurrent: true,
            isComplete: false,
            isUpcoming: false,
            isTerminal: true
        });

        expect(
            orderFormatters.buildTrackingSteps("completed", {
                orderStatus
            })[4].state
        ).toBe("current");
    });

    test("formats timeline entries and full timelines", () => {
        const entry = orderFormatters.formatTimelineEntry(
            {
                status: "ready",
                actorRole: "vendor",
                actorName: "Campus Bites",
                note: "Collect now.",
                at: "2026-04-20T10:30:00.000Z"
            },
            {
                orderStatus,
                timeZone: "UTC",
                now: "2026-04-20T10:00:00.000Z"
            }
        );

        expect(entry).toEqual({
            status: "ready",
            label: "Ready for Pickup",
            description: "The order is ready for collection.",
            tone: "success",
            actorRole: "vendor",
            actorName: "Campus Bites",
            actorLabel: "Campus Bites",
            note: "Collect now.",
            at: "2026-04-20T10:30:00.000Z",
            timestampText: expect.stringContaining("2026"),
            relativeText: "In 30 min"
        });

        const namelessEntry = orderFormatters.formatTimelineEntry(
            {
                status: "",
                actorRole: "",
                timestamp: "bad-date"
            },
            {}
        );

        expect(namelessEntry.actorLabel).toBe("System");
        expect(namelessEntry.status).toBe("pending");
        expect(namelessEntry.timestampText).toBe("Unknown time");

        const formattedTimeline = orderFormatters.formatTimeline(createOrderRecord(), {
            orderStatus,
            orderModel,
            timeZone: "UTC",
            now: "2026-04-20T10:00:00.000Z"
        });

        expect(formattedTimeline).toHaveLength(3);
        expect(formattedTimeline[0].label).toBe("Order Received");
        expect(
            orderFormatters.formatTimeline(createOrderRecord(), {
                orderStatus,
                orderModel,
                reverse: true
            })[0].status
        ).toBe("preparing");
        expect(orderFormatters.formatTimeline({}, {})).toEqual([]);
    });

    test("handles formatter fallbacks when shared order helpers are unavailable", () => {
        const originalGlobalOrderStatus = global.orderStatus;
        const originalGlobalOrderModel = global.orderModel;

        delete global.orderStatus;
        delete global.orderModel;

        jest.resetModules();
        jest.doMock("../../../public/shared/orders/order-status.js", () => ({}));
        jest.doMock("../../../public/shared/orders/order-model.js", () => ({}));

        let isolatedOrderFormatters;

        jest.isolateModules(() => {
            isolatedOrderFormatters = require("../../../public/shared/orders/order-formatters.js");
        });

        expect(isolatedOrderFormatters.resolveOrderStatus()).toBeNull();
        expect(isolatedOrderFormatters.resolveOrderModel()).toBeNull();
        expect(
            isolatedOrderFormatters.normalizeOrderRecord(
                {
                    orderId: "raw-order"
                },
                {}
            )
        ).toEqual({
            orderId: "raw-order"
        });
        expect(isolatedOrderFormatters.getOrderStatusLabel("accepted")).toBe("accepted");
        expect(isolatedOrderFormatters.getOrderStatusDescription("accepted")).toBe(
            "The order status is still being resolved."
        );
        expect(isolatedOrderFormatters.getOrderStatusTone("accepted")).toBe("info");
        expect(isolatedOrderFormatters.getOrderStatusActionLabel("accepted")).toBe("Update Order");

        jest.dontMock("../../../public/shared/orders/order-status.js");
        jest.dontMock("../../../public/shared/orders/order-model.js");
        jest.resetModules();

        global.orderStatus = originalGlobalOrderStatus;
        global.orderModel = originalGlobalOrderModel;
    });
});
