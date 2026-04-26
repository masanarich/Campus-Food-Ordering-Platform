const orderQueries = require("../../../public/shared/orders/order-queries.js");
const orderModel = require("../../../public/shared/orders/order-model.js");
const orderStatus = require("../../../public/shared/orders/order-status.js");

function createDocSnapshot(id, data, exists = true) {
    return {
        id,
        data: jest.fn(() => data),
        exists: jest.fn(() => exists)
    };
}

function createQuerySnapshot(docs) {
    return {
        docs: docs || []
    };
}

function createFirestoreFns(options = {}) {
    return {
        collection: jest.fn((db, ...segments) => ({ kind: "collection", db, segments })),
        doc: jest.fn((db, ...segments) => ({ kind: "doc", db, segments })),
        where: jest.fn((field, operator, value) => ({ type: "where", field, operator, value })),
        orderBy: jest.fn((field, direction) => ({ type: "orderBy", field, direction })),
        limit: jest.fn((count) => ({ type: "limit", count })),
        query: jest.fn((collectionRef, ...constraints) => ({ collectionRef, constraints })),
        getDoc: jest.fn(async () => options.getDocResult || createDocSnapshot("order-1", {})),
        getDocs: jest.fn(async () => options.getDocsResult || createQuerySnapshot([]))
    };
}

