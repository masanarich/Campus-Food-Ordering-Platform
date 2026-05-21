(function attachRecommendationModel(globalScope) {
    "use strict";

    const MODULE_NAME = "recommendation-model";
    const MODEL_VERSION = "hybrid-content-implicit-v1";
    const DEFAULT_MAX_RECOMMENDATIONS = 6;
    const DEFAULT_HISTORY_LIMIT = 40;
    const DEFAULT_HALF_LIFE_DAYS = 21;
    const DAY_MS = 24 * 60 * 60 * 1000;

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
    }

    function normalizeBoolean(value, fallbackValue = false) {
        if (value === true || value === false) {
            return value;
        }

        if (value === "true" || value === "1" || value === 1) {
            return true;
        }

        if (value === "false" || value === "0" || value === 0) {
            return false;
        }

        return fallbackValue;
    }

    function normalizePositiveNumber(value, fallbackValue = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallbackValue;
    }

    function roundScore(value) {
        const parsed = normalizePositiveNumber(value, 0);
        return Math.round((parsed + Number.EPSILON) * 1000) / 1000;
    }

    function normalizeTagList(value) {
        const rawValues = Array.isArray(value)
            ? value
            : normalizeText(value)
                ? normalizeText(value).split(",")
                : [];

        return rawValues
            .map(function normalizeTag(tag) {
                return normalizeLowerText(tag);
            })
            .filter(Boolean)
            .filter(function uniqueTag(tag, index, list) {
                return list.indexOf(tag) === index;
            });
    }

    function formatTag(value) {
        return normalizeText(value)
            .split(/[\s_-]+/)
            .filter(Boolean)
            .map(function capitalize(part) {
                return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
            })
            .join(" ");
    }

    function normalizePreferenceProfile(profile = {}) {
        const safeProfile = profile && typeof profile === "object" ? profile : {};
        return {
            dietaryPreferences: normalizeTagList(
                safeProfile.dietaryPreferences ||
                safeProfile.preferredDietaryTags ||
                safeProfile.dietary
            ),
            dietaryRestrictions: normalizeTagList(
                safeProfile.dietaryRestrictions ||
                safeProfile.requiredDietaryTags ||
                safeProfile.restrictedDietary
            ),
            allergenRestrictions: normalizeTagList(
                safeProfile.allergenRestrictions ||
                safeProfile.allergensToAvoid ||
                safeProfile.restrictedAllergens
            ),
            recommendationOptIn: normalizeBoolean(safeProfile.recommendationOptIn, true)
        };
    }

    function normalizeMenuItem(item = {}) {
        const safeItem = item && typeof item === "object" ? item : {};
        const itemId = normalizeText(
            safeItem.menuItemId ||
            safeItem.itemId ||
            safeItem.productId ||
            safeItem.id
        );
        const availability = normalizeLowerText(safeItem.availability);
        const available = availability
            ? availability !== "unavailable"
            : safeItem.available !== false;

        return {
            ...safeItem,
            menuItemId: itemId,
            id: itemId || normalizeText(safeItem.id),
            vendorUid: normalizeText(safeItem.vendorUid || safeItem.vendorId),
            vendorName: normalizeText(safeItem.vendorName || safeItem.businessName || safeItem.shopName),
            name: normalizeText(safeItem.name || safeItem.itemName || safeItem.title) || "Unknown Item",
            category: normalizeText(safeItem.category) || "Other",
            dietary: normalizeTagList(safeItem.dietary || safeItem.dietaryTags),
            allergens: normalizeTagList(safeItem.allergens || safeItem.allergenTags),
            price: normalizePositiveNumber(
                safeItem.customerPrice !== undefined ? safeItem.customerPrice : safeItem.price,
                0
            ),
            available,
            soldOut: safeItem.soldOut === true
        };
    }

    function resolveTimestampMs(value, fallbackValue) {
        if (value instanceof Date) {
            const time = value.getTime();
            return Number.isFinite(time) ? time : fallbackValue;
        }

        if (value && typeof value.toDate === "function") {
            return resolveTimestampMs(value.toDate(), fallbackValue);
        }

        if (value && typeof value === "object" && Number.isFinite(value.seconds)) {
            return (value.seconds * 1000) + Math.floor(normalizePositiveNumber(value.nanoseconds, 0) / 1000000);
        }

        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }

        const parsed = Date.parse(normalizeText(value));
        return Number.isFinite(parsed) ? parsed : fallbackValue;
    }

    function calculateRecencyWeight(timestampValue, nowMs, halfLifeDays = DEFAULT_HALF_LIFE_DAYS) {
        const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
        const timestampMs = resolveTimestampMs(timestampValue, safeNowMs);
        const ageDays = Math.max(0, (safeNowMs - timestampMs) / DAY_MS);
        const safeHalfLife = Math.max(1, normalizePositiveNumber(halfLifeDays, DEFAULT_HALF_LIFE_DAYS));

        return Math.pow(0.5, ageDays / safeHalfLife);
    }

    function addWeight(weightMap, key, amount) {
        const safeKey = normalizeLowerText(key);

        if (!safeKey) {
            return;
        }

        weightMap[safeKey] = roundScore((weightMap[safeKey] || 0) + amount);
    }

    function getOrderItems(order) {
        const safeOrder = order && typeof order === "object" ? order : {};
        return Array.isArray(safeOrder.items) ? safeOrder.items : [];
    }

    function getOrderTimestamp(order) {
        const safeOrder = order && typeof order === "object" ? order : {};
        return safeOrder.updatedAt || safeOrder.createdAt || safeOrder.paymentPaidAt || safeOrder.paidAt;
    }

    function buildTasteProfile(orders = [], options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const safeOrders = Array.isArray(orders) ? orders.slice(0, safeOptions.historyLimit || DEFAULT_HISTORY_LIMIT) : [];
        const nowMs = resolveTimestampMs(safeOptions.now, Date.now());
        const profile = {
            itemWeights: {},
            categoryWeights: {},
            vendorWeights: {},
            dietaryWeights: {},
            totalQuantity: 0,
            interactionCount: 0,
            averageItemPrice: 0,
            lastInteractionAt: null
        };
        let priceWeightedTotal = 0;
        let quantityForPrice = 0;

        safeOrders.forEach(function learnFromOrder(order) {
            const orderTimestamp = getOrderTimestamp(order);
            const recencyWeight = calculateRecencyWeight(
                orderTimestamp,
                nowMs,
                safeOptions.halfLifeDays || DEFAULT_HALF_LIFE_DAYS
            );
            const timestampMs = resolveTimestampMs(orderTimestamp, null);

            if (timestampMs !== null && (profile.lastInteractionAt === null || timestampMs > profile.lastInteractionAt)) {
                profile.lastInteractionAt = timestampMs;
            }

            getOrderItems(order).forEach(function learnFromItem(rawItem) {
                const item = normalizeMenuItem({
                    ...rawItem,
                    vendorUid: rawItem.vendorUid || order.vendorUid,
                    vendorName: rawItem.vendorName || order.vendorName
                });
                const quantity = Math.max(1, Number.parseInt(rawItem.quantity, 10) || 1);
                const signal = roundScore(quantity * recencyWeight);

                profile.totalQuantity += quantity;
                profile.interactionCount += 1;
                priceWeightedTotal += item.price * quantity;
                quantityForPrice += quantity;

                addWeight(profile.itemWeights, item.menuItemId || item.name, signal * 3);
                addWeight(profile.categoryWeights, item.category, signal * 2);
                addWeight(profile.vendorWeights, item.vendorUid || item.vendorName, signal * 1.5);

                item.dietary.forEach(function learnDietary(tag) {
                    addWeight(profile.dietaryWeights, tag, signal);
                });
            });
        });

        profile.averageItemPrice = quantityForPrice > 0
            ? roundScore(priceWeightedTotal / quantityForPrice)
            : 0;

        return profile;
    }

    function findTagMatches(itemTags, targetTags) {
        const itemSet = new Set(normalizeTagList(itemTags));
        return normalizeTagList(targetTags).filter(function hasTag(tag) {
            return itemSet.has(tag);
        });
    }

    function findMissingRequiredTags(itemTags, requiredTags) {
        const itemSet = new Set(normalizeTagList(itemTags));
        return normalizeTagList(requiredTags).filter(function missing(tag) {
            return !itemSet.has(tag);
        });
    }

    function getExclusionReasons(item, preferenceProfile) {
        const allergenConflicts = findTagMatches(item.allergens, preferenceProfile.allergenRestrictions);
        const missingDietaryRestrictions = findMissingRequiredTags(item.dietary, preferenceProfile.dietaryRestrictions);
        const reasons = [];

        if (!item.available || item.soldOut) {
            reasons.push("Item is not currently available.");
        }

        if (allergenConflicts.length > 0) {
            reasons.push(`Contains restricted allergen: ${allergenConflicts.map(formatTag).join(", ")}.`);
        }

        if (missingDietaryRestrictions.length > 0) {
            reasons.push(`Missing required dietary tag: ${missingDietaryRestrictions.map(formatTag).join(", ")}.`);
        }

        return reasons;
    }

    function getWeight(weightMap, key) {
        return normalizePositiveNumber(weightMap[normalizeLowerText(key)], 0);
    }

    function calculatePriceAffinity(itemPrice, averageItemPrice) {
        if (!averageItemPrice || averageItemPrice <= 0 || !itemPrice || itemPrice <= 0) {
            return 0;
        }

        const ratioDistance = Math.abs(Math.log(itemPrice / averageItemPrice));
        return roundScore(Math.exp(-ratioDistance) * 0.85);
    }

    function getConfidence(score, tasteProfile, preferenceProfile, matchedPreferences, matchedRestrictions) {
        const evidenceUnits =
            tasteProfile.interactionCount +
            matchedPreferences.length +
            matchedRestrictions.length +
            preferenceProfile.allergenRestrictions.length;

        if (score >= 7 && evidenceUnits >= 5) {
            return "high";
        }

        if (score >= 4 && evidenceUnits >= 2) {
            return "medium";
        }

        return "low";
    }

    function buildReasons(context) {
        const reasons = [];
        const item = context.item;

        context.matchedRestrictions.forEach(function addRestrictionReason(tag) {
            reasons.push(`Fits your ${formatTag(tag)} restriction.`);
        });

        context.matchedPreferences.forEach(function addPreferenceReason(tag) {
            reasons.push(`Matches your ${formatTag(tag)} preference.`);
        });

        if (context.itemHistoryWeight > 0) {
            reasons.push(`Similar to ${item.name} items you have ordered before.`);
        }

        if (context.categoryWeight > 0) {
            reasons.push(`You often order from the ${item.category} category.`);
        }

        if (context.vendorWeight > 0 && item.vendorName) {
            reasons.push(`You have ordered from ${item.vendorName} before.`);
        }

        if (context.dietaryHistoryMatches.length > 0) {
            reasons.push(`Your history shows interest in ${context.dietaryHistoryMatches.map(formatTag).join(", ")} meals.`);
        }

        if (context.priceAffinity > 0.55) {
            reasons.push("The price is close to what you usually spend per item.");
        }

        if (reasons.length === 0) {
            reasons.push("Good discovery pick based on available menu information.");
        }

        return reasons.slice(0, 4);
    }

    function scoreMenuItem(rawItem, tasteProfile, preferenceProfile) {
        const item = normalizeMenuItem(rawItem);
        const exclusionReasons = getExclusionReasons(item, preferenceProfile);

        if (exclusionReasons.length > 0) {
            return {
                item,
                excluded: true,
                score: 0,
                confidence: "none",
                reasons: exclusionReasons,
                scoreBreakdown: {}
            };
        }

        const matchedPreferences = findTagMatches(item.dietary, preferenceProfile.dietaryPreferences);
        const matchedRestrictions = findTagMatches(item.dietary, preferenceProfile.dietaryRestrictions);
        const dietaryHistoryMatches = item.dietary.filter(function hasLearnedDietary(tag) {
            return getWeight(tasteProfile.dietaryWeights, tag) > 0;
        });
        const itemHistoryWeight = getWeight(tasteProfile.itemWeights, item.menuItemId || item.name);
        const categoryWeight = getWeight(tasteProfile.categoryWeights, item.category);
        const vendorWeight = getWeight(tasteProfile.vendorWeights, item.vendorUid || item.vendorName);
        const dietaryHistoryWeight = dietaryHistoryMatches.reduce(function sumDietary(total, tag) {
            return total + Math.min(1.6, getWeight(tasteProfile.dietaryWeights, tag) * 0.45);
        }, 0);
        const priceAffinity = calculatePriceAffinity(item.price, tasteProfile.averageItemPrice);

        const scoreBreakdown = {
            base: 1,
            itemHistory: Math.min(5, itemHistoryWeight * 0.9),
            categoryHistory: Math.min(3.5, categoryWeight * 0.7),
            vendorHistory: Math.min(2.5, vendorWeight * 0.6),
            dietaryHistory: Math.min(2.4, dietaryHistoryWeight),
            preferenceMatch: matchedPreferences.length * 1.8,
            restrictionMatch: matchedRestrictions.length * 1.2,
            priceAffinity
        };
        const score = roundScore(Object.keys(scoreBreakdown).reduce(function sumScore(total, key) {
            return total + scoreBreakdown[key];
        }, 0));

        return {
            item,
            excluded: false,
            score,
            confidence: getConfidence(score, tasteProfile, preferenceProfile, matchedPreferences, matchedRestrictions),
            reasons: buildReasons({
                item,
                matchedPreferences,
                matchedRestrictions,
                dietaryHistoryMatches,
                itemHistoryWeight,
                categoryWeight,
                vendorWeight,
                priceAffinity
            }),
            matchedPreferences,
            matchedRestrictions,
            scoreBreakdown
        };
    }

    function recommendMenuItems(menuItems = [], orders = [], profile = {}, options = {}) {
        const preferenceProfile = normalizePreferenceProfile(profile);

        if (!preferenceProfile.recommendationOptIn) {
            return {
                model: MODEL_VERSION,
                recommendations: [],
                excluded: [],
                tasteProfile: buildTasteProfile([], options),
                preferenceProfile,
                status: "opted-out"
            };
        }

        const tasteProfile = buildTasteProfile(orders, options);
        const scored = (Array.isArray(menuItems) ? menuItems : [])
            .map(function scoreOne(item) {
                return scoreMenuItem(item, tasteProfile, preferenceProfile);
            });
        const recommendations = scored
            .filter(function keepAvailable(result) {
                return !result.excluded;
            })
            .sort(function compareRecommendations(a, b) {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }

                return a.item.name.localeCompare(b.item.name);
            })
            .slice(0, options.maxRecommendations || DEFAULT_MAX_RECOMMENDATIONS)
            .map(function attachRank(result, index) {
                return {
                    ...result,
                    rank: index + 1,
                    model: MODEL_VERSION
                };
            });

        return {
            model: MODEL_VERSION,
            recommendations,
            excluded: scored.filter(function keepExcluded(result) {
                return result.excluded;
            }),
            tasteProfile,
            preferenceProfile,
            status: recommendations.length > 0
                ? tasteProfile.interactionCount > 0 ? "personalized" : "cold-start"
                : "empty"
        };
    }

    const recommendationModel = {
        MODULE_NAME,
        MODEL_VERSION,
        DEFAULT_MAX_RECOMMENDATIONS,
        DEFAULT_HISTORY_LIMIT,
        DEFAULT_HALF_LIFE_DAYS,
        normalizeText,
        normalizeLowerText,
        normalizeBoolean,
        normalizePositiveNumber,
        roundScore,
        normalizeTagList,
        formatTag,
        normalizePreferenceProfile,
        normalizeMenuItem,
        resolveTimestampMs,
        calculateRecencyWeight,
        buildTasteProfile,
        findTagMatches,
        findMissingRequiredTags,
        getExclusionReasons,
        calculatePriceAffinity,
        scoreMenuItem,
        recommendMenuItems
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = recommendationModel;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.recommendationModel = recommendationModel;
    }
})(typeof window !== "undefined" ? window : globalThis);
