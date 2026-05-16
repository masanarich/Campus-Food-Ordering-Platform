/**
 * vendor/support/new.js
 *
 * Placeholder for the vendor "open a new ticket" page.
 * Real implementation comes next.
 */

function initializeVendorSupportNewPage() {
    console.log("vendor/support/new: coming soon.");
    return { isPlaceholder: true };
}

const vendorSupportNewPage = {
    initializeVendorSupportNewPage
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = vendorSupportNewPage;
}

if (typeof window !== "undefined") {
    window.vendorSupportNewPage = vendorSupportNewPage;
}
