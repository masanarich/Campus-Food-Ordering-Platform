const {
    normalizeText,
    normalizeEmail,
    getFormField,
    extractLoginFormValues,
    buildLoginPayload,
    validateLoginPayload,
    clearFieldErrors,
    showFieldErrors,
    setStatusMessage,
    setSubmittingState,
    submitEmailLogin,
    submitGoogleLogin,
    submitAppleLogin,
    handleAuthSuccess,
    handleAuthFailure,
    attachLoginHandler,
    attachOAuthHandler
} = require("../../public/authentication/login.js");

const authUtils = require("../../public/authentication/auth-utils.js");

function getLoginFields(form) {
    return {
        email: form.elements.namedItem("email"),
        password: form.elements.namedItem("password")
    };
}

function createLoginFormDom() {
    document.body.innerHTML = `
    <form id="login-form">
      <input name="email" value="" />
      <p data-error-for="email"></p>

      <input name="password" value="" />
      <p data-error-for="password"></p>

      <button type="submit">Login</button>
    </form>

    <button id="google-signin" type="button">Continue with Google</button>
    <button id="apple-signin" type="button">Continue with Apple</button>

    <p id="login-status"></p>
  `;

    const form = document.querySelector("#login-form");

    return {
        form,
        statusElement: document.querySelector("#login-status"),
        googleButton: document.querySelector("#google-signin"),
        appleButton: document.querySelector("#apple-signin")
    };
}

describe("login.js helpers", () => {
    test("normalizeText trims whitespace", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
    });

    test("normalizeEmail trims and lowercases email", () => {
        expect(normalizeEmail("  USER@Example.COM  ")).toBe("user@example.com");
    });

    test("getFormField returns the requested field", () => {
        const { form } = createLoginFormDom();

        expect(getFormField(form, "email")).toBe(form.elements.namedItem("email"));
        expect(getFormField(form, "password")).toBe(form.elements.namedItem("password"));
    });

    test("extractLoginFormValues reads values from form", () => {
        const { form } = createLoginFormDom();
        const fields = getLoginFields(form);

        fields.email.value = "user@example.com";
        fields.password.value = "password123";

        const result = extractLoginFormValues(form);

        expect(result).toEqual({
            email: "user@example.com",
            password: "password123"
        });
    });

    test("buildLoginPayload normalizes raw values", () => {
        const result = buildLoginPayload({
            email: "  USER@Example.COM ",
            password: "password123"
        });

        expect(result).toEqual({
            email: "user@example.com",
            password: "password123"
        });
    });

    test("validateLoginPayload accepts valid payload", () => {
        const result = validateLoginPayload(
            {
                email: "user@example.com",
                password: "password123"
            },
            authUtils
        );

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual({});
    });

    test("validateLoginPayload returns errors for bad payload", () => {
        const result = validateLoginPayload(
            {
                email: "bad-email",
                password: ""
            },
            authUtils
        );

        expect(result.isValid).toBe(false);
        expect(result.errors.email).toBe("Please enter a valid email address.");
        expect(result.errors.password).toBe("Password is required.");
    });

    test("clearFieldErrors clears visible field errors", () => {
        const { form } = createLoginFormDom();

        form.querySelector('[data-error-for="email"]').textContent = "Invalid";
        form.querySelector('[data-error-for="password"]').textContent = "Required";

        clearFieldErrors(form);

        expect(form.querySelector('[data-error-for="email"]').textContent).toBe("");
        expect(form.querySelector('[data-error-for="password"]').textContent).toBe("");
    });

    test("showFieldErrors sets field errors", () => {
        const { form } = createLoginFormDom();

        showFieldErrors(form, {
            email: "Please enter a valid email address.",
            password: "Password is required."
        });

        expect(form.querySelector('[data-error-for="email"]').textContent).toBe(
            "Please enter a valid email address."
        );
        expect(form.querySelector('[data-error-for="password"]').textContent).toBe(
            "Password is required."
        );
    });

    test("setStatusMessage updates text and state", () => {
        const { statusElement } = createLoginFormDom();

        setStatusMessage(statusElement, "Login successful.", "success");

        expect(statusElement.textContent).toBe("Login successful.");
        expect(statusElement.dataset.state).toBe("success");
    });

    test("setSubmittingState disables submit button when submitting", () => {
        const { form } = createLoginFormDom();

        setSubmittingState(form, true);

        expect(form.querySelector('button[type="submit"]').disabled).toBe(true);
        expect(form.dataset.submitting).toBe("true");
    });

    test("setSubmittingState enables submit button when not submitting", () => {
        const { form } = createLoginFormDom();

        setSubmittingState(form, false);

        expect(form.querySelector('button[type="submit"]').disabled).toBe(false);
        expect(form.dataset.submitting).toBe("false");
    });
});

