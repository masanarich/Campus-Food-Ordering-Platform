/**
 * @jest-environment jsdom
 */

const {
    normalizeText,
    normalizeLowerText,
    getSafeUserProfile,
    getAdminApplicationFields,
    validateApplicationForm,
    getStatusViewModel,
    createAdminApplicationPage
} = require("../../public/customer/admin-application.js");

async function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function createDom() {
    document.body.innerHTML = `
        <main>
            <section>
                <p id="admin-application-status"></p>
                <p id="admin-application-note"></p>

                <menu>
                    <li><button id="back-button" type="button">Back</button></li>
                    <li><button id="go-admin-portal-button" type="button" hidden>Admin Portal</button></li>
                </menu>
            </section>

            <section id="admin-application-form-section">
                <form id="admin-application-form">
                    <input id="admin-department" name="department" type="text">
                    <p id="admin-department-error" hidden></p>

                    <input id="admin-email" name="email" type="email">
                    <p id="admin-email-error" hidden></p>

                    <textarea id="admin-motivation" name="motivation"></textarea>
                    <p id="admin-motivation-error" hidden></p>

                    <input id="admin-confirm-checkbox" name="confirmed" type="checkbox">
                    <p id="admin-confirmed-error" hidden></p>

                    <button id="submit-admin-application-button" type="submit">Submit Admin Application</button>
                    <button id="reset-admin-application-button" type="reset">Clear Form</button>
                </form>
            </section>

            <section>
                <output id="admin-status-output"></output>
                <output id="admin-department-output"></output>
                <output id="admin-email-output"></output>
                <output id="admin-motivation-output"></output>
                <output id="admin-reason-output"></output>
            </section>
        </main>
    `;
}

function createAuthUtils() {
    return {
        normaliseUserData: jest.fn((user) => ({
            uid: user.uid || "",
            displayName: user.displayName || "",
            email: (user.email || "").trim().toLowerCase(),
            phoneNumber: user.phoneNumber || "",
            accountStatus: user.accountStatus || "active",
            isAdmin: user.isAdmin === true,
            adminApplicationStatus: user.isAdmin === true
                ? "approved"
                : ((user.adminApplicationStatus || "none").trim().toLowerCase()),
            adminApplicationReason: user.adminApplicationReason || "",
            adminDepartment: user.adminDepartment || "",
            adminMotivation: user.adminMotivation || ""
        })),
        isValidEmail: jest.fn((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim().toLowerCase()))
    };
}

function createDependencies(overrides = {}) {
    const authService = {
        getCurrentUser: jest.fn(() => ({ uid: "user-123" })),
        getCurrentUserProfile: jest.fn(async () => ({
            uid: "user-123",
            displayName: "Fara",
            email: "fara@example.com",
            accountStatus: "active",
            isAdmin: false,
            adminApplicationStatus: "none",
            adminApplicationReason: "",
            adminDepartment: "",
            adminMotivation: ""
        })),
        getUserProfile: jest.fn(async () => null),
        updateCurrentUserProfile: jest.fn(async (updates) => updates),
        updateUserProfile: jest.fn(async (uid, updates) => ({ uid, ...updates }))
    };

    const firestoreFns = {
        doc: jest.fn((db, collection, id) => ({ db, collection, id })),
        setDoc: jest.fn(async () => true),
        serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP")
    };

    return {
        authService,
        authUtils: createAuthUtils(),
        db: { name: "mock-db" },
        firestoreFns,
        ...overrides
    };
}

function fillValidForm() {
    document.getElementById("admin-department").value = "Student Affairs";
    document.getElementById("admin-email").value = "admin@university.ac.za";
    document.getElementById("admin-motivation").value =
        "I help manage vendor onboarding, user access, and review tasks for the campus food platform.";
    document.getElementById("admin-confirm-checkbox").checked = true;
}

