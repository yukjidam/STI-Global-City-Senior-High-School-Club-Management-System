/* === Notice modal (student) ===
   Paste this at the very top of Student-Messages.js (line 1)
   so openNotice exists before any code tries to use it. */
(function () {
  if (typeof window.openNotice === 'function') return; // avoid duplicates

  // Inject minimal CSS once (won't touch your theme)
  if (!document.getElementById('sm-notice-css')) {
    const css = document.createElement('style');
    css.id = 'sm-notice-css';
    css.textContent = `
      .sm-notice__backdrop{
        position:fixed; inset:0; z-index:2147483647; display:grid; place-items:center;
        background:rgba(0,0,0,.35); padding:16px;
      }
      .sm-notice__card{
        width:min(420px,92vw); background:#fff; color:#0f172a; border-radius:14px;
        box-shadow:0 10px 28px rgba(0,0,0,.2); overflow:hidden; font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Arial;
      }
      .sm-notice__hd{ padding:14px 16px; font-weight:700; border-bottom:1px solid #e5e7eb; }
      .sm-notice__bd{ padding:16px; white-space:pre-wrap; }
      .sm-notice__ft{ padding:12px 16px; border-top:1px solid #e5e7eb; display:flex; justify-content:flex-end; gap:8px; }
      .sm-notice__btn{
        padding:8px 14px; border-radius:10px; border:1px solid #e5e7eb; background:#111827; color:#fff; cursor:pointer;
      }
      .sm-notice__btn:focus{ outline:2px solid #2563eb; outline-offset:2px; }
    `;
    document.head.appendChild(css);
  }

  window.openNotice = function (title, message) {
    // Remove any existing notice so we never stack modals
    document.getElementById('sm-notice')?.remove();

    const wrap = document.createElement('div');
    wrap.id = 'sm-notice';
    wrap.className = 'sm-notice__backdrop';
    wrap.innerHTML = `
      <div role="dialog" aria-modal="true" class="sm-notice__card">
        <div class="sm-notice__hd">${title || 'Notice'}</div>
        <div class="sm-notice__bd">${message || ''}</div>
        <div class="sm-notice__ft">
          <button type="button" class="sm-notice__btn" id="sm-notice-ok">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    const close = () => wrap.remove();
    wrap.querySelector('#sm-notice-ok').addEventListener('click', close);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    document.addEventListener('keydown', function esc(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown',esc); }});
  };
})();


(() => {
  // ---------- BASE HELPERS ----------
  const PROJECT_BASE = (() => {
    const cap = '/capstone'; const p = location.pathname; const i = p.indexOf(cap);
    return i >= 0 ? p.slice(0, i + cap.length) : '';
  })();

  let SESSION_EXPIRED_SHOWN = false;

  async function apiJSON(pathOrUrl, options = {}) {
    const url = (/^https?:/.test(pathOrUrl)
      ? pathOrUrl
      : (PROJECT_BASE || "") + (pathOrUrl.startsWith("/") ? pathOrUrl : "/" + pathOrUrl));

    const headers = Object.assign({ Accept: "application/json" }, options.headers || {});
    const opts = Object.assign(
      { method: 'GET', credentials: 'same-origin', headers },
      options,
      { headers }
    );

    // Simple 1-button alert modal (no dependencies)
function openNotice(title, message) {
  try { document.getElementById('msg-notice')?.remove(); } catch {}
  const wrap = document.createElement('div');
  wrap.id = 'msg-notice';
  wrap.style.cssText = `
    position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
    background:rgba(0,0,0,.35); z-index:9999; padding:20px;
  `;
  wrap.innerHTML = `
    <div style="background:#fff; width:100%; max-width:420px; border-radius:14px; box-shadow:0 10px 28px rgba(0,0,0,.18); overflow:hidden;">
      <div style="padding:16px 18px; border-bottom:1px solid #eee; font-weight:700; font-size:16px;">${title || 'Notice'}</div>
      <div style="padding:16px 18px; font-size:14px; color:#111; line-height:1.4;">${message || ''}</div>
      <div style="padding:12px 18px; border-top:1px solid #eee; display:flex; justify-content:flex-end;">
        <button id="msg-notice-ok" class="btn btn-primary" style="padding:6px 12px;">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  wrap.querySelector('#msg-notice-ok')?.addEventListener('click', () => wrap.remove());
  wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
}

  

    const res = await fetch(url, opts);
    const text = await res.text();

    if (res.status === 401) {
      console.warn("API 401", url, text);
      if (!SESSION_EXPIRED_SHOWN) {
        SESSION_EXPIRED_SHOWN = true;
        alert("Your session expired. Please log in again.");
      }
      throw new Error("HTTP 401");
    }

    let json = null;
    try { json = JSON.parse(text.replace(/^\uFEFF/, "")); }
    catch (e) { if (res.ok) console.warn("[apiJSON] Non-JSON 200 from", url, "→", text); }

    if (!res.ok) {
      let msg = `HTTP ${res.status}`; if (json?.detail) msg += ` - ${json.detail}`;
      console.error("API error", res.status, text);
      throw new Error(msg);
    }
    return json ?? {};
  }


  const $  = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  // Tracks “hide history before this message id” per DM thread
const DM_HIDE_BEFORE = {};
// Persist "delete for me" cutoffs so reopening after reload stays empty
const HIDE_KEY = 'dm_hide_before';
try {
  const saved = JSON.parse(localStorage.getItem(HIDE_KEY) || '{}');
  if (saved && typeof saved === 'object') Object.assign(DM_HIDE_BEFORE, saved);
} catch {}
function saveCutoffs() {
  try { localStorage.setItem(HIDE_KEY, JSON.stringify(DM_HIDE_BEFORE)); } catch {}
}

// --- add this helper once (near DM_HIDE_BEFORE) ---
function applyCutoff(threadId, msgs) {
  const cut = Number(DM_HIDE_BEFORE[threadId] || 0);
  if (!cut) return msgs;
  return msgs.filter(m => Number(m.id || 0) > cut);
}

// Stable key for dedupe (events often have no numeric id)
function msgKey(m){
  const ts    = m.ts || m.created_at || m.time || m.at || m.sent_at || '';
  const actor = m.actor_id || m.user_id || m.member_id || m.by_id || '';
  const typ   = m.type || m.kind || m.event || '';
  return String(m.id ?? `E:${typ}:${actor}:${ts}`);
}



  


  const els = {
    search:   $('#msgSearch'),
    newBtn:   $('#msgNewBtn'),
    list:     $('#threadList'),
    body:     $('#convBody'),
    name:     $('#convName'),
    status:   $('#convStatus'),
    ava:      $('#convAvatar'),
    composer: $('#msgComposer'),
    input:    $('#msgInput'),
    plus:     $('#msgPlus'),
    picker:   $('#msgPicker'),
    menuBtn:  $('#convMenuBtn'),   // ← add this
    
  };


  let ME = { role: null, id: null };
  // Hide “me” from search results everywhere
// Hide “me” from any search results
const notMe = (u) => {
  if (!u || !ME) return true;
  return !(String(u.id) === String(ME.id) && String(u.role||'') === String(ME.role||'')); // keep only NOT me
};

  let CURRENT_THREAD = null;
  let SEARCH_POP = null;
  let THREADS = [];
  let THREADS_SIG = '';      // signature of current list (ids + last_msg_ids)
let THREADS_POLL_TMR = 0;
  window.__THREADS = THREADS;

  // realtime state (SSE + typing)
  let LAST_MSG_ID = 0;
  let TYPING_TIMER = null;
  let TYPING_EL = null;
  let lastTypingSent = 0;
  let SSE = null;
  let TEMP_LAST = null; 
  let typingSuppressUntil = 0; // ms timestamp; don't send typing until this time
  let CONV_MENU = null;
  let FILE_PICKER = null;
let MEDIA_SENDING = false;   // guard to prevent double-send


  // --- GC sender-name cache -----------------------------------------------
let CURRENT_IS_GROUP = false;
const SENDER_CACHE = new Map(); // key → { first }
const firstName = (s) => String(s || '').trim().split(/\s+/)[0] || '';

// Seen/reads helpers
// ===== Seen / read receipts =====
let SEEN_TIMER = null;

function pickMedia(){
  // create once
  if (!FILE_PICKER) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*,video/*,audio/*';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    FILE_PICKER = inp;
  }

  // reset value so picking same file twice still fires 'change'
  FILE_PICKER.value = '';

  // bind a single handler (overwrite instead of addEventListener)
  FILE_PICKER.onchange = () => {
    const f = FILE_PICKER.files && FILE_PICKER.files[0];
    if (f) sendMediaToThread(f);
  };

  FILE_PICKER.click();
}

function lastMessageIdInDOM(){
  const list = els.body ? els.body.querySelectorAll('[data-mid]') : null;
  if (list && list.length) {
    const last = list[list.length - 1];
    const id = Number(last.dataset.mid || last.getAttribute('data-mid') || 0);
    if (id) return id;
  }
  return Number(LAST_MSG_ID || 0);
}

async function removeMember(threadId, role, id){
  const body = new URLSearchParams({ thread_id: String(threadId) });
  if (role === 'student') body.append('student_id', String(id));
  if (role === 'adviser') body.append('adviser_id', String(id));
  const r = await apiJSON('/api/messages/group_members_remove.php', {
    method: 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body
  });
  return r;
}


// Confirm modal that adapts to DM vs Group
async function openConfirmDelete(threadId, label = '', isGroup = false, isOwner = false) {
  // Build copy
  const title = isGroup ? 'Delete group?' : 'Delete conversation?';
  const body  = isGroup
    ? `This will permanently delete ${label ? `<b>${label}</b>` : 'this group'} for everyone. This cannot be undone.`
    : `This will delete this conversation <b>for you</b>. The other person will still see the older messages.`;

  // Overlay
  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position:'fixed', inset:'0', background:'rgba(0,0,0,.45)',
    display:'flex', alignItems:'center', justifyContent:'center', zIndex:'2147483647'
  });

  const card = document.createElement('div');
  Object.assign(card.style, {
    width:'min(440px,92vw)', background:'#fff', borderRadius:'12px',
    boxShadow:'0 18px 60px rgba(0,0,0,.25)', overflow:'hidden'
  });

  const head = document.createElement('div');
  head.textContent = title;
  Object.assign(head.style, { fontWeight:'700', padding:'14px 16px', borderBottom:'1px solid #e5e7eb' });

  const bodyEl = document.createElement('div');
  bodyEl.innerHTML = `<div style="padding:14px 16px; color:#374151">${body}</div>`;

  const foot = document.createElement('div');
  Object.assign(foot.style, { display:'flex', gap:'8px', justifyContent:'flex-end',
    padding:'12px 16px', borderTop:'1px solid #e5e7eb' });

  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  Object.assign(cancel.style, { padding:'8px 12px', borderRadius:'10px',
    border:'1px solid #e5e7eb', background:'#fff' });
  cancel.onclick = () => wrap.remove();

  const act = document.createElement('button');
  act.textContent = isGroup ? 'Delete group' : 'Delete for me';
  Object.assign(act.style, { padding:'8px 12px', borderRadius:'10px',
    border:'0', background:'#ef4444', color:'#fff' });

  act.onclick = async () => {
    act.disabled = true;
    try {
      await deleteConversation(threadId, { isGroup, isOwner });
      wrap.remove();
      CURRENT_THREAD = null;
      await refreshThreads();
    } catch (e) {
      console.warn('delete failed', e);
      act.disabled = false;
      alert('Could not delete. Please try again.');
    }
  };

  foot.append(cancel, act);
  card.append(head, bodyEl, foot);
  wrap.appendChild(card);
  wrap.addEventListener('click', (e)=>{ if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}

// Main delete handler
// Main delete handler – DM = soft delete (hide history), Group = hard delete (owner)
async function deleteConversation(threadId, { isGroup = false, isOwner = false } = {}) {
  if (!isGroup) {
    // ---- DM: delete for me (hide everything up to server-provided cutoff)
    const r = await apiJSON('/api/messages/dm_delete_for_me.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ thread_id: String(threadId) })
    });

    // remember server’s cutoff so re-renders hide old messages
    DM_HIDE_BEFORE[threadId] = Number(r?.cutoff || r?.up_to || 0);
    saveCutoffs();

    
// remove the thread row immediately and clear the view if we’re in it
const row = els.list.querySelector(`.thread[data-tid="${threadId}"]`);
let neighbor = null;
if (row) {
  neighbor = row.nextElementSibling || row.previousElementSibling;
  row.remove();
}

// If we were viewing it, either move to a neighbor or clear the right pane
if (String(CURRENT_THREAD) === String(threadId)) {
  CURRENT_THREAD = null;
  if (neighbor) {
    const nextId = neighbor.getAttribute('data-tid');
    $$('.thread.is-active').forEach(x => x.classList.remove('is-active'));
    neighbor.classList.add('is-active');
    openThread(nextId, null);
  } else {
    if (els.body) els.body.innerHTML = '';
    if (typeof setComposerVisible === 'function') setComposerVisible(false);
  }
}

await refreshThreads(); // repopulate the left list
return;

  }

  // ---- Group: hard delete (owner only)
  if (!isOwner) {
    alert('Only the owner can delete this group.');
    throw new Error('not owner');
  }

  await apiJSON('/api/messages/group_delete.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ thread_id: String(threadId) })
  });
}




function lastMyMessageIdInDOM(){
  const nodes = [...els.body.querySelectorAll('.msg.you[data-mid]')];
  if (!nodes.length) return 0;
  return Number(nodes[nodes.length - 1].dataset.mid || 0);
}

function rehydrateSystemNote(raw){
  let t = String(raw || '');

  // Replace any known emails with a display name from warmed cache/meta
  for (const [email, u] of PEOPLE_CACHE.byEmail) {
    const nm = [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(' ').trim()
           || u.name || u.nickname || '';
    if (!nm) continue;
    const esc = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp(esc, 'gi'), nm);
  }

  // who = token before ' has ' or ' was '
  const m = t.match(/^(.+?)\s+(has\s+(joined|left)|was\s+removed)\s+the\s+group\.\s*$/i);
  if (!m) return t;

  let who = m[1].trim();
  let person = null;

  // Try email -> cache
  if (/^[A-Z0-9._%+-]+@/i.test(who)) {
    person = PEOPLE_CACHE?.byEmail?.get(who.toLowerCase()) || null;
  }
  // Try "adviser 123" / "student 123"
  if (!person) {
    const r = who.match(/^(adviser|student)\s+(\d+)/i);
    if (r) person = PEOPLE_CACHE?.byKey?.get(`${r[1].toLowerCase()}:${r[2]}`) || null;
  }
  // If it's me, use my nice name
  if (!person && String(ME?.id) && who.toLowerCase().startsWith(String(ME?.role))) {
    person = { name: ME?.name };
  }

  if (person?.name) {
    const full = [person.first_name, person.middle_name, person.last_name]
      .filter(Boolean).join(' ').trim() || String(person.name);
    t = t.replace(m[1], full);
  }
  return t;
}



// Attach a tiny line just under *your* last bubble
function attachSeenLine(text){
  // remove any old seen lines
  $$('#convBody .seen-line').forEach(x => x.remove());
  const mine = [...els.body.querySelectorAll('.msg.you[data-mid]')];
  if (!mine.length || !text) return;
  const last = mine[mine.length - 1];
  const line = document.createElement('div');
  line.className = 'seen-line';
  line.textContent = text;
  line.style.cssText = 'font-size:11px;color:#6b7280;margin:2px 8px 6px; text-align:right;';
  last.appendChild(line);
}

async function sendMediaToThread(file) {
  try {
    if (!file) return;

    // 25 MB limit for video (you can also apply to all files if you prefer)
    const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB
    if (String(file.type || '').startsWith('video/') && file.size > MAX_VIDEO_BYTES) {
      openNotice('File too large', 'Videos larger than 25 MB cannot be uploaded.');
      return;
    }

    // fall back to your existing “send.php” media path
    const fd = new FormData();
    fd.append('thread_id', CURRENT_THREAD);
    fd.append('media', file);              // your backend reads the uploaded blob as "media"
    fd.append('text', '');                 // keep empty for pure media
    // If your backend expects media_type/media_path, keep them blank; server will fill.

    const r = await apiJSON('/api/messages/send.php', { method: 'POST', body: fd });

    // render optimistically if API returns the new item
    if (r?.ok && r?.item) {
      renderMsg(r.item);
      scrollToEnd();
    }
  } catch (e) {
    // If backend rejects (e.g., 400/413), surface a friendly notice
    const msg = String(e?.message || '');
    if (/too[_\s-]?large|payload|413|25\s*mb/i.test(msg)) {
      openNotice('File too large', 'Videos larger than 25 MB cannot be uploaded.');
    } else {
      openNotice('Upload failed', 'We could not upload that file. Please try again.');
    }
  }
}


// === Members Modal (owner first, then members, with role badges) — search + scroll + empty state ===
async function openMembersModal(metaOrNothing) {
  // Clean any previous modal
  document.getElementById('membersModal')?.remove();

  // Fetch fresh meta if not provided
  let meta = metaOrNothing;
  if (!meta || !meta.group) {
    try { meta = await fetchGroupMeta(CURRENT_THREAD, { fresh: true }); } catch {}
  }
  if (!meta || !meta.group) { alert('Could not load members.'); return; }

  // Helpers
  const roleLabel = r => (r ? r[0].toUpperCase() + r.slice(1) : '');
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const displayName = (p) => {
    if (p?.name && p.name.trim()) return p.name.trim();
    const parts = [p?.first_name, p?.middle_name, p?.last_name].map(x=>String(x||'').trim()).filter(Boolean);
    if (parts.length) return parts.join(' ');
    if (p?.role === 'adviser' && String(p?.id) === String(ME?.id) && ME?.name) return ME.name;
    return p?.sti_email || `${p?.role||''} ${p?.id||''}`.trim();
  };

  // Build list (owner first, then others sorted)
  const items = [];

  // owner (hydrate name if needed)
  if (meta.group.creator) {
    const ownerKey = { role: String(meta.group.creator.role), id: String(meta.group.creator.id) };
    let ownerInfo = (window.PEOPLE_CACHE?.byKey?.get(`${ownerKey.role}:${ownerKey.id}`)) || null;
    if (!ownerInfo) {
      try {
        const rp = await apiJSON(`/api/messages/get_profile.php?role=${ownerKey.role}&id=${encodeURIComponent(ownerKey.id)}`);
        if (rp?.profile) ownerInfo = Object.assign({ role: ownerKey.role, id: ownerKey.id }, rp.profile);
      } catch {}
    }
    items.push({ ...(ownerInfo || ownerKey), is_owner: true });
  }

  // members (exclude owner duplicate)
  if (Array.isArray(meta.members)) {
    for (const m of meta.members) {
      const dupOwner = items[0] && String(m.role) === String(items[0].role) && String(m.id) === String(items[0].id);
      if (!dupOwner) items.push(m);
    }
  }

  if (items.length > 1) {
    const head = items.shift();
    items.sort((a,b)=> String(displayName(a)).localeCompare(String(displayName(b))));
    items.unshift(head);
  }

  // Overlay
  const wrap = document.createElement('div');
  wrap.id = 'membersModal';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  Object.assign(wrap.style, {
    position:'fixed', inset:'0', background:'rgba(0,0,0,.45)', display:'flex',
    alignItems:'center', justifyContent:'center', zIndex:'2147483647'
  });

  // Card
  const card = document.createElement('div');
  Object.assign(card.style, {
    background:'#fff', borderRadius:'12px', width:'min(560px,92vw)',
    boxShadow:'0 18px 60px rgba(0,0,0,.25)', overflow:'hidden',
    display:'flex', flexDirection:'column'
  });

  // Header (top Close only)
  const hd = document.createElement('div');
  Object.assign(hd.style, {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'12px 14px', borderBottom:'1px solid #e5e7eb'
  });
  const h3 = document.createElement('h3');
  h3.textContent = 'Members';
  h3.style.margin = '0'; h3.style.fontSize = '16px';
  const btnX = document.createElement('button');
  btnX.textContent = 'Close';
  btnX.className = 'btn';
  Object.assign(btnX.style, { padding:'8px 12px', borderRadius:'10px', border:'0', background:'#e5e7eb', cursor:'pointer' });
  btnX.onclick = () => wrap.remove();
  hd.appendChild(h3); hd.appendChild(btnX);

  // Search box
  const searchWrap = document.createElement('div');
  searchWrap.style.cssText = 'padding:8px 12px; border-bottom:1px solid #f1f5f9; background:#fff;';
  const search = document.createElement('input');
  Object.assign(search, { type:'text', placeholder:'Search members...' });
  search.style.cssText = 'width:100%; padding:8px 10px; border:1px solid #e5e7eb; border-radius:10px;';
  searchWrap.appendChild(search);

  // Body list (solid min-height)
  const bd = document.createElement('div');
  Object.assign(bd.style, { overflow:'auto', padding:'6px', background:'#fff', minHeight:'140px' });

  // Render rows
  const rows = [];
  for (const p of items) {
    const row = document.createElement('div');
    row.className = 'mem-row';
    row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 8px;border-bottom:1px solid #f1f5f9';

    const ava = document.createElement('div');
    ava.style.cssText = 'width:38px;height:38px;border-radius:9999px;background:#e5e7eb center/cover no-repeat';
    const avu = (typeof avatarUrl === 'function') ? avatarUrl(p) : '';
    if (avu) ava.style.backgroundImage = `url("${avu}")`;

    const main = document.createElement('div');
    main.style.cssText = 'flex:1;min-width:0';

    const nm = document.createElement('div');
    nm.style.cssText = 'font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    nm.textContent = displayName(p);

    const badges = document.createElement('div');
    badges.style.marginTop = '2px';

    const mkBadge = (text, kind) => {
      const b = document.createElement('span');
      b.textContent = text;
      b.style.cssText = 'display:inline-block;font-size:11px;padding:2px 6px;border-radius:9999px;margin-right:6px;border:1px solid';
      if (kind === 'owner') { b.style.background = '#eef2ff'; b.style.color = '#3730a3'; b.style.borderColor = '#c7d2fe'; }
      else                  { b.style.background = '#ecfeff'; b.style.color = '#155e75'; b.style.borderColor = '#a5f3fc'; }
      return b;
    };
    if (p.is_owner) badges.appendChild(mkBadge('Owner', 'owner'));
    badges.appendChild(mkBadge(roleLabel(p.role), 'role'));

    main.appendChild(nm);
    main.appendChild(badges);
    row.appendChild(ava);
    row.appendChild(main);
    bd.appendChild(row);
    rows.push({ row, name: nm.textContent.toLowerCase() });
  }

  // Empty state element (solid, centered)
  const empty = document.createElement('div');
  empty.textContent = 'No members found';
  empty.style.cssText = 'display:none; color:#6b7280; text-align:center; padding:20px 8px;';
  bd.appendChild(empty);

  // Height clamp + empty toggle (also used after filtering)
  function updateLayout() {
    // count visible rows
    let visible = 0, firstVisible = null;
    for (const r of rows) {
      if (r.row.style.display !== 'none') {
        visible++;
        if (!firstVisible) firstVisible = r.row;
      }
    }
    // toggle empty label
    empty.style.display = visible === 0 ? 'block' : 'none';

    // clamp to exactly 6 rows when > 6 visible
    const ref = firstVisible || rows[0]?.row;
    if (ref) {
      const h = ref.getBoundingClientRect().height || 44; // fallback
      if (visible > 6) {
        bd.style.maxHeight = Math.ceil(h * 6 + 6) + 'px';
        bd.style.overflowY = 'auto';
      } else {
        bd.style.maxHeight = '';
        bd.style.overflowY = 'visible';
      }
    } else {
      // no rows at all (just empty state) — give a pleasant fixed height
      bd.style.maxHeight = '180px';
      bd.style.overflowY = 'hidden';
    }
  }

  // Initial layout pass
  requestAnimationFrame(updateLayout);

  // Filter as you type
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    rows.forEach(({row, name}) => {
      row.style.display = (!q || name.includes(q)) ? '' : 'none';
    });
    updateLayout();
  });

  // Assemble (no bottom footer)
  card.appendChild(hd);
  card.appendChild(searchWrap);
  card.appendChild(bd);
  wrap.appendChild(card);
  document.body.appendChild(wrap);

  // Close on backdrop click
  wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
}





async function leaveCurrentGroup(){
  try {
    const meta = await fetchGroupMeta(CURRENT_THREAD, { fresh:true });
    if (!meta?.group) { alert('This is not a group.'); return; }

    const me = { role: ME.role, id: String(ME.id) };
    const body = new URLSearchParams({
      thread_id: String(CURRENT_THREAD),
      members_json: JSON.stringify([me])
    });

    await apiJSON('/api/messages/group_members_remove.php', {
      method:'POST',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body
    });

    GROUP_META_CACHE.delete(CURRENT_THREAD);
    await refreshThreads();
  } catch (e) {
    console.warn('leave group failed', e);
    alert('Could not leave the group. Please try again.');
  }
}

async function markThreadSeen(threadId){
  try {
    const lastId = lastMessageIdInDOM(); // now includes sys-notes
    await apiJSON('/api/messages/seen_upsert.php', {
      method: 'POST',
      headers: { 'Content-Type':'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ thread_id: String(threadId), message_id: String(lastId) })
    });
    clearUnread(threadId);  // 👈 instant UI feedback
  } catch {}
}


function formatSeenLine(viewers, isGroup){
  if (!Array.isArray(viewers) || viewers.length === 0) return '';
  if (!isGroup) return 'Seen'; // 1:1
  const names = viewers.map(v => v.name).filter(Boolean);
  if (names.length === 0) return '';
  if (names.length <= 3) return `Seen by ${names.join(', ')}`;
  return `Seen by ${names.slice(0,3).join(', ')}, and ${names.length - 3} others`;
}

async function refreshSeenUI(threadId){
  try {
    const myLast  = lastMyMessageIdInDOM();
    const lastAny = lastMessageIdInDOM();

    // only show if my message is the last message
    if (!myLast || myLast !== lastAny) { attachSeenLine(''); return; }

    const url = `/api/messages/seen_list.php?thread_id=${encodeURIComponent(threadId)}&message_id=${myLast}&ts=${Date.now()}`;
    const r = await apiJSON(url, { cache: 'no-store' });   // ← important

    const line = formatSeenLine(r?.viewers || [], CURRENT_IS_GROUP === true);
    attachSeenLine(line);
  } catch {
    attachSeenLine('');
  }
}




function startSeenTracking(threadId){
  clearInterval(SEEN_TIMER);
  markThreadSeen(threadId);
  refreshSeenUI(threadId);
  SEEN_TIMER = setInterval(() => refreshSeenUI(threadId), 3000);
}
// ===== end seen helpers =====



function senderKey(m) {
  // We try to form keys like "student:123" or "adviser:20001234"
  const role =
    m.sender_role ||
    (m.sender_adviser_id ? 'adviser' :
     m.sender_student_id ? 'student' : 'student');
  const id = m.sender_adviser_id || m.sender_student_id || m.sender_id || '';
  return `${role}:${id}`;
}

async function ensureSenderFirst(m) {
  // 1) if API already sends a usable name, prefer it
const inline =
  m.sender_name_first || m.sender_first ||
  (!CURRENT_IS_GROUP && m.sender_name ? firstName(m.sender_name) : '');


  if (inline) return inline;

  // 2) cache lookup / lazy hydrate from get_profile.php
  const key = senderKey(m);
  const hit = SENDER_CACHE.get(key);
  if (hit?.first) return hit.first;

  try {
    const [role, id] = key.split(':');
    const r = await apiJSON(`/api/messages/get_profile.php?role=${role}&id=${encodeURIComponent(id)}`);
    const nm = r?.profile?.name || r?.profile?.full_name || r?.profile?.first_name || r?.profile?.nickname;
    const first = firstName(nm);
    SENDER_CACHE.set(key, { first });
    return first || '';
  } catch {
    return '';
  }
}


  // Inject "New Group" button next to "Messages" title if missing
(function injectNewGroupButton(){
  const header = document.querySelector('.messages-card h3, .messages-card .card-title, .msg-header h3, #messagesHeader h3')?.parentElement
              || document.querySelector('.messages-card, .msg-header, #messagesHeader');
  if (!header) return;

  if (!document.querySelector('#msgNewGroupBtn')) {
    const btn = document.createElement('button');
    btn.id = 'msgNewGroupBtn';
    btn.className = 'btn-new-group';
    btn.type = 'button';
    btn.textContent = 'New Group';
    btn.style.marginLeft = '8px';
    header.appendChild(btn);
  }
})();

// Email/ID → person info cache for quick lookups in system notes
const PEOPLE_CACHE = {
  byEmail: new Map(), // email -> {name, role, id, avatar}
  byKey: new Map(),   // `${role}:${id}` -> {name, role, id, avatar}
};


function openEditGroupModal(meta){
  if (!meta?.group) return;
  document.getElementById('group-modal')?.remove();

  const wrap = document.createElement('div');
  wrap.id = 'group-modal';
  const g = meta.group;
  const members = Array.isArray(meta.members) ? meta.members : [];

  // Start with existing members; we’ll track adds / removals
  const current = members.map(m => ({ role:m.role, id:String(m.id), name:m.name, avatar:m.avatar }));
  const toAdd = [];
  const toRemove = new Set(); // "role:id"

  wrap.innerHTML = `
    <div class="card" role="dialog" aria-modal="true">
      <h3>Edit group</h3>

      <div class="gfield">
        <label>Group name</label>
        <input id="gName" type="text" style="padding:10px;border:1px solid #e5e7eb;border-radius:10px;" value="${(g.name||'').replace(/"/g,'&quot;')}">
      </div>

      <div class="gfield">
        <label>Group avatar</label>
        <div class="grow-row">
          <img id="gAvatarPrev" class="avatar-preview" alt="" src="${g.avatar ? avatarUrl({avatar:g.avatar}) : ''}">
          <input id="gAvatar" type="file" accept="image/*">
        </div>
      </div>

      <div class="gfield">
        <label>Members</label>
        <div id="gMemberList" style="display:flex;gap:8px;flex-wrap:wrap;"></div>
      </div>

      <div class="gfield">
        <label>Add members</label>
        <input id="gSearch" type="text" placeholder="Search people..." style="padding:10px;border:1px solid #e5e7eb;border-radius:10px;">
        <div id="gResults" style="max-height:220px; overflow:auto; border:1px solid #f1f5f9; border-radius:10px; padding:6px; display:none;"></div>
      </div>

      <div class="g-actions">
        <button class="btn" id="gCancel">Cancel</button>
        <button class="btn primary" id="gSave">Save changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const elName   = wrap.querySelector('#gName');
  const elAv     = wrap.querySelector('#gAvatar');
  const elPrev   = wrap.querySelector('#gAvatarPrev');
  const elInput  = wrap.querySelector('#gSearch');
  const elRes    = wrap.querySelector('#gResults');
  const elList   = wrap.querySelector('#gMemberList');

  elAv.addEventListener('change', ()=> {
    const f = elAv.files?.[0];
    if (f) elPrev.src = URL.createObjectURL(f);
  });

  const makeKey = (r,id)=> `${r}:${id}`;

  function renderMembers(){
    elList.innerHTML = '';
    current.forEach(m => {
      const key = makeKey(m.role, m.id);
      const chip = document.createElement('span');
      chip.className = 'gchip';
      chip.innerHTML = `
        <img src="${avatarUrl(m)}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">
        <span>${m.name}</span>
        <button title="Remove">✕</button>
      `;
      // Creator cannot be removed
      const isCreator = (meta?.group?.creator?.role === m.role && String(meta.group.creator.id) === String(m.id));
      // You can’t remove yourself here (optional: allow)
      const isMe = (m.role === ME.role && String(m.id) === String(ME.id));
      if (isCreator || isMe) chip.querySelector('button').disabled = true;

      chip.querySelector('button').onclick = () => {
        // record removal & drop from current (if not already planned remove)
        toRemove.add(key);
        const idx = current.findIndex(x => makeKey(x.role,x.id) === key);
        if (idx >= 0) current.splice(idx,1);
        renderMembers();
      };
      elList.appendChild(chip);
    });
  }
  renderMembers();

  // search & add
  let tmr = null;
elInput.addEventListener('input', () => {
  clearTimeout(tmr);
  const q = elInput.value.trim();
  if (!q) { elRes.style.display = 'none'; elRes.innerHTML = ''; return; }

  tmr = setTimeout(async () => {
    try {
      const r = await apiJSON('/api/messages/search_users.php?q=' + encodeURIComponent(q));
      const list     = Array.isArray(r.items) ? r.items : [];
      const filtered = list.filter(notMe);

      elRes.innerHTML = '';
      filtered.forEach(u => {
        const key = makeKey(u.role, String(u.id));

        // Skip users already in the group or already queued to add
        const inCurrent = current.some(c => makeKey(c.role, c.id) === key);
        const inAdds    = toAdd.some(a => makeKey(a.role, a.id) === key);
        if (inCurrent || inAdds) return;

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px;border-radius:10px;cursor:pointer;';
        row.innerHTML = `
          <img src="${avatarUrl(u)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">
          <div style="flex:1 1 auto;min-width:0;">
            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.name}</div>
            <div style="font-size:12px;color:#6b7280;">${u.role==='adviser'?'Adviser':'Student'}</div>
          </div>
          <div style="font-size:12px;color:#111;border:1px solid #e5e7eb;padding:4px 8px;border-radius:9999px;background:#fff;">Add</div>
        `;
        row.onclick = () => {
          toAdd.push({ role:u.role, id:String(u.id), name:u.name, avatar:u.avatar, email:u.email || u.sti_email || u.username || '' });
          current.push({ role:u.role, id:String(u.id), name:u.name, avatar:u.avatar, email:u.email || u.sti_email || u.username || '' });
          toRemove.delete(key);
          renderMembers();
        };
        elRes.appendChild(row);
      });

      elRes.style.display = filtered.length ? 'block' : 'none';
    } catch {}
  }, 220);
});


  wrap.querySelector('#gCancel').onclick = ()=> wrap.remove();

wrap.querySelector('#gSave').onclick = async () => {
  try {
    // 1) Update name / avatar
    const fd = new FormData();
    if (elName.value.trim() !== (g.name || '').trim()) fd.append('name', elName.value.trim());
    if (elAv.files?.[0]) fd.append('avatar', elAv.files[0]);
    if ([...fd.keys()].length) {
      fd.append('thread_id', String(CURRENT_THREAD));
      await apiJSON('/api/messages/group_update.php', { method:'POST', body: fd });
    }

    // 2) Bulk add members
// 2) Bulk add members
if (toAdd.length) {
  // Warm system-note cache so join alerts use full names (not emails)
  toAdd.forEach(m => {
    PEOPLE_CACHE.byKey.set(`${m.role}:${m.id}`, m);
    if (m.email) PEOPLE_CACHE.byEmail.set(String(m.email).toLowerCase(), m);
  });

  const body = new URLSearchParams({
    thread_id: String(CURRENT_THREAD),
    members_json: JSON.stringify(toAdd.map(m => ({ role: m.role, id: m.id })))
  });
  await apiJSON('/api/messages/group_members_add.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
}


    // 3) Bulk remove members (exclude owner)
    if (toRemove && toRemove.size) {
      // If your group meta uses {created_by_role, created_by_id} keep this line.
      // If it uses {creator:{role,id}} then compute:
      //   const ownerKey = `${meta.group.creator.role}:${String(meta.group.creator.id)}`;
      const ownerKey = `${meta.group.created_by_role}:${String(meta.group.created_by_id)}`;

      const payload = [];
      for (const key of toRemove) {
        if (key === ownerKey) continue; // never remove the owner
        const [role, id] = key.split(':');
        payload.push({ role, id });
      }
      if (payload.length) {
        const body = new URLSearchParams({
          thread_id: String(CURRENT_THREAD),
          members_json: JSON.stringify(payload)
        });
        await apiJSON('/api/messages/group_members_remove.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        });
      }
    }
    // success -> close modal
wrap.remove();
try { await fetchGroupMeta(CURRENT_THREAD, { fresh:true }); } catch {}


  } catch (e) {
    alert('Could not save group changes. Please try again.');
    console.warn('edit group save failed', e);
  }
};

}


function openGroupModal(){
  document.getElementById('group-modal')?.remove();

  const wrap = document.createElement('div');
  wrap.id = 'group-modal';
  wrap.innerHTML = `
    <div class="card" role="dialog" aria-modal="true">
      <h3>Create group</h3>

      <div class="gfield">
        <label>Group name</label>
        <input id="gName" type="text" placeholder="e.g., Robotics Team" style="padding:10px;border:1px solid #e5e7eb;border-radius:10px;">
      </div>

      <div class="gfield">
        <label>Group avatar (optional)</label>
        <div class="grow-row">
          <img id="gAvatarPrev" class="avatar-preview" alt="">
          <input id="gAvatar" type="file" accept="image/*">
        </div>
      </div>

      <div class="gfield">
        <label>Add members</label>
        <input id="gSearch" type="text" placeholder="Search people..." style="padding:10px;border:1px solid #e5e7eb;border-radius:10px;">
        <div id="gResults" style="max-height:220px; overflow:auto; border:1px solid #f1f5f9; border-radius:10px; padding:6px; display:none;"></div>
        <div class="gchips" id="gChips"></div>
      </div>

      <div class="g-actions">
        <button class="btn" id="gCancel">Cancel</button>
        <button class="btn primary" id="gCreate" disabled>Create</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const elName   = wrap.querySelector('#gName');
  const elAv     = wrap.querySelector('#gAvatar');
  const elPrev   = wrap.querySelector('#gAvatarPrev');
  const elInput  = wrap.querySelector('#gSearch');
  const elRes    = wrap.querySelector('#gResults');
  const elChips  = wrap.querySelector('#gChips');
  const elCreate = wrap.querySelector('#gCreate');

  let selected = []; // [{role,id,name,avatar}]

  const refreshChips = ()=>{
    elChips.innerHTML = '';
    selected.forEach((u, idx)=>{
      const chip = document.createElement('span');
      chip.className = 'gchip';
      chip.innerHTML = `<span>${u.name}</span><button title="Remove">✕</button>`;
      chip.querySelector('button').onclick = ()=>{
        selected.splice(idx,1);
        refreshChips(); maybeEnable();
      };
      elChips.appendChild(chip);
    });
  };

  const maybeEnable = ()=>{
    elCreate.disabled = !(elName.value.trim() && selected.length >= 1);
  };

  elName.addEventListener('input', maybeEnable);

  elAv.addEventListener('change', ()=>{
    const f = elAv.files?.[0];
    if (f) elPrev.src = URL.createObjectURL(f);
  });

  let tmr = null;
elInput.addEventListener('input', () => {
  clearTimeout(tmr);
  const q = elInput.value.trim();
  if (!q) { elRes.style.display='none'; elRes.innerHTML=''; return; }

  tmr = setTimeout(async () => {
    try {
      const r = await apiJSON('/api/messages/search_users.php?q=' + encodeURIComponent(q));
      const list     = Array.isArray(r.items) ? r.items : [];
      const filtered = list.filter(notMe);

      elRes.innerHTML = '';
      filtered.forEach(u => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px;border-radius:10px;cursor:pointer;';
        row.innerHTML = `
          <img src="${avatarUrl(u)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">
          <div style="flex:1 1 auto;min-width:0;">
            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.name}</div>
            <div style="font-size:12px;color:#6b7280;">${u.role==='adviser'?'Adviser':'Student'}</div>
          </div>
          <div style="font-size:12px;color:#111;border:1px solid #e5e7eb;padding:4px 8px;border-radius:9999px;background:#fff;">Add</div>
        `;
        row.onclick = () => {
          const key = u.role + ':' + u.id;
          if (!selected.some(s => (s.role + ':' + s.id) === key)) {
            selected.push({ role:u.role, id:String(u.id), name:u.name, avatar:u.avatar });
            refreshChips(); maybeEnable();
          }
        };
        elRes.appendChild(row);
      });

      elRes.style.display = filtered.length ? 'block' : 'none';
    } catch {}
  }, 220);
});


  wrap.querySelector('#gCancel').onclick = ()=>wrap.remove();

  elCreate.onclick = async ()=>{
    const fd = new FormData();
    fd.append('name', elName.value.trim());
    fd.append('members_json', JSON.stringify(selected.map(s=>({role:s.role, id:s.id}))));
    if (elAv.files?.[0]) fd.append('avatar', elAv.files[0]);

    try{
      const r = await apiJSON('/api/messages/group_create.php', { method:'POST', body:fd });
      const tid = r?.thread_id;
      if (tid) {
        wrap.remove();
        await refreshThreads();
        const other = { role:'group', id:tid, name:(r?.group?.name || elName.value.trim()), avatar:(r?.group?.avatar||'') };
        ensureThreadInList(tid, other, '');
        $$('.thread.is-active').forEach(x => x.classList.remove('is-active'));
        els.list.querySelector(`[data-tid="${tid}"]`)?.classList.add('is-active');
        openThread(tid, other);
      } else {
        alert('Could not create group. Please try again.');
      }
    }catch(e){
      alert('Could not create group. Please try again.');
      console.warn(e);
    }
  };
}

// wire button
document.querySelector('#msgNewGroupBtn')?.addEventListener('click', openGroupModal);

function clearConversationUI() {
  CURRENT_THREAD = null;
  els.body && (els.body.innerHTML = '');
  if (els.name)   els.name.textContent   = '—';
  if (els.status) els.status.textContent = '';
  if (els.ava)    els.ava.style.backgroundImage = '';
}


  function stopTypingNow(){
  // remove local dots immediately
  clearTimeout(TYPING_TIMER);
  if (TYPING_EL) { TYPING_EL.remove(); TYPING_EL = null; }
  // suppress accidental key events right after send
  typingSuppressUntil = Date.now() + 1200;

  // tell server to clear our typing row so the other side vanishes instantly
  if (CURRENT_THREAD) {
    fetch((PROJECT_BASE||'')+'/api/messages/typing.php', {
      method:'POST',
      credentials:'same-origin',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body: new URLSearchParams({ thread_id:String(CURRENT_THREAD), stop:'1' })
    }).catch(()=>{});
  }
}

// ===== Conversation menu (⋮) =====
// --- Unread badge styles (inject once) ---
(function ensureUnreadCSS(){
  if (document.getElementById('unread-css')) return;
  const s = document.createElement('style');
  s.id = 'unread-css';
  s.textContent = `
    .thread { position: relative; }
    .thread .unread-badge{
      position:absolute; right:10px; top:22px;
      min-width:18px; height:18px; padding:0 6px;
      border-radius:9999px; background:#2563eb; color:#fff;
      font-size:11px; line-height:18px; text-align:center; font-weight:700;
    }
    .thread.unread { background:rgba(37,99,235,.22); }
    .thread.unread .name { font-weight:700; }
    .thread.unread .time { display:none; } /* ← hide timestamp when unread */
  `;
  document.head.appendChild(s);
})();

// Basic CSS (safe to inject once)
(function ensureConvMenuCSS(){
  if (document.getElementById('conv-menu-css')) return;
  const s = document.createElement('style'); s.id = 'conv-menu-css';
  s.textContent = `
    .conv-menu{position:fixed; top:48px; right:8px; z-index:9999; background:#fff; border:1px solid #e5e7eb; border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,.08); padding:6px; display:none; min-width:220px}
    .conv-menu.open{display:block}
    .conv-menu button{display:block; width:100%; text-align:left; padding:10px 12px; background:none; border:0; border-radius:6px; font-size:14px; cursor:pointer}
    .conv-menu button:hover{background:#f5f7fb}
    .conv-menu button.danger{color:#b91c1c}
  `;
  document.head.appendChild(s);
})();

function ensureConvMenu() {
  if (CONV_MENU) return CONV_MENU;
  const menu = document.createElement('div');
  menu.className = 'conv-menu';
  menu.innerHTML = `
    <button type="button" id="btnViewMembers"  style="display:none">👥 Members</button>
    <button type="button" id="btnEditGroup"    style="display:none">✏️ Edit group chat</button>
    <button type="button" id="btnLeaveGroup"   style="display:none">🚪 Leave group</button>
    <button type="button" class="danger" id="btnDeleteConv">🗑️ Delete conversation</button>
  `;
  // Force inline positioning so CSS can’t hide it
  menu.style.position = 'fixed';
  menu.style.zIndex   = '2147483647'; // max z-index
  menu.style.display  = 'none';
  document.body.appendChild(menu);
  CONV_MENU = menu;
  return menu;
}

function positionConvMenu(anchorEl){
  if (!anchorEl || !CONV_MENU) return;
  const r = anchorEl.getBoundingClientRect();
  const gap = 6;
  CONV_MENU.style.top   = (r.bottom + gap) + 'px';
  CONV_MENU.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
}

async function showMenu(anchorEl = document.querySelector('#convMenuBtn')) {
  const menu = ensureConvMenu();
  positionConvMenu(anchorEl);

  const btnMembers = menu.querySelector('#btnViewMembers');
  const btnEdit    = menu.querySelector('#btnEditGroup');
  const btnLeave   = menu.querySelector('#btnLeaveGroup');
  const btnDelete  = menu.querySelector('#btnDeleteConv');

  // Hide everything by default
  [btnMembers, btnEdit, btnLeave, btnDelete].forEach(b => { if (b) b.style.display = 'none'; });

  // Figure out DM vs Group from the loaded thread list (no network call yet)
  const t = (window.__THREADS || []).find(x => String(x.thread_id) === String(CURRENT_THREAD));
  const isGroupFromList = t?.other?.role === 'group' || CURRENT_IS_GROUP === true;

  // Only fetch meta if it's a group
  let meta = null, isGroup = isGroupFromList, isOwner = false;
  if (isGroupFromList) {
    try {
      meta = await fetchGroupMeta(CURRENT_THREAD, { fresh: true });
      isGroup = !!meta?.group;

      if (isGroup) {
        const ownerRole = meta.group?.creator?.role ?? meta.group?.created_by_role;
        const ownerId   = String(meta.group?.creator?.id ?? meta.group?.created_by_id);
        isOwner = (ME?.role === ownerRole) && (String(ME?.id) === ownerId);

        // Group-specific items
        btnMembers.style.display = 'block';
        if (isOwner) btnEdit.style.display = 'block';
        else if (meta.me_is_member === true) btnLeave.style.display = 'block';
      }
    } catch {
      // If meta fails, treat as DM so the menu still works
      isGroup = false;
    }
  }

  // Delete:
  // - allowed for DMs
  // - allowed for group owner only
  const canDelete = (!isGroup) || isOwner;
  if (canDelete) btnDelete.style.display = 'block';

  // Wire actions
  btnMembers.onclick = async () => {
    menu.classList.remove('open'); menu.style.display = 'none';
    const fresh = meta?.group ? meta : await fetchGroupMeta(CURRENT_THREAD, { fresh:true });
    if (!fresh?.group) return alert('Could not load members.');
    openMembersModal(fresh);
  };

  btnEdit.onclick = async () => {
    menu.classList.remove('open'); menu.style.display = 'none';
    const fresh = await fetchGroupMeta(CURRENT_THREAD, { fresh:true });
    if (!fresh?.group || fresh.me_is_creator !== true) return alert('Only the owner can edit this group.');
    openEditGroupModal(fresh);
  };

  btnLeave.onclick = () => {
    menu.classList.remove('open'); menu.style.display = 'none';
    openConfirmLeave(meta ?? { group: { group_name: t?.other?.name || '' } });
  };

  btnDelete.onclick = () => {
    menu.classList.remove('open'); menu.style.display = 'none';
    if (!CURRENT_THREAD) { alert('No conversation selected.'); return; }
    openConfirmDelete(
      CURRENT_THREAD,
      t?.other?.name || '',
      /* isGroup */ isGroup,
      /* isOwner */ isOwner
    );
  };

  // Toggle open/close
  const willOpen = !menu.classList.contains('open');
  if (willOpen) {
    menu.classList.add('open');
    menu.style.display = 'block';
    const onEsc  = e => { if (e.key === 'Escape') { menu.classList.remove('open'); menu.style.display='none'; document.removeEventListener('keydown', onEsc); } };
    const onAway = e => { if (!menu.contains(e.target) && e.target !== anchorEl) { menu.classList.remove('open'); menu.style.display='none'; document.removeEventListener('click', onAway, true); } };
    document.addEventListener('keydown', onEsc);
    setTimeout(()=>document.addEventListener('click', onAway, true), 0);
  } else {
    menu.classList.remove('open');
    menu.style.display = 'none';
  }
}


function openConfirmLeave(meta){
  const overlayId = 'leave-confirm-overlay';
  document.getElementById(overlayId)?.remove();

  const wrap = document.createElement('div');
  wrap.id = overlayId;
  Object.assign(wrap.style, {
    position:'fixed', inset:'0', background:'rgba(0,0,0,.45)',
    display:'flex', alignItems:'center', justifyContent:'center', zIndex:'2147483647'
  });

  const card = document.createElement('div');
  Object.assign(card.style, {
    width:'min(440px,92vw)', background:'#fff', borderRadius:'12px',
    boxShadow:'0 18px 60px rgba(0,0,0,.25)', overflow:'hidden'
  });

  const head = document.createElement('div');
  head.textContent = 'Leave group?';
  Object.assign(head.style, {
    fontWeight:'700', padding:'14px 16px', borderBottom:'1px solid #e5e7eb'
  });

  const body = document.createElement('div');
  const name = meta?.group?.group_name || 'this group';
  body.innerHTML =
    `<div style="padding:14px 16px; color:#374151">
       You’ll be removed from <b>${name}</b> and stop receiving new messages.
     </div>`;

  const foot = document.createElement('div');
  Object.assign(foot.style, {
    display:'flex', gap:'8px', justifyContent:'flex-end',
    padding:'12px 16px', borderTop:'1px solid #e5e7eb'
  });

  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  Object.assign(cancel.style, { padding:'8px 12px', borderRadius:'10px', border:'1px solid #e5e7eb', background:'#fff' });
  cancel.onclick = () => wrap.remove();

  const leave = document.createElement('button');
  leave.textContent = 'Leave group';
  Object.assign(leave.style, { padding:'8px 12px', borderRadius:'10px', border:'0', background:'#ef4444', color:'#fff' });
  leave.onclick = async () => {
    leave.disabled = true;
    try {
      await leaveCurrentGroup();     // calls backend
      wrap.remove();
      // exit the thread in UI
      CURRENT_THREAD = null;
      await refreshThreads();
    } catch (e) {
      leave.disabled = false;
      alert('Could not leave the group. Please try again.');
    }
  };

  foot.append(cancel, leave);
  card.append(head, body, foot);
  wrap.appendChild(card);
  wrap.addEventListener('click', (e)=>{ if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}



// Compatibility shim in case old code still calls toggleConvMenu(...)
function toggleConvMenu(anchorEl){ showMenu(anchorEl); }
// ===== end conversation menu =====



function escapeHtml(s){
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}



  function mediaUrl(rel){ return (PROJECT_BASE || '') + '/' + String(rel||'').replace(/^\/+/, ''); }
// Convert whatever the API gives us into a usable avatar URL
function avatarUrl(u) {
  const cand = [
    u?.avatar, u?.avatar_url, u?.avatarPath,
    u?.photo, u?.photo_url, u?.profile_photo, u?.profile_pic,
    u?.image, u?.picture
  ].find(v => v && typeof v === 'string');

  const a = cand || '';
  if (/^https?:\/\//i.test(a)) return a;      // absolute URL
  const rel = a.replace(/^\//, '');            // normalise /uploads/... → uploads/...
  return mediaUrl(rel || 'Images/profile.png'); // final fallback
}



// Ensure the 3-dots button exists on load
(function(){ try{ ensureConvMenuButton(); }catch{} })();

async function getMe() {
  try {
    const r = await apiJSON('/api/auth/me.php');
    if (r && r.ok) {
      const m = r.me || {};
      // keep role/id, but also save a nice display name + email + (optional) avatar
      if (m.role === 'adviser') {
        ME = {
          role: 'adviser',
          id:   m.adviser_id || m.id,
          name: m.name || [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(' ') || m.sti_email || 'Adviser',
          sti_email: m.sti_email || ''
        };
      } else {
        ME = {
          role: 'student',
          id:   m.student_id || m.id,
          name: m.name || [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(' ') || m.sti_email || 'Student',
          sti_email: m.sti_email || ''
        };
      }
    }
  } catch {}
}


  // ---------- CHAT CSS (compact bubbles, timestamps, typing dots) ----------
  (function enforceChatCSS(){
    const s = document.createElement('style');
    s.id = 'chat-hardening';
    s.textContent = `
      #convBody{ display:flex; flex-direction:column; gap:10px; padding:8px 14px 88px; }
      #convBody > .msg{ display:inline-flex; flex-direction:column; align-self:flex-start; width:max-content; max-width:min(34ch,56%); margin:6px 0; }
      #convBody > .msg.you{ align-self:flex-end; margin-left:auto; align-items:flex-end; }
      #convBody > .msg .bubble{ display:inline-block; min-width:0; width:max-content; max-width:100%; padding:6px 10px; line-height:1.25; white-space:normal; word-break:break-word; overflow-wrap:anywhere; border-radius:14px; }
      #convBody > .msg.them .bubble{ background:#f3f4f6; color:#111; border-top-left-radius:6px; }
      #convBody > .msg.you  .bubble{ background:#4f46e5; color:#fff; border-top-right-radius:6px; }
      #convBody > .msg .bubble .msg-time.in{ margin-top:4px; font-size:11px; opacity:.72; line-height:1; text-align:right; }
      #convBody > .msg.them .bubble .msg-time.in{ text-align:left; }
      #convBody > .msg .msg-time.out{ margin-top:6px; font-size:12px; opacity:.85; line-height:1; color:#111; }
      #convBody > .msg.att .bubble{ padding:0; max-width:min(22rem,70vw); }
      #convBody > .msg.att .bubble img, #convBody > .msg.att .bubble video{ display:block; width:100%; height:auto; border-radius:12px; }
      .typing .bubble{ background:#f3f4f6; color:#111; }
      .typing-dots{ display:inline-flex; gap:4px; align-items:center; }
      .typing-dots i{ width:6px; height:6px; border-radius:50%; background:currentColor; opacity:.4; display:inline-block; animation:typing-blink 1.2s infinite; }
      .typing-dots i:nth-child(2){ animation-delay:.15s } .typing-dots i:nth-child(3){ animation-delay:.30s }
      @keyframes typing-blink{ 0%,80%,100%{opacity:.25} 40%{opacity:.95} }
    `;
    document.head.appendChild(s);
  })();

  (function ensureMembersCSS(){
  if (document.getElementById('members-css')) return;
  const s = document.createElement('style'); s.id = 'members-css';
  s.textContent = `
    .mem-row{display:flex;align-items:center;gap:12px;padding:8px 6px;border-bottom:1px solid #eee;}
    .mem-avatar{width:36px;height:36px;border-radius:9999px;background:#e5e7eb center/cover no-repeat;}
    .mem-main{flex:1;display:flex;flex-direction:column}
    .mem-name{font-weight:600}
    .mem-badges{margin-top:2px}
    .badge{display:inline-block;font-size:11px;padding:2px 6px;border-radius:9999px;background:#f3f4f6;color:#374151;margin-right:6px;border:1px solid #e5e7eb}
    .badge.owner{background:#eef2ff;color:#3730a3;border-color:#c7d2fe}
    .badge.role{background:#ecfeff;color:#155e75;border-color:#a5f3fc}
    #mmList{max-height:50vh;overflow:auto}
  `;
  document.head.appendChild(s);
})();


  (function addSystemNoteCSS(){
  const s = document.createElement('style');
  s.textContent = `
    #convBody .sys-note{
      margin:6px auto; max-width:80%; text-align:center;
      font-size:12px; line-height:1.4; opacity:.95;
    }
    #convBody .sys-note.event{
      padding:4px 8px; border:1px solid #e5e7eb; border-radius:8px;
      background:#f9fafb; color:#374151;
    }
  `;
  document.head.appendChild(s);
})();

(function addMenuCSS(){
  const s = document.createElement('style');
  s.textContent = `
    /* confirm modal ONLY (removed .conv-menu styles to avoid conflicts) */
    #confirm-modal{
      position:fixed; inset:0; background:rgba(0,0,0,.45);
      display:flex; align-items:center; justify-content:center; z-index:99999;
    }
    #confirm-modal .card{
      background:#fff; border-radius:12px; padding:16px; width:min(420px,92vw);
      box-shadow:0 12px 40px rgba(0,0,0,.3);
    }
    #confirm-modal h3{ margin:0 0 6px; font-size:16px; }
    #confirm-modal p{ margin:0; color:#6b7280; }
    #confirm-modal .actions{ display:flex; justify-content:flex-end; gap:8px; margin-top:14px; }
    #confirm-modal .btn{ padding:8px 12px; border-radius:10px; border:0; cursor:pointer; }
    #confirm-modal .btn.cancel{ background:#e5e7eb; color:#111; }
    #confirm-modal .btn.danger{ background:#b91c1c; color:#fff; }
  `;
  document.head.appendChild(s);
})();


(function addGroupCSS(){
  const s = document.createElement('style');
  s.textContent = `
    .btn-new-group{ padding:6px 10px; border:1px solid #e5e7eb; background:#fff; border-radius:10px; cursor:pointer; }
    .btn-new-group:hover{ background:#f9fafb; }

    #group-modal{ position:fixed; inset:0; background:rgba(0,0,0,.42); display:flex; align-items:center; justify-content:center; z-index:99999; }
    #group-modal .card{ background:#fff; border:1px solid #e5e7eb; border-radius:14px; width:min(640px,94vw); padding:14px 14px 12px; box-shadow:0 12px 28px rgba(2,6,23,.18); }
    #group-modal h3{ margin:0 0 8px; }
    .gfield{ display:flex; flex-direction:column; gap:6px; margin-top:8px; }
    .grow-row{ display:flex; gap:10px; align-items:center; }
    .gchips{ display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
    .gchip{ display:inline-flex; align-items:center; gap:6px; padding:6px 8px; border:1px solid #e5e7eb; border-radius:9999px; }
    .gchip button{ border:0; background:transparent; cursor:pointer; }
    .g-actions{ display:flex; justify-content:flex-end; gap:8px; margin-top:12px; }
    .g-actions .btn{ padding:8px 12px; border-radius:10px; border:1px solid #e5e7eb; background:#fff; }
    .g-actions .btn.primary{ background:#2563eb; border-color:#2563eb; color:#fff; }
    .avatar-preview{ width:40px; height:40px; border-radius:50%; object-fit:cover; background:#f3f4f6; border:1px solid #e5e7eb; }
  `;
  document.head.appendChild(s);
})();



  function closeImageViewer(){
  const v = document.getElementById('img-viewer');
  if (v) v.remove();
  document.body.classList.remove('no-scroll');
  if (window.__imgvEsc) {
    document.removeEventListener('keydown', window.__imgvEsc);
    window.__imgvEsc = null;
  }
}

function openImageViewer(src, alt = ''){
  closeImageViewer(); // ensure only one
  const v = document.createElement('div');
  v.id = 'img-viewer';
  v.innerHTML = `
    <img src="${src}" alt="${alt ? String(alt).replace(/"/g,'&quot;') : ''}">
    <button class="imgv-close" aria-label="Close">✕</button>
  `;
  // close on backdrop click (but not on image click)
  v.addEventListener('click', (e) => { if (e.target === v) closeImageViewer(); });
  v.querySelector('.imgv-close').addEventListener('click', closeImageViewer);
  document.body.appendChild(v);
  document.body.classList.add('no-scroll');

  // close on ESC
  window.__imgvEsc = (e) => { if (e.key === 'Escape') closeImageViewer(); };
  document.addEventListener('keydown', window.__imgvEsc);
}


  // ---------- SEARCH ----------
  function ensureSearchPop() {
    if (SEARCH_POP) return SEARCH_POP;
    const pop = document.createElement('div');
    pop.className = 'search-pop';
    pop.innerHTML = '<ul role="list"></ul>';
    els.search?.parentElement && (els.search.parentElement.style.position = 'relative',
                                  els.search.parentElement.appendChild(pop));
    SEARCH_POP = pop; return pop;
  }
  function hideSearchPop(){ if (SEARCH_POP) SEARCH_POP.hidden = true; }

function showSearchResults(items){
  const pop = ensureSearchPop();
  const ul  = pop.querySelector('ul');
  const notMe = (u) => !(String(u.id) === String(ME.id) && u.role === ME.role);
  ul.innerHTML = '';

  items.forEach(u => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="sp-row" role="button" tabindex="0" aria-label="Message ${u.name}">
        <img class="sp-ava" src="${avatarUrl(u)}" alt="">
        <div class="sp-text">
          <div class="sp-name">${u.name}</div>
          <div class="sp-sub">${u.role === 'adviser' ? 'Adviser' : 'Student'}</div>
        </div>
      </div>`;

    const select = async () => {
      hideSearchPop();
      let tid = null;
      try {
        const r = await apiJSON('/api/messages/thread_start_or_get.php', {
          method: 'POST',
          body: new URLSearchParams({ role: u.role, id: String(u.id) })
        });
        tid = r?.thread_id ?? r?.threadId ?? r?.id ?? null;
      } catch (err) { console.warn('start thread failed', err); }

      if (tid) {
        ensureThreadInList(tid, { name:u.name, role:u.role, avatar:u.avatar }, '', { pending:true });

        $$('.thread.is-active').forEach(x => x.classList.remove('is-active'));
        els.list.querySelector(`[data-tid="${tid}"]`)?.classList.add('is-active');
        openThread(tid, u);
      }

      await refreshThreads();

      if (!tid && Array.isArray(window.__THREADS)) {
        const hit = window.__THREADS.find(t =>
          String(t?.other?.id) === String(u.id) && t?.other?.role === u.role
        );
        if (hit) {
          $$('.thread.is-active').forEach(x => x.classList.remove('is-active'));
          els.list.querySelector(`[data-tid="${hit.thread_id}"]`)?.classList.add('is-active');
          openThread(hit.thread_id, u);
        } else {
          alert('Could not open the conversation. Please try again.');
        }
      }
    };

    const row = li.querySelector('.sp-row');
    row.addEventListener('click', select);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
    });

    ul.appendChild(li);
  });

  // Limit visible height to exactly 6 rows (scroll if more)
  requestAnimationFrame(() => {
    const row = ul.querySelector('.sp-row');
    if (row) {
      const styles = getComputedStyle(pop);
      const pad = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const h   = row.getBoundingClientRect().height;
      pop.style.maxHeight = Math.ceil(h * 6 + pad) + 'px';
      pop.style.overflowY = 'auto';
    }
  });

  pop.hidden = false;
}




  let searchTimer = null;
  els.search?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = els.search.value.trim();
    if (!q) { hideSearchPop(); return; }
    searchTimer = setTimeout(async () => {
      const r = await apiJSON('/api/messages/search_users.php?q=' + encodeURIComponent(q));
      const items = Array.isArray(r.items) ? r.items.filter(notMe) : [];
showSearchResults(items);   // or whatever function you call to render the list

showSearchResults(items.filter(notMe));
    }, 220);
  });
  document.addEventListener('click', e => {
    if (!SEARCH_POP) return;
    if (!SEARCH_POP.contains(e.target) && e.target !== els.search) hideSearchPop();
  });

  // Catch clicks on any common "three dots" element in the conversation header
document.addEventListener('click', (e) => {
  const btn = e.target.closest(
    '#convMenuBtn, [data-conv-menu], .conv-menu-btn, .btn-more, .btn-menu, .menu-dots, .kebab, .more, .bi-three-dots, .bi-three-dots-vertical'
  );
  if (btn) {
    e.preventDefault();
    e.stopPropagation();
     showMenu(btn);
    return;
  }
});


// Keep it aligned if the window resizes
window.addEventListener('resize', () => {
  if (CONV_MENU && CONV_MENU.classList.contains('open')) {
    // Reposition relative to the last anchor if we still have it under the cursor
    // (fallback: keep current right/top if anchor is gone)
    // No-op here is fine; menu stays usable.
  }
});


  // ---------- LIST ----------
function ensureThreadInList(tid, other, lastText = '', opts = {}) {
  if (els.list.querySelector(`[data-tid="${tid}"]`)) return;
  const li = document.createElement('li');
  li.className = 'thread';
  li.dataset.tid = tid;
  try { li.dataset.other = JSON.stringify(other || {}); } catch {}

  if (opts.pending) {
    li.dataset.pending = '1';
    li.dataset.freezeSnippet = '1';   // ⟵ freeze snippet until first real msg
    li.classList.add('pending');
  }

  li.innerHTML = `
    <div class="avatar" style="background-image:url('${avatarUrl(other)}'); background-size:cover;"></div>
    <div>
      <div class="name">${other?.name || '—'}</div>
      <div class="snippet">${lastText || '—'}</div>
    </div>
    <div class="time"></div>`;

  // force dash for pending rows no matter what lastText was
  if (li.dataset.pending === '1') {
    li.querySelector('.snippet')?.replaceChildren(document.createTextNode('—'));
  }

  li.addEventListener('click', () => {
    $$('.thread.is-active').forEach(x => x.classList.remove('is-active'));
    li.classList.add('is-active');
    openThread(tid, other);
  });
  els.list.prepend(li);
}


function markNotPending(tid){
  const li = els.list.querySelector(`.thread[data-tid="${tid}"]`);
  if (!li) return;
  li.classList.remove('pending');
  li.removeAttribute('data-pending');
  li.removeAttribute('data-freeze-snippet'); // ⟵ allow snippet to update now
}


function maybeRemovePendingOnLeave(){
  const prev = CURRENT_THREAD;
  if (!prev) return;
  const row = els.list.querySelector(`.thread[data-tid="${prev}"]`);
  if (!row || row.dataset.pending !== '1') return;
  const hasMsgs = !!els.body?.querySelector('.msg');
  if (!hasMsgs) row.remove();
}


function markNotPending(tid){
  const li = els.list.querySelector(`.thread[data-tid="${tid}"]`);
  if (!li) return;
  li.classList.remove('pending');
  li.removeAttribute('data-pending');
}

function maybeRemovePendingOnLeave(){
  // Only called while the *previous* thread is still rendered in els.body
  const prev = CURRENT_THREAD;
  if (!prev) return;
  const row = els.list.querySelector(`.thread[data-tid="${prev}"]`);
  if (!row || row.dataset.pending !== '1') return;
  // If the visible conversation has no real messages (.msg), drop the temp row
  const hasMsgs = !!els.body?.querySelector('.msg');
  if (!hasMsgs) row.remove();
}


async function applyUnreadBadges(){
  try{
    const r = await apiJSON('/api/messages/unread_counts.php?ts=' + Date.now());
    const items = Array.isArray(r?.items) ? r.items : [];
    const map = new Map(items.map(x => [String(x.thread_id), Number(x.unread || 0)]));

    $$('.thread').forEach(li => {
      const tid = li.dataset.tid;
      const n = map.get(String(tid)) || 0;
      let b = li.querySelector('.unread-badge');

      if (n > 0){
        if (!b){
          b = document.createElement('span');
          b.className = 'unread-badge';
          li.appendChild(b);
        }
        b.textContent = n > 99 ? '99+' : String(n);
        li.classList.add('unread');
      } else {
        b?.remove();
        li.classList.remove('unread');
      }
    });
  } catch(e){
    // silent; UI just won't show badges if it fails
  }
}

function clearUnread(tid){
  const li = els.list?.querySelector(`.thread[data-tid="${tid}"]`);
  if (!li) return;
  li.classList.remove('unread');
  li.querySelector('.unread-badge')?.remove();
}
  

async function refreshThreads() {
  const r = await apiJSON('/api/messages/list_threads.php');

  // 1) Start from items
  let items = Array.isArray(r?.items) ? r.items.filter(Boolean) : [];

  // 2) Dedupe by thread_id; keep the newest by last_time (then last_id)
  const map = new Map();
  for (const t of items) {
    const key = String(t.thread_id);
    const prev = map.get(key);
    if (!prev) { map.set(key, t); continue; }

    const tTime = Date.parse(t.last_time || 0);
    const pTime = Date.parse(prev.last_time || 0);
    if (tTime > pTime) { map.set(key, t); continue; }
    if (tTime === pTime && (Number(t.last_id||0) > Number(prev.last_id||0))) {
      map.set(key, t);
    }
  }

  // 3) Sort newest first
  THREADS = [...map.values()].sort((a,b)=>{
    const ta = Date.parse(a.last_time || 0), tb = Date.parse(b.last_time || 0);
    if (tb !== ta) return tb - ta;
    return Number(b.last_id||0) - Number(a.last_id||0);
  });
  window.__THREADS = THREADS;

  // Snapshot temporary (pending) rows so refresh won’t erase them
const __pending = [];
els.list.querySelectorAll('.thread.pending').forEach(li => {
  const tid = li.dataset.tid;
  let other = null;
  try { other = JSON.parse(li.dataset.other || 'null'); } catch {}
const snippet = li.dataset.pending === '1' ? '—'
               : (li.querySelector('.snippet')?.textContent || '—');
  __pending.push({ tid, other, snippet });
});

  // 4) Render
  els.list.innerHTML = '';

  THREADS.forEach(t => {
    const li = document.createElement('li');
    li.className = 'thread';
    li.dataset.tid = t.thread_id;

    const lastMedia = (t.last_media && t.last_media !== 'none') ? `[${t.last_media}]` : '—';
    let base = (t.last_text || '').trim() || lastMedia;

    // System note? -> strip marker & pretty; never prefix "You:"
    const isSys = /^\[sys\]\s*/i.test(base);
    if (isSys) base = rehydrateSystemNote(base.replace(/^\[sys\]\s*/i, ''));

    const row = els.list.querySelector(`.thread[data-tid="${t.thread_id}"]`);
const isFrozen = row?.dataset.freezeSnippet === '1' || row?.dataset.pending === '1';

let label;
if (isFrozen) {
  label = '—';
} else {
  label = base;
  if (!isSys) {
    const isMine =
      t.last_from_me === true ||
      String(t.last_who || '').toLowerCase() === 'you' ||
      t.last_is_you === true;
    if (isMine && base !== '—') label = `You: ${base}`;
  }
}
    li.innerHTML = `
      <div class="avatar" style="background-image:url('${avatarUrl(t.other)}'); background-size:cover;"></div>
      <div>
        <div class="name">${t?.other?.name || '—'}</div>
        <div class="snippet">${label}</div>
      </div>
      <div class="time">${t.last_time ? new Date(t.last_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}</div>
    `;

    li.addEventListener('click', () => {
      $$('.thread.is-active').forEach(x => x.classList.remove('is-active'));
      li.classList.add('is-active');
      openThread(t.thread_id, t.other);
    });

    els.list.appendChild(li);

    // keep highlight if already selected
    if (CURRENT_THREAD && String(t.thread_id) === String(CURRENT_THREAD)) {
      li.classList.add('is-active');
    }
  });
  // Re-add any local pending rows that the server doesn’t know about yet
for (const p of __pending) {
  if (!els.list.querySelector(`[data-tid="${p.tid}"]`)) {
    ensureThreadInList(p.tid, p.other || {}, p.snippet, { pending: true });
    // keep selection highlight if we’re currently viewing it
    if (CURRENT_THREAD && String(p.tid) === String(CURRENT_THREAD)) {
      els.list.querySelector(`[data-tid="${p.tid}"]`)?.classList.add('is-active');
    }
  }
}
  applyUnreadBadges();

  // auto-open most recent if none selected
  if (!CURRENT_THREAD && THREADS.length > 0) {
    const first = THREADS[0];
    els.list.querySelector(`[data-tid="${first.thread_id}"]`)?.classList.add('is-active');
    openThread(first.thread_id, first.other);
  }

  // hydrate missing avatars
  for (const t of THREADS) {
    if (!t?.other?.avatar && t?.other?.role !== 'group') {
      hydrateOther(t.other).then(o => {
        if (o?.avatar) {
          const row = els.list.querySelector(`.thread[data-tid="${t.thread_id}"] .avatar`);
          if (row) row.style.backgroundImage = `url('${avatarUrl(o)}')`;
        }
      }).catch(()=>{});
    }
  }
}




function updateThreadSnippet(tid, { text, mediaType, time, fromMe }) {
  const row = els.list.querySelector(`.thread[data-tid="${tid}"]`);
  if (!row) return;

  const sn = row.querySelector('.snippet');

  // Keep dash for fresh/pending rows until first real message (markNotPending clears these)
  const isFrozen = row.dataset.freezeSnippet === '1' || row.dataset.pending === '1';

  let label = '—';
  if (!isFrozen) {
    if (text && String(text).trim()) {
      label = (fromMe === true ? 'You: ' : '') + text;
    } else if (mediaType && mediaType !== 'none') {
      label = `[${mediaType}]`;
    }
  }
  sn.textContent = label;

  // Time label (still okay to update even when frozen)
  const t = new Date(time || Date.now());
  row.querySelector('.time').textContent = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}


  // ---------- REALTIME (SSE + Typing) ----------
function showTypingDots(){
  clearTimeout(TYPING_TIMER);
  if (!TYPING_EL) {
    TYPING_EL = document.createElement('div');
    TYPING_EL.className = 'msg them typing';
    const b = document.createElement('div');
    b.className = 'bubble';
    b.innerHTML = `<span class="typing-dots"><i></i><i></i><i></i></span>`;
    TYPING_EL.appendChild(b);
    els.body.appendChild(TYPING_EL);
    scrollToEnd();
  }
  // hide quickly after last typing pulse (1.5s)
  TYPING_TIMER = setTimeout(() => { TYPING_EL?.remove(); TYPING_EL = null; }, 1500);
}

function notifyTyping(e){
  // don't emit during cool-off (right after sending)
  const now = Date.now();
  if (now < typingSuppressUntil) return;

  // must be focused on the input
  if (document.activeElement !== els.input) return;

  // ignore non-text keys when using keydown
  if (e && e.type === 'keydown') {
    const k = e.key || '';
    if (
      k === 'Enter' || k === 'Tab' || k === 'Escape' ||
      k.startsWith('Arrow') || k === 'Shift' || k === 'Control' ||
      k === 'Alt' || k === 'Meta'
    ) return;
  }

  // don't emit when input is empty/whitespace
  if (!els.input.value || els.input.value.trim().length === 0) return;

  // throttle: you already had lastTypingSent + 700ms
  const now2 = Date.now();
  if (now2 - lastTypingSent < 700) return;
  lastTypingSent = now2;

  // send the signal
  fetch((PROJECT_BASE||'')+'/api/messages/typing.php', {
    method:'POST',
    credentials:'same-origin',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({ thread_id:String(CURRENT_THREAD) })
  }).catch(()=>{});
}

// Pull anything newer than LAST_MSG_ID for the current thread.
// Safe to call repeatedly; it de-dupes and bumps LAST_MSG_ID.
async function fetchNewer() {
  if (!CURRENT_THREAD) return;
  try {
    const r = await apiJSON(
      `/api/messages/get.php?thread_id=${CURRENT_THREAD}&after_id=${encodeURIComponent(LAST_MSG_ID || 0)}&limit=120`
    );
    const items = Array.isArray(r.items) ? r.items : [];
    if (!items.length) return;
for (const it of items) {
  const msg = normalizeMsg(it);
const k = msgKey(msg);
if (els.body.querySelector(`[data-key="${k}"]`)) continue;
if (msg.id && els.body.querySelector(`.msg[data-mid="${msg.id}"]`)) continue;

  const cut = Number(DM_HIDE_BEFORE[CURRENT_THREAD] || 0);
  if (!CURRENT_IS_GROUP && cut && Number(msg.id || 0) <= cut) continue;
markNotPending(CURRENT_THREAD);
  renderMsg(msg);
}


    // Move our floor forward and keep UI pinned
    const maxId = Math.max(...items.map(x => Number(x.id || 0)));
    if (isFinite(maxId)) LAST_MSG_ID = Math.max(LAST_MSG_ID || 0, maxId);
    scrollToEnd();
  } catch (err) {
    console.warn('fetchNewer failed', err);
  }
}


  function stopSSE(){
    try { SSE?.close(); } catch {}
    SSE = null;
  }

function startSSE(){
  if (!CURRENT_THREAD) return;
  stopSSE();
  const cacheBuster = Date.now();
  const url = (PROJECT_BASE||'') + `/api/messages/sse.php?thread_id=${encodeURIComponent(CURRENT_THREAD)}&after_id=${encodeURIComponent(LAST_MSG_ID || 0)}&v=${cacheBuster}`;
  SSE = new EventSource(url);

  SSE.addEventListener('open',  () => console.log('[SSE] open'));
  SSE.addEventListener('error', (e) => console.warn('[SSE] error', e));

SSE.addEventListener('hello', async (ev) => {
  console.log('[SSE] hello', ev.data);
  // Immediately catch up once the stream is live
  await fetchNewer();
  if (CURRENT_THREAD) refreshSeenUI(CURRENT_THREAD);
});

  SSE.addEventListener('fatal', (ev) => {
    console.error('[SSE] fatal', ev.data);  // this will show PHP error text if any
  });

SSE.addEventListener('messages', (ev) => {
 try {
    const payload = JSON.parse(ev.data);
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (items.length) {
      // any real message means the other user isn’t typing anymore
      if (TYPING_EL) { TYPING_EL.remove(); TYPING_EL = null; }

      for (const it of items) {
const msg = normalizeMsg(it);
if (String(msg.thread_id || '') !== String(CURRENT_THREAD)) {
  continue;
}
const k = msgKey(msg);
if (els.body.querySelector(`[data-key="${k}"]`)) continue;
if (msg.id && els.body.querySelector(`.msg[data-mid="${msg.id}"]`)) continue;

        // If this is *my* message and we still have a recent optimistic bubble
        // with the same text, remove the optimistic one to avoid duplicates.
        const isMine =
          (msg.sender_role === ME.role) &&
          ((ME.role === 'student' && String(msg.sender_student_id) === String(ME.id)) ||
           (ME.role === 'adviser' && String(msg.sender_adviser_id) === String(ME.id)));

        if (isMine && TEMP_LAST && TEMP_LAST.text === (msg.text || '')) {
          TEMP_LAST.el?.remove();
          TEMP_LAST = null;
        }



// Respect personal cutoff for DMs
const cut = Number(DM_HIDE_BEFORE[CURRENT_THREAD] || 0);
if (!CURRENT_IS_GROUP && cut && Number(msg.id || 0) <= cut) continue;
markNotPending(CURRENT_THREAD);
renderMsg(msg);
if (Number(msg.thread_id || CURRENT_THREAD) === Number(CURRENT_THREAD)) {
  if (msg.who !== 'you') {
    attachSeenLine('');              // clear when they reply
    markThreadSeen(CURRENT_THREAD);  // send my read
  } else {
    refreshSeenUI(CURRENT_THREAD);   // my message → recalc “Seen”
  }
}



      }
      scrollToEnd();

const last = items[items.length - 1] || {};
const lastIsMine =
  String(last.sender_role || '').toLowerCase() === String(ME.role || '').toLowerCase() ||
  String(last.sender_student_id || '') === String(ME.id) ||
  String(last.sender_adviser_id || '') === String(ME.id);

updateThreadSnippet(CURRENT_THREAD, {
  text: last.text || '',
  mediaType: last.media_type || 'none',
  fromMe: lastIsMine,
  time: last.created_at
});
const maxId = Math.max(...items.map(x => Number(x.id || 0)));
      if (isFinite(maxId)) LAST_MSG_ID = Math.max(LAST_MSG_ID || 0, maxId);
      scrollToEnd();

    }
  } catch (e) { console.warn('messages parse fail', e, ev.data); }
});


  SSE.addEventListener('typing', () => { showTypingDots(); });
}


  function normalizeMsg(m){
    LAST_MSG_ID = Math.max(LAST_MSG_ID, Number(m.id || 0));
    if (!m.who) {
      const isMe =
        (m.sender_role === ME.role) &&
        ((ME.role === 'student' && String(m.sender_student_id) === String(ME.id)) ||
         (ME.role === 'adviser' && String(m.sender_adviser_id) === String(ME.id)));
      m.who = isMe ? 'you' : 'them';
    }
    return m;
  }
  // ---- Group meta cache & checks --------------------------------------------
// cache: threadId -> meta
const GROUP_META_CACHE = new Map();

async function fetchGroupMeta(threadId, opts = {}) {
  const fresh = !!opts.fresh;
  if (!threadId) return null;
  if (!fresh && GROUP_META_CACHE.has(threadId)) return GROUP_META_CACHE.get(threadId);

  try {
    const url = `/api/messages/group_meta.php?thread_id=${encodeURIComponent(threadId)}${fresh ? `&t=${Date.now()}` : ''}`;
    const r = await apiJSON(url);
    if (r?.ok) {
      GROUP_META_CACHE.set(threadId, r);

      // Prime people cache so [sys] notes can show full names
      if (Array.isArray(r.members)) {
        for (const m of r.members) {
          PEOPLE_CACHE?.byKey?.set(`${m.role}:${m.id}`, m);
          if (m.sti_email) PEOPLE_CACHE?.byEmail?.set(String(m.sti_email).toLowerCase(), m);
        }
      }
      if (r?.group?.creator) {
        const ck = `${r.group.creator.role}:${r.group.creator.id}`;
        if (!PEOPLE_CACHE?.byKey?.has(ck)) {
          PEOPLE_CACHE?.byKey?.set(ck, { role: r.group.creator.role, id: r.group.creator.id, name: r.group.name });
        }
      }
      return r;
    }
  } catch (e) {
    // ignore
  }
  return null;
}


function showRemovedNote(){
  // Avoid duplicates
  if (els.body.querySelector('.sys-note.removed')) return;
  const note = document.createElement('div');
  note.className = 'sys-note removed';
  note.textContent = 'You have been removed from this group. You can still read past messages.';
  note.style.cssText = 'margin:8px auto 0; font-size:12px; opacity:.8; text-align:center;';
  els.body.appendChild(note);
  scrollToEnd();
}

function setComposerVisible(on){
  if (!els.composer) return;
  els.composer.style.display = on ? '' : 'none';
}


async function canEditGroup(threadId){
  // Must be a group + creator
  const meta = await fetchGroupMeta(threadId);
  return !!(meta && meta.group && meta.me_is_creator === true);
}

async function checkMyMembership(threadId){
  const meta = await fetchGroupMeta(threadId);
  // assume meta.me_is_member if your endpoint provides it; otherwise infer from members list
  if (!meta) return { isMember:true, meWasRemoved:false };
  if (typeof meta.me_is_member === 'boolean') return { isMember: meta.me_is_member, meWasRemoved: !meta.me_is_member };
  const list = Array.isArray(meta.members) ? meta.members : [];
  const amIn = list.some(m =>
    (m.role === ME.role) &&
    (String(m.id) === String(ME.id))
  );
  return { isMember: amIn, meWasRemoved: !amIn };
}


  // ---------- CONVERSATION ----------
async function hydrateOther(other){
  if (!other || other.avatar || other.role === 'group') return other;
  try {
    const r = await apiJSON(`/api/messages/get_profile.php?role=${other.role}&id=${encodeURIComponent(other.id)}`);
    if (r?.ok && r.profile?.avatar) other.avatar = r.profile.avatar;
  } catch {}
  return other;
}

function ensureConvMenuButton(){
  // Find a reasonable header container
  const header =
    document.querySelector('#convHeader') ||
    document.querySelector('.msg-header') ||
    document.querySelector('.messages-card .card-header, .messages-card .header') ||
    document.querySelector('#messagesHeader') ||
    document.querySelector('.messages-card');

  if (!header) return;

  // Create the button if it doesn't exist
  let btn = header.querySelector('#convMenuBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'convMenuBtn';
    btn.type = 'button';
    btn.setAttribute('data-conv-menu', '1'); // so our document click handler will catch it
    btn.title = 'Conversation menu';
    btn.style.cssText = 'margin-left:8px; padding:6px 8px; border:1px solid #e5e7eb; border-radius:10px; background:#fff; cursor:pointer;';
    btn.innerHTML = '⋮';
    // place on the right if possible
    header.appendChild(btn);
  }
}


function setHeaderFor(other){
  els.name.textContent   = other?.name || '—';
  els.status.textContent = other?.role === 'adviser' ? 'Adviser'
                         : other?.role === 'group'   ? 'Group'
                         : 'Student';
  if (els.ava) els.ava.style.backgroundImage = `url('${avatarUrl(other)}')`;
   ensureConvMenuButton();
}
maybeRemovePendingOnLeave();


// --- REPLACE your openThread with this version ---
async function openThread(threadId, other = null) {
  stopSSE();
  clearInterval(SEEN_TIMER);
  if (TYPING_EL) { TYPING_EL.remove(); TYPING_EL = null; }
  maybeRemovePendingOnLeave();
  CURRENT_THREAD = threadId;
  CURRENT_IS_GROUP = (other && other.role === 'group');
  localStorage.setItem('dm:last-thread', JSON.stringify({ threadId, other }));

  // find "other" from the left list if not provided
  if (!other) {
    const t = (window.__THREADS || []).find(x => String(x.thread_id) === String(threadId));
    other = t?.other || null;
  }

  // hydrate header (name, role, avatar)
  other = await hydrateOther(other);
 if (other) {
  // Always stamp header quickly with whatever we have
  els.name.textContent = other.name || '';
  els.status.textContent =
    other.role === 'adviser' ? 'Adviser' :
    other.role === 'group'   ? 'Group'   : 'Student';

  if (els.ava) {
    els.ava.style.backgroundImage    = `url('${avatarUrl(other)}')`;
    els.ava.style.backgroundSize     = 'cover';
    els.ava.style.backgroundRepeat   = 'no-repeat';
    els.ava.style.backgroundPosition = 'center';
  }

  // If this is a group, fetch fresh meta so the name/avatar is never stale
  if (other.role === 'group') {
    try {
      const meta = await fetchGroupMeta(threadId, { fresh: true });
      if (meta?.group) {
        setHeaderFor({ role: 'group', id: threadId, name: meta.group.name, avatar: meta.group.avatar });
        // warm the system-note name cache from membership list
        if (Array.isArray(meta.members)) {
          meta.members.forEach(u => {
            if (u.email) PEOPLE_CACHE.byEmail.set(u.email.toLowerCase(), u);
            PEOPLE_CACHE.byKey.set(`${u.role}:${u.id}`, u);
          });
        }
        // also reflect the name in the left thread row (if present)
        const row = els.list.querySelector(`[data-tid="${threadId}"] .name`);
        if (row) row.textContent = meta.group.name;
      }
    } catch {}
  }
}


  // fetch messages and apply personal cutoff for DMs
const r = await apiJSON(`/api/messages/get.php?thread_id=${threadId}&limit=200`);
let msgs = Array.isArray(r.items) ? r.items : [];
  if (other?.role !== 'group') msgs = applyCutoff(threadId, msgs);

  // mark which messages are mine vs theirs (needed on initial load)
msgs = msgs.map(m => {
  if (m && !m.who) {
    const isMe =
      String(m.sender_role || '').toLowerCase() === String(ME.role || '').toLowerCase() &&
      (
        (ME.role === 'student' && String(m.sender_student_id || '') === String(ME.id)) ||
        (ME.role === 'adviser' && String(m.sender_adviser_id || '') === String(ME.id))
      );
    m.who = isMe ? 'you' : 'them';
  }
  return m;
});


  // render
// render
// render
els.body.innerHTML = '';
const hadCutoff = (other?.role !== 'group') && Number(DM_HIDE_BEFORE[threadId] || 0) > 0;
if (hadCutoff && !msgs.length) {
  const note = document.createElement('div');
  note.className = 'sys-note event';
  note.textContent = 'You deleted previous messages. New messages will appear here.';
  els.body.appendChild(note);
}
msgs.forEach(m => renderMsg(m));

  LAST_MSG_ID = msgs.length ? Math.max(...msgs.map(x => Number(x.id || 0))) : 0;

  scrollToEnd();

  // composer visibility
  if (other?.role === 'group') {
    const mem = await checkMyMembership(threadId);
    if (!mem.isMember) {
      setComposerVisible(false);
      showRemovedNote();
    } else {
      setComposerVisible(true);
      els.body.querySelector('.sys-note.removed')?.remove();
    }
  } else {
    // DM: always allow typing (soft delete never blocks new messages)
    setComposerVisible(true);
    els.body.querySelector('.sys-note.removed')?.remove();
  }

  // ensure thread row exists and update its snippet using the *visible* last message
  if (other && !els.list.querySelector(`[data-tid="${threadId}"]`)) {
    const lastText = msgs.length ? (msgs[msgs.length - 1]?.text || '') : '';
    ensureThreadInList(threadId, other, lastText);
  } else {
const row = els.list.querySelector(`.thread[data-tid="${threadId}"]`);
if (row) {
  const isFrozen = row.dataset.freezeSnippet === '1' || row.dataset.pending === '1';
  const base = isFrozen ? '—' : (
    msgs.length
      ? (msgs[msgs.length - 1]?.text || (msgs[msgs.length - 1]?.media_type && msgs[msgs.length - 1].media_type !== 'none' ? '[media]' : '—'))
      : '—'
  );
  row.querySelector('.snippet')?.replaceChildren(document.createTextNode(base));
}
  }
if (!msgs.length) {
  const li = els.list.querySelector(`.thread[data-tid="${threadId}"]`);
  if (li) { li.dataset.pending = '1'; li.classList.add('pending'); }
} else {
  markNotPending(threadId);
}

  // mark seen + unread UI
  startSeenTracking(threadId);
  clearUnread(threadId);
  applyUnreadBadges();

  // start stream
  startSSE();
  setTimeout(fetchNewer, 80);
}




// ===== System note helpers (place above renderMsg) =====
function displayNameFromCacheByEmail(email){
  if (!email) return null;
  const hit = PEOPLE_CACHE?.byEmail?.get(String(email).toLowerCase());
  return hit?.name || null;
}
function displayNameFromCacheById(role, id){
  const hit = PEOPLE_CACHE?.byKey?.get(`${role}:${id}`);
  return hit?.name || null;
}
function rehydrateSystemNote(text){
  let out = String(text || '');

  // email -> full name (if known)
  out = out.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, (email) =>
    displayNameFromCacheByEmail(email) || email
  );

  // optional tokens like [person:adviser:2000123] -> name (won’t hurt if not present)
  out = out.replace(/\[person:(adviser|student):([^\]]+)\]/gi, (_, role, id) =>
    displayNameFromCacheById(role.toLowerCase(), String(id)) || `${role} ${id}`
  );

  return out.replace(/\s{2,}/g, ' ').trim();
}

// Global the editor uses
let EDIT_MEMBERS = []; // array of {role, id, name, avatar, ...}

function renderEditMembersChips(){
  const list = document.getElementById('editMembersList'); // whatever container you use
  if (!list) return;
  list.innerHTML = '';
  for (const m of EDIT_MEMBERS) {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerHTML = `
      <img class="chip-avatar" src="${avatarUrl(m)}" alt="">
      <span class="chip-name">${m.name}</span>
      <button type="button" class="chip-x" data-role="${m.role}" data-id="${m.id}">×</button>
    `;
    list.appendChild(chip);
  }
}

function wireChipRemove(){
  const list = document.getElementById('editMembersList');
  if (!list) return;
  list.addEventListener('click', (e) => {
    const x = e.target.closest('.chip-x');
    if (!x) return;
    const role = x.getAttribute('data-role');
    const id   = x.getAttribute('data-id');
    EDIT_MEMBERS = EDIT_MEMBERS.filter(m => !(String(m.role)===String(role) && String(m.id)===String(id)));
    renderEditMembersChips();
  });
}

// Call this to open the modal
function openEditGroupDialog(meta){
  // ... your existing code to show the modal ...

  // Rehydrate members list from FRESH meta
  EDIT_MEMBERS = Array.isArray(meta?.members) ? meta.members.slice() : [];
  renderEditMembersChips();
  wireChipRemove();

  // also prefill name/avatar fields from meta.group if you do that
  // e.g., nameInput.value = meta.group?.name || '';
}

// ===== System note helpers (put above renderMsg) =====
function displayNameFromCacheByEmail(email){
  if (!email) return null;
  const hit = PEOPLE_CACHE?.byEmail?.get(String(email).toLowerCase());
  return hit?.name || null;
}
function displayNameFromCacheById(role, id){
  const hit = PEOPLE_CACHE?.byKey?.get(`${role}:${id}`);
  return hit?.name || null;
}
function rehydrateSystemNote(text){
  let out = String(text || '');
  // 1) swap any email with a cached full name (if known)
  out = out.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    (email) => displayNameFromCacheByEmail(email) || email
  );
  // 2) optional token support: [person:adviser:2000123] or [person:student:2023...]
  out = out.replace(
    /\[person:(adviser|student):([^\]]+)\]/gi,
    (_, role, id) => displayNameFromCacheById(role.toLowerCase(), String(id)) || `${role} ${id}`
  );
  return out.replace(/\s{2,}/g, ' ').trim();
}

function firstWord(s){ return String(s || '').trim().split(/\s+/)[0] || ''; }

function bestFullName({ first_name, middle_name, last_name, name, email } = {}) {
  const full = [first_name, middle_name, last_name].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (name && !/@/.test(name)) return name.trim();
  return ''; // don't fall back to email for display names
}

// First + safe fallbacks (never show email, never "Member" if we can resolve)
async function getFirstNameForMessage(m){
  // 1) try fields carried with the message
let full = bestFullName({
  first_name:  m.sender_first,
  middle_name: m.sender_middle,
  last_name:   m.sender_last,
  name:        (CURRENT_IS_GROUP ? '' : m.sender_name), // ← ignore in groups
  email:       m.sender_email
});

  if (full) return firstWord(full);

  // 2) try the warmed PEOPLE_CACHE (group meta populates this)
  const rid = m.sender_role === 'adviser' ? (m.sender_adviser_id || m.sender_id)
                                          : (m.sender_student_id  || m.sender_id);
  const cached = PEOPLE_CACHE?.byKey?.get(`${m.sender_role}:${rid}`)?.name || '';
  if (cached) return firstWord(bestFullName({ name: cached }));

  // 3) lazy hydrate from get_profile.php
  if (typeof hydratePersonByRoleId === 'function') {
    const rec = await hydratePersonByRoleId(m.sender_role, rid);
    full = bestFullName(rec || {});
    if (full) return firstWord(full);
  }

  return 'Member';
}



function renderMsg(m){
  // ---- Centered system notes (join/leave/remove) ----
// ---- Centered system notes (join/leave/remove) ----
// ---- Centered system notes (join/leave/remove) ----
const sysText = (() => {
  const t = (m?.text || '').trim();
  if (!t.startsWith('[sys]')) return null;
  return t.replace(/^\[sys\]\s*/, '');
})();
if (sysText) {
  const pretty = rehydrateSystemNote(sysText, m); // resolve emails → full names
  const note = document.createElement('div');
  note.className = 'sys-note event';
  note.textContent = pretty;
note.dataset.key = msgKey(m);
  // NEW: carry the real message id on the element so “seen” can find it
  note.dataset.mid = String(m.id || '');

  els.body.appendChild(note);
  LAST_MSG_ID = Math.max(LAST_MSG_ID, Number(m.id || 0));
  return note; // no bubble
}
// ---------------------------------------------------

// ---------------------------------------------------

  // ---------------------------------------------------

  const div = document.createElement('div');
  div.className = 'msg ' + (m.who === 'you' ? 'you' : 'them') +
                  (m.media_type && m.media_type!=='none' ? ' att' : '');
if (m.id) div.dataset.mid = String(m.id);
div.dataset.key = msgKey(m);
  

  const bb = document.createElement('div');
  bb.className = 'bubble';
  bb.style.display = 'inline-block';
  bb.style.whiteSpace = 'normal';
  bb.style.wordBreak = 'break-word';
  bb.style.overflowWrap = 'anywhere';

  // Sender label for group incoming messages
// Sender label for group incoming messages (outside bubble for media)
// Sender label (GC). For media: outside; for text: inline above text, first-name only.
if (CURRENT_IS_GROUP && (m.who || '').toLowerCase() !== 'you') {
  const label = document.createElement('div');
  label.className = 'gc-from';
  label.textContent = '…'; // hydrate to first name shortly

  const putOutside = !!(m.media_type && m.media_type !== 'none');
  if (putOutside) {
    label.style.margin = '0 0 4px 10px';         // align with media bubble
    div.appendChild(label);                      // outside bubble
  } else {
    label.style.marginBottom = '4px';
    bb.prepend(label);                           // keep current inline look for text
  }

  // hydrate to first name (no full names here)
  getFirstNameForMessage(m).then(fn => { if (label.isConnected) label.textContent = fn; });
}



  if (m.text) {
    const p = document.createElement('p');
    p.textContent = String(m.text).replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ');
    p.style.margin = '0';
    bb.appendChild(p);
  }
  // inside renderMsg(m) BEFORE the normal bubble code
if (m?.text && /^\[sys\]\s*/i.test(m.text)) {
  const note = document.createElement('div');
  note.className = 'sys-note event';
  note.dataset.mid = String(m.id);                 // 👈 KEY: partake in "last message id"
  note.textContent = rehydrateSystemNote(m.text.replace(/^\[sys\]\s*/i, ''));
  els.body.appendChild(note);
  return;  // don't fall through to normal bubble rendering
}


  if (m.media_type && m.media_type!=='none' && m.media_path){
    if (m.media_type === 'image') {
      const img = document.createElement('img');
      img.src = mediaUrl(m.media_path);
      img.alt = m.text || 'image';
      img.style.maxWidth = '100%';
      img.style.borderRadius = '12px';
      img.style.cursor = 'pointer';
      img.addEventListener('click', () => openImageViewer(img.src, img.alt));
      bb.appendChild(img);
    } else {
      const v = document.createElement('video');
      v.controls = true;
      v.src = mediaUrl(m.media_path);
      v.style.maxWidth = '100%';
      v.style.borderRadius = '12px';
      bb.appendChild(v);
    }
  }

  const isMedia = m.media_type && m.media_type !== 'none' && m.media_path;
  if (!isMedia) {
    const tm = document.createElement('div');
    tm.className = 'msg-time in';
    tm.textContent = fmtTime(m.created_at);
    bb.appendChild(tm);
    div.appendChild(bb);
  } else {
    div.appendChild(bb);
    const tm = document.createElement('div');
    tm.className = 'msg-time out';
    tm.textContent = fmtTime(m.created_at);
    div.appendChild(tm);
  }

  els.body.appendChild(div);
  LAST_MSG_ID = Math.max(LAST_MSG_ID, Number(m.id || 0));
  return div;
}



  

  function fmtTime(ts){
    try { return new Date(ts.replace(' ','T')).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
    catch { return ''; }
  }
  function scrollToEnd(){ els.body.scrollTop = els.body.scrollHeight; }

  // ---------- COMPOSER ----------
// OPEN PICKER
els.plus?.addEventListener('click', () => els.picker.click());

// HANDLE FILES
els.picker?.addEventListener('change', async () => {
  if (!CURRENT_THREAD) return;

  const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB
  const notice = (title, msg) => (
    typeof openNotice === 'function'
      ? openNotice(title, msg)
      : alert(`${title}\n\n${msg}`)
  );

  const files = Array.from(els.picker.files || []);
  for (const file of files) {
    // 1) client-side 25MB guard (videos only)
    if (file && /^video\//i.test(file.type) && file.size > MAX_VIDEO_BYTES) {
      notice('File too large', 'Videos larger than 25 MB cannot be uploaded.');
      continue;
    }

    // 2) upload with JSON-safe parsing (handles 400 HTML errors)
    const fd = new FormData();
    fd.append('file', file);

    let j = null;
    try {
      const r   = await fetch((PROJECT_BASE || '') + '/api/messages/upload.php', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin'
      });
      const txt = await r.text();                               // <- don’t assume JSON
      try { j = JSON.parse(txt.replace(/^\uFEFF/, '')); } catch {}
      if (!r.ok || !j || j.ok === false) {
        if (r.status === 413 || /25\s*mb|too\s*large|payload|max_bytes/i.test(txt)) {
          notice('File too large', 'Videos larger than 25 MB cannot be uploaded.');
        } else {
          notice('Upload failed', 'We could not upload that file. Please try again.');
        }
        continue;
      }
    } catch {
      notice('Upload failed', 'We could not upload that file. Please try again.');
      continue;
    }

    // 3) send message with the uploaded media
    try {
      const s = await apiJSON('/api/messages/send.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          thread_id: String(CURRENT_THREAD),
          text: '',
          media_type: j.media_type,
          media_path: j.path
        })
      });
      markNotPending(CURRENT_THREAD);
      if (s.ok) {
        markNotPending(CURRENT_THREAD);
        renderMsg(s.item);
        scrollToEnd();
        updateThreadSnippet(CURRENT_THREAD, {
          mediaType: j.media_type,
          fromMe: true,
          time: s.item?.created_at || Date.now()
        });
      }
    } catch {
      notice('Send failed', 'Upload succeeded but sending the message failed.');
    }
  }

  els.picker.value = '';
  await refreshThreads();
});


  els.input?.addEventListener('input',  notifyTyping);
