// Student-EventDetails.js (register path fix + tiny debug)
// --- Compute absolute API base for this site ---
document.addEventListener("DOMContentLoaded", async () => {
  await Auth.requireAuth({ roles: ["student"] });
});



const PROJECT_BASE = '/' + location.pathname.split('/').filter(Boolean)[0]; // "/capstone"
const API_BASE = PROJECT_BASE + '/api';


document.addEventListener('DOMContentLoaded', () => {
  // Sidebar toggle
  document.getElementById('sidebarToggleBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.body.classList.toggle('sidebar-expanded');
  });

  // Logout confirm (unchanged)
  const logoutLink = document.querySelector('.logout-link');
  const overlay    = document.getElementById('logoutConfirmOverlay');
  if (logoutLink && overlay) {
    const btnNo  = overlay.querySelector('.btn-no');
    const btnYes = overlay.querySelector('.btn-yes');
    logoutLink.addEventListener('click', e => {
      e.preventDefault();
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden','false');
    });
    btnNo?.addEventListener('click', () => {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden','true');
    });
    btnYes?.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  // ===== Utils / API bases =====
  const qs = new URLSearchParams(location.search);
  const id = qs.get('id'); // current EVENT id (string)
  const kind = 'events';

  // Robust project base detection (so we never hit bare "/api/...")
  // If your project folder is "capstone", this resolves to "/capstone".
  (function ensureNoTrailingSlash(obj){ for (const k in obj) if (typeof obj[k]==='string') obj[k]=obj[k].replace(/\/+$/,''); })(window);
  const pathSegs = location.pathname.split('/').filter(Boolean);
  let PROJECT_BASE = '';
  if (pathSegs.length > 0) {
    // Prefer known project folder name if present
    const hasCapstone = pathSegs.includes('capstone');
    if (hasCapstone) {
      PROJECT_BASE = '/capstone';
    } else {
      // Fallback: assume first segment is the project folder (if page is under a folder)
      // e.g. /myproj/Student-EventDetails.html -> "/myproj"
      PROJECT_BASE = '/' + pathSegs[0];
      // If you're truly at root (e.g. http://localhost/Student-EventDetails.html),
      // then this line may set PROJECT_BASE to "/Student-EventDetails.html".
      // Guard against that by only keeping it if it’s actually a folder page:
      if (/\.(html?|php)$/i.test(PROJECT_BASE)) PROJECT_BASE = '';
    }
  }

  // Build safe URLs: absolute-to-project if we have a base, else relative
  const build = (p) => (PROJECT_BASE ? `${PROJECT_BASE}/${p}` : p);

  const API_GET       = [API_BASE + '/feed/get.php'];
const API_LIST      = [API_BASE + '/feed/list.php'];
const API_REGISTER  = [API_BASE + '/events/participants/register.php'];

  // Replace ONLY the two fetch helpers in your file

async function fetchFromAny(candidates, query) {
  let lastErr;
  for (const base of candidates) {
    const url = `${base}${base.includes('?') ? '&' : '?'}${query}`;
    try {
      const res = await fetch(url, {
        headers: { 'Accept':'application/json' },
        credentials: 'same-origin',      // <— send PHP session cookie
        cache: 'no-store'
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error(text || 'Non-JSON response'); }
      if (!res.ok || !data || data.ok !== true) {
        throw new Error((data && data.error) || `HTTP ${res.status}`);
      }
      return data;
    } catch (err) { lastErr = err; }
  }
  throw lastErr || new Error('All API candidates failed');
}

async function postToAny(candidates, formData) {
  let lastErr;
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'       // <— send PHP session cookie
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error(text || 'Non-JSON response'); }
      if (!res.ok || !data || data.ok !== true) {
        throw new Error((data && data.error) || `HTTP ${res.status}`);
      }
      return data;
    } catch (err) { lastErr = err; }
  }
  throw lastErr || new Error('All endpoints failed');
}


  function fmtDateYMD(ymd){
    const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return ymd || '';
    const d = new Date(+m[1], +m[2]-1, +m[3]);
    return d.toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' });
  }
  function fmtTime(t){
    if (!t) return '';
    const [hh,mm] = String(t).split(':');
    const d = new Date();
    d.setHours(+hh||0, +mm||0, 0, 0);
    return d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
  }
  function fmtDate(iso){
    try { return new Date(iso).toLocaleDateString(); } catch { return iso || ''; }
  }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  // ===== Load EVENT detail =====
  async function loadEvent() {
    const titleEl   = document.getElementById('eventTitle');
    const postedEl  = document.getElementById('eventDate');      // posting date
    const imgEl     = document.getElementById('eventImage');
    const bodyEl    = document.getElementById('eventContent');
    const regBtn    = document.getElementById('eventRegisterBtn');

    // NEW: meta row elements (includes Club)
    const evClubEl     = document.getElementById('evClub');
    const evDateEl     = document.getElementById('evDate');
    const evStartEl    = document.getElementById('evStart');
    const evEndEl      = document.getElementById('evEnd');
    const evMaxEl      = document.getElementById('evMax');
    const evDeadlineEl = document.getElementById('evDeadline');

    if (!id) {
      if (titleEl) titleEl.textContent = 'Not found';
      if (bodyEl)  bodyEl.textContent  = 'Missing event id.';
      return;
    }

    try {
      const data = await fetchFromAny(API_GET, new URLSearchParams({ id, kind }).toString());
      const it = data.item || {};

      // Title
      if (titleEl) titleEl.textContent = it.title || 'Untitled';

      // Posted date
      if (postedEl) {
        const posted = it.created_at || it.updated_at || it.date || '';
        postedEl.textContent = posted ? `Posted • ${fmtDate(posted)}` : '';
        postedEl.setAttribute('datetime', posted || '');
      }

      // Meta values
      const evClub     = it.club || '';
      const evDate     = it.event_date || it.date || '';
      const evStart    = it.start_time || '';
      const evEnd      = it.end_time || '';
      const evMax      = (it.max_participants != null && it.max_participants !== '') ? String(it.max_participants) : '—';
      const evDeadline = it.reg_deadline || it.registration_deadline || '';

      if (evClubEl)     evClubEl.textContent     = evClub || '—';
      if (evDateEl)     evDateEl.textContent     = evDate ? fmtDateYMD(evDate) : '—';
      if (evStartEl)    evStartEl.textContent    = evStart ? fmtTime(evStart)  : '—';
      if (evEndEl)      evEndEl.textContent      = evEnd   ? fmtTime(evEnd)    : '—';
      if (evMaxEl)      evMaxEl.textContent      = evMax;
      if (evDeadlineEl) evDeadlineEl.textContent = evDeadline ? fmtDateYMD(evDeadline) : '—';

      // Hero image
      if (imgEl) {
        if (it.image || it.banner) {
          imgEl.src = it.image || it.banner;
          imgEl.alt = it.title || '';
          imgEl.style.display = '';
        } else {
          imgEl.removeAttribute('src');
          imgEl.alt = '';
          imgEl.style.display = 'none';
        }
      }

      // Content
      if (bodyEl) {
        const html = String(it.content_html || it.description || '');
        if (html.includes('<')) {
          bodyEl.classList.remove('preline');
          bodyEl.innerHTML = html;
        } else {
          bodyEl.classList.add('preline');
          bodyEl.textContent = html;
        }
      }

      // Register button handler
      if (regBtn) {
        regBtn.onclick = async () => {
          const original = regBtn.textContent;
          try {
            regBtn.disabled = true;
            regBtn.textContent = 'Registering…';

            const fd = new FormData();
            fd.append('event_id', id);

            const out = await postToAny(API_REGISTER, fd);
            if (out.code === 'already') {
              regBtn.textContent = 'Already registered';
            } else {
              regBtn.textContent = 'Registered';
            }
          } catch (err) {
            alert((err && err.message) ? err.message : 'Registration failed');
            regBtn.disabled = false;
            regBtn.textContent = original || 'Register';
          }
        };
      }
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      if (titleEl) titleEl.textContent = 'Error loading event';
      if (bodyEl)  bodyEl.textContent  = msg;
    }
  }

  // ===== Sidebar: recent news/events =====
  async function loadRecentNews() {
    try {
      const q = new URLSearchParams({ kind: 'news', limit: '5', excerpt_len: '1' }).toString();
      const data = await fetchFromAny(API_LIST, q);
      const list = (data.items || []);
      const ul = document.getElementById('recentNews');
      if (!ul) return;
      ul.innerHTML = list.map(n => {
        const href = `Student-NewsDetails.html?id=${encodeURIComponent(n.id)}&kind=news`;
        const img  = n.image ? n.image : '';
        return `
          <li class="mini-item">
            <a href="${href}" title="${escapeHtml(n.title || '')}">
              <img class="mini-thumb" src="${img}" alt="">
            </a>
            <a href="${href}" class="mini-title" title="${escapeHtml(n.title || '')}">
              ${escapeHtml(n.title || 'Untitled')}
            </a>
          </li>
        `;
      }).join('');
    } catch {
      const ul = document.getElementById('recentNews');
      if (ul) ul.innerHTML = `<li class="mini-item" style="opacity:.7">Unable to load news.</li>`;
    }
  }

  async function loadRecentEvents() {
    try {
      const q = new URLSearchParams({ kind: 'events', limit: '7' }).toString();
      const data = await fetchFromAny(API_LIST, q);
      const raw = (data.items || []);
      const list = raw.filter(ev => String(ev.id) !== String(id)).slice(0, 5);
      const ul = document.getElementById('recentEvents');
      if (!ul) return;
      ul.innerHTML = list.map(ev => {
        const href = `Student-EventDetails.html?id=${encodeURIComponent(ev.id)}&kind=events`;
        const img  = ev.image ? ev.image : (ev.banner || '');
        return `
          <li class="mini-item">
            <a href="${href}" title="${escapeHtml(ev.title || '')}">
              <img class="mini-thumb" src="${img}" alt="">
            </a>
            <a href="${href}" class="mini-title" title="${escapeHtml(ev.title || '')}">
              ${escapeHtml(ev.title || 'Untitled')}
            </a>
          </li>
        `;
      }).join('');
    } catch {
      const ul = document.getElementById('recentEvents');
      if (ul) ul.innerHTML = `<li class="mini-item" style="opacity:.7">Unable to load events.</li>`;
    }
  }

  // Init
  loadEvent();
  loadRecentNews();
  loadRecentEvents();
});
