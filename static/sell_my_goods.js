/* ── STATE ── */
let editingId       = null;
let deletingId      = null;
let listings        = [];
let farmerOrders    = [];
let filteredOrders  = [];
let currentFilter   = 'all';
let ohStatus        = 'all';
let ohPage          = 1;
const OH_PER_PAGE   = 8;
let allMarketData   = [];
let currentMarketCat= 'all';
let deliveredCount  = 0;

const STEPS       = ['pending','accepted','ready_to_ship','shipped','delivered'];
const STEP_ICONS  = ['📝','✅','📦','🚚','🎉'];
const STEP_LABELS = ['Placed','Accepted','Packed','Shipped','Delivered'];
const STATUS_LABELS = {pending:'Pending',accepted:'Accepted',rejected:'Rejected',ready_to_ship:'Ready to Ship',shipped:'Shipped',delivered:'Delivered'};
const CAT_LABELS    = {vegetables:'Vegetables',grains:'Grains',fruits:'Fruits',spices:'Spices',pulses:'Pulses',organic:'Organic',dairy:'Dairy',oilseeds:'Oilseeds',herbs:'Herbs',dry_fruits:'Dry Fruits'};

/* ── TAB SWITCHING ── */
function switchTab(tab) {
  const isSell = tab === 'sell';
  document.getElementById('sellView').style.display   = isSell ? 'block' : 'none';
  document.getElementById('ordersView').style.display = isSell ? 'none' : 'block';
  document.getElementById('tabSell').classList.toggle('active', isSell);
  document.getElementById('tabOrders').classList.toggle('active', !isSell);
  document.getElementById('sidebarSell').classList.toggle('active', isSell);
  document.getElementById('sidebarOrders').classList.toggle('active', !isSell);
  document.getElementById('addBtn').style.display = isSell ? 'flex' : 'none';
  if (!isSell) { /* orders already loaded on init */ }
}

/* ── USER ── */
async function loadUser() {
  try {
    const res = await fetch('/api/user', {credentials:'include'});
    if (!res.ok) { window.location.href = '/login'; return; }
    const user = await res.json();
    document.getElementById('userName').textContent = user.name;
    try {
      const pr = await fetch('/api/profile', {credentials:'include'});
      if (pr.ok) {
        const p = await pr.json();
        updateAvatar(p.first_name+' '+p.last_name, p.profile_img);
      } else updateAvatar(user.name, user.profile_img);
    } catch(_) { updateAvatar(user.name, user.profile_img); }
  } catch(e) { window.location.href = '/login'; }
}
function updateAvatar(name, img) {
  document.getElementById('userName').textContent = name;
  const av = document.getElementById('userAvatar');
  if (img) av.innerHTML = `<img src="${img}" alt="avatar" style="width:32px;height:32px;object-fit:cover;border-radius:50%">`;
  else av.innerHTML = `<span>${name.split(' ').map(n=>n[0]).join('').toUpperCase()}</span>`;
}

/* ── LISTINGS ── */
async function loadListings() {
  const res  = await fetch('/api/listings', {credentials:'include'});
  const data = await res.json();
  listings = data.map(l => ({
    id:l.id, produce:l.produce, variety:l.variety, grade:l.grade,
    qty:l.quantity, price:l.price, minprice:l.min_price,
    from:l.available_from, till:l.valid_until, location:l.location,
    storage:l.storage, pack:l.packaging, harvest:l.harvest_date,
    transport:l.transport, desc:l.description, status:l.status,
    category:l.category||'vegetables', image_urls:l.image_urls||'',
    image:l.image_urls?l.image_urls.split(',')[0]:null,
    photos:l.image_urls?l.image_urls.split(',').filter(Boolean).length:0,
    created:new Date(l.created_at).getTime()
  }));
  document.getElementById('tabListingsCount').textContent = listings.length;
  renderStats(); renderCounts(); renderTable();
}

