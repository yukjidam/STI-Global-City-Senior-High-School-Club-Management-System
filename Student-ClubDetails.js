// ---- Global shim for URL query params (prevents "getParam is not defined") ----
if (typeof window.getParam !== "function") {
  window.getParam = function (name, fallback = "") {
    try {
      const v = new URL(window.location.href).searchParams.get(name);
      return v === null ? fallback : v;
    } catch {
      return fallback;
    }
  };
}



// Student-ClubDetails.js — fetch club details + show 6 random "Other Clubs" + Join + Cancel Request
document.addEventListener("DOMContentLoaded", async () => {
  await Auth.requireAuth({ roles: ["student" ] });
});



// ADD: Auto "No post available" note when the feed is empty
(function watchFeedEmpty(){
  const list  = document.getElementById('feedList');
  const title = document.getElementById('recentPostsTitle');
  if (!list || !title) return;

  const ensure = () => {
    const noteId = 'postsEmptyNote';
    const exists = document.getElementById(noteId);
    const hasPosts = !!list.querySelector('.feed-post');
    if (!hasPosts && !exists) {
      const note = document.createElement('div');
      note.id = noteId;
      note.className = 'posts-empty-note';
      note.textContent = 'No post available';
      title.insertAdjacentElement('afterend', note);
    } else if (hasPosts && exists) {
      exists.remove();
    }
  };

  // Initial & whenever list changes
  ensure();
  new MutationObserver(ensure).observe(list, { childList: true });
})();


(function(){
  // ---------- BASE HELPERS ----------

  function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

async function apiFetch(path, opts = {}) {
  // Build one stable URL: prefix relative paths with /capstone/
  const url = /^(https?:)?\//.test(path) ? path : `/capstone/${path}`.replace(/\/{2,}/g, '/');

  const headers = { 'Accept': 'application/json' };
  if (opts.body && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res  = await fetch(url, { ...opts, headers: { ...headers, ...(opts.headers||{}) }, credentials: 'include' });
  const text = await res.text();

  let data;
  try { data = JSON.parse(text); }
  catch (e) {
    console.error('Non-JSON from', url, '→', text.slice(0, 600));
    throw new Error('Server returned non-JSON');
  }

  if (!res.ok || (data && data.ok === false)) {
    const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    const err = new Error(msg); err.status = res.status; err.payload = data;
    throw err;
  }
  return data;
}

// === Keep "About this club" the same height as the Adviser card ===
function syncAboutHeight() {
  const about   = document.querySelector('.card.card-about');
  const adviser = document.querySelector('.right-stack .card'); // the "Club Adviser" card
  if (!about || !adviser) return;

  const h = adviser.getBoundingClientRect().height;
  if (!h) return;

  // match container height exactly
  about.style.height    = h + 'px';
  about.style.minHeight = h + 'px';
  about.style.maxHeight = h + 'px';

  // ensure only the description inside scrolls
  const body = about.querySelector('.card-body');
  if (body) {
    body.style.minHeight = '0';
    body.style.flex = '1 1 auto';
    body.style.overflow = 'auto';
    body.style.webkitOverflowScrolling = 'touch';
  }
}

// run on load / resize
window.addEventListener('load',   () => requestAnimationFrame(syncAboutHeight));
window.addEventListener('resize', () => requestAnimationFrame(syncAboutHeight));

// re-sync if adviser card’s content changes (images, member count, etc.)
new ResizeObserver(() => syncAboutHeight())
  .observe(document.querySelector('.right-stack .card') || document.body);
  syncAboutHeight();



function mediaUrl(rel, hint) {
  if (!rel) return "";
  const s0 = String(rel).trim();

  // absolute or data URLs – leave as-is
  if (/^https?:\/\//i.test(s0) || s0.startsWith("data:")) return s0;

  // if it already starts with "capstone/", don't prefix PROJECT_BASE again
  if (/^\/?capstone\//i.test(s0)) {
    return "/" + s0.replace(/^\/+/, "");
  }

  // if path contains ".../uploads/...", keep only from "uploads/" onward
  let s = s0;
  const j = s.toLowerCase().indexOf("uploads/");
  if (j > 0) s = s.slice(j);

  // if it’s just a filename, put it in a sensible folder
  if (!/^uploads\//i.test(s)) {
    if (hint === "events")   s = `uploads/events/${s}`;
    else if (hint === "content") s = `uploads/content/${s}`;
  }

  const base = PROJECT_BASE || "";
  return `${base}/${s.replace(/^\/+/, "")}`.replace(/\/{2,}/g, "/");
}


  // ---------- DOM REFS ----------
  const coverEl   = document.getElementById('club-cover');
  const avatarEl  = document.getElementById('club-avatar');
  const nameEl    = document.getElementById('club-name');
  const subEl     = document.getElementById('club-sub');        // hidden via CSS
  const descEl    = document.getElementById('club-desc');
  const advAvatar = document.getElementById('adv-avatar');
  const advName   = document.getElementById('adv-name');
  const advEmail  = document.getElementById('adv-email');
  const suggestUl = document.getElementById('suggest-list');
  const joinBtn   = document.getElementById('join-btn');
  const advMembers= document.getElementById('member-count');

  // Cancel button will be created dynamically
  let cancelBtn = null;

let CURRENT_CLUB_ID = 0;
// Resolve clubId once from the URL and expose it globally
document.addEventListener('DOMContentLoaded', () => {
  CURRENT_CLUB_ID = +(getParam('id') || 0);
  window.CURRENT_CLUB_ID = CURRENT_CLUB_ID;
});

// store current club/org avatar for author photos in feed
let CURRENT_CLUB_AVATAR_URL = '';
// shared state for the members modal + winners overlay
const STATE = { members: [], winnersMap: {} };


  document.addEventListener('DOMContentLoaded', init);

let __electionPollClub = null;
let __electionPollOrg  = null;
// winners + members used by the members modal
let __WINNERS_MAP = {};        // { user_id -> ['Club Representative', ...] }
let __MEMBERS_CACHE = [];      // latest members for this club


function startElectionPoll(clubId, electionId, card) {
  // CLUB poll
  stopElectionPoll(); // stop only CLUB timer
  const tick = async () => {
    try {
      const data = await apiFetch(`api/elections/list.php?club_id=${encodeURIComponent(clubId)}`);
      if (!data || !data.ok || !data.election || data.election.id !== electionId) return;
      applyLiveTallies(card, data.positions, data.candidates, data.totals);
    } catch {}
  };
  __electionPollClub = setInterval(tick, 3000);
  tick();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopElectionPoll();
    else startElectionPoll(clubId, electionId, card);
  }, { once: true });
}

function startElectionPollOrg(orgId, electionId, card) {
  // ORG poll
  stopElectionPollOrg(); // stop only ORG timer
  const tick = async () => {
    try {
      const data = await apiFetch(`api/elections/list.php?org_id=${encodeURIComponent(orgId)}`);
      if (!data || !data.ok || !data.election || data.election.id !== electionId) return;
      applyLiveTallies(card, data.positions, data.candidates, data.totals);
    } catch {}
  };
  __electionPollOrg = setInterval(tick, 3000);
  tick();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopElectionPollOrg();
    else startElectionPollOrg(orgId, electionId, card);
  }, { once: true });
}

function stopElectionPoll() {
  // stop CLUB only
  if (__electionPollClub) clearInterval(__electionPollClub);
  __electionPollClub = null;
}
function stopElectionPollOrg() {
  // stop ORG only
  if (__electionPollOrg) clearInterval(__electionPollOrg);
  __electionPollOrg = null;
}


// update the DOM bars/labels only
function applyLiveTallies(container, positions, candidates, totals) {
  const scope = container || document;                    // fallback just in case
  const byPos = new Map();
  for (const c of candidates) {
    if (c.status !== 'approved') continue;
    if (!byPos.has(c.position_id)) byPos.set(c.position_id, []);
    byPos.get(c.position_id).push(c);
  }
  for (const p of positions) {
    const total = totals[p.id] || 0;

    const head = scope.querySelector(`.pos-group[data-position="${p.id}"] .pos-total`);
    if (head) head.textContent = `${total} total vote(s)`;

    const group = byPos.get(p.id) || [];
    for (const c of group) {
      const pill = scope.querySelector(`.pos-group[data-position="${p.id}"] .candidate[data-id="${c.id}"] .badge.approved`);
      if (pill) pill.textContent = `${c.votes || 0} vote(s)`;

      const fill = scope.querySelector(`.pos-group[data-position="${p.id}"] .candidate[data-id="${c.id}"] .bar .fill`);
      if (fill) {
        const pct = total ? Math.round((c.votes || 0) * 100 / total) : 0;
        fill.style.width = `${pct}%`;
      }
    }
  }
}

// === Winners overlay =====================================================
let __ELECTION_WINNERS = null; // { user_id:number -> [positionTitle,...] }

function computeWinnersMap(positions, candidates) {
  // group approved candidates by position
  const byPos = new Map();
  for (const c of candidates) {
    if (c.status !== 'approved') continue;
    if (!byPos.has(c.position_id)) byPos.set(c.position_id, []);
    byPos.get(c.position_id).push(c);
  }
  const posById = new Map(positions.map(p => [p.id, p]));
  const winners = {}; // user_id -> [titles]

  for (const [posId, list] of byPos.entries()) {
    const pos = posById.get(posId);
    const maxWinners = Number(pos?.max_winners || 1);

    // sort by votes desc, id asc (stable)
    const sorted = list.slice().sort((a,b) => (b.votes||0) - (a.votes||0) || a.id - b.id);
    const take = Math.max(1, maxWinners);
    for (let i = 0; i < Math.min(take, sorted.length); i++) {
      const w = sorted[i];
      const title = pos?.title || pos?.name || 'Winner';
      if (!winners[w.user_id]) winners[w.user_id] = [];
      winners[w.user_id].push(title);
    }
  }
  return winners;
}

/** Attach synthetic role(s) and sort winners first */
function decorateMembersWithWinners(members) {
  if (!__ELECTION_WINNERS) return members.slice();
  const out = members.map(m => {
    const roles = __ELECTION_WINNERS[m.user_id];
    return { ...m, election_role: roles ? roles.join(', ') : null };
  });
  out.sort((a, b) => {
    // winners first; if both winner/non-winner, keep original order
    const aw = a.election_role ? 1 : 0;
    const bw = b.election_role ? 1 : 0;
    return bw - aw;
  });
  return out;
}
// ========================================================================
// Delegated close for any element with data-close="#modalId"
document.addEventListener('click', (e) => {
  const closer = e.target.closest('[data-close]');
  if (!closer) return;
  const sel = closer.getAttribute('data-close');
  if (!sel) return;

  // Ensure it's not acting like a submit button
  if (closer.matches('button') && closer.getAttribute('type') !== 'button') {
    closer.setAttribute('type', 'button');
  }

  // Use your existing closeModal if present; otherwise hide overlay
  if (typeof closeModal === 'function') {
    closeModal(sel);
  } else {
    const overlay = document.querySelector(sel);
    if (overlay) overlay.setAttribute('aria-hidden', 'true');
  }
});


// ---- Self-routing helpers (no query) ----
async function getCurrentUser() {
  try {
    // Prefer your whoami endpoint
    const r = await apiFetch('api/auth/whoami.php');
    const session = r?.session || {};
    const me      = r?.me || {};
    const role    = String(me.role || session.role || '').toLowerCase();

    // Normalize IDs across shapes
    const student_id = me.student_id
                    ?? session?.student?.id
                    ?? session?.student?.student_id
                    ?? null;
    const adviser_id = me.adviser_id
                    ?? session?.adviser?.id
                    ?? null;

    return { role, student_id, adviser_id, raw: r };
  } catch {
    return null;
  }
}

// === Adviser avatar resolver ======================================
function applyAdviserCard({ name, email, photo } = {}) {
  const advAvatar = document.getElementById('adv-avatar');
  const advName   = document.getElementById('adv-name');
  const advEmail  = document.getElementById('adv-email');

  if (!advAvatar || !advName || !advEmail) return;

  advName.textContent  = name  || advName.textContent || '—';
  advEmail.textContent = email || advEmail.textContent || '';

  // set background only if we have a photo
  if (photo) {
    advAvatar.style.backgroundImage = `url('${mediaUrl(photo, "content")}')`;
    advAvatar.style.backgroundSize = 'cover';
    advAvatar.style.backgroundPosition = 'center';
    advAvatar.style.borderRadius = '50%';
  }
}

// Try common fields on any payload shape
function pickAdviserFields(obj) {
  if (!obj) return {};
  const a = obj.adviser || obj.owner || obj.adviserDetails || {};
  const name  = obj.adviser_name || a.full_name || a.name || '';
  const email = obj.adviser_email || a.email || a.sti_email || a.contact || '';
  const photo = obj.adviser_profile_picture || obj.adviser_picture || obj.adviser_photo || obj.adviser_image
             || a.profile_picture || a.profile_photo || a.avatar || a.photo || a.image || '';
  return { name, email, photo };
}

// Try to resolve adviser profile_picture from common adviser endpoints if club/org payload lacks it
async function fetchAdviserPhotoFallback({ adviser_id = 0, email = '' } = {}) {
  const urls = [];

  // Prefer id-based lookups (try a few common shapes)
  if (adviser_id) {
    urls.push(
      `api/advisers/get.php?id=${encodeURIComponent(adviser_id)}`,
      `api/advisers/get.php?adviser_id=${encodeURIComponent(adviser_id)}`,
      `api/advisers/profile.php?id=${encodeURIComponent(adviser_id)}`,
      `api/advisers/list.php?id=${encodeURIComponent(adviser_id)}`,
      `api/advisers/list.php?adviser_id=${encodeURIComponent(adviser_id)}`
    );
  }

  // Email fallbacks if no id or id didn’t work
  if (email) {
    urls.push(
      `api/advisers/get.php?email=${encodeURIComponent(email)}`,
      `api/advisers/list.php?email=${encodeURIComponent(email)}`,
      `api/advisers/list.php?sti_email=${encodeURIComponent(email)}`
    );
  }

  for (const u of urls) {
    try {
      const r = await apiFetch(u);
      const payload = r?.item || r?.adviser || r?.data || r || {};
      const a = payload.adviser || payload;
      const photo = a.profile_picture || a.profile_photo || a.avatar || a.photo || a.image || payload.adviser_profile_picture;
      if (photo) return photo;
    } catch { /* ignore and try next */ }
  }
  return '';
}


// Fetch a details blob and stamp adviser card
async function refreshAdviserAvatar({ clubId = 0, orgId = 0 } = {}) {
  try {
    let data = null;

    // Prefer club details if we know the club page id
    if (clubId) {
      // Try a few common endpoints—first one that resolves wins
      const urls = [
        `api/clubs/get.php?id=${encodeURIComponent(clubId)}`,
        `api/clubs/get.php?id=${encodeURIComponent(clubId)}`,
        `api/clubs/view.php?club_id=${encodeURIComponent(clubId)}`
      ];
      for (const u of urls) {
        try { data = await apiFetch(u); if (data) break; } catch {}
      }
if (data) {
  // also check common wrappers like { ok, item: {...} }
  let fields = pickAdviserFields(data) || pickAdviserFields(data.data) || pickAdviserFields(data.item) || {};

  // If no photo in the club payload, try adviser endpoints using id/email we have
  if (!fields.photo) {
    const root = data.item || data.data || data || {};
    const meta = {
      adviser_id: root.adviser_id || root?.adviser?.id || 0,
      email: root.adviser_email || root?.adviser?.email || root?.adviser?.sti_email || ''
    };
    const photo = await fetchAdviserPhotoFallback(meta);
    if (photo) fields.photo = photo;
  }

  applyAdviserCard(fields);
  return;
}

    }

    // Fall back to org details if we’re in org scope
    if (orgId) {
const urls = [
  `api/organizations/get.php?id=${encodeURIComponent(orgId)}`,
  `api/organizations/details.php?org_id=${encodeURIComponent(orgId)}`
];

      for (const u of urls) {
        try { data = await apiFetch(u); if (data) break; } catch {}
      }
if (data) {
  let fields = pickAdviserFields(data) || pickAdviserFields(data.data) || pickAdviserFields(data.item) || {};

  if (!fields.photo) {
    const root = data.item || data.data || data || {};
    const meta = {
      adviser_id: root.adviser_id || root?.adviser?.id || 0,
      email: root.adviser_email || root?.adviser?.email || root?.adviser?.sti_email || ''
    };
    const photo = await fetchAdviserPhotoFallback(meta);
    if (photo) fields.photo = photo;
  }

  applyAdviserCard(fields);
}

    }
  } catch {
    // silent fail; card will just keep the placeholder
  }
}



// --- helper: is the current user a member of this club? ---
async function isMemberOfClub(clubId) {
  clubId = Number(clubId || window.CURRENT_CLUB_ID || getParam('id') || 0);
  if (!clubId) return false;  // avoid /list.php?club_id=0 (400)

  try {
    const me = await getCurrentUser();          // {role, student_id, ...} or null
    if (!me || !me.student_id) return false;    // not logged-in student → treat as non-member
    const sid   = Number(me.student_id);
    const email = (me.raw?.me?.sti_email || me.raw?.session?.sti_email || '').toLowerCase();

    const r = await apiFetch(`api/clubs/members/list.php?club_id=${encodeURIComponent(clubId)}`);
    const items = r?.items || [];
    return items.some(m =>
      Number(m.student_id) === sid ||
      String(m.email || '').toLowerCase() === email
    );
  } catch {
    return false; // on API error, be safe: treat as non-member
  }
}



// Render the current positions into #posList
// Render the current positions into #posList (club OR org)
async function renderPositionsList(electionArg) {
  const list = document.getElementById('posList');
  if (!list) return;

  // Pull scope reliably from arg OR the modal
  const modal  = document.getElementById('modalManagePositions');
  const kind   = String(electionArg?.kind || modal?.dataset.kind || 'club').toLowerCase();
  const orgId  = +(electionArg?.org_id  || modal?.dataset.orgId  || window.CURRENT_ORG_ID  || 0);
  const clubId = +(electionArg?.club_id || modal?.dataset.clubId || window.CURRENT_CLUB_ID || 0);

  let bundle = null;
  try {
    if (kind === 'org') {
      if (!orgId) throw new Error('Missing org_id for organization election');
      bundle = await fetchElectionBundleOrg(orgId);
    } else {
      if (!clubId) throw new Error('Missing club_id for club election');
      bundle = await fetchElectionBundle(clubId);
    }
  } catch (err) {
    console.error('renderPositionsList: fetch failed:', err);
  }

  const positions = Array.isArray(bundle?.positions) ? bundle.positions : [];

  list.innerHTML = positions.length
    ? positions.map(p => `
        <div class="pos-row" data-id="${p.id}"
             style="display:flex;align-items:center;gap:.5rem;justify-content:space-between;padding:.35rem 0;">
          <div>
            <strong>${p.title || p.name}</strong>
            <small style="opacity:.75">• max ${p.max_winners || 1}</small>
          </div>
          <button class="btn btn-danger btn-del-pos" data-id="${p.id}">Delete</button>
        </div>
      `).join('')
    : `<div class="muted">No positions yet.</div>`;

  // Delete wiring
  list.querySelectorAll('.btn-del-pos').forEach(btn => {
    btn.addEventListener('click', async () => {
      const posId = +btn.dataset.id;
      if (!posId) return;
      if (!confirm('Remove this position?')) return;

      try {
        await apiFetch('api/elections/position_delete.php', {
          method: 'POST',
          body: JSON.stringify({ position_id: posId })
        });
      } catch (err) {
        console.error('position_delete failed:', err);
      }

      // Stable context for refresh
      const nextElection = {
        id: +(modal?.dataset.electionId || electionArg?.id || 0),
        kind,
        org_id:  (kind === 'org'  ? orgId  : undefined),
        club_id: (kind === 'club' ? clubId : undefined),
      };

      await renderPositionsList(nextElection);
      await remountElectionCard(nextElection);
    });
  });
}