describe("admin-application.js helpers", () => {
    test("normalize helpers work", () => {
        expect(normalizeText("  hello  ")).toBe("hello");
        expect(normalizeText(null)).toBe("");
        expect(normalizeLowerText("  HeLLo  ")).toBe("hello");
        expect(normalizeLowerText(undefined)).toBe("");
    });

    test("getAdminApplicationFields maps and normalizes values", () => {
        expect(
            getAdminApplicationFields({
                department: " Student Affairs ",
                motivation: " I help with approvals and access reviews. "
            })
        ).toEqual({
            adminDepartment: "Student Affairs",
            adminMotivation: "I help with approvals and access reviews."
        });
    });

    test("validateApplicationForm returns expected errors and valid success", () => {
        const authUtils = createAuthUtils();

        const invalidResult = validateApplicationForm(
            {
                department: "",
                email: "bad-email",
                motivation: "too short",
                confirmed: false
            },
            authUtils
        );

        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.errors.department).toBe("Please enter your department, faculty, or admin area.");
        expect(invalidResult.errors.email).toBe("Please enter a valid admin contact email.");
        expect(invalidResult.errors.motivation).toBe("Please provide a fuller motivation for admin access.");
        expect(invalidResult.errors.confirmed).toBe("Please confirm that the information is correct.");

        const validResult = validateApplicationForm(
            {
                department: "Student Affairs",
                email: "admin@university.ac.za",
                motivation: "I help review access requests, vendor applications, and platform management tasks.",
                confirmed: true
            },
            authUtils
        );

        expect(validResult.isValid).toBe(true);
        expect(validResult.errors).toEqual({});
    });

    test("getStatusViewModel handles all statuses", () => {
        expect(getStatusViewModel({ isAdmin: true })).toEqual({
            key: "approved",
            message: "Your admin access is approved. You can now open the admin portal.",
            canApply: false,
            canOpenAdminPortal: true
        });

        expect(getStatusViewModel({ adminApplicationStatus: "pending" })).toEqual({
            key: "pending",
            message: "Your admin application is pending review.",
            canApply: false,
            canOpenAdminPortal: false
        });

        expect(getStatusViewModel({ adminApplicationStatus: "blocked" })).toEqual({
            key: "blocked",
            message: "Your admin access is currently blocked. Please contact support or admin.",
            canApply: false,
            canOpenAdminPortal: false
        });

        expect(getStatusViewModel({ adminApplicationStatus: "rejected" })).toEqual({
            key: "rejected",
            message: "Your admin application was not approved. You can review your details and apply again.",
            canApply: true,
            canOpenAdminPortal: false
        });

        expect(getStatusViewModel({ adminApplicationStatus: "none" })).toEqual({
            key: "none",
            message: "Complete the form below to apply for admin access.",
            canApply: true,
            canOpenAdminPortal: false
        });
    });

    test("getSafeUserProfile uses authUtils normaliser and has a safe fallback", () => {
        const authUtils = createAuthUtils();
        const normalized = getSafeUserProfile(
            authUtils,
            {
                uid: "abc",
                email: "TEST@EXAMPLE.COM",
                adminApplicationStatus: "PENDING",
                adminDepartment: " Tech Ops ",
                adminMotivation: " Support reviews "
            },
            "fallback"
        );

        expect(authUtils.normaliseUserData).toHaveBeenCalled();
        expect(normalized.uid).toBe("abc");
        expect(normalized.email).toBe("test@example.com");
        expect(normalized.adminDepartment).toBe("Tech Ops");

        const fallback = getSafeUserProfile(
            null,
            {
                fullName: " Faranani ",
                email: " TEST@EXAMPLE.COM ",
                phoneNumber: " 0712345678 ",
                accountStatus: " ACTIVE ",
                adminApplicationStatus: " REJECTED ",
                adminApplicationReason: " Need more detail ",
                adminDepartment: " Student Affairs ",
                adminMotivation: " Help manage workflows "
            },
            "fallback-id"
        );

        expect(fallback).toEqual({
            uid: "fallback-id",
            displayName: "Faranani",
            email: "test@example.com",
            phoneNumber: "0712345678",
            accountStatus: "active",
            isAdmin: false,
            adminApplicationStatus: "rejected",
            adminApplicationReason: "Need more detail",
            adminDepartment: "Student Affairs",
            adminMotivation: "Help manage workflows"
        });
    });
});

