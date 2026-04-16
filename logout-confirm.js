// logout-confirm.js — ultra-robust confirm-before-logout
(() => {
  // 1) Utility: detect likely "Logout" triggers even if no special class is set
  function isLogoutEl(el) {
    if (!el) return false;
    const a = el.closest('a,button');
    if (!a) return false;
    const lab =
      (a.getAttribute('data-action') || '') +
      ' ' + (a.getAttribute('aria-label') || '') +
      ' ' + (a.getAttribute('title') || '') +
      ' ' + (a.textContent || '');
    const hasLogoutWord = /\blog\s*out\b/i.test(lab);
    const idClass = (a.id + ' ' + a.className).toLowerCase();
    const hasLogoutClass = /\blogout\b/.test(idClass);
    return hasLogoutWord || hasLogoutClass || a.id === 'btn-logout';
  }

  // 2) Compute API + login paths if Auth isn't available
  function computeBase() {
    const segs = location.pathname.split('/').filter(Boolean);
    if (segs.includes('api') && segs.indexOf('api') > 0) return '/' + segs[segs.indexOf('api') - 1];
    const first = segs[0] || '';
    return first && !/\./.test(first) ? '/' + first : '';
  }
  const PROJECT_BASE = (window.Auth?.PROJECT_BASE) || computeBase();
  const API_BASE = (window.Auth?.API) || (PROJECT_BASE + '/api');
  const LOGIN_URL = (window.Auth?.LOGIN) || (location.origin + PROJECT_BASE + '/index.html');

  // 3) Ensure/Inject the confirmation overlay (your exact markup)
  function ensureOverlay() {
    let ov = document.querySelector('#logoutConfirmOverlay,[data-logout-overlay]');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'logoutConfirmOverlay';
      ov.setAttribute('aria-hidden','true');
      ov.innerHTML = `
        <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="logout-ttl">
          <h4 id="logout-ttl">Do you want to logout?</h4>
          <div class="btns">
            <button class="btn-no" type="button">No</button>
            <button class="btn-yes" type="button">Yes</button>
          </div>
        </div>`;
      document.body.appendChild(ov);
    }
    // minimal safety styles so it’s visible above everything
    const cs = getComputedStyle(ov);
    ov.style.position = 'fixed';
    ov.style.inset = '0';
    ov.style.background = 'rgba(0,0,0,.35)';
    ov.style.display = 'none';
    ov.style.placeItems = 'center';
    ov.style.zIndex = String(Math.max(9999, parseInt(cs.zIndex || '0', 10)));
    return ov;
  }
  function openOverlay(ov) {
    ov.setAttribute('aria-hidden','false');
    ov.style.display = 'grid';
    document.body.classList.add('no-scroll');
  }
  function closeOverlay(ov) {
    ov.setAttribute('aria-hidden','true');
    ov.style.display = 'none';
    document.body.classList.remove('no-scroll');
  }

  async function endSessionAndGoLogin() {
    try {
      if (window.Auth?.logout) {
        await Auth.logout(); // will redirect
        return;
      }
      await fetch(API_BASE + '/auth/logout.php', { method:'POST', credentials:'include' });
    } finally {
      location.replace(LOGIN_URL);
    }
  }

  // 4) Neutralize all obvious logout anchors so they cannot navigate away
  function neutralizeLogoutAnchors(root = document) {
    root.querySelectorAll('a[href]').forEach(a => {
      if (!isLogoutEl(a)) return;
      if (!a.dataset.href) a.dataset.href = a.getAttribute('href') || '';
      a.setAttribute('href', '#'); // prevent native navigation
      a.setAttribute('role', 'button');
    });
  }

  // 5) Global intercept (capture) for pointerdown + click
  function bindInterceptors(overlay) {
    const handler = (e) => {
      const trg = e.target.closest('a,button');
      if (!isLogoutEl(trg)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      openOverlay(overlay);
    };
    document.addEventListener('pointerdown', handler, true);
    document.addEventListener('click', handler, true);
  }

  // 6) Wire overlay buttons and backdrop/ESC
  function wireOverlay(overlay) {
    const yes = overlay.querySelector('.btn-yes,[data-logout-yes]');
    const no  = overlay.querySelector('.btn-no,[data-logout-no]');
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(overlay); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.getAttribute('aria-hidden') === 'false') closeOverlay(overlay);
    });
    no?.addEventListener('click', () => closeOverlay(overlay));
    yes?.addEventListener('click', async () => {
      yes.disabled = true;
      try { await endSessionAndGoLogin(); } finally { yes.disabled = false; }
    });
  }

  // 7) Observe DOM changes (if nav is injected later)
  function observeForNewAnchors() {
    const mo = new MutationObserver(muts => {
      for (const m of muts) {
        m.addedNodes?.forEach(n => {
          if (n.nodeType === 1) neutralizeLogoutAnchors(n);
        });
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Boot
  document.addEventListener('DOMContentLoaded', () => {
    const overlay = ensureOverlay();
    neutralizeLogoutAnchors(document);
    bindInterceptors(overlay);
    wireOverlay(overlay);
    observeForNewAnchors();
  });
})();
