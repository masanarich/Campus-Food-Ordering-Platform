const fs = require("fs");
const path = require("path");
const vm = require("vm");

const checkoutStatus = require("../../../public/shared/checkout/checkout-status.js");
const checkoutModel = require("../../../public/shared/checkout/checkout-model.js");
const checkoutValidation = require("../../../public/shared/checkout/checkout-validation.js");

const createdAt = "2026-05-18T08:00:00.000Z";
const updatedAt = "2026-05-18T08:05:00.000Z";

function createValidCheckout(overrides = {}) {
    return {
        checkoutId: "checkout-001",
        customerUid: "customer-001",
        customerName: "Student Buyer",
        customerEmail: "student@example.com",
        vendorUid: "vendor-001",
        vendorName: "Campus Kitchen",
        items: [
            {
                menuItemId: "meal-001",
                vendorUid: "vendor-001",
                vendorName: "Campus Kitchen",
                name: "Rice Bowl",
                category: "Meals",
                price: 45,
                quantity: 2
            }
        ],
        subtotal: 90,
        total: 90,
        paymentAmount: 90,
        paymentAmountInMinorUnits: 9000,
        paymentProvider: "paystack",
        paymentCurrency: "ZAR",
        status: "draft",
        timeline: [
            {
                status: "draft",
                actorRole: "customer",
                actorUid: "customer-001",
                actorName: "Student Buyer",
                at: createdAt
            }
        ],
        createdAt,
        updatedAt,
        ...overrides
    };
}

