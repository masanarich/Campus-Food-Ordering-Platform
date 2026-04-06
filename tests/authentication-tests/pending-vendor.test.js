const {
    normalizeText,
    setTextContent,
    setStatusMessage,
    getVendorStatusLabel,
    getVendorStatusMessage,
    getDisplayName,
    getBusinessName,
    renderPendingVendorInfo,
    loadPendingVendorProfile,
    signOutCurrentUser,
    initializePendingVendorView,
    attachPendingVendorSignOutHandler
} = require("../../public/authentication/pending-vendor.js");

function createPendingVendorDom() {
    document.body.innerHTML = `
    <section>
      <p id="pending-vendor-name"></p>
      <p id="pending-vendor-business-name"></p>
      <p id="pending-vendor-role-status"></p>
      <p id="pending-vendor-message"></p>
      <p id="pending-vendor-status"></p>
      <button id="pending-vendor-signout-button" type="button">Sign Out</button>
    </section>
  `;

    return {
        nameElement: document.querySelector("#pending-vendor-name"),
        businessNameElement: document.querySelector("#pending-vendor-business-name"),
        vendorStatusElement: document.querySelector("#pending-vendor-role-status"),
        vendorMessageElement: document.querySelector("#pending-vendor-message"),
        statusElement: document.querySelector("#pending-vendor-status"),
        signOutButton: document.querySelector("#pending-vendor-signout-button")
    };
}

