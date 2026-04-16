// ==== Compute API base from current folder (no change to your routing) ====
document.addEventListener("DOMContentLoaded", async () => {
  await Auth.requireAuth({ roles: ["adviser"] });
});

const PROJECT_BASE = "/" + location.pathname.split("/").filter(Boolean)[0];
const API_BASE = PROJECT_BASE + "/api";

document.addEventListener("DOMContentLoaded", () => {
  // Optional: sidebar toggle if you already have the button
  document.querySelector(".sidebar-toggle-btn")?.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-expanded");
  });

  // ===== View modal refs =====
  const viewModal  = document.getElementById("viewEventModal");
  const vTitle     = document.getElementById("v-title");
  const vBanner    = document.getElementById("v-banner");
  const vClub      = document.getElementById("v-club");
  const vLocation  = document.getElementById("v-location");
  const vDate      = document.getElementById("v-date");
  const vTime      = document.getElementById("v-time");
  const vStatus    = document.getElementById("v-status");
  const vMax       = document.getElementById("v-max");
  const vDeadline  = document.getElementById("v-deadline");
  const vDesc      = document.getElementById("v-desc");

  function openViewModal(ev) {
    if (!viewModal) return;

    // Title
    vTitle.textContent = ev.title || "Event";

    // Banner
    if (ev.banner) {
      vBanner.style.backgroundImage = `url("${mediaUrl(ev.banner)}")`;
    } else {
      vBanner.style.backgroundImage = "none";
      vBanner.style.backgroundColor = "#f0f0f0";
    }

    // Meta
    vClub.textContent     = ev.club || "";
    vLocation.textContent = ev.location || "";
    vDate.textContent     = ymdToPretty(ev.date) || "";
    vTime.textContent     = timeRangePretty(ev.start_time, ev.end_time);
    vMax.textContent      = ev.max_participants ?? "";
    vDeadline.textContent = ymdToPretty(ev.reg_deadline || ev.registration_deadline || ev.deadline || "");

    // Status badge style
    const st = String(ev.status || "").trim();
    vStatus.textContent = st || "Draft";
    vStatus.className =
      "status-badge " +
      (st === "Ongoing" ? "status-ongoing" :
       st === "Upcoming" ? "status-upcoming" :
       st === "Past" ? "status-past" : "status-draft");

    // Description (read-only)
    vDesc.textContent = ev.description || "";

    // Show modal
    viewModal.classList.add("active");
  }

  function closeViewModal() {
    viewModal?.classList.remove("active");
  }

  // Close hooks: X, buttons, backdrop, Esc
  viewModal?.querySelectorAll("[data-view-close]")?.forEach(btn =>
    btn.addEventListener("click", closeViewModal)
  );
  viewModal?.addEventListener("click", (e) => {
    if (e.target === viewModal) closeViewModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && viewModal?.classList.contains("active")) closeViewModal();
  });

  // ===== Confirm Delete modal wiring =====
  const confirmDelModal = document.getElementById("confirmDeleteModal");
  const confirmDelText  = document.getElementById("confirmDeleteText");
  const confirmBtn      = confirmDelModal?.querySelector('[data-action="confirm"]');
  const cancelBtn       = confirmDelModal?.querySelector('[data-action="cancel"]');
  const closeDelBtn     = confirmDelModal?.querySelector('[data-del-close]');

  let deleteTargetId = null;

  function openConfirmDelete(id, title){
    deleteTargetId = id;
    if (confirmDelText) {
      confirmDelText.textContent = `Are you sure you want to delete “${title || "this event"}”? This action cannot be undone.`;
    }
    confirmDelModal?.classList.add("active");
  }

  function closeConfirmDelete(){
    confirmDelModal?.classList.remove("active");
    deleteTargetId = null;
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = "Yes, Delete"; }
  }

  // Open modal from table action
  document.addEventListener("click", (e) => {
    const a = e.target.closest(".action-delete");
    if (!a) return;
    e.preventDefault();

    const tr = a.closest("tr");
    const id = tr?.dataset.id;
    if (!id) return;

    const title = tr.querySelector(".event-name")?.textContent?.trim() || "";
    openConfirmDelete(id, title);
  });

  // Close actions
  closeDelBtn?.addEventListener("click", closeConfirmDelete);
  cancelBtn?.addEventListener("click", closeConfirmDelete);
  confirmDelModal?.addEventListener("click", (e)=>{ if (e.target === confirmDelModal) closeConfirmDelete(); });

  // Confirm -> call API and update table
  confirmBtn?.addEventListener("click", async () => {
    if (!deleteTargetId) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = "Deleting…";
    try {
      const fd = new FormData();
      fd.append("id", deleteTargetId);

      const res  = await fetch(API_BASE + "/events/delete.php", { method: "POST", body: fd });
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { throw new Error("Server did not return JSON.\n\n" + text); }
      if (!data.ok) throw new Error(data.error || "Delete failed.");

      if (Array.isArray(ALL)) {
        const idx = ALL.findIndex(x => String(x.id) === String(deleteTargetId));
        if (idx >= 0) ALL.splice(idx, 1);
      }
      renderTable(filterItems());
      closeConfirmDelete();
    } catch (err) {
      alert(err.message || "Error deleting event.");
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Yes, Delete";
    }
  });

  // ===== Participants modal: open/close + backend wiring (robust, no demo) =====
  const participantsModal   = document.getElementById("participantsModal");
  const participantsTbody   = document.getElementById("participantsTbody");
  const participantsTitle   = document.getElementById("participantsTitle"); // optional header text
  let currentParticipantsEventId = 0;
  let _returnFocusEl = null;
  let _isLoadingParticipants = false;

  const ehtml = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function renderParticipantsRows(rows) {
    if (!participantsTbody) return;
    if (!rows || !rows.length) {
      participantsTbody.innerHTML = `<tr class="participants-empty"><td colspan="4">No participants yet.</td></tr>`;
      return;
    }
    participantsTbody.innerHTML = rows.map(r => `
      <tr data-student-id="${ehtml(r.student_id)}">
        <td>${ehtml(r.student_id)}</td>
        <td>${ehtml(r.full_name || "")}</td>
        <td>${ehtml(r.sti_email || "")}</td>
        <td>
          <button type="button"
                  class="btn btn-secondary pm-remove"
                  data-event-id="${ehtml(String(currentParticipantsEventId))}"
                  data-student-id="${ehtml(r.student_id)}">
            Remove
          </button>
        </td>
      </tr>
    `).join("");
  }

  async function loadParticipants(eventId) {
    const n = Number(eventId);
    if (!Number.isInteger(n) || n <= 0) {
      console.warn("Participants: invalid event id", eventId);
      renderParticipantsRows([]);
      return;
    }
    const url = `${API_BASE}/events/participants/list.php?event_id=${encodeURIComponent(n)}`;
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { throw new Error(text || "Non-JSON response"); }
    if (!data.ok) throw new Error(data.error || "Failed to load participants");
    renderParticipantsRows(data.data || []);
  }

  function openParticipantsModal(eventId, titleText) {
    if (!participantsModal) return;
    _returnFocusEl = document.activeElement;
    currentParticipantsEventId = Number(eventId) || 0;

    if (participantsTitle) {
      participantsTitle.textContent = titleText ? `Participants • ${titleText}` : "Participants";
    }
    participantsModal.classList.add("active");
    participantsModal.removeAttribute("aria-hidden");

    // placeholder while fetching
    renderParticipantsRows([]);

    if (_isLoadingParticipants) return;
    if (!Number.isInteger(currentParticipantsEventId) || currentParticipantsEventId <= 0) {
      console.warn("Participants: opened without a valid event id");
      return;
    }

    _isLoadingParticipants = true;
    loadParticipants(currentParticipantsEventId)
      .catch(err => {
        console.error(err);
        renderParticipantsRows([]);
      })
      .finally(() => { _isLoadingParticipants = false; });
  }

  function closeParticipantsModal() {
    if (!participantsModal) return;
    participantsModal.classList.remove("active");
    participantsModal.setAttribute("aria-hidden", "true");
    if (_returnFocusEl && typeof _returnFocusEl.focus === "function") _returnFocusEl.focus();
    _returnFocusEl = null;
    currentParticipantsEventId = 0;
  }

  // Close hooks, backdrop, Esc
  participantsModal?.querySelectorAll("[data-part-close]")?.forEach(btn => {
    btn.addEventListener("click", closeParticipantsModal);
  });
  participantsModal?.addEventListener("click", (e) => {
    if (e.target === participantsModal) closeParticipantsModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && participantsModal?.classList.contains("active")) closeParticipantsModal();
  });

  // Open from table action (single source of truth)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".action-more");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const tr = btn.closest("tr[data-id]");
    const id = tr?.getAttribute("data-id");
    if (!id) return;
    const title = tr.querySelector(".event-name")?.textContent?.trim() || "";
    openParticipantsModal(id, title);
  });

  // Remove -> POST unregister + update UI
 // Helper: post JSON and always parse safely
