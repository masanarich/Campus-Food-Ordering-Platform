/**
 * @jest-environment jsdom
 */

const { initializeMenu, setCurrentYear } = require("../index.js");

describe("Landing Page Behaviour", () => {

    test("menu button toggles open class", () => {

        document.body.innerHTML = `
            <button id="menuToggle" aria-expanded="false"></button>
            <ul id="menuList"></ul>
        `;

        initializeMenu();

        const button = document.getElementById("menuToggle");
        const menu = document.getElementById("menuList");

        button.click();

        expect(menu.classList.contains("open")).toBe(true);
        expect(button.getAttribute("aria-expanded")).toBe("true");
    });

    test("current year is inserted into page", () => {

        document.body.innerHTML = `
            <span id="currentYear"></span>
        `;

        setCurrentYear();

        const year = document.getElementById("currentYear").textContent;

        expect(year).toBe(String(new Date().getFullYear()));
    });

});