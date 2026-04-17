/**
 * @jest-environment jsdom
 */

const profilePage = require("../../public/authentication/profile.js");

const {
    normalizeText,
    normalizeVendorStatus,
    normalizeAccountStatus,
    resolveAuthUtils,
    normalizeUserProfile,
    setTextContent,
    setStatusMessage,
    clearStatusMessage,
    setElementHidden,
    setImageSource,
    clearFileInput,
    hasAuthenticatedIdentity,
    getRoleLabel,
    getVendorStatusLabel,
    getDisplayName,
    getEmail,
    getPhotoURL,
    getAvailablePortals,
    capitalize,
    getPortalAccessLabel,
    canLeaveVendor,
    canRemovePhoto,
    renderProfile,
    getFallbackRoutes,
    mapBackTargetToRoute,
    getBackRouteFromQuery,
    getBackRouteFromReferrer,
    getDefaultBackRoute,
    getBackRoute,
    getFriendlyErrorMessage,
    waitForAuthenticatedUser,
    loadCurrentUserProfile,
    signOutCurrentUser,
    sendSelfPasswordReset,
    leaveVendorAccess,
    isImageFile,
    readFileAsDataURL,
    loadImageFromSource,
    fileToOptimizedDataURL,
    getSelectedPhotoFile,
    previewSelectedPhoto,
    uploadSelectedPhoto,
    removeCurrentUserPhotoAction,
    deleteCurrentUserAccountAction,
    initializeProfileView,
    attachSignOutHandler,
    attachBackHandler,
    attachResetPasswordHandler,
    attachLeaveVendorHandler,
    attachPhotoInputPreviewHandler,
    attachUploadPhotoHandler,
    attachRemovePhotoHandler,
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

function mockReferrer(value) {
    Object.defineProperty(document, "referrer", {
        value,
        configurable: true
    });
}

function installSuccessfulImageMocks(options = {}) {
    const {
        dataUrl = "data:image/jpeg;base64,AAA",
        imageWidth = 1200,
        imageHeight = 800,
        canvasResult = "data:image/jpeg;base64,OPTIMIZED",
        withContext = true
    } = options;

    global.FileReader = class MockFileReader {
        constructor() {
            this.result = "";
            this.onload = null;
            this.onerror = null;
        }

        readAsDataURL() {
            this.result = dataUrl;
            setTimeout(() => {
                if (this.onload) {
                    this.onload();
                }
            }, 0);
        }
    };

    global.Image = class MockImage {
        constructor() {
            this.onload = null;
            this.onerror = null;
            this.naturalWidth = imageWidth;
            this.naturalHeight = imageHeight;
            this.width = imageWidth;
            this.height = imageHeight;
        }

        set src(value) {
            this._src = value;
            setTimeout(() => {
                if (this.onload) {
                    this.onload();
                }
            }, 0);
        }

        get src() {
            return this._src;
        }
    };

    const originalCreateElement = document.createElement.bind(document);
    const drawImage = jest.fn();
    const toDataURL = jest.fn(() => canvasResult);

    const createElementSpy = jest
        .spyOn(document, "createElement")
        .mockImplementation((tagName) => {
            if (tagName === "canvas") {
                return {
                    width: 0,
                    height: 0,
                    getContext: jest.fn(() => (withContext ? { drawImage } : null)),
                    toDataURL
                };
            }

            return originalCreateElement(tagName);
        });

    return {
        createElementSpy,
        drawImage,
        toDataURL
    };
}

function installFileReaderErrorMock() {
    global.FileReader = class MockFileReader {
        constructor() {
            this.onload = null;
            this.onerror = null;
        }

        readAsDataURL() {
            setTimeout(() => {
                if (this.onerror) {
                    this.onerror(new Error("boom"));
                }
            }, 0);
        }
    };
}

function installImageErrorMock(dataUrl = "data:image/jpeg;base64,AAA") {
    global.FileReader = class MockFileReader {
        constructor() {
            this.result = "";
            this.onload = null;
            this.onerror = null;
        }

        readAsDataURL() {
            this.result = dataUrl;
            setTimeout(() => {
                if (this.onload) {
                    this.onload();
                }
            }, 0);
        }
    };

    global.Image = class MockImage {
        constructor() {
            this.onload = null;
            this.onerror = null;
        }

        set src(value) {
            this._src = value;
            setTimeout(() => {
                if (this.onerror) {
                    this.onerror(new Error("broken image"));
                }
            }, 0);
        }
    };
}

describe("profile.js helpers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        window.history.pushState({}, "", "/authentication/profile.html");
        mockReferrer("");
        delete window.authUtils;
        jest.restoreAllMocks();
    });

    test("resolveAuthUtils prefers explicit utils then window utils", () => {
        const explicitUtils = { normalizeUserData: jest.fn() };
        const windowUtils = { mapAuthErrorCode: jest.fn() };

        window.authUtils = windowUtils;

        expect(resolveAuthUtils(explicitUtils)).toBe(explicitUtils);
        expect(resolveAuthUtils()).toBe(windowUtils);
    });

    test("normalizeText and status helpers work safely", () => {
        const dom = createProfileDom();

        expect(normalizeText("  Hello  ")).toBe("Hello");
        expect(normalizeText(null)).toBe("");

        setTextContent(dom.nameElement, "   ", "Unknown");
        expect(dom.nameElement.textContent).toBe("Unknown");

        setStatusMessage(dom.statusElement, "Loaded", "success");
        expect(dom.statusElement.textContent).toBe("Loaded");
        expect(dom.statusElement.dataset.state).toBe("success");

        clearStatusMessage(dom.statusElement);
        expect(dom.statusElement.textContent).toBe("");
        expect(dom.statusElement.dataset.state).toBe("");
    });

    test("normalizeVendorStatus and normalizeAccountStatus cover extra cases", () => {
        expect(normalizeVendorStatus("suspended")).toBe("blocked");
        expect(normalizeVendorStatus("weird")).toBe("none");
        expect(normalizeAccountStatus("blocked")).toBe("blocked");
        expect(normalizeAccountStatus("disabled")).toBe("disabled");
        expect(normalizeAccountStatus("anything")).toBe("active");
    });

    test("normalizeUserProfile uses authUtils normaliseUserData when available", () => {
        const authUtils = {
            normaliseUserData: jest.fn(() => ({ custom: true }))
        };

        expect(normalizeUserProfile({ displayName: "Name" }, authUtils)).toEqual({
            custom: true
        });
        expect(authUtils.normaliseUserData).toHaveBeenCalledWith({
            displayName: "Name"
        });
    });

    test("normalizeUserProfile uses authUtils normalizeUserData when available", () => {
        const authUtils = {
            normalizeUserData: jest.fn(() => ({ custom: true }))
        };

        expect(normalizeUserProfile({ displayName: "Name" }, authUtils)).toEqual({
            custom: true
        });
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

    test("element visibility and image helpers update the DOM", () => {
        const dom = createProfileDom();

        setElementHidden(dom.leaveVendorButton, true);
        expect(dom.leaveVendorButton.hidden).toBe(true);
        expect(dom.leaveVendorButton.getAttribute("aria-hidden")).toBe("true");

        setImageSource(dom.photoElement, "https://example.com/pic.png", "My alt");
        expect(dom.photoElement.hidden).toBe(false);
        expect(dom.photoElement.getAttribute("src")).toBe("https://example.com/pic.png");
        expect(dom.photoElement.alt).toBe("My alt");

        setImageSource(dom.photoElement, "   ", "Other alt");
        expect(dom.photoElement.hidden).toBe(true);
        expect(dom.photoElement.hasAttribute("src")).toBe(false);
        expect(dom.photoElement.alt).toBe("Other alt");
    });

    test("clearFileInput resets the input value safely", () => {
        const dom = createProfileDom();
        expect(() => clearFileInput(null)).not.toThrow();
        clearFileInput(dom.photoInput);
        expect(dom.photoInput.value).toBe("");
    });

    test("identity and role helpers use the new canonical fields", () => {
        expect(hasAuthenticatedIdentity({ uid: "user-1" })).toBe(true);
        expect(hasAuthenticatedIdentity({ email: "a@example.com" })).toBe(true);
        expect(hasAuthenticatedIdentity({})).toBe(false);

        expect(getRoleLabel({ isOwner: true })).toBe("Owner");
        expect(getRoleLabel({ isAdmin: true })).toBe("Admin");
        expect(getRoleLabel({ vendorStatus: "approved" })).toBe("Vendor");
        expect(getRoleLabel({ vendorStatus: "pending" })).toBe("Customer");

        expect(getVendorStatusLabel({ vendorStatus: "pending" })).toBe("Pending");
        expect(getVendorStatusLabel({ vendorStatus: "approved" })).toBe("Approved");
        expect(getVendorStatusLabel({ vendorStatus: "rejected" })).toBe("Rejected");
        expect(getVendorStatusLabel({ vendorStatus: "suspended" })).toBe("Blocked");
        expect(getVendorStatusLabel({ vendorStatus: "none" })).toBe("None");
    });

    test("display helpers fall back correctly", () => {
        expect(getDisplayName({ displayName: "Profile Name" }, { displayName: "User Name" })).toBe("Profile Name");
        expect(getDisplayName({ displayName: "" }, { displayName: "User Name" })).toBe("User Name");
        expect(getEmail({ email: "profile@example.com" }, { email: "user@example.com" })).toBe("profile@example.com");
        expect(getEmail({ email: "" }, { email: "user@example.com" })).toBe("user@example.com");
        expect(getPhotoURL({ photoURL: "profile.png" }, { photoURL: "user.png" })).toBe("profile.png");
        expect(getPhotoURL({ photoURL: "" }, { photoURL: "user.png" })).toBe("user.png");
    });

    test("portal helpers and access labels work for all major cases", () => {
        expect(getAvailablePortals({ uid: "user-1", accountStatus: "active" })).toEqual(["customer"]);
        expect(getAvailablePortals({ uid: "user-1", vendorStatus: "approved", accountStatus: "active" })).toEqual(["customer", "vendor"]);
        expect(getAvailablePortals({ uid: "user-1", isAdmin: true, accountStatus: "active" })).toEqual(["customer", "admin"]);
        expect(getAvailablePortals({ uid: "user-1", isOwner: true, accountStatus: "active" })).toEqual(["customer", "vendor", "admin"]);
        expect(getAvailablePortals({ uid: "user-1", accountStatus: "blocked" })).toEqual([]);

        const authUtils = {
            getAvailablePortals: jest.fn(() => ["admin"])
        };
        expect(getAvailablePortals({ uid: "user-1" }, authUtils)).toEqual(["admin"]);

        expect(capitalize("customer")).toBe("Customer");
        expect(capitalize("   ")).toBe("");

        expect(getPortalAccessLabel({ uid: "user-1", accountStatus: "active" })).toBe("Customer");
        expect(getPortalAccessLabel({ uid: "user-1", vendorStatus: "approved", accountStatus: "active" })).toBe("Customer and Vendor");
        expect(getPortalAccessLabel({ uid: "user-1", isOwner: true, accountStatus: "active" })).toBe("Customer, Vendor, and Admin");
        expect(getPortalAccessLabel({ accountStatus: "blocked" })).toBe("None");
    });

    test("canLeaveVendor and canRemovePhoto follow the new rules", () => {
        expect(canLeaveVendor({ isOwner: true, vendorStatus: "approved" })).toBe(false);
        expect(canLeaveVendor({ vendorStatus: "pending" })).toBe(true);
        expect(canLeaveVendor({ vendorStatus: "none" })).toBe(false);

        expect(canRemovePhoto({ photoURL: "pic.png" }, null)).toBe(true);
        expect(canRemovePhoto({}, { photoURL: "fallback.png" })).toBe(true);
        expect(canRemovePhoto({}, {})).toBe(false);
    });

    test("renderProfile fills all key fields and button visibility", () => {
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
                vendorStatus: "approved",
                vendorReason: "Approved for selling",
                photoURL: "https://example.com/photo.png",
                uid: "user-1",
                accountStatus: "active"
            },
            {
                displayName: "Ignored User",
                email: "ignored@example.com"
            }
        );

        expect(dom.nameElement.textContent).toBe("Faranani Maduwa");
        expect(dom.emailElement.textContent).toBe("faranani@example.com");
        expect(dom.roleElement.textContent).toBe("Vendor");
        expect(dom.vendorStatusElement.textContent).toBe("Approved");
        expect(dom.accessElement.textContent).toBe("Customer and Vendor");
        expect(dom.vendorReasonElement.textContent).toBe("Approved for selling");
        expect(dom.photoElement.hidden).toBe(false);
        expect(dom.leaveVendorButton.hidden).toBe(false);
        expect(dom.removePhotoButton.hidden).toBe(false);
    });

    test("route helpers cover query, referrer, defaults, and custom routes", () => {
        const customRoutes = {
            customer: "/c",
            vendor: "/v",
            admin: "/a",
            roleChoice: "/roles",
            login: "/login"
        };

        expect(getFallbackRoutes({ PORTAL_ROUTES: customRoutes })).toBe(customRoutes);
        expect(mapBackTargetToRoute("customer")).toBe("../customer/index.html");
        expect(mapBackTargetToRoute("rolechoice")).toBe("../authentication/role-choice.html");
        expect(mapBackTargetToRoute("login")).toBe("../authentication/login.html");
        expect(mapBackTargetToRoute("unknown")).toBe("");

        window.history.pushState({}, "", "/authentication/profile.html?from=vendor");
        expect(getBackRouteFromQuery()).toBe("../vendor/index.html");

        mockReferrer("http://localhost/admin/index.html");
        expect(getBackRouteFromReferrer()).toBe("../admin/index.html");

        mockReferrer("https://othersite.com/vendor/index.html");
        expect(getBackRouteFromReferrer()).toBe("");

        mockReferrer("not a real url");
        expect(getBackRouteFromReferrer()).toBe("");

        expect(getDefaultBackRoute({ uid: "user-1", vendorStatus: "approved", accountStatus: "active" })).toBe("../authentication/role-choice.html");
        expect(getDefaultBackRoute({ uid: "user-1", accountStatus: "active" })).toBe("../customer/index.html");
        expect(getDefaultBackRoute({ accountStatus: "blocked" })).toBe("../authentication/login.html");

        window.history.pushState({}, "", "/authentication/profile.html?back=admin");
        expect(getBackRoute({ uid: "user-1", accountStatus: "active" })).toBe("../admin/index.html");
        expect(getBackRoute({ uid: "user-1", accountStatus: "active" }, null, "vendor")).toBe("../vendor/index.html");
    });

    test("getFriendlyErrorMessage covers fallback, auth mapping, and message fallback", () => {
        expect(getFriendlyErrorMessage(null, null, "Fallback message")).toBe("Fallback message");
        expect(getFriendlyErrorMessage({ code: "auth/requires-recent-login" })).toBe(
            "Please sign in again before performing this sensitive action."
        );
        expect(
            getFriendlyErrorMessage(
                { code: "auth/custom" },
                { mapAuthErrorCode: jest.fn(() => "Mapped auth error") },
                "Fallback"
            )
        ).toBe("Mapped auth error");
        expect(getFriendlyErrorMessage({ message: "Plain message" }, null, "Fallback")).toBe("Plain message");
        expect(getFriendlyErrorMessage({}, null, "Fallback")).toBe("Fallback");
    });
});

