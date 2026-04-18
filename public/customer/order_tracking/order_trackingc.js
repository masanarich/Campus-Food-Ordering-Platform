import { db } from "../../firebase-config.js";
import {
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const btnTrack = document.getElementById("btn-track");
const orderIdInput = document.getElementById("order-id-input");
const trackingSection = document.getElementById("tracking-section");
const notFound = document.getElementById("not-found");
const orderTitle = document.getElementById("order-title");
const orderSub = document.getElementById("order-sub");
const statusTag = document.getElementById("status-tag");
const readyBanner = document.getElementById("ready-banner");
const itemsList = document.getElementById("items-list");

const tagClasses = {
  received: "tag-received",
  preparing: "tag-preparing",
  ready: "tag-ready"
};

const tagLabels = {
  received: "Order Received",
  preparing: "Preparing",
  ready: "Ready for Pickup"
};

const statusMap = {
  received: 0,
  preparing: 1,
  ready: 2
};

let unsubscribe = null;
let previousStatus = null;

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function sendNotification(orderId) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Your order is ready!", {
      body: "Order #" + orderId + " is ready for collection. Please pick it up from the vendor counter.",
      icon: "/favicon.ico"
    });
  }
}

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

function renderOrder(orderId, data) {
  const stage = statusMap[data.status] ?? 0;

  orderTitle.textContent = "Order #" + orderId;
  orderSub.textContent = (data.studentName || "") + (data.station ? " · " + data.station : "");

  statusTag.className = "tag " + (tagClasses[data.status] || "tag-received");
  statusTag.textContent = tagLabels[data.status] || "Order Received";

  updateSteps(stage);

  if (data.status === "ready") {
    readyBanner.classList.remove("hidden");
    if (previousStatus !== "ready") {
      sendNotification(orderId);
    }
  } else {
    readyBanner.classList.add("hidden");
  }

  previousStatus = data.status;

  itemsList.innerHTML = "";
  const items = data.items || [];
  if (items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No items listed.";
    itemsList.appendChild(li);
  } else {
    items.forEach(function (item) {
      const li = document.createElement("li");
      li.textContent = item;
      itemsList.appendChild(li);
    });
  }
}

btnTrack.addEventListener("click", function () {
  const orderId = orderIdInput.value.trim();
  if (!orderId) return;

  if (unsubscribe) {
    unsubscribe();
  }

  previousStatus = null;
  trackingSection.classList.add("hidden");
  notFound.classList.add("hidden");

  requestNotificationPermission();

  unsubscribe = onSnapshot(doc(db, "orders", orderId), function (snap) {
    if (!snap.exists()) {
      trackingSection.classList.add("hidden");
      notFound.classList.remove("hidden");
      return;
    }

    notFound.classList.add("hidden");
    trackingSection.classList.remove("hidden");
    renderOrder(orderId, snap.data());
  });
});

orderIdInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    btnTrack.click();
  }
});