// one-time wire for Add form
(function wireAddPositionForm(){
  const form = document.getElementById('formAddPos');
  if (!form || form.dataset.wired === '1') return;
  form.dataset.wired = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const modal = document.querySelector('#modalManagePositions');
    const eid = +(modal?.dataset.electionId || 0);
    const fd  = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const max  = parseInt(String(fd.get('max_winners') || '1'), 10) || 1;
    if (!eid || !name) return;

    await apiFetch('api/elections/position_add.php', {
      method: 'POST',
      body: JSON.stringify({ election_id: eid, name, max_winners: max })
    });

    form.reset();
    // refresh modal + card
    const election = { id: eid, kind: window.__LAST_ELECTION_KIND || 'club', org_id: window.CURRENT_ORG_ID, club_id: window.CURRENT_CLUB_ID };
    await renderPositionsList(election);
    await remountElectionCard(election);
  });
})();

// refresh the correct card (org vs club)
async function remountElectionCard(election) {
  const kind = String(election.kind || '').toLowerCase();
  if (kind === 'org' || election.org_id) {
    await mountElectionsOrg(election.org_id || window.CURRENT_ORG_ID, 'orgElectionsCard');
  } else {
    await mountElections(election.club_id || window.CURRENT_CLUB_ID);
  }
}

// Ensures the internal structure of an elections card exists.
// It creates #electionSubtitle, #electionActions, and #electionBody if missing.
function ensureElectionScaffold(card) {
  if (!card) return false;
  // Title row
  let head = card.querySelector('.election-head');
  if (!head) {
    head = document.createElement('div');
    head.className = 'election-head';
    head.innerHTML = `
      <div class="election-title-row">
        <div id="electionSubtitle" class="election-subtitle"></div>
        <div id="electionActions" class="election-actions"></div>
      </div>`;
    card.prepend(head);
  } else {
    if (!head.querySelector('#electionSubtitle')) {
      const s = document.createElement('div');
      s.id = 'electionSubtitle';
      s.className = 'election-subtitle';
      head.prepend(s);
    }
    if (!head.querySelector('#electionActions')) {
      const a = document.createElement('div');
      a.id = 'electionActions';
      a.className = 'election-actions';
      head.appendChild(a);
    }
  }
  // Body container
  let body = card.querySelector('#electionBody');
  if (!body) {
    body = document.createElement('div');
    body.id = 'electionBody';
    card.appendChild(body);
  }
  return true;
}



// --- elections collapse preference -----------------------------------------
const getElectionsCollapsed = () => false;
const setElectionsCollapsed = () => {};
// ----------------------------------------------------------------------------

// ---- delegated click for "Manage positions" (works across re-renders)

document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-action="manage-positions"]');
  if (!btn) return;
  ev.preventDefault();

  const eid   = +(btn.dataset.electionId || btn.dataset.eid || 0);
  const kind  = (btn.dataset.kind || window.__LAST_ELECTION_KIND || 'club').toLowerCase();
  const orgId = btn.dataset.orgId  ? +btn.dataset.orgId  : undefined;
  const clubId= btn.dataset.clubId ? +btn.dataset.clubId : undefined;

  if (!eid) { console.warn('No election ID found on button'); return; }

  window.__LAST_ELECTION_KIND = kind;
  openManagePositionsModal({ id: eid, kind, org_id: orgId, club_id: clubId });
});




/* ===================== Elections Module ===================== */

// Keep small shared state
// ---- Winners cache & helper ----
window.__STATE__ = window.__STATE__ || { winnersMap: null };

function computeWinnersMapFromDom(cardEl) {
  // Fallback: parse winners from the rendered CLOSED election card
  // Looks for each .pos-group -> .pos-name, and the first .candidate name
  const winners = {};
  if (!cardEl) return winners;
  cardEl.querySelectorAll('.pos-group').forEach(group => {
    const pos = group.querySelector('.pos-name')?.textContent?.trim();
    // try a winner-marked candidate; else the only candidate row
    const candEl = group.querySelector('.candidate.winner .cand-name') ||
                   group.querySelector('.candidate .cand-name');
    const uid = group.querySelector('.candidate')?.dataset.user || group.querySelector('.candidate')?.dataset.id;
    const name = candEl?.textContent?.trim();
    if (uid && pos) {
      if (!Array.isArray(winners[uid])) winners[uid] = [];
      winners[uid].push(pos);
      // keep a display name cache for rendering (optional)
      if (!window.__STATE__.userNameById) window.__STATE__.userNameById = {};
      if (name) window.__STATE__.userNameById[uid] = name;
    }
  });
  return winners;
}



async function fetchElectionBundle(clubId) {
  // returns { ok, election, positions, candidates, totals }
  return apiFetch(`api/elections/list.php?club_id=${encodeURIComponent(clubId)}`);
}

// === Organization elections ===
async function fetchElectionBundleOrg(orgId){
  return apiFetch(`api/elections/list.php?org_id=${encodeURIComponent(orgId)}`);
}

// Is the current adviser allowed to control THIS election scope?
async function canControlElection(electionOrScope) {
  const me = await getCurrentUser();                  // has {role, adviser_id}
  if (!me || me.role !== 'adviser') return false;

  // Prefer explicit owner/adviser id on the election payload if present
  const ownerId = electionOrScope?.adviser_id
               || electionOrScope?.owner_adviser_id
               || 0;

  if (ownerId && Number(me.adviser_id) === Number(ownerId)) return true;

  // Fallback: compare page's adviser email (owner) to session email if needed
  const pageOwnerEmail = (document.getElementById('adv-email')?.textContent || '').trim().toLowerCase();
  const sessionEmail   = String(me.raw?.me?.sti_email || me.raw?.session?.sti_email || '').trim().toLowerCase();
  if (pageOwnerEmail && sessionEmail && pageOwnerEmail === sessionEmail) return true;

  return false;
}


// Is the current user the adviser of this specific organization?
async function isAdviserOfOrg(orgId) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'adviser' || !orgId) return false;

  // Try the organizations list filtered by adviser.
  // Expected responses can be {items: [...]}, {organizations: [...]}, or a bare array.
  try {
    const r = await apiFetch(`api/organizations/list.php?adviser_id=${encodeURIComponent(me.adviser_id || 'me')}`);
    const items = r?.items || r?.organizations || (Array.isArray(r) ? r : []);
    return Array.isArray(items) && items.some(o =>
      Number(o.id) === Number(orgId) ||
      Number(o.org_id) === Number(orgId)
    );
  } catch {
    // fall through
  }

  return false;
}



function wireCreateElectionOrg(orgId) {
  const form = document.getElementById('formCreateElection');
  if (!form) return;

  // avoid double-binding when navigating tabs
  form.dataset.wiredOrg = '1';
  form.addEventListener('submit', async (e) => {
    e.preventDefault();                     // 🔑 stop the page refresh

    const fd    = new FormData(form);
    const title = (fd.get('title') || '').toString().trim();

    if (!title) {
      alert('Please enter a title.');
      return;
    }

    try {
      await apiFetch('api/elections/create.php', {
        method: 'POST',
        body: JSON.stringify({
          org_id: orgId,                    // 🔑 org scope
          title,
          kind: 'org'
        })
      });

      // close modal & refresh the card
      closeModal?.('#modalCreateElection');

      // if you already implemented an org-aware mount, call that;
      // otherwise keep the shim so the container stays visible
      if (typeof mountElectionsOrg === 'function') {
        await mountElectionsOrg(orgId);
      } else {
        await mountElectionsOrgShim?.(orgId);
      }
    } catch (err) {
      // surface server message nicely
      try {
        const j = await err.json();
        alert(j.error || 'Create failed');
      } catch {
        alert('Create failed');
      }
      throw err;
    }
  }, { once: true });
}

function ensureOrgElectionsCard(){
  const id = 'orgElectionsCard';
  let card = document.getElementById(id);
  if (card) return card;

  const main = document.getElementById('electionsCard');
  if (!main || !main.parentNode) return null;

  card = main.cloneNode(true);
  card.id = id;

  // clear body + subtitle
  const body = card.querySelector('#electionBody');
  if (body) body.innerHTML = '';
  const sub  = card.querySelector('#electionSubtitle');
  if (sub) sub.textContent = '';

  // insert right after the club elections card
  main.parentNode.insertBefore(card, main.nextSibling);
  return card;
}







function openModal(sel) {
  console.log('openModal called with selector:', sel);
  const el = document.querySelector(sel);
  console.log('Modal element in openModal:', el);
  if (!el) return;
  if (el.parentElement !== document.body) {
    console.log('Appending modal to body');
    document.body.appendChild(el);
  }
  document.body.classList.add('modal-open');
  el.setAttribute('aria-hidden', 'false');
  setTimeout(() => {
    const f = el.querySelector('input,select,textarea,button');
    if (f) {
      console.log('Focusing first focusable element in modal');
      f.focus();
    }
  }, 50);
}

function ensureManagePositionsModal() {
  let modal = document.getElementById('modalManagePositions');
  if (modal) return modal;

  // Create the modal dynamically if it’s missing
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
  <div class="modal-overlay" id="modalManagePositions" aria-hidden="true">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="managePosTitle">
      <h3 id="managePosTitle">Manage Positions</h3>

      <div id="posList" class="form-vert" style="margin-bottom:.5rem;"></div>

      <hr style="margin:.75rem 0">

      <form id="formAddPos" class="form-vert">
        <input type="hidden" name="election_id" />
        <label class="field">
          <span>Position name</span>
          <input name="name" required placeholder="e.g., President" />
        </label>
        <label class="field">
          <span>Max winners</span>
          <input name="max_winners" type="number" min="1" value="1" required />
        </label>
        <div class="modal-actions">
          <button type="button" class="btn" data-close="#modalManagePositions">Close</button>
          <button type="submit" class="btn btn-primary">Add Position</button>
        </div>
      </form>
    </div>
  </div>`;
  modal = wrapper.firstElementChild;
  document.body.appendChild(modal);

  // (Re)wire the add form if your one-time wire checks for existence
  const form = document.getElementById('formAddPos');
  if (form && form.dataset.wired !== '1') {
    form.dataset.wired = '1';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const m   = document.getElementById('modalManagePositions');
      const eid = +(m?.dataset.electionId || 0);
      const fd  = new FormData(form);
      const name = String(fd.get('name') || '').trim();
      const max  = parseInt(String(fd.get('max_winners') || '1'), 10) || 1;
      if (!eid || !name) return;

      await apiFetch('api/elections/position_add.php', {
        method: 'POST',
        body: JSON.stringify({ election_id: eid, name, max_winners: max })
      });

      form.reset();
      const election = { id: eid, kind: window.__LAST_ELECTION_KIND || 'club', org_id: window.CURRENT_ORG_ID, club_id: window.CURRENT_CLUB_ID };
      await renderPositionsList(election);
      await remountElectionCard(election);
    });
  }

  return modal;
}



// --- Manage Positions (adviser) -------------------------------------------
async function openManagePositionsModal(election) {
  const modal = ensureManagePositionsModal();

  // Remember which election/context we’re editing
  modal.dataset.electionId = String(election.id);
  modal.dataset.kind       = String(election.kind || 'club').toLowerCase();
  if (election.org_id)  modal.dataset.orgId  = String(election.org_id);
  if (election.club_id) modal.dataset.clubId = String(election.club_id);

  const f = document.getElementById('formAddPos');
  if (f) f.elements['election_id'].value = String(election.id);

  await renderPositionsList(election);
  openModal('#modalManagePositions');
}




// Render the current positions into #posList
// Render the current positions into #posList (club OR org)
async function renderPositionsList(electionArg) {
  const list = document.getElementById('posList');
  if (!list) return;

  // Pull scope reliably from arg OR the modal
  const modal  = document.getElementById('modalManagePositions');
  const kind   = String(electionArg?.kind || modal?.dataset.kind || 'club').toLowerCase();
  const orgId  = +(electionArg?.org_id  || modal?.dataset.orgId  || window.CURRENT_ORG_ID  || 0);
  const clubId = +(electionArg?.club_id || modal?.dataset.clubId || window.CURRENT_CLUB_ID || 0);

  let bundle = null;
  try {
    if (kind === 'org') {
      if (!orgId) throw new Error('Missing org_id for organization election');
      bundle = await fetchElectionBundleOrg(orgId);
    } else {
      if (!clubId) throw new Error('Missing club_id for club election');
      bundle = await fetchElectionBundle(clubId);
    }
  } catch (err) {
    console.error('renderPositionsList: fetch failed:', err);
  }

  const positions = Array.isArray(bundle?.positions) ? bundle.positions : [];

  list.innerHTML = positions.length
    ? positions.map(p => `
        <div class="pos-row" data-id="${p.id}"
             style="display:flex;align-items:center;gap:.5rem;justify-content:space-between;padding:.35rem 0;">
          <div>
            <strong>${p.title || p.name}</strong>
            <small style="opacity:.75">• max ${p.max_winners || 1}</small>
          </div>
          <button class="btn btn-danger btn-del-pos" data-id="${p.id}">Delete</button>
        </div>
      `).join('')
    : `<div class="muted">No positions yet.</div>`;

  // Delete wiring
  list.querySelectorAll('.btn-del-pos').forEach(btn => {
    btn.addEventListener('click', async () => {
      const posId = +btn.dataset.id;
      if (!posId) return;
      if (!confirm('Remove this position?')) return;

      try {
        await apiFetch('api/elections/position_delete.php', {
          method: 'POST',
          body: JSON.stringify({ position_id: posId })
        });
      } catch (err) {
        console.error('position_delete failed:', err);
      }

      // Stable context for refresh
      const nextElection = {
        id: +(modal?.dataset.electionId || electionArg?.id || 0),
        kind,
        org_id:  (kind === 'org'  ? orgId  : undefined),
        club_id: (kind === 'club' ? clubId : undefined),
      };

      await renderPositionsList(nextElection);
      await remountElectionCard(nextElection);
    });
  });
}


// Add-form submit
(function wireAddPositionForm(){
  const form = document.getElementById('formAddPos');
  if (!form) return;
  if (form.dataset.wired === '1') return;
  form.dataset.wired = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const modal = document.querySelector('#modalManagePositions');
    const eid = +(modal?.dataset.electionId || 0);
    const fd  = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const max  = parseInt(String(fd.get('max_winners') || '1'), 10) || 1;
    if (!eid || !name) return;

    await apiFetch('api/elections/position_add.php', {
      method: 'POST',
      body: JSON.stringify({ election_id: eid, name, max_winners: max })
    });

    form.reset();
    // re-render the list and refresh the elections card on the page
    await renderPositionsList({ id: eid, kind: window.__LAST_ELECTION_KIND || 'club', org_id: window.CURRENT_ORG_ID, club_id: window.CURRENT_CLUB_ID });
    await remountElectionCard({ id: eid, kind: window.__LAST_ELECTION_KIND || 'club', org_id: window.CURRENT_ORG_ID, club_id: window.CURRENT_CLUB_ID });
  });
})();

// Remount the right elections card (org vs club)
async function remountElectionCard(election) {
  const kind = String(election.kind || '').toLowerCase();
  if (kind === 'org' || election.org_id) {
    await mountElectionsOrg(election.org_id, 'orgElectionsCard');
  } else {
    await mountElections(election.club_id);
  }
}


function closeModal(sel) {
  const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
  if (!el) return;
  el.setAttribute('aria-hidden', 'true');
  // If no other modals are open, unlock body
  const anyOpen = document.querySelector('.modal-overlay[aria-hidden="false"]');
  if (!anyOpen) document.body.classList.remove('modal-open');
}


function roleIsAdviser() {
  if (!window.ME) return false;
  const r = (ME.role || '').toString().toLowerCase();
  return r === 'adviser' || r === 'advisor' || !!ME.adviser_id || ME.is_adviser === true;
}
function byPosition(items, key = 'position_id') {
  const map = new Map();
  for (const it of items) {
    const pid = it[key];
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid).push(it);
  }
  return map;
}

function percent(v, total) {
  if (!total) return 0;
  return Math.round((v / total) * 100);
}

function injectElectionActions({ election, container, clubId, controlsAllowed = true }) {
  const wrap = container.querySelector('#electionActions');
  const body = container.querySelector('#electionBody');
wrap.innerHTML = '';

// Adviser-only (AND owner-only): edit positions while in DRAFT
if (roleIsAdviser() && controlsAllowed && election && String(election.status).toLowerCase() === 'draft') {
  const manage = document.createElement('button');
manage.className = 'text-btn';        // pill look
  manage.textContent = 'Manage positions';
// margin not needed for text links

  // Put enough info on the element so a delegated handler can open the modal
  manage.dataset.action  = 'manage-positions';
manage.dataset.electionId = String(election.id)
manage.dataset.eid = String(election.id); // <- add

  manage.dataset.kind    = String(election.kind || 'club').toLowerCase();
  if (election.org_id)  manage.dataset.orgId  = String(election.org_id);
  if (election.club_id) manage.dataset.clubId = String(election.club_id);

  wrap.appendChild(manage);
}


// Non-persistent (resets on refresh)
let __collapsed = false;
const isCollapsed  = () => __collapsed;
const setCollapsed = (v) => { __collapsed = !!v; };


  // make the body animatable
  if (body) {
body.style.overflow = 'hidden';
body.style.transition = 'max-height 300ms cubic-bezier(.2,.7,.2,1)';
body.style.willChange = 'max-height';
  }

const applyState = () => {
  if (!body) return;

  // Ensure visible for measurement
  body.removeAttribute('hidden');

  if (isCollapsed()) {
    // CLOSE: fix current height, then go to 0 on next frame
    const start = body.scrollHeight;
    body.style.maxHeight = start + 'px';
    requestAnimationFrame(() => {
      body.style.maxHeight = '0px';
    });
    toggleBtn.textContent = 'Show';
  } else {
    // OPEN: start at 0, then expand to content height next frame
    body.style.maxHeight = '0px';
    requestAnimationFrame(() => {
      const target = body.scrollHeight || 1; // guard against 0 during early paint
      body.style.maxHeight = target + 'px';
    });
    toggleBtn.textContent = 'Hide';
  }
};



// Allow mounts to re-measure after they inject content
container.__remeasureElectionBody = () => {
  if (!isCollapsed()) {
    body.style.maxHeight = body.scrollHeight + 'px';
  }
};

  // toggle button (small)
const toggleBtn = document.createElement('button');
toggleBtn.type = 'button';
toggleBtn.className = 'hide-link';
  toggleBtn.style.padding = '6px 10px';
  toggleBtn.style.fontSize = '12px';
  toggleBtn.addEventListener('click', () => {
    setCollapsed(!isCollapsed());
    applyState();
  });
const head = container.querySelector('.election-header') || container;
let hideWrap = head.querySelector('.election-hide');
if (!hideWrap) {
  hideWrap = document.createElement('div');
  hideWrap.className = 'election-hide';
  head.appendChild(hideWrap);
}
hideWrap.appendChild(toggleBtn);

  // set initial drawer state
  applyState();

  // --- No election yet: still show "Create" (adviser only)
if (!election) {
  if (roleIsAdviser() && controlsAllowed) {
    const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = 'Create Election';
      btn.addEventListener('click', () => openModal('#modalCreateElection'));
      wrap.appendChild(btn);
    }
    return;
  }

  // subtitle (title • STATUS)
  const subtitle = container.querySelector('#electionSubtitle');
  if (subtitle) subtitle.textContent = `${election.title} • ${election.status.toUpperCase()}`;

  // Refresh the right scope (club vs org) after an action
async function refreshAfterAction() {
  const looksOrg = (election?.kind === 'org') || (election?.org_id) || (String(clubId).startsWith('org:'));
  if (looksOrg) {
    const orgId = election?.org_id || +(String(clubId).split(':')[1] || 0) || (window.CURRENT_ORG_ID || 0);
    const containerId = document.getElementById('orgElectionsCard') ? 'orgElectionsCard' : 'electionsCard';
    if (orgId > 0) await mountElectionsOrg(orgId, containerId);
    return;
  }
  const cid = election?.club_id || clubId || (window.CURRENT_CLUB_ID || 0);
  if (+cid > 0) await mountElections(+cid);
}


  // adviser-side controls depending on status
if (roleIsAdviser() && controlsAllowed) {
    if (election.status === 'draft') {
      const start = document.createElement('button');
start.className = 'text-btn';
      start.textContent = 'Start Voting';
      start.dataset.action = 'start-voting';
start.dataset.eid    = String(election.id);
start.dataset.kind   = String(election.kind || 'club').toLowerCase();
if (election.org_id)  start.dataset.orgId  = String(election.org_id);
if (election.club_id) start.dataset.clubId = String(election.club_id);

      start.addEventListener('click', async () => {
        await apiFetch('api/elections/open.php', {
          method: 'POST',
          body: JSON.stringify({ election_id: election.id })
        });
        await refreshAfterAction();
      });
      wrap.appendChild(start);
    } else if (election.status === 'open') {
const stop = document.createElement('button');
stop.className = 'text-btn danger action-stop';
stop.textContent = 'Stop / Close';

// keep your data-* attributes / listeners the same:
stop.dataset.action = 'stop-voting';
stop.dataset.eid    = String(election.id);
stop.dataset.kind   = String((election.kind || 'club').toLowerCase());
if (election.org_id)  stop.dataset.orgId  = String(election.org_id);
if (election.club_id) stop.dataset.clubId = String(election.club_id);

stop.addEventListener('click', async () => {
  await apiFetch('api/elections/close.php', {
    method: 'POST',
    body: JSON.stringify({ election_id: election.id })
  });
  await refreshAfterAction?.();
});

// ⬅️ puts Stop/Close to the LEFT of Hide/Show
wrap.prepend(stop);

    } else if (election.status === 'closed') {
      // closed → allow creating a new one
      const createAgain = document.createElement('button');
      createAgain.className = 'btn btn-primary';
      createAgain.textContent = 'Create Election';
      createAgain.addEventListener('click', () => openModal('#modalCreateElection'));
      wrap.appendChild(createAgain);
    }
  }
}


function renderElectionEmpty(container, scope = 'club') {
  const noun = scope === 'organization' ? 'organization' : 'club';
  const msg  = `No election yet for this ${noun}. ${roleIsAdviser() ? 'Create one to get started.' : ''}`;
  container.querySelector('#electionBody').innerHTML = `<div class="election-empty">${msg}</div>`;
}

function renderApplicationsTable({ candidates, positionsMap, container, clubId, election }) {
  // Adviser-only, show pending/approved table for managing candidacies
  const pivot = {};
  for (const p of positionsMap.values()) {
    // positionsMap is Map(position_id -> {id,title...})
  }
  const rows = candidates.map(c => {
    const posName = positionsMap.get(c.position_id)?.title || positionsMap.get(c.position_id)?.name || '—';
    return `
      <tr data-id="${c.id}">
        <td>${posName}</td>
        <td>${c.full_name || ('#' + c.user_id)}</td>
        <td><span class="badge ${c.status}">${c.status}</span></td>
        <td class="actions-cell">
${c.status === 'pending' ? `
  <span class="btn-duo">
<button class="btn btn-primary btn-approve"
        data-id="${c.id}"
        data-kind="${(election?.kind || 'club').toLowerCase()}"
        data-club-id="${election?.club_id || clubId || ''}"
        data-org-id="${election?.org_id || ''}">Approve</button>

<button class="btn btn-danger btn-reject"
        data-id="${c.id}"
        data-kind="${(election?.kind || 'club').toLowerCase()}"
        data-club-id="${election?.club_id || clubId || ''}"
        data-org-id="${election?.org_id || ''}">Reject</button>
  </span>
` : ''}

        </td>
      </tr>
    `;
  }).join('');

  return `
    <div class="pos-group">
      <div class="pos-head">
        <div class="pos-name">Candidacy Applications</div>
      </div>
      <div class="table-wrap">
        <table class="table-mini">
          <thead><tr><th>Position</th><th>Candidate</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4">No applications yet.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderBallot({ positions, candidates, totals, election, isOpen }) {
  const byPos = byPosition(candidates);
  const posMap = new Map(positions.map(p => [p.id, p]));

  return positions.map(p => {
    const group = byPos.get(p.id) || [];
    const total = totals[p.id] || 0;

    const options = group.map(c => {
      const pct = percent(c.votes || 0, total);

      // marker; we’ll fill via a data-attr and turn the radio checked if it matches
      const youMark = `<span class="you-voted-dot" style="display:none;margin-left:6px;inline-size:8px;block-size:8px;border-radius:999px;background:#10b981;"></span>`;

      return `
        <div class="candidate" data-id="${c.id}">
          <div class="cand-main">
            <div class="cand-name">
              ${c.full_name || ('#' + c.user_id)}
              ${youMark}
            </div>
            <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
            <div class="cand-statement">${c.statement ? c.statement : ''}</div>
          </div>
          <div class="cand-actions">
            ${isOpen ? `<input class="vote-radio" type="radio" name="pos-${p.id}" value="${c.id}" />` : ''}
            <span class="badge approved">${c.votes || 0} vote(s)</span>
          </div>
        </div>
      `;
    }).join('');

    const voteBtn = isOpen ? `<button class="vote-btn" data-position="${p.id}" disabled>Cast Vote</button>` : '';

    return `
      <div class="pos-group" data-position="${p.id}">
        <div class="pos-head">
          <div class="pos-name">${p.title || p.name}</div>
          <div class="pos-total">${total} total vote(s)</div>
        </div>
        ${options || `<div class="candidate"><div class="cand-main"><div class="cand-name">No approved candidates yet.</div></div></div>`}
        ${voteBtn}
      </div>
    `;
  }).join('');
}

