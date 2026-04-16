'use strict';

// ==== Auto-detect "/capstone" (or whatever your folder is) and build API base ====
const PROJECT_BASE = '/' + location.pathname.split('/').filter(Boolean)[0]; // e.g. "/capstone"
const API_BASE = PROJECT_BASE + '/api';                                      // e.g. "/capstone/api"

// Shortcuts
const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));

// Smooth container height animation when swapping panels
function animatePanelSwap(container, nextEl) {
  if (!container || !nextEl) return;
  const start = container.offsetHeight;
  const wasActive = nextEl.classList.contains('active');
  if (!wasActive) nextEl.classList.add('active');
  const end = nextEl.offsetHeight;
  if (!wasActive) nextEl.classList.remove('active');
  container.style.height = start + 'px';
  container.style.transition = 'height .28s ease';
  requestAnimationFrame(() => { container.style.height = end + 'px'; });
  const done = () => {
    container.style.height = '';
    container.style.transition = '';
    container.removeEventListener('transitionend', done);
  };
  container.addEventListener('transitionend', done);
}

// ****************************************************************************
// GLOBAL STATE / HELPERS
// ****************************************************************************
let pendingRole = 'student';  // student or admin

function showLoginForm() {
  const el = document.getElementById('loginPopup');
  if (el) el.style.display = 'flex';
}
function hideModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.style.display = 'none';
}
// Unified login (Admin / Adviser / Student) — add ?debug=1 during debug
const loginUnified = (sti_email, password) =>
  api('/auth/login.php?debug=1', { method:'POST', body:{ sti_email, password } });


// Robust API helper (clearer errors)
async function api(path, {method='GET', body} = {}) {
  const url = `${API_BASE}${path}`;
  let res, text;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    text = await res.text();
  } catch (e) {
    console.error('Network error to', url, e);
    throw new Error('Failed to reach server. Is Apache running? Is the URL correct?');
  }
  let data;
  try { data = JSON.parse(text); }
  catch {
    console.error('Non-JSON from server:', text);
    throw new Error('Server did not return JSON (see DevTools → Network).');
  }
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.data ?? true;
}

const registerStudent = (payload) => api('/student/register.php', { method:'POST', body: payload });
const loginStudent    = (sti_email, password) => api('/student/login.php', { method:'POST', body: { sti_email, password } });
const loginAdviser    = (sti_email, password) => api('/adviser/login.php', { method:'POST', body: { sti_email, password } });

// Email helpers
function getRegEmail() {
  const f = document.getElementById('studentRegisterForm');
  if (!f) return '';
  const val = (new FormData(f).get('sti_email') || '').toString().trim();
  return val;
}
function isValidSTI(email) {
  return typeof email === 'string' && email.toLowerCase().endsWith('@globalcity.sti.edu.ph');
}

