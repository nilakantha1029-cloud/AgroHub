let userData = {};
let isEditing = false;
let isIdentEditing = false;
let uploadedImgFile = null;
let savedAddresses = [];
let custOtpTimerInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadProfile();
  await loadOrders();
  loadAddresses();
});

async function loadProfile() {
  try {
    const res = await fetch('/api/profile', { credentials: 'include' });
    if (res.status === 401) { window.location.href = '/login'; return; }
    userData = await res.json();
    populateUI();
  } catch (e) { showToast('Failed to load profile', 'error'); }
}

function populateUI() {
  const u = userData;
  const name = `${u.first_name || ''} ${u.last_name || ''}`.trim();
  const initials = `${(u.first_name||'')[0]||''}${(u.last_name||'')[0]||''}`.toUpperCase() || '??';
  document.getElementById('navName').textContent = name;
  document.getElementById('navAvatar').innerHTML = u.profile_img ? `<img src="${u.profile_img}" alt="${name}">` : initials;
  document.getElementById('heroName').textContent = name || 'My Profile';
  document.getElementById('heroEmail').textContent = u.email || '—';
  document.getElementById('heroPhone').textContent = u.phone ? '📞 ' + u.phone : '📞 Not set';
  document.getElementById('heroAvatar').innerHTML = u.profile_img ? `<img src="${u.profile_img}" alt="${name}">` : initials;
  if (u.created_at) { const d=new Date(u.created_at); document.getElementById('heroMemberSince').textContent=`Since ${d.toLocaleDateString('en-IN',{month:'short',year:'numeric'})}`; }
  const pal = document.getElementById('profileAvatarLg');
  pal.innerHTML = u.profile_img ? `<img src="${u.profile_img}" alt="${name}">` : initials;
  document.getElementById('inp_first_name').value = u.first_name || '';
  document.getElementById('inp_last_name').value  = u.last_name  || '';
  document.getElementById('inp_gender').value     = u.gender     || '';
  document.getElementById('inp_dob').value        = u.dob        || '';
  document.getElementById('inp_email').value      = u.email      || '';
  document.getElementById('inp_phone').value      = u.phone      || '';
  document.getElementById('inp_bio').value        = u.bio        || '';
  document.getElementById('inp_aadhar').value     = u.aadhar     || '';
  document.getElementById('inp_pan').value        = u.pan        || '';
  if (u.address || u.village || u.district) loadAddresses();
}

async function loadOrders() {
  try {
    const res = await fetch('/api/orders/customer', { credentials: 'include' });
    const orders = await res.json();
    document.getElementById('statOrders').textContent    = orders.length;
    document.getElementById('statDelivered').textContent = orders.filter(o=>o.status==='delivered').length;
    document.getElementById('statPending').textContent   = orders.filter(o=>['pending','accepted','ready_to_ship','shipped'].includes(o.status)).length;
  } catch (e) {}
}

function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('panel-'+tab).classList.add('active');
  event.currentTarget.classList.add('active');
}

function toggleEdit() {
  isEditing = !isEditing;
  ['inp_first_name','inp_last_name','inp_gender','inp_dob','inp_phone','inp_bio'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=!isEditing;});
  document.getElementById('personalSaveBar').style.display = isEditing ? 'flex' : 'none';
  document.getElementById('heroEditBtn').textContent = isEditing ? '✕ Cancel Edit' : '✏️ Edit Profile';
  document.getElementById('heroEditBtn').classList.toggle('active', isEditing);
  document.getElementById('imgUploadArea').style.pointerEvents = isEditing ? 'all' : 'none';
  document.getElementById('imgUploadArea').style.opacity = isEditing ? '1' : '.6';
}

function cancelEdit() {
  isEditing = false;
  populateUI();
  uploadedImgFile = null;
  ['inp_first_name','inp_last_name','inp_gender','inp_dob','inp_phone','inp_bio'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=true;});
  document.getElementById('personalSaveBar').style.display = 'none';
  document.getElementById('heroEditBtn').textContent = '✏️ Edit Profile';
  document.getElementById('heroEditBtn').classList.remove('active');
}