describe("profile.js auth and service functions", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        jest.restoreAllMocks();
    });

    test("waitForAuthenticatedUser covers current user, observer, and null result", async () => {
        const immediate = await waitForAuthenticatedUser({
            getCurrentUser: jest.fn(() => ({ uid: "user-0" }))
        });
        expect(immediate).toEqual({ uid: "user-0" });

        const unsubscribe = jest.fn();
        const delayed = await waitForAuthenticatedUser({
            getCurrentUser: jest.fn(() => null),
            observeAuthState: jest.fn((callback) => {
                setTimeout(() => callback({ uid: "late-user" }), 0);
                return unsubscribe;
            })
        });
        expect(delayed).toEqual({ uid: "late-user" });
        expect(unsubscribe).toHaveBeenCalledTimes(1);

        const empty = await waitForAuthenticatedUser({
            getCurrentUser: jest.fn(() => null)
        });
        expect(empty).toBeNull();
    });

    test("loadCurrentUserProfile returns fallback normalized profile when stored profile is missing", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-1",
                email: "user@example.com",
                displayName: "User One",
                phoneNumber: "0711111111",
                photoURL: "pic.png"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue(null)
        };

        const result = await loadCurrentUserProfile({ authService });

        expect(result.success).toBe(true);
        expect(result.profile).toEqual({
            uid: "user-1",
            displayName: "User One",
            email: "user@example.com",
            phoneNumber: "0711111111",
            photoURL: "pic.png",
            isOwner: false,
            isAdmin: false,
            vendorStatus: "none",
            vendorReason: "",
            accountStatus: "active"
        });
    });

    test("loadCurrentUserProfile returns no-user result", async () => {
        const result = await loadCurrentUserProfile({
            authService: {
                getCurrentUser: jest.fn(() => null),
                getCurrentUserProfile: jest.fn()
            }
        });

        expect(result).toEqual({
            success: false,
            message: "No user is currently signed in."
        });
    });

    test("signOutCurrentUser, sendSelfPasswordReset, and leaveVendorAccess work on success", async () => {
        const authService = {
            signOutUser: jest.fn().mockResolvedValue(undefined),
            getCurrentUser: jest.fn(() => ({
                uid: "user-2",
                email: "user2@example.com",
                displayName: "User Two"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-2",
                email: "user2@example.com",
                displayName: "User Two",
                vendorStatus: "approved",
                vendorReason: "Old reason"
            }),
            sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
            updateUserProfile: jest.fn().mockResolvedValue(undefined)
        };

        await expect(signOutCurrentUser({ authService })).resolves.toEqual({ success: true });

        await expect(sendSelfPasswordReset({ authService })).resolves.toEqual({
            success: true,
            message: "Password reset email sent."
        });
        expect(authService.sendPasswordResetEmail).toHaveBeenCalledWith({
            email: "user2@example.com"
        });

        const leaveResult = await leaveVendorAccess({ authService });
        expect(leaveResult.success).toBe(true);
        expect(leaveResult.profile.vendorStatus).toBe("none");
        expect(authService.updateUserProfile).toHaveBeenCalledWith("user-2", {
            vendorStatus: "none",
            vendorReason: ""
        });
    });

    test("sendSelfPasswordReset and leaveVendorAccess cover failure branches", async () => {
        const noEmailService = {
            getCurrentUser: jest.fn(() => ({ uid: "user-3", email: "" })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({ uid: "user-3", email: "" }),
            sendPasswordResetEmail: jest.fn()
        };
        await expect(sendSelfPasswordReset({ authService: noEmailService })).resolves.toEqual({
            success: false,
            message: "No email address is available for this account."
        });

        const ownerService = {
            getCurrentUser: jest.fn(() => ({ uid: "owner-1", email: "owner@example.com" })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "owner-1",
                isOwner: true,
                vendorStatus: "approved"
            }),
            updateUserProfile: jest.fn()
        };
        await expect(leaveVendorAccess({ authService: ownerService })).resolves.toEqual({
            success: false,
            message: "Owner access cannot be removed from the profile page."
        });

        const noneService = {
            getCurrentUser: jest.fn(() => ({ uid: "user-4", email: "customer@example.com" })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-4",
                vendorStatus: "none"
            }),
            updateUserProfile: jest.fn()
        };
        await expect(leaveVendorAccess({ authService: noneService })).resolves.toEqual({
            success: false,
            message: "You are not currently marked as a vendor."
        });

        const noUserService = {
            getCurrentUser: jest.fn(() => null),
            getCurrentUserProfile: jest.fn(),
            updateUserProfile: jest.fn()
        };
        await expect(leaveVendorAccess({ authService: noUserService })).resolves.toEqual({
            success: false,
            message: "No user is currently signed in."
        });
    });
});

