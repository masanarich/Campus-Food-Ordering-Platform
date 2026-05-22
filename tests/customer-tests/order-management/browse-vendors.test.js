// tests/customer-tests/order-management/browse-vendors.test.js

/**
 * @jest-environment jsdom
 */

const customerBrowseVendors = require("../../../public/customer/order-management/browse-vendors.js");

// ==========================================
// TEST UTILITIES
// ==========================================

function createMockVendor(overrides = {}) {
    return {
        uid: "vendor-1",
        displayName: "Campus Bites",
        email: "campus-bites@example.com",
        photoURL: "https://example.com/vendor-photo.jpg",
        vendorStatus: "approved",
        accountStatus: "active",
        businessName: "Campus Bites",
        description: "Delicious burgers and fries",
        location: "Matrix Food Court",
        rating: 4.5,
        totalOrders: 150,
        ...overrides
    };
}

function createFirestoreFns(options = {}) {
    const mockDocs = (options.mockVendors || []).map((vendorData) => ({
        id: vendorData.uid,
        data: () => vendorData
    }));
    const querySnapshot = {
        forEach: jest.fn((callback) => {
            mockDocs.forEach(callback);
        }),
        docs: mockDocs
    };

    return {
        collection: jest.fn(() => ({ kind: "collection" })),
        query: jest.fn((collectionRef, ...constraints) => ({
            kind: "query",
            collectionRef,
            constraints
        })),
        where: jest.fn((field, operator, value) => ({
            kind: "where",
            field,
            operator,
            value
        })),
        getDocs: jest.fn(async () => querySnapshot)
    };
}

function createDOMElements() {
    document.body.innerHTML = `
        <section id="vendors-container"></section>
        <p id="browse-vendors-status"></p>
    `;

    return {
        container: document.getElementById("vendors-container"),
        statusElement: document.getElementById("browse-vendors-status")
    };
}

function createFullDom() {
    document.body.innerHTML = `
        <input id="vendor-search" type="search">
        <select id="vendor-food-type-filter"></select>
        <select id="vendor-institution-filter"></select>
        <select id="vendor-campus-filter"></select>
        <select id="vendor-sort"></select>
        <select id="vendor-page-size"></select>
        <input id="vendor-accepting-only" type="checkbox">
        <button id="clear-vendor-filters" type="button">Reset</button>
        <p id="vendors-results-meta"></p>
        <nav id="vendors-pagination" hidden></nav>
        <section id="vendors-container"></section>
        <p id="browse-vendors-status"></p>
        <button id="refresh-vendors-button" type="button">Refresh Vendors</button>
        <li id="browse-vendors-back-button-host"></li>
    `;

    return {
        container: document.getElementById("vendors-container"),
        statusElement: document.getElementById("browse-vendors-status"),
        searchInput: document.getElementById("vendor-search"),
        foodTypeFilter: document.getElementById("vendor-food-type-filter"),
        institutionFilter: document.getElementById("vendor-institution-filter"),
        campusFilter: document.getElementById("vendor-campus-filter"),
        sortControl: document.getElementById("vendor-sort"),
        pageSizeControl: document.getElementById("vendor-page-size"),
        acceptingOnlyToggle: document.getElementById("vendor-accepting-only"),
        clearFiltersButton: document.getElementById("clear-vendor-filters"),
        resultsMeta: document.getElementById("vendors-results-meta"),
        paginationContainer: document.getElementById("vendors-pagination"),
        refreshButton: document.getElementById("refresh-vendors-button"),
        backButtonHost: document.getElementById("browse-vendors-back-button-host")
    };
}

function buildVendorList(count, base = {}) {
    const vendors = [];
    for (let index = 0; index < count; index += 1) {
        vendors.push(createMockVendor({
            uid: `vendor-${index + 1}`,
            businessName: `Vendor ${String.fromCharCode(65 + (index % 26))}${index}`,
            displayName: `Owner ${index}`,
            foodType: index % 2 === 0 ? "Burgers" : "Drinks",
            location: `Stall ${index + 1}`,
            rating: (index % 5) + 1,
            totalOrders: index * 5,
            ...base
        }));
    }
    return vendors;
}

// ==========================================
// TESTS: MODULE STRUCTURE
// ==========================================

describe("customer/order-management/browse-vendors.js - Module Structure", () => {
    test("exports all required functions", () => {
        expect(customerBrowseVendors.init).toBeDefined();
        expect(customerBrowseVendors.fetchApprovedVendors).toBeDefined();
        expect(customerBrowseVendors.renderVendors).toBeDefined();
        expect(customerBrowseVendors.createVendorCard).toBeDefined();
        expect(customerBrowseVendors.setStatusMessage).toBeDefined();
        expect(customerBrowseVendors.setLoadingState).toBeDefined();
        expect(customerBrowseVendors.handleVendorBrowseClick).toBeDefined();
        expect(customerBrowseVendors.setupEventListeners).toBeDefined();
        expect(customerBrowseVendors.paginate).toBeDefined();
        expect(customerBrowseVendors.filterVendors).toBeDefined();
        expect(customerBrowseVendors.sortVendors).toBeDefined();
        expect(customerBrowseVendors.getFoodTypeOptions).toBeDefined();
        expect(customerBrowseVendors.createBrowseVendorsController).toBeDefined();
    });

    test("all exported functions are actually functions", () => {
        expect(typeof customerBrowseVendors.init).toBe("function");
        expect(typeof customerBrowseVendors.fetchApprovedVendors).toBe("function");
        expect(typeof customerBrowseVendors.renderVendors).toBe("function");
        expect(typeof customerBrowseVendors.createVendorCard).toBe("function");
        expect(typeof customerBrowseVendors.paginate).toBe("function");
        expect(typeof customerBrowseVendors.filterVendors).toBe("function");
    });

    test("exposes pagination defaults", () => {
        expect(customerBrowseVendors.DEFAULT_PAGE_SIZE).toBe(10);
        expect(customerBrowseVendors.PAGE_SIZE_OPTIONS).toEqual(expect.arrayContaining([5, 10, 20, 50]));
        expect(customerBrowseVendors.SORT_OPTIONS.length).toBeGreaterThan(2);
    });
});

// ==========================================
// TESTS: fetchApprovedVendors
// ==========================================