describe("login.js service submission", () => {
    test("submitEmailLogin calls authService.loginWithEmail", async () => {
        const authService = {
            loginWithEmail: jest.fn().mockResolvedValue({
                success: true,
                nextRoute: "../customer/index.html"
            })
        };

        const result = await submitEmailLogin(
            {
                email: "user@example.com",
                password: "password123"
            },
            { authService }
        );

        expect(authService.loginWithEmail).toHaveBeenCalledWith({
            email: "user@example.com",
            password: "password123"
        });
        expect(result.success).toBe(true);
    });

    test("submitGoogleLogin calls authService.loginWithGoogle", async () => {
        const authService = {
            loginWithGoogle: jest.fn().mockResolvedValue({
                success: true,
                nextRoute: "../customer/index.html"
            })
        };

        const result = await submitGoogleLogin({ authService });

        expect(authService.loginWithGoogle).toHaveBeenCalledTimes(1);
        expect(result.success).toBe(true);
    });

    test("submitAppleLogin calls authService.loginWithApple", async () => {
        const authService = {
            loginWithApple: jest.fn().mockResolvedValue({
                success: true,
                nextRoute: "../customer/index.html"
            })
        };

        const result = await submitAppleLogin({ authService });

        expect(authService.loginWithApple).toHaveBeenCalledTimes(1);
        expect(result.success).toBe(true);
    });

    test("submitEmailLogin throws when authService is missing", async () => {
        await expect(
            submitEmailLogin(
                {
                    email: "user@example.com",
                    password: "password123"
                },
                {}
            )
        ).rejects.toThrow("authService.loginWithEmail is required.");
    });
});

describe("login.js auth result handlers", () => {
    test("handleAuthSuccess sets success message and navigates", () => {
        const { statusElement } = createLoginFormDom();
        const onSuccess = jest.fn();
        const navigate = jest.fn();

        const result = handleAuthSuccess(
            {
                success: true,
                nextRoute: "../customer/index.html"
            },
            {
                statusElement,
                onSuccess,
                navigate
            }
        );

        expect(statusElement.textContent).toBe("Login successful.");
        expect(statusElement.dataset.state).toBe("success");
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
        expect(result.success).toBe(true);
    });

    test("handleAuthFailure sets error message", () => {
        const { statusElement } = createLoginFormDom();
        const onError = jest.fn();

        const result = handleAuthFailure(
            {
                success: false,
                message: "Incorrect email or password."
            },
            {
                statusElement,
                onError
            }
        );

        expect(statusElement.textContent).toBe("Incorrect email or password.");
        expect(statusElement.dataset.state).toBe("error");
        expect(onError).toHaveBeenCalledTimes(1);
        expect(result.success).toBe(false);
    });
});

