// User-Profile.js - Placeholder for User Profile functionality
(function(){
  // ---------- BASE HELPERS (Retained for general utility) ----------
  const PROJECT_BASE = (() => {
    const cap = '/capstone';
    const p = location.pathname;
    const i = p.indexOf(cap);
    return i >= 0 ? p.slice(0, i + cap.length) : '';
  })();

  // Removed apiCandidates and apiFetch as they are specific to club APIs.
  // You will need to implement your own API fetching logic for user data.

  function mediaUrl(rel){
    if (!rel) return '';
    if (/^https?:\/\//i.test(rel)) return rel;
    const base = PROJECT_BASE || '';
    return `${base}/${String(rel).replace(/^\/+/, '')}`;
  }
  function getParam(name){
    const u = new URL(location.href);
    return u.searchParams.get(name);
  }
  // Removed shuffle as it was specific to "Other Clubs"

  // ---------- DOM REFS (Updated for User Profile) ----------
  const coverEl   = document.getElementById('user-cover');
  const avatarEl  = document.getElementById('user-avatar');
  const nameEl    = document.getElementById('user-name');
  const statusEl  = document.getElementById('user-status');
  const bioEl     = document.getElementById('user-bio');
  const contactAvatar = document.getElementById('user-contact-avatar');
  const contactName   = document.getElementById('user-contact-name');
  const contactEmail  = document.getElementById('user-contact-email');
  const suggestUl = document.getElementById('suggest-list'); // Re-purposed for other users/friends
  const editProfileBtn = document.getElementById('edit-profile-btn');
  const friendsCount = document.getElementById('user-friends-count');

  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    // Sidebar toggle
    document.querySelector(".sidebar-toggle-btn")?.addEventListener("click", () => {
      document.body.classList.toggle("sidebar-expanded");
    });

    // Logout confirm (basis)
    const logoutLink = document.querySelector('.logout-link');
    const overlay    = document.getElementById('logoutConfirmOverlay');
    if (logoutLink && overlay) {
      const btnNo  = overlay.querySelector('.btn-no');
      const btnYes = overlay.querySelector('.btn-yes');
      logoutLink.addEventListener('click', e => { e.preventDefault(); overlay.classList.add('active'); });
      btnNo?.addEventListener('click', () => overlay.classList.remove('active'));
      btnYes?.addEventListener('click', () => { window.location.href = 'index.html'; });
    }

    // Placeholder for loading user data
    loadUserProfile();
    loadOtherUsers();

    // Example: Wire the Edit Profile button
    if (editProfileBtn) {
      editProfileBtn.addEventListener('click', () => {
        alert('Edit Profile button clicked! Implement your edit profile logic here.');
        // You might open a modal or navigate to an edit page
      });
    }
  }
    // Wire the Cover Edit button
    const coverEditBtn = document.getElementById('coverEditBtn');
    if (coverEditBtn) {
      coverEditBtn.addEventListener('click', () => {
        alert('Change Cover button clicked! Implement logic to upload/change cover photo.');
        // Example: Trigger a file input click or open a modal for cover photo upload
      });
    }

    // Wire the Avatar Edit button
    const avatarEditBtn = document.getElementById('avatarEditBtn');
    if (avatarEditBtn) {
      avatarEditBtn.addEventListener('click', () => {
        alert('Change Photo button clicked! Implement logic to upload/change profile picture.');
        // Example: Trigger a file input click or open a modal for profile picture upload
      });
    }

    
  // ---------- LOAD USER PROFILE (Placeholder) ----------
  function loadUserProfile(){
    // This function will be responsible for fetching and displaying user data.
    // Replace with your actual API calls and data population logic.

    // Set default profile picture and cover photo
    coverEl.style.backgroundImage  = `url('Images/cover.jpg')`; // Default cover image
    avatarEl.style.backgroundImage = `url('Images/profile.jpg')`; // Default profile picture

    // Example static data:
    nameEl.textContent = 'John Doe';
    statusEl.textContent = 'Online';
    bioEl.textContent = 'This is a placeholder for John Doe\'s biography. He enjoys coding, reading, and exploring new technologies.';
    console.log('Inside loadUserProfile - bioEl.textContent set to:', bioEl.textContent);
    // Assuming contactAvatar, contactName, contactEmail, and friendsCount are still relevant
    // If these are meant to be the user's own details, they should be populated from the same user data source.
    // For now, keeping them as placeholders or removing if not needed for the current scope.
    // contactAvatar.style.backgroundImage = `url('Images/profile.jpg')`; // Can be same as main avatar or different
    // contactName.textContent  = 'John Doe';
    // contactEmail.textContent = 'john.doe@example.com';
    // friendsCount.textContent = '123'; // Example friend count
  }

  // ---------- LOAD OTHER USERS / FRIENDS (Placeholder) ----------
  function loadOtherUsers(){
    // This function will be responsible for fetching and displaying other users or friends.
    // Replace with your actual API calls and data population logic.

    // Example static data for other users/friends:
    const dummyUsers = [
      { id: 1, name: 'Jane Smith', profile_picture: 'Images/profile.png', status: 'Offline' },
      { id: 2, name: 'Alice Johnson', profile_picture: 'Images/profile.png', status: 'Active' },
      { id: 3, name: 'Bob Williams', profile_picture: 'Images/profile.png', status: 'Away' },
    ];

    if (!suggestUl) return;
    if (!dummyUsers.length){
      suggestUl.innerHTML = `<li style="padding:.5rem 0; color:#6b7280">No other users found.</li>`;
      return;
    }

    suggestUl.innerHTML = dummyUsers.map(u => {
      const thumb = u.profile_picture ? `style="background-image:url('${mediaUrl(u.profile_picture)}')"` : '';
      return `
        <li>
          <a class="suggest-item" href="#">
            <div class="suggest-thumb" ${thumb}></div>
            <div class="suggest-meta">
              <div class="suggest-name">${u.name || 'User'}</div>
              <div class="suggest-sub">${u.status || ''}</div>
            </div>
          </a>
        </li>
      `;
    }).join('');
  }

  // Removed setDisabled, forceEnable, setJoinUI, ensureCancelBtn, hideCancelBtn,
  // setJoinStateFromServer, wireJoin, wireCancel as they are specific to club joining.

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
  // Modified apiGetJson to be a generic fetch, as original apiFetch was removed.
  const apiGetJson = async (url) => {
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) return null;
      return await res.json();
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
      // This API call is for settings, not the main user profile display.
      // Ensure this endpoint exists and returns user settings data.
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

  // Prefill when modal opens
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
    bottom: "16px",
    left: "50%",
    transform: "translateX(-50%) translateY(10px)", // start slightly below
    zIndex: "2147483647",
    background: "#111",
    color: "#fff",
    padding: "10px 12px",
    borderRadius: "10px",
    boxShadow: "0 10px 24px rgba(0,0,0,.25)",
    opacity: "0",
    transition: "opacity .18s ease, transform .18s ease"
  });
  document.body.appendChild(t);

  // fade/slide in
  requestAnimationFrame(() => {
    t.style.opacity = "1";
    t.style.transform = "translateX(-50%) translateY(0)";
  });

  // fade/slide out
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(-50%) translateY(10px)";
    setTimeout(() => t.remove(), 220);
  }, 1500);
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

