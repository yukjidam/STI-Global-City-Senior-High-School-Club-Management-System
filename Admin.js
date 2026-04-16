
// Admin.js
document.addEventListener('DOMContentLoaded', async () => {
  await Auth.requireAuth({ roles: ['admin'] });

  // Safe closest for delegated events (avoids "Cannot read properties of null (reading 'closest')")
function closestFromEvent(e, selector) {
  const t = e && e.target;
  return (t instanceof Element) ? t.closest(selector) : null;
}


  // Bullet-proof logout binding
document.addEventListener('click', (e) => {
if (!(e.target instanceof Element)) return;
 const el = e.target.closest('#btn-logout, [data-action="logout"]');
   if (!el) return;
   e.preventDefault();
   e.stopImmediatePropagation();
   Auth.logoutAndGoToLogin();
}, true);
});
function timeAgo(isoish){
  try {
    const d = new Date(String(isoish).replace(' ','T'));
    const s = Math.floor((Date.now() - d.getTime())/1000);
    if (!isFinite(s) || s < 0) return '—';
    const m = Math.floor(s/60), h = Math.floor(m/60), dys = Math.floor(h/24);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (dys < 30) return `${dys}d ago`;
    const mo = Math.floor(dys/30);
    return `${mo}mo ago`;
  } catch { return '—'; }
}

/* ======================= Approvals (profile media) ======================= */

const apModal  = document.getElementById('modal-approvals');
const apSearch = document.getElementById('ap-search');
const apCount  = document.getElementById('ap-count');
const apWrap   = document.getElementById('ap-table-wrap');

let apAllRows = [];
// --- Approvals: multiselect state ---
let apSelMode = false;
let apCurrentRows = [];
const apSelected = new Set();

const apToggleMulti = document.getElementById('ap-toggle-multi');
const apBulkbar     = document.getElementById('ap-bulkbar');
const apSelAll      = document.getElementById('ap-select-all');
const apSelCount    = document.getElementById('ap-selected-count');
const btnBulkApprove = document.getElementById('ap-bulk-approve');
const btnBulkDecline = document.getElementById('ap-bulk-decline');
const apBulkActions  = document.getElementById('ap-bulk-actions');


function apSyncSelectedCount(){
  if (apSelCount) apSelCount.textContent = `${apSelected.size} selected`;
}
function apResetSelection(){
  apSelMode = false;
  apSelected.clear();
  if (apToggleMulti) {
    apToggleMulti.setAttribute('aria-pressed','false');
    apToggleMulti.textContent = 'Select multiple';
  }
  // Hide footer bulk actions
  apBulkActions?.setAttribute('hidden','');
  btnBulkApprove?.setAttribute('hidden','');
  btnBulkDecline?.setAttribute('hidden','');
}

function apAfterRender(){
  if (!apSelMode || !apWrap) return;
  const visibleIds = Array.from(apWrap.querySelectorAll('tbody tr')).map(tr => tr.dataset.id);
  const headCb = apWrap.querySelector('#ap-cb-all');
  if (headCb) headCb.checked = (visibleIds.length > 0 && visibleIds.every(id => apSelected.has(id)));
  for (const cb of apWrap.querySelectorAll('.ap-cb')) {
    cb.checked = apSelected.has(String(cb.dataset.id || ''));
  }
  apSyncSelectedCount();
}


function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function baseName(p){ try{ return String(p||'').split('/').pop() || p; }catch{ return p; } }

async function loadApprovals(kind='avatar'){
  if (!apWrap) return;
  try {
    const res   = await apiGet(`/api/profile/requests_list.php?type=${encodeURIComponent(kind)}&status=pending&limit=500`);
    const items = res?.items || res?.rows || res?.data || [];
    apAllRows = items.map(r => ({
      id: r.id ?? r.request_id ?? r.req_id,
      user: r.full_name || `${r.first_name||''} ${r.middle_name? r.middle_name+' ' : ''}${r.last_name||''}`.trim(),
      role: r.role || r.user_role || '',
      email: r.sti_email || r.email || '',
      type: r.type || r.media_type || kind,
      path: r.path || r.file_path || r.url || '',
      submitted_at: r.submitted_at || r.created_at || r.updated_at || ''
    }));
    renderApprovalsTable(apAllRows);
    apSearch && (apSearch.value = '');
    apCount && (apCount.textContent = `${apAllRows.length} request${apAllRows.length!==1?'s':''}`);
  } catch (err) {
    apWrap.innerHTML = `<div class="callout err">${escapeHtml(String(err.message||err))}</div>`;
  }
}

function renderApprovalsTable(rows){
  if (!apWrap) return;
  apCurrentRows = rows.slice();

  if (!rows.length){
    apWrap.innerHTML = '<div class="muted small" style="padding:12px 14px">No pending requests.</div>';
    return;
  }

  const head = apSelMode
    ? '<th class="sel"><input type="checkbox" id="ap-cb-all"></th><th>#</th><th>Requested by</th><th>Role</th><th>Email</th><th>Image</th><th>Submitted</th><th class="actions">Action</th>'
    : '<th>#</th><th>Requested by</th><th>Role</th><th>Email</th><th>Image</th><th>Submitted</th><th class="actions">Action</th>';

  const body = rows.map((r,i)=>`<tr data-id="${r.id}">
      ${apSelMode ? `<td class="sel"><input type="checkbox" class="ap-cb" data-id="${r.id}"></td>` : ''}
      <td>${i+1}</td>
      <td>${escapeHtml(r.user||'')}</td>
      <td>${escapeHtml(r.role||'')}</td>
      <td>${escapeHtml(r.email||'')}</td>
      <td><a class="view-link" href="#" data-img="${encodeURIComponent(r.path)}">${escapeHtml(baseName(r.path))}</a></td>
      <td>${timeAgo(r.submitted_at)}</td>
      <td class="actions">
        <button class="btn approve" data-act="approve" data-id="${r.id}">Approve</button>
        <button class="btn decline" data-act="decline" data-id="${r.id}">Decline</button>
      </td>
    </tr>`).join('');

  apWrap.innerHTML = `<table class="preview-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  apAfterRender();
}


async function reviewApproval(id, action){
  try {
    const kind = apModal?.dataset.kind || 'avatar';
    await apiPostJSON('/api/profile/review_media.php', { id, action, type: kind }); // expects {ok:true}
    const row = apWrap?.querySelector(`tr[data-id="${id}"]`);
    row?.remove();
    const left = apWrap?.querySelectorAll('tbody tr').length || 0;
    apCount && (apCount.textContent = `${left} request${left!==1?'s':''}`);
    if (!left) apWrap.innerHTML = '<div class="muted small" style="padding:12px 14px">No pending requests.</div>';
    Toasts?.ok(action === 'approve' ? 'Approved' : 'Declined');
  } catch (err) {
    Toasts?.err(String(err.message||err));
  }
}

// Delegated actions for Approvals modal (approve/decline + view)
document.addEventListener('click', (e) => {
  if (!(e.target instanceof Element)) return;

  const actBtn = e.target.closest('#modal-approvals [data-act]');
  if (actBtn){
    e.preventDefault();
    reviewApproval(String(actBtn.dataset.id||''), actBtn.dataset.act);
    return;
  }

  const imgLink = e.target.closest('#modal-approvals a.view-link');
  if (imgLink){
    e.preventDefault();
    const url = decodeURIComponent(imgLink.dataset.img||'');
    openImageViewer(url);
  }
});

apToggleMulti?.addEventListener('click', () => {
  apSelMode = !apSelMode;
  apToggleMulti.setAttribute('aria-pressed', String(apSelMode));
  apToggleMulti.textContent = apSelMode ? 'Done selecting' : 'Select multiple';

  // Footer bulk buttons only visible in multiselect
  if (apSelMode) {
    apBulkActions?.removeAttribute('hidden');
    btnBulkApprove?.removeAttribute('hidden');
    btnBulkDecline?.removeAttribute('hidden');
  } else {
    apSelected.clear();
    apBulkActions?.setAttribute('hidden', '');
    btnBulkApprove?.setAttribute('hidden', '');
    btnBulkDecline?.setAttribute('hidden', '');
  }

  renderApprovalsTable(apCurrentRows);
});

// Delegated: header Select-All and per-row checkboxes
document.addEventListener('click', (e) => {
  if (!(e.target instanceof Element)) return;

  const headCb = e.target.closest('#modal-approvals #ap-cb-all');
  if (headCb) {
    const to = headCb.checked;
    for (const tr of apWrap.querySelectorAll('tbody tr')) {
      const id = String(tr.dataset.id || '');
      if (!id) continue;
      if (to) apSelected.add(id); else apSelected.delete(id);
    }
    apAfterRender();
    return;
  }

  const rowCb = e.target.closest('#modal-approvals .ap-cb');
  if (rowCb) {
    const id = String(rowCb.dataset.id || '');
    if (rowCb.checked) apSelected.add(id); else apSelected.delete(id);
    apAfterRender();
  }
});

// Batch runner reusing the single-item endpoint
async function batchReviewSelected(action){
  if (!apSelected.size) { Toasts?.warn('No rows selected'); return; }
  const kind = apModal?.dataset.kind || 'avatar';
  const ids  = Array.from(apSelected);
  const btnA = document.getElementById('ap-bulk-approve');
  const btnD = document.getElementById('ap-bulk-decline');
  [btnA, btnD].forEach(b => b && (b.disabled = true));

  let ok=0, fail=0;
  for (const id of ids){
    try{
      await apiPostJSON('/api/profile/review_media.php', { id, action, type: kind });
      const row = apWrap.querySelector(`tr[data-id="${id}"]`);
      row?.remove();
      apSelected.delete(id);
      ok++;
    } catch { fail++; }
  }

  const left = apWrap.querySelectorAll('tbody tr').length || 0;
  if (apCount) apCount.textContent = `${left} request${left!==1?'s':''}`;
  if (!left) apWrap.innerHTML = '<div class="muted small" style="padding:12px 14px">No pending requests.</div>';

  [btnA, btnD].forEach(b => b && (b.disabled = false));
  apAfterRender();
  Toasts?.ok(`${action==='approve' ? 'Approved' : 'Declined'} ${ok}${fail?` • ${fail} failed`:''}`);
}

document.getElementById('ap-bulk-approve')?.addEventListener('click', () => batchReviewSelected('approve'));
document.getElementById('ap-bulk-decline')?.addEventListener('click', () => batchReviewSelected('decline'));


// Quick client-side search
apSearch?.addEventListener('input', (e) => {
  const q = String(e.target.value||'').trim().toLowerCase();
  const rows = !q ? apAllRows : apAllRows.filter(r => (
    [r.user,r.email,r.role,baseName(r.path)].join(' ').toLowerCase().includes(q)
  ));
  apCurrentRows = rows;
renderApprovalsTable(rows);
  apCount && (apCount.textContent = `${rows.length} request${rows.length!==1?'s':''}`);
});

/* Fullscreen image viewer */
const imgViewer = document.getElementById('img-viewer');
const imgVImg   = document.getElementById('img-viewer-img');
function openImageViewer(url){
  if (!imgViewer || !imgVImg) return;
  imgVImg.src = url;
  imgViewer.classList.add('show');
}
imgViewer?.addEventListener('click', (e) => {
  if (e.target === imgViewer || e.target.classList.contains('img-view-x')) {
    imgViewer.classList.remove('show');
    if (imgVImg) imgVImg.src = '';
  }
});




(() => {
  // GET with cache-buster so lists always refresh fresh
  window.apiGet ??= async function apiGet(url) {
    const bust = (url.includes('?') ? '&' : '?') + '_ts=' + Date.now();
    const res = await fetch(url + bust, {
      credentials: 'include',
      cache: 'no-store'
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j || j.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);
    return j;
  };

  // POST (FormData)
  window.apiPostForm ??= async function apiPostForm(url, formData) {
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    let j = null;
    try { j = await res.json(); } catch {}
    if (res.ok && !j) j = { ok: true };
    if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);
    return j;
  };

  // POST (JSON)
  window.apiPostJSON ??= async function apiPostJSON(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j || j.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);
    return j;
  };
})();

(function () {
  const origFetch = window.fetch;

  function rewriteUrl(uStr) {
    // 1) Normalize leading slash to relative
    let u = uStr.replace(/^\/api\/admin\//, 'api/')
                .replace(/^\/api\//, 'api/');

    // 2) Bulk upload mapping to your single endpoint:
    //    api/students/bulk_upload.php -> api/bulk/upload.php?kind=student
    //    api/advisers/bulk_upload.php -> api/bulk/upload.php?kind=adviser
    u = u.replace(/^api\/students\/bulk_upload\.php(\?[^#]*)?$/, (m, q='') => {
      const extra = q && q.startsWith('?') ? '&' + q.slice(1) : '';
      return `api/bulk/upload.php?kind=student${extra}`;
    });
    u = u.replace(/^api\/advisers\/bulk_upload\.php(\?[^#]*)?$/, (m, q='') => {
      const extra = q && q.startsWith('?') ? '&' + q.slice(1) : '';
      return `api/bulk/upload.php?kind=adviser${extra}`;
    });

    // 3) Admin Clubs list: use admin-specific endpoint with filters
    u = u.replace(/^api\/clubs\/list\.php(\b|$)/, 'api/clubs/list_admin.php');


    return u;
  }

  window.fetch = function (input, init) {
    try {
      if (typeof input === 'string') {
        return origFetch(rewriteUrl(input), init);
      } else if (input && input.url) {
        const req = new Request(rewriteUrl(input.url), input);
        return origFetch(req, init);
      }
    } catch (_) {}
    return origFetch(input, init);
  };
})();

function pkNameFor(kind) {
  return kind === 'student' ? 'student_id'
       : kind === 'adviser' ? 'adviser_id'
       : kind === 'admin'   ? 'admin_id'
       :                      'club_id';
}


// ======================= Toasts =======================
const Toasts = (() => {
  const root = document.getElementById('toastRegion') || (() => {
    const r = document.createElement('div'); r.id = 'toastRegion'; r.className = 'toasts';
    document.body.appendChild(r); return r;
  })();
  function push(msg, kind=''){
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; }, 2600);
    setTimeout(() => root.removeChild(el), 3200);
  }
  return { ok:(m)=>push(m,'ok'), warn:(m)=>push(m,'warn'), err:(m)=>push(m,'err'), msg:push };
})();

// Safe default so code that references DB_ADMINS won't explode
window.DB_ADMINS = window.DB_ADMINS || 'admins';


// ======================= Helpers =======================
function projectBase() {
  const cap = '/capstone';
  const p = location.pathname;
  const i = p.indexOf(cap);
  return i >= 0 ? p.slice(0, i + cap.length) : '';
}
function memberListUrls(clubId) {
  const qs = `club_id=${encodeURIComponent(clubId)}&limit=10000`;
  const PB = projectBase();
  return [
    `${PB}/api/clubs/members/list.php?${qs}`,   // preferred
    `/capstone/api/clubs/members/list.php?${qs}`,
    `./api/clubs/members/list.php?${qs}`,
    `../api/clubs/members/list.php?${qs}`,
    `/api/clubs/members/list.php?${qs}`,        // last resort
  ];
}


function setText(id,val){ const el=document.getElementById(id); if(el) el.textContent=String(val); }
function setDonut(id,pct){ const el=document.getElementById(id); if(el) el.style.setProperty('--p', pct); }
function setBar(id,val,max){ const el=document.getElementById(id); if(!el) return; const pct = Math.max(0, Math.min(100, Math.round((val||0)*100/(max||1)) )); el.style.setProperty('--w', pct); }


function formatLastLogin(v){
  if (!v) return '—';
  const d = new Date(String(v).replace(' ','T'));
  if (isNaN(+d)) return '—';

  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60)   return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60)   return `${mins} min${mins===1?'':'s'} ago`;
  const hrs  = Math.floor(mins / 60);
  if (hrs < 24)    return `${hrs} hr${hrs===1?'':'s'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)    return `${days} day${days===1?'':'s'} ago`;
  // older than a week → short absolute
  return d.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}


// Show last-name in a native tooltip on hover/focus
function setTooltip(el, text){
  if (!el) return;
  if (text) {
    el.setAttribute('title', text);
    el.setAttribute('aria-label', text);
  } else {
    el.removeAttribute('title');
    el.removeAttribute('aria-label');
  }
}
// last 6 numeric digits helper
function last6(s){ return String(s || '').replace(/\D/g,'').slice(-6); }

async function fetchMembersCount(clubId) {
  const PROJECT_BASE = (() => {
    const cap = '/capstone';
    const p = location.pathname;
    const i = p.indexOf(cap);
    return i >= 0 ? p.slice(0, i + cap.length) : '';
  })();

  const tries = [
    `/api/clubs/members/list.php?club_id=${encodeURIComponent(clubId)}&limit=10000`,
    `./api/clubs/members/list.php?club_id=${encodeURIComponent(clubId)}&limit=10000`,
    `${PROJECT_BASE}/api/clubs/members/list.php?club_id=${encodeURIComponent(clubId)}&limit=10000`,
  ];
  for (const url of tries) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) continue;
      const j = await res.json();
      if (j && j.items && Array.isArray(j.items)) return j.items.length;
    } catch (_) {}
  }
  return 0;
}

const NEW_LS_KEY = 'adm.clubNew30.v1';

function _lsGet(key){ try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } }
function _lsSet(key,val){ try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

/**
 * Record the current member count for a club and return sum of increases in last 30d.
 * - Seeds the baseline on first sight without counting as "new".
 * - Ignores decreases (only positive deltas count as new).
 * - Automatically drops deltas older than 30 days.
 */
function recordAndComputeNew30(clubId, currentCount) {
  const MS_30D = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const store = _lsGet(NEW_LS_KEY);
  let rec = store[clubId] || { last: null, events: [] };

  // keep only recent positive events
  rec.events = Array.isArray(rec.events) ? rec.events.filter(e => e && e.d > 0 && (now - e.t) <= MS_30D) : [];

  if (typeof rec.last !== 'number') {
    // first time we see this club → set baseline, don't count as "new"
    rec.last = Number(currentCount) || 0;
  } else {
    const delta = Number(currentCount) - rec.last;
    if (delta > 0) rec.events.push({ t: now, d: delta });
    rec.last = Number(currentCount);
  }

  store[clubId] = rec; _lsSet(NEW_LS_KEY, store);

  // total "new" in last 30 days
  return rec.events.reduce((sum, e) => sum + (e.d || 0), 0);
}




async function apiGet(url) {
  // cache-buster so the list endpoint never returns a cached response
  const bust = (url.includes('?') ? '&' : '?') + '_ts=' + Date.now();
  const res = await fetch(url + bust, {
    credentials: 'include',
    cache: 'no-store'
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j || j.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);
  return j;
}

async function apiPostJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include'
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j || j.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);
  return j;
}