function renderWinners({ positions, candidates }) {
  // Simple winners = highest votes per position
  const byPos = byPosition(candidates);
  return positions.map(p => {
    const group = (byPos.get(p.id) || []).slice().sort((a,b) => (b.votes||0) - (a.votes||0));
    const winner = group[0];
    return `
      <div class="pos-group">
        <div class="pos-head">
          <div class="pos-name">${p.title || p.name}</div>
        </div>
        <div class="candidate">
          <div class="cand-main">
            <div class="cand-name">${winner ? (winner.full_name || ('#' + winner.user_id)) : '—'}</div>
            ${winner ? `<div class="cand-statement">Winner with ${winner.votes||0} vote(s)</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function mountElections(clubId) {
  const card = document.getElementById('electionsCard');
  if (!card) return;

  // close modals via data-close
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', e => {
      const sel = btn.getAttribute('data-close');
      closeModal(sel);
    });
  });


// Delegated Cast Vote handler (works for both club + org)
// Delegated Cast Vote handler (works for both club + org)
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.vote-btn');
  // Delegated: open officers list (works for org & club; org is what we need here)
// Delegated: open Officers list (org + club) — render from winners map (no PHP needed)
document.addEventListener('click', async (e) => {
  const openBtn = e.target.closest('[data-action="open-officers"], #btnOrgOfficers, .open-officers');
  if (!openBtn) return;

  // Build rows from winners we already computed on mount, or parse from the visible card
  const orgCard  = document.querySelector('#orgElectionsCard');
  const clubCard = document.querySelector('#electionsCard');

  // Prefer cached winners
  let winnersMap = (window.STATE && STATE.winnersMap) || window.__ELECTION_WINNERS || {};

  // If empty, parse the currently visible CLOSED card (safe fallback)
  if (!winnersMap || !Object.keys(winnersMap).length) {
    const card = orgCard || clubCard || document;
    if (typeof computeWinnersMapFromDom === 'function') {
      winnersMap = computeWinnersMapFromDom(card);
    } else {
      winnersMap = {};
    }
  }

  // Name lookup that we stamped during mount (from candidates)
  const nameBy = (window.STATE && STATE.userNameById) || {};

  const rows = Object.entries(winnersMap).map(([uid, titles]) => ({
    name: nameBy[uid] || `User #${uid}`,
    role: Array.isArray(titles) ? titles.join(', ') : String(titles || 'Officer')
  }));

  // Use your existing modal renderer if present; else inject directly
  if (typeof renderOfficersModal === 'function') {
    renderOfficersModal(rows);
  } else {
    const modal = document.querySelector('#officersModal') || document.querySelector('#modalMembers');
    const tbody = modal?.querySelector('tbody');
    const title = modal?.querySelector('.modal-title, .title, h3');
    if (title) title.textContent = 'Organization Officers';
    if (tbody) {
      tbody.innerHTML = rows.length
        ? rows.map(r => `<tr><td>${r.name}</td><td>${r.role}</td></tr>`).join('')
        : `<tr><td colspan="2" style="color:#6b7280">No officers yet.</td></tr>`;
    }
    if (modal) openModal('#' + modal.id);
  }
});


  if (!btn) return;

  const posGroup = btn.closest('.pos-group');
  if (!posGroup) return;

  const checked = posGroup.querySelector('input.vote-radio:checked');
  if (!checked) { alert('Please select a candidate.'); return; }

  const card = btn.closest('#orgElectionsCard, #electionsCard');
  const candidate_id = +checked.value;

  // Resolve election_id from the card or from any header action button
  let election_id = +(card?.dataset.electionId || 0);
  if (!election_id) {
    const actions = card?.querySelector('[data-action="manage-positions"], [data-action="start-voting"], [data-action="create-election"]');
    election_id = +(actions?.dataset.eid || 0);
  }
  if (!election_id) {
    console.warn('No election_id found on card/actions; aborting vote.');
    return;
  }

  try {
    await apiFetch('api/elections/vote.php', {
      method: 'POST',
      body: JSON.stringify({ election_id, candidate_id })
    });

    // ----- SUCCESS: persist + mark + disable until new choice -----
    const posId = +btn.dataset.position;

    // ✅ Use the card-stamped id (always present after mount)
    const cardElectionId = +(card?.dataset.electionId || 0);
    await setStoredVote(cardElectionId, posId, candidate_id);

    // Show the green dot on chosen candidate in this group
    const group = btn.closest('.pos-group');
    group?.querySelectorAll('.you-voted-dot').forEach(d => d.style.display = 'none'); // clear others
    const chosenRow = group?.querySelector(`.candidate[data-id="${candidate_id}"] .you-voted-dot`);
    if (chosenRow) chosenRow.style.display = '';

    // Clear radios and disable button until a new choice is made
    group?.querySelectorAll('input.vote-radio').forEach(r => { r.checked = false; });
    btn.disabled = true;
    btn.classList.add('btn-disabled');

  } catch (err) {
    try { const j = await err.json(); alert(j.error || 'Vote failed'); }
    catch { alert('Vote failed'); }
    throw err;
  }

  // Refresh just the card that was used
  if (card && card.id === 'orgElectionsCard') {
    const orgId = +(card.dataset.orgId || window.CURRENT_ORG_ID || 0);
    await mountElectionsOrg(orgId, 'orgElectionsCard');
  } else {
    const clubId = +(card?.dataset.clubId || window.CURRENT_CLUB_ID || 0);
    await mountElections(clubId);
    refreshAdviserAvatar({ clubId: (window.CURRENT_CLUB_ID || clubId || 0) });

  }
});

  // Delegated: open “Manage positions” modal from any elections card
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="manage-positions"]');
  if (!btn) return;

  // Rebuild a minimal election object for the modal
  const election = {
    id: +(btn.dataset.eid || 0),
    kind: (btn.dataset.kind || 'club').toLowerCase(),
    org_id: btn.dataset.orgId ? +btn.dataset.orgId : undefined,
    club_id: btn.dataset.clubId ? +btn.dataset.clubId : undefined,
  };

  if (!election.id) return;
  openManagePositionsModal(election);
});


  const data = await fetchElectionBundle(clubId);
  card.hidden = false;



  if (!data || !data.ok || !data.election) {
    injectElectionActions({ election: null, container: card, clubId });
    renderElectionEmpty(card);
    return;
    
  }
  window.__LAST_ELECTION_KIND = (data && data.election && data.election.kind) || 'club';


  const { election, positions = [], candidates = [], totals = {} } = data;
  const canControl = await canControlElection(election || { club_id: clubId });
  // winners only matter when closed
__WINNERS_MAP = (election && election.status === 'closed')
  ? (function computeWinnersMap(positions, candidates) {
      const byPos = new Map();
      for (const c of candidates) {
        if (c.status !== 'approved') continue;
        if (!byPos.has(c.position_id)) byPos.set(c.position_id, []);
        byPos.get(c.position_id).push(c);
      }
      const posById = new Map(positions.map(p => [p.id, p]));
      const win = {}; // user_id -> [titles]
      for (const [posId, list] of byPos.entries()) {
        const pos = posById.get(posId);
        const maxWinners = Number(pos?.max_winners || 1);
        const sorted = list.slice().sort((a,b) =>
          (b.votes||0) - (a.votes||0) || a.id - b.id
        );
        for (let i = 0; i < Math.min(maxWinners, sorted.length); i++) {
          const w = sorted[i];
          const title = pos?.name || pos?.title || 'Winner';
          (win[w.user_id] ||= []).push(title);
        }
      }
      return win;
    })(positions, candidates)
  : {};
  window.__LAST_ELECTION_KIND = (election && election.kind) || 'org';


  __ELECTION_WINNERS = (election.status === 'closed')
  ? computeWinnersMap(positions, candidates)
  : null;
  STATE.winnersMap = (election.status === 'closed')
  
  ? computeWinnersMap(positions, candidates)
  : {};
injectElectionActions({ election, container: card, clubId, controlsAllowed: canControl });

  // build a quick positions map for lookups
  const posMap = new Map(positions.map(p => [p.id, p]));

  // Build body
  const body = card.querySelector('#electionBody');
  let html = '';

  if (roleIsAdviser()) {
    // Applications table (adviser will see all statuses)
    html += renderApplicationsTable({ candidates, positionsMap: posMap, container: card, clubId, election });
} else {
  // Student: show Apply if draft (applications phase)
  // Student: show Apply if draft (applications phase)
  if (election.status === 'draft') {
    const me = await getCurrentUser();
    const myApp = Array.isArray(candidates)
      ? candidates.find(c => Number(c.user_id) === Number(me?.student_id))
      : null;

    // NEW: membership check — only club members can nominate
    const member = await isMemberOfClub(clubId);

    let btnHTML = '';
    let note    = 'Applications are open. You can nominate yourself for a position.';

    if (myApp) {
      btnHTML = `<button class="btn" id="btnOpenApply" disabled aria-disabled="true">Application sent</button>`;
    } else if (!member) {
      btnHTML = `<button class="btn" id="btnOpenApply" disabled aria-disabled="true">Join the club first</button>`;
      note    = 'Applications are open. Join the club first to nominate yourself.';
    } else {
      btnHTML = `<button class="btn btn-primary" id="btnOpenApply">Nominate Myself</button>`;
    }

    html += `
      <div class="pos-group">
        <div class="pos-head"><div class="pos-name">Candidacy</div></div>
        <p>${note}</p>
        ${btnHTML}
      </div>
    `;
  }

}

if (election.status === 'open') {
  const ballot = renderBallot({
    positions,
    candidates: candidates.filter(c => c.status === 'approved'),
    totals,
    election,
    isOpen: !roleIsAdviser()   // 👈 students: radios + “Cast Vote”; advisers: read-only tallies
  });
  html += ballot;
}
 else if (election.status === 'closed') {
    html += renderWinners({ positions, candidates });
  }
card.dataset.electionId = String(election.id);
card.dataset.clubId = String(clubId);

  body.innerHTML = html;
  wireBallotEnablement(body);

 // Paint "my vote" markers and pre-check radios from storage (student only)
if (!roleIsAdviser() && election.status !== 'closed') {
  const sid = await getMyStudentId();
  if (sid) {
    for (const p of positions) {
      const saved = await getStoredVote(election.id, p.id);
      if (saved) {
        const group = body.querySelector(`.pos-group[data-position="${p.id}"]`);
        const cand  = group?.querySelector(`.candidate[data-id="${saved}"]`);
        const dot   = cand?.querySelector('.you-voted-dot');
        const radio = group?.querySelector(`.vote-radio[value="${saved}"]`);
        if (dot) dot.style.display = '';
        if (radio) radio.checked = true;
      }
    }
  }
}
 
if (election.status === 'open') {
  startElectionPoll(clubId, election.id, card);
} else {
  stopElectionPoll();
}



  card.__remeasureElectionBody?.();
setTimeout(() => card.__remeasureElectionBody?.(), 0);


