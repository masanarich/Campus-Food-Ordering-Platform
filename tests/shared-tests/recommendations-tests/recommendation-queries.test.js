const recommendationQueries = require("../../../public/shared/recommendations/recommendation-queries.js");
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
    return {
        collection: jest.fn((db, ...segments) => ({ kind: "collection", db, segments })),
        doc: jest.fn((db, ...segments) => ({ kind: "doc", db, segments })),
        where: jest.fn((field, operator, value) => ({ type: "where", field, operator, value })),
        orderBy: jest.fn((field, direction) => ({ type: "orderBy", field, direction })),
        limit: jest.fn((count) => ({ type: "limit", count })),
        query: jest.fn((collectionRef, ...constraints) => ({ collectionRef, constraints })),
        getDoc: jest.fn(async () => options.getDocResult || createDocSnapshot("user-1", {})),
        getDocs: jest.fn(async () => options.getDocsResult || createQuerySnapshot([]))
    };
}

function createOrderData(overrides = {}) {
    return {
        customerUid: "student-1",
        customerName: "Student One",
        customerEmail: "student@example.com",
        vendorUid: "vendor-1",
        vendorName: "Campus Bites",
        status: "completed",
        paymentStatus: "paid",
        createdAt: "2026-05-20T10:00:00.000Z",
        updatedAt: "2026-05-20T11:00:00.000Z",
        total: 110,
        items: [
            {
                menuItemId: "meal-1",
                name: "Chicken Bowl",
                category: "Meals",
                dietary: ["Halal"],
                allergens: ["Gluten"],
                customerPrice: 55,
                quantity: 2
            }
        ],
        ...overrides
    };
}

