(function attachRatingsModel(globalScope) {
    "use strict";

    const MODULE_NAME = "ratings-model";
    const MIN_RATING = 1;
    const MAX_RATING = 5;
    const MAX_COMMENT_LENGTH = 500;
    const MAX_ITEM_COMMENT_LENGTH = 300;

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
    }

    function clampRating(value) {
        // Accepts 1..5 integers (or numeric strings). Returns null when missing
        // or out of range so callers can decide whether to count it.
        if (value === null || value === undefined || value === "") {
            return null;
        }
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return null;
        }
        const rounded = Math.round(parsed);
        if (rounded < MIN_RATING || rounded > MAX_RATING) {
            return null;
        }
        return rounded;
    }

    function roundAverage(value, decimals = 1) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return 0;
        }
        const factor = Math.pow(10, decimals);
        return Math.round(parsed * factor) / factor;
    }

    function normalizeItemRating(rawItem) {
        const safe = rawItem && typeof rawItem === "object" ? rawItem : {};
        const rating = clampRating(safe.rating);
        const comment = normalizeText(safe.comment).slice(0, MAX_ITEM_COMMENT_LENGTH);

        return {
            menuItemId: normalizeText(safe.menuItemId || safe.id || safe.productId),
            name: normalizeText(safe.name || safe.itemName || safe.title),
            rating,
            comment
        };
    }

    function normalizeItemRatings(items) {
        if (!Array.isArray(items)) {
            return [];
        }
        return items
            .map(normalizeItemRating)
            .filter(function keepRated(item) {
                // Drop entries with no rating AND no comment so we don't store
                // empty rows for items the customer skipped over.
                return item.rating !== null || item.comment.length > 0;
            });
    }

    function normalizeReview(record) {
        const safe = record && typeof record === "object" ? record : {};
        const vendorRating = clampRating(safe.vendorRating);
        const isAnonymous = safe.isAnonymous === true;
        const customerName = normalizeText(safe.customerName);

        return {
            reviewId: normalizeText(safe.reviewId || safe.id),
            orderId: normalizeText(safe.orderId),
            customerUid: normalizeText(safe.customerUid),
            customerName: customerName,
            customerDisplayName: isAnonymous || !customerName ? "Anonymous student" : customerName,
            vendorUid: normalizeText(safe.vendorUid),
            vendorName: normalizeText(safe.vendorName),
            vendorRating: vendorRating,
            vendorComment: normalizeText(safe.vendorComment).slice(0, MAX_COMMENT_LENGTH),
            itemRatings: normalizeItemRatings(safe.itemRatings),
            isAnonymous: isAnonymous,
            createdAt: safe.createdAt || null,
            updatedAt: safe.updatedAt || null
        };
    }

    function buildReviewId(orderId, customerUid) {
        const safeOrder = normalizeText(orderId);
        const safeCustomer = normalizeText(customerUid);
        if (!safeOrder || !safeCustomer) {
            return "";
        }
        // Composite key so a customer can only have ONE review per order.
        return `${safeOrder}_${safeCustomer}`;
    }

    function validateReview(values) {
        const safe = values && typeof values === "object" ? values : {};
        const errors = {};
        const vendorRating = clampRating(safe.vendorRating);

        if (vendorRating === null) {
            errors.vendorRating = "Please give the shop a star rating from 1 to 5.";
        }

        if (
            safe.vendorComment !== undefined &&
            safe.vendorComment !== null &&
            String(safe.vendorComment).length > MAX_COMMENT_LENGTH
        ) {
            errors.vendorComment = `Comment is too long (max ${MAX_COMMENT_LENGTH} characters).`;
        }

        if (Array.isArray(safe.itemRatings)) {
            safe.itemRatings.forEach(function inspectItem(item, index) {
                if (!item || typeof item !== "object") {
                    return;
                }
                const rating = clampRating(item.rating);
                if (item.rating !== null && item.rating !== undefined && item.rating !== "" && rating === null) {
                    errors[`itemRatings[${index}].rating`] = "Item rating must be 1 to 5.";
                }
                if (typeof item.comment === "string" && item.comment.length > MAX_ITEM_COMMENT_LENGTH) {
                    errors[`itemRatings[${index}].comment`] = `Item comment too long (max ${MAX_ITEM_COMMENT_LENGTH} characters).`;
                }
            });
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors,
            normalized: {
                vendorRating,
                vendorComment: normalizeText(safe.vendorComment).slice(0, MAX_COMMENT_LENGTH),
                itemRatings: normalizeItemRatings(safe.itemRatings),
                isAnonymous: safe.isAnonymous === true
            }
        };
    }

    function buildReviewRecord(context = {}) {
        // `context` is what the caller already has on hand:
        //   { order, customerUid, customerName, values, now }
        const order = context.order && typeof context.order === "object" ? context.order : {};
        const values = context.values && typeof context.values === "object" ? context.values : {};
        const validation = validateReview(values);
        const customerUid = normalizeText(context.customerUid);
        const orderId = normalizeText(order.orderId || order.id);
        const reviewId = buildReviewId(orderId, customerUid);
        const now = context.now || new Date().toISOString();

        if (!validation.isValid || !reviewId) {
            return {
                ok: false,
                errors: validation.errors,
                missingIds: !reviewId,
                reviewId,
                normalized: validation.normalized
            };
        }

        const record = {
            reviewId,
            orderId,
            customerUid,
            customerName: normalizeText(context.customerName),
            vendorUid: normalizeText(order.vendorUid),
            vendorName: normalizeText(order.vendorName),
            vendorRating: validation.normalized.vendorRating,
            vendorComment: validation.normalized.vendorComment,
            itemRatings: validation.normalized.itemRatings,
            isAnonymous: validation.normalized.isAnonymous,
            createdAt: now,
            updatedAt: now
        };

        return {
            ok: true,
            errors: {},
            reviewId,
            record
        };
    }

    function summarizeReviews(reviews) {
        const safe = Array.isArray(reviews) ? reviews : [];
        let total = 0;
        let count = 0;
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let withComments = 0;

        safe.forEach(function inspect(reviewRecord) {
            const normalized = normalizeReview(reviewRecord);
            const rating = normalized.vendorRating;
            if (rating === null) {
                return;
            }
            total += rating;
            count += 1;
            distribution[rating] = (distribution[rating] || 0) + 1;
            if (normalized.vendorComment.length > 0) {
                withComments += 1;
            }
        });

        const average = count > 0 ? roundAverage(total / count, 1) : 0;
        return {
            count,
            total,
            average,
            distribution,
            withComments
        };
    }

    function summarizeMenuItemReviews(reviews, menuItemId) {
        const safe = Array.isArray(reviews) ? reviews : [];
        const needle = normalizeText(menuItemId);
        let total = 0;
        let count = 0;
        let withComments = 0;
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        safe.forEach(function inspect(reviewRecord) {
            const normalized = normalizeReview(reviewRecord);
            normalized.itemRatings.forEach(function inspectItem(item) {
                if (needle && normalizeText(item.menuItemId) !== needle) {
                    return;
                }
                if (item.rating === null) {
                    return;
                }
                total += item.rating;
                count += 1;
                distribution[item.rating] = (distribution[item.rating] || 0) + 1;
                if (item.comment && item.comment.length > 0) {
                    withComments += 1;
                }
            });
        });

        const average = count > 0 ? roundAverage(total / count, 1) : 0;
        return { count, total, average, distribution, withComments };
    }

    function collectMenuItemReviewComments(reviews, menuItemId, options = {}) {
        // Returns the comments left specifically about a menu item, oldest →
        // newest unless a `sortBy: "newest"` flag is passed.
        const safe = Array.isArray(reviews) ? reviews : [];
        const needle = normalizeText(menuItemId);
        const limit = Number.isFinite(options.limit) ? options.limit : 50;

        const comments = [];
        safe.forEach(function inspect(reviewRecord) {
            const normalized = normalizeReview(reviewRecord);
            normalized.itemRatings.forEach(function inspectItem(item) {
                if (needle && normalizeText(item.menuItemId) !== needle) {
                    return;
                }
                if (item.rating === null && !item.comment) {
                    return;
                }
                comments.push({
                    rating: item.rating,
                    comment: item.comment,
                    customerDisplayName: normalized.customerDisplayName,
                    createdAt: normalized.createdAt
                });
            });
        });

        const sorted = comments.slice().sort(function compareCreatedAt(a, b) {
            const aTime = Date.parse(a.createdAt) || 0;
            const bTime = Date.parse(b.createdAt) || 0;
            return options.sortBy === "oldest" ? aTime - bTime : bTime - aTime;
        });

        return sorted.slice(0, Math.max(0, limit));
    }

    function getStarSummaryParts(rating, maxStars = MAX_RATING) {
        const safe = Number(rating);
        if (!Number.isFinite(safe) || safe <= 0) {
            return {
                filled: 0,
                half: 0,
                empty: maxStars,
                display: "☆☆☆☆☆"
            };
        }
        const filled = Math.floor(safe);
        const remainder = safe - filled;
        const half = remainder >= 0.25 && remainder < 0.75 ? 1 : 0;
        const fullCount = remainder >= 0.75 ? filled + 1 : filled;
        const empty = Math.max(0, maxStars - fullCount - half);

        // Use simple ★/½/☆ chars for cheap inline rendering — good fallback
        // when CSS doesn't load.
        const display =
            "★".repeat(Math.min(maxStars, fullCount)) +
            (half ? "½" : "") +
            "☆".repeat(Math.max(0, empty));

        return {
            filled: fullCount,
            half,
            empty,
            display
        };
    }

    function formatRatingDisplay(average, count) {
        const safeAverage = Number(average);
        const safeCount = Number(count);

        if (!Number.isFinite(safeCount) || safeCount <= 0) {
            return "No ratings yet";
        }

        const averageText = Number.isFinite(safeAverage) ? roundAverage(safeAverage, 1).toFixed(1) : "0.0";
        const noun = safeCount === 1 ? "rating" : "ratings";
        return `${averageText} / 5 (${safeCount} ${noun})`;
    }

    function getDisplayName(review) {
        const normalized = normalizeReview(review);
        return normalized.customerDisplayName;
    }

    function indexReviewsByVendor(reviews) {
        const safe = Array.isArray(reviews) ? reviews : [];
        const map = new Map();

        safe.forEach(function add(reviewRecord) {
            const normalized = normalizeReview(reviewRecord);
            if (!normalized.vendorUid) {
                return;
            }
            if (!map.has(normalized.vendorUid)) {
                map.set(normalized.vendorUid, []);
            }
            map.get(normalized.vendorUid).push(normalized);
        });

        return map;
    }

    function getRecentReviews(reviews, limit = 10) {
        const safe = Array.isArray(reviews) ? reviews : [];
        return safe
            .map(normalizeReview)
            .sort(function compare(a, b) {
                return (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);
            })
            .slice(0, Math.max(0, limit));
    }

    function isOrderRateable(order) {
        const safe = order && typeof order === "object" ? order : {};
        const status = normalizeLowerText(safe.status);
        return status === "completed";
    }

    const ratingsModel = {
        MODULE_NAME,
        MIN_RATING,
        MAX_RATING,
        MAX_COMMENT_LENGTH,
        MAX_ITEM_COMMENT_LENGTH,
        normalizeText,
        normalizeLowerText,
        clampRating,
        roundAverage,
        normalizeItemRating,
        normalizeItemRatings,
        normalizeReview,
        buildReviewId,
        validateReview,
        buildReviewRecord,
        summarizeReviews,
        summarizeMenuItemReviews,
        collectMenuItemReviewComments,
        getStarSummaryParts,
        formatRatingDisplay,
        getDisplayName,
        indexReviewsByVendor,
        getRecentReviews,
        isOrderRateable
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = ratingsModel;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.ratingsModel = ratingsModel;
    }
})(typeof window !== "undefined" ? window : globalThis);
