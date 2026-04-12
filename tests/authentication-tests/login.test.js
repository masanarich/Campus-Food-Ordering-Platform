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
    attachOAuthHandler,
    initializeLoginPage
} = loadModule("../../public/authentication/login.js", {
    document,
    window
});

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
        const { form } = createLoginFormDom();

        expect(getFormField(form, "email")).toBe(form.elements.namedItem("email"));
        expect(getFormField(form, "password")).toBe(form.elements.namedItem("password"));
    });

    test("getFormField returns null for invalid form", () => {
        expect(getFormField(null, "email")).toBeNull();
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

    test("extractLoginFormValues falls back to empty strings", () => {
        expect(extractLoginFormValues(null)).toEqual({
            email: "",
            password: ""
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

    test("buildLoginPayload falls back to empty password", () => {
        const result = buildLoginPayload({
            email: "user@example.com",
            password: null
        });

        expect(result).toEqual({
            email: "user@example.com",
            password: ""
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

    test("validateLoginPayload throws when authUtils is missing", () => {
        expect(() =>
            validateLoginPayload(
                {
                    email: "user@example.com",
                    password: "password123"
                },
                null
            )
        ).toThrow("authUtils is required.");
    });

    test("clearFieldErrors clears visible field errors", () => {
        const { form } = createLoginFormDom();

        form.querySelector('[data-error-for="email"]').textContent = "Invalid";
        form.querySelector('[data-error-for="password"]').textContent = "Required";

        clearFieldErrors(form);

        expect(form.querySelector('[data-error-for="email"]').textContent).toBe("");
        expect(form.querySelector('[data-error-for="password"]').textContent).toBe("");
    });

    test("clearFieldErrors does nothing for missing form", () => {
        expect(() => clearFieldErrors(null)).not.toThrow();
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

    test("showFieldErrors does nothing when form is missing", () => {
        expect(() =>
            showFieldErrors(null, {
                email: "Bad email"
            })
        ).not.toThrow();
    });

    test("setStatusMessage updates text and state", () => {
        const { statusElement } = createLoginFormDom();

        setStatusMessage(statusElement, "Login successful.", "success");

        expect(statusElement.textContent).toBe("Login successful.");
        expect(statusElement.dataset.state).toBe("success");
    });

    test("setStatusMessage does nothing when element is missing", () => {
        expect(() => setStatusMessage(null, "Hello", "success")).not.toThrow();
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

    test("setSubmittingState does nothing when form is missing", () => {
        expect(() => setSubmittingState(null, true)).not.toThrow();
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

    test("submitGoogleLogin throws when authService is missing", async () => {
        await expect(submitGoogleLogin({})).rejects.toThrow(
            "authService.loginWithGoogle is required."
        );
    });

    test("submitAppleLogin throws when authService is missing", async () => {
        await expect(submitAppleLogin({})).rejects.toThrow(
            "authService.loginWithApple is required."
        );
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

    test("handleAuthFailure uses fallback message", () => {
        const { statusElement } = createLoginFormDom();

        const result = handleAuthFailure(
            {
                success: false
            },
            {
                statusElement
            }
        );

        expect(statusElement.textContent).toBe(
            "Unable to sign in right now. Please try again."
        );
        expect(statusElement.dataset.state).toBe("error");
        expect(result.success).toBe(false);
    });
});

describe("login.js form submission flow", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

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
        expect(form.dataset.submitting).toBe("false");
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
        expect(form.dataset.submitting).toBe("false");
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
        expect(form.dataset.submitting).toBe("false");
    });

    test("attachLoginHandler handles thrown errors", async () => {
        const { form, statusElement } = createLoginFormDom();
        const fields = getLoginFields(form);

        fields.email.value = "user@example.com";
        fields.password.value = "password123";

        const authService = {
            loginWithEmail: jest.fn().mockRejectedValue(new Error("Unexpected failure"))
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
        expect(result.message).toBe("Unexpected failure");
        expect(statusElement.textContent).toBe("Unexpected failure");
        expect(statusElement.dataset.state).toBe("error");
        expect(onError).toHaveBeenCalledTimes(1);
        expect(form.dataset.submitting).toBe("false");
    });

    test("attachLoginHandler throws if form is missing", () => {
        expect(() =>
            attachLoginHandler({
                form: null,
                authService: {},
                authUtils
            })
        ).toThrow("A login form is required.");
    });

    test("attachLoginHandler throws if authUtils is missing", () => {
        const { form } = createLoginFormDom();

        expect(() =>
            attachLoginHandler({
                form,
                authService: {}
            })
        ).toThrow("authUtils is required.");
    });
});

describe("login.js OAuth handlers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

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

        const onError = jest.fn();

        const { handleClick } = attachOAuthHandler({
            button: appleButton,
            statusElement,
            loginMethod,
            onError
        });

        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Unexpected OAuth failure");
        expect(statusElement.textContent).toBe("Unexpected OAuth failure");
        expect(statusElement.dataset.state).toBe("error");
        expect(onError).toHaveBeenCalledTimes(1);
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

describe("login.js page initialization", () => {
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

    test("initializeLoginPage wires login and OAuth controllers", () => {
        createLoginFormDom();

        const authService = {
            loginWithEmail: jest.fn(),
            loginWithGoogle: jest.fn(),
            loginWithApple: jest.fn()
        };

        const result = initializeLoginPage({
            authService,
            authUtils,
            navigate: jest.fn()
        });

        expect(result.loginController).toBeTruthy();
        expect(result.googleController).toBeTruthy();
        expect(result.appleController).toBeTruthy();
    });

    test("initializeLoginPage uses custom navigate function", async () => {
        const { form } = createLoginFormDom();
        const fields = getLoginFields(form);

        fields.email.value = "user@example.com";
        fields.password.value = "password123";

        const authService = {
            loginWithEmail: jest.fn().mockResolvedValue({
                success: true,
                nextRoute: "../customer/index.html"
            }),
            loginWithGoogle: jest.fn(),
            loginWithApple: jest.fn()
        };

        const navigate = jest.fn();

        const result = initializeLoginPage({
            authService,
            authUtils,
            navigate
        });

        await result.loginController.handleSubmit({
            preventDefault: jest.fn()
        });

        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
    });

    test("initializeLoginPage returns null OAuth controllers when buttons are missing", () => {
        document.body.innerHTML = `
            <form id="login-form">
                <input name="email" value="" />
                <p data-error-for="email"></p>

                <input name="password" value="" />
                <p data-error-for="password"></p>

                <button type="submit">Login</button>
            </form>

            <p id="login-status"></p>
        `;

        const authService = {
            loginWithEmail: jest.fn(),
            loginWithGoogle: jest.fn(),
            loginWithApple: jest.fn()
        };

        const result = initializeLoginPage({
            authService,
            authUtils
        });

        expect(result.loginController).toBeTruthy();
        expect(result.googleController).toBeNull();
        expect(result.appleController).toBeNull();
    });

    test("initializeLoginPage throws when form is missing", () => {
        document.body.innerHTML = `<p id="login-status"></p>`;

        expect(() =>
            initializeLoginPage({
                authService: {},
                authUtils
            })
        ).toThrow("Login form not found.");
    });

    test("initializeLoginPage throws when authService is missing", () => {
        createLoginFormDom();

        expect(() =>
            initializeLoginPage({
                authUtils
            })
        ).toThrow("authService is required.");
    });

    test("initializeLoginPage throws when authUtils is missing", () => {
        createLoginFormDom();

        const savedAuthUtils = window.authUtils;
        delete window.authUtils;

        try {
            expect(() =>
                initializeLoginPage({
                    authService: {}
                })
            ).toThrow("authUtils is required.");
        } finally {
            window.authUtils = savedAuthUtils;
        }
    });
});