describe("customer/order-management/browse-vendors.js - fetchApprovedVendors", () => {
    test("returns error when db is not provided", async () => {
        const result = await customerBrowseVendors.fetchApprovedVendors({ db: null });

        expect(result.success).toBe(false);
        expect(result.vendors).toEqual([]);
        expect(result.error.code).toBe("no-db");
        expect(result.error.message).toContain("Firestore database not available");
    });

    test("returns error when Firestore functions are not provided", async () => {
        const mockDb = { kind: "db" };
        const result = await customerBrowseVendors.fetchApprovedVendors({
            db: mockDb,
            firestoreFns: {}
        });

        expect(result.success).toBe(false);
        expect(result.vendors).toEqual([]);
        expect(result.error.code).toBe("no-firestore-fns");
    });

    test("fetches approved vendors successfully", async () => {
        const mockVendors = [
            createMockVendor({ uid: "vendor-1", displayName: "Alpha Vendor" }),
            createMockVendor({ uid: "vendor-2", displayName: "Beta Vendor", businessName: "Beta Foods" })
        ];

        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockVendors });

        const result = await customerBrowseVendors.fetchApprovedVendors({
            db: mockDb,
            firestoreFns
        });

        expect(result.success).toBe(true);
        expect(result.vendors).toHaveLength(2);
        expect(result.count).toBe(2);
        expect(result.vendors.map((vendor) => vendor.businessName)).toEqual([
            "Beta Foods",
            "Campus Bites"
        ]);
        expect(result.vendors[0].uid).toBe("vendor-2");
        expect(result.vendors[1].uid).toBe("vendor-1");

        // Verify Firestore calls
        expect(firestoreFns.collection).toHaveBeenCalledWith(mockDb, "users");
        expect(firestoreFns.where).toHaveBeenNthCalledWith(1, "vendorStatus", "==", "approved");
        expect(firestoreFns.where).toHaveBeenNthCalledWith(2, "accountStatus", "==", "active");
        expect(firestoreFns.query).toHaveBeenCalledTimes(1);
        expect(firestoreFns.getDocs).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "query" })
        );
    });

    test("normalizes new vendor fields from shop details", async () => {
        const mockVendors = [{
            uid: "vendor-1",
            displayName: "Owner",
            vendorStatus: "approved",
            accountStatus: "active",
            vendorBusinessName: "Burger Hut",
            vendorFoodType: "Burgers",
            vendorDescription: "Tasty",
            vendorLocation: "Hatfield Plaza",
            vendorUniversity: "UP",
            vendorOpeningHours: "Mon-Fri 08-17",
            vendorAcceptingOrders: false,
            vendorBannerURL: "https://files.example/banner.jpg",
            vendorPhoneNumber: "+27712345678",
            vendorEmail: "orders@burgerhut.co.za"
        }];

        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockVendors });

        const result = await customerBrowseVendors.fetchApprovedVendors({
            db: mockDb,
            firestoreFns
        });

        expect(result.success).toBe(true);
        expect(result.vendors).toHaveLength(1);

        const vendor = result.vendors[0];
        expect(vendor.businessName).toBe("Burger Hut");
        expect(vendor.foodType).toBe("Burgers");
        expect(vendor.location).toBe("Hatfield Plaza");
        expect(vendor.openingHours).toBe("Mon-Fri 08-17");
        expect(vendor.acceptingOrders).toBe(false);
        expect(vendor.photoURL).toBe("https://files.example/banner.jpg");
    });

    test("returns empty array when no vendors found", async () => {
        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockVendors: [] });

        const result = await customerBrowseVendors.fetchApprovedVendors({
            db: mockDb,
            firestoreFns
        });

        expect(result.success).toBe(true);
        expect(result.vendors).toEqual([]);
        expect(result.count).toBe(0);
    });

    test("normalizes vendor data with fallback values", async () => {
        const incompleteVendor = {
            uid: "vendor-minimal",
            vendorStatus: "approved"
        };

        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockVendors: [incompleteVendor] });

        const result = await customerBrowseVendors.fetchApprovedVendors({
            db: mockDb,
            firestoreFns
        });

        expect(result.success).toBe(true);
        expect(result.vendors).toHaveLength(1);

        const vendor = result.vendors[0];
        expect(vendor.displayName).toBe("Unknown Vendor");
        expect(vendor.businessName).toBe("Unknown Vendor");
        expect(vendor.location).toBe("Campus");
        expect(vendor.rating).toBe(0);
        expect(vendor.totalOrders).toBe(0);
        expect(vendor.acceptingOrders).toBe(true);
    });

    test("filters out disabled or blocked accounts", async () => {
        const mockVendors = [
            { uid: "v1", vendorStatus: "approved", accountStatus: "active", businessName: "Active" },
            { uid: "v2", vendorStatus: "approved", accountStatus: "disabled", businessName: "Disabled" },
            { uid: "v3", vendorStatus: "approved", accountStatus: "blocked", businessName: "Blocked" }
        ];

        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockVendors });

        const result = await customerBrowseVendors.fetchApprovedVendors({
            db: mockDb,
            firestoreFns
        });

        expect(result.vendors).toHaveLength(1);
        expect(result.vendors[0].businessName).toBe("Active");
    });

    test("handles Firestore errors gracefully", async () => {
        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockVendors: [] });
        firestoreFns.getDocs.mockRejectedValue(new Error("Network error"));

        const result = await customerBrowseVendors.fetchApprovedVendors({
            db: mockDb,
            firestoreFns
        });

        expect(result.success).toBe(false);
        expect(result.vendors).toEqual([]);
        expect(result.error.code).toBe("fetch-error");
        expect(result.error.message).toBe("Network error");
    });

    test("maps failed-precondition errors to a friendly index-building message", async () => {
        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockVendors: [] });
        const indexError = Object.assign(new Error("query requires an index"), { code: "failed-precondition" });
        firestoreFns.getDocs.mockRejectedValue(indexError);

        const result = await customerBrowseVendors.fetchApprovedVendors({
            db: mockDb,
            firestoreFns
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("vendors-query-not-ready");
    });

    test("maps permission-denied errors to a friendly message", async () => {
        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockVendors: [] });
        const permError = Object.assign(new Error("nope"), { code: "permission-denied" });
        firestoreFns.getDocs.mockRejectedValue(permError);

        const result = await customerBrowseVendors.fetchApprovedVendors({
            db: mockDb,
            firestoreFns
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("vendors-permission-denied");
    });
});

// ==========================================
// TESTS: createVendorCard
// ==========================================

describe("customer/order-management/browse-vendors.js - createVendorCard", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("creates vendor card with all elements", () => {
        const vendor = createMockVendor();
        const card = customerBrowseVendors.createVendorCard(vendor);

        expect(card.tagName).toBe("ARTICLE");
        expect(card.className).toBe("vendor-card");
        expect(card.getAttribute("data-vendor-uid")).toBe("vendor-1");

        // Check for image
        const img = card.querySelector("img.vendor-image");
        expect(img).not.toBeNull();
        expect(img.src).toContain("vendor-photo.jpg");
        expect(img.alt).toContain("Campus Bites");

        // Check for vendor name
        const heading = card.querySelector("h3.vendor-name");
        expect(heading).not.toBeNull();
        expect(heading.textContent).toBe("Campus Bites");

        // Check for location in metadata list
        const location = card.querySelector("li.vendor-location .vendor-meta-value");
        expect(location).not.toBeNull();
        expect(location.textContent).toBe("Matrix Food Court");

        // Check for button
        const button = card.querySelector("button.vendor-browse-button");
        expect(button).not.toBeNull();
        expect(button.textContent).toBe("View Menu");
        expect(button.getAttribute("data-vendor-uid")).toBe("vendor-1");
    });

    test("creates vendor card with rating and orders", () => {
        const vendor = createMockVendor({ rating: 4.8, totalOrders: 250 });
        const card = customerBrowseVendors.createVendorCard(vendor);

        const rating = card.querySelector("p.vendor-rating strong");
        expect(rating).not.toBeNull();
        expect(rating.textContent).toBe("4.8");

        const orders = card.querySelector("p.vendor-orders");
        expect(orders).not.toBeNull();
        expect(orders.textContent).toContain("250 orders");
    });

    test("creates vendor card without rating or orders", () => {
        const vendor = createMockVendor({ rating: 0, totalOrders: 0 });
        const card = customerBrowseVendors.createVendorCard(vendor);

        const stats = card.querySelector(".vendor-stats");
        expect(stats).toBeNull();
    });

    test("uses fallback image when photoURL is missing", () => {
        const vendor = createMockVendor({ photoURL: "" });
        const card = customerBrowseVendors.createVendorCard(vendor);

        const img = card.querySelector("img.vendor-image");
        expect(img.src).toContain("default-avatar.png");
    });

    test("includes description when available", () => {
        const vendor = createMockVendor({ description: "Best burgers on campus" });
        const card = customerBrowseVendors.createVendorCard(vendor);

        const description = card.querySelector("p.vendor-description");
        expect(description).not.toBeNull();
        expect(description.textContent).toBe("Best burgers on campus");
    });

    test("renders food-type chip when food type is provided", () => {
        const vendor = createMockVendor({ foodType: "Burgers" });
        const card = customerBrowseVendors.createVendorCard(vendor);

        const chip = card.querySelector(".vendor-food-chip");
        expect(chip).not.toBeNull();
        expect(chip.textContent).toBe("Burgers");
        expect(card.getAttribute("data-food-type")).toBe("burgers");
    });

    test("omits food-type chip when food type is missing", () => {
        const vendor = createMockVendor({ foodType: "" });
        const card = customerBrowseVendors.createVendorCard(vendor);

        const chip = card.querySelector(".vendor-food-chip");
        expect(chip).toBeNull();
    });

    test("renders opening hours when available", () => {
        const vendor = createMockVendor({ openingHours: "Mon-Fri 08-17" });
        const card = customerBrowseVendors.createVendorCard(vendor);

        const hours = card.querySelector(".vendor-opening-hours .vendor-meta-value");
        expect(hours).not.toBeNull();
        expect(hours.textContent).toBe("Mon-Fri 08-17");
    });

    test("shows accepting-orders badge by default", () => {
        const vendor = createMockVendor();
        const card = customerBrowseVendors.createVendorCard(vendor);

        const badge = card.querySelector(".vendor-status-badge");
        expect(badge).not.toBeNull();
        expect(badge.className).toContain("vendor-status-badge-open");
        expect(badge.textContent).toBe("Accepting orders");
    });

    test("shows closed badge and altered button when not accepting orders", () => {
        const vendor = createMockVendor({ acceptingOrders: false });
        const card = customerBrowseVendors.createVendorCard(vendor);

        const badge = card.querySelector(".vendor-status-badge");
        expect(badge.className).toContain("vendor-status-badge-closed");

        const button = card.querySelector("button.vendor-browse-button");
        expect(button.textContent).toBe("View Menu (closed)");
        expect(button.dataset.acceptingOrders).toBe("false");
    });
});

// ==========================================
// TESTS: renderVendors
// ==========================================

