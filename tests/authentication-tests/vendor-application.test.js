const {
    normalizeText,
    getFormField,
    extractVendorApplicationValues,
    buildVendorApplicationPayload,
    validateVendorApplicationPayload,
    clearFieldErrors,
    showFieldErrors,
    setStatusMessage,
    setSubmittingState,
    getVendorApplicationUpdates,
    getSuccessMessage,
    submitVendorApplication,
    attachVendorApplicationHandler
} = require("../../public/authentication/vendor-application.js");

const authUtils = require("../../public/authentication/auth-utils.js");

function getVendorApplicationFields(form) {
    return {
        businessName: form.elements.namedItem("businessName"),
        contactNumber: form.elements.namedItem("contactNumber"),
        description: form.elements.namedItem("description"),
        campusLocation: form.elements.namedItem("campusLocation")
    };
}

function createVendorApplicationDom() {
    document.body.innerHTML = `
    <form id="vendor-application-form">
      <input name="businessName" value="" />
      <p data-error-for="businessName"></p>

      <input name="contactNumber" value="" />
      <p data-error-for="contactNumber"></p>

      <textarea name="description"></textarea>
      <p data-error-for="description"></p>

      <input name="campusLocation" value="" />
      <p data-error-for="campusLocation"></p>

      <button type="submit">Submit Application</button>
    </form>

    <p id="vendor-application-status"></p>
  `;

    return {
        form: document.querySelector("#vendor-application-form"),
        statusElement: document.querySelector("#vendor-application-status")
    };
}

describe("vendor-application.js helpers", () => {
    test("normalizeText trims whitespace", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
    });

    test("getFormField returns the requested field", () => {
        const { form } = createVendorApplicationDom();

        expect(getFormField(form, "businessName")).toBe(form.elements.namedItem("businessName"));
        expect(getFormField(form, "description")).toBe(form.elements.namedItem("description"));
    });

    test("extractVendorApplicationValues reads values from form", () => {
        const { form } = createVendorApplicationDom();
        const fields = getVendorApplicationFields(form);

        fields.businessName.value = "Campus Grill";
        fields.contactNumber.value = "0712345678";
        fields.description.value = "Fresh meals and drinks";
        fields.campusLocation.value = "Matrix Food Court";

        const result = extractVendorApplicationValues(form);

        expect(result).toEqual({
            businessName: "Campus Grill",
            contactNumber: "0712345678",
            description: "Fresh meals and drinks",
            campusLocation: "Matrix Food Court"
        });
    });

    test("buildVendorApplicationPayload normalizes values", () => {
        const result = buildVendorApplicationPayload({
            businessName: "  Campus Grill  ",
            contactNumber: "  0712345678  ",
            description: "  Fresh meals and drinks  ",
            campusLocation: "  Matrix Food Court  "
        });

        expect(result).toEqual({
            businessName: "Campus Grill",
            contactNumber: "0712345678",
            description: "Fresh meals and drinks",
            campusLocation: "Matrix Food Court"
        });
    });

    test("validateVendorApplicationPayload accepts valid payload", () => {
        const result = validateVendorApplicationPayload(
            {
                businessName: "Campus Grill",
                contactNumber: "0712345678",
                description: "Fresh meals and drinks",
                campusLocation: "Matrix Food Court"
            },
            authUtils
        );

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual({});
    });

    test("validateVendorApplicationPayload returns expected errors", () => {
        const result = validateVendorApplicationPayload(
            {
                businessName: "",
                contactNumber: "",
                description: "",
                campusLocation: ""
            },
            authUtils
        );

        expect(result.isValid).toBe(false);
        expect(result.errors.businessName).toBe("Business name is required.");
        expect(result.errors.contactNumber).toBe("Contact number is required.");
        expect(result.errors.description).toBe("Business description is required.");
        expect(result.errors.campusLocation).toBe("Campus location is required.");
    });

    test("clearFieldErrors clears visible errors", () => {
        const { form } = createVendorApplicationDom();

        form.querySelector('[data-error-for="businessName"]').textContent = "Required";
        form.querySelector('[data-error-for="description"]').textContent = "Required";

        clearFieldErrors(form);

        expect(form.querySelector('[data-error-for="businessName"]').textContent).toBe("");
        expect(form.querySelector('[data-error-for="description"]').textContent).toBe("");
    });

    test("showFieldErrors sets field errors", () => {
        const { form } = createVendorApplicationDom();

        showFieldErrors(form, {
            businessName: "Business name is required.",
            campusLocation: "Campus location is required."
        });

        expect(form.querySelector('[data-error-for="businessName"]').textContent).toBe(
            "Business name is required."
        );
        expect(form.querySelector('[data-error-for="campusLocation"]').textContent).toBe(
            "Campus location is required."
        );
    });

    test("setStatusMessage updates text and state", () => {
        const { statusElement } = createVendorApplicationDom();

        setStatusMessage(statusElement, "Submitted.", "success");

        expect(statusElement.textContent).toBe("Submitted.");
        expect(statusElement.dataset.state).toBe("success");
    });

    test("setSubmittingState disables submit button when submitting", () => {
        const { form } = createVendorApplicationDom();

        setSubmittingState(form, true);

        expect(form.querySelector('button[type="submit"]').disabled).toBe(true);
        expect(form.dataset.submitting).toBe("true");
    });

    test("setSubmittingState enables submit button when not submitting", () => {
        const { form } = createVendorApplicationDom();

        setSubmittingState(form, false);

        expect(form.querySelector('button[type="submit"]').disabled).toBe(false);
        expect(form.dataset.submitting).toBe("false");
    });

    test("getVendorApplicationUpdates builds pending vendor updates", () => {
        const result = getVendorApplicationUpdates(
            {
                businessName: "Campus Grill",
                contactNumber: "0712345678",
                description: "Fresh meals and drinks",
                campusLocation: "Matrix Food Court"
            },
            {
                roles: {
                    customer: true,
                    vendor: false,
                    admin: true
                }
            }
        );

        expect(result).toEqual({
            businessName: "Campus Grill",
            contactNumber: "0712345678",
            description: "Fresh meals and drinks",
            campusLocation: "Matrix Food Court",
            roles: {
                customer: true,
                vendor: true,
                admin: true
            },
            vendorStatus: "pending"
        });
    });

    test("getSuccessMessage returns the success message", () => {
        expect(getSuccessMessage()).toBe(
            "Vendor application submitted successfully. Your application is awaiting review."
        );
    });
});

