// ── STATE ──────────────────────────────────────────
// ── STATE ──────────────────────────────────────────
let cartItems        = [];
let allProducts      = [];
let allFarmersData   = [];
let liveMarketPrices = [];
let currentCategory  = '';
let currentMarketCat = 'all';
let searchQuery      = '';
let savedAddresses   = [];   // now mirrored from DB
let currentUserId    = null;
 
const NOTIF_POLL_MS  = 30_000;
const MARKET_POLL_MS = 120_000;
let lastNotifCount   = 0;
 
const stateDistricts = {
  MH:['All Districts','Mumbai','Pune','Nashik','Nagpur','Thane','Aurangabad','Solapur','Kolhapur','Ahmednagar','Amravati'],
  TG:['All Districts','Hyderabad','Warangal','Nizamabad','Karimnagar','Khammam','Mahbubnagar','Adilabad'],
  KA:['All Districts','Bangalore Urban','Mysore','Mangalore','Hubli','Belgaum','Shimoga','Davangere'],
  OD:['All Districts','Bhubaneswar','Cuttack','Puri','Sambalpur','Rourkela','Bhadrak','Balasore','Ganjam']
};
const colorVariants = ['v1','v2','v3','v4','v5','v6'];
const catEmoji = {vegetables:'🥦',fruits:'🥭',grains:'🌾',pulses:'🫘',spices:'🌶️',organic:'🍃',dairy:'🫙',dry_fruits:'🥜',oilseeds:'🌻',herbs:'🌿',default:'🌾'};
 
// ── INIT ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadUser();
  await Promise.all([
    loadMarketProducts(''),
    loadCart(),
    loadNotifications(),
    loadOrders(),
    loadFarmers(),
    loadMarketPrices(),
  ]);
  setInterval(pollNotifications, NOTIF_POLL_MS);
  setInterval(loadMarketPrices,  MARKET_POLL_MS);
});
 
// ── DROPDOWN TOGGLE ────────────────────────────────
// FIX: close only when click is OUTSIDE all dropdowns
document.addEventListener('click', e => {
  const inside = e.target.closest('.notif-wrap,.cart-wrap,.profile-wrap');
  if (!inside) {
    document.querySelectorAll('.notif-wrap,.cart-wrap,.profile-wrap').forEach(el => el.classList.remove('open'));
  }
});
 
function toggleDrop(id) {
  const el   = document.getElementById(id);
  const open = el.classList.contains('open');
  document.querySelectorAll('.notif-wrap,.cart-wrap,.profile-wrap').forEach(e => e.classList.remove('open'));
  if (!open) el.classList.add('open');
}
function closeDrop() {
  document.querySelectorAll('.notif-wrap,.cart-wrap,.profile-wrap').forEach(e => e.classList.remove('open'));
}
 
// ── USER ──────────────────────────────────────────
async function loadUser() {
  try {
    const res = await fetch('/api/user', {credentials:'include'});
    if (!res.ok) { window.location.href='/login'; return; }
    const user = await res.json();
    currentUserId = user.id;
    document.getElementById('profileName').textContent = user.name;
    document.getElementById('profileNameDropdown').textContent = user.name;
    const initials = user.name.split(' ').map(n=>n[0]).join('').toUpperCase();
    const avatarEl = document.getElementById('profileAvatar');
    if (user.profile_img) {
      avatarEl.innerHTML = `<img src="${user.profile_img}" alt="${user.name}">`;
    } else {
      avatarEl.textContent = initials;
    }
    await loadAddresses();   // load from DB after we have user context
  } catch(e) { window.location.href='/login'; }
}
 
async function logoutUser() {
  await fetch('/api/logout',{credentials:'include'});
  window.location.href='/login';
}
 
// ── MARKET PRICES ─────────────────────────────────
async function loadMarketPrices() {
  try {
    const res  = await fetch('/api/market-prices');
    const data = await res.json();
    liveMarketPrices = data.flat || [];
    if (document.getElementById('marketUpdatedAt')) {
      document.getElementById('marketUpdatedAt').textContent =
        data.updated_at
          ? `Updated: ${new Date(data.updated_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`
          : '';
    }
    renderMarketGrid();
  } catch(e) {}
}
 
function setMarketFilter(el) {
  document.querySelectorAll('.mfp').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  currentMarketCat = el.dataset.cat;
  renderMarketGrid();
}
 
function renderMarketGrid() {
  const grid = document.getElementById('marketPriceGrid');
  if (!grid) return;
  const q = (document.getElementById('marketSearchInput')?.value || '').toLowerCase().trim();
 
  let data = [...liveMarketPrices];
  if (currentMarketCat !== 'all') data = data.filter(p => p.category === currentMarketCat);
  if (q) data = data.filter(p => p.name.toLowerCase().includes(q) || (p.loc||'').toLowerCase().includes(q));
 
  if (!data.length) {
    grid.innerHTML = `<div style="padding:30px;color:var(--text-light);text-align:center;grid-column:1/-1">No results found</div>`;
    return;
  }
 
  const chgArr = [4.2,5.8,1.1,2.0,2.4,1.5,3.1,7.2,0.9,3.5,1.8,2.6];
  const dirArr = [-1,1,1,-1,1,-1,1,1,-1,-1,1,1];
  const catColorMap = {vegetables:'vegetables',grains:'grains',fruits:'fruits',spices:'spices'};
 
  grid.innerHTML = data.map((p, i) => {
    const chg = chgArr[i % chgArr.length].toFixed(1);
    const dir = dirArr[i % dirArr.length];
    const catCls = catColorMap[p.category] || 'vegetables';
    return `<div class="mp-item">
      <div class="mp-emoji-box">${p.emoji}</div>
      <div class="mp-info">
        <div class="mp-name">${p.name}</div>
        <div class="mp-loc">📍 ${p.loc}</div>
        <span class="mp-cat-tag ${catCls}">${p.category}</span>
      </div>
      <div class="mp-right">
        <div><span class="mp-price-val">₹${p.price}</span><span class="mp-unit-txt">/${p.unit}</span></div>
        <div class="mp-chg ${dir>0?'up':'dn'}">${dir>0?'▲':'▼'} ${chg}%</div>
      </div>
    </div>`;
  }).join('');
}
 