document.addEventListener('DOMContentLoaded', () => {
  const wrap   = document.querySelector('.about-tabs');
  const tabs   = [...document.querySelectorAll('.about-tab')];
  const panels = [...document.querySelectorAll('.about-panel')];
  if (!wrap || tabs.length < 2 || panels.length < 1) return;

  const targetId = (tab) =>
    tab.getAttribute('aria-controls') ||
    (tab.dataset.tab ? `${tab.dataset.tab}-panel` : '');

  function show(i){
    const tab = tabs[i] ?? tabs[0];
    const id  = targetId(tab);
    wrap.style.setProperty('--tabIndex', i);
    tabs.forEach((t,idx) => t.classList.toggle('is-active', idx === i));
    panels.forEach(p => p.hidden = (p.id !== id));
  }

  tabs.forEach((t,i) => t.addEventListener('click', () => show(i)));

  // Ensure one panel is visible on load
  const initial = Math.max(0, tabs.findIndex(t => t.classList.contains('is-active')));
  show(initial);
});

// Remove the text link/button that says "Back to Previous Page"
document.addEventListener('DOMContentLoaded', () => {
  const back = [...document.querySelectorAll('a,button')]
    .find(el => /back to previous page/i.test(el.textContent || ''));
  if (back) back.remove();
});
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll(
    '.card-about .card-body, .card-about .about-panels, .card-about .about-panel, .card-about .scroll, .card-about .scroll-y'
  ).forEach(el => {
    el.style.height = 'auto';
    el.style.maxHeight = 'none';
    el.style.overflowY = 'visible';
  });
});

