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

describe("customer/order-tracking/notifications.js - filter, sort, paginate", () => {
    function makeNotification(overrides) {
        return {
            notificationId: "note-x",
            recipientUid: "customer-1",
            orderId: "order-x",
            type: "order_status_updated",
            title: "Order update",
            message: "Your order is on its way.",
            read: false,
            createdAt: "2026-04-20T12:00:00.000Z",
            ...overrides
        };
    }

    test("sortNotifications defaults to newest first by createdAt", () => {
        const notifications = [
            makeNotification({ notificationId: "a", createdAt: "2026-01-01T00:00:00Z" }),
            makeNotification({ notificationId: "b", createdAt: "2026-05-01T00:00:00Z" }),
            makeNotification({ notificationId: "c", createdAt: "2026-03-01T00:00:00Z" })
        ];

        const sorted = customerOrderNotificationsPage.sortNotifications(notifications, "newest");

        expect(sorted.map(n => n.notificationId)).toEqual(["b", "c", "a"]);
    });

    test("sortNotifications supports oldest", () => {
        const notifications = [
            makeNotification({ notificationId: "a", createdAt: "2026-01-01T00:00:00Z" }),
            makeNotification({ notificationId: "b", createdAt: "2026-05-01T00:00:00Z" }),
            makeNotification({ notificationId: "c", createdAt: "2026-03-01T00:00:00Z" })
        ];

        expect(customerOrderNotificationsPage.sortNotifications(notifications, "oldest").map(n => n.notificationId))
            .toEqual(["a", "c", "b"]);
    });

    test("sortNotifications unread-first places unread before read, newest-first within group", () => {
        const notifications = [
            makeNotification({ notificationId: "a", read: true, createdAt: "2026-05-01T00:00:00Z" }),
            makeNotification({ notificationId: "b", read: false, createdAt: "2026-01-01T00:00:00Z" }),
            makeNotification({ notificationId: "c", read: false, createdAt: "2026-03-01T00:00:00Z" }),
            makeNotification({ notificationId: "d", read: true, createdAt: "2026-02-01T00:00:00Z" })
        ];

        const sorted = customerOrderNotificationsPage.sortNotifications(notifications, "unread-first");

        expect(sorted.map(n => n.notificationId)).toEqual(["c", "b", "a", "d"]);
    });

    test("filterNotifications narrows by read status", () => {
        const notifications = [
            makeNotification({ notificationId: "a", read: false }),
            makeNotification({ notificationId: "b", read: true }),
            makeNotification({ notificationId: "c", read: false })
        ];

        expect(customerOrderNotificationsPage.filterNotifications(notifications, { read: "unread" }).map(n => n.notificationId))
            .toEqual(["a", "c"]);
        expect(customerOrderNotificationsPage.filterNotifications(notifications, { read: "read" }).map(n => n.notificationId))
            .toEqual(["b"]);
        expect(customerOrderNotificationsPage.filterNotifications(notifications, { read: "all" }).map(n => n.notificationId))
            .toEqual(["a", "b", "c"]);
    });

    test("filterNotifications searches title, message, orderId and notification id", () => {
        const notifications = [
            makeNotification({ notificationId: "note-1", title: "Preparing", message: "Now cooking.", orderId: "order-aaa" }),
            makeNotification({ notificationId: "note-2", title: "Ready", message: "Pickup available.", orderId: "order-bbb" }),
            makeNotification({ notificationId: "note-3", title: "Delayed", message: "Apologies for the wait.", orderId: "order-ccc" })
        ];

        expect(customerOrderNotificationsPage.filterNotifications(notifications, { search: "ready" }).map(n => n.notificationId))
            .toEqual(["note-2"]);
        expect(customerOrderNotificationsPage.filterNotifications(notifications, { search: "cooking" }).map(n => n.notificationId))
            .toEqual(["note-1"]);
        expect(customerOrderNotificationsPage.filterNotifications(notifications, { search: "order-ccc" }).map(n => n.notificationId))
            .toEqual(["note-3"]);
        expect(customerOrderNotificationsPage.filterNotifications(notifications, { search: "note-1" }).map(n => n.notificationId))
            .toEqual(["note-1"]);
    });

    test("filterNotifications narrows by type", () => {
        const notifications = [
            makeNotification({ notificationId: "a", type: "order_status_updated" }),
            makeNotification({ notificationId: "b", type: "payment_received" }),
            makeNotification({ notificationId: "c", type: "order_status_updated" })
        ];

        expect(customerOrderNotificationsPage.filterNotifications(notifications, { type: "payment_received" }).map(n => n.notificationId))
            .toEqual(["b"]);
        expect(customerOrderNotificationsPage.filterNotifications(notifications, { type: "all" }).map(n => n.notificationId))
            .toEqual(["a", "b", "c"]);
    });

    test("paginateNotifications returns the correct slice and clamps the page index", () => {
        const notifications = Array.from({ length: 15 }, (_, index) => makeNotification({
            notificationId: `note-${index + 1}`
        }));

        const page1 = customerOrderNotificationsPage.paginateNotifications(notifications, 1, 6);
        expect(page1.pageNotifications).toHaveLength(6);
        expect(page1.totalPages).toBe(3);
        expect(page1.page).toBe(1);

        const page3 = customerOrderNotificationsPage.paginateNotifications(notifications, 3, 6);
        expect(page3.pageNotifications).toHaveLength(3);
        expect(page3.pageNotifications[0].notificationId).toBe("note-13");

        const clamped = customerOrderNotificationsPage.paginateNotifications(notifications, 99, 6);
        expect(clamped.page).toBe(3);

        const empty = customerOrderNotificationsPage.paginateNotifications([], 1, 6);
        expect(empty.totalPages).toBe(1);
        expect(empty.pageNotifications).toHaveLength(0);
    });

    test("countUnread counts only notifications without a read flag", () => {
        const notifications = [
            makeNotification({ read: true }),
            makeNotification({ read: false }),
            makeNotification({ read: false }),
            { /* malformed */ }
        ];

        expect(customerOrderNotificationsPage.countUnread(notifications)).toBe(3);
    });

    test("buildResultSummary distinguishes filtered vs unfiltered and shows unread count", () => {
        expect(customerOrderNotificationsPage.buildResultSummary(0, 0, 0)).toBe("");
        expect(customerOrderNotificationsPage.buildResultSummary(5, 5, 0))
            .toBe("Showing all 5 notifications.");
        expect(customerOrderNotificationsPage.buildResultSummary(5, 5, 2))
            .toBe("Showing all 5 notifications (2 unread).");
        expect(customerOrderNotificationsPage.buildResultSummary(2, 5, 1))
            .toBe("Showing 2 of 5 notifications (1 unread).");
        expect(customerOrderNotificationsPage.buildResultSummary(1, 1, 0))
            .toBe("Showing all 1 notification.");
    });
});

