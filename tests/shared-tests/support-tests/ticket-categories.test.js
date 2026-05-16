const ticketCategories = require("../../../public/shared/support/ticket-categories.js");

describe("shared/support/ticket-categories.js", () => {
    test("exposes the expected module surface and constants", () => {
        expect(ticketCategories.MODULE_NAME).toBe("ticket-categories");

        expect(ticketCategories.TICKET_CATEGORIES).toEqual({
            ORDER_ISSUE: "order_issue",
            PAYMENT: "payment",
            REFUND: "refund",
            ACCOUNT: "account",
            ABUSE: "abuse",
            GENERAL: "general"
        });
        expect(Object.isFrozen(ticketCategories.TICKET_CATEGORIES)).toBe(true);
    });

    test("primitive text helpers behave defensively", () => {
        expect(ticketCategories.normalizeText("  hi  ")).toBe("hi");
        expect(ticketCategories.normalizeText(null)).toBe("");
        expect(ticketCategories.normalizeText(undefined)).toBe("");
        expect(ticketCategories.normalizeText(42)).toBe("");

        expect(ticketCategories.normalizeLowerText("  HeLLO  ")).toBe("hello");
        expect(ticketCategories.normalizeLowerText(null)).toBe("");

        expect(ticketCategories.normalizeCategoryKey("Order  Issue")).toBe("orderissue");
        expect(ticketCategories.normalizeCategoryKey("ORDER-ISSUE")).toBe("orderissue");
        expect(ticketCategories.normalizeCategoryKey("order_issue")).toBe("orderissue");
        expect(ticketCategories.normalizeCategoryKey(null)).toBe("");
    });

    test("normalizeTicketCategory resolves canonical categories and aliases", () => {
        expect(ticketCategories.normalizeTicketCategory("ORDER_ISSUE")).toBe("order_issue");
        expect(ticketCategories.normalizeTicketCategory("order issue")).toBe("order_issue");
        expect(ticketCategories.normalizeTicketCategory(" order-problem ")).toBe("order_issue");
        expect(ticketCategories.normalizeTicketCategory("missing order")).toBe("order_issue");
        expect(ticketCategories.normalizeTicketCategory("wrong item")).toBe("order_issue");
        expect(ticketCategories.normalizeTicketCategory("bad food")).toBe("order_issue");
        expect(ticketCategories.normalizeTicketCategory("late order")).toBe("order_issue");
        expect(ticketCategories.normalizeTicketCategory("delivery issue")).toBe("order_issue");

        expect(ticketCategories.normalizeTicketCategory("payment")).toBe("payment");
        expect(ticketCategories.normalizeTicketCategory("Payment Issue")).toBe("payment");
        expect(ticketCategories.normalizeTicketCategory("charged twice")).toBe("payment");
        expect(ticketCategories.normalizeTicketCategory("double charge")).toBe("payment");
        expect(ticketCategories.normalizeTicketCategory("doublecharged")).toBe("payment");
        expect(ticketCategories.normalizeTicketCategory("payment failed")).toBe("payment");
        expect(ticketCategories.normalizeTicketCategory("declined")).toBe("payment");
        expect(ticketCategories.normalizeTicketCategory("billing")).toBe("payment");
        expect(ticketCategories.normalizeTicketCategory("paystack")).toBe("payment");

        expect(ticketCategories.normalizeTicketCategory("refund")).toBe("refund");
        expect(ticketCategories.normalizeTicketCategory("Refund Request")).toBe("refund");
        expect(ticketCategories.normalizeTicketCategory("money back")).toBe("refund");
        expect(ticketCategories.normalizeTicketCategory("get money back")).toBe("refund");
        expect(ticketCategories.normalizeTicketCategory("reimbursement")).toBe("refund");
        expect(ticketCategories.normalizeTicketCategory("chargeback")).toBe("refund");

        expect(ticketCategories.normalizeTicketCategory("account")).toBe("account");
        expect(ticketCategories.normalizeTicketCategory("Login")).toBe("account");
        expect(ticketCategories.normalizeTicketCategory("sign-in")).toBe("account");
        expect(ticketCategories.normalizeTicketCategory("profile")).toBe("account");
        expect(ticketCategories.normalizeTicketCategory("access issue")).toBe("account");
        expect(ticketCategories.normalizeTicketCategory("password reset")).toBe("account");
        expect(ticketCategories.normalizeTicketCategory("password")).toBe("account");

        expect(ticketCategories.normalizeTicketCategory("abuse")).toBe("abuse");
        expect(ticketCategories.normalizeTicketCategory("Abuse or Safety")).toBe("abuse");
        expect(ticketCategories.normalizeTicketCategory("safety")).toBe("abuse");
        expect(ticketCategories.normalizeTicketCategory("harassment")).toBe("abuse");
        expect(ticketCategories.normalizeTicketCategory("scam")).toBe("abuse");
        expect(ticketCategories.normalizeTicketCategory("fraud")).toBe("abuse");
        expect(ticketCategories.normalizeTicketCategory("report user")).toBe("abuse");

        expect(ticketCategories.normalizeTicketCategory("general")).toBe("general");
        expect(ticketCategories.normalizeTicketCategory("other")).toBe("general");
        expect(ticketCategories.normalizeTicketCategory("contact")).toBe("general");
        expect(ticketCategories.normalizeTicketCategory("Contact Us")).toBe("general");
        expect(ticketCategories.normalizeTicketCategory("question")).toBe("general");
        expect(ticketCategories.normalizeTicketCategory("feedback")).toBe("general");
        expect(ticketCategories.normalizeTicketCategory("hello")).toBe("general");
    });

    test("normalizeTicketCategory uses fallbacks and returns empty for true unknowns", () => {
        expect(ticketCategories.normalizeTicketCategory("nonsense")).toBe("");
        expect(ticketCategories.normalizeTicketCategory(null)).toBe("");
        expect(ticketCategories.normalizeTicketCategory(undefined)).toBe("");
        expect(ticketCategories.normalizeTicketCategory("nonsense", "general")).toBe("general");
        expect(ticketCategories.normalizeTicketCategory("nonsense", "Order Issue")).toBe("order_issue");
        expect(ticketCategories.normalizeTicketCategory("nonsense", "also-nonsense")).toBe("");
    });

    test("getDefaultTicketCategory returns 'general'", () => {
        expect(ticketCategories.getDefaultTicketCategory()).toBe("general");
    });

    test("getTicketCategoryList returns an independent copy", () => {
        const list = ticketCategories.getTicketCategoryList();
        expect(list).toEqual([
            "order_issue",
            "payment",
            "refund",
            "account",
            "abuse",
            "general"
        ]);

        list.push("mutated");
        expect(ticketCategories.getTicketCategoryList()).not.toContain("mutated");
    });

    test("isKnownTicketCategory recognises canonical names and aliases", () => {
        expect(ticketCategories.isKnownTicketCategory("order_issue")).toBe(true);
        expect(ticketCategories.isKnownTicketCategory("PAYMENT")).toBe(true);
        expect(ticketCategories.isKnownTicketCategory("refund request")).toBe(true);
        expect(ticketCategories.isKnownTicketCategory("contact us")).toBe(true);
        expect(ticketCategories.isKnownTicketCategory("safety")).toBe(true);

        expect(ticketCategories.isKnownTicketCategory("nonsense")).toBe(false);
        expect(ticketCategories.isKnownTicketCategory("")).toBe(false);
        expect(ticketCategories.isKnownTicketCategory(null)).toBe(false);
    });

    test("getTicketCategoryMetadata returns full metadata for known categories and a fallback for unknowns", () => {
        expect(ticketCategories.getTicketCategoryMetadata("order_issue")).toEqual({
            key: "order_issue",
            label: "Order Issue",
            shortLabel: "Order",
            description: expect.any(String),
            tone: "error",
            orderRelated: true,
            paymentRelated: false
        });

        expect(ticketCategories.getTicketCategoryMetadata("Refund Request")).toEqual(
            expect.objectContaining({
                key: "refund",
                label: "Refund Request",
                tone: "warning",
                orderRelated: true,
                paymentRelated: true
            })
        );

        expect(ticketCategories.getTicketCategoryMetadata("payment").paymentRelated).toBe(true);
        expect(ticketCategories.getTicketCategoryMetadata("account").orderRelated).toBe(false);
        expect(ticketCategories.getTicketCategoryMetadata("abuse").tone).toBe("error");
        expect(ticketCategories.getTicketCategoryMetadata("general").tone).toBe("info");

        const unknown = ticketCategories.getTicketCategoryMetadata("nonsense");
        expect(unknown).toEqual({
            key: "",
            label: "Unknown Category",
            shortLabel: "Unknown",
            description: expect.any(String),
            tone: "info",
            orderRelated: false,
            paymentRelated: false
        });
    });

    test("label, short label, description, and tone helpers all read from metadata", () => {
        expect(ticketCategories.getTicketCategoryLabel("order_issue")).toBe("Order Issue");
        expect(ticketCategories.getTicketCategoryLabel("refund")).toBe("Refund Request");
        expect(ticketCategories.getTicketCategoryLabel("nonsense")).toBe("Unknown Category");

        expect(ticketCategories.getTicketCategoryShortLabel("payment")).toBe("Payment");
        expect(ticketCategories.getTicketCategoryShortLabel("abuse")).toBe("Abuse");
        expect(ticketCategories.getTicketCategoryShortLabel("nonsense")).toBe("Unknown");

        expect(ticketCategories.getTicketCategoryDescription("order_issue")).toEqual(expect.any(String));
        expect(ticketCategories.getTicketCategoryDescription("nonsense")).toEqual(expect.any(String));

        expect(ticketCategories.getTicketCategoryTone("order_issue")).toBe("error");
        expect(ticketCategories.getTicketCategoryTone("refund")).toBe("warning");
        expect(ticketCategories.getTicketCategoryTone("general")).toBe("info");
        expect(ticketCategories.getTicketCategoryTone("nonsense")).toBe("info");
    });

    test("isOrderRelatedCategory and isPaymentRelatedCategory partition categories correctly", () => {
        expect(ticketCategories.isOrderRelatedCategory("order_issue")).toBe(true);
        expect(ticketCategories.isOrderRelatedCategory("payment")).toBe(true);
        expect(ticketCategories.isOrderRelatedCategory("refund")).toBe(true);
        expect(ticketCategories.isOrderRelatedCategory("account")).toBe(false);
        expect(ticketCategories.isOrderRelatedCategory("abuse")).toBe(false);
        expect(ticketCategories.isOrderRelatedCategory("general")).toBe(false);
        expect(ticketCategories.isOrderRelatedCategory("nonsense")).toBe(false);

        expect(ticketCategories.isPaymentRelatedCategory("order_issue")).toBe(false);
        expect(ticketCategories.isPaymentRelatedCategory("payment")).toBe(true);
        expect(ticketCategories.isPaymentRelatedCategory("refund")).toBe(true);
        expect(ticketCategories.isPaymentRelatedCategory("account")).toBe(false);
        expect(ticketCategories.isPaymentRelatedCategory("abuse")).toBe(false);
        expect(ticketCategories.isPaymentRelatedCategory("general")).toBe(false);
        expect(ticketCategories.isPaymentRelatedCategory("nonsense")).toBe(false);

        // alias inputs work too
        expect(ticketCategories.isOrderRelatedCategory("missing order")).toBe(true);
        expect(ticketCategories.isPaymentRelatedCategory("chargeback")).toBe(true);
    });

    test("getOrderRelatedCategories and getPaymentRelatedCategories return the right subsets", () => {
        expect(ticketCategories.getOrderRelatedCategories()).toEqual([
            "order_issue",
            "payment",
            "refund"
        ]);

        expect(ticketCategories.getPaymentRelatedCategories()).toEqual([
            "payment",
            "refund"
        ]);
    });

    test("getTicketCategoryOptions returns one metadata object per known category in the canonical order", () => {
        const options = ticketCategories.getTicketCategoryOptions();

        expect(options).toHaveLength(6);
        expect(options.map((option) => option.key)).toEqual([
            "order_issue",
            "payment",
            "refund",
            "account",
            "abuse",
            "general"
        ]);
        expect(options[0]).toEqual(
            expect.objectContaining({
                key: "order_issue",
                label: "Order Issue",
                orderRelated: true
            })
        );
        expect(options[5]).toEqual(
            expect.objectContaining({
                key: "general",
                label: "General",
                orderRelated: false,
                paymentRelated: false
            })
        );

        // Mutating the returned options array should not affect future calls.
        options.push({ key: "mutated" });
        expect(ticketCategories.getTicketCategoryOptions()).toHaveLength(6);
    });

    test("the ticket-model resolver accepts ticket-categories because it exposes the required surface", () => {
        const ticketModel = require("../../../public/shared/support/ticket-model.js");

        expect(ticketModel.resolveTicketCategories(ticketCategories)).toBe(ticketCategories);

        // Unknown input with no caller-supplied fallback falls back to the module's own default ("general").
        expect(ticketModel.normalizeTicketCategory("nonsense", undefined, ticketCategories)).toBe("general");
        expect(ticketModel.normalizeTicketCategory("nonsense", "payment", ticketCategories)).toBe("payment");
        expect(ticketModel.normalizeTicketCategory("double charge", undefined, ticketCategories)).toBe("payment");
        expect(ticketModel.getTicketCategoryLabel("refund", ticketCategories)).toBe("Refund Request");
        expect(ticketModel.getTicketCategoryLabel("nonsense", ticketCategories)).toBe("Unknown Category");
    });
});
