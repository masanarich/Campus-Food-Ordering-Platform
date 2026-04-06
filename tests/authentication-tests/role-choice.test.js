const {
    normalizeText,
    normalizeRole,
    isValidRole,
    setStatusMessage,
    setButtonState,
    getNextRouteForRole,
    buildRoleUpdates,
    submitRoleChoice,
    attachRoleChoiceHandler
} = require("../../public/authentication/role-choice.js");

function createRoleChoiceDom() {
    document.body.innerHTML = `
    <section>
      <p id="role-choice-status"></p>
      <button id="choose-customer" type="button">Customer</button>
      <button id="choose-vendor" type="button">Vendor</button>
    </section>
  `;

    return {
        statusElement: document.querySelector("#role-choice-status"),
        customerButton: document.querySelector("#choose-customer"),
        vendorButton: document.querySelector("#choose-vendor")
    };
}

describe("role-choice.js helpers", () => {
    test("normalizeText trims whitespace", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
    });

    test("normalizeRole trims and lowercases role", () => {
        expect(normalizeRole("  Vendor  ")).toBe("vendor");
    });

    test("isValidRole accepts customer", () => {
        expect(isValidRole("customer")).toBe(true);
    });

    test("isValidRole accepts vendor", () => {
        expect(isValidRole("vendor")).toBe(true);
    });

    test("isValidRole rejects admin", () => {
        expect(isValidRole("admin")).toBe(false);
    });

    test("setStatusMessage updates text and state", () => {
        const { statusElement } = createRoleChoiceDom();

        setStatusMessage(statusElement, "Saved.", "success");

        expect(statusElement.textContent).toBe("Saved.");
        expect(statusElement.dataset.state).toBe("success");
    });

    test("setButtonState disables button", () => {
        const { customerButton } = createRoleChoiceDom();

        setButtonState(customerButton, true);

        expect(customerButton.disabled).toBe(true);
    });

    test("setButtonState enables button", () => {
        const { customerButton } = createRoleChoiceDom();

        setButtonState(customerButton, false);

        expect(customerButton.disabled).toBe(false);
    });

    test("getNextRouteForRole returns customer route", () => {
        expect(getNextRouteForRole("customer")).toBe("../customer/index.html");
    });

    test("getNextRouteForRole returns vendor route", () => {
        expect(getNextRouteForRole("vendor")).toBe("./pending-vendor.html");
    });

    test("buildRoleUpdates returns customer role updates", () => {
        const result = buildRoleUpdates("customer", {
            roles: { admin: false, vendor: false, customer: true }
        });

        expect(result).toEqual({
            roles: {
                customer: true,
                vendor: false,
                admin: false
            },
            vendorStatus: "none"
        });
    });

    test("buildRoleUpdates returns vendor role updates", () => {
        const result = buildRoleUpdates("vendor", {
            roles: { admin: true, vendor: false, customer: true }
        });

        expect(result).toEqual({
            roles: {
                customer: false,
                vendor: true,
                admin: true
            },
            vendorStatus: "pending"
        });
    });
});

describe("role-choice.js service submission", () => {
    test("submitRoleChoice updates current user to customer", async () => {
        const authService = {
            getCurrentUser: jest.fn().mockResolvedValue({
                uid: "user-1"
            }),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-1",
                roles: { customer: true, vendor: false, admin: false },
                vendorStatus: "none"
            }),
            updateUserProfile: jest.fn().mockResolvedValue({
                uid: "user-1"
            })
        };

        const result = await submitRoleChoice("customer", { authService });

        expect(authService.getCurrentUser).toHaveBeenCalledTimes(1);
        expect(authService.getCurrentUserProfile).toHaveBeenCalledWith("user-1");
        expect(authService.updateUserProfile).toHaveBeenCalledWith("user-1", {
            roles: {
                customer: true,
                vendor: false,
                admin: false
            },
            vendorStatus: "none"
        });
        expect(result.success).toBe(true);
        expect(result.nextRoute).toBe("../customer/index.html");
    });

    test("submitRoleChoice updates current user to vendor", async () => {
        const authService = {
            getCurrentUser: jest.fn().mockResolvedValue({
                uid: "user-2"
            }),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-2",
                roles: { customer: true, vendor: false, admin: false },
                vendorStatus: "none"
            }),
            updateUserProfile: jest.fn().mockResolvedValue({
                uid: "user-2"
            })
        };

        const result = await submitRoleChoice("vendor", { authService });

        expect(authService.updateUserProfile).toHaveBeenCalledWith("user-2", {
            roles: {
                customer: false,
                vendor: true,
                admin: false
            },
            vendorStatus: "pending"
        });
        expect(result.success).toBe(true);
        expect(result.nextRoute).toBe("./pending-vendor.html");
    });

    test("submitRoleChoice returns error for invalid role", async () => {
        const authService = {
            getCurrentUser: jest.fn(),
            getCurrentUserProfile: jest.fn(),
            updateUserProfile: jest.fn()
        };

        const result = await submitRoleChoice("admin", { authService });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Please choose a valid role.");
        expect(authService.getCurrentUser).not.toHaveBeenCalled();
    });

    test("submitRoleChoice returns error when no user is signed in", async () => {
        const authService = {
            getCurrentUser: jest.fn().mockResolvedValue(null),
            getCurrentUserProfile: jest.fn(),
            updateUserProfile: jest.fn()
        };

        const result = await submitRoleChoice("customer", { authService });

        expect(result.success).toBe(false);
        expect(result.message).toBe("No user is currently signed in.");
        expect(authService.updateUserProfile).not.toHaveBeenCalled();
    });

    test("submitRoleChoice throws when getCurrentUser is missing", async () => {
        await expect(
            submitRoleChoice("customer", {
                authService: {
                    getCurrentUserProfile: jest.fn(),
                    updateUserProfile: jest.fn()
                }
            })
        ).rejects.toThrow("authService.getCurrentUser is required.");
    });

    test("submitRoleChoice throws when updateUserProfile is missing", async () => {
        await expect(
            submitRoleChoice("customer", {
                authService: {
                    getCurrentUser: jest.fn(),
                    getCurrentUserProfile: jest.fn()
                }
            })
        ).rejects.toThrow("authService.updateUserProfile is required.");
    });

    test("submitRoleChoice throws when getCurrentUserProfile is missing", async () => {
        await expect(
            submitRoleChoice("customer", {
                authService: {
                    getCurrentUser: jest.fn(),
                    updateUserProfile: jest.fn()
                }
            })
        ).rejects.toThrow("authService.getCurrentUserProfile is required.");
    });
});

