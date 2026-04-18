/**
 * @jest-environment jsdom
 */

const authUtils = require("../../public/authentication/auth-utils.js");
const {
    normalizeText,
    normalizeEmail,
    getFormField,
    extractRegisterFormValues,
    buildRegisterPayload,
    isValidAccountType,
    requiresExtendedDetails,
    validateRegisterPayload,
    clearFieldErrors,
    showFieldErrors,
    setStatusMessage,
    setSubmittingState,
    getSuccessMessage,
    submitRegistration,
    submitGoogleRegistration,
    submitAppleRegistration,
    setElementHidden,
    toggleRegistrationRoleSections,
    handleAuthSuccess,
    handleAuthFailure,
    attachRegisterHandler,
    attachOAuthHandler,
    initializeRegisterPage
} = require("../../public/authentication/register.js");

function getRegisterFields(form) {
    return {
        email: form.elements.namedItem("email"),
        password: form.elements.namedItem("password"),
        confirmPassword: form.elements.namedItem("confirmPassword"),
        accountType: form.elements.namedItem("accountType"),
        fullName: form.elements.namedItem("fullName"),
        phoneNumber: form.elements.namedItem("phoneNumber"),
        businessName: form.elements.namedItem("businessName"),
        university: form.elements.namedItem("university"),
        location: form.elements.namedItem("location"),
        foodType: form.elements.namedItem("foodType"),
        description: form.elements.namedItem("description"),
        department: form.elements.namedItem("department"),
        motivation: form.elements.namedItem("motivation")
    };
}

function createRegisterFormDom() {
    document.body.innerHTML = `
        <form id="register-form">
            <input name="email" value="" />
            <p data-error-for="email"></p>

            <input name="password" value="" />
            <p data-error-for="password"></p>

            <input name="confirmPassword" value="" />
            <p data-error-for="confirmPassword"></p>

            <select name="accountType">
                <option value="customer">Customer</option>
                <option value="vendor">Vendor</option>
                <option value="admin">Admin</option>
            </select>
            <p data-error-for="accountType"></p>

            <p id="register-role-hint"></p>

            <div data-register-row="fullName" hidden>
                <input name="fullName" value="" />
                <p data-error-for="fullName"></p>
            </div>

            <div data-register-row="phoneNumber" hidden>
                <input name="phoneNumber" value="" />
                <p data-error-for="phoneNumber"></p>
            </div>

            <section id="vendor-register-fields" hidden>
                <input name="businessName" value="" />
                <p data-error-for="businessName"></p>

                <input name="university" value="" />
                <p data-error-for="university"></p>

                <input name="location" value="" />
                <p data-error-for="location"></p>

                <select name="foodType">
                    <option value="">Select one</option>
                    <option value="fast-food">Fast food</option>
                </select>
                <p data-error-for="foodType"></p>

                <textarea name="description"></textarea>
                <p data-error-for="description"></p>
            </section>

            <section id="admin-register-fields" hidden>
                <input name="department" value="" />
                <p data-error-for="department"></p>

                <textarea name="motivation"></textarea>
                <p data-error-for="motivation"></p>
            </section>

            <button type="submit">Register</button>
        </form>

        <button id="google-signin" type="button">Continue with Google</button>
        <button id="apple-signin" type="button">Continue with Apple</button>

        <p id="register-status"></p>
    `;

    return {
        form: document.querySelector("#register-form"),
        statusElement: document.querySelector("#register-status"),
        googleButton: document.querySelector("#google-signin"),
        appleButton: document.querySelector("#apple-signin")
    };
}

