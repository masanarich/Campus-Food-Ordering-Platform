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

    test("renderNotifications shows a Mark as read button for unread items only", () => {
        customerOrderNotificationsPage.renderNotifications([
            createNotification({ notificationId: "note-1", read: false }),
            createNotification({ notificationId: "note-2", read: true })
        ], dom.container);

        const cards = dom.container.querySelectorAll(".tracking-notification-card");
        expect(cards[0].querySelector('button[data-action-type="mark_read"]')).not.toBeNull();
        expect(cards[1].querySelector('button[data-action-type="mark_read"]')).toBeNull();
    });

    test("clicking Mark as read updates the card and calls updateDoc", async () => {
        const updateDoc = jest.fn(async () => undefined);
        const firestoreFns = {
            doc: jest.fn(() => ({ kind: "doc-ref" })),
            updateDoc,
            serverTimestamp: jest.fn(() => "ts")
        };

        customerOrderNotificationsPage.renderNotifications(
            [createNotification({ notificationId: "note-1", read: false })],
            dom.container,
            { db: { kind: "db" }, firestoreFns }
        );

        const button = dom.container.querySelector('button[data-action-type="mark_read"]');
        button.click();

        // Wait a microtask so the async markNotificationRead resolves.
        await Promise.resolve();
        await Promise.resolve();

        expect(firestoreFns.doc).toHaveBeenCalledWith({ kind: "db" }, "notifications", "note-1");
        expect(updateDoc).toHaveBeenCalledWith(
            { kind: "doc-ref" },
            expect.objectContaining({ read: true, isRead: true })
        );
        const card = dom.container.querySelector(".tracking-notification-card");
        expect(card.getAttribute("data-read")).toBe("true");
        expect(card.querySelector(".tracking-notification-state").textContent).toBe("Read");
    });

    test("clicking Open Order also marks the notification as read", async () => {
        const updateDoc = jest.fn(async () => undefined);
        const firestoreFns = {
            doc: jest.fn(() => ({ kind: "doc-ref" })),
            updateDoc
        };

        customerOrderNotificationsPage.renderNotifications(
            [createNotification({ notificationId: "note-9", read: false, orderId: "order-9" })],
            dom.container,
            { db: { kind: "db" }, firestoreFns }
        );

        const link = dom.container.querySelector('a[href*="orderId=order-9"]');
        // Prevent jsdom navigation.
        link.addEventListener("click", function preventNav(event) { event.preventDefault(); });
        link.click();

        await Promise.resolve();
        await Promise.resolve();

        expect(updateDoc).toHaveBeenCalledTimes(1);
        const card = dom.container.querySelector(".tracking-notification-card");
        expect(card.getAttribute("data-read")).toBe("true");
    });

    test("Open Order calls preventDefault so navigation can wait for the write", async () => {
        const updateDoc = jest.fn(async () => undefined);

        customerOrderNotificationsPage.renderNotifications(
            [createNotification({ notificationId: "note-wait", read: false, orderId: "order-wait" })],
            dom.container,
            {
                db: { kind: "db" },
                firestoreFns: {
                    doc: jest.fn(() => ({ kind: "doc-ref" })),
                    updateDoc
                }
            }
        );

        const link = dom.container.querySelector('a[href*="orderId=order-wait"]');
        const event = new MouseEvent("click", { bubbles: true, cancelable: true });
        link.dispatchEvent(event);

        // Without preventDefault, the browser would unload the page before
        // the async updateDoc could finish.
        expect(event.defaultPrevented).toBe(true);

        await Promise.resolve();
        await Promise.resolve();
        expect(updateDoc).toHaveBeenCalledTimes(1);
    });

    test("Ctrl/meta-click does not preventDefault so the new tab opens normally", () => {
        const updateDoc = jest.fn(async () => undefined);

        customerOrderNotificationsPage.renderNotifications(
            [createNotification({ notificationId: "note-tab", read: false, orderId: "order-tab" })],
            dom.container,
            {
                db: { kind: "db" },
                firestoreFns: {
                    doc: jest.fn(() => ({ kind: "doc-ref" })),
                    updateDoc
                }
            }
        );

        const link = dom.container.querySelector('a[href*="orderId=order-tab"]');
        const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
        link.dispatchEvent(event);

        // Browser handles the new-tab navigation itself — current page stays open.
        expect(event.defaultPrevented).toBe(false);
        expect(updateDoc).toHaveBeenCalledTimes(1);
    });

    test("setStatusMessage updates the message and state", () => {
        customerOrderNotificationsPage.setStatusMessage(dom.statusElement, "Loaded notifications.", "success");

        expect(dom.statusElement.textContent).toBe("Loaded notifications.");
        expect(dom.statusElement.getAttribute("data-state")).toBe("success");
    });
});

describe("customer/order-tracking/notifications.js - markNotificationRead", () => {
    test("calls updateDoc with read flags and a server timestamp when available", async () => {
        const updateDoc = jest.fn(async () => undefined);
        const firestoreFns = {
            doc: jest.fn(() => ({ kind: "doc-ref" })),
            updateDoc,
            serverTimestamp: jest.fn(() => "server-ts")
        };

        const result = await customerOrderNotificationsPage.markNotificationRead("note-42", {
            db: { kind: "db" },
            firestoreFns
        });

        expect(result.success).toBe(true);
        expect(firestoreFns.doc).toHaveBeenCalledWith({ kind: "db" }, "notifications", "note-42");
        expect(updateDoc).toHaveBeenCalledWith(
            { kind: "doc-ref" },
            { read: true, isRead: true, updatedAt: "server-ts" }
        );
    });

    test("returns an error when updateDoc helpers are missing", async () => {
        const result = await customerOrderNotificationsPage.markNotificationRead("note-1", {
            db: { kind: "db" },
            firestoreFns: {}
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not available/i);
    });

    test("rejects an empty notification id", async () => {
        const result = await customerOrderNotificationsPage.markNotificationRead("", {});
        expect(result.success).toBe(false);
    });

    test("propagates updateDoc errors as a failed result", async () => {
        const firestoreFns = {
            doc: jest.fn(() => ({ kind: "doc-ref" })),
            updateDoc: jest.fn(async () => { throw new Error("permission denied"); })
        };

        const result = await customerOrderNotificationsPage.markNotificationRead("note-1", {
            db: { kind: "db" },
            firestoreFns
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("permission denied");
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
