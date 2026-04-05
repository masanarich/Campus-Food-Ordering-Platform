const {
    normalizeText,
    normalizeEmail,
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
    attachRegisterHandler
} = require("../../public/authentication/register.js");

const authUtils = require("../../public/authentication/auth-utils.js");

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
    test("normalizeText trims whitespace", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
    });

    test("normalizeEmail trims and lowercases email", () => {
        expect(normalizeEmail("  USER@Example.COM  ")).toBe("user@example.com");
    });

    test("extractRegisterFormValues reads values from form", () => {
        const { form } = createRegisterFormDom();

        form.fullName.value = "Faranani Maduwa";
        form.email.value = "faranani@example.com";
        form.password.value = "password123";
        form.confirmPassword.value = "password123";
        form.accountType.value = "vendor";

        const result = extractRegisterFormValues(form);

        expect(result).toEqual({
            fullName: "Faranani Maduwa",
            email: "faranani@example.com",
            password: "password123",
            confirmPassword: "password123",
            accountType: "vendor"
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

    test("clearFieldErrors clears all visible field errors", () => {
        const { form } = createRegisterFormDom();

        form.querySelector('[data-error-for="fullName"]').textContent = "Required";
        form.querySelector('[data-error-for="email"]').textContent = "Invalid";

        clearFieldErrors(form);

        expect(form.querySelector('[data-error-for="fullName"]').textContent).toBe("");
        expect(form.querySelector('[data-error-for="email"]').textContent).toBe("");
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

    test("setStatusMessage updates text and state", () => {
        const { statusElement } = createRegisterFormDom();

        setStatusMessage(statusElement, "Registration successful.", "success");

        expect(statusElement.textContent).toBe("Registration successful.");
        expect(statusElement.dataset.state).toBe("success");
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

    test("getSuccessMessage returns customer success message", () => {
        expect(getSuccessMessage("customer")).toBe("Registration successful.");
    });

    test("getSuccessMessage returns vendor pending message", () => {
        expect(getSuccessMessage("vendor")).toBe(
            "Registration successful. Your vendor application is awaiting approval."
        );
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
    test("attachRegisterHandler shows validation errors for invalid input", async () => {
        const { form, statusElement } = createRegisterFormDom();

        form.fullName.value = "";
        form.email.value = "bad-email";
        form.password.value = "123";
        form.confirmPassword.value = "456";
        form.accountType.value = "admin";

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
        expect(statusElement.textContent).toBe("Please fix the highlighted fields.");
        expect(statusElement.dataset.state).toBe("error");
    });

    test("attachRegisterHandler registers a customer successfully", async () => {
        const { form, statusElement } = createRegisterFormDom();

        form.fullName.value = "Faranani Maduwa";
        form.email.value = "faranani@example.com";
        form.password.value = "password123";
        form.confirmPassword.value = "password123";
        form.accountType.value = "customer";

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
    });

    test("attachRegisterHandler registers a vendor and shows pending message", async () => {
        const { form, statusElement } = createRegisterFormDom();

        form.fullName.value = "Vendor User";
        form.email.value = "vendor@example.com";
        form.password.value = "password123";
        form.confirmPassword.value = "password123";
        form.accountType.value = "vendor";

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
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
    });

    test("attachRegisterHandler shows service error message on failed registration", async () => {
        const { form, statusElement } = createRegisterFormDom();

        form.fullName.value = "Taken User";
        form.email.value = "taken@example.com";
        form.password.value = "password123";
        form.confirmPassword.value = "password123";
        form.accountType.value = "customer";

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

    test("attachRegisterHandler handles unexpected thrown errors", async () => {
        const { form, statusElement } = createRegisterFormDom();

        form.fullName.value = "Faranani Maduwa";
        form.email.value = "faranani@example.com";
        form.password.value = "password123";
        form.confirmPassword.value = "password123";
        form.accountType.value = "customer";

        const authService = {
            registerWithEmail: jest.fn().mockRejectedValue(new Error("Unexpected failure"))
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
        expect(result.message).toBe("Unexpected failure");
        expect(statusElement.textContent).toBe("Unexpected failure");
        expect(statusElement.dataset.state).toBe("error");
    });
});