describe("role-choice.js button flow", () => {
    test("attachRoleChoiceHandler saves customer choice and navigates", async () => {
        const { customerButton, statusElement } = createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn().mockResolvedValue({
                uid: "user-3"
            }),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-3",
                roles: { customer: true, vendor: false, admin: false },
                vendorStatus: "none"
            }),
            updateUserProfile: jest.fn().mockResolvedValue({
                uid: "user-3"
            })
        };

        const onSuccess = jest.fn();
        const navigate = jest.fn();

        const { handleClick } = attachRoleChoiceHandler({
            button: customerButton,
            role: "customer",
            authService,
            statusElement,
            onSuccess,
            navigate
        });

        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(true);
        expect(statusElement.textContent).toBe("Role selected successfully.");
        expect(statusElement.dataset.state).toBe("success");
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
        expect(customerButton.disabled).toBe(false);
    });

    test("attachRoleChoiceHandler saves vendor choice and navigates", async () => {
        const { vendorButton, statusElement } = createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn().mockResolvedValue({
                uid: "user-4"
            }),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-4",
                roles: { customer: true, vendor: false, admin: false },
                vendorStatus: "none"
            }),
            updateUserProfile: jest.fn().mockResolvedValue({
                uid: "user-4"
            })
        };

        const navigate = jest.fn();

        const { handleClick } = attachRoleChoiceHandler({
            button: vendorButton,
            role: "vendor",
            authService,
            statusElement,
            navigate
        });

        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(true);
        expect(navigate).toHaveBeenCalledWith("./pending-vendor.html");
        expect(vendorButton.disabled).toBe(false);
    });

    test("attachRoleChoiceHandler shows returned service error", async () => {
        const { customerButton, statusElement } = createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn().mockResolvedValue(null),
            getCurrentUserProfile: jest.fn(),
            updateUserProfile: jest.fn()
        };

        const onError = jest.fn();

        const { handleClick } = attachRoleChoiceHandler({
            button: customerButton,
            role: "customer",
            authService,
            statusElement,
            onError
        });

        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(statusElement.textContent).toBe("No user is currently signed in.");
        expect(statusElement.dataset.state).toBe("error");
        expect(onError).toHaveBeenCalledTimes(1);
        expect(customerButton.disabled).toBe(false);
    });

    test("attachRoleChoiceHandler handles thrown errors", async () => {
        const { customerButton, statusElement } = createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn().mockRejectedValue(new Error("Unexpected failure")),
            getCurrentUserProfile: jest.fn(),
            updateUserProfile: jest.fn()
        };

        const onError = jest.fn();

        const { handleClick } = attachRoleChoiceHandler({
            button: customerButton,
            role: "customer",
            authService,
            statusElement,
            onError
        });

        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Unexpected failure");
        expect(statusElement.textContent).toBe("Unexpected failure");
        expect(statusElement.dataset.state).toBe("error");
        expect(onError).toHaveBeenCalledTimes(1);
        expect(customerButton.disabled).toBe(false);
    });

    test("attachRoleChoiceHandler throws if button is missing", () => {
        expect(() =>
            attachRoleChoiceHandler({
                button: null,
                role: "customer",
                authService: {}
            })
        ).toThrow("A role choice button is required.");
    });

    test("attachRoleChoiceHandler throws if role is invalid", () => {
        const { customerButton } = createRoleChoiceDom();

        expect(() =>
            attachRoleChoiceHandler({
                button: customerButton,
                role: "admin",
                authService: {}
            })
        ).toThrow("A valid role is required.");
    });
});