(function attachRatingsService(globalScope) {
    "use strict";

    const MODULE_NAME = "ratings-service";
    const REVIEWS_COLLECTION = "vendorReviews";

    function resolveRatingsModel(explicit) {
        if (explicit && typeof explicit.normalizeReview === "function") {
            return explicit;
        }
        if (typeof globalScope !== "undefined" && globalScope.ratingsModel) {
            return globalScope.ratingsModel;
        }
        if (typeof require === "function") {
            try {
                return require("./ratings-model.js");
            } catch (error) {
                return null;
            }
        }
        return null;
    }

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function ensureFn(host, name) {
        const fn = host && host[name];
        if (typeof fn !== "function") {
            throw new Error(`Missing Firestore function: ${name}`);
        }
        return fn;
    }

    function getReviewsCollection(deps) {
        const collection = ensureFn(deps.firestoreFns, "collection");
        return collection(deps.db, REVIEWS_COLLECTION);
    }

    function getReviewDocRef(deps, reviewId) {
        const doc = ensureFn(deps.firestoreFns, "doc");
        return doc(deps.db, REVIEWS_COLLECTION, normalizeText(reviewId));
    }

    function snapshotToArray(snapshot) {
        const items = [];
        if (!snapshot) {
            return items;
        }
        if (typeof snapshot.forEach === "function") {
            snapshot.forEach(function append(docSnap) {
                const data = typeof docSnap.data === "function" ? docSnap.data() : {};
                items.push(Object.assign({ reviewId: docSnap.id }, data));
            });
            return items;
        }
        if (Array.isArray(snapshot.docs)) {
            snapshot.docs.forEach(function append(docSnap) {
                const data = typeof docSnap.data === "function" ? docSnap.data() : {};
                items.push(Object.assign({ reviewId: docSnap.id }, data));
            });
        }
        return items;
    }

    async function submitReview(deps, reviewRecord) {
        const ratingsModel = resolveRatingsModel(deps && deps.ratingsModel);
        if (!ratingsModel) {
            throw new Error("ratings-model is required to submit a review.");
        }

        const normalized = ratingsModel.normalizeReview(reviewRecord);
        if (!normalized.reviewId) {
            throw new Error("Review is missing its reviewId.");
        }
        if (normalized.vendorRating === null) {
            throw new Error("Review must include a vendor rating.");
        }

        const setDoc = ensureFn(deps.firestoreFns, "setDoc");
        const docRef = getReviewDocRef(deps, normalized.reviewId);

        // We store the *raw* record so existing fields like createdAt can be
        // preserved across edits via merge.
        const payload = Object.assign({}, reviewRecord, {
            reviewId: normalized.reviewId,
            updatedAt:
                typeof deps.firestoreFns.serverTimestamp === "function"
                    ? deps.firestoreFns.serverTimestamp()
                    : (reviewRecord && reviewRecord.updatedAt) || new Date().toISOString()
        });

        await setDoc(docRef, payload, { merge: true });
        return { success: true, reviewId: normalized.reviewId };
    }

    async function getReviewByOrder(deps, orderId, customerUid) {
        const ratingsModel = resolveRatingsModel(deps && deps.ratingsModel);
        const reviewId = ratingsModel
            ? ratingsModel.buildReviewId(orderId, customerUid)
            : `${normalizeText(orderId)}_${normalizeText(customerUid)}`;

        if (!reviewId) {
            return null;
        }

        const getDoc = ensureFn(deps.firestoreFns, "getDoc");
        const docRef = getReviewDocRef(deps, reviewId);
        const snapshot = await getDoc(docRef);

        if (!snapshot || typeof snapshot.exists !== "function" || !snapshot.exists()) {
            return null;
        }

        const data = typeof snapshot.data === "function" ? snapshot.data() : {};
        return Object.assign({ reviewId }, data);
    }

    async function getReviewsForVendor(deps, vendorUid) {
        const collectionRef = getReviewsCollection(deps);
        const where = deps.firestoreFns.where;
        const query = deps.firestoreFns.query;
        const getDocs = ensureFn(deps.firestoreFns, "getDocs");

        const safeUid = normalizeText(vendorUid);
        if (!safeUid) {
            return [];
        }

        const ref = typeof query === "function" && typeof where === "function"
            ? query(collectionRef, where("vendorUid", "==", safeUid))
            : collectionRef;

        const snapshot = await getDocs(ref);
        return snapshotToArray(snapshot);
    }

    async function getReviewsByVendorIds(deps, vendorUids) {
        // Firestore `in` queries support up to 30 values per request, so we
        // chunk to stay safely within limits. For a school-size dataset this
        // covers every approved vendor in one or two round trips.
        const safeUids = Array.isArray(vendorUids)
            ? vendorUids.map(normalizeText).filter(Boolean)
            : [];

        if (safeUids.length === 0) {
            return [];
        }

        const where = deps.firestoreFns.where;
        const query = deps.firestoreFns.query;
        const getDocs = ensureFn(deps.firestoreFns, "getDocs");
        const collectionRef = getReviewsCollection(deps);

        if (typeof query !== "function" || typeof where !== "function") {
            // Fall back to a plain scan when the helpers aren't provided.
            const snapshot = await getDocs(collectionRef);
            return snapshotToArray(snapshot);
        }

        const CHUNK_SIZE = 25;
        const results = [];

        for (let start = 0; start < safeUids.length; start += CHUNK_SIZE) {
            const chunk = safeUids.slice(start, start + CHUNK_SIZE);
            const ref = query(collectionRef, where("vendorUid", "in", chunk));
            // Lint-friendly sequential await — order doesn't matter, but we
            // need to capture exceptions chunk-by-chunk if Firestore complains
            // about a particular request.
            // eslint-disable-next-line no-await-in-loop
            const snapshot = await getDocs(ref);
            snapshotToArray(snapshot).forEach(function push(item) {
                results.push(item);
            });
        }

        return results;
    }

    async function getAllReviews(deps) {
        const getDocs = ensureFn(deps.firestoreFns, "getDocs");
        const collectionRef = getReviewsCollection(deps);
        const snapshot = await getDocs(collectionRef);
        return snapshotToArray(snapshot);
    }

    function attachToVendorRecord(vendor, summary) {
        if (!vendor || typeof vendor !== "object") {
            return vendor;
        }
        const safeSummary = summary || { count: 0, average: 0 };
        return Object.assign({}, vendor, {
            rating: safeSummary.count > 0 ? safeSummary.average : 0,
            ratingCount: safeSummary.count,
            ratingAverage: safeSummary.average
        });
    }

    const ratingsService = {
        MODULE_NAME,
        REVIEWS_COLLECTION,
        submitReview,
        getReviewByOrder,
        getReviewsForVendor,
        getReviewsByVendorIds,
        getAllReviews,
        attachToVendorRecord,
        snapshotToArray
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = ratingsService;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.ratingsService = ratingsService;
    }
})(typeof window !== "undefined" ? window : globalThis);
