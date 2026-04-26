const orderService = require("../../../public/shared/orders/order-service.js");
const orderStatus = require("../../../public/shared/orders/order-status.js");
const orderModel = require("../../../public/shared/orders/order-model.js");
const orderValidation = require("../../../public/shared/orders/order-validation.js");
const orderQueries = require("../../../public/shared/orders/order-queries.js");

function createDocSnapshot(id, data, exists = true) {
    return {
        id,
        data: jest.fn(() => data),
        exists: jest.fn(() => exists)
    };
}

function createFirestoreFns(options = {}) {
    const batch = {
        set: jest.fn(),
        commit: jest.fn(async () => true)
    };
    let generatedIdCounter = 0;

    return {
        batch,
        collection: jest.fn((db, ...segments) => ({
            kind: "collection",
            db,
            segments
        })),
        doc: jest.fn((...args) => {
            if (args.length === 1 && args[0] && args[0].kind === "collection") {
                generatedIdCounter += 1;
                return {
                    kind: "doc",
                    id: `generated-order-${generatedIdCounter}`,
                    collectionRef: args[0]
                };
            }

            const [db, ...segments] = args;

            return {
                kind: "doc",
                db,
                segments,
                id: segments[segments.length - 1]
            };
        }),
        setDoc: options.includeSetDoc === false
            ? undefined
            : jest.fn(async () => true),
        updateDoc: options.includeUpdateDoc === true
            ? jest.fn(async () => true)
            : undefined,
        writeBatch: options.includeBatch === false
            ? undefined
            : jest.fn(() => batch),
        serverTimestamp: jest.fn(() => "server-time"),
        getDoc: jest.fn(async () => {
            if (options.getDocResult !== undefined) {
                return options.getDocResult;
            }

            return createDocSnapshot("order-1", {});
        }),
        getDocs: jest.fn(async () => options.getDocsResult || { docs: [] })
    };
}

function createCartItems() {
    return [
        {
            id: "burger",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            name: "Burger",
            category: "Meals",
            price: 50,
            quantity: 2
        },
        {
            id: "juice",
            vendorUid: "vendor-2",
            vendorName: "Fresh Juice",
            name: "Orange Juice",
            category: "Drinks",
            price: 25,
            quantity: 1
        }
    ];
}

function createCustomer() {
    return {
        uid: "customer-1",
        displayName: "Tshepo",
        email: "tshepo@example.com"
    };
}

function createReadyOrder(overrides = {}) {
    return orderModel.createOrderRecord(
        {
            orderId: "order-ready-1",
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
            status: "ready",
            customerConfirmedCollected: false,
            vendorConfirmedCollected: false,
            createdAt: "t-1",
            updatedAt: "t-1",
            ...overrides
        },
        { orderStatus }
    );
}