async function loadDeliveredCount() {
  try {
    const res    = await fetch('/api/orders/farmer', {credentials:'include'});
    farmerOrders = await res.json();
    buildOhStats(farmerOrders);
    deliveredCount = farmerOrders.filter(o=>o.status==='delivered').length;
    const pending  = farmerOrders.filter(o=>o.status==='pending').length;
    const nb = document.getElementById('notifBadge');
    const pb = document.getElementById('pendingBadge');
    document.getElementById('tabOrdersCount').textContent = farmerOrders.length;
    if (pending > 0) {
      pb.textContent=pending; pb.style.display='inline';
      nb.textContent=pending; nb.style.display='grid';
    } else { pb.style.display='none'; nb.style.display='none'; }
    renderStats();
  } catch(e){}
}

function renderStats() {
  const active   = listings.filter(l=>l.status==='active');
  const totalQty = listings.reduce((s,l)=>s+Number(l.qty),0);
  const totalVal = listings.reduce((s,l)=>s+(Number(l.qty)*Number(l.price)),0);
  const revenue  = farmerOrders.filter(o=>o.status==='delivered').reduce((s,o)=>s+parseFloat(o.total_price||0),0);
  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card g"><div class="stat-label">Total Listings</div><div class="stat-val">${listings.length}</div><div class="stat-meta">${active.length} active</div><div class="stat-icon">📋</div></div>
    <div class="stat-card a"><div class="stat-label">Total Quantity</div><div class="stat-val">${totalQty} <span style="font-size:16px">kg</span></div><div class="stat-meta">Across all listings</div><div class="stat-icon">⚖️</div></div>
    <div class="stat-card s"><div class="stat-label">Est. Value</div><div class="stat-val">₹${(totalVal/1000).toFixed(1)}K</div><div class="stat-meta">Based on listed price</div><div class="stat-icon">💰</div></div>
    <div class="stat-card b"><div class="stat-label">Revenue Earned</div><div class="stat-val">₹${revenue>=100000?(revenue/100000).toFixed(1)+'L':revenue.toLocaleString('en-IN')}</div><div class="stat-meta">${deliveredCount} orders delivered</div><div class="stat-icon">✅</div></div>`;
}

function renderCounts() {
  ['all','active','pending','sold','expired'].forEach(s => {
    const el = document.getElementById('cnt-'+s);
    if (el) el.textContent = listings.filter(l=>s==='all'||l.status===s).length;
  });
}

function renderTable() {
  const q    = document.getElementById('searchInput').value.toLowerCase();
  const sort = document.getElementById('sortSelect').value;
  let data = listings.filter(l => {
    const mf = currentFilter==='all'||l.status===currentFilter;
    const ms = l.produce.toLowerCase().includes(q)||(l.variety||'').toLowerCase().includes(q)||(l.location||'').toLowerCase().includes(q);
    return mf&&ms;
  });
  if (sort==='price-high') data.sort((a,b)=>b.price-a.price);
  else if (sort==='price-low') data.sort((a,b)=>a.price-b.price);
  else if (sort==='qty-high') data.sort((a,b)=>b.qty-a.qty);
  else data.sort((a,b)=>b.created-a.created);
  document.getElementById('listingsCount').textContent = `${data.length} listing${data.length!==1?'s':''}`;
  if (!data.length) {
    document.getElementById('tableContainer').innerHTML = `<div class="empty-state"><div class="es-icon">🌾</div><h3>No listings found</h3><p>Add your first listing or try a different filter</p></div>`;
    return;
  }
  document.getElementById('tableContainer').innerHTML = `
    <table class="goods-table"><thead><tr>
      <th>Produce</th><th>Category</th><th>Grade</th><th>Qty</th><th>Price</th><th>From</th><th>Location</th><th>Status</th><th>Actions</th>
    </tr></thead><tbody>${data.map(l=>`<tr>
      <td><div class="goods-crop"><div class="crop-emoji">${l.image?`<img src="${l.image}" alt="${l.produce}">`:'🌾'}</div><div><div class="crop-name">${l.produce}</div><div class="crop-variety">${l.variety||''}</div></div></div></td>
      <td><span style="font-size:12px;color:var(--text-mid)">${(l.category||'').replace('_',' ')}</span></td>
      <td><span class="grade-pill grade-${l.grade||'B'}">Grade ${l.grade||'B'}</span></td>
      <td><b>${l.qty}</b> kg</td>
      <td><div class="price-cell">₹${Number(l.price).toLocaleString()}</div><div class="price-sub">min ₹${l.minprice?Number(l.minprice).toLocaleString():'—'}</div></td>
      <td>${fmtDate(l.from)}</td>
      <td style="max-width:140px;font-size:12px;color:var(--text-mid)">${l.location||'—'}</td>
      <td><span class="status-pill ${l.status}">${l.status}</span></td>
      <td><div class="actions-cell">
        <button class="icon-btn view" onclick="viewListing(${l.id})">👁️</button>
        <button class="icon-btn edit" onclick="editListing(${l.id})">✏️</button>
        <button class="icon-btn del" onclick="openDelete(${l.id})">🗑️</button>
      </div></td>
    </tr>`).join('')}</tbody></table>`;
}

function filterGoods(f,btn) {
  currentFilter=f;
  document.querySelectorAll('#sellView .filter-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderTable();
}

/* ── ORDER HISTORY ── */
async function loadFarmerOrders() {
  var shimmerHTML = '<div class="oh-shimmer"><div class="sh-img"></div><div class="sh-lines"><div class="sh-line w40"></div><div class="sh-line w70"></div><div class="sh-line w55"></div></div></div>';
  document.getElementById('ohOrdersContainer').innerHTML = '<div class="oh-orders-list">' + shimmerHTML + shimmerHTML + shimmerHTML + '</div>';
  try {
    const res    = await fetch('/api/orders/farmer', {credentials:'include'});
    farmerOrders = await res.json();
    buildOhStats(farmerOrders);
    applyOhFilters();
    await loadDeliveredCount();
    renderStats();
  } catch(e) {
    document.getElementById('ohOrdersContainer').innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-light)">⚠ Unable to load orders. <button onclick="loadFarmerOrders()" style="color:var(--green-mid);background:none;border:none;font-weight:700;cursor:pointer">Retry</button></div>`;
  }
}