describe("register.js helpers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("normalizeText trims whitespace and safely handles invalid input", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
        expect(normalizeText(null)).toBe("");
    });

    test("normalizeEmail trims and lowercases email", () => {
        expect(normalizeEmail("  USER@Example.COM  ")).toBe("user@example.com");
    });

    test("getFormField returns the requested field or null for invalid form", () => {
        const { form } = createRegisterFormDom();

        expect(getFormField(form, "email")).toBe(form.elements.namedItem("email"));
        expect(getFormField(form, "accountType")).toBe(form.elements.namedItem("accountType"));
        expect(getFormField(null, "email")).toBeNull();
    });

    test("extractRegisterFormValues reads all values from form and falls back safely", () => {
        const { form } = createRegisterFormDom();
        const fields = getRegisterFields(form);

        fields.email.value = "vendor@example.com";
        fields.password.value = "password123";
        fields.confirmPassword.value = "password123";
        fields.accountType.value = "vendor";
        fields.fullName.value = "Faranani Maduwa";
        fields.phoneNumber.value = "0712345678";
        fields.businessName.value = "Campus Bites";
        fields.university.value = "Wits University";
        fields.location.value = "Matrix Food Court";
        fields.foodType.value = "fast-food";
        fields.description.value = "Fresh campus meals every day for busy students.";

        expect(extractRegisterFormValues(form)).toEqual({
            email: "vendor@example.com",
            password: "password123",
            confirmPassword: "password123",
            accountType: "vendor",
            fullName: "Faranani Maduwa",
            phoneNumber: "0712345678",
            businessName: "Campus Bites",
            university: "Wits University",
            location: "Matrix Food Court",
            foodType: "fast-food",
            description: "Fresh campus meals every day for busy students.",
            department: "",
            motivation: ""
        });

        expect(extractRegisterFormValues(null)).toEqual({
            email: "",
            password: "",
            confirmPassword: "",
            accountType: "customer",
            fullName: "",
            phoneNumber: "",
            businessName: "",
            university: "",
            location: "",
            foodType: "",
            description: "",
            department: "",
            motivation: ""
        });
    });

    test("buildRegisterPayload normalizes values and defaults invalid input safely", () => {
        expect(
            buildRegisterPayload({
                email: "  USER@Example.COM ",
                password: "password123",
                confirmPassword: "password123",
                accountType: " Vendor ",
                fullName: "  Faranani Maduwa  ",
                phoneNumber: " 071 234 5678 ",
                businessName: " Campus Bites ",
                university: " Wits University ",
                location: " Matrix Food Court ",
                foodType: " Fast-Food ",
                description: " Fresh campus meals ",
                department: " Student Affairs ",
                motivation: " Help manage platform operations "
            })
        ).toEqual({
            email: "user@example.com",
            password: "password123",
            confirmPassword: "password123",
            accountType: "vendor",
            fullName: "Faranani Maduwa",
            phoneNumber: "071 234 5678",
            businessName: "Campus Bites",
            university: "Wits University",
            location: "Matrix Food Court",
            foodType: "fast-food",
            description: "Fresh campus meals",
            department: "Student Affairs",
            motivation: "Help manage platform operations"
        });

        expect(buildRegisterPayload({})).toEqual({
            email: "",
            password: "",
            confirmPassword: "",
            accountType: "customer",
            fullName: "",
            phoneNumber: "",
            businessName: "",
            university: "",
            location: "",
            foodType: "",
            description: "",
            department: "",
            motivation: ""
        });
    });

    test("role helper functions return expected values", () => {
        expect(isValidAccountType("customer")).toBe(true);
        expect(isValidAccountType("vendor")).toBe(true);
        expect(isValidAccountType("admin")).toBe(true);
        expect(isValidAccountType("unknown")).toBe(false);
        expect(requiresExtendedDetails("customer")).toBe(false);
        expect(requiresExtendedDetails("vendor")).toBe(true);
        expect(requiresExtendedDetails("admin")).toBe(true);
    });

    test("validateRegisterPayload accepts valid customer payload", () => {
        const result = validateRegisterPayload(
            {
                email: "faranani@example.com",
                password: "password123",
                confirmPassword: "password123",
                accountType: "customer",
                fullName: "",
                phoneNumber: "",
                businessName: "",
                university: "",
                location: "",
                foodType: "",
                description: "",
                department: "",
                motivation: ""
            },
            authUtils
        );

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual({});
    });

    test("validateRegisterPayload returns expected errors for bad customer payload", () => {
        const result = validateRegisterPayload(
            {
                email: "wrong-email",
                password: "123",
                confirmPassword: "456",
                accountType: "customer",
                fullName: "",
                phoneNumber: "",
                businessName: "",
                university: "",
                location: "",
                foodType: "",
                description: "",
                department: "",
                motivation: ""
            },
            authUtils
        );

        expect(result.isValid).toBe(false);
        expect(result.errors.email).toBe("Please enter a valid email address.");
        expect(result.errors.password).toBe("Password must be at least 8 characters long.");
        expect(result.errors.confirmPassword).toBe("Passwords do not match.");
    });

    test("validateRegisterPayload returns expected errors for bad vendor payload", () => {
        const result = validateRegisterPayload(
            {
                email: "vendor@example.com",
                password: "password123",
                confirmPassword: "password123",
                accountType: "vendor",
                fullName: "",
                phoneNumber: "123",
                businessName: "",
                university: "",
                location: "",
                foodType: "",
                description: "short",
                department: "",
                motivation: ""
            },
            authUtils
        );

        expect(result.isValid).toBe(false);
        expect(result.errors.fullName).toBe("Full name is required for vendor registration.");
        expect(result.errors.phoneNumber).toBe("Please enter a valid phone number.");
        expect(result.errors.businessName).toBe("Business name is required.");
        expect(result.errors.university).toBe("Campus or university is required.");
        expect(result.errors.location).toBe("Vendor location is required.");
        expect(result.errors.foodType).toBe("Please choose a food category.");
        expect(result.errors.description).toBe("Please provide a longer business description.");
    });

    test("validateRegisterPayload returns expected errors for bad admin and invalid account payloads", () => {
        const adminResult = validateRegisterPayload(
            {
                email: "admin@example.com",
                password: "password123",
                confirmPassword: "password123",
                accountType: "admin",
                fullName: "",
                phoneNumber: "123",
                businessName: "",
                university: "",
                location: "",
                foodType: "",
                description: "",
                department: "",
                motivation: "short"
            },
            authUtils
        );

        expect(adminResult.isValid).toBe(false);
        expect(adminResult.errors.fullName).toBe("Full name is required for admin registration.");
        expect(adminResult.errors.phoneNumber).toBe("Please enter a valid phone number.");
        expect(adminResult.errors.department).toBe("Department or office is required.");
        expect(adminResult.errors.motivation).toBe(
            "Please provide a longer reason for requesting admin access."
        );

        const invalidTypeResult = validateRegisterPayload(
            {
                email: "user@example.com",
                password: "password123",
                confirmPassword: "password123",
                accountType: "moderator",
                fullName: "",
                phoneNumber: "",
                businessName: "",
                university: "",
                location: "",
                foodType: "",
                description: "",
                department: "",
                motivation: ""
            },
            authUtils
        );

        expect(invalidTypeResult.errors.accountType).toBe("Please choose a valid account type.");
    });

    test("validateRegisterPayload throws when authUtils is missing", () => {
        expect(() =>
            validateRegisterPayload(
                {
                    email: "faranani@example.com",
                    password: "password123",
                    confirmPassword: "password123",
                    accountType: "customer"
                },
                null
            )
        ).toThrow("authUtils is required.");
    });

    test("field/status helper functions handle normal and missing cases", () => {
        const { form, statusElement } = createRegisterFormDom();

        form.querySelector('[data-error-for="email"]').textContent = "Invalid";
        form.querySelector('[data-error-for="businessName"]').textContent = "Required";
        clearFieldErrors(form);
        expect(form.querySelector('[data-error-for="email"]').textContent).toBe("");

        showFieldErrors(form, {
            email: "Please enter a valid email address.",
            department: "Department or office is required."
        });
        expect(form.querySelector('[data-error-for="department"]').textContent).toBe(
            "Department or office is required."
        );
        expect(() => showFieldErrors(null, { email: "Bad email" })).not.toThrow();
        expect(() => showFieldErrors(form, null)).not.toThrow();

        setStatusMessage(statusElement, "Registration successful.", "success");
        expect(statusElement.textContent).toBe("Registration successful.");
        expect(statusElement.dataset.state).toBe("success");
        expect(() => setStatusMessage(null, "Hello", "success")).not.toThrow();

        setSubmittingState(form, true);
        expect(form.querySelector('button[type="submit"]').disabled).toBe(true);
        expect(form.dataset.submitting).toBe("true");
        setSubmittingState(form, false);
        expect(form.querySelector('button[type="submit"]').disabled).toBe(false);
        expect(form.dataset.submitting).toBe("false");
        expect(() => setSubmittingState(null, true)).not.toThrow();
    });

    test("setElementHidden updates hidden and aria-hidden state and ignores missing elements", () => {
        const element = document.createElement("section");

        setElementHidden(element, true);
        expect(element.hidden).toBe(true);
        expect(element.getAttribute("aria-hidden")).toBe("true");

        setElementHidden(element, false);
        expect(element.hidden).toBe(false);
        expect(element.getAttribute("aria-hidden")).toBe("false");

        expect(() => setElementHidden(null, true)).not.toThrow();
    });

    test("getSuccessMessage returns role-aware messages", () => {
        expect(getSuccessMessage("customer")).toBe("Registration successful.");
        expect(getSuccessMessage("vendor")).toBe(
            "Registration successful. Your vendor application is awaiting approval."
        );
        expect(getSuccessMessage("admin")).toBe(
            "Registration successful. Your admin application is awaiting approval."
        );
        expect(getSuccessMessage("other")).toBe("Registration successful.");
    });
});

