document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  // Auth (student only)
  await Auth.requireAuth({ roles: ["student"] });

  // ── LOGOUT CONFIRMATION ──
  const logoutLink = document.querySelector(".logout-link");
  const overlay = document.getElementById("logoutConfirmOverlay");
  if (logoutLink && overlay) {
    const btnNo = overlay.querySelector(".btn-no");
    const btnYes = overlay.querySelector(".btn-yes");
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      overlay.classList.add("active");
    });
    btnNo.addEventListener("click", () => overlay.classList.remove("active"));
    btnYes.addEventListener("click", () => (window.location.href = "index.html"));
  }

  // ── SIDEBAR TOGGLES ──
  const sidebar = document.getElementById("sidebar");
  const toggleA = document.getElementById("toggleBtn");
  const toggleB = document.getElementById("sidebarToggle");
  if (sidebar && toggleA) toggleA.addEventListener("click", () => sidebar.classList.toggle("expanded"));
  if (sidebar && toggleB) toggleB.addEventListener("click", () => sidebar.classList.toggle("expanded"));

  // ── FEATURED CLUBS (dynamic) ──
  const grid = document.getElementById("featuredClubs");
  const countEl = document.getElementById("featuredCount");
  if (!grid) return;

  // Skeletons (3 cards)
  grid.innerHTML = Array.from({ length: 3 }).map(() => skeleton()).join("");

  // API URL (works at root or under /capstone)
  const baseGuess = window.PROJECT_BASE || (location.pathname.includes("/capstone/") ? "/capstone" : "");
  const apiUrl = `${baseGuess}/api/clubs/list.php`.replace(/\/+/g, "/");

  try {
    const res = await fetch(apiUrl, { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Normalize response shape
    const clubs = (() => {
      if (Array.isArray(data)) return data;
      const keys = ["items", "clubs", "data", "results", "rows"]; // list.php returns {items:[...]}
      for (const k of keys) if (Array.isArray(data?.[k])) return data[k];
      return [];
    })();

    // Shuffle and pick 3
    const pool = [...clubs];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const top = pool.slice(0, 3);

    // Helpers
    const get = (obj, keys, fallback = "") =>
      keys.reduce((v, k) => (v != null ? v[k] : undefined), obj) ?? fallback;

    const absUrl = (u) => {
      if (!u) return "";
      if (/^(?:https?:|data:)/i.test(u)) return u;
      const path = u.startsWith("/") ? u : "/" + u;
      return (baseGuess + path).replace(/\/+/g, "/");
    };

    // "Sport Club" -> "SC", "STEM" -> "ST", "Art" -> "A"
    const initials = (name = "") => {
      const words = String(name).trim().split(/\s+/).filter(Boolean);
      if (!words.length) return "CL";
      if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
      return (words[0][0] + words[1][0]).toUpperCase();
    };

    // Render 3 large cards
    if (countEl) countEl.textContent = `${top.length} club${top.length === 1 ? "" : "s"}`;
    grid.innerHTML = top
      .map((c) => {
        const id = c.id ?? c.club_id ?? c.clubId ?? c.slug ?? "";
        const name = get(c, ["name"], get(c, ["club_name"], "Club"));
        const desc = get(c, ["description"], get(c, ["about", "details"], "No description yet."));

        // Avatar lookup (your API: profile_picture)
        const rawLogo =
          c.profile_picture ?? c.cover_picture ??
          c.pfp ?? c.pfp_url ?? c.pfpUrl ??
          c.avatar ?? c.avatar_url ?? c.avatarUrl ??
          c.photo ?? c.photo_url ?? c.photoUrl ??
          c.picture ?? c.pic ?? c.img ?? c.img_url ??
          c.logo_url ?? c.logo ?? c.image ?? c.club_logo ?? c.club_pfp;

        const logoUrl = rawLogo ? absUrl(String(rawLogo)) : "";
        const avatarHtml = logoUrl
          ? `<img class="club-card__avatar" src="${logoUrl}" alt="${name} logo">`
          : `<div class="club-card__avatar club-card__avatar--mono" aria-hidden="true">${initials(name)}</div>`;

        const members = Number(c.member_count ?? c.members ?? c.size ?? 0) || 0;
        const capacity = Number(c.capacity ?? c.limit ?? 50) || 50;
        const meta = `${members}/${capacity} members`;
        const target = id
          ? `Student-ListOfClub.html?club_id=${encodeURIComponent(id)}`
          : `Student-ListOfClub.html`;

        return `
          <article class="club-card club-card--lg">
            ${avatarHtml}
            <div class="club-card__body">
              <h3>${name}</h3>
              <p>${desc.length > 170 ? desc.slice(0, 167) + "…" : desc}</p>
              <div class="club-card__meta">${meta}</div>
              <a href="${target}" class="club-card__btn">Learn More</a>
            </div>
          </article>
        `;
      })
      .join("");

    // Empty state
    if (!top.length) {
      grid.innerHTML = `
        <div class="club-card">
          <h3>No clubs yet</h3>
          <p>Clubs will appear here once created by advisers.</p>
          <a href="Student-ListOfClub.html" class="club-card__btn">Browse Clubs</a>
        </div>`;
      if (countEl) countEl.textContent = "0 clubs";
    }
  } catch (e) {
    console.error("[Featured Clubs] load failed:", e);
    grid.innerHTML = `
      <div class="club-card">
        <h3>Couldn’t load clubs</h3>
        <p>Please try again later.</p>
        <a href="Student-ListOfClub.html" class="club-card__btn">View All</a>
      </div>`;
    if (countEl) countEl.textContent = "0 clubs";
  }

  // Skeleton card template
  function skeleton() {
    return `
      <div class="club-card skel-card club-card--lg">
        <div class="skel skel-img" style="width:72px;height:72px;border-radius:12px;"></div>
        <div class="club-card__body" style="flex:1">
          <div class="skel skel-line" style="width:40%;height:14px"></div>
          <div class="skel skel-line" style="width:95%;height:14px"></div>
          <div class="skel skel-line" style="width:60%;height:14px"></div>
          <div class="skel skel-btn"  style="width:120px;height:36px;border-radius:6px"></div>
        </div>
      </div>`;
  }
});
