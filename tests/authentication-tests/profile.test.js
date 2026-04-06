const {
    normalizeText,
    setTextContent,
    setStatusMessage,
    getRoleLabel,
    getVendorStatusLabel,
    getDisplayName,
    getEmail,
    renderProfile,
    loadCurrentUserProfile,
    signOutCurrentUser,
    initializeProfileView,
    attachSignOutHandler
} = require("../../public/authentication/profile.js");

function createProfileDom() {
    document.body.innerHTML = `
    <section>
      <p id="profile-name"></p>
      <p id="profile-email"></p>
      <p id="profile-role"></p>
      <p id="profile-vendor-status"></p>
      <p id="profile-status"></p>
      <button id="signout-button" type="button">Sign Out</button>
    </section>
  `;

    return {
        nameElement: document.querySelector("#profile-name"),
        emailElement: document.querySelector("#profile-email"),
        roleElement: document.querySelector("#profile-role"),
        vendorStatusElement: document.querySelector("#profile-vendor-status"),
        statusElement: document.querySelector("#profile-status"),
        signOutButton: document.querySelector("#signout-button")
    };
}

describe("profile.js helpers", () => {
    test("normalizeText trims whitespace", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
    });

    test("setTextContent updates element text", () => {
        const { nameElement } = createProfileDom();

        setTextContent(nameElement, "  Faranani Maduwa  ");

        expect(nameElement.textContent).toBe("Faranani Maduwa");
    });

    test("setStatusMessage updates text and state", () => {
        const { statusElement } = createProfileDom();

        setStatusMessage(statusElement, "Profile loaded.", "success");

        expect(statusElement.textContent).toBe("Profile loaded.");
        expect(statusElement.dataset.state).toBe("success");
    });

    test("getRoleLabel returns Admin when admin role exists", () => {
        expect(
            getRoleLabel({
                roles: { admin: true, vendor: false, customer: true }
            })
        ).toBe("Admin");
    });

    test("getRoleLabel returns Vendor when vendor role exists", () => {
        expect(
            getRoleLabel({
                roles: { admin: false, vendor: true, customer: true }
            })
        ).toBe("Vendor");
    });

    test("getRoleLabel returns Customer by default", () => {
        expect(
            getRoleLabel({
                roles: { admin: false, vendor: false, customer: true }
            })
        ).toBe("Customer");
    });

    test("getVendorStatusLabel returns Pending", () => {
        expect(getVendorStatusLabel({ vendorStatus: "pending" })).toBe("Pending");
    });

    test("getVendorStatusLabel returns Approved", () => {
        expect(getVendorStatusLabel({ vendorStatus: "approved" })).toBe("Approved");
    });

    test("getVendorStatusLabel returns Rejected", () => {
        expect(getVendorStatusLabel({ vendorStatus: "rejected" })).toBe("Rejected");
    });

    test("getVendorStatusLabel returns None by default", () => {
        expect(getVendorStatusLabel({ vendorStatus: "none" })).toBe("None");
    });

    test("getDisplayName prefers profile displayName", () => {
        expect(
            getDisplayName(
                { displayName: "Profile Name" },
                { displayName: "User Name" }
            )
        ).toBe("Profile Name");
    });

    test("getDisplayName falls back to user displayName", () => {
        expect(
            getDisplayName(
                { displayName: "" },
                { displayName: "User Name" }
            )
        ).toBe("User Name");
    });

    test("getEmail prefers profile email", () => {
        expect(
            getEmail(
                { email: "profile@example.com" },
                { email: "user@example.com" }
            )
        ).toBe("profile@example.com");
    });

    test("getEmail falls back to user email", () => {
        expect(
            getEmail(
                { email: "" },
                { email: "user@example.com" }
            )
        ).toBe("user@example.com");
    });

    test("renderProfile writes values into the page", () => {
        const dom = createProfileDom();

        renderProfile(
            {
                nameElement: dom.nameElement,
                emailElement: dom.emailElement,
                roleElement: dom.roleElement,
                vendorStatusElement: dom.vendorStatusElement
            },
            {
                displayName: "Faranani Maduwa",
                email: "faranani@example.com",
                roles: { admin: false, vendor: true, customer: true },
                vendorStatus: "pending"
            },
            {
                displayName: "Ignored User",
                email: "ignored@example.com"
            }
        );

        expect(dom.nameElement.textContent).toBe("Faranani Maduwa");
        expect(dom.emailElement.textContent).toBe("faranani@example.com");
        expect(dom.roleElement.textContent).toBe("Vendor");
        expect(dom.vendorStatusElement.textContent).toBe("Pending");
    });
});