// ── NOTIFICATIONS ─────────────────────────────────
async function pollNotifications() {
  try {
    const res   = await fetch('/api/notifications/unread-count', {credentials:'include'});
    const data  = await res.json();
    const count = data.count || 0;
    const badge = document.getElementById('notifBadge');
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'grid';
      if (lastNotifCount > 0 && count > lastNotifCount) {
        showToast(`🔔 ${count - lastNotifCount} new notification${count-lastNotifCount>1?'s':''}!`);
        if (document.getElementById('notifWrap').classList.contains('open')) await loadNotifications();
      }
    } else {
      badge.style.display = 'none';
    }
    lastNotifCount = count;
  } catch(e) {}
}
 
async function loadNotifications() {
  try {
    const res    = await fetch('/api/notifications',{credentials:'include'});
    const notifs = await res.json();
    renderNotifications(notifs);
  } catch(e) {}
}
 
function renderNotifications(notifs) {
  const badge = document.getElementById('notifBadge');
  const list  = document.getElementById('notifList');
  const unread = notifs.filter(n=>!n.is_read).length;
  if (unread > 0) { badge.textContent = unread > 99 ? '99+' : unread; badge.style.display = 'grid'; }
  else badge.style.display = 'none';
  lastNotifCount = unread;
  if (!notifs.length) {
    list.innerHTML = `<div style="text-align:center;padding:22px;color:var(--text-light)">🔔 No notifications yet</div>`;
    return;
  }
  const typeMap = {info:'info',success:'ok',warning:'warn',error:'err'};
  list.innerHTML = notifs.map(n => {
    const ago = timeAgo(new Date(n.created_at));
    return `<div class="notif-item" style="${!n.is_read?'background:rgba(232,98,10,.04)':''}">
      <div class="notif-dot ${typeMap[n.type]||'info'}"></div>
      <div><div class="notif-text">${n.message}</div><div class="notif-time">${ago}</div></div>
    </div>`;
  }).join('');
}
 
async function markAllRead() {
  await fetch('/api/notifications/mark-read',{method:'POST',credentials:'include'});
  await loadNotifications();
}
 
function timeAgo(date) {
  const secs = Math.floor((Date.now()-date.getTime())/1000);
  if (secs<60) return 'Just now';
  if (secs<3600) return `${Math.floor(secs/60)} min ago`;
  if (secs<86400) return `${Math.floor(secs/3600)} hr ago`;
  return `${Math.floor(secs/86400)} day${Math.floor(secs/86400)>1?'s':''} ago`;
}
 
// ── PRODUCTS ──────────────────────────────────────
async function loadMarketProducts(category) {
  currentCategory = category;
  const url = category ? `/api/market-listings?category=${category}` : '/api/market-listings';
  document.getElementById('productGrid').innerHTML = `<div class="no-products"><div class="np-icon">⏳</div><p>Loading…</p></div>`;
  try {
    const res  = await fetch(url);
    const data = await res.json();
    allProducts = data;
    renderProducts(data);
  } catch(e) {
    document.getElementById('productGrid').innerHTML = `<div class="no-products"><div class="np-icon">⚠️</div><p>Failed to load products</p></div>`;
  }
}
 
function renderProducts(products) {
  const q = searchQuery.toLowerCase();
  const filtered = q ? products.filter(p => p.produce.toLowerCase().includes(q) || (p.variety||'').toLowerCase().includes(q) || (p.location||'').toLowerCase().includes(q)) : products;
  document.getElementById('listingSubtitle').textContent = currentCategory ? `${filtered.length} listings in ${currentCategory}` : `${filtered.length} fresh listings from farmers`;
  if (!filtered.length) {
    document.getElementById('productGrid').innerHTML = `<div class="no-products"><div class="np-icon">🌾</div><p>No products found.</p></div>`;
    return;
  }
  document.getElementById('productGrid').innerHTML = filtered.map((p, i) => {
    const img       = p.image_urls ? p.image_urls.split(',')[0] : '';
    const farmerName= `${p.first_name||''} ${p.last_name||''}`.trim();
    const badge     = p.category==='organic'?'organic':'fresh';
    const badgeTxt  = p.category==='organic'?'🍃 Organic':'✅ Fresh';
    const emoji     = catEmoji[p.category]||catEmoji.default;
    const stock     = p.quantity||0;
    const stockCls  = stock<10?'low':'';
    const stockTxt  = stock<10?`⚠ Only ${stock} kg left!`:`✓ ${stock} kg available`;
    return `<div class="product-card" style="animation-delay:${i*0.05}s" onclick="showProductModal(${JSON.stringify(p).replace(/"/g,'&quot;')})">
      <div class="product-img ${colorVariants[i%6]}" ${img?'style="padding:0"':''}>
        ${img?`<img src="${img}" alt="${p.produce}" loading="lazy">`:`<span>${emoji}</span>`}
        <span class="prod-badge ${badge}">${badgeTxt}</span>
      </div>
      <div class="product-body">
        <div class="prod-farmer">${farmerName?farmerName.toUpperCase()+' FARMS':'FARM FRESH'}</div>
        <div class="prod-name">${p.produce}${p.variety?' – '+p.variety:''}</div>
        <div class="prod-loc">📍 ${p.location||'—'}</div>
        <div class="prod-rating">★★★★★ 4.8</div>
        <div class="prod-meta">
          <div class="prod-price">₹${p.price} <span>/kg</span></div>
          <button class="prod-add" onclick="addToCart(event,${p.id},${p.price})">+</button>
        </div>
        <div class="prod-stock ${stockCls}">${stockTxt}</div>
      </div>
    </div>`;
  }).join('');
}
 
