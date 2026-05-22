(function attachTicketValidation(globalScope) {
    "use strict";

    const MODULE_NAME = "ticket-validation";

    const DEFAULT_SUBJECT_MIN_LENGTH = 3;
    const DEFAULT_SUBJECT_MAX_LENGTH = 120;
    const DEFAULT_DESCRIPTION_MIN_LENGTH = 10;
    const DEFAULT_DESCRIPTION_MAX_LENGTH = 4000;
    const DEFAULT_REPLY_MIN_LENGTH = 1;
    const DEFAULT_REPLY_MAX_LENGTH = 4000;

    function resolveTicketStatus(explicitTicketStatus) {
        if (
            explicitTicketStatus &&
            typeof explicitTicketStatus.normalizeTicketStatus === "function" &&
            typeof explicitTicketStatus.validateTicketStatusTransition === "function"
        ) {
            return explicitTicketStatus;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.ticketStatus &&
            typeof globalScope.ticketStatus.normalizeTicketStatus === "function" &&
            typeof globalScope.ticketStatus.validateTicketStatusTransition === "function"
        ) {
            return globalScope.ticketStatus;
        }

        if (typeof require === "function") {
            try {
                const requiredTicketStatus = require("./ticket-status.js");

                if (
                    requiredTicketStatus &&
                    typeof requiredTicketStatus.normalizeTicketStatus === "function" &&
                    typeof requiredTicketStatus.validateTicketStatusTransition === "function"
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
            typeof explicitTicketCategories.isKnownTicketCategory === "function"
        ) {
            return explicitTicketCategories;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.ticketCategories &&
            typeof globalScope.ticketCategories.normalizeTicketCategory === "function" &&
            typeof globalScope.ticketCategories.isKnownTicketCategory === "function"
        ) {
            return globalScope.ticketCategories;
        }

        if (typeof require === "function") {
            try {
                const requiredTicketCategories = require("./ticket-categories.js");

                if (
                    requiredTicketCategories &&
                    typeof requiredTicketCategories.normalizeTicketCategory === "function" &&
                    typeof requiredTicketCategories.isKnownTicketCategory === "function"
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
            typeof explicitTicketModel.normalizeTicketRecord === "function" &&
            typeof explicitTicketModel.createReporterSnapshot === "function"
        ) {
            return explicitTicketModel;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.ticketModel &&
            typeof globalScope.ticketModel.normalizeTicketRecord === "function" &&
            typeof globalScope.ticketModel.createReporterSnapshot === "function"
        ) {
            return globalScope.ticketModel;
        }

        if (typeof require === "function") {
            try {
                const requiredTicketModel = require("./ticket-model.js");

                if (
                    requiredTicketModel &&
                    typeof requiredTicketModel.normalizeTicketRecord === "function" &&
                    typeof requiredTicketModel.createReporterSnapshot === "function"
                ) {
                    return requiredTicketModel;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveRefundCaseModel(explicitRefundCaseModel) {
        if (
            explicitRefundCaseModel &&
            typeof explicitRefundCaseModel.createRefundCaseRecord === "function"
        ) {
            return explicitRefundCaseModel;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.refundCaseModel &&
            typeof globalScope.refundCaseModel.createRefundCaseRecord === "function"
        ) {
            return globalScope.refundCaseModel;
        }

        if (typeof require === "function") {
            try {
                const requiredRefundCaseModel = require("./refund-case-model.js");

                if (
                    requiredRefundCaseModel &&
                    typeof requiredRefundCaseModel.createRefundCaseRecord === "function"
                ) {
                    return requiredRefundCaseModel;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveRefundCaseValidation(explicitRefundCaseValidation) {
        if (
            explicitRefundCaseValidation &&
            typeof explicitRefundCaseValidation.validateRefundCaseRecord === "function"
        ) {
            return explicitRefundCaseValidation;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.refundCaseValidation &&
            typeof globalScope.refundCaseValidation.validateRefundCaseRecord === "function"
        ) {
            return globalScope.refundCaseValidation;
        }

        if (typeof require === "function") {
            try {
                const requiredRefundCaseValidation = require("./refund-case-validation.js");

                if (
                    requiredRefundCaseValidation &&
                    typeof requiredRefundCaseValidation.validateRefundCaseRecord === "function"
                ) {
                    return requiredRefundCaseValidation;
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

    function createValidationResult(errors, details = {}) {
        const safeErrors = errors && typeof errors === "object" ? errors : {};

        return {
            isValid: Object.keys(safeErrors).length === 0,
            errors: safeErrors,
            ...details
        };
    }

    function setError(errors, key, message) {
        if (!errors || !key || !message) {
            return errors;
        }

        if (!Object.prototype.hasOwnProperty.call(errors, key)) {
            errors[key] = message;
        }

        return errors;
    }

    function mergeErrors(targetErrors, sourceErrors, prefix) {
        const safeTarget = targetErrors && typeof targetErrors === "object" ? targetErrors : {};
        const safeSource = sourceErrors && typeof sourceErrors === "object" ? sourceErrors : {};
        const safePrefix = normalizeText(prefix);

        Object.keys(safeSource).forEach(function mergeOne(key) {
            const finalKey = safePrefix ? `${safePrefix}.${key}` : key;
            setError(safeTarget, finalKey, safeSource[key]);
        });

        return safeTarget;
    }

    function isValidEmail(value) {
        const normalizedValue = normalizeLowerText(value);

        if (!normalizedValue) {
            return false;
        }

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedValue);
    }

    function categoryRequiresOrderId(category, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketCategories = resolveTicketCategories(safeOptions.ticketCategories);

        if (ticketCategories && typeof ticketCategories.isOrderRelatedCategory === "function") {
            return ticketCategories.isOrderRelatedCategory(category) === true;
        }

        const normalized = normalizeLowerText(category);
        return normalized === "order_issue" || normalized === "payment" || normalized === "refund";
    }

    function validateReporterSnapshot(reporterSnapshot, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketModel = resolveTicketModel(safeOptions.ticketModel);
        const safeSnapshot = reporterSnapshot && typeof reporterSnapshot === "object"
            ? reporterSnapshot
            : {};
        const value = ticketModel
            ? ticketModel.createReporterSnapshot(safeSnapshot)
            : {
                reporterUid: normalizeText(safeSnapshot.reporterUid),
                reporterRole: normalizeLowerText(safeSnapshot.reporterRole),
                reporterName: normalizeText(safeSnapshot.reporterName),
                reporterEmail: normalizeLowerText(safeSnapshot.reporterEmail)
            };
        const errors = {};
        const rawReporterUid = normalizeText(safeSnapshot.reporterUid || safeSnapshot.uid);
        const rawReporterRole = normalizeLowerText(safeSnapshot.reporterRole || safeSnapshot.role);
        const rawReporterName = normalizeText(
            safeSnapshot.reporterName ||
            safeSnapshot.displayName ||
            safeSnapshot.fullName ||
            safeSnapshot.name
        );
        const rawReporterEmail = normalizeLowerText(safeSnapshot.reporterEmail || safeSnapshot.email);

        if (!rawReporterUid) {
            setError(errors, "reporterUid", "Reporter UID is required.");
        }

        if (rawReporterRole !== "customer" && rawReporterRole !== "vendor") {
            setError(errors, "reporterRole", "Reporter role must be customer or vendor.");
        }

        if (safeOptions.requireReporterName !== false && !rawReporterName) {
            setError(errors, "reporterName", "Reporter name is required.");
        }

        if (safeOptions.requireReporterEmail === true) {
            if (!rawReporterEmail) {
                setError(errors, "reporterEmail", "Reporter email is required.");
            } else if (!isValidEmail(rawReporterEmail)) {
                setError(errors, "reporterEmail", "Reporter email must be a valid email address.");
            }
        } else if (rawReporterEmail && !isValidEmail(rawReporterEmail)) {
            setError(errors, "reporterEmail", "Reporter email must be a valid email address.");
        }

        return createValidationResult(errors, { value });
    }

    function validateTicketTimeline(timeline, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeTimeline = Array.isArray(timeline) ? timeline : [];
        const ticketStatus = resolveTicketStatus(safeOptions.ticketStatus);
        const ticketModel = resolveTicketModel(safeOptions.ticketModel);
        const errors = {};
        const value = [];

        if (!Array.isArray(timeline) || safeTimeline.length === 0) {
            setError(errors, "timeline", "At least one timeline entry is required.");
        }

        safeTimeline.forEach(function validateOneEntry(entry, index) {
            const safeEntry = entry && typeof entry === "object" ? entry : {};
            const normalizedEntry = ticketModel
                ? ticketModel.createTicketTimelineEntry(
                    safeEntry.eventType,
                    safeEntry,
                    ticketStatus
                )
                : {
                    eventType: normalizeLowerText(safeEntry.eventType) || "status_changed",
                    status: normalizeLowerText(safeEntry.status),
                    label: normalizeText(safeEntry.label),
                    actorRole: normalizeLowerText(safeEntry.actorRole),
                    actorUid: normalizeText(safeEntry.actorUid),
                    actorName: normalizeText(safeEntry.actorName),
                    note: normalizeText(safeEntry.note),
                    at: safeEntry.at !== undefined ? safeEntry.at : safeEntry.timestamp
                };

            value.push(normalizedEntry);

            const knownEvents = [
                "created",
                "status_changed",
                "replied",
                "resolved",
                "reopened",
                "closed",
                "escalated",
                "refund_proposed",
                "refund_decision_approved",
                "refund_decision_declined",
                "refund_processing",
                "refund_completed",
                "refund_failed",
                "refund_cancelled"
            ];
            const rawEventType = normalizeLowerText(safeEntry.eventType);
            const rawStatus = normalizeLowerText(safeEntry.status);
            const rawActorRole = normalizeLowerText(safeEntry.actorRole || safeEntry.role);
            const rawAt = safeEntry.at !== undefined ? safeEntry.at : safeEntry.timestamp;

            if (rawEventType && knownEvents.indexOf(rawEventType) === -1) {
                setError(
                    errors,
                    `timeline.${index}.eventType`,
                    "Timeline entries need a known event type."
                );
            } else if (!rawEventType) {
                setError(
                    errors,
                    `timeline.${index}.eventType`,
                    "Timeline entries need an event type."
                );
            }

            if (ticketStatus && typeof ticketStatus.isKnownTicketStatus === "function") {
                if (!ticketStatus.isKnownTicketStatus(rawStatus)) {
                    setError(
                        errors,
                        `timeline.${index}.status`,
                        "Timeline entries need a valid ticket status."
                    );
                }
            } else if (!rawStatus) {
                setError(
                    errors,
                    `timeline.${index}.status`,
                    "Timeline entries need a valid ticket status."
                );
            }

            const knownActorRoles = ["customer", "vendor", "admin", "system"];
            if (!rawActorRole || knownActorRoles.indexOf(rawActorRole) === -1) {
                setError(
                    errors,
                    `timeline.${index}.actorRole`,
                    "Timeline entries need a valid actor role."
                );
            }

            if (rawAt === null || rawAt === undefined) {
                setError(errors, `timeline.${index}.at`, "Timeline entries need a timestamp.");
            }
        });

        return createValidationResult(errors, { value });
    }

    function validateTicketRecord(ticketRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeRecord = ticketRecord && typeof ticketRecord === "object" ? ticketRecord : {};
        const ticketStatus = resolveTicketStatus(safeOptions.ticketStatus);
        const ticketCategories = resolveTicketCategories(safeOptions.ticketCategories);
        const ticketModel = resolveTicketModel(safeOptions.ticketModel);
        const refundCaseModel = resolveRefundCaseModel(safeOptions.refundCaseModel);
        const refundCaseValidation = resolveRefundCaseValidation(safeOptions.refundCaseValidation);
        const value = ticketModel
            ? ticketModel.normalizeTicketRecord(safeRecord, {
                ticketStatus,
                ticketCategories,
                refundCaseModel,
                order: safeOptions.order,
                payment: safeOptions.payment
            })
            : safeRecord;
        const errors = {};

        const rawReporter = safeRecord.reporter && typeof safeRecord.reporter === "object"
            ? safeRecord.reporter
            : safeRecord;
        const reporterValidation = validateReporterSnapshot(rawReporter, {
            ticketModel,
            requireReporterName: safeOptions.requireReporterName !== false,
            requireReporterEmail: safeOptions.requireReporterEmail === true
        });
        mergeErrors(errors, reporterValidation.errors);

        const subjectMinLength = Number.isFinite(safeOptions.subjectMinLength)
            ? safeOptions.subjectMinLength
            : DEFAULT_SUBJECT_MIN_LENGTH;
        const subjectMaxLength = Number.isFinite(safeOptions.subjectMaxLength)
            ? safeOptions.subjectMaxLength
            : DEFAULT_SUBJECT_MAX_LENGTH;
        const rawSubject = normalizeText(safeRecord.subject || safeRecord.title);

        if (!rawSubject) {
            setError(errors, "subject", "Please add a short subject.");
        } else if (rawSubject.length < subjectMinLength) {
            setError(errors, "subject", `Subject must be at least ${subjectMinLength} characters.`);
        } else if (rawSubject.length > subjectMaxLength) {
            setError(errors, "subject", `Subject must be at most ${subjectMaxLength} characters.`);
        }

        const descriptionMinLength = Number.isFinite(safeOptions.descriptionMinLength)
            ? safeOptions.descriptionMinLength
            : DEFAULT_DESCRIPTION_MIN_LENGTH;
        const descriptionMaxLength = Number.isFinite(safeOptions.descriptionMaxLength)
            ? safeOptions.descriptionMaxLength
            : DEFAULT_DESCRIPTION_MAX_LENGTH;
        const rawDescription = normalizeText(
            safeRecord.description || safeRecord.body || safeRecord.message
        );

        if (!rawDescription) {
            setError(errors, "description", "Please describe what is going on.");
        } else if (rawDescription.length < descriptionMinLength) {
            setError(errors, "description", `Description must be at least ${descriptionMinLength} characters.`);
        } else if (rawDescription.length > descriptionMaxLength) {
            setError(errors, "description", `Description must be at most ${descriptionMaxLength} characters.`);
        }

        const rawCategory = normalizeLowerText(safeRecord.category);
        if (!rawCategory) {
            setError(errors, "category", "Please pick a category.");
        } else if (ticketCategories && !ticketCategories.isKnownTicketCategory(rawCategory)) {
            setError(errors, "category", "Category must be a known support category.");
        }

        if (
            rawCategory &&
            categoryRequiresOrderId(rawCategory, { ticketCategories }) &&
            !normalizeText(safeRecord.orderId)
        ) {
            setError(errors, "orderId", "This category needs the order it is about.");
        }

        if (safeRecord.status !== undefined) {
            const rawStatus = normalizeLowerText(safeRecord.status);
            const statusIsKnown = ticketStatus &&
                typeof ticketStatus.isKnownTicketStatus === "function"
                ? ticketStatus.isKnownTicketStatus(safeRecord.status)
                : !!rawStatus;

            if (!statusIsKnown) {
                setError(errors, "status", "Ticket status must be valid.");
            }
        }

        if (safeRecord.priority !== undefined) {
            const priority = normalizeLowerText(safeRecord.priority);
            if (priority !== "normal" && priority !== "high") {
                setError(errors, "priority", "Priority must be normal or high.");
            }
        }

        if (!safeRecord.createdAt) {
            setError(errors, "createdAt", "Ticket createdAt is required.");
        }

        if (!safeRecord.updatedAt) {
            setError(errors, "updatedAt", "Ticket updatedAt is required.");
        }

        if (safeOptions.requireTimeline !== false) {
            const timelineSource = Array.isArray(safeRecord.timeline)
                ? safeRecord.timeline
                : (ticketModel ? value.timeline : []);
            const timelineValidation = validateTicketTimeline(timelineSource, {
                ticketModel,
                ticketStatus
            });
            mergeErrors(errors, timelineValidation.errors);
        }

        if (safeRecord.refundCase !== undefined && safeRecord.refundCase !== null) {
            if (!refundCaseValidation) {
                setError(errors, "refundCase", "Refund case validation helpers are unavailable.");
            } else {
                const refundCaseValidationResult = refundCaseValidation.validateRefundCaseRecord(
                    safeRecord.refundCase,
                    {
                        refundCaseModel,
                        order: safeOptions.order || safeOptions.payment || {
                            orderId: normalizeText(safeRecord.orderId),
                            customerUid: value.customerUid,
                            vendorUid: value.vendorUid,
                            paymentStatus: safeOptions.paymentStatus,
                            paymentReference: safeOptions.paymentReference,
                            paymentAmount: safeOptions.paymentAmount,
                            paymentAmountInMinorUnits: safeOptions.paymentAmountInMinorUnits
                        },
                        requirePaid: safeOptions.requireRefundPaidOrder !== false,
                        requireOrderId: safeOptions.requireOrderId !== false
                    }
                );

                mergeErrors(errors, refundCaseValidationResult.errors, "refundCase");
            }
        }

        return createValidationResult(errors, { value });
    }

    function validateCreateTicketInput(ticketInput, options = {}) {
        return validateTicketRecord(ticketInput, options);
    }

    function validateReplyRecord(replyRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeReply = replyRecord && typeof replyRecord === "object" ? replyRecord : {};
        const ticketModel = resolveTicketModel(safeOptions.ticketModel);
        const value = ticketModel && typeof ticketModel.createReplyRecord === "function"
            ? ticketModel.createReplyRecord(safeReply)
            : {
                replyId: normalizeText(safeReply.replyId),
                ticketId: normalizeText(safeReply.ticketId),
                authorUid: normalizeText(safeReply.authorUid),
                authorRole: normalizeLowerText(safeReply.authorRole),
                authorName: normalizeText(safeReply.authorName),
                body: normalizeText(safeReply.body || safeReply.message),
                isInternalNote: safeReply.isInternalNote === true,
                createdAt: safeReply.createdAt
            };
        const errors = {};

        const rawTicketId = normalizeText(safeReply.ticketId);
        const rawAuthorUid = normalizeText(safeReply.authorUid || safeReply.uid);
        const rawAuthorRole = normalizeLowerText(safeReply.authorRole || safeReply.role);
        const rawBody = normalizeText(safeReply.body || safeReply.message);
        const rawIsInternalNote = safeReply.isInternalNote === true ||
            safeReply.internalNote === true;
        const rawCreatedAt = safeReply.createdAt;

        if (!rawTicketId) {
            setError(errors, "ticketId", "Reply must reference a ticket.");
        }

        if (!rawAuthorUid) {
            setError(errors, "authorUid", "Reply must include an author UID.");
        }

        const knownAuthorRoles = ["customer", "vendor", "admin", "system"];
        if (!rawAuthorRole || knownAuthorRoles.indexOf(rawAuthorRole) === -1) {
            setError(errors, "authorRole", "Reply must include a valid author role.");
        }

        const replyMinLength = Number.isFinite(safeOptions.replyMinLength)
            ? safeOptions.replyMinLength
            : DEFAULT_REPLY_MIN_LENGTH;
        const replyMaxLength = Number.isFinite(safeOptions.replyMaxLength)
            ? safeOptions.replyMaxLength
            : DEFAULT_REPLY_MAX_LENGTH;

        if (!rawBody) {
            setError(errors, "body", "Reply body cannot be empty.");
        } else if (rawBody.length < replyMinLength) {
            setError(errors, "body", `Reply must be at least ${replyMinLength} characters.`);
        } else if (rawBody.length > replyMaxLength) {
            setError(errors, "body", `Reply must be at most ${replyMaxLength} characters.`);
        }

        if (rawIsInternalNote === true && rawAuthorRole !== "admin") {
            setError(errors, "isInternalNote", "Only admins can post internal notes.");
        }

        if (rawCreatedAt === undefined || rawCreatedAt === null) {
            setError(errors, "createdAt", "Reply createdAt is required.");
        }

        return createValidationResult(errors, { value });
    }

    function validateAddReplyInput(replyInput, options = {}) {
        return validateReplyRecord(replyInput, options);
    }

    function validateTicketStatusChange(currentStatus, nextStatus, actorRole, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketStatus = resolveTicketStatus(safeOptions.ticketStatus);

        if (!ticketStatus) {
            return createValidationResult({
                status: "Ticket status helpers are unavailable."
            }, {
                transition: null
            });
        }

        const transition = ticketStatus.validateTicketStatusTransition(
            currentStatus,
            nextStatus,
            actorRole
        );

        return createValidationResult(
            transition.isValid ? {} : { status: transition.message },
            { transition }
        );
    }

    const ticketValidation = {
        MODULE_NAME,
        DEFAULT_SUBJECT_MIN_LENGTH,
        DEFAULT_SUBJECT_MAX_LENGTH,
        DEFAULT_DESCRIPTION_MIN_LENGTH,
        DEFAULT_DESCRIPTION_MAX_LENGTH,
        DEFAULT_REPLY_MIN_LENGTH,
        DEFAULT_REPLY_MAX_LENGTH,
        resolveTicketStatus,
        resolveTicketCategories,
        resolveTicketModel,
        resolveRefundCaseModel,
        resolveRefundCaseValidation,
        normalizeText,
        normalizeLowerText,
        createValidationResult,
        setError,
        mergeErrors,
        isValidEmail,
        categoryRequiresOrderId,
        validateReporterSnapshot,
        validateTicketTimeline,
        validateTicketRecord,
        validateCreateTicketInput,
        validateReplyRecord,
        validateAddReplyInput,
        validateTicketStatusChange
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = ticketValidation;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.ticketValidation = ticketValidation;
    }
})(typeof window !== "undefined" ? window : globalThis);