async function postJSON(url, payload) {
  const res  = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch {
    console.error('Non-JSON response from', url, '\n\n', text);
    throw new Error('Server error (non-JSON). Check Console for details.');
  }

  if (!res.ok || json.ok === false) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json;
}


// Remove -> POST unregister + update UI
participantsTbody?.addEventListener('click', async (e) => {
  const b = e.target.closest('.pm-remove');
  if (!b) return;

  const eventId   = Number(b.getAttribute('data-event-id') || currentParticipantsEventId || 0);
  const studentId = b.getAttribute('data-student-id') || '';
  if (!Number.isInteger(eventId) || eventId <= 0 || !studentId) return;

  if (!confirm('Remove this participant?')) return;

  try {
    await postJSON(`${API_BASE}/events/participants/unregister.php`, {
      event_id: eventId,
      student_id: studentId
    });

    // remove row
    const row = b.closest('tr');
    row?.remove();
    if (!participantsTbody.querySelector('tr')) {
      renderParticipantsRows([]);
    }
  } catch (err) {
    alert(err.message || 'Error removing participant');
  }
});


  // Open View when clicking title or thumbnail
  document.getElementById("events-tbody")?.addEventListener("click", async (e) => {
    const hit = e.target.closest(".event-name, .thumb-placeholder");
    if (!hit) return;

    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    e.preventDefault();

    const id = tr.getAttribute("data-id");
    try {
      const ev = await fetchEvent(id);
      openViewModal(ev);
    } catch (err) {
      alert(err.message || "Failed to open event.");
      console.error(err);
    }
  });

  // ───────────── Helpers ─────────────
  const $ = (sel, root=document) => root.querySelector(sel);
  const esc = (s)=>String(s??"").replace(/[&<>"']/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  function mediaUrl(p){
    if(!p) return "";
    const raw = String(p).trim().replace(/\\/g,'/');
    if(/^https?:\/\//i.test(raw)) return raw;
    const idx = raw.indexOf("uploads/");
    const clean = idx>=0 ? raw.slice(idx) : raw.replace(/^\.?\//,'');
    return PROJECT_BASE + "/" + clean;
  }
// Load clubs from existing API and populate selects
async function fetchClubsFromAPI() {
  // Try plural then singular folder names (you said yours is in the "club" folder)
  const tries = ["/clubs/list.php?limit=500", "/club/list.php?limit=500"];

  for (const suffix of tries) {
    try {
      const res = await fetch(API_BASE + suffix, { cache: "no-store" });
      if (!res.ok) continue;
      const text = await res.text();
      let json; try { json = JSON.parse(text); } catch { continue; }
      const rows = json.items || json.data || json.rows || [];
      // Map to club names (handle different field names safely)
      const names = rows.map(r => r.name || r.club_name || r.title || r.club).filter(Boolean);
      if (names.length) {
        // Unique + sorted
        return Array.from(new Set(names)).sort((a,b) => a.localeCompare(b));
      }
    } catch {}
  }
  return [];
}

function fillSelectOptions(selectEl, names, { keepFirst = false } = {}) {
  if (!selectEl) return;
  const first = keepFirst ? selectEl.options[0] : null;
  selectEl.innerHTML = "";
  if (first) selectEl.appendChild(first);

  for (const n of names) {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    selectEl.appendChild(opt);
  }
}

async function initClubs() {
  const names = await fetchClubsFromAPI();

  // Filters: keep first "All Clubs"
  const filterSel = document.getElementById("club-select");
  if (filterSel) fillSelectOptions(filterSel, names, { keepFirst: true });

  // Create modal: keep first placeholder "Select club…"
  const createSel = document.getElementById("ev-club");
  if (createSel) fillSelectOptions(createSel, names, { keepFirst: true });

  // Edit modal: keep first placeholder "Select club..."
  const editSel = document.getElementById("edit-club");
  if (editSel) fillSelectOptions(editSel, names, { keepFirst: true });
}


  (function setupEditBannerPreview(){
    const input   = document.getElementById("edit-banner") || document.getElementById("edit-event-banner");
    const preview = document.getElementById("editBannerPreview");
    const box     = document.getElementById("editBannerBox");
    if (!input || !preview || !box) return;

    // Revoke old object URLs to avoid leaks
    function setPreview(file){
      if (preview._blobUrl) {
        URL.revokeObjectURL(preview._blobUrl);
        preview._blobUrl = null;
      }
      if (!file) {
        preview.removeAttribute("src");
        box.classList.remove("has-image");
        return;
      }
      const url = URL.createObjectURL(file);
      preview._blobUrl = url;
      preview.onload = () => {
        if (preview._blobUrl === url) URL.revokeObjectURL(url);
      };
      preview.src = url;
      box.classList.add("has-image");
    }

    input.addEventListener("change", () => {
      const f = input.files && input.files[0];
      setPreview(f || null);
    });
  })();

  function setSelectValue(id, value) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const want = String(value ?? "");
    if (!want) return;

    // If the value isn't one of the existing options, add it so the UI can show it
    if (![...sel.options].some(o => o.value === want)) {
      const opt = document.createElement("option");
      opt.value = want;
      opt.textContent = want;
      sel.appendChild(opt);
    }

    // Make sure no placeholder remains selected
    sel.querySelector('option[selected]')?.removeAttribute('selected');
    sel.value = want;
  }

  const STATUSES = ["Upcoming", "Ongoing", "Past", "Draft"];

  // Ensure a specific value exists in the select (add if missing), then select it
  function selectOrAdd(selectEl, value) {
    if (!selectEl) return;
    const want = String(value ?? "");
    if (!want) return;
    let found = Array.from(selectEl.options).some(o => o.value === want);
    if (!found) {
      const opt = document.createElement("option");
      opt.value = want;
      opt.textContent = want;
      selectEl.appendChild(opt);
    }
    selectEl.value = want;
  }

  document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("action-edit")) {
      e.preventDefault();
      const tr = e.target.closest("tr");
      const id = tr?.dataset.id;
      if (!id) return;

      try {
        const ev = await fetchEvent(id);

        // normalize field names coming from API/DB (some code used reg_deadline)
        const dateY     = ev.date || ev.ev_date || "";
        const deadlineY = ev.reg_deadline || ev.registration_deadline || ev.deadline || "";

        // Fill fields
        $("#edit-id").value        = ev.id;
        $("#edit-title").value     = ev.title || "";
        setSelectValue("edit-club",   ev.club);
        $("#edit-location").value  = ev.location || "";

        // Date
        $("#edit-date-ymd").value  = dateY;
        $("#edit-date").value      = dateY ? ymdToMdy(dateY) : "";

        // Registration deadline
        $("#edit-deadline-ymd").value = deadlineY;
        $("#edit-deadline").value     = deadlineY ? ymdToMdy(deadlineY) : "";

        // Times
        $("#edit-start").value     = ev.start_time || "";
        $("#edit-end").value       = ev.end_time || "";

        // Max + Status + Desc
        $("#edit-max").value       = String(ev.max_participants ?? "");
        setSelectValue("edit-status", ev.status);
        $("#edit-desc").value      = ev.description || "";

        // Banner preview
        const editPreview = $("#editBannerPreview");
        const editBox     = $("#editBannerBox");
        const editInput   = document.getElementById("edit-banner") || document.getElementById("edit-event-banner");

        // Clear previous file selection so choosing the same file again will fire "change"
        if (editInput) editInput.value = "";

        if (ev.banner) {
          editPreview.src = mediaUrl(ev.banner);
          editBox.classList.add("has-image");
        } else {
          editPreview.removeAttribute("src");
          editBox.classList.remove("has-image");
        }

        $("#editEventModal").classList.add("active");
      } catch (err) {
        alert("Failed to load event for editing: " + err.message);
      }
    }
  });

  // Close modal buttons
  document.querySelectorAll("[data-edit-close]").forEach(btn => {
    btn.addEventListener("click", () => {
      $("#editEventModal").classList.remove("active");
    });
  });

  // Bind date pickers for edit modal
  bindDate({ textId:"edit-date", ymdId:"edit-date-ymd", btnId:"edit-date-btn" });
  bindDate({ textId:"edit-deadline", ymdId:"edit-deadline-ymd", btnId:"edit-deadline-btn" });

  // ───────────── Date utils (strict MM/DD/YYYY <-> YYYY-MM-DD) ─────────────
  const z2 = n => String(n).padStart(2,"0");
  function isValidYMD(ymd){
    const m = String(ymd||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return false;
    const y = +m[1], mm = +m[2], dd = +m[3];
    const d = new Date(y, mm-1, dd);
    return d.getFullYear()===y && d.getMonth()===mm-1 && d.getDate()===dd;
  }
  function mdyToYmd(text) {
    const v = String(text || "").trim();
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return "";
    const mm = +m[1], dd = +m[2], yy = +m[3];
    const d = new Date(yy, mm - 1, dd);
    if (d.getFullYear() !== yy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return "";
    return `${yy}-${z2(mm)}-${z2(dd)}`;
  }
  function ymdToMdy(ymd) {
    const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return "";
    return `${+m[2]}/${+m[3]}/${m[1]}`;
  }
  function ymdToPretty(ymd){
    if(!isValidYMD(ymd)) return "";
    const [y,m,d] = ymd.split("-");
    const dt = new Date(+y, +m-1, +d);
    return dt.toLocaleDateString(undefined, { year:"numeric", month:"long", day:"numeric" });
  }
  function timeRangePretty(start, end){
    const fmt = (t)=> {
      const [hh,mm] = String(t||"").split(":");
      const d = new Date();
      d.setHours(+hh||0, +mm||0, 0, 0);
      return d.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
    };
    return `${fmt(start)} – ${fmt(end)}`;
  }

  // ───────────── Anchored native date picker (FIX) ─────────────
  // Positions the temporary <input type="date"> right under the clicked icon
  function openNativePickerAt(anchorEl, initialYmd, onPick){
    const input = document.createElement("input");
    input.type = "date";

    // Place it under the icon (viewport coordinates)
    const r = anchorEl.getBoundingClientRect();
    input.style.position = "fixed";
    input.style.left = `${Math.round(r.left)}px`;
    input.style.top  = `${Math.round(r.top)}px`;   // aligns exactly with button
    input.style.width  = "200px";                  // match your text field width
    input.style.height = `${Math.max(1, Math.round(r.height))}px`;
    input.style.opacity = "0";
    input.style.zIndex  = "2147483647";
    input.style.background = "transparent";

    if (isValidYMD(initialYmd)) input.value = initialYmd;

    const cleanup = () => input.remove();
    input.addEventListener("change", () => {
      const y = input.value;
      if (isValidYMD(y)) onPick(y);
      cleanup();
    });
    input.addEventListener("blur", () => setTimeout(cleanup, 0));

    document.body.appendChild(input);
    input.focus({ preventScroll: true });
    if (typeof input.showPicker === "function") input.showPicker();
    else input.click();
  }

  // Bind a text (MM/DD/YYYY), a hidden YYYY-MM-DD, and a calendar button
  function bindDate({ textId, ymdId, btnId }) {
    const txt = document.getElementById(textId);
    const ymd = document.getElementById(ymdId);
    const btn = document.getElementById(btnId);
    if (!txt || !ymd || !btn) return;

    // Normalize on blur
    txt.addEventListener("blur", () => {
      const y = mdyToYmd(txt.value);
      if (y) { ymd.value = y; txt.value = ymdToMdy(y); }
    });

    // Open native picker anchored to THIS button (FIX)
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const currentY = mdyToYmd(txt.value) || ymd.value || "";
      openNativePickerAt(btn, currentY, (pickedY) => {
        ymd.value = pickedY;
        txt.value = ymdToMdy(pickedY);
      });
    });
  }

  // ───────────── Filters (no HTML changes; just behavior) ─────────────
  const statusSelect = document.getElementById("status-select");
  const clubSelect   = document.getElementById("club-select");
  const eventsTbody  = document.getElementById("events-tbody");
  const emptyState   = document.getElementById("emptyState");
  const tableWrap    = document.querySelector(".events-table-container");
  const resetLink    = document.querySelector(".reset-filters");
  // Populate all club selects from DB