// force open (stateless default)
body.removeAttribute('hidden');
body.style.maxHeight = '10000px';
body.style.opacity = '1';


  
// Always open by default; only hide if user previously clicked Hide
if (getElectionsCollapsed(clubId)) {
  body.setAttribute('hidden', 'true');
} else {
  body.removeAttribute('hidden');
}



  // Wire Apply (student)
if (!roleIsAdviser() && election.status === 'draft') {
  const btn = body.querySelector('#btnOpenApply');
  if (btn && !btn.disabled) {
    btn.addEventListener('click', () => {
        const sel = document.querySelector('#applyPositionSelect');
        sel.innerHTML = positions.map(p => `<option value="${p.id}">${p.title || p.name}</option>`).join('');
const f = document.querySelector('#formApply');
f.elements['election_id'].value = election.id;
// tag scope for submit handler
f.dataset.kind   = 'club';
f.dataset.clubId = String(clubId || window.CURRENT_CLUB_ID || 0);
delete f.dataset.orgId;
openModal('#modalApply');
      });
    }
  }

  // Wire Approve/Reject (adviser)
  if (roleIsAdviser()) {
    body.querySelectorAll('.btn-approve').forEach(b => {
      b.addEventListener('click', async () => {
        const id = +b.dataset.id;
        await apiFetch('api/elections/approve_candidate.php', { method:'POST', body: JSON.stringify({ candidate_id: id }) });
        mountElections(clubId);
      });
    });
    body.querySelectorAll('.btn-reject').forEach(b => {
      b.addEventListener('click', async () => {
        const id = +b.dataset.id;
        await apiFetch('api/elections/approve_candidate.php', { method:'POST', body: JSON.stringify({ candidate_id: id, status: 'rejected' }) });
        // If your approve_candidate.php only approves, create a reject endpoint; or interpret payload.
        mountElections(clubId);
      });
    });
  }

  // Wire Vote buttons (students)
  if (!roleIsAdviser() && election.status === 'open') {
    body.querySelectorAll('.vote-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const posId = +btn.dataset.position;
        const checked = body.querySelector(`.pos-group[data-position="${posId}"] input.vote-radio:checked`);
        if (!checked) { alert('Please select a candidate.'); return; }
        const candidate_id = +checked.value;
        await apiFetch('api/elections/vote.php', {
          method: 'POST',
          body: JSON.stringify({ election_id: election.id, candidate_id })
          
          
        })
        .catch(async (err) => {
          // surface server message if provided
          try { const j = await err.json(); alert(j.error || 'Vote failed'); } catch { alert('Vote failed'); }
          throw err;
        });
        // Refresh tally
        mountElections(clubId);
      });
    });
  }
}

// Page context: we’re on a Club Details page if #club-name exists.
function isClubContext() {
  return !!document.getElementById('club-name');
}

async function mountElectionsOrg(orgId, containerId = 'electionsCard') {
  const card = document.getElementById(containerId);
  if (!card) return;
  card.hidden = false;

    // Club page rule: advisers are NOT voters of org elections → hide the org card entirely.
  // We detect "club page" by the presence of CURRENT_CLUB_ID.
  try {
    const me = await getCurrentUser();
    const isInjectedOrgCard = (containerId === 'orgElectionsCard') || (card.id === 'orgElectionsCard');
    if (isInjectedOrgCard && me && me.role === 'adviser') {
      card.remove();
      return;
    }
  } catch {}

  const data = await fetchElectionBundleOrg(orgId);
  const { election, positions = [], candidates = [], totals = {} } = data || {};
// remember scope + compute winners for Officers modal (ORG)
window.__LAST_ELECTION_KIND = 'org';
__ELECTION_WINNERS = (String(election?.status || '').toLowerCase() === 'closed')
  ? computeWinnersMap(positions, candidates)
  : null;
STATE.winnersMap = __ELECTION_WINNERS || {};
STATE.userNameById = Object.assign(
  {},
  STATE.userNameById || {},
  Object.fromEntries((candidates || []).map(c => [String(c.user_id), c.full_name || ('#' + c.user_id)]))
);
// NEW: cache id/email per user to render the subline in the officers modal
STATE.userMetaById = Object.assign(
  {},
  STATE.userMetaById || {},
  Object.fromEntries((candidates || []).map(c => [
    String(c.user_id),
    { sid: c.student_id || c.sid || '', email: c.email || '' }
  ]))
);


  const canControl = (await isAdviserOfOrg(orgId))
                  || (await canControlElection(election || { org_id: orgId }));

  // keep a distinct collapse key for org scope
  const pseudoId = `org:${orgId}`;
injectElectionActions({ election, container: card, clubId: pseudoId, controlsAllowed: canControl });


  const body = card.querySelector('#electionBody');
  if (!election) { renderElectionEmpty(card, 'organization'); return; }

// after:  const canControl = await canControlElection(election || { org_id: orgId });

let html = '';
if (roleIsAdviser() && canControl) {
  // Only the org’s own adviser sees this
  html += renderApplicationsTable({
    candidates,
    positionsMap: new Map(positions.map(p => [p.id, p])),
    container: card,
    clubId: pseudoId,
    election
  });
} else if (!roleIsAdviser()) {
  // Students can nominate in draft
  if (election.status === 'draft') {
const me = await getCurrentUser();
const myApp = Array.isArray(candidates)
  ? candidates.find(c => Number(c.user_id) === Number(me?.student_id))
  : null;

// Require membership (of THIS club page) to nominate in the org election.
const clubIdCtx = window.CURRENT_CLUB_ID || 0;
const member = await isMemberOfClub(clubIdCtx);

let btnHTML = '';
let note    = 'Applications are open. You can nominate yourself for a position.';

if (myApp) {
  btnHTML = `<button class="btn" id="btnOpenApply" disabled aria-disabled="true">Application sent</button>`;
} else if (!member) {
  btnHTML = `<button class="btn" id="btnOpenApply" disabled aria-disabled="true">Join the club first</button>`;
  note    = 'Applications are open. Join the club first to nominate yourself.';
} else {
  btnHTML = `<button class="btn btn-primary" id="btnOpenApply">Nominate Myself</button>`;
}

html += `
  <div class="pos-group">
    <div class="pos-head"><div class="pos-name">Candidacy</div></div>
    <p>${note}</p>
    ${btnHTML}
  </div>`;

  }
}



  if (election.status === 'open') {
    html += renderBallot({
      positions,
      candidates: candidates.filter(c => c.status === 'approved'),
      totals,
      election,
      isOpen: !roleIsAdviser()
    });
  } else if (election.status === 'closed') {
    html += renderWinners({ positions, candidates });
  }
card.dataset.electionId = String(election.id);
card.dataset.orgId = String(orgId);

  body.innerHTML = html;
  wireBallotEnablement(body);

  // Paint "my vote" markers and pre-check radios from storage (student only)
if (!roleIsAdviser() && election.status !== 'closed') {
  const sid = await getMyStudentId();
  if (sid) {
    for (const p of positions) {
      const saved = await getStoredVote(election.id, p.id);
      if (saved) {
        const group = body.querySelector(`.pos-group[data-position="${p.id}"]`);
        const cand  = group?.querySelector(`.candidate[data-id="${saved}"]`);
        const dot   = cand?.querySelector('.you-voted-dot');
        const radio = group?.querySelector(`.vote-radio[value="${saved}"]`);
        if (dot) dot.style.display = '';
        if (radio) radio.checked = true;
      }
    }
  }
}


if (election.status === 'open') {
  startElectionPollOrg(orgId, election.id, card);
} else {
  stopElectionPollOrg();
}

  card.__remeasureElectionBody?.();
setTimeout(() => card.__remeasureElectionBody?.(), 0);


// force open (stateless default)
body.removeAttribute('hidden');
body.style.maxHeight = '10000px';
body.style.opacity = '1';


  // wire “Nominate Myself” (students) for org scope
if (!roleIsAdviser() && election.status === 'draft') {
  const btn = body.querySelector('#btnOpenApply');
  if (btn && !btn.disabled) {
      btn.addEventListener('click', () => {
        const sel = document.querySelector('#applyPositionSelect');
        sel.innerHTML = positions.map(p => `<option value="${p.id}">${p.title || p.name}</option>`).join('');
const f = document.querySelector('#formApply');
f.elements['election_id'].value = election.id;
// tag scope for submit handler
f.dataset.kind  = 'org';
f.dataset.orgId = String(orgId || window.CURRENT_ORG_ID || 0);
delete f.dataset.clubId;
openModal('#modalApply');
      });
    }
  }
}



// Create election (adviser)
function wireCreateElection(clubId) {
  const form = document.getElementById('formCreateElection');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const title = fd.get('title')?.toString().trim();
    const kind = fd.get('kind')?.toString();
    if (!title || !kind) return;
    await apiFetch('api/elections/create.php', {
      method: 'POST',
      body: JSON.stringify({ club_id: clubId, title, kind })
    });
    closeModal('#modalCreateElection');
    mountElections(clubId);
  });
}

// Apply (student)
function wireApply() {
  const form = document.getElementById('formApply');
  if (!form) return;
  if (form.dataset.wired === '1') return;      // avoid duplicate binding
  form.dataset.wired = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const election_id = +fd.get('election_id');
    const position_id = +fd.get('position_id');
    const statement   = (fd.get('statement') || '').toString();

    // Submit application
    await apiFetch('api/elections/apply.php', {
      method: 'POST',
      body: JSON.stringify({ election_id, position_id, statement })
    }).catch(async (err) => {
      try { const j = await err.json(); alert(j.error || 'Apply failed'); } catch { alert('Apply failed'); }
      throw err;
    });

    // Close modal
    closeModal('#modalApply');

    // 1) Optimistically update button now (no reload required)
    const activeCard = document.querySelector('#orgElectionsCard') || document.querySelector('#electionsCard');
    if (activeCard) {
      const body = activeCard.querySelector('#electionBody');
      const btn  = body?.querySelector('#btnOpenApply');
      if (btn) {
        btn.textContent = 'Application sent';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn');
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
      }
    }

    // 2) Then remount the correct card to pull fresh state from server
    const kind   = String(form.dataset.kind || '').toLowerCase();
    const orgId  = +(form.dataset.orgId  || 0);
    const clubId = +(form.dataset.clubId || 0);

    if (kind === 'org' && orgId) {
      await mountElectionsOrg(orgId, 'orgElectionsCard');
    } else {
      await mountElections(clubId || window.CURRENT_CLUB_ID || 0);
    }
  });
}

/* =================== /Elections Module ====================== */




// --- Feed helpers (reusing your profile structure) ---

// Try to fetch an adviser's profile_picture by adviser_id or email
async function fetchAdviserPhoto({ adviser_id, email }) {
  const tryEndpoints = [];

  if (adviser_id) {
    tryEndpoints.push(`api/advisers/get.php?adviser_id=${encodeURIComponent(adviser_id)}`);
  }
  if (email) {
    // common list-search fallbacks
    tryEndpoints.push(`api/advisers/list.php?sti_email=${encodeURIComponent(email)}`);
    tryEndpoints.push(`api/advisers/list.php?email=${encodeURIComponent(email)}`);
  }

  for (const url of tryEndpoints) {
    try {
      const r = await apiFetch(url);
      const row =
        r?.item || r?.adviser || (Array.isArray(r?.items) ? r.items[0] : null) ||
        (Array.isArray(r) ? r[0] : null);
      const pic =
        row?.profile_picture || row?.photo || row?.avatar || row?.image || '';
      if (pic) return pic;
    } catch { /* keep trying */ }
  }
  return '';
}


function toAbs(u, hint) {
  if (!u) return "";
  try {
    return /^https?:\/\//i.test(u) || u.startsWith("data:") ? u : mediaUrl(u, hint);
  } catch {
    return u;
  }
}
// ----- Persisted "my vote" (per student → per election → per position) -----
function votesKey(electionId, studentId) {
  return `votes:${studentId || 'anon'}:${electionId}`;
}
async function getMyStudentId() {
  const me = await getCurrentUser();
  return me?.student_id || null;
}
async function getStoredVote(electionId, positionId) {
  const sid = await getMyStudentId();
  if (!sid) return null;
  try {
    const raw = localStorage.getItem(votesKey(electionId, sid));
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map && map[positionId] ? Number(map[positionId]) : null;
  } catch { return null; }
}
async function setStoredVote(electionId, positionId, candidateId) {
  const sid = await getMyStudentId();
  if (!sid) return;
  try {
    const key = votesKey(electionId, sid);
    const map = JSON.parse(localStorage.getItem(key) || '{}');
    if (candidateId == null) delete map[positionId];
    else map[positionId] = Number(candidateId);
    localStorage.setItem(key, JSON.stringify(map));
  } catch {}
}



async function wireBallotEnablement(scopeEl) {
  const eidAttr = scopeEl.closest('#orgElectionsCard, #electionsCard')?.dataset.electionId;
  const electionId = eidAttr ? Number(eidAttr) : 0;

  scopeEl.querySelectorAll('.pos-group').forEach(group => {
    const btn = group.querySelector('.vote-btn');
    if (!btn) return;

    const pid = Number(group.getAttribute('data-position') || 0);
    const radios = group.querySelectorAll('input.vote-radio');

    const setState = async () => {
      const checked = group.querySelector('input.vote-radio:checked');
      if (!checked) { btn.disabled = true; btn.classList.add('btn-disabled'); return; }

      const chosen = Number(checked.value);
      const saved  = electionId ? await getStoredVote(electionId, pid) : null;

      // enable only when user picked a different candidate than their saved vote
      const enable = !saved || saved !== chosen;
      btn.disabled = !enable;
      btn.classList.toggle('btn-disabled', !enable);
    };

    setState();
    radios.forEach(r => r.addEventListener('change', setState, { passive: true }));
  });
}



function collectImages(row, hint) {
  const out = [];

  // common single fields
  ['featured_image','banner','image','photo','thumbnail'].forEach(k => {
    const v = row && row[k];
    if (v) out.push(v);
  });

  // array fields
  ['images','media','photos','media_urls','image_urls'].forEach(k => {
    const arr = row && row[k];
    if (Array.isArray(arr)) arr.forEach(u => u && out.push(u));
  });

  // comma-separated
  ['gallery','images_csv','photos_csv'].forEach(k => {
    const v = row && row[k];
    if (typeof v === 'string' && v.trim()) {
      v.split(',').map(s => s.trim()).filter(Boolean).forEach(u => out.push(u));
    }
  });

  // image1..image9
  for (let i = 1; i <= 9; i++) {
    const k = 'image' + i;
    if (row && row[k]) out.push(row[k]);
  }

  // normalize + dedupe
  const seen = new Set();
  return out
    .map(u => toAbs(u, hint))
    .filter(u => !!u && !seen.has(u) && seen.add(u));
}

function ensureFeedTemplates() {
  // Just ensure the three templates exist (we added them in HTML)
  ['feedTplText','feedTplImage','feedTplVideo'].forEach(id=>{
    const tpl = document.getElementById(id);
    if (tpl) tpl.style.display = 'none';
  });
}

// -- Caption helpers: keep line breaks + clamp with "Show more" on feed cards --
function ensureFeedCaptionCSS(){
  if (document.getElementById('feedCaptionCSS')) return;
  const css = `
    /* preserve newlines/spaces and wrap long words */
    .feed-post .feed-body, .postmodal .pm-text { white-space: pre-wrap; word-wrap: break-word; line-height: 1.5; }

    /* "Show more" button look */
    .feed-post .show-more {
      display: inline-block; margin-left: 6px; padding: 0; border: 0;
      background: transparent; color: #2563eb; font-weight: 600; cursor: pointer;
    }
    .feed-post .show-more:focus { outline: 2px solid #93c5fd; outline-offset: 2px; }
  `;
  const s = document.createElement('style');
  s.id = 'feedCaptionCSS';
  s.textContent = css;
  document.head.appendChild(s);
}

/**
 * Render a caption into an element, preserving line breaks and clamping when too long.
 * - On feed cards we clamp to ~600 chars and append a "Show more" toggle.
 * - In the modal, you already render full text; the CSS above keeps the spacing there too.
 */
function renderCaptionWithClamp(el, fullText, maxChars = 'half') {
  if (!el) return;
  const text = String(fullText || '');

  const limit = (maxChars === 'half')
    ? Math.max(160, Math.floor(text.length / 2))   // collapse to ~half, min 160
    : (Number(maxChars) || 600);

  if (text.length <= limit) { el.textContent = text; return; }

  const short = text.slice(0, limit).replace(/\s+$/,'') + '…';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'show-more';
  btn.textContent = 'Show more';

  const apply = (expanded) => {
    el.textContent = (expanded ? text : short) + ' ';
    btn.textContent = expanded ? 'Show less' : 'Show more';
    btn.setAttribute('data-expanded', expanded ? '1' : '0');
    el.appendChild(btn);
  };
  apply(false);

  btn.addEventListener('click', (e) => {
    e.stopPropagation(); // don’t close/open anything else
    const expanded = btn.getAttribute('data-expanded') === '1';
    apply(!expanded);
  }, { passive: true });
}

// === Likes (hearts) ===
const API_ROOT = '/capstone/api/posts';
const LIKE_API = `${API_ROOT}/like_toggle.php`;
const LIKES_STATUS_API = `${API_ROOT}/like_toggle.php`;

async function apiJSON(url, opts = {}) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  if (!res.ok) throw new Error('Network error');
  return await res.json();
}

function paintHeart(btn, liked) {
  if (!btn) return;
  btn.dataset.liked = liked ? '1' : '0';
  btn.classList.toggle('is-liked', !!liked);
}

function paintLikeCount(scope, count) {
  scope.querySelectorAll('.btn-like .count, .pm-like .count')
       .forEach(el => el.textContent = String(count ?? 0));
}

function seedAllHearts(scope = document) {
  scope.querySelectorAll('.btn-like').forEach(btn => {
    paintHeart(btn, btn.dataset.liked === '1');
  });
}




function escapeHTML(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}