describe("shared/orders/order-queries.js", () => {
    test("exports a real query module and basic helpers", () => {
        expect(orderQueries.MODULE_NAME).toBe("order-queries");
        expect(orderQueries.resolveOrderModel(orderModel)).toBe(orderModel);
        expect(orderQueries.resolveOrderStatus(orderStatus)).toBe(orderStatus);
        expect(orderQueries.normalizeText("  Hello  ")).toBe("Hello");
        expect(orderQueries.normalizeLowerText("  HeLLo  ")).toBe("hello");
        expect(orderQueries.normalizePositiveInteger("5", 0)).toBe(5);
        expect(orderQueries.normalizePositiveInteger("bad", 3)).toBe(3);
        expect(orderQueries.normalizePositiveInteger("bad", "bad")).toBe(0);
    });

    test("resolves shared dependencies from global scope and require fallback", () => {
        const originalGlobalOrderModel = global.orderModel;
        const originalGlobalOrderStatus = global.orderStatus;

        global.orderModel = orderModel;
        global.orderStatus = orderStatus;
        expect(orderQueries.resolveOrderModel()).toBe(orderModel);
        expect(orderQueries.resolveOrderStatus()).toBe(orderStatus);

        delete global.orderModel;
        delete global.orderStatus;
        expect(orderQueries.resolveOrderModel()).toBe(orderModel);
        expect(orderQueries.resolveOrderStatus()).toBe(orderStatus);

        global.orderModel = originalGlobalOrderModel;
        global.orderStatus = originalGlobalOrderStatus;
    });

    test("creates Firestore constraints and fallback query objects", () => {
        expect(
            orderQueries.createFirestoreConstraint("where", ["status", "==", "pending"], null)
        ).toEqual({
            type: "where",
            args: ["status", "==", "pending"]
        });

        expect(
            orderQueries.createFirestoreQuery(
                { kind: "collection" },
                [null, { type: "limit", count: 10 }],
                null
            )
        ).toEqual({
            collectionRef: { kind: "collection" },
            constraints: [{ type: "limit", count: 10 }]
        });
    });

    test("builds document and collection references", () => {
        const firestoreFns = createFirestoreFns();
        const db = { name: "db" };

        expect(orderQueries.getOrdersCollectionRef(db, firestoreFns)).toEqual({
            kind: "collection",
            db,
            segments: ["orders"]
        });
        expect(orderQueries.getOrderDocRef(db, " order-1 ", firestoreFns)).toEqual({
            kind: "doc",
            db,
            segments: ["orders", "order-1"]
        });
        expect(orderQueries.getNotificationsCollectionRef(db, firestoreFns)).toEqual({
            kind: "collection",
            db,
            segments: ["notifications"]
        });
        expect(orderQueries.getNotificationDocRef(db, "note-1", firestoreFns)).toEqual({
            kind: "doc",
            db,
            segments: ["notifications", "note-1"]
        });
        expect(orderQueries.getVendorMenuCollectionRef(db, "vendor-1", firestoreFns)).toEqual({
            kind: "collection",
            db,
            segments: ["users", "vendor-1", "menuItems"]
        });
        expect(orderQueries.getVendorMenuDocRef(db, "vendor-1", "item-1", firestoreFns)).toEqual({
            kind: "doc",
            db,
            segments: ["users", "vendor-1", "menuItems", "item-1"]
        });
    });

    test("normalizes status filters and builds status constraints", () => {
        const firestoreFns = createFirestoreFns();

        expect(
            orderQueries.normalizeStatusFilters(
                [" Ready for Pickup ", "approved", "approved", "unknown"],
                orderStatus
            )
        ).toEqual(["ready", "accepted"]);

        expect(
            orderQueries.buildStatusConstraints("pending", firestoreFns, orderStatus)
        ).toEqual([
            { type: "where", field: "status", operator: "==", value: "pending" }
        ]);

        expect(
            orderQueries.buildStatusConstraints(
                ["pending", "ready"],
                firestoreFns,
                orderStatus
            )
        ).toEqual([
            { type: "where", field: "status", operator: "in", value: ["pending", "ready"] }
        ]);

        expect(orderQueries.buildStatusConstraints([], firestoreFns, orderStatus)).toEqual([]);
        expect(
            orderQueries.normalizeStatusFilters([" Pending ", "ready", "ready"], null)
        ).toEqual(["pending", "ready"]);
    });

    test("builds customer and vendor order queries", () => {
        const firestoreFns = createFirestoreFns();
        const db = { name: "db" };

        expect(
            orderQueries.buildCustomerOrdersQuery({
                db,
                firestoreFns,
                orderStatus,
                customerUid: "customer-1",
                statuses: ["pending", "ready for pickup"],
                limitCount: 20
            })
        ).toEqual({
            collectionRef: { kind: "collection", db, segments: ["orders"] },
            constraints: [
                { type: "where", field: "customerUid", operator: "==", value: "customer-1" },
                { type: "where", field: "status", operator: "in", value: ["pending", "ready"] },
                { type: "orderBy", field: "updatedAt", direction: "desc" },
                { type: "orderBy", field: "createdAt", direction: "desc" },
                { type: "limit", count: 20 }
            ]
        });

        expect(
            orderQueries.buildVendorOrdersQuery({
                db,
                firestoreFns,
                orderStatus,
                vendorUid: "vendor-1",
                statuses: "accepted",
                limitCount: 5
            })
        ).toEqual({
            collectionRef: { kind: "collection", db, segments: ["orders"] },
            constraints: [
                { type: "where", field: "vendorUid", operator: "==", value: "vendor-1" },
                { type: "where", field: "status", operator: "==", value: "accepted" },
                { type: "orderBy", field: "updatedAt", direction: "desc" },
                { type: "orderBy", field: "createdAt", direction: "desc" },
                { type: "limit", count: 5 }
            ]
        });
    });

    test("builds notification and vendor menu queries", () => {
        const firestoreFns = createFirestoreFns();
        const db = { name: "db" };

        expect(
            orderQueries.buildNotificationsQuery({
                db,
                firestoreFns,
                recipientUid: "customer-1",
                read: false,
                limitCount: 10
            })
        ).toEqual({
            collectionRef: { kind: "collection", db, segments: ["notifications"] },
            constraints: [
                { type: "where", field: "recipientUid", operator: "==", value: "customer-1" },
                { type: "where", field: "read", operator: "==", value: false },
                { type: "orderBy", field: "createdAt", direction: "desc" },
                { type: "limit", count: 10 }
            ]
        });

        expect(
            orderQueries.buildVendorMenuItemsQuery({
                db,
                firestoreFns,
                vendorUid: "vendor-1",
                availableOnly: true,
                excludeSoldOut: true,
                limitCount: 5
            })
        ).toEqual({
            collectionRef: { kind: "collection", db, segments: ["users", "vendor-1", "menuItems"] },
            constraints: [
                { type: "where", field: "availability", operator: "==", value: "available" },
                { type: "where", field: "soldOut", operator: "==", value: false },
                { type: "orderBy", field: "updatedAt", direction: "desc" },
                { type: "limit", count: 5 }
            ]
        });
    });

    test("maps individual order, notification, and menu item documents", () => {
        expect(orderQueries.mapOrderDocument(null)).toBeNull();
        expect(orderQueries.mapNotificationDocument(null)).toBeNull();
        expect(orderQueries.mapMenuItemDocument(null)).toBeNull();

        expect(
            orderQueries.mapOrderDocument(
                createDocSnapshot("order-1", {
                    customerUid: "customer-1",
                    customerName: "Tshepo",
                    customerEmail: "tshepo@example.com",
                    vendorUid: "vendor-1",
                    vendorName: "Campus Bites",
                    items: [
                        { id: "burger", vendorUid: "vendor-1", vendorName: "Campus Bites", name: "Burger", price: 50, quantity: 1 }
                    ],
                    status: "approved",
                    createdAt: "t-1",
                    updatedAt: "t-1"
                }),
                { orderModel, orderStatus }
            )
        ).toEqual({
            orderId: "order-1",
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
            status: "accepted",
            timeline: [
                {
                    status: "accepted",
                    label: "Accepted",
                    actorRole: "customer",
                    actorUid: "customer-1",
                    actorName: "Tshepo",
                    note: "",
                    at: "t-1"
                }
            ],
            notes: "",
            customerConfirmedCollected: false,
            vendorConfirmedCollected: false,
            createdAt: "t-1",
            updatedAt: "t-1"
        });

        expect(
            orderQueries.mapOrderDocument({
                id: "raw-order-1",
                data: () => ({
                    status: "pending",
                    customerUid: "customer-1"
                })
            }, {})
        ).toEqual({
            orderId: "raw-order-1",
            customerUid: "customer-1",
            customerName: "",
            customerEmail: "",
            vendorUid: "",
            vendorName: "",
            items: [],
            itemCount: 0,
            subtotal: 0,
            total: 0,
            status: "pending",
            timeline: [
                {
                    status: "pending",
                    label: "Order Received",
                    actorRole: "customer",
                    actorUid: "customer-1",
                    actorName: "",
                    note: "",
                    at: null
                }
            ],
            notes: "",
            customerConfirmedCollected: false,
            vendorConfirmedCollected: false,
            createdAt: null,
            updatedAt: null
        });

        expect(
            orderQueries.mapNotificationDocument(
                createDocSnapshot("note-1", {
                    recipientUid: "customer-1",
                    recipientRole: "Customer",
                    orderId: "order-1",
                    type: "order_ready",
                    title: "Ready",
                    message: "Your order is ready.",
                    read: true,
                    createdAt: "t-2"
                })
            )
        ).toEqual({
            notificationId: "note-1",
            recipientUid: "customer-1",
            recipientRole: "customer",
            orderId: "order-1",
            type: "order_ready",
            title: "Ready",
            message: "Your order is ready.",
            read: true,
            createdAt: "t-2"
        });

        expect(
            orderQueries.mapNotificationDocument({
                id: "note-2"
            })
        ).toEqual({
            notificationId: "note-2",
            recipientUid: "",
            recipientRole: "",
            orderId: "",
            type: "",
            title: "",
            message: "",
            read: false,
            createdAt: null
        });

        expect(
            orderQueries.mapMenuItemDocument(
                createDocSnapshot("item-1", {
                    vendorUid: "vendor-1",
                    name: "Burger",
                    category: "Meals",
                    description: "Beef burger",
                    price: "55",
                    availability: "Available",
                    soldOut: false,
                    photoUrl: "https://example.com/burger.jpg"
                })
            )
        ).toEqual({
            menuItemId: "item-1",
            vendorUid: "vendor-1",
            name: "Burger",
            category: "Meals",
            description: "Beef burger",
            price: 55,
            availability: "available",
            soldOut: false,
            photoURL: "https://example.com/burger.jpg"
        });

        expect(
            orderQueries.mapMenuItemDocument({
                id: "item-2",
                data: () => ({
                    name: "Water"
                })
            })
        ).toEqual({
            menuItemId: "item-2",
            vendorUid: "",
            name: "Water",
            category: "",
            description: "",
            price: 0,
            availability: "available",
            soldOut: false,
            photoURL: ""
        });
    });

    test("maps document lists and skips missing docs", () => {
        expect(
            orderQueries.mapOrderDocuments(
                createQuerySnapshot([
                    createDocSnapshot("order-1", {
                        customerUid: "customer-1",
                        customerName: "Tshepo",
                        customerEmail: "tshepo@example.com",
                        vendorUid: "vendor-1",
                        vendorName: "Campus Bites",
                        items: [
                            { id: "burger", vendorUid: "vendor-1", vendorName: "Campus Bites", name: "Burger", price: 50, quantity: 1 }
                        ],
                        createdAt: "t-1",
                        updatedAt: "t-1"
                    }),
                    createDocSnapshot("order-2", {}, false)
                ]),
                { orderModel, orderStatus }
            )
        ).toHaveLength(1);

        expect(
            orderQueries.mapNotificationDocuments(
                createQuerySnapshot([
                    createDocSnapshot("note-1", { recipientUid: "customer-1", createdAt: "t-1" }),
                    createDocSnapshot("note-2", {}, false)
                ])
            )
        ).toHaveLength(1);

        expect(
            orderQueries.mapMenuItemDocuments(
                createQuerySnapshot([
                    createDocSnapshot("item-1", { name: "Burger" }),
                    createDocSnapshot("item-2", {}, false)
                ])
            )
        ).toHaveLength(1);
    });

    test("fetches a single order by ID", async () => {
        const firestoreFns = createFirestoreFns({
            getDocResult: createDocSnapshot("order-1", {
                customerUid: "customer-1",
                customerName: "Tshepo",
                customerEmail: "tshepo@example.com",
                vendorUid: "vendor-1",
                vendorName: "Campus Bites",
                items: [
                    { id: "burger", vendorUid: "vendor-1", vendorName: "Campus Bites", name: "Burger", price: 50, quantity: 1 }
                ],
                createdAt: "t-1",
                updatedAt: "t-1"
            })
        });

        const result = await orderQueries.fetchOrderById({
            db: { name: "db" },
            firestoreFns,
            orderId: "order-1",
            orderModel,
            orderStatus
        });

        expect(result.orderId).toBe("order-1");
        expect(firestoreFns.getDoc).toHaveBeenCalledTimes(1);
    });

    test("fetches customer orders, vendor orders, notifications, and menu items", async () => {
        const firestoreFns = createFirestoreFns({
            getDocsResult: createQuerySnapshot([
                createDocSnapshot("doc-1", {
                    customerUid: "customer-1",
                    customerName: "Tshepo",
                    customerEmail: "tshepo@example.com",
                    vendorUid: "vendor-1",
                    vendorName: "Campus Bites",
                    items: [
                        { id: "burger", vendorUid: "vendor-1", vendorName: "Campus Bites", name: "Burger", price: 50, quantity: 1 }
                    ],
                    createdAt: "t-1",
                    updatedAt: "t-1",
                    recipientUid: "customer-1",
                    recipientRole: "customer",
                    orderId: "order-1",
                    type: "order_ready",
                    title: "Ready",
                    message: "Ready now",
                    read: false,
                    vendorUid: "vendor-1",
                    name: "Burger",
                    category: "Meals",
                    description: "Beef burger",
                    price: 50,
                    availability: "available",
                    soldOut: false
                })
            ])
        });
        const db = { name: "db" };

        const customerOrders = await orderQueries.fetchCustomerOrders({
            db,
            firestoreFns,
            customerUid: "customer-1",
            orderModel,
            orderStatus
        });
        const vendorOrders = await orderQueries.fetchVendorOrders({
            db,
            firestoreFns,
            vendorUid: "vendor-1",
            orderModel,
            orderStatus
        });
        const notifications = await orderQueries.fetchNotifications({
            db,
            firestoreFns,
            recipientUid: "customer-1"
        });
        const menuItems = await orderQueries.fetchVendorMenuItems({
            db,
            firestoreFns,
            vendorUid: "vendor-1"
        });

        expect(customerOrders).toHaveLength(1);
        expect(vendorOrders).toHaveLength(1);
        expect(notifications).toHaveLength(1);
        expect(menuItems).toHaveLength(1);
        expect(firestoreFns.getDocs).toHaveBeenCalledTimes(4);
    });
});
