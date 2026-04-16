// Trimmed shell JS (auto-generated)
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
// === Sidebar Profile — wider card, safe wrapping, precise click targets ===
(() => {
  const root = document.querySelector('.side-nav__profile');
  if (!root) return;

  // Elements
  let avatarImg = root.querySelector('.profile__avatar');
  const nameEl  = root.querySelector('.profile__name');
  let meta      = root.querySelector('.profile__meta');
  if (!meta) { meta = document.createElement('div'); meta.className = 'profile__meta'; root.appendChild(meta); }

  let clubEl = root.querySelector('.profile__club');
  let roleEl = root.querySelector('.profile__role');
  if (!clubEl) { clubEl = document.createElement('div'); clubEl.className = 'profile__club'; meta.appendChild(clubEl); }
  if (!roleEl) { roleEl = document.createElement('div'); roleEl.className = 'profile__role'; meta.appendChild(roleEl); }

  // Wrap avatar (to draw a ring) and keep it fully clickable
  if (!avatarImg.parentElement.classList.contains('profile__avatar-wrap')) {
    const wrap = document.createElement('div');
    wrap.className = 'profile__avatar-wrap';
    avatarImg.parentNode.insertBefore(wrap, avatarImg);
    wrap.appendChild(avatarImg);
    avatarImg = wrap.querySelector('img.profile__avatar');
  }

  // Only avatar + name navigate to profile
const goProfile = () => { window.location.href = 'Student-Profile.html'; };

// expand helper
function ensureExpanded() {
  const wasCollapsed = !document.body.classList.contains('sidebar-expanded');
  if (!wasCollapsed) return false;

  // Mark “expanding” so CSS can line up the delays
  document.body.classList.add('sidebar-expanding');
  document.body.classList.add('sidebar-expanded');

  // Remove the helper class once transitions are done
  const sideNav = document.getElementById('sideNav');
  const finish = () => {
    document.body.classList.remove('sidebar-expanding');
    sideNav?.removeEventListener('transitionend', finish);
  };
  // Safety timeout in case transitionend doesn’t fire
  setTimeout(finish, 360);
  sideNav?.addEventListener('transitionend', finish);

  return true;
}

// === Force every "Newsfeed" link/icon to Student-Newsfeed.html (robust) ===
// === Force only real "Newsfeed" links/icons to Student-Newsfeed.html ===
// === Force all sidebar "Newsfeed" links to Student-Newsfeed.html ===
(() => {
  const NEWS_SELECTOR =
    '.side-nav a[aria-label="Newsfeed"], .side-nav a[data-label="Newsfeed"], ' +
    '#sideNav a[aria-label="Newsfeed"], #sideNav a[data-label="Newsfeed"], ' +
    'a[data-route="newsfeed"]'; // REMOVED: a[href$="Student-HomeNews.html"]

  const target = 'Student-Newsfeed.html';

  document.querySelectorAll(NEWS_SELECTOR).forEach(a => {
    a.setAttribute('href', target);                    // middle-click/new-tab works
    if (!a.__wiredNews) {
      a.__wiredNews = true;
      a.addEventListener('click', (e) => {            // hard navigate on left-click
        e.preventDefault();
        window.location.href = target;
      }, { capture: true });
    }
  });
})();



function bindActivate(el) {
  if (!el) return;
  el.classList.add('profile-click');
  el.tabIndex = 0;

  el.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (ensureExpanded()) return;   // just opened → do not navigate
    goProfile();                    // already open → go to profile
  });

  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (ensureExpanded()) return;
    goProfile();
  });
}

bindActivate(avatarImg.closest('.profile__avatar-wrap'));
bindActivate(nameEl);

  // Styles (scoped to this feature)
  (function injectStyles(){
    if (document.getElementById('sidebar-profile-upgrade')) return;
    const st = document.createElement('style');
    st.id = 'sidebar-profile-upgrade';
    st.textContent = `
/* Card gets a bit wider via small side margins; doesn’t change your menu spacing */
.side-nav__profile{
  position:relative;
  margin: 16px 14px 14px;     /* wider than default so the card looks roomy */
  padding: 18px 16px 18px;
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.035));
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.10), 0 10px 24px rgba(0,0,0,.18);
  min-width:0;                /* allow text children to shrink */
  box-sizing: border-box;
}

/* Collapsed: show only the small avatar (original behavior) */
body:not(.sidebar-expanded) .side-nav__profile{ margin:10px auto 12px; padding:0; background:none; box-shadow:none; }
body:not(.sidebar-expanded) .side-nav__profile .profile__name,
body:not(.sidebar-expanded) .side-nav__profile .profile__club,
body:not(.sidebar-expanded) .side-nav__profile .profile__role{ display:none !important; }

/* Avatar + ring (kept fully clickable) */
.profile__avatar-wrap{
  position:relative; z-index:2; pointer-events:auto;
  width: 96px; height: 96px; border-radius: 999px;
  margin: 10px auto 12px;
  box-shadow: 0 8px 22px rgba(0,0,0,.25);
  cursor: pointer;
}
.profile__avatar-wrap::before{
  content:""; position:absolute; inset:-3px; border-radius:inherit;
  background: conic-gradient(#8ec5ff,#b388ff,#8ec5ff);
  mask: radial-gradient(circle at center, transparent 64%, #000 66%);
  opacity:.85; filter:blur(.4px);
  pointer-events:none; /* decorative ring should not block clicks */
}
.profile__avatar-wrap img.profile__avatar{
  width:100%; height:100%; display:block; border-radius:inherit; object-fit:cover; background:#e9eef6;
}

/* Collapsed avatar size */
body:not(.sidebar-expanded) .profile__avatar-wrap{ width:44px; height:44px; margin:12px auto; }
body:not(.sidebar-expanded) .profile__avatar-wrap::before{ display:none; }

/* Name: smaller, up to 2 lines, never overflows the card */
.side-nav__profile .profile__name{
  display:block;
  margin: 6px 2px 8px;
  font-weight:800;
  font-size: 0.92rem;         /* a bit smaller so long names fit */
  line-height: 1.2;
  color:#fff;
  text-shadow: 0 1px 1px rgba(0,0,0,.22);
  max-width:100%;
  overflow:hidden;
  /* allow up to 2 lines with ellipsis */
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  white-space:normal;
  word-break: break-word;
  hyphens:auto;
}

/* “Chip” rows (club & role) – a touch smaller */
.profile-chip{
  display:inline-flex; align-items:center; gap:6px;
  padding: 4px 8px; border-radius: 999px;
  background: rgba(255,255,255,.16);
  border: 1px solid rgba(255,255,255,.24);
  color:#eaf0ff; font-weight:600; font-size:.80rem; line-height:1;
  box-shadow: 0 2px 8px rgba(0,0,0,.15);
  margin: 2px 6px 4px 0; white-space:nowrap; max-width:100%;
}
.profile-chip svg{ width:14px; height:14px; opacity:.95 }

/* Focus ring only on the true click targets */
.side-nav__profile .profile-click:focus-visible{
  outline: 2px solid rgba(255,255,255,.9);
  outline-offset: 2px; border-radius: 8px;
}
    `;
    document.head.appendChild(st);
  })();

  // Data helpers
  const PROJECT_BASE = (() => {
    const cap = '/capstone';
    const p = location.pathname; const i = p.indexOf(cap);
    return i >= 0 ? p.slice(0, i + cap.length) : '';
  })();
  const apiPaths = (p) => [p, `../${p}`, `${PROJECT_BASE}/${p}`.replace(/\/{2,}/g,'/')];
  async function getJSON(paths){
    let last; for (const u of paths) {
      try {
        const r = await fetch(u, { headers:{'Accept':'application/json'}, credentials:'include' });
        const j = await r.json(); if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
        return j;
      } catch(e){ last = e; }
    } throw last || new Error('All API paths failed');
  }
// --- Smart “Club” routing (pre-resolve + cache for instant nav) ---
(function smartClubNavInit(){
const CLUB_SELECTOR =
  '.side-nav a[aria-label="Club"], .side-nav a[data-label="Club"], ' +
  '.side-nav a[href$="Student-ListOfClub.html"], .side-nav a[href$="Student-ClubDetails.html"], .side-nav a[href$="Adviser-ClubDetails.html"], ' +
  '#sideNav a[aria-label="Club"], #sideNav a[data-label="Club"], ' +
  'a[data-route="club"], a[href="#club"]';


  // --- tiny utils ----
  const toPage = (rel) => window.location.href = pageUrl(rel);
  async function getJSONAny(p){ try { return await getJSON(apiPaths(p)); } catch { return null; } }
  const now = () => Date.now();

  // cache key by user (role + id)
  function cacheKey(me){
    const id = me.role === 'student' ? (me.student_id || '0') : (me.adviser_id || '0');
    return `clubLanding:v1:${me.role}:${id}`;
  }

  function setHrefOnAll(href){
    document.querySelectorAll(CLUB_SELECTOR).forEach(a => { a.setAttribute('href', pageUrl(href)); });
  }

function attachFallbackHandler(){
  document.querySelectorAll(CLUB_SELECTOR).forEach(a => {
    if (a.__clubWired) return;
    a.__clubWired = true;

    // Force the href so middle-click / open-in-new-tab also goes to the student page
    a.setAttribute('href', 'Student-ClubDetails.html');

    // Hard redirect on click
    a.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toPage('Student-ClubDetails.html');
    }, { capture: true });
  });
}


  // --- data fetchers (me.php + client-side filters; no PHP changes) ---
  async function getMe(){
    const r = await getJSONAny('api/auth/me.php');
    const me = r?.me;
    if (!me || !me.role) return null;
    return {
      role: String(me.role).toLowerCase(),
      student_id: me.student_id || null,
      adviser_id: me.adviser_id || null,
      email: (me.sti_email || '').toLowerCase(),
    };
  }
  async function listClubs(){
    const r = await getJSONAny('api/clubs/list.php?limit=200');
    return Array.isArray(r?.items) ? r.items : [];
  }
  async function listOrgs(){
    const r = await getJSONAny('api/organizations/list.php?status=active&limit=200');
    return Array.isArray(r?.items) ? r.items : [];
  }
  async function listMembersForClub(clubId){
    const r = await getJSONAny(`api/clubs/members/list.php?club_id=${encodeURIComponent(clubId)}`);
    return Array.isArray(r?.items) ? r.items : [];
  }

  // adviser: prefer org → else club (match by adviser_id or adviser_email)
  async function adviserTarget(me){
    const [orgs, clubs] = await Promise.all([listOrgs(), listClubs()]);
    const byId   = (x) => String(x?.adviser_id ?? x?.adviser ?? '') === String(me.adviser_id || '');
    const byMail = (x) => String(x?.adviser_email || '').toLowerCase() === me.email;

    const org  = orgs.find(o => byId(o) || byMail(o));
    if (org) return { type: 'org', id: org.id, name: org.name || '' };

    const club = clubs.find(c => byId(c) || byMail(c));
    if (club) return { type: 'club', id: club.id, name: club.name || '' };

    return null;
  }

  // student: scan clubs; first whose members include me (by student_id or email)
  async function studentTarget(me){
    const clubs = await listClubs();
    // small perf: check the ones with non-zero members first
    clubs.sort((a,b) => (b.member_count||0) - (a.member_count||0));
    for (const c of clubs) {
      const members = await listMembersForClub(c.id);
      const hit = members.some(m =>
        String(m.student_id || '') === String(me.student_id || '') ||
        String(m.email || m.sti_email || '').toLowerCase() === me.email
      );
      if (hit) return { type:'club', id:c.id, name:c.name || '' };
    }
    return null;
  }

  // compute landing URL string (relative) and cache it
  async function resolveLandingUrl(){
    const me = await getMe();
    if (!me) return null;

    // read cache
    const key = cacheKey(me);
    const cached = sessionStorage.getItem(key);
    if (cached){
      try {
        const obj = JSON.parse(cached);
        // keep cache for 30 minutes
        if (obj && obj.href && (now() - (obj.ts||0) < 30*60*1000)) return obj.href;
      } catch {}
    }

    // compute
    let target = null;
    if (me.role === 'adviser') target = await adviserTarget(me);
    else if (me.role === 'student') target = await studentTarget(me);
    if (!target) return null;

    // build href
    let href;
    if (target.type === 'org') {
      const qs = new URLSearchParams({ org_id: target.id, org_name: target.name });
      href = `Student-ClubDetails.html?${qs}`;
    } else {
      href = `Student-ClubDetails.html?id=${encodeURIComponent(target.id)}`;
    }

    // write cache + return
    sessionStorage.setItem(key, JSON.stringify({ href, ts: now() }));
    return href;
  }

  // 1) attach the fallback click handler (prevents broken clicks)
  attachFallbackHandler();

  // 2) prime from cache instantly (instant navigation)
  (async () => {
    const me = await getMe();
    if (!me) return;
    const key = cacheKey(me);
    const cached = sessionStorage.getItem(key);
    if (cached){
      try {
        const obj = JSON.parse(cached);
        if (obj?.href) setHrefOnAll(obj.href);
      } catch {}
    }
  })();

  // 3) resolve fresh in background; when ready, set real hrefs
  (async () => {
    const url = await resolveLandingUrl();
    if (url) setHrefOnAll(url);
  })();

  // 4) clear cache on logout (optional; wire to your logout button if present)
  const logout = document.querySelector('[data-action="logout"], #logout, .logout-btn');
  if (logout) {
    logout.addEventListener('click', async () => {
      try {
        const me = await getMe();
        if (!me) return;
        sessionStorage.removeItem(cacheKey(me));
      } catch {}
    });
  }
})();



  const esc = s => String(s ?? '').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  let WHO = null, PROFILE = null;
  const isExpanded = () => document.body.classList.contains('sidebar-expanded');

  const icoClub = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 17l9 4 9-4"/><path d="M3 12l9 4 9-4"/></svg>';
  const icoUser = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a7.5 7.5 0 0 1 13 0"/></svg>';

  function fullName(){
    const f = (PROFILE?.first_name  || '').trim();
    const m = (PROFILE?.middle_name || '').trim();
    const l = (PROFILE?.last_name   || '').trim();
    const db = [f,m,l].filter(Boolean).join(' ').trim();
    if (db) return db;
    const sess = WHO?.session || {};
    return (sess.student?.full_name || sess.adviser?.full_name || 'Your Name').trim();
  }
  function currentClub(){ return (PROFILE?.club || WHO?.session?.student?.club || '').trim(); }
  function roleText(){ const r = (WHO?.session?.role || '').toLowerCase(); return r==='adviser'?'Adviser':r==='student'?'Student':''; }

  // Make sure ultra-long names fit (shrink a bit but stay readable)
  function fitName(){
    if (!nameEl) return;
    // measure against ~2 lines of height
    const maxLines = 2;
    const lh = parseFloat(getComputedStyle(nameEl).lineHeight) || 18;
    nameEl.style.maxHeight = `${lh * maxLines}px`;
    let fs = parseFloat(getComputedStyle(nameEl).fontSize) || 15;
    const min = 12; // px
    // shrink while it overflows vertically
    while (nameEl.scrollHeight - 1 > nameEl.clientHeight && fs > min) {
      fs -= 0.5;
      nameEl.style.fontSize = fs + 'px';
    }
  }

  function paint(){
    // avatar (fallback to local placeholder)
    if (avatarImg) {
      avatarImg.onerror = null;
      avatarImg.src = PROFILE?.profile_picture
        ? (/^https?:\/\//.test(PROFILE.profile_picture) ? PROFILE.profile_picture
           : `${PROJECT_BASE}/${String(PROFILE.profile_picture).replace(/^\/+/,'')}`)
        : 'Images/profile.png';
      avatarImg.alt = 'Profile';
    }

    if (nameEl) { nameEl.textContent = fullName(); fitName(); }

    // chips render only when expanded
    if (isExpanded()) {
      const club = currentClub();
      const role = roleText();
      if (club) {
  const full  = (club || '').trim().replace(/\s+/g, ' ');
  const words = full.split(' ');
  const shown = words.length > 3 ? words.slice(0, 3).join(' ') + '...' : full;

  clubEl.innerHTML =
    `<span class="profile-chip" aria-label="Club">
       ${icoClub}
       <span class="chip-text" title="${esc(full)}">${esc(shown)}</span>
     </span>`;
} else {
  clubEl.innerHTML = '';
}
      roleEl.innerHTML = role ? `<span class="profile-chip" aria-label="Role">${icoUser}<span>${esc(role)}</span></span>` : '';
    } else {
      clubEl.innerHTML = ''; roleEl.innerHTML = '';
    }
  }

  // Load data, then paint
  (async () => {
    try { WHO = await getJSON(apiPaths('api/auth/whoami.php')); } catch {}
    try { const r = await getJSON(apiPaths('api/settings/get_profile.php')); PROFILE = r?.item || null; } catch {}
    paint();
  })();

  // Repaint after expand/collapse and when body classes change
  const sidebarBtn = document.getElementById('sidebarHamburger') || document.querySelector('.sidebar-toggle-btn');
  sidebarBtn && sidebarBtn.addEventListener('click', () => setTimeout(paint, 120));
  new MutationObserver(() => setTimeout(paint, 20))
    .observe(document.body, { attributes:true, attributeFilter:['class'] });
})();



  // Top nav Account dropdown: tap to toggle on small screens
  