function setCat(e, el, category) {
  e.preventDefault();
  document.querySelectorAll('.cat-pill').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  searchQuery = '';
  document.getElementById('heroSearchInput').value = '';
  loadMarketProducts(category);
}
 
function quickSearch(category, term) {
  searchQuery = term;
  document.getElementById('heroSearchInput').value = term;
  document.querySelectorAll('.cat-pill').forEach(c => {
    const txt = c.querySelector('.cat-name')?.textContent.toLowerCase()||'';
    c.classList.toggle('active', txt===category||(category===''&&txt==='all'));
  });
  loadMarketProducts(category);
}
 
function searchProducts() {
  searchQuery = document.getElementById('heroSearchInput').value.trim();
  renderProducts(allProducts);
}
 
function updateDistricts() {
  const state = document.getElementById('heroState').value;
  const sel   = document.getElementById('heroDistrict');
  sel.innerHTML = '<option value="">📍 District</option>';
  if (stateDistricts[state]) {
    stateDistricts[state].forEach(d => {
      const o = document.createElement('option');
      o.value = d.toLowerCase(); o.textContent = d;
      sel.appendChild(o);
    });
  }
}
 
// ── PRODUCT MODAL ─────────────────────────────────
function showProductModal(p) {
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch{} }
  const img   = p.image_urls ? p.image_urls.split(',')[0] : '';
  const farmer= `${p.first_name||''} ${p.last_name||''}`.trim()||'Farm Fresh';
  const emoji = catEmoji[p.category]||catEmoji.default;
  document.getElementById('pmTitle').textContent = `${emoji} ${p.produce}`;
  document.getElementById('productModalBody').innerHTML = `
    <div style="background:linear-gradient(135deg,#e8f5ef,#d0ead9);border-radius:11px;height:134px;display:flex;align-items:center;justify-content:center;margin-bottom:14px;overflow:hidden">
      ${img?`<img src="${img}" style="width:100%;height:134px;object-fit:cover;border-radius:11px">`:`<span style="font-size:66px">${emoji}</span>`}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:11px">
      <div>
        <div style="font-size:10.5px;color:var(--saffron);font-weight:700;letter-spacing:1px;text-transform:uppercase">${p.category||'fresh'} · ${p.location||''}</div>
        <div style="font-size:21px;font-weight:800;font-family:'Outfit',sans-serif;color:var(--text-dark);margin-top:2px">₹${p.price} / kg</div>
        <div style="font-size:11px;color:var(--green);font-weight:600;margin-top:2px">✔ ${p.quantity||0} kg available</div>
      </div>
      <div style="text-align:right"><div style="color:var(--gold)">★★★★★</div><div style="font-size:10.5px;color:var(--text-light)">4.8 · by ${farmer}</div></div>
    </div>
    ${p.description?`<div style="font-size:12px;color:var(--text-mid);line-height:1.6;margin-bottom:14px;background:var(--cream);padding:11px;border-radius:9px">${p.description}</div>`:''}
    <div class="fm-row" style="margin-bottom:13px">
      <div class="fm-group"><label class="fm-label">Quantity (kg)</label><input class="fm-input" id="pmQty" type="number" value="1" min="1" max="${p.quantity||9999}"/></div>
      <div class="fm-group"><label class="fm-label">Grade</label><div class="fm-input" style="cursor:default">${p.grade?'Grade '+p.grade:'Standard'}</div></div>
    </div>
    <button class="btn-main" onclick="addToCartFromModal(${p.id},${p.price})">🛒 Add to Cart</button>`;
  showModal('productModal');
}
 
// ── GST RATES ─────────────────────────────────────
const GST_RATES = {
  vegetables:0, fruits:0, grains:0, pulses:0, organic:0,
  dairy:5, spices:5, dry_fruits:12, oilseeds:5, herbs:5, default:5
};
function getGstRate(category) { return GST_RATES[category] || GST_RATES.default; }
 
function calcCartTotals(items) {
  let subtotal = 0, totalTax = 0;
  const taxLines = {};
  items.forEach(item => {
    const lineTotal = item.price * item.quantity;
    const rate      = getGstRate(item.category);
    const tax       = parseFloat((lineTotal * rate / 100).toFixed(2));
    subtotal  += lineTotal;
    totalTax  += tax;
    if (rate > 0) { const k=`GST ${rate}%`; taxLines[k]=(taxLines[k]||0)+tax; }
  });
  const deliveryFee = subtotal > 0 ? (subtotal >= 500 ? 0 : 40) : 0;
  const grandTotal  = subtotal + totalTax + deliveryFee;
  return { subtotal, totalTax, taxLines, deliveryFee, grandTotal };
}
 
// ── CART ──────────────────────────────────────────
async function addToCart(e, listingId, price) {
  e.stopPropagation();
  const btn = e.currentTarget;
  try {
    const res  = await fetch('/api/cart', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({listing_id:listingId, quantity:1})
    });
    const data = await res.json();
    if (data.success) {
      btn.textContent = '✓';
      btn.style.background = 'linear-gradient(135deg,var(--green),var(--green-mid))';
      setTimeout(() => { btn.textContent='+'; btn.style.background=''; }, 1500);
      await loadCart();
      showToast('Added to cart!');
    }
  } catch(err) { showToast('Error adding to cart','error'); }
}
 
async function addToCartFromModal(listingId, price) {
  const qty = parseInt(document.getElementById('pmQty').value) || 1;
  const res  = await fetch('/api/cart', {
    method:'POST', credentials:'include',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({listing_id:listingId, quantity:qty})
  });
  const data = await res.json();
  if (data.success) {
    closeModal('productModal');
    await loadCart();
    showToast(`${qty} kg added to cart!`);
  }
}
 
