let profileData = {};
let isEditing = false;
let isDocEditing = false;
let pendingImgFile = null;
let spOtpTimerInterval = null;

const PERSONAL_FIELDS = ['inp_first_name','inp_last_name','inp_gender','inp_dob','inp_phone','inp_bio','inp_address','inp_village','inp_district','inp_pincode','inp_state'];
const DOCUMENT_FIELDS = ['inp_aadhar','inp_pan','inp_dl_number','inp_dl_expiry','inp_dl_type','inp_dl_rto','inp_vehicle_reg','inp_vehicle_type','inp_vehicle_reg_expiry','inp_insurance'];

document.addEventListener('DOMContentLoaded', async () => { await loadProfile(); await loadStats(); });

async function loadProfile() {
  try {
    const res=await fetch('/api/profile',{credentials:'include'});
    if (res.status===401){window.location.href='/login';return;}
    profileData=await res.json(); populateUI();
  } catch(e){showToast('Failed to load profile','err');}
}

function populateUI() {
  const u=profileData;
  const name=`${u.first_name||''} ${u.last_name||''}`.trim()||'Service Provider';
  const initials=`${(u.first_name||'')[0]||''}${(u.last_name||'')[0]||''}`.toUpperCase()||'??';
  document.getElementById('navName').textContent=name;
  setAvatar('navAvatar','navInitials',u.profile_img,initials);
  document.getElementById('heroName').textContent=name;
  document.getElementById('heroEmail').textContent=u.email||'—';
  document.getElementById('heroPhone').textContent=u.phone?'📞 '+u.phone:'📞 Not set';
  setAvatar('heroAvatar','heroInitials',u.profile_img,initials);
  setAvatar('avatarPreview','avatarInitials',u.profile_img,initials);
  if(u.created_at){const d=new Date(u.created_at);document.getElementById('heroSince').textContent='Since '+d.toLocaleDateString('en-IN',{month:'short',year:'numeric'});}
  const hasKyc=u.aadhar&&u.pan&&u.dl_number;
  document.getElementById('heroKycBadge').textContent=hasKyc?'✅ KYC Verified':'⚠ KYC Pending';
  document.getElementById('heroKycBadge').style.background=hasKyc?'rgba(82,183,136,.25)':'rgba(233,167,26,.25)';
  setVal('inp_first_name',u.first_name||''); setVal('inp_last_name',u.last_name||'');
  setVal('inp_gender',u.gender||''); setVal('inp_dob',u.dob||'');
  setVal('inp_email',u.email||''); setVal('inp_phone',u.phone||'');
  setVal('inp_bio',u.bio||''); setVal('inp_address',u.address||'');
  setVal('inp_village',u.village||''); setVal('inp_district',u.district||'');
  setVal('inp_pincode',u.pincode||''); setVal('inp_state',u.state||'');
  setVal('inp_aadhar',u.aadhar||''); setVal('inp_pan',u.pan||'');
  setVal('inp_dl_number',u.dl_number||''); setVal('inp_dl_expiry',u.dl_expiry||'');
  setVal('inp_dl_type',u.dl_type||''); setVal('inp_dl_rto',u.dl_rto||'');
  setVal('inp_vehicle_reg',u.vehicle_reg||''); setVal('inp_vehicle_type',u.vehicle_type||'');
  setVal('inp_vehicle_reg_expiry',u.vehicle_reg_expiry||''); setVal('inp_insurance',u.insurance||'');
  const dlNum=u.dl_number;
  const dlBadge=document.getElementById('dlBadge'),dlWarn=document.getElementById('dlWarnBox');
  if(dlNum){dlBadge.innerHTML='<span style="background:#d4edda;color:#1a6b3a;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">✅ On File</span>';dlWarn.style.display='none';}
  else{dlBadge.innerHTML='<span style="background:#fff3cd;color:#856404;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">⚠ Missing</span>';dlWarn.style.display='flex';}
  const kycEl=document.getElementById('kycStatus');
  if(kycEl)kycEl.innerHTML=(u.aadhar&&u.pan)?'<span class="kyc-badge verified">✅ ID Verified</span>':'<span class="kyc-badge unverified">⚠ Not Verified</span>';
}