describe("login.js form submission flow", () => {
    test("attachLoginHandler shows validation errors for invalid input", async () => {
        const { form, statusElement } = createLoginFormDom();
        const fields = getLoginFields(form);

        fields.email.value = "bad-email";
        fields.password.value = "";

        const authService = {
            loginWithEmail: jest.fn()
        };

        const { handleSubmit } = attachLoginHandler({
            form,
            statusElement,
            authService,
            authUtils
        });

        const result = await handleSubmit({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(authService.loginWithEmail).not.toHaveBeenCalled();
        expect(form.querySelector('[data-error-for="email"]').textContent).toBe(
            "Please enter a valid email address."
        );
        expect(form.querySelector('[data-error-for="password"]').textContent).toBe(
            "Password is required."
        );
        expect(statusElement.textContent).toBe("Please fix the highlighted fields.");
        expect(statusElement.dataset.state).toBe("error");
    });

    test("attachLoginHandler logs in successfully", async () => {
        const { form, statusElement } = createLoginFormDom();
        const fields = getLoginFields(form);

        fields.email.value = "user@example.com";
        fields.password.value = "password123";

        const authService = {
            loginWithEmail: jest.fn().mockResolvedValue({
                success: true,
                nextRoute: "../customer/index.html"
            })
        };

        const onSuccess = jest.fn();
        const navigate = jest.fn();

        const { handleSubmit } = attachLoginHandler({
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
        expect(authService.loginWithEmail).toHaveBeenCalledTimes(1);
        expect(statusElement.textContent).toBe("Login successful.");
        expect(statusElement.dataset.state).toBe("success");
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
    });

    test("attachLoginHandler shows service error message on failed login", async () => {
        const { form, statusElement } = createLoginFormDom();
        const fields = getLoginFields(form);

        fields.email.value = "user@example.com";
        fields.password.value = "wrongpass";

        const authService = {
            loginWithEmail: jest.fn().mockResolvedValue({
                success: false,
                message: "Incorrect email or password."
            })
        };

        const onError = jest.fn();

        const { handleSubmit } = attachLoginHandler({
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
        expect(statusElement.textContent).toBe("Incorrect email or password.");
        expect(statusElement.dataset.state).toBe("error");
        expect(onError).toHaveBeenCalledTimes(1);
    });

    test("attachLoginHandler handles thrown errors", async () => {
        const { form, statusElement } = createLoginFormDom();
        const fields = getLoginFields(form);

        fields.email.value = "user@example.com";
        fields.password.value = "password123";

        const authService = {
            loginWithEmail: jest.fn().mockRejectedValue(new Error("Unexpected failure"))
        };

        const { handleSubmit } = attachLoginHandler({
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

describe("login.js OAuth handlers", () => {
    test("attachOAuthHandler handles Google-style successful login", async () => {
        const { statusElement, googleButton } = createLoginFormDom();

        const loginMethod = jest.fn().mockResolvedValue({
            success: true,
            nextRoute: "../vendor/index.html"
        });

        const onSuccess = jest.fn();
        const navigate = jest.fn();

        const { handleClick } = attachOAuthHandler({
            button: googleButton,
            statusElement,
            loginMethod,
            onSuccess,
            navigate
        });

        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(true);
        expect(loginMethod).toHaveBeenCalledTimes(1);
        expect(statusElement.textContent).toBe("Login successful.");
        expect(statusElement.dataset.state).toBe("success");
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith("../vendor/index.html");
        expect(googleButton.disabled).toBe(false);
    });

    test("attachOAuthHandler handles failed login result", async () => {
        const { statusElement, googleButton } = createLoginFormDom();

        const loginMethod = jest.fn().mockResolvedValue({
            success: false,
            message: "The sign-in popup was closed before completing sign-in."
        });

        const onError = jest.fn();

        const { handleClick } = attachOAuthHandler({
            button: googleButton,
            statusElement,
            loginMethod,
            onError
        });

        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(statusElement.textContent).toBe(
            "The sign-in popup was closed before completing sign-in."
        );
        expect(statusElement.dataset.state).toBe("error");
        expect(onError).toHaveBeenCalledTimes(1);
        expect(googleButton.disabled).toBe(false);
    });

    test("attachOAuthHandler handles thrown errors", async () => {
        const { statusElement, appleButton } = createLoginFormDom();

        const loginMethod = jest.fn().mockRejectedValue(new Error("Unexpected OAuth failure"));

        const { handleClick } = attachOAuthHandler({
            button: appleButton,
            statusElement,
            loginMethod
        });

        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Unexpected OAuth failure");
        expect(statusElement.textContent).toBe("Unexpected OAuth failure");
        expect(statusElement.dataset.state).toBe("error");
        expect(appleButton.disabled).toBe(false);
    });

    test("attachOAuthHandler throws if button is missing", () => {
        expect(() =>
            attachOAuthHandler({
                button: null,
                statusElement: null,
                loginMethod: jest.fn()
            })
        ).toThrow("An OAuth button is required.");
    });

    test("attachOAuthHandler throws if loginMethod is missing", () => {
        const { googleButton } = createLoginFormDom();

        expect(() =>
            attachOAuthHandler({
                button: googleButton,
                statusElement: null
            })
        ).toThrow("A loginMethod function is required.");
    });
});