// ****************************************************************************
// MAIN
// ****************************************************************************
document.addEventListener('DOMContentLoaded', () => {
  // ===== Overlays/backdrop close (also return to login when Forgot is closed) =====
 window.addEventListener('click', (e) => {
  ['loginPopup','emailModal','codeModal','successModal','forgotModal'].forEach((id) => {
    const overlay = document.getElementById(id);
    if (overlay && e.target === overlay) {
      overlay.style.display = 'none';
      // Return to login when the Forgot modal is closed
      if (id === 'forgotModal') showLoginForm();
    }
  });
});

  // Esc key closes topmost open overlay (and returns to login if Forgot)
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = ['forgotModal','successModal','codeModal','emailModal','loginPopup']
      .map(id => document.getElementById(id))
      .find(el => el && getComputedStyle(el).display !== 'none');
    if (open) {
      open.style.display = 'none';
      if (open.id === 'forgotModal') showLoginForm();
    }
  });

  // ===== Password eye toggles (robust) =====
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button.toggle-pw');
    if (!btn) return;
    e.preventDefault();
    const input = btn.closest('.password-wrapper')?.querySelector('input');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password');
  });

  // ========================= STUDENT REGISTER (DB + email checks) =========================
  const studentRegisterForm = document.getElementById('studentRegisterForm');
  const createBtn = qs('#student-register .btn-login');
  const emailInput = document.getElementById('emailInput');
  const verifyEmailSpan = qs('.verify-email');

  if (studentRegisterForm && createBtn) {
    createBtn.addEventListener('click', () => {
      if (studentRegisterForm.checkValidity()) {
        studentRegisterForm.requestSubmit ? studentRegisterForm.requestSubmit() : studentRegisterForm.submit();
      }
    });

    studentRegisterForm.addEventListener('submit', e => {
      e.preventDefault();
      if (!studentRegisterForm.checkValidity()) {
        studentRegisterForm.reportValidity();
        return;
      }
      pendingRole = 'student';

      const regEmail = getRegEmail();
      if (emailInput) emailInput.value = regEmail;

      hideModal('loginPopup');
      const emailModal = document.getElementById('emailModal');
      if (emailModal) emailModal.style.display = 'flex';
    });

    const sendCodeBtn = document.getElementById('sendCodeBtn');
    if (sendCodeBtn) sendCodeBtn.addEventListener('click', e => {
      e.preventDefault();
      const regEmail = getRegEmail();
      const otpEmail = (emailInput?.value || '').trim();
      if (!otpEmail) { alert('Please enter your STI email.'); return; }
      if (!isValidSTI(otpEmail)) { alert('Email must use @globalcity.sti.edu.ph'); return; }
      if (otpEmail.toLowerCase() !== regEmail.toLowerCase()) {
        alert('The email in the OTP step must match the email in your registration form.');
        return;
      }
      if (verifyEmailSpan) verifyEmailSpan.textContent = otpEmail;
      hideModal('emailModal');
      const codeModal = document.getElementById('codeModal');
      if (codeModal) codeModal.style.display = 'flex';
    });

    const verifyBtn = document.getElementById('verifySubmit');
    if (verifyBtn) verifyBtn.addEventListener('click', async e => {
      e.preventDefault();
      const code = (document.getElementById('codeInput')?.value || '').trim();
      if (code.length < 4) { alert('Please enter the code (demo)'); return; }

      const f = new FormData(studentRegisterForm);
      const password = f.get('password');
      const confirm  = f.get('confirm_password');
      if (password !== confirm) { alert('Passwords do not match.'); return; }

      const payload = {
        first_name:  (f.get('first_name') || '').toString().trim(),
        middle_name: (f.get('middle_name')||'').toString().trim(),
        last_name:   (f.get('last_name')   || '').toString().trim(),
        student_id:  (f.get('student_id')  || '').toString().trim(),
        sti_email:   (f.get('sti_email')   || '').toString().trim(),
        password:    (password || '').toString(),
        club: ''
      };

      try {
        await registerStudent(payload);
        hideModal('codeModal');
        const successModal = document.getElementById('successModal');
        if (successModal) successModal.style.display = 'flex';
      } catch (err) {
        console.error('Register failed:', err);
        alert(err.message);
      }
    });

    const proceedBtn = document.getElementById('proceedBtn');
    if (proceedBtn) proceedBtn.addEventListener('click', e => {
      e.preventDefault();
      hideModal('successModal');
      showLoginForm();
      qsa('.popup-tabs .tab').forEach(t => t.classList.remove('active'));
      const tabStudent = qs('.popup-tabs .tab[data-role="student"]');
      if (tabStudent) tabStudent.classList.add('active');
      qsa('.popup-subtabs .subtab').forEach(s => s.classList.remove('active'));
      const loginSub = qs('.popup-subtabs .subtab[data-view="login"]');
      if (loginSub) loginSub.classList.add('active');
      qsa('.views .view').forEach(v => v.classList.toggle('active', v.id === 'student-login'));
    });
  }

