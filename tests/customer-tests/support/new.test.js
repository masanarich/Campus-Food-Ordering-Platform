/**
 * @jest-environment jsdom
 */

const customerSupportNewPage = require("../../../public/customer/support/new.js");

describe("customer/support/new.js", () => {
    test("exposes a placeholder init function until the new-ticket form is built", () => {
        expect(typeof customerSupportNewPage.initializeCustomerSupportNewPage).toBe("function");

        const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
        const result = customerSupportNewPage.initializeCustomerSupportNewPage();
        consoleSpy.mockRestore();

        expect(result).toEqual({ isPlaceholder: true });
    });
});