function slugLower(s){ return String(s || '').replace(/\s+/g,'').toLowerCase(); }
function rand6(){ return String(Math.floor(100000 + Math.random()*900000)); }
function downloadCSV(filename, csvText){
  const url = URL.createObjectURL(new Blob([csvText], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
// quick CSV (good enough for our templates/preview)
function csvToRows(text){ return text.split(/\r?\n/).filter(Boolean).map(line => line.split(',')); }



// robust show/hide (beats CSS display:none)
const showEl = el => { if(!el) return; el.hidden = false; el.style.removeProperty('display'); };
const hideEl = el => { if(!el) return; el.hidden = true; el.style.display = 'none'; };

// Global icon definitions for password toggles - ADDED width and height attributes
const ICON_EYE = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="18" height="18"><path d="M2.25 12c2.4-4.2 6.44-7 9.75-7s7.35 2.8 9.75 7c-2.4 4.2-6.44 7-9.75 7s-7.35-2.8-9.75-7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>`;
const ICON_EYE_OFF = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="18" height="18"><path d="M2.25 12c2.4-4.2 6.44-7 9.75-7 2.47 0 4.86.93 6.93 2.6M21.75 12c-2.4 4.2-6.44 7-9.75 7-2.16 0-4.25-.72-6.1-2.03" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

// ========== Organizations helpers ==========
let _orgCache = null;

async function fetchOrganizations() {
  if (_orgCache) return _orgCache;
  const j = await apiGet('api/organizations/list.php?limit=200');
  const items = j?.items || j?.rows || j?.data || [];
  _orgCache = items
    .map(o => ({
      id: String(o.id ?? o.organization_id ?? ''),
      name: o.name ?? o.org_name ?? ''
    }))
    .filter(x => x.id && x.name);
  return _orgCache;
}

function invalidateOrgCache(){ _orgCache = null; }

async function populateOrgSelect(selectEl, selectedId){
  if (!selectEl) return;
  const opts = await fetchOrganizations().catch(() => []);
  selectEl.innerHTML =
    '<option value=\"\">— None —</option>' +
    opts.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
  if (selectedId) selectEl.value = String(selectedId);
}


// ======================= Modals open/close =======================

// === Organizations helpers ===
let ORG_CACHE = null;
async function fetchOrganizations(force=false){
  if (!force && Array.isArray(ORG_CACHE)) return ORG_CACHE;
  const j = await apiGet('api/organizations/list.php?status=active&limit=2000');
  ORG_CACHE = (j?.items || j?.rows || j?.data || []).map(o => ({
    id: String(o.id ?? o.organization_id ?? ''),
    name: String(o.name ?? o.org_name ?? '')
  })).filter(x => x.id && x.name);
  return ORG_CACHE;
}
async function populateOrgSelect(sel){
  if (!sel) return;
  const list = await fetchOrganizations().catch(()=>[]);
  const keep = sel.value || '';
  sel.innerHTML = '<option value="">— None —</option>' +
    list.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
  if (keep) sel.value = keep;
}

let bulkType = null; // 'student' | 'adviser'
let pendingArchive = null; // { action, type, idKey, idVal, fullName }
const bulkModal     = document.getElementById('modal-bulk-upload');
const bulkForm      = document.getElementById('form-bulk-upload');
const bulkEl        = document.getElementById('bulk-file');
const bulkMeta      = document.getElementById('bulk-meta');
const bulkWrap      = document.getElementById('bulk-preview');     // contains meta + tools + table wrap
const bulkTools     = document.getElementById('bulk-tools');       // bar that holds template/search/count
const bulkTableWrap = document.getElementById('bulk-table-wrap');
const bulkValidate  = document.getElementById('bulk-validate');
const bulkSearch    = document.getElementById('bulk-search');
const bulkCount     = document.getElementById('bulk-count');
const bulkSubmitBtn = bulkForm?.querySelector('button[type="submit"]');
const helperEl      = document.getElementById('bulk-helper');
const btnTplStudent = document.getElementById('dl-student-template');
const btnTplAdviser = document.getElementById('dl-adviser-template');
const confirmArchModal = document.getElementById('modal-archive-confirm');
const archMsg           = document.getElementById('arch-msg');
const btnArchConfirm    = document.getElementById('confirm-archive');


const VALID_ID_RE = /^2000\d{6}$/;
const LEGACY_STUDENT_ID_RE = /^\d{2}-\d{4}-\d{4}$/;

let bulkHead = [];     // header array
let bulkAllRows = [];  // all body rows (arrays)
let isCSV = false;



// small utilities
const currentTplBtn = () => (bulkType === 'adviser' ? btnTplAdviser : btnTplStudent);
// Helper: POST form-url-encoded
async function postForm(url, dataObj) {
  const body = new URLSearchParams(dataObj);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body
  });
  let json;
  try { json = await res.json(); } catch { json = { ok: false, error: 'Invalid server response' }; }
  if (!res.ok || !json.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}


// ---------- NEW: make long-table toggle globally accessible ----------
function setBulkModalLong(isLong){
  bulkModal?.classList.toggle('long-table', !!isLong);
}

// ================== LIST MODAL: autosize/long-table toggle ==================
function setListModalLong(isLong){
  const el = document.getElementById('modal-list-accounts');
  el?.classList.toggle('long-table', !!isLong);
}


// Edit club submit
// Edit club submit — show inline error instead of alert
// Edit club modal: auto-fill on valid club name + robust submit
(() => {
  const form = document.getElementById('form-club-edit');
  if (!form) return;

  const err = document.getElementById('club-edit-error');

  // Fields (we support multiple common name variants)
  const nameEl   = form.querySelector('[name="club_name"], [name="name"]');
  const catEl    = form.querySelector('[name="category"], [name="tags"]');
  const descEl   = form.querySelector('textarea[name="description"], [name="description"], [name="club_description"]');
  const advIdEl  = form.querySelector('[name="adviser_id"]');
  const advEmEl  = form.querySelector('[name="adviser_email"], [name="sti_email"]');

    // Note under Adviser Email: only show when field has a value
  let advNote = form.querySelector('#club-edit-adviser-note');
  if (!advNote && advEmEl) {
    advNote = document.createElement('div');
    advNote.id = 'club-edit-adviser-note';
    advNote.className = 'field-note small';
    advNote.hidden = true;
    // make it visually smaller regardless of site CSS
    advNote.style.fontSize = '12px';
    advNote.style.lineHeight = '1.2';
    advNote.style.marginTop = '4px';
    advNote.style.color = '#666';
    (advEmEl.closest('label') || advEmEl.parentElement).appendChild(advNote);
  }

  function syncAdvNote() {
    if (!advNote || !advEmEl) return;
    const hasVal = !!advEmEl.value.trim();
    advNote.hidden = !hasVal;
    advNote.textContent = hasVal
      ? 'Tip: Clearing this field and clicking Save will remove this account as the club adviser.'
      : '';
  }

  // Keep your current behavior that clears adviser_id when email is cleared
  advEmEl?.addEventListener('input', () => {
    if (advEmEl.value.trim() === '' && advIdEl) advIdEl.value = '';
    syncAdvNote();
  });

  // Initialize note visibility on open/fill
  syncAdvNote();


  // Small helpers
  const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const clearErr = () => { if (err) { err.hidden = true; err.textContent = ''; } };
  const showErr  = (msg) => { if (err) { err.hidden = false; err.textContent = msg; } };

  async function lookupAndFill(rawName){
    clearErr();
    const q = (rawName || '').trim();
    if (!q) { form.dataset.clubId = ''; return; }

    try {
      // Use your existing GET helper (with cache-buster); rewriter will route list.php as needed
      const payload = await apiGet('api/clubs/list_admin.php?limit=500');
      const items   = payload?.items || payload?.rows || payload?.data || (Array.isArray(payload) ? payload : []);
      if (!items.length) { form.dataset.clubId = ''; return; }

// Exact case-sensitive name match
const target = (q || '').trim();
const club = items.find(c => String(c.name || c.club_name || '').trim() === target);

      if (!club) {
        form.dataset.clubId = '';
        // No match is not an error (maybe creating a new club)
        return;
      }

      // Stash id for submit
      form.dataset.clubId = String(club.id ?? club.club_id ?? '');

      // Fill fields
      if (catEl)   catEl.value   = club.category ?? club.tags ?? '';
      if (descEl)  descEl.value  = club.description ?? '';
      // Prefer email for display if present; keep id if you want numeric linkage
      if (advEmEl) advEmEl.value = club.adviser_email ?? club.sti_email ?? '';
      if (advIdEl) advIdEl.value = club.adviser_id   ?? '';
      syncAdvNote();

      // Optional UX hint

    } catch (ex) {
      showErr(String(ex.message || ex));
    }
  }

  // Debounced auto-lookup while typing
  let t;
  nameEl?.addEventListener('input', () => {
    clearTimeout(t);
    const val = nameEl.value.trim();
    if (val.length < 2) return; // wait for a bit of input
    t = setTimeout(() => lookupAndFill(val), 250);
  });
  // And on blur (covers paste/quick entries)
  nameEl?.addEventListener('blur', () => {
    const val = nameEl.value.trim();
    if (val) lookupAndFill(val);
  });

  // If user deletes the adviser email, also clear any filled adviser_id
advEmEl?.addEventListener('input', () => {
  if (advEmEl.value.trim() === '' && advIdEl) advIdEl.value = '';
});


  // Submit: include id if we found one; send changed fields
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErr();

    const clubName    = (nameEl?.value || '').trim();
    const category    = (catEl?.value  || '').trim();
    const description = (descEl?.value || '').trim();
    const adviser_id  = (advIdEl?.value || '').trim();
    const adviser_email = (advEmEl?.value || '').trim().toLowerCase();

    if (!clubName) { showErr('Please enter the club name.'); return; }

    const fd = new FormData();
    // Identify the row: prefer id if we have it, but also send the name (many backends accept either)
    const clubId = form.dataset.clubId || '';
    if (clubId) fd.append('id', clubId);
fd.append('club_name', clubName);
const newNameEl = form.querySelector('input[name="name"]');
const newName = (form.querySelector('input[name="name"]')?.value || '').trim();



    if (category)    fd.append('category', category);
    if (description) fd.append('description', description);
    if (adviser_id) {
  fd.append('adviser_id', adviser_id);
} else if (adviser_email) {
  fd.append('adviser_email', adviser_email);
} else {
  fd.append('clear_adviser', '1'); // <- tells backend to detach adviser
}

// Organization assignment (choose or clear)
const orgSel = form.querySelector('#club-org-select, [name="organization_id"]');
const orgVal = (orgSel?.value || '').trim();
if (orgVal) fd.append('organization_id', orgVal);
else fd.append('clear_organization', '1');


    try {
      await apiPostForm('api/clubs/update.php', fd);
      Toasts.ok('Club updated');
      if (advEmEl) advEmEl.value = '';
if (advIdEl) advIdEl.value = '';
syncAdvNote();


      // If your list modal is open on "Clubs", refresh it
      if (window.listType === 'club' && typeof reloadCurrentList === 'function') {
        await reloadCurrentList();
      }
       if (advNote) {
        advNote.textContent = '';
        advNote.hidden = true;
      }

    } catch (ex) {
      showErr(String(ex.message || ex));
    }
  });
})();


// --- status filter (injected UI) ---
let listStatus = 'all'; // 'all' | 'active' | 'archived'

function ensureStatusFilter(reset = false){
  let sel = document.getElementById('list-status');
  if (!sel) {
    sel = document.createElement('select');
    sel.id = 'list-status';
    sel.className = 'list-status';
    sel.innerHTML = `
      <option value="all">All</option>
      <option value="active">Active</option>
      <option value="archived">Archived</option>
    `;
    if (listSearch && listSearch.parentNode){
      listSearch.parentNode.insertBefore(sel, listSearch.nextSibling);
    } else {
      document.getElementById('modal-list-accounts')
        ?.querySelector('.modal-header')
        ?.appendChild(sel);
    }
  }

  // If asked to reset, reset the state — then ALWAYS sync the UI to state
  if (reset) listStatus = 'all';
  sel.value = listStatus;

  sel.onchange = () => {
    listStatus = sel.value || 'all';
    filterList();
  };
}

function applyStatusFilter(rows){
  if (listStatus === 'all') return rows;
  const want = (listStatus === 'active') ? 'active' : 'archived';
  return rows.filter(r => (r.status || 'active') === want);
}

