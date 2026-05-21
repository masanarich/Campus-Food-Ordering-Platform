const recommendationModel = require("../../../public/shared/recommendations/recommendation-model.js");

function menuItem(overrides = {}) {
    return {
        menuItemId: "item-1",
        vendorUid: "vendor-1",
        vendorName: "Campus Bites",
        name: "Chicken Bowl",
        category: "Meals",
        dietary: ["halal"],
        allergens: [],
        price: 55,
        available: true,
        soldOut: false,
        ...overrides
    };
}

function order(overrides = {}) {
    return {
        orderId: "order-1",
        vendorUid: "vendor-1",
        vendorName: "Campus Bites",
        createdAt: "2026-05-01T10:00:00.000Z",
        updatedAt: "2026-05-01T10:00:00.000Z",
        items: [
            {
                menuItemId: "item-old",
                vendorUid: "vendor-1",
                vendorName: "Campus Bites",
                name: "Chicken Bowl",
                category: "Meals",
                dietary: ["halal"],
                allergens: [],
                price: 50,
                quantity: 2
            }
        ],
        ...overrides
    };
}

describe("shared/recommendations/recommendation-model.js", () => {
    test("normalizes preference profiles safely and keeps recommendation opt-in by default", () => {
        expect(
            recommendationModel.normalizePreferenceProfile({
                dietaryPreferences: " Halal, Vegan, halal ",
                dietaryRestrictions: ["Gluten Free"],
                allergenRestrictions: [" Nuts ", "milk"],
                recommendationOptIn: undefined
            })
        ).toEqual({
            dietaryPreferences: ["halal", "vegan"],
            dietaryRestrictions: ["gluten free"],
            allergenRestrictions: ["nuts", "milk"],
            recommendationOptIn: true
        });
    });

    test("builds a recency-weighted taste profile from order history", () => {
        const profile = recommendationModel.buildTasteProfile([
            order({
                updatedAt: "2026-05-20T10:00:00.000Z",
                items: [
                    {
                        menuItemId: "wrap",
                        name: "Halal Wrap",
                        category: "Wraps",
                        vendorUid: "vendor-2",
                        vendorName: "Wrap House",
                        dietary: ["halal"],
                        price: 60,
                        quantity: 3
                    }
                ]
            }),
            order({
                updatedAt: "2026-03-01T10:00:00.000Z",
                items: [
                    {
                        menuItemId: "salad",
                        name: "Salad",
                        category: "Salads",
                        vendorUid: "vendor-3",
                        dietary: ["vegan"],
                        price: 40,
                        quantity: 1
                    }
                ]
            })
        ], { now: "2026-05-21T10:00:00.000Z" });

        expect(profile.totalQuantity).toBe(4);
        expect(profile.interactionCount).toBe(2);
        expect(profile.categoryWeights.wraps).toBeGreaterThan(profile.categoryWeights.salads);
        expect(profile.dietaryWeights.halal).toBeGreaterThan(profile.dietaryWeights.vegan);
        expect(profile.averageItemPrice).toBeCloseTo(55);
    });

    test("cold-start recommendations use saved dietary preferences", () => {
        const result = recommendationModel.recommendMenuItems(
            [
                menuItem({ menuItemId: "vegan-1", name: "Vegan Curry", dietary: ["vegan"], category: "Meals" }),
                menuItem({ menuItemId: "plain-1", name: "Plain Chips", dietary: [], category: "Sides" })
            ],
            [],
            { dietaryPreferences: ["vegan"] }
        );

        expect(result.status).toBe("cold-start");
        expect(result.recommendations[0].item.name).toBe("Vegan Curry");
        expect(result.recommendations[0].scoreBreakdown.preferenceMatch).toBeGreaterThan(0);
        expect(result.recommendations[0].reasons.join(" ")).toMatch(/Vegan preference/);
    });

    test("returning students get category, vendor, dietary, and price-aware recommendations", () => {
        const result = recommendationModel.recommendMenuItems(
            [
                menuItem({
                    menuItemId: "match",
                    name: "Halal Rice Bowl",
                    category: "Meals",
                    vendorUid: "vendor-1",
                    vendorName: "Campus Bites",
                    dietary: ["halal"],
                    price: 52
                }),
                menuItem({
                    menuItemId: "less-match",
                    name: "Smoothie",
                    category: "Drinks",
                    vendorUid: "vendor-9",
                    vendorName: "Juice Bar",
                    dietary: ["vegetarian"],
                    price: 25
                })
            ],
            [order()],
            { dietaryPreferences: ["halal"] },
            { now: "2026-05-21T10:00:00.000Z" }
        );

        const top = result.recommendations[0];
        expect(result.status).toBe("personalized");
        expect(top.item.menuItemId).toBe("match");
        expect(top.score).toBeGreaterThan(result.recommendations[1].score);
        expect(top.confidence).toBe("medium");
        expect(top.reasons.join(" ")).toMatch(/Meals category/);
        expect(top.reasons.join(" ")).toMatch(/Campus Bites/);
    });

    test("allergen restrictions exclude unsafe items instead of merely lowering their score", () => {
        const result = recommendationModel.recommendMenuItems(
            [
                menuItem({ menuItemId: "unsafe", name: "Nut Brownie", allergens: ["nuts"], dietary: ["vegetarian"] }),
                menuItem({ menuItemId: "safe", name: "Fruit Cup", allergens: [], dietary: ["vegan"] })
            ],
            [order()],
            { allergenRestrictions: ["nuts"] }
        );

        expect(result.recommendations.map(r => r.item.menuItemId)).toEqual(["safe"]);
        expect(result.excluded).toHaveLength(1);
        expect(result.excluded[0].reasons.join(" ")).toMatch(/restricted allergen: Nuts/);
    });

    test("dietary restrictions act as hard requirements", () => {
        const result = recommendationModel.recommendMenuItems(
            [
                menuItem({ menuItemId: "not-vegan", name: "Cheese Toastie", dietary: ["vegetarian"] }),
                menuItem({ menuItemId: "vegan", name: "Vegan Wrap", dietary: ["vegan", "halal"] })
            ],
            [],
            { dietaryRestrictions: ["vegan"] }
        );

        expect(result.recommendations).toHaveLength(1);
        expect(result.recommendations[0].item.menuItemId).toBe("vegan");
        expect(result.recommendations[0].reasons.join(" ")).toMatch(/Vegan restriction/);
        expect(result.excluded[0].reasons.join(" ")).toMatch(/Missing required dietary tag: Vegan/);
    });

    test("recommendation opt-out returns no ranked items", () => {
        const result = recommendationModel.recommendMenuItems(
            [menuItem()],
            [order()],
            { recommendationOptIn: false }
        );

        expect(result.status).toBe("opted-out");
        expect(result.recommendations).toEqual([]);
    });

    test("unavailable and sold-out items are excluded", () => {
        const result = recommendationModel.recommendMenuItems(
            [
                menuItem({ menuItemId: "sold", soldOut: true }),
                menuItem({ menuItemId: "available", name: "Available Meal" })
            ],
            [],
            {}
        );

        expect(result.recommendations.map(r => r.item.menuItemId)).toEqual(["available"]);
        expect(result.excluded[0].reasons).toContain("Item is not currently available.");
    });
});
