// ── STATE ──────────────────────────────────────────────────
let allOrders      = [];
let filteredOrders = [];
let currentStatus  = 'all';
let currentPage    = 1;
const PER_PAGE     = 6;

const STEPS       = ['pending','accepted','ready_to_ship','shipped','delivered'];
const STEP_ICONS  = ['📝','✅','📦','🚚','🎉'];
const STEP_LABELS = ['Placed','Accepted','Packed','Shipped','Delivered'];
const STATUS_LABELS = {
  pending:'Pending', accepted:'Accepted', rejected:'Rejected',
  ready_to_ship:'Ready to Ship', shipped:'Shipped', delivered:'Delivered'
};

// ── INIT ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadUser();
  await loadAllOrders();
});

// ── USER ──────────────────────────────────────────────────
async function loadUser() {
  try {
    const res = await fetch('/api/user', {credentials:'include'});
    if (!res.ok) { window.location.href = '/login'; return; }
    const u = await res.json();
    document.getElementById('navName').textContent = u.name.split(' ')[0];
    const av = document.getElementById('navAvatar');
    if (u.profile_img) av.innerHTML = `<img src="${u.profile_img}" alt="avatar">`;
    else av.textContent = u.name.split(' ').map(n=>n[0]).join('').toUpperCase();
  } catch(e) { window.location.href = '/login'; }
}

// ── LOAD ORDERS ────────────────────────────────────────────
async function loadAllOrders() {
  try {
    const res = await fetch('/api/orders/farmer', {credentials:'include'});
    if (!res.ok) throw new Error('Unauthorized');
    allOrders = await res.json();
    if (!Array.isArray(allOrders)) allOrders = [];
    buildStats(allOrders);
    applyFilters();
  } catch(e) {
    document.getElementById('ordersContainer').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Could not load orders</div>
        <div class="empty-sub">Please check your connection and try again.</div>
        <button onclick="loadAllOrders()" style="margin-top:16px;padding:10px 20px;background:var(--green-mid);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;font-family:'DM Sans',sans-serif;cursor:pointer">🔄 Retry</button>
      </div>`;
  }
}

// ── STATS — always computed immediately ───────────────────
function buildStats(orders) {
  const delivered = orders.filter(o => o.status === 'delivered');
  const pending   = orders.filter(o => o.status === 'pending');
  const accepted  = orders.filter(o => o.status === 'accepted');
  const transit   = orders.filter(o => ['ready_to_ship','shipped'].includes(o.status));
  const rejected  = orders.filter(o => o.status === 'rejected');
  const revenue   = delivered.reduce((s,o) => s + parseFloat(o.total_price||0), 0);

  // Hero stats
  document.getElementById('statTotal').textContent     = orders.length;
  document.getElementById('statDelivered').textContent = delivered.length;
  document.getElementById('statRevenue').textContent   = revenue >= 100000
    ? '₹' + (revenue/100000).toFixed(1) + 'L'
    : '₹' + revenue.toLocaleString('en-IN');
  document.getElementById('statPending').textContent   = pending.length;

  // Summary pills
  document.getElementById('sumAll').textContent      = orders.length;
  document.getElementById('sumPending').textContent  = pending.length;
  document.getElementById('sumAccepted').textContent = accepted.length;
  document.getElementById('sumReady').textContent    = transit.length;
  document.getElementById('sumDelivered').textContent= delivered.length;
  document.getElementById('sumRejected').textContent = rejected.length;
}

// ── FILTERS ───────────────────────────────────────────────
function setFilter(btn) {
  document.querySelectorAll('.sp').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentStatus = btn.dataset.s;
  currentPage   = 1;
  // sync summary pill highlight
  document.querySelectorAll('.sum-pill').forEach(p => p.classList.remove('active-pill'));
  applyFilters();
}

function setFilterByStatus(status, pillEl) {
  // Map pill status to filter status
  const map = { transit: '' }; // handle transit specially
  document.querySelectorAll('.sum-pill').forEach(p => p.classList.remove('active-pill'));
  pillEl.classList.add('active-pill');

  // Sync the status pills in filter bar
  document.querySelectorAll('.sp').forEach(b => b.classList.remove('active'));
  let matchStatus = status;
  if (status === 'transit') {
    matchStatus = '_transit_';
  }
  const matchBtn = document.querySelector(`.sp[data-s="${matchStatus}"]`);
  if (matchBtn) matchBtn.classList.add('active');
  else document.querySelector('.sp[data-s="all"]').classList.add('active');

  currentStatus = matchStatus;
  currentPage   = 1;
  applyFilters();
}

function applyFilters() {
  const q    = document.getElementById('searchInput').value.toLowerCase().trim();
  const sort = document.getElementById('sortSel').value;
  let data   = [...allOrders];

  if (currentStatus === '_transit_') {
    data = data.filter(o => ['ready_to_ship','shipped'].includes(o.status));
  } else if (currentStatus !== 'all') {
    data = data.filter(o => o.status === currentStatus);
  }

  if (q) data = data.filter(o =>
    (o.produce||'').toLowerCase().includes(q) ||
    `${o.customer_first||''} ${o.customer_last||''}`.toLowerCase().includes(q) ||
    String(o.id).includes(q) ||
    (o.delivery_address||'').toLowerCase().includes(q) ||
    (o.customer_phone||'').includes(q)
  );

  if (sort === 'newest')     data.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  if (sort === 'oldest')     data.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
  if (sort === 'price_high') data.sort((a,b) => parseFloat(b.total_price||0) - parseFloat(a.total_price||0));
  if (sort === 'price_low')  data.sort((a,b) => parseFloat(a.total_price||0) - parseFloat(b.total_price||0));

  filteredOrders = data;
  currentPage    = 1;
  renderOrders();
  renderPagination();
}

// ── RENDER ─────────────────────────────────────────────────
function renderOrders() {
  const container = document.getElementById('ordersContainer');

  if (!filteredOrders.length) {
    const isFiltered = currentStatus !== 'all' || document.getElementById('searchInput').value.trim();
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">${isFiltered ? '🔍' : '📦'}</div>
      <div class="empty-title">${isFiltered ? 'No orders match your filter' : 'No orders yet'}</div>
      <div class="empty-sub">${isFiltered
        ? 'Try a different search or filter, or click "All" to see everything.'
        : 'Orders from buyers will appear here as soon as they purchase your listings.'}</div>
      ${isFiltered ? `<button onclick="resetFilters()" style="margin-top:16px;padding:10px 20px;background:var(--green-mid);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;font-family:'DM Sans',sans-serif;cursor:pointer">Show All Orders</button>` : ''}
    </div>`;
    return;
  }

  const start = (currentPage - 1) * PER_PAGE;
  const page  = filteredOrders.slice(start, start + PER_PAGE);
  container.innerHTML = `<div class="orders-list">${page.map((o,i) => buildCard(o,i)).join('')}</div>`;
}

