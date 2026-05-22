(function attachVendorSupportNewPage(globalScope) {
    "use strict";

    const MODULE_NAME = "vendor/support/new";
    const SUBJECT_MIN_LENGTH = 3;
    const SUBJECT_MAX_LENGTH = 120;
    const DESCRIPTION_MIN_LENGTH = 10;
    const DESCRIPTION_MAX_LENGTH = 4000;
    const ORDER_ID_MAX_LENGTH = 80;
    const REQUIRES_ORDER_CATEGORIES = ["order_issue", "payment", "refund"];

    let initInFlight = null;

    function normalizeText(value) { return typeof value === "string" ? value.trim() : ""; }
    function normalizeLowerText(value) { return normalizeText(value).toLowerCase(); }

    function resolveFirestore(explicitDb) { return explicitDb || globalScope.db || null; }
    function resolveAuth(explicitAuth) { return explicitAuth || globalScope.auth || null; }
    function resolveAuthFns(explicitAuthFns) {
        if (explicitAuthFns && typeof explicitAuthFns === "object") return explicitAuthFns;
        if (globalScope.authFns && typeof globalScope.authFns === "object") return globalScope.authFns;
        return {};
    }
    function resolveFirestoreFns(explicitFirestoreFns) {
        if (explicitFirestoreFns && typeof explicitFirestoreFns === "object") return explicitFirestoreFns;
        if (globalScope.firestoreFns && typeof globalScope.firestoreFns === "object") return globalScope.firestoreFns;
        return {};
    }
    function resolveTicketService(explicitTicketService) {
        if (explicitTicketService && typeof explicitTicketService.createTicket === "function") return explicitTicketService;
        if (globalScope.ticketService && typeof globalScope.ticketService.createTicket === "function") return globalScope.ticketService;
        return null;
    }
    function resolveTicketCategories(explicitTicketCategories) {
        if (explicitTicketCategories && typeof explicitTicketCategories.isKnownTicketCategory === "function") return explicitTicketCategories;
        if (globalScope.ticketCategories && typeof globalScope.ticketCategories.isKnownTicketCategory === "function") return globalScope.ticketCategories;
        return null;
    }

    function getFallbackRoutes() {
        return { list: "./index.html", detail: "./ticket-detail.html", dashboard: "../index.html" };
    }

    function waitForAuthReady(auth, authFns, timeoutMs = 5000) {
        if (!auth || !authFns || typeof authFns.onAuthStateChanged !== "function") {
            return Promise.resolve(auth && auth.currentUser ? auth.currentUser : null);
        }
        return new Promise(function resolveAuthState(resolve) {
            let settled = false;
            let unsubscribe = function noop() { return undefined; };
            function finish(user) { if (settled) return; settled = true; unsubscribe(); resolve(user || null); }
            unsubscribe = authFns.onAuthStateChanged(auth,
                function onChange(user) { finish(user); },
                function onError() { finish(auth.currentUser || null); }
            );
            globalScope.setTimeout(function onTimeout() { finish(auth.currentUser || null); }, timeoutMs);
        });
    }

    function readFormValues(form) {
        if (!form) return null;
        const data = new globalScope.FormData(form);
        return {
            subject: normalizeText(data.get("subject")),
            category: normalizeLowerText(data.get("category")),
            description: normalizeText(data.get("description")),
            orderId: normalizeText(data.get("orderId"))
        };
    }

    function categoryRequiresOrderId(category, options = {}) {
        const ticketCategories = resolveTicketCategories(options.ticketCategories);
        if (ticketCategories && typeof ticketCategories.isOrderRelatedCategory === "function") {
            return ticketCategories.isOrderRelatedCategory(category) === true;
        }
        return REQUIRES_ORDER_CATEGORIES.indexOf(normalizeLowerText(category)) !== -1;
    }

    function validateFormValues(values, options = {}) {
        const safeValues = values && typeof values === "object" ? values : {};
        const ticketCategories = resolveTicketCategories(options.ticketCategories);
        const errors = {};

        const subject = normalizeText(safeValues.subject);
        if (!subject) errors.subject = "Please add a short subject.";
        else if (subject.length < SUBJECT_MIN_LENGTH) errors.subject = `Subject must be at least ${SUBJECT_MIN_LENGTH} characters.`;
        else if (subject.length > SUBJECT_MAX_LENGTH) errors.subject = `Subject must be at most ${SUBJECT_MAX_LENGTH} characters.`;

        const category = normalizeLowerText(safeValues.category);
        if (!category) errors.category = "Please pick a category.";
        else if (ticketCategories && !ticketCategories.isKnownTicketCategory(category)) {
            errors.category = "Category must be a known support category.";
        }

        const description = normalizeText(safeValues.description);
        if (!description) errors.description = "Please describe what is going on.";
        else if (description.length < DESCRIPTION_MIN_LENGTH) errors.description = `Description must be at least ${DESCRIPTION_MIN_LENGTH} characters.`;
        else if (description.length > DESCRIPTION_MAX_LENGTH) errors.description = `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters.`;

        const orderId = normalizeText(safeValues.orderId);
        if (orderId.length > ORDER_ID_MAX_LENGTH) {
            errors.orderId = `Order ID must be at most ${ORDER_ID_MAX_LENGTH} characters.`;
        }
        if (category && !errors.category && categoryRequiresOrderId(category, options) && !orderId) {
            errors.orderId = "This category needs the order it is about.";
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors,
            value: { subject, category, description, orderId }
        };
    }

    function buildReporterSnapshot(user) {
        const safeUser = user && typeof user === "object" ? user : {};
        return {
            uid: normalizeText(safeUser.uid),
            displayName: normalizeText(safeUser.displayName || safeUser.fullName || safeUser.name),
            email: normalizeLowerText(safeUser.email),
            role: "vendor"
        };
    }

    function getOrderIdFromQuery() {
        try {
            const params = new URLSearchParams(globalScope.location.search || "");
            return normalizeText(params.get("orderId") || params.get("order"));
        } catch (error) {
            return "";
        }
    }

    function prefillFormFromQuery(form, options = {}) {
        if (!form) return;
        const orderIdInput = form.querySelector("#new-ticket-order-id");
        const categorySelect = form.querySelector("#new-ticket-category");
        const orderId = normalizeText(options.orderId) || getOrderIdFromQuery();
        const category = normalizeLowerText(options.category);

        if (orderId && orderIdInput && !normalizeText(orderIdInput.value)) {
            orderIdInput.value = orderId;
            if (categorySelect && !normalizeText(categorySelect.value)) {
                categorySelect.value = "order_issue";
            }
        }
        if (category && categorySelect && !normalizeText(categorySelect.value)) {
            categorySelect.value = category;
        }
    }

    function getNewTicketNextStep(values, options = {}) {
        const safeValues = values && typeof values === "object" ? values : {};
        const category = normalizeLowerText(safeValues.category);
        const subject = normalizeText(safeValues.subject);
        const description = normalizeText(safeValues.description);
        const orderId = normalizeText(safeValues.orderId);

        if (!category) {
            return {
                label: "Next: pick a category",
                detail: "Choose the support area so your vendor ticket reaches the right team."
            };
        }

        if (categoryRequiresOrderId(category, options) && !orderId) {
            return {
                label: "Next: add the order ID",
                detail: "Order, payment, and refund tickets need the related order so support can investigate faster."
            };
        }

        if (!subject || subject.length < SUBJECT_MIN_LENGTH) {
            return {
                label: "Next: add a short subject",
                detail: `Use at least ${SUBJECT_MIN_LENGTH} characters to summarize the vendor issue.`
            };
        }

        if (!description || description.length < DESCRIPTION_MIN_LENGTH) {
            return {
                label: "Next: describe what happened",
                detail: `Share at least ${DESCRIPTION_MIN_LENGTH} characters with shop, order, payout, or timing details.`
            };
        }

        return {
            label: "Next: submit ticket",
            detail: "Everything required is filled in. Submit when you are ready."
        };
    }

    function setStatusMessage(element, message, state = "info") {
        if (!element) return;
        element.textContent = normalizeText(message);
        element.setAttribute("data-state", normalizeText(state) || "info");
    }

    function clearFieldErrors(elements) {
        if (!elements) return;
        Object.keys(elements).forEach(function clearOne(key) {
            const element = elements[key];
            if (element) {
                element.textContent = "";
                element.removeAttribute("data-state");
            }
        });
    }

    function showFieldErrors(elements, errors) {
        const safeElements = elements && typeof elements === "object" ? elements : {};
        const safeErrors = errors && typeof errors === "object" ? errors : {};
        Object.keys(safeErrors).forEach(function showOne(key) {
            const element = safeElements[key];
            if (element) {
                element.textContent = safeErrors[key];
                element.setAttribute("data-state", "error");
            }
        });
    }

    function setSubmitButtonState(button, busy) {
        if (!button) return;
        if (busy) { button.disabled = true; button.setAttribute("data-busy", "true"); }
        else { button.disabled = false; button.removeAttribute("data-busy"); }
    }

    function renderNextStep(elements, values, options = {}) {
        const safeElements = elements && typeof elements === "object" ? elements : {};
        const nextStep = getNewTicketNextStep(values, options);

        if (safeElements.nextStepLabel) {
            safeElements.nextStepLabel.textContent = nextStep.label;
        }

        if (safeElements.nextStepDetail) {
            safeElements.nextStepDetail.textContent = nextStep.detail;
        }

        return nextStep;
    }

    async function submitTicket(options = {}) {
        const ticketService = resolveTicketService(options.ticketService);
        const db = options.db || resolveFirestore();
        const firestoreFns = resolveFirestoreFns(options.firestoreFns);

        if (!ticketService) {
            return { success: false, error: { code: "no-ticket-service", message: "Support service is not available right now." } };
        }

        const values = options.values && typeof options.values === "object" ? options.values : {};
        const reporter = options.reporter && typeof options.reporter === "object" ? options.reporter : {};
        const vendor = options.vendor && typeof options.vendor === "object"
            ? options.vendor
            : { uid: reporter.uid, displayName: reporter.displayName };

        try {
            const result = await ticketService.createTicket({
                db, firestoreFns,
                input: values,
                reporter,
                vendor,
                now: options.now || new Date().toISOString()
            });
            return result || { success: false, error: { code: "unknown", message: "Unknown response from ticket service." } };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: normalizeText(error && error.code) || "create-failed",
                    message: normalizeText(error && error.message) || "Failed to open your ticket."
                }
            };
        }
    }

    function buildTicketDetailUrl(ticketId) {
        const url = new URL(getFallbackRoutes().detail, globalScope.location.href);
        url.searchParams.set("ticketId", normalizeText(ticketId));
        return url.toString();
    }

    function attachSubmitHandler(elements, options = {}) {
        const form = elements && elements.form;
        if (!form || form.dataset.vendorNewTicketBound === "true") return null;
        form.dataset.vendorNewTicketBound = "true";

        const navigate = typeof options.navigate === "function"
            ? options.navigate
            : function defaultNavigate(href) { globalScope.location.href = href; };

        function updateNextStep() {
            return renderNextStep(elements, readFormValues(form), options);
        }

        if (elements.nextStepLabel && form.dataset.vendorNewTicketNextStepBound !== "true") {
            form.dataset.vendorNewTicketNextStepBound = "true";
            form.addEventListener("input", updateNextStep);
            form.addEventListener("change", updateNextStep);
            updateNextStep();
        }

        async function handleSubmit(event) {
            if (event && typeof event.preventDefault === "function") event.preventDefault();

            clearFieldErrors(elements.fieldErrors);
            setStatusMessage(elements.statusElement, "");

            const values = readFormValues(form);
            const validation = validateFormValues(values, options);
            renderNextStep(elements, validation.value, options);

            if (!validation.isValid) {
                showFieldErrors(elements.fieldErrors, validation.errors);
                setStatusMessage(elements.statusElement, "Please fix the highlighted fields and try again.", "error");
                return validation;
            }

            const currentUser = options.currentUser || (options.auth && options.auth.currentUser) || null;

            if (!currentUser || !normalizeText(currentUser.uid)) {
                setStatusMessage(elements.statusElement, "Please sign in before opening a ticket.", "error");
                return { success: false, error: { code: "not-signed-in" } };
            }

            setSubmitButtonState(elements.submitButton, true);
            setStatusMessage(elements.statusElement, "Opening your ticket...", "loading");

            const reporter = buildReporterSnapshot(currentUser);
            const result = await submitTicket({
                ...options,
                values: validation.value,
                reporter,
                vendor: { uid: reporter.uid, displayName: reporter.displayName }
            });

            setSubmitButtonState(elements.submitButton, false);

            if (!result.success) {
                if (result.error && result.error.errors && typeof result.error.errors === "object") {
                    showFieldErrors(elements.fieldErrors, result.error.errors);
                }
                setStatusMessage(
                    elements.statusElement,
                    result.error && result.error.message ? result.error.message : "Failed to open your ticket.",
                    "error"
                );
                return result;
            }

            setStatusMessage(elements.statusElement, "Ticket opened. Redirecting...", "success");
            if (form && typeof form.reset === "function") {
                form.reset();
                updateNextStep();
            }
            const ticketId = result.ticket && result.ticket.ticketId;
            navigate(ticketId ? buildTicketDetailUrl(ticketId) : getFallbackRoutes().list);
            return result;
        }

        form.addEventListener("submit", handleSubmit);
        return { handleSubmit };
    }

    async function init(options = {}) {
        if (initInFlight) return initInFlight;

        initInFlight = (async function runInit() {
            const form = globalScope.document.querySelector(options.formSelector || "#new-ticket-form");
            const statusElement = globalScope.document.querySelector(options.statusSelector || "#new-ticket-status");
            const submitButton = globalScope.document.querySelector(options.submitButtonSelector || "#new-ticket-submit");
            const nextStepLabel = globalScope.document.querySelector(options.nextStepLabelSelector || "#new-ticket-next-step");
            const nextStepDetail = globalScope.document.querySelector(options.nextStepDetailSelector || "#new-ticket-next-step-detail");

            if (!form) return { success: false, error: "New ticket form not found." };

            const fieldErrors = {
                subject: globalScope.document.querySelector(options.subjectErrorSelector || "#new-ticket-subject-error"),
                category: globalScope.document.querySelector(options.categoryErrorSelector || "#new-ticket-category-error"),
                description: globalScope.document.querySelector(options.descriptionErrorSelector || "#new-ticket-description-error"),
                orderId: globalScope.document.querySelector(options.orderIdErrorSelector || "#new-ticket-order-id-error")
            };

            const elements = { form, statusElement, submitButton, fieldErrors, nextStepLabel, nextStepDetail };

            prefillFormFromQuery(form, options);
            renderNextStep(elements, readFormValues(form), options);

            const auth = options.auth || resolveAuth();
            const authFns = resolveAuthFns(options.authFns);
            const currentUser = options.currentUser || await waitForAuthReady(auth, authFns);

            if (!currentUser || !normalizeText(currentUser.uid)) {
                setStatusMessage(statusElement, "Please sign in to open a ticket.", "error");
                setSubmitButtonState(submitButton, true);
                return { success: false, error: "Please sign in to open a ticket." };
            }

            setStatusMessage(statusElement, "Tell us what is happening and we will follow up.", "info");
            setSubmitButtonState(submitButton, false);

            const controller = attachSubmitHandler(elements, { ...options, auth, currentUser });
            return { success: true, controller, currentUser };
        })();

        try { return await initInFlight; } finally { initInFlight = null; }
    }

    function initializeVendorSupportNewPage(options = {}) {
        return init(options);
    }

    const vendorSupportNewPage = {
        MODULE_NAME,
        SUBJECT_MIN_LENGTH, SUBJECT_MAX_LENGTH,
        DESCRIPTION_MIN_LENGTH, DESCRIPTION_MAX_LENGTH,
        ORDER_ID_MAX_LENGTH, REQUIRES_ORDER_CATEGORIES,
        normalizeText, normalizeLowerText,
        resolveFirestore, resolveAuth, resolveAuthFns, resolveFirestoreFns,
        resolveTicketService, resolveTicketCategories,
        getFallbackRoutes, waitForAuthReady,
        readFormValues, categoryRequiresOrderId, validateFormValues,
        buildReporterSnapshot, getOrderIdFromQuery, prefillFormFromQuery,
        setStatusMessage, clearFieldErrors, showFieldErrors, setSubmitButtonState,
        getNewTicketNextStep, renderNextStep,
        submitTicket, buildTicketDetailUrl, attachSubmitHandler,
        init, initializeVendorSupportNewPage
    };

    if (typeof module !== "undefined" && module.exports) module.exports = vendorSupportNewPage;
    if (typeof globalScope !== "undefined") globalScope.vendorSupportNewPage = vendorSupportNewPage;
})(typeof window !== "undefined" ? window : globalThis);