(function(){
    const trigger = document.querySelector('.pill-nav .dropdown > .dropdown-toggle, .pill-nav .dropdown > a');
    const dd      = trigger ? trigger.closest('.dropdown') : null;
    if (!trigger || !dd) return;

    const isMobile = () => window.matchMedia('(max-width: 900px)').matches;

    // FIX: use the actual dropdown, not undefined li/panel
    trigger.addEventListener('click', function (e) {
      if (!isMobile()) return;
      e.preventDefault();
      e.stopPropagation();

      const menu = dd.querySelector('.dropdown-menu');
      if (!menu) return;

      const willOpen = !dd.classList.contains('open');

      // close any other open dropdowns in the top nav
      document.querySelectorAll('.pill-nav .dropdown.open').forEach(x => {
        if (x !== dd) x.classList.remove('open');
      });

      dd.classList.toggle('open', willOpen);

      // blur on close to defeat :focus-within
      if (!willOpen && document.activeElement === this && typeof this.blur === 'function') {
        this.blur();
      }
    });

    document.addEventListener('click', (e) => {
      if (!isMobile()) return;
      if (dd.classList.contains('open') && !e.target.closest('.pill-nav .dropdown')) {
        dd.classList.remove('open');
      }
    });
  })();



// === Notifications (LIVE) — inject badge + popover, then lazy-load role JS ===
(() => {
  if (window.__NOTIF_STUDENT_BOOTED__) return;
  window.__NOTIF_STUDENT_BOOTED__ = true;

  function boot(){
    try{
      const bell = document.querySelector('.pill-nav__icon-btn[aria-label="Notifications"]');
      if (!bell) return;

      if (!bell.id) bell.id = 'notifToggle';

      if (!bell.querySelector('#notifCount')) {
        const bad = document.createElement('span');
        bad.id = 'notifCount';
        bad.className = 'badge';
        bad.hidden = true;
        bell.appendChild(bad);
      }

      if (!document.getElementById('notifPopover')) {
const pop = document.createElement('div');
pop.id = 'notifPopover';
pop.className = 'notif-popover';         // <-- give it the class your CSS expects
pop.hidden = true;
pop.innerHTML = `
  <div class="notif-header">Notifications</div>
  <div id="notifList" class="notif-list" role="list"></div>
`;
document.body.appendChild(pop);

      }

let baseURL;
try {
  baseURL = new URL('.', document.currentScript?.src || location.href);
} catch {
  baseURL = new URL(
    (location.pathname.endsWith('/') ? location.pathname : location.pathname.replace(/[^/]+$/, '/')),
    location.origin
  );
}

const candidates = [
  new URL('notif_student.js', baseURL).href,
  (typeof pageUrl === 'function') ? pageUrl('notif_student.js') : null,
  location.origin + '/capstone/notif_student.js',
  'notif_student.js',
  '../notif_student.js'
].filter(Boolean);

if (!document.querySelector('script[data-notif-student]')) {
  (function load(i){
    if (i >= candidates.length) return;
    const s = document.createElement('script');
    s.defer = true;
    s.dataset.notifStudent = '1';
    s.src = candidates[i];
    s.onerror = () => { s.remove(); load(i+1); };
    document.head.appendChild(s);
  })(0);
}

    } catch (err){
      // Never let an error break the rest of the shell (e.g., sidebar wiring)
      console.error('Notifications boot failed:', err);
    }
  }

  // Defer until DOM is ready so we don't race the sidebar init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    // also put it at the end of the task queue to be extra safe
    setTimeout(boot, 0);
  }
})();



  // Top nav Account dropdown — tap to toggle on small screens
  

