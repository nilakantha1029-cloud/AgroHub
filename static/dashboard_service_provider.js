// ═══ STATE ═══════════════════════════════════════════════════
let userData     = {};
let services     = { transport:[], equipment:[], storage:[] };
let bookings     = [];
let editingId    = null;
let deletingId   = null;
let deletingType = null;
let currentServiceType   = 'transport';
let currentFilter        = { transport:'all', equipment:'all', storage:'all' };
let currentBookingFilter = 'all';
let pendingImgFiles      = [];
let existingImgUrls      = [];

// ═══ INIT ════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  await loadUser();
  await loadServicesFromDB();     // await so services is populated before rendering
  await loadBookingsFromDB();
  refreshAllUI();
  loadNotifications();
});

function refreshAllUI() {
  updateAllStats();       // KPI cards + per-type stats
  updateOverviewCards();  // home service overview numbers
  updateBadges();         // booking count badges
  renderList('transport');
  renderList('equipment');
  renderList('storage');
  renderBookings();
  renderHomeBookings();
  renderSchedule();
  renderEarnings();
  renderRevChart();
}

document.addEventListener('click', e => {
  if (!e.target.closest('.notif-wrap'))  document.getElementById('notifWrap').classList.remove('open');
  if (!e.target.closest('.profile-wrap')) document.getElementById('profileWrap').classList.remove('open');
});

// ═══ USER ════════════════════════════════════════════════════
async function loadUser() {
  try {
    const res = await fetch('/api/user', { credentials:'include' });
    if (!res.ok) { window.location.href='/login'; return; }
    userData = await res.json();
    const name     = userData.name || 'Service Provider';
    const initials = name.split(' ').map(n=>n[0]).join('').toUpperCase();

    document.getElementById('navName').textContent = name;
    document.getElementById('ddName').textContent  = name;

    const navAv = document.getElementById('navAvatar');
    if (userData.profile_img) {
      navAv.innerHTML = `<img src="${userData.profile_img}" alt="${name}">`;
    } else {
      document.getElementById('navInitials').textContent = initials;
    }

    const hour  = new Date().getHours();
    const greet = hour<12?'Good Morning':hour<17?'Good Afternoon':'Good Evening';
    document.getElementById('homeGreeting').textContent = `${greet}, ${name.split(' ')[0]} 👋`;
    document.getElementById('homeDate').textContent = new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

    const emailEl = document.getElementById('s-display-email');
    if (emailEl && userData.email) emailEl.textContent = userData.email;
  } catch(e) { window.location.href='/login'; }
}

async function doLogout() {
  await fetch('/api/logout', {credentials:'include'});
  window.location.href = '/login';
}

// ═══ LOAD SERVICES FROM DB (with localStorage fallback) ═══
async function loadServicesFromDB() {
  try {
    const res = await fetch('/api/service-listings', { credentials:'include' });
    if (res.ok) {
      const data = await res.json();
      services = { transport:[], equipment:[], storage:[] };
      if (Array.isArray(data)) {
        data.forEach(s => {
          if (s.service_type && services[s.service_type]) {
            services[s.service_type].push(s);
          }
        });
      }
      return; // success
    }
  } catch(e) {}
  // Fallback: try localStorage
  loadServicesFromLocalStorage();
}

function loadServicesFromLocalStorage() {
  ['transport','equipment','storage'].forEach(type => {
    try {
      const k = `AgroHub_${type}_${userData.id||'user'}`;
      const stored = localStorage.getItem(k);
      services[type] = stored ? JSON.parse(stored) : [];
    } catch(e) { services[type] = []; }
  });
}

function saveToLocalStorage(type) {
  try {
    localStorage.setItem(`AgroHub_${type}_${userData.id||'user'}`, JSON.stringify(services[type]));
  } catch(e) {}
}

// ═══ BOOKINGS ════════════════════════════════════════════════
async function loadBookingsFromDB() {
  try {
    const res = await fetch('/api/service-bookings', { credentials:'include' });
    if (res.ok) {
      const data = await res.json();
      bookings = data.map(b => ({
        id:           b.id,
        service_id:   b.listing_id,
        service_name: b.service_name || '—',
        service_type: b.service_type || 'transport',
        customer:     b.customer || (b.customer_first||'') + ' ' + (b.customer_last||''),
        customer_phone: b.customer_phone || '',
        date:         b.booking_date ? new Date(b.booking_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '—',
        raw_date: b.booking_date || null,
        duration:     b.duration_days ? b.duration_days + ' day' + (b.duration_days>1?'s':'') : '—',
        amount:       parseFloat(b.amount || 0),
        status:       b.status || 'pending',
        location:     b.location || '',
        notes:        b.notes || '',
        created:      new Date(b.created_at||Date.now()).getTime()
      }));
    } else { bookings = []; }
  } catch(e) { console.warn('bookings load error:', e); bookings = []; }
}

// bookings are stored in DB; no local save needed

// ═══ VIEW SWITCHER ════════════════════════════════════════════
function switchView(view, filter) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.menu a').forEach(a=>a.classList.remove('active'));
  const el = document.getElementById('view-'+view);
  if (el) el.classList.add('active');
  const mn = document.getElementById('mn-'+view) || document.getElementById('mn-'+view+'s');
  if (mn) mn.classList.add('active');
  if (view==='bookings' && filter) {
    const btn = document.getElementById('bk-tab-'+filter);
    if (btn) filterBookings(filter, btn);
  }
  document.getElementById('profileWrap').classList.remove('open');
}

// ═══ STATS & OVERVIEW ════════════════════════════════════════
function updateAllStats() {
  const allSvcs = [...services.transport,...services.equipment,...services.storage];
  const pendingCount = bookings.filter(b=>b.status==='pending').length;
  const doneCount    = bookings.filter(b=>b.status==='completed').length;
  const rev          = bookings.filter(b=>b.status==='completed').reduce((s,b)=>s+parseFloat(b.amount||0),0);

  setText('kpiRevenue',  '₹'+rev.toLocaleString('en-IN'));
  setText('kpiServices', allSvcs.length);
  setText('kpiPending',  pendingCount);
  setText('kpiCompleted',doneCount);

  renderStats('transport');
  renderStats('equipment');
  renderStats('storage');
}

