(function attachCustomerOrderManagementCart(globalScope) {
    "use strict";

    const MODULE_NAME = "customer/order-management/cart";
    const CART_STORAGE_KEY = "campus-food-cart";
    let initInFlight = null;

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
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

    function formatCurrency(value) {
        return `R${normalizePrice(value).toFixed(2)}`;
    }

    function getStorageArea() {
        if (globalScope.__campusFoodTestLocalStorage) {
            return globalScope.__campusFoodTestLocalStorage;
        }

        if (typeof globalThis !== "undefined" && globalThis.__campusFoodTestLocalStorage) {
            return globalThis.__campusFoodTestLocalStorage;
        }

        if (globalScope.localStorage) {
            return globalScope.localStorage;
        }

        if (typeof globalThis !== "undefined" && globalThis.localStorage) {
            return globalThis.localStorage;
        }

        return null;
    }

    function getFallbackRoutes() {
        return {
            home: "../index.html",
            browseVendors: "./browse-vendors.html",
            checkout: "./checkout.html",
            orders: "../order-tracking/index.html"
        };
    }

    function getCart() {
        try {
            const storageArea = getStorageArea();
            const cartJson = storageArea?.getItem(CART_STORAGE_KEY);

            if (!cartJson) {
                return [];
            }

            const parsedCart = JSON.parse(cartJson);
            return Array.isArray(parsedCart) ? parsedCart : [];
        } catch (error) {
            console.error(`${MODULE_NAME}: Error reading cart:`, error);
            return [];
        }
    }

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

    function normalizeCartItem(item, fallbackIndex = 0) {
        const safeItem = item && typeof item === "object" ? item : {};
        const menuItemId = normalizeText(safeItem.menuItemId || safeItem.id || `item-${fallbackIndex + 1}`);
        const vendorUid = normalizeText(safeItem.vendorUid);

        return {
            menuItemId,
            vendorUid,
            vendorName: normalizeText(safeItem.vendorName) || "Unknown Vendor",
            name: normalizeText(safeItem.name) || "Unknown Item",
            category: normalizeText(safeItem.category) || "Other",
            price: normalizePrice(safeItem.price),
            quantity: normalizePositiveQuantity(safeItem.quantity, 1),
            photoURL: normalizeText(safeItem.photoURL),
            notes: normalizeText(safeItem.notes),
            itemKey: `${vendorUid || "vendor"}::${menuItemId}`
        };
    }

    function getNormalizedCart() {
        return getCart().map(function mapOneItem(item, index) {
            return normalizeCartItem(item, index);
        });
    }

    function updateItemQuantity(cartItems, itemKey, quantity) {
        const safeCart = Array.isArray(cartItems) ? cartItems : [];
        const safeQuantity = normalizePositiveQuantity(quantity, 1);

        return safeCart.map(function updateOneItem(item, index) {
            const normalizedItem = normalizeCartItem(item, index);

            if (normalizedItem.itemKey !== normalizeText(itemKey)) {
                return normalizedItem;
            }

            return {
                ...normalizedItem,
                quantity: safeQuantity
            };
        });
    }

    function removeItemFromCart(cartItems, itemKey) {
        const safeCart = Array.isArray(cartItems) ? cartItems : [];

        return safeCart
            .map(function normalizeOne(item, index) {
                return normalizeCartItem(item, index);
            })
            .filter(function keepItem(item) {
                return item.itemKey !== normalizeText(itemKey);
            });
    }

    function clearCart() {
        return saveCart([]);
    }

    function groupCartItemsByVendor(cartItems) {
        const safeItems = Array.isArray(cartItems) ? cartItems : [];
        const vendorMap = new Map();

        safeItems.forEach(function groupItem(item) {
            const normalizedItem = normalizeCartItem(item);
            const vendorKey = normalizedItem.vendorUid || normalizedItem.vendorName;

            if (!vendorMap.has(vendorKey)) {
                vendorMap.set(vendorKey, {
                    vendorUid: normalizedItem.vendorUid,
                    vendorName: normalizedItem.vendorName,
                    items: [],
                    itemCount: 0,
                    subtotal: 0
                });
            }

            const vendorGroup = vendorMap.get(vendorKey);
            vendorGroup.items.push(normalizedItem);
            vendorGroup.itemCount += normalizedItem.quantity;
            vendorGroup.subtotal += normalizedItem.price * normalizedItem.quantity;
        });

        return Array.from(vendorMap.values()).sort(function sortVendorGroups(a, b) {
            const aName = normalizeText(a.vendorName).toLowerCase();
            const bName = normalizeText(b.vendorName).toLowerCase();

            if (aName < bName) {
                return -1;
            }

            if (aName > bName) {
                return 1;
            }

            return 0;
        });
    }

    function calculateCartSummary(cartItems) {
        const safeItems = Array.isArray(cartItems) ? cartItems : [];

        return safeItems.reduce(function buildSummary(summary, item) {
            const normalizedItem = normalizeCartItem(item);

            summary.vendorCount = groupCartItemsByVendor(safeItems).length;
            summary.itemCount += normalizedItem.quantity;
            summary.lineCount += 1;
            summary.subtotal += normalizedItem.price * normalizedItem.quantity;
            return summary;
        }, {
            vendorCount: 0,
            itemCount: 0,
            lineCount: 0,
            subtotal: 0
        });
    }

    function setStatusMessage(element, message, state = "info") {
        if (!element) {
            return;
        }

        element.textContent = normalizeText(message);
        element.setAttribute("data-state", normalizeText(state) || "info");
    }

    function createBackButton(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const button = globalScope.document.createElement("button");
        const fallbackRoute = normalizeText(safeOptions.fallbackRoute) || getFallbackRoutes().home;

        button.type = "button";
        button.className = "button-secondary cart-back-button";
        button.textContent = normalizeText(safeOptions.label) || "Back";

        button.addEventListener("click", function handleBackClick() {
            if (
                globalScope.history &&
                typeof globalScope.history.back === "function" &&
                globalScope.history.length > 1
            ) {
                globalScope.history.back();
                return;
            }

            globalScope.location.href = fallbackRoute;
        });

        return button;
    }

    function buildCheckoutUrl(vendorGroup) {
        const url = new URL(getFallbackRoutes().checkout, globalScope.location.href);
        const safeVendorGroup = vendorGroup && typeof vendorGroup === "object" ? vendorGroup : {};

        if (normalizeText(safeVendorGroup.vendorUid)) {
            url.searchParams.set("vendorUid", normalizeText(safeVendorGroup.vendorUid));
        }

        if (normalizeText(safeVendorGroup.vendorName)) {
            url.searchParams.set("vendorName", normalizeText(safeVendorGroup.vendorName));
        }

        return url.toString();
    }

    function createCartItemArticle(item) {
        const safeItem = normalizeCartItem(item);
        const article = globalScope.document.createElement("article");
        article.className = "cart-item-card";
        article.setAttribute("data-item-key", safeItem.itemKey);

        const heading = globalScope.document.createElement("h4");
        heading.className = "cart-item-name";
        heading.textContent = safeItem.name;

        const categoryLine = globalScope.document.createElement("p");
        categoryLine.className = "cart-item-category";
        categoryLine.textContent = safeItem.category;

        const priceLine = globalScope.document.createElement("p");
        priceLine.className = "cart-item-price";
        priceLine.textContent = `Unit Price: ${formatCurrency(safeItem.price)}`;

        const totalLine = globalScope.document.createElement("p");
        totalLine.className = "cart-item-total";
        totalLine.textContent = `Line Total: ${formatCurrency(safeItem.price * safeItem.quantity)}`;

        const controls = globalScope.document.createElement("section");
        controls.className = "cart-item-controls";

        const quantityLabel = globalScope.document.createElement("label");
        quantityLabel.className = "cart-item-quantity-label";
        quantityLabel.htmlFor = `cart-quantity-${safeItem.itemKey}`;
        quantityLabel.textContent = "Quantity";

        const quantityInput = globalScope.document.createElement("input");
        quantityInput.type = "number";
        quantityInput.min = "1";
        quantityInput.max = "99";
        quantityInput.value = String(safeItem.quantity);
        quantityInput.id = `cart-quantity-${safeItem.itemKey}`;
        quantityInput.className = "cart-item-quantity-input";
        quantityInput.setAttribute("data-item-key", safeItem.itemKey);

        const updateButton = globalScope.document.createElement("button");
        updateButton.type = "button";
        updateButton.className = "button-secondary cart-update-button";
        updateButton.textContent = "Update";
        updateButton.setAttribute("data-item-key", safeItem.itemKey);

        const removeButton = globalScope.document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "button-secondary cart-remove-button";
        removeButton.textContent = "Remove";
        removeButton.setAttribute("data-item-key", safeItem.itemKey);

        controls.appendChild(quantityLabel);
        controls.appendChild(quantityInput);
        controls.appendChild(updateButton);
        controls.appendChild(removeButton);

        article.appendChild(heading);
        article.appendChild(categoryLine);
        article.appendChild(priceLine);
        article.appendChild(totalLine);
        article.appendChild(controls);

        return article;
    }

    function createVendorGroupSection(vendorGroup) {
        const safeGroup = vendorGroup && typeof vendorGroup === "object" ? vendorGroup : {
            vendorUid: "",
            vendorName: "Unknown Vendor",
            items: [],
            itemCount: 0,
            subtotal: 0
        };
        const section = globalScope.document.createElement("section");
        section.className = "cart-vendor-group";
        section.setAttribute("data-vendor-uid", normalizeText(safeGroup.vendorUid));

        const heading = globalScope.document.createElement("h3");
        heading.className = "cart-vendor-heading";
        heading.textContent = safeGroup.vendorName;

        const summaryLine = globalScope.document.createElement("p");
        summaryLine.className = "cart-vendor-summary";
        summaryLine.textContent = `${safeGroup.itemCount} item${safeGroup.itemCount === 1 ? "" : "s"} • ${formatCurrency(safeGroup.subtotal)}`;

        const itemsSection = globalScope.document.createElement("section");
        itemsSection.className = "cart-vendor-items";

        safeGroup.items.forEach(function appendItem(item) {
            itemsSection.appendChild(createCartItemArticle(item));
        });

        const actions = globalScope.document.createElement("menu");
        actions.className = "action-menu cart-vendor-actions";
        actions.setAttribute("aria-label", `${safeGroup.vendorName} actions`);

        const browseItem = globalScope.document.createElement("li");
        const browseLink = globalScope.document.createElement("a");
        browseLink.href = `./browse-menu.html?vendorUid=${encodeURIComponent(safeGroup.vendorUid)}&vendorName=${encodeURIComponent(safeGroup.vendorName)}`;
        browseLink.className = "button-secondary";
        browseLink.textContent = "Add More";
        browseItem.appendChild(browseLink);

        const checkoutItem = globalScope.document.createElement("li");
        const checkoutLink = globalScope.document.createElement("a");
        checkoutLink.href = buildCheckoutUrl(safeGroup);
        checkoutLink.className = "button-primary";
        checkoutLink.textContent = "Checkout Vendor";
        checkoutItem.appendChild(checkoutLink);

        actions.appendChild(browseItem);
        actions.appendChild(checkoutItem);

        section.appendChild(heading);
        section.appendChild(summaryLine);
        section.appendChild(itemsSection);
        section.appendChild(actions);

        return section;
    }

    function renderCart(cartItems, container) {
        if (!container) {
            return;
        }

        container.innerHTML = "";
        const groupedItems = groupCartItemsByVendor(cartItems);

        if (groupedItems.length === 0) {
            const message = globalScope.document.createElement("p");
            message.className = "empty-state-message";
            message.textContent = "Your cart is empty. Browse vendors to add items.";
            container.appendChild(message);
            return;
        }

        groupedItems.forEach(function appendGroup(group) {
            container.appendChild(createVendorGroupSection(group));
        });
    }

    function renderCartSummary(summary, summarySection) {
        if (!summarySection) {
            return;
        }

        summarySection.innerHTML = "";
        const safeSummary = summary && typeof summary === "object" ? summary : calculateCartSummary([]);

        const heading = globalScope.document.createElement("h3");
        heading.textContent = "Cart Summary";

        const lineCount = globalScope.document.createElement("p");
        lineCount.textContent = `Lines in Cart: ${safeSummary.lineCount}`;

        const vendorCount = globalScope.document.createElement("p");
        vendorCount.textContent = `Vendors in Cart: ${safeSummary.vendorCount}`;

        const itemCount = globalScope.document.createElement("p");
        itemCount.textContent = `Total Items: ${safeSummary.itemCount}`;

        const subtotal = globalScope.document.createElement("p");
        subtotal.textContent = `Subtotal: ${formatCurrency(safeSummary.subtotal)}`;

        summarySection.appendChild(heading);
        summarySection.appendChild(lineCount);
        summarySection.appendChild(vendorCount);
        summarySection.appendChild(itemCount);
        summarySection.appendChild(subtotal);
    }

    function refreshCartView(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const cartItems = getNormalizedCart();
        const summary = calculateCartSummary(cartItems);

        renderCart(cartItems, safeOptions.container || null);
        renderCartSummary(summary, safeOptions.summarySection || null);

        if (safeOptions.statusElement) {
            if (summary.lineCount === 0) {
                setStatusMessage(safeOptions.statusElement, "Your cart is empty.", "info");
            } else {
                setStatusMessage(
                    safeOptions.statusElement,
                    `${summary.itemCount} item${summary.itemCount === 1 ? "" : "s"} ready for checkout across ${summary.vendorCount} vendor${summary.vendorCount === 1 ? "" : "s"}.`,
                    "success"
                );
            }
        }

        if (safeOptions.checkoutLink) {
            safeOptions.checkoutLink.setAttribute(
                "aria-disabled",
                summary.lineCount === 0 ? "true" : "false"
            );
            safeOptions.checkoutLink.classList.toggle("is-disabled", summary.lineCount === 0);
        }

        return {
            cartItems,
            summary
        };
    }

    function handleCartInteraction(event, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const target = event && event.target ? event.target : null;

        if (!target || typeof target.closest !== "function") {
            return null;
        }

        const removeButton = target.closest(".cart-remove-button");
        if (removeButton) {
            const itemKey = normalizeText(removeButton.getAttribute("data-item-key"));
            const nextCart = removeItemFromCart(getNormalizedCart(), itemKey);
            saveCart(nextCart);
            refreshCartView(safeOptions);
            return { action: "remove", itemKey, cart: nextCart };
        }

        const updateButton = target.closest(".cart-update-button");
        if (updateButton) {
            const itemKey = normalizeText(updateButton.getAttribute("data-item-key"));
            const quantityInput = safeOptions.container
                ? safeOptions.container.querySelector(`.cart-item-quantity-input[data-item-key="${itemKey}"]`)
                : null;
            const nextCart = updateItemQuantity(
                getNormalizedCart(),
                itemKey,
                quantityInput ? quantityInput.value : 1
            );

            saveCart(nextCart);
            refreshCartView(safeOptions);
            return { action: "update", itemKey, cart: nextCart };
        }

        const clearButton = target.closest(".cart-clear-button");
        if (clearButton) {
            clearCart();
            refreshCartView(safeOptions);
            return { action: "clear", cart: [] };
        }

        return null;
    }

    function setupEventListeners(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const container = safeOptions.container || null;
        const clearButton = safeOptions.clearButton || null;
        const backButtonHost = safeOptions.backButtonHost || null;

        if (container) {
            container.addEventListener("click", function onContainerClick(event) {
                handleCartInteraction(event, safeOptions);
            });
        }

        if (clearButton && !clearButton.dataset.bound) {
            clearButton.dataset.bound = "true";
            clearButton.addEventListener("click", function onClearCart() {
                clearCart();
                refreshCartView(safeOptions);
            });
        }

        if (backButtonHost && !backButtonHost.querySelector(".cart-back-button")) {
            backButtonHost.appendChild(createBackButton({
                fallbackRoute: getFallbackRoutes().browseVendors
            }));
        }
    }

    async function init(options = {}) {
        if (initInFlight) {
            return initInFlight;
        }

        initInFlight = (async function runInit() {
            const containerSelector = options.containerSelector || "#cart-items-container";
            const summarySelector = options.summarySelector || "#cart-summary";
            const statusSelector = options.statusSelector || "#cart-status";
            const clearButtonSelector = options.clearButtonSelector || "#clear-cart-button";
            const checkoutLinkSelector = options.checkoutLinkSelector || "#checkout-link";
            const backButtonHostSelector = options.backButtonHostSelector || "#cart-back-button-host";

            const container = globalScope.document.querySelector(containerSelector);
            const summarySection = globalScope.document.querySelector(summarySelector);
            const statusElement = globalScope.document.querySelector(statusSelector);
            const clearButton = globalScope.document.querySelector(clearButtonSelector);
            const checkoutLink = globalScope.document.querySelector(checkoutLinkSelector);
            const backButtonHost = globalScope.document.querySelector(backButtonHostSelector);

            if (!container) {
                return {
                    success: false,
                    error: "Cart container not found."
                };
            }

            const refreshed = refreshCartView({
                container,
                summarySection,
                statusElement,
                checkoutLink
            });

            setupEventListeners({
                container,
                summarySection,
                statusElement,
                clearButton,
                checkoutLink,
                backButtonHost
            });

            return {
                success: true,
                cartItems: refreshed.cartItems,
                summary: refreshed.summary
            };
        })();

        try {
            return await initInFlight;
        } finally {
            initInFlight = null;
        }
    }

    const customerOrderManagementCart = {
        MODULE_NAME,
        CART_STORAGE_KEY,
        normalizeText,
        normalizePrice,
        normalizePositiveQuantity,
        formatCurrency,
        getStorageArea,
        getFallbackRoutes,
        getCart,
        saveCart,
        normalizeCartItem,
        getNormalizedCart,
        updateItemQuantity,
        removeItemFromCart,
        clearCart,
        groupCartItemsByVendor,
        calculateCartSummary,
        setStatusMessage,
        createBackButton,
        buildCheckoutUrl,
        createCartItemArticle,
        createVendorGroupSection,
        renderCart,
        renderCartSummary,
        refreshCartView,
        handleCartInteraction,
        setupEventListeners,
        init
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerOrderManagementCart;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.customerOrderManagementCart = customerOrderManagementCart;
    }
})(typeof window !== "undefined" ? window : globalThis);