// ---- Add Organizations support to the List modal ----
(function addOrgListSupport(){
  const wrap    = document.getElementById('list-table-wrap');
  const titleEl = document.getElementById('list-title');
  const countEl = document.getElementById('list-count');
  const searchEl= document.getElementById('list-search');

  // Keep original loader if present
  const origLoadList = window.loadList;

  async function fetchOrganizationsForList() {
    // Keep it simple; you can add status filter later if you want:
    const j = await apiGet('api/organizations/list.php?limit=2000');
    // Normalize shape
    const items = (j?.items || []).map(o => ({
      id: String(o.id),
      name: String(o.name || ''),
      type: o.org_type || '',
      clubs: Number(o.club_count || 0),
      status: String(o.status || 'active')
    }));
    return items;
  }

  function renderOrgTable(items) {
    if (!wrap) return;
    // Optional search
    const q = (searchEl?.value || '').trim().toLowerCase();
    const filtered = q
      ? items.filter(r =>
          r.name.toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q))
      : items;

    // Build a minimal table
    const rows = filtered.map((r, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${r.id}</td>
        <td>${r.name}</td>
        <td>${r.type || '—'}</td>
        <td>${r.clubs}</td>
        <td>${r.status}</td>
      </tr>`).join('');

    wrap.innerHTML = `
      <table class="list-table">
        <thead>
          <tr>
            <th>#</th>
            <th>id</th>
            <th>name</th>
            <th>type</th>
            <th>clubs</th>
            <th>status</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="6" class="muted">No organizations found</td></tr>'}</tbody>
      </table>
    `;

    if (countEl) countEl.textContent = `${filtered.length} item${filtered.length===1 ? '' : 's'}`;
    if (titleEl) titleEl.textContent = 'Organizations';
  }

  // Wrap the original loader, handle organization ourselves
  window.loadList = async function(kind){
    if (kind === 'organization') {
      const items = await fetchOrganizationsForList().catch(() => []);
      renderOrgTable(items);
      // Live-search hookup for organizations
      if (searchEl && !searchEl.dataset.orgBound) {
        searchEl.dataset.orgBound = '1';
        searchEl.addEventListener('input', () => renderOrgTable(items));
      }
      return;
    }
    // Everything else → original
    return origLoadList ? origLoadList(kind) : undefined;
  };
})();


// Function to initialize password toggle icons when a modal opens
function initializePasswordToggle(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  // Find all password toggle buttons within this modal
  const pwToggles = modal.querySelectorAll('.pw-ico');

  pwToggles.forEach(btn => {
    const input = btn.closest('.pw-wrap')?.querySelector('input');
    if (!input) return;

    // Set initial icon based on input type (should be 'password' by default)
    if (input.type === 'password') {
      btn.innerHTML = ICON_EYE;
      btn.setAttribute('aria-pressed', 'false');
    } else {
      btn.innerHTML = ICON_EYE_OFF;
      btn.setAttribute('aria-pressed', 'true');
    }
  });
}


// =============== Modal wiring (delegated) ===============
(function modalWiring(){
  function openModal(id, openerBtn){
    const modal = document.getElementById(id);
    if (!modal) return;

    // Special prep for bulk upload
    if (id === 'modal-bulk-upload') {
      bulkType = openerBtn?.dataset.kind === 'adviser' ? 'adviser' : 'student';
      setBulkModalLong(false);
      bulkModal?.setAttribute('data-kind', bulkType);

      // initial compact state
      bulkModal?.classList.remove('has-table');
      bulkModal?.classList.remove('lock-backdrop');

      showEl(bulkWrap);
      showEl(bulkTools);
      showEl(helperEl);

      showEl(currentTplBtn());
      hideEl(bulkSearch);
      hideEl(bulkCount);

      bulkForm?.reset();
      if (bulkEl) bulkEl.value = '';
      if (bulkMeta) bulkMeta.textContent = '';
      hideEl(bulkTableWrap);
      bulkTableWrap && (bulkTableWrap.innerHTML = '');
      hideEl(bulkValidate);
      bulkHead = []; bulkAllRows = []; isCSV = false;
      if (bulkSubmitBtn) bulkSubmitBtn.disabled = false;
    }

    // show the modal
    modal.hidden = false;
    modal.style.removeProperty('display');
    modal.setAttribute('aria-hidden', 'false');

    // When opening the List modal, capture which kind to show (student/adviser/club/admin/organization)
if (id === 'modal-list-accounts') {
  window.listType = openerBtn?.dataset.kind || 'student';
  if (typeof loadList === 'function') loadList(window.listType);
}

if (id === 'modal-club-edit') {
  populateOrgSelect(document.getElementById('club-org-select'));
} else if (id === 'modal-club-create') {
  populateOrgSelect(document.getElementById('club-org-select-create'));
}

// Approvals: set type and load rows
if (id === 'modal-approvals') {
  const k = openerBtn?.dataset.kind || modal.dataset.kind || 'avatar'; // 'avatar' | 'cover'
  modal.dataset.kind = k;
  const t = modal.querySelector('#ap-title');
  if (t) t.textContent = (k === 'cover') ? 'Pending cover photos' : 'Pending profile pictures';
  if (typeof loadApprovals === 'function') loadApprovals(k);
  apResetSelection();
}


    // Initialize password toggles for relevant modals
    if (id === 'modal-student-create' || id === 'modal-adviser-create' || id === 'modal-student-reset' || id === 'modal-adviser-reset' || id === 'modal-admin-reset') {
      initializePasswordToggle(id);
    }
  }

  function closeModal(modal){
    if (!modal) return;
    if (modal.id === 'modal-bulk-upload') {
      bulkModal?.classList.remove('has-table');
      bulkModal?.classList.remove('lock-backdrop');
      setBulkModalLong(false);
      showEl(helperEl);
      showEl(currentTplBtn());
      hideEl(bulkSearch);
      hideEl(bulkCount);
    }
    modal.setAttribute('aria-hidden', 'true');
  }

  // Single delegated click handler for all opens/closes
  document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    const openBtn = e.target.closest('[data-open]');
    if (openBtn){
      e.preventDefault();
      const id = openBtn.getAttribute('data-open');
      openModal(id, openBtn);
      return;
    }

    // CLOSE by [data-close]
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn){
      e.preventDefault();
      e.stopPropagation();
      closeModal(closeBtn.closest('.modal'));
      return;
    }

    // BACKDROP click (but not inside box)
    const modal = e.target.closest('.modal');
    if (modal && !e.target.closest('.modal-box')){
      if (modal.id === 'modal-bulk-upload' && modal.classList.contains('lock-backdrop')) return;
      closeModal(modal);
    }
  });

  // Esc closes any open modal (unless locked bulk modal)
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal[aria-hidden="false"]').forEach(m => {
      if (m.id === 'modal-bulk-upload' && m.classList.contains('lock-backdrop')) return;
      m.setAttribute('aria-hidden','true');
    });
  });
})();

// Create Club (maps club_name/tags -> name/category)
// Create Club (now includes description; supports adviser_id or adviser_email)



document.getElementById('form-club-create')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;

  const curr = (form.querySelector('input[name="name_key"]')?.value || '').trim();
const newName = (form.querySelector('input[name="name"]')?.value || '').trim();


  // Read from either name or club_name; tags or category; and multiple description name variants
  const nameEl  = form.querySelector('[name="name"], [name="club_name"]');
  const catEl   = form.querySelector('[name="category"], [name="tags"]');
  const descEl  = form.querySelector('[name="description"], [name="club_description"], textarea[name="description"]');

  // Adviser can be entered as an ID or an email depending on your form
  const advIdEl    = form.querySelector('[name="adviser_id"]');
  const advEmailEl = form.querySelector('[name="adviser_email"]');

  const name        = nameEl?.value?.trim() || '';
  const category    = catEl?.value?.trim() || '';
  const description = descEl?.value?.trim() || '';

  // Prefer adviser_id if present; otherwise we’ll pass adviser_email (server may ignore if not handled)
  const adviser_id    = (advIdEl?.value || '').trim();
  const adviser_email = (advEmailEl?.value || '').trim().toLowerCase();

  if (!name) return Toasts.warn('Please enter the club name.');

  const fd = new FormData();
  fd.append('name', name);
  if (category)    fd.append('category', category);
  if (description) fd.append('description', description);

  // Your PHP currently expects adviser_id (integer). Send it if you have it:
  if (adviser_id)  fd.append('adviser_id', adviser_id);
  // If your form only has email and your backend supports it, you can also send this.
  // (Your provided PHP example ignores this, which is fine; it will just be unused.)
  if (!adviser_id && adviser_email) fd.append('adviser_email', adviser_email);

// Include organization on create (optional)
const orgSelCreate = form.querySelector('#club-org-select-create, [name="organization_id"]');
if (orgSelCreate && orgSelCreate.value) {
  fd.append('organization_id', orgSelCreate.value);
}



  try {
    await apiPostForm('api/clubs/create.php', fd);
    Toasts.ok('Club created');

    // Optional: refresh any open Clubs list
    if (window.listType === 'club' && typeof reloadCurrentList === 'function') {
      await reloadCurrentList();
    }

    form.reset();
    form.closest('.modal')?.setAttribute('aria-hidden','true');
  } catch (err) {
    Toasts.err(String(err.message || err));
  }
});

Toasts.err = (m) => { console.error(m); };

// ========== Organizations: Create ==========
document.getElementById('form-org-create')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const fd = new FormData(form);
  try {
    // Adviser on create
const advCreate = form.querySelector('input[name="adviser_email"]')?.value.trim();
if (advCreate) fd.append('adviser_email', advCreate);

    await apiPostForm('api/organizations/create.php', fd);
    Toasts.ok('Organization created');
    invalidateOrgCache();
    // repopulate any open selects
    populateOrgSelect(document.getElementById('club-org-select'));
    populateOrgSelect(document.getElementById('club-org-select-create'));
    form.reset();
    form.closest('.modal')?.setAttribute('aria-hidden','true');
  } catch (err) {
    Toasts.err(String(err.message || err));
  }
});

// ========== Organizations: Edit ==========
document.getElementById('form-org-edit')?.addEventListener('submit', async (e) => {

  e.preventDefault();
  const form = e.currentTarget;
  const fd = new FormData(form);
  try {
    // Adviser on edit
const advEmail = form.querySelector('input[name="adviser_email"]')?.value.trim();
const clearAdv = form.querySelector('input[name="clear_adviser"]')?.checked;
if (clearAdv) {
  fd.append('clear_adviser', '1');
} else if (advEmail) {
  fd.append('adviser_email', advEmail);
}

    await apiPostForm('api/organizations/update.php', fd);
    Toasts.ok('Organization updated');
    invalidateOrgCache();
    // repopulate any open selects
    populateOrgSelect(document.getElementById('club-org-select'));
    populateOrgSelect(document.getElementById('club-org-select-create'));
    form.closest('.modal')?.setAttribute('aria-hidden','true');
  } catch (err) {
    Toasts.err(String(err.message || err));
  }
});

// Edit Organization → Delete button (global binding, not inside submit)
document.getElementById('org-delete-btn')?.addEventListener('click', async () => {
  const form = document.getElementById('form-org-edit');
  const err  = document.getElementById('org-edit-error');
  const nameKey = form?.querySelector('input[name="name_key"]')?.value.trim() || '';

  if (!nameKey) {
    if (err) { err.textContent = 'Type the current organization name first.'; err.hidden = false; }
    return;
  }

  // Find org by name (uses existing helper/cache)
  const orgs = await fetchOrganizations().catch(() => []);
const match = orgs.find(o => String(o.name || '').trim() === String(nameKey).trim());

  if (!match) {
    if (err) { err.textContent = 'Organization not found.'; err.hidden = false; }
    return;
  }

  // Prepare confirm modal using the shared flow
  const titleEl = confirmArchModal.querySelector('.modal-head h3');
  const noteEl  = confirmArchModal.querySelector('.modal-body .muted');

  pendingArchive = {
    action: 'delete',
    type: 'organization',
    idKey: 'id',              // organizations delete.php expects `id`
    idVal: match.id,
    fullName: match.name
  };

  titleEl.textContent = 'Delete organization?';
  archMsg.textContent = `Delete ${match.name} (${match.id})?`;
  if (noteEl) noteEl.textContent = 'This will permanently remove the organization.';
  btnArchConfirm.textContent = 'Delete';
  btnArchConfirm.classList.remove('btn-success');
  btnArchConfirm.classList.add('btn-danger');

  // Show confirm modal
  confirmArchModal.hidden = false;
  confirmArchModal.style.removeProperty('display');
  confirmArchModal.setAttribute('aria-hidden','false');
  showEl(confirmArchModal);
});




// ---- Admin Reset modal wiring ----
(function initAdminResetModal(){
  const modal = document.getElementById('modal-admin-reset');
  if (!modal) return; // markup missing

  const form    = modal.querySelector('#form-admin-reset');
  const idInput = modal.querySelector('input[name="identifier"]');
  const pwInput = modal.querySelector('input[name="new_password"]');
  // const eyeBtn  = modal.querySelector('.pw-ico'); // No longer needed, handled by generic listener

  // NEW: Get the error element
  const errEl = document.getElementById('admin-reset-error');

  // Helper function to show/hide error
  function showAdminError(msg) {
    if (errEl) {
      errEl.textContent = msg;
      errEl.hidden = !msg; // Hide if message is empty, show if not
    }
  }

  // Small in-memory lookup (reuses your demo store if present)
  function findAdmin(identifier) {
    const key = (identifier || '').trim().toLowerCase();
    const src = (window.demo && Array.isArray(window.demo.admins)) ? window.demo.admins : [];
    return src.find(a =>
      String(a.admin_id).toLowerCase() === key ||
      (a.sti_email && a.sti_email.toLowerCase() === key)
    );
  }

  // Auto-suggest password when a valid admin is detected
  idInput.addEventListener('input', () => {
    showAdminError(''); // Clear error on input
    const a = findAdmin(idInput.value);
    pwInput.value = a ? `${String(a.last_name || '').toLowerCase()}_admin` : '';
  });

  // Submit → fake reset + toast + close
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    showAdminError(''); // Clear error on submit attempt

    const a = findAdmin(idInput.value);
    if (!a) {
      // OLD: (window.showToast ? showToast('Admin not found', 'err') : alert('Admin not found'));
      // NEW: Display inline error
      showAdminError('Admin not found. Please check the ID or email.');
      return;
    }
    // Note: password is not actually stored in DB_ADMINS in this demo, just suggested.
    // a.password = pwInput.value || `${String(a.last_name||'').toLowerCase()}_admin`;
    (window.showToast ? showToast('Admin password reset', 'ok') : alert('Admin password reset'));
    // use your existing close utility, or fall back to attribute
    const closeBtn = modal.querySelector('[data-close]');
    closeBtn ? closeBtn.click() : modal.setAttribute('aria-hidden','true');
    form.reset();
  });
})();

// ... (rest of your code) ...



// =============== Template downloads ===============
btnTplStudent?.addEventListener('click', () => {
  // Student: ID = 2000 + 6 digits; password = lastname + last6digits
  const sample = { first:'Juan', middle:'', last:'Dela Cruz', email:'juan.delacruz@globalcity.sti.edu.ph' };
  const suf = rand6();
  const studentId = `2000${suf}`;
  const password  = `${slugLower(sample.last)}${suf}`;
  const csv = [
    'student_id,first_name,middle_name,last_name,sti_email,password',
    `${studentId},${sample.first},${sample.middle},${sample.last},${sample.email},${password}`
  ].join('\n');
  downloadCSV('students_template.csv', csv);
});

btnTplAdviser?.addEventListener('click', () => {
  // Adviser: ID = 2000 + 6 digits; password = lastname + _adviser
  const sample = { first:'Maria', middle:'', last:'Santos', email:'maria.santos@globalcity.sti.edu.ph' };
  const suf = rand6();
  const adviserId = `2000${suf}`;
  const password  = `${slugLower(sample.last)}_adviser`;
  const csv = [
    'adviser_id,first_name,middle_name,last_name,sti_email,password',
    `${adviserId},${sample.first},${sample.middle},${sample.last},${sample.email},${password}`
  ].join('\n');
  downloadCSV('advisers_template.csv', csv);
});

// =============== Bulk Upload (auto-kind, search, validation) ===============

async function bulkUpload(entity, file) {
  const fd = new FormData();
  fd.append('entity', entity);  // 'students' | 'advisers'
  fd.append('file', file);      // CSV or XLSX
  return apiPostForm('api/bulk/upload.php', fd);
}

function findIdInfo(head, rows, colName){
  const idx = head.findIndex(h => (h ?? '').trim().toLowerCase().replace(/\s+/g,'_') === colName);
  let count = 0;
  if (idx >= 0){
    rows.forEach(r => {
      const v = String(r[idx] ?? '').trim();
      if (colName === 'student_id'){
        if (VALID_ID_RE.test(v) || LEGACY_STUDENT_ID_RE.test(v)) count++;
      } else {
        if (VALID_ID_RE.test(v)) count++;
      }
    });
  }
  return { idx, count };
}

function showValidation(msg, ok){
  if (!bulkValidate) return;
  if (ok){ hideEl(bulkValidate); bulkValidate.textContent = ''; }
  else   { showEl(bulkValidate); bulkValidate.textContent = msg; }
  if (bulkSubmitBtn) bulkSubmitBtn.disabled = !ok;
}

function renderBulkTable(rows){
  const MAX_SHOW = 200;
  const shown = rows.slice(0, MAX_SHOW);

  bulkTableWrap.innerHTML = '';
  const table = document.createElement('table');
  table.className = 'preview-table';

  // lock/unlock modal height depending on visible rows
  setBulkModalLong(rows.length > 9);

  // header + row number
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  const thNum = document.createElement('th'); thNum.textContent = '#'; trh.appendChild(thNum);
  bulkHead.forEach(h => { const th=document.createElement('th'); th.textContent=h; trh.appendChild(th); });
  thead.appendChild(trh);

  // which column to validate?
  const idColName = (bulkType === 'adviser') ? 'adviser_id' : 'student_id';
  const idIdx = bulkHead.findIndex(h => (h ?? '').trim().toLowerCase().replace(/\s+/g,'_') === idColName);

  const tbody = document.createElement('tbody');
  shown.forEach((r, i) => {
    const tr = document.createElement('tr');

    const tdNum = document.createElement('td');
    tdNum.textContent = String(i + 1);
    tdNum.className = 'num';
    tr.appendChild(tdNum);

    bulkHead.forEach((_, colIdx) => {
      const td = document.createElement('td');
      const val = r[colIdx] ?? '';
      td.textContent = val;

      if (colIdx === idIdx){
        const v = String(val).trim();
        const valid = (bulkType === 'adviser')
          ? VALID_ID_RE.test(v)
          : (VALID_ID_RE.test(v) || LEGACY_STUDENT_ID_RE.test(v));
        if (!valid) td.classList.add('bad');
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(thead); table.appendChild(tbody);
  bulkTableWrap.appendChild(table);
  showEl(bulkTableWrap);

  if (bulkCount){
    bulkCount.textContent = `${shown.length} / ${rows.length} row${rows.length!==1?'s':''}`;
  }
}

function applyValidation(){
  if (!isCSV){
    showValidation('XLSX cannot be validated here. Please confirm you selected the correct template. Server will validate.', true);
    return;
  }
  if (bulkType === 'adviser'){
    const { idx, count } = findIdInfo(bulkHead, bulkAllRows, 'adviser_id');
    if (idx === -1 || count === 0){
      showValidation('This file does not look like Advisers: missing "adviser_id" or no valid IDs (e.g., 2000xxxxxx).', false);
    } else {
      showValidation(`Looks good for Advisers: found "adviser_id" with ${count} valid ID${count!==1?'s':''}.`, true);
    }
  } else {
    const { idx, count } = findIdInfo(bulkHead, bulkAllRows, 'student_id');
    if (idx === -1 || count === 0){
      showValidation('This file does not look like Students: missing "student_id" or no valid IDs (e.g., 2000xxxxxx or 22-1234-5678).', false);
    } else {
      showValidation(`Looks good for Students: found "student_id" with ${count} valid ID${count!==1?'s':''}.`, true);
    }
  }
}

// File select → preview + validate + lock backdrop + toggle bars
bulkEl?.addEventListener('change', async () => {
  // reset preview area
  showEl(bulkWrap);
  showEl(bulkTools);
  hideEl(bulkTableWrap); bulkTableWrap.innerHTML = '';
  if (bulkMeta) bulkMeta.textContent = '';
  bulkHead = []; bulkAllRows = []; isCSV = false;

  const f = bulkEl.files?.[0];

  if (!f) {
    bulkModal?.classList.remove('has-table');
    bulkModal?.classList.remove('lock-backdrop');
    setBulkModalLong(false);

    showEl(helperEl);
    showEl(currentTplBtn());
    hideEl(bulkSearch);
    hideEl(bulkCount);
    return;
  }

  // hide helper and template; lock backdrop
  hideEl(helperEl);
  hideEl(currentTplBtn());
  bulkModal?.classList.add('lock-backdrop');

  const sizeKB = Math.round(f.size/1024);
  const name = f.name;
  isCSV = /\.csv$/i.test(name);

  bulkMeta.textContent = `${name} — ${sizeKB} KB`;

  if (isCSV) {
    const text = await f.text();
    const rows = csvToRows(text);
    bulkHead = rows[0] || [];
    bulkAllRows = rows.slice(1);

    renderBulkTable(bulkAllRows);
    showEl(bulkTools);
    showEl(bulkSearch);
    showEl(bulkCount);

    bulkModal?.classList.add('has-table'); // expanded
  } else {
    // XLSX — preview not available, keep compact but locked
    const note = document.createElement('div');
    note.className = 'muted small';
    note.textContent = 'XLSX selected — preview not available. The file will be uploaded as-is.';
    bulkTableWrap.appendChild(note);
    showEl(bulkTableWrap);

    setBulkModalLong(false);
    hideEl(bulkSearch);
    hideEl(bulkCount);
    bulkModal?.classList.remove('has-table');
  }

  applyValidation();
});

// Search in preview
bulkSearch?.addEventListener('input', () => {
  const q = bulkSearch.value.trim().toLowerCase();
  const filtered = !q ? bulkAllRows : bulkAllRows.filter(r => r.some(c => (c ?? '').toLowerCase().includes(q)));
  renderBulkTable(filtered);
});

// NEW: bulkUpload function
async function bulkUpload(entity, file) {
  const fd = new FormData();
  fd.append('entity', entity);           // 'students' | 'advisers'
  fd.append('file', file);               // CSV or XLSX
  return apiPostForm('api/bulk/upload.php', fd);
}

bulkForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!bulkType) return Toasts.warn('Unknown upload type. Open the modal from Students or Advisers.');

  const file = bulkEl.files?.[0];
  if (!file) return Toasts.warn('Please choose a file');
  if (bulkSubmitBtn?.disabled) return Toasts.err('Fix validation errors before uploading.');

  try {
    // Upload to the single backend with entity flag
    await bulkUpload(bulkType + 's', file); // 'students' or 'advisers'
    Toasts.ok(`Batch upload complete for ${bulkType === 'student' ? 'students' : 'advisers'}`);

    // Hide preview/table and close modal to show success
    const m = e.currentTarget.closest('.modal');
    m?.classList.remove('has-table');
    m?.classList.remove('lock-backdrop');
    setBulkModalLong(false);

    showEl(helperEl);
    showEl(currentTplBtn());
    hideEl(bulkSearch);
    hideEl(bulkCount);

    m?.setAttribute('aria-hidden', 'true');
    e.currentTarget.reset();

    hideEl(bulkTableWrap);
    bulkTableWrap.innerHTML = '';
    hideEl(bulkValidate);
  } catch (err) {
    Toasts.err(String(err.message || err));
  }
});

// ======================= Auto-fill passwords (Create forms) =======================
(function autoStudentPassword(){
  const form = document.getElementById('form-student-create');
  if (!form) return;
  const idEl  = form.querySelector('input[name="student_id"]');
  const lnEl  = form.querySelector('input[name="last_name"]');
  const pwEl  = form.querySelector('input[name="password"]');
  if (!idEl || !lnEl || !pwEl) return;

  const digits6 = s => String(s||'').replace(/\D/g,'').slice(-6);
  let touched = false, lastAuto = '';
  function compute(){
    const last = slugLower(lnEl.value);
    const suf  = digits6(idEl.value);
    if (!last || !suf) return '';
    return last + suf;
  }
  function refresh(){
    const auto = compute();
    if (!auto) return;
    if (!touched || pwEl.value === lastAuto){ pwEl.value = auto; lastAuto = auto; }
  }
  lnEl.addEventListener('input', refresh);
  idEl.addEventListener('input', refresh);
  pwEl.addEventListener('input', () => { touched = true; });
})();

(function autoAdviserPassword(){
  const form = document.getElementById('form-adviser-create');
  if (!form) return;
  const lnEl = form.querySelector('input[name="last_name"]');
  const pwEl = form.querySelector('input[name="password"]');
  if (!lnEl || !pwEl) return;

  let touched = false, lastAuto = '';
  function compute(){
    const last = slugLower(lnEl.value);
    return last ? `${last}_adviser` : '';
  }
  function refresh(){
    const auto = compute();
    if (!auto) return;
    if (!touched || pwEl.value === lastAuto){ pwEl.value = auto; lastAuto = auto; }
  }
  lnEl.addEventListener('input', refresh);
  pwEl.addEventListener('input', () => { touched = true; });
})();

// ======================= Student Reset: ID-only + eye icon =======================
(function enhanceStudentResetAuto(){
  const form = document.getElementById('form-student-reset');
  if (!form) return;

  const idEl = form.querySelector('input[name="identifier"]');
  const pwEl = form.querySelector('input[name="new_password"]');
  if (!idEl || !pwEl) return;

  // password field UX
  pwEl.readOnly = true; pwEl.type = 'password';
  pwEl.placeholder = 'Temporary Password';

  // ensure pw-wrap + eye icon
  const pwLabel = pwEl.closest('label') || pwEl.parentElement;
  let wrap = pwEl.parentElement;
  if (!wrap || !wrap.classList.contains('pw-wrap')) {
    wrap = document.createElement('div'); wrap.className = 'pw-wrap';
    pwLabel.insertBefore(wrap, pwEl); wrap.appendChild(pwEl);
  }
  if (!wrap.querySelector('.pw-ico')) {
    const icoBtn = document.createElement('button');
    icoBtn.type = 'button'; icoBtn.className = 'pw-ico';
    icoBtn.setAttribute('aria-label', 'Show password');
    icoBtn.setAttribute('aria-pressed', 'false');
    icoBtn.innerHTML = ICON_EYE;
    wrap.appendChild(icoBtn);
  }

  // inline note / status (small text under the ID field)
  let note = document.getElementById('student-reset-note');
  if (!note){
    note = document.createElement('div'); note.id = 'student-reset-note'; note.className = 'field-note';
    (idEl.closest('label') || idEl.parentElement).appendChild(note);
  }
  const setNote = (msg, ok = true) => { note.textContent = msg || ''; note.classList.toggle('error', !ok); };
  // Tooltip (below the ID textbox) to show the detected last name
let tip = document.getElementById('student-reset-tip');
if (!tip){
  tip = document.createElement('div');
  tip.id = 'student-reset-tip';
  tip.className = 'field-note'; // << match exact style of the existing note
  (idEl.closest('label') || idEl.parentElement).appendChild(tip);
}
const setTip = (msg) => { tip.textContent = msg || ''; tip.hidden = !msg; };

  // last-6 helper
  const last6 = s => String(s||'').replace(/\D/g,'').slice(-6);

  // LOOKUP: simple fetch to your new endpoint; accept a few shapes
  async function lookupLastName(studentId){
    try {
      const res = await fetch(`/api/students/lookup.php?student_id=${encodeURIComponent(studentId)}`);
      if (!res.ok) return null;
      const data = await res.json().catch(()=>null);
      return (data && (
        data.last_name ||
        data.lastName ||
        (data.item && (data.item.last_name || data.item.lastName)) ||
        (data.student && (data.student.last_name || data.student.lastName))
      )) || null;
    } catch {
      return null;
    }
  }

  // live updater
  let inflight = 0;
  async function refresh(){
    const raw = idEl.value.trim();
    if (!raw){ pwEl.value=''; setTip(''); setNote('');
 return; }

    const suf = last6(raw);
    if (suf.length < 6){
      pwEl.value=''; setTip('');
setNote('Enter a valid Student ID (need last 6 digits).', false);

      return;
    }

    inflight++; const ticket = inflight;
    setNote('Looking up student…');

    const lastName = await lookupLastName(raw);
    if (ticket !== inflight) return; // stale

    if (!lastName){
      pwEl.value=''; setTooltip(idEl, '');
      setNote('Student not found. Please check the ID.', false);
      return;
    }

    setNote(`Last name: ${lastName}`, true);
pwEl.value = `${slugLower(lastName)}${suf}`;

  }

  // wire it up
  let t;
  idEl.addEventListener('input', () => { clearTimeout(t); t = setTimeout(refresh, 250); });
  idEl.addEventListener('blur', refresh);
})();


// ======================= Adviser Reset: ID-only + eye icon =======================
(function enhanceAdviserResetById(){
  const form = document.getElementById('form-adviser-reset');
  if (!form) return;

  let idEl = form.querySelector('input[name="identifier"]') || form.querySelector('input[name="sti_email"]');
  const pwEl = form.querySelector('input[name="new_password"]');
  if (!idEl || !pwEl) return;

  try { idEl.type = 'text'; } catch {}
  idEl.placeholder = 'Adviser ID (e.g., 2000123456)';

  pwEl.readOnly = true; pwEl.type = 'password';
  pwEl.placeholder = 'Temporary Password';

  const pwLabel = pwEl.closest('label') || pwEl.parentElement;
  let wrap = pwEl.parentElement;
  if (!wrap || !wrap.classList.contains('pw-wrap')) {
    wrap = document.createElement('div'); wrap.className = 'pw-wrap';
    pwLabel.insertBefore(wrap, pwEl); wrap.appendChild(pwEl);
  }
  let icoBtn = wrap.querySelector('.pw-ico');
  if (!icoBtn) {
    icoBtn = document.createElement('button');
    icoBtn.type = 'button'; icoBtn.className = 'pw-ico';
    icoBtn.setAttribute('aria-label', 'Show password');
    icoBtn.setAttribute('aria-pressed', 'false');
    icoBtn.innerHTML = ICON_EYE;
    wrap.appendChild(icoBtn);
  }

  let note = document.getElementById('adviser-reset-note');
  if (!note){
    note = document.createElement('div'); note.id = 'adviser-reset-note'; note.className = 'field-note';
    (idEl.closest('label') || idEl.parentElement).appendChild(note);
  }
  const setNote = (msg, ok = true) => { note.textContent = msg || ''; note.classList.toggle('error', !ok); };

  const digits6 = s => String(s||'').replace(/\D/g,'').slice(-6);
  const normalizeId = s => String(s||'').replace(/\D/g,'');
  const DUMMY = { '2000999999': 'Santos' }; // demo

  // --- Only update tooltip when it actually changes (prevents blink) ---
  let currentTip = '';
  function updateTip(text){
    if (text === currentTip) return;
    setTooltip(idEl, text);
    currentTip = text;
  }

  async function fetchAdviserLastNameById(adviserId){
    const norm = normalizeId(adviserId);
    if (DUMMY[norm]) return DUMMY[norm];

    try {
      const res = await fetch(`/api/advisers/lookup.php?adviser_id=${encodeURIComponent(adviserId)}`);
      if (!res.ok) return null;
      const raw = await res.json().catch(() => ({}));

      // Accept multiple shapes: {data:{...}}, {item:{...}}, {...}
      const obj = raw?.data || raw?.item || raw?.adviser || raw || {};
      const last =
        obj.last_name ?? obj.lastName ?? obj.lastname ??
        obj.surname ?? obj.family_name ?? obj.familyName ?? null;

      return last ? String(last) : null;
    } catch { return null; }
  }

  let inflight = 0;
  async function refresh(){
    const raw = idEl.value.trim();
    if (!raw){ pwEl.value=''; updateTip(''); setNote(''); return; }

    const suf = digits6(raw);
    if (suf.length < 6){
      pwEl.value=''; updateTip('');
      setNote('Enter a valid Adviser ID (need last 6 digits).', false);
      return;
    }

    inflight++; const ticket = inflight;
    setNote('Looking up adviser…', true);

    const lastName = await fetchAdviserLastNameById(raw);
    if (ticket !== inflight) return;

    if (!lastName){
      pwEl.value=''; updateTip('');
      setNote('Adviser not found. Please check the ID.', false);
      return;
    }

    // Success branch in adviser reset → refresh()
setNote(`Last name: ${lastName}`, true); // persist under the ID field
updateTip(`Last name: ${lastName}`);     // (optional) keep hover tooltip too
pwEl.value = `${String(lastName).toLowerCase().replace(/\s+/g,'')}${suf}`;

  }

  let t; idEl.addEventListener('input', () => { clearTimeout(t); t = setTimeout(refresh, 250); });
  idEl.addEventListener('blur', refresh);
})();


// Utility to close a modal without throwing if structure changes
function closeModalFromForm(form) {
  const dlg = form.closest('.modal, .dialog, .sheet');
  if (dlg) {
    // whatever you already do to close/hide, keep it here
    dlg.setAttribute('aria-hidden', 'true'); // Assuming this is your standard way to hide
  }
}

// Create Student
document.getElementById('form-student-create')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const fd = new FormData(form);
  try {
    await apiPostForm('/api/students/create.php', fd);
    Toasts.ok('Student account created');
    form.reset();
    closeModalFromForm(form);
  } catch (err) { Toasts.err(String(err.message || err)); }
});

// Create Adviser
document.getElementById('form-adviser-create')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const fd = new FormData(form);
  try {
    await apiPostForm('/api/advisers/create.php', fd);
    Toasts.ok('Adviser account created');
    form.reset();
    closeModalFromForm(form);
  } catch (err) { Toasts.err(String(err.message || err)); }
});

// CREATE ADMIN (replace the existing handler with this)
document.getElementById('form-admin-create')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;

  const fd = new FormData(form);

  // Normalize / validate
  const adminId = String(fd.get('admin_id') || '').trim();
  const email   = String(fd.get('sti_email') || '').trim().toLowerCase();
  const first   = String(fd.get('first_name') || '').trim();
  const last    = String(fd.get('last_name') || '').trim();
  const pass    = String(fd.get('password') || '');

  if (!/^2000\d{6}$/.test(adminId))  return Toasts.warn('Enter a valid Admin ID (e.g., 2000123456).');
  if (!first || !last || !email || !pass) return Toasts.warn('Please complete all required fields.');
  fd.set('sti_email', email); // force lowercase

  try {
    await apiPostForm('api/admins/create.php', fd);
    Toasts.ok('Admin account created');
    form.reset();
    form.closest('.modal')?.setAttribute('aria-hidden', 'true');
  } catch (err) {
    Toasts.err(String(err.message || err));
  }
});


// Student reset (use your file + param `student_id`)
document.getElementById('form-student-reset')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const id  = form.querySelector('input[name="identifier"]').value.trim();
  const pwd = form.querySelector('input[name="new_password"]').value.trim();
  if (!id || !pwd) return Toasts.warn('ID and password are required');

  const fd = new FormData();
  fd.append('student_id', id);
  fd.append('password',   pwd);

  try {
    await apiPostForm('api/students/reset.php', fd);
    Toasts.ok('Student password reset');
    form.reset();
    form.closest('.modal')?.setAttribute('aria-hidden','true');
  } catch (err) { Toasts.err(String(err.message || err)); }
});

// Adviser reset (keep modal open; clear inputs + tooltip)
document.getElementById('form-adviser-reset')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const idEl = form.querySelector('input[name="identifier"]') || form.querySelector('input[name="sti_email"]');
  const pwEl = form.querySelector('input[name="new_password"]');

  const id  = (idEl?.value || '').trim();
  const pwd = (pwEl?.value || '').trim();
  if (!id || !pwd) {
    return Toasts.warn('Enter a valid Adviser ID first so a temp password can be generated.');
  }

  const fd = new FormData();
  fd.append('adviser_id', id);
  fd.append('password',   pwd);

  try {
    await apiPostForm('api/advisers/reset.php', fd);
    Toasts.ok('Adviser password reset');

    // Keep modal open; clear fields + tooltip + note
    idEl.value = '';
    pwEl.value = '';
    setTooltip(idEl, ''); // clear native tooltip
    const note = document.getElementById('adviser-reset-note');
    if (note) { note.textContent = ''; note.classList.remove('error'); }
    idEl.focus();
  } catch (err) {
    Toasts.err(String(err.message || err));
  }
});


// Admin reset (use your file + param `admin_id`)
document.getElementById('form-admin-reset')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const id  = form.querySelector('[name="identifier"]').value.trim();
  const pwd = form.querySelector('[name="new_password"]').value.trim();
  if (!id || !pwd) return Toasts.warn('ID and password are required');

  const fd = new FormData();
  fd.append('admin_id', id);
  fd.append('password', pwd);

  try {
    await apiPostForm('api/admins/reset.php', fd);
    Toasts.ok('Admin password reset');
    form.reset();
    form.closest('.modal')?.setAttribute('aria-hidden','true');
  } catch (err) { Toasts.err(String(err?.message || err)); }
});
// ======= List modal refs =======
const listModal     = document.getElementById('modal-list-accounts');
const listSearch    = document.getElementById('list-search');
const listCount     = document.getElementById('list-count');
const listWrap      = document.getElementById('list-table-wrap');
const listTitle     = document.getElementById('list-title');

let listType = null;           // 'student' | 'adviser' | 'admin'
let listRowsAll = [];          // raw data objects (active + archived)
let listRowsShown = [];        // currently filtered
// Unified
function getListData(type){
  if (type === 'club') {
    return DB_CLUBS.map(o => ({
 id: s.student_id ?? null,
  first_name: s.first_name ?? '',
  middle_name: s.middle_name ?? '',
  last_name: s.last_name ?? '',
  sti_email: s.sti_email ?? '',
  last_login: s.last_login ?? s.lastLogin ?? null, // <— NEW
  status: (s.status === 1 || String(s.status).toLowerCase() === 'active') ? 'active' : 'archived'
    }));
  }
  if (type === 'adviser') {
    return DB_ADVISERS.map(a => ({
 id: a.adviser_id ?? null,
  first_name: a.first_name ?? '',
  middle_name: a.middle_name ?? '',
  last_name: a.last_name ?? '',
  sti_email: a.sti_email ?? '',
  last_login: a.last_login ?? a.lastLogin ?? null, // <— NEW
  status: (a.status === 1 || String(a.status).toLowerCase() === 'active') ? 'active' : 'archived'
    }));
  }
  if (type === 'admin') {
    return DB_ADMINS.map(a => ({
      id: a.admin_id ?? null,
      first_name: a.first_name ?? '',
      middle_name: a.middle_name ?? '',
      last_name: a.last_name ?? '',
      sti_email: a.sti_email ?? '',
      last_login: a.last_login ?? a.lastLogin ?? null,
      status: (a.status === 1 || String(a.status).toLowerCase() === 'active') ? 'active' : 'archived'
    }));
  }
  // student
  return DB_STUDENTS.map(s => ({
    id: s.student_id ?? null,
    first_name: s.first_name ?? '',
    middle_name: s.middle_name ?? '',
    last_name: s.last_name ?? '',
    sti_email: s.sti_email ?? '',
    last_login: s.last_login ?? s.lastLogin ?? null,
    status: (s.status === 1 || String(s.status).toLowerCase() === 'active') ? 'active' : 'archived'
  }));
}


function renderListTable(rows){
  listWrap.innerHTML = '';

  // long/compact toggle based on row count (same threshold you had)
  setListModalLong(rows.length > 12);

  const table = document.createElement('table');
  table.className = 'list-table';

  // ---- THEAD
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');

  if (listType === 'club') {
    ['#','name','tags','adviser_email','status','Action']
      .forEach(h => { const th = document.createElement('th'); th.textContent = h; trh.appendChild(th); });
  } else {
    const idLabel =
      (listType === 'adviser') ? 'adviser_id' :
      (listType === 'admin')   ? 'admin_id'   : 'student_id';

    ['#', idLabel, 'first_name', 'middle_name', 'last_name', 'sti_email', 'last_login', 'status', 'Action']
      .forEach(h => { const th = document.createElement('th'); th.textContent = h; trh.appendChild(th); });
  }
  thead.appendChild(trh);

  // ---- TBODY
  const tbody = document.createElement('tbody');
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');

    // counter
    const tdNum = document.createElement('td');
    tdNum.className = 'num';
    tdNum.textContent = String(i + 1);
    tr.appendChild(tdNum);

    if (listType === 'club') {
      ['name','tags','adviser_email'].forEach((key) => {
        const td = document.createElement('td');
        td.textContent = r[key] ?? '';
        tr.appendChild(td);
      });
    } else {
      const idKey =
        (listType === 'adviser') ? 'adviser_id' :
        (listType === 'admin')   ? 'admin_id'   : 'student_id';

      // id
      const idTd = document.createElement('td');
      idTd.textContent = r[idKey] ?? '';
      tr.appendChild(idTd);

      // name/email/login
      ['first_name','middle_name','last_name','sti_email','last_login'].forEach((key) => {
        const td = document.createElement('td');
        if (key === 'last_login') {
          td.textContent = formatLastLogin(r.last_login);
        } else if (key === 'sti_email') {
          const span = document.createElement('span');
          span.className = 'clip';
          span.textContent = r.sti_email || '';
          td.appendChild(span);
        } else {
          td.textContent = r[key] ?? '';
        }
        tr.appendChild(td);
      });
    }

    // status
    const tdStatus = document.createElement('td');
    const isArchived = (r.status || '') === 'archived';
    tdStatus.textContent = r.status || 'active';
    if (isArchived) tdStatus.classList.add('status-archived');
    tr.appendChild(tdStatus);

    // action
// Action button (Archive/Activate + Delete when archived)
const tdAct = document.createElement('td');
tdAct.className = 'actions-cell';

const wrap = document.createElement('div');

// main action (toggle archived/active)
const btn = document.createElement('button');
btn.type = 'button';
btn.className = 'btn ' + (isArchived ? 'activate-btn' : 'archive-btn');
btn.textContent = isArchived ? 'Activate' : 'Archive';
btn.dataset.idx = i;
btn.dataset.action = isArchived ? 'activate' : 'archive';
wrap.appendChild(btn);

// when archived, also show a Delete button under Activate
if (isArchived) {
  const btnDel = document.createElement('button');
  btnDel.type = 'button';
  btnDel.className = 'btn archive-btn';   // reuse red style you already have
  btnDel.textContent = 'Delete';
  btnDel.dataset.idx = i;
  btnDel.dataset.action = 'delete';
  wrap.appendChild(btnDel);
}

tdAct.appendChild(wrap);
tr.appendChild(tdAct);

tbody.appendChild(tr);

  });

  table.appendChild(thead);
  table.appendChild(tbody);
  listWrap.appendChild(table);

  listCount.textContent = `${rows.length} row${rows.length!==1?'s':''}`;
  listRowsShown = rows;
}


function pct(part, total){ total = total || 1; return Math.round((+part||0) * 100 / total); }
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
async function fetchJSON(url){
  const r = await fetch(url, { credentials:'include', cache:'no-store' });
  const j = await r.json().catch(()=>null);
  if(!r.ok || !j) throw new Error(j?.error || `HTTP ${r.status}`);
  return j;
}


function filterList(){
  const q = (listSearch.value || '').toLowerCase().trim();

  let base = listRowsAll;

  // text filter per entity type
  if (q){
    if (listType === 'club') {
      base = base.filter(r =>
        [r.club_id, r.name, r.tags, r.adviser_email]
          .some(v => (v||'').toLowerCase().includes(q))
      );
    } else {
      const idKey =
        (listType === 'adviser') ? 'adviser_id' :
        (listType === 'admin')   ? 'admin_id'   : 'student_id';
      base = base.filter(r =>
        [r[idKey], r.first_name, r.middle_name, r.last_name, r.sti_email]
          .some(v => (v||'').toLowerCase().includes(q))
      );
    }
  }

  // apply the active/archived pill selection on top
  const finalRows = applyStatusFilter(base);
  renderListTable(finalRows);
}

/* >>>>>>>>>>>>>>> RELOAD CURRENT LIST (ADD AFTER filterList) >>>>>>>>>>>>>>> */
async function reloadCurrentList() {
  try {
    const kind = window.listType; // 'student' | 'adviser' | 'admin' | 'club'
    if (!kind) return;

    const endpoint =
  (kind === 'student')      ? '/api/students/list.php' :
  (kind === 'adviser')      ? '/api/advisers/list.php' :
  (kind === 'admin')        ? '/api/admins/list.php'   :
  (kind === 'club')         ? '/api/clubs/list_admin.php' :
                              '/api/organizations/list.php';


    const params  = (kind === 'club') ? '?limit=200' : '?status=all&limit=200';
    const payload = await apiGet(`${endpoint}${params}`);
    const items   = payload?.items || payload?.rows || payload?.data || (Array.isArray(payload) ? payload : []);

    const toTextStatus = (v) => {
      const s = String(v ?? 'active').toLowerCase();
      if (s === '1') return 'active';
      if (s === '0') return 'archived';
      return (s === 'active' || s === 'archived') ? s : 'active';
    };

    if (kind === 'club') {
      window.listRowsAll = items.map(c => ({
        club_id: String(c.club_id ?? c.id ?? ''),
        name: c.name ?? c.club_name ?? '',
        tags: c.category ?? c.tags ?? '',
        adviser_email: c.adviser_email ?? c.sti_email ?? '',
        status: toTextStatus(c.status)
      }));
} else if (listType === 'student') {
  listRowsAll = items.map(s => ({
    student_id: String(s.student_id ?? s.id ?? s.studentId ?? ''),
    first_name: s.first_name ?? s.firstName ?? '',
    middle_name: s.middle_name ?? s.middleName ?? '',
    last_name:  s.last_name ?? s.lastName ?? '',
    sti_email:  s.sti_email ?? s.email ?? s.stiEmail ?? '',
    last_login: s.last_login ?? s.lastLogin ?? null,
    status:     toTextStatus(s.status)
  }));
} else if (listType === 'adviser') {
  listRowsAll = items.map(a => ({
    adviser_id: String(a.adviser_id ?? a.id ?? a.adviserId ?? ''),
    first_name: a.first_name ?? a.firstName ?? '',
    middle_name: a.middle_name ?? a.middleName ?? '',
    last_name:  a.last_name ?? a.lastName ?? '',
    sti_email:  a.sti_email ?? a.email ?? a.stiEmail ?? '',
    last_login: a.last_login ?? a.lastLogin ?? null,
    status:     toTextStatus(a.status)
  }));
  
} else { // admin
  listRowsAll = items.map(a => ({
    admin_id:   String(a.admin_id ?? a.id ?? a.adminId ?? ''),
    first_name: a.first_name ?? a.firstName ?? '',
    middle_name: a.middle_name ?? a.middleName ?? '',
    last_name:  a.last_name ?? a.lastName ?? '',
    sti_email:  a.sti_email ?? a.email ?? a.stiEmail ?? '',
    last_login: a.last_login ?? a.lastLogin ?? null,
    status:     toTextStatus(a.status)
  }));
  
}



    // Keep current text/status filters
    if (typeof filterList === 'function') {
      filterList();
    } else if (typeof renderListTable === 'function') {
      renderListTable(window.listRowsAll);
    }
  } catch (e) {
    Toasts?.err?.(String(e.message || e));
  }
}
/* <<<<<<<<<<<<<<< RELOAD CURRENT LIST (END) <<<<<<<<<<<<<<< */
document.querySelectorAll('[data-open="modal-list-accounts"]').forEach(btn => {
  btn.addEventListener('click', async () => {
    listType = (btn.dataset.kind === 'adviser') ? 'adviser'
            : (btn.dataset.kind === 'admin')   ? 'admin'
            : (btn.dataset.kind === 'club')    ? 'club'
            : 'student';
  // --- Organization: let the generic modal open + wrapped loadList handle it ---
if (btn.dataset.kind === 'organization') {
  window.listType = 'organization';
  listModal?.setAttribute('data-kind', 'organization');
  listTitle.textContent = 'Organizations';
  // Do not run the legacy student/adviser/admin/club fetch below.
  return;
}


    // Fix: sync global window.listType for reloadCurrentList()
    window.listType = listType;

    listModal?.setAttribute('data-kind', listType);
    listTitle.textContent = listType==='adviser' ? 'Advisers'
                          : listType==='admin'   ? 'Admins'
                          : listType==='club'    ? 'Clubs' : 'Students';

    // decide endpoint
    const endpoint = (listType==='student')  ? '/api/students/list.php'
                    : (listType==='adviser') ? '/api/advisers/list.php'
                    : (listType==='admin')   ? '/api/admins/list.php'
                    :                          '/api/clubs/list_admin.php';

    try {
      const params  = (listType==='club') ? '?limit=200' : '?status=all&limit=200';
      const payload = await apiGet(`${endpoint}${params}`);
      const items   = payload?.items || payload?.rows || payload?.data || (Array.isArray(payload) ? payload : []);

      // helper to coerce status to 'active'|'archived'
      const toTextStatus = (v) => {
        const s = String(v ?? 'active').toLowerCase();
        if (s === '1') return 'active';
        if (s === '0') return 'archived';
        return (s === 'active' || s === 'archived') ? s : 'active';
      };

      if (listType === 'club') {
        // clubs often come back with numeric id
        listRowsAll = items.map(c => ({
          club_id: String(c.club_id ?? c.id ?? ''),
          name: c.name ?? c.club_name ?? '',
          tags: c.category ?? c.tags ?? '',
          adviser_email: c.adviser_email ?? c.sti_email ?? '',
          status: toTextStatus(c.status)
        }));
      } else if (listType === 'student') {
        listRowsAll = items.map(s => ({
          student_id: String(s.student_id ?? s.id ?? s.studentId ?? ''),
          first_name: s.first_name ?? s.firstName ?? '',
          middle_name: s.middle_name ?? s.middleName ?? '',
          last_name:  s.last_name ?? s.lastName ?? '',
          sti_email:  s.sti_email ?? s.email ?? s.stiEmail ?? '',
          last_login: s.last_login ?? s.lastLogin ?? null,
          status:     toTextStatus(s.status)
        }));
      } else if (listType === 'adviser') {
        listRowsAll = items.map(a => ({
          adviser_id: String(a.adviser_id ?? a.id ?? a.adviserId ?? ''),
          first_name: a.first_name ?? a.firstName ?? '',
          middle_name: a.middle_name ?? a.middleName ?? '',
          last_name:  a.last_name ?? a.lastName ?? '',
          sti_email:  a.sti_email ?? a.email ?? a.stiEmail ?? '',
          last_login: a.last_login ?? a.lastLogin ?? null,
          status:     toTextStatus(a.status)
        }));
      } else { // admin
        listRowsAll = items.map(a => ({
          admin_id:   String(a.admin_id ?? a.id ?? a.adminId ?? ''),
          first_name: a.first_name ?? a.firstName ?? '',
          middle_name: a.middle_name ?? a.middleName ?? '',
          last_name:  a.last_name ?? a.lastName ?? '',
          sti_email:  a.sti_email ?? a.email ?? a.stiEmail ?? '',
          last_login: a.last_login ?? a.lastLogin ?? null,
          status:     toTextStatus(a.status)
        }));
      }
    } catch (err) {
      listRowsAll = [];
      Toasts.err(String(err.message || err));
    }

    listSearch.value = '';
    setListModalLong(false);               // start compact
    renderListTable(listRowsAll);
    ensureStatusFilter(true);   
    filterList();
    listModal.setAttribute('aria-hidden','false');
    listSearch.value = '';
    setListModalLong(false);  
    listStatus = 'active';
    ensureStatusFilter(); 
    filterList(); 
    listModal.setAttribute('aria-hidden','false');
  });
});

/* >>>>>>>>>>>>>>> RELOAD CURRENT LIST (ADD AFTER filterList) >>>>>>>>>>>>>>> */
async function reloadCurrentList() {
  try {
    const kind = window.listType; // 'student' | 'adviser' | 'admin' | 'club'
    console.log('reloadCurrentList called for:', kind); // Debug log
    if (!kind) return;

    const endpoint =
      (kind === 'student') ? '/api/students/list.php' :
      (kind === 'adviser') ? '/api/advisers/list.php' :
      (kind === 'admin')   ? '/api/admins/list.php'   :
                             '/api/clubs/list_admin.php';

    const params  = (kind === 'club') ? '?limit=200' : '?status=all&limit=200';
    const payload = await apiGet(`${endpoint}${params}`);
    const items   = payload?.items || payload?.rows || payload?.data || (Array.isArray(payload) ? payload : []);

    const toTextStatus = (v) => {
      const s = String(v ?? 'active').toLowerCase();
      if (s === '1') return 'active';
      if (s === '0') return 'archived';
      return (s === 'active' || s === 'archived') ? s : 'active';
    };

    if (kind === 'club') {
      window.listRowsAll = items.map(c => ({
        club_id: String(c.club_id ?? c.id ?? ''),
        name: c.name ?? c.club_name ?? '',
        tags: c.category ?? c.tags ?? '',
        adviser_email: c.adviser_email ?? c.sti_email ?? '',
        status: toTextStatus(c.status)
      }));
   } else if (listType === 'student') {
  listRowsAll = items.map(s => ({
    student_id: String(s.student_id ?? s.id ?? s.studentId ?? ''),
    first_name: s.first_name ?? s.firstName ?? '',
    middle_name: s.middle_name ?? s.middleName ?? '',
    last_name:  s.last_name ?? s.lastName ?? '',
    sti_email:  s.sti_email ?? s.email ?? s.stiEmail ?? '',
    last_login: s.last_login ?? s.lastLogin ?? null,
    status:     toTextStatus(s.status)
  }));
} else if (listType === 'adviser') {
  listRowsAll = items.map(a => ({
    adviser_id: String(a.adviser_id ?? a.id ?? a.adviserId ?? ''),
    first_name: a.first_name ?? a.firstName ?? '',
    middle_name: a.middle_name ?? a.middleName ?? '',
    last_name:  a.last_name ?? a.lastName ?? '',
    sti_email:  a.sti_email ?? a.email ?? a.stiEmail ?? '',
    last_login: a.last_login ?? a.lastLogin ?? null,
    status:     toTextStatus(a.status)
  }));
  } else if (kind === 'organization') {
  window.listRowsAll = items.map(o => ({
    id:    String(o.id ?? o.org_id ?? ''),
    name:  o.name ?? o.org_name ?? '',
    type:  o.type ?? o.category ?? '',
    clubs: Number(o.clubs ?? o.club_count ?? 0),
    status: (String(o.status ?? 'active').toLowerCase()==='archived' ? 'archived' : 'active')
  }));

} else { // admin
  listRowsAll = items.map(a => ({
    admin_id:   String(a.admin_id ?? a.id ?? a.adminId ?? ''),
    first_name: a.first_name ?? a.firstName ?? '',
    middle_name: a.middle_name ?? a.middleName ?? '',
    last_name:  a.last_name ?? a.lastName ?? '',
    sti_email:  a.sti_email ?? a.email ?? a.stiEmail ?? '',
    last_login: a.last_login ?? a.lastLogin ?? null,
    status:     toTextStatus(a.status)
  }));
}
    ensureStatusFilter();   // keep pill selection text in sync
if (typeof filterList === 'function') filterList();
else if (typeof renderListTable === 'function') renderListTable(window.listRowsAll);

    if (typeof filterList === 'function') {
      filterList();
    } else if (typeof renderListTable === 'function') {
      renderListTable(window.listRowsAll);
    }
  } catch (e) {
    Toasts?.err?.(String(e.message || e));
  }
}
/* <<<<<<<<<<<<<<< RELOAD CURRENT LIST (END) <<<<<<<<<<<<<<< */

// filter while typing
listSearch?.addEventListener('input', filterList);

// Archive / Activate via CONFIRM MODAL (demo)
listWrap.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const action = btn.dataset.action;   
  
    const row = listRowsShown[Number(btn.dataset.idx)];
  if (!row) return;

const idKey = (listType === 'adviser'      ? 'adviser_id' :
               listType === 'admin'        ? 'admin_id'   :
               listType === 'club'         ? 'club_id'    :
               listType === 'organization' ? 'id'         :
                                             'student_id');


const idVal = row[idKey];
const full  = (listType === 'club')
  ? (row.name || '')
  : `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();

pendingArchive = { action, type:listType, idKey, idVal, fullName: full };

// Dynamically set the modal title
const titleEl = confirmArchModal.querySelector('.modal-head h3');
if (action === 'delete') {
  titleEl.textContent = (listType === 'club') ? 'Delete club?' :
                        (listType === 'organization') ? 'Delete organization?' :
                        'Delete account?';
} else {
  const isActivate = (action === 'activate');
  titleEl.textContent = (listType === 'club')
    ? (isActivate ? 'Activate club?' : 'Archive club?')
    : (listType === 'organization')
      ? (isActivate ? 'Activate organization?' : 'Archive organization?')
      : (isActivate ? 'Activate account?' : 'Archive account?');
}

  
  // 'archive' | 'activate'
  // When deleting, reuse the same modal but with delete copy and danger style
if (action === 'delete') {
  archMsg.textContent = `Delete ${full} (${idVal})?`;
  btnArchConfirm.textContent = 'Delete';
  btnArchConfirm.classList.remove('btn-success');
  btnArchConfirm.classList.add('btn-danger');
  const archNote = confirmArchModal.querySelector('.modal-body .muted');
  if (archNote) archNote.textContent = 'This will permanently remove the record. This action cannot be undone.';
} else {
  const isActivate = action === 'activate';
  archMsg.textContent = `${isActivate ? 'Activate' : 'Archive'} ${full} (${idVal})?`;
  btnArchConfirm.textContent = isActivate ? 'Activate' : 'Archive';
  btnArchConfirm.classList.toggle('btn-danger', !isActivate);
  btnArchConfirm.classList.toggle('btn-success', isActivate);
  const archNote = confirmArchModal.querySelector('.modal-body .muted');
  if (archNote) {
    archNote.textContent = (listType === 'club')
      ? (isActivate ? 'This will restore the club.' : 'This will archive the club. It will be hidden until restored.')
      : (isActivate ? 'This will re-enable the user’s login.' : 'This will disable the user’s login until restored.');
  }
}

// show modal
confirmArchModal.hidden = false;
confirmArchModal.style.removeProperty('display');
confirmArchModal.setAttribute('aria-hidden','false');
showEl(confirmArchModal);


});

btnArchConfirm?.addEventListener('click', async () => {
  if (!pendingArchive) return;
  const { action, type, idKey, idVal } = pendingArchive;

    // --- Hard delete branch (students/advisers/admins/clubs/organizations) ---
  if (action === 'delete') {
    const module =
      (type === 'admin')        ? 'admins' :
      (type === 'club')         ? 'clubs'  :
      (type === 'organization') ? 'organizations' :
                                  `${type}s`;

    const url = `/api/${module}/delete.php`;
    try {
const payload =
  (type === 'club' || type === 'organization')
    ? { id: idVal }          // these delete.php expect `id`
    : { [idKey]: idVal };    // others keep their *_id

await apiPostJSON(url, payload);


      // remove from in-memory lists immediately
      const same = r => String(r[idKey]) !== String(idVal);
      listRowsAll   = (listRowsAll   || []).filter(same);
      listRowsShown = (listRowsShown || []).filter(same);

      // Re-render with current filters (or full list if needed)
      if (typeof filterList === 'function') filterList();
      else if (typeof renderListTable === 'function') renderListTable(listRowsAll);

      // Close modal and toast
      const confirmModal = document.getElementById('modal-archive-confirm');
      confirmModal?.setAttribute('aria-hidden','true');
      pendingArchive = null;
      Toasts.ok('Deleted');

      // Hard refresh from server to stay in sync
      await reloadCurrentList();
      return; // stop here; archive/activate branch below shouldn’t run
    } catch (err) {
      Toasts.err(String(err.message || err));
      return;
    }
  }


  const numeric = (action === 'archive') ? '0' : '1';
  const payload = { [idKey]: idVal, status: numeric };
  const module  = (type === 'admin') ? 'admins' : (type === 'club') ? 'clubs' : `${type}s`;
  const url     = `/api/${module}/status.php`;

  try {
    // 1) Server update
    await apiPostJSON(url, payload);
    Toasts.ok(action === 'archive' ? 'Archived' : 'Activated');

    // 2) Optimistic in-memory update so the table changes immediately
    const toStatus = (action === 'archive') ? 'archived' : 'active';
    const mutate = (row) => {
      if (!row) return;
      row.status = toStatus;
    };
    (listRowsAll   || []).forEach(r => { if (String(r[idKey]) === String(idVal)) mutate(r); });
    (listRowsShown || []).forEach(r => { if (String(r[idKey]) === String(idVal)) mutate(r); });
    // Re-render with current filters
    if (typeof filterList === 'function') filterList();
    else if (typeof renderListTable === 'function') renderListTable(listRowsAll);

    // 3) Close confirm modal
    const confirmModal = document.getElementById('modal-archive-confirm');
    confirmModal?.setAttribute('aria-hidden','true');
    pendingArchive = null;

    // 4) Hard refresh from server (now with cache-buster)
    await reloadCurrentList();

    // (Optional) tiny reflow nudge
    if (listWrap) {
      listWrap.style.display = 'none';
      void listWrap.offsetHeight;
      listWrap.style.display = '';
      listWrap.scrollTop = 0;
    }
    // Ensure list modal remains visible
    listModal?.setAttribute('aria-hidden', 'false');
  } catch (err) {
    Toasts.err(String(err.message || err));
  }
});



// ============== Admin Create / Reset ==============
(function autoAdminPassword(){
  const form = document.getElementById('form-admin-create');
  if (!form) return;
  const lnEl = form.querySelector('input[name="last_name"]');
  const pwEl = form.querySelector('input[name="password"]');
  if (!lnEl || !pwEl) return;

  let touched=false, lastAuto='';
  const make = () => {
    const last = (lnEl.value||'').trim().toLowerCase().replace(/\s+/g,'');
    return last ? `${last}_admin` : '';
  };
  const refresh = () => {
    const auto = make(); if (!auto) return;
    if (!touched || pwEl.value === lastAuto){ pwEl.value = auto; lastAuto = auto; }
  };
  lnEl.addEventListener('input', refresh);
  pwEl.addEventListener('input', () => touched=true);

  // The submit handler for form-admin-create is now handled by the new code block above.
  // This block is kept for the auto-password functionality.
})();

// ======================= Admin Reset: ID-only + eye icon =======================
(function enhanceAdminResetById(){
  const form = document.getElementById('form-admin-reset');
  if (!form) return;

  const idEl = form.querySelector('input[name="identifier"]');
  const pwEl = form.querySelector('input[name="new_password"]');
  if (!idEl || !pwEl) return;

  // Make it look like the other reset modals
  try { idEl.type = 'text'; } catch {}
  idEl.placeholder = 'Admin ID (e.g., 2000123456)';
  pwEl.readOnly = true;
  pwEl.type = 'password';
  pwEl.placeholder = 'Temporary Password';

  // Ensure the password has the shared eye icon & wrapper (same as others)
  const pwLabel = pwEl.closest('label') || pwEl.parentElement;
  let wrap = pwEl.parentElement;
  if (!wrap || !wrap.classList.contains('pw-wrap')) {
    wrap = document.createElement('div');
    wrap.className = 'pw-wrap';
    pwLabel.insertBefore(wrap, pwEl);
    wrap.appendChild(pwEl);
  }
  if (!wrap.querySelector('.pw-ico')) {
    const icoBtn = document.createElement('button');
    icoBtn.type = 'button';
    icoBtn.className = 'pw-ico';
    icoBtn.setAttribute('aria-label', 'Show password');
    icoBtn.setAttribute('aria-pressed', 'false');
    icoBtn.innerHTML = ICON_EYE; // same icon constant you already use
    wrap.appendChild(icoBtn);
  }

  // --- Note directly under the Admin ID field (same element/class as others)
let note = document.getElementById('admin-reset-note');
if (!note) {
  note = document.createElement('small');
  note.id = 'admin-reset-note';
  note.className = 'field-note';   // <-- IMPORTANT: use field-note
  idEl.insertAdjacentElement('afterend', note);
}

// later when updating the message:
const setNote = (msg, ok = true) => {
  note.textContent = msg || '';
  note.classList.toggle('error', !ok);   // adds .error to flip to red
};


  // Helpers
  const last6 = s => String(s||'').replace(/\D/g,'').slice(-6);

  // Same shape as student/adviser lookup
  async function fetchAdminLastName(adminId){
    try {
      const res = await fetch(`/api/admins/lookup.php?admin_id=${encodeURIComponent(adminId)}`);
      if (!res.ok) return null;
      const data = await res.json().catch(()=>null);
      return data?.last_name || data?.item?.last_name || data?.admin?.last_name || null;
    } catch { return null; }
  }

  let inflight = 0;
  async function refresh(){
    const raw = idEl.value.trim();
    if (!raw){ pwEl.value=''; setNote(''); return; }

    const suf = last6(raw);
    if (suf.length < 6){
      pwEl.value = '';
      setNote('Enter a valid Admin ID (need last 6 digits).', false);
      return;
    }

    inflight++; const ticket = inflight;
    setNote('Looking up admin…');

    const last = await fetchAdminLastName(raw);
    if (ticket !== inflight) return;

    if (!last){
      pwEl.value = '';
      setNote('Admin not found. Please check the ID.', false);
      return;
    }

    setNote(`Last name: ${last}`, true);
    pwEl.value = `${String(last).toLowerCase().replace(/\s+/g,'')}_admin`;
  }

  let t;
  idEl.addEventListener('input', () => { clearTimeout(t); t = setTimeout(refresh, 250); });
  idEl.addEventListener('blur', refresh);
})();




// Generic show/hide for ANY .pw-ico (covers create student/adviser, and now admin reset too)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.pw-ico');
  if (!btn) return;

  const input = btn.closest('.pw-wrap')?.querySelector('input');
  if (!input) return;

  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.setAttribute('aria-pressed', show ? 'true' : 'false');

  // Ensure the icon is set correctly based on the new state
  btn.innerHTML = show ? ICON_EYE_OFF : ICON_EYE;
});


