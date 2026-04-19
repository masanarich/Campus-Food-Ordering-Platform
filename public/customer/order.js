const { db } = require("./config");

const { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc 
} = require("firebase/firestore");

const ORDER_STATUS = {
  CREATED: "CREATED",
  PENDING: "PENDING",
  PREPARING: "PREPARING",
  READY: "READY",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
};

/* =========================
   CREATE ORDER
========================= */
async function createOrder(userId, vendorId, items, total) {
  const order = {
    userId,
    vendorId,
    items,
    total,
    status: ORDER_STATUS.CREATED,
    createdAt: Date.now()
  };

  const docRef = await addDoc(collection(db, "orders"), order);

  return {
    orderId: docRef.id,
    ...order
  };
}

/* =========================
   GET ALL ORDERS
========================= */
async function getOrders() {
  const snapshot = await getDocs(collection(db, "orders"));

  return snapshot.docs.map(d => ({
    orderId: d.id,
    ...d.data()
  }));
}

/* =========================
   GET ORDER BY ID
========================= */
async function getOrderById(orderId) {
  const ref = doc(db, "orders", orderId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  return {
    orderId: snapshot.id,
    ...snapshot.data()
  };
}

/* =========================
   UPDATE STATUS
========================= */
async function updateOrderStatus(orderId, status) {
  if (!Object.values(ORDER_STATUS).includes(status)) {
    throw new Error("Invalid order status");
  }

  const ref = doc(db, "orders", orderId);

  await updateDoc(ref, { status });

  return {
    orderId,
    status
  };
}

/* =========================
   CANCEL ORDER
========================= */
async function cancelOrder(orderId) {
  return updateOrderStatus(orderId, ORDER_STATUS.CANCELLED);
}

/* =========================
   CLEAR (for tests/mock reset)
========================= */
async function clearOrders() {
  // Optional: for testing only (not real Firestore delete logic)
  return true;
}

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  clearOrders,
  ORDER_STATUS
};