describe("shared/orders/order-service.js", () => {
    test("exports a real service module and resolves shared dependencies", () => {
        expect(orderService.MODULE_NAME).toBe("order-service");
        expect(orderService.resolveOrderStatus(orderStatus)).toBe(orderStatus);
        expect(orderService.resolveOrderModel(orderModel)).toBe(orderModel);
        expect(orderService.resolveOrderValidation(orderValidation)).toBe(orderValidation);
        expect(orderService.resolveOrderQueries(orderQueries)).toBe(orderQueries);
        expect(orderService.normalizeText("  Hello  ")).toBe("Hello");
        expect(orderService.normalizeLowerText("  HeLLo  ")).toBe("hello");

        const originalGlobalOrderStatus = global.orderStatus;
        const originalGlobalOrderModel = global.orderModel;
        const originalGlobalOrderValidation = global.orderValidation;
        const originalGlobalOrderQueries = global.orderQueries;

        global.orderStatus = orderStatus;
        global.orderModel = orderModel;
        global.orderValidation = orderValidation;
        global.orderQueries = orderQueries;

        expect(orderService.resolveOrderStatus()).toBe(orderStatus);
        expect(orderService.resolveOrderModel()).toBe(orderModel);
        expect(orderService.resolveOrderValidation()).toBe(orderValidation);
        expect(orderService.resolveOrderQueries()).toBe(orderQueries);

        global.orderStatus = originalGlobalOrderStatus;
        global.orderModel = originalGlobalOrderModel;
        global.orderValidation = originalGlobalOrderValidation;
        global.orderQueries = originalGlobalOrderQueries;
    });

    test("creates service results, timestamps, and order IDs", () => {
        const firestoreFns = createFirestoreFns();
        const db = { name: "db" };

        expect(
            orderService.createServiceError("orders/test", "Something happened.", {
                detail: "extra"
            })
        ).toEqual({
            code: "orders/test",
            message: "Something happened.",
            detail: "extra"
        });

        expect(orderService.createServiceResult(true, { count: 2 })).toEqual({
            success: true,
            count: 2
        });

        expect(
            orderService.resolveTimestampValue({
                timestampValue: "manual-time",
                firestoreFns
            })
        ).toBe("manual-time");
        expect(
            orderService.resolveTimestampValue({
                nowFactory: () => "factory-time"
            })
        ).toBe("factory-time");
        expect(
            orderService.resolveTimestampValue({
                firestoreFns
            })
        ).toBe("server-time");
        expect(
            orderService.resolveTimestampValue({
                now: "now-value",
                useServerTimestamp: false
            })
        ).toBe("now-value");
        expect(
            orderService.resolveTimestampValue({
                useServerTimestamp: false
            })
        ).toMatch(/^\d{4}-\d{2}-\d{2}T/);

        expect(
            orderService.createOrderId(0, {
                orderIdFactory: () => "custom-order-id"
            })
        ).toBe("custom-order-id");

        expect(
            orderService.createOrderId(1, {
                db,
                firestoreFns,
                orderQueries
            })
        ).toBe("generated-order-1");

        expect(
            orderService.createOrderId(2, {
                timestampSeed: "T 1",
                firestoreFns: {
                    doc: jest.fn(() => {
                        throw new Error("no auto id");
                    })
                }
            })
        ).toBe("order-t1-3");
    });

    test("builds write payloads with overrides", () => {
        const readyOrder = createReadyOrder();

        expect(
            orderService.buildOrderWritePayload(readyOrder, {
                orderStatus,
                orderModel,
                orderId: "order-updated-1",
                status: "completed",
                customerConfirmedCollected: true,
                vendorConfirmedCollected: true,
                updatedAt: "t-2",
                notes: "All done"
            })
        ).toEqual({
            orderId: "order-updated-1",
            customerUid: "customer-1",
            customerName: "Tshepo",
            customerEmail: "tshepo@example.com",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            items: [
                {
                    menuItemId: "burger",
                    vendorUid: "vendor-1",
                    vendorName: "Campus Bites",
                    name: "Burger",
                    category: "",
                    price: 50,
                    quantity: 1,
                    subtotal: 50,
                    photoURL: "",
                    notes: ""
                }
            ],
            itemCount: 1,
            subtotal: 50,
            total: 50,
            status: "completed",
            timeline: readyOrder.timeline,
            notes: "All done",
            customerConfirmedCollected: true,
            vendorConfirmedCollected: true,
            createdAt: "t-1",
            updatedAt: "t-2"
        });

        expect(
            orderService.buildOrderWritePayload(
                {
                    orderId: "raw-order",
                    status: "READY",
                    notes: " raw "
                },
                {
                    status: "Completed",
                    customerConfirmedCollected: true,
                    vendorConfirmedCollected: false,
                    updatedAt: "now"
                }
            )
        ).toEqual({
            orderId: "raw-order",
            customerUid: "",
            customerName: "",
            customerEmail: "",
            vendorUid: "",
            vendorName: "",
            items: [],
            itemCount: 0,
            subtotal: 0,
            total: 0,
            status: "completed",
            timeline: [
                {
                    status: "ready",
                    label: "Ready for Pickup",
                    actorRole: "customer",
                    actorUid: "",
                    actorName: "",
                    note: "",
                    at: null
                }
            ],
            customerConfirmedCollected: true,
            vendorConfirmedCollected: false,
            createdAt: null,
            updatedAt: "now",
            notes: "raw"
        });
    });

    test("prepares split vendor orders and flags empty carts", () => {
        const preparedResult = orderService.prepareCreateOrders({
            cartItems: createCartItems(),
            customer: createCustomer(),
            orderStatus,
            orderModel,
            orderValidation,
            timestampValue: "t-1"
        });

        expect(preparedResult.success).toBe(true);
        expect(preparedResult.orders).toHaveLength(2);
        expect(preparedResult.orders[0].status).toBe("pending");
        expect(preparedResult.orders[0].createdAt).toBe("t-1");
        expect(preparedResult.orders[0].customerName).toBe("Tshepo");
        expect(preparedResult.validationResults.every(result => result.isValid)).toBe(true);

        const emptyCartResult = orderService.prepareCreateOrders({
            cartItems: [],
            customer: createCustomer(),
            orderStatus,
            orderModel,
            orderValidation
        });

        expect(emptyCartResult.success).toBe(false);
        expect(emptyCartResult.error.code).toBe("orders/empty-cart");
    });

    test("rejects invalid prepared orders and missing helper dependencies", () => {
        const invalidCustomerResult = orderService.prepareCreateOrders({
            cartItems: createCartItems(),
            customer: {
                uid: "customer-1",
                displayName: "Tshepo",
                email: ""
            },
            orderStatus,
            orderModel,
            orderValidation,
            timestampValue: "t-1"
        });

        expect(invalidCustomerResult.success).toBe(false);
        expect(invalidCustomerResult.error.code).toBe("orders/validation-failed");
        expect(invalidCustomerResult.error.invalidOrders[0].errors.customerEmail).toBe(
            "Customer email is required."
        );
    });

    test("persists prepared orders with a Firestore batch", async () => {
        const firestoreFns = createFirestoreFns();
        const db = { name: "db" };
        const preparedResult = orderService.prepareCreateOrders({
            cartItems: createCartItems(),
            customer: createCustomer(),
            orderStatus,
            orderModel,
            orderValidation,
            timestampValue: "t-1"
        });

        const persistedResult = await orderService.persistOrders({
            db,
            firestoreFns,
            orderQueries,
            orderStatus,
            orderModel,
            orders: preparedResult.orders,
            orderIdFactory: index => `order-${index + 1}`
        });

        expect(persistedResult.success).toBe(true);
        expect(persistedResult.orders).toHaveLength(2);
        expect(firestoreFns.writeBatch).toHaveBeenCalledTimes(1);
        expect(firestoreFns.batch.set).toHaveBeenCalledTimes(2);
        expect(firestoreFns.batch.commit).toHaveBeenCalledTimes(1);
        expect(persistedResult.orders[0].orderId).toBe("order-1");
        expect(persistedResult.docRefs[0]).toEqual({
            kind: "doc",
            db,
            segments: ["orders", "order-1"],
            id: "order-1"
        });
    });

    test("falls back to setDoc when batch writes are unavailable", async () => {
        const firestoreFns = createFirestoreFns({
            includeBatch: false
        });
        const db = { name: "db" };
        const preparedResult = orderService.prepareCreateOrders({
            cartItems: createCartItems(),
            customer: createCustomer(),
            orderStatus,
            orderModel,
            orderValidation,
            timestampValue: "t-1"
        });

        const persistedResult = await orderService.persistOrders({
            db,
            firestoreFns,
            orderQueries,
            orderStatus,
            orderModel,
            orders: preparedResult.orders,
            orderIdFactory: index => `saved-${index + 1}`
        });

        expect(persistedResult.success).toBe(true);
        expect(firestoreFns.setDoc).toHaveBeenCalledTimes(2);
        expect(firestoreFns.setDoc.mock.calls[0][0]).toEqual({
            kind: "doc",
            db,
            segments: ["orders", "saved-1"],
            id: "saved-1"
        });
    });

    test("creates orders end to end and handles persistence failures", async () => {
        const firestoreFns = createFirestoreFns();
        const db = { name: "db" };

        const successResult = await orderService.createOrders({
            db,
            firestoreFns,
            orderQueries,
            orderStatus,
            orderModel,
            orderValidation,
            cartItems: createCartItems(),
            customer: createCustomer(),
            timestampValue: "t-1",
            orderIdFactory: index => `created-${index + 1}`
        });

        expect(successResult.success).toBe(true);
        expect(successResult.orders).toHaveLength(2);
        expect(successResult.orders[1].orderId).toBe("created-2");

        const failureResult = await orderService.createOrders({
            db,
            firestoreFns: {
                doc: jest.fn((...args) => ({
                    kind: "doc",
                    args
                }))
            },
            orderQueries,
            orderStatus,
            orderModel,
            orderValidation,
            cartItems: createCartItems(),
            customer: createCustomer(),
            timestampValue: "t-1",
            orderIdFactory: index => `failed-${index + 1}`
        });

        expect(failureResult.success).toBe(false);
        expect(failureResult.error.code).toBe("orders/write-unavailable");

        const preparedFailureResult = await orderService.createOrders({
            db,
            firestoreFns,
            orderQueries,
            orderStatus,
            orderModel,
            orderValidation,
            cartItems: [],
            customer: createCustomer(),
            timestampValue: "t-1"
        });

        expect(preparedFailureResult.success).toBe(false);
        expect(preparedFailureResult.error.code).toBe("orders/empty-cart");
    });

    test("returns persist-order failures for missing setup, invalid batches, and missing writers", async () => {
        const db = { name: "db" };
        const preparedResult = orderService.prepareCreateOrders({
            cartItems: createCartItems(),
            customer: createCustomer(),
            orderStatus,
            orderModel,
            orderValidation,
            timestampValue: "t-1"
        });

        const persistUnavailableResult = await orderService.persistOrders({
            firestoreFns: createFirestoreFns(),
            orderQueries,
            orders: preparedResult.orders
        });

        expect(persistUnavailableResult.success).toBe(false);
        expect(persistUnavailableResult.error.code).toBe("orders/persist-unavailable");

        const missingOrdersResult = await orderService.persistOrders({
            db,
            firestoreFns: createFirestoreFns(),
            orderQueries,
            orders: []
        });

        expect(missingOrdersResult.success).toBe(false);
        expect(missingOrdersResult.error.code).toBe("orders/missing-orders");

        const missingDocResult = await orderService.persistOrders({
            db,
            firestoreFns: {
                setDoc: jest.fn(async () => true)
            },
            orderQueries,
            orders: preparedResult.orders
        });

        expect(missingDocResult.success).toBe(false);
        expect(missingDocResult.error.code).toBe("orders/doc-ref-unavailable");

        const invalidBatchResult = await orderService.persistOrders({
            db,
            firestoreFns: {
                doc: jest.fn((...args) => ({
                    kind: "doc",
                    args
                })),
                writeBatch: jest.fn(() => ({
                    set: "not-a-function"
                }))
            },
            orderQueries,
            orders: preparedResult.orders,
            orderIdFactory: index => `invalid-batch-${index + 1}`
        });

        expect(invalidBatchResult.success).toBe(false);
        expect(invalidBatchResult.error.code).toBe("orders/invalid-batch");
    });

    test("returns a caught createOrders error when persistence throws unexpectedly", async () => {
        const result = await orderService.createOrders({
            db: { name: "db" },
            firestoreFns: createFirestoreFns({
                includeBatch: false
            }),
            orderQueries: {
                ...orderQueries,
                getOrderDocRef: jest.fn(() => {
                    throw new Error("write exploded");
                })
            },
            orderStatus,
            orderModel,
            orderValidation,
            cartItems: createCartItems(),
            customer: createCustomer(),
            timestampValue: "t-1",
            orderIdFactory: index => `boom-${index + 1}`
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("orders/create-failed");
        expect(result.error.message).toBe("write exploded");
    });

    test("delegates shared read operations through order-queries", async () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns();
        const mockQueries = {
            fetchOrderById: jest.fn(async () => ({ orderId: "order-1" })),
            fetchCustomerOrders: jest.fn(async () => [{ orderId: "order-1" }]),
            fetchVendorOrders: jest.fn(async () => [{ orderId: "order-2" }]),
            fetchNotifications: jest.fn(async () => [{ notificationId: "note-1" }]),
            fetchVendorMenuItems: jest.fn(async () => [{ menuItemId: "item-1" }]),
            getOrderDocRef: jest.fn()
        };

        await expect(
            orderService.getOrderById({
                orderQueries: mockQueries,
                db,
                firestoreFns,
                orderId: "order-1"
            })
        ).resolves.toEqual({ orderId: "order-1" });

        await expect(
            orderService.getCustomerOrders({
                orderQueries: mockQueries,
                db,
                firestoreFns,
                customerUid: "customer-1"
            })
        ).resolves.toEqual([{ orderId: "order-1" }]);

        await expect(
            orderService.getVendorOrders({
                orderQueries: mockQueries,
                db,
                firestoreFns,
                vendorUid: "vendor-1"
            })
        ).resolves.toEqual([{ orderId: "order-2" }]);

        await expect(
            orderService.getNotifications({
                orderQueries: mockQueries,
                db,
                firestoreFns,
                recipientUid: "customer-1"
            })
        ).resolves.toEqual([{ notificationId: "note-1" }]);

        await expect(
            orderService.getVendorMenuItems({
                orderQueries: mockQueries,
                db,
                firestoreFns,
                vendorUid: "vendor-1"
            })
        ).resolves.toEqual([{ menuItemId: "item-1" }]);

        await expect(orderService.getOrderById({})).resolves.toBeNull();
        await expect(orderService.getCustomerOrders({})).resolves.toEqual([]);
        await expect(orderService.getVendorOrders({})).resolves.toEqual([]);
        await expect(orderService.getNotifications({})).resolves.toEqual([]);
        await expect(orderService.getVendorMenuItems({})).resolves.toEqual([]);
    });

    test("builds valid vendor status updates", () => {
        const acceptedOrder = orderModel.createOrderRecord(
            {
                orderId: "order-accepted-1",
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
                status: "accepted",
                createdAt: "t-1",
                updatedAt: "t-1"
            },
            { orderStatus }
        );

        const updatePlan = orderService.buildOrderStatusUpdate(acceptedOrder, {
            orderStatus,
            orderModel,
            orderValidation,
            nextStatus: "preparing",
            actorRole: "vendor",
            actorUid: "vendor-1",
            actorName: "Campus Bites",
            note: "Cooking now.",
            updatedAt: "should-not-be-used",
            timestampValue: "t-2"
        });

        expect(updatePlan.success).toBe(true);
        expect(updatePlan.order.status).toBe("preparing");
        expect(updatePlan.order.updatedAt).toBe("t-2");
        expect(updatePlan.timelineEntry).toEqual({
            status: "preparing",
            label: "Preparing",
            actorRole: "vendor",
            actorUid: "vendor-1",
            actorName: "Campus Bites",
            note: "Cooking now.",
            at: "t-2"
        });
        expect(updatePlan.order.timeline).toHaveLength(2);
        expect(updatePlan.statusChanged).toBe(true);
    });

    test("routes completed status updates through collection confirmation logic", () => {
        const delegatedCompletionPlan = orderService.buildOrderStatusUpdate(
            createReadyOrder(),
            {
                orderStatus,
                orderModel,
                orderValidation,
                nextStatus: "completed",
                actorRole: "customer",
                actorUid: "customer-1",
                actorName: "Tshepo",
                timestampValue: "t-5"
            }
        );

        expect(delegatedCompletionPlan.success).toBe(true);
        expect(delegatedCompletionPlan.order.status).toBe("ready");
        expect(delegatedCompletionPlan.order.customerConfirmedCollected).toBe(true);
        expect(delegatedCompletionPlan.timelineEntry.at).toBe("t-5");
    });

    test("rejects invalid status changes", () => {
        const pendingOrder = orderModel.createOrderRecord(
            {
                orderId: "order-pending-1",
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
                status: "pending",
                createdAt: "t-1",
                updatedAt: "t-1"
            },
            { orderStatus }
        );

        const updatePlan = orderService.buildOrderStatusUpdate(pendingOrder, {
            orderStatus,
            orderModel,
            orderValidation,
            nextStatus: "accepted",
            actorRole: "customer"
        });

        expect(updatePlan.success).toBe(false);
        expect(updatePlan.error.code).toBe("orders/invalid-status-change");
        expect(updatePlan.error.message).toMatch(/cannot move an order/i);
    });

    test("handles partial and final collection confirmations", () => {
        const firstConfirmation = orderService.buildCollectionConfirmationUpdate(
            createReadyOrder(),
            {
                orderStatus,
                orderModel,
                orderValidation,
                actorRole: "customer",
                actorUid: "customer-1",
                actorName: "Tshepo",
                timestampValue: "t-2"
            }
        );

        expect(firstConfirmation.success).toBe(true);
        expect(firstConfirmation.order.status).toBe("ready");
        expect(firstConfirmation.order.customerConfirmedCollected).toBe(true);
        expect(firstConfirmation.order.vendorConfirmedCollected).toBe(false);
        expect(firstConfirmation.timelineEntry).toEqual({
            status: "ready",
            label: "Ready for Pickup",
            actorRole: "customer",
            actorUid: "customer-1",
            actorName: "Tshepo",
            note: "Customer confirmed collection. Waiting for vendor confirmation.",
            at: "t-2"
        });
        expect(firstConfirmation.statusChanged).toBe(false);

        const finalConfirmation = orderService.buildCollectionConfirmationUpdate(
            createReadyOrder({
                customerConfirmedCollected: true
            }),
            {
                orderStatus,
                orderModel,
                orderValidation,
                actorRole: "vendor",
                actorUid: "vendor-1",
                actorName: "Campus Bites",
                timestampValue: "t-3"
            }
        );

        expect(finalConfirmation.success).toBe(true);
        expect(finalConfirmation.order.status).toBe("completed");
        expect(finalConfirmation.order.customerConfirmedCollected).toBe(true);
        expect(finalConfirmation.order.vendorConfirmedCollected).toBe(true);
        expect(finalConfirmation.timelineEntry).toEqual({
            status: "completed",
            label: "Completed",
            actorRole: "vendor",
            actorUid: "vendor-1",
            actorName: "Campus Bites",
            note: "Collection confirmed by both customer and vendor.",
            at: "t-3"
        });
        expect(finalConfirmation.statusChanged).toBe(true);
    });

    test("supports collection confirmations on already completed orders and idempotent repeats", () => {
        const completedOrder = createReadyOrder({
            status: "completed",
            customerConfirmedCollected: true,
            vendorConfirmedCollected: false
        });

        const repairedCompletedOrder = orderService.buildCollectionConfirmationUpdate(
            completedOrder,
            {
                orderStatus,
                orderModel,
                orderValidation,
                actorRole: "vendor",
                actorUid: "vendor-1",
                actorName: "Campus Bites",
                timestampValue: "t-4"
            }
        );

        expect(repairedCompletedOrder.success).toBe(true);
        expect(repairedCompletedOrder.order.status).toBe("completed");
        expect(repairedCompletedOrder.order.vendorConfirmedCollected).toBe(true);

        const repeatedConfirmation = orderService.buildCollectionConfirmationUpdate(
            createReadyOrder({
                customerConfirmedCollected: true
            }),
            {
                orderStatus,
                orderModel,
                orderValidation,
                actorRole: "customer"
            }
        );

        expect(repeatedConfirmation.success).toBe(true);
        expect(repeatedConfirmation.needsWrite).toBe(false);
        expect(repeatedConfirmation.alreadyConfirmed).toBe(true);
        expect(repeatedConfirmation.timelineEntry).toBeNull();
    });

    test("surfaces no-write and persistence-failure paths in update workflows", async () => {
        const pendingOrder = orderModel.createOrderRecord(
            {
                orderId: "order-pending-3",
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
                status: "pending",
                createdAt: "t-1",
                updatedAt: "t-1"
            },
            { orderStatus }
        );
        const db = { name: "db" };

        const invalidUpdateResult = await orderService.updateOrderStatus({
            order: pendingOrder,
            orderStatus,
            orderModel,
            orderValidation,
            nextStatus: "accepted",
            actorRole: "customer"
        });

        expect(invalidUpdateResult.success).toBe(false);
        expect(invalidUpdateResult.error.code).toBe("orders/invalid-status-change");

        const updatePersistFailureResult = await orderService.updateOrderStatus({
            db,
            firestoreFns: {
                doc: jest.fn((...args) => ({
                    kind: "doc",
                    args
                }))
            },
            orderQueries,
            order: orderModel.createOrderRecord(
                {
                    orderId: "order-accepted-2",
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
                    status: "accepted",
                    createdAt: "t-1",
                    updatedAt: "t-1"
                },
                { orderStatus }
            ),
            orderStatus,
            orderModel,
            orderValidation,
            nextStatus: "preparing",
            actorRole: "vendor",
            actorUid: "vendor-1",
            actorName: "Campus Bites",
            timestampValue: "t-2"
        });

        expect(updatePersistFailureResult.success).toBe(false);
        expect(updatePersistFailureResult.error.code).toBe("orders/update-write-unavailable");

        const noWriteConfirmationResult = await orderService.confirmOrderCollection({
            order: createReadyOrder({
                customerConfirmedCollected: true
            }),
            orderStatus,
            orderModel,
            orderValidation,
            actorRole: "customer"
        });

        expect(noWriteConfirmationResult.success).toBe(true);
        expect(noWriteConfirmationResult.needsWrite).toBe(false);
        expect(noWriteConfirmationResult.alreadyConfirmed).toBe(true);

        const confirmationPersistFailureResult = await orderService.confirmOrderCollection({
            db,
            firestoreFns: {
                doc: jest.fn((...args) => ({
                    kind: "doc",
                    args
                }))
            },
            orderQueries,
            order: createReadyOrder(),
            orderStatus,
            orderModel,
            orderValidation,
            actorRole: "customer",
            actorUid: "customer-1",
            actorName: "Tshepo",
            timestampValue: "t-3"
        });

        expect(confirmationPersistFailureResult.success).toBe(false);
        expect(confirmationPersistFailureResult.error.code).toBe("orders/update-write-unavailable");
    });

    test("returns not-found and caught-error results in async status workflows", async () => {
        const db = { name: "db" };
        const missingConfirmationResult = await orderService.confirmOrderCollection({
            db,
            firestoreFns: createFirestoreFns({
                getDocResult: createDocSnapshot("missing", {}, false)
            }),
            orderQueries,
            orderStatus,
            orderModel,
            orderValidation,
            orderId: "missing",
            actorRole: "customer"
        });

        expect(missingConfirmationResult.success).toBe(false);
        expect(missingConfirmationResult.error.code).toBe("orders/not-found");

        const throwingQueries = {
            fetchOrderById: jest.fn(async () => {
                throw new Error("boom");
            }),
            getOrderDocRef: jest.fn()
        };

        const updateCaughtErrorResult = await orderService.updateOrderStatus({
            db,
            firestoreFns: createFirestoreFns(),
            orderQueries: throwingQueries,
            orderId: "order-1",
            nextStatus: "accepted",
            actorRole: "vendor"
        });

        expect(updateCaughtErrorResult.success).toBe(false);
        expect(updateCaughtErrorResult.error.code).toBe("orders/status-update-failed");
        expect(updateCaughtErrorResult.error.message).toBe("boom");

        const confirmationCaughtErrorResult = await orderService.confirmOrderCollection({
            db,
            firestoreFns: createFirestoreFns(),
            orderQueries: throwingQueries,
            orderId: "order-1",
            actorRole: "customer"
        });

        expect(confirmationCaughtErrorResult.success).toBe(false);
        expect(confirmationCaughtErrorResult.error.code).toBe(
            "orders/collection-confirmation-failed"
        );
        expect(confirmationCaughtErrorResult.error.message).toBe("boom");
    });

    test("rejects invalid collection confirmations and missing update context", async () => {
        const pendingOrder = orderModel.createOrderRecord(
            {
                orderId: "order-pending-2",
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
                status: "pending",
                createdAt: "t-1",
                updatedAt: "t-1"
            },
            { orderStatus }
        );

        const invalidActorResult = orderService.buildCollectionConfirmationUpdate(
            createReadyOrder(),
            {
                orderStatus,
                orderModel,
                orderValidation,
                actorRole: "admin"
            }
        );

        expect(invalidActorResult.success).toBe(false);
        expect(invalidActorResult.error.code).toBe("orders/invalid-actor");

        const invalidStatusResult = orderService.buildCollectionConfirmationUpdate(
            pendingOrder,
            {
                orderStatus,
                orderModel,
                orderValidation,
                actorRole: "customer"
            }
        );

        expect(invalidStatusResult.success).toBe(false);
        expect(invalidStatusResult.error.code).toBe("orders/not-ready-for-collection");

        const forcedValidationFailureResult = orderService.buildCollectionConfirmationUpdate(
            createReadyOrder(),
            {
                orderStatus,
                orderModel,
                orderValidation: {
                    validateCreateOrderInput: jest.fn(),
                    validateOrderStatusChange: jest.fn(() => ({
                        isValid: false,
                        transition: {
                            message: "Forced rejection."
                        }
                    }))
                },
                actorRole: "customer"
            }
        );

        expect(forcedValidationFailureResult.success).toBe(false);
        expect(forcedValidationFailureResult.error.code).toBe("orders/invalid-status-change");
        expect(forcedValidationFailureResult.error.message).toBe("Forced rejection.");

        const persistResult = await orderService.persistOrderUpdate({
            db: { name: "db" },
            firestoreFns: {},
            orderQueries,
            order: createReadyOrder()
        });

        expect(persistResult.success).toBe(false);
        expect(persistResult.error.code).toBe("orders/update-unavailable");
    });

    test("persists order updates with setDoc or updateDoc", async () => {
        const db = { name: "db" };
        const setDocFirestoreFns = createFirestoreFns();
        const updateResult = await orderService.persistOrderUpdate({
            db,
            firestoreFns: setDocFirestoreFns,
            orderQueries,
            order: createReadyOrder()
        });

        expect(updateResult.success).toBe(true);
        expect(setDocFirestoreFns.setDoc).toHaveBeenCalledWith(
            {
                kind: "doc",
                db,
                segments: ["orders", "order-ready-1"],
                id: "order-ready-1"
            },
            expect.objectContaining({
                orderId: "order-ready-1"
            }),
            { merge: true }
        );

        const updateDocFirestoreFns = createFirestoreFns({
            includeSetDoc: false,
            includeUpdateDoc: true,
            includeBatch: false
        });
        const updateDocResult = await orderService.persistOrderUpdate({
            db,
            firestoreFns: updateDocFirestoreFns,
            orderQueries,
            order: createReadyOrder()
        });

        expect(updateDocResult.success).toBe(true);
        expect(updateDocFirestoreFns.updateDoc).toHaveBeenCalledTimes(1);
    });

    test("updates order status and collection confirmation end to end", async () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns({
            getDocResult: createDocSnapshot("order-1", {
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
                status: "pending",
                createdAt: "t-1",
                updatedAt: "t-1"
            })
        });

        const statusUpdateResult = await orderService.updateOrderStatus({
            db,
            firestoreFns,
            orderQueries,
            orderStatus,
            orderModel,
            orderValidation,
            orderId: "order-1",
            nextStatus: "accepted",
            actorRole: "vendor",
            actorUid: "vendor-1",
            actorName: "Campus Bites",
            timestampValue: "t-2"
        });

        expect(statusUpdateResult.success).toBe(true);
        expect(statusUpdateResult.order.status).toBe("accepted");
        expect(firestoreFns.setDoc).toHaveBeenCalledTimes(1);

        const readyFirestoreFns = createFirestoreFns({
            getDocResult: createDocSnapshot("order-2", {
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
                status: "ready",
                createdAt: "t-1",
                updatedAt: "t-1"
            })
        });

        const collectionResult = await orderService.confirmOrderCollection({
            db,
            firestoreFns: readyFirestoreFns,
            orderQueries,
            orderStatus,
            orderModel,
            orderValidation,
            orderId: "order-2",
            actorRole: "customer",
            actorUid: "customer-1",
            actorName: "Tshepo",
            timestampValue: "t-3"
        });

        expect(collectionResult.success).toBe(true);
        expect(collectionResult.order.status).toBe("ready");
        expect(collectionResult.order.customerConfirmedCollected).toBe(true);
        expect(readyFirestoreFns.setDoc).toHaveBeenCalledTimes(1);

        const missingOrderResult = await orderService.updateOrderStatus({
            db,
            firestoreFns: createFirestoreFns({
                getDocResult: createDocSnapshot("missing", {}, false)
            }),
            orderQueries,
            orderStatus,
            orderModel,
            orderValidation,
            orderId: "missing",
            nextStatus: "accepted",
            actorRole: "vendor"
        });

        expect(missingOrderResult.success).toBe(false);
        expect(missingOrderResult.error.code).toBe("orders/not-found");
    });

    test("handles dependency-missing fallbacks in isolation when shared modules are unavailable", () => {
        const originalGlobalOrderStatus = global.orderStatus;
        const originalGlobalOrderModel = global.orderModel;
        const originalGlobalOrderValidation = global.orderValidation;
        const originalGlobalOrderQueries = global.orderQueries;

        delete global.orderStatus;
        delete global.orderModel;
        delete global.orderValidation;
        delete global.orderQueries;

        jest.resetModules();
        jest.doMock("../../../public/shared/orders/order-status.js", () => ({}));
        jest.doMock("../../../public/shared/orders/order-model.js", () => ({}));
        jest.doMock("../../../public/shared/orders/order-validation.js", () => ({}));
        jest.doMock("../../../public/shared/orders/order-queries.js", () => ({}));

        let isolatedOrderService;

        jest.isolateModules(() => {
            isolatedOrderService = require("../../../public/shared/orders/order-service.js");
        });

        expect(isolatedOrderService.resolveOrderStatus()).toBeNull();
        expect(isolatedOrderService.resolveOrderModel()).toBeNull();
        expect(isolatedOrderService.resolveOrderValidation()).toBeNull();
        expect(isolatedOrderService.resolveOrderQueries()).toBeNull();

        expect(
            isolatedOrderService.buildOrderWritePayload(
                {
                    orderId: "fallback-order",
                    status: "READY",
                    notes: " note "
                },
                {
                    status: "completed",
                    customerConfirmedCollected: true,
                    vendorConfirmedCollected: false,
                    updatedAt: "t-2"
                }
            )
        ).toEqual({
            orderId: "fallback-order",
            status: "completed",
            timeline: [],
            customerConfirmedCollected: true,
            vendorConfirmedCollected: false,
            createdAt: undefined,
            updatedAt: "t-2",
            notes: "note"
        });

        expect(
            isolatedOrderService.prepareCreateOrders({
                cartItems: createCartItems(),
                customer: createCustomer()
            })
        ).toEqual(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: "orders/dependencies-missing"
                })
            })
        );

        expect(
            isolatedOrderService.buildOrderStatusUpdate(createReadyOrder(), {})
        ).toEqual(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: "orders/dependencies-missing"
                })
            })
        );

        expect(
            isolatedOrderService.buildCollectionConfirmationUpdate(createReadyOrder(), {})
        ).toEqual(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: "orders/dependencies-missing"
                })
            })
        );

        jest.dontMock("../../../public/shared/orders/order-status.js");
        jest.dontMock("../../../public/shared/orders/order-model.js");
        jest.dontMock("../../../public/shared/orders/order-validation.js");
        jest.dontMock("../../../public/shared/orders/order-queries.js");
        jest.resetModules();

        global.orderStatus = originalGlobalOrderStatus;
        global.orderModel = originalGlobalOrderModel;
        global.orderValidation = originalGlobalOrderValidation;
        global.orderQueries = originalGlobalOrderQueries;
    });
});