// === Admin reset: ID-only validation & inline error ===
(() => {
  const form = document.getElementById('form-admin-reset');
  if (!form) return;

  const idInput = form.elements.identifier;
  const err = document.getElementById('admin-reset-error');

  // Clear error while typing
  idInput.addEventListener('input', () => {
    if (err) err.hidden = true, err.textContent = '';
  });

  form.addEventListener('submit', (ev) => {
    const id = (idInput.value || '').trim();
    // Require STI-style admin ID (2000xxxxxx)
    if (!/^2000\d{6}$/.test(id)) {
      ev.preventDefault();
      if (err) {
        err.textContent = 'Please enter a valid Admin ID (e.g., 2000123456).';
        err.hidden = false;
      }
      idInput.focus();
      return;
    }
    // If you had server-side submit or fetch, it continues as-is.
  });
})();

// The original form-admin-create submit handler is replaced by the one above
// that uses closeModalFromForm.
/*
document.getElementById('form-admin-create')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  try {
    await apiPostForm('api/admins/create.php', fd);
    Toasts.ok('Admin created');
    e.currentTarget.reset();
    e.currentTarget.closest('.modal')?.setAttribute('aria-hidden', 'true');
  } catch (err) {
    Toasts.err(String(err?.message || err));
  }
});
*/

