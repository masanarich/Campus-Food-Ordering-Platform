/**
 * @jest-environment jsdom
 */

const fs = require("fs");
const path = require("path");

function loadModule(moduleRelativePath, injectedGlobals = {}) {
    const filePath = path.resolve(__dirname, moduleRelativePath);

    let source = fs.readFileSync(filePath, "utf8");

    source = source.replace(
        /export\s*\{[\s\S]*?\};?\s*/m,
        ""
    );

    const moduleShim = { exports: {} };

    const argNames = [
        "module",
        "exports",
        "require",
        "__filename",
        "__dirname",
        ...Object.keys(injectedGlobals)
    ];

    const argValues = [
        moduleShim,
        moduleShim.exports,
        require,
        filePath,
        path.dirname(filePath),
        ...Object.values(injectedGlobals)
    ];

    const factory = new Function(
        ...argNames,
        `${source}
return module.exports;`
    );

    return factory(...argValues);
}

const authUtils = loadModule("../../public/authentication/auth-utils.js", {
    window,
    document
});

const {
    normalizeText,
    normalizeEmail,
    getFormField,
    extractRegisterFormValues,
    buildRegisterPayload,
    isValidAccountType,
    validateRegisterPayload,
    clearFieldErrors,
    showFieldErrors,
    setStatusMessage,
    setSubmittingState,
    getSuccessMessage,
    submitRegistration,
    attachRegisterHandler,
    initializeRegisterPage
} = loadModule("../../public/authentication/register.js", {
    document,
    window
});

function getRegisterFields(form) {
    return {
        fullName: form.elements.namedItem("fullName"),
        email: form.elements.namedItem("email"),
        password: form.elements.namedItem("password"),
        confirmPassword: form.elements.namedItem("confirmPassword"),
        accountType: form.elements.namedItem("accountType")
    };
}

function createRegisterFormDom() {
    document.body.innerHTML = `
        <form id="register-form">
            <input name="fullName" value="" />
            <p data-error-for="fullName"></p>

            <input name="email" value="" />
            <p data-error-for="email"></p>

            <input name="password" value="" />
            <p data-error-for="password"></p>

            <input name="confirmPassword" value="" />
            <p data-error-for="confirmPassword"></p>

            <select name="accountType">
                <option value="customer">Customer</option>
                <option value="vendor">Vendor</option>
            </select>
            <p data-error-for="accountType"></p>

            <button type="submit">Register</button>
        </form>

        <p id="register-status"></p>
    `;

    return {
        form: document.querySelector("#register-form"),
        statusElement: document.querySelector("#register-status")
    };
}

