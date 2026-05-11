const paymentFormatters = require("../../../public/shared/payments/payment-formatters.js");
const paymentStatus = require("../../../public/shared/payments/payment-status.js");
const paymentModel = require("../../../public/shared/payments/payment-model.js");

describe("shared/payments/payment-formatters.js", () => {
    test("exports utility helpers", () => {
        expect(paymentFormatters.MODULE_NAME).toBe("payment-formatters");
        expect(paymentFormatters.normalizeText(" ref ")).toBe("ref");
        expect(paymentFormatters.normalizeText(null)).toBe("");
        expect(paymentFormatters.normalizeLowerText(" PAID ")).toBe("paid");
        expect(paymentFormatters.normalizeUpperText(" zar ")).toBe("ZAR");
        expect(paymentFormatters.normalizeNumber("12.5")).toBe(12.5);
        expect(paymentFormatters.normalizeNumber("bad")).toBeNull();
    });

    test("resolves payment helper dependencies", () => {
        expect(paymentFormatters.resolvePaymentStatus(paymentStatus)).toBe(paymentStatus);
        expect(paymentFormatters.resolvePaymentModel(paymentModel)).toBe(paymentModel);

        const originalGlobalPaymentStatus = global.paymentStatus;
        const originalGlobalPaymentModel = global.paymentModel;

        try {
            global.paymentStatus = paymentStatus;
            global.paymentModel = paymentModel;

            expect(paymentFormatters.resolvePaymentStatus()).toBe(paymentStatus);
            expect(paymentFormatters.resolvePaymentModel()).toBe(paymentModel);
        } finally {
            if (originalGlobalPaymentStatus === undefined) {
                delete global.paymentStatus;
            } else {
                global.paymentStatus = originalGlobalPaymentStatus;
            }

            if (originalGlobalPaymentModel === undefined) {
                delete global.paymentModel;
            } else {
                global.paymentModel = originalGlobalPaymentModel;
            }
        }
    });

    test("normalizes payment records through payment-model when available", () => {
        expect(paymentFormatters.normalizePaymentRecord({
            status: "success",
            amount: 20
        }, {
            paymentStatus,
            paymentModel
        })).toEqual(expect.objectContaining({
            status: "paid",
            amount: 20,
            amountInMinorUnits: 2000,
            currency: "ZAR"
        }));
    });

    test("formats grouped numbers", () => {
        expect(paymentFormatters.formatGroupedNumber(1234.5)).toBe("1,234.50");
        expect(paymentFormatters.formatGroupedNumber(-1234.5)).toBe("-1,234.50");
        expect(paymentFormatters.formatGroupedNumber(1234.567, {
            decimals: 1
        })).toBe("1,234.6");
        expect(paymentFormatters.formatGroupedNumber("bad")).toBe("");
    });

    test("returns currency symbols", () => {
        expect(paymentFormatters.getCurrencySymbol("ZAR")).toBe("R");
        expect(paymentFormatters.getCurrencySymbol("usd")).toBe("$");
        expect(paymentFormatters.getCurrencySymbol("EUR")).toBe("EUR ");
        expect(paymentFormatters.getCurrencySymbol("GBP")).toBe("GBP ");
        expect(paymentFormatters.getCurrencySymbol("NGN")).toBe("NGN ");
    });

    test("formats payment amounts", () => {
        expect(paymentFormatters.formatPaymentAmount(120, "ZAR")).toBe("R120.00");
        expect(paymentFormatters.formatPaymentAmount(1234.5, "USD")).toBe("$1,234.50");
        expect(paymentFormatters.formatPaymentAmount(120, {
            currency: "ZAR",
            symbol: "R ",
            decimals: 0
        })).toBe("R 120");
        expect(paymentFormatters.formatPaymentAmount("bad", {
            emptyValue: "No amount"
        })).toBe("No amount");
    });

    test("formats payment amounts from minor units", () => {
        expect(paymentFormatters.formatPaymentAmountInMinorUnits(12345, "ZAR")).toBe("R123.45");
        expect(paymentFormatters.formatPaymentAmountInMinorUnits("bad", "ZAR")).toBe("R0.00");
    });

    test("formats payment status labels and metadata", () => {
        expect(paymentFormatters.getPaymentStatusLabel("success", paymentStatus)).toBe("Paid");
        expect(paymentFormatters.getPaymentStatusShortLabel("pending", paymentStatus)).toBe("Pending");
        expect(paymentFormatters.getPaymentStatusDescription("failed", paymentStatus)).toBe(
            "Payment could not be verified or was not completed."
        );
        expect(paymentFormatters.getPaymentStatusTone("paid", paymentStatus)).toBe("success");
        expect(paymentFormatters.getPaymentStatusActionLabel("failed", paymentStatus)).toBe("Retry Payment");
        expect(paymentFormatters.getPaymentStatusLabel("Pending")).toBe("Payment Pending");
    });

    test("falls back when payment status helpers are unavailable", () => {
        expect(paymentFormatters.getPaymentStatusLabel("pending", {})).toBe("pending");
        expect(paymentFormatters.getPaymentStatusShortLabel("", {})).toBe("Unknown");
        expect(paymentFormatters.getPaymentStatusDescription("pending", {})).toBe(
            "The payment status is still being resolved."
        );
        expect(paymentFormatters.getPaymentStatusTone("pending", {})).toBe("neutral");
        expect(paymentFormatters.getPaymentStatusActionLabel("pending", {})).toBe("Review Payment");
    });

    test("formats payment providers and references", () => {
        expect(paymentFormatters.formatPaymentProvider("paystack")).toBe("Paystack");
        expect(paymentFormatters.formatPaymentProvider(" campus-pay ")).toBe("campus-pay");
        expect(paymentFormatters.formatPaymentProvider("")).toBe("Payment Provider");

        expect(paymentFormatters.formatPaymentReference("paystack-reference-123456789")).toBe("Ref #23456789");
        expect(paymentFormatters.formatPaymentReference("ref-1")).toBe("Ref #ref-1");
        expect(paymentFormatters.formatPaymentReference("ref-1", {
            prefix: "",
            visibleChars: 3
        })).toBe("#ref-1");
        expect(paymentFormatters.formatPaymentReference("", {
            emptyValue: "Missing"
        })).toBe("Missing");
    });

    test("converts values to date instances", () => {
        const date = new Date("2026-05-11T10:15:00Z");

        expect(paymentFormatters.toDateInstance(date).toISOString()).toBe(date.toISOString());
        expect(paymentFormatters.toDateInstance({
            seconds: 0,
            nanoseconds: 0
        }).toISOString()).toBe("1970-01-01T00:00:00.000Z");
        expect(paymentFormatters.toDateInstance({
            _seconds: 0,
            _nanoseconds: 500000000
        }).toISOString()).toBe("1970-01-01T00:00:00.500Z");
        expect(paymentFormatters.toDateInstance("not-a-date")).toBeNull();
    });

    test("formats date and time values", () => {
        const formatted = paymentFormatters.formatDateTime("2026-05-11T10:15:00Z", {
            timeZone: "UTC"
        });

        expect(formatted).toContain("2026");
        expect(paymentFormatters.formatDateTime(null)).toBe("Unknown time");
        expect(paymentFormatters.formatDateTime(null, {
            emptyValue: "No date"
        })).toBe("No date");
    });

    test("formats payment timestamps by priority", () => {
        expect(paymentFormatters.formatPaymentTimestamp({
            paidAt: "2026-05-11T10:15:00Z",
            verifiedAt: "2026-05-12T10:15:00Z"
        }, {
            paymentModel,
            timeZone: "UTC"
        })).toContain("2026");
        expect(paymentFormatters.formatPaymentTimestamp({}, {
            paymentModel,
            emptyValue: "No timestamp"
        })).toBe("No timestamp");
    });

    test("formats payment summaries for UI display", () => {
        expect(paymentFormatters.formatPaymentSummary({
            provider: "paystack",
            status: "success",
            reference: "paystack-reference-123456789",
            amount: 75.5,
            currency: "ZAR",
            paidAt: "2026-05-11T10:15:00Z"
        }, {
            paymentStatus,
            paymentModel,
            timeZone: "UTC"
        })).toEqual(expect.objectContaining({
            providerLabel: "Paystack",
            status: "paid",
            statusLabel: "Paid",
            statusShortLabel: "Paid",
            statusDescription: "Payment was successfully verified.",
            statusTone: "success",
            actionLabel: "View Payment",
            amountLabel: "R75.50",
            referenceLabel: "Ref #23456789"
        }));
    });

    test("attaches the module to a browser-like global scope", () => {
        jest.isolateModules(() => {
            const originalWindow = global.window;

            try {
                global.window = {
                    paymentStatus,
                    paymentModel
                };
                require("../../../public/shared/payments/payment-formatters.js");

                expect(global.window.paymentFormatters).toBeDefined();
                expect(global.window.paymentFormatters.formatPaymentAmount(10, "ZAR")).toBe("R10.00");
            } finally {
                if (originalWindow === undefined) {
                    delete global.window;
                } else {
                    global.window = originalWindow;
                }
            }
        });
    });
});
