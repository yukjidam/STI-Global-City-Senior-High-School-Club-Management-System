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