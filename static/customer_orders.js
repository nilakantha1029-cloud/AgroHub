// ── STATE ──────────────────────────────────────────────────────
let allOrders      = [];
let filteredOrders = [];
let currentStatus  = 'all';
let currentPage    = 1;
const PER_PAGE     = 8;

// Order timeline steps
const STEPS     = ['pending','accepted','ready_to_ship','shipped','delivered'];
const STEP_ICONS = ['📝','✅','📦','🚚','🎉'];
const STEP_LABELS= ['Placed','Accepted','Packed','Shipped','Delivered'];

const STATUS_LABELS = {
  pending:'Pending',accepted:'Accepted',rejected:'Rejected',
  ready_to_ship:'Ready to Ship',shipped:'Shipped',delivered:'Delivered'
};

const catEmoji = {
  vegetables:'🥦',fruits:'🥭',grains:'🌾',pulses:'🫘',spices:'🌶️',
  organic:'🍃',dairy:'🫙',dry_fruits:'🥜',oilseeds:'🌻',herbs:'🌿',default:'🌾'
};

// ── INIT ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadUser();
  await loadAllOrders();
});

// ── USER ──────────────────────────────────────────────────────
async function loadUser() {
  try {
    const res = await fetch('/api/user', {credentials:'include'});
    if (!res.ok) { window.location.href = '/login'; return; }
    const user = await res.json();
    document.getElementById('navName').textContent = user.name.split(' ')[0];
    const av = document.getElementById('navAvatar');
    if (user.profile_img) {
      av.innerHTML = `<img src="${user.profile_img}" alt="avatar">`;
    } else {
      av.textContent = user.name.split(' ').map(n=>n[0]).join('').toUpperCase();
    }
  } catch(e) { window.location.href = '/login'; }
}

// ── LOAD ALL ORDERS ───────────────────────────────────────────
async function loadAllOrders() {
  try {
    const res    = await fetch('/api/orders/customer', {credentials:'include'});
    if (!res.ok) throw new Error('Unauthorized');
    allOrders    = await res.json();
    buildStats(allOrders);
    applyFilters();
    document.getElementById('summaryRow').style.display = 'flex';
  } catch(e) {
    document.getElementById('ordersContainer').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Could not load orders</div>
        <div class="empty-sub">Please check your connection and try again.</div>
        <button class="shop-btn" onclick="loadAllOrders()">🔄 Retry</button>
      </div>`;
  }
}

// ── STATS ─────────────────────────────────────────────────────
function buildStats(orders) {
  const delivered = orders.filter(o => o.status === 'delivered');
  const spent     = orders.filter(o => o.status !== 'rejected').reduce((s,o) => s + parseFloat(o.total_price||0), 0);
  document.getElementById('statTotal').textContent     = orders.length;
  document.getElementById('statDelivered').textContent = delivered.length;
  document.getElementById('statSpent').textContent     = '₹' + formatNum(spent);

  const counts = {pending:0,accepted:0,shipped:0,delivered:0,rejected:0};
  orders.forEach(o => {
    if (o.status === 'ready_to_ship') counts.shipped++;
    else if (counts[o.status] !== undefined) counts[o.status]++;
    else if (o.status === 'shipped') counts.shipped++;
  });
  // fix: shipped + ready_to_ship both go to shipped counter
  const shippedCount = orders.filter(o => o.status === 'shipped' || o.status === 'ready_to_ship').length;

  document.getElementById('sumPending').textContent   = counts.pending;
  document.getElementById('sumAccepted').textContent  = counts.accepted;
  document.getElementById('sumShipped').textContent   = shippedCount;
  document.getElementById('sumDelivered').textContent = counts.delivered;
  document.getElementById('sumRejected').textContent  = counts.rejected;
}

// ── FILTERS ───────────────────────────────────────────────────
function setStatusFilter(btn) {
  document.querySelectorAll('.sf').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentStatus = btn.dataset.status;
  currentPage   = 1;
  applyFilters();
}

function applyFilters() {
  const q      = document.getElementById('searchInput').value.toLowerCase().trim();
  const sort   = document.getElementById('sortSelect').value;

  let data = [...allOrders];

  // Status filter
  if (currentStatus !== 'all') {
    data = data.filter(o => o.status === currentStatus);
  }

  // Search filter
  if (q) {
    data = data.filter(o =>
      o.produce.toLowerCase().includes(q) ||
      `${o.farmer_first} ${o.farmer_last}`.toLowerCase().includes(q) ||
      String(o.id).includes(q) ||
      (o.delivery_address||'').toLowerCase().includes(q)
    );
  }

  // Sort
  if (sort === 'newest')     data.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  if (sort === 'oldest')     data.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
  if (sort === 'price_high') data.sort((a,b) => parseFloat(b.total_price) - parseFloat(a.total_price));
  if (sort === 'price_low')  data.sort((a,b) => parseFloat(a.total_price) - parseFloat(b.total_price));

  filteredOrders = data;
  currentPage    = 1;
  renderOrders();
  renderPagination();
}

// ── RENDER ORDERS ─────────────────────────────────────────────
function renderOrders() {
  const container = document.getElementById('ordersContainer');
  document.getElementById('loadingShimmer')?.remove();

  if (!filteredOrders.length) {
    const isFiltered = currentStatus !== 'all' || document.getElementById('searchInput').value.trim();
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${isFiltered ? '🔍' : '📦'}</div>
        <div class="empty-title">${isFiltered ? 'No orders found' : 'No orders yet'}</div>
        <div class="empty-sub">${isFiltered ? 'Try a different search or filter.' : "You haven't placed any orders yet. Start shopping from verified farmers!"}</div>
        <a href="/dashboard/customer" class="shop-btn">🛒 Shop Now</a>
      </div>`;
    return;
  }

  const start = (currentPage - 1) * PER_PAGE;
  const page  = filteredOrders.slice(start, start + PER_PAGE);

  container.innerHTML = `<div class="orders-list">${page.map(o => buildOrderCard(o)).join('')}</div>`;
}

