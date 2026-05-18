(function attachCustomerSupportTicketDetailPage(globalScope) {
    "use strict";

    const MODULE_NAME = "customer/support/ticket-detail";
    const REPLY_MIN_LENGTH = 1;
    const REPLY_MAX_LENGTH = 4000;

    let initInFlight = null;

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
    }

    function resolveFirestore(explicitDb) {
        return explicitDb || globalScope.db || null;
    }

    function resolveAuth(explicitAuth) {
        return explicitAuth || globalScope.auth || null;
    }

    function resolveAuthFns(explicitAuthFns) {
        if (explicitAuthFns && typeof explicitAuthFns === "object") {
            return explicitAuthFns;
        }
        if (globalScope.authFns && typeof globalScope.authFns === "object") {
            return globalScope.authFns;
        }
        return {};
    }

    function resolveFirestoreFns(explicitFirestoreFns) {
        if (explicitFirestoreFns && typeof explicitFirestoreFns === "object") {
            return explicitFirestoreFns;
        }
        if (globalScope.firestoreFns && typeof globalScope.firestoreFns === "object") {
            return globalScope.firestoreFns;
        }
        return {};
    }

    function resolveTicketService(explicitTicketService) {
        if (
            explicitTicketService &&
            typeof explicitTicketService.getTicketById === "function"
        ) {
            return explicitTicketService;
        }
        if (
            globalScope.ticketService &&
            typeof globalScope.ticketService.getTicketById === "function"
        ) {
            return globalScope.ticketService;
        }
        return null;
    }

    function resolveTicketFormatters(explicitTicketFormatters) {
        if (
            explicitTicketFormatters &&
            typeof explicitTicketFormatters.formatTicketHeadline === "function"
        ) {
            return explicitTicketFormatters;
        }
        if (
            globalScope.ticketFormatters &&
            typeof globalScope.ticketFormatters.formatTicketHeadline === "function"
        ) {
            return globalScope.ticketFormatters;
        }
        return null;
    }

    function resolveTicketStatus(explicitTicketStatus) {
        if (
            explicitTicketStatus &&
            typeof explicitTicketStatus.normalizeTicketStatus === "function"
        ) {
            return explicitTicketStatus;
        }
        if (
            globalScope.ticketStatus &&
            typeof globalScope.ticketStatus.normalizeTicketStatus === "function"
        ) {
            return globalScope.ticketStatus;
        }
        return null;
    }

    function getFallbackRoutes() {
        return {
            list: "./index.html",
            newTicket: "./new.html",
            dashboard: "../index.html"
        };
    }

    function getTicketIdFromQuery() {
        try {
            const params = new URLSearchParams(globalScope.location.search || "");
            return normalizeText(params.get("ticketId") || params.get("id"));
        } catch (error) {
            return "";
        }
    }

    function waitForAuthReady(auth, authFns, timeoutMs = 5000) {
        if (!auth || !authFns || typeof authFns.onAuthStateChanged !== "function") {
            return Promise.resolve(auth && auth.currentUser ? auth.currentUser : null);
        }

        return new Promise(function resolveAuthState(resolve) {
            let settled = false;
            let unsubscribe = function noop() {
                return undefined;
            };

            function finish(user) {
                if (settled) {
                    return;
                }
                settled = true;
                unsubscribe();
                resolve(user || null);
            }

            unsubscribe = authFns.onAuthStateChanged(
                auth,
                function onChange(user) {
                    finish(user);
                },
                function onError() {
                    finish(auth.currentUser || null);
                }
            );

            globalScope.setTimeout(function onTimeout() {
                finish(auth.currentUser || null);
            }, timeoutMs);
        });
    }

    function setStatusMessage(element, message, state = "info") {
        if (!element) {
            return;
        }
        element.textContent = normalizeText(message);
        element.setAttribute("data-state", normalizeText(state) || "info");
    }

    function setOutputText(element, value, fallback = "—") {
        if (!element) {
            return;
        }
        const text = normalizeText(value);
        element.textContent = text || fallback;
    }

    function toggleHidden(element, hidden) {
        if (!element) {
            return;
        }
        if (hidden) {
            element.setAttribute("hidden", "");
        } else {
            element.removeAttribute("hidden");
        }
    }

    function setSubmitButtonState(button, busy) {
        if (!button) {
            return;
        }
        if (busy) {
            button.disabled = true;
            button.setAttribute("data-busy", "true");
        } else {
            button.disabled = false;
            button.removeAttribute("data-busy");
        }
    }

    function isTicketClosed(ticket, options = {}) {
        const ticketStatus = resolveTicketStatus(options.ticketStatus);
        const status = ticket && ticket.status;

        if (ticketStatus && typeof ticketStatus.isClosedTicketStatus === "function") {
            return ticketStatus.isClosedTicketStatus(status) === true;
        }

        const normalized = normalizeLowerText(status);
        return normalized === "closed";
    }

    function canReporterReopen(ticket, options = {}) {
        const status = normalizeLowerText(ticket && ticket.status);
        return status === "closed";
    }

    function canReporterClose(ticket, options = {}) {
        const status = normalizeLowerText(ticket && ticket.status);
        // Reporter can close from any active state or from "resolved" (accepting the resolution).
        return status === "open" ||
            status === "in_progress" ||
            status === "awaiting_user" ||
            status === "resolved";
    }

    function renderTicketSummary(elements, ticket, options = {}) {
        if (!elements || !ticket) {
            return;
        }

        const ticketFormatters = resolveTicketFormatters(options.ticketFormatters);

        const subject = ticketFormatters && typeof ticketFormatters.formatTicketHeadline === "function"
            ? ticketFormatters.formatTicketHeadline(ticket, options)
            : normalizeText(ticket.subject) || normalizeText(ticket.ticketId);

        const ticketIdText = ticketFormatters && typeof ticketFormatters.formatTicketId === "function"
            ? ticketFormatters.formatTicketId(ticket.ticketId)
            : (normalizeText(ticket.ticketId) ? `Ticket #${normalizeText(ticket.ticketId).slice(-6)}` : "—");

        const statusLabel = ticketFormatters && typeof ticketFormatters.getTicketStatusLabel === "function"
            ? ticketFormatters.getTicketStatusLabel(ticket.status, options.ticketStatus)
            : normalizeText(ticket.statusLabel) || normalizeText(ticket.status);
        const statusTone = ticketFormatters && typeof ticketFormatters.getTicketStatusTone === "function"
            ? ticketFormatters.getTicketStatusTone(ticket.status, options.ticketStatus)
            : "info";

        const categoryLabel = ticketFormatters && typeof ticketFormatters.getTicketCategoryLabel === "function"
            ? ticketFormatters.getTicketCategoryLabel(ticket.category, options.ticketCategories)
            : normalizeText(ticket.categoryLabel) || normalizeText(ticket.category);
        const categoryTone = ticketFormatters && typeof ticketFormatters.getTicketCategoryTone === "function"
            ? ticketFormatters.getTicketCategoryTone(ticket.category, options.ticketCategories)
            : "info";

        const priorityLabel = ticketFormatters && typeof ticketFormatters.getTicketPriorityLabel === "function"
            ? ticketFormatters.getTicketPriorityLabel(ticket.priority)
            : (normalizeLowerText(ticket.priority) === "high" ? "High" : "Normal");
        const priorityTone = ticketFormatters && typeof ticketFormatters.getTicketPriorityTone === "function"
            ? ticketFormatters.getTicketPriorityTone(ticket.priority)
            : "neutral";

        const reporterText = ticketFormatters && typeof ticketFormatters.formatReporter === "function"
            ? ticketFormatters.formatReporter(ticket)
            : normalizeText(ticket.reporterName) || normalizeText(ticket.reporterUid);

        const openedText = ticketFormatters && typeof ticketFormatters.formatDateTime === "function"
            ? ticketFormatters.formatDateTime(ticket.createdAt, options)
            : normalizeText(ticket.createdAt);

        const repliesText = ticketFormatters && typeof ticketFormatters.formatReplyCount === "function"
            ? ticketFormatters.formatReplyCount(ticket.replyCount)
            : `${Number(ticket.replyCount || 0)} repl${Number(ticket.replyCount || 0) === 1 ? "y" : "ies"}`;

        const resolutionText = ticketFormatters && typeof ticketFormatters.formatResolutionStatement === "function"
            ? ticketFormatters.formatResolutionStatement(ticket, options)
            : "";

        setOutputText(elements.subject, subject);
        setOutputText(elements.ticketIdText, ticketIdText);

        if (elements.status) {
            setOutputText(elements.status, statusLabel);
            elements.status.setAttribute("data-tone", statusTone);
            elements.status.setAttribute("data-status", normalizeLowerText(ticket.status));
        }

        if (elements.category) {
            setOutputText(elements.category, categoryLabel);
            elements.category.setAttribute("data-tone", categoryTone);
        }

        if (elements.priority) {
            setOutputText(elements.priority, priorityLabel);
            elements.priority.setAttribute("data-tone", priorityTone);
        }

        setOutputText(elements.reporter, reporterText, "Customer");
        setOutputText(elements.order, normalizeText(ticket.orderId), "Not linked to an order");
        setOutputText(elements.opened, openedText);
        setOutputText(elements.replies, repliesText);

        if (elements.description) {
            elements.description.textContent = normalizeText(ticket.description) || "—";
        }

        if (elements.resolution) {
            elements.resolution.textContent = resolutionText;
            toggleHidden(elements.resolution, !resolutionText);
        }
    }

    function renderTimeline(container, ticket, options = {}) {
        if (!container) {
            return;
        }

        const ticketFormatters = resolveTicketFormatters(options.ticketFormatters);
        const entries = ticketFormatters && typeof ticketFormatters.formatTimeline === "function"
            ? ticketFormatters.formatTimeline(ticket, options)
            : Array.isArray(ticket && ticket.timeline) ? ticket.timeline : [];

        container.innerHTML = "";

        if (!entries || entries.length === 0) {
            const empty = globalScope.document.createElement("li");
            empty.className = "ticket-timeline-empty";
            empty.textContent = "No timeline events yet.";
            container.appendChild(empty);
            return;
        }

        entries.forEach(function appendEntry(entry) {
            const item = globalScope.document.createElement("li");
            item.className = "ticket-timeline-entry";
            item.setAttribute("data-event-type", normalizeLowerText(entry.eventType));
            item.setAttribute("data-tone", normalizeLowerText(entry.statusTone) || "info");

            const heading = globalScope.document.createElement("p");
            heading.className = "ticket-timeline-label";
            heading.textContent = `${normalizeText(entry.eventLabel)} — ${normalizeText(entry.statusLabel)}`;

            const actor = globalScope.document.createElement("p");
            actor.className = "ticket-timeline-actor";
            actor.textContent = `${normalizeText(entry.actorLabel)} • ${normalizeText(entry.relativeText)}`;

            item.appendChild(heading);
            item.appendChild(actor);

            if (normalizeText(entry.note)) {
                const note = globalScope.document.createElement("p");
                note.className = "ticket-timeline-note";
                note.textContent = entry.note;
                item.appendChild(note);
            }

            container.appendChild(item);
        });
    }

    function renderReplies(container, emptyMessage, replies, options = {}) {
        if (!container) {
            return;
        }

        const ticketFormatters = resolveTicketFormatters(options.ticketFormatters);
        const entries = ticketFormatters && typeof ticketFormatters.formatReplyEntries === "function"
            ? ticketFormatters.formatReplyEntries(replies, {
                ...options,
                includeInternalNotes: false
            })
            : (Array.isArray(replies)
                ? replies.filter(function dropInternal(reply) {
                    return !(reply && reply.isInternalNote === true);
                })
                : []);

        container.innerHTML = "";

        if (!entries || entries.length === 0) {
            toggleHidden(emptyMessage, false);
            return;
        }

        toggleHidden(emptyMessage, true);

        entries.forEach(function appendReply(entry) {
            const item = globalScope.document.createElement("li");
            item.className = "ticket-reply-entry";
            item.setAttribute("data-author-role", normalizeLowerText(entry.authorRole));
            if (entry.isInternalNote === true) {
                item.setAttribute("data-internal", "true");
            }

            const author = globalScope.document.createElement("p");
            author.className = "ticket-reply-author";
            author.textContent = `${normalizeText(entry.authorLabel)} • ${normalizeText(entry.relativeText)}`;

            const body = globalScope.document.createElement("p");
            body.className = "ticket-reply-body";
            body.textContent = normalizeText(entry.body);

            item.appendChild(author);
            item.appendChild(body);

            container.appendChild(item);
        });
    }

    function applyTicketStatusToActions(elements, ticket, options = {}) {
        if (!elements || !ticket) {
            return;
        }

        const closed = isTicketClosed(ticket, options);
        const canClose = canReporterClose(ticket, options);
        const canReopen = canReporterReopen(ticket, options);

        toggleHidden(elements.replyFormSection, closed);
        toggleHidden(elements.closeButton, !canClose);
        toggleHidden(elements.reopenButton, !canReopen);

        if (closed && elements.replyFormSection) {
            elements.replyFormSection.setAttribute("data-state", "read-only");
        } else if (elements.replyFormSection) {
            elements.replyFormSection.setAttribute("data-state", "open");
        }
    }

    async function loadTicketAndReplies(options = {}) {
        const ticketService = resolveTicketService(options.ticketService);
        const db = options.db || resolveFirestore();
        const firestoreFns = resolveFirestoreFns(options.firestoreFns);
        const ticketId = normalizeText(options.ticketId);

        if (!ticketService) {
            return {
                success: false,
                error: { code: "no-ticket-service", message: "Support service is not available right now." }
            };
        }

        if (!ticketId) {
            return {
                success: false,
                error: { code: "no-ticket-id", message: "We could not find which ticket to open." }
            };
        }

        try {
            const ticket = await ticketService.getTicketById({
                db,
                firestoreFns,
                ticketId,
                ticketQueries: options.ticketQueries
            });

            if (!ticket) {
                return {
                    success: false,
                    error: { code: "not-found", message: "This ticket could not be found." }
                };
            }

            let replies = [];
            if (typeof ticketService.getTicketReplies === "function") {
                try {
                    replies = await ticketService.getTicketReplies({
                        db,
                        firestoreFns,
                        ticketId,
                        ticketQueries: options.ticketQueries,
                        includeInternalNotes: false
                    });
                } catch (error) {
                    console.error(`${MODULE_NAME}: failed to load replies`, error);
                    replies = [];
                }
            }

            return {
                success: true,
                ticket,
                replies: Array.isArray(replies) ? replies : []
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: normalizeText(error && error.code) || "fetch-error",
                    message: normalizeText(error && error.message) ||
                        "Failed to load the ticket."
                }
            };
        }
    }

    function renderTicket(elements, ticket, replies, options = {}) {
        renderTicketSummary(elements, ticket, options);
        renderTimeline(elements.timelineContainer, ticket, options);
        renderReplies(elements.repliesContainer, elements.repliesEmpty, replies, options);
        applyTicketStatusToActions(elements, ticket, options);

        toggleHidden(elements.summarySection, false);
        toggleHidden(elements.progressSection, false);
        toggleHidden(elements.repliesSection, false);
        toggleHidden(elements.actionsSection, false);
    }

    async function submitReply(options = {}) {
        const ticketService = resolveTicketService(options.ticketService);
        const db = options.db || resolveFirestore();
        const firestoreFns = resolveFirestoreFns(options.firestoreFns);

        if (!ticketService || typeof ticketService.addReply !== "function") {
            return {
                success: false,
                error: { code: "no-ticket-service", message: "Support service is not available right now." }
            };
        }

        const ticket = options.ticket && typeof options.ticket === "object" ? options.ticket : null;
        const body = normalizeText(options.body);
        const currentUser = options.currentUser && typeof options.currentUser === "object"
            ? options.currentUser
            : null;

        if (!ticket || !normalizeText(ticket.ticketId)) {
            return {
                success: false,
                error: { code: "no-ticket", message: "Cannot reply without an open ticket." }
            };
        }

        if (!currentUser || !normalizeText(currentUser.uid)) {
            return {
                success: false,
                error: { code: "not-signed-in", message: "Please sign in before replying." }
            };
        }

        if (!body) {
            return {
                success: false,
                error: { code: "empty-reply", message: "Reply body cannot be empty." }
            };
        }

        if (body.length > REPLY_MAX_LENGTH) {
            return {
                success: false,
                error: { code: "reply-too-long", message: `Reply must be at most ${REPLY_MAX_LENGTH} characters.` }
            };
        }

        try {
            const result = await ticketService.addReply({
                db,
                firestoreFns,
                ticket,
                reply: {
                    body,
                    authorRole: "customer",
                    authorUid: currentUser.uid,
                    authorName: normalizeText(currentUser.displayName)
                },
                now: options.now || new Date().toISOString()
            });

            return result || {
                success: false,
                error: { code: "unknown", message: "Unknown response from ticket service." }
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: normalizeText(error && error.code) || "reply-failed",
                    message: normalizeText(error && error.message) || "Failed to send your reply."
                }
            };
        }
    }

    async function changeTicketStatus(options = {}) {
        const ticketService = resolveTicketService(options.ticketService);
        const db = options.db || resolveFirestore();
        const firestoreFns = resolveFirestoreFns(options.firestoreFns);
        const action = normalizeLowerText(options.action);
        const ticket = options.ticket && typeof options.ticket === "object" ? options.ticket : null;
        const currentUser = options.currentUser || null;

        if (!ticketService) {
            return {
                success: false,
                error: { code: "no-ticket-service", message: "Support service is not available right now." }
            };
        }

        if (!ticket || !normalizeText(ticket.ticketId)) {
            return {
                success: false,
                error: { code: "no-ticket", message: "Cannot change a ticket that does not exist." }
            };
        }

        if (!currentUser || !normalizeText(currentUser.uid)) {
            return {
                success: false,
                error: { code: "not-signed-in", message: "Please sign in to update this ticket." }
            };
        }

        try {
            if (action === "close" && typeof ticketService.closeTicketByReporter === "function") {
                return await ticketService.closeTicketByReporter({
                    db,
                    firestoreFns,
                    ticket,
                    actorRole: "customer",
                    actorUid: currentUser.uid,
                    actorName: normalizeText(currentUser.displayName),
                    now: options.now || new Date().toISOString()
                });
            }

            if (action === "reopen" && typeof ticketService.reopenTicket === "function") {
                return await ticketService.reopenTicket({
                    db,
                    firestoreFns,
                    ticket,
                    actorRole: "customer",
                    actorUid: currentUser.uid,
                    actorName: normalizeText(currentUser.displayName),
                    now: options.now || new Date().toISOString()
                });
            }

            return {
                success: false,
                error: { code: "unknown-action", message: `Unknown ticket action: ${action}.` }
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: normalizeText(error && error.code) || "status-update-failed",
                    message: normalizeText(error && error.message) || "Failed to update the ticket."
                }
            };
        }
    }

    function attachReplyHandler(elements, options) {
        const form = elements && elements.replyForm;
        if (!form || form.dataset.replyBound === "true") {
            return null;
        }
        form.dataset.replyBound = "true";

        async function handleSubmit(event) {
            if (event && typeof event.preventDefault === "function") {
                event.preventDefault();
            }

            const bodyInput = elements.replyBodyInput;
            const body = normalizeText(bodyInput && bodyInput.value);

            if (!body) {
                setStatusMessage(elements.replyErrorElement, "Reply body cannot be empty.", "error");
                return { success: false };
            }

            setStatusMessage(elements.replyErrorElement, "");
            setSubmitButtonState(elements.replySubmitButton, true);
            setStatusMessage(elements.statusElement, "Sending your reply...", "loading");

            const result = await submitReply({
                ...options.runtime(),
                body
            });

            setSubmitButtonState(elements.replySubmitButton, false);

            if (!result.success) {
                setStatusMessage(
                    elements.replyErrorElement,
                    result.error && result.error.message ? result.error.message : "Failed to send your reply.",
                    "error"
                );
                setStatusMessage(elements.statusElement, "Could not send your reply.", "error");
                return result;
            }

            if (bodyInput) {
                bodyInput.value = "";
            }
            setStatusMessage(elements.statusElement, "Reply sent.", "success");
            await options.refresh();
            return result;
        }

        form.addEventListener("submit", handleSubmit);
        return { handleSubmit };
    }

    function attachActionHandlers(elements, options) {
        const closeButton = elements && elements.closeButton;
        const reopenButton = elements && elements.reopenButton;
        const handlers = {};

        if (closeButton && closeButton.dataset.closeBound !== "true") {
            closeButton.dataset.closeBound = "true";
            handlers.closeHandler = async function handleClose(event) {
                if (event && typeof event.preventDefault === "function") {
                    event.preventDefault();
                }

                setSubmitButtonState(closeButton, true);
                setStatusMessage(elements.statusElement, "Closing your ticket...", "loading");

                const result = await changeTicketStatus({
                    ...options.runtime(),
                    action: "close"
                });

                setSubmitButtonState(closeButton, false);

                if (!result.success) {
                    setStatusMessage(
                        elements.statusElement,
                        result.error && result.error.message ? result.error.message : "Failed to close ticket.",
                        "error"
                    );
                    return result;
                }

                setStatusMessage(elements.statusElement, "Ticket closed.", "success");
                await options.refresh();
                return result;
            };

            closeButton.addEventListener("click", handlers.closeHandler);
        }

        if (reopenButton && reopenButton.dataset.reopenBound !== "true") {
            reopenButton.dataset.reopenBound = "true";
            handlers.reopenHandler = async function handleReopen(event) {
                if (event && typeof event.preventDefault === "function") {
                    event.preventDefault();
                }

                setSubmitButtonState(reopenButton, true);
                setStatusMessage(elements.statusElement, "Reopening your ticket...", "loading");

                const result = await changeTicketStatus({
                    ...options.runtime(),
                    action: "reopen"
                });

                setSubmitButtonState(reopenButton, false);

                if (!result.success) {
                    setStatusMessage(
                        elements.statusElement,
                        result.error && result.error.message ? result.error.message : "Failed to reopen ticket.",
                        "error"
                    );
                    return result;
                }

                setStatusMessage(elements.statusElement, "Ticket reopened.", "success");
                await options.refresh();
                return result;
            };

            reopenButton.addEventListener("click", handlers.reopenHandler);
        }

        return handlers;
    }

    function collectElements(options = {}) {
        const doc = globalScope.document;

        return {
            statusElement: doc.querySelector(options.statusSelector || "#ticket-detail-status"),
            summarySection: doc.querySelector(options.summarySelector || "#ticket-summary-section"),
            subject: doc.querySelector(options.subjectSelector || "#ticket-summary-subject"),
            ticketIdText: doc.querySelector(options.ticketIdSelector || "#ticket-summary-id"),
            status: doc.querySelector(options.statusOutputSelector || "#ticket-summary-status"),
            category: doc.querySelector(options.categoryOutputSelector || "#ticket-summary-category"),
            priority: doc.querySelector(options.priorityOutputSelector || "#ticket-summary-priority"),
            reporter: doc.querySelector(options.reporterOutputSelector || "#ticket-summary-reporter"),
            order: doc.querySelector(options.orderOutputSelector || "#ticket-summary-order"),
            opened: doc.querySelector(options.openedOutputSelector || "#ticket-summary-opened"),
            replies: doc.querySelector(options.repliesCountSelector || "#ticket-summary-replies"),
            resolution: doc.querySelector(options.resolutionSelector || "#ticket-summary-resolution"),
            description: doc.querySelector(options.descriptionSelector || "#ticket-description-body"),
            progressSection: doc.querySelector(options.progressSectionSelector || "#ticket-progress-section"),
            timelineContainer: doc.querySelector(options.timelineSelector || "#ticket-progress-steps"),
            repliesSection: doc.querySelector(options.repliesSectionSelector || "#ticket-replies-section"),
            repliesContainer: doc.querySelector(options.repliesListSelector || "#ticket-replies-list"),
            repliesEmpty: doc.querySelector(options.repliesEmptySelector || "#ticket-replies-empty"),
            replyFormSection: doc.querySelector(options.replyFormSectionSelector || "#ticket-reply-form-section"),
            replyForm: doc.querySelector(options.replyFormSelector || "#ticket-reply-form"),
            replyBodyInput: doc.querySelector(options.replyBodySelector || "#ticket-reply-body"),
            replySubmitButton: doc.querySelector(options.replySubmitSelector || "#ticket-reply-submit"),
            replyErrorElement: doc.querySelector(options.replyErrorSelector || "#ticket-reply-error"),
            actionsSection: doc.querySelector(options.actionsSectionSelector || "#ticket-actions-section"),
            closeButton: doc.querySelector(options.closeButtonSelector || "#ticket-close-button"),
            reopenButton: doc.querySelector(options.reopenButtonSelector || "#ticket-reopen-button")
        };
    }

    async function init(options = {}) {
        if (initInFlight) {
            return initInFlight;
        }

        initInFlight = (async function runInit() {
            const elements = collectElements(options);

            if (!elements.summarySection || !elements.timelineContainer) {
                return { success: false, error: "Ticket detail page elements not found." };
            }

            const ticketId = normalizeText(options.ticketId) || getTicketIdFromQuery();

            if (!ticketId) {
                setStatusMessage(elements.statusElement, "No ticket selected.", "error");
                return { success: false, error: "No ticket selected." };
            }

            const auth = options.auth || resolveAuth();
            const authFns = resolveAuthFns(options.authFns);
            const db = options.db || resolveFirestore();
            const firestoreFns = resolveFirestoreFns(options.firestoreFns);

            setStatusMessage(elements.statusElement, "Loading your ticket...", "loading");

            const currentUser = options.currentUser || await waitForAuthReady(auth, authFns);

            if (!currentUser || !normalizeText(currentUser.uid)) {
                setStatusMessage(
                    elements.statusElement,
                    "Please sign in to view this ticket.",
                    "error"
                );
                return { success: false, error: "Please sign in to view this ticket." };
            }

            let latestTicket = null;
            let latestReplies = [];

            async function load() {
                const result = await loadTicketAndReplies({
                    ...options,
                    db,
                    firestoreFns,
                    ticketId
                });

                if (!result.success) {
                    setStatusMessage(
                        elements.statusElement,
                        result.error && result.error.message
                            ? result.error.message
                            : "Failed to load the ticket.",
                        "error"
                    );
                    return result;
                }

                latestTicket = result.ticket;
                latestReplies = result.replies;

                renderTicket(elements, latestTicket, latestReplies, options);
                setStatusMessage(elements.statusElement, "", "info");
                return result;
            }

            const initialLoad = await load();
            if (!initialLoad.success) {
                return initialLoad;
            }

            const runtimeOptions = {
                runtime: function buildRuntimeOptions() {
                    return {
                        ...options,
                        db,
                        firestoreFns,
                        ticket: latestTicket,
                        currentUser
                    };
                },
                refresh: load
            };

            attachReplyHandler(elements, runtimeOptions);
            attachActionHandlers(elements, runtimeOptions);

            return { success: true, ticket: latestTicket, replies: latestReplies };
        })();

        try {
            return await initInFlight;
        } finally {
            initInFlight = null;
        }
    }

    function initializeCustomerSupportTicketDetailPage(options = {}) {
        return init(options);
    }

    const customerSupportTicketDetailPage = {
        MODULE_NAME,
        REPLY_MIN_LENGTH,
        REPLY_MAX_LENGTH,
        normalizeText,
        normalizeLowerText,
        resolveFirestore,
        resolveAuth,
        resolveAuthFns,
        resolveFirestoreFns,
        resolveTicketService,
        resolveTicketFormatters,
        resolveTicketStatus,
        getFallbackRoutes,
        getTicketIdFromQuery,
        waitForAuthReady,
        setStatusMessage,
        setOutputText,
        toggleHidden,
        setSubmitButtonState,
        isTicketClosed,
        canReporterReopen,
        canReporterClose,
        renderTicketSummary,
        renderTimeline,
        renderReplies,
        applyTicketStatusToActions,
        loadTicketAndReplies,
        renderTicket,
        submitReply,
        changeTicketStatus,
        attachReplyHandler,
        attachActionHandlers,
        collectElements,
        init,
        initializeCustomerSupportTicketDetailPage
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerSupportTicketDetailPage;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.customerSupportTicketDetailPage = customerSupportTicketDetailPage;
    }
})(typeof window !== "undefined" ? window : globalThis);