function renderStats(type) {
  const list   = services[type] || [];
  const avail  = list.filter(s=>s.status==='available').length;
  const booked = list.filter(s=>s.status==='booked').length;
  const labels = {transport:['Vehicles','Available','Booked'],equipment:['Equipment','Available','Rented'],storage:['Facilities','Available','Occupied']};
  const icons  = {transport:'🚛',equipment:'🚜',storage:'🏭'};
  const el = document.getElementById(type+'-stats');
  if (!el) return;
  el.innerHTML = `
    <div class="kpi-card green" style="animation:none"><div class="kpi-label">Total ${labels[type][0]}</div><div class="kpi-val">${list.length}</div><div class="kpi-meta">Listed</div><span class="kpi-icon">${icons[type]}</span></div>
    <div class="kpi-card amber" style="animation:none"><div class="kpi-label">${labels[type][1]}</div><div class="kpi-val">${avail}</div><div class="kpi-meta">Ready to book</div><span class="kpi-icon">✅</span></div>
    <div class="kpi-card blue" style="animation:none"><div class="kpi-label">${labels[type][2]}</div><div class="kpi-val">${booked}</div><div class="kpi-meta">Currently busy</div><span class="kpi-icon">📦</span></div>`;
}

// ── KEY FIX: updateOverviewCards — sets the home page service card numbers ──
function updateOverviewCards() {
  const t = services.transport || [];
  const e = services.equipment || [];
  const s = services.storage   || [];

  setText('ov-t-total', t.length);
  setText('ov-t-avail', t.filter(x=>x.status==='available').length);
  setText('ov-t-book',  t.filter(x=>x.status==='booked').length);

  setText('ov-e-total', e.length);
  setText('ov-e-avail', e.filter(x=>x.status==='available').length);
  setText('ov-e-book',  e.filter(x=>x.status==='booked').length);

  setText('ov-s-total', s.length);
  setText('ov-s-avail', s.filter(x=>x.status==='available').length);
  setText('ov-s-cap',   s.reduce((sum,i)=>sum+parseInt(i.capacity||0), 0));
}

// ── KEY FIX: updateBadges — pending is always defined, null-checked refs ──
function updateBadges() {
  const pendingCount = bookings.filter(b=>b.status==='pending').length;

  // Booking count badges in sidebar
  const bb = document.getElementById('badge-bookings');
  if (bb) { bb.textContent = bookings.length; bb.style.display = bookings.length ? 'inline-block' : 'none'; }
  const bp = document.getElementById('badge-pending');
  if (bp) { bp.textContent = pendingCount; bp.style.display = pendingCount ? 'inline-block' : 'none'; }

  // Nav bell badge
  const nb = document.getElementById('navBadge');
  if (nb) { nb.textContent = pendingCount; nb.style.display = pendingCount ? 'grid' : 'none'; }
}

function setText(id, val) { const el=document.getElementById(id); if(el) el.textContent=val; }

// ═══ RENDER LISTS ════════════════════════════════════════════
function filterList(type, status, btn) {
  currentFilter[type] = status;
  document.querySelectorAll(`#view-${type} .filter-tab`).forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderList(type);
}

