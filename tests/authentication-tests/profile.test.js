/**
 * @jest-environment jsdom
 */

const profilePage = require("../../public/authentication/profile.js");

const {
    normalizeText,
    normalizeVendorStatus,
    normalizeAdminApplicationStatus,
    normalizeAccountStatus,
    resolveAuthUtils,
    normalizeUserProfile,
    setTextContent,
    setStatusMessage,
    clearStatusMessage,
    setButtonState,
    setElementHidden,
    setImageSource,
    clearFileInput,
    hasAuthenticatedIdentity,
    getRoleLabel,
    getVendorStatusLabel,
    getAdminStatusLabel,
    getDisplayName,
    getEmail,
    getPhoneNumber,
    getPhotoURL,
    getAvailablePortals,
    capitalize,
    getPortalAccessLabel,
    getVendorStatusNote,
    getAdminStatusNote,
    canRemovePhoto,
    getProfileFormValues,
    validatePhoneNumber,
    validateProfileForm,
    setFieldError,
    clearProfileFormErrors,
    showProfileFormErrors,
    populateProfileForm,
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
    saveCurrentUserProfile,
    isImageFile,
    readFileAsDataURL,
    getSelectedPhotoFile,
    previewSelectedPhoto,
    uploadSelectedPhoto,
    removeCurrentUserPhotoAction,
    deleteCurrentUserAccountAction,
    initializeProfileView,
    attachSaveProfileHandler,
    attachSignOutHandler,
    attachBackHandler,
    attachPhotoInputPreviewHandler,
    attachUploadPhotoHandler,
    attachRemovePhotoHandler,
    attachDeleteConfirmationToggle,
    attachDeleteAccountHandler,
    initializeProfilePage
} = profilePage;

