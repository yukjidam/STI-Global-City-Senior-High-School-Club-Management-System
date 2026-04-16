/* Adviser-Search.js — global search (Users only: students + advisers) */
(() => {
  const MIN_QUERY_LEN = 2;
  const DEBOUNCE_MS   = 140;
  const PAGE_LIMIT    = 1000;
  const PLACEHOLDER   = 'Search students or advisers…';

  // ⟶ ROUTING CHANGE: open Adviser-UserProfile.html
  const DEST = {
    user: (id) =>
      `Adviser-UserProfile.html?id=${encodeURIComponent(id)}&user_id=${encodeURIComponent(id)}&uid=${encodeURIComponent(id)}`
  };

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const visible = (el) => !!(el && el.offsetParent !== null);

  // Detect /capstone (or root)
  const BASE = (() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const i = parts.indexOf('capstone');
    return i >= 0 ? '/' + parts.slice(0, i + 1).join('/') : '';
  })();
  const to = (p) => (BASE + '/' + String(p).replace(/^\/+/, '')).replace(/\/{2,}/g, '/');

  // Normalize avatar-like path to a usable absolute path
  const normalizeAvatar = (u) => {
    if (!u) return '';
    let s = String(u).trim().replace(/\\/g, '/'); // windows slashes → /
    if (/^(?:https?:|data:|blob:)/i.test(s)) return s; // already absolute
    if (s.startsWith('./')) s = s.slice(1);
    if (!s.startsWith('/')) s = '/' + s;
    return (BASE + s).replace(/\/{2,}/g, '/');
  };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const regEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const highlight = (text, q) => {
    if (!q) return esc(text);
    const re = new RegExp('(' + regEsc(q) + ')', 'ig');
    return esc(text).replace(re, '<mark>$1</mark>');
  };
  const norm = (s) => String(s ?? '').toLowerCase();
  const initials = (name='') => {
    const w = name.trim().split(/\s+/).filter(Boolean);
    return ((w[0]?.[0] || '') + (w[1]?.[0] || '')).toUpperCase() || 'U';
  };

  function ensureOverlay() {
    let ov = $('#globalSearchOverlay');
    if (ov) return ov;

    ov = document.createElement('div');
    ov.id = 'globalSearchOverlay';
    ov.innerHTML = `
      <style>
        #globalSearchOverlay{position:fixed;inset:0;display:none;z-index:3000;background:rgba(0,0,0,.45);backdrop-filter:saturate(120%) blur(2px)}
        #globalSearchOverlay.show{display:block}
        .gs-box{max-width:880px;margin:8vh auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;box-shadow:0 12px 40px rgba(0,0,0,.18);overflow:hidden}
        .gs-head{display:flex;align-items:center;gap:.5rem;padding:.75rem 1rem;border-bottom:1px solid #eef2f7}
        .gs-input{flex:1;border:none;font-size:1rem;padding:.6rem .75rem;outline:none}
        .gs-input::placeholder{color:#9ca3af}
        .gs-close{border:none;background:transparent;font-size:1.2rem;cursor:pointer;color:#6b7280}
        .gs-body{max-height:60vh;overflow:auto}
        .gs-group{padding:.75rem 1rem}
        .gs-title{font-size:.85rem;color:#6b7280;margin:.25rem 0 .35rem 0;text-transform:uppercase;letter-spacing:.04em}
        .gs-item{display:flex;gap:.75rem;align-items:flex-start;padding:.5rem;border-radius:10px;cursor:pointer}
        .gs-item:hover,.gs-item.active{background:#f7f8fb}
        .gs-av{width:44px;height:44px;border-radius:10px;background:#f3f4f6;flex:none;position:relative;overflow:hidden}
        .gs-av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
        .gs-initial{position:absolute;inset:0;display:grid;place-items:center;font-weight:700;color:#4b5563;font-family:Inter,Arial,Helvetica,sans-serif}
        .gs-av .gs-initial{display:none}
        .gs-av.broken .gs-initial{display:grid}
        .gs-av.broken img{display:none}
        .gs-name{font-weight:700;color:#111;margin:0}
        .gs-desc{font-size:.92rem;color:#374151;margin:.15rem 0 0 0;text-transform:capitalize}
        .gs-empty{padding:1rem;color:#6b7280}
        mark{background:#ffec80}
      </style>
      <div class="gs-box" role="dialog" aria-modal="true" aria-label="Search">
        <div class="gs-head">
          <input id="gsInput" class="gs-input" type="search" placeholder="${PLACEHOLDER}" />
          <button class="gs-close" aria-label="Close">✕</button>
        </div>
        <div class="gs-body" id="gsBody">
          <div class="gs-empty">Type to search…</div>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    wireOverlayOnce(ov);
    return ov;
  }
  const overlayShown = () => $('#globalSearchOverlay')?.classList.contains('show');
  function openOverlay()  { ensureOverlay().classList.add('show'); $('#gsInput')?.focus(); }
  function closeOverlay() { $('#globalSearchOverlay')?.classList.remove('show'); }

  const store = { users: [], loaded: false };

  async function getJSON(url) {
    const r = await fetch(url, { credentials: 'include' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
    return j;
  }

  const unwrap = (x) =>
    Array.isArray(x) ? x :
    (['items','rows','data','results','users','students','advisers'].map(k => x?.[k]).find(Array.isArray) || []);

  async function loadUsers() {
    const [s, a] = await Promise.allSettled([
      getJSON(to(`api/students/list.php?limit=${PAGE_LIMIT}`)),
      getJSON(to(`api/advisers/list.php?limit=${PAGE_LIMIT}`))
    ]);

    const students = unwrap(s.value || []);
    const advisers = unwrap(a.value || []);

    const mapUser = (u, roleGuess) => {
      const first = u.first_name ?? u.firstname ?? u.given_name ?? '';
      const last  = u.last_name  ?? u.lastname  ?? u.family_name ?? '';
      const name  = (first + ' ' + last).trim() || (u.name ?? u.full_name ?? 'User');
      const id    = u.id ?? u.user_id ?? u.student_id ?? u.adviser_id ?? u.uid ?? '';

      const rawAvatar =
        u.profile_picture ?? u.profile ?? u.picture ?? u.photo ??
        u.avatar ?? u.avatar_url ?? u.pfp ?? u.pfp_url ??
        u.img ?? u.image ?? '';

      const avatar = normalizeAvatar(rawAvatar);
      const role   = (u.role ?? u.type ?? roleGuess ?? '').toString().toLowerCase();

      return id ? { id, name, avatar, role } : null;
    };

    return [
      ...students.map(u => mapUser(u, 'student')).filter(Boolean),
      ...advisers.map(u => mapUser(u, 'adviser')).filter(Boolean),
    ];
  }

  async function ensureData() {
    if (store.loaded) return;
    try {
      store.users = await loadUsers();
    } finally { store.loaded = true; }
  }

  function renderResults(users, q='') {
    const body = $('#gsBody');
    if (!Array.isArray(users) || !users.length) {
      body.innerHTML = `<div class="gs-empty">${q.length < MIN_QUERY_LEN ? `Type at least ${MIN_QUERY_LEN} characters…` : 'No results found.'}</div>`;
      return;
    }

    const row = (u) => {
      const init = initials(u.name);
      const hasAvatar = !!u.avatar;
      const avClass = `gs-av${hasAvatar ? '' : ' broken'}`;
      return `
        <div class="gs-item" data-id="${esc(u.id)}" tabindex="-1">
          <div class="${avClass}">
            <img loading="lazy"
                 src="${hasAvatar ? esc(u.avatar) : ''}"
                 alt="${esc(u.name)} avatar"
                 onload="this.closest('.gs-av').classList.remove('broken')"
                 onerror="this.closest('.gs-av').classList.add('broken')">
            <div class="gs-initial">${esc(init)}</div>
          </div>
          <div class="gs-texts">
            <p class="gs-name">${highlight(u.name, q)}</p>
            ${u.role ? `<p class="gs-desc">${highlight(u.role, q)}</p>` : ''}
          </div>
        </div>`;
    };

    body.innerHTML = `
      <div class="gs-group">
        <div class="gs-title">Users</div>
        ${users.map(row).join('')}
      </div>
    `;

    $$('.gs-item', body).forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        try {
          sessionStorage.setItem('user_nav_src', 'search');
          sessionStorage.setItem('selectedUserId', String(id));
        } catch {}
        window.location.href = to(DEST.user(id));
      });
    });
  }

  async function runSearch(q) {
    await ensureData();
    if (q.length < MIN_QUERY_LEN) { renderResults([], q); return; }
    const qs = norm(q);
    const match = (u) => norm(u.name).includes(qs) || norm(u.role).includes(qs);
    const users = store.users.filter(match).slice(0, 80);
    renderResults(users, q);
  }

  let activeIdx = -1, debounceTimer;
  function wireOverlayOnce(ov){
    if (ov.__wired) return;
    ov.__wired = true;

    const input = $('#gsInput', ov);
    const body  = $('#gsBody', ov);
    const btnClose = $('.gs-close', ov);

    const debouncedSearch = () => {
      clearTimeout(debounceTimer);
      const q = input.value.trim();
      debounceTimer = setTimeout(() => runSearch(q), DEBOUNCE_MS);
    };

    input.addEventListener('input', debouncedSearch);
    ov.addEventListener('click', (e) => {
      if (!e.target.closest('.gs-box')) closeOverlay();
    });
    btnClose.addEventListener('click', closeOverlay);

    document.addEventListener('keydown', (e) => {
      if (!overlayShown()) return;
      const items = $$('.gs-item', body);
      if (!items.length) return;

      if (e.key === 'Escape') { closeOverlay(); return; }
      if (e.key === 'ArrowDown' || e.key === 'Down') {
        e.preventDefault(); activeIdx = (activeIdx + 1) % items.length;
      } else if (e.key === 'ArrowUp' || e.key === 'Up') {
        e.preventDefault(); activeIdx = (activeIdx - 1 + items.length) % items.length;
      } else if (e.key === 'Enter') {
        e.preventDefault(); if (activeIdx >= 0) items[activeIdx].click(); return;
      } else return;

      items.forEach(el => el.classList.remove('active'));
      items[activeIdx].classList.add('active');
      items[activeIdx].scrollIntoView({ block:'nearest' });
    });
  }

  // Try to hook into your navbar search (same selectors as student version)
  function findNavbarSearch() {
    const candidates = [
      '#navSearchInput',
      '#pillSearchForm input[type="search"]',
      'header input[type="search"]',
      'input[type="search"][placeholder*="search" i]',
    ];
    for (const sel of candidates) {
      const el = $(sel);
      if (el && el.id !== 'gsInput' && visible(el)) return el;
    }
    return null;
  }

  function syncFrom(navInput) {
    openOverlay();
    const ovInput = $('#gsInput');
    if (!ovInput) return;
    ovInput.value = navInput.value;
    ovInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function wireNavbar() {
    const nav = findNavbarSearch();
    const icon = document.querySelector('button[aria-label="Search"]');

    if (nav && !nav.__wired) {
      nav.__wired = true;
      if (!nav.placeholder) nav.placeholder = PLACEHOLDER;
      ['focus','input','keydown','mousedown','click'].forEach(evt =>
        nav.addEventListener(evt, () => syncFrom(nav)));
    }

    if (icon && !icon.__wired) {
      icon.__wired = true;
      icon.addEventListener('click', () => {
        const n = findNavbarSearch();
        if (n) syncFrom(n);
        else openOverlay();
      });
    }

    if (!document.__gsGlobalKey) {
      document.__gsGlobalKey = true;
      document.addEventListener('keydown', (e) => {
        const ae = document.activeElement;
        if (!ae || !(ae instanceof HTMLInputElement)) return;
        if (ae.id === 'gsInput') return;
        if (ae.type?.toLowerCase() !== 'search') return;
        if (!visible(ae)) return;
        setTimeout(() => syncFrom(ae), 0);
      });
    }

    if (!document.__gsHotkeys) {
      document.__gsHotkeys = true;
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey && (e.key === 'k' || e.key === 'K')) || e.key === '/') {
          e.preventDefault();
          const n = findNavbarSearch();
          if (n) syncFrom(n);
          else openOverlay();
        }
      });
    }
  }

  const bindAll = () => { ensureOverlay(); wireNavbar(); };
  document.addEventListener('DOMContentLoaded', bindAll);
  new MutationObserver(bindAll).observe(document.body, { childList:true, subtree:true });

  // Optional manual trigger: GlobalSearch.open()
  window.GlobalSearch = { open: openOverlay };
})();