function setAvatar(wrapId,initId,imgUrl,initials){const wrap=document.getElementById(wrapId);if(!wrap)return;if(imgUrl){wrap.innerHTML=`<img src="${imgUrl}" alt="avatar">`;}else{const ini=document.getElementById(initId);if(ini)ini.textContent=initials;}}

async function loadStats() {
  try{const res=await fetch('/api/service-listings',{credentials:'include'});if(res.ok){const data=await res.json();document.getElementById('statListings').textContent=data.length;}}catch(e){}
  document.getElementById('statBookings').textContent='—'; document.getElementById('statRating').textContent='—';
}

function toggleEdit(){isEditing=!isEditing;PERSONAL_FIELDS.forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=!isEditing;});document.getElementById('personalSaveBar').style.display=isEditing?'flex':'none';document.getElementById('editToggleBtn').textContent=isEditing?'✕ Cancel':'✏️ Edit Profile';document.getElementById('editToggleBtn').classList.toggle('editing',isEditing);document.querySelector('.upload-area').style.pointerEvents=isEditing?'all':'none';document.querySelector('.upload-area').style.opacity=isEditing?'1':'.6';}
function cancelEdit(){isEditing=false;pendingImgFile=null;PERSONAL_FIELDS.forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=true;});document.getElementById('personalSaveBar').style.display='none';document.getElementById('editToggleBtn').textContent='✏️ Edit Profile';document.getElementById('editToggleBtn').classList.remove('editing');populateUI();}
function toggleDocEdit(){isDocEditing=!isDocEditing;DOCUMENT_FIELDS.forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=!isDocEditing;});document.getElementById('documentsSaveBar').style.display=isDocEditing?'flex':'none';document.getElementById('docEditBtn').textContent=isDocEditing?'✕ Cancel':'✏️ Edit Documents';}
function cancelDocEdit(){isDocEditing=false;DOCUMENT_FIELDS.forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=true;});document.getElementById('documentsSaveBar').style.display='none';document.getElementById('docEditBtn').textContent='✏️ Edit Documents';populateUI();}
function triggerImgUpload(){document.getElementById('heroImgInput').click();}
function previewImage(input){const file=input.files[0];if(!file)return;if(file.size>5*1024*1024){showToast('Image too large (max 5MB)','err');return;}pendingImgFile=file;const url=URL.createObjectURL(file);['heroAvatar','avatarPreview'].forEach(id=>{document.getElementById(id).innerHTML=`<img src="${url}" alt="preview">`;});document.getElementById('navAvatar').innerHTML=`<img src="${url}" alt="preview">`;document.getElementById('photoHint').textContent=`${file.name} selected — save to upload`;if(!isEditing)toggleEdit();}

async function savePersonal(e) {
  e.preventDefault();
  const btn=document.getElementById('personalSaveBtn');
  btn.innerHTML='<span class="spinner"></span>Saving…';btn.disabled=true;
  const fd=new FormData();
  fd.append('first_name',document.getElementById('inp_first_name').value.trim());
  fd.append('last_name',document.getElementById('inp_last_name').value.trim());
  fd.append('gender',document.getElementById('inp_gender').value);
  fd.append('dob',document.getElementById('inp_dob').value);
  fd.append('phone',document.getElementById('inp_phone').value.trim());
  fd.append('bio',document.getElementById('inp_bio').value.trim());
  fd.append('address',document.getElementById('inp_address').value.trim());
  fd.append('village',document.getElementById('inp_village').value.trim());
  fd.append('district',document.getElementById('inp_district').value.trim());
  fd.append('pincode',document.getElementById('inp_pincode').value.trim());
  fd.append('state',document.getElementById('inp_state').value);
  ['aadhar','pan','dl_number','dl_expiry','dl_type','dl_rto','vehicle_reg','vehicle_type','vehicle_reg_expiry','insurance','farm_size','farm_type'].forEach(k=>fd.append(k,profileData[k]||''));
  if(pendingImgFile)fd.append('profile_img',pendingImgFile);
  try{const res=await fetch('/api/profile',{method:'PUT',credentials:'include',body:fd});const data=await res.json();if(data.success){showToast('✅ Profile saved!');pendingImgFile=null;await loadProfile();cancelEdit();}else showToast(data.error||'Save failed','err');}
  catch(e){showToast('Network error','err');}
  btn.innerHTML='💾 Save Changes';btn.disabled=false;
}

