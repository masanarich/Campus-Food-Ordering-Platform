const campusRecommendationQueries = require("../../../public/shared/recommendations/campus-recommendation-queries.js");
const recommendationModel = require("../../../public/shared/recommendations/recommendation-model.js");

function createDocSnapshot(id, data, exists = true) {
    return {
        id,
        data: jest.fn(() => data),
        exists: jest.fn(() => exists)
    };
}

function createQuerySnapshot(docs) {
    return {
        docs: docs || []
    };
}

function createFirestoreFns(options = {}) {
    const getDocs = jest.fn(async (queryShape) => {
        if (typeof options.getDocs === "function") {
            return options.getDocs(queryShape);
        }

        return options.getDocsResult || createQuerySnapshot([]);
    });

    return {
        collection: jest.fn((db, ...segments) => ({ kind: "collection", db, segments })),
        where: jest.fn((field, operator, value) => ({ type: "where", field, operator, value })),
        limit: jest.fn((count) => ({ type: "limit", count })),
        query: jest.fn((collectionRef, ...constraints) => ({ collectionRef, constraints })),
        getDocs
    };
}

function createVendorData(overrides = {}) {
    return {
        vendorStatus: "approved",
        accountStatus: "active",
        vendorBusinessName: "Campus Bites",
        vendorFoodType: "Meals",
        vendorInstitution: "Example University",
        vendorCampus: "Main Campus",
        vendorLocation: "Food Court",
        vendorAcceptingOrders: true,
        rating: 4.6,
        totalOrders: 42,
        ...overrides
    };
}

function createMenuItemData(overrides = {}) {
    return {
        name: "Chicken Bowl",
        category: "Meals",
        customerPrice: 55,
        dietaryTags: "Halal, high protein, halal",
        allergenTags: ["Gluten", "dairy", "gluten"],
        available: true,
        ...overrides
    };
}

