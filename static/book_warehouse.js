let allStorage = [];
let currentType = 'all';
let selectedStore = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadUser();
  await loadStorage();
  await loadHistory();
  document.getElementById('sk_start').min = new Date().toISOString().split('T')[0];
});

async function loadUser() {
  try {
    const res = await fetch('/api/user',{credentials:'include'});
    if (!res.ok){ window.location.href='/login'; return; }
    const u = await res.json();
    const name = u.name||'Farmer';
    const initials = name.split(' ').map(n=>n[0]).join('').toUpperCase();
    if (u.profile_img) document.getElementById('navAvatar').innerHTML=`<img src="${u.profile_img}" alt="${name}">`;
    else document.getElementById('navInitials').textContent=initials;
  } catch(e){ window.location.href='/login'; }
}

async function loadStorage() {
  try {
    const res = await fetch('/api/service-listings/public?type=storage',{credentials:'include'});
    allStorage = res.ok ? await res.json() : [];
  } catch(e){ allStorage=[]; }

  const avail = allStorage.filter(s=>s.status==='available');
  const totalCap = allStorage.reduce((sum,s)=>sum+parseInt(s.capacity||0),0);
  document.getElementById('heroTotal').textContent = allStorage.length;
  document.getElementById('heroAvail').textContent = avail.length;
  document.getElementById('heroCap').textContent = totalCap.toLocaleString('en-IN');
  applyFilters();
}

function setType(type, btn) {
  currentType = type;
  document.querySelectorAll('.type-chip').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  applyFilters();
}

function applyFilters() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const sort   = document.getElementById('sortSel').value;
  let data = allStorage.filter(s => {
    const mt = currentType==='all' || s.sub_type===currentType;
    const ms = !search || (s.name||'').toLowerCase().includes(search) ||
               (s.location||'').toLowerCase().includes(search) ||
               (s.nearest_apmc||'').toLowerCase().includes(search);
    return mt && ms;
  });
  if (sort==='price-low')           data.sort((a,b)=>a.price-b.price);
  else if (sort==='price-high')     data.sort((a,b)=>b.price-a.price);
  else if (sort==='capacity-high')  data.sort((a,b)=>parseInt(b.capacity||0)-parseInt(a.capacity||0));
  else data.sort((a,b)=>(b.created_at||0)-(a.created_at||0));
  document.getElementById('resultsCount').textContent=`${data.length} facilit${data.length!==1?'ies':'y'}`;
  renderStorage(data);
}