describe("register.js helpers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("normalizeText trims whitespace", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
    });

    test("normalizeEmail trims and lowercases email", () => {
        expect(normalizeEmail("  USER@Example.COM  ")).toBe("user@example.com");
    });

    test("getFormField returns the requested field", () => {
        const { form } = createRegisterFormDom();

        expect(getFormField(form, "fullName")).toBe(form.elements.namedItem("fullName"));
        expect(getFormField(form, "email")).toBe(form.elements.namedItem("email"));
    });

    test("getFormField returns null for invalid form", () => {
        expect(getFormField(null, "email")).toBeNull();
    });

    test("extractRegisterFormValues reads values from form", () => {
        const { form } = createRegisterFormDom();
        const fields = getRegisterFields(form);

        fields.fullName.value = "Faranani Maduwa";
        fields.email.value = "faranani@example.com";
        fields.password.value = "password123";
        fields.confirmPassword.value = "password123";
        fields.accountType.value = "vendor";

        const result = extractRegisterFormValues(form);

        expect(result).toEqual({
            fullName: "Faranani Maduwa",
            email: "faranani@example.com",
            password: "password123",
            confirmPassword: "password123",
            accountType: "vendor"
        });
    });

    test("extractRegisterFormValues falls back to defaults", () => {
        expect(extractRegisterFormValues(null)).toEqual({
            fullName: "",
            email: "",
            password: "",
            confirmPassword: "",
            accountType: "customer"
        });
    });

    test("buildRegisterPayload normalizes raw values", () => {
        const result = buildRegisterPayload({
            fullName: "  Faranani Maduwa  ",
            email: "  USER@Example.COM ",
            password: "password123",
            confirmPassword: "password123",
            accountType: " Vendor "
        });

        expect(result).toEqual({
            fullName: "Faranani Maduwa",
            email: "user@example.com",
            password: "password123",
            confirmPassword: "password123",
            accountType: "vendor"
        });
    });

    test("buildRegisterPayload defaults invalid values safely", () => {
        const result = buildRegisterPayload({
            fullName: null,
            email: null,
            password: null,
            confirmPassword: null,
            accountType: null
        });

        expect(result).toEqual({
            fullName: "",
            email: "",
            password: "",
            confirmPassword: "",
            accountType: "customer"
        });
    });

    test("isValidAccountType accepts customer", () => {
        expect(isValidAccountType("customer")).toBe(true);
    });

    test("isValidAccountType accepts vendor", () => {
        expect(isValidAccountType("vendor")).toBe(true);
    });

    test("isValidAccountType rejects admin", () => {
        expect(isValidAccountType("admin")).toBe(false);
    });

    test("validateRegisterPayload accepts valid customer payload", () => {
        const result = validateRegisterPayload(
            {
                fullName: "Faranani Maduwa",
                email: "faranani@example.com",
                password: "password123",
                confirmPassword: "password123",
                accountType: "customer"
            },
            authUtils
        );

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual({});
    });

    test("validateRegisterPayload returns expected errors for bad payload", () => {
        const result = validateRegisterPayload(
            {
                fullName: "",
                email: "wrong-email",
                password: "123",
                confirmPassword: "456",
                accountType: "admin"
            },
            authUtils
        );

        expect(result.isValid).toBe(false);
        expect(result.errors.fullName).toBe("Full name is required.");
        expect(result.errors.email).toBe("Please enter a valid email address.");
        expect(result.errors.password).toBe("Password must be at least 8 characters long.");
        expect(result.errors.confirmPassword).toBe("Passwords do not match.");
        expect(result.errors.accountType).toBe("Please choose a valid account type.");
    });

    test("validateRegisterPayload throws when authUtils is missing", () => {
        expect(() =>
            validateRegisterPayload(
                {
                    fullName: "Faranani",
                    email: "faranani@example.com",
                    password: "password123",
                    confirmPassword: "password123",
                    accountType: "customer"
                },
                null
            )
        ).toThrow("authUtils is required.");
    });

    test("clearFieldErrors clears all visible field errors", () => {
        const { form } = createRegisterFormDom();

        form.querySelector('[data-error-for="fullName"]').textContent = "Required";
        form.querySelector('[data-error-for="email"]').textContent = "Invalid";

        clearFieldErrors(form);

        expect(form.querySelector('[data-error-for="fullName"]').textContent).toBe("");
        expect(form.querySelector('[data-error-for="email"]').textContent).toBe("");
    });

    test("clearFieldErrors does nothing when form is missing", () => {
        expect(() => clearFieldErrors(null)).not.toThrow();
    });

    test("showFieldErrors sets field error messages", () => {
        const { form } = createRegisterFormDom();

        showFieldErrors(form, {
            fullName: "Full name is required.",
            email: "Please enter a valid email address."
        });

        expect(form.querySelector('[data-error-for="fullName"]').textContent).toBe(
            "Full name is required."
        );
        expect(form.querySelector('[data-error-for="email"]').textContent).toBe(
            "Please enter a valid email address."
        );
    });

    test("showFieldErrors does nothing when form is missing", () => {
        expect(() =>
            showFieldErrors(null, {
                fullName: "Full name is required."
            })
        ).not.toThrow();
    });

    test("setStatusMessage updates text and state", () => {
        const { statusElement } = createRegisterFormDom();

        setStatusMessage(statusElement, "Registration successful.", "success");

        expect(statusElement.textContent).toBe("Registration successful.");
        expect(statusElement.dataset.state).toBe("success");
    });

    test("setStatusMessage does nothing when element is missing", () => {
        expect(() => setStatusMessage(null, "Hello", "success")).not.toThrow();
    });

    test("setSubmittingState disables submit button when submitting", () => {
        const { form } = createRegisterFormDom();

        setSubmittingState(form, true);

        expect(form.querySelector('button[type="submit"]').disabled).toBe(true);
        expect(form.dataset.submitting).toBe("true");
    });

    test("setSubmittingState enables submit button when not submitting", () => {
        const { form } = createRegisterFormDom();

        setSubmittingState(form, false);

        expect(form.querySelector('button[type="submit"]').disabled).toBe(false);
        expect(form.dataset.submitting).toBe("false");
    });

    test("setSubmittingState does nothing when form is missing", () => {
        expect(() => setSubmittingState(null, true)).not.toThrow();
    });

    test("getSuccessMessage returns customer success message", () => {
        expect(getSuccessMessage("customer")).toBe("Registration successful.");
    });

    test("getSuccessMessage returns vendor pending message", () => {
        expect(getSuccessMessage("vendor")).toBe(
            "Registration successful. Your vendor application is awaiting approval."
        );
    });

    test("getSuccessMessage falls back to default message", () => {
        expect(getSuccessMessage("anything-else")).toBe("Registration successful.");
    });
});