function buildCardFromPost(p) {
  // p: { id, kind:'news'|'event', authorName, authorPic, created_at, caption, images[], video? }
  const isVideo = !!p.video;
  const isImage = !isVideo && Array.isArray(p.images) && p.images.length;
  const tplId = isVideo ? 'feedTplVideo' : (isImage ? 'feedTplImage' : 'feedTplText');
  const tpl = document.getElementById(tplId);
  const card = tpl.cloneNode(true);
  card.id = '';                // avoid duplicate ids
  card.style.display = '';     // show
  card.dataset.id   = `${p.kind}:${p.id}`;
  card.dataset.kind = p.kind;

  // header
  const avatar = card.querySelector('.feed-avatar');
  const nameEl = card.querySelector('.feed-name');
  const timeEl = card.querySelector('.feed-time');
  if (avatar) avatar.src = toAbs(p.authorPic || '');
  if (nameEl) nameEl.textContent = p.authorName || '—';

  if (timeEl && p.created_at) {
    const d = new Date(p.created_at);
    timeEl.textContent = isNaN(+d) ? p.created_at : d.toLocaleString();
    try { timeEl.setAttribute('datetime', d.toISOString()); } catch {}
  }

  // caption/body
const bodyEl = card.querySelector('.feed-body, .caption, .post-caption');
if (bodyEl) renderCaptionWithClamp(bodyEl, p.caption || '');


  // media
  const mediaBox = card.querySelector('.feed-media');
  if (isVideo) {
    const v = document.createElement('video');
    v.controls = true; v.playsInline = true;
    v.innerHTML = `<source src="${toAbs(p.video)}" type="video/mp4">`;
    mediaBox.innerHTML = ''; mediaBox.appendChild(v);
  } else if (isImage && mediaBox) {
    const abs = p.images.map(toAbs);
    let img = mediaBox.querySelector('img');
    if (!img) { img = document.createElement('img'); mediaBox.innerHTML=''; mediaBox.appendChild(img); }
    img.src = abs[0]; img.alt = '';
    let more = mediaBox.querySelector('.media-more');
    if (!more) { more = document.createElement('span'); more.className = 'media-more'; mediaBox.appendChild(more); }
    const extra = abs.length - 1;
    more.textContent = extra > 0 ? `+${extra}` : '';
    more.style.display = extra > 0 ? '' : 'none';
    card.dataset.images = JSON.stringify(abs);
  } else if (mediaBox) {
    mediaBox.remove();
  }

  // open modal on media/body/comment click
const openZones = ['.feed-media', '.feed-body'];
openZones.forEach(sel=>card.querySelector(sel)?.addEventListener('click', ()=>{
  const imgs = card.dataset.images ? JSON.parse(card.dataset.images) : [];
  fillAndOpenPostModal({
    id: p.id,
    name: p.authorName, avatar: p.authorPic, time: timeEl?.textContent || '',
    caption: p.caption || '', images: imgs
  });
}, {passive:true}));

  return card;
}

// Post modal open/close (same behavior as profile)
(function(){
  const modal = document.getElementById('postModal');
  if (!modal) return;
  const panel = modal.querySelector('.pm-box');
  const btnClose = modal.querySelector('.pm-close');

  function closePostModal(){
    modal.classList.remove('open','show');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('no-scroll');
  }
  function openPostModal(){
    modal.classList.add('open','show');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('no-scroll');
  }
  window.__openPostModal = openPostModal;
  window.__closePostModal = closePostModal;

  btnClose?.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closePostModal(); });
  modal.addEventListener('click', (e)=>{ if (e.target === modal) closePostModal(); });
  panel?.addEventListener('click', (e)=> e.stopPropagation());
  document.addEventListener('keydown', (e)=>{ if (e.key==='Escape' && modal.classList.contains('open')) closePostModal(); });
})();

// Minimal slider (same API as profile)
function setupModalSlider(modal, sources){
  const media = modal.querySelector('.pm-media');
  if (!media) return;
  modal.classList.toggle('has-multi', Array.isArray(sources) && sources.length>1);

  let idx = 0;
  function render(){
    media.querySelector('.pm-frame')?.remove();
    const frame = document.createElement('div');
    frame.className = 'pm-frame';
    const img = document.createElement('img');
    img.src = sources[idx]; img.alt = ''; img.style.maxWidth='100%'; img.style.maxHeight='100%'; img.style.display='block'; img.style.objectFit='contain';
    frame.appendChild(img);
    media.prepend(frame);
  }
  if (!media.querySelector('.pm-prev')) {
    media.insertAdjacentHTML('beforeend', `
      <button class="pm-nav pm-prev" type="button" aria-label="Previous">‹</button>
      <button class="pm-nav pm-next" type="button" aria-label="Next">›</button>
    `);
  }
  const prevBtn = media.querySelector('.pm-prev');
  const nextBtn = media.querySelector('.pm-next');
  const prev = ()=>{ idx = (idx - 1 + sources.length) % sources.length; render(); };
  const next = ()=>{ idx = (idx + 1) % sources.length; render(); };
  prevBtn.onclick = prev; nextBtn.onclick = next;
  render();
}

function fillAndOpenPostModal({id, name, avatar, time, caption, images}) {
  const modal = document.getElementById('postModal');
  if (!modal) return;
  modal.querySelector('#pmName').textContent = name || '—';
  modal.querySelector('#pmTime').textContent = time || '';
  const capEl = modal.querySelector('#pmCaption');
capEl.textContent = '';
capEl.textContent = caption || ''; // collapse to half by default


modal.dataset.postId = String(id || '');
populateLikes([String(id)]);
modal.dispatchEvent(new Event('pm:open')); // trigger comments load + heart seeding


  const av = modal.querySelector('#pmAvatar'); if (av) av.src = toAbs(avatar||'');
  const media = modal.querySelector('.pm-media'); if (media) media.classList.toggle('hidden', !(images&&images.length));
  if (images && images.length) setupModalSlider(modal, images.map(toAbs));
  window.__openPostModal && window.__openPostModal();
}

// ==== Comments (modal) ====



// Same visual toggle your profile uses for heart icon
(function(){
  const likeBtns = [
    ...document.querySelectorAll('.btn-like'),
    ...document.querySelectorAll('.pm-like')
  ];
  likeBtns.forEach(btn=>{
    const img = btn.querySelector('img'); // optional if you use PNGs
    btn.addEventListener('click', ()=>{
      const liked = btn.getAttribute('data-liked') === 'true';
      btn.setAttribute('data-liked', liked ? 'false' : 'true');
      // If you have Images/heart-filled.png, swap it here the same way you do in profile.
    }, {passive:true});
  });
})();

// Approve / Reject (delegated; works for both club and org cards)
document.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('.btn-approve, .btn-reject');
  if (!btn) return;

  const candidateId = +btn.dataset.id;
  if (!candidateId) return;

  const status = btn.classList.contains('btn-reject') ? 'rejected' : 'approved';

  // Use FormData so PHP can read $_POST without JSON decoding
  const fd = new FormData();
  fd.append('candidate_id', String(candidateId));
  fd.append('status', status);

  try {
    await apiFetch('api/elections/approve_candidate.php', {
      method: 'POST',
      body: fd
    });
  } catch (err) {
    // surface an error if PHP sends one
    try { const j = await err.json(); alert(j.error || 'Action failed'); } catch {}
    throw err;
  }

  // Refresh the right card (prefer explicit data-*; fall back to DOM)
const orgIdAttr  = +(btn.dataset.orgId  || 0);
const clubIdAttr = +(btn.dataset.clubId || 0);
const kindAttr   = String(btn.dataset.kind || '').toLowerCase();

if (orgIdAttr || kindAttr === 'org') {
  // choose the proper container id that exists on this page
  const containerId = document.getElementById('orgElectionsCard') ? 'orgElectionsCard' : 'electionsCard';
  await mountElectionsOrg(orgIdAttr || window.CURRENT_ORG_ID || 0, containerId);
} else {
  await mountElections(clubIdAttr || window.CURRENT_CLUB_ID || 0);
}


  // Refresh the right card
  if (btn.closest('#orgElectionsCard')) {
    await mountElectionsOrg(window.CURRENT_ORG_ID || 0, 'orgElectionsCard');
  } else {
    await mountElections(window.CURRENT_CLUB_ID || 0);
  }
});


// Heart toggle (card + modal), same behavior as UserProfile
document.addEventListener('click', async (ev) => {
const btn = ev.target.closest('.btn-like');
  if (!btn) return;

  const postEl = btn.closest('.feed-post, .pm-box, [data-id], [data-post-id]');
  const postKey = postEl?.dataset.id || postEl?.dataset.postId;
  if (!postKey) return;

  // If your data-id is "kind:id" (e.g., "news:42"), extract the numeric id:
  const postId = String(postKey).includes(':') ? String(postKey).split(':')[1] : String(postKey);

  btn.disabled = true;
  try {
    const fd = new FormData();
    fd.append('post_id', postId);

    const json = await apiJSON(LIKE_API, { method:'POST', body: fd });
    // Expect: { ok:true, liked:<bool>, likes:<int> }
    if (json?.ok) {
      // clicked button
      paintHeart(btn, !!json.liked);

      // card
      const card = document.querySelector(`.feed-post[data-id$=":${postId}"], .feed-post[data-id="${postId}"]`);
      if (card) {
        paintHeart(card.querySelector('.btn-like'), !!json.liked);
        paintLikeCount(card, json.likes);
      }
      // modal (if open)
      const modal = document.getElementById('postModal');
      if (modal && String(modal.dataset.postId) === String(postId)) {
        paintHeart(modal.querySelector('.pm-like'), !!json.liked);
        paintLikeCount(modal, json.likes);
      }
    }
  } catch (e) {
    console.error('Like toggle failed', e);
  } finally {
    btn.disabled = false;
  }
});

async function populateLikes(ids) {
  if (!ids?.length) return;
  const fd = new FormData();
  fd.append('post_ids', ids.join(','));
  try {
    const json = await apiJSON(LIKES_STATUS_API, { method:'POST', body: fd });
    if (json?.ok && json.items) {
      for (const [pid, st] of Object.entries(json.items)) {
        const card = document.querySelector(`.feed-post[data-id$=":${pid}"], .feed-post[data-id="${pid}"]`);
        if (card) {
          paintHeart(card.querySelector('.btn-like'), !!st.liked);
          paintLikeCount(card, st.likes || 0);
        }
      }
    }
  } catch (e) {
    console.error('populateLikes failed', e);
  }
}



// --- feed helpers (scoped to this file) ---
function pickClubName() {
  const el = document.getElementById('club-name');
  return (el?.textContent || '').trim();
}



async function mountClubFeed(clubId){
  ensureFeedTemplates();
  const list = document.getElementById('feedList');
  if (!list) return;

  // We’ll match by club name (string) which both news/events return
  const clubName = pickClubName();

  // Pull both feeds then merge + sort
  const [newsRes, eventsRes] = await Promise.all([
    apiFetch('api/feed/list.php?kind=news&limit=100').catch(()=>null),
    apiFetch('api/feed/list.php?kind=events&limit=100').catch(()=>null),
  ]);

  const news = (newsRes?.items || []).filter(i => String(i.club||'') === clubName);
  const evts = (eventsRes?.items || []).filter(i => String(i.club||'') === clubName);

  // Normalize to our “post” shape

function nPost(n){
  return {
    id: n.id,
    kind: 'news',
    authorName: clubName,
    authorPic: CURRENT_CLUB_AVATAR_URL || '',
    created_at: n.created_at || n.updated_at || '',
    caption: (n.title ? (n.title + ' — ') : '') + (n.content || ''),
    images: collectImages(n, 'content')   // << use content folder when needed
  };
}

function ePost(e){
  const when = [e.date, e.start_time, e.end_time].filter(Boolean).join(' ');

  // ✅ Prefer `description` but gracefully fall back to other common keys
  const desc =
    e.description ??
    e.details ??
    e.caption ??
    e.content ??
    e.desc ??
    '';

  return {
    id: e.id,
    kind: 'event',
    authorName: clubName,
    authorPic: CURRENT_CLUB_AVATAR_URL || '',
    created_at: e.created_at || e.updated_at || e.reg_deadline || '',
    caption: (e.title ? (e.title + ' — ') : '') + desc + (when ? (' • ' + when) : ''),
    images: collectImages(e, 'events') // keeps banner/featured_image, etc.
  };
}


  const posts = [...news.map(nPost), ...evts.map(ePost)]
    .sort((a,b)=> new Date(b.created_at||0) - new Date(a.created_at||0));

  // Paint
  list.innerHTML = '';
  posts.forEach(p => list.appendChild(buildCardFromPost(p)));
  // Set initial like state/count for all rendered posts
const ids = [...list.querySelectorAll('.feed-post')].map(el => {
  const key = el.dataset.id || '';
  return key.includes(':') ? key.split(':')[1] : key;
}).filter(Boolean);
seedAllHearts(list);
populateLikes(ids);

  seedAllHearts(list);

}




// Student → first club they belong to
async function fetchMyClubsForStudent(me) {
  const tries = [
    'api/clubs/mine.php',
    'api/memberships/my_clubs.php',
    `api/clubs/list.php?member_id=${encodeURIComponent(me.student_id || 'me')}`,
    `api/clubs/members/list.php?student_id=${encodeURIComponent(me.student_id || 'me')}`
  ];
  for (const url of tries) {
    try {
      const r = await apiFetch(url);
      let items = r?.items || r?.clubs || (Array.isArray(r) ? r : []);
      // Map membership rows → clubs
      if (items?.length && items[0]?.club_id && !items[0]?.id) {
        items = items.map(x => ({ id: x.club_id, name: x.club_name || x.name }));
      }
      if (items?.length && items[0]?.id) return items;
    } catch {}
  }
  return [];
}

// Adviser → organizations they handle (prefer this)
async function fetchOrgsForAdviser(me) {
  const tries = [
    `api/organizations/list.php?adviser_id=${encodeURIComponent(me.adviser_id || 'me')}`,
    'api/organizations/mine.php'
  ];
  for (const url of tries) {
    try {
      const r = await apiFetch(url);
      const items = r?.items || r?.organizations || [];
      if (items?.length && items[0]?.id) return items;
    } catch {}
  }
  return [];
}

// Adviser → clubs they advise (fallback if no org)
async function fetchClubsForAdviser(me) {
  const tries = [
    `api/clubs/list.php?adviser_id=${encodeURIComponent(me.adviser_id || 'me')}`,
    'api/clubs/mine.php?role=adviser'
  ];
  for (const url of tries) {
    try {
      const r = await apiFetch(url);
      const items = r?.items || r?.clubs || [];
      if (items?.length && items[0]?.id) return items;
    } catch {}
  }
  return [];
}

// If page has no ?id / ?org_id, decide and navigate.
// Returns true if we navigated away (so caller should return).
async function smartRouteIfNoQuery() {
  const u = new URL(location.href);
  if (u.searchParams.has('id') || u.searchParams.has('org_id')) return false;

  const me = await getCurrentUser();
  if (!me || !me.role) return false;

  const base = (window.PROJECT_BASE ? window.PROJECT_BASE + '/' : '');

  if (me.role === 'student') {
    const clubs = await fetchMyClubsForStudent(me);
    if (clubs.length && clubs[0]?.id) {
      location.replace(`${base}Student-ClubDetails.html?id=${encodeURIComponent(clubs[0].id)}`);
      return true;
    }
    return false;
  }

  if (me.role === 'adviser') {
    const orgs = await fetchOrgsForAdviser(me);
    if (orgs.length && orgs[0]?.id) {
      const o = orgs[0];
      const qs = new URLSearchParams({ org_id: o.id, org_name: o.name || '' });
      location.replace(`${base}Student-ClubDetails.html?${qs}`);
      return true;
    }
    const clubs = await fetchClubsForAdviser(me);
    if (clubs.length && clubs[0]?.id) {
      location.replace(`${base}Student-ClubDetails.html?id=${encodeURIComponent(clubs[0].id)}`);
      return true;
    }
    return false;
  }

  return false;
}
// === ME-based self-router (additive; no existing code removed) ===
async function __meRoute_getMe() {
  try {
    const r = await apiFetch('api/auth/me.php');
    const me = r?.me;
    if (!me || !me.role) return null;
    return {
      role: String(me.role).toLowerCase(),
      student_id: me.student_id ?? null,
      adviser_id: me.adviser_id ?? null,
    };
  } catch { return null; }
}

// Hide Elections for non-members (students). Advisers always see it.
async function hideElectionsIfNotMember() {
  try {
    const me = await getMe();
    const role = String(me?.role || '').toLowerCase();

    // Advisers can always view Elections
    if (role === 'adviser') return;

    const clubId = (typeof CURRENT_CLUB_ID !== 'undefined' && CURRENT_CLUB_ID) || (window.CURRENT_CLUB_ID || 0);
    if (!clubId) return;

    // Not logged in → treat as non-member
    if (!me) {
      ['electionsCard','orgElectionsCard'].forEach(id => document.getElementById(id)?.setAttribute('hidden','true'));
      return;
    }

    const email = (me.sti_email || '').toLowerCase();
    const sid   = Number(me.student_id || 0);

    const r = await apiFetch(`api/clubs/members/list.php?club_id=${encodeURIComponent(clubId)}`);
    const items = r?.items || [];

    const isMember = items.some(m =>
      Number(m.student_id) === sid ||
      (String(m.email || '').toLowerCase() === email)
    );

    if (!isMember) {
      ['electionsCard','orgElectionsCard'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.setAttribute('hidden','true');
      });
    }
  } catch (_) {
    // On API failure, fail-safe: hide Elections
    ['electionsCard','orgElectionsCard'].forEach(id => document.getElementById(id)?.setAttribute('hidden','true'));
  }
}


async function __meRoute_studentClubId(studentId) {
  // 1) membership list → club_id
  try {
    const r = await apiFetch(`api/clubs/members/list.php?student_id=${encodeURIComponent(studentId)}`);
    const rows = r?.items || r?.members || [];
    if (Array.isArray(rows)) {
      const m = rows.find(x => x && (x.club_id || x.club));
      if (m && (m.club_id || m.club)) return m.club_id || m.club;
      const asClub = rows.find(x => x && x.id);
      if (asClub?.id) return asClub.id;
    }
  } catch {}
  // 2) clubs list with member filter
  try {
    const r = await apiFetch(`api/clubs/list.php?member_id=${encodeURIComponent(studentId)}`);
    const items = r?.items || r?.clubs || [];
    if (Array.isArray(items) && items[0]?.id) return items[0].id;
  } catch {}
  return null;
}

async function __meRoute_adviserOrg(adviserId) {
  // 1) filtered orgs
  try {
    const r = await apiFetch(`api/organizations/list.php?adviser_id=${encodeURIComponent(adviserId)}`);
    const items = r?.items || r?.organizations || [];
    if (Array.isArray(items) && items[0]?.id) return { id: items[0].id, name: items[0].name || '' };
  } catch {}
  // 2) unfiltered → client-side match
  try {
    const r = await apiFetch('api/organizations/list.php');
    const items = r?.items || r?.organizations || [];
    if (Array.isArray(items)) {
      const m = items.find(o => String(o.adviser_id ?? o.adviser ?? '') === String(adviserId));
      if (m?.id) return { id: m.id, name: m.name || '' };
    }
  } catch {}
  return null;
}

async function __meRoute_adviserClubId(adviserId) {
  // 1) filtered clubs
  try {
    const r = await apiFetch(`api/clubs/list.php?adviser_id=${encodeURIComponent(adviserId)}`);
    const items = r?.items || r?.clubs || [];
    if (Array.isArray(items) && items[0]?.id) return items[0].id;
  } catch {}
  // 2) unfiltered → client-side match
  try {
    const r = await apiFetch('api/clubs/list.php');
    const items = r?.items || r?.clubs || [];
    if (Array.isArray(items)) {
      const m = items.find(c => String(c.adviser_id ?? c.adviser ?? '') === String(adviserId));
      if (m?.id) return m.id;
    }
  } catch {}
  return null;
}

