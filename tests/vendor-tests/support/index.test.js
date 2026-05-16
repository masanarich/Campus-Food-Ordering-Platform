/**
 * @jest-environment jsdom
 */

const vendorSupportListPage = require("../../../public/vendor/support/index.js");

describe("vendor/support/index.js", () => {
    test("exposes a placeholder init function until the list page is built", () => {
        expect(typeof vendorSupportListPage.initializeVendorSupportListPage).toBe("function");

        const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
        const result = vendorSupportListPage.initializeVendorSupportListPage();
        consoleSpy.mockRestore();

        expect(result).toEqual({ isPlaceholder: true });
    });
});
