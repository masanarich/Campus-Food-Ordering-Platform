const {
    normalizeText,
    normalizeEmail,
    getFormField,
    extractResetFormValues,
    buildResetPayload,
    validateResetPayload,
    clearFieldErrors,
    showFieldErrors,
    setStatusMessage,
    setSubmittingState,
    getSuccessMessage,
    submitPasswordReset,
    attachResetHandler
} = require("../../public/authentication/reset.js");

const authUtils = require("../../public/authentication/auth-utils.js");

function getResetFields(form) {
    return {
        email: form.elements.namedItem("email")
    };
}

function createResetFormDom() {
    document.body.innerHTML = `
    <form id="reset-form">
      <input name="email" value="" />
      <p data-error-for="email"></p>

      <button type="submit">Send Reset Email</button>
    </form>

    <p id="reset-status"></p>
  `;

    return {
        form: document.querySelector("#reset-form"),
        statusElement: document.querySelector("#reset-status")
    };
}

describe("reset.js helpers", () => {
    test("normalizeText trims whitespace", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
    });

    test("normalizeEmail trims and lowercases email", () => {
        expect(normalizeEmail("  USER@Example.COM  ")).toBe("user@example.com");
    });

    test("getFormField returns the requested field", () => {
        const { form } = createResetFormDom();

        expect(getFormField(form, "email")).toBe(form.elements.namedItem("email"));
    });

    test("extractResetFormValues reads values from form", () => {
        const { form } = createResetFormDom();
        const fields = getResetFields(form);

        fields.email.value = "user@example.com";

        const result = extractResetFormValues(form);

        expect(result).toEqual({
            email: "user@example.com"
        });
    });

    test("buildResetPayload normalizes raw values", () => {
        const result = buildResetPayload({
            email: "  USER@Example.COM "
        });

        expect(result).toEqual({
            email: "user@example.com"
        });
    });

    test("validateResetPayload accepts valid payload", () => {
        const result = validateResetPayload(
            {
                email: "user@example.com"
            },
            authUtils
        );

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual({});
    });

    test("validateResetPayload returns errors for bad payload", () => {
        const result = validateResetPayload(
            {
                email: "bad-email"
            },
            authUtils
        );

        expect(result.isValid).toBe(false);
        expect(result.errors.email).toBe("Please enter a valid email address.");
    });

    test("clearFieldErrors clears visible field errors", () => {
        const { form } = createResetFormDom();

        form.querySelector('[data-error-for="email"]').textContent = "Invalid";

        clearFieldErrors(form);

        expect(form.querySelector('[data-error-for="email"]').textContent).toBe("");
    });

    test("showFieldErrors sets field errors", () => {
        const { form } = createResetFormDom();

        showFieldErrors(form, {
            email: "Please enter a valid email address."
        });

        expect(form.querySelector('[data-error-for="email"]').textContent).toBe(
            "Please enter a valid email address."
        );
    });

    test("setStatusMessage updates text and state", () => {
        const { statusElement } = createResetFormDom();

        setStatusMessage(statusElement, "Password reset email sent.", "success");

        expect(statusElement.textContent).toBe("Password reset email sent.");
        expect(statusElement.dataset.state).toBe("success");
    });

    test("setSubmittingState disables submit button when submitting", () => {
        const { form } = createResetFormDom();

        setSubmittingState(form, true);

        expect(form.querySelector('button[type="submit"]').disabled).toBe(true);
        expect(form.dataset.submitting).toBe("true");
    });

    test("setSubmittingState enables submit button when not submitting", () => {
        const { form } = createResetFormDom();

        setSubmittingState(form, false);

        expect(form.querySelector('button[type="submit"]').disabled).toBe(false);
        expect(form.dataset.submitting).toBe("false");
    });

    test("getSuccessMessage returns the reset success message", () => {
        expect(getSuccessMessage()).toBe(
            "Password reset email sent. Please check your inbox."
        );
    });
});

describe("reset.js service submission", () => {
    test("submitPasswordReset calls authService.sendPasswordResetEmail", async () => {
        const authService = {
            sendPasswordResetEmail: jest.fn().mockResolvedValue({
                success: true
            })
        };

        const result = await submitPasswordReset(
            {
                email: "user@example.com"
            },
            { authService }
        );

        expect(authService.sendPasswordResetEmail).toHaveBeenCalledWith({
            email: "user@example.com"
        });
        expect(result.success).toBe(true);
    });

    test("submitPasswordReset throws when authService is missing", async () => {
        await expect(
            submitPasswordReset(
                {
                    email: "user@example.com"
                },
                {}
            )
        ).rejects.toThrow("authService.sendPasswordResetEmail is required.");
    });
});

describe("reset.js form submission flow", () => {
    test("attachResetHandler shows validation errors for invalid input", async () => {
        const { form, statusElement } = createResetFormDom();
        const fields = getResetFields(form);

        fields.email.value = "bad-email";

        const authService = {
            sendPasswordResetEmail: jest.fn()
        };

        const { handleSubmit } = attachResetHandler({
            form,
            statusElement,
            authService,
            authUtils
        });

        const result = await handleSubmit({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(authService.sendPasswordResetEmail).not.toHaveBeenCalled();
        expect(form.querySelector('[data-error-for="email"]').textContent).toBe(
            "Please enter a valid email address."
        );
        expect(statusElement.textContent).toBe("Please fix the highlighted fields.");
        expect(statusElement.dataset.state).toBe("error");
    });

    test("attachResetHandler sends reset email successfully", async () => {
        const { form, statusElement } = createResetFormDom();
        const fields = getResetFields(form);

        fields.email.value = "user@example.com";

        const authService = {
            sendPasswordResetEmail: jest.fn().mockResolvedValue({
                success: true
            })
        };

        const onSuccess = jest.fn();

        const { handleSubmit } = attachResetHandler({
            form,
            statusElement,
            authService,
            authUtils,
            onSuccess
        });

        const result = await handleSubmit({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(true);
        expect(authService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
        expect(statusElement.textContent).toBe(
            "Password reset email sent. Please check your inbox."
        );
        expect(statusElement.dataset.state).toBe("success");
        expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    test("attachResetHandler supports navigation when nextRoute is returned", async () => {
        const { form, statusElement } = createResetFormDom();
        const fields = getResetFields(form);

        fields.email.value = "user@example.com";

        const authService = {
            sendPasswordResetEmail: jest.fn().mockResolvedValue({
                success: true,
                nextRoute: "./login.html"
            })
        };

        const navigate = jest.fn();

        const { handleSubmit } = attachResetHandler({
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
        expect(navigate).toHaveBeenCalledWith("./login.html");
    });

    test("attachResetHandler shows service error message on failed reset request", async () => {
        const { form, statusElement } = createResetFormDom();
        const fields = getResetFields(form);

        fields.email.value = "user@example.com";

        const authService = {
            sendPasswordResetEmail: jest.fn().mockResolvedValue({
                success: false,
                message: "No account was found with that email address."
            })
        };

        const onError = jest.fn();

        const { handleSubmit } = attachResetHandler({
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
        expect(statusElement.textContent).toBe("No account was found with that email address.");
        expect(statusElement.dataset.state).toBe("error");
        expect(onError).toHaveBeenCalledTimes(1);
    });

    test("attachResetHandler handles unexpected thrown errors", async () => {
        const { form, statusElement } = createResetFormDom();
        const fields = getResetFields(form);

        fields.email.value = "user@example.com";

        const authService = {
            sendPasswordResetEmail: jest.fn().mockRejectedValue(new Error("Unexpected failure"))
        };

        const { handleSubmit } = attachResetHandler({
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