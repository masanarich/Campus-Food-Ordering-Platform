// Import auth and db directly from your Firebase config — no need to re-initialize
import { auth, db } from './authentication/config.js';

import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { collection, getDocs }
  from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js"; 



let allItems        = [];
let currentCategory = 'all';

// Wait for Firebase auth state before doing anything.
// Not logged in → redirect to login. Logged in → load the menu.
onAuthStateChanged(auth, (user) => {
  const overlay = document.getElementById('authOverlay');
  if (!user) {
    window.location.href = 'login.html';
  } else {
    overlay.style.display = 'none';
    loadMenu();
    updateCartCount();
  }
});

// LOAD MENU ITEMS FROM FIRESTORE
async function loadMenu() {
  const grid = document.getElementById('menuGrid');
  try {
    const snapshot = await getDocs(collection(db, 'menuItems'));
    allItems = [];
    snapshot.forEach(doc => {
      allItems.push({ id: doc.id, ...doc.data() });
    });
    renderMenu();
  } catch (err) {
    grid.innerHTML = `<p style="color:#e8563a;padding:20px;">Error loading menu: ${err.message}</p>`;
  }
}

// RENDER MENU
function renderMenu() {
  const grid   = document.getElementById('menuGrid');
  const search = document.getElementById('searchInput').value.toLowerCase();

  const filtered = allItems.filter(item => {
    const matchSearch =
      item.name.toLowerCase().includes(search) ||
      (item.description || '').toLowerCase().includes(search);
    const matchCategory =
      currentCategory === 'all' || item.category === currentCategory;
    return matchSearch && matchCategory;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <article class="empty-state">
        <p aria-hidden="true">🔍</p>
        <p>No items found.</p>
      </article>`;
    return;
  }

  grid.innerHTML = filtered.map(item => `
    <article class="menu-card ${!item.available ? 'sold-out' : ''}">
      ${item.photo
        ? `<img class="card-img" src="${item.photo}" alt="${item.name}"
             onerror="this.style.display='none'" />`
        : `<figure class="card-img-placeholder" aria-hidden="true">🍽️</figure>`
      }
      <section class="card-body">
        <p class="card-category">${item.category}</p>
        <h3 class="card-name">${item.name}</h3>
        <p class="card-desc">${item.description || ''}</p>
        <footer class="card-footer">
          <strong class="card-price">R${Number(item.price).toFixed(2)}</strong>
          ${item.available
            ? `<button class="btn-add-cart"
                 data-id="${item.id}"
                 data-name="${item.name}"
                 data-price="${item.price}"
                 data-vendor="${item.vendorId || ''}">
                 + Add
               </button>`
            : `<mark class="sold-out-badge">Sold Out</mark>`
          }
        </footer>
      </section>
    </article>
  `).join('');
}

// Event delegation for Add buttons
document.getElementById('menuGrid').addEventListener('click', e => {
  const btn = e.target.closest('.btn-add-cart');
  if (!btn) return;
  addToCart(
    btn.dataset.id,
    btn.dataset.name,
    parseFloat(btn.dataset.price),
    btn.dataset.vendor
  );
});

// ADD TO CART
function addToCart(id, name, price, vendorId) {
  let cart = JSON.parse(localStorage.getItem('cart') || '[]');
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id, name, price, vendorId, qty: 1 });
  }
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  showToast(`✅ ${name} added to cart!`);
}

// UPDATE CART COUNT IN NAV
function updateCartCount() {
  const cart  = JSON.parse(localStorage.getItem('cart') || '[]');
  const total = cart.reduce((sum, i) => sum + i.qty, 0);
  document.getElementById('cartCount').textContent = total;
}

// SEARCH
document.getElementById('searchInput').addEventListener('input', renderMenu);

// CATEGORY FILTERS
const filterMap = {
  filterAll:      'all',
  filterMeals:    'meals',
  filterSnacks:   'snacks',
  filterDrinks:   'drinks',
  filterDesserts: 'desserts',
};
Object.entries(filterMap).forEach(([btnId, category]) => {
  document.getElementById(btnId).addEventListener('click', function () {
    currentCategory = category;
    document.querySelectorAll('.filter-btn')
      .forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    renderMenu();
  });
});

// TOAST
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}