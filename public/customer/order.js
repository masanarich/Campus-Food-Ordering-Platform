import { db } from "./config.js";
import { collection, addDoc, getDocs, doc, getDoc, updateDoc } 
from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/* =========================
   ORDER STATUS ENUM
========================= */
export const ORDER_STATUS = {
  CREATED: "CREATED",
  PENDING: "PENDING",
  PREPARING: "PREPARING",
  READY: "READY",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
};

/* =========================
   FIREBASE CREATE ORDER
========================= */
export async function createOrder(userId, vendorId, items, total) {
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
export async function getOrders() {
  const snapshot = await getDocs(collection(db, "orders"));

  return snapshot.docs.map(doc => ({
    orderId: doc.id,
    ...doc.data()
  }));
}

/* =========================
   GET ORDER BY ID
========================= */
export async function getOrderById(orderId) {
  const ref = doc(db, "orders", orderId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  return {
    orderId: snapshot.id,
    ...snapshot.data()
  };
}

/* =========================
   UPDATE ORDER STATUS
========================= */
export async function updateOrderStatus(orderId, status) {
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
export async function cancelOrder(orderId) {
  return updateOrderStatus(orderId, ORDER_STATUS.CANCELLED);
}