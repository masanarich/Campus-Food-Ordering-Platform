(function attachOrderRealtime(globalScope) {
    "use strict";

    const MODULE_NAME = "order-realtime";

    function resolveOrderQueries(explicitOrderQueries) {
        if (
            explicitOrderQueries &&
            typeof explicitOrderQueries.getOrderDocRef === "function" &&
            typeof explicitOrderQueries.buildCustomerOrdersQuery === "function" &&
            typeof explicitOrderQueries.buildVendorOrdersQuery === "function" &&
            typeof explicitOrderQueries.buildNotificationsQuery === "function"
        ) {
            return explicitOrderQueries;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.orderQueries &&
            typeof globalScope.orderQueries.getOrderDocRef === "function" &&
            typeof globalScope.orderQueries.buildCustomerOrdersQuery === "function" &&
            typeof globalScope.orderQueries.buildVendorOrdersQuery === "function" &&
            typeof globalScope.orderQueries.buildNotificationsQuery === "function"
        ) {
            return globalScope.orderQueries;
        }

        if (typeof require === "function") {
            try {
                const requiredOrderQueries = require("./order-queries.js");

                if (
                    requiredOrderQueries &&
                    typeof requiredOrderQueries.getOrderDocRef === "function" &&
                    typeof requiredOrderQueries.buildCustomerOrdersQuery === "function" &&
                    typeof requiredOrderQueries.buildVendorOrdersQuery === "function" &&
                    typeof requiredOrderQueries.buildNotificationsQuery === "function"
                ) {
                    return requiredOrderQueries;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

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

    function createRealtimeError(code, message, details = {}) {
        const safeDetails = details && typeof details === "object" ? details : {};

        return {
            code: normalizeText(code) || "orders/realtime-error",
            message: normalizeText(message) || "Something went wrong while subscribing to realtime order updates.",
            ...safeDetails
        };
    }

    function createNoopUnsubscribe() {
        return function noopUnsubscribe() {
            return false;
        };
    }

    function createSafeUnsubscribe(unsubscribeFn) {
        let alreadyClosed = false;

        return function safeUnsubscribe() {
            if (alreadyClosed) {
                return false;
            }

            alreadyClosed = true;

            if (typeof unsubscribeFn === "function") {
                return unsubscribeFn() !== false;
            }

            return false;
        };
    }

    function combineUnsubscribers(unsubscribers) {
        const safeList = (Array.isArray(unsubscribers) ? unsubscribers : [unsubscribers])
            .filter(function keepFunctions(unsubscribeFn) {
                return typeof unsubscribeFn === "function";
            })
            .map(function wrapOne(unsubscribeFn) {
                return createSafeUnsubscribe(unsubscribeFn);
            });

        return function unsubscribeAll() {
            return safeList.reduce(function countClosed(total, unsubscribeFn) {
                return total + (unsubscribeFn() === true ? 1 : 0);
            }, 0);
        };
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

    function normalizeSnapshotMetadata(snapshot) {
        const metadata = snapshot && snapshot.metadata && typeof snapshot.metadata === "object"
            ? snapshot.metadata
            : {};

        return {
            fromCache: metadata.fromCache === true,
            hasPendingWrites: metadata.hasPendingWrites === true
        };
    }

    function fallbackMapOrderDocument(snapshot, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderModel = resolveOrderModel(safeOptions.orderModel);
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);

        if (!snapshotExists(snapshot)) {
            return null;
        }

        const rawData = getSnapshotData(snapshot);
        const fallbackStatus = orderStatus && typeof orderStatus.getDefaultOrderStatus === "function"
            ? orderStatus.getDefaultOrderStatus()
            : "pending";
        const rawRecord = {
            orderId: normalizeText(snapshot.id || rawData.orderId),
            ...rawData
        };

        if (orderModel) {
            return orderModel.normalizeOrderRecord(rawRecord, { orderStatus });
        }

        return {
            ...rawRecord,
            status: orderStatus
                ? orderStatus.normalizeOrderStatus(rawRecord.status, fallbackStatus)
                : normalizeLowerText(rawRecord.status) || fallbackStatus
        };
    }

    function fallbackMapOrderDocuments(querySnapshot, options = {}) {
        const docs = querySnapshot && Array.isArray(querySnapshot.docs)
            ? querySnapshot.docs
            : [];

        return docs
            .map(function mapOneDoc(docSnapshot) {
                return fallbackMapOrderDocument(docSnapshot, options);
            })
            .filter(Boolean);
    }

    function fallbackMapNotificationDocument(snapshot) {
        if (!snapshotExists(snapshot)) {
            return null;
        }

        const rawData = getSnapshotData(snapshot);

        return {
            notificationId: normalizeText(snapshot.id || rawData.notificationId),
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

    function fallbackMapNotificationDocuments(querySnapshot) {
        const docs = querySnapshot && Array.isArray(querySnapshot.docs)
            ? querySnapshot.docs
            : [];

        return docs
            .map(function mapOneDoc(docSnapshot) {
                return fallbackMapNotificationDocument(docSnapshot);
            })
            .filter(Boolean);
    }

    function mapRealtimeSnapshot(snapshot, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const kind = normalizeLowerText(safeOptions.kind);
        const orderQueries = resolveOrderQueries(safeOptions.orderQueries);

        if (typeof safeOptions.mapSnapshot === "function") {
            return safeOptions.mapSnapshot(snapshot);
        }

        if (kind === "order") {
            if (orderQueries && typeof orderQueries.mapOrderDocument === "function") {
                return orderQueries.mapOrderDocument(snapshot, safeOptions);
            }

            return fallbackMapOrderDocument(snapshot, safeOptions);
        }

        if (kind === "customer_orders" || kind === "vendor_orders") {
            if (orderQueries && typeof orderQueries.mapOrderDocuments === "function") {
                return orderQueries.mapOrderDocuments(snapshot, safeOptions);
            }

            return fallbackMapOrderDocuments(snapshot, safeOptions);
        }

        if (kind === "notifications") {
            if (orderQueries && typeof orderQueries.mapNotificationDocuments === "function") {
                return orderQueries.mapNotificationDocuments(snapshot);
            }

            return fallbackMapNotificationDocuments(snapshot);
        }

        return snapshot;
    }

    function emitSubscriptionError(listener, code, message, details = {}) {
        if (typeof listener === "function") {
            listener(createRealtimeError(code, message, details));
        }
    }

    function subscribeToSnapshot(target, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const firestoreFns = safeOptions.firestoreFns || {};
        const onData = typeof safeOptions.onData === "function"
            ? safeOptions.onData
            : (
                typeof safeOptions.onChange === "function"
                    ? safeOptions.onChange
                    : null
            );
        const onError = typeof safeOptions.onError === "function"
            ? safeOptions.onError
            : null;

        function handleSnapshot(snapshot) {
            try {
                const data = mapRealtimeSnapshot(snapshot, safeOptions);
                const payload = {
                    kind: normalizeLowerText(safeOptions.kind),
                    data,
                    metadata: normalizeSnapshotMetadata(snapshot),
                    snapshot,
                    target
                };

                if (onData) {
                    onData(data, payload);
                }
            } catch (error) {
                emitSubscriptionError(
                    onError,
                    "orders/realtime-map-failed",
                    "Could not map realtime snapshot data.",
                    {
                        cause: error,
                        kind: normalizeLowerText(safeOptions.kind)
                    }
                );
            }
        }

        function handleError(error) {
            if (typeof onError === "function") {
                onError(
                    createRealtimeError(
                        safeOptions.errorCode,
                        safeOptions.errorMessage,
                        {
                            cause: error,
                            kind: normalizeLowerText(safeOptions.kind)
                        }
                    )
                );
            }
        }

        if (!target) {
            emitSubscriptionError(
                onError,
                "orders/realtime-invalid-target",
                safeOptions.invalidTargetMessage || "A realtime target is required before subscribing.",
                {
                    kind: normalizeLowerText(safeOptions.kind)
                }
            );

            return createNoopUnsubscribe();
        }

        if (typeof firestoreFns.onSnapshot === "function") {
            try {
                const unsubscribe = safeOptions.includeMetadataChanges === true
                    ? firestoreFns.onSnapshot(
                        target,
                        { includeMetadataChanges: true },
                        handleSnapshot,
                        handleError
                    )
                    : firestoreFns.onSnapshot(target, handleSnapshot, handleError);

                return createSafeUnsubscribe(unsubscribe);
            } catch (error) {
                handleError(error);
                return createNoopUnsubscribe();
            }
        }

        if (typeof safeOptions.fetcher === "function") {
            Promise.resolve()
                .then(function fetchOnce() {
                    return safeOptions.fetcher(target);
                })
                .then(handleSnapshot)
                .catch(handleError);
        }

        return createNoopUnsubscribe();
    }

    function subscribeToOrder(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderId = normalizeText(safeOptions.orderId);
        const orderQueries = resolveOrderQueries(safeOptions.orderQueries);
        const onError = typeof safeOptions.onError === "function"
            ? safeOptions.onError
            : null;

        if (!orderId) {
            emitSubscriptionError(
                onError,
                "orders/realtime-invalid-order-id",
                "A valid order ID is required for realtime order tracking."
            );

            return createNoopUnsubscribe();
        }

        const target = orderQueries && typeof orderQueries.getOrderDocRef === "function"
            ? orderQueries.getOrderDocRef(safeOptions.db, orderId, safeOptions.firestoreFns)
            : null;

        return subscribeToSnapshot(target, {
            ...safeOptions,
            kind: "order",
            orderQueries,
            fetcher: typeof safeOptions.firestoreFns?.getDoc === "function"
                ? function fetchOrder(docRef) {
                    return safeOptions.firestoreFns.getDoc(docRef);
                }
                : null,
            errorCode: "orders/realtime-order-subscribe-failed",
            errorMessage: "Could not subscribe to realtime order updates.",
            invalidTargetMessage: "A valid realtime order reference is required."
        });
    }

    function subscribeToCustomerOrders(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const customerUid = normalizeText(safeOptions.customerUid);
        const orderQueries = resolveOrderQueries(safeOptions.orderQueries);
        const onError = typeof safeOptions.onError === "function"
            ? safeOptions.onError
            : null;

        if (!customerUid) {
            emitSubscriptionError(
                onError,
                "orders/realtime-invalid-customer",
                "A valid customer UID is required for realtime customer orders."
            );

            return createNoopUnsubscribe();
        }

        const target = orderQueries && typeof orderQueries.buildCustomerOrdersQuery === "function"
            ? orderQueries.buildCustomerOrdersQuery({
                ...safeOptions,
                customerUid
            })
            : null;

        return subscribeToSnapshot(target, {
            ...safeOptions,
            customerUid,
            kind: "customer_orders",
            orderQueries,
            fetcher: typeof safeOptions.firestoreFns?.getDocs === "function"
                ? function fetchOrders(queryRef) {
                    return safeOptions.firestoreFns.getDocs(queryRef);
                }
                : null,
            errorCode: "orders/realtime-customer-orders-subscribe-failed",
            errorMessage: "Could not subscribe to realtime customer orders.",
            invalidTargetMessage: "A valid customer orders query is required."
        });
    }

    function subscribeToVendorOrders(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const vendorUid = normalizeText(safeOptions.vendorUid);
        const orderQueries = resolveOrderQueries(safeOptions.orderQueries);
        const onError = typeof safeOptions.onError === "function"
            ? safeOptions.onError
            : null;

        if (!vendorUid) {
            emitSubscriptionError(
                onError,
                "orders/realtime-invalid-vendor",
                "A valid vendor UID is required for realtime vendor orders."
            );

            return createNoopUnsubscribe();
        }

        const target = orderQueries && typeof orderQueries.buildVendorOrdersQuery === "function"
            ? orderQueries.buildVendorOrdersQuery({
                ...safeOptions,
                vendorUid
            })
            : null;

        return subscribeToSnapshot(target, {
            ...safeOptions,
            vendorUid,
            kind: "vendor_orders",
            orderQueries,
            fetcher: typeof safeOptions.firestoreFns?.getDocs === "function"
                ? function fetchOrders(queryRef) {
                    return safeOptions.firestoreFns.getDocs(queryRef);
                }
                : null,
            errorCode: "orders/realtime-vendor-orders-subscribe-failed",
            errorMessage: "Could not subscribe to realtime vendor orders.",
            invalidTargetMessage: "A valid vendor orders query is required."
        });
    }

    function subscribeToNotifications(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const recipientUid = normalizeText(safeOptions.recipientUid);
        const orderQueries = resolveOrderQueries(safeOptions.orderQueries);
        const onError = typeof safeOptions.onError === "function"
            ? safeOptions.onError
            : null;

        if (!recipientUid) {
            emitSubscriptionError(
                onError,
                "orders/realtime-invalid-recipient",
                "A valid notification recipient UID is required for realtime notifications."
            );

            return createNoopUnsubscribe();
        }

        const target = orderQueries && typeof orderQueries.buildNotificationsQuery === "function"
            ? orderQueries.buildNotificationsQuery({
                ...safeOptions,
                recipientUid
            })
            : null;

        return subscribeToSnapshot(target, {
            ...safeOptions,
            recipientUid,
            kind: "notifications",
            orderQueries,
            fetcher: typeof safeOptions.firestoreFns?.getDocs === "function"
                ? function fetchNotifications(queryRef) {
                    return safeOptions.firestoreFns.getDocs(queryRef);
                }
                : null,
            errorCode: "orders/realtime-notifications-subscribe-failed",
            errorMessage: "Could not subscribe to realtime order notifications.",
            invalidTargetMessage: "A valid notifications query is required."
        });
    }

    const orderRealtime = {
        MODULE_NAME,
        resolveOrderQueries,
        resolveOrderModel,
        resolveOrderStatus,
        normalizeText,
        normalizeLowerText,
        createRealtimeError,
        createNoopUnsubscribe,
        createSafeUnsubscribe,
        combineUnsubscribers,
        getSnapshotData,
        snapshotExists,
        normalizeSnapshotMetadata,
        fallbackMapOrderDocument,
        fallbackMapOrderDocuments,
        fallbackMapNotificationDocument,
        fallbackMapNotificationDocuments,
        mapRealtimeSnapshot,
        subscribeToSnapshot,
        subscribeToOrder,
        subscribeToCustomerOrders,
        subscribeToVendorOrders,
        subscribeToNotifications
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = orderRealtime;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.orderRealtime = orderRealtime;
    }
})(typeof window !== "undefined" ? window : globalThis);
