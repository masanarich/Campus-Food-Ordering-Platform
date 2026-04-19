/**
 * @jest-environment jsdom
 */
beforeEach(() => {
    delete window.location;

    window.location = {
        href: "http://localhost/",
        assign: jest.fn(),
    };
});
function createMockSnapshot(records) {
    return {
        forEach(callback) {
            records.forEach(function eachRecord(record, index) {
                callback({
                    id: record.uid || `user-${index + 1}`,
                    data() {
                        return record;
                    }
                });
            });
        }
    };
}

function createDom() {
    document.body.innerHTML = `
        <main>
            <section>
                <button id="back-button" type="button">Back</button>
                <input id="user-search" type="search">
                <select id="page-size-select">
                    <option value="12">12</option>
                    <option value="24" selected>24</option>
                    <option value="48">48</option>
                </select>

                <menu class="users-filter-menu">
                    <li><button id="filter-all" type="button" data-filter="all" aria-pressed="true">All</button></li>
                    <li><button id="filter-customer" type="button" data-filter="customer" aria-pressed="false">Customers</button></li>
                    <li><button id="filter-vendor" type="button" data-filter="vendor" aria-pressed="false">Vendors</button></li>
                    <li><button id="filter-admin" type="button" data-filter="admin" aria-pressed="false">Admins</button></li>
                    <li><button id="filter-pending-vendor" type="button" data-filter="pending-vendor" aria-pressed="false">Pending Vendor</button></li>
                    <li><button id="filter-pending-admin" type="button" data-filter="pending-admin" aria-pressed="false">Pending Admin</button></li>
                    <li><button id="filter-disabled" type="button" data-filter="disabled" aria-pressed="false">Disabled</button></li>
                </menu>

                <p id="users-status"></p>
                <output id="users-total-count">0</output>
                <output id="users-visible-count">0</output>
                <output id="users-pending-vendor-count">0</output>
                <output id="users-pending-admin-count">0</output>
                <output id="users-disabled-count">0</output>
                <output id="users-current-filter">All</output>
                <output id="users-range-summary"></output>
                <output id="users-page-indicator"></output>
                <button id="previous-page-button" type="button">Previous</button>
                <button id="next-page-button" type="button">Next</button>
                <section id="users-empty-state" hidden></section>
                <ul id="users-list"></ul>
            </section>
        </main>

        <dialog id="user-modal"></dialog>
        <button id="modal-close-button" type="button">Close</button>
        <h3 id="modal-user-name"></h3>
        <p id="modal-user-email"></p>
        <output id="modal-user-uid"></output>
        <output id="modal-user-role"></output>
        <output id="modal-user-vendor-status"></output>
        <output id="modal-user-admin-status"></output>
        <output id="modal-user-account-status"></output>
        <output id="modal-user-phone"></output>
        <textarea id="modal-review-note"></textarea>
        <p id="modal-warning"></p>
        <p id="modal-action-status"></p>
        <button id="modal-approve-vendor-button" type="button">Approve Vendor</button>
        <button id="modal-reject-vendor-button" type="button">Reject Vendor</button>
        <button id="modal-block-vendor-button" type="button">Block Vendor</button>
        <button id="modal-clear-vendor-button" type="button">Clear Vendor</button>
        <button id="modal-approve-admin-button" type="button">Approve Admin</button>
        <button id="modal-reject-admin-button" type="button">Reject Admin</button>
        <button id="modal-block-admin-button" type="button">Block Admin</button>
        <button id="modal-clear-admin-button" type="button">Clear Admin</button>
        <button id="modal-disable-account-button" type="button">Disable Account</button>
        <button id="modal-enable-account-button" type="button">Enable Account</button>
    `;

    const dialog = document.getElementById("user-modal");
    dialog.showModal = jest.fn(function showModal() {
        dialog.open = true;
    });
    dialog.close = jest.fn(function close() {
        dialog.open = false;
    });
}

function flushPromises() {
    return new Promise(function resolvePromise(resolve) {
        setTimeout(resolve, 0);
    });
}

function loadUsersModuleFresh() {
    jest.resetModules();
    require("../../public/admin/users.js");
    return window.usersPage;
}