function previewProfileImage(input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 5*1024*1024) { showToast('Image too large (max 5MB)', 'error'); return; }
  uploadedImgFile = file;
  const reader = new FileReader();
  reader.onload = e => { const src=e.target.result; document.getElementById('profileAvatarLg').innerHTML=`<img src="${src}" alt="preview">`; document.getElementById('heroAvatar').innerHTML=`<img src="${src}" alt="preview">`; document.getElementById('navAvatar').innerHTML=`<img src="${src}" alt="preview">`; };
  reader.readAsDataURL(file);
}
function previewHeroImage(input) {
  document.getElementById('profileImgInput').files = input.files;
  previewProfileImage(input);
  switchTabByName('personal');
  if (!isEditing) toggleEdit();
}
function switchTabByName(tab) {
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('panel-'+tab).classList.add('active');
  document.querySelector(`.tab-btn[onclick*="${tab}"]`).classList.add('active');
}

async function savePersonal(e) {
  e.preventDefault();
  const btn = document.getElementById('personalSaveBtn');
  btn.disabled=true; btn.textContent='⏳ Saving…';
  const formData = new FormData();
  formData.append('first_name',document.getElementById('inp_first_name').value.trim());
  formData.append('last_name',document.getElementById('inp_last_name').value.trim());
  formData.append('gender',document.getElementById('inp_gender').value);
  formData.append('dob',document.getElementById('inp_dob').value);
  formData.append('phone',document.getElementById('inp_phone').value.trim());
  formData.append('bio',document.getElementById('inp_bio').value.trim());
  formData.append('address',userData.address||''); formData.append('village',userData.village||'');
  formData.append('district',userData.district||''); formData.append('state',userData.state||'');
  formData.append('pincode',userData.pincode||''); formData.append('aadhar',userData.aadhar||'');
  formData.append('pan',userData.pan||''); formData.append('farm_size',userData.farm_size||'');
  formData.append('farm_type',userData.farm_type||'');
  if (uploadedImgFile) formData.append('profile_img',uploadedImgFile);
  try {
    const res=await fetch('/api/profile',{method:'PUT',credentials:'include',body:formData});
    const data=await res.json();
    if (data.success) { showToast('✅ Profile updated!'); uploadedImgFile=null; await loadProfile(); cancelEdit(); }
    else showToast(data.error||'Failed to save','error');
  } catch(err) { showToast('Server error','error'); }
  btn.disabled=false; btn.textContent='💾 Save Changes';
}

function toggleIdentEdit() {
  isIdentEditing=!isIdentEditing;
  ['inp_aadhar','inp_pan'].forEach(id=>{document.getElementById(id).disabled=!isIdentEditing;});
  document.getElementById('identSaveBar').style.display=isIdentEditing?'flex':'none';
  document.getElementById('identEditBtn').textContent=isIdentEditing?'✕ Cancel':'✏️ Edit Documents';
}
function cancelIdentEdit() {
  isIdentEditing=false;
  document.getElementById('inp_aadhar').value=userData.aadhar||'';
  document.getElementById('inp_pan').value=userData.pan||'';
  ['inp_aadhar','inp_pan'].forEach(id=>{document.getElementById(id).disabled=true;});
  document.getElementById('identSaveBar').style.display='none';
  document.getElementById('identEditBtn').textContent='✏️ Edit Documents';
}
async function saveIdent(e) {
  e.preventDefault();
  const aadhar=document.getElementById('inp_aadhar').value.trim().replace(/\s/g,'');
  const pan=document.getElementById('inp_pan').value.trim().toUpperCase();
  if (aadhar&&!/^\d{12}$/.test(aadhar)) { showToast('Aadhaar must be 12 digits','error'); return; }
  if (pan&&!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) { showToast('Invalid PAN format','error'); return; }
  const btn=document.getElementById('identSaveBtn'); btn.disabled=true; btn.textContent='⏳ Saving…';
  const formData=new FormData();
  formData.append('first_name',userData.first_name||''); formData.append('last_name',userData.last_name||'');
  formData.append('aadhar',aadhar); formData.append('pan',pan);
  ['gender','dob','phone','bio','address','village','district','state','pincode','farm_size','farm_type'].forEach(k=>formData.append(k,userData[k]||''));
  try {
    const res=await fetch('/api/profile',{method:'PUT',credentials:'include',body:formData});
    const data=await res.json();
    if (data.success) { showToast('✅ Documents saved!'); userData.aadhar=aadhar; userData.pan=pan; cancelIdentEdit(); }
    else showToast(data.error||'Failed to save','error');
  } catch(err) { showToast('Server error','error'); }
  btn.disabled=false; btn.textContent='💾 Save Documents';
}