async function loadCart() {
  try {
    const res = await fetch('/api/cart', {credentials:'include'});
    cartItems = await res.json();
    renderCartDropdown();
  } catch(e) {}
}
 
// ─────────────────────────────────────────────────────────────────
// FIX: renderCartDropdown — full rebuild ONLY on first render or
// structural change (items added/removed). Qty changes use
// patchCartQtyUI() for in-place DOM update (no dropdown close).
// ─────────────────────────────────────────────────────────────────
function renderCartDropdown() {
  const dd    = document.getElementById('cartDropdown');
  const badge = document.getElementById('cartBadge');
  badge.textContent = cartItems.length;
 
  if (!cartItems.length) {
    dd.innerHTML = `
      <div class="drop-header"><h4>My Cart</h4></div>
      <div class="cart-empty-state">
        <div class="cart-empty-icon">🛒</div>
        <div class="cart-empty-text">Your cart is empty</div>
        <div class="cart-empty-sub">Add fresh produce to get started!</div>
      </div>`;
    return;
  }
 
  const { subtotal, totalTax, taxLines, deliveryFee, grandTotal } = calcCartTotals(cartItems);
  const freeDeliveryLeft = subtotal < 500 ? (500 - subtotal) : 0;
 
  const itemsHTML = cartItems.map(item => {
    const img       = item.image_urls ? item.image_urls.split(',')[0] : '';
    const lineTotal = item.price * item.quantity;
    const rate      = getGstRate(item.category);
    const maxQty    = item.stock || 9999;
    return `<div class="cart-item-row" id="cart-row-${item.id}">
      <div class="cart-item-emoji">
        ${img ? `<img src="${img}" alt="${item.produce}">` : '🌾'}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.produce}</div>
        <div class="cart-item-unit">₹${item.price}/kg${rate > 0 ? ` · GST ${rate}%` : ' · 0% GST'}</div>
        <div class="cart-item-price" id="cart-price-${item.id}">₹${lineTotal.toLocaleString('en-IN')}</div>
      </div>
      <div class="cart-item-right">
        <button class="cart-remove-btn" onclick="removeFromCart(event,${item.id})" title="Remove">✕</button>
        <div class="cart-qty-ctrl">
          <button class="cart-qty-btn" id="cart-dec-${item.id}"
            onclick="updateCartQty(event,${item.id},${item.quantity - 1},${item.price},${maxQty})"
            ${item.quantity <= 1 ? 'disabled' : ''}>−</button>
          <div class="cart-qty-val" id="cart-qty-${item.id}">${item.quantity}</div>
          <button class="cart-qty-btn" id="cart-inc-${item.id}"
            onclick="updateCartQty(event,${item.id},${item.quantity + 1},${item.price},${maxQty})"
            ${item.quantity >= maxQty ? 'disabled' : ''}>+</button>
        </div>
      </div>
    </div>`;
  }).join('');
 
  const taxRowsHTML = Object.entries(taxLines).map(([label, amount]) =>
    `<div class="cart-tax-row"><span>${label}</span><span>+ ₹${amount.toFixed(2)}</span></div>`
  ).join('');
 
  const zeroGstItems = cartItems.filter(i => getGstRate(i.category) === 0);
  const zeroGstNote  = zeroGstItems.length
    ? `<div class="cart-tax-row" style="color:var(--green);font-size:10px">
        ✓ ${zeroGstItems.map(i=>i.produce).join(', ')} — GST exempt (fresh produce)
       </div>` : '';
 
  dd.innerHTML = `
    <div class="drop-header">
      <h4>My Cart (${cartItems.length} item${cartItems.length > 1 ? 's' : ''})</h4>
      <a onclick="clearCart()" style="color:var(--red)">Clear all</a>
    </div>
 
    ${freeDeliveryLeft > 0
      ? `<div style="background:linear-gradient(135deg,#fff8f0,#fef3e2);padding:7px 13px;font-size:10.5px;color:#8a5c1e;font-weight:600;display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--border)">
           🚚 Add ₹${freeDeliveryLeft} more for FREE delivery!
           <div style="flex:1;background:var(--border);border-radius:4px;height:4px;overflow:hidden;margin-left:4px">
             <div style="width:${Math.min((subtotal/500)*100,100)}%;background:var(--saffron);height:4px;border-radius:4px;transition:width .3s"></div>
           </div>
         </div>`
      : `<div style="background:linear-gradient(135deg,#e8f5ef,#d1fae5);padding:6px 13px;font-size:10.5px;color:var(--green);font-weight:700;border-bottom:1px solid var(--border)">
           🎉 You qualify for FREE delivery!
         </div>`
    }
 
    <div style="max-height:260px;overflow-y:auto" id="cartItemsList">
      ${itemsHTML}
    </div>
 
    <div class="cart-tax-breakdown" id="cartTaxBreakdown">
      <div class="cart-tax-row"><span>Subtotal (${cartItems.length} item${cartItems.length>1?'s':''})</span><span id="cartSubtotalVal">₹${subtotal.toLocaleString('en-IN')}</span></div>
      ${zeroGstNote}
      ${taxRowsHTML || `<div class="cart-tax-row" style="color:var(--green);font-size:10px">✓ All items are GST exempt</div>`}
      <div class="cart-tax-row"><span>Delivery</span><span>${deliveryFee === 0 ? '<span style="color:var(--green);font-weight:700">FREE</span>' : '₹' + deliveryFee}</span></div>
      <div class="cart-tax-row total-row">
        <span>Total Payable</span>
        <span id="cartGrandTotalVal">₹${grandTotal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
      </div>
    </div>
 
    <button class="cart-checkout" id="cartCheckoutBtn" onclick="openCheckout()">
      Proceed to Checkout · ₹${grandTotal.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})} →
    </button>`;
}
 