async function saveDocuments(e) {
  e.preventDefault();
  const aadhar=document.getElementById('inp_aadhar').value.replace(/\s/g,'');
  const pan=document.getElementById('inp_pan').value.trim().toUpperCase();
  const dlNum=document.getElementById('inp_dl_number').value.trim().toUpperCase();
  if(aadhar&&!/^\d{12}$/.test(aadhar)){showToast('Aadhaar must be 12 digits','err');return;}
  if(pan&&!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)){showToast('Invalid PAN format','err');return;}
  const btn=document.getElementById('docSaveBtn');btn.innerHTML='<span class="spinner"></span>Saving…';btn.disabled=true;
  const fd=new FormData();
  ['first_name','last_name','phone','gender','dob','bio','address','village','district','state','pincode','farm_size','farm_type'].forEach(k=>fd.append(k,profileData[k]||''));
  fd.append('aadhar',aadhar);fd.append('pan',pan);fd.append('dl_number',dlNum);
  fd.append('dl_expiry',document.getElementById('inp_dl_expiry').value);
  fd.append('dl_type',document.getElementById('inp_dl_type').value);
  fd.append('dl_rto',document.getElementById('inp_dl_rto').value.trim());
  fd.append('vehicle_reg',document.getElementById('inp_vehicle_reg').value.trim().toUpperCase());
  fd.append('vehicle_type',document.getElementById('inp_vehicle_type').value);
  fd.append('vehicle_reg_expiry',document.getElementById('inp_vehicle_reg_expiry').value);
  fd.append('insurance',document.getElementById('inp_insurance').value.trim());
  try{const res=await fetch('/api/profile',{method:'PUT',credentials:'include',body:fd});const data=await res.json();if(data.success){showToast('✅ Documents saved!');await loadProfile();cancelDocEdit();}else showToast(data.error||'Save failed','err');}
  catch(e){showToast('Network error','err');}
  btn.innerHTML='💾 Save Documents';btn.disabled=false;
}

// ═══════════════════════════════════════
// SERVICE PROVIDER — PASSWORD + OTP
// ═══════════════════════════════════════

function checkPwStrength(pw) {
  const bars=['pb1','pb2','pb3','pb4'];
  const hint=document.getElementById('pwHint');
  bars.forEach(b=>{const el=document.getElementById(b);if(el)el.className='pw-bar';});
  if(!pw){if(hint)hint.textContent='Enter password to check strength';return;}
  let score=0;
  if(pw.length>=8)score++;if(/[A-Z]/.test(pw))score++;if(/\d/.test(pw))score++;if(/[@$!%*?&]/.test(pw))score++;
  const cls=score<=1?'weak':score<=2?'medium':'strong';
  const label=score<=1?'Weak':score<=2?'Medium':score<=3?'Strong':'Very Strong';
  const color=score<=1?'#ef4444':score<=2?'var(--amber)':'#22c55e';
  for(let i=0;i<score;i++){const el=document.getElementById(bars[i]);if(el)el.classList.add(cls);}
  if(hint){hint.textContent=label;hint.style.color=color;}
}

async function spSendOtp(isResend=false) {
  const cur  = document.getElementById('inp_cur_pw').value;
  const nw   = document.getElementById('inp_new_pw').value;
  const conf = document.getElementById('inp_conf_pw').value;
  if (!cur)       { showToast('Enter your current password','err'); return; }
  if (!nw)        { showToast('Enter a new password','err'); return; }
  if (nw !== conf){ showToast('Passwords do not match','err'); return; }

  const btn      = document.getElementById('spSendOtpBtn');
  const resendBtn= document.getElementById('spResendOtpBtn');
  const activeBtn= isResend ? resendBtn : btn;
  const origHTML = isResend ? 'Resend OTP' : '📧 Send OTP to Email';
  activeBtn.disabled=true;
  activeBtn.innerHTML=isResend?'Sending…':'<span class="spinner"></span>Sending OTP…';

  try {
    const res=await fetch('/api/send-password-otp',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({current_password:cur,new_password:nw,confirm_password:conf})});
    const data=await res.json();
    if (data.success) {
      showToast(`✅ OTP sent! ${data.message||''}`);
      document.getElementById('spOtpSentMsg').textContent=data.message||'A 6-digit OTP has been sent to your registered email.';
      document.getElementById('sp_pwStep2').classList.add('visible');
      document.getElementById('sp_otp').value='';
      document.getElementById('sp_otp').focus();
      spStartOtpTimer(600);
    } else {
      showToast(data.error||'Failed to send OTP','err');
    }
  } catch(e) { showToast('Network error','err'); }
  activeBtn.disabled=false;
  activeBtn.innerHTML=origHTML;
}

