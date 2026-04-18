import { db } from "./firebase-config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const params = new URLSearchParams(location.search);
const orderId = params.get("order");

const orderTitle = document.getElementById("order-title");
const orderSub = document.getElementById("order-sub");
const statusTag = document.getElementById("status-tag");
const readyBanner = document.getElementById("ready-banner");

const statusMap = { received: 0, preparing: 1, ready: 2 };
const tagClasses = { received: "tag-received", preparing: "tag-preparing", ready: "tag-ready" };
const tagLabels = { received: "Order received", preparing: "Preparing", ready: "Ready for pickup" };

function updateSteps(stage) {
  for (let i = 0; i < 3; i++) {
    const stepEl = document.getElementById("s" + i);
    const dotEl = document.getElementById("d" + i);
    stepEl.className = "step";
    dotEl.textContent = "";
    if (i < stage) {
      stepEl.classList.add("done");
      dotEl.textContent = "✓";
    } else if (i === stage) {
      stepEl.classList.add("active");
    }
  }
}

if (!orderId) {
  orderTitle.textContent = "No order ID found.";
  orderSub.textContent = "Add ?order=YOUR_ORDER_ID to the URL.";
} else {
  onSnapshot(doc(db, "orders", orderId), function(snap) {
    if (!snap.exists()) {
      orderTitle.textContent = "Order not found.";
      return;
    }

    const data = snap.data();
    const stage = statusMap[data.status] ?? 0;

    orderTitle.textContent = "Order #" + orderId;
    orderSub.textContent = (data.studentName || "") + " · " + (data.station || "");

    statusTag.className = "tag " + (tagClasses[data.status] || "");
    statusTag.textContent = tagLabels[data.status] || data.status;

    updateSteps(stage);

    if (data.status === "ready") {
      readyBanner.classList.remove("hidden");
    } else {
      readyBanner.classList.add("hidden");
    }
  });
}