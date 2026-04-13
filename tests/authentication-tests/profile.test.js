/**
 * @jest-environment jsdom
 */

const profilePage = require("../../public/authentication/profile.js");

const {
    normalizeText,
    normalizeVendorStatus,
    normalizeAccountStatus,
    normalizeUserProfile,
    setTextContent,
    setStatusMessage,
    getRoleLabel,
    getVendorStatusLabel,
    getDisplayName,
    getEmail,
    getPortalAccessLabel,
    canLeaveVendor,
    renderProfile,
    getBackRoute,
    waitForAuthenticatedUser,
    loadCurrentUserProfile,
    signOutCurrentUser,
    sendSelfPasswordReset,
    leaveVendorAccess,
    previewSelectedPhoto,
    uploadSelectedPhoto,
    removeCurrentUserPhotoAction,
    deleteCurrentUserAccountAction,
    initializeProfileView,
    attachSignOutHandler,
    attachBackHandler,
    attachResetPasswordHandler,
    attachDeleteAccountHandler,
    initializeProfilePage
} = profilePage;

function createProfileDom() {
    document.body.innerHTML = `
        <main>
            <p id="profile-status"></p>

            <p id="profile-name"></p>
            <p id="profile-email"></p>
            <p id="profile-role"></p>
            <p id="profile-vendor-status"></p>
            <p id="profile-access"></p>
            <p id="profile-vendor-reason"></p>

            <img id="profile-photo" alt="Profile picture" hidden />
            <input id="profile-photo-input" type="file" />
            <p id="profile-photo-message"></p>
            <p id="profile-account-message"></p>

            <button id="profile-back-button" type="button">Back</button>
            <button id="signout-button" type="button">Sign Out</button>
            <button id="reset-password-button" type="button">Reset Password</button>
            <button id="leave-vendor-button" type="button">Leave Vendor</button>
            <button id="upload-photo-button" type="button">Upload Photo</button>
            <button id="remove-photo-button" type="button">Remove Photo</button>
            <button id="delete-account-button" type="button">Delete Account</button>
        </main>
    `;

    return {
        statusElement: document.querySelector("#profile-status"),
        nameElement: document.querySelector("#profile-name"),
        emailElement: document.querySelector("#profile-email"),
        roleElement: document.querySelector("#profile-role"),
        vendorStatusElement: document.querySelector("#profile-vendor-status"),
        accessElement: document.querySelector("#profile-access"),
        vendorReasonElement: document.querySelector("#profile-vendor-reason"),
        photoElement: document.querySelector("#profile-photo"),
        photoInput: document.querySelector("#profile-photo-input"),
        photoMessageElement: document.querySelector("#profile-photo-message"),
        accountMessageElement: document.querySelector("#profile-account-message"),
        backButton: document.querySelector("#profile-back-button"),
        signOutButton: document.querySelector("#signout-button"),
        resetPasswordButton: document.querySelector("#reset-password-button"),
        leaveVendorButton: document.querySelector("#leave-vendor-button"),
        uploadPhotoButton: document.querySelector("#upload-photo-button"),
        removePhotoButton: document.querySelector("#remove-photo-button"),
        deleteAccountButton: document.querySelector("#delete-account-button")
    };
}

function setFilesOnInput(input, files) {
    Object.defineProperty(input, "files", {
        value: files,
        configurable: true
    });
}

