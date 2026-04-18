function initializeAdminApplicationPage(options = {}) {
    const navigate =
        typeof options.navigate === "function"
            ? options.navigate
            : function fallbackNavigate(nextRoute) {
                window.location.href = nextRoute;
            };

    const backRoute = options.backRoute || "./index.html";
    const messageElement = document.querySelector("#admin-application-message");
    const backButton = document.querySelector("#back-to-customer-home-button");

    if (messageElement) {
        messageElement.textContent =
            "The full admin application flow will be built here next. For now, use this page as the customer dashboard placeholder destination.";
    }

    if (!backButton) {
        return {
            backController: null
        };
    }

    function handleBackClick(event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        navigate(backRoute);
        return backRoute;
    }

    backButton.addEventListener("click", handleBackClick);

    return {
        backController: {
            handleClick: handleBackClick
        }
    };
}

const adminApplicationPage = {
    initializeAdminApplicationPage
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = adminApplicationPage;
}

if (typeof window !== "undefined") {
    window.adminApplicationPage = adminApplicationPage;
}
