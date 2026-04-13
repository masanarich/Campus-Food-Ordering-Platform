import { auth, db } from '../../authentication/config.js';

import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  collection, addDoc, getDocs, updateDoc,
  deleteDoc, doc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

let currentVendorId = null;

// AUTH — load menu if logged in, do nothing if not
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentVendorId = user.uid;
    loadMenuItems();
  }
});

// LOGOUT — only redirects when user clicks the button
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = '../../authentication/login.html';
});

// ADD MENU ITEM
document.getElementById('addItemBtn').addEventListener('click', addMenuItem);

async function addMenuItem() {
  const name       = document.getElementById('itemName').value.trim();
  const price      = document.getElementById('itemPrice').value.trim();
  const category   = document.getElementById('itemCategory').value;
  const photo      = document.getElementById('itemPhoto').value.trim();
  const desc       = document.getElementById('itemDesc').value.trim();
  const successMsg = document.getElementById('successMsg');
  const errorMsg   = document.getElementById('errorMsg');

  successMsg.style.display = 'none';
  errorMsg.style.display   = 'none';

  if (!name || !price || !desc) {
    errorMsg.textContent   = 'Please fill in name, price and description.';
    errorMsg.style.display = 'block';
    return;
  }

  try {
    await addDoc(collection(db, 'menuItems'), {
      vendorId:    currentVendorId,
      name,
      price:       parseFloat(price),
      category,
      photo:       photo || '',
      description: desc,
      available:   true,
      createdAt:   serverTimestamp()
    });

    document.getElementById('itemName').value  = '';
    document.getElementById('itemPrice').value = '';
    document.getElementById('itemPhoto').value = '';
    document.getElementById('itemDesc').value  = '';

    successMsg.textContent   = 'Item added successfully!';
    successMsg.style.display = 'block';
    setTimeout(() => successMsg.style.display = 'none', 3000);

    loadMenuItems();

  } catch (err) {
    errorMsg.textContent   = 'Error: ' + err.message;
    errorMsg.style.display = 'block';
  }
}

// LOAD MENU ITEMS
async function loadMenuItems() {
  const grid = document.getElementById('menuGrid');
  grid.innerHTML = '<p style="color:#7e8494;padding:20px;">Loading...</p>';

  try {
    const q = query(
      collection(db, 'menuItems'),
      where('vendorId', '==', currentVendorId)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      grid.innerHTML = '<p class="empty-state">No items yet. Add your first menu item above!</p>';
      return;
    }

    grid.innerHTML = '';
    snapshot.forEach((docSnap) => {
      const item = docSnap.data();
      const id   = docSnap.id;
      grid.innerHTML += `
        <article class="menu-item-card" id="card-${id}">
          ${item.photo
            ? `<img class="item-img" src="${item.photo}" alt="${item.name}" onerror="this.style.display='none'" />`
            : `<figure class="item-img-placeholder">🍽️</figure>`
          }
          <section class="item-body">
            <p class="item-name">
              ${item.name}
              ${!item.available ? '<span class="sold-badge">SOLD OUT</span>' : ''}
            </p>
            <p class="item-desc">${item.description}</p>
            <footer class="item-footer">
              <strong class="item-price">R${item.price.toFixed(2)}</strong>
              <span class="item-actions">
                <button class="btn-soldout ${!item.available ? 'sold' : ''}"
                  data-id="${id}" data-available="${item.available}">
                  ${item.available ? 'Mark Sold Out' : 'Mark Available'}
                </button>
                <button class="btn-delete" data-id="${id}">Delete</button>
              </span>
            </footer>
          </section>
        </article>`;
    });

    grid.querySelectorAll('.btn-soldout').forEach(btn => {
      btn.addEventListener('click', () => {
        toggleAvailability(btn.dataset.id, btn.dataset.available === 'true');
      });
    });
    grid.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteItem(btn.dataset.id));
    });

  } catch (err) {
    grid.innerHTML = `<p style="color:#e8563a;padding:20px;">Error loading items: ${err.message}</p>`;
  }
}

// TOGGLE AVAILABLE / SOLD OUT
async function toggleAvailability(id, currentStatus) {
  try {
    await updateDoc(doc(db, 'menuItems', id), { available: !currentStatus });
    loadMenuItems();
  } catch (err) {
    alert('Error updating item: ' + err.message);
  }
}

// DELETE ITEM
async function deleteItem(id) {
  if (!confirm('Are you sure you want to delete this item?')) return;
  try {
    await deleteDoc(doc(db, 'menuItems', id));
    loadMenuItems();
  } catch (err) {
    alert('Error deleting item: ' + err.message);
  }
}