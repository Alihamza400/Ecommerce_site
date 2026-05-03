// ============================================================
// auth.js — Accurate & Optimized Decoupled API logic
// ============================================================
const BASE_URL = '/Ecommerce_site/Backend';

let csrfToken = null;

async function fetchCsrfToken() {
    try {
        const res = await fetch(`${BASE_URL}/csrf_token.php`, { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
            csrfToken = data.csrf_token;
        }
    } catch (err) {
        console.error("Failed to fetch CSRF token", err);
    }
}

function showAlert(boxId, msgId, text, type = 'error') {
  const box = document.getElementById(boxId);
  const msg = document.getElementById(msgId);
  if (!box || !msg) return;

  box.className = `alert alert-${type} show`;
  msg.textContent = text;
  clearTimeout(box._timer);
  box._timer = setTimeout(() => box.classList.remove('show'), 6000);
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
}

function setupPasswordToggle(toggleId, inputId, eyeId) {
  const btn   = document.getElementById(toggleId);
  const input = document.getElementById(inputId);
  const eye   = document.getElementById(eyeId);
  if (!btn || !input || !eye) return;

  btn.addEventListener('click', () => {
    const isHidden = input.type === 'password';
    input.type     = isHidden ? 'text' : 'password';
    eye.className  = isHidden ? 'ph ph-eye-slash' : 'ph ph-eye';
  });
}

const STRENGTH_LEVELS = [
  { label: 'Too short',  color: '#ef4444', width: '15%'  },
  { label: 'Weak',       color: '#f97316', width: '35%'  },
  { label: 'Fair',       color: '#f59e0b', width: '55%'  },
  { label: 'Good',       color: '#84cc16', width: '75%'  },
  { label: 'Strong 💪',  color: '#10b981', width: '100%' },
];

function getPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 4);
}

function setupStrengthMeter(inputId, meterId, fillId, labelId) {
  const input = document.getElementById(inputId);
  const meter = document.getElementById(meterId);
  const fill  = document.getElementById(fillId);
  const label = document.getElementById(labelId);
  if (!input || !meter || !fill || !label) return;

  input.addEventListener('input', () => {
    const val = input.value;
    if (!val) { meter.style.display = 'none'; return; }
    meter.style.display = 'block';
    const level = STRENGTH_LEVELS[getPasswordStrength(val)];
    fill.style.width      = level.width;
    fill.style.background = level.color;
    label.textContent     = level.label;
    label.style.color     = level.color;
  });
}

function initRegister() {
  const form = document.getElementById('register-form');
  if (!form) return;
  setupPasswordToggle('toggle-reg-pass', 'reg-password', 'eye-reg-pass');
  setupPasswordToggle('toggle-reg-confirm', 'reg-confirm', 'eye-reg-confirm');
  setupStrengthMeter('reg-password', 'strength-meter', 'strength-fill', 'strength-label');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name             = document.getElementById('reg-name').value.trim();
    const phone            = document.getElementById('reg-phone').value.trim();
    const email            = document.getElementById('reg-email').value.trim();
    const password         = document.getElementById('reg-password').value;
    const confirm_password = document.getElementById('reg-confirm').value;

    if (!name || !email) { showAlert('reg-alert', 'reg-alert-msg', 'Name and Email are required.'); return; }
    if (password.length < 8) { showAlert('reg-alert', 'reg-alert-msg', 'Password must be 8+ characters.'); return; }
    if (password !== confirm_password) { showAlert('reg-alert', 'reg-alert-msg', 'Passwords do not match.'); return; }
    const terms = document.getElementById('reg-terms');
    if (terms && !terms.checked) { showAlert('reg-alert', 'reg-alert-msg', 'Agree to the Terms.'); return; }

    setLoading('reg-submit', true);
    try {
      const fd = new FormData();
      fd.append('name', name); fd.append('phone', phone); fd.append('email', email);
      fd.append('password', password); fd.append('confirm_password', confirm_password);
      if (csrfToken) fd.append('csrf_token', csrfToken);

      const res = await fetch(`${BASE_URL}/registration.php`, { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        showAlert('reg-alert', 'reg-alert-msg', data.message + ' Redirecting...', 'success');
        setTimeout(() => { window.location.href = 'login.html'; }, 1500);
      } else {
        showAlert('reg-alert', 'reg-alert-msg', data.message);
      }
    } catch (err) {
      showAlert('reg-alert', 'reg-alert-msg', 'Network connection failed.');
    } finally { setLoading('reg-submit', false); }
  });
}

function initLogin() {
  const form = document.getElementById('login-form');
  if (!form) return;
  setupPasswordToggle('toggle-login-pass', 'login-password', 'eye-login-pass');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) { showAlert('login-alert', 'login-alert-msg', 'Please enter email and password.'); return; }

    setLoading('login-submit', true);
    try {
      const fd = new FormData();
      fd.append('email', email); fd.append('password', password);
      if (csrfToken) fd.append('csrf_token', csrfToken);

      const res = await fetch(`${BASE_URL}/login.php`, { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json();

      if (data.success) {
        showAlert('login-alert', 'login-alert-msg', data.message, 'success');
        setTimeout(() => { window.location.href = data.redirect || 'index.html'; }, 1000);
      } else {
        showAlert('login-alert', 'login-alert-msg', data.message);
      }
    } catch (err) {
      showAlert('login-alert', 'login-alert-msg', 'Network connection failed.');
    } finally { setLoading('login-submit', false); }
  });
}

document.addEventListener('DOMContentLoaded', async () => { 
    await fetchCsrfToken();
    initRegister(); 
    initLogin(); 
});
