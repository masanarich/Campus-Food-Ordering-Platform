const socket = io();
const vendorOrderList = document.getElementById("vendor-order-list");
const ordersById = new Map();
const statusFlow = ["Order Received", "Preparing", "Ready for Pickup"];

function formatTime(iso) {
  return new Date(iso).toLocaleString();
}

function nextStatus(status) {
  const index = statusFlow.indexOf(status);
  return statusFlow[index + 1] || null;
}

async function updateStatus(orderId, status) {
  const res = await fetch(`/api/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Unable to update order status");
    return;
  }
}

function renderOrders() {
  const orders = Array.from(ordersById.values()).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );

  if (!orders.length) {
    vendorOrderList.innerHTML = "<p>No orders yet.</p>";
    return;
  }

  vendorOrderList.innerHTML = orders
    .map((order) => {
      const next = nextStatus(order.status);
      const action = next
        ? `<button data-order-id="${order.orderId}" data-status="${next}">Move to: ${next}</button>`
        : "<p class='notify'>Student has been notified for pickup.</p>";

      return `
      <article class="order ${order.status === "Ready for Pickup" ? "ready" : ""}">
        <header>
          <span class="order-id">Order #${order.orderId} - ${order.itemName}</span>
          <span class="order-status">${order.status}</span>
        </header>
        <p><strong>Student:</strong> ${order.studentName}</p>
        <p><strong>Vendor:</strong> ${order.vendorName}</p>
        <p><strong>Last update:</strong> ${formatTime(order.updatedAt)}</p>
        ${action}
      </article>`;
    })
    .join("");

  const buttons = vendorOrderList.querySelectorAll("button[data-order-id]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const orderId = button.getAttribute("data-order-id");
      const status = button.getAttribute("data-status");
      updateStatus(orderId, status);
    });
  });
}

socket.on("bootstrap-orders", (orders) => {
  orders.forEach((order) => ordersById.set(order.orderId, order));
  renderOrders();
});

socket.on("order-created", (order) => {
  ordersById.set(order.orderId, order);
  renderOrders();
});

socket.on("order-updated", (order) => {
  ordersById.set(order.orderId, order);
  renderOrders();
});

(async function init() {
  try {
    const res = await fetch("/api/orders");
    const data = await res.json();
    data.orders.forEach((order) => ordersById.set(order.orderId, order));
    renderOrders();
  } catch (_error) {
    vendorOrderList.innerHTML = "<p>Could not load vendor orders.</p>";
  }
})();
