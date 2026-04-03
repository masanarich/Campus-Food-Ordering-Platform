function initializeMenu() {
    const menuToggle = document.getElementById("menuToggle");
    const menuList = document.getElementById("menuList");

    if (menuToggle && menuList) {
        menuToggle.addEventListener("click", () => {
            const isOpen = menuList.classList.toggle("open");
            menuToggle.setAttribute("aria-expanded", String(isOpen));
        });
    }
}

function setCurrentYear() {
    const currentYear = document.getElementById("currentYear");

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }
}

function initializePage() {
    initializeMenu();
    setCurrentYear();
}

if (typeof window !== "undefined") {
    initializePage();
}

if (typeof module !== "undefined") {
    module.exports = { initializeMenu, setCurrentYear };
}