(function attachCheckoutService(globalScope) {
    "use strict";

    const MODULE_NAME = "checkout-service";
    const CHECKOUTS_COLLECTION = "checkoutSessions";

    function resolveCheckoutStatus(explicitCheckoutStatus) {
        if (
            explicitCheckoutStatus &&
            typeof explicitCheckoutStatus.normalizeCheckoutStatus === "function" &&
            typeof explicitCheckoutStatus.normalizeCheckoutActorRole === "function"
        ) {
            return explicitCheckoutStatus;
        }

        if (explicitCheckoutStatus !== undefined && explicitCheckoutStatus !== null) {
            return null;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.checkoutStatus &&
            typeof globalScope.checkoutStatus.normalizeCheckoutStatus === "function" &&
            typeof globalScope.checkoutStatus.normalizeCheckoutActorRole === "function"
        ) {
            return globalScope.checkoutStatus;
        }

        if (typeof require === "function") {
            try {
                const requiredCheckoutStatus = require("./checkout-status.js");

                if (
                    requiredCheckoutStatus &&
                    typeof requiredCheckoutStatus.normalizeCheckoutStatus === "function" &&
                    typeof requiredCheckoutStatus.normalizeCheckoutActorRole === "function"
                ) {
                    return requiredCheckoutStatus;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveCheckoutModel(explicitCheckoutModel) {
        if (
            explicitCheckoutModel &&
            typeof explicitCheckoutModel.createCheckoutSessionRecord === "function" &&
            typeof explicitCheckoutModel.createCheckoutSessionFromCart === "function" &&
            typeof explicitCheckoutModel.createCheckoutTimelineEntry === "function"
        ) {
            return explicitCheckoutModel;
        }

        if (explicitCheckoutModel !== undefined && explicitCheckoutModel !== null) {
            return null;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.checkoutModel &&
            typeof globalScope.checkoutModel.createCheckoutSessionRecord === "function" &&
            typeof globalScope.checkoutModel.createCheckoutSessionFromCart === "function" &&
            typeof globalScope.checkoutModel.createCheckoutTimelineEntry === "function"
        ) {
            return globalScope.checkoutModel;
        }

        if (typeof require === "function") {
            try {
                const requiredCheckoutModel = require("./checkout-model.js");

                if (
                    requiredCheckoutModel &&
                    typeof requiredCheckoutModel.createCheckoutSessionRecord === "function" &&
                    typeof requiredCheckoutModel.createCheckoutSessionFromCart === "function" &&
                    typeof requiredCheckoutModel.createCheckoutTimelineEntry === "function"
                ) {
                    return requiredCheckoutModel;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveCheckoutValidation(explicitCheckoutValidation) {
        if (
            explicitCheckoutValidation &&
            typeof explicitCheckoutValidation.validateCreateCheckoutInput === "function" &&
            typeof explicitCheckoutValidation.validateCheckoutStatusChange === "function" &&
            typeof explicitCheckoutValidation.validatePaymentInitializationInput === "function"
        ) {
            return explicitCheckoutValidation;
        }

        if (explicitCheckoutValidation !== undefined && explicitCheckoutValidation !== null) {
            return null;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.checkoutValidation &&
            typeof globalScope.checkoutValidation.validateCreateCheckoutInput === "function" &&
            typeof globalScope.checkoutValidation.validateCheckoutStatusChange === "function" &&
            typeof globalScope.checkoutValidation.validatePaymentInitializationInput === "function"
        ) {
            return globalScope.checkoutValidation;
        }

        if (typeof require === "function") {
            try {
                const requiredCheckoutValidation = require("./checkout-validation.js");

                if (
                    requiredCheckoutValidation &&
                    typeof requiredCheckoutValidation.validateCreateCheckoutInput === "function" &&
                    typeof requiredCheckoutValidation.validateCheckoutStatusChange === "function" &&
                    typeof requiredCheckoutValidation.validatePaymentInitializationInput === "function"
                ) {
                    return requiredCheckoutValidation;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveCheckoutQueries(explicitCheckoutQueries) {
        if (
            explicitCheckoutQueries &&
            (
                typeof explicitCheckoutQueries.getCheckoutDocRef === "function" ||
                typeof explicitCheckoutQueries.fetchCheckoutById === "function"
            )
        ) {
            return explicitCheckoutQueries;
        }

        if (explicitCheckoutQueries !== undefined && explicitCheckoutQueries !== null) {
            return null;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.checkoutQueries &&
            (
                typeof globalScope.checkoutQueries.getCheckoutDocRef === "function" ||
                typeof globalScope.checkoutQueries.fetchCheckoutById === "function"
            )
        ) {
            return globalScope.checkoutQueries;
        }

        if (typeof require === "function") {
            try {
                const requiredCheckoutQueries = require("./checkout-queries.js");

                if (
                    requiredCheckoutQueries &&
                    (
                        typeof requiredCheckoutQueries.getCheckoutDocRef === "function" ||
                        typeof requiredCheckoutQueries.fetchCheckoutById === "function"
                    )
                ) {
                    return requiredCheckoutQueries;
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

    function normalizeUpperText(value) {
        return normalizeText(value).toUpperCase();
    }

    function createServiceError(code, message, details = {}) {
        const safeDetails = details && typeof details === "object" ? details : {};

        return {
            code: normalizeText(code) || "checkout/error",
            message: normalizeText(message) || "Something went wrong while handling the checkout request.",
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

    function createCheckoutFailure(code, message, details = {}) {
        const safeDetails = details && typeof details === "object" ? details : {};

        return createServiceResult(false, {
            ...safeDetails,
            error: createServiceError(code, message, safeDetails.errorDetails)
        });
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

    function resolveTimelineTimestampValue(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        if (safeOptions.timelineTimestampValue !== undefined) {
            return safeOptions.timelineTimestampValue;
        }

        if (safeOptions.timelineAt !== undefined) {
            return safeOptions.timelineAt;
        }

        if (safeOptions.timestampValue !== undefined) {
            return safeOptions.timestampValue;
        }

        if (safeOptions.now !== undefined) {
            return safeOptions.now;
        }

        if (typeof safeOptions.nowFactory === "function") {
            return safeOptions.nowFactory();
        }

        return new Date().toISOString();
    }

    function getCheckoutDependencies(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        return {
            checkoutStatus: resolveCheckoutStatus(safeOptions.checkoutStatus),
            checkoutModel: resolveCheckoutModel(safeOptions.checkoutModel),
            checkoutValidation: resolveCheckoutValidation(safeOptions.checkoutValidation),
            checkoutQueries: resolveCheckoutQueries(safeOptions.checkoutQueries)
        };
    }

    function getCheckoutDocRef(db, checkoutId, firestoreFns, explicitCheckoutQueries) {
        const checkoutQueries = resolveCheckoutQueries(explicitCheckoutQueries);
        const normalizedCheckoutId = normalizeText(checkoutId);

        if (
            checkoutQueries &&
            typeof checkoutQueries.getCheckoutDocRef === "function"
        ) {
            return checkoutQueries.getCheckoutDocRef(db, normalizedCheckoutId, firestoreFns);
        }

        if (!db || !firestoreFns || typeof firestoreFns.doc !== "function" || !normalizedCheckoutId) {
            return null;
        }

        return firestoreFns.doc(db, CHECKOUTS_COLLECTION, normalizedCheckoutId);
    }

    function getCheckoutsCollectionRef(db, firestoreFns, explicitCheckoutQueries) {
        const checkoutQueries = resolveCheckoutQueries(explicitCheckoutQueries);

        if (
            checkoutQueries &&
            typeof checkoutQueries.getCheckoutsCollectionRef === "function"
        ) {
            return checkoutQueries.getCheckoutsCollectionRef(db, firestoreFns);
        }

        if (!db || !firestoreFns || typeof firestoreFns.collection !== "function") {
            return null;
        }

        return firestoreFns.collection(db, CHECKOUTS_COLLECTION);
    }

    function createCheckoutId(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const explicitId = normalizeText(safeOptions.checkoutId || safeOptions.sessionId);

        if (explicitId) {
            return explicitId;
        }

        const factoryId = typeof safeOptions.checkoutIdFactory === "function"
            ? normalizeText(safeOptions.checkoutIdFactory(safeOptions))
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
                const collectionRef = getCheckoutsCollectionRef(
                    safeOptions.db,
                    safeOptions.firestoreFns,
                    safeOptions.checkoutQueries
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

        return `checkout-${seed}`;
    }

    function createPaymentReference(checkoutRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeRecord = checkoutRecord && typeof checkoutRecord === "object" ? checkoutRecord : {};
        const explicitReference = normalizeText(
            safeOptions.paymentReference ||
            safeOptions.reference ||
            safeRecord.paymentReference ||
            safeRecord.reference
        );

        if (explicitReference) {
            return explicitReference;
        }

        if (typeof safeOptions.paymentReferenceFactory === "function") {
            const factoryReference = normalizeText(safeOptions.paymentReferenceFactory(safeRecord, safeOptions));

            if (factoryReference) {
                return factoryReference;
            }
        }

        const checkoutId = normalizeText(safeRecord.checkoutId || safeOptions.checkoutId);
        const seed = normalizeLowerText(safeOptions.timestampSeed || `${Date.now()}`)
            .replace(/[^a-z0-9]+/g, "") || "generated";

        return checkoutId ? `checkout-${checkoutId}-${seed}` : `checkout-payment-${seed}`;
    }

    function buildCheckoutWritePayload(checkoutValues, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeValues = checkoutValues && typeof checkoutValues === "object" ? checkoutValues : {};
        const checkoutStatus = resolveCheckoutStatus(safeOptions.checkoutStatus);
        const checkoutModel = resolveCheckoutModel(safeOptions.checkoutModel);

        if (!checkoutModel) {
            const checkoutId = normalizeText(safeOptions.checkoutId || safeValues.checkoutId || safeValues.sessionId);

            return {
                ...safeValues,
                checkoutId,
                status: normalizeLowerText(safeOptions.status || safeValues.status),
                paymentProvider: normalizeLowerText(safeOptions.paymentProvider || safeValues.paymentProvider),
                paymentReference: normalizeText(safeOptions.paymentReference || safeValues.paymentReference),
                paymentAccessCode: normalizeText(safeOptions.paymentAccessCode || safeValues.paymentAccessCode),
                paymentAuthorizationUrl: normalizeText(
                    safeOptions.paymentAuthorizationUrl || safeValues.paymentAuthorizationUrl
                ),
                paymentAmount:
                    safeOptions.paymentAmount !== undefined
                        ? safeOptions.paymentAmount
                        : safeValues.paymentAmount,
                paymentAmountInMinorUnits:
                    safeOptions.paymentAmountInMinorUnits !== undefined
                        ? safeOptions.paymentAmountInMinorUnits
                        : safeValues.paymentAmountInMinorUnits,
                paymentCurrency: normalizeUpperText(safeOptions.paymentCurrency || safeValues.paymentCurrency),
                paymentPaidAt:
                    safeOptions.paymentPaidAt !== undefined
                        ? safeOptions.paymentPaidAt
                        : safeValues.paymentPaidAt,
                paymentFailedAt:
                    safeOptions.paymentFailedAt !== undefined
                        ? safeOptions.paymentFailedAt
                        : safeValues.paymentFailedAt,
                paymentVerifiedAt:
                    safeOptions.paymentVerifiedAt !== undefined
                        ? safeOptions.paymentVerifiedAt
                        : safeValues.paymentVerifiedAt,
                paymentFailureReason:
                    safeOptions.paymentFailureReason !== undefined
                        ? normalizeText(safeOptions.paymentFailureReason)
                        : normalizeText(safeValues.paymentFailureReason),
                convertedOrderId: normalizeText(safeOptions.convertedOrderId || safeValues.convertedOrderId),
                convertedAt:
                    safeOptions.convertedAt !== undefined
                        ? safeOptions.convertedAt
                        : safeValues.convertedAt,
                cancelledAt:
                    safeOptions.cancelledAt !== undefined
                        ? safeOptions.cancelledAt
                        : safeValues.cancelledAt,
                expiredAt:
                    safeOptions.expiredAt !== undefined
                        ? safeOptions.expiredAt
                        : safeValues.expiredAt,
                timeline: Array.isArray(safeOptions.timeline)
                    ? safeOptions.timeline.slice()
                    : Array.isArray(safeValues.timeline)
                        ? safeValues.timeline.slice()
                        : [],
                metadata: safeValues.metadata && typeof safeValues.metadata === "object"
                    ? { ...safeValues.metadata }
                    : {},
                createdAt:
                    safeOptions.createdAt !== undefined
                        ? safeOptions.createdAt
                        : safeValues.createdAt,
                updatedAt:
                    safeOptions.updatedAt !== undefined
                        ? safeOptions.updatedAt
                        : safeValues.updatedAt
            };
        }

        return checkoutModel.createCheckoutSessionRecord(
            {
                ...safeValues,
                checkoutId: safeOptions.checkoutId || safeValues.checkoutId,
                status:
                    safeOptions.status !== undefined
                        ? safeOptions.status
                        : safeValues.status,
                paymentProvider:
                    safeOptions.paymentProvider !== undefined
                        ? safeOptions.paymentProvider
                        : safeValues.paymentProvider,
                paymentReference:
                    safeOptions.paymentReference !== undefined
                        ? safeOptions.paymentReference
                        : safeValues.paymentReference,
                paymentAccessCode:
                    safeOptions.paymentAccessCode !== undefined
                        ? safeOptions.paymentAccessCode
                        : safeValues.paymentAccessCode,
                paymentAuthorizationUrl:
                    safeOptions.paymentAuthorizationUrl !== undefined
                        ? safeOptions.paymentAuthorizationUrl
                        : safeValues.paymentAuthorizationUrl,
                paymentAmount:
                    safeOptions.paymentAmount !== undefined
                        ? safeOptions.paymentAmount
                        : safeValues.paymentAmount,
                paymentAmountInMinorUnits:
                    safeOptions.paymentAmountInMinorUnits !== undefined
                        ? safeOptions.paymentAmountInMinorUnits
                        : safeValues.paymentAmountInMinorUnits,
                paymentCurrency:
                    safeOptions.paymentCurrency !== undefined
                        ? safeOptions.paymentCurrency
                        : safeValues.paymentCurrency,
                paymentPaidAt:
                    safeOptions.paymentPaidAt !== undefined
                        ? safeOptions.paymentPaidAt
                        : safeValues.paymentPaidAt,
                paymentFailedAt:
                    safeOptions.paymentFailedAt !== undefined
                        ? safeOptions.paymentFailedAt
                        : safeValues.paymentFailedAt,
                paymentVerifiedAt:
                    safeOptions.paymentVerifiedAt !== undefined
                        ? safeOptions.paymentVerifiedAt
                        : safeValues.paymentVerifiedAt,
                paymentFailureReason:
                    safeOptions.paymentFailureReason !== undefined
                        ? safeOptions.paymentFailureReason
                        : safeValues.paymentFailureReason,
                convertedOrderId:
                    safeOptions.convertedOrderId !== undefined
                        ? safeOptions.convertedOrderId
                        : safeValues.convertedOrderId,
                convertedAt:
                    safeOptions.convertedAt !== undefined
                        ? safeOptions.convertedAt
                        : safeValues.convertedAt,
                cancelledAt:
                    safeOptions.cancelledAt !== undefined
                        ? safeOptions.cancelledAt
                        : safeValues.cancelledAt,
                expiredAt:
                    safeOptions.expiredAt !== undefined
                        ? safeOptions.expiredAt
                        : safeValues.expiredAt,
                timeline: Array.isArray(safeOptions.timeline)
                    ? safeOptions.timeline.slice()
                    : safeValues.timeline,
                createdAt:
                    safeOptions.createdAt !== undefined
                        ? safeOptions.createdAt
                        : safeValues.createdAt,
                updatedAt:
                    safeOptions.updatedAt !== undefined
                        ? safeOptions.updatedAt
                        : safeValues.updatedAt
            },
            {
                checkoutStatus,
                createdAt:
                    safeOptions.createdAt !== undefined
                        ? safeOptions.createdAt
                        : safeValues.createdAt,
                createdByRole: safeOptions.createdByRole || "customer"
            }
        );
    }

    function buildCheckoutPatch(checkoutValues, options = {}) {
        const safeValues = checkoutValues && typeof checkoutValues === "object" ? checkoutValues : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const patch = {};

        [
            "checkoutId", "status", "paymentProvider", "paymentReference",
            "paymentAccessCode", "paymentAuthorizationUrl", "paymentAmount",
            "paymentAmountInMinorUnits", "paymentCurrency", "paymentPaidAt",
            "paymentFailedAt", "paymentVerifiedAt", "paymentFailureReason",
            "convertedOrderId", "convertedAt", "cancelledAt", "expiredAt",
            "updatedAt", "notes"
        ].forEach(function copyIfSet(key) {
            if (safeValues[key] !== undefined) {
                patch[key] = safeValues[key];
            }
        });

        if (Array.isArray(safeValues.timeline)) {
            patch.timeline = safeValues.timeline.slice();
        }

        if (safeOptions.includeMetadata === true && safeValues.metadata && typeof safeValues.metadata === "object") {
            patch.metadata = { ...safeValues.metadata };
        }

        return patch;
    }

    function createTimelineEntry(status, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const checkoutStatus = resolveCheckoutStatus(safeOptions.checkoutStatus);
        const checkoutModel = resolveCheckoutModel(safeOptions.checkoutModel);
        const timestamp = safeOptions.at !== undefined
            ? safeOptions.at
            : resolveTimelineTimestampValue(safeOptions);

        if (checkoutModel) {
            return checkoutModel.createCheckoutTimelineEntry(
                status,
                {
                    actorRole: safeOptions.actorRole || "system",
                    actorUid: safeOptions.actorUid,
                    actorName: safeOptions.actorName,
                    note: safeOptions.note,
                    at: timestamp
                },
                checkoutStatus
            );
        }

        return {
            status: normalizeLowerText(status),
            label: normalizeText(status),
            actorRole: normalizeLowerText(safeOptions.actorRole || "system"),
            actorUid: normalizeText(safeOptions.actorUid),
            actorName: normalizeText(safeOptions.actorName),
            note: normalizeText(safeOptions.note),
            at: timestamp
        };
    }

    function appendTimelineEntry(checkoutRecord, status, options = {}) {
        const safeRecord = checkoutRecord && typeof checkoutRecord === "object" ? checkoutRecord : {};
        const timeline = Array.isArray(safeRecord.timeline) ? safeRecord.timeline.slice() : [];
        const entry = createTimelineEntry(status, options);

        return {
            timeline: timeline.concat(entry),
            timelineEntry: entry
        };
    }

    function validatePaymentVerification(checkoutRecord, verificationValues = {}, options = {}) {
        const safeCheckout = checkoutRecord && typeof checkoutRecord === "object" ? checkoutRecord : {};
        const safeVerification = verificationValues && typeof verificationValues === "object"
            ? verificationValues
            : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const expectedReference = normalizeText(safeCheckout.paymentReference);
        const actualReference = normalizeText(safeVerification.reference || safeVerification.paymentReference);
        const allowReferenceRefresh =
            safeOptions.allowReferenceRefresh === true ||
            safeOptions.allowPaymentReferenceRefresh === true;
        const expectedAmount = Number.parseInt(safeCheckout.paymentAmountInMinorUnits, 10);
        const actualAmount = Number.parseInt(
            safeVerification.amountInMinorUnits !== undefined
                ? safeVerification.amountInMinorUnits
                : safeVerification.amount,
            10
        );
        const expectedCurrency = normalizeUpperText(safeCheckout.paymentCurrency || "ZAR");
        const actualCurrency = normalizeUpperText(safeVerification.currency || expectedCurrency);
        const verificationStatus = normalizeLowerText(safeVerification.status);
        const errors = {};

        if (
            verificationStatus !== "success" &&
            verificationStatus !== "successful" &&
            verificationStatus !== "paid"
        ) {
            errors.status = "Payment verification must be successful before checkout can be marked paid.";
        }

        if (!actualReference) {
            errors.reference = "Verified payment reference is required.";
        } else if (expectedReference && actualReference !== expectedReference && !allowReferenceRefresh) {
            errors.reference = "Verified payment reference does not match the checkout payment reference.";
        }

        if (!Number.isFinite(actualAmount) || actualAmount !== expectedAmount) {
            errors.amount = "Verified payment amount does not match the checkout payment amount.";
        }

        if (actualCurrency !== expectedCurrency) {
            errors.currency = "Verified payment currency does not match the checkout payment currency.";
        }

        const value = {
            status: verificationStatus,
            reference: actualReference,
            amountInMinorUnits: actualAmount,
            currency: actualCurrency
        };

        if (
            expectedReference &&
            actualReference &&
            actualReference !== expectedReference &&
            allowReferenceRefresh
        ) {
            value.referenceWasRefreshed = true;
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors,
            value
        };
    }

    function prepareCreateCheckout(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const dependencies = getCheckoutDependencies(safeOptions);

        if (!dependencies.checkoutModel || !dependencies.checkoutValidation) {
            return createCheckoutFailure(
                "checkout/dependencies-missing",
                "Checkout model and validation helpers are required before creating checkout sessions."
            );
        }

        const timestamp = resolveTimestampValue(safeOptions);
        const timelineTimestamp = resolveTimelineTimestampValue(safeOptions);
        const checkoutId = createCheckoutId({
            ...safeOptions,
            timestampSeed: safeOptions.timestampSeed || timestamp
        });
        const checkout = Array.isArray(safeOptions.cartItems)
            ? dependencies.checkoutModel.createCheckoutSessionFromCart(
                safeOptions.cartItems,
                safeOptions.customer || {},
                {
                    ...safeOptions,
                    checkoutId,
                    status: "draft",
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    timeline: [
                        dependencies.checkoutModel.createCheckoutTimelineEntry(
                            "draft",
                            {
                                actorRole: safeOptions.createdByRole || safeOptions.actorRole || "customer",
                                actorUid:
                                    safeOptions.createdByUid ||
                                    (safeOptions.customer && (
                                        safeOptions.customer.customerUid ||
                                        safeOptions.customer.uid
                                    )),
                                actorName:
                                    safeOptions.createdByName ||
                                    (safeOptions.customer && (
                                        safeOptions.customer.customerName ||
                                        safeOptions.customer.displayName
                                    )),
                                note: safeOptions.statusNote || safeOptions.note || "",
                                at: timelineTimestamp
                            },
                            dependencies.checkoutStatus
                        )
                    ]
                }
            )
            : buildCheckoutWritePayload(
                {
                    ...safeOptions.checkout,
                    checkoutId,
                    status: safeOptions.status || "draft",
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    timeline: Array.isArray(safeOptions.checkout && safeOptions.checkout.timeline)
                        ? safeOptions.checkout.timeline
                        : [
                            dependencies.checkoutModel.createCheckoutTimelineEntry(
                                safeOptions.status || "draft",
                                {
                                    actorRole: safeOptions.createdByRole || safeOptions.actorRole || "customer",
                                    actorUid: safeOptions.createdByUid,
                                    actorName: safeOptions.createdByName,
                                    note: safeOptions.statusNote || safeOptions.note || "",
                                    at: timelineTimestamp
                                },
                                dependencies.checkoutStatus
                            )
                        ]
                },
                {
                    ...safeOptions,
                    checkoutId,
                    status: safeOptions.status || "draft",
                    createdAt: timestamp,
                    updatedAt: timestamp
                }
            );
        const validation = dependencies.checkoutValidation.validateCreateCheckoutInput(
            checkout,
            {
                ...safeOptions,
                checkoutStatus: dependencies.checkoutStatus,
                checkoutModel: dependencies.checkoutModel
            }
        );

        if (!validation.isValid) {
            return createCheckoutFailure(
                "checkout/validation-failed",
                "Checkout details are invalid.",
                {
                    checkout: validation.value,
                    validationErrors: validation.errors
                }
            );
        }

        return createServiceResult(true, {
            checkout: validation.value
        });
    }

    function preparePaymentInitialization(checkoutRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const dependencies = getCheckoutDependencies(safeOptions);

        if (!dependencies.checkoutModel || !dependencies.checkoutValidation || !dependencies.checkoutStatus) {
            return createCheckoutFailure(
                "checkout/dependencies-missing",
                "Checkout helpers are required before payment can be initialized."
            );
        }

        const currentCheckout = dependencies.checkoutModel.normalizeCheckoutSessionRecord(
            checkoutRecord,
            { checkoutStatus: dependencies.checkoutStatus }
        );
        const initializationValidation = dependencies.checkoutValidation.validatePaymentInitializationInput(
            currentCheckout,
            {
                ...safeOptions,
                checkoutStatus: dependencies.checkoutStatus,
                checkoutModel: dependencies.checkoutModel
            }
        );

        if (!initializationValidation.isValid) {
            return createCheckoutFailure(
                "checkout/invalid-payment-initialization",
                "Checkout payment initialization details are invalid.",
                {
                    checkout: initializationValidation.value,
                    validationErrors: initializationValidation.errors
                }
            );
        }

        const updatedAt = resolveTimestampValue(safeOptions);
        const timelineAt = resolveTimelineTimestampValue(safeOptions);
        const paymentReference = createPaymentReference(currentCheckout, {
            ...safeOptions,
            timestampSeed: safeOptions.timestampSeed || updatedAt
        });
        const timelineUpdate = appendTimelineEntry(
            currentCheckout,
            dependencies.checkoutStatus.CHECKOUT_STATUSES.PAYMENT_PENDING,
            {
                ...safeOptions,
                checkoutStatus: dependencies.checkoutStatus,
                checkoutModel: dependencies.checkoutModel,
                actorRole: safeOptions.actorRole || "customer",
                note: safeOptions.note || "Payment initialized.",
                at: timelineAt
            }
        );
        const checkout = buildCheckoutWritePayload(
            currentCheckout,
            {
                ...safeOptions,
                checkoutStatus: dependencies.checkoutStatus,
                checkoutModel: dependencies.checkoutModel,
                status: dependencies.checkoutStatus.CHECKOUT_STATUSES.PAYMENT_PENDING,
                paymentReference,
                paymentProvider: safeOptions.paymentProvider || currentCheckout.paymentProvider,
                timeline: timelineUpdate.timeline,
                updatedAt
            }
        );
        const callbackUrl = normalizeText(safeOptions.callbackUrl || safeOptions.callbackURL);
        const payload = {
            email: checkout.customerEmail,
            amount: checkout.paymentAmountInMinorUnits,
            currency: checkout.paymentCurrency,
            reference: checkout.paymentReference,
            callback_url: callbackUrl || undefined,
            metadata: {
                ...checkout.metadata,
                checkoutId: checkout.checkoutId,
                customerUid: checkout.customerUid,
                vendorUid: checkout.vendorUid,
                provider: checkout.paymentProvider
            }
        };

        return createServiceResult(true, {
            checkout,
            previousCheckout: currentCheckout,
            timelineEntry: timelineUpdate.timelineEntry,
            patch: buildCheckoutPatch(checkout),
            payload
        });
    }

    function applyInitializedPayment(checkoutRecord, initializeResponse = {}, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeResponse = initializeResponse && typeof initializeResponse === "object"
            ? initializeResponse
            : {};
        const dependencies = getCheckoutDependencies(safeOptions);

        if (!dependencies.checkoutModel || !dependencies.checkoutStatus) {
            return createCheckoutFailure(
                "checkout/dependencies-missing",
                "Checkout model and status helpers are required before initialized payment can be applied."
            );
        }

        const currentCheckout = dependencies.checkoutModel.normalizeCheckoutSessionRecord(
            checkoutRecord,
            { checkoutStatus: dependencies.checkoutStatus }
        );
        const updatedAt = resolveTimestampValue(safeOptions);
        const timelineAt = resolveTimelineTimestampValue(safeOptions);
        const reference = normalizeText(
            safeResponse.reference ||
            safeResponse.paymentReference ||
            currentCheckout.paymentReference
        );
        const timelineUpdate = appendTimelineEntry(
            currentCheckout,
            dependencies.checkoutStatus.CHECKOUT_STATUSES.PAYMENT_PENDING,
            {
                ...safeOptions,
                checkoutStatus: dependencies.checkoutStatus,
                checkoutModel: dependencies.checkoutModel,
                actorRole: safeOptions.actorRole || "system",
                note: safeOptions.note || "Payment gateway returned checkout details.",
                at: timelineAt
            }
        );
        const checkout = buildCheckoutWritePayload(
            currentCheckout,
            {
                ...safeOptions,
                checkoutStatus: dependencies.checkoutStatus,
                checkoutModel: dependencies.checkoutModel,
                status: dependencies.checkoutStatus.CHECKOUT_STATUSES.PAYMENT_PENDING,
                paymentReference: reference,
                paymentAccessCode:
                    safeResponse.accessCode ||
                    safeResponse.access_code ||
                    currentCheckout.paymentAccessCode,
                paymentAuthorizationUrl:
                    safeResponse.authorizationUrl ||
                    safeResponse.authorization_url ||
                    safeResponse.paymentAuthorizationUrl ||
                    currentCheckout.paymentAuthorizationUrl,
                timeline: timelineUpdate.timeline,
                updatedAt
            }
        );

        return createServiceResult(true, {
            checkout,
            previousCheckout: currentCheckout,
            timelineEntry: timelineUpdate.timelineEntry,
            patch: buildCheckoutPatch(checkout)
        });
    }

    function applyFailedPayment(checkoutRecord, failureDetails = {}, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeFailure = failureDetails && typeof failureDetails === "object" ? failureDetails : {};
        const dependencies = getCheckoutDependencies(safeOptions);

        if (!dependencies.checkoutModel || !dependencies.checkoutStatus) {
            return createCheckoutFailure(
                "checkout/dependencies-missing",
                "Checkout model and status helpers are required before failed payment can be applied."
            );
        }

        const currentCheckout = dependencies.checkoutModel.normalizeCheckoutSessionRecord(
            checkoutRecord,
            { checkoutStatus: dependencies.checkoutStatus }
        );
        const failedAt = safeOptions.failedAt !== undefined
            ? safeOptions.failedAt
            : resolveTimestampValue(safeOptions);
        const timelineAt = resolveTimelineTimestampValue(safeOptions);
        const reason = normalizeText(
            safeFailure.reason ||
            safeFailure.message ||
            safeFailure.error ||
            "Payment could not be completed."
        );
        const timelineUpdate = appendTimelineEntry(
            currentCheckout,
            dependencies.checkoutStatus.CHECKOUT_STATUSES.PAYMENT_FAILED,
            {
                ...safeOptions,
                checkoutStatus: dependencies.checkoutStatus,
                checkoutModel: dependencies.checkoutModel,
                actorRole: safeOptions.actorRole || "system",
                note: safeOptions.note || reason,
                at: timelineAt
            }
        );
        const checkout = buildCheckoutWritePayload(
            currentCheckout,
            {
                ...safeOptions,
                checkoutStatus: dependencies.checkoutStatus,
                checkoutModel: dependencies.checkoutModel,
                status: dependencies.checkoutStatus.CHECKOUT_STATUSES.PAYMENT_FAILED,
                paymentFailedAt: failedAt,
                paymentFailureReason: reason,
                timeline: timelineUpdate.timeline,
                updatedAt: failedAt
            }
        );

        return createServiceResult(true, {
            checkout,
            previousCheckout: currentCheckout,
            timelineEntry: timelineUpdate.timelineEntry,
            patch: buildCheckoutPatch(checkout),
            failure: safeFailure
        });
    }

    function applyVerifiedPayment(checkoutRecord, verificationValues = {}, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const dependencies = getCheckoutDependencies(safeOptions);

        if (!dependencies.checkoutModel || !dependencies.checkoutStatus) {
            return createCheckoutFailure(
                "checkout/dependencies-missing",
                "Checkout model and status helpers are required before verified payment can be applied."
            );
        }

        const currentCheckout = dependencies.checkoutModel.normalizeCheckoutSessionRecord(
            checkoutRecord,
            { checkoutStatus: dependencies.checkoutStatus }
        );
        const verification = validatePaymentVerification(currentCheckout, verificationValues, safeOptions);

        if (!verification.isValid) {
            const failedResult = applyFailedPayment(
                currentCheckout,
                {
                    reason: "Payment verification failed.",
                    verification: verificationValues
                },
                safeOptions
            );

            return createCheckoutFailure(
                "checkout/payment-verification-mismatch",
                "Verified payment details do not match the checkout.",
                {
                    checkout: failedResult.checkout,
                    patch: failedResult.patch,
                    validationErrors: verification.errors
                }
            );
        }

        const verifiedAt = safeOptions.verifiedAt !== undefined
            ? safeOptions.verifiedAt
            : resolveTimestampValue(safeOptions);
        const timelineAt = resolveTimelineTimestampValue(safeOptions);
        const timelineUpdate = appendTimelineEntry(
            currentCheckout,
            dependencies.checkoutStatus.CHECKOUT_STATUSES.PAID,
            {
                ...safeOptions,
                checkoutStatus: dependencies.checkoutStatus,
                checkoutModel: dependencies.checkoutModel,
                actorRole: safeOptions.actorRole || "system",
                note: safeOptions.note || "Payment verified.",
                at: timelineAt
            }
        );
        const checkout = buildCheckoutWritePayload(
            currentCheckout,
            {
                ...safeOptions,
                checkoutStatus: dependencies.checkoutStatus,
                checkoutModel: dependencies.checkoutModel,
                status: dependencies.checkoutStatus.CHECKOUT_STATUSES.PAID,
                paymentReference: verification.value.reference,
                paymentPaidAt: safeOptions.paidAt !== undefined ? safeOptions.paidAt : verifiedAt,
                paymentVerifiedAt: verifiedAt,
                paymentFailureReason: "",
                timeline: timelineUpdate.timeline,
                updatedAt: verifiedAt
            }
        );

        return createServiceResult(true, {
            checkout,
            previousCheckout: currentCheckout,
            timelineEntry: timelineUpdate.timelineEntry,
            patch: buildCheckoutPatch(checkout),
            verification: verification.value
        });
    }

    function buildCheckoutStatusUpdate(checkoutRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const dependencies = getCheckoutDependencies(safeOptions);

        if (!dependencies.checkoutModel || !dependencies.checkoutStatus || !dependencies.checkoutValidation) {
            return createCheckoutFailure(
                "checkout/dependencies-missing",
                "Checkout helpers are required before checkout status can be updated."
            );
        }

        const currentCheckout = dependencies.checkoutModel.normalizeCheckoutSessionRecord(
            checkoutRecord,
            { checkoutStatus: dependencies.checkoutStatus }
        );
        const nextStatus = dependencies.checkoutStatus.normalizeCheckoutStatus(safeOptions.nextStatus);
        const actorRole = dependencies.checkoutStatus.normalizeCheckoutActorRole(
            safeOptions.actorRole || "system"
        );
        const transitionValidation = dependencies.checkoutValidation.validateCheckoutStatusChange(
            currentCheckout.status,
            nextStatus,
            actorRole,
            { checkoutStatus: dependencies.checkoutStatus }
        );

        if (!transitionValidation.isValid) {
            return createCheckoutFailure(
                "checkout/invalid-status-change",
                transitionValidation.transition && transitionValidation.transition.message
                    ? transitionValidation.transition.message
                    : "The requested checkout status change is not allowed.",
                {
                    checkout: currentCheckout,
                    transition: transitionValidation.transition
                }
            );
        }

        const updatedAt = resolveTimestampValue(safeOptions);
        const timelineAt = resolveTimelineTimestampValue(safeOptions);
        const timelineUpdate = appendTimelineEntry(
            currentCheckout,
            nextStatus,
            {
                ...safeOptions,
                checkoutStatus: dependencies.checkoutStatus,
                checkoutModel: dependencies.checkoutModel,
                actorRole,
                note: safeOptions.note,
                at: timelineAt
            }
        );
        const checkout = buildCheckoutWritePayload(
            currentCheckout,
            {
                ...safeOptions,
                checkoutStatus: dependencies.checkoutStatus,
                checkoutModel: dependencies.checkoutModel,
                status: nextStatus,
                timeline: timelineUpdate.timeline,
                updatedAt
            }
        );

        return createServiceResult(true, {
            checkout,
            previousCheckout: currentCheckout,
            transition: transitionValidation.transition,
            timelineEntry: timelineUpdate.timelineEntry,
            patch: buildCheckoutPatch(checkout),
            needsWrite: true,
            statusChanged: currentCheckout.status !== checkout.status
        });
    }

    function buildCheckoutCancellation(checkoutRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const dependencies = getCheckoutDependencies(safeOptions);

        if (!dependencies.checkoutModel || !dependencies.checkoutStatus || !dependencies.checkoutValidation) {
            return createCheckoutFailure(
                "checkout/dependencies-missing",
                "Checkout helpers are required before checkout can be cancelled."
            );
        }

        const currentCheckout = dependencies.checkoutModel.normalizeCheckoutSessionRecord(
            checkoutRecord,
            { checkoutStatus: dependencies.checkoutStatus }
        );
        const validation = dependencies.checkoutValidation.validateCheckoutCancellation(
            currentCheckout,
            {
                ...safeOptions,
                checkoutStatus: dependencies.checkoutStatus,
                checkoutModel: dependencies.checkoutModel,
                actorRole: safeOptions.actorRole || "customer"
            }
        );

        if (!validation.isValid) {
            return createCheckoutFailure(
                "checkout/cancel-not-allowed",
                "This checkout cannot be cancelled.",
                {
                    checkout: currentCheckout,
                    transition: validation.transition,
                    validationErrors: validation.errors
                }
            );
        }

        const cancelledAt = safeOptions.cancelledAt !== undefined
            ? safeOptions.cancelledAt
            : resolveTimestampValue(safeOptions);
        const timelineAt = resolveTimelineTimestampValue(safeOptions);
        const timelineUpdate = appendTimelineEntry(
            currentCheckout,
            dependencies.checkoutStatus.CHECKOUT_STATUSES.CANCELLED,
            {
                ...safeOptions,
                checkoutStatus: dependencies.checkoutStatus,
                checkoutModel: dependencies.checkoutModel,
                actorRole: safeOptions.actorRole || "customer",
                note: safeOptions.note || "Checkout cancelled before payment was completed.",
                at: timelineAt
            }
        );
        const checkout = buildCheckoutWritePayload(
            currentCheckout,
            {
                ...safeOptions,
                checkoutStatus: dependencies.checkoutStatus,
                checkoutModel: dependencies.checkoutModel,
                status: dependencies.checkoutStatus.CHECKOUT_STATUSES.CANCELLED,
                cancelledAt,
                timeline: timelineUpdate.timeline,
                updatedAt: cancelledAt
            }
        );

        return createServiceResult(true, {
            checkout,
            previousCheckout: currentCheckout,
            transition: validation.transition,
            timelineEntry: timelineUpdate.timelineEntry,
            patch: buildCheckoutPatch(checkout),
            needsWrite: true
        });
    }

    function buildCheckoutExpiry(checkoutRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const expiresAt = safeOptions.expiredAt !== undefined
            ? safeOptions.expiredAt
            : resolveTimestampValue(safeOptions);

        const statusUpdate = buildCheckoutStatusUpdate(checkoutRecord, {
            ...safeOptions,
            nextStatus: "expired",
            actorRole: safeOptions.actorRole || "system",
            note: safeOptions.note || "Checkout expired before payment was completed.",
            timestampValue: expiresAt
        });

        if (!statusUpdate.success) {
            return statusUpdate;
        }

        const checkout = buildCheckoutWritePayload(
            statusUpdate.checkout,
            {
                ...safeOptions,
                checkoutStatus: safeOptions.checkoutStatus,
                checkoutModel: safeOptions.checkoutModel,
                expiredAt: expiresAt,
                updatedAt: expiresAt
            }
        );

        return createServiceResult(true, {
            ...statusUpdate,
            checkout,
            patch: buildCheckoutPatch(checkout)
        });
    }

    function buildCheckoutConversion(checkoutRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const dependencies = getCheckoutDependencies(safeOptions);

        if (!dependencies.checkoutModel || !dependencies.checkoutStatus || !dependencies.checkoutValidation) {
            return createCheckoutFailure(
                "checkout/dependencies-missing",
                "Checkout helpers are required before checkout can be converted into an order."
            );
        }

        const currentCheckout = dependencies.checkoutModel.normalizeCheckoutSessionRecord(
            checkoutRecord,
            { checkoutStatus: dependencies.checkoutStatus }
        );
        const orderId = normalizeText(safeOptions.orderId || currentCheckout.convertedOrderId);
        const validation = dependencies.checkoutValidation.validateCheckoutConversion(
            currentCheckout,
            {
                ...safeOptions,
                checkoutStatus: dependencies.checkoutStatus,
                checkoutModel: dependencies.checkoutModel,
                orderId,
                requireOrderId: true
            }
        );

        if (!validation.isValid) {
            return createCheckoutFailure(
                "checkout/conversion-not-allowed",
                "This checkout is not ready to become an order.",
                {
                    checkout: currentCheckout,
                    validationErrors: validation.errors
                }
            );
        }

        const convertedAt = safeOptions.convertedAt !== undefined
            ? safeOptions.convertedAt
            : resolveTimestampValue(safeOptions);
        const timelineAt = resolveTimelineTimestampValue(safeOptions);
        const timelineUpdate = appendTimelineEntry(
            currentCheckout,
            dependencies.checkoutStatus.CHECKOUT_STATUSES.CONVERTED,
            {
                ...safeOptions,
                checkoutStatus: dependencies.checkoutStatus,
                checkoutModel: dependencies.checkoutModel,
                actorRole: safeOptions.actorRole || "system",
                note: safeOptions.note || "Paid checkout converted into an order.",
                at: timelineAt
            }
        );
        const checkout = buildCheckoutWritePayload(
            currentCheckout,
            {
                ...safeOptions,
                checkoutStatus: dependencies.checkoutStatus,
                checkoutModel: dependencies.checkoutModel,
                status: dependencies.checkoutStatus.CHECKOUT_STATUSES.CONVERTED,
                convertedOrderId: orderId,
                convertedAt,
                timeline: timelineUpdate.timeline,
                updatedAt: convertedAt
            }
        );
        const order = dependencies.checkoutModel.createOrderDraftFromCheckout(
            checkout,
            {
                orderId,
                createdAt: safeOptions.orderCreatedAt !== undefined
                    ? safeOptions.orderCreatedAt
                    : convertedAt,
                updatedAt: safeOptions.orderUpdatedAt !== undefined
                    ? safeOptions.orderUpdatedAt
                    : convertedAt,
                status: safeOptions.orderStatus || "pending"
            }
        );

        return createServiceResult(true, {
            checkout,
            previousCheckout: currentCheckout,
            order,
            timelineEntry: timelineUpdate.timelineEntry,
            patch: buildCheckoutPatch(checkout),
            needsWrite: true
        });
    }

    async function getCheckoutById(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const checkoutQueries = resolveCheckoutQueries(safeOptions.checkoutQueries);
        const checkoutId = normalizeText(safeOptions.checkoutId || safeOptions.sessionId);

        if (!checkoutId) {
            return null;
        }

        if (checkoutQueries && typeof checkoutQueries.fetchCheckoutById === "function") {
            return checkoutQueries.fetchCheckoutById({
                ...safeOptions,
                checkoutId
            });
        }

        if (
            !safeOptions.db ||
            !safeOptions.firestoreFns ||
            typeof safeOptions.firestoreFns.getDoc !== "function"
        ) {
            return null;
        }

        const docRef = getCheckoutDocRef(
            safeOptions.db,
            checkoutId,
            safeOptions.firestoreFns,
            checkoutQueries
        );

        if (!docRef) {
            return null;
        }

        const snapshot = await safeOptions.firestoreFns.getDoc(docRef);
        const exists = snapshot && typeof snapshot.exists === "function"
            ? snapshot.exists()
            : snapshot && snapshot.exists === true;

        if (!exists) {
            return null;
        }

        return {
            checkoutId: normalizeText(snapshot.id) || checkoutId,
            ...(typeof snapshot.data === "function" ? snapshot.data() : {})
        };
    }

    async function persistCheckoutCreate(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const checkout = safeOptions.checkout && typeof safeOptions.checkout === "object"
            ? safeOptions.checkout
            : null;
        const firestoreFns = safeOptions.firestoreFns || {};

        if (
            !safeOptions.db ||
            !checkout ||
            !normalizeText(checkout.checkoutId) ||
            typeof firestoreFns.setDoc !== "function"
        ) {
            return createCheckoutFailure(
                "checkout/create-unavailable",
                "A valid database, checkout ID, and setDoc helper are required before saving checkout.",
                { checkout }
            );
        }

        const docRef = getCheckoutDocRef(
            safeOptions.db,
            checkout.checkoutId,
            firestoreFns,
            safeOptions.checkoutQueries
        );

        if (!docRef) {
            return createCheckoutFailure(
                "checkout/doc-ref-unavailable",
                "A Firestore document reference for the checkout could not be created.",
                { checkout }
            );
        }

        await firestoreFns.setDoc(docRef, checkout);

        return createServiceResult(true, {
            checkout,
            docRef
        });
    }

    async function persistCheckoutUpdate(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const checkout = safeOptions.checkout && typeof safeOptions.checkout === "object"
            ? safeOptions.checkout
            : null;
        const firestoreFns = safeOptions.firestoreFns || {};

        if (
            !safeOptions.db ||
            !checkout ||
            !normalizeText(checkout.checkoutId)
        ) {
            return createCheckoutFailure(
                "checkout/update-unavailable",
                "A valid database and checkout ID are required before saving checkout updates.",
                { checkout }
            );
        }

        const docRef = getCheckoutDocRef(
            safeOptions.db,
            checkout.checkoutId,
            firestoreFns,
            safeOptions.checkoutQueries
        );

        if (!docRef) {
            return createCheckoutFailure(
                "checkout/doc-ref-unavailable",
                "A Firestore document reference for the checkout could not be created.",
                { checkout }
            );
        }

        const patch = safeOptions.patch && typeof safeOptions.patch === "object"
            ? safeOptions.patch
            : buildCheckoutPatch(checkout, {
                includeMetadata: safeOptions.includeMetadataInPatch
            });

        if (typeof firestoreFns.updateDoc === "function") {
            await firestoreFns.updateDoc(docRef, patch);

            return createServiceResult(true, { checkout, patch, docRef });
        }

        if (typeof firestoreFns.setDoc === "function") {
            await firestoreFns.setDoc(docRef, patch, { merge: true });

            return createServiceResult(true, { checkout, patch, docRef });
        }

        return createCheckoutFailure(
            "checkout/update-write-unavailable",
            "Firestore updateDoc or setDoc is required before saving checkout updates.",
            { checkout, patch }
        );
    }

    async function createCheckout(options = {}) {
        try {
            const prepared = prepareCreateCheckout(options);

            if (!prepared.success) {
                return prepared;
            }

            if (options && options.persist === false) {
                return prepared;
            }

            const persisted = await persistCheckoutCreate({
                ...options,
                checkout: prepared.checkout
            });

            if (!persisted.success) {
                return persisted;
            }

            return createServiceResult(true, {
                checkout: persisted.checkout,
                docRef: persisted.docRef
            });
        } catch (error) {
            return createCheckoutFailure(
                "checkout/create-failed",
                error && error.message ? error.message : "Failed to create checkout.",
                { errorDetails: { cause: error || null } }
            );
        }
    }

    async function initializeCheckoutPayment(options = {}) {
        try {
            const safeOptions = options && typeof options === "object" ? options : {};
            const sourceCheckout = safeOptions.checkout || await getCheckoutById(safeOptions);

            if (!sourceCheckout) {
                return createCheckoutFailure(
                    "checkout/not-found",
                    "The requested checkout could not be found.",
                    { checkout: null }
                );
            }

            const prepared = preparePaymentInitialization(sourceCheckout, safeOptions);

            if (!prepared.success) {
                return prepared;
            }

            if (safeOptions.persist === false) {
                return prepared;
            }

            const persisted = await persistCheckoutUpdate({
                ...safeOptions,
                checkout: prepared.checkout,
                patch: prepared.patch
            });

            if (!persisted.success) {
                return persisted;
            }

            return createServiceResult(true, {
                checkout: persisted.checkout,
                previousCheckout: prepared.previousCheckout,
                timelineEntry: prepared.timelineEntry,
                payload: prepared.payload,
                patch: persisted.patch,
                docRef: persisted.docRef
            });
        } catch (error) {
            return createCheckoutFailure(
                "checkout/payment-initialization-failed",
                error && error.message ? error.message : "Failed to initialize checkout payment.",
                { errorDetails: { cause: error || null } }
            );
        }
    }

    async function updateCheckoutWithPlan(plan, options = {}) {
        if (!plan.success || plan.needsWrite === false || (options && options.persist === false)) {
            return plan;
        }

        const persisted = await persistCheckoutUpdate({
            ...options,
            checkout: plan.checkout,
            patch: plan.patch
        });

        if (!persisted.success) {
            return persisted;
        }

        return createServiceResult(true, {
            ...plan,
            checkout: persisted.checkout,
            patch: persisted.patch,
            docRef: persisted.docRef
        });
    }

    async function cancelCheckout(options = {}) {
        try {
            const safeOptions = options && typeof options === "object" ? options : {};
            const sourceCheckout = safeOptions.checkout || await getCheckoutById(safeOptions);

            if (!sourceCheckout) {
                return createCheckoutFailure(
                    "checkout/not-found",
                    "The requested checkout could not be found.",
                    { checkout: null }
                );
            }

            return updateCheckoutWithPlan(
                buildCheckoutCancellation(sourceCheckout, safeOptions),
                safeOptions
            );
        } catch (error) {
            return createCheckoutFailure(
                "checkout/cancel-failed",
                error && error.message ? error.message : "Failed to cancel checkout.",
                { errorDetails: { cause: error || null } }
            );
        }
    }

    async function expireCheckout(options = {}) {
        try {
            const safeOptions = options && typeof options === "object" ? options : {};
            const sourceCheckout = safeOptions.checkout || await getCheckoutById(safeOptions);

            if (!sourceCheckout) {
                return createCheckoutFailure(
                    "checkout/not-found",
                    "The requested checkout could not be found.",
                    { checkout: null }
                );
            }

            return updateCheckoutWithPlan(
                buildCheckoutExpiry(sourceCheckout, safeOptions),
                safeOptions
            );
        } catch (error) {
            return createCheckoutFailure(
                "checkout/expire-failed",
                error && error.message ? error.message : "Failed to expire checkout.",
                { errorDetails: { cause: error || null } }
            );
        }
    }

    async function convertCheckoutToOrder(options = {}) {
        try {
            const safeOptions = options && typeof options === "object" ? options : {};
            const sourceCheckout = safeOptions.checkout || await getCheckoutById(safeOptions);

            if (!sourceCheckout) {
                return createCheckoutFailure(
                    "checkout/not-found",
                    "The requested checkout could not be found.",
                    { checkout: null }
                );
            }

            return updateCheckoutWithPlan(
                buildCheckoutConversion(sourceCheckout, safeOptions),
                safeOptions
            );
        } catch (error) {
            return createCheckoutFailure(
                "checkout/conversion-failed",
                error && error.message ? error.message : "Failed to convert checkout into an order.",
                { errorDetails: { cause: error || null } }
            );
        }
    }

    const checkoutService = {
        MODULE_NAME,
        CHECKOUTS_COLLECTION,
        resolveCheckoutStatus,
        resolveCheckoutModel,
        resolveCheckoutValidation,
        resolveCheckoutQueries,
        normalizeText,
        normalizeLowerText,
        normalizeUpperText,
        createServiceError,
        createServiceResult,
        createCheckoutFailure,
        resolveTimestampValue,
        resolveTimelineTimestampValue,
        getCheckoutDependencies,
        getCheckoutDocRef,
        getCheckoutsCollectionRef,
        createCheckoutId,
        createPaymentReference,
        buildCheckoutWritePayload,
        buildCheckoutPatch,
        createTimelineEntry,
        appendTimelineEntry,
        validatePaymentVerification,
        prepareCreateCheckout,
        preparePaymentInitialization,
        applyInitializedPayment,
        applyFailedPayment,
        applyVerifiedPayment,
        buildCheckoutStatusUpdate,
        buildCheckoutCancellation,
        buildCheckoutExpiry,
        buildCheckoutConversion,
        getCheckoutById,
        persistCheckoutCreate,
        persistCheckoutUpdate,
        createCheckout,
        initializeCheckoutPayment,
        updateCheckoutWithPlan,
        cancelCheckout,
        expireCheckout,
        convertCheckoutToOrder
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = checkoutService;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.checkoutService = checkoutService;
    }
})(typeof window !== "undefined" ? window : globalThis);
