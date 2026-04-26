/* ══════════════════════════════
   STATE
══════════════════════════════ */
let allUsers=[],allListings=[],allOrders=[],allTickets=[],allFAQs=[],allContacts=[];
let broadcastHistory=[];
let marketPrices={};

const defaultMarketPrices={
  vegetables:[
    {emoji:'🍅',name:'Tomatoes',loc:'Nashik APMC',price:48,unit:'kg'},
    {emoji:'🧅',name:'Onions',loc:'Lasalgaon',price:36,unit:'kg'},
    {emoji:'🥔',name:'Potato',loc:'Sinnar',price:22,unit:'kg'},
    {emoji:'🥕',name:'Carrots',loc:'Malegaon',price:28,unit:'kg'},
    {emoji:'🧄',name:'Garlic',loc:'Lasalgaon',price:180,unit:'kg'},
    {emoji:'🥦',name:'Cauliflower',loc:'Nashik',price:30,unit:'kg'},
  ],
  grains:[
    {emoji:'🌾',name:'Wheat',loc:'Niphad',price:32,unit:'kg'},
    {emoji:'🌽',name:'Maize',loc:'Nashik',price:24,unit:'kg'},
    {emoji:'🫘',name:'Toor Dal',loc:'Yeola',price:95,unit:'kg'},
    {emoji:'🫘',name:'Chana Dal',loc:'Nashik',price:85,unit:'kg'},
    {emoji:'🌾',name:'Rice',loc:'Kolhapur',price:42,unit:'kg'},
  ],
  spices:[
    {emoji:'🌶️',name:'Red Chilli',loc:'Dindori',price:320,unit:'kg'},
    {emoji:'🌿',name:'Coriander',loc:'Nashik',price:45,unit:'kg'},
    {emoji:'🫚',name:'Cumin',loc:'Nashik',price:210,unit:'kg'},
    {emoji:'🟡',name:'Turmeric',loc:'Sangli',price:130,unit:'kg'},
  ],
  fruits:[
    {emoji:'🥭',name:'Mangoes',loc:'Ratnagiri',price:120,unit:'kg'},
    {emoji:'🍊',name:'Oranges',loc:'Nagpur',price:55,unit:'kg'},
    {emoji:'🍇',name:'Grapes',loc:'Nashik',price:75,unit:'kg'},
    {emoji:'🍌',name:'Bananas',loc:'Jalgaon',price:35,unit:'kg'},
  ]
};

/* ══ THEME TOGGLE ══ */
function toggleTheme(){
  const html=document.documentElement;
  const isDark=html.getAttribute('data-theme')==='dark';
  if(isDark){
    html.removeAttribute('data-theme');
    document.getElementById('themeLabel').textContent='LIGHT';
    localStorage.setItem('agrohub_theme','light');
  } else {
    html.setAttribute('data-theme','dark');
    document.getElementById('themeLabel').textContent='DARK';
    localStorage.setItem('agrohub_theme','dark');
  }
}

/* ══ INIT ══ */
document.addEventListener('DOMContentLoaded',async()=>{
  const savedTheme=localStorage.getItem('agrohub_theme');
  if(savedTheme==='dark'){
    document.documentElement.setAttribute('data-theme','dark');
    document.getElementById('themeLabel').textContent='DARK';
  }
  document.getElementById('dashDate').textContent=new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const mp=localStorage.getItem('agrohub_market_prices');
  marketPrices=mp?JSON.parse(mp):JSON.parse(JSON.stringify(defaultMarketPrices));
  await refreshAll();
  loadAdminInfo();

  // Live validation on admin modal inputs
  ['eu_email','au_email'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener('blur',()=>{
      if(el.value&&!isValidEmail(el.value)) el.style.borderColor='var(--red)';
      else if(el.value) el.style.borderColor='var(--green)';
    });
  });
  ['eu_phone','au_phone'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener('blur',()=>{
      if(el.value&&!isValidPhone(el.value)) el.style.borderColor='var(--red)';
      else if(el.value) el.style.borderColor='var(--green)';
    });
  });
});

async function refreshAll(){
  await Promise.all([loadUsers(),loadListings(),loadOrders(),loadTickets(),loadFAQs(),loadContacts()]);
  renderDashboard();
  renderMarketPrices();
}

/* ══ API HELPER ══ */
async function api(url,opts={}){
  try{const res=await fetch(url,{credentials:'include',...opts});return await res.json();}
  catch(e){return null;}
}

/* ══ DATA LOADERS ══ */
async function loadUsers(){
  const d=await api('/api/admin/users');
  allUsers=Array.isArray(d)?d:[];
  updateSidebarCounts();
  renderUsersTable();
  renderRoleTable('farmer');
  renderRoleTable('customer');
  renderRoleTable('service_provider');
}
async function loadListings(){const d=await api('/api/admin/listings');allListings=Array.isArray(d)?d:[];renderListingsTable();}
async function loadOrders(){const d=await api('/api/admin/orders');allOrders=Array.isArray(d)?d:[];renderOrdersTable();}
async function loadTickets(){const d=await api('/api/admin/tickets');allTickets=Array.isArray(d)?d:[];renderTicketsTable();}
async function loadFAQs(){const d=await api('/api/admin/faqs');allFAQs=Array.isArray(d)?d:[];renderFAQTable();}

/* ══ VIEW SWITCHER ══ */
function switchView(id,btn){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.sb-link').forEach(b=>b.classList.remove('active'));
  const el=document.getElementById('view-'+id);
  if(el)el.classList.add('active');
  if(btn)btn.classList.add('active');
}

/* ══ SIDEBAR COUNTS ══ */
function updateSidebarCounts(){
  const c={users:0,farmers:0,customers:0,providers:0};
  allUsers.forEach(u=>{
    c.users++;
    if(u.role==='farmer')c.farmers++;
    else if(u.role==='customer')c.customers++;
    else if(u.role==='service_provider')c.providers++;
  });
  setText('sb-users',c.users);
  setText('sb-farmers',c.farmers);
  setText('sb-customers',c.customers);
  setText('sb-providers',c.providers);
  setText('sb-listings',allListings.length);
  setText('sb-orders',allOrders.length);
  const open=allTickets.filter(t=>t.status==='open').length;
  setText('sb-tickets',open);
  const unreadContacts=allContacts.filter(c=>!c.is_read).length;
  setText('sb-contacts', unreadContacts);

  const totalNotifs = open + unreadContacts;
  const nb=document.getElementById('notifCount');
  if(totalNotifs>0){nb.textContent=totalNotifs;nb.style.display='grid';}
  else nb.style.display='none';
}

