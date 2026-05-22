const supportRefund = require("../../../functions/support/resolve-support-refund.js");

function createApprovedRefundCase(overrides = {}) {
    return {
        ticketId: "ticket-1",
        orderId: "order-1",
        customerUid: "customer-1",
        vendorUid: "vendor-1",
        status: "approved",
        statusLabel: "Approved",
        type: "partial",
        amount: 55,
        amountInMinorUnits: 5500,
        currency: "ZAR",
        reason: "Food quality issue",
        customerDecision: "approved",
        vendorDecision: "approved",
        impact: {
            vendorDeduction: 50,
            platformDeduction: 5
        },
        ...overrides
    };
}

function createTicket(overrides = {}) {
    return {
        ticketId: "ticket-1",
        orderId: "order-1",
        customerUid: "customer-1",
        vendorUid: "vendor-1",
        refundCase: createApprovedRefundCase(),
        ...overrides
    };
}

function createOrder(overrides = {}) {
    return {
        orderId: "order-1",
        customerUid: "customer-1",
        vendorUid: "vendor-1",
        paymentStatus: "paid",
        paymentReference: "paystack-ref-1",
        paymentAmount: 110,
        paymentAmountInMinorUnits: 11000,
        paymentCurrency: "ZAR",
        ...overrides
    };
}