els.input?.removeEventListener('keydown', notifyTyping);

  els.composer?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!CURRENT_THREAD) return;

    const text = els.input.value.trim();
    if (!text) return;

const temp = { who:'you', text, media_type:'none',
               created_at: new Date().toISOString().slice(0,19).replace('T',' ') };
const el = renderMsg(temp);           // get the element
TEMP_LAST = { el, text };             // remember it
scrollToEnd();
updateThreadSnippet(CURRENT_THREAD, { text, fromMe:true, time: Date.now() });


    els.input.value = '';
let sendErr = null;
try {
  await apiJSON('/api/messages/send.php', {
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({ thread_id:String(CURRENT_THREAD), text })
  });
} catch (e) {
  sendErr = e;
} finally {
  await refreshThreads();
  stopTypingNow();
  if (sendErr && CURRENT_THREAD) {
    // If removed, hide composer + show note
    const mem = await checkMyMembership(CURRENT_THREAD);
    if (!mem.isMember) { setComposerVisible(false); showRemovedNote(); }
  }
}

  });

  function applyComposerPad(){
  const h = els.composer ? els.composer.getBoundingClientRect().height : 56;
  document.documentElement.style.setProperty('--composer-pad', (h + 8) + 'px'); // +8px breathing room
}
applyComposerPad();
window.addEventListener('resize', applyComposerPad);
window.addEventListener('resize', () => {
  if (CONV_MENU && CONV_MENU.classList.contains('open')) positionConvMenu();
});






  // ---------- INIT ----------

  // open/close the kebab menu
