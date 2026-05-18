const ticketStatus = require("../../../public/shared/support/ticket-status.js");

describe("shared/support/ticket-status.js", () => {
    test("exposes the expected module surface and constants", () => {
        expect(ticketStatus.MODULE_NAME).toBe("ticket-status");

        expect(ticketStatus.TICKET_STATUSES).toEqual({
            OPEN: "open",
            IN_PROGRESS: "in_progress",
            AWAITING_USER: "awaiting_user",
            RESOLVED: "resolved",
            CLOSED: "closed"
        });
        expect(Object.isFrozen(ticketStatus.TICKET_STATUSES)).toBe(true);

        expect(ticketStatus.TICKET_ACTOR_ROLES).toEqual({
            CUSTOMER: "customer",
            VENDOR: "vendor",
            ADMIN: "admin",
            SYSTEM: "system"
        });
        expect(Object.isFrozen(ticketStatus.TICKET_ACTOR_ROLES)).toBe(true);
    });

    test("primitive text helpers behave defensively", () => {
        expect(ticketStatus.normalizeText("  hi  ")).toBe("hi");
        expect(ticketStatus.normalizeText(null)).toBe("");
        expect(ticketStatus.normalizeText(undefined)).toBe("");
        expect(ticketStatus.normalizeText(42)).toBe("");

        expect(ticketStatus.normalizeLowerText("  HeLLO  ")).toBe("hello");
        expect(ticketStatus.normalizeLowerText(null)).toBe("");

        expect(ticketStatus.normalizeStatusKey("In  Progress")).toBe("inprogress");
        expect(ticketStatus.normalizeStatusKey("AWAITING-USER")).toBe("awaitinguser");
        expect(ticketStatus.normalizeStatusKey("awaiting_user")).toBe("awaitinguser");
        expect(ticketStatus.normalizeStatusKey(null)).toBe("");
    });

    test("normalizeTicketStatus resolves canonical statuses and aliases", () => {
        expect(ticketStatus.normalizeTicketStatus("OPEN")).toBe("open");
        expect(ticketStatus.normalizeTicketStatus(" submitted ")).toBe("open");
        expect(ticketStatus.normalizeTicketStatus("reopened")).toBe("open");

        expect(ticketStatus.normalizeTicketStatus("in_progress")).toBe("in_progress");
        expect(ticketStatus.normalizeTicketStatus("In Progress")).toBe("in_progress");
        expect(ticketStatus.normalizeTicketStatus("triage")).toBe("in_progress");
        expect(ticketStatus.normalizeTicketStatus("working")).toBe("in_progress");

        expect(ticketStatus.normalizeTicketStatus("awaiting_user")).toBe("awaiting_user");
        expect(ticketStatus.normalizeTicketStatus("awaiting-reply")).toBe("awaiting_user");
        expect(ticketStatus.normalizeTicketStatus("waiting for user")).toBe("awaiting_user");
        expect(ticketStatus.normalizeTicketStatus("pending_user")).toBe("awaiting_user");

        expect(ticketStatus.normalizeTicketStatus("resolved")).toBe("resolved");
        expect(ticketStatus.normalizeTicketStatus("fixed")).toBe("resolved");
        expect(ticketStatus.normalizeTicketStatus("solved")).toBe("resolved");
        expect(ticketStatus.normalizeTicketStatus("done")).toBe("resolved");

        expect(ticketStatus.normalizeTicketStatus("closed")).toBe("closed");
        expect(ticketStatus.normalizeTicketStatus("archived")).toBe("closed");
        expect(ticketStatus.normalizeTicketStatus("complete")).toBe("closed");
        expect(ticketStatus.normalizeTicketStatus("completed")).toBe("closed");
    });

    test("normalizeTicketStatus uses fallbacks and returns an empty string for true unknowns", () => {
        expect(ticketStatus.normalizeTicketStatus("nonsense")).toBe("");
        expect(ticketStatus.normalizeTicketStatus(null)).toBe("");
        expect(ticketStatus.normalizeTicketStatus("nonsense", "open")).toBe("open");
        expect(ticketStatus.normalizeTicketStatus("nonsense", "AWAITING USER")).toBe("awaiting_user");
        expect(ticketStatus.normalizeTicketStatus("nonsense", "also-nonsense")).toBe("");
    });

    test("normalizeTicketActorRole handles aliases and returns empty for unknown roles", () => {
        expect(ticketStatus.normalizeTicketActorRole("CUSTOMER")).toBe("customer");
        expect(ticketStatus.normalizeTicketActorRole("student")).toBe("customer");
        expect(ticketStatus.normalizeTicketActorRole("buyer")).toBe("customer");
        expect(ticketStatus.normalizeTicketActorRole("reporter")).toBe("customer");

        expect(ticketStatus.normalizeTicketActorRole("vendor")).toBe("vendor");
        expect(ticketStatus.normalizeTicketActorRole("shop")).toBe("vendor");
        expect(ticketStatus.normalizeTicketActorRole("merchant")).toBe("vendor");
        expect(ticketStatus.normalizeTicketActorRole("seller")).toBe("vendor");

        expect(ticketStatus.normalizeTicketActorRole("admin")).toBe("admin");
        expect(ticketStatus.normalizeTicketActorRole("support")).toBe("admin");
        expect(ticketStatus.normalizeTicketActorRole("staff")).toBe("admin");

        expect(ticketStatus.normalizeTicketActorRole("system")).toBe("system");
        expect(ticketStatus.normalizeTicketActorRole("bot")).toBe("system");
        expect(ticketStatus.normalizeTicketActorRole("automation")).toBe("system");
        expect(ticketStatus.normalizeTicketActorRole(" APP ")).toBe("system");

        expect(ticketStatus.normalizeTicketActorRole("ghost")).toBe("");
        expect(ticketStatus.normalizeTicketActorRole(null)).toBe("");
        expect(ticketStatus.normalizeTicketActorRole(undefined)).toBe("");
    });

    test("getDefaultTicketStatus returns the open status", () => {
        expect(ticketStatus.getDefaultTicketStatus()).toBe("open");
    });

    test("list helpers return independent copies, not the frozen originals", () => {
        const fullList = ticketStatus.getTicketStatusList();
        expect(fullList).toEqual([
            "open",
            "in_progress",
            "awaiting_user",
            "resolved",
            "closed"
        ]);
        fullList.push("mutated");
        expect(ticketStatus.getTicketStatusList()).not.toContain("mutated");

        const lifecycle = ticketStatus.getTicketLifecycleList();
        expect(lifecycle).toEqual([
            "open",
            "in_progress",
            "awaiting_user",
            "resolved",
            "closed"
        ]);
        lifecycle.push("mutated");
        expect(ticketStatus.getTicketLifecycleList()).not.toContain("mutated");

        const active = ticketStatus.getActiveTicketStatusList();
        expect(active).toEqual(["open", "in_progress", "awaiting_user"]);
        active.push("mutated");
        expect(ticketStatus.getActiveTicketStatusList()).not.toContain("mutated");

        const closed = ticketStatus.getClosedTicketStatusList();
        expect(closed).toEqual(["resolved", "closed"]);
        closed.push("mutated");
        expect(ticketStatus.getClosedTicketStatusList()).not.toContain("mutated");
    });

    test("isKnownTicketStatus recognises canonical names and aliases", () => {
        expect(ticketStatus.isKnownTicketStatus("open")).toBe(true);
        expect(ticketStatus.isKnownTicketStatus("In Progress")).toBe(true);
        expect(ticketStatus.isKnownTicketStatus("triage")).toBe(true);
        expect(ticketStatus.isKnownTicketStatus("awaiting-user")).toBe(true);
        expect(ticketStatus.isKnownTicketStatus("resolved")).toBe(true);
        expect(ticketStatus.isKnownTicketStatus("archived")).toBe(true);

        expect(ticketStatus.isKnownTicketStatus("nonsense")).toBe(false);
        expect(ticketStatus.isKnownTicketStatus("")).toBe(false);
        expect(ticketStatus.isKnownTicketStatus(null)).toBe(false);
    });

    test("isActiveTicketStatus and isClosedTicketStatus partition the lifecycle", () => {
        expect(ticketStatus.isActiveTicketStatus("open")).toBe(true);
        expect(ticketStatus.isActiveTicketStatus("in_progress")).toBe(true);
        expect(ticketStatus.isActiveTicketStatus("awaiting_user")).toBe(true);
        expect(ticketStatus.isActiveTicketStatus("resolved")).toBe(false);
        expect(ticketStatus.isActiveTicketStatus("closed")).toBe(false);
        expect(ticketStatus.isActiveTicketStatus("nonsense")).toBe(false);

        expect(ticketStatus.isClosedTicketStatus("resolved")).toBe(true);
        expect(ticketStatus.isClosedTicketStatus("closed")).toBe(true);
        expect(ticketStatus.isClosedTicketStatus("open")).toBe(false);
        expect(ticketStatus.isClosedTicketStatus("in_progress")).toBe(false);
        expect(ticketStatus.isClosedTicketStatus("nonsense")).toBe(false);
    });

    test("isTerminalTicketStatus always returns false in the current model", () => {
        expect(ticketStatus.isTerminalTicketStatus("closed")).toBe(false);
        expect(ticketStatus.isTerminalTicketStatus("open")).toBe(false);
        expect(ticketStatus.isTerminalTicketStatus("nonsense")).toBe(false);
    });

    test("getTicketStatusMetadata returns full metadata for known statuses and a fallback for unknowns", () => {
        expect(ticketStatus.getTicketStatusMetadata("open")).toEqual({
            key: "open",
            label: "Open",
            shortLabel: "Open",
            description: expect.any(String),
            tone: "info",
            actionLabel: expect.any(String)
        });

        expect(ticketStatus.getTicketStatusMetadata("In Progress")).toEqual(
            expect.objectContaining({
                key: "in_progress",
                label: "In Progress",
                shortLabel: "Active",
                tone: "loading"
            })
        );

        expect(ticketStatus.getTicketStatusMetadata("resolved").tone).toBe("success");
        expect(ticketStatus.getTicketStatusMetadata("closed").tone).toBe("muted");
        expect(ticketStatus.getTicketStatusMetadata("awaiting_user").shortLabel).toBe("Awaiting User");

        const unknown = ticketStatus.getTicketStatusMetadata("nonsense");
        expect(unknown).toEqual({
            key: "",
            label: "Unknown Status",
            shortLabel: "Unknown",
            description: expect.any(String),
            tone: "info",
            actionLabel: expect.any(String)
        });
    });

    test("label, short label, description, tone, and action label helpers all read from metadata", () => {
        expect(ticketStatus.getTicketStatusLabel("open")).toBe("Open");
        expect(ticketStatus.getTicketStatusLabel("in_progress")).toBe("In Progress");
        expect(ticketStatus.getTicketStatusLabel("nonsense")).toBe("Unknown Status");

        expect(ticketStatus.getTicketStatusShortLabel("in_progress")).toBe("Active");
        expect(ticketStatus.getTicketStatusShortLabel("resolved")).toBe("Resolved");
        expect(ticketStatus.getTicketStatusShortLabel("nonsense")).toBe("Unknown");

        expect(ticketStatus.getTicketStatusDescription("open")).toEqual(expect.any(String));
        expect(ticketStatus.getTicketStatusDescription("nonsense")).toEqual(expect.any(String));

        expect(ticketStatus.getTicketStatusTone("resolved")).toBe("success");
        expect(ticketStatus.getTicketStatusTone("closed")).toBe("muted");
        expect(ticketStatus.getTicketStatusTone("nonsense")).toBe("info");

        expect(ticketStatus.getTicketStatusActionLabel("open")).toEqual(expect.any(String));
        expect(ticketStatus.getTicketStatusActionLabel("nonsense")).toEqual(expect.any(String));
    });

    test("getStatusProgressIndex returns lifecycle position or -1 for unknown", () => {
        expect(ticketStatus.getStatusProgressIndex("open")).toBe(0);
        expect(ticketStatus.getStatusProgressIndex("in_progress")).toBe(1);
        expect(ticketStatus.getStatusProgressIndex("awaiting_user")).toBe(2);
        expect(ticketStatus.getStatusProgressIndex("resolved")).toBe(3);
        expect(ticketStatus.getStatusProgressIndex("closed")).toBe(4);

        expect(ticketStatus.getStatusProgressIndex("nonsense")).toBe(-1);
    });

    test("getAllowedNextStatuses lists the right transitions for customers and vendors", () => {
        expect(ticketStatus.getAllowedNextStatuses("open", "customer")).toEqual(["closed"]);
        expect(ticketStatus.getAllowedNextStatuses("awaiting_user", "customer")).toEqual(["in_progress"]);
        expect(ticketStatus.getAllowedNextStatuses("in_progress", "customer")).toEqual([]);
        expect(ticketStatus.getAllowedNextStatuses("resolved", "customer")).toEqual(["in_progress", "closed"]);
        expect(ticketStatus.getAllowedNextStatuses("closed", "customer")).toEqual(["open"]);

        // vendor uses the same reporter transition table
        expect(ticketStatus.getAllowedNextStatuses("open", "vendor")).toEqual(["closed"]);
        expect(ticketStatus.getAllowedNextStatuses("resolved", "vendor")).toEqual(["in_progress", "closed"]);
    });

    test("getAllowedNextStatuses lists the broader transitions for admins and the system", () => {
        expect(ticketStatus.getAllowedNextStatuses("open", "admin")).toEqual([
            "in_progress",
            "awaiting_user",
            "resolved",
            "closed"
        ]);
        expect(ticketStatus.getAllowedNextStatuses("in_progress", "admin")).toEqual([
            "open",
            "awaiting_user",
            "resolved",
            "closed"
        ]);
        expect(ticketStatus.getAllowedNextStatuses("awaiting_user", "admin")).toEqual([
            "in_progress",
            "resolved",
            "closed"
        ]);
        expect(ticketStatus.getAllowedNextStatuses("resolved", "admin")).toEqual([
            "in_progress",
            "closed"
        ]);
        expect(ticketStatus.getAllowedNextStatuses("closed", "admin")).toEqual([
            "open",
            "in_progress"
        ]);

        expect(ticketStatus.getAllowedNextStatuses("resolved", "system")).toEqual(
            ticketStatus.getAllowedNextStatuses("resolved", "admin")
        );
    });

    test("getAllowedNextStatuses returns an empty list for unknown roles or statuses", () => {
        expect(ticketStatus.getAllowedNextStatuses("open", "ghost")).toEqual([]);
        expect(ticketStatus.getAllowedNextStatuses("ghost", "admin")).toEqual([]);
        expect(ticketStatus.getAllowedNextStatuses(null, null)).toEqual([]);
    });

    test("getAllowedNextStatuses returns a fresh copy that callers can mutate safely", () => {
        const allowed = ticketStatus.getAllowedNextStatuses("open", "admin");
        allowed.push("MUTATED");
        expect(ticketStatus.getAllowedNextStatuses("open", "admin")).not.toContain("MUTATED");
    });

    test("getActorRoleLabel formats each role with a sensible fallback", () => {
        expect(ticketStatus.getActorRoleLabel("customer")).toBe("Customers");
        expect(ticketStatus.getActorRoleLabel("vendor")).toBe("Vendors");
        expect(ticketStatus.getActorRoleLabel("admin")).toBe("Admins");
        expect(ticketStatus.getActorRoleLabel("system")).toBe("The system");
        expect(ticketStatus.getActorRoleLabel("ghost")).toBe("This actor");
        expect(ticketStatus.getActorRoleLabel(null)).toBe("This actor");
    });

    test("canTransitionTicketStatus is a boolean shortcut over validateTicketStatusTransition", () => {
        expect(ticketStatus.canTransitionTicketStatus("open", "in_progress", "admin")).toBe(true);
        expect(ticketStatus.canTransitionTicketStatus("open", "resolved", "customer")).toBe(false);
        expect(ticketStatus.canTransitionTicketStatus("open", "open", "admin")).toBe(false);
    });

    test("validateTicketStatusTransition rejects missing actor role", () => {
        const result = ticketStatus.validateTicketStatusTransition("open", "in_progress", null);
        expect(result.isValid).toBe(false);
        expect(result.actorRole).toBe("");
        expect(result.message).toMatch(/actor role/i);
    });

    test("validateTicketStatusTransition rejects invalid current and next statuses", () => {
        const badCurrent = ticketStatus.validateTicketStatusTransition("nonsense", "open", "admin");
        expect(badCurrent.isValid).toBe(false);
        expect(badCurrent.message).toMatch(/current ticket status/i);

        const badNext = ticketStatus.validateTicketStatusTransition("open", "nonsense", "admin");
        expect(badNext.isValid).toBe(false);
        expect(badNext.message).toMatch(/next ticket status/i);
    });

    test("validateTicketStatusTransition rejects no-op transitions with a friendly message", () => {
        const result = ticketStatus.validateTicketStatusTransition("open", "open", "admin");
        expect(result.isValid).toBe(false);
        expect(result.message).toMatch(/already marked as Open/);
    });

    test("validateTicketStatusTransition rejects transitions not allowed for the role", () => {
        const result = ticketStatus.validateTicketStatusTransition("open", "resolved", "customer");
        expect(result.isValid).toBe(false);
        expect(result.actorRole).toBe("customer");
        expect(result.message).toMatch(/Customers cannot move/);
        expect(result.message).toMatch(/Open to Resolved/);
    });

    test("validateTicketStatusTransition allows valid transitions and returns a confirmation message", () => {
        const result = ticketStatus.validateTicketStatusTransition("open", "in_progress", "admin");
        expect(result).toEqual({
            isValid: true,
            currentStatus: "open",
            nextStatus: "in_progress",
            actorRole: "admin",
            message: "Admins can move a ticket from Open to In Progress."
        });

        const reopenResult = ticketStatus.validateTicketStatusTransition("closed", "open", "customer");
        expect(reopenResult.isValid).toBe(true);
        expect(reopenResult.message).toBe("Customers can move a ticket from Closed to Open.");
    });

    test("the ticket-model resolver accepts ticket-status because it exposes the required surface", () => {
        const ticketModel = require("../../../public/shared/support/ticket-model.js");

        expect(ticketModel.resolveTicketStatus(ticketStatus)).toBe(ticketStatus);
        // Unknown input with no caller-supplied fallback falls back to the module's own default ("open").
        expect(ticketModel.normalizeTicketStatus("WIP", undefined, ticketStatus)).toBe("open");
        expect(ticketModel.normalizeTicketStatus("WIP", "awaiting_user", ticketStatus)).toBe("awaiting_user");
        expect(ticketModel.normalizeTicketStatus("triage", undefined, ticketStatus)).toBe("in_progress");
        expect(ticketModel.getTicketStatusLabel("in_progress", ticketStatus)).toBe("In Progress");
        expect(ticketModel.getTicketStatusLabel("nonsense", ticketStatus)).toBe("Unknown Status");
    });
});
