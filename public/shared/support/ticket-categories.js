/**
 * shared/support/ticket-categories.js
 *
 * Placeholder for ticket category constants (order_issue, payment, refund, account, abuse, general).
 * Real implementation comes next.
 */

const ticketCategories = {
    isPlaceholder: true
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = ticketCategories;
}

if (typeof window !== "undefined") {
    window.ticketCategories = ticketCategories;
}
