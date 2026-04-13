import { auth, db } from '../../authentication/config.js';

import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  collection, getDocs, doc, updateDoc, query, where, getDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

let allVendors    = [];
let currentFilter = 'all';


onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '../../authentication/login.html';
    return;
  }


  const userSnap = await getDoc(doc(db, 'users', user.uid));
  if (!userSnap.exists() || userSnap.data().role !== 'admin') {
    alert('Access denied. Admins only.');
    await signOut(auth);
    window.location.href = '../../authentication/login.html';
    return;
  }

  loadVendors();
});


document.getElementById('logoutBtn').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = '../../authentication/login.html';
});


async function loadVendors() {
  const list = document.getElementById('vendorList');
  list.innerHTML = '<p class="empty-state">Loading vendors...</p>';

  try {
    const q        = query(collection(db, 'users'), where('role', '==', 'vendor'));
    const snapshot = await getDocs(q);

    allVendors = [];
    snapshot.forEach(docSnap => {
      allVendors.push({ id: docSnap.id, ...docSnap.data() });
    });

    updateStats();
    renderVendors();

  } catch (err) {
    list.innerHTML = `<p class="empty-state" style="color:#e8563a;">
      Error loading vendors: ${err.message}
    </p>`;
  }
}


function updateStats() {
  document.getElementById('statTotal').textContent =
    allVendors.length;
  document.getElementById('statApproved').textContent =
    allVendors.filter(v => v.status === 'approved').length;
  document.getElementById('statPending').textContent =
    allVendors.filter(v => v.status === 'pending' || !v.status).length;
  document.getElementById('statSuspended').textContent =
    allVendors.filter(v => v.status === 'suspended').length;
}

function renderVendors() {
  const list = document.getElementById('vendorList');

  const filtered = allVendors.filter(vendor => {
    const status = vendor.status || 'pending';
    return currentFilter === 'all' || status === currentFilter;
  });

  if (filtered.length === 0) {
    list.innerHTML = `<p class="empty-state">No ${currentFilter === 'all' ? '' : currentFilter} vendors found.</p>`;
    return;
  }

  list.innerHTML = filtered.map(vendor => {
    const status     = vendor.status || 'pending';
    const joinedDate = vendor.createdAt
      ? new Date(vendor.createdAt.seconds * 1000).toLocaleDateString('en-ZA')
      : 'Unknown';

    return `
      <article class="vendor-card status-${status}" id="vendor-${vendor.id}">
        <section class="vendor-info">
          <p class="vendor-name">${vendor.displayName || vendor.name || 'Unnamed Vendor'}</p>
          <p class="vendor-email">${vendor.email || '—'}</p>
          <p class="vendor-meta">Joined: ${joinedDate}</p>
        </section>

        <mark class="status-badge ${status}">${capitalize(status)}</mark>

        <nav class="vendor-actions">
          ${status !== 'approved'
            ? `<button class="btn-approve" data-id="${vendor.id}">✓ Approve</button>`
            : ''
          }
          ${status !== 'suspended'
            ? `<button class="btn-suspend" data-id="${vendor.id}">✕ Suspend</button>`
            : ''
          }
        </nav>
      </article>`;
  }).join('');

  // Wire up action buttons
  list.querySelectorAll('.btn-approve').forEach(btn => {
    btn.addEventListener('click', () => updateVendorStatus(btn.dataset.id, 'approved'));
  });
  list.querySelectorAll('.btn-suspend').forEach(btn => {
    btn.addEventListener('click', () => updateVendorStatus(btn.dataset.id, 'suspended'));
  });
}


async function updateVendorStatus(vendorId, newStatus) {
  const action = newStatus === 'approved' ? 'approve' : 'suspend';
  if (!confirm(`Are you sure you want to ${action} this vendor?`)) return;

  try {
    await updateDoc(doc(db, 'users', vendorId), { status: newStatus });

    // Update local state so we don't re-fetch
    const vendor = allVendors.find(v => v.id === vendorId);
    if (vendor) vendor.status = newStatus;

    updateStats();
    renderVendors();

    showToast(
      newStatus === 'approved'
        ? '✅ Vendor approved successfully!'
        : '🚫 Vendor suspended successfully!'
    );

  } catch (err) {
    showToast('Error: ' + err.message);
  }
}


document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    currentFilter = this.dataset.filter;
    document.querySelectorAll('.tab-btn')
      .forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    renderVendors();
  });
});


function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}