describe("pending-vendor.js helpers", () => {
    test("normalizeText trims whitespace", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
    });

    test("setTextContent updates element text", () => {
        const { nameElement } = createPendingVendorDom();

        setTextContent(nameElement, "  Faranani Maduwa  ");

        expect(nameElement.textContent).toBe("Faranani Maduwa");
    });

    test("setStatusMessage updates text and state", () => {
        const { statusElement } = createPendingVendorDom();

        setStatusMessage(statusElement, "Loaded.", "success");

        expect(statusElement.textContent).toBe("Loaded.");
        expect(statusElement.dataset.state).toBe("success");
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

    test("getVendorStatusMessage returns pending message", () => {
        expect(getVendorStatusMessage({ vendorStatus: "pending" })).toBe(
            "Your vendor application is awaiting review."
        );
    });

    test("getVendorStatusMessage returns approved message", () => {
        expect(getVendorStatusMessage({ vendorStatus: "approved" })).toBe(
            "Your vendor application has been approved."
        );
    });

    test("getVendorStatusMessage returns rejected message", () => {
        expect(getVendorStatusMessage({ vendorStatus: "rejected" })).toBe(
            "Your vendor application was not approved."
        );
    });

    test("getVendorStatusMessage returns default message", () => {
        expect(getVendorStatusMessage({ vendorStatus: "none" })).toBe(
            "No vendor application was found."
        );
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

    test("getBusinessName returns profile business name", () => {
        expect(
            getBusinessName({
                businessName: "Campus Grill"
            })
        ).toBe("Campus Grill");
    });

    test("renderPendingVendorInfo writes values into the page", () => {
        const dom = createPendingVendorDom();

        renderPendingVendorInfo(
            {
                nameElement: dom.nameElement,
                businessNameElement: dom.businessNameElement,
                vendorStatusElement: dom.vendorStatusElement,
                vendorMessageElement: dom.vendorMessageElement
            },
            {
                displayName: "Faranani Maduwa",
                businessName: "Campus Grill",
                vendorStatus: "pending"
            },
            {
                displayName: "Ignored User"
            }
        );

        expect(dom.nameElement.textContent).toBe("Faranani Maduwa");
        expect(dom.businessNameElement.textContent).toBe("Campus Grill");
        expect(dom.vendorStatusElement.textContent).toBe("Pending");
        expect(dom.vendorMessageElement.textContent).toBe(
            "Your vendor application is awaiting review."
        );
    });
});

describe("pending-vendor.js service functions", () => {
    test("loadPendingVendorProfile returns signed-in user and profile", async () => {
        const authService = {
            getCurrentUser: jest.fn().mockResolvedValue({
                uid: "user-1",
                email: "vendor@example.com",
                displayName: "Vendor User"
            }),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-1",
                displayName: "Vendor User",
                businessName: "Campus Grill",
                vendorStatus: "pending"
            })
        };

        const result = await loadPendingVendorProfile({ authService });

        expect(authService.getCurrentUser).toHaveBeenCalledTimes(1);
        expect(authService.getCurrentUserProfile).toHaveBeenCalledWith("user-1");
        expect(result.success).toBe(true);
        expect(result.user.uid).toBe("user-1");
        expect(result.profile.businessName).toBe("Campus Grill");
    });

    test("loadPendingVendorProfile returns error when no user is signed in", async () => {
        const authService = {
            getCurrentUser: jest.fn().mockResolvedValue(null),
            getCurrentUserProfile: jest.fn()
        };

        const result = await loadPendingVendorProfile({ authService });

        expect(result.success).toBe(false);
        expect(result.message).toBe("No user is currently signed in.");
        expect(authService.getCurrentUserProfile).not.toHaveBeenCalled();
    });

    test("loadPendingVendorProfile throws when getCurrentUser is missing", async () => {
        await expect(
            loadPendingVendorProfile({
                authService: {
                    getCurrentUserProfile: jest.fn()
                }
            })
        ).rejects.toThrow("authService.getCurrentUser is required.");
    });

    test("loadPendingVendorProfile throws when getCurrentUserProfile is missing", async () => {
        await expect(
            loadPendingVendorProfile({
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

describe("pending-vendor.js page flow", () => {
    test("initializePendingVendorView renders pending vendor status successfully", async () => {
        const dom = createPendingVendorDom();

        const authService = {
            getCurrentUser: jest.fn().mockResolvedValue({
                uid: "user-2",
                email: "vendor2@example.com",
                displayName: "Vendor Two"
            }),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-2",
                displayName: "Vendor Two",
                businessName: "Campus Grill",
                vendorStatus: "pending"
            })
        };

        const result = await initializePendingVendorView({
            authService,
            statusElement: dom.statusElement,
            pageElements: {
                nameElement: dom.nameElement,
                businessNameElement: dom.businessNameElement,
                vendorStatusElement: dom.vendorStatusElement,
                vendorMessageElement: dom.vendorMessageElement
            }
        });

        expect(result.success).toBe(true);
        expect(dom.nameElement.textContent).toBe("Vendor Two");
        expect(dom.businessNameElement.textContent).toBe("Campus Grill");
        expect(dom.vendorStatusElement.textContent).toBe("Pending");
        expect(dom.vendorMessageElement.textContent).toBe(
            "Your vendor application is awaiting review."
        );
        expect(dom.statusElement.textContent).toBe("Vendor application status loaded.");
        expect(dom.statusElement.dataset.state).toBe("success");
    });

    test("initializePendingVendorView shows message when no user is signed in", async () => {
        const dom = createPendingVendorDom();

        const authService = {
            getCurrentUser: jest.fn().mockResolvedValue(null),
            getCurrentUserProfile: jest.fn()
        };

        const result = await initializePendingVendorView({
            authService,
            statusElement: dom.statusElement,
            pageElements: {
                nameElement: dom.nameElement,
                businessNameElement: dom.businessNameElement,
                vendorStatusElement: dom.vendorStatusElement,
                vendorMessageElement: dom.vendorMessageElement
            }
        });

        expect(result.success).toBe(false);
        expect(dom.statusElement.textContent).toBe("No user is currently signed in.");
        expect(dom.statusElement.dataset.state).toBe("error");
    });

    test("initializePendingVendorView handles thrown errors", async () => {
        const dom = createPendingVendorDom();

        const authService = {
            getCurrentUser: jest.fn().mockRejectedValue(new Error("Unexpected failure")),
            getCurrentUserProfile: jest.fn()
        };

        const result = await initializePendingVendorView({
            authService,
            statusElement: dom.statusElement,
            pageElements: {
                nameElement: dom.nameElement,
                businessNameElement: dom.businessNameElement,
                vendorStatusElement: dom.vendorStatusElement,
                vendorMessageElement: dom.vendorMessageElement
            }
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Unexpected failure");
        expect(dom.statusElement.textContent).toBe("Unexpected failure");
        expect(dom.statusElement.dataset.state).toBe("error");
    });

    test("attachPendingVendorSignOutHandler signs out and navigates", async () => {
        const dom = createPendingVendorDom();

        const authService = {
            signOutUser: jest.fn().mockResolvedValue(undefined)
        };

        const onSuccess = jest.fn();
        const navigate = jest.fn();

        const { handleClick } = attachPendingVendorSignOutHandler({
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

    test("attachPendingVendorSignOutHandler handles thrown sign out errors", async () => {
        const dom = createPendingVendorDom();

        const authService = {
            signOutUser: jest.fn().mockRejectedValue(new Error("Unable to sign out"))
        };

        const onError = jest.fn();

        const { handleClick } = attachPendingVendorSignOutHandler({
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

    test("attachPendingVendorSignOutHandler throws if button is missing", () => {
        expect(() =>
            attachPendingVendorSignOutHandler({
                button: null,
                authService: {
                    signOutUser: jest.fn()
                }
            })
        ).toThrow("A sign out button is required.");
    });
});