function initializeVendorShopPage(options = {}) {
    const navigate =
        typeof options.navigate === "function"
            ? options.navigate
            : function fallbackNavigate(nextRoute) {
                window.location.href = nextRoute;
            };

    const backButton = document.querySelector("#back-to-dashboard-button");

    if (backButton) {
        backButton.addEventListener("click", function handleClick(event) {
            if (event && typeof event.preventDefault === "function") {
                event.preventDefault();
            }

            navigate("./index.html");
        });
    }

    return {
        success: true
    };
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        initializeVendorShopPage
    };
}

if (typeof window !== "undefined") {
    window.vendorShopPage = {
        initializeVendorShopPage
    };

    window.vendorShopPage.initializeVendorShopPage();
}
