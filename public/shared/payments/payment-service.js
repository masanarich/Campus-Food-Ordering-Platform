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

    function createPaymentRecordFromOrder(order, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const dependencies = getPaymentDependencies(safeOptions);

        if (!dependencies.paymentModel || !dependencies.paymentStatus) {
            return createPaymentFailure(
                "payments/dependencies-missing",
                "Payment model and status helpers are required before creating a payment record."
            );
        }

        const paymentRecord = dependencies.paymentModel.createPaymentRecordFromOrder(order, {
            ...safeOptions,
            paymentStatus: dependencies.paymentStatus,
            status: safeOptions.status || dependencies.paymentStatus.PAYMENT_STATUSES.PENDING,
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
        const payload = {
            email: validation.value.customerEmail,
            amount: validation.value.amountInMinorUnits,
            currency: validation.value.currency,
            reference: validation.value.reference || undefined,
            callback_url: callbackUrl || undefined,
            metadata: {
                ...validation.value.metadata,
                orderId: validation.value.orderId,
                customerUid: validation.value.customerUid,
                vendorUid: validation.value.vendorUid,
                provider: validation.value.provider
            }
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