// ========================== SINGLE LOGIN (Admin/Adviser/Student) ==========================
const studentLoginForm = qs('#student-login form');
if (studentLoginForm) {
  studentLoginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = (document.getElementById('stu-email')?.value || '').trim();
    const pass  = (document.getElementById('stu-pass')?.value || '');
    try {
      const data = await loginUnified(email, pass);   // { role, name, redirect }
      if (data && data.redirect) {
        window.location.href = data.redirect;        // Admin.html | HomeNews.html | Student-HomeNews.html
      } else {
        // fallback by role
        const route = data.role === 'admin' ? 'Admin.html'
                    : data.role === 'adviser' ? 'HomeNews.html'
                    : 'Student-HomeNews.html';
        window.location.href = route;
      }
    } catch (err) {
      alert(err.message);
    }
  });
}


  // ========================== ADMIN (Adviser) LOGIN (DB) ===================
  const adviserLoginBtn  = qs('#admin-login .btn-login');
  const adviserLoginForm = document.getElementById('adviserLoginForm');

  if (adviserLoginBtn) {
    adviserLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      if (adviserLoginForm) {
        if (adviserLoginForm.requestSubmit) adviserLoginForm.requestSubmit();
        else adviserLoginForm.submit();
      }
    });
  }
  if (adviserLoginForm) {
    adviserLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

      const email = (document.getElementById('adm-email')?.value || '').trim();
      const pass  = (document.getElementById('adm-pass')?.value || '');

      try {
        await loginAdviser(email, pass);
        window.location.href = 'HomeNews.html';
      } catch (err) {
        console.error('[Adviser] login failed:', err);
        alert(err.message);
      }
    });
  }

  // ========================== FORGOT PASSWORD FLOW =========================
  const forgotOverlay = document.getElementById('forgotModal');
  const fpStep1 = document.getElementById('fpStep1');
  const fpStep2 = document.getElementById('fpStep2');
  const fpStep3 = document.getElementById('fpStep3');
  const fpSteps = qsa('#forgotModal .fp-step');

  // Open from "Forgot password?" → hide login, show forgot flow
  qsa('.forgot-link').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      hideModal('loginPopup'); // hide the login popup
      if (forgotOverlay) {
        forgotOverlay.style.display = 'flex';
        // reset to step 1
        fpStep1 && fpStep1.classList.remove('is-hidden');
        fpStep2 && fpStep2.classList.add('is-hidden');
        fpStep3 && fpStep3.classList.add('is-hidden');
        fpSteps.forEach((s,i)=> s.classList.toggle('is-active', i===0));
        document.getElementById('fpEmail')?.focus();
      }
    });
  });

  function fpShowStep(n){
    fpStep1 && fpStep1.classList.toggle('is-hidden', n!==1);
    fpStep2 && fpStep2.classList.toggle('is-hidden', n!==2);
    fpStep3 && fpStep3.classList.toggle('is-hidden', n!==3);
    fpSteps.forEach((s,i)=> s.classList.toggle('is-active', i===n-1));
  }

  // STEP 1 → send code (UI only; hook API later)
  fpStep1?.addEventListener('submit', (e)=>{
    e.preventDefault();
    const email = document.getElementById('fpEmail').value.trim();
    if (!isValidSTI(email)) { alert('Use your @globalcity.sti.edu.ph email'); return; }
    // TODO: await api('/auth/forgot_password.request.php', { method:'POST', body:{ email } })
    fpShowStep(2);
    document.getElementById('fpCode')?.focus();
  });

  // Back from step 2
  qs('.js-fp-back1')?.addEventListener('click', ()=> fpShowStep(1));

  // STEP 2 → verify (UI only; hook API later)
  fpStep2?.addEventListener('submit', (e)=>{
    e.preventDefault();
    const code = document.getElementById('fpCode').value.trim();
    if (code.length < 4) { alert('Enter the 6-digit code.'); return; }
    // TODO: await api('/auth/forgot_password.verify.php', { method:'POST', body:{ code } })
    fpShowStep(3);
    document.getElementById('fpPass')?.focus();
  });

  // Back from step 3
  qs('.js-fp-back2')?.addEventListener('click', ()=> fpShowStep(2));

  // STEP 3 → reset password (then return to login)
  fpStep3?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const p1 = document.getElementById('fpPass').value;
    const p2 = document.getElementById('fpPass2').value;
    if (p1.length < 8)  { alert('Password must be at least 8 characters.'); return; }
    if (p1 !== p2)      { alert('Passwords do not match.'); return; }
    // TODO: await api('/auth/forgot_password.reset.php', { method:'POST', body:{ password:p1 } })
    alert('Password reset successful. You can now log in.');
    if (forgotOverlay) forgotOverlay.style.display = 'none';
    showLoginForm(); // bring the login popup back
  });
});
