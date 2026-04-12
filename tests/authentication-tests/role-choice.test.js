/**
 * @jest-environment jsdom
 */

const fs = require("fs");
const path = require("path");

function loadRoleChoiceModule() {
    const filePath = path.resolve(
        __dirname,
        "../../public/authentication/role-choice.js"
    );

    let source = fs.readFileSync(filePath, "utf8");

    source = source.replace(
        /export\s*\{[\s\S]*?\};?\s*/m,
        ""
    );

    const moduleShim = { exports: {} };

    const factory = new Function(
        "module",
        "exports",
        "require",
        "__filename",
        "__dirname",
        "document",
        "window",
        `${source}
return module.exports;`
    );

    return factory(
        moduleShim,
        moduleShim.exports,
        require,
        filePath,
        path.dirname(filePath),
        document,
        window
    );
}

const {
    normalizeText,
    normalizeRole,
    isValidRole,
    setStatusMessage,
    setButtonState,
    getNextRouteForRole,
    buildRoleUpdates,
    submitRoleChoice,
    attachRoleChoiceHandler,
    initializeRoleChoicePage
} = loadRoleChoiceModule();

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
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("normalizeText trims whitespace", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
    });

    test("normalizeText returns empty string for non-string values", () => {
        expect(normalizeText(null)).toBe("");
        expect(normalizeText(undefined)).toBe("");
        expect(normalizeText(42)).toBe("");
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

    test("isValidRole accepts mixed case with spaces", () => {
        expect(isValidRole("  CuStOmEr ")).toBe(true);
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

    test("setStatusMessage does nothing when no element is passed", () => {
        expect(() => setStatusMessage(null, "Saved.", "success")).not.toThrow();
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

    test("setButtonState does nothing when button is missing", () => {
        expect(() => setButtonState(null, true)).not.toThrow();
    });

    test("getNextRouteForRole returns customer route", () => {
        expect(getNextRouteForRole("customer")).toBe("../customer/index.html");
    });

    test("getNextRouteForRole returns vendor route", () => {
        expect(getNextRouteForRole("vendor")).toBe("./pending-vendor.html");
    });

    test("buildRoleUpdates returns customer updates", () => {
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

    test("buildRoleUpdates returns vendor updates and preserves admin", () => {
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

    test("buildRoleUpdates handles missing profile", () => {
        const result = buildRoleUpdates("customer");

        expect(result).toEqual({
            roles: {
                customer: true,
                vendor: false,
                admin: false
            },
            vendorStatus: "none"
        });
    });
});

describe("role-choice.js service submission", () => {
    test("submitRoleChoice updates current user to customer", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-1"
            })),
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
        expect(result).toEqual({
            success: true,
            role: "customer",
            updates: {
                roles: {
                    customer: true,
                    vendor: false,
                    admin: false
                },
                vendorStatus: "none"
            },
            nextRoute: "../customer/index.html"
        });
    });

    test("submitRoleChoice updates current user to vendor", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-2"
            })),
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
        expect(result.role).toBe("vendor");
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
            getCurrentUser: jest.fn(() => null),
            getCurrentUserProfile: jest.fn(),
            updateUserProfile: jest.fn()
        };

        const result = await submitRoleChoice("customer", { authService });

        expect(result.success).toBe(false);
        expect(result.message).toBe("No user is currently signed in.");
        expect(authService.getCurrentUserProfile).not.toHaveBeenCalled();
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
                    getCurrentUser: jest.fn(() => ({ uid: "user-1" })),
                    getCurrentUserProfile: jest.fn()
                }
            })
        ).rejects.toThrow("authService.updateUserProfile is required.");
    });

    test("submitRoleChoice throws when getCurrentUserProfile is missing", async () => {
        await expect(
            submitRoleChoice("customer", {
                authService: {
                    getCurrentUser: jest.fn(() => ({ uid: "user-1" })),
                    updateUserProfile: jest.fn()
                }
            })
        ).rejects.toThrow("authService.getCurrentUserProfile is required.");
    });
});

