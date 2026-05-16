const orderRealtime = require("../../../public/shared/orders/order-realtime.js");
const orderStatus = require("../../../public/shared/orders/order-status.js");
const orderModel = require("../../../public/shared/orders/order-model.js");
const orderQueries = require("../../../public/shared/orders/order-queries.js");

function createOrderSnapshot(id, data, exists = true, metadata = {}) {
    return {
        id,
        data: jest.fn(() => data),
        exists: jest.fn(() => exists),
        metadata
    };
}

function createQuerySnapshot(docs, metadata = {}) {
    return {
        docs,
        metadata
    };
}

function createFirestoreFns(options = {}) {
    const snapshotCalls = [];
    const firestoreFns = {
        snapshotCalls,
        collection: jest.fn((db, ...segments) => ({
            kind: "collection",
            db,
            segments
        })),
        doc: jest.fn((db, ...segments) => ({
            kind: "doc",
            db,
            segments,
            id: segments[segments.length - 1]
        })),
        query: jest.fn((collectionRef, ...constraints) => ({
            kind: "query",
            collectionRef,
            constraints
        })),
        where: jest.fn((...args) => ({
            type: "where",
            args
        })),
        orderBy: jest.fn((...args) => ({
            type: "orderBy",
            args
        })),
        limit: jest.fn((...args) => ({
            type: "limit",
            args
        })),
        getDoc: jest.fn(async () => (
            options.getDocResult !== undefined
                ? options.getDocResult
                : createOrderSnapshot(
                    "order-fallback-1",
                    {
                        customerUid: "customer-1",
                        customerName: "Tshepo",
                        customerEmail: "tshepo@example.com",
                        vendorUid: "vendor-1",
                        vendorName: "Campus Bites",
                        status: "pending",
                        items: []
                    }
                )
        )),
        getDocs: jest.fn(async () => (
            options.getDocsResult !== undefined
                ? options.getDocsResult
                : createQuerySnapshot([])
        ))
    };

    if (options.includeOnSnapshot !== false) {
        firestoreFns.onSnapshot = jest.fn((target, ...args) => {
            let config = null;
            let next = null;
            let error = null;

            if (
                args[0] &&
                typeof args[0] === "object" &&
                !Array.isArray(args[0]) &&
                (
                    typeof args[1] === "function" ||
                    typeof args[2] === "function"
                )
            ) {
                config = args[0];
                next = args[1];
                error = args[2];
            } else {
                next = args[0];
                error = args[1];
            }

            const call = {
                target,
                config,
                next,
                error,
                unsubscribed: false
            };

            snapshotCalls.push(call);

            return function unsubscribe() {
                call.unsubscribed = true;
            };
        });
    }

    return firestoreFns;
}

function flushPromises() {
    return new Promise(resolve => {
        setTimeout(resolve, 0);
    });
}

