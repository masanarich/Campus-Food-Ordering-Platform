import { auth, db } from '../../authentication/config.js';

import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  collection, query, where,
  onSnapshot, updateDoc, doc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

let allOrders     = [];
let currentFilter = 'all';

// AUTH — load orders if logged in, do nothing if not
onAuthStateChanged(auth, (user) => {
  if (user) {
    listenToOrders(user.uid);
  }
});

// LOGOUT
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = '../../authentication/login.html';
});

// TABS
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentFilter = btn.dataset.filter;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderOrders();
  });
});

// REAL-TIME LISTENER
function listenToOrders(vendorId) {
  const q = query(
    collection(db, 'orders'),
    where('vendorId', '==', vendorId)
  );

  onSnapshot(q, (snapshot) => {
    allOrders = [];
    snapshot.forEach((docSnap) => {
      allOrders.push({ id: docSnap.id, ...docSnap.data() });
    });

    allOrders.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });

    renderOrders();
  });
}

// RENDER ORDERS
function renderOrders() {
  const list = document.getElementById('ordersList');
  const filtered = currentFilter === 'all'
    ? allOrders
    : allOrders.filter(o => o.status === currentFilter);

  if (filtered.length === 0) {
    list.innerHTML = `
      <p class="empty-state">
        <span style="font-size:2.5rem">📋</span><br/>
        No ${currentFilter === 'all' ? '' : currentFilter} orders yet.
      </p>`;
    return;
  }

  list.innerHTML = filtered.map(order => `
    <article class="order-card new-order-flash" id="order-${order.id}">

      <header class="order-top">
        <section>
          <p class="order-id">Order #${order.id.slice(-6).toUpperCase()}</p>
          <p class="order-student">👤 ${order.studentName || 'Student'}</p>
          <p class="order-time">${formatTime(order.createdAt)}</p>
        </section>
        <mark class="status-badge status-${order.status}">
          ${order.status}
        </mark>
      </header>

      <section class="order-items">
        ${order.items.map(item => `
          <dl class="order-item-row">
            <dt class="order-item-name">${item.name}</dt>
            <dd class="order-item-qty">x${item.qty}</dd>
            <dd class="order-item-price">R${(item.price * item.qty).toFixed(2)}</dd>
          </dl>
        `).join('')}
        <footer class="order-total">
          <span>Total</span>
          <span>R${order.total.toFixed(2)}</span>
        </footer>
      </section>

      <footer class="order-actions">
        ${order.status === 'received' ? `
          <button class="btn-action btn-preparing"
            data-id="${order.id}" data-status="preparing">
            🍳 Start Preparing
          </button>` : ''}
        ${order.status === 'preparing' ? `
          <button class="btn-action btn-ready"
            data-id="${order.id}" data-status="ready">
            ✅ Mark Ready
          </button>` : ''}
        ${order.status === 'ready' ? `
          <p style="color:#3ecf8e;font-size:0.9rem;font-weight:600;">
            ✅ Ready for collection
          </p>` : ''}
      </footer>

    </article>
  `).join('');

  // Attach status button events via delegation
  list.querySelectorAll('.btn-action').forEach(btn => {
    btn.addEventListener('click', () => {
      updateStatus(btn.dataset.id, btn.dataset.status);
    });
  });
}

// UPDATE ORDER STATUS
async function updateStatus(orderId, newStatus) {
  try {
    await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
  } catch (err) {
    alert('Error updating order: ' + err.message);
  }
}

// FORMAT TIME
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp.seconds * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}