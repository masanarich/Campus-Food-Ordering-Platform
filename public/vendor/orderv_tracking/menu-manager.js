import { auth, db, storage } from '../../authentication/config.js';

import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
  collection, addDoc, getDocs, updateDoc,
  deleteDoc, doc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

let currentVendorId = null;

// AUTH — load menu if logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentVendorId = user.uid;
    loadMenuItems();
  }
});

// LOGOUT
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = '../../authentication/login.html';
});

// ADD MENU ITEM
document.getElementById('addItemBtn').addEventListener('click', addMenuItem);

async function addMenuItem() {
  const name        = document.getElementById('itemName').value.trim();
  const price       = document.getElementById('itemPrice').value.trim();
  const category    = document.getElementById('itemCategory').value;
  const photoFile   = document.getElementById('itemPhoto').files[0]; // ← real file now
  const desc        = document.getElementById('itemDesc').value.trim();
  const successMsg  = document.getElementById('successMsg');
  const errorMsg    = document.getElementById('errorMsg');
  const addBtn      = document.getElementById('addItemBtn');
  const progressBar = document.getElementById('uploadProgress'); // optional progress bar

  successMsg.style.display = 'none';
  errorMsg.style.display   = 'none';

  if (!name || !price || !desc) {
    errorMsg.textContent   = 'Please fill in name, price and description.';
    errorMsg.style.display = 'block';
    return;
  }

  // Validate price is a number
  if (isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
    errorMsg.textContent   = 'Please enter a valid price.';
    errorMsg.style.display = 'block';
    return;
  }

  addBtn.disabled    = true;
  addBtn.textContent = 'Saving...';

  try {
    let photoURL = '';

    // ── UPLOAD PHOTO TO FIREBASE STORAGE ──────────────────────────────
    if (photoFile) {
      // Validate file type
      if (!photoFile.type.startsWith('image/')) {
        errorMsg.textContent   = 'Please select a valid image file.';
        errorMsg.style.display = 'block';
        addBtn.disabled        = false;
        addBtn.textContent     = 'Add Item';
        return;
      }

      // Validate file size (max 5MB)
      if (photoFile.size > 5 * 1024 * 1024) {
        errorMsg.textContent   = 'Image must be smaller than 5MB.';
        errorMsg.style.display = 'block';
        addBtn.disabled        = false;
        addBtn.textContent     = 'Add Item';
        return;
      }

      // Unique path per vendor + timestamp to avoid collisions
      const filePath    = `menuItems/${currentVendorId}/${Date.now()}_${photoFile.name}`;
      const storageRef  = ref(storage, filePath);
      const uploadTask  = uploadBytesResumable(storageRef, photoFile);

      // Show upload progress if element exists
      photoURL = await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const pct = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );
            if (progressBar) {
              progressBar.style.display = 'block';
              progressBar.value         = pct;
            }
            addBtn.textContent = `Uploading... ${pct}%`;
          },
          (err) => reject(err),
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          }
        );
      });

      if (progressBar) progressBar.style.display = 'none';
    }
    // ──────────────────────────────────────────────────────────────────

    // SAVE ITEM TO FIRESTORE (with real photo URL)
    await addDoc(collection(db, 'menuItems'), {
      vendorId:    currentVendorId,
      name,
      price:       parseFloat(price),
      category,
      photo:       photoURL,   // ← now a real Firebase Storage URL
      description: desc,
      available:   true,
      createdAt:   serverTimestamp()
    });

    // Reset form
    document.getElementById('itemName').value  = '';
    document.getElementById('itemPrice').value = '';
    document.getElementById('itemPhoto').value = '';
    document.getElementById('itemDesc').value  = '';

    successMsg.textContent   = '✅ Item added successfully!';
    successMsg.style.display = 'block';
    setTimeout(() => successMsg.style.display = 'none', 3000);

    loadMenuItems();

  } catch (err) {
    errorMsg.textContent   = 'Error: ' + err.message;
    errorMsg.style.display = 'block';
  } finally {
    addBtn.disabled    = false;
    addBtn.textContent = 'Add Item';
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
            ? `<img class="item-img" src="${item.photo}" alt="${item.name}"
                 onerror="this.src=''; this.style.display='none'" />`
            : `<figure class="item-img-placeholder">🍽️</figure>`
          }
          <section class="item-body">
            <p class="item-name">
              ${item.name}
              ${!item.available ? '<span class="sold-badge">SOLD OUT</span>' : ''}
            </p>
            <p class="item-desc">${item.description}</p>
            <footer class="item-footer">
              <strong class="item-price">R${Number(item.price).toFixed(2)}</strong>
              <span class="item-actions">
                <button class="btn-soldout ${!item.available ? 'sold' : ''}"
                  data-id="${id}" data-available="${item.available}">
                  ${item.available ? 'Mark Sold Out' : 'Mark Available'}
                </button>
                <button class="btn-delete" data-id="${id}" data-photo="${item.photo || ''}">
                  Delete
                </button>
              </span>
            </footer>
          </section>
        </article>`;
    });

    grid.querySelectorAll('.btn-soldout').forEach(btn => {
      btn.addEventListener('click', () =>
        toggleAvailability(btn.dataset.id, btn.dataset.available === 'true')
      );
    });

    grid.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () =>
        deleteItem(btn.dataset.id, btn.dataset.photo)
      );
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

// DELETE ITEM — also removes photo from Storage
async function deleteItem(id, photoURL) {
  if (!confirm('Are you sure you want to delete this item?')) return;
  try {
    // Delete from Firestore
    await deleteDoc(doc(db, 'menuItems', id));

    // Also delete the image from Firebase Storage if it exists
    if (photoURL) {
      try {
        const photoRef = ref(storage, photoURL);
        await deleteObject(photoRef);
      } catch (storageErr) {
        // Don't block deletion if storage cleanup fails
        console.warn('Could not delete image from storage:', storageErr.message);
      }
    }

    loadMenuItems();
  } catch (err) {
    alert('Error deleting item: ' + err.message);
  }
}