// ── ADDRESS ──
function loadAddresses() {
  try {
    const stored=localStorage.getItem('kb_addresses_'+(userData.id||'user'));
    savedAddresses=stored?JSON.parse(stored):[];
    if (!savedAddresses.length&&(userData.address||userData.village)) {
      savedAddresses=[{id:Date.now(),type:'home',name:`${userData.first_name||''} ${userData.last_name||''}`.trim(),phone:userData.phone||'',street:userData.address||'',village:userData.village||'',district:userData.district||'',pincode:userData.pincode||'',state:userData.state||'',is_default:true}];
      saveAddressesToStorage();
    }
  } catch(e) { savedAddresses=[]; }
  renderAddresses();
}
function saveAddressesToStorage(){localStorage.setItem('kb_addresses_'+(userData.id||'user'),JSON.stringify(savedAddresses));}
function renderAddresses() {
  const grid=document.getElementById('addressGrid');
  if (!savedAddresses.length) { grid.innerHTML=`<div style="color:var(--text-light);font-size:13px;grid-column:1/-1;text-align:center;padding:30px"><div style="font-size:44px;margin-bottom:10px;opacity:.4">📍</div><div style="font-weight:700;margin-bottom:4px">No addresses saved</div></div>`; return; }
  const typeEmoji={home:'🏠',work:'🏢',farm:'🌾',other:'📍'};
  grid.innerHTML=savedAddresses.map(a=>`<div class="address-card ${a.is_default?'selected':''}"><div class="ac-type">${typeEmoji[a.type]||'📍'} ${a.type}</div><div class="ac-name">${a.name||'—'}</div><div class="ac-detail">${a.street?a.street+', ':''}${a.village||''}${a.district?', '+a.district:''}<br>${a.state||''}${a.pincode?' – '+a.pincode:''}<br>${a.phone?'📞 '+a.phone:''}</div>${a.is_default?'<span class="ac-default">✓ Default</span>':`<button class="ac-del" onclick="setDefaultAddress(${a.id})" title="Set as default" style="right:36px">⭐</button>`}<button class="ac-del" onclick="deleteAddress(${a.id})">✕</button></div>`).join('');
}
function openAddressModal(){document.getElementById('addressForm').reset();document.getElementById('addr_name').value=`${userData.first_name||''} ${userData.last_name||''}`.trim();document.getElementById('addr_phone').value=userData.phone||'';showModal('addressModal');}
function saveAddress(e) {
  e.preventDefault();
  const addr={id:Date.now(),type:document.getElementById('addr_type').value,name:document.getElementById('addr_name').value.trim(),phone:document.getElementById('addr_phone').value.trim(),street:document.getElementById('addr_street').value.trim(),village:document.getElementById('addr_village').value.trim(),district:document.getElementById('addr_district').value.trim(),pincode:document.getElementById('addr_pincode').value.trim(),state:document.getElementById('addr_state').value,is_default:document.getElementById('addr_default').checked};
  if (addr.is_default) savedAddresses.forEach(a=>a.is_default=false);
  else if (!savedAddresses.length) addr.is_default=true;
  savedAddresses.unshift(addr); saveAddressesToStorage();
  if (addr.is_default) syncDefaultAddressToBackend(addr);
  closeModal('addressModal'); renderAddresses(); showToast('✅ Address saved!');
}
function deleteAddress(id){savedAddresses=savedAddresses.filter(a=>a.id!==id);if(savedAddresses.length&&!savedAddresses.some(a=>a.is_default))savedAddresses[0].is_default=true;saveAddressesToStorage();renderAddresses();}
function setDefaultAddress(id){savedAddresses.forEach(a=>a.is_default=(a.id===id));saveAddressesToStorage();const def=savedAddresses.find(a=>a.id===id);if(def)syncDefaultAddressToBackend(def);renderAddresses();showToast('✅ Default address updated');}
async function syncDefaultAddressToBackend(addr) {
  const formData=new FormData();
  formData.append('first_name',userData.first_name||''); formData.append('last_name',userData.last_name||'');
  formData.append('address',addr.street||''); formData.append('village',addr.village||'');
  formData.append('district',addr.district||''); formData.append('state',addr.state||'');
  formData.append('pincode',addr.pincode||'');
  ['gender','dob','phone','bio','aadhar','pan','farm_size','farm_type'].forEach(k=>formData.append(k,userData[k]||''));
  await fetch('/api/profile',{method:'PUT',credentials:'include',body:formData});
}

