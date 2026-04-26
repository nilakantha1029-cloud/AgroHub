let allEquipment = [];
let currentType = 'all';
let selectedEquip = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadUser();
  await loadEquipment();
  await loadHistory();
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('rk_start').min = today;
  document.getElementById('rk_end').min   = today;
});

async function loadUser() {
  try {
    const res = await fetch('/api/user', {credentials:'include'});
    if (!res.ok) { window.location.href='/login'; return; }
    const u = await res.json();
    const name = u.name||'Farmer';
    const initials = name.split(' ').map(n=>n[0]).join('').toUpperCase();
    if (u.profile_img) document.getElementById('navAvatar').innerHTML=`<img src="${u.profile_img}" alt="${name}">`;
    else document.getElementById('navInitials').textContent=initials;
  } catch(e){ window.location.href='/login'; }
}

async function loadEquipment() {
  try {
    const res = await fetch('/api/service-listings/public?type=equipment', {credentials:'include'});
    allEquipment = res.ok ? await res.json() : [];
  } catch(e){ allEquipment=[]; }

  const avail = allEquipment.filter(e=>e.status==='available');
  const providers = [...new Set(allEquipment.map(e=>e.user_id))];
  document.getElementById('heroTotal').textContent = allEquipment.length;
  document.getElementById('heroAvail').textContent = avail.length;
  document.getElementById('heroProviders').textContent = providers.length;
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
  let data = allEquipment.filter(e => {
    const mt = currentType==='all' || e.sub_type===currentType;
    const ms = !search || (e.name||'').toLowerCase().includes(search) ||
               (e.model||'').toLowerCase().includes(search) ||
               (e.location||'').toLowerCase().includes(search);
    return mt && ms;
  });
  if (sort==='price-low')       data.sort((a,b)=>a.price-b.price);
  else if (sort==='price-high') data.sort((a,b)=>b.price-a.price);
  else data.sort((a,b)=>(b.created_at||0)-(a.created_at||0));
  document.getElementById('resultsCount').textContent = `${data.length} item${data.length!==1?'s':''}`;
  renderEquipment(data);
}

function condClass(c) {
  return c==='Excellent'?'excellent':c==='Good'?'good':'fair';
}