describe("profile.js helpers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        window.history.pushState({}, "", "/authentication/profile.html");
    });

    test("normalizeText trims whitespace", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
    });

    test("normalizeText returns empty string for non-strings", () => {
        expect(normalizeText(null)).toBe("");
        expect(normalizeText(undefined)).toBe("");
        expect(normalizeText(123)).toBe("");
    });

    test("normalizeVendorStatus maps suspended to blocked", () => {
        expect(normalizeVendorStatus("suspended")).toBe("blocked");
    });

    test("normalizeVendorStatus returns none for unknown values", () => {
        expect(normalizeVendorStatus("mystery")).toBe("none");
    });

    test("normalizeAccountStatus returns blocked for blocked and active by default", () => {
        expect(normalizeAccountStatus("blocked")).toBe("blocked");
        expect(normalizeAccountStatus("something-else")).toBe("active");
    });

    test("normalizeUserProfile normalizes canonical fields", () => {
        const result = normalizeUserProfile({
            uid: " user-1 ",
            fullName: "  Faranani Maduwa ",
            email: " USER@EXAMPLE.COM ",
            phoneNumber: " 0712345678 ",
            photoURL: "  https://example.com/photo.png ",
            owner: true,
            vendorStatus: "suspended",
            rejectionReason: "  Missing documents ",
            accountStatus: "disabled"
        });

        expect(result).toEqual({
            uid: "user-1",
            displayName: "Faranani Maduwa",
            email: "user@example.com",
            phoneNumber: "0712345678",
            photoURL: "https://example.com/photo.png",
            isOwner: true,
            isAdmin: true,
            vendorStatus: "blocked",
            vendorReason: "Missing documents",
            accountStatus: "disabled"
        });
    });

    test("setTextContent updates element text", () => {
        const { nameElement } = createProfileDom();

        setTextContent(nameElement, "  Faranani Maduwa  ");

        expect(nameElement.textContent).toBe("Faranani Maduwa");
    });

    test("setTextContent uses fallback when text is empty", () => {
        const { nameElement } = createProfileDom();

        setTextContent(nameElement, "   ", "Unknown");

        expect(nameElement.textContent).toBe("Unknown");
    });

    test("setStatusMessage updates text and state", () => {
        const { statusElement } = createProfileDom();

        setStatusMessage(statusElement, "Profile loaded.", "success");

        expect(statusElement.textContent).toBe("Profile loaded.");
        expect(statusElement.dataset.state).toBe("success");
    });

    test("getRoleLabel returns Owner for owner accounts", () => {
        expect(getRoleLabel({ isOwner: true })).toBe("Owner");
    });

    test("getRoleLabel returns Admin for admin accounts", () => {
        expect(getRoleLabel({ isAdmin: true })).toBe("Admin");
    });

    test("getRoleLabel returns Vendor only when vendorStatus is approved", () => {
        expect(getRoleLabel({ vendorStatus: "approved" })).toBe("Vendor");
        expect(getRoleLabel({ vendorStatus: "pending" })).toBe("Customer");
    });

    test("getVendorStatusLabel returns Blocked for suspended input", () => {
        expect(getVendorStatusLabel({ vendorStatus: "suspended" })).toBe("Blocked");
    });

    test("getDisplayName prefers profile displayName", () => {
        expect(
            getDisplayName(
                { displayName: "Profile Name" },
                { displayName: "User Name" }
            )
        ).toBe("Profile Name");
    });

    test("getEmail falls back to user email", () => {
        expect(
            getEmail(
                { email: "" },
                { email: "user@example.com" }
            )
        ).toBe("user@example.com");
    });

    test("getPortalAccessLabel returns all portals for owner", () => {
        expect(
            getPortalAccessLabel({
                uid: "user-1",
                isOwner: true,
                accountStatus: "active"
            })
        ).toBe("Customer, Vendor, and Admin");
    });

    test("canLeaveVendor is false for owner and true for pending vendor", () => {
        expect(canLeaveVendor({ isOwner: true, vendorStatus: "approved" })).toBe(false);
        expect(canLeaveVendor({ vendorStatus: "pending" })).toBe(true);
        expect(canLeaveVendor({ vendorStatus: "none" })).toBe(false);
    });

    test("renderProfile writes current normalized values into the page", () => {
        const dom = createProfileDom();

        renderProfile(
            {
                nameElement: dom.nameElement,
                emailElement: dom.emailElement,
                roleElement: dom.roleElement,
                vendorStatusElement: dom.vendorStatusElement,
                accessElement: dom.accessElement,
                vendorReasonElement: dom.vendorReasonElement,
                photoElement: dom.photoElement,
                leaveVendorButton: dom.leaveVendorButton,
                removePhotoButton: dom.removePhotoButton
            },
            {
                displayName: "Faranani Maduwa",
                email: "faranani@example.com",
                vendorStatus: "pending",
                vendorReason: "Waiting for review",
                photoURL: "https://example.com/photo.png",
                uid: "user-1"
            },
            {
                displayName: "Ignored User",
                email: "ignored@example.com"
            }
        );

        expect(dom.nameElement.textContent).toBe("Faranani Maduwa");
        expect(dom.emailElement.textContent).toBe("faranani@example.com");
        expect(dom.roleElement.textContent).toBe("Customer");
        expect(dom.vendorStatusElement.textContent).toBe("Pending");
        expect(dom.accessElement.textContent).toBe("Customer");
        expect(dom.vendorReasonElement.textContent).toBe("Waiting for review");
        expect(dom.photoElement.hidden).toBe(false);
        expect(dom.photoElement.getAttribute("src")).toBe("https://example.com/photo.png");
        expect(dom.leaveVendorButton.hidden).toBe(false);
        expect(dom.removePhotoButton.hidden).toBe(false);
    });

    test("getBackRoute uses explicit route first", () => {
        expect(getBackRoute({ uid: "user-1" }, null, "vendor")).toBe("../vendor/index.html");
    });

    test("getBackRoute uses query parameter when present", () => {
        window.history.pushState({}, "", "/authentication/profile.html?backTo=admin");

        expect(getBackRoute({ uid: "user-1" })).toBe("../admin/index.html");
    });

    test("getBackRoute falls back to role-choice when multiple portals exist", () => {
        expect(
            getBackRoute({
                uid: "user-1",
                isAdmin: true,
                vendorStatus: "approved",
                accountStatus: "active"
            })
        ).toBe("../authentication/role-choice.html");
    });
});