describe("shared/recommendations/campus-recommendation-queries.js", () => {
    test("exports helpers and resolves the recommendation model", () => {
        expect(campusRecommendationQueries.MODULE_NAME).toBe("campus-recommendation-queries");
        expect(campusRecommendationQueries.resolveRecommendationModel(recommendationModel))
            .toBe(recommendationModel);
        expect(campusRecommendationQueries.resolveRecommendationModel()).toBe(recommendationModel);
        expect(campusRecommendationQueries.normalizeText("  Hello  ")).toBe("Hello");
        expect(campusRecommendationQueries.normalizeLowerText(" HeLLo ")).toBe("hello");
        expect(campusRecommendationQueries.normalizePositiveInteger("5", 20)).toBe(5);
        expect(campusRecommendationQueries.normalizePositiveInteger("bad", 12)).toBe(12);
        expect(campusRecommendationQueries.normalizeBoolean("true", false)).toBe(true);
        expect(campusRecommendationQueries.normalizeTagList(" Halal, vegan, halal ")).toEqual([
            "halal",
            "vegan"
        ]);
    });

    test("builds approved vendor and vendor menu query shapes", () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns();

        expect(
            campusRecommendationQueries.buildApprovedVendorsQuery({
                db,
                firestoreFns,
                vendorLimit: 7
            })
        ).toEqual({
            collectionRef: { kind: "collection", db, segments: ["users"] },
            constraints: [
                { type: "where", field: "vendorStatus", operator: "==", value: "approved" },
                { type: "limit", count: 7 }
            ]
        });

        expect(
            campusRecommendationQueries.buildVendorMenuItemsQuery(" vendor-1 ", {
                db,
                firestoreFns,
                menuItemsPerVendorLimit: 9
            })
        ).toEqual({
            collectionRef: { kind: "collection", db, segments: ["users", "vendor-1", "menuItems"] },
            constraints: [
                { type: "limit", count: 9 }
            ]
        });
    });

    test("normalizes vendors and filters unsafe campus-wide recommendation sources", () => {
        const mapped = campusRecommendationQueries.mapVendorDocuments(
            createQuerySnapshot([
                createDocSnapshot("vendor-1", createVendorData()),
                createDocSnapshot("vendor-2", createVendorData({ vendorStatus: "pending" })),
                createDocSnapshot("vendor-3", createVendorData({ accountStatus: "blocked" })),
                createDocSnapshot("vendor-4", createVendorData({ vendorAcceptingOrders: false }))
            ])
        );

        expect(mapped).toHaveLength(1);
        expect(mapped[0]).toEqual(
            expect.objectContaining({
                uid: "vendor-1",
                vendorUid: "vendor-1",
                businessName: "Campus Bites",
                vendorName: "Campus Bites",
                vendorStatus: "approved",
                accountStatus: "active",
                acceptingOrders: true,
                isApproved: true,
                isActive: true,
                foodType: "Meals",
                institution: "Example University",
                campus: "Main Campus",
                location: "Food Court",
                rating: 4.6,
                totalOrders: 42
            })
        );

        const withClosedVendors = campusRecommendationQueries.mapVendorDocuments(
            createQuerySnapshot([
                createDocSnapshot("vendor-4", createVendorData({ vendorAcceptingOrders: false }))
            ]),
            { includeClosedVendors: true }
        );

        expect(withClosedVendors).toHaveLength(1);
        expect(withClosedVendors[0].acceptingOrders).toBe(false);
    });

    test("normalizes menu items with vendor context, recommendation tags, and menu handoff URL", () => {
        const item = campusRecommendationQueries.normalizeCampusMenuItem(
            createMenuItemData({
                id: "meal-1",
                vendorUid: "",
                vendorName: ""
            }),
            campusRecommendationQueries.normalizeVendorRecord(
                createDocSnapshot("vendor-1", createVendorData())
            ),
            "fallback-id",
            { menuBasePath: "./order-management/browse-menu.html" }
        );

        expect(item).toEqual(
            expect.objectContaining({
                menuItemId: "meal-1",
                id: "meal-1",
                vendorUid: "vendor-1",
                vendorName: "Campus Bites",
                vendorFoodType: "Meals",
                vendorInstitution: "Example University",
                vendorCampus: "Main Campus",
                vendorLocation: "Food Court",
                name: "Chicken Bowl",
                category: "Meals",
                dietary: ["halal", "high protein"],
                allergens: ["gluten", "dairy"],
                price: 55,
                vendorMenuUrl: "order-management/browse-menu.html?vendorUid=vendor-1&vendorName=Campus+Bites&recommendedItemId=meal-1"
            })
        );

        expect(
            campusRecommendationQueries.buildVendorMenuUrl(item, {
                baseHref: "https://example.edu/customer/index.html",
                menuBasePath: "./order-management/browse-menu.html"
            })
        ).toBe(
            "https://example.edu/customer/order-management/browse-menu.html?vendorUid=vendor-1&vendorName=Campus+Bites&recommendedItemId=meal-1"
        );
    });

    test("maps menu documents and drops unavailable or missing items", () => {
        const vendor = campusRecommendationQueries.normalizeVendorRecord(
            createDocSnapshot("vendor-1", createVendorData())
        );
        const items = campusRecommendationQueries.mapMenuItemDocuments(
            createQuerySnapshot([
                createDocSnapshot("meal-1", createMenuItemData()),
                createDocSnapshot("meal-2", createMenuItemData({ available: false })),
                createDocSnapshot("meal-3", createMenuItemData({ status: "archived" })),
                createDocSnapshot("meal-4", {}, false)
            ]),
            vendor
        );

        expect(items).toHaveLength(1);
        expect(items[0]).toEqual(
            expect.objectContaining({
                menuItemId: "meal-1",
                vendorUid: "vendor-1",
                dietary: ["halal", "high protein"],
                allergens: ["gluten", "dairy"]
            })
        );
    });

    test("fetchApprovedVendors fetches and filters approved active vendors", async () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns({
            getDocsResult: createQuerySnapshot([
                createDocSnapshot("vendor-1", createVendorData()),
                createDocSnapshot("vendor-2", createVendorData({ accountStatus: "disabled" }))
            ])
        });

        const result = await campusRecommendationQueries.fetchApprovedVendors({
            db,
            firestoreFns
        });

        expect(result.success).toBe(true);
        expect(result.count).toBe(1);
        expect(result.vendors[0].uid).toBe("vendor-1");
        expect(firestoreFns.getDocs).toHaveBeenCalledTimes(1);
    });

    test("fetchVendorMenuItems handles success, missing vendor, and Firestore failures", async () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns({
            getDocsResult: createQuerySnapshot([
                createDocSnapshot("meal-1", createMenuItemData())
            ])
        });

        const success = await campusRecommendationQueries.fetchVendorMenuItems(
            { uid: "vendor-1", businessName: "Campus Bites", vendorStatus: "approved" },
            {
                db,
                firestoreFns
            }
        );

        expect(success.success).toBe(true);
        expect(success.count).toBe(1);
        expect(success.menuItems[0].vendorUid).toBe("vendor-1");

        const missingVendor = await campusRecommendationQueries.fetchVendorMenuItems(
            {},
            {
                db,
                firestoreFns
            }
        );

        expect(missingVendor.success).toBe(false);
        expect(missingVendor.error.code).toBe("recommendations/missing-vendor");

        const failingFirestoreFns = createFirestoreFns();
        failingFirestoreFns.getDocs.mockRejectedValue(new Error("menu offline"));

        const failed = await campusRecommendationQueries.fetchVendorMenuItems(
            { uid: "vendor-1", businessName: "Campus Bites", vendorStatus: "approved" },
            {
                db,
                firestoreFns: failingFirestoreFns
            }
        );

        expect(failed.success).toBe(false);
        expect(failed.error.code).toBe("recommendations/vendor-menu-fetch-failed");
        expect(failed.error.vendorUid).toBe("vendor-1");
        expect(failed.error.message).toBe("menu offline");
    });

    test("fetchCampusMenuItems combines multiple vendors and keeps partial failures non-fatal", async () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns({
            getDocs: async (queryShape) => {
                const segments = queryShape.collectionRef.segments;

                if (segments.length === 1 && segments[0] === "users") {
                    return createQuerySnapshot([
                        createDocSnapshot("vendor-1", createVendorData({ vendorBusinessName: "Campus Bites" })),
                        createDocSnapshot("vendor-2", createVendorData({ vendorBusinessName: "Fresh Juice" })),
                        createDocSnapshot("vendor-3", createVendorData({ vendorBusinessName: "Offline Cafe" }))
                    ]);
                }

                if (segments[1] === "vendor-1") {
                    return createQuerySnapshot([
                        createDocSnapshot("meal-1", createMenuItemData({ name: "Chicken Bowl" }))
                    ]);
                }

                if (segments[1] === "vendor-2") {
                    return createQuerySnapshot([
                        createDocSnapshot("juice-1", createMenuItemData({
                            name: "Orange Juice",
                            category: "Drinks",
                            customerPrice: 25,
                            dietaryTags: "Vegan",
                            allergenTags: ""
                        }))
                    ]);
                }

                throw new Error("vendor menu unavailable");
            }
        });

        const result = await campusRecommendationQueries.fetchCampusMenuItems({
            db,
            firestoreFns,
            totalMenuItemLimit: 10
        });

        expect(result.success).toBe(true);
        expect(result.vendorCount).toBe(3);
        expect(result.menuItemCount).toBe(2);
        expect(result.partial).toBe(true);
        expect(result.failures).toHaveLength(1);
        expect(result.failures[0]).toEqual(
            expect.objectContaining({
                vendorUid: "vendor-3",
                vendorName: "Offline Cafe",
                error: expect.objectContaining({
                    code: "recommendations/vendor-menu-fetch-failed"
                })
            })
        );
        expect(result.menuItems.map(item => item.vendorUid)).toEqual(["vendor-1", "vendor-2"]);
        expect(result.menuItems[1]).toEqual(
            expect.objectContaining({
                menuItemId: "juice-1",
                vendorName: "Fresh Juice",
                dietary: ["vegan"],
                allergens: []
            })
        );
    });

    test("fetchCampusMenuItems returns dependency and vendor-fetch failures explicitly", async () => {
        const noDb = await campusRecommendationQueries.fetchCampusMenuItems({
            firestoreFns: createFirestoreFns()
        });

        expect(noDb.success).toBe(false);
        expect(noDb.error.code).toBe("recommendations/no-db");

        const firestoreFns = createFirestoreFns();
        firestoreFns.getDocs.mockRejectedValue(new Error("vendors offline"));

        const failed = await campusRecommendationQueries.fetchCampusMenuItems({
            db: { name: "db" },
            firestoreFns
        });

        expect(failed.success).toBe(false);
        expect(failed.menuItems).toEqual([]);
        expect(failed.error.code).toBe("recommendations/vendors-fetch-failed");
        expect(failed.error.message).toBe("vendors offline");
    });
});