describe("register.js service submission", () => {
    test("submitRegistration calls authService.registerWithEmail", async () => {
        const authService = {
            registerWithEmail: jest.fn().mockResolvedValue({
                success: true,
                nextRoute: "../customer/index.html"
            })
        };

        const payload = {
            fullName: "Faranani Maduwa",
            email: "faranani@example.com",
            password: "password123",
            confirmPassword: "password123",
            accountType: "customer"
        };

        const result = await submitRegistration(payload, { authService });

        expect(authService.registerWithEmail).toHaveBeenCalledWith({
            email: "faranani@example.com",
            password: "password123",
            displayName: "Faranani Maduwa",
            accountType: "customer"
        });
        expect(result.success).toBe(true);
    });

    test("submitRegistration throws when authService is missing", async () => {
        await expect(
            submitRegistration(
                {
                    fullName: "Faranani Maduwa",
                    email: "faranani@example.com",
                    password: "password123",
                    confirmPassword: "password123",
                    accountType: "customer"
                },
                {}
            )
        ).rejects.toThrow("authService.registerWithEmail is required.");
    });
});

describe("register.js form submission flow", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("attachRegisterHandler shows validation errors for invalid input", async () => {
        const { form, statusElement } = createRegisterFormDom();
        const fields = getRegisterFields(form);

        fields.fullName.value = "";
        fields.email.value = "bad-email";
        fields.password.value = "123";
        fields.confirmPassword.value = "456";
        fields.accountType.value = "customer";

        const authService = {
            registerWithEmail: jest.fn()
        };

        const { handleSubmit } = attachRegisterHandler({
            form,
            statusElement,
            authService,
            authUtils
        });

        const result = await handleSubmit({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(authService.registerWithEmail).not.toHaveBeenCalled();
        expect(form.querySelector('[data-error-for="fullName"]').textContent).toBe(
            "Full name is required."
        );
        expect(form.querySelector('[data-error-for="email"]').textContent).toBe(
            "Please enter a valid email address."
        );
        expect(form.querySelector('[data-error-for="password"]').textContent).toBe(
            "Password must be at least 8 characters long."
        );
        expect(form.querySelector('[data-error-for="confirmPassword"]').textContent).toBe(
            "Passwords do not match."
        );
        expect(statusElement.textContent).toBe("Please fix the highlighted fields.");
        expect(statusElement.dataset.state).toBe("error");
        expect(form.dataset.submitting).toBe("false");
    });

    test("attachRegisterHandler registers a customer successfully", async () => {
        const { form, statusElement } = createRegisterFormDom();
        const fields = getRegisterFields(form);

        fields.fullName.value = "Faranani Maduwa";
        fields.email.value = "faranani@example.com";
        fields.password.value = "password123";
        fields.confirmPassword.value = "password123";
        fields.accountType.value = "customer";

        const authService = {
            registerWithEmail: jest.fn().mockResolvedValue({
                success: true,
                profile: {
                    roles: { customer: true, vendor: false, admin: false }
                },
                nextRoute: "../customer/index.html"
            })
        };

        const onSuccess = jest.fn();
        const navigate = jest.fn();

        const { handleSubmit } = attachRegisterHandler({
            form,
            statusElement,
            authService,
            authUtils,
            onSuccess,
            navigate
        });

        const result = await handleSubmit({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(true);
        expect(authService.registerWithEmail).toHaveBeenCalledTimes(1);
        expect(statusElement.textContent).toBe("Registration successful.");
        expect(statusElement.dataset.state).toBe("success");
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
        expect(form.dataset.submitting).toBe("false");
    });

    test("attachRegisterHandler registers a vendor and shows pending message", async () => {
        const { form, statusElement } = createRegisterFormDom();
        const fields = getRegisterFields(form);

        fields.fullName.value = "Vendor User";
        fields.email.value = "vendor@example.com";
        fields.password.value = "password123";
        fields.confirmPassword.value = "password123";
        fields.accountType.value = "vendor";

        const authService = {
            registerWithEmail: jest.fn().mockResolvedValue({
                success: true,
                profile: {
                    roles: { customer: true, vendor: false, admin: false },
                    vendorStatus: "pending"
                },
                nextRoute: "../customer/index.html"
            })
        };

        const navigate = jest.fn();

        const { handleSubmit } = attachRegisterHandler({
            form,
            statusElement,
            authService,
            authUtils,
            navigate
        });

        const result = await handleSubmit({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(true);
        expect(statusElement.textContent).toBe(
            "Registration successful. Your vendor application is awaiting approval."
        );
        expect(statusElement.dataset.state).toBe("success");
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
        expect(form.dataset.submitting).toBe("false");
    });

    test("attachRegisterHandler shows service error message on failed registration", async () => {
        const { form, statusElement } = createRegisterFormDom();
        const fields = getRegisterFields(form);

        fields.fullName.value = "Taken User";
        fields.email.value = "taken@example.com";
        fields.password.value = "password123";
        fields.confirmPassword.value = "password123";
        fields.accountType.value = "customer";

        const authService = {
            registerWithEmail: jest.fn().mockResolvedValue({
                success: false,
                message: "That email address is already in use."
            })
        };

        const onError = jest.fn();

        const { handleSubmit } = attachRegisterHandler({
            form,
            statusElement,
            authService,
            authUtils,
            onError
        });

        const result = await handleSubmit({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(statusElement.textContent).toBe("That email address is already in use.");
        expect(statusElement.dataset.state).toBe("error");
        expect(onError).toHaveBeenCalledTimes(1);
        expect(form.dataset.submitting).toBe("false");
    });

    test("attachRegisterHandler handles unexpected thrown errors", async () => {
        const { form, statusElement } = createRegisterFormDom();
        const fields = getRegisterFields(form);

        fields.fullName.value = "Faranani Maduwa";
        fields.email.value = "faranani@example.com";
        fields.password.value = "password123";
        fields.confirmPassword.value = "password123";
        fields.accountType.value = "customer";

        const authService = {
            registerWithEmail: jest.fn().mockRejectedValue(new Error("Unexpected failure"))
        };

        const onError = jest.fn();

        const { handleSubmit } = attachRegisterHandler({
            form,
            statusElement,
            authService,
            authUtils,
            onError
        });

        const result = await handleSubmit({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Unexpected failure");
        expect(statusElement.textContent).toBe("Unexpected failure");
        expect(statusElement.dataset.state).toBe("error");
        expect(onError).toHaveBeenCalledTimes(1);
        expect(form.dataset.submitting).toBe("false");
    });

    test("attachRegisterHandler throws if form is missing", () => {
        expect(() =>
            attachRegisterHandler({
                form: null,
                authService: {},
                authUtils
            })
        ).toThrow("A registration form is required.");
    });

    test("attachRegisterHandler throws if authUtils is missing", () => {
        const { form } = createRegisterFormDom();

        expect(() =>
            attachRegisterHandler({
                form,
                authService: {}
            })
        ).toThrow("authUtils is required.");
    });
});

describe("register.js page initialization", () => {
    let originalWindowAuthUtils;

    beforeAll(() => {
        originalWindowAuthUtils = window.authUtils;
    });

    afterAll(() => {
        window.authUtils = originalWindowAuthUtils;
    });

    beforeEach(() => {
        document.body.innerHTML = "";
        window.authUtils = authUtils;
    });

    test("initializeRegisterPage wires the register handler", () => {
        createRegisterFormDom();

        const authService = {
            registerWithEmail: jest.fn()
        };

        const result = initializeRegisterPage({
            authService,
            authUtils,
            navigate: jest.fn()
        });

        expect(result).toBeTruthy();
        expect(typeof result.handleSubmit).toBe("function");
    });

    test("initializeRegisterPage uses custom navigate function", async () => {
        const { form } = createRegisterFormDom();
        const fields = getRegisterFields(form);

        fields.fullName.value = "Faranani Maduwa";
        fields.email.value = "faranani@example.com";
        fields.password.value = "password123";
        fields.confirmPassword.value = "password123";
        fields.accountType.value = "customer";

        const authService = {
            registerWithEmail: jest.fn().mockResolvedValue({
                success: true,
                nextRoute: "../customer/index.html"
            })
        };

        const navigate = jest.fn();

        const controller = initializeRegisterPage({
            authService,
            authUtils,
            navigate
        });

        await controller.handleSubmit({
            preventDefault: jest.fn()
        });

        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
    });

    test("initializeRegisterPage throws when form is missing", () => {
        document.body.innerHTML = `<p id="register-status"></p>`;

        expect(() =>
            initializeRegisterPage({
                authService: {},
                authUtils
            })
        ).toThrow("Register form not found.");
    });

    test("initializeRegisterPage throws when authService is missing", () => {
        createRegisterFormDom();

        expect(() =>
            initializeRegisterPage({
                authUtils
            })
        ).toThrow("authService is required.");
    });

    test("initializeRegisterPage throws when authUtils is missing", () => {
        createRegisterFormDom();

        const savedAuthUtils = window.authUtils;
        delete window.authUtils;

        try {
            expect(() =>
                initializeRegisterPage({
                    authService: {}
                })
            ).toThrow("authUtils is required.");
        } finally {
            window.authUtils = savedAuthUtils;
        }
    });
});