/**
 * tests/admin-tests/users.test.js
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
    <header>
      <nav>
        <a href="../index.html">Home</a>
      </nav>
    </header>

    <main>
      <section class="page-hero">
        <h2>Manage users</h2>
        <menu class="page-actions">
          <li><button id="back-button" type="button">Back</button></li>
        </menu>
      </section>

      <section class="users-toolbar">
        <article class="users-search-panel">
          <p>
            <input id="user-search" type="search" placeholder="Search users">
          </p>

          <menu class="filter-menu" aria-label="User filters">
            <li><button id="filter-all" type="button" data-filter="all" aria-pressed="true">All</button></li>
            <li><button id="filter-customer" type="button" data-filter="customer" aria-pressed="false">Customers</button></li>
            <li><button id="filter-vendor" type="button" data-filter="vendor" aria-pressed="false">Vendors</button></li>
            <li><button id="filter-admin" type="button" data-filter="admin" aria-pressed="false">Admins</button></li>
            <li><button id="filter-owner" type="button" data-filter="owner" aria-pressed="false">Owners</button></li>
            <li><button id="filter-pending" type="button" data-filter="pending" aria-pressed="false">Pending vendors</button></li>
            <li><button id="filter-disabled" type="button" data-filter="disabled" aria-pressed="false">Disabled</button></li>
          </menu>
        </article>

        <article class="users-summary-panel">
          <p><output id="users-total-count">0</output></p>
          <p><output id="users-visible-count">0</output></p>
          <p><output id="users-current-filter">All</output></p>
          <p id="users-status" aria-live="polite">Loading users...</p>
        </article>
      </section>

      <section class="users-results">
        <ul id="users-list" class="users-list"></ul>
      </section>
    </main>
  `;
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
                uid: "owner-1",
                displayName: "Owner One",
                email: "owner@test.com",
                phoneNumber: "0710000001",
                isOwner: true,
                isAdmin: true,
                vendorStatus: "approved",
                accountStatus: "active"
            },
            {
                uid: "admin-1",
                displayName: "Admin One",
                email: "admin@test.com",
                phoneNumber: "0710000002",
                isOwner: false,
                isAdmin: true,
                vendorStatus: "none",
                accountStatus: "active"
            },
            {
                uid: "vendor-1",
                displayName: "Vendor One",
                email: "vendor@test.com",
                phoneNumber: "0710000003",
                isOwner: false,
                isAdmin: false,
                vendorStatus: "approved",
                accountStatus: "active"
            },
            {
                uid: "pending-1",
                displayName: "Pending One",
                email: "pending@test.com",
                phoneNumber: "0710000004",
                isOwner: false,
                isAdmin: false,
                vendorStatus: "pending",
                accountStatus: "active"
            },
            {
                uid: "customer-1",
                displayName: "Customer One",
                email: "customer@test.com",
                phoneNumber: "0710000005",
                isOwner: false,
                isAdmin: false,
                vendorStatus: "none",
                accountStatus: "active"
            },
            {
                uid: "disabled-1",
                displayName: "Disabled One",
                email: "disabled@test.com",
                phoneNumber: "0710000006",
                isOwner: false,
                isAdmin: false,
                vendorStatus: "none",
                accountStatus: "disabled"
            }
        ];

    const currentProfile =
        options.currentProfile || {
            uid: "owner-1",
            displayName: "Owner One",
            email: "owner@test.com",
            isOwner: true,
            isAdmin: true,
            vendorStatus: "approved",
            accountStatus: "active"
        };

    const authUtils = {
        normaliseUserData: jest.fn(function normaliseUserData(user) {
            const safeUser = user || {};
            return {
                uid: safeUser.uid || "",
                displayName: safeUser.displayName || "",
                email: (safeUser.email || "").toLowerCase(),
                phoneNumber: safeUser.phoneNumber || "",
                vendorStatus: safeUser.vendorStatus || "none",
                accountStatus: safeUser.accountStatus || "active",
                isAdmin: safeUser.isAdmin === true,
                isOwner: safeUser.isOwner === true
            };
        }),
        canAccessAdminPortal: jest.fn(function canAccessAdminPortal(profile) {
            return profile && (profile.isAdmin === true || profile.isOwner === true);
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
        users,
        currentProfile
    };
}

describe("public/admin/users.js page coverage", () => {
    beforeEach(() => {
        createDom();
    });

    afterEach(() => {
        document.body.innerHTML = "";
        jest.clearAllMocks();
    });

    test("initialize loads users and renders summary and cards", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        expect(deps.authService.observeAuthState).toHaveBeenCalled();
        expect(deps.firestoreFns.collection).toHaveBeenCalledWith(deps.db, "users");
        expect(deps.firestoreFns.getDocs).toHaveBeenCalled();

        expect(document.getElementById("users-total-count").textContent).toBe("6");
        expect(document.getElementById("users-visible-count").textContent).toBe("6");
        expect(document.getElementById("users-current-filter").textContent).toBe("All");
        expect(document.getElementById("users-status").textContent).toBe("Users loaded successfully.");

        const cards = document.querySelectorAll(".user-card-item");
        expect(cards.length).toBe(6);
        expect(document.getElementById("users-list").textContent).toContain("Owner One");
        expect(document.getElementById("users-list").textContent).toContain("Pending One");
    });

    test("search input filters the rendered users", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        const searchInput = document.getElementById("user-search");
        searchInput.value = "pending";
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));

        expect(document.getElementById("users-visible-count").textContent).toBe("1");
        expect(document.getElementById("users-list").textContent).toContain("Pending One");
        expect(document.getElementById("users-list").textContent).not.toContain("Customer One");
    });

    test("owner filter works and updates pressed state", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        const ownerButton = document.getElementById("filter-owner");
        ownerButton.click();

        expect(ownerButton.getAttribute("aria-pressed")).toBe("true");
        expect(document.getElementById("users-current-filter").textContent).toBe("Owners");
        expect(document.getElementById("users-visible-count").textContent).toBe("1");
        expect(document.getElementById("users-list").textContent).toContain("Owner One");
        expect(document.getElementById("users-list").textContent).not.toContain("Admin One");
    });

    test("pending filter shows only pending vendors", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        document.getElementById("filter-pending").click();

        expect(document.getElementById("users-current-filter").textContent).toBe("Pending vendors");
        expect(document.getElementById("users-visible-count").textContent).toBe("1");
        expect(document.getElementById("users-list").textContent).toContain("Pending One");
        expect(document.getElementById("users-list").textContent).not.toContain("Vendor One");
    });

    test("disabled filter shows disabled accounts", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        document.getElementById("filter-disabled").click();

        expect(document.getElementById("users-current-filter").textContent).toBe("Disabled");
        expect(document.getElementById("users-visible-count").textContent).toBe("1");
        expect(document.getElementById("users-list").textContent).toContain("Disabled One");
        expect(document.getElementById("users-list").textContent).not.toContain("Customer One");
    });

    test("shows empty state when no users match", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        const searchInput = document.getElementById("user-search");
        searchInput.value = "zzzz-no-match";
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));

        expect(document.getElementById("users-visible-count").textContent).toBe("0");
        expect(document.getElementById("users-list").textContent).toContain("No matching users");
        expect(document.getElementById("users-list").textContent).toContain("Try another search or filter.");
    });

    test("approve vendor action updates Firestore and reloads", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        const approveButton = Array.from(document.querySelectorAll('button[data-action="approve-vendor"]'))
            .find(function findButton(button) {
                return button.dataset.uid === "pending-1";
            });

        expect(approveButton).toBeTruthy();
        expect(approveButton.disabled).toBe(false);

        approveButton.click();
        await flushPromises();
        await flushPromises();

        expect(deps.firestoreFns.doc).toHaveBeenCalledWith(deps.db, "users", "pending-1");
        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            { db: deps.db, collectionName: "users", uid: "pending-1" },
            {
                vendorStatus: "approved",
                vendorReason: "",
                accountStatus: "active"
            }
        );
        expect(document.getElementById("users-status").textContent).toBe("User updated successfully.");
    });

    test("enable account action updates Firestore", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        const enableButton = Array.from(document.querySelectorAll('button[data-action="enable-account"]'))
            .find(function findButton(button) {
                return button.dataset.uid === "disabled-1";
            });

        expect(enableButton).toBeTruthy();
        expect(enableButton.disabled).toBe(false);

        enableButton.click();
        await flushPromises();
        await flushPromises();

        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            { db: deps.db, collectionName: "users", uid: "disabled-1" },
            { accountStatus: "active" }
        );
    });

    test("owner cannot remove owner access from themselves", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        const removeOwnerButton = Array.from(document.querySelectorAll('button[data-action="remove-owner"]'))
            .find(function findButton(button) {
                return button.dataset.uid === "owner-1";
            });

        expect(removeOwnerButton).toBeTruthy();
        expect(removeOwnerButton.disabled).toBe(true);

        removeOwnerButton.click();
        await flushPromises();

        expect(deps.firestoreFns.updateDoc).not.toHaveBeenCalledWith(
            expect.anything(),
            { isOwner: false }
        );
    });

    test("owner cannot disable their own account", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        const disableSelfButton = Array.from(document.querySelectorAll('button[data-action="disable-account"]'))
            .find(function findButton(button) {
                return button.dataset.uid === "owner-1";
            });

        expect(disableSelfButton).toBeTruthy();
        expect(disableSelfButton.disabled).toBe(true);

        disableSelfButton.click();
        await flushPromises();

        expect(deps.firestoreFns.updateDoc).not.toHaveBeenCalledWith(
            expect.anything(),
            { accountStatus: "disabled" }
        );
    });

    test("non-owner admin cannot manage owner or other admin accounts", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies({
            currentProfile: {
                uid: "admin-1",
                displayName: "Admin One",
                email: "admin@test.com",
                isOwner: false,
                isAdmin: true,
                vendorStatus: "none",
                accountStatus: "active"
            }
        });

        await usersPage.initialize(deps);
        await flushPromises();

        const makeOwnerForCustomer = Array.from(document.querySelectorAll('button[data-action="make-owner"]'))
            .find(function findButton(button) {
                return button.dataset.uid === "customer-1";
            });

        const approveOwnerVendor = Array.from(document.querySelectorAll('button[data-action="approve-vendor"]'))
            .find(function findButton(button) {
                return button.dataset.uid === "owner-1";
            });

        const removeAdminFromAdmin = Array.from(document.querySelectorAll('button[data-action="remove-admin"]'))
            .find(function findButton(button) {
                return button.dataset.uid === "admin-1";
            });

        expect(makeOwnerForCustomer.disabled).toBe(true);
        expect(approveOwnerVendor.disabled).toBe(true);
        expect(removeAdminFromAdmin.disabled).toBe(true);
    });

    test("owner can make another user an owner", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies();

        await usersPage.initialize(deps);
        await flushPromises();

        const makeOwnerButton = Array.from(document.querySelectorAll('button[data-action="make-owner"]'))
            .find(function findButton(button) {
                return button.dataset.uid === "customer-1";
            });

        expect(makeOwnerButton).toBeTruthy();
        expect(makeOwnerButton.disabled).toBe(false);

        makeOwnerButton.click();
        await flushPromises();
        await flushPromises();

        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            { db: deps.db, collectionName: "users", uid: "customer-1" },
            {
                isOwner: true,
                isAdmin: true
            }
        );
    });

    test("loadUsers failure sets failure status", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies({
            getDocsError: new Error("Firestore failed")
        });

        await usersPage.initialize(deps);
        await flushPromises();

        expect(document.getElementById("users-status").textContent).toBe("Failed to load users.");
    });

    test("update failure sets failure status and does not crash", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies({
            updateDocError: new Error("Update failed")
        });

        await usersPage.initialize(deps);
        await flushPromises();

        const approveButton = Array.from(document.querySelectorAll('button[data-action="approve-vendor"]'))
            .find(function findButton(button) {
                return button.dataset.uid === "pending-1";
            });

        approveButton.click();
        await flushPromises();

        expect(document.getElementById("users-status").textContent).toBe("Failed to update the user.");
    });

    test("unauthenticated users are redirected to login path", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies({
            authUser: null
        });

        const originalHref = window.location.href;

        await usersPage.initialize(deps);
        await flushPromises();

        expect(window.location.assign).toHaveBeenCalledWith("../authentication/login.html");
        expect(window.location.href).toContain("../authentication/login.html");
    });

    test("users without admin access are blocked", async () => {
        const usersPage = loadUsersModuleFresh();
        const deps = buildDependencies({
            currentProfile: {
                uid: "customer-1",
                displayName: "Customer One",
                email: "customer@test.com",
                isOwner: false,
                isAdmin: false,
                vendorStatus: "none",
                accountStatus: "active"
            }
        });

        await usersPage.initialize(deps);
        await flushPromises();

        expect(document.getElementById("users-status").textContent).toBe("You are not allowed to access this page.");
    });

    test("helper exports still behave correctly", () => {
        jest.resetModules();
        const helpers = require("../../public/admin/users.js");

        expect(
            helpers.getUserPrimaryRoleLabel({
                isOwner: true,
                isAdmin: true,
                vendorStatus: "approved"
            })
        ).toBe("Owner");

        expect(
            helpers.matchesFilter(
                {
                    isOwner: false,
                    isAdmin: false,
                    vendorStatus: "pending",
                    accountStatus: "active"
                },
                "pending"
            )
        ).toBe(true);

        expect(
            helpers.buildPatchForAction("remove-owner")
        ).toEqual({ isOwner: false });

        expect(
            helpers.sortUsers([
                { displayName: "Zanele", email: "", uid: "2" },
                { displayName: "Aphiwe", email: "", uid: "1" }
            ])[0].displayName
        ).toBe("Aphiwe");
    });
});