describe("functions/support/resolve-support-refund.js", () => {
    test("exports the support refund callable surface", () => {
        expect(supportRefund.SUPPORT_TICKETS_COLLECTION).toBe("supportTickets");
        expect(supportRefund.ORDERS_COLLECTION).toBe("orders");
        expect(supportRefund.USERS_COLLECTION).toBe("users");

        [
            "createAdminFirestoreFns",
            "snapshotToRecord",
            "fetchAdminDocument",
            "fetchUserRecord",
            "isCallableAdmin",
            "fetchSupportTicket",
            "fetchOrderRecord",
            "getRefundCaseFromTicket",
            "buildSupportRefundPaymentOptions",
            "buildSupportRefundOrderPatch",
            "createSupportRefundFailure",
            "executeApprovedSupportRefund",
            "defaultWriteOrderPaymentPatch",
            "assertSuccessfulSupportRefundResult",
            "createExecuteSupportRefundHandler"
        ].forEach((name) => expect(typeof supportRefund[name]).toBe("function"));
    });

    test("normalizes callable data, auth, snapshots, and refund helper payloads", () => {
        expect(supportRefund.normalizeCallableData({ data: { ticketId: "ticket-1" } }))
            .toEqual({ ticketId: "ticket-1" });
        expect(supportRefund.normalizeCallableData({ data: null })).toEqual({});
        expect(supportRefund.normalizeAuthContext({
            auth: {
                uid: "admin-1",
                token: {
                    email: "admin@example.com"
                }
            }
        })).toEqual({
            uid: "admin-1",
            token: {
                email: "admin@example.com"
            }
        });
        expect(supportRefund.snapshotToRecord({
            id: "doc-1",
            data: () => ({ value: 1 })
        })).toEqual({
            id: "doc-1",
            value: 1
        });

        const ticket = createTicket();
        const order = createOrder();
        expect(supportRefund.getRefundCaseFromTicket(ticket)).toEqual(ticket.refundCase);
        expect(supportRefund.buildSupportRefundPaymentOptions(ticket, order, {
            actorUid: "admin-1",
            timestampValue: "server-time"
        })).toEqual(expect.objectContaining({
            reference: "paystack-ref-1",
            paymentReference: "paystack-ref-1",
            refundAmount: 55,
            refundAmountInMinorUnits: 5500,
            reason: "Food quality issue",
            actorUid: "admin-1",
            timestampValue: "server-time",
            metadata: expect.objectContaining({
                ticketId: "ticket-1",
                orderId: "order-1",
                customerUid: "customer-1",
                vendorUid: "vendor-1",
                refundCaseStatus: "approved"
            })
        }));

        expect(supportRefund.buildSupportRefundOrderPatch({
            refundStatus: "refunded"
        }, {
            ...ticket.refundCase,
            status: "refunded"
        })).toEqual(expect.objectContaining({
            refundStatus: "refunded",
            supportRefundTicketId: "ticket-1",
            supportRefundCaseStatus: "refunded",
            supportRefundCustomerDecision: "approved",
            supportRefundVendorDecision: "approved",
            supportRefundVendorDeduction: 50,
            supportRefundPlatformDeduction: 5
        }));
    });

    test("resolves admins from custom claims, explicit authorizer, and user records", async () => {
        await expect(supportRefund.isCallableAdmin({
            uid: "admin-1",
            token: {
                isAdmin: true
            }
        })).resolves.toBe(true);

        await expect(supportRefund.isCallableAdmin({
            uid: "admin-2",
            token: {}
        }, {
            adminAuthorizer: jest.fn(() => true)
        })).resolves.toBe(true);

        await expect(supportRefund.isCallableAdmin({
            uid: "admin-3",
            token: {}
        }, {
            userReader: jest.fn(async () => ({
                isAdmin: true,
                accountStatus: "active"
            }))
        })).resolves.toBe(true);

        await expect(supportRefund.isCallableAdmin({
            uid: "customer-1",
            token: {}
        }, {
            userReader: jest.fn(async () => ({
                isAdmin: false,
                accountStatus: "active"
            }))
        })).resolves.toBe(false);
    });

    test("fetches documents from injected readers or Admin Firestore", async () => {
        const supportTicketReader = jest.fn(async ticketId => ({ ticketId, subject: "Help" }));
        await expect(supportRefund.fetchSupportTicket("ticket-1", { supportTicketReader }))
            .resolves.toEqual({ ticketId: "ticket-1", subject: "Help" });

        const get = jest.fn(async () => ({
            exists: true,
            data: () => ({
                paymentStatus: "paid"
            })
        }));
        const doc = jest.fn(() => ({ get }));
        const collection = jest.fn(() => ({ doc }));
        const adminDb = { collection };

        await expect(supportRefund.fetchOrderRecord("order-1", { adminDb }))
            .resolves.toEqual({
                id: "order-1",
                orderId: "order-1",
                paymentStatus: "paid"
            });
        expect(collection).toHaveBeenCalledWith("orders");
        expect(doc).toHaveBeenCalledWith("order-1");
    });

    test("creates execute support refund handler with admin gate and injected executor", async () => {
        const executeApprovedSupportRefund = jest.fn(async () => ({
            success: true,
            ticketId: "ticket-1",
            orderId: "order-1"
        }));
        const handler = supportRefund.createExecuteSupportRefundHandler({
            adminAuthorizer: jest.fn(() => true),
            executeApprovedSupportRefund
        });

        await expect(handler({
            data: {
                ticketId: "ticket-1",
                options: {
                    timestampValue: "server-time"
                }
            },
            auth: {
                uid: "admin-1",
                token: {
                    email: "admin@example.com"
                }
            }
        })).resolves.toEqual({
            success: true,
            ticketId: "ticket-1",
            orderId: "order-1"
        });

        expect(executeApprovedSupportRefund).toHaveBeenCalledWith(
            expect.objectContaining({
                ticketId: "ticket-1",
                actorUid: "admin-1",
                actorName: "admin@example.com",
                timestampValue: "server-time"
            }),
            expect.objectContaining({ executeApprovedSupportRefund })
        );
    });

    test("handler rejects signed-out and non-admin callers", async () => {
        await expect(supportRefund.createExecuteSupportRefundHandler()({
            data: {
                ticketId: "ticket-1"
            }
        })).rejects.toMatchObject({
            name: "HttpsError",
            code: "unauthenticated"
        });

        await expect(supportRefund.createExecuteSupportRefundHandler({
            adminAuthorizer: jest.fn(() => false)
        })({
            data: {
                ticketId: "ticket-1"
            },
            auth: {
                uid: "customer-1",
                token: {}
            }
        })).rejects.toMatchObject({
            name: "HttpsError",
            code: "permission-denied"
        });
    });

    test("executes an approved support refund and updates ticket/order state", async () => {
        const ticket = createTicket();
        const order = createOrder();
        const processingTicket = {
            ...ticket,
            refundCase: {
                ...ticket.refundCase,
                status: "processing"
            }
        };
        const completedTicket = {
            ...ticket,
            refundCase: {
                ...ticket.refundCase,
                status: "refunded",
                refundReference: "refund-ref-1"
            }
        };
        const ticketService = {
            markRefundProcessing: jest.fn(async () => ({
                success: true,
                ticket: processingTicket,
                refundCase: processingTicket.refundCase
            })),
            markRefundCompleted: jest.fn(async () => ({
                success: true,
                ticket: completedTicket,
                refundCase: completedTicket.refundCase
            })),
            markRefundFailed: jest.fn()
        };
        const refundPayment = jest.fn(async () => ({
            success: true,
            provider: "paystack",
            refund: {
                refundId: "refund-1",
                refundReference: "refund-ref-1",
                paymentReference: "paystack-ref-1",
                amount: 55,
                amountInMinorUnits: 5500
            },
            patch: {
                refundStatus: "refunded",
                refundReference: "refund-ref-1",
                refundAmount: 55
            }
        }));
        const orderPaymentPatchWriter = jest.fn(async (orderId, patch) => ({
            success: true,
            orderId,
            patch
        }));

        await expect(supportRefund.executeApprovedSupportRefund({
            ticketId: "ticket-1",
            actorUid: "admin-1",
            actorName: "Admin",
            timestampValue: "server-time"
        }, {
            supportTicketReader: jest.fn(async () => ticket),
            orderReader: jest.fn(async () => order),
            ticketService,
            refundPayment,
            orderPaymentPatchWriter
        })).resolves.toEqual(expect.objectContaining({
            success: true,
            ticketId: "ticket-1",
            orderId: "order-1",
            refund: expect.objectContaining({
                refundReference: "refund-ref-1"
            })
        }));

        expect(ticketService.markRefundProcessing).toHaveBeenCalledWith(expect.objectContaining({
            ticket,
            order,
            actorRole: "admin",
            actorUid: "admin-1"
        }));
        expect(refundPayment).toHaveBeenCalledWith(order, expect.objectContaining({
            paymentReference: "paystack-ref-1",
            refundAmount: 55,
            reason: "Food quality issue"
        }));
        expect(orderPaymentPatchWriter).toHaveBeenCalledWith("order-1", expect.objectContaining({
            refundStatus: "refunded",
            supportRefundTicketId: "ticket-1",
            supportRefundCaseStatus: "refunded",
            supportRefundVendorDeduction: 50
        }));
        expect(ticketService.markRefundCompleted).toHaveBeenCalledWith(expect.objectContaining({
            ticket: processingTicket,
            execution: expect.objectContaining({
                status: "refunded",
                refundReference: "refund-ref-1"
            })
        }));
        expect(ticketService.markRefundFailed).not.toHaveBeenCalled();
    });

    test("marks refund failed when provider rejects the refund", async () => {
        const ticket = createTicket();
        const processingTicket = {
            ...ticket,
            refundCase: {
                ...ticket.refundCase,
                status: "processing"
            }
        };
        const ticketService = {
            markRefundProcessing: jest.fn(async () => ({
                success: true,
                ticket: processingTicket,
                refundCase: processingTicket.refundCase
            })),
            markRefundCompleted: jest.fn(),
            markRefundFailed: jest.fn(async () => ({
                success: true,
                ticket: {
                    ...processingTicket,
                    refundCase: {
                        ...processingTicket.refundCase,
                        status: "failed"
                    }
                }
            }))
        };

        await expect(supportRefund.executeApprovedSupportRefund({
            ticketId: "ticket-1",
            actorUid: "admin-1"
        }, {
            supportTicketReader: jest.fn(async () => ticket),
            orderReader: jest.fn(async () => createOrder()),
            ticketService,
            refundPayment: jest.fn(async () => ({
                success: false,
                error: {
                    message: "Paystack timeout"
                }
            }))
        })).resolves.toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({
                code: "support-refunds/provider-failed",
                message: "Paystack timeout"
            })
        }));

        expect(ticketService.markRefundFailed).toHaveBeenCalledWith(expect.objectContaining({
            ticket: processingTicket,
            refundFailureReason: "Paystack timeout"
        }));
        expect(ticketService.markRefundCompleted).not.toHaveBeenCalled();
    });

    test("reports missing ticket id, missing ticket, and missing order cleanly", async () => {
        await expect(supportRefund.executeApprovedSupportRefund()).resolves.toEqual(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: "support-refunds/ticket-id-required"
                })
            })
        );

        await expect(supportRefund.executeApprovedSupportRefund({
            ticketId: "ticket-1"
        }, {
            supportTicketReader: jest.fn(async () => null)
        })).resolves.toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({
                code: "support-refunds/ticket-not-found"
            })
        }));

        await expect(supportRefund.executeApprovedSupportRefund({
            ticketId: "ticket-1"
        }, {
            supportTicketReader: jest.fn(async () => createTicket()),
            orderReader: jest.fn(async () => null)
        })).resolves.toEqual(expect.objectContaining({
            success: false,
            error: expect.objectContaining({
                code: "support-refunds/order-not-found"
            })
        }));
    });
});
