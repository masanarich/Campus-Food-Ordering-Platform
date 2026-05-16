/**
 * @jest-environment jsdom
 */

const vendorSupportNewPage = require("../../../public/vendor/support/new.js");

describe("vendor/support/new.js", () => {
    test("exposes a placeholder init function until the new-ticket form is built", () => {
        expect(typeof vendorSupportNewPage.initializeVendorSupportNewPage).toBe("function");

        const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
        const result = vendorSupportNewPage.initializeVendorSupportNewPage();
        consoleSpy.mockRestore();

        expect(result).toEqual({ isPlaceholder: true });
    });
});
