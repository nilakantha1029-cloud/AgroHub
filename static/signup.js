/* ================================================================
   AgroHub — signup.js  (OTP-verified signup flow)
   ================================================================ */

document.addEventListener("DOMContentLoaded", function () {

  // ── Restore saved form on return from Terms page ──────────────
  const returningFromTerms = sessionStorage.getItem("returnFromTerms");
  if (!returningFromTerms) localStorage.removeItem("signupFormData");
  sessionStorage.removeItem("returnFromTerms");

  if (sessionStorage.getItem("termsAccepted") === "true") {
  const termsCheckbox = document.getElementById("terms");
  if (termsCheckbox) termsCheckbox.checked = true;
  sessionStorage.removeItem("termsAccepted");
}

  const signupForm = document.getElementById("signupForm");
  if (!signupForm) return;

  // ── Auto-select role from URL ─────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  const roleFromURL = params.get("role");
  if (roleFromURL) {
    const radio = document.querySelector(`input[name="role"][value="${roleFromURL}"]`);
    if (radio) radio.checked = true;
  }

  // ── Restore saved form data ───────────────────────────────────
  const savedData = localStorage.getItem("signupFormData");
if (savedData) {
    try {
      const fd = JSON.parse(savedData);
      // Restore role first — radios live outside <form> so handle directly
      if (fd["role"]) {
        const r = document.querySelector(`input[name="role"][value="${fd["role"]}"]`);
        if (r) r.checked = true;
      }
      // Restore all other form fields
      Object.keys(fd).forEach((key) => {
        if (key === "role") return; // already handled above
        const field = signupForm.elements[key];
        if (!field) return;
        field.value = fd[key];
      });
    } catch (e) { /* ignore */ }
}

  // ── Auto-save form while typing ───────────────────────────────
  function saveFormData() {
    const data = {};
    new FormData(signupForm).forEach((value, key) => {
      if (key === "terms") return;
      data[key] = value;
    });
    // Role radios are outside <form>, so capture separately
    const checkedRole = document.querySelector('input[name="role"]:checked');
    if (checkedRole) data["role"] = checkedRole.value;
    localStorage.setItem("signupFormData", JSON.stringify(data));
}

signupForm.addEventListener("input", saveFormData);

// Save whenever role changes (outside the form element)
document.querySelectorAll('input[name="role"]').forEach((radio) => {
    radio.addEventListener("change", saveFormData);
});

  // ── SIGNUP SUBMIT — Step 1: validate + send OTP ───────────────
  signupForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const roleInput = document.querySelector('input[name="role"]:checked');
    if (!roleInput) {
      Swal.fire({ icon: "warning", title: "Select Role", text: "Please choose a role before signing up." });
      return;
    }

    const first_name      = signupForm.elements["first_name"].value.trim();
    const last_name       = signupForm.elements["last_name"].value.trim();
    const email           = signupForm.elements["email"].value.trim();
    const password        = signupForm.elements["password"].value;
    const confirmPassword = signupForm.elements["confirmPassword"].value;
    const role            = roleInput.value;

    if (password !== confirmPassword) {
      Swal.fire({ icon: "error", title: "Password Mismatch", text: "Passwords do not match. Please re-enter." });
      return;
    }

    const submitBtn = signupForm.querySelector(".signup-btn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending OTP…";

    try {
      const res = await fetch("/api/signup/send-otp", {
        method:      "POST",
        headers:     { "Content-Type": "application/json" },
        credentials: "include",
        body:        JSON.stringify({ role, first_name, last_name, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        Swal.fire({ icon: "error", title: "Error", text: data.error || "Failed to send OTP." });
        return;
      }

      window._signupEmail = email;
      openOtpModal(email);

    } catch {
      Swal.fire({ icon: "error", title: "Network Error", text: "Could not connect. Please try again." });
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign Up";
    }
  });

  // ── Terms link ────────────────────────────────────────────────
  const termsLink = document.getElementById("termsLink");
  if (termsLink) {
    termsLink.addEventListener("click", function (e) {
      e.preventDefault();
      sessionStorage.setItem("returnFromTerms", "true");
      window.location.href = "/terms";
    });
  }

  const loginLink = document.getElementById("loginLink");
  if (loginLink) {
    loginLink.addEventListener("click", () => localStorage.removeItem("signupFormData"));
  }

  // ── Password eye toggle ───────────────────────────────────────
  document.querySelectorAll(".toggle-password").forEach((icon) => {
    icon.addEventListener("click", function () {
      const input = this.previousElementSibling;
      if (!input) return;
      if (input.type === "password") {
        input.type = "text";
        this.classList.replace("fa-eye", "fa-eye-slash");
      } else {
        input.type = "password";
        this.classList.replace("fa-eye-slash", "fa-eye");
      }
    });
  });

  // ── OTP digit boxes — auto-advance, backspace, paste ─────────
  document.querySelectorAll(".otp-digit").forEach((box, i, boxes) => {
    box.addEventListener("input", function () {
      this.value = this.value.replace(/\D/g, "").slice(-1);
      this.classList.toggle("filled", this.value !== "");
      if (this.value && i < boxes.length - 1) boxes[i + 1].focus();
    });
    box.addEventListener("keydown", function (e) {
      if (e.key === "Backspace" && !this.value && i > 0) boxes[i - 1].focus();
      if (e.key === "Enter") verifyOtp();
    });
    box.addEventListener("paste", function (e) {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
      [...text].slice(0, 6).forEach((ch, j) => {
        if (boxes[i + j]) { boxes[i + j].value = ch; boxes[i + j].classList.add("filled"); }
      });
      const nextEmpty = [...boxes].findIndex((b, j) => j >= i && !b.value);
      if (nextEmpty !== -1) boxes[nextEmpty].focus();
      else boxes[boxes.length - 1].focus();
    });
  });
});

/* ── OTP Modal ───────────────────────────────────────────────── */
let _otpTimer  = null;
let _timerSecs = 300;

function openOtpModal(email) {
  document.getElementById("otpEmailLabel").textContent = email;
  document.getElementById("otpOverlay").classList.add("show");
  document.querySelectorAll(".otp-digit").forEach(b => { b.value = ""; b.classList.remove("filled"); });
  document.getElementById("otpMsg").className = "otp-msg";
  document.getElementById("otpMsg").style.display = "none";
  document.getElementById("verifyBtn").disabled = false;
  document.getElementById("verifyBtn").innerHTML = '<i class="fa-solid fa-circle-check"></i> Verify & Complete Signup';
  document.getElementById("resendBtn").disabled = true;
  setTimeout(() => document.getElementById("d0").focus(), 200);
  startTimer();
}

function closeOtpModal() {
  document.getElementById("otpOverlay").classList.remove("show");
  clearInterval(_otpTimer);
}

function startTimer() {
  clearInterval(_otpTimer);
  _timerSecs = 300;
  updateTimerDisplay();
  _otpTimer = setInterval(() => {
    _timerSecs--;
    updateTimerDisplay();
    if (_timerSecs === 240) document.getElementById("resendBtn").disabled = false;
    if (_timerSecs <= 0) {
      clearInterval(_otpTimer);
      showOtpMsg("OTP expired. Click Resend OTP to get a new one.", "error");
      document.getElementById("resendBtn").disabled = false;
    }
  }, 1000);
}

function updateTimerDisplay() {
  const m = String(Math.floor(_timerSecs / 60)).padStart(2, "0");
  const s = String(_timerSecs % 60).padStart(2, "0");
  document.getElementById("timerDisplay").textContent = `${m}:${s}`;
}

/* ── Verify OTP ─────────────────────────────────────────────── */
async function verifyOtp() {
  const otp = [...document.querySelectorAll(".otp-digit")].map(b => b.value).join("");
  if (otp.length !== 6) { showOtpMsg("Please enter the complete 6-digit OTP.", "error"); return; }

  const btn = document.getElementById("verifyBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying…';

  try {
    const res  = await fetch("/api/signup/verify-otp", {
      method:      "POST",
      headers:     { "Content-Type": "application/json" },
      credentials: "include",
      body:        JSON.stringify({ email: window._signupEmail, otp }),
    });
    const data = await res.json();

    if (data.success) {
      clearInterval(_otpTimer);
      showOtpMsg("✅ Email verified! Account created.", "success");
      localStorage.removeItem("signupFormData");
      setTimeout(() => {
        closeOtpModal();
        Swal.fire({
          icon: "success",
          title: "Signup Complete ✅",
          text: "Your account has been created and verified! Welcome to AgroHub 🌾",
          confirmButtonColor: "#2e7d32",
        }).then(() => { window.location.href = "/login"; });
      }, 800);
    } else {
      showOtpMsg(data.error || "Incorrect OTP. Please try again.", "error");
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Verify & Complete Signup';
    }
  } catch {
    showOtpMsg("Network error. Please try again.", "error");
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Verify & Complete Signup';
  }
}

/* ── Resend OTP ─────────────────────────────────────────────── */
async function resendOtp() {
  const btn = document.getElementById("resendBtn");
  btn.disabled = true;
  showOtpMsg("Sending new OTP…", "");

  try {
    const res  = await fetch("/api/signup/resend-otp", {
      method:      "POST",
      headers:     { "Content-Type": "application/json" },
      credentials: "include",
      body:        JSON.stringify({ email: window._signupEmail }),
    });
    const data = await res.json();

    if (data.success) {
      showOtpMsg("✅ New OTP sent!", "success");
      document.querySelectorAll(".otp-digit").forEach(b => { b.value = ""; b.classList.remove("filled"); });
      document.getElementById("d0").focus();
      startTimer();
      setTimeout(() => { btn.disabled = false; }, 60000);
    } else {
      showOtpMsg(data.error || "Could not resend OTP.", "error");
      btn.disabled = false;
    }
  } catch {
    showOtpMsg("Network error. Could not resend.", "error");
    btn.disabled = false;
  }
}

function showOtpMsg(text, type) {
  const el = document.getElementById("otpMsg");
  el.className = "otp-msg" + (type ? " " + type : "");
  el.textContent = text;
  el.style.display = text ? "block" : "none";
}
