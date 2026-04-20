import { jest } from '@jest/globals';

// 1. Mock the local config
jest.unstable_mockModule("../../public/authentication/config.js", () => ({
    db: { type: 'firestore-mock' },
    auth: { currentUser: { email: 'student@wits.ac.za' } }
}));

// 2. Mock Firebase Auth
let triggerAuthChange;
jest.unstable_mockModule("https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js", () => ({
    onAuthStateChanged: jest.fn((auth, callback) => {
        triggerAuthChange = async (user) => {
            callback(user);
            await new Promise(resolve => setTimeout(resolve, 0));
        };
    })
}));

// 3. Mock Firebase Firestore (CRITICAL: Must match the URLs in index.js)
let mockDocs = [];
jest.unstable_mockModule("https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js", () => ({
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    getDocs: jest.fn(async () => ({
        size: mockDocs.length,
        forEach: (callback) => mockDocs.forEach(doc => callback(doc))
    }))
}));

// 4. Import the script AFTER mocks are defined
await import("../../public/Approved_vendors/index.js");

describe("Order Management - Approved Vendors UI", () => {
    beforeEach(() => {
        document.body.innerHTML = '<ul id="vendor-grid"></ul>';
        mockDocs = [];
        jest.clearAllMocks();
    });

    test("renders exactly 4 cards when 2 real vendors are provided via Firestore", async () => {
        mockDocs = [
            {
                id: "v1",
                data: () => ({
                    vendorBusinessName: "Matrix Curry",
                    vendorLocation: "Matrix",
                    vendorDescription: "Curry shop",
                    vendorFoodType: "Indian"
                })
            },
            {
                id: "v2",
                data: () => ({
                    vendorBusinessName: "Zesty Lemon",
                    vendorLocation: "Main Braam",
                    vendorDescription: "Juice shop",
                    vendorFoodType: "Drinks"
                })
            }
        ];

        await triggerAuthChange({ email: 'student@wits.ac.za' });

        const grid = document.getElementById("vendor-grid");
        const cards = grid.querySelectorAll("article.vendor-card");

        expect(cards.length).toBe(4); // 2 real + 2 placeholders
        expect(grid.innerHTML).toContain("Matrix Curry");
        expect(grid.innerHTML).toContain("Coming Soon");
    });
});