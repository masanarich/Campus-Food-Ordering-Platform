(() => {
    'use strict';

    /* ─────────────────────────────────────────
       MOCK DATA  –  replace with real API calls
    ───────────────────────────────────────── */
    const STATUSES = ['pending', 'accepted', 'preparing', 'ready', 'complete', 'rejected'];

    const MOCK_ORDERS = [
        {
            id: 'ORD-001',
            customer: 'Thato Cheune',
            time: '08:14',
            status: 'pending',
            notes: 'Please add extra napkins.',
            items: [
                { name: 'Boerewors Roll', qty: 2, price: 35 },
                { name: 'Coke 500 ml',    qty: 2, price: 18 },
            ]
        },
        {
            id: 'ORD-002',
            customer: 'Tshepo Rodgers',
            time: '08:27',
            status: 'accepted',
            notes: '',
            items: [
                { name: 'Cheese Burger', qty: 1, price: 65 },
                { name: 'Slap Chips',    qty: 1, price: 28 },
                { name: 'Water 500 ml',  qty: 1, price: 12 },
            ]
        },
        {
            id: 'ORD-003',
            customer: 'Ledile Mokwena',
            time: '08:35',
            status: 'preparing',
            notes: 'No onions please.',
            items: [
                { name: 'Gatsby (half)', qty: 1, price: 55 },
                { name: 'Oros 300 ml',   qty: 1, price: 15 },
            ]
        },
        {
            id: 'ORD-004',
            customer: 'Rele Mofokeng',
            time: '08:41',
            status: 'ready',
            notes: '',
            items: [
                { name: 'Pap & Wors', qty: 2, price: 45 },
            ]
        },
        {
            id: 'ORD-005',
            customer: 'Olwethu Makhabane',
            time: '08:55',
            status: 'complete',
            notes: '',
            items: [
                { name: 'Vetkoek & Mince', qty: 3, price: 22 },
                { name: 'Juice Box',        qty: 3, price: 10 },
            ]
        },
        {
            id: 'ORD-006',
            customer: 'Faranani Maduwa',
            time: '09:03',
            status: 'pending',
            notes: 'Gluten free bun if available.',
            items: [
                { name: 'Chicken Burger', qty: 1, price: 60 },
                { name: 'Milkshake',      qty: 1, price: 35 },
            ]
        },
    ];

    /* ─────────────────────────────────────────
       STATE
    ───────────────────────────────────────── */
    let orders = MOCK_ORDERS.map(o => ({ ...o }));
    let activeFilter = 'all';
    let selectedOrderId = null;
    const log = [];

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
        return order.items.reduce((s, i) => s + i.qty * i.price, 0);
    }

    function badgeClass(status) {
        return `status-badge badge-${status}`;
    }

    function badgeLabel(status) {
        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    function formatCurrency(val) {
        return `R${val.toFixed(2)}`;
    }

    function now() {
        return new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
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
            const dot = document.createElement('span');
            dot.className = 'log-dot';
            dot.setAttribute('aria-hidden', 'true');
            const time = document.createElement('span');
            time.className = 'log-time';
            time.textContent = entry.time;
            const msg = document.createElement('span');
            msg.className = 'log-msg';
            msg.textContent = entry.msg;
            li.appendChild(dot);
            li.appendChild(time);
            li.appendChild(msg);
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
        art.setAttribute('aria-label', `Order ${order.id} from ${order.customer}`);

        /* card header */
        const hdr = document.createElement('header');
        hdr.className = 'order-card-header';

        const meta = document.createElement('section');
        meta.className = 'order-meta';
        meta.setAttribute('aria-label', 'Order meta');

        const idEl = document.createElement('p');
        idEl.className = 'order-id';
        idEl.textContent = order.id;

        const custEl = document.createElement('p');
        custEl.className = 'order-customer';
        custEl.textContent = order.customer;

        const timeEl = document.createElement('p');
        timeEl.className = 'order-time';
        timeEl.textContent = `Placed at ${order.time}`;

        meta.appendChild(idEl);
        meta.appendChild(custEl);
        meta.appendChild(timeEl);

        const badge = document.createElement('span');
        badge.className = badgeClass(order.status);
        badge.setAttribute('aria-label', `Status: ${badgeLabel(order.status)}`);
        badge.textContent = badgeLabel(order.status);

        hdr.appendChild(meta);
        hdr.appendChild(badge);
        art.appendChild(hdr);

        /* items table */
        const tbl = document.createElement('table');
        tbl.className = 'order-items';
        tbl.setAttribute('aria-label', 'Items in this order');

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['Item', 'Qty', 'Price'].forEach(h => {
            const th = document.createElement('th');
            th.scope = 'col';
            th.textContent = h;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        tbl.appendChild(thead);

        const tbody = document.createElement('tbody');
        order.items.forEach(item => {
            const tr  = document.createElement('tr');
            const tdN = document.createElement('td'); tdN.textContent = item.name;
            const tdQ = document.createElement('td'); tdQ.className = 'item-qty';   tdQ.textContent = `×${item.qty}`;
            const tdP = document.createElement('td'); tdP.className = 'item-price'; tdP.textContent = formatCurrency(item.qty * item.price);
            tr.appendChild(tdN);
            tr.appendChild(tdQ);
            tr.appendChild(tdP);
            tbody.appendChild(tr);
        });
        tbl.appendChild(tbody);
        art.appendChild(tbl);

        /* order total */
        const totRow = document.createElement('section');
        totRow.className = 'order-total-row';
        totRow.setAttribute('aria-label', 'Order total');
        const totLabel = document.createElement('span'); totLabel.textContent = 'Total';
        const totVal   = document.createElement('span'); totVal.textContent = formatCurrency(orderTotal(order));
        totRow.appendChild(totLabel);
        totRow.appendChild(totVal);
        art.appendChild(totRow);

        /* customer notes */
        if (order.notes) {
            const notes = document.createElement('section');
            notes.className = 'order-notes';
            notes.setAttribute('aria-label', 'Customer notes');
            const strong = document.createElement('strong');
            strong.textContent = 'Note: ';
            notes.appendChild(strong);
            notes.appendChild(document.createTextNode(order.notes));
            art.appendChild(notes);
        }

        /* action footer */
        const actions = document.createElement('footer');
        actions.className = 'order-actions';

        if (order.status === 'pending') {
            const acceptBtn = document.createElement('button');
            acceptBtn.className = 'btn-accept';
            acceptBtn.type = 'button';
            acceptBtn.textContent = '✓ Accept';
            acceptBtn.addEventListener('click', () => updateOrderStatus(order.id, 'accepted'));

            const rejectBtn = document.createElement('button');
            rejectBtn.className = 'btn-reject';
            rejectBtn.type = 'button';
            rejectBtn.textContent = '✕ Reject';
            rejectBtn.addEventListener('click', () => updateOrderStatus(order.id, 'rejected'));

            actions.appendChild(acceptBtn);
            actions.appendChild(rejectBtn);

        } else if (!['complete', 'rejected'].includes(order.status)) {
            const label = document.createElement('label');
            label.htmlFor = `status-select-${order.id}`;
            label.textContent = 'Move to:';
            label.style.fontWeight = '700';
            label.style.color = 'var(--text-soft)';
            label.style.fontSize = '.92rem';
            label.style.alignSelf = 'center';

            const sel = document.createElement('select');
            sel.className = 'status-select';
            sel.id = `status-select-${order.id}`;
            sel.setAttribute('aria-label', `Update status for ${order.id}`);

            const nextStatuses = STATUSES.filter(s => s !== order.status && s !== 'pending' && s !== 'rejected');
            nextStatuses.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = badgeLabel(s);
                if (s === order.status) opt.selected = true;
                sel.appendChild(opt);
            });

            const updateBtn = document.createElement('button');
            updateBtn.className = 'btn-primary';
            updateBtn.type = 'button';
            updateBtn.textContent = 'Update';
            updateBtn.addEventListener('click', () => updateOrderStatus(order.id, sel.value));

            actions.appendChild(label);
            actions.appendChild(sel);
            actions.appendChild(updateBtn);
        }

        /* view detail button */
        const detailBtn = document.createElement('button');
        detailBtn.type = 'button';
        detailBtn.textContent = 'View Detail';
        detailBtn.setAttribute('aria-expanded', selectedOrderId === order.id ? 'true' : 'false');
        detailBtn.addEventListener('click', () => selectOrder(order.id));
        actions.appendChild(detailBtn);

        art.appendChild(actions);
        li.appendChild(art);
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
            const empty = document.createElement('section');
            empty.className = 'empty-state';
            const msg = document.createElement('p');
            msg.textContent = activeFilter === 'all'
                ? 'No orders yet. They will appear here when customers place them.'
                : `No orders with status "${badgeLabel(activeFilter)}" right now.`;
            empty.appendChild(msg);
            li.appendChild(empty);
            ordersList.appendChild(li);
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
        heading.textContent = `${order.id} — ${order.customer}`;
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

        const itemsHeading = document.createElement('p');
        itemsHeading.style.cssText = 'font-weight:700; margin-bottom:.4rem;';
        itemsHeading.textContent = 'Items:';
        detailBody.appendChild(itemsHeading);

        const tbl = document.createElement('table');
        tbl.className = 'order-items';
        tbl.setAttribute('aria-label', 'Order items detail');

        const thead = document.createElement('thead');
        const hr = document.createElement('tr');
        ['Item', 'Qty', 'Unit', 'Line'].forEach(h => {
            const th = document.createElement('th');
            th.scope = 'col';
            th.textContent = h;
            hr.appendChild(th);
        });
        thead.appendChild(hr);
        tbl.appendChild(thead);

        const tbody = document.createElement('tbody');
        order.items.forEach(item => {
            const tr  = document.createElement('tr');
            const tdN = document.createElement('td'); tdN.textContent = item.name;
            const tdQ = document.createElement('td'); tdQ.className = 'item-qty';   tdQ.textContent = `×${item.qty}`;
            const tdU = document.createElement('td'); tdU.className = 'item-price'; tdU.textContent = formatCurrency(item.price);
            const tdL = document.createElement('td'); tdL.className = 'item-price'; tdL.textContent = formatCurrency(item.qty * item.price);
            tr.appendChild(tdN); tr.appendChild(tdQ); tr.appendChild(tdU); tr.appendChild(tdL);
            tbody.appendChild(tr);
        });
        tbl.appendChild(tbody);
        detailBody.appendChild(tbl);

        const totRow = document.createElement('section');
        totRow.className = 'order-total-row';
        totRow.setAttribute('aria-label', 'Total');
        const tl = document.createElement('span'); tl.textContent = 'Order Total';
        const tv = document.createElement('span'); tv.textContent = formatCurrency(orderTotal(order));
        totRow.appendChild(tl);
        totRow.appendChild(tv);
        detailBody.appendChild(totRow);

        if (order.notes) {
            const notes = document.createElement('section');
            notes.className = 'order-notes';
            const s = document.createElement('strong');
            s.textContent = 'Customer note: ';
            notes.appendChild(s);
            notes.appendChild(document.createTextNode(order.notes));
            detailBody.appendChild(notes);
        }

        document.getElementById('order-detail-section')
            .scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /* ─────────────────────────────────────────
       UPDATE STATUS
    ───────────────────────────────────────── */
    function updateOrderStatus(id, newStatus) {
        const order = orders.find(o => o.id === id);
        if (!order) return;

        const oldStatus = order.status;
        order.status = newStatus;

        addLog(`${order.id} (${order.customer}): ${badgeLabel(oldStatus)} → ${badgeLabel(newStatus)}`);

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

        renderOrders();
        if (selectedOrderId === id) selectOrder(id);
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
    renderOrders();
    setStatus('Dashboard loaded. Showing all orders.', 'info');
    addLog('Vendor dashboard opened.');

    /* Simulate a new incoming order after 8 seconds */
    setTimeout(() => {
        const newOrder = {
            id: 'ORD-007',
            customer: 'Nandi Mthembu',
            time: now(),
            status: 'pending',
            notes: 'Extra chilli sauce please!',
            items: [
                { name: 'Toasted Sarmie', qty: 2, price: 30 },
                { name: 'Rooibos Tea',    qty: 1, price: 18 },
            ]
        };
        orders.unshift(newOrder);
        setStatus(`🔔 New order from ${newOrder.customer}!`, 'info');
        addLog(`New order received: ${newOrder.id} from ${newOrder.customer}`);
        renderOrders();
    }, 8000);

})();