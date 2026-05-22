// public/customer/order-management/browse-menu.js

(function attachCustomerBrowseMenu(globalScope) {
    "use strict";

    const MODULE_NAME = "customer/order-management/browse-menu";
    const CART_STORAGE_KEY = "campus-food-cart";
    const DEFAULT_PAGE_SIZE = 10;
    const MAX_VISIBLE_PAGE_BUTTONS = 5;
    const DEFAULT_PLATFORM_FEE_RATE = 0.1;
    let initInFlight = null;

    // ==========================================
    // DEPENDENCY RESOLUTION
    // ==========================================

    function resolveFirestore(explicit) {
        if (explicit) return explicit;
        if (globalScope.db) return globalScope.db;
        return null;
    }

    function resolveAuth(explicit) {
        if (explicit) return explicit;
        if (globalScope.auth) return globalScope.auth;
        return null;
    }

    function resolveOrderService(explicit) {
        if (explicit) return explicit;
        if (globalScope.orderService) return globalScope.orderService;
        return null;
    }

    function resolvePlatformPricing(explicit) {
        if (explicit) return explicit;
        if (globalScope.platformPricing) return globalScope.platformPricing;

        if (typeof require === "function") {
            try {
                return require("../../shared/finance/platform-pricing.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveRecommendationModel(explicit) {
        if (explicit && typeof explicit.recommendMenuItems === "function") {
            return explicit;
        }

        if (globalScope.recommendationModel && typeof globalScope.recommendationModel.recommendMenuItems === "function") {
            return globalScope.recommendationModel;
        }

        if (typeof require === "function") {
            try {
                return require("../../shared/recommendations/recommendation-model.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveRecommendationQueries(explicit) {
        if (explicit && typeof explicit.loadRecommendationContext === "function") {
            return explicit;
        }

        if (globalScope.recommendationQueries && typeof globalScope.recommendationQueries.loadRecommendationContext === "function") {
            return globalScope.recommendationQueries;
        }

        if (typeof require === "function") {
            try {
                return require("../../shared/recommendations/recommendation-queries.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function getStorageArea() {
        if (globalScope.__campusFoodTestLocalStorage) {
            return globalScope.__campusFoodTestLocalStorage;
        }

        if (typeof globalThis !== "undefined" && globalThis.__campusFoodTestLocalStorage) {
            return globalThis.__campusFoodTestLocalStorage;
        }

        if (typeof globalThis !== "undefined" && globalThis.localStorage) {
            return globalThis.localStorage;
        }

        if (globalScope.localStorage) {
            return globalScope.localStorage;
        }

        return null;
    }

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
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

    function parseStoredTagList(value) {
        const normalized = normalizeText(value);

        if (!normalized) {
            return [];
        }

        try {
            const parsed = JSON.parse(normalized);
            return normalizeTagList(parsed);
        } catch (error) {
            return normalizeTagList(normalized);
        }
    }

    function normalizePrice(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    }

    function roundMoney(value) {
        return Math.round((normalizePrice(value) + Number.EPSILON) * 100) / 100;
    }

    function resolvePlatformFeeRate(value, fallbackValue = DEFAULT_PLATFORM_FEE_RATE) {
        const pricing = resolvePlatformPricing();

        if (pricing && typeof pricing.normalizePlatformFeeRate === "function") {
            return pricing.normalizePlatformFeeRate(value, fallbackValue);
        }

        const parsed = Number.parseFloat(value);
        const fallbackParsed = Number.parseFloat(fallbackValue);

        if (Number.isFinite(parsed) && parsed >= 0) {
            return parsed > 1 ? Number((parsed / 100).toFixed(4)) : Number(parsed.toFixed(4));
        }

        if (Number.isFinite(fallbackParsed) && fallbackParsed >= 0) {
            return fallbackParsed > 1
                ? Number((fallbackParsed / 100).toFixed(4))
                : Number(fallbackParsed.toFixed(4));
        }

        return DEFAULT_PLATFORM_FEE_RATE;
    }

    function hasPriceField(source, fieldName) {
        return source && Object.prototype.hasOwnProperty.call(source, fieldName);
    }

    function calculateMenuItemPricing(item, options = {}) {
        const safeItem = item && typeof item === "object" ? item : {};
        const platformPricing = resolvePlatformPricing(options.platformPricing);
        const platformFeeRate = resolvePlatformFeeRate(
            safeItem.platformFeeRate !== undefined ? safeItem.platformFeeRate : options.platformFeeRate,
            DEFAULT_PLATFORM_FEE_RATE
        );
        const hasCustomerPrice = hasPriceField(safeItem, "customerPrice");
        const hasPlatformFee = hasPriceField(safeItem, "platformFee");
        const explicitCustomerPrice = hasCustomerPrice ? roundMoney(safeItem.customerPrice) : null;
        let vendorPrice;

        if (hasPriceField(safeItem, "vendorPrice")) {
            vendorPrice = roundMoney(safeItem.vendorPrice);
        } else if (hasPriceField(safeItem, "basePrice")) {
            vendorPrice = roundMoney(safeItem.basePrice);
        } else if (hasCustomerPrice && hasPlatformFee) {
            vendorPrice = roundMoney(explicitCustomerPrice - roundMoney(safeItem.platformFee));
        } else if (hasCustomerPrice) {
            vendorPrice = roundMoney(explicitCustomerPrice / (1 + platformFeeRate));
        } else {
            vendorPrice = roundMoney(safeItem.price);
        }

        if (platformPricing && typeof platformPricing.calculateLinePricing === "function" && !hasCustomerPrice) {
            const priced = platformPricing.calculateLinePricing(
                {
                    ...safeItem,
                    vendorPrice,
                    price: vendorPrice,
                    quantity: 1
                },
                { platformFeeRate }
            );

            return {
                vendorPrice: roundMoney(priced.vendorPrice),
                basePrice: roundMoney(priced.vendorPrice),
                platformFeeRate: priced.platformFeeRate,
                platformFee: roundMoney(priced.platformFee),
                customerPrice: roundMoney(priced.customerPrice),
                price: roundMoney(priced.customerPrice)
            };
        }

        const calculatedPlatformFee = hasPlatformFee
            ? roundMoney(safeItem.platformFee)
            : hasCustomerPrice
                ? roundMoney(explicitCustomerPrice - vendorPrice)
                : roundMoney(vendorPrice * platformFeeRate);
        const customerPrice = explicitCustomerPrice !== null
            ? explicitCustomerPrice
            : roundMoney(vendorPrice + calculatedPlatformFee);
        const platformFee = hasPlatformFee
            ? calculatedPlatformFee
            : roundMoney(customerPrice - vendorPrice);

        return {
            vendorPrice,
            basePrice: vendorPrice,
            platformFeeRate,
            platformFee,
            customerPrice,
            price: customerPrice
        };
    }

    function normalizePositiveQuantity(value, fallbackValue = 1) {
        const parsed = Number.parseInt(value, 10);

        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }

        return fallbackValue;
    }

    function decodeText(value) {
        const safeValue = normalizeText(value);

        if (!safeValue) {
            return "";
        }

        try {
            return decodeURIComponent(safeValue);
        } catch (error) {
            return safeValue;
        }
    }

    function getLocationSearch(options = {}) {
        if (typeof options.search === "string") {
            return options.search;
        }

        return globalScope.location?.search || "";
    }

    function normalizeItemLookupKey(value) {
        return normalizeLowerText(value).replace(/[^a-z0-9]+/g, "");
    }

    function getMenuItemLookupKeys(item) {
        const safeItem = item && typeof item === "object" ? item : {};

        return [
            safeItem.menuItemId,
            safeItem.id,
            safeItem.itemId,
            safeItem.productId,
            safeItem.name
        ]
            .map(normalizeItemLookupKey)
            .filter(Boolean)
            .filter(function uniqueKey(key, index, list) {
                return list.indexOf(key) === index;
            });
    }

    function menuItemMatchesRecommendedId(item, recommendedItemId) {
        const recommendedKey = normalizeItemLookupKey(recommendedItemId);

        if (!recommendedKey) {
            return false;
        }

        return getMenuItemLookupKeys(item).indexOf(recommendedKey) >= 0;
    }

    function applyRecommendedItemFocus(menuItems, recommendedItemId) {
        const safeItems = Array.isArray(menuItems) ? menuItems : [];
        const focusedItems = [];
        const normalItems = [];

        safeItems.forEach(function mapMenuItem(item) {
            const safeItem = item && typeof item === "object" ? item : {};
            const isCampusRecommended = menuItemMatchesRecommendedId(safeItem, recommendedItemId);
            const nextItem = {
                ...safeItem,
                isCampusRecommended,
                recommendationSource: isCampusRecommended ? "campus" : safeItem.recommendationSource || ""
            };

            if (isCampusRecommended) {
                focusedItems.push(nextItem);
            } else {
                normalItems.push(nextItem);
            }
        });

        return {
            recommendedItemId: normalizeText(recommendedItemId),
            found: focusedItems.length > 0,
            focusedItems,
            menuItems: focusedItems.concat(normalItems)
        };
    }

    function renderCampusRecommendationNotice(element, focusResult, vendorName) {
        if (!element) {
            return;
        }

        const safeResult = focusResult && typeof focusResult === "object" ? focusResult : {};

        if (!normalizeText(safeResult.recommendedItemId)) {
            element.hidden = true;
            element.textContent = "";
            element.removeAttribute("data-state");
            return;
        }

        element.hidden = false;
        element.setAttribute("data-state", safeResult.found ? "success" : "info");

        if (safeResult.found) {
            const itemName = normalizeText(safeResult.focusedItems && safeResult.focusedItems[0] && safeResult.focusedItems[0].name) ||
                "your recommended meal";
            const safeVendorName = normalizeText(vendorName) ? ` from ${decodeText(vendorName)}` : "";

            element.textContent = `You opened this menu from a campus-wide recommendation. ${itemName}${safeVendorName} is pinned below.`;
            return;
        }

        element.textContent = "You opened this vendor from a campus-wide recommendation, but that item is not available on this menu right now.";
    }

    function normalizeMenuItemData(data, fallbackItemId, vendorUid, vendorName) {
        const safeData = data && typeof data === "object" ? data : {};
        const itemId = normalizeText(fallbackItemId) || normalizeText(safeData.menuItemId || safeData.id);
        const pricing = calculateMenuItemPricing(safeData);
        const availabilityValue = normalizeLowerText(safeData.availability);
        const availableFlag =
            availabilityValue
                ? availabilityValue !== "unavailable"
                : safeData.available !== false;

        return {
            menuItemId: itemId,
            id: itemId,
            vendorUid: normalizeText(safeData.vendorUid) || normalizeText(vendorUid),
            vendorName: normalizeText(safeData.vendorName) || decodeText(vendorName),
            name: normalizeText(safeData.name) || "Unknown Item",
            category: normalizeText(safeData.category) || "Other",
            description: normalizeText(safeData.description),
            vendorPrice: pricing.vendorPrice,
            basePrice: pricing.basePrice,
            platformFeeRate: pricing.platformFeeRate,
            platformFee: pricing.platformFee,
            customerPrice: pricing.customerPrice,
            price: pricing.customerPrice,
            photoURL: normalizeText(safeData.photoURL || safeData.photoDataUrl || safeData.photoUrl),
            available: availableFlag,
            soldOut: safeData.soldOut === true,
            allergens: normalizeTagList(
                Array.isArray(safeData.allergens)
                    ? safeData.allergens
                    : (Array.isArray(safeData.allergenTags) ? safeData.allergenTags : [])
            ),
            dietary: normalizeTagList(
                Array.isArray(safeData.dietary)
                    ? safeData.dietary
                    : (Array.isArray(safeData.dietaryTags) ? safeData.dietaryTags : [])
            )
        };
    }

    function normalizeMenuItemRecord(docSnapshot, vendorUid, vendorName) {
        const data = docSnapshot && typeof docSnapshot.data === "function"
            ? (docSnapshot.data() || {})
            : {};
        const itemId = normalizeText(docSnapshot && docSnapshot.id);

        return normalizeMenuItemData(data, itemId, vendorUid, vendorName);
    }

    // ==========================================
    // CART MANAGEMENT (localStorage)
    // ==========================================

    /**
     * Get cart from localStorage
     * @returns {Array} Cart items
     */
    function getCart() {
        try {
            const storageArea = getStorageArea();
            const cartJson = storageArea?.getItem(CART_STORAGE_KEY);
            if (!cartJson) return [];

            const parsedCart = JSON.parse(cartJson);
            return Array.isArray(parsedCart) ? parsedCart : [];
        } catch (error) {
            console.error(`${MODULE_NAME}: Error reading cart:`, error);
            return [];
        }
    }

    /**
     * Save cart to localStorage
     * @param {Array} cart - Cart items
     */
    function saveCart(cart) {
        try {
            const storageArea = getStorageArea();

            if (!storageArea || typeof storageArea.setItem !== "function") {
                return false;
            }

            storageArea.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
            return true;
        } catch (error) {
            console.error(`${MODULE_NAME}: Error saving cart:`, error);
            return false;
        }
    }

    /**
     * Add item to cart
     * @param {Object} item - Menu item
     * @param {Number} quantity - Quantity to add
     * @returns {Object} Result with updated cart
     */
    function addToCart(item, quantity = 1) {
        const cart = getCart();
        const safeItem = item && typeof item === "object" ? item : {};
        const safeQuantity = normalizePositiveQuantity(quantity, 1);
        const pricing = calculateMenuItemPricing(safeItem);

        // Check if item already in cart
        const existingIndex = cart.findIndex(
            cartItem => cartItem.menuItemId === (safeItem.menuItemId || safeItem.id) &&
                        cartItem.vendorUid === safeItem.vendorUid
        );

        if (existingIndex >= 0) {
            // Update quantity
            cart[existingIndex].quantity = normalizePositiveQuantity(
                cart[existingIndex].quantity,
                0
            ) + safeQuantity;
            cart[existingIndex].vendorPrice = pricing.vendorPrice;
            cart[existingIndex].basePrice = pricing.basePrice;
            cart[existingIndex].platformFeeRate = pricing.platformFeeRate;
            cart[existingIndex].platformFee = pricing.platformFee;
            cart[existingIndex].customerPrice = pricing.customerPrice;
            cart[existingIndex].price = pricing.customerPrice;
            cart[existingIndex].dietary = normalizeTagList(safeItem.dietary || safeItem.dietaryTags);
            cart[existingIndex].allergens = normalizeTagList(safeItem.allergens || safeItem.allergenTags);
        } else {
            // Add new item
            cart.push({
                menuItemId: safeItem.menuItemId || safeItem.id,
                vendorUid: normalizeText(safeItem.vendorUid),
                vendorName: normalizeText(safeItem.vendorName),
                name: normalizeText(safeItem.name) || "Unknown Item",
                category: normalizeText(safeItem.category) || "Other",
                vendorPrice: pricing.vendorPrice,
                basePrice: pricing.basePrice,
                platformFeeRate: pricing.platformFeeRate,
                platformFee: pricing.platformFee,
                customerPrice: pricing.customerPrice,
                price: pricing.customerPrice,
                quantity: safeQuantity,
                dietary: normalizeTagList(safeItem.dietary || safeItem.dietaryTags),
                allergens: normalizeTagList(safeItem.allergens || safeItem.allergenTags),
                photoURL: normalizeText(safeItem.photoURL),
                notes: ""
            });
        }

        saveCart(cart);
        return { success: true, cart, itemCount: cart.length };
    }

    /**
     * Get cart item count
     * @returns {Number} Total items in cart
     */
    function getCartItemCount() {
        const cart = getCart();
        return cart.reduce((total, item) => {
            return total + normalizePositiveQuantity(item && item.quantity, 0);
        }, 0);
    }

    // ==========================================
    // MENU DATA FETCHING
    // ==========================================

    /**
     * Fetch menu items for a vendor
     * @param {Object} options - Configuration options
     * @param {String} options.vendorUid - Vendor UID
     * @param {Object} options.orderService - Order service instance
     * @param {Object} options.firestoreFns - Firestore functions
     * @returns {Promise<Object>} Result with menu items
     */
    async function fetchVendorMenu(options = {}) {
        const vendorUid = normalizeText(options.vendorUid);
        const vendorName = options.vendorName;
        const orderService = options.orderService || resolveOrderService();
        const firestoreFns = options.firestoreFns || globalScope.firestoreFns || {};
        const db = options.db || resolveFirestore();

        if (!vendorUid) {
            return {
                success: false,
                menuItems: [],
                error: { code: "no-vendor-uid", message: "Vendor UID is required" }
            };
        }

        // Use orderService if available and it returns the expected response shape.
        if (orderService && orderService.getVendorMenuItems) {
            try {
                const result = await orderService.getVendorMenuItems({
                    vendorUid,
                    vendorName,
                    db,
                    firestoreFns
                });

                if (
                    result &&
                    typeof result === "object" &&
                    Array.isArray(result.menuItems) &&
                    typeof result.success === "boolean"
                ) {
                    const normalizedMenuItems = result.menuItems
                        .map(function normalizeServiceItem(menuItem) {
                            return normalizeMenuItemData(
                                menuItem,
                                menuItem && (menuItem.menuItemId || menuItem.id),
                                vendorUid,
                                vendorName
                            );
                        })
                        .filter(function keepAvailable(menuItem) {
                            return menuItem.available && menuItem.soldOut !== true;
                        });

                    return {
                        ...result,
                        menuItems: normalizedMenuItems,
                        count: normalizedMenuItems.length
                    };
                }
            } catch (error) {
                console.error(`${MODULE_NAME}: Error fetching menu via orderService:`, error);
            }
        }

        // Fallback to direct Firestore query
        if (!firestoreFns.collection || !firestoreFns.getDocs) {
            return {
                success: false,
                menuItems: [],
                error: { code: "no-firestore-fns", message: "Firestore functions not available" }
            };
        }

        try {
            if (!db) {
                return {
                    success: false,
                    menuItems: [],
                    error: { code: "no-db", message: "Firestore database not available" }
                };
            }

            const menuCollectionRef = firestoreFns.collection(db, "users", vendorUid, "menuItems");
            const querySnapshot = await firestoreFns.getDocs(menuCollectionRef);
            const menuItems = [];
            const iterate = typeof querySnapshot?.forEach === "function"
                ? querySnapshot.forEach.bind(querySnapshot)
                : function iterateDocs(callback) {
                    const docs = Array.isArray(querySnapshot?.docs) ? querySnapshot.docs : [];
                    docs.forEach(callback);
                };

            iterate((docSnapshot) => {
                const menuItem = normalizeMenuItemRecord(docSnapshot, vendorUid, vendorName);

                if (menuItem.available && menuItem.soldOut !== true) {
                    menuItems.push(menuItem);
                }
            });

            return {
                success: true,
                menuItems,
                count: menuItems.length
            };
        } catch (error) {
            console.error(`${MODULE_NAME}: Error fetching menu:`, error);
            return {
                success: false,
                menuItems: [],
                error: { code: "fetch-error", message: error.message }
            };
        }
    }

    // ==========================================
    // PAGINATION HELPERS
    // ==========================================

    function clampPageSize(value) {
        const parsed = Number.parseInt(value, 10);

        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }

        return DEFAULT_PAGE_SIZE;
    }

    function getTotalPages(itemCount, pageSize) {
        const safeCount = Number.isFinite(Number(itemCount)) ? Math.max(0, Number(itemCount)) : 0;
        const safeSize = clampPageSize(pageSize);

        return Math.max(1, Math.ceil(safeCount / safeSize));
    }

    function clampPageNumber(page, totalPages) {
        const parsed = Number.parseInt(page, 10);
        const safeTotal = Math.max(1, Number.parseInt(totalPages, 10) || 1);

        if (!Number.isFinite(parsed) || parsed < 1) {
            return 1;
        }

        return Math.min(parsed, safeTotal);
    }

    function paginateItems(items, page, pageSize) {
        const safeItems = Array.isArray(items) ? items : [];
        const safeSize = clampPageSize(pageSize);
        const totalPages = getTotalPages(safeItems.length, safeSize);
        const safePage = clampPageNumber(page, totalPages);
        const start = (safePage - 1) * safeSize;

        return safeItems.slice(start, start + safeSize);
    }

    function getVisiblePageNumbers(currentPage, totalPages, maxVisibleButtons = MAX_VISIBLE_PAGE_BUTTONS) {
        const safeTotal = Math.max(1, Number.parseInt(totalPages, 10) || 1);
        const safeCurrent = clampPageNumber(currentPage, safeTotal);
        const safeMax = Math.max(3, Number.parseInt(maxVisibleButtons, 10) || MAX_VISIBLE_PAGE_BUTTONS);

        if (safeTotal <= safeMax) {
            return Array.from({ length: safeTotal }, function mapPage(_, index) {
                return index + 1;
            });
        }

        const halfWindow = Math.floor(safeMax / 2);
        let start = Math.max(1, safeCurrent - halfWindow);
        let end = Math.min(safeTotal, start + safeMax - 1);

        if (end - start + 1 < safeMax) {
            start = Math.max(1, end - safeMax + 1);
        }

        return Array.from({ length: end - start + 1 }, function mapPage(_, index) {
            return start + index;
        });
    }

    // ==========================================
    // UI RENDERING
    // ==========================================

    function createLabeledDetail(labelText, valueText, className) {
        const detail = globalScope.document.createElement("p");
        detail.className = className;

        const label = globalScope.document.createElement("strong");
        label.className = "menu-item-label";
        label.textContent = labelText;

        const value = globalScope.document.createElement("output");
        value.className = "menu-item-value";
        value.textContent = valueText;

        detail.appendChild(label);
        detail.appendChild(value);

        return detail;
    }

    /**
     * Create menu item card
     * @param {Object} item - Menu item
     * @returns {HTMLElement} Article element
     */
    function createMenuItemCard(item) {
        const safeItem = item && typeof item === "object" ? item : {};
        const pricing = calculateMenuItemPricing(safeItem);
        const article = globalScope.document.createElement("article");
        article.className = safeItem.available ? "menu-item-card" : "menu-item-card unavailable";
        if (safeItem.isCampusRecommended === true) {
            article.classList.add("campus-recommended-menu-item-card");
            article.setAttribute("aria-label", "Campus-wide recommended menu item");
        }
        article.setAttribute("data-menu-item-id", safeItem.menuItemId || safeItem.id);
        article.setAttribute("data-vendor-price", pricing.vendorPrice.toFixed(2));
        article.setAttribute("data-platform-fee", pricing.platformFee.toFixed(2));
        article.setAttribute("data-platform-fee-rate", pricing.platformFeeRate.toString());
        article.setAttribute("data-customer-price", pricing.customerPrice.toFixed(2));
        article.setAttribute("data-dietary", JSON.stringify(normalizeTagList(safeItem.dietary || safeItem.dietaryTags)));
        article.setAttribute("data-allergens", JSON.stringify(normalizeTagList(safeItem.allergens || safeItem.allergenTags)));

        // Item image
        const figure = globalScope.document.createElement("figure");
        figure.className = "menu-item-image-container";

        const img = globalScope.document.createElement("img");
        img.src = normalizeText(safeItem.photoURL) || "/images/default-food.png";
        img.alt = normalizeText(safeItem.name) || "Menu item";
        img.className = "menu-item-image";
        img.loading = "lazy";

        figure.appendChild(img);

        // Item info
        const section = globalScope.document.createElement("section");
        section.className = "menu-item-info";

        const heading = globalScope.document.createElement("h3");
        heading.className = "menu-item-name";
        heading.textContent = normalizeText(safeItem.name) || "Unknown Item";

        const category = globalScope.document.createElement("p");
        category.className = "menu-item-category";
        const categoryLabel = globalScope.document.createElement("strong");
        categoryLabel.className = "menu-item-label";
        categoryLabel.textContent = "Category:";
        const categoryValue = globalScope.document.createElement("output");
        categoryValue.className = "menu-item-value";
        categoryValue.textContent = normalizeText(safeItem.category) || "Other";
        category.appendChild(categoryLabel);
        category.appendChild(categoryValue);

        section.appendChild(heading);

        if (safeItem.isCampusRecommended === true) {
            const campusBadge = globalScope.document.createElement("p");
            campusBadge.className = "campus-recommendation-badge";
            campusBadge.textContent = "Campus-wide recommendation";
            section.appendChild(campusBadge);
        }

        section.appendChild(category);

        if (normalizeText(safeItem.description)) {
            const description = createLabeledDetail(
                "Item info:",
                normalizeText(safeItem.description),
                "menu-item-description"
            );
            section.appendChild(description);
        }

        // Dietary info
        if (Array.isArray(safeItem.dietary) && safeItem.dietary.length > 0) {
            const dietary = createLabeledDetail(
                "Dietary info:",
                safeItem.dietary.join(", "),
                "menu-item-dietary"
            );
            section.appendChild(dietary);
        }

        // Allergen info
        if (Array.isArray(safeItem.allergens) && safeItem.allergens.length > 0) {
            const allergens = createLabeledDetail(
                "Allergen info:",
                safeItem.allergens.join(", "),
                "menu-item-allergens"
            );
            section.appendChild(allergens);
        }

        // Price and actions
        const footer = globalScope.document.createElement("footer");
        footer.className = "menu-item-footer";

        const price = globalScope.document.createElement("p");
        price.className = "menu-item-price";
        const priceLabel = globalScope.document.createElement("strong");
        priceLabel.className = "menu-item-label";
        priceLabel.textContent = "Price:";
        const priceStrong = globalScope.document.createElement("strong");
        priceStrong.className = "menu-item-price-amount";
        priceStrong.textContent = `R${pricing.customerPrice.toFixed(2)}`;
        const priceNote = globalScope.document.createElement("small");
        priceNote.className = "menu-item-price-note";
        priceNote.textContent = "Includes 10% platform fee";
        price.appendChild(priceLabel);
        price.appendChild(priceStrong);
        price.appendChild(priceNote);

        footer.appendChild(price);

        if (safeItem.available) {
            const quantitySection = globalScope.document.createElement("section");
            quantitySection.className = "quantity-controls";

            const quantityLabel = globalScope.document.createElement("label");
            quantityLabel.htmlFor = `quantity-${item.menuItemId || item.id}`;
            quantityLabel.textContent = "Qty:";
            quantityLabel.className = "quantity-label";

            const quantityInput = globalScope.document.createElement("input");
            quantityInput.type = "number";
            quantityInput.id = `quantity-${safeItem.menuItemId || safeItem.id}`;
            quantityInput.className = "quantity-input";
            quantityInput.min = "1";
            quantityInput.max = "99";
            quantityInput.value = "1";

            const addButton = globalScope.document.createElement("button");
            addButton.type = "button";
            addButton.className = "button-primary add-to-cart-button";
            addButton.textContent = "Add to Cart";
            addButton.setAttribute("data-menu-item-id", safeItem.menuItemId || safeItem.id);

            quantitySection.appendChild(quantityLabel);
            quantitySection.appendChild(quantityInput);
            quantitySection.appendChild(addButton);

            footer.appendChild(quantitySection);
        } else {
            const unavailable = globalScope.document.createElement("p");
            unavailable.className = "unavailable-message";
            unavailable.textContent = "Currently Unavailable";
            footer.appendChild(unavailable);
        }

        // Assemble card
        article.appendChild(figure);
        article.appendChild(section);
        article.appendChild(footer);

        return article;
    }

    /**
     * Render menu items
     * @param {Array} menuItems - Array of menu items
     * @param {HTMLElement} container - Container element
     */
    function renderMenuItems(menuItems, container) {
        if (!container) {
            console.error(`${MODULE_NAME}: No container element provided`);
            return;
        }

        // Clear existing content
        container.innerHTML = "";

        if (!menuItems || menuItems.length === 0) {
            const emptyMessage = globalScope.document.createElement("p");
            emptyMessage.className = "empty-state-message";
            emptyMessage.textContent = "No menu items available for this vendor.";
            container.appendChild(emptyMessage);
            return;
        }

        // Group by category
        const categorized = {};
        const focusedItems = menuItems.filter(function isFocused(item) {
            return item && item.isCampusRecommended === true;
        });
        const regularItems = menuItems.filter(function isRegular(item) {
            return !item || item.isCampusRecommended !== true;
        });

        if (focusedItems.length > 0) {
            const focusSection = globalScope.document.createElement("section");
            focusSection.className = "campus-recommendation-focus";
            focusSection.setAttribute("aria-labelledby", "campus-recommendation-focus-heading");

            const focusHeading = globalScope.document.createElement("h3");
            focusHeading.id = "campus-recommendation-focus-heading";
            focusHeading.className = "category-heading";
            focusHeading.textContent = "Your Campus Recommendation";

            const focusIntro = globalScope.document.createElement("p");
            focusIntro.className = "campus-recommendation-focus-note";
            focusIntro.textContent = "This item matched your dashboard recommendation. You can add it here or browse the rest of this vendor's menu below.";

            const focusGrid = globalScope.document.createElement("section");
            focusGrid.className = "menu-items-grid";

            focusedItems.forEach(function appendFocusedItem(item) {
                focusGrid.appendChild(createMenuItemCard(item));
            });

            focusSection.appendChild(focusHeading);
            focusSection.appendChild(focusIntro);
            focusSection.appendChild(focusGrid);
            container.appendChild(focusSection);
        }

        regularItems.forEach((item) => {
            const cat = item.category || "Other";
            if (!categorized[cat]) {
                categorized[cat] = [];
            }
            categorized[cat].push(item);
        });

        // Render each category
        Object.keys(categorized).sort().forEach((categoryName) => {
            const categorySection = globalScope.document.createElement("section");
            categorySection.className = "menu-category";

            const categoryHeading = globalScope.document.createElement("h3");
            categoryHeading.className = "category-heading";
            categoryHeading.textContent = categoryName;

            const itemsContainer = globalScope.document.createElement("section");
            itemsContainer.className = "menu-items-grid";

            categorized[categoryName].forEach((item) => {
                const card = createMenuItemCard(item);
                itemsContainer.appendChild(card);
            });

            categorySection.appendChild(categoryHeading);
            categorySection.appendChild(itemsContainer);
            container.appendChild(categorySection);
        });
    }

    function getRecommendationConfidenceLabel(confidence) {
        const parsed = Number(confidence);

        if (!Number.isFinite(parsed)) {
            return "Emerging";
        }

        if (parsed >= 0.75) {
            return "High";
        }

        if (parsed >= 0.45) {
            return "Medium";
        }

        return "Emerging";
    }

    function createRecommendationCard(recommendation) {
        const safeRecommendation = recommendation && typeof recommendation === "object" ? recommendation : {};
        const card = createMenuItemCard(safeRecommendation.item || safeRecommendation);
        card.classList.add("recommended-menu-item-card");

        const explanation = globalScope.document.createElement("section");
        explanation.className = "recommendation-explanation";
        explanation.setAttribute("aria-label", "Recommendation explanation");

        const heading = globalScope.document.createElement("h4");
        heading.textContent = `Recommendation #${safeRecommendation.rank || "?"}`;

        const confidence = globalScope.document.createElement("p");
        const confidenceLabel = globalScope.document.createElement("strong");
        confidenceLabel.textContent = "Confidence:";
        const confidenceValue = globalScope.document.createElement("output");
        confidenceValue.className = "recommendation-confidence";
        confidenceValue.textContent = getRecommendationConfidenceLabel(safeRecommendation.confidence);
        confidence.appendChild(confidenceLabel);
        confidence.appendChild(globalScope.document.createTextNode(" "));
        confidence.appendChild(confidenceValue);

        const reasons = Array.isArray(safeRecommendation.reasons)
            ? safeRecommendation.reasons.slice(0, 3)
            : [];
        const reasonList = globalScope.document.createElement("ul");
        reasonList.className = "recommendation-reasons";

        if (reasons.length === 0) {
            const reason = globalScope.document.createElement("li");
            reason.textContent = "This item is currently a strong match for your profile.";
            reasonList.appendChild(reason);
        } else {
            reasons.forEach(function renderReason(reasonText) {
                const reason = globalScope.document.createElement("li");
                reason.textContent = normalizeText(reasonText);
                reasonList.appendChild(reason);
            });
        }

        explanation.appendChild(heading);
        explanation.appendChild(confidence);
        explanation.appendChild(reasonList);

        const footer = card.querySelector(".menu-item-footer");
        if (footer) {
            card.insertBefore(explanation, footer);
        } else {
            card.appendChild(explanation);
        }

        return card;
    }

    function renderRecommendations(recommendationResult, container, statusElement) {
        if (!container) {
            return;
        }

        const safeResult = recommendationResult && typeof recommendationResult === "object"
            ? recommendationResult
            : {};
        const recommendations = Array.isArray(safeResult.recommendations)
            ? safeResult.recommendations
            : [];

        container.innerHTML = "";

        if (safeResult.status === "opted-out") {
            const message = globalScope.document.createElement("p");
            message.className = "empty-state-message";
            message.textContent = "Personalized recommendations are disabled in your profile.";
            container.appendChild(message);
            setStatusMessage(statusElement, "Recommendation learning is disabled.", "info");
            return;
        }

        if (recommendations.length === 0) {
            const message = globalScope.document.createElement("p");
            message.className = "empty-state-message";
            message.textContent = "No safe personalized recommendations are available yet. Browse the full menu below.";
            container.appendChild(message);
            setStatusMessage(statusElement, "No recommendations available yet.", "info");
            return;
        }

        const grid = globalScope.document.createElement("section");
        grid.className = "recommendation-items-grid";

        recommendations.forEach(function renderRecommendation(recommendation) {
            grid.appendChild(createRecommendationCard(recommendation));
        });

        container.appendChild(grid);

        const statusMessage = safeResult.status === "personalized"
            ? `${recommendations.length} personalized recommendation${recommendations.length === 1 ? "" : "s"} ready.`
            : `${recommendations.length} recommendation${recommendations.length === 1 ? "" : "s"} based on your saved preferences.`;
        setStatusMessage(statusElement, statusMessage, "success");
    }

    async function loadMenuRecommendations(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const menuItems = Array.isArray(safeOptions.menuItems) ? safeOptions.menuItems : [];
        const recommendationModel = resolveRecommendationModel(safeOptions.recommendationModel);
        const recommendationQueries = resolveRecommendationQueries(safeOptions.recommendationQueries);

        if (!recommendationModel || typeof recommendationModel.recommendMenuItems !== "function") {
            return {
                success: false,
                recommendations: [],
                error: {
                    code: "recommendations/no-model",
                    message: "Recommendation model is unavailable."
                }
            };
        }

        if (!recommendationQueries || typeof recommendationQueries.loadRecommendationContext !== "function") {
            const recommendationResult = recommendationModel.recommendMenuItems(
                menuItems,
                [],
                {},
                safeOptions.modelOptions || {}
            );

            return {
                success: true,
                contextLoaded: false,
                ...recommendationResult
            };
        }

        const context = await recommendationQueries.loadRecommendationContext({
            db: safeOptions.db,
            auth: safeOptions.auth,
            currentUser: safeOptions.currentUser,
            firestoreFns: safeOptions.firestoreFns,
            recommendationModel,
            limitCount: safeOptions.historyLimit
        });

        if (!context.success) {
            const fallbackResult = recommendationModel.recommendMenuItems(
                menuItems,
                [],
                context.profile || {},
                safeOptions.modelOptions || {}
            );

            return {
                success: true,
                contextLoaded: false,
                contextError: context.error,
                ...fallbackResult
            };
        }

        const recommendationResult = recommendationModel.recommendMenuItems(
            menuItems,
            context.orders,
            context.profile,
            safeOptions.modelOptions || {}
        );

        return {
            success: true,
            contextLoaded: true,
            profile: context.profile,
            orders: context.orders,
            orderCount: context.orderCount,
            ...recommendationResult
        };
    }

    /**
     * Render pagination controls.
     * Always renders a page indicator so users can see the pagination system
     * exists even when there's only one page. Prev/Next are disabled on the
     * edges and hidden entirely when there's a single page.
     *
     * @param {Number} currentPage - Active page (1-based).
     * @param {Number} totalPages - Total page count.
     * @param {HTMLElement} container - Container for the controls.
     * @param {Function} onPageChange - Callback invoked with the next page number.
     * @param {Object} [options] - Optional info: { totalItems, pageSize }.
     */
    function renderPagination(currentPage, totalPages, container, onPageChange, options = {}) {
        if (!container) {
            return;
        }

        container.innerHTML = "";
        container.classList.add("menu-pagination");

        const safeTotal = Math.max(1, Number.parseInt(totalPages, 10) || 1);
        const safeCurrent = clampPageNumber(currentPage, safeTotal);
        const totalItems = Number.isFinite(Number(options.totalItems))
            ? Math.max(0, Number(options.totalItems))
            : null;
        const pageSize = clampPageSize(options.pageSize);
        const startItem = totalItems === null || totalItems === 0
            ? 0
            : ((safeCurrent - 1) * pageSize) + 1;
        const endItem = totalItems === null || totalItems === 0
            ? 0
            : Math.min(totalItems, safeCurrent * pageSize);

        const indicator = globalScope.document.createElement("p");
        indicator.className = "menu-pagination-indicator";
        indicator.setAttribute("aria-live", "polite");

        if (safeTotal === 1 && totalItems !== null) {
            indicator.textContent = totalItems === 1
                ? "Showing 1 item"
                : `Showing ${totalItems} items`;
        } else {
            indicator.textContent = `Showing ${startItem}-${endItem} of ${totalItems || 0} items`;
        }

        // Single-page menus only need the count line — no Prev/Next buttons.
        if (safeTotal <= 1) {
            container.appendChild(indicator);
            return;
        }

        const meta = globalScope.document.createElement("p");
        meta.className = "menu-pagination-meta";
        meta.textContent = `Page ${safeCurrent} of ${safeTotal}`;

        const pageButtonGroup = globalScope.document.createElement("section");
        pageButtonGroup.className = "menu-pagination-pages";
        pageButtonGroup.setAttribute("aria-label", "Page selection");

        const prevButton = globalScope.document.createElement("button");
        prevButton.type = "button";
        prevButton.className = "button-secondary menu-pagination-prev";
        prevButton.textContent = "Previous";
        prevButton.disabled = safeCurrent <= 1;
        prevButton.addEventListener("click", function onPrevClick() {
            if (typeof onPageChange === "function" && safeCurrent > 1) {
                onPageChange(safeCurrent - 1);
            }
        });

        const nextButton = globalScope.document.createElement("button");
        nextButton.type = "button";
        nextButton.className = "button-secondary menu-pagination-next";
        nextButton.textContent = "Next";
        nextButton.disabled = safeCurrent >= safeTotal;
        nextButton.addEventListener("click", function onNextClick() {
            if (typeof onPageChange === "function" && safeCurrent < safeTotal) {
                onPageChange(safeCurrent + 1);
            }
        });

        getVisiblePageNumbers(safeCurrent, safeTotal).forEach(function renderPageButton(pageNumber) {
            const pageButton = globalScope.document.createElement("button");
            pageButton.type = "button";
            pageButton.className = "button-secondary menu-pagination-page";
            pageButton.textContent = pageNumber.toString();
            pageButton.setAttribute("aria-label", `Go to page ${pageNumber}`);

            if (pageNumber === safeCurrent) {
                pageButton.setAttribute("aria-current", "page");
            }

            pageButton.addEventListener("click", function onPageButtonClick() {
                if (typeof onPageChange === "function" && pageNumber !== safeCurrent) {
                    onPageChange(pageNumber);
                }
            });

            pageButtonGroup.appendChild(pageButton);
        });

        container.appendChild(prevButton);
        container.appendChild(indicator);
        container.appendChild(meta);
        container.appendChild(pageButtonGroup);
        container.appendChild(nextButton);
    }

    /**
     * Render the active page of menu items plus pagination controls.
     * @param {Object} state - { allItems, page, pageSize }
     * @param {HTMLElement} container - Items container.
     * @param {HTMLElement} paginationContainer - Pagination container.
     * @param {Function} onAfterRender - Optional callback after render.
     */
    function renderMenuPage(state, container, paginationContainer, onAfterRender) {
        const safeState = state && typeof state === "object" ? state : {};
        const allItems = Array.isArray(safeState.allItems) ? safeState.allItems : [];
        const pageSize = clampPageSize(safeState.pageSize);
        const totalPages = getTotalPages(allItems.length, pageSize);
        const currentPage = clampPageNumber(safeState.page, totalPages);

        // Keep state in sync with clamped value so callers see what's actually rendered.
        safeState.page = currentPage;
        safeState.pageSize = pageSize;

        const pageItems = paginateItems(allItems, currentPage, pageSize);

        renderMenuItems(pageItems, container);
        renderPagination(
            currentPage,
            totalPages,
            paginationContainer,
            function onPageChange(nextPage) {
                safeState.page = clampPageNumber(nextPage, totalPages);
                renderMenuPage(safeState, container, paginationContainer, onAfterRender);

                const scrollTarget = container?.closest(".menu-section") || container;

                if (scrollTarget && typeof scrollTarget.scrollIntoView === "function") {
                    scrollTarget.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            },
            { totalItems: allItems.length, pageSize }
        );

        if (typeof onAfterRender === "function") {
            onAfterRender({
                page: currentPage,
                totalPages,
                pageItems,
                pageSize
            });
        }
    }

    /**
     * Display status message
     * @param {HTMLElement} element - Status element
     * @param {String} message - Message
     * @param {String} state - State (success, error, info, loading)
     */
    function setStatusMessage(element, message, state = "info") {
        if (!element) return;
        element.textContent = normalizeText(message);
        element.setAttribute("data-state", normalizeText(state) || "info");
    }

    /**
     * Display loading state
     * @param {HTMLElement} container - Container element
     * @param {Boolean} isLoading - Loading state
     */
    function setLoadingState(container, isLoading) {
        if (!container) return;

        if (isLoading) {
            container.innerHTML = "<p class=\"loading-message\">Loading menu...</p>";
            container.setAttribute("data-loading", "true");
        } else {
            container.removeAttribute("data-loading");
        }
    }

    /**
     * Update cart badge
     * @param {HTMLElement} badge - Badge element
     */
    function updateCartBadge(badge) {
        if (!badge) return;

        const count = getCartItemCount();
        badge.textContent = count.toString();

        if (count > 0) {
            badge.style.display = "inline-block";
        } else {
            badge.style.display = "none";
        }
    }

    // ==========================================
    // EVENT HANDLERS
    // ==========================================

    /**
     * Handle add to cart button click
     * @param {Event} event - Click event
     * @param {Function} onCartUpdate - Callback after cart update
     */
    function handleAddToCartClick(event, onCartUpdate) {
        const button = event.target.closest(".add-to-cart-button");
        if (!button) return;

        const menuItemId = button.getAttribute("data-menu-item-id");
        if (!menuItemId) {
            console.error(`${MODULE_NAME}: No menu item ID on button`);
            return;
        }

        // Find the quantity input
        const card = button.closest(".menu-item-card");
        if (!card) return;

        const quantityInput = card.querySelector(".quantity-input");
        const quantity = quantityInput ? normalizePositiveQuantity(quantityInput.value, 1) : 1;

        if (quantity < 1 || quantity > 99) {
            alert("Please enter a valid quantity (1-99)");
            return;
        }

        // Find the item data (we need to get it from the rendered card)
        const nameEl = card.querySelector(".menu-item-name");
        const priceEl = card.querySelector(".menu-item-price-amount")
            || card.querySelector(".menu-item-price strong");
        const categoryEl = card.querySelector(".menu-item-category .menu-item-value")
            || card.querySelector(".menu-item-category");

        if (!nameEl || !priceEl) {
            console.error(`${MODULE_NAME}: Could not find item details`);
            return;
        }

        const name = nameEl.textContent;
        const priceText = priceEl.textContent.replace("R", "");
        const price = parseFloat(priceText);
        const category = categoryEl ? categoryEl.textContent : "Other";
        const vendorPrice = card.getAttribute("data-vendor-price");
        const platformFee = card.getAttribute("data-platform-fee");
        const platformFeeRate = card.getAttribute("data-platform-fee-rate");
        const customerPrice = card.getAttribute("data-customer-price");
        const dietary = parseStoredTagList(card.getAttribute("data-dietary"));
        const allergens = parseStoredTagList(card.getAttribute("data-allergens"));

        // Get vendor info from URL params
        const urlParams = new URLSearchParams(globalScope.location.search);
        const vendorUid = urlParams.get("vendorUid");
        const vendorName = urlParams.get("vendorName") || "Unknown Vendor";

        const item = {
            menuItemId,
            vendorUid: normalizeText(vendorUid),
            vendorName: decodeText(vendorName),
            name: normalizeText(name),
            category: normalizeText(category) || "Other",
            vendorPrice,
            basePrice: vendorPrice,
            platformFeeRate,
            platformFee,
            customerPrice: customerPrice || price,
            price: customerPrice || price,
            dietary,
            allergens
        };

        const result = addToCart(item, quantity);

        if (result.success) {
            // Visual feedback
            button.textContent = "Added!";
            button.disabled = true;

            setTimeout(() => {
                button.textContent = "Add to Cart";
                button.disabled = false;
            }, 1500);

            // Callback
            if (onCartUpdate) {
                onCartUpdate(result);
            }
        }
    }

    /**
     * Setup event listeners
     * @param {HTMLElement} container - Menu container
     * @param {Function} onCartUpdate - Callback after cart update
     */
    function setupEventListeners(container, onCartUpdate) {
        if (!container) return;

        // Delegate click events for add to cart buttons
        container.addEventListener("click", (event) => {
            handleAddToCartClick(event, onCartUpdate);
        });
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    /**
     * Initialize browse menu page
     * @param {Object} options - Configuration options
     * @returns {Promise<Object>} Initialization result
     */
    async function init(options = {}) {
        if (initInFlight) {
            return initInFlight;
        }

        initInFlight = (async function runInit() {
        const containerSelector = options.containerSelector || "#menu-container";
        const statusSelector = options.statusSelector || "#browse-menu-status";
        const cartBadgeSelector = options.cartBadgeSelector || "#cart-badge";
        const vendorNameSelector = options.vendorNameSelector || "#vendor-name-heading";
        const paginationSelector = options.paginationSelector || "#menu-pagination";
        const recommendationContainerSelector = options.recommendationContainerSelector || "#recommendation-container";
        const recommendationStatusSelector = options.recommendationStatusSelector || "#recommendation-status";
        const campusRecommendationNoticeSelector = options.campusRecommendationNoticeSelector || "#campus-recommendation-notice";
        const pageSize = clampPageSize(options.pageSize);

        // Get vendor info from URL
        const urlParams = new URLSearchParams(getLocationSearch(options));
        const vendorUid = normalizeText(options.vendorUid || urlParams.get("vendorUid"));
        const vendorName = options.vendorName || urlParams.get("vendorName");
        const recommendedItemId = normalizeText(options.recommendedItemId || urlParams.get("recommendedItemId"));

        if (!vendorUid) {
            console.error(`${MODULE_NAME}: No vendor UID provided`);
            return { success: false, error: "No vendor UID provided" };
        }

        const container = globalScope.document.querySelector(containerSelector);
        const statusElement = globalScope.document.querySelector(statusSelector);
        const cartBadge = globalScope.document.querySelector(cartBadgeSelector);
        const vendorNameElement = globalScope.document.querySelector(vendorNameSelector);
        const paginationContainer = globalScope.document.querySelector(paginationSelector);
        const recommendationContainer = globalScope.document.querySelector(recommendationContainerSelector);
        const recommendationStatusElement = globalScope.document.querySelector(recommendationStatusSelector);
        const campusRecommendationNotice = globalScope.document.querySelector(campusRecommendationNoticeSelector);

        if (!container) {
            console.error(`${MODULE_NAME}: Container not found: ${containerSelector}`);
            return { success: false, error: "Container not found" };
        }

        // Set vendor name
        if (vendorNameElement && vendorName) {
            vendorNameElement.textContent = decodeText(vendorName);
        }

        // Update cart badge
        updateCartBadge(cartBadge);

        // Show loading
        setLoadingState(container, true);
        if (paginationContainer) {
            paginationContainer.innerHTML = "";
        }
        if (recommendationContainer) {
            recommendationContainer.innerHTML = "<p class=\"loading-message\">Preparing recommendations...</p>";
        }
        if (recommendationStatusElement) {
            setStatusMessage(recommendationStatusElement, "Preparing recommendations...", "loading");
        }
        if (statusElement) {
            setStatusMessage(statusElement, "Loading menu...", "loading");
        }
        renderCampusRecommendationNotice(
            campusRecommendationNotice,
            { recommendedItemId, found: false, focusedItems: [] },
            vendorName
        );

        // Fetch menu
        const result = await fetchVendorMenu({
            vendorUid,
            vendorName,
            orderService: options.orderService,
            firestoreFns: options.firestoreFns,
            db: options.db
        });

        setLoadingState(container, false);

        if (!result.success) {
            const errorMessage = result.error?.message || "Failed to load menu";
            if (statusElement) {
                setStatusMessage(statusElement, errorMessage, "error");
            }
            renderMenuItems([], container);
            if (paginationContainer) {
                paginationContainer.innerHTML = "";
            }
            renderRecommendations(
                { recommendations: [], status: "empty" },
                recommendationContainer,
                recommendationStatusElement
            );
            return { success: false, error: errorMessage };
        }

        const focusResult = applyRecommendedItemFocus(result.menuItems, recommendedItemId);
        renderCampusRecommendationNotice(campusRecommendationNotice, focusResult, vendorName);

        // Render the first page; pagination controls update state and re-render.
        const pageState = {
            allItems: focusResult.menuItems,
            page: clampPageNumber(options.initialPage, getTotalPages(focusResult.menuItems.length, pageSize)),
            pageSize
        };

        renderMenuPage(pageState, container, paginationContainer);

        let recommendationResult = null;
        if (recommendationContainer) {
            try {
                recommendationResult = await loadMenuRecommendations({
                    menuItems: focusResult.menuItems,
                    db: options.db,
                    auth: options.auth,
                    currentUser: options.currentUser,
                    firestoreFns: options.firestoreFns,
                    recommendationModel: options.recommendationModel,
                    recommendationQueries: options.recommendationQueries,
                    historyLimit: options.historyLimit,
                    modelOptions: {
                        maxRecommendations: options.maxRecommendations || 3
                    }
                });
                renderRecommendations(
                    recommendationResult,
                    recommendationContainer,
                    recommendationStatusElement
                );
            } catch (error) {
                recommendationResult = {
                    success: false,
                    recommendations: [],
                    error
                };
                renderRecommendations(
                    { recommendations: [], status: "empty" },
                    recommendationContainer,
                    recommendationStatusElement
                );
            }
        }

        if (statusElement) {
            const totalPages = getTotalPages(result.menuItems.length, pageSize);
            const message = result.count > 0
                ? `${result.count} item${result.count === 1 ? "" : "s"} available${totalPages > 1 ? ` (${totalPages} pages)` : ""}`
                : "No items available";
            const state = result.count > 0 ? "success" : "info";
            setStatusMessage(statusElement, message, state);
        }

        // Setup event listeners with cart update callback
        setupEventListeners(container, (cartResult) => {
            updateCartBadge(cartBadge);
            if (statusElement) {
                setStatusMessage(
                    statusElement,
                    `Added to cart! (${cartResult.cart.length} items)`,
                    "success"
                );
            }
        });
        setupEventListeners(recommendationContainer, (cartResult) => {
            updateCartBadge(cartBadge);
            if (recommendationStatusElement) {
                setStatusMessage(
                    recommendationStatusElement,
                    `Recommended item added to cart! (${cartResult.cart.length} items)`,
                    "success"
                );
            }
        });

        return {
            success: true,
            menuItemCount: result.count,
            menuItems: focusResult.menuItems,
            recommendedItemId,
            recommendedItemFound: focusResult.found,
            focusedRecommendationItems: focusResult.focusedItems,
            page: pageState.page,
            pageSize: pageState.pageSize,
            totalPages: getTotalPages(focusResult.menuItems.length, pageSize),
            recommendations: recommendationResult && Array.isArray(recommendationResult.recommendations)
                ? recommendationResult.recommendations
                : [],
            recommendationStatus: recommendationResult ? recommendationResult.status : "skipped",
            vendorUid,
            vendorName: decodeText(vendorName)
        };
        })();

        try {
            return await initInFlight;
        } finally {
            initInFlight = null;
        }
    }

    // ==========================================
    // MODULE EXPORTS
    // ==========================================

    const customerBrowseMenu = {
        init,
        fetchVendorMenu,
        resolveRecommendationModel,
        resolveRecommendationQueries,
        calculateMenuItemPricing,
        normalizeMenuItemData,
        normalizeMenuItemRecord,
        normalizeTagList,
        parseStoredTagList,
        getLocationSearch,
        normalizeItemLookupKey,
        getMenuItemLookupKeys,
        menuItemMatchesRecommendedId,
        applyRecommendedItemFocus,
        renderCampusRecommendationNotice,
        renderMenuItems,
        createRecommendationCard,
        renderRecommendations,
        loadMenuRecommendations,
        createMenuItemCard,
        setStatusMessage,
        setLoadingState,
        updateCartBadge,
        handleAddToCartClick,
        setupEventListeners,
        // Pagination
        DEFAULT_PAGE_SIZE,
        paginateItems,
        getTotalPages,
        clampPageNumber,
        renderPagination,
        renderMenuPage,
        getVisiblePageNumbers,
        // Cart functions
        getCart,
        saveCart,
        addToCart,
        getCartItemCount
    };

    // Export for Node.js (testing)
    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerBrowseMenu;
    }

    // Export to global scope (browser)
    if (typeof globalScope !== "undefined") {
        globalScope.customerBrowseMenu = customerBrowseMenu;
    }

})(typeof window !== "undefined" ? window : globalThis);
