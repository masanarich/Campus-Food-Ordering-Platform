(function attachTicketService(globalScope) {
    "use strict";

    const MODULE_NAME = "ticket-service";
    const SUPPORT_TICKETS_COLLECTION = "supportTickets";
    const REPLIES_SUBCOLLECTION = "replies";

    function resolveTicketStatus(explicitTicketStatus) {
        if (
            explicitTicketStatus &&
            typeof explicitTicketStatus.normalizeTicketStatus === "function" &&
            typeof explicitTicketStatus.getDefaultTicketStatus === "function"
        ) {
            return explicitTicketStatus;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.ticketStatus &&
            typeof globalScope.ticketStatus.normalizeTicketStatus === "function" &&
            typeof globalScope.ticketStatus.getDefaultTicketStatus === "function"
        ) {
            return globalScope.ticketStatus;
        }

        if (typeof require === "function") {
            try {
                const requiredTicketStatus = require("./ticket-status.js");

                if (
                    requiredTicketStatus &&
                    typeof requiredTicketStatus.normalizeTicketStatus === "function" &&
                    typeof requiredTicketStatus.getDefaultTicketStatus === "function"
                ) {
                    return requiredTicketStatus;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveTicketCategories(explicitTicketCategories) {
        if (
            explicitTicketCategories &&
            typeof explicitTicketCategories.normalizeTicketCategory === "function" &&
            typeof explicitTicketCategories.getDefaultTicketCategory === "function"
        ) {
            return explicitTicketCategories;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.ticketCategories &&
            typeof globalScope.ticketCategories.normalizeTicketCategory === "function" &&
            typeof globalScope.ticketCategories.getDefaultTicketCategory === "function"
        ) {
            return globalScope.ticketCategories;
        }

        if (typeof require === "function") {
            try {
                const requiredTicketCategories = require("./ticket-categories.js");

                if (
                    requiredTicketCategories &&
                    typeof requiredTicketCategories.normalizeTicketCategory === "function" &&
                    typeof requiredTicketCategories.getDefaultTicketCategory === "function"
                ) {
                    return requiredTicketCategories;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveTicketModel(explicitTicketModel) {
        if (
            explicitTicketModel &&
            typeof explicitTicketModel.createTicketRecord === "function" &&
            typeof explicitTicketModel.createReplyRecord === "function" &&
            typeof explicitTicketModel.createTicketTimelineEntry === "function"
        ) {
            return explicitTicketModel;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.ticketModel &&
            typeof globalScope.ticketModel.createTicketRecord === "function" &&
            typeof globalScope.ticketModel.createReplyRecord === "function" &&
            typeof globalScope.ticketModel.createTicketTimelineEntry === "function"
        ) {
            return globalScope.ticketModel;
        }

        if (typeof require === "function") {
            try {
                const requiredTicketModel = require("./ticket-model.js");

                if (
                    requiredTicketModel &&
                    typeof requiredTicketModel.createTicketRecord === "function" &&
                    typeof requiredTicketModel.createReplyRecord === "function" &&
                    typeof requiredTicketModel.createTicketTimelineEntry === "function"
                ) {
                    return requiredTicketModel;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveTicketQueries(explicitTicketQueries) {
        if (
            explicitTicketQueries &&
            typeof explicitTicketQueries.getTicketDocRef === "function"
        ) {
            return explicitTicketQueries;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.ticketQueries &&
            typeof globalScope.ticketQueries.getTicketDocRef === "function"
        ) {
            return globalScope.ticketQueries;
        }

        if (typeof require === "function") {
            try {
                const requiredTicketQueries = require("./ticket-queries.js");

                if (
                    requiredTicketQueries &&
                    typeof requiredTicketQueries.getTicketDocRef === "function"
                ) {
                    return requiredTicketQueries;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveTicketValidation(explicitTicketValidation) {
        if (
            explicitTicketValidation &&
            typeof explicitTicketValidation.validateCreateTicketInput === "function"
        ) {
            return explicitTicketValidation;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.ticketValidation &&
            typeof globalScope.ticketValidation.validateCreateTicketInput === "function"
        ) {
            return globalScope.ticketValidation;
        }

        if (typeof require === "function") {
            try {
                const requiredTicketValidation = require("./ticket-validation.js");

                if (
                    requiredTicketValidation &&
                    typeof requiredTicketValidation.validateCreateTicketInput === "function"
                ) {
                    return requiredTicketValidation;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
    }

    function createServiceError(code, message, details = {}) {
        const safeDetails = details && typeof details === "object" ? details : {};

        return {
            code: normalizeText(code) || "tickets/error",
            message: normalizeText(message) || "Something went wrong while handling the ticket request.",
            ...safeDetails
        };
    }

    function createServiceResult(success, details = {}) {
        const safeDetails = details && typeof details === "object" ? details : {};

        return {
            success: success === true,
            ...safeDetails
        };
    }

    function resolveTimestampValue(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        if (safeOptions.timestampValue !== undefined) {
            return safeOptions.timestampValue;
        }

        if (typeof safeOptions.nowFactory === "function") {
            return safeOptions.nowFactory();
        }

        if (safeOptions.now !== undefined) {
            return safeOptions.now;
        }

        if (
            safeOptions.useServerTimestamp !== false &&
            safeOptions.firestoreFns &&
            typeof safeOptions.firestoreFns.serverTimestamp === "function"
        ) {
            return safeOptions.firestoreFns.serverTimestamp();
        }

        return new Date().toISOString();
    }

    function getTicketsCollectionRefFallback(db, firestoreFns) {
        if (!db || !firestoreFns || typeof firestoreFns.collection !== "function") {
            return null;
        }

        return firestoreFns.collection(db, SUPPORT_TICKETS_COLLECTION);
    }

    function getTicketDocRef(db, ticketId, firestoreFns, explicitTicketQueries) {
        const ticketQueries = resolveTicketQueries(explicitTicketQueries);

        if (ticketQueries && typeof ticketQueries.getTicketDocRef === "function") {
            return ticketQueries.getTicketDocRef(db, ticketId, firestoreFns);
        }

        if (!db || !firestoreFns || typeof firestoreFns.doc !== "function") {
            return null;
        }

        return firestoreFns.doc(db, SUPPORT_TICKETS_COLLECTION, normalizeText(ticketId));
    }

    function getRepliesCollectionRef(db, ticketId, firestoreFns, explicitTicketQueries) {
        const ticketQueries = resolveTicketQueries(explicitTicketQueries);

        if (ticketQueries && typeof ticketQueries.getRepliesCollectionRef === "function") {
            return ticketQueries.getRepliesCollectionRef(db, ticketId, firestoreFns);
        }

        if (!db || !firestoreFns || typeof firestoreFns.collection !== "function") {
            return null;
        }

        return firestoreFns.collection(
            db,
            SUPPORT_TICKETS_COLLECTION,
            normalizeText(ticketId),
            REPLIES_SUBCOLLECTION
        );
    }

    function getReplyDocRef(db, ticketId, replyId, firestoreFns, explicitTicketQueries) {
        const ticketQueries = resolveTicketQueries(explicitTicketQueries);

        if (ticketQueries && typeof ticketQueries.getReplyDocRef === "function") {
            return ticketQueries.getReplyDocRef(db, ticketId, replyId, firestoreFns);
        }

        if (!db || !firestoreFns || typeof firestoreFns.doc !== "function") {
            return null;
        }

        return firestoreFns.doc(
            db,
            SUPPORT_TICKETS_COLLECTION,
            normalizeText(ticketId),
            REPLIES_SUBCOLLECTION,
            normalizeText(replyId)
        );
    }

    function createTicketId(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const explicitId = normalizeText(safeOptions.ticketId);

        if (explicitId) {
            return explicitId;
        }

        const factoryId = typeof safeOptions.ticketIdFactory === "function"
            ? normalizeText(safeOptions.ticketIdFactory(safeOptions))
            : "";

        if (factoryId) {
            return factoryId;
        }

        if (
            safeOptions.db &&
            safeOptions.firestoreFns &&
            typeof safeOptions.firestoreFns.doc === "function"
        ) {
            try {
                const collectionRef = getTicketsCollectionRefFallback(
                    safeOptions.db,
                    safeOptions.firestoreFns
                );

                if (collectionRef) {
                    const generatedRef = safeOptions.firestoreFns.doc(collectionRef);
                    const generatedId = normalizeText(generatedRef && generatedRef.id);

                    if (generatedId) {
                        return generatedId;
                    }
                }
            } catch (error) {
                // Fall back to a deterministic ID below.
            }
        }

        const seed = normalizeLowerText(safeOptions.timestampSeed || `${Date.now()}`)
            .replace(/[^a-z0-9]+/g, "") || "generated";

        return `ticket-${seed}`;
    }

    function createReplyId(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const explicitId = normalizeText(safeOptions.replyId);

        if (explicitId) {
            return explicitId;
        }

        const factoryId = typeof safeOptions.replyIdFactory === "function"
            ? normalizeText(safeOptions.replyIdFactory(safeOptions))
            : "";

        if (factoryId) {
            return factoryId;
        }

        if (
            safeOptions.db &&
            safeOptions.firestoreFns &&
            typeof safeOptions.firestoreFns.doc === "function" &&
            normalizeText(safeOptions.ticketId)
        ) {
            try {
                const collectionRef = getRepliesCollectionRef(
                    safeOptions.db,
                    safeOptions.ticketId,
                    safeOptions.firestoreFns,
                    safeOptions.ticketQueries
                );

                if (collectionRef) {
                    const generatedRef = safeOptions.firestoreFns.doc(collectionRef);
                    const generatedId = normalizeText(generatedRef && generatedRef.id);

                    if (generatedId) {
                        return generatedId;
                    }
                }
            } catch (error) {
                // Fall back to a deterministic ID below.
            }
        }

        const seed = normalizeLowerText(safeOptions.timestampSeed || `${Date.now()}`)
            .replace(/[^a-z0-9]+/g, "") || "generated";

        return `reply-${seed}`;
    }

    function buildTicketWritePayload(ticketRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketStatus = resolveTicketStatus(safeOptions.ticketStatus);
        const ticketCategories = resolveTicketCategories(safeOptions.ticketCategories);
        const ticketModel = resolveTicketModel(safeOptions.ticketModel);
        const safeRecord = ticketRecord && typeof ticketRecord === "object" ? ticketRecord : {};
        const ticketId = normalizeText(safeOptions.ticketId || safeRecord.ticketId);

        if (!ticketModel) {
            return {
                ...safeRecord,
                ticketId,
                status:
                    safeOptions.status !== undefined
                        ? normalizeLowerText(safeOptions.status)
                        : normalizeLowerText(safeRecord.status),
                category:
                    safeOptions.category !== undefined
                        ? normalizeLowerText(safeOptions.category)
                        : normalizeLowerText(safeRecord.category),
                priority:
                    safeOptions.priority !== undefined
                        ? normalizeLowerText(safeOptions.priority)
                        : normalizeLowerText(safeRecord.priority),
                timeline: Array.isArray(safeOptions.timeline)
                    ? safeOptions.timeline.slice()
                    : Array.isArray(safeRecord.timeline)
                        ? safeRecord.timeline.slice()
                        : [],
                createdAt:
                    safeOptions.createdAt !== undefined
                        ? safeOptions.createdAt
                        : safeRecord.createdAt,
                updatedAt:
                    safeOptions.updatedAt !== undefined
                        ? safeOptions.updatedAt
                        : safeRecord.updatedAt
            };
        }

        return ticketModel.createTicketRecord(
            {
                ...safeRecord,
                ticketId,
                status:
                    safeOptions.status !== undefined
                        ? safeOptions.status
                        : safeRecord.status,
                category:
                    safeOptions.category !== undefined
                        ? safeOptions.category
                        : safeRecord.category,
                priority:
                    safeOptions.priority !== undefined
                        ? safeOptions.priority
                        : safeRecord.priority,
                timeline: Array.isArray(safeOptions.timeline)
                    ? safeOptions.timeline.slice()
                    : safeRecord.timeline,
                createdAt:
                    safeOptions.createdAt !== undefined
                        ? safeOptions.createdAt
                        : safeRecord.createdAt,
                updatedAt:
                    safeOptions.updatedAt !== undefined
                        ? safeOptions.updatedAt
                        : safeRecord.updatedAt
            },
            {
                ticketStatus,
                ticketCategories,
                createdAt:
                    safeOptions.createdAt !== undefined
                        ? safeOptions.createdAt
                        : safeRecord.createdAt
            }
        );
    }

    function buildTicketPatch(patchSource, options = {}) {
        const safeSource = patchSource && typeof patchSource === "object" ? patchSource : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketModel = resolveTicketModel(safeOptions.ticketModel);

        if (ticketModel && typeof ticketModel.createTicketPatch === "function") {
            const modelPatch = ticketModel.createTicketPatch(safeSource, {
                ticketStatus: safeOptions.ticketStatus,
                ticketCategories: safeOptions.ticketCategories
            });

            if (Array.isArray(safeSource.timeline)) {
                modelPatch.timeline = safeSource.timeline.slice();
            }

            return modelPatch;
        }

        const patch = {};

        ["status", "priority", "category", "replyCount", "lastReplyAt",
            "resolvedAt", "resolvedByUid", "resolvedByName", "resolutionNote",
            "updatedAt"].forEach(function copyIfSet(key) {
                if (safeSource[key] !== undefined) {
                    patch[key] = safeSource[key];
                }
            });

        if (Array.isArray(safeSource.timeline)) {
            patch.timeline = safeSource.timeline.slice();
        }

        return patch;
    }

    function buildReplyWritePayload(replyValues, options = {}) {
        const safeValues = replyValues && typeof replyValues === "object" ? replyValues : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketModel = resolveTicketModel(safeOptions.ticketModel);
        const replyId = normalizeText(safeOptions.replyId || safeValues.replyId);
        const createdAt =
            safeOptions.createdAt !== undefined
                ? safeOptions.createdAt
                : safeValues.createdAt;

        if (!ticketModel) {
            return {
                ...safeValues,
                replyId,
                createdAt
            };
        }

        return ticketModel.createReplyRecord(
            {
                ...safeValues,
                replyId,
                createdAt
            },
            {
                defaultAuthorRole: safeOptions.defaultAuthorRole,
                createdAt
            }
        );
    }

    function validateCreateTicketInputFallback(ticketRecord) {
        const safeRecord = ticketRecord && typeof ticketRecord === "object" ? ticketRecord : {};
        const errors = {};

        if (!normalizeText(safeRecord.reporterUid)) {
            errors.reporterUid = "A reporter is required to file a ticket.";
        }

        if (!normalizeText(safeRecord.subject)) {
            errors.subject = "Please add a short subject.";
        }

        if (!normalizeText(safeRecord.description)) {
            errors.description = "Please describe what is going on.";
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors,
            value: safeRecord
        };
    }

    function autoStatusForReply(currentStatus, authorRole, ticketStatus) {
        if (!ticketStatus) {
            return currentStatus;
        }

        const normalizedRole = ticketStatus.normalizeTicketActorRole(authorRole);
        const normalizedStatus = ticketStatus.normalizeTicketStatus(currentStatus);

        if (
            normalizedRole === ticketStatus.TICKET_ACTOR_ROLES.ADMIN &&
            normalizedStatus === ticketStatus.TICKET_STATUSES.OPEN
        ) {
            return ticketStatus.TICKET_STATUSES.IN_PROGRESS;
        }

        if (
            (normalizedRole === ticketStatus.TICKET_ACTOR_ROLES.CUSTOMER ||
                normalizedRole === ticketStatus.TICKET_ACTOR_ROLES.VENDOR) &&
            normalizedStatus === ticketStatus.TICKET_STATUSES.AWAITING_USER
        ) {
            return ticketStatus.TICKET_STATUSES.IN_PROGRESS;
        }

        return normalizedStatus;
    }

    function prepareCreateTicket(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketStatus = resolveTicketStatus(safeOptions.ticketStatus);
        const ticketCategories = resolveTicketCategories(safeOptions.ticketCategories);
        const ticketModel = resolveTicketModel(safeOptions.ticketModel);
        const ticketValidation = resolveTicketValidation(safeOptions.ticketValidation);

        if (!ticketModel) {
            return createServiceResult(false, {
                ticket: null,
                error: createServiceError(
                    "tickets/dependencies-missing",
                    "Ticket helpers are required before a ticket can be prepared."
                )
            });
        }

        const createdAt = resolveTimestampValue(safeOptions);
        const ticketRecord = typeof ticketModel.createTicketFromForm === "function"
            ? ticketModel.createTicketFromForm(
                safeOptions.input || {},
                {
                    reporter: safeOptions.reporter || (safeOptions.input && safeOptions.input.reporter),
                    customer: safeOptions.customer,
                    vendor: safeOptions.vendor,
                    ticketStatus,
                    ticketCategories,
                    createdAt
                }
            )
            : ticketModel.createTicketRecord(
                {
                    ...(safeOptions.input || {}),
                    reporter: safeOptions.reporter,
                    customer: safeOptions.customer,
                    vendor: safeOptions.vendor,
                    createdAt,
                    updatedAt: createdAt
                },
                { ticketStatus, ticketCategories, createdAt }
            );

        const validationResult = ticketValidation
            ? ticketValidation.validateCreateTicketInput(ticketRecord, {
                ticketStatus,
                ticketCategories,
                ticketModel
            })
            : validateCreateTicketInputFallback(ticketRecord);

        if (!validationResult.isValid) {
            return createServiceResult(false, {
                ticket: ticketRecord,
                validationResult,
                error: createServiceError(
                    "tickets/validation-failed",
                    "Some required ticket fields are missing or invalid.",
                    { errors: validationResult.errors }
                )
            });
        }

        return createServiceResult(true, {
            ticket: ticketRecord,
            validationResult,
            createdAt
        });
    }

    async function persistTicketCreate(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const firestoreFns = safeOptions.firestoreFns || {};
        const ticket = safeOptions.ticket && typeof safeOptions.ticket === "object"
            ? safeOptions.ticket
            : null;

        if (
            !safeOptions.db ||
            !ticket ||
            typeof firestoreFns.doc !== "function" ||
            typeof firestoreFns.setDoc !== "function"
        ) {
            return createServiceResult(false, {
                ticket,
                error: createServiceError(
                    "tickets/persist-unavailable",
                    "Database helpers are required before a ticket can be saved."
                )
            });
        }

        const timestampSeed = safeOptions.timestampSeed !== undefined
            ? safeOptions.timestampSeed
            : resolveTimestampValue({ ...safeOptions, useServerTimestamp: false });

        const ticketId = createTicketId({
            ...safeOptions,
            ticketId: ticket.ticketId,
            timestampSeed
        });

        const payload = buildTicketWritePayload(ticket, {
            ticketStatus: safeOptions.ticketStatus,
            ticketCategories: safeOptions.ticketCategories,
            ticketModel: safeOptions.ticketModel,
            ticketId
        });

        const docRef = getTicketDocRef(
            safeOptions.db,
            ticketId,
            firestoreFns,
            safeOptions.ticketQueries
        );

        if (!docRef) {
            return createServiceResult(false, {
                ticket,
                error: createServiceError(
                    "tickets/doc-ref-unavailable",
                    "A Firestore document reference for the ticket could not be created."
                )
            });
        }

        await firestoreFns.setDoc(docRef, payload);

        return createServiceResult(true, {
            ticket: payload,
            docRef
        });
    }

    async function createTicket(options = {}) {
        try {
            const preparedResult = prepareCreateTicket(options);

            if (!preparedResult.success) {
                return preparedResult;
            }

            const persistedResult = await persistTicketCreate({
                ...options,
                ticket: preparedResult.ticket
            });

            if (!persistedResult.success) {
                return persistedResult;
            }

            return createServiceResult(true, {
                ticket: persistedResult.ticket,
                docRef: persistedResult.docRef,
                createdAt: preparedResult.createdAt,
                validationResult: preparedResult.validationResult
            });
        } catch (error) {
            return createServiceResult(false, {
                ticket: null,
                error: createServiceError(
                    "tickets/create-failed",
                    error && error.message ? error.message : "Failed to create the ticket.",
                    { cause: error || null }
                )
            });
        }
    }

    async function getTicketById(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketQueries = resolveTicketQueries(safeOptions.ticketQueries);

        if (
            !ticketQueries ||
            typeof ticketQueries.fetchTicketById !== "function" ||
            !safeOptions.db ||
            !safeOptions.firestoreFns ||
            !normalizeText(safeOptions.ticketId)
        ) {
            return null;
        }

        return ticketQueries.fetchTicketById(safeOptions);
    }

    async function getReporterTickets(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketQueries = resolveTicketQueries(safeOptions.ticketQueries);

        if (
            !ticketQueries ||
            typeof ticketQueries.fetchReporterTickets !== "function" ||
            !safeOptions.db ||
            !safeOptions.firestoreFns ||
            !normalizeText(safeOptions.reporterUid)
        ) {
            return [];
        }

        return ticketQueries.fetchReporterTickets(safeOptions);
    }

    async function getAdminTickets(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketQueries = resolveTicketQueries(safeOptions.ticketQueries);

        if (
            !ticketQueries ||
            typeof ticketQueries.fetchAdminTickets !== "function" ||
            !safeOptions.db ||
            !safeOptions.firestoreFns
        ) {
            return [];
        }

        return ticketQueries.fetchAdminTickets(safeOptions);
    }

    async function getTicketReplies(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketQueries = resolveTicketQueries(safeOptions.ticketQueries);

        if (
            !ticketQueries ||
            typeof ticketQueries.fetchTicketReplies !== "function" ||
            !safeOptions.db ||
            !safeOptions.firestoreFns ||
            !normalizeText(safeOptions.ticketId)
        ) {
            return [];
        }

        return ticketQueries.fetchTicketReplies(safeOptions);
    }

    function createStatusUpdateFailure(code, message, currentTicket, transition) {
        return createServiceResult(false, {
            ticket: currentTicket || null,
            transition: transition || null,
            error: createServiceError(code, message, {
                transition: transition || null
            })
        });
    }

    function buildTicketStatusUpdate(ticketRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketStatus = resolveTicketStatus(safeOptions.ticketStatus);
        const ticketCategories = resolveTicketCategories(safeOptions.ticketCategories);
        const ticketModel = resolveTicketModel(safeOptions.ticketModel);

        if (!ticketStatus || !ticketModel) {
            return createStatusUpdateFailure(
                "tickets/dependencies-missing",
                "Ticket helpers are required before ticket status can be updated."
            );
        }

        const currentTicket = ticketModel.normalizeTicketRecord(ticketRecord, {
            ticketStatus,
            ticketCategories
        });
        const nextStatus = ticketStatus.normalizeTicketStatus(safeOptions.nextStatus);
        const actorRole = ticketStatus.normalizeTicketActorRole(safeOptions.actorRole);

        if (!actorRole) {
            return createStatusUpdateFailure(
                "tickets/invalid-actor",
                "A valid actor role is required to change ticket status.",
                currentTicket
            );
        }

        if (!nextStatus) {
            return createStatusUpdateFailure(
                "tickets/invalid-status",
                "The requested ticket status is not recognised.",
                currentTicket
            );
        }

        const validation = ticketStatus.validateTicketStatusTransition(
            currentTicket.status,
            nextStatus,
            actorRole
        );

        if (!validation.isValid) {
            return createStatusUpdateFailure(
                "tickets/invalid-status-change",
                validation.message,
                currentTicket,
                validation
            );
        }

        const updatedAt = resolveTimestampValue(safeOptions);
        const eventType =
            nextStatus === ticketStatus.TICKET_STATUSES.RESOLVED
                ? "resolved"
                : nextStatus === ticketStatus.TICKET_STATUSES.CLOSED
                    ? "closed"
                    : nextStatus === ticketStatus.TICKET_STATUSES.OPEN &&
                      currentTicket.status === ticketStatus.TICKET_STATUSES.CLOSED
                        ? "reopened"
                        : "status_changed";

        const timelineEntry = ticketModel.createTicketTimelineEntry(
            eventType,
            {
                status: nextStatus,
                actorRole,
                actorUid: safeOptions.actorUid,
                actorName: safeOptions.actorName,
                note: safeOptions.note,
                at: updatedAt
            },
            ticketStatus
        );

        const resolvedAt =
            nextStatus === ticketStatus.TICKET_STATUSES.RESOLVED
                ? updatedAt
                : nextStatus === ticketStatus.TICKET_STATUSES.OPEN
                    ? null
                    : currentTicket.resolvedAt;
        const resolvedByUid =
            nextStatus === ticketStatus.TICKET_STATUSES.RESOLVED
                ? normalizeText(safeOptions.actorUid)
                : nextStatus === ticketStatus.TICKET_STATUSES.OPEN
                    ? ""
                    : currentTicket.resolvedByUid;
        const resolvedByName =
            nextStatus === ticketStatus.TICKET_STATUSES.RESOLVED
                ? normalizeText(safeOptions.actorName)
                : nextStatus === ticketStatus.TICKET_STATUSES.OPEN
                    ? ""
                    : currentTicket.resolvedByName;
        const resolutionNote =
            nextStatus === ticketStatus.TICKET_STATUSES.RESOLVED &&
            normalizeText(safeOptions.resolutionNote)
                ? normalizeText(safeOptions.resolutionNote)
                : currentTicket.resolutionNote;

        const nextTimeline = (Array.isArray(currentTicket.timeline)
            ? currentTicket.timeline
            : []).concat(timelineEntry);

        const updatedTicket = buildTicketWritePayload(
            {
                ...currentTicket,
                status: nextStatus,
                timeline: nextTimeline,
                resolvedAt,
                resolvedByUid,
                resolvedByName,
                resolutionNote,
                updatedAt
            },
            {
                ticketStatus,
                ticketCategories,
                ticketModel,
                ticketId: currentTicket.ticketId,
                status: nextStatus,
                timeline: nextTimeline,
                updatedAt
            }
        );

        return createServiceResult(true, {
            ticket: updatedTicket,
            previousTicket: currentTicket,
            transition: validation,
            timelineEntry,
            needsWrite: true,
            statusChanged: currentTicket.status !== updatedTicket.status
        });
    }

    async function persistTicketUpdate(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const firestoreFns = safeOptions.firestoreFns || {};
        const ticket = safeOptions.ticket && typeof safeOptions.ticket === "object"
            ? safeOptions.ticket
            : null;

        if (
            !safeOptions.db ||
            !ticket ||
            !normalizeText(ticket.ticketId)
        ) {
            return createServiceResult(false, {
                ticket,
                error: createServiceError(
                    "tickets/update-unavailable",
                    "A valid database and ticket ID are required before saving updates."
                )
            });
        }

        const docRef = getTicketDocRef(
            safeOptions.db,
            ticket.ticketId,
            firestoreFns,
            safeOptions.ticketQueries
        );

        if (!docRef) {
            return createServiceResult(false, {
                ticket,
                error: createServiceError(
                    "tickets/doc-ref-unavailable",
                    "A Firestore document reference for the ticket could not be created."
                )
            });
        }

        const patch = buildTicketPatch(ticket, {
            ticketStatus: safeOptions.ticketStatus,
            ticketCategories: safeOptions.ticketCategories,
            ticketModel: safeOptions.ticketModel
        });

        if (typeof firestoreFns.updateDoc === "function") {
            await firestoreFns.updateDoc(docRef, patch);

            return createServiceResult(true, { ticket, patch, docRef });
        }

        if (typeof firestoreFns.setDoc === "function") {
            await firestoreFns.setDoc(docRef, patch, { merge: true });

            return createServiceResult(true, { ticket, patch, docRef });
        }

        return createServiceResult(false, {
            ticket,
            error: createServiceError(
                "tickets/update-write-unavailable",
                "Firestore updateDoc or setDoc is required before saving ticket updates."
            )
        });
    }

    async function updateTicketStatus(options = {}) {
        try {
            const safeOptions = options && typeof options === "object" ? options : {};
            const sourceTicket = safeOptions.ticket || await getTicketById(safeOptions);

            if (!sourceTicket) {
                return createServiceResult(false, {
                    ticket: null,
                    error: createServiceError(
                        "tickets/not-found",
                        "The requested ticket could not be found."
                    )
                });
            }

            const updatePlan = buildTicketStatusUpdate(sourceTicket, safeOptions);

            if (!updatePlan.success || updatePlan.needsWrite === false) {
                return updatePlan;
            }

            const persistedResult = await persistTicketUpdate({
                ...safeOptions,
                ticket: updatePlan.ticket
            });

            if (!persistedResult.success) {
                return persistedResult;
            }

            return createServiceResult(true, {
                ticket: persistedResult.ticket,
                previousTicket: updatePlan.previousTicket,
                transition: updatePlan.transition,
                timelineEntry: updatePlan.timelineEntry,
                statusChanged: updatePlan.statusChanged,
                docRef: persistedResult.docRef,
                patch: persistedResult.patch || null
            });
        } catch (error) {
            return createServiceResult(false, {
                ticket: null,
                error: createServiceError(
                    "tickets/status-update-failed",
                    error && error.message
                        ? error.message
                        : "Failed to update the ticket status.",
                    { cause: error || null }
                )
            });
        }
    }

    function buildAddReplyUpdate(ticketRecord, replyValues, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketStatus = resolveTicketStatus(safeOptions.ticketStatus);
        const ticketCategories = resolveTicketCategories(safeOptions.ticketCategories);
        const ticketModel = resolveTicketModel(safeOptions.ticketModel);
        const safeReply = replyValues && typeof replyValues === "object" ? replyValues : {};

        if (!ticketModel) {
            return createServiceResult(false, {
                ticket: null,
                reply: null,
                error: createServiceError(
                    "tickets/dependencies-missing",
                    "Ticket helpers are required before a reply can be added."
                )
            });
        }

        if (!normalizeText(safeReply.body || safeReply.message)) {
            return createServiceResult(false, {
                ticket: ticketRecord || null,
                reply: null,
                error: createServiceError(
                    "tickets/empty-reply",
                    "A reply must include a message body."
                )
            });
        }

        const currentTicket = ticketModel.normalizeTicketRecord(ticketRecord, {
            ticketStatus,
            ticketCategories
        });

        if (!normalizeText(currentTicket.ticketId)) {
            return createServiceResult(false, {
                ticket: currentTicket,
                reply: null,
                error: createServiceError(
                    "tickets/missing-ticket-id",
                    "The ticket does not have an ID to attach the reply to."
                )
            });
        }

        const updatedAt = resolveTimestampValue(safeOptions);
        const replyPayload = buildReplyWritePayload(
            {
                ...safeReply,
                ticketId: currentTicket.ticketId,
                createdAt: updatedAt
            },
            {
                replyId: safeOptions.replyId,
                ticketModel,
                defaultAuthorRole: safeOptions.defaultAuthorRole || safeReply.authorRole,
                createdAt: updatedAt
            }
        );

        const autoStatusUpdate = safeOptions.autoStatusUpdate !== false;
        const nextStatus = autoStatusUpdate
            ? autoStatusForReply(currentTicket.status, replyPayload.authorRole, ticketStatus)
            : currentTicket.status;

        const eventType = "replied";
        const timelineEntry = ticketModel.createTicketTimelineEntry(
            eventType,
            {
                status: nextStatus,
                actorRole: replyPayload.authorRole,
                actorUid: replyPayload.authorUid,
                actorName: replyPayload.authorName,
                note: replyPayload.isInternalNote ? "Internal note added." : "New reply added.",
                at: updatedAt
            },
            ticketStatus
        );

        const nextTimeline = (Array.isArray(currentTicket.timeline)
            ? currentTicket.timeline
            : []).concat(timelineEntry);

        const updatedTicket = buildTicketWritePayload(
            {
                ...currentTicket,
                status: nextStatus,
                timeline: nextTimeline,
                replyCount: (currentTicket.replyCount || 0) + 1,
                lastReplyAt: updatedAt,
                updatedAt
            },
            {
                ticketStatus,
                ticketCategories,
                ticketModel,
                ticketId: currentTicket.ticketId,
                status: nextStatus,
                timeline: nextTimeline,
                updatedAt
            }
        );

        return createServiceResult(true, {
            ticket: updatedTicket,
            previousTicket: currentTicket,
            reply: replyPayload,
            timelineEntry,
            statusChanged: currentTicket.status !== updatedTicket.status,
            needsWrite: true
        });
    }

    async function persistTicketReply(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const firestoreFns = safeOptions.firestoreFns || {};
        const ticket = safeOptions.ticket && typeof safeOptions.ticket === "object"
            ? safeOptions.ticket
            : null;
        const reply = safeOptions.reply && typeof safeOptions.reply === "object"
            ? safeOptions.reply
            : null;

        if (
            !safeOptions.db ||
            !ticket ||
            !reply ||
            !normalizeText(ticket.ticketId) ||
            typeof firestoreFns.setDoc !== "function" ||
            typeof firestoreFns.doc !== "function"
        ) {
            return createServiceResult(false, {
                ticket,
                reply,
                error: createServiceError(
                    "tickets/reply-write-unavailable",
                    "Database helpers are required before a reply can be saved."
                )
            });
        }

        const timestampSeed = safeOptions.timestampSeed !== undefined
            ? safeOptions.timestampSeed
            : resolveTimestampValue({ ...safeOptions, useServerTimestamp: false });

        const replyId = createReplyId({
            ...safeOptions,
            ticketId: ticket.ticketId,
            replyId: reply.replyId,
            timestampSeed
        });

        const replyDocRef = getReplyDocRef(
            safeOptions.db,
            ticket.ticketId,
            replyId,
            firestoreFns,
            safeOptions.ticketQueries
        );

        if (!replyDocRef) {
            return createServiceResult(false, {
                ticket,
                reply,
                error: createServiceError(
                    "tickets/reply-doc-ref-unavailable",
                    "A Firestore document reference for the reply could not be created."
                )
            });
        }

        const replyPayload = { ...reply, replyId };

        await firestoreFns.setDoc(replyDocRef, replyPayload);

        let updateResult;
        try {
            updateResult = await persistTicketUpdate({
                ...safeOptions,
                ticket
            });
        } catch (error) {
            return createServiceResult(false, {
                ticket,
                reply: replyPayload,
                replyDocRef,
                error: createServiceError(
                    "tickets/reply-parent-write-failed",
                    error && error.message
                        ? error.message
                        : "The reply was saved but the parent ticket could not be updated.",
                    { cause: error || null }
                )
            });
        }

        if (!updateResult.success) {
            return createServiceResult(false, {
                ticket,
                reply: replyPayload,
                replyDocRef,
                error: updateResult.error || createServiceError(
                    "tickets/reply-parent-write-failed",
                    "The reply was saved but the parent ticket could not be updated."
                )
            });
        }

        return createServiceResult(true, {
            ticket: updateResult.ticket,
            reply: replyPayload,
            replyDocRef,
            docRef: updateResult.docRef,
            patch: updateResult.patch || null
        });
    }

    async function addReply(options = {}) {
        try {
            const safeOptions = options && typeof options === "object" ? options : {};
            const sourceTicket = safeOptions.ticket || await getTicketById(safeOptions);

            if (!sourceTicket) {
                return createServiceResult(false, {
                    ticket: null,
                    reply: null,
                    error: createServiceError(
                        "tickets/not-found",
                        "The requested ticket could not be found."
                    )
                });
            }

            const updatePlan = buildAddReplyUpdate(
                sourceTicket,
                safeOptions.reply || {},
                safeOptions
            );

            if (!updatePlan.success) {
                return updatePlan;
            }

            const persistedResult = await persistTicketReply({
                ...safeOptions,
                ticket: updatePlan.ticket,
                reply: updatePlan.reply
            });

            if (!persistedResult.success) {
                return persistedResult;
            }

            return createServiceResult(true, {
                ticket: persistedResult.ticket,
                previousTicket: updatePlan.previousTicket,
                reply: persistedResult.reply,
                timelineEntry: updatePlan.timelineEntry,
                statusChanged: updatePlan.statusChanged,
                replyDocRef: persistedResult.replyDocRef,
                docRef: persistedResult.docRef,
                patch: persistedResult.patch || null
            });
        } catch (error) {
            return createServiceResult(false, {
                ticket: null,
                reply: null,
                error: createServiceError(
                    "tickets/reply-failed",
                    error && error.message ? error.message : "Failed to add the reply.",
                    { cause: error || null }
                )
            });
        }
    }

    async function closeTicketByReporter(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        return updateTicketStatus({
            ...safeOptions,
            nextStatus: "closed",
            actorRole: safeOptions.actorRole || "customer"
        });
    }

    async function reopenTicket(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        return updateTicketStatus({
            ...safeOptions,
            nextStatus: "open"
        });
    }

    const ticketService = {
        MODULE_NAME,
        SUPPORT_TICKETS_COLLECTION,
        REPLIES_SUBCOLLECTION,
        resolveTicketStatus,
        resolveTicketCategories,
        resolveTicketModel,
        resolveTicketQueries,
        resolveTicketValidation,
        normalizeText,
        normalizeLowerText,
        createServiceError,
        createServiceResult,
        resolveTimestampValue,
        getTicketsCollectionRefFallback,
        getTicketDocRef,
        getRepliesCollectionRef,
        getReplyDocRef,
        createTicketId,
        createReplyId,
        buildTicketWritePayload,
        buildTicketPatch,
        buildReplyWritePayload,
        validateCreateTicketInputFallback,
        autoStatusForReply,
        prepareCreateTicket,
        persistTicketCreate,
        createTicket,
        getTicketById,
        getReporterTickets,
        getAdminTickets,
        getTicketReplies,
        buildTicketStatusUpdate,
        persistTicketUpdate,
        updateTicketStatus,
        buildAddReplyUpdate,
        persistTicketReply,
        addReply,
        closeTicketByReporter,
        reopenTicket
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = ticketService;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.ticketService = ticketService;
    }
})(typeof window !== "undefined" ? window : globalThis);
