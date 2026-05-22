/**
 * Rule-shape sanity test.
 *
 * Firestore rules can't be unit-tested without the emulator, but we can
 * verify that every payload + patch the service produces structurally
 * matches what the published rules in firestore.rules will accept. This
 * catches drift between the service and the rules.
 *
 * If you change the rule whitelists in firestore.rules, mirror the
 * change here too — they should always agree.
 */

const fs = require("fs");
const path = require("path");

const ticketModel = require("../../../public/shared/support/ticket-model.js");
const ticketService = require("../../../public/shared/support/ticket-service.js");
const recommendationQueries = require("../../../public/shared/recommendations/recommendation-queries.js");

const RULES_FILE = path.resolve(__dirname, "../../../firestore.rules");
const RULES_TEXT = fs.readFileSync(RULES_FILE, "utf8");

// Keep these in lock-step with firestore.rules — the test below also
// re-parses the rules file as a second check.
const ADMIN_ALLOWED_UPDATE_KEYS = [
    "status",
    "statusLabel",
    "priority",
    "replyCount",
    "lastReplyAt",
    "resolvedAt",
    "resolvedByUid",
    "resolvedByName",
    "resolutionNote",
    "refundCase",
    "timeline",
    "updatedAt",
    "categoryLabel"
];

const PARTICIPANT_ALLOWED_UPDATE_KEYS = [
    "status",
    "statusLabel",
    "replyCount",
    "lastReplyAt",
    "refundCase",
    "timeline",
    "updatedAt"
];

const PARTICIPANT_ALLOWED_STATUS_VALUES = [
    "open",
    "in_progress",
    "awaiting_user",
    "closed"
];

const TICKET_IMMUTABLE_FIELDS = [
    "ticketId",
    "reporterUid",
    "reporterRole",
    "createdAt",
    "subject",
    "description",
    "category",
    "orderId",
    "customerUid",
    "vendorUid"
];

const REPLY_ALLOWED_AUTHOR_ROLES = ["customer", "vendor", "admin"];

const CHECKOUT_CREATE_ALLOWED_KEYS = [
    "checkoutId",
    "customerUid",
    "customerName",
    "customerEmail",
    "vendorUid",
    "vendorName",
    "items",
    "itemCount",
    "subtotal",
    "total",
    "vendorSubtotal",
    "vendorEarnings",
    "platformFeeRate",
    "platformFee",
    "platformEarnings",
    "customerTotal",
    "financeModel",
    "status",
    "paymentProvider",
    "paymentReference",
    "paymentAccessCode",
    "paymentAuthorizationUrl",
    "paymentAmount",
    "paymentAmountInMinorUnits",
    "paymentCurrency",
    "paymentPaidAt",
    "paymentFailedAt",
    "paymentVerifiedAt",
    "paymentFailureReason",
    "convertedOrderId",
    "convertedAt",
    "cancelledAt",
    "expiredAt",
    "refundStatus",
    "refundReference",
    "metadata",
    "timeline",
    "notes",
    "createdAt",
    "updatedAt"
];

const CHECKOUT_CUSTOMER_UPDATE_ALLOWED_KEYS = [
    "status",
    "paymentProvider",
    "paymentReference",
    "paymentAccessCode",
    "paymentAuthorizationUrl",
    "paymentAmount",
    "paymentAmountInMinorUnits",
    "paymentCurrency",
    "paymentFailedAt",
    "paymentFailureReason",
    "cancelledAt",
    "expiredAt",
    "metadata",
    "timeline",
    "notes",
    "updatedAt"
];

const CHECKOUT_CUSTOMER_WRITABLE_STATUSES = [
    "draft",
    "payment_pending",
    "payment_failed",
    "cancelled",
    "expired"
];

const PAYOUT_CREATE_ALLOWED_KEYS = [
    "payoutId",
    "vendorUid",
    "vendorName",
    "vendorEmail",
    "amount",
    "amountInMinorUnits",
    "currency",
    "status",
    "statusLabel",
    "fakeBankName",
    "fakeAccountHolder",
    "fakeAccountNumberLast4",
    "fakeAccountNumberMasked",
    "fakeBranchCode",
    "fakeAccountType",
    "requestedAt",
    "approvedAt",
    "paidAt",
    "rejectedAt",
    "cancelledAt",
    "processedAt",
    "processedByUid",
    "processedByName",
    "rejectionReason",
    "notes",
    "testMode",
    "testEmailQueued",
    "emailNotificationId",
    "timeline",
    "createdAt",
    "updatedAt"
];

const PAYOUT_UPDATE_ALLOWED_KEYS = [
    "status",
    "statusLabel",
    "approvedAt",
    "paidAt",
    "rejectedAt",
    "cancelledAt",
    "processedAt",
    "processedByUid",
    "processedByName",
    "rejectionReason",
    "testEmailQueued",
    "emailNotificationId",
    "timeline",
    "updatedAt"
];