(function(){
    if (window.__TOP_ACCOUNT_DD_INITED) return;
    window.__TOP_ACCOUNT_DD_INITED = true;

    const dd = document.querySelector('.pill-nav .dropdown');
    if (!dd) return;

    const trigger = dd.querySelector('.dropdown-toggle, a');
    const menu    = dd.querySelector('.dropdown-menu');
    if (!trigger || !menu) return;

    const isMobile = () => window.matchMedia('(max-width: 900px)').matches;

    trigger.addEventListener('click', (e) => {
      if (!isMobile()) return;             // desktop uses hover already
      e.preventDefault();
      e.stopPropagation();
      dd.classList.toggle('open');         // CSS above makes it visible
    });

    // Close on outside tap (mobile) or Esc
    document.addEventListener('click', (e) => {
      if (!isMobile()) return;
      if (dd.classList.contains('open') && !e.target.closest('.pill-nav .dropdown')) {
        dd.classList.remove('open');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') dd.classList.remove('open');
    });
  })();

(function(){
    const DESKTOP_BP = 901, OPEN_MS = 340;

    // Accept any of your hamburger buttons
    const mobileBtn =
      document.getElementById('mobileSidebarToggle') ||
      document.querySelector('.mobile-hamburger')   ||
      document.getElementById('mobileMenuBtn')      ||
      document.getElementById('sidebarHamburger');  // works on phones too

    const drawer = document.getElementById('mobileNavDrawer');
    const panel  = drawer ? drawer.querySelector('.mobile-nav-list') : null;

    if (!mobileBtn || !drawer || !panel) return;

    // Start closed
    drawer.hidden = true;

    // Build the drawer links once by cloning the desktop nav
    const topLinks = document.querySelector('.pill-nav__links');
    if (topLinks && !panel.dataset.built) {
      const ul = topLinks.cloneNode(true);
      ul.className = ''; // drop desktop-only classes (e.g., hover dropdown styles)
      panel.innerHTML = '';
      panel.appendChild(ul);

      // Account dropdown: ensure tap-to-toggle and Profile/Settings/Logout exist
      ul.querySelectorAll('.dropdown').forEach(function(li){
        const trigger = li.querySelector('a, .dropdown-toggle');
        let menu = li.querySelector('.dropdown-menu');

        const label = (trigger && trigger.textContent ? trigger.textContent : '').trim().toLowerCase();
        const looksLikeAccount = label.includes('account') || label.includes('profile') || label.includes('settings');
        if (looksLikeAccount) {
          if (!menu) {
            menu = document.createElement('ul');
            menu.className = 'dropdown-menu';
            li.appendChild(menu);
          }
          if (!menu.children.length) {
            menu.innerHTML = `
              <li><a href="Student-Profile.html">Profile</a></li>
              <li><a href="Student-Settings.html">Settings</a></li>
              <li><a href="#" class="logout-link">Logout</a></li>
            `;
          }
        }

        // Tap-to-toggle (mobile) — FIXED: true toggle + one-at-a-time + blur on close
        if (trigger) {
          trigger.addEventListener('click', function (e) {
            if (!li.querySelector('.dropdown-menu')) return;
            e.preventDefault();
            e.stopPropagation();

            var isOpen = li.classList.contains('open');

            // Close any other open dropdowns in the drawer
            var openItems = panel.querySelectorAll('.dropdown.open');
            openItems.forEach(function (x) { if (x !== li) x.classList.remove('open'); });

            // Toggle this one
            if (isOpen) {
              li.classList.remove('open');
              // Blur so :focus-within cannot keep it open
              if (document.activeElement === this && typeof this.blur === 'function') {
                this.blur();
              }
            } else {
              li.classList.add('open');
            }
          });
        }
      });

      // Drawer: Logout → open the shared confirmation modal
      panel.addEventListener('click', (e) => {
        const logout = e.target.closest('.logout-link, a[href="#logout"], button[data-action="logout"]');
        if (!logout) return;

        e.preventDefault();

        const overlay = document.getElementById('logoutConfirmOverlay');
        if (overlay) {
          overlay.classList.add('active');
          overlay.setAttribute('aria-hidden', 'false');
        }
      });

      panel.dataset.built = '1';
    }

    // Toggle handlers
    let animating = false;
    const isMobile = () => window.innerWidth < DESKTOP_BP;

    function openDrawer(){
      if (!isMobile() || animating || !drawer.hidden) return;
      drawer.hidden = false;
      requestAnimationFrame(() => {
        animating = true;
        document.body.classList.add('navdrawer-open');
        setTimeout(() => { animating = false; }, OPEN_MS + 20);
      });
    }
    function closeDrawer(){
      if (drawer.hidden || animating) return;
      animating = true;
      document.body.classList.remove('navdrawer-open');
      const done = () => {
        drawer.hidden = true;
        animating = false;
        panel.removeEventListener('transitionend', done);
        drawer.removeEventListener('transitionend', done);
      };
      panel.addEventListener('transitionend', done);
      drawer.addEventListener('transitionend', done);
      setTimeout(done, OPEN_MS + 80); // safety
    }

    // Hamburger toggles: open if closed, close if open (icon never hides)
    mobileBtn.addEventListener('click', (e) => {
      if (!isMobile()) return; // ignore on desktop
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation(); // <<< keep this
      if (drawer.hidden) openDrawer(); else closeDrawer();
    }, { capture: true });

    // Click outside the panel closes (drawer covers the screen)
    drawer.addEventListener('click', (e) => {
      if (!e.target.closest('.mobile-nav-list')) closeDrawer();
    });

    // Esc closes
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
    });

    // Resize up to desktop -> close
    window.addEventListener('resize', () => {
      if (!isMobile()) closeDrawer();
    });
  })();



  /* ======================
     YOUR EXISTING HERO JS
     ======================
     (unchanged; keep your hero code exactly as it is below)
  */
  // ---------- Project base ----------
  const segs = location.pathname.split('/').filter(Boolean);
  const capIdx = segs.indexOf('capstone');
  const PROJECT_BASE = capIdx !== -1
    ? '/' + segs.slice(0, capIdx + 1).join('/')
    : (segs.length > 0 ? '/' + segs[0] : '');

  function mediaUrl(p) {
    if (!p) return '';
    const raw = String(p).trim().replace(/\\/g, '/');
    if (/^(https?:)?\/\//i.test(raw) || /^data:/i.test(raw)) return raw;
    if (raw.startsWith('/')) {
      if (PROJECT_BASE && !raw.startsWith(PROJECT_BASE + '/')) return PROJECT_BASE + raw;
      return raw;
    }
    return (PROJECT_BASE || '') + '/' + raw.replace(/^\.?\//, '');
  }
  function pageUrl(pathWithQuery) {
    const clean = String(pathWithQuery || '').replace(/^\//, '');
    return (PROJECT_BASE ? PROJECT_BASE + '/' : '/') + clean;
  }

  // ---------- Date helpers ----------
  function parseAnyDate(s) {
    if (!s) return null;
    const v = String(s).trim();
    let m = v.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (m) { const d = new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +(m[6]||0)); return isNaN(d) ? null : d; }
    m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) { const d = new Date(+m[1], +m[2]-1, +m[3]); return isNaN(d) ? null : d; }
    const d = new Date(v); return isNaN(d) ? null : d;
  }
  function fmtPrettyDate(s) {
    const d = parseAnyDate(s);
    return d ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  }
  
  // ---------- Utilities ----------
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const pick = (arr) => arr.map(s => $(s)).find(Boolean);

  async function fetchFromAny(candidates, query) {
    let lastErr;
    for (const base of candidates) {
      const url = `${base}${base.includes('?') ? '&' : '?'}${query}`;
      try {
        const res  = await fetch(url, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
        const text = await res.text();
        let data; try { data = JSON.parse(text); } catch { throw new Error(text || 'Non-JSON response'); }
        if (!res.ok || data.ok !== true) throw new Error((data && data.error) || `HTTP ${res.status}`);
        return data;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('All API candidates failed');
  }

  // ---------- DOM refs ----------
  const hero      = pick(['#feedHero', '#hero', '.hero', '[data-hero]']);
  if (!hero) {

  } else {

  const base      = hero.querySelector('.hero-split') || hero;
  const btnNext   = pick(['#heroNext', '[data-hero-next]', '.hero-next', '.feed-next']);
  const btnPrev   = pick(['#heroPrev', '[data-hero-prev]', '.hero-prev', '.feed-prev']);
  const globalReadMore = pick(['#heroRead', '#heroReadMore', '.hero-read', '.hero-readmore', '.read-more', '.read-more-btn', 'a.read-more']);
  const tabNews   = pick(['#tabNews', '.tab-news', '.feed-tab[data-kind="news"]', '[data-tab="news"]']);
  const tabEvents = pick(['#tabEvents', '.tab-events', '.feed-tab[data-kind="events"]', '[data-tab="events"]']);
  const tabsAll   = $$('.feed-tab');
  const emptyEl   = pick(['#heroEmpty', '.hero-empty']);

  const hs = getComputedStyle(hero);
  if (hs.position === 'static') hero.style.position = 'relative';
  if (hs.overflow === 'visible') hero.style.overflow = 'hidden';

  (function injectAnimCss(){
    if (document.getElementById('hero-slide-anim')) return;
    const st = document.createElement('style');
    st.id = 'hero-slide-anim';
    st.textContent = `
      .hero-layer, .hero-base { will-change: transform, opacity; }
      @keyframes slotEnterRight { from { transform:translateX(40px); opacity:0 } to { transform:translateX(0); opacity:1 } }
      @keyframes slotEnterLeft  { from { transform:translateX(-40px);opacity:0 } to { transform:translateX(0); opacity:1 } }
      @keyframes slotLeaveLeft  { from { transform:translateX(0); opacity:1 } to { transform:translateX(-40px); opacity:0 } }
      @keyframes slotLeaveRight { from { transform:translateX(0); opacity:1 } to { transform:translateX( 40px); opacity:0 } }
      .slot-enter-right { animation: slotEnterRight 560ms cubic-bezier(.22,.61,.36,1) both; }
      .slot-enter-left  { animation: slotEnterLeft  560ms cubic-bezier(.22,.61,.36,1) both; }
      .slot-leave-left  { animation: slotLeaveLeft  560ms cubic-bezier(.22,.61,.36,1) both; }
      .slot-leave-right { animation: slotLeaveRight 560ms cubic-bezier(.22,.61,.36,1) both; }
      .is-disabled { pointer-events:none; opacity:.6 }
      .readmore-disabled { pointer-events:none; opacity:.5; filter:grayscale(0.3); }
    `;

    
    document.head.appendChild(st);
  })();

  function mapNodes(root) {
    const q = (arr) => arr.map(s => root.querySelector(s)).find(Boolean);
    const img = q(['.hero-media img', '.hero-image img', 'img']);
    return {
      root,
      img,
      title: q(['.hero-title', '#heroTitle', '[data-hero-title]']),
      body:  q(['.hero-excerpt', '#heroExcerpt', '.hero__content']),
      date:  q(['.hero-date', '#heroDate', 'time', '[data-hero-date]']),
      tag:   q(['.hero-tag', '#heroTag']),
      readMore: q(['#heroRead', '#heroReadMore', '.hero-read', '.hero-readmore', '.read-more', '.read-more-btn', 'a.read-more'])
    };
  }
  let ACTIVE = mapNodes(base);
  const remapActive = () => { ACTIVE = mapNodes(base); };

  const overlay = base.cloneNode(true);
  overlay.classList.add('hero-layer');
  overlay.style.position = 'absolute';
  overlay.style.inset = '0';
  overlay.style.zIndex = '4';
  overlay.style.pointerEvents = 'none';
  overlay.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
  hero.appendChild(overlay);
  overlay.style.display = 'none';
  const LAYER = mapNodes(overlay);

  [btnNext, btnPrev, globalReadMore, tabNews, tabEvents].forEach(el => {
    if (!el) return;
    const cs = getComputedStyle(el);
    if (cs.position === 'static') el.style.position = 'relative';
    el.style.zIndex = '5';
  });

  const API_LIST = [
    'api/feed/list.php',
    '../api/feed/list.php',
    PROJECT_BASE + '/api/feed/list.php'
  ];

  let KIND   = 'news';
  let ITEMS  = [];
  let index  = 0;
  const AUTO_MS = 10000;
  let timerId = null;

  let loadToken = 0;
  let IS_LOADING = false;
  let CURRENT_HREF = '';

  const MAX_EXCERPT = 350;
  function toPlain(textOrHtml) {
    const html = String(textOrHtml || '');
    if (/<[a-z][\s\S]*>/i.test(html)) {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      return (tmp.textContent || tmp.innerText || '').trim();
    }
    return html.trim();
  }
  function clip(s, max = MAX_EXCERPT) {
    if (!s) return '';
    if (s.length <= max) return s;
    let out = s.slice(0, max).replace(/\s+\S*$/, '');
    return out.trimEnd() + '…';
  }
  function makeExcerpt(item) {
    let txt = item.excerpt || '';
    if (!txt) txt = toPlain(item.content_html || item.description || item.content || '');
    return clip(txt, MAX_EXCERPT);
  }

  function resolveId(x) {
    return x.id ?? x.event_id ?? x.news_id ?? x.content_id ?? x.ID ?? x.Id ?? null;
  }

  const READ_MORE_SEL = '#heroRead, #heroReadMore, .hero-read, .hero-readmore, .read-more, .read-more-btn, a.read-more';
  function setReadMoreState(root, href) {
    const a = root && root.querySelector(READ_MORE_SEL);
    const targets = [a, globalReadMore].filter(Boolean);
    targets.forEach(el => {
      const isAnchor = el && el.tagName && el.tagName.toLowerCase() === 'a';
      el.classList.toggle('readmore-disabled', !href);
      if (isAnchor) {
        if (href) el.setAttribute('href', href);
        else el.removeAttribute('href');
      }
    });
  }
  function setCurrentHref(href) {
    CURRENT_HREF = href || '';
    if (CURRENT_HREF) hero.setAttribute('data-current-href', CURRENT_HREF);
    else hero.removeAttribute('data-current-href');
    setReadMoreState(base, CURRENT_HREF);
    setReadMoreState(overlay, CURRENT_HREF);
  }

  function setImage(node, src, altText) {
    if (!node) return;
    const url = src ? mediaUrl(src) : '';
    const tag = node.tagName ? node.tagName.toLowerCase() : '';
    if (tag === 'img') {
      if (url) { node.src = url; node.alt = altText || ''; node.style.display = ''; }
      else { node.removeAttribute('src'); node.alt = ''; node.style.display = 'none'; }
    } else {
      if (url) node.style.backgroundImage = `url("${url}")`;
      else node.style.backgroundImage = 'none';
    }
  }
  function setDateOnly(el, raw) {
    if (!el) return;
    const nice = fmtPrettyDate(raw);
    if (nice) {
      el.textContent = nice;
      el.style.display = '';
      if (el.tagName && el.tagName.toLowerCase() === 'time') {
        const d = parseAnyDate(raw);
        if (d) el.setAttribute('datetime', d.toISOString());
      }
    } else {
      el.textContent = '';
      el.removeAttribute && el.removeAttribute('datetime');
      el.style.display = 'none';
    }
  }
  function renderInto(map, item) {
    if (map.tag)   map.tag.textContent   = (KIND === 'news' ? 'News' : 'Event');
    if (map.title) map.title.textContent = item.title || 'Untitled';
    if (map.body)  { map.body.classList.add('preline'); map.body.textContent = makeExcerpt(item); }
    setImage(map.img, item.image || item.banner || item.featured_image || '', item.title || '');
    setDateOnly(map.date, item.created_at || item.date || item.updated_at || '');

    const id = resolveId(item);
    let href = '';
    if (id != null && id !== '') {
      href = (KIND === 'events')
        ? pageUrl(`Student-EventDetails.html?id=${encodeURIComponent(id)}&kind=events`)
        : pageUrl(`Student-NewsDetails.html?id=${encodeURIComponent(id)}&kind=news`);
    }
    setCurrentHref(href);
  }

  function setControlsDisabled(disabled) {
    [btnNext, btnPrev, globalReadMore].forEach(el => {
      if (!el) return;
      el.classList.toggle('is-disabled', disabled);
      if (disabled) el.setAttribute('aria-disabled', 'true');
      else el.removeAttribute('aria-disabled');
    });
  }
  function showLoading(kind) {
    IS_LOADING = true;
    stopAuto();
    ITEMS = [];
    index = 0;

    base.style.visibility = 'hidden';

    overlay.style.display = 'none';
    overlay.classList.remove('slot-enter-left','slot-enter-right');
    base.classList.remove('slot-leave-left','slot-leave-right');

    remapActive();
    setCurrentHref('');

    if (emptyEl) { emptyEl.hidden = false; emptyEl.textContent = 'Loading…'; }

    setControlsDisabled(true);
  }
  function hideLoading() {
    IS_LOADING = false;
    if (emptyEl) emptyEl.hidden = true;
    setControlsDisabled(false);
  }

  function animateTo(item, dir, firstPaint = false) {
    if (!item) return;

    if (firstPaint) {
      renderInto(ACTIVE, item);
      base.style.visibility = 'visible';
      hero.classList.add('hero-anim');
      setTimeout(() => hero.classList.remove('hero-anim'), 720);
      return;
    }

    renderInto(LAYER, item);
    overlay.style.display = '';
    overlay.classList.remove('slot-enter-left','slot-enter-right');
    base.classList.remove('slot-leave-left','slot-leave-right');

    const enterCls = dir === 'left' ? 'slot-enter-right' : 'slot-enter-left';
    const leaveCls = dir === 'left' ? 'slot-leave-left'  : 'slot-leave-right';

    overlay.classList.add(enterCls);
    base.classList.add(leaveCls);

    const onDone = () => {
      base.innerHTML = overlay.innerHTML;
      overlay.style.display = 'none';
      overlay.classList.remove(enterCls);
      base.classList.remove(leaveCls);
      remapActive();
      base.style.visibility = 'visible';
      setReadMoreState(base, CURRENT_HREF);
    };
    overlay.addEventListener('animationend', onDone, { once: true });
    overlay.addEventListener('animationcancel', onDone, { once: true });
  }

  function clampIndex() {
    const n = ITEMS.length;
    if (n === 0) { index = 0; return; }
    if (index >= n) index = 0;
    if (index < 0) index = n - 1;
  }
  function render(animateDir) {
    if (!ITEMS.length) { if (emptyEl) emptyEl.hidden = false; return; }
    if (emptyEl) emptyEl.hidden = true;
    clampIndex();
    animateTo(ITEMS[index], animateDir || 'left', !animateDir);
  }

  function startAuto(){ stopAuto(); if (!ITEMS.length || IS_LOADING) return; timerId = setInterval(()=>{ index=(index+1)%ITEMS.length; render('left'); }, AUTO_MS); }
  function stopAuto(){ if (timerId){ clearInterval(timerId); timerId=null; } }
  function resetAuto(){ stopAuto(); startAuto(); }
  document.addEventListener('visibilitychange', ()=>{ if (document.hidden) stopAuto(); else startAuto(); });

  async function load(kind) {
    const myToken = ++loadToken;
    KIND = kind;
    showLoading(kind);

    const q = new URLSearchParams({ kind, limit: '50', excerpt_len: String(MAX_EXCERPT) }).toString();
    const data = await fetchFromAny(API_LIST, q).catch(err => {
      console.error('load failed:', err);
      return { items: [] };
    });

    if (myToken !== loadToken) return;

    const raw = Array.isArray(data.items) ? data.items : [];

    ITEMS = raw.map(x => ({
      id: resolveId(x),
      title: x.title || 'Untitled',
      excerpt: x.excerpt || '',
      content_html: x.content_html || '',
      content: x.content || '',
      description: x.description || '',
      club: x.club || '',
      image: x.image || x.banner || x.featured_image || '',
      created_at: x.created_at || '',
      updated_at: x.updated_at || '',
      date: x.date || ''
    }));

    const ts = (s) => { const d = parseAnyDate(s); return d ? d.getTime() : 0; };
    ITEMS.sort((a, b) => {
      const byCreated = ts(b.created_at) - ts(a.created_at);
      if (byCreated !== 0) return byCreated;
      const byId = (Number(b.id) || 0) - (Number(a.id) || 0);
      if (byId !== 0) return byId;
      return 0;
    });

    hideLoading();
    render(null);
    startAuto();
  }

  (() => {
    const overlay = document.getElementById('logoutConfirmOverlay');
    if (!overlay) return;
    const open = () => { overlay.classList.add('active'); overlay.setAttribute('aria-hidden', 'false'); };
    const close = () => { overlay.classList.remove('active'); overlay.setAttribute('aria-hidden', 'true'); };
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('.logout-link');
      if (trigger) { e.preventDefault(); open(); }
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('.btn-no')) close();
    });
    overlay.querySelector('.btn-yes')?.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('active')) close();
    });
  })();

  function goNext(){ if (!ITEMS.length || IS_LOADING) return; index=(index+1)%ITEMS.length; render('left');  resetAuto(); }
  function goPrev(){ if (!ITEMS.length || IS_LOADING) return; index=(index-1+ITEMS.length)%ITEMS.length; render('right'); resetAuto(); }

  btnNext && btnNext.addEventListener('click', (e)=>{ e.preventDefault(); goNext(); });
  btnPrev && btnPrev.addEventListener('click', (e)=>{ e.preventDefault(); goPrev(); });

  document.addEventListener('click', (e) => {
    const n = e.target.closest('[data-hero-next], #heroNext, .hero-next');
    if (n) { e.preventDefault(); goNext(); return; }
    const p = e.target.closest('[data-hero-prev], #heroPrev, .hero-prev');
    if (p) { e.preventDefault(); goPrev(); return; }

    const READ_MORE_SEL = '#heroRead, #heroReadMore, .hero-read, .hero-readmore, .read-more, .read-more-btn, a.read-more';
    const r = e.target.closest(READ_MORE_SEL);
    if (r) {
      e.preventDefault();
      const href = hero.getAttribute('data-current-href') || r.getAttribute('href') || '';
      if (href) location.href = href;
      return;
    }

    const tab = e.target.closest('[data-tab], .feed-tab, #tabNews, .tab-news, #tabEvents, .tab-events');
    if (tab) {
      e.preventDefault();
      let kind = tab.getAttribute('data-tab') || tab.getAttribute('data-kind');
      if (!kind) {
        const idc = (tab.id || tab.className || '').toLowerCase();
        kind = idc.includes('event') ? 'events' : 'news';
      }
      [tabNews, tabEvents].filter(Boolean).forEach(x => x.classList.remove('is-active','active'));
      if (kind === 'news') tabNews && tabNews.classList.add('is-active','active');
      else tabEvents && tabEvents.classList.add('is-active','active');

      hero.classList.add('hero-anim');
      setTimeout(()=> hero.classList.remove('hero-anim'), 720);

      load(kind);
      return;
    }
  }); }

  /* ===== DESKTOP HAMBURGER (>=901px) ===== */
  

