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
    "timeline",
    "updatedAt",
    "categoryLabel"
];

const PARTICIPANT_ALLOWED_UPDATE_KEYS = [
    "status",
    "statusLabel",
    "replyCount",
    "lastReplyAt",
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
        priority: "normal",
        createdAt: "2026-05-16T10:00:00.000Z",
        updatedAt: "2026-05-16T10:00:00.000Z",
        ...overrides
    });
}

describe("firestore.rules - tickets (whitelist parity)", () => {
    test("the rules file actually contains a /supportTickets match block with /replies", () => {
        expect(RULES_TEXT).toMatch(/match\s+\/supportTickets\/\{ticketId\}\s*\{/);
        expect(RULES_TEXT).toMatch(/match\s+\/replies\/\{replyId\}\s*\{/);
        expect(RULES_TEXT).toMatch(/allow\s+create:\s*if\s+isValidTicketCreate\(\);/);
        expect(RULES_TEXT).toMatch(/allow\s+update:\s*if\s+isValidTicketUpdate\(\);/);
        expect(RULES_TEXT).toMatch(/allow\s+delete:\s*if\s+isAdmin\(\);/);
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

    test("reply create rule whitelists customer, vendor, admin author roles", () => {
        const block = /isValidReplyCreate[\s\S]*?\}\s*\n/.exec(RULES_TEXT);
        expect(block).not.toBeNull();
        REPLY_ALLOWED_AUTHOR_ROLES.forEach(function expectRole(r) {
            expect(block[0]).toMatch(new RegExp("\"" + r + "\""));
        });
        // System replies must NOT be writeable from the client.
        expect(block[0]).not.toMatch(/"system"/);
        // Internal notes are admin-only — the rule must check both authorRole AND isAdmin().
        expect(block[0]).toMatch(/isInternalNote/);
        expect(block[0]).toMatch(/isAdmin\(\)/);
    });
});

describe("firestore.rules - checkout sessions (security shape)", () => {
    test("the rules file contains a /checkoutSessions match block", () => {
        expect(RULES_TEXT).toMatch(/match\s+\/checkoutSessions\/\{checkoutId\}\s*\{/);
        expect(RULES_TEXT).toMatch(/allow\s+create:\s*if\s+isValidCheckoutCreate\(\)\s*\|\|\s*isAdmin\(\);/);
        expect(RULES_TEXT).toMatch(/allow\s+get,\s*list:\s*if\s+isCheckoutCustomer\(\)\s*\|\|\s*isAdmin\(\);/);
        expect(RULES_TEXT).toMatch(/allow\s+update:\s*if\s+isValidCheckoutCustomerUpdate\(\)\s*\|\|\s*isAdmin\(\);/);
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
        expect(block[0]).toMatch(/paymentStatus\s*==\s*"paid"/);
        expect(block[0]).toMatch(/paymentReference\s+is\s+string/);
        expect(block[0]).toMatch(/paymentReference\s*!=\s*""/);
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

    test("replies subcollection has an index for the internal-note filter + chronological order", () => {
        const replyIndex = INDEXES.indexes.find(function isReplyIndex(index) {
            return index.collectionGroup === "replies";
        });
        expect(replyIndex).toBeDefined();
        expect(replyIndex.fields[0].fieldPath).toBe("isInternalNote");
        expect(replyIndex.fields[1].fieldPath).toBe("createdAt");
    });
});
