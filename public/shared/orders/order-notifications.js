(function attachOrderNotifications(globalScope) {
    "use strict";

    const MODULE_NAME = "order-notifications";

    const ORDER_NOTIFICATION_TYPES = Object.freeze({
        ORDER_PLACED: "order_placed",
        ORDER_ACCEPTED: "order_accepted",
        ORDER_PREPARING: "order_preparing",
        ORDER_READY: "order_ready",
        ORDER_COMPLETED: "order_completed",
        ORDER_REJECTED: "order_rejected",
        ORDER_CANCELLED: "order_cancelled",
        COLLECTION_CONFIRMED: "collection_confirmed",
        ORDER_STATUS_UPDATED: "order_status_updated"
    });

    const ORDER_NOTIFICATION_CHANNELS = Object.freeze({
        IN_APP: "in_app",
        EMAIL: "email"
    });

    const ORDER_NOTIFICATION_TYPE_ALIASES = Object.freeze({
        orderplaced: ORDER_NOTIFICATION_TYPES.ORDER_PLACED,
        placed: ORDER_NOTIFICATION_TYPES.ORDER_PLACED,
        neworder: ORDER_NOTIFICATION_TYPES.ORDER_PLACED,

        orderaccepted: ORDER_NOTIFICATION_TYPES.ORDER_ACCEPTED,
        accepted: ORDER_NOTIFICATION_TYPES.ORDER_ACCEPTED,

        orderpreparing: ORDER_NOTIFICATION_TYPES.ORDER_PREPARING,
        preparing: ORDER_NOTIFICATION_TYPES.ORDER_PREPARING,

        orderready: ORDER_NOTIFICATION_TYPES.ORDER_READY,
        ready: ORDER_NOTIFICATION_TYPES.ORDER_READY,
        readyforpickup: ORDER_NOTIFICATION_TYPES.ORDER_READY,

        ordercompleted: ORDER_NOTIFICATION_TYPES.ORDER_COMPLETED,
        completed: ORDER_NOTIFICATION_TYPES.ORDER_COMPLETED,

        orderrejected: ORDER_NOTIFICATION_TYPES.ORDER_REJECTED,
        rejected: ORDER_NOTIFICATION_TYPES.ORDER_REJECTED,

        ordercancelled: ORDER_NOTIFICATION_TYPES.ORDER_CANCELLED,
        cancelled: ORDER_NOTIFICATION_TYPES.ORDER_CANCELLED,
        canceled: ORDER_NOTIFICATION_TYPES.ORDER_CANCELLED,

        collectionconfirmed: ORDER_NOTIFICATION_TYPES.COLLECTION_CONFIRMED,
        confirmedcollection: ORDER_NOTIFICATION_TYPES.COLLECTION_CONFIRMED,

        orderstatusupdated: ORDER_NOTIFICATION_TYPES.ORDER_STATUS_UPDATED,
        statusupdated: ORDER_NOTIFICATION_TYPES.ORDER_STATUS_UPDATED,
        updated: ORDER_NOTIFICATION_TYPES.ORDER_STATUS_UPDATED
    });

    const ORDER_NOTIFICATION_CHANNEL_ALIASES = Object.freeze({
        inapp: ORDER_NOTIFICATION_CHANNELS.IN_APP,
        in_app: ORDER_NOTIFICATION_CHANNELS.IN_APP,
        email: ORDER_NOTIFICATION_CHANNELS.EMAIL,
        mail: ORDER_NOTIFICATION_CHANNELS.EMAIL
    });

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

    function resolveOrderFormatters(explicitOrderFormatters) {
        if (
            explicitOrderFormatters &&
            typeof explicitOrderFormatters.formatOrderId === "function" &&
            typeof explicitOrderFormatters.formatOrderTotal === "function"
        ) {
            return explicitOrderFormatters;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.orderFormatters &&
            typeof globalScope.orderFormatters.formatOrderId === "function" &&
            typeof globalScope.orderFormatters.formatOrderTotal === "function"
        ) {
            return globalScope.orderFormatters;
        }

        if (typeof require === "function") {
            try {
                const requiredOrderFormatters = require("./order-formatters.js");

                if (
                    requiredOrderFormatters &&
                    typeof requiredOrderFormatters.formatOrderId === "function" &&
                    typeof requiredOrderFormatters.formatOrderTotal === "function"
                ) {
                    return requiredOrderFormatters;
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

    function normalizeNotificationKey(value) {
        return normalizeLowerText(value).replace(/[\s_-]+/g, "");
    }

    function isLikelyEmail(value) {
        const normalizedValue = normalizeLowerText(value);
        return normalizedValue.includes("@") && normalizedValue.includes(".");
    }

    function normalizeNotificationType(type, fallbackType) {
        const typeKey = normalizeNotificationKey(type);
        const fallbackKey = normalizeNotificationKey(fallbackType);

        if (Object.prototype.hasOwnProperty.call(ORDER_NOTIFICATION_TYPE_ALIASES, typeKey)) {
            return ORDER_NOTIFICATION_TYPE_ALIASES[typeKey];
        }

        if (Object.prototype.hasOwnProperty.call(ORDER_NOTIFICATION_TYPE_ALIASES, fallbackKey)) {
            return ORDER_NOTIFICATION_TYPE_ALIASES[fallbackKey];
        }

        return "";
    }

    function normalizeNotificationChannel(channel) {
        const key = normalizeNotificationKey(channel);

        if (Object.prototype.hasOwnProperty.call(ORDER_NOTIFICATION_CHANNEL_ALIASES, key)) {
            return ORDER_NOTIFICATION_CHANNEL_ALIASES[key];
        }

        return "";
    }

    function normalizeOrderRecord(orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const orderModel = resolveOrderModel(safeOptions.orderModel);
        const safeRecord = orderRecord && typeof orderRecord === "object" ? orderRecord : {};

        if (orderModel) {
            return orderModel.normalizeOrderRecord(safeRecord, { orderStatus });
        }

        return safeRecord;
    }

    function getNotificationTypeForStatus(status, explicitOrderStatus) {
        const orderStatus = resolveOrderStatus(explicitOrderStatus);
        const normalizedStatus = orderStatus
            ? orderStatus.normalizeOrderStatus(status)
            : normalizeLowerText(status);

        if (normalizedStatus === "pending") {
            return ORDER_NOTIFICATION_TYPES.ORDER_PLACED;
        }

        if (normalizedStatus === "accepted") {
            return ORDER_NOTIFICATION_TYPES.ORDER_ACCEPTED;
        }

        if (normalizedStatus === "preparing") {
            return ORDER_NOTIFICATION_TYPES.ORDER_PREPARING;
        }

        if (normalizedStatus === "ready") {
            return ORDER_NOTIFICATION_TYPES.ORDER_READY;
        }

        if (normalizedStatus === "completed") {
            return ORDER_NOTIFICATION_TYPES.ORDER_COMPLETED;
        }

        if (normalizedStatus === "rejected") {
            return ORDER_NOTIFICATION_TYPES.ORDER_REJECTED;
        }

        if (normalizedStatus === "cancelled") {
            return ORDER_NOTIFICATION_TYPES.ORDER_CANCELLED;
        }

        return ORDER_NOTIFICATION_TYPES.ORDER_STATUS_UPDATED;
    }

    function inferNotificationType(orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const explicitType = normalizeNotificationType(
            safeOptions.type || safeOptions.notificationType,
            ""
        );

        if (explicitType) {
            return explicitType;
        }

        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const currentOrder = normalizeOrderRecord(orderRecord, safeOptions);
        const previousOrder = safeOptions.previousOrder
            ? normalizeOrderRecord(safeOptions.previousOrder, safeOptions)
            : null;
        const currentStatus = orderStatus
            ? orderStatus.normalizeOrderStatus(
                currentOrder.status,
                orderStatus.getDefaultOrderStatus()
            )
            : normalizeLowerText(currentOrder.status) || "pending";
        const previousStatus = previousOrder
            ? (
                orderStatus
                    ? orderStatus.normalizeOrderStatus(previousOrder.status)
                    : normalizeLowerText(previousOrder.status)
            )
            : "";

        if (!previousOrder || !normalizeText(previousOrder.orderId || previousOrder.id)) {
            return getNotificationTypeForStatus(currentStatus, orderStatus);
        }

        if (previousStatus !== currentStatus) {
            return getNotificationTypeForStatus(currentStatus, orderStatus);
        }

        if (
            currentOrder.customerConfirmedCollected !== previousOrder.customerConfirmedCollected ||
            currentOrder.vendorConfirmedCollected !== previousOrder.vendorConfirmedCollected
        ) {
            return ORDER_NOTIFICATION_TYPES.COLLECTION_CONFIRMED;
        }

        return ORDER_NOTIFICATION_TYPES.ORDER_STATUS_UPDATED;
    }

    function createRecipientProfile(recipientRole, orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const order = normalizeOrderRecord(orderRecord, safeOptions);
        const normalizedRole = orderStatus && typeof orderStatus.normalizeOrderActorRole === "function"
            ? orderStatus.normalizeOrderActorRole(recipientRole)
            : normalizeLowerText(recipientRole);

        if (normalizedRole === "customer") {
            return {
                recipientUid: normalizeText(order.customerUid),
                recipientRole: "customer",
                recipientName: normalizeText(order.customerName),
                recipientEmail: normalizeLowerText(order.customerEmail)
            };
        }

        if (normalizedRole === "vendor") {
            return {
                recipientUid: normalizeText(order.vendorUid),
                recipientRole: "vendor",
                recipientName: normalizeText(order.vendorName),
                recipientEmail: normalizeLowerText(
                    safeOptions.vendorEmail ||
                    order.vendorEmail
                )
            };
        }

        return {
            recipientUid: "",
            recipientRole: "",
            recipientName: "",
            recipientEmail: ""
        };
    }

    function buildOrderActionPath(recipientRole, orderId, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const normalizedRole = orderStatus && typeof orderStatus.normalizeOrderActorRole === "function"
            ? orderStatus.normalizeOrderActorRole(recipientRole)
            : normalizeLowerText(recipientRole);
        const safeOrderId = normalizeText(orderId);
        const encodedOrderId = encodeURIComponent(safeOrderId);

        if (!safeOrderId) {
            return normalizeText(safeOptions.emptyActionPath);
        }

        if (normalizedRole === "customer") {
            return `customer/order-tracking/order-detail.html?orderId=${encodedOrderId}`;
        }

        if (normalizedRole === "vendor") {
            return `vendor/order-management/order-detail.html?orderId=${encodedOrderId}`;
        }

        return `index.html?orderId=${encodedOrderId}`;
    }

    function buildDeliveryChannels(recipient, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeRecipient = recipient && typeof recipient === "object" ? recipient : {};
        const normalizedChannels = [];

        if (safeOptions.includeInApp !== false) {
            normalizedChannels.push(ORDER_NOTIFICATION_CHANNELS.IN_APP);
        }

        if (
            safeOptions.includeEmail === true &&
            isLikelyEmail(safeRecipient.recipientEmail)
        ) {
            normalizedChannels.push(ORDER_NOTIFICATION_CHANNELS.EMAIL);
        }

        const extraChannels = Array.isArray(safeOptions.channels)
            ? safeOptions.channels
            : [];

        extraChannels.forEach(function addOneChannel(channel) {
            const normalizedChannel = normalizeNotificationChannel(channel);

            if (
                normalizedChannel &&
                normalizedChannels.indexOf(normalizedChannel) === -1
            ) {
                normalizedChannels.push(normalizedChannel);
            }
        });

        return normalizedChannels;
    }

    function getNotificationRecipients(orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const actorRole = orderStatus && typeof orderStatus.normalizeOrderActorRole === "function"
            ? orderStatus.normalizeOrderActorRole(safeOptions.actorRole)
            : normalizeLowerText(safeOptions.actorRole);
        const type = normalizeNotificationType(
            safeOptions.type || inferNotificationType(orderRecord, safeOptions),
            ORDER_NOTIFICATION_TYPES.ORDER_STATUS_UPDATED
        );
        let recipientRoles = ["customer", "vendor"];

        if (type === ORDER_NOTIFICATION_TYPES.ORDER_PLACED) {
            recipientRoles = ["customer", "vendor"];
        } else if (
            type === ORDER_NOTIFICATION_TYPES.ORDER_ACCEPTED ||
            type === ORDER_NOTIFICATION_TYPES.ORDER_PREPARING ||
            type === ORDER_NOTIFICATION_TYPES.ORDER_READY ||
            type === ORDER_NOTIFICATION_TYPES.ORDER_REJECTED ||
            type === ORDER_NOTIFICATION_TYPES.ORDER_CANCELLED
        ) {
            recipientRoles = ["customer"];
        } else if (type === ORDER_NOTIFICATION_TYPES.COLLECTION_CONFIRMED) {
            if (actorRole === "customer") {
                recipientRoles = ["vendor"];
            } else if (actorRole === "vendor") {
                recipientRoles = ["customer"];
            }
        } else if (type === ORDER_NOTIFICATION_TYPES.ORDER_STATUS_UPDATED) {
            if (actorRole === "customer") {
                recipientRoles = ["vendor"];
            } else if (actorRole === "vendor") {
                recipientRoles = ["customer"];
            }
        }

        return recipientRoles
            .map(function mapOneRole(role) {
                return createRecipientProfile(role, orderRecord, safeOptions);
            })
            .filter(function keepRecipient(recipient) {
                return normalizeText(recipient.recipientUid) !== "";
            });
    }

    function createNotificationContext(orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const orderFormatters = resolveOrderFormatters(safeOptions.orderFormatters);
        const order = normalizeOrderRecord(orderRecord, safeOptions);
        const previousOrder = safeOptions.previousOrder
            ? normalizeOrderRecord(safeOptions.previousOrder, safeOptions)
            : null;
        const type = normalizeNotificationType(
            safeOptions.type || inferNotificationType(order, safeOptions),
            ORDER_NOTIFICATION_TYPES.ORDER_STATUS_UPDATED
        );
        const recipient = safeOptions.recipient && typeof safeOptions.recipient === "object"
            ? safeOptions.recipient
            : createRecipientProfile(
                safeOptions.recipientRole || "",
                order,
                safeOptions
            );
        const actorRole = orderStatus && typeof orderStatus.normalizeOrderActorRole === "function"
            ? orderStatus.normalizeOrderActorRole(safeOptions.actorRole) || "system"
            : normalizeLowerText(safeOptions.actorRole) || "system";
        const actorName = normalizeText(safeOptions.actorName) || (
            actorRole === "customer"
                ? normalizeText(order.customerName)
                : (
                    actorRole === "vendor"
                        ? normalizeText(order.vendorName)
                        : ""
                )
        );
        const currentStatus = orderStatus
            ? orderStatus.normalizeOrderStatus(
                order.status,
                orderStatus.getDefaultOrderStatus()
            )
            : normalizeLowerText(order.status) || "pending";
        const previousStatus = previousOrder
            ? (
                orderStatus
                    ? orderStatus.normalizeOrderStatus(previousOrder.status)
                    : normalizeLowerText(previousOrder.status)
            )
            : "";
        const formattedOrderId = orderFormatters && typeof orderFormatters.formatOrderId === "function"
            ? orderFormatters.formatOrderId(order.orderId)
            : (
                normalizeText(order.orderId)
                    ? `Order #${normalizeText(order.orderId)}`
                    : "Order"
            );
        const orderHeadline = orderFormatters && typeof orderFormatters.formatOrderHeadline === "function"
            ? orderFormatters.formatOrderHeadline(order, {
                orderStatus,
                orderModel: safeOptions.orderModel,
                viewerRole: recipient.recipientRole
            })
            : (
                normalizeText(order.vendorName) ||
                normalizeText(order.customerName) ||
                formattedOrderId
            );
        const totalText = orderFormatters && typeof orderFormatters.formatOrderTotal === "function"
            ? orderFormatters.formatOrderTotal(order, {
                orderStatus,
                orderModel: safeOptions.orderModel
            })
            : normalizeText(order.total);
        const itemCount = Number.isFinite(Number(order.itemCount))
            ? Number(order.itemCount)
            : (Array.isArray(order.items) ? order.items.length : 0);
        const itemCountText = orderFormatters && typeof orderFormatters.formatItemCount === "function"
            ? orderFormatters.formatItemCount(itemCount)
            : `${itemCount} item${itemCount === 1 ? "" : "s"}`;
        const currentStatusLabel = orderFormatters && typeof orderFormatters.getOrderStatusLabel === "function"
            ? orderFormatters.getOrderStatusLabel(currentStatus, orderStatus)
            : normalizeText(currentStatus) || "Unknown Status";
        const previousStatusLabel = orderFormatters && typeof orderFormatters.getOrderStatusLabel === "function"
            ? orderFormatters.getOrderStatusLabel(previousStatus, orderStatus)
            : normalizeText(previousStatus);
        const actionPath = buildOrderActionPath(recipient.recipientRole, order.orderId, safeOptions);

        return {
            type,
            order,
            previousOrder,
            recipient,
            actorRole,
            actorName,
            currentStatus,
            previousStatus,
            currentStatusLabel,
            previousStatusLabel,
            formattedOrderId,
            orderHeadline,
            totalText,
            itemCount,
            itemCountText,
            vendorName: normalizeText(order.vendorName),
            customerName: normalizeText(order.customerName),
            actionPath
        };
    }

    function createNotificationTitle(type, context = {}) {
        const safeContext = context && typeof context === "object" ? context : {};
        const normalizedType = normalizeNotificationType(type, ORDER_NOTIFICATION_TYPES.ORDER_STATUS_UPDATED);
        const recipientRole = normalizeLowerText(safeContext.recipient && safeContext.recipient.recipientRole);

        if (normalizedType === ORDER_NOTIFICATION_TYPES.ORDER_PLACED) {
            return recipientRole === "vendor" ? "New Order Received" : "Order Placed";
        }

        if (normalizedType === ORDER_NOTIFICATION_TYPES.ORDER_ACCEPTED) {
            return "Order Accepted";
        }

        if (normalizedType === ORDER_NOTIFICATION_TYPES.ORDER_PREPARING) {
            return "Preparing Your Order";
        }

        if (normalizedType === ORDER_NOTIFICATION_TYPES.ORDER_READY) {
            return "Ready for Pickup";
        }

        if (normalizedType === ORDER_NOTIFICATION_TYPES.ORDER_COMPLETED) {
            return "Order Completed";
        }

        if (normalizedType === ORDER_NOTIFICATION_TYPES.ORDER_REJECTED) {
            return "Order Rejected";
        }

        if (normalizedType === ORDER_NOTIFICATION_TYPES.ORDER_CANCELLED) {
            return "Order Cancelled";
        }

        if (normalizedType === ORDER_NOTIFICATION_TYPES.COLLECTION_CONFIRMED) {
            return "Collection Confirmed";
        }

        return "Order Updated";
    }

    function createNotificationMessage(type, context = {}) {
        const safeContext = context && typeof context === "object" ? context : {};
        const normalizedType = normalizeNotificationType(type, ORDER_NOTIFICATION_TYPES.ORDER_STATUS_UPDATED);
        const recipientRole = normalizeLowerText(safeContext.recipient && safeContext.recipient.recipientRole);
        const vendorName = normalizeText(safeContext.vendorName) || "The vendor";
        const customerName = normalizeText(safeContext.customerName) || "The customer";
        const orderIdText = normalizeText(safeContext.formattedOrderId) || "the order";
        const totalText = normalizeText(safeContext.totalText);
        const itemCountText = normalizeText(safeContext.itemCountText);

        if (normalizedType === ORDER_NOTIFICATION_TYPES.ORDER_PLACED) {
            if (recipientRole === "vendor") {
                return `${customerName} placed ${orderIdText} with ${itemCountText} for ${totalText || "the listed total"}.`;
            }

            return `Your order with ${vendorName} was placed successfully.`;
        }

        if (normalizedType === ORDER_NOTIFICATION_TYPES.ORDER_ACCEPTED) {
            return `${vendorName} accepted ${orderIdText}.`;
        }

        if (normalizedType === ORDER_NOTIFICATION_TYPES.ORDER_PREPARING) {
            return `${vendorName} is preparing ${orderIdText}.`;
        }

        if (normalizedType === ORDER_NOTIFICATION_TYPES.ORDER_READY) {
            return `${vendorName} marked ${orderIdText} as ready for pickup.`;
        }

        if (normalizedType === ORDER_NOTIFICATION_TYPES.ORDER_COMPLETED) {
            if (recipientRole === "vendor") {
                return `${customerName} completed collection for ${orderIdText}.`;
            }

            return `${orderIdText} is complete.`;
        }

        if (normalizedType === ORDER_NOTIFICATION_TYPES.ORDER_REJECTED) {
            return `${vendorName} rejected ${orderIdText}.`;
        }

        if (normalizedType === ORDER_NOTIFICATION_TYPES.ORDER_CANCELLED) {
            return `${orderIdText} was cancelled.`;
        }

        if (normalizedType === ORDER_NOTIFICATION_TYPES.COLLECTION_CONFIRMED) {
            if (safeContext.actorRole === "customer") {
                return `${customerName} confirmed collection for ${orderIdText}.`;
            }

            if (safeContext.actorRole === "vendor") {
                return `${vendorName} confirmed collection for ${orderIdText}.`;
            }

            return `Collection was confirmed for ${orderIdText}.`;
        }

        if (
            normalizeText(safeContext.previousStatusLabel) &&
            normalizeText(safeContext.currentStatusLabel)
        ) {
            return `${orderIdText} moved from ${safeContext.previousStatusLabel} to ${safeContext.currentStatusLabel}.`;
        }

        return `${orderIdText} is now ${safeContext.currentStatusLabel || "updated"}.`;
    }

    function createEmailSubject(type, context = {}) {
        const title = createNotificationTitle(type, context);
        const orderIdText = normalizeText(context && context.formattedOrderId);

        return orderIdText
            ? `[Campus Food] ${title} - ${orderIdText}`
            : `[Campus Food] ${title}`;
    }

    function createEmailBody(type, context = {}) {
        const safeContext = context && typeof context === "object" ? context : {};
        const lines = [
            createNotificationMessage(type, safeContext)
        ];

        if (normalizeText(safeContext.formattedOrderId)) {
            lines.push(`Order: ${safeContext.formattedOrderId}`);
        }

        if (normalizeText(safeContext.vendorName)) {
            lines.push(`Vendor: ${safeContext.vendorName}`);
        }

        if (normalizeText(safeContext.customerName)) {
            lines.push(`Customer: ${safeContext.customerName}`);
        }

        if (normalizeText(safeContext.totalText)) {
            lines.push(`Total: ${safeContext.totalText}`);
        }

        if (normalizeText(safeContext.actionPath)) {
            lines.push(`Open: ${safeContext.actionPath}`);
        }

        return lines.join("\n");
    }

    function buildNotificationRecord(orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const orderStatus = resolveOrderStatus(safeOptions.orderStatus);
        const order = normalizeOrderRecord(orderRecord, safeOptions);
        const recipient = safeOptions.recipient && typeof safeOptions.recipient === "object"
            ? safeOptions.recipient
            : createRecipientProfile(
                safeOptions.recipientRole || "",
                order,
                safeOptions
            );
        const context = createNotificationContext(order, {
            ...safeOptions,
            recipient
        });
        const channels = buildDeliveryChannels(recipient, safeOptions);
        const type = context.type;
        const title = createNotificationTitle(type, context);
        const message = createNotificationMessage(type, context);
        const createdAt = safeOptions.createdAt !== undefined
            ? safeOptions.createdAt
            : (
                safeOptions.now !== undefined
                    ? safeOptions.now
                    : new Date().toISOString()
            );

        return {
            notificationId: normalizeText(safeOptions.notificationId),
            recipientUid: normalizeText(recipient.recipientUid),
            recipientRole: normalizeLowerText(recipient.recipientRole),
            recipientName: normalizeText(recipient.recipientName),
            recipientEmail: normalizeLowerText(recipient.recipientEmail),
            orderId: normalizeText(order.orderId || safeOptions.orderId),
            type,
            title,
            message,
            read: safeOptions.read === true,
            createdAt,
            status: orderStatus
                ? orderStatus.normalizeOrderStatus(order.status, orderStatus.getDefaultOrderStatus())
                : normalizeLowerText(order.status),
            actionPath: context.actionPath,
            channels,
            emailSubject: channels.indexOf(ORDER_NOTIFICATION_CHANNELS.EMAIL) >= 0
                ? createEmailSubject(type, context)
                : "",
            emailBody: channels.indexOf(ORDER_NOTIFICATION_CHANNELS.EMAIL) >= 0
                ? createEmailBody(type, context)
                : ""
        };
    }

    function buildOrderNotifications(orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const type = normalizeNotificationType(
            safeOptions.type || inferNotificationType(orderRecord, safeOptions),
            ORDER_NOTIFICATION_TYPES.ORDER_STATUS_UPDATED
        );
        const recipients = Array.isArray(safeOptions.recipients)
            ? safeOptions.recipients
            : getNotificationRecipients(orderRecord, {
                ...safeOptions,
                type
            });

        return recipients
            .map(function buildOneNotification(recipient) {
                return buildNotificationRecord(orderRecord, {
                    ...safeOptions,
                    type,
                    recipient
                });
            })
            .filter(function keepNotification(notification) {
                return normalizeText(notification.recipientUid) !== "";
            });
    }

    function buildOrderCreatedNotifications(orderRecord, options = {}) {
        return buildOrderNotifications(orderRecord, {
            ...options,
            type: ORDER_NOTIFICATION_TYPES.ORDER_PLACED
        });
    }

    function buildOrderStatusNotifications(orderRecord, previousOrder, options = {}) {
        return buildOrderNotifications(orderRecord, {
            ...options,
            previousOrder
        });
    }

    function buildCollectionConfirmationNotifications(orderRecord, previousOrder, options = {}) {
        return buildOrderNotifications(orderRecord, {
            ...options,
            previousOrder,
            type: ORDER_NOTIFICATION_TYPES.COLLECTION_CONFIRMED
        });
    }

    const orderNotifications = {
        MODULE_NAME,
        ORDER_NOTIFICATION_TYPES,
        ORDER_NOTIFICATION_CHANNELS,
        resolveOrderStatus,
        resolveOrderModel,
        resolveOrderFormatters,
        normalizeText,
        normalizeLowerText,
        normalizeNotificationKey,
        isLikelyEmail,
        normalizeNotificationType,
        normalizeNotificationChannel,
        normalizeOrderRecord,
        getNotificationTypeForStatus,
        inferNotificationType,
        createRecipientProfile,
        buildOrderActionPath,
        buildDeliveryChannels,
        getNotificationRecipients,
        createNotificationContext,
        createNotificationTitle,
        createNotificationMessage,
        createEmailSubject,
        createEmailBody,
        buildNotificationRecord,
        buildOrderNotifications,
        buildOrderCreatedNotifications,
        buildOrderStatusNotifications,
        buildCollectionConfirmationNotifications
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = orderNotifications;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.orderNotifications = orderNotifications;
    }
})(typeof window !== "undefined" ? window : globalThis);