function buildOrderCard(o) {
  const img        = o.image_urls ? o.image_urls.split(',')[0] : '';
  const emoji      = catEmoji[o.category] || catEmoji.default;
  const farmerName = `${o.farmer_first||''} ${o.farmer_last||''}`.trim();
  const date       = fmtDate(o.created_at);
  const price      = parseFloat(o.total_price||0);
  const rejected   = o.status === 'rejected';
  const curIdx     = rejected ? -1 : STEPS.indexOf(o.status);

  // Progress bar
  const progressHTML = rejected
    ? `<div style="display:flex;align-items:center;gap:8px;padding-bottom:14px">
        <div style="background:var(--red-light);color:var(--red);padding:7px 13px;border-radius:8px;font-size:11.5px;font-weight:700">❌ Order rejected by farmer</div>
       </div>`
    : `<div class="progress-track">
        ${STEPS.map((s, idx) => {
          const done   = idx < curIdx;
          const active = idx === curIdx;
          const dotCls = done ? 'done' : active ? 'active' : '';
          const lblCls = done ? 'done' : active ? 'active' : '';
          const icon   = done ? '✓' : STEP_ICONS[idx];
          return `${idx > 0 ? `<div class="pt-line ${done || active ? 'done' : ''}"></div>` : ''}
            <div class="pt-step">
              <div class="pt-dot ${dotCls}">${icon}</div>
              <div class="pt-label ${lblCls}">${STEP_LABELS[idx]}</div>
            </div>`;
        }).join('')}
      </div>`;

  return `
    <div class="order-card" id="card-${o.id}" onclick="toggleCard(${o.id})">
      <div class="order-card-top">
        <div class="order-img-wrap">
          ${img ? `<img src="${img}" alt="${o.produce}" loading="lazy">` : `<span>${emoji}</span>`}
        </div>
        <div class="order-main-info">
          <div class="order-id">Order #KB-${o.id}</div>
          <div class="order-produce">${o.produce}${o.variety ? ` — ${o.variety}` : ''}</div>
          <div class="order-meta">
            <span>⚖️ ${o.quantity} kg</span>
            <span>📍 ${o.farm_location || '—'}</span>
          </div>
          <div class="order-farmer">👩‍🌾 ${farmerName || 'AgroHub Farmer'}</div>
        </div>
        <div class="order-right">
          <div class="order-price">₹${formatNum(price)}</div>
          <div class="order-date">${date}</div>
          <div class="order-pill ${o.status}">${STATUS_LABELS[o.status] || o.status}</div>
        </div>
      </div>
      <div class="order-progress">
        ${progressHTML}
      </div>
      <div class="order-detail" id="detail-${o.id}">
        ${buildOrderDetail(o, farmerName)}
      </div>
      <div class="expand-arrow" onclick="toggleCard(${o.id},event)">
        <span style="font-size:11px;font-weight:600;color:var(--text-light)">View Details</span>
        <span class="expand-arrow-icon" id="arrow-${o.id}" style="margin-left:6px">▼</span>
      </div>
    </div>`;
}