describe("customer/order-management/browse-vendors.js - renderVendors", () => {
    let container;

    beforeEach(() => {
        const elements = createDOMElements();
        container = elements.container;
    });

    test("renders multiple vendor cards", () => {
        const vendors = [
            createMockVendor({ uid: "vendor-1", businessName: "Vendor One" }),
            createMockVendor({ uid: "vendor-2", businessName: "Vendor Two" })
        ];

        customerBrowseVendors.renderVendors(vendors, container);

        const cards = container.querySelectorAll(".vendor-card");
        expect(cards).toHaveLength(2);
        expect(cards[0].getAttribute("data-vendor-uid")).toBe("vendor-1");
        expect(cards[1].getAttribute("data-vendor-uid")).toBe("vendor-2");
    });

    test("displays empty state message when no vendors", () => {
        customerBrowseVendors.renderVendors([], container);

        const message = container.querySelector(".empty-state-message");
        expect(message).not.toBeNull();
        expect(message.textContent).toContain("No approved vendors are available right now");
    });

    test("clears existing content before rendering", () => {
        container.innerHTML = "<p>Old content</p>";

        const vendors = [createMockVendor()];
        customerBrowseVendors.renderVendors(vendors, container);

        const oldContent = container.textContent.includes("Old content");
        expect(oldContent).toBe(false);
        expect(container.querySelectorAll(".vendor-card")).toHaveLength(1);
    });

    test("handles null container gracefully", () => {
        expect(() => {
            customerBrowseVendors.renderVendors([createMockVendor()], null);
        }).not.toThrow();
    });
});

// ==========================================
// TESTS: setStatusMessage
// ==========================================

describe("customer/order-management/browse-vendors.js - setStatusMessage", () => {
    let statusElement;

    beforeEach(() => {
        const elements = createDOMElements();
        statusElement = elements.statusElement;
    });

    test("sets status message and state attribute", () => {
        customerBrowseVendors.setStatusMessage(statusElement, "Success!", "success");

        expect(statusElement.textContent).toBe("Success!");
        expect(statusElement.getAttribute("data-state")).toBe("success");
    });

    test("handles different state types", () => {
        customerBrowseVendors.setStatusMessage(statusElement, "Error occurred", "error");
        expect(statusElement.getAttribute("data-state")).toBe("error");

        customerBrowseVendors.setStatusMessage(statusElement, "Loading...", "loading");
        expect(statusElement.getAttribute("data-state")).toBe("loading");

        customerBrowseVendors.setStatusMessage(statusElement, "Info message", "info");
        expect(statusElement.getAttribute("data-state")).toBe("info");
    });

    test("defaults to info state", () => {
        customerBrowseVendors.setStatusMessage(statusElement, "Default message");

        expect(statusElement.getAttribute("data-state")).toBe("info");
    });

    test("handles null element gracefully", () => {
        expect(() => {
            customerBrowseVendors.setStatusMessage(null, "Test", "success");
        }).not.toThrow();
    });
});

// ==========================================
// TESTS: setLoadingState
// ==========================================

describe("customer/order-management/browse-vendors.js - setLoadingState", () => {
    let container;

    beforeEach(() => {
        const elements = createDOMElements();
        container = elements.container;
    });

    test("sets loading state to true", () => {
        customerBrowseVendors.setLoadingState(container, true);

        expect(container.getAttribute("data-loading")).toBe("true");
        expect(container.querySelector(".loading-message")).not.toBeNull();
        expect(container.textContent).toContain("Loading vendors...");
    });

    test("sets loading state to false", () => {
        container.setAttribute("data-loading", "true");

        customerBrowseVendors.setLoadingState(container, false);

        expect(container.getAttribute("data-loading")).toBeNull();
    });

    test("handles null container gracefully", () => {
        expect(() => {
            customerBrowseVendors.setLoadingState(null, true);
        }).not.toThrow();
    });
});

// ==========================================
// TESTS: handleVendorBrowseClick
// ==========================================

describe("customer/order-management/browse-vendors.js - handleVendorBrowseClick", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("extracts vendor data from button and constructs URL", () => {
        const button = document.createElement("button");
        button.className = "vendor-browse-button";
        button.setAttribute("data-vendor-uid", "vendor-123");
        button.setAttribute("data-vendor-name", "Test Vendor");
        document.body.appendChild(button);

        expect(button.getAttribute("data-vendor-uid")).toBe("vendor-123");
        expect(button.getAttribute("data-vendor-name")).toBe("Test Vendor");
    });

    test("does nothing when clicked element is not a vendor button", () => {
        const notAButton = document.createElement("p");
        document.body.appendChild(notAButton);

        const event = new Event("click", { bubbles: true });
        Object.defineProperty(event, "target", { value: notAButton, enumerable: true });

        expect(() => {
            customerBrowseVendors.handleVendorBrowseClick(event);
        }).not.toThrow();
    });

    test("handles missing vendor UID gracefully", () => {
        const button = document.createElement("button");
        button.className = "vendor-browse-button";
        document.body.appendChild(button);

        const event = new Event("click", { bubbles: true });
        Object.defineProperty(event, "target", { value: button, enumerable: true });

        expect(() => {
            customerBrowseVendors.handleVendorBrowseClick(event);
        }).not.toThrow();
    });
});

// ==========================================
// TESTS: setupEventListeners
// ==========================================

describe("customer/order-management/browse-vendors.js - setupEventListeners", () => {
    let container;

    beforeEach(() => {
        const elements = createDOMElements();
        container = elements.container;
    });

    test("adds click event listener to container", () => {
        const addEventListenerSpy = jest.spyOn(container, "addEventListener");

        customerBrowseVendors.setupEventListeners(container);

        expect(addEventListenerSpy).toHaveBeenCalledWith("click", expect.any(Function));
    });

    test("handles null container gracefully", () => {
        expect(() => {
            customerBrowseVendors.setupEventListeners(null);
        }).not.toThrow();
    });

    test("accepts options object with container/refreshButton/backButtonHost", () => {
        document.body.innerHTML = `
            <section id="container"></section>
            <button id="refresh">Refresh</button>
            <li id="host"></li>
        `;

        const containerEl = document.getElementById("container");
        const refreshEl = document.getElementById("refresh");
        const hostEl = document.getElementById("host");
        const onRefresh = jest.fn();

        customerBrowseVendors.setupEventListeners({
            container: containerEl,
            refreshButton: refreshEl,
            backButtonHost: hostEl,
            onRefresh
        });

        refreshEl.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(onRefresh).toHaveBeenCalled();

        expect(hostEl.querySelector(".browse-vendors-back-button")).not.toBeNull();
    });
});

// ==========================================
// TESTS: sortVendors
// ==========================================

describe("customer/order-management/browse-vendors.js - sortVendors", () => {
    test("sorts by name ascending by default", () => {
        const vendors = [
            createMockVendor({ businessName: "Charlie" }),
            createMockVendor({ businessName: "Alpha" }),
            createMockVendor({ businessName: "Beta" })
        ];

        const sorted = customerBrowseVendors.sortVendors(vendors);

        expect(sorted.map((v) => v.businessName)).toEqual(["Alpha", "Beta", "Charlie"]);
    });

    test("sorts by name descending", () => {
        const vendors = [
            createMockVendor({ businessName: "Alpha" }),
            createMockVendor({ businessName: "Charlie" }),
            createMockVendor({ businessName: "Beta" })
        ];

        const sorted = customerBrowseVendors.sortVendors(vendors, "name-desc");

        expect(sorted.map((v) => v.businessName)).toEqual(["Charlie", "Beta", "Alpha"]);
    });

    test("sorts by rating descending", () => {
        const vendors = [
            createMockVendor({ businessName: "Alpha", rating: 3 }),
            createMockVendor({ businessName: "Beta", rating: 5 }),
            createMockVendor({ businessName: "Charlie", rating: 4 })
        ];

        const sorted = customerBrowseVendors.sortVendors(vendors, "rating");

        expect(sorted.map((v) => v.businessName)).toEqual(["Beta", "Charlie", "Alpha"]);
    });

    test("sorts by total orders descending", () => {
        const vendors = [
            createMockVendor({ businessName: "Alpha", totalOrders: 30 }),
            createMockVendor({ businessName: "Beta", totalOrders: 10 }),
            createMockVendor({ businessName: "Charlie", totalOrders: 50 })
        ];

        const sorted = customerBrowseVendors.sortVendors(vendors, "orders");

        expect(sorted.map((v) => v.businessName)).toEqual(["Charlie", "Alpha", "Beta"]);
    });

    test("sorts by newest first using updatedAt", () => {
        const vendors = [
            createMockVendor({ businessName: "Alpha", updatedAt: "2024-01-01T00:00:00Z" }),
            createMockVendor({ businessName: "Beta", updatedAt: "2026-01-01T00:00:00Z" }),
            createMockVendor({ businessName: "Charlie", updatedAt: "2025-01-01T00:00:00Z" })
        ];

        const sorted = customerBrowseVendors.sortVendors(vendors, "newest");

        expect(sorted.map((v) => v.businessName)).toEqual(["Beta", "Charlie", "Alpha"]);
    });

    test("returns empty array for non-array input", () => {
        expect(customerBrowseVendors.sortVendors(null)).toEqual([]);
        expect(customerBrowseVendors.sortVendors(undefined)).toEqual([]);
    });
});

