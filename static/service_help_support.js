// ═══ DATA ═══
const SP_FAQS = [
  // LISTINGS
  { q:"How do I add a new vehicle, equipment or storage listing?", a:"Go to your Dashboard and click '+ Add New Service' or navigate to the specific section (Transport Vehicles, Equipment Rental, or Storage Facilities) and click the '+ Add' button. Fill in all required fields marked with *, upload photos, and click 'Post Listing'. Your listing will immediately be visible to farmers.", cat:"listings", icon:"📋" },
  { q:"How do images get uploaded when I add a listing?", a:"When you add a listing and select photos, they are automatically uploaded to Cloudinary (our image hosting service) via the AgroHub backend. The uploaded image URLs are then saved with your listing. You can upload up to 5 images per listing in JPG or PNG format.", cat:"listings", icon:"📸" },
  { q:"Can I edit my listing after posting?", a:"Yes! In any service view (Transport/Equipment/Storage), click the ✏️ edit icon on any listing. You can update all details, change photos, update pricing or availability status. Existing images are preserved unless you remove them.", cat:"listings", icon:"✏️" },
  { q:"How do I update the availability status of my listing?", a:"Edit any listing and change the Status field — for vehicles you can set Available, Booked, or Under Maintenance. For storage, you can set Available, Fully Occupied, or Temporarily Unavailable. Customers can only see and book listings with 'Available' status.", cat:"listings", icon:"🔄" },
  { q:"What happens when I delete a listing?", a:"Deleting a listing permanently removes it from the platform. Farmers can no longer find or book it. Active bookings linked to that listing may be affected — it's best to first set status to 'Unavailable' rather than deleting if you have active bookings.", cat:"listings", icon:"🗑️" },
  { q:"How many photos can I upload per listing?", a:"You can upload a maximum of 5 photos per listing. Photos are stored on Cloudinary and displayed in the listing details, the service table, and the view modal. Good photos significantly increase booking rates.", cat:"listings", icon:"📷" },
  // BOOKINGS
  { q:"How do I accept or reject a booking request?", a:"Go to Bookings → Pending Requests. Each pending booking shows Accept (✅) and Reject (❌) buttons. Click Accept to confirm the booking — the farmer will be notified. Once accepted, you can mark it as Active when service begins, and Completed when done.", cat:"bookings", icon:"📅" },
  { q:"What is the booking workflow?", a:"Booking statuses flow in this order: Pending → Accepted → Active → Completed. A farmer requests a booking (Pending). You accept or reject it. Once service begins, mark it Active. After completion, mark it Completed — this updates your earnings.", cat:"bookings", icon:"🔄" },
  { q:"Can I see all my bookings in one place?", a:"Yes! Click 'All Bookings' in the sidebar to see every booking. Use the filter tabs to quickly view Pending, Accepted, Active, Completed, or Rejected bookings. The pending count is also shown as a badge on the sidebar and navbar bell.", cat:"bookings", icon:"📋" },
  { q:"Why are my earnings not updating?", a:"Earnings are calculated from bookings with 'Completed' status. Make sure to mark jobs as Completed after the service is finished. Navigate to Bookings, find the active booking, and click 'Mark Completed'.", cat:"payments", icon:"💰" },
  // PAYMENTS
  { q:"How are payments processed on AgroHub?", a:"AgroHub currently facilitates the connection between farmers and service providers. Payment terms are agreed between you and the farmer. The platform shows the estimated amount based on your listed price. Direct payment integration is coming soon.", cat:"payments", icon:"💳" },
  { q:"How do I see my total revenue?", a:"Navigate to Earnings in the sidebar. You'll see Total Earnings, Transport Revenue, Equipment Revenue, and Storage Revenue — all calculated from completed bookings. The monthly bar chart shows revenue trends over 6 months.", cat:"payments", icon:"📊" },
  // ACCOUNT
  { q:"How do I update my profile photo?", a:"Click '⚙️ Settings' from the dropdown menu or sidebar. In the Settings panel, click your avatar photo at the top. Select a new image from your device — it will be instantly uploaded to Cloudinary and updated across the dashboard.", cat:"account", icon:"👤" },
  { q:"How do I change my password?", a:"Open Settings → Security tab → Change Password section. Enter your current password, then your new password (minimum 8 characters, 1 uppercase, 1 number, 1 special character). The password strength indicator will guide you.", cat:"account", icon:"🔒" },
  { q:"How do I delete my account?", a:"Open Settings → Account tab → scroll to Danger Zone. Click 'Delete My Account', enter your password to confirm, and click Confirm Delete. This permanently removes your account, listings, and all associated data. This cannot be undone.", cat:"account", icon:"⚠️" },
  // GENERAL
  { q:"How do I contact AgroHub support?", a:"You can call 1800-123-456 (toll free, Mon–Sat 9AM–6PM), email support.provider@AgroHub.in, or raise a support ticket using the form on this page. We typically respond within 24 hours.", cat:"general", icon:"📞" },
  { q:"Is my data and listing information secure?", a:"Yes. All images are stored securely on Cloudinary with HTTPS URLs. Your profile and service data is stored in our encrypted database. We never share your contact details with third parties.", cat:"general", icon:"🔐" },
];

let currentFaqCat = 'all';

