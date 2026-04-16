// ==== Compute API base from current folder ====
document.addEventListener("DOMContentLoaded", async () => {
  await Auth.requireAuth({ roles: ["adviser"] });
});



const PROJECT_BASE = "/" + location.pathname.split("/").filter(Boolean)[0];
const API_BASE = PROJECT_BASE + "/api";

// --- resilient POST helper (tries multiple endpoints) ---
async function postToFirstWorking(paths, body) {
  let lastText = '';
  for (const p of paths) {
    try {
      const res = await fetch(p, { method: 'POST', body });
      const text = await res.text();
      lastText = text;
      try {
        const j = JSON.parse(text);
        if (res.ok && j && (j.ok === true || j.success === true)) return j;
        // some APIs return {data:...} without ok:true; accept 2xx + presence of data
        if (res.ok && (j.data || j.item || j.id)) return j;
        // else fall through to next path
      } catch {
        // not JSON → fall through
      }
    } catch {}
  }
  throw new Error('All save endpoints failed.\nLast response:\n' + (lastText || '(no response)'));
}


document.addEventListener("DOMContentLoaded", () => {
  // Sidebar expand/collapse
  const toggleBtn = document.querySelector(".sidebar-toggle-btn");
  toggleBtn?.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-expanded");
  });

  // Core nodes
  const createBtn = document.querySelector(".create-news-btn");
  const createModal = document.getElementById("createNewsModal");
  const tbody = document.getElementById("content-tbody");
  const tableContainer = document.querySelector(".news-table-container");
  const emptyState = document.getElementById("emptyState");

  // === FILTERS ===
  const statusSelect = document.getElementById("status-select");
  const typeSelect   = document.getElementById("type-select");
  const clubSelect   = document.getElementById("club-select");
  const dateInput    = document.getElementById("date-input");
  const resetLink    = document.querySelector(".reset-filters");

// === CLUB DROPDOWNS (filter + create + edit) ===
const createClubSelect = document.getElementById("news-club");
const editClubSelect   = document.getElementById("edit-club");