// ═══════════════════════════════════════
// CUSTOMER — PASSWORD + OTP
// ═══════════════════════════════════════

function checkPwStrength(val) {
  const bar=document.getElementById('pwStrengthBar');
  const txt=document.getElementById('pwStrengthTxt');
  let score=0;
  if(val.length>=8)score++;
  if(/[A-Z]/.test(val))score++;
  if(/\d/.test(val))score++;
  if(/[@$!%*?&]/.test(val))score++;
  bar.className='pw-strength-bar';
  if(score<=2){bar.classList.add('weak');txt.textContent='⚠ Weak password';txt.style.color='var(--red)';}
  else if(score===3){bar.classList.add('ok');txt.textContent='⚡ Medium strength';txt.style.color='var(--gold)';}
  else{bar.classList.add('strong');txt.textContent='✅ Strong password';txt.style.color='var(--green)';}
}

async function custSendOtp(isResend=false) {
  const cur  = document.getElementById('inp_current_pw').value;
  const nw   = document.getElementById('inp_new_pw').value;
  const conf = document.getElementById('inp_confirm_pw').value;
  if (!cur)       { showToast('Enter your current password','error'); return; }
  if (!nw)        { showToast('Enter a new password','error'); return; }
  if (nw !== conf){ showToast('New passwords do not match','error'); return; }

  const btn      = document.getElementById('custSendOtpBtn');
  const resendBtn= document.getElementById('custResendOtpBtn');
  const activeBtn= isResend ? resendBtn : btn;
  const origText = isResend ? 'Resend OTP' : '📧 Send OTP to Email';
  activeBtn.disabled=true;
  activeBtn.innerHTML = isResend ? 'Sending…' : '<span class="spinner"></span>Sending OTP…';

  try {
    const res=await fetch('/api/send-password-otp',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({current_password:cur,new_password:nw,confirm_password:conf})});
    const data=await res.json();
    if (data.success) {
      showToast(`✅ OTP sent! ${data.message||''}`);
      document.getElementById('custOtpSentMsg').textContent = data.message || 'A 6-digit OTP has been sent to your registered email.';
      document.getElementById('cust_pwStep2').classList.add('visible');
      document.getElementById('cust_otp').value='';
      document.getElementById('cust_otp').focus();
      custStartOtpTimer(600);
    } else {
      showToast(data.error||'Failed to send OTP','error');
    }
  } catch(e) { showToast('Network error','error'); }
  activeBtn.disabled=false;
  activeBtn.innerHTML=origText;
}