describe("vendor-application.js service submission", () => {
    test("submitVendorApplication updates signed-in user's profile", async () => {
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

        const result = await submitVendorApplication(
            {
                businessName: "Campus Grill",
                contactNumber: "0712345678",
                description: "Fresh meals and drinks",
                campusLocation: "Matrix Food Court"
            },
            { authService }
        );

        expect(authService.getCurrentUser).toHaveBeenCalledTimes(1);
        expect(authService.getCurrentUserProfile).toHaveBeenCalledWith("user-1");
        expect(authService.updateUserProfile).toHaveBeenCalledWith("user-1", {
            businessName: "Campus Grill",
            contactNumber: "0712345678",
            description: "Fresh meals and drinks",
            campusLocation: "Matrix Food Court",
            roles: {
                customer: true,
                vendor: true,
                admin: false
            },
            vendorStatus: "pending"
        });
        expect(result.success).toBe(true);
        expect(result.nextRoute).toBe("./pending-vendor.html");
    });

    test("submitVendorApplication returns error when no user is signed in", async () => {
        const authService = {
            getCurrentUser: jest.fn().mockResolvedValue(null),
            getCurrentUserProfile: jest.fn(),
            updateUserProfile: jest.fn()
        };

        const result = await submitVendorApplication(
            {
                businessName: "Campus Grill",
                contactNumber: "0712345678",
                description: "Fresh meals and drinks",
                campusLocation: "Matrix Food Court"
            },
            { authService }
        );

        expect(result.success).toBe(false);
        expect(result.message).toBe("No user is currently signed in.");
        expect(authService.updateUserProfile).not.toHaveBeenCalled();
    });

    test("submitVendorApplication throws when getCurrentUser is missing", async () => {
        await expect(
            submitVendorApplication(
                {
                    businessName: "Campus Grill",
                    contactNumber: "0712345678",
                    description: "Fresh meals and drinks",
                    campusLocation: "Matrix Food Court"
                },
                {
                    authService: {
                        getCurrentUserProfile: jest.fn(),
                        updateUserProfile: jest.fn()
                    }
                }
            )
        ).rejects.toThrow("authService.getCurrentUser is required.");
    });

    test("submitVendorApplication throws when getCurrentUserProfile is missing", async () => {
        await expect(
            submitVendorApplication(
                {
                    businessName: "Campus Grill",
                    contactNumber: "0712345678",
                    description: "Fresh meals and drinks",
                    campusLocation: "Matrix Food Court"
                },
                {
                    authService: {
                        getCurrentUser: jest.fn(),
                        updateUserProfile: jest.fn()
                    }
                }
            )
        ).rejects.toThrow("authService.getCurrentUserProfile is required.");
    });

    test("submitVendorApplication throws when updateUserProfile is missing", async () => {
        await expect(
            submitVendorApplication(
                {
                    businessName: "Campus Grill",
                    contactNumber: "0712345678",
                    description: "Fresh meals and drinks",
                    campusLocation: "Matrix Food Court"
                },
                {
                    authService: {
                        getCurrentUser: jest.fn(),
                        getCurrentUserProfile: jest.fn()
                    }
                }
            )
        ).rejects.toThrow("authService.updateUserProfile is required.");
    });
});

