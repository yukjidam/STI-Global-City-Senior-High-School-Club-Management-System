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