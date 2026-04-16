// Student-ListOfClub.js
// Wires "View Details" to Student-ClubDetails.html?id=..., and hydrates thumbnails + member counts.
document.addEventListener("DOMContentLoaded", async () => {
  await Auth.requireAuth({ roles: ["student"] });
});


document.addEventListener('DOMContentLoaded', () => {
  // ===== Sidebar toggle (basis) =====
  document.getElementById('sidebarToggleBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.body.classList.toggle('sidebar-expanded');
  });

 
/* === Logout modal: robust wiring (desktop + mobile) — OUTSIDE DOMContentLoaded === */
(() => {
  if (window.__logout_bridge_init__) return;
  window.__logout_bridge_init__ = true;

  const LOGIN_REDIRECT = window.LOGOUT_REDIRECT || 'Login.html';

  function ensureOverlay() {
    let el =
      document.getElementById('logoutConfirmOverlay') ||
      document.querySelector('.logout-confirm__overlay, .logout-modal__overlay');

    if (!el) {
      el = document.createElement('div');
      el.id = 'logoutConfirmOverlay';
      el.className = 'logout-confirm__overlay';
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = `
        <div class="logout-confirm" role="dialog" aria-modal="true" aria-labelledby="logoutTitle">
          <h3 id="logoutTitle">Are you sure you want to log out?</h3>
          <div class="confirm-actions">
            <button type="button" class="btn btn-no" id="btnLogoutNo">No</button>
            <button type="button" class="btn btn-primary btn-yes" id="btnLogoutYes">Yes</button>
          </div>
        </div>`;
      document.body.appendChild(el);
    }
    return el;
  }

  const openOverlay = () => {
    const ov = ensureOverlay();
    ov.classList.add('active');
    ov.setAttribute('aria-hidden', 'false');
  };

  const closeOverlay = () => {
    const ov =
      document.getElementById('logoutConfirmOverlay') ||
      document.querySelector('.logout-confirm__overlay, .logout-modal__overlay');
    if (!ov) return;
    ov.classList.remove('active');
    ov.setAttribute('aria-hidden', 'true');
  };

  function onLogoutClick(e) {
    let trigger =
      e.target.closest('.logout-link, a[href="#logout"], [data-action="logout"], #logoutLink, #logout');

    if (!trigger) {
      const candidate = e.target.closest('a, button, [role="button"]');
      const label = (candidate?.textContent || '').trim().toLowerCase();
      if (candidate && /logout/.test(label)) trigger = candidate;
    }
    if (!trigger) return;

    e.preventDefault();
    e.stopPropagation();
    openOverlay();
  }

  // Bind in both phases so nothing eats the click
  document.addEventListener('click', onLogoutClick, true);
  document.addEventListener('click', onLogoutClick);

  // Delegate buttons inside overlay (works for existing or injected markup)
  document.addEventListener('click', (e) => {
    const ov = e.target.closest('#logoutConfirmOverlay, .logout-confirm__overlay, .logout-modal__overlay');
    if (!ov) return;

    if (e.target === ov || e.target.closest('.btn-no, #btnLogoutNo, [data-dismiss="modal"]')) {
      e.preventDefault();
      e.stopPropagation();
      closeOverlay();
      return;
    }

    if (e.target.closest('.btn-yes, #btnLogoutYes, [data-action="confirm-logout"]')) {
      e.preventDefault();
      e.stopPropagation();
      fetch('api/auth/logout.php', { method: 'POST', credentials: 'include' })
        .finally(() => { window.location.href = LOGIN_REDIRECT; });
    }
  });

  document.addEventListener('keydown', (e) => {
    const active = document.querySelector(
      '#logoutConfirmOverlay.active, .logout-confirm__overlay.active, .logout-modal__overlay.active'
    );
    if (e.key === 'Escape' && active) closeOverlay();
  });
})();

  // ===== Universal base/path helpers =====
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
      `../../${path}`,                 // supports deeper nesting
      `${PROJECT_BASE}/${path}`.replace(/\/{2,}/g,'/'),
    ];
  }

  async function apiFetch(path, opts = {}){
    const headers = {'Accept':'application/json'};
    if (opts.body && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    for (const url of apiCandidates(path)){
      try{
        const res = await fetch(url, { ...opts, headers:{...headers, ...(opts.headers||{})}, credentials:'include' });
        if (!res.ok){ try{ await res.json(); }catch{}; throw new Error(`HTTP ${res.status}`); }
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

  const norm = s => (s || '').toString().trim().toLowerCase().replace(/\s+/g,' ');

  // ===== Hydrate cards with DB data (thumbnail + member count) and wire buttons =====
  (async function hydrateAndWire(){
    let items = [];
    try{
      const j = await apiFetch('api/clubs/list.php?limit=200');
      if (j?.ok) items = j.items || [];
    }catch(e){
      console.warn('clubs/list fetch failed', e);
    }

    // Map: normalized club name -> club object
    const byName = new Map();
    items.forEach(c => byName.set(norm(c.name), c));

    const grid  = document.querySelector('.clubs-grid');
    const cards = Array.from(document.querySelectorAll('.clubs-grid .club-card'));
    const cardToClub = new WeakMap();

    function toDetailsUrl(club){
      const base = PROJECT_BASE || '';
      if (club && club.id) return `${base}/Student-ClubDetails.html?id=${encodeURIComponent(club.id)}`;
      const name = (club && club.name) ? encodeURIComponent(club.name) : '';
      return `${base}/Student-ClubDetails.html?name=${name}`;
    }

    cards.forEach(card => {
      const nameEl = card.querySelector('h2, .club-name, .card-title');
      if (!nameEl) return;

      const name = nameEl.textContent || '';
      const key  = norm(name);

      // Find best match
      let club = byName.get(key);
      if (!club) club = items.find(c => norm(c.name).includes(key) || key.includes(norm(c.name)));
      if (!club) return;

      // Keep linkable data on the card
      card.dataset.clubId = club.id;
      cardToClub.set(card, club);

      // Thumbnail (profile picture) — support <img> or div.bg
      const logoImg = card.querySelector('.club-logo, .logo, img.club-logo');
      if (logoImg) {
        if (logoImg.tagName === 'IMG') {
          if (club.profile_picture) {
            logoImg.src = mediaUrl(club.profile_picture);
            logoImg.alt = `${club.name} logo`;
          }
        } else {
          // likely a div with background
          if (club.profile_picture) {
            logoImg.style.backgroundImage = `url('${mediaUrl(club.profile_picture)}')`;
          }
        }
      }

      // Member count (expects an element with .members-count)
      const mEl = card.querySelector('.members-count, .club-member-count');
      const count = Number.isFinite(club.member_count) ? club.member_count : 0;
      if (mEl) mEl.textContent = `👥 ${count}`;

      // Wire any "View Details" trigger inside this card
      // Handles: [data-view-id], .club-btn, .view-details, a.view-details
      const triggers = card.querySelectorAll('[data-view-id], .club-btn, .view-details, a.view-details');
      triggers.forEach(el => {
        // normalize aria
        el.setAttribute('aria-label', `View ${club.name} details`);
        // If it's an anchor, set href; else, click -> navigate
        if (el.tagName === 'A') {
          el.href = toDetailsUrl(club);
        } else {
          el.addEventListener('click', (ev) => {
            ev.preventDefault();
            window.location.href = toDetailsUrl(club);
          }, { once:false });
        }
      });

      // If no explicit trigger, make the whole card clickable (optional)
      if (!card.querySelector('[data-view-id], .club-btn, .view-details, a.view-details')) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', (ev) => {
          // avoid hijacking inner buttons/links
          if (ev.target.closest('button, a')) return;
          window.location.href = toDetailsUrl(club);
        });
      }
    });

    // Fallback: event delegation (in case cards are dynamic later)
    if (grid){
      grid.addEventListener('click', (e) => {
        const t = e.target.closest('[data-view-id], .club-btn, .view-details, a.view-details, .club-card');
        if (!t) return;

        // If they clicked a specific trigger, use its parent card
        const card = t.classList.contains('club-card') ? t : t.closest('.club-card');
        if (!card) return;
        const club = cardToClub.get(card);

        if (club){
          if (t.tagName === 'A') {
            // let anchors with href work naturally (we already set href above)
            return;
          }
          e.preventDefault();
          window.location.href = toDetailsUrl(club);
        }
      });
    }
  })();
});


