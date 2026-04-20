(function attachCustomerCheckout(globalScope) {
    "use strict";

    const MODULE_NAME = "customer/order-management/checkout";
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

    function resolveFirestore(explicitDb) {
        if (explicitDb) {
            return explicitDb;
        }

        if (globalScope.db) {
            return globalScope.db;
        }

        return null;
    }

    function resolveAuth(explicitAuth) {
        if (explicitAuth) {
            return explicitAuth;
        }

        if (globalScope.auth) {
            return globalScope.auth;
        }

        return null;
    }

    function resolveAuthFns(explicitAuthFns) {
        if (explicitAuthFns && typeof explicitAuthFns === "object") {
            return explicitAuthFns;
        }

        if (globalScope.authFns && typeof globalScope.authFns === "object") {
            return globalScope.authFns;
        }

        return {};
    }

    function resolveFirestoreFns(explicitFirestoreFns) {
        if (explicitFirestoreFns && typeof explicitFirestoreFns === "object") {
            return explicitFirestoreFns;
        }

        if (globalScope.firestoreFns && typeof globalScope.firestoreFns === "object") {
            return globalScope.firestoreFns;
        }

        return {};
    }

    function resolveOrderService(explicitOrderService) {
        if (explicitOrderService && typeof explicitOrderService.createOrders === "function") {
            return explicitOrderService;
        }

        if (globalScope.orderService && typeof globalScope.orderService.createOrders === "function") {
            return globalScope.orderService;
        }

        return null;
    }

    function getFallbackRoutes() {
        return {
            home: "../index.html",
            browseVendors: "./browse-vendors.html",
            cart: "./cart.html",
            orders: "../order-tracking/index.html"
        };
    }

    function getLocationSearch(options = {}) {
        if (typeof options.search === "string") {
            return options.search;
        }

        return globalScope.location?.search || "";
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

    function buildCheckoutContext(options = {}) {
        const urlParams = new URLSearchParams(getLocationSearch(options));
        const allCartItems = getCart().map(function normalizeOne(item, index) {
            return normalizeCartItem(item, index);
        });

        const requestedVendorUid = normalizeText(options.vendorUid || urlParams.get("vendorUid"));
        const requestedVendorName = decodeText(options.vendorName || urlParams.get("vendorName"));

        const groupedVendorKeys = allCartItems.reduce(function collect(keys, item) {
            if (item.vendorUid && !keys.includes(item.vendorUid)) {
                keys.push(item.vendorUid);
            }
            return keys;
        }, []);

        const fallbackVendorUid = requestedVendorUid || normalizeText(groupedVendorKeys[0]);
        const vendorItems = fallbackVendorUid
            ? allCartItems.filter(function matchVendor(item) {
                return item.vendorUid === fallbackVendorUid;
            })
            : [];

        const derivedVendorName = vendorItems[0] ? vendorItems[0].vendorName : "";
        const vendorName = requestedVendorName || derivedVendorName || "Unknown Vendor";

        const subtotal = vendorItems.reduce(function sumSubtotal(total, item) {
            return total + (item.price * item.quantity);
        }, 0);

        const itemCount = vendorItems.reduce(function sumQuantity(total, item) {
            return total + item.quantity;
        }, 0);

        return {
            vendorUid: fallbackVendorUid,
            vendorName,
            vendorItems,
            allCartItems,
            subtotal,
            itemCount
        };
    }

    function buildCustomerSnapshot(user) {
        const safeUser = user && typeof user === "object" ? user : {};

        return {
            customerUid: normalizeText(safeUser.uid),
            customerName: normalizeText(safeUser.displayName) || "Customer",
            customerEmail: normalizeText(safeUser.email)
        };
    }

    function removeVendorItemsFromCart(cartItems, vendorUid) {
        const safeVendorUid = normalizeText(vendorUid);
        const safeCart = Array.isArray(cartItems) ? cartItems : [];

        return safeCart
            .map(function normalizeOne(item, index) {
                return normalizeCartItem(item, index);
            })
            .filter(function keepItem(item) {
                return item.vendorUid !== safeVendorUid;
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
        const fallbackRoute = normalizeText(safeOptions.fallbackRoute) || getFallbackRoutes().cart;

        button.type = "button";
        button.className = "button-secondary checkout-back-button";
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

    function createCheckoutItemArticle(item) {
        const safeItem = normalizeCartItem(item);
        const article = globalScope.document.createElement("article");
        article.className = "checkout-item-card";
        article.setAttribute("data-item-key", safeItem.itemKey);

        const heading = globalScope.document.createElement("h4");
        heading.className = "checkout-item-name";
        heading.textContent = safeItem.name;

        const categoryLine = globalScope.document.createElement("p");
        categoryLine.className = "checkout-item-category";
        categoryLine.textContent = safeItem.category;

        const quantityLine = globalScope.document.createElement("p");
        quantityLine.className = "checkout-item-quantity";
        quantityLine.textContent = `Quantity: ${safeItem.quantity}`;

        const unitPriceLine = globalScope.document.createElement("p");
        unitPriceLine.className = "checkout-item-price";
        unitPriceLine.textContent = `Unit Price: ${formatCurrency(safeItem.price)}`;

        const totalLine = globalScope.document.createElement("p");
        totalLine.className = "checkout-item-total";
        totalLine.textContent = `Line Total: ${formatCurrency(safeItem.price * safeItem.quantity)}`;

        article.appendChild(heading);
        article.appendChild(categoryLine);
        article.appendChild(quantityLine);
        article.appendChild(unitPriceLine);
        article.appendChild(totalLine);

        return article;
    }

    function renderCheckoutItems(items, container) {
        if (!container) {
            return;
        }

        container.innerHTML = "";
        const safeItems = Array.isArray(items) ? items : [];

        if (safeItems.length === 0) {
            const message = globalScope.document.createElement("p");
            message.className = "empty-state-message";
            message.textContent = "No cart items are available for this vendor.";
            container.appendChild(message);
            return;
        }

        safeItems.forEach(function appendItem(item) {
            container.appendChild(createCheckoutItemArticle(item));
        });
    }

    function renderCheckoutSummary(context, summarySection) {
        if (!summarySection) {
            return;
        }

        summarySection.innerHTML = "";
        const safeContext = context && typeof context === "object" ? context : buildCheckoutContext();

        const vendorLine = globalScope.document.createElement("p");
        vendorLine.textContent = `Vendor: ${safeContext.vendorName || "Unknown Vendor"}`;

        const itemCountLine = globalScope.document.createElement("p");
        itemCountLine.textContent = `Items: ${safeContext.itemCount}`;

        const totalLine = globalScope.document.createElement("p");
        totalLine.textContent = `Total: ${formatCurrency(safeContext.subtotal)}`;

        summarySection.appendChild(vendorLine);
        summarySection.appendChild(itemCountLine);
        summarySection.appendChild(totalLine);
    }

    function updateCheckoutView(context, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const vendorNameElement = safeOptions.vendorNameElement || null;
        const placeOrderButton = safeOptions.placeOrderButton || null;

        renderCheckoutItems(context.vendorItems, safeOptions.container || null);
        renderCheckoutSummary(context, safeOptions.summarySection || null);

        if (vendorNameElement) {
            vendorNameElement.textContent = context.vendorName
                ? `Selected vendor: ${context.vendorName}`
                : "Selected vendor: None";
        }

        if (safeOptions.statusElement) {
            if (!context.vendorUid) {
                setStatusMessage(safeOptions.statusElement, "Choose a vendor from your cart before checkout.", "error");
            } else if (context.vendorItems.length === 0) {
                setStatusMessage(safeOptions.statusElement, "No cart items are available for this vendor.", "info");
            } else {
                setStatusMessage(
                    safeOptions.statusElement,
                    `${context.itemCount} item${context.itemCount === 1 ? "" : "s"} ready to order from ${context.vendorName || "this vendor"}.`,
                    "success"
                );
            }
        }

        if (placeOrderButton) {
            placeOrderButton.disabled = context.vendorItems.length === 0 || !context.vendorUid;
        }

        return context;
    }

    function waitForAuthReady(auth, authFns, timeoutMs = 5000) {
        if (!auth || !authFns || typeof authFns.onAuthStateChanged !== "function") {
            return Promise.resolve(auth?.currentUser || null);
        }

        return new Promise(function resolveAuthState(resolve) {
            let settled = false;
            let unsubscribe = function noop() {
                return undefined;
            };

            function finish(user) {
                if (settled) {
                    return;
                }

                settled = true;
                unsubscribe();
                resolve(user || null);
            }

            unsubscribe = authFns.onAuthStateChanged(
                auth,
                function onChange(user) {
                    finish(user);
                },
                function onError() {
                    finish(auth.currentUser || null);
                }
            );

            globalScope.setTimeout(function onTimeout() {
                finish(auth.currentUser || null);
            }, timeoutMs);
        });
    }

    async function createOrderDirectly(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const firestoreFns = resolveFirestoreFns(safeOptions.firestoreFns);
        const db = safeOptions.db || resolveFirestore();
        const context = safeOptions.context || buildCheckoutContext(safeOptions);
        const currentUser = safeOptions.currentUser || null;
        const orderNotes = normalizeText(safeOptions.orderNotes);

        if (!db) {
            throw new Error("Firestore database not available.");
        }

        if (
            !firestoreFns ||
            typeof firestoreFns.collection !== "function" ||
            typeof firestoreFns.addDoc !== "function" ||
            typeof firestoreFns.serverTimestamp !== "function"
        ) {
            throw new Error("Firestore functions not available.");
        }

        const customer = buildCustomerSnapshot(currentUser);

        const orderItems = context.vendorItems.map(function mapItem(item) {
            const safeItem = normalizeCartItem(item);
            return {
                menuItemId: safeItem.menuItemId,
                vendorUid: safeItem.vendorUid,
                vendorName: safeItem.vendorName,
                name: safeItem.name,
                category: safeItem.category,
                price: safeItem.price,
                quantity: safeItem.quantity,
                photoURL: safeItem.photoURL,
                notes: safeItem.notes
            };
        });

        const orderPayload = {
            customerUid: customer.customerUid,
            customerName: customer.customerName,
            customerEmail: customer.customerEmail,

            vendorUid: context.vendorUid,
            vendorName: context.vendorName,

            items: orderItems,
            itemCount: context.itemCount,

            subtotal: context.subtotal,
            total: context.subtotal,
            totalAmount: context.subtotal,

            notes: orderNotes,
            status: "placed",

            createdAt: firestoreFns.serverTimestamp(),
            updatedAt: firestoreFns.serverTimestamp()
        };

        const orderRef = await firestoreFns.addDoc(
            firestoreFns.collection(db, "orders"),
            orderPayload
        );

        if (typeof firestoreFns.collection === "function" && typeof firestoreFns.addDoc === "function") {
            try {
                await firestoreFns.addDoc(
                    firestoreFns.collection(db, "notifications"),
                    {
                        recipientUid: context.vendorUid,
                        recipientRole: "vendor",
                        type: "order-created",
                        title: "New order received",
                        message: `${customer.customerName} placed a new order.`,
                        orderId: orderRef.id,
                        vendorUid: context.vendorUid,
                        customerUid: customer.customerUid,
                        isRead: false,
                        createdAt: firestoreFns.serverTimestamp(),
                        updatedAt: firestoreFns.serverTimestamp()
                    }
                );
            } catch (notificationError) {
                console.warn(`${MODULE_NAME}: Vendor notification could not be created.`, notificationError);
            }

            try {
                await firestoreFns.addDoc(
                    firestoreFns.collection(db, "notifications"),
                    {
                        recipientUid: customer.customerUid,
                        recipientRole: "customer",
                        type: "order-created",
                        title: "Order placed",
                        message: `Your order with ${context.vendorName} has been placed.`,
                        orderId: orderRef.id,
                        vendorUid: context.vendorUid,
                        customerUid: customer.customerUid,
                        isRead: false,
                        createdAt: firestoreFns.serverTimestamp(),
                        updatedAt: firestoreFns.serverTimestamp()
                    }
                );
            } catch (notificationError) {
                console.warn(`${MODULE_NAME}: Customer notification could not be created.`, notificationError);
            }
        }

        return {
            success: true,
            orders: [
                {
                    id: orderRef.id,
                    ...orderPayload
                }
            ],
            createdAt: new Date().toISOString(),
            source: "direct-firestore"
        };
    }

    async function placeOrder(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const context = safeOptions.context || buildCheckoutContext(safeOptions);
        const orderService = resolveOrderService(safeOptions.orderService);
        const firestoreFns = resolveFirestoreFns(safeOptions.firestoreFns);
        const db = safeOptions.db || resolveFirestore();
        const auth = safeOptions.auth || resolveAuth();
        const authFns = resolveAuthFns(safeOptions.authFns);
        const currentUser = safeOptions.currentUser || await waitForAuthReady(auth, authFns);

        if (!context.vendorUid || context.vendorItems.length === 0) {
            return {
                success: false,
                error: {
                    code: "checkout/no-items",
                    message: "There are no cart items to place for this vendor."
                }
            };
        }

        if (!currentUser || !normalizeText(currentUser.uid)) {
            return {
                success: false,
                error: {
                    code: "checkout/not-signed-in",
                    message: "Please sign in before placing an order."
                }
            };
        }

        if (!db) {
            return {
                success: false,
                error: {
                    code: "checkout/no-db",
                    message: "Firestore database not available."
                }
            };
        }

        if (
            !firestoreFns ||
            typeof firestoreFns.collection !== "function" ||
            typeof firestoreFns.serverTimestamp !== "function"
        ) {
            return {
                success: false,
                error: {
                    code: "checkout/no-firestore-fns",
                    message: "Firestore functions not available."
                }
            };
        }

        const orderNotes = normalizeText(safeOptions.orderNotes);

        try {
            if (orderService && typeof orderService.createOrders === "function") {
                const result = await orderService.createOrders({
                    db,
                    firestoreFns,
                    cartItems: context.vendorItems,
                    customer: buildCustomerSnapshot(currentUser),
                    notes: orderNotes
                });

                if (result && result.success === true) {
                    saveCart(removeVendorItemsFromCart(context.allCartItems, context.vendorUid));

                    return {
                        success: true,
                        orders: Array.isArray(result.orders) ? result.orders : [],
                        createdAt: result.createdAt || null,
                        source: "shared-order-service"
                    };
                }

                if (result && result.error && result.error.message) {
                    console.warn(`${MODULE_NAME}: Shared order service returned an error. Falling back to direct Firestore create.`, result.error);
                }
            }

            const fallbackResult = await createOrderDirectly({
                ...safeOptions,
                currentUser,
                context,
                orderNotes
            });

            if (fallbackResult && fallbackResult.success) {
                saveCart(removeVendorItemsFromCart(context.allCartItems, context.vendorUid));
                return fallbackResult;
            }

            return {
                success: false,
                error: {
                    code: "checkout/place-order-failed",
                    message: "Failed to place your order."
                }
            };
        } catch (error) {
            console.error(`${MODULE_NAME}: placeOrder failed:`, error);

            return {
                success: false,
                error: {
                    code: error?.code || "checkout/place-order-failed",
                    message: error?.message || "Failed to place your order."
                }
            };
        }
    }

    function setupEventListeners(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const backButtonHost = safeOptions.backButtonHost || null;
        const placeOrderButton = safeOptions.placeOrderButton || null;
        const notesInput = safeOptions.notesInput || null;
        const statusElement = safeOptions.statusElement || null;

        if (backButtonHost && !backButtonHost.querySelector(".checkout-back-button")) {
            backButtonHost.appendChild(createBackButton({
                fallbackRoute: getFallbackRoutes().cart
            }));
        }

        if (placeOrderButton && !placeOrderButton.dataset.bound) {
            placeOrderButton.dataset.bound = "true";

            placeOrderButton.addEventListener("click", async function onPlaceOrderClick() {
                placeOrderButton.disabled = true;

                const context = buildCheckoutContext(safeOptions);

                if (!context.vendorUid || context.vendorItems.length === 0) {
                    updateCheckoutView(context, safeOptions);
                    setStatusMessage(statusElement, "No cart items are available for this vendor.", "error");
                    placeOrderButton.disabled = true;
                    return;
                }

                setStatusMessage(statusElement, "Placing your order...", "loading");

                const result = await placeOrder({
                    ...safeOptions,
                    context,
                    orderNotes: notesInput ? notesInput.value : ""
                });

                if (!result.success) {
                    setStatusMessage(
                        statusElement,
                        result.error && result.error.message
                            ? result.error.message
                            : "Failed to place your order.",
                        "error"
                    );

                    placeOrderButton.disabled = context.vendorItems.length === 0 || !context.vendorUid;
                    return;
                }

                const refreshedContext = buildCheckoutContext(safeOptions);
                updateCheckoutView(refreshedContext, safeOptions);
                setStatusMessage(statusElement, "Order placed successfully. You can now track it from My Orders.", "success");
            });
        }
    }

    async function init(options = {}) {
        if (initInFlight) {
            return initInFlight;
        }

        initInFlight = (async function runInit() {
            const containerSelector = options.containerSelector || "#checkout-items-container";
            const summarySelector = options.summarySelector || "#checkout-summary";
            const statusSelector = options.statusSelector || "#checkout-status";
            const vendorNameSelector = options.vendorNameSelector || "#checkout-vendor-name";
            const notesSelector = options.notesSelector || "#checkout-notes";
            const placeOrderButtonSelector = options.placeOrderButtonSelector || "#place-order-button";
            const backButtonHostSelector = options.backButtonHostSelector || "#checkout-back-button-host";

            const container = globalScope.document.querySelector(containerSelector);
            const summarySection = globalScope.document.querySelector(summarySelector);
            const statusElement = globalScope.document.querySelector(statusSelector);
            const vendorNameElement = globalScope.document.querySelector(vendorNameSelector);
            const notesInput = globalScope.document.querySelector(notesSelector);
            const placeOrderButton = globalScope.document.querySelector(placeOrderButtonSelector);
            const backButtonHost = globalScope.document.querySelector(backButtonHostSelector);

            if (!container) {
                return {
                    success: false,
                    error: "Checkout container not found."
                };
            }

            const context = buildCheckoutContext(options);

            updateCheckoutView(context, {
                container,
                summarySection,
                statusElement,
                vendorNameElement,
                placeOrderButton
            });

            setupEventListeners({
                ...options,
                container,
                summarySection,
                statusElement,
                vendorNameElement,
                notesInput,
                placeOrderButton,
                backButtonHost
            });

            return {
                success: true,
                context
            };
        })();

        try {
            return await initInFlight;
        } finally {
            initInFlight = null;
        }
    }

    const customerCheckout = {
        MODULE_NAME,
        CART_STORAGE_KEY,
        normalizeText,
        normalizePrice,
        normalizePositiveQuantity,
        formatCurrency,
        decodeText,
        getStorageArea,
        resolveFirestore,
        resolveAuth,
        resolveAuthFns,
        resolveFirestoreFns,
        resolveOrderService,
        getFallbackRoutes,
        getLocationSearch,
        getCart,
        saveCart,
        normalizeCartItem,
        buildCheckoutContext,
        buildCustomerSnapshot,
        removeVendorItemsFromCart,
        setStatusMessage,
        createBackButton,
        createCheckoutItemArticle,
        renderCheckoutItems,
        renderCheckoutSummary,
        updateCheckoutView,
        waitForAuthReady,
        createOrderDirectly,
        placeOrder,
        setupEventListeners,
        init
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerCheckout;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.customerCheckout = customerCheckout;
    }
})(typeof window !== "undefined" ? window : globalThis);