function buildCard(o, animIdx) {
  const img      = o.image_urls ? o.image_urls.split(',')[0].trim() : '';
  const customer = `${o.customer_first||''} ${o.customer_last||''}`.trim() || '—';
  const date     = fmtDate(o.created_at);
  const rejected = o.status === 'rejected';
  const curIdx   = rejected ? -1 : STEPS.indexOf(o.status);
  const price    = parseFloat(o.total_price||0);
  const unitPrice= parseFloat(o.unit_price || (price/(parseFloat(o.quantity)||1)));

  // ── PROGRESS BAR ──
  const progressHTML = rejected
    ? `<div style="display:flex;align-items:center;gap:8px;padding-bottom:12px;padding-top:4px">
        <div style="background:var(--red-light);color:var(--red);padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;border:1px solid #fca5a5">❌ Order Rejected — Customer has been notified</div>
       </div>`
    : `<div class="progress-track">
        ${STEPS.map((s, idx) => {
          const done   = idx < curIdx;
          const active = idx === curIdx;
          const isLast = idx === STEPS.length - 1;
          return `
            ${idx > 0 ? `<div class="pt-line ${done || active ? 'done' : ''}"></div>` : ''}
            <div class="pt-step">
              <div class="pt-dot ${done ? 'done' : active ? 'active' : ''}">${done ? '✓' : STEP_ICONS[idx]}</div>
              <div class="pt-label ${done ? 'done' : active ? 'active' : ''}">${STEP_LABELS[idx]}</div>
            </div>`;
        }).join('')}
      </div>`;

  // ── ACTION BUTTONS ──
  const actionHTML = getActions(o);

  // ── ORDER DETAIL SECTION (always visible) ──
  const detailHTML = buildDetail(o, customer, unitPrice, price);

  return `
    <div class="order-card" id="ocard-${o.id}" style="animation-delay:${animIdx * 0.06}s">
      <!-- TOP ROW -->
      <div class="order-card-top">
        <div class="order-img-wrap">
          ${img ? `<img src="${img}" alt="${o.produce}" loading="lazy">` : '🌾'}
        </div>
        <div>
          <div class="oi-id">Order #KB-${o.id}</div>
          <div class="oi-produce">${o.produce}${o.variety ? ` — ${o.variety}` : ''}</div>
          <div class="oi-meta">
            <span>⚖️ ${o.quantity} kg</span>
            <span>₹${unitPrice.toLocaleString('en-IN',{maximumFractionDigits:2})}/kg</span>
          </div>
          <div class="oi-customer">👤 ${customer}${o.customer_phone ? ` &nbsp;·&nbsp; 📞 ${o.customer_phone}` : ''}</div>
        </div>
        <div class="or-right">
          <div class="or-price">₹${price.toLocaleString('en-IN')}</div>
          <div class="or-date">🗓 ${date}</div>
          <div class="os-pill ${o.status}">${STATUS_LABELS[o.status] || o.status}</div>
        </div>
      </div>

      <!-- PROGRESS -->
      <div class="order-progress">${progressHTML}</div>

      <!-- ACTION BUTTONS (visible when applicable) -->
      ${actionHTML ? `<div class="order-actions">${actionHTML}</div>` : ''}

      <!-- DETAIL — always shown, no click needed -->
      <div class="order-detail">${detailHTML}</div>
    </div>`;
}

