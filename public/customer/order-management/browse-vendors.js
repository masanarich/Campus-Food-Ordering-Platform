(function attachCustomerBrowseVendors(globalScope) {
    "use strict";

    const MODULE_NAME = "customer/order-management/browse-vendors";
    const DEFAULT_PAGE_SIZE = 10;
    const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
    const SORT_OPTIONS = [
        { value: "name", label: "Name (A-Z)" },
        { value: "name-desc", label: "Name (Z-A)" },
        { value: "rating", label: "Highest rated" },
        { value: "orders", label: "Most popular" },
        { value: "newest", label: "Newest first" }
    ];

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

    function getNameKey(vendor) {
        return normalizeLowerText(vendor && (vendor.businessName || vendor.displayName));
    }

    function compareNumbersDesc(a, b) {
        const numA = Number(a) || 0;
        const numB = Number(b) || 0;
        return numB - numA;
    }

    function sortVendors(vendors, sortBy = "name") {
        const safeVendors = Array.isArray(vendors) ? vendors.slice() : [];

        switch (sortBy) {
            case "name-desc":
                return safeVendors.sort(function compareDesc(a, b) {
                    const aName = getNameKey(a);
                    const bName = getNameKey(b);
                    return aName > bName ? -1 : aName < bName ? 1 : 0;
                });
            case "rating":
                return safeVendors.sort(function compareRating(a, b) {
                    const ratingDiff = compareNumbersDesc(a && a.rating, b && b.rating);
                    if (ratingDiff !== 0) return ratingDiff;
                    return getNameKey(a) < getNameKey(b) ? -1 : 1;
                });
            case "orders":
                return safeVendors.sort(function compareOrders(a, b) {
                    const orderDiff = compareNumbersDesc(a && a.totalOrders, b && b.totalOrders);
                    if (orderDiff !== 0) return orderDiff;
                    return getNameKey(a) < getNameKey(b) ? -1 : 1;
                });
            case "newest":
                return safeVendors.sort(function compareNewest(a, b) {
                    const aTime = Date.parse((a && (a.updatedAt || a.createdAt)) || "") || 0;
                    const bTime = Date.parse((b && (b.updatedAt || b.createdAt)) || "") || 0;
                    if (aTime !== bTime) return bTime - aTime;
                    return getNameKey(a) < getNameKey(b) ? -1 : 1;
                });
            case "name":
            default:
                return safeVendors.sort(function compareAsc(a, b) {
                    const aName = getNameKey(a);
                    const bName = getNameKey(b);
                    return aName < bName ? -1 : aName > bName ? 1 : 0;
                });
        }
    }

    function normalizeVendorRecord(docSnapshot) {
        const safeData = docSnapshot && typeof docSnapshot.data === "function"
            ? (docSnapshot.data() || {})
            : {};

        const displayName = normalizeText(safeData.displayName);
        const vendorBusinessName = normalizeText(safeData.vendorBusinessName);
        const businessName = normalizeText(safeData.businessName);
        const vendorDescription = normalizeText(safeData.vendorDescription || safeData.description);
        const vendorLocation = normalizeText(safeData.vendorLocation || safeData.campusLocation || safeData.location);
        const vendorEmail = normalizeText(safeData.vendorEmail || safeData.email);
        const vendorPhoneNumber = normalizeText(safeData.vendorPhoneNumber || safeData.contactNumber);
        const vendorFoodType = normalizeText(safeData.vendorFoodType || safeData.foodType);
        const vendorUniversity = normalizeText(safeData.vendorUniversity || safeData.university);
        const vendorOpeningHours = normalizeText(safeData.vendorOpeningHours || safeData.openingHours);
        const accountStatus = normalizeLowerText(safeData.accountStatus) || "active";
        const acceptingOrders = safeData.vendorAcceptingOrders === false ? false : true;

        return {
            uid: normalizeText(docSnapshot && docSnapshot.id) || normalizeText(safeData.uid),
            displayName: displayName || "Unknown Vendor",
            email: normalizeText(safeData.email),
            photoURL: normalizeText(
                safeData.vendorBannerURL ||
                safeData.uploadedPhotoURL ||
                safeData.photoURL ||
                safeData.providerPhotoURL
            ),
            vendorStatus: normalizeLowerText(safeData.vendorStatus),
            accountStatus,
            businessName: vendorBusinessName || businessName || displayName || "Unknown Vendor",
            description: vendorDescription,
            location: vendorLocation || vendorUniversity || "Campus",
            vendorEmail: vendorEmail,
            vendorPhoneNumber,
            foodType: vendorFoodType,
            university: vendorUniversity,
            openingHours: vendorOpeningHours,
            acceptingOrders,
            rating: Number.isFinite(Number(safeData.rating)) ? Number(safeData.rating) : 0,
            totalOrders: Number.isFinite(Number(safeData.totalOrders)) ? Number(safeData.totalOrders) : 0,
            isAdmin: safeData.isAdmin === true,
            updatedAt: safeData.updatedAt || null,
            createdAt: safeData.createdAt || null
        };
    }

    function vendorMatchesSearch(vendor, needle) {
        if (!needle) {
            return true;
        }

        const haystack = [
            vendor && vendor.businessName,
            vendor && vendor.displayName,
            vendor && vendor.foodType,
            vendor && vendor.location,
            vendor && vendor.university,
            vendor && vendor.description
        ].map(normalizeLowerText).join(" ");

        return haystack.includes(needle);
    }

    function filterVendors(vendors, filters = {}) {
        const safeVendors = Array.isArray(vendors) ? vendors : [];
        const needle = normalizeLowerText(filters.searchQuery);
        const foodFilter = normalizeLowerText(filters.foodTypeFilter);
        const acceptingOnly = filters.acceptingOnly === true;

        return safeVendors.filter(function keep(vendor) {
            if (!vendor) {
                return false;
            }

            if (acceptingOnly && vendor.acceptingOrders === false) {
                return false;
            }

            if (foodFilter && foodFilter !== "all") {
                if (normalizeLowerText(vendor.foodType) !== foodFilter) {
                    return false;
                }
            }

            return vendorMatchesSearch(vendor, needle);
        });
    }

    function getFoodTypeOptions(vendors) {
        const safeVendors = Array.isArray(vendors) ? vendors : [];
        const seen = new Map();

        safeVendors.forEach(function collectOne(vendor) {
            const raw = normalizeText(vendor && vendor.foodType);
            const key = raw.toLowerCase();

            if (!key) {
                return;
            }

            if (!seen.has(key)) {
                seen.set(key, raw);
            }
        });

        return Array.from(seen.values()).sort(function compareLabels(a, b) {
            return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
        });
    }

    function clampPageNumber(page, totalPages) {
        const safePage = Math.floor(Number(page));
        const safeTotal = Math.max(1, Math.floor(Number(totalPages)) || 1);

        if (!Number.isFinite(safePage) || safePage < 1) {
            return 1;
        }

        if (safePage > safeTotal) {
            return safeTotal;
        }

        return safePage;
    }

    function clampPageSize(value) {
        const parsed = Math.floor(Number(value));
        if (!Number.isFinite(parsed) || parsed < 1) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(parsed, 200);
    }

    function paginate(items, options = {}) {
        const safeItems = Array.isArray(items) ? items : [];
        const perPage = clampPageSize(options.perPage || DEFAULT_PAGE_SIZE);
        const totalItems = safeItems.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
        const page = clampPageNumber(options.page || 1, totalPages);
        const startIndex = (page - 1) * perPage;
        const endIndex = Math.min(startIndex + perPage, totalItems);

        return {
            items: safeItems.slice(startIndex, endIndex),
            totalItems,
            totalPages,
            page,
            perPage,
            startIndex,
            endIndex,
            from: totalItems === 0 ? 0 : startIndex + 1,
            to: endIndex
        };
    }

    function getPageWindow(currentPage, totalPages, windowSize = 5) {
        const safeTotal = Math.max(1, Math.floor(Number(totalPages)) || 1);
        const safePage = clampPageNumber(currentPage, safeTotal);
        const half = Math.floor(windowSize / 2);

        let start = safePage - half;
        let end = safePage + half;

        if (start < 1) {
            end = end + (1 - start);
            start = 1;
        }

        if (end > safeTotal) {
            start = Math.max(1, start - (end - safeTotal));
            end = safeTotal;
        }

        const pages = [];
        for (let i = start; i <= end; i += 1) {
            pages.push(i);
        }

        return pages;
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
                vendors: sortVendors(vendors, "name"),
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
        const businessName = normalizeText(safeVendor.businessName) || "Unknown Vendor";
        const foodType = normalizeText(safeVendor.foodType);
        const location = normalizeText(safeVendor.location) || "Campus";
        const description = normalizeText(safeVendor.description) ||
            "Browse this vendor to view available meals and items.";
        const ownerName = normalizeText(safeVendor.displayName);
        const openingHours = normalizeText(safeVendor.openingHours);
        const acceptingOrders = safeVendor.acceptingOrders !== false;
        const photoURL = normalizeText(safeVendor.photoURL) || "../assets/default-avatar.png";

        const article = globalScope.document.createElement("article");
        article.className = "vendor-card";
        article.setAttribute("data-vendor-uid", normalizeText(safeVendor.uid));
        article.setAttribute("data-food-type", foodType.toLowerCase());

        const mediaWrapper = globalScope.document.createElement("figure");
        mediaWrapper.className = "vendor-image-wrap";

        const image = globalScope.document.createElement("img");
        image.className = "vendor-image";
        image.loading = "lazy";
        image.src = photoURL;
        image.alt = `${businessName} shopfront photo`;
        mediaWrapper.appendChild(image);

        const statusBadge = globalScope.document.createElement("figcaption");
        statusBadge.className = acceptingOrders
            ? "vendor-status-badge vendor-status-badge-open"
            : "vendor-status-badge vendor-status-badge-closed";
        statusBadge.textContent = acceptingOrders ? "Accepting orders" : "Not accepting orders";
        mediaWrapper.appendChild(statusBadge);

        const body = globalScope.document.createElement("section");
        body.className = "vendor-card-body";

        const heading = globalScope.document.createElement("h3");
        heading.className = "vendor-name";
        heading.textContent = businessName;

        const metaList = globalScope.document.createElement("ul");
        metaList.className = "vendor-meta-list";

        function appendMetaItem(className, label, value) {
            const safeValue = normalizeText(value);

            if (!safeValue) {
                return;
            }

            const item = globalScope.document.createElement("li");
            item.className = className;

            const labelEl = globalScope.document.createElement("strong");
            labelEl.className = "vendor-meta-label";
            labelEl.textContent = `${label}:`;

            const valueEl = globalScope.document.createElement("output");
            valueEl.className = "vendor-meta-value";
            valueEl.textContent = safeValue;

            item.appendChild(labelEl);
            item.appendChild(valueEl);
            metaList.appendChild(item);
        }

        if (foodType) {
            const chipsItem = globalScope.document.createElement("li");
            chipsItem.className = "vendor-food-type";

            const labelEl = globalScope.document.createElement("strong");
            labelEl.className = "vendor-meta-label";
            labelEl.textContent = "Food type:";

            const chip = globalScope.document.createElement("output");
            chip.className = "vendor-food-chip";
            chip.textContent = foodType;

            chipsItem.appendChild(labelEl);
            chipsItem.appendChild(chip);
            metaList.appendChild(chipsItem);
        }

        appendMetaItem("vendor-location", "Location", location);
        appendMetaItem("vendor-opening-hours", "Hours", openingHours);

        if (ownerName) {
            appendMetaItem("vendor-owner-line", "Owner", ownerName);
        }

        const descriptionLine = globalScope.document.createElement("p");
        descriptionLine.className = "vendor-description";
        descriptionLine.textContent = description;

        body.appendChild(heading);
        body.appendChild(metaList);
        body.appendChild(descriptionLine);

        const hasRating = Number.isFinite(Number(safeVendor.rating)) && Number(safeVendor.rating) > 0;
        const hasOrders = Number.isFinite(Number(safeVendor.totalOrders)) && Number(safeVendor.totalOrders) > 0;
        let statsSection = null;

        if (hasRating || hasOrders) {
            statsSection = globalScope.document.createElement("section");
            statsSection.className = "vendor-stats";

            if (hasRating) {
                const ratingLine = globalScope.document.createElement("p");
                ratingLine.className = "vendor-rating";
                ratingLine.innerHTML = `Rating: <strong>${Number(safeVendor.rating).toFixed(1)}</strong>`;
                statsSection.appendChild(ratingLine);
            }

            if (hasOrders) {
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
        viewMenuButton.textContent = acceptingOrders ? "View Menu" : "View Menu (closed)";
        viewMenuButton.setAttribute("data-vendor-uid", normalizeText(safeVendor.uid));
        viewMenuButton.setAttribute("data-vendor-name", businessName);
        if (!acceptingOrders) {
            viewMenuButton.setAttribute("aria-disabled", "false");
            viewMenuButton.dataset.acceptingOrders = "false";
        }

        footer.appendChild(viewMenuButton);

        article.appendChild(mediaWrapper);
        article.appendChild(body);
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

    function renderFoodTypeOptions(selectElement, foodTypes, selectedValue) {
        if (!selectElement) {
            return;
        }

        const safeTypes = Array.isArray(foodTypes) ? foodTypes : [];
        const selected = normalizeLowerText(selectedValue) || "all";

        selectElement.innerHTML = "";

        const allOption = globalScope.document.createElement("option");
        allOption.value = "all";
        allOption.textContent = "All food types";
        if (selected === "all") {
            allOption.selected = true;
        }
        selectElement.appendChild(allOption);

        safeTypes.forEach(function appendOne(foodType) {
            const option = globalScope.document.createElement("option");
            option.value = foodType.toLowerCase();
            option.textContent = foodType;
            if (option.value === selected) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    }

    function renderSortOptions(selectElement, selectedValue) {
        if (!selectElement) {
            return;
        }

        const selected = normalizeLowerText(selectedValue) || "name";

        selectElement.innerHTML = "";

        SORT_OPTIONS.forEach(function appendOne(option) {
            const optionEl = globalScope.document.createElement("option");
            optionEl.value = option.value;
            optionEl.textContent = option.label;
            if (option.value === selected) {
                optionEl.selected = true;
            }
            selectElement.appendChild(optionEl);
        });
    }

    function renderPageSizeOptions(selectElement, selectedValue) {
        if (!selectElement) {
            return;
        }

        const selected = clampPageSize(selectedValue);

        selectElement.innerHTML = "";

        PAGE_SIZE_OPTIONS.forEach(function appendOne(size) {
            const optionEl = globalScope.document.createElement("option");
            optionEl.value = String(size);
            optionEl.textContent = `${size} per page`;
            if (size === selected) {
                optionEl.selected = true;
            }
            selectElement.appendChild(optionEl);
        });
    }

    function renderResultsMeta(element, pageInfo) {
        if (!element) {
            return;
        }

        if (!pageInfo || pageInfo.totalItems === 0) {
            element.textContent = "Showing 0 vendors";
            return;
        }

        element.textContent = `Showing ${pageInfo.from}-${pageInfo.to} of ${pageInfo.totalItems} vendors`;
    }

    function renderPaginationControls(container, pageInfo, callbacks = {}) {
        if (!container) {
            return;
        }

        container.innerHTML = "";

        if (!pageInfo || pageInfo.totalItems === 0) {
            container.hidden = true;
            return;
        }

        if (pageInfo.totalPages <= 1) {
            const lonelyIndicator = globalScope.document.createElement("p");
            lonelyIndicator.className = "vendors-pagination-indicator";
            lonelyIndicator.textContent = `Page 1 of 1`;
            container.appendChild(lonelyIndicator);
            container.hidden = false;
            return;
        }

        const onPageChange = typeof callbacks.onPageChange === "function"
            ? callbacks.onPageChange
            : function noop() { return undefined; };

        const prevButton = globalScope.document.createElement("button");
        prevButton.type = "button";
        prevButton.className = "button-secondary vendors-pagination-prev";
        prevButton.textContent = "Previous";
        prevButton.disabled = pageInfo.page <= 1;
        prevButton.addEventListener("click", function onPrev() {
            onPageChange(pageInfo.page - 1);
        });

        const nextButton = globalScope.document.createElement("button");
        nextButton.type = "button";
        nextButton.className = "button-secondary vendors-pagination-next";
        nextButton.textContent = "Next";
        nextButton.disabled = pageInfo.page >= pageInfo.totalPages;
        nextButton.addEventListener("click", function onNext() {
            onPageChange(pageInfo.page + 1);
        });

        const pageList = globalScope.document.createElement("menu");
        pageList.className = "vendors-pagination-pages";

        const visiblePages = getPageWindow(pageInfo.page, pageInfo.totalPages, 5);

        visiblePages.forEach(function appendPage(pageNumber) {
            const item = globalScope.document.createElement("li");

            const pageButton = globalScope.document.createElement("button");
            pageButton.type = "button";
            pageButton.className = "button-secondary vendors-pagination-page";
            pageButton.textContent = String(pageNumber);

            if (pageNumber === pageInfo.page) {
                pageButton.setAttribute("aria-current", "page");
            }

            pageButton.addEventListener("click", function onPageClick() {
                onPageChange(pageNumber);
            });

            item.appendChild(pageButton);
            pageList.appendChild(item);
        });

        const indicator = globalScope.document.createElement("p");
        indicator.className = "vendors-pagination-indicator";
        indicator.textContent = `Page ${pageInfo.page} of ${pageInfo.totalPages}`;

        container.appendChild(prevButton);
        container.appendChild(pageList);
        container.appendChild(nextButton);
        container.appendChild(indicator);
        container.hidden = false;
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

    function createBrowseVendorsController(elements, callbacks = {}) {
        const state = {
            allVendors: [],
            currentPage: 1,
            itemsPerPage: DEFAULT_PAGE_SIZE,
            searchQuery: "",
            foodTypeFilter: "all",
            sortBy: "name",
            acceptingOnly: false
        };

        function applyAndRender() {
            const filtered = filterVendors(state.allVendors, {
                searchQuery: state.searchQuery,
                foodTypeFilter: state.foodTypeFilter,
                acceptingOnly: state.acceptingOnly
            });

            const sorted = sortVendors(filtered, state.sortBy);
            const pageInfo = paginate(sorted, {
                page: state.currentPage,
                perPage: state.itemsPerPage
            });

            state.currentPage = pageInfo.page;

            if (pageInfo.totalItems === 0) {
                renderEmptyState(
                    elements.container,
                    state.allVendors.length === 0
                        ? "No approved vendors are available right now."
                        : "No vendors match your filters. Try adjusting the search or food type."
                );
            } else {
                renderVendors(pageInfo.items, elements.container);
            }

            renderResultsMeta(elements.resultsMeta, pageInfo);
            renderPaginationControls(elements.paginationContainer, pageInfo, {
                onPageChange: function onPageChange(nextPage) {
                    state.currentPage = nextPage;
                    applyAndRender();

                    if (elements.container && typeof elements.container.scrollIntoView === "function") {
                        elements.container.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                }
            });

            if (typeof callbacks.onAfterRender === "function") {
                callbacks.onAfterRender({ pageInfo, state: { ...state } });
            }

            return pageInfo;
        }

        function setVendors(vendors) {
            state.allVendors = Array.isArray(vendors) ? vendors : [];
            renderFoodTypeOptions(elements.foodTypeFilter, getFoodTypeOptions(state.allVendors), state.foodTypeFilter);
            renderSortOptions(elements.sortControl, state.sortBy);
            renderPageSizeOptions(elements.pageSizeControl, state.itemsPerPage);
            state.currentPage = 1;
            return applyAndRender();
        }

        function setSearchQuery(query) {
            state.searchQuery = normalizeText(query);
            state.currentPage = 1;
            applyAndRender();
        }

        function setFoodTypeFilter(value) {
            state.foodTypeFilter = normalizeLowerText(value) || "all";
            state.currentPage = 1;
            applyAndRender();
        }

        function setSortBy(value) {
            state.sortBy = normalizeLowerText(value) || "name";
            state.currentPage = 1;
            applyAndRender();
        }

        function setPageSize(value) {
            state.itemsPerPage = clampPageSize(value);
            state.currentPage = 1;
            applyAndRender();
        }

        function setAcceptingOnly(value) {
            state.acceptingOnly = value === true;
            state.currentPage = 1;
            applyAndRender();
        }

        function goToPage(page) {
            state.currentPage = clampPageNumber(page, Math.max(1, Math.ceil(state.allVendors.length / state.itemsPerPage)));
            applyAndRender();
        }

        return {
            state,
            setVendors,
            setSearchQuery,
            setFoodTypeFilter,
            setSortBy,
            setPageSize,
            setAcceptingOnly,
            goToPage,
            applyAndRender
        };
    }

    function attachControlListeners(controller, elements) {
        if (elements.searchInput) {
            elements.searchInput.addEventListener("input", function onSearch(event) {
                controller.setSearchQuery(event.target.value || "");
            });
        }

        if (elements.foodTypeFilter) {
            elements.foodTypeFilter.addEventListener("change", function onFoodType(event) {
                controller.setFoodTypeFilter(event.target.value || "all");
            });
        }

        if (elements.sortControl) {
            elements.sortControl.addEventListener("change", function onSort(event) {
                controller.setSortBy(event.target.value || "name");
            });
        }

        if (elements.pageSizeControl) {
            elements.pageSizeControl.addEventListener("change", function onPageSize(event) {
                controller.setPageSize(event.target.value || DEFAULT_PAGE_SIZE);
            });
        }

        if (elements.acceptingOnlyToggle) {
            elements.acceptingOnlyToggle.addEventListener("change", function onAcceptingOnly(event) {
                controller.setAcceptingOnly(event.target.checked === true);
            });
        }

        if (elements.clearFiltersButton) {
            elements.clearFiltersButton.addEventListener("click", function onClear(event) {
                if (event && typeof event.preventDefault === "function") {
                    event.preventDefault();
                }

                if (elements.searchInput) {
                    elements.searchInput.value = "";
                }
                if (elements.foodTypeFilter) {
                    elements.foodTypeFilter.value = "all";
                }
                if (elements.sortControl) {
                    elements.sortControl.value = "name";
                }
                if (elements.acceptingOnlyToggle) {
                    elements.acceptingOnlyToggle.checked = false;
                }

                controller.state.searchQuery = "";
                controller.state.foodTypeFilter = "all";
                controller.state.sortBy = "name";
                controller.state.acceptingOnly = false;
                controller.state.currentPage = 1;
                controller.applyAndRender();
            });
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
        const searchSelector = options.searchSelector || "#vendor-search";
        const foodTypeSelector = options.foodTypeSelector || "#vendor-food-type-filter";
        const sortSelector = options.sortSelector || "#vendor-sort";
        const pageSizeSelector = options.pageSizeSelector || "#vendor-page-size";
        const acceptingOnlySelector = options.acceptingOnlySelector || "#vendor-accepting-only";
        const clearFiltersSelector = options.clearFiltersSelector || "#clear-vendor-filters";
        const resultsMetaSelector = options.resultsMetaSelector || "#vendors-results-meta";
        const paginationSelector = options.paginationSelector || "#vendors-pagination";

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

        const elements = {
            container,
            statusElement,
            refreshButton,
            backButtonHost,
            searchInput: globalScope.document.querySelector(searchSelector),
            foodTypeFilter: globalScope.document.querySelector(foodTypeSelector),
            sortControl: globalScope.document.querySelector(sortSelector),
            pageSizeControl: globalScope.document.querySelector(pageSizeSelector),
            acceptingOnlyToggle: globalScope.document.querySelector(acceptingOnlySelector),
            clearFiltersButton: globalScope.document.querySelector(clearFiltersSelector),
            resultsMeta: globalScope.document.querySelector(resultsMetaSelector),
            paginationContainer: globalScope.document.querySelector(paginationSelector)
        };

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

        const controller = createBrowseVendorsController(elements);
        controller.setVendors(result.vendors);
        attachControlListeners(controller, elements);

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
            vendors: result.vendors,
            controller
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
        DEFAULT_PAGE_SIZE,
        PAGE_SIZE_OPTIONS,
        SORT_OPTIONS,
        normalizeText,
        normalizeLowerText,
        resolveFirestore,
        resolveAuth,
        resolveAuthFns,
        resolveFirestoreFns,
        getFallbackRoutes,
        sortVendors,
        filterVendors,
        getFoodTypeOptions,
        vendorMatchesSearch,
        clampPageNumber,
        clampPageSize,
        paginate,
        getPageWindow,
        normalizeVendorRecord,
        mapFetchError,
        waitForAuthReady,
        fetchApprovedVendors,
        createBackButton,
        createVendorCard,
        renderEmptyState,
        renderVendors,
        renderFoodTypeOptions,
        renderSortOptions,
        renderPageSizeOptions,
        renderResultsMeta,
        renderPaginationControls,
        setStatusMessage,
        setLoadingState,
        buildVendorMenuUrl,
        handleVendorBrowseClick,
        setupEventListeners,
        createBrowseVendorsController,
        attachControlListeners,
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