// Run only when there is NO ?id or ?org_id. Returns true if it redirected.
async function __meRoute_ifNoQuery() {
  try {
    if (window.__ME_ROUTED__) return false;
    const url = new URL(location.href);
    if (url.searchParams.has('id') || url.searchParams.has('org_id')) return false;

    const me = await __meRoute_getMe();
    if (!me || !me.role) return false;

    const base = (window.PROJECT_BASE ? window.PROJECT_BASE + '/' : '');

    if (me.role === 'student' && me.student_id) {
      const cid = await __meRoute_studentClubId(me.student_id);
      if (cid) {
        window.__ME_ROUTED__ = true;
        location.replace(`${base}Student-ClubDetails.html?id=${encodeURIComponent(cid)}`);
        return true;
      }
      return false;
    }

    if (me.role === 'adviser' && me.adviser_id) {
      // Prefer an organization; else a club
      const org = await __meRoute_adviserOrg(me.adviser_id);
      if (org?.id) {
        window.__ME_ROUTED__ = true;
        const qs = new URLSearchParams({ org_id: org.id, org_name: org.name || '' });
        location.replace(`${base}Student-ClubDetails.html?${qs}`);
        return true;
      }
      const cid = await __meRoute_adviserClubId(me.adviser_id);
      if (cid) {
        window.__ME_ROUTED__ = true;
        location.replace(`${base}Student-ClubDetails.html?id=${encodeURIComponent(cid)}`);
        return true;
      }
      return false;
    }

    return false;
  } catch { return false; }
}

// === Additive router using api/auth/me.php ===
async function __meLandingRoute_ifNoQuery() {
  try {
    const url = new URL(location.href);
    if (url.searchParams.has('id') || url.searchParams.has('org_id')) return false; // already targeted

    const r = await apiFetch('api/auth/me.php');
    const landing = r?.landing;
    if (!landing || !landing.id) return false;

    const base = (window.PROJECT_BASE ? window.PROJECT_BASE + '/' : '');
    if (landing.type === 'org') {
      const qs = new URLSearchParams({ org_id: landing.id, org_name: landing.name || '' });
      location.replace(`${base}Student-ClubDetails.html?${qs}`);
      return true;
    }
    if (landing.type === 'club') {
      location.replace(`${base}Student-ClubDetails.html?id=${encodeURIComponent(landing.id)}`);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
// === ADDITIVE: me.php–only self-router (no other files changed) ===
async function __meOnly_getMe() {
  try {
    const r = await apiFetch('api/auth/me.php');
    const me = r?.me;
    if (!me || !me.role) return null;
    return {
      role: String(me.role).toLowerCase(),
      student_id: me.student_id ?? null,
      adviser_id: me.adviser_id ?? null,
    };
  } catch { return null; }
}

async function __meOnly_studentClubId(studentId) {
  // 1) membership rows → club_id
  try {
    const r = await apiFetch(`api/clubs/members/list.php?student_id=${encodeURIComponent(studentId)}`);
    const rows = r?.items || r?.members || [];
    if (Array.isArray(rows)) {
      const m = rows.find(x => x && (x.club_id || x.club));
      if (m && (m.club_id || m.club)) return m.club_id || m.club;
      const asClub = rows.find(x => x && x.id);
      if (asClub?.id) return asClub.id;
    }
  } catch {}
  // 2) clubs list with member filter
  try {
    const r = await apiFetch(`api/clubs/list.php?member_id=${encodeURIComponent(studentId)}`);
    const items = r?.items || r?.clubs || [];
    if (Array.isArray(items) && items[0]?.id) return items[0].id;
  } catch {}
  return null;
}

async function __meOnly_adviserOrg(adviserId) {
  // 1) filtered orgs
  try {
    const r = await apiFetch(`api/organizations/list.php?adviser_id=${encodeURIComponent(adviserId)}`);
    const items = r?.items || r?.organizations || [];
    if (Array.isArray(items) && items[0]?.id) return { id: items[0].id, name: items[0].name || '' };
  } catch {}
  // 2) unfiltered → client-side match by adviser_id
  try {
    const r = await apiFetch('api/organizations/list.php');
    const items = r?.items || r?.organizations || [];
    if (Array.isArray(items)) {
      const m = items.find(o => String(o.adviser_id ?? o.adviser ?? '') === String(adviserId));
      if (m?.id) return { id: m.id, name: m.name || '' };
    }
  } catch {}
  return null;
}

async function __meOnly_adviserClubId(adviserId) {
  // 1) filtered clubs
  try {
    const r = await apiFetch(`api/clubs/list.php?adviser_id=${encodeURIComponent(adviserId)}`);
    const items = r?.items || r?.clubs || [];
    if (Array.isArray(items) && items[0]?.id) return items[0].id;
  } catch {}
  // 2) unfiltered → client-side match by adviser_id
  try {
    const r = await apiFetch('api/clubs/list.php');
    const items = r?.items || r?.clubs || [];
    if (Array.isArray(items)) {
      const m = items.find(c => String(c.adviser_id ?? c.adviser ?? '') === String(adviserId));
      if (m?.id) return m.id;
    }
  } catch {}
  return null;
}

// ===== ME-BASED AUTO-ROUTE (no query) using existing PHP (no changes needed) =====
async function getMe() {
  try {
    const out = await apiFetch('api/auth/me.php'); // returns { ok, me: {role, adviser_id|student_id, sti_email, ...} }
    return out?.ok ? out.me : null;
  } catch { return null; }
}

async function fetchAllClubs() {
  try {
    const out = await apiFetch('api/clubs/list.php?limit=200'); // includes adviser_id, adviser_email, member_count, etc.
    return out?.items || [];
  } catch { return []; }
}

async function fetchAllOrgs() {
  try {
    const out = await apiFetch('api/organizations/list.php?status=active&limit=200'); // includes adviser_id/adviser_email
    return out?.items || [];
  } catch { return []; }
}

// Find adviser's org or club by comparing adviser_id or email (no server filter needed)
async function findAdviserTarget(me) {
  const email = (me.sti_email || '').toLowerCase();
  const id = Number(me.adviser_id || 0);

  const [clubs, orgs] = await Promise.all([fetchAllClubs(), fetchAllOrgs()]);

  // Prefer organization if they manage one
  const org = orgs.find(o =>
    Number(o.adviser_id) === id ||
    (o.adviser_email || '').toLowerCase() === email
  );
  if (org) return { kind: 'org', id: org.id, name: org.name };

  // Otherwise, find their club to advise
  const club = clubs.find(c =>
    Number(c.adviser_id) === id ||
    (c.adviser_email || '').toLowerCase() === email
  );
  if (club) return { kind: 'club', id: club.id, name: club.name };

  return null;
}

// Find a student's single club by scanning each club's members (stop at first hit)
async function findStudentClubTarget(me) {
  const email = (me.sti_email || '').toLowerCase();
  const sid = Number(me.student_id || 0);

  const clubs = await fetchAllClubs();
  for (const c of clubs) {
    try {
      const r = await apiFetch(`api/clubs/members/list.php?club_id=${encodeURIComponent(c.id)}`);
      const items = r?.items || [];
      if (items.some(m =>
        Number(m.student_id) === sid ||
        (m.email || '').toLowerCase() === email
      )) {
        return { kind: 'club', id: c.id, name: c.name };
      }
    } catch {}
  }
  return null;
}

async function __meOnly_ifNoQuery() {
  const hasExplicitQuery =
    getParam('id') || getParam('name') || getParam('org_id') || getParam('org_name');
  if (hasExplicitQuery) return false;

  const me = await getMe();
  if (!me) return false; // not signed in, or session unknown

  let target = null;
  if (me.role === 'adviser') {
    target = await findAdviserTarget(me);
  } else if (me.role === 'student') {
    target = await findStudentClubTarget(me);
  }

  if (!target) return false;

  const base = PROJECT_BASE || '';
  if (target.kind === 'org') {
    window.location.replace(`${base}/Student-ClubDetails.html?org_id=${encodeURIComponent(target.id)}&org_name=${encodeURIComponent(target.name)}`);
  } else {
    window.location.replace(`${base}/Student-ClubDetails.html?id=${encodeURIComponent(target.id)}`);
  }
  return true;
}

// Force "my" club/org even if an id is present, except when coming from the List page
// Force "my" club/org even if an id is present, except when coming from the List page
async function __forceMineWhenSidebar() {
  const url = new URL(location.href);
  const hasAnyId = url.searchParams.has('id') || url.searchParams.has('org_id');
  if (!hasAnyId) return false;

  // If user came from the List page, honor their explicit choice
  const ref = document.referrer || '';
  const fromList = /Student-ListOfClub\.html/i.test(ref);
  if (fromList) return false;

  // Prevent multiple runs on the same load (avoids loops)
  if (window.__FORCE_MINE_DONE__) return false;
  window.__FORCE_MINE_DONE__ = true;

  // Use your existing helpers
  const me = await getMe();
  if (!me || !me.role) return false;

  const base = (window.PROJECT_BASE ? window.PROJECT_BASE + '/' : '');

  if (me.role === 'student') {
    const target = await findStudentClubTarget(me); // { kind:'club', id, name }
    const currentId = url.searchParams.get('id');
    if (target?.id && String(target.id) !== String(currentId)) {
      location.replace(`${base}Student-ClubDetails.html?id=${encodeURIComponent(target.id)}`);
      return true;
    }
    return false;
  }

  if (me.role === 'adviser') {
    const target = await findAdviserTarget(me); // { kind:'org'|'club', id, name }

    if (target?.kind === 'org') {
      const currentOrgId = url.searchParams.get('org_id');
      // ⬇️ only redirect if DIFFERENT org_id
      if (String(target.id) === String(currentOrgId)) return false;
      const qs = new URLSearchParams({ org_id: target.id, org_name: target.name || '' });
      location.replace(`${base}Student-ClubDetails.html?${qs}`);
      return true;
    }

    if (target?.kind === 'club') {
      const currentId = url.searchParams.get('id');
      // ⬇️ only redirect if DIFFERENT club id
      if (String(target.id) === String(currentId)) return false;
      location.replace(`${base}Student-ClubDetails.html?id=${encodeURIComponent(target.id)}`);
      return true;
    }
  }

  return false;
}

// Hide join-related UI (adviser view)
function hideJoinForAdviser() {
  try {
    if (cancelBtn && cancelBtn.parentNode) cancelBtn.parentNode.removeChild(cancelBtn);
    cancelBtn = null;
    if (joinBtn) {
      joinBtn.style.display = 'none';
      joinBtn.setAttribute('aria-hidden', 'true');
      joinBtn.classList.add('is-disabled');
    }
  } catch {}
}
async function loadOrgClubs(orgId, orgName){
  // UL target + header
  const ul = document.getElementById('suggest-list') ||
             document.querySelector('.suggest-card .suggest-list');
  if (!ul) return;
  ul.innerHTML = `<li style="padding:.5rem 0; color:#6b7280">Loading…</li>`;

  const head = document.querySelector('.suggest-card .card-head');
  if (head) head.textContent = orgName ? `Clubs in ${orgName}` : 'Clubs in this organization';

  // 1) Try filtered fetch
  let list = [];
  try {
    const r = await apiFetch(`api/clubs/list.php?limit=500&organization_id=${encodeURIComponent(orgId)}`);
    list = Array.isArray(r?.items) ? r.items : [];
  } catch {}

  // 2) If backend didn’t filter, fetch all and filter client-side
  if (!list.length) {
    try {
      const r2 = await apiFetch('api/clubs/list.php?limit=500');
      const all = Array.isArray(r2?.items) ? r2.items : [];
      const want = String(orgId);
      list = all.filter(x => {
        const raw = x.organization_id ?? x.org_id ?? x.organization ?? x.org ?? null;
        return raw != null && String(raw) === want;
      });
    } catch {}
  }

  if (!list.length) {
    ul.innerHTML = `<li style="padding:.5rem 0; color:#6b7280">No clubs yet.</li>`;
    return;
  }

  // Render first 6; link to the *student* details page from this file
  ul.innerHTML = list.slice(0, 6).map(c => {
    const thumb = c.profile_picture ? `style="background-image:url('${mediaUrl(c.profile_picture)}')"` : '';
    const sub = (typeof c.member_count === 'number')
      ? `${c.member_count} ${c.member_count === 1 ? 'member' : 'members'}`
      : (c.category || '');
    return `
      <li>
        <a class="suggest-item" href="Student-ClubDetails.html?id=${c.id}">
          <div class="suggest-thumb" ${thumb}></div>
          <div class="suggest-meta">
            <div class="suggest-name">${c.name || 'Club'}</div>
            <div class="suggest-sub">${sub || ''}</div>
          </div>
        </a>
      </li>`;
  }).join('');
}



async function init(){
 const forced = await __forceMineWhenSidebar(); if (forced) return;
  const _meRouted = await __meOnly_ifNoQuery();  if (_meRouted) return;
  const routed   = await smartRouteIfNoQuery();  if (routed) return;

  // ✨ Get the current user (from me.php) and keep the role
const ME = await getMe().catch(() => null);
window.ME = ME;                      // <-- add this line
window.__ME_ROLE = (ME && ME.role) ? String(ME.role).toLowerCase() : null;





// Renders the Officers modal table and opens the modal
function renderOfficersModal(rows) {
  // Expected DOM:
  //  - Modal with id="#officersModal"
  //  - <tbody> inside for the rows
  const modal = document.querySelector('#officersModal');
  const tbody = modal?.querySelector('tbody');
  if (!modal || !tbody) return;

  if (!rows || !rows.length) {
    tbody.innerHTML = `<tr><td colspan="2">No officers yet.</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.name || '')}</td>
        <td>${escapeHtml(r.role || r.title || 'Officer')}</td>
      </tr>
    `).join('');
  }
  openModal('#officersModal');
}

// Minimal HTML escape for safety
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]
  ));
}

  // 1) Sidebar toggle (unchanged)
  document.addEventListener('DOMContentLoaded', () => {
    const burger  = document.getElementById('sidebarHamburger');
    const sideNav = document.getElementById('sideNav');
    if (!burger || !sideNav) return;

    // Open/close on click (cover both CSS patterns)
    burger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // some pages show via body.sidebar-expanded (Student-HomeNews)
      document.body.classList.toggle('sidebar-expanded');
      // some pages show via .is-open on the aside
      sideNav.classList.toggle('is-open');
      // basic ARIA for accessibility
      const open = sideNav.classList.contains('is-open') || document.body.classList.contains('sidebar-expanded');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      sideNav.setAttribute('aria-hidden', open ? 'false' : 'true');
    }, { capture: true });
  });

  // 2) Read URL params
  const orgId   = parseInt(getParam('org_id') || '0', 10);
  const orgName = getParam('org_name') || '';
  const clubId  = parseInt(getParam('id') || '0', 10);


if (orgId) {
  await loadOrganization(orgId, orgName);
  if (typeof loadOrgClubs === 'function') await loadOrgClubs(orgId, orgName);
  else if (typeof loadClubsForOrg === 'function') await loadClubsForOrg(orgId);
  if (typeof setOrgModeUI === 'function') setOrgModeUI(orgId, orgName);

  // make sure Create form posts org_id and prevents reload
  wireCreateElectionOrg?.(orgId);

  // render actual org election from backend
  await mountElectionsOrg(orgId);

  return;
}



  // 4) Guard: never call loadClub(0). If no clubId, route or fall back to list.
  if (!clubId) {
    // one more try in case session was late
    const tried = await __meOnly_ifNoQuery();
    if (tried) return;

    const base = (window.PROJECT_BASE ? window.PROJECT_BASE + '/' : '');
    window.location.href = `${base}Student-ListOfClub.html`;
    return;
  }

  // 5) Normal club flow
// 5) Normal club flow
CURRENT_CLUB_ID = clubId;
await loadClub(clubId);
await loadOtherClubs(clubId);
await mountClubFeed(clubId);
await hideElectionsIfNotMember();
if (!document.getElementById('electionsCard')?.hasAttribute('hidden')) {
  await mountElections(clubId);
  refreshAdviserAvatar({ clubId: (window.CURRENT_CLUB_ID || clubId || 0) });

}

// If this club belongs to an organization, also show the org election in a second card
const __ORG_ID = (typeof window.CURRENT_ORG_ID === 'number' ? window.CURRENT_ORG_ID : 0) || 0;
if (__ORG_ID > 0) {
  if (ensureOrgElectionsCard()) {
    await mountElectionsOrg(__ORG_ID, 'orgElectionsCard');
    refreshAdviserAvatar({ orgId: __ORG_ID });
  }
}

// Elections
wireCreateElection(clubId);
wireApply();
await mountElections(clubId);
refreshAdviserAvatar({ clubId: (window.CURRENT_CLUB_ID || clubId || 0) });




if (window.__ME_ROLE === 'adviser') {
  // Advisers: hide join/cancel UI entirely
  hideJoinForAdviser();
} else {
  // Students: show/join as usual
  const state = await setJoinStateFromServer(clubId);
  if (state === 'can_request') wireJoin(clubId);
}

// Members pill wiring still ok for both roles
if (typeof wireMembersUI === 'function') wireMembersUI(clubId);

}

// ---- Adviser join/view hider (safe + additive) ----
let __ME_ROLE_CACHE = null;

async function __ensureRole(){
  if (__ME_ROLE_CACHE !== null) return __ME_ROLE_CACHE;
  try {
    const r = await apiFetch('api/auth/me.php');
    __ME_ROLE_CACHE = String(r?.me?.role || '').toLowerCase();
  } catch { __ME_ROLE_CACHE = null; }
  return __ME_ROLE_CACHE;
}

(function addNavGap(){
  var apply = function(){
    var wr = document.querySelector('.content-wrapper');
    if (wr) wr.style.paddingTop = 'calc(var(--navbar-height) + 16px)';
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }
})();


function __hideJoinUI(){
  try {
    if (typeof cancelBtn !== 'undefined' && cancelBtn && cancelBtn.parentNode) {
      cancelBtn.parentNode.removeChild(cancelBtn);
    }
    // keep the var in sync if you have it in outer scope
    try { cancelBtn = null; } catch {}
    if (typeof joinBtn !== 'undefined' && joinBtn) {
      joinBtn.style.display = 'none';
      joinBtn.setAttribute('aria-hidden', 'true');
      joinBtn.onclick = null;
      joinBtn.classList.add('is-disabled');
    }
  } catch {}
}

// Call this wherever you want to hide for advisers
async function __hideJoinIfAdviser(){
  const role = await __ensureRole();
  if (role === 'adviser') __hideJoinUI();
}



  // ---------- LOAD CURRENT CLUB ----------