function createProfileDom() {
    document.body.innerHTML = `
        <main>
            <p id="profile-status"></p>
            <input id="profile-display-name-input" type="text" />
            <p id="profile-display-name-error"></p>
            <input id="profile-phone-input" type="tel" />
            <p id="profile-phone-error"></p>
            <p id="profile-name"></p>
            <p id="profile-email"></p>
            <p id="profile-phone"></p>
            <p id="profile-role"></p>
            <p id="profile-access"></p>
            <p id="profile-account-status"></p>
            <p id="profile-vendor-status"></p>
            <p id="profile-admin-status"></p>
            <p id="profile-vendor-note"></p>
            <p id="profile-admin-note"></p>

            <img id="profile-photo" alt="Profile picture" hidden />
            <p id="profile-photo-caption"></p>
            <input id="profile-photo-input" type="file" />
            <p id="profile-photo-message"></p>
            <p id="profile-account-message"></p>

            <input id="delete-account-confirm-checkbox" type="checkbox" />

            <button id="profile-back-button" type="button">Back</button>
            <button id="save-profile-button" type="button">Save Profile</button>
            <button id="signout-button" type="button">Sign Out</button>
            <button id="upload-photo-button" type="button">Upload Photo</button>
            <button id="remove-photo-button" type="button">Remove Photo</button>
            <button id="delete-account-button" type="button">Delete Account</button>
        </main>
    `;

    return {
        statusElement: document.querySelector("#profile-status"),
        displayNameInput: document.querySelector("#profile-display-name-input"),
        displayNameErrorElement: document.querySelector("#profile-display-name-error"),
        phoneInput: document.querySelector("#profile-phone-input"),
        phoneErrorElement: document.querySelector("#profile-phone-error"),
        nameElement: document.querySelector("#profile-name"),
        emailElement: document.querySelector("#profile-email"),
        phoneElement: document.querySelector("#profile-phone"),
        roleElement: document.querySelector("#profile-role"),
        accessElement: document.querySelector("#profile-access"),
        accountStatusElement: document.querySelector("#profile-account-status"),
        vendorStatusElement: document.querySelector("#profile-vendor-status"),
        adminStatusElement: document.querySelector("#profile-admin-status"),
        vendorNoteElement: document.querySelector("#profile-vendor-note"),
        adminNoteElement: document.querySelector("#profile-admin-note"),
        photoElement: document.querySelector("#profile-photo"),
        photoCaptionElement: document.querySelector("#profile-photo-caption"),
        photoInput: document.querySelector("#profile-photo-input"),
        photoMessageElement: document.querySelector("#profile-photo-message"),
        accountMessageElement: document.querySelector("#profile-account-message"),
        deleteCheckbox: document.querySelector("#delete-account-confirm-checkbox"),
        backButton: document.querySelector("#profile-back-button"),
        saveProfileButton: document.querySelector("#save-profile-button"),
        signOutButton: document.querySelector("#signout-button"),
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

function installSuccessfulFileReaderMock(dataUrl = "data:image/jpeg;base64,AAA") {
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

describe("profile.js helpers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        window.history.pushState({}, "", "/authentication/profile.html");
        mockReferrer("");
        delete window.authUtils;
        jest.restoreAllMocks();
    });

    test("normalization and auth utils helpers work safely", () => {
        const dom = createProfileDom();
        const explicitUtils = { value: 1 };
        window.authUtils = { value: 2 };

        expect(resolveAuthUtils(explicitUtils)).toBe(explicitUtils);
        expect(resolveAuthUtils()).toBe(window.authUtils);

        expect(normalizeText("  Hello  ")).toBe("Hello");
        expect(normalizeText(null)).toBe("");
        expect(normalizeVendorStatus("suspended")).toBe("blocked");
        expect(normalizeVendorStatus("weird")).toBe("none");
        expect(normalizeAdminApplicationStatus("suspended")).toBe("blocked");
        expect(normalizeAdminApplicationStatus("none", true)).toBe("approved");
        expect(normalizeAdminApplicationStatus("rejected")).toBe("rejected");
        expect(normalizeAccountStatus("disabled")).toBe("disabled");
        expect(normalizeAccountStatus("anything")).toBe("active");

        setTextContent(dom.nameElement, "   ", "Unknown");
        expect(dom.nameElement.textContent).toBe("Unknown");

        setStatusMessage(dom.statusElement, "Loaded", "success");
        expect(dom.statusElement.textContent).toBe("Loaded");
        expect(dom.statusElement.dataset.state).toBe("success");

        clearStatusMessage(dom.statusElement);
        expect(dom.statusElement.textContent).toBe("");
        expect(dom.statusElement.dataset.state).toBe("");
    });

    test("normalizeUserProfile supports auth utils and local fallback", () => {
        const authUtils = {
            normaliseUserData: jest.fn(() => ({ custom: true }))
        };

        expect(normalizeUserProfile({ displayName: "Name" }, authUtils)).toEqual({
            custom: true
        });

        const result = normalizeUserProfile({
            uid: " user-1 ",
            fullName: " Faranani ",
            email: " USER@EXAMPLE.COM ",
            phoneNumber: " 0712345678 ",
            photoURL: " https://example.com/photo.png ",
            isAdmin: false,
            vendorStatus: "suspended",
            rejectionReason: " Missing docs ",
            adminApplicationStatus: "rejected",
            adminApplicationReason: " Missing reason ",
            accountStatus: "disabled"
        });

        expect(result).toEqual({
            uid: "user-1",
            displayName: "Faranani",
            email: "user@example.com",
            phoneNumber: "0712345678",
            photoURL: "https://example.com/photo.png",
            isAdmin: false,
            vendorStatus: "blocked",
            vendorReason: "Missing docs",
            adminApplicationStatus: "rejected",
            adminApplicationReason: "Missing reason",
            accountStatus: "disabled"
        });

        const normalizeOnlyUtils = {
            normalizeUserData: jest.fn(() => ({ fromAltNormalizer: true }))
        };

        expect(normalizeUserProfile({ uid: "x" }, normalizeOnlyUtils)).toEqual({
            fromAltNormalizer: true
        });
    });

    test("element helpers update visibility, buttons, image, and files", () => {
        const dom = createProfileDom();

        setButtonState(dom.uploadPhotoButton, true);
        expect(dom.uploadPhotoButton.disabled).toBe(true);

        setElementHidden(dom.removePhotoButton, true);
        expect(dom.removePhotoButton.hidden).toBe(true);
        expect(dom.removePhotoButton.getAttribute("aria-hidden")).toBe("true");

        setImageSource(dom.photoElement, "https://example.com/pic.png", "My alt");
        expect(dom.photoElement.hidden).toBe(false);
        expect(dom.photoElement.getAttribute("src")).toBe("https://example.com/pic.png");

        setImageSource(dom.photoElement, "", "Other alt");
        expect(dom.photoElement.hidden).toBe(true);
        expect(dom.photoElement.alt).toBe("Other alt");

        clearFileInput(dom.photoInput);
        expect(dom.photoInput.value).toBe("");
    });

    test("identity, display, role, and status helpers match the new model", () => {
        expect(hasAuthenticatedIdentity({ uid: "user-1" })).toBe(true);
        expect(hasAuthenticatedIdentity({})).toBe(false);

        expect(getRoleLabel({ isAdmin: true, vendorStatus: "approved" })).toBe("Admin and Vendor");
        expect(getRoleLabel({ isAdmin: true })).toBe("Admin");
        expect(getRoleLabel({ vendorStatus: "approved" })).toBe("Vendor");
        expect(getRoleLabel({ vendorStatus: "pending" })).toBe("Customer");

        expect(getVendorStatusLabel({ vendorStatus: "pending" })).toBe("Pending");
        expect(getVendorStatusLabel({ vendorStatus: "none" })).toBe("Not Applied");
        expect(getAdminStatusLabel({ isAdmin: true })).toBe("Approved");
        expect(getAdminStatusLabel({ adminApplicationStatus: "rejected" })).toBe("Rejected");
        expect(getAdminStatusLabel({ adminApplicationStatus: "blocked" })).toBe("Blocked");

        expect(getDisplayName({ displayName: "Profile Name" }, { displayName: "User Name" })).toBe("Profile Name");
        expect(getEmail({ email: "" }, { email: "user@example.com" })).toBe("user@example.com");
        expect(getPhoneNumber({ phoneNumber: "" }, { phoneNumber: "0712345678" })).toBe("0712345678");
        expect(getPhotoURL({ photoURL: "" }, { photoURL: "user.png" })).toBe("user.png");
        expect(getDisplayName({}, {})).toBe("");
        expect(getEmail({}, {})).toBe("");
        expect(getPhoneNumber({}, {})).toBe("");
        expect(getPhotoURL({}, {})).toBe("");
    });

    test("portal, notes, and remove-photo helpers work", () => {
        expect(getAvailablePortals({ uid: "user-1", accountStatus: "active" })).toEqual(["customer"]);
        expect(getAvailablePortals({ uid: "user-1", vendorStatus: "approved", accountStatus: "active" })).toEqual(["customer", "vendor"]);
        expect(getAvailablePortals({ uid: "user-1", isAdmin: true, accountStatus: "active" })).toEqual(["customer", "admin"]);
        expect(getAvailablePortals({ uid: "user-1", isAdmin: true, vendorStatus: "approved", accountStatus: "active" })).toEqual(["customer", "vendor", "admin"]);
        expect(getAvailablePortals({ uid: "user-1", accountStatus: "blocked" })).toEqual([]);
        expect(getAvailablePortals({ uid: "user-1" }, {
            getAvailablePortals: jest.fn(() => ["admin"])
        })).toEqual(["admin"]);

        expect(capitalize("customer")).toBe("Customer");
        expect(capitalize("   ")).toBe("");
        expect(getPortalAccessLabel({ uid: "user-1", accountStatus: "active" })).toBe("Customer");
        expect(getPortalAccessLabel({ uid: "user-1", vendorStatus: "approved", accountStatus: "active" })).toBe("Customer and Vendor");
        expect(getPortalAccessLabel({ uid: "user-1", isAdmin: true, vendorStatus: "approved", accountStatus: "active" })).toBe("Customer, Vendor, and Admin");

        expect(getVendorStatusNote({ vendorStatus: "pending" })).toBe("Your vendor application is pending review.");
        expect(getVendorStatusNote({ vendorStatus: "rejected", vendorReason: "Missing docs" })).toBe("Vendor application rejected: Missing docs");
        expect(getVendorStatusNote({ vendorStatus: "blocked", vendorReason: "Policy issue" })).toBe("Vendor access blocked: Policy issue");
        expect(getVendorStatusNote({ vendorStatus: "none" })).toBe("You have not applied for vendor access yet.");
        expect(getAdminStatusNote({ adminApplicationStatus: "pending" })).toBe("Your admin application is pending review.");
        expect(getAdminStatusNote({ isAdmin: true })).toBe("Your admin access is active.");
        expect(getAdminStatusNote({ adminApplicationStatus: "blocked", adminApplicationReason: "Policy issue" })).toBe("Admin application blocked: Policy issue");
        expect(getAdminStatusNote({ adminApplicationStatus: "none" })).toBe("You have not applied for admin access yet.");

        expect(canRemovePhoto({ photoURL: "pic.png" }, null)).toBe(true);
        expect(canRemovePhoto({}, { photoURL: "fallback.png" })).toBe(true);
        expect(canRemovePhoto({}, {})).toBe(false);
    });

    test("profile form helpers collect, validate, populate, and show field errors", () => {
        const dom = createProfileDom();

        dom.displayNameInput.value = " Faranani ";
        dom.phoneInput.value = " 0712345678 ";

        expect(getProfileFormValues(dom)).toEqual({
            displayName: "Faranani",
            phoneNumber: "0712345678"
        });

        expect(validatePhoneNumber("", null)).toBe("");
        expect(validatePhoneNumber("123", null)).toBe("Please enter a valid phone number.");
        expect(validatePhoneNumber("0712345678", null)).toBe("");

        expect(validateProfileForm({
            displayName: "",
            phoneNumber: "123"
        }, null)).toEqual({
            isValid: false,
            errors: {
                displayName: "Please enter your name.",
                phoneNumber: "Please enter a valid phone number."
            }
        });

        setFieldError(dom.displayNameInput, dom.displayNameErrorElement, "Name error");
        expect(dom.displayNameInput.getAttribute("aria-invalid")).toBe("true");
        expect(dom.displayNameErrorElement.textContent).toBe("Name error");

        clearProfileFormErrors(dom);
        expect(dom.displayNameErrorElement.textContent).toBe("");
        expect(dom.phoneErrorElement.textContent).toBe("");

        showProfileFormErrors(dom, {
            displayName: "Name error",
            phoneNumber: "Phone error"
        });
        expect(dom.displayNameErrorElement.textContent).toBe("Name error");
        expect(dom.phoneErrorElement.textContent).toBe("Phone error");

        populateProfileForm(dom, {
            displayName: "Updated Name",
            phoneNumber: "0723456789"
        });
        expect(dom.displayNameInput.value).toBe("Updated Name");
        expect(dom.phoneInput.value).toBe("0723456789");
    });

    test("renderProfile fills the new profile view", () => {
        const dom = createProfileDom();

        renderProfile(
            {
                nameElement: dom.nameElement,
                emailElement: dom.emailElement,
                phoneElement: dom.phoneElement,
                roleElement: dom.roleElement,
                accessElement: dom.accessElement,
                accountStatusElement: dom.accountStatusElement,
                vendorStatusElement: dom.vendorStatusElement,
                adminStatusElement: dom.adminStatusElement,
                vendorNoteElement: dom.vendorNoteElement,
                adminNoteElement: dom.adminNoteElement,
                photoElement: dom.photoElement,
                photoCaptionElement: dom.photoCaptionElement,
                removePhotoButton: dom.removePhotoButton
            },
            {
                displayName: "Faranani Maduwa",
                email: "faranani@example.com",
                phoneNumber: "0712345678",
                vendorStatus: "approved",
                adminApplicationStatus: "pending",
                accountStatus: "active",
                photoURL: "https://example.com/photo.png",
                uid: "user-1"
            },
            null
        );

        expect(dom.nameElement.textContent).toBe("Faranani Maduwa");
        expect(dom.emailElement.textContent).toBe("faranani@example.com");
        expect(dom.phoneElement.textContent).toBe("0712345678");
        expect(dom.roleElement.textContent).toBe("Vendor");
        expect(dom.accessElement.textContent).toBe("Customer and Vendor");
        expect(dom.accountStatusElement.textContent).toBe("Active");
        expect(dom.vendorStatusElement.textContent).toBe("Approved");
        expect(dom.adminStatusElement.textContent).toBe("Pending");
        expect(dom.photoElement.hidden).toBe(false);
        expect(dom.removePhotoButton.hidden).toBe(false);
    });

    test("route and friendly error helpers cover query, referrer, defaults, and messages", () => {
        const customRoutes = {
            customer: "/c",
            vendor: "/v",
            admin: "/a",
            roleChoice: "/roles",
            login: "/login"
        };

        expect(getFallbackRoutes({ PORTAL_ROUTES: customRoutes })).toEqual(customRoutes);
        expect(mapBackTargetToRoute("customer")).toBe("../customer/index.html");
        expect(mapBackTargetToRoute("rolechoice")).toBe("../authentication/role-choice.html");
        expect(mapBackTargetToRoute("login")).toBe("../authentication/login.html");

        window.history.pushState({}, "", "/authentication/profile.html?from=vendor");
        expect(getBackRouteFromQuery()).toBe("../vendor/index.html");

        mockReferrer("http://localhost/admin/index.html");
        expect(getBackRouteFromReferrer()).toBe("../admin/index.html");

        mockReferrer("http://localhost/customer/index.html");
        expect(getBackRouteFromReferrer()).toBe("../customer/index.html");

        mockReferrer("http://localhost/vendor/index.html");
        expect(getBackRouteFromReferrer()).toBe("../vendor/index.html");

        mockReferrer("http://localhost/authentication/role-choice.html");
        expect(getBackRouteFromReferrer()).toBe("../authentication/role-choice.html");

        mockReferrer("http://localhost/authentication/login.html");
        expect(getBackRouteFromReferrer()).toBe("../authentication/login.html");

        mockReferrer("https://othersite.com/vendor/index.html");
        expect(getBackRouteFromReferrer()).toBe("");

        expect(getDefaultBackRoute({ uid: "user-1", vendorStatus: "approved", accountStatus: "active" })).toBe("../authentication/role-choice.html");
        expect(getDefaultBackRoute({ uid: "user-1", accountStatus: "active" })).toBe("../customer/index.html");
        expect(getDefaultBackRoute({ accountStatus: "blocked" })).toBe("../authentication/login.html");

        window.history.pushState({}, "", "/authentication/profile.html?back=admin");
        expect(getBackRoute({ uid: "user-1", accountStatus: "active" })).toBe("../admin/index.html");
        expect(getBackRoute({ uid: "user-1", accountStatus: "active" }, null, "vendor")).toBe("../vendor/index.html");

        expect(getFriendlyErrorMessage(null, null, "Fallback")).toBe("Fallback");
        expect(getFriendlyErrorMessage({ code: "auth/requires-recent-login" })).toBe(
            "Please sign in again before performing this sensitive action."
        );
        expect(getFriendlyErrorMessage({ code: "auth/custom" }, {
            mapAuthErrorCode: jest.fn(() => "Mapped error")
        })).toBe("Mapped error");
        expect(getFriendlyErrorMessage(new Error("Plain message"))).toBe("Plain message");
    });
});