describe("profile.js auth waiting helper", () => {
    test("waitForAuthenticatedUser returns current user immediately", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-0"
            }))
        };

        const result = await waitForAuthenticatedUser(authService);

        expect(result).toEqual({
            uid: "user-0"
        });
    });

    test("waitForAuthenticatedUser waits for auth state change when no current user", async () => {
        const unsubscribe = jest.fn();

        const authService = {
            getCurrentUser: jest.fn(() => null),
            observeAuthState: jest.fn((callback) => {
                setTimeout(() => callback({ uid: "late-user" }), 0);
                return unsubscribe;
            })
        };

        const result = await waitForAuthenticatedUser(authService);

        expect(result).toEqual({
            uid: "late-user"
        });
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    test("waitForAuthenticatedUser returns null when no current user and no observer", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => null)
        };

        const result = await waitForAuthenticatedUser(authService);

        expect(result).toBeNull();
    });

    test("waitForAuthenticatedUser throws when getCurrentUser is missing", () => {
        expect(() => waitForAuthenticatedUser({})).toThrow(
            "authService.getCurrentUser is required."
        );
    });
});

describe("profile.js service functions", () => {
    test("loadCurrentUserProfile returns signed-in user and normalized profile", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-1",
                email: "USER@example.com",
                displayName: "User One"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-1",
                email: " USER@example.com ",
                fullName: " User One ",
                vendorStatus: "none"
            })
        };

        const result = await loadCurrentUserProfile({ authService });

        expect(authService.getCurrentUser).toHaveBeenCalledTimes(1);
        expect(authService.getCurrentUserProfile).toHaveBeenCalledWith("user-1");
        expect(result.success).toBe(true);
        expect(result.user.uid).toBe("user-1");
        expect(result.profile.uid).toBe("user-1");
        expect(result.profile.email).toBe("user@example.com");
        expect(result.profile.displayName).toBe("User One");
    });

    test("loadCurrentUserProfile returns error when no user is signed in", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => null),
            getCurrentUserProfile: jest.fn()
        };

        const result = await loadCurrentUserProfile({ authService });

        expect(result.success).toBe(false);
        expect(result.message).toBe("No user is currently signed in.");
        expect(authService.getCurrentUserProfile).not.toHaveBeenCalled();
    });

    test("signOutCurrentUser signs the user out", async () => {
        const authService = {
            signOutUser: jest.fn().mockResolvedValue(undefined)
        };

        const result = await signOutCurrentUser({ authService });

        expect(authService.signOutUser).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            success: true
        });
    });

    test("sendSelfPasswordReset sends reset email for signed-in user", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-2",
                email: "user2@example.com",
                displayName: "User Two"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-2",
                email: "user2@example.com",
                displayName: "User Two"
            }),
            sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined)
        };

        const result = await sendSelfPasswordReset({ authService });

        expect(result).toEqual({
            success: true,
            message: "Password reset email sent."
        });
        expect(authService.sendPasswordResetEmail).toHaveBeenCalledWith({
            email: "user2@example.com"
        });
    });

    test("sendSelfPasswordReset returns error when account has no email", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-2",
                email: "",
                displayName: "User Two"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-2",
                email: "",
                displayName: "User Two"
            }),
            sendPasswordResetEmail: jest.fn()
        };

        const result = await sendSelfPasswordReset({ authService });

        expect(result.success).toBe(false);
        expect(result.message).toBe("No email address is available for this account.");
        expect(authService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    test("leaveVendorAccess removes vendor access for non-owner vendor", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-3",
                email: "vendor@example.com",
                displayName: "Vendor User"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-3",
                email: "vendor@example.com",
                displayName: "Vendor User",
                vendorStatus: "approved",
                vendorReason: "Old reason"
            }),
            updateUserProfile: jest.fn().mockResolvedValue(undefined)
        };

        const result = await leaveVendorAccess({ authService });

        expect(result.success).toBe(true);
        expect(result.message).toBe("Vendor access removed.");
        expect(authService.updateUserProfile).toHaveBeenCalledWith("user-3", {
            vendorStatus: "none",
            vendorReason: ""
        });
        expect(result.profile.vendorStatus).toBe("none");
    });

    test("leaveVendorAccess blocks owner from removing vendor access", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "owner-1",
                email: "owner@example.com"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "owner-1",
                email: "owner@example.com",
                isOwner: true,
                vendorStatus: "approved"
            }),
            updateUserProfile: jest.fn()
        };

        const result = await leaveVendorAccess({ authService });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Owner access cannot be removed from the profile page.");
        expect(authService.updateUserProfile).not.toHaveBeenCalled();
    });

    test("leaveVendorAccess returns message when user is not a vendor", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-4",
                email: "customer@example.com"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-4",
                email: "customer@example.com",
                vendorStatus: "none"
            }),
            updateUserProfile: jest.fn()
        };

        const result = await leaveVendorAccess({ authService });

        expect(result.success).toBe(false);
        expect(result.message).toBe("You are not currently marked as a vendor.");
        expect(authService.updateUserProfile).not.toHaveBeenCalled();
    });

    test("previewSelectedPhoto returns error when no file is selected", async () => {
        const dom = createProfileDom();

        const result = await previewSelectedPhoto({
            fileInput: dom.photoInput,
            profileElements: {
                photoElement: dom.photoElement
            },
            photoMessageElement: dom.photoMessageElement
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Choose a photo first.");
        expect(dom.photoMessageElement.textContent).toBe("Choose a photo first.");
        expect(dom.photoMessageElement.dataset.state).toBe("error");
    });

    test("previewSelectedPhoto returns error when file is not an image", async () => {
        const dom = createProfileDom();
        const file = new File(["hello"], "notes.txt", { type: "text/plain" });

        setFilesOnInput(dom.photoInput, [file]);

        const result = await previewSelectedPhoto({
            fileInput: dom.photoInput,
            profileElements: {
                photoElement: dom.photoElement
            },
            photoMessageElement: dom.photoMessageElement
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Please choose an image file.");
    });

    test("uploadSelectedPhoto returns error when no file is selected", async () => {
        const authService = {
            setCurrentUserPhotoURL: jest.fn()
        };

        const result = await uploadSelectedPhoto({
            authService,
            fileInput: createProfileDom().photoInput
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Choose a photo first.");
        expect(authService.setCurrentUserPhotoURL).not.toHaveBeenCalled();
    });

    test("uploadSelectedPhoto returns error when file is not an image", async () => {
        const dom = createProfileDom();
        const authService = {
            setCurrentUserPhotoURL: jest.fn()
        };
        const file = new File(["hello"], "notes.txt", { type: "text/plain" });

        setFilesOnInput(dom.photoInput, [file]);

        const result = await uploadSelectedPhoto({
            authService,
            fileInput: dom.photoInput
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Please choose an image file.");
        expect(authService.setCurrentUserPhotoURL).not.toHaveBeenCalled();
    });

    test("uploadSelectedPhoto returns error when file is larger than 5 MB", async () => {
        const dom = createProfileDom();
        const authService = {
            setCurrentUserPhotoURL: jest.fn()
        };
        const file = new File(["x"], "big.jpg", { type: "image/jpeg" });

        Object.defineProperty(file, "size", {
            value: 6 * 1024 * 1024,
            configurable: true
        });

        setFilesOnInput(dom.photoInput, [file]);

        const result = await uploadSelectedPhoto({
            authService,
            fileInput: dom.photoInput
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Please choose an image smaller than 5 MB.");
        expect(authService.setCurrentUserPhotoURL).not.toHaveBeenCalled();
    });

    test("removeCurrentUserPhotoAction removes the current photo", async () => {
        const authService = {
            removeCurrentUserPhoto: jest.fn().mockResolvedValue({
                uid: "user-5",
                email: "user5@example.com",
                photoURL: ""
            })
        };

        const result = await removeCurrentUserPhotoAction({ authService });

        expect(result.success).toBe(true);
        expect(result.message).toBe("Profile photo removed.");
        expect(authService.removeCurrentUserPhoto).toHaveBeenCalledTimes(1);
        expect(result.profile.photoURL).toBe("");
    });

    test("deleteCurrentUserAccountAction deletes the current account", async () => {
        const authService = {
            deleteCurrentUserAccount: jest.fn().mockResolvedValue(undefined)
        };

        const result = await deleteCurrentUserAccountAction({ authService });

        expect(result.success).toBe(true);
        expect(result.message).toBe("Your account has been deleted.");
        expect(authService.deleteCurrentUserAccount).toHaveBeenCalledWith({
            deleteProfile: true
        });
    });
});

describe("profile.js page flow", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        window.history.pushState({}, "", "/authentication/profile.html");
    });

    test("initializeProfileView renders profile successfully", async () => {
        const dom = createProfileDom();

        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-6",
                email: "user6@example.com",
                displayName: "User Six"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-6",
                email: "user6@example.com",
                displayName: "User Six",
                vendorStatus: "approved",
                vendorReason: "Approved for sales"
            })
        };

        const result = await initializeProfileView({
            authService,
            statusElement: dom.statusElement,
            profileElements: {
                nameElement: dom.nameElement,
                emailElement: dom.emailElement,
                roleElement: dom.roleElement,
                vendorStatusElement: dom.vendorStatusElement,
                accessElement: dom.accessElement,
                vendorReasonElement: dom.vendorReasonElement,
                photoElement: dom.photoElement,
                leaveVendorButton: dom.leaveVendorButton,
                removePhotoButton: dom.removePhotoButton
            }
        });

        expect(result.success).toBe(true);
        expect(dom.nameElement.textContent).toBe("User Six");
        expect(dom.emailElement.textContent).toBe("user6@example.com");
        expect(dom.roleElement.textContent).toBe("Vendor");
        expect(dom.vendorStatusElement.textContent).toBe("Approved");
        expect(dom.accessElement.textContent).toBe("Customer and Vendor");
        expect(dom.vendorReasonElement.textContent).toBe("Approved for sales");
        expect(dom.statusElement.textContent).toBe("Profile loaded.");
        expect(dom.statusElement.dataset.state).toBe("success");
    });

    test("initializeProfileView shows friendly auth error", async () => {
        const dom = createProfileDom();

        const authService = {
            getCurrentUser: jest.fn(() => {
                const error = new Error("Sensitive action");
                error.code = "auth/requires-recent-login";
                throw error;
            }),
            getCurrentUserProfile: jest.fn()
        };

        const result = await initializeProfileView({
            authService,
            statusElement: dom.statusElement,
            profileElements: {
                nameElement: dom.nameElement,
                emailElement: dom.emailElement,
                roleElement: dom.roleElement,
                vendorStatusElement: dom.vendorStatusElement
            }
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Please sign in again before performing this sensitive action.");
        expect(dom.statusElement.textContent).toBe("Please sign in again before performing this sensitive action.");
    });

    test("attachSignOutHandler signs out and navigates", async () => {
        const dom = createProfileDom();

        const authService = {
            signOutUser: jest.fn().mockResolvedValue(undefined)
        };

        const onSuccess = jest.fn();
        const navigate = jest.fn();

        const { handleClick } = attachSignOutHandler({
            button: dom.signOutButton,
            authService,
            statusElement: dom.statusElement,
            onSuccess,
            navigate
        });

        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(true);
        expect(authService.signOutUser).toHaveBeenCalledTimes(1);
        expect(dom.statusElement.textContent).toBe("Signed out successfully.");
        expect(dom.statusElement.dataset.state).toBe("success");
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith("../index.html");
        expect(dom.signOutButton.disabled).toBe(false);
    });

    test("attachBackHandler resolves back route and navigates", async () => {
        const dom = createProfileDom();
        const navigate = jest.fn();

        const { handleClick } = attachBackHandler({
            button: dom.backButton,
            statusElement: dom.statusElement,
            navigate,
            resolveBackRoute: jest.fn().mockResolvedValue("../vendor/index.html")
        });

        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(true);
        expect(result.nextRoute).toBe("../vendor/index.html");
        expect(navigate).toHaveBeenCalledWith("../vendor/index.html");
        expect(dom.backButton.disabled).toBe(false);
    });

    test("attachResetPasswordHandler sends email and updates status", async () => {
        const dom = createProfileDom();

        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-7",
                email: "user7@example.com",
                displayName: "User Seven"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-7",
                email: "user7@example.com",
                displayName: "User Seven"
            }),
            sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined)
        };

        const { handleClick } = attachResetPasswordHandler({
            button: dom.resetPasswordButton,
            authService,
            statusElement: dom.statusElement
        });

        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(true);
        expect(result.message).toBe("Password reset email sent.");
        expect(dom.statusElement.textContent).toBe("Password reset email sent.");
        expect(dom.statusElement.dataset.state).toBe("success");
        expect(dom.resetPasswordButton.disabled).toBe(false);
    });

    test("attachDeleteAccountHandler stops when deletion is cancelled", async () => {
        const dom = createProfileDom();

        const authService = {
            deleteCurrentUserAccount: jest.fn()
        };

        const { handleClick } = attachDeleteAccountHandler({
            button: dom.deleteAccountButton,
            authService,
            accountMessageElement: dom.accountMessageElement,
            confirmAction: jest.fn().mockResolvedValue(false)
        });

        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Account deletion was cancelled.");
        expect(authService.deleteCurrentUserAccount).not.toHaveBeenCalled();
    });

    test("attachDeleteAccountHandler deletes account and navigates", async () => {
        const dom = createProfileDom();
        const navigate = jest.fn();

        const authService = {
            deleteCurrentUserAccount: jest.fn().mockResolvedValue(undefined)
        };

        const { handleClick } = attachDeleteAccountHandler({
            button: dom.deleteAccountButton,
            authService,
            accountMessageElement: dom.accountMessageElement,
            confirmAction: jest.fn().mockResolvedValue(true),
            navigate
        });

        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(true);
        expect(dom.accountMessageElement.textContent).toBe("Your account has been deleted.");
        expect(dom.accountMessageElement.dataset.state).toBe("success");
        expect(navigate).toHaveBeenCalledWith("../index.html");
    });

    test("attachSignOutHandler throws if button is missing", () => {
        expect(() =>
            attachSignOutHandler({
                button: null,
                authService: {
                    signOutUser: jest.fn()
                }
            })
        ).toThrow("A sign out button is required.");
    });

    test("attachSignOutHandler throws if authService is missing", () => {
        const dom = createProfileDom();

        expect(() =>
            attachSignOutHandler({
                button: dom.signOutButton
            })
        ).toThrow("authService is required.");
    });
});

