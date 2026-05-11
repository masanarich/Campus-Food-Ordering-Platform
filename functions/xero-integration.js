/**
 * Xero Integration
 * Syncs payments, invoices, and settlements to Xero as accounting system of record
 * Xero is read-only for accounting - all financial truth lives in Firestore
 */

const axios = require("axios");

const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";

class XeroIntegration {
    constructor(config) {
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.redirectUri = config.redirectUri;
        this.tenantId = config.tenantId;
        this.refreshToken = config.refreshToken;
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Gets or refreshes Xero access token
     * Uses refresh token flow
     */
    async getAccessToken() {
        if (this.accessToken && this.tokenExpiry > Date.now()) {
            return this.accessToken;
        }

        try {
            const response = await axios.post("https://identity.xero.com/connect/token", {
                grant_type: "refresh_token",
                client_id: this.clientId,
                client_secret: this.clientSecret,
                refresh_token: this.refreshToken
            });

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

            return this.accessToken;
        } catch (error) {
            console.error("Error refreshing Xero token:", error);
            throw error;
        }
    }

    /**
     * Makes authenticated request to Xero API
     */
    async makeRequest(method, endpoint, data = null) {
        const token = await this.getAccessToken();

        const headers = {
            Authorization: `Bearer ${token}`,
            "Xero-tenant-id": this.tenantId,
            "Content-Type": "application/json"
        };

        try {
            const response = await axios({
                method,
                url: `${XERO_API_BASE}${endpoint}`,
                headers,
                data
            });

            return response.data;
        } catch (error) {
            console.error(`Xero API error: ${method} ${endpoint}`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Gets or creates a contact (customer or vendor)
     */
    async getOrCreateContact(contactData) {
        const {
            email,
            name,
            type = "CUSTOMER" // CUSTOMER or VENDOR
        } = contactData;

        try {
            // Search for existing contact
            const where = `Status=="ACTIVE"&&EmailAddress=="${email}"`;
            const response = await this.makeRequest("GET", `/Contacts?where=${encodeURIComponent(where)}`);

            if (response.Contacts && response.Contacts.length > 0) {
                return response.Contacts[0];
            }

            // Create new contact
            const newContact = {
                Name: name,
                EmailAddress: email,
                ContactStatus: "ACTIVE",
                ContactNumber: Math.random().toString(36).substring(7).toUpperCase()
            };

            const createResponse = await this.makeRequest("POST", "/Contacts", { Contacts: [newContact] });
            return createResponse.Contacts[0];
        } catch (error) {
            console.error("Error getting or creating contact:", error);
            throw error;
        }
    }

    /**
     * Creates an invoice for an order
     */
    async createInvoice(invoiceData) {
        const {
            orderId,
            customerId,
            customerName,
            customerEmail,
            amount,
            items = [],
            dueDate = null,
            notes = ""
        } = invoiceData;

        try {
            // Get or create contact
            const contact = await this.getOrCreateContact({
                email: customerEmail,
                name: customerName,
                type: "CUSTOMER"
            });

            const invoiceLines = items.map(item => ({
                Description: item.name,
                Quantity: item.quantity,
                UnitAmount: item.price,
                AccountCode: "200" // Revenue account
            }));

            const invoice = {
                Type: "ACCREC",
                Status: "DRAFT",
                LineAmountTypes: "Exclusive",
                Contact: {
                    ContactID: contact.ContactID
                },
                InvoiceNumber: `ORD-${orderId.substring(0, 8).toUpperCase()}`,
                Description: `Order ${orderId}`,
                DueDate: dueDate ? new Date(dueDate).toISOString().split("T")[0] : null,
                LineItems: invoiceLines,
                Reference: orderId,
                Notes: notes || `Campus Food Order #${orderId}`
            };

            const response = await this.makeRequest("POST", "/Invoices", { Invoices: [invoice] });

            if (response.Invoices && response.Invoices.length > 0) {
                return response.Invoices[0];
            }

            throw new Error("Invoice creation failed");
        } catch (error) {
            console.error("Error creating Xero invoice:", error);
            throw error;
        }
    }

    /**
     * Records a payment against an invoice
     */
    async recordPayment(paymentData) {
        const {
            invoiceId,
            orderId,
            amount,
            paymentDate = new Date(),
            reference = ""
        } = paymentData;

        try {
            const payment = {
                Invoice: {
                    InvoiceID: invoiceId
                },
                Account: {
                    Code: "200" // Bank account
                },
                Amount: amount,
                PaymentType: "ACCRECPAYMENT",
                Status: "AUTHORISED",
                PaymentDate: new Date(paymentDate).toISOString().split("T")[0],
                Reference: reference || `Payment for order ${orderId}`
            };

            const response = await this.makeRequest("POST", "/Payments", { Payments: [payment] });

            if (response.Payments && response.Payments.length > 0) {
                return response.Payments[0];
            }

            throw new Error("Payment recording failed");
        } catch (error) {
            console.error("Error recording payment in Xero:", error);
            throw error;
        }
    }

    /**
     * Creates a bill for vendor payable
     */
    async createVendorBill(billData) {
        const {
            payoutId,
            vendorId,
            vendorName,
            vendorEmail,
            amount,
            description = ""
        } = billData;

        try {
            // Get or create vendor contact
            const contact = await this.getOrCreateContact({
                email: vendorEmail || `vendor-${vendorId}@platform.local`,
                name: vendorName,
                type: "VENDOR"
            });

            const bill = {
                Type: "ACCPAY",
                Status: "DRAFT",
                LineAmountTypes: "Exclusive",
                Contact: {
                    ContactID: contact.ContactID
                },
                InvoiceNumber: `PAY-${payoutId.substring(0, 8).toUpperCase()}`,
                Description: description || `Payout for vendor ${vendorName}`,
                LineItems: [
                    {
                        Description: description || "Vendor payout",
                        Quantity: 1,
                        UnitAmount: amount,
                        AccountCode: "300" // Expense account
                    }
                ],
                Reference: payoutId,
                Status: "SUBMITTED" // Auto-submit bill
            };

            const response = await this.makeRequest("POST", "/Invoices", { Invoices: [bill] });

            if (response.Invoices && response.Invoices.length > 0) {
                return response.Invoices[0];
            }

            throw new Error("Bill creation failed");
        } catch (error) {
            console.error("Error creating vendor bill in Xero:", error);
            throw error;
        }
    }

    /**
     * Creates a bank transaction for batch payout
     */
    async recordBatchPayout(payoutData) {
        const {
            batchId,
            totalAmount,
            payoutDate = new Date(),
            description = ""
        } = payoutData;

        try {
            const transaction = {
                Type: "SPEND",
                Status: "AUTHORISED",
                LineAmountTypes: "Exclusive",
                Contact: {
                    ContactID: "00000000-0000-0000-0000-000000000000" // Null contact for internal transfers
                },
                BankAccount: {
                    Code: "200"
                },
                HasAttachments: false,
                Date: new Date(payoutDate).toISOString().split("T")[0],
                LineItems: [
                    {
                        Description: description || `Batch payout ${batchId}`,
                        Quantity: 1,
                        UnitAmount: totalAmount,
                        AccountCode: "2100" // Vendor payables liability
                    }
                ],
                Reference: batchId,
                Notes: `Platform batch payout - ${new Date(payoutDate).toLocaleDateString()}`
            };

            const response = await this.makeRequest("POST", "/BankTransactions", { BankTransactions: [transaction] });

            if (response.BankTransactions && response.BankTransactions.length > 0) {
                return response.BankTransactions[0];
            }

            throw new Error("Bank transaction creation failed");
        } catch (error) {
            console.error("Error recording payout in Xero:", error);
            throw error;
        }
    }

    /**
     * Gets invoice by reference
     */
    async getInvoiceByReference(reference) {
        try {
            const where = `Reference=="${reference}"`;
            const response = await this.makeRequest("GET", `/Invoices?where=${encodeURIComponent(where)}`);

            if (response.Invoices && response.Invoices.length > 0) {
                return response.Invoices[0];
            }

            return null;
        } catch (error) {
            console.error("Error getting invoice:", error);
            throw error;
        }
    }

    /**
     * Gets list of tracking categories for multi-currency or cost centers
     */
    async getTrackingCategories() {
        try {
            const response = await this.makeRequest("GET", "/TrackingCategories");
            return response.TrackingCategories || [];
        } catch (error) {
            console.error("Error getting tracking categories:", error);
            throw error;
        }
    }
}

/**
 * Firestore function to sync payment to Xero
 * Called from Cloud Functions
 */
async function syncPaymentToXero(db, orderId, paymentId, xeroConfig) {
    try {
        const xero = new XeroIntegration(xeroConfig);

        // Get order and payment
        const orderDoc = await db.collection("orders").doc(orderId).get();
        const paymentDoc = await db.collection("payments").doc(paymentId).get();

        if (!orderDoc.exists || !paymentDoc.exists) {
            throw new Error("Order or payment not found");
        }

        const order = orderDoc.data();
        const payment = paymentDoc.data();

        // Create invoice
        const invoice = await xero.createInvoice({
            orderId,
            customerId: order.customerId,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            amount: payment.amount,
            items: order.items || [],
            notes: `PayFast Payment ID: ${payment.payFastPaymentId}`
        });

        // Record payment
        const xeroPayment = await xero.recordPayment({
            invoiceId: invoice.InvoiceID,
            orderId,
            amount: payment.amountNet,
            reference: payment.payFastPaymentId
        });

        // Store mapping in Firestore
        const mapping = {
            mappingId: db.collection("xeroMappings").doc().id,
            source: "order",
            sourceId: orderId,
            xeroEntityType: "Invoice",
            xeroEntityId: invoice.InvoiceID,
            xeroContactId: invoice.Contact.ContactID,
            status: "synced",
            syncedAt: new Date(),
            metadata: {
                paymentXeroId: xeroPayment.PaymentID,
                syncAttempts: 1
            }
        };

        await db.collection("xeroMappings").doc(mapping.mappingId).set(mapping);

        return mapping;
    } catch (error) {
        console.error("Error syncing to Xero:", error);
        throw error;
    }
}

module.exports = {
    XeroIntegration,
    syncPaymentToXero
};
