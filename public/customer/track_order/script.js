const socket = io();
const orderList = document.getElementById("order-list");
const createOrderForm = document.getElementById("create-order-form");
const feedback = document.getElementById("create-order-feedback");

const ordersById = new Map();

function formatTime(iso) {
  return new Date(iso).toLocaleString();
}

function renderOrders() {
  const orders = Array.from(ordersById.values()).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );

  if (!orders.length) {
    orderList.innerHTML = "<p>No orders yet.</p>";
    return;
  }

  orderList.innerHTML = orders
    .map((order) => {
      const timeline = order.timeline
        .map(
          (entry) => `<li><strong>${entry.status}</strong> at ${formatTime(entry.timestamp)}</li>`
        )
        .join("");
      const readyClass = order.status === "Ready for Pickup" ? "ready" : "";
      const readyNote =
        order.status === "Ready for Pickup"
          ? '<p class="notify">Ready for collection. Please pick up your order.</p>'
          : "";

      return `
      <article class="order ${readyClass}" onclick="window.location.href='./order-detail.html?orderId=${order.orderId}'" style="cursor: pointer; transition: all 0.3s ease;">
        <header>
          <span class="order-id">Order #${order.orderId} - ${order.itemName}</span>
          <span class="order-status">${order.status}</span>
        </header>
        <p><strong>Student:</strong> ${order.studentName} | <strong>Vendor:</strong> ${order.vendorName}</p>
        ${readyNote}
        <ol class="timeline">${timeline}</ol>
        <p class="view-details">Click to view detailed progress →</p>
      </article>`;
    })
    .join("");

  // Add hover effect
  document.querySelectorAll(".order").forEach((order) => {
    order.addEventListener("mouseenter", () => {
      order.style.transform = "translateY(-4px)";
      order.style.boxShadow = "0 12px 32px rgba(15, 23, 42, 0.12)";
    });
    order.addEventListener("mouseleave", () => {
      order.style.transform = "translateY(0)";
      order.style.boxShadow = "0 8px 24px rgba(15, 23, 42, 0.06)";
    });
  });
}

async function loadOrders() {
  const res = await fetch("/api/orders");
  const data = await res.json();
  data.orders.forEach((order) => ordersById.set(order.orderId, order));
  renderOrders();
}

createOrderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  feedback.textContent = "";

  const studentName = document.getElementById("studentName").value.trim();
  const itemName = document.getElementById("itemName").value.trim();
  const vendorName = document.getElementById("vendorName").value.trim();

  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentName, itemName, vendorName })
  });
  const data = await res.json();

  if (!res.ok) {
    feedback.textContent = data.error || "Could not place order";
    return;
  }

  feedback.textContent = `Order #${data.order.orderId} placed successfully.`;
  createOrderForm.reset();
});

socket.on("bootstrap-orders", (orders) => {
  orders.forEach((order) => ordersById.set(order.orderId, order));
  renderOrders();
});

socket.on("order-updated", (order) => {
  ordersById.set(order.orderId, order);
  renderOrders();
});

socket.on("order-ready", ({ orderId, message }) => {
  const order = ordersById.get(orderId);
  if (!order) return;

  alert(message);
});

loadOrders().catch(() => {
  orderList.innerHTML = "<p>Could not load orders.</p>";
});