function buildOhStats(orders) {
  const delivered = orders.filter(o=>o.status==='delivered');
  const pending   = orders.filter(o=>o.status==='pending');
  const revenue   = delivered.reduce((s,o)=>s+parseFloat(o.total_price||0),0);
  document.getElementById('ohStatTotal').textContent     = orders.length;
  document.getElementById('ohStatDelivered').textContent = delivered.length;
  document.getElementById('ohStatRevenue').textContent   = revenue>=100000?'₹'+(revenue/100000).toFixed(1)+'L':'₹'+revenue.toLocaleString('en-IN');
  document.getElementById('ohStatPending').textContent   = pending.length;
  document.getElementById('ohSumPending').textContent    = pending.length;
  document.getElementById('ohSumAccepted').textContent   = orders.filter(o=>o.status==='accepted').length;
  document.getElementById('ohSumReady').textContent      = orders.filter(o=>['ready_to_ship','shipped'].includes(o.status)).length;
  document.getElementById('ohSumDelivered').textContent  = delivered.length;
  document.getElementById('ohSumRejected').textContent   = orders.filter(o=>o.status==='rejected').length;
}

function setOhFilter(btn) {
  document.querySelectorAll('.ohsp').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  ohStatus=btn.dataset.s; ohPage=1; applyOhFilters();
}

function applyOhFilters() {
  const q    = document.getElementById('ohSearchInput').value.toLowerCase().trim();
  const sort = document.getElementById('ohSortSel').value;
  let data   = [...farmerOrders];
  if (ohStatus!=='all') data=data.filter(o=>o.status===ohStatus);
  if (q) data=data.filter(o=>
    o.produce.toLowerCase().includes(q)||
    `${o.customer_first||''} ${o.customer_last||''}`.toLowerCase().includes(q)||
    String(o.id).includes(q)||
    (o.customer_phone||'').includes(q)||
    (o.delivery_address||'').toLowerCase().includes(q)
  );
  if (sort==='newest')     data.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  if (sort==='oldest')     data.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  if (sort==='price_high') data.sort((a,b)=>parseFloat(b.total_price)-parseFloat(a.total_price));
  if (sort==='price_low')  data.sort((a,b)=>parseFloat(a.total_price)-parseFloat(b.total_price));
  filteredOrders=data; ohPage=1;
  renderOhOrders(); renderOhPagination();
}