function buildOrderDetail(o, farmerName) {
  const updatedDate = o.updated_at ? fmtDate(o.updated_at) : '—';
  const createdDate = fmtDate(o.created_at);
  const unitPrice   = o.unit_price || (parseFloat(o.total_price||0) / (o.quantity||1)).toFixed(2);

  const timelineItems = [
    {status:'pending',     label:'Order Placed',         note:`Your order for ${o.produce} (${o.quantity} kg) was placed.`, time:createdDate},
    {status:'accepted',    label:'Order Accepted',       note:'Farmer confirmed your order and will prepare for dispatch.', time:''},
    {status:'ready_to_ship',label:'Packed & Ready',      note:'Your produce is packed and ready for pickup/dispatch.', time:''},
    {status:'shipped',     label:'Out for Delivery',     note:'Your order is on its way to you!', time:''},
    {status:'delivered',   label:'Delivered',            note:'Order delivered successfully. Enjoy your fresh produce!', time:updatedDate},
  ];

  const curIdx  = STEPS.indexOf(o.status);
  const rejected = o.status === 'rejected';

  const timelineHTML = rejected
    ? `<div class="tl-item">
        <div class="tl-line-wrap"><div class="tl-dot done"></div></div>
        <div class="tl-content"><div class="tl-step">Order Placed</div><div class="tl-time">${createdDate}</div></div>
       </div>
       <div class="tl-item">
        <div class="tl-line-wrap"><div class="tl-dot cancelled"></div></div>
        <div class="tl-content"><div class="tl-step" style="color:var(--red)">Order Rejected</div><div class="tl-time">${updatedDate}</div><div class="tl-note">The farmer was unable to fulfil this order. Any payment will be refunded.</div></div>
       </div>`
    : timelineItems.map((item, idx) => {
        const done   = idx <= curIdx;
        const active = idx === curIdx;
        const waiting= idx > curIdx;
        const last   = idx === timelineItems.length - 1;
        return `<div class="tl-item">
          <div class="tl-line-wrap">
            <div class="tl-dot ${done ? (active ? 'active' : 'done') : 'waiting'}"></div>
            ${!last ? `<div class="tl-vline ${done && !active ? 'done' : ''}"></div>` : ''}
          </div>
          <div class="tl-content" style="${waiting ? 'opacity:.4' : ''}">
            <div class="tl-step">${item.label}</div>
            ${(done || active) && item.time ? `<div class="tl-time">${item.time}</div>` : waiting ? '<div class="tl-time">Pending</div>' : ''}
            ${done || active ? `<div class="tl-note">${item.note}</div>` : ''}
          </div>
        </div>`;
      }).join('');

  return `
    <div class="detail-grid">
      <div class="detail-row">
        <span class="det-label">Order ID</span>
        <span class="det-val">#KB-${o.id}</span>
      </div>
      <div class="detail-row">
        <span class="det-label">Order Date</span>
        <span class="det-val">${createdDate}</span>
      </div>
      <div class="detail-row">
        <span class="det-label">Produce</span>
        <span class="det-val">${o.produce}${o.variety ? ` (${o.variety})` : ''}</span>
      </div>
      <div class="detail-row">
        <span class="det-label">Quantity</span>
        <span class="det-val">${o.quantity} kg</span>
      </div>
      <div class="detail-row">
        <span class="det-label">Unit Price</span>
        <span class="det-val">₹${unitPrice}/kg</span>
      </div>
      <div class="detail-row">
        <span class="det-label">Total Amount</span>
        <span class="det-val" style="color:var(--saffron);font-size:15px">₹${formatNum(parseFloat(o.total_price||0))}</span>
      </div>
      <div class="detail-row">
        <span class="det-label">Farmer</span>
        <span class="det-val">👩‍🌾 ${farmerName || '—'}</span>
      </div>
      <div class="detail-row">
        <span class="det-label">Last Updated</span>
        <span class="det-val">${updatedDate}</span>
      </div>
    </div>
    ${o.delivery_address ? `
      <div class="det-label">Delivery Address</div>
      <div class="detail-address">📍 ${o.delivery_address}</div>` : ''}
    <div style="margin-top:16px">
      <div class="det-label" style="margin-bottom:10px">Order Timeline</div>
      <div class="track-timeline">${timelineHTML}</div>
    </div>
    ${o.status === 'delivered' ? `
      <button class="reorder-btn" onclick="reorder(event,${o.listing_id},${o.quantity})">
        🔄 Reorder — ${o.produce}
      </button>` : ''}`;
}