function extractStringList(text, functionName) {
    // Pull the hasOnly([...]) array out of a given rule function.
    const re = new RegExp(
        functionName + "[\\s\\S]*?hasOnly\\(\\[([\\s\\S]*?)\\]\\)"
    );
    const match = re.exec(text);
    if (!match) return null;
    return match[1]
        .split(",")
        .map(function trim(part) {
            return part.replace(/[\s"]/g, "");
        })
        .filter(Boolean);
}

function stripRuleComments(text) {
    return text.replace(/\/\/.*$/gm, "");
}

function affectedKeys(before, after) {
    // Mirror Firestore's `request.resource.data.diff(resource.data).affectedKeys()`.
    const keys = new Set();
    Object.keys(before || {}).forEach((k) => keys.add(k));
    Object.keys(after || {}).forEach((k) => keys.add(k));
    const changed = [];
    keys.forEach(function compare(k) {
        const a = before ? before[k] : undefined;
        const b = after ? after[k] : undefined;
        if (JSON.stringify(a) !== JSON.stringify(b)) {
            changed.push(k);
        }
    });
    return changed;
}

function makeValidTicket(overrides = {}) {
    return ticketModel.createTicketRecord({
        ticketId: "ticket-rule-1",
        reporter: {
            uid: "customer-1",
            displayName: "Naledi",
            email: "naledi@example.com",
            role: "customer"
        },
        subject: "Order never arrived",
        description: "The driver did not show up.",
        category: "order_issue",
        orderId: "order-7",
        customerUid: "customer-1",
        vendorUid: "vendor-1",
        priority: "normal",
        createdAt: "2026-05-16T10:00:00.000Z",
        updatedAt: "2026-05-16T10:00:00.000Z",
        ...overrides
    });
}

function makePaidOrder(overrides = {}) {
    return {
        orderId: "order-7",
        checkoutId: "checkout-7",
        customerUid: "customer-1",
        vendorUid: "vendor-1",
        status: "completed",
        paymentStatus: "paid",
        paymentReference: "paystack-ref-7",
        paymentAmount: 120,
        paymentAmountInMinorUnits: 12000,
        paymentCurrency: "ZAR",
        vendorEarnings: 108,
        platformEarnings: 12,
        ...overrides
    };
}

describe("firestore.rules - tickets (whitelist parity)", () => {
    test("auth helpers treat missing accountStatus as active but still require active when present", () => {
        expect(RULES_TEXT).toMatch(/function\s+isActiveAccount\(\)[\s\S]*?get\("accountStatus",\s*"active"\)\s*==\s*"active"/);
        expect(RULES_TEXT).toMatch(/function\s+isApprovedVendor\(\)[\s\S]*?vendorStatus\s*==\s*"approved"[\s\S]*?get\("accountStatus",\s*"active"\)\s*==\s*"active"/);
        expect(RULES_TEXT).toMatch(/function\s+isApprovedVendor\(\)[\s\S]*?get\("isVendor",\s*false\)\s*==\s*true/);
        expect(RULES_TEXT).toMatch(/function\s+isApprovedVendor\(\)[\s\S]*?get\("roles",\s*\{\}\)\.get\("vendor",\s*false\)\s*==\s*true/);
    });

    test("the rules file actually contains a /supportTickets match block with /replies", () => {
        expect(RULES_TEXT).toMatch(/match\s+\/supportTickets\/\{ticketId\}\s*\{/);
        expect(RULES_TEXT).toMatch(/match\s+\/replies\/\{replyId\}\s*\{/);
        expect(RULES_TEXT).toMatch(/allow\s+create:\s*if\s+isValidTicketCreate\(\);/);
        expect(RULES_TEXT).toMatch(/allow\s+update:\s*if\s+isValidTicketUpdate\(\);/);
        expect(RULES_TEXT).toMatch(/allow\s+delete:\s*if\s+isAdmin(?:OrOwner)?\(\);/);
    });

    test("admin allowed-update keys in rules match the local mirror", () => {
        const parsed = extractStringList(RULES_TEXT, "ticketUpdateAffectsOnlyAllowedKeys");
        expect(parsed).toEqual(ADMIN_ALLOWED_UPDATE_KEYS);
    });

    test("participant allowed-update keys in rules match the local mirror", () => {
        const parsed = extractStringList(
            RULES_TEXT,
            "participantTicketUpdateAffectsOnlyParticipantKeys"
        );
        expect(parsed).toEqual(PARTICIPANT_ALLOWED_UPDATE_KEYS);
    });

    test("ticket create rule blocks client-seeded refund cases", () => {
        const block = /function isValidTicketCreate[\s\S]*?\}\s*\n/.exec(RULES_TEXT);

        expect(block).not.toBeNull();
        expect(block[0]).toMatch(/refundCase/);
        expect(block[0]).toMatch(/request\.resource\.data\.get\("refundCase",\s*null\)\s*==\s*null/);
    });

    test("immutable-fields list in rules covers everything we expect", () => {
        // ticketImmutableFieldsPreserved doesn't use hasOnly so we just sanity-check
        // that each immutable field name appears in the rule body.
        TICKET_IMMUTABLE_FIELDS.forEach(function expectField(field) {
            expect(RULES_TEXT).toMatch(new RegExp(field));
        });
    });

    test("participant status whitelist in rules matches the local mirror", () => {
        const block = /participantStatusChangeIsAllowed[\s\S]*?\}\s*\n/.exec(RULES_TEXT);
        expect(block).not.toBeNull();
        PARTICIPANT_ALLOWED_STATUS_VALUES.forEach(function expectStatus(s) {
            expect(block[0]).toMatch(new RegExp("\"" + s + "\""));
        });
        // Critically: "resolved" must NOT be in the participant status whitelist.
        expect(block[0]).not.toMatch(/"resolved"/);
    });

    test("participant refund-case rule allows only customer/vendor decision fields", () => {
        const customerBlock = /function customerRefundCaseDecisionKeysAreAllowed[\s\S]*?\}\s*\n/.exec(RULES_TEXT);
        const vendorBlock = /function vendorRefundCaseDecisionKeysAreAllowed[\s\S]*?\}\s*\n/.exec(RULES_TEXT);
        const coreFieldsBlock = /function refundCaseCoreFieldsPreserved[\s\S]*?\}\s*\n/.exec(RULES_TEXT);
        const participantBlock = /function participantRefundCaseUpdateIsAllowed[\s\S]*?function isValidTicketUpdate/.exec(RULES_TEXT);

        expect(customerBlock).not.toBeNull();
        expect(vendorBlock).not.toBeNull();
        expect(coreFieldsBlock).not.toBeNull();
        expect(participantBlock).not.toBeNull();

        [
            "status",
            "statusLabel",
            "customerDecision",
            "customerDecidedAt",
            "customerNote",
            "timeline",
            "updatedAt"
        ].forEach(function expectCustomerDecisionKey(field) {
            expect(customerBlock[0]).toMatch(new RegExp("\"" + field + "\""));
        });

        [
            "status",
            "statusLabel",
            "vendorDecision",
            "vendorDecidedAt",
            "vendorNote",
            "timeline",
            "updatedAt"
        ].forEach(function expectVendorDecisionKey(field) {
            expect(vendorBlock[0]).toMatch(new RegExp("\"" + field + "\""));
        });

        [
            "ticketId",
            "orderId",
            "customerUid",
            "vendorUid",
            "type",
            "amount",
            "amountInMinorUnits",
            "reason",
            "proposedByUid",
            "proposedAt",
            "createdAt"
        ].forEach(function expectPreservedField(field) {
            expect(coreFieldsBlock[0]).toMatch(new RegExp(field));
        });

        expect(participantBlock[0]).toMatch(/isTicketCustomerParty\(\)/);
        expect(participantBlock[0]).toMatch(/isTicketVendorParty\(\)/);
        expect(participantBlock[0]).toMatch(/"approved"/);
        expect(participantBlock[0]).toMatch(/"declined"/);
        expect(participantBlock[0]).not.toMatch(/refundId/);
        expect(participantBlock[0]).not.toMatch(/refundReference/);
    });

    test("reply create rule whitelists customer, vendor, admin author roles", () => {
        const block = /isValidReplyCreate[\s\S]*?\}\s*\n/.exec(RULES_TEXT);
        expect(block).not.toBeNull();
        REPLY_ALLOWED_AUTHOR_ROLES.forEach(function expectRole(r) {
            expect(block[0]).toMatch(new RegExp("\"" + r + "\""));
        });
        // System replies must NOT be writeable from the client.
        expect(block[0]).not.toMatch(/"system"/);
        // Internal notes are admin-only — the rule must check both authorRole AND admin/owner privileges.
        expect(block[0]).toMatch(/isInternalNote/);
        expect(block[0]).toMatch(/isAdmin(?:OrOwner)?\(\)/);
    });
});

