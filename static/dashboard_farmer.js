const NOTIF_POLL_MS  = 30000;
const MARKET_POLL_MS = 120000;
let lastNotifCount   = 0;
let allMarketData    = [];
let currentCategory  = 'all';
let allNotifications = [];
let notifFilter = 'all';
let notifPanelOpen = false;

// ── USER ──────────────────────────────────────────────────────────
async function loadUser() {
  try {
    const res = await fetch('/api/user', {credentials:'include'});
    if (!res.ok) { window.location.href = '/login'; return; }
    const user = await res.json();
    document.getElementById('username').textContent     = user.name;
    document.getElementById('dropdownName').textContent = user.name;
    document.getElementById('userEmail').textContent    = user.email;
    const hour  = new Date().getHours();
    const greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
    document.getElementById('greeting').textContent = `${greet}, ${user.name.split(' ')[0]} 👋`;
    document.getElementById('todayDate').textContent =
      new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    if (user.profile_img) {
      document.getElementById('avatarEl').innerHTML = `<img src="${user.profile_img}" alt="avatar">`;
    } else {
      document.getElementById('avatarInitials').textContent =
        user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
  } catch(e) { window.location.href = '/login'; }
}

// ── WEATHER (real via Open-Meteo — free, no key needed) ───────────
async function loadWeather() {
  try {
    // Default to Nashik coordinates (farm region), adjust as needed
    const lat = 20.0, lon = 73.79;
    const url  = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m&forecast_days=1`;
    const res  = await fetch(url);
    const data = await res.json();
    const cw   = data.current_weather;
    const wc   = cw.weathercode;
    let emoji = '☀️', desc = 'Sunny';
    if (wc >= 95) { emoji = '⛈️'; desc = 'Thunderstorm'; }
    else if (wc >= 80) { emoji = '🌧️'; desc = 'Showers'; }
    else if (wc >= 61) { emoji = '🌦️'; desc = 'Rainy'; }
    else if (wc >= 51) { emoji = '🌦️'; desc = 'Drizzle'; }
    else if (wc >= 45) { emoji = '🌫️'; desc = 'Foggy'; }
    else if (wc >= 3)  { emoji = '⛅'; desc = 'Cloudy'; }
    else if (wc >= 1)  { emoji = '🌤️'; desc = 'Partly Cloudy'; }
    document.getElementById('weatherTemp').textContent = `${Math.round(cw.temperature)}°C`;
    document.getElementById('weatherDesc').textContent = desc;
    const wind = Math.round(cw.windspeed);
    document.getElementById('weatherBadge').innerHTML =
      `${emoji} &nbsp;<span class="wtemp" id="weatherTemp">${Math.round(cw.temperature)}°C</span>&nbsp; ${desc} &nbsp;·&nbsp; 🌬️ ${wind} km/h`;
  } catch(e) {
    document.getElementById('weatherBadge').innerHTML =
      `☀️ &nbsp;<span class="wtemp">--°C</span>&nbsp; Weather unavailable`;
  }
}

// ── DASHBOARD STATS ────────────────────────────────────────────────
async function loadDashboardStats() {
  try {
    const [listRes, ordRes] = await Promise.all([
      fetch('/api/listings',      {credentials:'include'}),
      fetch('/api/orders/farmer', {credentials:'include'})
    ]);
    const listings = await listRes.json();
    const orders   = await ordRes.json();

    // Active listings count
    const active = Array.isArray(listings) ? listings.filter(l => l.status === 'active').length : 0;
    document.getElementById('kpiListings').textContent = active;

    // Pending orders count
    const pending = Array.isArray(orders) ? orders.filter(o => o.status === 'pending').length : 0;
    document.getElementById('kpiOrders').textContent = pending;
    if (pending > 0) document.getElementById('navBadgeDot').style.display = 'block';

    // Revenue: sum of delivered orders this month
    const now   = new Date();
    const month = now.getMonth(), year = now.getFullYear();
    const deliveredThisMonth = Array.isArray(orders)
      ? orders.filter(o => {
          if (o.status !== 'delivered') return false;
          const d = new Date(o.created_at || o.updated_at);
          return d.getMonth() === month && d.getFullYear() === year;
        })
      : [];
    const revenue = deliveredThisMonth.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0);
    document.getElementById('kpiRevenue').textContent =
      revenue > 0 ? '₹' + revenue.toLocaleString('en-IN') : '₹0';
    document.getElementById('kpiRevenueOrders').textContent =
      `${deliveredThisMonth.length} delivered order${deliveredThisMonth.length !== 1 ? 's' : ''} this month`;

    // Listing Health Score: derived from active/total ratio + pending orders
    const total    = Array.isArray(listings) ? listings.length : 0;
    const activeRatio = total > 0 ? (active / total) : 0;
    const orderRate   = Array.isArray(orders) && orders.length > 0
      ? Math.min(orders.filter(o => o.status !== 'rejected').length / orders.length, 1) : 0.5;
    const score = Math.round((activeRatio * 60 + orderRate * 40) * 100);
    const clampedScore = Math.min(Math.max(score, 0), 100);
    document.getElementById('kpiHealth').textContent = clampedScore + '%';
    document.getElementById('healthBar').style.width = clampedScore + '%';
    const healthColor = clampedScore >= 70 ? '#3b82f6' : clampedScore >= 40 ? '#e9a71a' : '#e53935';
    document.getElementById('healthBar').style.background = `linear-gradient(90deg,${healthColor},${healthColor}99)`;
    document.getElementById('healthDetails').innerHTML =
      `<span class="health-det">📋 ${active}/${total} active</span>
       <span class="health-det">✅ ${orders.filter ? orders.filter(o=>o.status==='delivered').length : 0} delivered</span>`;

    renderRecentOrders(Array.isArray(orders) ? orders.slice(0, 5) : []);
    loadSchedule(orders);
  } catch(e) {
    document.getElementById('kpiListings').textContent = '—';
    document.getElementById('kpiOrders').textContent   = '—';
    document.getElementById('kpiRevenue').textContent  = '₹—';
    document.getElementById('kpiHealth').textContent   = '—';
  }
}

function renderRecentOrders(orders) {
  const body = document.getElementById('recentOrdersBody');
  if (!orders.length) {
    body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-light)">📦 No orders yet</div>`;
    return;
  }
  const statusMap = {pending:'pending',accepted:'accepted',rejected:'cancelled',ready_to_ship:'processing',shipped:'processing',delivered:'delivered'};
  const labelMap  = {pending:'Pending',accepted:'Accepted',rejected:'Rejected',ready_to_ship:'Ready',shipped:'Shipped',delivered:'Delivered'};
  body.innerHTML = `<table class="order-table" style="width:100%">
    <thead><tr style="background:var(--cream)">
      <th style="padding:10px 16px">Order</th>
      <th style="padding:10px 8px">Produce</th>
      <th style="padding:10px 8px">Qty</th>
      <th style="padding:10px 8px">Amount</th>
      <th style="padding:10px 16px 10px 8px">Status</th>
    </tr></thead>
    <tbody>${orders.map(o => `<tr>
      <td style="padding:10px 16px"><b>#KB-${o.id}</b></td>
      <td style="padding:10px 8px">${o.produce}</td>
      <td style="padding:10px 8px">${o.quantity} kg</td>
      <td style="padding:10px 8px">₹${parseFloat(o.total_price||0).toLocaleString('en-IN')}</td>
      <td style="padding:10px 16px 10px 8px"><span class="status-pill ${statusMap[o.status]||'pending'}">${labelMap[o.status]||o.status}</span></td>
    </tr>`).join('')}</tbody>
  </table>`;
}

// ── SCHEDULE from real orders + service bookings ───────────────────
async function loadSchedule(orders) {
  try {
    const serviceBookingsRes = await fetch('/api/my-service-bookings', {credentials:'include'});
    const serviceBookings    = await serviceBookingsRes.json();
    buildSchedule(orders || [], serviceBookings || []);
  } catch(e) {
    buildSchedule(orders || [], []);
  }
}

function buildSchedule(orders, serviceBookings) {
  const body  = document.getElementById('scheduleBody');
  const items = [];
  const now   = new Date();

  // Add pending/accepted orders as schedule items (due next day)
  (orders || []).forEach(o => {
    if (['pending','accepted','ready_to_ship','shipped'].includes(o.status)) {
      const orderDate = new Date(o.created_at || o.updated_at || now);
      // Show expected update date: order date + 1 day
      const dueDate = new Date(orderDate.getTime() + 86400000);
      items.push({
        date:  dueDate,
        icon:  '📦',
        title: `Order #KB-${o.id} – ${o.produce}`,
        sub:   `${o.quantity} kg · ₹${parseFloat(o.total_price||0).toLocaleString('en-IN')} · ${o.status.replace(/_/g,' ')}`,
        chip:  'order',
        label: 'Order'
      });
    }
  });

  // Add service bookings (vehicle, equipment, warehouse)
  const typeIconMap  = {transport:'🚚', equipment:'🛠️', storage:'🏭'};
  const typeLabelMap = {transport:'Vehicle', equipment:'Equipment', storage:'Warehouse'};
  const typeChipMap  = {transport:'vehicle', equipment:'equip', storage:'warehouse'};

  (serviceBookings || []).forEach(b => {
    if (['pending','accepted','active'].includes(b.status)) {
      let bookDate;
      if (b.booking_date) {
        bookDate = new Date(b.booking_date);
      } else {
        // If no booking date, show ~7 days from now
        bookDate = new Date(now.getTime() + 7 * 86400000);
      }
      const st   = b.service_type || 'transport';
      const icon = typeIconMap[st]  || '📋';
      items.push({
        date:  bookDate,
        icon,
        title: `${icon} ${b.service_name || 'Service'} – ${typeLabelMap[st] || 'Service'}`,
        sub:   `${b.provider_name || 'Provider'} · ${b.status} · ₹${parseFloat(b.amount||0).toLocaleString('en-IN')}`,
        chip:  typeChipMap[st] || 'vehicle',
        label: typeLabelMap[st] || 'Service'
      });
    }
  });

  // Sort by date ascending
  items.sort((a, b) => a.date - b.date);

  if (!items.length) {
    body.innerHTML = `<div class="empty-schedule" style="grid-column:span 2">
      📅 No upcoming events.<br>
      <small style="font-size:11px;margin-top:6px;display:block">Your pending orders and service bookings will appear here.</small>
    </div>`;
    return;
  }

  // Show max 8 items
  const display = items.slice(0, 8);
  body.innerHTML = display.map(item => {
    const d   = item.date;
    const day = d.getDate().toString().padStart(2,'0');
    const mon = d.toLocaleDateString('en-IN',{month:'short'}).toUpperCase();
    return `<div class="schedule-item">
      <div class="sch-date"><div class="sd-day">${day}</div><div class="sd-mon">${mon}</div></div>
      <div class="sch-info">
        <div class="si-title">${item.title}</div>
        <div class="si-sub">${item.sub}</div>
      </div>
      <span class="sch-chip ${item.chip}">${item.label}</span>
    </div>`;
  }).join('');
}

// ── MARKET PRICES ─────────────────────────────────────────────────
async function loadMarketPrices() {
  try {
    const res  = await fetch('/api/market-prices');
    const data = await res.json();
    allMarketData = data.flat || [];
    renderMarketPreview(allMarketData, data.updated_at);
    document.getElementById('marketUpdatedAt').textContent =
      data.updated_at
        ? `Updated: ${new Date(data.updated_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`
        : 'Prices from AgroHub database';
  } catch(e) {
    document.getElementById('marketPricesBody').innerHTML =
      `<div style="color:var(--text-light);padding:16px;text-align:center">Unable to load prices. <a href="#" onclick="loadMarketPrices()" style="color:var(--green-mid)">Retry</a></div>`;
  }
}

function renderMarketPreview(flat, updatedAt) {
  const body = document.getElementById('marketPricesBody');
  if (!flat || !flat.length) {
    body.innerHTML = `<div style="color:var(--text-light);padding:16px;text-align:center">No price data available</div>`;
    return;
  }
  const relevant = flat.filter(p => ['vegetables','grains','spices'].includes(p.category)).slice(0, 6);
  body.innerHTML = relevant.map(p => `
    <div class="price-row" onclick="openMarketPopup()" title="Click to see all prices">
      <div class="price-crop">
        <span class="price-crop-icon">${p.emoji}</span>
        <div>
          <div class="price-crop-name">${p.name}</div>
          <div class="price-crop-unit">📍 ${p.loc}</div>
        </div>
      </div>
      <div>
        <span class="price-val">₹${p.price}</span>
        <span class="price-chg" style="color:var(--text-light)">/${p.unit}</span>
      </div>
    </div>`).join('') +
    `<div style="font-size:10.5px;color:var(--text-light);text-align:right;padding-top:10px;border-top:1px solid var(--cream-dark)">
      🕐 ${updatedAt ? new Date(updatedAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : 'AgroHub Market Data'}
      &nbsp;·&nbsp;<a href="#" onclick="openMarketPopup();return false;" style="color:var(--green-mid);font-size:11px">View all →</a>
    </div>`;
}

// ── MARKET POPUP ─────────────────────────────────────────────────
function openMarketPopup() {
  document.getElementById('marketPopupOverlay').classList.add('active');
  renderMarketGrid();
}
function closeMarketPopup() {
  document.getElementById('marketPopupOverlay').classList.remove('active');
}
function closeMarketIfBg(e) {
  if (e.target === document.getElementById('marketPopupOverlay')) closeMarketPopup();
}

function filterMarket(cat, el) {
  currentCategory = cat;
  document.querySelectorAll('.market-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderMarketGrid();
}

function renderMarketGrid() {
  const q    = (document.getElementById('marketSearch').value || '').toLowerCase().trim();
  const grid = document.getElementById('marketGrid');
  let data   = allMarketData;
  if (currentCategory !== 'all') data = data.filter(p => p.category === currentCategory);
  if (q) data = data.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.loc && p.loc.toLowerCase().includes(q)) ||
    p.category.toLowerCase().includes(q)
  );
  if (!data.length) {
    grid.innerHTML = `<div style="color:var(--text-light);text-align:center;padding:40px;grid-column:span 3">No results found</div>`;
    return;
  }
  const catLabels = {vegetables:'Vegetables',grains:'Grains',fruits:'Fruits',spices:'Spices'};
  grid.innerHTML = data.map(p => `
    <div class="market-item-card">
      <div class="mic-top">
        <span class="mic-emoji">${p.emoji}</span>
        <div>
          <div class="mic-name">${p.name}</div>
          <div class="mic-loc">📍 ${p.loc}</div>
        </div>
      </div>
      <div>
        <span class="mic-price">₹${p.price}</span>
        <span class="mic-unit">/${p.unit}</span>
      </div>
      <div class="market-cat-badge">${catLabels[p.category] || p.category}</div>
    </div>`).join('');
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────
async function pollNotifications() {
  try {
    const res   = await fetch('/api/notifications/unread-count', {credentials:'include'});
    const data  = await res.json();
    const count = data.count || 0;
    const dot   = document.getElementById('navBadgeDot');
    if (count > 0) {
      dot.style.display = 'block';
      if (lastNotifCount > 0 && count > lastNotifCount) {
        const diff = count - lastNotifCount;
        showToast(`🔔 ${diff} new notification${diff > 1 ? 's' : ''}!`);
      }
    } else {
      dot.style.display = 'none';
    }
    lastNotifCount = count;
  } catch(e) {}
}

// ── PROFILE ───────────────────────────────────────────────────────
function toggleProfile() {
  document.getElementById('profileWrap').classList.toggle('open');
}
document.addEventListener('click', e => {
  const wrap = document.getElementById('profileWrap');
  if (!wrap.contains(e.target)) wrap.classList.remove('open');
});

// ── SETTINGS ─────────────────────────────────────────────────────
function openSettings() {
  document.getElementById('profileWrap').classList.remove('open');
  document.getElementById('settingsOverlay').classList.add('active');
}
function closeSettingsDrawer() {
  document.getElementById('settingsOverlay').classList.remove('active');
}
function closeSettings(e) {
  if (e.target === document.getElementById('settingsOverlay')) closeSettingsDrawer();
}

// ── DELETE ACCOUNT ────────────────────────────────────────────────
function openDeleteAccount() {
  closeSettingsDrawer();
  showModal('deleteAccountModal');
}
async function confirmDeleteAccount() {
  const pass = document.getElementById('deleteConfirmPassword').value;
  if (!pass) { showToast('Please enter your password', 'error'); return; }
  const btn = document.querySelector('#deleteAccountModal .btn-danger');
  btn.textContent = '⏳ Deleting…'; btn.disabled = true;
  try {
    const res  = await fetch('/api/account', {method:'DELETE',credentials:'include',
      headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:pass})});
    const data = await res.json();
    if (data.success) {
      showToast('Account deleted. Redirecting…');
      setTimeout(() => window.location.href = '/login', 1800);
    } else {
      showToast(data.error || 'Incorrect password', 'error');
      btn.textContent = '🗑️ Delete Forever'; btn.disabled = false;
    }
  } catch(e) {
    showToast('Error. Please try again.', 'error');
    btn.textContent = '🗑️ Delete Forever'; btn.disabled = false;
  }
}

function showModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => {
  if (e.target === o) o.classList.remove('active');
}));

function showToast(msg, type = '') {
  const wrap = document.getElementById('toastWrap');
  const t    = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  wrap.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500);
}

async function logout() {
  await fetch('/api/logout', {credentials:'include'});
  window.location.href = '/login';
}

function toggleNotifPanel() {
  notifPanelOpen ? closeNotifPanel() : openNotifPanel();
}

async function openNotifPanel() {
  notifPanelOpen = true;
  document.getElementById('notifPanel').classList.add('open');
  await loadNotifications();
}

function closeNotifPanel() {
  notifPanelOpen = false;
  document.getElementById('notifPanel').classList.remove('open');
}

// Close if clicking outside
document.addEventListener('click', e => {
  const panel = document.getElementById('notifPanel');
  const bell  = document.getElementById('bellBtn');
  if (notifPanelOpen && panel && !panel.contains(e.target) && !bell.contains(e.target)) {
    closeNotifPanel();
  }
});

async function loadNotifications() {
  try {
    const res  = await fetch('/api/notifications', {credentials:'include'});
    const data = await res.json();
    allNotifications = Array.isArray(data) ? data : [];
    renderNotifList();
    updateBellBadge();
    const el = document.getElementById('notifUpdatedAt');
    if (el) el.textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
  } catch(e) {
    document.getElementById('notifList').innerHTML =
      `<div class="notif-empty">Could not load notifications.<br><small>Check your connection.</small></div>`;
  }
}