describe("role-choice.js button flow", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("attachRoleChoiceHandler saves customer choice and navigates", async () => {
        const { customerButton, statusElement } = createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-3"
            })),
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
            getCurrentUser: jest.fn(() => ({
                uid: "user-4"
            })),
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
        expect(statusElement.textContent).toBe("Role selected successfully.");
        expect(statusElement.dataset.state).toBe("success");
        expect(navigate).toHaveBeenCalledWith("./pending-vendor.html");
        expect(vendorButton.disabled).toBe(false);
    });

    test("attachRoleChoiceHandler shows returned service error", async () => {
        const { customerButton, statusElement } = createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn(() => null),
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
            getCurrentUser: jest.fn(() => {
                throw new Error("Unexpected failure");
            }),
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

    test("attachRoleChoiceHandler throws if authService is missing", () => {
        const { customerButton } = createRoleChoiceDom();

        expect(() =>
            attachRoleChoiceHandler({
                button: customerButton,
                role: "customer"
            })
        ).toThrow("authService is required.");
    });

    test("attached click listener works through real button click", async () => {
        const { customerButton, statusElement } = createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-6"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                roles: { customer: false, vendor: false, admin: false }
            }),
            updateUserProfile: jest.fn().mockResolvedValue({})
        };

        const navigate = jest.fn();

        attachRoleChoiceHandler({
            button: customerButton,
            role: "customer",
            authService,
            statusElement,
            navigate
        });

        customerButton.click();

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(authService.getCurrentUser).toHaveBeenCalledTimes(1);
        expect(statusElement.textContent).toBe("Role selected successfully.");
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
    });
});

describe("role-choice.js page initialization", () => {
    let originalDocument;
    let originalWindow;

    beforeAll(() => {
        originalDocument = global.document;
        originalWindow = global.window;
    });

    afterAll(() => {
        global.document = originalDocument;
        global.window = originalWindow;
    });

    beforeEach(() => {
        document.body.innerHTML = "";
        global.document = document;
        global.window = window;
    });

    test("initializeRoleChoicePage wires both buttons", () => {
        const { customerButton, vendorButton } = createRoleChoiceDom();

        const addEventListenerSpyCustomer = jest.spyOn(customerButton, "addEventListener");
        const addEventListenerSpyVendor = jest.spyOn(vendorButton, "addEventListener");

        const authService = {
            getCurrentUser: jest.fn(() => ({ uid: "user-7" })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                roles: { customer: false, vendor: false, admin: false }
            }),
            updateUserProfile: jest.fn().mockResolvedValue({})
        };

        const result = initializeRoleChoicePage({
            authService
        });

        expect(result.customerController).toBeTruthy();
        expect(result.vendorController).toBeTruthy();
        expect(addEventListenerSpyCustomer).toHaveBeenCalledWith("click", expect.any(Function));
        expect(addEventListenerSpyVendor).toHaveBeenCalledWith("click", expect.any(Function));
    });

    test("initializeRoleChoicePage uses custom navigate function", async () => {
        createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn(() => ({ uid: "user-8" })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                roles: { customer: false, vendor: false, admin: false }
            }),
            updateUserProfile: jest.fn().mockResolvedValue({})
        };

        const navigate = jest.fn();

        const result = initializeRoleChoicePage({
            authService,
            navigate
        });

        await result.customerController.handleClick({
            preventDefault: jest.fn()
        });

        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
    });

    test("initializeRoleChoicePage returns null controller when vendor button is missing", () => {
        document.body.innerHTML = `
            <section>
                <p id="role-choice-status"></p>
                <button id="choose-customer" type="button">Customer</button>
            </section>
        `;

        const authService = {
            getCurrentUser: jest.fn(() => ({ uid: "user-9" })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                roles: { customer: false, vendor: false, admin: false }
            }),
            updateUserProfile: jest.fn().mockResolvedValue({})
        };

        const result = initializeRoleChoicePage({
            authService
        });

        expect(result.customerController).toBeTruthy();
        expect(result.vendorController).toBeNull();
    });

    test("initializeRoleChoicePage throws when authService is missing", () => {
        createRoleChoiceDom();

        expect(() => initializeRoleChoicePage()).toThrow("authService is required.");
    });
});