describe("shared/recommendations/recommendation-queries.js", () => {
    test("exports helpers and resolves the recommendation model", () => {
        expect(recommendationQueries.MODULE_NAME).toBe("recommendation-queries");
        expect(recommendationQueries.resolveRecommendationModel(recommendationModel)).toBe(recommendationModel);
        expect(recommendationQueries.resolveRecommendationModel()).toBe(recommendationModel);
        expect(recommendationQueries.normalizeText("  Hello  ")).toBe("Hello");
        expect(recommendationQueries.normalizeLowerText(" HeLLo ")).toBe("hello");
        expect(recommendationQueries.normalizePositiveInteger("5", 40)).toBe(5);
        expect(recommendationQueries.normalizePositiveInteger("bad", 12)).toBe(12);
        expect(recommendationQueries.normalizeBoolean("true", false)).toBe(true);
        expect(recommendationQueries.normalizeTagList(" Halal, Vegan, halal ")).toEqual(["halal", "vegan"]);
    });

    test("creates Firestore references, constraints, and fallback query objects", () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns();

        expect(recommendationQueries.getUserDocRef(db, " user-1 ", firestoreFns)).toEqual({
            kind: "doc",
            db,
            segments: ["users", "user-1"]
        });
        expect(recommendationQueries.getOrdersCollectionRef(db, firestoreFns)).toEqual({
            kind: "collection",
            db,
            segments: ["orders"]
        });
        expect(recommendationQueries.createFirestoreConstraint("where", ["x", "==", "y"], null)).toEqual({
            type: "where",
            args: ["x", "==", "y"]
        });
        expect(recommendationQueries.createFirestoreQuery({ kind: "collection" }, [null, { type: "limit" }], null))
            .toEqual({
                collectionRef: { kind: "collection" },
                constraints: [{ type: "limit" }]
            });
    });

    test("normalizes profile documents into recommendation preference fields", () => {
        const profile = recommendationQueries.mapProfileDocument(
            createDocSnapshot("student-1", {
                displayName: " Student One ",
                email: " STUDENT@EXAMPLE.COM ",
                dietaryPreferences: ["Halal", "Vegan"],
                dietaryRestrictions: "gluten free",
                allergenRestrictions: "nuts, milk",
                recommendationOptIn: "false"
            }),
            "fallback-uid"
        );

        expect(profile).toMatchObject({
            uid: "student-1",
            displayName: "Student One",
            email: "student@example.com",
            dietaryPreferences: ["halal", "vegan"],
            dietaryRestrictions: ["gluten free"],
            allergenRestrictions: ["nuts", "milk"],
            recommendationOptIn: false
        });
        expect(profile.rawProfile.displayName).toBe(" Student One ");
    });

    test("missing profile docs return safe default recommendation preferences", () => {
        expect(recommendationQueries.mapProfileDocument(null, "student-2")).toMatchObject({
            uid: "student-2",
            dietaryPreferences: [],
            dietaryRestrictions: [],
            allergenRestrictions: [],
            recommendationOptIn: true
        });
    });

    test("normalizes order items while preserving dietary and allergen signals for ML", () => {
        const order = recommendationQueries.normalizeOrderRecord(
            createOrderData({
                items: [
                    {
                        id: "legacy-item",
                        itemName: "Legacy Curry",
                        category: "",
                        dietaryTags: ["Vegan"],
                        allergenTags: ["Peanuts"],
                        price: "42.50",
                        quantity: "3"
                    }
                ]
            }),
            "order-1"
        );

        expect(order).toMatchObject({
            orderId: "order-1",
            customerUid: "student-1",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            itemCount: 3,
            total: 110
        });
        expect(order.items[0]).toMatchObject({
            menuItemId: "legacy-item",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            name: "Legacy Curry",
            category: "Other",
            dietary: ["vegan"],
            allergens: ["peanuts"],
            price: 42.5,
            quantity: 3
        });
    });

    test("maps order document lists and skips missing docs", () => {
        const mapped = recommendationQueries.mapOrderDocuments(
            createQuerySnapshot([
                createDocSnapshot("order-1", createOrderData()),
                createDocSnapshot("order-2", {}, false)
            ])
        );

        expect(mapped).toHaveLength(1);
        expect(mapped[0].orderId).toBe("order-1");
        expect(mapped[0].items[0].dietary).toEqual(["halal"]);
        expect(recommendationQueries.mapOrderDocument(null)).toBeNull();
    });

    test("builds a recent customer orders query using the existing orders index shape", () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns();

        expect(
            recommendationQueries.buildRecentCustomerOrdersQuery({
                db,
                firestoreFns,
                customerUid: "student-1",
                limitCount: 12
            })
        ).toEqual({
            collectionRef: { kind: "collection", db, segments: ["orders"] },
            constraints: [
                { type: "where", field: "customerUid", operator: "==", value: "student-1" },
                { type: "orderBy", field: "createdAt", direction: "desc" },
                { type: "limit", count: 12 }
            ]
        });
    });

    test("fetchRecommendationProfile fetches signed-in student profile", async () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns({
            getDocResult: createDocSnapshot("student-1", {
                dietaryPreferences: ["halal"],
                allergenRestrictions: ["nuts"]
            })
        });

        const result = await recommendationQueries.fetchRecommendationProfile({
            db,
            firestoreFns,
            currentUser: { uid: "student-1" }
        });

        expect(result.success).toBe(true);
        expect(result.profile.dietaryPreferences).toEqual(["halal"]);
        expect(result.profile.allergenRestrictions).toEqual(["nuts"]);
        expect(firestoreFns.doc).toHaveBeenCalledWith(db, "users", "student-1");
        expect(firestoreFns.getDoc).toHaveBeenCalledTimes(1);
    });

    test("fetchRecommendationProfile handles signed-out and Firestore failure states", async () => {
        const db = { name: "db" };
        const signedOut = await recommendationQueries.fetchRecommendationProfile({
            db,
            firestoreFns: createFirestoreFns()
        });

        expect(signedOut.success).toBe(false);
        expect(signedOut.error.code).toBe("recommendations/no-user");

        const firestoreFns = createFirestoreFns();
        firestoreFns.getDoc.mockRejectedValue(new Error("profile offline"));
        const failed = await recommendationQueries.fetchRecommendationProfile({
            db,
            firestoreFns,
            currentUser: { uid: "student-1" }
        });

        expect(failed.success).toBe(false);
        expect(failed.profile.uid).toBe("student-1");
        expect(failed.error.code).toBe("recommendations/profile-fetch-failed");
        expect(failed.error.message).toBe("profile offline");
    });

    test("fetchRecentCustomerOrders fetches and normalizes recent order history", async () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns({
            getDocsResult: createQuerySnapshot([
                createDocSnapshot("order-1", createOrderData())
            ])
        });

        const result = await recommendationQueries.fetchRecentCustomerOrders({
            db,
            firestoreFns,
            currentUser: { uid: "student-1" },
            limitCount: 5
        });

        expect(result.success).toBe(true);
        expect(result.customerUid).toBe("student-1");
        expect(result.count).toBe(1);
        expect(result.orders[0].items[0].allergens).toEqual(["gluten"]);
        expect(firestoreFns.getDocs).toHaveBeenCalledTimes(1);
    });

    test("fetchRecentCustomerOrders handles missing customer and fetch failures", async () => {
        const db = { name: "db" };
        const noCustomer = await recommendationQueries.fetchRecentCustomerOrders({
            db,
            firestoreFns: createFirestoreFns()
        });

        expect(noCustomer.success).toBe(false);
        expect(noCustomer.error.code).toBe("recommendations/no-customer");

        const firestoreFns = createFirestoreFns();
        firestoreFns.getDocs.mockRejectedValue(new Error("orders offline"));
        const failed = await recommendationQueries.fetchRecentCustomerOrders({
            db,
            firestoreFns,
            customerUid: "student-1"
        });

        expect(failed.success).toBe(false);
        expect(failed.orders).toEqual([]);
        expect(failed.error.code).toBe("recommendations/orders-fetch-failed");
        expect(failed.error.message).toBe("orders offline");
    });

    test("loadRecommendationContext combines profile and order history", async () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns({
            getDocResult: createDocSnapshot("student-1", {
                dietaryPreferences: ["vegetarian"]
            }),
            getDocsResult: createQuerySnapshot([
                createDocSnapshot("order-1", createOrderData())
            ])
        });

        const result = await recommendationQueries.loadRecommendationContext({
            db,
            firestoreFns,
            currentUser: { uid: "student-1" }
        });

        expect(result.success).toBe(true);
        expect(result.profile.dietaryPreferences).toEqual(["vegetarian"]);
        expect(result.orders).toHaveLength(1);
        expect(result.orderCount).toBe(1);
    });

    test("dependency checks return explicit errors before querying Firestore", async () => {
        expect(recommendationQueries.assertFirestoreDependencies({ firestoreFns: {} })).toEqual({
            success: false,
            error: {
                code: "recommendations/no-db",
                message: "Firestore database is required for recommendation queries."
            }
        });

        const result = await recommendationQueries.fetchRecentCustomerOrders({
            db: { name: "db" },
            firestoreFns: {}
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("recommendations/no-firestore-fns");
    });
});
