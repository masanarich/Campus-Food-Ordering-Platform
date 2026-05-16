(function attachOrderQueries(globalScope) {
    "use strict";

    const MODULE_NAME = "order-queries";

    function resolveOrderModel(explicitOrderModel) {
        if (
            explicitOrderModel &&
            typeof explicitOrderModel.normalizeOrderRecord === "function"
        ) {
            return explicitOrderModel;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.orderModel &&
            typeof globalScope.orderModel.normalizeOrderRecord === "function"
        ) {
            return globalScope.orderModel;
        }

        if (typeof require === "function") {
            try {
                const requiredOrderModel = require("./order-model.js");

                if (
                    requiredOrderModel &&
                    typeof requiredOrderModel.normalizeOrderRecord === "function"
                ) {
                    return requiredOrderModel;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveOrderStatus(explicitOrderStatus) {
        if (
            explicitOrderStatus &&
            typeof explicitOrderStatus.normalizeOrderStatus === "function"
        ) {
            return explicitOrderStatus;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.orderStatus &&
            typeof globalScope.orderStatus.normalizeOrderStatus === "function"
        ) {
            return globalScope.orderStatus;
        }

        if (typeof require === "function") {
            try {
                const requiredOrderStatus = require("./order-status.js");

                if (
                    requiredOrderStatus &&
                    typeof requiredOrderStatus.normalizeOrderStatus === "function"
                ) {
                    return requiredOrderStatus;
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

        if (
            firestoreFns &&
            typeof firestoreFns[factoryName] === "function"
        ) {
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

        if (
            firestoreFns &&
            typeof firestoreFns.query === "function"
        ) {
            return firestoreFns.query(collectionRef, ...safeConstraints);
        }

        return {
            collectionRef,
            constraints: safeConstraints
        };
    }

    function getOrdersCollectionRef(db, firestoreFns) {
        return firestoreFns.collection(db, "orders");
    }

    function getOrderDocRef(db, orderId, firestoreFns) {
        return firestoreFns.doc(db, "orders", normalizeText(orderId));
    }

    function getNotificationsCollectionRef(db, firestoreFns) {
        return firestoreFns.collection(db, "notifications");
    }

    function getNotificationDocRef(db, notificationId, firestoreFns) {
        return firestoreFns.doc(db, "notifications", normalizeText(notificationId));
    }

    function getVendorMenuCollectionRef(db, vendorUid, firestoreFns) {
        return firestoreFns.collection(db, "users", normalizeText(vendorUid), "menuItems");
    }

    function getVendorMenuDocRef(db, vendorUid, menuItemId, firestoreFns) {
        return firestoreFns.doc(
            db,
            "users",
            normalizeText(vendorUid),
            "menuItems",
            normalizeText(menuItemId)
        );
    }

    function normalizeStatusFilters(statusFilters, explicitOrderStatus) {
        const orderStatus = resolveOrderStatus(explicitOrderStatus);
        const sourceList = Array.isArray(statusFilters)
            ? statusFilters
            : (statusFilters ? [statusFilters] : []);

        if (!orderStatus) {
            return sourceList
                .map(function normalizeOneStatus(status) {
                    return normalizeLowerText(status);
                })
                .filter(Boolean)
                .filter(function keepUnique(status, index, list) {
                    return list.indexOf(status) === index;
                });
        }

        return sourceList
            .map(function normalizeOneStatus(status) {
                return orderStatus.normalizeOrderStatus(status);
            })
            .filter(Boolean)
            .filter(function keepUnique(status, index, list) {
                return list.indexOf(status) === index;
            });
    }

    function buildStatusConstraints(statusFilters, firestoreFns, explicitOrderStatus) {
        const normalizedStatuses = normalizeStatusFilters(statusFilters, explicitOrderStatus);

        if (normalizedStatuses.length === 0) {
            return [];
        }

        if (normalizedStatuses.length === 1) {
            return [
                createFirestoreConstraint(
                    "where",
                    ["status", "==", normalizedStatuses[0]],
                    firestoreFns
                )
            ];
        }

        return [
            createFirestoreConstraint(
                "where",
                ["status", "in", normalizedStatuses],
                firestoreFns
            )
        ];
    }

    function buildCustomerOrdersQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const customerUid = normalizeText(safeOptions.customerUid);
        const constraints = [
            createFirestoreConstraint("where", ["customerUid", "==", customerUid], safeOptions.firestoreFns),
            ...buildStatusConstraints(safeOptions.statuses, safeOptions.firestoreFns, safeOptions.orderStatus),
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
            getOrdersCollectionRef(safeOptions.db, safeOptions.firestoreFns),
            constraints,
            safeOptions.firestoreFns
        );
    }

    function buildVendorOrdersQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const vendorUid = normalizeText(safeOptions.vendorUid);
        const constraints = [
            createFirestoreConstraint("where", ["vendorUid", "==", vendorUid], safeOptions.firestoreFns),
            ...buildStatusConstraints(safeOptions.statuses, safeOptions.firestoreFns, safeOptions.orderStatus),
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
            getOrdersCollectionRef(safeOptions.db, safeOptions.firestoreFns),
            constraints,
            safeOptions.firestoreFns
        );
    }

    function buildNotificationsQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const recipientUid = normalizeText(safeOptions.recipientUid);
        const constraints = [
            createFirestoreConstraint("where", ["recipientUid", "==", recipientUid], safeOptions.firestoreFns)
        ];

        if (safeOptions.read === true || safeOptions.read === false) {
            constraints.push(
                createFirestoreConstraint("where", ["read", "==", safeOptions.read], safeOptions.firestoreFns)
            );
        }

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
            getNotificationsCollectionRef(safeOptions.db, safeOptions.firestoreFns),
            constraints,
            safeOptions.firestoreFns
        );
    }

    function buildVendorMenuItemsQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const constraints = [];

        if (safeOptions.availableOnly === true) {
            constraints.push(
                createFirestoreConstraint("where", ["availability", "==", "available"], safeOptions.firestoreFns)
            );
        }

        if (safeOptions.excludeSoldOut === true) {
            constraints.push(
                createFirestoreConstraint("where", ["soldOut", "==", false], safeOptions.firestoreFns)
            );
        }

        constraints.push(
            createFirestoreConstraint("orderBy", ["updatedAt", "desc"], safeOptions.firestoreFns)
        );

        const limitCount = normalizePositiveInteger(safeOptions.limitCount, 0);

        if (limitCount > 0) {
            constraints.push(
                createFirestoreConstraint("limit", [limitCount], safeOptions.firestoreFns)
            );
        }

        return createFirestoreQuery(
            getVendorMenuCollectionRef(
                safeOptions.db,
                safeOptions.vendorUid,
                safeOptions.firestoreFns
            ),
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

    function mapOrderDocument(snapshot, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderModel = resolveOrderModel(safeOptions.orderModel);

        if (!snapshotExists(snapshot)) {
            return null;
        }

        const rawData = getSnapshotData(snapshot);
        const rawRecord = {
            orderId: normalizeText(snapshot.id),
            ...rawData
        };

        if (orderModel) {
            return orderModel.normalizeOrderRecord(rawRecord, {
                orderStatus: safeOptions.orderStatus
            });
        }

        return rawRecord;
    }

    function mapOrderDocuments(querySnapshot, options = {}) {
        const docs = querySnapshot && Array.isArray(querySnapshot.docs)
            ? querySnapshot.docs
            : [];

        return docs
            .map(function mapOneDoc(docSnapshot) {
                return mapOrderDocument(docSnapshot, options);
            })
            .filter(Boolean);
    }

    function mapNotificationDocument(snapshot) {
        if (!snapshotExists(snapshot)) {
            return null;
        }

        const rawData = getSnapshotData(snapshot);

        return {
            notificationId: normalizeText(snapshot.id),
            recipientUid: normalizeText(rawData.recipientUid),
            recipientRole: normalizeLowerText(rawData.recipientRole),
            orderId: normalizeText(rawData.orderId),
            type: normalizeText(rawData.type),
            title: normalizeText(rawData.title),
            message: normalizeText(rawData.message),
            read: rawData.read === true,
            createdAt: rawData.createdAt !== undefined ? rawData.createdAt : null
        };
    }

    function mapNotificationDocuments(querySnapshot) {
        const docs = querySnapshot && Array.isArray(querySnapshot.docs)
            ? querySnapshot.docs
            : [];

        return docs
            .map(function mapOneNotification(docSnapshot) {
                return mapNotificationDocument(docSnapshot);
            })
            .filter(Boolean);
    }

    function mapMenuItemDocument(snapshot) {
        if (!snapshotExists(snapshot)) {
            return null;
        }

        const rawData = getSnapshotData(snapshot);

        return {
            menuItemId: normalizeText(snapshot.id),
            vendorUid: normalizeText(rawData.vendorUid),
            name: normalizeText(rawData.name),
            category: normalizeText(rawData.category),
            description: normalizeText(rawData.description),
            price: Number.isFinite(Number(rawData.price)) ? Number(rawData.price) : 0,
            availability: normalizeLowerText(rawData.availability) || "available",
            soldOut: rawData.soldOut === true,
            photoURL: normalizeText(rawData.photoURL || rawData.photoUrl)
        };
    }

    function mapMenuItemDocuments(querySnapshot) {
        const docs = querySnapshot && Array.isArray(querySnapshot.docs)
            ? querySnapshot.docs
            : [];

        return docs
            .map(function mapOneMenuItem(docSnapshot) {
                return mapMenuItemDocument(docSnapshot);
            })
            .filter(Boolean);
    }

    async function fetchOrderById(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const snapshot = await safeOptions.firestoreFns.getDoc(
            getOrderDocRef(safeOptions.db, safeOptions.orderId, safeOptions.firestoreFns)
        );

        return mapOrderDocument(snapshot, safeOptions);
    }

    async function fetchCustomerOrders(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const snapshot = await safeOptions.firestoreFns.getDocs(
            buildCustomerOrdersQuery(safeOptions)
        );

        return mapOrderDocuments(snapshot, safeOptions);
    }

    async function fetchVendorOrders(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const snapshot = await safeOptions.firestoreFns.getDocs(
            buildVendorOrdersQuery(safeOptions)
        );

        return mapOrderDocuments(snapshot, safeOptions);
    }

    async function fetchNotifications(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const snapshot = await safeOptions.firestoreFns.getDocs(
            buildNotificationsQuery(safeOptions)
        );

        return mapNotificationDocuments(snapshot);
    }

    async function fetchVendorMenuItems(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const snapshot = await safeOptions.firestoreFns.getDocs(
            buildVendorMenuItemsQuery(safeOptions)
        );

        return mapMenuItemDocuments(snapshot);
    }

    const orderQueries = {
        MODULE_NAME,
        resolveOrderModel,
        resolveOrderStatus,
        normalizeText,
        normalizeLowerText,
        normalizePositiveInteger,
        createFirestoreConstraint,
        createFirestoreQuery,
        getOrdersCollectionRef,
        getOrderDocRef,
        getNotificationsCollectionRef,
        getNotificationDocRef,
        getVendorMenuCollectionRef,
        getVendorMenuDocRef,
        normalizeStatusFilters,
        buildStatusConstraints,
        buildCustomerOrdersQuery,
        buildVendorOrdersQuery,
        buildNotificationsQuery,
        buildVendorMenuItemsQuery,
        mapOrderDocument,
        mapOrderDocuments,
        mapNotificationDocument,
        mapNotificationDocuments,
        mapMenuItemDocument,
        mapMenuItemDocuments,
        fetchOrderById,
        fetchCustomerOrders,
        fetchVendorOrders,
        fetchNotifications,
        fetchVendorMenuItems
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = orderQueries;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.orderQueries = orderQueries;
    }
})(typeof window !== "undefined" ? window : globalThis);
