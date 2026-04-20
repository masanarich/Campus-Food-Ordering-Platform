function attachUsersPage(globalScope) {
    "use strict";
}
    const DEFAULT_FILTER = "all";
    const DEFAULT_PAGE_SIZE = 24;

    const state = {
        authService: null,
        authUtils: null,
        db: null,
        firestoreFns: null,
        navigate: null,
        currentAdminUser: null,
        currentAdminProfile: null,
        users: [],
        activeFilter: DEFAULT_FILTER,
        searchQuery: "",
        pageSize: DEFAULT_PAGE_SIZE,
        currentPage: 1,
        selectedUserUid: ""
    };

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
    }

    function normalizeStatus(value, fallback = "none") {
        const status = normalizeLowerText(value);

        if (
            status === "none" ||
            status === "pending" ||
            status === "approved" ||
            status === "rejected" ||
            status === "blocked"
        ) {
            return status;
        }

        if (status === "suspended") {
            return "blocked";
        }

        return fallback;
    }

    function normalizeAccountStatus(value) {
        const status = normalizeLowerText(value);

        if (status === "disabled" || status === "blocked") {
            return status;
        }

        return "active";
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
                    uid: safeRecord.uid || fallbackUid || "",
                    displayName: normalizeText(safeRecord.displayName || safeRecord.fullName),
                    email: normalizeLowerText(safeRecord.email),
                    phoneNumber: normalizeText(safeRecord.phoneNumber),
                    isAdmin: safeRecord.isAdmin === true || safeRecord.admin === true,
                    vendorStatus: normalizeStatus(safeRecord.vendorStatus),
                    vendorReason: normalizeText(
                        safeRecord.vendorReason ||
                        safeRecord.rejectionReason ||
                        safeRecord.blockReason
                    ),
                    adminApplicationStatus: (safeRecord.isAdmin === true || safeRecord.admin === true)
                        ? "approved"
                        : normalizeStatus(safeRecord.adminApplicationStatus),
                    adminApplicationReason: normalizeText(
                        safeRecord.adminApplicationReason ||
                        safeRecord.adminRejectionReason ||
                        safeRecord.adminBlockReason
                    ),
                    accountStatus: normalizeAccountStatus(safeRecord.accountStatus)
                };

        return {
            ...safeRecord,
            ...normalized,
            uid: normalized.uid || fallbackUid || "",
            displayName: normalized.displayName || "Unnamed User",
            email: normalized.email || "",
            phoneNumber: normalized.phoneNumber || "",
            isAdmin: normalized.isAdmin === true,
            vendorStatus: normalizeStatus(normalized.vendorStatus),
            vendorReason: normalizeText(normalized.vendorReason),
            adminApplicationStatus: normalized.isAdmin === true
                ? "approved"
                : normalizeStatus(normalized.adminApplicationStatus),
            adminApplicationReason: normalizeText(normalized.adminApplicationReason),
            accountStatus: normalizeAccountStatus(normalized.accountStatus)
        };
    }

    function getUserRoleLabel(user) {
        if (user.isAdmin === true && user.vendorStatus === "approved") {
            return "Admin and Vendor";
        }

        if (user.isAdmin === true) {
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
                return "Approved";
            case "pending":
                return "Pending";
            case "rejected":
                return "Rejected";
            case "blocked":
                return "Blocked";
            default:
                return "Not Applied";
        }
    }

    function getAdminStatusLabel(user) {
        if (user.isAdmin === true) {
            return "Approved";
        }

        switch (user.adminApplicationStatus) {
            case "pending":
                return "Pending";
            case "rejected":
                return "Rejected";
            case "blocked":
                return "Blocked";
            default:
                return "Not Applied";
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
        const needle = normalizeLowerText(query);

        if (!needle) {
            return true;
        }

        return [
            user.displayName,
            user.email,
            user.uid,
            user.phoneNumber,
            getUserRoleLabel(user),
            getVendorStatusLabel(user),
            getAdminStatusLabel(user),
            getAccountStatusLabel(user)
        ]
            .join(" ")
            .toLowerCase()
            .includes(needle);
    }

    function matchesFilter(user, filterName) {
        switch (filterName) {
            case "customer":
                return user.isAdmin !== true && user.vendorStatus !== "approved";
            case "vendor":
                return user.vendorStatus === "approved";
            case "admin":
                return user.isAdmin === true;
            case "pending-vendor":
                return user.vendorStatus === "pending";
            case "pending-admin":
                return user.isAdmin !== true && user.adminApplicationStatus === "pending";
            case "disabled":
                return user.accountStatus === "disabled" || user.accountStatus === "blocked";
            default:
                return true;
        }
    }

    function sortUsers(userList) {
        return [...userList].sort(function compareUsers(a, b) {
            const first = normalizeLowerText(a.displayName || a.email || a.uid);
            const second = normalizeLowerText(b.displayName || b.email || b.uid);
            return first.localeCompare(second);
        });
    }

    function paginateUsers(userList, currentPage, pageSize) {
        const safePageSize = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
        const totalPages = Math.max(1, Math.ceil(userList.length / safePageSize));
        const safePage = Math.min(Math.max(1, Number(currentPage) || 1), totalPages);
        const startIndex = (safePage - 1) * safePageSize;
        const endIndex = startIndex + safePageSize;

        return {
            currentPage: safePage,
            pageSize: safePageSize,
            totalPages,
            startIndex,
            endIndex: Math.min(endIndex, userList.length),
            items: userList.slice(startIndex, endIndex)
        };
    }

    function getFilterLabel(filterName) {
        switch (filterName) {
            case "customer":
                return "Customers";
            case "vendor":
                return "Vendors";
            case "admin":
                return "Admins";
            case "pending-vendor":
                return "Pending Vendor";
            case "pending-admin":
                return "Pending Admin";
            case "disabled":
                return "Disabled";
            default:
                return "All";
        }
    }

    function getSummaryCounts(userList) {
        return {
            total: userList.length,
            pendingVendor: userList.filter((user) => user.vendorStatus === "pending").length,
            pendingAdmin: userList.filter((user) => user.isAdmin !== true && user.adminApplicationStatus === "pending").length,
            disabled: userList.filter((user) => user.accountStatus === "disabled" || user.accountStatus === "blocked").length
        };
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

    function setStatus(message, type = "info") {
        const element = document.getElementById("users-status");

        if (!element) {
            return;
        }

        element.textContent = message;
        element.dataset.state = type;
    }

    function setModalActionStatus(message, type = "") {
        const element = document.getElementById("modal-action-status");

        if (!element) {
            return;
        }

        element.textContent = message || "";
        element.dataset.state = type || "";
    }

    function setModalWarning(message) {
        const element = document.getElementById("modal-warning");

        if (!element) {
            return;
        }

        element.textContent = message || "";
    }

    function setPressedFilterButton() {
        document.querySelectorAll("button[data-filter]").forEach(function updateButton(button) {
            const isActive = button.dataset.filter === state.activeFilter;
            button.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    }

    function createBadge(text, className) {
        const badge = document.createElement("li");
        badge.className = className;
        badge.textContent = text;
        return badge;
    }

    function getActionAvailability(user, currentAdminProfile) {
        const currentUid = normalizeText(currentAdminProfile && currentAdminProfile.uid);
        const isSelf = currentUid !== "" && currentUid === normalizeText(user.uid);
        const canManage = !!(
            currentAdminProfile &&
            currentAdminProfile.isAdmin === true &&
            currentAdminProfile.accountStatus === "active"
        );

        return {
            canManage,
            isSelf
        };
    }

    function buildRowActionConfig(user, currentAdminProfile) {
        const availability = getActionAvailability(user, currentAdminProfile);

        return {
            disabled: availability.canManage !== true,
            label: "Manage"
        };
    }

    function renderUserRow(user) {
        const item = document.createElement("li");
        item.className = "user-row-item";

        const actionConfig = buildRowActionConfig(user, state.currentAdminProfile);
        const article = document.createElement("article");
        article.className = "user-row-card";

        const identity = document.createElement("section");
        identity.className = "user-identity";

        const name = document.createElement("h4");
        name.textContent = user.displayName;

        const email = document.createElement("p");
        email.textContent = user.email || "No email";

        const uid = document.createElement("p");
        uid.className = "user-uid";
        uid.textContent = "UID: " + (user.uid || "-");

        identity.appendChild(name);
        identity.appendChild(email);
        identity.appendChild(uid);

        const meta = document.createElement("ul");
        meta.className = "user-meta";
        meta.appendChild(createBadge(getUserRoleLabel(user), "user-badge user-badge-role"));
        meta.appendChild(createBadge(`Vendor: ${getVendorStatusLabel(user)}`, "user-badge user-badge-vendor"));
        meta.appendChild(createBadge(`Admin: ${getAdminStatusLabel(user)}`, "user-badge user-badge-admin"));
        meta.appendChild(createBadge(`Account: ${getAccountStatusLabel(user)}`, "user-badge user-badge-account"));

        const actions = document.createElement("menu");
        actions.className = "user-row-actions";

        const manageButton = document.createElement("button");
        manageButton.type = "button";
        manageButton.className = "button-primary";
        manageButton.dataset.action = "open-manage-modal";
        manageButton.dataset.uid = user.uid;
        manageButton.textContent = actionConfig.label;
        manageButton.disabled = actionConfig.disabled;

        const actionItem = document.createElement("li");
        actionItem.appendChild(manageButton);
        actions.appendChild(actionItem);

        article.appendChild(identity);
        article.appendChild(meta);
        article.appendChild(actions);
        item.appendChild(article);

        return item;
    }

    function updateSummary(visibleUsers) {
        const summaryCounts = getSummaryCounts(state.users);
        const totalCount = document.getElementById("users-total-count");
        const visibleCount = document.getElementById("users-visible-count");
        const pendingVendorCount = document.getElementById("users-pending-vendor-count");
        const pendingAdminCount = document.getElementById("users-pending-admin-count");
        const disabledCount = document.getElementById("users-disabled-count");
        const currentFilter = document.getElementById("users-current-filter");

        if (totalCount) {
            totalCount.textContent = String(summaryCounts.total);
        }

        if (visibleCount) {
            visibleCount.textContent = String(visibleUsers.length);
        }

        if (pendingVendorCount) {
            pendingVendorCount.textContent = String(summaryCounts.pendingVendor);
        }

        if (pendingAdminCount) {
            pendingAdminCount.textContent = String(summaryCounts.pendingAdmin);
        }

        if (disabledCount) {
            disabledCount.textContent = String(summaryCounts.disabled);
        }

        if (currentFilter) {
            currentFilter.textContent = getFilterLabel(state.activeFilter);
        }
    }

    function updatePaginationUi(pageData, visibleUsersCount) {
        const indicator = document.getElementById("users-page-indicator");
        const rangeSummary = document.getElementById("users-range-summary");
        const previousButton = document.getElementById("previous-page-button");
        const nextButton = document.getElementById("next-page-button");

        if (indicator) {
            indicator.textContent = `Page ${pageData.currentPage} of ${pageData.totalPages}`;
        }

        if (rangeSummary) {
            if (visibleUsersCount === 0) {
                rangeSummary.textContent = "Showing 0 of 0";
            } else {
                rangeSummary.textContent =
                    `Showing ${pageData.startIndex + 1}-${pageData.endIndex} of ${visibleUsersCount}`;
            }
        }

        if (previousButton) {
            previousButton.disabled = pageData.currentPage <= 1;
        }

        if (nextButton) {
            nextButton.disabled = pageData.currentPage >= pageData.totalPages;
        }
    }

    function renderUsers() {
        const list = document.getElementById("users-list");
        const emptyState = document.getElementById("users-empty-state");
        const visibleUsers = getVisibleUsers();
        const pageData = paginateUsers(visibleUsers, state.currentPage, state.pageSize);

        state.currentPage = pageData.currentPage;

        if (!list) {
            return;
        }

        list.innerHTML = "";

        if (visibleUsers.length === 0) {
            if (emptyState) {
                emptyState.hidden = false;
            }

            updateSummary(visibleUsers);
            updatePaginationUi(pageData, visibleUsers.length);
            return;
        }

        if (emptyState) {
            emptyState.hidden = true;
        }

        pageData.items.forEach(function appendUser(user) {
            list.appendChild(renderUserRow(user));
        });

        updateSummary(visibleUsers);
        updatePaginationUi(pageData, visibleUsers.length);
    }

    async function loadUsers() {
        const firestoreFns = state.firestoreFns;
        const db = state.db;

        setStatus("Loading users...", "info");

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
            setStatus("Users loaded successfully.", "success");
        } catch (error) {
            console.error("Failed to load users:", error);
            state.users = [];
            renderUsers();
            setStatus("Failed to load users.", "error");
        }
    }

    function getUserByUid(uid) {
        return state.users.find(function findUser(user) {
            return normalizeText(user.uid) === normalizeText(uid);
        }) || null;
    }

    function getSelectedUser() {
        return getUserByUid(state.selectedUserUid);
    }

    function getModalElements() {
        return {
            dialog: document.getElementById("user-modal"),
            name: document.getElementById("modal-user-name"),
            email: document.getElementById("modal-user-email"),
            uid: document.getElementById("modal-user-uid"),
            role: document.getElementById("modal-user-role"),
            vendorStatus: document.getElementById("modal-user-vendor-status"),
            adminStatus: document.getElementById("modal-user-admin-status"),
            accountStatus: document.getElementById("modal-user-account-status"),
            phone: document.getElementById("modal-user-phone"),
            note: document.getElementById("modal-review-note"),
            warning: document.getElementById("modal-warning"),
            actionStatus: document.getElementById("modal-action-status"),
            approveVendor: document.getElementById("modal-approve-vendor-button"),
            rejectVendor: document.getElementById("modal-reject-vendor-button"),
            blockVendor: document.getElementById("modal-block-vendor-button"),
            clearVendor: document.getElementById("modal-clear-vendor-button"),
            approveAdmin: document.getElementById("modal-approve-admin-button"),
            rejectAdmin: document.getElementById("modal-reject-admin-button"),
            blockAdmin: document.getElementById("modal-block-admin-button"),
            clearAdmin: document.getElementById("modal-clear-admin-button"),
            disableAccount: document.getElementById("modal-disable-account-button"),
            enableAccount: document.getElementById("modal-enable-account-button")
        };
    }

    function setButtonsDisabled(buttons, isDisabled) {
        buttons.forEach(function updateButton(button) {
            if (button) {
                button.disabled = isDisabled;
            }
        });
    }

    function getManageWarning(user, currentAdminProfile) {
        const availability = getActionAvailability(user, currentAdminProfile);

        if (availability.canManage !== true) {
            return "Your account does not currently have permission to manage users.";
        }

        if (availability.isSelf) {
            return "Be careful when changing your own account. You cannot disable your own access here.";
        }

        return "";
    }

    function getModalButtonStates(user, currentAdminProfile) {
        const availability = getActionAvailability(user, currentAdminProfile);
        const canManage = availability.canManage === true;
        const isSelf = availability.isSelf === true;

        return {
            approveVendor: !canManage || user.vendorStatus === "approved",
            rejectVendor: !canManage || user.vendorStatus === "none" || user.vendorStatus === "rejected",
            blockVendor: !canManage || user.vendorStatus === "none" || user.vendorStatus === "blocked",
            clearVendor: !canManage || user.vendorStatus === "none",
            approveAdmin: !canManage || user.isAdmin === true,
            rejectAdmin: !canManage || (user.isAdmin !== true && user.adminApplicationStatus === "rejected"),
            blockAdmin: !canManage || (user.isAdmin !== true && user.adminApplicationStatus === "blocked"),
            clearAdmin: !canManage || (user.isAdmin !== true && user.adminApplicationStatus === "none"),
            disableAccount: !canManage || user.accountStatus !== "active" || isSelf,
            enableAccount: !canManage || user.accountStatus === "active"
        };
    }

    function openManageModal(uid) {
        const user = getUserByUid(uid);
        const elements = getModalElements();

        if (!user || !elements.dialog) {
            return;
        }

        state.selectedUserUid = user.uid;
        const buttonStates = getModalButtonStates(user, state.currentAdminProfile);

        if (elements.name) {
            elements.name.textContent = user.displayName;
        }

        if (elements.email) {
            elements.email.textContent = user.email || "No email";
        }

        if (elements.uid) {
            elements.uid.textContent = user.uid || "-";
        }

        if (elements.role) {
            elements.role.textContent = getUserRoleLabel(user);
        }

        if (elements.vendorStatus) {
            elements.vendorStatus.textContent = getVendorStatusLabel(user);
        }

        if (elements.adminStatus) {
            elements.adminStatus.textContent = getAdminStatusLabel(user);
        }

        if (elements.accountStatus) {
            elements.accountStatus.textContent = getAccountStatusLabel(user);
        }

        if (elements.phone) {
            elements.phone.textContent = user.phoneNumber || "-";
        }

        if (elements.note) {
            elements.note.value =
                user.adminApplicationReason ||
                user.vendorReason ||
                "";
        }

        setModalWarning(getManageWarning(user, state.currentAdminProfile));
        setModalActionStatus("", "");

        if (elements.approveVendor) {
            elements.approveVendor.disabled = buttonStates.approveVendor;
        }

        if (elements.rejectVendor) {
            elements.rejectVendor.disabled = buttonStates.rejectVendor;
        }

        if (elements.blockVendor) {
            elements.blockVendor.disabled = buttonStates.blockVendor;
        }

        if (elements.clearVendor) {
            elements.clearVendor.disabled = buttonStates.clearVendor;
        }

        if (elements.approveAdmin) {
            elements.approveAdmin.disabled = buttonStates.approveAdmin;
        }

        if (elements.rejectAdmin) {
            elements.rejectAdmin.disabled = buttonStates.rejectAdmin;
        }

        if (elements.blockAdmin) {
            elements.blockAdmin.disabled = buttonStates.blockAdmin;
        }

        if (elements.clearAdmin) {
            elements.clearAdmin.disabled = buttonStates.clearAdmin;
        }

        if (elements.disableAccount) {
            elements.disableAccount.disabled = buttonStates.disableAccount;
        }

        if (elements.enableAccount) {
            elements.enableAccount.disabled = buttonStates.enableAccount;
        }

        elements.dialog.showModal();
    }

    function closeManageModal() {
        const dialog = document.getElementById("user-modal");
        state.selectedUserUid = "";
        setModalActionStatus("", "");
        setModalWarning("");

        if (dialog) {
            dialog.close();
        }
    }

    function getReasonFromModal() {
        const noteField = document.getElementById("modal-review-note");
        return normalizeText(noteField && noteField.value);
    }

    function buildPatchForAction(actionName, reason = "") {
        switch (actionName) {
            case "approve-vendor":
                return {
                    vendorStatus: "approved",
                    vendorReason: "",
                    accountStatus: "active"
                };
            case "reject-vendor":
                return {
                    vendorStatus: "rejected",
                    vendorReason: reason
                };
            case "block-vendor":
                return {
                    vendorStatus: "blocked",
                    vendorReason: reason
                };
            case "clear-vendor":
                return {
                    vendorStatus: "none",
                    vendorReason: ""
                };
            case "approve-admin":
                return {
                    isAdmin: true,
                    adminApplicationStatus: "approved",
                    adminApplicationReason: "",
                    accountStatus: "active"
                };
            case "reject-admin":
                return {
                    isAdmin: false,
                    adminApplicationStatus: "rejected",
                    adminApplicationReason: reason
                };
            case "block-admin":
                return {
                    isAdmin: false,
                    adminApplicationStatus: "blocked",
                    adminApplicationReason: reason
                };
            case "clear-admin":
                return {
                    isAdmin: false,
                    adminApplicationStatus: "none",
                    adminApplicationReason: ""
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

    function actionNeedsReason(actionName) {
        return (
            actionName === "reject-vendor" ||
            actionName === "block-vendor" ||
            actionName === "reject-admin" ||
            actionName === "block-admin"
        );
    }

    function getActionSuccessMessage(actionName) {
        switch (actionName) {
            case "approve-vendor":
                return "Vendor application approved.";
            case "reject-vendor":
                return "Vendor application rejected.";
            case "block-vendor":
                return "Vendor access blocked.";
            case "clear-vendor":
                return "Vendor status cleared.";
            case "approve-admin":
                return "Admin application approved.";
            case "reject-admin":
                return "Admin application rejected.";
            case "block-admin":
                return "Admin access blocked.";
            case "clear-admin":
                return "Admin status cleared.";
            case "disable-account":
                return "Account disabled.";
            case "enable-account":
                return "Account enabled.";
            default:
                return "User updated successfully.";
        }
    }

    async function saveUserAction(actionName) {
        const selectedUser = getSelectedUser();
        const reason = getReasonFromModal();
        const patch = buildPatchForAction(actionName, reason);
        const availability = getActionAvailability(selectedUser, state.currentAdminProfile);
        const allActionButtons = [
            document.getElementById("modal-approve-vendor-button"),
            document.getElementById("modal-reject-vendor-button"),
            document.getElementById("modal-block-vendor-button"),
            document.getElementById("modal-clear-vendor-button"),
            document.getElementById("modal-approve-admin-button"),
            document.getElementById("modal-reject-admin-button"),
            document.getElementById("modal-block-admin-button"),
            document.getElementById("modal-clear-admin-button"),
            document.getElementById("modal-disable-account-button"),
            document.getElementById("modal-enable-account-button")
        ];

        if (!selectedUser || !patch) {
            return;
        }

        if (availability.canManage !== true) {
            setModalActionStatus("You are not allowed to manage this account.", "error");
            return;
        }

        if (availability.isSelf && actionName === "disable-account") {
            setModalActionStatus("You cannot disable your own account here.", "error");
            return;
        }

        if (actionNeedsReason(actionName) && reason === "") {
            setModalActionStatus("Please add a short reason before rejecting or blocking an application.", "error");
            return;
        }

        setButtonsDisabled(allActionButtons, true);
        setModalActionStatus("Saving changes...", "info");

        try {
            const targetRef = state.firestoreFns.doc(state.db, "users", selectedUser.uid);
            await state.firestoreFns.updateDoc(targetRef, patch);
            await loadUsers();
            openManageModal(selectedUser.uid);
            setModalActionStatus(getActionSuccessMessage(actionName), "success");
            setStatus(getActionSuccessMessage(actionName), "success");
        } catch (error) {
            console.error("Failed to update user:", error);
            setModalActionStatus("Failed to update the user.", "error");
            setStatus("Failed to update the user.", "error");
            openManageModal(selectedUser.uid);
        }
    }

    function handleSearch(event) {
        state.searchQuery = event.target.value || "";
        state.currentPage = 1;
        renderUsers();
    }

    function handleFilterClick(event) {
        const button = event.target;

        if (!button || button.matches("button[data-filter]") === false) {
            return;
        }

        state.activeFilter = button.dataset.filter || DEFAULT_FILTER;
        state.currentPage = 1;
        setPressedFilterButton();
        renderUsers();
    }

    function handlePageSizeChange(event) {
        state.pageSize = Math.max(1, Number(event.target.value) || DEFAULT_PAGE_SIZE);
        state.currentPage = 1;
        renderUsers();
    }

    function handlePagination(direction) {
        const visibleUsers = getVisibleUsers();
        const pageData = paginateUsers(visibleUsers, state.currentPage, state.pageSize);

        if (direction === "previous" && pageData.currentPage > 1) {
            state.currentPage -= 1;
        }

        if (direction === "next" && pageData.currentPage < pageData.totalPages) {
            state.currentPage += 1;
        }

        renderUsers();
    }

    function handleUsersListClick(event) {
        const button = event.target;

        if (!button || button.matches('button[data-action="open-manage-modal"]') === false) {
            return;
        }

        openManageModal(button.dataset.uid);
    }

    function navigateTo(route) {
        const nextRoute = normalizeText(route);

        if (!nextRoute) {
            return;
        }

        if (typeof state.navigate === "function") {
            state.navigate(nextRoute);
            return;
        }

        window.location.href = nextRoute;
    }

    function goBack() {
        if (typeof window !== "undefined") {
            window.location.href = "./index.html";
        }
        navigateTo("./index.html");
    }

    /*async function guardAdminAccess() {
        return new Promise(function resolveGuard(resolve) {
            state.authService.observeAuthState(async function onAuthStateChanged(user) {
                try {
                    if (typeof window !== "undefined") {
                        window.location.assign("../authentication/login.html");
                }
                    if (!user) {
                        navigateTo("../authentication/login.html");
                        resolve(false);
                        return;
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
                        setStatus("You are not allowed to access this page.", "error");
                        navigateTo("./index.html");
                        resolve(false);
                        return;
                    }

                    resolve(true);
                } catch (error) {
                    console.error("Admin guard failed:", error);
                    setStatus("Unable to confirm admin access.", "error");
                    resolve(false);
                }
            });
        });
    }

    function bindEvents() {
        const backButton = document.getElementById("back-button");
        const searchInput = document.getElementById("user-search");
        const filterMenu = document.querySelector(".users-filter-menu");
        const usersList = document.getElementById("users-list");
        const pageSizeSelect = document.getElementById("page-size-select");
        const previousButton = document.getElementById("previous-page-button");
        const nextButton = document.getElementById("next-page-button");
        const closeButton = document.getElementById("modal-close-button");
        const dialog = document.getElementById("user-modal");

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
            usersList.addEventListener("click", handleUsersListClick);
        }

        if (pageSizeSelect) {
            pageSizeSelect.value = String(state.pageSize);
            pageSizeSelect.addEventListener("change", handlePageSizeChange);
        }

        if (previousButton) {
            previousButton.addEventListener("click", function handlePrevious() {
                handlePagination("previous");
            });
        }

        if (nextButton) {
            nextButton.addEventListener("click", function handleNext() {
                handlePagination("next");
            });
        }

        if (closeButton) {
            closeButton.addEventListener("click", closeManageModal);
        }

        if (dialog) {
            dialog.addEventListener("close", function onClose() {
                state.selectedUserUid = "";
                setModalActionStatus("", "");
                setModalWarning("");
            });
        }

        const actionMap = {
            "modal-approve-vendor-button": "approve-vendor",
            "modal-reject-vendor-button": "reject-vendor",
            "modal-block-vendor-button": "block-vendor",
            "modal-clear-vendor-button": "clear-vendor",
            "modal-approve-admin-button": "approve-admin",
            "modal-reject-admin-button": "reject-admin",
            "modal-block-admin-button": "block-admin",
            "modal-clear-admin-button": "clear-admin",
            "modal-disable-account-button": "disable-account",
            "modal-enable-account-button": "enable-account"
        };

        Object.keys(actionMap).forEach(function bindAction(buttonId) {
            const button = document.getElementById(buttonId);

            if (button) {
                button.addEventListener("click", function handleClick() {
                    saveUserAction(actionMap[buttonId]);
                });
            }
        });
    }

    async function initialize(dependencies = {}) {
    async function initialize(dependencies) {
        state.authService = dependencies.authService;
        state.authUtils = dependencies.authUtils;
        state.db = dependencies.db;
        state.firestoreFns = dependencies.firestoreFns;
        state.navigate = dependencies.navigate || null;
        state.pageSize = DEFAULT_PAGE_SIZE;
        state.currentPage = 1;
        state.activeFilter = DEFAULT_FILTER;
        state.searchQuery = "";

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
        getUserRoleLabel,
        getVendorStatusLabel,
        getAdminStatusLabel,
        getAccountStatusLabel,
        matchesSearch,
        matchesFilter,
        sortUsers,
        paginateUsers,
        getSummaryCounts,
        buildPatchForAction
    };

    globalScope.usersPage = {
        initialize,
        helpers: exportedHelpers
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = exportedHelpers;
    }
})(typeof window !== "undefined" ? window : globalThis);*/
