const payoutService = require("../../../public/shared/finance/payout-service.js");

function createMockPayoutModel(overrides = {}) {
    return {
        createPayoutId: jest.fn(() => "payout-1"),
        validatePayoutRequestInput: jest.fn((input) => ({
            isValid: true,
            value: {
                ...input,
                amount: Number(input.amount),
                currency: input.currency || "ZAR"
            },
            errors: []
        })),
        createPayoutEmailNotification: jest.fn((payout, options = {}) => ({
            notificationId: options.notificationId || `${payout.payoutId}-email`,
            recipientUid: payout.vendorUid,
            recipientRole: "vendor",
            channel: "test_email",
            type: "payout_request_submitted",
            title: "Payout request submitted",
            message: `Your payout request ${payout.payoutId} was submitted.`,
            payoutId: payout.payoutId,
            vendorUid: payout.vendorUid,
            vendorEmail: payout.vendorEmail,
            read: false,
            isRead: false,
            testMode: true,
            queuedAt: options.queuedAt || "2026-01-01T00:00:00.000Z"
        })),
        createPayoutRequestRecord: jest.fn((input, options = {}) => ({
            ...input,
            payoutId: input.payoutId || "payout-1",
            status: input.status || "pending",
            statusLabel: "Pending",
            createdAt: options.createdAt || input.createdAt,
            updatedAt: options.createdAt || input.updatedAt,
            requestedAt: input.requestedAt || options.createdAt,
            timeline: input.timeline || []
        })),
        applyPayoutStatus: jest.fn((payout, nextStatus, options = {}) => ({
            success: true,
            payout: {
                ...payout,
                status: nextStatus,
                statusLabel: nextStatus,
                updatedAt: options.updatedAt || options.timestamp,
                processedAt: options.timestamp,
                processedByUid: options.processedByUid || "",
                processedByName: options.processedByName || "",
                timeline: [
                    ...(Array.isArray(payout.timeline) ? payout.timeline : []),
                    {
                        status: nextStatus,
                        at: options.timestamp,
                        byUid: options.processedByUid || "",
                        byName: options.processedByName || ""
                    }
                ]
            },
            previousPayout: payout,
            transition: {
                from: payout.status,
                to: nextStatus
            },
            timelineEntry: {
                status: nextStatus,
                at: options.timestamp
            }
        })),
        ...overrides
    };
}

function createMockFirestoreFns() {
    return {
        collection: jest.fn((db, collectionName) => ({
            db,
            collectionName,
            kind: "collectionRef"
        })),
        doc: jest.fn((db, collectionName, docId) => ({
            db,
            collectionName,
            id: docId,
            path: `${collectionName}/${docId}`,
            kind: "docRef"
        })),
        setDoc: jest.fn(() => Promise.resolve()),
        addDoc: jest.fn(() => Promise.resolve({ id: "generated-id" })),
        updateDoc: jest.fn(() => Promise.resolve()),
        getDoc: jest.fn(() => Promise.resolve({
            id: "payout-1",
            exists: () => true,
            data: () => ({
                vendorUid: "vendor-1",
                amount: 120,
                status: "pending"
            })
        })),
        serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP")
    };
}

