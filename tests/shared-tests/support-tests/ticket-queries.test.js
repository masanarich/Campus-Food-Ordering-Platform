const ticketQueries = require("../../../public/shared/support/ticket-queries.js");

describe("shared/support/ticket-queries.js", () => {
    test("exports a placeholder object until ticket queries are added", () => {
        expect(ticketQueries).toBeTruthy();
        expect(ticketQueries.isPlaceholder).toBe(true);
    });
});