(function(){
    const btn = document.getElementById('sidebarHamburger');
    if (!btn) return;
    const mq = window.matchMedia('(min-width: 901px)');
    function onClick(e){
      if (!mq.matches) return;           // ignore on mobile
      e.preventDefault(); e.stopPropagation();
      document.body.classList.toggle('sidebar-expanded');
    }
    btn.addEventListener('click', onClick, { capture:true });
  })();

(function(){
    if (window.__MOBILE_DRAWER_INITED) return;
    window.__MOBILE_DRAWER_INITED = true;
    const mq = window.matchMedia('(max-width: 900px)');
    const mobileBtn = document.getElementById('mobileSidebarToggle') || document.querySelector('.mobile-hamburger');
    const drawer    = document.getElementById('mobileNavDrawer');
    const panel     = drawer ? drawer.querySelector('.mobile-nav-list') : null;
    const backdrop  = document.getElementById('sidebarBackdrop');
    const topLinks  = document.querySelector('.pill-nav__links');
    if (!mobileBtn || !drawer || !panel || !backdrop || !topLinks) return;

    const DUR = 340;
    let open = false, anim = false;

    function openDrawer(){
      if (!mq.matches || anim || open) return;
      drawer.hidden = false; backdrop.hidden = false;

      // lock start state to avoid pop
      panel.style.transition = 'none';
      panel.style.transform  = 'translateX(-100%)';
      void panel.offsetWidth;            // reflow
      panel.style.transition = '';

      requestAnimationFrame(()=>{
        anim = true;
        document.body.classList.add('navdrawer-open');
        backdrop.classList.add('show');
        setTimeout(()=>{ anim=false; open=true; }, DUR+20);
      });
    }
    function closeDrawer(){
      if (anim || !open) return;
      anim = true;
      document.body.classList.remove('navdrawer-open');
      backdrop.classList.remove('show');
      const done = (ev)=>{
        if (ev && ev.target !== panel) return; // wait for panel
        drawer.hidden = true; backdrop.hidden = true;
        panel.style.transform = 'translateX(-100%)'; // park offscreen for next open
        open=false; anim=false;
        panel.removeEventListener('transitionend', done);
      };
      panel.addEventListener('transitionend', done);
      setTimeout(done, DUR+120);
    }
    window.__closeDrawer = closeDrawer; // (optional) available to other code

    // Build menu once: prepend Home then clone the rest; keep dropdowns
    if (!panel.dataset.built) {
      const menu = document.createElement('ul');

      // Home (from existing link if present, else fallback)
      const liHome = document.createElement('li');
      const aHome  = document.createElement('a');
const navHome = Array.from(document.querySelectorAll('.pill-nav a'))
  .find(a => (a.textContent || '').trim().toLowerCase() === 'home');
aHome.href = navHome ? (navHome.getAttribute('href') || 'index.html') : 'index.html';

      aHome.textContent = 'Home';
      liHome.appendChild(aHome);
      menu.appendChild(liHome);

      // Clone the rest of the desktop links (skip another "Home" if any)
      const clone = topLinks.cloneNode(true);
      [...clone.children].forEach(li=>{
        const txt = (li.textContent||'').trim().toLowerCase();
        if (txt === 'home') return;
        menu.appendChild(li);
      });

      panel.innerHTML = '';
      panel.appendChild(menu);

      // Delegation for dropdown toggle (Account) — leave as-is here
      panel.addEventListener('click', (e)=>{
        const toggler = e.target.closest('.dropdown > a, .dropdown > .dropdown-toggle');
        if (toggler){
          e.preventDefault(); e.stopPropagation();
          const li = toggler.closest('.dropdown');
          li.classList.toggle('open');
          return;
        }
        // Normal link → close drawer
        const a = e.target.closest('a');
        if (a && !a.closest('.dropdown')) closeDrawer();
      });

      panel.dataset.built = '1';
    }

    // Drawer: Logout → open the shared confirmation modal
    panel.addEventListener('click', (e) => {
      const logout = e.target.closest('.logout-link, a[href="#logout"], button[data-action="logout"]');
      if (!logout) return;

      e.preventDefault();

      const overlay = document.getElementById('logoutConfirmOverlay');
      if (!overlay) return;

      // show modal (same behavior as desktop)
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
    });

    // Toggle
    mobileBtn.addEventListener('click', (e)=>{
      if (!mq.matches) return;
      e.preventDefault(); e.stopPropagation();
      open ? closeDrawer() : openDrawer();
    }, { capture:true });

    // Backdrop closes; panel absorbs clicks
    backdrop.addEventListener('click', ()=>{ if (!anim) closeDrawer(); });
    drawer.addEventListener('click', e => e.stopPropagation(), { capture:true });

    // Esc & responsive safety
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) closeDrawer(); });
    mq.addEventListener('change', ev => { if (!ev.matches) closeDrawer(); });
  })();




  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') goNext();
    if (e.key === 'ArrowLeft')  goPrev();
  });

  tabNews && tabNews.classList.add('is-active','active');
  load('news');
});

// === Navbar search: desktop dropdown & mobile inline (next to icon) ===


(function () {
  const icons = document.querySelector('.pill-nav__icons');
  const btnSearch = icons?.querySelector('.pill-nav__icon-btn[aria-label="Search"]');
  if (!icons || !btnSearch) return;

  // Build once
  if (icons.querySelector('.nav-search')) return;
  const wrap = document.createElement('div');
  wrap.className = 'nav-search';
  wrap.innerHTML = `
    <input type="search" class="nav-search__field" placeholder="Search..." />
    <button type="button" class="nav-search__clear" aria-label="Clear">×</button>
  `;
  icons.appendChild(wrap);

  const input = wrap.querySelector('.nav-search__field');
  const clear = wrap.querySelector('.nav-search__clear');

  function openSearch() {
    wrap.classList.add('is-open');
    input.focus();
    input.select();
  }
  function closeSearch() {
    wrap.classList.remove('is-open');
  }

  btnSearch.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    wrap.classList.contains('is-open') ? closeSearch() : openSearch();
  });

  clear.addEventListener('click', (e) => {
    e.preventDefault();
    input.value = '';
    input.focus();
  });

  // Click-away & Esc close
  document.addEventListener('click', (e) => {
    if (!wrap.classList.contains('is-open')) return;
    if (!e.target.closest('.nav-search') &&
        !e.target.closest('.pill-nav__icon-btn[aria-label="Search"]')) {
      closeSearch();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSearch();
  });
})();



// === Make --navbar-height match the real navbar height (keeps hero snug) ===
(() => {
  const nav = document.querySelector('.pill-nav');
  if (!nav) return;

  const apply = () => {
    const h = Math.round(nav.getBoundingClientRect().height || 60);
    document.documentElement.style.setProperty('--navbar-height', `${h}px`);
  };

  // Run now, on resize, and whenever the navbar’s size changes
  apply();
  window.addEventListener('resize', apply);

  if (window.ResizeObserver) {
    const ro = new ResizeObserver(apply);
    ro.observe(nav);
  }
})();