describe("profile.js image helpers", () => {
    const originalFileReader = global.FileReader;
    const originalImage = global.Image;

    beforeEach(() => {
        document.body.innerHTML = "";
        jest.restoreAllMocks();
    });

    afterEach(() => {
        global.FileReader = originalFileReader;
        global.Image = originalImage;
        jest.restoreAllMocks();
    });

    test("isImageFile and getSelectedPhotoFile work correctly", () => {
        const dom = createProfileDom();
        const imageFile = new File(["abc"], "photo.jpg", { type: "image/jpeg" });
        const textFile = new File(["abc"], "notes.txt", { type: "text/plain" });

        setFilesOnInput(dom.photoInput, [imageFile, textFile]);

        expect(isImageFile(imageFile)).toBe(true);
        expect(isImageFile(textFile)).toBe(false);
        expect(getSelectedPhotoFile(dom.photoInput)).toBe(imageFile);
        expect(getSelectedPhotoFile(null)).toBeNull();
    });

    test("readFileAsDataURL resolves and rejects correctly", async () => {
        installSuccessfulImageMocks({ dataUrl: "data:image/jpeg;base64,READ_OK" });
        const file = new File(["abc"], "photo.jpg", { type: "image/jpeg" });

        await expect(readFileAsDataURL(file)).resolves.toBe("data:image/jpeg;base64,READ_OK");

        installFileReaderErrorMock();
        await expect(readFileAsDataURL(file)).rejects.toThrow("Unable to read the selected file.");
    });

    test("loadImageFromSource resolves and rejects correctly", async () => {
        installSuccessfulImageMocks();
        await expect(loadImageFromSource("data:image/jpeg;base64,AAA")).resolves.toBeInstanceOf(global.Image);

        installImageErrorMock();
        await expect(loadImageFromSource("data:image/jpeg;base64,AAA")).rejects.toThrow(
            "Unable to process the selected image."
        );
    });

    test("fileToOptimizedDataURL returns original data when canvas context is missing", async () => {
        installSuccessfulImageMocks({
            dataUrl: "data:image/jpeg;base64,ORIGINAL",
            withContext: false
        });
        const file = new File(["abc"], "photo.jpg", { type: "image/jpeg" });

        await expect(fileToOptimizedDataURL(file)).resolves.toBe("data:image/jpeg;base64,ORIGINAL");
    });

    test("fileToOptimizedDataURL optimizes with the correct output type", async () => {
        const mocks = installSuccessfulImageMocks({
            dataUrl: "data:image/png;base64,ORIGINAL",
            canvasResult: "data:image/png;base64,OPTIMIZED",
            imageWidth: 1000,
            imageHeight: 500
        });
        const file = new File(["abc"], "photo.png", { type: "image/png" });

        const result = await fileToOptimizedDataURL(file, {
            maxWidth: 400,
            maxHeight: 400,
            quality: 0.5
        });

        expect(result).toBe("data:image/png;base64,OPTIMIZED");
        expect(mocks.drawImage).toHaveBeenCalled();
        expect(mocks.toDataURL).toHaveBeenCalledWith("image/png", 0.5);
    });

    test("previewSelectedPhoto handles missing file, wrong type, and success", async () => {
        const dom = createProfileDom();

        const missing = await previewSelectedPhoto({
            fileInput: dom.photoInput,
            profileElements: { photoElement: dom.photoElement },
            photoMessageElement: dom.photoMessageElement
        });
        expect(missing.success).toBe(false);
        expect(missing.message).toBe("Choose a photo first.");

        const textFile = new File(["abc"], "notes.txt", { type: "text/plain" });
        setFilesOnInput(dom.photoInput, [textFile]);

        const wrongType = await previewSelectedPhoto({
            fileInput: dom.photoInput,
            profileElements: { photoElement: dom.photoElement },
            photoMessageElement: dom.photoMessageElement
        });
        expect(wrongType.success).toBe(false);
        expect(wrongType.message).toBe("Please choose an image file.");

        const imageFile = new File(["abc"], "photo.jpg", { type: "image/jpeg" });
        setFilesOnInput(dom.photoInput, [imageFile]);
        installSuccessfulImageMocks({ canvasResult: "data:image/jpeg;base64,PREVIEW" });

        const success = await previewSelectedPhoto({
            fileInput: dom.photoInput,
            profileElements: { photoElement: dom.photoElement },
            photoMessageElement: dom.photoMessageElement
        });

        expect(success.success).toBe(true);
        expect(success.previewDataUrl).toBe("data:image/jpeg;base64,PREVIEW");
        expect(dom.photoElement.hidden).toBe(false);
        expect(dom.photoElement.getAttribute("src")).toBe("data:image/jpeg;base64,PREVIEW");
        expect(dom.photoMessageElement.textContent).toBe(
            "Photo preview ready. Click Upload Photo to save it."
        );
    });

    test("uploadSelectedPhoto covers validation and success", async () => {
        const dom = createProfileDom();
        const authService = {
            setCurrentUserPhotoURL: jest.fn().mockResolvedValue({
                uid: "user-5",
                email: "user5@example.com",
                photoURL: "data:image/jpeg;base64,SAVED"
            })
        };

        await expect(uploadSelectedPhoto({ authService, fileInput: dom.photoInput })).resolves.toEqual({
            success: false,
            message: "Choose a photo first."
        });

        const textFile = new File(["abc"], "notes.txt", { type: "text/plain" });
        setFilesOnInput(dom.photoInput, [textFile]);
        await expect(uploadSelectedPhoto({ authService, fileInput: dom.photoInput })).resolves.toEqual({
            success: false,
            message: "Please choose an image file."
        });

        const bigImage = new File(["x"], "big.jpg", { type: "image/jpeg" });
        Object.defineProperty(bigImage, "size", {
            value: 6 * 1024 * 1024,
            configurable: true
        });
        setFilesOnInput(dom.photoInput, [bigImage]);
        await expect(uploadSelectedPhoto({ authService, fileInput: dom.photoInput })).resolves.toEqual({
            success: false,
            message: "Please choose an image smaller than 5 MB."
        });

        const imageFile = new File(["abc"], "photo.jpg", { type: "image/jpeg" });
        Object.defineProperty(imageFile, "size", {
            value: 100,
            configurable: true
        });
        setFilesOnInput(dom.photoInput, [imageFile]);
        installSuccessfulImageMocks({ canvasResult: "data:image/jpeg;base64,UPLOADED" });

        const result = await uploadSelectedPhoto({ authService, fileInput: dom.photoInput });
        expect(result.success).toBe(true);
        expect(result.message).toBe("Profile photo updated.");
        expect(authService.setCurrentUserPhotoURL).toHaveBeenCalledWith("data:image/jpeg;base64,UPLOADED");
    });

    test("removeCurrentUserPhotoAction and deleteCurrentUserAccountAction succeed", async () => {
        const photoService = {
            removeCurrentUserPhoto: jest.fn().mockResolvedValue({
                uid: "user-6",
                email: "user6@example.com",
                photoURL: ""
            })
        };

        await expect(removeCurrentUserPhotoAction({ authService: photoService })).resolves.toEqual({
            success: true,
            message: "Profile photo removed.",
            profile: {
                uid: "user-6",
                displayName: "",
                email: "user6@example.com",
                phoneNumber: "",
                photoURL: "",
                isOwner: false,
                isAdmin: false,
                vendorStatus: "none",
                vendorReason: "",
                accountStatus: "active"
            }
        });

        const deleteService = {
            deleteCurrentUserAccount: jest.fn().mockResolvedValue(undefined)
        };

        await expect(deleteCurrentUserAccountAction({ authService: deleteService })).resolves.toEqual({
            success: true,
            message: "Your account has been deleted."
        });
    });
});