function renderList(type) {
  const prefix = {transport:'t',equipment:'e',storage:'s'}[type];
  const search = (document.getElementById(prefix+'-search')?.value||'').toLowerCase();
  const sort   = document.getElementById(prefix+'-sort')?.value || 'newest';
  const filter = currentFilter[type] || 'all';
  const list   = services[type] || [];

  let data = list.filter(s => {
    const mf = filter==='all' || s.status===filter;
    const ms = (s.name||'').toLowerCase().includes(search) || (s.location||'').toLowerCase().includes(search);
    return mf && ms;
  });

  if      (sort==='price-high')    data.sort((a,b)=>parseFloat(b.price||0)-parseFloat(a.price||0));
  else if (sort==='price-low')     data.sort((a,b)=>parseFloat(a.price||0)-parseFloat(b.price||0));
  else if (sort==='capacity-high') data.sort((a,b)=>parseInt(b.capacity||0)-parseInt(a.capacity||0));
  else                             data.sort((a,b)=>(parseFloat(b.created_at||b.created||0))-(parseFloat(a.created_at||a.created||0)));

  // Update filter tab counts
  ['all','available','booked','maintenance','unavailable'].forEach(st => {
    const el = document.getElementById(`${prefix}-cnt-${st}`);
    if (el) el.textContent = st==='all' ? list.length : list.filter(x=>x.status===st).length;
  });
  const countEl = document.getElementById(`${prefix}-table-count`);
  if (countEl) countEl.textContent = `${data.length} listing${data.length!==1?'s':''}`;

  const tbody = document.getElementById(`${prefix}-table-body`);
  if (!tbody) return;

  if (!data.length) {
    const names = {transport:'Vehicle',equipment:'Equipment',storage:'Facility'};
    const ics   = {transport:'🚛',equipment:'🚜',storage:'🏭'};
    tbody.innerHTML = `<div class="empty-state"><div class="es-icon">${ics[type]}</div><h3>No ${type} listed yet</h3><p>Click "+ Add ${names[type]}" above to get started</p></div>`;
    return;
  }

  const cols = {transport:['Vehicle','Type','Capacity','Price/Trip','Location','Status',''],equipment:['Equipment','Category','Condition','Rate/Day','Location','Status',''],storage:['Facility','Type','Capacity','Rate/qtl/day','Location','Status','']};
  const ics  = {transport:'🚛',equipment:'🚜',storage:'🏭'};
  const priceUnit = {transport:'per trip',equipment:'per day',storage:'per qtl/day'};

  tbody.innerHTML = `<table class="srv-table"><thead><tr>${cols[type].map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>
  ${data.map(s => {
    const imgs     = parseImages(s.image_urls);
    const thumb    = imgs[0] ? `<img src="${imgs[0]}" alt="${s.name}">` : ics[type];
    const statusCl = ['available','booked','maintenance','unavailable'].includes(s.status) ? s.status : 'unavailable';
    const col2     = s.sub_type || s.category || s.storage_type || '—';
    const col3     = type==='equipment' ? (s.condition||'Good') : (s.capacity||'—')+(type==='transport'?' ton':type==='storage'?' qtl':'');
    return `<tr>
      <td><div class="cell-img">
        <div class="cell-thumb">${imgs[0]?`<img src="${imgs[0]}" alt="${s.name}">`:ics[type]}</div>
        <div><div class="cell-title">${escHtml(s.name)}</div><div class="cell-sub">${escHtml(s.reg_no||s.model||'')}</div></div>
      </div></td>
      <td><span class="type-badge ${type}">${escHtml(col2)}</span></td>
      <td>${escHtml(col3)}</td>
      <td><div class="price-cell">₹${Number(s.price||0).toLocaleString()}</div><div class="price-sub">${priceUnit[type]}</div></td>
      <td style="max-width:130px;font-size:12px;color:var(--text-mid)">${escHtml(s.location||'—')}</td>
      <td><span class="avail-pill ${statusCl}">${s.status}</span></td>
      <td><div class="actions-cell">
        <button class="icon-btn view" onclick='viewService("${type}",${s.id})'>👁️</button>
        <button class="icon-btn edit" onclick='editService("${type}",${s.id})'>✏️</button>
        <button class="icon-btn del"  onclick='openDelete("${type}",${s.id})'>🗑️</button>
      </div></td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

// ═══ ADD / EDIT MODAL ════════════════════════════════════════
function openAddModal(type) {
  editingId         = null;
  pendingImgFiles   = [];
  existingImgUrls   = [];
  currentServiceType = type;
  document.getElementById('addModalTitle').textContent    = `+ Add ${type==='transport'?'Vehicle':type==='equipment'?'Equipment':'Storage Facility'}`;
  document.getElementById('addModalSaveBtn').textContent  = '✅ Post Listing';
  document.getElementById('addModalBody').innerHTML       = buildForm(type, null);
  showModal('addModal');
}

function editService(type, id) {
  const s = (services[type]||[]).find(x=>x.id==id);
  if (!s) return;
  editingId          = id;
  pendingImgFiles    = [];
  existingImgUrls    = parseImages(s.image_urls);
  currentServiceType = type;
  document.getElementById('addModalTitle').textContent   = `✏️ Edit ${type==='transport'?'Vehicle':type==='equipment'?'Equipment':'Storage Facility'}`;
  document.getElementById('addModalSaveBtn').textContent = '💾 Save Changes';
  document.getElementById('addModalBody').innerHTML      = buildForm(type, s);
  renderImgPreview();
  showModal('addModal');
}

function buildForm(type, s) {
  if (type==='transport') return buildTransportForm(s);
  if (type==='equipment') return buildEquipmentForm(s);
  return buildStorageForm(s);
}

function parseFeatures(f) {
  if (!f) return [];
  if (Array.isArray(f)) return f;
  try { return JSON.parse(f); } catch(e) { return String(f).split(',').filter(Boolean); }
}

function parseImages(u) {
  if (!u) return [];
  if (Array.isArray(u)) return u;
  try { const p=JSON.parse(u); return Array.isArray(p)?p:[]; } catch(e) { return String(u).split(',').filter(Boolean); }
}

function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function sel(opts, cur) { return opts.map(o=>`<option value="${o}" ${cur===o?'selected':''}>${o}</option>`).join(''); }

function buildTransportForm(s) {
  const v=s||{}, f=parseFeatures(v.features);
  return `<input type="file" id="fi_images" multiple accept="image/*" style="display:none" onchange="handleImgSelect(this)"/>
  <div class="modal-section"><div class="modal-section-title">Vehicle Information</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label req">Vehicle Name / Model</label><input class="form-input" id="fi_name" value="${escHtml(v.name||'')}" placeholder="e.g. Tata 407, Mahindra Bolero"/></div>
      <div class="form-group"><label class="form-label req">Vehicle Type</label><select class="form-select" id="fi_sub_type"><option value="">Select type</option>${sel(['Mini Truck (1-3 ton)','Medium Truck (5-8 ton)','Large Truck (10+ ton)','Tractor Trolley','Pickup Truck','Refrigerated Van','Container Truck'],v.sub_type)}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Registration No.</label><input class="form-input" id="fi_reg_no" value="${escHtml(v.reg_no||'')}" placeholder="e.g. MH 15 AB 1234"/></div>
      <div class="form-group"><label class="form-label">Year</label><input class="form-input" id="fi_year" type="number" value="${v.year||''}" placeholder="e.g. 2020"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label req">Capacity</label><div class="input-with-unit"><input class="form-input" id="fi_capacity" type="number" value="${v.capacity||''}" placeholder="5"/><span class="input-unit">ton</span></div></div>
      <div class="form-group"><label class="form-label">Fuel Type</label><select class="form-select" id="fi_fuel">${sel(['Diesel','Petrol','CNG','Electric'],v.fuel)}</select></div>
    </div>
  </div>
  <div class="modal-section"><div class="modal-section-title">Pricing & Availability</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label req">Price per Trip</label><div class="input-with-unit"><input class="form-input" id="fi_price" type="number" value="${v.price||''}" placeholder="3500"/><span class="input-unit">₹</span></div></div>
      <div class="form-group"><label class="form-label">Per KM Rate</label><div class="input-with-unit"><input class="form-input" id="fi_per_km" type="number" value="${v.per_km||''}" placeholder="12"/><span class="input-unit">₹/km</span></div></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label req">Base Location</label><input class="form-input" id="fi_location" value="${escHtml(v.location||'')}" placeholder="Village / Town"/></div>
      <div class="form-group"><label class="form-label">Routes Covered</label><input class="form-input" id="fi_routes" value="${escHtml(v.routes||'')}" placeholder="e.g. Nashik, Pune, Mumbai"/></div>
    </div>
    <div class="form-group"><label class="form-label">Status</label><select class="form-select" id="fi_status">${sel(['available','booked','maintenance'],v.status||'available')}</select></div>
  </div>
  <div class="modal-section"><div class="modal-section-title">Features & Photos</div>
    <div class="feat-chips" id="featChips">${['GPS Tracking','AC Cabin','Loading Help','Night Trips','Insurance Covered','Driver Included'].map(ft=>`<div class="feat-chip ${f.includes(ft)?'selected':''}" onclick="this.classList.toggle('selected')">${ft}</div>`).join('')}</div>
    <div class="form-group" style="margin-top:14px"><label class="form-label">Description</label><textarea class="form-textarea" id="fi_desc" placeholder="Vehicle condition, driver experience…">${escHtml(v.description||v.desc||'')}</textarea></div>
    <div class="photo-upload" onclick="document.getElementById('fi_images').click()"><div class="pu-icon">📸</div><div class="pu-text">Upload Vehicle Photos</div><div class="pu-hint" id="photoHint">Click to upload (max 5, JPG/PNG)</div></div>
    <div id="imgPreviewGrid" class="img-preview-grid"></div>
    <div class="upload-progress" id="uploadProgress"><div class="upload-bar"><div class="upload-bar-fill" id="uploadBarFill"></div></div><div class="upload-status" id="uploadStatusText">Uploading…</div></div>
  </div>`;
}

function buildEquipmentForm(s) {
  const v=s||{}, f=parseFeatures(v.features);
  return `<input type="file" id="fi_images" multiple accept="image/*" style="display:none" onchange="handleImgSelect(this)"/>
  <div class="modal-section"><div class="modal-section-title">Equipment Details</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label req">Equipment Name</label><input class="form-input" id="fi_name" value="${escHtml(v.name||'')}" placeholder="e.g. Mahindra 265 DI Tractor"/></div>
      <div class="form-group"><label class="form-label req">Category</label><select class="form-select" id="fi_sub_type"><option value="">Select category</option>${sel(['Tractor','Combine Harvester','Power Tiller','Rotavator','Seed Drill','Power Sprayer','Water Pump','Thresher','Baler','Plough','Cultivator','Other'],v.sub_type)}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Brand / Model</label><input class="form-input" id="fi_model" value="${escHtml(v.model||'')}" placeholder="e.g. Mahindra 265 DI"/></div>
      <div class="form-group"><label class="form-label">HP / Power</label><input class="form-input" id="fi_capacity" value="${escHtml(v.capacity||'')}" placeholder="e.g. 35 HP"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Year</label><input class="form-input" id="fi_year" type="number" value="${v.year||''}" placeholder="e.g. 2019"/></div>
      <div class="form-group"><label class="form-label">Condition</label><select class="form-select" id="fi_condition">${sel(['Excellent','Good','Fair','Needs Minor Repair'],v.condition)}</select></div>
    </div>
  </div>
  <div class="modal-section"><div class="modal-section-title">Pricing & Location</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label req">Daily Rental Rate</label><div class="input-with-unit"><input class="form-input" id="fi_price" type="number" value="${v.price||''}" placeholder="1500"/><span class="input-unit">₹/day</span></div></div>
      <div class="form-group"><label class="form-label">Min Rental Days</label><input class="form-input" id="fi_min_days" type="number" value="${v.min_days||1}" placeholder="1"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label req">Location</label><input class="form-input" id="fi_location" value="${escHtml(v.location||'')}" placeholder="Village / Taluka"/></div>
      <div class="form-group"><label class="form-label">Operator</label><select class="form-select" id="fi_operator">${sel(['Yes – Operator included','No – Self-operated only','Optional – Extra charge'],v.operator)}</select></div>
    </div>
    <div class="form-group"><label class="form-label">Status</label><select class="form-select" id="fi_status">${sel(['available','booked','maintenance'],v.status||'available')}</select></div>
  </div>
  <div class="modal-section"><div class="modal-section-title">Features & Photos</div>
    <div class="feat-chips" id="featChips">${['Fully Serviced','Attachments Included','Delivery Available','Fuel Included','Night Lighting','GPS Enabled'].map(ft=>`<div class="feat-chip ${f.includes(ft)?'selected':''}" onclick="this.classList.toggle('selected')">${ft}</div>`).join('')}</div>
    <div class="form-group" style="margin-top:14px"><label class="form-label">Description</label><textarea class="form-textarea" id="fi_desc" placeholder="Usage history, servicing info…">${escHtml(v.description||v.desc||'')}</textarea></div>
    <div class="photo-upload" onclick="document.getElementById('fi_images').click()"><div class="pu-icon">📸</div><div class="pu-text">Upload Equipment Photos</div><div class="pu-hint" id="photoHint">Click to upload (max 5)</div></div>
    <div id="imgPreviewGrid" class="img-preview-grid"></div>
    <div class="upload-progress" id="uploadProgress"><div class="upload-bar"><div class="upload-bar-fill" id="uploadBarFill"></div></div><div class="upload-status" id="uploadStatusText">Uploading…</div></div>
  </div>`;
}

function buildStorageForm(s) {
  const v=s||{}, f=parseFeatures(v.features);
  return `<input type="file" id="fi_images" multiple accept="image/*" style="display:none" onchange="handleImgSelect(this)"/>
  <div class="modal-section"><div class="modal-section-title">Facility Information</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label req">Facility Name</label><input class="form-input" id="fi_name" value="${escHtml(v.name||'')}" placeholder="e.g. Nashik AgroFreeze Hub"/></div>
      <div class="form-group"><label class="form-label req">Storage Type</label><select class="form-select" id="fi_sub_type"><option value="">Select type</option>${sel(['Cold Storage (0-8°C)','Dry Warehouse','Grain Silo','Vegetable Bay','Fruit Ripening Chamber','General Purpose'],v.sub_type)}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label req">Total Capacity</label><div class="input-with-unit"><input class="form-input" id="fi_capacity" type="number" value="${v.capacity||''}" placeholder="500"/><span class="input-unit">qtl</span></div></div>
      <div class="form-group"><label class="form-label">Available Space</label><div class="input-with-unit"><input class="form-input" id="fi_available_space" type="number" value="${v.available_space||''}" placeholder="200"/><span class="input-unit">qtl</span></div></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Temp Range</label><input class="form-input" id="fi_temp_range" value="${escHtml(v.temp_range||'')}" placeholder="e.g. 2°C to 8°C"/></div>
      <div class="form-group"><label class="form-label">Humidity Control</label><select class="form-select" id="fi_humidity">${sel(['Yes – Controlled','No – Uncontrolled','Partial'],v.humidity)}</select></div>
    </div>
  </div>
  <div class="modal-section"><div class="modal-section-title">Pricing & Location</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label req">Rate per Quintal/Day</label><div class="input-with-unit"><input class="form-input" id="fi_price" type="number" value="${v.price||''}" placeholder="2.5"/><span class="input-unit">₹</span></div></div>
      <div class="form-group"><label class="form-label">Min Storage Days</label><input class="form-input" id="fi_min_days" type="number" value="${v.min_days||1}" placeholder="7"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label req">Location / Address</label><input class="form-input" id="fi_location" value="${escHtml(v.location||'')}" placeholder="Complete address"/></div>
      <div class="form-group"><label class="form-label">Nearest APMC</label><input class="form-input" id="fi_nearest_apmc" value="${escHtml(v.nearest_apmc||'')}" placeholder="e.g. Nashik APMC"/></div>
    </div>
    <div class="form-group"><label class="form-label">Status</label><select class="form-select" id="fi_status">${sel(['available','booked','unavailable'],v.status||'available')}</select></div>
  </div>
  <div class="modal-section"><div class="modal-section-title">Facilities & Photos</div>
    <div class="feat-chips" id="featChips">${['24×7 Security','CCTV Surveillance','Fire Safety','Pest Control','Loading Dock','Weighing Scale','Power Backup','Insurance Available'].map(ft=>`<div class="feat-chip ${f.includes(ft)?'selected':''}" onclick="this.classList.toggle('selected')">${ft}</div>`).join('')}</div>
    <div class="form-group" style="margin-top:14px"><label class="form-label">Description</label><textarea class="form-textarea" id="fi_desc" placeholder="Facility details, produce types accepted…">${escHtml(v.description||v.desc||'')}</textarea></div>
    <div class="photo-upload" onclick="document.getElementById('fi_images').click()"><div class="pu-icon">📸</div><div class="pu-text">Upload Facility Photos</div><div class="pu-hint" id="photoHint">Click to upload (max 5)</div></div>
    <div id="imgPreviewGrid" class="img-preview-grid"></div>
    <div class="upload-progress" id="uploadProgress"><div class="upload-bar"><div class="upload-bar-fill" id="uploadBarFill"></div></div><div class="upload-status" id="uploadStatusText">Uploading…</div></div>
  </div>`;
}

// ─── Image handling ──────────────────────────────────────────
function handleImgSelect(input) {
  const newFiles = Array.from(input.files);
  const total    = existingImgUrls.length + pendingImgFiles.length + newFiles.length;
  if (total > 5) { showToast('Max 5 images allowed','warn'); return; }
  pendingImgFiles = [...pendingImgFiles, ...newFiles];
  renderImgPreview();
  const hint = document.getElementById('photoHint');
  if (hint) hint.textContent = `${existingImgUrls.length + pendingImgFiles.length} image(s) selected`;
}

function renderImgPreview() {
  const grid = document.getElementById('imgPreviewGrid');
  if (!grid) return;
  const existingHTML = existingImgUrls.map((url,i) =>
    `<div class="img-prev-item"><img src="${url}" alt="img"><button class="img-prev-del" onclick="removeExistingImg(${i})">✕</button></div>`
  );
  const pendingHTML = pendingImgFiles.map((f,i) => {
    const url = URL.createObjectURL(f);
    return `<div class="img-prev-item"><img src="${url}" alt="img"><button class="img-prev-del" onclick="removePendingImg(${i})">✕</button></div>`;
  });
  grid.innerHTML = [...existingHTML, ...pendingHTML].join('');
}

function removeExistingImg(i) { existingImgUrls.splice(i,1); renderImgPreview(); }
function removePendingImg(i)  { pendingImgFiles.splice(i,1); renderImgPreview(); }

// ─── Upload to Cloudinary via backend ───────────────────────
async function uploadImages() {
  if (!pendingImgFiles.length) return [];
  const prog    = document.getElementById('uploadProgress');
  const bar     = document.getElementById('uploadBarFill');
  const statEl  = document.getElementById('uploadStatusText');
  if (prog) prog.style.display = 'block';
  const urls = [];
  for (let i=0; i<pendingImgFiles.length; i++) {
    if (statEl) statEl.textContent = `Uploading image ${i+1}/${pendingImgFiles.length}…`;
    try {
      const fd = new FormData();
      fd.append('file', pendingImgFiles[i]);
      fd.append('type', 'service');
      const res = await fetch('/api/upload-image', {method:'POST', credentials:'include', body:fd});
      if (res.ok) { const d=await res.json(); if(d.url) urls.push(d.url); }
    } catch(e) {}
    if (bar) bar.style.width = `${((i+1)/pendingImgFiles.length)*100}%`;
  }
  if (statEl) statEl.textContent = `✅ ${urls.length} image(s) uploaded`;
  return urls;
}

// ─── SAVE SERVICE ────────────────────────────────────────────
async function saveService() {
  const type = currentServiceType;
  const name = (document.getElementById('fi_name')?.value||'').trim();
  if (!name) { showToast('Please enter a name','err'); return; }

  const btn = document.getElementById('addModalSaveBtn');
  const origText = btn.textContent;
  btn.innerHTML  = '<span class="spinner"></span>Saving…';
  btn.disabled   = true;

  try {
    // 1. Upload new images first
    const newUrls  = await uploadImages();
    const allUrls  = [...existingImgUrls, ...newUrls];
    const features = [...document.querySelectorAll('#featChips .feat-chip.selected')].map(el=>el.textContent.trim());

    const payload = {
      service_type: type,
      name,
      sub_type:         document.getElementById('fi_sub_type')?.value||'',
      reg_no:           document.getElementById('fi_reg_no')?.value||'',
      model:            document.getElementById('fi_model')?.value||'',
      year:             document.getElementById('fi_year')?.value||null,
      capacity:         document.getElementById('fi_capacity')?.value||'',
      available_space:  document.getElementById('fi_available_space')?.value||'',
      fuel:             document.getElementById('fi_fuel')?.value||'',
      condition:        document.getElementById('fi_condition')?.value||'Good',
      operator:         document.getElementById('fi_operator')?.value||'',
      humidity:         document.getElementById('fi_humidity')?.value||'',
      temp_range:       document.getElementById('fi_temp_range')?.value||'',
      nearest_apmc:     document.getElementById('fi_nearest_apmc')?.value||'',
      routes:           document.getElementById('fi_routes')?.value||'',
      price:            parseFloat(document.getElementById('fi_price')?.value||0),
      per_km:           parseFloat(document.getElementById('fi_per_km')?.value||0),
      min_days:         parseInt(document.getElementById('fi_min_days')?.value||1),
      location:         document.getElementById('fi_location')?.value.trim()||'',
      status:           document.getElementById('fi_status')?.value||'available',
      features:         JSON.stringify(features),
      description:      document.getElementById('fi_desc')?.value.trim()||'',
      image_urls:       JSON.stringify(allUrls)
    };

    // 2. Try backend first
    let savedToBackend = false;
    try {
      const url    = editingId ? `/api/service-listings/${editingId}` : '/api/service-listings';
      const method = editingId ? 'PUT' : 'POST';
      const res    = await fetch(url, {method, credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
      if (res.ok) {
        savedToBackend = true;
        await loadServicesFromDB(); // reload fresh from DB
      }
    } catch(e) {}

    // 3. Fallback: save locally
    if (!savedToBackend) {
      const svc = { ...payload, id: editingId || ('loc_'+Date.now()), created_at: Date.now(), image_urls: allUrls, features };
      if (editingId) {
        const idx = (services[type]||[]).findIndex(x=>x.id==editingId);
        if (idx !== -1) services[type][idx] = svc;
        else services[type].unshift(svc);
      } else {
        if (!services[type]) services[type] = [];
        services[type].unshift(svc);
      }
      saveToLocalStorage(type);
    }

    closeModal('addModal');

    // 4. Refresh all UI — guaranteed fresh data
    updateAllStats();
    updateOverviewCards();
    updateBadges();
    renderList(type);
    renderHomeBookings();
    renderEarnings();

    showToast(editingId ? '✅ Service updated!' : '✅ Service listed successfully!');
  } catch(e) {
    console.error('saveService error:', e);
    showToast('Error saving service: '+e.message, 'err');
  } finally {
    btn.innerHTML = origText;
    btn.disabled  = false;
  }
}

// ─── VIEW SERVICE ─────────────────────────────────────────────
function viewService(type, id) {
  const s = (services[type]||[]).find(x=>x.id==id);
  if (!s) return;
  const ics = {transport:'🚛',equipment:'🚜',storage:'🏭'};
  const pu  = {transport:'per trip',equipment:'per day',storage:'per qtl/day'};
  const imgs = parseImages(s.image_urls);
  document.getElementById('viewModalBody').innerHTML = `
    <div class="view-hero">
      ${imgs[0] ? `<div style="padding:24px;text-align:center"><img src="${imgs[0]}" style="width:100px;height:100px;border-radius:14px;object-fit:cover;border:3px solid rgba(255,255,255,.3)"></div>` : `<div style="font-size:60px;text-align:center;padding:20px 0">${ics[type]}</div>`}
      <div class="vh-name">${escHtml(s.name)}</div>
      <div class="vh-sub">${escHtml(s.sub_type||'')} ${s.location?'· 📍 '+escHtml(s.location):''}</div>
    </div>
    <div class="modal-body">
      <div class="view-detail-grid">
        ${[
          ['Price', `₹${Number(s.price||0).toLocaleString()} ${pu[type]}`],
          ['Status', `<span class="avail-pill ${s.status||'unavailable'}">${s.status||'—'}</span>`],
          ['Capacity', (s.capacity||'—')+(type==='transport'?' ton':type==='storage'?' qtl':'')],
          ['Location', escHtml(s.location||'—')],
          ...(type==='transport'?[['Reg. No.',escHtml(s.reg_no||'—')],['Fuel',escHtml(s.fuel||'—')],['Routes',escHtml(s.routes||'—')],['Per KM','₹'+(s.per_km||0)]]:
             type==='equipment'?[['Model',escHtml(s.model||'—')],['Condition',escHtml(s.condition||'—')],['Min Days',s.min_days||1],['Operator',escHtml(s.operator||'—')]]:
             [['Avail. Space',(s.available_space||'—')+' qtl'],['Min Days',s.min_days||1],['Temp Range',escHtml(s.temp_range||'—')],['Nearest APMC',escHtml(s.nearest_apmc||'—')]])
        ].map(([k,v])=>`<div class="vd-item"><div class="vd-label">${k}</div><div class="vd-val">${v}</div></div>`).join('')}
      </div>
      ${parseFeatures(s.features).length ? `<div style="margin-bottom:14px"><div class="vd-label" style="margin-bottom:8px">FEATURES</div><div style="display:flex;flex-wrap:wrap;gap:6px">${parseFeatures(s.features).map(ft=>`<span style="background:var(--cream);padding:4px 10px;border-radius:8px;font-size:12px;font-weight:600;color:var(--primary-mid)">${escHtml(ft)}</span>`).join('')}</div></div>`:''}
      ${imgs.length>1?`<div class="vd-label" style="margin-bottom:8px">PHOTOS</div><div style="display:flex;gap:8px;flex-wrap:wrap">${imgs.map(u=>`<img src="${u}" style="width:80px;height:80px;object-fit:cover;border-radius:9px;border:2px solid var(--cream-dark)">`).join('')}</div>`:'' }
      ${s.description||s.desc?`<div style="margin-top:14px"><div class="vd-label" style="margin-bottom:6px">DESCRIPTION</div><div style="background:var(--cream);padding:12px;border-radius:9px;font-size:13px;color:var(--text-mid);line-height:1.6">${escHtml(s.description||s.desc)}</div></div>`:''}
    </div>`;
  showModal('viewModal');
}

// ─── DELETE ──────────────────────────────────────────────────
function openDelete(type, id) {
  deletingType = type; deletingId = id;
  const s = (services[type]||[]).find(x=>x.id==id);
  document.getElementById('delBadge').textContent = s?.name||'Service';
  showModal('delModal');
}

async function confirmDelete() {
  const type = deletingType, id = deletingId;
  try { await fetch(`/api/service-listings/${id}`, {method:'DELETE', credentials:'include'}); } catch(e) {}
  services[type] = (services[type]||[]).filter(x=>x.id!=id);
  saveToLocalStorage(type);
  closeModal('delModal');
  updateAllStats(); updateOverviewCards(); updateBadges();
  renderList(type);
  showToast('🗑️ Service removed');
}

// ═══ BOOKINGS ════════════════════════════════════════════════
async function refreshBookings() {
  await loadBookingsFromDB();
  renderBookings(); renderHomeBookings(); updateBadges(); updateAllStats();
  showToast('Bookings refreshed');
}

function filterBookings(status, btn) {
  currentBookingFilter = status;
  document.querySelectorAll('#view-bookings .filter-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderBookings();
}

function renderBookings() {
  const data = currentBookingFilter==='all' ? bookings : bookings.filter(b=>b.status===currentBookingFilter);
  const container = document.getElementById('bookingsList');
  if (!container) return;
  if (!data.length) {
    container.innerHTML = `<div class="empty-state"><div class="es-icon">📋</div><h3>No bookings found</h3><p>Bookings will appear once farmers request your services</p></div>`;
    return;
  }
  const ics = {transport:'🚛',equipment:'🚜',storage:'🏭'};
  container.innerHTML = data.map(b => `
    <div class="booking-card">
      <div class="bc-hd"><span class="bc-id">Booking #${b.id} · ${b.date||''}</span><span class="b-status-pill ${b.status}">${b.status}</span></div>
      <div class="bc-body">
        <div class="bc-icon ${b.service_type||'transport'}">${ics[b.service_type]||'📦'}</div>
        <div class="bc-info">
          <div class="bc-title">${escHtml(b.service_name||'—')}</div>
          <div class="bc-meta">📅 ${b.duration||'—'}${b.location?' · 📍 '+escHtml(b.location):''}${b.notes?'<br><span style=\'color:var(--text-mid);font-size:11px\'>📝 '+escHtml(b.notes)+'</span>':''}</div>
          <div class="bc-customer">👤 ${escHtml(b.customer||'—')}${b.customer_phone?' · 📞 '+b.customer_phone:''}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">
          <div class="bc-amount">₹${Number(b.amount||0).toLocaleString()}</div>
          <div style="display:flex;gap:6px">${getBookingActions(b)}</div>
        </div>
      </div>
    </div>`).join('');
}

function getBookingActions(b) {
  switch(b.status) {
    case 'pending':   return `<button class="action-btn accept" onclick="updateBooking('${b.id}','accepted')">✅ Accept</button><button class="action-btn reject" onclick="updateBooking('${b.id}','rejected')">❌ Reject</button>`;
    case 'accepted':  return `<button class="action-btn dispatch" onclick="updateBooking('${b.id}','active')">🚀 Mark Active</button>`;
    case 'active':    return `<button class="action-btn complete" onclick="updateBooking('${b.id}','completed')">🎉 Complete</button>`;
    case 'completed': return `<span style="font-size:12px;color:#065f46;font-weight:700">🎉 Completed</span>`;
    case 'rejected':  return `<span style="font-size:12px;color:var(--red);font-weight:700">❌ Rejected</span>`;
    default: return '';
  }
}

async function updateBooking(id, status) {
  const numId = parseInt(id);
  const b = bookings.find(x => x.id == numId);
  if (!b) return;
  try {
    const res = await fetch('/api/service-bookings/' + numId + '/status', {
      method: 'PUT', credentials: 'include',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({status})
    });
    if (res.ok) {
      b.status = status;
      renderBookings(); renderHomeBookings(); renderSchedule(); updateBadges(); updateAllStats(); renderEarnings();
      const msgs = {accepted:'✅ Booking accepted! Farmer notified.',rejected:'❌ Booking rejected.',active:'🚀 Marked active!',completed:'🎉 Job completed!'};
      showToast(msgs[status]||'Updated');
    } else {
      const d = await res.json(); showToast(d.error||'Update failed','err');
    }
  } catch(e) { showToast('Network error','err'); }
}

function renderHomeBookings() {
  const container = document.getElementById('homeRecentBookings');
  if (!container) return;
  const recent = [...bookings].sort((a,b)=>(b.created||0)-(a.created||0)).slice(0,5);
  if (!recent.length) {
    container.innerHTML = `<div style="text-align:center;padding:36px;color:var(--text-light)"><div style="font-size:44px;opacity:.35;margin-bottom:10px">📋</div>No bookings yet</div>`;
    return;
  }
  const ics = {transport:'🚛',equipment:'🚜',storage:'🏭'};
  container.innerHTML = `<table class="srv-table"><thead><tr><th>Service</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead><tbody>
  ${recent.map(b=>`<tr>
    <td><div class="cell-img"><div class="cell-thumb" style="font-size:18px">${ics[b.service_type]||'📦'}</div><div><div class="cell-title">${escHtml(b.service_name||'—')}</div><div class="cell-sub">#${b.id}</div></div></div></td>
    <td style="font-size:12.5px;color:var(--text-mid)">${escHtml(b.customer||'—')}</td>
    <td><div class="price-cell" style="font-size:13px">₹${Number(b.amount||0).toLocaleString()}</div></td>
    <td><span class="b-status-pill ${b.status}">${b.status}</span></td>
  </tr>`).join('')}</tbody></table>`;
}


function renderSchedule() {
  const container = document.getElementById('scheduleList');
  if (!container) return;

  const ics = { transport: '🚛', equipment: '🚜', storage: '🏭' };
  const typeLabel = { transport: 'Transport', equipment: 'Equipment', storage: 'Storage' };

  // Show accepted + active bookings that have a booking_date, sorted by date
  const upcoming = bookings
    .filter(b => ['accepted', 'active'].includes(b.status) && b.raw_date)
    .sort((a, b) => new Date(a.raw_date) - new Date(b.raw_date))
    .slice(0, 5);

  if (!upcoming.length) {
    container.innerHTML = `<div style="text-align:center;padding:36px;color:var(--text-light)"><div style="font-size:40px;opacity:.35;margin-bottom:8px">📅</div>No upcoming bookings</div>`;
    return;
  }

  container.innerHTML = upcoming.map(b => {
    const dateObj = new Date(b.raw_date);
    const day = dateObj.getDate();
    const mon = dateObj.toLocaleString('en-IN', { month: 'short' }).toUpperCase();
    const type = b.service_type || 'transport';
    return `
      <div class="schedule-item">
        <div class="sch-date">
          <div class="sd-day">${day}</div>
          <div class="sd-mon">${mon}</div>
        </div>
        <div class="sch-info">
          <div class="si-title">${ics[type] || '📦'} ${escHtml(b.service_name || '—')}</div>
          <div class="si-sub">${escHtml(b.customer || '—')}${b.location ? ' · 📍 ' + escHtml(b.location) : ''}</div>
        </div>
        <span class="sch-chip ${type}">${typeLabel[type] || type}</span>
      </div>`;
  }).join('');
}


// ═══ EARNINGS ════════════════════════════════════════════════
function renderEarnings() {
  const done  = bookings.filter(b=>b.status==='completed');
  const total = done.reduce((s,b)=>s+parseFloat(b.amount||0), 0);
  const byT   = done.filter(b=>b.service_type==='transport').reduce((s,b)=>s+parseFloat(b.amount||0), 0);
  const byE   = done.filter(b=>b.service_type==='equipment').reduce((s,b)=>s+parseFloat(b.amount||0), 0);
  const byS   = done.filter(b=>b.service_type==='storage').reduce((s,b)=>s+parseFloat(b.amount||0), 0);
  setText('earn-total',    '₹'+total.toLocaleString('en-IN'));
  setText('earn-transport','₹'+byT.toLocaleString('en-IN'));
  setText('earn-equip',   '₹'+byE.toLocaleString('en-IN'));
  setText('earn-storage', '₹'+byS.toLocaleString('en-IN'));
  const el = document.getElementById('topServices');
  if (!el) return;
  const allSvcs = Object.values(services).flat();
  const tops    = allSvcs.map(s=>{
    const type = ['transport','equipment','storage'].find(t=>(services[t]||[]).includes(s))||'transport';
    const rev  = done.filter(b=>b.service_id==s.id).reduce((x,b)=>x+parseFloat(b.amount||0),0);
    return {...s, revenue:rev, type};
  }).filter(s=>s.revenue>0).sort((a,b)=>b.revenue-a.revenue).slice(0,5);
  const ics = {transport:'🚛',equipment:'🚜',storage:'🏭'};
  el.innerHTML = tops.length ? tops.map((s,i)=>`
    <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:${i<tops.length-1?'1px solid var(--cream-dark)':'none'}">
      <div style="width:32px;height:32px;border-radius:9px;background:var(--cream);display:grid;place-items:center;font-size:16px">${ics[s.type]}</div>
      <div style="flex:1"><div style="font-size:13.5px;font-weight:700">${escHtml(s.name)}</div><div style="font-size:11px;color:var(--text-light)">${escHtml(s.sub_type||s.type)}</div></div>
      <div style="font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:var(--primary)">₹${s.revenue.toLocaleString('en-IN')}</div>
    </div>`).join('')
  : `<div style="text-align:center;padding:30px;color:var(--text-light)">Complete bookings to see top performers</div>`;
}

function renderRevChart() {
  const bars = document.getElementById('revBars');
  if (!bars) return;

  // Build last 6 calendar months ending with the current month
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: d.toLocaleString('en-IN', { month: 'short' }), year: d.getFullYear(), month: d.getMonth() });
  }

  // Aggregate real completed booking revenue per calendar month
  const data = months.map(m =>
    bookings
      .filter(b => {
        if (b.status !== 'completed') return false;
        const d = new Date(b.created || 0);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      })
      .reduce((sum, b) => sum + parseFloat(b.amount || 0), 0)
  );

  const maxVal = Math.max(...data, 1); // avoid divide-by-zero when no data

  bars.innerHTML = data.map((d, i) => `
    <div class="rev-bar-wrap">
      <div class="rev-bar total"
           style="height:${d > 0 ? Math.round((d / maxVal) * 70) + 10 : 2}px"
           title="₹${Math.round(d).toLocaleString('en-IN')}">
      </div>
      <div class="rev-label">${months[i].label}</div>
    </div>`).join('');
}

// ═══ NOTIFICATIONS ═══════════════════════════════════════════
async function loadNotifications() {
  try {
    const res  = await fetch('/api/notifications',{credentials:'include'});
    if (!res.ok) return;
    const data = await res.json();
    const badge= document.getElementById('navBadge');
    const unread = data.filter(n=>!n.is_read).length;
    if (badge) { badge.textContent=unread; badge.style.display=unread?'grid':'none'; }
    const list = document.getElementById('notifList');
    if (!list) return;
    if (!data.length) { list.innerHTML='<div style="text-align:center;padding:24px;color:var(--text-light)">🔔 No notifications</div>'; return; }
    list.innerHTML = data.map(n=>`
      <div class="notif-item" style="${!n.is_read?'background:rgba(82,183,136,.06)':''}">
        <div class="ndot ${n.type||'info'}"></div>
        <div><div class="ntext">${escHtml(n.message)}</div><div class="ntime">${timeAgo(new Date(n.created_at))}</div></div>
      </div>`).join('');
  } catch(e) {}
}

async function markAllRead() {
  await fetch('/api/notifications/mark-read',{method:'POST',credentials:'include'});
  loadNotifications();
}

function timeAgo(date) {
  const s=Math.floor((Date.now()-date.getTime())/1000);
  if(s<60)return'Just now';if(s<3600)return`${Math.floor(s/60)}m ago`;
  if(s<86400)return`${Math.floor(s/3600)}h ago`;return`${Math.floor(s/86400)}d ago`;
}

// ═══ SETTINGS ════════════════════════════════════════════════
function openSettings() {
  document.getElementById('settingsOverlay').classList.add('open');
  closeProfile();
  const emailEl = document.getElementById('s-display-email');
  if (emailEl && userData.email) emailEl.textContent = userData.email;
}
function closeSettings() { document.getElementById('settingsOverlay').classList.remove('open'); }
function handleSettingsOverlayClick(e) { if(e.target===document.getElementById('settingsOverlay')) closeSettings(); }

async function changePassword() {
  const cur  = document.getElementById('s_cur_pass').value;
  const nw   = document.getElementById('s_new_pass').value;
  const conf = document.getElementById('s_conf_pass').value;
  if (!cur || !nw) { showToast('Fill in all password fields','err'); return; }
  if (nw !== conf)  { showToast('Passwords do not match','err'); return; }
  try {
    const res  = await fetch('/api/change-password',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({current_password:cur,new_password:nw,confirm_password:conf})});
    const data = await res.json();
    if (res.ok) {
      showToast('🔒 Password updated!');
      document.getElementById('s_cur_pass').value='';
      document.getElementById('s_new_pass').value='';
      document.getElementById('s_conf_pass').value='';
      ['pwb1','pwb2','pwb3','pwb4'].forEach(id=>{const el=document.getElementById(id);if(el)el.className='pw-bar';});
    } else { showToast(data.error||'Failed','err'); }
  } catch(e) { showToast('Network error','err'); }
}

