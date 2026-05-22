/**
 * @jest-environment jsdom
 */

const customerSupportNewPage = require("../../../public/customer/support/new.js");

function createDOM() {
    document.body.innerHTML = `
        <p id="new-ticket-status"></p>
        <form id="new-ticket-form" novalidate>
            <p>
                <input id="new-ticket-subject" name="subject" type="text">
            </p>
            <p id="new-ticket-subject-error"></p>

            <p>
                <select id="new-ticket-category" name="category">
                    <option value="" selected>-- Pick --</option>
                    <option value="order_issue">Order Issue</option>
                    <option value="payment">Payment</option>
                    <option value="refund">Refund</option>
                    <option value="general">General</option>
                </select>
            </p>
            <p id="new-ticket-category-error"></p>

            <p>
                <textarea id="new-ticket-description" name="description"></textarea>
            </p>
            <p id="new-ticket-description-error"></p>

            <p>
                <input id="new-ticket-order-id" name="orderId" type="text">
            </p>
            <p id="new-ticket-order-id-error"></p>

            <section>
                <output id="new-ticket-next-step">Loading</output>
                <p id="new-ticket-next-step-detail">Checking ticket details.</p>
            </section>

            <button id="new-ticket-submit" type="submit">Submit</button>
        </form>
    `;

    return {
        statusElement: document.getElementById("new-ticket-status"),
        form: document.getElementById("new-ticket-form"),
        subjectInput: document.getElementById("new-ticket-subject"),
        categorySelect: document.getElementById("new-ticket-category"),
        descriptionInput: document.getElementById("new-ticket-description"),
        orderIdInput: document.getElementById("new-ticket-order-id"),
        submitButton: document.getElementById("new-ticket-submit"),
        subjectError: document.getElementById("new-ticket-subject-error"),
        categoryError: document.getElementById("new-ticket-category-error"),
        descriptionError: document.getElementById("new-ticket-description-error"),
        orderIdError: document.getElementById("new-ticket-order-id-error"),
        nextStepLabel: document.getElementById("new-ticket-next-step"),
        nextStepDetail: document.getElementById("new-ticket-next-step-detail")
    };
}

function fillValidForm(dom, overrides = {}) {
    dom.subjectInput.value = overrides.subject !== undefined
        ? overrides.subject
        : "Order never arrived";
    dom.categorySelect.value = overrides.category !== undefined
        ? overrides.category
        : "order_issue";
    dom.descriptionInput.value = overrides.description !== undefined
        ? overrides.description
        : "Driver did not show after 30 minutes.";
    dom.orderIdInput.value = overrides.orderId !== undefined
        ? overrides.orderId
        : "order-7";
}

function makeTicketCategoriesStub() {
    return {
        isKnownTicketCategory: jest.fn((category) => {
            const known = ["order_issue", "payment", "refund", "account", "abuse", "general"];
            return known.indexOf(String(category).toLowerCase()) !== -1;
        }),
        isOrderRelatedCategory: jest.fn((category) => {
            return ["order_issue", "payment", "refund"].indexOf(String(category).toLowerCase()) !== -1;
        })
    };
}

function makeAuthFns(currentUser) {
    return {
        onAuthStateChanged: jest.fn((auth, onChange) => {
            onChange(currentUser || null);
            return function unsubscribe() {};
        })
    };
}

describe("customer/support/new.js - module surface", () => {
    test("exports the expected API and constants", () => {
        expect(customerSupportNewPage.MODULE_NAME).toBe("customer/support/new");
        expect(customerSupportNewPage.SUBJECT_MIN_LENGTH).toBeGreaterThan(0);
        expect(customerSupportNewPage.SUBJECT_MAX_LENGTH).toBeGreaterThan(
            customerSupportNewPage.SUBJECT_MIN_LENGTH
        );
        expect(customerSupportNewPage.DESCRIPTION_MIN_LENGTH).toBeGreaterThan(0);
        expect(customerSupportNewPage.DESCRIPTION_MAX_LENGTH).toBeGreaterThan(
            customerSupportNewPage.DESCRIPTION_MIN_LENGTH
        );
        expect(customerSupportNewPage.REQUIRES_ORDER_CATEGORIES).toEqual([
            "order_issue",
            "payment",
            "refund"
        ]);

        [
            "init",
            "initializeCustomerSupportNewPage",
            "readFormValues",
            "validateFormValues",
            "buildReporterSnapshot",
            "submitTicket",
            "prefillFormFromQuery",
            "attachSubmitHandler",
            "setStatusMessage",
            "showFieldErrors",
            "clearFieldErrors",
            "getNewTicketNextStep",
            "renderNextStep",
            "buildTicketDetailUrl"
        ].forEach((name) => {
            expect(typeof customerSupportNewPage[name]).toBe("function");
        });
    });
});

