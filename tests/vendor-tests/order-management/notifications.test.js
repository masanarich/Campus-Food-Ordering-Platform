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

function resetNotificationGlobals() {
    delete window.db;
    delete global.db;
    delete window.auth;
    delete global.auth;
    delete window.authFns;
    delete global.authFns;
    delete window.firestoreFns;
    delete global.firestoreFns;
    delete window.orderService;
    delete global.orderService;
}

afterEach(() => {
    jest.restoreAllMocks();
    resetNotificationGlobals();
});

describe("vendor/order-management/notifications.js - helpers", () => {
    test("resolve helpers and waitForAuthReady support globals and async auth flows", async () => {
        jest.useFakeTimers();

        try {
            const db = { kind: "db" };
            const auth = { currentUser: { uid: "vendor-1" } };
            const authFns = { onAuthStateChanged: jest.fn() };
            const firestoreFns = { getDocs: jest.fn() };
            const orderService = { getNotifications: jest.fn() };

            window.db = db;
            window.auth = auth;
            window.authFns = authFns;
            window.firestoreFns = firestoreFns;
            window.orderService = orderService;

            expect(vendorOrderNotificationsPage.resolveFirestore(db)).toBe(db);
            expect(vendorOrderNotificationsPage.resolveFirestore()).toBe(db);
            expect(vendorOrderNotificationsPage.resolveAuth(auth)).toBe(auth);
            expect(vendorOrderNotificationsPage.resolveAuth()).toBe(auth);
            expect(vendorOrderNotificationsPage.resolveAuthFns(authFns)).toBe(authFns);
            expect(vendorOrderNotificationsPage.resolveAuthFns()).toBe(authFns);
            expect(vendorOrderNotificationsPage.resolveFirestoreFns(firestoreFns)).toBe(firestoreFns);
            expect(vendorOrderNotificationsPage.resolveFirestoreFns()).toBe(firestoreFns);
            expect(vendorOrderNotificationsPage.resolveOrderService(orderService)).toBe(orderService);
            expect(vendorOrderNotificationsPage.resolveOrderService()).toBe(orderService);

            const immediate = await vendorOrderNotificationsPage.waitForAuthReady(auth, null);
            const listenerUser = await vendorOrderNotificationsPage.waitForAuthReady(auth, {
                onAuthStateChanged: jest.fn((safeAuth, onChange) => {
                    onChange({ uid: "vendor-2" });
                })
            });
            const errorFallback = await vendorOrderNotificationsPage.waitForAuthReady(auth, {
                onAuthStateChanged: jest.fn((safeAuth, onChange, onError) => {
                    onError(new Error("auth failed"));
                })
            });
            const timeoutPromise = vendorOrderNotificationsPage.waitForAuthReady(auth, {
                onAuthStateChanged: jest.fn(() => jest.fn())
            }, 25);

            jest.advanceTimersByTime(25);

            await expect(timeoutPromise).resolves.toBe(auth.currentUser);
            expect(immediate).toBe(auth.currentUser);
            expect(listenerUser).toEqual({ uid: "vendor-2" });
            expect(errorFallback).toBe(auth.currentUser);
        } finally {
            jest.useRealTimers();
        }
    });

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

    test("setStatusMessage safely ignores a missing status element", () => {
        expect(vendorOrderNotificationsPage.setStatusMessage(null, "Ignored")).toBeUndefined();
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

    test("createNotificationCard and renderNotifications cover default content and null containers", () => {
        const card = vendorOrderNotificationsPage.createNotificationCard({
            notificationId: "note-raw",
            read: false
        });

        expect(card.textContent).toContain("Order Update");
        expect(card.textContent).toContain("There is a new update for this order.");
        expect(card.querySelector("a")).toBeNull();
        expect(vendorOrderNotificationsPage.renderNotifications([], null)).toBeUndefined();
    });

    test("renderNotifications shows a Mark as read button only for unread items", () => {
        vendorOrderNotificationsPage.renderNotifications([
            createNotification({ notificationId: "note-1", read: false }),
            createNotification({ notificationId: "note-2", read: true })
        ], dom.container);

        const cards = dom.container.querySelectorAll(".vendor-notification-card");
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

        vendorOrderNotificationsPage.renderNotifications(
            [createNotification({ notificationId: "note-1", read: false })],
            dom.container,
            { db: { kind: "db" }, firestoreFns }
        );

        const button = dom.container.querySelector('button[data-action-type="mark_read"]');
        button.click();

        await Promise.resolve();
        await Promise.resolve();

        expect(firestoreFns.doc).toHaveBeenCalledWith({ kind: "db" }, "notifications", "note-1");
        expect(updateDoc).toHaveBeenCalledWith(
            { kind: "doc-ref" },
            expect.objectContaining({ read: true, isRead: true })
        );
        const card = dom.container.querySelector(".vendor-notification-card");
        expect(card.getAttribute("data-read")).toBe("true");
        expect(card.querySelector(".vendor-notification-state").textContent).toBe("Read");
    });

    test("clicking Open Order also marks the notification as read", async () => {
        const updateDoc = jest.fn(async () => undefined);
        const firestoreFns = {
            doc: jest.fn(() => ({ kind: "doc-ref" })),
            updateDoc
        };

        vendorOrderNotificationsPage.renderNotifications(
            [createNotification({ notificationId: "note-9", read: false, orderId: "order-9" })],
            dom.container,
            { db: { kind: "db" }, firestoreFns }
        );

        const link = dom.container.querySelector('a[href*="orderId=order-9"]');
        link.addEventListener("click", function preventNav(event) { event.preventDefault(); });
        link.click();

        await Promise.resolve();
        await Promise.resolve();

        expect(updateDoc).toHaveBeenCalledTimes(1);
        const card = dom.container.querySelector(".vendor-notification-card");
        expect(card.getAttribute("data-read")).toBe("true");
    });

    test("Open Order calls preventDefault so navigation can wait for the write", async () => {
        const updateDoc = jest.fn(async () => undefined);

        vendorOrderNotificationsPage.renderNotifications(
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

        vendorOrderNotificationsPage.renderNotifications(
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
});

describe("vendor/order-management/notifications.js - markNotificationRead", () => {
    test("calls updateDoc with read flags and a server timestamp when available", async () => {
        const updateDoc = jest.fn(async () => undefined);
        const firestoreFns = {
            doc: jest.fn(() => ({ kind: "doc-ref" })),
            updateDoc,
            serverTimestamp: jest.fn(() => "server-ts")
        };

        const result = await vendorOrderNotificationsPage.markNotificationRead("note-42", {
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
        const result = await vendorOrderNotificationsPage.markNotificationRead("note-1", {
            db: { kind: "db" },
            firestoreFns: {}
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not available/i);
    });

    test("rejects an empty notification id", async () => {
        const result = await vendorOrderNotificationsPage.markNotificationRead("", {});
        expect(result.success).toBe(false);
    });

    test("propagates updateDoc errors as a failed result", async () => {
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const firestoreFns = {
            doc: jest.fn(() => ({ kind: "doc-ref" })),
            updateDoc: jest.fn(async () => { throw new Error("permission denied"); })
        };

        const result = await vendorOrderNotificationsPage.markNotificationRead("note-1", {
            db: { kind: "db" },
            firestoreFns
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("permission denied");
        errorSpy.mockRestore();
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

    test("fetchVendorProfile and fetchNotifications cover Firestore fallback and error paths", async () => {
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const profileFromFirestore = await vendorOrderNotificationsPage.fetchVendorProfile({
            db: { kind: "db" },
            firestoreFns: {
                doc: jest.fn(() => ({ kind: "doc" })),
                getDoc: jest.fn(async () => ({
                    exists: () => true,
                    data: () => ({
                        vendorOwnerName: "Campus Bites",
                        vendorStatus: "approved"
                    })
                }))
            },
            currentUser: {
                uid: "vendor-1",
                displayName: ""
            }
        });
        const fallbackProfile = await vendorOrderNotificationsPage.fetchVendorProfile({
            authService: {
                getCurrentUserProfile: jest.fn(async () => {
                    throw new Error("auth profile failed");
                })
            },
            db: { kind: "db" },
            firestoreFns: {
                doc: jest.fn(() => ({ kind: "doc" })),
                getDoc: jest.fn(async () => {
                    throw new Error("firestore failed");
                })
            },
            currentUser: {
                uid: "vendor-1",
                displayName: "Campus Bites"
            }
        });
        const missingRecipient = await vendorOrderNotificationsPage.fetchNotifications({
            recipientUid: ""
        });
        const docsArrayResult = await vendorOrderNotificationsPage.fetchNotifications({
            db: { kind: "db" },
            recipientUid: "vendor-1",
            firestoreFns: {
                collection: jest.fn(() => ({ kind: "collection" })),
                getDocs: jest.fn(async () => ({
                    docs: [
                        {
                            id: "",
                            data: () => createNotification({ notificationId: "fallback-note", title: "Docs Array Notification" })
                        }
                    ]
                }))
            }
        });
        const serviceThenNoFirestore = await vendorOrderNotificationsPage.fetchNotifications({
            db: { kind: "db" },
            recipientUid: "vendor-1",
            orderService: {
                getNotifications: jest.fn(async () => {
                    throw new Error("service exploded");
                })
            },
            firestoreFns: {}
        });
        const fetchFailure = await vendorOrderNotificationsPage.fetchNotifications({
            db: { kind: "db" },
            recipientUid: "vendor-1",
            firestoreFns: {
                collection: jest.fn(() => ({ kind: "collection" })),
                getDocs: jest.fn(async () => {
                    const error = new Error("permission denied");
                    error.code = "permission-denied";
                    throw error;
                })
            }
        });

        expect(profileFromFirestore.displayName).toBe("Campus Bites");
        expect(fallbackProfile.displayName).toBe("Campus Bites");
        expect(missingRecipient.error.code).toBe("missing-recipient");
        expect(docsArrayResult.success).toBe(true);
        expect(docsArrayResult.notifications[0].notificationId).toBe("fallback-note");
        expect(serviceThenNoFirestore.error.code).toBe("no-firestore");
        expect(fetchFailure.error.code).toBe("permission-denied");
        expect(fetchFailure.error.message).toBe("permission denied");
        expect(errorSpy).toHaveBeenCalledTimes(3);
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

    test("init covers missing container, fetch failures, and empty vendor notification states", async () => {
        document.body.innerHTML = "<p>Missing notification container</p>";
        const missingContainer = await vendorOrderNotificationsPage.init();

        expect(missingContainer).toEqual({
            success: false,
            error: "Vendor notification container not found."
        });

        dom = createDOM();

        const fetchFailure = await vendorOrderNotificationsPage.init({
            currentUser: { uid: "vendor-1", displayName: "Campus Bites" },
            authService: {
                getCurrentUserProfile: jest.fn(async () => createVendorProfile())
            },
            statusSelector: "#vendor-order-notifications-status",
            containerSelector: "#vendor-notifications-container"
        });

        expect(fetchFailure.success).toBe(false);
        expect(dom.statusElement.textContent).toContain("Vendor notification access is not available right now.");

        dom = createDOM();

        const emptyNotifications = await vendorOrderNotificationsPage.init({
            auth: {
                currentUser: {
                    uid: "vendor-1"
                }
            },
            authFns: {
                onAuthStateChanged: jest.fn((auth, onChange) => {
                    onChange(auth.currentUser);
                })
            },
            authService: {
                getCurrentUserProfile: jest.fn(async () => createVendorProfile())
            },
            db: { kind: "db" },
            firestoreFns: { collection: jest.fn(), getDocs: jest.fn() },
            orderService: {
                getNotifications: jest.fn(async () => [
                    createNotification({ recipientRole: "customer" })
                ])
            },
            statusSelector: "#vendor-order-notifications-status",
            containerSelector: "#vendor-notifications-container"
        });

        expect(emptyNotifications.success).toBe(true);
        expect(emptyNotifications.notifications).toEqual([]);
        expect(dom.statusElement.textContent).toContain("There are no vendor notifications to review right now.");
        expect(dom.container.textContent).toContain("no vendor notifications");
    });
});
