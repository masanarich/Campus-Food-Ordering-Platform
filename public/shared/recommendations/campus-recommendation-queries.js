(function attachCampusRecommendationQueries(globalScope) {
    "use strict";

    const MODULE_NAME = "campus-recommendation-queries";
    const DEFAULT_VENDOR_LIMIT = 20;
    const DEFAULT_MENU_ITEMS_PER_VENDOR_LIMIT = 25;
    const DEFAULT_TOTAL_MENU_ITEM_LIMIT = 120;
    const DEFAULT_MENU_BASE_PATH = "./order-management/browse-menu.html";

    function resolveRecommendationModel(explicitRecommendationModel) {
        if (
            explicitRecommendationModel &&
            typeof explicitRecommendationModel.normalizeMenuItem === "function"
        ) {
            return explicitRecommendationModel;
        }

        if (
            typeof globalScope !== "undefined" &&
            globalScope.recommendationModel &&
            typeof globalScope.recommendationModel.normalizeMenuItem === "function"
        ) {
            return globalScope.recommendationModel;
        }

        if (typeof require === "function") {
            try {
                const requiredRecommendationModel = require("./recommendation-model.js");

                if (
                    requiredRecommendationModel &&
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

        return DEFAULT_TOTAL_MENU_ITEM_LIMIT;
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
            .filter(function keepUnique(tag, index, list) {
                return list.indexOf(tag) === index;
            });
    }

    function createServiceError(code, message, details = {}) {
        const safeDetails = details && typeof details === "object" ? details : {};

        return {
            code: normalizeText(code) || "recommendations/campus-error",
            message: normalizeText(message) || "Campus recommendations could not be loaded.",
            ...safeDetails
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

    function getUsersCollectionRef(db, firestoreFns) {
        return firestoreFns.collection(db, "users");
    }

    function getVendorMenuItemsCollectionRef(db, vendorUid, firestoreFns) {
        return firestoreFns.collection(db, "users", normalizeText(vendorUid), "menuItems");
    }

    function assertFirestoreDependencies(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const firestoreFns = safeOptions.firestoreFns || {};

        if (!safeOptions.db) {
            return {
                success: false,
                error: createServiceError(
                    "recommendations/no-db",
                    "Firestore database is required for campus recommendations."
                )
            };
        }

        if (
            typeof firestoreFns.collection !== "function" ||
            typeof firestoreFns.getDocs !== "function"
        ) {
            return {
                success: false,
                error: createServiceError(
                    "recommendations/no-firestore-fns",
                    "Firestore collection and getDocs functions are required for campus recommendations."
                )
            };
        }

        return { success: true };
    }

    function normalizeVendorRecord(snapshotOrData, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const isSnapshot = snapshotOrData && typeof snapshotOrData.data === "function";
        const safeData = isSnapshot ? getSnapshotData(snapshotOrData) : (snapshotOrData || {});
        const uid = normalizeText(
            (isSnapshot && snapshotOrData.id) ||
            safeData.uid ||
            safeData.vendorUid ||
            safeData.userUid
        );
        const displayName = normalizeText(safeData.displayName);
        const businessName = normalizeText(
            safeData.vendorBusinessName ||
            safeData.businessName ||
            safeData.shopName ||
            displayName
        ) || "Unknown Vendor";
        const vendorStatus = normalizeLowerText(safeData.vendorStatus);
        const accountStatus = normalizeLowerText(safeData.accountStatus) || "active";
        const acceptingOrders = safeData.vendorAcceptingOrders !== false &&
            safeData.manualAcceptingOrders !== false &&
            safeData.acceptingOrders !== false;
        const isApproved = vendorStatus === "approved" || safeOptions.assumeApproved === true;
        const isActive = accountStatus !== "blocked" &&
            accountStatus !== "disabled" &&
            accountStatus !== "suspended";

        return {
            uid,
            vendorUid: uid,
            businessName,
            vendorName: businessName,
            displayName: displayName || businessName,
            vendorStatus,
            accountStatus,
            acceptingOrders,
            isApproved,
            isActive,
            foodType: normalizeText(safeData.vendorFoodType || safeData.foodType),
            institution: normalizeText(
                safeData.vendorInstitution ||
                safeData.vendorUniversity ||
                safeData.university
            ),
            campus: normalizeText(safeData.vendorCampus || safeData.campus),
            location: normalizeText(
                safeData.vendorStallLocation ||
                safeData.vendorLocation ||
                safeData.location
            ),
            photoURL: normalizeText(
                safeData.vendorBannerURL ||
                safeData.uploadedPhotoURL ||
                safeData.photoURL ||
                safeData.providerPhotoURL
            ),
            rating: normalizePositiveNumber(safeData.rating, 0),
            totalOrders: normalizePositiveNumber(safeData.totalOrders, 0),
            updatedAt: safeData.updatedAt || null,
            createdAt: safeData.createdAt || null,
            rawVendor: safeData
        };
    }

    function shouldUseVendor(vendor, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        if (!vendor || !vendor.uid || !vendor.isApproved || !vendor.isActive) {
            return false;
        }

        if (safeOptions.includeClosedVendors === true) {
            return true;
        }

        return vendor.acceptingOrders !== false;
    }

    function isMenuItemAvailable(item) {
        const safeItem = item && typeof item === "object" ? item : {};

        if (safeItem.deleted === true || safeItem.archived === true) {
            return false;
        }

        if (safeItem.isAvailable === false || safeItem.available === false || safeItem.inStock === false) {
            return false;
        }

        if (safeItem.status && normalizeLowerText(safeItem.status) !== "active") {
            return false;
        }

        return true;
    }

    function buildVendorMenuUrl(itemOrVendor, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeItem = itemOrVendor && typeof itemOrVendor === "object" ? itemOrVendor : {};
        const basePath = normalizeText(safeOptions.menuBasePath) || DEFAULT_MENU_BASE_PATH;
        const baseHref = normalizeText(safeOptions.baseHref);
        const vendorUid = normalizeText(safeItem.vendorUid || safeItem.uid);
        const vendorName = normalizeText(safeItem.vendorName || safeItem.businessName);
        const recommendedItemId = normalizeText(
            safeItem.menuItemId ||
            safeItem.itemId ||
            safeItem.productId ||
            safeItem.id
        );
        const url = baseHref
            ? new URL(basePath, baseHref)
            : new URL(basePath, "https://campus-food.local/");

        if (vendorUid) {
            url.searchParams.set("vendorUid", vendorUid);
        }

        if (vendorName) {
            url.searchParams.set("vendorName", vendorName);
        }

        if (recommendedItemId) {
            url.searchParams.set("recommendedItemId", recommendedItemId);
        }

        const builtUrl = url.toString();

        if (baseHref) {
            return builtUrl;
        }

        return builtUrl.replace("https://campus-food.local/", "");
    }

    function normalizeCampusMenuItem(itemData = {}, vendor = {}, fallbackItemId = "", options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeItem = itemData && typeof itemData === "object" ? itemData : {};
        const safeVendor = vendor && typeof vendor === "object" ? vendor : {};
        const recommendationModel = resolveRecommendationModel(safeOptions.recommendationModel);
        const rawItem = {
            ...safeItem,
            menuItemId: normalizeText(
                safeItem.menuItemId ||
                safeItem.itemId ||
                safeItem.productId ||
                safeItem.id ||
                fallbackItemId
            ),
            vendorUid: normalizeText(safeItem.vendorUid || safeVendor.vendorUid || safeVendor.uid),
            vendorName: normalizeText(
                safeItem.vendorName ||
                safeVendor.vendorName ||
                safeVendor.businessName ||
                safeVendor.displayName
            )
        };
        const normalized = recommendationModel
            ? recommendationModel.normalizeMenuItem(rawItem)
            : {
                menuItemId: rawItem.menuItemId,
                id: normalizeText(rawItem.id || rawItem.menuItemId),
                vendorUid: rawItem.vendorUid,
                vendorName: rawItem.vendorName,
                name: normalizeText(rawItem.name || rawItem.title || rawItem.itemName) || "Unknown Item",
                category: normalizeText(rawItem.category) || "Other",
                dietary: normalizeTagList(rawItem.dietary || rawItem.dietaryTags),
                allergens: normalizeTagList(rawItem.allergens || rawItem.allergenTags),
                price: normalizePositiveNumber(
                    rawItem.customerPrice !== undefined ? rawItem.customerPrice : rawItem.price,
                    0
                )
            };
        const campusItem = {
            ...safeItem,
            ...normalized,
            menuItemId: normalizeText(normalized.menuItemId || rawItem.menuItemId),
            id: normalizeText(normalized.id || normalized.menuItemId || rawItem.menuItemId),
            vendorUid: rawItem.vendorUid,
            vendorName: rawItem.vendorName,
            vendorFoodType: safeVendor.foodType || "",
            vendorInstitution: safeVendor.institution || "",
            vendorCampus: safeVendor.campus || "",
            vendorLocation: safeVendor.location || "",
            vendorAcceptingOrders: safeVendor.acceptingOrders !== false,
            dietary: normalizeTagList(normalized.dietary || rawItem.dietary || rawItem.dietaryTags),
            allergens: normalizeTagList(normalized.allergens || rawItem.allergens || rawItem.allergenTags),
            price: normalizePositiveNumber(
                normalized.price !== undefined
                    ? normalized.price
                    : rawItem.customerPrice !== undefined
                        ? rawItem.customerPrice
                        : rawItem.price,
                0
            )
        };

        return {
            ...campusItem,
            vendorMenuUrl: buildVendorMenuUrl(campusItem, safeOptions)
        };
    }

    function mapVendorDocuments(querySnapshot, options = {}) {
        const docs = querySnapshot && Array.isArray(querySnapshot.docs)
            ? querySnapshot.docs
            : [];

        return docs
            .filter(snapshotExists)
            .map(function mapOne(snapshot) {
                return normalizeVendorRecord(snapshot, options);
            })
            .filter(function keepVendor(vendor) {
                return shouldUseVendor(vendor, options);
            });
    }

    function mapMenuItemDocuments(querySnapshot, vendor, options = {}) {
        const docs = querySnapshot && Array.isArray(querySnapshot.docs)
            ? querySnapshot.docs
            : [];

        return docs
            .filter(snapshotExists)
            .map(function mapOne(snapshot) {
                return {
                    id: normalizeText(snapshot.id),
                    ...getSnapshotData(snapshot)
                };
            })
            .filter(isMenuItemAvailable)
            .map(function normalizeOne(itemData) {
                return normalizeCampusMenuItem(itemData, vendor, itemData.id, options);
            })
            .filter(function keepNamedItem(item) {
                return normalizeText(item.menuItemId) && normalizeText(item.name);
            });
    }

    function buildApprovedVendorsQuery(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const firestoreFns = safeOptions.firestoreFns || {};
        const constraints = [
            createFirestoreConstraint("where", ["vendorStatus", "==", "approved"], firestoreFns)
        ];
        const vendorLimit = normalizePositiveInteger(
            safeOptions.vendorLimit,
            DEFAULT_VENDOR_LIMIT
        );

        if (vendorLimit > 0) {
            constraints.push(createFirestoreConstraint("limit", [vendorLimit], firestoreFns));
        }

        return createFirestoreQuery(
            getUsersCollectionRef(safeOptions.db, firestoreFns),
            constraints,
            firestoreFns
        );
    }

    function buildVendorMenuItemsQuery(vendorUid, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const firestoreFns = safeOptions.firestoreFns || {};
        const menuLimit = normalizePositiveInteger(
            safeOptions.menuItemsPerVendorLimit,
            DEFAULT_MENU_ITEMS_PER_VENDOR_LIMIT
        );
        const constraints = [];

        if (menuLimit > 0) {
            constraints.push(createFirestoreConstraint("limit", [menuLimit], firestoreFns));
        }

        return createFirestoreQuery(
            getVendorMenuItemsCollectionRef(safeOptions.db, vendorUid, firestoreFns),
            constraints,
            firestoreFns
        );
    }

    async function fetchApprovedVendors(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const dependencyCheck = assertFirestoreDependencies(safeOptions);

        if (!dependencyCheck.success) {
            return {
                success: false,
                vendors: [],
                error: dependencyCheck.error
            };
        }

        try {
            const snapshot = await safeOptions.firestoreFns.getDocs(
                buildApprovedVendorsQuery(safeOptions)
            );
            const vendors = mapVendorDocuments(snapshot, safeOptions);

            return {
                success: true,
                vendors,
                count: vendors.length
            };
        } catch (error) {
            return {
                success: false,
                vendors: [],
                error: createServiceError(
                    "recommendations/vendors-fetch-failed",
                    error && error.message ? error.message : "Approved vendors could not be loaded.",
                    { cause: error || null }
                )
            };
        }
    }

    async function fetchVendorMenuItems(vendor, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const dependencyCheck = assertFirestoreDependencies(safeOptions);
        const normalizedVendor = normalizeVendorRecord(vendor, {
            ...safeOptions,
            assumeApproved: true
        });

        if (!dependencyCheck.success) {
            return {
                success: false,
                vendor: normalizedVendor,
                menuItems: [],
                error: dependencyCheck.error
            };
        }

        if (!normalizedVendor.uid) {
            return {
                success: false,
                vendor: normalizedVendor,
                menuItems: [],
                error: createServiceError(
                    "recommendations/missing-vendor",
                    "A vendor UID is required before menu items can be loaded."
                )
            };
        }

        try {
            const snapshot = await safeOptions.firestoreFns.getDocs(
                buildVendorMenuItemsQuery(normalizedVendor.uid, safeOptions)
            );
            const menuItems = mapMenuItemDocuments(snapshot, normalizedVendor, safeOptions);

            return {
                success: true,
                vendor: normalizedVendor,
                menuItems,
                count: menuItems.length
            };
        } catch (error) {
            return {
                success: false,
                vendor: normalizedVendor,
                menuItems: [],
                error: createServiceError(
                    "recommendations/vendor-menu-fetch-failed",
                    error && error.message ? error.message : "Vendor menu items could not be loaded.",
                    {
                        vendorUid: normalizedVendor.uid,
                        cause: error || null
                    }
                )
            };
        }
    }

    async function fetchCampusMenuItems(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const dependencyCheck = assertFirestoreDependencies(safeOptions);

        if (!dependencyCheck.success) {
            return {
                success: false,
                vendors: [],
                menuItems: [],
                failures: [],
                error: dependencyCheck.error
            };
        }

        const vendorsResult = await fetchApprovedVendors(safeOptions);

        if (!vendorsResult.success) {
            return {
                success: false,
                vendors: [],
                menuItems: [],
                failures: [],
                error: vendorsResult.error
            };
        }

        const totalLimit = normalizePositiveInteger(
            safeOptions.totalMenuItemLimit,
            DEFAULT_TOTAL_MENU_ITEM_LIMIT
        );
        const menuResults = await Promise.all(
            vendorsResult.vendors.map(function fetchOneVendor(vendor) {
                return fetchVendorMenuItems(vendor, safeOptions);
            })
        );
        const failures = menuResults
            .filter(function keepFailure(result) {
                return !result.success;
            })
            .map(function mapFailure(result) {
                return {
                    vendorUid: result.vendor && result.vendor.uid,
                    vendorName: result.vendor && result.vendor.vendorName,
                    error: result.error
                };
            });
        const menuItems = menuResults
            .flatMap(function collectItems(result) {
                return result.success ? result.menuItems : [];
            })
            .slice(0, totalLimit);

        return {
            success: true,
            vendors: vendorsResult.vendors,
            vendorCount: vendorsResult.count,
            menuItems,
            menuItemCount: menuItems.length,
            failures,
            partial: failures.length > 0
        };
    }

    const campusRecommendationQueries = {
        MODULE_NAME,
        DEFAULT_VENDOR_LIMIT,
        DEFAULT_MENU_ITEMS_PER_VENDOR_LIMIT,
        DEFAULT_TOTAL_MENU_ITEM_LIMIT,
        DEFAULT_MENU_BASE_PATH,
        resolveRecommendationModel,
        normalizeText,
        normalizeLowerText,
        normalizePositiveInteger,
        normalizePositiveNumber,
        normalizeBoolean,
        normalizeTagList,
        createServiceError,
        getSnapshotData,
        snapshotExists,
        createFirestoreConstraint,
        createFirestoreQuery,
        getUsersCollectionRef,
        getVendorMenuItemsCollectionRef,
        assertFirestoreDependencies,
        normalizeVendorRecord,
        shouldUseVendor,
        isMenuItemAvailable,
        buildVendorMenuUrl,
        normalizeCampusMenuItem,
        mapVendorDocuments,
        mapMenuItemDocuments,
        buildApprovedVendorsQuery,
        buildVendorMenuItemsQuery,
        fetchApprovedVendors,
        fetchVendorMenuItems,
        fetchCampusMenuItems
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = campusRecommendationQueries;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.campusRecommendationQueries = campusRecommendationQueries;
    }
})(typeof window !== "undefined" ? window : globalThis);