function renderOhOrders() {
  const container = document.getElementById('ohOrdersContainer');
  if (!filteredOrders.length) {
    const isF = ohStatus!=='all'||document.getElementById('ohSearchInput').value.trim();
    container.innerHTML = `<div style="text-align:center;padding:44px;background:#fff;border-radius:var(--radius);border:1.5px dashed var(--cream-dark)">
      <div style="font-size:52px;margin-bottom:11px;opacity:.4">${isF?'🔍':'📦'}</div>
      <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:var(--green-dark);margin-bottom:6px">${isF?'No orders match':'No orders yet'}</div>
      <div style="font-size:12.5px;color:var(--text-light)">${isF?'Try a different search or filter.':'Orders from buyers will appear here once they purchase your listings.'}</div>
    </div>`;
    return;
  }
  const start = (ohPage-1)*OH_PER_PAGE;
  const page  = filteredOrders.slice(start, start+OH_PER_PAGE);
  container.innerHTML = `<div class="oh-orders-list">${page.map(o=>buildOhCard(o)).join('')}</div>`;
}

function buildOhCard(o) {
  const img      = o.image_urls?o.image_urls.split(',')[0]:'';
  const customer = `${o.customer_first||''} ${o.customer_last||''}`.trim();
  const date     = fmtDate(o.created_at);
  const rejected = o.status==='rejected';
  const curIdx   = rejected?-1:STEPS.indexOf(o.status);
  const price    = parseFloat(o.total_price||0);

  const progHTML = rejected
    ? `<div style="padding-bottom:10px"><span style="background:var(--red-light);color:var(--red);padding:5px 10px;border-radius:7px;font-size:11px;font-weight:700">❌ Rejected</span></div>`
    : `<div class="mpt">
        ${STEPS.map((s,idx)=>{
          const done=idx<curIdx, active=idx===curIdx;
          return `${idx>0?`<div class="mpt-line ${done||active?'done':''}"></div>`:''}
            <div class="mpt-step"><div class="mpt-dot ${done?'done':active?'active':''}">${done?'✓':STEP_ICONS[idx]}</div><div class="mpt-lbl ${done?'done':active?'active':''}">${STEP_LABELS[idx]}</div></div>`;
        }).join('')}
      </div>`;

  const actionHTML = getOhActions(o);

  return `
    <div class="oh-card" id="ohcard-${o.id}" onclick="toggleOhCard(${o.id})">
      <div class="oh-card-top">
        <div class="oh-img">${img?`<img src="${img}" alt="${o.produce}" loading="lazy">`:'🌾'}</div>
        <div>
          <div class="ohi-id">Order #KB-${o.id}</div>
          <div class="ohi-name">${o.produce}${o.variety?` — ${o.variety}`:''}</div>
          <div class="ohi-meta"><span>⚖️ ${o.quantity} kg</span><span>₹${parseFloat(o.unit_price||0).toLocaleString('en-IN')}/kg</span></div>
          <div class="ohi-customer">👤 ${customer||'—'}${o.customer_phone?` · 📞 ${o.customer_phone}`:''}</div>
        </div>
        <div class="oh-right">
          <div class="oh-price">₹${price.toLocaleString('en-IN')}</div>
          <div class="oh-date">${date}</div>
          <div class="oh-os ${o.status}">${STATUS_LABELS[o.status]||o.status}</div>
        </div>
      </div>
      <div class="oh-prog">${progHTML}</div>
      ${actionHTML?`<div class="oh-actions">${actionHTML}</div>`:''}
      <div class="oh-detail" id="ohdetail-${o.id}">${buildOhDetail(o,customer)}</div>
    </div>`;
}