function spStartOtpTimer(seconds) {
  clearInterval(spOtpTimerInterval);
  const timerEl=document.getElementById('spOtpTimerVal');
  const timerWrap=document.getElementById('spOtpTimerWrap');
  const resendBtn=document.getElementById('spResendOtpBtn');
  resendBtn.disabled=true;
  timerWrap.classList.remove('expired');
  let remaining=seconds;
  spOtpTimerInterval=setInterval(()=>{
    remaining--;
    const m=Math.floor(remaining/60).toString().padStart(2,'0');
    const s=(remaining%60).toString().padStart(2,'0');
    timerEl.textContent=`${m}:${s}`;
    if(remaining<=0){
      clearInterval(spOtpTimerInterval);
      timerEl.textContent='00:00';
      timerWrap.classList.add('expired');
      timerWrap.innerHTML='⏱️ OTP expired — <span style="color:var(--red);font-weight:700">Please resend.</span>';
      resendBtn.disabled=false;
    }
    if(remaining===seconds-30)resendBtn.disabled=false;
  },1000);
}

async function spChangePassword() {
  const otp  = document.getElementById('sp_otp').value.trim();
  const cur  = document.getElementById('inp_cur_pw').value;
  const nw   = document.getElementById('inp_new_pw').value;
  const conf = document.getElementById('inp_conf_pw').value;
  if(!otp||otp.length<6){showToast('Enter the 6-digit OTP','err');return;}
  const btn=document.getElementById('spChangePwBtn');
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span>Verifying…';
  try {
    const res=await fetch('/api/change-password',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({current_password:cur,new_password:nw,confirm_password:conf,otp})});
    const data=await res.json();
    if(data.success){showToast('✅ Password changed successfully!');clearInterval(spOtpTimerInterval);spResetPasswordForm();}
    else showToast(data.error||'Failed to change password','err');
  } catch(e){showToast('Network error','err');}
  btn.disabled=false;btn.innerHTML='🔐 Verify & Change Password';
}

function spCancelOtp(){clearInterval(spOtpTimerInterval);document.getElementById('sp_pwStep2').classList.remove('visible');document.getElementById('sp_otp').value='';}
function spResetPasswordForm(){document.getElementById('inp_cur_pw').value='';document.getElementById('inp_new_pw').value='';document.getElementById('inp_conf_pw').value='';document.getElementById('sp_otp').value='';['pb1','pb2','pb3','pb4'].forEach(b=>{const el=document.getElementById(b);if(el)el.className='pw-bar';});document.getElementById('sp_pwStep2').classList.remove('visible');clearInterval(spOtpTimerInterval);}

async function deleteAccount() {
  const pw=document.getElementById('deletePassword').value;
  if(!pw){showToast('Enter your password','err');return;}
  try{const res=await fetch('/api/account',{method:'DELETE',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});const data=await res.json();if(data.success){showToast('Account deleted. Redirecting…');setTimeout(()=>window.location.href='/login',1800);}else showToast(data.error||'Incorrect password','err');}
  catch(e){showToast('Network error','err');}
}

function formatAadhar(el){let v=el.value.replace(/\D/g,'').slice(0,12);el.value=v.replace(/(\d{4})(?=\d)/g,'$1 ').trim();}
function togglePw(id,btn){const inp=document.getElementById(id);if(inp.type==='password'){inp.type='text';btn.textContent='🙈';}else{inp.type='password';btn.textContent='👁';}}
function switchTab(tab,btn){document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));document.getElementById('tab-'+tab).classList.add('active');btn.classList.add('active');}
function setVal(id,val){const el=document.getElementById(id);if(el)el.value=val;}
function showModal(id){document.getElementById(id).classList.add('active');}
function closeModal(id){document.getElementById(id).classList.remove('active');}
document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('active');}));

function showToast(msg,type=''){
  const w=document.getElementById('toastWrap');
  const t=document.createElement('div');
  t.className='toast'+(type?' '+type:'');
  t.textContent=msg;
  w.appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},3200);
}