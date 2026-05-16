const ticketStatus = require("../../../public/shared/support/ticket-status.js");

describe("shared/support/ticket-status.js", () => {
    test("exports a placeholder object until status transitions are added", () => {
        expect(ticketStatus).toBeTruthy();
        expect(ticketStatus.isPlaceholder).toBe(true);
    });
});