describe("customer/order-tracking/notifications.js - toolbar integration", () => {
    function setupToolbarDom() {
        document.body.innerHTML = `
            <p id="order-tracking-notifications-status"></p>
            <form id="notifications-filter-form">
                <input id="notifications-search" name="search" type="search" />
                <select id="notifications-read-filter" name="read">
                    <option value="all" selected>All</option>
                    <option value="unread">Unread</option>
                    <option value="read">Read</option>
                </select>
                <select id="notifications-type-filter" name="type">
                    <option value="all" selected>All</option>
                </select>
                <select id="notifications-sort" name="sort">
                    <option value="newest" selected>Newest</option>
                    <option value="oldest">Oldest</option>
                </select>
            </form>
            <p id="notifications-results-summary"></p>
            <menu>
                <li>
                    <button id="notifications-mark-all-read" type="button" hidden>Mark all as read</button>
                </li>
            </menu>
            <section id="notifications-container"></section>
            <nav id="notifications-pagination" hidden>
                <p id="notifications-pagination-status"></p>
                <menu>
                    <li><button type="button" data-page-action="prev">Prev</button></li>
                    <li><button type="button" data-page-action="next">Next</button></li>
                </menu>
            </nav>
        `;

        return {
            container: document.getElementById("notifications-container"),
            summary: document.getElementById("notifications-results-summary"),
            form: document.getElementById("notifications-filter-form"),
            readSelect: document.getElementById("notifications-read-filter"),
            bulkButton: document.getElementById("notifications-mark-all-read"),
            pagination: document.getElementById("notifications-pagination"),
            paginationStatus: document.getElementById("notifications-pagination-status")
        };
    }

    test("init wires the filter form so unread filter narrows the rendered cards", async () => {
        const dom = setupToolbarDom();

        const getNotifications = jest.fn(async () => [
            { notificationId: "note-1", title: "First", message: "Unread one", read: false, createdAt: "2026-04-01T00:00:00Z" },
            { notificationId: "note-2", title: "Second", message: "Read one", read: true, createdAt: "2026-04-02T00:00:00Z" },
            { notificationId: "note-3", title: "Third", message: "Unread two", read: false, createdAt: "2026-04-03T00:00:00Z" }
        ]);

        await customerOrderNotificationsPage.init({
            currentUser: { uid: "customer-1" },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getNotifications }
        });

        expect(dom.container.querySelectorAll(".tracking-notification-card")).toHaveLength(3);
        expect(dom.summary.textContent).toContain("all 3");
        expect(dom.summary.textContent).toContain("2 unread");
        expect(dom.bulkButton.hidden).toBe(false);
        expect(dom.bulkButton.textContent).toContain("Mark all as read (2)");

        dom.readSelect.value = "unread";
        dom.form.dispatchEvent(new Event("change", { bubbles: true }));

        expect(dom.container.querySelectorAll(".tracking-notification-card")).toHaveLength(2);
        expect(dom.summary.textContent).toContain("2 of 3");
    });

    test("init paginates notifications with the configured page size and Next moves to page 2", async () => {
        const dom = setupToolbarDom();

        const items = Array.from({ length: 8 }, (_, index) => ({
            notificationId: `note-${index + 1}`,
            title: `Title ${index + 1}`,
            message: `Message ${index + 1}`,
            read: index % 2 === 0,
            createdAt: `2026-04-${String(index + 1).padStart(2, "0")}T00:00:00Z`
        }));

        const getNotifications = jest.fn(async () => items);

        await customerOrderNotificationsPage.init({
            currentUser: { uid: "customer-1" },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getNotifications },
            pageSize: 3
        });

        expect(dom.container.querySelectorAll(".tracking-notification-card")).toHaveLength(3);
        expect(dom.pagination.hasAttribute("hidden")).toBe(false);
        expect(dom.paginationStatus.textContent).toBe("Page 1 of 3");

        dom.pagination.querySelector('[data-page-action="next"]').click();

        expect(dom.paginationStatus.textContent).toBe("Page 2 of 3");
        expect(dom.container.querySelectorAll(".tracking-notification-card")).toHaveLength(3);
    });

    test("Mark all as read calls updateDoc for every unread notification", async () => {
        const dom = setupToolbarDom();

        const updateDoc = jest.fn(async () => undefined);
        const firestoreFns = {
            doc: jest.fn((_, __, id) => ({ kind: "doc-ref", id })),
            updateDoc
        };
        window.firestoreFns = firestoreFns;

        try {
            const getNotifications = jest.fn(async () => [
                { notificationId: "note-1", title: "A", read: false, createdAt: "2026-04-01T00:00:00Z" },
                { notificationId: "note-2", title: "B", read: true, createdAt: "2026-04-02T00:00:00Z" },
                { notificationId: "note-3", title: "C", read: false, createdAt: "2026-04-03T00:00:00Z" }
            ]);

            await customerOrderNotificationsPage.init({
                currentUser: { uid: "customer-1" },
                db: { kind: "db" },
                firestoreFns,
                orderService: { getNotifications }
            });

            expect(dom.bulkButton.hidden).toBe(false);

            dom.bulkButton.click();

            // Allow the pending markNotificationRead promises to flush.
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();

            expect(updateDoc).toHaveBeenCalledTimes(2);
            const unreadCards = dom.container.querySelectorAll('.tracking-notification-card[data-read="false"]');
            expect(unreadCards).toHaveLength(0);
            expect(dom.bulkButton.hidden).toBe(true);
        } finally {
            delete window.firestoreFns;
        }
    });
});