describe("shared/orders/order-realtime.js", () => {
    test("exports a realtime module, resolves dependencies, and exposes safe unsubscribe helpers", () => {
        expect(orderRealtime.MODULE_NAME).toBe("order-realtime");
        expect(orderRealtime.resolveOrderQueries(orderQueries)).toBe(orderQueries);
        expect(orderRealtime.resolveOrderModel(orderModel)).toBe(orderModel);
        expect(orderRealtime.resolveOrderStatus(orderStatus)).toBe(orderStatus);
        expect(orderRealtime.normalizeText("  Hello  ")).toBe("Hello");
        expect(orderRealtime.normalizeLowerText("  HeLLo  ")).toBe("hello");
        expect(
            orderRealtime.createRealtimeError("orders/test", "Something happened.", {
                detail: "extra"
            })
        ).toEqual({
            code: "orders/test",
            message: "Something happened.",
            detail: "extra"
        });

        const noop = orderRealtime.createNoopUnsubscribe();
        expect(noop()).toBe(false);

        let closeCount = 0;
        const safeUnsubscribe = orderRealtime.createSafeUnsubscribe(() => {
            closeCount += 1;
        });
        expect(safeUnsubscribe()).toBe(true);
        expect(safeUnsubscribe()).toBe(false);
        expect(closeCount).toBe(1);

        let combinedCount = 0;
        const unsubscribeAll = orderRealtime.combineUnsubscribers([
            () => {
                combinedCount += 1;
            },
            () => {
                combinedCount += 1;
            }
        ]);
        expect(unsubscribeAll()).toBe(2);
        expect(unsubscribeAll()).toBe(0);
        expect(combinedCount).toBe(2);

        const originalGlobalOrderQueries = global.orderQueries;
        const originalGlobalOrderModel = global.orderModel;
        const originalGlobalOrderStatus = global.orderStatus;

        global.orderQueries = orderQueries;
        global.orderModel = orderModel;
        global.orderStatus = orderStatus;

        expect(orderRealtime.resolveOrderQueries()).toBe(orderQueries);
        expect(orderRealtime.resolveOrderModel()).toBe(orderModel);
        expect(orderRealtime.resolveOrderStatus()).toBe(orderStatus);

        global.orderQueries = originalGlobalOrderQueries;
        global.orderModel = originalGlobalOrderModel;
        global.orderStatus = originalGlobalOrderStatus;
    });

    test("maps snapshots, existence checks, and metadata for orders and notifications", () => {
        const orderSnapshot = createOrderSnapshot(
            "order-123456789",
            {
                customerUid: "customer-1",
                customerName: "Tshepo",
                customerEmail: "tshepo@example.com",
                vendorUid: "vendor-1",
                vendorName: "Campus Bites",
                status: "ready",
                items: [
                    {
                        id: "burger",
                        vendorUid: "vendor-1",
                        vendorName: "Campus Bites",
                        name: "Burger",
                        price: 50,
                        quantity: 1
                    }
                ]
            },
            true,
            {
                fromCache: true,
                hasPendingWrites: false
            }
        );
        const notificationSnapshot = createQuerySnapshot([
            createOrderSnapshot("notice-1", {
                recipientUid: "customer-1",
                recipientRole: "customer",
                orderId: "order-123456789",
                type: "order_ready",
                title: "Ready for Pickup",
                message: "Campus Bites marked your order as ready.",
                read: false,
                createdAt: "2026-04-20T10:00:00.000Z"
            })
        ]);

        expect(orderRealtime.getSnapshotData(orderSnapshot)).toEqual({
            customerUid: "customer-1",
            customerName: "Tshepo",
            customerEmail: "tshepo@example.com",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            status: "ready",
            items: [
                {
                    id: "burger",
                    vendorUid: "vendor-1",
                    vendorName: "Campus Bites",
                    name: "Burger",
                    price: 50,
                    quantity: 1
                }
            ]
        });
        expect(orderRealtime.snapshotExists(orderSnapshot)).toBe(true);
        expect(orderRealtime.snapshotExists(createOrderSnapshot("missing", {}, false))).toBe(false);
        expect(orderRealtime.normalizeSnapshotMetadata(orderSnapshot)).toEqual({
            fromCache: true,
            hasPendingWrites: false
        });

        expect(
            orderRealtime.mapRealtimeSnapshot(orderSnapshot, {
                kind: "order",
                orderQueries,
                orderModel,
                orderStatus
            })
        ).toEqual(
            expect.objectContaining({
                orderId: "order-123456789",
                status: "ready",
                customerUid: "customer-1",
                vendorUid: "vendor-1"
            })
        );

        expect(
            orderRealtime.mapRealtimeSnapshot(notificationSnapshot, {
                kind: "notifications",
                orderQueries
            })
        ).toEqual([
            {
                notificationId: "notice-1",
                recipientUid: "customer-1",
                recipientRole: "customer",
                orderId: "order-123456789",
                type: "order_ready",
                title: "Ready for Pickup",
                message: "Campus Bites marked your order as ready.",
                read: false,
                createdAt: "2026-04-20T10:00:00.000Z"
            }
        ]);
    });

    test("subscribes to a generic snapshot target with metadata-aware realtime callbacks", () => {
        const firestoreFns = createFirestoreFns();
        const onData = jest.fn();
        const onError = jest.fn();
        const unsubscribe = orderRealtime.subscribeToSnapshot(
            {
                kind: "custom-target"
            },
            {
                firestoreFns,
                kind: "custom",
                includeMetadataChanges: true,
                mapSnapshot: snapshot => snapshot.id,
                onData,
                onError
            }
        );

        expect(firestoreFns.onSnapshot).toHaveBeenCalledTimes(1);
        expect(firestoreFns.snapshotCalls[0].config).toEqual({
            includeMetadataChanges: true
        });

        firestoreFns.snapshotCalls[0].next(
            createOrderSnapshot(
                "alpha",
                {},
                true,
                {
                    fromCache: true,
                    hasPendingWrites: true
                }
            )
        );

        expect(onData).toHaveBeenCalledWith(
            "alpha",
            expect.objectContaining({
                kind: "custom",
                metadata: {
                    fromCache: true,
                    hasPendingWrites: true
                }
            })
        );
        expect(onError).not.toHaveBeenCalled();
        expect(unsubscribe()).toBe(true);
        expect(unsubscribe()).toBe(false);
        expect(firestoreFns.snapshotCalls[0].unsubscribed).toBe(true);
    });

    test("falls back to one-time fetches and reports invalid targets or mapping failures", async () => {
        const fetchSnapshot = createOrderSnapshot(
            "order-fetch-1",
            {
                customerUid: "customer-1",
                customerName: "Tshepo",
                customerEmail: "tshepo@example.com",
                vendorUid: "vendor-1",
                vendorName: "Campus Bites",
                status: "accepted",
                items: []
            }
        );
        const fetcher = jest.fn(async () => fetchSnapshot);
        const onData = jest.fn();
        const onError = jest.fn();

        const unsubscribe = orderRealtime.subscribeToSnapshot(
            {
                kind: "fetch-target"
            },
            {
                firestoreFns: createFirestoreFns({
                    includeOnSnapshot: false
                }),
                kind: "order",
                fetcher,
                onData,
                onError,
                orderModel,
                orderStatus
            }
        );

        await flushPromises();

        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(onData).toHaveBeenCalledWith(
            expect.objectContaining({
                orderId: "order-fetch-1",
                status: "accepted"
            }),
            expect.objectContaining({
                kind: "order"
            })
        );
        expect(unsubscribe()).toBe(false);

        const mappingErrors = [];
        const brokenFirestoreFns = createFirestoreFns();

        orderRealtime.subscribeToSnapshot(
            {
                kind: "broken-target"
            },
            {
                firestoreFns: brokenFirestoreFns,
                kind: "custom",
                mapSnapshot: () => {
                    throw new Error("bad mapping");
                },
                onError: error => {
                    mappingErrors.push(error);
                }
            }
        );

        brokenFirestoreFns.snapshotCalls[0].next(createOrderSnapshot("broken", {}));

        expect(mappingErrors).toEqual([
            expect.objectContaining({
                code: "orders/realtime-map-failed"
            })
        ]);

        const invalidTargetErrors = [];
        const invalidUnsubscribe = orderRealtime.subscribeToSnapshot(null, {
            kind: "missing",
            onError: error => {
                invalidTargetErrors.push(error);
            }
        });

        expect(invalidTargetErrors).toEqual([
            expect.objectContaining({
                code: "orders/realtime-invalid-target"
            })
        ]);
        expect(invalidUnsubscribe()).toBe(false);
    });

    test("subscribes to a single order document and maps realtime order data", () => {
        const firestoreFns = createFirestoreFns();
        const onData = jest.fn();
        const onError = jest.fn();
        const unsubscribe = orderRealtime.subscribeToOrder({
            db: {
                name: "db"
            },
            firestoreFns,
            orderQueries,
            orderModel,
            orderStatus,
            orderId: "order-abc",
            onData,
            onError
        });

        expect(firestoreFns.onSnapshot).toHaveBeenCalledTimes(1);
        expect(firestoreFns.snapshotCalls[0].target).toEqual({
            kind: "doc",
            db: {
                name: "db"
            },
            segments: ["orders", "order-abc"],
            id: "order-abc"
        });

        firestoreFns.snapshotCalls[0].next(
            createOrderSnapshot("order-abc", {
                customerUid: "customer-1",
                customerName: "Tshepo",
                customerEmail: "tshepo@example.com",
                vendorUid: "vendor-1",
                vendorName: "Campus Bites",
                status: "preparing",
                items: []
            })
        );

        expect(onData).toHaveBeenCalledWith(
            expect.objectContaining({
                orderId: "order-abc",
                status: "preparing"
            }),
            expect.objectContaining({
                kind: "order"
            })
        );
        expect(onError).not.toHaveBeenCalled();
        expect(unsubscribe()).toBe(true);
    });

    test("subscribes to customer and vendor order lists through shared query builders", async () => {
        const customerFirestoreFns = createFirestoreFns();
        const customerUpdates = [];

        const customerUnsubscribe = orderRealtime.subscribeToCustomerOrders({
            db: {
                name: "db"
            },
            firestoreFns: customerFirestoreFns,
            orderQueries,
            orderModel,
            orderStatus,
            customerUid: "customer-1",
            statuses: ["pending", "ready"],
            limitCount: 5,
            onData: orders => {
                customerUpdates.push(orders);
            }
        });

        expect(customerFirestoreFns.snapshotCalls[0].target.kind).toBe("query");
        expect(customerFirestoreFns.snapshotCalls[0].target.constraints).toHaveLength(5);

        customerFirestoreFns.snapshotCalls[0].next(
            createQuerySnapshot([
                createOrderSnapshot("order-1", {
                    customerUid: "customer-1",
                    customerName: "Tshepo",
                    customerEmail: "tshepo@example.com",
                    vendorUid: "vendor-1",
                    vendorName: "Campus Bites",
                    status: "pending",
                    items: []
                }),
                createOrderSnapshot("order-2", {
                    customerUid: "customer-1",
                    customerName: "Tshepo",
                    customerEmail: "tshepo@example.com",
                    vendorUid: "vendor-2",
                    vendorName: "Fresh Juice",
                    status: "ready",
                    items: []
                })
            ])
        );

        expect(customerUpdates[0]).toEqual([
            expect.objectContaining({
                orderId: "order-1",
                status: "pending"
            }),
            expect.objectContaining({
                orderId: "order-2",
                status: "ready"
            })
        ]);

        const vendorUpdates = [];
        const vendorFirestoreFns = createFirestoreFns({
            includeOnSnapshot: false,
            getDocsResult: createQuerySnapshot([
                createOrderSnapshot("order-vendor-1", {
                    customerUid: "customer-1",
                    customerName: "Tshepo",
                    customerEmail: "tshepo@example.com",
                    vendorUid: "vendor-1",
                    vendorName: "Campus Bites",
                    status: "accepted",
                    items: []
                })
            ])
        });

        const vendorUnsubscribe = orderRealtime.subscribeToVendorOrders({
            db: {
                name: "db"
            },
            firestoreFns: vendorFirestoreFns,
            orderQueries,
            orderModel,
            orderStatus,
            vendorUid: "vendor-1",
            statuses: "accepted",
            onData: orders => {
                vendorUpdates.push(orders);
            }
        });

        await flushPromises();

        expect(vendorFirestoreFns.getDocs).toHaveBeenCalledTimes(1);
        expect(vendorUpdates).toEqual([
            [
                expect.objectContaining({
                    orderId: "order-vendor-1",
                    status: "accepted"
                })
            ]
        ]);
        expect(orderRealtime.combineUnsubscribers([customerUnsubscribe, vendorUnsubscribe])()).toBe(1);
    });

    test("subscribes to notifications, handles validation errors, and surfaces Firestore subscription failures", () => {
        const firestoreFns = createFirestoreFns();
        const notifications = [];
        const subscriptionErrors = [];

        const unsubscribe = orderRealtime.subscribeToNotifications({
            db: {
                name: "db"
            },
            firestoreFns,
            orderQueries,
            recipientUid: "customer-1",
            read: false,
            limitCount: 10,
            onData: items => {
                notifications.push(items);
            },
            onError: error => {
                subscriptionErrors.push(error);
            }
        });

        firestoreFns.snapshotCalls[0].next(
            createQuerySnapshot([
                createOrderSnapshot("notice-1", {
                    recipientUid: "customer-1",
                    recipientRole: "customer",
                    orderId: "order-1",
                    type: "order_ready",
                    title: "Ready for Pickup",
                    message: "Campus Bites marked your order as ready.",
                    read: false,
                    createdAt: "2026-04-20T10:30:00.000Z"
                })
            ])
        );

        expect(notifications).toEqual([
            [
                {
                    notificationId: "notice-1",
                    recipientUid: "customer-1",
                    recipientRole: "customer",
                    orderId: "order-1",
                    type: "order_ready",
                    title: "Ready for Pickup",
                    message: "Campus Bites marked your order as ready.",
                    read: false,
                    createdAt: "2026-04-20T10:30:00.000Z"
                }
            ]
        ]);

        firestoreFns.snapshotCalls[0].error(new Error("permission denied"));

        expect(subscriptionErrors).toEqual([
            expect.objectContaining({
                code: "orders/realtime-notifications-subscribe-failed"
            })
        ]);

        const validationErrors = [];

        expect(
            orderRealtime.subscribeToNotifications({
                orderQueries,
                recipientUid: "",
                onError: error => {
                    validationErrors.push(error);
                }
            })()
        ).toBe(false);

        expect(validationErrors).toEqual([
            expect.objectContaining({
                code: "orders/realtime-invalid-recipient"
            })
        ]);
        expect(unsubscribe()).toBe(true);
    });

    test("falls back cleanly when shared helper modules are unavailable", () => {
        const originalGlobalOrderQueries = global.orderQueries;
        const originalGlobalOrderModel = global.orderModel;
        const originalGlobalOrderStatus = global.orderStatus;

        delete global.orderQueries;
        delete global.orderModel;
        delete global.orderStatus;

        jest.resetModules();
        jest.doMock("../../../public/shared/orders/order-queries.js", () => {
            throw new Error("missing order-queries");
        });
        jest.doMock("../../../public/shared/orders/order-model.js", () => {
            throw new Error("missing order-model");
        });
        jest.doMock("../../../public/shared/orders/order-status.js", () => {
            throw new Error("missing order-status");
        });

        let isolatedOrderRealtime;

        jest.isolateModules(() => {
            isolatedOrderRealtime = require("../../../public/shared/orders/order-realtime.js");
        });

        expect(isolatedOrderRealtime.resolveOrderQueries()).toBeNull();
        expect(isolatedOrderRealtime.resolveOrderModel()).toBeNull();
        expect(isolatedOrderRealtime.resolveOrderStatus()).toBeNull();
        expect(
            isolatedOrderRealtime.mapRealtimeSnapshot(
                createOrderSnapshot("raw-order", {
                    customerUid: "customer-1",
                    status: "Accepted"
                }),
                {
                    kind: "order"
                }
            )
        ).toEqual({
            orderId: "raw-order",
            customerUid: "customer-1",
            status: "accepted"
        });

        jest.dontMock("../../../public/shared/orders/order-queries.js");
        jest.dontMock("../../../public/shared/orders/order-model.js");
        jest.dontMock("../../../public/shared/orders/order-status.js");
        jest.resetModules();

        global.orderQueries = originalGlobalOrderQueries;
        global.orderModel = originalGlobalOrderModel;
        global.orderStatus = originalGlobalOrderStatus;
    });

    test("resolves shared helpers through local requires when globals are unavailable", () => {
        const originalGlobalOrderQueries = global.orderQueries;
        const originalGlobalOrderModel = global.orderModel;
        const originalGlobalOrderStatus = global.orderStatus;

        delete global.orderQueries;
        delete global.orderModel;
        delete global.orderStatus;

        jest.resetModules();

        let isolatedOrderRealtime;

        jest.isolateModules(() => {
            isolatedOrderRealtime = require("../../../public/shared/orders/order-realtime.js");
        });

        expect(isolatedOrderRealtime.resolveOrderQueries()).toEqual(
            expect.objectContaining({
                MODULE_NAME: "order-queries"
            })
        );
        expect(isolatedOrderRealtime.resolveOrderModel()).toEqual(
            expect.objectContaining({
                MODULE_NAME: "order-model"
            })
        );
        expect(isolatedOrderRealtime.resolveOrderStatus()).toEqual(
            expect.objectContaining({
                MODULE_NAME: "order-status"
            })
        );

        jest.resetModules();

        global.orderQueries = originalGlobalOrderQueries;
        global.orderModel = originalGlobalOrderModel;
        global.orderStatus = originalGlobalOrderStatus;
    });

    test("covers fallback mapping, validation branches, and helper-specific fetch subscriptions", async () => {
        expect(orderRealtime.createSafeUnsubscribe(null)()).toBe(false);
        expect(orderRealtime.getSnapshotData(null)).toEqual({});
        expect(orderRealtime.snapshotExists(null)).toBe(false);
        expect(orderRealtime.snapshotExists({ id: "raw" })).toBe(true);
        expect(orderRealtime.normalizeSnapshotMetadata({})).toEqual({
            fromCache: false,
            hasPendingWrites: false
        });
        expect(orderRealtime.fallbackMapOrderDocument(createOrderSnapshot("missing", {}, false))).toBeNull();
        expect(
            orderRealtime.fallbackMapNotificationDocument(createOrderSnapshot("missing", {}, false))
        ).toBeNull();

        const fallbackOrderDocs = orderRealtime.fallbackMapOrderDocuments(
            createQuerySnapshot([
                createOrderSnapshot("order-fallback-a", {
                    customerUid: "customer-1",
                    status: "Pending"
                })
            ]),
            {}
        );
        expect(fallbackOrderDocs).toEqual([
            expect.objectContaining({
                orderId: "order-fallback-a",
                customerUid: "customer-1",
                status: "pending"
            })
        ]);

        const fallbackNotificationDocs = orderRealtime.fallbackMapNotificationDocuments(
            createQuerySnapshot([
                createOrderSnapshot("notice-fallback-1", {
                    recipientUid: "customer-1",
                    recipientRole: "Customer",
                    orderId: "order-fallback-a",
                    type: "order_ready",
                    title: "Ready",
                    message: "Ready now",
                    read: false
                })
            ])
        );
        expect(fallbackNotificationDocs).toEqual([
            {
                notificationId: "notice-fallback-1",
                recipientUid: "customer-1",
                recipientRole: "customer",
                orderId: "order-fallback-a",
                type: "order_ready",
                title: "Ready",
                message: "Ready now",
                read: false,
                createdAt: null
            }
        ]);

        expect(
            orderRealtime.mapRealtimeSnapshot(
                createQuerySnapshot([
                    createOrderSnapshot("order-fallback-b", {
                        customerUid: "customer-1",
                        status: "Accepted"
                    })
                ]),
                {
                    kind: "customer_orders",
                    orderQueries: null
                }
            )
        ).toEqual([
            expect.objectContaining({
                orderId: "order-fallback-b",
                customerUid: "customer-1",
                status: "accepted"
            })
        ]);
        expect(
            orderRealtime.mapRealtimeSnapshot(
                createQuerySnapshot([
                    createOrderSnapshot("notice-fallback-2", {
                        recipientUid: "customer-1",
                        recipientRole: "Customer",
                        orderId: "order-fallback-b",
                        type: "order_ready",
                        title: "Ready",
                        message: "Ready now",
                        read: true
                    })
                ]),
                {
                    kind: "notifications",
                    orderQueries: null
                }
            )
        ).toEqual([
            {
                notificationId: "notice-fallback-2",
                recipientUid: "customer-1",
                recipientRole: "customer",
                orderId: "order-fallback-b",
                type: "order_ready",
                title: "Ready",
                message: "Ready now",
                read: true,
                createdAt: null
            }
        ]);

        const rawSnapshot = {
            id: "custom"
        };
        expect(
            orderRealtime.mapRealtimeSnapshot(rawSnapshot, {
                kind: "unknown"
            })
        ).toBe(rawSnapshot);

        const thrownErrors = [];
        const thrownUnsubscribe = orderRealtime.subscribeToSnapshot(
            {
                kind: "throwing-target"
            },
            {
                firestoreFns: {
                    onSnapshot: () => {
                        throw new Error("subscribe failed");
                    }
                },
                kind: "custom",
                errorCode: "orders/custom-subscribe-failed",
                errorMessage: "Custom subscription failure.",
                onError: error => {
                    thrownErrors.push(error);
                }
            }
        );
        expect(thrownErrors).toEqual([
            expect.objectContaining({
                code: "orders/custom-subscribe-failed"
            })
        ]);
        expect(thrownUnsubscribe()).toBe(false);

        const orderFallbackUpdates = [];
        orderRealtime.subscribeToOrder({
            db: {
                name: "db"
            },
            firestoreFns: createFirestoreFns({
                includeOnSnapshot: false,
                getDocResult: createOrderSnapshot("order-fetch-2", {
                    customerUid: "customer-1",
                    customerName: "Tshepo",
                    customerEmail: "tshepo@example.com",
                    vendorUid: "vendor-1",
                    vendorName: "Campus Bites",
                    status: "ready",
                    items: []
                })
            }),
            orderQueries,
            orderModel,
            orderStatus,
            orderId: "order-fetch-2",
            onData: order => {
                orderFallbackUpdates.push(order);
            }
        });
        await flushPromises();
        expect(orderFallbackUpdates).toEqual([
            expect.objectContaining({
                orderId: "order-fetch-2",
                status: "ready"
            })
        ]);

        const customerFallbackUpdates = [];
        orderRealtime.subscribeToCustomerOrders({
            db: {
                name: "db"
            },
            firestoreFns: createFirestoreFns({
                includeOnSnapshot: false,
                getDocsResult: createQuerySnapshot([
                    createOrderSnapshot("order-fetch-3", {
                        customerUid: "customer-1",
                        customerName: "Tshepo",
                        customerEmail: "tshepo@example.com",
                        vendorUid: "vendor-1",
                        vendorName: "Campus Bites",
                        status: "preparing",
                        items: []
                    })
                ])
            }),
            orderQueries,
            orderModel,
            orderStatus,
            customerUid: "customer-1",
            onData: orders => {
                customerFallbackUpdates.push(orders);
            }
        });
        await flushPromises();
        expect(customerFallbackUpdates).toEqual([
            [
                expect.objectContaining({
                    orderId: "order-fetch-3",
                    status: "preparing"
                })
            ]
        ]);

        const notificationFallbackUpdates = [];
        orderRealtime.subscribeToNotifications({
            db: {
                name: "db"
            },
            firestoreFns: createFirestoreFns({
                includeOnSnapshot: false,
                getDocsResult: createQuerySnapshot([
                    createOrderSnapshot("notice-fetch-1", {
                        recipientUid: "customer-1",
                        recipientRole: "Customer",
                        orderId: "order-fetch-3",
                        type: "order_preparing",
                        title: "Preparing",
                        message: "Campus Bites is preparing your order.",
                        read: false
                    })
                ])
            }),
            orderQueries,
            recipientUid: "customer-1",
            onData: notifications => {
                notificationFallbackUpdates.push(notifications);
            }
        });
        await flushPromises();
        expect(notificationFallbackUpdates).toEqual([
            [
                expect.objectContaining({
                    notificationId: "notice-fetch-1",
                    type: "order_preparing"
                })
            ]
        ]);

        const orderErrors = [];
        const customerErrors = [];
        const vendorErrors = [];

        expect(
            orderRealtime.subscribeToOrder({
                orderId: "",
                onError: error => {
                    orderErrors.push(error);
                }
            })()
        ).toBe(false);
        expect(
            orderRealtime.subscribeToCustomerOrders({
                customerUid: "",
                onError: error => {
                    customerErrors.push(error);
                }
            })()
        ).toBe(false);
        expect(
            orderRealtime.subscribeToVendorOrders({
                vendorUid: "",
                onError: error => {
                    vendorErrors.push(error);
                }
            })()
        ).toBe(false);

        expect(orderErrors).toEqual([
            expect.objectContaining({
                code: "orders/realtime-invalid-order-id"
            })
        ]);
        expect(customerErrors).toEqual([
            expect.objectContaining({
                code: "orders/realtime-invalid-customer"
            })
        ]);
        expect(vendorErrors).toEqual([
            expect.objectContaining({
                code: "orders/realtime-invalid-vendor"
            })
        ]);
    });
});
