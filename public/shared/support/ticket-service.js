/**
 * shared/support/ticket-service.js
 *
 * Placeholder for ticket Firestore CRUD (createTicket, addReply, updateStatus).
 * Real implementation comes next.
 */

const ticketService = {
    isPlaceholder: true
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = ticketService;
}

if (typeof window !== "undefined") {
    window.ticketService = ticketService;
}