// ─────────────────────────────────────────────────────────────────
// FIX: In-place qty patch — updates only the changed DOM nodes,
// so the dropdown never closes.
// ─────────────────────────────────────────────────────────────────
function patchCartQtyUI(itemId, newQty, maxQty) {
  const item = cartItems.find(i => i.id === itemId);
  if (!item) return;
 
  // Update qty display
  const qtyEl = document.getElementById(`cart-qty-${itemId}`);
  if (qtyEl) qtyEl.textContent = newQty;
 
  // Update line price
  const lineTotal = item.price * newQty;
  const priceEl   = document.getElementById(`cart-price-${itemId}`);
  if (priceEl) priceEl.textContent = `₹${lineTotal.toLocaleString('en-IN')}`;
 
  // − button: update disabled state AND onclick with new qty
  const decBtn = document.getElementById(`cart-dec-${itemId}`);
  if (decBtn) {
    decBtn.disabled = newQty <= 1;
    decBtn.onclick = (e) => updateCartQty(e, itemId, newQty - 1, item.price, maxQty);
  }
 
  // + button: update disabled state AND onclick with new qty
  const incBtn = document.getElementById(`cart-inc-${itemId}`);
  if (incBtn) {
    incBtn.disabled = newQty >= maxQty;
    incBtn.onclick = (e) => updateCartQty(e, itemId, newQty + 1, item.price, maxQty);
  }
 
  // Re-calc totals and patch footer only
  const { subtotal, totalTax, taxLines, deliveryFee, grandTotal } = calcCartTotals(cartItems);
 
  const subtotalEl = document.getElementById('cartSubtotalVal');
  if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
 
  const grandEl = document.getElementById('cartGrandTotalVal');
  if (grandEl) grandEl.textContent = `₹${grandTotal.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
 
  const checkoutBtn = document.getElementById('cartCheckoutBtn');
  if (checkoutBtn) checkoutBtn.textContent = `Proceed to Checkout · ₹${grandTotal.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})} →`;
}
 
async function updateCartQty(e, itemId, newQty, pricePerUnit, maxQty) {
  // FIX: stop the click from bubbling to the document listener
  e.stopPropagation();
 
  if (newQty < 1 || newQty > maxQty) return;
 
  // Optimistic in-memory update
  cartItems = cartItems.map(item =>
    item.id === itemId ? {...item, quantity: newQty} : item
  );
 
  // In-place DOM patch (dropdown stays open)
  patchCartQtyUI(itemId, newQty, maxQty);
 
  // Sync with server in background
   try {
    const res  = await fetch(`/api/cart/${itemId}`, {
      method:  'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ quantity: newQty })
    });
    const data = await res.json();
    if (!data.success) {
      // Server rejected — revert to server state
      await loadCart();
    }
  } catch (err) {
    // Network error — revert to server state
    await loadCart();
  }
}
 
async function removeFromCart(e, itemId) {
  e.stopPropagation();
  // Optimistic remove
  cartItems = cartItems.filter(item => item.id !== itemId);
  renderCartDropdown();  // full rebuild is fine on remove
  try {
    await fetch(`/api/cart/${itemId}`, {method:'DELETE', credentials:'include'});
  } catch(err) { await loadCart(); }
}
 
async function clearCart() {
  cartItems = [];
  renderCartDropdown();
  await fetch('/api/cart/clear', {method:'DELETE', credentials:'include'});
}
 
// ── CHECKOUT ──────────────────────────────────────
function openCheckout() {
  closeDrop();
  if (!cartItems.length) { showToast('Cart is empty','error'); return; }
 
  const { subtotal, totalTax, taxLines, deliveryFee, grandTotal } = calcCartTotals(cartItems);
 
  document.getElementById('checkoutTotalVal').textContent =
    `₹${grandTotal.toLocaleString('en-IN', {minimumFractionDigits:2})}`;
 
  document.getElementById('checkoutItems').innerHTML = cartItems.map(item => {
    const img       = item.image_urls ? item.image_urls.split(',')[0] : '';
    const lineTotal = item.price * item.quantity;
    const rate      = getGstRate(item.category);
    const tax       = (lineTotal * rate / 100).toFixed(2);
    return `<div style="display:flex;gap:11px;align-items:center;padding:9px 0;border-bottom:1px solid var(--border)">
      <div style="width:42px;height:42px;border-radius:8px;overflow:hidden;background:var(--cream);display:flex;align-items:center;justify-content:center;font-size:21px;flex-shrink:0">
        ${img ? `<img src="${img}" style="width:42px;height:42px;object-fit:cover">` : '🌾'}
      </div>
      <div style="flex:1">
        <div style="font-size:12.5px;font-weight:700">${item.produce}</div>
        <div style="font-size:10.5px;color:var(--text-light)">${item.quantity} kg × ₹${item.price}${rate > 0 ? ` + GST ${rate}% (₹${tax})` : ' · GST exempt'}</div>
      </div>
      <div style="font-size:13.5px;font-weight:800;color:var(--saffron)">₹${lineTotal.toLocaleString('en-IN')}</div>
    </div>`;
  }).join('') +
  `<div style="background:var(--cream);border-radius:10px;padding:12px 14px;margin-top:10px;font-size:12px">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--text-mid)">Subtotal</span><span style="font-weight:600">₹${subtotal.toLocaleString('en-IN')}</span></div>
    ${Object.entries(taxLines).map(([k,v]) => `<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--text-light)">${k}</span><span style="color:var(--text-mid)">₹${v.toFixed(2)}</span></div>`).join('')}
    ${totalTax === 0 ? `<div style="color:var(--green);font-size:10.5px;margin-bottom:4px">✓ All items are GST exempt (fresh produce)</div>` : ''}
    <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--text-mid)">Delivery</span><span style="${deliveryFee===0?'color:var(--green);font-weight:700':''}">${deliveryFee===0?'FREE':'₹'+deliveryFee}</span></div>
    <div style="display:flex;justify-content:space-between;border-top:1.5px solid var(--border);padding-top:8px;margin-top:4px"><span style="font-weight:700;font-size:13px">Total Payable</span><span style="font-weight:800;font-size:15px;color:var(--saffron);font-family:'Outfit',sans-serif">₹${grandTotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</span></div>
  </div>`;
 
  // Populate address select from DB addresses
  const sel = document.getElementById('deliveryAddressSelect');
  sel.innerHTML = '<option value="">Select saved address…</option>';
  savedAddresses.forEach(a => {
    const opt = document.createElement('option');
    opt.value = `${a.street}, ${a.village}${a.district?', '+a.district:''}, ${a.state}${a.pincode?' – '+a.pincode:''}`;
    opt.textContent = `${(a.type||'home').toUpperCase()}: ${a.village}, ${a.state}`;
    if (a.is_default) opt.selected = true;
    sel.appendChild(opt);
  });
  const def = savedAddresses.find(a => a.is_default);
  if (def) document.getElementById('deliveryAddress').value =
    `${def.street}, ${def.village}${def.district?', '+def.district:''}, ${def.state}${def.pincode?' – '+def.pincode:''}`;
 
  showModal('checkoutModal');
}
 
function toggleCustomAddress(val) {
  if (val) document.getElementById('deliveryAddress').value = val;
}
 
async function placeOrders() {
  const delivery = document.getElementById('deliveryAddress').value.trim();
  if (!delivery) { showToast('Please enter delivery address','error'); return; }
  const btn = document.querySelector('#checkoutModal .btn-main');
  btn.textContent='⏳ Placing orders…'; btn.disabled=true;
  let success=0;
  for (const item of cartItems) {
    try {
      const res  = await fetch('/api/orders',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({listing_id:item.listing_id,quantity:item.quantity,delivery_address:delivery})});
      const data = await res.json();
      if (data.success) success++;
    } catch(e){}
  }
  if (success>0) {
    await fetch('/api/cart/clear',{method:'DELETE',credentials:'include'});
    cartItems=[];
    renderCartDropdown();
    closeModal('checkoutModal');
    showToast(`✅ ${success} order(s) placed successfully!`);
    await loadOrders();
    await loadNotifications();
  } else {
    showToast('Failed to place orders','error');
  }
  btn.textContent='✅ Confirm & Place Orders'; btn.disabled=false;
}
 
// ── ORDERS ────────────────────────────────────────
async function loadOrders() {
  try {
    const res    = await fetch('/api/orders/customer',{credentials:'include'});
    const orders = await res.json();
    renderOrders(orders.slice(0, 4), orders.length);
  } catch(e) {
    document.getElementById('ordersCard').innerHTML = `<div style="text-align:center;padding:28px;color:var(--text-light)">Unable to load orders</div>`;
  }
}
 
function renderOrders(orders, totalCount) {
  const card = document.getElementById('ordersCard');
  if (!orders.length) {
    card.innerHTML = `<div style="text-align:center;padding:44px;color:var(--text-light)">
      <div style="font-size:48px;margin-bottom:11px;opacity:.4">📦</div>
      <div style="font-size:14.5px;font-weight:700;margin-bottom:4px">No orders yet</div>
      <div style="font-size:12px">Browse fresh listings and place your first order!</div>
    </div>`;
    return;
  }
  const steps       = ['pending','accepted','ready_to_ship','shipped','delivered'];
  const stepLabels  = ['Placed','Accepted','Packed','Shipped','Delivered'];
  const stepIcons   = ['📝','✅','📦','🚚','🎉'];
  const rowsHTML = orders.map(o => {
    const img    = o.image_urls?o.image_urls.split(',')[0]:'';
    const farmer = `${o.farmer_first} ${o.farmer_last}`;
    const date   = new Date(o.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
    const curIdx = o.status==='rejected'?-1:steps.indexOf(o.status);
    const progressHTML = o.status==='rejected'
      ? `<div style="background:var(--red-light);color:var(--red);padding:7px 11px;border-radius:7px;font-size:11.5px;font-weight:700;margin-top:7px">❌ Order rejected by farmer</div>`
      : `<div class="progress-steps" style="margin-top:8px">
          ${steps.map((s,idx) => {
            const done=idx<curIdx, active=idx===curIdx;
            return `${idx>0?`<div class="ps-line ${done||active?'done':''}"></div>`:''}
              <div class="ps-step">
                <div class="ps-dot ${done?'done':active?'active':''}">${done?'✓':stepIcons[idx]}</div>
                <div class="ps-label ${done?'done':active?'active':''}">${stepLabels[idx]}</div>
              </div>`;
          }).join('')}
        </div>`;
    return `<div class="order-row">
      <div class="order-img">${img?`<img src="${img}" alt="${o.produce}">`:'🌾'}</div>
      <div class="order-info">
        <div class="o-name">${o.produce}</div>
        <div class="o-meta">#KB-${o.id} · ${farmer} · ${o.quantity} kg</div>
        <div class="o-price">₹${parseFloat(o.total_price).toLocaleString()}</div>
        ${progressHTML}
      </div>
      <div class="order-status-wrap">
        <span class="os-pill ${o.status}">${o.status.replace('_',' ')}</span>
        <div class="os-date">${date}</div>
      </div>
    </div>`;
  }).join('');
 
  card.innerHTML = rowsHTML +
    (totalCount > 4
      ? `<a class="view-all-orders-btn" href="/customer-orders">View all ${totalCount} orders →</a>`
      : `<a class="view-all-orders-btn" href="/customer-orders">View all orders →</a>`);
}
 
// ── FARMERS ───────────────────────────────────────
async function loadFarmers() {
  try {
    const res     = await fetch('/api/farmers');
    const farmers = await res.json();
    allFarmersData = farmers;
    renderFarmersGrid(farmers.slice(0,6));
  } catch(e) {}
}
 
const avatarColors = ['#e8f5ef','#fef9e7','#fdf0e8','#eff6ff','#f3e8ff','#fce7f3'];
const avatarEmojis = ['🧑‍🌾','👩‍🌾','👨‍🌾','🧑‍🌾','👩‍🌾','👨‍🌾'];
 
function renderFarmersGrid(farmers) {
  const grid = document.getElementById('farmersGrid');
  if (!farmers.length) {
    grid.innerHTML = `<div style="color:var(--text-light);font-size:12.5px">No farmers registered yet.</div>`;
    return;
  }
  grid.innerHTML = farmers.map((f,i) => {
    const name    = `${f.first_name} ${f.last_name}`;
    const loc     = f.locations?f.locations.split(',')[0].trim():'India';
    const crops   = f.produces?f.produces.split(',').slice(0,2).map(s=>s.trim()).join(', '):'Multiple crops';
    const listings= f.listing_count||0;
    return `<div class="farmer-card">
      <div class="farmer-avatar" style="background:${avatarColors[i%6]}">${avatarEmojis[i%6]}</div>
      <div class="farmer-info">
        <div class="farmer-name">${name}</div>
        <div class="farmer-loc">📍 ${loc} · ${crops}</div>
        <div class="farmer-rating">★★★★★ ${listings} listing${listings!==1?'s':''}</div>
      </div>
      <button class="farmer-follow" onclick="toggleFollow(this)">${i%3===0?'Following':'+ Follow'}</button>
    </div>`;
  }).join('');
}
 
function openAllFarmersModal() {
  renderAllFarmers();
  showModal('allFarmersModal');
}
 
function renderAllFarmers() {
  const q    = (document.getElementById('farmerSearchInput')?.value||'').toLowerCase().trim();
  const grid = document.getElementById('allFarmersGrid');
  let data   = allFarmersData;
  if (q) data = data.filter(f => `${f.first_name} ${f.last_name}`.toLowerCase().includes(q) || (f.locations||'').toLowerCase().includes(q) || (f.produces||'').toLowerCase().includes(q));
 
  if (!data.length) {
    grid.innerHTML = `<div style="color:var(--text-light);text-align:center;padding:28px;grid-column:span 2">No farmers found</div>`;
    return;
  }
  grid.innerHTML = data.map((f,i) => {
    const name   = `${f.first_name} ${f.last_name}`;
    const loc    = f.locations?f.locations.split(',')[0].trim():'India';
    const crops  = f.produces?f.produces.split(',').slice(0,3).map(s=>s.trim()).join(', '):'Multiple crops';
    const listings=f.listing_count||0;
    return `<div class="farmer-modal-card">
      <div class="fmc-avatar" style="background:${avatarColors[i%6]}">${avatarEmojis[i%6]}</div>
      <div class="fmc-info">
        <div class="fmc-name">${name}</div>
        <div class="fmc-loc">📍 ${loc} · ${listings} listing${listings!==1?'s':''}</div>
        <div class="fmc-crops">🌱 ${crops}</div>
      </div>
      <button class="fmc-follow" onclick="this.classList.toggle('followed');this.textContent=this.classList.contains('followed')?'Following':'+ Follow'">${i%3===0?'Following':'+ Follow'}</button>
    </div>`;
  }).join('');
}
 
function toggleFollow(btn) {
  btn.classList.toggle('followed');
  btn.textContent = btn.classList.contains('followed') ? 'Following' : '+ Follow';
}
 
// ── ORDER TRACK ───────────────────────────────────
async function trackOrder() {
  const val  = document.getElementById('orderSearchInput').value.trim();
  const id   = val.replace(/[^\d]/g,'');
  if (!id) { showToast('Enter a valid order ID','error'); return; }
  const res    = await fetch('/api/orders/customer',{credentials:'include'});
  const orders = await res.json();
  const order  = orders.find(o=>String(o.id)===id);
  const result  = document.getElementById('orderTrackResult');
  const content = document.getElementById('orderTrackContent');
  result.style.display='block';
  if (!order) { content.innerHTML=`<div style="color:var(--red);font-size:12px;font-weight:700">⚠ Order #${id} not found</div>`; return; }
  const statusMap={pending:'📝 Placed',accepted:'✅ Accepted',rejected:'❌ Rejected',ready_to_ship:'📦 Ready to Ship',shipped:'🚚 Out for Delivery',delivered:'🎉 Delivered'};
  content.innerHTML=`
    <div style="font-size:12px;font-weight:700;color:var(--text-dark);margin-bottom:7px">${order.produce} · ${order.quantity} kg · #KB-${order.id}</div>
    <div class="tstat-row"><div class="tstat-dot done"></div><span style="font-size:11px;font-weight:600;color:var(--text-dark)">Order placed</span></div>
    <div class="tstat-row"><div class="tstat-dot ${['accepted','ready_to_ship','shipped','delivered'].includes(order.status)?'done':'active'}"></div><span style="font-size:11px;color:var(--text-mid)">${statusMap[order.status]||order.status}</span></div>
    <div style="margin-top:7px;padding:7px 10px;background:${order.status==='delivered'?'#d1fae5':order.status==='rejected'?'var(--red-light)':'var(--cream)'};border-radius:7px;font-size:11px;font-weight:700;color:${order.status==='delivered'?'var(--green)':order.status==='rejected'?'var(--red)':'var(--text-mid)'}">
      ${order.status==='delivered'?'🎉 Delivered!':order.status==='rejected'?'❌ Rejected':'⏳ In progress'}
    </div>`;
}
 