// ---- Demo "About" content (drop-in) ----
function renderDemoAbout(){
  const mount = document.getElementById('user-about');
  if (!mount) return;

  const rows = [
    { label: 'Nickname',     key: 'nickname',   value: 'JD' },
    { label: 'Student ID',   key: 'student_id', value: '22-1234-5678' },
    { label: 'Birthdate',    key: 'birthdate',  value: '2006-01-15' },
    { label: 'Town/City',    key: 'city',       value: 'Taguig City' },
    { label: 'Contact Email',key: 'email',      value: 'john.doe@example.com' },
  ];

  mount.innerHTML = `
    <dl class="about-list" id="aboutList">
      ${rows.map(r => `
        <dt>${r.label}</dt>
        <dd id="about-${r.key}" data-field="${r.key}">${r.value}</dd>
      `).join('')}
    </dl>
  `;
}

// Call once after DOM is ready
document.addEventListener('DOMContentLoaded', renderDemoAbout);

// ---- Future: when you hook up the DB, just call this with real values ----
function setAboutFromDB(data){
  // data = { nickname, student_id, birthdate, city, email }
  Object.entries(data || {}).forEach(([k, v]) => {
    const el = document.getElementById(`about-${k}`);
    if (el && v != null) el.textContent = v;
  });
}

// call after content is in the DOM
document.addEventListener('DOMContentLoaded', () => {
  // if you render the demo rows, do that first, then:
  renderDemoAbout(); // Ensure this is called before locking height

});
// === Create a Post: minimal interactivity (enable/disable + image previews)
(() => {
  const input = document.getElementById('postInput');
  const files = document.getElementById('postFiles');
  const previews = document.getElementById('postPreviews');
  const submit = document.getElementById('postSubmit');

  function updateSubmitState(){
    submit.disabled = !(input.value.trim().length || (previews && previews.childElementCount));
  }

  input.addEventListener('input', updateSubmitState);

  files.addEventListener('change', () => {
    previews.innerHTML = '';
    const list = Array.from(files.files || []);
    if (list.length) previews.hidden = false;

    list.slice(0, 10).forEach((f, i) => {
      const url = URL.createObjectURL(f);
      const item = document.createElement('div');
      item.className = 'post-thumb';
      item.innerHTML = `<img src="${url}" alt="">
        <button type="button" aria-label="Remove">×</button>`;
      item.querySelector('button').onclick = () => {
        item.remove();
        if (!previews.childElementCount) previews.hidden = true;
        // clear the file from the FileList by re-creating it minus this index
        const dt = new DataTransfer();
        Array.from(files.files).forEach((ff, idx) => { if (idx !== i) dt.items.add(ff); });
        files.files = dt.files;
        updateSubmitState();
      };
      previews.appendChild(item);
    });

    updateSubmitState();
  });

  // (Placeholder) Submission handler — hook up to your API later
  submit.addEventListener('click', (e) => {
    e.preventDefault();
    // TODO: send input.value + files.files via FormData to /api/posts/create.php
    alert('Demo only: wire this to your API when ready.');
  });
})();