function renderFaqs(list) {
  const container = document.getElementById('faqList');
  if (!list.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-light)"><div style="font-size:48px;opacity:.3;margin-bottom:10px">🔍</div><div style="font-size:13px">No FAQs found for your search</div></div>`;
    return;
  }
  container.innerHTML = list.map((f,i) => `
    <div class="faq-item" id="faq-${i}" onclick="toggleFaq(${i})">
      <div class="faq-q">
        <span class="fq-icon">${f.icon}</span>
        <span style="flex:1">${f.q}</span>
        <span class="faq-badge ${f.cat}">${f.cat}</span>
        <span class="faq-chevron">▼</span>
      </div>
      <div class="faq-a"><div class="faq-a-inner">${f.a}</div></div>
    </div>`).join('');
}

function toggleFaq(i) {
  const el = document.getElementById('faq-'+i);
  const wasOpen = el.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(e=>e.classList.remove('open'));
  if (!wasOpen) el.classList.add('open');
}

function setFaqCat(cat, btn) {
  currentFaqCat = cat;
  document.querySelectorAll('.faq-cat').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  applyFaqFilters();
}

function filterFaqs() { applyFaqFilters(); }

function applyFaqFilters() {
  const search = document.getElementById('faqSearch').value.toLowerCase();
  let list = SP_FAQS.filter(f => {
    const mc = currentFaqCat==='all' || f.cat===currentFaqCat;
    const ms = !search || f.q.toLowerCase().includes(search) || f.a.toLowerCase().includes(search);
    return mc && ms;
  });
  renderFaqs(list);
}

function scrollToTicket() {
  document.getElementById('ticket-section').scrollIntoView({behavior:'smooth',block:'start'});
}

function scrollTo(sel) {
  const el = document.querySelector(sel);
  if (el) el.scrollIntoView({behavior:'smooth',block:'start'});
}

// ═══ TICKETS ═══
async function loadTickets() {
  try {
    const res = await fetch('/api/support/tickets', {credentials:'include'});
    if (!res.ok) { renderTickets([]); return; }
    const data = await res.json();
    renderTickets(data);
  } catch(e) { renderTickets([]); }
}

function renderTickets(tickets) {
  const container = document.getElementById('ticketsList');
  const badge     = document.getElementById('ticketCountBadge');
  badge.textContent = `${tickets.length} ticket${tickets.length!==1?'s':''}`;
  if (!tickets.length) {
    container.innerHTML = `<div class="empty-tickets"><div class="et-icon">🎫</div><p>No tickets yet. Raise one if you need help!</p></div>`;
    return;
  }
  const icns = {open:'🔵',in_progress:'🟡',resolved:'🟢',closed:'⚫'};
  container.innerHTML = tickets.map(t=>`
    <div class="ticket-item">
      <div class="ti-icon ${t.status}">${icns[t.status]||'🎫'}</div>
      <div class="ti-info">
        <div class="ti-title">${t.subject}</div>
        <div class="ti-meta">#${t.id} · ${t.category} · ${new Date(t.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
        ${t.reply?`<div style="margin-top:5px;font-size:11.5px;background:var(--cream);padding:6px 10px;border-radius:7px;color:var(--text-mid)">💬 ${t.reply}</div>`:''}
      </div>
      <span class="ti-status ${t.status}">${t.status.replace('_',' ')}</span>
    </div>`).join('');
}

async function submitTicket() {
  const subject  = document.getElementById('t_subject').value.trim();
  const message  = document.getElementById('t_message').value.trim();
  const category = document.getElementById('t_category').value;
  const priority = document.getElementById('t_priority').value;
  if (!subject) { showToast('Please enter a subject','err'); return; }
  if (!message) { showToast('Please describe your issue','err'); return; }

  const btn = document.querySelector('.btn-submit');
  btn.innerHTML = '<span>⏳</span> Submitting…';
  btn.disabled = true;

  try {
    const res = await fetch('/api/support/tickets', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({subject, message, category, priority})
    });
    const data = await res.json();
    if (res.ok) {
      showToast('✅ Ticket #'+data.ticket_id+' submitted! We\'ll respond within 24 hours.');
      document.getElementById('t_subject').value='';
      document.getElementById('t_message').value='';
      loadTickets();
    } else {
      showToast(data.error||'Failed to submit ticket','err');
    }
  } catch(e) { showToast('Network error','err'); }
  btn.innerHTML = '<span>🚀</span> Submit Ticket';
  btn.disabled = false;
}

// ═══ USER ═══
async function loadUser() {
  try {
    const res = await fetch('/api/user',{credentials:'include'});
    if (!res.ok) return;
    const u = await res.json();
    const name = u.name||'Service Provider';
    document.getElementById('navName').textContent = name;
    const initials = name.split(' ').map(n=>n[0]).join('').toUpperCase();
    if (u.profile_img) {
      document.getElementById('navAvatar').innerHTML = `<img src="${u.profile_img}" alt="${name}">`;
    } else {
      document.getElementById('navInitials').textContent = initials;
    }
  } catch(e){}
}

function showToast(msg, type='') {
  const w=document.getElementById('toastWrap');
  const t=document.createElement('div');
  t.className='toast'+(type?' '+type:'');
  t.textContent=msg;
  w.appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},3500);
}

// ═══ INIT ═══
document.addEventListener('DOMContentLoaded',()=>{
  loadUser();
  renderFaqs(SP_FAQS);
  loadTickets();
});