// ══════════════════════════════════════════════════
// ADDRESSES — now backed by /api/addresses (DB)
// localStorage is no longer used for addresses.
// ══════════════════════════════════════════════════
 
async function loadAddresses() {
  try {
    const res = await fetch('/api/addresses', {credentials:'include'});
    if (!res.ok) { savedAddresses = []; return; }
    savedAddresses = await res.json();
  } catch(e) { savedAddresses = []; }
}
 
function openAddressModal() {
  renderSavedAddressList();
  document.getElementById('addressForm').reset();
  showModal('addressModal');
}
 
function renderSavedAddressList() {
  const container = document.getElementById('savedAddressList');
  if (!savedAddresses.length) {
    container.innerHTML = `<div style="text-align:center;padding:11px;color:var(--text-light);font-size:12px">No saved addresses yet.</div>`;
    return;
  }
  const typeEmoji = {home:'🏠',work:'🏢',farm:'🌾',other:'📍'};
  container.innerHTML = `
    <div style="font-size:11.5px;font-weight:700;color:var(--text-dark);margin-bottom:9px">Saved (${savedAddresses.length})</div>
    <div style="display:flex;flex-direction:column;gap:7px">
      ${savedAddresses.map(a => `
        <div style="display:flex;align-items:center;gap:9px;padding:9px 12px;border-radius:10px;border:1.5px solid ${a.is_default?'var(--saffron)':'var(--border)'};background:${a.is_default?'var(--saffron-light)':'var(--cream)'}">
          <span style="font-size:17px">${typeEmoji[a.type]||'📍'}</span>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700;color:var(--text-dark)">${a.name||'—'} ${a.is_default?'<span style="font-size:9px;background:var(--saffron);color:#fff;padding:1px 6px;border-radius:7px;margin-left:3px">Default</span>':''}</div>
            <div style="font-size:10.5px;color:var(--text-mid);margin-top:1px">${a.street?a.street+', ':''}${a.village||''}${a.state?', '+a.state:''} ${a.pincode?'– '+a.pincode:''}</div>
          </div>
          <div style="display:flex;gap:5px">
            ${!a.is_default?`<button onclick="setDefaultAddr(${a.id})" style="padding:3px 9px;border-radius:6px;background:var(--saffron-light);border:1px solid rgba(232,98,10,.25);color:var(--saffron);font-size:9.5px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif">⭐ Default</button>`:''}
            <button onclick="deleteAddr(${a.id})" style="padding:3px 7px;border-radius:6px;background:var(--red-light);border:none;color:var(--red);font-size:12px;cursor:pointer">✕</button>
          </div>
        </div>`).join('')}
    </div>`;
}
 
