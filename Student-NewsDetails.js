document.addEventListener("DOMContentLoaded", async () => {
  await Auth.requireAuth({ roles: ["student"] });
});


document.addEventListener('DOMContentLoaded', () => {
  // Sidebar toggle
  document.getElementById('sidebarToggleBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.body.classList.toggle('sidebar-expanded');
  });

  // Logout confirm
  const logoutLink = document.querySelector('.logout-link');
  const overlay    = document.getElementById('logoutConfirmOverlay');
  if (logoutLink && overlay) {
    const btnNo  = overlay.querySelector('.btn-no');
    const btnYes = overlay.querySelector('.btn-yes');
    logoutLink.addEventListener('click', e => { e.preventDefault(); overlay.classList.add('active'); overlay.setAttribute('aria-hidden','false'); });
    btnNo?.addEventListener('click', () => { overlay.classList.remove('active'); overlay.setAttribute('aria-hidden','true'); });
    btnYes?.addEventListener('click', () => { window.location.href = 'index.html'; });
  }

  // Utils
  const qs   = new URLSearchParams(location.search);
  const id   = qs.get('id');                                      // current item id (string)
  const kind = (qs.get('kind') || 'news') === 'events' ? 'events' : 'news';

  const API_GET = [
    'api/feed/get.php',
    '../api/feed/get.php',
  ];
  const API_LIST = [
    'api/feed/list.php',
    '../api/feed/list.php',
  ];

  async function fetchFromAny(candidates, query) {
    let lastErr;
    for (const base of candidates) {
      const url = `${base}${base.includes('?') ? '&' : '?'}${query}`;
      try {
        const res = await fetch(url, { headers: { 'Accept':'application/json' } });
        let data = null; try { data = await res.json(); } catch {}
        if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
        if (!data || data.ok !== true) throw new Error((data && data.error) || 'API returned ok=false');
        return data;
      } catch (err) { lastErr = err; }
    }
    throw lastErr || new Error('All API candidates failed');
  }

  function fmtDate(iso){ try{ return new Date(iso).toLocaleDateString(); } catch { return iso || ''; } }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  // Load news detail
  async function loadNews() {
    if (!id) {
      document.getElementById('newsTitle').textContent = 'Not found';
      document.getElementById('newsContent').textContent = 'Missing article id.';
      return;
    }
    const query = new URLSearchParams({ id, kind: 'news' }).toString();
    try {
      const data = await fetchFromAny(API_GET, query);
      const it = data.item || {};
      document.getElementById('newsTitle').textContent = it.title || 'Untitled';
      document.getElementById('newsAuthor').textContent = it.author || 'Unknown author';
      document.getElementById('newsDate').textContent = fmtDate(it.date);
      document.getElementById('newsDate').setAttribute('datetime', it.date || '');

      const img = document.getElementById('newsImage');
      if (it.image) { img.src = it.image; img.alt = it.title || ''; img.style.display = ''; }
      else { img.removeAttribute('src'); img.alt = ''; img.style.display = 'none'; }

      // Content: if it's HTML, render as HTML; else preserve paragraphs (\n)
      const body = document.getElementById('newsContent');
      const html = String(it.content_html || '');
      if (html.includes('<')) {
        body.classList.remove('preline');
        body.innerHTML = html;
      } else {
        body.classList.add('preline');
        body.textContent = html;
      }
    } catch (err) {
      document.getElementById('newsTitle').textContent = 'Error loading article';
      document.getElementById('newsContent').textContent = String(err);
    }
  }

  // Load 5 recent NEWS (top of sidebar), excluding the current news id
  async function loadRecentNews() {
    try {
      // ask for more than 5 to compensate for filtering out current item
      const q = new URLSearchParams({ kind: 'news', limit: '7', excerpt_len: '1' }).toString();
      const data = await fetchFromAny(API_LIST, q);
      const raw = (data.items || []);
      const filtered = raw.filter(n => String(n.id) !== String(id)); // exclude current
      const list = filtered.slice(0, 5);
      const ul = document.getElementById('recentNews');
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
    } catch (err) {
      document.getElementById('recentNews').innerHTML =
        `<li class="mini-item" style="opacity:.7">Unable to load news.</li>`;
    }
  }

  // Load 5 recent EVENTS (bottom of sidebar).
  // If this file is ever reused for an event details page (kind=events),
  // also exclude the current event id from the list.
  async function loadRecentEvents() {
    try {
      const q = new URLSearchParams({ kind: 'events', limit: '7' }).toString();
      const data = await fetchFromAny(API_LIST, q);
      let raw = (data.items || []);
      if (kind === 'events' && id) {
        raw = raw.filter(ev => String(ev.id) !== String(id)); // exclude current event if on event page
      }
      const list = raw.slice(0, 5);
      const ul = document.getElementById('recentEvents');
      ul.innerHTML = list.map(ev => {
        const href = `Student-EventDetails.html?id=${encodeURIComponent(ev.id)}&kind=events`;
        const img  = ev.image ? ev.image : '';
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
    } catch (err) {
      document.getElementById('recentEvents').innerHTML =
        `<li class="mini-item" style="opacity:.7">Unable to load events.</li>`;
    }
  }

  // Init
  loadNews();
  loadRecentNews();
  loadRecentEvents();
});