/* ══ EYE BUTTON HELPERS ══ */
function eyeBtn(userId){
  return `<button class="ic-btn view" data-tip="View Details" onclick="handleEyeClick(this,${userId})" title="View Details">
    <svg class="eye-closed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
    <svg class="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  </button>`;
}

function ticketEyeBtn(ticketId){
  return `<button class="ic-btn view" data-tip="View Ticket" onclick="handleTicketEyeClick(this,${ticketId})" title="View Ticket">
    <svg class="eye-closed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
    <svg class="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  </button>`;
}

function handleEyeClick(btn,userId){
  const wasOpen=btn.classList.contains('is-open');
  document.querySelectorAll('.ic-btn.view').forEach(b=>b.classList.remove('is-open'));
  if(!wasOpen){btn.classList.add('is-open');openUserDetail(userId);}
  else closeModal('userDetailModal');
}

function handleTicketEyeClick(btn,ticketId){
  const wasOpen=btn.classList.contains('is-open');
  document.querySelectorAll('.ic-btn.view').forEach(b=>b.classList.remove('is-open'));
  if(!wasOpen){btn.classList.add('is-open');openTicketModal(ticketId);}
  else closeModal('ticketModal');
}

/* ══ MODAL HELPERS ══ */
function showModal(id){document.getElementById(id).classList.add('active');}
function closeModal(id){
  document.getElementById(id).classList.remove('active');
  document.querySelectorAll('.ic-btn.view').forEach(b=>b.classList.remove('is-open'));
}
document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{
  if(e.target===o){o.classList.remove('active');document.querySelectorAll('.ic-btn.view').forEach(b=>b.classList.remove('is-open'));}
}));

/* ══ DASHBOARD ══ */
function renderDashboard(){
  const farmers=allUsers.filter(u=>u.role==='farmer').length;
  const customers=allUsers.filter(u=>u.role==='customer').length;
  const providers=allUsers.filter(u=>u.role==='service_provider').length;
  const openTix=allTickets.filter(t=>t.status==='open').length;
  const activeListings=allListings.filter(l=>l.status==='active').length;
  const delivered=allOrders.filter(o=>o.status==='delivered');
  const revenue=delivered.reduce((s,o)=>s+parseFloat(o.total_price||0),0);

  document.getElementById('kpiGrid').innerHTML=`
    <div class="kpi-card"><div class="kpi-top"><div><div class="kpi-label">Total Users</div></div><div class="kpi-icon-box">👥</div></div><div class="kpi-val">${allUsers.length}</div><div class="kpi-meta">${farmers} farmers · ${customers} customers</div></div>
    <div class="kpi-card"><div class="kpi-top"><div><div class="kpi-label">Active Listings</div></div><div class="kpi-icon-box">📦</div></div><div class="kpi-val">${activeListings}</div><div class="kpi-meta">of ${allListings.length} total listings</div></div>
    <div class="kpi-card"><div class="kpi-top"><div><div class="kpi-label">Total Orders</div></div><div class="kpi-icon-box">🧾</div></div><div class="kpi-val">${allOrders.length}</div><div class="kpi-meta">${delivered.length} delivered</div></div>
    <div class="kpi-card"><div class="kpi-top"><div><div class="kpi-label">Open Tickets</div></div><div class="kpi-icon-box">🎫</div></div><div class="kpi-val">${openTix}</div><div class="kpi-meta">${allTickets.length} total tickets</div></div>`;

  document.getElementById('userStats').innerHTML=`
    <div class="stat-mini-item"><div class="sm-icon">🧑‍🌾</div><div><div class="sm-label">Farmers</div><div class="sm-val">${farmers}</div></div></div>
    <div class="stat-mini-item"><div class="sm-icon">🛒</div><div><div class="sm-label">Customers</div><div class="sm-val">${customers}</div></div></div>
    <div class="stat-mini-item"><div class="sm-icon">🛠️</div><div><div class="sm-label">Providers</div><div class="sm-val">${providers}</div></div></div>`;

  const recent=allOrders.slice(0,6);
  document.getElementById('recentOrdersTable').innerHTML=`
    <thead><tr><th>Order</th><th>Produce</th><th>Amount</th><th>Status</th></tr></thead>
    <tbody>${recent.map(o=>`<tr>
      <td><div class="cell-name">#KB-${o.id}</div><div class="cell-sub">${fmtDate(o.created_at)}</div></td>
      <td>${esc(o.produce||'—')}</td>
      <td style="font-weight:700;color:var(--accent)">₹${parseFloat(o.total_price||0).toLocaleString()}</td>
      <td>${statusPill(o.status)}</td>
    </tr>`).join('')}
    ${!recent.length?'<tr><td colspan="4" style="text-align:center;padding:28px;color:var(--text-dim)">No orders yet</td></tr>':''}</tbody>`;

  const openTickets=allTickets.filter(t=>t.status==='open').slice(0,5);
  document.getElementById('openTicketsTable').innerHTML=`
    <thead><tr><th>ID</th><th>Subject</th><th>Priority</th><th>Action</th></tr></thead>
    <tbody>${openTickets.map(t=>`<tr>
      <td><div class="cell-name">#${t.id}</div></td>
      <td style="max-width:220px"><div style="font-size:12.5px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.subject)}</div></td>
      <td>${priorityPill(t.priority)}</td>
      <td>${ticketEyeBtn(t.id)}</td>
    </tr>`).join('')}
    ${!openTickets.length?'<tr><td colspan="4" style="text-align:center;padding:28px;color:var(--text-dim)">No open tickets 🎉</td></tr>':''}</tbody>`;

  const snap=marketPrices.vegetables?.slice(0,4)||[];
  document.getElementById('marketSnapshot').innerHTML=snap.map(p=>`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">${p.emoji}</span><span style="font-size:12.5px;font-weight:600;color:var(--text)">${p.name}</span></div>
      <span style="font-size:13px;font-weight:700;color:var(--accent)">₹${p.price}/${p.unit}</span>
    </div>`).join('');

  document.getElementById('platformStats').innerHTML=`
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)"><span style="font-size:12.5px;color:var(--text-dim)">Est. Revenue</span><span style="font-size:13px;font-weight:700;color:var(--accent)">₹${revenue.toLocaleString()}</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)"><span style="font-size:12.5px;color:var(--text-dim)">Pending Orders</span><span style="font-size:13px;font-weight:700;color:var(--amber)">${allOrders.filter(o=>o.status==='pending').length}</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)"><span style="font-size:12.5px;color:var(--text-dim)">Resolved Tickets</span><span style="font-size:13px;font-weight:700;color:var(--green)">${allTickets.filter(t=>t.status==='resolved').length}</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 0"><span style="font-size:12.5px;color:var(--text-dim)">Total Listings</span><span style="font-size:13px;font-weight:700;color:var(--blue)">${allListings.length}</span></div>
    </div>`;
}