/* ===== Fix top gap under navbar by using the navbar’s actual height ===== */
(function fixHeroTopGap() {
  const nav     = document.querySelector('.pill-nav');
  const content = document.querySelector('.content-wrapper');
  if (!nav || !content) return;

  function clampFirstSectionMargin() {
    // Keep the first section from re-introducing margin collapse
    const first = content.firstElementChild;
    if (first) {
      const mt = parseFloat(getComputedStyle(first).marginTop || '0');
      if (mt > 6) first.style.marginTop = '6px';
    }
  }

  function apply() {
    const navRect = nav.getBoundingClientRect();
    const h = Math.ceil(navRect.height || 60);
    const isMobile = window.matchMedia('(max-width: 900px)').matches;

    // keep the variable accurate for everything else that uses it
    document.documentElement.style.setProperty('--navbar-height', `${h}px`);

    let pt = h;

    if (isMobile) {
      // Aim for a small visual gap under the navbar on phones
      const targetGap = 6; // px
      const first = content.firstElementChild;
      if (first) {
        // current visible gap between navbar bottom and first section top
        const currentGap = Math.round(first.getBoundingClientRect().top - navRect.bottom);
        const delta = currentGap - targetGap; // positive = too much space
        pt = Math.max(0, h - delta);

        // also clamp any big top margin the first section might add
        const mt = parseFloat(getComputedStyle(first).marginTop || '0');
        if (mt > targetGap) first.style.setProperty('margin-top', `${targetGap}px`, 'important');
      }
    }

    // Use !important so this wins over the stylesheet declaration
    content.style.setProperty('padding-top', pt + 'px', 'important');
    clampFirstSectionMargin();
  }

  apply();
  window.addEventListener('load',   apply, { passive: true });
  window.addEventListener('resize', apply, { passive: true });
  try { new ResizeObserver(apply).observe(nav); } catch (_) {}
})();

// Mobile swipe → trigger existing next/prev (no other changes)


(function(){
  if (window.__LOGOUT_WIRED__) return;
  window.__LOGOUT_WIRED__ = true;

  const overlay = document.getElementById('logoutConfirmOverlay');
  if (!overlay) return;

  function openModal(){
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
  }
  function closeModal(){
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.logout-link, a[href="#logout"], button[data-action="logout"]');
    if (t){ e.preventDefault(); openModal(); }
    if (overlay.classList.contains('active') &&
        (e.target === overlay || e.target.closest('.btn-no'))) {
      e.preventDefault();
      closeModal();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) closeModal();
  });
  overlay.querySelector('.btn-yes')?.addEventListener('click', () => {
    // Redirect to login/landing. Adjust target if needed.
    window.location.href = 'index.html';
  });
})();



/* === Mobile + Desktop Logout: open the same confirmation modal === */
(() => {
  // Change this if your login page path is different:
  const LOGIN_REDIRECT = window.LOGOUT_REDIRECT || 'index.html';

  const overlay = document.getElementById('logoutConfirmOverlay');
  if (!overlay) return; // nothing to wire if modal isn't on the page

  const openModal = () => {
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
  };

  const closeModal = () => {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
  };

  // Prefer the drawer's own close function if present; otherwise fall back
  const closeMobileDrawer = () => {
    if (typeof window.__closeDrawer === 'function') {
      try { window.__closeDrawer(); return; } catch {}
    }
    document.body.classList.remove('navdrawer-open');
    const drawer = document.getElementById('mobileNavDrawer');
    if (drawer) drawer.hidden = true;
    const backdrop = document.getElementById('sidebarBackdrop');
    if (backdrop) backdrop.classList.remove('show');
  };

  // One handler that we attach in both capture and bubble phases
  function onLogoutClick(e) {
    const logoutLink = e.target.closest('.logout-link, a[href="#logout"], [data-action="logout"]');
    if (!logoutLink) return;
    e.preventDefault();
    // If we came from the mobile drawer, close it first so the modal is visible
    closeMobileDrawer();
    openModal();
  }

  // Attach in BOTH phases for robustness against stopImmediatePropagation elsewhere
  document.addEventListener('click', onLogoutClick, true);  // capture
  document.addEventListener('click', onLogoutClick);        // bubble

  // Modal buttons
  const btnNo  = overlay.querySelector('.btn-no');
  const btnYes = overlay.querySelector('.btn-yes');

  if (btnNo) {
    btnNo.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal();
    });
  }

  if (btnYes) {
    btnYes.addEventListener('click', (e) => {
      e.preventDefault();
      // Redirect to login page after confirming
      window.location.href = LOGIN_REDIRECT;
    });
  }

  // Click outside modal (overlay) closes it
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // ESC closes it
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && overlay.classList.contains('active')) closeModal();
  });
})();

// === Desktop: notif vs search coordination + precise alignment ===
(() => {
  const mqDesktop = window.matchMedia('(min-width: 901px)');
  const getNotifBtn  = () =>
    document.querySelector('.pill-nav__icon-btn[aria-label="Notifications"], [aria-label="Notifications"].icon-btn, #notifToggle');
  const getSearchBtn = () =>
    document.querySelector('#searchToggle, .pill-nav__icon-btn[aria-label="Search"], [aria-label="Search"].icon-btn');
  const getSearchBox = () =>
    document.querySelector('#navSearch, .nav-search');
  const notif = document.getElementById('notifPopover');

  function isOpenNotif(){ return notif && notif.classList.contains('open'); }
  function openNotif(){ if (notif) notif.classList.add('open'); }
  function closeNotif(){ if (notif) notif.classList.remove('open'); }

  function isOpenSearch(){
    const box = getSearchBox();
    return !!(box && box.classList.contains('is-open'));
  }
  function openSearch(){
    const box = getSearchBox();
    if (!box) return;
    box.classList.add('is-open');
    box.setAttribute('aria-hidden', 'false');
  }
  function closeSearch(){
    const box = getSearchBox();
    if (!box) return;
    box.classList.remove('is-open');
    box.setAttribute('aria-hidden', 'true');
  }

  // When opening notifications, close search; when opening search, close notifications.
  function wireCoordination(){
    const bell   = getNotifBtn();
    const search = getSearchBtn();

    if (bell && !bell.__notifCoord){
      bell.__notifCoord = true;
      bell.addEventListener('click', (e) => {
        if (!mqDesktop.matches) return;           // PC only
        // let your existing toggle run, then reconcile
        setTimeout(() => {
          if (isOpenNotif()) closeSearch();       // notif takes priority → close search
        }, 0);
      }, true); // capture to win against other handlers that stop propagation
    }

    if (search && !search.__searchCoord){
      search.__searchCoord = true;
      search.addEventListener('click', (e) => {
        if (!mqDesktop.matches) return;           // PC only
        setTimeout(() => {
          if (isOpenSearch()) closeNotif();       // search takes priority → close notif
        }, 0);
      }, true);
    }
  }

  // Close notifications if user clicks the search box itself (typing)
  document.addEventListener('focusin', (e) => {
    if (!mqDesktop.matches) return;
    if (e.target && e.target.closest && e.target.closest('#navSearch, .nav-search')){
      closeNotif();
    }
  });

  // Re-wire on load/resize (in case icons/search render later)
  wireCoordination();
  window.addEventListener('resize', wireCoordination);
})();

// Desktop: Notifications vs Search — align precisely and never overlap
(() => {
  const mq = window.matchMedia('(min-width: 901px)');

  // Buttons / popovers
  const bellBtn = document.querySelector('.pill-nav__icon-btn[aria-label="Notifications"], [aria-label="Notifications"].icon-btn, #notifToggle');
  const notif   = document.getElementById('notifPopover');
  const searchBtn = document.querySelector('#searchToggle, .pill-nav__icon-btn[aria-label="Search"], [aria-label="Search"].icon-btn');
  const searchBox = document.getElementById('navSearch') || document.querySelector('.nav-search');

  if (!bellBtn || !notif || !searchBtn || !searchBox) return;

  // Helpers
  const isNotifOpen  = () => notif.classList.contains('open');
  const openNotif    = () => notif.classList.add('open');
  const closeNotif   = () => notif.classList.remove('open');

  const isSearchOpen = () => searchBox.classList.contains('is-open');
  const openSearch   = () => { searchBox.classList.add('is-open'); searchBox.setAttribute('aria-hidden','false'); };
  const closeSearch  = () => { searchBox.classList.remove('is-open'); searchBox.setAttribute('aria-hidden','true'); };

  // Precise placement (right edge under the icon)
  function placeSearch(){
    if (!mq.matches) return;
    const r = searchBtn.getBoundingClientRect();
    searchBox.style.position = 'fixed';
    searchBox.style.top  = Math.round(r.bottom + 8) + 'px';
    searchBox.style.right = Math.max(0, Math.round(window.innerWidth - r.right)) + 'px';
    searchBox.style.zIndex = '3300';
  }
  function placeNotif(){
    if (!mq.matches) return;
    const r = bellBtn.getBoundingClientRect();
    notif.style.position = 'fixed';
    notif.style.top  = Math.round(r.bottom + 8) + 'px';
    notif.style.right = '0px';                 // flush with page right edge
    notif.style.zIndex = '3200';
  }

  // When opening one, close the other — and ensure the target ends up OPEN
  // Use capture + post-toggle microtask so we cooperate with existing handlers.
  searchBtn.addEventListener('click', () => {
    if (!mq.matches) return;
    closeNotif();                    // close notif immediately
    setTimeout(() => {               // after your existing toggle runs
      placeSearch();
      if (!isSearchOpen()) openSearch();
    }, 0);
  }, true);

  bellBtn.addEventListener('click', () => {
    if (!mq.matches) return;
    closeSearch();                   // close search immediately
    setTimeout(() => {               // after your existing toggle runs
      placeNotif();
      if (!isNotifOpen()) openNotif();
    }, 0);
  }, true);

  // Also close notifications if user focuses the search field
  document.addEventListener('focusin', (e) => {
    if (!mq.matches) return;
    if (e.target && e.target.closest && e.target.closest('#navSearch, .nav-search')) closeNotif();
  });

  // Keep positions correct on viewport changes
  window.addEventListener('resize', () => { placeSearch(); placeNotif(); });
  window.addEventListener('scroll',  () => { placeSearch(); placeNotif(); }, { passive: true });
})();

// Desktop: Notifications vs Search — align precisely and never overlap
(() => {
  const mq = window.matchMedia('(min-width: 901px)');

  // Buttons / popovers
  const bellBtn = document.querySelector('.pill-nav__icon-btn[aria-label="Notifications"], [aria-label="Notifications"].icon-btn, #notifToggle');
  const notif   = document.getElementById('notifPopover');
  const searchBtn = document.querySelector('#searchToggle, .pill-nav__icon-btn[aria-label="Search"], [aria-label="Search"].icon-btn');
  const searchBox = document.getElementById('navSearch') || document.querySelector('.nav-search');

  if (!bellBtn || !notif || !searchBtn || !searchBox) return;

  // Helpers
  const isNotifOpen  = () => notif.classList.contains('open');
  const openNotif    = () => notif.classList.add('open');
  const closeNotif   = () => notif.classList.remove('open');

  const isSearchOpen = () => searchBox.classList.contains('is-open');
  const openSearch   = () => { searchBox.classList.add('is-open'); searchBox.setAttribute('aria-hidden','false'); };
  const closeSearch  = () => { searchBox.classList.remove('is-open'); searchBox.setAttribute('aria-hidden','true'); };

  // Precise placement (right edge under the icon)
  function placeSearch(){
    if (!mq.matches) return;
    const r = searchBtn.getBoundingClientRect();
    searchBox.style.position = 'fixed';
    searchBox.style.top  = Math.round(r.bottom + 8) + 'px';
    searchBox.style.right = Math.max(0, Math.round(window.innerWidth - r.right)) + 'px';
    searchBox.style.zIndex = '3300';
  }
  function placeNotif(){
    if (!mq.matches) return;
    const r = bellBtn.getBoundingClientRect();
    notif.style.position = 'fixed';
    notif.style.top  = Math.round(r.bottom + 8) + 'px';
    notif.style.right = '0px';                 // flush with page right edge
    notif.style.zIndex = '3200';
  }

  // When opening one, close the other — and ensure the target ends up OPEN
  // Use capture + post-toggle microtask so we cooperate with existing handlers.
  searchBtn.addEventListener('click', () => {
    if (!mq.matches) return;
    closeNotif();                    // close notif immediately
    setTimeout(() => {               // after your existing toggle runs
      placeSearch();
      if (!isSearchOpen()) openSearch();
    }, 0);
  }, true);

  bellBtn.addEventListener('click', () => {
    if (!mq.matches) return;
    closeSearch();                   // close search immediately
    setTimeout(() => {               // after your existing toggle runs
      placeNotif();
      if (!isNotifOpen()) openNotif();
    }, 0);
  }, true);

  // Also close notifications if user focuses the search field
  document.addEventListener('focusin', (e) => {
    if (!mq.matches) return;
    if (e.target && e.target.closest && e.target.closest('#navSearch, .nav-search')) closeNotif();
  });

  // Keep positions correct on viewport changes
  window.addEventListener('resize', () => { placeSearch(); placeNotif(); });
  window.addEventListener('scroll',  () => { placeSearch(); placeNotif(); }, { passive: true });
})();