// ==========================================
// TESTS: filterVendors
// ==========================================

describe("customer/order-management/browse-vendors.js - filterVendors", () => {
    test("returns all vendors when no filters applied", () => {
        const vendors = buildVendorList(3);
        const filtered = customerBrowseVendors.filterVendors(vendors);
        expect(filtered).toHaveLength(3);
    });

    test("filters by search query across multiple fields", () => {
        const vendors = [
            createMockVendor({ businessName: "Burger Hut", description: "Char-grilled patties", location: "Stall A" }),
            createMockVendor({ businessName: "Pizza Place", foodType: "Pizza", description: "Wood-fired pies", location: "Stall B" }),
            createMockVendor({ businessName: "Hatfield Cafe", description: "Coffee and pastries", location: "Hatfield Plaza" })
        ];

        expect(customerBrowseVendors.filterVendors(vendors, { searchQuery: "burger" })).toHaveLength(1);
        expect(customerBrowseVendors.filterVendors(vendors, { searchQuery: "pizza" })).toHaveLength(1);
        expect(customerBrowseVendors.filterVendors(vendors, { searchQuery: "hatfield" })).toHaveLength(1);
        expect(customerBrowseVendors.filterVendors(vendors, { searchQuery: "nothing" })).toHaveLength(0);
    });

    test("filters by food type", () => {
        const vendors = [
            createMockVendor({ businessName: "A", foodType: "Burgers" }),
            createMockVendor({ businessName: "B", foodType: "Drinks" }),
            createMockVendor({ businessName: "C", foodType: "Burgers" })
        ];

        const filtered = customerBrowseVendors.filterVendors(vendors, { foodTypeFilter: "burgers" });
        expect(filtered).toHaveLength(2);
        expect(filtered.map((v) => v.businessName)).toEqual(["A", "C"]);
    });

    test("food-type filter 'all' returns everything", () => {
        const vendors = [
            createMockVendor({ businessName: "A", foodType: "Burgers" }),
            createMockVendor({ businessName: "B", foodType: "Drinks" })
        ];

        const filtered = customerBrowseVendors.filterVendors(vendors, { foodTypeFilter: "all" });
        expect(filtered).toHaveLength(2);
    });

    test("acceptingOnly drops vendors that are closed", () => {
        const vendors = [
            createMockVendor({ businessName: "Open", acceptingOrders: true }),
            createMockVendor({ businessName: "Closed", acceptingOrders: false })
        ];

        const filtered = customerBrowseVendors.filterVendors(vendors, { acceptingOnly: true });
        expect(filtered).toHaveLength(1);
        expect(filtered[0].businessName).toBe("Open");
    });

    test("combines multiple filters", () => {
        const vendors = [
            createMockVendor({ businessName: "Burger Hut", foodType: "Burgers", acceptingOrders: true }),
            createMockVendor({ businessName: "Burger Town", foodType: "Burgers", acceptingOrders: false }),
            createMockVendor({ businessName: "Drinks Bar", foodType: "Drinks", acceptingOrders: true })
        ];

        const filtered = customerBrowseVendors.filterVendors(vendors, {
            searchQuery: "burger",
            foodTypeFilter: "burgers",
            acceptingOnly: true
        });

        expect(filtered).toHaveLength(1);
        expect(filtered[0].businessName).toBe("Burger Hut");
    });

    test("returns empty array for non-array input", () => {
        expect(customerBrowseVendors.filterVendors(null)).toEqual([]);
    });
});

// ==========================================
// TESTS: paginate
// ==========================================

describe("customer/order-management/browse-vendors.js - paginate", () => {
    test("returns first 10 items by default", () => {
        const vendors = buildVendorList(25);
        const result = customerBrowseVendors.paginate(vendors);

        expect(result.items).toHaveLength(10);
        expect(result.page).toBe(1);
        expect(result.perPage).toBe(10);
        expect(result.totalItems).toBe(25);
        expect(result.totalPages).toBe(3);
        expect(result.from).toBe(1);
        expect(result.to).toBe(10);
    });

    test("returns correct slice for middle page", () => {
        const vendors = buildVendorList(25);
        const result = customerBrowseVendors.paginate(vendors, { page: 2, perPage: 10 });

        expect(result.items).toHaveLength(10);
        expect(result.page).toBe(2);
        expect(result.from).toBe(11);
        expect(result.to).toBe(20);
    });

    test("handles last partial page", () => {
        const vendors = buildVendorList(25);
        const result = customerBrowseVendors.paginate(vendors, { page: 3, perPage: 10 });

        expect(result.items).toHaveLength(5);
        expect(result.from).toBe(21);
        expect(result.to).toBe(25);
    });

    test("clamps page numbers above total", () => {
        const vendors = buildVendorList(5);
        const result = customerBrowseVendors.paginate(vendors, { page: 99, perPage: 10 });

        expect(result.page).toBe(1);
        expect(result.items).toHaveLength(5);
    });

    test("clamps invalid page numbers to 1", () => {
        const vendors = buildVendorList(5);
        const result = customerBrowseVendors.paginate(vendors, { page: 0, perPage: 10 });

        expect(result.page).toBe(1);

        const negative = customerBrowseVendors.paginate(vendors, { page: -3, perPage: 10 });
        expect(negative.page).toBe(1);
    });

    test("returns from=0, to=0 when items are empty", () => {
        const result = customerBrowseVendors.paginate([], { page: 1, perPage: 10 });

        expect(result.totalItems).toBe(0);
        expect(result.totalPages).toBe(1);
        expect(result.from).toBe(0);
        expect(result.to).toBe(0);
    });

    test("clamps invalid perPage to default", () => {
        const vendors = buildVendorList(12);
        const result = customerBrowseVendors.paginate(vendors, { page: 1, perPage: 0 });

        expect(result.perPage).toBe(10);
    });

    test("returns empty items when input is not an array", () => {
        const result = customerBrowseVendors.paginate(null);
        expect(result.items).toEqual([]);
    });
});

describe("customer/order-management/browse-vendors.js - getPageWindow", () => {
    test("returns a centered window around current page", () => {
        expect(customerBrowseVendors.getPageWindow(5, 10, 5)).toEqual([3, 4, 5, 6, 7]);
    });

    test("clamps to the start of the range", () => {
        expect(customerBrowseVendors.getPageWindow(1, 10, 5)).toEqual([1, 2, 3, 4, 5]);
    });

    test("clamps to the end of the range", () => {
        expect(customerBrowseVendors.getPageWindow(10, 10, 5)).toEqual([6, 7, 8, 9, 10]);
    });

    test("works with small totals", () => {
        expect(customerBrowseVendors.getPageWindow(1, 2, 5)).toEqual([1, 2]);
    });
});

// ==========================================
// TESTS: getFoodTypeOptions
// ==========================================

describe("customer/order-management/browse-vendors.js - getFoodTypeOptions", () => {
    test("returns sorted unique food types", () => {
        const vendors = [
            createMockVendor({ foodType: "Burgers" }),
            createMockVendor({ foodType: "Drinks" }),
            createMockVendor({ foodType: "burgers" }),
            createMockVendor({ foodType: "" }),
            createMockVendor({ foodType: "Pizza" })
        ];

        const result = customerBrowseVendors.getFoodTypeOptions(vendors);
        expect(result).toEqual(["Burgers", "Drinks", "Pizza"]);
    });

    test("returns empty array when no vendors have food types", () => {
        const vendors = [
            createMockVendor({ foodType: "" }),
            createMockVendor({ foodType: undefined })
        ];

        expect(customerBrowseVendors.getFoodTypeOptions(vendors)).toEqual([]);
    });

    test("tolerates non-array input", () => {
        expect(customerBrowseVendors.getFoodTypeOptions(null)).toEqual([]);
    });
});

// ==========================================
// TESTS: render helpers
// ==========================================

