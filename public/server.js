const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const admin = require("firebase-admin");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, ".")));
app.use("/customer", express.static(path.join(__dirname, "customer")));
app.use("/vendor", express.static(path.join(__dirname, "vendor")));

// Initialize Firebase Admin SDK
function initializeFirebase() {
  try {
    if (admin.apps.length > 0) {
      console.log("Firebase already initialized");
      return;
    }

    const fs = require("fs");
    const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");

    // Check if service account file exists
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "campus-food-ordering-platform"
      });
      console.log("Firebase initialized with serviceAccountKey.json");
    } else {
      // Try to use environment variable
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
          projectId: "campus-food-ordering-platform"
        });
        console.log("Firebase initialized with GOOGLE_APPLICATION_CREDENTIALS environment variable");
      } else {
        throw new Error(
          "Firebase service account credentials not found.\n" +
          "Please do ONE of the following:\n" +
          "1. Download serviceAccountKey.json from Firebase Console and place it in the project root\n" +
          "2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable pointing to the JSON file\n\n" +
          "Instructions: Go to Firebase Console > Project Settings > Service Accounts > Generate New Private Key"
        );
      }
    }
  } catch (error) {
    console.error("Firebase initialization failed:", error.message);
    process.exit(1);
  }
}

initializeFirebase();

const db = admin.firestore();

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

// Fetch all orders from Firestore
app.get("/api/orders", async (_req, res) => {
  try {
    const snapshot = await db.collection("orders").get();
    
    const allOrders = [];
    snapshot.forEach((doc) => {
      allOrders.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Sort by CreatedAt timestamp in descending order
    allOrders.sort((a, b) => {
      const timeA = a.CreatedAt?.toMillis?.() || 0;
      const timeB = b.CreatedAt?.toMillis?.() || 0;
      return timeB - timeA;
    });

    res.json({ orders: allOrders });
  } catch (error) {
    console.error("Error fetching orders from Firestore:", error);
    res.status(500).json({ error: "Failed to fetch orders", details: error.message });
  }
});

// Fetch orders for a specific customer
app.get("/api/orders/customer/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params;
    
    console.log(`Fetching orders for customerId: ${customerId}`);
    
    // Try to fetch orders by customerId field first
    let snapshot = await db.collection("orders")
      .where("customerId", "==", customerId)
      .get();
    
    let customerOrders = [];
    snapshot.forEach((doc) => {
      customerOrders.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`Found ${customerOrders.length} orders with customerId: ${customerId}`);

    // If no orders found with customerId, try fetching by email field (if available)
    if (customerOrders.length === 0) {
      console.log(`No orders found by customerId, trying email field...`);
      snapshot = await db.collection("orders")
        .where("email", "==", customerId)
        .get();
      
      snapshot.forEach((doc) => {
        customerOrders.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      console.log(`Found ${customerOrders.length} orders with email: ${customerId}`);
    }

    // If still no orders, return all orders as fallback (for compatibility with current data structure)
    if (customerOrders.length === 0) {
      console.log(`No orders found by customerId or email, returning all orders as fallback...`);
      snapshot = await db.collection("orders").get();
      snapshot.forEach((doc) => {
        customerOrders.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      console.log(`Returning ${customerOrders.length} total orders from fallback`);
    }

    // Sort by CreatedAt timestamp in descending order
    customerOrders.sort((a, b) => {
      const timeA = a.CreatedAt?.toMillis?.() || 0;
      const timeB = b.CreatedAt?.toMillis?.() || 0;
      return timeB - timeA;
    });

    res.json({ orders: customerOrders });
  } catch (error) {
    console.error("Error fetching customer orders from Firestore:", error);
    res.status(500).json({ error: "Failed to fetch customer orders", details: error.message });
  }
});

// Get a specific order by ID
app.get("/api/orders/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const doc = await db.collection("orders").doc(orderId).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({ order: { id: doc.id, ...doc.data() } });
  } catch (error) {
    console.error("Error fetching order from Firestore:", error);
    res.status(500).json({ error: "Failed to fetch order", details: error.message });
  }
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

io.on("connection", async (socket) => {
  try {
    console.log("Client connected, bootstrapping orders...");
    
    // Fetch orders from Firestore
    const snapshot = await db.collection("orders").get();
    
    const firestoreOrders = [];
    snapshot.forEach((doc) => {
      firestoreOrders.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`Fetched ${firestoreOrders.length} orders from Firestore`);

    // Sort by CreatedAt timestamp
    firestoreOrders.sort((a, b) => {
      const timeA = a.CreatedAt?.toMillis?.() || 0;
      const timeB = b.CreatedAt?.toMillis?.() || 0;
      return timeB - timeA;
    });

    // Combine Firestore orders with in-memory orders
    const inMemoryOrdersArray = Array.from(orders.values());
    const allOrders = [...firestoreOrders, ...inMemoryOrdersArray];
    
    console.log(`Total orders to send: ${allOrders.length} (${firestoreOrders.length} from Firestore, ${inMemoryOrdersArray.length} in-memory)`);
    console.log("Emitting bootstrap-orders with data:", allOrders);
    
    // Send orders as array
    socket.emit("bootstrap-orders", allOrders);
  } catch (error) {
    console.error("Error bootstrapping orders on connection:", error);
    socket.emit("bootstrap-orders", Array.from(orders.values()));
  }
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