// === Create-a-Post v4: add/remove, additive selection, LIMIT=5, live counter ===
(() => {
  const MAX_FILES = 5;

  const input      = document.getElementById('postInput');
  const filesEl    = document.getElementById('postFiles');
  const previews   = document.getElementById('postPreviews');
  const submit     = document.getElementById('postSubmit');
  const attachLabel= document.querySelector('.btn-attach');
  const counterEl  = document.getElementById('postCounter');

  let selected = [];                        // Array<File>
  const keyOf = f => `${f.name}-${f.size}-${f.lastModified}`;
  const urlMap = new Map();                 // key -> objectURL

  function updateFilesInput(){
    const dt = new DataTransfer();
    selected.slice(0, MAX_FILES).forEach(f => dt.items.add(f));
    filesEl.files = dt.files;
  }
  function updateSubmitState(){
    submit.disabled = !(input.value.trim().length || selected.length);
  }
  function updateAttachState(){
    const remaining = Math.max(0, MAX_FILES - selected.length);
    const disabled  = remaining === 0;
    filesEl.disabled = disabled;
    if (attachLabel) {
      attachLabel.classList.toggle('is-disabled', disabled);
      attachLabel.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      attachLabel.title = disabled
        ? `You can attach up to ${MAX_FILES} photos.`
        : `You can attach ${remaining} more photo${remaining>1?'s':''}.`;
    }
  }
function updateCounter(){
  if (!counterEl) return;
  const n = selected.length;
  counterEl.hidden = (n === 0);            // hide when nothing selected
  if (!counterEl.hidden){
    counterEl.textContent = `${n} / ${MAX_FILES}`;
    counterEl.classList.toggle('is-full', n >= MAX_FILES);
  } else {
    counterEl.classList.remove('is-full');
  }
}


  function renderPreviews(){
    previews.innerHTML = '';
    if (!selected.length){
      previews.hidden = true;
      updateAttachState(); updateCounter(); updateSubmitState();
      return;
    }
    previews.hidden = false;

    selected.forEach((file, idx) => {
      const key = keyOf(file);
      let url = urlMap.get(key);
      if (!url){ url = URL.createObjectURL(file); urlMap.set(key, url); }

      const item = document.createElement('div');
      item.className = 'post-thumb';
      item.innerHTML = `
        <img src="${url}" alt="">
        <button type="button" class="remove-thumb" aria-label="Remove">×</button>
      `;
      item.querySelector('.remove-thumb').addEventListener('click', () => {
        const [removed] = selected.splice(idx, 1);
        const rk = keyOf(removed);
        const u  = urlMap.get(rk);
        if (u){ URL.revokeObjectURL(u); urlMap.delete(rk); }
        updateFilesInput();
        renderPreviews();
      });

      previews.appendChild(item);
    });

    updateAttachState(); updateCounter(); updateSubmitState();
  }

  // Additive selection with cap
  filesEl.addEventListener('change', () => {
    const incoming = Array.from(filesEl.files || []);
    const seen = new Set(selected.map(keyOf));
    const remaining = MAX_FILES - selected.length;

    const allowed = incoming
      .filter(f => !seen.has(keyOf(f)))
      .slice(0, Math.max(0, remaining));

    if (incoming.length && allowed.length < incoming.length) {
      console.warn(`Only ${MAX_FILES} photos allowed. Extra files ignored.`);
    }

    if (allowed.length) selected.push(...allowed);

    filesEl.value = '';              // allow picking same files later
    updateFilesInput();
    renderPreviews();
  });

  input.addEventListener('input', updateSubmitState);

  // Demo submit — replace with your API call later
  submit.addEventListener('click', (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('text', input.value.trim());
    selected.forEach(f => fd.append('photos[]', f, f.name));
    alert(`Demo only: ${selected.length} photo(s)`);
  });

  // initial UI
  updateAttachState(); updateCounter(); updateSubmitState();
})();