function getOhActions(o) {
  switch(o.status) {
    case 'pending':       return `<button class="oa-btn accept" onclick="updateOhStatus(${o.id},'accepted',event)">✅ Accept</button><button class="oa-btn reject" onclick="updateOhStatus(${o.id},'rejected',event)">❌ Reject</button>`;
    case 'accepted':      return `<button class="oa-btn ready" onclick="updateOhStatus(${o.id},'ready_to_ship',event)">📦 Ready to Ship</button>`;
    case 'ready_to_ship': return `<button class="oa-btn ship" onclick="updateOhStatus(${o.id},'shipped',event)">🚚 Mark Shipped</button>`;
    case 'shipped':       return `<button class="oa-btn deliver" onclick="updateOhStatus(${o.id},'delivered',event)">🎉 Mark Delivered</button>`;
    default: return '';
  }
}

function buildOhDetail(o, customer) {
  const createdDate = fmtDate(o.created_at);
  const updatedDate = o.updated_at?fmtDate(o.updated_at):'—';
  const unitPrice   = o.unit_price||(parseFloat(o.total_price||0)/(o.quantity||1)).toFixed(2);
  const rejected    = o.status==='rejected';
  const curIdx      = STEPS.indexOf(o.status);

  const tl = [
    {label:'Order Received',  note:`${o.produce} (${o.quantity} kg) ordered.`, time:createdDate, idx:0},
    {label:'Accepted',        note:'Order confirmed, preparing for dispatch.', time:'', idx:1},
    {label:'Packed & Ready',  note:'Produce packed, ready for pickup/dispatch.', time:'', idx:2},
    {label:'Shipped',         note:'Order dispatched to customer.', time:'', idx:3},
    {label:'Delivered',       note:'Order successfully delivered!', time:o.status==='delivered'?updatedDate:'', idx:4},
  ];

  const tlHTML = rejected
    ? `<div class="oh-tl-item"><div class="oh-tl-lw"><div class="oh-tl-dot done"></div></div><div class="oh-tl-content"><div class="oh-tl-step">Order Received</div><div class="oh-tl-time">${createdDate}</div></div></div>
       <div class="oh-tl-item"><div class="oh-tl-lw"><div class="oh-tl-dot cancelled"></div></div><div class="oh-tl-content"><div class="oh-tl-step" style="color:var(--red)">Rejected</div><div class="oh-tl-time">${updatedDate}</div><div class="oh-tl-note">Order rejected. Customer has been notified.</div></div></div>`
    : tl.map((item,i) => {
        const done   = i<curIdx;
        const active = i===curIdx;
        const last   = i===tl.length-1;
        return `<div class="oh-tl-item">
          <div class="oh-tl-lw"><div class="oh-tl-dot ${done?'done':active?'active':'waiting'}"></div>${!last?`<div class="oh-tl-vline ${done&&!active?'done':''}"></div>`:''}</div>
          <div class="oh-tl-content" style="${!done&&!active?'opacity:.4':''}">
            <div class="oh-tl-step">${item.label}</div>
            ${item.time&&(done||active)?`<div class="oh-tl-time">${item.time}</div>`:''}
            ${done||active?`<div class="oh-tl-note">${item.note}</div>`:''}
          </div>
        </div>`;
      }).join('');

  return `
    <div class="oh-detail-grid">
      <div class="ohd-row"><span class="ohd-lbl">Order ID</span><span class="ohd-val">#KB-${o.id}</span></div>
      <div class="ohd-row"><span class="ohd-lbl">Order Date</span><span class="ohd-val">${createdDate}</span></div>
      <div class="ohd-row"><span class="ohd-lbl">Produce</span><span class="ohd-val">${o.produce}</span></div>
      <div class="ohd-row"><span class="ohd-lbl">Quantity</span><span class="ohd-val">${o.quantity} kg</span></div>
      <div class="ohd-row"><span class="ohd-lbl">Unit Price</span><span class="ohd-val">₹${parseFloat(unitPrice).toLocaleString('en-IN')}/kg</span></div>
      <div class="ohd-row"><span class="ohd-lbl">Total</span><span class="ohd-val" style="color:var(--green-mid)">₹${parseFloat(o.total_price||0).toLocaleString('en-IN')}</span></div>
      <div class="ohd-row"><span class="ohd-lbl">Customer</span><span class="ohd-val">👤 ${customer||'—'}</span></div>
      <div class="ohd-row"><span class="ohd-lbl">Phone</span><span class="ohd-val">${o.customer_phone||'—'}</span></div>
    </div>
    ${o.delivery_address?`<div class="ohd-lbl" style="margin-bottom:4px">Delivery Address</div><div class="ohd-addr">📍 ${o.delivery_address}</div>`:''}
    <div class="ohd-lbl" style="margin-bottom:7px;margin-top:2px">Timeline</div>
    <div class="oh-tl">${tlHTML}</div>`;
}