describe("profile.js service functions", () => {
    test("loadCurrentUserProfile returns signed-in user and profile", async () => {
        const authService = {
            getCurrentUser: jest.fn().mockResolvedValue({
                uid: "user-1",
                email: "user@example.com",
                displayName: "User One"
            }),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-1",
                email: "user@example.com",
                displayName: "User One",
                roles: { customer: true, vendor: false, admin: false },
                vendorStatus: "none"
            })
        };

        const result = await loadCurrentUserProfile({ authService });

        expect(authService.getCurrentUser).toHaveBeenCalledTimes(1);
        expect(authService.getCurrentUserProfile).toHaveBeenCalledWith("user-1");
        expect(result.success).toBe(true);
        expect(result.user.uid).toBe("user-1");
        expect(result.profile.uid).toBe("user-1");
    });

    test("loadCurrentUserProfile returns error when no user is signed in", async () => {
        const authService = {
            getCurrentUser: jest.fn().mockResolvedValue(null),
            getCurrentUserProfile: jest.fn()
        };

        const result = await loadCurrentUserProfile({ authService });

        expect(result.success).toBe(false);
        expect(result.message).toBe("No user is currently signed in.");
        expect(authService.getCurrentUserProfile).not.toHaveBeenCalled();
    });

    test("loadCurrentUserProfile throws when getCurrentUser is missing", async () => {
        await expect(
            loadCurrentUserProfile({
                authService: {
                    getCurrentUserProfile: jest.fn()
                }
            })
        ).rejects.toThrow("authService.getCurrentUser is required.");
    });

    test("loadCurrentUserProfile throws when getCurrentUserProfile is missing", async () => {
        await expect(
            loadCurrentUserProfile({
                authService: {
                    getCurrentUser: jest.fn()
                }
            })
        ).rejects.toThrow("authService.getCurrentUserProfile is required.");
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

    test("signOutCurrentUser throws when signOutUser is missing", async () => {
        await expect(
            signOutCurrentUser({
                authService: {}
            })
        ).rejects.toThrow("authService.signOutUser is required.");
    });
});

describe("profile.js page flow", () => {
    test("initializeProfileView renders profile successfully", async () => {
        const dom = createProfileDom();

        const authService = {
            getCurrentUser: jest.fn().mockResolvedValue({
                uid: "user-2",
                email: "user2@example.com",
                displayName: "User Two"
            }),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-2",
                email: "user2@example.com",
                displayName: "User Two",
                roles: { customer: true, vendor: false, admin: false },
                vendorStatus: "none"
            })
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

        expect(result.success).toBe(true);
        expect(dom.nameElement.textContent).toBe("User Two");
        expect(dom.emailElement.textContent).toBe("user2@example.com");
        expect(dom.roleElement.textContent).toBe("Customer");
        expect(dom.vendorStatusElement.textContent).toBe("None");
        expect(dom.statusElement.textContent).toBe("Profile loaded.");
        expect(dom.statusElement.dataset.state).toBe("success");
    });

    test("initializeProfileView shows message when no user is signed in", async () => {
        const dom = createProfileDom();

        const authService = {
            getCurrentUser: jest.fn().mockResolvedValue(null),
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
        expect(dom.statusElement.textContent).toBe("No user is currently signed in.");
        expect(dom.statusElement.dataset.state).toBe("error");
    });

    test("initializeProfileView handles thrown errors", async () => {
        const dom = createProfileDom();

        const authService = {
            getCurrentUser: jest.fn().mockRejectedValue(new Error("Unexpected failure")),
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
        expect(result.message).toBe("Unexpected failure");
        expect(dom.statusElement.textContent).toBe("Unexpected failure");
        expect(dom.statusElement.dataset.state).toBe("error");
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

    test("attachSignOutHandler handles thrown sign out errors", async () => {
        const dom = createProfileDom();

        const authService = {
            signOutUser: jest.fn().mockRejectedValue(new Error("Unable to sign out"))
        };

        const onError = jest.fn();

        const { handleClick } = attachSignOutHandler({
            button: dom.signOutButton,
            authService,
            statusElement: dom.statusElement,
            onError
        });

        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Unable to sign out");
        expect(dom.statusElement.textContent).toBe("Unable to sign out");
        expect(dom.statusElement.dataset.state).toBe("error");
        expect(onError).toHaveBeenCalledTimes(1);
        expect(dom.signOutButton.disabled).toBe(false);
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
});