describe("profile.js page handlers", () => {
    const originalFileReader = global.FileReader;
    const originalImage = global.Image;

    beforeEach(() => {
        createProfileDom();
        window.history.pushState({}, "", "/authentication/profile.html?backTo=customer");
        mockReferrer("");
        delete window.authUtils;
        jest.restoreAllMocks();
    });

    afterEach(() => {
        global.FileReader = originalFileReader;
        global.Image = originalImage;
        jest.restoreAllMocks();
    });

    test("initializeProfileView renders success and mapped errors", async () => {
        const dom = createProfileDom();

        const successService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-7",
                email: "user7@example.com",
                displayName: "User Seven"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-7",
                email: "user7@example.com",
                displayName: "User Seven",
                vendorStatus: "none",
                accountStatus: "active"
            })
        };

        const success = await initializeProfileView({
            authService: successService,
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

        expect(success.success).toBe(true);
        expect(dom.statusElement.textContent).toBe("Profile loaded.");
        expect(dom.nameElement.textContent).toBe("User Seven");
        expect(dom.accessElement.textContent).toBe("Customer");

        const errorService = {
            getCurrentUser: jest.fn(() => {
                const error = new Error("Ignored");
                error.code = "auth/custom";
                throw error;
            }),
            getCurrentUserProfile: jest.fn()
        };

        const failure = await initializeProfileView({
            authService: errorService,
            authUtils: {
                mapAuthErrorCode: jest.fn(() => "Mapped auth error")
            },
            statusElement: dom.statusElement,
            profileElements: {}
        });

        expect(failure.success).toBe(false);
        expect(failure.message).toBe("Mapped auth error");
        expect(dom.statusElement.textContent).toBe("Mapped auth error");
    });

    test("attachSignOutHandler success and error branches work", async () => {
        const dom = createProfileDom();
        const navigate = jest.fn();
        const onSuccess = jest.fn();
        const onError = jest.fn();

        const successHandler = attachSignOutHandler({
            button: dom.signOutButton,
            authService: {
                signOutUser: jest.fn().mockResolvedValue(undefined)
            },
            statusElement: dom.statusElement,
            navigate,
            onSuccess
        });

        const success = await successHandler.handleClick({ preventDefault: jest.fn() });
        expect(success.success).toBe(true);
        expect(dom.statusElement.textContent).toBe("Signed out successfully.");
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith("../index.html");

        const errorHandler = attachSignOutHandler({
            button: dom.signOutButton,
            authService: {
                signOutUser: jest.fn().mockRejectedValue(new Error("Unable to sign out"))
            },
            statusElement: dom.statusElement,
            onError
        });

        const failure = await errorHandler.handleClick({ preventDefault: jest.fn() });
        expect(failure.success).toBe(false);
        expect(failure.message).toBe("Unable to sign out");
        expect(onError).toHaveBeenCalledTimes(1);
    });

    test("attachBackHandler covers success, fallback route, and error", async () => {
        const dom = createProfileDom();
        const navigate = jest.fn();
        const onError = jest.fn();

        const successHandler = attachBackHandler({
            button: dom.backButton,
            statusElement: dom.statusElement,
            navigate,
            resolveBackRoute: jest.fn().mockResolvedValue("../vendor/index.html")
        });

        await expect(successHandler.handleClick({ preventDefault: jest.fn() })).resolves.toEqual({
            success: true,
            nextRoute: "../vendor/index.html"
        });
        expect(navigate).toHaveBeenCalledWith("../vendor/index.html");

        const fallbackHandler = attachBackHandler({
            button: dom.backButton,
            statusElement: dom.statusElement,
            navigate
        });
        await fallbackHandler.handleClick({ preventDefault: jest.fn() });
        expect(navigate).toHaveBeenCalledWith("../authentication/role-choice.html");

        const errorHandler = attachBackHandler({
            button: dom.backButton,
            statusElement: dom.statusElement,
            navigate,
            resolveBackRoute: jest.fn().mockRejectedValue(new Error("Back failed")),
            onError
        });
        const failure = await errorHandler.handleClick({ preventDefault: jest.fn() });
        expect(failure.success).toBe(false);
        expect(failure.message).toBe("Back failed");
        expect(dom.statusElement.textContent).toBe("Back failed");
        expect(onError).toHaveBeenCalledTimes(1);
    });

    test("attachResetPasswordHandler covers success, service failure result, and thrown error", async () => {
        const dom = createProfileDom();
        const onSuccess = jest.fn();
        const onError = jest.fn();

        const successHandler = attachResetPasswordHandler({
            button: dom.resetPasswordButton,
            authService: {
                getCurrentUser: jest.fn(() => ({ uid: "user-8", email: "user8@example.com" })),
                getCurrentUserProfile: jest.fn().mockResolvedValue({ uid: "user-8", email: "user8@example.com" }),
                sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined)
            },
            statusElement: dom.statusElement,
            onSuccess
        });

        const success = await successHandler.handleClick({ preventDefault: jest.fn() });
        expect(success.success).toBe(true);
        expect(dom.statusElement.textContent).toBe("Password reset email sent.");
        expect(onSuccess).toHaveBeenCalledTimes(1);

        const noEmailHandler = attachResetPasswordHandler({
            button: dom.resetPasswordButton,
            authService: {
                getCurrentUser: jest.fn(() => ({ uid: "user-9", email: "" })),
                getCurrentUserProfile: jest.fn().mockResolvedValue({ uid: "user-9", email: "" }),
                sendPasswordResetEmail: jest.fn()
            },
            statusElement: dom.statusElement,
            onError
        });

        const noEmail = await noEmailHandler.handleClick({ preventDefault: jest.fn() });
        expect(noEmail.success).toBe(false);
        expect(noEmail.message).toBe("No email address is available for this account.");

        const thrownHandler = attachResetPasswordHandler({
            button: dom.resetPasswordButton,
            authService: {
                getCurrentUser: jest.fn(() => ({ uid: "user-10", email: "user10@example.com" })),
                getCurrentUserProfile: jest.fn().mockResolvedValue({ uid: "user-10", email: "user10@example.com" }),
                sendPasswordResetEmail: jest.fn().mockRejectedValue(Object.assign(new Error("Ignored"), { code: "auth/custom" }))
            },
            authUtils: {
                mapAuthErrorCode: jest.fn(() => "Mapped reset error")
            },
            statusElement: dom.statusElement,
            onError
        });

        const failure = await thrownHandler.handleClick({ preventDefault: jest.fn() });
        expect(failure.success).toBe(false);
        expect(failure.message).toBe("Mapped reset error");
        expect(onError).toHaveBeenCalled();
    });

    test("attachLeaveVendorHandler covers success, unsuccessful result, and thrown error", async () => {
        const dom = createProfileDom();
        const refreshProfile = jest.fn().mockResolvedValue(undefined);
        const onSuccess = jest.fn();
        const onError = jest.fn();

        const successHandler = attachLeaveVendorHandler({
            button: dom.leaveVendorButton,
            authService: {
                getCurrentUser: jest.fn(() => ({ uid: "user-11", email: "vendor@example.com" })),
                getCurrentUserProfile: jest.fn().mockResolvedValue({ uid: "user-11", vendorStatus: "approved" }),
                updateUserProfile: jest.fn().mockResolvedValue(undefined)
            },
            statusElement: dom.statusElement,
            refreshProfile,
            onSuccess
        });

        const success = await successHandler.handleClick({ preventDefault: jest.fn() });
        expect(success.success).toBe(true);
        expect(refreshProfile).toHaveBeenCalledTimes(1);
        expect(onSuccess).toHaveBeenCalledTimes(1);

        const unsuccessfulHandler = attachLeaveVendorHandler({
            button: dom.leaveVendorButton,
            authService: {
                getCurrentUser: jest.fn(() => ({ uid: "user-12", email: "customer@example.com" })),
                getCurrentUserProfile: jest.fn().mockResolvedValue({ uid: "user-12", vendorStatus: "none" }),
                updateUserProfile: jest.fn()
            },
            statusElement: dom.statusElement,
            onError
        });

        const unsuccessful = await unsuccessfulHandler.handleClick({ preventDefault: jest.fn() });
        expect(unsuccessful.success).toBe(false);
        expect(unsuccessful.message).toBe("You are not currently marked as a vendor.");

        const thrownHandler = attachLeaveVendorHandler({
            button: dom.leaveVendorButton,
            authService: {
                getCurrentUser: jest.fn(() => ({ uid: "user-13", email: "vendor@example.com" })),
                getCurrentUserProfile: jest.fn().mockResolvedValue({ uid: "user-13", vendorStatus: "approved" }),
                updateUserProfile: jest.fn().mockRejectedValue(Object.assign(new Error("Ignored"), { code: "auth/custom" }))
            },
            authUtils: {
                mapAuthErrorCode: jest.fn(() => "Mapped leave error")
            },
            statusElement: dom.statusElement,
            onError
        });

        const failure = await thrownHandler.handleClick({ preventDefault: jest.fn() });
        expect(failure.success).toBe(false);
        expect(failure.message).toBe("Mapped leave error");
    });

    test("attachPhotoInputPreviewHandler covers null input, unsuccessful result, success, and thrown error", async () => {
        const dom = createProfileDom();
        expect(attachPhotoInputPreviewHandler({ fileInput: null })).toBeNull();

        const onSuccess = jest.fn();
        const onError = jest.fn();

        const noFileController = attachPhotoInputPreviewHandler({
            fileInput: dom.photoInput,
            profileElements: { photoElement: dom.photoElement },
            photoMessageElement: dom.photoMessageElement,
            onError
        });

        const noFile = await noFileController.handleChange();
        expect(noFile.success).toBe(false);
        expect(onError).toHaveBeenCalled();

        const imageFile = new File(["abc"], "photo.jpg", { type: "image/jpeg" });
        setFilesOnInput(dom.photoInput, [imageFile]);
        installSuccessfulImageMocks({ canvasResult: "data:image/jpeg;base64,PREVIEW_HANDLER" });

        const successController = attachPhotoInputPreviewHandler({
            fileInput: dom.photoInput,
            profileElements: { photoElement: dom.photoElement },
            photoMessageElement: dom.photoMessageElement,
            onSuccess
        });

        const success = await successController.handleChange();
        expect(success.success).toBe(true);
        expect(onSuccess).toHaveBeenCalled();

        setFilesOnInput(dom.photoInput, [imageFile]);
        installFileReaderErrorMock();

        const thrownController = attachPhotoInputPreviewHandler({
            fileInput: dom.photoInput,
            profileElements: { photoElement: dom.photoElement },
            photoMessageElement: dom.photoMessageElement,
            onError
        });

        const failure = await thrownController.handleChange();
        expect(failure.success).toBe(false);
        expect(failure.message).toBe("Unable to read the selected file.");
    });

    test("attachUploadPhotoHandler covers null button, success, unsuccessful result, and thrown error", async () => {
        const dom = createProfileDom();
        expect(
            attachUploadPhotoHandler({
                button: null,
                authService: { setCurrentUserPhotoURL: jest.fn() }
            })
        ).toBeNull();

        const imageFile = new File(["abc"], "photo.jpg", { type: "image/jpeg" });
        Object.defineProperty(imageFile, "size", {
            value: 100,
            configurable: true
        });
        setFilesOnInput(dom.photoInput, [imageFile]);
        installSuccessfulImageMocks({ canvasResult: "data:image/jpeg;base64,UP_HANDLER" });

        const refreshProfile = jest.fn().mockResolvedValue(undefined);
        const onSuccess = jest.fn();
        const successController = attachUploadPhotoHandler({
            button: dom.uploadPhotoButton,
            fileInput: dom.photoInput,
            authService: {
                setCurrentUserPhotoURL: jest.fn().mockResolvedValue({
                    uid: "user-14",
                    email: "user14@example.com",
                    photoURL: "data:image/jpeg;base64,UP_HANDLER"
                })
            },
            photoMessageElement: dom.photoMessageElement,
            profileElements: {
                photoElement: dom.photoElement,
                removePhotoButton: dom.removePhotoButton,
                leaveVendorButton: dom.leaveVendorButton
            },
            refreshProfile,
            onSuccess
        });

        const success = await successController.handleClick({ preventDefault: jest.fn() });
        expect(success.success).toBe(true);
        expect(refreshProfile).toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalled();
        expect(dom.photoMessageElement.textContent).toBe("Profile photo updated.");

        setFilesOnInput(dom.photoInput, []);
        const onError = jest.fn();
        const unsuccessfulController = attachUploadPhotoHandler({
            button: dom.uploadPhotoButton,
            fileInput: dom.photoInput,
            authService: {
                setCurrentUserPhotoURL: jest.fn()
            },
            photoMessageElement: dom.photoMessageElement,
            onError
        });

        const unsuccessful = await unsuccessfulController.handleClick({ preventDefault: jest.fn() });
        expect(unsuccessful.success).toBe(false);
        expect(unsuccessful.message).toBe("Choose a photo first.");
        expect(onError).toHaveBeenCalled();

        setFilesOnInput(dom.photoInput, [imageFile]);
        installSuccessfulImageMocks({ canvasResult: "data:image/jpeg;base64,UP_HANDLER_2" });
        const thrownController = attachUploadPhotoHandler({
            button: dom.uploadPhotoButton,
            fileInput: dom.photoInput,
            authService: {
                setCurrentUserPhotoURL: jest.fn().mockRejectedValue(Object.assign(new Error("Ignored"), { code: "auth/custom" }))
            },
            authUtils: {
                mapAuthErrorCode: jest.fn(() => "Mapped upload error")
            },
            photoMessageElement: dom.photoMessageElement,
            onError
        });

        const failure = await thrownController.handleClick({ preventDefault: jest.fn() });
        expect(failure.success).toBe(false);
        expect(failure.message).toBe("Mapped upload error");
    });

    test("attachRemovePhotoHandler covers null button, success render branch, and thrown error", async () => {
        const dom = createProfileDom();
        expect(
            attachRemovePhotoHandler({
                button: null,
                authService: { removeCurrentUserPhoto: jest.fn() }
            })
        ).toBeNull();

        const onSuccess = jest.fn();
        const successController = attachRemovePhotoHandler({
            button: dom.removePhotoButton,
            fileInput: dom.photoInput,
            authService: {
                removeCurrentUserPhoto: jest.fn().mockResolvedValue({
                    uid: "user-15",
                    email: "user15@example.com",
                    photoURL: "",
                    vendorStatus: "none"
                })
            },
            photoMessageElement: dom.photoMessageElement,
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
            },
            onSuccess
        });

        const success = await successController.handleClick({ preventDefault: jest.fn() });
        expect(success.success).toBe(true);
        expect(dom.photoMessageElement.textContent).toBe("Profile photo removed.");
        expect(dom.photoElement.hidden).toBe(true);
        expect(onSuccess).toHaveBeenCalled();

        const onError = jest.fn();
        const thrownController = attachRemovePhotoHandler({
            button: dom.removePhotoButton,
            fileInput: dom.photoInput,
            authService: {
                removeCurrentUserPhoto: jest.fn().mockRejectedValue(Object.assign(new Error("Ignored"), { code: "auth/custom" }))
            },
            authUtils: {
                mapAuthErrorCode: jest.fn(() => "Mapped remove error")
            },
            photoMessageElement: dom.photoMessageElement,
            onError
        });

        const failure = await thrownController.handleClick({ preventDefault: jest.fn() });
        expect(failure.success).toBe(false);
        expect(failure.message).toBe("Mapped remove error");
        expect(onError).toHaveBeenCalled();
    });

    test("attachDeleteAccountHandler covers null button, confirm fallback, success, and thrown error", async () => {
        const dom = createProfileDom();
        expect(
            attachDeleteAccountHandler({
                button: null,
                authService: { deleteCurrentUserAccount: jest.fn() }
            })
        ).toBeNull();

        const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
        const navigate = jest.fn();
        const onSuccess = jest.fn();

        const successController = attachDeleteAccountHandler({
            button: dom.deleteAccountButton,
            authService: {
                deleteCurrentUserAccount: jest.fn().mockResolvedValue(undefined)
            },
            accountMessageElement: dom.accountMessageElement,
            navigate,
            onSuccess
        });

        const success = await successController.handleClick({ preventDefault: jest.fn() });
        expect(success.success).toBe(true);
        expect(confirmSpy).toHaveBeenCalled();
        expect(dom.accountMessageElement.textContent).toBe("Your account has been deleted.");
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith("../index.html");

        const cancelController = attachDeleteAccountHandler({
            button: dom.deleteAccountButton,
            authService: {
                deleteCurrentUserAccount: jest.fn()
            },
            accountMessageElement: dom.accountMessageElement,
            confirmAction: jest.fn().mockResolvedValue(false)
        });

        const cancelled = await cancelController.handleClick({ preventDefault: jest.fn() });
        expect(cancelled).toEqual({
            success: false,
            message: "Account deletion was cancelled."
        });

        const onError = jest.fn();
        const failureController = attachDeleteAccountHandler({
            button: dom.deleteAccountButton,
            authService: {
                deleteCurrentUserAccount: jest.fn().mockRejectedValue(Object.assign(new Error("Ignored"), { code: "auth/custom" }))
            },
            authUtils: {
                mapAuthErrorCode: jest.fn(() => "Mapped delete error")
            },
            accountMessageElement: dom.accountMessageElement,
            confirmAction: jest.fn().mockResolvedValue(true),
            onError
        });

        const failure = await failureController.handleClick({ preventDefault: jest.fn() });
        expect(failure.success).toBe(false);
        expect(failure.message).toBe("Mapped delete error");
        expect(dom.accountMessageElement.textContent).toBe("Mapped delete error");
        expect(onError).toHaveBeenCalled();
    });
});