describe("register.js service submission", () => {
    test("submitRegistration calls authService.registerWithEmail with full payload", async () => {
        const authService = {
            registerWithEmail: jest.fn().mockResolvedValue({
                success: true,
                nextRoute: "../customer/index.html"
            })
        };

        const payload = {
            email: "vendor@example.com",
            password: "password123",
            confirmPassword: "password123",
            accountType: "vendor",
            fullName: "Faranani Maduwa",
            phoneNumber: "0712345678",
            businessName: "Campus Bites",
            university: "Wits University",
            location: "Matrix Food Court",
            foodType: "fast-food",
            description: "Fresh campus meals every day for busy students.",
            department: "",
            motivation: ""
        };

        const result = await submitRegistration(payload, { authService });

        expect(authService.registerWithEmail).toHaveBeenCalledWith({
            email: "vendor@example.com",
            password: "password123",
            displayName: "Faranani Maduwa",
            accountType: "vendor",
            phoneNumber: "0712345678",
            businessName: "Campus Bites",
            university: "Wits University",
            location: "Matrix Food Court",
            foodType: "fast-food",
            description: "Fresh campus meals every day for busy students.",
            department: "",
            motivation: ""
        });
        expect(result.success).toBe(true);
    });

    test("submitRegistration and OAuth submission helpers validate required auth service methods", async () => {
        await expect(submitRegistration({}, {})).rejects.toThrow(
            "authService.registerWithEmail is required."
        );
        await expect(submitGoogleRegistration({})).rejects.toThrow(
            "authService.loginWithGoogle is required."
        );
        await expect(submitAppleRegistration({})).rejects.toThrow(
            "authService.loginWithApple is required."
        );
    });

    test("submitGoogleRegistration and submitAppleRegistration call auth service methods", async () => {
        const authService = {
            loginWithGoogle: jest.fn().mockResolvedValue({ success: true }),
            loginWithApple: jest.fn().mockResolvedValue({ success: true })
        };

        await expect(submitGoogleRegistration({ authService })).resolves.toEqual({ success: true });
        await expect(submitAppleRegistration({ authService })).resolves.toEqual({ success: true });
        expect(authService.loginWithGoogle).toHaveBeenCalledTimes(1);
        expect(authService.loginWithApple).toHaveBeenCalledTimes(1);
    });
});

