// auth-guard.js — single source of truth
(() => {
  const ORIGIN = location.origin;

  function computeBase() {
    const segs = location.pathname.split("/").filter(Boolean);
    const known = ["capstone", "shs", "SHS-CLUB-MANAGEMENT-SYSTEM"];
    for (const s of segs) if (known.includes(s)) return "/" + s;
    if (segs.includes("api") && segs.indexOf("api") > 0) return "/" + segs[segs.indexOf("api") - 1];
    return segs[0] ? "/" + segs[0] : "";
  }

  const PROJECT_BASE = computeBase();
  const API_BASE     = (PROJECT_BASE || "") + "/api";
  const LOGIN_URL    = ORIGIN + (PROJECT_BASE || "") + "/index.html"; // change filename if needed

  async function api(path, { method="GET", body=null } = {}) {
    const res = await fetch(API_BASE + path, {
      method,
      headers: body ? { "Content-Type":"application/json" } : undefined,
      body: body ? JSON.stringify(body) : null,
      credentials: "include"
    });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  async function whoami() {
    const { me, is_authenticated } = await api("/auth/me.php");
    return { me, is_authenticated };
  }

  async function logoutAndGoToLogin() {
    const urls = [
      API_BASE + "/auth/logout.php",
      (PROJECT_BASE || "") + "/api/auth/logout.php",
      "/api/auth/logout.php"
    ];
    for (const u of urls) {
      try {
        const r = await fetch(u, { method:"POST", credentials:"include" });
        if (r.ok) break;
      } catch {}
    }
    // Force to YOUR login page (not /dashboard/)
    location.replace(LOGIN_URL);
  }

  async function requireAuth({ roles=null } = {}) {
    const { me, is_authenticated } = await whoami();
    if (!is_authenticated || !me) {
      location.replace(LOGIN_URL);
      throw new Error("Not authenticated");
    }
    if (Array.isArray(roles) && roles.length && !roles.includes(me.role)) {
      const home =
        me.role === "admin"   ? (PROJECT_BASE + "/Admin.html") :
        me.role === "adviser" ? (PROJECT_BASE + "/HomeNews.html") :
                                (PROJECT_BASE + "/Student-HomeNews.html");
      location.replace(home);
      throw new Error("Role not permitted");
    }
    return me;
  }

  // Export helpers
  window.Auth = { PROJECT_BASE, API_BASE, LOGIN_URL, whoami, logoutAndGoToLogin, requireAuth };
  // Back-compat global so older code that calls logoutAndGoToLogin() won’t crash
  window.logoutAndGoToLogin = logoutAndGoToLogin;

  // Global logout click interceptor (capture so we win)
  document.addEventListener("click", (e) => {
    const el = e.target.closest('#btn-logout,[data-action="logout"],a[href="/"],a[href="/dashboard/"]');
    if (!el) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.Auth.logoutAndGoToLogin();
  }, true);

    // --- Navbar pill-nav router + active-link sync (works site-wide) ---
  document.addEventListener('DOMContentLoaded', () => {
    // Your top navbar uses this container on adviser pages
    const NAV_CONTAINER = '.pill-nav__links';

    // Map human labels → actual pages (adjust if your filenames differ)
    const ROUTES = {
      'Home':            'HomeNews.html',
      'Manage Content':  'ManageContent-NewsManagement.html',
      'Club':            'ClubDirectory.html',         // key fix
      'Club Directory':  'ClubDirectory.html',         // some pages show full label
      'Request':         'Request.html'
    };

    // 1) Click handling:
    // - If link has href="#" (no real URL), route by label using ROUTES
    // - If link has a real href, let the browser navigate normally
    document.addEventListener('click', (e) => {
      const a = e.target.closest(`${NAV_CONTAINER} a[href]`);
      if (!a) return;

      const href  = (a.getAttribute('href') || '').trim();
      const label = (a.dataset.label || a.getAttribute('aria-label') || a.textContent || '').trim();

      if (href === '#') {
        const dest = ROUTES[label] || ROUTES[label.replace(/\s+/g, ' ')];
        if (dest) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (!location.pathname.endsWith('/' + dest)) location.href = dest;
        }
        // If no route found, do nothing and let it behave like a dead link
        return;
      }
      // If href is a real file, we do not preventDefault; normal navigation proceeds
    }, true); // capture so we beat any legacy handlers that might force HomeNews

    // 2) Active-link highlighting by current URL (no redirects)
    const here = location.pathname.split('/').pop().toLowerCase();
    const links = document.querySelectorAll(`${NAV_CONTAINER} a[href]`);
    links.forEach(a => {
      const own = (a.getAttribute('href') || '').split('/').pop().toLowerCase();
      const isActive = own && own === here;
      a.classList.toggle('active-link', isActive);
      if (isActive) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  });

})();
