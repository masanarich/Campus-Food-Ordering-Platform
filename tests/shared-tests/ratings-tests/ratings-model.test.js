/**
 * @jest-environment node
 */

const ratingsModel = require("../../../public/shared/ratings/ratings-model.js");

describe("ratings-model: clampRating", () => {
    test("returns integer ratings unchanged when in range", () => {
        expect(ratingsModel.clampRating(1)).toBe(1);
        expect(ratingsModel.clampRating(3)).toBe(3);
        expect(ratingsModel.clampRating(5)).toBe(5);
    });

    test("rounds decimals to the nearest integer", () => {
        expect(ratingsModel.clampRating(3.2)).toBe(3);
        expect(ratingsModel.clampRating(3.7)).toBe(4);
        expect(ratingsModel.clampRating("4")).toBe(4);
    });

    test("returns null for out-of-range or non-numeric values", () => {
        expect(ratingsModel.clampRating(0)).toBeNull();
        expect(ratingsModel.clampRating(6)).toBeNull();
        expect(ratingsModel.clampRating(null)).toBeNull();
        expect(ratingsModel.clampRating(undefined)).toBeNull();
        expect(ratingsModel.clampRating("")).toBeNull();
        expect(ratingsModel.clampRating("not-a-number")).toBeNull();
        expect(ratingsModel.clampRating(Number.NaN)).toBeNull();
    });
});

describe("ratings-model: roundAverage", () => {
    test("rounds to one decimal by default", () => {
        expect(ratingsModel.roundAverage(4.1267)).toBe(4.1);
        expect(ratingsModel.roundAverage(4.15)).toBe(4.2);
    });

    test("returns 0 for non-numeric input", () => {
        expect(ratingsModel.roundAverage(null)).toBe(0);
        expect(ratingsModel.roundAverage("hello")).toBe(0);
    });
});

describe("ratings-model: buildReviewId / normalizeReview", () => {
    test("composes review IDs as orderId_customerUid", () => {
        expect(ratingsModel.buildReviewId(" order-1 ", " user-9 ")).toBe("order-1_user-9");
    });

    test("returns empty string when either id is missing", () => {
        expect(ratingsModel.buildReviewId("", "user")).toBe("");
        expect(ratingsModel.buildReviewId("order", "")).toBe("");
    });

    test("normalizeReview replaces missing customer name with 'Anonymous student' when isAnonymous is true", () => {
        const normalized = ratingsModel.normalizeReview({
            customerName: "Real Name",
            isAnonymous: true,
            vendorRating: 4
        });
        expect(normalized.customerDisplayName).toBe("Anonymous student");
    });

    test("normalizeReview uses the customer's name when not anonymous", () => {
        const normalized = ratingsModel.normalizeReview({
            customerName: "Sam Sample",
            isAnonymous: false,
            vendorRating: 5
        });
        expect(normalized.customerDisplayName).toBe("Sam Sample");
    });

    test("normalizeReview clamps invalid vendor ratings to null and trims comments", () => {
        const normalized = ratingsModel.normalizeReview({
            vendorRating: 99,
            vendorComment: "  great food  "
        });
        expect(normalized.vendorRating).toBeNull();
        expect(normalized.vendorComment).toBe("great food");
    });

    test("normalizeReview drops empty item ratings (no rating + no comment)", () => {
        const normalized = ratingsModel.normalizeReview({
            vendorRating: 4,
            itemRatings: [
                { menuItemId: "a", rating: 4 },
                { menuItemId: "b" },  // dropped (no rating, no comment)
                { menuItemId: "c", comment: "great" }
            ]
        });
        expect(normalized.itemRatings).toHaveLength(2);
        expect(normalized.itemRatings.map(function getId(i) { return i.menuItemId; })).toEqual(["a", "c"]);
    });
});