function makeOption(value, label = value) {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = label;
  return o;
}
function ensureOption(select, value) {
  if (!select || !value) return;
  const exists = Array.from(select.options).some(op => op.value === value);
  if (!exists) select.appendChild(makeOption(value));
}
function fillSelectWithClubs(rows) {
  // Normalize → array of strings (club names), sorted
  const names = Array.from(
    new Set(
      rows
        .map(c => c && (c.name || c.club_name || c.title || c.club))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  // Filter select: keep “All Clubs”
  if (clubSelect) {
    const prev = clubSelect.value;
    clubSelect.innerHTML = "";
    clubSelect.appendChild(makeOption("All Clubs", "All Clubs"));
    names.forEach(n => clubSelect.appendChild(makeOption(n)));
    if (prev && prev !== "All Clubs") clubSelect.value = prev;
  }

  // Create & Edit selects: show placeholder + clubs
  [createClubSelect, editClubSelect].forEach(sel => {
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = "";
    const ph = makeOption("", "Select club…");
    ph.disabled = true; ph.selected = true;
    sel.appendChild(ph);
    names.forEach(n => sel.appendChild(makeOption(n)));
    if (prev) { ensureOption(sel, prev); sel.value = prev; }
  });
}

async function loadClubs() {
  // 1) Try the dedicated clubs API
  try {
    const res  = await fetch(`${API_BASE}/clubs/list.php?limit=1000`, { cache: "no-store" });
    const text = await res.text();
    let j; try { j = JSON.parse(text); } catch { throw new Error(text || "Bad JSON"); }
    if (!res.ok || j?.ok === false) throw new Error(j?.error || "Failed to load clubs");
    const rows = j.items || j.data || j.rows || j.clubs || [];
    fillSelectWithClubs(rows);
    return;
  } catch (e) {
    console.warn("clubs/list.php failed, falling back to content list:", e);
  }

  // 2) Fallback: build list from distinct clubs in content
  try {
    const res  = await fetch(`${API_BASE}/content/list.php`, { cache: "no-store" });
    const text = await res.text();
    let j; try { j = JSON.parse(text); } catch { throw new Error(text || "Bad JSON"); }
    const rows = (j.items || j.data || j.rows || []).map(r => ({ club: r.club }));
    fillSelectWithClubs(rows);
  } catch (e2) {
    console.error("Fallback from content/list.php failed:", e2);
    // Leave whatever is in HTML so page still works.
  }
}

// kick off on page load
loadClubs();


  // Hidden native date input + calendar button
  const dateHidden   = document.getElementById("date-hidden");
  const calendarBtn  = document.querySelector(".calendar-btn");

  // Helpers
// Put the selected club into FormData safely (no duplicates/overwrites)
// If the option has no value, fall back to its label/text.
// Put the selected club into FormData safely (no duplicates/overwrites)
// If the option has no value, fall back to its label/text.
function setClubOn(fd, value, el) {
  // write all common server-side variants
  const keys = ["news-club", "news_club", "club", "club_name", "clubName"];
  keys.forEach(k => fd.delete(k));

  let v = (value == null ? "" : String(value).trim());
  if (!v && el && el.selectedIndex > 0) {
    const opt = el.options[el.selectedIndex];
    v = (opt?.value?.trim() || opt?.text?.trim() || "");
  }
  keys.forEach(k => fd.set(k, v));
}




  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]);

  const fileURL = (p) => {
    if (!p) return '';
    const raw = String(p).trim().replace(/\\/g, '/'); // normalize backslashes (Windows)
    if (/^https?:\/\//i.test(raw)) return raw;        // absolute -> keep
    if (raw.startsWith(PROJECT_BASE + '/')) return raw;

    // find "uploads/..." wherever it is and prefix with PROJECT_BASE
    const idx = raw.indexOf('uploads/');
    const clean = idx >= 0 ? raw.slice(idx) : raw.replace(/^\.?\//, '');
    return PROJECT_BASE + '/' + clean;
  };

  function buildMediaUrl(p) {
    if (!p) return '';
    const raw = String(p).trim();

    // Absolute URL? use as-is
    if (/^https?:\/\//i.test(raw)) return raw;

    // If it's already prefixed with the project base, keep it
    if (raw.startsWith(PROJECT_BASE + '/')) return raw;

    // Normalize to a relative "uploads/..." path
    const idx = raw.indexOf('uploads/');
    const clean = (idx >= 0 ? raw.slice(idx) : raw.replace(/^\.?\//, ''));

    return PROJECT_BASE + '/' + clean;
  }

  async function fetchItem(id) {
    const res = await fetch(`${API_BASE}/content/get.php?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Failed to load item");
    return data.data;
  }

  function updateRowInTable(item) {
    const idx = ALL_ITEMS.findIndex((x) => String(x.id) === String(item.id));
    if (idx >= 0) ALL_ITEMS[idx] = item;
    renderTable(filterItems());
  }

  // ---------- VIEW MODAL ----------
  const viewModal   = $("#viewContentModal");
  const viewCloseBtn = $("[data-view-close]", viewModal); // e.g., a footer "Close" button
  const viewCloseX   = $(".close-btn", viewModal);        // the top-right × button

  // Open modal when clicking title, thumbnail, or the title-cell area
  tbody?.addEventListener("click", async (e) => {
    const row = e.target.closest("tr[data-id]");
    if (!row) return;

    const hitTitle = e.target.closest(".news-title");
    const hitThumb = e.target.closest(".thumb-placeholder");
    const hitCell  = e.target.closest(".title-cell");

    if (hitTitle || hitThumb || hitCell) {
      e.preventDefault();
      try {
        const item = await fetchItem(row.getAttribute("data-id"));
        openViewModal(item);
      } catch (err) {
        alert(err.message || "Failed to load item.");
        console.error(err);
      }
    }
  });

  // ===== Pretty date/time for News rows & view =====
  function fmtTime(t) {
    if (!t) return "";
    // Accept "HH:MM[:SS]" -> format as h:mm AM/PM
    const [hh, mm] = String(t).split(":");
    const d = new Date();
    d.setHours(+hh || 0, +mm || 0, 0, 0);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  function formatNewsDate(item) {
    // Created: "M/D/YYYY, h:mm:ss AM/PM"
    const created = item.created_at ? new Date(item.created_at.replace(" ","T")) : null;
    const createdStr = created
      ? created.toLocaleString("en-US", { year:"numeric", month:"numeric", day:"numeric", hour:"numeric", minute:"2-digit", second:"2-digit", hour12:true })
      : "";

    // Optional "event-like" main date/time if present
    let main = "";
    if (item.date) {
      const d = new Date(item.date + "T00:00:00");
      const dateStr = d.toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
      const startStr = fmtTime(item.start_time);
      const endStr   = fmtTime(item.end_time);
      const timeLine = (startStr && endStr) ? `${startStr} – ${endStr}` : (startStr || endStr || "");
      main = timeLine ? `${dateStr}\n${timeLine}` : `${dateStr}`;
    }
    const lines = [];
    if (main) lines.push(main);
    if (createdStr) lines.push(`Created: ${createdStr}`);
    return lines.join("\n");
  }
  // Pretty "Month Day, Year, Time" (uses en-US month name, 12-hour time with seconds)
  function formatMonthDayYearTime(input) {
    const d = input instanceof Date ? input : new Date(String(input || "").replace(" ", "T"));
    if (isNaN(d)) return "";
    return d.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  }

  function openViewModal(item) {
    try {
      const modal = document.getElementById("viewContentModal");
      if (!modal) { console.error("Missing #viewContentModal"); return; }

      const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(val ?? "");
      };
      const setHTML = (id, html) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = String(html ?? "");
      };

      // Title
      setText("view-title", item?.title || "Post");

      // Banner
      const imgBox = document.getElementById("view-image");
      if (imgBox) {
        const img = item?.featured_image ? fileURL(item.featured_image) : "";
        imgBox.style.background = img
          ? `#f0f0f0 url("${img}") center/cover no-repeat`
          : "#f0f0f0";
      }

      // Meta
      setText("view-type", item?.type || "News");

      const statusEl = document.getElementById("view-status");
      const statusText = item?.status || "Draft";
      if (statusEl) {
        statusEl.textContent = statusText;
        statusEl.className = "status-badge " + (statusText === "Published" ? "status-published" : "status-draft");
      }

      setText("view-club",   item?.club   || "");
      setText("view-author", item?.author || "");
      setText("view-date",   item?.created_at ? formatMonthDayYearTime(item.created_at) : "");

      // Content (supports HTML or plain text)
      const rawContent = String(item?.content_html ?? item?.content ?? item?.news_content ?? item?.body ?? "").trim();
      if (rawContent) {
        setHTML("view-content", rawContent);
      } else {
        setHTML("view-content", "<em>No content available</em>");
      }

      // Show modal (force visible to avoid CSS conflicts)
      modal.classList.add("active");
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
    } catch (err) {
      console.error("openViewModal failed:", err);
      alert("Unable to open item. Check console for details.");
    }
  }

  // CLOSE: ensure we undo inline display so CSS can hide it again
  function closeViewModal() {
    if (!viewModal) return;
    viewModal.classList.remove("active");
    viewModal.style.removeProperty("display");
    viewModal.setAttribute("aria-hidden", "true");
  }
  // Wire close handlers
  viewCloseBtn?.addEventListener("click", closeViewModal);
  viewCloseX?.addEventListener("click", closeViewModal);
  viewModal?.addEventListener("click", (e) => {
    if (e.target === viewModal) closeViewModal(); // overlay click
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && viewModal?.classList.contains("active")) closeViewModal();
  });

  // ---------- EDIT MODAL ----------
  const editModal = $("#editContentModal");
  const editForm = $("#editContentForm");
  const editInput = $("#edit-image");
  const editPreview = $("#editFilePreview");
  const editUploadBox = $("#editUploadBox");

  editInput?.addEventListener("change", () => {
    const f = editInput.files && editInput.files[0];
    if (!f) {
      editPreview.removeAttribute("src");
      editPreview.style.display = "none";
      editUploadBox.classList.remove("has-image");
      return;
    }
    const u = URL.createObjectURL(f);
    editPreview.onload = () => URL.revokeObjectURL(u);
    editPreview.src = u;
    editPreview.style.display = "block";
    editUploadBox.classList.add("has-image");
  });

  function fillEditForm(item) {
    $("#edit-id").value = item.id;
    $("#edit-title").value = item.title || "";
    $("#edit-type").value = item.type || "News";
ensureOption($("#edit-club"), item.club);
$("#edit-club").value = item.club || "";

    $("#edit-status").value = item.status || "Draft";
    $("#edit-author").value = item.author || "";
    $("#edit-content").value = item.content || "";

    editInput.value = "";
    if (item.featured_image) {
      const url = PROJECT_BASE + "/" + item.featured_image;
      editPreview.src = url;
      editPreview.style.display = "block";
      editUploadBox.classList.add("has-image");
    } else {
      editPreview.removeAttribute("src");
      editPreview.style.display = "none";
      editUploadBox.classList.remove("has-image");
    }
  }

  function openEditModal(item) {
    fillEditForm(item);
    editModal.classList.add("active");
  }
  function closeEditModal() {
    editModal?.classList.remove("active");
  }
  $("[data-edit-cancel]")?.addEventListener("click", closeEditModal);
  $(".close-btn", editModal)?.addEventListener("click", closeEditModal);
  editModal?.addEventListener("click", (e) => {
    if (e.target === editModal) closeEditModal();
  });

  // Open Edit on click
  tbody?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".action-edit");
    if (!btn) return;
    e.preventDefault();
    const row = e.target.closest("tr");
    if (!row) return;
    try {
      const item = await fetchItem(row.getAttribute("data-id"));
      openEditModal(item);
    } catch (err) {
      alert(err.message || "Failed to open editor.");
      console.error(err);
    }
  });

  // Submit edit (POST to /api/content/update.php)
editForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = editForm.querySelector(".btn-primary");
  submitBtn.disabled = true;
  const prev = submitBtn.textContent;
  submitBtn.textContent = "Saving…";
  try {
    const fd = new FormData(editForm);
    // also send `club` for backends that expect it
const clubVal = editForm.querySelector('#edit-club')?.value || '';
fd.set('news-club', clubVal);   // keep the original field
fd.set('club', clubVal);        // add alias the server might read
fd.set('id', document.getElementById('edit-id')?.value || '');
    // Get the club select element inside the edit form
    const clubEl2 = editForm.querySelector('#edit-club,[name="news-club"]');
    const clubVal2 = clubEl2 ? clubEl2.value.trim() : "";

    console.log('editClubSelect element:', clubEl2);
    console.log('clubVal2:', clubVal2);

    // Normalize and set club keys in FormData
    setClubOn(fd, clubVal2, clubEl2);

    console.debug('UPDATE club keys:', Array.from(fd.entries()).filter(([k]) => k.includes('club')));

    // server should keep the old image if no new file sent
    const updatePaths = [
      API_BASE + "/content/update.php",
    ];
    const data = await postToFirstWorking(updatePaths, fd);

    updateRowInTable(data.data);
    closeEditModal();
    alert("Updated!");
  } catch (err) {
    alert(err.message || "Error updating.");
    console.error(err);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = prev;
  }
});

  // ===== Data + Filters =====
  let ALL_ITEMS = [];

  // Date helpers
  function parseMDY(s) {
    if (!s) return null;
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const dt = new Date(+m[3], +m[1] - 1, +m[2]);
    if (dt.getFullYear() !== +m[3] || dt.getMonth() !== +m[1] - 1 || dt.getDate() !== +m[2])
      return null;
    return dt;
  }
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const ymdToMdy = (ymd) =>
    !ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)
      ? ""
      : (() => {
          const [y, m, d] = ymd.split("-");
          return `${+m}/${+d}/${y}`;
        })();

  const mdyToYmd = (mdy) => {
    const m = mdy && mdy.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return "";
    return `${m[3]}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`;
  };

  // Calendar: open native picker *under* the button
  if (calendarBtn && dateHidden && dateInput) {
    const prefillHiddenFromText = () => {
      const ymd = mdyToYmd(dateInput.value.trim());
      if (ymd) dateHidden.value = ymd;
    };
    calendarBtn.addEventListener("click", () => {
      prefillHiddenFromText();
      if (typeof dateHidden.showPicker === "function") {
        dateHidden.showPicker();
      } else {
        dateHidden.focus();
        dateHidden.click();
      }
    });
    dateHidden.addEventListener("change", () => {
      dateInput.value = ymdToMdy(dateHidden.value);
      renderTable(filterItems());
    });
    dateInput.addEventListener("blur", () => {
      const v = dateInput.value.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        dateInput.value = ymdToMdy(v);
        dateHidden.value = v;
        renderTable(filterItems());
      }
    });
  }

  function filterItems() {
    const wantStatus = (statusSelect?.value || "All").trim().toLowerCase();
    const wantType = (typeSelect?.value || "All").trim().toLowerCase();
    const wantClub = (clubSelect?.value || "All Clubs").trim().toLowerCase();
    const wantDate = parseMDY((dateInput?.value || "").trim());

    return ALL_ITEMS.filter((item) => {
      if (wantStatus !== "all" && String(item.status || "").toLowerCase() !== wantStatus)
        return false;
      if (wantType !== "all" && String(item.type || "").toLowerCase() !== wantType) return false;
      if (wantClub !== "all clubs" && String(item.club || "").toLowerCase() !== wantClub)
        return false;
      if (wantDate) {
        const created = item.created_at ? new Date(item.created_at.replace(" ", "T")) : null;
        if (!created || !sameDay(created, wantDate)) return false;
      }
      return true;
    });
  }

  function renderTable(items) {
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#666; padding:1rem;">No results found</td></tr>`;
      return;
    }
    tbody.innerHTML = items.map(renderRow).join("");
  }

  statusSelect?.addEventListener("change", () => renderTable(filterItems()));
  typeSelect?.addEventListener("change", () => renderTable(filterItems()));
  clubSelect?.addEventListener("change", () => renderTable(filterItems()));
  dateInput?.addEventListener("change", () => renderTable(filterItems()));
  calendarBtn?.addEventListener("click", () => dateInput?.focus());

  // Reset filters
  resetLink?.addEventListener("click", (e) => {
    e.preventDefault();
    if (statusSelect) statusSelect.value = "All";
    if (typeSelect) typeSelect.value = "All";
    if (clubSelect) clubSelect.value = "All Clubs";
    if (dateInput) dateInput.value = "";
    if (dateHidden) dateHidden.value = "";
    renderTable(ALL_ITEMS);
  });

  function showEmpty(isEmpty) {
    if (isEmpty) {
      tableContainer?.classList.add("hidden");
      emptyState?.classList.remove("hidden");
    } else {
      tableContainer?.classList.remove("hidden");
      emptyState?.classList.add("hidden");
    }
  }

  function renderRow(item) {
    // Month Day, Year, Time (e.g., August 28, 2025, 4:08:11 AM)
    const nice = item.created_at ? formatMonthDayYearTime(item.created_at) : "";
    const type = esc(item.type || "News");
    const statusCls = item.status === "Published" ? "status-published" : "status-draft";
    const imgUrl = item.featured_image ? fileURL(item.featured_image) : '';

    return `
      <tr class="news-row" data-id="${item.id}">
        <td>
          <div class="title-cell">
            <div class="thumb-placeholder" style="${imgUrl ? `background-image:url('${imgUrl}')` : ""}"></div>
            <span class="type-badge" title="Type">${type}</span>
            <span class="news-title">${esc(item.title)}</span>
          </div>
        </td>
        <td>${esc(item.club)}</td>
        <td>${esc(item.author)}</td>
        <td>${nice}</td>
        <td><span class="status-badge ${statusCls}">${esc(item.status)}</span></td>
        <td>
          <a href="#" class="action-btn action-edit">Edit</a>
          <a href="#" class="action-btn action-delete">Delete</a>
        </td>
      </tr>
    `;
  }

  // ---------- CREATE MODAL ----------
  function closeCreateModal() {
    createModal?.classList.remove("active");
    resetPreview();
  }

  if (createBtn && createModal) {
    const closeButtons = createModal.querySelectorAll(".close-btn");
    createBtn.addEventListener("click", () => {
      createModal.classList.add("active");
      sizePreviewBox(); // size image box if a preview is already present
    });
    closeButtons.forEach((btn) => btn.addEventListener("click", closeCreateModal));
    (createModal.querySelector(".modal-cancel-btn") ||
      createModal.querySelector(".modal-actions .btn-secondary"))
      ?.addEventListener("click", closeCreateModal);
    createModal.addEventListener("click", (e) => {
      if (e.target === createModal) closeCreateModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && createModal.classList.contains("active")) closeCreateModal();
    });
  }

  // Image preview (create)
  const fileInput = document.getElementById("news-image");
  const filePreviewImg = document.getElementById("filePreview");
  const uploadBox = document.getElementById("uploadBox");
  let naturalW = null, naturalH = null;

  function resetPreview() {
    if (fileInput) fileInput.value = "";
    if (filePreviewImg) {
      filePreviewImg.removeAttribute("src");
      filePreviewImg.style.display = "none";
    }
    if (uploadBox) {
      uploadBox.classList.remove("has-image");
      uploadBox.style.width = "";
      uploadBox.style.height = "";
    }
    naturalW = naturalH = null;
  }
  function getMaxBox() {
    const parent = uploadBox?.parentElement;
    const parentW = parent ? parent.clientWidth : 600;
    const maxW = Math.min(640, parentW);
    const maxH = Math.min(Math.floor(window.innerHeight * 0.6), 700);
    return { maxW: Math.max(280, maxW), maxH: Math.max(160, maxH) };
  }
  function sizePreviewBox() {
    if (!uploadBox || !filePreviewImg || !naturalW || !naturalH) return;
    const { maxW, maxH } = getMaxBox();
    const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
    const w = Math.max(1, Math.floor(naturalW * scale));
    const h = Math.max(1, Math.floor(naturalH * scale));
    uploadBox.style.width = w + "px";
    uploadBox.style.height = h + "px";
    filePreviewImg.style.display = "block";
    filePreviewImg.style.width = "100%";
    filePreviewImg.style.height = "100%";
    filePreviewImg.style.objectFit = "contain";
  }
  let resizeT = null;
  window.addEventListener("resize", () => {
    if (!uploadBox || !uploadBox.classList.contains("has-image")) return;
    clearTimeout(resizeT);
    resizeT = setTimeout(sizePreviewBox, 120);
  });
  if (fileInput && filePreviewImg && uploadBox) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        filePreviewImg.removeAttribute("src");
        filePreviewImg.style.display = "none";
        uploadBox.classList.remove("has-image");
        uploadBox.style.width = "";
        uploadBox.style.height = "";
        naturalW = naturalH = null;
        return;
      }
      const url = URL.createObjectURL(file);
      filePreviewImg.onload = () => {
        naturalW = filePreviewImg.naturalWidth || filePreviewImg.width;
        naturalH = filePreviewImg.naturalHeight || filePreviewImg.height;
        sizePreviewBox();
        URL.revokeObjectURL(url);
      };
      filePreviewImg.src = url;
      uploadBox.classList.add("has-image");
    });
  }

  // ---------- Submit: save new content (robust mapping) ----------
