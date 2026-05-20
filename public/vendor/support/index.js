(function attachVendorSupportListPage(globalScope) {
    "use strict";

    const MODULE_NAME = "vendor/support/index";
    const DEFAULT_PAGE_SIZE = 12;
    const DEFAULT_SORT = "newest";
    const PAGE_SIZE_OPTIONS = [12, 25, 50, 100];

    let initInFlight = null;

    const pageState = {
        allTickets: [],
        filters: { search: "", status: "all", category: "all", sort: DEFAULT_SORT },
        currentPage: 1,
        pageSize: DEFAULT_PAGE_SIZE
    };

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
        if (explicitTicketService && typeof explicitTicketService.getReporterTickets === "function") {
            return explicitTicketService;
        }
        if (globalScope.ticketService && typeof globalScope.ticketService.getReporterTickets === "function") {
            return globalScope.ticketService;
        }
        return null;
    }

    function resolveTicketStatus(explicitTicketStatus) {
        if (explicitTicketStatus && typeof explicitTicketStatus.getTicketStatusLabel === "function") {
            return explicitTicketStatus;
        }
        if (globalScope.ticketStatus && typeof globalScope.ticketStatus.getTicketStatusLabel === "function") {
            return globalScope.ticketStatus;
        }
        return null;
    }

    function resolveTicketCategories(explicitTicketCategories) {
        if (explicitTicketCategories && typeof explicitTicketCategories.getTicketCategoryLabel === "function") {
            return explicitTicketCategories;
        }
        if (globalScope.ticketCategories && typeof globalScope.ticketCategories.getTicketCategoryLabel === "function") {
            return globalScope.ticketCategories;
        }
        return null;
    }

    function resolveTicketFormatters(explicitTicketFormatters) {
        if (explicitTicketFormatters && typeof explicitTicketFormatters.formatTicketId === "function") {
            return explicitTicketFormatters;
        }
        if (globalScope.ticketFormatters && typeof globalScope.ticketFormatters.formatTicketId === "function") {
            return globalScope.ticketFormatters;
        }
        return null;
    }

    function getFallbackRoutes() {
        return {
            home: "../index.html",
            newTicket: "./new.html",
            detail: "./ticket-detail.html"
        };
    }

    function waitForAuthReady(auth, authFns, timeoutMs = 5000) {
        if (!auth || !authFns || typeof authFns.onAuthStateChanged !== "function") {
            return Promise.resolve(auth && auth.currentUser ? auth.currentUser : null);
        }

        return new Promise(function resolveAuthState(resolve) {
            let settled = false;
            let unsubscribe = function noop() { return undefined; };

            function finish(user) {
                if (settled) return;
                settled = true;
                unsubscribe();
                resolve(user || null);
            }

            unsubscribe = authFns.onAuthStateChanged(
                auth,
                function onChange(user) { finish(user); },
                function onError() { finish(auth.currentUser || null); }
            );
            globalScope.setTimeout(function onTimeout() {
                finish(auth.currentUser || null);
            }, timeoutMs);
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
        const categoryTone = ticketCategories && typeof ticketCategories.getTicketCategoryTone === "function"
            ? ticketCategories.getTicketCategoryTone(categoryKey) : "info";

        const replyCount = Number.isFinite(Number(safeTicket.replyCount))
            ? Number(safeTicket.replyCount) : 0;
        const replyCountText = ticketFormatters && typeof ticketFormatters.formatReplyCount === "function"
            ? ticketFormatters.formatReplyCount(replyCount)
            : (replyCount === 0 ? "No replies yet" : `${replyCount} repl${replyCount === 1 ? "y" : "ies"}`);

        const lastActivity = safeTicket.lastReplyAt || safeTicket.updatedAt || safeTicket.createdAt || null;
        const lastActivityValue = getTicketTimestampValue(lastActivity);
        const lastActivityText = ticketFormatters && typeof ticketFormatters.formatRelativeTime === "function"
            ? ticketFormatters.formatRelativeTime(lastActivity, { emptyValue: "" })
            : (lastActivityValue ? new Date(lastActivityValue).toLocaleString() : "");

        return {
            ticketId, subject,
            statusKey, statusLabel, statusTone,
            categoryKey, categoryLabel, categoryTone,
            replyCount, replyCountText,
            orderId: normalizeText(safeTicket.orderId),
            lastActivity, lastActivityValue, lastActivityText
        };
    }

    async function fetchReporterTickets(options = {}) {
        const db = options.db || resolveFirestore();
        const firestoreFns = resolveFirestoreFns(options.firestoreFns);
        const ticketService = resolveTicketService(options.ticketService);
        const reporterUid = normalizeText(options.reporterUid);

        if (!reporterUid) {
            return { success: false, tickets: [], error: { code: "no-reporter-uid", message: "A signed-in vendor is required to load tickets." } };
        }
        if (!(ticketService && typeof ticketService.getReporterTickets === "function" && db)) {
            return { success: false, tickets: [], error: { code: "no-ticket-service", message: "Support service is not available right now." } };
        }

        try {
            const tickets = await ticketService.getReporterTickets({
                db, firestoreFns, reporterUid,
                ticketQueries: options.ticketQueries
            });
            return { success: true, tickets: Array.isArray(tickets) ? tickets : [] };
        } catch (error) {
            console.error(`${MODULE_NAME}: Error fetching tickets via service:`, error);
            return {
                success: false, tickets: [],
                error: {
                    code: normalizeText(error && error.code) || "fetch-error",
                    message: normalizeText(error && error.message) || "Failed to load your support tickets."
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
        const url = new URL(getFallbackRoutes().detail, globalScope.location.href);
        url.searchParams.set("ticketId", normalizeText(ticketId));
        return url.toString();
    }

    function createTicketCard(ticketRecord, options = {}) {
        const ticket = mapTicketRecord(ticketRecord, options);
        const article = globalScope.document.createElement("article");
        article.className = "vendor-support-ticket-card";
        article.setAttribute("data-ticket-id", ticket.ticketId);
        article.setAttribute("data-status", ticket.statusKey);
        article.setAttribute("data-category", ticket.categoryKey);

        const heading = globalScope.document.createElement("h4");
        heading.className = "vendor-support-ticket-subject";
        heading.textContent = ticket.subject;

        const statusLine = globalScope.document.createElement("p");
        statusLine.className = "vendor-support-ticket-status";
        statusLine.textContent = `Status: ${ticket.statusLabel}`;
        statusLine.setAttribute("data-tone", ticket.statusTone);

        const categoryLine = globalScope.document.createElement("p");
        categoryLine.className = "vendor-support-ticket-category";
        categoryLine.textContent = `Category: ${ticket.categoryLabel}`;
        categoryLine.setAttribute("data-tone", ticket.categoryTone);

        const repliesLine = globalScope.document.createElement("p");
        repliesLine.className = "vendor-support-ticket-replies";
        repliesLine.textContent = ticket.replyCountText;

        article.appendChild(heading);
        article.appendChild(statusLine);
        article.appendChild(categoryLine);
        article.appendChild(repliesLine);

        if (ticket.orderId) {
            const orderLine = globalScope.document.createElement("p");
            orderLine.className = "vendor-support-ticket-order";
            orderLine.textContent = `About order: ${ticket.orderId}`;
            article.appendChild(orderLine);
        }

        if (ticket.lastActivityText) {
            const activityLine = globalScope.document.createElement("p");
            activityLine.className = "vendor-support-ticket-activity";
            activityLine.textContent = `Last activity: ${ticket.lastActivityText}`;
            article.appendChild(activityLine);
        }

        const footer = globalScope.document.createElement("menu");
        footer.className = "action-menu vendor-support-ticket-actions";
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
                "You have not opened any support tickets yet.";
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
        safeTickets.sort((a, b) => getCreatedAtTimestamp(b) - getCreatedAtTimestamp(a));
        return safeTickets;
    }

    function filterTickets(tickets, filters = {}) {
        const safeTickets = Array.isArray(tickets) ? tickets : [];
        const searchTerm = normalizeLowerText(filters.search);
        const statusFilter = normalizeLowerText(filters.status) || "all";
        const categoryFilter = normalizeLowerText(filters.category) || "all";

        return safeTickets.filter(function byFilters(ticket) {
            if (!ticket) return false;
            const status = normalizeLowerText(ticket.status || ticket.statusKey);
            const category = normalizeLowerText(ticket.category || ticket.categoryKey);
            if (statusFilter !== "all" && status !== statusFilter) return false;
            if (categoryFilter !== "all" && category !== categoryFilter) return false;
            if (searchTerm) {
                const subject = normalizeLowerText(ticket.subject);
                const ticketId = normalizeLowerText(ticket.ticketId);
                const orderId = normalizeLowerText(ticket.orderId);
                if (subject.indexOf(searchTerm) === -1 &&
                    ticketId.indexOf(searchTerm) === -1 &&
                    orderId.indexOf(searchTerm) === -1) {
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
        // Returns page numbers + "…" gap markers, e.g. (5, 20) → [1, "…", 4, 5, 6, "…", 20].
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
            '[data-page-action="page"], .vendor-tickets-pagination-ellipsis'
        );
        existing.forEach(function removeOne(node) {
            const li = node.closest("li");
            if (li) li.remove();
        });

        if (!paginationInfo || paginationInfo.totalPages <= 1) return;

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
                button.className = "vendor-tickets-pagination-ellipsis";
                button.setAttribute("aria-hidden", "true");
            } else {
                button.setAttribute("data-page-action", "page");
                button.setAttribute("data-page-number", String(page));
                button.textContent = String(page);
                if (page === paginationInfo.page) {
                    button.className = "button-primary vendor-tickets-pagination-current";
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

        const menuElement = paginationElement.querySelector(".vendor-tickets-pagination-menu");
        renderNumberedPages(menuElement, paginationInfo);
    }

    function buildResultSummary(filteredCount, totalCount) {
        if (totalCount === 0) return "";
        if (filteredCount === totalCount) return `Showing all ${totalCount} ticket${totalCount === 1 ? "" : "s"}.`;
        return `Showing ${filteredCount} of ${totalCount} ticket${totalCount === 1 ? "" : "s"}.`;
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
            : "You have not opened any support tickets yet.";

        renderTickets(paginated.pageTickets, container, { ...options, emptyMessage });

        if (elements.summary) {
            elements.summary.textContent = buildResultSummary(sorted.length, pageState.allTickets.length);
        }
        updatePaginationControls(elements.pagination, elements.paginationStatus, paginated);
        return paginated;
    }

    function readFiltersFromForm(form) {
        if (!form) return null;
        const data = new globalScope.FormData(form);
        return {
            search: normalizeText(data.get("search")),
            status: normalizeText(data.get("status")) || "all",
            category: normalizeText(data.get("category")) || "all",
            sort: normalizeText(data.get("sort")) || DEFAULT_SORT
        };
    }

    function attachToolbarHandlers(elements, options = {}) {
        const form = elements && elements.form;
        if (form && !form.dataset.vendorSupportFormBound) {
            form.dataset.vendorSupportFormBound = "true";
            form.addEventListener("input", function onInput() {
                const next = readFiltersFromForm(form);
                if (next) {
                    pageState.filters = next;
                    pageState.currentPage = 1;
                    renderCurrentPage(elements, options);
                }
            });
            form.addEventListener("change", function onChange() {
                const next = readFiltersFromForm(form);
                if (next) {
                    pageState.filters = next;
                    pageState.currentPage = 1;
                    renderCurrentPage(elements, options);
                }
            });
            form.addEventListener("reset", function onReset() {
                globalScope.setTimeout(function applyReset() {
                    pageState.filters = {
                        search: "", status: "all", category: "all", sort: DEFAULT_SORT
                    };
                    pageState.currentPage = 1;
                    renderCurrentPage(elements, options);
                }, 0);
            });
        }

        const pagination = elements && elements.pagination;
        if (pagination && !pagination.dataset.vendorSupportPaginationBound) {
            pagination.dataset.vendorSupportPaginationBound = "true";
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
        if (pageSizeSelect && !pageSizeSelect.dataset.vendorSupportPageSizeBound) {
            pageSizeSelect.dataset.vendorSupportPageSizeBound = "true";
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
            const container = globalScope.document.querySelector(options.containerSelector || "#vendor-tickets-container");
            const statusElement = globalScope.document.querySelector(options.statusSelector || "#vendor-support-status");
            const summaryElement = globalScope.document.querySelector(options.summarySelector || "#vendor-tickets-summary");
            const formElement = globalScope.document.querySelector(options.formSelector || "#vendor-tickets-filter-form");
            const paginationElement = globalScope.document.querySelector(options.paginationSelector || "#vendor-tickets-pagination");
            const paginationStatusElement = globalScope.document.querySelector(options.paginationStatusSelector || "#vendor-tickets-pagination-status");
            const pageSizeSelect = globalScope.document.querySelector(options.pageSizeSelector || "#vendor-tickets-page-size");

            if (!container) return { success: false, error: "Tickets container not found." };

            const elements = {
                container, summary: summaryElement, form: formElement,
                pagination: paginationElement, paginationStatus: paginationStatusElement,
                pageSizeSelect
            };

            const initialFilters = readFiltersFromForm(formElement);
            pageState.filters = initialFilters || { search: "", status: "all", category: "all", sort: DEFAULT_SORT };
            pageState.currentPage = 1;
            const explicitPageSize = Number(options.pageSize);
            const selectorPageSize = pageSizeSelect ? Number(pageSizeSelect.value) : NaN;
            pageState.pageSize = Number.isFinite(explicitPageSize) && explicitPageSize > 0
                ? Math.floor(explicitPageSize)
                : Number.isFinite(selectorPageSize) && selectorPageSize > 0
                    ? Math.floor(selectorPageSize)
                    : DEFAULT_PAGE_SIZE;

            setStatusMessage(statusElement, "Loading your tickets...", "loading");

            const currentUser = options.currentUser || await waitForAuthReady(auth, authFns);

            if (!currentUser || !normalizeText(currentUser.uid)) {
                pageState.allTickets = [];
                renderTickets([], container, options);
                if (summaryElement) summaryElement.textContent = "";
                if (paginationElement) paginationElement.setAttribute("hidden", "");
                setStatusMessage(statusElement, "Please sign in to view your support tickets.", "error");
                return { success: false, error: "Please sign in to view your support tickets." };
            }

            const result = await fetchReporterTickets({ ...options, db, firestoreFns, reporterUid: currentUser.uid });

            if (!result.success) {
                pageState.allTickets = [];
                renderTickets([], container, options);
                if (summaryElement) summaryElement.textContent = "";
                if (paginationElement) paginationElement.setAttribute("hidden", "");
                setStatusMessage(
                    statusElement,
                    result.error && result.error.message ? result.error.message : "Failed to load your support tickets.",
                    "error"
                );
                return {
                    success: false,
                    error: result.error && result.error.message ? result.error.message : "Failed to load your support tickets."
                };
            }

            pageState.allTickets = Array.isArray(result.tickets) ? result.tickets : [];

            attachToolbarHandlers(elements, options);
            renderCurrentPage(elements, options);

            if (pageState.allTickets.length === 0) {
                setStatusMessage(statusElement, "You have not opened any support tickets yet.", "info");
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

    function initializeVendorSupportListPage(options = {}) {
        return init(options);
    }

    const vendorSupportListPage = {
        MODULE_NAME, DEFAULT_PAGE_SIZE, DEFAULT_SORT, PAGE_SIZE_OPTIONS,
        normalizeText, normalizeLowerText,
        resolveFirestore, resolveAuth, resolveAuthFns, resolveFirestoreFns,
        resolveTicketService, resolveTicketStatus, resolveTicketCategories, resolveTicketFormatters,
        getFallbackRoutes, waitForAuthReady,
        getTicketTimestampValue, mapTicketRecord, fetchReporterTickets,
        setStatusMessage, buildTicketDetailUrl, createTicketCard, renderTickets,
        getLastReplyTimestamp, getCreatedAtTimestamp,
        sortTickets, filterTickets, paginateTickets,
        computePageNumbers, renderNumberedPages, updatePaginationControls,
        buildResultSummary, renderCurrentPage, readFiltersFromForm, attachToolbarHandlers,
        init, initializeVendorSupportListPage
    };

    if (typeof module !== "undefined" && module.exports) module.exports = vendorSupportListPage;
    if (typeof globalScope !== "undefined") globalScope.vendorSupportListPage = vendorSupportListPage;
})(typeof window !== "undefined" ? window : globalThis);