function getActions(o) {
  switch(o.status) {
    case 'pending':
      return `<button class="act-btn accept" onclick="updateStatus(${o.id},'accepted',event)">✅ Accept Order</button>
              <button class="act-btn reject" onclick="updateStatus(${o.id},'rejected',event)">❌ Reject Order</button>`;
    case 'accepted':
      return `<button class="act-btn ready" onclick="updateStatus(${o.id},'ready_to_ship',event)">📦 Mark Ready to Ship</button>`;
    case 'ready_to_ship':
      return `<button class="act-btn ship" onclick="updateStatus(${o.id},'shipped',event)">🚚 Mark as Shipped</button>`;
    case 'shipped':
      return `<button class="act-btn deliver" onclick="updateStatus(${o.id},'delivered',event)">🎉 Mark as Delivered</button>`;
    default:
      return '';
  }
}

function buildDetail(o, customer, unitPrice, totalPrice) {
  const createdDate = fmtDate(o.created_at);
  const updatedDate = o.updated_at ? fmtDate(o.updated_at) : '—';
  const rejected    = o.status === 'rejected';
  const curIdx      = STEPS.indexOf(o.status);

  // ── TIMELINE ──
  let timelineHTML = '';
  if (rejected) {
    timelineHTML = `
      <div class="timeline">
        <div class="tl-step">
          <div class="tl-dot done">📝</div>
          <div class="tl-line done"></div>
          <div class="tl-step-label done">Placed</div>
          <div class="tl-step-note">${createdDate}</div>
        </div>
        <div class="tl-step">
          <div class="tl-dot cancelled">❌</div>
          <div class="tl-step-label cancelled">Rejected</div>
          <div class="tl-step-note">${updatedDate}</div>
        </div>
      </div>`;
  } else {
    timelineHTML = `<div class="timeline">
      ${STEPS.map((s, idx) => {
        const done   = idx < curIdx || (o.status === 'delivered' && idx === curIdx);
        const active = idx === curIdx && o.status !== 'delivered';
        const isLast = idx === STEPS.length - 1;
        const stepDate = idx === 0 ? createdDate : (done ? updatedDate : '');
        return `<div class="tl-step">
          <div class="tl-dot ${done ? 'done' : active ? 'active' : ''}">${done ? '✓' : STEP_ICONS[idx]}</div>
          ${!isLast ? `<div class="tl-line ${done ? 'done' : ''}"></div>` : ''}
          <div class="tl-step-label ${done ? 'done' : active ? 'active' : ''}">${STEP_LABELS[idx]}</div>
          ${stepDate ? `<div class="tl-step-note" style="${!done && !active ? 'opacity:.35' : ''}">${stepDate}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  }

  return `
    <div class="detail-section-title">📋 Order Information</div>
    <div class="detail-grid">
      <div class="det-row">
        <div class="det-lbl">Order ID</div>
        <div class="det-val">#KB-${o.id}</div>
      </div>
      <div class="det-row">
        <div class="det-lbl">Order Date</div>
        <div class="det-val" style="font-size:12px">${createdDate}</div>
      </div>
      <div class="det-row">
        <div class="det-lbl">Quantity</div>
        <div class="det-val">${o.quantity} kg</div>
      </div>
      <div class="det-row">
        <div class="det-lbl">Unit Price</div>
        <div class="det-val">₹${unitPrice.toLocaleString('en-IN',{maximumFractionDigits:2})}/kg</div>
      </div>
      <div class="det-row">
        <div class="det-lbl">Total Amount</div>
        <div class="det-val" style="color:var(--green-mid);font-size:15px">₹${totalPrice.toLocaleString('en-IN')}</div>
      </div>
      <div class="det-row">
        <div class="det-lbl">Customer</div>
        <div class="det-val">👤 ${customer}</div>
      </div>
      <div class="det-row">
        <div class="det-lbl">Phone</div>
        <div class="det-val">${o.customer_phone || '—'}</div>
      </div>
      <div class="det-row">
        <div class="det-lbl">Last Updated</div>
        <div class="det-val" style="font-size:12px">${updatedDate}</div>
      </div>
    </div>

    ${o.delivery_address ? `
      <div class="detail-section-title">📍 Delivery Address</div>
      <div class="address-box">
        <span style="font-size:18px;flex-shrink:0">🏠</span>
        <span>${o.delivery_address}</span>
      </div>` : ''}

    <div class="detail-section-title">🚦 Order Progress</div>
    ${timelineHTML}`;
}

// ── UPDATE STATUS ─────────────────────────────────────────
async function updateStatus(orderId, status, e) {
  if (e) e.stopPropagation();
  const btn = e?.currentTarget;
  const origText = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = '⏳ Updating…'; btn.disabled = true; }
  try {
    const res  = await fetch(`/api/orders/${orderId}/status`, {
      method:'PUT', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({status})
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ Order #KB-${orderId} updated to: ${STATUS_LABELS[status]}`);
      await loadAllOrders();
    } else {
      showToast(data.error || 'Failed to update status', 'error');
      if (btn) { btn.innerHTML = origText; btn.disabled = false; }
    }
  } catch(err) {
    showToast('Network error — please try again', 'error');
    if (btn) { btn.innerHTML = origText; btn.disabled = false; }
  }
}