describe("firestore.rules - checkout sessions (security shape)", () => {
    test("the rules file contains a /checkoutSessions match block", () => {
        const block = /match\s+\/checkoutSessions\/\{checkoutId\}\s*\{[\s\S]*?\n\s{4}\}/.exec(RULES_TEXT);
        expect(block).not.toBeNull();

        expect(block[0]).toMatch(/allow\s+create:\s*if\s+isValidCheckoutCreate\(\)\s*\|\|\s*isAdmin(?:OrOwner)?\(\);/);
        expect(block[0]).toMatch(/allow\s+update:\s*if\s+isValidCheckoutCustomerUpdate\(\)\s*\|\|\s*isAdmin(?:OrOwner)?\(\);/);

        // Owner read: either via the isCheckoutCustomer() helper OR inlined
        // as resource.data.customerUid == request.auth.uid (the inlined form
        // lets Firestore's list-query analyzer prove the where(customerUid)
        // query is always safe).
        const ownerReadHelper = /allow\s+get,\s*list:\s*if\s+isCheckoutCustomer\(\)\s*\|\|\s*isAdmin(?:OrOwner)?\(\);/;
        const ownerReadInlined = /allow\s+get,\s*list:\s*if\s+signedIn\(\)\s*&&\s*resource\.data\.customerUid\s*==\s*request\.auth\.uid;/;
        expect(
            ownerReadHelper.test(block[0]) || ownerReadInlined.test(block[0])
        ).toBe(true);

        // Admin read must always be permitted somewhere in the block.
        expect(block[0]).toMatch(/allow\s+get,\s*list:\s*if\s+isAdmin(?:OrOwner)?\(\);|allow\s+get,\s*list:\s*if\s+isCheckoutCustomer\(\)\s*\|\|\s*isAdmin(?:OrOwner)?\(\);/);
    });

    test("customer checkout create keys match the local mirror", () => {
        const parsed = extractStringList(RULES_TEXT, "checkoutCreateAffectsOnlyAllowedKeys");
        expect(parsed).toEqual(CHECKOUT_CREATE_ALLOWED_KEYS);
    });

    test("customer checkout update keys match the local mirror", () => {
        const parsed = extractStringList(RULES_TEXT, "checkoutUpdateAffectsOnlyCustomerKeys");
        expect(parsed).toEqual(CHECKOUT_CUSTOMER_UPDATE_ALLOWED_KEYS);
    });

    test("customer-writable checkout statuses exclude server-only paid and converted states", () => {
        const block = /checkoutClientWritableStatus[\s\S]*?\}\s*\n/.exec(RULES_TEXT);
        expect(block).not.toBeNull();

        CHECKOUT_CUSTOMER_WRITABLE_STATUSES.forEach(function expectStatus(status) {
            expect(block[0]).toMatch(new RegExp("\"" + status + "\""));
        });
        expect(block[0]).not.toMatch(/"paid"/);
        expect(block[0]).not.toMatch(/"converted"/);
        expect(block[0]).not.toMatch(/"refunded"/);
    });

    test("checkout create and update rules preserve server-only payment/conversion fields", () => {
        expect(RULES_TEXT).toMatch(/checkoutServerOnlyFieldsAreEmptyOnCreate/);
        expect(RULES_TEXT).toMatch(/checkoutServerOnlyFieldsPreserved/);
        [
            "paymentPaidAt",
            "paymentVerifiedAt",
            "convertedOrderId",
            "convertedAt",
            "refundStatus",
            "refundReference"
        ].forEach(function expectField(field) {
            expect(RULES_TEXT).toMatch(new RegExp(field));
        });
    });

    test("order create rule only allows paid verified orders into vendor workflow", () => {
        const block = /function isValidOrderCreate[\s\S]*?\}\s*\n/.exec(RULES_TEXT);
        expect(block).not.toBeNull();
        expect(block[0]).toMatch(/status\s*==\s*"pending"/);
        expect(block[0]).toMatch(/paymentStatus\s*==\s*"paid"/);
        expect(block[0]).toMatch(/paymentReference\s+is\s+string/);
        expect(block[0]).toMatch(/paymentReference\s*!=\s*""/);
        expect(block[0]).toMatch(/financeModel/);
        expect(block[0]).toMatch(/vendor-price-plus-platform-fee/);
    });
});