describe("profile.js page initialization", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        window.history.pushState({}, "", "/authentication/profile.html?backTo=customer");
    });

    test("initializeProfilePage wires controllers and starts profile loading", async () => {
        const dom = createProfileDom();
        const navigate = jest.fn();

        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-8",
                email: "user8@example.com",
                displayName: "User Eight"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-8",
                email: "user8@example.com",
                displayName: "User Eight",
                vendorStatus: "none",
                accountStatus: "active"
            }),
            signOutUser: jest.fn().mockResolvedValue(undefined),
            sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
            updateUserProfile: jest.fn().mockResolvedValue(undefined),
            removeCurrentUserPhoto: jest.fn().mockResolvedValue({
                uid: "user-8",
                email: "user8@example.com",
                photoURL: ""
            }),
            deleteCurrentUserAccount: jest.fn().mockResolvedValue(undefined),
            setCurrentUserPhotoURL: jest.fn().mockResolvedValue({
                uid: "user-8",
                email: "user8@example.com",
                photoURL: "data:image/jpeg;base64,abc"
            })
        };

        const result = initializeProfilePage({
            authService,
            navigate
        });

        expect(result.signOutController).toBeTruthy();
        expect(result.backController).toBeTruthy();
        expect(result.resetPasswordController).toBeTruthy();
        expect(result.leaveVendorController).toBeTruthy();
        expect(result.photoPreviewController).toBeTruthy();
        expect(result.uploadPhotoController).toBeTruthy();
        expect(result.removePhotoController).toBeTruthy();
        expect(result.deleteAccountController).toBeTruthy();
        expect(result.profilePromise).toBeTruthy();

        const profileResult = await result.profilePromise;

        expect(profileResult.success).toBe(true);
        expect(dom.nameElement.textContent).toBe("User Eight");
        expect(dom.emailElement.textContent).toBe("user8@example.com");
        expect(dom.statusElement.textContent).toBe("Profile loaded.");
    });

    test("initializeProfilePage returns null controller when sign out button is missing", async () => {
        document.body.innerHTML = `
            <main>
                <p id="profile-name"></p>
                <p id="profile-email"></p>
                <p id="profile-role"></p>
                <p id="profile-vendor-status"></p>
                <p id="profile-access"></p>
                <p id="profile-vendor-reason"></p>
                <p id="profile-status"></p>
                <img id="profile-photo" alt="Profile picture" hidden />
            </main>
        `;

        const authService = {
            getCurrentUser: jest.fn(() => null),
            getCurrentUserProfile: jest.fn()
        };

        const result = initializeProfilePage({
            authService
        });

        expect(result.signOutController).toBeNull();

        const profileResult = await result.profilePromise;
        expect(profileResult.success).toBe(false);
        expect(profileResult.message).toBe("No user is currently signed in.");
    });

    test("initializeProfilePage throws when authService is missing", () => {
        createProfileDom();

        expect(() => initializeProfilePage()).toThrow("authService is required.");
    });
});