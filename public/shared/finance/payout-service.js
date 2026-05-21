(function attachPayoutService(globalScope) {
    "use strict";

    const MODULE_NAME = "payout-service";
    const PAYOUTS_COLLECTION = "payoutRequests";
    const NOTIFICATIONS_COLLECTION = "notifications";

    function resolvePayoutModel(explicitPayoutModel) {
        if (
            explicitPayoutModel &&
            typeof explicitPayoutModel.createPayoutRequestRecord === "function" &&
            typeof explicitPayoutModel.validatePayoutRequestInput === "function" &&
            typeof explicitPayoutModel.applyPayoutStatus === "function"
        ) {
            return explicitPayoutModel;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.payoutModel &&
            typeof globalScope.payoutModel.createPayoutRequestRecord === "function" &&
            typeof globalScope.payoutModel.validatePayoutRequestInput === "function" &&
            typeof globalScope.payoutModel.applyPayoutStatus === "function"
        ) {
            return globalScope.payoutModel;
        }

        if (typeof require === "function") {
            try {
                const requiredPayoutModel = require("./payout-model.js");

                if (
                    requiredPayoutModel &&
                    typeof requiredPayoutModel.createPayoutRequestRecord === "function" &&
                    typeof requiredPayoutModel.validatePayoutRequestInput === "function" &&
                    typeof requiredPayoutModel.applyPayoutStatus === "function"
                ) {
                    return requiredPayoutModel;
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
            code: normalizeText(code) || "payout/error",
            message: normalizeText(message) || "Something went wrong while handling the payout request.",
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

    function createPayoutFailure(code, message, details = {}) {
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

    function getPayoutsCollectionRef(db, firestoreFns) {
        if (!db || !firestoreFns || typeof firestoreFns.collection !== "function") {
            return null;
        }

        return firestoreFns.collection(db, PAYOUTS_COLLECTION);
    }

    function getPayoutDocRef(db, payoutId, firestoreFns) {
        const normalizedPayoutId = normalizeText(payoutId);

        if (!db || !firestoreFns || typeof firestoreFns.doc !== "function" || !normalizedPayoutId) {
            return null;
        }

        return firestoreFns.doc(db, PAYOUTS_COLLECTION, normalizedPayoutId);
    }

    function getNotificationsCollectionRef(db, firestoreFns) {
        if (!db || !firestoreFns || typeof firestoreFns.collection !== "function") {
            return null;
        }

        return firestoreFns.collection(db, NOTIFICATIONS_COLLECTION);
    }

    function getNotificationDocRef(db, notificationId, firestoreFns) {
        const normalizedNotificationId = normalizeText(notificationId);

        if (!db || !firestoreFns || typeof firestoreFns.doc !== "function" || !normalizedNotificationId) {
            return null;
        }

        return firestoreFns.doc(db, NOTIFICATIONS_COLLECTION, normalizedNotificationId);
    }

    function collectPayoutInput(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const source = safeOptions.payout && typeof safeOptions.payout === "object"
            ? safeOptions.payout
            : safeOptions.payoutValues && typeof safeOptions.payoutValues === "object"
                ? safeOptions.payoutValues
                : safeOptions.withdrawal && typeof safeOptions.withdrawal === "object"
                    ? safeOptions.withdrawal
                    : {};

        return {
            ...source,
            payoutId: source.payoutId || safeOptions.payoutId,
            vendorUid: source.vendorUid || safeOptions.vendorUid,
            vendorName: source.vendorName || safeOptions.vendorName,
            vendorEmail: source.vendorEmail || safeOptions.vendorEmail,
            amount: source.amount !== undefined ? source.amount : safeOptions.amount,
            currency: source.currency || safeOptions.currency,
            fakeBankName: source.fakeBankName || safeOptions.fakeBankName,
            fakeAccountHolder: source.fakeAccountHolder || safeOptions.fakeAccountHolder,
            fakeAccountNumber: source.fakeAccountNumber || safeOptions.fakeAccountNumber,
            fakeBranchCode: source.fakeBranchCode || safeOptions.fakeBranchCode,
            fakeAccountType: source.fakeAccountType || safeOptions.fakeAccountType,
            notes: source.notes !== undefined ? source.notes : safeOptions.notes,
            note: source.note !== undefined ? source.note : safeOptions.note
        };
    }

    function buildPayoutPatch(payoutRecord) {
        const safePayout = payoutRecord && typeof payoutRecord === "object" ? payoutRecord : {};
        const patch = {};

        [
            "status",
            "statusLabel",
            "approvedAt",
            "paidAt",
            "rejectedAt",
            "cancelledAt",
            "processedAt",
            "processedByUid",
            "processedByName",
            "rejectionReason",
            "testEmailQueued",
            "emailNotificationId",
            "timeline",
            "updatedAt"
        ].forEach(function copyIfSet(key) {
            if (safePayout[key] !== undefined) {
                patch[key] = safePayout[key];
            }
        });

        return patch;
    }

    function buildNotificationWritePayload(notification, options = {}) {
        const safeNotification = notification && typeof notification === "object" ? notification : {};
        const safeOptions = options && typeof options === "object" ? options : {};
        const timestamp = safeOptions.createdAt !== undefined
            ? safeOptions.createdAt
            : safeOptions.timestampValue !== undefined
                ? safeOptions.timestampValue
                : safeNotification.queuedAt;

        return {
            notificationId: normalizeText(safeNotification.notificationId),
            recipientUid: normalizeText(safeNotification.recipientUid),
            recipientRole: normalizeLowerText(safeNotification.recipientRole) || "vendor",
            channel: normalizeLowerText(safeNotification.channel) || "test_email",
            type: normalizeLowerText(safeNotification.type) || "payout_request_submitted",
            title: normalizeText(safeNotification.title),
            message: normalizeText(safeNotification.message),
            payoutId: normalizeText(safeNotification.payoutId),
            vendorUid: normalizeText(safeNotification.vendorUid),
            vendorEmail: normalizeLowerText(safeNotification.vendorEmail),
            read: safeNotification.read === true,
            isRead: safeNotification.isRead === true,
            testMode: safeNotification.testMode !== false,
            queuedAt: safeNotification.queuedAt !== undefined ? safeNotification.queuedAt : timestamp,
            createdAt: timestamp,
            updatedAt: safeOptions.updatedAt !== undefined ? safeOptions.updatedAt : timestamp
        };
    }

    function prepareCreatePayoutRequest(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const payoutModel = resolvePayoutModel(safeOptions.payoutModel);

        if (!payoutModel) {
            return createPayoutFailure(
                "payout/dependencies-missing",
                "Payout model helpers are required before creating payout requests."
            );
        }

        const timestamp = resolveTimestampValue(safeOptions);
        const payoutInput = collectPayoutInput(safeOptions);
        const payoutId = payoutModel.createPayoutId(payoutInput, {
            ...safeOptions,
            createdAt: timestamp,
            timestampSeed: safeOptions.timestampSeed || timestamp
        });
        const validation = payoutModel.validatePayoutRequestInput(
            {
                ...payoutInput,
                payoutId,
                status: "pending",
                requestedAt: timestamp,
                createdAt: timestamp,
                updatedAt: timestamp
            },
            {
                ...safeOptions,
                createdAt: timestamp,
                availableBalance: safeOptions.availableBalance
            }
        );

        if (!validation.isValid) {
            return createPayoutFailure(
                "payout/invalid-request",
                "The payout request is not valid.",
                {
                    payout: validation.value,
                    validationErrors: validation.errors
                }
            );
        }

        const shouldQueueEmail = safeOptions.queueEmail !== false;
        const emailNotification = shouldQueueEmail
            ? payoutModel.createPayoutEmailNotification(validation.value, {
                queuedAt: timestamp,
                notificationId: safeOptions.emailNotificationId || `${payoutId}-email`
            })
            : null;
        const payout = payoutModel.createPayoutRequestRecord(
            {
                ...validation.value,
                fakeAccountNumber: payoutInput.fakeAccountNumber,
                accountNumber: payoutInput.accountNumber,
                bankAccountNumber: payoutInput.bankAccountNumber,
                testEmailQueued: shouldQueueEmail,
                emailNotificationId: emailNotification
                    ? emailNotification.notificationId
                    : ""
            },
            {
                ...safeOptions,
                createdAt: timestamp
            }
        );

        return createServiceResult(true, {
            payout,
            emailNotification,
            timestamp,
            validation
        });
    }

    async function persistPayoutCreate(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const payout = safeOptions.payout && typeof safeOptions.payout === "object"
            ? safeOptions.payout
            : null;
        const firestoreFns = safeOptions.firestoreFns || {};

        if (!payout || !normalizeText(payout.payoutId)) {
            return createPayoutFailure(
                "payout/create-missing-record",
                "A valid payout record and payout ID are required before saving."
            );
        }

        if (!safeOptions.db) {
            return createPayoutFailure(
                "payout/create-db-unavailable",
                "A Firestore database is required before saving payout requests.",
                { payout }
            );
        }

        const docRef = getPayoutDocRef(safeOptions.db, payout.payoutId, firestoreFns);

        if (docRef && typeof firestoreFns.setDoc === "function") {
            await firestoreFns.setDoc(docRef, payout);

            return createServiceResult(true, {
                payout,
                docRef
            });
        }

        const collectionRef = getPayoutsCollectionRef(safeOptions.db, firestoreFns);

        if (collectionRef && typeof firestoreFns.addDoc === "function") {
            const createdRef = await firestoreFns.addDoc(collectionRef, payout);

            return createServiceResult(true, {
                payout: {
                    ...payout,
                    payoutId: normalizeText(createdRef && createdRef.id) || payout.payoutId
                },
                docRef: createdRef
            });
        }

        return createPayoutFailure(
            "payout/create-write-unavailable",
            "Firestore setDoc or addDoc is required before saving payout requests.",
            { payout }
        );
    }

    async function persistPayoutEmailNotification(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const notification = safeOptions.notification && typeof safeOptions.notification === "object"
            ? safeOptions.notification
            : safeOptions.emailNotification && typeof safeOptions.emailNotification === "object"
                ? safeOptions.emailNotification
                : null;
        const firestoreFns = safeOptions.firestoreFns || {};

        if (!notification) {
            return createServiceResult(true, {
                skipped: true,
                notification: null
            });
        }

        if (!safeOptions.db) {
            return createPayoutFailure(
                "payout/email-db-unavailable",
                "A Firestore database is required before queuing payout email notifications.",
                { notification }
            );
        }

        const timestamp = resolveTimestampValue(safeOptions);
        const payload = buildNotificationWritePayload(notification, {
            timestampValue: timestamp
        });
        const docRef = getNotificationDocRef(safeOptions.db, payload.notificationId, firestoreFns);

        if (docRef && typeof firestoreFns.setDoc === "function") {
            await firestoreFns.setDoc(docRef, payload);

            return createServiceResult(true, {
                notification: payload,
                docRef
            });
        }

        const collectionRef = getNotificationsCollectionRef(safeOptions.db, firestoreFns);

        if (collectionRef && typeof firestoreFns.addDoc === "function") {
            const createdRef = await firestoreFns.addDoc(collectionRef, payload);

            return createServiceResult(true, {
                notification: {
                    ...payload,
                    notificationId: normalizeText(createdRef && createdRef.id) || payload.notificationId
                },
                docRef: createdRef
            });
        }

        return createPayoutFailure(
            "payout/email-write-unavailable",
            "Firestore setDoc or addDoc is required before queuing payout email notifications.",
            { notification: payload }
        );
    }

    async function createPayoutRequest(options = {}) {
        try {
            const safeOptions = options && typeof options === "object" ? options : {};
            const prepared = prepareCreatePayoutRequest(safeOptions);

            if (!prepared.success || safeOptions.persist === false) {
                return prepared;
            }

            const persisted = await persistPayoutCreate({
                ...safeOptions,
                payout: prepared.payout
            });

            if (!persisted.success) {
                return persisted;
            }

            const emailResult = await persistPayoutEmailNotification({
                ...safeOptions,
                emailNotification: prepared.emailNotification,
                timestampValue: prepared.timestamp
            });

            return createServiceResult(emailResult.success, {
                payout: persisted.payout,
                emailNotification: emailResult.notification || prepared.emailNotification,
                emailResult,
                docRef: persisted.docRef
            });
        } catch (error) {
            return createPayoutFailure(
                "payout/create-failed",
                error && error.message ? error.message : "Failed to create payout request.",
                { errorDetails: { cause: error || null } }
            );
        }
    }

    async function getPayoutById(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const payoutId = normalizeText(safeOptions.payoutId || safeOptions.withdrawalId);

        if (!payoutId) {
            return null;
        }

        if (typeof safeOptions.payoutReader === "function") {
            return safeOptions.payoutReader(payoutId, safeOptions);
        }

        const firestoreFns = safeOptions.firestoreFns || {};
        const docRef = getPayoutDocRef(safeOptions.db, payoutId, firestoreFns);

        if (!docRef || typeof firestoreFns.getDoc !== "function") {
            return null;
        }

        const snapshot = await firestoreFns.getDoc(docRef);
        const exists = snapshot && typeof snapshot.exists === "function"
            ? snapshot.exists()
            : snapshot && snapshot.exists === true;

        if (!exists) {
            return null;
        }

        return {
            payoutId: normalizeText(snapshot.id) || payoutId,
            ...(typeof snapshot.data === "function" ? snapshot.data() : {})
        };
    }

    async function persistPayoutUpdate(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const payout = safeOptions.payout && typeof safeOptions.payout === "object"
            ? safeOptions.payout
            : null;
        const firestoreFns = safeOptions.firestoreFns || {};
        const payoutId = normalizeText(safeOptions.payoutId || (payout && payout.payoutId));

        if (!safeOptions.db || !payoutId) {
            return createPayoutFailure(
                "payout/update-unavailable",
                "A valid database and payout ID are required before saving payout updates.",
                { payout }
            );
        }

        const patch = safeOptions.patch && typeof safeOptions.patch === "object"
            ? safeOptions.patch
            : buildPayoutPatch(payout);
        const docRef = getPayoutDocRef(safeOptions.db, payoutId, firestoreFns);

        if (!docRef) {
            return createPayoutFailure(
                "payout/update-doc-ref-unavailable",
                "A Firestore document reference for the payout could not be created.",
                { payout, patch }
            );
        }

        if (typeof firestoreFns.updateDoc === "function") {
            await firestoreFns.updateDoc(docRef, patch);

            return createServiceResult(true, {
                payout,
                patch,
                docRef
            });
        }

        if (typeof firestoreFns.setDoc === "function") {
            await firestoreFns.setDoc(docRef, patch, { merge: true });

            return createServiceResult(true, {
                payout,
                patch,
                docRef
            });
        }

        return createPayoutFailure(
            "payout/update-write-unavailable",
            "Firestore updateDoc or setDoc is required before saving payout updates.",
            { payout, patch }
        );
    }

    function buildPayoutStatusUpdate(payoutRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const payoutModel = resolvePayoutModel(safeOptions.payoutModel);

        if (!payoutModel) {
            return createPayoutFailure(
                "payout/dependencies-missing",
                "Payout model helpers are required before updating payout status."
            );
        }

        const timestamp = resolveTimestampValue(safeOptions);
        const update = payoutModel.applyPayoutStatus(
            payoutRecord,
            safeOptions.nextStatus || safeOptions.status,
            {
                ...safeOptions,
                timestamp,
                updatedAt: timestamp
            }
        );

        if (!update.success) {
            return update;
        }

        return createServiceResult(true, {
            ...update,
            patch: buildPayoutPatch(update.payout)
        });
    }

    async function updatePayoutStatus(options = {}) {
        try {
            const safeOptions = options && typeof options === "object" ? options : {};
            const sourcePayout = safeOptions.payout || await getPayoutById(safeOptions);

            if (!sourcePayout) {
                return createPayoutFailure(
                    "payout/not-found",
                    "The requested payout could not be found.",
                    { payout: null }
                );
            }

            const updatePlan = buildPayoutStatusUpdate(sourcePayout, safeOptions);

            if (!updatePlan.success || safeOptions.persist === false) {
                return updatePlan;
            }

            const persisted = await persistPayoutUpdate({
                ...safeOptions,
                payout: updatePlan.payout,
                patch: updatePlan.patch
            });

            if (!persisted.success) {
                return persisted;
            }

            return createServiceResult(true, {
                payout: updatePlan.payout,
                previousPayout: updatePlan.previousPayout,
                transition: updatePlan.transition,
                timelineEntry: updatePlan.timelineEntry,
                patch: persisted.patch,
                docRef: persisted.docRef
            });
        } catch (error) {
            return createPayoutFailure(
                "payout/status-update-failed",
                error && error.message ? error.message : "Failed to update payout status.",
                { errorDetails: { cause: error || null } }
            );
        }
    }

    const payoutService = {
        MODULE_NAME,
        PAYOUTS_COLLECTION,
        NOTIFICATIONS_COLLECTION,
        resolvePayoutModel,
        normalizeText,
        normalizeLowerText,
        createServiceError,
        createServiceResult,
        createPayoutFailure,
        resolveTimestampValue,
        getPayoutsCollectionRef,
        getPayoutDocRef,
        getNotificationsCollectionRef,
        getNotificationDocRef,
        collectPayoutInput,
        buildPayoutPatch,
        buildNotificationWritePayload,
        prepareCreatePayoutRequest,
        persistPayoutCreate,
        persistPayoutEmailNotification,
        createPayoutRequest,
        getPayoutById,
        persistPayoutUpdate,
        buildPayoutStatusUpdate,
        updatePayoutStatus
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = payoutService;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.payoutService = payoutService;
    }
})(typeof window !== "undefined" ? window : globalThis);