describe("profile.js service and action helpers", () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        delete window.authUtils;
        createProfileDom();
        window.history.pushState({}, "", "/authentication/profile.html");
        mockReferrer("");
    });

    test("waitForAuthenticatedUser, loadCurrentUserProfile, and signOutCurrentUser work", async () => {
        const observedUser = { uid: "user-1" };
        const authService = {
            getCurrentUser: jest.fn(() => null),
            observeAuthState: jest.fn((callback) => {
                callback(observedUser);
                return jest.fn();
            }),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-1",
                email: "user@example.com",
                vendorStatus: "none",
                adminApplicationStatus: "none",
                accountStatus: "active"
            }),
            signOutUser: jest.fn().mockResolvedValue(undefined)
        };

        await expect(waitForAuthenticatedUser(authService)).resolves.toEqual(observedUser);

        const loaded = await loadCurrentUserProfile({ authService });
        expect(loaded.success).toBe(true);
        expect(loaded.profile.email).toBe("user@example.com");

        await expect(signOutCurrentUser({ authService })).resolves.toEqual({
            success: true,
            message: "You have been signed out."
        });

        await expect(waitForAuthenticatedUser({
            getCurrentUser: jest.fn(() => ({ uid: "direct-user" }))
        })).resolves.toEqual({ uid: "direct-user" });
    });

    test("saveCurrentUserProfile validates and updates details through supported methods", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({ uid: "user-20" })),
            updateCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-20",
                displayName: "Updated Name",
                phoneNumber: "0712345678"
            })
        };

        const success = await saveCurrentUserProfile({
            authService,
            profileUpdates: {
                displayName: "Updated Name",
                phoneNumber: "0712345678"
            }
        });
        expect(success.success).toBe(true);
        expect(authService.updateCurrentUserProfile).toHaveBeenCalledWith({
            displayName: "Updated Name",
            phoneNumber: "0712345678"
        });

        const fallback = await saveCurrentUserProfile({
            authService: {
                getCurrentUser: jest.fn(() => ({ uid: "user-21" })),
                updateUserProfile: jest.fn().mockResolvedValue(undefined)
            },
            profileUpdates: {
                displayName: "Fallback Name",
                phoneNumber: ""
            }
        });
        expect(fallback.success).toBe(true);

        const invalid = await saveCurrentUserProfile({
            authService,
            profileUpdates: {
                displayName: "",
                phoneNumber: "123"
            }
        });
        expect(invalid.success).toBe(false);
        expect(invalid.errors.displayName).toBe("Please enter your name.");

        await expect(saveCurrentUserProfile({
            authService: {
                getCurrentUser: jest.fn(() => ({ uid: "user-22" }))
            },
            profileUpdates: {
                displayName: "No Method",
                phoneNumber: ""
            }
        })).rejects.toThrow("A supported profile update method is required.");
    });

    test("file helpers support image validation, reading, preview, upload, remove, and delete", async () => {
        const dom = createProfileDom();
        const imageFile = new File(["abc"], "photo.jpg", { type: "image/jpeg" });
        const textFile = new File(["abc"], "notes.txt", { type: "text/plain" });

        expect(isImageFile(imageFile)).toBe(true);
        expect(isImageFile(textFile)).toBe(false);
        expect(getSelectedPhotoFile(dom.photoInput)).toBeNull();

        installSuccessfulFileReaderMock("data:image/jpeg;base64,PREVIEW");
        await expect(readFileAsDataURL(imageFile)).resolves.toBe("data:image/jpeg;base64,PREVIEW");

        installFileReaderErrorMock();
        await expect(readFileAsDataURL(imageFile)).rejects.toThrow("Unable to read the selected file.");

        setFilesOnInput(dom.photoInput, []);
        await expect(previewSelectedPhoto({
            fileInput: dom.photoInput,
            profileElements: { photoElement: dom.photoElement },
            photoMessageElement: dom.photoMessageElement
        })).resolves.toEqual({
            success: false,
            message: "Choose a photo first."
        });

        setFilesOnInput(dom.photoInput, [imageFile]);
        installSuccessfulFileReaderMock("data:image/jpeg;base64,PREVIEW_OK");
        const previewResult = await previewSelectedPhoto({
            fileInput: dom.photoInput,
            profileElements: {
                photoElement: dom.photoElement,
                photoCaptionElement: dom.photoCaptionElement
            },
            photoMessageElement: dom.photoMessageElement
        });
        expect(previewResult.success).toBe(true);
        expect(dom.photoElement.hidden).toBe(false);

        setFilesOnInput(dom.photoInput, [textFile]);
        await expect(previewSelectedPhoto({
            fileInput: dom.photoInput,
            profileElements: { photoElement: dom.photoElement },
            photoMessageElement: dom.photoMessageElement
        })).resolves.toEqual({
            success: false,
            message: "Please choose a valid image file."
        });

        const uploadService = {
            uploadCurrentUserPhoto: jest.fn().mockResolvedValue({
                uid: "user-2",
                photoURL: "https://example.com/photo.jpg"
            })
        };
        setFilesOnInput(dom.photoInput, [imageFile]);
        await expect(uploadSelectedPhoto({
            authService: uploadService,
            fileInput: dom.photoInput
        })).resolves.toEqual({
            success: true,
            message: "Profile photo updated.",
            profile: {
                uid: "user-2",
                photoURL: "https://example.com/photo.jpg"
            }
        });

        const fallbackService = {
            setCurrentUserPhotoURL: jest.fn().mockResolvedValue({
                uid: "user-3",
                photoURL: "data:image/jpeg;base64,FALLBACK"
            })
        };
        setFilesOnInput(dom.photoInput, [imageFile]);
        installSuccessfulFileReaderMock("data:image/jpeg;base64,FALLBACK");
        const fallbackUpload = await uploadSelectedPhoto({
            authService: fallbackService,
            fileInput: dom.photoInput
        });
        expect(fallbackUpload.success).toBe(true);

        setFilesOnInput(dom.photoInput, []);
        await expect(uploadSelectedPhoto({
            authService: uploadService,
            fileInput: dom.photoInput
        })).resolves.toEqual({
            success: false,
            message: "Choose a photo first."
        });

        setFilesOnInput(dom.photoInput, [textFile]);
        await expect(uploadSelectedPhoto({
            authService: uploadService,
            fileInput: dom.photoInput
        })).resolves.toEqual({
            success: false,
            message: "Please choose a valid image file."
        });

        setFilesOnInput(dom.photoInput, [imageFile]);
        await expect(uploadSelectedPhoto({
            authService: {},
            fileInput: dom.photoInput
        })).rejects.toThrow("A supported photo upload method is required.");

        await expect(removeCurrentUserPhotoAction({
            authService: {
                removeCurrentUserPhoto: jest.fn().mockResolvedValue({ uid: "user-4", photoURL: "" })
            }
        })).resolves.toEqual({
            success: true,
            message: "Profile photo removed.",
            profile: { uid: "user-4", photoURL: "" }
        });

        await expect(deleteCurrentUserAccountAction({
            authService: {
                deleteCurrentUserAccount: jest.fn().mockResolvedValue(undefined)
            }
        })).resolves.toEqual({
            success: true,
            message: "Your account has been deleted."
        });
    });

    test("initializeProfileView renders loaded profiles and handles load failure", async () => {
        const dom = createProfileDom();

        const success = await initializeProfileView({
            authService: {
                getCurrentUser: jest.fn(() => ({
                    uid: "user-5",
                    email: "user5@example.com"
                })),
                getCurrentUserProfile: jest.fn().mockResolvedValue({
                    uid: "user-5",
                    displayName: "User Five",
                    email: "user5@example.com",
                    phoneNumber: "0712345678",
                    vendorStatus: "pending",
                    adminApplicationStatus: "none",
                    accountStatus: "active"
                })
            },
            statusElement: dom.statusElement,
            profileElements: dom
        });

        expect(success.success).toBe(true);
        expect(dom.nameElement.textContent).toBe("User Five");
        expect(dom.statusElement.textContent).toBe("Profile loaded.");

        const failure = await initializeProfileView({
            authService: {
                getCurrentUser: jest.fn(() => {
                    throw new Error("Load failed");
                }),
                getCurrentUserProfile: jest.fn()
            },
            statusElement: dom.statusElement,
            profileElements: dom
        });

        expect(failure.success).toBe(false);
        expect(failure.message).toBe("Load failed");
    });
});