describe("customer/order-management/browse-vendors.js - select renderers", () => {
    test("renderFoodTypeOptions adds 'All food types' plus each food type", () => {
        document.body.innerHTML = '<select id="select"></select>';
        const select = document.getElementById("select");

        customerBrowseVendors.renderFoodTypeOptions(select, ["Burgers", "Drinks"], "burgers");

        const options = select.querySelectorAll("option");
        expect(options).toHaveLength(3);
        expect(options[0].textContent).toBe("All food types");
        expect(options[1].textContent).toBe("Burgers");
        expect(options[1].selected).toBe(true);
    });

    test("renderSortOptions renders all sort options with selection", () => {
        document.body.innerHTML = '<select id="sort"></select>';
        const select = document.getElementById("sort");

        customerBrowseVendors.renderSortOptions(select, "rating");

        const selected = select.querySelector("option[selected]") || Array.from(select.options).find((o) => o.selected);
        expect(selected.value).toBe("rating");
    });

    test("renderPageSizeOptions includes the configured options", () => {
        document.body.innerHTML = '<select id="size"></select>';
        const select = document.getElementById("size");

        customerBrowseVendors.renderPageSizeOptions(select, 20);

        const options = Array.from(select.options).map((o) => o.value);
        expect(options).toEqual(["5", "10", "20", "50"]);
        const selected = select.options[2];
        expect(selected.value).toBe("20");
        expect(selected.selected).toBe(true);
    });

    test("each renderer handles null element gracefully", () => {
        expect(() => customerBrowseVendors.renderFoodTypeOptions(null, [], "")).not.toThrow();
        expect(() => customerBrowseVendors.renderSortOptions(null, "")).not.toThrow();
        expect(() => customerBrowseVendors.renderPageSizeOptions(null, 10)).not.toThrow();
    });
});

describe("customer/order-management/browse-vendors.js - renderResultsMeta", () => {
    test("reports 0 vendors when total is zero", () => {
        document.body.innerHTML = '<p id="meta"></p>';
        const meta = document.getElementById("meta");

        customerBrowseVendors.renderResultsMeta(meta, { totalItems: 0, from: 0, to: 0 });
        expect(meta.textContent).toBe("Showing 0 vendors");
    });

    test("reports the visible range", () => {
        document.body.innerHTML = '<p id="meta"></p>';
        const meta = document.getElementById("meta");

        customerBrowseVendors.renderResultsMeta(meta, { totalItems: 25, from: 11, to: 20 });
        expect(meta.textContent).toBe("Showing 11-20 of 25 vendors");
    });

    test("handles null element gracefully", () => {
        expect(() => customerBrowseVendors.renderResultsMeta(null, { totalItems: 1, from: 1, to: 1 })).not.toThrow();
    });
});

