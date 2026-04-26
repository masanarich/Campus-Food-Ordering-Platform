/**
 * @jest-environment jsdom
 */

const customerOrderNotificationsPage = require("../../../public/customer/order-tracking/notifications.js");

function createNotification(overrides = {}) {
    return {
        notificationId: "note-1",
        recipientUid: "customer-1",
        orderId: "order-1",
        type: "order_status_updated",
        title: "Order update",
        message: "Your order is now preparing.",
        read: false,
        createdAt: "2026-04-20T12:00:00.000Z",
        ...overrides
    };
}

function createDOM() {
    document.body.innerHTML = `
        <p id="order-tracking-notifications-status"></p>
        <section id="notifications-container"></section>
    `;

    return {
        statusElement: document.getElementById("order-tracking-notifications-status"),
        container: document.getElementById("notifications-container")
    };
}

describe("customer/order-tracking/notifications.js - helpers", () => {
    test("mapNotificationRecord applies safe defaults", () => {
        const mapped = customerOrderNotificationsPage.mapNotificationRecord({
            notificationId: "note-5",
            message: "Ready for pickup."
        });

        expect(mapped.notificationId).toBe("note-5");
        expect(mapped.title).toBe("Order Update");
        expect(mapped.message).toBe("Ready for pickup.");
        expect(mapped.read).toBe(false);
    });

    test("buildOrderDetailUrl includes the orderId", () => {
        const url = customerOrderNotificationsPage.buildOrderDetailUrl("order-77");

        expect(url).toContain("order-detail.html");
        expect(url).toContain("orderId=order-77");
    });
});

describe("customer/order-tracking/notifications.js - rendering", () => {
    let dom;

    beforeEach(() => {
        dom = createDOM();
    });

    test("renderNotifications shows empty state when there are no notifications", () => {
        customerOrderNotificationsPage.renderNotifications([], dom.container);

        expect(dom.container.textContent).toContain("do not have any notifications");
    });

    test("renderNotifications creates notification cards and order links", () => {
        customerOrderNotificationsPage.renderNotifications([
            createNotification({ notificationId: "note-1", title: "Preparing", orderId: "order-1" }),
            createNotification({ notificationId: "note-2", title: "Ready", orderId: "order-2", read: true })
        ], dom.container);

        expect(dom.container.querySelectorAll(".tracking-notification-card")).toHaveLength(2);
        expect(dom.container.textContent).toContain("Preparing");
        expect(dom.container.textContent).toContain("Unread");
        expect(dom.container.textContent).toContain("Read");
        expect(dom.container.querySelector('a[href*="orderId=order-2"]')).not.toBeNull();
    });

    test("setStatusMessage updates the message and state", () => {
        customerOrderNotificationsPage.setStatusMessage(dom.statusElement, "Loaded notifications.", "success");

        expect(dom.statusElement.textContent).toBe("Loaded notifications.");
        expect(dom.statusElement.getAttribute("data-state")).toBe("success");
    });
});

describe("customer/order-tracking/notifications.js - fetching and init", () => {
    let dom;

    beforeEach(() => {
        dom = createDOM();
    });

    test("fetchNotifications uses orderService when available", async () => {
        const getNotifications = jest.fn(async () => [createNotification()]);

        const result = await customerOrderNotificationsPage.fetchNotifications({
            db: { kind: "db" },
            firestoreFns: {},
            recipientUid: "customer-1",
            orderService: { getNotifications }
        });

        expect(result.success).toBe(true);
        expect(result.notifications).toHaveLength(1);
        expect(getNotifications).toHaveBeenCalledWith(expect.objectContaining({
            recipientUid: "customer-1"
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

        const result = await customerOrderNotificationsPage.fetchNotifications({
            db: { kind: "db" },
            firestoreFns,
            recipientUid: "customer-1"
        });

        expect(result.success).toBe(true);
        expect(result.notifications).toHaveLength(1);
        expect(firestoreFns.collection).toHaveBeenCalledWith({ kind: "db" }, "notifications");
    });

    test("init requires a signed-in user", async () => {
        const result = await customerOrderNotificationsPage.init({
            currentUser: null,
            containerSelector: "#notifications-container",
            statusSelector: "#order-tracking-notifications-status"
        });

        expect(result.success).toBe(false);
        expect(dom.statusElement.textContent).toContain("Please sign in");
    });

    test("init renders fetched notifications for the signed-in customer", async () => {
        const getNotifications = jest.fn(async () => [
            createNotification({ notificationId: "note-1", title: "Preparing" }),
            createNotification({ notificationId: "note-2", title: "Ready", read: true })
        ]);

        const result = await customerOrderNotificationsPage.init({
            currentUser: { uid: "customer-1" },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getNotifications },
            containerSelector: "#notifications-container",
            statusSelector: "#order-tracking-notifications-status"
        });

        expect(result.success).toBe(true);
        expect(result.notifications).toHaveLength(2);
        expect(dom.container.querySelectorAll(".tracking-notification-card")).toHaveLength(2);
        expect(dom.statusElement.textContent).toContain("You have 2 notifications");
    });
});
