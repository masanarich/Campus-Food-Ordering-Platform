/**
 * @jest-environment jsdom
 */

const customerSupportListPage = require("../../../public/customer/support/index.js");

describe("customer/support/index.js", () => {
    test("exposes a placeholder init function until the list page is built", () => {
        expect(typeof customerSupportListPage.initializeCustomerSupportListPage).toBe("function");

        const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
        const result = customerSupportListPage.initializeCustomerSupportListPage();
        consoleSpy.mockRestore();

        expect(result).toEqual({ isPlaceholder: true });
    });
});