/* ══ USERS TABLE ══ */
function renderUsersTable(){
  const search=(document.getElementById('usersSearch')?.value||'').toLowerCase();
  const role=document.getElementById('usersRoleFilter')?.value||'';
  const sort=document.getElementById('usersSort')?.value||'newest';
  let data=allUsers.filter(u=>{
    const ms=!search||`${u.first_name} ${u.last_name} ${u.email} ${u.phone||''}`.toLowerCase().includes(search);
    return ms&&(!role||u.role===role);
  });
  if(sort==='name')data.sort((a,b)=>(`${a.first_name} ${a.last_name}`).localeCompare(`${b.first_name} ${b.last_name}`));
  else if(sort==='oldest')data.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  else data.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  setText('usersCountLabel',`(${data.length} users)`);
  document.getElementById('usersTable').innerHTML=`
    <thead><tr><th>User</th><th>Role</th><th>Phone</th><th>Location</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${data.map(u=>`<tr>
      <td><div class="cell-img">
        <div class="avatar-sm">${u.profile_img?`<img src="${u.profile_img}">`:(u.first_name[0]||'').toUpperCase()}</div>
        <div><div class="cell-name">${esc(u.first_name)} ${esc(u.last_name)}</div><div class="cell-sub">${esc(u.email)}</div></div>
      </div></td>
      <td><span class="role-badge ${u.role}">${u.role.replace('_',' ')}</span></td>
      <td style="font-size:12px">${u.phone||'—'}</td>
      <td style="font-size:12px">${u.state||u.district||'—'}</td>
      <td style="font-size:11.5px;color:var(--text-dim)">${fmtDate(u.created_at)}</td>
      <td><span class="pill green">Active</span></td>
      <td><div class="action-cell">
        ${eyeBtn(u.id)}
        <button class="ic-btn edit" onclick="openEditUser(${u.id})" title="Edit User">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="ic-btn del" onclick="confirmDeleteUser(${u.id},'${esc(u.first_name)} ${esc(u.last_name)}')" title="Delete User">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div></td>
    </tr>`).join('')}
    ${!data.length?'<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim)">No users found</td></tr>':''}</tbody>`;
}
function filterUsersTable(){renderUsersTable();}

