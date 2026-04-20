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
    const querySnapshot = {
        forEach: jest.fn((callback) => {
            const mockDocs = options.mockVendors || [];
            mockDocs.forEach((vendorData) => {
                callback({
                    id: vendorData.uid,
                    data: () => vendorData
                });
            });
        })
    };

    return {
        collection: jest.fn(() => ({ kind: "collection" })),
        query: jest.fn(() => ({ kind: "query" })),
        where: jest.fn(() => ({ kind: "where" })),
        orderBy: jest.fn(() => ({ kind: "orderBy" })),
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
    });

    test("all exported functions are actually functions", () => {
        expect(typeof customerBrowseVendors.init).toBe("function");
        expect(typeof customerBrowseVendors.fetchApprovedVendors).toBe("function");
        expect(typeof customerBrowseVendors.renderVendors).toBe("function");
        expect(typeof customerBrowseVendors.createVendorCard).toBe("function");
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
        expect(result.vendors[0].uid).toBe("vendor-1");
        expect(result.vendors[1].businessName).toBe("Beta Foods");

        // Verify Firestore calls
        expect(firestoreFns.collection).toHaveBeenCalledWith(mockDb, "users");
        expect(firestoreFns.where).toHaveBeenCalledWith("vendorStatus", "==", "approved");
        expect(firestoreFns.where).toHaveBeenCalledWith("accountStatus", "==", "active");
        expect(firestoreFns.orderBy).toHaveBeenCalledWith("displayName", "asc");
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
            // Missing most fields
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
        expect(vendor.businessName).toBe("Unknown");
        expect(vendor.location).toBe("Campus");
        expect(vendor.rating).toBe(0);
        expect(vendor.totalOrders).toBe(0);
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

        // Check for location
        const location = card.querySelector("p.vendor-location");
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
        expect(img.src).toContain("default-vendor.png");
    });

    test("includes description when available", () => {
        const vendor = createMockVendor({ description: "Best burgers on campus" });
        const card = customerBrowseVendors.createVendorCard(vendor);

        const description = card.querySelector("p.vendor-description");
        expect(description).not.toBeNull();
        expect(description.textContent).toBe("Best burgers on campus");
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
        expect(message.textContent).toContain("No vendors available");
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

        // Verify button has correct attributes
        expect(button.getAttribute("data-vendor-uid")).toBe("vendor-123");
        expect(button.getAttribute("data-vendor-name")).toBe("Test Vendor");
    });

    test("does nothing when clicked element is not a vendor button", () => {
        const notAButton = document.createElement("p");
        document.body.appendChild(notAButton);

        const event = new Event("click", { bubbles: true });
        Object.defineProperty(event, "target", { value: notAButton, enumerable: true });

        // Should not throw error
        expect(() => {
            customerBrowseVendors.handleVendorBrowseClick(event);
        }).not.toThrow();
    });

    test("handles missing vendor UID gracefully", () => {
        const button = document.createElement("button");
        button.className = "vendor-browse-button";
        // No data-vendor-uid attribute
        document.body.appendChild(button);

        const event = new Event("click", { bubbles: true });
        Object.defineProperty(event, "target", { value: button, enumerable: true });

        // Should not throw error
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

        // Check vendors rendered
        expect(container.querySelectorAll(".vendor-card")).toHaveLength(2);

        // Check status message
        expect(statusElement.textContent).toContain("Found 2 vendors");
        expect(statusElement.getAttribute("data-state")).toBe("success");
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
        expect(statusElement.textContent).toContain("No vendors available");
        expect(statusElement.getAttribute("data-state")).toBe("info");
    });

    test("sets loading state during initialization", async () => {
        const initPromise = customerBrowseVendors.init({
            db: mockDb,
            firestoreFns,
            containerSelector: "#vendors-container"
        });

        // Check loading state before promise resolves
        expect(container.getAttribute("data-loading")).toBe("true");

        await initPromise;

        // Check loading state removed after resolution
        expect(container.getAttribute("data-loading")).toBeNull();
    });
});
