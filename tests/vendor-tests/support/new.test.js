/**
 * @jest-environment jsdom
 */

const vendorSupportNewPage = require("../../../public/vendor/support/new.js");

function createDOM() {
    document.body.innerHTML = `
        <p id="new-ticket-status"></p>
        <form id="new-ticket-form" novalidate>
            <input id="new-ticket-subject" name="subject" type="text">
            <p id="new-ticket-subject-error"></p>
            <select id="new-ticket-category" name="category">
                <option value="" selected>-- Pick --</option>
                <option value="order_issue">Order Issue</option>
                <option value="payment">Payment</option>
                <option value="general">General</option>
            </select>
            <p id="new-ticket-category-error"></p>
            <textarea id="new-ticket-description" name="description"></textarea>
            <p id="new-ticket-description-error"></p>
            <input id="new-ticket-order-id" name="orderId" type="text">
            <p id="new-ticket-order-id-error"></p>
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
        orderIdError: document.getElementById("new-ticket-order-id-error")
    };
}

function fillValidForm(dom, overrides = {}) {
    dom.subjectInput.value = overrides.subject !== undefined ? overrides.subject : "Payouts question";
    dom.categorySelect.value = overrides.category !== undefined ? overrides.category : "payment";
    dom.descriptionInput.value = overrides.description !== undefined
        ? overrides.description
        : "I have not received my payouts for the last week.";
    dom.orderIdInput.value = overrides.orderId !== undefined ? overrides.orderId : "order-7";
}

function makeAuthFns(currentUser) {
    return {
        onAuthStateChanged: jest.fn((auth, onChange) => {
            onChange(currentUser || null);
            return () => {};
        })
    };
}

describe("vendor/support/new.js - module surface", () => {
    test("exports the expected API", () => {
        expect(vendorSupportNewPage.MODULE_NAME).toBe("vendor/support/new");
        ["init", "initializeVendorSupportNewPage", "readFormValues", "validateFormValues",
            "buildReporterSnapshot", "submitTicket", "attachSubmitHandler",
            "buildTicketDetailUrl", "prefillFormFromQuery"
        ].forEach((name) => expect(typeof vendorSupportNewPage[name]).toBe("function"));
    });
});

describe("vendor/support/new.js - helpers", () => {
    test("readFormValues normalises form input", () => {
        const dom = createDOM();
        dom.subjectInput.value = "  Hi  ";
        dom.categorySelect.value = "general";
        dom.descriptionInput.value = " describe ";
        dom.orderIdInput.value = "order-1";

        expect(vendorSupportNewPage.readFormValues(dom.form)).toEqual({
            subject: "Hi", category: "general", description: "describe", orderId: "order-1"
        });
        expect(vendorSupportNewPage.readFormValues(null)).toBeNull();
    });

    test("validateFormValues catches missing fields and length issues", () => {
        const r = vendorSupportNewPage.validateFormValues({
            subject: "", category: "", description: "", orderId: ""
        });
        expect(r.isValid).toBe(false);
        expect(r.errors).toEqual({
            subject: expect.any(String),
            category: expect.any(String),
            description: expect.any(String)
        });

        const tooShort = vendorSupportNewPage.validateFormValues({
            subject: "no", category: "general",
            description: "tiny", orderId: ""
        });
        expect(tooShort.errors.subject).toMatch(/at least/);
        expect(tooShort.errors.description).toMatch(/at least/);
    });

    test("validateFormValues requires orderId for order-related categories", () => {
        const r = vendorSupportNewPage.validateFormValues({
            subject: "Refund pls", category: "refund",
            description: "Customer wants money back.",
            orderId: ""
        });
        expect(r.errors.orderId).toBeDefined();

        const okGeneral = vendorSupportNewPage.validateFormValues({
            subject: "Just a question",
            category: "general",
            description: "Asking about the payout schedule.",
            orderId: ""
        });
        expect(okGeneral.isValid).toBe(true);
    });

    test("buildReporterSnapshot returns vendor role", () => {
        expect(vendorSupportNewPage.buildReporterSnapshot({
            uid: "v-1", displayName: "Shop X", email: "X@e.com"
        })).toEqual({
            uid: "v-1", displayName: "Shop X", email: "x@e.com", role: "vendor"
        });
    });

    test("getOrderIdFromQuery + prefillFormFromQuery work end-to-end", () => {
        const dom = createDOM();
        window.history.pushState({}, "", "/vendor/support/new.html?orderId=order-9");
        expect(vendorSupportNewPage.getOrderIdFromQuery()).toBe("order-9");

        vendorSupportNewPage.prefillFormFromQuery(dom.form);
        expect(dom.orderIdInput.value).toBe("order-9");
        expect(dom.categorySelect.value).toBe("order_issue");
    });
});

describe("vendor/support/new.js - submit flow", () => {
    test("submitTicket flags missing service", async () => {
        const r = await vendorSupportNewPage.submitTicket({
            values: { subject: "x", description: "y", category: "general" },
            reporter: { uid: "v-1" }
        });
        expect(r.success).toBe(false);
        expect(r.error.code).toBe("no-ticket-service");
    });

    test("submitTicket calls createTicket with vendor reporter + vendor snapshot", async () => {
        const ticketService = {
            createTicket: jest.fn(async () => ({ success: true, ticket: { ticketId: "ticket-new" } }))
        };
        const r = await vendorSupportNewPage.submitTicket({
            ticketService,
            db: { kind: "db" },
            firestoreFns: {},
            values: { subject: "x", description: "y", category: "general" },
            reporter: { uid: "v-1", displayName: "Shop X", role: "vendor" },
            now: "T"
        });
        expect(r.success).toBe(true);
        expect(ticketService.createTicket).toHaveBeenCalledWith(expect.objectContaining({
            reporter: expect.objectContaining({ uid: "v-1" }),
            vendor: expect.objectContaining({ uid: "v-1" }),
            now: "T"
        }));
    });

    test("init renders status when no user is signed in", async () => {
        const dom = createDOM();
        const r = await vendorSupportNewPage.init({
            auth: { currentUser: null },
            authFns: makeAuthFns(null)
        });
        expect(r.success).toBe(false);
        expect(dom.submitButton.disabled).toBe(true);
        expect(dom.statusElement.textContent).toMatch(/sign in/i);
    });

    test("attachSubmitHandler short-circuits invalid forms", async () => {
        const dom = createDOM();
        dom.subjectInput.value = "no";
        const ticketService = { createTicket: jest.fn() };
        const navigate = jest.fn();

        const controller = vendorSupportNewPage.attachSubmitHandler({
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
            currentUser: { uid: "v-1", displayName: "Shop X" },
            navigate
        });

        await controller.handleSubmit({ preventDefault() {} });
        expect(ticketService.createTicket).not.toHaveBeenCalled();
        expect(dom.subjectError.textContent).toMatch(/at least/);
    });

    test("attachSubmitHandler navigates to detail on success", async () => {
        const dom = createDOM();
        fillValidForm(dom);

        const ticketService = {
            createTicket: jest.fn(async () => ({
                success: true,
                ticket: { ticketId: "ticket-new" }
            }))
        };
        const navigate = jest.fn();

        const controller = vendorSupportNewPage.attachSubmitHandler({
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
            currentUser: { uid: "vendor-1", displayName: "Shop X" },
            navigate
        });

        await controller.handleSubmit({ preventDefault() {} });

        expect(ticketService.createTicket).toHaveBeenCalledWith(expect.objectContaining({
            reporter: expect.objectContaining({ uid: "vendor-1", role: "vendor" })
        }));
        expect(navigate).toHaveBeenCalledWith(
            expect.stringMatching(/ticket-detail\.html\?ticketId=ticket-new$/)
        );
    });

    test("attachSubmitHandler refuses to double-bind", () => {
        const dom = createDOM();
        const elements = {
            form: dom.form,
            statusElement: dom.statusElement,
            submitButton: dom.submitButton,
            fieldErrors: {}
        };
        const opts = { ticketService: { createTicket: jest.fn() } };
        expect(vendorSupportNewPage.attachSubmitHandler(elements, opts)).not.toBeNull();
        expect(vendorSupportNewPage.attachSubmitHandler(elements, opts)).toBeNull();
    });
});
