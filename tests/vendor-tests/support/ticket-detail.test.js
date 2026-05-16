/**
 * @jest-environment jsdom
 */

const vendorSupportTicketDetailPage = require("../../../public/vendor/support/ticket-detail.js");

describe("vendor/support/ticket-detail.js", () => {
    test("exposes a placeholder init function until the ticket-detail page is built", () => {
        expect(typeof vendorSupportTicketDetailPage.initializeVendorSupportTicketDetailPage).toBe("function");

        const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
        const result = vendorSupportTicketDetailPage.initializeVendorSupportTicketDetailPage();
        consoleSpy.mockRestore();

        expect(result).toEqual({ isPlaceholder: true });
    });
});
