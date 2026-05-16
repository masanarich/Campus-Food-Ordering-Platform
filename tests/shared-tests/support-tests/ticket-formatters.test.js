const ticketFormatters = require("../../../public/shared/support/ticket-formatters.js");

describe("shared/support/ticket-formatters.js", () => {
    test("exports a placeholder object until formatters are added", () => {
        expect(ticketFormatters).toBeTruthy();
        expect(ticketFormatters.isPlaceholder).toBe(true);
    });
});
