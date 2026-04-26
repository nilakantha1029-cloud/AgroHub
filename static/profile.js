let profileData = {};
let pendingImgFile = null;
let otpTimerInterval = null;

// ── TABS ──
function switchTab(name) {
  document.querySelectorAll('.card').forEach(c=>c.classList.remove('visible'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('visible');
  event.currentTarget.classList.add('active');
  if (name === 'security' && window.location.hash !== '#change-password') {
    history.replaceState(null,'','#change-password');
  }
}

// ── LOAD PROFILE ──
async function loadProfile() {
  try {
    const res = await fetch('/api/profile',{credentials:'include'});
    if (!res.ok) { window.location.href='/login'; return; }
    profileData = await res.json();
    populateForm(profileData);
  } catch(e) { window.location.href='/login'; }
}

function populateForm(u) {
  const big = document.getElementById('profileAvatarBig');
  if (u.profile_img) {
    big.innerHTML = `<img src="${u.profile_img}" alt="avatar"/><div class="avatar-upload-btn" onclick="document.getElementById('profileImgInput').click()">📷</div>`;
  } else {
    const initials = `${u.first_name[0]||''}${u.last_name[0]||''}`.toUpperCase();
    document.getElementById('profileInitialsBig').textContent = initials;
  }
  document.getElementById('profileFullName').textContent = `${u.first_name} ${u.last_name}`;
  document.getElementById('profileRole').textContent = `${(u.role||'farmer').charAt(0).toUpperCase()+(u.role||'farmer').slice(1)} · AgroHub`;
  if (u.created_at) {
    document.getElementById('memberSince').textContent = new Date(u.created_at).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  }
  document.getElementById('profileVerBadge').innerHTML = u.aadhar
    ? '<span class="verified-badge">✅ ID Verified</span>'
    : '<span class="unverified-badge">⚠ ID Not Verified</span>';
  setVal('p_first_name',u.first_name); setVal('p_last_name',u.last_name);
  setVal('p_email',u.email); setVal('p_phone',u.phone||'');
  setVal('p_gender',u.gender||''); setVal('p_dob',u.dob||'');
  setVal('p_address',u.address||''); setVal('p_village',u.village||'');
  setVal('p_district',u.district||''); setVal('p_state',u.state||'');
  setVal('p_pincode',u.pincode||''); setVal('p_bio',u.bio||'');
  setVal('f_farm_size',u.farm_size||''); setVal('f_farm_type',u.farm_type||'');
  setVal('id_aadhar',u.aadhar ? maskAadhar(u.aadhar) : '');
  setVal('id_pan',u.pan||'');
}

function setVal(id,val){const el=document.getElementById(id);if(el)el.value=val;}
function maskAadhar(v){return v.replace(/\s/g,'').replace(/(\d{4})(\d{4})(\d{4})/,'$1 $2 $3');}

function previewProfileImg(input) {
  if (!input.files[0]) return;
  pendingImgFile = input.files[0];
  const url = URL.createObjectURL(pendingImgFile);
  const big = document.getElementById('profileAvatarBig');
  big.innerHTML = `<img src="${url}" alt="preview"/><div class="avatar-upload-btn" onclick="document.getElementById('profileImgInput').click()">📷</div>`;
  showToast('Image selected. Save to upload.');
}

async function savePersonalInfo(e) {
  e.preventDefault();
  const btn = document.getElementById('savePersonalBtn');
  btn.innerHTML='<span class="spinner"></span>Saving…'; btn.disabled=true;
  const fd = new FormData();
  fd.append('first_name',document.getElementById('p_first_name').value.trim());
  fd.append('last_name',document.getElementById('p_last_name').value.trim());
  fd.append('phone',document.getElementById('p_phone').value.trim());
  fd.append('gender',document.getElementById('p_gender').value);
  fd.append('dob',document.getElementById('p_dob').value);
  fd.append('address',document.getElementById('p_address').value.trim());
  fd.append('village',document.getElementById('p_village').value.trim());
  fd.append('district',document.getElementById('p_district').value.trim());
  fd.append('state',document.getElementById('p_state').value);
  fd.append('pincode',document.getElementById('p_pincode').value.trim());
  fd.append('bio',document.getElementById('p_bio').value.trim());
  fd.append('farm_size',document.getElementById('f_farm_size').value);
  fd.append('farm_type',document.getElementById('f_farm_type').value);
  fd.append('aadhar',profileData.aadhar||'');
  fd.append('pan',profileData.pan||'');
  if (pendingImgFile) fd.append('profile_img',pendingImgFile);
  try {
    const res = await fetch('/api/profile',{method:'PUT',credentials:'include',body:fd});
    const data = await res.json();
    if (data.success) { showToast('✅ Profile saved!'); pendingImgFile=null; document.getElementById('profileFullName').textContent=data.name; await loadProfile(); }
    else showToast(data.error||'Save failed','error');
  } catch(e) { showToast('Network error','error'); }
  btn.innerHTML='💾 Save Changes'; btn.disabled=false;
}

async function saveFarmInfo(e) {
  e.preventDefault();
  const btn = document.getElementById('saveFarmBtn');
  btn.innerHTML='<span class="spinner"></span>Saving…'; btn.disabled=true;
  const fd = new FormData();
  ['first_name','last_name','phone','gender','dob','address','village','district','state','pincode','bio'].forEach(k=>fd.append(k,profileData[k]||''));
  fd.append('farm_size',document.getElementById('f_farm_size').value);
  fd.append('farm_type',document.getElementById('f_farm_type').value);
  fd.append('aadhar',profileData.aadhar||''); fd.append('pan',profileData.pan||'');
  try {
    const res = await fetch('/api/profile',{method:'PUT',credentials:'include',body:fd});
    const data = await res.json();
    if (data.success) { showToast('✅ Farm details saved!'); await loadProfile(); }
    else showToast(data.error||'Save failed','error');
  } catch(e) { showToast('Network error','error'); }
  btn.innerHTML='💾 Save Farm Details'; btn.disabled=false;
}

async function saveIdentification(e) {
  e.preventDefault();
  const aadhar = document.getElementById('id_aadhar').value.replace(/\s/g,'');
  const pan = document.getElementById('id_pan').value.trim().toUpperCase();
  if (aadhar && !/^\d{12}$/.test(aadhar)) { showToast('Invalid Aadhar number','error'); return; }
  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) { showToast('Invalid PAN format','error'); return; }
  const btn = document.getElementById('saveIdBtn');
  btn.innerHTML='<span class="spinner"></span>Saving…'; btn.disabled=true;
  const fd = new FormData();
  ['first_name','last_name','phone','gender','dob','address','village','district','state','pincode','bio','farm_size','farm_type'].forEach(k=>fd.append(k,profileData[k]||''));
  fd.append('aadhar',aadhar); fd.append('pan',pan);
  try {
    const res = await fetch('/api/profile',{method:'PUT',credentials:'include',body:fd});
    const data = await res.json();
    if (data.success) { showToast('✅ Identification saved!'); await loadProfile(); }
    else showToast(data.error||'Save failed','error');
  } catch(e) { showToast('Network error','error'); }
  btn.innerHTML='💾 Save Identification'; btn.disabled=false;
}

// ═══════════════════════════════════════
// PASSWORD CHANGE WITH OTP
// ═══════════════════════════════════════

function checkStrength(val) {
  const el   = document.getElementById('pwdStrength');
  const hint = document.getElementById('pwdHint');
  if (!val) { el.className='pwd-strength'; hint.textContent='Min 8 chars · 1 uppercase · 1 number · 1 special character'; return; }
  let score=0;
  if(val.length>=8)score++;
  if(/[A-Z]/.test(val))score++;
  if(/\d/.test(val))score++;
  if(/[@$!%*?&]/.test(val))score++;
  if(score<=1){el.className='pwd-strength weak';hint.textContent='Weak password';}
  else if(score<=3){el.className='pwd-strength medium';hint.textContent='Medium strength';}
  else{el.className='pwd-strength strong';hint.textContent='Strong password ✅';}
}

async function sendOtp(isResend = false) {
  const cur  = document.getElementById('s_current').value;
  const nw   = document.getElementById('s_new').value;
  const conf = document.getElementById('s_confirm').value;

  if (!cur)  { showToast('Enter your current password','error'); return; }
  if (!nw)   { showToast('Enter a new password','error'); return; }
  if (nw !== conf) { showToast('New passwords do not match','error'); return; }

  const btn = document.getElementById('sendOtpBtn');
  const resendBtn = document.getElementById('resendOtpBtn');
  const activeBtn = isResend ? resendBtn : btn;
  const origText  = activeBtn.innerHTML || activeBtn.textContent;
  activeBtn.disabled = true;
  if (!isResend) { btn.innerHTML='<span class="spinner"></span>Sending OTP…'; }
  else           { resendBtn.textContent='Sending…'; }

  try {
    const res  = await fetch('/api/send-password-otp',{
      method:'POST',credentials:'include',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({current_password:cur,new_password:nw,confirm_password:conf})
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ OTP sent! ${data.message||''}`);
      document.getElementById('otpSentMsg').textContent = data.message || 'A 6-digit OTP has been sent to your registered email.';
      document.getElementById('pwStep2').classList.add('visible');
      document.getElementById('s_otp').value='';
      document.getElementById('s_otp').focus();
      startOtpTimer(600); // 10 minutes
    } else {
      showToast(data.error||'Failed to send OTP','error');
    }
  } catch(e) { showToast('Network error','error'); }

  if (!isResend) { btn.innerHTML=origText; btn.disabled=false; }
  else           { resendBtn.textContent='Resend OTP'; }
}

function startOtpTimer(seconds) {
  clearInterval(otpTimerInterval);
  const timerEl   = document.getElementById('otpTimerVal');
  const timerWrap = document.getElementById('otpTimerWrap');
  const resendBtn = document.getElementById('resendOtpBtn');
  resendBtn.disabled = true;
  let remaining = seconds;

  timerWrap.classList.remove('expired');

  otpTimerInterval = setInterval(()=>{
    remaining--;
    const m = Math.floor(remaining/60).toString().padStart(2,'0');
    const s = (remaining%60).toString().padStart(2,'0');
    timerEl.textContent = `${m}:${s}`;
    if (remaining <= 0) {
      clearInterval(otpTimerInterval);
      timerEl.textContent='00:00';
      timerWrap.classList.add('expired');
      timerWrap.innerHTML='⏱️ OTP expired. <span style="color:var(--red);font-weight:700">Please resend.</span>';
      resendBtn.disabled = false;
    }
    // Enable resend after 30 seconds
    if (remaining === seconds - 30) resendBtn.disabled = false;
  }, 1000);
}

async function changePassword() {
  const otp  = document.getElementById('s_otp').value.trim();
  const cur  = document.getElementById('s_current').value;
  const nw   = document.getElementById('s_new').value;
  const conf = document.getElementById('s_confirm').value;

  if (!otp || otp.length < 6) { showToast('Enter the 6-digit OTP','error'); return; }

  const btn = document.getElementById('changePwdBtn');
  btn.innerHTML='<span class="spinner"></span>Verifying…'; btn.disabled=true;

  try {
    const res  = await fetch('/api/change-password',{
      method:'POST',credentials:'include',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({current_password:cur,new_password:nw,confirm_password:conf,otp})
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ Password changed successfully!');
      clearInterval(otpTimerInterval);
      resetPasswordForm();
    } else {
      showToast(data.error||'Failed to change password','error');
    }
  } catch(e) { showToast('Network error','error'); }
  btn.innerHTML='🔐 Verify & Change Password'; btn.disabled=false;
}

function cancelOtp() {
  clearInterval(otpTimerInterval);
  document.getElementById('pwStep2').classList.remove('visible');
  document.getElementById('s_otp').value='';
}

function resetPasswordForm() {
  document.getElementById('s_current').value='';
  document.getElementById('s_new').value='';
  document.getElementById('s_confirm').value='';
  document.getElementById('s_otp').value='';
  document.getElementById('pwdStrength').className='pwd-strength';
  document.getElementById('pwdHint').textContent='Min 8 chars · 1 uppercase · 1 number · 1 special character';
  document.getElementById('pwStep2').classList.remove('visible');
  clearInterval(otpTimerInterval);
}

// ── HELPERS ──
function formatAadhar(el){let v=el.value.replace(/\D/g,'').slice(0,12);el.value=v.replace(/(\d{4})(?=\d)/g,'$1 ').trim();}

function showToast(msg,type=''){
  const wrap=document.getElementById('toastWrap');
  const t=document.createElement('div');
  t.className='toast'+(type?' '+type:'');
  t.textContent=msg;
  wrap.appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},3000);
}

document.addEventListener('DOMContentLoaded',()=>{
  loadProfile();
  if (window.location.hash === '#change-password') {
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.getElementById('securityTab').classList.add('active');
    document.querySelectorAll('.card').forEach(c=>c.classList.remove('visible'));
    document.getElementById('tab-security').classList.add('visible');
  }
});