

// ===================================
// Global State
// ===================================
let selectedRole = 'farmer';
let passwordVisible = false;
let isSubmitting = false;

// ===================================
// API Configuration
// ===================================
const API_BASE = '/api';

// ===================================
// Role Selection
// ===================================
function selectRole(role, element) {
  selectedRole = role;

  document.querySelectorAll('.role-tab').forEach(btn => {
    btn.classList.remove('active');
  });

  element.classList.add('active');
  trackEvent('role_selected', { role });
}

// ===================================
// Password Toggle
// ===================================
function togglePassword() {
  const passwordInput = document.getElementById('password');
  const eyeIcon = document.querySelector('.eye-icon');

  passwordVisible = !passwordVisible;
  passwordInput.type = passwordVisible ? 'text' : 'password';
  eyeIcon.textContent = passwordVisible ? '👁️‍🗨️' : '👁️';
}

// ===================================
// Validation
// ===================================
function isValidEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

function isValidPhone(phone) {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  const phoneRegex = /^(?:\+91|91|0)?[6-9]\d{9}$/;
  return phoneRegex.test(cleaned);
}

function isValidPassword(password) {
  return password.length >= 6;
}

function validateInput(input) {
  const wrapper = input.closest('.input-wrapper');
  const formGroup = input.closest('.form-group');
  const errorElement = formGroup.querySelector('.input-error');
  const value = input.value.trim();

  let isValid = true;
  let errorMessage = '';

  if (input.id === 'loginId') {
    if (!value) {
      isValid = false;
      errorMessage = 'Email or phone number is required';
    } else if (!isValidEmail(value) && !isValidPhone(value)) {
      isValid = false;
      errorMessage = 'Enter valid email or Indian phone number';
    }
  }

  if (input.id === 'password') {
    if (!value) {
      isValid = false;
      errorMessage = 'Password is required';
    } else if (!isValidPassword(value)) {
      isValid = false;
      errorMessage = 'Password must be at least 6 characters';
    }
  }

  if (isValid) {
    wrapper.classList.remove('error');
    wrapper.classList.add('success');
    errorElement.textContent = '';
  } else {
    wrapper.classList.remove('success');
    wrapper.classList.add('error');
    errorElement.textContent = errorMessage;
  }

  return isValid;
}

// ===================================
// REAL API LOGIN
// ===================================
async function handleLogin(event) {
  event.preventDefault();

  if (isSubmitting) return;
  isSubmitting = true;

  const loginIdInput = document.getElementById('loginId');
  const passwordInput = document.getElementById('password');

  const isLoginValid = validateInput(loginIdInput);
  const isPasswordValid = validateInput(passwordInput);

  if (!isLoginValid || !isPasswordValid) {
    showToast('Please fix the errors', 'error');
    isSubmitting = false;
    return;
  }

  const submitBtn = event.target.querySelector('.submit-btn');
  submitBtn.disabled = true;
  submitBtn.querySelector('.btn-text').textContent = 'Signing in...';

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        login_id: loginIdInput.value.trim(),
        password: passwordInput.value,
        role: selectedRole
      })
    });

    const result = await response.json();

    if (response.ok) {
      showToast(result.message, 'success');
      trackEvent('login_success', { role: selectedRole });

      setTimeout(() => {
        window.location.href = result.dashboard_url;
      }, 1500);
    } else {
      showToast(result.error || 'Login failed', 'error');
      submitBtn.disabled = false;
      submitBtn.querySelector('.btn-text').textContent = 'Sign In';
      isSubmitting = false;
    }

  } catch (error) {
    showToast('Login service unavailable', 'error');
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').textContent = 'Sign In';
    isSubmitting = false;
  }
}

// ===================================
// Toast Notifications
// ===================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  toast.innerHTML = `
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// ===================================
// Analytics
// ===================================
function trackEvent(eventName, data) {
  console.log('Event:', eventName, data);
}

// ===================================
// DOM Ready
// ===================================
document.addEventListener('DOMContentLoaded', () => {

  // Attach login handler
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.onsubmit = handleLogin;
  }

  // Real-time validation
  document.querySelectorAll('.form-input').forEach(input => {
    input.addEventListener('blur', () => {
      if (input.value.trim()) validateInput(input);
    });

    input.addEventListener('input', () => {
      const wrapper = input.closest('.input-wrapper');
      wrapper.classList.remove('error');
    });
  });

  // Accessibility
  const submitBtn = document.querySelector('.submit-btn');
  if (submitBtn) {
    submitBtn.setAttribute('aria-label', 'Sign in to AgriConnect');
  }
});

// ===================================
// Error Handling
// ===================================
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});

// ===================================
// Console Branding
// ===================================
console.log('%cAgriConnect 🌾', 'color: #2d6a4f; font-size: 22px; font-weight: bold;');
console.log('%cBackend Connected Version', 'color: #40916c; font-size: 13px;');