// === Clubs grid: dynamic from DB (api/clubs/list.php) ===
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const grid = $('.clubs-grid') || $('#clubsGrid');
  if (!grid) return;

  // Base + helpers
  const PROJECT_BASE =
    window.PROJECT_BASE ||
    (document.querySelector('base')?.href?.replace(/\/$/, '') || '');

  const toApi = (p) =>
    ('api/' + String(p).replace(/^\/?api\//, '').replace(/^\/+/, ''))
      .replace(/\/{2,}/g, '/');

  const mediaUrl = (path) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return (PROJECT_BASE ? PROJECT_BASE + '/' : '') + String(path).replace(/^\/+/, '');
  };

  async function apiFetch(path) {
    const res = await fetch(toApi(path), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    const text = await res.text();
    let j; try { j = JSON.parse(text); } catch { throw new Error(text || 'Bad JSON'); }
    if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);
    return j;
  }

  function toDetailsUrl(club) {
    const base = PROJECT_BASE ? PROJECT_BASE + '/' : '';
    if (club?.id != null && club.id !== '') {
      return `${base}Student-ClubDetails.html?id=${encodeURIComponent(club.id)}`;
    }
    if (club?.name) {
      return `${base}Student-ClubDetails.html?name=${encodeURIComponent(club.name)}`;
    }
    return `${base}Student-ClubDetails.html`;
  }

// much shorter snippet for the card body
function snippet(s, max = 60) {
  const txt = (s || '').toString().replace(/\s+/g, ' ').trim();
  if (txt.length <= max) return txt;
  const cut = txt.slice(0, max);
  const last = cut.lastIndexOf(' ');
  return (last > 20 ? cut.slice(0, last) : cut).trim() + '…';
}

function cardHTML(c) {
  const safe = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');

  const logo     = c.profile_picture ? mediaUrl(c.profile_picture) : '';
  const mcount   = Number.isFinite(+c.member_count) ? +c.member_count : '—';
  const category = c.category || c.type || 'Club';
  const adviser  = c.adviser_name || c.adviser_full_name || c.adviser || '—';
  const name     = safe(c.name || 'Untitled Club');

  // pull description from common fields, then make a neat snippet
  const descRaw  = c.description || c.about || c.summary || c.details || '';
  const desc     = safe(snippet(descRaw, 160));

  return `
    <article class="club-card" data-id="${c.id ?? ''}" data-name="${name}">
      <div class="card-header">
        <span class="badge">${safe(category)}</span>
        <span class="members-count">👥 ${mcount}</span>
      </div>

      <div class="club-title">
        ${logo
          ? `<img class="club-logo" src="${logo}" alt="${name} logo">`
          : `<div class="club-logo" aria-hidden="true"></div>`}
        <div><h2 class="club-name">${name}</h2></div>
      </div>

      ${desc ? `<p class="club-desc">${desc}</p>` : ''}

      <p class="club-adviser"><strong>Club Adviser:</strong> ${safe(adviser)}</p>

      <button class="btn-details view-details" type="button" data-view-id="${c.id ?? ''}">
        View Details
      </button>
    </article>
  `;
}

// Organization card (no avatar; 2 buttons)
function orgCardHTML(o){
  const safe = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const name = safe(o.name || 'Untitled Organization');
  const typ  = o.org_type || o.type || 'Organization';
  const clubs = Number.isFinite(+o.clubs_count) ? +o.clubs_count : (o.clubs || o.club_count || 0);
  const adviser = o.adviser_name || o.adviser_full_name || o.adviser_id || '—';
  const descRaw = o.description || o.about || '';
  const txt = (descRaw || '').toString().replace(/\s+/g,' ').trim();
  const desc = txt.length > 140 ? txt.slice(0, txt.slice(0,140).lastIndexOf(' ')).trim() + '…' : txt;

  return `
    <article class="club-card org-card" data-org-id="${o.id ?? ''}" data-org-name="${name}">
      <div class="card-header">
        <span class="badge">${safe(typ)}</span>
        <span class="members-count">🏷️ ${clubs} club${clubs===1?'':'s'}</span>
      </div>

      <div class="club-title">
        <div class="club-logo" aria-hidden="true" style="background:#f3f4f6;border:1px solid #e5e7eb;"></div>
        <div><h2 class="club-name">${name}</h2></div>
      </div>

      ${desc ? `<p class="club-desc">${safe(desc)}</p>` : ''}

      <p class="org-meta"><strong>Adviser:</strong> ${safe(adviser)}</p>

      <div class="btn-row">
        <button class="btn-details org-view-details" type="button" data-org-id="${o.id ?? ''}">View Details</button>
        <button class="btn-secondary org-view-clubs" type="button" data-org-id="${o.id ?? ''}" data-org-name="${name}">View Clubs</button>
      </div>
    </article>
  `;
}


let CURRENT_VIEW = 'clubs';       // 'clubs' | 'orgs'
document.body.classList.remove('orgs-mode');   // keep grid in normal (clubs) layout

let CURRENT_ORG = null;           // { id, name } when filtering by org

async function render(opts = {}) {
  const orgId = opts.orgId ?? CURRENT_ORG?.id ?? null;
  const orgName = opts.orgName ?? CURRENT_ORG?.name ?? null;
  CURRENT_VIEW = 'clubs';

  const q = orgId ? `api/clubs/list.php?limit=200&organization_id=${encodeURIComponent(orgId)}` 
                  : 'api/clubs/list.php?limit=200';

  grid.innerHTML = `<div class="hero-empty">Loading clubs${orgName ? ` in <b>${orgName}</b>` : ''}…</div>`;

  let items = [];
  try {
    const out = await apiFetch(q);
    items = out.items || out.data || out.list || [];
    // Safety: if backend didn't filter by organization_id, filter client-side
if (orgId) {
  const want = String(orgId);
  items = items.filter(x => String(x.organization_id ?? x.org_id ?? '') === want);
}

  } catch (err) {
    grid.innerHTML = `<div class="hero-empty">Couldn’t load clubs.<br><small>${(err.message || err).toString()}</small></div>`;
    return;
  }

  if (!items.length) {
    grid.innerHTML = `<div class="hero-empty">No clubs ${orgName ? `in <b>${orgName}</b>` : 'available yet'}.</div>`;
    return;
  }

  grid.innerHTML = items.map(cardHTML).join('');

  // Card clicks → club details
  grid.onclick = (e) => {
    const t = e.target.closest('[data-view-id], .view-details, .club-card');
    if (!t || !grid.contains(t)) return;
    const id = t.getAttribute('data-view-id') || t.closest('.club-card')?.dataset.id;
    const club = items.find(x => String(x.id) === String(id)) ||
                 items.find(x => (x.name||'') === (t.closest('.club-card')?.dataset.name||''));
    if (club) window.location.href = toDetailsUrl(club);
  };
}

async function renderOrgs() {
  CURRENT_VIEW = 'orgs';
  document.body.classList.add('orgs-mode');      // use fixed-width cards for orgs

  CURRENT_ORG = null;
  grid.innerHTML = `<div class="hero-empty">Loading organizations…</div>`;

  let items = [];
  try {
    const out = await apiFetch('api/organizations/list.php?status=active&limit=200');
    items = out.items || out.data || out.list || [];
  } catch (err) {
    grid.innerHTML = `<div class="hero-empty">Couldn’t load organizations.<br><small>${(err.message || err).toString()}</small></div>`;
    return;
  }

  if (!items.length) {
    grid.innerHTML = `<div class="hero-empty">No organizations found.</div>`;
    return;
  }

  grid.innerHTML = items.map(orgCardHTML).join('');

  // Buttons inside org cards
  grid.onclick = (e) => {
    const card = e.target.closest('.org-card');
    if (!card || !grid.contains(card)) return;

    const id = card.getAttribute('data-org-id');
    const name = card.getAttribute('data-org-name');

    // View Clubs → render clubs filtered by org
    if (e.target.closest('.org-view-clubs')) {
      CURRENT_ORG = { id, name };
      // toggle tabs
      document.querySelector('[data-view="orgs"]')?.classList.remove('is-active');
      document.querySelector('[data-view="clubs"]')?.classList.add('is-active');
      render({ orgId:id, orgName:name });
      return;
    }

    // View Details — link to org details page (you can change this path if different)
// View Details — reuse Club Details page and pass org params
// View Details — reuse Club Details page and pass org params
if (e.target.closest('.org-view-details')) {
  const base = (window.PROJECT_BASE ? window.PROJECT_BASE + '/' : '');
  const qs = new URLSearchParams({ org_id: id, org_name: name || '' });
  window.location.href = `${base}Student-ClubDetails.html?${qs}`;
  return;
}


  };
}


  // Kick off
// Tabs: Clubs / Organizations
const tabClubs = document.querySelector('.feed-tab[data-view="clubs"]');
const tabOrgs  = document.querySelector('.feed-tab[data-view="orgs"]');

tabClubs?.addEventListener('click', () => {
  tabClubs.classList.add('is-active');
  tabOrgs?.classList.remove('is-active');
  CURRENT_ORG = null;              // clear any org filter
  render();                        // show ALL clubs
});


tabOrgs?.addEventListener('click', () => {
  tabOrgs.classList.add('is-active');
  tabClubs?.classList.remove('is-active');
  renderOrgs();
});

// If URL has ?org_id=… open that org’s clubs; else default to Clubs tab
const params = new URLSearchParams(location.search);
const startOrgId = params.get('org_id');
const startOrgName = params.get('org_name');

if (startOrgId) {
  tabClubs?.classList.add('is-active');
  tabOrgs?.classList.remove('is-active');
  CURRENT_ORG = { id: startOrgId, name: startOrgName || '' };
  render({ orgId:startOrgId, orgName:startOrgName || '' });
} else {
  render(); // default: all clubs
}

})();

