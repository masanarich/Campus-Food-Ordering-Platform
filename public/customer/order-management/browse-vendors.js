// public/customer/order-management/browse-vendors.js

(function attachCustomerBrowseVendors(globalScope) {
    "use strict";

    const MODULE_NAME = "customer/order-management/browse-vendors";

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

    // ==========================================
    // VENDOR DATA FETCHING
    // ==========================================

    /**
     * Fetch all approved active vendors from Firestore
     * @param {Object} options - Configuration options
     * @param {Object} options.db - Firestore database instance
     * @param {Function} options.firestoreFns - Firestore functions (collection, getDocs, query, where, orderBy)
     * @returns {Promise<Object>} Result object with vendors array
     */
    async function fetchApprovedVendors(options = {}) {
        const db = options.db || resolveFirestore(options.firestore);
        const fns = options.firestoreFns || globalScope.firestoreFns || {};

        if (!db) {
            return {
                success: false,
                vendors: [],
                error: { code: "no-db", message: "Firestore database not available" }
            };
        }

        if (!fns.collection || !fns.getDocs || !fns.query || !fns.where || !fns.orderBy) {
            return {
                success: false,
                vendors: [],
                error: { code: "no-firestore-fns", message: "Firestore functions not available" }
            };
        }

        try {
            const usersRef = fns.collection(db, "users");
            const vendorsQuery = fns.query(
                usersRef,
                fns.where("vendorStatus", "==", "approved"),
                fns.where("accountStatus", "==", "active"),
                fns.orderBy("displayName", "asc")
            );

            const querySnapshot = await fns.getDocs(vendorsQuery);
            const vendors = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                vendors.push({
                    uid: doc.id,
                    displayName: data.displayName || "Unknown Vendor",
                    email: data.email || "",
                    photoURL: data.photoURL || "",
                    vendorStatus: data.vendorStatus,
                    accountStatus: data.accountStatus,
                    // Additional vendor info if available
                    businessName: data.businessName || data.displayName || "Unknown",
                    description: data.description || "",
                    location: data.location || "Campus",
                    rating: data.rating || 0,
                    totalOrders: data.totalOrders || 0
                });
            });

            return {
                success: true,
                vendors,
                count: vendors.length
            };
        } catch (error) {
            console.error(`${MODULE_NAME}: Error fetching vendors:`, error);
            return {
                success: false,
                vendors: [],
                error: {
                    code: error.code || "fetch-error",
                    message: error.message || "Failed to fetch vendors"
                }
            };
        }
    }

    // ==========================================
    // UI RENDERING
    // ==========================================

    /**
     * Create vendor card element
     * @param {Object} vendor - Vendor data
     * @returns {HTMLElement} Article element containing vendor card
     */
    function createVendorCard(vendor) {
        const article = globalScope.document.createElement("article");
        article.className = "vendor-card";
        article.setAttribute("data-vendor-uid", vendor.uid);

        // Vendor image
        const figure = globalScope.document.createElement("figure");
        figure.className = "vendor-image-container";

        const img = globalScope.document.createElement("img");
        img.src = vendor.photoURL || "/images/default-vendor.png";
        img.alt = `${vendor.businessName} logo`;
        img.className = "vendor-image";
        img.loading = "lazy";

        figure.appendChild(img);

        // Vendor info
        const section = globalScope.document.createElement("section");
        section.className = "vendor-info";

        const heading = globalScope.document.createElement("h3");
        heading.className = "vendor-name";
        heading.textContent = vendor.businessName;

        const location = globalScope.document.createElement("p");
        location.className = "vendor-location";
        location.textContent = vendor.location;

        const description = globalScope.document.createElement("p");
        description.className = "vendor-description";
        description.textContent = vendor.description || "Delicious food awaits you!";

        section.appendChild(heading);
        section.appendChild(location);
        if (vendor.description) {
            section.appendChild(description);
        }

        // Vendor stats (if available)
        if (vendor.rating || vendor.totalOrders) {
            const stats = globalScope.document.createElement("section");
            stats.className = "vendor-stats";

            if (vendor.rating) {
                const ratingP = globalScope.document.createElement("p");
                ratingP.className = "vendor-rating";
                const ratingStrong = globalScope.document.createElement("strong");
                ratingStrong.textContent = `${vendor.rating.toFixed(1)}`;
                ratingP.appendChild(ratingStrong);
                ratingP.appendChild(globalScope.document.createTextNode(" / 5.0"));
                stats.appendChild(ratingP);
            }

            if (vendor.totalOrders) {
                const ordersP = globalScope.document.createElement("p");
                ordersP.className = "vendor-orders";
                ordersP.textContent = `${vendor.totalOrders} orders`;
                stats.appendChild(ordersP);
            }

            section.appendChild(stats);
        }

        // Action button
        const footer = globalScope.document.createElement("footer");
        footer.className = "vendor-card-footer";

        const button = globalScope.document.createElement("button");
        button.type = "button";
        button.className = "button-primary vendor-browse-button";
        button.textContent = "View Menu";
        button.setAttribute("data-vendor-uid", vendor.uid);
        button.setAttribute("data-vendor-name", vendor.businessName);

        footer.appendChild(button);

        // Assemble card
        article.appendChild(figure);
        article.appendChild(section);
        article.appendChild(footer);

        return article;
    }

    /**
     * Render vendors to container
     * @param {Array} vendors - Array of vendor objects
     * @param {HTMLElement} container - Container element
     */
    function renderVendors(vendors, container) {
        if (!container) {
            console.error(`${MODULE_NAME}: No container element provided`);
            return;
        }

        // Clear existing content
        container.innerHTML = "";

        if (!vendors || vendors.length === 0) {
            const emptyMessage = globalScope.document.createElement("p");
            emptyMessage.className = "empty-state-message";
            emptyMessage.textContent = "No vendors available at the moment. Please check back later.";
            container.appendChild(emptyMessage);
            return;
        }

        // Create vendor cards
        vendors.forEach((vendor) => {
            const card = createVendorCard(vendor);
            container.appendChild(card);
        });
    }

    /**
     * Display status message
     * @param {HTMLElement} element - Status element
     * @param {String} message - Status message
     * @param {String} state - State type (success, error, info, loading)
     */
    function setStatusMessage(element, message, state = "info") {
        if (!element) return;

        element.textContent = message;
        element.setAttribute("data-state", state);
    }

    /**
     * Display loading state
     * @param {HTMLElement} container - Container element
     * @param {Boolean} isLoading - Loading state
     */
    function setLoadingState(container, isLoading) {
        if (!container) return;

        if (isLoading) {
            container.innerHTML = "<p class=\"loading-message\">Loading vendors...</p>";
            container.setAttribute("data-loading", "true");
        } else {
            container.removeAttribute("data-loading");
        }
    }

    // ==========================================
    // EVENT HANDLERS
    // ==========================================

    /**
     * Handle vendor browse button click
     * @param {Event} event - Click event
     */
    function handleVendorBrowseClick(event) {
        const button = event.target.closest(".vendor-browse-button");
        if (!button) return;

        const vendorUid = button.getAttribute("data-vendor-uid");
        const vendorName = button.getAttribute("data-vendor-name");

        if (!vendorUid) {
            console.error(`${MODULE_NAME}: No vendor UID found on button`);
            return;
        }

        // Navigate to browse menu page with vendor ID
        const url = new URL("./browse-menu.html", globalScope.location.href);
        url.searchParams.set("vendorUid", vendorUid);
        if (vendorName) {
            url.searchParams.set("vendorName", encodeURIComponent(vendorName));
        }

        globalScope.location.href = url.toString();
    }

    /**
     * Setup event listeners
     * @param {HTMLElement} container - Vendors container
     */
    function setupEventListeners(container) {
        if (!container) return;

        // Delegate click events for vendor buttons
        container.addEventListener("click", handleVendorBrowseClick);
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    /**
     * Initialize browse vendors page
     * @param {Object} options - Configuration options
     * @param {Object} options.db - Firestore database
     * @param {Object} options.auth - Firebase auth
     * @param {Object} options.firestoreFns - Firestore functions
     * @param {String} options.containerSelector - Container CSS selector
     * @param {String} options.statusSelector - Status element CSS selector
     * @returns {Promise<Object>} Initialization result
     */
    async function init(options = {}) {
        const db = options.db || resolveFirestore();
        const auth = options.auth || resolveAuth();
        const containerSelector = options.containerSelector || "#vendors-container";
        const statusSelector = options.statusSelector || "#browse-vendors-status";

        if (!db) {
            console.error(`${MODULE_NAME}: Firestore not available`);
            return { success: false, error: "Firestore not available" };
        }

        if (!auth) {
            console.warn(`${MODULE_NAME}: Auth not available - user may not be authenticated`);
        }

        const container = globalScope.document.querySelector(containerSelector);
        const statusElement = globalScope.document.querySelector(statusSelector);

        if (!container) {
            console.error(`${MODULE_NAME}: Container element not found: ${containerSelector}`);
            return { success: false, error: "Container not found" };
        }

        // Show loading state
        setLoadingState(container, true);
        if (statusElement) {
            setStatusMessage(statusElement, "Loading vendors...", "loading");
        }

        // Fetch vendors
        const result = await fetchApprovedVendors({
            db,
            firestoreFns: options.firestoreFns
        });

        setLoadingState(container, false);

        if (!result.success) {
            const errorMessage = result.error?.message || "Failed to load vendors";
            if (statusElement) {
                setStatusMessage(statusElement, errorMessage, "error");
            }
            renderVendors([], container);
            return { success: false, error: errorMessage };
        }

        // Render vendors
        renderVendors(result.vendors, container);

        if (statusElement) {
            const message = result.count > 0
                ? `Found ${result.count} vendor${result.count === 1 ? "" : "s"}`
                : "No vendors available";
            const state = result.count > 0 ? "success" : "info";
            setStatusMessage(statusElement, message, state);
        }

        // Setup event listeners
        setupEventListeners(container);

        return {
            success: true,
            vendorCount: result.count,
            vendors: result.vendors
        };
    }

    // ==========================================
    // MODULE EXPORTS
    // ==========================================

    const customerBrowseVendors = {
        init,
        fetchApprovedVendors,
        renderVendors,
        createVendorCard,
        setStatusMessage,
        setLoadingState,
        handleVendorBrowseClick,
        setupEventListeners
    };

    // Export for Node.js (testing)
    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerBrowseVendors;
    }

    // Export to global scope (browser)
    if (typeof globalScope !== "undefined") {
        globalScope.customerBrowseVendors = customerBrowseVendors;
    }

})(typeof window !== "undefined" ? window : globalThis);