// User-Profile.js - Placeholder for User Profile functionality
(function(){
  // ---------- BASE HELPERS (Retained for general utility) ----------
  const PROJECT_BASE = (() => {
    const cap = '/capstone';
    const p = location.pathname;
    const i = p.indexOf(cap);
    return i >= 0 ? p.slice(0, i + cap.length) : '';
  })();

  // Removed apiCandidates and apiFetch as they are specific to club APIs.
  // You will need to implement your own API fetching logic for user data.

  function mediaUrl(rel){
    if (!rel) return '';
    if (/^https?:\/\//i.test(rel)) return rel;
    const base = PROJECT_BASE || '';
    return `${base}/${String(rel).replace(/^\/+/, '')}`;
  }
  function getParam(name){
    const u = new URL(location.href);
    return u.searchParams.get(name);
  }
  // Removed shuffle as it was specific to "Other Clubs"

  // ---------- DOM REFS (Updated for User Profile) ----------
  const coverEl   = document.getElementById('user-cover');
  const avatarEl  = document.getElementById('user-avatar');
  const nameEl    = document.getElementById('user-name');
  const statusEl  = document.getElementById('user-status');
  const bioEl     = document.getElementById('user-bio');
  const contactAvatar = document.getElementById('user-contact-avatar');
  const contactName   = document.getElementById('user-contact-name');
  const contactEmail  = document.getElementById('user-contact-email');
  const suggestUl = document.getElementById('suggest-list'); // Re-purposed for other users/friends
  const editProfileBtn = document.getElementById('edit-profile-btn');
  const friendsCount = document.getElementById('user-friends-count');

  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    // Sidebar toggle
    document.querySelector(".sidebar-toggle-btn")?.addEventListener("click", () => {
      document.body.classList.toggle("sidebar-expanded");
    });

    // Logout confirm (basis)
    const logoutLink = document.querySelector('.logout-link');
    const overlay    = document.getElementById('logoutConfirmOverlay');
    if (logoutLink && overlay) {
      const btnNo  = overlay.querySelector('.btn-no');
      const btnYes = overlay.querySelector('.btn-yes');
      logoutLink.addEventListener('click', e => { e.preventDefault(); overlay.classList.add('active'); });
      btnNo?.addEventListener('click', () => overlay.classList.remove('active'));
      btnYes?.addEventListener('click', () => { window.location.href = 'index.html'; });
    }

    // Placeholder for loading user data
    loadUserProfile();
    loadOtherUsers();

    // Example: Wire the Edit Profile button
    if (editProfileBtn) {
      editProfileBtn.addEventListener('click', () => {
        alert('Edit Profile button clicked! Implement your edit profile logic here.');
        // You might open a modal or navigate to an edit page
      });
    }
  }
    // Wire the Cover Edit button
    const coverEditBtn = document.getElementById('coverEditBtn');
    if (coverEditBtn) {
      coverEditBtn.addEventListener('click', () => {
        alert('Change Cover button clicked! Implement logic to upload/change cover photo.');
        // Example: Trigger a file input click or open a modal for cover photo upload
      });
    }

    // Wire the Avatar Edit button
    const avatarEditBtn = document.getElementById('avatarEditBtn');
    if (avatarEditBtn) {
      avatarEditBtn.addEventListener('click', () => {
        alert('Change Photo button clicked! Implement logic to upload/change profile picture.');
        // Example: Trigger a file input click or open a modal for profile picture upload
      });
    }

    
  // ---------- LOAD USER PROFILE (Placeholder) ----------
  function loadUserProfile(){
    // This function will be responsible for fetching and displaying user data.
    // Replace with your actual API calls and data population logic.

    // Set default profile picture and cover photo
    coverEl.style.backgroundImage  = `url('Images/cover.jpg')`; // Default cover image
    avatarEl.style.backgroundImage = `url('Images/profile.jpg')`; // Default profile picture

    // Example static data:
    nameEl.textContent = 'John Doe';
    statusEl.textContent = 'Online';
    bioEl.textContent = 'This is a placeholder for John Doe\'s biography. He enjoys coding, reading, and exploring new technologies.';
    console.log('Inside loadUserProfile - bioEl.textContent set to:', bioEl.textContent);
    // Assuming contactAvatar, contactName, contactEmail, and friendsCount are still relevant
    // If these are meant to be the user's own details, they should be populated from the same user data source.
    // For now, keeping them as placeholders or removing if not needed for the current scope.
    // contactAvatar.style.backgroundImage = `url('Images/profile.jpg')`; // Can be same as main avatar or different
    // contactName.textContent  = 'John Doe';
    // contactEmail.textContent = 'john.doe@example.com';
    // friendsCount.textContent = '123'; // Example friend count
  }

  // ---------- LOAD OTHER USERS / FRIENDS (Placeholder) ----------
  function loadOtherUsers(){
    // This function will be responsible for fetching and displaying other users or friends.
    // Replace with your actual API calls and data population logic.

    // Example static data for other users/friends:
    const dummyUsers = [
      { id: 1, name: 'Jane Smith', profile_picture: 'Images/profile.png', status: 'Offline' },
      { id: 2, name: 'Alice Johnson', profile_picture: 'Images/profile.png', status: 'Active' },
      { id: 3, name: 'Bob Williams', profile_picture: 'Images/profile.png', status: 'Away' },
    ];

    if (!suggestUl) return;
    if (!dummyUsers.length){
      suggestUl.innerHTML = `<li style="padding:.5rem 0; color:#6b7280">No other users found.</li>`;
      return;
    }

    suggestUl.innerHTML = dummyUsers.map(u => {
      const thumb = u.profile_picture ? `style="background-image:url('${mediaUrl(u.profile_picture)}')"` : '';
      return `
        <li>
          <a class="suggest-item" href="#">
            <div class="suggest-thumb" ${thumb}></div>
            <div class="suggest-meta">
              <div class="suggest-name">${u.name || 'User'}</div>
              <div class="suggest-sub">${u.status || ''}</div>
            </div>
          </a>
        </li>
      `;
    }).join('');
  }

  // Removed setDisabled, forceEnable, setJoinUI, ensureCancelBtn, hideCancelBtn,
  // setJoinStateFromServer, wireJoin, wireCancel as they are specific to club joining.

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
  // Modified apiGetJson to be a generic fetch, as original apiFetch was removed.
  const apiGetJson = async (url) => {
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) return null;
      return await res.json();
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
      // This API call is for settings, not the main user profile display.
      // Ensure this endpoint exists and returns user settings data.
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

  // Prefill when modal opens
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
    bottom: "16px",
    left: "50%",
    transform: "translateX(-50%) translateY(10px)", // start slightly below
    zIndex: "2147483647",
    background: "#111",
    color: "#fff",
    padding: "10px 12px",
    borderRadius: "10px",
    boxShadow: "0 10px 24px rgba(0,0,0,.25)",
    opacity: "0",
    transition: "opacity .18s ease, transform .18s ease"
  });
  document.body.appendChild(t);

  // fade/slide in
  requestAnimationFrame(() => {
    t.style.opacity = "1";
    t.style.transform = "translateX(-50%) translateY(0)";
  });

  // fade/slide out
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(-50%) translateY(10px)";
    setTimeout(() => t.remove(), 220);
  }, 1500);
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