function buildDependencies(options = {}) {
    const users =
        options.users ||
        [
            {
                uid: "admin-1",
                displayName: "Admin One",
                email: "admin@test.com",
                phoneNumber: "0710000001",
                isAdmin: true,
                vendorStatus: "none",
                adminApplicationStatus: "approved",
                accountStatus: "active"
            },
            {
                uid: "vendor-1",
                displayName: "Vendor One",
                email: "vendor@test.com",
                phoneNumber: "0710000002",
                isAdmin: false,
                vendorStatus: "approved",
                adminApplicationStatus: "none",
                accountStatus: "active"
            },
            {
                uid: "pending-vendor-1",
                displayName: "Pending Vendor",
                email: "pending-vendor@test.com",
                phoneNumber: "0710000003",
                isAdmin: false,
                vendorStatus: "pending",
                adminApplicationStatus: "none",
                accountStatus: "active"
            },
            {
                uid: "pending-admin-1",
                displayName: "Pending Admin",
                email: "pending-admin@test.com",
                phoneNumber: "0710000004",
                isAdmin: false,
                vendorStatus: "none",
                adminApplicationStatus: "pending",
                accountStatus: "active"
            },
            {
                uid: "customer-1",
                displayName: "Customer One",
                email: "customer@test.com",
                phoneNumber: "0710000005",
                isAdmin: false,
                vendorStatus: "none",
                adminApplicationStatus: "none",
                accountStatus: "active"
            },
            {
                uid: "disabled-1",
                displayName: "Disabled One",
                email: "disabled@test.com",
                phoneNumber: "0710000006",
                isAdmin: false,
                vendorStatus: "none",
                adminApplicationStatus: "none",
                accountStatus: "disabled"
            }
        ];

    const currentProfile =
        options.currentProfile || {
            uid: "admin-1",
            displayName: "Admin One",
            email: "admin@test.com",
            phoneNumber: "0710000001",
            isAdmin: true,
            vendorStatus: "none",
            adminApplicationStatus: "approved",
            accountStatus: "active"
        };

    const authUtils = {
        normaliseUserData: jest.fn(function normaliseUserData(user) {
            const safeUser = user || {};
            const isAdmin = safeUser.isAdmin === true;

            return {
                uid: safeUser.uid || "",
                displayName: safeUser.displayName || "",
                email: (safeUser.email || "").toLowerCase(),
                phoneNumber: safeUser.phoneNumber || "",
                photoURL: safeUser.photoURL || "",
                isAdmin,
                vendorStatus: safeUser.vendorStatus || "none",
                vendorReason: safeUser.vendorReason || "",
                adminApplicationStatus: isAdmin ? "approved" : (safeUser.adminApplicationStatus || "none"),
                adminApplicationReason: safeUser.adminApplicationReason || "",
                accountStatus: safeUser.accountStatus || "active"
            };
        }),
        canAccessAdminPortal: jest.fn(function canAccessAdminPortal(profile) {
            return profile && profile.isAdmin === true && profile.accountStatus === "active";
        })
    };

    const firestoreFns = {
        collection: jest.fn(function collection(db, name) {
            return { db, name };
        }),
        getDocs: jest.fn(async function getDocs() {
            if (options.getDocsError) {
                throw options.getDocsError;
            }

            return createMockSnapshot(users);
        }),
        doc: jest.fn(function doc(db, collectionName, uid) {
            return { db, collectionName, uid };
        }),
        updateDoc: jest.fn(async function updateDoc() {
            if (options.updateDocError) {
                throw options.updateDocError;
            }

            return true;
        })
    };

    const authService = {
        observeAuthState: jest.fn(function observeAuthState(callback) {
            callback(options.authUser === undefined ? { uid: currentProfile.uid } : options.authUser);
            return function unsubscribe() {
                return true;
            };
        }),
        getCurrentUserProfile: jest.fn(async function getCurrentUserProfile() {
            return options.getCurrentUserProfileResult === undefined
                ? currentProfile
                : options.getCurrentUserProfileResult;
        }),
        getUserProfile: jest.fn(async function getUserProfile() {
            return options.getUserProfileResult === undefined
                ? currentProfile
                : options.getUserProfileResult;
        })
    };

    return {
        authService,
        authUtils,
        db: { app: "test-db" },
        firestoreFns,
        navigate: jest.fn(),
        users,
        currentProfile
    };
}