/* ══ ROLE TABLES ══ */
function renderRoleTable(role){
  const keyMap={farmer:'farmers',customer:'customers',service_provider:'providers'};
  const key=keyMap[role];
  const searchId=role==='service_provider'?'providersSearch':key+'Search';
  const search=(document.getElementById(searchId)||{value:''}).value.toLowerCase();
  const data=allUsers.filter(u=>u.role===role&&(!search||`${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search)));
  setText(key+'CountLabel',`(${data.length})`);
  const html=`<thead><tr><th>User</th><th>Email</th><th>Phone</th><th>Location</th><th>Joined</th><th>Actions</th></tr></thead>
    <tbody>${data.map(u=>`<tr>
      <td><div class="cell-img">
        <div class="avatar-sm">${u.profile_img?`<img src="${u.profile_img}">`:(u.first_name[0]||'').toUpperCase()}</div>
        <div><div class="cell-name">${esc(u.first_name)} ${esc(u.last_name)}</div><div class="cell-sub">${u.district||'—'}</div></div>
      </div></td>
      <td style="font-size:12px">${esc(u.email)}</td>
      <td style="font-size:12px">${u.phone||'—'}</td>
      <td style="font-size:12px">${u.state||'—'}</td>
      <td style="font-size:11.5px;color:var(--text-dim)">${fmtDate(u.created_at)}</td>
      <td><div class="action-cell">
        ${eyeBtn(u.id)}
        <button class="ic-btn edit" onclick="openEditUser(${u.id})" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="ic-btn del" onclick="confirmDeleteUser(${u.id},'${esc(u.first_name)} ${esc(u.last_name)}')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div></td>
    </tr>`).join('')}
    ${!data.length?`<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim)">No ${role.replace('_',' ')}s found</td></tr>`:''}</tbody>`;
  const tbl=document.getElementById(key+'Table');
  if(tbl)tbl.innerHTML=html;
}
function filterRoleTable(role){renderRoleTable(role);}

/* ══ USER DETAIL MODAL ══ */
function openUserDetail(id){
  const u=allUsers.find(x=>x.id===id);if(!u)return;
  const userListings=allListings.filter(l=>l.user_id===id);
  const userOrders=allOrders.filter(o=>o.customer_id===id||o.farmer_id===id);
  document.getElementById('userDetailBody').innerHTML=`
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--border)">
      <div class="avatar-sm" style="width:56px;height:56px;border-radius:16px;font-size:22px">${u.profile_img?`<img src="${u.profile_img}" style="width:56px;height:56px">`:(u.first_name[0]||'').toUpperCase()}</div>
      <div>
        <div style="font-size:19px;font-weight:800;color:var(--text)">${esc(u.first_name)} ${esc(u.last_name)}</div>
        <div style="font-size:12px;color:var(--text-dim);margin-top:2px">${esc(u.email)}</div>
        <span class="role-badge ${u.role}" style="margin-top:6px;display:inline-block">${u.role.replace('_',' ')}</span>
      </div>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="btn btn-outline btn-sm" onclick="openEditUser(${u.id});closeModal('userDetailModal')">✏️ Edit</button>
        <button class="btn btn-red btn-sm" onclick="confirmDeleteUser(${u.id},'${esc(u.first_name)} ${esc(u.last_name)}');closeModal('userDetailModal')">🗑️</button>
      </div>
    </div>
    <div class="user-detail-grid">
      ${[['Phone',u.phone||'—'],['Gender',u.gender||'—'],['DOB',u.dob||'—'],['Joined',fmtDate(u.created_at)],['Village',u.village||'—'],['District',u.district||'—'],['State',u.state||'—'],['Pincode',u.pincode||'—']].map(([k,v])=>`<div class="ud-item"><div class="ud-label">${k}</div><div class="ud-val">${v}</div></div>`).join('')}
    </div>
    <div style="display:flex;gap:12px;margin-bottom:16px">
      <div class="stat-mini-item"><div class="sm-icon">📦</div><div><div class="sm-label">Listings</div><div class="sm-val">${userListings.length}</div></div></div>
      <div class="stat-mini-item"><div class="sm-icon">🧾</div><div><div class="sm-label">Orders</div><div class="sm-val">${userOrders.length}</div></div></div>
    </div>`;
  showModal('userDetailModal');
}

/* ══ EDIT USER ══ */
function openEditUser(id){
  const u=allUsers.find(x=>x.id===id);if(!u)return;
  document.getElementById('eu_user_id').value=id;
  document.getElementById('eu_first').value=u.first_name||'';
  document.getElementById('eu_last').value=u.last_name||'';
  document.getElementById('eu_email').value=u.email||'';
  document.getElementById('eu_phone').value=u.phone||'';
  document.getElementById('eu_state').value=u.state||'';
  document.getElementById('eu_district').value=u.district||'';
  showModal('editUserModal');
}
async function saveEditUser(){
  const emailInp=document.getElementById('eu_email');
  const phoneInp=document.getElementById('eu_phone');
  let valid=true;
  if(!isValidEmail(emailInp.value)){
    emailInp.style.borderColor='var(--red)';
    showToast('Invalid email address','error');
    valid=false;
  } else emailInp.style.borderColor='var(--green)';
  if(phoneInp.value.trim() && !isValidPhone(phoneInp.value)){
    phoneInp.style.borderColor='var(--red)';
    showToast('Invalid phone number (10-digit Indian mobile)','error');
    valid=false;
  } else if(phoneInp.value.trim()) phoneInp.style.borderColor='var(--green)';
  if(!valid) return;

  const id=parseInt(document.getElementById('eu_user_id').value);
  const payload={
    first_name:document.getElementById('eu_first').value.trim(),
    last_name:document.getElementById('eu_last').value.trim(),
    email:emailInp.value.trim(),
    phone:phoneInp.value.trim(),
    state:document.getElementById('eu_state').value.trim(),
    district:document.getElementById('eu_district').value.trim()
  };
  const res=await api(`/api/admin/users/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(res?.success){showToast('✅ User updated','success');closeModal('editUserModal');await loadUsers();}
  else showToast(res?.error||'Failed','error');
}

/* ══ DELETE USER ══ */
function confirmDeleteUser(id,name){
  document.getElementById('confirmIcon').textContent='🗑️';
  document.getElementById('confirmTitle').textContent='Delete User?';
  document.getElementById('confirmMsg').textContent=`Are you sure you want to permanently delete "${name}"? This will remove all their data.`;
  document.getElementById('confirmActionBtn').textContent='Delete User';
  document.getElementById('confirmActionBtn').onclick=async()=>{
    const res=await api(`/api/admin/users/${id}`,{method:'DELETE'});
    if(res?.success){showToast('🗑️ User deleted','warn');closeModal('confirmModal');await loadUsers();renderDashboard();}
    else showToast(res?.error||'Failed','error');
  };
  showModal('confirmModal');
}

/* ══ ADD ADMIN USER ══ */
function openAddUserModal(){showModal('addUserModal');}
async function createAdminUser(){
  const emailInp=document.getElementById('au_email');
  const phoneInp=document.getElementById('au_phone');
  const first=document.getElementById('au_first').value.trim();
  const pass=document.getElementById('au_pass').value;
  let valid=true;
  if(!first){showToast('First name is required','error');valid=false;}
  if(!isValidEmail(emailInp.value)){
    emailInp.style.borderColor='var(--red)';
    showToast('Invalid email address','error');
    valid=false;
  } else emailInp.style.borderColor='var(--green)';
  if(phoneInp.value.trim() && !isValidPhone(phoneInp.value)){
    phoneInp.style.borderColor='var(--red)';
    showToast('Invalid phone number','error');
    valid=false;
  } else if(phoneInp.value.trim()) phoneInp.style.borderColor='var(--green)';
  if(!pass || pass.length<6){showToast('Password must be at least 6 characters','error');valid=false;}
  if(!valid) return;

  const payload={
    first_name:first,
    last_name:document.getElementById('au_last').value.trim(),
    email:emailInp.value.trim(),
    phone:phoneInp.value.trim()||null,
    password:pass,
    role:'admin'
  };
  const res=await api('/api/admin/create-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(res?.success){showToast('✅ Admin user created','success');closeModal('addUserModal');await loadUsers();}
  else showToast(res?.error||'Failed','error');
}

/* ══ LISTINGS ══ */
function renderListingsTable(){
  const search=(document.getElementById('listingsSearch')?.value||'').toLowerCase();
  const status=document.getElementById('listingsStatus')?.value||'';
  const category=document.getElementById('listingsCategory')?.value||'';
  let data=allListings.filter(l=>{
    const ms=!search||`${l.produce||''} ${l.first_name||''} ${l.last_name||''} ${l.location||''}`.toLowerCase().includes(search);
    return ms&&(!status||l.status===status)&&(!category||l.category===category);
  });
  setText('listingsCountLabel',`(${data.length})`);
  document.getElementById('listingsTable').innerHTML=`
    <thead><tr><th>Produce</th><th>Farmer</th><th>Category</th><th>Price</th><th>Qty</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${data.map(l=>`<tr>
      <td><div class="cell-name">${esc(l.produce||'—')}</div><div class="cell-sub">${l.variety||''}</div></td>
      <td style="font-size:12px">${esc(l.first_name||'')} ${esc(l.last_name||'')}</td>
      <td><span class="pill dim">${l.category||'—'}</span></td>
      <td style="font-weight:700;color:var(--accent)">₹${l.price||0}/kg</td>
      <td style="font-size:12px">${l.quantity||0} kg</td>
      <td style="font-size:11.5px;color:var(--text-dim);max-width:120px">${l.location||'—'}</td>
      <td>${l.status==='active'?'<span class="pill green">Active</span>':'<span class="pill dim">Inactive</span>'}</td>
      <td><div class="action-cell">
        <button class="ic-btn del" onclick="confirmDeleteListing(${l.id},'${esc(l.produce||'')}')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div></td>
    </tr>`).join('')}
    ${!data.length?'<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-dim)">No listings found</td></tr>':''}</tbody>`;
}
function filterListings(){renderListingsTable();}
function confirmDeleteListing(id,name){
  document.getElementById('confirmIcon').textContent='📦';
  document.getElementById('confirmTitle').textContent='Delete Listing?';
  document.getElementById('confirmMsg').textContent=`Remove listing "${name}"? This cannot be undone.`;
  document.getElementById('confirmActionBtn').textContent='Delete Listing';
  document.getElementById('confirmActionBtn').onclick=async()=>{
    const res=await api(`/api/admin/listings/${id}`,{method:'DELETE'});
    if(res?.success){showToast('🗑️ Listing removed','warn');closeModal('confirmModal');await loadListings();renderDashboard();}
    else showToast('Failed','error');
  };
  showModal('confirmModal');
}

/* ══ ORDERS ══ */
function renderOrdersTable(){
  const search=(document.getElementById('ordersSearch')?.value||'').toLowerCase();
  const status=document.getElementById('ordersStatus')?.value||'';
  let data=allOrders.filter(o=>(!search||`${o.produce||''} #KB-${o.id}`.toLowerCase().includes(search))&&(!status||o.status===status));
  setText('ordersCountLabel',`(${data.length})`);
  document.getElementById('ordersTable').innerHTML=`
    <thead><tr><th>Order</th><th>Produce</th><th>Customer</th><th>Farmer</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
    <tbody>${data.map(o=>`<tr>
      <td><div class="cell-name">#KB-${o.id}</div></td>
      <td style="font-size:12.5px;color:var(--text)">${esc(o.produce||'—')}</td>
      <td style="font-size:12px">${esc(o.customer_first||'')} ${esc(o.customer_last||'')}</td>
      <td style="font-size:12px">${esc(o.farmer_first||'')} ${esc(o.farmer_last||'')}</td>
      <td style="font-weight:700;color:var(--accent)">₹${parseFloat(o.total_price||0).toLocaleString()}</td>
      <td>${statusPill(o.status)}</td>
      <td style="font-size:11.5px;color:var(--text-dim)">${fmtDate(o.created_at)}</td>
    </tr>`).join('')}
    ${!data.length?'<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim)">No orders found</td></tr>':''}</tbody>`;
}
function filterOrders(){renderOrdersTable();}

/* ══ MARKET PRICES ══ */
function renderMarketPrices(){
  ['vegetables','grains','spices','fruits'].forEach(cat=>{
    const el=document.getElementById('prices'+cap(cat));if(!el)return;
    const items=marketPrices[cat]||[];
    el.innerHTML=items.map((p,i)=>`
      <div class="price-edit-row">
        <span class="pe-emoji">${p.emoji}</span>
        <div><div class="pe-name">${p.name}</div><div style="font-size:10.5px;color:var(--text-dim)">📍 ${p.loc}</div></div>
        <input class="pe-input" type="number" value="${p.price}" data-cat="${cat}" data-idx="${i}" min="0" step="0.5"/>
        <span class="pe-unit">₹/${p.unit}</span>
      </div>`).join('');
  });
}
function saveMarketPrices(){
  document.querySelectorAll('.pe-input').forEach(inp=>{
    const cat=inp.dataset.cat,idx=parseInt(inp.dataset.idx);
    if(marketPrices[cat]?.[idx])marketPrices[cat][idx].price=parseFloat(inp.value)||0;
  });
  localStorage.setItem('agrohub_market_prices',JSON.stringify(marketPrices));
  api('/api/admin/market-prices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(marketPrices)});
  showToast('💹 Market prices saved!','success');
  renderDashboard();
}
function resetMarketPrices(){
  marketPrices=JSON.parse(JSON.stringify(defaultMarketPrices));
  renderMarketPrices();
  showToast('↩ Prices reset to defaults','warn');
}


/* ══ CONTACTS ══ */
async function loadContacts(){
  const d=await api('/api/admin/contacts');
  allContacts=Array.isArray(d)?d:[];
  renderContactsTable();
  updateSidebarCounts();
}

function renderContactsTable(){
  const search=(document.getElementById('contactsSearch')?.value||'').toLowerCase();
  const role=document.getElementById('contactsRole')?.value||'';
  const readFilter=document.getElementById('contactsRead')?.value;
  let data=allContacts.filter(c=>{
    const ms=!search||`${c.name} ${c.email} ${c.message}`.toLowerCase().includes(search);
    const rf=!role||c.role===role;
    const isRead=readFilter===''?true:(readFilter==='0'?!c.is_read:!!c.is_read);
    return ms&&rf&&isRead;
  });
  setText('contactsCountLabel',`(${data.length})`);
  document.getElementById('contactsTable').innerHTML=`
    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Message</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${data.map(c=>`<tr style="${!c.is_read?'background:var(--accent-glow2)':''}" >
      <td><div class="cell-name">${esc(c.name)}</div></td>
      <td><a href="mailto:${esc(c.email)}" style="color:var(--accent);font-size:12px">${esc(c.email)}</a></td>
      <td><span class="role-badge ${c.role==='farmer'?'farmer':c.role==='dealer'?'customer':c.role==='provider'?'service_provider':'admin'}">${c.role}</span></td>
      <td style="max-width:280px"><div style="font-size:12.5px;color:var(--text-mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px">${esc(c.message)}</div></td>
      <td style="font-size:11.5px;color:var(--text-dim)">${fmtDate(c.created_at)}</td>
      <td>${c.is_read?'<span class="pill green">Read</span>':'<span class="pill amber">Unread</span>'}</td>
      <td><div class="action-cell">
        ${!c.is_read?`<button class="ic-btn verify" onclick="markContactRead(${c.id})" title="Mark Read">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>`:''}
        <button class="ic-btn view" style="color:var(--blue)" onclick="viewContactMsg(${c.id})" title="View Full Message">
          <svg class="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="ic-btn del" onclick="confirmDeleteContact(${c.id})" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div></td>
    </tr>`).join('')}
    ${!data.length?'<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim)">No messages found</td></tr>':''}</tbody>`;
}

function filterContacts(){renderContactsTable();}

async function markContactRead(id){
  await api(`/api/admin/contacts/${id}/read`,{method:'PUT'});
  const c=allContacts.find(x=>x.id===id);
  if(c)c.is_read=1;
  renderContactsTable();
  updateSidebarCounts();
}

async function markAllContactsRead(){
  const unread=allContacts.filter(c=>!c.is_read);
  await Promise.all(unread.map(c=>api(`/api/admin/contacts/${c.id}/read`,{method:'PUT'})));
  allContacts.forEach(c=>c.is_read=1);
  renderContactsTable();
  updateSidebarCounts();
  showToast('✓ All messages marked as read','success');
}

function viewContactMsg(id){
  const c=allContacts.find(x=>x.id===id);if(!c)return;
  document.getElementById('confirmIcon').textContent='📬';
  document.getElementById('confirmTitle').textContent=`From: ${esc(c.name)}`;
  document.getElementById('confirmMsg').innerHTML=`
    <div style="text-align:left;margin-bottom:10px">
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:4px">📧 ${esc(c.email)} &nbsp;·&nbsp; 👤 ${c.role} &nbsp;·&nbsp; 🕐 ${fmtDate(c.created_at)}</div>
      <div style="background:var(--bg3);border-radius:10px;padding:14px;font-size:13px;color:var(--text-mid);line-height:1.7;white-space:pre-wrap;text-align:left">${esc(c.message)}</div>
    </div>`;
  const btns=document.getElementById('confirmActionBtn');
  btns.textContent='Close';
  btns.className='btn btn-outline';
  btns.onclick=()=>closeModal('confirmModal');
  document.querySelector('#confirmModal .btn-outline').style.display='none';
  showModal('confirmModal');
  if(!c.is_read)markContactRead(id);
}

function confirmDeleteContact(id){
  document.getElementById('confirmIcon').textContent='📬';
  document.getElementById('confirmTitle').textContent='Delete Message?';
  document.getElementById('confirmMsg').textContent='This contact message will be permanently removed.';
  document.getElementById('confirmActionBtn').textContent='Delete';
  document.getElementById('confirmActionBtn').className='btn btn-red';
  document.querySelector('#confirmModal .btn-outline').style.display='';
  document.getElementById('confirmActionBtn').onclick=async()=>{
    await api(`/api/admin/contacts/${id}`,{method:'DELETE'});
    allContacts=allContacts.filter(c=>c.id!==id);
    renderContactsTable();
    updateSidebarCounts();
    closeModal('confirmModal');
    showToast('🗑️ Message deleted','warn');
  };
  showModal('confirmModal');
}

/* ══ TICKETS ══ */
function renderTicketsTable(){
  const search=(document.getElementById('ticketsSearch')?.value||'').toLowerCase();
  const status=document.getElementById('ticketsStatus')?.value||'';
  const priority=document.getElementById('ticketsPriority')?.value||'';
  let data=allTickets.filter(t=>{
    const ms=!search||`${t.subject||''} ${t.user_name||''}`.toLowerCase().includes(search);
    return ms&&(!status||t.status===status)&&(!priority||t.priority===priority);
  });
  setText('ticketsCountLabel',`(${data.length})`);
  document.getElementById('ticketsTable').innerHTML=`
    <thead><tr><th>ID</th><th>User</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
    <tbody>${data.map(t=>`<tr>
      <td><div class="cell-name">#${t.id}</div></td>
      <td style="font-size:12px">${esc(t.user_name||'—')}</td>
      <td style="max-width:200px"><div style="font-size:12.5px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.subject||'—')}</div></td>
      <td><span class="pill dim">${t.category||'—'}</span></td>
      <td>${priorityPill(t.priority)}</td>
      <td>${ticketStatusPill(t.status)}</td>
      <td style="font-size:11.5px;color:var(--text-dim)">${fmtDate(t.created_at)}</td>
      <td>${ticketEyeBtn(t.id)}</td>
    </tr>`).join('')}
    ${!data.length?'<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-dim)">No tickets found</td></tr>':''}</tbody>`;
}
function filterTickets(){renderTicketsTable();}

function openTicketModal(id){
  const t=allTickets.find(x=>x.id===id);if(!t)return;
  document.getElementById('ticketBody').innerHTML=`
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
      ${ticketStatusPill(t.status)} ${priorityPill(t.priority)} <span class="pill dim">${t.category||'general'}</span>
    </div>
    <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:8px">${esc(t.subject)}</div>
    <div style="font-size:12px;color:var(--text-dim);margin-bottom:14px">From: <b style="color:var(--text-mid)">${esc(t.user_name||'Unknown')}</b> · ${fmtDate(t.created_at)}</div>
    <div style="background:var(--bg3);border-radius:12px;padding:14px;font-size:13px;color:var(--text-mid);line-height:1.7;margin-bottom:20px">${esc(t.message||'')}</div>
    ${t.reply?`<div style="background:var(--accent-pale);border:1.5px solid rgba(240,165,0,.15);border-radius:12px;padding:14px;margin-bottom:20px">
      <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--accent);margin-bottom:6px">Admin Reply</div>
      <div style="font-size:13px;color:var(--text-mid);line-height:1.6">${esc(t.reply)}</div>
    </div>`:''}
    <div class="fm-group"><label class="fm-label">Reply to User</label>
      <textarea class="fm-textarea" id="ticket_reply" rows="4" placeholder="Type your reply…">${t.reply||''}</textarea>
    </div>
    <div class="fm-group"><label class="fm-label">Update Status</label>
      <select class="fm-select" id="ticket_status">
        <option value="open" ${t.status==='open'?'selected':''}>Open</option>
        <option value="in_progress" ${t.status==='in_progress'?'selected':''}>In Progress</option>
        <option value="resolved" ${t.status==='resolved'?'selected':''}>Resolved</option>
        <option value="closed" ${t.status==='closed'?'selected':''}>Closed</option>
      </select>
    </div>
    <button class="btn btn-accent btn-full" onclick="replyTicket(${id})">💾 Save Reply & Update Status</button>`;
  showModal('ticketModal');
}
async function replyTicket(id){
  const reply=document.getElementById('ticket_reply').value.trim();
  const status=document.getElementById('ticket_status').value;
  const res=await api(`/api/admin/tickets/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({reply,status})});
  if(res?.success){showToast('✅ Ticket updated','success');closeModal('ticketModal');await loadTickets();renderDashboard();}
  else showToast(res?.error||'Failed','error');
}

/* ══ FAQ ══ */
function renderFAQTable(){
  const search=(document.getElementById('faqSearch')?.value||'').toLowerCase();
  const role=document.getElementById('faqRole')?.value||'';
  let data=allFAQs.filter(f=>(!search||(f.question||'').toLowerCase().includes(search))&&(!role||f.role===role));
  setText('faqCountLabel',`(${data.length})`);
  document.getElementById('faqTable').innerHTML=`
    <thead><tr><th>Question</th><th>Category</th><th>Role</th><th>Sort</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${data.map(f=>`<tr>
      <td style="max-width:280px"><div style="font-size:12.5px;font-weight:600;color:var(--text)">${esc(f.question||'')}</div><div style="font-size:11px;color:var(--text-dim);margin-top:2px">${esc(f.answer||'').substring(0,60)}…</div></td>
      <td><span class="pill dim">${f.category||'general'}</span></td>
      <td><span class="role-badge ${f.role==='farmer'?'farmer':f.role==='customer'?'customer':'admin'}">${f.role}</span></td>
      <td style="color:var(--text-dim)">${f.sort_order||0}</td>
      <td>${f.is_active?'<span class="pill green">Active</span>':'<span class="pill dim">Hidden</span>'}</td>
      <td><div class="action-cell">
        <button class="ic-btn edit" onclick="openEditFAQ(${f.id})" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="ic-btn del" onclick="confirmDeleteFAQ(${f.id})" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div></td>
    </tr>`).join('')}
    ${!data.length?'<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim)">No FAQs found</td></tr>':''}</tbody>`;
}
function filterFAQs(){renderFAQTable();}
function openAddFAQModal(){
  document.getElementById('faqModalTitle').textContent='➕ Add FAQ';
  ['fq_id','fq_question','fq_answer'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('fq_category').value='general';
  document.getElementById('fq_role').value='all';
  document.getElementById('fq_sort').value='0';
  showModal('faqModal');
}
function openEditFAQ(id){
  const f=allFAQs.find(x=>x.id===id);if(!f)return;
  document.getElementById('faqModalTitle').textContent='✏️ Edit FAQ';
  document.getElementById('fq_id').value=id;
  document.getElementById('fq_question').value=f.question||'';
  document.getElementById('fq_answer').value=f.answer||'';
  document.getElementById('fq_category').value=f.category||'general';
  document.getElementById('fq_role').value=f.role||'all';
  document.getElementById('fq_sort').value=f.sort_order||0;
  showModal('faqModal');
}
async function saveFAQ(){
  const id=document.getElementById('fq_id').value;
  const payload={
    question:document.getElementById('fq_question').value.trim(),
    answer:document.getElementById('fq_answer').value.trim(),
    category:document.getElementById('fq_category').value,
    role:document.getElementById('fq_role').value,
    sort_order:parseInt(document.getElementById('fq_sort').value)||0,
    is_active:1
  };
  if(!payload.question||!payload.answer){showToast('Fill all fields','error');return;}
  const res=await api(id?`/api/admin/faqs/${id}`:'/api/admin/faqs',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(res?.success){showToast(id?'✅ FAQ updated':'✅ FAQ added','success');closeModal('faqModal');await loadFAQs();}
  else showToast(res?.error||'Failed','error');
}
function confirmDeleteFAQ(id){
  document.getElementById('confirmIcon').textContent='❓';
  document.getElementById('confirmTitle').textContent='Delete FAQ?';
  document.getElementById('confirmMsg').textContent='This FAQ will be permanently removed.';
  document.getElementById('confirmActionBtn').textContent='Delete FAQ';
  document.getElementById('confirmActionBtn').onclick=async()=>{
    const res=await api(`/api/admin/faqs/${id}`,{method:'DELETE'});
    if(res?.success){showToast('🗑️ FAQ removed','warn');closeModal('confirmModal');await loadFAQs();}
    else showToast('Failed','error');
  };
  showModal('confirmModal');
}

/* ══ BROADCAST ══ */
function handleTargetChange(changed){
  const allCb=document.getElementById('bc_all');
  const roleCbs=document.querySelectorAll('.bc_role_cb');
  if(changed.value==='all'&&changed.checked)roleCbs.forEach(cb=>cb.checked=false);
  if(changed.value!=='all'&&changed.checked)allCb.checked=false;
  const selected=getSelectedTargets();
  const summary=document.getElementById('bc_target_summary');
  const labelMap={all:'🌐 All Users',farmer:'🧑‍🌾 Farmers',customer:'🛒 Customers',service_provider:'🛠️ Service Providers',farmer_customer:'🧑‍🌾🛒 Farmers + Customers',farmer_provider:'🧑‍🌾🛠️ Farmers + Providers',customer_provider:'🛒🛠️ Customers + Providers'};
  if(!selected.length){summary.textContent='No recipients selected';summary.style.color='var(--red)';}
  else{summary.textContent='✓ Sending to: '+selected.map(s=>labelMap[s]||s).join(', ');summary.style.color='var(--green)';}
  updateBroadcastPreview();
}
function getSelectedTargets(){
  const allCb=document.getElementById('bc_all');
  const roleCbs=document.querySelectorAll('.bc_role_cb');
  const targets=[];
  if(allCb.checked)targets.push('all');
  roleCbs.forEach(cb=>{if(cb.checked)targets.push(cb.value);});
  return targets;
}
function updateBroadcastPreview(){
  const msg=document.getElementById('bc_message').value.trim();
  const type=document.getElementById('bc_type').value;
  const prev=document.getElementById('broadcastPreview');
  if(msg)prev.classList.add('show');else{prev.classList.remove('show');return;}
  const colors={info:'var(--blue)',success:'var(--green)',warning:'var(--amber)',error:'var(--red)'};
  document.getElementById('bc_prev_dot').style.background=colors[type]||'var(--accent)';
  document.getElementById('bc_prev_msg').textContent=msg;
}
async function sendBroadcast(){
  const message=document.getElementById('bc_message').value.trim();
  const targets=getSelectedTargets();
  const type=document.getElementById('bc_type').value;
  if(!message){showToast('Please enter a message','error');return;}
  if(!targets.length){showToast('Please select at least one recipient group','error');return;}
  const btn=document.querySelector('#view-broadcast .btn-accent');
  btn.textContent='⏳ Sending…';btn.disabled=true;
  const res=await api('/api/admin/broadcast',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,targets,type})});
  btn.textContent='📢 Send Notification';btn.disabled=false;
  if(res?.success){
    const labelMap={all:'All Users',farmer:'Farmers',customer:'Customers',service_provider:'Service Providers',farmer_customer:'Farmers + Customers',farmer_provider:'Farmers + Providers',customer_provider:'Customers + Providers'};
    const targetLabel=targets.map(t=>labelMap[t]||t).join(', ');
    showToast(`📢 Sent to ${res.count} users (${targetLabel})!`,'success');
    broadcastHistory.unshift({message,targets:targetLabel,type,count:res.count||0,time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})});
    renderBroadcastHistory();
    document.getElementById('bc_message').value='';
    document.getElementById('bc_all').checked=false;
    document.querySelectorAll('.bc_role_cb').forEach(cb=>cb.checked=false);
    document.getElementById('bc_target_summary').textContent='No recipients selected';
    document.getElementById('bc_target_summary').style.color='var(--text-dim)';
    updateBroadcastPreview();
  } else showToast(res?.error||'Failed to send','error');
}
function renderBroadcastHistory(){
  const el=document.getElementById('broadcastHistory');
  if(!broadcastHistory.length){el.innerHTML='<div style="text-align:center;padding:32px;color:var(--text-dim)">No broadcasts sent yet</div>';return;}
  const typeColors={info:'var(--blue)',success:'var(--green)',warning:'var(--amber)',error:'var(--red)'};
  el.innerHTML=broadcastHistory.map(b=>`
    <div style="padding:11px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:5px">
        <div style="width:8px;height:8px;border-radius:50%;background:${typeColors[b.type]||'var(--accent)'};margin-top:5px;flex-shrink:0"></div>
        <div style="font-size:12.5px;color:var(--text);font-weight:500;line-height:1.4">${esc(b.message)}</div>
      </div>
      <div style="font-size:10.5px;color:var(--text-dim);padding-left:16px">📤 ${b.targets} · 👥 ${b.count} users · 🕐 ${b.time}</div>
    </div>`).join('');
}

/* ══ SETTINGS ══ */
async function loadAdminInfo(){
  const res=await api('/api/user');
  if(res?.name){
    document.getElementById('adminNameBtn').textContent=`👑 ${res.name}`;
    document.getElementById('adminInfoPanel').innerHTML=`
      <div class="user-detail-grid">
        ${[['Name',res.name],['Email',res.email||'—'],['Role','Admin']].map(([k,v])=>`<div class="ud-item"><div class="ud-label">${k}</div><div class="ud-val">${v}</div></div>`).join('')}
      </div>`;
  }
}
async function changeAdminPassword(){
  const cur=document.getElementById('adm_cur_pass').value;
  const nw=document.getElementById('adm_new_pass').value;
  const conf=document.getElementById('adm_conf_pass').value;
  if(!cur||!nw){showToast('Fill all fields','error');return;}
  if(nw!==conf){showToast("Passwords don't match",'error');return;}
  const res=await api('/api/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({current_password:cur,new_password:nw,confirm_password:conf})});
  if(res?.success){showToast('🔒 Password updated!','success');['adm_cur_pass','adm_new_pass','adm_conf_pass'].forEach(id=>document.getElementById(id).value='');}
  else showToast(res?.error||'Failed','error');
}
function savePlatformSettings(){showToast('✅ Platform settings saved','success');}
async function doLogout(){
  await fetch('/api/logout',{credentials:'include'});
  window.location.href='/';
}

/* ══ TOAST ══ */
function showToast(msg,type=''){
  const wrap=document.getElementById('toastWrap');
  const t=document.createElement('div');
  t.className='toast'+(type?' '+type:'');
  t.textContent=msg;
  wrap.appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300)},3500);
}

/* ══ UTILITY ══ */
function setText(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function fmtDate(d){if(!d)return'—';return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});}

function statusPill(s){
  const map={pending:'amber',accepted:'green',rejected:'red',ready_to_ship:'blue',shipped:'blue',delivered:'green'};
  return `<span class="pill ${map[s]||'dim'}">${(s||'').replace('_',' ')}</span>`;
}
function priorityPill(p){
  const map={high:'red',medium:'amber',low:'green'};
  return `<span class="pill ${map[p]||'dim'}">${p||'—'}</span>`;
}
function ticketStatusPill(s){
  const map={open:'amber',in_progress:'blue',resolved:'green',closed:'dim'};
  return `<span class="pill ${map[s]||'dim'}">${(s||'').replace('_',' ')}</span>`;
}

function isValidEmail(e){return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e.trim());}
function isValidPhone(p){return /^(\+91|91|0)?[6-9]\d{9}$/.test(p.replace(/[\s\-()]/g,''));}

function validateAdminField(input, label){
  const val = input.value.trim();
  input.style.borderColor='';
  const existing = input.parentElement.querySelector('.adm-err');
  if(existing) existing.remove();
  let err = '';
  if(!val && input.hasAttribute('data-required')) err=`${label} is required`;
  else if(input.type==='email' && val && !isValidEmail(val)) err='Enter a valid email (e.g. user@domain.com)';
  else if(input.dataset.type==='phone' && val && !isValidPhone(val)) err='Enter a valid 10-digit Indian mobile number';
  if(err){
    input.style.borderColor='var(--red)';
    const div=document.createElement('div');
    div.className='adm-err';
    div.style.cssText='color:var(--red);font-size:11px;margin-top:4px';
    div.textContent=err;
    input.parentElement.appendChild(div);
    return false;
  }
  input.style.borderColor='var(--green)';
  return true;
}