document.addEventListener('DOMContentLoaded', () => {
  const wrap   = document.querySelector('.about-tabs');
  const tabs   = [...document.querySelectorAll('.about-tab')];
  const panels = [...document.querySelectorAll('.about-panel')];
  if (!wrap || tabs.length < 2 || panels.length < 1) return;

  const targetId = (tab) =>
    tab.getAttribute('aria-controls') ||
    (tab.dataset.tab ? `${tab.dataset.tab}-panel` : '');

  function show(i){
    const tab = tabs[i] ?? tabs[0];
    const id  = targetId(tab);
    wrap.style.setProperty('--tabIndex', i);
    tabs.forEach((t,idx) => t.classList.toggle('is-active', idx === i));
    panels.forEach(p => p.hidden = (p.id !== id));
  }

  tabs.forEach((t,i) => t.addEventListener('click', () => show(i)));

  // Ensure one panel is visible on load
  const initial = Math.max(0, tabs.findIndex(t => t.classList.contains('is-active')));
  show(initial);
});

// Remove the text link/button that says "Back to Previous Page"
document.addEventListener('DOMContentLoaded', () => {
  const back = [...document.querySelectorAll('a,button')]
    .find(el => /back to previous page/i.test(el.textContent || ''));
  if (back) back.remove();
});
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll(
    '.card-about .card-body, .card-about .about-panels, .card-about .about-panel, .card-about .scroll, .card-about .scroll-y'
  ).forEach(el => {
    el.style.height = 'auto';
    el.style.maxHeight = 'none';
    el.style.overflowY = 'visible';
  });
});

