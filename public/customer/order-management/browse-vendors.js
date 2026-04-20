(function attachCustomerBrowseVendors(globalScope) {
    "use strict";

    const MODULE_NAME = "customer/order-management/browse-vendors";
    let initInFlight = null;

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
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

    function getFallbackRoutes() {
        return {
            home: "../index.html",
            cart: "./cart.html",
            orders: "../order-tracking/index.html",
            profile: "../../authentication/profile.html",
            vendorMenu: "./browse-menu.html"
        };
    }

    function sortVendors(vendors) {
        return (Array.isArray(vendors) ? vendors.slice() : []).sort(function compareVendors(a, b) {
            const aName = normalizeLowerText(a && (a.businessName || a.displayName));
            const bName = normalizeLowerText(b && (b.businessName || b.displayName));

            if (aName < bName) {
                return -1;
            }

            if (aName > bName) {
                return 1;
            }

            return 0;
        });
    }

    function normalizeVendorRecord(docSnapshot) {
        const safeData = docSnapshot && typeof docSnapshot.data === "function"
            ? (docSnapshot.data() || {})
            : {};

        const displayName = normalizeText(safeData.displayName);
        const vendorBusinessName = normalizeText(safeData.vendorBusinessName);
        const businessName = normalizeText(safeData.businessName);
        const vendorDescription = normalizeText(safeData.vendorDescription);
        const vendorLocation = normalizeText(safeData.vendorLocation);
        const vendorEmail = normalizeText(safeData.vendorEmail);
        const vendorPhoneNumber = normalizeText(safeData.vendorPhoneNumber);
        const vendorFoodType = normalizeText(safeData.vendorFoodType);
        const vendorUniversity = normalizeText(safeData.vendorUniversity);
        const accountStatus = normalizeLowerText(safeData.accountStatus) || "active";

        return {
            uid: normalizeText(docSnapshot && docSnapshot.id) || normalizeText(safeData.uid),
            displayName: displayName || "Unknown Vendor",
            email: normalizeText(safeData.email),
            photoURL: normalizeText(
                safeData.uploadedPhotoURL ||
                safeData.photoURL ||
                safeData.providerPhotoURL
            ),
            vendorStatus: normalizeLowerText(safeData.vendorStatus),
            accountStatus,
            businessName: vendorBusinessName || businessName || displayName || "Unknown Vendor",
            description: vendorDescription,
            location: vendorLocation || vendorUniversity || "Campus",
            vendorEmail: vendorEmail || normalizeText(safeData.email),
            vendorPhoneNumber,
            foodType: vendorFoodType,
            university: vendorUniversity,
            rating: Number.isFinite(Number(safeData.rating)) ? Number(safeData.rating) : 0,
            totalOrders: Number.isFinite(Number(safeData.totalOrders)) ? Number(safeData.totalOrders) : 0,
            isAdmin: safeData.isAdmin === true
        };
    }

    function mapFetchError(error) {
        const code = normalizeText(error && error.code) || "fetch-error";
        const message = normalizeText(error && error.message);

        if (code === "failed-precondition" || message.toLowerCase().includes("requires an index")) {
            return {
                code: "vendors-query-not-ready",
                message: "Vendor data could not be loaded right now. Please try again shortly."
            };
        }

        if (code === "permission-denied") {
            return {
                code: "vendors-permission-denied",
                message: "You do not have permission to view vendor records right now."
            };
        }

        return {
            code: code || "fetch-error",
            message: message || "Failed to fetch vendors."
        };
    }

    function waitForAuthReady(auth, authFns, timeoutMs = 5000) {
        if (!auth || !authFns || typeof authFns.onAuthStateChanged !== "function") {
            return Promise.resolve(null);
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

            unsubscribe = authFns.onAuthStateChanged(auth, function handleAuthState(user) {
                finish(user);
            }, function handleAuthError() {
                finish(null);
            });

            globalScope.setTimeout(function handleTimeout() {
                finish(auth.currentUser || null);
            }, timeoutMs);
        });
    }

    async function fetchApprovedVendors(options = {}) {
        const db = options.db || resolveFirestore(options.firestore);
        const firestoreFns = resolveFirestoreFns(options.firestoreFns);

        if (!db) {
            return {
                success: false,
                vendors: [],
                error: {
                    code: "no-db",
                    message: "Firestore database not available."
                }
            };
        }

        if (
            typeof firestoreFns.collection !== "function" ||
            typeof firestoreFns.getDocs !== "function"
        ) {
            return {
                success: false,
                vendors: [],
                error: {
                    code: "no-firestore-fns",
                    message: "Firestore functions not available."
                }
            };
        }

        try {
            const usersRef = firestoreFns.collection(db, "users");
            const approvedUsersQuery =
                typeof firestoreFns.query === "function" &&
                typeof firestoreFns.where === "function"
                    ? firestoreFns.query(
                        usersRef,
                        firestoreFns.where("vendorStatus", "==", "approved"),
                        firestoreFns.where("accountStatus", "==", "active")
                    )
                    : usersRef;
            const querySnapshot = await firestoreFns.getDocs(approvedUsersQuery);
            const vendors = [];
            const iterate = typeof querySnapshot.forEach === "function"
                ? querySnapshot.forEach.bind(querySnapshot)
                : function iterateDocs(callback) {
                    const docs = Array.isArray(querySnapshot && querySnapshot.docs)
                        ? querySnapshot.docs
                        : [];
                    docs.forEach(callback);
                };

            iterate(function forEachVendor(docSnapshot) {
                const vendor = normalizeVendorRecord(docSnapshot);
                const isAccountAccessible =
                    vendor.accountStatus !== "disabled" &&
                    vendor.accountStatus !== "blocked";

                if (vendor.vendorStatus === "approved" && isAccountAccessible) {
                    vendors.push(vendor);
                }
            });

            return {
                success: true,
                vendors: sortVendors(vendors),
                count: vendors.length
            };
        } catch (error) {
            const mappedError = mapFetchError(error);

            return {
                success: false,
                vendors: [],
                error: mappedError
            };
        }
    }

    function createBackButton(options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const button = globalScope.document.createElement("button");
        const fallbackRoute = normalizeText(safeOptions.fallbackRoute) || getFallbackRoutes().home;

        button.type = "button";
        button.className = "button-secondary browse-vendors-back-button";
        button.textContent = normalizeText(safeOptions.label) || "Back";

        button.addEventListener("click", function handleBackClick() {
            if (globalScope.history && typeof globalScope.history.back === "function" && globalScope.history.length > 1) {
                globalScope.history.back();
                return;
            }

            globalScope.location.href = fallbackRoute;
        });

        return button;
    }

    function createVendorCard(vendor) {
        const safeVendor = vendor && typeof vendor === "object" ? vendor : {};

        const article = globalScope.document.createElement("article");
        article.className = "vendor-card";
        article.setAttribute("data-vendor-uid", normalizeText(safeVendor.uid));

        const heading = globalScope.document.createElement("h3");
        heading.className = "vendor-name";
        heading.textContent = normalizeText(safeVendor.businessName) || "Unknown Vendor";

        const image = globalScope.document.createElement("img");
        image.className = "vendor-image";
        image.loading = "lazy";
        image.src = normalizeText(safeVendor.photoURL) || "../assets/default-avatar.png";
        image.alt = `${normalizeText(safeVendor.businessName) || "Vendor"} profile picture`;

        const ownerLine = globalScope.document.createElement("p");
        ownerLine.className = "vendor-owner-line";
        ownerLine.textContent = normalizeText(safeVendor.displayName)
            ? `Owner: ${safeVendor.displayName}`
            : "Owner information unavailable";

        const locationLine = globalScope.document.createElement("p");
        locationLine.className = "vendor-location";
        locationLine.textContent = normalizeText(safeVendor.location) || "Campus";

        const foodTypeLine = globalScope.document.createElement("p");
        foodTypeLine.className = "vendor-food-type";
        foodTypeLine.textContent = normalizeText(safeVendor.foodType)
            ? `Food Type: ${safeVendor.foodType}`
            : "Food Type: General";

        const descriptionLine = globalScope.document.createElement("p");
        descriptionLine.className = "vendor-description";
        descriptionLine.textContent = normalizeText(safeVendor.description) || "Browse this vendor to view available meals and items.";

        const hasStats =
            Number.isFinite(Number(safeVendor.rating)) && Number(safeVendor.rating) > 0 ||
            Number.isFinite(Number(safeVendor.totalOrders)) && Number(safeVendor.totalOrders) > 0;
        let statsSection = null;

        if (hasStats) {
            statsSection = globalScope.document.createElement("section");
            statsSection.className = "vendor-stats";

            if (Number.isFinite(Number(safeVendor.rating)) && Number(safeVendor.rating) > 0) {
                const ratingLine = globalScope.document.createElement("p");
                ratingLine.className = "vendor-rating";
                ratingLine.innerHTML = `Rating: <strong>${Number(safeVendor.rating).toFixed(1)}</strong>`;
                statsSection.appendChild(ratingLine);
            }

            if (Number.isFinite(Number(safeVendor.totalOrders)) && Number(safeVendor.totalOrders) > 0) {
                const ordersLine = globalScope.document.createElement("p");
                ordersLine.className = "vendor-orders";
                ordersLine.textContent = `${Number(safeVendor.totalOrders)} orders completed`;
                statsSection.appendChild(ordersLine);
            }
        }

        const footer = globalScope.document.createElement("footer");
        footer.className = "vendor-card-footer";

        const viewMenuButton = globalScope.document.createElement("button");
        viewMenuButton.type = "button";
        viewMenuButton.className = "button-primary vendor-browse-button";
        viewMenuButton.textContent = "View Menu";
        viewMenuButton.setAttribute("data-vendor-uid", normalizeText(safeVendor.uid));
        viewMenuButton.setAttribute("data-vendor-name", normalizeText(safeVendor.businessName));

        footer.appendChild(viewMenuButton);

        article.appendChild(heading);
        article.appendChild(image);
        article.appendChild(ownerLine);
        article.appendChild(locationLine);
        article.appendChild(foodTypeLine);
        article.appendChild(descriptionLine);
        if (statsSection) {
            article.appendChild(statsSection);
        }
        article.appendChild(footer);

        return article;
    }

    function renderEmptyState(container, message) {
        if (!container) {
            return;
        }

        container.innerHTML = "";

        const paragraph = globalScope.document.createElement("p");
        paragraph.className = "empty-state-message";
        paragraph.textContent = normalizeText(message) || "No vendors are available right now.";

        container.appendChild(paragraph);
    }

    function renderVendors(vendors, container) {
        if (!container) {
            return;
        }

        container.innerHTML = "";

        const safeVendors = Array.isArray(vendors) ? vendors : [];

        if (safeVendors.length === 0) {
            renderEmptyState(container, "No approved vendors are available right now.");
            return;
        }

        safeVendors.forEach(function appendVendor(vendor) {
            container.appendChild(createVendorCard(vendor));
        });
    }

    function setStatusMessage(element, message, state = "info") {
        if (!element) {
            return;
        }

        element.textContent = normalizeText(message);
        element.setAttribute("data-state", normalizeText(state) || "info");
    }

    function setLoadingState(container, isLoading) {
        if (!container) {
            return;
        }

        if (isLoading) {
            container.setAttribute("data-loading", "true");
            container.innerHTML = "";

            const paragraph = globalScope.document.createElement("p");
            paragraph.className = "loading-message";
            paragraph.textContent = "Loading vendors...";
            container.appendChild(paragraph);
            return;
        }

        container.removeAttribute("data-loading");
    }

    function buildVendorMenuUrl(vendorUid, vendorName) {
        const routes = getFallbackRoutes();
        const url = new URL(routes.vendorMenu, globalScope.location.href);

        url.searchParams.set("vendorUid", normalizeText(vendorUid));

        if (normalizeText(vendorName)) {
            url.searchParams.set("vendorName", normalizeText(vendorName));
        }

        return url.toString();
    }

    function handleVendorBrowseClick(event) {
        const button = event && event.target && typeof event.target.closest === "function"
            ? event.target.closest(".vendor-browse-button")
            : null;

        if (!button) {
            return null;
        }

        const vendorUid = normalizeText(button.getAttribute("data-vendor-uid"));
        const vendorName = normalizeText(button.getAttribute("data-vendor-name"));

        if (!vendorUid) {
            return null;
        }

        const nextUrl = buildVendorMenuUrl(vendorUid, vendorName);
        globalScope.location.href = nextUrl;

        return nextUrl;
    }

    function setupEventListeners(options = {}) {
        const safeOptions = options && typeof options === "object" && !("nodeType" in options)
            ? options
            : { container: options };
        const container = safeOptions.container || null;
        const refreshButton = safeOptions.refreshButton || null;
        const backButtonHost = safeOptions.backButtonHost || null;
        const onRefresh = typeof safeOptions.onRefresh === "function" ? safeOptions.onRefresh : null;

        if (container) {
            container.addEventListener("click", handleVendorBrowseClick);
        }

        if (refreshButton && onRefresh) {
            refreshButton.addEventListener("click", onRefresh);
        }

        if (backButtonHost && !backButtonHost.querySelector(".browse-vendors-back-button")) {
            backButtonHost.appendChild(createBackButton({
                fallbackRoute: getFallbackRoutes().home
            }));
        }
    }

    async function init(options = {}) {
        if (initInFlight) {
            return initInFlight;
        }

        initInFlight = (async function runInit() {
        const db = options.db || resolveFirestore();
        const auth = options.auth || resolveAuth();
        const authFns = resolveAuthFns(options.authFns);
        const firestoreFns = resolveFirestoreFns(options.firestoreFns);
        const containerSelector = options.containerSelector || "#vendors-container";
        const statusSelector = options.statusSelector || "#browse-vendors-status";
        const refreshButtonSelector = options.refreshButtonSelector || "#refresh-vendors-button";
        const backButtonHostSelector = options.backButtonHostSelector || "#browse-vendors-back-button-host";

        if (!db) {
            return {
                success: false,
                error: "Firestore not available."
            };
        }

        const container = globalScope.document.querySelector(containerSelector);
        const statusElement = globalScope.document.querySelector(statusSelector);
        const refreshButton = globalScope.document.querySelector(refreshButtonSelector);
        const backButtonHost = globalScope.document.querySelector(backButtonHostSelector);

        if (!container) {
            return {
                success: false,
                error: "Container not found."
            };
        }

        if (refreshButton) {
            refreshButton.disabled = true;
            refreshButton.textContent = "Refreshing...";
        }

        setLoadingState(container, true);
        setStatusMessage(statusElement, "Loading approved vendors...", "loading");

        await waitForAuthReady(auth, authFns);

        if (auth && !auth.currentUser) {
            setLoadingState(container, false);
            renderEmptyState(container, "Please sign in to browse approved vendors.");
            setStatusMessage(statusElement, "Please sign in to browse approved vendors.", "error");

            if (refreshButton) {
                refreshButton.disabled = false;
                refreshButton.textContent = "Refresh Vendors";
            }

            setupEventListeners({
                container,
                refreshButton,
                backButtonHost,
                onRefresh: function onRefreshClick() {
                    return init(options);
                }
            });

            return {
                success: false,
                error: "Please sign in to browse approved vendors."
            };
        }

        const result = await fetchApprovedVendors({
            db,
            auth,
            authFns,
            firestoreFns
        });

        setLoadingState(container, false);

        if (refreshButton) {
            refreshButton.disabled = false;
            refreshButton.textContent = "Refresh Vendors";
        }

        if (!result.success) {
            renderEmptyState(container, "Vendor data is unavailable right now.");
            setStatusMessage(
                statusElement,
                result.error && result.error.message
                    ? result.error.message
                    : "Failed to load vendors.",
                "error"
            );

            setupEventListeners({
                container,
                refreshButton,
                backButtonHost,
                onRefresh: function onRefreshClick() {
                    return init(options);
                }
            });

            return {
                success: false,
                error: result.error && result.error.message
                    ? result.error.message
                    : "Failed to load vendors."
            };
        }

        renderVendors(result.vendors, container);

        if (result.count === 0) {
            setStatusMessage(statusElement, "No approved vendors are available right now.", "info");
        } else if (result.count === 1) {
            setStatusMessage(statusElement, "Found 1 approved vendor.", "success");
        } else {
            setStatusMessage(statusElement, `Found ${result.count} approved vendors.`, "success");
        }

        setupEventListeners({
            container,
            refreshButton,
            backButtonHost,
            onRefresh: function onRefreshClick() {
                return init(options);
            }
        });

        return {
            success: true,
            vendorCount: result.count,
            vendors: result.vendors
        };
        })();

        try {
            return await initInFlight;
        } finally {
            initInFlight = null;
        }
    }

    const customerBrowseVendors = {
        MODULE_NAME,
        normalizeText,
        normalizeLowerText,
        resolveFirestore,
        resolveAuth,
        resolveAuthFns,
        resolveFirestoreFns,
        getFallbackRoutes,
        sortVendors,
        normalizeVendorRecord,
        mapFetchError,
        waitForAuthReady,
        fetchApprovedVendors,
        createBackButton,
        createVendorCard,
        renderEmptyState,
        renderVendors,
        setStatusMessage,
        setLoadingState,
        buildVendorMenuUrl,
        handleVendorBrowseClick,
        setupEventListeners,
        init
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = customerBrowseVendors;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.customerBrowseVendors = customerBrowseVendors;
    }

    if (typeof window !== "undefined" && window.document) {
        window.addEventListener("DOMContentLoaded", function autoInitBrowseVendors() {
            const pageRoot = window.document.querySelector("[data-page='browse-vendors']");

            if (!pageRoot) {
                return;
            }

            customerBrowseVendors.init();
        });
    }
})(typeof window !== "undefined" ? window : globalThis);