// === Settings slot shim for ListOfClubs — let shell own behavior; fill common empties ===
(() => {
  if (window.__loc_slot_shim__) return;
  window.__loc_slot_shim__ = true;

  const OVERLAY_SEL = '#settingsModalOverlay, .settings-modal__overlay';

  // Build API URL relative to this page (works under /capstone/…)
  const toApi = (p) => ('api/' + String(p).replace(/^\/?api\//, '').replace(/^\/+/, '')).replace(/\/{2,}/g, '/');

  async function fetchJSON(path) {
    const res = await fetch(toApi(path), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    const txt = await res.text();
    let j; try { j = JSON.parse(txt); } catch { throw new Error(txt || 'Bad JSON'); }
    if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);
    return j;
  }

  function splitFullName(n) {
    const parts = (n || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { first:'', middle:'', last:'' };
    const first = parts.shift() || '';
    const last  = parts.length ? parts.pop() : '';
    const middle = parts.join(' ');
    return { first, middle, last };
  }

  async function getFreshProfile() {
    let P = {}, WHO = {};
    try { const j = await fetchJSON('api/settings/get_profile.php'); P = j.item || {}; } catch {}
    try { const j = await fetchJSON('api/auth/whoami.php');        WHO = j.session || {}; } catch {}

    const full =
      P.full_name ||
      WHO.name ||
      (WHO.student && (WHO.student.full_name || `${WHO.student.first_name||''} ${WHO.student.last_name||''}`)) ||
      (WHO.adviser && (WHO.adviser.full_name || `${WHO.adviser.first_name||''} ${WHO.adviser.last_name||''}`)) ||
      '';

    const split = splitFullName(full);

    return {
      // names
      first_name  : P.first_name  || (WHO.student?.first_name  ?? WHO.adviser?.first_name)  || split.first  || '',
      middle_name : P.middle_name || (WHO.student?.middle_name ?? WHO.adviser?.middle_name) || split.middle || '',
      last_name   : P.last_name   || (WHO.student?.last_name   ?? WHO.adviser?.last_name)   || split.last   || '',
      // email
      email       : P.email || WHO.sti_email || WHO.email || '',
      // id
      student_id  : WHO.student_id || WHO.student?.id || '',
      // bio (support multiple profile field names)
      bio         : P.bio || P.about || P.about_me || P.profile_bio || ''
    };
  }

  function fillIfEmpty(form, data, li) {
    const prev = window.__allowProgrammaticSet;
    window.__allowProgrammaticSet = true;
    try {
      // Names
      if (form.elements.first_name  && !form.elements.first_name.value)  form.elements.first_name.value  = data.first_name;
      if (form.elements.middle_name && !form.elements.middle_name.value) form.elements.middle_name.value = data.middle_name;
      if (form.elements.last_name   && !form.elements.last_name.value)   form.elements.last_name.value   = data.last_name;

      // Email (cover `email` or `sti_email`)
      const emailEl = form.elements.email || form.elements.sti_email;
      if (emailEl && !emailEl.value) emailEl.value = data.email;

      // Student ID: input[name=student_id_display] or [name=student_id] + common label spots
      if (form.elements.student_id_display && !form.elements.student_id_display.value) {
        form.elements.student_id_display.value = data.student_id;
      }
      if (form.elements.student_id && !form.elements.student_id.value) {
        form.elements.student_id.value = data.student_id;
      }
      const idLabel =
        li?.querySelector('#studentIdLabel, [data-student-id], .student-id, .id-text, .id-label') ||
        form.querySelector('#studentIdLabel, [data-student-id], .student-id, .id-text, .id-label');
      if (idLabel && data.student_id) {
        const cur = (idLabel.textContent || '').trim();
        if (cur !== String(data.student_id)) idLabel.textContent = data.student_id;
      }

      // Bio (textarea/input name=bio; also try common alternates)
      const bioEl = form.elements.bio || form.elements.about || form.elements.about_me || form.querySelector('textarea[name="bio"]');
      if (bioEl && !bioEl.value) bioEl.value = data.bio;
    } finally {
      window.__allowProgrammaticSet = prev;
    }
  }

  function ensureOverlayObserver() {
    const ov = document.querySelector(OVERLAY_SEL);
    if (!ov || ov.__loc_observed__) return;
    ov.__loc_observed__ = true;

    const onForm = async (form) => {
      if (!form) return;

      // ✅ Let the shell own behavior: just make sure it recognizes the form.
      form.classList.add('slot-form');

      // Prefill common empties so this page matches others (shell still wins).
      const li = form.closest('li');
      try {
        const data = await getFreshProfile();
        fillIfEmpty(form, data, li);
      } catch {}
    };

    // Run now for any already-mounted slot
    ov.querySelectorAll('.slot form').forEach(onForm);

    // Run for future inserts (when rows are opened)
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes && m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches && node.matches('.slot form')) onForm(node);
          node.querySelectorAll && node.querySelectorAll('.slot form').forEach(onForm);
        });
      }
    });
    mo.observe(ov, { childList: true, subtree: true });
  }

  // Attach observer when Settings opens or a row is clicked
  document.addEventListener('click', (e) => {
    if (e.target.closest('.open-settings') || e.target.closest('.settings-chooser .choose-item')) {
      setTimeout(ensureOverlayObserver, 0);
    }
  });
})();
// === Settings bridge for ListOfClubs — shell-led, with safe fallbacks ===
(() => {
  if (window.__loc_settings_bridge__) return;
  window.__loc_settings_bridge__ = true;

  const OVERLAY_SEL = '#settingsModalOverlay, .settings-modal__overlay';
  const CONFIRM_SEL = '#confirmModal, .confirm-overlay';

  // Build API URL relative to this page
  const toApi = (p) => ('api/' + String(p).replace(/^\/?api\//, '').replace(/^\/+/, '')).replace(/\/{2,}/g, '/');

  async function fetchJSON(path) {
    const res = await fetch(toApi(path), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    const txt = await res.text();
    let j; try { j = JSON.parse(txt); } catch { throw new Error(txt || 'Bad JSON'); }
    if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);
    return j;
  }

  function splitFullName(n) {
    const a = (n || '').trim().split(/\s+/).filter(Boolean);
    if (!a.length) return { first:'', middle:'', last:'' };
    const first = a.shift() || '';
    const last  = a.length ? a.pop() : '';
    const middle = a.join(' ');
    return { first, middle, last };
  }

  async function getFreshProfile() {
    let P = {}, WHO = {};
    try { const r1 = await fetchJSON('api/settings/get_profile.php'); P = r1.item || {}; } catch {}
    try { const r2 = await fetchJSON('api/auth/whoami.php');        WHO = r2.session || {}; } catch {}

    const full =
      P.full_name ||
      WHO.name ||
      (WHO.student && (WHO.student.full_name || `${WHO.student.first_name||''} ${WHO.student.last_name||''}`)) ||
      (WHO.adviser && (WHO.adviser.full_name || `${WHO.adviser.first_name||''} ${WHO.adviser.last_name||''}`)) ||
      '';

    const split = splitFullName(full);
    return {
      first_name  : P.first_name  || (WHO.student?.first_name  ?? WHO.adviser?.first_name)  || split.first  || '',
      middle_name : P.middle_name || (WHO.student?.middle_name ?? WHO.adviser?.middle_name) || split.middle || '',
      last_name   : P.last_name   || (WHO.student?.last_name   ?? WHO.adviser?.last_name)   || split.last   || '',
      email       : P.email || WHO.sti_email || WHO.email || '',
      student_id  : WHO.student_id || WHO.student?.id || '',
      bio         : P.bio || P.about || P.about_me || P.profile_bio || ''
    };
  }

  function fillIfEmpty(form, data, li) {
    const prev = window.__allowProgrammaticSet;
    window.__allowProgrammaticSet = true;
    try {
      // Names
      if (form.elements.first_name  && !form.elements.first_name.value)  form.elements.first_name.value  = data.first_name;
      if (form.elements.middle_name && !form.elements.middle_name.value) form.elements.middle_name.value = data.middle_name;
      if (form.elements.last_name   && !form.elements.last_name.value)   form.elements.last_name.value   = data.last_name;

      // Email (email or sti_email)
      const emailEl = form.elements.email || form.elements.sti_email;
      if (emailEl && !emailEl.value) emailEl.value = data.email;

      // Student ID (editable or read-only)
      if (form.elements.student_id_display && !form.elements.student_id_display.value) {
        form.elements.student_id_display.value = data.student_id;
      }
      if (form.elements.student_id && !form.elements.student_id.value) {
        form.elements.student_id.value = data.student_id;
      }
      const idLabel =
        li?.querySelector('#studentIdLabel, [data-student-id], .student-id, .id-text, .id-label') ||
        form.querySelector('#studentIdLabel, [data-student-id], .student-id, .id-text, .id-label');
      if (idLabel && data.student_id) {
        const cur = (idLabel.textContent || '').trim();
        if (cur !== String(data.student_id)) idLabel.textContent = data.student_id;
      }

      // Bio (textarea/input)
      const bioEl = form.elements.bio || form.elements.about || form.elements.about_me || form.querySelector('textarea[name="bio"]');
      if (bioEl && !bioEl.value) bioEl.value = data.bio;
    } finally {
      window.__allowProgrammaticSet = prev;
    }
  }

  function ensureOverlayObserver() {
    const ov = document.querySelector(OVERLAY_SEL);
    if (!ov || ov.__loc_observed__) return;
    ov.__loc_observed__ = true;

    const onForm = async (form) => {
      if (!form) return;

      // Make sure the shell recognizes it
      form.classList.add('slot-form');

      // Set data-field for shells that look at it
      const li  = form.closest('li');
      const key = (form.dataset.field || li?.querySelector('.slot')?.dataset?.key || '').toLowerCase();
      if (key && !form.dataset.field) form.dataset.field = key;

      // Prefill empties (Name, Email, Student ID, Bio)
      try {
        const data = await getFreshProfile();
        fillIfEmpty(form, data, li);
      } catch {}
    };

    // Existing forms
    ov.querySelectorAll('.slot form').forEach(onForm);

    // Future forms (when rows open)
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes && m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches?.('.slot form')) onForm(node);
          node.querySelectorAll?.('.slot form').forEach(onForm);
        });
      }
    });
    mo.observe(ov, { childList: true, subtree: true });
  }

  // Re-click a row collapses it (only when already open)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.settings-chooser .choose-item');
    if (!btn) return;
    const li = btn.closest('li');
    const slot = li && li.querySelector('.slot.open');
    if (!slot) return; // let the shell handle opening
    e.preventDefault();
    e.stopPropagation();
    slot.style.maxHeight = slot.scrollHeight + 'px';
    requestAnimationFrame(() => {
      slot.classList.remove('open');
      slot.style.maxHeight = '0px';
      setTimeout(() => { slot.style.maxHeight = ''; }, 300);
    });
  }, true);



  // Arm the observer whenever Settings opens / a row is clicked
  document.addEventListener('click', (e) => {
    if (e.target.closest('.open-settings') || e.target.closest('.settings-chooser .choose-item')) {
      setTimeout(ensureOverlayObserver, 0);
    }
  });
})();

