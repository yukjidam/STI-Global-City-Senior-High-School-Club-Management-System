/**
 * Requests page — base behaviors + API loading using project-root (/capstone/)
 * Expects PHP endpoints at: /<project>/api/requests/list.php and update_status.php
 */

document.addEventListener("DOMContentLoaded", async () => {
  await Auth.requireAuth({ roles: ["adviser"] });
});

document.addEventListener('DOMContentLoaded', () => {
  /* ========== Sidebar toggle ========== */
  document.querySelector('.sidebar-toggle-btn')?.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-expanded');
  });

  /* ========== Logout modal ========== */
  const logoutLink = document.querySelector('.logout-link');
  const overlay    = document.getElementById('logoutConfirmOverlay');
  if (logoutLink && overlay){
    const btnNo  = overlay.querySelector('.btn-no');
    const btnYes = overlay.querySelector('.btn-yes');
    logoutLink.addEventListener('click', (e) => { e.preventDefault(); overlay.classList.add('active'); });
    btnNo?.addEventListener('click', () => overlay.classList.remove('active'));
    btnYes?.addEventListener('click', () => { window.location.href = 'index.html'; });
  }

  /* ========== DOM refs ========== */
  const tbody  = document.getElementById('apps-tbody');
  const tabs   = Array.from(document.querySelectorAll('.app-tab'));
  const sInput = document.getElementById('app-search');
  const sBtn   = document.getElementById('app-search-btn');

  /* ========== Project root -> API URLs (works anywhere inside /capstone/) ========== */
  function getProjectRoot() {
    const segs = window.location.pathname.split('/').filter(Boolean);
    return segs.length ? `/${segs[0]}/` : '/';
  }
  const PROJECT_ROOT    = getProjectRoot(); // e.g. "/capstone/"
  const LIST_URL        = PROJECT_ROOT + 'api/requests/list.php';
  const UPDATE_URL      = PROJECT_ROOT + 'api/requests/update_status.php';
  // Uncomment to verify the exact paths being called:
  // console.log('[Requests] LIST_URL   =', LIST_URL);
  // console.log('[Requests] UPDATE_URL =', UPDATE_URL);

  /* ========== Original client-side search/filter (fallback if needed) ========== */
  function filterTable(filter){
    const rows = Array.from(document.querySelectorAll('#apps-tbody tr'));
    rows.forEach(tr => {
      const st = tr.getAttribute('data-status') || '';
      tr.style.display = (filter === 'all' || st === filter) ? '' : 'none';
    });
  }
  function clientSearch(){
    const q = (sInput?.value || '').trim().toLowerCase();
    const rows = Array.from(document.querySelectorAll('#apps-tbody tr'));
    rows.forEach(tr => {
      const name = tr.children[0]?.textContent.toLowerCase() || '';
      const snum = tr.children[1]?.textContent.toLowerCase() || '';
      tr.style.display = (!q || name.includes(q) || snum.includes(q)) ? '' : 'none';
    });
  }

  /* ========== Fetch helpers ========== */
  async function getJSON(url) {
    const res  = await fetch(url, { headers: { 'Accept':'application/json' }, cache: 'no-store' });
    const text = await res.text();
    let data; try { data = JSON.parse(text); }
    catch { throw new Error(`Bad JSON from ${url}: ${text.slice(0,180)}`); }
    if (!res.ok || data.ok !== true) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }
  async function postJSON(url, body) {
    const res  = await fetch(url, {
      method: 'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let data; try { data = JSON.parse(text); }
    catch { throw new Error(`Bad JSON from ${url}: ${text.slice(0,180)}`); }
    if (!res.ok || data.ok !== true) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  /* ========== Live table render ========== */
  let FILTER = 'Pending';
  let Q = '';
  let ALL = [];

  const fmtDate = s => {
    const d = new Date((s || '').replace(' ', 'T'));
    return isNaN(d) ? (s || '') :
      d.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});
  };
  const pill = (status) => {
    const cls = status==='Approved' ? 'status-approved'
              : (status==='Rejected' || status==='Revoked') ? 'status-rejected'
              : 'status-pending';
    return `<span class="status ${cls}">${status}</span>`;
  };
  const row = (it) => {
  const full = [it.first_name, it.middle_name, it.last_name].filter(Boolean).join(' ');

  const approveBtn = `<button class="action action-approve" data-id="${it.id}">Approve</button>`;
  const rejectBtn  = `<button class="action action-reject"  data-id="${it.id}">Reject</button>`;
  const revokeBtn  = `<button class="action action-revoke"  data-id="${it.id}">Revoke</button>`;

  let actions = '';
  switch (it.status) {
    case 'Pending':
      actions = `${approveBtn} ${rejectBtn}`;
      break;
    case 'Approved':
      actions = `${revokeBtn}`;
      break;
    case 'Revoked':
      // 🔧 bring back Reject alongside Approve
      actions = `${approveBtn} ${rejectBtn}`;
      break;
    case 'Rejected':
    default:
      actions = `${approveBtn}`;
      break;
  }

  return `<tr data-id="${it.id}" data-status="${it.status}">
    <td>${full}</td>
    <td>${it.student_id}</td>
    <td>${it.club_name}</td>
    <td>${it.strand || '—'}</td>
    <td>${fmtDate(it.created_at)}</td>
    <td>${pill(it.status)}</td>
    <td>${actions}</td>
  </tr>`;
};

  const renderCounts = (counts = {}) => {
    const map = {
      all      : (counts.All ?? 0),
      Pending  : (counts.Pending ?? 0),
      Approved : (counts.Approved ?? 0),
      Rejected : (counts.Rejected ?? 0) + (counts.Revoked ?? 0),
      Revoked  : (counts.Revoked  ?? 0)
    };
    tabs.forEach(btn => {
      const key  = btn.getAttribute('data-filter') || 'all';
      const base = btn.dataset.base || (btn.dataset.base = btn.textContent.replace(/\s*\(\d+\)\s*$/, ''));
      btn.textContent = `${base} (${map[key] ?? 0})`;
    });
  };

  async function load(filter = FILTER, q = Q){
    FILTER = filter; Q = q;
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:16px;">Loading…</td></tr>`;

    const qs  = `filter=${encodeURIComponent(filter)}&q=${encodeURIComponent(q)}`;
    const url = `${LIST_URL}?${qs}`;
    try {
      const out = await getJSON(url);
      ALL = out.items || [];
      tbody.innerHTML = ALL.length
        ? ALL.map(row).join('')
        : `<tr><td colspan="7" style="text-align:center;padding:16px;">No results</td></tr>`;
      renderCounts(out.counts || {});
    } catch (err) {
      console.error('[Requests] load failed:', err);
      const msg = (err && err.message) ? err.message : 'API unreachable';
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:16px;color:#6b7280;">
        No data ( ${msg} ).</td></tr>`;
      // If you pre-render static rows in HTML, you could fallback to:
      // filterTable(FILTER); clientSearch();
    }
  }

  /* ========== Actions (Approve / Reject / Revoke) ========== */
  tbody?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.action');
    if (!btn) return;
    const id = +btn.getAttribute('data-id');
    const action =
      btn.classList.contains('action-approve') ? 'approve' :
      btn.classList.contains('action-reject')  ? 'reject'  :
      btn.classList.contains('action-revoke')  ? 'revoke'  : '';
    if (!id || !action) return;

    btn.disabled = true;
    try {
      await postJSON(UPDATE_URL, { id, action });
      await load(FILTER, Q);
    } catch (err) {
      console.error('[Requests] update failed:', err);
      alert((err && err.message) || 'Update failed');
    } finally {
      btn.disabled = false;
    }
  });

  /* ========== Tabs & Search ========== */
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const f = tab.getAttribute('data-filter') || 'all';
      load(f, (sInput?.value || '').trim());
    });
  });
  function runSearch(){ load(FILTER, (sInput?.value || '').trim()); }
  sBtn?.addEventListener('click', runSearch);
  sInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });

  /* ========== Initial load ========== */
 // Find this at the bottom:
// load('all', '');

// Replace with this:
const pendingTab = tabs.find(t =>
  (t.getAttribute('data-filter') || '').toLowerCase() === 'pending' ||
  /pending/i.test(t.textContent || '')
);
if (pendingTab) {
  tabs.forEach(t => t.classList.remove('active'));
  pendingTab.classList.add('active');
}
load('Pending', '');

});

// inside your Request.js
const row = (it) => {
  const full = [it.first_name, it.middle_name, it.last_name].filter(Boolean).join(' ');
  const memberId = it.member_club_id !== null && it.member_club_id !== undefined ? Number(it.member_club_id) : null;
  const sameClub = memberId && memberId === Number(it.club_id);
  const memberName = it.member_club_name || '';

  let approveBtn = '';
  if (it.status === 'Pending') {
    if (memberId !== null) {
      const label = sameClub ? 'Already a member' : `Already in ${memberName}`;
      approveBtn = `<button class="action action-approve" data-id="${it.id}" disabled title="Student already belongs to a club">${label}</button>`;
    } else {
      approveBtn = `<button class="action action-approve" data-id="${it.id}">Approve</button>`;
    }
  }

  const rejectBtn =
    it.status === 'Pending'
      ? `<button class="action action-reject" data-id="${it.id}">Reject</button>`
      : it.status === 'Approved'
        ? `<button class="action action-revoke" data-id="${it.id}">Revoke</button>`
        : `<button class="action action-approve" data-id="${it.id}">Approve</button>`;

  const actions = it.status === 'Pending' ? `${approveBtn} ${rejectBtn}` : rejectBtn;

  return `<tr data-id="${it.id}" data-status="${it.status}">
    <td>${full}</td>
    <td>${it.student_id}</td>
    <td>${it.club_name}</td>
    <td>${it.strand || '—'}</td>
    <td>${fmtDate(it.created_at)}</td>
    <td>${pill(it.status)}</td>
    <td>${actions}</td>
  </tr>`;
};

// After successful list load:
document.dispatchEvent(new CustomEvent('requests:loaded', { detail: { counts: data.counts } }));
document.dispatchEvent(new CustomEvent('requests:counts', { detail: { pending: Number(data.counts?.Pending || 0) } }));


// === SETTINGS: Save bridge (Requests) — shell-compatible, reload on success ===
(() => {
  if (window.__settings_save_bridge_requests__) return;
  window.__settings_save_bridge_requests__ = true;

  const toApi = (p) => ('api/' + String(p).replace(/^\/?api\//,'').replace(/^\/+/,'')).replace(/\/{2,}/g,'/');

  const overlayNode = () =>
    document.getElementById('settingsModalOverlay') ||
    document.getElementById('settingsOverlay') ||
    document.getElementById('settingsModal') ||
    document.querySelector('.settings-modal__overlay, .settings-modal');

  function currentSlotForm() {
    const ov = overlayNode(); if (!ov) return null;
    const slot = ov.querySelector('.slot.open') || ov.querySelector('.slot');
    return (slot && slot.querySelector('form')) || ov.querySelector('form') || null;
  }

  function inferFieldKey(form) {
    if (!form) return '';
    const key = (form.getAttribute('data-field') || '').trim();
    if (key) return key;
    const has = (n) => !!form.querySelector(`[name="${n}"], #${n}`);
    if (has('first_name') || has('last_name')) return 'name';
    if (has('sti_email') || has('email')) return 'email';
    if (has('password') || has('new_password') || has('current_password')) return 'password';
    if (has('nickname')) return 'nickname';
    if (has('bio')) return 'bio';
    if (has('birthdate') || has('dob')) return 'birthdate';
    if (has('about_city') || has('city') || has('town')) return 'about_city';
    if (has('contact_email')) return 'contact_email';
    return '';
  }

  const FIELD_MAP = {
    name:          'api/settings/update_account.php',
    email:         'api/settings/update_account.php',
    password:      'api/settings/update_account.php',
    nickname:      'api/settings/update_profile.php',
    bio:           'api/settings/update_profile.php',
    birthdate:     'api/settings/update_profile.php',
    about_city:    'api/settings/update_profile.php',
    contact_email: 'api/settings/update_profile.php',
  };

  const confirmOverlay = document.getElementById('confirmModal');
  const confirmMsg     = document.getElementById('confirmMsg');
  const btnYes         = document.getElementById('btnConfirmYes');
  const btnNo          = document.getElementById('btnConfirmNo');

  function showConfirm(msg = 'Apply these changes?') {
    return new Promise((resolve) => {
      if (!confirmOverlay || !btnYes || !btnNo) return resolve(window.confirm(msg));
      if (confirmMsg) confirmMsg.textContent = msg;
      confirmOverlay.classList.add('open');
      confirmOverlay.removeAttribute('aria-hidden');
      const onNo  = () => done(false);
      const onYes = () => done(true);
      const onBack = (e) => { if (e.target === confirmOverlay) onNo(); };
      function done(v){
        confirmOverlay.classList.remove('open');
        confirmOverlay.setAttribute('aria-hidden','true');
        btnYes.removeEventListener('click', onYes);
        btnNo.removeEventListener('click', onNo);
        confirmOverlay.removeEventListener('click', onBack);
        resolve(v);
      }
      btnYes.addEventListener('click', onYes, { once:true });
      btnNo.addEventListener('click', onNo, { once:true });
      confirmOverlay.addEventListener('click', onBack, { once:true });
    });
  }

  document.addEventListener('click', async (e) => {
    const ov = overlayNode(); if (!ov) return;
    if (e.target.closest('#confirmModal')) return;

    const btn = e.target.closest(`
      button[type="submit"],
      .btn-primary,
      .slot-actions button,
      .slot-actions a,
      [data-action="save"],
      .save, .save-changes,
      a.btn, button.btn
    `);
    if (!btn || !ov.contains(btn)) return;

    const label = (btn.getAttribute('aria-label') || btn.textContent || '').trim().toLowerCase();
    const isSubmit = btn.tagName === 'BUTTON' && (btn.type || '').toLowerCase() === 'submit';
    if (!isSubmit && !label.includes('save')) return;

    const form = currentSlotForm(); if (!form) return;
    e.preventDefault(); e.stopPropagation();

    const field = inferFieldKey(form);
    const endpoint = FIELD_MAP[field];
    if (!endpoint) { alert('Unknown settings form.'); return; }

    if (!(await showConfirm('Save these changes?'))) return;

    const submitBtn = form.querySelector('.btn-primary, button[type="submit"]');
    const prev = submitBtn && submitBtn.textContent;
    if (submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

    try {
      const fd = new FormData(form);
      const body = {}; fd.forEach((v,k) => body[k] = v);

      const res = await fetch(toApi(endpoint), {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Accept':'application/json' },
        body: JSON.stringify(body),
        credentials: 'include'
      });
      const text = await res.text();
      let j; try { j = JSON.parse(text); } catch { j = {}; }
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `Save failed (${res.status})`);

      // Close modal and hard-reload so everything reflects DB values
      ov.classList.remove('active');
      setTimeout(() => window.location.reload(), 350);

      // Optional hook for other scripts
      document.dispatchEvent(new CustomEvent('settings:afterSave'));
    } catch (err) {
      console.error(err);
      alert(err?.message || 'Error saving changes.');
    } finally {
      if (submitBtn){ submitBtn.disabled = false; submitBtn.textContent = prev || 'Save changes'; }
    }
  });
})();


