const socket = io();

// Get order ID from URL
const params = new URLSearchParams(window.location.search);
const orderId = params.get("orderId");

if (!orderId) {
  window.location.href = "index.html";
}

const ORDER_STATUSES = ["Order Received", "Preparing", "Ready for Pickup"];
let currentOrder = null;

function formatTime(iso) {
  return new Date(iso).toLocaleString();
}

function formatTimeShort(iso) {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function calculateEstimatedTime(order) {
  const createdTime = new Date(order.createdAt);
  const now = new Date();
  const elapsedMs = now - createdTime;
  const elapsedMins = Math.floor(elapsedMs / 60000);

  if (order.status === "Order Received") {
    return `Your order was placed ${elapsedMins} minute${elapsedMins !== 1 ? "s" : ""} ago`;
  }

  if (order.status === "Preparing") {
    const estimatedMins = 15; // Estimated time to prepare
    return `Approximately ${estimatedMins} minutes until ready`;
  }

  if (order.status === "Ready for Pickup") {
    const readyTime = order.timeline.find((t) => t.status === "Ready for Pickup");
    if (readyTime) {
      const readyDate = new Date(readyTime.timestamp);
      return `Ready since ${formatTimeShort(readyDate)}`;
    }
  }

  return "Status unknown";
}

function getStageIndex(status) {
  return ORDER_STATUSES.indexOf(status);
}

function updateProgressDisplay(order) {
  const currentStageIndex = getStageIndex(order.status);

  // Update stage states
  document.querySelectorAll(".stage").forEach((stage, index) => {
    stage.classList.remove("active", "completed", "upcoming");

    if (index < currentStageIndex) {
      stage.classList.add("completed");
    } else if (index === currentStageIndex) {
      stage.classList.add("active");
    } else {
      stage.classList.add("upcoming");
    }

    // Update stage time
    const timeEl = document.getElementById(`time-${index}`);
    const stageStatus = ORDER_STATUSES[index];
    const timelineEntry = order.timeline.find((t) => t.status === stageStatus);

    if (timelineEntry) {
      timeEl.textContent = formatTimeShort(timelineEntry.timestamp);
      timeEl.style.display = "block";
    } else {
      timeEl.style.display = "none";
    }
  });

  // Show ready message if order is ready
  const readyMsg = document.getElementById("ready-message");
  if (order.status === "Ready for Pickup") {
    readyMsg.style.display = "block";
  } else {
    readyMsg.style.display = "none";
  }
}

function updateTimeline(order) {
  const timeline = order.timeline
    .map(
      (entry) => `
      <li>
        <strong>${entry.status}</strong> 
        <br>
        <small>${formatTime(entry.timestamp)}</small>
      </li>`
    )
    .join("");

  document.getElementById("timeline").innerHTML = timeline;
}

function updateOrderDisplay(order) {
  document.getElementById("order-number").textContent = `Order #${order.orderId}`;
  document.getElementById("order-summary").textContent = `${order.itemName} from ${order.vendorName} for ${order.studentName}`;
  document.getElementById("time-estimate").textContent = calculateEstimatedTime(order);

  updateProgressDisplay(order);
  updateTimeline(order);
}

async function loadOrder() {
  try {
    const res = await fetch(`/api/orders/${orderId}`);
    if (!res.ok) {
      throw new Error("Order not found");
    }
    const data = await res.json();
    currentOrder = data.order;
    updateOrderDisplay(currentOrder);
  } catch (error) {
    document.querySelector(".container").innerHTML = `
      <div class="card error">
        <h2>Order Not Found</h2>
        <p>${error.message}</p>
        <a href="index.html" class="back-button">← Back to Orders</a>
      </div>
    `;
  }
}

// Listen for order updates
socket.on("order-updated", (order) => {
  if (order.orderId === orderId) {
    currentOrder = order;
    updateOrderDisplay(currentOrder);
  }
});

socket.on("order-ready", ({ orderId: readyOrderId }) => {
  if (readyOrderId === orderId && currentOrder) {
    currentOrder.status = "Ready for Pickup";
    updateOrderDisplay(currentOrder);
  }
});

// Load initial order
loadOrder();