describe("shared/checkout/checkout-validation.js", () => {
    test("exports the expected module constants and helpers", () => {
        expect(checkoutValidation.MODULE_NAME).toBe("checkout-validation");
        expect(checkoutValidation.DEFAULT_ALLOWED_CURRENCIES).toEqual(["ZAR"]);
        expect(checkoutValidation.DEFAULT_ALLOWED_PROVIDERS).toEqual(["paystack"]);
        expect(checkoutValidation.normalizeText("  Hello  ")).toBe("Hello");
        expect(checkoutValidation.normalizeLowerText(" PAYSTACK ")).toBe("paystack");
        expect(checkoutValidation.normalizeUpperText(" zar ")).toBe("ZAR");
        expect(checkoutValidation.normalizeTagList(" Halal, gluten free, halal ")).toEqual([
            "halal",
            "gluten free"
        ]);
        expect(checkoutValidation.normalizeTagList([" Nuts ", "dairy", "nuts"])).toEqual([
            "nuts",
            "dairy"
        ]);
        expect(checkoutValidation.normalizeTagList(null)).toEqual([]);
        expect(checkoutValidation.normalizeCurrencyAmount("10.235")).toBe(10.24);
        expect(checkoutValidation.normalizeCurrencyAmount(null, "3.2")).toBe(3.2);
        expect(checkoutValidation.normalizeCurrencyAmount()).toBe(0);
        expect(checkoutValidation.normalizeAmountInMinorUnits("-5")).toBe(0);
        expect(checkoutValidation.normalizeAmountInMinorUnits(null, "250")).toBe(250);
        expect(checkoutValidation.normalizeAmountInMinorUnits()).toBe(0);
        expect(checkoutValidation.normalizeAllowedValues([" ZAR ", "", "usd"], checkoutValidation.normalizeUpperText))
            .toEqual(["ZAR", "USD"]);
        expect(checkoutValidation.isValidEmail("student@example.com")).toBe(true);
        expect(checkoutValidation.isValidEmail("student.example.com")).toBe(false);
        expect(checkoutValidation.getRawItemPrice({ customerPrice: "33.50" })).toBe("33.50");
        expect(checkoutValidation.getRawItemPrice({ vendorPrice: "30" })).toBe("30");
    });

    test("creates validation results and preserves the first error for each key", () => {
        const errors = {};

        expect(checkoutValidation.createValidationResult(null, { value: 1 }))
            .toEqual({ isValid: true, errors: {}, value: 1 });
        expect(checkoutValidation.setError(null, "field", "Missing")).toBeNull();
        checkoutValidation.setError(errors, "field", "First");
        checkoutValidation.setError(errors, "field", "Second");
        checkoutValidation.setError(errors, "", "Ignored");
        checkoutValidation.mergeErrors(errors, { nested: "Nested error" }, "checkout");
        checkoutValidation.mergeErrors(null, { loose: "Loose error" });

        expect(errors).toEqual({
            field: "First",
            "checkout.nested": "Nested error"
        });
    });

    test("resolves checkout dependencies from explicit arguments, globals, require, and invalid values", () => {
        const previousStatus = global.checkoutStatus;
        const previousModel = global.checkoutModel;

        expect(checkoutValidation.resolveCheckoutStatus(checkoutStatus)).toBe(checkoutStatus);
        expect(checkoutValidation.resolveCheckoutModel(checkoutModel)).toBe(checkoutModel);
        expect(checkoutValidation.resolveCheckoutStatus({})).toBeNull();
        expect(checkoutValidation.resolveCheckoutModel({})).toBeNull();

        global.checkoutStatus = checkoutStatus;
        global.checkoutModel = checkoutModel;
        expect(checkoutValidation.resolveCheckoutStatus()).toBe(checkoutStatus);
        expect(checkoutValidation.resolveCheckoutModel()).toBe(checkoutModel);

        delete global.checkoutStatus;
        delete global.checkoutModel;
        expect(checkoutValidation.resolveCheckoutStatus()).toEqual(checkoutStatus);
        expect(checkoutValidation.resolveCheckoutModel()).toEqual(checkoutModel);

        global.checkoutStatus = previousStatus;
        global.checkoutModel = previousModel;
    });

    test("returns null when checkout dependencies cannot be required", () => {
        const sourcePath = path.resolve(__dirname, "../../../public/shared/checkout/checkout-validation.js");
        const source = fs.readFileSync(sourcePath, "utf8");
        const context = {
            window: {},
            require: () => {
                throw new Error("missing module");
            }
        };

        vm.createContext(context);
        vm.runInContext(source, context);

        expect(context.window.checkoutValidation.resolveCheckoutStatus()).toBeNull();
        expect(context.window.checkoutValidation.resolveCheckoutModel()).toBeNull();
    });

    test("validates customer and vendor snapshots", () => {
        expect(checkoutValidation.validateCustomerSnapshot({
            uid: "customer-1",
            displayName: "Test Customer",
            email: "CUSTOMER@EXAMPLE.COM"
        }).isValid).toBe(true);
        expect(checkoutValidation.validateVendorSnapshot({
            uid: "vendor-1",
            shopName: "Food Shop"
        }).isValid).toBe(true);

        const missingCustomer = checkoutValidation.validateCustomerSnapshot({
            customerEmail: "not-an-email"
        }, { checkoutModel: null });
        expect(missingCustomer.isValid).toBe(false);
        expect(missingCustomer.errors).toEqual({
            customerUid: "Customer UID is required.",
            customerName: "Customer name is required.",
            customerEmail: "Customer email must be a valid email address."
        });

        const noEmailRequired = checkoutValidation.validateCustomerSnapshot({
            customerUid: "customer-1",
            customerName: "Test Customer"
        }, { requireEmail: false, checkoutModel: null });
        expect(noEmailRequired.isValid).toBe(true);

        expect(checkoutValidation.validateCustomerSnapshot({
            customerUid: "customer-1",
            customerName: "Test Customer"
        }).errors.customerEmail).toBe("Customer email is required.");

        const missingVendor = checkoutValidation.validateVendorSnapshot({}, { checkoutModel: null });
        expect(missingVendor.errors).toEqual({
            vendorUid: "Vendor UID is required.",
            vendorName: "Vendor name is required."
        });
    });

    test("validates checkout item fields and normalizes accepted aliases", () => {
        const result = checkoutValidation.validateCheckoutItem({
            id: "item-1",
            itemName: "Wrap",
            unitPrice: "25.50",
            quantity: "2",
            vendorUid: "vendor-1",
            dietaryTags: " Halal, high protein, halal ",
            allergenTags: [" Gluten ", "dairy", "gluten"]
        }, { requireVendorDetails: true });

        expect(result.isValid).toBe(true);
        expect(result.value).toMatchObject({
            menuItemId: "item-1",
            name: "Wrap",
            vendorPrice: 23.18,
            platformFee: 2.32,
            price: 25.5,
            quantity: 2,
            dietary: ["halal", "high protein"],
            allergens: ["gluten", "dairy"],
            vendorSubtotal: 46.36,
            platformFeeTotal: 4.64,
            lineTotal: 51
        });

        const fallbackTags = checkoutValidation.validateCheckoutItem({
            id: "fallback-tags",
            name: "Fruit Cup",
            price: "18",
            dietary: [" Vegan ", "gluten free", "vegan"],
            allergens: "nuts, sesame, nuts"
        }, {
            checkoutModel: null
        });

        expect(fallbackTags.isValid).toBe(true);
        expect(fallbackTags.value).toMatchObject({
            dietary: ["vegan", "gluten free"],
            allergens: ["nuts", "sesame"]
        });

        const vendorPriced = checkoutValidation.validateCheckoutItem({
            id: "vendor-priced",
            itemName: "Vendor Meal",
            vendorPrice: "100",
            quantity: 1,
            vendorUid: "vendor-1"
        }, { requireVendorDetails: true });
        expect(vendorPriced.isValid).toBe(true);
        expect(vendorPriced.value).toMatchObject({
            vendorPrice: 100,
            platformFee: 10,
            customerPrice: 110,
            price: 110,
            lineTotal: 110
        });

        const invalid = checkoutValidation.validateCheckoutItem({
            price: "bad",
            quantity: 0
        }, {
            checkoutModel: null,
            requireVendorDetails: true
        });
        expect(invalid.isValid).toBe(false);
        expect(invalid.errors).toEqual({
            menuItemId: "Each checkout item needs a menu item ID or item name.",
            name: "Each checkout item needs a name.",
            price: "Each checkout item price must be a valid non-negative amount.",
            quantity: "Each checkout item quantity must be at least 1.",
            vendorUid: "Each checkout item needs a vendor UID."
        });

        expect(checkoutValidation.validateCheckoutItem({}, { checkoutModel: null }).errors.price)
            .toBe("Each checkout item needs a price.");
    });

    test("validates item collections and prefixes nested item errors", () => {
        const validItems = checkoutValidation.validateCheckoutItems(createValidCheckout().items);
        expect(validItems.isValid).toBe(true);
        expect(validItems.value).toHaveLength(1);
        expect(validItems.value[0].dietary).toEqual([]);
        expect(validItems.value[0].allergens).toEqual([]);

        const invalidItems = checkoutValidation.validateCheckoutItems([{ quantity: -1 }], {
            checkoutModel: null
        });
        expect(invalidItems.isValid).toBe(false);
        expect(invalidItems.errors["items.0.quantity"]).toBe("Each checkout item quantity must be at least 1.");

        expect(checkoutValidation.validateCheckoutItems("not-array").errors.items)
            .toBe("Add at least one checkout item.");
        expect(checkoutValidation.validateCheckoutItems([]).errors.items)
            .toBe("Add at least one checkout item.");
    });

    test("validates checkout timeline entries", () => {
        const valid = checkoutValidation.validateCheckoutTimeline(createValidCheckout().timeline);
        expect(valid.isValid).toBe(true);
        expect(valid.value[0].status).toBe("draft");

        const invalid = checkoutValidation.validateCheckoutTimeline([
            { status: "unknown", actorRole: "vendor" },
            null
        ]);
        expect(invalid.isValid).toBe(false);
        expect(invalid.errors).toEqual({
            "timeline.0.status": "Timeline entries need a valid checkout status.",
            "timeline.0.actorRole": "Timeline entries need a valid actor role.",
            "timeline.0.at": "Timeline entries need a timestamp.",
            "timeline.1.status": "Timeline entries need a valid checkout status.",
            "timeline.1.actorRole": "Timeline entries need a valid actor role.",
            "timeline.1.at": "Timeline entries need a timestamp."
        });

        expect(checkoutValidation.validateCheckoutTimeline(null).errors.timeline)
            .toBe("At least one checkout timeline entry is required.");
        expect(checkoutValidation.validateCheckoutTimeline([createValidCheckout().timeline[0]], {
            checkoutStatus: {},
            checkoutModel: {}
        }).errors["timeline.0.status"]).toBe("Timeline entries need a valid checkout status.");
    });

    test("validates checkout totals against items and payment minor units", () => {
        const valid = checkoutValidation.validateCheckoutTotals(createValidCheckout());
        expect(valid.isValid).toBe(true);
        expect(valid.value.expectedSubtotal).toBe(90);
        expect(valid.value.expectedVendorSubtotal).toBe(81.82);
        expect(valid.value.expectedPlatformFee).toBe(8.18);
        expect(valid.value.customerTotal).toBe(90);
        expect(valid.value.expectedAmountInMinorUnits).toBe(9000);

        const invalid = checkoutValidation.validateCheckoutTotals(createValidCheckout({
            subtotal: 80,
            total: 70,
            vendorSubtotal: 70,
            vendorEarnings: 60,
            platformFee: 3,
            platformEarnings: 2,
            customerTotal: 80,
            paymentAmount: 60,
            paymentAmountInMinorUnits: 5000
        }));
        expect(invalid.isValid).toBe(false);
        expect(invalid.errors).toMatchObject({
            subtotal: "Checkout subtotal must match the sum of its items (90).",
            total: "Checkout total cannot be less than subtotal.",
            vendorSubtotal: "Vendor subtotal must match the vendor share of its items (81.82).",
            platformFee: "Platform fee must match the platform share of its items (8.18).",
            customerTotal: "Customer total must match the checkout total.",
            paymentAmount: "Payment amount must match the checkout total.",
            paymentAmountInMinorUnits: "Payment amount in minor units must match the payment amount."
        });

        const fallback = checkoutValidation.validateCheckoutTotals({
            subtotal: 12,
            total: 12,
            paymentAmount: 12,
            paymentAmountInMinorUnits: 1200
        }, { checkoutModel: {} });
        expect(fallback.isValid).toBe(true);
    });

    test("validates checkout payment fields for provider, currency, pending, paid, failed, and invalid status cases", () => {
        const pending = checkoutValidation.validateCheckoutPaymentFields(createValidCheckout({
            status: "payment_pending",
            paymentReference: "ref-123",
            paymentAccessCode: "access-123",
            paymentAuthorizationUrl: "https://pay.example/checkout"
        }));
        expect(pending.isValid).toBe(true);
        expect(pending.value.status).toBe("payment_pending");

        const paid = checkoutValidation.validateCheckoutPaymentFields(createValidCheckout({
            status: "paid",
            paymentReference: "ref-123",
            paymentVerifiedAt: updatedAt
        }));
        expect(paid.isValid).toBe(true);

        const failed = checkoutValidation.validateCheckoutPaymentFields(createValidCheckout({
            status: "payment_failed",
            paymentReference: "ref-123",
            paymentFailureReason: "Card declined"
        }));
        expect(failed.isValid).toBe(true);

        const invalid = checkoutValidation.validateCheckoutPaymentFields(createValidCheckout({
            status: "mystery",
            paymentProvider: "stripe",
            paymentCurrency: "USD",
            paymentAmount: -1,
            paymentAmountInMinorUnits: -100
        }));
        expect(invalid.errors).toMatchObject({
            status: "Checkout status must be valid.",
            paymentProvider: "Payment provider must be one of: paystack.",
            paymentCurrency: "Payment currency must be one of: ZAR.",
            paymentAmount: "Payment amount must be a valid non-negative amount.",
            paymentAmountInMinorUnits: "Payment amount in minor units must be valid."
        });

        const missingPendingFields = checkoutValidation.validateCheckoutPaymentFields(createValidCheckout({
            status: "payment_pending"
        }));
        expect(missingPendingFields.errors).toMatchObject({
            paymentReference: "Payment reference is required once payment has started.",
            paymentAccessCode: "Pending payments must include a payment access code.",
            paymentAuthorizationUrl: "Pending payments must include a payment authorization URL."
        });

        const missingPaidFields = checkoutValidation.validateCheckoutPaymentFields(createValidCheckout({
            status: "converted",
            paymentReference: "ref-123"
        }));
        expect(missingPaidFields.errors.paymentVerifiedAt)
            .toBe("Paid checkout sessions must include a payment verification timestamp.");

        const missingFailedReason = checkoutValidation.validateCheckoutPaymentFields(createValidCheckout({
            status: "payment_failed",
            paymentReference: "ref-123"
        }));
        expect(missingFailedReason.errors.paymentFailureReason)
            .toBe("Failed payments must include a failure reason.");

        const customAllowed = checkoutValidation.validateCheckoutPaymentFields(createValidCheckout({
            paymentProvider: "custom",
            paymentCurrency: "USD"
        }), {
            allowedPaymentProviders: ["custom"],
            allowedPaymentCurrencies: ["usd"]
        });
        expect(customAllowed.isValid).toBe(true);

        const missingProviderCurrency = checkoutValidation.validateCheckoutPaymentFields({
            status: "draft",
            total: 10,
            paymentAmount: 10,
            paymentAmountInMinorUnits: 1000
        }, {
            checkoutModel: {},
            allowedPaymentProviders: [],
            allowedPaymentCurrencies: []
        });
        expect(missingProviderCurrency.errors).toMatchObject({
            paymentProvider: "Payment provider is required.",
            paymentCurrency: "Payment currency is required."
        });

        const mismatchedPayment = checkoutValidation.validateCheckoutPaymentFields(createValidCheckout({
            paymentAmount: 80,
            paymentAmountInMinorUnits: 7000
        }));
        expect(mismatchedPayment.errors).toMatchObject({
            paymentAmount: "Payment amount must match the checkout total.",
            paymentAmountInMinorUnits: "Payment amount in minor units must match the payment amount."
        });
    });

    test("validates a full checkout session record", () => {
        const result = checkoutValidation.validateCheckoutSessionRecord(createValidCheckout());

        expect(result.isValid).toBe(true);
        expect(result.value).toMatchObject({
            checkoutId: "checkout-001",
            customerUid: "customer-001",
            vendorUid: "vendor-001",
            status: "draft",
            subtotal: 90,
            total: 90,
            items: [
                expect.objectContaining({
                    dietary: [],
                    allergens: []
                })
            ]
        });
    });

    test("surfaces full session record errors for broken lifecycle data", () => {
        const result = checkoutValidation.validateCheckoutSessionRecord(createValidCheckout({
            customerUid: "",
            customerName: "",
            customerEmail: "bad-email",
            vendorUid: "",
            vendorName: "",
            status: "converted",
            items: [
                {
                    menuItemId: "meal-001",
                    vendorUid: "other-vendor",
                    vendorName: "Other Vendor",
                    name: "Rice Bowl",
                    price: 45,
                    quantity: 1
                }
            ],
            subtotal: 45,
            total: 45,
            paymentAmount: 45,
            paymentAmountInMinorUnits: 4500,
            paymentReference: "ref-123",
            paymentVerifiedAt: updatedAt,
            convertedOrderId: "",
            convertedAt: null,
            createdAt: null,
            updatedAt: null,
            timeline: [
                {
                    status: "converted",
                    actorRole: "system",
                    at: updatedAt
                }
            ]
        }));

        expect(result.isValid).toBe(false);
        expect(result.errors).toMatchObject({
            customerUid: "Customer UID is required.",
            customerEmail: "Customer email must be a valid email address.",
            vendorUid: "Vendor UID is required.",
            createdAt: "Checkout createdAt is required.",
            updatedAt: "Checkout updatedAt is required.",
            convertedOrderId: "Converted checkouts must include the created order ID.",
            convertedAt: "Converted checkouts must include a conversion timestamp."
        });

        const vendorMismatch = checkoutValidation.validateCheckoutSessionRecord(createValidCheckout({
            items: [
                {
                    menuItemId: "meal-001",
                    vendorUid: "other-vendor",
                    vendorName: "Other Vendor",
                    name: "Rice Bowl",
                    price: 45,
                    quantity: 2
                }
            ]
        }));
        expect(vendorMismatch.errors["items.0.vendorUid"])
            .toBe("Each item in a checkout must belong to the same vendor as the checkout.");

        expect(checkoutValidation.validateCheckoutSessionRecord(createValidCheckout({
            status: "not-real"
        })).errors.status).toBe("Checkout status must be valid.");
    });

    test("requires timestamps for cancelled and expired checkout sessions", () => {
        const cancelled = checkoutValidation.validateCheckoutSessionRecord(createValidCheckout({
            status: "cancelled",
            cancelledAt: null,
            timeline: [
                {
                    status: "cancelled",
                    actorRole: "customer",
                    at: updatedAt
                }
            ]
        }));
        expect(cancelled.errors.cancelledAt)
            .toBe("Cancelled checkouts must include a cancellation timestamp.");

        const expired = checkoutValidation.validateCheckoutSessionRecord(createValidCheckout({
            status: "expired",
            expiredAt: null,
            timeline: [
                {
                    status: "expired",
                    actorRole: "system",
                    at: updatedAt
                }
            ]
        }));
        expect(expired.errors.expiredAt)
            .toBe("Expired checkouts must include an expiry timestamp.");
    });

    test("blocks terminal statuses when validating create checkout input", () => {
        const valid = checkoutValidation.validateCreateCheckoutInput(createValidCheckout());
        expect(valid.isValid).toBe(true);

        const terminal = checkoutValidation.validateCreateCheckoutInput(createValidCheckout({
            status: "cancelled",
            cancelledAt: updatedAt,
            timeline: [
                {
                    status: "cancelled",
                    actorRole: "customer",
                    at: updatedAt
                }
            ]
        }));
        expect(terminal.errors.status)
            .toBe("New checkout sessions cannot start in a terminal status.");
    });

    test("validates checkout status changes", () => {
        const valid = checkoutValidation.validateCheckoutStatusChange(
            "draft",
            "payment_pending",
            "customer"
        );
        expect(valid.isValid).toBe(true);
        expect(valid.transition.nextStatus).toBe("payment_pending");

        const invalid = checkoutValidation.validateCheckoutStatusChange(
            "converted",
            "draft",
            "customer"
        );
        expect(invalid.isValid).toBe(false);
        expect(invalid.errors.status).toContain("cannot transition");

        const missingHelpers = checkoutValidation.validateCheckoutStatusChange(
            "draft",
            "cancelled",
            "customer",
            { checkoutStatus: {} }
        );
        expect(missingHelpers.errors.status).toBe("Checkout status helpers are unavailable.");
        expect(missingHelpers.transition).toBeNull();
    });

    test("validates checkout cancellation readiness", () => {
        const cancellable = checkoutValidation.validateCheckoutCancellation(createValidCheckout({
            status: "payment_pending"
        }), {
            actorRole: "customer"
        });
        expect(cancellable.isValid).toBe(true);

        const missingId = checkoutValidation.validateCheckoutCancellation(createValidCheckout({
            checkoutId: ""
        }));
        expect(missingId.errors.checkoutId).toBe("Checkout ID is required before cancelling checkout.");

        const paid = checkoutValidation.validateCheckoutCancellation(createValidCheckout({
            status: "paid",
            paymentReference: "ref-123",
            paymentVerifiedAt: updatedAt
        }), {
            actorRole: "customer",
            requireCheckoutId: false
        });
        expect(paid.errors.status).toContain("cannot move a checkout");
    });

    test("validates checkout conversion readiness", () => {
        const ready = checkoutValidation.validateCheckoutConversion(createValidCheckout({
            status: "paid",
            paymentReference: "ref-123",
            paymentVerifiedAt: updatedAt
        }));
        expect(ready.isValid).toBe(true);

        const invalid = checkoutValidation.validateCheckoutConversion(createValidCheckout({
            checkoutId: "",
            status: "payment_pending"
        }), {
            requireOrderId: true
        });
        expect(invalid.errors).toMatchObject({
            paymentReference: "Payment reference is required once payment has started.",
            paymentAccessCode: "Pending payments must include a payment access code.",
            paymentAuthorizationUrl: "Pending payments must include a payment authorization URL.",
            status: "Only paid checkout sessions can be converted into orders.",
            checkoutId: "Checkout ID is required before creating an order.",
            orderId: "Order ID is required before marking checkout as converted."
        });
    });

    test("validates payment initialization and resume inputs", () => {
        const draft = checkoutValidation.validatePaymentInitializationInput(createValidCheckout());
        expect(draft.isValid).toBe(true);

        const pending = checkoutValidation.validatePaymentInitializationInput(createValidCheckout({
            status: "payment_pending",
            paymentReference: "ref-123",
            paymentAccessCode: "access-123",
            paymentAuthorizationUrl: "https://pay.example/checkout"
        }));
        expect(pending.isValid).toBe(true);

        const invalid = checkoutValidation.validatePaymentInitializationInput(createValidCheckout({
            checkoutId: "",
            status: "paid",
            paymentAmount: 0,
            paymentAmountInMinorUnits: 0,
            paymentReference: "ref-123",
            paymentVerifiedAt: updatedAt
        }));
        expect(invalid.errors).toMatchObject({
            checkoutId: "Checkout ID is required before starting payment.",
            status: "Only draft, pending, or failed checkouts can start or resume payment.",
            paymentAmount: "Payment amount must be greater than zero before starting payment."
        });
    });

    test("attaches checkout validation to a browser-like global scope", () => {
        const sourcePath = path.resolve(__dirname, "../../../public/shared/checkout/checkout-validation.js");
        const source = fs.readFileSync(sourcePath, "utf8");
        const context = {
            window: {
                checkoutStatus,
                checkoutModel
            }
        };

        vm.createContext(context);
        vm.runInContext(source, context);

        expect(context.window.checkoutValidation.MODULE_NAME).toBe("checkout-validation");
        expect(context.window.checkoutValidation.validateCheckoutStatusChange(
            "draft",
            "cancelled",
            "customer"
        ).isValid).toBe(true);
    });
});
