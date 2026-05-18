(function attachTicketCategories(globalScope) {
    "use strict";

    const MODULE_NAME = "ticket-categories";

    const TICKET_CATEGORIES = Object.freeze({
        ORDER_ISSUE: "order_issue",
        PAYMENT: "payment",
        REFUND: "refund",
        ACCOUNT: "account",
        ABUSE: "abuse",
        GENERAL: "general"
    });

    const TICKET_CATEGORY_LIST = Object.freeze([
        TICKET_CATEGORIES.ORDER_ISSUE,
        TICKET_CATEGORIES.PAYMENT,
        TICKET_CATEGORIES.REFUND,
        TICKET_CATEGORIES.ACCOUNT,
        TICKET_CATEGORIES.ABUSE,
        TICKET_CATEGORIES.GENERAL
    ]);

    const CATEGORY_METADATA = Object.freeze({
        [TICKET_CATEGORIES.ORDER_ISSUE]: Object.freeze({
            label: "Order Issue",
            shortLabel: "Order",
            description: "Something went wrong with a specific order — wrong item, missing food, or it never arrived.",
            tone: "error",
            orderRelated: true,
            paymentRelated: false
        }),
        [TICKET_CATEGORIES.PAYMENT]: Object.freeze({
            label: "Payment Issue",
            shortLabel: "Payment",
            description: "A problem with a charge, a double-billing, or a payment that did not go through.",
            tone: "error",
            orderRelated: true,
            paymentRelated: true
        }),
        [TICKET_CATEGORIES.REFUND]: Object.freeze({
            label: "Refund Request",
            shortLabel: "Refund",
            description: "Request money back for a paid order.",
            tone: "warning",
            orderRelated: true,
            paymentRelated: true
        }),
        [TICKET_CATEGORIES.ACCOUNT]: Object.freeze({
            label: "Account",
            shortLabel: "Account",
            description: "Login, profile, or access problems with your account.",
            tone: "info",
            orderRelated: false,
            paymentRelated: false
        }),
        [TICKET_CATEGORIES.ABUSE]: Object.freeze({
            label: "Abuse or Safety",
            shortLabel: "Abuse",
            description: "Report unsafe, abusive, or fraudulent behaviour on the platform.",
            tone: "error",
            orderRelated: false,
            paymentRelated: false
        }),
        [TICKET_CATEGORIES.GENERAL]: Object.freeze({
            label: "General",
            shortLabel: "General",
            description: "Contact us about anything that does not fit the other categories.",
            tone: "info",
            orderRelated: false,
            paymentRelated: false
        })
    });

    const TICKET_CATEGORY_ALIASES = Object.freeze({
        orderissue: TICKET_CATEGORIES.ORDER_ISSUE,
        order: TICKET_CATEGORIES.ORDER_ISSUE,
        orderproblem: TICKET_CATEGORIES.ORDER_ISSUE,
        missingorder: TICKET_CATEGORIES.ORDER_ISSUE,
        wrongorder: TICKET_CATEGORIES.ORDER_ISSUE,
        wrongitem: TICKET_CATEGORIES.ORDER_ISSUE,
        badfood: TICKET_CATEGORIES.ORDER_ISSUE,
        foodissue: TICKET_CATEGORIES.ORDER_ISSUE,
        foodquality: TICKET_CATEGORIES.ORDER_ISSUE,
        lateorder: TICKET_CATEGORIES.ORDER_ISSUE,
        deliveryissue: TICKET_CATEGORIES.ORDER_ISSUE,

        payment: TICKET_CATEGORIES.PAYMENT,
        paymentissue: TICKET_CATEGORIES.PAYMENT,
        paymentproblem: TICKET_CATEGORIES.PAYMENT,
        chargedtwice: TICKET_CATEGORIES.PAYMENT,
        doublecharge: TICKET_CATEGORIES.PAYMENT,
        doublecharged: TICKET_CATEGORIES.PAYMENT,
        paymentfailed: TICKET_CATEGORIES.PAYMENT,
        declined: TICKET_CATEGORIES.PAYMENT,
        billing: TICKET_CATEGORIES.PAYMENT,
        charge: TICKET_CATEGORIES.PAYMENT,
        paystack: TICKET_CATEGORIES.PAYMENT,

        refund: TICKET_CATEGORIES.REFUND,
        refundrequest: TICKET_CATEGORIES.REFUND,
        moneyback: TICKET_CATEGORIES.REFUND,
        getmoneyback: TICKET_CATEGORIES.REFUND,
        reimbursement: TICKET_CATEGORIES.REFUND,
        chargeback: TICKET_CATEGORIES.REFUND,

        account: TICKET_CATEGORIES.ACCOUNT,
        accountissue: TICKET_CATEGORIES.ACCOUNT,
        login: TICKET_CATEGORIES.ACCOUNT,
        loginissue: TICKET_CATEGORIES.ACCOUNT,
        signin: TICKET_CATEGORIES.ACCOUNT,
        profile: TICKET_CATEGORIES.ACCOUNT,
        access: TICKET_CATEGORIES.ACCOUNT,
        accessissue: TICKET_CATEGORIES.ACCOUNT,
        passwordreset: TICKET_CATEGORIES.ACCOUNT,
        password: TICKET_CATEGORIES.ACCOUNT,

        abuse: TICKET_CATEGORIES.ABUSE,
        abuseorsafety: TICKET_CATEGORIES.ABUSE,
        safety: TICKET_CATEGORIES.ABUSE,
        harassment: TICKET_CATEGORIES.ABUSE,
        scam: TICKET_CATEGORIES.ABUSE,
        fraud: TICKET_CATEGORIES.ABUSE,
        report: TICKET_CATEGORIES.ABUSE,
        reportuser: TICKET_CATEGORIES.ABUSE,

        general: TICKET_CATEGORIES.GENERAL,
        other: TICKET_CATEGORIES.GENERAL,
        contact: TICKET_CATEGORIES.GENERAL,
        contactus: TICKET_CATEGORIES.GENERAL,
        question: TICKET_CATEGORIES.GENERAL,
        feedback: TICKET_CATEGORIES.GENERAL,
        hello: TICKET_CATEGORIES.GENERAL
    });

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
    }

    function normalizeCategoryKey(value) {
        return normalizeLowerText(value).replace(/[\s_-]+/g, "");
    }

    function normalizeTicketCategory(category, fallbackCategory) {
        const key = normalizeCategoryKey(category);
        const fallbackKey = normalizeCategoryKey(fallbackCategory);

        if (Object.prototype.hasOwnProperty.call(TICKET_CATEGORY_ALIASES, key)) {
            return TICKET_CATEGORY_ALIASES[key];
        }

        if (Object.prototype.hasOwnProperty.call(TICKET_CATEGORY_ALIASES, fallbackKey)) {
            return TICKET_CATEGORY_ALIASES[fallbackKey];
        }

        return "";
    }

    function getDefaultTicketCategory() {
        return TICKET_CATEGORIES.GENERAL;
    }

    function getTicketCategoryList() {
        return TICKET_CATEGORY_LIST.slice();
    }

    function isKnownTicketCategory(category) {
        const key = normalizeCategoryKey(category);
        return Object.prototype.hasOwnProperty.call(TICKET_CATEGORY_ALIASES, key);
    }

    function getTicketCategoryMetadata(category) {
        const normalizedCategory = normalizeTicketCategory(category);
        const metadata = CATEGORY_METADATA[normalizedCategory];

        if (!metadata) {
            return {
                key: "",
                label: "Unknown Category",
                shortLabel: "Unknown",
                description: "The ticket category is not recognised yet.",
                tone: "info",
                orderRelated: false,
                paymentRelated: false
            };
        }

        return {
            key: normalizedCategory,
            label: metadata.label,
            shortLabel: metadata.shortLabel,
            description: metadata.description,
            tone: metadata.tone,
            orderRelated: metadata.orderRelated,
            paymentRelated: metadata.paymentRelated
        };
    }

    function getTicketCategoryLabel(category) {
        return getTicketCategoryMetadata(category).label;
    }

    function getTicketCategoryShortLabel(category) {
        return getTicketCategoryMetadata(category).shortLabel;
    }

    function getTicketCategoryDescription(category) {
        return getTicketCategoryMetadata(category).description;
    }

    function getTicketCategoryTone(category) {
        return getTicketCategoryMetadata(category).tone;
    }

    function isOrderRelatedCategory(category) {
        return getTicketCategoryMetadata(category).orderRelated === true;
    }

    function isPaymentRelatedCategory(category) {
        return getTicketCategoryMetadata(category).paymentRelated === true;
    }

    function getOrderRelatedCategories() {
        return TICKET_CATEGORY_LIST.filter(function keepOrderRelated(category) {
            return CATEGORY_METADATA[category].orderRelated === true;
        });
    }

    function getPaymentRelatedCategories() {
        return TICKET_CATEGORY_LIST.filter(function keepPaymentRelated(category) {
            return CATEGORY_METADATA[category].paymentRelated === true;
        });
    }

    function getTicketCategoryOptions() {
        return TICKET_CATEGORY_LIST.map(function buildOption(category) {
            return getTicketCategoryMetadata(category);
        });
    }

    const ticketCategories = {
        MODULE_NAME,
        TICKET_CATEGORIES,
        normalizeText,
        normalizeLowerText,
        normalizeCategoryKey,
        normalizeTicketCategory,
        getDefaultTicketCategory,
        getTicketCategoryList,
        isKnownTicketCategory,
        getTicketCategoryMetadata,
        getTicketCategoryLabel,
        getTicketCategoryShortLabel,
        getTicketCategoryDescription,
        getTicketCategoryTone,
        isOrderRelatedCategory,
        isPaymentRelatedCategory,
        getOrderRelatedCategories,
        getPaymentRelatedCategories,
        getTicketCategoryOptions
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = ticketCategories;
    }

    if (typeof globalScope !== "undefined") {
        globalScope.ticketCategories = ticketCategories;
    }
})(typeof window !== "undefined" ? window : globalThis);