describe("createAdminApplicationPage", () => {
    let dependencies;
    let page;
    let consoleErrorSpy;

    beforeEach(() => {
        createDom();
        dependencies = createDependencies();
        page = createAdminApplicationPage(dependencies);

        jest.spyOn(window, "setTimeout").mockImplementation((callback) => {
            callback();
            return 0;
        });

        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("initializeAdminApplicationPage loads current profile and updates page", async () => {
        await page.initializeAdminApplicationPage();

        expect(dependencies.authService.getCurrentUser).toHaveBeenCalled();
        expect(dependencies.authService.getCurrentUserProfile).toHaveBeenCalledWith("user-123");
        expect(document.getElementById("admin-application-status").textContent)
            .toBe("Complete the form below to apply for admin access.");
        expect(document.getElementById("admin-application-note").textContent)
            .toBe("Complete the application form below and submit it for review.");
        expect(document.getElementById("admin-status-output").textContent).toBe("none");
        expect(document.getElementById("submit-admin-application-button").disabled).toBe(false);
    });

    test("initializeAdminApplicationPage handles signed out user", async () => {
        dependencies.authService.getCurrentUser.mockReturnValue(null);
        page = createAdminApplicationPage(dependencies);

        await page.initializeAdminApplicationPage();

        expect(document.getElementById("admin-application-status").textContent)
            .toBe("Complete the form below to apply for admin access.");
        expect(document.getElementById("admin-application-note").textContent)
            .toBe("Complete the application form below and submit it for review.");
    });

    test("initializeAdminApplicationPage falls back to getUserProfile when needed", async () => {
        dependencies.authService.getCurrentUserProfile.mockResolvedValue(null);
        dependencies.authService.getUserProfile.mockResolvedValue({
            uid: "user-123",
            email: "fallback@example.com",
            adminApplicationStatus: "rejected",
            adminApplicationReason: "Missing motivation"
        });

        page = createAdminApplicationPage(dependencies);
        await page.initializeAdminApplicationPage();

        expect(dependencies.authService.getUserProfile).toHaveBeenCalledWith("user-123");
        expect(document.getElementById("admin-application-status").textContent)
            .toBe("Your admin application was not approved. You can review your details and apply again.");
        expect(document.getElementById("admin-application-note").textContent)
            .toBe("Missing motivation");
    });

    test("approved profile hides form and shows admin portal button", async () => {
        dependencies.authService.getCurrentUserProfile.mockResolvedValue({
            uid: "user-123",
            isAdmin: true,
            adminApplicationStatus: "approved"
        });

        page = createAdminApplicationPage(dependencies);
        await page.initializeAdminApplicationPage();

        expect(document.getElementById("admin-application-form-section").hidden).toBe(true);
        expect(document.getElementById("go-admin-portal-button").hidden).toBe(false);
        expect(document.getElementById("go-admin-portal-button").disabled).toBe(false);
        expect(document.getElementById("admin-application-status").textContent)
            .toBe("Your admin access is approved. You can now open the admin portal.");
    });

    test("pending and blocked profiles update the note correctly", async () => {
        dependencies.authService.getCurrentUserProfile.mockResolvedValue({
            uid: "user-123",
            adminApplicationStatus: "pending"
        });

        page = createAdminApplicationPage(dependencies);
        await page.initializeAdminApplicationPage();

        expect(document.getElementById("submit-admin-application-button").disabled).toBe(true);
        expect(document.getElementById("reset-admin-application-button").disabled).toBe(true);
        expect(document.getElementById("admin-application-form-section").hidden).toBe(true);
        expect(document.getElementById("admin-application-note").textContent)
            .toBe("Your application is under review. You cannot submit another one right now.");

        dependencies.authService.getCurrentUserProfile.mockResolvedValue({
            uid: "user-123",
            adminApplicationStatus: "blocked",
            adminApplicationReason: "Contact admin lead"
        });

        createDom();
        page = createAdminApplicationPage(dependencies);
        await page.initializeAdminApplicationPage();

        expect(document.getElementById("admin-application-status").textContent)
            .toBe("Your admin access is currently blocked. Please contact support or admin.");
        expect(document.getElementById("admin-application-note").textContent)
            .toBe("Contact admin lead");
    });

    test("live validation shows and clears errors", async () => {
        await page.initializeAdminApplicationPage();

        const emailInput = document.getElementById("admin-email");
        const emailError = document.getElementById("admin-email-error");
        const checkbox = document.getElementById("admin-confirm-checkbox");
        const checkboxError = document.getElementById("admin-confirmed-error");

        emailInput.value = "bad-email";
        emailInput.dispatchEvent(new Event("input", { bubbles: true }));

        expect(emailError.textContent).toBe("Please enter a valid admin contact email.");
        expect(emailInput.getAttribute("aria-invalid")).toBe("true");

        emailInput.value = "admin@university.ac.za";
        emailInput.dispatchEvent(new Event("input", { bubbles: true }));

        expect(emailError.textContent).toBe("");
        expect(emailInput.hasAttribute("aria-invalid")).toBe(false);

        checkbox.checked = false;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        expect(checkboxError.textContent).toBe("Please confirm that the information is correct.");

        checkbox.checked = true;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        expect(checkboxError.textContent).toBe("");
    });

    test("summary updates while typing", async () => {
        await page.initializeAdminApplicationPage();

        const departmentInput = document.getElementById("admin-department");
        const motivationInput = document.getElementById("admin-motivation");

        departmentInput.value = "Technology Services";
        departmentInput.dispatchEvent(new Event("input", { bubbles: true }));

        motivationInput.value = "I review operational requests, account escalations, and approval workflows.";
        motivationInput.dispatchEvent(new Event("input", { bubbles: true }));

        expect(document.getElementById("admin-department-output").textContent).toBe("Technology Services");
        expect(document.getElementById("admin-motivation-output").textContent)
            .toBe("I review operational requests, account escalations, and approval workflows.");
    });

    test("submit shows validation errors when form is invalid", async () => {
        await page.initializeAdminApplicationPage();

        document
            .getElementById("admin-application-form")
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        await flushPromises();

        expect(document.getElementById("admin-application-status").textContent)
            .toBe("Please enter your department, faculty, or admin area.");
        expect(document.getElementById("admin-application-note").textContent)
            .toBe("Please correct the highlighted fields and try again.");
        expect(document.getElementById("admin-department-error").textContent)
            .toBe("Please enter your department, faculty, or admin area.");
        expect(dependencies.authService.updateCurrentUserProfile).not.toHaveBeenCalled();
        expect(dependencies.firestoreFns.setDoc).not.toHaveBeenCalled();
    });

    test("submit succeeds with valid form and saves admin application", async () => {
        await page.initializeAdminApplicationPage();
        fillValidForm();

        document
            .getElementById("admin-application-form")
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        await flushPromises();
        await flushPromises();
        await flushPromises();

        expect(dependencies.authService.updateCurrentUserProfile).toHaveBeenCalledWith({
            email: "admin@university.ac.za",
            adminDepartment: "Student Affairs",
            adminMotivation: "I help manage vendor onboarding, user access, and review tasks for the campus food platform.",
            isAdmin: false,
            adminApplicationStatus: "pending",
            adminApplicationReason: ""
        });

        expect(dependencies.firestoreFns.doc).toHaveBeenCalledWith(
            dependencies.db,
            "adminApplications",
            "user-123"
        );

        expect(dependencies.firestoreFns.setDoc).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: "adminApplications",
                id: "user-123"
            }),
            expect.objectContaining({
                uid: "user-123",
                email: "admin@university.ac.za",
                adminDepartment: "Student Affairs",
                adminApplicationStatus: "pending",
                adminApplicationReason: "",
                submittedAt: "SERVER_TIMESTAMP",
                updatedAt: "SERVER_TIMESTAMP"
            }),
            { merge: true }
        );

        expect(document.getElementById("admin-status-output").textContent).toBe("pending");
        expect(document.getElementById("admin-department-output").textContent).toBe("Student Affairs");
        expect(document.getElementById("submit-admin-application-button").disabled).toBe(true);
    });

    test("submit falls back to updateUserProfile and handles unsupported methods", async () => {
        delete dependencies.authService.updateCurrentUserProfile;
        page = createAdminApplicationPage(dependencies);

        await page.initializeAdminApplicationPage();
        fillValidForm();

        document
            .getElementById("admin-application-form")
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        await flushPromises();
        await flushPromises();

        expect(dependencies.authService.updateUserProfile).toHaveBeenCalledWith(
            "user-123",
            expect.objectContaining({
                adminDepartment: "Student Affairs",
                adminApplicationStatus: "pending"
            })
        );

        delete dependencies.authService.updateUserProfile;
        createDom();
        page = createAdminApplicationPage(dependencies);
        await page.initializeAdminApplicationPage();
        fillValidForm();

        document
            .getElementById("admin-application-form")
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        await flushPromises();
        await flushPromises();

        expect(document.getElementById("admin-application-status").textContent)
            .toBe("Something went wrong while submitting the application.");
        expect(document.getElementById("admin-application-note").textContent)
            .toBe("No supported profile update method was provided.");
    });

    test("submit handles thrown errors and signed out state", async () => {
        dependencies.authService.updateCurrentUserProfile.mockRejectedValue(new Error("Database failed"));
        page = createAdminApplicationPage(dependencies);

        await page.initializeAdminApplicationPage();
        fillValidForm();

        document
            .getElementById("admin-application-form")
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        await flushPromises();
        await flushPromises();

        expect(document.getElementById("admin-application-status").textContent)
            .toBe("Something went wrong while submitting the application.");
        expect(document.getElementById("admin-application-note").textContent).toBe("Database failed");

        dependencies.authService.getCurrentUser.mockReturnValue(null);
        createDom();
        page = createAdminApplicationPage(dependencies);
        await page.initializeAdminApplicationPage();

        document
            .getElementById("admin-application-form")
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        await flushPromises();

        expect(document.getElementById("admin-application-status").textContent)
            .toBe("Please sign in to apply for admin access.");
    });

    test("saveAdminApplicationRecord safely returns when firestore functions are missing", async () => {
        const limitedDeps = createDependencies({
            firestoreFns: {},
            db: null
        });

        page = createAdminApplicationPage(limitedDeps);
        await page.initializeAdminApplicationPage();
        fillValidForm();

        document
            .getElementById("admin-application-form")
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        await flushPromises();
        await flushPromises();

        expect(limitedDeps.authService.updateCurrentUserProfile).toHaveBeenCalled();
    });

    test("reset clears errors, summary, and shows reset note", async () => {
        await page.initializeAdminApplicationPage();

        document.getElementById("admin-department").value = "";
        document.getElementById("admin-department")
            .dispatchEvent(new Event("input", { bubbles: true }));

        expect(document.getElementById("admin-department-error").textContent)
            .toBe("Please enter your department, faculty, or admin area.");

        fillValidForm();
        document.getElementById("admin-department-output").textContent = "Student Affairs";

        document
            .getElementById("admin-application-form")
            .dispatchEvent(new Event("reset", { bubbles: true }));

        expect(document.getElementById("admin-department-error").textContent).toBe("");
        expect(document.getElementById("admin-department-output").textContent).toBe("-");
        expect(document.getElementById("admin-motivation-output").textContent).toBe("-");
        expect(document.getElementById("admin-application-status").textContent)
            .toBe("Complete the form below to apply for admin access.");
        expect(document.getElementById("admin-application-note").textContent)
            .toBe("The form has been cleared.");
    });

    test("back and admin portal button execute navigation code path", async () => {
        await page.initializeAdminApplicationPage();
        document.getElementById("back-button").click();
        expect(consoleErrorSpy).toHaveBeenCalled();

        dependencies.authService.getCurrentUserProfile.mockResolvedValue({
            uid: "user-123",
            isAdmin: true,
            adminApplicationStatus: "approved"
        });

        createDom();
        page = createAdminApplicationPage(dependencies);
        await page.initializeAdminApplicationPage();
        document.getElementById("go-admin-portal-button").click();
        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test("initializeAdminApplicationPage handles load errors and module initializer attaches instance", async () => {
        dependencies.authService.getCurrentUserProfile.mockRejectedValue(new Error("Load failed"));
        page = createAdminApplicationPage(dependencies);

        await page.initializeAdminApplicationPage();

        expect(document.getElementById("admin-application-status").textContent)
            .toBe("Unable to load your admin application details.");
        expect(document.getElementById("admin-application-note").textContent)
            .toBe("Please refresh the page and try again.");

        createDom();
        expect(typeof window.adminApplicationPage.initializeAdminApplicationPage).toBe("function");
        await window.adminApplicationPage.initializeAdminApplicationPage(createDependencies());
        expect(window.adminApplicationPage.instance).toBeDefined();
    });
});
