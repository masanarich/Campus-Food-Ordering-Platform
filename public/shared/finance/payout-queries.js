(function attachPayoutQueries(globalScope) {
    "use strict";

    const MODULE_NAME = "payout-queries";
    const PAYOUTS_COLLECTION = "payoutRequests";

    function resolvePayoutModel(explicitPayoutModel) {
        if (
            explicitPayoutModel &&
            typeof explicitPayoutModel.normalizePayoutRecord === "function" &&
            typeof explicitPayoutModel.normalizePayoutStatus === "function"
        ) {
            return explicitPayoutModel;
        }

        if (explicitPayoutModel !== undefined && explicitPayoutModel !== null) {
            return null;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.payoutModel &&
            typeof globalScope.payoutModel.normalizePayoutRecord === "function" &&
            typeof globalScope.payoutModel.normalizePayoutStatus === "function"
        ) {
            return globalScope.payoutModel;
        }

        if (typeof require === "function") {
            try {
                const requiredPayoutModel = require("./payout-model.js");

                if (
                    requiredPayoutModel &&
                    typeof requiredPayoutModel.normalizePayoutRecord === "function" &&
                    typeof requiredPayoutModel.normalizePayoutStatus === "function"
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

    function normalizeStatusFilters(statusFilters, explicitPayoutModel) {
        const payoutModel = resolvePayoutModel(explicitPayoutModel);

        if (!payoutModel) {
            return normalizeFilterList(statusFilters);
        }

        return normalizeFilterList(statusFilters, function normalizeOneStatus(value) {
            return payoutModel.normalizePayoutStatus(value);
        });
    }

    function getDefaultActiveStatuses(explicitPayoutModel) {
        const payoutModel = resolvePayoutModel(explicitPayoutModel);

        if (payoutModel && Array.isArray(payoutModel.ACTIVE_PAYOUT_STATUSES)) {
            return payoutModel.ACTIVE_PAYOUT_STATUSES.slice();
        }

        return ["pending", "approved"];
    }

    function getBalanceReservingStatuses(explicitPayoutModel) {
        const payoutModel = resolvePayoutModel(explicitPayoutModel);

        if (payoutModel && Array.isArray(payoutModel.BALANCE_RESERVING_STATUSES)) {
            return payoutModel.BALANCE_RESERVING_STATUSES.slice();
        }

        return ["pending", "approved", "paid"];
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

    function buildStatusConstraints(statusFilters, firestoreFns, explicitPayoutModel) {
        const normalizedStatuses = normalizeStatusFilters(statusFilters, explicitPayoutModel);
        const constraint = buildEqualityOrInConstraint("status", normalizedStatuses, firestoreFns);

        return constraint ? [constraint] : [];
    }

    function applyCommonPayoutQueryOptions(constraints, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const limitCount = normalizePositiveInteger(safeOptions.limitCount, 0);

        constraints.push(
            createFirestoreConstraint(
                "orderBy",
                [safeOptions.orderByField || "updatedAt", safeOptions.orderDirection || "desc"],
                safeOptions.firestoreFns
            )
        );

        if (safeOptions.includeRequestedAtOrder !== false) {
            constraints.push(
                createFirestoreConstraint("orderBy", ["requestedAt", "desc"], safeOptions.firestoreFns)
            );
        }

        if (limitCount > 0) {
            constraints.push(
                createFirestoreConstraint("limit", [limitCount], safeOptions.firestoreFns)
            );
        }

        return constraints;
    }

    function buildVendorPayoutsQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const vendorUid = normalizeText(safeOptions.vendorUid);
        const constraints = [
            createFirestoreConstraint("where", ["vendorUid", "==", vendorUid], safeOptions.firestoreFns),
            ...buildStatusConstraints(
                safeOptions.statuses,
                safeOptions.firestoreFns,
                safeOptions.payoutModel
            )
        ];

        return createFirestoreQuery(
            getPayoutsCollectionRef(safeOptions.db, safeOptions.firestoreFns),
            applyCommonPayoutQueryOptions(constraints, safeOptions),
            safeOptions.firestoreFns
        );
    }

    function buildAdminPayoutsQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const constraints = [
            ...buildStatusConstraints(
                safeOptions.statuses,
                safeOptions.firestoreFns,
                safeOptions.payoutModel
            )
        ];

        return createFirestoreQuery(
            getPayoutsCollectionRef(safeOptions.db, safeOptions.firestoreFns),
            applyCommonPayoutQueryOptions(constraints, safeOptions),
            safeOptions.firestoreFns
        );
    }

    function buildActiveVendorPayoutsQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        return buildVendorPayoutsQuery({
            ...safeOptions,
            statuses: safeOptions.statuses || getDefaultActiveStatuses(safeOptions.payoutModel)
        });
    }

    function buildBalanceReservingVendorPayoutsQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        return buildVendorPayoutsQuery({
            ...safeOptions,
            statuses: safeOptions.statuses || getBalanceReservingStatuses(safeOptions.payoutModel)
        });
    }

    function buildPayoutStatusQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        return buildAdminPayoutsQuery({
            ...safeOptions,
            statuses: safeOptions.statuses || safeOptions.status
        });
    }

    // ------------------------------------------------------------------------
    // Fallback queries (used when composite indexes are still building or
    // have not been deployed). These use only single-field where clauses so
    // they rely on Firestore's automatically-maintained single-field indexes.
    // Sorting and any multi-status filtering happen client-side.
    // ------------------------------------------------------------------------

    function buildVendorPayoutsFallbackQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const vendorUid = normalizeText(safeOptions.vendorUid);
        const collectionRef = getPayoutsCollectionRef(safeOptions.db, safeOptions.firestoreFns);
        const constraints = [];
        if (vendorUid) {
            constraints.push(
                createFirestoreConstraint("where", ["vendorUid", "==", vendorUid], safeOptions.firestoreFns)
            );
        }
        return createFirestoreQuery(collectionRef, constraints, safeOptions.firestoreFns);
    }

    function buildAdminPayoutsFallbackQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const collectionRef = getPayoutsCollectionRef(safeOptions.db, safeOptions.firestoreFns);
        // No where clauses — fetch the entire payoutRequests collection, then
        // sort + filter in memory.
        return createFirestoreQuery(collectionRef, [], safeOptions.firestoreFns);
    }

    function isMissingIndexError(error) {
        if (!error) return false;
        if (error.code === "failed-precondition") return true;
        const msg = typeof error.message === "string" ? error.message : "";
        return /\bindex\b/i.test(msg) && /\b(building|require[ds]?|create[ds]?|composite)\b/i.test(msg);
    }

    function getPayoutSortValue(record, field) {
        if (!record) return 0;
        const value = record[field];
        if (value == null) return 0;
        if (typeof value === "object" && typeof value.toMillis === "function") {
            return value.toMillis();
        }
        if (value instanceof Date) return value.getTime();
        if (typeof value === "string") {
            const parsed = Date.parse(value);
            return Number.isFinite(parsed) ? parsed : 0;
        }
        if (typeof value === "number" && Number.isFinite(value)) return value;
        return 0;
    }

    function sortPayoutsInMemory(records, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderByField = safeOptions.orderByField || "updatedAt";
        const direction = safeOptions.orderDirection === "asc" ? 1 : -1;
        const includeRequestedAt = safeOptions.includeRequestedAtOrder !== false;

        return records.slice().sort(function comparePayouts(a, b) {
            const av = getPayoutSortValue(a, orderByField);
            const bv = getPayoutSortValue(b, orderByField);
            if (av !== bv) return (av < bv ? -1 : 1) * direction;
            if (includeRequestedAt) {
                const ar = getPayoutSortValue(a, "requestedAt");
                const br = getPayoutSortValue(b, "requestedAt");
                if (ar !== br) return ar < br ? 1 : -1; // requestedAt is always desc
            }
            return 0;
        });
    }

    function filterPayoutsByStatusesInMemory(records, statuses, explicitPayoutModel) {
        const normalized = normalizeStatusFilters(statuses, explicitPayoutModel);
        if (normalized.length === 0) return records;
        const allowed = new Set(normalized);
        return records.filter(function isInStatusList(record) {
            if (!record) return false;
            const status = typeof record.status === "string"
                ? record.status.trim().toLowerCase()
                : "";
            return allowed.has(status);
        });
    }

    function filterPayoutsByVendorInMemory(records, vendorUid) {
        const target = normalizeText(vendorUid);
        if (!target) return records;
        return records.filter(function matchesVendor(record) {
            return record && normalizeText(record.vendorUid) === target;
        });
    }

    function applyClientSideLimit(records, limitCount) {
        const limit = normalizePositiveInteger(limitCount, 0);
        if (limit > 0) return records.slice(0, limit);
        return records;
    }

    async function runWithIndexFallback(safeOptions, primaryQuery, fallbackQuery, postProcessors) {
        const fns = safeOptions.firestoreFns;
        try {
            const snapshot = await fns.getDocs(primaryQuery);
            return mapPayoutDocuments(snapshot, safeOptions);
        } catch (error) {
            if (!isMissingIndexError(error)) throw error;
            if (typeof console !== "undefined" && typeof console.warn === "function") {
                console.warn("[payout-queries] Falling back to in-memory sort because Firestore index is unavailable:", error.message);
            }
            const fallbackSnapshot = await fns.getDocs(fallbackQuery);
            let records = mapPayoutDocuments(fallbackSnapshot, safeOptions);
            const processors = Array.isArray(postProcessors) ? postProcessors : [];
            for (const step of processors) {
                records = step(records);
            }
            return records;
        }
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

        return snapshot.exists !== false;
    }

    function mapPayoutDocument(snapshot, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const payoutModel = resolvePayoutModel(safeOptions.payoutModel);

        if (!snapshotExists(snapshot)) {
            return null;
        }

        const rawData = getSnapshotData(snapshot);
        const rawRecord = {
            payoutId: normalizeText(snapshot.id),
            ...rawData
        };

        if (payoutModel) {
            return payoutModel.normalizePayoutRecord(rawRecord);
        }

        return rawRecord;
    }

    function mapPayoutDocuments(querySnapshot, options = {}) {
        const docs = querySnapshot && Array.isArray(querySnapshot.docs)
            ? querySnapshot.docs
            : [];

        return docs
            .map(function mapOnePayout(docSnapshot) {
                return mapPayoutDocument(docSnapshot, options);
            })
            .filter(Boolean);
    }

    function getFirstPayoutFromSnapshot(querySnapshot, options = {}) {
        const mapped = mapPayoutDocuments(querySnapshot, options);

        return mapped.length > 0 ? mapped[0] : null;
    }

    async function fetchPayoutById(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const docRef = getPayoutDocRef(safeOptions.db, safeOptions.payoutId, safeOptions.firestoreFns);

        if (
            !docRef ||
            !safeOptions.firestoreFns ||
            typeof safeOptions.firestoreFns.getDoc !== "function"
        ) {
            return null;
        }

        const snapshot = await safeOptions.firestoreFns.getDoc(docRef);

        return mapPayoutDocument(snapshot, safeOptions);
    }

    async function fetchVendorPayouts(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        if (!safeOptions.firestoreFns || typeof safeOptions.firestoreFns.getDocs !== "function") {
            return [];
        }

        return runWithIndexFallback(
            safeOptions,
            buildVendorPayoutsQuery(safeOptions),
            buildVendorPayoutsFallbackQuery(safeOptions),
            [
                (rows) => filterPayoutsByVendorInMemory(rows, safeOptions.vendorUid),
                (rows) => filterPayoutsByStatusesInMemory(rows, safeOptions.statuses, safeOptions.payoutModel),
                (rows) => sortPayoutsInMemory(rows, safeOptions),
                (rows) => applyClientSideLimit(rows, safeOptions.limitCount)
            ]
        );
    }

    async function fetchAdminPayouts(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        if (!safeOptions.firestoreFns || typeof safeOptions.firestoreFns.getDocs !== "function") {
            return [];
        }

        return runWithIndexFallback(
            safeOptions,
            buildAdminPayoutsQuery(safeOptions),
            buildAdminPayoutsFallbackQuery(safeOptions),
            [
                (rows) => filterPayoutsByStatusesInMemory(rows, safeOptions.statuses, safeOptions.payoutModel),
                (rows) => sortPayoutsInMemory(rows, safeOptions),
                (rows) => applyClientSideLimit(rows, safeOptions.limitCount)
            ]
        );
    }

    async function fetchActiveVendorPayouts(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        if (!safeOptions.firestoreFns || typeof safeOptions.firestoreFns.getDocs !== "function") {
            return [];
        }

        const effectiveStatuses = safeOptions.statuses || getDefaultActiveStatuses(safeOptions.payoutModel);
        const optionsWithStatuses = { ...safeOptions, statuses: effectiveStatuses };

        return runWithIndexFallback(
            optionsWithStatuses,
            buildActiveVendorPayoutsQuery(optionsWithStatuses),
            buildVendorPayoutsFallbackQuery(optionsWithStatuses),
            [
                (rows) => filterPayoutsByVendorInMemory(rows, optionsWithStatuses.vendorUid),
                (rows) => filterPayoutsByStatusesInMemory(rows, effectiveStatuses, optionsWithStatuses.payoutModel),
                (rows) => sortPayoutsInMemory(rows, optionsWithStatuses),
                (rows) => applyClientSideLimit(rows, optionsWithStatuses.limitCount)
            ]
        );
    }

    async function fetchBalanceReservingVendorPayouts(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        if (!safeOptions.firestoreFns || typeof safeOptions.firestoreFns.getDocs !== "function") {
            return [];
        }

        const effectiveStatuses = safeOptions.statuses || getBalanceReservingStatuses(safeOptions.payoutModel);
        const optionsWithStatuses = { ...safeOptions, statuses: effectiveStatuses };

        return runWithIndexFallback(
            optionsWithStatuses,
            buildBalanceReservingVendorPayoutsQuery(optionsWithStatuses),
            buildVendorPayoutsFallbackQuery(optionsWithStatuses),
            [
                (rows) => filterPayoutsByVendorInMemory(rows, optionsWithStatuses.vendorUid),
                (rows) => filterPayoutsByStatusesInMemory(rows, effectiveStatuses, optionsWithStatuses.payoutModel),
                (rows) => sortPayoutsInMemory(rows, optionsWithStatuses),
                (rows) => applyClientSideLimit(rows, optionsWithStatuses.limitCount)
            ]
        );
    }

    async function fetchFirstPayoutByStatus(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        if (!safeOptions.firestoreFns || typeof safeOptions.firestoreFns.getDocs !== "function") {
            return null;
        }

        const snapshot = await safeOptions.firestoreFns.getDocs(
            buildPayoutStatusQuery({
                ...safeOptions,
                limitCount: safeOptions.limitCount || 1
            })
        );

        return getFirstPayoutFromSnapshot(snapshot, safeOptions);
    }

    const payoutQueries = {
        MODULE_NAME,
        PAYOUTS_COLLECTION,
        resolvePayoutModel,
        normalizeText,
        normalizeLowerText,
        normalizePositiveInteger,
        createFirestoreConstraint,
        createFirestoreQuery,
        getPayoutsCollectionRef,
        getPayoutDocRef,
        normalizeFilterList,
        normalizeStatusFilters,
        getDefaultActiveStatuses,
        getBalanceReservingStatuses,
        buildEqualityOrInConstraint,
        buildStatusConstraints,
        applyCommonPayoutQueryOptions,
        buildVendorPayoutsQuery,
        buildAdminPayoutsQuery,
        buildActiveVendorPayoutsQuery,
        buildBalanceReservingVendorPayoutsQuery,
        buildPayoutStatusQuery,
        buildVendorPayoutsFallbackQuery,
        buildAdminPayoutsFallbackQuery,
        isMissingIndexError,
        getPayoutSortValue,
        sortPayoutsInMemory,
        filterPayoutsByStatusesInMemory,
        filterPayoutsByVendorInMemory,
        applyClientSideLimit,
        runWithIndexFallback,
        getSnapshotData,
        snapshotExists,
        mapPayoutDocument,
        mapPayoutDocuments,
        getFirstPayoutFromSnapshot,
        fetchPayoutById,
        fetchVendorPayouts,
        fetchAdminPayouts,
        fetchActiveVendorPayouts,
        fetchBalanceReservingVendorPayouts,
        fetchFirstPayoutByStatus
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = payoutQueries;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.payoutQueries = payoutQueries;
    }
})(typeof window !== "undefined" ? window : globalThis);
