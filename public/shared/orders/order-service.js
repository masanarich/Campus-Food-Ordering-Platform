(function attachOrderService(globalScope) {
    "use strict";

    const MODULE_NAME = "order-service";

    function resolveOrderStatus(explicitOrderStatus) {
        if (
            explicitOrderStatus &&
            typeof explicitOrderStatus.normalizeOrderStatus === "function" &&
            typeof explicitOrderStatus.normalizeOrderActorRole === "function"
        ) {
            return explicitOrderStatus;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.orderStatus &&
            typeof globalScope.orderStatus.normalizeOrderStatus === "function" &&
            typeof globalScope.orderStatus.normalizeOrderActorRole === "function"
        ) {
            return globalScope.orderStatus;
        }

        if (typeof require === "function") {
            try {
                const requiredOrderStatus = require("./order-status.js");

                if (
                    requiredOrderStatus &&
                    typeof requiredOrderStatus.normalizeOrderStatus === "function" &&
                    typeof requiredOrderStatus.normalizeOrderActorRole === "function"
                ) {
                    return requiredOrderStatus;
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
            typeof explicitOrderModel.createOrderRecordsFromCart === "function" &&
            typeof explicitOrderModel.normalizeOrderRecord === "function" &&
            typeof explicitOrderModel.createOrderTimelineEntry === "function"
        ) {
            return explicitOrderModel;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.orderModel &&
            typeof globalScope.orderModel.createOrderRecordsFromCart === "function" &&
            typeof globalScope.orderModel.normalizeOrderRecord === "function" &&
            typeof globalScope.orderModel.createOrderTimelineEntry === "function"
        ) {
            return globalScope.orderModel;
        }

        if (typeof require === "function") {
            try {
                const requiredOrderModel = require("./order-model.js");

                if (
                    requiredOrderModel &&
                    typeof requiredOrderModel.createOrderRecordsFromCart === "function" &&
                    typeof requiredOrderModel.normalizeOrderRecord === "function" &&
                    typeof requiredOrderModel.createOrderTimelineEntry === "function"
                ) {
                    return requiredOrderModel;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveOrderValidation(explicitOrderValidation) {
        if (
            explicitOrderValidation &&
            typeof explicitOrderValidation.validateCreateOrderInput === "function" &&
            typeof explicitOrderValidation.validateOrderStatusChange === "function"
        ) {
            return explicitOrderValidation;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.orderValidation &&
            typeof globalScope.orderValidation.validateCreateOrderInput === "function" &&
            typeof globalScope.orderValidation.validateOrderStatusChange === "function"
        ) {
            return globalScope.orderValidation;
        }

        if (typeof require === "function") {
            try {
                const requiredOrderValidation = require("./order-validation.js");

                if (
                    requiredOrderValidation &&
                    typeof requiredOrderValidation.validateCreateOrderInput === "function" &&
                    typeof requiredOrderValidation.validateOrderStatusChange === "function"
                ) {
                    return requiredOrderValidation;
                }
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveOrderQueries(explicitOrderQueries) {
        if (
            explicitOrderQueries &&
            typeof explicitOrderQueries.fetchOrderById === "function" &&
            typeof explicitOrderQueries.getOrderDocRef === "function"
        ) {
            return explicitOrderQueries;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.orderQueries &&
            typeof globalScope.orderQueries.fetchOrderById === "function" &&
            typeof globalScope.orderQueries.getOrderDocRef === "function"
        ) {
            return globalScope.orderQueries;
        }

        if (typeof require === "function") {
            try {
                const requiredOrderQueries = require("./order-queries.js");

                if (
                    requiredOrderQueries &&
                    typeof requiredOrderQueries.fetchOrderById === "function" &&
                    typeof requiredOrderQueries.getOrderDocRef === "function"
                ) {
                    return requiredOrderQueries;
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
            code: normalizeText(code) || "orders/error",
            message: normalizeText(message) || "Something went wrong while handling the order request.",
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

    function createOrderId(index, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const normalizedFactoryId = typeof safeOptions.orderIdFactory === "function"
            ? normalizeText(
                safeOptions.orderIdFactory(
                    Number.isFinite(index) ? index : 0,
                    safeOptions.orderRecord || null
                )
            )
            : "";

        if (normalizedFactoryId) {
            return normalizedFactoryId;
        }

        const orderQueries = resolveOrderQueries(safeOptions.orderQueries);

        if (
            orderQueries &&
            safeOptions.db &&
            safeOptions.firestoreFns &&
            typeof safeOptions.firestoreFns.doc === "function" &&
            typeof orderQueries.getOrdersCollectionRef === "function"
        ) {
            try {
                const generatedRef = safeOptions.firestoreFns.doc(
                    orderQueries.getOrdersCollectionRef(
                        safeOptions.db,
                        safeOptions.firestoreFns
                    )
                );
                const generatedId = normalizeText(generatedRef && generatedRef.id);

                if (generatedId) {
                    return generatedId;
                }
            } catch (error) {
                // Fall back to deterministic string below.
            }
        }

        const seed = normalizeLowerText(safeOptions.timestampSeed || `${Date.now()}`)
            .replace(/[^a-z0-9]+/g, "") || "generated";

        return `order-${seed}-${Number.isFinite(index) ? index + 1 : 1}`;
    }

    function buildOrderWritePayload(orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const orderModel = resolveOrderModel(safeOptions.orderModel);
        const safeRecord = orderRecord && typeof orderRecord === "object" ? orderRecord : {};
        const normalizedRecord = orderModel
            ? orderModel.normalizeOrderRecord(safeRecord, { orderStatus })
            : safeRecord;
        const timeline = Array.isArray(safeOptions.timeline)
            ? safeOptions.timeline.slice()
            : normalizedRecord.timeline;

        if (!orderModel) {
            return {
                ...normalizedRecord,
                orderId: normalizeText(safeOptions.orderId || normalizedRecord.orderId),
                status: normalizeLowerText(safeOptions.status || normalizedRecord.status),
                timeline: Array.isArray(timeline) ? timeline : [],
                customerConfirmedCollected:
                    safeOptions.customerConfirmedCollected !== undefined
                        ? safeOptions.customerConfirmedCollected === true
                        : normalizedRecord.customerConfirmedCollected === true,
                vendorConfirmedCollected:
                    safeOptions.vendorConfirmedCollected !== undefined
                        ? safeOptions.vendorConfirmedCollected === true
                        : normalizedRecord.vendorConfirmedCollected === true,
                createdAt:
                    safeOptions.createdAt !== undefined
                        ? safeOptions.createdAt
                        : normalizedRecord.createdAt,
                updatedAt:
                    safeOptions.updatedAt !== undefined
                        ? safeOptions.updatedAt
                        : normalizedRecord.updatedAt,
                notes:
                    safeOptions.notes !== undefined
                        ? normalizeText(safeOptions.notes)
                        : normalizeText(normalizedRecord.notes)
            };
        }

        return orderModel.createOrderRecord(
            {
                ...normalizedRecord,
                orderId: safeOptions.orderId || normalizedRecord.orderId,
                status: safeOptions.status || normalizedRecord.status,
                timeline: Array.isArray(timeline) ? timeline : normalizedRecord.timeline,
                customerConfirmedCollected:
                    safeOptions.customerConfirmedCollected !== undefined
                        ? safeOptions.customerConfirmedCollected
                        : normalizedRecord.customerConfirmedCollected,
                vendorConfirmedCollected:
                    safeOptions.vendorConfirmedCollected !== undefined
                        ? safeOptions.vendorConfirmedCollected
                        : normalizedRecord.vendorConfirmedCollected,
                createdAt:
                    safeOptions.createdAt !== undefined
                        ? safeOptions.createdAt
                        : normalizedRecord.createdAt,
                updatedAt:
                    safeOptions.updatedAt !== undefined
                        ? safeOptions.updatedAt
                        : normalizedRecord.updatedAt,
                notes:
                    safeOptions.notes !== undefined
                        ? safeOptions.notes
                        : normalizedRecord.notes
            },
            {
                orderStatus,
                createdAt:
                    safeOptions.createdAt !== undefined
                        ? safeOptions.createdAt
                        : normalizedRecord.createdAt,
                createdByRole: safeOptions.createdByRole || "system"
            }
        );
    }

    function buildOrderUpdatePatch(orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeOrder = orderRecord && typeof orderRecord === "object" ? orderRecord : {};

        const patch = {
            orderId: normalizeText(safeOrder.orderId),
            status: normalizeLowerText(safeOrder.status),
            updatedAt:
                safeOptions.updatedAt !== undefined
                    ? safeOptions.updatedAt
                    : safeOrder.updatedAt
        };

        if (!patch.orderId) {
            delete patch.orderId;
        }

        if (Array.isArray(safeOrder.timeline)) {
            patch.timeline = safeOrder.timeline;
        }

        if ("notes" in safeOrder) {
            patch.notes = normalizeText(safeOrder.notes);
        }

        if ("customerConfirmedCollected" in safeOrder) {
            patch.customerConfirmedCollected = safeOrder.customerConfirmedCollected === true;
        }

        if ("vendorConfirmedCollected" in safeOrder) {
            patch.vendorConfirmedCollected = safeOrder.vendorConfirmedCollected === true;
        }

        return patch;
    }

    function prepareCreateOrders(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const orderModel = resolveOrderModel(safeOptions.orderModel);
        const orderValidation = resolveOrderValidation(safeOptions.orderValidation);

        if (!orderModel || !orderValidation) {
            return createServiceResult(false, {
                orders: [],
                validationResults: [],
                error: createServiceError(
                    "orders/dependencies-missing",
                    "Order helpers are required before new orders can be prepared."
                )
            });
        }

        const createdAt = resolveTimestampValue(safeOptions);
        const orders = orderModel.createOrderRecordsFromCart(
            safeOptions.cartItems,
            safeOptions.customer,
            {
                orderStatus,
                status: safeOptions.status,
                notes: safeOptions.notes,
                createdByRole: safeOptions.createdByRole || "customer",
                createdByUid: safeOptions.createdByUid,
                createdByName: safeOptions.createdByName,
                createdAt,
                updatedAt: createdAt
            }
        );

        if (orders.length === 0) {
            return createServiceResult(false, {
                orders,
                validationResults: [],
                error: createServiceError(
                    "orders/empty-cart",
                    "Add at least one valid vendor item before placing an order."
                )
            });
        }

        const validationResults = orders.map(function validateOneOrder(orderRecord) {
            return orderValidation.validateCreateOrderInput(orderRecord, {
                orderStatus,
                orderModel
            });
        });

        const invalidOrders = validationResults
            .map(function mapResult(result, index) {
                if (result.isValid) {
                    return null;
                }

                return {
                    index,
                    errors: result.errors,
                    value: result.value
                };
            })
            .filter(Boolean);

        if (invalidOrders.length > 0) {
            return createServiceResult(false, {
                orders,
                createdAt,
                validationResults,
                error: createServiceError(
                    "orders/validation-failed",
                    "One or more vendor orders are incomplete and cannot be submitted yet.",
                    { invalidOrders }
                )
            });
        }

        return createServiceResult(true, {
            orders,
            createdAt,
            validationResults
        });
    }

    async function persistOrders(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const firestoreFns = safeOptions.firestoreFns || {};
        const orderQueries = resolveOrderQueries(safeOptions.orderQueries);

        if (!safeOptions.db || !orderQueries) {
            return createServiceResult(false, {
                orders: [],
                error: createServiceError(
                    "orders/persist-unavailable",
                    "Database helpers are required before orders can be saved."
                )
            });
        }

        const sourceOrders = Array.isArray(safeOptions.orders) ? safeOptions.orders : [];

        if (sourceOrders.length === 0) {
            return createServiceResult(false, {
                orders: [],
                error: createServiceError(
                    "orders/missing-orders",
                    "There are no prepared orders to save."
                )
            });
        }

        if (typeof firestoreFns.doc !== "function") {
            return createServiceResult(false, {
                orders: [],
                error: createServiceError(
                    "orders/doc-ref-unavailable",
                    "Firestore doc is required before orders can be saved."
                )
            });
        }

        const persistedOrders = [];
        const docRefs = [];
        const timestampSeed = safeOptions.timestampSeed !== undefined
            ? safeOptions.timestampSeed
            : resolveTimestampValue({
                ...safeOptions,
                useServerTimestamp: false
            });

        if (typeof firestoreFns.writeBatch === "function") {
            const batch = firestoreFns.writeBatch(safeOptions.db);

            if (!batch || typeof batch.set !== "function" || typeof batch.commit !== "function") {
                return createServiceResult(false, {
                    orders: [],
                    error: createServiceError(
                        "orders/invalid-batch",
                        "The Firestore batch helper is not ready."
                    )
                });
            }

            sourceOrders.forEach(function queueOneOrder(orderRecord, index) {
                const orderId = createOrderId(index, {
                    ...safeOptions,
                    timestampSeed,
                    orderRecord,
                    orderQueries
                });

                const payload = buildOrderWritePayload(orderRecord, {
                    orderStatus: safeOptions.orderStatus,
                    orderModel: safeOptions.orderModel,
                    createdByRole: safeOptions.createdByRole || "customer",
                    orderId
                });

                const docRef = orderQueries.getOrderDocRef(
                    safeOptions.db,
                    orderId,
                    firestoreFns
                );

                batch.set(docRef, payload);
                persistedOrders.push(payload);
                docRefs.push(docRef);
            });

            await batch.commit();

            return createServiceResult(true, {
                orders: persistedOrders,
                docRefs
            });
        }

        if (typeof firestoreFns.setDoc !== "function") {
            return createServiceResult(false, {
                orders: [],
                error: createServiceError(
                    "orders/write-unavailable",
                    "Firestore setDoc is required before orders can be saved."
                )
            });
        }

        for (let index = 0; index < sourceOrders.length; index += 1) {
            const orderRecord = sourceOrders[index];
            const orderId = createOrderId(index, {
                ...safeOptions,
                timestampSeed,
                orderRecord,
                orderQueries
            });

            const payload = buildOrderWritePayload(orderRecord, {
                orderStatus: safeOptions.orderStatus,
                orderModel: safeOptions.orderModel,
                createdByRole: safeOptions.createdByRole || "customer",
                orderId
            });

            const docRef = orderQueries.getOrderDocRef(
                safeOptions.db,
                orderId,
                firestoreFns
            );

            await firestoreFns.setDoc(docRef, payload);
            persistedOrders.push(payload);
            docRefs.push(docRef);
        }

        return createServiceResult(true, {
            orders: persistedOrders,
            docRefs
        });
    }

    async function createOrders(options = {}) {
        try {
            const preparedResult = prepareCreateOrders(options);

            if (!preparedResult.success) {
                return preparedResult;
            }

            const persistedResult = await persistOrders({
                ...options,
                orders: preparedResult.orders,
                createdByRole: options.createdByRole || "customer"
            });

            if (!persistedResult.success) {
                return persistedResult;
            }

            return createServiceResult(true, {
                orders: persistedResult.orders,
                docRefs: persistedResult.docRefs,
                createdAt: preparedResult.createdAt,
                validationResults: preparedResult.validationResults
            });
        } catch (error) {
            return createServiceResult(false, {
                orders: [],
                error: createServiceError(
                    "orders/create-failed",
                    error && error.message
                        ? error.message
                        : "Failed to create orders.",
                    { cause: error || null }
                )
            });
        }
    }

    async function getOrderById(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderQueries = resolveOrderQueries(safeOptions.orderQueries);

        if (
            !orderQueries ||
            typeof orderQueries.fetchOrderById !== "function" ||
            !safeOptions.db ||
            !safeOptions.firestoreFns ||
            !normalizeText(safeOptions.orderId)
        ) {
            return null;
        }

        return orderQueries.fetchOrderById(safeOptions);
    }

    async function getCustomerOrders(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderQueries = resolveOrderQueries(safeOptions.orderQueries);

        if (
            !orderQueries ||
            typeof orderQueries.fetchCustomerOrders !== "function" ||
            !safeOptions.db ||
            !safeOptions.firestoreFns ||
            !normalizeText(safeOptions.customerUid)
        ) {
            return [];
        }

        return orderQueries.fetchCustomerOrders(safeOptions);
    }

    async function getVendorOrders(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderQueries = resolveOrderQueries(safeOptions.orderQueries);

        if (
            !orderQueries ||
            typeof orderQueries.fetchVendorOrders !== "function" ||
            !safeOptions.db ||
            !safeOptions.firestoreFns ||
            !normalizeText(safeOptions.vendorUid)
        ) {
            return [];
        }

        return orderQueries.fetchVendorOrders(safeOptions);
    }

    async function getNotifications(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderQueries = resolveOrderQueries(safeOptions.orderQueries);

        if (
            !orderQueries ||
            typeof orderQueries.fetchNotifications !== "function" ||
            !safeOptions.db ||
            !safeOptions.firestoreFns ||
            !normalizeText(safeOptions.recipientUid)
        ) {
            return [];
        }

        return orderQueries.fetchNotifications(safeOptions);
    }

    async function getVendorMenuItems(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderQueries = resolveOrderQueries(safeOptions.orderQueries);

        if (
            !orderQueries ||
            typeof orderQueries.fetchVendorMenuItems !== "function" ||
            !safeOptions.db ||
            !safeOptions.firestoreFns ||
            !normalizeText(safeOptions.vendorUid)
        ) {
            return [];
        }

        return orderQueries.fetchVendorMenuItems(safeOptions);
    }

    function createStatusUpdateFailure(code, message, currentOrder, transition) {
        return createServiceResult(false, {
            order: currentOrder || null,
            transition: transition || null,
            error: createServiceError(code, message, {
                transition: transition || null
            })
        });
    }

    function buildCollectionConfirmationUpdate(orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const orderModel = resolveOrderModel(safeOptions.orderModel);
        const orderValidation = resolveOrderValidation(safeOptions.orderValidation);

        if (!orderStatus || !orderModel || !orderValidation) {
            return createStatusUpdateFailure(
                "orders/dependencies-missing",
                "Order helpers are required before collection confirmation can be applied."
            );
        }

        const currentOrder = orderModel.normalizeOrderRecord(orderRecord, { orderStatus });
        const actorRole = orderStatus.normalizeOrderActorRole(safeOptions.actorRole);

        if (
            actorRole !== orderStatus.ORDER_ACTOR_ROLES.CUSTOMER &&
            actorRole !== orderStatus.ORDER_ACTOR_ROLES.VENDOR
        ) {
            return createStatusUpdateFailure(
                "orders/invalid-actor",
                "Only a customer or vendor can confirm collection.",
                currentOrder
            );
        }

        if (
            currentOrder.status !== orderStatus.ORDER_STATUSES.READY &&
            currentOrder.status !== orderStatus.ORDER_STATUSES.COMPLETED
        ) {
            return createStatusUpdateFailure(
                "orders/not-ready-for-collection",
                "Collection can only be confirmed once an order is ready for pickup.",
                currentOrder
            );
        }

        const actorAlreadyConfirmed = actorRole === orderStatus.ORDER_ACTOR_ROLES.CUSTOMER
            ? currentOrder.customerConfirmedCollected === true
            : currentOrder.vendorConfirmedCollected === true;

        if (actorAlreadyConfirmed) {
            return createServiceResult(true, {
                order: currentOrder,
                previousOrder: currentOrder,
                transition: null,
                timelineEntry: null,
                needsWrite: false,
                alreadyConfirmed: true,
                statusChanged: false
            });
        }

        let transition = null;

        if (currentOrder.status === orderStatus.ORDER_STATUSES.READY) {
            const transitionValidation = orderValidation.validateOrderStatusChange(
                currentOrder.status,
                orderStatus.ORDER_STATUSES.COMPLETED,
                actorRole,
                { orderStatus }
            );

            transition = transitionValidation.transition;

            if (!transitionValidation.isValid) {
                return createStatusUpdateFailure(
                    "orders/invalid-status-change",
                    transition && transition.message
                        ? transition.message
                        : "This collection confirmation is not allowed.",
                    currentOrder,
                    transition
                );
            }
        } else {
            transition = {
                isValid: true,
                currentStatus: currentOrder.status,
                nextStatus: orderStatus.ORDER_STATUSES.COMPLETED,
                actorRole,
                message: "Collection confirmation was applied to a completed order."
            };
        }

        const updatedAt = resolveTimestampValue(safeOptions);
        const customerConfirmedCollected =
            actorRole === orderStatus.ORDER_ACTOR_ROLES.CUSTOMER
                ? true
                : currentOrder.customerConfirmedCollected === true;
        const vendorConfirmedCollected =
            actorRole === orderStatus.ORDER_ACTOR_ROLES.VENDOR
                ? true
                : currentOrder.vendorConfirmedCollected === true;
        const status =
            customerConfirmedCollected && vendorConfirmedCollected
                ? orderStatus.ORDER_STATUSES.COMPLETED
                : currentOrder.status === orderStatus.ORDER_STATUSES.COMPLETED
                    ? orderStatus.ORDER_STATUSES.COMPLETED
                    : orderStatus.ORDER_STATUSES.READY;
        const defaultNote =
            status === orderStatus.ORDER_STATUSES.COMPLETED
                ? "Collection confirmed by both customer and vendor."
                : actorRole === orderStatus.ORDER_ACTOR_ROLES.CUSTOMER
                    ? "Customer confirmed collection. Waiting for vendor confirmation."
                    : "Vendor confirmed collection. Waiting for customer confirmation.";
        const timelineEntry = orderModel.createOrderTimelineEntry(
            status,
            {
                actorRole,
                actorUid: safeOptions.actorUid,
                actorName: safeOptions.actorName,
                note: safeOptions.note || defaultNote,
                at: updatedAt
            },
            orderStatus
        );
        const updatedOrder = buildOrderWritePayload(
            {
                ...currentOrder,
                status,
                timeline: currentOrder.timeline.concat(timelineEntry),
                customerConfirmedCollected,
                vendorConfirmedCollected,
                updatedAt
            },
            {
                orderStatus,
                orderModel,
                createdByRole: actorRole,
                customerConfirmedCollected,
                vendorConfirmedCollected,
                status,
                timeline: currentOrder.timeline.concat(timelineEntry),
                updatedAt
            }
        );

        return createServiceResult(true, {
            order: updatedOrder,
            previousOrder: currentOrder,
            transition,
            timelineEntry,
            needsWrite: true,
            alreadyConfirmed: false,
            statusChanged: currentOrder.status !== updatedOrder.status
        });
    }

    function buildOrderStatusUpdate(orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const orderModel = resolveOrderModel(safeOptions.orderModel);
        const orderValidation = resolveOrderValidation(safeOptions.orderValidation);

        if (!orderStatus || !orderModel || !orderValidation) {
            return createStatusUpdateFailure(
                "orders/dependencies-missing",
                "Order helpers are required before order status can be updated."
            );
        }

        const currentOrder = orderModel.normalizeOrderRecord(orderRecord, { orderStatus });
        const nextStatus = orderStatus.normalizeOrderStatus(safeOptions.nextStatus);

        if (nextStatus === orderStatus.ORDER_STATUSES.COMPLETED) {
            return buildCollectionConfirmationUpdate(currentOrder, {
                ...safeOptions,
                orderStatus,
                orderModel,
                orderValidation
            });
        }

        const actorRole = orderStatus.normalizeOrderActorRole(safeOptions.actorRole);
        const transitionValidation = orderValidation.validateOrderStatusChange(
            currentOrder.status,
            nextStatus,
            actorRole,
            { orderStatus }
        );
        const transition = transitionValidation.transition;

        if (!transitionValidation.isValid) {
            return createStatusUpdateFailure(
                "orders/invalid-status-change",
                transition && transition.message
                    ? transition.message
                    : "The requested order status change is not allowed.",
                currentOrder,
                transition
            );
        }

        const updatedAt = resolveTimestampValue(safeOptions);
        const timelineEntry = orderModel.createOrderTimelineEntry(
            nextStatus,
            {
                actorRole,
                actorUid: safeOptions.actorUid,
                actorName: safeOptions.actorName,
                note: safeOptions.note,
                at: updatedAt
            },
            orderStatus
        );
        const updatedOrder = buildOrderWritePayload(
            {
                ...currentOrder,
                status: nextStatus,
                timeline: currentOrder.timeline.concat(timelineEntry),
                updatedAt,
                notes:
                    safeOptions.notes !== undefined
                        ? safeOptions.notes
                        : currentOrder.notes
            },
            {
                orderStatus,
                orderModel,
                createdByRole: actorRole || "system",
                status: nextStatus,
                timeline: currentOrder.timeline.concat(timelineEntry),
                updatedAt,
                notes:
                    safeOptions.notes !== undefined
                        ? safeOptions.notes
                        : currentOrder.notes
            }
        );

        return createServiceResult(true, {
            order: updatedOrder,
            previousOrder: currentOrder,
            transition,
            timelineEntry,
            needsWrite: true,
            alreadyConfirmed: false,
            statusChanged: currentOrder.status !== updatedOrder.status
        });
    }

    async function persistOrderUpdate(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const firestoreFns = safeOptions.firestoreFns || {};
        const orderQueries = resolveOrderQueries(safeOptions.orderQueries);
        const order = safeOptions.order && typeof options.order === "object"
            ? safeOptions.order
            : null;

        if (
            !safeOptions.db ||
            !orderQueries ||
            !order ||
            !normalizeText(order.orderId) ||
            typeof firestoreFns.doc !== "function"
        ) {
            return createServiceResult(false, {
                order,
                error: createServiceError(
                    "orders/update-unavailable",
                    "A valid database, order query helper, and order ID are required before saving updates."
                )
            });
        }

        const docRef = orderQueries.getOrderDocRef(
            safeOptions.db,
            order.orderId,
            firestoreFns
        );

        const patch = buildOrderUpdatePatch(order, {
            updatedAt: order.updatedAt
        });

        if (typeof firestoreFns.updateDoc === "function") {
            await firestoreFns.updateDoc(docRef, patch);

            return createServiceResult(true, {
                order,
                patch,
                docRef
            });
        }

        if (typeof firestoreFns.setDoc === "function") {
            await firestoreFns.setDoc(docRef, patch, { merge: true });

            return createServiceResult(true, {
                order,
                patch,
                docRef
            });
        }

        return createServiceResult(false, {
            order,
            error: createServiceError(
                "orders/update-write-unavailable",
                "Firestore updateDoc or setDoc is required before saving order updates."
            )
        });
    }

    async function updateOrderStatus(options = {}) {
        try {
            const safeOptions = options && typeof options === "object" ? options : {};
            const sourceOrder = safeOptions.order || await getOrderById(safeOptions);

            if (!sourceOrder) {
                return createServiceResult(false, {
                    order: null,
                    error: createServiceError(
                        "orders/not-found",
                        "The requested order could not be found."
                    )
                });
            }

            const updatePlan = buildOrderStatusUpdate(sourceOrder, safeOptions);

            if (!updatePlan.success || updatePlan.needsWrite === false) {
                return updatePlan;
            }

            const persistedResult = await persistOrderUpdate({
                ...safeOptions,
                order: updatePlan.order
            });

            if (!persistedResult.success) {
                return persistedResult;
            }

            return createServiceResult(true, {
                order: persistedResult.order,
                previousOrder: updatePlan.previousOrder,
                transition: updatePlan.transition,
                timelineEntry: updatePlan.timelineEntry,
                alreadyConfirmed: updatePlan.alreadyConfirmed,
                statusChanged: updatePlan.statusChanged,
                docRef: persistedResult.docRef,
                patch: persistedResult.patch || null
            });
        } catch (error) {
            return createServiceResult(false, {
                order: null,
                error: createServiceError(
                    "orders/status-update-failed",
                    error && error.message
                        ? error.message
                        : "Failed to update the order status.",
                    { cause: error || null }
                )
            });
        }
    }

    async function confirmOrderCollection(options = {}) {
        try {
            const safeOptions = options && typeof options === "object" ? options : {};
            const sourceOrder = safeOptions.order || await getOrderById(safeOptions);

            if (!sourceOrder) {
                return createServiceResult(false, {
                    order: null,
                    error: createServiceError(
                        "orders/not-found",
                        "The requested order could not be found."
                    )
                });
            }

            const updatePlan = buildCollectionConfirmationUpdate(sourceOrder, safeOptions);

            if (!updatePlan.success || updatePlan.needsWrite === false) {
                return updatePlan;
            }

            const persistedResult = await persistOrderUpdate({
                ...safeOptions,
                order: updatePlan.order
            });

            if (!persistedResult.success) {
                return persistedResult;
            }

            return createServiceResult(true, {
                order: persistedResult.order,
                previousOrder: updatePlan.previousOrder,
                transition: updatePlan.transition,
                timelineEntry: updatePlan.timelineEntry,
                alreadyConfirmed: updatePlan.alreadyConfirmed,
                statusChanged: updatePlan.statusChanged,
                docRef: persistedResult.docRef,
                patch: persistedResult.patch || null
            });
        } catch (error) {
            return createServiceResult(false, {
                order: null,
                error: createServiceError(
                    "orders/collection-confirmation-failed",
                    error && error.message
                        ? error.message
                        : "Failed to confirm order collection.",
                    { cause: error || null }
                )
            });
        }
    }

    const orderService = {
        MODULE_NAME,
        resolveOrderStatus,
        resolveOrderModel,
        resolveOrderValidation,
        resolveOrderQueries,
        normalizeText,
        normalizeLowerText,
        createServiceError,
        createServiceResult,
        resolveTimestampValue,
        createOrderId,
        buildOrderWritePayload,
        buildOrderUpdatePatch,
        prepareCreateOrders,
        persistOrders,
        createOrders,
        getOrderById,
        getCustomerOrders,
        getVendorOrders,
        getNotifications,
        getVendorMenuItems,
        buildOrderStatusUpdate,
        buildCollectionConfirmationUpdate,
        persistOrderUpdate,
        updateOrderStatus,
        confirmOrderCollection
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = orderService;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.orderService = orderService;
    }
})(typeof window !== "undefined" ? window : globalThis);