const form = document.getElementById("createNewsForm");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const submitBtn = form.querySelector(".btn-primary");
    const fileInputField = form.querySelector("#news-image");

    if (!fileInputField?.files || !fileInputField.files[0]) {
      alert("Please select a Featured Image before saving.");
      fileInputField?.focus();
      return;
    }

    submitBtn.disabled = true;
    const prevLabel = submitBtn.textContent;
    submitBtn.textContent = "Saving…";

    try {
      // Original data from form
      // Use the form's own FormData so browser includes exactly what's selected
      const fd  = new FormData(form);

      // Normalize/force club to be non-empty and set common aliases
      (() => {
        const el = form.querySelector('#news-club,[name="news-club"]');
        let v = el ? el.value : "";
        if (!v && el && el.selectedIndex >= 0) {
          const opt = el.options[el.selectedIndex];
          v = (opt?.value || opt?.text || "").trim();
        }
        // set both common keys; set() overwrites any existing value
        fd.set("news-club", v);
        fd.set("club",      v);
      })();

      // (Optional, for visibility while testing)
      console.debug('CREATE payload club:', fd.get('news-club'), fd.get('club'));

      // ... rest of your code





   

        // Try several likely endpoints until one works
const createPaths = [
  API_BASE + "/content/create.php",
  API_BASE + "/content/save.php",
  API_BASE + "/content/add.php",
  API_BASE + "/content_management/create.php",
  API_BASE + "/content_management/save.php",
  API_BASE + "/content.php?action=create"
];
const data = await postToFirstWorking(createPaths, fd);


        // Ensure table visible (in case it was empty)
        showEmpty(false);

        // Prepend the new row
        const html = renderRow(data.data);
        tbody.insertAdjacentHTML("afterbegin", html);

        // Reset & close
        form.reset();
        resetPreview();
        createModal?.classList.remove("active");
        alert("Saved!");
      } catch (err) {
        console.error(err);
        alert(err.message || "Error saving.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = prevLabel;
      }
    });
  }

  // ---------- Load existing content from DB ----------
  async function loadContent() {
    try {
      const res = await fetch(API_BASE + "/content/list.php", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to load");

      ALL_ITEMS = data.data || [];
      if (!ALL_ITEMS.length) {
        tbody.innerHTML = "";
        showEmpty(true);
        return;
      }
      showEmpty(false);
      renderTable(ALL_ITEMS);
    } catch (err) {
      console.error(err);
      tbody.innerHTML = "";
      showEmpty(true);
    }
  }

  // ---------- Delete: confirm modal + API ----------
  const confirmModal = document.getElementById("confirmDeleteModal");

  // Safety: ensure it's closed on load/refresh
  if (confirmModal) {
    confirmModal.classList.remove("active");
    delete confirmModal._targetRow;
    delete confirmModal.dataset.id;
  }

  tbody?.addEventListener("click", (e) => {
    const del = e.target.closest(".action-delete");
    if (!del) return;
    e.preventDefault();
    const row = e.target.closest("tr");
    if (!row) return;
    confirmModal.classList.add("active");
    confirmModal._targetRow = row;
    confirmModal.dataset.id = row.getAttribute("data-id") || "";
  });

  if (confirmModal) {
    const cancel = confirmModal.querySelector('[data-action="cancel"]');
    const confirm = confirmModal.querySelector('[data-action="confirm"]');
    const closeX = confirmModal.querySelector(".close-btn");

    const closeConfirm = () => confirmModal.classList.remove("active");
    cancel?.addEventListener("click", closeConfirm);
    closeX?.addEventListener("click", closeConfirm);
    confirmModal.addEventListener("click", (e) => {
      if (e.target === confirmModal) closeConfirm();
    });

    confirm?.addEventListener("click", async () => {
      const row = confirmModal._targetRow;
      if (!row) return closeConfirm();
      const id = row.getAttribute("data-id");

      try {
        const fd = new FormData();
        fd.append("id", id);
        const res = await fetch(API_BASE + "/content/delete.php", { method: "POST", body: fd });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Delete failed");

        row.remove();
        if (tbody.querySelectorAll("tr").length === 0) showEmpty(true);
      } catch (err) {
        alert(err.message || "Error deleting.");
        console.error(err);
      } finally {
        closeConfirm();
      }
    });
  }

  // ---------- Logout modal ----------
  const logoutLink = document.querySelector(".logout-link");
  const logoutOverlay = document.getElementById("logoutConfirmOverlay");

  if (logoutLink && logoutOverlay) {
    const btnNo = logoutOverlay.querySelector(".btn-no");
    const btnYes = logoutOverlay.querySelector(".btn-yes");

    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      logoutOverlay.classList.add("active");
    });

    btnNo?.addEventListener("click", () => logoutOverlay.classList.remove("active"));
    btnYes?.addEventListener("click", () => {
      window.location.href = "index.html";
    });

    logoutOverlay.addEventListener("click", (e) => {
      if (e.target === logoutOverlay) logoutOverlay.classList.remove("active");
    });
  }