async function loadClub(id) {
  try {
    const r = await apiFetch(`api/clubs/get.php?id=${id}`);
    if (!r?.ok) throw new Error(r?.error || 'Failed to load club');
    const c = r.item || {};
    window.CURRENT_ORG_ID = Number(c.org_id || c.organization_id || 0) || 0;
// TEMP debug: verify in console, then remove later
console.debug('[club] org_id =>', window.CURRENT_ORG_ID, 'raw:', c.org_id, c.organization_id);
    
if (!window.CURRENT_ORG_ID && typeof c.orgId === 'number') {
  window.CURRENT_ORG_ID = Number(c.orgId) || 0;
}


    // Cover & avatar
    coverEl.style.backgroundImage  = c.cover_picture ? `url('${mediaUrl(c.cover_picture)}')` : 'none';
    avatarEl.style.backgroundImage = c.profile_picture ? `url('${mediaUrl(c.profile_picture, 'content')}')` : 'none';
    CURRENT_CLUB_AVATAR_URL = c.profile_picture ? mediaUrl(c.profile_picture, 'content') : 'Images/profile.png';

    // Meta
    nameEl.textContent = c.name || 'Club';
    const members = (typeof c.member_count === 'number') ? c.member_count : 0;

    // "X members" subtext under the hero — make it clickable
    if (subEl) {
      subEl.textContent = `${members} ${members === 1 ? 'member' : 'members'}`;
      subEl.style.cursor = 'pointer';
      subEl.title = 'View members';
      if (!subEl.__wired) {
        subEl.__wired = true;
        subEl.addEventListener('click', () => {
          if (typeof openMembersList === 'function') openMembersList(id);
        });
      }
    }

    // Right-side blue pill — also clickable
    if (advMembers) {
      advMembers.textContent = String(members);
      const pill =
        advMembers.closest('.adviser-stats .metric') ||
        advMembers.parentElement ||
        advMembers;
      if (pill && !pill.__wired) {
        pill.__wired = true;
        pill.style.cursor = 'pointer';
        pill.title = 'View members';
        pill.addEventListener('click', () => {
          if (typeof openMembersList === 'function') openMembersList(id);
        });
      }
    }

    // Description
    descEl.textContent = c.description || 'No description yet.';

    // Adviser
    advAvatar.style.backgroundImage = '';
    advName.textContent  = c.adviser_name || '—';
    advEmail.textContent = c.adviser_email || '';

  } catch (_) {
    nameEl.textContent = 'Club';
    if (subEl) subEl.textContent = '';
    if (advMembers) advMembers.textContent = '0';
    descEl.textContent = 'No description yet.';
  }
}

async function loadOrganization(id){
  // Fetch org details; map fields defensively
  const r = await apiFetch(`api/organizations/get.php?id=${id}`);
  if (!r?.ok) throw new Error(r?.error || 'Failed to load organization');
  const o = r.item || {};

  // Reuse existing DOM targets
  coverEl.style.backgroundImage  = o.cover_picture  ? `url('${mediaUrl(o.cover_picture)}')`  : 'none';
  avatarEl.style.backgroundImage = o.profile_picture ? `url('${mediaUrl(o.profile_picture)}')` : 'none';
  CURRENT_CLUB_AVATAR_URL = o.profile_picture ? mediaUrl(o.profile_picture) : '';


  nameEl.textContent = o.name || 'Organization';
  if (subEl) subEl.textContent = ''; // orgs may not have member count
  descEl.textContent = o.description || o.about || 'No description yet.';

  // Adviser card (best-effort)
  advAvatar.style.backgroundImage = '';
  advName.textContent  = o.adviser_name || o.adviser_full_name || '—';
  advEmail.textContent = o.adviser_email || '';

  // Tweak headings to say “organization”
  const aboutHead = document.querySelector('.card-about .card-head');
  if (aboutHead) aboutHead.textContent = 'About this organization';
  const advHead = document.querySelector('.right-stack .card .card-head');
  if (advHead) advHead.textContent = 'Organization Adviser';

  // Repurpose Join button → “View Clubs” (students only; hide for advisers)
  if (joinBtn) {
    // Try the cached role helper if present; otherwise fall back to window flag
    let role = null;
    try {
      if (typeof __ensureRole === 'function') role = await __ensureRole();
    } catch {}
    if (!role && typeof window !== 'undefined' && window.__ME_ROLE) {
      role = String(window.__ME_ROLE).toLowerCase();
    }

    if (role === 'adviser') {
      // Hide entirely for advisers
      if (typeof __hideJoinUI === 'function') {
        __hideJoinUI();
      } else {
        joinBtn.style.display = 'none';
        joinBtn.setAttribute('aria-hidden', 'true');
        joinBtn.onclick = null;
        joinBtn.classList.add('is-disabled');
      }
    } else {
      // Students: show “View Clubs”
      joinBtn.classList.add('btn', 'btn-primary');
      joinBtn.classList.remove('is-disabled');
      joinBtn.removeAttribute('disabled');
      joinBtn.textContent = `View Clubs in ${o.name || 'this organization'}`;
      joinBtn.onclick = () => {
        const base = (window.PROJECT_BASE ? window.PROJECT_BASE + '/' : '');
        const qs = new URLSearchParams({ org_id: String(id), org_name: o.name || '' });
        window.location.href = `${base}Student-ListOfClub.html?${qs}`;
      };
    }
  }
}


__hideJoinIfAdviser();
function setOrgModeUI(orgId, orgName) {
  // Retitle the About card
  const aboutHead = document.querySelector('.card-about .card-head');
  if (aboutHead) aboutHead.textContent = 'About this organization';

  const rightHead = document.querySelector('.suggest-card .card-head');
if (rightHead) {
  rightHead.textContent = orgName ? `Clubs in ${orgName}` : 'Clubs in this organization';
  // Make the pill read "Organization Officers" and be non-clickable in org mode
if (advMembers) {
  advMembers.textContent = 'Organization Officers';
  const tail = advMembers.nextSibling;
  if (tail && tail.nodeType === Node.TEXT_NODE) tail.textContent = '';
  wireOfficersUI(orgId);

}

}


  // Reuse the Join button → “View Clubs”
  if (joinBtn) {
    joinBtn.classList.add('btn', 'btn-primary');
    joinBtn.textContent = 'View Clubs';
    joinBtn.removeAttribute('disabled');
    joinBtn.classList.remove('is-disabled');
    joinBtn.setAttribute('aria-disabled','false');
    joinBtn.onclick = () => {
      const base = (window.PROJECT_BASE ? window.PROJECT_BASE + '/' : '');
      const qs = new URLSearchParams({ org_id: orgId, org_name: orgName || '' });
      window.location.href = `${base}Student-ListOfClub.html?${qs}`;
    };
  }

  // Optional: rename adviser card title if it literally says "Adviser"
  const advHead = document.querySelector('.right-stack .card .card-head');
  if (advHead && /adviser/i.test(advHead.textContent)) {
    advHead.textContent = 'Organization Adviser';
  }
}



  // ---------- JOIN/CANCEL STATE HELPERS ----------
  function setDisabled(el, yes){
    if (!el) return;
    if ('disabled' in el) el.disabled = !!yes;
    if (yes) {
      el.setAttribute('aria-disabled','true');
      el.style.pointerEvents = 'none';
      el.tabIndex = -1;
      el.classList.add('is-disabled');
    } else {
      el.removeAttribute('aria-disabled');
      el.style.pointerEvents = '';
      el.tabIndex = 0;
      el.classList.remove('is-disabled');
    }
  }

  // Force-enable an element (used to ensure Cancel button never looks disabled)
  function forceEnable(el){
    if (!el) return;
    el.disabled = false;
    el.removeAttribute('disabled');
    el.setAttribute('aria-disabled','false');
    el.classList.remove('is-disabled','disabled');
    el.style.pointerEvents = 'auto';
    el.style.opacity = '';
    el.style.filter = '';
    el.style.cursor = 'pointer';
    el.tabIndex = 0;
  }

  function setJoinUI(text, disabled, asPending = false){
    if (!joinBtn) return;
    joinBtn.classList.add('btn', 'btn-primary');  // ensure theme
    joinBtn.textContent = text;
    setDisabled(joinBtn, !!disabled);
    joinBtn.classList.toggle('pending', !!asPending);
  }

  function ensureCancelBtn(){
    if (!joinBtn) return null;
    if (cancelBtn && cancelBtn.isConnected) return cancelBtn;

    // Capture the base “join” classes once (exclude state classes)
    const baseJoinClasses =
      joinBtn.dataset.baseClasses ||
      (joinBtn.dataset.baseClasses = Array
        .from(joinBtn.classList)
        .filter(c => c !== 'pending' && c !== 'is-disabled')
        .join(' ')
      );

    cancelBtn = document.createElement('button');
    cancelBtn.id = 'cancel-req-btn';
    cancelBtn.type = 'button';

    // Apply same visual classes as Join (so it looks identical)
    cancelBtn.className = baseJoinClasses || 'btn btn-primary';
    cancelBtn.style.marginLeft = '8px';
    cancelBtn.textContent = 'Cancel Request';

    // Make 100% sure it’s not styled as disabled
    forceEnable(cancelBtn);

    // Insert next to Join
    joinBtn.after(cancelBtn);
    return cancelBtn;
  }

  function hideCancelBtn(){
    if (cancelBtn && cancelBtn.parentNode) cancelBtn.parentNode.removeChild(cancelBtn);
    cancelBtn = null;
  }

async function setJoinStateFromServer(clubId) {
  if (!joinBtn) return 'unknown';
  setJoinUI('Join Club', false, false);
  hideCancelBtn();

  // normalize states from any endpoint shape
  const toState = (r) => {
    if (!r) return 'open';
    if (r.status === 401 || r.statusCode === 401 || r.error === 'unauthorized') return 'unauth';
    // membership/state.php
    if (r.member === true || r.status === 'member') return 'member';
    if (r.pending === true || r.status === 'pending') return 'pending';
    // requests/create.php?check=1
    if (r.status === 'already_member') return 'member';
    if (r.status === 'pending_exists') return 'pending';
    if (r.error === 'already_member_other') return 'member_other';
    return 'open';
  };

  // helper to apply the final UI
  const lockAsMember = (txt='You are already a member') => { setJoinUI(txt, true, true); return 'locked'; };
  const lockAsPending = async () => {
    setJoinUI('Pending Approval', true, true);
    const btn = ensureCancelBtn();
    wireCancel(btn, clubId);
    return 'locked';
  };

  try {
    // 1) preferred: membership state
let res = await apiFetch(
  `api/requests/create.php?club_id=${encodeURIComponent(clubId)}&check=1`,
  { method: 'GET' }
);

    let state = toState(res);

    // 2) fallback: request check
    if (state === 'open' && (!res?.ok || res == null)) {
      try {
        res = await apiFetch(`api/requests/create.php?club_id=${encodeURIComponent(clubId)}&check=1`, { method:'GET' });
        state = toState(res);
      } catch { /* ignore */ }
    }

    // 3) last-resort: look at the actual members list for this club
    if (state === 'open') {
      try {
        const me = (window.__AUTH || window.AUTH_USER || window.CURRENT_USER || window.me || {});
        const myIds = new Set([me.student_id, me.user_id, me.id].map(x => x && String(x)).filter(Boolean));
        const myEmails = new Set([me.email, me.sti_email, me.school_email].map(x => x && String(x).toLowerCase()).filter(Boolean));

        const ml = await apiFetch(`api/clubs/members/list.php?club_id=${encodeURIComponent(clubId)}`);
        const items = Array.isArray(ml?.items) ? ml.items : (Array.isArray(ml?.members) ? ml.members : []);
        const amMember = items.some(m => {
          const mid = m && String(m.student_id ?? m.id ?? '');
          const memail = (m.email || m.sti_email || m.school_email || '').toLowerCase();
          return (mid && myIds.has(mid)) || (memail && myEmails.has(memail));
        });
        if (amMember) state = 'member';
      } catch { /* ignore */ }
    }

    // 4) apply UI
    if (state === 'member')               return lockAsMember();
    if (state === 'member_other')         return lockAsMember(`Already in ${res?.club_name || 'another club'}`);
    if (state === 'pending')              return await lockAsPending();
    if (state === 'unauth')               { setJoinUI('Login as student to join', true, false); return 'locked'; }

    // default: can request
    setJoinUI('Join Club', false, false);
    return 'can_request';
  } catch (e) {
    if (e && (e.status === 401 || String(e.message||'').includes('401'))) {
      setJoinUI('Login as student to join', true, false);
      return 'locked';
    }
    setJoinUI('Join Club', false, false);
    return 'can_request';
  }
}


  // ---------- JOIN (POST → create pending request) ----------
  function wireJoin(clubId){
    if (!joinBtn) return;
    joinBtn.classList.add('btn', 'btn-primary');
    joinBtn.classList.remove('is-disabled');

    joinBtn.addEventListener('click', async () => {
      if (joinBtn.getAttribute('aria-disabled') === 'true' || joinBtn.classList.contains('is-disabled')) return;

      const original = joinBtn.textContent;
      setJoinUI('Requesting…', true, true);

      try{
        const res = await apiFetch('api/requests/create.php', {
          method:'POST',
          body: JSON.stringify({ club_id: clubId })
        });

        if (res?.ok) {
          if (res.status === 'already_member') {
            setJoinUI('You are already a member', true, true);
            hideCancelBtn();
          } else {
            setJoinUI('Pending Approval', true, true);
            const btn = ensureCancelBtn();
            wireCancel(btn, clubId);
          }
        } else {
          if (res?.error === 'already_member_other') {
            const clubName = res.club_name || 'another club';
            setJoinUI(`Already in ${clubName}`, true, true);
            hideCancelBtn();
          } else {
            setJoinUI(original || 'Join Club', false, false);
            hideCancelBtn();
          }
        }
      } catch (e) {
        if (e && e.status === 401) {
          setJoinUI('Login as student to join', true, false);
          hideCancelBtn();
        } else {
          setJoinUI(original || 'Join Club', false, false);
          hideCancelBtn();
        }
      }
    }, { once:true });
  }

  // ---------- CANCEL (POST → delete pending request) ----------
  function wireCancel(btn, clubId){
    if (!btn) return;
    btn.onclick = null;
    // ensure it remains fully interactive
    forceEnable(btn);

    btn.addEventListener('click', async () => {
      // Disable only during the cancel action
      setDisabled(btn, true);
      const prev = joinBtn ? joinBtn.textContent : '';
      setJoinUI('Cancelling…', true, true);

      try{
        const res = await apiFetch('api/requests/cancel.php', {
          method:'POST',
          body: JSON.stringify({ club_id: clubId })
        });

        if (res?.ok && res.deleted > 0) {
          // Back to fresh Join state
          setJoinUI('Join Club', false, false);
          hideCancelBtn();
          // Re-wire join since we used { once:true }
          wireJoin(clubId);
        } else {
          // No pending found; re-check server state to display correct UI
          await setJoinStateFromServer(clubId);
        }
      } catch (e) {
        // Silent fallback to re-check state
        await setJoinStateFromServer(clubId);
      }
    });
  }

function wireOfficersUI(orgId){
  if (!advMembers) return;

  // Prefer the whole pill/container
  const pill = advMembers.closest('.adviser-stats .metric') || advMembers.parentElement || advMembers;
  if (pill.dataset.officersWired === '1') return;
  pill.dataset.officersWired = '1';

  pill.style.cursor = 'pointer';
  pill.setAttribute('role', 'button');
  pill.tabIndex = 0;

  const open = () => openOfficersList(orgId);
  pill.addEventListener('click', open);
  pill.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });
}


function wireMembersUI(clubId){
  if (!advMembers) return;

  // Prefer the whole pill/container if present
  const pill = advMembers.closest('.adv-foot, .adv-members, .adv-card, .card-body') || advMembers.parentElement;
  const target = pill || advMembers;

  if (target.dataset.membersWired === '1') return;
  target.dataset.membersWired = '1';

  // Clickable + keyboard accessible
  target.style.cursor = 'pointer';
  target.setAttribute('role', 'button');
  target.tabIndex = 0;

  const open = () => openMembersList(clubId);
  target.addEventListener('click', open);
  target.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });
}


async function openMembersList(clubId){
  const { overlay, listEl, titleEl } = ensureMembersModal();
  titleEl.textContent = 'Club Members';
  listEl.innerHTML = '<li style="padding:.5rem 0; color:#6b7280">Loading…</li>';
  overlay.classList.add('open');

  try {
    const res = await apiFetch(`api/clubs/members/list.php?club_id=${encodeURIComponent(clubId)}`);
    let items = Array.isArray(res?.items) ? res.items : (Array.isArray(res?.members) ? res.members : []);
    if (!items.length){
      listEl.innerHTML = '<li style="padding:.5rem 0; color:#6b7280">No members.</li>';
      return;
    }

    // winners map produced when the election is CLOSED (set in mountElections)
    const winnersMap =
      (typeof __WINNERS_MAP !== 'undefined' && __WINNERS_MAP) ? __WINNERS_MAP :
      (typeof STATE !== 'undefined' && STATE.winnersMap) ? STATE.winnersMap : {};

    // show winners first; order by known titles, then A–Z
    const ORDER = ['President','Vice President','Finance','Club Representative','Club Secretary'];
    const nameOf = m => (m.full_name || m.name || `${m.first_name||''} ${m.last_name||''}`.trim()).toLowerCase();
    const rank = m => {
      const id = String(m.student_id || m.id || '');
      const won = winnersMap[id];
      if (won && won.length){
        const i = ORDER.indexOf(String(won[0]));
        return i >= 0 ? i : ORDER.length;  // winners in known order first
      }
      return 999;                           // regular members after winners
    };
    items = items.slice().sort((a,b) => rank(a) - rank(b) || nameOf(a).localeCompare(nameOf(b)));

    listEl.innerHTML = items.map(m => {
      const id    = m.student_id || m.id || '';
      const name  = m.full_name || m.name || `${m.first_name||''} ${m.last_name||''}`.trim() || 'Member';
      const email = m.email || m.sti_email || m.school_email || '';
      const won   = winnersMap[id];
      const role  = (won && won.length) ? won.join(', ') : (m.role || m.position || m.membership || 'Member');
      const sub   = [id ? ('ID: ' + id) : '', email].filter(Boolean).join(' · ');
      return `
        <li class="mem-row">
          <div class="col-name">
            <div class="mem-name">${name}</div>
            <div class="mem-sub">${sub}</div>
          </div>
          <div class="col-role">${role}</div>
        </li>`;
    }).join('');
  } catch {
    listEl.innerHTML = '<li style="padding:.5rem 0; color:#ef4444">Could not load members.</li>';
  }
}