initClubs();

// Remove the participants modal search/toolbar (requested)
document.querySelector(".participants-toolbar")?.remove();


  // Filter date
  bindDate({ textId: "date-input", ymdId: "filter-date-ymd", btnId: "filter-date-btn" });

  resetLink?.addEventListener("click", (e)=>{
    e.preventDefault();
    if (statusSelect) statusSelect.value = "All";
    if (clubSelect)   clubSelect.value   = "All Clubs";
    const fi = $("#date-input"); const fy = $("#filter-date-ymd");
    if (fi) fi.value = "";
    if (fy) fy.value = "";
    renderTable(ALL);
  });

  // ───────────── Create modal (logic only) ─────────────
  const createBtn   = document.querySelector(".create-event-btn");
  const createModal = document.getElementById("createEventModal");
  const createClose = createModal?.querySelector(".close-btn");
  const createCancel= createModal?.querySelector("[data-ev-cancel]");
  const createForm  = document.getElementById("createEventForm");

  // Banner preview (unchanged)
  const bannerInput   = document.getElementById("event-banner");
  const bannerPreview = document.getElementById("bannerPreview");
  const bannerBox     = document.getElementById("bannerBox");
  function resetBannerPreview(){
    if (!bannerInput || !bannerPreview || !bannerBox) return;
    bannerInput.value = "";
    bannerPreview.removeAttribute("src");
    bannerBox.classList.remove("has-image");
  }
  bannerInput?.addEventListener("change", ()=>{
    const f = bannerInput.files?.[0];
    if (!f) return resetBannerPreview();
    const url = URL.createObjectURL(f);
    bannerPreview.onload = () => URL.revokeObjectURL(url);
    bannerPreview.src = url;
    bannerBox.classList.add("has-image");
  });

  const openCreate = () => createModal?.classList.add("active");
  const closeCreate= () => { createModal?.classList.remove("active"); resetBannerPreview(); };
  createBtn?.addEventListener("click", openCreate);
  createClose?.addEventListener("click", closeCreate);
  createCancel?.addEventListener("click", closeCreate);
  createModal?.addEventListener("click", (e)=>{ if (e.target === createModal) closeCreate(); });

  // Bind BOTH Create modal date fields
  bindDate({ textId:"ev-date",     ymdId:"ev-date-ymd",     btnId:"ev-date-btn" });
  bindDate({ textId:"ev-deadline", ymdId:"ev-deadline-ymd", btnId:"ev-deadline-btn" });

  // ───────────── View/Edit modals (if present) ─────────────
  function ymdToRowTime(ymd){ return ymdToPretty(ymd); }

  // ───────────── Data load + render ─────────────
  let ALL = [];

  async function fetchEvent(id){
    const res = await fetch(`${API_BASE}/events/get.php?id=${encodeURIComponent(id)}`, {cache:"no-store"});
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Failed to load event");
    return data.data;
  }

  function filterItems(){
    const wantStatus = (statusSelect?.value || "All").toLowerCase();
    const wantClub   = (clubSelect?.value   || "All Clubs").toLowerCase();
    const wantDate   = ($("#filter-date-ymd")?.value || "").trim();
    return ALL.filter(ev=>{
      if (wantStatus !== "all" && ev.status.toLowerCase() !== wantStatus) return false;
      if (wantClub   !== "all clubs" && ev.club.toLowerCase() !== wantClub) return false;
      if (wantDate && ev.date !== wantDate) return false;
      return true;
    });
  }

  function showEmpty(isEmpty){
    if (isEmpty){ emptyState?.classList.remove("hidden"); tableWrap?.classList.add("hidden"); }
    else        { emptyState?.classList.add("hidden"); tableWrap?.classList.remove("hidden"); }
  }

  function renderRow(ev){
    const datePretty = ymdToRowTime(ev.date);
    const timePretty = timeRangePretty(ev.start_time, ev.end_time);
    const created    = ev.created_at ? new Date(ev.created_at.replace(" ","T")).toLocaleString() : "";
    const imgUrl     = ev.banner ? mediaUrl(ev.banner) : "";
    const stCls =
      ev.status === "Ongoing" ? "status-ongoing" :
      ev.status === "Upcoming" ? "status-upcoming" :
      ev.status === "Past" ? "status-past" : "status-draft";

    return `
      <tr data-id="${ev.id}">
        <td>
          <div class="title-cell">
            <div class="thumb-placeholder" style="${imgUrl ? `background-image:url('${imgUrl}')` : ""}"></div>
            <span class="event-name">${esc(ev.title)}</span>
          </div>
        </td>
        <td>${esc(ev.club)}</td>
        <td>
          ${esc(datePretty)}<br>
          <span class="event-time">${esc(timePretty)}</span><br>
          <span class="created-time">Created: ${esc(created)}</span>
        </td>
        <td>${esc(ev.location)}</td>
        <td><span class="status-badge ${stCls}">${esc(ev.status)}</span></td>
        <td class="actions-cell">
          <a href="#" class="action-btn action-edit">Edit</a>
          <a href="#" class="action-btn action-delete">Delete</a>
          <a href="#" class="action-btn action-more">Participants</a>
        </td>
      </tr>
    `;
  }

  function renderTable(items){
    const tbody = document.getElementById("events-tbody");
    if (!tbody) return;
    if (!items.length){
      tbody.innerHTML = "";
      showEmpty(true);
      return;
    }
    showEmpty(false);
    tbody.innerHTML = items.map(renderRow).join("");
  }

  statusSelect?.addEventListener("change", ()=> renderTable(filterItems()));
  clubSelect?.addEventListener("change",   ()=> renderTable(filterItems()));

  async function loadEvents(){
    try{
      const res = await fetch(API_BASE + "/events/list.php", {cache:"no-store"});
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to load events");
      ALL = data.data || [];
      renderTable(ALL);
    }catch(err){
      console.error(err);
      ALL = [];
      renderTable(ALL);
    }
  }

  // ───────────── Create submit (DB-safe dates) ─────────────
  createForm?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const btn = createForm.querySelector(".btn-primary");
    btn.disabled = true; const prev = btn.textContent; btn.textContent = "Saving…";
    try {
      const fd = new FormData();
      fd.append("ev-title",   $("#ev-title").value.trim());
      fd.append("ev-club",    $("#ev-club").value.trim());
      fd.append("ev-location",$("#ev-location").value.trim());

      // Convert to YYYY-MM-DD for backend
      const dateY = mdyToYmd($("#ev-date").value);
      if (!isValidYMD(dateY)) throw new Error("Please enter a valid event date (mm/dd/yyyy).");
      fd.append("ev-date-ymd", dateY);

      fd.append("ev-start",   $("#ev-start").value);
      fd.append("ev-end",     $("#ev-end").value);
      fd.append("ev-status",  $("#ev-status").value);
      fd.append("ev-desc",    $("#ev-desc").value.trim());

      fd.append("ev-max",     $("#ev-max").value.trim());
      const dlY = mdyToYmd($("#ev-deadline").value);
      if (!isValidYMD(dlY)) throw new Error("Please enter a valid registration deadline (mm/dd/yyyy).");
      if (new Date(dlY) > new Date(dateY)) throw new Error("Registration deadline must be on or before the event date.");
      fd.append("ev-deadline-ymd", dlY);

      const bannerFile = document.getElementById("event-banner")?.files?.[0];
      if (!bannerFile) throw new Error("Please select an event banner.");
      fd.append("event_banner", bannerFile);

      const res = await fetch(API_BASE + "/events/create.php", { method:"POST", body: fd });
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { throw new Error("Server did not return JSON.\n\n" + text); }
      if (!data.ok) throw new Error(data.error || "Save failed");

      ALL.unshift(data.data);
      renderTable(filterItems());
      closeCreate();
      alert("Saved!");
    } catch (err) {
      alert(err.message || "Error saving.");
    } finally {
      btn.disabled = false; btn.textContent = prev;
    }
  });

  // ===== Edit form submit (Save Changes) =====
  const editForm = document.getElementById("editEventForm");
  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const btn = editForm.querySelector('.btn-primary[type="submit"]') || editForm.querySelector(".btn-primary");
      const restore = btn ? { t: btn.textContent, d: btn.disabled } : null;
      if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }

      try {
        // Build payload exactly as your PHP expects
        const fd = new FormData();

        // ID
        const id = document.getElementById("edit-id")?.value;
        if (!id) throw new Error("Missing event ID.");
        fd.append("id", id);

        // Text fields
        fd.append("ev-title",    document.getElementById("edit-title")?.value?.trim() || "");
        fd.append("ev-club",     document.getElementById("edit-club")?.value?.trim() || "");
        fd.append("ev-location", document.getElementById("edit-location")?.value?.trim() || "");
        fd.append("ev-status",   document.getElementById("edit-status")?.value?.trim() || "");
        fd.append("ev-desc",     document.getElementById("edit-desc")?.value?.trim() || "");

        // Times
        fd.append("ev-start",    document.getElementById("edit-start")?.value || "");
        fd.append("ev-end",      document.getElementById("edit-end")?.value || "");

        // Max participants
        fd.append("ev-max",      document.getElementById("edit-max")?.value?.trim() || "0");

        // Dates (convert mm/dd/yyyy -> yyyy-mm-dd)
        const editDateTxt = document.getElementById("edit-date")?.value || "";
        const dateY       = mdyToYmd(editDateTxt);
        if (!isValidYMD(dateY)) throw new Error("Please enter a valid event date (mm/dd/yyyy).");
        fd.append("ev-date-ymd", dateY);

        const editDeadlineTxt = document.getElementById("edit-deadline")?.value || "";
        const dlY             = mdyToYmd(editDeadlineTxt);
        if (!isValidYMD(dlY)) throw new Error("Please enter a valid registration deadline (mm/dd/yyyy).");
        if (new Date(dlY) > new Date(dateY)) throw new Error("Registration deadline must be on or before the event date.");
        fd.append("ev-deadline-ymd", dlY);

        // Optional new banner file
        const fileInput = document.getElementById("edit-banner") || document.getElementById("edit-event-banner");
        const banner = fileInput?.files?.[0];
        if (banner) fd.append("event_banner", banner);

        // Send to backend
        const res = await fetch(API_BASE + "/events/update.php", { method:"POST", body: fd });
        const text = await res.text();
        let data; try { data = JSON.parse(text); } catch { throw new Error("Server did not return JSON.\n\n" + text); }
        if (!data.ok) throw new Error(data.error || "Update failed.");

        // Update in-memory list and rerender
        if (typeof ALL !== "undefined" && Array.isArray(ALL)) {
          const idx = ALL.findIndex(x => String(x.id) === String(data.data.id));
          if (idx >= 0) ALL[idx] = data.data;
        }
        if (typeof renderTable === "function" && typeof filterItems === "function") {
          renderTable(filterItems());
        }

        // Close modal
        document.getElementById("editEventModal")?.classList.remove("active");
        alert("Changes saved!");
      } catch (err) {
        alert(err.message || "Error saving changes.");
      } finally {
        if (btn && restore) { btn.disabled = restore.d; btn.textContent = restore.t; }
      }
    });
  }

  // === SETTINGS: Save bridge (Events) — shell-compatible, reload on success ===