els.menuBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleConvMenu();
});

// close menu on outside click
document.addEventListener('click', (e) => {
  if (CONV_MENU && CONV_MENU.classList.contains('open')) {
    if (!CONV_MENU.contains(e.target) && e.target !== els.menuBtn) {
      CONV_MENU.classList.remove('open');
    }
  }
});



  (async function init(){
    await getMe();
    await refreshThreads();
    // after: await refreshThreads();
if (!window.__unreadTick){
  window.__unreadTick = setInterval(applyUnreadBadges, 10000); // every 10s
}


    // If nothing to show, clear header/body and saved selection
if (!THREADS || THREADS.length === 0) {
  clearConversationUI();
  localStorage.removeItem('dm:last-thread');
}

    // after first refresh
if (!THREADS_POLL_TMR) {
  THREADS_POLL_TMR = setInterval(()=> {
    refreshThreads({silent:true}).catch(()=>{});
  }, 1500); // ~1.5s; adjust if you want faster/slower
}


    if (!CURRENT_THREAD && els.list.children.length === 0) {
      const saved = JSON.parse(localStorage.getItem('dm:last-thread') || 'null');
      if (saved?.threadId && saved?.other) {
        ensureThreadInList(saved.threadId, saved.other);
        openThread(saved.threadId, saved.other);
        els.list.querySelector(`[data-tid="${saved.threadId}"]`)?.classList.add('is-active');
      }
    }
  })();

  document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && CURRENT_THREAD) {
    refreshSeenUI(CURRENT_THREAD);
  }
});


})();
(function(){
  if (document.getElementById('unread-css-darker2')) return;
  const s = document.createElement('style');
  s.id = 'unread-css-darker2';
  s.textContent = `
    /* a touch darker than before */
    .thread.unread{
      background: rgba(37,99,235,.32) !important;  /* was ~.22 */
    }
    .thread.unread:hover{
      background: rgba(37,99,235,.38) !important;  /* hover a bit darker */
    }
  `;
  document.head.appendChild(s);
})();
// Ellipsis for long thread titles/snippets
(function(){
  if (document.getElementById('thread-ellipsis-css')) return;
  const s = document.createElement('style');
  s.id = 'thread-ellipsis-css';
  s.textContent = `
    /* let the middle column shrink/grow so ellipsis can work */
    .thread > div:nth-of-type(2){ flex:1; min-width:0; }

    /* single-line truncation with … */
    .thread .name,
    .thread .snippet{
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }
  `;
  document.head.appendChild(s);
})();
// Ellipsis for centered system alerts too
(function ensureSnippetEllipsis(){
  if (document.getElementById('snippet-ellipsis-css')) return;
  const s = document.createElement('style');
  s.id = 'snippet-ellipsis-css';
  s.textContent = `
    .thread { display:flex; align-items:center; gap:10px; }
    .thread > .avatar { flex:0 0 36px; width:36px; height:36px; border-radius:50%; background:#e5e7eb center/cover no-repeat; }
    .thread > div:nth-child(2){ flex:1 1 auto; min-width:0; }       /* text column */
    .thread .name{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .thread .snippet{
      color:#6b7280; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
  `;
  document.head.appendChild(s);
})();
(() => {
  const style = document.createElement('style');
  style.id = 'dm-thread-snippet-ellipsis';
  style.textContent = `
    .thread .snippet{
      display:block;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      max-width: 14.5rem; /* adjust if your list is wider/narrower */
    }
  `;
  document.head.appendChild(style);
})();
(() => {
  if (document.getElementById('msg-css-fixes')) return;
  const s = document.createElement('style');
  s.id = 'msg-css-fixes';
  s.textContent = `
    /* Name above media should be same size as bubble name */
    #convBody .msg .from{font-size:12px;line-height:1.2;color:#64748b;font-weight:600;margin:0 0 4px 2px}
    #convBody .msg.att   .from{margin:2px 0 4px 2px}
  `;
  document.head.appendChild(s);
})();
// 25MB video client-side guard
(function enforceVideoLimit(){
  document.addEventListener('change', (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.type !== 'file' || !input.files || input.files.length === 0) return;

    const file = input.files[0];
    const isVideo = file && /^video\//i.test(file.type);
    const over25 = file && file.size > 25 * 1024 * 1024;

    if (isVideo && over25) {
      openNotice('File too large', 'Videos larger than 25 MB cannot be uploaded.');
      input.value = '';
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
})();