// === ListOfClubs • Confirm + Save bridge (uses existing #confirmModal) ===
(() => {
  if (window.__loc_confirm_save_bridge__) return;
  window.__loc_confirm_save_bridge__ = true;

  const OVERLAY_SEL = '#settingsModalOverlay, .settings-modal__overlay';
  const CONFIRM_SEL = '#confirmModal, .confirm-modal__overlay, .confirm-overlay';

  // Relative API helper (works from nested pages)
  const toApi = (typeof window.toApi === 'function')
    ? window.toApi
    : (p) => ('api/' + String(p).replace(/^\/?api\//, '').replace(/^\/+/, '')).replace(/\/{2,}/g, '/');

  const ACCOUNT_KEYS = new Set(['name', 'email', 'password']);
  let pendingForm = null;

  function ensureConfirmModal() {
    let cm = document.querySelector(CONFIRM_SEL);
    if (cm) return cm;

    // Fallback: create a minimal confirm modal if not present
    cm = document.createElement('div');
    cm.id = 'confirmModal';
    cm.className = 'confirm-modal__overlay';
    cm.setAttribute('aria-hidden', 'true');
    cm.innerHTML = `
      <div class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
        <h3 id="confirmTitle">Apply these changes?</h3>
        <div class="confirm-actions">
          <button type="button" class="btn btn-no" id="btnConfirmNo">Cancel</button>
          <button type="button" class="btn btn-primary btn-yes" id="btnConfirmYes">Yes, save</button>
        </div>
      </div>`;
    document.body.appendChild(cm);
    return cm;
  }

  function openConfirm(form) {
    pendingForm = form || pendingForm;
    const cm = ensureConfirmModal();
    cm.classList.add('active', 'open', 'show');
    cm.setAttribute('aria-hidden', 'false');
  }

  function closeConfirm() {
    const cm = document.querySelector(CONFIRM_SEL);
    if (!cm) return;
    cm.classList.remove('active', 'open', 'show');
    cm.setAttribute('aria-hidden', 'true');
    pendingForm = null;
  }

  // 1) Click → submit: ensure any “Save changes” button triggers a form submit
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, [role="button"], a');
    if (!btn) return;

    // Prefer nearest form; else use the open slot’s form in the overlay
    let form = btn.closest('form');
    if (!form) {
      const ov = document.querySelector(OVERLAY_SEL);
      form = ov?.querySelector('.slot.open form') || null;
    }
    if (!form) return;
    if (!form.closest(OVERLAY_SEL)) return;
    if (!form.classList.contains('slot-form')) return;

    const label = (btn.textContent || '').toLowerCase().trim();
    const isSaveBtn =
      btn.type === 'submit' ||
      btn.matches('[type="submit"], .btn-primary, .btn-save, [data-save]') ||
      /save/.test(label);

    if (!isSaveBtn) return;

    e.preventDefault();
    e.stopPropagation();

    // Submit programmatically so our submit handler opens the confirm
    if (typeof form.requestSubmit === 'function') form.requestSubmit();
    else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }, true);

  // 2) Submit (capture): stop native refresh, show confirm, and own the flow here
  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.closest(OVERLAY_SEL)) return;
    if (!form.classList.contains('slot-form')) return;

    e.preventDefault();
    e.stopImmediatePropagation(); // ensure shell/native don’t race us here
    openConfirm(form);
  }, true);

  // 3) Confirm handlers
  document.addEventListener('click', async (e) => {
    const noBtn  = e.target.closest('#btnConfirmNo, .btn-no');
    const yesBtn = e.target.closest('#btnConfirmYes, .btn-yes');

    if (!noBtn && !yesBtn) return;

    e.preventDefault();
    e.stopPropagation();

    if (noBtn) { closeConfirm(); return; }

    // Yes
    const form = pendingForm;
    if (!form) { closeConfirm(); return; }

    const li  = form.closest('li');
    // Determine the field key
    let key =
      (form.dataset.field || form.getAttribute('data-field') || '').toLowerCase() ||
      (li?.querySelector('[data-key]')?.getAttribute('data-key') || '').toLowerCase();

    // Last-resort inference by present inputs
    if (!key) {
      if (form.elements.sti_email || form.elements.email) key = 'email';
      else if (form.elements.current_password || form.elements.new_password || form.elements.password) key = 'password';
      else if (form.elements.first_name || form.elements.last_name) key = 'name';
      else if (form.elements.bio || form.elements.about || form.elements.about_me) key = 'bio';
      else if (form.elements.student_id || form.elements.student_id_display) key = 'student_id_display';
    }

    // Choose endpoint: account vs profile
    const endpoint = ACCOUNT_KEYS.has(key)
      ? 'api/settings/update_account.php'
      : 'api/settings/update_profile.php';

    const url = toApi(endpoint);
    const fd  = new FormData(form);
    if (key && !fd.has('field')) fd.set('field', key);

    try {
      const res = await fetch(url, { method: 'POST', body: fd, credentials: 'include', cache: 'no-store' });
      const text = await res.text();
      // accept non-JSON success; treat JSON with ok:false as error
      let j; try { j = JSON.parse(text); } catch { j = null; }
      if (!res.ok || (j && j.ok === false)) throw new Error(j?.error || `HTTP ${res.status}`);

      closeConfirm();

      // Collapse the slot after save (same feel as other pages)
      const slot = li?.querySelector('.slot.open');
      if (slot) {
        slot.style.maxHeight = slot.scrollHeight + 'px';
        requestAnimationFrame(() => {
          slot.classList.remove('open');
          slot.style.maxHeight = '0px';
          setTimeout(() => { slot.style.maxHeight = ''; }, 300);
        });
      }
    } catch (err) {
      alert(err?.message || 'Save failed.');
    }
  }, true);
})();
/* === Logout modal: final catch-all for Yes/No clicks (page-safe) === */
(() => {
  if (window.__logout_click_bridge__) return;
  window.__logout_click_bridge__ = true;

  const LOGIN_REDIRECT = window.LOGOUT_REDIRECT || 'index.html';

  // Handle Yes/No clicks for ANY logout modal variant on this page.
  document.addEventListener('click', (e) => {
    // Accept any of these as the modal container
    const modal = e.target.closest(
      '#logoutConfirmOverlay, .logout-confirm__overlay, .logout-modal__overlay, ' +
      '.logout-confirm, #logoutModal, [data-modal="logout"]'
    );
    if (!modal) return;

    // Buttons we accept as "No" or "Yes"
    const noBtn  = e.target.closest('#btnLogoutNo, .btn-no, [data-dismiss="modal"]');
    const yesBtn = e.target.closest('#btnLogoutYes, .btn-yes, [data-action="confirm-logout"]');

    if (!noBtn && !yesBtn) return;

    e.preventDefault();
    e.stopPropagation();

    if (noBtn) {
      // Close the modal (cover common class/aria patterns)
      modal.classList.remove('active', 'open', 'show', 'is-open');
      modal.setAttribute?.('aria-hidden', 'true');
      return;
    }

    // YES → call backend, then redirect
    fetch('api/auth/logout.php', { method: 'POST', credentials: 'include' })
      .finally(() => { window.location.href = LOGIN_REDIRECT; });
  }, true); // capture so nothing swallows the click first
})();