// Desktop: notifications vs search — never overlap + precise alignment
(() => {
  const mq = window.matchMedia('(min-width: 901px)');

  // Buttons (be tolerant to markup)
  const bellBtn = document.querySelector(
    '.pill-nav__icon-btn[aria-label="Notifications"], [aria-label="Notifications"].icon-btn, #notifToggle'
  );
  const searchBtn = document.querySelector(
    '#searchToggle, .pill-nav__icon-btn[aria-label="Search"], [aria-label="Search"].icon-btn'
  );

  const notif = document.getElementById('notifPopover');
  const searchBox = document.getElementById('navSearch') || document.querySelector('.nav-search');
  if (!bellBtn || !searchBtn || !notif || !searchBox) return;

  const isNotifOpen  = () => notif.classList.contains('open');
  const closeNotif   = () => notif.classList.remove('open');

  const isSearchOpen = () => searchBox.classList.contains('is-open');
  const openSearch   = () => { searchBox.classList.add('is-open'); searchBox.setAttribute('aria-hidden','false'); };
  const closeSearch  = () => { searchBox.classList.remove('is-open'); searchBox.setAttribute('aria-hidden','true'); };

  // Align right edges directly under each icon (desktop)
  function placeNotif(){
    if (!mq.matches) return;
    const r = bellBtn.getBoundingClientRect();
    notif.style.position = 'fixed';
    notif.style.top  = Math.round(r.bottom + 8) + 'px';  // below the bell
    notif.style.right = '0px';                           // flush to page right edge
    notif.style.zIndex = '3200';
  }
  function placeSearch(){
    if (!mq.matches) return;
    const r = searchBtn.getBoundingClientRect();
    searchBox.style.position = 'fixed';
    searchBox.style.top  = Math.round(r.bottom + 8) + 'px';                           // below the icon row
    searchBox.style.right = Math.max(0, Math.round(window.innerWidth - r.right)) + 'px'; // right edge under icon
    searchBox.style.zIndex = '3300';                                                 // above notif
  }

  // Mutually exclusive open/close:
  // Use CAPTURE so this runs even if other handlers stop propagation.
  searchBtn.addEventListener('click', () => {
    if (!mq.matches) return;
    // Close notifications immediately; let your existing search toggle run
    closeNotif();
    // Ensure search ends up visible and aligned
    setTimeout(() => { placeSearch(); if (!isSearchOpen()) openSearch(); }, 0);
  }, true);

  bellBtn.addEventListener('click', () => {
    if (!mq.matches) return;
    // Close search immediately; let your existing notif toggle run
    closeSearch();
    // Ensure notif ends up visible and aligned
    setTimeout(() => { placeNotif(); if (!isNotifOpen()) notif.classList.add('open'); }, 0);
  }, true);

  // If user focuses the search field (typing), also close notifications
  document.addEventListener('focusin', (e) => {
    if (!mq.matches) return;
    if (e.target && e.target.closest && e.target.closest('#navSearch, .nav-search')) closeNotif();
  });

  /* === Desktop: keep bell popover and search box mutually exclusive === */
(() => {
  const mq = window.matchMedia('(min-width: 901px)');

  const icons     = document.querySelector('.pill-nav__icons');
  const searchBtn = icons?.querySelector('.pill-nav__icon-btn[aria-label="Search"]');
  const bellBtn   = icons?.querySelector('.pill-nav__icon-btn[aria-label="Notifications"]');
  const searchBox = icons?.querySelector('.nav-search');   // built by your existing code
  const notif     = document.getElementById('notifPopover');

  if (!icons || !searchBtn || !bellBtn || !searchBox || !notif) return;

  const isDesk = () => mq.matches;
  const isSearchOpen = () => searchBox.classList.contains('is-open');
  const isNotifOpen  = () => notif.classList.contains('open');
  const closeSearch  = () => searchBox.classList.remove('is-open');
  const closeNotif   = () => notif.classList.remove('open');

  // Make the search tray sit just under the search icon (right-aligned)
  function placeSearch() {
    if (!isDesk() || !isSearchOpen()) return;
    const r = searchBtn.getBoundingClientRect();
    searchBox.style.position = 'fixed';
    searchBox.style.top  = `${r.bottom + 8}px`;
    // keep the right edge under the icon
    searchBox.style.right = `${Math.max(0, window.innerWidth - r.right)}px`;
  }

  // Keep the notif popover aligned under the bell (we already pin right edge via CSS)
  function placeNotif() {
    if (!isDesk() || !isNotifOpen()) return;
    const r = bellBtn.getBoundingClientRect();
    notif.style.top = `${r.bottom + 8}px`;
  }

  // Open one → close the other (capture so we run even if something overlays)
  searchBtn.addEventListener('click', () => {
    if (!isDesk()) return;
    if (isNotifOpen()) closeNotif();
    // defer position calc until after your own toggler runs
    setTimeout(placeSearch, 0);
  }, true);

  bellBtn.addEventListener('click', () => {
    if (!isDesk()) return;
    if (isSearchOpen()) closeSearch();
    setTimeout(placeNotif, 0);
  }, true);

  // If focus lands inside search, also close the notif
  document.addEventListener('focusin', (e) => {
    if (isDesk() && e.target.closest('.nav-search')) closeNotif();
  });

  // Keep positions correct on resize/scroll
  window.addEventListener('resize', () => { placeSearch(); placeNotif(); });
  window.addEventListener('scroll',  () => { placeSearch(); placeNotif(); }, { passive: true });
})();

  // Keep positions accurate
  window.addEventListener('resize', () => { placeNotif(); placeSearch(); });
  window.addEventListener('scroll',  () => { placeNotif(); placeSearch(); }, { passive: true });
})();

// ===== Desktop: dock a persistent search bar on the left side of the navbar =====
(() => {
  const mq = window.matchMedia('(min-width: 901px)');
  const left = document.querySelector('.pill-nav .pill-nav__left');
  if (!left) return;

  let docked; // will hold the docked form we create

  function buildDocked(){
    if (docked || !mq.matches) return;
    docked = document.createElement('form');
    docked.className = 'nav-search-docked';
    docked.setAttribute('role', 'search');
    docked.innerHTML = `
      <input type="search" placeholder="Search..." aria-label="Search" />
      <button type="submit">Search</button>
    `;
    // place it at the end of the left cluster (brand/links -> search)
    left.appendChild(docked);

    // keep it non-navigational for now
    docked.addEventListener('submit', (e) => {
      e.preventDefault();
      // TODO: hook up to your real search later if desired
    });
  }

  function removeDocked(){
    if (!docked) return;
    docked.remove();
    docked = null;
  }

  function apply(){
    if (mq.matches) buildDocked(); else removeDocked();
  }

  apply();
  mq.addEventListener('change', apply);
})();

// ===== Desktop: dock a persistent search bar on the LEFT side of the navbar =====
(() => {
  const mq = window.matchMedia('(min-width: 901px)');

  // Where to insert (brand + links live here)
  const left = document.querySelector('.pill-nav .pill-nav__left') || document.querySelector('.pill-nav');
  if (!left) return;

  // Find the first link list so we can insert the search BEFORE it (keeps it left)
  const linkList = left.querySelector('.pill-nav__links');

  let docked = null;

  function buildDocked(){
    if (docked || !mq.matches) return;

    docked = document.createElement('form');
    docked.className = 'nav-search-docked';
    docked.setAttribute('role', 'search');
    docked.innerHTML = `
      <input type="search" placeholder="Search..." aria-label="Search">
      <button type="submit">Search</button>
    `;

    // insert right after the brand (before the links) if we can
    if (linkList) left.insertBefore(docked, linkList);
    else left.appendChild(docked);

    // keep it non-navigational for now
    docked.addEventListener('submit', (e) => { e.preventDefault(); });
  }

  function removeDocked(){
    if (docked){
      docked.remove();
      docked = null;
    }
  }

  function apply(){ mq.matches ? buildDocked() : removeDocked(); }

  apply();
  mq.addEventListener('change', apply);
})();

/* ===========================
   Settings Modal controller (robust)
   =========================== */
