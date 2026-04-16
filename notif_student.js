// === Student notifications (original popover style; text-only) ===
(() => {
  "use strict";
  if (window.__NOTIF_STUDENT__) return;
  window.__NOTIF_STUDENT__ = true;

  // ------- bell discovery (handles lazy nav) -------
  const BELL_SELECTORS = [
    "#notifToggle",
    '.pill-nav__icon-btn[aria-label="Notifications"]',
    '[aria-label="Notifications"].pill-nav__icon-btn',
  ];
  function findBell() {
    for (const sel of BELL_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }
  function waitForBell(timeoutMs = 6000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const b = findBell();
        if (b) return resolve(b);
        if (Date.now() - start > timeoutMs) return resolve(null);
      };
      const int = setInterval(() => {
        const b = findBell();
        if (b) { clearInterval(int); obs.disconnect(); resolve(b); }
      }, 120);
      const obs = new MutationObserver(() => {
        const b = findBell();
        if (b) { clearInterval(int); obs.disconnect(); resolve(b); }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      tick();
    });
  }

  // ------- popover (original structure; no images) -------
  function ensurePopoverOriginal(bell) {
    let pop = document.getElementById("notifPopover");
    if (!pop) {
      pop = document.createElement("div");
      pop.id = "notifPopover";
      pop.setAttribute("role", "dialog");
      pop.setAttribute("aria-modal", "false");
      pop.setAttribute("aria-label", "Notifications");
      pop.classList.add("notif-popover");
      pop.style.zIndex = "9999";
      pop.innerHTML = `
        <div class="notif-header">Notifications</div>
        <div id="notifList" class="notif-list" role="list"></div>
      `;
      document.body.appendChild(pop);
    }
    if (!bell.id) bell.id = "notifToggle";
    if (!bell.querySelector("#notifCount")) {
      const badge = document.createElement("span");
      badge.id = "notifCount";
      badge.className = "badge";
      badge.hidden = true;
      bell.appendChild(badge);
    }
    
    return {
      bell,
      pop,
      list: pop.querySelector("#notifList"),
      badge: bell.querySelector("#notifCount"),
    };
  }

  // ------- API helpers -------
  async function whoAmIAndBase() {
    const candidates = [
      "/capstone/api/auth/me.php",
      "api/auth/me.php",
      "../api/auth/me.php",
    ];
    for (const u of candidates) {
      try {
        const abs = new URL(u, location.href).href;
        const r = await fetch(abs, { credentials: "include", cache: "no-store" });
        if (!r.ok) continue;
        const j = await r.json();
        if (j && j.ok && j.is_authenticated) {
          const base = abs.replace(/\/api\/auth\/me\.php.*$/, "");
          return { me: j.me || {}, base };
        }
      } catch {}
    }
    return { me: {}, base: location.origin + "/capstone" };
  }
  async function getJSON(url, opt) {
    const r = await fetch(url, { credentials: "include", cache: "no-store", ...(opt || {}) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || String(r.status));
    return d;
  }
  
  // Force titles to what the server sent (beats any late override)
function enforceTitles(pop) {
  if (!pop) return;
  const fix = () => {
    pop.querySelectorAll('.notif-item').forEach(it => {
      const want = (it.getAttribute('data-title') || '').trim();
      const titleEl = it.querySelector('.notif-item__title');
      if (!titleEl) return;
      // If we have a desired title, set it unconditionally
      if (want && titleEl.textContent.trim() !== want) {
        titleEl.textContent = want;
      }
      // Kill legacy text if it still sneaks in
      if (/new event this friday/i.test(titleEl.textContent)) {
        titleEl.textContent = want || 'New event posted';
      }
    });
  };
  // run now and watch for any later DOM changes
  fix();
  if (pop.__titleMO) pop.__titleMO.disconnect();
  const mo = new MutationObserver(fix);
  mo.observe(pop, { childList: true, characterData: true, subtree: true });
  pop.__titleMO = mo;
}


  // ------- rendering (text-only; full-width; no ellipsis) -------
  function renderOriginal(listEl, items) {
    listEl.innerHTML = "";
    const escAttr = (s) => String(s ?? '')
  .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
  .replace(/</g,'&lt;').replace(/>/g,'&gt;');

    if (!items || !items.length) {
      listEl.insertAdjacentHTML(
        "beforeend",
        `<div class="notif-item" role="listitem">
           <div class="notif-item__text" style="grid-column:1 / -1">
             <div class="notif-item__body" style="color:#6b7280">No notifications</div>
           </div>
         </div>`
      );
      return;
    }

    for (const n of items) {
      // Engaging copy (best effort with columns we have)
      let titleText = "Notification";
      let bodyText  = n.body || "";

    if (n.kind === "club_event") {
  // Prefer server-provided title; fall back to a neutral label
  titleText = n.title || "New event posted";
  if (!bodyText) bodyText = "Tap to view details.";
}
 else if (n.kind === "club_post") {
        titleText = "New post";
        // if your server includes the club name in title later, we’ll show it as-is
        if (n.title && n.title.toLowerCase() !== "new post") titleText = n.title;
      } else if (n.kind === "membership_request") {
        titleText = "New membership request";
      } else if (n.kind === "membership_decision") {
        titleText = "You’ve been accepted!";
        if (/declin|reject/i.test(bodyText)) titleText = "Your membership was declined";
      } else if (n.title) {
        titleText = n.title;
      }

      const url = n.url || "";
const html = `
  <div class="notif-item" role="listitem"
       ${url ? `data-href="${escAttr(url)}"` : ""}
       data-title="${escAttr(titleText)}">
    <div class="notif-item__text"
         style="min-width:0; grid-column:1 / -1;">
      <div class="notif-item__title"
           style="font-weight:600; color:#111827;
                  white-space:normal!important; overflow:visible!important; text-overflow:clip!important;
                  line-height:1.25; word-break:break-word;">
        ${titleText}
      </div>
      <div class="notif-item__body"
           style="color:#6B7280; margin-top:2px;
                  white-space:normal!important; overflow:visible!important; text-overflow:clip!important;
                  line-height:1.25; word-break:break-word;">
        ${bodyText}
      </div>
    </div>
  </div>`;

      listEl.insertAdjacentHTML("beforeend", html);
    }

    // navigate on click if URL provided
    listEl.querySelectorAll(".notif-item[data-href]").forEach((el) => {
      el.addEventListener("click", () => {
        const href = el.getAttribute("data-href");
        if (href) location.assign(href);
      });
    });
    enforceTitles(listEl.closest('#notifPopover'));
  }
  
  

  // ------- main -------
  async function startWithDOM({ bell, pop, list, badge }) {
    const { me, base } = await whoAmIAndBase();
    const uid = me?.student_id || me?.id || null;
    const qs  = "role=student" + (uid ? `&uid=${encodeURIComponent(uid)}` : "");
    const URLS = {
      count: `${base}/api/notifications/unread_count.php?${qs}`,
      list : `${base}/api/notifications/list.php?${qs}&limit=20`,
      mark : `${base}/api/notifications/mark.php`,
    };

    // Poll unread
    let last = -1;
    async function poll() {
      try {
        const { count = 0 } = await getJSON(URLS.count);
        if (count !== last) {
          last = count;
          if (count > 0) { badge.textContent = String(count); badge.hidden = false; }
          else badge.hidden = true;
        }
      } catch {}
    }
    poll();
    const t = setInterval(poll, 15000);
    window.addEventListener("unload", () => clearInterval(t));

    // open/close (original .open toggle)
    const open  = () => pop.classList.add("open");
    const close = () => pop.classList.remove("open");

    bell.addEventListener("click", async (e) => {
      e.preventDefault(); e.stopPropagation();
      const willOpen = !pop.classList.contains("open");
      if (willOpen) {
        open();
        try {
          const { items = [] } = await getJSON(URLS.list);
          renderOriginal(list, items);
          await getJSON(URLS.mark, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: "student", action: "mark_all_seen", uid }),
          });
          badge.hidden = true;
        } catch {}
      } else {
        close();
      }
    });

    document.addEventListener("click", (e) => {
      if (!pop.classList.contains("open")) return;
      if (e.target.closest("#notifPopover")) return;
      if (e.target.closest("#notifToggle") ||
          e.target.closest('.pill-nav__icon-btn[aria-label="Notifications"]')) return;
      close();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, { passive: true });
  }

  (async () => {
    const bell = await waitForBell();
    if (!bell) return;
    const env  = ensurePopoverOriginal(bell);
    startWithDOM(env);
  })();
})();
