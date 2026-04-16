// ClubDirectory.js — robust owner detection + modal editing wired
// - Matches owner by adviser_id OR fallback to adviser email
// - Calls ensureOwnerByEmail() AFTER clubs load & render
// - Keeps metrics, search, chips, modal, 4-row members viewport
document.addEventListener("DOMContentLoaded", async () => {
  await Auth.requireAuth({ roles: ["adviser"] });
});

(function(){
  // ---------- base utilities ----------
  const PROJECT_BASE = (() => {
    const cap = '/capstone';
    const p = location.pathname;
    const i = p.indexOf(cap);
    return i >= 0 ? p.slice(0, i + cap.length) : '';
  })();

  function apiCandidates(path){
    return [
      `${path}`,
      `../${path}`,
      `${PROJECT_BASE}/${path}`.replace(/\/{2,}/g,'/'),
    ];
  }

  async function apiFetch(path, opts = {}){
    const headers = { 'Accept': 'application/json' };
    if (opts.body && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    for (const url of apiCandidates(path)){
      try{
        const res = await fetch(url, { ...opts, headers:{...headers, ...(opts.headers||{})}, credentials:'include' });
        if (!res.ok){ let err; try{ err = await res.json(); }catch{}; throw {res, err}; }
        return await res.json();
      }catch(_){ /* try next */ }
    }
    throw new Error('All API base candidates failed: ' + path);
  }

  function mediaUrl(rel){
    if (!rel) return '';
    if (/^https?:\/\//i.test(rel)) return rel;
    const base = PROJECT_BASE || '';
    return `${base}/${String(rel).replace(/^\/+/, '')}`;
  }

  // ---------- state ----------
let ME = { role:null, adviser_id:null, sti_email:null };
let CLUBS = [];
let ORGS  = [];
let _currentClubId = 0;
let _currentOrgId  = 0;
let _ctxKind = "club"; // "club" | "org" (what the modal currently shows)
let _members = [];
let _orgClubs = [];
let _modalEditable = false;
let _descDraft = "";

  // ---------- helpers ----------
  function computeEditable(club){
    // trust server if present
    if (club && club.editable === true) return true;

    // id match
    const myAid   = Number(ME?.adviser_id || ME?.id || 0);
    const clubAid = Number(club?.adviser_id || club?.owner_id || 0);
    if (myAid && clubAid) return myAid === clubAid;

    // email fallback
    const myEmail = String(ME?.sti_email || ME?.email || '').trim().toLowerCase();
    const cEmail  = String(
      club?.adviser_email || club?.adviserEmail || club?.adviser_sti_email || club?.email || ''
    ).trim().toLowerCase();
    if (myEmail && cEmail) return myEmail === cEmail;

    return false;
  }

  // If list lacks adviser id/email, probe get.php per club until we match by email
  async function ensureOwnerByEmail(){
    const myEmail = String(ME?.sti_email || ME?.email || '').trim().toLowerCase();
    if (!myEmail) return;
    if (CLUBS.some(c => c.editable)) return; // already found

    for (const c of CLUBS){
      try{
        const r = await apiFetch(`api/clubs/get.php?id=${c.id}`);
        if (!r?.ok) continue;
        const advEmail = String(r.item?.adviser_email || '').trim().toLowerCase();
        if (advEmail && advEmail === myEmail){
          c.editable = true;
          render(CLUBS); // re-render once to show "Your Club" and enable edit
          break;
        }
      }catch(_){ /* next */ }
    }
  }

 function syncDescHeight(){
  const descCard = document.querySelector('.cvm-right .cvm-desc-card');
  if (!descCard) return;

  // On mobile/tablet (single-column), let the card be natural height
  const singleCol = window.matchMedia('(max-width: 1024px)').matches;
  if (singleCol){
    descCard.style.height = '';   // clear any previous desktop lock
    return;
  }

  // Desktop: match left column height for a clean 2-column look
  const left = document.querySelector('.cvm-left');
  if (!left) return;
  const h = left.getBoundingClientRect().height;
  descCard.style.height = h + 'px';
}


  function lockMembersViewport(){
    const wrap  = document.querySelector('.cvm-table-wrap');
    const table = wrap?.querySelector('table');
    if (!wrap || !table) return;

    requestAnimationFrame(() => {
      const MIN_HEADER = 44;
      const MIN_ROW    = 44;

      let theadH = 0;
      if (table.tHead) theadH = table.tHead.getBoundingClientRect().height || 0;
      if (theadH < MIN_HEADER) theadH = MIN_HEADER;

      const tbody = table.tBodies && table.tBodies[0];
      let rowH = 0;
      if (tbody && tbody.rows && tbody.rows.length){
        for (const r of tbody.rows){
          const h = r.getBoundingClientRect().height || 0;
          if (h > 0){ rowH = h; break; }
        }
      }
      if (rowH < MIN_ROW) rowH = MIN_ROW;

      const fixedH = Math.round(theadH + rowH * 4);
      wrap.style.height    = fixedH + 'px';
      wrap.style.minHeight = fixedH + 'px';
      wrap.style.maxHeight = fixedH + 'px';
      wrap.style.overflowY = 'auto';
      wrap.style.overflowX = 'hidden';
    });
  }

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", init);

  async function init(){
    // Sidebar toggle
    document.querySelector(".sidebar-toggle-btn")?.addEventListener("click", () => {
      document.body.classList.toggle("sidebar-expanded");
    });

    // Logout confirm
    const logoutLink = document.querySelector('.logout-link');
    const overlay    = document.getElementById('logoutConfirmOverlay');
    if (logoutLink && overlay) {
      const btnNo  = overlay.querySelector('.btn-no');
      const btnYes = overlay.querySelector('.btn-yes');
      logoutLink.addEventListener('click', e => { e.preventDefault(); overlay.classList.add('active'); });
      btnNo?.addEventListener('click', () => overlay.classList.remove('active'));
      btnYes?.addEventListener('click', () => { window.location.href = 'index.html'; });
    }

    // Who am I? (normalize shapes from me.php)
    try{
      const meRes = await apiFetch('api/auth/me.php?side=adviser');
      if (meRes?.ok) {
        const m = meRes.me || {};
        ME = {
          role:       m.role ?? m.user_role ?? null,
          adviser_id: (function(){
            const n = Number(m.adviser_id ?? m.id ?? (m.adviser && m.adviser.id));
            return Number.isFinite(n) && n > 0 ? n : null;
          })(),
          sti_email:  m.sti_email ?? m.email ?? null
        };
        if (!ME.adviser_id && (ME.role === 'adviser' || /adviser/i.test(ME.role||'')) && m.id){
          const n = Number(m.id); if (Number.isFinite(n) && n > 0) ME.adviser_id = n;
        }
      }
    }catch(_){}

    // Metrics
    loadMetrics();

    // Load clubs AFTER ME so we can tag ownership
// Load clubs AFTER ME so we can tag ownership
await loadClubs();

// Load organizations (also tag ownership)
await loadOrgs();

// Tabs toggle (Clubs / Organizations)
setupTabs();

// Chips (category filter)


    // Chips (category filter)
    const chips = document.querySelectorAll(".chip");
    chips.forEach(chip => {
      chip.addEventListener("click", () => {
        chips.forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        const f = chip.dataset.filter;
        const items = (f && f !== "all") ? CLUBS.filter(c => c.category === f) : CLUBS;
        render(items);
      });
    });

    // Search
    const searchInput = document.getElementById("search-input");
    const searchBtn   = document.getElementById("search-btn");
    const runSearch = () => {
      const q = (searchInput?.value || "").toLowerCase().trim();
      const res = !q ? CLUBS : CLUBS.filter(c =>
        (c.name||'').toLowerCase().includes(q) ||
        (c.category||'').toLowerCase().includes(q) ||
        (c.adviser_name||'').toLowerCase().includes(q)
      );
      render(res);
    };
    searchBtn?.addEventListener("click", runSearch);
    searchInput?.addEventListener("keydown", e => { if (e.key === "Enter") runSearch(); });

    // Open modal
    document.addEventListener("click", onOpenModal);

    // When modal is open, keep heights tidy on resize
    let __lockTimer = null;
    window.addEventListener('resize', () => {
      const modal = document.getElementById('clubViewModal');
      if (modal && modal.classList.contains('active')){
        clearTimeout(__lockTimer);
        __lockTimer = setTimeout(() => { syncDescHeight(); lockMembersViewport(); }, 120);
      }
    });
  }

  // ---------- metrics ----------
  async function loadMetrics(){
    try{
      const r = await fetch('api/clubs/metrics.php', { headers:{ 'Accept':'application/json' } });
      const j = await r.json();
      if (!j?.ok) return;
      const mActive   = document.getElementById('m-active');
      const mStudents = document.getElementById('m-students');
      const mAdvisers = document.getElementById('m-advisers');
      if (mActive)   mActive.textContent   = j.metrics.active_clubs ?? 0;
      if (mStudents) mStudents.textContent = j.metrics.student_members ?? 0;
      if (mAdvisers) mAdvisers.textContent = j.metrics.active_advisers ?? 0;
    }catch(_){}
  }

  // ---------- list + cards ----------
  async function loadClubs(){
    try{
      const r = await apiFetch('api/clubs/list.php?limit=200');
      if (r?.ok){
        const items = r.items || [];
        // Coerce adviser_id to number; compute editable now
        CLUBS = items.map(c => {
          const coerced = { ...c, adviser_id: c.adviser_id != null ? Number(c.adviser_id) : c.adviser_id };
          return { ...coerced, editable: computeEditable(coerced) };
        });
      }else{
        CLUBS = [];
      }
      render(CLUBS);

      // If none marked owner yet and we have an email, lazily verify via get.php
      if ((ME?.sti_email || ME?.email) && !CLUBS.some(c => c.editable)) {
        await ensureOwnerByEmail();
      }
    }catch(e){
      console.error('clubs/list failed', e);
      CLUBS = []; render([]);
    }
  }

  const grid = document.getElementById("clubs-grid");

  function sortOwnerFirst(list){
    return [...list].sort((a, b) => {
      const A = a.editable ? 1 : 0;
      const B = b.editable ? 1 : 0;
      if (A !== B) return B - A;
      const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bd - ad;
    });
  }

  function cardHTML(c){
    const logoStyle = c.profile_picture ? `style="background-image:url('${mediaUrl(c.profile_picture)}');"` : "";
    const ownerCls  = c.editable ? ' is-owner' : '';
    const mcount    = (typeof c.member_count === 'number') ? c.member_count : '—';
    return `
      <article class="club-card${ownerCls}" data-tag="${c.category || ''}">
        <span class="club-tag">${c.category || ''}</span>
        <div class="club-head">
          <div class="club-logo" ${logoStyle}></div>
          <div class="club-head-text">
            <h2 class="club-name">${c.name}</h2>
          </div>
        </div>
        <div class="club-info">
          <div><strong>Club Adviser</strong><br>${c.adviser_name || '—'}</div>
          <div><strong>Club Members</strong><br>
            <span class="club-member-count" data-club-count="${c.id}">${mcount}</span> members
          </div>
        </div>
        <div class="card-actions">
          <button class="club-btn" type="button" data-view-id="${c.id}">View Details</button>
        </div>
      </article>
    `;
  }

  function render(clubs){
    if (!grid) return;
    const sorted = sortOwnerFirst(clubs);
    grid.innerHTML = sorted.map(cardHTML).join("");
  }

  /* ===================== ORGANIZATIONS ===================== */
const orgGrid = document.getElementById("orgs-grid");

function orgCardHTML(o){
  const logoStyle = o.profile_picture ? `style="background-image:url('${mediaUrl(o.profile_picture)}');"` : "";
  const ownerCls  = o.editable ? ' is-owner' : '';
const cnt = (typeof o.clubs_count === 'number') ? o.clubs_count : (o.clubs || 0);

  return `
    <article class="org-card${ownerCls}">
      <span class="club-tag">${o.org_type || ''}</span>
      <div class="club-head">
        <div class="club-logo" ${logoStyle}></div>
        <div class="club-head-text">
          <h2 class="club-name">${o.name}</h2>
        </div>
      </div>
      <div class="club-info">
        <div><strong>Organization Adviser</strong><br>${o.adviser_name || '—'}</div>
        <div><strong>Clubs</strong><br>${cnt ?? '—'}</div>
      </div>
      <div class="card-actions">
        <button class="club-btn org-btn" type="button" data-org-id="${o.id}">View Details</button>

      </div>
    </article>
  `;
}

function renderOrgs(list){
  if (!orgGrid) return;
  const sorted = [...list].sort((a,b) => (b.editable?1:0)-(a.editable?1:0));
  orgGrid.innerHTML = sorted.map(orgCardHTML).join("");
}

async function loadOrgs(){
  try{
    const r = await apiFetch('api/organizations/list.php?limit=200');
    if (r?.ok){
      const items = r.items || [];
      ORGS = items.map(o => {
        const advId = (o.adviser_id != null) ? Number(o.adviser_id) : o.adviser_id;
        const editable = computeEditable({ adviser_id:advId, adviser_email:o.adviser_email, editable:o.editable });
        return { ...o, adviser_id: advId, editable };
      });
    }else{
      ORGS = [];
    }
    renderOrgs(ORGS);
  }catch(e){ ORGS = []; renderOrgs([]); }
}

function setupTabs(){
  const tabClubs = document.getElementById('tabClubs');
  const tabOrgs  = document.getElementById('tabOrgs');
  const clubsWrap = document.getElementById('clubs-grid')?.parentElement;
  tabClubs?.addEventListener('click', () => {
    tabClubs.classList.add('is-active'); tabOrgs.classList.remove('is-active');
    document.getElementById('clubs-grid')?.classList.remove('hidden');
    document.getElementById('orgs-grid')?.classList.add('hidden');
    // show chips for clubs
    document.querySelector('.quick-filters')?.classList.remove('hidden');
    clubsWrap?.scrollIntoView({behavior:'smooth', block:'start'});
  });
  tabOrgs?.addEventListener('click', () => {
    tabOrgs.classList.add('is-active'); tabClubs.classList.remove('is-active');
    document.getElementById('orgs-grid')?.classList.remove('hidden');
    document.getElementById('clubs-grid')?.classList.add('hidden');
    // chips are club-only
    document.querySelector('.quick-filters')?.classList.add('hidden');
    clubsWrap?.scrollIntoView({behavior:'smooth', block:'start'});
  });
}


  // ---------- modal wiring ----------
  const modal     = document.getElementById("clubViewModal");
  const coverEl   = document.getElementById("cvm-cover");
  const coverEdit = document.getElementById("cvm-cover-edit");
  const coverFile = document.getElementById("cvm-cover-file");
  const avatarEl  = document.getElementById("cvm-avatar");
  const avatarEdit= document.getElementById("cvm-avatar-edit");
  const avatarFile= document.getElementById("cvm-avatar-file");
  const nameEl    = document.getElementById("cvm-clubname");
  const advAvatar = document.getElementById("cvm-adv-avatar");
  const advName   = document.getElementById("cvm-adv-name");
  const advEmail  = document.getElementById("cvm-adv-email");

  const descTextWrap   = document.getElementById("cvm-desc-text");
  const descEditing    = document.getElementById("cvm-desc-editing");
  const descTextarea   = document.getElementById("cvm-desc-textarea");
  const descEditBtn    = document.getElementById("cvm-desc-edit");
  const descCancelBtn  = document.getElementById("cvm-desc-cancel");
  const descSaveBtn    = document.getElementById("cvm-desc-save");
  const descCard       = document.querySelector('.cvm-desc-card');

  let __lastFocus = null;

function openModal(){
  __lastFocus = document.activeElement;
  modal.classList.add("active");
  modal.removeAttribute("aria-hidden");
  document.body.classList.add('no-scroll'); // <— add this

  const first = modal.querySelector('[data-cvm-close], button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  (first || modal).focus?.({ preventScroll:true });
}

function closeModal(){
  const fallback = document.querySelector('.sidebar-toggle-btn')
               || document.querySelector('a,button,input,select,textarea');
  const returnTo = (__lastFocus && document.contains(__lastFocus)) ? __lastFocus : fallback || document.body;
  returnTo.focus?.({ preventScroll:true });

  modal.classList.remove("active");
  modal.setAttribute("aria-hidden","true");
  document.body.classList.remove('no-scroll'); // <— add this

  hidePop?.();
}

  modal?.querySelectorAll("[data-cvm-close]")?.forEach(b => b.addEventListener("click", closeModal));
  modal?.addEventListener("click", (e)=>{ if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e)=>{ if (e.key === "Escape" && modal?.classList.contains("active")) closeModal(); });

async function onOpenModal(e){
  const orgBtn  = e.target.closest('.org-btn[data-org-id]');
  const clubBtn = e.target.closest('.club-btn[data-view-id]');
  if (!orgBtn && !clubBtn) return;

  // Common elements
  const titleEl = document.getElementById('cvm-title');
  const modalBox = document.querySelector('.club-view-modal');
  const advLabel = document.querySelector('.cvm-adviser-card .cvm-card-head');
  const descLabel= document.querySelector('.cvm-desc-head span');
  const orgCard  = document.querySelector('.cvm-org-clubs');
  const memCard  = document.getElementById('cvm-members-card');

  if (clubBtn) {
    _ctxKind = 'club';
    modalBox?.classList.remove('is-org');
    titleEl.textContent = 'Club Details';
    advLabel.textContent = 'Club Adviser';
    descLabel.textContent = 'Club Description';
    orgCard?.setAttribute('hidden','');
    memCard?.removeAttribute('hidden');

    const id = parseInt(clubBtn.getAttribute('data-view-id'), 10) || 0;
    if (!id) return;
    _currentClubId = id;

    try{
      const r = await apiFetch(`api/clubs/get.php?id=${id}`);
      if (!r?.ok) return;
      const c = r.item;

      // Fill modal
      nameEl.textContent = c.name;
      coverEl.style.backgroundImage = c.cover_picture ? `url('${mediaUrl(c.cover_picture)}')` : "none";
      avatarEl.style.backgroundImage = c.profile_picture ? `url('${mediaUrl(c.profile_picture)}')` : "none";
      advAvatar.style.backgroundImage = ""; // no adviser photo yet
      advName.textContent  = c.adviser_name || '—';
      advEmail.textContent = c.adviser_email || '';
      descTextWrap.textContent = c.description || "No description yet.";

      // View mode first
      descCard?.classList.remove('is-editing');
      descTextWrap?.removeAttribute('hidden');
      descEditing?.removeAttribute('hidden');

      // Permissions
      _modalEditable = computeEditable(c);
      setEditableUI(_modalEditable);

      // Members
      await loadMembers(_currentClubId);

      // Sync sizes and open
      syncDescHeight();
      lockMembersViewport();
      openModal();
      bindEditingHandlers(_modalEditable);
    }catch(err){
      console.error(err);
      alert('Failed to load club details.');
    }
    return;
  }

  if (orgBtn) {
    _ctxKind = 'org';
    modalBox?.classList.add('is-org');
    titleEl.textContent = 'Organization Details';
    advLabel.textContent = 'Organization Adviser';
    descLabel.textContent = 'Organization Description';
    memCard?.setAttribute('hidden','');
    orgCard?.removeAttribute('hidden');

    const id = parseInt(orgBtn.getAttribute('data-org-id'), 10) || 0;
    if (!id) return;
    _currentOrgId = id;

    try{
      const r = await apiFetch(`api/organizations/get.php?id=${id}`);
      if (!r?.ok) return;
      const o = r.item;

      nameEl.textContent = o.name;
      coverEl.style.backgroundImage = o.cover_picture ? `url('${mediaUrl(o.cover_picture)}')` : "none";
      avatarEl.style.backgroundImage = o.profile_picture ? `url('${mediaUrl(o.profile_picture)}')` : "none";
      advAvatar.style.backgroundImage = "";
      advName.textContent  = o.adviser_name || '—';
      advEmail.textContent = o.adviser_email || '';
      descTextWrap.textContent = o.description || "No description yet.";

      descCard?.classList.remove('is-editing');
      descTextWrap?.removeAttribute('hidden');
      descEditing?.removeAttribute('hidden');

      _modalEditable = computeEditable({ adviser_id:o.adviser_id, adviser_email:o.adviser_email, editable:o.editable });
      setEditableUI(_modalEditable);

      await loadOrgClubs(_currentOrgId);

      syncDescHeight();
      lockMembersViewport();
      openModal();
      bindEditingHandlers(_modalEditable);
    }catch(err){
      console.error(err);
      alert('Failed to load organization details.');
    }
  }
}


  function setEditableUI(can){
    const modalBox = document.querySelector('.club-view-modal');
    if (modalBox) modalBox.classList.toggle('readonly', !can);

    const addWrap = document.querySelector('.cvm-add-wrap');
    if (addWrap) addWrap.hidden = !can;

    toggleEditable(coverEdit, coverFile, can, 'Edit cover');
    toggleEditable(avatarEdit, avatarFile, can, 'Edit profile');

    if (descEditBtn){
      descEditBtn.disabled = !can;
      descEditBtn.title = can ? 'Edit description' : '';
    }
  }

  function toggleEditable(btn, fileInput, can, title){
    if (!btn) return;
    btn.disabled = !can;
    btn.classList.toggle('is-disabled', !can);
    btn.title = can ? (title || 'Edit') : '';
    if (fileInput) fileInput.disabled = !can;
  }

  function bindEditingHandlers(canEdit){
    // Description edit state
    descEditBtn.onclick = () => {
      if (!canEdit) return;
      _descDraft = descTextWrap.textContent || "";
      descTextarea.value = _descDraft;
      descCard?.classList.add('is-editing');
      descTextarea.focus();
      requestAnimationFrame(syncDescHeight);
    };
    descCancelBtn.onclick = () => {
      descCard?.classList.remove('is-editing');
      requestAnimationFrame(syncDescHeight);
    };
    descSaveBtn.onclick = async () => {
      const val = (descTextarea.value || "").trim();
      try{
const base = (_ctxKind === 'org') ? 'organizations' : 'clubs';
const id   = (_ctxKind === 'org') ? _currentOrgId : _currentClubId;
const r = await apiFetch(`api/${base}/update.php?id=${id}`, {
  method:'POST',
  body: JSON.stringify({ description: val })
});

        if (!r?.ok) throw new Error(r?.error || 'Update failed');
        descTextWrap.textContent = val || "No description yet.";
        descCard?.classList.remove('is-editing');
        requestAnimationFrame(syncDescHeight);
      }catch(e){ alert((e?.err && e.err.error) || e.message || 'Save failed'); }
    };

    // Avatar/Cover uploads
    coverEdit.onclick = () => { if (canEdit) coverFile?.click(); };
    avatarEdit.onclick = () => { if (canEdit) avatarFile?.click(); };

    coverFile.onchange = async () => {
      const f = coverFile.files?.[0]; if (!f) return;
      const fd = new FormData();
if (_ctxKind === 'org') { fd.append('organization_id', String(_currentOrgId)); }
else { fd.append('club_id', String(_currentClubId)); }
fd.append('kind','cover'); fd.append('file', f);

      try{
        const j = await apiFetch(`api/${_ctxKind==='org'?'organizations':'clubs'}/upload_media.php`, { method:'POST', body: fd });
        if (!j?.ok) throw new Error(j?.error || 'Upload failed');
        coverEl.style.backgroundImage = `url('${mediaUrl(j.path)}')`;
      }catch(e){ alert((e?.err && e.err.error) || e.message || 'Upload failed'); }
      coverFile.value = '';
    };

    avatarFile.onchange = async () => {
      const f = avatarFile.files?.[0]; if (!f) return;
const fd = new FormData();
if (_ctxKind === 'org') { fd.append('organization_id', String(_currentOrgId)); }
else { fd.append('club_id', String(_currentClubId)); }
fd.append('kind','avatar'); fd.append('file', f);


      try{
        const j = await apiFetch(`api/${_ctxKind==='org'?'organizations':'clubs'}/upload_media.php`, { method:'POST', body: fd });
        if (!j?.ok) throw new Error(j?.error || 'Upload failed');
        avatarEl.style.backgroundImage = `url('${mediaUrl(j.path)}')`;
      }catch(e){ alert((e?.err && e.err.error) || e.message || 'Upload failed'); }
      avatarFile.value = '';
    };
  }

  // ---------- members ----------
  const confirmEl = document.getElementById("confirmOverlay");
  const cTitle    = document.getElementById("confirm-title");
  const cDesc     = document.getElementById("confirm-desc");
  const cCancel   = confirmEl?.querySelector("[data-confirm-cancel]");
  const cAccept   = confirmEl?.querySelector("[data-confirm-accept]");

  function confirmDialog({title, message, acceptText="Remove", cancelText="Cancel"} = {}){
    return new Promise(resolve => {
      if (!confirmEl) return resolve(false);
      cTitle.textContent = title || "Are you sure?";
      cDesc.textContent  = message || "This action cannot be undone.";
      cAccept.textContent = acceptText;
      cCancel.textContent = cancelText;

      confirmEl.hidden = false;
      confirmEl.classList.add("active");
      setTimeout(() => cAccept?.focus(), 0);

      function cleanup(){ confirmEl.classList.remove("active"); confirmEl.hidden = true; }
      function ok(){ cleanup(); resolve(true); }
      function cancel(){ cleanup(); resolve(false); }

      cAccept.onclick = ok; cCancel.onclick = cancel;
      confirmEl.addEventListener("click", e => { if (e.target === confirmEl) cancel(); }, { once:true });
      const onKey = e => { if (e.key === "Escape"){ document.removeEventListener("keydown", onKey); cancel(); } };
      document.addEventListener("keydown", onKey, { once:true });
    });
  }

  async function loadMembers(clubId){
    try{
      const j = await apiFetch(`api/clubs/members/list.php?club_id=${clubId}`);
      if (j?.ok){ _members = j.items || []; renderRows(_members); }
      else { _members = []; renderRows([]); }
    }catch(_){ _members = []; renderRows([]); }
  }

  function renderRows(list){
    const tbody = document.getElementById("cvm-tbody");
    if (!tbody) return;

    if (!list.length){
      tbody.innerHTML = `<tr class="cvm-empty"><td colspan="5">No members yet.</td></tr>`;
      lockMembersViewport();
      return;
    }

    tbody.innerHTML = list.map((m, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${m.student_id || "—"}</td>
        <td>${m.name || "—"}</td>
        <td>${m.email || "—"}</td>
        <td class="cvm-row-actions">
          ${_modalEditable ? `<button type="button" class="btn-remove" data-cvm-remove="${m.student_id}">Remove</button>` : ``}
        </td>
      </tr>
    `).join("");

    lockMembersViewport();
  }

  // Remove member
  document.getElementById("cvm-tbody")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-cvm-remove]");
    if (!btn || !_modalEditable) return;
    const ok = await confirmDialog({ title:"Remove member?", message:"This action cannot be undone." });
    if (!ok) return;
    const sid = btn.getAttribute("data-cvm-remove");
    try{
      const j = await apiFetch('api/clubs/members/remove.php', {
        method:'POST',
        body: JSON.stringify({ club_id:_currentClubId, student_id:sid })
      });
      if (!j?.ok) throw new Error(j?.error || 'Remove failed');
      _members = _members.filter(m => m.student_id !== sid);
      runSearchRows();
    }catch(e){ alert((e?.err && e.err.error) || e.message || 'Remove failed'); }
  });

  // Member search within table
  const sInput = document.getElementById("cvm-search");
  const sBtn   = document.getElementById("cvm-search-btn");
  function runSearchRows(){
    const q = (sInput?.value || "").toLowerCase().trim();
    const res = !q ? _members : _members.filter(m =>
      (m.student_id || "").toLowerCase().includes(q) ||
      (m.name || "").toLowerCase().includes(q) ||
      (m.email || "").toLowerCase().includes(q)
    );
    renderRows(res);
  }

  /* ============ ORG: clubs inside modal ============ */
async function loadOrgClubs(orgId){
  try{
    const j = await apiFetch(`api/clubs/list.php?organization_id=${orgId}&limit=300`);
    _orgClubs = j?.ok ? (j.items || []) : [];
  }catch(_){ _orgClubs = []; }
  renderOrgRows(_orgClubs);
}

function renderOrgRows(list){
  const tbody = document.getElementById('cvm-org-tbody');
  if (!tbody) return;
  if (!list.length){
    tbody.innerHTML = `<tr class="cvm-empty"><td colspan="4">No clubs yet.</td></tr>`;
    lockMembersViewport();
    return;
  }
tbody.innerHTML = list.map((c,i)=>`
  <tr>
    <td>${i+1}</td>
    <td>${c.name || '—'}</td>
    <td>${c.category || '—'}</td>
  </tr>
`).join('');

  lockMembersViewport();
}

const orgQ = document.getElementById('cvm-org-q');
const orgQBtn = document.getElementById('cvm-org-q-btn');
function runOrgSearch(){
  const q = (orgQ?.value || '').toLowerCase().trim();
  const res = !q ? _orgClubs : _orgClubs.filter(c =>
    (c.name||'').toLowerCase().includes(q) ||
    (c.category||'').toLowerCase().includes(q)
  );
  renderOrgRows(res);
}
orgQBtn?.addEventListener('click', runOrgSearch);
orgQ?.addEventListener('input', runOrgSearch);


  sBtn?.addEventListener("click", runSearchRows);
  sInput?.addEventListener("input", runSearchRows);

  // Add member popover
  const addBtn = document.getElementById("cvm-add-btn");
  const pop = document.getElementById("cvm-add-pop");
  const popQ = document.getElementById("cvm-pop-q");
  const popResults = document.getElementById("cvm-pop-results");
  const popCancel = document.getElementById("cvm-pop-cancel");

  function showPop(){
    if (!pop || !_modalEditable) return;
    pop.hidden = false;
    if (popQ.value.trim()) runPopSearchNow(); else renderPopResults([]);
    setTimeout(()=>popQ.focus(),0);
  }

  function hidePop(){ if (pop) pop.hidden = true; }
  popCancel?.addEventListener("click", hidePop);
  document.addEventListener("click", (e)=>{
    if (!pop || pop.hidden) return;
    if (e.target === pop || pop.contains(e.target) || e.target === addBtn) return;
    hidePop();
  });
  addBtn?.addEventListener("click", ()=>{ if (pop?.hidden) showPop(); else hidePop(); });

  function renderPopResults(list){
    if (!popResults) return;
    if (!list.length){
      popResults.innerHTML = `<div class="cvm-pop-item"><div class="meta">No matches.</div></div>`;
      return;
    }
    popResults.innerHTML = list.map(s => `
      <div class="cvm-pop-item" data-sid="${s.student_id}">
        <div class="meta">
          <div>${s.name}</div>
          <div class="id">${s.student_id}</div>
        </div>
        <button type="button" data-pop-add="${s.student_id}">Add</button>
      </div>
    `).join("");
  }

  let __popSearchTimer = null;

  async function runPopSearchNow(){
    const q = (popQ?.value || "").trim();
    if (!q){ renderPopResults([]); return; }
    try{
      const j = await apiFetch(`api/clubs/members/search_candidates.php?q=${encodeURIComponent(q)}&limit=50`);
      renderPopResults(j?.ok ? (j.items || []) : []);
    }catch(_){
      renderPopResults([]);
    }
  }

  function runPopSearchDebounced(){
    clearTimeout(__popSearchTimer);
    __popSearchTimer = setTimeout(runPopSearchNow, 220);
  }

  popQ?.addEventListener("input", runPopSearchDebounced);
  popQ?.addEventListener("keydown", (e)=>{
    if (e.key === "Enter"){
      e.preventDefault();
      clearTimeout(__popSearchTimer);
      runPopSearchNow();
    }
  });

  popResults?.addEventListener("click", async (e)=>{
    const b = e.target.closest("[data-pop-add]");
    if (!b || !_modalEditable) return;
    const sid = b.getAttribute("data-pop-add");
    try{
      const j = await apiFetch('api/clubs/members/add.php', {
        method:'POST',
        body: JSON.stringify({ club_id:_currentClubId, student_id:sid })
      });
      if (!j?.ok) throw new Error(j?.error || 'Add failed');
      hidePop();
      if (!j.already && j.item){
        _members.push(j.item);
        runSearchRows(); // renderRows -> lockMembersViewport
      }
    }catch(e){ alert((e?.err && e.err.error) || e.message || 'Add failed'); }
  });
})();

// === SETTINGS: Save bridge (ClubDirectory) — shell-compatible, reload on success ===

// === Mobile bottom tabs + Settings overlay wiring (ClubDirectory) ===
(() => {
  const tabs = document.getElementById('mobileBottomTabs');
  const overlay = document.getElementById('settingsModalOverlay'); // in HTML
  const closeBtn = overlay?.querySelector('.settings-modal__close');

  // Helpers
  function openSettings() {
    if (!overlay) return;
    overlay.classList.add('active', 'open');
    overlay.removeAttribute('aria-hidden');
    document.body.classList.add('no-scroll');
  }
  function closeSettings() {
    if (!overlay) return;
    overlay.classList.remove('active', 'open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
  }

  // Close handlers
  closeBtn?.addEventListener('click', closeSettings);
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeSettings(); // click backdrop to close
  });

  // Bottom tabs route map
  const routes = {
    newsfeed: 'HomeNews.html',
    chat: 'Messages.html',
    club: 'ClubDirectory.html',
  };

  // Clicks on bottom tabs
  tabs?.addEventListener('click', (e) => {
    const a = e.target.closest('a.mbtab');
    if (!a) return;
    e.preventDefault();

    const label = (a.getAttribute('aria-label') || '').toLowerCase();
    if (label === 'settings') {
      openSettings();
      return;
    }
    const url = routes[label];
    if (url) location.assign(url);
  });

  // Mark current page on mobile tabs
  const current = tabs?.querySelector('[aria-label="Club"]');
  current?.setAttribute('aria-current', 'page');

  // Settings tabs switching (Account/Profile)
  const tabsWrap = document.querySelector('.settings-tabs');
  tabsWrap?.addEventListener('click', (e) => {
    const btn = e.target.closest('.settings-tab');
    if (!btn) return;
    const tab = btn.dataset.tab;

    document.querySelectorAll('.settings-tab').forEach(el => {
      const active = el === btn;
      el.classList.toggle('is-active', active);
      el.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    document.querySelectorAll('.settings-panel').forEach(p => {
      p.classList.toggle('is-active', p.dataset.panel === tab);
    });
  });
})();


(() => {
  if (window.__settings_save_bridge_clubs__) return;
  window.__settings_save_bridge_clubs__ = true;

  // Use a relative API path so adviser-shell.js can intercept/normalize
  const toApi = (p) => ('api/' + String(p).replace(/^\/?api\//, '').replace(/^\/+/, '')).replace(/\/{2,}/g, '/');

  // Settings overlay node (supports shell ids/classes)
  const overlayNode = () =>
    document.getElementById('settingsModalOverlay') ||
    document.getElementById('settingsOverlay') ||
    document.getElementById('settingsModal') ||
    document.querySelector('.settings-modal__overlay, .settings-modal');

  // Active slot <form>
  function currentSlotForm() {
    const ov = overlayNode();
    if (!ov) return null;
    const slot = ov.querySelector('.slot.open') || ov.querySelector('.slot');
    return (slot && slot.querySelector('form')) || ov.querySelector('form') || null;
  }

  // Guess which field this form edits
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

  // Field → endpoint (the shell shim can remap/normalize as needed)
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

  // Confirm modal (falls back to native confirm if missing)
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
      function done(v) {
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

  // Toast (minimal)
  function toast(msg, kind='ok') {
    let host = document.getElementById('__toastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = '__toastHost';
      host.style.cssText = 'position:fixed;right:16px;bottom:16px;display:flex;flex-direction:column;gap:8px;pointer-events:none;z-index:2147483647';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.role = 'status';
    el.style.cssText =
      `pointer-events:auto;background:${kind==='ok'?'#10b981':'#ef4444'};color:white;` +
      'padding:10px 12px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.12);' +
      'font:600 13px/1.3 system-ui,Segoe UI,Roboto,Arial;max-width:min(88vw,420px)';
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => { el.style.opacity='0'; setTimeout(()=>el.remove(), 280); }, 1400);
  }

  // Treat Save-like clicks inside the Settings overlay as "save"
  document.addEventListener('click', async (e) => {
    const ov = overlayNode();
    if (!ov) return;

    // Ignore clicks happening inside the confirm modal
    if (e.target.closest('#confirmModal')) return;

    // Find a "Save" control
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

    const form = currentSlotForm();
    if (!form) return;

    e.preventDefault();
    e.stopPropagation();

    const field = inferFieldKey(form);
    const endpoint = FIELD_MAP[field];
    if (!endpoint) { toast('Unknown settings form.', 'err'); return; }

    const pretty = { name:'name', email:'email', password:'password', nickname:'nickname', bio:'bio', birthdate:'birthdate', about_city:'town/city', contact_email:'contact email' };
    if (!(await showConfirm(`Save changes to ${pretty[field] || field}?`))) return;

    const submitBtn = form.querySelector('.btn-primary, button[type="submit"]');
    const prev = submitBtn && submitBtn.textContent;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

    try {
      // Build JSON body from the form (server expects JSON)
      const fd = new FormData(form);
      const body = {}; fd.forEach((v,k) => body[k] = v);

      const res = await fetch(toApi(endpoint), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body)
      });

      const text = await res.text();
      let j; try { j = JSON.parse(text); } catch { j = {}; }
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `Save failed (${res.status})`);


      // Close overlay & reload so everything reflects DB values
      ov.classList.remove('active');
      setTimeout(() => window.location.reload(), 350);

      // Optional: if you have hooks listening
      document.dispatchEvent(new CustomEvent('settings:afterSave'));
    } catch (err) {
      console.error(err);
      toast(err?.message || 'Error saving changes.', 'err');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = prev || 'Save changes'; }
    }
  });
})();

// Safety: hide bottom tabs on desktop via JS too (in case of CSS conflicts)
(() => {
  const tabs = document.getElementById('mobileBottomTabs');
  if (!tabs) return;
  const mq = window.matchMedia('(max-width: 1024px)');
  const sync = () => { tabs.style.display = mq.matches ? '' : 'none'; };
  mq.addEventListener?.('change', sync);
  sync();
})();
