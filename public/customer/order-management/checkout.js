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

    function resolveFunctions(explicitFunctions) {
        if (explicitFunctions) {
            return explicitFunctions;
        }

        if (globalScope.functions) {
            return globalScope.functions;
        }

        return null;
    }

    function resolveFunctionsFns(explicitFunctionsFns) {
        if (explicitFunctionsFns && typeof explicitFunctionsFns === "object") {
            return explicitFunctionsFns;
        }

        if (globalScope.functionsFns && typeof globalScope.functionsFns === "object") {
            return globalScope.functionsFns;
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

    function resolveCheckoutStatus(explicitCheckoutStatus) {
        if (explicitCheckoutStatus && typeof explicitCheckoutStatus.normalizeCheckoutStatus === "function") {
            return explicitCheckoutStatus;
        }

        if (globalScope.checkoutStatus && typeof globalScope.checkoutStatus.normalizeCheckoutStatus === "function") {
            return globalScope.checkoutStatus;
        }

        if (typeof require === "function") {
            try {
                return require("../../shared/checkout/checkout-status.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveCheckoutModel(explicitCheckoutModel) {
        if (explicitCheckoutModel && typeof explicitCheckoutModel.createCheckoutSessionRecord === "function") {
            return explicitCheckoutModel;
        }

        if (globalScope.checkoutModel && typeof globalScope.checkoutModel.createCheckoutSessionRecord === "function") {
            return globalScope.checkoutModel;
        }

        if (typeof require === "function") {
            try {
                return require("../../shared/checkout/checkout-model.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveCheckoutValidation(explicitCheckoutValidation) {
        if (explicitCheckoutValidation && typeof explicitCheckoutValidation.validateCreateCheckoutInput === "function") {
            return explicitCheckoutValidation;
        }

        if (
            globalScope.checkoutValidation &&
            typeof globalScope.checkoutValidation.validateCreateCheckoutInput === "function"
        ) {
            return globalScope.checkoutValidation;
        }

        if (typeof require === "function") {
            try {
                return require("../../shared/checkout/checkout-validation.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveCheckoutQueries(explicitCheckoutQueries) {
        if (explicitCheckoutQueries && typeof explicitCheckoutQueries.fetchResumableCustomerCheckout === "function") {
            return explicitCheckoutQueries;
        }

        if (
            globalScope.checkoutQueries &&
            typeof globalScope.checkoutQueries.fetchResumableCustomerCheckout === "function"
        ) {
            return globalScope.checkoutQueries;
        }

        if (typeof require === "function") {
            try {
                return require("../../shared/checkout/checkout-queries.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function resolveCheckoutService(explicitCheckoutService) {
        if (explicitCheckoutService && typeof explicitCheckoutService.createCheckout === "function") {
            return explicitCheckoutService;
        }

        if (globalScope.checkoutService && typeof globalScope.checkoutService.createCheckout === "function") {
            return globalScope.checkoutService;
        }

        if (typeof require === "function") {
            try {
                return require("../../shared/checkout/checkout-service.js");
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    function buildCheckoutDependencyOptions(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        return {
            checkoutStatus: resolveCheckoutStatus(safeOptions.checkoutStatus),
            checkoutModel: resolveCheckoutModel(safeOptions.checkoutModel),
            checkoutValidation: resolveCheckoutValidation(safeOptions.checkoutValidation),
            checkoutQueries: resolveCheckoutQueries(safeOptions.checkoutQueries)
        };
    }

    function supportsDirectOrderCreation(firestoreFns) {
        return !!(
            firestoreFns &&
            typeof firestoreFns.collection === "function" &&
            typeof firestoreFns.addDoc === "function" &&
            typeof firestoreFns.serverTimestamp === "function"
        );
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

    function getRequestedCheckoutId(options = {}) {
        const urlParams = new URLSearchParams(getLocationSearch(options));
        return normalizeText(options.checkoutId || options.sessionId || urlParams.get("checkoutId"));
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

    function getCheckoutStatusMetadata(status, options = {}) {
        const checkoutStatus = resolveCheckoutStatus(options.checkoutStatus);
        const normalizedStatus = checkoutStatus && typeof checkoutStatus.normalizeCheckoutStatus === "function"
            ? checkoutStatus.normalizeCheckoutStatus(status)
            : normalizeText(status);

        if (checkoutStatus && typeof checkoutStatus.getCheckoutStatusMetadata === "function") {
            return checkoutStatus.getCheckoutStatusMetadata(normalizedStatus);
        }

        return {
            label: normalizedStatus || "Checkout",
            description: "",
            actionLabel: "Resume Payment"
        };
    }

    function canCancelCheckout(checkoutRecord, options = {}) {
        const checkoutStatus = resolveCheckoutStatus(options.checkoutStatus);
        const status = normalizeText(checkoutRecord && checkoutRecord.status);

        if (checkoutStatus && typeof checkoutStatus.isCancellableCheckoutStatus === "function") {
            return checkoutStatus.isCancellableCheckoutStatus(status);
        }

        return ["draft", "payment_pending", "payment_failed"].includes(status);
    }

    function canResumeCheckout(checkoutRecord, options = {}) {
        const checkoutStatus = resolveCheckoutStatus(options.checkoutStatus);
        const status = normalizeText(checkoutRecord && checkoutRecord.status);

        if (checkoutStatus && typeof checkoutStatus.isResumableCheckoutStatus === "function") {
            return checkoutStatus.isResumableCheckoutStatus(status);
        }

        return ["draft", "payment_pending", "payment_failed"].includes(status);
    }

    function renderCheckoutSession(checkoutRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const statusElement = safeOptions.sessionStatusElement || null;
        const resumeButton = safeOptions.resumePaymentButton || null;
        const cancelButton = safeOptions.cancelCheckoutButton || null;
        const checkoutId = normalizeText(checkoutRecord && checkoutRecord.checkoutId);

        if (statusElement) {
            if (!checkoutId) {
                statusElement.textContent = "No unfinished checkout payment is selected.";
                statusElement.setAttribute("data-state", "info");
            } else {
                const metadata = getCheckoutStatusMetadata(checkoutRecord.status, safeOptions);
                const reference = normalizeText(checkoutRecord.paymentReference);
                statusElement.textContent = reference
                    ? `${metadata.label}: ${metadata.description} Reference ${reference}.`
                    : `${metadata.label}: ${metadata.description}`;
                statusElement.setAttribute("data-state", metadata.tone || "info");
            }
        }

        if (resumeButton) {
            resumeButton.disabled = !checkoutId || !canResumeCheckout(checkoutRecord, safeOptions);
            resumeButton.dataset.checkoutId = checkoutId;
        }

        if (cancelButton) {
            cancelButton.disabled = !checkoutId || !canCancelCheckout(checkoutRecord, safeOptions);
            cancelButton.dataset.checkoutId = checkoutId;
        }
    }

    function updateCheckoutView(context, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const vendorNameElement = safeOptions.vendorNameElement || null;
        const vendorNameHeading = safeOptions.vendorNameHeading || null;
        const placeOrderButton = safeOptions.placeOrderButton || null;

        renderCheckoutItems(context.vendorItems, safeOptions.container || null);
        renderCheckoutSummary(context, safeOptions.summarySection || null);

        if (vendorNameHeading) {
            vendorNameHeading.textContent = context.vendorName || "Checkout";
        }

        if (vendorNameElement) {
            const isHeadingElement = /^H[1-6]$/.test(vendorNameElement.tagName || "");
            vendorNameElement.textContent = isHeadingElement
                ? (context.vendorName || "Checkout")
                : (
                    context.vendorName
                        ? `Selected vendor: ${context.vendorName}`
                        : "Selected vendor: None"
                );
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
            ) || function noop() {
                return undefined;
            };

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
            paymentStatus: "unpaid",
            paymentProvider: "paystack",
            paymentReference: "",
            paymentAccessCode: "",
            paymentAuthorizationUrl: "",
            paymentAmount: context.subtotal,
            paymentAmountInMinorUnits: Math.round(context.subtotal * 100),
            paymentCurrency: "ZAR",
            paymentPaidAt: null,
            paymentFailedAt: null,
            paymentVerifiedAt: null,
            paymentFailureReason: "",

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

    function getOrderIdentifier(orderRecord) {
        const safeOrder = orderRecord && typeof orderRecord === "object" ? orderRecord : {};
        return normalizeText(safeOrder.orderId || safeOrder.id);
    }

    function buildPaymentOrder(orderRecord, fallbackContext = {}) {
        const safeOrder = orderRecord && typeof orderRecord === "object" ? orderRecord : {};
        const safeContext = fallbackContext && typeof fallbackContext === "object" ? fallbackContext : {};
        const orderId = getOrderIdentifier(safeOrder);
        const total = safeOrder.total !== undefined
            ? normalizePrice(safeOrder.total)
            : normalizePrice(safeContext.subtotal);

        return {
            ...safeOrder,
            orderId,
            customerUid: normalizeText(safeOrder.customerUid),
            customerName: normalizeText(safeOrder.customerName),
            customerEmail: normalizeText(safeOrder.customerEmail),
            vendorUid: normalizeText(safeOrder.vendorUid || safeContext.vendorUid),
            vendorName: normalizeText(safeOrder.vendorName || safeContext.vendorName),
            total,
            paymentAmount: safeOrder.paymentAmount !== undefined
                ? normalizePrice(safeOrder.paymentAmount)
                : total,
            paymentAmountInMinorUnits: safeOrder.paymentAmountInMinorUnits !== undefined
                ? Number.parseInt(safeOrder.paymentAmountInMinorUnits, 10)
                : Math.round(total * 100),
            paymentCurrency: normalizeText(safeOrder.paymentCurrency) || "ZAR",
            paymentProvider: normalizeText(safeOrder.paymentProvider) || "paystack"
        };
    }

    function shouldInitializePayment(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        if (safeOptions.requirePayment === false) {
            return false;
        }

        if (typeof safeOptions.initializePaymentCallable === "function") {
            return true;
        }

        if (
            safeOptions.paymentFunctions &&
            typeof safeOptions.paymentFunctions.initializePayment === "function"
        ) {
            return true;
        }

        const functions = resolveFunctions(safeOptions.functions);
        const functionsFns = resolveFunctionsFns(safeOptions.functionsFns);

        return !!(
            functions &&
            functionsFns &&
            typeof functionsFns.httpsCallable === "function"
        );
    }

    function resolveInitializePaymentCallable(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        if (typeof safeOptions.initializePaymentCallable === "function") {
            return safeOptions.initializePaymentCallable;
        }

        if (
            safeOptions.paymentFunctions &&
            typeof safeOptions.paymentFunctions.initializePayment === "function"
        ) {
            return safeOptions.paymentFunctions.initializePayment;
        }

        const functions = resolveFunctions(safeOptions.functions);
        const functionsFns = resolveFunctionsFns(safeOptions.functionsFns);

        if (
            functions &&
            functionsFns &&
            typeof functionsFns.httpsCallable === "function"
        ) {
            return functionsFns.httpsCallable(functions, "initializePayment");
        }

        return null;
    }

    function normalizeCallableResult(result) {
        if (result && typeof result === "object" && "data" in result) {
            return result.data;
        }

        return result;
    }

    function getPaymentCallbackUrl(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const explicitUrl = normalizeText(safeOptions.paymentCallbackUrl || safeOptions.callbackUrl);

        if (explicitUrl) {
            return explicitUrl;
        }

        const location = globalScope.location;
        const origin = normalizeText(location && location.origin);

        if (origin) {
            return `${origin}/customer/order-management/payment-callback.html`;
        }

        return "./payment-callback.html";
    }

    function appendUrlQueryParam(url, key, value) {
        const safeUrl = normalizeText(url);
        const safeKey = normalizeText(key);
        const safeValue = normalizeText(value);

        if (!safeUrl || !safeKey || !safeValue) {
            return safeUrl;
        }

        const separator = safeUrl.indexOf("?") === -1 ? "?" : "&";
        return `${safeUrl}${separator}${encodeURIComponent(safeKey)}=${encodeURIComponent(safeValue)}`;
    }

    function getPaymentCallbackUrlForCheckout(checkoutRecord, options = {}) {
        return appendUrlQueryParam(
            getPaymentCallbackUrl(options),
            "checkoutId",
            checkoutRecord && checkoutRecord.checkoutId
        );
    }

    async function updateOrderPaymentPatch(orderRecord, patch, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safePatch = patch && typeof patch === "object" ? patch : {};
        const firestoreFns = resolveFirestoreFns(safeOptions.firestoreFns);
        const db = safeOptions.db || resolveFirestore();
        const orderId = getOrderIdentifier(orderRecord);

        if (
            !db ||
            !orderId ||
            !safePatch ||
            Object.keys(safePatch).length === 0 ||
            typeof firestoreFns.doc !== "function" ||
            typeof firestoreFns.updateDoc !== "function"
        ) {
            return {
                success: false,
                skipped: true,
                error: {
                    code: "checkout/payment-patch-skipped",
                    message: "Order payment patch could not be saved from checkout."
                }
            };
        }

        const docRef = firestoreFns.doc(db, "orders", orderId);
        await firestoreFns.updateDoc(docRef, safePatch);

        return {
            success: true,
            docRef,
            patch: safePatch
        };
    }

    function navigateToPayment(authorizationUrl, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeUrl = normalizeText(authorizationUrl);

        if (!safeUrl) {
            return false;
        }

        if (typeof safeOptions.navigateToPayment === "function") {
            safeOptions.navigateToPayment(safeUrl);
            return true;
        }

        if (globalScope.location && typeof globalScope.location.assign === "function") {
            globalScope.location.assign(safeUrl);
            return true;
        }

        if (globalScope.location) {
            globalScope.location.href = safeUrl;
            return true;
        }

        return false;
    }

    async function initializeOrderPayment(orderRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};

        if (!shouldInitializePayment(safeOptions)) {
            return {
                success: true,
                skipped: true,
                paymentRequired: false
            };
        }

        const initializePaymentCallable = resolveInitializePaymentCallable(safeOptions);

        if (!initializePaymentCallable) {
            return {
                success: false,
                error: {
                    code: "checkout/payment-unavailable",
                    message: "Payment service is not available. Please try again later."
                }
            };
        }

        const paymentOrder = buildPaymentOrder(orderRecord, safeOptions.context);
        const callbackUrl = getPaymentCallbackUrl(safeOptions);

        try {
            const callableResult = await initializePaymentCallable({
                order: paymentOrder,
                options: {
                    callbackUrl
                }
            });
            const result = normalizeCallableResult(callableResult) || {};

            if (result.success !== true || !normalizeText(result.authorizationUrl)) {
                return {
                    success: false,
                    payment: result.payment || null,
                    patch: result.patch || null,
                    error: result.error || {
                        code: "checkout/payment-initialize-failed",
                        message: "Payment could not be started."
                    }
                };
            }

            let patchResult = result.patchResult || null;

            try {
                patchResult = patchResult || await updateOrderPaymentPatch(paymentOrder, result.patch, safeOptions);
            } catch (patchError) {
                console.warn(`${MODULE_NAME}: Browser payment patch failed; continuing because the payment function already initialized the transaction.`, patchError);
                patchResult = {
                    success: false,
                    skipped: true,
                    error: {
                        code: patchError?.code || "checkout/payment-patch-browser-failed",
                        message: patchError?.message || "Browser payment patch failed."
                    }
                };
            }

            navigateToPayment(result.authorizationUrl, safeOptions);

            return {
                success: true,
                paymentRequired: true,
                payment: result.payment || null,
                patch: result.patch || null,
                patchResult,
                authorizationUrl: result.authorizationUrl,
                accessCode: result.accessCode || "",
                reference: result.reference || ""
            };
        } catch (error) {
            console.error(`${MODULE_NAME}: Payment initialization failed:`, error);

            return {
                success: false,
                error: {
                    code: error?.code || "checkout/payment-initialize-failed",
                    message: error?.message || "Payment could not be started."
                }
            };
        }
    }

    function buildPaymentOrderFromCheckout(checkoutRecord) {
        const checkout = checkoutRecord && typeof checkoutRecord === "object" ? checkoutRecord : {};
        const checkoutId = normalizeText(checkout.checkoutId || checkout.id);
        const amount = normalizePrice(checkout.paymentAmount || checkout.total);

        return {
            orderId: checkoutId,
            checkoutId,
            customerUid: normalizeText(checkout.customerUid),
            customerName: normalizeText(checkout.customerName),
            customerEmail: normalizeText(checkout.customerEmail),
            vendorUid: normalizeText(checkout.vendorUid),
            vendorName: normalizeText(checkout.vendorName),
            total: normalizePrice(checkout.total || amount),
            paymentAmount: amount,
            paymentAmountInMinorUnits: Number.parseInt(checkout.paymentAmountInMinorUnits, 10) || Math.round(amount * 100),
            paymentCurrency: normalizeText(checkout.paymentCurrency) || "ZAR",
            paymentProvider: normalizeText(checkout.paymentProvider) || "paystack",
            paymentReference: normalizeText(checkout.paymentReference),
            metadata: {
                checkoutId,
                customerUid: normalizeText(checkout.customerUid),
                vendorUid: normalizeText(checkout.vendorUid),
                source: "checkout-session"
            }
        };
    }

    async function updateCheckoutPaymentPlan(checkoutRecord, initializeResult, options = {}) {
        const checkoutService = resolveCheckoutService(options.checkoutService);

        if (
            !checkoutService ||
            typeof checkoutService.applyInitializedPayment !== "function" ||
            typeof checkoutService.updateCheckoutWithPlan !== "function"
        ) {
            return {
                success: false,
                skipped: true,
                checkout: checkoutRecord
            };
        }

        const plan = checkoutService.applyInitializedPayment(
            checkoutRecord,
            {
                reference: initializeResult.reference,
                accessCode: initializeResult.accessCode,
                authorizationUrl: initializeResult.authorizationUrl
            },
            {
                ...options,
                ...buildCheckoutDependencyOptions(options),
                actorRole: "system"
            }
        );

        return checkoutService.updateCheckoutWithPlan(plan, {
            ...options,
            ...buildCheckoutDependencyOptions(options)
        });
    }

    async function markCheckoutPaymentFailed(checkoutRecord, failureDetails, options = {}) {
        const checkoutService = resolveCheckoutService(options.checkoutService);

        if (
            !checkoutService ||
            typeof checkoutService.applyFailedPayment !== "function" ||
            typeof checkoutService.updateCheckoutWithPlan !== "function"
        ) {
            return {
                success: false,
                skipped: true,
                checkout: checkoutRecord
            };
        }

        const plan = checkoutService.applyFailedPayment(
            checkoutRecord,
            failureDetails || {},
            {
                ...options,
                ...buildCheckoutDependencyOptions(options),
                actorRole: "customer"
            }
        );

        return checkoutService.updateCheckoutWithPlan(plan, {
            ...options,
            ...buildCheckoutDependencyOptions(options)
        });
    }

    async function createCheckoutSession(context, currentUser, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const checkoutService = resolveCheckoutService(safeOptions.checkoutService);
        const db = safeOptions.db || resolveFirestore();
        const firestoreFns = resolveFirestoreFns(safeOptions.firestoreFns);

        if (!checkoutService || typeof checkoutService.createCheckout !== "function") {
            return {
                success: false,
                error: {
                    code: "checkout/service-unavailable",
                    message: "Checkout session service is not available."
                }
            };
        }

        return checkoutService.createCheckout({
            ...safeOptions,
            ...buildCheckoutDependencyOptions(safeOptions),
            db,
            firestoreFns,
            cartItems: context.vendorItems,
            customer: buildCustomerSnapshot(currentUser),
            vendorUid: context.vendorUid,
            vendorName: context.vendorName,
            notes: normalizeText(safeOptions.orderNotes),
            metadata: {
                source: "customer-checkout-page"
            }
        });
    }

    async function initializeCheckoutSessionPayment(checkoutRecord, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const checkoutService = resolveCheckoutService(safeOptions.checkoutService);
        const db = safeOptions.db || resolveFirestore();
        const firestoreFns = resolveFirestoreFns(safeOptions.firestoreFns);

        if (!checkoutService || typeof checkoutService.initializeCheckoutPayment !== "function") {
            return {
                success: false,
                error: {
                    code: "checkout/service-unavailable",
                    message: "Checkout session service is not available."
                }
            };
        }

        const prepared = await checkoutService.initializeCheckoutPayment({
            ...safeOptions,
            ...buildCheckoutDependencyOptions(safeOptions),
            db,
            firestoreFns,
            checkout: checkoutRecord,
            callbackUrl: getPaymentCallbackUrlForCheckout(checkoutRecord, safeOptions),
            actorRole: "customer"
        });

        if (!prepared.success) {
            return prepared;
        }

        const initializePaymentCallable = resolveInitializePaymentCallable(safeOptions);

        if (!initializePaymentCallable) {
            return {
                success: false,
                checkout: prepared.checkout,
                error: {
                    code: "checkout/payment-unavailable",
                    message: "Payment service is not available. Please try again later."
                }
            };
        }

        try {
            const callableResult = await initializePaymentCallable({
                order: buildPaymentOrderFromCheckout(prepared.checkout),
                options: {
                    callbackUrl: getPaymentCallbackUrlForCheckout(prepared.checkout, safeOptions),
                    reference: prepared.checkout.paymentReference,
                    metadata: {
                        checkoutId: prepared.checkout.checkoutId,
                        customerUid: prepared.checkout.customerUid,
                        vendorUid: prepared.checkout.vendorUid,
                        source: "checkout-session"
                    }
                }
            });
            const result = normalizeCallableResult(callableResult) || {};

            if (result.success !== true || !normalizeText(result.authorizationUrl)) {
                await markCheckoutPaymentFailed(prepared.checkout, result.error, {
                    ...safeOptions,
                    db,
                    firestoreFns
                });

                return {
                    success: false,
                    checkout: prepared.checkout,
                    payment: result.payment || null,
                    error: result.error || {
                        code: "checkout/payment-initialize-failed",
                        message: "Payment could not be started."
                    }
                };
            }

            const savedPayment = await updateCheckoutPaymentPlan(prepared.checkout, result, {
                ...safeOptions,
                db,
                firestoreFns
            });
            const checkout = savedPayment.success
                ? savedPayment.checkout
                : {
                    ...prepared.checkout,
                    paymentReference: normalizeText(result.reference || prepared.checkout.paymentReference),
                    paymentAccessCode: normalizeText(result.accessCode || prepared.checkout.paymentAccessCode),
                    paymentAuthorizationUrl: normalizeText(result.authorizationUrl)
                };

            navigateToPayment(result.authorizationUrl, safeOptions);

            return {
                success: true,
                checkout,
                paymentRequired: true,
                payment: result.payment || null,
                authorizationUrl: result.authorizationUrl,
                accessCode: result.accessCode || "",
                reference: result.reference || checkout.paymentReference || ""
            };
        } catch (error) {
            await markCheckoutPaymentFailed(prepared.checkout, {
                message: error?.message || "Payment could not be started."
            }, {
                ...safeOptions,
                db,
                firestoreFns
            });

            return {
                success: false,
                checkout: prepared.checkout,
                error: {
                    code: error?.code || "checkout/payment-initialize-failed",
                    message: error?.message || "Payment could not be started."
                }
            };
        }
    }

    async function resumeCheckoutPayment(checkoutRecord, options = {}) {
        const checkout = checkoutRecord && typeof checkoutRecord === "object" ? checkoutRecord : {};
        const authorizationUrl = normalizeText(checkout.paymentAuthorizationUrl);

        if (authorizationUrl) {
            navigateToPayment(authorizationUrl, options);
            return {
                success: true,
                checkout,
                authorizationUrl,
                resumed: true
            };
        }

        return initializeCheckoutSessionPayment(checkout, options);
    }

    async function cancelCheckoutSession(checkoutRecord, options = {}) {
        const checkoutService = resolveCheckoutService(options.checkoutService);

        if (!checkoutService || typeof checkoutService.cancelCheckout !== "function") {
            return {
                success: false,
                error: {
                    code: "checkout/service-unavailable",
                    message: "Checkout session service is not available."
                }
            };
        }

        return checkoutService.cancelCheckout({
            ...options,
            ...buildCheckoutDependencyOptions(options),
            checkout: checkoutRecord,
            actorRole: "customer",
            note: "Customer cancelled checkout before payment was completed."
        });
    }

    async function findResumableCheckout(context, currentUser, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const checkoutQueries = resolveCheckoutQueries(safeOptions.checkoutQueries);
        const checkoutService = resolveCheckoutService(safeOptions.checkoutService);
        const db = safeOptions.db || resolveFirestore();
        const firestoreFns = resolveFirestoreFns(safeOptions.firestoreFns);
        const checkoutId = getRequestedCheckoutId(safeOptions);
        const customerUid = normalizeText(currentUser && currentUser.uid);

        if (checkoutId && checkoutService && typeof checkoutService.getCheckoutById === "function") {
            const checkout = await checkoutService.getCheckoutById({
                ...safeOptions,
                ...buildCheckoutDependencyOptions(safeOptions),
                db,
                firestoreFns,
                checkoutId
            });

            if (
                checkout &&
                (!context.vendorUid || checkout.vendorUid === context.vendorUid) &&
                (!customerUid || checkout.customerUid === customerUid) &&
                canResumeCheckout(checkout, safeOptions)
            ) {
                return checkout;
            }
        }

        if (
            !checkoutQueries ||
            typeof checkoutQueries.fetchResumableCustomerCheckout !== "function" ||
            !db ||
            !customerUid
        ) {
            return null;
        }

        const checkout = await checkoutQueries.fetchResumableCustomerCheckout({
            ...safeOptions,
            ...buildCheckoutDependencyOptions(safeOptions),
            db,
            firestoreFns,
            customerUid
        });

        if (
            checkout &&
            (!context.vendorUid || checkout.vendorUid === context.vendorUid) &&
            canResumeCheckout(checkout, safeOptions)
        ) {
            return checkout;
        }

        return null;
    }

    async function placeOrder(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const context = safeOptions.context || buildCheckoutContext(safeOptions);
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

        const orderNotes = normalizeText(safeOptions.orderNotes);

        try {
            const resumableCheckout = await findResumableCheckout(context, currentUser, safeOptions);

            if (resumableCheckout) {
                const resumedPayment = await resumeCheckoutPayment(resumableCheckout, {
                    ...safeOptions,
                    db,
                    firestoreFns,
                    context
                });

                if (!resumedPayment.success) {
                    return {
                        success: false,
                        checkout: resumableCheckout,
                        payment: resumedPayment,
                        error: resumedPayment.error
                    };
                }

                return {
                    success: true,
                    checkout: resumedPayment.checkout,
                    payment: resumedPayment,
                    source: "checkout-session-resume"
                };
            }

            const checkoutResult = await createCheckoutSession(context, currentUser, {
                ...safeOptions,
                db,
                firestoreFns,
                orderNotes
            });

            if (!checkoutResult.success) {
                return checkoutResult;
            }

            const paymentResult = await initializeCheckoutSessionPayment(checkoutResult.checkout, {
                ...safeOptions,
                db,
                firestoreFns,
                context
            });

            if (!paymentResult.success) {
                return {
                    success: false,
                    checkout: checkoutResult.checkout,
                    payment: paymentResult,
                    error: paymentResult.error
                };
            }

            return {
                success: true,
                checkout: paymentResult.checkout,
                payment: paymentResult,
                source: "checkout-session"
            };
        } catch (error) {
            console.error(`${MODULE_NAME}: placeOrder failed:`, error);

            return {
                success: false,
                error: {
                    code: error?.code || "checkout/place-order-failed",
                    message: error?.message || "Failed to start checkout payment."
                }
            };
        }
    }

    async function loadAndRenderResumableCheckout(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const context = safeOptions.context || buildCheckoutContext(safeOptions);
        const auth = safeOptions.auth || resolveAuth();
        const authFns = resolveAuthFns(safeOptions.authFns);
        const currentUser = safeOptions.currentUser || await waitForAuthReady(auth, authFns);

        if (!currentUser || !normalizeText(currentUser.uid)) {
            renderCheckoutSession(null, safeOptions);
            return null;
        }

        try {
            const checkout = await findResumableCheckout(context, currentUser, safeOptions);
            renderCheckoutSession(checkout, safeOptions);
            return checkout;
        } catch (error) {
            console.warn(`${MODULE_NAME}: Could not load resumable checkout session.`, error);
            renderCheckoutSession(null, safeOptions);
            return null;
        }
    }

    function setupEventListeners(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const backButtonHost = safeOptions.backButtonHost || null;
        const placeOrderButton = safeOptions.placeOrderButton || null;
        const resumePaymentButton = safeOptions.resumePaymentButton || null;
        const cancelCheckoutButton = safeOptions.cancelCheckoutButton || null;
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

                setStatusMessage(statusElement, "Saving checkout and starting payment...", "loading");

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
                            : "Failed to start checkout payment.",
                        "error"
                    );

                    placeOrderButton.disabled = context.vendorItems.length === 0 || !context.vendorUid;
                    return;
                }

                const refreshedContext = buildCheckoutContext(safeOptions);
                updateCheckoutView(refreshedContext, safeOptions);
                renderCheckoutSession(result.checkout, safeOptions);
                setStatusMessage(
                    statusElement,
                    result.payment && result.payment.paymentRequired
                        ? "Checkout saved. Redirecting you to Paystack to complete payment."
                        : "Checkout saved. You can resume or cancel it before payment.",
                    "success"
                );
            });
        }

        if (resumePaymentButton && !resumePaymentButton.dataset.bound) {
            resumePaymentButton.dataset.bound = "true";

            resumePaymentButton.addEventListener("click", async function onResumePaymentClick() {
                resumePaymentButton.disabled = true;
                setStatusMessage(statusElement, "Finding your unfinished checkout...", "loading");

                const context = buildCheckoutContext(safeOptions);
                const checkout = await loadAndRenderResumableCheckout({
                    ...safeOptions,
                    context
                });

                if (!checkout) {
                    setStatusMessage(statusElement, "No unfinished checkout payment is available to resume.", "error");
                    resumePaymentButton.disabled = false;
                    return;
                }

                const result = await resumeCheckoutPayment(checkout, {
                    ...safeOptions,
                    context
                });

                if (!result.success) {
                    setStatusMessage(
                        statusElement,
                        result.error && result.error.message
                            ? result.error.message
                            : "Failed to resume checkout payment.",
                        "error"
                    );
                    resumePaymentButton.disabled = false;
                    return;
                }

                renderCheckoutSession(result.checkout, safeOptions);
                setStatusMessage(statusElement, "Redirecting you to Paystack to complete payment.", "success");
            });
        }

        if (cancelCheckoutButton && !cancelCheckoutButton.dataset.bound) {
            cancelCheckoutButton.dataset.bound = "true";

            cancelCheckoutButton.addEventListener("click", async function onCancelCheckoutClick() {
                cancelCheckoutButton.disabled = true;
                setStatusMessage(statusElement, "Cancelling the unfinished checkout...", "loading");

                const context = buildCheckoutContext(safeOptions);
                const checkout = await loadAndRenderResumableCheckout({
                    ...safeOptions,
                    context
                });

                if (!checkout) {
                    setStatusMessage(statusElement, "No unfinished checkout payment is available to cancel.", "error");
                    cancelCheckoutButton.disabled = false;
                    return;
                }

                const result = await cancelCheckoutSession(checkout, safeOptions);

                if (!result.success) {
                    setStatusMessage(
                        statusElement,
                        result.error && result.error.message
                            ? result.error.message
                            : "Failed to cancel checkout.",
                        "error"
                    );
                    cancelCheckoutButton.disabled = false;
                    return;
                }

                renderCheckoutSession(result.checkout, safeOptions);
                setStatusMessage(statusElement, "Checkout cancelled. Your cart items are still available.", "success");
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
            const sessionStatusSelector = options.sessionStatusSelector || "#checkout-session-status";
            const resumePaymentButtonSelector = options.resumePaymentButtonSelector || "#resume-payment-button";
            const cancelCheckoutButtonSelector = options.cancelCheckoutButtonSelector || "#cancel-checkout-button";

            const container = globalScope.document.querySelector(containerSelector);
            const summarySection = globalScope.document.querySelector(summarySelector);
            const statusElement = globalScope.document.querySelector(statusSelector);
            const vendorNameElement = globalScope.document.querySelector(vendorNameSelector);
            const notesInput = globalScope.document.querySelector(notesSelector);
            const placeOrderButton = globalScope.document.querySelector(placeOrderButtonSelector);
            const backButtonHost = globalScope.document.querySelector(backButtonHostSelector);
            const sessionStatusElement = globalScope.document.querySelector(sessionStatusSelector);
            const resumePaymentButton = globalScope.document.querySelector(resumePaymentButtonSelector);
            const cancelCheckoutButton = globalScope.document.querySelector(cancelCheckoutButtonSelector);

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
                backButtonHost,
                sessionStatusElement,
                resumePaymentButton,
                cancelCheckoutButton
            });

            const resumableCheckout = await loadAndRenderResumableCheckout({
                ...options,
                context,
                sessionStatusElement,
                resumePaymentButton,
                cancelCheckoutButton
            });

            return {
                success: true,
                context,
                resumableCheckout
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
        resolveFunctions,
        resolveFunctionsFns,
        resolveOrderService,
        resolveCheckoutStatus,
        resolveCheckoutModel,
        resolveCheckoutValidation,
        resolveCheckoutQueries,
        resolveCheckoutService,
        buildCheckoutDependencyOptions,
        getFallbackRoutes,
        getLocationSearch,
        getRequestedCheckoutId,
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
        getCheckoutStatusMetadata,
        canCancelCheckout,
        canResumeCheckout,
        renderCheckoutSession,
        updateCheckoutView,
        waitForAuthReady,
        createOrderDirectly,
        supportsDirectOrderCreation,
        getOrderIdentifier,
        buildPaymentOrder,
        shouldInitializePayment,
        resolveInitializePaymentCallable,
        normalizeCallableResult,
        getPaymentCallbackUrl,
        appendUrlQueryParam,
        getPaymentCallbackUrlForCheckout,
        updateOrderPaymentPatch,
        navigateToPayment,
        initializeOrderPayment,
        buildPaymentOrderFromCheckout,
        updateCheckoutPaymentPlan,
        markCheckoutPaymentFailed,
        createCheckoutSession,
        initializeCheckoutSessionPayment,
        resumeCheckoutPayment,
        cancelCheckoutSession,
        findResumableCheckout,
        placeOrder,
        loadAndRenderResumableCheckout,
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