// ---- Demo "About" content (drop-in) ----
function renderDemoAbout(){
  const mount = document.getElementById('user-about');
  if (!mount) return;

  const rows = [
    { label: 'Nickname',     key: 'nickname',   value: 'JD' },
    { label: 'Student ID',   key: 'student_id', value: '22-1234-5678' },
    { label: 'Birthdate',    key: 'birthdate',  value: '2006-01-15' },
    { label: 'Town/City',    key: 'city',       value: 'Taguig City' },
    { label: 'Contact Email',key: 'email',      value: 'john.doe@example.com' },
  ];

  mount.innerHTML = `
    <dl class="about-list" id="aboutList">
      ${rows.map(r => `
        <dt>${r.label}</dt>
        <dd id="about-${r.key}" data-field="${r.key}">${r.value}</dd>
      `).join('')}
    </dl>
  `;
}

// Call once after DOM is ready
document.addEventListener('DOMContentLoaded', renderDemoAbout);

// ---- Future: when you hook up the DB, just call this with real values ----
function setAboutFromDB(data){
  // data = { nickname, student_id, birthdate, city, email }
  Object.entries(data || {}).forEach(([k, v]) => {
    const el = document.getElementById(`about-${k}`);
    if (el && v != null) el.textContent = v;
  });
}

// call after content is in the DOM
document.addEventListener('DOMContentLoaded', () => {
  // if you render the demo rows, do that first, then:
  renderDemoAbout(); // Ensure this is called before locking height

});
// === Create a Post: minimal interactivity (enable/disable + image previews)
(() => {
  const input = document.getElementById('postInput');
  const files = document.getElementById('postFiles');
  const previews = document.getElementById('postPreviews');
  const submit = document.getElementById('postSubmit');

  function updateSubmitState(){
    submit.disabled = !(input.value.trim().length || (previews && previews.childElementCount));
  }

  input.addEventListener('input', updateSubmitState);

  files.addEventListener('change', () => {
    previews.innerHTML = '';
    const list = Array.from(files.files || []);
    if (list.length) previews.hidden = false;

    list.slice(0, 10).forEach((f, i) => {
      const url = URL.createObjectURL(f);
      const item = document.createElement('div');
      item.className = 'post-thumb';
      item.innerHTML = `<img src="${url}" alt="">
        <button type="button" aria-label="Remove">×</button>`;
      item.querySelector('button').onclick = () => {
        item.remove();
        if (!previews.childElementCount) previews.hidden = true;
        // clear the file from the FileList by re-creating it minus this index
        const dt = new DataTransfer();
        Array.from(files.files).forEach((ff, idx) => { if (idx !== i) dt.items.add(ff); });
        files.files = dt.files;
        updateSubmitState();
      };
      previews.appendChild(item);
    });

    updateSubmitState();
  });

  // (Placeholder) Submission handler — hook up to your API later
  submit.addEventListener('click', (e) => {
    e.preventDefault();
    // TODO: send input.value + files.files via FormData to /api/posts/create.php
    alert('Demo only: wire this to your API when ready.');
  });
})();

