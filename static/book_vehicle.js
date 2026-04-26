let allVehicles = [];
let currentType = 'all';
let selectedVehicle = null;

// ── INIT ──────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadUser();
  await loadVehicles();
  await loadHistory();
  // Set min date for booking to today
  document.getElementById('bk_date').min = new Date().toISOString().split('T')[0];
});

// ── USER ──────────────────────────────────
async function loadUser() {
  try {
    const res = await fetch('/api/user', {credentials:'include'});
    if (!res.ok) { window.location.href='/login'; return; }
    const u = await res.json();
    const name = u.name || 'Farmer';
    const initials = name.split(' ').map(n=>n[0]).join('').toUpperCase();
    if (u.profile_img) {
      document.getElementById('navAvatar').innerHTML = `<img src="${u.profile_img}" alt="${name}">`;
    } else {
      document.getElementById('navInitials').textContent = initials;
    }
  } catch(e) { window.location.href='/login'; }
}

// ── LOAD VEHICLES ─────────────────────────
async function loadVehicles() {
  try {
    const res = await fetch('/api/service-listings/public?type=transport', {credentials:'include'});
    if (res.ok) {
      allVehicles = await res.json();
    } else {
      allVehicles = [];
    }
  } catch(e) {
    allVehicles = [];
  }
  // Update hero stats
  const avail = allVehicles.filter(v=>v.status==='available');
  const providers = [...new Set(allVehicles.map(v=>v.user_id))];
  document.getElementById('heroTotal').textContent = allVehicles.length;
  document.getElementById('heroAvail').textContent = avail.length;
  document.getElementById('heroProviders').textContent = providers.length;
  applyFilters();
}

// ── FILTERS ───────────────────────────────
function setType(type, btn) {
  currentType = type;
  document.querySelectorAll('.type-chip').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  applyFilters();
}

function applyFilters() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const sort   = document.getElementById('sortSel').value;

  let data = allVehicles.filter(v => {
    const mt = currentType==='all' || v.sub_type===currentType;
    const ms = !search || (v.name||'').toLowerCase().includes(search) ||
               (v.location||'').toLowerCase().includes(search) ||
               (v.routes||'').toLowerCase().includes(search);
    return mt && ms;
  });

  if (sort==='price-low')       data.sort((a,b)=>a.price-b.price);
  else if (sort==='price-high') data.sort((a,b)=>b.price-a.price);
  else if (sort==='capacity-high') data.sort((a,b)=>parseFloat(b.capacity||0)-parseFloat(a.capacity||0));
  else data.sort((a,b)=>(b.created_at||0)-(a.created_at||0));

  document.getElementById('resultsCount').textContent = `${data.length} vehicle${data.length!==1?'s':''}`;
  renderVehicles(data);
}