async function saveNewAddress(e) {
  e.preventDefault();
  const payload = {
    type:       document.getElementById('addr_type').value,
    name:       document.getElementById('addr_name').value.trim(),
    phone:      document.getElementById('addr_phone').value.trim(),
    street:     document.getElementById('addr_street').value.trim(),
    village:    document.getElementById('addr_village').value.trim(),
    district:   document.getElementById('addr_district').value.trim(),
    pincode:    document.getElementById('addr_pincode').value.trim(),
    state:      document.getElementById('addr_state').value,
    is_default: document.getElementById('addr_default').checked
  };
 
  if (!payload.street || !payload.village || !payload.state) {
    showToast('Street, city and state are required','error'); return;
  }
 
  const btn = e.submitter || document.querySelector('#addressForm button[type="submit"]');
  const origText = btn.textContent;
  btn.textContent = '⏳ Saving…'; btn.disabled = true;
 
  try {
    const res  = await fetch('/api/addresses', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      await loadAddresses();          // refresh from DB
      renderSavedAddressList();
      document.getElementById('addressForm').reset();
      showToast('✅ Address saved!');
    } else {
      showToast(data.error || 'Could not save address', 'error');
    }
  } catch(err) {
    showToast('Server error — could not save address', 'error');
  } finally {
    btn.textContent = origText; btn.disabled = false;
  }
}
 