function renderStorage(data) {
  const grid = document.getElementById('storageGrid');
  if (!data.length) {
    grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">🏭</div>
      <div class="empty-title">No facilities found</div>
      <div class="empty-sub">No storage facilities match your search.<br>Try a different type or check back later.</div>
    </div>`;
    return;
  }
  grid.innerHTML = data.map(s => {
    const imgs = parseImages(s.image_urls);
    const features = parseFeatures(s.features).slice(0,3);
    const isAvail = s.status==='available';
    const totalCap = parseInt(s.capacity||0);
    const availCap = parseInt(s.available_space||totalCap);
    const usedPct  = totalCap > 0 ? Math.round(((totalCap-availCap)/totalCap)*100) : 0;
    const providerName = [s.first_name,s.last_name].filter(Boolean).join(' ')||'Provider';
    const providerInitials = providerName.split(' ').map(n=>n[0]).join('').toUpperCase();
    return `<div class="storage-card" onclick="openStoreModal('${s.id}')">
      <div class="sc-image">
        ${imgs[0]?`<img src="${imgs[0]}" alt="${s.name}"/>`:'🏭'}
        <span class="sc-type-badge">${s.sub_type||'Storage'}</span>
        <div class="sc-status"><div class="sc-status-dot ${s.status}"></div><span class="sc-status-txt">${s.status}</span></div>
      </div>
      <div class="sc-body">
        <div class="provider-row">
          <div class="provider-avatar">${providerInitials}</div>
          <div><div class="provider-name">${providerName}</div><div class="provider-loc">📍 ${s.location||'—'}</div></div>
        </div>
        <div class="sc-name">${s.name}</div>
        <div class="sc-sub">${s.temp_range?`🌡️ ${s.temp_range} · `:''}${s.nearest_apmc?`🏪 Near ${s.nearest_apmc}`:''}</div>
        <div class="cap-bar-wrap">
          <div class="cap-bar-lbl"><span>Capacity Used</span><span>${availCap} qtl free of ${totalCap} qtl</span></div>
          <div class="cap-bar"><div class="cap-bar-fill" style="width:${usedPct}%"></div></div>
        </div>
        ${features.length?`<div class="features-row">${features.map(f=>`<span class="feat-tag">${f}</span>`).join('')}</div>`:''}
        <div class="sc-specs">
          <div class="spec-item"><div class="spec-lbl">Total Cap.</div><div class="spec-val">${totalCap} qtl</div></div>
          <div class="spec-item"><div class="spec-lbl">Available</div><div class="spec-val">${availCap} qtl</div></div>
          <div class="spec-item"><div class="spec-lbl">Min. Days</div><div class="spec-val">${s.min_days||1}d</div></div>
        </div>
        <div class="sc-footer">
          <div><div class="sc-price">₹${Number(s.price||0).toLocaleString('en-IN')}</div><div class="sc-price-unit">per qtl/day</div></div>
          <button class="btn-store" ${!isAvail?'disabled':''} onclick="event.stopPropagation();openStoreModal('${s.id}')">
            ${isAvail?'📋 Book Now':'⛔ Unavailable'}
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openStoreModal(id) {
  const s = allStorage.find(x=>x.id==id);
  if (!s || s.status!=='available') { showToast('This facility is not available','err'); return; }
  selectedStore = s;
  const imgs = parseImages(s.image_urls);
  document.getElementById('modalStoreInfo').innerHTML=`
    <div class="msi-icon">${imgs[0]?`<img src="${imgs[0]}" alt="${s.name}">`:'🏭'}</div>
    <div>
      <div class="msi-name">${s.name}</div>
      <div class="msi-sub">${s.sub_type||''} · 📍 ${s.location||'—'} · ${s.available_space||s.capacity||'—'} qtl free</div>
      <div class="msi-price">₹${Number(s.price||0).toLocaleString('en-IN')} <span style="font-size:12px;color:var(--text-mid);font-family:'DM Sans',sans-serif">per qtl/day</span></div>
    </div>`;
  document.getElementById('costPreview').style.display='none';
  document.getElementById('storeModal').classList.add('active');
}

function closeModal() {
  document.getElementById('storeModal').classList.remove('active');
  selectedStore=null;
}
document.querySelector('.modal-overlay').addEventListener('click',e=>{if(e.target===document.querySelector('.modal-overlay'))closeModal();});

function calcCost() {
  if (!selectedStore) return;
  const days = parseInt(document.getElementById('sk_days').value||0);
  const qty  = parseFloat(document.getElementById('sk_qty').value||0);
  const preview = document.getElementById('costPreview');
  if (days && qty) {
    const total = days * qty * (selectedStore.price||0);
    preview.style.display='block';
    preview.innerHTML=`🧮 ${qty} qtl × ${days} days × ₹${selectedStore.price}/qtl/day = <b>₹${total.toLocaleString('en-IN')}</b> estimated total`;
  } else { preview.style.display='none'; }
}

async function submitStorage() {
  if (!selectedStore) return;
  const start   = document.getElementById('sk_start').value;
  const days    = document.getElementById('sk_days').value;
  const qty     = document.getElementById('sk_qty').value;
  const produce = document.getElementById('sk_produce').value.trim();
  if (!start)   { showToast('Please select check-in date','err'); return; }
  if (!days)    { showToast('Please select duration','err'); return; }
  if (!qty||qty<1) { showToast('Please enter quantity','err'); return; }
  if (!produce) { showToast('Please enter produce type','err'); return; }

  const total = parseInt(days)*parseFloat(qty)*(selectedStore.price||0);
  const btn   = document.getElementById('submitBtn');
  btn.textContent='⏳ Submitting…'; btn.disabled=true;

  try {
    const notes=[produce, document.getElementById('sk_notes').value].filter(Boolean).join(' | ');
    const res=await fetch('/api/service-bookings',{
      method:'POST',credentials:'include',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        listing_id:   selectedStore.id,
        booking_date: start,
        duration_days: parseInt(days),
        quantity:     parseFloat(qty),
        location:     selectedStore.location,
        notes, amount: total
      })
    });
    if (res.ok) {
      closeModal();
      showToast('✅ Storage booking request sent!','success');
      await loadHistory();
      ['sk_start','sk_days','sk_qty','sk_produce','sk_notes'].forEach(id=>{document.getElementById(id).value='';});
    } else { const d=await res.json(); showToast(d.error||'Failed','err'); }
  } catch(e){ showToast('Network error','err'); }
  btn.textContent='🏭 Send Booking Request'; btn.disabled=false;
}

async function loadHistory() {
  try {
    const res=await fetch('/api/my-service-bookings?type=storage',{credentials:'include'});
    renderHistory(res.ok?await res.json():[]);
  } catch(e){ renderHistory([]); }
}

function renderHistory(bookings) {
  const body=document.getElementById('historyBody');
  document.getElementById('historyCount').textContent=`${bookings.length} booking${bookings.length!==1?'s':''}`;
  if (!bookings.length) {
    body.innerHTML=`<div class="empty-state" style="padding:40px"><div class="empty-icon" style="font-size:48px">📋</div><div class="empty-title" style="font-size:16px">No bookings yet</div><div class="empty-sub">Your storage booking history will appear here</div></div>`;
    return;
  }
  body.innerHTML=`<table class="h-table"><thead><tr><th>Facility</th><th>Check-in</th><th>Duration</th><th>Qty (qtl)</th><th>Amount</th><th>Status</th></tr></thead><tbody>${bookings.map(b=>`<tr>
    <td><b>${b.service_name||'Facility'}</b><br><span style="font-size:11px;color:var(--text-light)">#${b.id}</span></td>
    <td>${b.booking_date?new Date(b.booking_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):'—'}</td>
    <td>${b.duration_days||'—'} days</td>
    <td>${b.quantity||'—'}</td>
    <td><b>₹${Number(b.amount||0).toLocaleString('en-IN')}</b></td>
    <td><span class="status-pill ${b.status||'pending'}">${b.status||'pending'}</span></td>
  </tr>`).join('')}</tbody></table>`;
}

function parseImages(u){if(!u)return[];if(Array.isArray(u))return u;try{return JSON.parse(u);}catch(e){return u.split(',').filter(Boolean);}}
function parseFeatures(f){if(!f)return[];if(Array.isArray(f))return f;try{return JSON.parse(f);}catch(e){return f.split(',').filter(Boolean);}}
function showToast(msg,type=''){const w=document.getElementById('toastWrap');const t=document.createElement('div');t.className='toast'+(type?' '+type:'');t.textContent=msg;w.appendChild(t);requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},3500);}