describe("ratings-model: validateReview / buildReviewRecord", () => {
    test("validateReview requires a vendor rating in 1..5", () => {
        const missing = ratingsModel.validateReview({});
        expect(missing.isValid).toBe(false);
        expect(missing.errors.vendorRating).toMatch(/star rating/i);

        const invalid = ratingsModel.validateReview({ vendorRating: 7 });
        expect(invalid.isValid).toBe(false);
    });

    test("validateReview accepts a valid submission and returns normalized payload", () => {
        const result = ratingsModel.validateReview({
            vendorRating: 4,
            vendorComment: "Loved it",
            itemRatings: [{ menuItemId: "a", rating: 3, comment: "fine" }]
        });
        expect(result.isValid).toBe(true);
        expect(result.normalized.vendorRating).toBe(4);
        expect(result.normalized.itemRatings).toHaveLength(1);
    });

    test("validateReview flags overlong vendor comments", () => {
        const longText = "a".repeat(501);
        const result = ratingsModel.validateReview({ vendorRating: 4, vendorComment: longText });
        expect(result.isValid).toBe(false);
        expect(result.errors.vendorComment).toMatch(/too long/i);
    });

    test("validateReview flags an out-of-range item rating", () => {
        const result = ratingsModel.validateReview({
            vendorRating: 4,
            itemRatings: [{ menuItemId: "a", rating: 9 }]
        });
        expect(result.isValid).toBe(false);
        expect(result.errors["itemRatings[0].rating"]).toBe("Item rating must be 1 to 5.");
    });

    test("buildReviewRecord returns ok=false when ids are missing", () => {
        const result = ratingsModel.buildReviewRecord({
            order: {},
            customerUid: "",
            values: { vendorRating: 4 }
        });
        expect(result.ok).toBe(false);
        expect(result.missingIds).toBe(true);
    });

    test("buildReviewRecord assembles a full record with timestamps", () => {
        const result = ratingsModel.buildReviewRecord({
            order: { orderId: "o1", vendorUid: "v1", vendorName: "Burger Hut" },
            customerUid: "c1",
            customerName: "Sam",
            values: { vendorRating: 5, vendorComment: "Amazing", isAnonymous: false },
            now: "2026-05-22T10:00:00Z"
        });
        expect(result.ok).toBe(true);
        expect(result.record).toEqual(expect.objectContaining({
            reviewId: "o1_c1",
            orderId: "o1",
            customerUid: "c1",
            vendorUid: "v1",
            vendorRating: 5,
            vendorComment: "Amazing",
            isAnonymous: false
        }));
    });
});

describe("ratings-model: summarizeReviews", () => {
    test("returns zero summary for empty input", () => {
        expect(ratingsModel.summarizeReviews([])).toEqual({
            count: 0,
            total: 0,
            average: 0,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            withComments: 0
        });
    });

    test("computes average, count and distribution", () => {
        const reviews = [
            { vendorRating: 5, vendorComment: "Yes" },
            { vendorRating: 4 },
            { vendorRating: 3, vendorComment: "ok" },
            { vendorRating: 5 },
            { vendorRating: "not-rated" }   // skipped
        ];
        const summary = ratingsModel.summarizeReviews(reviews);
        expect(summary.count).toBe(4);
        expect(summary.total).toBe(17);
        expect(summary.average).toBe(4.3);
        expect(summary.distribution).toEqual({ 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 });
        expect(summary.withComments).toBe(2);
    });
});

describe("ratings-model: summarizeMenuItemReviews / collectMenuItemReviewComments", () => {
    const reviews = [
        {
            vendorRating: 4,
            customerName: "Alice",
            createdAt: "2026-05-22T10:00:00Z",
            itemRatings: [
                { menuItemId: "burger", rating: 5, comment: "Great!" },
                { menuItemId: "shake", rating: 3 }
            ]
        },
        {
            vendorRating: 4,
            isAnonymous: true,
            customerName: "Bob",
            createdAt: "2026-05-21T10:00:00Z",
            itemRatings: [
                { menuItemId: "burger", rating: 4, comment: "Liked it" }
            ]
        }
    ];

    test("summarizes a specific menu item across reviews", () => {
        const summary = ratingsModel.summarizeMenuItemReviews(reviews, "burger");
        expect(summary.count).toBe(2);
        expect(summary.average).toBe(4.5);
        expect(summary.distribution[4]).toBe(1);
        expect(summary.distribution[5]).toBe(1);
        expect(summary.withComments).toBe(2);
    });

    test("collectMenuItemReviewComments returns newest first by default", () => {
        const comments = ratingsModel.collectMenuItemReviewComments(reviews, "burger");
        expect(comments).toHaveLength(2);
        expect(comments[0].customerDisplayName).toBe("Alice");
        expect(comments[1].customerDisplayName).toBe("Anonymous student");
    });

    test("collectMenuItemReviewComments respects oldest sort and limit", () => {
        const comments = ratingsModel.collectMenuItemReviewComments(reviews, "burger", { sortBy: "oldest", limit: 1 });
        expect(comments).toHaveLength(1);
        expect(comments[0].customerDisplayName).toBe("Anonymous student");
    });

    test("collectMenuItemReviewComments tolerates non-array input", () => {
        expect(ratingsModel.collectMenuItemReviewComments(null, "x")).toEqual([]);
    });
});