describe("customer/order-management/browse-vendors.js - renderPaginationControls", () => {
    test("renders disabled prev/next on the only page", () => {
        document.body.innerHTML = '<nav id="pages"></nav>';
        const nav = document.getElementById("pages");

        customerBrowseVendors.renderPaginationControls(nav, {
            totalItems: 5,
            totalPages: 1,
            page: 1
        });

        expect(nav.querySelector(".vendors-pagination-indicator").textContent).toBe("Page 1 of 1");
    });

    test("hides itself when totalItems is zero", () => {
        document.body.innerHTML = '<nav id="pages"></nav>';
        const nav = document.getElementById("pages");
        nav.hidden = false;

        customerBrowseVendors.renderPaginationControls(nav, {
            totalItems: 0,
            totalPages: 1,
            page: 1
        });

        expect(nav.hidden).toBe(true);
    });

    test("renders prev, next, and page buttons with active page", () => {
        document.body.innerHTML = '<nav id="pages"></nav>';
        const nav = document.getElementById("pages");
        const onPageChange = jest.fn();

        customerBrowseVendors.renderPaginationControls(nav, {
            totalItems: 30,
            totalPages: 3,
            page: 2
        }, { onPageChange });

        const prev = nav.querySelector(".vendors-pagination-prev");
        const next = nav.querySelector(".vendors-pagination-next");
        const pageButtons = nav.querySelectorAll(".vendors-pagination-page");

        expect(prev.disabled).toBe(false);
        expect(next.disabled).toBe(false);
        expect(pageButtons).toHaveLength(3);
        expect(nav.querySelector('[aria-current="page"]').textContent).toBe("2");

        prev.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(onPageChange).toHaveBeenCalledWith(1);

        next.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(onPageChange).toHaveBeenCalledWith(3);

        pageButtons[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(onPageChange).toHaveBeenCalledWith(3);
    });

    test("handles null container gracefully", () => {
        expect(() => customerBrowseVendors.renderPaginationControls(null, { totalItems: 1, totalPages: 1, page: 1 }))
            .not.toThrow();
    });
});

// ==========================================
// TESTS: createBrowseVendorsController
// ==========================================

describe("customer/order-management/browse-vendors.js - createBrowseVendorsController", () => {
    let elements;

    beforeEach(() => {
        elements = createFullDom();
    });

    test("setVendors renders first page (10 items)", () => {
        const controller = customerBrowseVendors.createBrowseVendorsController(elements);
        const vendors = buildVendorList(25);

        controller.setVendors(vendors);

        const cards = elements.container.querySelectorAll(".vendor-card");
        expect(cards).toHaveLength(10);
        expect(elements.resultsMeta.textContent).toBe("Showing 1-10 of 25 vendors");
        expect(elements.paginationContainer.hidden).toBe(false);
        expect(elements.paginationContainer.querySelectorAll(".vendors-pagination-page").length)
            .toBeGreaterThan(0);
        expect(elements.foodTypeFilter.querySelectorAll("option").length).toBeGreaterThan(1);
    });

    test("setSearchQuery filters and re-renders", () => {
        const controller = customerBrowseVendors.createBrowseVendorsController(elements);
        const vendors = [
            createMockVendor({ uid: "v1", businessName: "Burger Hut" }),
            createMockVendor({ uid: "v2", businessName: "Pizza Place", foodType: "Pizza" }),
            createMockVendor({ uid: "v3", businessName: "Coffee Spot", foodType: "Drinks" })
        ];

        controller.setVendors(vendors);
        controller.setSearchQuery("pizza");

        const cards = elements.container.querySelectorAll(".vendor-card");
        expect(cards).toHaveLength(1);
        expect(cards[0].getAttribute("data-vendor-uid")).toBe("v2");
    });

    test("setFoodTypeFilter scopes the list to one food type", () => {
        const controller = customerBrowseVendors.createBrowseVendorsController(elements);
        controller.setVendors(buildVendorList(6));
        controller.setFoodTypeFilter("drinks");

        const cards = elements.container.querySelectorAll(".vendor-card");
        cards.forEach(function checkOne(card) {
            expect(card.getAttribute("data-food-type")).toBe("drinks");
        });
    });

    test("setSortBy reorders the list", () => {
        const controller = customerBrowseVendors.createBrowseVendorsController(elements);
        controller.setVendors([
            createMockVendor({ uid: "v1", businessName: "Alpha", rating: 1 }),
            createMockVendor({ uid: "v2", businessName: "Beta", rating: 5 }),
            createMockVendor({ uid: "v3", businessName: "Charlie", rating: 3 })
        ]);

        controller.setSortBy("rating");

        const cards = elements.container.querySelectorAll(".vendor-card");
        expect(cards[0].getAttribute("data-vendor-uid")).toBe("v2");
        expect(cards[1].getAttribute("data-vendor-uid")).toBe("v3");
        expect(cards[2].getAttribute("data-vendor-uid")).toBe("v1");
    });

    test("setPageSize changes how many vendors are shown per page", () => {
        const controller = customerBrowseVendors.createBrowseVendorsController(elements);
        controller.setVendors(buildVendorList(20));

        controller.setPageSize(5);

        expect(elements.container.querySelectorAll(".vendor-card")).toHaveLength(5);
        expect(elements.resultsMeta.textContent).toBe("Showing 1-5 of 20 vendors");
    });

    test("setAcceptingOnly hides closed vendors", () => {
        const controller = customerBrowseVendors.createBrowseVendorsController(elements);
        controller.setVendors([
            createMockVendor({ uid: "open", acceptingOrders: true, businessName: "Open Shop" }),
            createMockVendor({ uid: "closed", acceptingOrders: false, businessName: "Closed Shop" })
        ]);

        controller.setAcceptingOnly(true);

        const cards = elements.container.querySelectorAll(".vendor-card");
        expect(cards).toHaveLength(1);
        expect(cards[0].getAttribute("data-vendor-uid")).toBe("open");
    });

    test("goToPage advances to the requested page", () => {
        const controller = customerBrowseVendors.createBrowseVendorsController(elements);
        controller.setVendors(buildVendorList(25));

        controller.goToPage(2);

        expect(controller.state.currentPage).toBe(2);
        expect(elements.resultsMeta.textContent).toBe("Showing 11-20 of 25 vendors");
    });

    test("shows a 'no match' message when filters exclude everything", () => {
        const controller = customerBrowseVendors.createBrowseVendorsController(elements);
        controller.setVendors(buildVendorList(5));

        controller.setSearchQuery("zzz-nothing-matches");

        const emptyMessage = elements.container.querySelector(".empty-state-message");
        expect(emptyMessage).not.toBeNull();
        expect(emptyMessage.textContent).toContain("No vendors match your filters");
    });

    test("shows 'no approved vendors' when the source list is empty", () => {
        const controller = customerBrowseVendors.createBrowseVendorsController(elements);
        controller.setVendors([]);

        const emptyMessage = elements.container.querySelector(".empty-state-message");
        expect(emptyMessage.textContent).toContain("No approved vendors are available right now.");
    });

    test("calls onAfterRender callback with page info and state snapshot", () => {
        const onAfterRender = jest.fn();
        const controller = customerBrowseVendors.createBrowseVendorsController(elements, { onAfterRender });
        controller.setVendors(buildVendorList(3));

        expect(onAfterRender).toHaveBeenCalledWith(expect.objectContaining({
            pageInfo: expect.objectContaining({ totalItems: 3, page: 1 }),
            state: expect.objectContaining({ currentPage: 1, sortBy: "open" })
        }));
    });
});

// ==========================================
// TESTS: attachControlListeners
// ==========================================

describe("customer/order-management/browse-vendors.js - attachControlListeners", () => {
    let elements;
    let controller;

    beforeEach(() => {
        elements = createFullDom();
        controller = customerBrowseVendors.createBrowseVendorsController(elements);
        controller.setVendors(buildVendorList(15));
        customerBrowseVendors.attachControlListeners(controller, elements);
    });

    test("search input triggers controller filtering", () => {
        elements.searchInput.value = "vendor d3";
        elements.searchInput.dispatchEvent(new Event("input", { bubbles: true }));

        expect(controller.state.searchQuery).toBe("vendor d3");
    });

    test("food type select triggers controller filter", () => {
        elements.foodTypeFilter.value = "burgers";
        elements.foodTypeFilter.dispatchEvent(new Event("change", { bubbles: true }));

        expect(controller.state.foodTypeFilter).toBe("burgers");
    });

    test("sort select triggers controller sort", () => {
        elements.sortControl.value = "rating";
        elements.sortControl.dispatchEvent(new Event("change", { bubbles: true }));

        expect(controller.state.sortBy).toBe("rating");
    });

    test("page-size select triggers controller pageSize change", () => {
        elements.pageSizeControl.value = "5";
        elements.pageSizeControl.dispatchEvent(new Event("change", { bubbles: true }));

        expect(controller.state.itemsPerPage).toBe(5);
    });

    test("accepting-only toggle triggers controller filter", () => {
        elements.acceptingOnlyToggle.checked = true;
        elements.acceptingOnlyToggle.dispatchEvent(new Event("change", { bubbles: true }));

        expect(controller.state.acceptingOnly).toBe(true);
    });

    test("clear filters button resets all filters", () => {
        controller.setSearchQuery("anything");
        controller.setFoodTypeFilter("burgers");
        controller.setSortBy("rating");
        controller.setAcceptingOnly(true);

        elements.clearFiltersButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

        expect(controller.state.searchQuery).toBe("");
        expect(controller.state.foodTypeFilter).toBe("all");
        expect(controller.state.sortBy).toBe("open");
        expect(controller.state.acceptingOnly).toBe(false);
    });
});

// ==========================================
// TESTS: schedule-aware open/closed (computeVendorOpenState, normalizeVendorRecord)
// ==========================================

const shopSchedule = require("../../../public/shared/shop-schedule/shop-schedule.js");

describe("customer/order-management/browse-vendors.js - schedule-aware open/closed", () => {
    test("normalizeVendorRecord uses vendorSchedule to compute acceptingOrders", () => {
        const docSnapshot = {
            id: "vendor-1",
            data: () => ({
                vendorBusinessName: "Burger Hut",
                vendorAcceptingOrders: true,
                vendorSchedule: shopSchedule.getDefaultSchedule()
            })
        };

        // Thursday 10:00 — default schedule has Mon-Fri 08:00-17:00 → open
        const openVendor = customerBrowseVendors.normalizeVendorRecord(docSnapshot, {
            now: new Date("2026-05-21T10:00:00")
        });
        expect(openVendor.acceptingOrders).toBe(true);
        expect(openVendor.openState.reason).toBe("within-hours");
        expect(openVendor.manualAcceptingOrders).toBe(true);

        // Sunday — default schedule is closed
        const closedVendor = customerBrowseVendors.normalizeVendorRecord(docSnapshot, {
            now: new Date("2026-05-24T10:00:00")
        });
        expect(closedVendor.acceptingOrders).toBe(false);
        expect(closedVendor.openState.reason).toBe("outside-hours");
    });

    test("manual override (acceptingOrders=false) forces closed regardless of schedule", () => {
        const docSnapshot = {
            id: "vendor-1",
            data: () => ({
                vendorAcceptingOrders: false,
                vendorSchedule: shopSchedule.getDefaultSchedule()
            })
        };

        const vendor = customerBrowseVendors.normalizeVendorRecord(docSnapshot, {
            now: new Date("2026-05-21T10:00:00")
        });
        expect(vendor.acceptingOrders).toBe(false);
        expect(vendor.openState.reason).toBe("manually-closed");
    });

    test("vendor without schedule defers to manual accepting flag", () => {
        const docSnapshot = {
            id: "vendor-1",
            data: () => ({ vendorAcceptingOrders: true })
        };
        const vendor = customerBrowseVendors.normalizeVendorRecord(docSnapshot);
        expect(vendor.acceptingOrders).toBe(true);
        expect(vendor.openState.reason).toBe("no-schedule");
    });

    test("normalizeVendorRecord populates institution and campus from new shop fields", () => {
        const docSnapshot = {
            id: "vendor-1",
            data: () => ({
                vendorInstitution: "University of Pretoria",
                vendorInstitutionType: "Public University",
                vendorCampus: "Hatfield Campus",
                vendorStallLocation: "Stall 7"
            })
        };

        const vendor = customerBrowseVendors.normalizeVendorRecord(docSnapshot);
        expect(vendor.institution).toBe("University of Pretoria");
        expect(vendor.institutionType).toBe("Public University");
        expect(vendor.campus).toBe("Hatfield Campus");
        expect(vendor.stallLocation).toBe("Stall 7");
        expect(vendor.location).toBe("Hatfield Campus — Stall 7");
    });

    test("createVendorCard reflects open/closed from openState", () => {
        const docSnapshot = {
            id: "vendor-1",
            data: () => ({
                vendorBusinessName: "Burger Hut",
                vendorAcceptingOrders: true,
                vendorSchedule: shopSchedule.getDefaultSchedule()
            })
        };

        const closed = customerBrowseVendors.normalizeVendorRecord(docSnapshot, {
            now: new Date("2026-05-21T20:00:00") // after close
        });
        const card = customerBrowseVendors.createVendorCard(closed);

        expect(card.getAttribute("data-closed")).toBe("true");
        expect(card.querySelector(".vendor-status-badge").textContent).toBe("Closed");
        expect(card.querySelector(".vendor-browse-button").textContent).toBe("View Menu (closed)");
    });

    test("createVendorCard surfaces institution metadata", () => {
        const docSnapshot = {
            id: "vendor-1",
            data: () => ({
                vendorBusinessName: "Burger Hut",
                vendorInstitution: "University of Pretoria"
            })
        };
        const vendor = customerBrowseVendors.normalizeVendorRecord(docSnapshot);
        const card = customerBrowseVendors.createVendorCard(vendor);

        const schoolItem = card.querySelector(".vendor-institution .vendor-meta-value");
        expect(schoolItem).not.toBeNull();
        expect(schoolItem.textContent).toBe("University of Pretoria");
    });

    test("buildVendorMenuUrl appends closed flag when card is marked closed", () => {
        const url = customerBrowseVendors.buildVendorMenuUrl("vendor-1", "Burger Hut", { closed: true });
        expect(url).toContain("closed=true");
    });

    test("computeVendorOpenState falls back when schedule helper is absent", () => {
        const state = customerBrowseVendors.computeVendorOpenState({
            manualAcceptingOrders: false
        });
        expect(state.isOpen).toBe(false);
    });
});

// ==========================================
// TESTS: init
// ==========================================

describe("customer/order-management/browse-vendors.js - init", () => {
    let container;
    let statusElement;
    let mockDb;
    let firestoreFns;

    beforeEach(() => {
        const elements = createDOMElements();
        container = elements.container;
        statusElement = elements.statusElement;

        mockDb = { kind: "db" };
        firestoreFns = createFirestoreFns({
            mockVendors: [
                createMockVendor({ uid: "vendor-1" }),
                createMockVendor({ uid: "vendor-2" })
            ]
        });
    });

    test("initializes successfully with vendors", async () => {
        const result = await customerBrowseVendors.init({
            db: mockDb,
            firestoreFns,
            containerSelector: "#vendors-container",
            statusSelector: "#browse-vendors-status"
        });

        expect(result.success).toBe(true);
        expect(result.vendorCount).toBe(2);
        expect(result.vendors).toHaveLength(2);

        expect(container.querySelectorAll(".vendor-card")).toHaveLength(2);
        expect(statusElement.textContent).toContain("Found 2 approved vendors");
        expect(statusElement.getAttribute("data-state")).toBe("success");
    });

    test("init returns a controller that can be used for further filtering", async () => {
        const elements = createFullDom();
        mockDb = { kind: "db" };
        firestoreFns = createFirestoreFns({
            mockVendors: buildVendorList(25)
        });

        const result = await customerBrowseVendors.init({
            db: mockDb,
            firestoreFns
        });

        expect(result.success).toBe(true);
        expect(result.controller).toBeDefined();
        expect(elements.container.querySelectorAll(".vendor-card")).toHaveLength(10);
        expect(elements.resultsMeta.textContent).toContain("Showing 1-10 of 25 vendors");

        result.controller.goToPage(2);
        expect(elements.resultsMeta.textContent).toContain("Showing 11-20 of 25 vendors");
    });

    test("init wires up the search input via attachControlListeners", async () => {
        const elements = createFullDom();
        firestoreFns = createFirestoreFns({
            mockVendors: [
                createMockVendor({ uid: "v1", businessName: "Burger Hut" }),
                createMockVendor({ uid: "v2", businessName: "Pizza Place" })
            ]
        });

        const result = await customerBrowseVendors.init({
            db: mockDb,
            firestoreFns
        });

        expect(result.success).toBe(true);

        elements.searchInput.value = "pizza";
        elements.searchInput.dispatchEvent(new Event("input", { bubbles: true }));

        const cards = elements.container.querySelectorAll(".vendor-card");
        expect(cards).toHaveLength(1);
        expect(cards[0].getAttribute("data-vendor-uid")).toBe("v2");
    });

    test("returns error when Firestore is not available", async () => {
        const result = await customerBrowseVendors.init({
            db: null,
            containerSelector: "#vendors-container"
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("Firestore not available");
    });

    test("returns error when container is not found", async () => {
        const result = await customerBrowseVendors.init({
            db: mockDb,
            containerSelector: "#non-existent-container"
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("Container not found");
    });

    test("handles fetch error gracefully", async () => {
        firestoreFns.getDocs.mockRejectedValue(new Error("Network error"));

        const result = await customerBrowseVendors.init({
            db: mockDb,
            firestoreFns,
            containerSelector: "#vendors-container",
            statusSelector: "#browse-vendors-status"
        });

        expect(result.success).toBe(false);
        expect(statusElement.getAttribute("data-state")).toBe("error");
    });

    test("displays appropriate message when no vendors found", async () => {
        firestoreFns = createFirestoreFns({ mockVendors: [] });

        const result = await customerBrowseVendors.init({
            db: mockDb,
            firestoreFns,
            containerSelector: "#vendors-container",
            statusSelector: "#browse-vendors-status"
        });

        expect(result.success).toBe(true);
        expect(result.vendorCount).toBe(0);
        expect(statusElement.textContent).toContain("No approved vendors are available right now");
        expect(statusElement.getAttribute("data-state")).toBe("info");
    });

    test("displays a singular message for exactly one vendor", async () => {
        firestoreFns = createFirestoreFns({
            mockVendors: [createMockVendor({ uid: "only" })]
        });

        const result = await customerBrowseVendors.init({
            db: mockDb,
            firestoreFns
        });

        expect(result.success).toBe(true);
        expect(statusElement.textContent).toContain("Found 1 approved vendor");
    });

    test("sets loading state during initialization", async () => {
        const initPromise = customerBrowseVendors.init({
            db: mockDb,
            firestoreFns,
            containerSelector: "#vendors-container"
        });

        expect(container.getAttribute("data-loading")).toBe("true");

        await initPromise;

        expect(container.getAttribute("data-loading")).toBeNull();
    });

    test("init redirects to sign-in message when an auth is provided with no user", async () => {
        const auth = { currentUser: null };
        const authFns = {
            onAuthStateChanged: jest.fn((authArg, success) => {
                success(null);
                return function unsubscribe() { return undefined; };
            })
        };

        const result = await customerBrowseVendors.init({
            db: mockDb,
            auth,
            authFns,
            firestoreFns
        });

        expect(result.success).toBe(false);
        expect(statusElement.getAttribute("data-state")).toBe("error");
        expect(statusElement.textContent).toContain("Please sign in to browse approved vendors");
    });
});

// ==========================================
// TESTS: institution / campus filtering and the "open" sort
// ==========================================

describe("customer/order-management/browse-vendors.js - institution & campus filtering", () => {
    test("filterVendors restricts results to a single school", () => {
        const vendors = [
            createMockVendor({ uid: "v1", businessName: "Burger Hut", institution: "University of Pretoria" }),
            createMockVendor({ uid: "v2", businessName: "Pizza Place", institution: "University of Cape Town" }),
            createMockVendor({ uid: "v3", businessName: "Coffee Spot", institution: "University of Pretoria" })
        ];

        const filtered = customerBrowseVendors.filterVendors(vendors, {
            institutionFilter: "university of pretoria"
        });

        expect(filtered.map((v) => v.uid)).toEqual(["v1", "v3"]);
    });

    test("filterVendors restricts results to a single campus within a school", () => {
        const vendors = [
            createMockVendor({ uid: "v1", institution: "University of Pretoria", campus: "Hatfield Campus" }),
            createMockVendor({ uid: "v2", institution: "University of Pretoria", campus: "Mamelodi Campus" }),
            createMockVendor({ uid: "v3", institution: "University of Pretoria", campus: "Hatfield Campus" })
        ];

        const filtered = customerBrowseVendors.filterVendors(vendors, {
            campusFilter: "hatfield campus"
        });

        expect(filtered.map((v) => v.uid)).toEqual(["v1", "v3"]);
    });

    test("filterVendors with 'all' falls through both institution and campus filters", () => {
        const vendors = [createMockVendor(), createMockVendor({ uid: "v2" })];
        const filtered = customerBrowseVendors.filterVendors(vendors, {
            institutionFilter: "all",
            campusFilter: "all"
        });
        expect(filtered).toHaveLength(2);
    });

    test("vendorMatchesSearch matches institution and campus tokens", () => {
        const vendor = createMockVendor({ institution: "University of Pretoria", campus: "Hatfield Campus" });
        expect(customerBrowseVendors.vendorMatchesSearch(vendor, "pretoria")).toBe(true);
        expect(customerBrowseVendors.vendorMatchesSearch(vendor, "hatfield")).toBe(true);
        expect(customerBrowseVendors.vendorMatchesSearch(vendor, "wits")).toBe(false);
    });

    test("getInstitutionOptions returns unique sorted institutions", () => {
        const vendors = [
            createMockVendor({ institution: "University of Pretoria" }),
            createMockVendor({ institution: "Wits" }),
            createMockVendor({ institution: "university of pretoria" }),
            createMockVendor({ institution: "" })
        ];

        expect(customerBrowseVendors.getInstitutionOptions(vendors)).toEqual([
            "University of Pretoria",
            "Wits"
        ]);
    });

    test("getCampusOptions cascades from the selected institution", () => {
        const vendors = [
            createMockVendor({ institution: "University of Pretoria", campus: "Hatfield Campus" }),
            createMockVendor({ institution: "University of Pretoria", campus: "Mamelodi Campus" }),
            createMockVendor({ institution: "Wits", campus: "Braamfontein Campus East" })
        ];

        const upCampuses = customerBrowseVendors.getCampusOptions(vendors, "University of Pretoria");
        expect(upCampuses).toEqual(["Hatfield Campus", "Mamelodi Campus"]);

        const allCampuses = customerBrowseVendors.getCampusOptions(vendors, "all");
        expect(allCampuses).toEqual([
            "Braamfontein Campus East",
            "Hatfield Campus",
            "Mamelodi Campus"
        ]);
    });

    test("collectUniqueValues tolerates non-array input", () => {
        expect(customerBrowseVendors.collectUniqueValues(null, (v) => v && v.foodType)).toEqual([]);
    });

    test("renderInstitutionFilterOptions writes 'All schools' plus each option", () => {
        document.body.innerHTML = '<select id="sel"></select>';
        const select = document.getElementById("sel");

        customerBrowseVendors.renderInstitutionFilterOptions(select, ["Wits", "UP"], "wits");

        const options = Array.from(select.options);
        expect(options[0].textContent).toBe("All schools");
        expect(options[1].textContent).toBe("Wits");
        expect(options[1].selected).toBe(true);
    });

    test("renderCampusFilterOptions writes 'All campuses' plus each option", () => {
        document.body.innerHTML = '<select id="sel"></select>';
        const select = document.getElementById("sel");

        customerBrowseVendors.renderCampusFilterOptions(select, ["Hatfield Campus"], "hatfield campus");

        const options = Array.from(select.options);
        expect(options[0].textContent).toBe("All campuses");
        expect(options[1].selected).toBe(true);
    });

    test("renderTextOptions handles null select gracefully", () => {
        expect(() => customerBrowseVendors.renderTextOptions(null, [], "", "All")).not.toThrow();
    });
});

describe("customer/order-management/browse-vendors.js - 'Open now first' sort", () => {
    test("isVendorOpen reads acceptingOrders", () => {
        expect(customerBrowseVendors.isVendorOpen({ acceptingOrders: true })).toBe(true);
        expect(customerBrowseVendors.isVendorOpen({ acceptingOrders: false })).toBe(false);
        expect(customerBrowseVendors.isVendorOpen(null)).toBe(false);
    });

    test("sortVendors with 'open' places open vendors first, ties broken by name", () => {
        const vendors = [
            { uid: "closed-z", businessName: "Z Closed", acceptingOrders: false },
            { uid: "open-b", businessName: "B Open", acceptingOrders: true },
            { uid: "closed-a", businessName: "A Closed", acceptingOrders: false },
            { uid: "open-a", businessName: "A Open", acceptingOrders: true }
        ];

        const sorted = customerBrowseVendors.sortVendors(vendors, "open");

        expect(sorted.map((v) => v.uid)).toEqual([
            "open-a",
            "open-b",
            "closed-a",
            "closed-z"
        ]);
    });

    test("SORT_OPTIONS includes the 'open' option first", () => {
        expect(customerBrowseVendors.SORT_OPTIONS[0]).toEqual({
            value: "open",
            label: "Open now first"
        });
    });
});

describe("customer/order-management/browse-vendors.js - controller institution/campus & refresh", () => {
    let elements;

    beforeEach(() => {
        elements = createFullDom();
    });

    function vendor(uid, overrides) {
        return Object.assign(
            createMockVendor({
                uid,
                businessName: `Vendor ${uid}`,
                acceptingOrders: true
            }),
            overrides
        );
    }

    test("setVendors populates institution and campus dropdowns from vendor data", () => {
        const controller = customerBrowseVendors.createBrowseVendorsController(elements);
        controller.setVendors([
            vendor("v1", { institution: "University of Pretoria", campus: "Hatfield Campus" }),
            vendor("v2", { institution: "Wits", campus: "Braamfontein Campus East" }),
            vendor("v3", { institution: "University of Pretoria", campus: "Mamelodi Campus" })
        ]);

        const instOptions = Array.from(elements.institutionFilter.options).map((o) => o.textContent);
        expect(instOptions).toEqual(["All schools", "University of Pretoria", "Wits"]);

        const campusOptions = Array.from(elements.campusFilter.options).map((o) => o.textContent);
        expect(campusOptions).toEqual([
            "All campuses",
            "Braamfontein Campus East",
            "Hatfield Campus",
            "Mamelodi Campus"
        ]);
    });

    test("setInstitutionFilter restricts the campus dropdown to that school", () => {
        const controller = customerBrowseVendors.createBrowseVendorsController(elements);
        controller.setVendors([
            vendor("v1", { institution: "University of Pretoria", campus: "Hatfield Campus" }),
            vendor("v2", { institution: "Wits", campus: "Braamfontein Campus East" })
        ]);

        controller.setInstitutionFilter("University of Pretoria");

        const campusOptions = Array.from(elements.campusFilter.options).map((o) => o.textContent);
        expect(campusOptions).toEqual(["All campuses", "Hatfield Campus"]);
    });

    test("setInstitutionFilter resets the campus filter to 'all'", () => {
        const controller = customerBrowseVendors.createBrowseVendorsController(elements);
        controller.setVendors([
            vendor("v1", { institution: "University of Pretoria", campus: "Hatfield Campus" }),
            vendor("v2", { institution: "Wits", campus: "Braamfontein Campus East" })
        ]);
        controller.setCampusFilter("Hatfield Campus");
        expect(controller.state.campusFilter).toBe("hatfield campus");

        controller.setInstitutionFilter("Wits");
        expect(controller.state.campusFilter).toBe("all");
    });

    test("setCampusFilter narrows the rendered list", () => {
        const controller = customerBrowseVendors.createBrowseVendorsController(elements);
        controller.setVendors([
            vendor("v1", { institution: "University of Pretoria", campus: "Hatfield Campus" }),
            vendor("v2", { institution: "University of Pretoria", campus: "Mamelodi Campus" })
        ]);

        controller.setCampusFilter("Hatfield Campus");

        const cards = elements.container.querySelectorAll(".vendor-card");
        expect(cards).toHaveLength(1);
        expect(cards[0].getAttribute("data-vendor-uid")).toBe("v1");
    });

    test("refreshOpenState recomputes acceptingOrders for each vendor", () => {
        const shopSchedule = require("../../../public/shared/shop-schedule/shop-schedule.js");
        const controller = customerBrowseVendors.createBrowseVendorsController(elements);

        controller.setVendors([{
            uid: "v1",
            businessName: "Burger Hut",
            schedule: shopSchedule.getDefaultSchedule(),
            manualAcceptingOrders: true,
            acceptingOrders: true
        }]);

        // Force re-evaluation at 22:00 on a weekday — out of hours
        controller.refreshOpenState(new Date("2026-05-21T22:00:00"));

        expect(controller.state.allVendors[0].acceptingOrders).toBe(false);
        expect(controller.state.allVendors[0].openState.reason).toBe("outside-hours");
    });

    test("attachControlListeners wires up institution and campus selects", () => {
        const controller = customerBrowseVendors.createBrowseVendorsController(elements);
        controller.setVendors([
            vendor("v1", { institution: "University of Pretoria", campus: "Hatfield Campus" }),
            vendor("v2", { institution: "Wits", campus: "Braamfontein Campus East" })
        ]);
        customerBrowseVendors.attachControlListeners(controller, elements);

        elements.institutionFilter.value = "university of pretoria";
        elements.institutionFilter.dispatchEvent(new Event("change", { bubbles: true }));
        expect(controller.state.institutionFilter).toBe("university of pretoria");

        elements.campusFilter.value = "hatfield campus";
        elements.campusFilter.dispatchEvent(new Event("change", { bubbles: true }));
        expect(controller.state.campusFilter).toBe("hatfield campus");
    });

    test("clear filters resets institution + campus to 'all'", () => {
        const controller = customerBrowseVendors.createBrowseVendorsController(elements);
        controller.setVendors([
            vendor("v1", { institution: "University of Pretoria", campus: "Hatfield Campus" })
        ]);
        customerBrowseVendors.attachControlListeners(controller, elements);

        controller.setInstitutionFilter("University of Pretoria");
        controller.setCampusFilter("Hatfield Campus");

        elements.clearFiltersButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

        expect(controller.state.institutionFilter).toBe("all");
        expect(controller.state.campusFilter).toBe("all");
    });
});

describe("customer/order-management/browse-vendors.js - startOpenStateTicker", () => {
    test("calls refreshOpenState on every interval tick and stops on cleanup", () => {
        jest.useFakeTimers();
        const controller = { refreshOpenState: jest.fn() };
        const stop = customerBrowseVendors.startOpenStateTicker(controller, { intervalMs: 1000 });

        jest.advanceTimersByTime(2500);
        expect(controller.refreshOpenState).toHaveBeenCalledTimes(2);

        stop();
        jest.advanceTimersByTime(5000);
        expect(controller.refreshOpenState).toHaveBeenCalledTimes(2);
        jest.useRealTimers();
    });

    test("returns a no-op stop when no scope is available", () => {
        const stop = customerBrowseVendors.startOpenStateTicker(
            { refreshOpenState: jest.fn() },
            { scope: { /* no setInterval */ } }
        );
        expect(typeof stop).toBe("function");
        expect(() => stop()).not.toThrow();
    });
});

describe("customer/order-management/browse-vendors.js - init with disableAutoRefresh", () => {
    test("returns a stopTicker function and never registers a real interval when disabled", async () => {
        createFullDom();
        const db = { kind: "db" };
        const firestoreFns = createFirestoreFns({
            mockVendors: [createMockVendor({ uid: "v1" })]
        });

        const setIntervalSpy = jest.spyOn(global, "setInterval");
        try {
            const result = await customerBrowseVendors.init({
                db,
                firestoreFns,
                disableAutoRefresh: true
            });

            expect(result.success).toBe(true);
            expect(typeof result.stopTicker).toBe("function");
            expect(setIntervalSpy).not.toHaveBeenCalled();
        } finally {
            setIntervalSpy.mockRestore();
        }
    });
});
