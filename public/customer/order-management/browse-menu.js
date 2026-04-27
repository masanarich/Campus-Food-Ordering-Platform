// public/customer/order-management/browse-menu.js

(function attachCustomerBrowseMenu(globalScope) {
    "use strict";

    const MODULE_NAME = "customer/order-management/browse-menu";
    const CART_STORAGE_KEY = "campus-food-cart";
    const DEFAULT_PAGE_SIZE = 10;
    const MAX_VISIBLE_PAGE_BUTTONS = 5;
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

    function normalizePrice(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
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

    function normalizeMenuItemRecord(docSnapshot, vendorUid, vendorName) {
        const data = docSnapshot && typeof docSnapshot.data === "function"
            ? (docSnapshot.data() || {})
            : {};
        const itemId = normalizeText(docSnapshot && docSnapshot.id) || normalizeText(data.menuItemId || data.id);
        const availabilityValue = normalizeLowerText(data.availability);
        const availableFlag =
            availabilityValue
                ? availabilityValue !== "unavailable"
                : data.available !== false;

        return {
            menuItemId: itemId,
            id: itemId,
            vendorUid: normalizeText(data.vendorUid) || normalizeText(vendorUid),
            vendorName: normalizeText(data.vendorName) || decodeText(vendorName),
            name: normalizeText(data.name) || "Unknown Item",
            category: normalizeText(data.category) || "Other",
            description: normalizeText(data.description),
            price: normalizePrice(data.price),
            photoURL: normalizeText(data.photoURL || data.photoDataUrl || data.photoUrl),
            available: availableFlag,
            soldOut: data.soldOut === true,
            allergens: Array.isArray(data.allergens) ? data.allergens : [],
            dietary: Array.isArray(data.dietary)
                ? data.dietary
                : (Array.isArray(data.dietaryTags) ? data.dietaryTags : [])
        };
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
        } else {
            // Add new item
            cart.push({
                menuItemId: safeItem.menuItemId || safeItem.id,
                vendorUid: normalizeText(safeItem.vendorUid),
                vendorName: normalizeText(safeItem.vendorName),
                name: normalizeText(safeItem.name) || "Unknown Item",
                category: normalizeText(safeItem.category) || "Other",
                price: normalizePrice(safeItem.price),
                quantity: safeQuantity,
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
                    return result;
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

    /**
     * Create menu item card
     * @param {Object} item - Menu item
     * @returns {HTMLElement} Article element
     */
    function createMenuItemCard(item) {
        const safeItem = item && typeof item === "object" ? item : {};
        const article = globalScope.document.createElement("article");
        article.className = safeItem.available ? "menu-item-card" : "menu-item-card unavailable";
        article.setAttribute("data-menu-item-id", safeItem.menuItemId || safeItem.id);

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
        category.textContent = normalizeText(safeItem.category) || "Other";

        section.appendChild(heading);
        section.appendChild(category);

        if (normalizeText(safeItem.description)) {
            const description = globalScope.document.createElement("p");
            description.className = "menu-item-description";
            description.textContent = normalizeText(safeItem.description);
            section.appendChild(description);
        }

        // Dietary info
        if (Array.isArray(safeItem.dietary) && safeItem.dietary.length > 0) {
            const dietary = globalScope.document.createElement("p");
            dietary.className = "menu-item-dietary";
            dietary.textContent = safeItem.dietary.join(", ");
            section.appendChild(dietary);
        }

        // Price and actions
        const footer = globalScope.document.createElement("footer");
        footer.className = "menu-item-footer";

        const price = globalScope.document.createElement("p");
        price.className = "menu-item-price";
        const priceStrong = globalScope.document.createElement("strong");
        priceStrong.textContent = `R${normalizePrice(safeItem.price).toFixed(2)}`;
        price.appendChild(priceStrong);

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
        menuItems.forEach((item) => {
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
        const priceEl = card.querySelector(".menu-item-price strong");
        const categoryEl = card.querySelector(".menu-item-category");

        if (!nameEl || !priceEl) {
            console.error(`${MODULE_NAME}: Could not find item details`);
            return;
        }

        const name = nameEl.textContent;
        const priceText = priceEl.textContent.replace("R", "");
        const price = parseFloat(priceText);
        const category = categoryEl ? categoryEl.textContent : "Other";

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
            price: normalizePrice(price)
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
        const pageSize = clampPageSize(options.pageSize);

        // Get vendor info from URL
        const urlParams = new URLSearchParams(getLocationSearch(options));
        const vendorUid = normalizeText(options.vendorUid || urlParams.get("vendorUid"));
        const vendorName = options.vendorName || urlParams.get("vendorName");

        if (!vendorUid) {
            console.error(`${MODULE_NAME}: No vendor UID provided`);
            return { success: false, error: "No vendor UID provided" };
        }

        const container = globalScope.document.querySelector(containerSelector);
        const statusElement = globalScope.document.querySelector(statusSelector);
        const cartBadge = globalScope.document.querySelector(cartBadgeSelector);
        const vendorNameElement = globalScope.document.querySelector(vendorNameSelector);
        const paginationContainer = globalScope.document.querySelector(paginationSelector);

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
        if (statusElement) {
            setStatusMessage(statusElement, "Loading menu...", "loading");
        }

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
            return { success: false, error: errorMessage };
        }

        // Render the first page; pagination controls update state and re-render.
        const pageState = {
            allItems: result.menuItems,
            page: clampPageNumber(options.initialPage, getTotalPages(result.menuItems.length, pageSize)),
            pageSize
        };

        renderMenuPage(pageState, container, paginationContainer);

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

        return {
            success: true,
            menuItemCount: result.count,
            menuItems: result.menuItems,
            page: pageState.page,
            pageSize: pageState.pageSize,
            totalPages: getTotalPages(result.menuItems.length, pageSize),
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
        normalizeMenuItemRecord,
        getLocationSearch,
        renderMenuItems,
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
