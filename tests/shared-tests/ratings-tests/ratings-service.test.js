/**
 * @jest-environment node
 */

const ratingsService = require("../../../public/shared/ratings/ratings-service.js");
const ratingsModel = require("../../../public/shared/ratings/ratings-model.js");

function buildDeps(overrides = {}) {
    const docs = overrides.docs || [];
    const fns = {
        collection: jest.fn(function collection(db, name) { return { kind: "collection", db, name }; }),
        doc: jest.fn(function doc(db, name, id) { return { kind: "doc", db, name, id }; }),
        getDoc: jest.fn(async function getDoc(ref) {
            const match = docs.find(function find(d) { return d.id === ref.id; });
            if (!match) {
                return { exists: function exists() { return false; }, data: function data() { return null; } };
            }
            return { exists: function exists() { return true; }, data: function data() { return match.data; } };
        }),
        getDocs: jest.fn(async function getDocs() {
            return {
                forEach: function forEach(cb) {
                    docs.forEach(function each(d) {
                        cb({ id: d.id, data: function data() { return d.data; } });
                    });
                }
            };
        }),
        setDoc: jest.fn(async function setDoc() { return true; }),
        query: jest.fn(function query() { return { kind: "query" }; }),
        where: jest.fn(function where(field, op, value) { return { kind: "where", field, op, value }; }),
        serverTimestamp: jest.fn(function serverTimestamp() { return "SERVER_TS"; })
    };

    return {
        db: { app: "test" },
        firestoreFns: Object.assign({}, fns, overrides.firestoreFns || {}),
        ratingsModel,
        ...overrides
    };
}

describe("ratings-service: submitReview", () => {
    test("writes to vendorReviews using the supplied reviewId", async () => {
        const deps = buildDeps();
        const record = {
            reviewId: "order-1_user-1",
            orderId: "order-1",
            customerUid: "user-1",
            vendorUid: "vendor-1",
            vendorRating: 5,
            vendorComment: "Loved it"
        };

        const result = await ratingsService.submitReview(deps, record);

        expect(result.success).toBe(true);
        expect(result.reviewId).toBe("order-1_user-1");
        expect(deps.firestoreFns.setDoc).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "doc", name: "vendorReviews", id: "order-1_user-1" }),
            expect.objectContaining({ orderId: "order-1", customerUid: "user-1", updatedAt: "SERVER_TS" }),
            { merge: true }
        );
    });

    test("throws when reviewId cannot be built", async () => {
        const deps = buildDeps();
        await expect(ratingsService.submitReview(deps, { vendorRating: 4 }))
            .rejects.toThrow("reviewId");
    });

    test("throws when no vendor rating is provided", async () => {
        const deps = buildDeps();
        await expect(ratingsService.submitReview(deps, {
            reviewId: "o1_u1", orderId: "o1", customerUid: "u1"
        })).rejects.toThrow("vendor rating");
    });
});

describe("ratings-service: getReviewByOrder", () => {
    test("returns the document data when the review exists", async () => {
        const deps = buildDeps({
            docs: [{ id: "order-1_user-1", data: { vendorRating: 4, vendorComment: "Good" } }]
        });

        const review = await ratingsService.getReviewByOrder(deps, "order-1", "user-1");
        expect(review.vendorRating).toBe(4);
        expect(review.reviewId).toBe("order-1_user-1");
    });

    test("returns null when no doc exists", async () => {
        const deps = buildDeps();
        const review = await ratingsService.getReviewByOrder(deps, "order-x", "user-x");
        expect(review).toBeNull();
    });

    test("returns null when ids are missing", async () => {
        const deps = buildDeps();
        const review = await ratingsService.getReviewByOrder(deps, "", "");
        expect(review).toBeNull();
    });
});