describe("public/admin/users.js page coverage", () => {
    let consoleErrorSpy;

    beforeEach(() => {
        createDom();
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(function noop() {
            return undefined;
        });
    });

    afterEach(() => {
        document.body.innerHTML = "";
        if (consoleErrorSpy) {
            consoleErrorSpy.mockRestore();
        }
        jest.clearAllMocks();
    });

    test("initialize loads users and renders summary, counts, and rows", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        expect(deps.authService.observeAuthState).toHaveBeenCalled();
        expect(deps.firestoreFns.collection).toHaveBeenCalledWith(deps.db, "users");
        expect(deps.firestoreFns.getDocs).toHaveBeenCalled();
        expect(document.getElementById("users-total-count").textContent).toBe("6");
        expect(document.getElementById("users-visible-count").textContent).toBe("6");
        expect(document.getElementById("users-pending-vendor-count").textContent).toBe("1");
        expect(document.getElementById("users-pending-admin-count").textContent).toBe("1");
        expect(document.getElementById("users-disabled-count").textContent).toBe("1");
        expect(document.getElementById("users-status").textContent).toBe("Users loaded successfully.");
        expect(document.querySelectorAll('button[data-action="open-manage-modal"]').length).toBe(6);
    });

    test("search input filters rendered users", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        const searchInput = document.getElementById("user-search");
        searchInput.value = "pending admin";
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));

        expect(document.getElementById("users-visible-count").textContent).toBe("1");
        expect(document.getElementById("users-list").textContent).toContain("Pending Admin");
        expect(document.getElementById("users-list").textContent).not.toContain("Vendor One");
    });

    test("pending vendor filter works", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        document.getElementById("filter-pending-vendor").click();

        expect(document.getElementById("users-current-filter").textContent).toBe("Pending Vendor");
        expect(document.getElementById("users-visible-count").textContent).toBe("1");
        expect(document.getElementById("users-list").textContent).toContain("Pending Vendor");
    });

    test("disabled filter shows disabled users", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        document.getElementById("filter-disabled").click();

        expect(document.getElementById("users-current-filter").textContent).toBe("Disabled");
        expect(document.getElementById("users-visible-count").textContent).toBe("1");
        expect(document.getElementById("users-list").textContent).toContain("Disabled One");
    });

    test("empty state appears when there are no matches", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        const searchInput = document.getElementById("user-search");
        searchInput.value = "zzzz-no-match";
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));

        expect(document.getElementById("users-visible-count").textContent).toBe("0");
        expect(document.getElementById("users-empty-state").hidden).toBe(false);
    });

    test("pagination responds to page size changes", async () => {
        const manyUsers = Array.from({ length: 30 }, function createUser(_, index) {
            return {
                uid: `user-${index + 1}`,
                displayName: `User ${index + 1}`,
                email: `user${index + 1}@test.com`,
                phoneNumber: `0710000${index + 1}`,
                isAdmin: false,
                vendorStatus: "none",
                adminApplicationStatus: "none",
                accountStatus: "active"
            };
        });

        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies({ users: manyUsers });

        await usersPage.initialize(deps);
        await flushPromises();

        expect(document.getElementById("users-page-indicator").textContent).toBe("Page 1 of 2");

        document.getElementById("next-page-button").click();
        expect(document.getElementById("users-page-indicator").textContent).toBe("Page 2 of 2");

        const pageSizeSelect = document.getElementById("page-size-select");
        pageSizeSelect.value = "48";
        pageSizeSelect.dispatchEvent(new Event("change", { bubbles: true }));

        expect(document.getElementById("users-page-indicator").textContent).toBe("Page 1 of 1");
    });

    test("opening the manage modal renders selected user details", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        const manageButton = Array.from(document.querySelectorAll('button[data-action="open-manage-modal"]'))
            .find(function findButton(button) {
                return button.dataset.uid === "pending-admin-1";
            });

        manageButton.click();

        expect(document.getElementById("modal-user-name").textContent).toBe("Pending Admin");
        expect(document.getElementById("modal-user-admin-status").textContent).toBe("Pending");
        expect(document.getElementById("user-modal").showModal).toHaveBeenCalled();
    });

    test("approve vendor action updates firestore and reloads", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        const manageButton = Array.from(document.querySelectorAll('button[data-action="open-manage-modal"]'))
            .find(function findButton(button) {
                return button.dataset.uid === "pending-vendor-1";
            });

        manageButton.click();
        document.getElementById("modal-approve-vendor-button").click();
        await flushPromises();
        await flushPromises();

        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            { db: deps.db, collectionName: "users", uid: "pending-vendor-1" },
            {
                vendorStatus: "approved",
                vendorReason: "",
                accountStatus: "active"
            }
        );
        expect(document.getElementById("users-status").textContent).toBe("Vendor application approved.");
    });

    test("reject admin requires a reason", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        const manageButton = Array.from(document.querySelectorAll('button[data-action="open-manage-modal"]'))
            .find(function findButton(button) {
                return button.dataset.uid === "pending-admin-1";
            });

        manageButton.click();
        document.getElementById("modal-review-note").value = "";
        document.getElementById("modal-reject-admin-button").click();
        await flushPromises();

        expect(deps.firestoreFns.updateDoc).not.toHaveBeenCalled();
        expect(document.getElementById("modal-action-status").textContent)
            .toBe("Please add a short reason before rejecting or blocking an application.");
    });

    test("reject admin updates firestore when reason exists", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        const manageButton = Array.from(document.querySelectorAll('button[data-action="open-manage-modal"]'))
            .find(function findButton(button) {
                return button.dataset.uid === "pending-admin-1";
            });

        manageButton.click();
        document.getElementById("modal-review-note").value = "Missing justification";
        document.getElementById("modal-reject-admin-button").click();
        await flushPromises();
        await flushPromises();

        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            { db: deps.db, collectionName: "users", uid: "pending-admin-1" },
            {
                isAdmin: false,
                adminApplicationStatus: "rejected",
                adminApplicationReason: "Missing justification"
            }
        );
    });

    test("self disable is blocked in the modal", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        const manageButton = Array.from(document.querySelectorAll('button[data-action="open-manage-modal"]'))
            .find(function findButton(button) {
                return button.dataset.uid === "admin-1";
            });

        manageButton.click();
        expect(document.getElementById("modal-disable-account-button").disabled).toBe(true);
    });

    test("enable account action updates firestore", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        const manageButton = Array.from(document.querySelectorAll('button[data-action="open-manage-modal"]'))
            .find(function findButton(button) {
                return button.dataset.uid === "disabled-1";
            });

        manageButton.click();
        document.getElementById("modal-enable-account-button").click();
        await flushPromises();
        await flushPromises();

        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            { db: deps.db, collectionName: "users", uid: "disabled-1" },
            { accountStatus: "active" }
        );
    });

    test("back button uses injected navigation", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        document.getElementById("back-button").click();

        expect(deps.navigate).toHaveBeenCalledWith("./index.html");
    });

    test("close button closes the modal", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        const manageButton = Array.from(document.querySelectorAll('button[data-action="open-manage-modal"]'))
            .find(function findButton(button) {
                return button.dataset.uid === "customer-1";
            });

        manageButton.click();
        document.getElementById("modal-close-button").click();

        expect(document.getElementById("user-modal").close).toHaveBeenCalled();
    });

    test("load failure sets error status", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies({
            getDocsError: new Error("Firestore failed")
        });

        await usersPage.initialize(deps);
        await flushPromises();

        expect(document.getElementById("users-status").textContent).toBe("Failed to load users.");
        expect(document.getElementById("users-status").dataset.state).toBe("error");
    });

    test("update failure sets error status", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies({
            updateDocError: new Error("Update failed")
        });

        await usersPage.initialize(deps);
        await flushPromises();

        const manageButton = Array.from(document.querySelectorAll('button[data-action="open-manage-modal"]'))
            .find(function findButton(button) {
                return button.dataset.uid === "pending-vendor-1";
            });

        manageButton.click();
        document.getElementById("modal-approve-vendor-button").click();
        await flushPromises();

        expect(document.getElementById("users-status").textContent).toBe("Failed to update the user.");
    });

    test("unauthenticated users are redirected to login", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies({
            authUser: null
        });

        await usersPage.initialize(deps);
        await flushPromises();

<<<<<<< HEAD
        expect(window.location.assign).toHaveBeenCalledWith("../authentication/login.html");
        expect(window.location.href).toContain("../authentication/login.html");
=======
        expect(deps.navigate).toHaveBeenCalledWith("../authentication/login.html");
>>>>>>> 8e296d9719a43ffbd84bc3f99b698be2509d4171
    });

    test("users without admin access are blocked", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies({
            currentProfile: {
                uid: "customer-1",
                displayName: "Customer One",
                email: "customer@test.com",
                phoneNumber: "0710000005",
                isAdmin: false,
                vendorStatus: "none",
                adminApplicationStatus: "none",
                accountStatus: "active"
            }
        });

        await usersPage.initialize(deps);
        await flushPromises();

        expect(document.getElementById("users-status").textContent).toBe("You are not allowed to access this page.");
        expect(deps.navigate).toHaveBeenCalledWith("./index.html");
    });

    test("helper exports behave correctly", () => {
        jest.resetModules();
        const helpers = require("../../public/admin/users.js");

        expect(
            helpers.getUserRoleLabel({
                isAdmin: true,
                vendorStatus: "approved"
            })
        ).toBe("Admin and Vendor");

        expect(
            helpers.getVendorStatusLabel({
                vendorStatus: "blocked"
            })
        ).toBe("Blocked");

        expect(
            helpers.getAdminStatusLabel({
                isAdmin: false,
                adminApplicationStatus: "pending"
            })
        ).toBe("Pending");

        expect(
            helpers.matchesFilter(
                {
                    isAdmin: false,
                    vendorStatus: "none",
                    adminApplicationStatus: "pending",
                    accountStatus: "active"
                },
                "pending-admin"
            )
        ).toBe(true);

        expect(
            helpers.paginateUsers([
                { uid: "1" },
                { uid: "2" },
                { uid: "3" }
            ], 2, 2)
        ).toEqual({
            currentPage: 2,
            pageSize: 2,
            totalPages: 2,
            startIndex: 2,
            endIndex: 3,
            items: [{ uid: "3" }]
        });

        expect(
            helpers.getSummaryCounts([
                { vendorStatus: "pending", isAdmin: false, adminApplicationStatus: "none", accountStatus: "active" },
                { vendorStatus: "none", isAdmin: false, adminApplicationStatus: "pending", accountStatus: "active" },
                { vendorStatus: "none", isAdmin: false, adminApplicationStatus: "none", accountStatus: "disabled" }
            ])
        ).toEqual({
            total: 3,
            pendingVendor: 1,
            pendingAdmin: 1,
            disabled: 1
        });

        expect(
            helpers.buildPatchForAction("block-admin", "Policy breach")
        ).toEqual({
            isAdmin: false,
            adminApplicationStatus: "blocked",
            adminApplicationReason: "Policy breach"
        });

        expect(
            helpers.normalizeUserRecord(null, {
                uid: " user-9 ",
                displayName: " User Nine ",
                email: " USER9@Test.com ",
                phoneNumber: " 071 123 4567 ",
                vendorStatus: "suspended",
                adminApplicationStatus: "suspended",
                accountStatus: "inactive"
            }, "fallback")
        ).toEqual(expect.objectContaining({
            uid: " user-9 ",
            displayName: "User Nine",
            email: "user9@test.com",
            vendorStatus: "blocked",
            adminApplicationStatus: "blocked",
            accountStatus: "active"
        }));

        expect(
            helpers.matchesSearch(
                {
                    displayName: "Faranani",
                    email: "faranani@test.com",
                    uid: "abc-1",
                    phoneNumber: "0710000000",
                    isAdmin: false,
                    vendorStatus: "none",
                    adminApplicationStatus: "none",
                    accountStatus: "blocked"
                },
                "0710000000"
            )
        ).toBe(true);

        expect(
            helpers.matchesSearch(
                {
                    displayName: "Faranani",
                    email: "faranani@test.com",
                    uid: "abc-1",
                    phoneNumber: "0710000000",
                    isAdmin: false,
                    vendorStatus: "none",
                    adminApplicationStatus: "none",
                    accountStatus: "blocked"
                },
                "nomatch"
            )
        ).toBe(false);

        expect(
            helpers.matchesFilter(
                {
                    isAdmin: false,
                    vendorStatus: "approved",
                    adminApplicationStatus: "none",
                    accountStatus: "active"
                },
                "vendor"
            )
        ).toBe(true);

        expect(
            helpers.matchesFilter(
                {
                    isAdmin: true,
                    vendorStatus: "none",
                    adminApplicationStatus: "approved",
                    accountStatus: "active"
                },
                "admin"
            )
        ).toBe(true);

        expect(
            helpers.matchesFilter(
                {
                    isAdmin: false,
                    vendorStatus: "pending",
                    adminApplicationStatus: "none",
                    accountStatus: "active"
                },
                "pending-vendor"
            )
        ).toBe(true);

        expect(
            helpers.matchesFilter(
                {
                    isAdmin: false,
                    vendorStatus: "none",
                    adminApplicationStatus: "none",
                    accountStatus: "disabled"
                },
                "disabled"
            )
        ).toBe(true);

        expect(
            helpers.getAccountStatusLabel({
                accountStatus: "blocked"
            })
        ).toBe("Blocked");

        expect(
            helpers.buildPatchForAction("unknown-action")
        ).toBeNull();
    });
});