describe("firestore.rules - orders (recommendation metadata contract)", () => {
    test("order create validates the items list without blocking item-level recommendation tags", () => {
        const block = /function isValidOrderCreate[\s\S]*?\}\s*\n/.exec(RULES_TEXT);
        expect(block).not.toBeNull();

        const ruleBody = stripRuleComments(block[0]);

        expect(ruleBody).toMatch(/request\.resource\.data\.items\s+is\s+list/);
        expect(ruleBody).toMatch(/request\.resource\.data\.items\.size\(\)\s*>\s*0/);
        expect(ruleBody).not.toMatch(/dietary/);
        expect(ruleBody).not.toMatch(/allergen/);
    });

    test("customer order history reads are covered by participant-scoped order list rules", () => {
        const orderMatch = /match\s+\/orders\/\{orderId\}\s*\{[\s\S]*?\n\s{4}\}/.exec(RULES_TEXT);

        expect(orderMatch).not.toBeNull();
        // Helper functions still exist (used elsewhere in the rules).
        expect(RULES_TEXT).toMatch(/function isOrderCustomer\(\)[\s\S]*customerUid\s*==\s*request\.auth\.uid/);
        expect(RULES_TEXT).toMatch(/function isOrderParticipant\(\)[\s\S]*isOrderCustomer\(\)/);

        // List rule must either call the helper, inline the participant OR, or
        // split customer/vendor reads into separate allow lines so Firestore's
        // list-query analyzer can verify where(customerUid==me) and
        // where(vendorUid==me) queries independently. Admin gets its own allow
        // line either way.
        const helperForm = /allow\s+(?:get,\s*)?list:\s*if\s+isOrderParticipant\(\);/;
        const inlinedForm = /allow\s+get,\s*list:\s*if\s+signedIn\(\)[\s\S]*?customerUid\s*==\s*request\.auth\.uid[\s\S]*?vendorUid\s*==\s*request\.auth\.uid/;
        const splitCustomerRead = /allow\s+get,\s*list:\s*if\s+signedIn\(\)\s*&&\s*resource\.data\.customerUid\s*==\s*request\.auth\.uid;/;
        const splitVendorRead = /allow\s+get,\s*list:\s*if\s+signedIn\(\)\s*&&\s*resource\.data\.vendorUid\s*==\s*request\.auth\.uid;/;
        expect(
            helperForm.test(orderMatch[0]) ||
            inlinedForm.test(orderMatch[0]) ||
            (splitCustomerRead.test(orderMatch[0]) && splitVendorRead.test(orderMatch[0]))
        ).toBe(true);
    });
});

describe("firestore.rules - payout requests (security shape)", () => {
    test("the rules file contains a /payoutRequests match block", () => {
        const block = /match\s+\/payoutRequests\/\{payoutId\}\s*\{[\s\S]*?\n\s{4}\}/.exec(RULES_TEXT);
        expect(block).not.toBeNull();

        expect(block[0]).toMatch(/allow\s+create:\s*if\s+isValidPayoutCreate\(\)\s*\|\|\s*isAdmin(?:OrOwner)?\(\);/);
        expect(block[0]).toMatch(/allow\s+update:\s*if\s+isValidPayoutUpdate\(\);/);

        // Owner read: helper form OR inlined form (the inlined form lets the
        // list-query analyzer prove where(vendorUid==me) queries are safe).
        const ownerHelper = /allow\s+get(?:,\s*list)?:\s*if\s+isPayoutOwner\(\)\s*\|\|\s*isAdmin(?:OrOwner)?\(\);/;
        const ownerInlined = /allow\s+get,\s*list:\s*if\s+signedIn\(\)\s*&&\s*resource\.data\.vendorUid\s*==\s*request\.auth\.uid;/;
        expect(
            ownerHelper.test(block[0]) || ownerInlined.test(block[0])
        ).toBe(true);
    });

    test("payout create keys match the local mirror", () => {
        const parsed = extractStringList(RULES_TEXT, "payoutCreateAffectsOnlyAllowedKeys");
        expect(parsed).toEqual(PAYOUT_CREATE_ALLOWED_KEYS);
    });

    test("payout update keys match the local mirror", () => {
        const parsed = extractStringList(RULES_TEXT, "payoutUpdateAffectsOnlyAllowedKeys");
        expect(parsed).toEqual(PAYOUT_UPDATE_ALLOWED_KEYS);
    });

    test("vendor-created payouts must be pending, test-mode, and self-owned", () => {
        const block = /function isValidPayoutCreate[\s\S]*?\}\s*\n/.exec(RULES_TEXT);
        expect(block).not.toBeNull();
        expect(block[0]).toMatch(/isApprovedVendor\(\)/);
        expect(block[0]).toMatch(/vendorUid\s*==\s*request\.auth\.uid/);
        expect(block[0]).toMatch(/status\s*==\s*"pending"/);
        expect(block[0]).toMatch(/statusLabel\s*==\s*"Pending"/);
        expect(block[0]).toMatch(/testMode\s*==\s*true/);
    });

    test("vendor payout updates are limited to cancelling their own pending request", () => {
        const block = /function isValidPayoutUpdate[\s\S]*?\}\s*\n/.exec(RULES_TEXT);
        expect(block).not.toBeNull();
        expect(block[0]).toMatch(/isAdmin(?:OrOwner)?\(\)/);
        expect(block[0]).toMatch(/isPayoutOwner\(\)/);
        expect(block[0]).toMatch(/resource\.data\.status\s*==\s*"pending"/);
        expect(block[0]).toMatch(/request\.resource\.data\.status\s*==\s*"cancelled"/);
        expect(block[0]).toMatch(/vendorPayoutCancelAffectsOnlyAllowedKeys\(\)/);
    });
});

