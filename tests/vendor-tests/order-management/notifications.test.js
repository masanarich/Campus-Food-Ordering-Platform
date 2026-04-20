/**
 * @jest-environment jsdom
 */

const vendorOrderNotificationsPage = require("../../../public/vendor/order-management/notifications.js");

function createNotification(overrides = {}) {
    return {
        notificationId: "note-1",
        recipientUid: "vendor-1",
        recipientRole: "vendor",
        orderId: "order-1",
        type: "order_placed",
        title: "New Order Received",
        message: "Student One placed an order with your store.",
        read: false,
        createdAt: "2026-04-20T12:00:00.000Z",
        ...overrides
    };
}

function createVendorProfile(overrides = {}) {
    return {
        uid: "vendor-1",
        displayName: "Campus Bites",
        vendorStatus: "approved",
        accountStatus: "active",
        isAdmin: false,
        ...overrides
    };
}

function createDOM() {
    document.body.innerHTML = `
        <p id="vendor-order-notifications-status"></p>
        <section id="vendor-notifications-container"></section>
    `;

    return {
        statusElement: document.getElementById("vendor-order-notifications-status"),
        container: document.getElementById("vendor-notifications-container")
    };
}

describe("vendor/order-management/notifications.js - helpers", () => {
    test("filterVendorNotifications keeps only vendor-targeted items", () => {
        const filtered = vendorOrderNotificationsPage.filterVendorNotifications([
            createNotification({ notificationId: "note-1", recipientRole: "vendor" }),
            createNotification({ notificationId: "note-2", recipientRole: "customer" }),
            createNotification({ notificationId: "note-3", recipientRole: "vendor" })
        ]);

        expect(filtered).toHaveLength(2);
        expect(filtered[0].notificationId).toBe("note-1");
        expect(filtered[1].notificationId).toBe("note-3");
    });

    test("buildOrderDetailUrl includes orderId", () => {
        const url = vendorOrderNotificationsPage.buildOrderDetailUrl("order-77");

        expect(url).toContain("order-detail.html");
        expect(url).toContain("orderId=order-77");
    });
});

describe("vendor/order-management/notifications.js - rendering", () => {
    let dom;

    beforeEach(() => {
        dom = createDOM();
    });

    test("renderNotifications shows empty state when there are no notifications", () => {
        vendorOrderNotificationsPage.renderNotifications([], dom.container);

        expect(dom.container.textContent).toContain("no vendor notifications");
    });

    test("renderNotifications creates vendor notification cards and order links", () => {
        vendorOrderNotificationsPage.renderNotifications([
            createNotification({ notificationId: "note-1", title: "New Order Received" }),
            createNotification({ notificationId: "note-2", title: "Collection Confirmed", read: true })
        ], dom.container);

        expect(dom.container.querySelectorAll(".vendor-notification-card")).toHaveLength(2);
        expect(dom.container.textContent).toContain("New Order Received");
        expect(dom.container.textContent).toContain("Unread");
        expect(dom.container.textContent).toContain("Read");
        expect(dom.container.querySelector('a[href*="orderId=order-1"]')).not.toBeNull();
    });
});

describe("vendor/order-management/notifications.js - data loading and init", () => {
    let dom;

    beforeEach(() => {
        dom = createDOM();
    });

    test("fetchNotifications uses orderService when available", async () => {
        const getNotifications = jest.fn(async () => [createNotification()]);

        const result = await vendorOrderNotificationsPage.fetchNotifications({
            db: { kind: "db" },
            firestoreFns: {},
            recipientUid: "vendor-1",
            orderService: { getNotifications }
        });

        expect(result.success).toBe(true);
        expect(result.notifications).toHaveLength(1);
        expect(getNotifications).toHaveBeenCalledWith(expect.objectContaining({
            recipientUid: "vendor-1"
        }));
    });

    test("fetchNotifications falls back to Firestore query", async () => {
        const firestoreFns = {
            collection: jest.fn(() => ({ kind: "collection" })),
            where: jest.fn(() => ({ kind: "where" })),
            query: jest.fn(() => ({ kind: "query" })),
            getDocs: jest.fn(async () => ({
                forEach(callback) {
                    callback({
                        id: "note-1",
                        data: () => createNotification()
                    });
                }
            }))
        };

        const result = await vendorOrderNotificationsPage.fetchNotifications({
            db: { kind: "db" },
            firestoreFns,
            recipientUid: "vendor-1"
        });

        expect(result.success).toBe(true);
        expect(result.notifications).toHaveLength(1);
        expect(firestoreFns.collection).toHaveBeenCalledWith({ kind: "db" }, "notifications");
    });

    test("init requires a signed-in user", async () => {
        const result = await vendorOrderNotificationsPage.init({
            currentUser: null,
            statusSelector: "#vendor-order-notifications-status",
            containerSelector: "#vendor-notifications-container"
        });

        expect(result.success).toBe(false);
        expect(dom.statusElement.textContent).toContain("Please sign in");
    });

    test("init blocks users without vendor access", async () => {
        const result = await vendorOrderNotificationsPage.init({
            currentUser: { uid: "vendor-1" },
            authService: {
                getCurrentUserProfile: jest.fn(async () => createVendorProfile({
                    vendorStatus: "none"
                }))
            },
            statusSelector: "#vendor-order-notifications-status",
            containerSelector: "#vendor-notifications-container"
        });

        expect(result.success).toBe(false);
        expect(dom.statusElement.textContent).toContain("do not have vendor notification access");
    });

    test("init renders vendor notifications for approved vendors", async () => {
        const getNotifications = jest.fn(async () => [
            createNotification({ notificationId: "note-1", recipientRole: "vendor" }),
            createNotification({ notificationId: "note-2", recipientRole: "customer", title: "Customer-facing only" }),
            createNotification({ notificationId: "note-3", recipientRole: "vendor", title: "Collection Confirmed", read: true })
        ]);

        const result = await vendorOrderNotificationsPage.init({
            currentUser: { uid: "vendor-1", displayName: "Campus Bites" },
            authService: {
                getCurrentUserProfile: jest.fn(async () => createVendorProfile())
            },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getNotifications },
            statusSelector: "#vendor-order-notifications-status",
            containerSelector: "#vendor-notifications-container"
        });

        expect(result.success).toBe(true);
        expect(result.notifications).toHaveLength(2);
        expect(dom.container.querySelectorAll(".vendor-notification-card")).toHaveLength(2);
        expect(dom.container.textContent).not.toContain("Customer-facing only");
        expect(dom.statusElement.textContent).toContain("Loaded 2 vendor notifications");
    });
});