function classifyNotif(n) {
  const msg = (n.message || '').toLowerCase();
  const t   = (n.type   || '').toLowerCase();
  if (msg.includes('order') || msg.includes('#kb-')) return 'order';
  if (msg.includes('booking') || msg.includes('service') || msg.includes('vehicle') ||
      msg.includes('warehouse') || msg.includes('equipment')) return 'service';
  if (t === 'success') return 'success';
  if (t === 'error')   return 'error';
  if (t === 'warn')    return 'warn';
  return 'info';
}

function notifIcon(kind) {
  const map = {
    order:'🛒', service:'📋', success:'✅', error:'❌', warn:'⚠️', info:'ℹ️'
  };
  return map[kind] || 'ℹ️';
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function renderNotifList() {
  const list = document.getElementById('notifList');
  let filtered = allNotifications;

  if (notifFilter !== 'all') {
    filtered = allNotifications.filter(n => {
      const kind = classifyNotif(n);
      if (notifFilter === 'order')   return kind === 'order';
      if (notifFilter === 'service') return kind === 'service';
      if (notifFilter === 'info')    return ['info','success','warn','error'].includes(kind);
      return true;
    });
  }

  if (!filtered.length) {
    list.innerHTML = `<div class="notif-empty">
      ${notifFilter === 'all' ? '🔔 No notifications yet' : '🔍 No notifications in this category'}
    </div>`;
    return;
  }

  list.innerHTML = filtered.map(n => {
    const kind    = classifyNotif(n);
    const icon    = notifIcon(kind);
    const unread  = !n.is_read ? 'unread' : '';
    const rawMsg  = n.message || '';

    // Bold key tokens like order numbers, amounts, produce names
    const prettyMsg = rawMsg
      .replace(/(#[A-Z0-9-]+)/g, '<b>$1</b>')
      .replace(/(₹[\d,]+)/g, '<b>$1</b>')
      .replace(/(accepted|delivered|rejected|shipped|completed|ready to ship)/gi,
               w => `<b style="color:${/accept|deliver|complet|ready/i.test(w)?'#22c55e':'#ef4444'}">${w}</b>`);

    return `<div class="notif-item ${unread}" onclick="handleNotifClick(${n.id},'${kind}')">
      <div class="notif-icon-wrap ${kind}">${icon}</div>
      <div style="flex:1;min-width:0">
        <div class="notif-msg">${prettyMsg}</div>
        <span class="notif-time">🕐 ${timeAgo(n.created_at)}</span>
      </div>
      ${!n.is_read ? '<div style="width:7px;height:7px;border-radius:50%;background:var(--green-mid);flex-shrink:0;margin-top:6px"></div>' : ''}
    </div>`;
  }).join('');
}

function filterNotifs(tab, el) {
  notifFilter = tab;
  document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderNotifList();
}

function handleNotifClick(id, kind) {
  // Mark this one as read locally and re-render
  allNotifications = allNotifications.map(n =>
    n.id === id ? {...n, is_read: 1} : n
  );
  renderNotifList();
  updateBellBadge();

  // Navigate to relevant page
  if (kind === 'order')   window.location.href = '/sellmygoods';
  if (kind === 'service') window.location.href = '/sellmygoods';
}

async function markAllRead() {
  try {
    await fetch('/api/notifications/mark-read', {method:'POST', credentials:'include'});
    allNotifications = allNotifications.map(n => ({...n, is_read: 1}));
    renderNotifList();
    updateBellBadge();
    showToast('✅ All notifications marked as read');
  } catch(e) {
    showToast('Could not mark as read', 'error');
  }
}

function updateBellBadge() {
  const unreadCount = allNotifications.filter(n => !n.is_read).length;
  const dot = document.getElementById('navBadgeDot');

  // Remove old count badge if any
  const oldBadge = document.querySelector('.notif-count-badge');
  if (oldBadge) oldBadge.remove();

  if (unreadCount > 0) {
    dot.style.display = 'block';
    const bell = document.getElementById('bellBtn');
    const badge = document.createElement('span');
    badge.className = 'notif-count-badge';
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    bell.appendChild(badge);
  } else {
    dot.style.display = 'none';
  }
}

// Replace old pollNotifications
async function pollNotifications() {
  try {
    const res   = await fetch('/api/notifications/unread-count', {credentials:'include'});
    const data  = await res.json();
    const count = data.count || 0;
    const dot   = document.getElementById('navBadgeDot');

    if (count > 0) {
      dot.style.display = 'block';
      if (lastNotifCount > 0 && count > lastNotifCount) {
        const diff = count - lastNotifCount;
        showToast(`🔔 ${diff} new notification${diff > 1 ? 's' : ''}!`);
        // If panel is open, refresh it
        if (notifPanelOpen) loadNotifications();
      }
    } else {
      dot.style.display = 'none';
    }
    lastNotifCount = count;

    // Update badge number too
    const oldBadge = document.querySelector('.notif-count-badge');
    if (oldBadge) oldBadge.remove();
    if (count > 0) {
      const bell  = document.getElementById('bellBtn');
      const badge = document.createElement('span');
      badge.className = 'notif-count-badge';
      badge.textContent = count > 99 ? '99+' : count;
      bell.appendChild(badge);
    }
  } catch(e) {}
}

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadUser();
  await Promise.all([
    loadDashboardStats(),
    loadMarketPrices(),
    loadWeather(),
  ]);
  await pollNotifications();
  lastNotifCount = document.getElementById('navBadgeDot').style.display !== 'none' ? 1 : 0;
  setInterval(pollNotifications, NOTIF_POLL_MS);
  setInterval(loadMarketPrices,  MARKET_POLL_MS);
});