// === SETTINGS: Save bridge (v5 — shell-compatible, with fresh repopulate) ===
(() => {
  if (window.__mc_settings_save_bridge_v5__) return;
  window.__mc_settings_save_bridge_v5__ = true;

  // Build a relative API path so the shell's fetch shim can intercept (api/…)
  const toApi = (path) =>
    ('api/' + String(path).replace(/^\/?api\//, '').replace(/^\/+/, '')).replace(/\/{2,}/g, '/');

  // Try common IDs/classes for your Settings overlay
  const overlayNode = () =>
    document.getElementById('settingsModalOverlay') ||
    document.getElementById('settingsOverlay') ||
    document.getElementById('settingsModal') ||
    document.querySelector('.settings-modal__overlay, .settings-modal');

  // Find the currently open slot form inside the overlay
  function currentSlotForm() {
    const ov = overlayNode();
    if (!ov) return null;
    const openSlot = ov.querySelector('.slot.open') || ov.querySelector('.slot');
    return (openSlot && openSlot.querySelector('form')) || ov.querySelector('form') || null;
  }

  

  // Heuristic: infer which field the form is editing
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

  // Map logical field → endpoint
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

  // Confirm modal support (falls back to window.confirm)
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
      const onNo = () => done(false);
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
        'position:fixed;right:16px;bottom:16px;display:flex;flex-direction:column;gap:8px;pointer-events:none;z-index:99999';
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
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 1600);
  }

// Replace your existing fetchProfileFresh (or similar) with this:
async function fetchProfileFresh() {
  const url = toApi('api/settings/get_profile.php');
  const res = await fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' } });
  const text = await res.text();
  let j; try { j = JSON.parse(text); } catch { throw new Error(text || 'Bad JSON'); }

  if (!res.ok || j?.ok !== true) {
    throw new Error(j?.error || `Profile fetch failed (${res.status})`);
  }

  // ✅ Unwrap the server payload correctly (your endpoint returns { ok:true, item:{...} })
  return j.item || j.data || j.profile || j.me || j;
}


function fillFormWithProfile(form, profile) {
  if (!form || !profile) return;

  const set = (name, value='') => {
    const el = form.querySelector(`[name="${name}"]`) || form.querySelector('#' + name);
    if (!el) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if (el.type === 'date' && value) {
        const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
        el.value = m ? `${m[1]}-${m[2]}-${m[3]}` : '';
      } else {
        el.value = (value == null) ? '' : String(value);
      }
    } else {
      el.textContent = (value == null) ? '' : String(value);
    }
  };


  // Standard fields
  set('first_name',     profile.first_name);
  set('middle_name',    profile.middle_name);
  set('last_name',      profile.last_name);
  set('sti_email',      profile.sti_email || profile.email);
  set('nickname',       profile.nickname);
  set('bio',            profile.bio);
  set('birthdate',      profile.birthdate || profile.dob);
  set('about_city',     profile.about_city || profile.city || profile.town);
  set('contact_email',  profile.contact_email);

  // ✅ Adviser ID (multiple fallbacks: adviser_id → id → adviser.id → adviserId)
 const advId =
    profile.adviser_id ??
    profile.id ??
    (profile.adviser && profile.adviser.id) ??
    profile.adviserId ??
    null;

  set('adviser_id', advId ?? '');
  set('adviserId',  advId ?? ''); // in case your input uses this id/name
}


  function updateSlotPreview(slot, form) {
    if (!slot || !form) return;
    const preview = slot.querySelector('[data-preview], .current-value, .slot__summary');
    if (!preview) return;
    const nick = form.querySelector('[name="nickname"]')?.value?.trim();
    const fn   = form.querySelector('[name="first_name"]')?.value?.trim();
    const ln   = form.querySelector('[name="last_name"]')?.value?.trim();
    const mail = form.querySelector('[name="sti_email"], [name="email"]')?.value?.trim();
    const city = form.querySelector('[name="about_city"], [name="city"], [name="town"]')?.value?.trim();
    const fullName = [fn, ln].filter(Boolean).join(' ').trim();
    preview.textContent = nick || fullName || mail || city || 'Updated';
  }

  // CLICK: treat Save-like controls inside the Settings overlay as Save
  document.addEventListener('click', async (e) => {
    // If settings overlay isn't present, skip
    const ov = overlayNode();
    if (!ov) return;

    // Ignore clicks inside the confirm modal itself
    if (e.target.closest('#confirmModal')) return;

    // Find a Save-ish button
    const btn = e.target.closest(`
      button[type="submit"],
      .btn-primary,
      .slot-actions button,
      .slot-actions a,
      [data-action="save"],
      .save,.save-changes,
      a.btn, button.btn
    `);
    if (!btn) return;

    // Only handle saves within the settings overlay
    if (!ov.contains(btn)) return;

    const label = (btn.getAttribute('aria-label') || btn.textContent || '').trim().toLowerCase();
    const isSubmit = btn.tagName === 'BUTTON' && (btn.type || '').toLowerCase() === 'submit';
    if (!isSubmit && !label.includes('save')) return;

    const form = currentSlotForm();
    if (!form) return;

    e.preventDefault();
    e.stopPropagation();

    const fd = new FormData(form);
    const key = inferFieldKey(form);
    const endpoint = FIELD_MAP[key];
    if (!endpoint) { toast('Unknown settings form.', 'err'); return; }

    const msgMap = {
      name: 'Update your name?',
      email: 'Update your email?',
      password: 'Change your password?',
      nickname: 'Update your nickname?',
      bio: 'Update your bio?',
      birthdate: 'Update your birthdate?',
      about_city: 'Update your town/city?',
      contact_email: 'Update your contact email?'
    };
    if (!(await showConfirm(msgMap[key] || 'Apply these changes?'))) return;

    const submitBtn = form.querySelector('.btn-primary, button[type="submit"]');
    const prev = submitBtn && submitBtn.textContent;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

    try {
      // POST (JSON for settings endpoints)
      const isSettings = /api\/settings\/update_(account|profile)\.php$/.test(endpoint);
      const url = toApi(endpoint);

      let body = fd, headers = {};
      if (isSettings) {
        const obj = {}; for (const [k, v] of fd.entries()) obj[k] = v;
        body = JSON.stringify(obj);
        headers['Content-Type'] = 'application/json';
        headers['Accept'] = 'application/json';
      }

      const res = await fetch(url, { method: 'POST', credentials: 'include', headers, body });
      const text = await res.text();
      let j; try { j = JSON.parse(text); } catch { throw new Error(text || 'Server error'); }
      if (!res.ok || j?.ok !== true) throw new Error(j?.error || `Save failed (${res.status})`);

      // ✅ Save succeeded
// (Optional) close the confirm overlay if it's still open
if (confirmOverlay) {
  confirmOverlay.classList.remove('open');
  confirmOverlay.setAttribute('aria-hidden', 'true');
}

// Give the toast a moment then hard-reload the page
setTimeout(() => {
  window.location.reload(); // full refresh to pull fresh data everywhere
}, 350);


      // ✅ After success: fetch fresh profile, repopulate the current slot, update preview, then collapse
      const profile = await fetchProfileFresh();

      const slot = ov.querySelector('.slot.open') || ov.querySelector('.slot');
      const slotForm = slot && slot.querySelector('form');
      if (slotForm) {
        fillFormWithProfile(slotForm, profile);
        updateSlotPreview(slot, slotForm);
      }

      if (slot) {
        slot.style.maxHeight = `${slot.scrollHeight}px`;
        requestAnimationFrame(() => {
          slot.classList.remove('open');
          slot.style.maxHeight = '0px';
        });
      }

      // Refresh any global profile card handled by the shell
      if (typeof window.fetchMyProfile === 'function') {
        try { await window.fetchMyProfile(); } catch {}
      }
    } catch (err) {
      console.error('Settings save failed:', err);
      toast(String(err.message || err) || 'Save failed.', 'err');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = prev || 'Save changes'; }
    }
  }, true);
})();
  // Initial load
  loadContent();
});

