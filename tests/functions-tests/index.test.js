const functionsIndex = require("../../functions/index.js");

describe("functions/index.js", () => {
    test("exports callable payment functions and helper utilities", () => {
        expect(functionsIndex.DEFAULT_REGION).toBe("africa-south1");
        expect(functionsIndex.DEFAULT_PLATFORM_FEE_RATE).toBe(0.1);
        expect(functionsIndex.FINANCE_MODEL).toBe("vendor-price-plus-platform-fee");
        expect(typeof functionsIndex.initializePayment).toBe("function");
        expect(typeof functionsIndex.verifyPayment).toBe("function");
        expect(typeof functionsIndex.refundPayment).toBe("function");
        expect(typeof functionsIndex.executeSupportRefund).toBe("function");
        expect(typeof functionsIndex.convertCheckoutToOrder).toBe("function");
        expect(typeof functionsIndex.createInitializePaymentHandler).toBe("function");
        expect(typeof functionsIndex.createVerifyPaymentHandler).toBe("function");
        expect(typeof functionsIndex.createRefundPaymentHandler).toBe("function");
        expect(typeof functionsIndex.createExecuteSupportRefundHandler).toBe("function");
        expect(typeof functionsIndex.createConvertCheckoutToOrderHandler).toBe("function");
        expect(typeof functionsIndex.executeApprovedSupportRefund).toBe("function");
        expect(typeof functionsIndex.isCallableAdmin).toBe("function");
        expect(typeof functionsIndex.createAdminFirestoreFns).toBe("function");
        expect(typeof functionsIndex.buildOrderFromCheckoutSession).toBe("function");
        expect(typeof functionsIndex.calculateCheckoutItemPricing).toBe("function");
        expect(typeof functionsIndex.calculateCheckoutVendorSubtotal).toBe("function");
        expect(typeof functionsIndex.calculateCheckoutPlatformFee).toBe("function");
        expect(typeof functionsIndex.convertCheckoutSessionToOrder).toBe("function");
        expect(typeof functionsIndex.persistCheckoutOrderConversion).toBe("function");
        expect(typeof functionsIndex.persistThenAssertPaymentResult).toBe("function");
        expect(functionsIndex.optionalRequire("definitely-not-installed-module")).toBeNull();
    });

    test("normalizes checkout item finance fields for converted orders", () => {
        expect(functionsIndex.normalizePlatformFeeRate("10")).toBe(0.1);
        expect(functionsIndex.normalizeCurrencyAmount("45.678")).toBe(45.68);
        expect(functionsIndex.getCheckoutCustomerPrice({ customerPrice: "55" })).toBe("55");

        expect(functionsIndex.normalizeCheckoutItem({
            itemId: "meal-1",
            name: "Rice Bowl",
            price: 55,
            quantity: 2
        })).toMatchObject({
            itemId: "meal-1",
            menuItemId: "meal-1",
            vendorPrice: 50,
            platformFee: 5,
            customerPrice: 55,
            price: 55,
            vendorSubtotal: 100,
            platformFeeTotal: 10,
            lineTotal: 110
        });

        expect(functionsIndex.normalizeCheckoutItem({
            itemId: "vendor-meal",
            name: "Vendor Meal",
            vendorPrice: 100,
            quantity: 1
        })).toMatchObject({
            vendorPrice: 100,
            platformFee: 10,
            customerPrice: 110,
            price: 110,
            vendorSubtotal: 100,
            platformFeeTotal: 10,
            lineTotal: 110
        });
    });

    test("normalizes callable data and auth context", () => {
        expect(
            functionsIndex.normalizeCallableData({
                data: {
                    orderId: "order-1"
                }
            })
        ).toEqual({
            orderId: "order-1"
        });
        expect(functionsIndex.normalizeCallableData({ data: null })).toEqual({});

        expect(
            functionsIndex.normalizeAuthContext({
                auth: {
                    uid: "customer-1",
                    token: {
                        email: "student@example.com"
                    }
                }
            })
        ).toEqual({
            uid: "customer-1",
            token: {
                email: "student@example.com"
            }
        });
        expect(functionsIndex.normalizeAuthContext({})).toEqual({
            uid: "",
            token: {}
        });
    });

    test("creates local callable wrappers for tests and fallback environments", async () => {
        const handler = jest.fn(async request => ({
            data: functionsIndex.normalizeCallableData(request)
        }));
        const callable = functionsIndex.createLocalCallable({
            region: "africa-south1"
        }, handler);

        await expect(callable({
            data: {
                ok: true
            }
        })).resolves.toEqual({
            data: {
                ok: true
            }
        });
        expect(callable.__isLocalCallable).toBe(true);
        expect(callable.__triggerOptions).toEqual({
            region: "africa-south1"
        });
        expect(handler).toHaveBeenCalledTimes(1);
    });

    test("sanitizes callable results and converts failures to callable errors", () => {
        const cause = new Error("secret stack should not be returned");
        cause.code = "paystack/network-error";
        const result = {
            success: false,
            error: {
                code: "payments/problem",
                message: "Payment failed.",
                cause
            }
        };

        expect(functionsIndex.sanitizeForCallable(result)).toEqual({
            success: false,
            error: {
                code: "payments/problem",
                message: "Payment failed."
            }
        });

        expect(() => functionsIndex.assertSuccessfulPaymentResult(result, "Fallback"))
            .toThrow("Payment failed.");
        expect(
            functionsIndex.assertSuccessfulPaymentResult({
                success: true,
                error: {
                    cause
                }
            }, "Fallback")
        ).toEqual({
            success: true,
            error: {}
        });
        expect(functionsIndex.sanitizeForCallable([
            cause,
            {
                nested: cause
            }
        ])).toEqual([
            {
                name: "Error",
                message: "secret stack should not be returned",
                code: "paystack/network-error"
            },
            {
                nested: {
                    name: "Error",
                    message: "secret stack should not be returned",
                    code: "paystack/network-error"
                }
            }
        ]);
    });

    test("creates initialize payment handler with injected dependency", async () => {
        const initializePayment = jest.fn(async () => ({
            success: true,
            payment: {
                orderId: "order-1"
            },
            authorizationUrl: "https://checkout.paystack.com/test"
        }));
        const handler = functionsIndex.createInitializePaymentHandler({
            initializePayment
        });

        await expect(
            handler({
                data: {
                    order: {
                        orderId: "order-1"
                    },
                    options: {
                        callbackUrl: "https://example.com/callback.html"
                    }
                },
                auth: {
                    uid: "customer-1",
                    token: {
                        email: "student@example.com"
                    }
                }
            })
        ).resolves.toEqual({
            success: true,
            payment: {
                orderId: "order-1"
            },
            authorizationUrl: "https://checkout.paystack.com/test"
        });

        expect(initializePayment).toHaveBeenCalledWith(
            {
                orderId: "order-1"
            },
            {
                callbackUrl: "https://example.com/callback.html",
                actorUid: "customer-1",
                auth: {
                    uid: "customer-1",
                    token: {
                        email: "student@example.com"
                    }
                }
            }
        );
    });

    test("creates verify payment handler with injected dependency", async () => {
        const verifyPayment = jest.fn(async () => ({
            success: true,
            payment: {
                orderId: "order-1",
                status: "paid"
            },
            patch: {
                paymentStatus: "paid"
            }
        }));
        const handler = functionsIndex.createVerifyPaymentHandler({
            verifyPayment
        });

        await expect(
            handler({
                data: {
                    payment: {
                        orderId: "order-1"
                    },
                    reference: "paystack-ref",
                    options: {
                        timestampValue: "server-time"
                    }
                },
                auth: {
                    uid: "customer-1"
                }
            })
        ).resolves.toEqual({
            success: true,
            payment: {
                orderId: "order-1",
                status: "paid"
            },
            patch: {
                paymentStatus: "paid"
            }
        });

        expect(verifyPayment).toHaveBeenCalledWith(
            {
                orderId: "order-1"
            },
            {
                reference: "paystack-ref",
                timestampValue: "server-time",
                actorUid: "customer-1",
                auth: {
                    uid: "customer-1",
                    token: {}
                }
            }
        );
    });

    test("creates refund payment handler with injected dependency and persists the refund patch", async () => {
        const refundPayment = jest.fn(async () => ({
            success: true,
            payment: {
                orderId: "order-1",
                status: "paid",
                reference: "paystack-ref"
            },
            refund: {
                refundReference: "refund-ref"
            },
            patch: {
                refundStatus: "refunded",
                refundReference: "refund-ref"
            }
        }));
        const orderPaymentPatchWriter = jest.fn(async (orderId, patch) => ({
            success: true,
            orderId,
            patch
        }));
        const handler = functionsIndex.createRefundPaymentHandler({
            refundPayment,
            orderPaymentPatchWriter
        });

        await expect(
            handler({
                data: {
                    payment: {
                        orderId: "order-1",
                        paymentStatus: "paid",
                        paymentReference: "paystack-ref"
                    },
                    reference: "paystack-ref",
                    refundAmount: 25,
                    reason: "Vendor rejected",
                    options: {
                        requestedAt: "server-time"
                    }
                },
                auth: {
                    uid: "admin-1"
                }
            })
        ).resolves.toEqual({
            success: true,
            payment: {
                orderId: "order-1",
                status: "paid",
                reference: "paystack-ref"
            },
            refund: {
                refundReference: "refund-ref"
            },
            patch: {
                refundStatus: "refunded",
                refundReference: "refund-ref"
            },
            patchResult: {
                success: true,
                orderId: "order-1",
                patch: {
                    refundStatus: "refunded",
                    refundReference: "refund-ref"
                }
            }
        });

        expect(refundPayment).toHaveBeenCalledWith(
            {
                orderId: "order-1",
                paymentStatus: "paid",
                paymentReference: "paystack-ref"
            },
            expect.objectContaining({
                reference: "paystack-ref",
                refundAmount: 25,
                reason: "Vendor rejected",
                requestedAt: "server-time",
                actorUid: "admin-1",
                auth: {
                    uid: "admin-1",
                    token: {}
                }
            })
        );
        expect(orderPaymentPatchWriter).toHaveBeenCalledWith("order-1", {
            refundStatus: "refunded",
            refundReference: "refund-ref"
        });
    });

    test("authorizes callable admins from custom claims, explicit authorizer, or user records", async () => {
        await expect(functionsIndex.isCallableAdmin({
            uid: "admin-1",
            token: {
                isAdmin: true
            }
        })).resolves.toBe(true);

        const adminAuthorizer = jest.fn(() => true);
        await expect(functionsIndex.isCallableAdmin({
            uid: "admin-2",
            token: {}
        }, {
            adminAuthorizer
        })).resolves.toBe(true);
        expect(adminAuthorizer).toHaveBeenCalledWith(
            {
                uid: "admin-2",
                token: {}
            },
            expect.objectContaining({ adminAuthorizer })
        );

        await expect(functionsIndex.isCallableAdmin({
            uid: "admin-3",
            token: {}
        }, {
            userReader: jest.fn(async () => ({
                isAdmin: true,
                accountStatus: "active"
            }))
        })).resolves.toBe(true);

        await expect(functionsIndex.isCallableAdmin({
            uid: "customer-1",
            token: {}
        }, {
            userReader: jest.fn(async () => ({
                isAdmin: false,
                accountStatus: "active"
            }))
        })).resolves.toBe(false);
    });

    test("creates execute support refund handler with admin gate and injected executor", async () => {
        const executeApprovedSupportRefund = jest.fn(async () => ({
            success: true,
            ticketId: "ticket-1",
            orderId: "order-1",
            refund: {
                refundReference: "refund-ref-1"
            }
        }));
        const handler = functionsIndex.createExecuteSupportRefundHandler({
            adminAuthorizer: jest.fn(() => true),
            executeApprovedSupportRefund
        });

        await expect(
            handler({
                data: {
                    ticketId: "ticket-1",
                    orderId: "order-1",
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
            })
        ).resolves.toEqual({
            success: true,
            ticketId: "ticket-1",
            orderId: "order-1",
            refund: {
                refundReference: "refund-ref-1"
            }
        });

        expect(executeApprovedSupportRefund).toHaveBeenCalledWith(
            expect.objectContaining({
                ticketId: "ticket-1",
                orderId: "order-1",
                actorUid: "admin-1",
                actorName: "admin@example.com",
                timestampValue: "server-time"
            }),
            expect.objectContaining({
                executeApprovedSupportRefund
            })
        );
    });

    test("execute support refund handler rejects signed-out and non-admin callers", async () => {
        const signedOutHandler = functionsIndex.createExecuteSupportRefundHandler();

        await expect(signedOutHandler({
            data: {
                ticketId: "ticket-1"
            }
        })).rejects.toMatchObject({
            name: "HttpsError",
            code: "unauthenticated"
        });

        const nonAdminHandler = functionsIndex.createExecuteSupportRefundHandler({
            adminAuthorizer: jest.fn(() => false)
        });

        await expect(nonAdminHandler({
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

    test("executes an approved support refund server-side and patches order plus ticket", async () => {
        const approvedRefundCase = {
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
            }
        };
        const ticket = {
            ticketId: "ticket-1",
            orderId: "order-1",
            customerUid: "customer-1",
            vendorUid: "vendor-1",
            refundCase: approvedRefundCase
        };
        const order = {
            orderId: "order-1",
            customerUid: "customer-1",
            vendorUid: "vendor-1",
            paymentStatus: "paid",
            paymentReference: "paystack-ref-1",
            paymentAmount: 110,
            paymentAmountInMinorUnits: 11000,
            paymentCurrency: "ZAR"
        };
        const processingTicket = {
            ...ticket,
            refundCase: {
                ...approvedRefundCase,
                status: "processing"
            }
        };
        const completedTicket = {
            ...ticket,
            refundCase: {
                ...approvedRefundCase,
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
                refundAmount: 55,
                refundAmountInMinorUnits: 5500
            }
        }));
        const orderPaymentPatchWriter = jest.fn(async (orderId, patch) => ({
            success: true,
            orderId,
            patch
        }));

        await expect(functionsIndex.executeApprovedSupportRefund({
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
            }),
            orderPatchResult: expect.objectContaining({
                success: true,
                orderId: "order-1"
            })
        }));

        expect(ticketService.markRefundProcessing).toHaveBeenCalledWith(expect.objectContaining({
            ticket,
            order,
            actorUid: "admin-1",
            actorRole: "admin",
            now: "server-time"
        }));
        expect(refundPayment).toHaveBeenCalledWith(
            order,
            expect.objectContaining({
                paymentReference: "paystack-ref-1",
                refundAmount: 55,
                refundAmountInMinorUnits: 5500,
                reason: "Food quality issue",
                actorUid: "admin-1"
            })
        );
        expect(orderPaymentPatchWriter).toHaveBeenCalledWith("order-1", expect.objectContaining({
            refundStatus: "refunded",
            refundReference: "refund-ref-1",
            supportRefundTicketId: "ticket-1",
            supportRefundCaseStatus: "refunded",
            supportRefundVendorDeduction: 50,
            supportRefundPlatformDeduction: 5
        }));
        expect(ticketService.markRefundCompleted).toHaveBeenCalledWith(expect.objectContaining({
            ticket: processingTicket,
            order,
            execution: expect.objectContaining({
                status: "refunded",
                refundReference: "refund-ref-1"
            })
        }));
        expect(ticketService.markRefundFailed).not.toHaveBeenCalled();
    });

    test("marks the support refund failed when the provider rejects it", async () => {
        const ticket = {
            ticketId: "ticket-1",
            orderId: "order-1",
            customerUid: "customer-1",
            vendorUid: "vendor-1",
            refundCase: {
                status: "approved",
                amount: 55,
                amountInMinorUnits: 5500,
                reason: "Food quality issue",
                customerDecision: "approved",
                vendorDecision: "approved"
            }
        };
        const order = {
            orderId: "order-1",
            paymentStatus: "paid",
            paymentReference: "paystack-ref-1",
            paymentAmount: 110
        };
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

        await expect(functionsIndex.executeApprovedSupportRefund({
            ticketId: "ticket-1",
            actorUid: "admin-1"
        }, {
            supportTicketReader: jest.fn(async () => ticket),
            orderReader: jest.fn(async () => order),
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
            refundFailureReason: "Paystack timeout",
            execution: expect.objectContaining({
                status: "failed",
                refundFailureReason: "Paystack timeout"
            })
        }));
        expect(ticketService.markRefundCompleted).not.toHaveBeenCalled();
    });

    test("builds a paid order from a checkout session and a conversion patch", () => {
        const checkout = {
            checkoutId: " checkout-1 ",
            customerUid: " customer-1 ",
            customerName: " Student One ",
            customerEmail: " student@example.com ",
            vendorUid: " vendor-1 ",
            vendorName: " Campus Meals ",
            status: "paid",
            items: [
                {
                    itemId: "meal-1",
                    name: "Rice Bowl",
                    quantity: 2,
                    price: 35
                },
                {
                    itemId: "drink-1",
                    name: "Juice",
                    quantity: 1,
                    unitPrice: 15
                }
            ],
            paymentProvider: "Paystack",
            paymentReference: " paystack-ref ",
            paymentAmount: 85,
            paymentCurrency: "zar"
        };

        expect(functionsIndex.resolveCheckoutId(checkout)).toBe("checkout-1");
        expect(functionsIndex.createOrderIdFromCheckout(checkout)).toBe("order-checkout-1");
        expect(functionsIndex.calculateCheckoutSubtotal(checkout.items)).toBe(85);
        expect(functionsIndex.calculateCheckoutVendorSubtotal(checkout.items)).toBe(77.28);
        expect(functionsIndex.calculateCheckoutPlatformFee(checkout.items)).toBe(7.72);
        expect(functionsIndex.isCheckoutPaid(checkout)).toBe(true);

        const order = functionsIndex.buildOrderFromCheckoutSession(checkout, {
            timestampValue: "server-time",
            actorUid: "system-user"
        });

        expect(order).toMatchObject({
            orderId: "order-checkout-1",
            checkoutId: "checkout-1",
            customerUid: "customer-1",
            vendorUid: "vendor-1",
            itemCount: 2,
            subtotal: 85,
            total: 85,
            totalAmount: 85,
            vendorSubtotal: 77.28,
            vendorEarnings: 77.28,
            platformFeeRate: 0.1,
            platformFee: 7.72,
            platformEarnings: 7.72,
            customerTotal: 85,
            financeModel: "vendor-price-plus-platform-fee",
            paymentStatus: "paid",
            paymentProvider: "paystack",
            paymentReference: "paystack-ref",
            paymentAmountInMinorUnits: 8500,
            paymentCurrency: "ZAR",
            status: "pending",
            createdAt: "server-time",
            updatedAt: "server-time"
        });
        expect(order.items[0]).toMatchObject({
            itemId: "meal-1",
            vendorPrice: 31.82,
            platformFee: 3.18,
            customerPrice: 35,
            vendorSubtotal: 63.64,
            platformFeeTotal: 6.36,
            lineTotal: 70
        });
        expect(order.timeline).toEqual([
            expect.objectContaining({
                status: "pending",
                actorRole: "system",
                actorUid: "system-user",
                at: "server-time"
            })
        ]);

        expect(functionsIndex.buildCheckoutConversionPatch(order.orderId, {
            convertedAt: "converted-time"
        })).toEqual({
            status: "converted",
            convertedOrderId: "order-checkout-1",
            convertedAt: "converted-time",
            updatedAt: "converted-time"
        });
    });

    test("converts paid checkout sessions with an injected converter dependency", async () => {
        const convertCheckoutToOrder = jest.fn(async () => ({
            success: true,
            checkoutId: "checkout-1",
            orderId: "order-1"
        }));
        const handler = functionsIndex.createConvertCheckoutToOrderHandler({
            convertCheckoutToOrder
        });

        await expect(
            handler({
                data: {
                    checkoutId: "checkout-1",
                    orderId: "order-1",
                    checkout: {
                        checkoutId: "checkout-1",
                        status: "paid"
                    },
                    options: {
                        timestampValue: "server-time"
                    }
                },
                auth: {
                    uid: "customer-1"
                }
            })
        ).resolves.toEqual({
            success: true,
            checkoutId: "checkout-1",
            orderId: "order-1"
        });

        expect(convertCheckoutToOrder).toHaveBeenCalledWith(
            {
                checkoutId: "checkout-1",
                status: "paid"
            },
            expect.objectContaining({
                checkoutId: "checkout-1",
                orderId: "order-1",
                timestampValue: "server-time",
                actorUid: "customer-1",
                auth: {
                    uid: "customer-1",
                    token: {}
                }
            })
        );
    });

    test("persists checkout conversion with an injected writer", async () => {
        const checkoutOrderConverter = jest.fn(async (checkout, order, checkoutPatch) => ({
            success: true,
            checkoutId: checkout.checkoutId,
            orderId: order.orderId,
            order,
            checkoutPatch
        }));

        await expect(
            functionsIndex.convertCheckoutSessionToOrder({
                checkoutId: "checkout-1",
                status: "paid",
                customerUid: "customer-1",
                vendorUid: "vendor-1",
                items: [
                    {
                        itemId: "meal-1",
                        name: "Rice Bowl",
                        quantity: 1,
                        price: 50
                    }
                ],
                paymentReference: "paystack-ref"
            }, {
                timestampValue: "server-time",
                checkoutOrderConverter
            })
        ).resolves.toEqual({
            success: true,
            checkoutId: "checkout-1",
            orderId: "order-checkout-1",
            order: expect.objectContaining({
                orderId: "order-checkout-1",
                checkoutId: "checkout-1",
                paymentStatus: "paid"
            }),
            checkoutPatch: {
                status: "converted",
                convertedOrderId: "order-checkout-1",
                convertedAt: "server-time",
                updatedAt: "server-time"
            },
            checkout: expect.objectContaining({
                checkoutId: "checkout-1",
                status: "converted",
                convertedOrderId: "order-checkout-1"
            })
        });

        expect(checkoutOrderConverter).toHaveBeenCalledWith(
            expect.objectContaining({
                checkoutId: "checkout-1"
            }),
            expect.objectContaining({
                orderId: "order-checkout-1"
            }),
            {
                status: "converted",
                convertedOrderId: "order-checkout-1",
                convertedAt: "server-time",
                updatedAt: "server-time"
            },
            expect.objectContaining({
                timestampValue: "server-time"
            })
        );
    });

    test("persists checkout conversion through Admin Firestore transactions", async () => {
        const orderSet = jest.fn();
        const checkoutUpdate = jest.fn();
        const orderDoc = {
            kind: "order-ref",
            set: orderSet
        };
        const checkoutDoc = {
            kind: "checkout-ref",
            update: checkoutUpdate
        };
        const orderCollection = {
            doc: jest.fn(() => orderDoc)
        };
        const checkoutCollection = {
            doc: jest.fn(() => checkoutDoc)
        };
        const transaction = {
            set: jest.fn(),
            update: jest.fn()
        };
        const adminDb = {
            collection: jest.fn(name => (
                name === "orders" ? orderCollection : checkoutCollection
            )),
            runTransaction: jest.fn(async callback => callback(transaction))
        };

        await expect(
            functionsIndex.persistCheckoutOrderConversion(
                {
                    checkoutId: "checkout-1"
                },
                {
                    orderId: "order-1",
                    checkoutId: "checkout-1"
                },
                {
                    status: "converted",
                    convertedOrderId: "order-1"
                },
                {
                    adminDb
                }
            )
        ).resolves.toEqual({
            success: true,
            checkoutId: "checkout-1",
            orderId: "order-1",
            order: {
                orderId: "order-1",
                checkoutId: "checkout-1"
            },
            checkoutPatch: {
                status: "converted",
                convertedOrderId: "order-1"
            }
        });

        expect(adminDb.collection).toHaveBeenCalledWith("orders");
        expect(adminDb.collection).toHaveBeenCalledWith("checkoutSessions");
        expect(transaction.set).toHaveBeenCalledWith(orderDoc, {
            orderId: "order-1",
            checkoutId: "checkout-1"
        });
        expect(transaction.update).toHaveBeenCalledWith(checkoutDoc, {
            status: "converted",
            convertedOrderId: "order-1"
        });
    });

    test("fetches checkout session from Admin Firestore before conversion", async () => {
        const get = jest.fn(async () => ({
            exists: true,
            data: () => ({
                status: "paid",
                customerUid: "customer-1",
                vendorUid: "vendor-1",
                total: 40,
                paymentReference: "paystack-ref"
            })
        }));
        const checkoutDoc = {
            get
        };
        const checkoutCollection = {
            doc: jest.fn(() => checkoutDoc)
        };
        const orderCollection = {
            doc: jest.fn(() => ({
                set: jest.fn()
            }))
        };
        const adminDb = {
            collection: jest.fn(name => (
                name === "checkoutSessions" ? checkoutCollection : orderCollection
            ))
        };
        const checkoutOrderConverter = jest.fn(async (checkout, order, checkoutPatch) => ({
            success: true,
            checkoutId: checkout.checkoutId,
            orderId: order.orderId,
            order,
            checkoutPatch
        }));

        await expect(
            functionsIndex.convertCheckoutSessionToOrder({}, {
                checkoutId: "checkout-1",
                timestampValue: "server-time",
                adminDb,
                checkoutOrderConverter
            })
        ).resolves.toEqual(expect.objectContaining({
            success: true,
            checkoutId: "checkout-1",
            orderId: "order-checkout-1"
        }));

        expect(checkoutCollection.doc).toHaveBeenCalledWith("checkout-1");
        expect(checkoutOrderConverter).toHaveBeenCalledWith(
            expect.objectContaining({
                checkoutId: "checkout-1",
                status: "paid"
            }),
            expect.objectContaining({
                orderId: "order-checkout-1",
                paymentReference: "paystack-ref"
            }),
            expect.objectContaining({
                status: "converted"
            }),
            expect.any(Object)
        );
    });

    test("skips checkout conversion when already converted", async () => {
        await expect(
            functionsIndex.convertCheckoutSessionToOrder({
                checkoutId: "checkout-1",
                status: "converted",
                convertedOrderId: "order-1"
            })
        ).resolves.toEqual({
            success: true,
            skipped: true,
            alreadyConverted: true,
            checkoutId: "checkout-1",
            orderId: "order-1",
            checkout: {
                checkoutId: "checkout-1",
                status: "converted",
                convertedOrderId: "order-1"
            }
        });

        expect(functionsIndex.isCheckoutConverted({
            status: "converted",
            convertedOrderId: "order-1"
        })).toBe(true);
    });

    test("blocks unpaid checkout conversion and reports persistence failures", async () => {
        await expect(
            functionsIndex.convertCheckoutSessionToOrder({
                checkoutId: "checkout-1",
                status: "payment_pending"
            })
        ).resolves.toEqual({
            success: false,
            checkoutId: "checkout-1",
            checkout: {
                checkoutId: "checkout-1",
                status: "payment_pending"
            },
            error: {
                code: "checkout/not-paid",
                message: "Only paid checkout sessions can be converted into orders."
            }
        });

        await expect(
            functionsIndex.convertCheckoutSessionToOrder({
                checkoutId: "checkout-2",
                status: "paid"
            })
        ).resolves.toEqual(expect.objectContaining({
            success: false,
            skipped: true,
            checkoutId: "checkout-2",
            orderId: "order-checkout-2",
            error: {
                code: "checkout/admin-db-unavailable",
                message: "Admin Firestore is not available to convert checkout into an order."
            }
        }));
    });

    test("conversion reports Firestore permission failures without crashing the callable", async () => {
        const permissionError = new Error("7 PERMISSION_DENIED: Missing or insufficient permissions.");
        permissionError.code = 7;
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        try {
            await expect(
                functionsIndex.convertCheckoutSessionToOrder({}, {
                    checkoutId: "checkout-1",
                    checkoutSessionReader: jest.fn(async () => {
                        throw permissionError;
                    })
                })
            ).resolves.toEqual(expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: "checkout/7",
                    message: "7 PERMISSION_DENIED: Missing or insufficient permissions."
                })
            }));
        } finally {
            errorSpy.mockRestore();
        }
    });

    test("conversion handler throws callable errors when checkout conversion fails", async () => {
        const handler = functionsIndex.createConvertCheckoutToOrderHandler({
            convertCheckoutToOrder: jest.fn(async () => ({
                success: false,
                error: {
                    code: "checkout/not-paid",
                    message: "Only paid checkout sessions can be converted into orders."
                }
            }))
        });

        await expect(
            handler({
                data: {
                    checkoutId: "checkout-1"
                }
            })
        ).rejects.toMatchObject({
            name: "HttpsError",
            code: "failed-precondition",
            message: "Only paid checkout sessions can be converted into orders."
        });
    });

    test("persists successful payment patches with injected writer", async () => {
        const orderPaymentPatchWriter = jest.fn(async (orderId, patch) => ({
            success: true,
            orderId,
            patch
        }));
        const handler = functionsIndex.createInitializePaymentHandler({
            initializePayment: jest.fn(async () => ({
                success: true,
                payment: {
                    orderId: "order-1"
                },
                patch: {
                    paymentStatus: "pending",
                    paymentReference: "paystack-ref"
                },
                authorizationUrl: "https://checkout.paystack.com/test"
            })),
            orderPaymentPatchWriter
        });

        await expect(
            handler({
                data: {
                    order: {
                        orderId: "order-1"
                    }
                }
            })
        ).resolves.toEqual({
            success: true,
            payment: {
                orderId: "order-1"
            },
            patch: {
                paymentStatus: "pending",
                paymentReference: "paystack-ref"
            },
            patchResult: {
                success: true,
                orderId: "order-1",
                patch: {
                    paymentStatus: "pending",
                    paymentReference: "paystack-ref"
                }
            },
            authorizationUrl: "https://checkout.paystack.com/test"
        });

        expect(orderPaymentPatchWriter).toHaveBeenCalledWith("order-1", {
            paymentStatus: "pending",
            paymentReference: "paystack-ref"
        });
    });

    test("persists failed verification patches before throwing callable errors", async () => {
        const orderPaymentPatchWriter = jest.fn(async (orderId, patch) => ({
            success: true,
            orderId,
            patch
        }));
        const handler = functionsIndex.createVerifyPaymentHandler({
            verifyPayment: jest.fn(async () => ({
                success: false,
                payment: {
                    orderId: "order-1",
                    status: "failed"
                },
                patch: {
                    paymentStatus: "failed",
                    paymentFailureReason: "Card declined"
                },
                error: {
                    code: "payments/payment-not-successful",
                    message: "Paystack did not confirm this payment."
                }
            })),
            orderPaymentPatchWriter
        });

        await expect(
            handler({
                data: {
                    payment: {
                        orderId: "order-1"
                    },
                    reference: "paystack-ref"
                }
            })
        ).rejects.toMatchObject({
            name: "HttpsError",
            code: "failed-precondition",
            message: "Paystack did not confirm this payment.",
            details: {
                patchResult: {
                    success: true,
                    orderId: "order-1",
                    patch: {
                        paymentStatus: "failed",
                        paymentFailureReason: "Card declined"
                    }
                }
            }
        });

        expect(orderPaymentPatchWriter).toHaveBeenCalledWith("order-1", {
            paymentStatus: "failed",
            paymentFailureReason: "Card declined"
        });
    });

    test("writeOrderPaymentPatch skips safely without an order id or patch", async () => {
        await expect(functionsIndex.writeOrderPaymentPatch("", {})).resolves.toEqual({
            success: false,
            skipped: true,
            orderId: "",
            patch: {}
        });
        expect(functionsIndex.resolveOrderId({ id: "doc-1" })).toBe("doc-1");
        expect(functionsIndex.resolveOrderId(null, { id: "fallback-1" })).toBe("fallback-1");
    });

    test("writes payment patches through an explicit admin db and reports update failures", async () => {
        const update = jest.fn(async () => undefined);
        const doc = jest.fn(() => ({ update }));
        const collection = jest.fn(() => ({ doc }));
        const adminDb = { collection };

        expect(functionsIndex.resolveAdminFirestore(adminDb)).toBe(adminDb);

        await expect(
            functionsIndex.writeOrderPaymentPatch(" order-1 ", {
                paymentStatus: "paid"
            }, {
                adminDb
            })
        ).resolves.toEqual({
            success: true,
            orderId: "order-1",
            patch: {
                paymentStatus: "paid"
            }
        });
        expect(collection).toHaveBeenCalledWith("orders");
        expect(doc).toHaveBeenCalledWith("order-1");
        expect(update).toHaveBeenCalledWith({
            paymentStatus: "paid"
        });

        const dbError = new Error("write failed");
        dbError.code = "permission-denied";
        const failingDb = {
            collection: jest.fn(() => ({
                doc: jest.fn(() => ({
                    update: jest.fn(async () => {
                        throw dbError;
                    })
                }))
            }))
        };

        await expect(
            functionsIndex.writeOrderPaymentPatch("order-2", {
                paymentStatus: "failed"
            }, {
                adminDb: failingDb
            })
        ).resolves.toEqual({
            success: false,
            orderId: "order-2",
            patch: {
                paymentStatus: "failed"
            },
            error: {
                name: "Error",
                message: "write failed",
                code: "permission-denied"
            }
        });
    });

    test("builds payment callables with custom onCall", async () => {
        const onCall = jest.fn((options, handler) => ({
            options,
            handler
        }));
        const initializePayment = jest.fn(async () => ({
            success: true,
            marker: "initialized"
        }));
        const verifyPayment = jest.fn(async () => ({
            success: true,
            marker: "verified"
        }));
        const refundPayment = jest.fn(async () => ({
            success: true,
            marker: "refunded"
        }));
        const executeApprovedSupportRefund = jest.fn(async () => ({
            success: true,
            marker: "support-refunded"
        }));
        const convertCheckoutToOrder = jest.fn(async () => ({
            success: true,
            marker: "converted"
        }));

        const paymentFunctions = functionsIndex.createPaymentFunctions({
            region: "europe-west1",
            cors: false,
            onCall,
            dependencies: {
                initializePayment,
                verifyPayment,
                refundPayment,
                executeApprovedSupportRefund,
                adminAuthorizer: jest.fn(() => true),
                convertCheckoutToOrder
            }
        });

        expect(onCall).toHaveBeenCalledTimes(5);
        expect(paymentFunctions.initializePayment.options).toEqual({
            region: "europe-west1",
            cors: false,
            invoker: "public"
        });
        expect(paymentFunctions.verifyPayment.options).toEqual({
            region: "europe-west1",
            cors: false,
            invoker: "public"
        });
        expect(paymentFunctions.refundPayment.options).toEqual({
            region: "europe-west1",
            cors: false,
            invoker: "public"
        });
        expect(paymentFunctions.executeSupportRefund.options).toEqual({
            region: "europe-west1",
            cors: false,
            invoker: "public"
        });
        expect(paymentFunctions.convertCheckoutToOrder.options).toEqual({
            region: "europe-west1",
            cors: false,
            invoker: "public"
        });

        await expect(
            paymentFunctions.initializePayment.handler({
                data: {
                    order: {}
                }
            })
        ).resolves.toEqual({
            success: true,
            marker: "initialized"
        });
        await expect(
            paymentFunctions.verifyPayment.handler({
                data: {
                    payment: {},
                    reference: "ref-1"
                }
            })
        ).resolves.toEqual({
            success: true,
            marker: "verified"
        });
        await expect(
            paymentFunctions.refundPayment.handler({
                data: {
                    payment: {
                        orderId: "order-1"
                    },
                    reason: "Vendor rejected"
                }
            })
        ).resolves.toEqual({
            success: true,
            marker: "refunded"
        });
        await expect(
            paymentFunctions.executeSupportRefund.handler({
                data: {
                    ticketId: "ticket-1"
                },
                auth: {
                    uid: "admin-1",
                    token: {}
                }
            })
        ).resolves.toEqual({
            success: true,
            marker: "support-refunded"
        });
        await expect(
            paymentFunctions.convertCheckoutToOrder.handler({
                data: {
                    checkoutId: "checkout-1"
                }
            })
        ).resolves.toEqual({
            success: true,
            marker: "converted"
        });
    });

    test("handlers throw callable errors when payment work fails", async () => {
        const handler = functionsIndex.createInitializePaymentHandler({
            initializePayment: jest.fn(async () => ({
                success: false,
                error: {
                    code: "payments/problem",
                    message: "Could not initialize."
                }
            }))
        });

        await expect(handler({
            data: {
                order: {}
            }
        })).rejects.toMatchObject({
            name: "HttpsError",
            code: "failed-precondition",
            message: "Could not initialize."
        });
    });
});