/* ============================================================
   KEEP RESET MODALS OPEN + CLEAN UX AFTER SUBMIT (ALL THREE)
   ============================================================ */



(function wireAllResetModals() {
  // Describe each reset modal in one place
  const cfgs = [
    { kind: 'students', modal: '#modal-reset-student', idKeys: ['student_id', 'sti_email'] },
    { kind: 'advisers', modal: '#modal-reset-adviser', idKeys: ['adviser_id', 'sti_email'] },
    { kind: 'admins',   modal: '#modal-reset-admin',   idKeys: ['admin_id'] }
  ];

  // Small helpers
  const qs  = (root, sel) => root ? root.querySelector(sel) : null;
  const qsa = (root, sel) => root ? Array.from(root.querySelectorAll(sel)) : [];

  // Hide a hint/tooltip under the ID field
  function hideHint(modal) {
    const hint = qs(modal, '.js-id-hint, .id-hint, .form-note, .lookup-hint');
    if (hint) {
      hint.textContent = '';
      hint.classList.remove('is-error', 'text-danger', 'text-red-700');
      // keep the space for layout to match your “Last name: …” row look
      // (no-op if your CSS doesn’t need it)
    }
  }

  // Show a hint/tooltip (error = red) or neutral text (lastname)
  function showHint(modal, text, asError = false) {
    const hint = qs(modal, '.js-id-hint, .id-hint, .form-note, .lookup-hint');
    if (!hint) return;
    hint.textContent = text || '';
    hint.classList.toggle('is-error', !!asError);
    hint.classList.toggle('text-danger', !!asError); // your CSS already colors this red
  }

  // Keep overlay from closing when clicking Reset
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button, input[type="submit"]');
    if (!btn) return;

    // If the button is inside any reset modal, prevent bubbling to any global modal-close handler
    if (btn.closest('#modal-reset-student, #modal-reset-adviser, #modal-reset-admin')) {
      ev.stopPropagation();
    }
  }, true); // capture phase so we beat global handlers

  cfgs.forEach((cfg) => {
    const modal = document.querySelector(cfg.modal);
    if (!modal) return;

    const form = qs(modal, 'form');
    if (!form) return;

    // Inputs
    const idInput  = qs(modal, 'input[name="student_id"], input[name="adviser_id"], input[name="admin_id"], input[type="text"]');
    const passInput = qs(modal, 'input[type="password"], input[name="new_password"]');

    // (1) Don’t close modal on submit; do async reset; clear pwd; keep ID; hide tooltip on success
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const idVal  = (idInput?.value || '').trim();
      const pwdVal = (passInput?.value || '').trim();

      // Very light client validation (don’t set "not found" here)
      if (!idVal || !pwdVal) {
        showHint(modal, 'Please enter both ID and a new password.', true);
        return;
      }

      try {
        const url = `/api/${cfg.kind}/reset_password.php`;
        const body = new URLSearchParams();

        // Send the ID value using every key that endpoint accepts (safe & simple)
        cfg.idKeys.forEach((k) => body.append(k, idVal));
        body.append('new_password', pwdVal);

        const res = await fetch(url, { method: 'POST', body });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || data.ok === false) {
          // Honor server message if available
          const msg = (data && (data.error || data.message)) || 'Reset failed.';
          showHint(modal, msg, true);
          return; // keep modal open
        }

        // Success: clear ONLY the password, keep the ID; remove any error tooltip
        passInput.value = '';
        hideHint(modal);

        // Optional: give a small success toast; replace with your own toaster
        try { window.toast && window.toast.success && window.toast.success('Password updated'); } catch {}
      } catch (err) {
        showHint(modal, 'Network error. Please try again.', true);
      }
    });

    // (2) While typing the ID again, clear “not found” tooltip (don’t fight the user)
    if (idInput) {
      idInput.addEventListener('input', () => hideHint(modal));
    }
  });
})();




/* Auto-fill admin password: lastname_admin */
(function autoAdminPassword(){
  const form = document.getElementById('form-admin-create');
  if (!form) return;
  const lnEl = form.querySelector('input[name="last_name"]');
  const pwEl = form.querySelector('input[name="password"]');
  if (!lnEl || !pwEl) return;

  let touched = false, lastAuto = '';
  const compute = () => {
    const last = (lnEl.value || '').trim().toLowerCase().replace(/\s+/g,'_');
    return last ? `${last}_admin` : '';
  };
  function refresh(){
    const auto = compute();
    if (!auto) return;
    if (!touched || pwEl.value === lastAuto){ pwEl.value = auto; lastAuto = auto; }
  }
  lnEl.addEventListener('input', refresh);
  pwEl.addEventListener('input', () => { touched = true; });
})();

// === RESET MODALS: keep open, clear fields + tooltips, and avoid duplicate handlers ===
(function hardenResetModals(){
  function clearUI(scope){
    const idEl = scope.querySelector('input[name="identifier"]');
    const pwEl = scope.querySelector('input[name="new_password"]');
    if (idEl) { idEl.value = ''; setTooltip(idEl, ''); }
    if (pwEl) { pwEl.value = ''; }

    // Clear inline notes/tooltips if present
    const ids = ['student-reset-note','student-reset-tip','adviser-reset-note','admin-reset-note','admin-reset-error'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = ''; el.hidden = true; el.classList.remove('error'); }
    });
  }

function timeAgo(ts) {
  if (!ts) return '—';
  const t = new Date(ts).getTime(); if (isNaN(t)) return '—';
  let diff = Math.abs(Date.now() - t);

  const s=1e3, m=60*s, h=60*m, d=24*h, mo=30*d, y=365*d;
  if (diff < s) return Math.floor(diff/1) + 'ms ago';
  if (diff < m) return Math.floor(diff/s) + 's ago';
  if (diff < h) return Math.floor(diff/m) + 'm ago';
  if (diff < d) {
    const hrs = Math.floor(diff/h); diff -= hrs*h;
    const mins = Math.floor(diff/m);
    return hrs + 'hr' + (mins ? ' ' + mins + 'm' : '') + ' ago';
  }
  if (diff < mo) return Math.floor(diff/d) + 'd ago';
  if (diff < y)  return Math.floor(diff/mo) + 'mo ago';
  return Math.floor(diff/y) + 'y ago';
}


  function wire(formId, endpoint, idField){
    const form = document.getElementById(formId);
    if (!form) return;

    // Capture-phase listener cancels earlier bubbling listeners that close the modal or show demo errors
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation(); // cancel any other submit handlers bound earlier

      const id  = form.querySelector('input[name="identifier"]')?.value.trim();
      const pwd = form.querySelector('input[name="new_password"]')?.value.trim();
      if (!id || !pwd) { Toasts.warn('ID and password are required'); return; }

      const fd = new FormData();
      fd.append(idField, id);
      fd.append('password', pwd);

      try {
        await apiPostForm(endpoint, fd);
        Toasts.ok('Password reset');
        clearUI(form);             // keep the modal OPEN, just clear fields/tooltips
      } catch (err) {
        Toasts.err(String(err.message || err));
      }
    }, true);
  }

  wire('form-student-reset', 'api/students/reset.php', 'student_id');
  wire('form-adviser-reset', 'api/advisers/reset.php', 'adviser_id');
  wire('form-admin-reset',   'api/admins/reset.php',   'admin_id');
})();