// ── RESET FILTERS ─────────────────────────────────────────
function resetFilters() {
  currentStatus = 'all';
  document.getElementById('searchInput').value = '';
  document.querySelectorAll('.sp').forEach(b => b.classList.remove('active'));
  document.querySelector('.sp[data-s="all"]').classList.add('active');
  document.querySelectorAll('.sum-pill').forEach(p => p.classList.remove('active-pill'));
  applyFilters();
}

// ── PAGINATION ────────────────────────────────────────────
function renderPagination() {
  const total      = filteredOrders.length;
  const totalPages = Math.ceil(total / PER_PAGE);
  const pag        = document.getElementById('pagination');
  if (totalPages <= 1) { pag.style.display = 'none'; return; }
  pag.style.display = 'flex';
  let html = `<button class="pg-btn" onclick="goPage(${currentPage-1})" ${currentPage===1?'disabled':''}>‹</button>`;
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
      html += `<button class="pg-btn ${p===currentPage?'active':''}" onclick="goPage(${p})">${p}</button>`;
    else if (Math.abs(p - currentPage) === 2)
      html += `<span class="pg-info">…</span>`;
  }
  html += `<button class="pg-btn" onclick="goPage(${currentPage+1})" ${currentPage===totalPages?'disabled':''}>›</button>`;
  html += `<span class="pg-info">${total} order${total!==1?'s':''}</span>`;
  pag.innerHTML = html;
}

function goPage(p) {
  const tp = Math.ceil(filteredOrders.length / PER_PAGE);
  if (p < 1 || p > tp) return;
  currentPage = p;
  renderOrders();
  renderPagination();
  window.scrollTo({top:0,behavior:'smooth'});
}

// ── HELPERS ───────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN',{
    day:'numeric', month:'short', year:'numeric',
    hour:'2-digit', minute:'2-digit'
  });
}

function showToast(msg, type='') {
  const wrap = document.getElementById('toastWrap');
  const t    = document.createElement('div');
  t.className = 'toast' + (type ? ' '+type : '');
  t.textContent = msg;
  wrap.appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),300); }, 3500);
}