(() => {
  if (window.__mc_settings_save_bridge_events__) return;
  window.__mc_settings_save_bridge_events__ = true;

  // Build a relative API path so the shell shim (adviser-shell.js) can intercept
  const toApi = (path) =>
    ('api/' + String(path).replace(/^\/?api\//, '').replace(/^\/+/, '')).replace(/\/{2,}/g, '/');

  // Settings overlay node (support both shell + page ids/classes)
  const overlayNode = () =>
    document.getElementById('settingsModalOverlay') ||
    document.getElementById('settingsOverlay') ||
    document.getElementById('settingsModal') ||
    document.querySelector('.settings-modal__overlay, .settings-modal');

  // The open slot's <form>
  function currentSlotForm() {
    const ov = overlayNode();
    if (!ov) return null;
    const open = ov.querySelector('.slot.open') || ov.querySelector('.slot');
    return (open && open.querySelector('form')) || ov.querySelector('form') || null;
  }

  // Map the form to a logical field key
  function inferFieldKey(form) {
    if (!form) return '';
    const key = (form.getAttribute('data-field') || '').trim();
    if (key) return key;
    const has = (n) => !!form.querySelector(`[name="${n}"], #${n}`);
    if (has('first_name') || has('last_name')) return 'name';
    if (has('sti_email') || has('email')) return 'email';
    if (has('password') || has('new_password')) return 'password';
    if (has('nickname')) return 'nickname';
    if (has('bio')) return 'bio';
    if (has('birthdate') || has('dob')) return 'birthdate';
    if (has('about_city') || has('city') || has('town')) return 'about_city';
    if (has('contact_email')) return 'contact_email';
    return '';
  }

  // Logical field → endpoint (shell shim remaps these to your real files)
  const FIELD_MAP = {
    name:          'api/settings/update_account.php',
    email:         'api/settings/update_account.php',
    password:      'api/settings/update_account.php',
    nickname:      'api/settings/update_profile.php',
    bio:           'api/settings/update_profile.php',
    birthdate:     'api/settings/update_profile.php',
    about_city:    'api/settings/update_profile.php',
    contact_email: 'api/settings/update_profile.php',
  };

  // Simple confirm using the shell/page confirm modal if present; fallback to native confirm
  const confirmOverlay = document.getElementById('confirmModal');
  const confirmMsg     = document.getElementById('confirmMsg');
  const btnYes         = document.getElementById('btnConfirmYes');
  const btnNo          = document.getElementById('btnConfirmNo');
  function showConfirm(msg = 'Apply these changes?') {
    return new Promise((resolve) => {
      if (!confirmOverlay || !btnYes || !btnNo) return resolve(window.confirm(msg));
      if (confirmMsg) confirmMsg.textContent = msg;
      confirmOverlay.classList.add('open');
      confirmOverlay.removeAttribute('aria-hidden');
      const onNo  = () => done(false);
      const onYes = () => done(true);
      const onBack = (e) => { if (e.target === confirmOverlay) onNo(); };
      function done(v) {
        confirmOverlay.classList.remove('open');
        confirmOverlay.setAttribute('aria-hidden', 'true');
        btnYes.removeEventListener('click', onYes);
        btnNo.removeEventListener('click', onNo);
        confirmOverlay.removeEventListener('click', onBack);
        resolve(v);
      }
      btnYes.addEventListener('click', onYes, { once: true });
      btnNo.addEventListener('click', onNo, { once: true });
      confirmOverlay.addEventListener('click', onBack, { once: true });
    });
  }

  // Minimal toast
  function toast(msg, kind = 'ok') {
    let host = document.getElementById('__toastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = '__toastHost';
      host.style.cssText =
        'position:fixed;right:16px;bottom:16px;display:flex;flex-direction:column;gap:8px;pointer-events:none;z-index:2147483647';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.role = 'status';
    el.style.cssText =
      `pointer-events:auto;background:${kind === 'ok' ? '#10b981' : '#ef4444'};color:white;` +
      'padding:10px 12px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.12);' +
      'font:600 13px/1.3 system-ui,Segoe UI,Roboto,Arial;max-width:min(88vw,420px)';
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 280); }, 1400);
  }

  // ✅ The key: treat Save-like clicks inside the Settings overlay as a save action
  document.addEventListener('click', async (e) => {
    const ov = overlayNode();
    if (!ov) return;
    if (e.target.closest('#confirmModal')) return; // ignore clicks inside confirm

    // Grab a “Save” control (covers type=submit + “Save changes” buttons/links)
    const btn = e.target.closest(`
      button[type="submit"],
      .btn-primary,
      .slot-actions button,
      .slot-actions a,
      [data-action="save"],
      .save, .save-changes,
      a.btn, button.btn
    `);
    if (!btn) return;
    if (!ov.contains(btn)) return;

    const label = (btn.getAttribute('aria-label') || btn.textContent || '').trim().toLowerCase();
    const isSubmit = btn.tagName === 'BUTTON' && (btn.type || '').toLowerCase() === 'submit';
    if (!isSubmit && !label.includes('save')) return;

    const form = currentSlotForm();
    if (!form) return;

    e.preventDefault();
    e.stopPropagation();

    const field = inferFieldKey(form);
    const endpoint = FIELD_MAP[field];
    if (!endpoint) { toast('Unknown settings form.', 'err'); return; }

    const nice = {
      name: 'name', email: 'email', password: 'password',
      nickname: 'nickname', bio: 'bio', birthdate: 'birthdate',
      about_city: 'town/city', contact_email: 'contact email'
    };
    if (!(await showConfirm(`Save changes to ${nice[field] || field}?`))) return;

    const submitBtn = form.querySelector('.btn-primary, button[type="submit"]');
    const prev = submitBtn && submitBtn.textContent;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

    try {
      // Build JSON body expected by your update_* handlers
      const raw = new FormData(form);
      const body = {};
      raw.forEach((v, k) => { body[k] = v; });

      const res  = await fetch(toApi(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include'
      });
      const text = await res.text();
      let j; try { j = JSON.parse(text); } catch { j = {}; }
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `Save failed (${res.status})`);

  

      // Close overlay then hard-reload to reflect fresh settings everywhere
      ov.classList.remove('active');
      setTimeout(() => window.location.reload(), 350);
    } catch (err) {
      console.error(err);
      toast(err?.message || 'Error saving changes.', 'err');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = prev || 'Save changes'; }
    }
  });
})();


  // Initial load
  loadEvents();
});