// ── TOGGLE CARD EXPAND ────────────────────────────────────────
function toggleCard(id, e) {
  if (e) e.stopPropagation();
  const card  = document.getElementById('card-' + id);
  const arrow = document.getElementById('arrow-' + id);
  if (!card) return;
  const isOpen = card.classList.contains('expanded');
  // Close all
  document.querySelectorAll('.order-card.expanded').forEach(c => {
    c.classList.remove('expanded');
    const a = c.querySelector('.expand-arrow-icon');
    if (a) a.style.transform = '';
  });
  if (!isOpen) {
    card.classList.add('expanded');
    if (arrow) arrow.style.transform = 'rotate(180deg)';
    // scroll into view smoothly
    setTimeout(() => card.scrollIntoView({behavior:'smooth',block:'nearest'}), 50);
  }
}

// ── REORDER ───────────────────────────────────────────────────
async function reorder(e, listingId, qty) {
  e.stopPropagation();
  if (!listingId) { showToast('Cannot reorder this item','error'); return; }
  try {
    const res  = await fetch('/api/cart', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({listing_id: listingId, quantity: qty||1})
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ Added to cart! Go to dashboard to checkout.');
    } else {
      showToast(data.error || 'Could not add to cart','error');
    }
  } catch(err) {
    showToast('Server error','error');
  }
}

// ── PAGINATION ────────────────────────────────────────────────
function renderPagination() {
  const total     = filteredOrders.length;
  const totalPages= Math.ceil(total / PER_PAGE);
  const pag       = document.getElementById('pagination');

  if (totalPages <= 1) { pag.style.display = 'none'; return; }
  pag.style.display = 'flex';

  let html = `<button class="page-btn" onclick="goPage(${currentPage - 1})" ${currentPage===1?'disabled':''}>‹</button>`;
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1) {
      html += `<button class="page-btn ${p===currentPage?'active':''}" onclick="goPage(${p})">${p}</button>`;
    } else if (Math.abs(p - currentPage) === 2) {
      html += `<span class="page-info">…</span>`;
    }
  }
  html += `<button class="page-btn" onclick="goPage(${currentPage + 1})" ${currentPage===totalPages?'disabled':''}>›</button>`;
  html += `<span class="page-info">${total} order${total!==1?'s':''}</span>`;
  pag.innerHTML = html;
}

function goPage(p) {
  const totalPages = Math.ceil(filteredOrders.length / PER_PAGE);
  if (p < 1 || p > totalPages) return;
  currentPage = p;
  renderOrders();
  renderPagination();
  window.scrollTo({top: 0, behavior:'smooth'});
}

// ── HELPERS ───────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

function formatNum(n) {
  if (n >= 100000) return (n/100000).toFixed(1) + 'L';
  return n.toLocaleString('en-IN');
}

function showToast(msg, type='') {
  const wrap = document.getElementById('toastWrap');
  const t    = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  wrap.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 4000);
}