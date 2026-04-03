const menuToggle = document.getElementById("menuToggle");
const menuList = document.getElementById("menuList");
const currentYear = document.getElementById("currentYear");

if (menuToggle && menuList) {
    menuToggle.addEventListener("click", () => {
        const isOpen = menuList.classList.toggle("open");
        menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
}

if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
}