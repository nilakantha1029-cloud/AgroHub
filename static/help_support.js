let allFaqs = [];
let currentCat = '';

async function loadFAQ() {
  try {
    const res  = await fetch('/api/support/faq',{credentials:'include'});
    allFaqs    = await res.json();
    renderFAQ(allFaqs);
  } catch(e) {
    document.getElementById('faqList').innerHTML =
      `<div style="text-align:center;padding:30px;color:var(--text-light)">Unable to load FAQs</div>`;
  }
}

function renderFAQ(faqs) {
  const list = document.getElementById('faqList');
  if (!faqs.length) {
    list.innerHTML=`<div style="text-align:center;padding:40px;color:var(--text-light)">🔍 No results found. Try a different search.</div>`;
    return;
  }
  list.innerHTML = faqs.map((f,i)=>`
    <div class="faq-item" id="faq-${i}">
      <div class="faq-q" onclick="toggleFaq(${i})">
        <span>${f.question}</span>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <span class="faq-cat-tag">${f.category}</span>
          <span class="faq-chevron">▼</span>
        </div>
      </div>
      <div class="faq-a"><div class="faq-a-inner">${f.answer}</div></div>
    </div>`).join('');
}

function toggleFaq(i) {
  const el = document.getElementById('faq-'+i);
  el.classList.toggle('open');
}

function filterFAQ() {
  const q   = document.getElementById('faqSearch').value.toLowerCase().trim();
  const filtered = allFaqs.filter(f=>{
    const matchCat  = !currentCat || f.category===currentCat;
    const matchText = !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
    return matchCat && matchText;
  });
  renderFAQ(filtered);
}

function filterByCategory(cat, el) {
  currentCat = cat;
  document.querySelectorAll('.cat-pill').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  filterFAQ();
}

async function loadTickets() {
  try {
    const res     = await fetch('/api/support/tickets',{credentials:'include'});
    const tickets = await res.json();
    renderTickets(tickets);
  } catch(e) {
    document.getElementById('myTicketsList').innerHTML=
      `<div style="text-align:center;padding:30px;color:var(--text-light)">Unable to load tickets</div>`;
  }
}

function renderTickets(tickets) {
  const container = document.getElementById('myTicketsList');
  if (!tickets.length) {
    container.innerHTML=`<div style="text-align:center;padding:40px;color:var(--text-light)">
      <div style="font-size:48px;margin-bottom:12px;opacity:.4">🎫</div>
      <div style="font-size:14px;font-weight:600">No tickets yet</div>
      <div style="font-size:12px;margin-top:4px">Submit a support request above and we'll get back to you.</div>
    </div>`;
    return;
  }
  container.innerHTML = `<div style="padding:0 0 4px">` + tickets.map(t=>{
    const date = new Date(t.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
    const statusLabel = {open:'Open',in_progress:'In Progress',resolved:'Resolved',closed:'Closed'}[t.status]||t.status;
    return `<div class="ticket-row" style="padding:14px 20px">
      <div class="ticket-status-dot ${t.status}"></div>
      <div style="flex:1">
        <div class="ticket-subject">#${t.id} — ${t.subject}
          <span class="t-status-pill ${t.status}">${statusLabel}</span>
        </div>
        <div class="ticket-meta">
          ${t.category} · ${t.priority} priority · Submitted ${date}
        </div>
        ${t.reply?`<div class="ticket-reply">💬 <b>Support Reply:</b> ${t.reply}</div>`:''}
      </div>
    </div>`;
  }).join('') + `</div>`;
}

async function submitTicket(e) {
  e.preventDefault();
  const subject  = document.getElementById('t_subject').value.trim();
  const category = document.getElementById('t_category').value;
  const priority = document.getElementById('t_priority').value;
  const message  = document.getElementById('t_message').value.trim();
  if (!subject || !message) { showToast('Please fill in all required fields','error'); return; }

  const btn = document.getElementById('ticketSubmitBtn');
  btn.innerHTML='<span class="spinner"></span>Submitting…'; btn.disabled=true;

  try {
    const res  = await fetch('/api/support/tickets',{
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({subject,category,priority,message})
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ Ticket #${data.ticket_id} submitted! We'll reply within 24 hours.`);
      document.getElementById('t_subject').value='';
      document.getElementById('t_message').value='';
      await loadTickets();
    } else {
      showToast(data.error||'Failed to submit ticket','error');
    }
  } catch(e) { showToast('Network error','error'); }
  btn.innerHTML='📤 Submit Ticket'; btn.disabled=false;
}

function scrollToTicket() {
  document.getElementById('submitTicketCard').scrollIntoView({behavior:'smooth',block:'start'});
}

function showToast(msg, type='') {
  const wrap=document.getElementById('toastWrap');
  const t=document.createElement('div');
  t.className='toast'+(type?' '+type:'');
  t.textContent=msg;
  wrap.appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),300); },3000);
}

document.addEventListener('DOMContentLoaded',()=>{
  loadFAQ();
  loadTickets();
});