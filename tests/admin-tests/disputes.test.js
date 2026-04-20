/**
 * @jest-environment jsdom
 */

const {
    normalizeText,
    resolveAuthUtils,
    getRoute,
    setStatusMessage,
    attachNavigationHandler,
    initializeAdminDisputesPage
} = require("../../public/admin/disputes.js");

function createDisputesDom() {
    document.body.innerHTML = `
        <main>
            <p id="admin-disputes-status"></p>
            <button id="back-to-admin-dashboard-button" type="button">Back</button>
            <button id="go-manage-users-button" type="button">Users</button>
        </main>
    `;

    return {
        statusElement: document.querySelector("#admin-disputes-status"),
        backButton: document.querySelector("#back-to-admin-dashboard-button"),
        manageUsersButton: document.querySelector("#go-manage-users-button")
    };
}

describe("admin/disputes.js", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.authUtils;
    });

    test("helpers normalize values and resolve routes", () => {
        expect(normalizeText("  hello  ")).toBe("hello");
        expect(normalizeText()).toBe("");

        window.authUtils = { value: 1 };
        expect(resolveAuthUtils()).toBe(window.authUtils);
        expect(resolveAuthUtils({ value: 2 })).toEqual({ value: 2 });

        expect(getRoute("dashboard")).toBe("./index.html");
        expect(getRoute("users")).toBe("./users.html");
        expect(getRoute("profile")).toBe("../authentication/profile.html");
        expect(
            getRoute("admin", {
                getPortalRoute: jest.fn(() => "/custom/admin.html")
            })
        ).toBe("/custom/admin.html");
    });

    test("setStatusMessage updates content and state", () => {
        const paragraph = document.createElement("p");

        setStatusMessage(paragraph, "Loaded", "info");

        expect(paragraph.textContent).toBe("Loaded");
        expect(paragraph.dataset.state).toBe("info");
    });

    test("attachNavigationHandler navigates when clicked", () => {
        const button = document.createElement("button");
        const navigate = jest.fn();

        const controller = attachNavigationHandler({
            button,
            route: "./index.html",
            navigate
        });

        expect(
            controller.handleClick({
                preventDefault: jest.fn()
            })
        ).toBe("./index.html");
        expect(navigate).toHaveBeenCalledWith("./index.html");
        expect(attachNavigationHandler({ button: null, route: "./index.html" })).toBeNull();
    });

    test("initializeAdminDisputesPage wires placeholder navigation", () => {
        const dom = createDisputesDom();
        const navigate = jest.fn();

        const result = initializeAdminDisputesPage({ navigate });

        expect(dom.statusElement.textContent)
            .toBe("Disputes workspace placeholder loaded. Full dispute handling will be added later.");
        expect(dom.statusElement.dataset.state).toBe("info");
        expect(result.backController).toBeTruthy();
        expect(result.manageUsersController).toBeTruthy();

        dom.backButton.click();
        dom.manageUsersButton.click();

        expect(navigate).toHaveBeenCalledWith("./index.html");
        expect(navigate).toHaveBeenCalledWith("./users.html");
    });
});