describe("vendor-application.js form submission flow", () => {
    test("attachVendorApplicationHandler shows validation errors for invalid input", async () => {
        const { form, statusElement } = createVendorApplicationDom();
        const fields = getVendorApplicationFields(form);

        fields.businessName.value = "";
        fields.contactNumber.value = "";
        fields.description.value = "";
        fields.campusLocation.value = "";

        const authService = {
            getCurrentUser: jest.fn(),
            getCurrentUserProfile: jest.fn(),
            updateUserProfile: jest.fn()
        };

        const { handleSubmit } = attachVendorApplicationHandler({
            form,
            statusElement,
            authService,
            authUtils
        });

        const result = await handleSubmit({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(form.querySelector('[data-error-for="businessName"]').textContent).toBe(
            "Business name is required."
        );
        expect(form.querySelector('[data-error-for="contactNumber"]').textContent).toBe(
            "Contact number is required."
        );
        expect(form.querySelector('[data-error-for="description"]').textContent).toBe(
            "Business description is required."
        );
        expect(form.querySelector('[data-error-for="campusLocation"]').textContent).toBe(
            "Campus location is required."
        );
        expect(statusElement.textContent).toBe("Please fix the highlighted fields.");
        expect(statusElement.dataset.state).toBe("error");
        expect(authService.getCurrentUser).not.toHaveBeenCalled();
    });

    test("attachVendorApplicationHandler submits application successfully", async () => {
        const { form, statusElement } = createVendorApplicationDom();
        const fields = getVendorApplicationFields(form);

        fields.businessName.value = "Campus Grill";
        fields.contactNumber.value = "0712345678";
        fields.description.value = "Fresh meals and drinks";
        fields.campusLocation.value = "Matrix Food Court";

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

        const onSuccess = jest.fn();
        const navigate = jest.fn();

        const { handleSubmit } = attachVendorApplicationHandler({
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
        expect(statusElement.textContent).toBe(
            "Vendor application submitted successfully. Your application is awaiting review."
        );
        expect(statusElement.dataset.state).toBe("success");
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith("./pending-vendor.html");
    });

    test("attachVendorApplicationHandler shows service error result", async () => {
        const { form, statusElement } = createVendorApplicationDom();
        const fields = getVendorApplicationFields(form);

        fields.businessName.value = "Campus Grill";
        fields.contactNumber.value = "0712345678";
        fields.description.value = "Fresh meals and drinks";
        fields.campusLocation.value = "Matrix Food Court";

        const authService = {
            getCurrentUser: jest.fn().mockResolvedValue(null),
            getCurrentUserProfile: jest.fn(),
            updateUserProfile: jest.fn()
        };

        const onError = jest.fn();

        const { handleSubmit } = attachVendorApplicationHandler({
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
        expect(statusElement.textContent).toBe("No user is currently signed in.");
        expect(statusElement.dataset.state).toBe("error");
        expect(onError).toHaveBeenCalledTimes(1);
    });

    test("attachVendorApplicationHandler handles thrown errors", async () => {
        const { form, statusElement } = createVendorApplicationDom();
        const fields = getVendorApplicationFields(form);

        fields.businessName.value = "Campus Grill";
        fields.contactNumber.value = "0712345678";
        fields.description.value = "Fresh meals and drinks";
        fields.campusLocation.value = "Matrix Food Court";

        const authService = {
            getCurrentUser: jest.fn().mockRejectedValue(new Error("Unexpected failure")),
            getCurrentUserProfile: jest.fn(),
            updateUserProfile: jest.fn()
        };

        const onError = jest.fn();

        const { handleSubmit } = attachVendorApplicationHandler({
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
    });

    test("attachVendorApplicationHandler throws if form is missing", () => {
        expect(() =>
            attachVendorApplicationHandler({
                form: null,
                statusElement: null,
                authService: {},
                authUtils
            })
        ).toThrow("A vendor application form is required.");
    });

    test("attachVendorApplicationHandler throws if authUtils is missing", () => {
        const { form, statusElement } = createVendorApplicationDom();

        expect(() =>
            attachVendorApplicationHandler({
                form,
                statusElement,
                authService: {}
            })
        ).toThrow("authUtils is required.");
    });
});