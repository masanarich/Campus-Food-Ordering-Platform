const ticketModel = require("../../../public/shared/support/ticket-model.js");

describe("shared/support/ticket-model.js", () => {
    test("exports a placeholder object until the real model lands", () => {
        expect(ticketModel).toBeTruthy();
        expect(ticketModel.isPlaceholder).toBe(true);
    });
});
