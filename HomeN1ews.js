document.addEventListener("DOMContentLoaded", async () => {
  await Auth.requireAuth({ roles: ["adviser"] });
});
  
  
  
  // ── LOGOUT CONFIRMATION ──
  const logoutLink = document.querySelector('.logout-link');
  const overlay    = document.getElementById('logoutConfirmOverlay');
  if (logoutLink && overlay) {
    const btnNo  = overlay.querySelector('.btn-no');
    const btnYes = overlay.querySelector('.btn-yes');
    logoutLink.addEventListener('click', e => {
      e.preventDefault();
      overlay.classList.add('active');
    });
    btnNo.addEventListener('click', () => {
      overlay.classList.remove('active');
    });
    btnYes.addEventListener('click', () => {
      // redirect to your login page:
      window.location.href = 'index.html';
    });
  };

  // ========== Modern micro-interactions (safe to append) ==========

// 1) Reveal cards on scroll
(() => {
  const cards = Array.from(document.querySelectorAll('.news-card'));
  if (!('IntersectionObserver' in window) || cards.length === 0) {
    // Fallback: show immediately
    cards.forEach(c => c.classList.add('is-revealed'));
    return;
  }
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('is-revealed');
        obs.unobserve(en.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
  cards.forEach(c => io.observe(c));
})();

// 2) Favorite heart toggle
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.news-card__fave');
  if (!btn) return;
  btn.classList.toggle('is-on');
});

// ===== Sidebar expand/collapse + tooltips =====
(function () {
  // top (hamburger) button = first .side-nav__btn
  const sideBtns = document.querySelectorAll('.side-nav .side-nav__btn');
  const menuBtn  = sideBtns[0] || null;
  const profBtn  = sideBtns[1] || null;

  // add simple tooltips (only show while collapsed)
  if (menuBtn) menuBtn.setAttribute('data-tip', 'Menu');
  if (profBtn) profBtn.setAttribute('data-tip', 'Profile');

  // click to toggle expansion
  if (menuBtn) {
    menuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.body.classList.toggle('sidebar-expanded');
    });
  }
})();