describe("profile.js page initialization", () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        delete window.authService;
        delete window.authUtils;
        createProfileDom();
        window.history.pushState({}, "", "/authentication/profile.html?backTo=vendor");
        mockReferrer("");
    });

    test("initializeProfilePage uses window services, loads profile, and resolves back route", async () => {
        const dom = createProfileDom();

        window.authUtils = {
            PORTAL_ROUTES: {
                customer: "../customer/index.html",
                vendor: "../vendor/index.html",
                admin: "../admin/index.html",
                roleChoice: "../authentication/role-choice.html",
                login: "../authentication/login.html"
            }
        };

        window.authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-16",
                email: "user16@example.com",
                displayName: "User Sixteen"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-16",
                email: "user16@example.com",
                displayName: "User Sixteen",
                vendorStatus: "approved",
                accountStatus: "active"
            }),
            signOutUser: jest.fn().mockResolvedValue(undefined),
            sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
            updateUserProfile: jest.fn().mockResolvedValue(undefined),
            removeCurrentUserPhoto: jest.fn().mockResolvedValue({
                uid: "user-16",
                email: "user16@example.com",
                photoURL: ""
            }),
            deleteCurrentUserAccount: jest.fn().mockResolvedValue(undefined),
            setCurrentUserPhotoURL: jest.fn().mockResolvedValue({
                uid: "user-16",
                email: "user16@example.com",
                photoURL: "data:image/jpeg;base64,abc"
            })
        };

        const page = initializeProfilePage();
        const profileResult = await page.profilePromise;

        expect(profileResult.success).toBe(true);
        expect(dom.nameElement.textContent).toBe("User Sixteen");
        expect(dom.statusElement.textContent).toBe("Profile loaded.");

        const navigate = jest.fn();
        const pageWithNavigate = initializeProfilePage({
            authService: window.authService,
            authUtils: window.authUtils,
            navigate,
            backRoute: "admin"
        });

        await pageWithNavigate.profilePromise;
        const backResult = await pageWithNavigate.backController.handleClick({
            preventDefault: jest.fn()
        });

        expect(backResult.success).toBe(true);
        expect(backResult.nextRoute).toBe("../admin/index.html");
        expect(navigate).toHaveBeenCalledWith("../admin/index.html");
    });

    test("initializeProfilePage returns null controllers when elements are missing", async () => {
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
            </main>
        `;

        const page = initializeProfilePage({
            authService: {
                getCurrentUser: jest.fn(() => null),
                getCurrentUserProfile: jest.fn()
            }
        });

        expect(page.signOutController).toBeNull();
        expect(page.backController).toBeNull();
        expect(page.resetPasswordController).toBeNull();
        expect(page.leaveVendorController).toBeNull();
        expect(page.photoPreviewController).toBeNull();
        expect(page.uploadPhotoController).toBeNull();
        expect(page.removePhotoController).toBeNull();
        expect(page.deleteAccountController).toBeNull();

        await expect(page.profilePromise).resolves.toEqual({
            success: false,
            message: "No user is currently signed in."
        });
    });

    test("initializeProfilePage throws when authService is missing", () => {
        createProfileDom();
        expect(() => initializeProfilePage()).toThrow("authService is required.");
    });
});