const fs = require("fs");
const path = require("path");
const vm = require("vm");

const checkoutService = require("../../../public/shared/checkout/checkout-service.js");
const checkoutStatus = require("../../../public/shared/checkout/checkout-status.js");
const checkoutModel = require("../../../public/shared/checkout/checkout-model.js");
const checkoutValidation = require("../../../public/shared/checkout/checkout-validation.js");

const createdAt = "2026-05-18T08:00:00.000Z";
const updatedAt = "2026-05-18T08:05:00.000Z";

function createDocSnapshot(id, data, exists = true) {
    return {
        id,
        data: jest.fn(() => data),
        exists: jest.fn(() => exists)
    };
}

function createFirestoreFns(options = {}) {
    let generatedIdCounter = 0;

    return {
        collection: jest.fn((db, ...segments) => ({
            kind: "collection",
            db,
            segments
        })),
        doc: jest.fn((...args) => {
            if (args.length === 1 && args[0] && args[0].kind === "collection") {
                generatedIdCounter += 1;

                return {
                    kind: "doc",
                    id: `generated-checkout-${generatedIdCounter}`,
                    collectionRef: args[0]
                };
            }

            const [db, ...segments] = args;

            return {
                kind: "doc",
                db,
                segments,
                id: segments[segments.length - 1]
            };
        }),
        getDoc: jest.fn(async () => {
            if (options.getDocResult !== undefined) {
                return options.getDocResult;
            }

            return createDocSnapshot("checkout-1", {});
        }),
        setDoc: options.includeSetDoc === false
            ? undefined
            : jest.fn(async () => true),
        updateDoc: options.includeUpdateDoc === true
            ? jest.fn(async () => true)
            : undefined,
        serverTimestamp: jest.fn(() => "server-time")
    };
}

function createCartItems() {
    return [
        {
            id: "burger",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            name: "Burger",
            category: "Meals",
            price: 50,
            quantity: 2
        },
        {
            id: "chips",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            name: "Chips",
            category: "Sides",
            price: 20,
            quantity: 1
        }
    ];
}

function createCustomer() {
    return {
        uid: "customer-1",
        displayName: "Tshepo",
        email: "tshepo@example.com"
    };
}

function createCheckout(overrides = {}) {
    return checkoutModel.createCheckoutSessionRecord(
        {
            checkoutId: "checkout-1",
            customerUid: "customer-1",
            customerName: "Tshepo",
            customerEmail: "tshepo@example.com",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            items: createCartItems(),
            status: "draft",
            createdAt,
            updatedAt: createdAt,
            ...overrides
        },
        { checkoutStatus }
    );
}

function fullDeps(extra = {}) {
    return {
        checkoutStatus,
        checkoutModel,
        checkoutValidation,
        ...extra
    };
}

