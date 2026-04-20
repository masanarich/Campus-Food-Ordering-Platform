(() => {
    'use strict';

    /* ─────────────────────────────────────────
       FIREBASE CONFIG  –  replace with yours
    ───────────────────────────────────────── */
const firebaseConfig = {
  apiKey: "AIzaSyCoKYtzrL8ib4VDfd0Wr0cMjVPfgUkPtVA",
  authDomain: "campus-food-ordering-platform.firebaseapp.com",
  projectId: "campus-food-ordering-platform",
  storageBucket: "campus-food-ordering-platform.firebasestorage.app",
  messagingSenderId: "808109232496",
  appId: "1:808109232496:web:0c1bcd968c1493e3bbffb5",
  measurementId: "G-8696Y3GMFE"
};

    /* ─────────────────────────────────────────
       FIREBASE INIT
    ───────────────────────────────────────── */
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.firestore();

    const STATUSES = ['pending', 'accepted', 'preparing', 'ready', 'complete', 'rejected'];

    /* ─────────────────────────────────────────
       STATE
    ───────────────────────────────────────── */
    let orders         = [];
    let activeFilter   = 'all';
    let selectedOrderId = null;
    const log          = [];

    /* ─────────────────────────────────────────
       DOM REFS
    ───────────────────────────────────────── */
    const ordersList        = document.getElementById('orders-list');
    const statusBanner      = document.getElementById('vendor-home-status');
    const detailPlaceholder = document.getElementById('detail-placeholder');
    const detailBody        = document.getElementById('order-detail-body');
    const activityList      = document.getElementById('activity-log-list');
    const filterBtns        = document.querySelectorAll('.filter-btn');

    /* ─────────────────────────────────────────
       HELPERS
    ───────────────────────────────────────── */
    function orderTotal(order) {
        if (typeof order.totalAmount === 'number') return order.totalAmount;
        if (!Array.isArray(order.items)) return 0;
        return order.items.reduce((s, i) => s + (i.Quantity || i.qty || 0) * (i.price || 0), 0);
    }

    function badgeClass(status) {
        return `status-badge badge-${status}`;
    }

    function badgeLabel(status) {
        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    function formatCurrency(val) {
        const n = typeof val === 'number' ? val : parseFloat(val);
        return isFinite(n) ? `R${n.toFixed(2)}` : 'R0.00';
    }

    function now() {
        return new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
    }

    function formatTimestamp(ts) {
        if (!ts) return '—';
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
    }

    function addLog(msg) {
        log.unshift({ time: now(), msg });
        renderLog();
    }

    function setStatus(msg, state = 'info') {
        statusBanner.textContent = msg;
        statusBanner.dataset.state = state;
    }

    /* ─────────────────────────────────────────
       FIRESTORE — LIVE LISTENER
       Listens to all orders for this vendor
       in real time. Update vendorID filter to
       match the logged-in vendor.
    ───────────────────────────────────────── */
function listenToOrders() {
    setStatus('Loading orders...', 'loading');

    db.collection('orders')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            console.log("Docs:", snapshot.docs.length);
            console.log("Docs:", snapshot.docs.length);   // 👈 ADD THIS
            console.log("Raw snapshot:", snapshot.docs);  // 👈 AND THIS

            orders = snapshot.docs.map(doc => {
                const data = doc.data();

                return {
                    id: doc.id,
                    status: (data.status || 'pending').trim(),
                    totalAmount: data.totalAmount || 0,
                    vendorID: data.vendorID || '',
                    time: formatTimestamp(data.createdAt),
                    items: Array.isArray(data.items) ? data.items : []
                };
            });

            renderOrders();
            setStatus('Orders loaded.', 'info');
            addLog('Orders refreshed from database.');
        }, error => {
            console.error('Firestore error:', error);
            setStatus('Failed to load orders.', 'error');
        });
}
    /* ─────────────────────────────────────────
       FIRESTORE — UPDATE STATUS
    ───────────────────────────────────────── */
    async function updateOrderStatus(id, newStatus) {
        const order = orders.find(o => o.id === id);
        if (!order) return;

        const oldStatus = order.status;

        try {
            await db.collection('orders').doc(id).update({ status: newStatus });

            addLog(`${id}: ${badgeLabel(oldStatus)} → ${badgeLabel(newStatus)}`);

            const msgs = {
                accepted:  `Order ${id} accepted! Start preparing when ready.`,
                rejected:  `Order ${id} rejected.`,
                preparing: `Order ${id} is now being prepared.`,
                ready:     `Order ${id} is ready for pickup!`,
                complete:  `Order ${id} marked as complete.`,
            };

            setStatus(
                msgs[newStatus] || `Order ${id} updated.`,
                newStatus === 'rejected' ? 'error' : 'success'
            );

        } catch (err) {
            console.error('Failed to update order:', err);
            setStatus(`Failed to update order ${id}. Try again.`, 'error');
        }
    }

    /* ─────────────────────────────────────────
       STATS
    ───────────────────────────────────────── */
    function renderStats() {
        document.getElementById('stat-pending').textContent =
            orders.filter(o => o.status === 'pending').length;
        document.getElementById('stat-active').textContent =
            orders.filter(o => ['accepted', 'preparing', 'ready'].includes(o.status)).length;
        document.getElementById('stat-complete').textContent =
            orders.filter(o => o.status === 'complete').length;

        const revenue = orders
            .filter(o => o.status === 'complete')
            .reduce((s, o) => s + orderTotal(o), 0);
        document.getElementById('stat-revenue').textContent = `R${revenue.toFixed(0)}`;
    }

    /* ─────────────────────────────────────────
       ACTIVITY LOG
    ───────────────────────────────────────── */
    function renderLog() {
        activityList.innerHTML = '';
        if (log.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No activity yet.';
            li.style.color = 'var(--text-soft)';
            li.style.fontSize = '.92rem';
            activityList.appendChild(li);
            return;
        }
        log.slice(0, 12).forEach(entry => {
            const li  = document.createElement('li');
            const dot = document.createElement('span'); dot.className = 'log-dot'; dot.setAttribute('aria-hidden', 'true');
            const time = document.createElement('span'); time.className = 'log-time'; time.textContent = entry.time;
            const msg  = document.createElement('span'); msg.className  = 'log-msg';  msg.textContent  = entry.msg;
            li.appendChild(dot); li.appendChild(time); li.appendChild(msg);
            activityList.appendChild(li);
        });
    }

    /* ─────────────────────────────────────────
       ORDER CARD
    ───────────────────────────────────────── */
    function buildOrderCard(order) {
        const li  = document.createElement('li');
        const art = document.createElement('article');
        art.className = 'order-card';
        art.setAttribute('aria-label', `Order ${order.id}`);

        /* card header */
        const hdr  = document.createElement('header');  hdr.className  = 'order-card-header';
        const meta = document.createElement('section'); meta.className = 'order-meta'; meta.setAttribute('aria-label', 'Order meta');

        const idEl   = document.createElement('p'); idEl.className   = 'order-id';    idEl.textContent   = order.id;
        const timeEl = document.createElement('p'); timeEl.className = 'order-time';   timeEl.textContent = `Placed at ${order.time}`;
        const venEl  = document.createElement('p'); venEl.className  = 'order-time';   venEl.textContent  = `Vendor: ${order.vendorID}`;

        meta.appendChild(idEl);
        meta.appendChild(timeEl);
        meta.appendChild(venEl);

        const badge = document.createElement('span');
        badge.className = badgeClass(order.status);
        badge.setAttribute('aria-label', `Status: ${badgeLabel(order.status)}`);
        badge.textContent = badgeLabel(order.status);

        hdr.appendChild(meta); hdr.appendChild(badge);
        art.appendChild(hdr);

        /* items table */
        const tbl   = document.createElement('table'); tbl.className = 'order-items'; tbl.setAttribute('aria-label', 'Items in this order');
        const thead = document.createElement('thead');
        const hrow  = document.createElement('tr');
        ['Item', 'Qty', 'Price'].forEach(h => {
            const th = document.createElement('th'); th.scope = 'col'; th.textContent = h; hrow.appendChild(th);
        });
        thead.appendChild(hrow); tbl.appendChild(thead);

        const tbody = document.createElement('tbody');
        order.items.forEach(item => {
            const qty   = item.Quantity || item.qty || 0;
            const price = item.price || 0;
            const name  = item.name  || item.itemID || '—';

            const tr  = document.createElement('tr');
            const tdN = document.createElement('td'); tdN.textContent = name;
            const tdQ = document.createElement('td'); tdQ.className = 'item-qty';   tdQ.textContent = `×${qty}`;
            const tdP = document.createElement('td'); tdP.className = 'item-price'; tdP.textContent = formatCurrency(qty * price);
            tr.appendChild(tdN); tr.appendChild(tdQ); tr.appendChild(tdP);
            tbody.appendChild(tr);
        });
        tbl.appendChild(tbody); art.appendChild(tbl);

        /* order total */
        const totRow   = document.createElement('section'); totRow.className = 'order-total-row'; totRow.setAttribute('aria-label', 'Order total');
        const totLabel = document.createElement('span'); totLabel.textContent = 'Total';
        const totVal   = document.createElement('span'); totVal.textContent   = formatCurrency(orderTotal(order));
        totRow.appendChild(totLabel); totRow.appendChild(totVal);
        art.appendChild(totRow);

        /* actions */
        const actions = document.createElement('footer'); actions.className = 'order-actions';

        if (order.status === 'pending') {
            const acceptBtn = document.createElement('button');
            acceptBtn.className = 'btn-accept'; acceptBtn.type = 'button'; acceptBtn.textContent = '✓ Accept';
            acceptBtn.addEventListener('click', () => updateOrderStatus(order.id, 'accepted'));

            const rejectBtn = document.createElement('button');
            rejectBtn.className = 'btn-reject'; rejectBtn.type = 'button'; rejectBtn.textContent = '✕ Reject';
            rejectBtn.addEventListener('click', () => updateOrderStatus(order.id, 'rejected'));

            actions.appendChild(acceptBtn); actions.appendChild(rejectBtn);

        } else if (!['complete', 'rejected'].includes(order.status)) {
            const label = document.createElement('label');
            label.htmlFor = `status-select-${order.id}`;
            label.textContent = 'Move to:';
            label.style.cssText = 'font-weight:700; color:var(--text-soft); font-size:.92rem; align-self:center;';

            const sel = document.createElement('select');
            sel.className = 'status-select';
            sel.id = `status-select-${order.id}`;
            sel.setAttribute('aria-label', `Update status for ${order.id}`);

            STATUSES.filter(s => s !== order.status && s !== 'pending' && s !== 'rejected').forEach(s => {
                const opt = document.createElement('option'); opt.value = s; opt.textContent = badgeLabel(s);
                sel.appendChild(opt);
            });

            const updateBtn = document.createElement('button');
            updateBtn.className = 'btn-primary'; updateBtn.type = 'button'; updateBtn.textContent = 'Update';
            updateBtn.addEventListener('click', () => updateOrderStatus(order.id, sel.value));

            actions.appendChild(label); actions.appendChild(sel); actions.appendChild(updateBtn);
        }

        const detailBtn = document.createElement('button');
        detailBtn.type = 'button'; detailBtn.textContent = 'View Detail';
        detailBtn.addEventListener('click', () => selectOrder(order.id));
        actions.appendChild(detailBtn);

        art.appendChild(actions); li.appendChild(art);
        return li;
    }

    /* ─────────────────────────────────────────
       RENDER ORDERS LIST
    ───────────────────────────────────────── */
    function renderOrders() {
        ordersList.innerHTML = '';
        const filtered = activeFilter === 'all'
            ? orders
            : orders.filter(o => o.status === activeFilter);

        if (filtered.length === 0) {
            const li    = document.createElement('li');
            const empty = document.createElement('section'); empty.className = 'empty-state';
            const msg   = document.createElement('p');
            msg.textContent = activeFilter === 'all'
                ? 'No orders yet. They will appear here when customers place them.'
                : `No orders with status "${badgeLabel(activeFilter)}" right now.`;
            empty.appendChild(msg); li.appendChild(empty); ordersList.appendChild(li);
        } else {
            filtered.forEach(order => ordersList.appendChild(buildOrderCard(order)));
        }
        renderStats();
    }

    /* ─────────────────────────────────────────
       ORDER DETAIL PANEL
    ───────────────────────────────────────── */
    function selectOrder(id) {
        selectedOrderId = id;
        const order = orders.find(o => o.id === id);
        if (!order) return;

        detailPlaceholder.hidden = true;
        detailBody.hidden = false;
        detailBody.innerHTML = '';

        const heading = document.createElement('h4');
        heading.style.cssText = 'margin-top:0; margin-bottom:.5rem; font-size:1.1rem;';
        heading.textContent = `Order: ${order.id}`;
        detailBody.appendChild(heading);

        const badge = document.createElement('span');
        badge.className = badgeClass(order.status);
        badge.style.cssText = 'margin-bottom:1rem; display:inline-flex;';
        badge.textContent = badgeLabel(order.status);
        detailBody.appendChild(badge);

        const timeP = document.createElement('p');
        timeP.style.cssText = 'color:var(--text-soft); font-size:.92rem; margin-top:.7rem;';
        timeP.textContent = `Placed at ${order.time}`;
        detailBody.appendChild(timeP);

        const iHead = document.createElement('p'); iHead.style.cssText = 'font-weight:700; margin-bottom:.4rem;'; iHead.textContent = 'Items:';
        detailBody.appendChild(iHead);

        const tbl   = document.createElement('table'); tbl.className = 'order-items'; tbl.setAttribute('aria-label', 'Order items detail');
        const thead = document.createElement('thead');
        const hr    = document.createElement('tr');
        ['Item', 'Qty', 'Unit', 'Line'].forEach(h => {
            const th = document.createElement('th'); th.scope = 'col'; th.textContent = h; hr.appendChild(th);
        });
        thead.appendChild(hr); tbl.appendChild(thead);

        const tbody = document.createElement('tbody');
        order.items.forEach(item => {
            const qty   = item.Quantity || item.qty || 0;
            const price = item.price || 0;
            const name  = item.name  || item.itemID || '—';

            const tr  = document.createElement('tr');
            const tdN = document.createElement('td'); tdN.textContent = name;
            const tdQ = document.createElement('td'); tdQ.className = 'item-qty';   tdQ.textContent = `×${qty}`;
            const tdU = document.createElement('td'); tdU.className = 'item-price'; tdU.textContent = formatCurrency(price);
            const tdL = document.createElement('td'); tdL.className = 'item-price'; tdL.textContent = formatCurrency(qty * price);
            tr.appendChild(tdN); tr.appendChild(tdQ); tr.appendChild(tdU); tr.appendChild(tdL);
            tbody.appendChild(tr);
        });
        tbl.appendChild(tbody); detailBody.appendChild(tbl);

        const totRow = document.createElement('section'); totRow.className = 'order-total-row'; totRow.setAttribute('aria-label', 'Total');
        const tl = document.createElement('span'); tl.textContent = 'Order Total';
        const tv = document.createElement('span'); tv.textContent = formatCurrency(orderTotal(order));
        totRow.appendChild(tl); totRow.appendChild(tv);
        detailBody.appendChild(totRow);

        document.getElementById('order-detail-section').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /* ─────────────────────────────────────────
       FILTERS
    ───────────────────────────────────────── */
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            activeFilter = btn.dataset.filter;
            filterBtns.forEach(b => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
            renderOrders();
        });
    });

    /* ─────────────────────────────────────────
       INIT
    ───────────────────────────────────────── */
    renderLog();
    addLog('Vendor dashboard opened.');
    listenToOrders();

})();