// ----- Dashboard modal -----
(() => {
  const dlg = document.getElementById('modal-admin-dashboard');
if (!dlg) return;


// tab switching
dlg.addEventListener('click', (e) => {
  const tab = e.target.closest('.db-tab');
  if (!tab) return;
  dlg.querySelectorAll('.db-tab').forEach(t => t.classList.toggle('is-active', t === tab));
  const pane = tab.getAttribute('data-pane');
  dlg.querySelectorAll('.db-pane').forEach(p => p.classList.toggle('is-active', p.getAttribute('data-pane') === pane));
});

// open → render
document.querySelectorAll('[data-open="modal-admin-dashboard"]').forEach(btn => {
  btn.addEventListener('click', () => {
    dlg.setAttribute('aria-hidden', 'false');
    renderDashboard();
  });
});

function pct(n, d) {
  n = Number(n) || 0;
  d = Number(d) || 0;
  if (d <= 0) return 0;
  return Math.round((n / d) * 100);
}


  // tiny “card” component
  function card(title, value, sub, pct){
    const el = document.createElement('div');
    el.className = 'metric-card';
    el.innerHTML = `
      <h4>${title}</h4>
      <div class="big">${value}</div>
      ${sub ? `<div class="sub">${sub}</div>` : ''}
      <div class="bar" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,pct||0))}%"></i></div>
    `;
    return el;
  }

  function monthStart(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }

  function countCreated(arr){
    const now = new Date();
    const last30 = now.getTime() - 30*24*60*60*1000;
    let total = 0, created30 = 0, active = 0, archived = 0;
    for (const x of (arr || [])) {
      total++;
      const c = x.created_at || x.createdAt;
      if (c) {
        const t = new Date(String(c).replace(' ','T')).getTime();
        if (!isNaN(t) && t >= last30) created30++;
      }
      const s = String(x.status ?? '').toLowerCase();
      if (s === 'archived' || s === '0') archived++; else active++;
    }
    return { total, created30, active, archived };
  }

  function countLastLogin(arr){
    const now = Date.now(), d7 = now - 7*24*60*60*1000, d30 = now - 30*24*60*60*1000;
    let week = 0, month = 0, ever = 0;
    for (const x of (arr || [])) {
      const v = x.last_login || x.lastLogin;
      if (!v) continue;
      const t = new Date(String(v).replace(' ','T')).getTime();
      if (isNaN(t)) continue;
      ever++;
      if (t >= d7)  week++;
      if (t >= d30) month++;
    }
    return { week, month, ever };
  }

  const Q = sel => dlg.querySelector(sel);
  const makeArray = p => (p?.items || p?.rows || p?.data || (Array.isArray(p) ? p : []));

  async function fetchAll(){
    const [Sres, Ares, Cres] = await Promise.all([
      fetch('/api/students/list.php?status=all&limit=2000', {credentials:'include'}).then(r=>r.json()).catch(()=>null),
      fetch('/api/advisers/list.php?status=all&limit=2000',{credentials:'include'}).then(r=>r.json()).catch(()=>null),
      fetch('/api/clubs/list_admin.php?limit=2000',       {credentials:'include'}).then(r=>r.json()).catch(()=>null),
    ]);
    return [makeArray(Sres), makeArray(Ares), makeArray(Cres)];
  }

  function renderPane(name, nodes){
    const pane = Q(`.db-pane[data-pane="${name}"] .db-grid`);
    if (!pane) return;
    pane.innerHTML = '';
    nodes.forEach(n => pane.appendChild(n));
  }

  async function renderDashboard(){
    const modal = document.getElementById('modal-dashboard');
    const [S, A, C] = await fetchAll();
    // roll-ups
    const Sm = countCreated(S), Am = countCreated(A), Cm = countCreated(C);
    const Sl = countLastLogin(S), Al = countLastLogin(A);

    
    // Clubs-only helpers
const catCount = new Set(
  (Array.isArray(C) ? C : []).map(c => String(c.category ?? c.tags ?? '').trim()).filter(Boolean)
).size;

const clubsNoAdv = (Array.isArray(C) ? C : []).filter(
  c => !String(c.adviser_email ?? c.sti_email ?? '').trim()
).length;

// ---- extra derivations for Clubs
const categories = new Set(
  (Array.isArray(C) ? C : [])
    .map(c => (c.category || c.tags || '').trim())
    .filter(Boolean)
);
const clubsWithoutAdviser = (Array.isArray(C) ? C : [])
  .filter(c => !c.adviser_id && !c.adviser_email).length;

// small helper (used in Clubs cards)
const pct = (n, d) => Math.round(((Number(n) || 0) / ((Number(d) || 1))) * 100);


    // GENERAL
    renderPane('general', [
      card('Total accounts',
           (Sm.total + Am.total).toLocaleString(),
           `${Sm.total} students • ${Am.total} advisers`, 100),
      card('Active %',
           `${Math.round(((Sm.active+Am.active)/((Sm.total+Am.total)||1))*100)}%`,
           `${Sm.active} students • ${Am.active} advisers`,
           ((Sm.active+Am.active)/((Sm.total+Am.total)||1))*100),
      card('New (30d)',
           (Sm.created30 + Am.created30).toString(),
           `${Sm.created30} students • ${Am.created30} advisers`,
           ((Sm.created30+Am.created30)/((Sm.total+Am.total)||1))*100),
      card('Logged in (7d)',
           (Sl.week + Al.week).toString(),
           `${Sl.month + Al.month} in 30d`, 100),
      card('Clubs',
           Cm.total.toString(),
           `${Cm.active} active • ${Cm.archived} archived`,
           (Cm.active/(Cm.total||1))*100),
    ]);

    // After renderPane('general', [ ... ]);
// Top clubs (by members) — async, DB-backed, safe
// --- Top clubs (by members) ------------------------------
// General → Top clubs (by members) — fetch from API so it works even
// if the Clubs tab hasn't been opened yet.

(() => {
  const modal = document.getElementById('modal-admin-dashboard');
  if (!modal) return;

  const fmt = (n) => (Number(n) || 0).toLocaleString();

  function mount() {
    const grid = modal.querySelector('.db-pane[data-pane="general"] .db-grid');
    if (!grid) return false;

    // Title
    const head = document.createElement('div');
    head.className = 'metric-section-title';
    head.textContent = 'Students & Advisers (general)';
    grid.appendChild(head);

    // Row
    const row = document.createElement('div');
    row.className = 'metric-row';
    row.style.gridColumn = '1 / -1';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = 'repeat(auto-fill, minmax(260px, 1fr))';
    row.style.gap = '10px';
    grid.appendChild(row);

    (async () => {
      let gm = {};
      try {
        const j = await apiGet('api/metrics/general.php');
        gm = j && j.metrics ? j.metrics : j || {};
      } catch {}

      const studentsTotal   = Number(gm.students_total   || 0);
      const advisersTotal   = Number(gm.advisers_total   || 0);
      const clubsTotal      = Number(gm.clubs_total      || gm.clubs || 0);

      const inClubs         = Number(gm.students_in_clubs        || 0);
      const unaffiliated    = Number(gm.students_unaffiliated    || Math.max(0, studentsTotal - inClubs));
      const multiClub       = Number(gm.students_multi_club      || 0);
      const event30         = Number(gm.students_event_30d       || 0);

      const advWith         = Number(gm.advisers_with_club       || 0);
      const advWithout      = Number(gm.advisers_without_club    || Math.max(0, advisersTotal - advWith));

     const avgMembersPerAdvisedClub =
  (gm.avg_members_per_advised_club != null)
    ? gm.avg_members_per_advised_club
    : (gm.avg_students_per_adviser != null ? gm.avg_students_per_adviser : 0);
const avgStudPerAdv = avgMembersPerAdvisedClub; // same in 1:1, keep for backward compat
      const clubsPer100     = (gm.clubs_per_100_students   != null) ? gm.clubs_per_100_students   : (studentsTotal ? Math.round(100 * clubsTotal / studentsTotal) : 0);
      const ratioSA         = (gm.student_adviser_ratio    != null) ? gm.student_adviser_ratio    : (advisersTotal ? (studentsTotal / advisersTotal).toFixed(1) : '—');

      const partPct         = studentsTotal ? Math.round(100 * inClubs / studentsTotal) : 0;
      const advCovPct       = advisersTotal ? Math.round(100 * advWith / advisersTotal) : 0;

      const add = (title, big, sub='') => {
        const c = document.createElement('div');
        c.className = 'metric-card';
        c.innerHTML = `<h4>${title}</h4><div class="big">${big}</div><div class="sub">${sub}</div>`;
        row.appendChild(c);
      };

      // Students side
      add('Students in clubs', partPct + '%', `${fmt(inClubs)} of ${fmt(studentsTotal)} students`);
      add('Unaffiliated students', fmt(unaffiliated), 'no club membership');
      add('Student event participants (30d)', fmt(event30), 'unique students');

      // Advisers side
      add('Adviser coverage', advisersTotal ? (advCovPct + '%') : '—',
    `${fmt(advWith)} of ${fmt(advisersTotal)} advisers`);
add('Advised club size (avg)', String(avgMembersPerAdvisedClub), 'assigned advisers only');

      // Cross lenses
      add('Students per adviser', String(ratioSA), 'student : adviser');
      add('Clubs per 100 students', String(clubsPer100), '');
    })();

    return true;
  }

  if (!mount()) {
    const obs = new MutationObserver(() => { if (mount()) obs.disconnect(); });
    obs.observe(modal, { childList: true, subtree: true });
  }
})();

/* === Analytics Report (PDF export) ===================================== */
(() => {
  // --- tiny helpers (safe to keep if you already have them)
  function todayISO(d=new Date()){ return d.toISOString().slice(0,10); }
  function fmt(n){ return (n==null || isNaN(n)) ? '—' : new Intl.NumberFormat().format(Number(n)); }

  // load external script only once, with readiness test
  function loadScript(src, testFn){
    if (testFn && testFn()) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload  = () => ( !testFn || testFn() ) ? res() : rej(new Error('Library failed: '+src));
      s.onerror = () => rej(new Error('Load failed: '+src));
      document.head.appendChild(s);
    });
  }

  // --- data helpers (use your apiGet as-is)
  async function getGeneralMetrics(){
    const j = await window.apiGet('api/metrics/general.php');
    const gm = (j && (j.metrics||j)) || {};
    return {
      studentsTotal: Number(gm.students_total||0),
      advisersTotal: Number(gm.advisers_total||0),
      clubsTotal:    Number(gm.clubs_total||gm.clubs||0),
      inClubs:       Number(gm.students_in_clubs||0),
      unaffiliated:  Number(gm.students_unaffiliated||0),
      multiClub:     Number(gm.students_multi_club||0),
      event30:       Number(gm.students_event_30d||0),
      advWith:       Number(gm.advisers_with_club||0),
      advWithout:    Number(gm.advisers_without_club||0),
      avgMembersPerAdvisedClub: (gm.avg_members_per_advised_club!=null) ? Number(gm.avg_members_per_advised_club)
                                   : Number(gm.avg_students_per_adviser||0),
      clubsPer100:   Number(gm.clubs_per_100_students||0),
      ratioSA:       (gm.student_adviser_ratio!=null) ? gm.student_adviser_ratio : '—',
      created30Stu:  Number(gm.new_students_30d||gm.created30||0),
      created30Adv:  Number(gm.new_advisers_30d||0),
      logged7:       Number(gm.logged_in_7d||0),
    };
  }

  // counts members; will use your global fetchMembersCount if present
  async function getTopClubs(limit){
    const payload = await window.apiGet('api/clubs/list.php?limit=500');
    const clubs = (payload?.items || payload?.rows || payload?.data) || (Array.isArray(payload) ? payload : []);
    if (!clubs.length) return [];

    const results = [];
    const queue = clubs.slice();           // shallow copy
    const next  = () => queue.shift();

    // fallbacks
    const countMembers = window.fetchMembersCount || (async (clubId) => {
      const j = await window.apiGet(`api/clubs/members/list.php?club_id=${encodeURIComponent(clubId)}&limit=10000`);
      const items = j?.items || j?.rows || j?.data || (Array.isArray(j) ? j : []);
      return Array.isArray(items) ? items.length : Number(items?.count || 0) || 0;
    });

    async function worker(){
      let c; while ( (c = next()) ){
        const id = c.id ?? c.club_id ?? c.clubID;
        let count = Number(c.members || c.member_count || c.members_count || c.total_members || c.count || 0);
        if (!count) count = await countMembers(id);
        results.push({ name: c.name || c.club_name || '—', count });
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    results.sort((a,b)=> b.count - a.count);
    return results.slice(0, limit);
  }

    // --- appendix helpers -------------------------------------------------

  // Utility: normalize payload → array
function arr(v){
  if (Array.isArray(v)) return v;
  const p = v || {};
  const a = p.items || p.rows || p.data || p.results || p.students || p.advisers || p.members || p.clubs;
  return Array.isArray(a) ? a : [];
}


function qs(obj){
  return Object.entries(obj)
    .filter(([,v]) => v!=='' && v!=null)
    .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function fetchListAny(base, paramPairs){
  for (const params of paramPairs){
    try{
      const url = params ? `${base}?${qs(params)}` : base;
      const j = await apiGet(url + (url.includes('?') ? '&' : '?') + 'limit=10000');
      const a = arr(j);
      if (a.length) return a;
    }catch(_){}
  }
  return [];
}

  // Utility: try to read a created/join date from an item
function readDate(obj){
  if (!obj) return null;
  const fields = [
    'created_at','createdAt','date_created','created',
    'joined_at','joined','join_date','added_at','approved_at',
    'signup_date','registered_at','dateRegistered','dateAdded',
    'timestamp','ts'
  ];
  for (const k of fields){
    const v = obj[k];
    if (v == null) continue;
    let d;
    if (typeof v === 'number'){
      d = new Date(v < 10_000_000_000 ? v*1000 : v); // seconds→ms or ms
    } else {
      d = new Date(String(v).replace(' ', 'T'));
    }
    if (!isNaN(+d)) return d;
  }
  return null;
}



  // Fetch “new” people (students/advisers) and filter by [from,to] if dates exist
async function getNewPeople(which, fromISO, toISO){
  const ep = which === 'advisers' ? 'api/advisers/list.php' : 'api/students/list.php';
  const paramCandidates = fromISO || toISO ? [
    {from:fromISO, to:toISO},
    {date_from:fromISO, date_to:toISO},
    {created_from:fromISO, created_to:toISO},
    {start:fromISO, end:toISO},
    null // final: no params (get all, then client-filter)
  ] : [null];

  const rows = await fetchListAny(ep, paramCandidates);
  const from = fromISO ? new Date(fromISO+'T00:00:00') : null;
  const to   = toISO   ? new Date(toISO  +'T23:59:59') : null;

  const out = [];
  for (const r of rows){
    const d = readDate(r);
    const inRange = (!from && !to) || (d && (!from || d >= from) && (!to || d <= to));
    if ((from || to) && rows !== null && paramCandidates[0] !== null) {
      // if server already filtered (we got here with params), accept even if d missing
      if (!d && (from || to)) { /* accept */ } else if (!inRange) { continue; }
    } else {
      if (!inRange) continue;
    }
    const name = r.name || [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ') || r.full_name || '—';
    const email = r.sti_email || r.email || r.user_email || '';
    const id = r.student_id || r.adviser_id || r.id || '';
    out.push({ name, email, id, date: d ? d.toISOString().slice(0,10) : '' });
  }
  out.sort((a,b) => (a.date||'').localeCompare(b.date||''));
  return out;
}

// --- time helpers ---
function dateISO(d){ return new Date(d).toISOString().slice(0,10); }
function dAdd(d, days){ const x = new Date(d); x.setDate(x.getDate()+days); return x; }
function makeDateLabels(fromISO, toISO){
  const end = toISO ? new Date(toISO+'T00:00:00') : new Date();
  const start = fromISO ? new Date(fromISO+'T00:00:00') : dAdd(end, -29);
  const out = [];
  for (let d=new Date(start); d<=end; d.setDate(d.getDate()+1)) out.push(dateISO(d));
  return out;
}

// --- new accounts over time (uses your getNewPeople) ---
async function getNewAccountsSeries(fromISO, toISO){
  // re-use your existing appendix loaders
  const [stu, adv] = await Promise.all([
    typeof getNewPeople === 'function' ? getNewPeople('students', fromISO, toISO) : [],
    typeof getNewPeople === 'function' ? getNewPeople('advisers', fromISO, toISO) : []
  ]);

  const labels = makeDateLabels(fromISO, toISO);
  const mStu = Object.create(null), mAdv = Object.create(null);
  stu.forEach(r => { const k = r.date || dateISO(readDate?.(r) || new Date()); mStu[k] = (mStu[k]||0)+1; });
  adv.forEach(r => { const k = r.date || dateISO(readDate?.(r) || new Date()); mAdv[k] = (mAdv[k]||0)+1; });

  return {
    labels,
    dsStudents: labels.map(d => mStu[d]||0),
    dsAdvisers: labels.map(d => mAdv[d]||0)
  };
}

// --- club size distribution ---
async function getAllClubSizes(limit){
  const pl = await apiGet('api/clubs/list.php?limit='+(limit||500));
  const clubs = (pl?.items || pl?.rows || pl?.data) || (Array.isArray(pl)? pl : []);
  const sizes = [];
  // try to use existing counts first; only fall back to per-club fetch if missing
  const queue = clubs.slice();
  const WORKERS = 4;
  async function worker(){
    while (queue.length){
      const c = queue.shift();
      const id = c.id ?? c.club_id ?? c.clubID;
      let n = Number(c.members || c.member_count || c.members_count || c.total_members || c.count || 0);
      if (!n && typeof fetchMembersCount === 'function') n = await fetchMembersCount(id);
      sizes.push(n||0);
    }
  }
  await Promise.all(Array.from({length:WORKERS}, worker));
  return sizes;
}
function bucketClubSizes(sizes){
  const buckets = [
    {label:'0', test:n=>n===0},
    {label:'1–5', test:n=>n>=1 && n<=5},
    {label:'6–10', test:n=>n>=6 && n<=10},
    {label:'11–20', test:n=>n>=11 && n<=20},
    {label:'21–40', test:n=>n>=21 && n<=40},
    {label:'41–80', test:n=>n>=41 && n<=80},
    {label:'81+', test:n=>n>=81},
  ];
  return {
    labels: buckets.map(b=>b.label),
    counts: buckets.map(b=>sizes.filter(n=>b.test(n)).length)
  };
}


  // Fetch club members and filter by join/created date if present
async function getClubMembers(clubId, fromISO, toISO){
  if (!clubId) return [];
  const base = `api/clubs/members/list.php`;
  const paramCandidates = fromISO || toISO ? [
    {club_id:clubId, from:fromISO, to:toISO},
    {club_id:clubId, date_from:fromISO, date_to:toISO},
    {club_id:clubId, created_from:fromISO, created_to:toISO},
    {club_id:clubId, start:fromISO, end:toISO},
    {club_id:clubId}, // no date params
  ] : [{club_id:clubId}];

  const rows = await fetchListAny(base, paramCandidates);
  const from = fromISO ? new Date(fromISO+'T00:00:00') : null;
  const to   = toISO   ? new Date(toISO  +'T23:59:59') : null;

  const out = [];
  for (const r of rows){
    const d = readDate(r);
    const name = r.student_name || r.name || [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ') || '—';
    const email = r.sti_email || r.student_email || r.email || '';
    const sid = r.student_id || r.id || '';
    const inRange = (!from && !to) || (d && (!from || d >= from) && (!to || d <= to));

    // if server filtered (we used date params) accept rows even if timestamp not shipped
    if ((from || to) && paramCandidates[0] && ('from' in paramCandidates[0] || 'date_from' in paramCandidates[0] || 'created_from' in paramCandidates[0] || 'start' in paramCandidates[0])) {
      out.push({ name, email, id: sid, date: d ? d.toISOString().slice(0,10) : '' });
    } else {
      if (inRange) out.push({ name, email, id: sid, date: d ? d.toISOString().slice(0,10) : '' });
    }
  }
  out.sort((a,b) => (a.date||'').localeCompare(b.date||''));
  return out;
}

  // Write a simple multi-page list to the PDF
function writeList(doc, title, rows, margin, y, pageW){
  // colors
  const TXT=[17,24,39], MUT=[107,114,128], B=[229,231,235], HEAD=[243,244,246], CARD=[248,250,252];
  // page metrics
  const pageH = doc.internal.pageSize.getHeight ? doc.internal.pageSize.getHeight() : 792;
  const maxW  = pageW - margin*2;
const pad = 10, headH = 22, rowH = 18, bottomPad = 46, titleH = 14;

  const list = Array.isArray(rows) ? rows : [];

  // columns (with counter first)
const cols = [
  { label:'#',     key:'idx',   w: 28 },
  { label:'ID',    key:'id',    w: 90 },
  { label:'Name',  key:'name',  w: 200 }, // was 210
  { label:'Email', key:'email', w: 270 }, // was 260 → starts ~10px earlier
  { label:'Date',  key:'date',  w: 90 },
];

  // how many rows fit if the card starts at y (no title here)
  const capacityAt = yPos => {
    const usable = pageH - bottomPad - (yPos + pad*2 + headH);
    return Math.max(0, Math.floor(usable / rowH));
  };

  // ensure we have room for title + at least 1 row; if not, new page FIRST
  if (capacityAt(y + titleH) < 1) { doc.addPage(); y = margin; }

  // title with total
  doc.setFont('helvetica','bold'); doc.setFontSize(13);
  doc.setTextColor(TXT[0],TXT[1],TXT[2]);
  doc.text(`${title} (${list.length})`, margin, y);
  y += titleH;

  // empty state
  if (!list.length){
    doc.setFont('helvetica','italic'); doc.setFontSize(11);
    doc.setTextColor(MUT[0],MUT[1],MUT[2]);
    doc.text('— none in selected range —', margin, y);
    return y + 16;
  }

  

  let i = 0;
  while (i < list.length){
    // rows that fit on this page for a card starting at y
    let can = capacityAt(y);
    if (can < 1){
      // go to next page BEFORE drawing anything (avoids orphaned text)
      doc.addPage(); y = margin;
      doc.setFont('helvetica','bold'); doc.setFontSize(13);
      doc.setTextColor(TXT[0],TXT[1],TXT[2]);
      doc.text(`${title} (cont., total: ${list.length})`, margin, y);
      y += titleH;
      can = Math.max(1, capacityAt(y));
    }

    const nRows = Math.min(can, list.length - i);
    const boxH  = pad*2 + headH + nRows*rowH;

    // card
    doc.setDrawColor(B[0],B[1],B[2]);
    doc.setFillColor(CARD[0],CARD[1],CARD[2]);
    doc.roundedRect(margin, y, maxW, boxH, 6, 6, 'FD');

    // header bar
    const innerX = margin + pad;
    doc.setFillColor(HEAD[0],HEAD[1],HEAD[2]);
    doc.rect(innerX, y + pad, maxW - pad*2, headH, 'F');

    // header text
let hx = innerX + 8;
doc.setFont('helvetica','bold'); doc.setFontSize(10);
doc.setTextColor(TXT[0],TXT[1],TXT[2]);
cols.forEach(c => {
  const shift = (c.key === 'email' ? -4 : 0); // nudge Email left
  doc.text(c.label.toUpperCase(), hx + shift, y + pad + 14);
  hx += c.w;
});



    // rows
    let tY = y + pad + headH;
    doc.setFont('helvetica','normal'); doc.setFontSize(10);
    doc.setTextColor(TXT[0],TXT[1],TXT[2]);

    for (let rIndex = 0; rIndex < nRows; rIndex++, i++){
      const r = list[i] || {};
      // zebra
      if (rIndex % 2 === 1){
        doc.setFillColor(255,255,255);
        doc.rect(innerX, tY - 1, maxW - pad*2, rowH, 'F');
      }
      // cells (counter + fields)
      let cx = innerX + 8;
const vals = [String(i+1), r.id||'', r.name||'', r.email||'', r.date||''];

      vals.forEach((v, ci) => {
        const text = String(v||'');
        const maxChars = Math.floor(cols[ci].w / 6.4);
        const shown = text.length > maxChars ? text.slice(0, maxChars-1)+'…' : text;
        doc.text(shown, cx, tY + 12);
        cx += cols[ci].w;
      });
      tY += rowH;
      // row rule
      doc.setDrawColor(B[0],B[1],B[2]);
      doc.line(innerX, tY, innerX + (maxW - pad*2), tY);
    }

    // space under card
    y += boxH + 12;
  }

  return y;
}




  // off-screen canvas factory for Chart.js (fixed size avoids corrupt PNGs)
  function makeCanvas(id){
    let stage = document.getElementById('report-stage');
    if (!stage){
      stage = document.createElement('div');
      stage.id = 'report-stage';
      document.body.appendChild(stage);
    }
    // must NOT be display:none while charts measure themselves
    Object.assign(stage.style, { position:'fixed', left:'-9999px', top:'-9999px', opacity:'0', pointerEvents:'none' });

    const box = document.createElement('div');
    const cv  = document.createElement('canvas');
    cv.width  = 900;      // ~16:9 looks good on A4
    cv.height = 506;
    box.id = id;
    box.appendChild(cv);
    stage.appendChild(box);
    return cv.getContext('2d');
  }

  // build any selected charts and return Chart instances
  async function buildCharts(opts, gm, top5){
    await loadScript('https://cdn.jsdelivr.net/npm/chart.js', () => !!window.Chart);
    const Chart = window.Chart;
    Chart.defaults.responsive = false;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.animation = false;
    Chart.defaults.devicePixelRatio = 1;

    const charts = [];

    if (opts.chart_students){
      const ctx = makeCanvas('c-students');
      charts.push(new Chart(ctx, {
        type:'doughnut',
        data:{ labels:['In clubs','Unaffiliated'], datasets:[{ data:[gm.inClubs, Math.max(0, gm.studentsTotal-gm.inClubs)] }] },
        options:{ plugins:{ legend:{ position:'bottom' }, title:{ display:true, text:'Students: membership distribution' } } }
      }));
    }

    if (opts.chart_advisers){
      const ctx = makeCanvas('c-advisers');
      charts.push(new Chart(ctx, {
        type:'doughnut',
        data:{ labels:['With club','Without club'], datasets:[{ data:[gm.advWith, Math.max(0, gm.advisersTotal-gm.advWith)] }] },
        options:{ plugins:{ legend:{ position:'bottom' }, title:{ display:true, text:'Advisers: coverage' } } }
      }));
    }

    if (opts.chart_top5 && top5 && top5.length){
      const ctx = makeCanvas('c-top5');
      charts.push(new Chart(ctx, {
        type:'bar',
        data:{ labels: top5.map(x=>x.name), datasets:[{ label:'Members', data: top5.map(x=>x.count) }] },
        options:{ indexAxis:'y', plugins:{ legend:{ display:false }, title:{ display:true, text:'Top 5 clubs by members' } }, scales:{ x:{ beginAtZero:true } } }
      }));
    }
    // 1) Active last 7d vs others (doughnut)
if (opts.chart_active7){
  const ctx = makeCanvas('c-active7');
  const totalUsers = (gm.studentsTotal||0) + (gm.advisersTotal||0);
  const active = gm.logged7||0;
  const inactive = Math.max(0, totalUsers - active);
  charts.push(new Chart(ctx, {
    type:'doughnut',
    data:{ labels:['Active (7d)','Others'], datasets:[{ data:[active, inactive] }] },
    options:{ plugins:{ legend:{ position:'bottom' }, title:{ display:true, text:'Active last 7 days' } } }
  }));
}

// 2) New accounts over time (line)
if (opts.chart_new_accounts){
  const s = await getNewAccountsSeries(opts.from, opts.to);
  const ctx = makeCanvas('c-new-accounts');
  charts.push(new Chart(ctx, {
    type:'line',
    data:{
      labels: s.labels,
      datasets:[
        { label:'Students', data:s.dsStudents, tension:0.25, fill:false },
        { label:'Advisers', data:s.dsAdvisers, tension:0.25, fill:false }
      ]
    },
    options:{ plugins:{ title:{ display:true, text:'New accounts per day' } }, scales:{ y:{ beginAtZero:true } } }
  }));
}

// 3) Club size distribution (histogram)
if (opts.chart_club_size_hist){
  const sizes = await getAllClubSizes(500);
  const hist = bucketClubSizes(sizes);
  const ctx = makeCanvas('c-club-hist');
  charts.push(new Chart(ctx, {
    type:'bar',
    data:{ labels:hist.labels, datasets:[{ label:'Clubs', data:hist.counts }] },
    options:{ plugins:{ title:{ display:true, text:'Club size distribution' }, legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } }
  }));
}

// 4) Top 10 clubs by members (bar)
if (opts.chart_top10){
  const top10 = await getTopClubs(10);
  if (top10 && top10.length){
    const ctx = makeCanvas('c-top10');
    charts.push(new Chart(ctx, {
      type:'bar',
      data:{ labels: top10.map(x=>x.name), datasets:[{ label:'Members', data: top10.map(x=>x.count) }] },
      options:{ plugins:{ title:{ display:true, text:'Top 10 clubs by members' }, legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } }
    }));
  }
}


    // give Chart.js a tick to render before capture
    await new Promise(r => setTimeout(r, 200));
    return charts;
  }

  // main: turn form selections into a PDF download
  async function generateReport(form){
    const fd = new FormData(form);
    const opts = {
      orientation: (fd.get('orientation')||'portrait'),
      filename: (fd.get('filename')||'SHS-Analytics-Report').trim(),
      from: fd.get('from')||'',
      to: fd.get('to')||'',
      sec_summary:   !!form.sec_summary.checked,
      sec_breakdown: !!form.sec_breakdown.checked,
      sec_topclubs:  !!form.sec_topclubs.checked,
      sec_table:     !!form.sec_table.checked,
      chart_students: !!form.chart_students.checked,
      chart_advisers: !!form.chart_advisers.checked,
      chart_top5:     !!form.chart_top5.checked,
app_students:    !!(form.app_students && form.app_students.checked),
app_advisers:    !!(form.app_advisers && form.app_advisers.checked),
app_clubmembers: !!(form.app_clubmembers && form.app_clubmembers.checked),
app_club_id:     (form.app_club_id?.value || '').trim()
, chart_new_accounts:  !!(form.chart_new_accounts && form.chart_new_accounts.checked)
, chart_active7:       !!(form.chart_active7 && form.chart_active7.checked)
, chart_club_size_hist:!!(form.chart_club_size_hist && form.chart_club_size_hist.checked)
, chart_top10:         !!(form.chart_top10 && form.chart_top10.checked)


    };

    // ensure staging node exists & is visible off-screen
    let stage = document.getElementById('report-stage');
    if (!stage){
      stage = document.createElement('div');
      stage.id = 'report-stage';
      document.body.appendChild(stage);
    }
    Object.assign(stage.style, { position:'fixed', left:'-9999px', top:'-9999px', opacity:'0', pointerEvents:'none' });

    // libs
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', () => window.jspdf && window.jspdf.jsPDF);
    const jsPDF = window.jspdf.jsPDF;
    const doc = new jsPDF({ orientation: opts.orientation, unit:'pt', format:'a4' });

    // header
    const margin = 40; let y = margin;
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica','bold'); doc.setFontSize(18);
    doc.text('System Analytics Report', margin, y); y += 20;
    doc.setDrawColor(229,231,235);
doc.line(margin, y + 4, pageW - margin, y + 4);
y += 18; // give some space under the rule

    doc.setFont('helvetica','normal'); doc.setFontSize(11);
    const daterange = (opts.from||opts.to) ? ((opts.from||'…')+' to '+(opts.to||'…')) : ('as of '+todayISO());
    doc.text('Generated '+todayISO()+' • '+daterange, margin, y); y += 16;
    doc.line(margin, y, pageW - margin, y); y += 14;

    // data
    const gm   = await getGeneralMetrics();
    const top5 = (opts.sec_topclubs || opts.chart_top5) ? await getTopClubs(5) : [];

    // helper for KPI rows
    function putKPI(label, value, sub){
      doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text(String(label), margin, y);
      doc.setFont('helvetica','normal'); doc.setFontSize(18); doc.text(String(value), margin, y+18);
      if (sub){ doc.setFontSize(10); doc.text(String(sub), margin, y+32); }
      y += 48;
    }

    // sections
    if (opts.sec_summary){
      doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text('Summary', margin, y); y += 12;
      putKPI('Total accounts', fmt(gm.studentsTotal + gm.advisersTotal), fmt(gm.studentsTotal)+' students • '+fmt(gm.advisersTotal)+' advisers');
      putKPI('New (30d)',       fmt(gm.created30Stu + gm.created30Adv), fmt(gm.created30Stu)+' students • '+fmt(gm.created30Adv)+' advisers');
      putKPI('Logged in (7d)',  fmt(gm.logged7));
      if (y>720){ doc.addPage(); y=margin; }
    }

    if (opts.sec_breakdown){
      doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text('Students & Advisers', margin, y); y += 14;
      doc.setFont('helvetica','normal'); doc.setFontSize(11);
      const partPct = gm.studentsTotal ? Math.round(100*gm.inClubs/gm.studentsTotal) : 0;
      const advCov  = gm.advisersTotal ? Math.round(100*gm.advWith/gm.advisersTotal) : 0;
      [
        'Students in clubs: ' + fmt(gm.inClubs) + ' of ' + fmt(gm.studentsTotal) + ' (' + partPct + '%)',
        'Unaffiliated students: ' + fmt(Math.max(0, gm.studentsTotal-gm.inClubs)),
        'Student event participants (30d): ' + fmt(gm.event30),
        'Adviser coverage: ' + fmt(gm.advWith) + ' of ' + fmt(gm.advisersTotal) + ' (' + advCov + '%)',
        'Advised club size (avg): ' + fmt(gm.avgMembersPerAdvisedClub),
        'Students per adviser: ' + String(gm.ratioSA),
        'Clubs per 100 students: ' + fmt(gm.clubsPer100)
      ].forEach(t => { doc.text(t, margin, y); y += 14; });
      if (y>720){ doc.addPage(); y=margin; }
    }

    // charts → PNGs
// charts → PNGs (2 per page, auto-fit, no cutting)
const chartObjs = await buildCharts(opts, gm, top5);

// if we’re mid-page after summary/breakdown, start charts fresh for clean layout
const pageW_ = doc.internal.pageSize.getWidth ? doc.internal.pageSize.getWidth() : doc.internal.pageSize.width || 612;
const pageH_ = doc.internal.pageSize.getHeight ? doc.internal.pageSize.getHeight() : doc.internal.pageSize.height || 792;
const gapY   = 16;                       // space between charts on the same page
let chartsOnPage = 0;

// if there's already content on the page, push charts to a clean page
if (y > margin + 40) { doc.addPage(); y = margin; chartsOnPage = 0; }

for (const ch of chartObjs){
  const canvas = (ch && (ch.canvas || (ch.ctx && ch.ctx.canvas))) || null;
  if (!canvas) continue;
  const png = canvas.toDataURL('image/png', 1.0);

  // available area for two charts on a page (top/bottom margins already reserved)
  const usableH = pageH_ - margin*2;
  const maxW = pageW_ - margin*2;

  // keep aspect ratio from the actual canvas; default ~16:9 if missing
  const ratio = (canvas && canvas.height && canvas.width) ? (canvas.height / canvas.width) : 0.56;

  // height per chart so that 2 charts + one gap fit within usableH
  const perChartH = Math.floor((usableH - gapY) / 2);

  // compute image dimensions; also cap by max width
  let imgH = Math.min(Math.floor(ratio * maxW), perChartH);
  let imgW = Math.floor(imgH / ratio);

  // center horizontally inside the card area
  const x = margin + Math.floor((maxW - imgW) / 2);

  // new page every two charts
  if (chartsOnPage >= 2) {
    doc.addPage(); y = margin; chartsOnPage = 0;
  }

  // safety: if remaining space is tight (shouldn’t happen in 2-per-page flow), break page
  if (y + imgH > pageH_ - margin) {
    doc.addPage(); y = margin; chartsOnPage = 0;
  }

  doc.addImage(png, 'PNG', x, y, imgW, imgH);
  y += imgH + gapY;
  chartsOnPage++;
}

    // optional quick table
    if (opts.sec_table && top5 && top5.length){
      if (y>700){ doc.addPage(); y=margin; }
      doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text('Top clubs (quick table)', margin, y); y += 16;
      doc.setFont('helvetica','normal'); doc.setFontSize(11);
      top5.forEach((r, i) => { doc.text(`${i+1}. ${r.name} — ${fmt(r.count)} members`, margin, y); y += 14; });
    }
        // --- Appendices -----------------------------------------------------
    if (opts.app_students || opts.app_advisers || (opts.app_clubmembers && opts.app_club_id)){
      // Section header
      if (y > 680) { doc.addPage(); y = margin; }
      doc.setFont('helvetica','bold'); doc.setFontSize(16);
      const pageH = doc.internal.pageSize.getHeight ? doc.internal.pageSize.getHeight() : 792;
if (y < margin + 160) { doc.addPage(); y = margin; }

      doc.text('Appendices', margin, y); y += 18;
      doc.setFont('helvetica','normal'); doc.setFontSize(11);

      // New Students
      if (opts.app_students){
        const rows = await getNewPeople('students', opts.from, opts.to);
        y = writeList(doc, 'New students' + (opts.from || opts.to ? ` (${opts.from || '…'} to ${opts.to || '…'})` : ''), rows, margin, y, pageW);
      }

      // New Advisers
      if (opts.app_advisers){
        const rows = await getNewPeople('advisers', opts.from, opts.to);
        y = writeList(doc, 'New advisers' + (opts.from || opts.to ? ` (${opts.from || '…'} to ${opts.to || '…'})` : ''), rows, margin, y, pageW);
      }

      // Members of selected club
      if (opts.app_clubmembers && opts.app_club_id){
        // friendly club name
        let clubName = '';
        try {
          const pl = await apiGet('api/clubs/list.php?limit=500');
          const clubs = (pl?.items || pl?.rows || pl?.data) || [];
          const m = clubs.find(c => String(c.id || c.club_id || c.clubID) === String(opts.app_club_id));
          clubName = m?.name || '';
        } catch {}
        const title = `Members — ${clubName || ('Club ID ' + opts.app_club_id)}` +
                      (opts.from || opts.to ? ` (${opts.from || '…'} to ${opts.to || '…'})` : '');
        const rows = await getClubMembers(opts.app_club_id, opts.from, opts.to);
        y = writeList(doc, title, rows, margin, y, pageW);
      }
    }

    // download + cleanup
    const fname = (opts.filename || 'SHS-Analytics-Report').replace(/\s+/g,'-');
    doc.save(`${fname}_${todayISO()}.pdf`);
    const stageNode = document.getElementById('report-stage');
    if (stageNode) stageNode.innerHTML = '';
  }

  // --- wire the form submit (no extra button JS needed)
  const form = document.getElementById('form-report-builder');
  if (form){
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      generateReport(form).catch(err => {
        console.error(err);
        alert('Failed to generate PDF. ' + (err?.message || err));
      });
    });
  }
// Populate + size the club <select> when the Report Builder opens
{
  const openBtn = document.getElementById('btn-open-report');
  if (openBtn){
    openBtn.addEventListener('click', async () => {
      const f = document.getElementById('form-report-builder');
      if (!f) return;

      const sel = f.querySelector('#rb-club-select, [name="app_club_id"]');
      if (!sel) return;

      try {
        const pl = await apiGet('api/clubs/list.php?limit=2000');
        const clubs = (pl?.items || pl?.rows || pl?.data) || [];

        // options
        sel.innerHTML = '<option value="">— Select a club —</option>' +
          clubs.map(c => `<option value="${c.id || c.club_id || c.clubID}">${
            (c.name || '—').replace(/&/g,'&amp;').replace(/</g,'&lt;')
          }</option>`).join('');

        // If more than 10 clubs → show as a 10-row list with its own scrollbar.
        // If 10 or fewer → behave like a normal dropdown.
// Keep native closed, but if >10 options enhance to a custom 10-row popup
const optionCount = sel.options.length - (sel.options[0]?.value === '' ? 1 : 0);
sel.removeAttribute('size');
sel.classList.remove('rb-scroll');
if (optionCount > 10) installClubSelectCombobox(sel);

      } catch {}
    });
  }
}

// --- lightweight combobox for #rb-club-select (10-row popup with scroll)
window.installClubSelectCombobox ??= function installClubSelectCombobox(sel){
  if (!sel || sel.dataset.enhanced === '1') return;
  sel.dataset.enhanced = '1';

  // Wrap and create UI
  const wrap = document.createElement('div');
  wrap.className = 'rb-combo';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'rb-combo-btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');

  const panel = document.createElement('div');
  panel.className = 'rb-combo-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'listbox');

  const list = document.createElement('ul');
  list.className = 'rb-combo-list';
  panel.appendChild(list);

  // Hide native select (still used for form submission)
  sel.style.display = 'none';
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);
  wrap.appendChild(btn);
  wrap.appendChild(panel);

  function labelOf(option){
    return option?.text || option?.label || '— Select a club —';
  }
  function syncButton(){
    btn.textContent = labelOf(sel.options[sel.selectedIndex] || sel.options[0]);
  }

  // Build items (skip placeholder if value=="")
  list.innerHTML = '';
  for (let i = 0; i < sel.options.length; i++){
    const opt = sel.options[i];
    const li = document.createElement('li');
    li.className = 'rb-combo-item';
    li.setAttribute('role', 'option');
    li.dataset.value = opt.value;
    li.textContent = opt.text;
    if (opt.value === sel.value) li.classList.add('is-active');
    if (i === 0 && opt.value === '') li.classList.add('is-placeholder');
    li.addEventListener('click', () => {
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      syncButton();
      close();
    });
    list.appendChild(li);
  }
  syncButton();

  // Open/close
  let open = false, focusIndex = -1;
  function openPanel(){
    if (open) return;
    open = true;
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    // focus current or first non-placeholder
    const items = [...list.querySelectorAll('.rb-combo-item:not(.is-placeholder)')];
    focusIndex = Math.max(0, items.findIndex(el => el.dataset.value === sel.value));
    items[focusIndex]?.scrollIntoView({ block: 'nearest' });
  }
  function close(){
    if (!open) return;
    open = false;
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    focusIndex = -1;
  }

  btn.addEventListener('click', () => open ? close() : openPanel());

  // Keyboard support
  btn.addEventListener('keydown', (e) => {
    const items = [...list.querySelectorAll('.rb-combo-item:not(.is-placeholder)')];
    if (e.key === 'ArrowDown'){ e.preventDefault(); if (!open) openPanel(); focusIndex = Math.min(items.length-1, focusIndex+1); items[focusIndex]?.scrollIntoView({block:'nearest'}); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); if (!open) openPanel(); focusIndex = Math.max(0, focusIndex-1); items[focusIndex]?.scrollIntoView({block:'nearest'}); }
    else if (e.key === 'Enter'){ if (open && focusIndex >= 0){ e.preventDefault(); items[focusIndex].click(); } }
    else if (e.key === 'Escape'){ if (open){ e.preventDefault(); close(); } }
    else if (e.key === 'Tab'){ close(); }
  });

  // Click-away to close
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) close();
  });
};

})();