async function openOfficersList(orgId){
  // Use the same modal the club list uses
  const { overlay, listEl, titleEl } = ensureMembersModal();
  titleEl.textContent = 'Organization Officers';
  listEl.innerHTML = '<li style="padding:.5rem 0; color:#6b7280">Loading…</li>';
  overlay.classList.add('open');

  try {
    // Pull the latest org election bundle and compute winners locally
    const bundle = await apiFetch(`api/elections/list.php?org_id=${encodeURIComponent(orgId)}`);
    const el         = bundle?.election;
    const positions  = bundle?.positions  || [];
    const candidates = bundle?.candidates || [];

    if (!el || String(el.status).toLowerCase() !== 'closed') {
      listEl.innerHTML = '<li style="padding:.5rem 0; color:#6b7280">No officers yet.</li>';
      return;
    }

    // group candidates by position and pick winners (top N by votes)
    const byPos = new Map();
    for (const c of candidates) {
      if (!byPos.has(c.position_id)) byPos.set(c.position_id, []);
      byPos.get(c.position_id).push(c);
    }

    const officers = [];
    for (const p of positions) {
      const max  = Number(p.max_winners || 1);
      const list = (byPos.get(p.id) || []).slice()
                    .sort((a,b) => (b.votes|0)-(a.votes|0));
      const winners = list.slice(0, Math.max(1, max));
      for (const w of winners) {
        officers.push({
          name:  w.full_name || `#${w.user_id}`,
          email: w.email || '',
          sid:   w.student_id || '',
          role:  p.title || p.name || 'Officer'
        });
      }
    }

listEl.innerHTML = officers.length
  ? officers.map(m => renderOfficerRowClubStyle(m)).join('')
  : '<li style="padding:.5rem 0; color:#6b7280">No officers yet.</li>';

function renderOfficerRowClubStyle(m) {
  // Use BOTH club row classes and alt names, so existing CSS surely applies
  // - club version uses: member-row / member-left / member-name / member-sub / member-role
  // - some screens also style:  mem-row / col-name / col-role
  const sid   = m.sid ? `ID: ${escapeHtml(m.sid)}` : '';
  const email = m.email ? `${sid ? ' • ' : ''}${escapeHtml(m.email)}` : '';
  return `
    <li class="member-row mem-row">
      <div class="member-left col-name">
        <div class="member-name">${escapeHtml(m.name || '')}</div>
        <div class="member-sub">${sid}${email}</div>
      </div>
      <div class="member-role col-role">${escapeHtml(m.role || 'Officer')}</div>
    </li>
  `;
}
  } catch (e) {
    console.warn('Org officers load failed', e);
    listEl.innerHTML = '<li style="padding:.5rem 0; color:#ef4444">Unable to load officers.</li>';
  }
}





function ensureMembersModal(){
  let overlay = document.getElementById('membersModalOverlay');
  if (overlay) {
    return {
      overlay,
      listEl: overlay.querySelector('.members-list'),
      titleEl: overlay.querySelector('.members-title'),
    };
  }
  

  overlay = document.createElement('div');
  overlay.id = 'membersModalOverlay';
overlay.innerHTML = `
  <div class="members-modal" role="dialog" aria-modal="true" aria-labelledby="membersTitle">
    <div class="members-head">
      <h3 id="membersTitle" class="members-title">Club Members</h3>
      <button type="button" class="mem-close" aria-label="Close">×</button>
    </div>
    <div class="members-table">
      <div class="mem-header" role="row">
        <div class="col-name">Name</div>
        <div class="col-role">Role</div>
      </div>
      <ul class="members-list"></ul>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  // styles (tiny + scoped)
  if (!document.getElementById('membersModalCSS')) {
    const css = document.createElement('style');
    css.id = 'membersModalCSS';
css.textContent = `
#membersModalOverlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:none;align-items:center;justify-content:center;z-index:2147483600}
#membersModalOverlay.open{display:flex}
#membersModalOverlay .members-modal{background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.25);width:min(640px,92vw);max-height:82vh;display:flex;flex-direction:column;overflow:hidden}
#membersModalOverlay .members-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e5e7eb}
#membersModalOverlay .members-title{margin:0;font-size:1.05rem}
#membersModalOverlay .mem-close{border:0;background:transparent;font-size:20px;line-height:1;cursor:pointer;padding:6px 8px}

#membersModalOverlay .members-table{display:flex;flex-direction:column}
#membersModalOverlay .mem-header{display:flex;justify-content:space-between;gap:12px;padding:10px 16px;border-bottom:1px solid #e5e7eb;background:#f9fafb;font-weight:600}
#membersModalOverlay .mem-header .col-name{flex:1;min-width:0}
#membersModalOverlay .mem-header .col-role{width:160px;text-align:right}

#membersModalOverlay .members-list{
  list-style:none;margin:0;padding:0;
  max-height: calc(8 * 60px); /* ≈ 8 rows visible */
  overflow-y: auto;            /* scrollbar if > 8 */
}
#membersModalOverlay .mem-row{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:10px 16px;border-bottom:1px solid #f3f4f6
}
#membersModalOverlay .mem-row:last-child{border-bottom:0}
#membersModalOverlay .col-name{flex:1;min-width:0}
#membersModalOverlay .mem-name{font-weight:600}
#membersModalOverlay .mem-sub{font-size:.88rem;color:#6b7280;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#membersModalOverlay .col-role{width:160px;text-align:right;font-weight:600}
`;

    document.head.appendChild(css);
  }

  const listEl  = overlay.querySelector('.members-list');
  const titleEl = overlay.querySelector('.members-title');
  const closeBtn= overlay.querySelector('.mem-close');

  const close = () => overlay.classList.remove('open');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });

  return { overlay, listEl, titleEl };
}

function renderMembersList(members, winnersMap) {
  const { listEl } = ensureMembersModal();

  const html = (members || []).map(m => {
    const id = m.student_id || m.id || '';
    const name = m.full_name || m.name || `${m.first_name || ''} ${m.last_name || ''}`.trim();
    const email = m.email || m.school_email || '';
    const baseRole = (m.role && String(m.role).trim()) || 'Member';

    // prefer winnersMap override, else any m.won_position, else base role
    const winner = winnersMap && (winnersMap[id] || winnersMap[String(id)]);
    const finalRole = winner?.position_name || winner?.position || m.won_position || baseRole;

    return `
      <li class="mem-row">
        <div class="col-name">
          <div style="font-weight:600">${name}</div>
          <div style="font-size:.82rem;color:#6b7280">${email ? `ID: ${id} • ${email}` : `ID: ${id}`}</div>
        </div>
        <div class="col-role" style="text-align:right">
          ${finalRole}
        </div>
      </li>`;
  }).join('');

  listEl.innerHTML = html || '<li class="mem-row" style="color:#6b7280">No members found.</li>';
}

function openMembersModal(members, winnersMap, title = 'Club Members') {
  const { overlay, titleEl } = ensureMembersModal();
  titleEl.textContent = title;
  renderMembersList(members, winnersMap);
  overlay.classList.add('open');

  // one-time close wiring
  const closeBtn = overlay.querySelector('.mem-close');
  if (!closeBtn.__wired) {
    closeBtn.__wired = true;
    closeBtn.addEventListener('click', () => overlay.classList.remove('open'));
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  }
}



// REPLACE: Robust "Other Clubs" loader
async function loadOtherClubs(currentClubId){
  const list = document.getElementById('suggest-list');
  if (!list) return;
  list.innerHTML = '<li style="padding:.5rem 0; color:#6b7280">Loading…</li>';

  const pickOthers = (arr, excludeId, max = 6) => {
    const pool = (arr || []).filter(c => String(c?.id) !== String(excludeId));
    // simple shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, max);
  };

  const pull = async (url) => {
    try {
      const r = await apiFetch(url);
      return r?.items || r?.clubs || [];
    } catch { return []; }
  };

  // 1) Try limited list first (fast)
  let items = await pull('api/clubs/list.php?limit=50');

  // 2) Fallbacks if empty or only current club found
  if (!Array.isArray(items) || items.filter(x => x?.id && String(x.id) !== String(currentClubId)).length === 0) {
    // a) Try unfiltered list
    const more = await pull('api/clubs/list.php');
    if (more?.length) items = more;
  }

  // 3) Final pick
  const chosen = pickOthers(items, currentClubId, 6);

  if (!chosen.length) {
    list.innerHTML = '<li style="padding:.5rem 0; color:#6b7280">No other clubs yet.</li>';
    return;
  }

  list.innerHTML = chosen.map(c => {
    const thumb = c.profile_picture
      ? `style="background-image:url('${mediaUrl(c.profile_picture)}')"`
      : '';
    const sub = (typeof c.member_count === 'number')
      ? `${c.member_count} ${c.member_count === 1 ? 'member' : 'members'}`
      : (c.category || '');
    return `
      <li>
        <a class="suggest-item" href="Student-ClubDetails.html?id=${c.id}">
          <div class="suggest-thumb" ${thumb}></div>
          <div class="suggest-meta">
            <div class="suggest-name">${c.name || 'Club'}</div>
            <div class="suggest-sub">${sub || ''}</div>
          </div>
        </a>
      </li>`;
  }).join('');
}

})();

// Guard: prevent full-page submit but LET the event bubble to shell.js
document.addEventListener('submit', (e) => {
  if (e.target && e.target.closest('#settingsModalOverlay')) {
    e.preventDefault();
    // Do NOT stopPropagation here — shell.js listens for submit to open the confirm modal
  }
}, true);


/* -------- Settings row toggle: close when clicking again -------- */
(() => {
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest(".settings-chooser .choose-item");
      if (!btn) return;

      const li = btn.closest("li");
      const slot = li && li.querySelector(".slot.open");
      if (!slot) return; // not open -> let shell open it

      // It's already open -> close it and stop the shell from reopening
      e.preventDefault();
      e.stopImmediatePropagation();

      slot.style.maxHeight = slot.scrollHeight + "px";
      // next frame for smooth collapse
      requestAnimationFrame(() => {
        slot.classList.remove("open");
        slot.style.maxHeight = "0px";
      });
    },
    true // capture phase so we win before shell's open handler
  );
})();

/* ===== Settings prefill (page-local; uses this page's apiFetch) ===== */
(() => {
  const overlay = document.getElementById('settingsModalOverlay');
  if (!overlay) return;

  // Use your page's apiFetch if present, otherwise fall back to fetch+JSON.
  const apiGetJson = async (url) => {
    try {
      if (typeof apiFetch === 'function') {
        const res = await apiFetch(url);
        // apiFetch may return Response or JSON; handle both
        return (res && typeof res.json === 'function') ? await res.json() : res;
      } else {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) return null;
        return await res.json();
      }
    } catch {
      return null;
    }
  };

  let PROFILE = null;
  let loading = null;

  async function loadProfile() {
    if (PROFILE) return PROFILE;
    if (loading) return loading;

    loading = (async () => {
      const json = await apiGetJson('api/settings/get_profile.php');
      const d = json?.item || json?.data || json?.profile || json?.user || json || {};
      PROFILE = d || {};
      return PROFILE;
    })();

    return loading;
  }

  // Map template input names -> API keys
  function valueFor(name, data) {
    switch (name) {
      case 'first_name':  return data.first_name  ?? data.fname ?? data.given_name ?? '';
      case 'middle_name': return data.middle_name ?? data.middlename ?? data.mname ?? '';
      case 'last_name':   return data.last_name   ?? data.lname ?? data.surname ?? '';
      case 'sti_email':   return data.sti_email   ?? data.email ?? '';
      case 'email':       return data.email       ?? data.sti_email ?? '';
      case 'bio':         return data.bio         ?? data.about ?? data.description ?? '';
      case 'nickname':    return data.nickname    ?? data.nick ?? '';
      case 'birthdate':   return data.birthdate   ?? data.birthday ?? data.dob ?? '';
      case 'about_city':  return data.about_city  ?? data.city ?? data.town ?? data.location ?? '';
      case 'contact_email': return data.contact_email ?? data.alt_email ?? '';
      case 'student_id_display': return data.student_id_display ?? data.student_id ?? data.sid ?? '';
      default: return data[name] ?? '';
    }
  }

  function coerceDate(val) {
    if (!val) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    const d = new Date(val);
    if (isNaN(+d)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  async function prefillActiveSlot() {
    const panel = overlay.querySelector('.settings-panel.is-active');
    if (!panel) return;

    // Prefer the expanded slot; fall back to first form in the active panel
    const form = panel.querySelector('.slot.open form') || panel.querySelector('form');
    if (!form) return;

    const data = await loadProfile();
    form.querySelectorAll('input, textarea, select').forEach((el) => {
      const name = el.name || el.getAttribute('data-prefill');
      if (!name) return;
      if (el.type === 'password') return; // never prefill passwords

      let v = valueFor(name, data);
      if (!v) return;
      if (el.type === 'date') v = coerceDate(v);
      el.value = v;
    });
  }

  // Prefill when modal opens (FIXED: removed extra ')' here)
  document.addEventListener('click', (e) => {
    if (e.target.closest('#openSettings, .open-settings, [data-label="Settings"]')) {
      setTimeout(prefillActiveSlot, 120);
    }
  });

  // Prefill on tab switch and when choosing a row
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('.settings-tab') || e.target.closest('.choose-item')) {
      setTimeout(prefillActiveSlot, 60);
    }
  });

  // Prefill after the slot finishes expanding
  overlay.addEventListener('transitionend', (e) => {
    if (e.target.classList?.contains('slot') && e.target.classList.contains('open')) {
      prefillActiveSlot();
    }
  });
})();

/* ===== Settings: prevent native navigation, open confirm, save to DB ===== */
(() => {
  const overlay    = document.getElementById('settingsModalOverlay');
  const confirmOVL = document.getElementById('confirmModal');
  const btnYes     = document.getElementById('btnConfirmYes');
  const btnNo      = document.getElementById('btnConfirmNo');
  if (!overlay) return;

  // 0) Small fetch helper that works from nested folders and sends cookies
  const BASES = ["", "./", "../", "../../", "../../../", "../../../../", "/capstone/"];
  async function apiFetch(url, init = {}) {
    const opts = { credentials: "same-origin", ...init };
    const rel  = url.replace(/^\//, "");
    for (const b of BASES) {
      try {
        const r = await fetch(b + rel, opts);
        if (!r.ok) continue;
        const ct = r.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          try { return await r.json(); } catch { return { ok: r.ok }; }
        }
        return { ok: r.ok };
      } catch {}
    }
    throw new Error("Network error");
  }

  // 1) When a slot opens, arm its form so the browser won't navigate
  function armForm(form) {
    form.setAttribute("action", "javascript:void(0)");
    form.setAttribute("method", "post");
    form.setAttribute("novalidate", "novalidate");
  }
  overlay.addEventListener("transitionend", (e) => {
    if (e.target.classList?.contains("slot") && e.target.classList.contains("open")) {
      const form = e.target.querySelector("form.slot-form");
      if (form) armForm(form);
    }
  });

  // 2) Use your existing confirm modal markup
  function openConfirm() {
    if (!confirmOVL || !btnYes || !btnNo) {
      return Promise.resolve(window.confirm("Apply these changes?"));
    }
    return new Promise((resolve) => {
      const cleanup = () => {
        confirmOVL.classList.remove("open");
        confirmOVL.setAttribute("aria-hidden", "true");
        btnYes.removeEventListener("click", onYes);
        btnNo.removeEventListener("click", onNo);
        document.removeEventListener("keydown", onEsc);
      };
      const onYes = () => { cleanup(); resolve(true); };
      const onNo  = () => { cleanup(); resolve(false); };
      const onEsc = (e) => { if (e.key === "Escape") onNo(); };

      confirmOVL.classList.add("open");
      confirmOVL.setAttribute("aria-hidden", "false");
      btnYes.addEventListener("click", onYes);
      btnNo.addEventListener("click", onNo);
      document.addEventListener("keydown", onEsc);
    });
  }

  // 3) Route to your actual endpoints
  const ROUTE = {
    account: "api/settings/update_account.php",
    profile: "api/settings/update_profile.php",
  };
  const FIELD_TO_ROUTE = {
    // account tab
    name: "account", email: "account", password: "account",
    // profile tab
    bio: "profile", nickname: "profile", birthdate: "profile",
    about_city: "profile", contact_email: "profile",
    // read-only
    student_id_display: null,
  };

  // 4) Some backends expect alternative param names — mirror them
  function addAliases(fd) {
    const alias = {
      email:            ["sti_email", "mail"],
      first_name:       ["firstname", "given_name", "fname"],
      middle_name:      ["middlename", "mname"],
      last_name:        ["lastname", "surname", "lname"],
      about_city:       ["city", "town", "location"],
      contact_email:    ["alt_email"],
    };
    Object.entries(alias).forEach(([src, targets]) => {
      const v = fd.get(src);
      if (v != null) targets.forEach(a => { if (!fd.has(a)) fd.append(a, v); });
    });
  }

  async function saveForm(form) {
    const fieldKey = form.getAttribute("data-field") || form.dataset.field || "";
    const routeKey = FIELD_TO_ROUTE[fieldKey];
    if (!routeKey) return; // read-only or unknown

    const endpoint = ROUTE[routeKey];
    const fd = new FormData(form);
    addAliases(fd);

    // Optional CSRF
    const token = document.querySelector('meta[name="csrf-token"]')?.content;
    if (token) fd.append("csrf_token", token);

    const res = await apiFetch(endpoint, { method: "POST", body: fd }).catch(() => null);

    // Accept common success shapes + plain 200
    const ok = !!(res && (res.success === true || res.success === 1 || res.success === "1" ||
                          res.status === "ok" || res.status === "success" || res.ok === true));
    if (!ok) throw new Error(res?.error || "Save failed");

    // collapse the slot on success
    const slot = form.closest(".slot");
    if (slot) {
      slot.style.maxHeight = slot.scrollHeight + "px";
      requestAnimationFrame(() => { slot.classList.remove("open"); slot.style.maxHeight = "0px"; });
    }

    showToast("Saved!");
  }

  // 5) Toast (lightweight, top-center; same placement every time)
  function showToast(msg) {
    const t = document.createElement("div");
    t.textContent = msg;
    Object.assign(t.style, {
      position: "fixed",
      top: "14px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "2147483647",
      background: "#111",
      color: "#fff",
      padding: "10px 12px",
      borderRadius: "10px",
      boxShadow: "0 10px 24px rgba(0,0,0,.25)",
      opacity: "0",
      transition: "opacity .18s ease"
    });
    document.body.appendChild(t);
    requestAnimationFrame(() => t.style.opacity = "1");
    setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 200); }, 1500);
  }

  // 6) Intercept only settings forms: no navigation, show confirm, then save
  document.addEventListener("submit", async (e) => {
    const form = e.target && e.target.closest("#settingsModalOverlay form.slot-form");
    if (!form) return;

    // Stop navigation **but keep the submit event flow here**
    e.preventDefault();

    const ok = await openConfirm();
    if (!ok) return;

    try {
      await saveForm(form);
    } catch (err) {
      console.error("[settings save] failed:", err);
      showToast(err?.message || "Save failed");
    }
  }, true);
})();