describe("firestore.rules - tickets (service ↔ rule contract)", () => {
    test("a freshly created ticket has every field the rules require for create", () => {
        const ticket = makeValidTicket();

        expect(ticket.reporterUid).toBeTruthy();
        expect(ticket.reporterRole === "customer" || ticket.reporterRole === "vendor").toBe(true);
        expect(typeof ticket.subject).toBe("string");
        expect(ticket.subject.length).toBeGreaterThan(0);
        expect(typeof ticket.description).toBe("string");
        expect(ticket.description.length).toBeGreaterThan(0);
        expect(typeof ticket.category).toBe("string");
        expect(ticket.status).toBe("open");
        expect(ticket.replyCount).toBe(0);
        expect(ticket.resolvedAt).toBeNull();
    });

    test("admin status-change patch only touches keys in the admin whitelist", () => {
        const before = makeValidTicket();
        const plan = ticketService.buildTicketStatusUpdate(before, {
            nextStatus: "in_progress",
            actorRole: "admin",
            actorUid: "admin-1",
            actorName: "Admin",
            now: "2026-05-16T11:00:00.000Z"
        });
        expect(plan.success).toBe(true);

        const changedKeys = affectedKeys(before, plan.ticket);
        changedKeys.forEach(function check(key) {
            expect(ADMIN_ALLOWED_UPDATE_KEYS).toContain(key);
            expect(TICKET_IMMUTABLE_FIELDS).not.toContain(key);
        });

        // Immutable fields must be preserved.
        TICKET_IMMUTABLE_FIELDS.forEach(function preserved(field) {
            expect(plan.ticket[field]).toEqual(before[field]);
        });
    });

    test("admin resolve patch touches only admin-whitelisted keys (incl. resolution fields)", () => {
        const before = makeValidTicket({ status: "in_progress" });
        const plan = ticketService.buildTicketStatusUpdate(before, {
            nextStatus: "resolved",
            actorRole: "admin",
            actorUid: "admin-1",
            actorName: "Admin",
            resolutionNote: "Refunded via Paystack.",
            now: "2026-05-16T12:00:00.000Z"
        });
        expect(plan.success).toBe(true);

        const changedKeys = affectedKeys(before, plan.ticket);
        // Resolution fields are admin-only — confirm they ARE in the change set.
        expect(changedKeys).toEqual(expect.arrayContaining([
            "status", "resolvedAt", "resolvedByUid", "resolvedByName", "resolutionNote"
        ]));
        // And every change is on the admin whitelist.
        changedKeys.forEach(function check(key) {
            expect(ADMIN_ALLOWED_UPDATE_KEYS).toContain(key);
        });
    });

    test("reporter close-by-reporter patch only touches keys in the participant whitelist", () => {
        const before = makeValidTicket();
        const plan = ticketService.buildTicketStatusUpdate(before, {
            nextStatus: "closed",
            actorRole: "customer",
            actorUid: "customer-1",
            actorName: "Naledi",
            now: "2026-05-16T11:00:00.000Z"
        });
        expect(plan.success).toBe(true);

        const changedKeys = affectedKeys(before, plan.ticket);
        // Every change must be inside the participant whitelist.
        changedKeys.forEach(function check(key) {
            expect(PARTICIPANT_ALLOWED_UPDATE_KEYS).toContain(key);
            expect(TICKET_IMMUTABLE_FIELDS).not.toContain(key);
        });
        // And the new status is one the participant rule allows.
        expect(PARTICIPANT_ALLOWED_STATUS_VALUES).toContain(plan.ticket.status);
    });

    test("addReply parent-ticket update by a participant only touches participant-whitelisted keys", () => {
        const before = makeValidTicket({ status: "awaiting_user" });
        const plan = ticketService.buildAddReplyUpdate(before, {
            body: "Replying with the info you asked for.",
            authorRole: "customer",
            authorUid: "customer-1",
            authorName: "Naledi"
        }, { now: "2026-05-16T11:30:00.000Z" });
        expect(plan.success).toBe(true);

        const changedKeys = affectedKeys(before, plan.ticket);
        changedKeys.forEach(function check(key) {
            expect(PARTICIPANT_ALLOWED_UPDATE_KEYS).toContain(key);
        });
        // Auto-status nudge: awaiting_user → in_progress.
        expect(plan.ticket.status).toBe("in_progress");
        expect(PARTICIPANT_ALLOWED_STATUS_VALUES).toContain(plan.ticket.status);
    });

    test("reporter cannot move ticket to resolved (rule-enforced), so the service blocks it too", () => {
        const before = makeValidTicket({ status: "in_progress" });
        const plan = ticketService.buildTicketStatusUpdate(before, {
            nextStatus: "resolved",
            actorRole: "customer",
            actorUid: "customer-1",
            now: "2026-05-16T11:00:00.000Z"
        });
        expect(plan.success).toBe(false);
        // The service rejects the transition before it ever hits Firestore, matching
        // what the rule's participantStatusChangeIsAllowed() would reject.
        expect(plan.error.code).toBe("tickets/invalid-status-change");
    });

    test("reply payload from the service matches what the reply-create rule expects", () => {
        const ticket = makeValidTicket();
        const plan = ticketService.buildAddReplyUpdate(ticket, {
            body: "Looking into this.",
            authorRole: "admin",
            authorUid: "admin-1",
            authorName: "Admin",
            isInternalNote: true
        });
        expect(plan.success).toBe(true);

        const reply = plan.reply;
        expect(reply.ticketId).toBe(ticket.ticketId);
        expect(reply.authorUid).toBe("admin-1");
        expect(REPLY_ALLOWED_AUTHOR_ROLES).toContain(reply.authorRole);
        expect(typeof reply.body).toBe("string");
        expect(reply.body.length).toBeGreaterThan(0);
        expect(reply.isInternalNote).toBe(true);
        // The rule requires admin authorRole for isInternalNote=true. We just
        // asserted authorRole is "admin", so the contract holds.
        if (reply.isInternalNote === true) {
            expect(reply.authorRole).toBe("admin");
        }
    });

    test("customer-authored reply cannot have isInternalNote=true (model + service block it)", () => {
        // The model's reply creator preserves whatever role the caller passed,
        // but ticket-validation.js explicitly rejects customer+internalNote.
        const ticketValidation = require("../../../public/shared/support/ticket-validation.js");
        const reply = ticketModel.createReplyRecord({
            ticketId: "ticket-rule-1",
            authorUid: "customer-1",
            authorRole: "customer",
            authorName: "Naledi",
            body: "Sneaky internal note attempt.",
            isInternalNote: true,
            createdAt: "2026-05-16T11:00:00.000Z"
        });
        const result = ticketValidation.validateReplyRecord(reply);
        expect(result.isValid).toBe(false);
        expect(result.errors.isInternalNote).toMatch(/admins/i);
        // And the rule would reject it server-side as a second line of defence.
        // (See isValidReplyCreate() in firestore.rules.)
    });

    test("admin refund proposal patch only touches admin-whitelisted ticket keys", () => {
        const before = makeValidTicket({ category: "refund" });
        const plan = ticketService.buildRefundProposalUpdate(before, {
            type: "partial",
            amount: 60,
            reason: "Food quality issue"
        }, {
            order: makePaidOrder(),
            actorRole: "admin",
            actorUid: "admin-1",
            actorName: "Admin",
            now: "2026-05-16T12:00:00.000Z"
        });

        expect(plan.success).toBe(true);
        expect(plan.ticket.refundCase).toEqual(expect.objectContaining({
            status: "proposed",
            orderId: "order-7",
            customerUid: "customer-1",
            vendorUid: "vendor-1"
        }));

        const changedKeys = affectedKeys(before, plan.ticket);
        expect(changedKeys).toEqual(expect.arrayContaining(["refundCase", "timeline", "updatedAt"]));
        changedKeys.forEach(function check(key) {
            expect(ADMIN_ALLOWED_UPDATE_KEYS).toContain(key);
            expect(TICKET_IMMUTABLE_FIELDS).not.toContain(key);
        });
    });

    test("customer and vendor refund decisions stay inside participant-whitelisted keys", () => {
        const proposal = ticketService.buildRefundProposalUpdate(makeValidTicket({ category: "refund" }), {
            type: "partial",
            amount: 60,
            reason: "Food quality issue"
        }, {
            order: makePaidOrder(),
            actorRole: "admin",
            actorUid: "admin-1",
            actorName: "Admin",
            now: "2026-05-16T12:00:00.000Z"
        });
        expect(proposal.success).toBe(true);

        const customerDecision = ticketService.buildRefundDecisionUpdate(proposal.ticket, {
            actorRole: "customer",
            actorUid: "customer-1",
            actorName: "Naledi",
            decision: "approved",
            note: "I agree with the refund."
        }, {
            now: "2026-05-16T12:05:00.000Z"
        });
        expect(customerDecision.success).toBe(true);

        const customerChangedKeys = affectedKeys(proposal.ticket, customerDecision.ticket);
        expect(customerChangedKeys).toEqual(expect.arrayContaining(["refundCase", "timeline", "updatedAt"]));
        customerChangedKeys.forEach(function check(key) {
            expect(PARTICIPANT_ALLOWED_UPDATE_KEYS).toContain(key);
            expect(TICKET_IMMUTABLE_FIELDS).not.toContain(key);
        });
        expect(customerDecision.ticket.refundCase.customerDecision).toBe("approved");
        expect(customerDecision.ticket.refundCase.vendorDecision).toBe("pending");

        const vendorDecision = ticketService.buildRefundDecisionUpdate(customerDecision.ticket, {
            actorRole: "vendor",
            actorUid: "vendor-1",
            actorName: "Vendor",
            decision: "approved",
            note: "Approved from the vendor side."
        }, {
            now: "2026-05-16T12:10:00.000Z"
        });
        expect(vendorDecision.success).toBe(true);

        const vendorChangedKeys = affectedKeys(customerDecision.ticket, vendorDecision.ticket);
        expect(vendorChangedKeys).toEqual(expect.arrayContaining(["refundCase", "timeline", "updatedAt"]));
        vendorChangedKeys.forEach(function check(key) {
            expect(PARTICIPANT_ALLOWED_UPDATE_KEYS).toContain(key);
            expect(TICKET_IMMUTABLE_FIELDS).not.toContain(key);
        });
        expect(vendorDecision.ticket.refundCase.status).toBe("approved");
        expect(vendorDecision.ticket.refundCase.customerDecision).toBe("approved");
        expect(vendorDecision.ticket.refundCase.vendorDecision).toBe("approved");
    });

    test("admin refund execution patch stays inside admin-whitelisted ticket keys", () => {
        const proposal = ticketService.buildRefundProposalUpdate(makeValidTicket({ category: "refund" }), {
            type: "partial",
            amount: 60,
            reason: "Food quality issue"
        }, {
            order: makePaidOrder(),
            actorRole: "admin",
            actorUid: "admin-1",
            actorName: "Admin",
            now: "2026-05-16T12:00:00.000Z"
        });
        const customerDecision = ticketService.buildRefundDecisionUpdate(proposal.ticket, {
            actorRole: "customer",
            actorUid: "customer-1",
            decision: "approved"
        }, {
            now: "2026-05-16T12:05:00.000Z"
        });
        const vendorDecision = ticketService.buildRefundDecisionUpdate(customerDecision.ticket, {
            actorRole: "vendor",
            actorUid: "vendor-1",
            decision: "approved"
        }, {
            now: "2026-05-16T12:10:00.000Z"
        });
        expect(vendorDecision.success).toBe(true);

        const execution = ticketService.buildRefundExecutionUpdate(vendorDecision.ticket, {
            status: "processing",
            actorRole: "admin",
            actorUid: "admin-1",
            actorName: "Admin",
            refundProvider: "paystack",
            refundReference: "refund-ref-7"
        }, {
            order: makePaidOrder(),
            now: "2026-05-16T12:15:00.000Z"
        });

        expect(execution.success).toBe(true);
        expect(execution.ticket.refundCase.status).toBe("processing");

        const changedKeys = affectedKeys(vendorDecision.ticket, execution.ticket);
        expect(changedKeys).toEqual(expect.arrayContaining(["refundCase", "timeline", "updatedAt"]));
        changedKeys.forEach(function check(key) {
            expect(ADMIN_ALLOWED_UPDATE_KEYS).toContain(key);
            expect(TICKET_IMMUTABLE_FIELDS).not.toContain(key);
        });
    });
});

