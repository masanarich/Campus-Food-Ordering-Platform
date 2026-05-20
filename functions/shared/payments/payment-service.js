(function attachPaymentService(globalScope) {
    "use strict";

    const MODULE_NAME = "payment-service";

    function resolvePaymentStatus(explicitPaymentStatus) {
        if (
            explicitPaymentStatus &&
            typeof explicitPaymentStatus.normalizePaymentStatus === "function" &&
            typeof explicitPaymentStatus.validatePaymentStatusTransition === "function"
        ) {
            return explicitPaymentStatus;
        }

        if (explicitPaymentStatus !== undefined && explicitPaymentStatus !== null) {
            return null;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.paymentStatus &&
            typeof globalScope.paymentStatus.normalizePaymentStatus === "function" &&
            typeof globalScope.paymentStatus.validatePaymentStatusTransition === "function"
        ) {
            return globalScope.paymentStatus;
        }

        if (typeof require === "function") {
            try {
                const requiredPaymentStatus = require("./payment-status.js");

                if (
                    requiredPaymentStatus &&
                    typeof requiredPaymentStatus.normalizePaymentStatus === "function" &&
                    typeof requiredPaymentStatus.validatePaymentStatusTransition === "function"
                ) {
                    return requiredPaymentStatus;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolvePaymentModel(explicitPaymentModel) {
        if (
            explicitPaymentModel &&
            typeof explicitPaymentModel.createPaymentRecord === "function" &&
            typeof explicitPaymentModel.createPaymentRecordFromOrder === "function" &&
            typeof explicitPaymentModel.createPaymentPatch === "function"
        ) {
            return explicitPaymentModel;
        }

        if (explicitPaymentModel !== undefined && explicitPaymentModel !== null) {
            return null;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.paymentModel &&
            typeof globalScope.paymentModel.createPaymentRecord === "function" &&
            typeof globalScope.paymentModel.createPaymentRecordFromOrder === "function" &&
            typeof globalScope.paymentModel.createPaymentPatch === "function"
        ) {
            return globalScope.paymentModel;
        }

        if (typeof require === "function") {
            try {
                const requiredPaymentModel = require("./payment-model.js");

                if (
                    requiredPaymentModel &&
                    typeof requiredPaymentModel.createPaymentRecord === "function" &&
                    typeof requiredPaymentModel.createPaymentRecordFromOrder === "function" &&
                    typeof requiredPaymentModel.createPaymentPatch === "function"
                ) {
                    return requiredPaymentModel;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolvePaymentValidation(explicitPaymentValidation) {
        if (
            explicitPaymentValidation &&
            typeof explicitPaymentValidation.validateInitializePaymentInput === "function" &&
            typeof explicitPaymentValidation.validateVerifiedPayment === "function"
        ) {
            return explicitPaymentValidation;
        }

        if (explicitPaymentValidation !== undefined && explicitPaymentValidation !== null) {
            return null;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.paymentValidation &&
            typeof globalScope.paymentValidation.validateInitializePaymentInput === "function" &&
            typeof globalScope.paymentValidation.validateVerifiedPayment === "function"
        ) {
            return globalScope.paymentValidation;
        }

        if (typeof require === "function") {
            try {
                const requiredPaymentValidation = require("./payment-validation.js");

                if (
                    requiredPaymentValidation &&
                    typeof requiredPaymentValidation.validateInitializePaymentInput === "function" &&
                    typeof requiredPaymentValidation.validateVerifiedPayment === "function"
                ) {
                    return requiredPaymentValidation;
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
            code: normalizeText(code) || "payments/error",
            message: normalizeText(message) || "Something went wrong while handling the payment request.",
            ...safeDetails
        };
    }

    function createPaymentResult(success, details = {}) {
        const safeDetails = details && typeof details === "object" ? details : {};

        return {
            success: success === true,
            provider: safeDetails.provider || "paystack",
            ...safeDetails
        };
    }

    function createPaymentFailure(code, message, details = {}) {
        const safeDetails = details && typeof details === "object" ? details : {};

        return createPaymentResult(false, {
            ...safeDetails,
            error: createServiceError(code, message, safeDetails.errorDetails)
        });
    }

    function resolveTimestampValue(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        if (safeOptions.timestampValue !== undefined) {
            return safeOptions.timestampValue;
        }

        if (
            safeOptions.firestoreFns &&
            typeof safeOptions.firestoreFns.serverTimestamp === "function"
        ) {
            return safeOptions.firestoreFns.serverTimestamp();
        }

        return null;
    }

    function getPaymentDependencies(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        return {
            paymentStatus: resolvePaymentStatus(safeOptions.paymentStatus),
            paymentModel: resolvePaymentModel(safeOptions.paymentModel),
            paymentValidation: resolvePaymentValidation(safeOptions.paymentValidation)
        };
    }

    function createFallbackPaymentRecord(paymentValues = {}, options = {}) {
        const safeValues = paymentValues && typeof paymentValues === "object" ? paymentValues : {};
        const paymentStatus = resolvePaymentStatus(options.paymentStatus);
        const fallbackStatus = paymentStatus && typeof paymentStatus.getDefaultPaymentStatus === "function"
            ? paymentStatus.getDefaultPaymentStatus()
            : "unpaid";
        const statusValue = safeValues.status || safeValues.paymentStatus;
        const normalizedStatus = paymentStatus && typeof paymentStatus.normalizePaymentStatus === "function"
            ? paymentStatus.normalizePaymentStatus(statusValue, fallbackStatus)
            : normalizeLowerText(statusValue) || fallbackStatus;

        return {
            paymentId: normalizeText(safeValues.paymentId || safeValues.id),
            orderId: normalizeText(safeValues.orderId),
            checkoutId: normalizeText(safeValues.checkoutId || safeValues.sessionId),
            customerUid: normalizeText(safeValues.customerUid || safeValues.userUid),
            customerEmail: normalizeLowerText(safeValues.customerEmail || safeValues.email),
            vendorUid: normalizeText(safeValues.vendorUid),
            provider: normalizeLowerText(safeValues.provider || safeValues.paymentProvider) || "paystack",
            status: normalizedStatus || fallbackStatus,
            reference: normalizeText(
                safeValues.reference ||
                safeValues.paymentReference ||
                safeValues.paystackReference
            ),
            accessCode: normalizeText(safeValues.accessCode || safeValues.paymentAccessCode),
            authorizationUrl: normalizeText(
                safeValues.authorizationUrl ||
                safeValues.authorizationURL ||
                safeValues.paymentAuthorizationUrl ||
                safeValues.paymentUrl ||
                safeValues.paymentURL
            ),
            amount: Number(safeValues.amount || safeValues.paymentAmount || 0),
            amountInMinorUnits: Number.parseInt(
                safeValues.amountInMinorUnits ||
                safeValues.paymentAmountInMinorUnits ||
                0,
                10
            ),
            currency: normalizeText(safeValues.currency || safeValues.paymentCurrency || "ZAR").toUpperCase(),
            metadata: safeValues.metadata && typeof safeValues.metadata === "object"
                ? { ...safeValues.metadata }
                : {},
            paidAt: safeValues.paidAt || safeValues.paymentPaidAt || null,
            failedAt: safeValues.failedAt || safeValues.paymentFailedAt || null,
            verifiedAt: safeValues.verifiedAt || safeValues.paymentVerifiedAt || null,
            failureReason: normalizeText(safeValues.failureReason || safeValues.paymentFailureReason)
        };
    }

    function normalizePaymentForService(paymentValues = {}, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const dependencies = getPaymentDependencies(safeOptions);
        const safeValues = paymentValues && typeof paymentValues === "object" ? paymentValues : {};
        const payment = dependencies.paymentModel
            ? dependencies.paymentModel.createPaymentRecord(safeValues, {
                paymentStatus: dependencies.paymentStatus
            })
            : createFallbackPaymentRecord(safeValues, {
                paymentStatus: dependencies.paymentStatus
            });
        const checkoutId = normalizeText(
            payment.checkoutId ||
            safeValues.checkoutId ||
            safeValues.sessionId ||
            (payment.metadata && payment.metadata.checkoutId)
        );

        return {
            ...payment,
            checkoutId,
            reference: normalizeText(payment.reference || safeValues.paymentReference),
            accessCode: normalizeText(payment.accessCode || safeValues.paymentAccessCode),
            authorizationUrl: normalizeText(
                payment.authorizationUrl ||
                safeValues.paymentAuthorizationUrl ||
                safeValues.authorizationUrl ||
                safeValues.authorizationURL ||
                safeValues.paymentUrl ||
                safeValues.paymentURL
            ),
            metadata: {
                ...(payment.metadata && typeof payment.metadata === "object"
                    ? payment.metadata
                    : {}),
                ...(checkoutId ? { checkoutId } : {})
            }
        };
    }

    function getPaymentLifecycle(paymentValues = {}, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const dependencies = getPaymentDependencies(safeOptions);
        const statusHelpers = dependencies.paymentStatus;
        const payment = normalizePaymentForService(paymentValues, safeOptions);
        const fallbackStatus = statusHelpers && typeof statusHelpers.getDefaultPaymentStatus === "function"
            ? statusHelpers.getDefaultPaymentStatus()
            : "unpaid";
        const status = statusHelpers && typeof statusHelpers.normalizePaymentStatus === "function"
            ? statusHelpers.normalizePaymentStatus(payment.status, fallbackStatus)
            : normalizeLowerText(payment.status) || fallbackStatus;
        const isPaid = statusHelpers && typeof statusHelpers.isPaymentPaid === "function"
            ? statusHelpers.isPaymentPaid(status)
            : status === "paid";
        const isPending = statusHelpers && typeof statusHelpers.isPaymentPending === "function"
            ? statusHelpers.isPaymentPending(status)
            : status === "pending";
        const isFailed = statusHelpers && typeof statusHelpers.isPaymentFailed === "function"
            ? statusHelpers.isPaymentFailed(status)
            : status === "failed";
        const isUnpaid = statusHelpers && typeof statusHelpers.isPaymentUnpaid === "function"
            ? statusHelpers.isPaymentUnpaid(status)
            : status === "unpaid";
        const isOrderBlocking = statusHelpers && typeof statusHelpers.isPaymentBlockingOrder === "function"
            ? statusHelpers.isPaymentBlockingOrder(status)
            : !isPaid;
        const isRefundable = statusHelpers && typeof statusHelpers.isPaymentRefundable === "function"
            ? statusHelpers.isPaymentRefundable(status)
            : isPaid;
        const isRetryable = statusHelpers && typeof statusHelpers.isPaymentRetryable === "function"
            ? statusHelpers.isPaymentRetryable(status)
            : isUnpaid || isFailed;
        const isAwaitingCustomerAction =
            statusHelpers && typeof statusHelpers.isPaymentAwaitingCustomerAction === "function"
                ? statusHelpers.isPaymentAwaitingCustomerAction(status)
                : isUnpaid || isFailed;
        const statusLabel = statusHelpers && typeof statusHelpers.getPaymentStatusLabel === "function"
            ? statusHelpers.getPaymentStatusLabel(status)
            : status;

        return {
            payment: {
                ...payment,
                status
            },
            status,
            statusLabel,
            reference: payment.reference,
            authorizationUrl: payment.authorizationUrl,
            checkoutId: payment.checkoutId,
            isPaid,
            isPending,
            isFailed,
            isUnpaid,
            isRetryable,
            isAwaitingCustomerAction,
            isOrderBlocking,
            isRefundable,
            canResume: !isPaid && (
                (isPending && Boolean(payment.authorizationUrl)) ||
                isAwaitingCustomerAction
            ),
            resumeAction: isPending && payment.authorizationUrl
                ? "redirect"
                : isAwaitingCustomerAction
                    ? "initialize"
                    : "",
            requiresVerification: isPending,
            requiresRefund: isRefundable && safeOptions.refundRequired === true
        };
    }

    function buildResumePaymentPlan(paymentValues = {}, options = {}) {
        const lifecycle = getPaymentLifecycle(paymentValues, options);

        if (lifecycle.isPaid) {
            return createPaymentFailure(
                "payments/already-paid",
                "This payment has already been completed.",
                { payment: lifecycle.payment, lifecycle }
            );
        }

        if (lifecycle.isPending && lifecycle.authorizationUrl) {
            return createPaymentResult(true, {
                payment: lifecycle.payment,
                lifecycle,
                action: "redirect",
                authorizationUrl: lifecycle.authorizationUrl,
                reference: lifecycle.reference,
                message: "Resume the existing payment authorization."
            });
        }

        if (lifecycle.isPending) {
            return createPaymentFailure(
                "payments/resume-url-missing",
                "Pending payment cannot be resumed without an authorization URL.",
                { payment: lifecycle.payment, lifecycle }
            );
        }

        if (lifecycle.isAwaitingCustomerAction || lifecycle.isRetryable) {
            return createPaymentResult(true, {
                payment: lifecycle.payment,
                lifecycle,
                action: "initialize",
                authorizationUrl: "",
                reference: lifecycle.reference,
                message: "Start a new payment attempt."
            });
        }

        return createPaymentFailure(
            "payments/resume-not-allowed",
            "This payment cannot be resumed.",
            { payment: lifecycle.payment, lifecycle }
        );
    }

    function buildOrderPaymentGuard(paymentValues = {}, options = {}) {
        const lifecycle = getPaymentLifecycle(paymentValues, options);

        if (!lifecycle.isOrderBlocking) {
            return {
                blocked: false,
                payment: lifecycle.payment,
                status: lifecycle.status,
                statusLabel: lifecycle.statusLabel,
                reason: ""
            };
        }

        return {
            blocked: true,
            payment: lifecycle.payment,
            status: lifecycle.status,
            statusLabel: lifecycle.statusLabel,
            reason: `Payment is ${lifecycle.statusLabel}. Do not fulfil this order until payment is completed.`
        };
    }

    function createPaymentRecordFromOrder(order, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeOrder = order && typeof order === "object" ? order : {};
        const dependencies = getPaymentDependencies(safeOptions);

        if (!dependencies.paymentModel || !dependencies.paymentStatus) {
            return createPaymentFailure(
                "payments/dependencies-missing",
                "Payment model and status helpers are required before creating a payment record."
            );
        }

        const checkoutId = normalizeText(safeOptions.checkoutId || safeOrder.checkoutId);
        const metadata = {
            ...(safeOptions.metadata && typeof safeOptions.metadata === "object"
                ? safeOptions.metadata
                : {})
        };

        if (checkoutId) {
            metadata.checkoutId = checkoutId;
        }

        const paymentRecord = dependencies.paymentModel.createPaymentRecordFromOrder(order, {
            ...safeOptions,
            paymentStatus: dependencies.paymentStatus,
            status: safeOptions.status || dependencies.paymentStatus.PAYMENT_STATUSES.PENDING,
            metadata,
            createdAt: safeOptions.createdAt !== undefined
                ? safeOptions.createdAt
                : resolveTimestampValue(safeOptions),
            updatedAt: safeOptions.updatedAt
        });

        return createPaymentResult(true, {
            payment: paymentRecord
        });
    }

    function prepareInitializePayment(order, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const dependencies = getPaymentDependencies(safeOptions);
        const paymentResult = createPaymentRecordFromOrder(order, safeOptions);

        if (!paymentResult.success) {
            return paymentResult;
        }

        if (!dependencies.paymentValidation) {
            return createPaymentFailure(
                "payments/dependencies-missing",
                "Payment validation helpers are required before initializing payment.",
                {
                    payment: paymentResult.payment
                }
            );
        }

        const validation = dependencies.paymentValidation.validateInitializePaymentInput(
            paymentResult.payment,
            {
                ...safeOptions,
                paymentStatus: dependencies.paymentStatus,
                paymentModel: dependencies.paymentModel
            }
        );

        if (!validation.isValid) {
            return createPaymentFailure(
                "payments/invalid-initialize-input",
                "Payment initialization details are invalid.",
                {
                    payment: validation.value,
                    validationErrors: validation.errors
                }
            );
        }

        const callbackUrl = normalizeText(safeOptions.callbackUrl || safeOptions.callbackURL);
        const checkoutId = normalizeText(
            validation.value.checkoutId ||
            (validation.value.metadata && validation.value.metadata.checkoutId) ||
            safeOptions.checkoutId ||
            (order && order.checkoutId)
        );
        const metadata = {
            ...validation.value.metadata,
            orderId: validation.value.orderId,
            customerUid: validation.value.customerUid,
            vendorUid: validation.value.vendorUid,
            provider: validation.value.provider
        };

        if (!normalizeText(metadata.checkoutId)) {
            delete metadata.checkoutId;
        }

        if (checkoutId) {
            metadata.checkoutId = checkoutId;
        }

        const payload = {
            email: validation.value.customerEmail,
            amount: validation.value.amountInMinorUnits,
            currency: validation.value.currency,
            reference: validation.value.reference || undefined,
            callback_url: callbackUrl || undefined,
            metadata
        };

        return createPaymentResult(true, {
            payment: validation.value,
            payload
        });
    }

    function applyInitializedPayment(paymentValues, initializeResponse = {}, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeResponse = initializeResponse && typeof initializeResponse === "object"
            ? initializeResponse
            : {};
        const dependencies = getPaymentDependencies(safeOptions);

        if (!dependencies.paymentModel || !dependencies.paymentStatus) {
            return createPaymentFailure(
                "payments/dependencies-missing",
                "Payment model and status helpers are required before applying initialized payment."
            );
        }

        const payment = dependencies.paymentModel.createPaymentRecord({
            ...paymentValues,
            status: dependencies.paymentStatus.PAYMENT_STATUSES.PENDING,
            reference: safeResponse.reference || paymentValues.reference,
            accessCode: safeResponse.accessCode || safeResponse.access_code || paymentValues.accessCode,
            authorizationUrl:
                safeResponse.authorizationUrl ||
                safeResponse.authorization_url ||
                paymentValues.authorizationUrl,
            updatedAt: safeOptions.updatedAt !== undefined
                ? safeOptions.updatedAt
                : resolveTimestampValue(safeOptions)
        }, {
            paymentStatus: dependencies.paymentStatus
        });
        const patch = dependencies.paymentModel.createPaymentPatch(payment);

        return createPaymentResult(true, {
            payment,
            patch
        });
    }

    function applyVerifiedPayment(paymentValues, verificationValues = {}, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeVerification = verificationValues && typeof verificationValues === "object"
            ? verificationValues
            : {};
        const dependencies = getPaymentDependencies(safeOptions);

        if (!dependencies.paymentModel || !dependencies.paymentStatus || !dependencies.paymentValidation) {
            return createPaymentFailure(
                "payments/dependencies-missing",
                "Payment model, status, and validation helpers are required before verifying payment."
            );
        }

        const currentPayment = dependencies.paymentModel.createPaymentRecord(paymentValues, {
            paymentStatus: dependencies.paymentStatus
        });
        const validation = dependencies.paymentValidation.validateVerifiedPayment(
            currentPayment,
            safeVerification,
            safeOptions
        );

        if (!validation.isValid) {
            const failedResult = applyFailedPayment(currentPayment, {
                reason: "Payment verification failed.",
                verification: safeVerification
            }, safeOptions);

            return createPaymentFailure(
                "payments/verification-mismatch",
                "Verified payment details do not match the expected payment.",
                {
                    payment: failedResult.payment,
                    patch: failedResult.patch,
                    validationErrors: validation.errors
                }
            );
        }

        const timestamp = safeOptions.verifiedAt !== undefined
            ? safeOptions.verifiedAt
            : resolveTimestampValue(safeOptions);
        const payment = dependencies.paymentModel.createPaymentRecord({
            ...currentPayment,
            status: dependencies.paymentStatus.PAYMENT_STATUSES.PAID,
            reference: validation.value.reference || currentPayment.reference,
            amountInMinorUnits: validation.value.amountInMinorUnits,
            currency: validation.value.currency,
            paidAt: safeOptions.paidAt !== undefined ? safeOptions.paidAt : timestamp,
            verifiedAt: timestamp,
            updatedAt: timestamp,
            failureReason: ""
        }, {
            paymentStatus: dependencies.paymentStatus
        });
        const patch = dependencies.paymentModel.createPaymentPatch(payment);

        return createPaymentResult(true, {
            payment,
            patch,
            verification: validation.value
        });
    }

    function applyFailedPayment(paymentValues, failureDetails = {}, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeFailure = failureDetails && typeof failureDetails === "object" ? failureDetails : {};
        const dependencies = getPaymentDependencies(safeOptions);

        if (!dependencies.paymentModel || !dependencies.paymentStatus) {
            return createPaymentFailure(
                "payments/dependencies-missing",
                "Payment model and status helpers are required before applying failed payment."
            );
        }

        const timestamp = safeOptions.failedAt !== undefined
            ? safeOptions.failedAt
            : resolveTimestampValue(safeOptions);
        const payment = dependencies.paymentModel.createPaymentRecord({
            ...paymentValues,
            status: dependencies.paymentStatus.PAYMENT_STATUSES.FAILED,
            failedAt: timestamp,
            updatedAt: timestamp,
            failureReason:
                safeFailure.reason ||
                safeFailure.message ||
                safeFailure.error ||
                "Payment could not be completed."
        }, {
            paymentStatus: dependencies.paymentStatus
        });
        const patch = dependencies.paymentModel.createPaymentPatch(payment);

        return createPaymentResult(true, {
            payment,
            patch,
            failure: safeFailure
        });
    }

    function buildOrderPaymentPatch(paymentValues, options = {}) {
        const dependencies = getPaymentDependencies(options);

        if (!dependencies.paymentModel) {
            return createPaymentFailure(
                "payments/dependencies-missing",
                "Payment model helpers are required before creating an order payment patch."
            );
        }

        const payment = dependencies.paymentModel.createPaymentRecord(paymentValues, {
            paymentStatus: dependencies.paymentStatus
        });

        return createPaymentResult(true, {
            payment,
            patch: dependencies.paymentModel.createPaymentPatch(payment)
        });
    }

    const paymentService = {
        MODULE_NAME,
        resolvePaymentStatus,
        resolvePaymentModel,
        resolvePaymentValidation,
        normalizeText,
        normalizeLowerText,
        createServiceError,
        createPaymentResult,
        createPaymentFailure,
        resolveTimestampValue,
        getPaymentDependencies,
        createFallbackPaymentRecord,
        normalizePaymentForService,
        getPaymentLifecycle,
        buildResumePaymentPlan,
        buildOrderPaymentGuard,
        createPaymentRecordFromOrder,
        prepareInitializePayment,
        applyInitializedPayment,
        applyVerifiedPayment,
        applyFailedPayment,
        buildOrderPaymentPatch
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = paymentService;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.paymentService = paymentService;
    }
})(typeof window !== "undefined" ? window : globalThis);