function checkPwStrength(pw) {
  const ids=['pwb1','pwb2','pwb3','pwb4'];
  ids.forEach(id=>{const el=document.getElementById(id);if(el)el.className='pw-bar';});
  const lbl = document.getElementById('pwLabel');
  if (!pw) { if(lbl) { lbl.textContent='Enter password to check strength'; lbl.style.color='var(--text-light)'; } return; }
  let score=0;
  if(pw.length>=8)score++;if(/[A-Z]/.test(pw))score++;if(/\d/.test(pw))score++;if(/[@$!%*?&]/.test(pw))score++;
  const cls   = score<=1?'fill-weak':score<=2?'fill-mid':'fill-strong';
  const label = score<=1?'Weak':score<=2?'Medium':score<=3?'Strong':'Very Strong';
  const color = score<=1?'#ef4444':score<=2?'var(--amber)':'#22c55e';
  for(let i=0;i<score;i++){const el=document.getElementById(ids[i]);if(el)el.classList.add(cls);}
  if(lbl){lbl.textContent=label;lbl.style.color=color;}
}

function toggleDeleteConfirm() { document.getElementById('delAccConfirm').classList.toggle('show'); }

async function deleteAccount() {
  const pw = document.getElementById('s_del_pass').value;
  if (!pw) { showToast('Enter your password','err'); return; }
  try {
    const res  = await fetch('/api/account',{method:'DELETE',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});
    const data = await res.json();
    if (res.ok) { showToast('Account deleted. Redirecting…'); setTimeout(()=>window.location.href='/login',2000); }
    else showToast(data.error||'Failed to delete','err');
  } catch(e) { showToast('Network error','err'); }
}

// ═══ UI HELPERS ══════════════════════════════════════════════
function toggleNotif()  { document.getElementById('notifWrap').classList.toggle('open'); document.getElementById('profileWrap').classList.remove('open'); }
function toggleProfile(){ document.getElementById('profileWrap').classList.toggle('open'); document.getElementById('notifWrap').classList.remove('open'); }
function closeProfile() { document.getElementById('profileWrap').classList.remove('open'); }
function showModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if(e.target===o) o.classList.remove('active'); });
});

function showToast(msg, type='') {
  const w = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' '+type : '');
  t.textContent = msg;
  w.appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(), 300); }, 3000);
}