describe("firestore.indexes.json - tickets (queries ↔ index parity)", () => {
    // firestore.indexes.json contains JS-style example comments at the top, so
    // we strip those before parsing instead of using require().
    const INDEXES_TEXT = fs.readFileSync(
        path.resolve(__dirname, "../../../firestore.indexes.json"),
        "utf8"
    );
    const INDEXES = JSON.parse(
        INDEXES_TEXT
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/^\s*\/\/.*$/gm, "")
    );

    function findTicketIndex(fields) {
        return INDEXES.indexes.find(function matches(index) {
            if (index.collectionGroup !== "supportTickets") return false;
            if (!Array.isArray(index.fields) || index.fields.length !== fields.length) return false;
            return fields.every(function eq(field, i) {
                return index.fields[i].fieldPath === field.fieldPath &&
                    index.fields[i].mode === field.mode;
            });
        });
    }

    function findOrderIndex(fields) {
        return INDEXES.indexes.find(function matches(index) {
            if (index.collectionGroup !== "orders") return false;
            if (!Array.isArray(index.fields) || index.fields.length !== fields.length) return false;
            return fields.every(function eq(field, i) {
                return index.fields[i].fieldPath === field.fieldPath &&
                    index.fields[i].mode === field.mode;
            });
        });
    }

    function findCheckoutIndex(fields) {
        return INDEXES.indexes.find(function matches(index) {
            if (index.collectionGroup !== "checkoutSessions") return false;
            if (!Array.isArray(index.fields) || index.fields.length !== fields.length) return false;
            return fields.every(function eq(field, i) {
                return index.fields[i].fieldPath === field.fieldPath &&
                    index.fields[i].mode === field.mode;
            });
        });
    }

    function findPayoutIndex(fields) {
        return INDEXES.indexes.find(function matches(index) {
            if (index.collectionGroup !== "payoutRequests") return false;
            if (!Array.isArray(index.fields) || index.fields.length !== fields.length) return false;
            return fields.every(function eq(field, i) {
                return index.fields[i].fieldPath === field.fieldPath &&
                    index.fields[i].mode === field.mode;
            });
        });
    }

    test("checkout session indexes cover customer resume and history queries", () => {
        expect(findCheckoutIndex([
            { fieldPath: "customerUid", mode: "ASCENDING" },
            { fieldPath: "updatedAt", mode: "DESCENDING" },
            { fieldPath: "createdAt", mode: "DESCENDING" }
        ])).toBeDefined();

        expect(findCheckoutIndex([
            { fieldPath: "customerUid", mode: "ASCENDING" },
            { fieldPath: "status", mode: "ASCENDING" },
            { fieldPath: "updatedAt", mode: "DESCENDING" },
            { fieldPath: "createdAt", mode: "DESCENDING" }
        ])).toBeDefined();
    });

    test("orders index covers recommendation history query exactly", () => {
        const firestoreFns = {
            collection: jest.fn((db, ...segments) => ({ db, segments })),
            where: jest.fn((field, operator, value) => ({ type: "where", field, operator, value })),
            orderBy: jest.fn((field, direction) => ({ type: "orderBy", field, direction })),
            limit: jest.fn(count => ({ type: "limit", count }))
        };
        const queryShape = recommendationQueries.buildRecentCustomerOrdersQuery({
            db: { name: "db" },
            firestoreFns,
            customerUid: "student-1",
            limitCount: 12
        });

        expect(queryShape.collectionRef.segments).toEqual(["orders"]);
        expect(queryShape.constraints).toEqual([
            { type: "where", field: "customerUid", operator: "==", value: "student-1" },
            { type: "orderBy", field: "createdAt", direction: "desc" },
            { type: "limit", count: 12 }
        ]);
        expect(findOrderIndex([
            { fieldPath: "customerUid", mode: "ASCENDING" },
            { fieldPath: "createdAt", mode: "DESCENDING" }
        ])).toBeDefined();
    });

    test("recommendation history does not require dietary or allergen composite indexes", () => {
        const orderIndexes = INDEXES.indexes.filter(function onlyOrders(index) {
            return index.collectionGroup === "orders";
        });
        const indexedFieldPaths = orderIndexes.flatMap(function collectFields(index) {
            return index.fields.map(function mapField(field) {
                return field.fieldPath;
            });
        });

        expect(indexedFieldPaths).toContain("customerUid");
        expect(indexedFieldPaths).toContain("createdAt");
        expect(indexedFieldPaths).not.toContain("dietary");
        expect(indexedFieldPaths).not.toContain("allergens");
        expect(indexedFieldPaths).not.toContain("items.dietary");
        expect(indexedFieldPaths).not.toContain("items.allergens");
    });

    test("checkout session indexes cover payment callback and admin/vendor filters", () => {
        expect(findCheckoutIndex([
            { fieldPath: "paymentReference", mode: "ASCENDING" },
            { fieldPath: "updatedAt", mode: "DESCENDING" },
            { fieldPath: "createdAt", mode: "DESCENDING" }
        ])).toBeDefined();

        expect(findCheckoutIndex([
            { fieldPath: "vendorUid", mode: "ASCENDING" },
            { fieldPath: "status", mode: "ASCENDING" },
            { fieldPath: "updatedAt", mode: "DESCENDING" },
            { fieldPath: "createdAt", mode: "DESCENDING" }
        ])).toBeDefined();
    });

    test("payout request indexes cover wallet and admin finance queries", () => {
        expect(findPayoutIndex([
            { fieldPath: "updatedAt", mode: "DESCENDING" },
            { fieldPath: "requestedAt", mode: "DESCENDING" }
        ])).toBeDefined();

        expect(findPayoutIndex([
            { fieldPath: "status", mode: "ASCENDING" },
            { fieldPath: "updatedAt", mode: "DESCENDING" },
            { fieldPath: "requestedAt", mode: "DESCENDING" }
        ])).toBeDefined();

        expect(findPayoutIndex([
            { fieldPath: "vendorUid", mode: "ASCENDING" },
            { fieldPath: "updatedAt", mode: "DESCENDING" },
            { fieldPath: "requestedAt", mode: "DESCENDING" }
        ])).toBeDefined();

        expect(findPayoutIndex([
            { fieldPath: "vendorUid", mode: "ASCENDING" },
            { fieldPath: "status", mode: "ASCENDING" },
            { fieldPath: "updatedAt", mode: "DESCENDING" },
            { fieldPath: "requestedAt", mode: "DESCENDING" }
        ])).toBeDefined();
    });

    test("reporterUid + createdAt composite index exists (user-requested)", () => {
        expect(findTicketIndex([
            { fieldPath: "reporterUid", mode: "ASCENDING" },
            { fieldPath: "createdAt", mode: "DESCENDING" }
        ])).toBeDefined();
    });

    test("status + createdAt composite index exists (user-requested)", () => {
        expect(findTicketIndex([
            { fieldPath: "status", mode: "ASCENDING" },
            { fieldPath: "createdAt", mode: "DESCENDING" }
        ])).toBeDefined();
    });

    test("updatedAt + createdAt composite covers the admin no-filter inbox query", () => {
        // buildAdminTicketsQuery emits orderBy(updatedAt desc) + orderBy(createdAt desc)
        // with no where clause when no filters are applied. Firestore needs a
        // composite for any multi-field orderBy.
        expect(findTicketIndex([
            { fieldPath: "updatedAt", mode: "DESCENDING" },
            { fieldPath: "createdAt", mode: "DESCENDING" }
        ])).toBeDefined();
    });

    test("reporterUid + updatedAt + createdAt covers the actual reporter list query", () => {
        // ticket-queries.buildReporterTicketsQuery emits
        //   where reporterUid == X, orderBy updatedAt desc, orderBy createdAt desc
        expect(findTicketIndex([
            { fieldPath: "reporterUid", mode: "ASCENDING" },
            { fieldPath: "updatedAt", mode: "DESCENDING" },
            { fieldPath: "createdAt", mode: "DESCENDING" }
        ])).toBeDefined();
    });

    test("status + updatedAt + createdAt covers the admin status-filter query", () => {
        expect(findTicketIndex([
            { fieldPath: "status", mode: "ASCENDING" },
            { fieldPath: "updatedAt", mode: "DESCENDING" },
            { fieldPath: "createdAt", mode: "DESCENDING" }
        ])).toBeDefined();
    });

    test("category, vendorUid, customerUid, orderId, reporterRole filters each have an index", () => {
        [
            "category",
            "vendorUid",
            "customerUid",
            "orderId",
            "reporterRole"
        ].forEach(function expectFilterIndex(field) {
            expect(findTicketIndex([
                { fieldPath: field, mode: "ASCENDING" },
                { fieldPath: "updatedAt", mode: "DESCENDING" },
                { fieldPath: "createdAt", mode: "DESCENDING" }
            ])).toBeDefined();
        });
    });

    test("refund-case status indexes cover upcoming admin, customer, and vendor refund queues", () => {
        expect(findTicketIndex([
            { fieldPath: "category", mode: "ASCENDING" },
            { fieldPath: "refundCase.status", mode: "ASCENDING" },
            { fieldPath: "updatedAt", mode: "DESCENDING" },
            { fieldPath: "createdAt", mode: "DESCENDING" }
        ])).toBeDefined();

        expect(findTicketIndex([
            { fieldPath: "customerUid", mode: "ASCENDING" },
            { fieldPath: "refundCase.status", mode: "ASCENDING" },
            { fieldPath: "updatedAt", mode: "DESCENDING" },
            { fieldPath: "createdAt", mode: "DESCENDING" }
        ])).toBeDefined();

        expect(findTicketIndex([
            { fieldPath: "vendorUid", mode: "ASCENDING" },
            { fieldPath: "refundCase.status", mode: "ASCENDING" },
            { fieldPath: "updatedAt", mode: "DESCENDING" },
            { fieldPath: "createdAt", mode: "DESCENDING" }
        ])).toBeDefined();
    });

    test("replies subcollection has an index for the internal-note filter + chronological order", () => {
        const replyIndex = INDEXES.indexes.find(function isReplyIndex(index) {
            return index.collectionGroup === "replies";
        });
        expect(replyIndex).toBeDefined();
        expect(replyIndex.fields[0].fieldPath).toBe("isInternalNote");
        expect(replyIndex.fields[1].fieldPath).toBe("createdAt");
    });
});
