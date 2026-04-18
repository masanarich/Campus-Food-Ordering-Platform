(function attachUsersPage(globalScope) {
    "use strict";

    const DEFAULT_FILTER = "all";

    const state = {
        authService: null,
        authUtils: null,
        db: null,
        firestoreFns: null,
        currentAdminUser: null,
        currentAdminProfile: null,
        users: [],
        activeFilter: DEFAULT_FILTER,
        searchQuery: ""
    };

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeUserRecord(authUtils, userRecord, fallbackUid) {
        const safeRecord = userRecord && typeof userRecord === "object" ? userRecord : {};
        const normalized =
            authUtils && typeof authUtils.normaliseUserData === "function"
                ? authUtils.normaliseUserData({
                    ...safeRecord,
                    uid: safeRecord.uid || fallbackUid || ""
                })
                : {
                    ...safeRecord,
                    uid: safeRecord.uid || fallbackUid || "",
                    displayName: normalizeText(safeRecord.displayName),
                    email: normalizeText(safeRecord.email).toLowerCase(),
                    phoneNumber: normalizeText(safeRecord.phoneNumber),
                    vendorStatus: normalizeText(safeRecord.vendorStatus).toLowerCase() || "none",
                    accountStatus: normalizeText(safeRecord.accountStatus).toLowerCase() || "active",
                    isAdmin: safeRecord.isAdmin === true,
                    isOwner: safeRecord.isOwner === true
                };

        return {
            ...safeRecord,
            ...normalized,
            uid: normalized.uid || fallbackUid || "",
            displayName: normalized.displayName || "Unnamed User",
            email: normalized.email || "",
            phoneNumber: normalized.phoneNumber || "",
            vendorStatus: normalized.vendorStatus || "none",
            accountStatus: normalized.accountStatus || "active",
            isAdmin: normalized.isAdmin === true,
            isOwner: normalized.isOwner === true
        };
    }

    function getUserPrimaryRoleLabel(user) {
        if (user.isOwner) {
            return "Owner";
        }

        if (user.isAdmin) {
            return "Admin";
        }

        if (user.vendorStatus === "approved") {
            return "Vendor";
        }

        return "Customer";
    }

    function getVendorStatusLabel(user) {
        switch (user.vendorStatus) {
            case "approved":
                return "Approved vendor";
            case "pending":
                return "Pending vendor";
            case "blocked":
                return "Suspended vendor";
            case "rejected":
                return "Rejected vendor";
            default:
                return "Not a vendor";
        }
    }

    function getAccountStatusLabel(user) {
        switch (user.accountStatus) {
            case "disabled":
                return "Disabled";
            case "blocked":
                return "Blocked";
            default:
                return "Active";
        }
    }

    function matchesSearch(user, query) {
        const q = normalizeText(query).toLowerCase();

        if (!q) {
            return true;
        }

        return [
            user.displayName,
            user.email,
            user.uid,
            user.phoneNumber,
            getUserPrimaryRoleLabel(user),
            user.vendorStatus,
            user.accountStatus
        ]
            .join(" ")
            .toLowerCase()
            .includes(q);
    }

    function matchesFilter(user, filterName) {
        switch (filterName) {
            case "customer":
                return !user.isOwner && !user.isAdmin && user.vendorStatus !== "approved";
            case "vendor":
                return user.vendorStatus === "approved";
            case "admin":
                return user.isAdmin === true && user.isOwner !== true;
            case "owner":
                return user.isOwner === true;
            case "pending":
                return user.vendorStatus === "pending";
            case "disabled":
                return user.accountStatus === "disabled" || user.accountStatus === "blocked";
            default:
                return true;
        }
    }

    function sortUsers(userList) {
        return [...userList].sort(function compareUsers(a, b) {
            const first = (a.displayName || a.email || a.uid || "").toLowerCase();
            const second = (b.displayName || b.email || b.uid || "").toLowerCase();

            return first.localeCompare(second);
        });
    }

    function getVisibleUsers() {
        return sortUsers(
            state.users.filter(function filterUser(user) {
                return (
                    matchesFilter(user, state.activeFilter) &&
                    matchesSearch(user, state.searchQuery)
                );
            })
        );
    }

    function setStatus(message) {
        const element = document.getElementById("users-status");

        if (element) {
            element.textContent = message;
        }
    }

    function getFilterLabel(filterName) {
        switch (filterName) {
            case "customer":
                return "Customers";
            case "vendor":
                return "Vendors";
            case "admin":
                return "Admins";
            case "owner":
                return "Owners";
            case "pending":
                return "Pending vendors";
            case "disabled":
                return "Disabled";
            default:
                return "All";
        }
    }

    function updateSummary(visibleUsers) {
        const totalCount = document.getElementById("users-total-count");
        const visibleCount = document.getElementById("users-visible-count");
        const currentFilter = document.getElementById("users-current-filter");

        if (totalCount) {
            totalCount.textContent = String(state.users.length);
        }

        if (visibleCount) {
            visibleCount.textContent = String(visibleUsers.length);
        }

        if (currentFilter) {
            currentFilter.textContent = getFilterLabel(state.activeFilter);
        }
    }

    function setPressedFilterButton() {
        document.querySelectorAll("button[data-filter]").forEach(function updateButton(button) {
            const isActive = button.dataset.filter === state.activeFilter;
            button.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    }

    function createBadge(text, badgeClassName) {
        const mark = document.createElement("mark");
        mark.className = badgeClassName;
        mark.textContent = text;
        return mark;
    }

    function buildActionButton(label, actionName, uid, disabled) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.dataset.action = actionName;
        button.dataset.uid = uid;

        if (disabled) {
            button.disabled = true;
        }

        return button;
    }

    function isSelfTarget(targetUser) {
        if (!state.currentAdminProfile || !targetUser) {
            return false;
        }

        return (
            normalizeText(state.currentAdminProfile.uid) !== "" &&
            normalizeText(state.currentAdminProfile.uid) === normalizeText(targetUser.uid)
        );
    }

    function canManageUser(targetUser) {
        if (!state.currentAdminProfile) {
            return false;
        }

        if (!state.authUtils || typeof state.authUtils.canAccessAdminPortal !== "function") {
            return false;
        }

        if (!state.authUtils.canAccessAdminPortal(state.currentAdminProfile)) {
            return false;
        }

        const currentIsOwner = state.currentAdminProfile.isOwner === true;
        const currentIsAdmin = state.currentAdminProfile.isAdmin === true;

        if (currentIsOwner) {
            return true;
        }

        if (currentIsAdmin) {
            if (targetUser.isOwner === true) {
                return false;
            }

            if (targetUser.isAdmin === true) {
                return false;
            }

            return true;
        }

        return false;
    }

    function renderUserCard(user) {
        const listItem = document.createElement("li");
        listItem.className = "user-card-item";

        const article = document.createElement("article");
        article.className = "user-card";

        const heading = document.createElement("h4");
        heading.textContent = user.displayName || "Unnamed User";

        const email = document.createElement("p");
        email.textContent = user.email || "No email";

        const uid = document.createElement("p");
        uid.textContent = "UID: " + (user.uid || "-");

        const meta = document.createElement("p");
        meta.className = "user-card-meta";

        meta.appendChild(createBadge(getUserPrimaryRoleLabel(user), "user-badge user-badge-role"));
        meta.appendChild(document.createTextNode(" "));
        meta.appendChild(createBadge(getVendorStatusLabel(user), "user-badge user-badge-vendor"));
        meta.appendChild(document.createTextNode(" "));
        meta.appendChild(createBadge(getAccountStatusLabel(user), "user-badge user-badge-account"));

        const actionsHeading = document.createElement("h5");
        actionsHeading.textContent = "Actions";

        const actionsMenu = document.createElement("menu");
        actionsMenu.className = "user-actions";

        const actionItems = [];
        const isManageable = canManageUser(user);
        const selfTarget = isSelfTarget(user);
        const currentIsOwner = state.currentAdminProfile && state.currentAdminProfile.isOwner === true;

        actionItems.push(
            buildActionButton(
                "Approve vendor",
                "approve-vendor",
                user.uid,
                !isManageable || user.vendorStatus === "approved"
            )
        );

        actionItems.push(
            buildActionButton(
                "Suspend vendor",
                "suspend-vendor",
                user.uid,
                !isManageable || user.vendorStatus !== "approved"
            )
        );

        actionItems.push(
            buildActionButton(
                "Clear vendor",
                "clear-vendor",
                user.uid,
                !isManageable || user.vendorStatus === "none"
            )
        );

        actionItems.push(
            buildActionButton(
                "Make admin",
                "make-admin",
                user.uid,
                !isManageable || user.isAdmin === true
            )
        );

        actionItems.push(
            buildActionButton(
                "Remove admin",
                "remove-admin",
                user.uid,
                !isManageable || user.isAdmin !== true || user.isOwner === true
            )
        );

        actionItems.push(
            buildActionButton(
                "Make owner",
                "make-owner",
                user.uid,
                !currentIsOwner || !isManageable || user.isOwner === true
            )
        );

        actionItems.push(
            buildActionButton(
                "Remove owner",
                "remove-owner",
                user.uid,
                !currentIsOwner || !isManageable || user.isOwner !== true || selfTarget
            )
        );

        actionItems.push(
            buildActionButton(
                "Disable account",
                "disable-account",
                user.uid,
                !isManageable || user.accountStatus === "disabled" || selfTarget
            )
        );

        actionItems.push(
            buildActionButton(
                "Enable account",
                "enable-account",
                user.uid,
                !isManageable || user.accountStatus === "active"
            )
        );

        actionItems.forEach(function appendAction(button) {
            const actionItem = document.createElement("li");
            actionItem.appendChild(button);
            actionsMenu.appendChild(actionItem);
        });

        article.appendChild(heading);
        article.appendChild(email);
        article.appendChild(uid);
        article.appendChild(meta);
        article.appendChild(actionsHeading);
        article.appendChild(actionsMenu);

        listItem.appendChild(article);

        return listItem;
    }

    function renderUsers() {
        const list = document.getElementById("users-list");
        const visibleUsers = getVisibleUsers();

        if (!list) {
            return;
        }

        list.innerHTML = "";

        if (visibleUsers.length === 0) {
            const emptyItem = document.createElement("li");
            const emptyArticle = document.createElement("article");
            const emptyHeading = document.createElement("h4");
            const emptyText = document.createElement("p");

            emptyHeading.textContent = "No matching users";
            emptyText.textContent = "Try another search or filter.";

            emptyArticle.className = "user-card user-card-empty";
            emptyArticle.appendChild(emptyHeading);
            emptyArticle.appendChild(emptyText);
            emptyItem.appendChild(emptyArticle);
            list.appendChild(emptyItem);

            updateSummary(visibleUsers);
            return;
        }

        visibleUsers.forEach(function appendUser(user) {
            list.appendChild(renderUserCard(user));
        });

        updateSummary(visibleUsers);
    }

    async function loadUsers() {
        const firestoreFns = state.firestoreFns;
        const db = state.db;

        setStatus("Loading users...");

        try {
            const usersCollection = firestoreFns.collection(db, "users");
            const snapshot = await firestoreFns.getDocs(usersCollection);
            const loadedUsers = [];

            snapshot.forEach(function forEachSnapshot(userDoc) {
                loadedUsers.push(
                    normalizeUserRecord(
                        state.authUtils,
                        userDoc.data(),
                        userDoc.id
                    )
                );
            });

            state.users = loadedUsers;
            renderUsers();
            setStatus("Users loaded successfully.");
        } catch (error) {
            console.error("Failed to load users:", error);
            setStatus("Failed to load users.");
        }
    }

    function getUserByUid(uid) {
        return state.users.find(function findUser(user) {
            return user.uid === uid;
        }) || null;
    }

    function buildPatchForAction(actionName) {
        switch (actionName) {
            case "approve-vendor":
                return {
                    vendorStatus: "approved",
                    vendorReason: "",
                    accountStatus: "active"
                };
            case "suspend-vendor":
                return {
                    vendorStatus: "blocked"
                };
            case "clear-vendor":
                return {
                    vendorStatus: "none",
                    vendorReason: ""
                };
            case "make-admin":
                return {
                    isAdmin: true
                };
            case "remove-admin":
                return {
                    isAdmin: false
                };
            case "make-owner":
                return {
                    isOwner: true,
                    isAdmin: true
                };
            case "remove-owner":
                return {
                    isOwner: false
                };
            case "disable-account":
                return {
                    accountStatus: "disabled"
                };
            case "enable-account":
                return {
                    accountStatus: "active"
                };
            default:
                return null;
        }
    }

    async function handleUserAction(event) {
        const button = event.target;

        if (!button || button.matches("button[data-action]") === false) {
            return;
        }

        const actionName = button.dataset.action;
        const uid = button.dataset.uid;
        const targetUser = getUserByUid(uid);
        const patch = buildPatchForAction(actionName);

        if (!targetUser || !patch) {
            return;
        }

        if (!canManageUser(targetUser)) {
            setStatus("You are not allowed to manage that account.");
            return;
        }

        const currentIsOwner = state.currentAdminProfile && state.currentAdminProfile.isOwner === true;
        const selfTarget = isSelfTarget(targetUser);

        if ((actionName === "make-owner" || actionName === "remove-owner") && !currentIsOwner) {
            setStatus("Only owners can change owner access.");
            return;
        }

        if (actionName === "remove-owner" && selfTarget) {
            setStatus("You cannot remove owner access from your own account.");
            return;
        }

        if (actionName === "disable-account" && selfTarget) {
            setStatus("You cannot disable your own account.");
            return;
        }

        button.disabled = true;
        setStatus("Saving changes...");

        try {
            const targetRef = state.firestoreFns.doc(state.db, "users", uid);
            await state.firestoreFns.updateDoc(targetRef, patch);
            await loadUsers();
            setStatus("User updated successfully.");
        } catch (error) {
            console.error("Failed to update user:", error);
            setStatus("Failed to update the user.");
            button.disabled = false;
        }
    }

    function handleSearch(event) {
        state.searchQuery = event.target.value || "";
        renderUsers();
    }

    function handleFilterClick(event) {
        const button = event.target;

        if (!button || button.matches("button[data-filter]") === false) {
            return;
        }

        state.activeFilter = button.dataset.filter || DEFAULT_FILTER;
        setPressedFilterButton();
        renderUsers();
    }

    function goBack() {
        if (typeof window !== "undefined") {
            window.location.href = "./index.html";
        }
    }

    /*async function guardAdminAccess() {
        return new Promise(function resolveGuard(resolve) {
            state.authService.observeAuthState(async function onAuthStateChanged(user) {
                try {
                    if (typeof window !== "undefined") {
                        window.location.assign("../authentication/login.html");
                }
                    state.currentAdminUser = user;

                    const profile =
                        (await state.authService.getCurrentUserProfile(user.uid)) ||
                        (await state.authService.getUserProfile(user.uid));

                    state.currentAdminProfile = normalizeUserRecord(state.authUtils, profile || {}, user.uid);

                    if (
                        !state.authUtils ||
                        typeof state.authUtils.canAccessAdminPortal !== "function" ||
                        !state.authUtils.canAccessAdminPortal(state.currentAdminProfile)
                    ) {
                        setStatus("You are not allowed to access this page.");
                        window.location.href = "./index.html";
                        resolve(false);
                        return;
                    }

                    resolve(true);
                } catch (error) {
                    console.error("Admin guard failed:", error);
                    setStatus("Unable to confirm admin access.");
                    resolve(false);
                }
            });
        });
    }*/
   async function guardAdminAccess() {
    
    return new Promise(function resolveGuard(resolve) {
        state.authService.observeAuthState(async function onAuthStateChanged(user) {
            try {

                // ✅ FIX 1: Handle unauthenticated user FIRST
                if (!user) {
                    if (typeof window !== "undefined" && window.location?.assign) {
                        window.location.assign("../authentication/login.html");
                    }
                    resolve(false);
                    return;
                }

                // ✅ FIX 2: Only now safe to use user
                state.currentAdminUser = user;

                const profile =
                    (await state.authService.getCurrentUserProfile(user.uid)) ||
                    (await state.authService.getUserProfile(user.uid));

                state.currentAdminProfile = normalizeUserRecord(
                    state.authUtils,
                    profile || {},
                    user.uid
                );

                // ✅ FIX 3: Admin access check
                if (
                    !state.authUtils ||
                    typeof state.authUtils.canAccessAdminPortal !== "function" ||
                    !state.authUtils.canAccessAdminPortal(state.currentAdminProfile)
                ) {
                    setStatus("You are not allowed to access this page.");

                    if (typeof window !== "undefined" && window.location?.assign) {
                        window.location.assign("./index.html");
                    }

                    resolve(false);
                    return;
                }

                // ✅ FIX 4: Success path
                resolve(true);

            } catch (error) {
                console.error("Admin guard failed:", error);
                setStatus("Unable to confirm admin access.");

                // ✅ FIX 5: ALWAYS resolve (prevents timeout)
                resolve(false);
            }
        });
    });
}

    function bindEvents() {
        const backButton = document.getElementById("back-button");
        const searchInput = document.getElementById("user-search");
        const filterMenu = document.querySelector(".filter-menu");
        const usersList = document.getElementById("users-list");

        if (backButton) {
            backButton.addEventListener("click", goBack);
        }

        if (searchInput) {
            searchInput.addEventListener("input", handleSearch);
        }

        if (filterMenu) {
            filterMenu.addEventListener("click", handleFilterClick);
        }

        if (usersList) {
            usersList.addEventListener("click", handleUserAction);
        }
    }

    async function initialize(dependencies = {}) {

        try {
            state.authService = dependencies.authService;
            state.authUtils = dependencies.authUtils;
            state.db = dependencies.db;
            state.firestoreFns = dependencies.firestoreFns;

            bindEvents();
            setPressedFilterButton();

            // safety: ensure guard always resolves
            let allowed = false;

            try {
                allowed = await guardAdminAccess();
            } catch (err) {
                console.error("guardAdminAccess failed:", err);
                allowed = false;
            }

            if (!allowed) {
                setStatus("You are not allowed to access this page.");
                return false;
            }

            try {
                await loadUsers();
            } catch (err) {
                console.error("Failed to load users:", err);
                setStatus("Failed to load users.");
            }

            return true;
        } catch (error) {
            console.error("Initialization error:", error);
            setStatus("Failed to initialize admin page.");
            return false;
        }
    }

    const exportedHelpers = {
        normalizeUserRecord,
        getUserPrimaryRoleLabel,
        matchesSearch,
        matchesFilter,
        sortUsers,
        buildPatchForAction
    };

    globalScope.usersPage = {
        initialize,
        helpers: exportedHelpers
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = exportedHelpers;
    }
})(typeof window !== "undefined" ? window : globalThis);