function toggleOhCard(id, e) {
  if (e) e.stopPropagation();
  const card  = document.getElementById('ohcard-'+id);
  const arrow = document.getElementById('oharrow-'+id);
  if (!card) return;
  const isOpen = card.classList.contains('expanded');
  document.querySelectorAll('.oh-card.expanded').forEach(c=>{c.classList.remove('expanded');const a=c.querySelector('.oh-arrow');if(a)a.style.transform='';});
  if (!isOpen) { card.classList.add('expanded'); if(arrow) arrow.style.transform='rotate(180deg)'; setTimeout(()=>card.scrollIntoView({behavior:'smooth',block:'nearest'}),50); }
}

async function updateOhStatus(orderId, status, e) {
  if (e) e.stopPropagation();
  const btn = e?.currentTarget;
  if (btn) { btn.textContent='⏳…'; btn.disabled=true; }
  try {
    const res  = await fetch(`/api/orders/${orderId}/status`, {method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});
    const data = await res.json();
    if (data.success) {
      showToast(`✅ Order #KB-${orderId} → ${STATUS_LABELS[status]}`);
      await loadFarmerOrders();
    } else {
      showToast(data.error||'Failed to update','error');
      if (btn) btn.disabled=false;
    }
  } catch(err) { showToast('Network error','error'); if(btn) btn.disabled=false; }
}