(() => {
  const overlay = document.getElementById('settingsModalOverlay');
  if (!overlay) return;

  const closeBtn   = overlay.querySelector('.settings-modal__close');
  const tabs       = Array.from(overlay.querySelectorAll('.settings-tab'));
  const panels     = Array.from(overlay.querySelectorAll('.settings-panel'));

  const confirmOVL = document.getElementById('confirmModal');
  const btnNo      = document.getElementById('btnConfirmNo');
  const btnYes     = document.getElementById('btnConfirmYes');
  const confirmMsg = document.getElementById('confirmMsg');




  // session-ish snapshot (lightweight)
// ---------- identity/state shared across opens ----------
const STATE = window.__SETTINGS_STATE || (window.__SETTINGS_STATE = {
  WHO: { role:'', student:{}, adviser:{}, sti_email:'', student_id:'' },
  PROFILE: null,
  whoLoaded: false,
  profileLoaded: false
});
const WHO = STATE.WHO;          // alias
let PROFILE = STATE.PROFILE;     // alias (we'll re-point after load)

// Optional: resolve to your API base (works with your capstone folder)
function apiUrl(path){ return path; } // you already use 'api/…' relative URLs

async function loadWhoAmI(force = false){
  if (STATE.whoLoaded && !force) return;
  try {
    const r = await fetch(apiUrl('api/auth/whoami.php') + `?ts=${Date.now()}`, {
      credentials:'include',
      cache:'no-store'
    });
    const j = await r.json().catch(()=>null);
    if (j && j.ok) {
      WHO.role       = (j.session?.role || '').toLowerCase();
      WHO.student    = j.session?.student || {};
      WHO.adviser    = j.session?.adviser || {};
      WHO.sti_email  = j.session?.sti_email || '';
      WHO.student_id = j.session?.student_id || WHO.student?.id || '';
      STATE.whoLoaded = true;
    }
  } catch {}
}

async function loadProfile(force = false){
  if (STATE.profileLoaded && !force) { /* allow keeping cache unless forced */ }
  try {
    const r = await fetch(apiUrl('api/settings/get_profile.php') + `?ts=${Date.now()}`, {
      credentials:'include',
      cache:'no-store'
    });
    const j = await r.json().catch(()=>null);
    if (j && j.ok) {
      STATE.PROFILE = j.item || {};
      PROFILE = STATE.PROFILE;
      STATE.profileLoaded = true;
    }
  } catch {}
}

// Prefer DB (PROFILE); fall back to WHO (session) if DB is empty/missing
function val(k){
  const v = (PROFILE && PROFILE[k] != null && PROFILE[k] !== '') ? PROFILE[k] : null;
  if (v != null) return v;
  const src = (WHO.role === 'student') ? (WHO.student || {}) : (WHO.adviser || {});
  return (src && src[k] != null && src[k] !== '') ? src[k] : '';
}

// Normalize date/datetime -> yyyy-mm-dd
function toYMD(raw){
  if (!raw) return '';
  const m = String(raw).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function allowProgrammatic(fn){
  const prev = window.__allowProgrammaticSet;
  window.__allowProgrammaticSet = true;
  try { fn(); } finally { window.__allowProgrammaticSet = prev; }
}


function setField(form, name, value, placeholder){
  const el = form?.elements?.[name];
  if (!el) return;
  el.value = value || '';
  if (placeholder != null) el.placeholder = placeholder;
}



  // open modal: fetch live profile first so fields prefill correctly
async function open(){
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden','false');

  // IMPORTANT: role first, then DB profile
  await loadWhoAmI(true);
await loadProfile(true);

  switchTab('account'); // this just selects the tab UI (doesn't prefill yet)
}


  function close(){
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden','true');
    overlay.querySelectorAll('.slot.open').forEach(s => collapse(s, true));
  }

  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });

  // --- tabs (make sure hero behind doesn’t react) ---
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      switchTab(tab.getAttribute('data-tab') || 'account');
    });
  });

  function switchTab(name){
    tabs.forEach(t => {
      const on = t.getAttribute('data-tab') === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(p => {
      const on = p.getAttribute('data-panel') === name;
      p.classList.toggle('is-active', on);
      if (!on) p.querySelectorAll('.slot.open').forEach(s => collapse(s, true));
    });
  }

  // ==== helpers for prefill ====
// Prefer DB payload (PROFILE), then fall back to whoami (WHO)
function val(k) {
  const v = (PROFILE && PROFILE[k] != null && PROFILE[k] !== '') ? PROFILE[k] : null;
  if (v != null) return v;

  const role = (WHO.role || '').toLowerCase();
  const src  = role === 'student' ? (WHO.student || {}) : (WHO.adviser || {});
  return (src && src[k] != null) ? src[k] : '';
}
  const ph  = (txt)=> txt;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cur = k => ((WHO.role === 'student' ? WHO.student : WHO.adviser) || {})[k] ?? '';

  // config per field
  function cfgFor(key){
    switch (key) {
      // Account settings
case 'name': return {
  tpl:'tpl-name',
  endpoint:'api/settings/update_account.php',
  prefill:(f)=>{
    // Prefer DB values from get_profile.php
    const first  = (PROFILE?.first_name  ?? '').toString();
    const middle = (PROFILE?.middle_name ?? '').toString();   
    const last   = (PROFILE?.last_name   ?? '').toString();

    let ff = first, mm = middle, ll = last;

    // Fallback only if BOTH first & last were missing in DB
    if (!ff && !ll) {
      const full = (WHO.role === 'student' ? WHO.student.full_name : WHO.adviser.full_name) || '';
      const parts = full.trim().split(/\s+/);
      if (parts.length >= 2) { ff = parts[0]; ll = parts.slice(1).join(' '); }
      else if (parts.length === 1) { ff = parts[0]; }
    }

    f.first_name.value  = ff;
    f.middle_name.value = mm;     // will show the DB value (can be empty string)
    f.last_name.value   = ll;

    f.first_name.placeholder  = 'No first name yet';
    f.middle_name.placeholder = 'No middle name';
    f.last_name.placeholder   = 'No last name yet';
  }
};


// Normalize DB date/datetime into yyyy-mm-dd (for <input type="date">)
function toYMD(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  // 2025-08-29 00:00:00 -> 2025-08-29
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : s;
}

// Convenience setters that are resilient to missing inputs
function setField(form, name, value, placeholder) {
  const el = form?.elements?.[name];
  if (!el) return;
  el.value = value || '';
  if (placeholder != null) el.placeholder = placeholder;
}

      case 'email': return {
        tpl:'tpl-email',
        endpoint:'api/settings/update_account.php',
        prefill:(f)=>{
          const em = val('sti_email') || WHO.sti_email || '';
          f.sti_email.value = em;
          f.sti_email.placeholder = ph('No email yet');
        }
      };

      case 'password': return {
        tpl:'tpl-password',
        endpoint:'api/settings/update_account.php',
        prefill:()=>{}
      };

      // Profile settings
case 'bio': return {
  tpl:'tpl-bio', endpoint:'api/settings/update_profile.php',
  prefill:(f)=>{
    f.bio.value = (PROFILE?.bio ?? '').toString();
    f.bio.placeholder = 'No bio yet';
  }
};
case 'nickname': return {
  tpl:'tpl-nickname', endpoint:'api/settings/update_profile.php',
  prefill:(f)=>{
    f.nickname.value = (PROFILE?.nickname ?? '').toString();
    f.nickname.placeholder = 'No nickname yet';
  }
};
case 'birthdate': return {
  tpl:'tpl-birthdate', endpoint:'api/settings/update_profile.php',
  prefill:(f)=>{
    f.birthdate.value = (PROFILE?.birthdate ?? '').toString(); // yyyy-mm-dd
    f.birthdate.placeholder = 'No birthdate yet';
  }
};
case 'about_city': return {
  tpl:'tpl-about_city', endpoint:'api/settings/update_profile.php',
  prefill:(f)=>{
    f.about_city.value = (PROFILE?.about_city ?? '').toString();
    f.about_city.placeholder = 'No town/city yet';
  }
};
case 'contact_email': return {
  tpl:'tpl-contact_email', endpoint:'api/settings/update_profile.php',
  prefill:(f)=>{
    f.contact_email.value = (PROFILE?.contact_email ?? '').toString();
    f.contact_email.placeholder = 'No contact email yet';
  }
};
case 'student_id_display': return {
  tpl:'tpl-student_id_display', endpoint:null,
  prefill:(f)=>{
    const id = (PROFILE?.student_id) || WHO.student_id || (PROFILE?.adviser_id) || '';
    f.student_id_display.value = id || '';
    f.student_id_display.placeholder = '—';
  }
};
      default: return null;
    }
  }

  // Utility: find direct child .slot
  function getDirectSlot(li){
    for (const node of li.childNodes) {
      if (node.nodeType === 1 && node.classList.contains('slot')) return node;
    }
    return null;
  }

  // Click on an option → toggle editor in the same <li>
  overlay.addEventListener('click', (e) => {
    const btn = e.target.closest('.choose-item');
    if (!btn) return;

    const li   = btn.closest('li');
    const list = li.parentElement;
    const key  = btn.getAttribute('data-key');
    const cfg  = cfgFor(key);
    if (!cfg) return;

    let slot = getDirectSlot(li);
    const isOpen = !!(slot && slot.classList.contains('open'));

    // toggle close if already open
    if (isOpen) { collapse(slot); return; }

    // close any other open slots in this list
    list.querySelectorAll('.slot.open').forEach(s => collapse(s));

    // ensure slot
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'slot';
      li.appendChild(slot);
    }

    // render template
    const tpl = document.getElementById(cfg.tpl);
    slot.innerHTML = '';
    if (!tpl) {
      slot.textContent = 'Not implemented yet.';
      expand(slot);
      return;
    }
    slot.appendChild(tpl.content.cloneNode(true));

    const form = slot.querySelector('form.slot-form');
   try { allowProgrammatic(() => cfg.prefill?.(form)); } catch {}

    // read-only: remove actions
    if (!cfg.endpoint) form.querySelector('.slot-actions')?.remove();

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (!cfg.endpoint) return;

      const payload = Object.fromEntries(new FormData(form).entries());
      const label   = (form.dataset.field || key).replace(/_/g, ' ');

      confirmMsg.textContent = `Save changes to "${label}"?`;
      openConfirm().then(async ok => {
        if (!ok) return;
        try {
          const res  = await fetch(cfg.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data.ok !== true) throw new Error(data.error || `HTTP ${res.status}`);
          toast('Saved!');
          collapse(slot);
          // refresh cache so next open shows fresh values
          await loadProfile();
        } catch (err) {
          toast(err.message || 'Unable to save');
        }
      });
    }, { once:false });

    // slide open
    expand(slot);
  });

  // slide helpers
  function expand(el){
    el.classList.add('open');
    el.style.overflow = 'hidden';
    el.style.maxHeight = '0px';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.maxHeight = el.scrollHeight + 'px';
    }));
  }
  function collapse(el, immediate=false){
    if (immediate) { el.classList.remove('open'); el.style.maxHeight = '0px'; return; }
    el.style.maxHeight = el.scrollHeight + 'px';
    requestAnimationFrame(() => {
      el.classList.remove('open');
      el.style.maxHeight = '0px';
    });
  }

  // confirm modal
  function openConfirm(){
    return new Promise(resolve => {
      const yes = () => { cleanup(); resolve(true);  };
      const no  = () => { cleanup(); resolve(false); };
      function cleanup(){
        confirmOVL.classList.remove('open');
        confirmOVL.setAttribute('aria-hidden', 'true');
        document.removeEventListener('keydown', onEsc);
      }
      function onEsc(e){ if (e.key === 'Escape') no(); }

      confirmOVL.classList.add('open');
      confirmOVL.setAttribute('aria-hidden', 'false');
      btnYes.addEventListener('click', yes, { once:true });
      btnNo.addEventListener('click',  no,  { once:true });
      confirmOVL.addEventListener('click', (e) => { if (e.target === confirmOVL) no(); }, { once:true });
      document.addEventListener('keydown', onEsc);
    });
  }
  /* === Wire Profile navigation to the new UserProfile page (idempotent) === */
(() => {
  if (window.__PROFILE_NAV_WIRED__) return;
  window.__PROFILE_NAV_WIRED__ = true;

  // Resolve /capstone base like the rest of your app
  const PROJECT_BASE = (() => {
    const cap = '/capstone';
    const p = location.pathname;
    const i = p.indexOf(cap);
    return i >= 0 ? p.slice(0, i + cap.length) : '';
  })();
  const toPath = (rel) => {
    const clean = String(rel).replace(/^\//, '');
    return (PROJECT_BASE ? PROJECT_BASE + '/' : '/') + clean;
  };
  const goProfile = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    window.location.href = toPath('UserProfile.html');
  };

  // 1) Sidebar: make avatar + name clickable
  const side = document.querySelector('.side-nav__profile');
  if (side) {
    const avatar = side.querySelector('.profile__avatar');
    const name   = side.querySelector('.profile__name');

    [avatar, name].forEach(el => {
      if (!el || el.__wiredProfile) return;
      el.__wiredProfile = true;
      el.style.cursor = 'pointer';
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.addEventListener('click', goProfile);
      el.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { goProfile(ev); }
      });
    });
  }

  // 2) Top nav: Account → Profile
  const profileLink = Array.from(document.querySelectorAll('.dropdown-menu a'))
    .find(a => (a.textContent || '').trim().toLowerCase() === 'profile');
  if (profileLink && !profileLink.__wiredProfile) {
    profileLink.__wiredProfile = true;
    profileLink.setAttribute('href', toPath('UserProfile.html'));
    profileLink.addEventListener('click', goProfile);
  }
})();

// --- Make all "Chat" icons go to Student-Messages.html ---
(function () {
  const DEST = 'Student-Messages.html';

  function wireChatLinks() {
    const selector = [
      // desktop sidebar
      '.side-nav__item[data-label="Chat"]',
      'a.side-nav__item[aria-label="Chat"]',
      // mobile bottom tabs
      '.mobile-bottom-tabs .mbtab[aria-label="Chat"]',
      // mobile nav links/drawer (if cloned dynamically)
      '#mobileNavLinks .side-nav__item[data-label="Chat"]',
      '.mobile-nav-list a[aria-label="Chat"]'
    ].join(',');

    document.querySelectorAll(selector).forEach((el) => {
      if (el.__chatWired) return;
      el.__chatWired = true;

      // ensure href points to the page
      if ('href' in el) el.setAttribute('href', DEST);

      // intercept click so it always navigates
      el.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = DEST;
      });
    });
  }

  // run once, then keep wiring as DOM changes (for drawers/clones)
  document.addEventListener('DOMContentLoaded', () => {
    wireChatLinks();
    const mo = new MutationObserver(wireChatLinks);
    mo.observe(document.body, { childList: true, subtree: true });
  });
})();



  // tiny toast
  function toast(msg){
    const el = document.createElement('div');
    el.className = 'mini-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      el.addEventListener('transitionend', () => el.remove(), { once:true });
    }, 1400);
  }
})();

