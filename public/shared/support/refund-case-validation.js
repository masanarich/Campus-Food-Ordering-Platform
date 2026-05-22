(function attachRefundCaseValidation(globalScope) {
    "use strict";

    const MODULE_NAME = "refund-case-validation";
    const DEFAULT_REASON_MIN_LENGTH = 5;
    const DEFAULT_REASON_MAX_LENGTH = 600;
    const DEFAULT_NOTE_MAX_LENGTH = 1000;

    function resolveRefundCaseModel(explicitRefundCaseModel) {
        if (
            explicitRefundCaseModel &&
            typeof explicitRefundCaseModel.createRefundCaseRecord === "function" &&
            typeof explicitRefundCaseModel.normalizeRefundCaseStatus === "function" &&
            typeof explicitRefundCaseModel.calculateRefundFinancialImpact === "function"
        ) {
            return explicitRefundCaseModel;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.refundCaseModel &&
            typeof globalScope.refundCaseModel.createRefundCaseRecord === "function" &&
            typeof globalScope.refundCaseModel.normalizeRefundCaseStatus === "function" &&
            typeof globalScope.refundCaseModel.calculateRefundFinancialImpact === "function"
        ) {
            return globalScope.refundCaseModel;
        }

        if (typeof require === "function") {
            try {
                const requiredRefundCaseModel = require("./refund-case-model.js");

                if (
                    requiredRefundCaseModel &&
                    typeof requiredRefundCaseModel.createRefundCaseRecord === "function" &&
                    typeof requiredRefundCaseModel.normalizeRefundCaseStatus === "function" &&
                    typeof requiredRefundCaseModel.calculateRefundFinancialImpact === "function"
                ) {
                    return requiredRefundCaseModel;
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

    function normalizeCurrencyAmount(value, fallbackValue) {
        const parsed = Number.parseFloat(value);
        const fallbackParsed = Number.parseFloat(fallbackValue);

        if (Number.isFinite(parsed)) {
            return Math.max(0, Math.round((parsed + Number.EPSILON) * 100) / 100);
        }

        if (Number.isFinite(fallbackParsed)) {
            return Math.max(0, Math.round((fallbackParsed + Number.EPSILON) * 100) / 100);
        }

        return 0;
    }

    function normalizeAmountInMinorUnits(value, fallbackValue) {
        const parsed = Number.parseInt(value, 10);
        const fallbackParsed = Number.parseInt(fallbackValue, 10);

        if (Number.isFinite(parsed)) {
            return Math.max(0, parsed);
        }

        if (Number.isFinite(fallbackParsed)) {
            return Math.max(0, fallbackParsed);
        }

        return 0;
    }

    function amountToMinorUnits(amount) {
        return Math.round(normalizeCurrencyAmount(amount) * 100);
    }

    function createValidationResult(errors, details = {}) {
        const safeErrors = errors && typeof errors === "object" ? errors : {};
        const safeDetails = details && typeof details === "object" ? details : {};

        return {
            isValid: Object.keys(safeErrors).length === 0,
            errors: safeErrors,
            ...safeDetails
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
        const target = targetErrors && typeof targetErrors === "object" ? targetErrors : {};
        const source = sourceErrors && typeof sourceErrors === "object" ? sourceErrors : {};
        const safePrefix = normalizeText(prefix);

        Object.keys(source).forEach(function mergeOne(key) {
            setError(target, safePrefix ? `${safePrefix}.${key}` : key, source[key]);
        });

        return target;
    }

    function getRefundCaseModelOrFallback(options = {}) {
        const model = resolveRefundCaseModel(options.refundCaseModel);

        if (model) {
            return model;
        }

        return {
            REFUND_TYPES: { PARTIAL: "partial", FULL: "full" },
            DECISIONS: { PENDING: "pending", APPROVED: "approved", DECLINED: "declined" },
            DECISION_ACTOR_ROLES: { CUSTOMER: "customer", VENDOR: "vendor", ADMIN: "admin", SYSTEM: "system" },
            REFUND_CASE_STATUSES: {
                NOT_REQUESTED: "not_requested",
                PROPOSED: "proposed",
                CUSTOMER_APPROVED: "customer_approved",
                VENDOR_APPROVED: "vendor_approved",
                APPROVED: "approved",
                PROCESSING: "processing",
                REFUNDED: "refunded",
                DECLINED: "declined",
                FAILED: "failed",
                CANCELLED: "cancelled"
            },
            normalizeRefundType(value) {
                const normalized = normalizeLowerText(value).replace(/[\s_-]+/g, "");
                return normalized === "full" || normalized === "complete" ? "full" : "partial";
            },
            normalizeDecision(value) {
                const normalized = normalizeLowerText(value).replace(/[\s_-]+/g, "");
                if (normalized === "approved" || normalized === "approve" || normalized === "yes") return "approved";
                if (normalized === "declined" || normalized === "decline" || normalized === "rejected" || normalized === "no") return "declined";
                return "pending";
            },
            normalizeActorRole(value) {
                const normalized = normalizeLowerText(value);
                return ["customer", "vendor", "admin", "system"].indexOf(normalized) >= 0 ? normalized : "system";
            },
            normalizeRefundCaseStatus(value) {
                const normalized = normalizeLowerText(value);
                return normalized || "not_requested";
            },
            resolvePaidAmount(order) {
                const safeOrder = order && typeof order === "object" ? order : {};
                return normalizeCurrencyAmount(safeOrder.paymentAmount, safeOrder.total);
            },
            resolvePaidAmountInMinorUnits(order) {
                const safeOrder = order && typeof order === "object" ? order : {};
                return normalizeAmountInMinorUnits(safeOrder.paymentAmountInMinorUnits, amountToMinorUnits(this.resolvePaidAmount(safeOrder)));
            },
            createRefundCaseRecord(values, recordOptions) {
                const safeValues = values && typeof values === "object" ? values : {};
                const safeOrder = recordOptions && recordOptions.order ? recordOptions.order : {};
                const paidAmount = this.resolvePaidAmount(safeOrder);
                const type = this.normalizeRefundType(safeValues.type);
                const amount = type === "full"
                    ? paidAmount
                    : normalizeCurrencyAmount(safeValues.amount, safeValues.refundAmount);

                return {
                    ...safeValues,
                    orderId: normalizeText(safeValues.orderId || safeOrder.orderId),
                    customerUid: normalizeText(safeValues.customerUid || safeOrder.customerUid),
                    vendorUid: normalizeText(safeValues.vendorUid || safeOrder.vendorUid),
                    status: this.normalizeRefundCaseStatus(safeValues.status),
                    type,
                    amount,
                    amountInMinorUnits: normalizeAmountInMinorUnits(safeValues.amountInMinorUnits, amountToMinorUnits(amount)),
                    reason: normalizeText(safeValues.reason || safeValues.refundReason),
                    customerDecision: this.normalizeDecision(safeValues.customerDecision),
                    vendorDecision: this.normalizeDecision(safeValues.vendorDecision)
                };
            },
            isTerminalRefundCaseStatus(status) {
                return ["refunded", "declined", "cancelled"].indexOf(this.normalizeRefundCaseStatus(status)) >= 0;
            },
            isRefundCaseApproved(refundCase) {
                return this.normalizeDecision(refundCase && refundCase.customerDecision) === "approved" &&
                    this.normalizeDecision(refundCase && refundCase.vendorDecision) === "approved";
            },
            isRefundCaseExecutable(refundCase) {
                const status = this.normalizeRefundCaseStatus(refundCase && refundCase.status);
                return this.isRefundCaseApproved(refundCase) &&
                    status !== "processing" &&
                    status !== "refunded" &&
                    status !== "cancelled" &&
                    status !== "declined";
            },
            calculateRefundFinancialImpact(order, refundCase) {
                const amount = normalizeCurrencyAmount(refundCase && refundCase.amount);
                return {
                    refundAmount: amount,
                    refundAmountInMinorUnits: amountToMinorUnits(amount),
                    vendorDeduction: 0,
                    platformDeduction: 0
                };
            }
        };
    }

    function normalizeOrderForRefund(orderOrPayment) {
        const safeOrder = orderOrPayment && typeof orderOrPayment === "object" ? orderOrPayment : {};

        return {
            orderId: normalizeText(safeOrder.orderId || safeOrder.id || safeOrder.paymentOrderId),
            checkoutId: normalizeText(safeOrder.checkoutId || safeOrder.sessionId),
            customerUid: normalizeText(safeOrder.customerUid || safeOrder.userUid),
            vendorUid: normalizeText(safeOrder.vendorUid),
            paymentStatus: normalizeLowerText(safeOrder.paymentStatus || safeOrder.status || safeOrder.paymentState),
            orderStatus: normalizeLowerText(safeOrder.orderStatus || safeOrder.status),
            paymentReference: normalizeText(
                safeOrder.paymentReference ||
                safeOrder.reference ||
                safeOrder.paystackReference ||
                safeOrder.transactionReference
            ),
            paymentAmount: normalizeCurrencyAmount(
                safeOrder.paymentAmount !== undefined
                    ? safeOrder.paymentAmount
                    : safeOrder.amount !== undefined
                        ? safeOrder.amount
                        : safeOrder.total !== undefined
                            ? safeOrder.total
                            : safeOrder.totalAmount
            ),
            paymentAmountInMinorUnits: normalizeAmountInMinorUnits(
                safeOrder.paymentAmountInMinorUnits !== undefined
                    ? safeOrder.paymentAmountInMinorUnits
                    : safeOrder.amountInMinorUnits,
                amountToMinorUnits(
                    safeOrder.paymentAmount !== undefined
                        ? safeOrder.paymentAmount
                        : safeOrder.amount !== undefined
                            ? safeOrder.amount
                            : safeOrder.total !== undefined
                                ? safeOrder.total
                                : safeOrder.totalAmount
                )
            ),
            raw: safeOrder
        };
    }

    function isPaidOrder(orderOrPayment) {
        const order = normalizeOrderForRefund(orderOrPayment);
        const paidStatuses = ["paid", "success", "successful", "complete", "completed", "verified"];

        return paidStatuses.indexOf(order.paymentStatus) >= 0 ||
            (
                order.paymentStatus === "" &&
                order.orderStatus === "completed" &&
                order.paymentAmount > 0
            );
    }

    function validateRefundActor(actor, options = {}) {
        const safeActor = actor && typeof actor === "object" ? actor : {};
        const model = getRefundCaseModelOrFallback(options);
        const value = {
            actorUid: normalizeText(safeActor.actorUid || safeActor.uid || safeActor.userUid),
            actorRole: model.normalizeActorRole(safeActor.actorRole || safeActor.role),
            actorName: normalizeText(safeActor.actorName || safeActor.displayName || safeActor.fullName || safeActor.name)
        };
        const errors = {};

        if (!value.actorUid) {
            setError(errors, "actorUid", "Actor UID is required.");
        }

        if (
            value.actorRole !== model.DECISION_ACTOR_ROLES.CUSTOMER &&
            value.actorRole !== model.DECISION_ACTOR_ROLES.VENDOR &&
            value.actorRole !== model.DECISION_ACTOR_ROLES.ADMIN
        ) {
            setError(errors, "actorRole", "Actor role must be customer, vendor, or admin.");
        }

        return createValidationResult(errors, { value });
    }

    function validateLinkedOrder(orderOrPayment, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const value = normalizeOrderForRefund(orderOrPayment);
        const errors = {};

        if (!value.orderId && safeOptions.requireOrderId !== false) {
            setError(errors, "orderId", "A linked order is required before a refund can be handled.");
        }

        if (!value.customerUid) {
            setError(errors, "customerUid", "The linked order must include the customer UID.");
        }

        if (!value.vendorUid) {
            setError(errors, "vendorUid", "The linked order must include the vendor UID.");
        }

        if (value.paymentAmount <= 0 || value.paymentAmountInMinorUnits <= 0) {
            setError(errors, "paymentAmount", "The linked order must include a positive paid amount.");
        }

        if (safeOptions.requirePaid !== false && !isPaidOrder(orderOrPayment)) {
            setError(errors, "paymentStatus", "Only paid orders can be refunded.");
        }

        if (safeOptions.requirePaymentReference === true && !value.paymentReference) {
            setError(errors, "paymentReference", "Payment reference is required before executing a refund.");
        }

        return createValidationResult(errors, { value });
    }

    function validateReason(value, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const reason = normalizeText(value);
        const minLength = Number.isFinite(Number(safeOptions.reasonMinLength))
            ? Number(safeOptions.reasonMinLength)
            : DEFAULT_REASON_MIN_LENGTH;
        const maxLength = Number.isFinite(Number(safeOptions.reasonMaxLength))
            ? Number(safeOptions.reasonMaxLength)
            : DEFAULT_REASON_MAX_LENGTH;
        const errors = {};

        if (!reason) {
            setError(errors, "reason", "Refund reason is required.");
        } else if (reason.length < minLength) {
            setError(errors, "reason", `Refund reason must be at least ${minLength} characters.`);
        } else if (reason.length > maxLength) {
            setError(errors, "reason", `Refund reason must be at most ${maxLength} characters.`);
        }

        return createValidationResult(errors, { value: reason });
    }

    function validateNote(value, key = "note", options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const note = normalizeText(value);
        const maxLength = Number.isFinite(Number(safeOptions.noteMaxLength))
            ? Number(safeOptions.noteMaxLength)
            : DEFAULT_NOTE_MAX_LENGTH;
        const errors = {};

        if (note.length > maxLength) {
            setError(errors, key, `Note must be at most ${maxLength} characters.`);
        }

        return createValidationResult(errors, { value: note });
    }

    function validateRefundAmount(refundValues = {}, orderOrPayment = {}, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const model = getRefundCaseModelOrFallback(safeOptions);
        const orderValidation = validateLinkedOrder(orderOrPayment, {
            ...safeOptions,
            requirePaid: safeOptions.requirePaid !== false,
            requirePaymentReference: false
        });
        const order = orderValidation.value;
        const refundCase = model.createRefundCaseRecord(refundValues, {
            ...safeOptions,
            order: order.raw
        });
        const errors = {};
        const paidAmount = model.resolvePaidAmount
            ? model.resolvePaidAmount(order.raw)
            : order.paymentAmount;
        const paidAmountInMinorUnits = model.resolvePaidAmountInMinorUnits
            ? model.resolvePaidAmountInMinorUnits(order.raw)
            : order.paymentAmountInMinorUnits;
        const type = model.normalizeRefundType(refundCase.type);
        const amount = normalizeCurrencyAmount(refundCase.amount);
        const amountInMinorUnits = normalizeAmountInMinorUnits(refundCase.amountInMinorUnits);

        mergeErrors(errors, orderValidation.errors, "order");

        if (type !== model.REFUND_TYPES.PARTIAL && type !== model.REFUND_TYPES.FULL) {
            setError(errors, "type", "Refund type must be partial or full.");
        }

        if (amount <= 0 || amountInMinorUnits <= 0) {
            setError(errors, "amount", "Refund amount must be greater than zero.");
        }

        if (paidAmount > 0 && amount > paidAmount) {
            setError(errors, "amount", "Refund amount cannot be greater than the paid amount.");
        }

        if (paidAmountInMinorUnits > 0 && amountInMinorUnits > paidAmountInMinorUnits) {
            setError(errors, "amountInMinorUnits", "Refund amount cannot be greater than the paid amount.");
        }

        if (
            type === model.REFUND_TYPES.FULL &&
            paidAmount > 0 &&
            amount !== paidAmount
        ) {
            setError(errors, "amount", "A full refund must equal the paid amount.");
        }

        if (
            type === model.REFUND_TYPES.PARTIAL &&
            safeOptions.allowPartialEqualFull !== true &&
            paidAmount > 0 &&
            amount >= paidAmount
        ) {
            setError(errors, "amount", "A partial refund must be less than the paid amount. Use a full refund instead.");
        }

        return createValidationResult(errors, {
            value: {
                type,
                amount,
                amountInMinorUnits,
                paidAmount,
                paidAmountInMinorUnits,
                order
            },
            refundCase
        });
    }

    function validateRefundCaseRecord(refundCaseValues = {}, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const model = getRefundCaseModelOrFallback(safeOptions);
        const order = safeOptions.order || safeOptions.payment || {};
        const value = model.createRefundCaseRecord(refundCaseValues, {
            ...safeOptions,
            order
        });
        const errors = {};
        const amountValidation = validateRefundAmount(value, order, {
            ...safeOptions,
            requirePaid: safeOptions.requirePaid !== false
        });
        const reasonValidation = validateReason(value.reason, safeOptions);
        const customerNoteValidation = validateNote(value.customerNote, "customerNote", safeOptions);
        const vendorNoteValidation = validateNote(value.vendorNote, "vendorNote", safeOptions);
        const adminNoteValidation = validateNote(value.adminNote, "adminNote", safeOptions);

        mergeErrors(errors, amountValidation.errors);
        mergeErrors(errors, reasonValidation.errors);
        mergeErrors(errors, customerNoteValidation.errors);
        mergeErrors(errors, vendorNoteValidation.errors);
        mergeErrors(errors, adminNoteValidation.errors);

        if (!value.customerUid) {
            setError(errors, "customerUid", "Customer UID is required for a refund case.");
        }

        if (!value.vendorUid) {
            setError(errors, "vendorUid", "Vendor UID is required for a refund case.");
        }

        if (!value.orderId && safeOptions.requireOrderId !== false) {
            setError(errors, "orderId", "Order ID is required for a refund case.");
        }

        return createValidationResult(errors, {
            value,
            amountValidation
        });
    }

    function validateRefundProposalInput(proposalValues = {}, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const model = getRefundCaseModelOrFallback(safeOptions);
        const safeValues = proposalValues && typeof proposalValues === "object" ? proposalValues : {};
        const actorValidation = validateRefundActor(safeOptions.actor || safeValues.actor || {
            actorUid: safeValues.proposedByUid || safeOptions.actorUid,
            actorRole: safeValues.actorRole || safeOptions.actorRole,
            actorName: safeValues.proposedByName || safeOptions.actorName
        }, safeOptions);
        const orderValidation = validateLinkedOrder(
            safeOptions.order || safeValues.order || safeOptions.payment || safeValues.payment,
            safeOptions
        );
        const refundCase = model.createRefundCaseRecord({
            ...safeValues,
            status: model.REFUND_CASE_STATUSES.PROPOSED,
            proposedByUid: actorValidation.value.actorUid,
            proposedByName: actorValidation.value.actorName
        }, {
            ...safeOptions,
            order: orderValidation.value.raw
        });
        const amountValidation = validateRefundAmount(refundCase, orderValidation.value.raw, safeOptions);
        const reasonValidation = validateReason(refundCase.reason, safeOptions);
        const errors = {};

        mergeErrors(errors, actorValidation.errors);
        mergeErrors(errors, orderValidation.errors, "order");
        mergeErrors(errors, amountValidation.errors);
        mergeErrors(errors, reasonValidation.errors);

        if (actorValidation.value.actorRole !== model.DECISION_ACTOR_ROLES.ADMIN) {
            setError(errors, "actorRole", "Only an admin can propose a refund.");
        }

        if (model.isTerminalRefundCaseStatus(safeValues.status)) {
            setError(errors, "status", "A terminal refund case cannot be proposed again.");
        }

        return createValidationResult(errors, {
            value: refundCase,
            actor: actorValidation.value,
            order: orderValidation.value,
            amountValidation
        });
    }

    function getLinkedActorUidForRole(refundCase, actorRole) {
        const safeCase = refundCase && typeof refundCase === "object" ? refundCase : {};

        if (actorRole === "customer") {
            return normalizeText(safeCase.customerUid);
        }

        if (actorRole === "vendor") {
            return normalizeText(safeCase.vendorUid);
        }

        return "";
    }

    function validateRefundDecisionInput(refundCaseValues = {}, decisionValues = {}, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const model = getRefundCaseModelOrFallback(safeOptions);
        const safeCaseValues = refundCaseValues && typeof refundCaseValues === "object" ? refundCaseValues : {};
        const safeDecision = decisionValues && typeof decisionValues === "object" ? decisionValues : {};
        const currentCase = model.createRefundCaseRecord(refundCaseValues, safeOptions);
        const explicitCurrentStatus = safeCaseValues.status !== undefined
            ? model.normalizeRefundCaseStatus(safeCaseValues.status)
            : currentCase.status;
        const actorValidation = validateRefundActor(safeOptions.actor || safeDecision.actor || {
            actorUid: safeDecision.actorUid || safeOptions.actorUid,
            actorRole: safeDecision.actorRole || safeOptions.actorRole,
            actorName: safeDecision.actorName || safeOptions.actorName
        }, safeOptions);
        const decision = model.normalizeDecision(safeDecision.decision || safeDecision.status || safeOptions.decision);
        const noteValidation = validateNote(safeDecision.note || safeOptions.note, "note", safeOptions);
        const errors = {};

        mergeErrors(errors, actorValidation.errors);
        mergeErrors(errors, noteValidation.errors);

        if (
            actorValidation.value.actorRole !== model.DECISION_ACTOR_ROLES.CUSTOMER &&
            actorValidation.value.actorRole !== model.DECISION_ACTOR_ROLES.VENDOR
        ) {
            setError(errors, "actorRole", "Only the linked customer or vendor can approve or decline a refund.");
        }

        if (decision !== model.DECISIONS.APPROVED && decision !== model.DECISIONS.DECLINED) {
            setError(errors, "decision", "Refund decision must be approved or declined.");
        }

        if (model.isTerminalRefundCaseStatus(explicitCurrentStatus)) {
            setError(errors, "status", "A terminal refund case cannot receive more decisions.");
        }

        if (explicitCurrentStatus === model.REFUND_CASE_STATUSES.PROCESSING) {
            setError(errors, "status", "A refund that is already processing cannot receive more decisions.");
        }

        if (explicitCurrentStatus === model.REFUND_CASE_STATUSES.NOT_REQUESTED) {
            setError(errors, "status", "A refund must be proposed before parties can decide.");
        }

        const linkedUid = getLinkedActorUidForRole(currentCase, actorValidation.value.actorRole);

        if (
            safeOptions.allowMismatchedActor !== true &&
            linkedUid &&
            actorValidation.value.actorUid &&
            actorValidation.value.actorUid !== linkedUid
        ) {
            setError(errors, "actorUid", "Only the linked party can make this refund decision.");
        }

        return createValidationResult(errors, {
            value: {
                ...safeDecision,
                decision,
                actorRole: actorValidation.value.actorRole,
                actorUid: actorValidation.value.actorUid,
                actorName: actorValidation.value.actorName
            },
            refundCase: currentCase,
            actor: actorValidation.value
        });
    }

    function validateRefundExecutionInput(refundCaseValues = {}, orderOrPayment = {}, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const model = getRefundCaseModelOrFallback(safeOptions);
        const currentCase = model.createRefundCaseRecord(refundCaseValues, {
            ...safeOptions,
            order: orderOrPayment
        });
        const actorValidation = validateRefundActor(safeOptions.actor || {
            actorUid: safeOptions.actorUid,
            actorRole: safeOptions.actorRole,
            actorName: safeOptions.actorName
        }, safeOptions);
        const orderValidation = validateLinkedOrder(orderOrPayment, {
            ...safeOptions,
            requirePaymentReference: true
        });
        const amountValidation = validateRefundAmount(currentCase, orderValidation.value.raw, safeOptions);
        const errors = {};

        mergeErrors(errors, actorValidation.errors);
        mergeErrors(errors, orderValidation.errors, "order");
        mergeErrors(errors, amountValidation.errors);

        if (actorValidation.value.actorRole !== model.DECISION_ACTOR_ROLES.ADMIN) {
            setError(errors, "actorRole", "Only an admin can execute an approved refund.");
        }

        if (!model.isRefundCaseApproved(currentCase)) {
            setError(errors, "approval", "Both customer and vendor must approve before a refund can be executed.");
        }

        if (!model.isRefundCaseExecutable(currentCase)) {
            setError(errors, "status", "This refund case is not ready to execute.");
        }

        if (
            currentCase.orderId &&
            orderValidation.value.orderId &&
            currentCase.orderId !== orderValidation.value.orderId
        ) {
            setError(errors, "orderId", "Refund case order does not match the linked payment order.");
        }

        const impact = model.calculateRefundFinancialImpact(orderValidation.value.raw, currentCase);

        return createValidationResult(errors, {
            value: {
                refundCase: currentCase,
                order: orderValidation.value,
                actor: actorValidation.value,
                impact
            },
            refundCase: currentCase,
            order: orderValidation.value,
            actor: actorValidation.value,
            amountValidation,
            impact
        });
    }

    function validateRefundStatusTransition(currentRefundCase = {}, nextStatus, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const model = getRefundCaseModelOrFallback(safeOptions);
        const safeCurrent = currentRefundCase && typeof currentRefundCase === "object" ? currentRefundCase : {};
        const currentCase = model.createRefundCaseRecord(safeCurrent, safeOptions);
        const currentStatus = model.normalizeRefundCaseStatus(safeCurrent.status || currentCase.status);
        const normalizedNextStatus = model.normalizeRefundCaseStatus(nextStatus);
        const errors = {};
        const allowedTransitions = {
            not_requested: ["proposed", "cancelled"],
            proposed: ["customer_approved", "vendor_approved", "approved", "declined", "cancelled"],
            customer_approved: ["approved", "declined", "cancelled"],
            vendor_approved: ["approved", "declined", "cancelled"],
            approved: ["processing", "refunded", "failed", "cancelled"],
            processing: ["refunded", "failed"],
            failed: ["processing", "refunded", "cancelled"],
            refunded: [],
            declined: [],
            cancelled: []
        };
        const allowed = allowedTransitions[currentStatus] || [];

        if (currentStatus === normalizedNextStatus) {
            setError(errors, "status", "Refund case is already in that status.");
        } else if (allowed.indexOf(normalizedNextStatus) === -1) {
            setError(errors, "status", `Refund case cannot move from ${currentStatus} to ${normalizedNextStatus}.`);
        }

        return createValidationResult(errors, {
            currentStatus,
            nextStatus: normalizedNextStatus,
            allowedNextStatuses: allowed.slice()
        });
    }

    const refundCaseValidation = {
        MODULE_NAME,
        DEFAULT_REASON_MIN_LENGTH,
        DEFAULT_REASON_MAX_LENGTH,
        DEFAULT_NOTE_MAX_LENGTH,
        resolveRefundCaseModel,
        normalizeText,
        normalizeLowerText,
        normalizeCurrencyAmount,
        normalizeAmountInMinorUnits,
        amountToMinorUnits,
        createValidationResult,
        setError,
        mergeErrors,
        getRefundCaseModelOrFallback,
        normalizeOrderForRefund,
        isPaidOrder,
        validateRefundActor,
        validateLinkedOrder,
        validateReason,
        validateNote,
        validateRefundAmount,
        validateRefundCaseRecord,
        validateRefundProposalInput,
        validateRefundDecisionInput,
        validateRefundExecutionInput,
        validateRefundStatusTransition
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = refundCaseValidation;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.refundCaseValidation = refundCaseValidation;
    }
})(typeof window !== "undefined" ? window : globalThis);
