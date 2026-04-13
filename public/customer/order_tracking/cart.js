import { db } from '../../authentication/config.js';
import { collection, addDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // RENDER CART
  function renderCart() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const list = document.getElementById('cartItemsList');
    const summaryRows = document.getElementById('summaryRows');
    const totalEl = document.getElementById('totalAmount');
    const btn = document.getElementById('placeOrderBtn');

    if (cart.length === 0) {
      list.innerHTML = `
        <div class="empty-cart">
          <div>🛒</div>
          <p>Your cart is empty.</p>
          <a href="browse-menu.html">Browse Menu →</a>
        </div>`;
      document.getElementById('summaryCard').style.display = 'none';
      btn.disabled = true;
      return;
    }

    document.getElementById('summaryCard').style.display = 'block';
    btn.disabled = false;

    let total = 0;

    list.innerHTML = cart.map((item, index) => {
      const itemTotal = item.price * item.qty;
      total += itemTotal;
      return `
        <div class="cart-item">
          <div class="item-info">
            <div class="name">${item.name}</div>
            <div class="unit-price">R${item.price.toFixed(2)} each</div>
          </div>
          <div class="qty-controls">
            <button class="qty-btn" onclick="changeQty(${index}, -1)">−</button>
            <span class="qty-num">${item.qty}</span>
            <button class="qty-btn" onclick="changeQty(${index}, 1)">+</button>
          </div>
          <div class="item-total">R${itemTotal.toFixed(2)}</div>
          <button class="btn-remove" onclick="removeItem(${index})">🗑</button>
        </div>`;
    }).join('');

    summaryRows.innerHTML = cart.map(item => `
      <div class="summary-row">
        <span>${item.name} x${item.qty}</span>
        <span>R${(item.price * item.qty).toFixed(2)}</span>
      </div>`).join('');

    totalEl.textContent = `R${total.toFixed(2)}`;
  }

  // CHANGE QUANTITY
  window.changeQty = function (index, delta) {
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart[index].qty += delta;
    if (cart[index].qty <= 0) cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart();
  }

  // REMOVE ITEM
  window.removeItem = function (index) {
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart();
  }

  // PLACE ORDER
  window.placeOrder = async function () {
    const studentName = document.getElementById('studentName').value.trim();
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const successMsg = document.getElementById('successMsg');
    const errorMsg = document.getElementById('errorMsg');
    const btn = document.getElementById('placeOrderBtn');

    successMsg.style.display = 'none';
    errorMsg.style.display = 'none';

    if (!studentName) {
      errorMsg.textContent = '❌ Please enter your name before placing the order.';
      errorMsg.style.display = 'block';
      return;
    }

    if (cart.length === 0) {
      errorMsg.textContent = '❌ Your cart is empty.';
      errorMsg.style.display = 'block';
      return;
    }

    const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const vendorId = cart[0].vendorId;

    btn.disabled = true;
    btn.textContent = 'Placing Order...';

    try {
      const orderRef = await addDoc(collection(db, 'orders'), {
        studentName,
        vendorId,
        items: cart.map(i => ({
          name: i.name,
          price: i.price,
          qty: i.qty
        })),
        total,
        status: 'received',
        createdAt: serverTimestamp()
      });

      // Clear cart
      localStorage.removeItem('cart');

      // Save order ID for tracking
      localStorage.setItem('lastOrderId', orderRef.id);

      successMsg.textContent = '✅ Order placed! Redirecting to tracking...';
      successMsg.style.display = 'block';

      setTimeout(() => {
        window.location.href = 'track-order.html';
      }, 2000);

    } catch (err) {
      errorMsg.textContent = '❌ Error placing order: ' + err.message;
      errorMsg.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Place Order 🚀';
    }
  }

  renderCart();
