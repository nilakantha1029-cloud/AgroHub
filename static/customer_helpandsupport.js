// ── STATE ──
let allFaqs = [];
let activeFaqTab = 'all';
let faqSearchTerm = '';

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadFAQs();
  await loadTickets();
});

async function checkAuth() {
  try {
    const res = await fetch('/api/user', { credentials: 'include' });
    if (!res.ok) window.location.href = '/login';
  } catch(e) { window.location.href = '/login'; }
}

// ── FAQs ──
async function loadFAQs() {
  try {
    const res  = await fetch('/api/support/faq', { credentials: 'include' });
    allFaqs    = await res.json();
    const count = allFaqs.length;
    document.getElementById('faqCount').textContent = count;
    document.getElementById('faqCountInner').textContent = `${count} questions`;
    renderFAQs();
  } catch(e) {
    document.getElementById('faqList').innerHTML =
      `<div class="faq-empty">⚠️ Failed to load FAQs. Please refresh.</div>`;
  }
}

function setFaqTab(el, cat) {
  document.querySelectorAll('.faq-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  activeFaqTab = cat;
  faqSearchTerm = '';
  document.getElementById('faqSearchInput').value = '';
  renderFAQs();
}

function filterFAQ(term) {
  faqSearchTerm = term.toLowerCase();
  renderFAQs();
}

function renderFAQs() {
  let filtered = allFaqs;
  if (activeFaqTab !== 'all') {
    filtered = filtered.filter(f => f.category === activeFaqTab);
  }
  if (faqSearchTerm) {
    filtered = filtered.filter(f =>
      f.question.toLowerCase().includes(faqSearchTerm) ||
      f.answer.toLowerCase().includes(faqSearchTerm)
    );
  }
  const list = document.getElementById('faqList');
  if (!filtered.length) {
    list.innerHTML = `<div class="faq-empty">🔍 No FAQs found${faqSearchTerm ? ` for "<b>${faqSearchTerm}</b>"` : ''}</div>`;
    return;
  }
  list.innerHTML = filtered.map(f => `
    <div class="faq-item" id="faq-${f.id}">
      <div class="faq-q" onclick="toggleFAQ(${f.id})">
        <div class="faq-q-text">${f.question}</div>
        <div class="faq-chevron">▼</div>
      </div>
      <div class="faq-a">${f.answer}</div>
    </div>
  `).join('');
}

function toggleFAQ(id) {
  const item = document.getElementById('faq-' + id);
  // Close others in same panel
  document.querySelectorAll('.faq-item.open').forEach(el => {
    if (el !== item) el.classList.remove('open');
  });
  item.classList.toggle('open');
}

// ── TICKETS ──
async function loadTickets() {
  const list = document.getElementById('ticketsList');
  list.innerHTML = `<div class="loading-state">⏳ Loading tickets…</div>`;
  try {
    const res     = await fetch('/api/support/tickets', { credentials: 'include' });
    const tickets = await res.json();
    document.getElementById('myTicketCount').textContent = tickets.length;
    renderTickets(tickets);
  } catch(e) {
    list.innerHTML = `<div class="loading-state">⚠️ Failed to load tickets</div>`;
  }
}

function renderTickets(tickets) {
  const list = document.getElementById('ticketsList');
  if (!tickets.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">🎫</div>
        <div class="es-title">No tickets yet</div>
        <div class="es-sub">Submit a support ticket above and we'll get back to you within 24 hours.</div>
      </div>`;
    return;
  }
  const catEmoji = { order:'📦', payment:'💳', product:'🥦', account:'👤', delivery:'🚚', refund:'↩️', general:'🌿' };
  list.innerHTML = tickets.map(t => {
    const date = new Date(t.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
    const emoji = catEmoji[t.category] || '🎫';
    const priorityCls = `priority-${t.priority}`;
    return `
      <div class="ticket-row">
        <div class="ticket-icon">${emoji}</div>
        <div class="ticket-info">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <div class="ticket-subject">#${t.id} – ${t.subject}</div>
            <span class="status-pill ${t.status}">${t.status.replace('_',' ')}</span>
            <span class="${priorityCls}" style="font-size:10.5px">● ${t.priority}</span>
          </div>
          <div class="ticket-meta">${t.category} · ${date}</div>
          <div class="ticket-msg">${t.message.slice(0,120)}${t.message.length>120?'…':''}</div>
          ${t.reply ? `
            <div class="ticket-reply">
              <div class="ticket-reply-label">✅ Team Reply</div>
              ${t.reply}
            </div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ── SUBMIT TICKET ──
async function submitTicket(e) {
  e.preventDefault();
  const subject  = document.getElementById('tk_subject').value.trim();
  const category = document.getElementById('tk_category').value;
  const priority = document.getElementById('tk_priority').value;
  const message  = document.getElementById('tk_message').value.trim();
  const orderRef = document.getElementById('tk_order_ref').value.trim();

  // Prepend order ref to message if provided
  const fullMessage = orderRef ? `[Order Ref: ${orderRef}]\n\n${message}` : message;

  const btn = document.getElementById('submitTicketBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Submitting…';

  try {
    const res  = await fetch('/api/support/tickets', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, category, message: fullMessage, priority })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ Ticket #${data.ticket_id} submitted! We'll reply within 24 hrs.`);
      document.getElementById('ticketForm').reset();
      document.getElementById('subjectChars').textContent = '0';
      document.getElementById('msgChars').textContent = '0';
      await loadTickets();
      // Scroll to tickets
      document.getElementById('myTicketsCard').scrollIntoView({ behavior:'smooth', block:'start' });
    } else {
      showToast(data.error || 'Failed to submit ticket', 'error');
    }
  } catch(err) {
    showToast('Server error. Please try again.', 'error');
  }
  btn.disabled = false;
  btn.textContent = '🎫 Submit Ticket';
}

// ── HELPERS ──
function scrollToTicket() {
  document.getElementById('ticketFormPanel').scrollIntoView({ behavior:'smooth', block:'start' });
  document.getElementById('tk_subject').focus();
}

function updateCharCount(el, counterId, max) {
  document.getElementById(counterId).textContent = el.value.length;
}

function showToast(msg, type='') {
  const wrap = document.getElementById('toastWrap');
  const t    = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  wrap.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 4000);
}
