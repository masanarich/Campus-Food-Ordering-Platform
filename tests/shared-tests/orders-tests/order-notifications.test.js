const orderNotifications = require("../../../public/shared/orders/order-notifications.js");
const orderStatus = require("../../../public/shared/orders/order-status.js");
const orderModel = require("../../../public/shared/orders/order-model.js");
const orderFormatters = require("../../../public/shared/orders/order-formatters.js");

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
            status: "pending",
            createdAt: "2026-04-20T10:00:00.000Z",
            updatedAt: "2026-04-20T10:00:00.000Z",
            ...overrides
        },
        { orderStatus }
    );
}

describe("shared/orders/order-notifications.js", () => {
    test("exports a real notification module and resolves dependencies", () => {
        expect(orderNotifications.MODULE_NAME).toBe("order-notifications");
        expect(orderNotifications.ORDER_NOTIFICATION_TYPES.ORDER_READY).toBe("order_ready");
        expect(orderNotifications.ORDER_NOTIFICATION_CHANNELS.EMAIL).toBe("email");
        expect(orderNotifications.resolveOrderStatus(orderStatus)).toBe(orderStatus);
        expect(orderNotifications.resolveOrderModel(orderModel)).toBe(orderModel);
        expect(orderNotifications.resolveOrderFormatters(orderFormatters)).toBe(orderFormatters);
        expect(orderNotifications.normalizeText("  Hello  ")).toBe("Hello");
        expect(orderNotifications.normalizeLowerText("  HeLLo  ")).toBe("hello");
        expect(orderNotifications.normalizeNotificationKey(" Order Ready ")).toBe("orderready");
        expect(orderNotifications.isLikelyEmail("tshepo@example.com")).toBe(true);
        expect(orderNotifications.isLikelyEmail("not-an-email")).toBe(false);

        const originalGlobalOrderStatus = global.orderStatus;
        const originalGlobalOrderModel = global.orderModel;
        const originalGlobalOrderFormatters = global.orderFormatters;

        global.orderStatus = orderStatus;
        global.orderModel = orderModel;
        global.orderFormatters = orderFormatters;

        expect(orderNotifications.resolveOrderStatus()).toBe(orderStatus);
        expect(orderNotifications.resolveOrderModel()).toBe(orderModel);
        expect(orderNotifications.resolveOrderFormatters()).toBe(orderFormatters);

        global.orderStatus = originalGlobalOrderStatus;
        global.orderModel = originalGlobalOrderModel;
        global.orderFormatters = originalGlobalOrderFormatters;
    });

    test("normalizes notification types and channels", () => {
        expect(orderNotifications.normalizeNotificationType("placed")).toBe("order_placed");
        expect(orderNotifications.normalizeNotificationType("ready for pickup")).toBe("order_ready");
        expect(
            orderNotifications.normalizeNotificationType("", "collection confirmed")
        ).toBe("collection_confirmed");
        expect(orderNotifications.normalizeNotificationType("unknown")).toBe("");

        expect(orderNotifications.normalizeNotificationChannel("in app")).toBe("in_app");
        expect(orderNotifications.normalizeNotificationChannel("mail")).toBe("email");
        expect(orderNotifications.normalizeNotificationChannel("unknown")).toBe("");
    });

    test("maps statuses to notification types and infers event types", () => {
        expect(orderNotifications.getNotificationTypeForStatus("pending", orderStatus)).toBe(
            "order_placed"
        );
        expect(orderNotifications.getNotificationTypeForStatus("accepted", orderStatus)).toBe(
            "order_accepted"
        );
        expect(orderNotifications.getNotificationTypeForStatus("preparing", orderStatus)).toBe(
            "order_preparing"
        );
        expect(orderNotifications.getNotificationTypeForStatus("ready", orderStatus)).toBe(
            "order_ready"
        );
        expect(orderNotifications.getNotificationTypeForStatus("completed", orderStatus)).toBe(
            "order_completed"
        );
        expect(orderNotifications.getNotificationTypeForStatus("rejected", orderStatus)).toBe(
            "order_rejected"
        );
        expect(orderNotifications.getNotificationTypeForStatus("cancelled", orderStatus)).toBe(
            "order_cancelled"
        );
        expect(orderNotifications.getNotificationTypeForStatus("mystery", orderStatus)).toBe(
            "order_status_updated"
        );

        const pendingOrder = createOrderRecord();
        const acceptedOrder = createOrderRecord({
            status: "accepted",
            timeline: [
                {
                    status: "pending",
                    actorRole: "customer",
                    at: "2026-04-20T10:00:00.000Z"
                },
                {
                    status: "accepted",
                    actorRole: "vendor",
                    at: "2026-04-20T10:05:00.000Z"
                }
            ],
            updatedAt: "2026-04-20T10:05:00.000Z"
        });
        const collectionConfirmedOrder = createOrderRecord({
            status: "ready",
            customerConfirmedCollected: true,
            timeline: [
                {
                    status: "pending",
                    actorRole: "customer",
                    at: "2026-04-20T10:00:00.000Z"
                },
                {
                    status: "accepted",
                    actorRole: "vendor",
                    at: "2026-04-20T10:05:00.000Z"
                },
                {
                    status: "preparing",
                    actorRole: "vendor",
                    at: "2026-04-20T10:10:00.000Z"
                },
                {
                    status: "ready",
                    actorRole: "vendor",
                    at: "2026-04-20T10:20:00.000Z"
                }
            ],
            updatedAt: "2026-04-20T10:25:00.000Z"
        });

        expect(
            orderNotifications.inferNotificationType(pendingOrder, {
                orderStatus,
                orderModel
            })
        ).toBe("order_placed");
        expect(
            orderNotifications.inferNotificationType(acceptedOrder, {
                orderStatus,
                orderModel,
                previousOrder: pendingOrder
            })
        ).toBe("order_accepted");
        expect(
            orderNotifications.inferNotificationType(collectionConfirmedOrder, {
                orderStatus,
                orderModel,
                previousOrder: createOrderRecord({
                    status: "ready",
                    customerConfirmedCollected: false,
                    timeline: collectionConfirmedOrder.timeline,
                    updatedAt: "2026-04-20T10:20:00.000Z"
                })
            })
        ).toBe("collection_confirmed");
        expect(
            orderNotifications.inferNotificationType(acceptedOrder, {
                orderStatus,
                orderModel,
                previousOrder: acceptedOrder,
                type: "updated"
            })
        ).toBe("order_status_updated");
        expect(
            orderNotifications.inferNotificationType(acceptedOrder, {
                orderStatus,
                orderModel,
                previousOrder: createOrderRecord({
                    status: "accepted",
                    timeline: acceptedOrder.timeline,
                    updatedAt: "2026-04-20T10:05:00.000Z"
                })
            })
        ).toBe("order_status_updated");
    });

    test("creates recipient profiles, action paths, and delivery channels", () => {
        const orderRecord = createOrderRecord();

        expect(
            orderNotifications.createRecipientProfile("customer", orderRecord, {
                orderStatus,
                orderModel
            })
        ).toEqual({
            recipientUid: "customer-1",
            recipientRole: "customer",
            recipientName: "Tshepo",
            recipientEmail: "tshepo@example.com"
        });

        expect(
            orderNotifications.createRecipientProfile("vendor", orderRecord, {
                orderStatus,
                orderModel,
                vendorEmail: "vendor@example.com"
            })
        ).toEqual({
            recipientUid: "vendor-1",
            recipientRole: "vendor",
            recipientName: "Campus Bites",
            recipientEmail: "vendor@example.com"
        });

        expect(
            orderNotifications.createRecipientProfile("unknown", orderRecord, {
                orderStatus,
                orderModel
            })
        ).toEqual({
            recipientUid: "",
            recipientRole: "",
            recipientName: "",
            recipientEmail: ""
        });

        expect(
            orderNotifications.buildOrderActionPath("customer", "order-123", {
                orderStatus
            })
        ).toBe("customer/order-tracking/order-detail.html?orderId=order-123");
        expect(
            orderNotifications.buildOrderActionPath("vendor", "order-123", {
                orderStatus
            })
        ).toBe("vendor/order-management/order-detail.html?orderId=order-123");
        expect(
            orderNotifications.buildOrderActionPath("unknown", "order-123", {
                orderStatus
            })
        ).toBe("index.html?orderId=order-123");
        expect(
            orderNotifications.buildOrderActionPath("customer", "", {
                emptyActionPath: "none"
            })
        ).toBe("none");

        expect(
            orderNotifications.buildDeliveryChannels(
                {
                    recipientEmail: "tshepo@example.com"
                },
                {
                    includeEmail: true,
                    channels: ["in app", "mail"]
                }
            )
        ).toEqual(["in_app", "email"]);

        expect(
            orderNotifications.buildDeliveryChannels(
                {
                    recipientEmail: "not-an-email"
                },
                {
                    includeInApp: false,
                    includeEmail: true
                }
            )
        ).toEqual([]);
    });

    test("selects recipients for different notification types", () => {
        const orderRecord = createOrderRecord();

        expect(
            orderNotifications.getNotificationRecipients(orderRecord, {
                orderStatus,
                orderModel,
                vendorEmail: "vendor@example.com",
                type: "order placed"
            })
        ).toEqual([
            {
                recipientUid: "customer-1",
                recipientRole: "customer",
                recipientName: "Tshepo",
                recipientEmail: "tshepo@example.com"
            },
            {
                recipientUid: "vendor-1",
                recipientRole: "vendor",
                recipientName: "Campus Bites",
                recipientEmail: "vendor@example.com"
            }
        ]);

        expect(
            orderNotifications.getNotificationRecipients(
                createOrderRecord({
                    status: "ready"
                }),
                {
                    orderStatus,
                    orderModel,
                    type: "collection confirmed",
                    actorRole: "customer",
                    vendorEmail: "vendor@example.com"
                }
            )
        ).toEqual([
            {
                recipientUid: "vendor-1",
                recipientRole: "vendor",
                recipientName: "Campus Bites",
                recipientEmail: "vendor@example.com"
            }
        ]);

        expect(
            orderNotifications.getNotificationRecipients(orderRecord, {
                orderStatus,
                orderModel,
                type: "updated",
                actorRole: "vendor"
            })
        ).toEqual([
            {
                recipientUid: "customer-1",
                recipientRole: "customer",
                recipientName: "Tshepo",
                recipientEmail: "tshepo@example.com"
            }
        ]);

        expect(
            orderNotifications.getNotificationRecipients(
                createOrderRecord({
                    customerUid: "",
                    customerName: "",
                    customerEmail: ""
                }),
                {
                    orderStatus,
                    orderModel,
                    type: "accepted"
                }
            )
        ).toEqual([]);
    });

    test("creates notification context, titles, messages, and email content", () => {
        const acceptedOrder = createOrderRecord({
            status: "accepted",
            timeline: [
                {
                    status: "pending",
                    actorRole: "customer",
                    at: "2026-04-20T10:00:00.000Z"
                },
                {
                    status: "accepted",
                    actorRole: "vendor",
                    at: "2026-04-20T10:05:00.000Z"
                }
            ],
            updatedAt: "2026-04-20T10:05:00.000Z"
        });
        const vendorRecipient = {
            recipientUid: "vendor-1",
            recipientRole: "vendor",
            recipientName: "Campus Bites",
            recipientEmail: "vendor@example.com"
        };
        const vendorPlacedContext = orderNotifications.createNotificationContext(
            createOrderRecord(),
            {
                orderStatus,
                orderModel,
                orderFormatters,
                recipient: vendorRecipient,
                actorRole: "customer",
                actorName: "Tshepo",
                vendorEmail: "vendor@example.com"
            }
        );

        expect(vendorPlacedContext.type).toBe("order_placed");
        expect(vendorPlacedContext.formattedOrderId).toBe("Order #456789");
        expect(vendorPlacedContext.totalText).toBe("R75.00");
        expect(vendorPlacedContext.itemCountText).toBe("2 items");
        expect(vendorPlacedContext.actionPath).toBe(
            "vendor/order-management/order-detail.html?orderId=order-123456789"
        );

        expect(
            orderNotifications.createNotificationTitle("order_placed", vendorPlacedContext)
        ).toBe("New Order Received");
        expect(
            orderNotifications.createNotificationMessage("order_placed", vendorPlacedContext)
        ).toBe("Tshepo placed Order #456789 with 2 items for R75.00.");

        const customerAcceptedContext = orderNotifications.createNotificationContext(
            acceptedOrder,
            {
                orderStatus,
                orderModel,
                orderFormatters,
                previousOrder: createOrderRecord(),
                recipientRole: "customer",
                actorRole: "vendor",
                actorName: "Campus Bites"
            }
        );

        expect(
            orderNotifications.createNotificationTitle("order_accepted", customerAcceptedContext)
        ).toBe("Order Accepted");
        expect(
            orderNotifications.createNotificationMessage("order_accepted", customerAcceptedContext)
        ).toBe("Campus Bites accepted Order #456789.");
        expect(
            orderNotifications.createEmailSubject("order_accepted", customerAcceptedContext)
        ).toBe("[Campus Food] Order Accepted - Order #456789");
        expect(
            orderNotifications.createEmailBody("order_accepted", customerAcceptedContext)
        ).toContain("Open: customer/order-tracking/order-detail.html?orderId=order-123456789");

        const genericContext = {
            formattedOrderId: "Order #ABC",
            previousStatusLabel: "Accepted",
            currentStatusLabel: "Preparing"
        };

        expect(
            orderNotifications.createNotificationTitle("updated", genericContext)
        ).toBe("Order Updated");
        expect(
            orderNotifications.createNotificationMessage("updated", genericContext)
        ).toBe("Order #ABC moved from Accepted to Preparing.");
    });

    test("builds individual notification records with email-ready payloads", () => {
        const readyOrder = createOrderRecord({
            status: "ready",
            timeline: [
                {
                    status: "pending",
                    actorRole: "customer",
                    at: "2026-04-20T10:00:00.000Z"
                },
                {
                    status: "accepted",
                    actorRole: "vendor",
                    at: "2026-04-20T10:05:00.000Z"
                },
                {
                    status: "preparing",
                    actorRole: "vendor",
                    at: "2026-04-20T10:10:00.000Z"
                },
                {
                    status: "ready",
                    actorRole: "vendor",
                    at: "2026-04-20T10:20:00.000Z"
                }
            ],
            updatedAt: "2026-04-20T10:20:00.000Z"
        });

        expect(
            orderNotifications.buildNotificationRecord(readyOrder, {
                orderStatus,
                orderModel,
                orderFormatters,
                recipientRole: "customer",
                actorRole: "vendor",
                actorName: "Campus Bites",
                includeEmail: true,
                createdAt: "2026-04-20T10:20:00.000Z"
            })
        ).toEqual({
            notificationId: "",
            recipientUid: "customer-1",
            recipientRole: "customer",
            recipientName: "Tshepo",
            recipientEmail: "tshepo@example.com",
            orderId: "order-123456789",
            type: "order_ready",
            title: "Ready for Pickup",
            message: "Campus Bites marked Order #456789 as ready for pickup.",
            read: false,
            createdAt: "2026-04-20T10:20:00.000Z",
            status: "ready",
            actionPath: "customer/order-tracking/order-detail.html?orderId=order-123456789",
            channels: ["in_app", "email"],
            emailSubject: "[Campus Food] Ready for Pickup - Order #456789",
            emailBody: expect.stringContaining("Total: R75.00")
        });
    });

    test("builds grouped notifications for create, status, and collection events", () => {
        const placedNotifications = orderNotifications.buildOrderCreatedNotifications(
            createOrderRecord(),
            {
                orderStatus,
                orderModel,
                orderFormatters,
                includeEmail: true,
                vendorEmail: "vendor@example.com",
                createdAt: "2026-04-20T10:00:00.000Z"
            }
        );

        expect(placedNotifications).toHaveLength(2);
        expect(placedNotifications[0].type).toBe("order_placed");
        expect(placedNotifications[1].recipientRole).toBe("vendor");
        expect(placedNotifications[1].channels).toEqual(["in_app", "email"]);

        const acceptedOrder = createOrderRecord({
            status: "accepted",
            timeline: [
                {
                    status: "pending",
                    actorRole: "customer",
                    at: "2026-04-20T10:00:00.000Z"
                },
                {
                    status: "accepted",
                    actorRole: "vendor",
                    at: "2026-04-20T10:05:00.000Z"
                }
            ],
            updatedAt: "2026-04-20T10:05:00.000Z"
        });

        const statusNotifications = orderNotifications.buildOrderStatusNotifications(
            acceptedOrder,
            createOrderRecord(),
            {
                orderStatus,
                orderModel,
                orderFormatters,
                actorRole: "vendor",
                actorName: "Campus Bites",
                createdAt: "2026-04-20T10:05:00.000Z"
            }
        );

        expect(statusNotifications).toEqual([
            expect.objectContaining({
                recipientRole: "customer",
                type: "order_accepted",
                title: "Order Accepted",
                message: "Campus Bites accepted Order #456789."
            })
        ]);

        const collectionNotifications = orderNotifications.buildCollectionConfirmationNotifications(
            createOrderRecord({
                status: "ready",
                customerConfirmedCollected: true,
                timeline: [
                    {
                        status: "pending",
                        actorRole: "customer",
                        at: "2026-04-20T10:00:00.000Z"
                    },
                    {
                        status: "accepted",
                        actorRole: "vendor",
                        at: "2026-04-20T10:05:00.000Z"
                    },
                    {
                        status: "preparing",
                        actorRole: "vendor",
                        at: "2026-04-20T10:10:00.000Z"
                    },
                    {
                        status: "ready",
                        actorRole: "vendor",
                        at: "2026-04-20T10:20:00.000Z"
                    }
                ],
                updatedAt: "2026-04-20T10:25:00.000Z"
            }),
            createOrderRecord({
                status: "ready",
                customerConfirmedCollected: false,
                timeline: [
                    {
                        status: "pending",
                        actorRole: "customer",
                        at: "2026-04-20T10:00:00.000Z"
                    },
                    {
                        status: "accepted",
                        actorRole: "vendor",
                        at: "2026-04-20T10:05:00.000Z"
                    },
                    {
                        status: "preparing",
                        actorRole: "vendor",
                        at: "2026-04-20T10:10:00.000Z"
                    },
                    {
                        status: "ready",
                        actorRole: "vendor",
                        at: "2026-04-20T10:20:00.000Z"
                    }
                ],
                updatedAt: "2026-04-20T10:20:00.000Z"
            }),
            {
                orderStatus,
                orderModel,
                orderFormatters,
                actorRole: "customer",
                actorName: "Tshepo",
                vendorEmail: "vendor@example.com",
                createdAt: "2026-04-20T10:25:00.000Z"
            }
        );

        expect(collectionNotifications).toEqual([
            expect.objectContaining({
                recipientRole: "vendor",
                type: "collection_confirmed",
                title: "Collection Confirmed",
                message: "Tshepo confirmed collection for Order #456789."
            })
        ]);
    });

    test("supports explicit recipients and fallback behavior without shared helpers", () => {
        const explicitNotifications = orderNotifications.buildOrderNotifications(
            createOrderRecord(),
            {
                orderStatus,
                orderModel,
                orderFormatters,
                type: "updated",
                recipients: [
                    {
                        recipientUid: "admin-1",
                        recipientRole: "admin",
                        recipientName: "Campus Admin",
                        recipientEmail: "admin@example.com"
                    }
                ],
                includeEmail: true,
                includeInApp: false,
                createdAt: "2026-04-20T10:00:00.000Z"
            }
        );

        expect(explicitNotifications).toEqual([
            {
                notificationId: "",
                recipientUid: "admin-1",
                recipientRole: "admin",
                recipientName: "Campus Admin",
                recipientEmail: "admin@example.com",
                orderId: "order-123456789",
                type: "order_status_updated",
                title: "Order Updated",
                message: "Order #456789 moved from Unknown Status to Order Received.",
                read: false,
                createdAt: "2026-04-20T10:00:00.000Z",
                status: "pending",
                actionPath: "index.html?orderId=order-123456789",
                channels: ["email"],
                emailSubject: "[Campus Food] Order Updated - Order #456789",
                emailBody: expect.stringContaining("Open: index.html?orderId=order-123456789")
            }
        ]);
    });

    test("covers additional notification branches for titles, messages, channels, and recipients", () => {
        const baseContext = {
            formattedOrderId: "Order #456789",
            vendorName: "Campus Bites",
            customerName: "Tshepo",
            recipient: {
                recipientRole: "vendor"
            }
        };

        expect(orderNotifications.createNotificationTitle("preparing", baseContext)).toBe(
            "Preparing Your Order"
        );
        expect(orderNotifications.createNotificationTitle("completed", baseContext)).toBe(
            "Order Completed"
        );
        expect(orderNotifications.createNotificationTitle("rejected", baseContext)).toBe(
            "Order Rejected"
        );
        expect(orderNotifications.createNotificationTitle("cancelled", baseContext)).toBe(
            "Order Cancelled"
        );

        expect(orderNotifications.createNotificationMessage("preparing", baseContext)).toBe(
            "Campus Bites is preparing Order #456789."
        );
        expect(orderNotifications.createNotificationMessage("completed", baseContext)).toBe(
            "Tshepo completed collection for Order #456789."
        );
        expect(
            orderNotifications.createNotificationMessage("completed", {
                ...baseContext,
                recipient: {
                    recipientRole: "customer"
                }
            })
        ).toBe("Order #456789 is complete.");
        expect(orderNotifications.createNotificationMessage("rejected", baseContext)).toBe(
            "Campus Bites rejected Order #456789."
        );
        expect(orderNotifications.createNotificationMessage("cancelled", baseContext)).toBe(
            "Order #456789 was cancelled."
        );
        expect(
            orderNotifications.createNotificationMessage("collection confirmed", {
                ...baseContext,
                actorRole: "vendor"
            })
        ).toBe("Campus Bites confirmed collection for Order #456789.");
        expect(
            orderNotifications.createNotificationMessage("collection confirmed", baseContext)
        ).toBe("Collection was confirmed for Order #456789.");
        expect(
            orderNotifications.createNotificationMessage("updated", {
                formattedOrderId: "Order #456789",
                currentStatusLabel: "Ready for Pickup"
            })
        ).toBe("Order #456789 is now Ready for Pickup.");

        expect(
            orderNotifications.buildDeliveryChannels(
                {},
                {
                    includeInApp: false,
                    channels: ["mail", "mail"]
                }
            )
        ).toEqual(["email"]);

        expect(
            orderNotifications.getNotificationRecipients(
                createOrderRecord({
                    status: "ready"
                }),
                {
                    orderStatus,
                    orderModel,
                    type: "collection confirmed",
                    actorRole: "vendor"
                }
            )
        ).toEqual([
            {
                recipientUid: "customer-1",
                recipientRole: "customer",
                recipientName: "Tshepo",
                recipientEmail: "tshepo@example.com"
            }
        ]);

        expect(
            orderNotifications.getNotificationRecipients(createOrderRecord(), {
                orderStatus,
                orderModel,
                type: "updated",
                actorRole: "customer",
                vendorEmail: "vendor@example.com"
            })
        ).toEqual([
            {
                recipientUid: "vendor-1",
                recipientRole: "vendor",
                recipientName: "Campus Bites",
                recipientEmail: "vendor@example.com"
            }
        ]);
    });

    test("handles isolated fallback behavior when shared helper modules are unavailable", () => {
        const originalGlobalOrderStatus = global.orderStatus;
        const originalGlobalOrderModel = global.orderModel;
        const originalGlobalOrderFormatters = global.orderFormatters;

        delete global.orderStatus;
        delete global.orderModel;
        delete global.orderFormatters;

        jest.resetModules();
        jest.doMock("../../../public/shared/orders/order-status.js", () => {
            throw new Error("missing order-status");
        });
        jest.doMock("../../../public/shared/orders/order-model.js", () => {
            throw new Error("missing order-model");
        });
        jest.doMock("../../../public/shared/orders/order-formatters.js", () => {
            throw new Error("missing order-formatters");
        });

        let isolatedOrderNotifications;

        jest.isolateModules(() => {
            isolatedOrderNotifications = require("../../../public/shared/orders/order-notifications.js");
        });

        expect(isolatedOrderNotifications.resolveOrderStatus()).toBeNull();
        expect(isolatedOrderNotifications.resolveOrderModel()).toBeNull();
        expect(isolatedOrderNotifications.resolveOrderFormatters()).toBeNull();

        expect(
            isolatedOrderNotifications.buildNotificationRecord(
                {
                    orderId: "raw-order",
                    status: "accepted",
                    customerUid: "customer-1",
                    customerName: "Tshepo",
                    customerEmail: "tshepo@example.com",
                    vendorUid: "vendor-1",
                    vendorName: "Campus Bites",
                    total: "75"
                },
                {
                    recipient: {
                        recipientUid: "customer-1",
                        recipientRole: "customer",
                        recipientName: "Tshepo",
                        recipientEmail: "tshepo@example.com"
                    },
                    actorRole: "vendor",
                    actorName: "Campus Bites",
                    type: "accepted",
                    includeEmail: true,
                    createdAt: "2026-04-20T10:05:00.000Z"
                }
            )
        ).toEqual({
            notificationId: "",
            recipientUid: "customer-1",
            recipientRole: "customer",
            recipientName: "Tshepo",
            recipientEmail: "tshepo@example.com",
            orderId: "raw-order",
            type: "order_accepted",
            title: "Order Accepted",
            message: "Campus Bites accepted Order #raw-order.",
            read: false,
            createdAt: "2026-04-20T10:05:00.000Z",
            status: "accepted",
            actionPath: "customer/order-tracking/order-detail.html?orderId=raw-order",
            channels: ["in_app", "email"],
            emailSubject: "[Campus Food] Order Accepted - Order #raw-order",
            emailBody: expect.stringContaining("Total: 75")
        });

        jest.dontMock("../../../public/shared/orders/order-status.js");
        jest.dontMock("../../../public/shared/orders/order-model.js");
        jest.dontMock("../../../public/shared/orders/order-formatters.js");
        jest.resetModules();

        global.orderStatus = originalGlobalOrderStatus;
        global.orderModel = originalGlobalOrderModel;
        global.orderFormatters = originalGlobalOrderFormatters;
    });

    test("returns null when required helper modules do not expose the expected API", () => {
        const originalGlobalOrderStatus = global.orderStatus;
        const originalGlobalOrderModel = global.orderModel;
        const originalGlobalOrderFormatters = global.orderFormatters;

        delete global.orderStatus;
        delete global.orderModel;
        delete global.orderFormatters;

        jest.resetModules();
        jest.doMock("../../../public/shared/orders/order-status.js", () => ({}));
        jest.doMock("../../../public/shared/orders/order-model.js", () => ({}));
        jest.doMock("../../../public/shared/orders/order-formatters.js", () => ({}));

        let isolatedOrderNotifications;

        jest.isolateModules(() => {
            isolatedOrderNotifications = require("../../../public/shared/orders/order-notifications.js");
        });

        expect(isolatedOrderNotifications.resolveOrderStatus()).toBeNull();
        expect(isolatedOrderNotifications.resolveOrderModel()).toBeNull();
        expect(isolatedOrderNotifications.resolveOrderFormatters()).toBeNull();

        jest.dontMock("../../../public/shared/orders/order-status.js");
        jest.dontMock("../../../public/shared/orders/order-model.js");
        jest.dontMock("../../../public/shared/orders/order-formatters.js");
        jest.resetModules();

        global.orderStatus = originalGlobalOrderStatus;
        global.orderModel = originalGlobalOrderModel;
        global.orderFormatters = originalGlobalOrderFormatters;
    });
});