// === Adviser ID: hard hook autopopulate (page + shell) ===
(() => {
  if (window.__adv_id_hard_hook__) return;
  window.__adv_id_hard_hook__ = true;

  const toApi = (p) => ('api/' + String(p).replace(/^\/?api\//, '').replace(/^\/+/, '')).replace(/\/{2,}/g, '/');

  async function fetchAdviserId() {
    try {
      const r = await fetch(toApi('api/settings/get_profile.php'), {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      const t = await r.text();
      let j; try { j = JSON.parse(t); } catch { j = {}; }
      const it = j.item || j.data || j.profile || j.me || j;
      return it && (it.adviser_id ?? it.id ?? (it.adviser && it.adviser.id) ?? null);
    } catch { return null; }
  }

  function setAdvIdValue(scope, id) {
    const root = scope || document;
    const input =
      root.querySelector('input[name="adviser_id"]') ||
      root.querySelector('#adviser_id');
    if (!input) return;
    // If something keeps clearing it, re-assert value on next frame too
    input.value = (id == null ? '' : String(id));
    requestAnimationFrame(() => {
      if (!input.value) input.value = (id == null ? '' : String(id));
    });
  }

  async function populateAdvId(scope) {
    const id = await fetchAdviserId();
    if (id != null) setAdvIdValue(scope, id);
  }

  // 1) When Settings modal opens or toggles "open"
  const isSettingsOverlay = (el) =>
    !!el && (
      el.id === 'settingsModalOverlay' ||
      el.id === 'settingsOverlay' ||
      el.id === 'settingsModal' ||
      el.classList?.contains('settings-modal') ||
      el.classList?.contains('settings-modal__overlay')
    );

  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      // a) class/aria change -> opened
      if (m.type === 'attributes' && isSettingsOverlay(m.target) && m.target.classList.contains('open')) {
        populateAdvId(m.target);
      }
      // b) nodes inserted -> template rendered
      if (m.addedNodes && m.addedNodes.length) {
        for (const n of m.addedNodes) {
          if (!(n instanceof HTMLElement)) continue;
          if (isSettingsOverlay(n)) populateAdvId(n);
          // c) input itself was inserted
          const target =
            (n.matches && n.matches('input[name="adviser_id"], #adviser_id') && n) ||
            n.querySelector?.('input[name="adviser_id"], #adviser_id');
          if (target) populateAdvId(target.closest('.slot') || n);
        }
      }
    }
  });
  mo.observe(document.documentElement, {
    subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-hidden']
  });

  // 2) Also run once on load (covers cases where modal is already in DOM)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => populateAdvId());
  } else {
    populateAdvId();
  }

  // 3) Re-assert after a successful settings save (if your Save bridge is present)
  document.addEventListener('settings:afterSave', () => populateAdvId(), { passive: true });

  // If you don't emit that event yet, you can fire it in your Save bridge success:
  // document.dispatchEvent(new CustomEvent('settings:afterSave'));
})();