// --- Top clubs (by members) ------------------------------
(() => {
  const modal = document.getElementById('modal-admin-dashboard');
  if (!modal) return;

  // define once (uses your apiGet rewriter)
  window.fetchMembersCount ??= async function fetchMembersCount(clubId) {
    try {
      const j = await apiGet(`api/clubs/members/list.php?club_id=${encodeURIComponent(clubId)}&limit=10000`);
      const items = j?.items || j?.rows || j?.data || (Array.isArray(j) ? j : []);
      return Array.isArray(items) ? items.length : Number(items?.count || 0) || 0;
    } catch { return 0; }
  };

  function mountTopClubs() {
    const pane = modal.querySelector('.db-pane[data-pane="general"] .db-grid');
    if (!pane) return false; // not rendered yet

    // Make the General pane scrollable if tall
    const generalPane = modal.querySelector('.db-pane[data-pane="general"]');
    if (generalPane) {
      generalPane.style.maxHeight   = 'calc(100vh - 220px)';
      generalPane.style.overflowY   = 'auto';
      generalPane.style.paddingRight = '4px';
    }

    // Remove any previous section (avoid duplicates)
    pane.querySelector('.metric-section-title[data-topclubs]')?.remove();
    pane.querySelector('.metric-row[data-topclubs]')?.remove();

    // Title
    const head = document.createElement('div');
    head.className = 'metric-section-title';
    head.dataset.topclubs = '1';
    head.textContent = 'Top clubs (by members)';
    pane.appendChild(head);

    // Row container
    const row = document.createElement('div');
    row.className = 'metric-row';
    row.dataset.topclubs = '1';
    row.style.gridColumn = '1 / -1';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = 'repeat(auto-fill, minmax(260px, 1fr))';
    row.style.gap = '10px';
    pane.appendChild(row);

    (async () => {
      try {
        // fetch clubs (rewriter maps list.php → list_admin.php)
        const payload = await apiGet('api/clubs/list.php?limit=500');
        const clubs = payload?.items || payload?.rows || payload?.data || (Array.isArray(payload) ? payload : []);
        if (!clubs.length) {
          const note = document.createElement('div');
          note.className = 'metric-card';
          note.innerHTML = `<h4>Top clubs</h4><div class="sub">No clubs found</div>`;
          row.appendChild(note);
          return;
        }

        // fetch member counts (throttled concurrency)
        const queue = clubs.slice(0, 50);
        const results = [];
        const MAX = 4;
        const workers = Array.from({ length: MAX }, async () => {
          while (queue.length) {
            const c = queue.shift();
            const id = c.id ?? c.club_id ?? c.clubID;
            let count = Number(c.members || c.member_count || 0) || 0;
            if (!count) count = await fetchMembersCount(id);
            results.push({ club: c, count });
          }
        });
        await Promise.all(workers);

        results
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
          .forEach(({ club, count }) => {
            // Static (non-clickable) chip
            const chip = document.createElement('div');
            chip.className = 'metric-card sm static';
            chip.setAttribute('aria-disabled', 'true');
            chip.tabIndex = -1;
            chip.style.cursor = 'default';
            chip.innerHTML = `
              <div class="label">${club.name || club.club_name || '—'}</div>
              <div class="sub">${count} member${count === 1 ? '' : 's'}</div>
            `;
            row.appendChild(chip);
          });

        if (!row.children.length) {
          const note = document.createElement('div');
          note.className = 'metric-card';
          note.innerHTML = `<h4>Top clubs</h4><div class="sub">Member counts not available</div>`;
          row.appendChild(note);
        }
      } catch (e) {
        const note = document.createElement('div');
        note.className = 'metric-card';
        note.innerHTML = `<h4>Top clubs</h4><div class="sub">Error loading: ${String(e.message || e)}</div>`;
        row.appendChild(note);
      }
    })();

    return true;
  }

  // Try now; if pane isn’t ready, wait for it
  if (!mountTopClubs()) {
    const obs = new MutationObserver(() => {
      if (mountTopClubs()) obs.disconnect();
    });
    obs.observe(modal, { childList: true, subtree: true });
  }
})();