describe("shared/checkout/checkout-service.js", () => {
    test("exports helpers, normalizers, and dependency resolvers", () => {
        expect(checkoutService.MODULE_NAME).toBe("checkout-service");
        expect(checkoutService.CHECKOUTS_COLLECTION).toBe("checkoutSessions");
        expect(checkoutService.normalizeText(" test ")).toBe("test");
        expect(checkoutService.normalizeLowerText(" PAID ")).toBe("paid");
        expect(checkoutService.normalizeUpperText(" zar ")).toBe("ZAR");
        expect(checkoutService.resolveTimelineTimestampValue({
            timelineTimestampValue: "timeline-time"
        })).toBe("timeline-time");
        expect(checkoutService.resolveCheckoutStatus(checkoutStatus)).toBe(checkoutStatus);
        expect(checkoutService.resolveCheckoutModel(checkoutModel)).toBe(checkoutModel);
        expect(checkoutService.resolveCheckoutValidation(checkoutValidation)).toBe(checkoutValidation);
        expect(checkoutService.resolveCheckoutQueries({ getCheckoutDocRef: jest.fn() })).toBeDefined();
        expect(checkoutService.resolveCheckoutStatus({})).toBeNull();
        expect(checkoutService.resolveCheckoutModel({})).toBeNull();
        expect(checkoutService.resolveCheckoutValidation({})).toBeNull();
        expect(checkoutService.resolveCheckoutQueries({})).toBeNull();
        expect(checkoutService.resolveCheckoutStatus()).toEqual(checkoutStatus);
        expect(checkoutService.resolveCheckoutModel()).toEqual(checkoutModel);
        expect(checkoutService.resolveCheckoutValidation()).toEqual(checkoutValidation);
        expect(checkoutService.resolveCheckoutQueries()).toEqual(expect.objectContaining({
            MODULE_NAME: "checkout-queries"
        }));
    });

    test("resolves dependencies from globals and returns null when require cannot load them", () => {
        const originalStatus = global.checkoutStatus;
        const originalModel = global.checkoutModel;
        const originalValidation = global.checkoutValidation;
        const originalQueries = global.checkoutQueries;

        global.checkoutStatus = checkoutStatus;
        global.checkoutModel = checkoutModel;
        global.checkoutValidation = checkoutValidation;
        global.checkoutQueries = { fetchCheckoutById: jest.fn() };

        expect(checkoutService.getCheckoutDependencies()).toEqual({
            checkoutStatus,
            checkoutModel,
            checkoutValidation,
            checkoutQueries: global.checkoutQueries
        });

        const sourcePath = path.resolve(__dirname, "../../../public/shared/checkout/checkout-service.js");
        const context = {
            window: {},
            require: () => {
                throw new Error("missing");
            }
        };

        vm.createContext(context);
        vm.runInContext(fs.readFileSync(sourcePath, "utf8"), context);
        expect(context.window.checkoutService.resolveCheckoutStatus()).toBeNull();
        expect(context.window.checkoutService.resolveCheckoutModel()).toBeNull();
        expect(context.window.checkoutService.resolveCheckoutValidation()).toBeNull();
        expect(context.window.checkoutService.resolveCheckoutQueries()).toBeNull();

        global.checkoutStatus = originalStatus;
        global.checkoutModel = originalModel;
        global.checkoutValidation = originalValidation;
        global.checkoutQueries = originalQueries;
    });

    test("creates service results, failures, timestamps, checkout ids, and payment references", () => {
        const firestoreFns = createFirestoreFns();
        const db = { name: "db" };

        expect(checkoutService.createServiceError(" checkout/test ", " Broken ", {
            detail: "extra"
        })).toEqual({
            code: "checkout/test",
            message: "Broken",
            detail: "extra"
        });
        expect(checkoutService.createServiceResult(true, { checkoutId: "c-1" })).toEqual({
            success: true,
            checkoutId: "c-1"
        });
        expect(checkoutService.createCheckoutFailure("checkout/bad", "Bad")).toEqual({
            success: false,
            error: {
                code: "checkout/bad",
                message: "Bad"
            }
        });
        expect(checkoutService.resolveTimestampValue({ timestampValue: "manual-time" })).toBe("manual-time");
        expect(checkoutService.resolveTimestampValue({ nowFactory: () => "factory-time" })).toBe("factory-time");
        expect(checkoutService.resolveTimestampValue({ now: "now-time", useServerTimestamp: false })).toBe("now-time");
        expect(checkoutService.resolveTimestampValue({ firestoreFns })).toBe("server-time");
        expect(checkoutService.resolveTimestampValue({ useServerTimestamp: false })).toMatch(/^\d{4}-\d{2}-\d{2}T/);

        expect(checkoutService.createCheckoutId({ checkoutId: " checkout-explicit " })).toBe("checkout-explicit");
        expect(checkoutService.createCheckoutId({ checkoutIdFactory: () => "factory-checkout" })).toBe("factory-checkout");
        expect(checkoutService.createCheckoutId({ db, firestoreFns })).toBe("generated-checkout-1");
        expect(checkoutService.createCheckoutId({
            timestampSeed: "T 1",
            firestoreFns: {
                doc: jest.fn(() => {
                    throw new Error("no id");
                })
            }
        })).toBe("checkout-t1");

        expect(checkoutService.createPaymentReference({
            checkoutId: "checkout-1",
            paymentReference: " existing "
        })).toBe("existing");
        expect(checkoutService.createPaymentReference({}, {
            paymentReferenceFactory: () => "factory-ref"
        })).toBe("factory-ref");
        expect(checkoutService.createPaymentReference({
            checkoutId: "checkout-1"
        }, {
            timestampSeed: "T 2"
        })).toBe("checkout-checkout-1-t2");
        expect(checkoutService.createPaymentReference({}, { timestampSeed: "T 3" }))
            .toBe("checkout-payment-t3");
    });

    test("creates checkout document and collection refs through query helpers or fallbacks", () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns();
        const checkoutQueries = {
            getCheckoutDocRef: jest.fn(() => ({ via: "query-doc" })),
            getCheckoutsCollectionRef: jest.fn(() => ({ via: "query-collection" }))
        };

        expect(checkoutService.getCheckoutDocRef(db, " checkout-1 ", firestoreFns, checkoutQueries))
            .toEqual({ via: "query-doc" });
        expect(checkoutService.getCheckoutsCollectionRef(db, firestoreFns, checkoutQueries))
            .toEqual({ via: "query-collection" });
        expect(checkoutQueries.getCheckoutDocRef).toHaveBeenCalledWith(db, "checkout-1", firestoreFns);

        expect(checkoutService.getCheckoutDocRef(db, "checkout-2", firestoreFns)).toEqual({
            kind: "doc",
            db,
            segments: ["checkoutSessions", "checkout-2"],
            id: "checkout-2"
        });
        expect(checkoutService.getCheckoutsCollectionRef(db, firestoreFns)).toEqual({
            kind: "collection",
            db,
            segments: ["checkoutSessions"]
        });
        expect(checkoutService.getCheckoutDocRef(null, "checkout-2", firestoreFns)).toBeNull();
        expect(checkoutService.getCheckoutsCollectionRef(null, firestoreFns)).toBeNull();
    });

    test("builds checkout write payloads, patches, and timeline entries", () => {
        const checkout = createCheckout();
        const timelineEntry = checkoutService.createTimelineEntry("payment_pending", {
            ...fullDeps(),
            actorRole: "customer",
            actorUid: "customer-1",
            note: "Starting payment",
            timestampValue: updatedAt
        });
        const timelineUpdate = checkoutService.appendTimelineEntry(checkout, "payment_pending", {
            ...fullDeps(),
            actorRole: "customer",
            timestampValue: updatedAt
        });
        const updated = checkoutService.buildCheckoutWritePayload(checkout, {
            ...fullDeps(),
            status: "payment_pending",
            paymentReference: "ref-1",
            paymentAccessCode: "access-1",
            paymentAuthorizationUrl: "https://pay.example",
            timeline: timelineUpdate.timeline,
            updatedAt
        });

        expect(timelineEntry).toMatchObject({
            status: "payment_pending",
            actorRole: "customer",
            actorUid: "customer-1",
            note: "Starting payment",
            at: updatedAt
        });
        expect(timelineUpdate.timeline).toHaveLength(2);
        expect(updated).toEqual(expect.objectContaining({
            checkoutId: "checkout-1",
            status: "payment_pending",
            paymentReference: "ref-1",
            paymentAccessCode: "access-1",
            paymentAuthorizationUrl: "https://pay.example",
            updatedAt
        }));

        expect(checkoutService.buildCheckoutPatch(updated, { includeMetadata: true }))
            .toEqual(expect.objectContaining({
                checkoutId: "checkout-1",
                status: "payment_pending",
                paymentReference: "ref-1",
                timeline: updated.timeline,
                metadata: {}
            }));

        expect(checkoutService.buildCheckoutWritePayload({
            checkoutId: "raw-checkout",
            status: "DRAFT",
            paymentProvider: " PAYSTACK ",
            paymentCurrency: " zar ",
            timeline: [{ status: "draft" }],
            metadata: { source: "test" }
        }, {
            checkoutModel: {},
            status: "PAYMENT_PENDING",
            updatedAt
        })).toEqual(expect.objectContaining({
            checkoutId: "raw-checkout",
            status: "payment_pending",
            paymentProvider: "paystack",
            paymentCurrency: "ZAR",
            timeline: [{ status: "draft" }],
            metadata: { source: "test" },
            updatedAt
        }));

        expect(checkoutService.createTimelineEntry("draft", {
            checkoutStatus: {},
            checkoutModel: {},
            actorRole: " customer ",
            actorUid: " customer-1 ",
            actorName: " Tshepo ",
            note: " raw note ",
            at: "manual-at"
        })).toEqual({
            status: "draft",
            label: "draft",
            actorRole: "customer",
            actorUid: "customer-1",
            actorName: "Tshepo",
            note: "raw note",
            at: "manual-at"
        });
    });

    test("validates external payment verification details", () => {
        const checkout = createCheckout({
            status: "payment_pending",
            paymentReference: "ref-1",
            paymentAccessCode: "access-1",
            paymentAuthorizationUrl: "https://pay.example"
        });

        expect(checkoutService.validatePaymentVerification(checkout, {
            status: "success",
            reference: "ref-1",
            amount: 12000,
            currency: "ZAR"
        })).toEqual({
            isValid: true,
            errors: {},
            value: {
                status: "success",
                reference: "ref-1",
                amountInMinorUnits: 12000,
                currency: "ZAR"
            }
        });

        expect(checkoutService.validatePaymentVerification(checkout, {
            status: "failed",
            reference: "wrong-ref",
            amount: 100,
            currency: "USD"
        }).errors).toEqual({
            status: "Payment verification must be successful before checkout can be marked paid.",
            reference: "Verified payment reference does not match the checkout payment reference.",
            amount: "Verified payment amount does not match the checkout payment amount.",
            currency: "Verified payment currency does not match the checkout payment currency."
        });
        expect(checkoutService.validatePaymentVerification(checkout, {
            status: "success"
        }).errors.reference).toBe("Verified payment reference is required.");
    });

    test("prepares checkout creation from cart and rejects invalid create inputs", () => {
        const result = checkoutService.prepareCreateCheckout({
            ...fullDeps(),
            cartItems: createCartItems(),
            customer: createCustomer(),
            checkoutId: "checkout-cart",
            timestampValue: createdAt
        });

        expect(result.success).toBe(true);
        expect(result.checkout).toEqual(expect.objectContaining({
            checkoutId: "checkout-cart",
            customerUid: "customer-1",
            vendorUid: "vendor-1",
            status: "draft",
            subtotal: 120,
            total: 120,
            createdAt
        }));

        const invalid = checkoutService.prepareCreateCheckout({
            ...fullDeps(),
            checkoutId: "bad-checkout",
            checkout: {
                items: [],
                customerUid: "",
                vendorUid: "",
                status: "converted"
            },
            timestampValue: createdAt
        });
        expect(invalid.success).toBe(false);
        expect(invalid.error.code).toBe("checkout/validation-failed");

        expect(checkoutService.prepareCreateCheckout({
            checkoutModel: {},
            checkoutValidation: {}
        }).error.code).toBe("checkout/dependencies-missing");
    });

    test("keeps serverTimestamp values out of checkout timeline arrays", () => {
        const serverTimestampValue = {
            kind: "serverTimestamp"
        };
        const firestoreFns = createFirestoreFns();
        firestoreFns.serverTimestamp = jest.fn(() => serverTimestampValue);

        const createResult = checkoutService.prepareCreateCheckout({
            ...fullDeps(),
            cartItems: createCartItems(),
            customer: createCustomer(),
            checkoutId: "checkout-server-time",
            firestoreFns,
            timelineTimestampValue: "timeline-time"
        });

        expect(createResult.success).toBe(true);
        expect(createResult.checkout.createdAt).toBe(serverTimestampValue);
        expect(createResult.checkout.updatedAt).toBe(serverTimestampValue);
        expect(createResult.checkout.timeline[0].at).toBe("timeline-time");

        const initResult = checkoutService.preparePaymentInitialization(createResult.checkout, {
            ...fullDeps(),
            firestoreFns,
            timelineTimestampValue: "timeline-payment-time"
        });

        expect(initResult.success).toBe(true);
        expect(initResult.checkout.updatedAt).toBe(serverTimestampValue);
        expect(initResult.timelineEntry.at).toBe("timeline-payment-time");
        expect(initResult.patch.timeline[initResult.patch.timeline.length - 1].at)
            .toBe("timeline-payment-time");
    });

    test("prepares payment initialization payloads and rejects invalid initialization", () => {
        const result = checkoutService.preparePaymentInitialization(createCheckout(), {
            ...fullDeps(),
            paymentReferenceFactory: () => "ref-1",
            callbackUrl: "https://example.test/callback",
            timestampValue: updatedAt,
            actorUid: "customer-1"
        });

        expect(result.success).toBe(true);
        expect(result.checkout).toEqual(expect.objectContaining({
            status: "payment_pending",
            paymentReference: "ref-1",
            paymentAmount: 120,
            paymentAmountInMinorUnits: 12000,
            updatedAt
        }));
        expect(result.payload).toEqual({
            email: "tshepo@example.com",
            amount: 12000,
            currency: "ZAR",
            reference: "ref-1",
            callback_url: "https://example.test/callback",
            metadata: {
                checkoutId: "checkout-1",
                customerUid: "customer-1",
                vendorUid: "vendor-1",
                provider: "paystack"
            }
        });
        expect(result.patch.status).toBe("payment_pending");

        const invalid = checkoutService.preparePaymentInitialization(createCheckout({
            status: "paid",
            paymentReference: "ref-1",
            paymentVerifiedAt: updatedAt
        }), fullDeps());
        expect(invalid.success).toBe(false);
        expect(invalid.error.code).toBe("checkout/invalid-payment-initialization");

        expect(checkoutService.preparePaymentInitialization(createCheckout(), {
            checkoutStatus: {},
            checkoutModel: {},
            checkoutValidation: {}
        }).error.code).toBe("checkout/dependencies-missing");
    });

    test("applies initialized, failed, and verified payment states", () => {
        const initialized = checkoutService.applyInitializedPayment(createCheckout({
            status: "payment_pending",
            paymentReference: "ref-1"
        }), {
            access_code: "access-1",
            authorization_url: "https://pay.example"
        }, {
            ...fullDeps(),
            timestampValue: updatedAt
        });
        expect(initialized.success).toBe(true);
        expect(initialized.checkout).toEqual(expect.objectContaining({
            status: "payment_pending",
            paymentReference: "ref-1",
            paymentAccessCode: "access-1",
            paymentAuthorizationUrl: "https://pay.example"
        }));

        const failed = checkoutService.applyFailedPayment(initialized.checkout, {
            reason: "card declined"
        }, {
            ...fullDeps(),
            failedAt: "failed-at"
        });
        expect(failed.success).toBe(true);
        expect(failed.checkout).toEqual(expect.objectContaining({
            status: "payment_failed",
            paymentFailedAt: "failed-at",
            paymentFailureReason: "card declined"
        }));

        const verified = checkoutService.applyVerifiedPayment(initialized.checkout, {
            status: "success",
            reference: "ref-1",
            amount: 12000,
            currency: "ZAR"
        }, {
            ...fullDeps(),
            timestampValue: "verified-at"
        });
        expect(verified.success).toBe(true);
        expect(verified.checkout).toEqual(expect.objectContaining({
            status: "paid",
            paymentPaidAt: "verified-at",
            paymentVerifiedAt: "verified-at",
            paymentFailureReason: ""
        }));
        expect(verified.verification.reference).toBe("ref-1");

        const mismatch = checkoutService.applyVerifiedPayment(initialized.checkout, {
            status: "failed",
            reference: "wrong",
            amount: 1,
            currency: "USD"
        }, {
            ...fullDeps(),
            timestampValue: "failed-at"
        });
        expect(mismatch.success).toBe(false);
        expect(mismatch.error.code).toBe("checkout/payment-verification-mismatch");
        expect(mismatch.checkout.status).toBe("payment_failed");
    });

    test("builds status, cancellation, expiry, and conversion plans", () => {
        const paymentPending = createCheckout({
            status: "payment_pending",
            paymentReference: "ref-1",
            paymentAccessCode: "access-1",
            paymentAuthorizationUrl: "https://pay.example"
        });
        const statusPlan = checkoutService.buildCheckoutStatusUpdate(createCheckout(), {
            ...fullDeps(),
            nextStatus: "payment_pending",
            actorRole: "customer",
            timestampValue: updatedAt
        });
        expect(statusPlan.success).toBe(true);
        expect(statusPlan.checkout.status).toBe("payment_pending");
        expect(statusPlan.statusChanged).toBe(true);

        const cancelPlan = checkoutService.buildCheckoutCancellation(paymentPending, {
            ...fullDeps(),
            actorRole: "customer",
            cancelledAt: "cancelled-at"
        });
        expect(cancelPlan.success).toBe(true);
        expect(cancelPlan.checkout).toEqual(expect.objectContaining({
            status: "cancelled",
            cancelledAt: "cancelled-at"
        }));

        const expiryPlan = checkoutService.buildCheckoutExpiry(createCheckout(), {
            ...fullDeps(),
            expiredAt: "expired-at"
        });
        expect(expiryPlan.success).toBe(true);
        expect(expiryPlan.checkout).toEqual(expect.objectContaining({
            status: "expired",
            expiredAt: "expired-at"
        }));

        const conversionPlan = checkoutService.buildCheckoutConversion(createCheckout({
            status: "paid",
            paymentReference: "ref-1",
            paymentVerifiedAt: "verified-at",
            paymentPaidAt: "verified-at"
        }), {
            ...fullDeps(),
            orderId: "order-1",
            convertedAt: "converted-at"
        });
        expect(conversionPlan.success).toBe(true);
        expect(conversionPlan.checkout).toEqual(expect.objectContaining({
            status: "converted",
            convertedOrderId: "order-1",
            convertedAt: "converted-at"
        }));
        expect(conversionPlan.order).toEqual(expect.objectContaining({
            orderId: "order-1",
            checkoutId: "checkout-1",
            paymentStatus: "paid"
        }));

        expect(checkoutService.buildCheckoutStatusUpdate(createCheckout(), {
            ...fullDeps(),
            nextStatus: "paid",
            actorRole: "customer"
        }).error.code).toBe("checkout/invalid-status-change");
        expect(checkoutService.buildCheckoutCancellation(createCheckout({
            status: "paid",
            paymentReference: "ref-1",
            paymentVerifiedAt: "verified-at"
        }), fullDeps()).error.code).toBe("checkout/cancel-not-allowed");
        expect(checkoutService.buildCheckoutConversion(createCheckout(), fullDeps()).error.code)
            .toBe("checkout/conversion-not-allowed");
        expect(checkoutService.buildCheckoutStatusUpdate(createCheckout(), {
            checkoutModel: {},
            checkoutStatus: {},
            checkoutValidation: {}
        }).error.code).toBe("checkout/dependencies-missing");
        expect(checkoutService.buildCheckoutCancellation(createCheckout(), {
            checkoutModel: {},
            checkoutStatus: {},
            checkoutValidation: {}
        }).error.code).toBe("checkout/dependencies-missing");
        expect(checkoutService.buildCheckoutExpiry(createCheckout({
            status: "converted"
        }), fullDeps()).success).toBe(false);
        expect(checkoutService.buildCheckoutConversion(createCheckout(), {
            checkoutModel: {},
            checkoutStatus: {},
            checkoutValidation: {}
        }).error.code).toBe("checkout/dependencies-missing");
    });

    test("fetches checkouts by query helper or Firestore fallback", async () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns({
            getDocResult: createDocSnapshot("checkout-2", {
                customerUid: "customer-1"
            })
        });
        const queryHelper = {
            fetchCheckoutById: jest.fn(async options => ({
                checkoutId: options.checkoutId,
                from: "query"
            }))
        };

        await expect(checkoutService.getCheckoutById({
            checkoutId: "checkout-query",
            checkoutQueries: queryHelper
        })).resolves.toEqual({
            checkoutId: "checkout-query",
            from: "query"
        });
        await expect(checkoutService.getCheckoutById({
            db,
            firestoreFns,
            checkoutId: "checkout-2"
        })).resolves.toEqual(expect.objectContaining({
            checkoutId: "checkout-2",
            customerUid: "customer-1"
        }));
        await expect(checkoutService.getCheckoutById({
            db,
            firestoreFns: createFirestoreFns({
                getDocResult: createDocSnapshot("missing", {}, false)
            }),
            checkoutId: "missing"
        })).resolves.toBeNull();
        await expect(checkoutService.getCheckoutById({ checkoutId: "" })).resolves.toBeNull();
    });

    test("persists checkout creates and updates with setDoc or updateDoc", async () => {
        const db = { name: "db" };
        const checkout = createCheckout();
        const setFns = createFirestoreFns();
        const createResult = await checkoutService.persistCheckoutCreate({
            db,
            firestoreFns: setFns,
            checkout
        });
        expect(createResult.success).toBe(true);
        expect(setFns.setDoc).toHaveBeenCalledWith({
            kind: "doc",
            db,
            segments: ["checkoutSessions", "checkout-1"],
            id: "checkout-1"
        }, checkout);

        const updateSetFns = createFirestoreFns();
        const updateSetResult = await checkoutService.persistCheckoutUpdate({
            db,
            firestoreFns: updateSetFns,
            checkout
        });
        expect(updateSetResult.success).toBe(true);
        expect(updateSetFns.setDoc).toHaveBeenCalledWith(
            expect.objectContaining({ id: "checkout-1" }),
            expect.objectContaining({ checkoutId: "checkout-1" }),
            { merge: true }
        );

        const updateDocFns = createFirestoreFns({
            includeSetDoc: false,
            includeUpdateDoc: true
        });
        const updateDocResult = await checkoutService.persistCheckoutUpdate({
            db,
            firestoreFns: updateDocFns,
            checkout,
            patch: { status: "draft" }
        });
        expect(updateDocResult.success).toBe(true);
        expect(updateDocFns.updateDoc).toHaveBeenCalledWith(
            expect.objectContaining({ id: "checkout-1" }),
            { status: "draft" }
        );

        await expect(checkoutService.persistCheckoutCreate({
            db,
            firestoreFns: {},
            checkout
        })).resolves.toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({ code: "checkout/create-unavailable" })
        }));
        await expect(checkoutService.persistCheckoutCreate({
            db,
            firestoreFns: {
                setDoc: jest.fn(async () => true)
            },
            checkout
        })).resolves.toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({ code: "checkout/doc-ref-unavailable" })
        }));
        await expect(checkoutService.persistCheckoutUpdate({
            db,
            firestoreFns: createFirestoreFns(),
            checkout: null
        })).resolves.toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({ code: "checkout/update-unavailable" })
        }));
        await expect(checkoutService.persistCheckoutUpdate({
            db,
            firestoreFns: {},
            checkout
        })).resolves.toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({ code: "checkout/doc-ref-unavailable" })
        }));
        await expect(checkoutService.persistCheckoutUpdate({
            db,
            firestoreFns: {
                doc: jest.fn(() => ({ id: "checkout-1" }))
            },
            checkout
        })).resolves.toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({ code: "checkout/update-write-unavailable" })
        }));
    });

    test("runs async create, initialize, cancel, expire, and conversion workflows", async () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns();
        const checkout = createCheckout();

        const createResult = await checkoutService.createCheckout({
            ...fullDeps(),
            db,
            firestoreFns,
            cartItems: createCartItems(),
            customer: createCustomer(),
            checkoutId: "checkout-created",
            timestampValue: createdAt
        });
        expect(createResult.success).toBe(true);
        expect(firestoreFns.setDoc).toHaveBeenCalledTimes(1);

        const createWithoutPersist = await checkoutService.createCheckout({
            ...fullDeps(),
            cartItems: createCartItems(),
            customer: createCustomer(),
            checkoutId: "checkout-no-persist",
            timestampValue: createdAt,
            persist: false
        });
        expect(createWithoutPersist.success).toBe(true);
        expect(createWithoutPersist.docRef).toBeUndefined();

        const createInvalid = await checkoutService.createCheckout({
            ...fullDeps(),
            checkout: {
                items: [],
                status: "converted"
            },
            checkoutId: "checkout-invalid",
            persist: false
        });
        expect(createInvalid.error.code).toBe("checkout/validation-failed");

        const initializeResult = await checkoutService.initializeCheckoutPayment({
            ...fullDeps(),
            db,
            firestoreFns,
            checkout,
            paymentReferenceFactory: () => "ref-1",
            timestampValue: updatedAt,
            persist: false
        });
        expect(initializeResult.success).toBe(true);
        expect(initializeResult.payload.reference).toBe("ref-1");

        const initializePersistedFns = createFirestoreFns();
        const initializePersisted = await checkoutService.initializeCheckoutPayment({
            ...fullDeps(),
            db,
            firestoreFns: initializePersistedFns,
            checkout,
            paymentReferenceFactory: () => "ref-2",
            timestampValue: updatedAt
        });
        expect(initializePersisted.success).toBe(true);
        expect(initializePersistedFns.setDoc).toHaveBeenCalledTimes(1);

        const initializePersistFailure = await checkoutService.initializeCheckoutPayment({
            ...fullDeps(),
            db,
            firestoreFns: {
                doc: jest.fn(() => ({ id: "checkout-1" }))
            },
            checkout,
            paymentReferenceFactory: () => "ref-3",
            timestampValue: updatedAt
        });
        expect(initializePersistFailure.error.code).toBe("checkout/update-write-unavailable");

        const cancelResult = await checkoutService.cancelCheckout({
            ...fullDeps(),
            checkout,
            cancelledAt: "cancelled-at",
            persist: false
        });
        expect(cancelResult.success).toBe(true);
        expect(cancelResult.checkout.status).toBe("cancelled");

        const expireResult = await checkoutService.expireCheckout({
            ...fullDeps(),
            checkout,
            expiredAt: "expired-at",
            persist: false
        });
        expect(expireResult.success).toBe(true);
        expect(expireResult.checkout.status).toBe("expired");

        const convertResult = await checkoutService.convertCheckoutToOrder({
            ...fullDeps(),
            checkout: createCheckout({
                status: "paid",
                paymentReference: "ref-1",
                paymentVerifiedAt: "verified-at",
                paymentPaidAt: "verified-at"
            }),
            orderId: "order-1",
            convertedAt: "converted-at",
            persist: false
        });
        expect(convertResult.success).toBe(true);
        expect(convertResult.order.orderId).toBe("order-1");

        await expect(checkoutService.initializeCheckoutPayment({
            ...fullDeps(),
            checkoutId: "missing"
        })).resolves.toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({ code: "checkout/not-found" })
        }));

        await expect(checkoutService.cancelCheckout({
            ...fullDeps(),
            checkoutId: "missing"
        })).resolves.toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({ code: "checkout/not-found" })
        }));
        await expect(checkoutService.expireCheckout({
            ...fullDeps(),
            checkoutId: "missing"
        })).resolves.toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({ code: "checkout/not-found" })
        }));
        await expect(checkoutService.convertCheckoutToOrder({
            ...fullDeps(),
            checkoutId: "missing"
        })).resolves.toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({ code: "checkout/not-found" })
        }));
    });

    test("covers dependency and persistence failure branches for payment state helpers", async () => {
        expect(checkoutService.applyInitializedPayment(createCheckout(), {}, {
            checkoutModel: {},
            checkoutStatus: {}
        }).error.code).toBe("checkout/dependencies-missing");
        expect(checkoutService.applyFailedPayment(createCheckout(), {}, {
            checkoutModel: {},
            checkoutStatus: {}
        }).error.code).toBe("checkout/dependencies-missing");
        expect(checkoutService.applyVerifiedPayment(createCheckout(), {}, {
            checkoutModel: {},
            checkoutStatus: {}
        }).error.code).toBe("checkout/dependencies-missing");

        const plan = checkoutService.buildCheckoutCancellation(createCheckout(), {
            ...fullDeps(),
            timestampValue: updatedAt
        });
        const persistedPlan = await checkoutService.updateCheckoutWithPlan(plan, {
            db: { name: "db" },
            firestoreFns: createFirestoreFns(),
            checkoutStatus,
            checkoutModel,
            checkoutValidation
        });
        expect(persistedPlan.success).toBe(true);
        expect(persistedPlan.docRef).toEqual(expect.objectContaining({ id: "checkout-1" }));

        const failedPersistPlan = await checkoutService.updateCheckoutWithPlan(plan, {
            db: { name: "db" },
            firestoreFns: {
                doc: jest.fn(() => ({ id: "checkout-1" }))
            }
        });
        expect(failedPersistPlan.error.code).toBe("checkout/update-write-unavailable");

        const noWritePlan = await checkoutService.updateCheckoutWithPlan({
            success: true,
            needsWrite: false,
            checkout: createCheckout()
        });
        expect(noWritePlan.needsWrite).toBe(false);
    });

    test("returns caught errors in async workflows", async () => {
        const throwingQueries = {
            fetchCheckoutById: jest.fn(async () => {
                throw new Error("network down");
            })
        };

        await expect(checkoutService.createCheckout({
            ...fullDeps(),
            cartItems: createCartItems(),
            customer: createCustomer(),
            db: { name: "db" },
            firestoreFns: {
                setDoc: jest.fn(async () => {
                    throw new Error("write failed");
                }),
                doc: jest.fn(() => ({ id: "checkout-1" }))
            }
        })).resolves.toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({
                code: "checkout/create-failed",
                message: "write failed"
            })
        }));

        await expect(checkoutService.initializeCheckoutPayment({
            checkoutQueries: throwingQueries,
            checkoutId: "checkout-1"
        })).resolves.toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({ code: "checkout/payment-initialization-failed" })
        }));
        await expect(checkoutService.cancelCheckout({
            checkoutQueries: throwingQueries,
            checkoutId: "checkout-1"
        })).resolves.toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({ code: "checkout/cancel-failed" })
        }));
        await expect(checkoutService.expireCheckout({
            checkoutQueries: throwingQueries,
            checkoutId: "checkout-1"
        })).resolves.toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({ code: "checkout/expire-failed" })
        }));
        await expect(checkoutService.convertCheckoutToOrder({
            checkoutQueries: throwingQueries,
            checkoutId: "checkout-1"
        })).resolves.toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({ code: "checkout/conversion-failed" })
        }));
    });

    test("attaches checkout service to a browser-like global scope", () => {
        const sourcePath = path.resolve(__dirname, "../../../public/shared/checkout/checkout-service.js");
        const context = {
            window: {
                checkoutStatus,
                checkoutModel,
                checkoutValidation
            }
        };

        vm.createContext(context);
        vm.runInContext(fs.readFileSync(sourcePath, "utf8"), context);

        expect(context.window.checkoutService.MODULE_NAME).toBe("checkout-service");
        expect(context.window.checkoutService.prepareCreateCheckout({
            cartItems: createCartItems(),
            customer: createCustomer(),
            checkoutId: "browser-checkout",
            timestampValue: createdAt
        }).success).toBe(true);
    });
});