describe("register.js form submission flow", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("attachRegisterHandler shows validation errors for invalid customer input", async () => {
        const { form, statusElement } = createRegisterFormDom();
        const fields = getRegisterFields(form);

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

        fields.email.value = "customer@example.com";
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
        const onSuccess = jest.fn();

        const { handleSubmit } = attachRegisterHandler({
            form,
            statusElement,
            authService,
            authUtils,
            navigate,
            onSuccess
        });

        const result = await handleSubmit({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(true);
        expect(statusElement.textContent).toBe("Registration successful.");
        expect(statusElement.dataset.state).toBe("success");
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
        expect(form.dataset.submitting).toBe("false");
    });

    test("attachRegisterHandler registers a vendor and shows pending message", async () => {
        const { form, statusElement } = createRegisterFormDom();
        const fields = getRegisterFields(form);

        fields.email.value = "vendor@example.com";
        fields.password.value = "password123";
        fields.confirmPassword.value = "password123";
        fields.accountType.value = "vendor";
        fields.fullName.value = "Vendor User";
        fields.phoneNumber.value = "0712345678";
        fields.businessName.value = "Campus Bites";
        fields.university.value = "Wits University";
        fields.location.value = "Matrix Food Court";
        fields.foodType.value = "fast-food";
        fields.description.value = "Fresh food for students every day on campus.";

        const authService = {
            registerWithEmail: jest.fn().mockResolvedValue({
                success: true,
                profile: {
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
    });

    test("attachRegisterHandler registers an admin and shows pending message", async () => {
        const { form, statusElement } = createRegisterFormDom();
        const fields = getRegisterFields(form);

        fields.email.value = "admin@example.com";
        fields.password.value = "password123";
        fields.confirmPassword.value = "password123";
        fields.accountType.value = "admin";
        fields.fullName.value = "Admin User";
        fields.phoneNumber.value = "0712345678";
        fields.department.value = "Student Affairs";
        fields.motivation.value = "I need access to help manage platform operations and users.";

        const authService = {
            registerWithEmail: jest.fn().mockResolvedValue({
                success: true,
                profile: {
                    adminApplicationStatus: "pending"
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
            "Registration successful. Your admin application is awaiting approval."
        );
        expect(statusElement.dataset.state).toBe("success");
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
    });

    test("attachRegisterHandler shows service error message and onError callback", async () => {
        const { form, statusElement } = createRegisterFormDom();
        const fields = getRegisterFields(form);

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
    });

    test("attachRegisterHandler handles thrown errors with explicit and fallback messages", async () => {
        const { form, statusElement } = createRegisterFormDom();
        const fields = getRegisterFields(form);

        fields.email.value = "customer@example.com";
        fields.password.value = "password123";
        fields.confirmPassword.value = "password123";
        fields.accountType.value = "customer";

        let authService = {
            registerWithEmail: jest.fn().mockRejectedValue(new Error("Unexpected failure"))
        };
        let onError = jest.fn();

        let handler = attachRegisterHandler({
            form,
            statusElement,
            authService,
            authUtils,
            onError
        });

        let result = await handler.handleSubmit({
            preventDefault: jest.fn()
        });

        expect(result).toEqual({
            success: false,
            message: "Unexpected failure"
        });
        expect(statusElement.textContent).toBe("Unexpected failure");
        expect(onError).toHaveBeenCalledTimes(1);

        authService = {
            registerWithEmail: jest.fn().mockRejectedValue({})
        };
        onError = jest.fn();

        handler = attachRegisterHandler({
            form,
            statusElement,
            authService,
            authUtils,
            onError
        });

        result = await handler.handleSubmit({
            preventDefault: jest.fn()
        });

        expect(result).toEqual({
            success: false,
            message: "Unable to register right now. Please try again."
        });
        expect(statusElement.textContent).toBe("Unable to register right now. Please try again.");
        expect(onError).toHaveBeenCalledTimes(1);
    });

    test("attachRegisterHandler validates required options", () => {
        expect(() => attachRegisterHandler({ form: null, authService: {}, authUtils })).toThrow(
            "A registration form is required."
        );

        const { form } = createRegisterFormDom();
        expect(() => attachRegisterHandler({ form, authService: {} })).toThrow(
            "authUtils is required."
        );
    });
});

describe("register.js auth result helpers and OAuth flow", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("handleAuthSuccess updates status, invokes callbacks, and navigates when available", () => {
        const { statusElement } = createRegisterFormDom();
        const onSuccess = jest.fn();
        const navigate = jest.fn();
        const result = {
            success: true,
            nextRoute: "../customer/index.html"
        };

        expect(
            handleAuthSuccess(result, {
                statusElement,
                successMessage: "Done",
                onSuccess,
                navigate
            })
        ).toBe(result);

        expect(statusElement.textContent).toBe("Done");
        expect(statusElement.dataset.state).toBe("success");
        expect(onSuccess).toHaveBeenCalledWith(result);
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");

        expect(
            handleAuthSuccess(result, {
                statusElement
            })
        ).toBe(result);
    });

    test("handleAuthFailure uses result and fallback messages and invokes onError", () => {
        const { statusElement } = createRegisterFormDom();
        const onError = jest.fn();

        expect(
            handleAuthFailure(
                {
                    success: false,
                    message: "Specific failure"
                },
                {
                    statusElement,
                    fallbackMessage: "Fallback failure",
                    onError
                }
            )
        ).toEqual({
            success: false,
            message: "Specific failure"
        });
        expect(statusElement.textContent).toBe("Specific failure");
        expect(onError).toHaveBeenCalledTimes(1);

        expect(
            handleAuthFailure(
                {
                    success: false
                },
                {
                    statusElement,
                    fallbackMessage: "Fallback failure"
                }
            )
        ).toEqual({
            success: false
        });
        expect(statusElement.textContent).toBe("Fallback failure");
    });

    test("attachOAuthHandler succeeds, fails, and handles thrown errors", async () => {
        const { statusElement, googleButton } = createRegisterFormDom();
        const navigate = jest.fn();
        const onSuccess = jest.fn();
        const onError = jest.fn();

        let controller = attachOAuthHandler({
            button: googleButton,
            statusElement,
            loginMethod: jest.fn().mockResolvedValue({
                success: true,
                nextRoute: "../customer/index.html"
            }),
            onSuccess,
            navigate
        });

        let result = await controller.handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(true);
        expect(statusElement.textContent).toBe("Registration successful.");
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");

        controller = attachOAuthHandler({
            button: googleButton,
            statusElement,
            loginMethod: jest.fn().mockResolvedValue({
                success: false,
                message: "OAuth failed"
            }),
            onError
        });

        result = await controller.handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(statusElement.textContent).toBe("OAuth failed");
        expect(onError).toHaveBeenCalled();

        controller = attachOAuthHandler({
            button: googleButton,
            statusElement,
            loginMethod: jest.fn().mockRejectedValue({})
        });

        result = await controller.handleClick({
            preventDefault: jest.fn()
        });

        expect(result).toEqual({
            success: false,
            message: "Unable to complete registration right now. Please try again."
        });
    });

    test("attachOAuthHandler validates required options", () => {
        expect(() => attachOAuthHandler({ button: null, loginMethod: jest.fn() })).toThrow(
            "An OAuth button is required."
        );
        expect(() => attachOAuthHandler({ button: document.createElement("button") })).toThrow(
            "A loginMethod function is required."
        );
    });
});

describe("register.js role section toggling", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("toggleRegistrationRoleSections shows customer minimal form", () => {
        createRegisterFormDom();

        const vendorSection = document.querySelector("#vendor-register-fields");
        const adminSection = document.querySelector("#admin-register-fields");
        const detailsHint = document.querySelector("#register-role-hint");
        const fullNameRow = document.querySelector("[data-register-row='fullName']");
        const phoneNumberRow = document.querySelector("[data-register-row='phoneNumber']");

        toggleRegistrationRoleSections({
            accountType: "customer",
            vendorSection,
            adminSection,
            detailsHint,
            fullNameRow,
            phoneNumberRow
        });

        expect(vendorSection.hidden).toBe(true);
        expect(adminSection.hidden).toBe(true);
        expect(fullNameRow.hidden).toBe(true);
        expect(phoneNumberRow.hidden).toBe(true);
        expect(detailsHint.textContent).toBe(
            "Customer registration only needs your email and password."
        );
    });

    test("toggleRegistrationRoleSections shows vendor and admin forms and handles missing elements", () => {
        createRegisterFormDom();

        const vendorSection = document.querySelector("#vendor-register-fields");
        const adminSection = document.querySelector("#admin-register-fields");
        const detailsHint = document.querySelector("#register-role-hint");
        const fullNameRow = document.querySelector("[data-register-row='fullName']");
        const phoneNumberRow = document.querySelector("[data-register-row='phoneNumber']");

        toggleRegistrationRoleSections({
            accountType: "vendor",
            vendorSection,
            adminSection,
            detailsHint,
            fullNameRow,
            phoneNumberRow
        });

        expect(vendorSection.hidden).toBe(false);
        expect(adminSection.hidden).toBe(true);
        expect(fullNameRow.hidden).toBe(false);
        expect(phoneNumberRow.hidden).toBe(false);
        expect(detailsHint.textContent).toContain("Vendor registration");

        toggleRegistrationRoleSections({
            accountType: "admin",
            vendorSection,
            adminSection,
            detailsHint,
            fullNameRow,
            phoneNumberRow
        });

        expect(vendorSection.hidden).toBe(true);
        expect(adminSection.hidden).toBe(false);
        expect(detailsHint.textContent).toContain("Admin registration");

        expect(() =>
            toggleRegistrationRoleSections({
                accountType: "customer"
            })
        ).not.toThrow();
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

    test("initializeRegisterPage wires register and OAuth controllers", () => {
        createRegisterFormDom();

        const authService = {
            registerWithEmail: jest.fn(),
            loginWithGoogle: jest.fn(),
            loginWithApple: jest.fn()
        };

        const result = initializeRegisterPage({
            authService,
            authUtils,
            navigate: jest.fn()
        });

        expect(result.registerController).toBeTruthy();
        expect(result.googleController).toBeTruthy();
        expect(result.appleController).toBeTruthy();
    });

    test("initializeRegisterPage toggles sections when account type changes", () => {
        const { form } = createRegisterFormDom();
        const fields = getRegisterFields(form);

        const authService = {
            registerWithEmail: jest.fn(),
            loginWithGoogle: jest.fn(),
            loginWithApple: jest.fn()
        };

        initializeRegisterPage({
            authService,
            authUtils
        });

        const vendorSection = document.querySelector("#vendor-register-fields");
        const adminSection = document.querySelector("#admin-register-fields");

        expect(vendorSection.hidden).toBe(true);
        expect(adminSection.hidden).toBe(true);

        fields.accountType.value = "admin";
        fields.accountType.dispatchEvent(new Event("change"));

        expect(vendorSection.hidden).toBe(true);
        expect(adminSection.hidden).toBe(false);
    });

    test("initializeRegisterPage supports custom selectors and missing OAuth buttons", () => {
        document.body.innerHTML = `
            <form id="custom-form">
                <input name="email" value="" />
                <p data-error-for="email"></p>
                <input name="password" value="" />
                <p data-error-for="password"></p>
                <input name="confirmPassword" value="" />
                <p data-error-for="confirmPassword"></p>
                <select name="accountType">
                    <option value="customer">Customer</option>
                </select>
                <p data-error-for="accountType"></p>
                <button type="submit">Register</button>
            </form>
            <p id="custom-status"></p>
        `;

        const authService = {
            registerWithEmail: jest.fn()
        };

        const result = initializeRegisterPage({
            formSelector: "#custom-form",
            statusSelector: "#custom-status",
            googleButtonSelector: "#missing-google",
            appleButtonSelector: "#missing-apple",
            authService,
            authUtils
        });

        expect(result.registerController).toBeTruthy();
        expect(result.googleController).toBeNull();
        expect(result.appleController).toBeNull();
    });

    test("initializeRegisterPage throws for missing form, authService, or authUtils", () => {
        document.body.innerHTML = `<p id="register-status"></p>`;

        expect(() => initializeRegisterPage({ authService: {}, authUtils })).toThrow(
            "Register form not found."
        );

        createRegisterFormDom();

        expect(() => initializeRegisterPage({ authUtils })).toThrow("authService is required.");

        const savedAuthUtils = window.authUtils;
        delete window.authUtils;

        try {
            expect(() => initializeRegisterPage({ authService: {} })).toThrow(
                "authUtils is required."
            );
        } finally {
            window.authUtils = savedAuthUtils;
        }
    });
});
