(function attachRecommendationQueries(globalScope) {
    "use strict";

    const MODULE_NAME = "recommendation-queries";
    const DEFAULT_RECENT_ORDER_LIMIT = 40;

    function resolveRecommendationModel(explicitRecommendationModel) {
        if (
            explicitRecommendationModel &&
            typeof explicitRecommendationModel.normalizePreferenceProfile === "function" &&
            typeof explicitRecommendationModel.normalizeMenuItem === "function"
        ) {
            return explicitRecommendationModel;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.recommendationModel &&
            typeof globalScope.recommendationModel.normalizePreferenceProfile === "function" &&
            typeof globalScope.recommendationModel.normalizeMenuItem === "function"
        ) {
            return globalScope.recommendationModel;
        }

        if (typeof require === "function") {
            try {
                const requiredRecommendationModel = require("./recommendation-model.js");

                if (
                    requiredRecommendationModel &&
                    typeof requiredRecommendationModel.normalizePreferenceProfile === "function" &&
                    typeof requiredRecommendationModel.normalizeMenuItem === "function"
                ) {
                    return requiredRecommendationModel;
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

        return DEFAULT_RECENT_ORDER_LIMIT;
    }

    function normalizePositiveNumber(value, fallbackValue = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallbackValue;
    }

    function normalizeBoolean(value, fallbackValue = false) {
        if (value === true || value === false) {
            return value;
        }

        if (value === "true" || value === "1" || value === 1) {
            return true;
        }

        if (value === "false" || value === "0" || value === 0) {
            return false;
        }

        return fallbackValue;
    }

    function normalizeTagList(value) {
        const rawValues = Array.isArray(value)
            ? value
            : normalizeText(value)
                ? normalizeText(value).split(",")
                : [];

        return rawValues
            .map(function normalizeTag(tag) {
                return normalizeLowerText(tag);
            })
            .filter(Boolean)
            .filter(function uniqueTag(tag, index, list) {
                return list.indexOf(tag) === index;
            });
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

    function getUserDocRef(db, userUid, firestoreFns) {
        return firestoreFns.doc(db, "users", normalizeText(userUid));
    }

    function getOrdersCollectionRef(db, firestoreFns) {
        return firestoreFns.collection(db, "orders");
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

    function normalizeRecommendationProfile(profileData = {}, fallbackUid = "", options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const recommendationModel = resolveRecommendationModel(safeOptions.recommendationModel);
        const safeProfile = profileData && typeof profileData === "object" ? profileData : {};
        const normalizedPreferences = recommendationModel
            ? recommendationModel.normalizePreferenceProfile(safeProfile)
            : {
                dietaryPreferences: normalizeTagList(
                    safeProfile.dietaryPreferences ||
                    safeProfile.preferredDietaryTags ||
                    safeProfile.dietary
                ),
                dietaryRestrictions: normalizeTagList(
                    safeProfile.dietaryRestrictions ||
                    safeProfile.requiredDietaryTags ||
                    safeProfile.restrictedDietary
                ),
                allergenRestrictions: normalizeTagList(
                    safeProfile.allergenRestrictions ||
                    safeProfile.allergensToAvoid ||
                    safeProfile.restrictedAllergens
                ),
                recommendationOptIn: normalizeBoolean(safeProfile.recommendationOptIn, true)
            };

        return {
            uid: normalizeText(safeProfile.uid || fallbackUid),
            displayName: normalizeText(safeProfile.displayName || safeProfile.fullName),
            email: normalizeLowerText(safeProfile.email),
            ...normalizedPreferences,
            rawProfile: safeProfile
        };
    }

    function mapProfileDocument(snapshot, fallbackUid = "", options = {}) {
        if (!snapshotExists(snapshot)) {
            return normalizeRecommendationProfile({ uid: fallbackUid }, fallbackUid, options);
        }

        return normalizeRecommendationProfile(
            {
                uid: normalizeText(snapshot.id) || fallbackUid,
                ...getSnapshotData(snapshot)
            },
            fallbackUid,
            options
        );
    }

    function normalizeOrderItem(item = {}, parentOrder = {}, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const recommendationModel = resolveRecommendationModel(safeOptions.recommendationModel);
        const safeItem = item && typeof item === "object" ? item : {};
        const safeOrder = parentOrder && typeof parentOrder === "object" ? parentOrder : {};
        const normalized = recommendationModel
            ? recommendationModel.normalizeMenuItem({
                ...safeItem,
                vendorUid: safeItem.vendorUid || safeOrder.vendorUid,
                vendorName: safeItem.vendorName || safeOrder.vendorName
            })
            : {
                menuItemId: normalizeText(
                    safeItem.menuItemId ||
                    safeItem.itemId ||
                    safeItem.productId ||
                    safeItem.id
                ),
                id: normalizeText(safeItem.id),
                vendorUid: normalizeText(safeItem.vendorUid || safeOrder.vendorUid),
                vendorName: normalizeText(safeItem.vendorName || safeOrder.vendorName),
                name: normalizeText(safeItem.name || safeItem.itemName || safeItem.title) || "Unknown Item",
                category: normalizeText(safeItem.category) || "Other",
                dietary: normalizeTagList(safeItem.dietary || safeItem.dietaryTags),
                allergens: normalizeTagList(safeItem.allergens || safeItem.allergenTags),
                price: normalizePositiveNumber(
                    safeItem.customerPrice !== undefined ? safeItem.customerPrice : safeItem.price,
                    0
                )
            };
        const quantity = Math.max(1, Number.parseInt(safeItem.quantity, 10) || 1);

        return {
            ...safeItem,
            ...normalized,
            menuItemId: normalizeText(normalized.menuItemId || normalized.id || safeItem.menuItemId),
            id: normalizeText(normalized.id || normalized.menuItemId || safeItem.id),
            quantity,
            price: normalizePositiveNumber(
                normalized.price !== undefined
                    ? normalized.price
                    : safeItem.customerPrice !== undefined
                        ? safeItem.customerPrice
                        : safeItem.price,
                0
            ),
            dietary: normalizeTagList(normalized.dietary || safeItem.dietary || safeItem.dietaryTags),
            allergens: normalizeTagList(normalized.allergens || safeItem.allergens || safeItem.allergenTags)
        };
    }

    function normalizeOrderRecord(orderData = {}, fallbackOrderId = "", options = {}) {
        const safeOrder = orderData && typeof orderData === "object" ? orderData : {};
        const orderId = normalizeText(safeOrder.orderId || safeOrder.id || fallbackOrderId);
        const items = Array.isArray(safeOrder.items)
            ? safeOrder.items.map(function mapItem(item) {
                return normalizeOrderItem(item, safeOrder, options);
            })
            : [];

        return {
            orderId,
            id: orderId,
            customerUid: normalizeText(safeOrder.customerUid),
            customerName: normalizeText(safeOrder.customerName),
            customerEmail: normalizeLowerText(safeOrder.customerEmail),
            vendorUid: normalizeText(safeOrder.vendorUid),
            vendorName: normalizeText(safeOrder.vendorName),
            status: normalizeLowerText(safeOrder.status),
            paymentStatus: normalizeLowerText(safeOrder.paymentStatus),
            items,
            itemCount: items.reduce(function sumQuantity(total, item) {
                return total + item.quantity;
            }, 0),
            total: normalizePositiveNumber(
                safeOrder.total !== undefined ? safeOrder.total : safeOrder.customerTotal,
                0
            ),
            createdAt: safeOrder.createdAt !== undefined ? safeOrder.createdAt : null,
            updatedAt: safeOrder.updatedAt !== undefined ? safeOrder.updatedAt : null,
            paidAt: safeOrder.paymentPaidAt || safeOrder.paidAt || null
        };
    }

    function mapOrderDocument(snapshot, options = {}) {
        if (!snapshotExists(snapshot)) {
            return null;
        }

        return normalizeOrderRecord(
            {
                orderId: normalizeText(snapshot.id),
                ...getSnapshotData(snapshot)
            },
            normalizeText(snapshot.id),
            options
        );
    }

    function mapOrderDocuments(querySnapshot, options = {}) {
        const docs = querySnapshot && Array.isArray(querySnapshot.docs)
            ? querySnapshot.docs
            : [];

        return docs
            .map(function mapOne(snapshot) {
                return mapOrderDocument(snapshot, options);
            })
            .filter(Boolean);
    }

    function getAuthenticatedUser(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        if (safeOptions.currentUser && safeOptions.currentUser.uid) {
            return safeOptions.currentUser;
        }

        if (
            safeOptions.auth &&
            safeOptions.auth.currentUser &&
            safeOptions.auth.currentUser.uid
        ) {
            return safeOptions.auth.currentUser;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.auth &&
            globalScope.auth.currentUser &&
            globalScope.auth.currentUser.uid
        ) {
            return globalScope.auth.currentUser;
        }

        return null;
    }

    function assertFirestoreDependencies(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const firestoreFns = safeOptions.firestoreFns || {};

        if (!safeOptions.db) {
            return {
                success: false,
                error: {
                    code: "recommendations/no-db",
                    message: "Firestore database is required for recommendation queries."
                }
            };
        }

        if (
            typeof firestoreFns.collection !== "function" ||
            typeof firestoreFns.doc !== "function" ||
            typeof firestoreFns.getDoc !== "function" ||
            typeof firestoreFns.getDocs !== "function"
        ) {
            return {
                success: false,
                error: {
                    code: "recommendations/no-firestore-fns",
                    message: "Firestore collection, doc, getDoc, and getDocs functions are required."
                }
            };
        }

        return { success: true };
    }

    function buildRecentCustomerOrdersQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const firestoreFns = safeOptions.firestoreFns || {};
        const constraints = [
            createFirestoreConstraint("where", ["customerUid", "==", normalizeText(safeOptions.customerUid)], firestoreFns),
            createFirestoreConstraint("orderBy", ["createdAt", "desc"], firestoreFns)
        ];
        const limitCount = normalizePositiveInteger(
            safeOptions.limitCount,
            DEFAULT_RECENT_ORDER_LIMIT
        );

        if (limitCount > 0) {
            constraints.push(createFirestoreConstraint("limit", [limitCount], firestoreFns));
        }

        return createFirestoreQuery(
            getOrdersCollectionRef(safeOptions.db, firestoreFns),
            constraints,
            firestoreFns
        );
    }

    async function fetchRecommendationProfile(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const dependencyCheck = assertFirestoreDependencies(safeOptions);

        if (!dependencyCheck.success) {
            return dependencyCheck;
        }

        const user = getAuthenticatedUser(safeOptions);

        if (!user || !user.uid) {
            return {
                success: false,
                profile: normalizeRecommendationProfile({}, "", safeOptions),
                error: {
                    code: "recommendations/no-user",
                    message: "A signed-in student is required for recommendation profile data."
                }
            };
        }

        try {
            const snapshot = await safeOptions.firestoreFns.getDoc(
                getUserDocRef(safeOptions.db, user.uid, safeOptions.firestoreFns)
            );
            const profile = mapProfileDocument(snapshot, user.uid, safeOptions);

            return {
                success: true,
                user,
                profile
            };
        } catch (error) {
            return {
                success: false,
                profile: normalizeRecommendationProfile({ uid: user.uid }, user.uid, safeOptions),
                error: {
                    code: "recommendations/profile-fetch-failed",
                    message: error && error.message ? error.message : "Recommendation profile could not be loaded.",
                    cause: error
                }
            };
        }
    }

    async function fetchRecentCustomerOrders(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const dependencyCheck = assertFirestoreDependencies(safeOptions);

        if (!dependencyCheck.success) {
            return dependencyCheck;
        }

        const user = getAuthenticatedUser(safeOptions);
        const customerUid = normalizeText(safeOptions.customerUid || (user && user.uid));

        if (!customerUid) {
            return {
                success: false,
                orders: [],
                error: {
                    code: "recommendations/no-customer",
                    message: "A customer UID is required to fetch recommendation order history."
                }
            };
        }

        try {
            const snapshot = await safeOptions.firestoreFns.getDocs(
                buildRecentCustomerOrdersQuery({
                    ...safeOptions,
                    customerUid
                })
            );
            const orders = mapOrderDocuments(snapshot, safeOptions);

            return {
                success: true,
                customerUid,
                orders,
                count: orders.length
            };
        } catch (error) {
            return {
                success: false,
                customerUid,
                orders: [],
                error: {
                    code: "recommendations/orders-fetch-failed",
                    message: error && error.message ? error.message : "Recommendation order history could not be loaded.",
                    cause: error
                }
            };
        }
    }

    async function loadRecommendationContext(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const profileResult = await fetchRecommendationProfile(safeOptions);

        if (!profileResult.success) {
            return {
                success: false,
                profile: profileResult.profile,
                orders: [],
                error: profileResult.error
            };
        }

        const ordersResult = await fetchRecentCustomerOrders({
            ...safeOptions,
            currentUser: profileResult.user,
            customerUid: profileResult.profile.uid
        });

        if (!ordersResult.success) {
            return {
                success: false,
                profile: profileResult.profile,
                orders: [],
                error: ordersResult.error
            };
        }

        return {
            success: true,
            user: profileResult.user,
            profile: profileResult.profile,
            orders: ordersResult.orders,
            orderCount: ordersResult.count
        };
    }

    const recommendationQueries = {
        MODULE_NAME,
        DEFAULT_RECENT_ORDER_LIMIT,
        resolveRecommendationModel,
        normalizeText,
        normalizeLowerText,
        normalizePositiveInteger,
        normalizePositiveNumber,
        normalizeBoolean,
        normalizeTagList,
        createFirestoreConstraint,
        createFirestoreQuery,
        getUserDocRef,
        getOrdersCollectionRef,
        getSnapshotData,
        snapshotExists,
        normalizeRecommendationProfile,
        mapProfileDocument,
        normalizeOrderItem,
        normalizeOrderRecord,
        mapOrderDocument,
        mapOrderDocuments,
        getAuthenticatedUser,
        assertFirestoreDependencies,
        buildRecentCustomerOrdersQuery,
        fetchRecommendationProfile,
        fetchRecentCustomerOrders,
        loadRecommendationContext
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = recommendationQueries;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.recommendationQueries = recommendationQueries;
    }
})(typeof window !== "undefined" ? window : globalThis);
