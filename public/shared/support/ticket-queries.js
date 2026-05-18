(function attachTicketQueries(globalScope) {
    "use strict";

    const MODULE_NAME = "ticket-queries";
    const SUPPORT_TICKETS_COLLECTION = "supportTickets";
    const REPLIES_SUBCOLLECTION = "replies";

    function resolveTicketModel(explicitTicketModel) {
        if (
            explicitTicketModel &&
            typeof explicitTicketModel.normalizeTicketRecord === "function"
        ) {
            return explicitTicketModel;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.ticketModel &&
            typeof globalScope.ticketModel.normalizeTicketRecord === "function"
        ) {
            return globalScope.ticketModel;
        }

        if (typeof require === "function") {
            try {
                const requiredTicketModel = require("./ticket-model.js");

                if (
                    requiredTicketModel &&
                    typeof requiredTicketModel.normalizeTicketRecord === "function"
                ) {
                    return requiredTicketModel;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveTicketStatus(explicitTicketStatus) {
        if (
            explicitTicketStatus &&
            typeof explicitTicketStatus.normalizeTicketStatus === "function"
        ) {
            return explicitTicketStatus;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.ticketStatus &&
            typeof globalScope.ticketStatus.normalizeTicketStatus === "function"
        ) {
            return globalScope.ticketStatus;
        }

        if (typeof require === "function") {
            try {
                const requiredTicketStatus = require("./ticket-status.js");

                if (
                    requiredTicketStatus &&
                    typeof requiredTicketStatus.normalizeTicketStatus === "function"
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
            typeof explicitTicketCategories.normalizeTicketCategory === "function"
        ) {
            return explicitTicketCategories;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.ticketCategories &&
            typeof globalScope.ticketCategories.normalizeTicketCategory === "function"
        ) {
            return globalScope.ticketCategories;
        }

        if (typeof require === "function") {
            try {
                const requiredTicketCategories = require("./ticket-categories.js");

                if (
                    requiredTicketCategories &&
                    typeof requiredTicketCategories.normalizeTicketCategory === "function"
                ) {
                    return requiredTicketCategories;
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

    function getTicketsCollectionRef(db, firestoreFns) {
        return firestoreFns.collection(db, SUPPORT_TICKETS_COLLECTION);
    }

    function getTicketDocRef(db, ticketId, firestoreFns) {
        return firestoreFns.doc(db, SUPPORT_TICKETS_COLLECTION, normalizeText(ticketId));
    }

    function getRepliesCollectionRef(db, ticketId, firestoreFns) {
        return firestoreFns.collection(
            db,
            SUPPORT_TICKETS_COLLECTION,
            normalizeText(ticketId),
            REPLIES_SUBCOLLECTION
        );
    }

    function getReplyDocRef(db, ticketId, replyId, firestoreFns) {
        return firestoreFns.doc(
            db,
            SUPPORT_TICKETS_COLLECTION,
            normalizeText(ticketId),
            REPLIES_SUBCOLLECTION,
            normalizeText(replyId)
        );
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
            .map(function applyNormalizer(value) {
                return normalize(value);
            })
            .filter(Boolean)
            .filter(function keepUnique(value, index, list) {
                return list.indexOf(value) === index;
            });
    }

    function normalizeStatusFilters(statusFilters, explicitTicketStatus) {
        const ticketStatus = resolveTicketStatus(explicitTicketStatus);

        if (!ticketStatus) {
            return normalizeFilterList(statusFilters);
        }

        return normalizeFilterList(statusFilters, function normalizeOneStatus(value) {
            return ticketStatus.normalizeTicketStatus(value);
        });
    }

    function normalizeCategoryFilters(categoryFilters, explicitTicketCategories) {
        const ticketCategories = resolveTicketCategories(explicitTicketCategories);

        if (!ticketCategories) {
            return normalizeFilterList(categoryFilters);
        }

        return normalizeFilterList(categoryFilters, function normalizeOneCategory(value) {
            return ticketCategories.normalizeTicketCategory(value);
        });
    }

    function normalizeReporterRoleFilters(roleFilters) {
        const validRoles = ["customer", "vendor"];

        return normalizeFilterList(roleFilters).filter(function keepKnown(role) {
            return validRoles.indexOf(role) !== -1;
        });
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

    function buildStatusConstraints(statusFilters, firestoreFns, explicitTicketStatus) {
        const normalized = normalizeStatusFilters(statusFilters, explicitTicketStatus);
        const constraint = buildEqualityOrInConstraint("status", normalized, firestoreFns);

        return constraint ? [constraint] : [];
    }

    function buildCategoryConstraints(categoryFilters, firestoreFns, explicitTicketCategories) {
        const normalized = normalizeCategoryFilters(categoryFilters, explicitTicketCategories);
        const constraint = buildEqualityOrInConstraint("category", normalized, firestoreFns);

        return constraint ? [constraint] : [];
    }

    function buildReporterRoleConstraints(roleFilters, firestoreFns) {
        const normalized = normalizeReporterRoleFilters(roleFilters);
        const constraint = buildEqualityOrInConstraint("reporterRole", normalized, firestoreFns);

        return constraint ? [constraint] : [];
    }

    function buildReporterTicketsQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const reporterUid = normalizeText(safeOptions.reporterUid);
        const constraints = [
            createFirestoreConstraint(
                "where",
                ["reporterUid", "==", reporterUid],
                safeOptions.firestoreFns
            ),
            ...buildStatusConstraints(
                safeOptions.statuses,
                safeOptions.firestoreFns,
                safeOptions.ticketStatus
            ),
            createFirestoreConstraint("orderBy", ["updatedAt", "desc"], safeOptions.firestoreFns),
            createFirestoreConstraint("orderBy", ["createdAt", "desc"], safeOptions.firestoreFns)
        ];

        const limitCount = normalizePositiveInteger(safeOptions.limitCount, 0);

        if (limitCount > 0) {
            constraints.push(
                createFirestoreConstraint("limit", [limitCount], safeOptions.firestoreFns)
            );
        }

        return createFirestoreQuery(
            getTicketsCollectionRef(safeOptions.db, safeOptions.firestoreFns),
            constraints,
            safeOptions.firestoreFns
        );
    }

    function buildAdminTicketsQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const constraints = [];

        constraints.push(...buildStatusConstraints(
            safeOptions.statuses,
            safeOptions.firestoreFns,
            safeOptions.ticketStatus
        ));

        constraints.push(...buildCategoryConstraints(
            safeOptions.categories,
            safeOptions.firestoreFns,
            safeOptions.ticketCategories
        ));

        constraints.push(...buildReporterRoleConstraints(
            safeOptions.reporterRoles,
            safeOptions.firestoreFns
        ));

        const vendorUid = normalizeText(safeOptions.vendorUid);
        if (vendorUid) {
            constraints.push(
                createFirestoreConstraint("where", ["vendorUid", "==", vendorUid], safeOptions.firestoreFns)
            );
        }

        const customerUid = normalizeText(safeOptions.customerUid);
        if (customerUid) {
            constraints.push(
                createFirestoreConstraint("where", ["customerUid", "==", customerUid], safeOptions.firestoreFns)
            );
        }

        const orderId = normalizeText(safeOptions.orderId);
        if (orderId) {
            constraints.push(
                createFirestoreConstraint("where", ["orderId", "==", orderId], safeOptions.firestoreFns)
            );
        }

        constraints.push(
            createFirestoreConstraint("orderBy", ["updatedAt", "desc"], safeOptions.firestoreFns)
        );
        constraints.push(
            createFirestoreConstraint("orderBy", ["createdAt", "desc"], safeOptions.firestoreFns)
        );

        const limitCount = normalizePositiveInteger(safeOptions.limitCount, 0);

        if (limitCount > 0) {
            constraints.push(
                createFirestoreConstraint("limit", [limitCount], safeOptions.firestoreFns)
            );
        }

        return createFirestoreQuery(
            getTicketsCollectionRef(safeOptions.db, safeOptions.firestoreFns),
            constraints,
            safeOptions.firestoreFns
        );
    }

    function buildRepliesQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketId = normalizeText(safeOptions.ticketId);
        const constraints = [];

        if (safeOptions.includeInternalNotes === false) {
            constraints.push(
                createFirestoreConstraint("where", ["isInternalNote", "==", false], safeOptions.firestoreFns)
            );
        }

        constraints.push(
            createFirestoreConstraint("orderBy", ["createdAt", "asc"], safeOptions.firestoreFns)
        );

        const limitCount = normalizePositiveInteger(safeOptions.limitCount, 0);

        if (limitCount > 0) {
            constraints.push(
                createFirestoreConstraint("limit", [limitCount], safeOptions.firestoreFns)
            );
        }

        return createFirestoreQuery(
            getRepliesCollectionRef(safeOptions.db, ticketId, safeOptions.firestoreFns),
            constraints,
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

    function mapTicketDocument(snapshot, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketModel = resolveTicketModel(safeOptions.ticketModel);

        if (!snapshotExists(snapshot)) {
            return null;
        }

        const rawData = getSnapshotData(snapshot);
        const rawRecord = {
            ticketId: normalizeText(snapshot.id),
            ...rawData
        };

        if (ticketModel) {
            return ticketModel.normalizeTicketRecord(rawRecord, {
                ticketStatus: safeOptions.ticketStatus,
                ticketCategories: safeOptions.ticketCategories
            });
        }

        return rawRecord;
    }

    function mapTicketDocuments(querySnapshot, options = {}) {
        const docs = querySnapshot && Array.isArray(querySnapshot.docs)
            ? querySnapshot.docs
            : [];

        return docs
            .map(function mapOneTicket(docSnapshot) {
                return mapTicketDocument(docSnapshot, options);
            })
            .filter(Boolean);
    }

    function mapReplyDocument(snapshot, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const ticketModel = resolveTicketModel(safeOptions.ticketModel);

        if (!snapshotExists(snapshot)) {
            return null;
        }

        const rawData = getSnapshotData(snapshot);
        const rawReply = {
            replyId: normalizeText(snapshot.id),
            ticketId: normalizeText(safeOptions.ticketId || rawData.ticketId),
            ...rawData
        };

        if (ticketModel && typeof ticketModel.createReplyRecord === "function") {
            return ticketModel.createReplyRecord(rawReply);
        }

        return rawReply;
    }

    function mapReplyDocuments(querySnapshot, options = {}) {
        const docs = querySnapshot && Array.isArray(querySnapshot.docs)
            ? querySnapshot.docs
            : [];

        return docs
            .map(function mapOneReply(docSnapshot) {
                return mapReplyDocument(docSnapshot, options);
            })
            .filter(Boolean);
    }

    async function fetchTicketById(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const snapshot = await safeOptions.firestoreFns.getDoc(
            getTicketDocRef(safeOptions.db, safeOptions.ticketId, safeOptions.firestoreFns)
        );

        return mapTicketDocument(snapshot, safeOptions);
    }

    async function fetchReporterTickets(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const snapshot = await safeOptions.firestoreFns.getDocs(
            buildReporterTicketsQuery(safeOptions)
        );

        return mapTicketDocuments(snapshot, safeOptions);
    }

    async function fetchAdminTickets(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const snapshot = await safeOptions.firestoreFns.getDocs(
            buildAdminTicketsQuery(safeOptions)
        );

        return mapTicketDocuments(snapshot, safeOptions);
    }

    async function fetchTicketReplies(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const snapshot = await safeOptions.firestoreFns.getDocs(
            buildRepliesQuery(safeOptions)
        );

        return mapReplyDocuments(snapshot, safeOptions);
    }

    const ticketQueries = {
        MODULE_NAME,
        SUPPORT_TICKETS_COLLECTION,
        REPLIES_SUBCOLLECTION,
        resolveTicketModel,
        resolveTicketStatus,
        resolveTicketCategories,
        normalizeText,
        normalizeLowerText,
        normalizePositiveInteger,
        createFirestoreConstraint,
        createFirestoreQuery,
        getTicketsCollectionRef,
        getTicketDocRef,
        getRepliesCollectionRef,
        getReplyDocRef,
        normalizeFilterList,
        normalizeStatusFilters,
        normalizeCategoryFilters,
        normalizeReporterRoleFilters,
        buildEqualityOrInConstraint,
        buildStatusConstraints,
        buildCategoryConstraints,
        buildReporterRoleConstraints,
        buildReporterTicketsQuery,
        buildAdminTicketsQuery,
        buildRepliesQuery,
        getSnapshotData,
        snapshotExists,
        mapTicketDocument,
        mapTicketDocuments,
        mapReplyDocument,
        mapReplyDocuments,
        fetchTicketById,
        fetchReporterTickets,
        fetchAdminTickets,
        fetchTicketReplies
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = ticketQueries;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.ticketQueries = ticketQueries;
    }
})(typeof window !== "undefined" ? window : globalThis);
