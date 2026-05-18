(function attachCheckoutQueries(globalScope) {
    "use strict";

    const MODULE_NAME = "checkout-queries";
    const CHECKOUTS_COLLECTION = "checkoutSessions";

    function resolveCheckoutModel(explicitCheckoutModel) {
        if (
            explicitCheckoutModel &&
            typeof explicitCheckoutModel.normalizeCheckoutSessionRecord === "function"
        ) {
            return explicitCheckoutModel;
        }

        if (explicitCheckoutModel !== undefined && explicitCheckoutModel !== null) {
            return null;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.checkoutModel &&
            typeof globalScope.checkoutModel.normalizeCheckoutSessionRecord === "function"
        ) {
            return globalScope.checkoutModel;
        }

        if (typeof require === "function") {
            try {
                const requiredCheckoutModel = require("./checkout-model.js");

                if (
                    requiredCheckoutModel &&
                    typeof requiredCheckoutModel.normalizeCheckoutSessionRecord === "function"
                ) {
                    return requiredCheckoutModel;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveCheckoutStatus(explicitCheckoutStatus) {
        if (
            explicitCheckoutStatus &&
            typeof explicitCheckoutStatus.normalizeCheckoutStatus === "function"
        ) {
            return explicitCheckoutStatus;
        }

        if (explicitCheckoutStatus !== undefined && explicitCheckoutStatus !== null) {
            return null;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.checkoutStatus &&
            typeof globalScope.checkoutStatus.normalizeCheckoutStatus === "function"
        ) {
            return globalScope.checkoutStatus;
        }

        if (typeof require === "function") {
            try {
                const requiredCheckoutStatus = require("./checkout-status.js");

                if (
                    requiredCheckoutStatus &&
                    typeof requiredCheckoutStatus.normalizeCheckoutStatus === "function"
                ) {
                    return requiredCheckoutStatus;
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

    function normalizePositiveInteger(value, fallbackValue) {
        const parsed = Number.parseInt(value, 10);
        const fallbackParsed = Number.parseInt(fallbackValue, 10);

        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }

        if (Number.isFinite(fallbackParsed) && fallbackParsed > 0) {
            return fallbackParsed;
        }

        return 0;
    }

    function createFirestoreConstraint(factoryName, args, firestoreFns) {
        const safeArgs = Array.isArray(args) ? args : [];

        if (firestoreFns && typeof firestoreFns[factoryName] === "function") {
            return firestoreFns[factoryName](...safeArgs);
        }

        return {
            type: factoryName,
            args: safeArgs
        };
    }

    function createFirestoreQuery(collectionRef, constraints, firestoreFns) {
        const safeConstraints = Array.isArray(constraints)
            ? constraints.filter(Boolean)
            : [];

        if (firestoreFns && typeof firestoreFns.query === "function") {
            return firestoreFns.query(collectionRef, ...safeConstraints);
        }

        return {
            collectionRef,
            constraints: safeConstraints
        };
    }

    function getCheckoutsCollectionRef(db, firestoreFns) {
        if (!db || !firestoreFns || typeof firestoreFns.collection !== "function") {
            return null;
        }

        return firestoreFns.collection(db, CHECKOUTS_COLLECTION);
    }

    function getCheckoutDocRef(db, checkoutId, firestoreFns) {
        const normalizedCheckoutId = normalizeText(checkoutId);

        if (!db || !firestoreFns || typeof firestoreFns.doc !== "function" || !normalizedCheckoutId) {
            return null;
        }

        return firestoreFns.doc(db, CHECKOUTS_COLLECTION, normalizedCheckoutId);
    }

    function normalizeFilterList(values, normalizer) {
        const sourceList = Array.isArray(values)
            ? values
            : (values !== undefined && values !== null ? [values] : []);
        const normalize = typeof normalizer === "function"
            ? normalizer
            : function defaultNormalize(value) {
                return normalizeLowerText(value);
            };

        return sourceList
            .map(function normalizeOneValue(value) {
                return normalize(value);
            })
            .filter(Boolean)
            .filter(function keepUnique(value, index, list) {
                return list.indexOf(value) === index;
            });
    }

    function normalizeStatusFilters(statusFilters, explicitCheckoutStatus) {
        const checkoutStatus = resolveCheckoutStatus(explicitCheckoutStatus);

        if (!checkoutStatus) {
            return normalizeFilterList(statusFilters);
        }

        return normalizeFilterList(statusFilters, function normalizeOneStatus(value) {
            return checkoutStatus.normalizeCheckoutStatus(value);
        });
    }

    function getDefaultResumableStatuses(explicitCheckoutStatus) {
        const checkoutStatus = resolveCheckoutStatus(explicitCheckoutStatus);

        if (
            checkoutStatus &&
            typeof checkoutStatus.getResumableCheckoutStatusList === "function"
        ) {
            return checkoutStatus.getResumableCheckoutStatusList();
        }

        return ["draft", "payment_pending", "payment_failed"];
    }

    function getDefaultActiveStatuses(explicitCheckoutStatus) {
        const checkoutStatus = resolveCheckoutStatus(explicitCheckoutStatus);

        if (
            checkoutStatus &&
            typeof checkoutStatus.getActiveCheckoutStatusList === "function"
        ) {
            return checkoutStatus.getActiveCheckoutStatusList();
        }

        return ["draft", "payment_pending", "payment_failed", "paid"];
    }

    function buildEqualityOrInConstraint(field, values, firestoreFns) {
        if (!Array.isArray(values) || values.length === 0) {
            return null;
        }

        if (values.length === 1) {
            return createFirestoreConstraint("where", [field, "==", values[0]], firestoreFns);
        }

        return createFirestoreConstraint("where", [field, "in", values], firestoreFns);
    }

    function buildStatusConstraints(statusFilters, firestoreFns, explicitCheckoutStatus) {
        const normalizedStatuses = normalizeStatusFilters(statusFilters, explicitCheckoutStatus);
        const constraint = buildEqualityOrInConstraint("status", normalizedStatuses, firestoreFns);

        return constraint ? [constraint] : [];
    }

    function applyCommonCheckoutQueryOptions(constraints, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const limitCount = normalizePositiveInteger(safeOptions.limitCount, 0);

        constraints.push(
            createFirestoreConstraint(
                "orderBy",
                [safeOptions.orderByField || "updatedAt", safeOptions.orderDirection || "desc"],
                safeOptions.firestoreFns
            )
        );

        if (safeOptions.includeCreatedAtOrder !== false) {
            constraints.push(
                createFirestoreConstraint("orderBy", ["createdAt", "desc"], safeOptions.firestoreFns)
            );
        }

        if (limitCount > 0) {
            constraints.push(
                createFirestoreConstraint("limit", [limitCount], safeOptions.firestoreFns)
            );
        }

        return constraints;
    }

    function buildCustomerCheckoutsQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const customerUid = normalizeText(safeOptions.customerUid);
        const constraints = [
            createFirestoreConstraint("where", ["customerUid", "==", customerUid], safeOptions.firestoreFns),
            ...buildStatusConstraints(
                safeOptions.statuses,
                safeOptions.firestoreFns,
                safeOptions.checkoutStatus
            )
        ];

        return createFirestoreQuery(
            getCheckoutsCollectionRef(safeOptions.db, safeOptions.firestoreFns),
            applyCommonCheckoutQueryOptions(constraints, safeOptions),
            safeOptions.firestoreFns
        );
    }

    function buildVendorCheckoutsQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const vendorUid = normalizeText(safeOptions.vendorUid);
        const constraints = [
            createFirestoreConstraint("where", ["vendorUid", "==", vendorUid], safeOptions.firestoreFns),
            ...buildStatusConstraints(
                safeOptions.statuses,
                safeOptions.firestoreFns,
                safeOptions.checkoutStatus
            )
        ];

        return createFirestoreQuery(
            getCheckoutsCollectionRef(safeOptions.db, safeOptions.firestoreFns),
            applyCommonCheckoutQueryOptions(constraints, safeOptions),
            safeOptions.firestoreFns
        );
    }

    function buildActiveCustomerCheckoutQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        return buildCustomerCheckoutsQuery({
            ...safeOptions,
            statuses: safeOptions.statuses || getDefaultActiveStatuses(safeOptions.checkoutStatus),
            limitCount: safeOptions.limitCount || 1
        });
    }

    function buildResumableCustomerCheckoutQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        return buildCustomerCheckoutsQuery({
            ...safeOptions,
            statuses: safeOptions.statuses || getDefaultResumableStatuses(safeOptions.checkoutStatus),
            limitCount: safeOptions.limitCount || 1
        });
    }

    function buildPaymentReferenceQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const reference = normalizeText(safeOptions.paymentReference || safeOptions.reference);
        const constraints = [
            createFirestoreConstraint("where", ["paymentReference", "==", reference], safeOptions.firestoreFns)
        ];

        return createFirestoreQuery(
            getCheckoutsCollectionRef(safeOptions.db, safeOptions.firestoreFns),
            applyCommonCheckoutQueryOptions(
                constraints,
                {
                    ...safeOptions,
                    limitCount: safeOptions.limitCount || 1
                }
            ),
            safeOptions.firestoreFns
        );
    }

    function getSnapshotData(snapshot) {
        if (!snapshot || typeof snapshot.data !== "function") {
            return {};
        }

        return snapshot.data() || {};
    }

    function snapshotExists(snapshot) {
        if (!snapshot) {
            return false;
        }

        if (typeof snapshot.exists === "function") {
            return snapshot.exists();
        }

        return true;
    }

    function mapCheckoutDocument(snapshot, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const checkoutModel = resolveCheckoutModel(safeOptions.checkoutModel);

        if (!snapshotExists(snapshot)) {
            return null;
        }

        const rawData = getSnapshotData(snapshot);
        const rawRecord = {
            checkoutId: normalizeText(snapshot.id),
            ...rawData
        };

        if (checkoutModel) {
            return checkoutModel.normalizeCheckoutSessionRecord(rawRecord, {
                checkoutStatus: safeOptions.checkoutStatus
            });
        }

        return rawRecord;
    }

    function mapCheckoutDocuments(querySnapshot, options = {}) {
        const docs = querySnapshot && Array.isArray(querySnapshot.docs)
            ? querySnapshot.docs
            : [];

        return docs
            .map(function mapOneCheckout(docSnapshot) {
                return mapCheckoutDocument(docSnapshot, options);
            })
            .filter(Boolean);
    }

    function getFirstCheckoutFromSnapshot(querySnapshot, options = {}) {
        const mapped = mapCheckoutDocuments(querySnapshot, options);

        return mapped.length > 0 ? mapped[0] : null;
    }

    async function fetchCheckoutById(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const docRef = getCheckoutDocRef(safeOptions.db, safeOptions.checkoutId, safeOptions.firestoreFns);

        if (
            !docRef ||
            !safeOptions.firestoreFns ||
            typeof safeOptions.firestoreFns.getDoc !== "function"
        ) {
            return null;
        }

        const snapshot = await safeOptions.firestoreFns.getDoc(docRef);

        return mapCheckoutDocument(snapshot, safeOptions);
    }

    async function fetchCustomerCheckouts(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        if (!safeOptions.firestoreFns || typeof safeOptions.firestoreFns.getDocs !== "function") {
            return [];
        }

        const snapshot = await safeOptions.firestoreFns.getDocs(
            buildCustomerCheckoutsQuery(safeOptions)
        );

        return mapCheckoutDocuments(snapshot, safeOptions);
    }

    async function fetchVendorCheckouts(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        if (!safeOptions.firestoreFns || typeof safeOptions.firestoreFns.getDocs !== "function") {
            return [];
        }

        const snapshot = await safeOptions.firestoreFns.getDocs(
            buildVendorCheckoutsQuery(safeOptions)
        );

        return mapCheckoutDocuments(snapshot, safeOptions);
    }

    async function fetchActiveCustomerCheckout(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        if (!safeOptions.firestoreFns || typeof safeOptions.firestoreFns.getDocs !== "function") {
            return null;
        }

        const snapshot = await safeOptions.firestoreFns.getDocs(
            buildActiveCustomerCheckoutQuery(safeOptions)
        );

        return getFirstCheckoutFromSnapshot(snapshot, safeOptions);
    }

    async function fetchResumableCustomerCheckout(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        if (!safeOptions.firestoreFns || typeof safeOptions.firestoreFns.getDocs !== "function") {
            return null;
        }

        const snapshot = await safeOptions.firestoreFns.getDocs(
            buildResumableCustomerCheckoutQuery(safeOptions)
        );

        return getFirstCheckoutFromSnapshot(snapshot, safeOptions);
    }

    async function fetchCheckoutByPaymentReference(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        if (!safeOptions.firestoreFns || typeof safeOptions.firestoreFns.getDocs !== "function") {
            return null;
        }

        const snapshot = await safeOptions.firestoreFns.getDocs(
            buildPaymentReferenceQuery(safeOptions)
        );

        return getFirstCheckoutFromSnapshot(snapshot, safeOptions);
    }

    const checkoutQueries = {
        MODULE_NAME,
        CHECKOUTS_COLLECTION,
        resolveCheckoutModel,
        resolveCheckoutStatus,
        normalizeText,
        normalizeLowerText,
        normalizePositiveInteger,
        createFirestoreConstraint,
        createFirestoreQuery,
        getCheckoutsCollectionRef,
        getCheckoutDocRef,
        normalizeFilterList,
        normalizeStatusFilters,
        getDefaultResumableStatuses,
        getDefaultActiveStatuses,
        buildEqualityOrInConstraint,
        buildStatusConstraints,
        applyCommonCheckoutQueryOptions,
        buildCustomerCheckoutsQuery,
        buildVendorCheckoutsQuery,
        buildActiveCustomerCheckoutQuery,
        buildResumableCustomerCheckoutQuery,
        buildPaymentReferenceQuery,
        getSnapshotData,
        snapshotExists,
        mapCheckoutDocument,
        mapCheckoutDocuments,
        getFirstCheckoutFromSnapshot,
        fetchCheckoutById,
        fetchCustomerCheckouts,
        fetchVendorCheckouts,
        fetchActiveCustomerCheckout,
        fetchResumableCustomerCheckout,
        fetchCheckoutByPaymentReference
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = checkoutQueries;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.checkoutQueries = checkoutQueries;
    }
})(typeof window !== "undefined" ? window : globalThis);