describe("ratings-service: getReviewsForVendor / getReviewsByVendorIds", () => {
    test("getReviewsForVendor queries by vendor uid and returns mapped data", async () => {
        const deps = buildDeps({
            docs: [
                { id: "r1", data: { vendorUid: "v1", vendorRating: 5 } },
                { id: "r2", data: { vendorUid: "v1", vendorRating: 3 } }
            ]
        });

        const reviews = await ratingsService.getReviewsForVendor(deps, "v1");
        expect(reviews).toHaveLength(2);
        expect(deps.firestoreFns.where).toHaveBeenCalledWith("vendorUid", "==", "v1");
    });

    test("getReviewsForVendor short-circuits when vendor uid is empty", async () => {
        const deps = buildDeps();
        const reviews = await ratingsService.getReviewsForVendor(deps, "");
        expect(reviews).toEqual([]);
        expect(deps.firestoreFns.getDocs).not.toHaveBeenCalled();
    });

    test("getReviewsByVendorIds chunks vendor uids using `in` queries", async () => {
        const docs = [
            { id: "r1", data: { vendorUid: "v1", vendorRating: 4 } },
            { id: "r2", data: { vendorUid: "v2", vendorRating: 5 } }
        ];
        const deps = buildDeps({ docs });

        const reviews = await ratingsService.getReviewsByVendorIds(deps, ["v1", "v2"]);
        expect(reviews.length).toBeGreaterThanOrEqual(2);
        expect(deps.firestoreFns.where).toHaveBeenCalledWith("vendorUid", "in", ["v1", "v2"]);
    });

    test("getReviewsByVendorIds falls back to collection scan when query/where aren't available", async () => {
        const deps = buildDeps({ docs: [{ id: "r1", data: { vendorRating: 4 } }] });
        delete deps.firestoreFns.query;
        delete deps.firestoreFns.where;

        const reviews = await ratingsService.getReviewsByVendorIds(deps, ["v1"]);
        expect(reviews).toHaveLength(1);
    });

    test("getReviewsByVendorIds returns empty array for non-array input", async () => {
        const deps = buildDeps();
        const reviews = await ratingsService.getReviewsByVendorIds(deps, null);
        expect(reviews).toEqual([]);
    });
});

describe("ratings-service: getAllReviews + attachToVendorRecord + snapshotToArray", () => {
    test("getAllReviews returns every review without filtering", async () => {
        const deps = buildDeps({
            docs: [
                { id: "r1", data: { vendorUid: "v1" } },
                { id: "r2", data: { vendorUid: "v2" } }
            ]
        });
        const reviews = await ratingsService.getAllReviews(deps);
        expect(reviews).toHaveLength(2);
    });

    test("attachToVendorRecord merges rating fields onto the vendor record", () => {
        const merged = ratingsService.attachToVendorRecord(
            { uid: "v1", businessName: "Burger Hut" },
            { count: 3, average: 4.3 }
        );
        expect(merged).toEqual({
            uid: "v1",
            businessName: "Burger Hut",
            rating: 4.3,
            ratingCount: 3,
            ratingAverage: 4.3
        });
    });

    test("attachToVendorRecord with zero ratings keeps rating=0 + ratingCount=0", () => {
        const merged = ratingsService.attachToVendorRecord(
            { uid: "v1" },
            { count: 0, average: 0 }
        );
        expect(merged.ratingCount).toBe(0);
        expect(merged.rating).toBe(0);
    });

    test("snapshotToArray handles forEach-style and docs[]-style snapshots", () => {
        const forEachSnap = {
            forEach: function forEach(cb) {
                cb({ id: "a", data: function data() { return { x: 1 }; } });
            }
        };
        const docsSnap = {
            docs: [{ id: "b", data: function data() { return { x: 2 }; } }]
        };

        expect(ratingsService.snapshotToArray(forEachSnap)).toEqual([{ reviewId: "a", x: 1 }]);
        expect(ratingsService.snapshotToArray(docsSnap)).toEqual([{ reviewId: "b", x: 2 }]);
        expect(ratingsService.snapshotToArray(null)).toEqual([]);
    });
});
