/**
 * @jest-environment jsdom
 */

const {
    initializeAdminApplicationPage
} = require("../../public/customer/admin-application.js");

describe("customer/admin-application.js", () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <p id="admin-application-message"></p>
            <button id="back-to-customer-home-button" type="button">Back</button>
        `;
    });

    test("initializeAdminApplicationPage sets the placeholder message and wires back navigation", () => {
        const navigate = jest.fn();

        const result = initializeAdminApplicationPage({
            navigate,
            backRoute: "./index.html"
        });

        expect(document.querySelector("#admin-application-message").textContent)
            .toContain("The full admin application flow will be built here next.");
        expect(result.backController).toBeTruthy();

        const route = result.backController.handleClick({
            preventDefault: jest.fn()
        });

        expect(route).toBe("./index.html");
        expect(navigate).toHaveBeenCalledWith("./index.html");
    });

    test("initializeAdminApplicationPage tolerates a missing button", () => {
        document.body.innerHTML = `
            <p id="admin-application-message"></p>
        `;

        const result = initializeAdminApplicationPage();
        expect(result.backController).toBeNull();
        expect(document.querySelector("#admin-application-message").textContent)
            .toContain("The full admin application flow will be built here next.");
    });
});