async function setDefaultAddr(id) {
  try {
    await fetch(`/api/addresses/${id}/default`, {method:'PUT', credentials:'include'});
    await loadAddresses();
    renderSavedAddressList();
    showToast('✅ Default address updated');
  } catch(e) { showToast('Error updating default','error'); }
}
 
async function deleteAddr(id) {
  try {
    await fetch(`/api/addresses/${id}`, {method:'DELETE', credentials:'include'});
    await loadAddresses();
    renderSavedAddressList();
  } catch(e) { showToast('Error deleting address','error'); }
}
 
// ── SETTINGS ──────────────────────────────────────
function openSettings() { document.getElementById('settingsOverlay').classList.add('open'); document.body.style.overflow='hidden'; }
function closeSettings() { document.getElementById('settingsOverlay').classList.remove('open'); document.body.style.overflow=''; }
function checkSettingsClose(e) { if (e.target===document.getElementById('settingsOverlay')) closeSettings(); }
 
// ── DELETE ACCOUNT ────────────────────────────────
function showDeleteModal() { closeSettings(); setTimeout(()=>showModal('deleteModal'),200); }
async function deleteAccount() {
  const pw = document.getElementById('deletePassword').value;
  if (!pw) { showToast('Please enter your password','error'); return; }
  try {
    const res  = await fetch('/api/account',{method:'DELETE',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});
    const data = await res.json();
    if (data.success) { showToast('Account deleted successfully'); setTimeout(()=>window.location.href='/login',1500); }
    else showToast(data.error||'Incorrect password','error');
  } catch(err) { showToast('Server error','error'); }
}
 
function togglePw(id, btn) {
  const inp = document.getElementById(id);
  if (inp.type==='password') { inp.type='text'; btn.textContent='🙈'; }
  else { inp.type='password'; btn.textContent='👁'; }
}
 
// ── MODAL HELPERS ─────────────────────────────────
function showModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if(e.target===o) o.classList.remove('active'); });
});
 
function showToast(msg, type='') {
  const wrap = document.getElementById('toastWrap');
  const t    = document.createElement('div');
  t.className='toast'+(type?' '+type:'');
  t.textContent=msg;
  wrap.appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),300); },3500);
}