function renderEquipment(data) {
  const grid = document.getElementById('equipGrid');
  if (!data.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">🚜</div>
      <div class="empty-title">No equipment found</div>
      <div class="empty-sub">No equipment matches your search.<br>Try a different category or check back later.</div>
    </div>`;
    return;
  }
  grid.innerHTML = data.map(e => {
    const imgs = parseImages(e.image_urls);
    const features = parseFeatures(e.features).slice(0,3);
    const isAvail = e.status==='available';
    const providerName = [e.first_name,e.last_name].filter(Boolean).join(' ')||'Provider';
    const providerInitials = providerName.split(' ').map(n=>n[0]).join('').toUpperCase();
    return `<div class="equip-card" onclick="openRentModal('${e.id}')">
      <div class="ec-image">
        ${imgs[0]?`<img src="${imgs[0]}" alt="${e.name}"/>`:'🚜'}
        <span class="ec-type-badge">${e.sub_type||'Equipment'}</span>
        <div class="ec-status"><div class="ec-status-dot ${e.status}"></div><span class="ec-status-txt">${e.status}</span></div>
      </div>
      <div class="ec-body">
        <div class="provider-row">
          <div class="provider-avatar">${providerInitials}</div>
          <div><div class="provider-name">${providerName}</div><div class="provider-loc">📍 ${e.location||'—'}</div></div>
        </div>
        <div class="ec-name">${e.name}</div>
        <div class="ec-sub">
          ${e.model?`🏷️ ${e.model} · `:''}
          ${e.capacity?`⚡ ${e.capacity} · `:''}
          <span class="cond-pill ${condClass(e.condition||'Good')}">${e.condition||'Good'}</span>
        </div>
        ${features.length?`<div class="features-row">${features.map(f=>`<span class="feat-tag">${f}</span>`).join('')}</div>`:''}
        <div class="ec-specs">
          <div class="spec-item"><div class="spec-lbl">Min. Days</div><div class="spec-val">${e.min_days||1} day${e.min_days>1?'s':''}</div></div>
          <div class="spec-item"><div class="spec-lbl">Operator</div><div class="spec-val" style="font-size:11px">${(e.operator||'Self-operated').substring(0,15)}</div></div>
        </div>
        <div class="ec-footer">
          <div><div class="ec-price">₹${Number(e.price||0).toLocaleString('en-IN')}</div><div class="ec-price-unit">per day</div></div>
          <button class="btn-rent" ${!isAvail?'disabled':''} onclick="event.stopPropagation();openRentModal('${e.id}')">
            ${isAvail?'📋 Rent Now':'⛔ Unavailable'}
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openRentModal(id) {
  const e = allEquipment.find(x=>x.id==id);
  if (!e || e.status!=='available') { showToast('This equipment is not available','err'); return; }
  selectedEquip = e;
  const imgs = parseImages(e.image_urls);
  document.getElementById('modalEquipInfo').innerHTML = `
    <div class="mei-icon">${imgs[0]?`<img src="${imgs[0]}" alt="${e.name}">`:'🚜'}</div>
    <div>
      <div class="mei-name">${e.name}</div>
      <div class="mei-sub">${e.sub_type||''} · 📍 ${e.location||'—'} · Min ${e.min_days||1} day(s)</div>
      <div class="mei-price">₹${Number(e.price||0).toLocaleString('en-IN')} <span style="font-size:12px;color:var(--text-mid);font-family:'DM Sans',sans-serif">per day</span></div>
    </div>`;
  document.getElementById('costPreview').style.display='none';
  document.getElementById('rentModal').classList.add('active');
}

function closeModal() {
  document.getElementById('rentModal').classList.remove('active');
  selectedEquip = null;
}
document.querySelector('.modal-overlay').addEventListener('click',e=>{if(e.target===document.querySelector('.modal-overlay'))closeModal();});

function calcCost() {
  if (!selectedEquip) return;
  const start = document.getElementById('rk_start').value;
  const end   = document.getElementById('rk_end').value;
  const preview = document.getElementById('costPreview');
  if (start && end && end >= start) {
    const days = Math.max(1, Math.round((new Date(end)-new Date(start))/(1000*60*60*24))+1);
    const total = days * (selectedEquip.price||0);
    preview.style.display = 'block';
    preview.innerHTML = `🧮 <b>${days} day${days>1?'s':''}</b> × ₹${Number(selectedEquip.price).toLocaleString()} = <b>₹${total.toLocaleString('en-IN')}</b> estimated total`;
  } else { preview.style.display='none'; }
}

async function submitRental() {
  if (!selectedEquip) return;
  const start    = document.getElementById('rk_start').value;
  const end      = document.getElementById('rk_end').value;
  const location = document.getElementById('rk_location').value.trim();
  if (!start||!end)    { showToast('Please select rental dates','err'); return; }
  if (end<start)        { showToast('End date must be after start date','err'); return; }
  if (!location)        { showToast('Please enter usage location','err'); return; }

  const days  = Math.max(1, Math.round((new Date(end)-new Date(start))/(1000*60*60*24))+1);
  const total = days*(selectedEquip.price||0);
  const btn   = document.getElementById('submitBtn');
  btn.textContent='⏳ Submitting…'; btn.disabled=true;

  try {
    const notes = [
      document.getElementById('rk_purpose').value,
      document.getElementById('rk_notes').value
    ].filter(Boolean).join(' | ');
    const res = await fetch('/api/service-bookings', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        listing_id:   selectedEquip.id,
        booking_date: start,
        duration_days: days,
        quantity:     days,
        location,
        notes,
        amount: total
      })
    });
    if (res.ok) {
      closeModal();
      showToast('✅ Rental request sent! Provider will confirm soon.','success');
      await loadHistory();
      ['rk_start','rk_end','rk_location','rk_purpose','rk_notes'].forEach(id=>{document.getElementById(id).value='';});
    } else {
      const d=await res.json(); showToast(d.error||'Failed','err');
    }
  } catch(e){ showToast('Network error','err'); }
  btn.textContent='🚜 Send Rental Request'; btn.disabled=false;
}

async function loadHistory() {
  try {
    const res = await fetch('/api/my-service-bookings?type=equipment',{credentials:'include'});
    renderHistory(res.ok ? await res.json() : []);
  } catch(e){ renderHistory([]); }
}

function renderHistory(bookings) {
  const body=document.getElementById('historyBody');
  document.getElementById('historyCount').textContent=`${bookings.length} rental${bookings.length!==1?'s':''}`;
  if (!bookings.length) {
    body.innerHTML=`<div class="empty-state" style="padding:40px"><div class="empty-icon" style="font-size:48px">📋</div><div class="empty-title" style="font-size:16px">No rentals yet</div><div class="empty-sub">Your equipment rental history will appear here</div></div>`;
    return;
  }
  body.innerHTML=`<table class="h-table"><thead><tr><th>Equipment</th><th>Start Date</th><th>Days</th><th>Amount</th><th>Status</th></tr></thead><tbody>${bookings.map(b=>`<tr>
    <td><b>${b.service_name||'Equipment'}</b><br><span style="font-size:11px;color:var(--text-light)">#${b.id}</span></td>
    <td>${b.booking_date?new Date(b.booking_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—'}</td>
    <td>${b.duration_days||'—'} day${b.duration_days>1?'s':''}</td>
    <td><b>₹${Number(b.amount||0).toLocaleString('en-IN')}</b></td>
    <td><span class="status-pill ${b.status||'pending'}">${b.status||'pending'}</span></td>
  </tr>`).join('')}</tbody></table>`;
}

function parseImages(u){if(!u)return[];if(Array.isArray(u))return u;try{return JSON.parse(u);}catch(e){return u.split(',').filter(Boolean);}}
function parseFeatures(f){if(!f)return[];if(Array.isArray(f))return f;try{return JSON.parse(f);}catch(e){return f.split(',').filter(Boolean);}}
function showToast(msg,type=''){const w=document.getElementById('toastWrap');const t=document.createElement('div');t.className='toast'+(type?' '+type:'');t.textContent=msg;w.appendChild(t);requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},3500);}