// ── RENDER VEHICLES ───────────────────────
function renderVehicles(data) {
  const grid = document.getElementById('vehiclesGrid');
  if (!data.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">🚛</div>
      <div class="empty-title">No vehicles found</div>
      <div class="empty-sub">No transport vehicles match your search or filter.<br>Try adjusting your criteria or check back later.</div>
    </div>`;
    return;
  }

  grid.innerHTML = data.map(v => {
    const imgs = parseImages(v.image_urls);
    const firstImg = imgs[0];
    const features = parseFeatures(v.features).slice(0,3);
    const isAvail = v.status === 'available';
    const providerName = [v.first_name, v.last_name].filter(Boolean).join(' ') || 'Provider';
    const providerInitials = providerName.split(' ').map(n=>n[0]).join('').toUpperCase();

    return `<div class="vehicle-card" onclick="openBookModal('${v.id}')">
      <div class="vc-image">
        ${firstImg ? `<img src="${firstImg}" alt="${v.name}"/>` : '🚛'}
        <span class="vc-type-badge">${v.sub_type||'Vehicle'}</span>
        <div class="vc-status-dot">
          <div class="vsd-circle ${v.status}"></div>
          <span class="vsd-txt">${v.status}</span>
        </div>
      </div>
      <div class="vc-body">
        <div class="provider-row">
          <div class="provider-avatar">${providerInitials}</div>
          <div><div class="provider-name">${providerName}</div><div class="provider-loc">📍 ${v.location||'—'}</div></div>
        </div>
        <div class="vc-name">${v.name}</div>
        <div class="vc-sub">🏷️ ${v.reg_no||'No reg'} · ⛽ ${v.fuel||'Diesel'}</div>
        ${features.length ? `<div class="features-row">${features.map(f=>`<span class="feat-tag">${f}</span>`).join('')}</div>` : ''}
        <div class="vc-specs">
          <div class="spec-item"><div class="spec-lbl">Capacity</div><div class="spec-val">${v.capacity||'—'} ton</div></div>
          <div class="spec-item"><div class="spec-lbl">Routes</div><div class="spec-val" style="font-size:11px">${(v.routes||'Any route').substring(0,20)}</div></div>
        </div>
        <div class="vc-footer">
          <div><div class="vc-price">₹${Number(v.price||0).toLocaleString('en-IN')}</div><div class="vc-price-unit">per trip</div></div>
          <button class="btn-book" ${!isAvail?'disabled':''} onclick="event.stopPropagation();openBookModal('${v.id}')">
            ${isAvail ? '📋 Book Now' : '⛔ Unavailable'}
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── BOOKING MODAL ─────────────────────────
function openBookModal(id) {
  const v = allVehicles.find(x=>x.id==id);
  if (!v || v.status !== 'available') { showToast('This vehicle is not available','err'); return; }
  selectedVehicle = v;
  const imgs = parseImages(v.image_urls);
  document.getElementById('modalVehicleInfo').innerHTML = `
    <div class="mvi-icon">${imgs[0]?`<img src="${imgs[0]}" alt="${v.name}">`:'🚛'}</div>
    <div>
      <div class="mvi-name">${v.name}</div>
      <div class="mvi-sub">${v.sub_type||''} · 📍 ${v.location||'—'} · ⚡ ${v.capacity||'—'} ton</div>
      <div class="mvi-price">₹${Number(v.price||0).toLocaleString('en-IN')} <span style="font-size:12px;color:var(--text-light);font-family:'DM Sans',sans-serif">per trip</span></div>
    </div>`;
  document.getElementById('bookModal').classList.add('active');
}

function closeModal() {
  document.getElementById('bookModal').classList.remove('active');
  selectedVehicle = null;
}

document.querySelector('.modal-overlay').addEventListener('click', e => {
  if (e.target === document.querySelector('.modal-overlay')) closeModal();
});

async function submitBooking() {
  if (!selectedVehicle) return;
  const date    = document.getElementById('bk_date').value;
  const pickup  = document.getElementById('bk_pickup').value.trim();
  const drop    = document.getElementById('bk_drop').value.trim();
  const qty     = document.getElementById('bk_qty').value;
  const notes   = document.getElementById('bk_notes').value.trim();

  if (!date)   { showToast('Please select a trip date','err'); return; }
  if (!pickup) { showToast('Please enter pickup location','err'); return; }
  if (!drop)   { showToast('Please enter drop-off destination','err'); return; }

  const btn = document.getElementById('submitBtn');
  btn.textContent = '⏳ Submitting…';
  btn.disabled = true;

  try {
    const res = await fetch('/api/service-bookings', {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        listing_id:   selectedVehicle.id,
        booking_date: date,
        quantity:     qty || 1,
        location:     `${pickup} → ${drop}`,
        notes:        notes,
        amount:       selectedVehicle.price
      })
    });
    if (res.ok) {
      closeModal();
      showToast('✅ Booking request sent! Provider will confirm soon.', 'success');
      await loadHistory();
      // Clear form
      ['bk_date','bk_pickup','bk_drop','bk_qty','bk_notes'].forEach(id => {
        document.getElementById(id).value = '';
      });
    } else {
      const data = await res.json();
      showToast(data.error||'Failed to book','err');
    }
  } catch(e) {
    showToast('Network error. Please try again.','err');
  }
  btn.textContent = '🚛 Send Booking Request';
  btn.disabled = false;
}

// ── HISTORY ───────────────────────────────
async function loadHistory() {
  try {
    const res = await fetch('/api/my-service-bookings?type=transport', {credentials:'include'});
    if (res.ok) {
      const data = await res.json();
      renderHistory(data);
    } else {
      renderHistory([]);
    }
  } catch(e) {
    renderHistory([]);
  }
}

function renderHistory(bookings) {
  const body = document.getElementById('historyBody');
  document.getElementById('historyCount').textContent = `${bookings.length} booking${bookings.length!==1?'s':''}`;
  if (!bookings.length) {
    body.innerHTML = `<div class="empty-state" style="padding:40px"><div class="empty-icon" style="font-size:48px">📋</div><div class="empty-title" style="font-size:16px">No bookings yet</div><div class="empty-sub">Your vehicle booking history will appear here</div></div>`;
    return;
  }
  body.innerHTML = `<table class="h-table"><thead><tr>
    <th>Vehicle</th><th>Date</th><th>Route</th><th>Amount</th><th>Status</th>
  </tr></thead><tbody>${bookings.map(b=>`<tr>
    <td><b>${b.service_name||'Vehicle'}</b><br><span style="font-size:11px;color:var(--text-light)">#${b.id}</span></td>
    <td>${b.booking_date ? new Date(b.booking_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'}</td>
    <td style="font-size:12px;color:var(--text-mid);max-width:160px">${b.location||'—'}</td>
    <td><b>₹${Number(b.amount||0).toLocaleString('en-IN')}</b></td>
    <td><span class="status-pill ${b.status||'pending'}">${b.status||'pending'}</span></td>
  </tr>`).join('')}</tbody></table>`;
}

// ── HELPERS ───────────────────────────────
function parseImages(imgUrls) {
  if (!imgUrls) return [];
  if (Array.isArray(imgUrls)) return imgUrls;
  try { return JSON.parse(imgUrls); } catch(e) { return imgUrls.split(',').filter(Boolean); }
}
function parseFeatures(f) {
  if (!f) return [];
  if (Array.isArray(f)) return f;
  try { return JSON.parse(f); } catch(e) { return f.split(',').filter(Boolean); }
}
function showToast(msg, type='') {
  const w = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' '+type : '');
  t.textContent = msg;
  w.appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  setTimeout(()=>{t.classList.remove('show'); setTimeout(()=>t.remove(),300);}, 3500);
}