// === Create-a-Post v4: add/remove, additive selection, LIMIT=5, live counter ===
(() => {
  const MAX_FILES = 5;

  const input      = document.getElementById('postInput');
  const filesEl    = document.getElementById('postFiles');
  const previews   = document.getElementById('postPreviews');
  const submit     = document.getElementById('postSubmit');
  const attachLabel= document.querySelector('.btn-attach');
  const counterEl  = document.getElementById('postCounter');

  let selected = [];                        // Array<File>
  const keyOf = f => `${f.name}-${f.size}-${f.lastModified}`;
  const urlMap = new Map();                 // key -> objectURL

  function updateFilesInput(){
    const dt = new DataTransfer();
    selected.slice(0, MAX_FILES).forEach(f => dt.items.add(f));
    filesEl.files = dt.files;
  }
  function updateSubmitState(){
    submit.disabled = !(input.value.trim().length || selected.length);
  }
  function updateAttachState(){
    const remaining = Math.max(0, MAX_FILES - selected.length);
    const disabled  = remaining === 0;
    filesEl.disabled = disabled;
    if (attachLabel) {
      attachLabel.classList.toggle('is-disabled', disabled);
      attachLabel.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      attachLabel.title = disabled
        ? `You can attach up to ${MAX_FILES} photos.`
        : `You can attach ${remaining} more photo${remaining>1?'s':''}.`;
    }
  }
function updateCounter(){
  if (!counterEl) return;
  const n = selected.length;
  counterEl.hidden = (n === 0);            // hide when nothing selected
  if (!counterEl.hidden){
    counterEl.textContent = `${n} / ${MAX_FILES}`;
    counterEl.classList.toggle('is-full', n >= MAX_FILES);
  } else {
    counterEl.classList.remove('is-full');
  }
}


  function renderPreviews(){
    previews.innerHTML = '';
    if (!selected.length){
      previews.hidden = true;
      updateAttachState(); updateCounter(); updateSubmitState();
      return;
    }
    previews.hidden = false;

    selected.forEach((file, idx) => {
      const key = keyOf(file);
      let url = urlMap.get(key);
      if (!url){ url = URL.createObjectURL(file); urlMap.set(key, url); }

      const item = document.createElement('div');
      item.className = 'post-thumb';
      item.innerHTML = `
        <img src="${url}" alt="">
        <button type="button" class="remove-thumb" aria-label="Remove">×</button>
      `;
      item.querySelector('.remove-thumb').addEventListener('click', () => {
        const [removed] = selected.splice(idx, 1);
        const rk = keyOf(removed);
        const u  = urlMap.get(rk);
        if (u){ URL.revokeObjectURL(u); urlMap.delete(rk); }
        updateFilesInput();
        renderPreviews();
      });

      previews.appendChild(item);
    });

    updateAttachState(); updateCounter(); updateSubmitState();
  }

  // Additive selection with cap
  filesEl.addEventListener('change', () => {
    const incoming = Array.from(filesEl.files || []);
    const seen = new Set(selected.map(keyOf));
    const remaining = MAX_FILES - selected.length;

    const allowed = incoming
      .filter(f => !seen.has(keyOf(f)))
      .slice(0, Math.max(0, remaining));

    if (incoming.length && allowed.length < incoming.length) {
      console.warn(`Only ${MAX_FILES} photos allowed. Extra files ignored.`);
    }

    if (allowed.length) selected.push(...allowed);

    filesEl.value = '';              // allow picking same files later
    updateFilesInput();
    renderPreviews();
  });

  input.addEventListener('input', updateSubmitState);

  // Demo submit — replace with your API call later
  submit.addEventListener('click', (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('text', input.value.trim());
    selected.forEach(f => fd.append('photos[]', f, f.name));
    alert(`Demo only: ${selected.length} photo(s)`);
  });

  // initial UI
  updateAttachState(); updateCounter(); updateSubmitState();
})();

