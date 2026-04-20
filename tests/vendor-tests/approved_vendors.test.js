/**
 * @jest-environment jsdom
 */

// This will fail (Red) because the file or function doesn't exist yet
const { renderVendorList } = require("../../public/Approved_vendors/index.js");

describe("Approved Vendors - Customer Browsing (RED STAGE)", () => {
    beforeEach(() => {
        // Prepare the semantic DOM shell
        document.body.innerHTML = `
            <main>
                <header><h1>Available Stores</h1></header>
                <section id="vendor-list-section">
                    <ul id="vendor-grid"></ul>
                </section>
                <p id="vendor-status-message"></p>
            </main>
        `;
    });

    test("should render vendor articles and menu links when data is provided", () => {
        
        const mockDbVendors = [
            { 
                id: "wits_canteen_01", 
                name: "The Matrix Canteen", 
                description: "Affordable campus meals", 
                trading: "Open"
            }
        ];

    
        renderVendorList(mockDbVendors);


        const vendorArticle = document.querySelector("article.vendor-card");
        const menuLink = document.querySelector("a.view-menu-btn");

        expect(vendorArticle).not.toBeNull();
        expect(menuLink).not.toBeNull();
        expect(menuLink.getAttribute("href")).toBe("menu.html?vendorId=wits_canteen_01");
    });

    test("should show a 'No vendors available' message when the list is empty", () => {
        // ACT: Pass an empty array (simulating your current empty database)
        renderVendorList([]);

        
        const statusMessage = document.querySelector("#vendor-status-message");
        expect(statusMessage.textContent).toBe("No approved vendors found at the moment.");
    });
});