describe("ratings-model: indexReviewsByVendor / getRecentReviews", () => {
    test("indexReviewsByVendor groups by vendor uid", () => {
        const map = ratingsModel.indexReviewsByVendor([
            { vendorUid: "v1", vendorRating: 4 },
            { vendorUid: "v2", vendorRating: 5 },
            { vendorUid: "v1", vendorRating: 3 },
            { vendorRating: 2 }   // no vendor uid → skipped
        ]);
        expect(map.get("v1")).toHaveLength(2);
        expect(map.get("v2")).toHaveLength(1);
        expect(map.has("")).toBe(false);
    });

    test("getRecentReviews sorts by createdAt descending and respects limit", () => {
        const recent = ratingsModel.getRecentReviews([
            { reviewId: "old", createdAt: "2026-01-01T00:00:00Z", vendorRating: 3 },
            { reviewId: "new", createdAt: "2026-05-22T00:00:00Z", vendorRating: 5 },
            { reviewId: "mid", createdAt: "2026-03-01T00:00:00Z", vendorRating: 4 }
        ], 2);
        expect(recent.map(function getId(r) { return r.reviewId; })).toEqual(["new", "mid"]);
    });
});

describe("ratings-model: star rendering helpers", () => {
    test("getStarSummaryParts returns an empty display for 0", () => {
        const parts = ratingsModel.getStarSummaryParts(0);
        expect(parts.filled).toBe(0);
        expect(parts.display).toBe("☆☆☆☆☆");
    });

    test("getStarSummaryParts renders half-stars between thresholds", () => {
        const parts = ratingsModel.getStarSummaryParts(3.4);
        expect(parts.filled).toBe(3);
        expect(parts.half).toBe(1);
        expect(parts.empty).toBe(1);
        expect(parts.display).toBe("★★★½☆");
    });

    test("getStarSummaryParts rounds up at .75 and above", () => {
        const parts = ratingsModel.getStarSummaryParts(3.8);
        expect(parts.filled).toBe(4);
        expect(parts.half).toBe(0);
        expect(parts.display).toBe("★★★★☆");
    });

    test("formatRatingDisplay handles no ratings and pluralisation", () => {
        expect(ratingsModel.formatRatingDisplay(0, 0)).toBe("No ratings yet");
        expect(ratingsModel.formatRatingDisplay(4.2, 1)).toBe("4.2 / 5 (1 rating)");
        expect(ratingsModel.formatRatingDisplay(4.2, 7)).toBe("4.2 / 5 (7 ratings)");
    });

    test("getDisplayName reflects the anonymity flag", () => {
        expect(ratingsModel.getDisplayName({ customerName: "Sam", isAnonymous: false }))
            .toBe("Sam");
        expect(ratingsModel.getDisplayName({ customerName: "Sam", isAnonymous: true }))
            .toBe("Anonymous student");
    });
});

describe("ratings-model: isOrderRateable", () => {
    test("returns true only for completed orders", () => {
        expect(ratingsModel.isOrderRateable({ status: "completed" })).toBe(true);
        expect(ratingsModel.isOrderRateable({ status: "Completed" })).toBe(true);
        expect(ratingsModel.isOrderRateable({ status: "ready" })).toBe(false);
        expect(ratingsModel.isOrderRateable({ status: "cancelled" })).toBe(false);
        expect(ratingsModel.isOrderRateable(null)).toBe(false);
    });
});