(() => {
  if (window.__SETTINGS_GLUE_WIRED__) return;
  window.__SETTINGS_GLUE_WIRED__ = true;

  const ready = (fn) => (document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn));
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  ready(() => {
    const overlay = $('#settingsModalOverlay') || document.querySelector('[data-settings-overlay]');
    if (!overlay) return;

    // --- open/close ---
    const open = () => {
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      ensureInitialTab();
    };
    const close = () => {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      // collapse any open slots
      overlay.querySelectorAll('.slot.open').forEach(s => { s.classList.remove('open'); s.style.maxHeight = ''; });
    };

    // --- tab switching (data-tab ↔ data-panel; supports legacy #accountPanel) ---
    function switchTab(name){
      if (!name) return;
      const tabs   = $$('.settings-tab', overlay);
      const panels = $$('.settings-panel', overlay);
      tabs.forEach(t => {
        const on = (t.dataset.tab === name);
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        if (on) t.setAttribute('tabindex','0'); else t.removeAttribute('tabindex');
      });
      panels.forEach(p => {
        const on = (p.dataset.panel === name) || (p.id === `${name}Panel`);
        p.classList.toggle('is-active', on);
        if (!on) p.querySelectorAll('.slot.open').forEach(s => { s.classList.remove('open'); s.style.maxHeight=''; });
      });
    }
    function ensureInitialTab(){
      const initial = overlay.querySelector('.settings-tab.is-active')?.dataset.tab
                   || overlay.querySelector('.settings-tab')?.dataset.tab
                   || 'account';
      switchTab(initial);
    }

    // --- openers (sidebar “Settings”, Account “Settings”, .open-settings) ---
    document.addEventListener('click', (e) => {
      const t = e.target.closest('.open-settings, .side-nav__item, .dropdown-menu a');
      if (!t) return;
      if (t.matches('.dropdown-menu a')) {
        const txt = (t.textContent || '').trim().toLowerCase();
        if (txt !== 'settings') return;
      } else if (t.classList.contains('side-nav__item')) {
        const lab = (t.dataset.label || '').trim().toLowerCase();
        if (lab !== 'settings') return;
      } else if (!t.classList.contains('open-settings')) {
        return;
      }
      e.preventDefault();
      open();
    });

    // close actions
    overlay.querySelector('.settings-modal__close')?.addEventListener('click', (e)=>{ e.preventDefault(); close(); });
    overlay.addEventListener('click', (e)=>{ if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });

    // tab buttons (delegated)
    overlay.addEventListener('click', (e) => {
      const btn = e.target.closest('.settings-tab');
      if (!btn || !overlay.contains(btn)) return;
      e.preventDefault();
      switchTab(btn.dataset.tab);
    });

    // --- row → slot rendering (clones <template id="tpl-...">) ---
    function getDirectSlot(li){ return Array.from(li.children).find(el => el.classList?.contains('slot')) || null; }
    function expand(slot){
      slot.classList.add('open');
      slot.style.maxHeight = slot.scrollHeight + 'px';
      slot.addEventListener('transitionend', () => { slot.style.maxHeight = 'none'; }, { once:true });
    }
    function collapse(slot){
      slot.style.maxHeight = slot.scrollHeight + 'px';
      requestAnimationFrame(() => { slot.classList.remove('open'); slot.style.maxHeight = '0'; });
    }

    overlay.addEventListener('click', (e) => {
      const btn = e.target.closest('.choose-item');
      if (!btn) return;
      const li = btn.closest('li');
      const list = li?.parentElement;
      const key = btn.getAttribute('data-key') || '';
      if (!li || !key) return;

      // close other slots in same list
      list.querySelectorAll('.slot.open').forEach(s => collapse(s));

      // ensure slot exists
      let slot = getDirectSlot(li);
      if (!slot){ slot = document.createElement('div'); slot.className = 'slot'; li.appendChild(slot); }
      slot.innerHTML = '';

      // template to render
      const tplId = btn.getAttribute('data-tpl') || `tpl-${key}`;
      const tpl = document.getElementById(tplId);
      if (tpl && 'content' in tpl) {
        slot.appendChild(tpl.content.cloneNode(true));
      } else {
        slot.textContent = 'Not implemented yet.';
      }

      // enable Save only when changed (optional, non-DB)
      const form = slot.querySelector('form');
      if (form){
        const saveBtn = form.querySelector('[type="submit"], .btn-primary');
        const baseline = new URLSearchParams(new FormData(form)).toString();
        const check = () => { const now = new URLSearchParams(new FormData(form)).toString(); if (saveBtn) saveBtn.disabled = (now === baseline); };
        form.addEventListener('input', check);
        form.addEventListener('change', check);
        check();
      }

      // animate open
      slot.style.maxHeight = '0';
      requestAnimationFrame(() => expand(slot));
    });

    // if opened by default (rare), sync initial state
    if (overlay.classList.contains('open')) ensureInitialTab();

    // expose tiny API
    window.shellSettings = {
      open:  (tab)=>{ open(); if (tab) switchTab(tab); },
      close: close,
      switchTab
    };
  });
})();

(function(){
  const nameEl = document.querySelector('.side-nav .side-nav__profile .profile__name');
  if (!nameEl) return;

  function centerIfLong(){
    // reset to default left
    nameEl.style.textAlign = 'left';

    const cs   = getComputedStyle(nameEl);
    const lh   = parseFloat(cs.lineHeight) || 20;

    // If it wraps to more than one line OR a long token exceeds the box width:
    const wraps   = nameEl.scrollHeight > (lh + 1);
    const tooWide = nameEl.scrollWidth > (nameEl.clientWidth + 1);

    if (wraps || tooWide) nameEl.style.textAlign = 'center';
  }

  // run now, on resize, and when the name text or layout changes
  centerIfLong();
  window.addEventListener('resize', centerIfLong);

  // re-check when sidebar expands/collapses
  const body = document.body;
  new MutationObserver(centerIfLong).observe(body, { attributes: true, attributeFilter: ['class'] });

  // re-check if the name is filled later via JS
  new MutationObserver(centerIfLong).observe(nameEl, { childList: true, characterData: true, subtree: true });
})();

/* ===== Shell settings router + API base shim (keeps shell UI/flow) ===== */
(() => {
  const origFetch = window.fetch.bind(window);

  // Map legacy per-field endpoints -> your two actual handlers
  const MAP = {
    // account group
    "api/settings/update_name.php":          "api/settings/update_account.php",
    "api/settings/update_email.php":         "api/settings/update_account.php",
    "api/settings/update_password.php":      "api/settings/update_account.php",
    "api/settings/change_password.php":      "api/settings/update_account.php",
    // profile group
    "api/settings/update_bio.php":           "api/settings/update_profile.php",
    "api/settings/update_nickname.php":      "api/settings/update_profile.php",
    "api/settings/update_birthdate.php":     "api/settings/update_profile.php",
    "api/settings/update_about_city.php":    "api/settings/update_profile.php",
    "api/settings/update_contact_email.php": "api/settings/update_profile.php",
  };

  // Try these bases so nested pages work (adjust /capstone/ if your root differs)
  const BASES = ["", "./", "../", "../../", "../../../", "../../../../", "/capstone/"];

  window.fetch = (input, init = {}) => {
    const opts = { credentials: "same-origin", ...init };

    // Only rewrite/retarget shell API calls
    if (typeof input === "string" && /^\/?api\//.test(input)) {
      // strip leading slash for relative tries
      let url = input.replace(/^\//, "");
      const clean = url.split("?")[0];

      // If this is a shell settings update, route it to your real file
      if (MAP[clean]) url = url.replace(clean, MAP[clean]);

      // Try multiple bases until one returns 2xx
      let i = 0;
      const tryNext = () =>
        origFetch(BASES[i++] + url, opts).then((res) => (res.ok || i >= BASES.length ? res : tryNext()));

      return tryNext();
    }

    // Non-API calls: leave as-is
    return origFetch(input, opts);
  };
})();

/* ===== Shell API shim: route endpoints, try bases, and send JSON (not FormData) ===== */
(() => {
  const origFetch = window.fetch.bind(window);

  // Route the shell's per-field endpoints to your two actual handlers
  const MAP = {
    // account group
    "api/settings/update_name.php":          "api/settings/update_account.php",
    "api/settings/update_email.php":         "api/settings/update_account.php",
    "api/settings/update_password.php":      "api/settings/update_account.php",
    "api/settings/change_password.php":      "api/settings/update_account.php",
    // profile group
    "api/settings/update_bio.php":           "api/settings/update_profile.php",
    "api/settings/update_nickname.php":      "api/settings/update_profile.php",
    "api/settings/update_birthdate.php":     "api/settings/update_profile.php",
    "api/settings/update_about_city.php":    "api/settings/update_profile.php",
    "api/settings/update_contact_email.php": "api/settings/update_profile.php",
  };

  // Let API calls work from nested folders too
  const BASES = ["", "./", "../", "../../", "../../../", "../../../../", "/capstone/"];

  function toJSONBody(body) {
    // Convert FormData / URLSearchParams to JSON (what your PHP reads via read_json)
    if (body instanceof FormData || body instanceof URLSearchParams) {
      const obj = {};
      for (const [k, v] of body.entries()) obj[k] = v;
      return JSON.stringify(obj);
    }
    if (typeof body === "string") {
      try { JSON.parse(body); return body; } catch {}
    }
    return null;
  }

  window.fetch = (input, init = {}) => {
    let opts = { credentials: "same-origin", ...init };

    if (typeof input === "string" && /^\/?api\//.test(input)) {
      // Normalize and maybe remap the URL
      let url = input.replace(/^\//, "");
      const clean = url.split("?")[0];
      if (MAP[clean]) url = url.replace(clean, MAP[clean]);

      // If posting to your settings handlers, send JSON instead of FormData
      const isSettingsUpdate = /api\/settings\/update_(account|profile)\.php$/.test(url);
      if (isSettingsUpdate && (opts.method || "GET").toUpperCase() === "POST") {
        const json = toJSONBody(opts.body);
        if (json != null) {
          opts = {
            ...opts,
            body: json,
            headers: { ...(opts.headers || {}), "Content-Type": "application/json" }
          };
        }
      }

      // Try multiple bases so nested pages work identically to your working page
      let i = 0;
      const tryNext = () =>
        origFetch(BASES[i++] + url, opts).then(res => (res.ok || i >= BASES.length ? res : tryNext()));
      return tryNext();
    }

    return origFetch(input, opts);
  };
})();

// Ensure the "Student" pill is centered and iconless even after dynamic updates
(() => {
  const host = document.querySelector('.side-nav .side-nav__profile .profile__status');
  if (!host) return;

  const fixPill = () => {
    const chip = host.querySelector('.profile-chip, .pill, .chip, .badge, .meta-chip, .role-pill, .role-badge')
              || host.firstElementChild;
    if (!chip) return;
    chip.style.display = 'inline-flex';
    chip.style.justifyContent = 'center';
    chip.style.margin = '8px auto 0';
    chip.style.gap = '0';

    // Remove any icon nodes that some templates add
    chip.querySelectorAll('svg, i, img, [class*="icon"]').forEach(n => n.remove());
  };

  fixPill();
  // Watch for the pill being (re)rendered by the shell and reapply the fix
  new MutationObserver(fixPill).observe(host, {childList: true, subtree: true});
})();
/* === SETTINGS • Persist last-typed values & block overwrites in overlay === */
/* === SETTINGS • Persist last-typed values & block overwrites in overlay === */
(() => {
  if (window.__settings_drafts_guard__) return;
  window.__settings_drafts_guard__ = true;

  // ---- minimal selectors ----
  const OVERLAY_SEL = '#settingsModalOverlay, .settings-modal__overlay';
  const overlay = () => document.querySelector(OVERLAY_SEL);
  const currentForm = () => {
    const ov = overlay();
    if (!ov || ov.getAttribute('aria-hidden') === 'true') return null;
    return ov.querySelector('form.slot-form') || ov.querySelector('.slot-form') || ov.querySelector('form');
  };

  // ---- per-user draft key (lazy: uses the CURRENT user) ----
  function getUserKey() {
    const who =
      (window.__SETTINGS_STATE && window.__SETTINGS_STATE.WHO) ||
      (window.whoami && window.whoami.session) ||
      {};
    return who.student_id || who.adviser_id || who.sti_email || who.email || 'me';
  }
  const draftKey = (slot) => `settingsDraft:${getUserKey()}:${slot || 'default'}`;

  // 🚫 Do not load/save drafts for these slots (DB should always win)
  const SKIP_DRAFT_SLOTS = new Set(['name']);

  // ---- per-slot key ----
  let lastSlotKey = '';
  function deriveSlotKey(form) {
    const f = form || currentForm();
    if (!f) return lastSlotKey || '';
    const slot = f.closest?.('.slot');
    const k = (slot && slot.dataset && slot.dataset.key) || lastSlotKey || '';
    if (k) lastSlotKey = k;
    return k;
  }

  // ---- snapshot / storage ----
  const snapshot = (form) => {
    const out = {};
    if (!form) return out;
    new FormData(form).forEach((v, k) => { out[k] = String(v); });
    return out;
  };

  const saveDraft = (form) => {
    const k = deriveSlotKey(form);
    if (!k || !form || SKIP_DRAFT_SLOTS.has(k)) return; // ⟵ don't save drafts for skipped slots
    localStorage.setItem(draftKey(k), JSON.stringify({ t: Date.now(), v: snapshot(form) }));
  };

  const loadDraft = (form) => {
    const k = deriveSlotKey(form);
    if (!k || !form || SKIP_DRAFT_SLOTS.has(k)) return null; // ⟵ don't load drafts for skipped slots
    const raw = localStorage.getItem(draftKey(k));
    if (!raw) return null;
    try { return (JSON.parse(raw) || {}).v || null; } catch { return null; }
  };

  // ---- apply ONLY to empty fields (never clobber fresh prefill) ----
  function applyValues(form, values) {
    if (!form || !values) return;
    const prev = window.__allowProgrammaticSet;
    window.__allowProgrammaticSet = true;
    try {
      Object.keys(values).forEach((name) => {
        const el = form.elements?.[name];
        if (el && 'value' in el && !el.value) { // fill empties only
          el.value = values[name];
        }
      });
    } finally {
      window.__allowProgrammaticSet = prev;
    }
  }

  // ---- hydrate on slot click, then keep drafts fresh ----
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.choose-item[data-key], .choose-item');
    if (!btn) return;
    lastSlotKey = btn.getAttribute('data-key') || btn.dataset.key || lastSlotKey || '';

    // form is injected asynchronously
    setTimeout(() => {
      const form = currentForm();
      if (!form) return;

      const draft = loadDraft(form);
      if (draft) applyValues(form, draft); // won’t override prefilled values

      const onChange = () => saveDraft(form);
      form.addEventListener('input', onChange, { passive: true });
      form.addEventListener('change', onChange);
    }, 0);
  });
})();
