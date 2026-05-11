(function initPaymentModule(globalScope) {
    "use strict";

    const MODULE_NAME = "customer/order-management/payment";
    let initInFlight = null;

    function resolveFirestore() {
        if (globalScope.db && typeof globalScope.db === "object") {
            return globalScope.db;
        }

        if (
            globalScope.firebase &&
            typeof globalScope.firebase.firestore === "function"
        ) {
            return globalScope.firebase.firestore();
        }

        return null;
    }

    function resolveAuth() {
        if (globalScope.auth && typeof globalScope.auth === "object") {
            return globalScope.auth;
        }

        if (globalScope.firebase && typeof globalScope.firebase.auth === "function") {
            return globalScope.firebase.auth();
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

    function normalizeText(value) {
        if (typeof value !== "string") {
            return "";
        }
        return value.trim();
    }

    function formatCurrency(amount) {
        const num = typeof amount === "number" ? amount : parseFloat(amount) || 0;
        return "R" + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function getOrderIdFromUrl() {
        const urlParams = new URLSearchParams(globalScope.location?.search || "");
        return normalizeText(urlParams.get("orderId"));
    }

    function setStatusMessage(element, message, state = "info") {
        if (!element) {
            return;
        }

        element.textContent = normalizeText(message);
        element.setAttribute("data-state", normalizeText(state) || "info");
        element.className = `status-message show ${state}`;
    }

    function clearStatusMessage(element) {
        if (!element) {
            return;
        }

        element.textContent = "";
        element.className = "status-message";
    }

    function calculatePlatformFee(subtotal, feePercentage = 0.1) {
        return Math.round(subtotal * feePercentage * 100) / 100;
    }

    async function fetchOrderDetails(orderId, db, firestoreFns) {
        if (!db || !firestoreFns) {
            throw new Error("Firestore database not available");
        }

        if (!normalizeText(orderId)) {
            throw new Error("Invalid order ID");
        }

        const { getDoc, doc, collection } = firestoreFns;

        if (typeof getDoc !== "function" || typeof doc !== "function") {
            throw new Error("Firestore functions not available");
        }

        try {
            const orderDocRef = doc(collection(db, "orders"), orderId);
            const orderSnapshot = await getDoc(orderDocRef);

            if (!orderSnapshot.exists()) {
                throw new Error("Order not found");
            }

            return {
                id: orderSnapshot.id,
                ...orderSnapshot.data()
            };
        } catch (error) {
            console.error(`${MODULE_NAME}: Error fetching order:`, error);
            throw error;
        }
    }

    function renderOrderItems(items, container) {
        if (!container) {
            return;
        }

        container.innerHTML = "";

        const safeItems = Array.isArray(items) ? items : [];

        if (safeItems.length === 0) {
            const message = globalScope.document.createElement("p");
            message.style.textAlign = "center";
            message.style.color = "#999";
            message.textContent = "No items in this order.";
            container.appendChild(message);
            return;
        }

        safeItems.forEach(function renderItem(item) {
            const safeItem = item && typeof item === "object" ? item : {};
            const itemDiv = globalScope.document.createElement("div");
            itemDiv.className = "order-item";

            const infoDiv = globalScope.document.createElement("div");
            infoDiv.className = "item-info";

            const nameSpan = globalScope.document.createElement("span");
            nameSpan.className = "item-name";
            nameSpan.textContent = normalizeText(safeItem.name) || "Unknown Item";

            const quantitySpan = globalScope.document.createElement("span");
            quantitySpan.className = "item-quantity";
            const qty = typeof safeItem.quantity === "number" ? safeItem.quantity : 1;
            quantitySpan.textContent = `Qty: ${qty}`;

            infoDiv.appendChild(nameSpan);
            infoDiv.appendChild(quantitySpan);

            const priceSpan = globalScope.document.createElement("span");
            priceSpan.className = "item-price";
            const price = typeof safeItem.price === "number" ? safeItem.price : 0;
            const lineTotal = Math.round(price * qty * 100) / 100;
            priceSpan.textContent = formatCurrency(lineTotal);

            itemDiv.appendChild(infoDiv);
            itemDiv.appendChild(priceSpan);
            container.appendChild(itemDiv);
        });
    }

    function updatePaymentSummary(orderData, platformFeePercentage = 0.1) {
        const subtotal = typeof orderData.subtotal === "number" ? orderData.subtotal : 0;
        const deliveryFee = typeof orderData.deliveryFee === "number" ? orderData.deliveryFee : 0;
        const platformFee = calculatePlatformFee(subtotal, platformFeePercentage);
        const total = Math.round((subtotal + deliveryFee + platformFee) * 100) / 100;

        // Update form fields
        const vendorNameEl = globalScope.document.getElementById("vendor-name");
        if (vendorNameEl) {
            vendorNameEl.textContent = normalizeText(orderData.vendorName) || "Unknown Vendor";
        }

        const orderIdEl = globalScope.document.getElementById("order-id");
        if (orderIdEl) {
            orderIdEl.textContent = normalizeText(orderData.id) || "N/A";
        }

        const orderDateEl = globalScope.document.getElementById("order-date");
        if (orderDateEl) {
            try {
                const createdAt = orderData.createdAt;
                let dateStr = "N/A";

                if (createdAt) {
                    if (typeof createdAt.toDate === "function") {
                        dateStr = createdAt.toDate().toLocaleDateString();
                    } else if (typeof createdAt === "string") {
                        dateStr = new Date(createdAt).toLocaleDateString();
                    }
                }

                orderDateEl.textContent = dateStr;
            } catch (error) {
                console.warn("Error formatting date:", error);
                orderDateEl.textContent = "N/A";
            }
        }

        const subtotalEl = globalScope.document.getElementById("subtotal");
        if (subtotalEl) {
            subtotalEl.textContent = formatCurrency(subtotal);
        }

        const deliveryFeeEl = globalScope.document.getElementById("delivery-fee");
        if (deliveryFeeEl) {
            deliveryFeeEl.textContent = formatCurrency(deliveryFee);
        }

        const platformFeeEl = globalScope.document.getElementById("platform-fee");
        if (platformFeeEl) {
            platformFeeEl.textContent = formatCurrency(platformFee);
        }

        const totalEl = globalScope.document.getElementById("total-amount");
        if (totalEl) {
            totalEl.textContent = formatCurrency(total);
        }

        return {
            subtotal,
            deliveryFee,
            platformFee,
            total
        };
    }

    async function initiatePayment(orderId, orderData) {
        if (typeof globalScope.paymentIntegration === "undefined") {
            throw new Error("Payment integration not available");
        }

        if (typeof globalScope.paymentIntegration.generatePayFastCheckoutUrl !== "function") {
            throw new Error("PayFast integration not available");
        }

        try {
            const result = await globalScope.paymentIntegration.generatePayFastCheckoutUrl(
                orderId,
                {
                    orderData
                }
            );

            if (result && result.paymentUrl) {
                return result;
            }

            throw new Error(result?.message || "Failed to generate payment URL");
        } catch (error) {
            console.error(`${MODULE_NAME}: Payment initiation error:`, error);
            throw error;
        }
    }

    function setupEventListeners(orderId, orderData) {
        const continueBtn = globalScope.document.getElementById("continue-payment-btn");
        const backBtn = globalScope.document.getElementById("back-button");
        const statusEl = globalScope.document.getElementById("status-message");

        if (backBtn && !backBtn.dataset.bound) {
            backBtn.dataset.bound = "true";
            backBtn.addEventListener("click", function onBackClick() {
                globalScope.history.back();
            });
        }

        if (continueBtn && !continueBtn.dataset.bound) {
            continueBtn.dataset.bound = "true";
            continueBtn.disabled = false;

            continueBtn.addEventListener("click", async function onContinueClick() {
                continueBtn.disabled = true;

                setStatusMessage(
                    statusEl,
                    "Redirecting to PayFast...",
                    "loading"
                );

                try {
                    const paymentResult = await initiatePayment(orderId, orderData);

                    if (paymentResult && paymentResult.paymentUrl) {
                        // Redirect to PayFast
                        globalScope.location.href = paymentResult.paymentUrl;
                    } else {
                        throw new Error("No payment URL returned");
                    }
                } catch (error) {
                    console.error(`${MODULE_NAME}: Payment error:`, error);
                    setStatusMessage(
                        statusEl,
                        error?.message || "Failed to initiate payment. Please try again.",
                        "error"
                    );
                    continueBtn.disabled = false;
                }
            });
        }
    }

    async function init(options = {}) {
        if (initInFlight) {
            return initInFlight;
        }

        initInFlight = (async function runInit() {
            try {
                const db = options.db || resolveFirestore();
                const auth = options.auth || resolveAuth();
                const authFns = resolveAuthFns(options.authFns);
                const firestoreFns = resolveFirestoreFns(options.firestoreFns);
                const statusEl = globalScope.document.getElementById("status-message");

                const orderId = getOrderIdFromUrl();

                if (!orderId) {
                    setStatusMessage(
                        statusEl,
                        "Order ID not found. Please go back and try again.",
                        "error"
                    );
                    return {
                        success: false,
                        error: "No order ID in URL"
                    };
                }

                if (!db) {
                    setStatusMessage(
                        statusEl,
                        "Database not available. Please try again later.",
                        "error"
                    );
                    return {
                        success: false,
                        error: "Firestore not available"
                    };
                }

                setStatusMessage(statusEl, "Loading order details...", "loading");

                const orderData = await fetchOrderDetails(orderId, db, firestoreFns);

                clearStatusMessage(statusEl);

                // Render order items
                const itemsContainer = globalScope.document.getElementById("order-items-list");
                renderOrderItems(orderData.items || [], itemsContainer);

                // Update payment summary
                updatePaymentSummary(orderData);

                // Setup event listeners
                setupEventListeners(orderId, orderData);

                return {
                    success: true,
                    orderId,
                    orderData
                };
            } catch (error) {
                console.error(`${MODULE_NAME}: Init error:`, error);
                const statusEl = globalScope.document.getElementById("status-message");
                setStatusMessage(
                    statusEl,
                    error?.message || "Failed to load order. Please try again.",
                    "error"
                );

                return {
                    success: false,
                    error: error?.message || "Initialization failed"
                };
            }
        })();

        try {
            return await initInFlight;
        } finally {
            initInFlight = null;
        }
    }

    const paymentModule = {
        MODULE_NAME,
        resolveFirestore,
        resolveAuth,
        resolveAuthFns,
        resolveFirestoreFns,
        normalizeText,
        formatCurrency,
        getOrderIdFromUrl,
        setStatusMessage,
        clearStatusMessage,
        calculatePlatformFee,
        fetchOrderDetails,
        renderOrderItems,
        updatePaymentSummary,
        initiatePayment,
        setupEventListeners,
        init
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = paymentModule;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.paymentModule = paymentModule;
    }
})(typeof window !== "undefined" ? window : globalThis);