describe("shared/finance/payout-service.js", () => {
    const fixedTimestamp = "2026-05-21T10:00:00.000Z";

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("exports constants and simple helper functions", () => {
        expect(payoutService.MODULE_NAME).toBe("payout-service");
        expect(payoutService.PAYOUTS_COLLECTION).toBe("payoutRequests");
        expect(payoutService.NOTIFICATIONS_COLLECTION).toBe("notifications");

        expect(payoutService.normalizeText("  hello  ")).toBe("hello");
        expect(payoutService.normalizeText(null)).toBe("");
        expect(payoutService.normalizeLowerText(" APPROVED ")).toBe("approved");

        expect(payoutService.createServiceError(" payout/test ", " Test message ")).toEqual({
            code: "payout/test",
            message: "Test message"
        });

        expect(payoutService.createServiceError("", "")).toEqual({
            code: "payout/error",
            message: "Something went wrong while handling the payout request."
        });

        expect(payoutService.createServiceResult(true, { payoutId: "payout-1" })).toEqual({
            success: true,
            payoutId: "payout-1"
        });

        expect(payoutService.createServiceResult(false)).toEqual({
            success: false
        });

        expect(payoutService.createPayoutFailure("payout/bad", "Bad request", {
            payoutId: "payout-1",
            errorDetails: { field: "amount" }
        })).toEqual({
            success: false,
            payoutId: "payout-1",
            errorDetails: { field: "amount" },
            error: {
                code: "payout/bad",
                message: "Bad request",
                field: "amount"
            }
        });
    });

    test("resolves timestamps from explicit values, factories, now values, server timestamps, and fallback dates", () => {
        const firestoreFns = createMockFirestoreFns();

        expect(payoutService.resolveTimestampValue({
            timestampValue: fixedTimestamp
        })).toBe(fixedTimestamp);

        expect(payoutService.resolveTimestampValue({
            nowFactory: () => "NOW_FACTORY"
        })).toBe("NOW_FACTORY");

        expect(payoutService.resolveTimestampValue({
            now: "NOW_VALUE"
        })).toBe("NOW_VALUE");

        expect(payoutService.resolveTimestampValue({
            firestoreFns
        })).toBe("SERVER_TIMESTAMP");

        expect(firestoreFns.serverTimestamp).toHaveBeenCalledTimes(1);

        const fallback = payoutService.resolveTimestampValue({
            useServerTimestamp: false
        });

        expect(typeof fallback).toBe("string");
        expect(fallback.length).toBeGreaterThan(0);
    });

    test("creates collection and document references safely", () => {
        const db = { name: "mock-db" };
        const firestoreFns = createMockFirestoreFns();

        expect(payoutService.getPayoutsCollectionRef(db, firestoreFns)).toEqual({
            db,
            collectionName: "payoutRequests",
            kind: "collectionRef"
        });

        expect(payoutService.getPayoutDocRef(db, " payout-1 ", firestoreFns)).toEqual({
            db,
            collectionName: "payoutRequests",
            id: "payout-1",
            path: "payoutRequests/payout-1",
            kind: "docRef"
        });

        expect(payoutService.getNotificationsCollectionRef(db, firestoreFns)).toEqual({
            db,
            collectionName: "notifications",
            kind: "collectionRef"
        });

        expect(payoutService.getNotificationDocRef(db, " email-1 ", firestoreFns)).toEqual({
            db,
            collectionName: "notifications",
            id: "email-1",
            path: "notifications/email-1",
            kind: "docRef"
        });

        expect(payoutService.getPayoutsCollectionRef(null, firestoreFns)).toBeNull();
        expect(payoutService.getPayoutDocRef(db, "", firestoreFns)).toBeNull();
        expect(payoutService.getNotificationsCollectionRef(null, firestoreFns)).toBeNull();
        expect(payoutService.getNotificationDocRef(db, "", firestoreFns)).toBeNull();
    });

    test("collects payout input from direct options, payout objects, payoutValues, and withdrawals", () => {
        expect(payoutService.collectPayoutInput({
            payoutId: "payout-1",
            vendorUid: "vendor-1",
            vendorName: "Vendor One",
            vendorEmail: "vendor@example.com",
            amount: "150",
            currency: "ZAR",
            fakeBankName: "Test Bank",
            fakeAccountHolder: "Vendor One",
            fakeAccountNumber: "1234567890",
            fakeBranchCode: "250655",
            fakeAccountType: "cheque",
            note: "Please process"
        })).toMatchObject({
            payoutId: "payout-1",
            vendorUid: "vendor-1",
            vendorName: "Vendor One",
            vendorEmail: "vendor@example.com",
            amount: "150",
            currency: "ZAR",
            fakeBankName: "Test Bank",
            fakeAccountHolder: "Vendor One",
            fakeAccountNumber: "1234567890",
            fakeBranchCode: "250655",
            fakeAccountType: "cheque",
            note: "Please process"
        });

        expect(payoutService.collectPayoutInput({
            payout: {
                payoutId: "from-payout",
                vendorUid: "vendor-from-payout",
                amount: 200
            },
            payoutId: "fallback-id",
            vendorUid: "fallback-vendor"
        })).toMatchObject({
            payoutId: "from-payout",
            vendorUid: "vendor-from-payout",
            amount: 200
        });

        expect(payoutService.collectPayoutInput({
            payoutValues: {
                payoutId: "from-values",
                amount: 300
            }
        })).toMatchObject({
            payoutId: "from-values",
            amount: 300
        });

        expect(payoutService.collectPayoutInput({
            withdrawal: {
                payoutId: "from-withdrawal",
                amount: 400
            }
        })).toMatchObject({
            payoutId: "from-withdrawal",
            amount: 400
        });
    });

    test("builds payout patches using only supported fields that are present", () => {
        const patch = payoutService.buildPayoutPatch({
            payoutId: "payout-1",
            status: "approved",
            statusLabel: "Approved",
            approvedAt: fixedTimestamp,
            paidAt: undefined,
            processedByUid: "admin-1",
            processedByName: "Admin User",
            rejectionReason: "",
            testEmailQueued: true,
            emailNotificationId: "email-1",
            timeline: [{ status: "approved" }],
            updatedAt: fixedTimestamp,
            ignoredField: "do-not-copy"
        });

        expect(patch).toEqual({
            status: "approved",
            statusLabel: "Approved",
            approvedAt: fixedTimestamp,
            processedByUid: "admin-1",
            processedByName: "Admin User",
            rejectionReason: "",
            testEmailQueued: true,
            emailNotificationId: "email-1",
            timeline: [{ status: "approved" }],
            updatedAt: fixedTimestamp
        });

        expect(payoutService.buildPayoutPatch(null)).toEqual({});
    });

    test("builds notification write payload with defaults and normalized fields", () => {
        const payload = payoutService.buildNotificationWritePayload({
            notificationId: " email-1 ",
            recipientUid: " vendor-1 ",
            recipientRole: " VENDOR ",
            channel: "",
            type: "",
            title: " Payout submitted ",
            message: " Your payout was submitted ",
            payoutId: " payout-1 ",
            vendorUid: " vendor-1 ",
            vendorEmail: " VENDOR@EXAMPLE.COM ",
            read: true,
            isRead: false,
            queuedAt: "QUEUED_AT"
        }, {
            timestampValue: fixedTimestamp,
            updatedAt: "UPDATED_AT"
        });

        expect(payload).toEqual({
            notificationId: "email-1",
            recipientUid: "vendor-1",
            recipientRole: "vendor",
            channel: "test_email",
            type: "payout_request_submitted",
            title: "Payout submitted",
            message: "Your payout was submitted",
            payoutId: "payout-1",
            vendorUid: "vendor-1",
            vendorEmail: "vendor@example.com",
            read: true,
            isRead: false,
            testMode: true,
            queuedAt: "QUEUED_AT",
            createdAt: fixedTimestamp,
            updatedAt: "UPDATED_AT"
        });
    });

    test("prepares a valid payout request without persisting it", () => {
        const payoutModel = createMockPayoutModel();

        const result = payoutService.prepareCreatePayoutRequest({
            payoutModel,
            timestampValue: fixedTimestamp,
            vendorUid: "vendor-1",
            vendorName: "Vendor One",
            vendorEmail: "vendor@example.com",
            amount: "120",
            currency: "ZAR",
            fakeAccountNumber: "1234567890"
        });

        expect(result.success).toBe(true);
        expect(result.timestamp).toBe(fixedTimestamp);
        expect(result.payout).toMatchObject({
            payoutId: "payout-1",
            vendorUid: "vendor-1",
            vendorName: "Vendor One",
            vendorEmail: "vendor@example.com",
            amount: 120,
            currency: "ZAR",
            status: "pending",
            testEmailQueued: true,
            emailNotificationId: "payout-1-email"
        });
        expect(result.emailNotification).toMatchObject({
            notificationId: "payout-1-email",
            payoutId: "payout-1",
            vendorUid: "vendor-1"
        });

        expect(payoutModel.createPayoutId).toHaveBeenCalledTimes(1);
        expect(payoutModel.validatePayoutRequestInput).toHaveBeenCalledTimes(1);
        expect(payoutModel.createPayoutEmailNotification).toHaveBeenCalledTimes(1);
        expect(payoutModel.createPayoutRequestRecord).toHaveBeenCalledTimes(1);
    });

    test("prepareCreatePayoutRequest returns validation failure when model rejects input", () => {
        const payoutModel = createMockPayoutModel({
            validatePayoutRequestInput: jest.fn((input) => ({
                isValid: false,
                value: input,
                errors: [{ field: "amount", message: "Amount is required" }]
            }))
        });

        const result = payoutService.prepareCreatePayoutRequest({
            payoutModel,
            timestampValue: fixedTimestamp,
            vendorUid: "vendor-1",
            amount: ""
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("payout/invalid-request");
        expect(result.validationErrors).toEqual([
            { field: "amount", message: "Amount is required" }
        ]);
    });

    test("prepareCreatePayoutRequest can skip email notification creation", () => {
        const payoutModel = createMockPayoutModel();

        const result = payoutService.prepareCreatePayoutRequest({
            payoutModel,
            timestampValue: fixedTimestamp,
            queueEmail: false,
            vendorUid: "vendor-1",
            vendorEmail: "vendor@example.com",
            amount: 100
        });

        expect(result.success).toBe(true);
        expect(result.emailNotification).toBeNull();
        expect(result.payout.testEmailQueued).toBe(false);
        expect(result.payout.emailNotificationId).toBe("");
        expect(payoutModel.createPayoutEmailNotification).not.toHaveBeenCalled();
    });

    test("persists payout create using setDoc when document references are available", async () => {
        const db = { name: "mock-db" };
        const firestoreFns = createMockFirestoreFns();
        const payout = {
            payoutId: "payout-1",
            vendorUid: "vendor-1",
            amount: 120
        };

        const result = await payoutService.persistPayoutCreate({
            db,
            firestoreFns,
            payout
        });

        expect(result.success).toBe(true);
        expect(result.payout).toEqual(payout);
        expect(firestoreFns.doc).toHaveBeenCalledWith(db, "payoutRequests", "payout-1");
        expect(firestoreFns.setDoc).toHaveBeenCalledWith(
            expect.objectContaining({ path: "payoutRequests/payout-1" }),
            payout
        );
    });

    test("persists payout create using addDoc when setDoc is unavailable", async () => {
        const db = { name: "mock-db" };
        const firestoreFns = createMockFirestoreFns();
        delete firestoreFns.setDoc;

        const result = await payoutService.persistPayoutCreate({
            db,
            firestoreFns,
            payout: {
                payoutId: "temporary-id",
                amount: 120
            }
        });

        expect(result.success).toBe(true);
        expect(result.payout.payoutId).toBe("generated-id");
        expect(firestoreFns.collection).toHaveBeenCalledWith(db, "payoutRequests");
        expect(firestoreFns.addDoc).toHaveBeenCalledTimes(1);
    });

    test("persistPayoutCreate returns helpful failures for invalid inputs", async () => {
        expect(await payoutService.persistPayoutCreate({
            payout: null
        })).toMatchObject({
            success: false,
            error: {
                code: "payout/create-missing-record"
            }
        });

        expect(await payoutService.persistPayoutCreate({
            payout: {
                payoutId: "payout-1"
            }
        })).toMatchObject({
            success: false,
            error: {
                code: "payout/create-db-unavailable"
            }
        });

        expect(await payoutService.persistPayoutCreate({
            db: {},
            firestoreFns: {},
            payout: {
                payoutId: "payout-1"
            }
        })).toMatchObject({
            success: false,
            error: {
                code: "payout/create-write-unavailable"
            }
        });
    });

    test("persists email notification using setDoc", async () => {
        const db = { name: "mock-db" };
        const firestoreFns = createMockFirestoreFns();

        const result = await payoutService.persistPayoutEmailNotification({
            db,
            firestoreFns,
            timestampValue: fixedTimestamp,
            emailNotification: {
                notificationId: "email-1",
                recipientUid: "vendor-1",
                payoutId: "payout-1",
                vendorUid: "vendor-1",
                vendorEmail: "vendor@example.com",
                title: "Payout submitted",
                message: "Your payout was submitted"
            }
        });

        expect(result.success).toBe(true);
        expect(result.notification).toMatchObject({
            notificationId: "email-1",
            recipientUid: "vendor-1",
            payoutId: "payout-1",
            vendorEmail: "vendor@example.com",
            createdAt: fixedTimestamp,
            updatedAt: fixedTimestamp
        });
        expect(firestoreFns.doc).toHaveBeenCalledWith(db, "notifications", "email-1");
        expect(firestoreFns.setDoc).toHaveBeenCalledTimes(1);
    });

    test("persistPayoutEmailNotification skips missing notification and supports addDoc fallback", async () => {
        const skipped = await payoutService.persistPayoutEmailNotification();

        expect(skipped).toEqual({
            success: true,
            skipped: true,
            notification: null
        });

        const db = { name: "mock-db" };
        const firestoreFns = createMockFirestoreFns();
        delete firestoreFns.setDoc;

        const result = await payoutService.persistPayoutEmailNotification({
            db,
            firestoreFns,
            timestampValue: fixedTimestamp,
            emailNotification: {
                notificationId: "",
                recipientUid: "vendor-1",
                payoutId: "payout-1"
            }
        });

        expect(result.success).toBe(true);
        expect(result.notification.notificationId).toBe("generated-id");
        expect(firestoreFns.addDoc).toHaveBeenCalledTimes(1);
    });

    test("persistPayoutEmailNotification returns helpful failures", async () => {
        expect(await payoutService.persistPayoutEmailNotification({
            emailNotification: {
                notificationId: "email-1"
            }
        })).toMatchObject({
            success: false,
            error: {
                code: "payout/email-db-unavailable"
            }
        });

        expect(await payoutService.persistPayoutEmailNotification({
            db: {},
            firestoreFns: {},
            emailNotification: {
                notificationId: "email-1"
            }
        })).toMatchObject({
            success: false,
            error: {
                code: "payout/email-write-unavailable"
            }
        });
    });

    test("createPayoutRequest returns prepared result when persist is false", async () => {
        const payoutModel = createMockPayoutModel();

        const result = await payoutService.createPayoutRequest({
            payoutModel,
            persist: false,
            timestampValue: fixedTimestamp,
            vendorUid: "vendor-1",
            vendorEmail: "vendor@example.com",
            amount: 100
        });

        expect(result.success).toBe(true);
        expect(result.payout).toMatchObject({
            payoutId: "payout-1",
            vendorUid: "vendor-1",
            amount: 100
        });
    });

    test("createPayoutRequest prepares, persists payout, and queues notification", async () => {
        const payoutModel = createMockPayoutModel();
        const db = { name: "mock-db" };
        const firestoreFns = createMockFirestoreFns();

        const result = await payoutService.createPayoutRequest({
            payoutModel,
            db,
            firestoreFns,
            timestampValue: fixedTimestamp,
            vendorUid: "vendor-1",
            vendorName: "Vendor One",
            vendorEmail: "vendor@example.com",
            amount: 100
        });

        expect(result.success).toBe(true);
        expect(result.payout).toMatchObject({
            payoutId: "payout-1",
            vendorUid: "vendor-1",
            amount: 100
        });
        expect(result.emailResult.success).toBe(true);
        expect(firestoreFns.setDoc).toHaveBeenCalledTimes(2);
    });

    test("createPayoutRequest returns create failure when persistence fails", async () => {
        const payoutModel = createMockPayoutModel();

        const result = await payoutService.createPayoutRequest({
            payoutModel,
            timestampValue: fixedTimestamp,
            vendorUid: "vendor-1",
            amount: 100
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("payout/create-db-unavailable");
    });

    test("createPayoutRequest catches unexpected errors", async () => {
        const payoutModel = createMockPayoutModel({
            createPayoutId: jest.fn(() => {
                throw new Error("boom");
            })
        });

        const result = await payoutService.createPayoutRequest({
            payoutModel,
            vendorUid: "vendor-1",
            amount: 100
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("payout/create-failed");
        expect(result.error.message).toBe("boom");
    });

    test("getPayoutById supports missing IDs, custom readers, missing documents, and Firestore reads", async () => {
        expect(await payoutService.getPayoutById()).toBeNull();
        expect(await payoutService.getPayoutById({ payoutId: "   " })).toBeNull();

        const readerResult = await payoutService.getPayoutById({
            payoutId: "payout-reader",
            payoutReader: jest.fn(() => ({
                payoutId: "payout-reader",
                amount: 90
            }))
        });

        expect(readerResult).toEqual({
            payoutId: "payout-reader",
            amount: 90
        });

        const db = { name: "mock-db" };
        const firestoreFns = createMockFirestoreFns();

        const result = await payoutService.getPayoutById({
            db,
            firestoreFns,
            payoutId: "payout-1"
        });

        expect(result).toEqual({
            payoutId: "payout-1",
            vendorUid: "vendor-1",
            amount: 120,
            status: "pending"
        });

        firestoreFns.getDoc.mockResolvedValueOnce({
            id: "missing-payout",
            exists: () => false,
            data: () => ({})
        });

        expect(await payoutService.getPayoutById({
            db,
            firestoreFns,
            payoutId: "missing-payout"
        })).toBeNull();

        expect(await payoutService.getPayoutById({
            db,
            firestoreFns: {},
            payoutId: "payout-1"
        })).toBeNull();
    });

    test("persistPayoutUpdate uses updateDoc when available", async () => {
        const db = { name: "mock-db" };
        const firestoreFns = createMockFirestoreFns();

        const result = await payoutService.persistPayoutUpdate({
            db,
            firestoreFns,
            payoutId: "payout-1",
            payout: {
                payoutId: "payout-1",
                status: "approved",
                updatedAt: fixedTimestamp
            }
        });

        expect(result.success).toBe(true);
        expect(result.patch).toEqual({
            status: "approved",
            updatedAt: fixedTimestamp
        });
        expect(firestoreFns.updateDoc).toHaveBeenCalledWith(
            expect.objectContaining({ path: "payoutRequests/payout-1" }),
            {
                status: "approved",
                updatedAt: fixedTimestamp
            }
        );
    });

    test("persistPayoutUpdate uses setDoc merge fallback when updateDoc is unavailable", async () => {
        const db = { name: "mock-db" };
        const firestoreFns = createMockFirestoreFns();
        delete firestoreFns.updateDoc;

        const result = await payoutService.persistPayoutUpdate({
            db,
            firestoreFns,
            payoutId: "payout-1",
            patch: {
                status: "paid"
            },
            payout: {
                payoutId: "payout-1",
                status: "paid"
            }
        });

        expect(result.success).toBe(true);
        expect(firestoreFns.setDoc).toHaveBeenCalledWith(
            expect.objectContaining({ path: "payoutRequests/payout-1" }),
            {
                status: "paid"
            },
            { merge: true }
        );
    });

    test("persistPayoutUpdate returns failures for missing database, doc refs, and write functions", async () => {
        expect(await payoutService.persistPayoutUpdate({
            payoutId: "payout-1"
        })).toMatchObject({
            success: false,
            error: {
                code: "payout/update-unavailable"
            }
        });

        expect(await payoutService.persistPayoutUpdate({
            db: {},
            payoutId: "payout-1",
            firestoreFns: {
                doc: jest.fn(() => null)
            }
        })).toMatchObject({
            success: false,
            error: {
                code: "payout/update-doc-ref-unavailable"
            }
        });

        expect(await payoutService.persistPayoutUpdate({
            db: {},
            payoutId: "payout-1",
            firestoreFns: {
                doc: jest.fn(() => ({ id: "payout-1" }))
            }
        })).toMatchObject({
            success: false,
            error: {
                code: "payout/update-write-unavailable"
            }
        });
    });

    test("buildPayoutStatusUpdate creates status update patch", () => {
        const payoutModel = createMockPayoutModel();

        const result = payoutService.buildPayoutStatusUpdate({
            payoutId: "payout-1",
            status: "pending",
            timeline: []
        }, {
            payoutModel,
            timestampValue: fixedTimestamp,
            nextStatus: "approved",
            processedByUid: "admin-1",
            processedByName: "Admin User"
        });

        expect(result.success).toBe(true);
        expect(result.payout).toMatchObject({
            payoutId: "payout-1",
            status: "approved",
            processedAt: fixedTimestamp,
            processedByUid: "admin-1",
            processedByName: "Admin User"
        });
        expect(result.patch).toMatchObject({
            status: "approved",
            statusLabel: "approved",
            processedAt: fixedTimestamp,
            processedByUid: "admin-1",
            processedByName: "Admin User"
        });
    });

    test("buildPayoutStatusUpdate returns model failure without wrapping it", () => {
        const payoutModel = createMockPayoutModel({
            applyPayoutStatus: jest.fn(() => ({
                success: false,
                error: {
                    code: "payout/invalid-transition",
                    message: "Invalid transition"
                }
            }))
        });

        const result = payoutService.buildPayoutStatusUpdate({
            payoutId: "payout-1",
            status: "paid"
        }, {
            payoutModel,
            nextStatus: "pending"
        });

        expect(result).toEqual({
            success: false,
            error: {
                code: "payout/invalid-transition",
                message: "Invalid transition"
            }
        });
    });

    test("updatePayoutStatus returns not found when payout cannot be loaded", async () => {
        const payoutModel = createMockPayoutModel();

        const result = await payoutService.updatePayoutStatus({
            payoutModel,
            payoutId: "missing",
            payoutReader: jest.fn(() => null)
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("payout/not-found");
    });

    test("updatePayoutStatus returns update plan when persist is false", async () => {
        const payoutModel = createMockPayoutModel();

        const result = await payoutService.updatePayoutStatus({
            payoutModel,
            persist: false,
            timestampValue: fixedTimestamp,
            nextStatus: "approved",
            payout: {
                payoutId: "payout-1",
                status: "pending"
            }
        });

        expect(result.success).toBe(true);
        expect(result.payout.status).toBe("approved");
        expect(result.patch.status).toBe("approved");
    });

    test("updatePayoutStatus updates and persists payout status", async () => {
        const payoutModel = createMockPayoutModel();
        const db = { name: "mock-db" };
        const firestoreFns = createMockFirestoreFns();

        const result = await payoutService.updatePayoutStatus({
            payoutModel,
            db,
            firestoreFns,
            timestampValue: fixedTimestamp,
            nextStatus: "approved",
            processedByUid: "admin-1",
            payout: {
                payoutId: "payout-1",
                status: "pending",
                timeline: []
            }
        });

        expect(result.success).toBe(true);
        expect(result.payout.status).toBe("approved");
        expect(result.previousPayout.status).toBe("pending");
        expect(result.transition).toEqual({
            from: "pending",
            to: "approved"
        });
        expect(firestoreFns.updateDoc).toHaveBeenCalledTimes(1);
    });

    test("updatePayoutStatus returns persistence failure if update cannot be saved", async () => {
        const payoutModel = createMockPayoutModel();

        const result = await payoutService.updatePayoutStatus({
            payoutModel,
            nextStatus: "approved",
            payout: {
                payoutId: "payout-1",
                status: "pending"
            }
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("payout/update-unavailable");
    });

    test("updatePayoutStatus catches unexpected errors", async () => {
        const payoutModel = createMockPayoutModel();

        const result = await payoutService.updatePayoutStatus({
            payoutModel,
            payoutId: "payout-1",
            payoutReader: jest.fn(() => {
                throw new Error("reader exploded");
            })
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("payout/status-update-failed");
        expect(result.error.message).toBe("reader exploded");
    });
});