function renderOhPagination() {
  const total=filteredOrders.length, totalPages=Math.ceil(total/OH_PER_PAGE);
  const pag=document.getElementById('ohPagination');
  if (totalPages<=1) { pag.style.display='none'; return; }
  pag.style.display='flex';
  let html=`<button class="oh-pg-btn" onclick="goOhPage(${ohPage-1})" ${ohPage===1?'disabled':''}>‹</button>`;
  for (let p=1;p<=totalPages;p++) {
    if (p===1||p===totalPages||Math.abs(p-ohPage)<=1) html+=`<button class="oh-pg-btn ${p===ohPage?'active':''}" onclick="goOhPage(${p})">${p}</button>`;
    else if (Math.abs(p-ohPage)===2) html+=`<span class="oh-pg-info">…</span>`;
  }
  html+=`<button class="oh-pg-btn" onclick="goOhPage(${ohPage+1})" ${ohPage===totalPages?'disabled':''}>›</button>`;
  html+=`<span class="oh-pg-info">${total} order${total!==1?'s':''}</span>`;
  pag.innerHTML=html;
}
function goOhPage(p) {
  const tp=Math.ceil(filteredOrders.length/OH_PER_PAGE);
  if (p<1||p>tp) return;
  ohPage=p; renderOhOrders(); renderOhPagination();
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ── MARKET PRICES ── */
async function loadMarketPrices() {
  try {
    const res=await fetch('/api/market-prices');
    const data=await res.json();
    allMarketData=data.flat||[];
    const el=document.getElementById('marketUpdatedAt');
    if (el) el.textContent=data.updated_at?`Updated: ${new Date(data.updated_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`:'AgroHub Market Data';
  } catch(e) { allMarketData=[]; }
}
function openMarketPopup() {
  document.getElementById('marketPopupOverlay').classList.add('active');
  currentMarketCat='all'; document.querySelectorAll('.market-tab').forEach(t=>t.classList.remove('active'));
  document.querySelector('.market-tab').classList.add('active');
  document.getElementById('marketSearch').value='';
  renderMarketGrid();
}
function closeMarketPopup() { document.getElementById('marketPopupOverlay').classList.remove('active'); }
function closeMarketIfBg(e) { if(e.target===document.getElementById('marketPopupOverlay')) closeMarketPopup(); }
function filterMarket(cat,el) {
  currentMarketCat=cat;
  document.querySelectorAll('.market-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active'); renderMarketGrid();
}
function renderMarketGrid() {
  const q=(document.getElementById('marketSearch').value||'').toLowerCase().trim();
  const grid=document.getElementById('marketGrid');
  let data=allMarketData;
  if (currentMarketCat!=='all') data=data.filter(p=>p.category===currentMarketCat);
  if (q) data=data.filter(p=>p.name.toLowerCase().includes(q)||(p.loc&&p.loc.toLowerCase().includes(q))||p.category.toLowerCase().includes(q));
  if (!data.length) { grid.innerHTML=`<div style="color:var(--text-light);text-align:center;padding:40px;grid-column:span 4">${allMarketData.length===0?'⏳ Loading prices…':'🔍 No results found.'}</div>`; return; }
  grid.innerHTML=data.map(p=>`<div class="market-item-card"><div class="mic-top"><span class="mic-emoji">${p.emoji||'🌾'}</span><div><div class="mic-name">${p.name}</div><div class="mic-loc">📍 ${p.loc||'—'}</div></div></div><div><span class="mic-price">₹${p.price}</span><span class="mic-unit">/${p.unit||'kg'}</span></div><div class="market-cat-badge">${CAT_LABELS[p.category]||p.category}</div></div>`).join('');
}

/* ── ADD/EDIT LISTING ── */
function openAddModal() {
  editingId=null;
  document.getElementById('modalTitle').textContent='+ Add New Listing';
  document.querySelector('#addModal .btn-primary').textContent='✅ Post Listing';
  resetForm(); showModal('addModal');
}
function resetForm() {
  ['f_produce','f_variety','f_qty','f_price','f_minprice','f_from','f_till','f_location','f_harvest','f_desc'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['f_category','f_grade','f_storage','f_pack','f_transport'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('f_status').value='active';
  document.querySelectorAll('.cert-chip').forEach(c=>c.classList.remove('selected'));
  document.getElementById('f_from').value=new Date().toISOString().split('T')[0];
  document.getElementById('photoHint').textContent='Click to upload (max 5 photos, JPG/PNG)';
}
function editListing(id) {
  const l=listings.find(x=>x.id===id); if(!l) return;
  editingId=id;
  document.getElementById('modalTitle').textContent='✏️ Edit Listing';
  document.querySelector('#addModal .btn-primary').textContent='💾 Save Changes';
  resetForm();
  document.getElementById('f_produce').value=l.produce;
  document.getElementById('f_variety').value=l.variety||'';
  document.getElementById('f_category').value=l.category||'vegetables';
  document.getElementById('f_grade').value=l.grade||'';
  document.getElementById('f_qty').value=l.qty;
  document.getElementById('f_price').value=l.price;
  document.getElementById('f_minprice').value=l.minprice||'';
  document.getElementById('f_from').value=l.from||'';
  document.getElementById('f_till').value=l.till||'';
  document.getElementById('f_location').value=l.location||'';
  document.getElementById('f_storage').value=l.storage||'';
  document.getElementById('f_pack').value=l.pack||'';
  document.getElementById('f_harvest').value=l.harvest||'';
  document.getElementById('f_transport').value=l.transport||'';
  document.getElementById('f_desc').value=l.desc||'';
  document.getElementById('f_status').value=l.status;
  if(l.photos>0) document.getElementById('photoHint').textContent=`${l.photos} photo(s) uploaded`;
  showModal('addModal');
}
async function saveListing() {
  const fd=new FormData();
  ['produce','variety','grade','qty','price','minprice','from','till','location','storage','pack','harvest','transport','desc','status'].forEach(k=>{const el=document.getElementById('f_'+k);if(el)fd.append(k,el.value);});
  fd.append('category',document.getElementById('f_category').value);
  for (const f of document.getElementById('f_images').files) fd.append('images',f);
  const res=await fetch(editingId?`/api/listings/${editingId}`:'/api/listings',{method:editingId?'PUT':'POST',body:fd,credentials:'include'});
  const data=await res.json();
  if (data.success) { showToast('✅ Listing saved!'); closeModal('addModal'); loadListings(); }
  else showToast('❌ '+(data.error||'Error saving'),'error');
}

/* ── DELETE ── */
function openDelete(id) {
  deletingId=id;
  const l=listings.find(x=>x.id===id);
  document.getElementById('delCropBadge').textContent=`${l.produce} – ${l.qty} kg @ ₹${l.price}/kg`;
  showModal('delModal');
}
async function confirmDelete() {
  const res=await fetch(`/api/listings/${deletingId}`,{method:'DELETE',credentials:'include'});
  const data=await res.json();
  if (data.success) { closeModal('delModal'); showToast('🗑️ Listing deleted'); loadListings(); }
  else showToast('❌ Delete failed','error');
}

/* ── VIEW MODAL ── */
function viewListing(id) {
  const l=listings.find(x=>x.id===id); if(!l) return;
  document.getElementById('viewModalBody').innerHTML=`
    <div style="background:linear-gradient(135deg,var(--green-dark),var(--green-mid));padding:24px;color:#fff;text-align:center">
      <div style="font-size:64px;margin-bottom:10px">${l.image?`<img src="${l.image}" style="width:80px;height:80px;border-radius:14px;object-fit:cover">`:'🌾'}</div>
      <div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700">${l.produce}</div>
      <div style="font-size:13px;color:var(--green-pale);margin-top:3px">${l.variety||''} · Grade ${l.grade||'—'} · ${(l.category||'').replace('_',' ')}</div>
    </div>
    <div class="modal-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--cream-dark);border-radius:10px;overflow:hidden;margin-bottom:16px">
        ${[['Quantity',l.qty+' kg'],['Price','₹'+Number(l.price).toLocaleString()+'/kg'],['Min Price',l.minprice?'₹'+Number(l.minprice).toLocaleString()+'/kg':'—'],['Total Value','₹'+(l.qty*l.price).toLocaleString()],['Available From',fmtDate(l.from)],['Valid Until',l.till?fmtDate(l.till):'Open'],['Location',l.location||'—'],['Storage',l.storage||'—'],['Packaging',l.pack||'—'],['Transport',l.transport||'—'],['Status',l.status],['Photos',l.photos>0?l.photos+' uploaded':'None']].map(([k,v])=>`<div style="background:#fff;padding:12px 14px"><div style="font-size:10px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;color:var(--text-light);margin-bottom:3px">${k}</div><div style="font-size:13.5px;font-weight:700;color:var(--text-dark)">${v}</div></div>`).join('')}
      </div>
      ${l.desc?`<div style="font-size:13px;color:var(--text-mid);line-height:1.6;background:var(--cream);padding:12px;border-radius:8px">${l.desc}</div>`:''}
    </div>`;
  showModal('viewModal');
}

/* ── HELPERS ── */
function toggleCert(el) { el.classList.toggle('selected'); }
function handleImageUpload() {
  const f=document.getElementById('f_images').files;
  if (f.length>5) { showToast('Max 5 images','error'); return; }
  document.getElementById('photoHint').textContent=`${f.length} photo(s) selected ✅`;
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
}
function showModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('active');}));
function showToast(msg,type='') {
  const wrap=document.getElementById('toastWrap');
  const t=document.createElement('div');
  t.className='toast'+(type?' '+type:''); t.textContent=msg;
  wrap.appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},3000);
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', async () => {
  await loadUser();
  await Promise.all([loadListings(), loadFarmerOrders(), loadMarketPrices()]);
  renderStats();
  // Check URL hash to auto-switch to orders tab
  if (window.location.hash === '#orders') switchTab('orders');
  setInterval(loadDeliveredCount, 30000);
  setInterval(loadMarketPrices, 120000);
});

document.getElementById('bellBtn').addEventListener('click', () => switchTab('orders'));
