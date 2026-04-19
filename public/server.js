const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, ".")));
app.use("/customer", express.static(path.join(__dirname, "customer")));
app.use("/vendor", express.static(path.join(__dirname, "vendor")));

const ORDER_STATUSES = ["Order Received", "Preparing", "Ready for Pickup"];

const orders = new Map();
let nextOrderId = 1000;

function createOrder({ studentName, itemName, vendorName }) {
  const orderId = String(nextOrderId++);
  const now = new Date().toISOString();
  const order = {
    orderId,
    studentName,
    itemName,
    vendorName,
    status: ORDER_STATUSES[0],
    createdAt: now,
    updatedAt: now,
    timeline: [{ status: ORDER_STATUSES[0], timestamp: now }]
  };

  orders.set(orderId, order);
  return order;
}

function updateOrderStatus(orderId, status) {
  const order = orders.get(orderId);
  if (!order) return { error: "Order not found", order: null };

  if (!ORDER_STATUSES.includes(status)) {
    return { error: "Invalid status", order: null };
  }

  const currentIndex = ORDER_STATUSES.indexOf(order.status);
  const nextIndex = ORDER_STATUSES.indexOf(status);
  if (nextIndex < currentIndex) {
    return {
      error: "Cannot move order backwards in status flow",
      order: null
    };
  }

  if (order.status === status) {
    return { error: null, order };
  }

  const updatedAt = new Date().toISOString();
  order.status = status;
  order.updatedAt = updatedAt;
  order.timeline.push({ status, timestamp: updatedAt });
  orders.set(orderId, order);

  return { error: null, order };
}

app.get("/api/statuses", (_req, res) => {
  res.json({ statuses: ORDER_STATUSES });
});

app.get("/api/orders", (_req, res) => {
  const allOrders = Array.from(orders.values()).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
  res.json({ orders: allOrders });
});

app.get("/api/orders/:orderId", (req, res) => {
  const order = orders.get(req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ order });
});

app.post("/api/orders", (req, res) => {
  const { studentName, itemName, vendorName } = req.body || {};
  if (!studentName || !itemName || !vendorName) {
    return res
      .status(400)
      .json({ error: "studentName, itemName, and vendorName are required" });
  }

  const order = createOrder({ studentName, itemName, vendorName });
  io.emit("order-created", order);
  io.emit("order-updated", order);

  return res.status(201).json({ order });
});

app.patch("/api/orders/:orderId/status", (req, res) => {
  const { status } = req.body || {};
  const { error, order } = updateOrderStatus(req.params.orderId, status);

  if (error === "Order not found") {
    return res.status(404).json({ error });
  }
  if (error) {
    return res.status(400).json({ error });
  }

  io.emit("order-updated", order);
  if (order.status === "Ready for Pickup") {
    io.emit("order-ready", {
      orderId: order.orderId,
      studentName: order.studentName,
      itemName: order.itemName,
      vendorName: order.vendorName,
      message: `Order #${order.orderId} for ${order.studentName} is ready for pickup.`
    });
  }

  return res.json({ order });
});

io.on("connection", (socket) => {
  socket.emit("bootstrap-orders", Array.from(orders.values()));
});

// 404 handler - serve 404.html for undefined routes
app.use((_req, res) => {
  res.status(404).sendFile(path.join(__dirname, "404.html"));
});

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Order tracking system running at http://localhost:${PORT}`);
  });
}

module.exports = { app, server, orders, createOrder, updateOrderStatus, ORDER_STATUSES };