describe("customer/support/new.js - helpers", () => {
    test("readFormValues normalises whitespace and lowercases the category", () => {
        const dom = createDOM();
        dom.subjectInput.value = "  Hello  ";
        dom.categorySelect.value = "order_issue";
        dom.descriptionInput.value = " describe this thing ";
        dom.orderIdInput.value = " order-1 ";

        expect(customerSupportNewPage.readFormValues(dom.form)).toEqual({
            subject: "Hello",
            category: "order_issue",
            description: "describe this thing",
            orderId: "order-1"
        });

        expect(customerSupportNewPage.readFormValues(null)).toBeNull();
    });

    test("categoryRequiresOrderId uses ticket-categories when present and falls back otherwise", () => {
        expect(customerSupportNewPage.categoryRequiresOrderId("order_issue")).toBe(true);
        expect(customerSupportNewPage.categoryRequiresOrderId("PAYMENT")).toBe(true);
        expect(customerSupportNewPage.categoryRequiresOrderId("general")).toBe(false);

        const ticketCategories = makeTicketCategoriesStub();
        expect(
            customerSupportNewPage.categoryRequiresOrderId("refund", { ticketCategories })
        ).toBe(true);
        expect(ticketCategories.isOrderRelatedCategory).toHaveBeenCalled();
    });

    test("validateFormValues flags missing required fields", () => {
        const result = customerSupportNewPage.validateFormValues({
            subject: "",
            category: "",
            description: "",
            orderId: ""
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual({
            subject: expect.any(String),
            category: expect.any(String),
            description: expect.any(String)
        });
    });

    test("validateFormValues enforces length minima", () => {
        const tooShort = customerSupportNewPage.validateFormValues({
            subject: "no",
            category: "general",
            description: "tiny",
            orderId: ""
        });
        expect(tooShort.errors.subject).toMatch(/at least/);
        expect(tooShort.errors.description).toMatch(/at least/);
    });

    test("validateFormValues enforces length maxima", () => {
        const overLong = customerSupportNewPage.validateFormValues({
            subject: "x".repeat(customerSupportNewPage.SUBJECT_MAX_LENGTH + 5),
            category: "general",
            description: "x".repeat(customerSupportNewPage.DESCRIPTION_MAX_LENGTH + 5),
            orderId: "y".repeat(customerSupportNewPage.ORDER_ID_MAX_LENGTH + 5)
        });
        expect(overLong.errors.subject).toMatch(/at most/);
        expect(overLong.errors.description).toMatch(/at most/);
        expect(overLong.errors.orderId).toMatch(/at most/);
    });

    test("validateFormValues requires an orderId for order-related categories", () => {
        const missingOrder = customerSupportNewPage.validateFormValues({
            subject: "Reasonable subject",
            category: "refund",
            description: "Long enough description goes here.",
            orderId: ""
        });
        expect(missingOrder.errors.orderId).toMatch(/order/i);

        const optionalForGeneral = customerSupportNewPage.validateFormValues({
            subject: "Reasonable subject",
            category: "general",
            description: "Long enough description goes here.",
            orderId: ""
        });
        expect(optionalForGeneral.isValid).toBe(true);
    });

    test("validateFormValues rejects unknown categories when ticket-categories is provided", () => {
        const ticketCategories = makeTicketCategoriesStub();
        const result = customerSupportNewPage.validateFormValues({
            subject: "Reasonable subject",
            category: "nonsense",
            description: "Long enough description goes here.",
            orderId: ""
        }, { ticketCategories });
        expect(result.errors.category).toMatch(/known/);
    });

    test("buildReporterSnapshot pulls common fields from the auth user", () => {
        expect(
            customerSupportNewPage.buildReporterSnapshot({
                uid: "customer-1",
                displayName: "Naledi",
                email: "Naledi@example.COM"
            })
        ).toEqual({
            uid: "customer-1",
            displayName: "Naledi",
            email: "naledi@example.com",
            role: "customer"
        });

        expect(customerSupportNewPage.buildReporterSnapshot(null)).toEqual({
            uid: "",
            displayName: "",
            email: "",
            role: "customer"
        });
    });

    test("getOrderIdFromQuery reads ?orderId and ?order params", () => {
        window.history.pushState({}, "", "/customer/support/new.html?orderId=order-9");
        expect(customerSupportNewPage.getOrderIdFromQuery()).toBe("order-9");

        window.history.pushState({}, "", "/customer/support/new.html?order=order-10");
        expect(customerSupportNewPage.getOrderIdFromQuery()).toBe("order-10");

        window.history.pushState({}, "", "/customer/support/new.html");
        expect(customerSupportNewPage.getOrderIdFromQuery()).toBe("");
    });

    test("prefillFormFromQuery sets the orderId field and bumps the category", () => {
        const dom = createDOM();
        window.history.pushState({}, "", "/customer/support/new.html?orderId=order-7");

        customerSupportNewPage.prefillFormFromQuery(dom.form);

        expect(dom.orderIdInput.value).toBe("order-7");
        expect(dom.categorySelect.value).toBe("order_issue");

        // Explicit options override the query.
        const dom2 = createDOM();
        customerSupportNewPage.prefillFormFromQuery(dom2.form, {
            orderId: "order-99",
            category: "refund"
        });
        expect(dom2.orderIdInput.value).toBe("order-99");
        // category is only set when the field is empty AND no orderId was prefilled (which itself sets order_issue).
        // The category option fires only when no orderId branch ran — here orderId set order_issue, so explicit category is ignored.
        expect(dom2.categorySelect.value).toBe("order_issue");
    });

    test("getNewTicketNextStep guides the customer through required ticket fields", () => {
        expect(customerSupportNewPage.getNewTicketNextStep({})).toEqual({
            label: "Next: pick a category",
            detail: "Choose the support area so we can route your ticket correctly."
        });

        expect(customerSupportNewPage.getNewTicketNextStep({
            category: "refund",
            subject: "Refund request",
            description: "I need help with a refund."
        })).toEqual({
            label: "Next: add the order ID",
            detail: "Order, payment, and refund tickets need the related order so support can investigate faster."
        });

        expect(customerSupportNewPage.getNewTicketNextStep({
            category: "general",
            subject: "Hi",
            description: "Long enough description."
        })).toEqual({
            label: "Next: add a short subject",
            detail: "Use at least 3 characters to summarize the issue."
        });

        expect(customerSupportNewPage.getNewTicketNextStep({
            category: "general",
            subject: "Account question",
            description: "Long enough description."
        })).toEqual({
            label: "Next: submit ticket",
            detail: "Everything required is filled in. Submit when you are ready."
        });
    });

    test("renderNextStep writes the next support step to the DOM", () => {
        const dom = createDOM();
        const step = customerSupportNewPage.renderNextStep({
            nextStepLabel: dom.nextStepLabel,
            nextStepDetail: dom.nextStepDetail
        }, {
            category: "general",
            subject: "Account question",
            description: "Long enough description."
        });

        expect(step.label).toBe("Next: submit ticket");
        expect(dom.nextStepLabel.textContent).toBe("Next: submit ticket");
        expect(dom.nextStepDetail.textContent).toMatch(/Everything required/);
    });

    test("buildTicketDetailUrl appends the ticket ID", () => {
        window.history.pushState({}, "", "/customer/support/new.html");
        const url = customerSupportNewPage.buildTicketDetailUrl("ticket-42");
        expect(url).toMatch(/ticket-detail\.html\?ticketId=ticket-42$/);
    });

    test("setStatusMessage, clearFieldErrors, and showFieldErrors set DOM state safely", () => {
        const dom = createDOM();

        customerSupportNewPage.setStatusMessage(dom.statusElement, "Hi", "success");
        expect(dom.statusElement.textContent).toBe("Hi");
        expect(dom.statusElement.getAttribute("data-state")).toBe("success");

        const fieldErrors = {
            subject: dom.subjectError,
            description: dom.descriptionError
        };

        customerSupportNewPage.showFieldErrors(fieldErrors, {
            subject: "too short",
            description: "missing"
        });
        expect(dom.subjectError.textContent).toBe("too short");
        expect(dom.subjectError.getAttribute("data-state")).toBe("error");
        expect(dom.descriptionError.textContent).toBe("missing");

        customerSupportNewPage.clearFieldErrors(fieldErrors);
        expect(dom.subjectError.textContent).toBe("");
        expect(dom.subjectError.hasAttribute("data-state")).toBe(false);

        // Null inputs should be no-ops, not throw.
        customerSupportNewPage.setStatusMessage(null, "no");
        customerSupportNewPage.showFieldErrors(null);
        customerSupportNewPage.clearFieldErrors(null);
    });

    test("setSubmitButtonState toggles disabled and data-busy", () => {
        const dom = createDOM();
        customerSupportNewPage.setSubmitButtonState(dom.submitButton, true);
        expect(dom.submitButton.disabled).toBe(true);
        expect(dom.submitButton.getAttribute("data-busy")).toBe("true");

        customerSupportNewPage.setSubmitButtonState(dom.submitButton, false);
        expect(dom.submitButton.disabled).toBe(false);
        expect(dom.submitButton.hasAttribute("data-busy")).toBe(false);

        customerSupportNewPage.setSubmitButtonState(null, true);
    });
});

describe("customer/support/new.js - submitTicket", () => {
    test("returns an error when no ticket service is reachable", async () => {
        const result = await customerSupportNewPage.submitTicket({
            values: { subject: "x", description: "y", category: "general" },
            reporter: { uid: "c-1" }
        });
        expect(result.success).toBe(false);
        expect(result.error.code).toBe("no-ticket-service");
    });

    test("returns the service result on success", async () => {
        const ticketService = {
            createTicket: jest.fn(async () => ({
                success: true,
                ticket: { ticketId: "ticket-new" }
            }))
        };

        const result = await customerSupportNewPage.submitTicket({
            ticketService,
            db: { kind: "db" },
            firestoreFns: {},
            values: { subject: "x", description: "y", category: "general", orderId: "" },
            reporter: { uid: "c-1", displayName: "Naledi", role: "customer" },
            now: "T"
        });

        expect(ticketService.createTicket).toHaveBeenCalledWith(
            expect.objectContaining({
                db: { kind: "db" },
                firestoreFns: {},
                input: expect.objectContaining({ subject: "x" }),
                reporter: expect.objectContaining({ uid: "c-1" }),
                customer: expect.objectContaining({ uid: "c-1" }),
                now: "T"
            })
        );
        expect(result).toEqual({ success: true, ticket: { ticketId: "ticket-new" } });
    });

    test("wraps thrown service errors", async () => {
        const ticketService = {
            createTicket: jest.fn(async () => { throw new Error("boom"); })
        };
        const result = await customerSupportNewPage.submitTicket({
            ticketService,
            values: { subject: "x", description: "y", category: "general" },
            reporter: { uid: "c-1" }
        });
        expect(result.success).toBe(false);
        expect(result.error.message).toBe("boom");
    });
});

describe("customer/support/new.js - init and submit handler", () => {
    test("init returns success and wires the submit handler when signed in", async () => {
        const dom = createDOM();

        const result = await customerSupportNewPage.init({
            auth: { currentUser: { uid: "customer-1" } },
            authFns: makeAuthFns({ uid: "customer-1" }),
            db: { kind: "db" },
            firestoreFns: {},
            ticketService: { createTicket: jest.fn() }
        });

        expect(result.success).toBe(true);
        expect(dom.submitButton.disabled).toBe(false);
        expect(dom.form.dataset.newTicketBound).toBe("true");
        expect(dom.nextStepLabel.textContent).toBe("Next: pick a category");
    });

    test("init returns an error when the form is missing", async () => {
        document.body.innerHTML = "";
        const result = await customerSupportNewPage.init({
            auth: { currentUser: { uid: "c-1" } },
            authFns: makeAuthFns({ uid: "c-1" })
        });
        expect(result).toEqual({
            success: false,
            error: "New ticket form not found."
        });
    });

    test("init disables submit when no user is signed in", async () => {
        const dom = createDOM();
        const result = await customerSupportNewPage.init({
            auth: { currentUser: null },
            authFns: makeAuthFns(null)
        });
        expect(result.success).toBe(false);
        expect(dom.submitButton.disabled).toBe(true);
        expect(dom.statusElement.textContent).toMatch(/sign in/i);
    });

    test("attachSubmitHandler shows validation errors and skips the service when invalid", async () => {
        const dom = createDOM();
        // Subject too short, no category, no description.
        dom.subjectInput.value = "no";

        const ticketService = { createTicket: jest.fn() };
        const navigate = jest.fn();

        const elements = {
            form: dom.form,
            statusElement: dom.statusElement,
            submitButton: dom.submitButton,
            nextStepLabel: dom.nextStepLabel,
            nextStepDetail: dom.nextStepDetail,
            fieldErrors: {
                subject: dom.subjectError,
                category: dom.categoryError,
                description: dom.descriptionError,
                orderId: dom.orderIdError
            }
        };

        const controller = customerSupportNewPage.attachSubmitHandler(elements, {
            ticketService,
            currentUser: { uid: "c-1", displayName: "Naledi" },
            navigate
        });

        expect(dom.nextStepLabel.textContent).toBe("Next: pick a category");

        await controller.handleSubmit({ preventDefault() {} });

        expect(ticketService.createTicket).not.toHaveBeenCalled();
        expect(dom.subjectError.textContent).toMatch(/at least/);
        expect(dom.categoryError.textContent).toMatch(/pick a category/i);
        expect(dom.descriptionError.textContent).toMatch(/describe/i);
        expect(dom.statusElement.textContent).toMatch(/highlighted/i);
        expect(navigate).not.toHaveBeenCalled();
    });

    test("attachSubmitHandler keeps the next step in sync as the form changes", () => {
        const dom = createDOM();

        customerSupportNewPage.attachSubmitHandler({
            form: dom.form,
            statusElement: dom.statusElement,
            submitButton: dom.submitButton,
            nextStepLabel: dom.nextStepLabel,
            nextStepDetail: dom.nextStepDetail,
            fieldErrors: {}
        }, {
            ticketService: { createTicket: jest.fn() },
            currentUser: { uid: "c-1" }
        });

        expect(dom.nextStepLabel.textContent).toBe("Next: pick a category");

        dom.categorySelect.value = "payment";
        dom.categorySelect.dispatchEvent(new Event("change", { bubbles: true }));
        expect(dom.nextStepLabel.textContent).toBe("Next: add the order ID");

        fillValidForm(dom, { category: "general", orderId: "" });
        dom.descriptionInput.dispatchEvent(new Event("input", { bubbles: true }));
        expect(dom.nextStepLabel.textContent).toBe("Next: submit ticket");
    });

    test("attachSubmitHandler refuses to submit when no user is signed in", async () => {
        const dom = createDOM();
        fillValidForm(dom);
        const ticketService = { createTicket: jest.fn() };
        const navigate = jest.fn();

        const controller = customerSupportNewPage.attachSubmitHandler({
            form: dom.form,
            statusElement: dom.statusElement,
            submitButton: dom.submitButton,
            nextStepLabel: dom.nextStepLabel,
            nextStepDetail: dom.nextStepDetail,
            fieldErrors: {
                subject: dom.subjectError,
                category: dom.categoryError,
                description: dom.descriptionError,
                orderId: dom.orderIdError
            }
        }, {
            ticketService,
            currentUser: null,
            navigate
        });

        const result = await controller.handleSubmit({ preventDefault() {} });
        expect(result.success).toBe(false);
        expect(result.error.code).toBe("not-signed-in");
        expect(ticketService.createTicket).not.toHaveBeenCalled();
        expect(dom.statusElement.textContent).toMatch(/sign in/i);
    });

    test("attachSubmitHandler calls the service, resets the form, and navigates to ticket-detail on success", async () => {
        const dom = createDOM();
        fillValidForm(dom);

        const ticketService = {
            createTicket: jest.fn(async () => ({
                success: true,
                ticket: { ticketId: "ticket-new" }
            }))
        };
        const navigate = jest.fn();

        const controller = customerSupportNewPage.attachSubmitHandler({
            form: dom.form,
            statusElement: dom.statusElement,
            submitButton: dom.submitButton,
            nextStepLabel: dom.nextStepLabel,
            nextStepDetail: dom.nextStepDetail,
            fieldErrors: {
                subject: dom.subjectError,
                category: dom.categoryError,
                description: dom.descriptionError,
                orderId: dom.orderIdError
            }
        }, {
            ticketService,
            currentUser: { uid: "customer-1", displayName: "Naledi", email: "n@example.com" },
            navigate,
            now: "2026-05-16T10:00:00Z"
        });

        const result = await controller.handleSubmit({ preventDefault() {} });

        expect(result.success).toBe(true);
        expect(ticketService.createTicket).toHaveBeenCalledTimes(1);
        const callArgs = ticketService.createTicket.mock.calls[0][0];
        expect(callArgs.input.subject).toBe("Order never arrived");
        expect(callArgs.input.category).toBe("order_issue");
        expect(callArgs.reporter).toEqual(expect.objectContaining({
            uid: "customer-1",
            displayName: "Naledi",
            role: "customer"
        }));

        expect(navigate).toHaveBeenCalledWith(
            expect.stringMatching(/ticket-detail\.html\?ticketId=ticket-new$/)
        );
        expect(dom.statusElement.textContent).toMatch(/Ticket opened/);
        expect(dom.subjectInput.value).toBe("");
        expect(dom.nextStepLabel.textContent).toBe("Next: pick a category");
    });

    test("attachSubmitHandler surfaces service errors as field/status messages", async () => {
        const dom = createDOM();
        fillValidForm(dom);

        const ticketService = {
            createTicket: jest.fn(async () => ({
                success: false,
                error: {
                    code: "tickets/validation-failed",
                    message: "Some required ticket fields are missing or invalid.",
                    errors: { subject: "Server says subject is bad." }
                }
            }))
        };
        const navigate = jest.fn();

        const controller = customerSupportNewPage.attachSubmitHandler({
            form: dom.form,
            statusElement: dom.statusElement,
            submitButton: dom.submitButton,
            fieldErrors: {
                subject: dom.subjectError,
                category: dom.categoryError,
                description: dom.descriptionError,
                orderId: dom.orderIdError
            }
        }, {
            ticketService,
            currentUser: { uid: "c-1", displayName: "Naledi" },
            navigate
        });

        const result = await controller.handleSubmit({ preventDefault() {} });

        expect(result.success).toBe(false);
        expect(navigate).not.toHaveBeenCalled();
        expect(dom.subjectError.textContent).toBe("Server says subject is bad.");
        expect(dom.statusElement.textContent).toMatch(/Some required ticket fields/);
        expect(dom.submitButton.disabled).toBe(false);
    });

    test("attachSubmitHandler routes to the list page when the service omits a ticketId", async () => {
        const dom = createDOM();
        fillValidForm(dom);

        const ticketService = {
            createTicket: jest.fn(async () => ({ success: true, ticket: {} }))
        };
        const navigate = jest.fn();

        const controller = customerSupportNewPage.attachSubmitHandler({
            form: dom.form,
            statusElement: dom.statusElement,
            submitButton: dom.submitButton,
            fieldErrors: {
                subject: dom.subjectError,
                category: dom.categoryError,
                description: dom.descriptionError,
                orderId: dom.orderIdError
            }
        }, {
            ticketService,
            currentUser: { uid: "c-1", displayName: "Naledi" },
            navigate
        });

        await controller.handleSubmit({ preventDefault() {} });

        expect(navigate).toHaveBeenCalledWith("./index.html");
    });

    test("attachSubmitHandler does not double-bind the form", () => {
        const dom = createDOM();
        const elements = {
            form: dom.form,
            statusElement: dom.statusElement,
            submitButton: dom.submitButton,
            fieldErrors: {}
        };

        const first = customerSupportNewPage.attachSubmitHandler(elements, {
            ticketService: { createTicket: jest.fn() }
        });
        expect(first).not.toBeNull();

        const second = customerSupportNewPage.attachSubmitHandler(elements, {
            ticketService: { createTicket: jest.fn() }
        });
        expect(second).toBeNull();
    });

    test("initializeCustomerSupportNewPage is an alias for init", async () => {
        document.body.innerHTML = "";
        const result = await customerSupportNewPage.initializeCustomerSupportNewPage();
        expect(result.success).toBe(false);
    });
});
