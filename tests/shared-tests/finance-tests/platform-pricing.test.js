const platformPricing = require("../../../public/shared/finance/platform-pricing.js");

describe("shared/finance/platform-pricing.js", () => {
    test("exports constants and normalization helpers", () => {
        expect(platformPricing.MODULE_NAME).toBe("platform-pricing");
        expect(platformPricing.DEFAULT_CURRENCY).toBe("ZAR");
        expect(platformPricing.DEFAULT_PLATFORM_FEE_RATE).toBe(0.1);

        expect(platformPricing.normalizeText("  hello  ")).toBe("hello");
        expect(platformPricing.normalizeText(null)).toBe("");
        expect(platformPricing.normalizeLowerText(" PAID ")).toBe("paid");
        expect(platformPricing.normalizeCurrencyAmount("12.349")).toBe(12.35);
        expect(platformPricing.normalizeCurrencyAmount("8999,98")).toBe(8999.98);
        expect(platformPricing.normalizeCurrencyAmount("-5")).toBe(0);
        expect(platformPricing.normalizeCurrencyAmount("bad", 7.239)).toBe(7.24);
        expect(platformPricing.normalizeCurrencyAmount("bad")).toBe(0);
        expect(platformPricing.amountFromMinorUnits(399998)).toBe(3999.98);
        expect(platformPricing.resolveCurrencyAmount(4000.02, 400000)).toBe(4000);
        expect(platformPricing.normalizePositiveInteger("3")).toBe(3);
        expect(platformPricing.normalizePositiveInteger("bad", 2)).toBe(2);
        expect(platformPricing.normalizePositiveInteger("bad")).toBe(1);
        expect(platformPricing.amountToMinorUnits(110)).toBe(11000);

        [
            "getOrderRefundImpact",
            "getOrderVendorRefundDeduction",
            "getOrderPlatformRefundDeduction",
            "getOrderTotalRefundDeduction",
            "getOrderNetVendorEarnings",
            "getOrderNetPlatformEarnings"
        ].forEach((name) => expect(typeof platformPricing[name]).toBe("function"));
    });

    test("formats currency consistently across local and GitHub environments", () => {
        expect(platformPricing.getCurrencyDisplay("ZAR")).toBe("R");
        expect(platformPricing.getCurrencyDisplay(" zar ")).toBe("R");
        expect(platformPricing.getCurrencyDisplay("USD")).toBe("USD");

        expect(platformPricing.formatCurrency(110)).toBe("R 110.00");
        expect(platformPricing.formatCurrency("110.5")).toBe("R 110.50");
        expect(platformPricing.formatCurrency("bad")).toBe("R 0.00");
        expect(platformPricing.formatCurrency(110, "USD")).toBe("USD 110.00");
    });

    test("normalizes fee rates from decimal, percent strings, and whole percent numbers", () => {
        expect(platformPricing.normalizePlatformFeeRate(0.1)).toBe(0.1);
        expect(platformPricing.normalizePlatformFeeRate("10%")).toBe(0.1);
        expect(platformPricing.normalizePlatformFeeRate(10)).toBe(0.1);
        expect(platformPricing.normalizePlatformFeeRate("7.5%")).toBe(0.075);
        expect(platformPricing.normalizePlatformFeeRate("bad", "12%")).toBe(0.12);
        expect(platformPricing.normalizePlatformFeeRate("bad")).toBe(0.1);
        expect(platformPricing.normalizePlatformFeeRate("150%")).toBe(1);
    });

    test("calculates the basic R100 vendor price into R110 customer price", () => {
        expect(platformPricing.calculatePlatformFee(100)).toBe(10);
        expect(platformPricing.calculateCustomerPrice(100)).toBe(110);

        const line = platformPricing.calculateLinePricing({
            menuItemId: "burger",
            name: "Burger",
            price: 100,
            quantity: 1
        });

        expect(line.vendorPrice).toBe(100);
        expect(line.vendorSubtotal).toBe(100);
        expect(line.platformFee).toBe(10);
        expect(line.customerUnitPrice).toBe(110);
        expect(line.customerTotal).toBe(110);
        expect(line.vendorEarnings).toBe(100);
        expect(line.platformEarnings).toBe(10);
    });

    test("calculates an order split using quantity and line-level rounding", () => {
        const split = platformPricing.calculateOrderSplit([
            { menuItemId: "meal", name: "Meal", price: 100, quantity: 2 },
            { menuItemId: "drink", name: "Drink", price: 15.5, quantity: 1 }
        ]);

        expect(split.itemCount).toBe(3);
        expect(split.vendorSubtotal).toBe(215.5);
        expect(split.platformFee).toBe(21.55);
        expect(split.vendorEarnings).toBe(215.5);
        expect(split.platformEarnings).toBe(21.55);
        expect(split.customerTotal).toBe(237.05);
        expect(split.total).toBe(237.05);
        expect(split.paymentAmount).toBe(237.05);
        expect(split.paymentAmountInMinorUnits).toBe(23705);
        expect(split.items).toHaveLength(2);
        expect(split.items[0]).toMatchObject({
            vendorSubtotal: 200,
            platformFee: 20,
            customerTotal: 220
        });
    });

    test("supports a custom platform fee rate", () => {
        const split = platformPricing.calculateOrderSplit(
            [{ name: "Wrap", price: 80, quantity: 2 }],
            { platformFeeRate: "7.5%" }
        );

        expect(split.platformFeeRate).toBe(0.075);
        expect(split.vendorSubtotal).toBe(160);
        expect(split.platformFee).toBe(12);
        expect(split.customerTotal).toBe(172);
    });

    test("normalizes priced items without mutating caller data", () => {
        const rawItem = {
            id: "item-1",
            vendorUid: " vendor-1 ",
            vendorName: " Food Spot ",
            name: " Chips ",
            category: " Sides ",
            price: "25.499",
            quantity: "2"
        };

        const item = platformPricing.normalizePricedItem(rawItem, 0);

        expect(item).toMatchObject({
            menuItemId: "item-1",
            id: "item-1",
            vendorUid: "vendor-1",
            vendorName: "Food Spot",
            name: "Chips",
            category: "Sides",
            vendorPrice: 25.5,
            price: 25.5,
            quantity: 2
        });
        expect(rawItem.price).toBe("25.499");
    });

    test("calculates vendor available balance from completed paid orders and reserved withdrawals", () => {
        const orders = [
            {
                vendorUid: "v-1",
                status: "completed",
                paymentStatus: "paid",
                vendorEarnings: 100
            },
            {
                vendorUid: "v-1",
                status: "completed",
                paymentStatus: "paid",
                items: [{ name: "Fallback", price: 50, quantity: 2 }]
            },
            {
                vendorUid: "v-1",
                status: "pending",
                paymentStatus: "paid",
                vendorEarnings: 999
            },
            {
                vendorUid: "v-2",
                status: "completed",
                paymentStatus: "paid",
                vendorEarnings: 500
            }
        ];
        const payouts = [
            { vendorUid: "v-1", status: "pending", amount: 30 },
            { vendorUid: "v-1", status: "paid", amount: 40 },
            { vendorUid: "v-1", status: "rejected", amount: 999 },
            { vendorUid: "v-2", status: "pending", amount: 100 }
        ];

        const balance = platformPricing.calculateVendorBalance(orders, payouts, {
            vendorUid: "v-1"
        });

        expect(balance.completedOrders).toBe(2);
        expect(balance.grossVendorEarnings).toBe(200);
        expect(balance.refundDeductions).toBe(0);
        expect(balance.netVendorEarnings).toBe(200);
        expect(balance.totalEarned).toBe(200);
        expect(balance.reservedWithdrawals).toBe(70);
        expect(balance.availableBalance).toBe(130);
    });

    test("uses stored minor-unit amounts for wallet balances when available", () => {
        const orders = [
            {
                vendorUid: "v-1",
                status: "completed",
                paymentStatus: "paid",
                vendorEarnings: 8000.02,
                vendorEarningsInMinorUnits: 800000
            }
        ];
        const payouts = [
            {
                vendorUid: "v-1",
                status: "pending",
                amount: 4000.02,
                amountInMinorUnits: 400000
            }
        ];

        const balance = platformPricing.calculateVendorBalance(orders, payouts, {
            vendorUid: "v-1"
        });

        expect(balance.grossVendorEarnings).toBe(8000);
        expect(balance.reservedWithdrawals).toBe(4000);
        expect(balance.availableBalance).toBe(4000);
    });

    test("prefers vendor subtotal over vendor earnings when they only differ by rounding cents", () => {
        const balance = platformPricing.calculateVendorBalance([
            {
                vendorUid: "v-1",
                status: "completed",
                paymentStatus: "paid",
                vendorSubtotal: 9000,
                vendorEarnings: 8999.98
            }
        ], [], {
            vendorUid: "v-1"
        });

        expect(balance.grossVendorEarnings).toBe(9000);
        expect(balance.availableBalance).toBe(9000);
    });

    test("reduces vendor balance for completed support-refunded orders without counting cancelled orders", () => {
        const orders = [
            {
                vendorUid: "v-1",
                status: "completed",
                paymentStatus: "paid",
                vendorEarnings: 100,
                platformEarnings: 10,
                supportRefundVendorDeduction: 40,
                supportRefundPlatformDeduction: 4
            },
            {
                vendorUid: "v-1",
                status: "completed",
                paymentStatus: "paid",
                vendorEarnings: 80,
                refundCase: {
                    impact: {
                        vendorDeduction: 20,
                        platformDeduction: 2
                    }
                }
            },
            {
                vendorUid: "v-1",
                status: "cancelled",
                paymentStatus: "paid",
                vendorEarnings: 999,
                supportRefundVendorDeduction: 999
            },
            {
                vendorUid: "v-1",
                status: "completed",
                paymentStatus: "paid",
                vendorEarnings: 30,
                supportRefundVendorDeduction: 100
            }
        ];

        expect(platformPricing.getOrderVendorRefundDeduction(orders[0])).toBe(40);
        expect(platformPricing.getOrderPlatformRefundDeduction(orders[0])).toBe(4);
        expect(platformPricing.getOrderTotalRefundDeduction(orders[0])).toBe(44);
        expect(platformPricing.getOrderNetVendorEarnings(orders[0])).toBe(60);
        expect(platformPricing.getOrderNetVendorEarnings(orders[3])).toBe(0);

        const balance = platformPricing.calculateVendorBalance(orders, [], {
            vendorUid: "v-1"
        });

        expect(balance.completedOrders).toBe(3);
        expect(balance.grossVendorEarnings).toBe(210);
        expect(balance.refundDeductions).toBe(90);
        expect(balance.netVendorEarnings).toBe(120);
        expect(balance.totalEarned).toBe(120);
        expect(balance.availableBalance).toBe(120);
    });

    test("calculates platform earnings from completed paid orders only", () => {
        const orders = [
            {
                status: "completed",
                paymentStatus: "paid",
                paymentAmount: 110,
                platformEarnings: 10
            },
            {
                status: "completed",
                paymentStatus: "paid",
                total: 55,
                platformFee: 5
            },
            {
                status: "completed",
                paymentStatus: "paid",
                total: 110,
                items: [{ name: "Fallback", price: 100, quantity: 1 }]
            },
            {
                status: "cancelled",
                paymentStatus: "paid",
                paymentAmount: 110,
                platformEarnings: 10
            }
        ];

        const balance = platformPricing.calculatePlatformBalance(orders);

        expect(balance.completedOrders).toBe(3);
        expect(balance.customerRevenue).toBe(275);
        expect(balance.grossPlatformEarnings).toBe(25);
        expect(balance.refundDeductions).toBe(0);
        expect(balance.netPlatformEarnings).toBe(25);
        expect(balance.platformEarnings).toBe(25);
        expect(balance.platformBalance).toBe(25);
    });

    test("reduces platform balance for completed support-refunded orders", () => {
        const orders = [
            {
                status: "completed",
                paymentStatus: "paid",
                paymentAmount: 110,
                platformEarnings: 10,
                supportRefundVendorDeduction: 50,
                supportRefundPlatformDeduction: 5
            },
            {
                status: "completed",
                paymentStatus: "paid",
                paymentAmount: 220,
                platformEarnings: 20,
                refundCase: {
                    impact: {
                        vendorDeduction: 100,
                        platformDeduction: 10
                    }
                }
            },
            {
                status: "pending",
                paymentStatus: "paid",
                paymentAmount: 110,
                platformEarnings: 10,
                supportRefundPlatformDeduction: 10
            },
            {
                status: "completed",
                paymentStatus: "paid",
                paymentAmount: 55,
                platformEarnings: 5,
                supportRefundPlatformDeduction: 100
            }
        ];

        expect(platformPricing.getOrderNetPlatformEarnings(orders[0])).toBe(5);
        expect(platformPricing.getOrderNetPlatformEarnings(orders[3])).toBe(0);

        const balance = platformPricing.calculatePlatformBalance(orders);

        expect(balance.completedOrders).toBe(3);
        expect(balance.customerRevenue).toBe(385);
        expect(balance.grossPlatformEarnings).toBe(35);
        expect(balance.refundDeductions).toBe(20);
        expect(balance.netPlatformEarnings).toBe(15);
        expect(balance.platformEarnings).toBe(15);
        expect(balance.platformBalance).toBe(15);
    });

    test("exposes browser global when loaded outside CommonJS", () => {
        expect(platformPricing.formatCurrency(110)).toBe("R 110.00");
        expect(platformPricing.payoutReservesBalance({ status: "approved" })).toBe(true);
        expect(platformPricing.payoutReservesBalance({ status: "rejected" })).toBe(false);
    });
});
