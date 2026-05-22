(function attachAdminDisputesPage(globalScope) {
    "use strict";

    const MODULE_NAME = "admin/disputes";
    const DEFAULT_PAGE_SIZE = 12;
    const DEFAULT_SORT = "newest";
    const PAGE_SIZE_OPTIONS = [12, 25, 50, 100];

    let initInFlight = null;

    const pageState = {
        allTickets: [],
        filters: {
            search: "",
            status: "all",
            category: "all",
            reporterRole: "all",
            sort: DEFAULT_SORT
        },
        currentPage: 1,
        pageSize: DEFAULT_PAGE_SIZE
    };

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
        if (explicitTicketService && typeof explicitTicketService.getAdminTickets === "function") return explicitTicketService;
        if (globalScope.ticketService && typeof globalScope.ticketService.getAdminTickets === "function") return globalScope.ticketService;
        return null;
    }

    function resolveTicketStatus(explicitTicketStatus) {
        if (explicitTicketStatus && typeof explicitTicketStatus.getTicketStatusLabel === "function") return explicitTicketStatus;
        if (globalScope.ticketStatus && typeof globalScope.ticketStatus.getTicketStatusLabel === "function") return globalScope.ticketStatus;
        return null;
    }

    function resolveTicketCategories(explicitTicketCategories) {
        if (explicitTicketCategories && typeof explicitTicketCategories.getTicketCategoryLabel === "function") return explicitTicketCategories;
        if (globalScope.ticketCategories && typeof globalScope.ticketCategories.getTicketCategoryLabel === "function") return globalScope.ticketCategories;
        return null;
    }

    function resolveTicketFormatters(explicitTicketFormatters) {
        if (explicitTicketFormatters && typeof explicitTicketFormatters.formatTicketId === "function") return explicitTicketFormatters;
        if (globalScope.ticketFormatters && typeof globalScope.ticketFormatters.formatTicketId === "function") return globalScope.ticketFormatters;
        return null;
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

    function getTicketTimestampValue(value) {
        if (!value) return 0;
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string") {
            const parsed = Date.parse(value);
            return Number.isFinite(parsed) ? parsed : 0;
        }
        if (typeof value.toMillis === "function") {
            const millis = value.toMillis();
            return Number.isFinite(millis) ? millis : 0;
        }
        if (value instanceof Date) return value.getTime();
        if (typeof value.seconds === "number" && Number.isFinite(value.seconds)) {
            return value.seconds * 1000;
        }
        return 0;
    }

    function mapTicketRecord(ticketRecord, options = {}) {
        const safeTicket = ticketRecord && typeof ticketRecord === "object" ? ticketRecord : {};
        const ticketStatus = resolveTicketStatus(options.ticketStatus);
        const ticketCategories = resolveTicketCategories(options.ticketCategories);
        const ticketFormatters = resolveTicketFormatters(options.ticketFormatters);

        const ticketId = normalizeText(safeTicket.ticketId || safeTicket.id);
        const subject = normalizeText(safeTicket.subject) ||
            (ticketFormatters && typeof ticketFormatters.formatTicketId === "function"
                ? ticketFormatters.formatTicketId(ticketId)
                : `Ticket #${ticketId.slice(-6) || "—"}`);

        const statusKey = ticketStatus && typeof ticketStatus.normalizeTicketStatus === "function"
            ? ticketStatus.normalizeTicketStatus(safeTicket.status, "open")
            : normalizeLowerText(safeTicket.status) || "open";
        const statusLabel = ticketStatus && typeof ticketStatus.getTicketStatusLabel === "function"
            ? ticketStatus.getTicketStatusLabel(statusKey) : statusKey;
        const statusTone = ticketStatus && typeof ticketStatus.getTicketStatusTone === "function"
            ? ticketStatus.getTicketStatusTone(statusKey) : "info";

        const categoryKey = ticketCategories && typeof ticketCategories.normalizeTicketCategory === "function"
            ? ticketCategories.normalizeTicketCategory(safeTicket.category, "general")
            : normalizeLowerText(safeTicket.category) || "general";
        const categoryLabel = ticketCategories && typeof ticketCategories.getTicketCategoryLabel === "function"
            ? ticketCategories.getTicketCategoryLabel(categoryKey) : categoryKey;

        const reporterRole = normalizeLowerText(safeTicket.reporterRole) || "customer";
        const reporterName = normalizeText(safeTicket.reporterName) ||
            normalizeText(safeTicket.reporterUid) || "Unknown reporter";

        const replyCount = Number.isFinite(Number(safeTicket.replyCount)) ? Number(safeTicket.replyCount) : 0;
        const replyCountText = ticketFormatters && typeof ticketFormatters.formatReplyCount === "function"
            ? ticketFormatters.formatReplyCount(replyCount)
            : (replyCount === 0 ? "No replies yet" : `${replyCount} repl${replyCount === 1 ? "y" : "ies"}`);

        const lastActivity = safeTicket.lastReplyAt || safeTicket.updatedAt || safeTicket.createdAt || null;
        const lastActivityText = ticketFormatters && typeof ticketFormatters.formatRelativeTime === "function"
            ? ticketFormatters.formatRelativeTime(lastActivity, { emptyValue: "" })
            : (lastActivity ? new Date(getTicketTimestampValue(lastActivity)).toLocaleString() : "");

        return {
            ticketId, subject,
            statusKey, statusLabel, statusTone,
            categoryKey, categoryLabel,
            reporterRole, reporterName,
            reporterUid: normalizeText(safeTicket.reporterUid),
            customerUid: normalizeText(safeTicket.customerUid),
            vendorUid: normalizeText(safeTicket.vendorUid),
            orderId: normalizeText(safeTicket.orderId),
            replyCount, replyCountText,
            priority: normalizeLowerText(safeTicket.priority) || "normal",
            lastActivity, lastActivityText
        };
    }

    async function fetchAdminTickets(options = {}) {
        const db = options.db || resolveFirestore();
        const firestoreFns = resolveFirestoreFns(options.firestoreFns);
        const ticketService = resolveTicketService(options.ticketService);

        if (!(ticketService && typeof ticketService.getAdminTickets === "function" && db)) {
            return {
                success: false, tickets: [],
                error: { code: "no-ticket-service", message: "Support service is not available right now." }
            };
        }

        try {
            const tickets = await ticketService.getAdminTickets({
                db, firestoreFns,
                ticketQueries: options.ticketQueries
            });
            return { success: true, tickets: Array.isArray(tickets) ? tickets : [] };
        } catch (error) {
            console.error(`${MODULE_NAME}: Error fetching admin tickets:`, error);
            return {
                success: false, tickets: [],
                error: {
                    code: normalizeText(error && error.code) || "fetch-error",
                    message: normalizeText(error && error.message) || "Failed to load support tickets."
                }
            };
        }
    }

    function setStatusMessage(element, message, state = "info") {
        if (!element) return;
        element.textContent = normalizeText(message);
        element.setAttribute("data-state", normalizeText(state) || "info");
    }

    function buildTicketDetailUrl(ticketId) {
        const url = new URL("./ticket-detail.html", globalScope.location.href);
        url.searchParams.set("ticketId", normalizeText(ticketId));
        return url.toString();
    }

    function createTicketCard(ticketRecord, options = {}) {
        const ticket = mapTicketRecord(ticketRecord, options);
        const article = globalScope.document.createElement("article");
        article.className = "admin-inbox-ticket-card";
        article.setAttribute("data-ticket-id", ticket.ticketId);
        article.setAttribute("data-status", ticket.statusKey);
        article.setAttribute("data-category", ticket.categoryKey);
        article.setAttribute("data-reporter-role", ticket.reporterRole);
        article.setAttribute("data-priority", ticket.priority);

        const heading = globalScope.document.createElement("h4");
        heading.className = "admin-inbox-ticket-subject";
        heading.textContent = ticket.subject;

        const reporterLine = globalScope.document.createElement("p");
        reporterLine.className = "admin-inbox-ticket-reporter";
        reporterLine.textContent = `${ticket.reporterName} • ${ticket.reporterRole === "vendor" ? "Vendor" : "Customer"}`;

        const statusLine = globalScope.document.createElement("p");
        statusLine.className = "admin-inbox-ticket-status";
        statusLine.textContent = `Status: ${ticket.statusLabel}`;
        statusLine.setAttribute("data-tone", ticket.statusTone);

        const categoryLine = globalScope.document.createElement("p");
        categoryLine.className = "admin-inbox-ticket-category";
        categoryLine.textContent = `Category: ${ticket.categoryLabel}`;

        const repliesLine = globalScope.document.createElement("p");
        repliesLine.className = "admin-inbox-ticket-replies";
        repliesLine.textContent = ticket.replyCountText;

        article.appendChild(heading);
        article.appendChild(reporterLine);
        article.appendChild(statusLine);
        article.appendChild(categoryLine);
        article.appendChild(repliesLine);

        if (ticket.orderId) {
            const orderLine = globalScope.document.createElement("p");
            orderLine.className = "admin-inbox-ticket-order";
            orderLine.textContent = `About order: ${ticket.orderId}`;
            article.appendChild(orderLine);
        }

        if (ticket.lastActivityText) {
            const activityLine = globalScope.document.createElement("p");
            activityLine.className = "admin-inbox-ticket-activity";
            activityLine.textContent = `Last activity: ${ticket.lastActivityText}`;
            article.appendChild(activityLine);
        }

        if (ticket.priority === "high") {
            const priorityLine = globalScope.document.createElement("p");
            priorityLine.className = "admin-inbox-ticket-priority";
            priorityLine.textContent = "Priority: High";
            article.appendChild(priorityLine);
        }

        const footer = globalScope.document.createElement("menu");
        footer.className = "action-menu admin-inbox-ticket-actions";
        footer.setAttribute("aria-label", `${ticket.subject} actions`);

        const detailItem = globalScope.document.createElement("li");
        const detailLink = globalScope.document.createElement("a");
        detailLink.href = buildTicketDetailUrl(ticket.ticketId);
        detailLink.className = "button-primary";
        detailLink.textContent = "Open Ticket";
        detailItem.appendChild(detailLink);

        footer.appendChild(detailItem);
        article.appendChild(footer);

        return article;
    }

    function renderTickets(tickets, container, options = {}) {
        if (!container) return;
        container.innerHTML = "";
        const safeTickets = Array.isArray(tickets) ? tickets : [];

        if (safeTickets.length === 0) {
            const message = globalScope.document.createElement("p");
            message.className = "empty-state-message";
            message.textContent = normalizeText(options.emptyMessage) ||
                "No support tickets to review.";
            container.appendChild(message);
            return;
        }

        safeTickets.forEach(function appendTicket(ticket) {
            container.appendChild(createTicketCard(ticket, options));
        });
    }

    function getCreatedAtTimestamp(ticket) {
        const safeTicket = ticket && typeof ticket === "object" ? ticket : {};
        return getTicketTimestampValue(safeTicket.createdAt || safeTicket.updatedAt);
    }

    function getLastReplyTimestamp(ticket) {
        const safeTicket = ticket && typeof ticket === "object" ? ticket : {};
        return getTicketTimestampValue(
            safeTicket.lastReplyAt || safeTicket.lastActivity || safeTicket.updatedAt || safeTicket.createdAt
        );
    }

    function sortTickets(tickets, sortKey) {
        const safeTickets = Array.isArray(tickets) ? tickets.slice() : [];
        const key = normalizeLowerText(sortKey) || DEFAULT_SORT;

        if (key === "oldest") {
            safeTickets.sort((a, b) => getCreatedAtTimestamp(a) - getCreatedAtTimestamp(b));
            return safeTickets;
        }
        if (key === "last-reply") {
            safeTickets.sort((a, b) => getLastReplyTimestamp(b) - getLastReplyTimestamp(a));
            return safeTickets;
        }
        if (key === "priority") {
            safeTickets.sort((a, b) => {
                const ap = normalizeLowerText(a && a.priority) === "high" ? 1 : 0;
                const bp = normalizeLowerText(b && b.priority) === "high" ? 1 : 0;
                if (bp !== ap) return bp - ap;
                return getCreatedAtTimestamp(b) - getCreatedAtTimestamp(a);
            });
            return safeTickets;
        }
        safeTickets.sort((a, b) => getCreatedAtTimestamp(b) - getCreatedAtTimestamp(a));
        return safeTickets;
    }

    function filterTickets(tickets, filters = {}) {
        const safeTickets = Array.isArray(tickets) ? tickets : [];
        const searchTerm = normalizeLowerText(filters.search);
        const statusFilter = normalizeLowerText(filters.status) || "all";
        const categoryFilter = normalizeLowerText(filters.category) || "all";
        const reporterRoleFilter = normalizeLowerText(filters.reporterRole) || "all";

        return safeTickets.filter(function byFilters(ticket) {
            if (!ticket) return false;
            const status = normalizeLowerText(ticket.status || ticket.statusKey);
            const category = normalizeLowerText(ticket.category || ticket.categoryKey);
            const reporterRole = normalizeLowerText(ticket.reporterRole);
            if (statusFilter !== "all" && status !== statusFilter) return false;
            if (categoryFilter !== "all" && category !== categoryFilter) return false;
            if (reporterRoleFilter !== "all" && reporterRole !== reporterRoleFilter) return false;

            if (searchTerm) {
                const subject = normalizeLowerText(ticket.subject);
                const ticketId = normalizeLowerText(ticket.ticketId);
                const orderId = normalizeLowerText(ticket.orderId);
                const reporterName = normalizeLowerText(ticket.reporterName);
                if (subject.indexOf(searchTerm) === -1 &&
                    ticketId.indexOf(searchTerm) === -1 &&
                    orderId.indexOf(searchTerm) === -1 &&
                    reporterName.indexOf(searchTerm) === -1) {
                    return false;
                }
            }
            return true;
        });
    }

    function paginateTickets(tickets, page, pageSize) {
        const safeTickets = Array.isArray(tickets) ? tickets : [];
        const size = Number.isFinite(Number(pageSize)) && Number(pageSize) > 0
            ? Math.floor(Number(pageSize)) : DEFAULT_PAGE_SIZE;
        const totalPages = Math.max(1, Math.ceil(safeTickets.length / size));
        const safePage = Math.min(Math.max(1, Math.floor(Number(page) || 1)), totalPages);
        const start = (safePage - 1) * size;
        const pageTickets = safeTickets.slice(start, start + size);

        return { pageTickets, page: safePage, pageSize: size, totalPages, totalCount: safeTickets.length };
    }

    function computePageNumbers(current, total) {
        // Returns an array of page numbers + "..." gap markers for the numbered
        // pagination control. Always shows first and last; shows up to 2 around
        // the current page. Examples (current=5, total=20): [1, "...", 4, 5, 6, "...", 20].
        if (total <= 7) {
            const list = [];
            for (let i = 1; i <= total; i += 1) list.push(i);
            return list;
        }
        const pages = [1];
        if (current > 4) pages.push("…");
        const start = Math.max(2, current - 1);
        const end = Math.min(total - 1, current + 1);
        for (let p = start; p <= end; p += 1) pages.push(p);
        if (current < total - 3) pages.push("…");
        pages.push(total);
        return pages;
    }

    function renderNumberedPages(menuElement, paginationInfo) {
        if (!menuElement) return;
        const existing = menuElement.querySelectorAll(
            '[data-page-action="page"], .admin-inbox-pagination-ellipsis'
        );
        existing.forEach(function removeOne(node) {
            const li = node.closest("li");
            if (li) li.remove();
        });

        if (!paginationInfo || paginationInfo.totalPages <= 1) {
            return;
        }

        const nextButton = menuElement.querySelector('[data-page-action="next"]');
        const nextLi = nextButton ? nextButton.closest("li") : null;
        const pages = computePageNumbers(paginationInfo.page, paginationInfo.totalPages);

        pages.forEach(function appendPage(page) {
            const li = globalScope.document.createElement("li");
            const button = globalScope.document.createElement("button");
            button.type = "button";

            if (page === "…") {
                button.disabled = true;
                button.textContent = "…";
                button.className = "admin-inbox-pagination-ellipsis";
                button.setAttribute("aria-hidden", "true");
            } else {
                button.setAttribute("data-page-action", "page");
                button.setAttribute("data-page-number", String(page));
                button.textContent = String(page);
                if (page === paginationInfo.page) {
                    button.className = "button-primary admin-inbox-pagination-current";
                    button.setAttribute("aria-current", "page");
                } else {
                    button.className = "button-secondary";
                }
                button.setAttribute("aria-label", `Go to page ${page}`);
            }

            li.appendChild(button);
            if (nextLi) {
                menuElement.insertBefore(li, nextLi);
            } else {
                menuElement.appendChild(li);
            }
        });
    }

    function updatePaginationControls(paginationElement, statusElement, paginationInfo) {
        if (!paginationElement) return;
        const totalCount = paginationInfo && Number(paginationInfo.totalCount) || 0;
        if (totalCount === 0) paginationElement.setAttribute("hidden", "");
        else paginationElement.removeAttribute("hidden");

        if (statusElement) {
            const ticketWord = totalCount === 1 ? "ticket" : "tickets";
            statusElement.textContent = paginationInfo.totalPages > 1
                ? `Page ${paginationInfo.page} of ${paginationInfo.totalPages} · ${totalCount} ${ticketWord}`
                : `${totalCount} ${ticketWord}`;
        }

        const prevButton = paginationElement.querySelector('[data-page-action="prev"]');
        const nextButton = paginationElement.querySelector('[data-page-action="next"]');
        if (prevButton) prevButton.disabled = paginationInfo.page <= 1;
        if (nextButton) nextButton.disabled = paginationInfo.page >= paginationInfo.totalPages;

        const menuElement = paginationElement.querySelector(".admin-inbox-pagination-menu");
        renderNumberedPages(menuElement, paginationInfo);
    }

    function buildResultSummary(filteredCount, totalCount) {
        if (totalCount === 0) return "";
        if (filteredCount === totalCount) return `Showing all ${totalCount} ticket${totalCount === 1 ? "" : "s"}.`;
        return `Showing ${filteredCount} of ${totalCount} ticket${totalCount === 1 ? "" : "s"}.`;
    }

    function hasActiveInboxFilters(filters = {}) {
        const search = normalizeText(filters.search);
        const status = normalizeLowerText(filters.status) || "all";
        const category = normalizeLowerText(filters.category) || "all";
        const reporterRole = normalizeLowerText(filters.reporterRole) || "all";

        return Boolean(search) || status !== "all" || category !== "all" || reporterRole !== "all";
    }

    function getTicketSubjectForNextStep(ticket) {
        const mappedTicket = mapTicketRecord(ticket);
        return mappedTicket.subject || "this ticket";
    }

    function isResolvedOrClosed(ticket) {
        const status = normalizeLowerText(ticket && (ticket.status || ticket.statusKey));
        return status === "resolved" || status === "closed";
    }

    function getAdminInboxNextStep(tickets, options = {}) {
        const allTickets = Array.isArray(tickets) ? tickets : [];
        const filteredTickets = Array.isArray(options.filteredTickets)
            ? options.filteredTickets
            : allTickets;
        const hasActiveFilters = hasActiveInboxFilters(options.filters);

        if (options.isSignedIn === false) {
            return {
                label: "Next: sign in",
                detail: "Sign in as an admin to review and triage the support inbox."
            };
        }

        if (allTickets.length === 0) {
            return {
                label: "Next: monitor the queue",
                detail: "There are no support tickets to review right now. Keep an eye on this inbox for new disputes."
            };
        }

        if (filteredTickets.length === 0 && hasActiveFilters) {
            return {
                label: "Next: clear filters",
                detail: "No tickets match the current view. Clear filters to return to the full support inbox."
            };
        }

        const highPriorityTicket = filteredTickets.find(function findHighPriority(ticket) {
            const priority = normalizeLowerText(ticket && ticket.priority);
            return priority === "high" && !isResolvedOrClosed(ticket);
        });

        if (highPriorityTicket) {
            return {
                label: "Next: handle high priority",
                detail: `Open ${getTicketSubjectForNextStep(highPriorityTicket)} and triage it before lower-priority tickets.`
            };
        }

        const openTicket = filteredTickets.find(function findOpen(ticket) {
            const status = normalizeLowerText(ticket && (ticket.status || ticket.statusKey));
            return status === "open";
        });

        if (openTicket) {
            return {
                label: "Next: triage an open ticket",
                detail: `Open ${getTicketSubjectForNextStep(openTicket)} to reply, update status, or route the dispute.`
            };
        }

        const inProgressTicket = filteredTickets.find(function findInProgress(ticket) {
            const status = normalizeLowerText(ticket && (ticket.status || ticket.statusKey));
            return status === "in_progress";
        });

        if (inProgressTicket) {
            return {
                label: "Next: continue investigation",
                detail: `Review ${getTicketSubjectForNextStep(inProgressTicket)} and add the next admin update.`
            };
        }

        const awaitingUserTicket = filteredTickets.find(function findAwaitingUser(ticket) {
            const status = normalizeLowerText(ticket && (ticket.status || ticket.statusKey));
            return status === "awaiting_user";
        });

        if (awaitingUserTicket) {
            return {
                label: "Next: review waiting tickets",
                detail: `Check ${getTicketSubjectForNextStep(awaitingUserTicket)} and follow up if the reporter is overdue.`
            };
        }

        return {
            label: "Next: review resolved tickets",
            detail: "The visible queue is resolved or closed. Scan recent tickets for quality checks or reopen needs."
        };
    }

    function renderAdminInboxNextStep(elements, state = {}) {
        if (!elements || !elements.nextStepLabel) {
            return null;
        }

        const nextStep = getAdminInboxNextStep(state.tickets, {
            filteredTickets: state.filteredTickets,
            filters: state.filters,
            isSignedIn: state.isSignedIn
        });

        elements.nextStepLabel.textContent = nextStep.label;

        if (elements.nextStepDetail) {
            elements.nextStepDetail.textContent = nextStep.detail;
        }

        return nextStep;
    }

    function renderCurrentPage(elements, options = {}) {
        const container = elements && elements.container;
        if (!container) return null;

        const filtered = filterTickets(pageState.allTickets, pageState.filters);
        const sorted = sortTickets(filtered, pageState.filters.sort);
        const paginated = paginateTickets(sorted, pageState.currentPage, pageState.pageSize);
        pageState.currentPage = paginated.page;

        const hasTickets = pageState.allTickets.length > 0;
        const emptyMessage = hasTickets
            ? "No tickets match your filters. Try clearing them to see more."
            : "No support tickets to review.";

        renderTickets(paginated.pageTickets, container, { ...options, emptyMessage });

        if (elements.summary) {
            elements.summary.textContent = buildResultSummary(sorted.length, pageState.allTickets.length);
        }
        updatePaginationControls(elements.pagination, elements.paginationStatus, paginated);
        renderAdminInboxNextStep(elements, {
            tickets: pageState.allTickets,
            filteredTickets: sorted,
            filters: pageState.filters,
            isSignedIn: options.isSignedIn
        });
        return paginated;
    }

    function readFiltersFromForm(form) {
        if (!form) return null;
        const data = new globalScope.FormData(form);
        return {
            search: normalizeText(data.get("search")),
            status: normalizeText(data.get("status")) || "all",
            category: normalizeText(data.get("category")) || "all",
            reporterRole: normalizeText(data.get("reporterRole")) || "all",
            sort: normalizeText(data.get("sort")) || DEFAULT_SORT
        };
    }

    function attachToolbarHandlers(elements, options = {}) {
        const form = elements && elements.form;
        if (form && !form.dataset.adminInboxFormBound) {
            form.dataset.adminInboxFormBound = "true";
            ["input", "change"].forEach(function bindEvent(eventName) {
                form.addEventListener(eventName, function onEvent() {
                    const next = readFiltersFromForm(form);
                    if (next) {
                        pageState.filters = next;
                        pageState.currentPage = 1;
                        renderCurrentPage(elements, options);
                    }
                });
            });
            form.addEventListener("reset", function onReset() {
                globalScope.setTimeout(function applyReset() {
                    pageState.filters = {
                        search: "", status: "all", category: "all", reporterRole: "all", sort: DEFAULT_SORT
                    };
                    pageState.currentPage = 1;
                    renderCurrentPage(elements, options);
                }, 0);
            });
        }

        const pagination = elements && elements.pagination;
        if (pagination && !pagination.dataset.adminInboxPaginationBound) {
            pagination.dataset.adminInboxPaginationBound = "true";
            pagination.addEventListener("click", function onClick(event) {
                const target = event.target.closest("[data-page-action]");
                if (!target || target.disabled) return;
                const action = target.getAttribute("data-page-action");
                if (action === "prev") {
                    pageState.currentPage = Math.max(1, pageState.currentPage - 1);
                } else if (action === "next") {
                    pageState.currentPage = pageState.currentPage + 1;
                } else if (action === "page") {
                    const pageNumber = Number(target.getAttribute("data-page-number"));
                    if (Number.isFinite(pageNumber) && pageNumber >= 1) {
                        pageState.currentPage = pageNumber;
                    }
                }
                renderCurrentPage(elements, options);
            });
        }

        const pageSizeSelect = elements && elements.pageSizeSelect;
        if (pageSizeSelect && !pageSizeSelect.dataset.adminInboxPageSizeBound) {
            pageSizeSelect.dataset.adminInboxPageSizeBound = "true";
            pageSizeSelect.addEventListener("change", function onPageSizeChange() {
                const next = Number(pageSizeSelect.value);
                if (Number.isFinite(next) && next > 0) {
                    pageState.pageSize = Math.floor(next);
                    pageState.currentPage = 1;
                    renderCurrentPage(elements, options);
                }
            });
        }
    }

    async function init(options = {}) {
        if (initInFlight) return initInFlight;

        initInFlight = (async function runInit() {
            const auth = options.auth || resolveAuth();
            const authFns = resolveAuthFns(options.authFns);
            const db = options.db || resolveFirestore();
            const firestoreFns = resolveFirestoreFns(options.firestoreFns);

            const container = globalScope.document.querySelector(options.containerSelector || "#admin-inbox-container");
            const statusElement = globalScope.document.querySelector(options.statusSelector || "#admin-inbox-status");
            const summaryElement = globalScope.document.querySelector(options.summarySelector || "#admin-inbox-summary");
            const formElement = globalScope.document.querySelector(options.formSelector || "#admin-inbox-filter-form");
            const paginationElement = globalScope.document.querySelector(options.paginationSelector || "#admin-inbox-pagination");
            const paginationStatusElement = globalScope.document.querySelector(options.paginationStatusSelector || "#admin-inbox-pagination-status");
            const pageSizeSelect = globalScope.document.querySelector(options.pageSizeSelector || "#admin-inbox-page-size");
            const nextStepLabelElement = globalScope.document.querySelector(options.nextStepSelector || "#admin-inbox-next-step");
            const nextStepDetailElement = globalScope.document.querySelector(options.nextStepDetailSelector || "#admin-inbox-next-step-detail");

            if (!container) return { success: false, error: "Inbox container not found." };

            const elements = {
                container, summary: summaryElement, form: formElement,
                pagination: paginationElement, paginationStatus: paginationStatusElement,
                pageSizeSelect,
                nextStepLabel: nextStepLabelElement,
                nextStepDetail: nextStepDetailElement
            };

            const initialFilters = readFiltersFromForm(formElement);
            pageState.filters = initialFilters || {
                search: "", status: "all", category: "all", reporterRole: "all", sort: DEFAULT_SORT
            };
            pageState.currentPage = 1;
            const explicitPageSize = Number(options.pageSize);
            const selectorPageSize = pageSizeSelect ? Number(pageSizeSelect.value) : NaN;
            pageState.pageSize = Number.isFinite(explicitPageSize) && explicitPageSize > 0
                ? Math.floor(explicitPageSize)
                : Number.isFinite(selectorPageSize) && selectorPageSize > 0
                    ? Math.floor(selectorPageSize)
                    : DEFAULT_PAGE_SIZE;

            setStatusMessage(statusElement, "Loading the support inbox...", "loading");

            const currentUser = options.currentUser || await waitForAuthReady(auth, authFns);
            if (!currentUser || !normalizeText(currentUser.uid)) {
                pageState.allTickets = [];
                renderTickets([], container, options);
                renderAdminInboxNextStep(elements, {
                    tickets: [],
                    filteredTickets: [],
                    filters: pageState.filters,
                    isSignedIn: false
                });
                if (summaryElement) summaryElement.textContent = "";
                if (paginationElement) paginationElement.setAttribute("hidden", "");
                setStatusMessage(statusElement, "Please sign in to view the support inbox.", "error");
                return { success: false, error: "Please sign in to view the support inbox." };
            }

            const result = await fetchAdminTickets({ ...options, db, firestoreFns });

            if (!result.success) {
                pageState.allTickets = [];
                renderTickets([], container, options);
                renderAdminInboxNextStep(elements, {
                    tickets: [],
                    filteredTickets: [],
                    filters: pageState.filters,
                    isSignedIn: true
                });
                if (summaryElement) summaryElement.textContent = "";
                if (paginationElement) paginationElement.setAttribute("hidden", "");
                setStatusMessage(
                    statusElement,
                    result.error && result.error.message ? result.error.message : "Failed to load support tickets.",
                    "error"
                );
                return {
                    success: false,
                    error: result.error && result.error.message ? result.error.message : "Failed to load support tickets."
                };
            }

            pageState.allTickets = Array.isArray(result.tickets) ? result.tickets : [];
            const renderOptions = { ...options, isSignedIn: true };

            attachToolbarHandlers(elements, renderOptions);
            renderCurrentPage(elements, renderOptions);

            if (pageState.allTickets.length === 0) {
                setStatusMessage(statusElement, "No support tickets to review.", "info");
            } else {
                setStatusMessage(
                    statusElement,
                    `Showing ${pageState.allTickets.length} ticket${pageState.allTickets.length === 1 ? "" : "s"}.`,
                    "success"
                );
            }

            return { success: true, tickets: pageState.allTickets };
        })();

        try { return await initInFlight; } finally { initInFlight = null; }
    }

    function initializeAdminDisputesPage(options = {}) {
        return init(options);
    }

    const adminDisputesPage = {
        MODULE_NAME, DEFAULT_PAGE_SIZE, DEFAULT_SORT, PAGE_SIZE_OPTIONS,
        normalizeText, normalizeLowerText,
        resolveFirestore, resolveAuth, resolveAuthFns, resolveFirestoreFns,
        resolveTicketService, resolveTicketStatus, resolveTicketCategories, resolveTicketFormatters,
        waitForAuthReady, getTicketTimestampValue, mapTicketRecord, fetchAdminTickets,
        setStatusMessage, buildTicketDetailUrl, createTicketCard, renderTickets,
        getCreatedAtTimestamp, getLastReplyTimestamp,
        sortTickets, filterTickets, paginateTickets,
        computePageNumbers, renderNumberedPages, updatePaginationControls,
        buildResultSummary, hasActiveInboxFilters,
        getAdminInboxNextStep, renderAdminInboxNextStep,
        renderCurrentPage, readFiltersFromForm, attachToolbarHandlers,
        init, initializeAdminDisputesPage
    };

    if (typeof module !== "undefined" && module.exports) module.exports = adminDisputesPage;
    if (typeof globalScope !== "undefined") globalScope.adminDisputesPage = adminDisputesPage;
})(typeof window !== "undefined" ? window : globalThis);