describe("profile.js event handlers and page initialization", () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        delete window.authService;
        delete window.authUtils;
        createProfileDom();
        window.history.pushState({}, "", "/authentication/profile.html?backTo=vendor");
        mockReferrer("");
    });

    test("sign out, back, preview, upload, remove, confirmation toggle, and delete handlers work", async () => {
        const dom = createProfileDom();
        const imageFile = new File(["abc"], "photo.jpg", { type: "image/jpeg" });
        setFilesOnInput(dom.photoInput, [imageFile]);
        installSuccessfulFileReaderMock("data:image/jpeg;base64,OK");

        const navigate = jest.fn();
        const onSuccess = jest.fn();
        const onError = jest.fn();

        const signOutController = attachSignOutHandler({
            button: dom.signOutButton,
            authService: {
                signOutUser: jest.fn().mockResolvedValue(undefined)
            },
            statusElement: dom.statusElement,
            navigate,
            onSuccess
        });

        const signOut = await signOutController.handleClick({ preventDefault: jest.fn() });
        expect(signOut.success).toBe(true);
        expect(navigate).toHaveBeenCalledWith("../authentication/login.html");

        const backController = attachBackHandler({
            button: dom.backButton,
            statusElement: dom.statusElement,
            navigate,
            resolveBackRoute: jest.fn().mockResolvedValue("../vendor/index.html")
        });

        const back = await backController.handleClick({ preventDefault: jest.fn() });
        expect(back.nextRoute).toBe("../vendor/index.html");

        const previewController = attachPhotoInputPreviewHandler({
            fileInput: dom.photoInput,
            profileElements: {
                photoElement: dom.photoElement,
                photoCaptionElement: dom.photoCaptionElement
            },
            photoMessageElement: dom.photoMessageElement,
            onSuccess
        });

        const preview = await previewController.handleChange();
        expect(preview.success).toBe(true);

        const uploadController = attachUploadPhotoHandler({
            button: dom.uploadPhotoButton,
            fileInput: dom.photoInput,
            authService: {
                uploadCurrentUserPhoto: jest.fn().mockResolvedValue({
                    uid: "user-6",
                    photoURL: "https://example.com/photo.jpg"
                })
            },
            photoMessageElement: dom.photoMessageElement,
            profileElements: dom,
            refreshProfile: jest.fn().mockResolvedValue(undefined),
            onSuccess
        });

        const upload = await uploadController.handleClick({ preventDefault: jest.fn() });
        expect(upload.success).toBe(true);

        const removeController = attachRemovePhotoHandler({
            button: dom.removePhotoButton,
            authService: {
                removeCurrentUserPhoto: jest.fn().mockResolvedValue({
                    uid: "user-7",
                    photoURL: ""
                })
            },
            photoMessageElement: dom.photoMessageElement,
            profileElements: dom,
            fileInput: dom.photoInput,
            refreshProfile: jest.fn().mockResolvedValue(undefined),
            onSuccess
        });

        const remove = await removeController.handleClick({ preventDefault: jest.fn() });
        expect(remove.success).toBe(true);

        const toggleController = attachDeleteConfirmationToggle({
            checkbox: dom.deleteCheckbox,
            button: dom.deleteAccountButton
        });
        expect(toggleController).toBeTruthy();
        expect(dom.deleteAccountButton.disabled).toBe(true);
        dom.deleteCheckbox.checked = true;
        toggleController.syncButtonState();
        expect(dom.deleteAccountButton.disabled).toBe(false);

        const deleteController = attachDeleteAccountHandler({
            button: dom.deleteAccountButton,
            authService: {
                deleteCurrentUserAccount: jest.fn().mockResolvedValue(undefined)
            },
            accountMessageElement: dom.accountMessageElement,
            confirmationCheckbox: dom.deleteCheckbox,
            navigate,
            confirmAction: jest.fn().mockResolvedValue(true),
            onSuccess
        });

        const deletion = await deleteController.handleClick({ preventDefault: jest.fn() });
        expect(deletion.success).toBe(true);
        expect(navigate).toHaveBeenCalledWith("../index.html");

        const blockedDelete = attachDeleteAccountHandler({
            button: dom.deleteAccountButton,
            authService: {
                deleteCurrentUserAccount: jest.fn()
            },
            accountMessageElement: dom.accountMessageElement,
            confirmationCheckbox: Object.assign(document.createElement("input"), { checked: false }),
            confirmAction: jest.fn().mockResolvedValue(true),
            onError
        });

        const blocked = await blockedDelete.handleClick({ preventDefault: jest.fn() });
        expect(blocked.success).toBe(false);
        expect(blocked.message).toBe("Please confirm that you understand account deletion is permanent.");

        expect(onSuccess).toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
    });

    test("save profile handler validates fields and saves details", async () => {
        const dom = createProfileDom();
        const refreshProfile = jest.fn().mockResolvedValue(undefined);
        const onSuccess = jest.fn();
        const onError = jest.fn();

        const handler = attachSaveProfileHandler({
            button: dom.saveProfileButton,
            authService: {
                getCurrentUser: jest.fn(() => ({ uid: "user-30" })),
                updateCurrentUserProfile: jest.fn().mockResolvedValue({
                    uid: "user-30",
                    displayName: "Faranani Maduwa",
                    phoneNumber: "0712345678"
                })
            },
            statusElement: dom.statusElement,
            formElements: dom,
            refreshProfile,
            onSuccess
        });

        dom.displayNameInput.value = "";
        dom.phoneInput.value = "123";
        const invalid = await handler.handleClick({ preventDefault: jest.fn() });
        expect(invalid.success).toBe(false);
        expect(dom.displayNameErrorElement.textContent).toBe("Please enter your name.");

        dom.displayNameInput.value = "Faranani Maduwa";
        dom.phoneInput.value = "0712345678";
        const success = await handler.handleClick({ preventDefault: jest.fn() });
        expect(success.success).toBe(true);
        expect(refreshProfile).toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalled();

        const failingHandler = attachSaveProfileHandler({
            button: dom.saveProfileButton,
            authService: {
                getCurrentUser: jest.fn(() => ({ uid: "user-31" })),
                updateCurrentUserProfile: jest.fn().mockRejectedValue(Object.assign(new Error("Ignored"), { code: "auth/custom" }))
            },
            authUtils: {
                mapAuthErrorCode: jest.fn(() => "Mapped save error")
            },
            statusElement: dom.statusElement,
            formElements: dom,
            onError
        });

        dom.displayNameInput.value = "Another Name";
        dom.phoneInput.value = "0712345678";
        const failure = await failingHandler.handleClick({ preventDefault: jest.fn() });
        expect(failure.success).toBe(false);
        expect(failure.message).toBe("Mapped save error");
    });

    test("handlers cover null returns, thrown errors, and initialization wires the page", async () => {
        const dom = createProfileDom();
        delete window.authService;

        expect(attachPhotoInputPreviewHandler({ fileInput: null })).toBeNull();
        expect(attachUploadPhotoHandler({ button: null, authService: {} })).toBeNull();
        expect(attachRemovePhotoHandler({ button: null, authService: {} })).toBeNull();
        expect(attachDeleteAccountHandler({ button: null, authService: {} })).toBeNull();
        expect(attachDeleteConfirmationToggle({ checkbox: null, button: dom.deleteAccountButton })).toBeNull();

        const failingUpload = attachUploadPhotoHandler({
            button: dom.uploadPhotoButton,
            fileInput: dom.photoInput,
            authService: {
                uploadCurrentUserPhoto: jest.fn().mockRejectedValue(Object.assign(new Error("Ignored"), { code: "auth/custom" }))
            },
            authUtils: {
                mapAuthErrorCode: jest.fn(() => "Mapped upload error")
            },
            photoMessageElement: dom.photoMessageElement
        });

        setFilesOnInput(dom.photoInput, [new File(["abc"], "photo.jpg", { type: "image/jpeg" })]);
        const uploadFailure = await failingUpload.handleClick({ preventDefault: jest.fn() });
        expect(uploadFailure.success).toBe(false);
        expect(uploadFailure.message).toBe("Mapped upload error");

        const failingRemove = attachRemovePhotoHandler({
            button: dom.removePhotoButton,
            authService: {
                removeCurrentUserPhoto: jest.fn().mockRejectedValue(Object.assign(new Error("Ignored"), { code: "auth/custom" }))
            },
            authUtils: {
                mapAuthErrorCode: jest.fn(() => "Mapped remove error")
            },
            photoMessageElement: dom.photoMessageElement
        });

        const removeFailure = await failingRemove.handleClick({ preventDefault: jest.fn() });
        expect(removeFailure.message).toBe("Mapped remove error");

        const removeWithoutRefresh = attachRemovePhotoHandler({
            button: dom.removePhotoButton,
            authService: {
                removeCurrentUserPhoto: jest.fn().mockResolvedValue({
                    uid: "user-7",
                    photoURL: ""
                })
            },
            photoMessageElement: dom.photoMessageElement,
            profileElements: dom
        });
        const removeNoRefreshResult = await removeWithoutRefresh.handleClick({ preventDefault: jest.fn() });
        expect(removeNoRefreshResult.success).toBe(true);

        const failingDelete = attachDeleteAccountHandler({
            button: dom.deleteAccountButton,
            authService: {
                deleteCurrentUserAccount: jest.fn().mockRejectedValue(Object.assign(new Error("Ignored"), { code: "auth/custom" }))
            },
            authUtils: {
                mapAuthErrorCode: jest.fn(() => "Mapped delete error")
            },
            accountMessageElement: dom.accountMessageElement,
            confirmationCheckbox: Object.assign(document.createElement("input"), { checked: true }),
            confirmAction: jest.fn().mockResolvedValue(true)
        });

        const deleteFailure = await failingDelete.handleClick({ preventDefault: jest.fn() });
        expect(deleteFailure.message).toBe("Mapped delete error");

        const cancelledDelete = attachDeleteAccountHandler({
            button: dom.deleteAccountButton,
            authService: {
                deleteCurrentUserAccount: jest.fn()
            },
            accountMessageElement: dom.accountMessageElement,
            confirmationCheckbox: Object.assign(document.createElement("input"), { checked: true }),
            confirmAction: jest.fn().mockResolvedValue(false)
        });
        const cancelled = await cancelledDelete.handleClick({ preventDefault: jest.fn() });
        expect(cancelled).toEqual({
            success: false,
            message: "Account deletion was cancelled."
        });

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
                phoneNumber: "0712345678",
                vendorStatus: "approved",
                adminApplicationStatus: "pending",
                accountStatus: "active"
            }),
            signOutUser: jest.fn().mockResolvedValue(undefined),
            removeCurrentUserPhoto: jest.fn().mockResolvedValue({
                uid: "user-16",
                photoURL: ""
            }),
            uploadCurrentUserPhoto: jest.fn().mockResolvedValue({
                uid: "user-16",
                photoURL: "https://example.com/p.jpg"
            }),
            deleteCurrentUserAccount: jest.fn().mockResolvedValue(undefined)
        };

        const page = initializeProfilePage();
        const profileResult = await page.profilePromise;

        expect(profileResult.success).toBe(true);
        expect(dom.nameElement.textContent).toBe("User Sixteen");
        expect(dom.displayNameInput.value).toBe("User Sixteen");
        expect(dom.phoneInput.value).toBe("0712345678");
        expect(page.saveProfileController).toBeTruthy();
        expect(page.signOutController).toBeTruthy();
        expect(page.backController).toBeTruthy();
        expect(page.photoPreviewController).toBeTruthy();
        expect(page.uploadPhotoController).toBeTruthy();
        expect(page.removePhotoController).toBeTruthy();
        expect(page.deleteConfirmationController).toBeTruthy();
        expect(page.deleteAccountController).toBeTruthy();

        document.body.innerHTML = `<main><p id="profile-status"></p></main>`;
        const minimalPage = initializeProfilePage({
            authService: {
                getCurrentUser: jest.fn(() => null),
                getCurrentUserProfile: jest.fn()
            }
        });

        expect(minimalPage.signOutController).toBeNull();
        expect(minimalPage.backController).toBeNull();
        expect(minimalPage.saveProfileController).toBeNull();
        expect(minimalPage.photoPreviewController).toBeNull();
        expect(minimalPage.uploadPhotoController).toBeNull();
        expect(minimalPage.removePhotoController).toBeNull();
        expect(minimalPage.deleteConfirmationController).toBeNull();
        expect(minimalPage.deleteAccountController).toBeNull();

        await expect(minimalPage.profilePromise).resolves.toEqual({
            success: false,
            message: "No user is currently signed in."
        });

        delete window.authService;
        expect(() => initializeProfilePage()).toThrow("authService is required.");
    });
});
