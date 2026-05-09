/**
 * @jest-environment jsdom
 */

const { initializeVendorShopPage } = require("../../public/vendor/shop.js");

describe("vendor/shop.js", () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <main>
                <button id="back-to-dashboard-button" type="button">Back</button>
            </main>
        `;
    });

    test("initializeVendorShopPage wires back navigation", () => {
        const navigate = jest.fn();

        const result = initializeVendorShopPage({ navigate });

        expect(result.success).toBe(true);

        document.getElementById("back-to-dashboard-button").click();

        expect(navigate).toHaveBeenCalledWith("./index.html");
    });
});