function custStartOtpTimer(seconds) {
  clearInterval(custOtpTimerInterval);
  const timerEl=document.getElementById('custOtpTimerVal');
  const timerWrap=document.getElementById('custOtpTimerWrap');
  const resendBtn=document.getElementById('custResendOtpBtn');
  resendBtn.disabled=true;
  timerWrap.classList.remove('expired');
  let remaining=seconds;
  custOtpTimerInterval=setInterval(()=>{
    remaining--;
    const m=Math.floor(remaining/60).toString().padStart(2,'0');
    const s=(remaining%60).toString().padStart(2,'0');
    timerEl.textContent=`${m}:${s}`;
    if (remaining<=0) {
      clearInterval(custOtpTimerInterval);
      timerEl.textContent='00:00';
      timerWrap.classList.add('expired');
      timerWrap.innerHTML='⏱️ OTP expired — <span style="color:var(--red);font-weight:800">Please resend.</span>';
      resendBtn.disabled=false;
    }
    if (remaining===seconds-30) resendBtn.disabled=false;
  },1000);
}

async function custChangePassword() {
  const otp  = document.getElementById('cust_otp').value.trim();
  const cur  = document.getElementById('inp_current_pw').value;
  const nw   = document.getElementById('inp_new_pw').value;
  const conf = document.getElementById('inp_confirm_pw').value;
  if (!otp||otp.length<6) { showToast('Enter the 6-digit OTP','error'); return; }
  const btn=document.getElementById('custChangePwBtn');
  btn.disabled=true; btn.innerHTML='<span class="spinner"></span>Verifying…';
  try {
    const res=await fetch('/api/change-password',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({current_password:cur,new_password:nw,confirm_password:conf,otp})});
    const data=await res.json();
    if (data.success) { showToast('✅ Password changed successfully!'); clearInterval(custOtpTimerInterval); custResetPasswordForm(); }
    else showToast(data.error||'Failed to change password','error');
  } catch(e) { showToast('Network error','error'); }
  btn.disabled=false; btn.innerHTML='🔐 Verify & Change Password';
}

function custCancelOtp() {
  clearInterval(custOtpTimerInterval);
  document.getElementById('cust_pwStep2').classList.remove('visible');
  document.getElementById('cust_otp').value='';
}
function custResetPasswordForm() {
  document.getElementById('inp_current_pw').value='';
  document.getElementById('inp_new_pw').value='';
  document.getElementById('inp_confirm_pw').value='';
  document.getElementById('cust_otp').value='';
  document.getElementById('pwStrengthBar').className='pw-strength-bar';
  document.getElementById('pwStrengthTxt').textContent='';
  document.getElementById('cust_pwStep2').classList.remove('visible');
  clearInterval(custOtpTimerInterval);
}

// ── DELETE ──
function showDeleteModal(){showModal('deleteModal');}
async function deleteAccount() {
  const pw=document.getElementById('deletePassword').value;
  if (!pw) { showToast('Please enter your password','error'); return; }
  try {
    const res=await fetch('/api/account',{method:'DELETE',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});
    const data=await res.json();
    if (data.success) { showToast('Account deleted. Redirecting…'); setTimeout(()=>window.location.href='/login',1500); }
    else showToast(data.error||'Failed to delete account','error');
  } catch(err) { showToast('Server error','error'); }
}

// ── HELPERS ──
function togglePw(id,btn){const inp=document.getElementById(id);if(inp.type==='password'){inp.type='text';btn.textContent='🙈';}else{inp.type='password';btn.textContent='👁';}}
function showModal(id){document.getElementById(id).classList.add('active');}
function closeModal(id){document.getElementById(id).classList.remove('active');}
document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('active');}));

function showToast(msg,type='') {
  const wrap=document.getElementById('toastWrap');
  const t=document.createElement('div');
  t.className='toast'+(type?' '+type:'');
  t.textContent=msg;
  wrap.appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},3200);
}