// General cards + Top clubs (by members)
(() => {
  var modal = document.getElementById('modal-admin-dashboard');
  if (!modal) return;

  function grid() {
    return modal.querySelector('.db-pane[data-pane="general"] .db-grid');
  }

  // ------- card helpers -------
  function findCard(t) {
    var g = grid(); if (!g) return null;
    var cards = g.querySelectorAll('.metric-card');
    t = String(t || '').toLowerCase();
    for (var i = 0; i < cards.length; i++) {
      var h = cards[i].querySelector('h4');
      if (h && h.textContent.trim().toLowerCase() === t) return cards[i];
    }
    return null;
  }
  function ensureCard(title) {
    var g = grid(); if (!g) return null;
    var c = findCard(title);
    if (!c) {
      c = document.createElement('div');
      c.className = 'metric-card';
      c.innerHTML =
        '<h4>' + title + '</h4>' +
        '<div class="big">0</div>' +
        '<div class="sub">—</div>' +
        '<div class="bar"><div class="fill" style="width:0%"></div></div>';
      var firstSection = g.querySelector('.metric-section-title');
      g.insertBefore(c, firstSection || null);
    }
    return c;
  }
  function setCard(title, big, sub) {
    var c = ensureCard(title); if (!c) return;
    var b = c.querySelector('.big'); if (b) b.textContent = (Number(big) || 0).toLocaleString();
    var s = c.querySelector('.sub'); if (s && typeof sub === 'string') s.textContent = sub;
  }
  function setBarPct(title, pct) {
    var c = ensureCard(title); if (!c) return;
    var bar = c.querySelector('.bar .fill') || c.querySelector('.bar-fill');
    if (bar) bar.style.width = Math.max(0, Math.min(100, Math.round(pct))) + '%';
  }

  // define once
  if (typeof window.fetchMembersCount !== 'function') {
    window.fetchMembersCount = async function (clubId) {
      try {
        var j = await apiGet('api/clubs/members/list.php?club_id=' + encodeURIComponent(clubId) + '&limit=10000');
        var items = (j && (j.items || j.rows || j.data)) || (Array.isArray(j) ? j : []);
        return Array.isArray(items) ? items.length : Number((items && items.count) || 0) || 0;
      } catch (e) { return 0; }
    };
  }

  async function renderGeneralCards() {
    var g = grid(); if (!g) return false;

    ['Total accounts','Active %','New (30d)','Logged in (7d)'].forEach(ensureCard);

    var gm = {};
    try {
      var resp = await apiGet('api/metrics/general.php');
      gm = (resp && resp.metrics) || {};
    } catch (e) { gm = {}; }

    var sTot = Number(gm.students_total || 0);
    var aTot = Number(gm.advisers_total || 0);
    var sAct = Number(gm.students_active || 0);
    var aAct = Number(gm.advisers_active || 0);
    var total = sTot + aTot;
    var active = sAct + aAct;
    var activePct = total ? (active * 100 / total) : 0;

    setCard('Total accounts', total, sTot + ' students • ' + aTot + ' advisers');
    setCard('Active %', Math.round(activePct), sAct + ' students • ' + aAct + ' advisers');
    setBarPct('Active %', activePct);

    var newStu = Number(gm.new_students_30d || 0);
    var newAdv = Number(gm.new_advisers_30d || 0);
    setCard('New (30d)', newStu + newAdv, newStu + ' students • ' + newAdv + ' advisers');

    var logged7 = Number(gm.logged_in_7d || 0);
    setCard('Logged in (7d)', logged7, logged7 + ' in 30d');

    return true;
  }

  async function renderTopClubs() {
    var g = grid(); if (!g) return false;

    var head = g.querySelector('.metric-section-title[data-topclubs]');
    var row  = g.querySelector('.metric-row[data-topclubs]');
    if (!head) {
      head = document.createElement('div');
      head.className = 'metric-section-title';
      head.setAttribute('data-topclubs','1');
      head.textContent = 'Top clubs (by members)';
      g.appendChild(head);
    }
    if (!row) {
      row = document.createElement('div');
      row.className = 'metric-row';
      row.setAttribute('data-topclubs','1');
      row.style.gridColumn = '1 / -1';
      row.style.display = 'grid';
      row.style.gridTemplateColumns = 'repeat(auto-fill, minmax(260px, 1fr))';
      row.style.gap = '10px';
      g.appendChild(row);
    }
    row.innerHTML = '';

    try {
      var payload = await apiGet('api/clubs/list.php?limit=500');
      var clubs = (payload && (payload.items || payload.rows || payload.data)) || (Array.isArray(payload) ? payload : []);
      if (!clubs.length) {
        var note = document.createElement('div');
        note.className = 'metric-card';
        note.innerHTML = '<h4>Top clubs</h4><div class="sub">No clubs found</div>';
        row.appendChild(note);
        return true;
      }

      var queue = clubs.slice(0, 50);
      var results = [];
      var MAX = 4, workers = [];
      for (var w = 0; w < MAX; w++) {
        workers.push((async function worker() {
          while (queue.length) {
            var c = queue.shift();
            var id = c.id || c.club_id || c.clubID;
            var count = Number(c.members || c.member_count || 0) || 0;
            if (!count) count = await window.fetchMembersCount(id);
            results.push({ club: c, count: count });
          }
        })());
      }
      await Promise.all(workers);

      results.sort(function(a,b){ return b.count - a.count; }).slice(0,5).forEach(function(rc){
        var chip = document.createElement('div');
        chip.className = 'metric-card sm';
        chip.innerHTML =
          '<div class="label">' + (rc.club.name || rc.club.club_name || '—') + '</div>' +
          '<div class="sub">' + rc.count + ' member' + (rc.count === 1 ? '' : 's') + '</div>';
        row.appendChild(chip);
      });

      if (!row.children.length) {
        var empty = document.createElement('div');
        empty.className = 'metric-card';
        empty.innerHTML = '<h4>Top clubs</h4><div class="sub">Member counts not available</div>';
        row.appendChild(empty);
      }
    } catch (e) {
      var err = document.createElement('div');
      err.className = 'metric-card';
      err.innerHTML = '<h4>Top clubs</h4><div class="sub">Error loading: ' + String(e && e.message || e) + '</div>';
      row.appendChild(err);
    }
    return true;
  }

  function whenReadyDo(fn) {
    var tries = 0;
    function tick() {
      if (grid()) { fn(); return; }
      if (++tries > 60) return; // ~1s
      requestAnimationFrame(tick);
    }
    tick();
  }

  whenReadyDo(async function () {
    await renderGeneralCards();   // <-- creates & fills the 4 cards
    await renderTopClubs();       // <-- appends the chips section
  });
})();


    // STUDENTS
    renderPane('students', [
      card('Total', Sm.total, `${Sm.active} active • ${Sm.archived} archived`, (Sm.active/(Sm.total||1))*100),
      card('Logged in (7d)', Sl.week, `${Sl.month} in 30d • ${Sl.ever} ever`, 100),
      card('New (30d)', Sm.created30, '', (Sm.created30/(Sm.total||1))*100),
      card('No login ever', (Sm.total - Sl.ever), '', ((Sm.total-Sl.ever)/(Sm.total||1))*100),
      card('Archived', Sm.archived, '', (Sm.archived/(Sm.total||1))*100),
    ]);

    // ADVISERS
    renderPane('advisers', [
      card('Total', Am.total, `${Am.active} active • ${Am.archived} archived`, (Am.active/(Am.total||1))*100),
      card('Logged in (7d)', Al.week, `${Al.month} in 30d • ${Al.ever} ever`, 100),
      card('New (30d)', Am.created30, '', (Am.created30/(Am.total||1))*100),
      card('No login ever', (Am.total - Al.ever), '', ((Am.total-Al.ever)/(Am.total||1))*100),
      card('Archived', Am.archived, '', (Am.archived/(Am.total||1))*100),
    ]);
// ---- CLUBS
renderPane('clubs', [
  card('Total',
       Cm.total,
       `${Cm.active} active • ${Cm.archived} archived`,
       pct(Cm.active, Cm.total)),

  card('New (30d)',
       Cm.created30 || Cm.new30 || 0,
       'in 30d',
       pct((Cm.created30 || Cm.new30 || 0), Cm.total)),

  card('Active %',
       `${pct(Cm.active, Cm.total)}%`,
       `${Cm.active} of ${Cm.total} active`,
       pct(Cm.active, Cm.total)),

  card('Archived',
       Cm.archived,
       '',
       pct(Cm.archived, Cm.total)),

  card('Categories',
       categories.size,
       '',
       100),

  card('Clubs w/o adviser',
       clubsWithoutAdviser,
       '',
       C.length ? (clubsWithoutAdviser * 100 / C.length) : 0),
]);

// ---- Clubs: per-club compact grid (clickable, drawer closed by default) ----
(() => {
  const modal = document.getElementById('modal-admin-dashboard');
  if (!modal) return;

  // build/ensure drawer once
  let drawer = modal.querySelector('.club-drawer');
  if (!drawer) {
    drawer = document.createElement('aside');
    drawer.className = 'club-drawer';
    drawer.setAttribute('aria-hidden', 'true');    // hidden by default
    drawer.innerHTML = `
      <div class="cd-head" style="position:sticky;top:0;background:#fff;border-bottom:1px solid #eef1fb;padding:14px 16px;display:flex;gap:8px;align-items:center;">
        <div class="cd-title" style="font-weight:800;font-size:16px;color:#111827">Club insight</div>
        <button class="cd-close" aria-label="Close insight" style="margin-left:auto;border:0;background:transparent;font-size:20px;cursor:pointer;">×</button>
      </div>
      <div class="cd-body" style="padding:12px 16px;display:grid;gap:10px;"></div>
    `;
    modal.querySelector('.modal-box').appendChild(drawer);
  }

  // Helper: open/close
  const openDrawer = () => { drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); };
  const closeDrawer = () => { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); };

  // Always start CLOSED when the Clubs pane (re)renders
  closeDrawer();

  // Close on ✕, Esc, or when clicking outside the drawer
  drawer.querySelector('.cd-close').onclick = closeDrawer;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  modal.addEventListener('click', (e) => {
    // if click is outside the drawer, and not on a mini card, close it
    const clickedCard = e.target.closest('.metric-row.by-club .metric-card.sm');
    if (!drawer.contains(e.target) && !clickedCard) closeDrawer();
  });

  // Target pane/grid
  const pane = modal.querySelector('.db-pane[data-pane="clubs"] .db-grid') ||
               modal.querySelector('#dash-clubs');
  if (!pane) return;

  // Title
  const head = document.createElement('div');
  head.className = 'metric-section-title';
  head.textContent = 'By club';
  head.style.gridColumn = '1 / -1';
  pane.appendChild(head);

  // Grid
  const grid = document.createElement('div');
  grid.className = 'metric-row by-club';
  grid.style.gridColumn = '1 / -1';
  pane.appendChild(grid);

// helper: count members via existing endpoint, with base path fallbacks
async function fetchMembersCount(clubId) {
  // compute PROJECT_BASE once (mirrors your pattern)
  const PROJECT_BASE = (() => {
    const cap = '/capstone';
    const p = location.pathname;
    const i = p.indexOf(cap);
    return i >= 0 ? p.slice(0, i + cap.length) : '';
  })();

  const tries = [
    `/api/clubs/members/list.php?club_id=${encodeURIComponent(clubId)}&limit=10000`,
    `../api/clubs/members/list.php?club_id=${encodeURIComponent(clubId)}&limit=10000`,
    `${PROJECT_BASE}/api/clubs/members/list.php?club_id=${encodeURIComponent(clubId)}&limit=10000`,
  ];
  for (const url of tries) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) continue;
      const j = await res.json();
const list = Array.isArray(j?.items) ? j.items
           : Array.isArray(j?.rows)  ? j.rows
           : Array.isArray(j?.data)  ? j.data
           : Array.isArray(j)        ? j
           : [];
return list.length;

    } catch (_) {}
  }
  return 0;
}

// Returns { members, new30 } from /api/clubs/members/list.php using joined_at
async function fetchMembersStats(clubId) {
  // Try a few base paths (same pattern as your other helper)
  const PROJECT_BASE = (() => {
    const cap = '/capstone', p = location.pathname, i = p.indexOf(cap);
    return i >= 0 ? p.slice(0, i + cap.length) : '';
  })();

  const urls = [
    `/api/clubs/members/list.php?club_id=${encodeURIComponent(clubId)}&limit=10000`,
    `./api/clubs/members/list.php?club_id=${encodeURIComponent(clubId)}&limit=10000`,
    `${PROJECT_BASE}/api/clubs/members/list.php?club_id=${encodeURIComponent(clubId)}&limit=10000`,
  ];

  for (const u of urls) {
    try {
      const r = await fetch(u, { credentials: 'include' });
      if (!r.ok) continue;
      const j = await r.json();
      const items = Array.isArray(j?.items) ? j.items
            : Array.isArray(j?.rows)  ? j.rows
            : Array.isArray(j?.data)  ? j.data
            : Array.isArray(j)        ? j
            : [];

      const now = Date.now(), THIRTY_D = 30 * 24 * 60 * 60 * 1000;
      let new30 = 0;
      for (const it of items) {
const raw = it.joined_at || it.joinedAt || it.created_at || it.createdAt || '';
let ts = Date.parse(raw);
// fallback for "YYYY-MM-DD HH:MM:SS"
if (Number.isNaN(ts) && raw) ts = Date.parse(raw.replace(' ', 'T'));
if (!Number.isNaN(ts) && (now - ts) <= THIRTY_D) new30++;

      }
      return { members: items.length, new30 };
    } catch {}
  }
  return { members: 0, new30: 0 };
}




// ---- replace your existing openClubInsight with this one ----
async function openClubInsight(club) {
  const name   = club.name || club.club_name || '—';
  const clubId = club.id   || club.club_id   || club.clubID;

  // Title + loading
  drawer.querySelector('.cd-title').textContent = name;
  const body = drawer.querySelector('.cd-body');
  body.innerHTML = 'Loading…';

  // Compute base: prefer /capstone if app is under that path
  const PB = (() => {
    const cap = '/capstone';
    const p = location.pathname;
    const i = p.indexOf(cap);
    return i >= 0 ? p.slice(0, i + cap.length) : '';
  })();

  // 1) Try server metrics first
  var m = {};
  try {
    const res = await fetch(PB + '/api/metrics/club.php?club_id=' + encodeURIComponent(clubId), { credentials: 'include' });
    if (res.ok) {
      const j = await res.json();
      if (j && j.ok && j.metrics) m = j.metrics;
    }
  } catch (__) {}

  // 2) Ensure we have reliable "members" and "new30" (fallback to list.php)
  var membersCount = Number(m.members != null ? m.members : 0) || 0;
  var new30Count   = Number(m.new30   != null ? m.new30   : 0) || 0;

  async function computeFromMemberList() {
    const urls = [
      PB + '/api/clubs/members/list.php?club_id=' + encodeURIComponent(clubId) + '&limit=10000',
      './api/clubs/members/list.php?club_id=' + encodeURIComponent(clubId) + '&limit=10000',
      '/api/clubs/members/list.php?club_id=' + encodeURIComponent(clubId) + '&limit=10000',
    ];
    var items = [];
    for (var k = 0; k < urls.length; k++) {
      try {
        const r = await fetch(urls[k], { credentials: 'include' });
        if (!r.ok) continue;
        const j = await r.json();
        items = Array.isArray(j && j.items) ? j.items
              : Array.isArray(j && j.rows)  ? j.rows
              : Array.isArray(j && j.data)  ? j.data
              : Array.isArray(j)            ? j
              : [];
        break;
      } catch {}
    }
    const now = Date.now(), THIRTY_D = 30 * 24 * 60 * 60 * 1000;
    const new30 = items.reduce(function (sum, it) {
      const raw = it.joined_at || it.joinedAt || it.created_at || it.createdAt || '';
      var ts = Date.parse(raw);
      if (isNaN(ts) && raw) ts = Date.parse(String(raw).replace(' ', 'T'));
      return sum + (!isNaN(ts) && (now - ts) <= THIRTY_D ? 1 : 0);
    }, 0);
    return { members: items.length, new30: new30 };
  }

  if (!membersCount || isNaN(membersCount) || !new30Count) {
    try {
      var stats;
      if (typeof fetchMembersStats === 'function') {
        stats = await fetchMembersStats(clubId);
      } else {
        stats = await computeFromMemberList();
      }
      if (!membersCount) membersCount = Number(stats.members || 0);
      if (!new30Count)   new30Count   = Number(stats.new30   || 0);
    } catch (__) {}
  }

  // ---- derive/normalize the rest from m ----
  var eventsUpcoming = Number(m && (m.events_upcoming != null ? m.events_upcoming : m.eventsUpcoming)) || 0;
  var events30       = Number(m && (m.events30         != null ? m.events30         : m.events_30d))   || 0;
  var news30         = Number(m && (m.news30           != null ? m.news30           : m.news_30d))     || 0;

  var next           = (m && m.next_event) ? m.next_event : null;
  var nextFill       = next ? Math.max(0, Math.min(100, Number(next.fill_pct || 0))) : 0;
  var nextWhen       = (next && next.date)  ? new Date(String(next.date).replace(' ','T')).toLocaleDateString() : '';
  var nextTitle      = (next && next.title) ? next.title : '';
  var nextSub        = next ? (nextWhen + (nextTitle ? ' • ' + nextTitle : '')) : '—';

  // Last update: use server value or fallbacks
  var lastUpdate = (m && m.last_update) || club.updated_at || club.modified_at || null;
  if (!lastUpdate) {
    try {
      const d = await apiGet('api/clubs/get.php?id=' + encodeURIComponent(clubId));
      lastUpdate = (d && (d.updated_at || d.modified_at || d.last_update)) || null;
    } catch {}
  }
  const lastUpdateExact = lastUpdate ? new Date(String(lastUpdate).replace(' ','T')).toLocaleString() : '';
  const lastUpdateText  = lastUpdate ? timeAgo(lastUpdate) : '—';

  var adviserOk = (m && m.adviser_present) || club.adviser_email;

  // 3) Render
  const fmt = (n) => (Number(n) || 0).toLocaleString();

  body.innerHTML = ''
    + '<div class="metric-card"><h4>Members</h4><div class="big">' + fmt(membersCount) + '</div></div>'
    + '<div class="metric-card"><h4>New members (30d)</h4><div class="big">' + fmt(new30Count) + '</div></div>'
    + '<div class="metric-card"><h4>Active members (60d)</h4><div class="big">' + fmt(m && m.active60) + '</div></div>'
    + '<div class="metric-card"><h4>Upcoming events</h4><div class="big">' + fmt(eventsUpcoming) + '</div></div>'
    + '<div class="metric-card"><h4>Events (30d)</h4><div class="big">' + fmt(events30) + '</div></div>'
    + '<div class="metric-card"><h4>Next event fill</h4><div class="big">' + nextFill + '%</div><div class="sub">' + nextSub + '</div></div>'
    + '<div class="metric-card"><h4>News posts (30d)</h4><div class="big">' + fmt(news30) + '</div></div>'
    + '<div class="metric-card"><h4>Last update</h4><div class="big" title="' + lastUpdateExact + '">' + lastUpdateText + '</div></div>'
    + '<div class="metric-card"><h4>Adviser</h4><div class="big">' + (adviserOk ? '✔︎' : '—') + '</div></div>'
    + '<div class="metric-card"><h4>Profile completeness</h4><div class="big">' + fmt(m && m.profile_score) + '/4</div></div>';

  // 4) Open the drawer
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
}




  // Build cards
// Build cards (show live member counts)
const src = (typeof C !== 'undefined' && Array.isArray(C)) ? C : [];
src.forEach(c => {
  const sub = [c.tags || c.category, c.status].filter(Boolean).join(' • ');
  const el = document.createElement('div');
  el.className = 'metric-card sm';
  el.setAttribute('role','button'); el.tabIndex = 0; el.title = 'View club metrics';

  // Render placeholder count, then update with the live number
  const label = (c.name || c.club_name || '—');
  el.innerHTML = `
    <div class="label">${label}</div>
    <div class="value">—</div>
    <div class="sub">${sub || '—'}</div>
  `;
  grid.appendChild(el);

  // Make the card clickable / keyboard-activatable
  el.addEventListener('click', () => openClubInsight(c));
  el.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.code === 'Space') { ev.preventDefault(); openClubInsight(c); }
  });

  // Live count
  const id = c.id ?? c.club_id ?? c.clubID;
  window.fetchMembersCount?.(id).then(cnt => {
    const v = el.querySelector('.value');
    if (v) v.textContent = String(cnt);
  }).catch(() => {
    const v = el.querySelector('.value');
    if (v) v.textContent = '0';
  });
});


  // Also close drawer when switching tabs or closing modal
  modal.querySelectorAll('[data-pane]').forEach(btn => btn.addEventListener('click', closeDrawer));
  modal.querySelector('.btn-close, .modal-close')?.addEventListener('click', closeDrawer);
})();




// CLUBS — per-club mini cards (inside renderDashboard)
{
  // Be tolerant to either layout: .dash-pane/.dash-grid OR .db-pane/.db-grid OR #dash-clubs
  const pane =
    modal.querySelector('.dash-pane[data-pane="clubs"] .dash-grid') ||
    modal.querySelector('.db-pane[data-pane="clubs"] .db-grid') ||
    modal.querySelector('#dash-clubs');

  if (!pane) return;

  // Clear and add section title
  pane.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'metric-section-title';
  head.textContent = 'By club';
  pane.appendChild(head);

  // Grid container
  const grid = document.createElement('div');
  grid.className = 'metric-row by-club';

  C.forEach(c => {
    const members = Number(c.members || c.member_count || c.members_count || 0);
    const subbits = [];
    if (c.tags || c.category) subbits.push(c.tags || c.category);
    if (c.created_at) subbits.push(timeAgo(c.created_at));
    if (c.status) subbits.push(c.status);

    const el = document.createElement('div');
    el.className = 'metric-card sm';
    el.innerHTML = `
      <div class="label">${escapeHtml(c.name || '—')}</div>
      <div class="value">${members}</div>
      <div class="sub">${escapeHtml(subbits.join(' • ') || '—')}</div>
    `;
    grid.appendChild(el);
  });

  pane.appendChild(grid);
}



  }

  // make it callable from anywhere
  window.renderDashboard = renderDashboard;
})();
