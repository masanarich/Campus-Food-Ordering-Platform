(function attachPlatformPricing(globalScope) {
    "use strict";

    const MODULE_NAME = "platform-pricing";
    const DEFAULT_CURRENCY = "ZAR";
    const DEFAULT_PLATFORM_FEE_RATE = 0.1;
    const MAX_PLATFORM_FEE_RATE = 1;
    const WITHDRAWAL_STATUSES_THAT_RESERVE_BALANCE = Object.freeze([
        "pending",
        "approved",
        "paid"
    ]);

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
    }

    function normalizeCurrencyAmount(value, fallbackValue) {
        const parsed = Number.parseFloat(value);
        const fallbackParsed = Number.parseFloat(fallbackValue);

        if (Number.isFinite(parsed)) {
            return Math.max(0, Math.round((parsed + Number.EPSILON) * 100) / 100);
        }

        if (Number.isFinite(fallbackParsed)) {
            return Math.max(0, Math.round((fallbackParsed + Number.EPSILON) * 100) / 100);
        }

        return 0;
    }

    function normalizePositiveInteger(value, fallbackValue) {
        const parsed = Number.parseInt(value, 10);
        const fallbackParsed = Number.parseInt(fallbackValue, 10);

        if (Number.isFinite(parsed) && parsed > 0) {
            return Math.floor(parsed);
        }

        if (Number.isFinite(fallbackParsed) && fallbackParsed > 0) {
            return Math.floor(fallbackParsed);
        }

        return 1;
    }

    function parseRateCandidate(value) {
        const textValue = normalizeText(value);
        const isPercentText = textValue.endsWith("%");
        const parsed = Number.parseFloat(isPercentText ? textValue.slice(0, -1) : value);

        if (!Number.isFinite(parsed) || parsed < 0) {
            return null;
        }

        const decimalRate = isPercentText || parsed > 1
            ? parsed / 100
            : parsed;

        return Math.min(MAX_PLATFORM_FEE_RATE, decimalRate);
    }

    function normalizePlatformFeeRate(value, fallbackValue) {
        const parsed = parseRateCandidate(value);

        if (parsed !== null) {
            return Number(parsed.toFixed(4));
        }

        const fallbackParsed = parseRateCandidate(fallbackValue);

        if (fallbackParsed !== null) {
            return Number(fallbackParsed.toFixed(4));
        }

        return DEFAULT_PLATFORM_FEE_RATE;
    }

    function resolvePlatformFeeRate(options) {
        const safeOptions = options && typeof options === "object" ? options : {};

        return normalizePlatformFeeRate(
            safeOptions.platformFeeRate !== undefined
                ? safeOptions.platformFeeRate
                : safeOptions.feeRate,
            DEFAULT_PLATFORM_FEE_RATE
        );
    }

    function amountToMinorUnits(amount) {
        return Math.round(normalizeCurrencyAmount(amount) * 100);
    }

    function getCurrencyDisplay(currency) {
        const safeCurrency = normalizeText(currency) || DEFAULT_CURRENCY;

        if (safeCurrency.toUpperCase() === "ZAR") {
            return "R";
        }

        return safeCurrency.toUpperCase();
    }

    function formatCurrency(amount, currency) {
        const currencyDisplay = getCurrencyDisplay(currency);
        const formattedAmount = normalizeCurrencyAmount(amount).toFixed(2);

        return `${currencyDisplay} ${formattedAmount}`;
    }

    function calculatePlatformFee(vendorAmount, options) {
        const rate = typeof options === "number" || typeof options === "string"
            ? normalizePlatformFeeRate(options)
            : resolvePlatformFeeRate(options);

        return normalizeCurrencyAmount(normalizeCurrencyAmount(vendorAmount) * rate);
    }

    function calculateCustomerPrice(vendorPrice, options) {
        const basePrice = normalizeCurrencyAmount(vendorPrice);

        return normalizeCurrencyAmount(basePrice + calculatePlatformFee(basePrice, options));
    }

    function normalizePricedItem(item, fallbackIndex) {
        const safeItem = item && typeof item === "object" ? item : {};
        const itemId = normalizeText(
            safeItem.menuItemId ||
            safeItem.productId ||
            safeItem.itemId ||
            safeItem.id
        ) || `item-${fallbackIndex + 1}`;
        const vendorPrice = normalizeCurrencyAmount(
            safeItem.vendorPrice !== undefined
                ? safeItem.vendorPrice
                : safeItem.basePrice !== undefined
                    ? safeItem.basePrice
                    : safeItem.price
        );
        const quantity = normalizePositiveInteger(safeItem.quantity, safeItem.qty);

        return {
            ...safeItem,
            menuItemId: itemId,
            id: normalizeText(safeItem.id || itemId),
            vendorUid: normalizeText(safeItem.vendorUid),
            vendorName: normalizeText(safeItem.vendorName),
            name: normalizeText(safeItem.name || safeItem.itemName) || "Unknown Item",
            category: normalizeText(safeItem.category) || "Other",
            vendorPrice,
            price: vendorPrice,
            quantity
        };
    }

    function calculateLinePricing(item, options) {
        const normalizedItem = normalizePricedItem(item, 0);
        const platformFeeRate = resolvePlatformFeeRate(options);
        const vendorSubtotal = normalizeCurrencyAmount(normalizedItem.vendorPrice * normalizedItem.quantity);
        const platformFee = calculatePlatformFee(vendorSubtotal, { platformFeeRate });
        const customerTotal = normalizeCurrencyAmount(vendorSubtotal + platformFee);
        const unitPlatformFee = calculatePlatformFee(normalizedItem.vendorPrice, { platformFeeRate });
        const customerUnitPrice = normalizeCurrencyAmount(normalizedItem.vendorPrice + unitPlatformFee);

        return {
            ...normalizedItem,
            platformFeeRate,
            vendorSubtotal,
            lineVendorSubtotal: vendorSubtotal,
            platformFee,
            linePlatformFee: platformFee,
            customerUnitPrice,
            customerPrice: customerUnitPrice,
            customerTotal,
            lineCustomerTotal: customerTotal,
            vendorEarnings: vendorSubtotal,
            platformEarnings: platformFee
        };
    }

    function normalizePricedItems(items) {
        return Array.isArray(items)
            ? items.map(function normalizeOneItem(item, index) {
                return normalizePricedItem(item, index);
            })
            : [];
    }

    function calculateVendorSubtotal(items) {
        return normalizeCurrencyAmount(
            normalizePricedItems(items).reduce(function sumVendorSubtotal(total, item) {
                return total + (item.vendorPrice * item.quantity);
            }, 0)
        );
    }

    function calculateOrderSplit(items, options) {
        const platformFeeRate = resolvePlatformFeeRate(options);
        const pricedItems = normalizePricedItems(items).map(function priceOneItem(item) {
            return calculateLinePricing(item, { platformFeeRate });
        });
        const itemCount = pricedItems.reduce(function sumItemCount(total, item) {
            return total + item.quantity;
        }, 0);
        const vendorSubtotal = normalizeCurrencyAmount(
            pricedItems.reduce(function sumVendor(total, item) {
                return total + item.vendorSubtotal;
            }, 0)
        );
        const platformFee = normalizeCurrencyAmount(
            pricedItems.reduce(function sumFee(total, item) {
                return total + item.platformFee;
            }, 0)
        );
        const customerTotal = normalizeCurrencyAmount(vendorSubtotal + platformFee);

        return {
            platformFeeRate,
            currency: DEFAULT_CURRENCY,
            items: pricedItems,
            itemCount,
            vendorSubtotal,
            subtotal: vendorSubtotal,
            platformFee,
            platformEarnings: platformFee,
            vendorEarnings: vendorSubtotal,
            customerTotal,
            total: customerTotal,
            totalAmount: customerTotal,
            paymentAmount: customerTotal,
            paymentAmountInMinorUnits: amountToMinorUnits(customerTotal)
        };
    }

    function isCompletedPaidOrder(order) {
        const safeOrder = order && typeof order === "object" ? order : {};
        const status = normalizeLowerText(safeOrder.status || safeOrder.orderStatus);
        const paymentStatus = normalizeLowerText(safeOrder.paymentStatus || safeOrder.paymentState);

        return status === "completed" && (!paymentStatus || paymentStatus === "paid");
    }

    function getOrderVendorEarnings(order, options) {
        const safeOrder = order && typeof order === "object" ? order : {};

        if (safeOrder.vendorEarnings !== undefined) {
            return normalizeCurrencyAmount(safeOrder.vendorEarnings);
        }

        if (safeOrder.vendorSubtotal !== undefined) {
            return normalizeCurrencyAmount(safeOrder.vendorSubtotal);
        }

        return calculateOrderSplit(safeOrder.items || [], options).vendorEarnings;
    }

    function getOrderPlatformEarnings(order, options) {
        const safeOrder = order && typeof order === "object" ? order : {};

        if (safeOrder.platformEarnings !== undefined) {
            return normalizeCurrencyAmount(safeOrder.platformEarnings);
        }

        if (safeOrder.platformFee !== undefined) {
            return normalizeCurrencyAmount(safeOrder.platformFee);
        }

        return calculateOrderSplit(safeOrder.items || [], options).platformEarnings;
    }

    function payoutReservesBalance(payout) {
        const status = normalizeLowerText(payout && payout.status);

        return WITHDRAWAL_STATUSES_THAT_RESERVE_BALANCE.indexOf(status || "pending") >= 0;
    }

    function calculateVendorBalance(orders, payouts, options) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const vendorUid = normalizeText(safeOptions.vendorUid);
        const completedOrders = (Array.isArray(orders) ? orders : [])
            .filter(function matchCompletedOrder(order) {
                const orderVendorUid = normalizeText(order && order.vendorUid);

                return isCompletedPaidOrder(order) && (!vendorUid || orderVendorUid === vendorUid);
            });
        const vendorEarnings = normalizeCurrencyAmount(
            completedOrders.reduce(function sumEarnings(total, order) {
                return total + getOrderVendorEarnings(order, safeOptions);
            }, 0)
        );
        const reservedWithdrawals = normalizeCurrencyAmount(
            (Array.isArray(payouts) ? payouts : [])
                .filter(function matchPayout(payout) {
                    const payoutVendorUid = normalizeText(payout && payout.vendorUid);

                    return (!vendorUid || payoutVendorUid === vendorUid) && payoutReservesBalance(payout);
                })
                .reduce(function sumPayouts(total, payout) {
                    return total + normalizeCurrencyAmount(payout && payout.amount);
                }, 0)
        );

        return {
            vendorUid,
            completedOrders: completedOrders.length,
            totalEarned: vendorEarnings,
            reservedWithdrawals,
            availableBalance: normalizeCurrencyAmount(vendorEarnings - reservedWithdrawals)
        };
    }

    function calculatePlatformBalance(orders, options) {
        const safeOrders = Array.isArray(orders) ? orders : [];
        const completedOrders = safeOrders.filter(isCompletedPaidOrder);
        const platformEarnings = normalizeCurrencyAmount(
            completedOrders.reduce(function sumPlatform(total, order) {
                return total + getOrderPlatformEarnings(order, options);
            }, 0)
        );
        const customerRevenue = normalizeCurrencyAmount(
            completedOrders.reduce(function sumRevenue(total, order) {
                return total + normalizeCurrencyAmount(
                    order && (
                        order.paymentAmount !== undefined
                            ? order.paymentAmount
                            : order.total !== undefined
                                ? order.total
                                : order.totalAmount
                    )
                );
            }, 0)
        );

        return {
            completedOrders: completedOrders.length,
            customerRevenue,
            platformEarnings,
            platformBalance: platformEarnings
        };
    }

    const platformPricing = {
        MODULE_NAME,
        DEFAULT_CURRENCY,
        DEFAULT_PLATFORM_FEE_RATE,
        MAX_PLATFORM_FEE_RATE,
        WITHDRAWAL_STATUSES_THAT_RESERVE_BALANCE,
        normalizeText,
        normalizeLowerText,
        normalizeCurrencyAmount,
        normalizePositiveInteger,
        parseRateCandidate,
        normalizePlatformFeeRate,
        resolvePlatformFeeRate,
        amountToMinorUnits,
        getCurrencyDisplay,
        formatCurrency,
        calculatePlatformFee,
        calculateCustomerPrice,
        normalizePricedItem,
        calculateLinePricing,
        normalizePricedItems,
        calculateVendorSubtotal,
        calculateOrderSplit,
        isCompletedPaidOrder,
        getOrderVendorEarnings,
        getOrderPlatformEarnings,
        payoutReservesBalance,
        calculateVendorBalance,
        calculatePlatformBalance
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = platformPricing;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.platformPricing = platformPricing;
    }
})(typeof window !== "undefined" ? window : globalThis);