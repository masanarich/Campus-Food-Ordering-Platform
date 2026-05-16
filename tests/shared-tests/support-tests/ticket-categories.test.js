const ticketCategories = require("../../../public/shared/support/ticket-categories.js");

describe("shared/support/ticket-categories.js", () => {
    test("exports a placeholder object until the category list is added", () => {
        expect(ticketCategories).toBeTruthy();
        expect(ticketCategories.isPlaceholder).toBe(true);
    });
});
