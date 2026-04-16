document.addEventListener("DOMContentLoaded", async () => {
  await Auth.requireAuth({ roles: ["student"] });
});

// --- global default avatar (works everywhere in this file) ---
var DEFAULT_PFP = window.DEFAULT_PFP || 
  'data:image/svg+xml;utf8,' +
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">' +
  '<rect width="80" height="80" fill="%23e5e7eb"/>' +
  '<circle cx="40" cy="30" r="14" fill="%239ca3af"/>' +
  '<rect x="16" y="48" width="48" height="20" rx="10" fill="%239ca3af"/></svg>';
window.DEFAULT_PFP = DEFAULT_PFP;



// ---- infinite scroll state ----
let FEED_CURSOR = null;          // "before" cursor (oldest id currently on page)
let FEED_HAS_MORE = true;        // assume there can be more until server says otherwise
let FEED_LOADING = false;        // prevent concurrent loads
const FEED_LOADED_IDS = new Set(); // prevent duplicates across pages


// User-Profile.js - Placeholder for User Profile functionality
(function(){
  // ---------- BASE HELPERS (Retained for general utility) ----------
  const PROJECT_BASE = (() => {
    const cap = '/capstone';
    const p = location.pathname;
    const i = p.indexOf(cap);
    return i >= 0 ? p.slice(0, i + cap.length) : '';
  })();
  // Safe fallback avatar (inline SVG → never 404s)
const DEFAULT_PFP =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='100%' height='100%' rx='12' fill='%23e2e8f0'/><circle cx='40' cy='34' r='16' fill='%23cbd5e1'/><rect x='18' y='54' width='44' height='10' rx='5' fill='%23cbd5e1'/></svg>";

// --- Bad words filter helpers (GLOBAL) ---
// Replace your BAD_WORDS with this
// --- Profanity & Context Gate (GLOBAL, robust) ---
const BAD_WORDS = [
  // English
  "fuck","fucking","fucker","motherfucker","mf","fck","fuk",
  "shit","bullshit","bitch","slut","whore","cunt","asshole","prick",
  "dick","dickhead","pussy","bastard","jerk","douche","faggot","nigga","nigger","retard",
  // Tagalog
  "puta","putangina","putang ina","putang-ina","tangina","tang ina","tang-ina",
  "pota","potah","amputa","ampota","puking ina","puking-ina","king-ina","sal-sal",
  "salsal","kantot","kantutan","jakol","jakulan",
  "tite","titi","etits","burat","puke","puki","pekpek",
  "pokpok","gago","gaga","tanga","bobo","engot","tarantado","tarantada","ulol",
  "manyakis","manyak","malibog","syet","shyet","shet","pakshet","pakshit","paksyet","yawa","piste","pisti",
  "rape","rapist","raping","kingina","yotniinam","okininam", "fck" 
];

const HIGH_SEVERITY = new Set(["rape","rapist","raping"]); // fuzzy match these
const HUMAN_TARGETS = /\b(you|u|her|him|them|woman|women|girl|girls|kid|child|minor|student|classmate|teacher|lady|ladies|boy|boys|man|men)\b/i;
const INTENT_VERBS  = /\b(want(?:\s+to)?|wanna|going\s+to|gonna|will|should|must|try\s+to|plan\s+to|threaten(?:\s+to)?)\b/i;

// Unicode + leet canonicalizer
function canon(s=""){
  let t = s.normalize("NFKC").toLowerCase();
  t = t.replace(/[\u0300-\u036f]/g, "");          // strip diacritics
  // common confusables/leet
  t = t.replace(/[@]/g, "a").replace(/[!|]/g,"i").replace(/\$/g,"s")
       .replace(/0/g,"o").replace(/1/g,"l").replace(/3/g,"e")
       .replace(/4/g,"a").replace(/5/g,"s").replace(/7/g,"t")
       .replace(/8/g,"b").replace(/9/g,"g");
  return t;
}

// leetspeak / obfuscations
const LEET = {
  a:"[a@4]", e:"[e3]", i:"[i1!|]", o:"[o0]", u:"[uuvvx]",
  s:"[s$5]", t:"[t7+]", b:"[b8]", g:"[g9]", c:"[c(\\[{xk]]", k:"[kqxc]"
};
// allow **up to 10** non-alphanumerics between letters (covers long **** runs)
const BETWEEN = "(?:[^a-z0-9]|_){0,10}";
const VOWELS = new Set(["a","e","i","o","u"]);

// build tolerant regex for each bad word
function wordPattern(w){
  const tokens = w.toLowerCase().split("").map(ch=>{
    const base = /[a-z]/.test(ch) ? (LEET[ch] || ch) : ch.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const core = `(?:${base})+`;                         // stretched letters
    const vowelSwap = VOWELS.has(ch) ? `|(?:[^a-z0-9]|_){1,10}` : ""; // allow **** for vowels
    return `(?:${core}${vowelSwap})`;
  });
  const inner = tokens.join(BETWEEN);
  return `(?:^|[^a-z0-9])(${inner})(?=$|[^a-z0-9])`;
}

const BAD_PATTERNS = BAD_WORDS.map(w => new RegExp(wordPattern(w), "i"));

function listProfanities(text=""){
  const s = String(text);
  const hits = [];
  for (let i=0;i<BAD_WORDS.length;i++){
    if (BAD_PATTERNS[i].test(s)) hits.push(BAD_WORDS[i]);
  }
  // fuzzy for high-severity: check each token vs "rape" variants
  const c = canon(s).replace(/[^a-z0-9]+/g, " ").trim();
  if (c) {
    const toks = c.split(/\s+/);
    for (const tok of toks) {
      for (const w of HIGH_SEVERITY) {
        if (levenshtein(tok, w) <= 1) { // r@pe, rap3, grape→rape (after canon & token split)
          hits.push(w);
          break;
        }
      }
    }
  }
  return [...new Set(hits)];
}

function containsBadWord(text=""){ return listProfanities(text).length > 0; }

// tiny Levenshtein (token-level, cheap)
function levenshtein(a,b){
  const m=a.length,n=b.length; if(!m) return n; if(!n) return m;
  const dp=Array.from({length:n+1},(_,j)=>j);
  for(let i=1;i<=m;i++){
    let prev=dp[0], cur=i; dp[0]=i;
    for(let j=1;j<=n;j++){
      const tmp=dp[j];
      dp[j]=a[i-1]===b[j-1]?prev:1+Math.min(prev,cur,tmp);
      prev=tmp; cur=dp[j];
    }
  }
  return dp[n];
}

// --- Contextual euphemism heuristic (e.g., "grape" used as "rape") ---
const HUMAN_TARGET_RE = /\b(you|u|her|him|them|woman|women|girl|girls|kid|child|minor|student|classmate|teacher|lady|ladies|boy|boys|man|men)\b/i;
const FRUIT_CONTEXT_RE = /\b(juice|wine|seedless|raisin|raisins|fruit|bunch|vineyard|snack|harvest|farm|grapes?)\b/i;

// Context euphemism gate (intent + human target)
const GRAPE_FUZZY = /g[\W_]*r[\W_]*[a@4]+[\W_]*p[\W_]*[e3]+(?:[\W_]*(?:d|s|ing))?/i;
function contextEuphemismGate(text=""){
  const s = String(text);
  // real fruit → allow
  if (/\bgrapes?\b/i.test(s) && /\b(juice|wine|seedless|raisin|raisins|fruit|bunch|vineyard|snack|harvest|farm|grapes?)\b/i.test(s))
    return {ok:true};
  const hasGrape = GRAPE_FUZZY.test(s);
  const hasIntent = INTENT_VERBS.test(canon(s));
  const hasHuman = HUMAN_TARGETS.test(s);
  if (hasGrape && (hasHuman && (hasIntent || /\bgrape(?:d|s|ing)?\s+(you|u|her|him|them|the|a)\b/i.test(s))))
    return {ok:false, source:'context-local', reason:'assault euphemism'};
  return {ok:true};
}

/**
 * Returns {ok:false, source:'context-local', reason:'assault euphemism'} when "grape"
 * is used in an assault context (e.g., "I want to grape women", "grape you").
 * Allows real fruit contexts like "grape juice", "seedless grapes", etc.
 */
function contextEuphemismGate(text = "") {
  const s = String(text).toLowerCase();

  // If clearly fruit context anywhere, allow
  if (/\bgrapes?\b/.test(s) && FRUIT_CONTEXT_RE.test(s)) return { ok: true };

  // Pattern A: intent verb + "grape" + human target in same message
  const hasIntent = /\b(want(?:\s+to)?|wanna|going\s+to|gonna|will|should|must|try\s+to|plan\s+to)\b/.test(s);
  const hasGrape  = /\bgrape(?:d|s|ing)?\b/.test(s);
  const hasHuman  = HUMAN_TARGET_RE.test(s);

  // Pattern B: direct object usage "grape you/her/them"
  const directObject = /\bgrape(?:d|s|ing)?\s+(you|u|her|him|them|the|a)\b/.test(s) && hasHuman;

  if (hasGrape && ( (hasIntent && hasHuman) || directObject )) {
    return { ok:false, source:'context-local', reason:'assault euphemism' };
  }
  return { ok:true };
}

function listProfanities(text=""){
  const s = String(text);
  const hits = [];
  for (let i=0;i<BAD_PATTERNS.length;i++){
    if (BAD_PATTERNS[i].test(s)) { hits.push(BAD_WORDS[i]); }
  }
  return hits;
}
function containsBadWord(text=""){ return listProfanities(text).length>0; }
function censorText(text=""){
  let out = String(text);
  BAD_PATTERNS.forEach(re => { out = out.replace(re, (m,grp)=> m.replace(grp, "*".repeat(grp.length))); });
  return out;
}

// Context check via backend proxy (server holds the key)
const PERSPECTIVE_THRESHOLDS = {
  TOXICITY: 0.80,
  SEVERE_TOXICITY: 0.70,
  PROFANITY: 0.75,
  INSULT: 0.75,
  IDENTITY_ATTACK: 0.65,
  THREAT: 0.60,
  SEXUALLY_EXPLICIT: 0.65
};


async function scoreWithPerspective(text){
  if (!text || !text.trim()) return null;
  const url = (typeof PROJECT_BASE !== 'undefined' ? PROJECT_BASE : '') + '/api/moderation/check.php';
  const res = await fetch(url, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ text })
  }).then(r=>r.ok?r.json():null).catch(()=>null);
  if (!res || !res.ok || !res.top) return null;
  return res.top; // {name, score}
}

async function hybridProfanityGate(text){
  const local = listProfanities(text);
  if (local.length) return { ok:false, source:'local', reason:`Profanity detected: ${local[0]}` };

  const euphemism = contextEuphemismGate(text);
  if (!euphemism.ok) return euphemism;

  const top = await scoreWithPerspective(text); // your backend proxy
  if (!top) return { ok:true };
  const limit = PERSPECTIVE_THRESHOLDS[top.name] ?? 1.0;
  return (top.score >= limit)
    ? { ok:false, source:'perspective', reason:`${top.name.toLowerCase()} ${top.score.toFixed(2)}` }
    : { ok:true };
}


window.containsBadWord = containsBadWord;
window.censorText = censorText;
window.hybridProfanityGate = hybridProfanityGate;


const _reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BAD_WORDS_RE = BAD_WORDS.length
  ? new RegExp(`\\b(${BAD_WORDS.map(_reEsc).join('|')})\\b`, 'i')
  : null;


function censorText(s = '') {
  if (!BAD_WORDS_RE) return s;
  const reGI = new RegExp(BAD_WORDS_RE.source, 'gi');
  return s.replace(reGI, (m) => '*'.repeat(m.length));
}

// make accessible across the file (multiple IIFEs)
window.containsBadWord = containsBadWord;
window.censorText = censorText;



 // Fetch JSON with a safety net: logs raw response if it's not JSON.
async function apiJSON(pathOrUrl, options = {}) {
  const url = (/^https?:/.test(pathOrUrl) ? pathOrUrl
            : (PROJECT_BASE || "") + (pathOrUrl.startsWith("/") ? pathOrUrl : "/" + pathOrUrl));
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Accept": "application/json" },
    ...options
  });


  const raw = await res.text(); // read as text first
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error("Non-JSON from", url, "→", raw); // <-- shows the PHP error HTML
    throw new Error(`Bad JSON from ${url}`);
  }

  if (!res.ok || json?.ok === false) {
  console.error("API error", { status: res.status, json }); // will show json.detail if present
  const msg = (json && json.error ? json.error : "") + (json && json.detail ? (": " + json.detail) : "");
  throw new Error(msg || `HTTP ${res.status}`);
}

  return json;
}

// --- Session: who is logged in? (universal; student/adviser) ---
async function requireLogin() {
  try {
    // Adjust this path if your me.php lives elsewhere
    const { me } = await apiJSON("/api/auth/me.php");
    // Expose for other scripts that might read it (optional)
    window.ME = me || window.ME || null;
  } catch (e) {
    // If not logged in, go to your login page
    if (String(e.message).match(/401|Not logged in|Unauthorized/i)) {
      location.href = (PROJECT_BASE || "") + "/index.html";
      return;
    }
    console.error("[auth] me failed:", e);
  }
}

function pickImage(accept = "image/*") {
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = accept;
    inp.onchange = () => resolve(inp.files && inp.files[0] ? inp.files[0] : null);
    inp.click();
  });
}

async function uploadMedia(kind /* 'avatar' | 'cover' */) {
  const file = await pickImage("image/*");
  if (!file) return;

  const fd = new FormData();
  fd.append("type", kind);     // 'avatar' or 'cover'
  fd.append("image", file);

  try {
      const { profile: p } = await apiJSON("/api/profile/update_media.php", { method: "POST", body: fd });

    // Use a profile upload endpoint (not the posts endpoint).
    // apiJSON already prefixes PROJECT_BASE, so keep it as /api/...
if (kind === "avatar") {
  const el = document.getElementById("user-avatar");
  const next = p?.pending_avatar || p?.profile_picture || "";
  if (el && next) {
    el.style.backgroundImage = `url('${mediaUrl(next)}')`;
    const isPending = !!p?.pending_avatar;
    el.classList.toggle("is-pending", isPending);
    setPendingBadge(el, isPending, 'avatar');
  }
  // keep composer avatar in sync if present
  const composerPfp = document.querySelector("#createPost .post-avatar");
  if (composerPfp && next) {
    const url = mediaUrl(next);
    if (composerPfp.tagName === "IMG") composerPfp.src = url;
    else composerPfp.style.backgroundImage = `url('${url}')`;
  }
} else {
  const el = document.getElementById("user-cover");
  const next = p?.pending_cover || p?.cover_picture || "";
  if (el && next) {
    el.style.backgroundImage = `url('${mediaUrl(next)}')`;
    const isPending = !!p?.pending_cover;
    el.classList.toggle("is-pending", isPending);
    // badge belongs on the hero container (covers full width/height)
    setPendingBadge(document.querySelector('.club-hero'), isPending, 'cover');
  }
}

  } catch (err) {
    console.error("[profile] upload failed:", err);
    alert(err.message || "Upload failed");
  }
}

window.apiJSON = apiJSON; 
window.mediaUrl = mediaUrl;

  
  // Removed apiCandidates and apiFetch as they are specific to club APIs.
  // You will need to implement your own API fetching logic for user data.

  // === API base resolver + fetch (universal, student/adviser auto) ===
const API_CANDIDATES = ["api", "../api", (PROJECT_BASE ? PROJECT_BASE + "/api" : "/api")];

async function apiFetch(path, options = {}) {
  let lastErr;
  for (const base of API_CANDIDATES) {
    const url = base.replace(/\/$/, "") + "/" + String(path).replace(/^\//, "");
    try {
      const res = await fetch(url, {
        credentials: "include",
        headers: { "Accept": "application/json" },
        ...options,
      });
      if (res.ok) return res;
      lastErr = new Error("HTTP " + res.status);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("API unreachable");
}

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
  // Removed shuffle as it was specific to "Other Clubs

  // Centered "PENDING" badge helper
function setPendingBadge(container, isPending, kind=''){
  if (!container) return;
  let badge = container.querySelector(`.pending-badge${kind ? `[data-kind="${kind}"]` : ''}`);
  if (isPending) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'pending-badge';
      if (kind) badge.dataset.kind = kind;
      badge.textContent = 'PENDING';
      container.appendChild(badge);
    }
  } else if (badge) {
    badge.remove();
  }
}


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

  // Helpers
function getProfileTarget(){
  return getParam('user_id') || String(window.PROFILE?.id || '');
}
function getProfileRole(){
  return window.PROFILE?.role || getParam('role') || 'student';
}





function applyReadOnlyIfOther(viewedUserId){
  const meId = window.ME?.id && String(window.ME.id);
  const targetId = getProfileTarget();
  const other = (targetId && targetId !== meId) || (viewedUserId && String(viewedUserId) !== meId);
  if (!other) return;
  // Hide editing & composer on other people's profiles
  document.getElementById('createPost')?.remove();
  document.getElementById('coverEditBtn')?.remove();
  document.getElementById('avatarEditBtn')?.remove();
}

async function loadSuggestions(){
  if (!suggestUl) return;
  suggestUl.innerHTML = '';

  let j;
  try {
    // Adjust to your actual endpoint if needed
    j = await apiJSON('/api/profile/suggest.php?limit=8');
  } catch (e) {
    console.error('[suggest] failed:', e);
    return;
  }

 const list = j.items || j.users || [];
const meId = window.ME?.id && String(window.ME.id);

// hard-cap UI to 8 (even if server sends more)
for (const u of list.slice(0, 8)) {

    if (String(u.id) === meId) continue;   // don't show me

    const li = document.createElement('li');
    li.className = 'suggest-item';
    li.innerHTML = `
      <div class="suggest-thumb" style="background-image:url('${mediaUrl(u.profile_picture)}')"></div>
      <div class="suggest-meta">
        <div class="suggest-name">${u.full_name || u.name || ''}</div>
        <div class="suggest-sub">${
  (u.role ? String(u.role).charAt(0).toUpperCase() + String(u.role).slice(1) : '')
}</div>
      </div>`;

    // Re-use this page for viewing others
    li.addEventListener('click', () => {
      const base = location.pathname.replace(/\/+$/, '');
      location.href = base + '?user_id=' + encodeURIComponent(u.id);
    });

    suggestUl.appendChild(li);
  }
}



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

await requireLogin();      // make sure session is valid
await loadUserProfile();
await loadUserClub();
await loadSuggestions();
// Initial feed load
await window.loadMyPosts();
// Infinite scroll: fetch older when near bottom
window.addEventListener('scroll', () => {
  if (FEED_LOADING || !FEED_HAS_MORE) return;
  const el = document.documentElement;
  const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 600;
  if (nearBottom) window.loadMyPosts({ before: FEED_CURSOR, append: true });

});


// --- wire the two edit buttons to the uploader ---
const coverEditBtn  = document.getElementById("coverEditBtn");
if (coverEditBtn)  coverEditBtn.addEventListener("click", () => uploadMedia("cover"));

const avatarEditBtn = document.getElementById("avatarEditBtn");
if (avatarEditBtn) avatarEditBtn.addEventListener("click", () => uploadMedia("avatar"));


    // Example: Wire the Edit Profile button
    if (editProfileBtn) {
      editProfileBtn.addEventListener('click', () => {
        alert('Edit Profile button clicked! Implement your edit profile logic here.');
        // You might open a modal or navigate to an edit page
      });
    }
  }


// FINAL: role label under the name, aligned & tight
function installRoleUI(profile){
  // remove older injectors
  document.querySelectorAll(
    'style[id^="profile-role"], style#profile-bio-css, style#profile-role-final'
  ).forEach(s => s.remove());

  const nameEl = document.getElementById('user-name');
  if (!nameEl) return;

  // wrap the name
  let wrap = document.getElementById('user-name-wrap');
  if (!wrap) {
    wrap = document.createElement('span');
    wrap.id = 'user-name-wrap';
    wrap.className = 'user-name-wrap';
    nameEl.replaceWith(wrap);
    wrap.appendChild(nameEl);
  } else if (nameEl.parentElement !== wrap) {
    wrap.appendChild(nameEl);
  }

  // ensure role element
  let roleEl = document.getElementById('user-status');
  if (!roleEl) {
    roleEl = document.createElement('span');
    roleEl.id = 'user-status';
    roleEl.className = 'user-role';
    wrap.appendChild(roleEl);
  } else if (roleEl.parentElement !== wrap) {
    roleEl.remove(); wrap.appendChild(roleEl);
  }

  // carry the name’s horizontal indents to the wrapper
  const cs = getComputedStyle(nameEl);
  const ml = cs.marginLeft, mr = cs.marginRight;
  if (ml && ml !== '0px') { wrap.style.marginLeft  = ml; nameEl.style.marginLeft  = '0'; }
  if (mr && mr !== '0px') { wrap.style.marginRight = mr; nameEl.style.marginRight = '0'; }

  // label text
  const raw = profile.role || (profile.student_id_display ? 'student' : 'adviser');
  roleEl.textContent = raw ? raw[0].toUpperCase() + raw.slice(1) : '';

  // hardened CSS
  const s = document.createElement('style');
  s.id = 'profile-role-final';
  s.textContent = `
.club-head{
  display:flex !important;
  align-items:center !important;
  gap:12px !important;
  overflow:visible !important;          /* prevent clipping when we lift the role */
}

#user-name-wrap{
  display:inline-flex !important;
  flex-direction:column !important;
  align-items:flex-start !important;
  gap:0 !important;
  position:relative !important;
  margin-top:-10px !important;
}

#user-name{
  line-height:.88 !important;           /* tighter name line box */
  margin:0 !important;
  color:#fff !important;
  text-shadow:0 2px 6px rgba(0,0,0,.45) !important;
}

#user-status{
  margin:0 !important;
   margin-top:-16px !important;          /* lift the “Student” label */
  font-size:.98rem !important;
  font-weight:600 !important;
  white-space:nowrap !important;
  color:rgba(255,255,255,.98) !important;
  text-shadow:0 1px 4px rgba(0,0,0,.45) !important;
  transform: translateY(-1px);
}

@media (max-width:520px){
  #user-status{
    margin-top:-12px !important;        /* keep some breathing room on mobile */
    transform:none;
  }
}
  @media (max-width:520px){
  #user-name-wrap{ margin-top:-6px !important; }
}

  `;
  document.head.appendChild(s);
}

// ---------- LOAD USER PROFILE (LIVE) ----------
async function loadUserProfile() {
  try {
    const targetId = getProfileTarget();
const { profile: p = {} } = await apiJSON(
  targetId ? `/api/profile/get_public.php?id=${encodeURIComponent(targetId)}`
           : "/api/profile/get.php"
);


const cover  = document.getElementById("user-cover");
const avatar = document.getElementById("user-avatar");
const nameEl = document.getElementById("user-name");

if (cover) {
  const src = p.pending_cover || p.cover_picture || "";
  cover.style.backgroundImage = src ? `url('${mediaUrl(src)}')` : "";
  const isPending = !!p.pending_cover;
  cover.classList.toggle("is-pending", isPending);
  // badge on the HERO container (proper centering & layering)
  setPendingBadge(document.querySelector('.club-hero'), isPending, 'cover');
}
if (avatar) {
  const src = p.pending_avatar || p.profile_picture || "";
  avatar.style.backgroundImage = src ? `url('${mediaUrl(src)}')` : "";
  const isPending = !!p.pending_avatar;
  avatar.classList.toggle("is-pending", isPending);
  // badge on the AVATAR itself
  setPendingBadge(avatar, isPending, 'avatar');
}


if (nameEl) nameEl.textContent = p.full_name || p.name || (window.ME?.full_name || window.ME?.name || "");

installRoleUI(p);
    const roleRaw = p.role || (p.student_id_display ? 'student' : 'adviser');
const typeEl  = document.getElementById('user-status');  // sits under the name
if (typeEl) {
  const label = roleRaw ? roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1) : '';
  typeEl.textContent = label;         // e.g., "Student" or "Adviser"
}

    // Expose the viewed profile for the feed cards (do NOT overwrite window.ME)
window.PROFILE = {
  id: String(p.id || ''),
  role: p.role || (p.student_id_display ? 'student' : 'adviser'),
  full_name: p.full_name || p.name || '',
  profile_picture: p.profile_picture || '',
  sti_email: p.contact_email || p.sti_email || ''
};

// after setting cover/name in loadUserProfile()
const composerPfp = document.querySelector('#createPost .post-avatar');
if (composerPfp && p.profile_picture) {
  const url = mediaUrl(p.profile_picture);
  if (composerPfp.tagName === 'IMG') composerPfp.src = url;
  else composerPfp.style.backgroundImage = `url('${url}')`;
}

// expose the viewed profile separately; DO NOT override the logged-in ME           // “who we’re viewing”
applyReadOnlyIfOther(p.id);      // hides composer etc. when viewing others





    const bio = document.getElementById("user-bio");
    if (bio) bio.textContent = p.bio || "";

// grab About fields FIRST (avoid TDZ)
const sid     = document.getElementById("aboutStudentId");
const nick    = document.getElementById("aboutNickname");
const bday    = document.getElementById("aboutBirthdate");
const city    = document.getElementById("aboutCity");
const contact = document.getElementById("aboutContact");

const idLabel = sid?.previousElementSibling;
if (idLabel) idLabel.textContent = (p.role === "adviser") ? "Adviser ID" : "Student ID";

if (sid)     sid.textContent     = (p.role === "adviser") ? (p.adviser_id || p.id || "—")
                                                          : (p.student_id_display || p.id || "—");
if (nick)    nick.textContent    = p.nickname      || "—";
if (bday)    bday.textContent    = p.birthdate     || "—";
if (city)    city.textContent    = p.about_city    || "—";
if (contact) contact.textContent = p.contact_email || p.sti_email || "—";




// 3) Fill values (one place only)
if (sid) sid.textContent =
  (p.role === "adviser")
    ? (p.adviser_id || p.id || "—")
    : (p.student_id_display || p.id || "—");

if (nick)    nick.textContent    = p.nickname      || "—";
if (bday)    bday.textContent    = p.birthdate     || "—";
if (city)    city.textContent    = p.about_city    || "—";
if (contact) contact.textContent = p.contact_email || p.sti_email || "—";

  } catch (e) {
    console.error("[profile] load failed:", e);
  }
}

async function loadUserClub() {
  try {
    const viewedId = getProfileTarget();  // if there’s an id in the URL, we’re viewing “other”

    const url = viewedId
      ? `/api/profile/get_user_club.php?id=${encodeURIComponent(viewedId)}`
      : `/api/profile/get_my_club.php`;

    const { club: c = null } = await apiJSON(url);

    // DOM hooks
    const avatar = document.getElementById("user-club-avatar");
    const name   = document.getElementById("user-club-name");
    const count  = document.getElementById("user-club-members-count");

    // a solid, always-there fallback (light gray circle)
    const CLUB_AVATAR_FALLBACK =
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'>
           <defs><clipPath id='r'><circle cx='48' cy='48' r='48'/></clipPath></defs>
           <rect width='96' height='96' fill='#e5e7eb' clip-path='url(#r)'/>
         </svg>`
      );

    if (!c) {
      if (name)  name.textContent = "—";
      if (avatar) avatar.style.backgroundImage = `url('${CLUB_AVATAR_FALLBACK}')`;
      if (count) count.textContent = "0";
      return;
    }

    if (name)  name.textContent = c.club_name || "—";

    if (avatar) {
      const img = c.profile_picture ? mediaUrl(c.profile_picture) : CLUB_AVATAR_FALLBACK;
      avatar.style.backgroundImage = `url('${img}')`;
      // make sure it renders as a solid circle nicely
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";
      avatar.style.backgroundRepeat = "no-repeat";
      avatar.style.borderRadius = "50%";
      avatar.style.backgroundColor = "#e5e7eb";
    }

  } catch (e) {
    console.error("[club] load failed:", e);
  }
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
    const opts = { credentials: "include", ...init };
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



// ---- Future: when you hook up the DB, just call this with real values ----
function setAboutFromDB(data){
  // data = { nickname, student_id, birthdate, city, email }
  Object.entries(data || {}).forEach(([k, v]) => {
    const el = document.getElementById(`about-${k}`);
    if (el && v != null) el.textContent = v;
  });
}

(() => {
  const pm = document.getElementById('postModal');
  if (!pm) return;

  pm.addEventListener('click', (e) => {
    const act = e.target.closest('.cm3-menu [data-action]');
    if (!act) return;

    const cm      = act.closest('.cm');
    const commentId = cm?.getAttribute('data-id');
    const textEl  = cm?.querySelector('.cm-text');
    const oldText = textEl?.textContent || '';

    // EDIT COMMENT → reuse #editCaptionModal
    if (act.dataset.action === 'c-edit') {
      const m   = document.getElementById('editCaptionModal');  // existing modal
      const ttl = m?.querySelector('.ecm-title, #ecmTitle');
      const ta  = m?.querySelector('#ecmTextarea');
      const ok  = m?.querySelector('.ecm-save, .btn-primary');
      const close = m?.querySelector('.ecm-close, .btn-light, [data-dismiss]');

      if (!m || !ta || !ok) return;

      if (ttl) ttl.textContent = 'Edit comment';
      ta.value = oldText;
      m.dataset.commentId = commentId;   // tag it so we know we’re editing a comment
      m.classList.add('open'); m.setAttribute('aria-hidden','false');

      const onSave = async () => {
        const newText = ta.value.trim();
        if (!newText) return;

        try {
         const fd = new FormData();
fd.append('id', commentId);          // for backends that expect "id"
fd.append('comment_id', commentId);  // for backends that expect "comment_id"
fd.append('text', newText);          // for backends that expect "text"
fd.append('comment', newText);       // for backends that expect "comment"
await apiJSON('/api/posts/comments/update.php', { method: 'POST', body: fd });
          // reflect in UI immediately
          if (textEl) textEl.textContent = newText;
        } catch (err) { console.error(err); }

        m.classList.remove('open'); m.setAttribute('aria-hidden','true');
        ok.removeEventListener('click', onSave);
      };

      ok.addEventListener('click', onSave, { once:true });
      close?.addEventListener('click', () => {
        m.classList.remove('open'); m.setAttribute('aria-hidden','true');
      }, { once:true });
      return;
    }

    // DELETE COMMENT → reuse your delete confirm modal (postDeleteModal/confirmModal)
    if (act.dataset.action === 'c-delete') {
      const del = document.getElementById('postDeleteModal') || document.getElementById('confirmModal');
      if (!del) return;

      const ttl = del.querySelector('#postDeleteTitle, #confirmTitle, h4');
      const msg = del.querySelector('#postDeleteBody, #confirmMessage, p');
      const yes = del.querySelector('.btn-danger, .btn-primary, .confirm-yes');
      const no  = del.querySelector('.btn-light, .btn-secondary, .confirm-no, .close, [data-dismiss]');

      if (ttl) ttl.textContent = 'Delete comment?';
      if (msg) msg.textContent = 'This action cannot be undone.';
      del.classList.add('open'); del.setAttribute('aria-hidden','false');

      const onYes = async () => {
        try {
const fd = new FormData();
fd.append('id', commentId);          // allow either name
fd.append('comment_id', commentId);
await apiJSON('/api/posts/comments/delete.php', { method: 'POST', body: fd });
          cm?.remove();
        } catch (err) { console.error(err); }
        del.classList.remove('open'); del.setAttribute('aria-hidden','true');
        yes?.removeEventListener('click', onYes);
      };

      yes?.addEventListener('click', onYes, { once:true });
      no?.addEventListener('click', () => {
        del.classList.remove('open'); del.setAttribute('aria-hidden','true');
      }, { once:true });
    }
  });
})();



(() => {
// Like toggle — heart-filled + DB-backed (card .btn-like + modal .pm-like)
document.addEventListener('click', async (ev) => {
  const likeBtn = ev.target.closest('.btn-like, .pm-like');
  if (!likeBtn) return;

  // Resolve post id from card or modal
  const pm = document.getElementById('postModal');
  const postEl =
    likeBtn.closest('.feed-post') ||
    (pm && pm.dataset.postId ? document.querySelector(`.feed-post[data-id="${pm.dataset.postId}"]`) : null);
  const postId = likeBtn.dataset.post || postEl?.dataset.id || pm?.dataset.postId;
  if (typeof togglePostKebabForOwner === 'function') {
  togglePostKebabForOwner(postEl, postEl?.dataset || {});
}

  if (!postId) return;

  // Remember the base icon once
  const img = likeBtn.querySelector('.icon img, img');
  if (img && !img.dataset.baseSrc) {
    img.dataset.baseSrc = img.getAttribute('src') || 'Images/heart.png';
  }

  // Call your API to toggle + return true/false and total likes
  const fd = new FormData();
  fd.append('post_id', postId);

  try {
    const j = await apiJSON('/api/posts/like_toggle.php', { method: 'POST', body: fd });
    const liked = !!j.liked;
    const likes = j.likes ?? 0;

    // Sync both the card button and the modal button
    const targets = [
      ...document.querySelectorAll(`.feed-post[data-id="${postId}"] .btn-like`),
      ...document.querySelectorAll('#postModal.open .pm-like'),
    ];
    targets.forEach(btn => {
      btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
      btn.dataset.liked = liked ? 'true' : 'false';

      const cnt = btn.querySelector('.count');
      if (cnt) cnt.textContent = String(likes);

      const ii = btn.querySelector('.icon img, img');
      if (ii) ii.src = liked ? 'Images/heart-filled.png' : (ii.dataset.baseSrc || 'Images/heart.png');
    });
  } catch (err) {
    console.error('[like] toggle failed:', err);
    // (Optional) show a toast here
  }
});


  

  // Open modal on comment buttons
  const modal = document.getElementById('postModal');
  const pmMedia = document.getElementById('pmMedia');
  const pmCaption = document.getElementById('pmCaption');
  const pmComments = document.getElementById('pmComments');
  const pmAdd = document.getElementById('pmAddForm');
  const pmInput = document.getElementById('pmInput');




  // demo comments
  const seedComments = [
    { name:'Sofia Morales', text:'Love this! 🎉' },
    { name:'Juan Lopez',    text:'Great turnout.' }
  ];

async function loadComments(postId){
  pmComments.innerHTML = '';
  try {
    const j = await apiJSON(`/api/posts/comments/list.php?post_id=${encodeURIComponent(postId)}`);
    (j.items || []).forEach(c => renderComment(c));
    pmComments.scrollTop = pmComments.scrollHeight;

    // ✅ set the modal counter to the true count
// ✅ set comment count from the actual items length
const pmC = document.querySelector('#postModal .pm-open-comments .count');
if (pmC) pmC.textContent = String((j.items || []).length);

// keep card(s) in sync too
document.querySelectorAll(`.feed-post[data-id="${postId}"] .btn-comment .count`)
  .forEach(n => n.textContent = String((j.items || []).length));

  } catch (e) {
    console.error('[comments] load failed:', e);
  }
}


function renderComment(item){
  const pm = document.getElementById('postModal');

  // --- normalize author identity (NEVER use item.id — that's the comment id)
  const authorId    = item.author_id ?? item.author?.id ?? item.user_id ?? item.student_id ?? item.uid ?? null;
  const authorEmail = item.author_email ?? item.email ?? item.sti_email ?? null;
  const authorName  = (item.author_name ?? item.name ?? item.full_name ?? item.user_full_name ?? '').trim();

  const meId    = String(window.ME?.id ?? '');
  const meName  = (window.ME?.full_name || '').trim();
  const meEmail = (window.ME?.sti_email || '').trim().toLowerCase();

 

  // fuzzy “is my post?” using the header name (handles middle names)
  const norm  = s => String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
  const split = s => { const p = norm(s).split(' '); return { first: p[0]||'', last: p[p.length-1]||'' }; };
  const samePerson = (a,b) => {
    const A = split(a), B = split(b);
    if (!A.first || !A.last || !B.first || !B.last) return false;
    if (norm(a) === norm(b)) return true;
    return A.last === B.last && (A.first.startsWith(B.first) || B.first.startsWith(A.first));
  };

  const headerName = (pm?.querySelector('#pmName')?.textContent || pm?.dataset.ownerName || '').trim();
  const isMyPost = (pm?.dataset.mine === '1');
// recompute "is me" with fuzzy name match
const nameMatch  = authorName && meName && samePerson(authorName, meName);
const emailMatch = authorEmail && meEmail && authorEmail.trim().toLowerCase() === meEmail;
const idMatch    = (authorId != null) && String(authorId) === meId;
const isMe       = !!(item.me || idMatch || emailMatch || nameMatch);

// permissions: user can edit only their own comment; post owner can delete any comment
const canEdit   = isMe;
const canDelete = isMe || isMyPost;


  // avatar url (works with or without mediaUrl helper)
  const avatarSrc = item.avatar
    ? (typeof mediaUrl === 'function' ? mediaUrl(item.avatar) : item.avatar)
    : DEFAULT_PFP

  // optional kebab markup (no nested backticks)
// ...after computing canEdit/canDelete and avatarSrc...

let kebabHTML = '';
if (canEdit || canDelete) {
  let menuInner = '';
  const editIcon = (typeof mediaUrl === 'function') ? mediaUrl('Images/edit.png')   : 'Images/edit.png';
const delIcon  = (typeof mediaUrl === 'function') ? mediaUrl('Images/delete.png') : 'Images/delete.png';

  if (canEdit) {
  menuInner += '<button type="button" data-action="c-edit" role="menuitem">' +
                 `<img class="cm3-mi" src="${editIcon}" alt="">` +
                 'Edit Comment' +
               '</button>';
}
if (canDelete) {
  menuInner += '<button type="button" data-action="c-delete" role="menuitem" class="danger">' +
                 `<img class="cm3-mi" src="${delIcon}" alt="">` +
                 'Delete' +
               '</button>';
}

  const dots = (typeof mediaUrl === 'function')
    ? mediaUrl('Images/more.png')
    : 'Images/more.png';

  // NEW: comment-only classes
  kebabHTML =
    '<button class="cm3-btn" type="button" aria-haspopup="menu" aria-expanded="false">' +
      `<img src="${dots}" alt="More" class="cm3-icon">` +
    '</button>' +
    '<div class="cm3-menu" role="menu">' + menuInner + '</div>';
}



const html =
  '<div class="cm" data-id="'+item.id+'">' +
    '<img class="cm-avatar" src="'+avatarSrc+'" alt="">' +
    '<div class="cm-bubble">' +
      '<div class="cm-row">' +                                  // <-- inline row
        '<div class="cm-name">'+(item.author_name || 'User')+'</div>' +
        kebabHTML +                                              // button + menu right here
      '</div>' +
      '<p class="cm-text"></p>' +
    '</div>' +
  '</div>';

pmComments.insertAdjacentHTML('beforeend', html);
pmComments.lastElementChild.querySelector('.cm-text').textContent = item.text || '';



}

(() => {
  const pm = document.getElementById('postModal');
  if (!pm) return;

  let openMenu = null;

  pm.addEventListener('click', (e) => {
    const btn  = e.target.closest('.cm3-btn');
    const menu = e.target.closest('.cm3-menu');

    if (btn) {
      const m = btn.nextElementSibling;
      const willOpen = !m.classList.contains('open');
      if (openMenu) openMenu.classList.remove('open');
      if (willOpen) { m.classList.add('open'); openMenu = m; btn.setAttribute('aria-expanded','true'); }
      else          { openMenu = null; btn.setAttribute('aria-expanded','false'); }
      e.stopPropagation();
      return;
    }

    // click outside closes
    if (!menu && openMenu) {
      openMenu.classList.remove('open');
      openMenu = null;
    }
  });
})();


(() => {
  const pm = document.getElementById('postModal');
  if (!pm) return;
  pm.addEventListener('click', (e) => {
    const btn = e.target.closest('.kebab-btn');
    const menu = e.target.closest('.kebab-menu');

    if (btn) {
      const m = btn.nextElementSibling;
      const willOpen = !(m.style.display === 'block' || m.classList.contains('open'));
      pm.querySelectorAll('.kebab-menu').forEach(mm => { mm.classList.remove('open'); mm.style.display = 'none'; });
      if (willOpen) { m.classList.add('open'); m.style.display = 'block'; btn.setAttribute('aria-expanded','true'); }
      else { m.classList.remove('open'); m.style.display = 'none'; btn.setAttribute('aria-expanded','false'); }
      e.stopPropagation();
      return;
    }
    if (!menu) {
      pm.querySelectorAll('.kebab-menu').forEach(mm => { mm.classList.remove('open'); mm.style.display = 'none'; });
    }
  });
})();



async function openModalFor(post){
  // reset modal content
pmMedia.innerHTML = '';
  pmComments.innerHTML = '';
  pmInput.value = '';
  // Remove composer avatar if it exists (we're deprecating it)



  const type = post.dataset.type;
  modal.classList.toggle('text-only', type !== 'image' && type !== 'video');
  const caption = post.dataset.caption || post.querySelector('.feed-body')?.textContent?.trim() || '';
  pmCaption.textContent = caption;

  // --- hydrate modal’s like/comment counters from the card ---
const pmLikeBtn = modal.querySelector('.pm-like');
const pmCmtBtn  = modal.querySelector('.pm-open-comments');
const cardLike  = post.querySelector('.btn-like');
const cardCmt   = post.querySelector('.btn-comment');

if (pmLikeBtn && cardLike) {
  const liked = cardLike.getAttribute('aria-pressed') === 'true' || cardLike.dataset.liked === 'true';
  pmLikeBtn.setAttribute('aria-pressed', liked ? 'true' : 'false');
  pmLikeBtn.dataset.liked = liked ? 'true' : 'false';
  const pmLikeCount = pmLikeBtn.querySelector('.count');
  const cardLikeCount = cardLike.querySelector('.count')?.textContent || '0';
  if (pmLikeCount) pmLikeCount.textContent = cardLikeCount;

  // swap icon to filled/outline to match state (same logic as the card)
  const img = pmLikeBtn.querySelector('.icon img, img');
  if (img && !img.dataset.baseSrc) img.dataset.baseSrc = img.getAttribute('src') || 'Images/heart.png';
  if (img) img.src = liked ? 'Images/heart-filled.png' : (img.dataset.baseSrc || 'Images/heart.png');
}

if (pmCmtBtn) {
  const pmCmtCount = pmCmtBtn.querySelector('.count');
  const cardCmtCount = cardCmt?.querySelector('.count')?.textContent || '0';
  if (pmCmtCount) pmCmtCount.textContent = cardCmtCount;
}


// fill modal header (name, avatar, time) — robust selectors
const pmName  = document.getElementById('pmName');
const pmTime  = document.getElementById('pmTime');
const pmAvImg = document.getElementById('pmAvatar');

const nameEl = post.querySelector(
  '.feed-name, .feed-author .name, .feed-head .name, .user-name, .name'
);
const avatarEl = post.querySelector(
  '.feed-avatar img, .avatar img, .pfp img, .feed-head img, img'
);
const timeEl = post.querySelector('.feed-time, time');

const name = (post.dataset.user || nameEl?.textContent || '').trim() || 'Unknown';
const rawTime = post.dataset.time || timeEl?.getAttribute?.('datetime') || timeEl?.textContent || '';
pmName && (pmName.textContent = name);
modal.dataset.ownerName = name;


// avatar
const src = post.dataset.avatar || avatarEl?.getAttribute?.('src') || '';
if (pmAvImg) pmAvImg.src = src ? (typeof mediaUrl === 'function' ? mediaUrl(src) : src) : DEFAULT_PFP;

// time
if (pmTime) {
  let t = '';
  if (rawTime) {
    const d = new Date(rawTime);
    t = isNaN(+d) ? rawTime : d.toLocaleString();
  }
  pmTime.textContent = t;
}

modal.querySelectorAll('#pmAddForm .cm-avatar, .pm-add .cm-avatar, .pm-input .cm-avatar')
  .forEach(n => n.remove());
document.getElementById('pm-composer-avatar-css')?.remove();

modal.dataset.postId = post.dataset.id || '';

{
  const mePic = window.ME?.profile_picture ? mediaUrl(window.ME.profile_picture) : '';
  const node  = modal.querySelector('#pmComposerAvatar, .pm-add img, .pm-add .cm-avatar, .pm-input img, .pm-input .cm-avatar');
  if (node && mePic) {
    if (node.tagName === 'IMG') node.src = mePic;
    else node.style.backgroundImage = `url('${mePic}')`;
  }
}


// --- detect if I own this post (self-contained) ---
if (!window.ME || !window.ME.id || !window.ME.full_name) {
  try {
    const { me } = await apiJSON('/api/auth/me.php');
    if (me) {
      window.ME = {
        ...(window.ME || {}),
        id: String(me.adviser_id ?? me.student_id ?? me.id ?? ''),
        full_name: me.name ?? me.full_name ?? '',
        sti_email: me.sti_email ?? me.email ?? '',
        profile_picture: me.profile_picture ?? window.ME?.profile_picture ?? ''
      };
    }
  } catch {}
}
// --- robust "is this my post?" check ---
const norm  = s => String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
const split = s => { const p = norm(s).split(' '); return { first: p[0]||'', last: p[p.length-1]||'' }; };
const samePerson = (a,b) => {
  const A = split(a), B = split(b);
  if (!A.first || !A.last || !B.first || !B.last) return false;
  if (norm(a) === norm(b)) return true;
  // same last name, first name is equal or prefix (handles middle names)
  return A.last === B.last && (A.first.startsWith(B.first) || B.first.startsWith(A.first));
};

const headerName = document.getElementById('pmName')?.textContent || '';
const cardName   = post.dataset.user ||
  post.querySelector('.feed-name, .feed-author .name, .feed-head .name, .user-name, .name')?.textContent || '';

const ownerId    = String(post.dataset.ownerId || '');
const ownerEmail = String(post.dataset.ownerEmail ||
  post.querySelector('.feed-author .email, .feed-head .email, .user-email')?.textContent || '').trim().toLowerCase();

const meId    = String(window.ME?.id || '');
const meName  = window.ME?.full_name || '';
const meEmail = String(window.ME?.sti_email || '').trim().toLowerCase();

const mine =
  (!!ownerId && ownerId === meId) ||
  (!!ownerEmail && ownerEmail === meEmail) ||
  samePerson(headerName, meName) ||
  samePerson(cardName,   meName);

modal.dataset.mine = mine ? '1' : '0';




// (optional) quick debug in console:
console.debug('[mine-check]', {ownerId, meId, headerName, cardName, ownerEmail, meEmail, result: modal.dataset.mine});




let pmPfp = modal.querySelector('#pmAddForm .cm-avatar, .pm-add .cm-avatar, .pm-input .cm-avatar');

if (!pmPfp) {
  const host  = modal.querySelector('#pmAddForm') || modal.querySelector('.pm-add') || modal.querySelector('.pm-input');
  const input = host?.querySelector('input[type="text"], textarea, #pmInput') || host?.querySelector('input, textarea');
  pmPfp = document.createElement('img');
  pmPfp.className = 'cm-avatar';
  pmPfp.alt = '';
  if (host) host.insertBefore(pmPfp, input || host.firstChild);
}

// Resolve avatar URL (fallback to default)
const fallback = (typeof mediaUrl === 'function' ? mediaUrl('Images/default-pfp.png') : 'Images/default-pfp.png');
const url = (window.ME && window.ME.profile_picture)
  ? (typeof mediaUrl === 'function' ? mediaUrl(window.ME.profile_picture) : window.ME.profile_picture)
  : fallback;

pmPfp.src = url;


if (pmPfp && window.ME?.profile_picture) {
  const url = mediaUrl(window.ME.profile_picture);
  if (pmPfp.tagName === 'IMG') pmPfp.src = url;
  else pmPfp.style.backgroundImage = `url('${url}')`;
}


// set the composer avatar to the logged-in user's pfp
const composerAvatar = modal.querySelector('.pm-add img, .pm-add .cm-avatar, .pm-input img, .pm-input .cm-avatar');

if (composerAvatar && window.ME?.profile_picture) {
  composerAvatar.src = mediaUrl(window.ME.profile_picture);
}


// load live comments from DB
await loadComments(modal.dataset.postId);


let sources = [];
let index = 0;
let prevBtn, nextBtn; // we’ll create these only if there are 2+ images


  function showImage(url){
    let img = pmMedia.querySelector('img.pm-current');
    if (!img){
      img = document.createElement('img');
      img.className = 'pm-current';
      img.alt = '';
      pmMedia.prepend(img); // keep nav buttons on top
    }
    img.src = url;
  }

  // decide content
  modal.classList.remove('text-only');
  if (type === 'image') {
    try { sources = JSON.parse(post.dataset.images || '[]') || []; } catch {}
    if (!sources.length) {
      const one = post.querySelector('.feed-media img')?.src || '';
      if (one) sources = [one];
    }
if (sources.length) {
  showImage(sources[index]);

  if (sources.length > 1) {
    pmMedia.insertAdjacentHTML('beforeend', `
      <button class="pm-nav pm-prev" type="button" aria-label="Previous">‹</button>
      <button class="pm-nav pm-next" type="button" aria-label="Next">›</button>
    `);
    prevBtn = pmMedia.querySelector('.pm-prev');
    nextBtn = pmMedia.querySelector('.pm-next');

    prevBtn.onclick = () => { index = (index - 1 + sources.length) % sources.length; showImage(sources[index]); };
    nextBtn.onclick = () => { index = (index + 1) % sources.length; showImage(sources[index]); };

    modal.classList.add('has-multi');
  } else {
    modal.classList.remove('has-multi');
  }
} else {
  modal.classList.add('text-only');
}

  } else if (type === 'video') {
    const v = document.createElement('video');
    v.controls = true; v.playsInline = true;
    const poster = post.dataset.poster || '';
    if (poster) v.poster = poster;
    const src = post.dataset.video || post.querySelector('video source')?.src || '';
    if (src) {
      v.innerHTML = `<source src="${src}" type="video/mp4">`;
      pmMedia.prepend(v);
      modal.classList.remove('has-multi'); // no nav for video
    } else {
      modal.classList.add('text-only');
    }
  } else {
    modal.classList.add('text-only');
  pmMedia.innerHTML = '';
  modal.classList.remove('has-multi');
  }


  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

window.openModalFor = openModalFor;

(() => {
  const modal = document.getElementById('postModal');
  if (!modal) return;

  let openMenu = null;



  // Handle menu actions
  modal.addEventListener('click', async (e) => {
    //const actionBtn = e.target.closest('.cm .kebab-menu [data-action]');
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    const cm = actionBtn.closest('.cm');
    const id = cm?.dataset.id;
    if (!id) return;

    // close the tiny menu
    actionBtn.closest('.kebab-menu')?.classList.remove('open'); openMenu = null;

    // EDIT → inline editor (textarea + Save/Cancel)
    if (action === 'c-edit') {
      const bubble = cm.querySelector('.cm-bubble');
      const textEl = cm.querySelector('.cm-text');
      const original = textEl?.textContent || '';

      // build editor
      const box = document.createElement('div');
      box.className = 'cm-editbox';
      box.innerHTML = `
        <textarea class="cm-edit">${original.replace(/</g,'&lt;')}</textarea>
        <button type="button" class="cm-save">Save</button>
        <button type="button" class="cm-cancel">Cancel</button>
      `;
      textEl.style.display = 'none';
      bubble.appendChild(box);

      // save/cancel
      box.querySelector('.cm-cancel').onclick = () => { box.remove(); textEl.style.display=''; };
      box.querySelector('.cm-save').onclick = async () => {
        const next = box.querySelector('.cm-edit').value.trim();
        if (!next || next === original) { box.remove(); textEl.style.display=''; return; }

        const fd = new FormData();
        fd.append('comment_id', id);
        fd.append('text', censorText(next));
        try {
          await apiJSON('/api/posts/comments/update.php', { method:'POST', body: fd });
          textEl.textContent = censorText(next);
          box.remove();
          textEl.style.display = '';
        } catch (err) {
          console.error('[comment] update failed:', err);
        }
      };
      return;
    }

    // DELETE → use your existing confirm modal
    if (action === 'c-delete') {
      confirmDeleteV2(async () => {
        const fd = new FormData();
        fd.append('comment_id', id);
        await apiJSON('/api/posts/comments/delete.php', { method:'POST', body: fd });

        // remove from UI
        cm.remove();

        // decrement counters (modal + any matching cards)
        const pmC = modal.querySelector('.pm-open-comments .count');
        if (pmC) pmC.textContent = String(Math.max(0, (parseInt(pmC.textContent || '0',10) || 0) - 1));
        const postId = modal.dataset.postId || '';
        if (postId) {
          document.querySelectorAll(`.feed-post[data-id="${postId}"] .btn-comment .count`)
            .forEach(n => n.textContent = String(Math.max(0, (parseInt(n.textContent || '0',10) || 0) - 1)));
        }
      });
      return;
    }
  });
})();



  // Open post modal when clicking the media thumbnail (ignore real buttons/links)
document.addEventListener('click', (ev) => {
  if (ev.target.closest('.btn-like, .btn-comment, .btn-share, .kebab-btn, .kebab-menu, a[href], button')) return;
  const media = ev.target.closest('.feed-post .feed-media');
  if (!media) return;
  const post = media.closest('.feed-post');
  if (!post) return;
  ev.preventDefault();
window.openModalFor(post);
});



// delegate comment click (robust: works with or without data-post)
document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.btn-comment');
  if (!btn) return;

 const card = btn.closest('.feed-post');
const post = card || (btn.dataset.post ? document.querySelector(`.feed-post[data-id="${btn.dataset.post}"]`) : null);


  if (!post) return;
  ev.preventDefault();
window.openModalFor(post);
});


  // close modal (X or backdrop)
  modal.addEventListener('click', (ev) => {
    if (ev.target.classList.contains('pm-backdrop') || ev.target.classList.contains('pm-close')) {
      modal.classList.remove('open', 'text-only');
      modal.setAttribute('aria-hidden', 'true');
      pmMedia.innerHTML = '';
      pmComments.innerHTML = '';
    }
  });

// +N image counter pill — robust across all layouts & dynamic inserts
function ensureImageCountPill(postEl) {
  if (!postEl || !postEl.querySelector) return;

  // Support your common media wrappers
  const media = postEl.querySelector('.pm-grid, .feed-media, .feed-media-grid, .post-gallery, .pm-media');
  if (!media) return;

  // Count images (prefer dataset from renderer, else DOM count)
  let count = 0;
  try {
    const arr = JSON.parse(postEl.dataset.images || '[]');
    count = Array.isArray(arr) ? arr.length : 0;
  } catch {}
  if (!count) count = media.querySelectorAll('img, .pm-img, .gallery-img').length;

  const extra = Math.max(0, count - 1);

  // Create or reuse the pill
  let pill = media.querySelector('.media-more');
  if (!pill) {
    pill = document.createElement('span');
    pill.className = 'media-more';
    media.appendChild(pill);
  }
  pill.textContent = extra > 0 ? `+${extra}` : '';
  pill.style.display = extra > 0 ? '' : 'none';
}
window.ensureImageCountPill = ensureImageCountPill;

// === Init "+N" pill for image posts ===
(function initImagePills(){
  // Run for current posts
  document.querySelectorAll('.feed-post, .post-card').forEach(ensureImageCountPill);

  // Ensure CSS exists and pill sits above shimmer/placeholder
  if (!document.getElementById('media-more-css')) {
    const s = document.createElement('style');
    s.id = 'media-more-css';
    s.textContent = `
      .pm-grid, .feed-media, .feed-media-grid, .post-gallery, .pm-media { position: relative; }
      .media-more {
        position: absolute; right: 8px; bottom: 8px;
        padding: 2px 8px; border-radius: 999px;
        font-size: .8rem; font-weight: 800;
        color: #fff; background: rgba(17,24,39,.85);
        z-index: 3; pointer-events: none;
      }
    `;
    document.head.appendChild(s);
  }
})();


// Replace your postComment with this version
async function postComment(){
  const postId = modal?.dataset?.postId || '';
  const raw = (pmInput?.value || '').trim();
  if (!postId || !raw) return;

  // mask locally before sending
  const clean = (window.censorText ? window.censorText(raw) : raw);

  const fd = new FormData();
  fd.append('post_id', postId);
  fd.append('text', clean);

  try {
    const j = await apiJSON('/api/posts/comments/create.php', { method:'POST', body: fd });

    if (j && j.item) {
      // render the server-created comment
      renderComment(j.item);

      // reset composer
      pmInput.value = '';
      pmInput.focus();

      // scroll thread to newest comment
      if (pmComments) pmComments.scrollTop = pmComments.scrollHeight;

      // update counts (prefer server count if provided)
      const modalCount = document.querySelector('#postModal .pm-open-comments .count');
      if (modalCount) {
        const next = (j.count != null)
          ? Number(j.count)
          : (Number(modalCount.textContent || 0) + 1);
        modalCount.textContent = String(next);
      }

      document
        .querySelectorAll(`.feed-post[data-id="${postId}"] .btn-comment .count`)
        .forEach(n => {
          const next = (j.count != null)
            ? Number(j.count)
            : (Number(n.textContent || 0) + 1);
          n.textContent = String(next);
        });
    }
  } catch (e) {
    console.error('[comments] create failed:', e);
  }
}


// intercept the modal's form submit / button / Enter
pmAdd?.addEventListener('submit', (e)=>{ e.preventDefault(); postComment(); });
document.addEventListener('click', (e) => {
  if (e.target.closest('#postModal .cm-send')) { e.preventDefault(); postComment(); }
});
pmInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); }
});

// Censor on edit-save as well
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('#postModal .cm-save');
  if (!btn) return;

  const cm = btn.closest('.cm');                  // the comment row
  const id = cm?.dataset?.id;
  const textarea = cm.querySelector('.cm-edit');
  if (!id || !textarea) return;

  const raw = textarea.value.trim();
  const clean = (window.censorText ? window.censorText(raw) : raw);

  const fd = new FormData();
  fd.append('comment_id', id);
  fd.append('text', clean);

  try {
    await apiJSON('/api/posts/comments/update.php', { method:'POST', body: fd });
    // reflect masked text in UI
    const textEl = cm.querySelector('.cm-text');
    if (textEl) textEl.textContent = clean;
    cm.classList.remove('editing');
  } catch (err) {
    console.error('[comments] update failed', err);
  }
});




// ===== Feed/composer alignment (fixed: single block, no scope leaks) =====
(() => {
  const COMPOSER_SEL = '#createPost';
  const TITLE_SEL    = '#recentPostsTitle';
  const FEED_SEL     = '#feed';

  function syncFeedToComposer() {
    const cp = document.querySelector(COMPOSER_SEL);
    const tt = document.querySelector(TITLE_SEL);
    const fd = document.querySelector(FEED_SEL);
    if (!cp || !tt || !fd) return;

    const cpRect     = cp.getBoundingClientRect();
    const parent     = cp.offsetParent || cp.parentElement || document.body;
    const parentRect = parent.getBoundingClientRect();
    const offsetX    = cpRect.left - parentRect.left;
    const width      = cpRect.width;

    [tt, fd].forEach(el => {
      el.style.width     = `${width}px`;
      el.style.maxWidth  = `${width}px`;
      el.style.transform = `translateX(${offsetX}px)`;
    });
  }

  function init() {
    syncFeedToComposer();

    window.addEventListener('resize', syncFeedToComposer, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) syncFeedToComposer();
    });

    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(syncFeedToComposer);
      const cp = document.querySelector(COMPOSER_SEL);
      if (cp) ro.observe(cp);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // Optional: call window.syncProfileFeedLayout() after dynamic DOM changes
  window.syncProfileFeedLayout = syncFeedToComposer;
})();

})();
// === Mark portrait images so CSS can switch to square preview ===
(() => {
  function bind(img){
    if (img.dataset._orientBound === '1') return;
    img.dataset._orientBound = '1';

    const apply = () => {
      const fig = img.closest('.feed-media');
      if (!fig) return;
      const isPortrait = img.naturalHeight > img.naturalWidth;
      fig.classList.toggle('portrait', isPortrait);
      // (No inline heights needed; CSS aspect-ratio handles sizing.)
    };

    if (img.complete && img.naturalWidth) apply();
    else img.addEventListener('load', apply, { once: true });
  }

  // Bind existing thumbnails
  document.querySelectorAll('#feedList .feed-media img').forEach(bind);

  // Bind thumbnails added later (e.g., when posts load/refresh)
  const feed = document.getElementById('feedList');
  if (feed && 'MutationObserver' in window) {
    new MutationObserver((muts) => {
      muts.forEach(m => {
        m.addedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          if (n.matches?.('#feedList .feed-media img')) bind(n);
          n.querySelectorAll?.('.feed-media img').forEach(bind);
           const post = n.closest?.('.feed-post, .post-card');
      if (post) ensureImageCountPill(post);
      n.querySelectorAll?.('.feed-post, .post-card').forEach(ensureImageCountPill);
        });
      });
    }).observe(feed, { childList: true, subtree: true });
  }
})();

// === Portrait vs Landscape preview sizing (feed cards) ===
(() => {
  if (document.getElementById('feed-media-orient-css')) return;
  const style = document.createElement('style');
  style.id = 'feed-media-orient-css';
  style.textContent = `
    /* Base container */
    #feedList .feed-media{
      position: relative;
      width: 100%;
      border-radius: 12px;
      overflow: hidden;
    }
    /* Keep your original landscape rectangle */
    #feedList .feed-media:not(.portrait){ aspect-ratio: 16 / 9; }

    /* If the image is portrait → use a square preview */
    #feedList .feed-media.portrait{ aspect-ratio: 1 / 1; }

    /* Make the image fill the box nicely in both cases */
    #feedList .feed-media > img{
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }
  `;
  document.head.appendChild(style);
})();
// === Pending overlay (shows while the new post is uploading) ===
(() => {
  if (document.getElementById('feed-pending-css')) return;
  const s = document.createElement('style');
  s.id = 'feed-pending-css';
  s.textContent = `
    #feedList .feed-post[data-pending="1"]{ opacity:.9; position:relative; }
    #feedList .feed-post .post-pending{
      position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      background:rgba(0,0,0,.28); color:#fff; font-weight:600; border-radius:12px; pointer-events:none;
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Inter, Arial;
    }
  `;
  document.head.appendChild(s);
})();


// ===== FEED MEDIA LOADER (single source of truth) =====
(() => {
  function setAmbientFromImage(img, fig){
    // Try to sample; if CORS blocks canvas, use a blurred clone fallback
    try {
      const [r,g,b] = averageColor(img);
      fig.style.setProperty('--ambient', `${r} ${g} ${b}`);
    } catch {
      if (!fig.querySelector('.ambient-clone')) {
        const clone = img.cloneNode();
        clone.classList.add('ambient-clone');
        fig.prepend(clone);
      }
    }
  }

  function averageColor(img){
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const W = c.width = 32, H = c.height = 32;
    ctx.drawImage(img, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;
    let r=0,g=0,b=0,n=0;
    for (let i=0;i<data.length;i+=4){
      if (data[i+3] < 128) continue;
      r+=data[i]; g+=data[i+1]; b+=data[i+2]; n++;
    }
    if (!n) return [240,244,248];
    r=Math.round(r/n); g=Math.round(g/n); b=Math.round(b/n);
    return [r,g,b];
  }

  function bindLazy(img){
    if (img.dataset._bound === '1') return; // avoid double-bind
    img.dataset._bound = '1';

    const fig = img.closest('.feed-media');
    if (!fig) return;

    // Assign real src (supports data-src)
    if (img.dataset.src && !img.src) img.src = img.dataset.src;

    const onLoad = () => {
      fig.dataset.loaded = 'true'; // hides shimmer
      fig.classList.toggle('portrait', img.naturalHeight > img.naturalWidth);
      setAmbientFromImage(img, fig);
    };

    if (img.complete && img.naturalWidth) onLoad();
    else img.addEventListener('load', onLoad, { once: true });

    // Robust fallback if URL fails → show a portrait placeholder and stop shimmering
    img.addEventListener('error', () => {
  img.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='900' viewBox='0 0 600 900'><defs><linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%23ff9a9e'/><stop offset='1' stop-color='%23fad0c4'/></linearGradient><radialGradient id='g1' cx='0.2' cy='0.2' r='0.6'><stop offset='0' stop-color='%23a18cd1' stop-opacity='0.9'/><stop offset='1' stop-color='%23a18cd1' stop-opacity='0'/></radialGradient><radialGradient id='g2' cx='0.85' cy='0.3' r='0.5'><stop offset='0' stop-color='%23fbc2eb' stop-opacity='0.9'/><stop offset='1' stop-color='%23fbc2eb' stop-opacity='0'/></radialGradient><linearGradient id='stripe' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='%23fff176' stop-opacity='0.7'/><stop offset='1' stop-color='%23ffd54f' stop-opacity='0.0'/></linearGradient></defs><rect width='600' height='900' fill='url(%23bg)'/><rect x='-100' y='200' width='800' height='90' fill='url(%23stripe)' transform='rotate(-15 300 245)'/><rect x='-120' y='420' width='840' height='90' fill='url(%23stripe)' transform='rotate(-15 300 465)'/><rect x='-140' y='640' width='880' height='90' fill='url(%23stripe)' transform='rotate(-15 300 685)'/><circle cx='120' cy='160' r='220' fill='url(%23g1)'/><circle cx='520' cy='220' r='200' fill='url(%23g2)'/><text x='50%25' y='50%25' font-family='Inter,Arial' font-weight='600' font-size='28' text-anchor='middle' fill='%23ffffff' opacity='.9'>Colorful Portrait</text></svg>";
  // your existing onload will run/hide shimmer; keep portrait + ambient logic as-is
}, { once: true });

  }

  function initFeedMedia(root=document){
    root.querySelectorAll('#feedList .feed-media .lazy-img').forEach(bindLazy);
  }

  // Kick it off
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => initFeedMedia());
  else
    initFeedMedia();
})();


// === Call this inside your openModalFor(post) after opening the modal ===
// modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
// (no extra code needed here since the IIFE wires once per page)
// === Modal slider: inject controls + wire behavior ===
function setupModalSlider(modal, sources) {
  const media = modal.querySelector('.pm-media');
  if (!media) return;

  // Gate: show arrows only when there are 2+ images
  modal.classList.toggle('has-multi', Array.isArray(sources) && sources.length > 1);

  // Render current frame
  let idx = 0;
  function render() {
    // clear previous frame
    media.querySelector('.pm-frame')?.remove();
    const frame = document.createElement('div');
    frame.className = 'pm-frame';
    const img = document.createElement('img');
    img.src = sources[idx];
    img.alt = '';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.display = 'block';
    img.style.objectFit = 'contain';
    frame.appendChild(img);
    media.prepend(frame); // behind the nav buttons
  }

  // Ensure nav buttons exist
  if (!media.querySelector('.pm-prev')) {
    media.insertAdjacentHTML('beforeend', `
      <button class="pm-nav pm-prev" type="button" aria-label="Previous">‹</button>
      <button class="pm-nav pm-next" type="button" aria-label="Next">›</button>
    `);
  }
  const prevBtn = media.querySelector('.pm-prev');
  const nextBtn = media.querySelector('.pm-next');

  // Handlers
  function prev(){ idx = (idx - 1 + sources.length) % sources.length; render(); }
  function next(){ idx = (idx + 1) % sources.length; render(); }
  prevBtn.onclick = prev;
  nextBtn.onclick = next;

  // Make arrow buttons non-sticky: never keep focus
[prevBtn, nextBtn].forEach(btn => {
  btn.setAttribute('tabindex', '-1');      // clicking won't keep focus
  btn.addEventListener('pointerup', () => btn.blur());
  btn.addEventListener('click', () => btn.blur());
});


  // Keyboard arrows while modal is open
  function onKey(e){
    if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'ArrowRight') next();
  }
  modal.addEventListener('keydown', onKey);

  // First paint
  render();
}



(function(){
  // ----- Utilities -----
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // Keep track of the current open menu and the currently-open post in the modal
  let openMenuEl = null;
  let currentPostEl = null;

  // Tap into clicks that open the modal to remember which post is active
  document.addEventListener('click', (e) => {
    const postCard = e.target.closest('.feed-post');
    const openedBy =
      e.target.closest('.feed-media') ||
      e.target.closest('.btn-comment') ||
      e.target.closest('.feed-body');
    if (postCard && openedBy) {
      currentPostEl = postCard;
      const pm = $('#postModal');
      if (pm) pm.dataset.postId = postCard.dataset.id || '';
    }
  }, true);

  // Create kebab button + menu DOM nodes
  function createKebab(idSuffix=''){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kebab-btn';
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');

    // vertical three-dots icon
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="5" r="2"></circle>
        <circle cx="12" cy="12" r="2"></circle>
        <circle cx="12" cy="19" r="2"></circle>
      </svg>
    `;

    const menu = document.createElement('div');
    menu.className = 'kebab-menu';
    menu.id = `post-menu-${idSuffix || Math.random().toString(36).slice(2)}`;
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
      <button type="button" data-action="edit" role="menuitem">✏️ Edit caption</button>
      <button type="button" data-action="delete" class="danger" role="menuitem">🗑️ Delete</button>
    `;
    return { btn, menu };
  }

  // Toggle logic (open one menu at a time)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.kebab-btn');
    const menu = e.target.closest('.kebab-menu');

    if (btn) {
      const m = btn.nextElementSibling;
      const willOpen = !m.classList.contains('open');
      if (openMenuEl) openMenuEl.classList.remove('open');
      if (willOpen) {
        m.classList.add('open');
        openMenuEl = m;
        btn.setAttribute('aria-expanded', 'true');
      } else {
        openMenuEl = null;
        btn.setAttribute('aria-expanded', 'false');
      }
      return;
    }
    // Click outside any menu closes
    if (!menu && openMenuEl) {
      openMenuEl.classList.remove('open');
      openMenuEl = null;
    }
  });
  

// Attach kebab to a feed post
  function wirePostKebab(postEl){
    const head = $('.feed-head', postEl);
    if (!head || head.querySelector('.kebab-btn')) return;

    const id = postEl.dataset.id || Math.random().toString(36).slice(2);
    const { btn, menu } = createKebab(id);
    head.appendChild(btn);
    head.appendChild(menu);

    // Menu actions
    menu.addEventListener('click', (e) => {
      const actBtn = e.target.closest('button[data-action]');
      if (!actBtn) return;
      const action = actBtn.dataset.action;

      // Close the menu after selecting an action
      menu.classList.remove('open'); openMenuEl = null;

      if (action === 'edit') {
        const body = postEl.querySelector('.feed-body');
        const current = body ? body.textContent.trim() : (postEl.dataset.caption || '');
        const next = prompt('Edit caption:', current);
        if (next != null) {
          // update in card
          if (body) body.textContent = next;
          postEl.dataset.caption = next;

          // update modal if this post is open
          const pm = $('#postModal');
          const isOpen = pm && pm.dataset.postId === postEl.dataset.id;
          if (isOpen) {
            const cap = $('#pmCaption');
            if (cap) cap.textContent = next;
          }
        }
      }
// Card kebab menu handler
 if (action === 'delete') {
   const active = currentPostEl || postEl;   // ← fall back to this card
confirmDeleteV2(async () => {
  const fd = new FormData();
  fd.append('post_id', active.dataset.id || '');
  await apiJSON('/api/posts/delete.php', { method:'POST', body: fd });
  document.getElementById('postModal')?.querySelector('.pm-close')?.click();
  active.remove();
});
;
 }
    });
  }

// Hydrate likes/comments for all visible posts, and re-run when new posts appear
async function hydratePostStates() {
  const ids = Array.from(document.querySelectorAll('.feed-post[data-id]'))
    .map(el => (el.dataset.id || '').match(/\d+/g)?.pop())
    .map(s => (s ? parseInt(s, 10) : NaN))
    .filter(n => Number.isFinite(n) && n > 0);

  if (!ids.length) return;

  try {
    const j = await apiJSON(`/api/posts/state.php?ids=${encodeURIComponent(ids.join(','))}`);
    const map = j.states || {};
    ids.forEach(id => {
      const st = map[id]; if (!st) return;

      document.querySelectorAll(`.feed-post[data-id$="${id}"] .btn-like .count`)
        .forEach(n => n.textContent = st.likes);

      document.querySelectorAll(`.feed-post[data-id$="${id}"] .btn-comment .count`)
        .forEach(n => n.textContent = st.comments);

      document.querySelectorAll(`.feed-post[data-id$="${id}"] .btn-like`).forEach(btn => {
        btn.setAttribute('aria-pressed', st.liked ? 'true' : 'false');
        btn.dataset.liked = st.liked ? 'true' : 'false';
        const img = btn.querySelector('.icon img, img');
        if (img && !img.dataset.baseSrc) img.dataset.baseSrc = img.getAttribute('src') || 'Images/heart.png';
        if (img) img.src = st.liked ? 'Images/heart-filled.png' : (img.dataset.baseSrc || 'Images/heart.png');
      });
    });
  } catch (e) {
    console.error('[state] hydrate failed:', e);
  }
}

// run once on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hydratePostStates, { once: true });
} else {
  hydratePostStates();
}

// re-run whenever new cards are added to the feed
const feedRoot = document.getElementById('feedList') || document;
if ('MutationObserver' in window && feedRoot) {
  const debounced = (() => { let t; return () => { clearTimeout(t); t=setTimeout(hydratePostStates, 120); }; })();
  new MutationObserver((muts) => {
    if (muts.some(m => [...m.addedNodes].some(n => n.nodeType===1 && n.matches?.('.feed-post')))) {
      debounced();
    }
  }).observe(feedRoot, { childList: true, subtree: true });
}

// optional: expose for manual calls when you render posts yourself
window.hydratePostStates = hydratePostStates;


  // Attach kebabs to all existing posts
  $$('.feed-post').forEach(wirePostKebab);

  // Global handler so any kebab menu (card or modal) can delete
if (!document.documentElement.dataset.kebabDeleteWired) {
  document.documentElement.dataset.kebabDeleteWired = '1';

  document.addEventListener('click', async (e) => {
    const delBtn = e.target.closest('.kebab-menu button[data-action="delete"]');
    if (!delBtn) return; // not a delete click

    // Find the target post element
    const pm = document.getElementById('postModal');
    let postEl =
      delBtn.closest('.feed-post') // delete from a card
      || (typeof currentPostEl !== 'undefined' ? currentPostEl : null) // tracked when modal opened
      || (pm && pm.dataset.postId ? document.querySelector(`.feed-post[data-id="${pm.dataset.postId}"]`) : null);

    if (!postEl) return;

    // Ask for confirmation using your ConfirmV2
    const ok = await ConfirmV2.ask({ title: 'Delete this post?', confirmText: 'Delete', cancelText: 'Cancel' });
    if (!ok) return;

    // Do the delete
    const fd = new FormData();
    fd.append('post_id', postEl.dataset.id || '');
    try {
      await apiJSON('/api/posts/delete.php', { method: 'POST', body: fd });
    } catch (err) {
      console.error('Delete failed:', err);
      return;
    }

    // Close modal if open, then remove the card from DOM
    pm?.querySelector('.pm-close')?.click();
    postEl.remove();
  });
}


  // Also add a kebab to the modal header (.pm-head) so it scrolls with the modal content
  (function wireModalKebab(){
    const pmHead = $('.postmodal .pm-head');
    if (!pmHead || pmHead.querySelector('.kebab-btn')) return;

    const { btn, menu } = createKebab('modal');
    pmHead.appendChild(btn);
    pmHead.appendChild(menu);

    menu.addEventListener('click', (e) => {
      const actBtn = e.target.closest('button[data-action]');
      if (!actBtn) return;
      const action = actBtn.dataset.action;

      // Close the men
      menu.classList.remove('open'); openMenuEl = null;

      // Determine the currently open post (tracked earlier)
      const active = currentPostEl;
      if (!active) return;

      if (action === 'edit') {
        const body = active.querySelector('.feed-body');
        const current = body ? body.textContent.trim() : (active.dataset.caption || '');
        const next = prompt('Edit caption:', current);
        if (next != null) {
          if (body) body.textContent = next;
          active.dataset.caption = next;
          const cap = $('#pmCaption'); if (cap) cap.textContent = next;
        }
      }

if (action === 'delete') {
  const active = currentPostEl;  // tracked on open
  if (!active) return;
confirmDeleteV2(async () => {
  const fd = new FormData();
  fd.append('post_id', active.dataset.id || '');
  await apiJSON('/api/posts/delete.php', { method:'POST', body: fd });
  document.getElementById('postModal')?.querySelector('.pm-close')?.click();
  active.remove();
});

}


    });
  })();
})();

// --- Swap SVG/emoji icons to your Images/*.png ---
(() => {
  // 1) Like buttons (card + modal)
  document.querySelectorAll('.btn-like, .pm-like').forEach(btn => {
    const icon = btn.querySelector('.icon');
    if (icon) icon.innerHTML = '<img src="Images/heart.png" alt="Like">';
  });

  // 2) Comment buttons (card + modal)
  document.querySelectorAll('.btn-comment, .pm-open-comments').forEach(btn => {
    const icon = btn.querySelector('.icon');
    if (icon) icon.innerHTML = '<img src="Images/comment.png" alt="Comments">';
  });

  // 3) Follow buttons (People you may know)
  // Works for either .btn-follow or [data-action="follow"]
  const followBtns = [
    ...document.querySelectorAll('.btn-follow'),
    ...document.querySelectorAll('[data-action="follow"]')
  ];
  followBtns.forEach(btn => {
    // If the button doesn't already have an <img>, add one
    if (!btn.querySelector('img')) {
      const img = document.createElement('img');
      img.src = 'Images/follow.png';
      img.alt = 'Follow';
      btn.prepend(img);
    }
  });

  // 4) Kebab menu items (Edit/Delete) → use your PNGs
  document.querySelectorAll('.kebab-menu [data-action="edit"]').forEach(b=>{
    b.innerHTML = '<img src="Images/edit.png" alt="Edit"><span>Edit caption</span>';
  });
  document.querySelectorAll('.kebab-menu [data-action="delete"]').forEach(b=>{
    b.innerHTML = '<img src="Images/delete.png" alt="Delete"><span>Delete</span>';
  });
})();
(function(){
  const $ = (s, r=document)=>r.querySelector(s);

  const modal = $('#postModal');
  if (!modal) return;

  const panel = modal.querySelector('.pm-panel') || modal.firstElementChild;
  const btnClose = modal.querySelector('.pm-close');

  // Centralized close
  function closePostModal(){
    modal.classList.remove('open','show');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('no-scroll');
    
  }

  async function ensureME(){
  if (window.ME && window.ME.id && window.ME.full_name) return;
  try {
    const r = await apiJSON('/api/auth/me.php');
    if (r?.ok && r.me) {
      window.ME = {
        ...(window.ME||{}),
        id: String(r.me.adviser_id ?? r.me.student_id ?? r.me.id ?? ''),
        full_name: r.me.name ?? r.me.full_name ?? '',
        sti_email: r.me.sti_email ?? r.me.email ?? '',
        profile_picture: r.me.profile_picture ?? window.ME?.profile_picture ?? ''
      };
    }
  } catch {}
}
document.addEventListener('DOMContentLoaded', ensureME, { once:true });


  // Open helper (call this wherever you open the modal)
  function openPostModal(){
    modal.classList.add('open','show');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('no-scroll');
  }
  // Expose if you need to call it elsewhere
  window.__openPostModal = openPostModal;
  window.__closePostModal = closePostModal;

  // Close with the X
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closePostModal();
  });

  // Click outside (backdrop) closes; clicks inside panel don’t
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closePostModal();
  });
  panel?.addEventListener('click', (e) => e.stopPropagation());

  // Esc to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closePostModal();
  });

  // Safety: if your close lives inside a <form>, force non-submit behavior
  if (btnClose && btnClose.getAttribute('type') !== 'button') {
    btnClose.setAttribute('type','button');
  }
})();
// Like toggle: swap to Images/heart-filled.png if present; else use CSS red filter
(() => {
  const likeBtns = [
    ...document.querySelectorAll('.btn-like'),
    ...document.querySelectorAll('.icon-like') // in case your button used this class earlier
  ];

  likeBtns.forEach(btn => {
    const img = btn.querySelector('img');
    if (!img) return;

    if (!img.dataset.baseSrc) img.dataset.baseSrc = img.getAttribute('src');

    btn.addEventListener('click', () => {
      const liked = btn.getAttribute('data-liked') === 'true';
      const nextLiked = !liked;
      btn.setAttribute('data-liked', nextLiked ? 'true' : 'false');

      // Try to use a real filled asset if you have it
      if (nextLiked) {
        const filledSrc = 'Images/heart-filled.png';
        img.src = filledSrc;
        img.onerror = function onErr() {
          // If filled asset doesn't exist, revert to base and rely on CSS tint (above)
          img.onerror = null;
          img.src = img.dataset.baseSrc;
        };
      } else {
        img.src = img.dataset.baseSrc;
      }
    }, { passive: true });
  });
})();
// --- Force the Followers pill to use Images/follow.png ---
(() => {
  // Prefer the profile followers counter; fallback to the club members counter
  const countEl =
    document.getElementById('followersCount') ||
    document.getElementById('user-club-members-count');
  if (!countEl) return;

  // Include .link-btn so it finds your button wrapper
  const pill =
    countEl.closest('.link-btn, .pill, .chip, .metric, .info-pill, .followers-pill') ||
    countEl.parentElement;
  if (!pill) return;

  // Remove any existing inline icons (SVG, etc.)
  pill.querySelectorAll('svg, .icon, .i-users, .i-people').forEach(el => el.remove());

  // Insert/replace the <img> icon immediately before the number
  let img = pill.querySelector('img.metric-icon');
  if (!img) {
    img = document.createElement('img');
    img.className = 'metric-icon';
    img.alt = 'Followers';
    pill.insertBefore(img, countEl);
  }
  img.src = 'Images/follow.png';

  // Ensure the label reads " Followers" after the number
  if (countEl.nextSibling && countEl.nextSibling.nodeType === Node.TEXT_NODE) {
    countEl.nextSibling.textContent = ' Followers';
  }
})();

(function(){
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

  // ===== Modal elements
  const ecm = $('#editCaptionModal');
  const ecmTA = $('#ecmTextarea');
  const btnSave = ecm?.querySelector('.ecm-save');
  const btnCancel = ecm?.querySelector('.ecm-cancel');
  const btnClose = ecm?.querySelector('.ecm-close');

  let editingPostEl = null;   // .feed-post being edited
  let lastFocus = null;       // to restore focus after closing

  function openEditCaptionModal(postEl){
    if (!ecm) return;
    editingPostEl = postEl;
    lastFocus = document.activeElement;

    // Grab current caption text
    const body = editingPostEl?.querySelector('.feed-body');
    const current = (body?.textContent || editingPostEl?.dataset?.caption || '').trim();

    ecmTA.value = current;
    ecm.classList.add('open');
    ecm.setAttribute('aria-hidden','false');
    document.body.classList.add('no-scroll');

    // Focus textarea
    setTimeout(()=> {
      ecmTA.focus();
      ecmTA.setSelectionRange(ecmTA.value.length, ecmTA.value.length);
    }, 0);
  }

  function closeEditCaptionModal(){
    if (!ecm) return;
    ecm.classList.remove('open');
    ecm.setAttribute('aria-hidden','true');
    document.body.classList.remove('no-scroll');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    editingPostEl = null;
  }

function saveEditCaption(){
  if (!editingPostEl) return;
  const next = ecmTA.value.trim();

  // Optimistic UI
  const body = editingPostEl.querySelector('.feed-body');
  if (body) body.textContent = next;
  editingPostEl.dataset.caption = next;

  // Sync the open post modal caption (if this post is open)
  const pm = document.getElementById('postModal');
  if (pm && pm.getAttribute('data-post-id') === (editingPostEl.dataset.id || '')) {
    const pmCap = document.getElementById('pmCaption');
    if (pmCap) pmCap.textContent = next;
  }

  // Persist to DB
  const fd = new FormData();
  fd.append('post_id', editingPostEl.dataset.id || '');
  fd.append('caption', next);
  apiJSON('/api/posts/update.php', { method:'POST', body: fd })
    .catch(err => {
      console.error('[posts] update failed', err);
      // Optional: show a toast; or rollback body text if you want.
    });

  closeEditCaptionModal();
}


  // Actions: Save/Cancel/Close
  btnSave?.addEventListener('click', saveEditCaption);
  btnCancel?.addEventListener('click', closeEditCaptionModal);
  btnClose?.addEventListener('click', closeEditCaptionModal);

  // Backdrop click closes
  ecm?.addEventListener('click', (e) => { if (e.target === ecm) closeEditCaptionModal(); });

  // Esc key closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ecm?.classList.contains('open')) closeEditCaptionModal();
  });

  // ===== Intercept kebab "Edit" clicks on cards and open modal (block old prompt)
  document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.kebab-menu [data-action="edit"]');
    if (!editBtn) return;
    const postCard = editBtn.closest('.feed-post');
    if (!postCard) return;

    // stop any earlier handler that might call prompt()
    e.preventDefault();
    e.stopImmediatePropagation();

    // Close the kebab menu if open
    const menu = editBtn.closest('.kebab-menu');
    menu?.classList.remove('open');

    openEditCaptionModal(postCard);
  }, true); // capture: true ensures we win before old handlers
})();

// === Posts API glue: submit + load + render ===
(() => {
  // 0) Grab the composer + feed (anchors you already use)
  const input    = document.getElementById('postInput');
  const filesEl  = document.getElementById('postFiles');
  const previews = document.getElementById('postPreviews');
  const counter  = document.getElementById('postCounter');
  const submit   = document.getElementById('postSubmit');
  const feed     = document.getElementById('feedList');
  if (!feed || !submit) return; // page without feed → nothing to do


if (window.__postsWired) return;
window.__postsWired = true;


// --- Upload button: single visible button (no icon, no duplicate), images OR videos ---
const createPost = document.getElementById('createPost');
const attachLabel = createPost?.querySelector('label.btn-attach'); // the clickable pill
if (attachLabel && filesEl) {
  // Keep a reference to the existing <input type="file" id="postFiles"> so we don't lose listeners
  const fileInput = filesEl;

  // 1) Strip everything inside the label (removes the paperclip .attach-icon and any old text)
  //    then re-append the input and the single "Upload" text.
  while (attachLabel.firstChild) attachLabel.removeChild(attachLabel.firstChild);
  attachLabel.appendChild(fileInput);                 // keep input inside label for click-to-open
  attachLabel.appendChild(document.createTextNode(' Upload'));

  // 2) Remove any *other* control that still says "Add photo(s)" in the action row
  //    (covers accidental second buttons/labels nearby).
  [...createPost.querySelectorAll('button, a, label, span')]
    .filter(el => el !== attachLabel && /add photo/i.test(el.textContent || ''))
    .forEach(el => el.remove());

  // 3) Allow selecting images OR videos in the native picker
  fileInput.setAttribute('accept', 'image/*,video/*');

  // 4) When selecting files, block mixed types (images + videos at once)
  fileInput.addEventListener('change', () => {
    const files = fileInput.files ? Array.from(fileInput.files) : [];
    if (!files.length) return;

    const kinds = new Set(files.map(f => (f.type || '').split('/')[0]));
    const isMixed = kinds.size > 1;

    if (isMixed) {
      alert('Please upload images OR videos, not both at once.');
      fileInput.value = '';
      if (previews) { previews.innerHTML = ''; previews.hidden = true; }
      if (counter) counter.textContent = '0';
      submit.disabled = !(input?.value || '').trim();
      return;
    }

    // (Optional) lock accept to the chosen kind for this selection:
    // fileInput.setAttribute('accept', kinds.has('video') ? 'video/*' : 'image/*');
  });

  // 5) Make the counter label generic (works for images or videos)
  if (counter) counter.title = 'Media selected';
}

  // 1) Provide apiJSON fallback only if missing (do not double-define)
  if (typeof window.apiJSON !== 'function') {
    window.apiJSON = async function apiJSON(url, opts = {}) {
      const BASE = (typeof PROJECT_BASE === 'string' && PROJECT_BASE) || '/capstone';
      const full = url.startsWith(BASE) ? url : (url.startsWith('/api/') ? `${BASE}${url}` : `${BASE}/api/${url.replace(/^\/+/, '')}`);
      const res  = await fetch(full, { credentials: 'include', ...opts });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { throw new Error(`Non-JSON from ${full}: ${text.slice(0,120)}`); }
      if (!res.ok || json?.ok === false) throw new Error(json?.detail || json?.error || `HTTP ${res.status}`);
      return json;
    };
  }


// 2) Template helpers — keep ALL demo cards (text / image / video) as hidden templates
function ensureTemplates() {
  const txt = feed.querySelector('.feed-post[data-type="text"]');
  if (txt && !txt.id) { txt.id = 'feedTplText'; txt.style.display = 'none'; }

  const img = feed.querySelector('.feed-post[data-type="image"]');
  if (img && !img.id) { img.id = 'feedTplImage'; img.style.display = 'none'; }

const vid = feed.querySelector('.feed-post[data-type="video"]');
if (vid && !vid.id) { vid.id = 'feedTplVideo'; vid.style.display = 'none'; }


  const any = feed.querySelector('.feed-post');
  if (any && !any.id && !any.matches('[data-type="text"],[data-type="image"],[data-type="video"]')) {
    any.id = 'feedTpl'; any.style.display = 'none';
  }
}

// Hide hardcoded demo cards immediately on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensureTemplates, { once: true });
} else {
  ensureTemplates();
}


function getTemplateFor(kind) {
  ensureTemplates();
  if (kind === 'video') return feed.querySelector('#feedTplVideo') || feed.querySelector('.feed-post[data-type="video"]');
  if (kind === 'image') return feed.querySelector('#feedTplImage') || feed.querySelector('.feed-post[data-type="image"]');
  return feed.querySelector('#feedTplText') || feed.querySelector('.feed-post[data-type="text"]') ||
         feed.querySelector('#feedTpl')     || feed.querySelector('.feed-post');
}



// 3) Single, canonical renderer
function buildPostCard(p) {
  // Collect media from flexible API shapes
  const imgUrls = [];
  let videoUrl = '';
  let posterUrl = '';

  const pushImg = (u) => { if (u) imgUrls.push(u); };
  const setVideo = (u, poster) => { if (u && !videoUrl) { videoUrl = u; if (poster && !posterUrl) posterUrl = poster; } };

  if (Array.isArray(p.media)) {
    for (const m of p.media) {
      const u = m?.url || m?.file_path || m?.path || m?.src || '';
      const t = String(m?.mime || m?.mimetype || m?.type || '').toLowerCase();
      const isVideo = t.startsWith('video') || /\.(mp4|webm|ogg)$/i.test(u);
      if (isVideo) setVideo(u, m?.poster || m?.thumbnail || m?.cover);
      else pushImg(u);
    }
  }
  if (!videoUrl) {
    const v = p.video || p.video_url || (Array.isArray(p.videos) && p.videos[0]);
    if (typeof v === 'string') setVideo(v, p.poster || p.thumbnail || p.cover);
    if (v && typeof v === 'object') setVideo(v.url || v.path || v.src, v.poster || v.thumbnail);
  }
  if (!imgUrls.length && Array.isArray(p.images)) imgUrls.push(...p.images.filter(Boolean));

  const kind = videoUrl ? 'video' : (imgUrls.length ? 'image' : 'text');

  const tpl = getTemplateFor(kind);
  if (!tpl) return document.createElement('article');

  const card = tpl.cloneNode(true);
  card.id = '';
  card.style.display = '';
  card.dataset.id = p.id || '';
  card.dataset.type = kind;

  // --- absolute URLs
  const BASE = (typeof PROJECT_BASE === 'string' && PROJECT_BASE) || '/capstone';
  const toAbs = (u) => {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith('/')) return u;
    return `${BASE}/${u.replace(/^\.?\//, '')}`;
  };

  const nameEl   = card.querySelector('.feed-name, .feed-author .name, .feed-head .name, .user-name, .name');
  const avatarEl = card.querySelector('.feed-avatar img, .avatar img, .pfp img, .feed-head img, img');
  const timeEl   = card.querySelector('.feed-time, time');

  // --- robust owner resolution (works on my profile + other profiles)
  const meId     = String(window.ME?.id || '');
  const targetId = (typeof getProfileTarget === 'function')
    ? String(getProfileTarget() || '')
    : String((getParam?.('user_id') || getParam?.('id') || '') || '');
  const viewingOther = !!(targetId && targetId !== meId);

  const ownerId = String(
    p.author?.id ??
    p.user_id ?? p.student_id ?? p.adviser_id ?? p.owner_id ??
    // if we're on *my* profile and API didn't send an owner id, fall back to me
    (!viewingOther ? meId : '')
  );

  // Prefer author → full_name → visited PROFILE → ME → Unknown
  const authorName =
    p.author?.full_name || p.author?.name ||
    p.full_name || p.author_name || p.name ||
    window.PROFILE?.full_name || window.PROFILE?.name ||
    window.ME?.full_name || window.ME?.name || 'Unknown';

  // Always show the real name (no "You")
  if (nameEl) nameEl.textContent = authorName;

  // Avatar (safe fallback if missing)
  const authorPic =
    p.author?.profile_picture || p.profile_picture ||
    window.PROFILE?.profile_picture || window.ME?.profile_picture || '';
  const avUrl = authorPic ? mediaUrl(authorPic) : 'Images/profile.jpg';
  if (avatarEl) {
    if (avatarEl.tagName === 'IMG') avatarEl.src = avUrl;
    else avatarEl.style.backgroundImage = `url('${avUrl}')`;
  }

  // Created time (also store ISO in dataset for the modal)
  const rawCreated = p.created_at || p.createdAt || p.created || '';
  if (rawCreated && timeEl) {
    const d = new Date(rawCreated);
    timeEl.textContent = isNaN(+d) ? rawCreated : d.toLocaleString();
    try { timeEl.setAttribute('datetime', d.toISOString()); } catch {}
    card.dataset.time = isNaN(+d) ? String(rawCreated) : d.toISOString();
  }

  // Expose data for the modal & kebab permissions
  card.dataset.user       = authorName;
  card.dataset.avatar     = authorPic || '';
  card.dataset.ownerId    = ownerId;  // <— key line: always set (with fallback on my profile)
  card.dataset.ownerEmail = (p.author?.sti_email ?? p.author_email ?? p.sti_email ?? p.email ?? '').toLowerCase();

  const bodyEl = card.querySelector('.feed-body, .caption, .post-caption');
  if (bodyEl) bodyEl.textContent = p.caption || p.text || p.body || '';

  const mediaBox = card.querySelector('.feed-media, .feed-media-grid, .post-gallery');

  if (kind === 'video' && mediaBox) {
    const src    = toAbs(videoUrl);
    const poster = toAbs(posterUrl);
    card.dataset.video = src;
    if (poster) card.dataset.poster = poster;

    let v = mediaBox.querySelector('video');
    if (!v) { v = document.createElement('video'); v.controls = true; v.playsInline = true; mediaBox.innerHTML = ''; mediaBox.appendChild(v); }
    if (poster) v.poster = poster;
    v.innerHTML = `<source src="${src}" type="video/mp4">`;

    const more = mediaBox.querySelector('.media-more');
    if (more) more.remove(); // no +N on video
  } else if (imgUrls.length && mediaBox) {
    const abs = imgUrls.map(toAbs);
    let img = mediaBox.querySelector('img');
    if (!img) { img = document.createElement('img'); mediaBox.innerHTML = ''; mediaBox.appendChild(img); }
    img.src = abs[0]; img.alt = '';
    let more = mediaBox.querySelector('.media-more');
    if (!more) { more = document.createElement('span'); more.className = 'media-more'; mediaBox.appendChild(more); }
    const extra = abs.length - 1;
    more.textContent = extra > 0 ? `+${extra}` : '';
    more.style.display = extra > 0 ? '' : 'none';
    card.dataset.images = JSON.stringify(abs);
  } else {
    const mb = card.querySelector('.feed-media, .feed-media-grid, .post-gallery');
    if (mb) mb.remove();
  }
  // Make sure each post has a kebab and permission it properly
if (typeof wirePostKebab === 'function') wirePostKebab(card);
if (typeof togglePostKebabForOwner === 'function') togglePostKebabForOwner(card, p);
return card;


  // keep your original toggle (now with reliable ownerId)
  togglePostKebabForOwner(card, p || {});
  return card;
}

// Show the kebab only for posts owned by the logged-in user
// (but always show on *my* profile page)
function togglePostKebabForOwner(postEl, post) {
  const meId = String(window.ME?.id || "");

  // am I viewing someone else's profile?
  const getTarget = (typeof window.getProfileTarget === 'function') ? window.getProfileTarget : () => null;
  const targetId = String(getTarget() || "");
  const viewingOther = !!(targetId && targetId !== meId);

  // try common owner fields returned by your endpoints
  // if missing, fall back to the dataset stamped by buildPostCard;
  // if still missing and we're on *my* profile, assume it's mine
  let ownerId = String(
    post.user_id ?? post.author_id ?? post.owner_id ?? post.student_id ?? post.adviser_id ?? ""
  );
  if (!ownerId) ownerId = String(postEl?.dataset?.ownerId || "");
  if (!ownerId && !viewingOther) ownerId = meId;

  // on *my* profile -> always show kebab
  // on *other* profiles -> show only if post is mine
  const isMine = !viewingOther || (ownerId && ownerId === meId);

  postEl
    .querySelectorAll('.kebab-btn, .post-kebab, [data-kebab], [data-action="kebab"]')
    .forEach(btn => {
      btn.style.display = isMine ? "" : "none";
      btn.setAttribute("aria-hidden", isMine ? "false" : "true");
    });
}



  // Renderer hook (used by loaders)
function renderPost(p) {
  const card = buildPostCard(p);
  if (typeof wirePostKebab === 'function') wirePostKebab(card);
  if (typeof togglePostKebabForOwner === 'function') togglePostKebabForOwner(card, p);
  return card;
}


// Helper: whose profile am I viewing?
function getProfileTarget() {
  const u = new URL(location.href);
  const id = u.searchParams.get('user_id') || u.searchParams.get('id') || u.searchParams.get('uid');
  return id && /^\d+$/.test(id) ? id : null;
}
window.getProfileTarget = getProfileTarget;

window.loadMyPosts = async function ({ before = null, append = false } = {}) {
  if (FEED_LOADING) return;
  if (append && !FEED_HAS_MORE) return;

  FEED_LOADING = true;
  const feed = document.getElementById('feedList');

  const qs = new URLSearchParams();
  qs.set('limit', '20');
  if (before) qs.set('before', String(before));

  // decide endpoint
  const targetId     = getProfileTarget();                 // id in URL when visiting someone else
  const meId         = String(window.ME?.id || '');
  const viewingOther = !!(targetId && targetId !== meId);

  let url;
  if (viewingOther) {
    // other person’s profile ⇒ ask by id
    qs.set('id', targetId); // list_by_profile accepts id/user_id
    url = `/api/posts/list_by_profile.php?${qs.toString()}&_=${Date.now()}`;
  } else {
    // my own profile ⇒ session-backed endpoint
    url = `/api/posts/list_by_user.php?${qs.toString()}&_=${Date.now()}`;
  }

  document.documentElement.classList.toggle('viewing-other', viewingOther);


  try {
    if (!append) {
      ensureTemplates?.();
      feed.querySelectorAll(
        '.feed-post:not(#feedTplText):not(#feedTplImage):not(#feedTplVideo):not(#feedTpl)'
      ).forEach(n => n.remove());
      FEED_CURSOR = null;
      FEED_HAS_MORE = true;
      FEED_LOADED_IDS.clear();
    }

    const j = await apiJSON(url, { cache: 'no-store' });
    const items = j.items || j.posts || [];

    const frag = document.createDocumentFragment();
    for (const p of items) {
      const id = Number(p.id ?? p.post_id ?? p.pid);
      if (!Number.isFinite(id) || FEED_LOADED_IDS.has(id)) continue;
      FEED_LOADED_IDS.add(id);

      // Make visited-profile posts carry the viewed user's identity,
// so the card has a name and avatar to show.
if (window.PROFILE) {
  if (!p.full_name && window.PROFILE.full_name) p.full_name = window.PROFILE.full_name;
  if (!p.profile_picture && window.PROFILE.profile_picture) {
    p.profile_picture = window.PROFILE.profile_picture;
  }
  if (!p.user_id && !p.student_id && !p.adviser_id && window.PROFILE.id) {
    if ((window.PROFILE.role || '').toLowerCase() === 'adviser') {
      p.adviser_id = window.PROFILE.id;
    } else {
      p.student_id = window.PROFILE.id;
    }
  }
}

      frag.appendChild(renderPost(p));
      FEED_CURSOR = (FEED_CURSOR == null) ? id : Math.min(FEED_CURSOR, id);
    }

    feed.appendChild(frag);
    FEED_HAS_MORE = (j.has_more !== undefined) ? !!j.has_more : (items.length >= 20);
  } catch (e) {
    console.error('[posts] list failed:', e);
    alert(e.message || 'Failed to load posts');
  } finally {
    FEED_LOADING = false;
    window.syncProfileFeedLayout?.();
    document.dispatchEvent(new Event('feed:rendered'));
  }
};



 async function submitPost(e) {
  e?.preventDefault?.();

  const feed      = document.getElementById('feedList');
  const inputEl   = (typeof input   !== 'undefined' && input)   ? input   : document.getElementById('postInput');
  const filesElEl = (typeof filesEl !== 'undefined' && filesEl) ? filesEl : document.getElementById('postFiles');

  const caption = (inputEl?.value || '').trim();
  // block posting if caption has bad words
// Hybrid moderation: local hard check, then Perspective via backend
try {
  const gate = await (typeof hybridProfanityGate === 'function'
    ? hybridProfanityGate(caption)
    : { ok: !(typeof containsBadWord==='function' && containsBadWord(caption)), source:'local' });

  if (!gate.ok) {
    if (typeof submit !== 'undefined' && submit) submit.disabled = true;
    if (typeof captionWarn !== 'undefined' && captionWarn) {
      captionWarn.hidden = false;
      captionWarn.textContent = gate.source === 'local'
        ? 'Profanity detected. Please revise.'
        : `Blocked by context check (${gate.reason}).`;
    }
    window.__posting = false;
    return;
  }
} catch {

}



  // Prefer composer’s additive selection if present
  let files = [];
  if (Array.isArray(window.selected) && window.selected.length) {
    files = window.selected.slice();
  } else if (filesElEl?.files?.length) {
    files = Array.from(filesElEl.files);
  }

  if (!caption && files.length === 0) return;
  if (window.__posting) return;
  window.__posting = true;
  if (typeof submit !== 'undefined' && submit) submit.disabled = true;

  // --- optimistic card with local blob thumbnails ---
  const isImagePost = files.length && files.every(f => /^image\//.test(f.type));
  const localUrls   = isImagePost ? files.map(f => URL.createObjectURL(f)) : [];
  const optimistic  = {
    id: 'local_' + Date.now(),
    caption,
    images: localUrls,
    media: localUrls.map(u => ({ url: u })),
    full_name: (window.ME?.full_name || window.ME?.name) || 'You'
  };

  let pendingEl = null;
  if (typeof renderPost === 'function') {
    pendingEl = renderPost(optimistic);
    pendingEl.dataset.pending = '1';
    feed?.prepend(pendingEl);
    pendingEl.insertAdjacentHTML('beforeend', '<div class="post-pending">Posting…</div>');
    pendingEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (window.syncProfileFeedLayout) window.syncProfileFeedLayout();

  // --- build form data ---
  const fd = new FormData();
  fd.append('caption', typeof censorText === 'function' ? censorText(caption || '') : (caption || ''));
  (Array.isArray(window.selected) && window.selected.length ? window.selected : files)
    .forEach(f => fd.append('media[]', f, f.name || undefined));

  // Use /api/... (do NOT include /capstone because apiJSON/postForm adds the base)
  const poster = (typeof postForm === 'function')
    ? (formData) => postForm('/api/posts/create.php', formData)
    : (formData) => apiJSON('/api/posts/create.php', { method: 'POST', body: formData });

  try {
    const res     = await poster(fd);
    const created = res?.post || res?.item || res;

    // remove "Posting…" either way
    pendingEl?.querySelector('.post-pending')?.remove();

    if (created && pendingEl) {
      // If the API didn’t echo media yet, keep our optimistic thumbnails
      if (!created.media && !created.images && localUrls.length) {
        created.images = localUrls;
      }

      const realEl = (typeof renderPost === 'function') ? renderPost(created) : buildPostCard(created);
      pendingEl.replaceWith(realEl);

      // re-bind behaviors/lazy images if your page uses them
      if (typeof wirePostKebab === 'function') wirePostKebab(realEl);
      realEl.querySelectorAll?.('.lazy-img')?.forEach(img => {
        if (typeof bindLazy === 'function') bindLazy(img);
        else img.dispatchEvent(new Event('load'));
      });

      // Soft refresh so server-confirmed media replaces blob URLs once ready
      if (typeof loadMyPosts === 'function') await loadMyPosts();
    } else {
      // Fallback: make sure the new post appears
      if (typeof loadMyPosts === 'function') await loadMyPosts();
    }
  } catch (err) {
    console.error('[posts] create failed:', err);
    alert(err?.message || 'Failed to post');
    pendingEl?.remove();
  } finally {
    // reset composer
    if (inputEl) inputEl.value = '';
    if (filesElEl) filesElEl.value = '';
    if (typeof renderPreviews === 'function') renderPreviews();
    if (typeof updateFilesInput === 'function') updateFilesInput();
    if (typeof updateAttachState === 'function') updateAttachState();
    if (typeof updateSubmitState === 'function') updateSubmitState();
    if (typeof previews !== 'undefined' && previews) { previews.innerHTML = ''; previews.hidden = true; }
    if (typeof counter  !== 'undefined' && counter)  counter.textContent = '0';
    if (typeof submit   !== 'undefined' && submit)   submit.disabled = false;
    window.selected = [];
    window.__posting = false;
  }
}




  // 6) Rebind the Post button cleanly (avoid multiple handlers)
 const cleanSubmit = submit.cloneNode(true);
submit.replaceWith(cleanSubmit);
cleanSubmit.addEventListener('click', submitPost);

  // Optional: enable/disable button based on caption or files
const updateReady = () => {
  const caption  = (input?.value || '').trim();
  const hasText  = caption.length > 0;
  const hasFile  = filesEl?.files && filesEl.files.length > 0;
  const hasMedia = (Array.isArray(window.selected) && window.selected.length) ||
                   (filesEl?.files?.length || 0);

  const hardBad  = (typeof containsBadWord === 'function' && containsBadWord(caption));
  const locked   = (!caption && !hasMedia) || hardBad;

  if (typeof cleanSubmit !== 'undefined' && cleanSubmit) cleanSubmit.disabled = !(hasText || hasFile) || locked;
  if (typeof submit      !== 'undefined' && submit)      submit.disabled      = locked;

  if (typeof captionWarn !== 'undefined' && captionWarn) {
    captionWarn.hidden = !hardBad;
    captionWarn.textContent = hardBad ? 'Profanity detected. Please revise.' : '';
  }
};

  input?.addEventListener('input', updateReady);
  filesEl?.addEventListener('change', updateReady);
  updateReady();

  // Initial load
  loadMyPosts();
})();


/* === Composer: Add/remove, additive picks (max 5), enable/disable, real submit === */
/* === Composer: image/video previews + limits (images ≤5, or exactly 1 video ≤25MB) === */
(() => {
  const MAX_IMAGES = 5;
  const MAX_VIDEO_MB = 25;

  const createPost = document.getElementById('createPost') || document;
  const input      = document.getElementById('postInput');
  const filesEl    = document.getElementById('postFiles');
  const previews   = document.getElementById('postPreviews');
  const submit     = document.getElementById('postSubmit');
  // Inline warning for captions (shown on hard local hits)
let captionWarn = document.getElementById('captionWarn');
if (!captionWarn && submit) {
  captionWarn = document.createElement('span');
  captionWarn.id = 'captionWarn';
  captionWarn.style.cssText = 'color:#dc2626;margin-left:10px;font-size:12px;display:inline-block;';
  captionWarn.hidden = true;
  submit.insertAdjacentElement('beforebegin', captionWarn);
}

  const counterEl  = document.getElementById('postCounter');  // may not exist on your page
  const attachBtn  = createPost.querySelector('.btn-attach, label[for="postFiles"]');

  // make sure the picker allows both images and videos
  if (filesEl) filesEl.setAttribute('accept','image/*,video/*');

  // red inline note shown next to the Upload button (instead of alerts)
  let errorNote = document.getElementById('mediaError');
  if (!errorNote && attachBtn) {
    errorNote = document.createElement('span');
    errorNote.id = 'mediaError';
    errorNote.style.cssText = 'color:#dc2626;margin-left:10px;font-size:12px;';
    attachBtn.after(errorNote);
  }
  const setError = (msg='') => { if (errorNote) errorNote.textContent = msg; };

  // in-memory selection (we rebuild the <input> files from this)
  let selected = [];
  const urlMap = new Map();
  const keyOf  = f => `${f.name}|${f.size}|${f.lastModified}`;

  function updateSubmitState(){
    const hasText = (input?.value || '').trim().length > 0;
    const hasFile = selected.length > 0;
    if (submit) submit.disabled = !(hasText || hasFile);
     const caption = (input?.value || '').trim();
  const hasMedia = (Array.isArray(window.selected) && window.selected.length) ||
                   (filesEl?.files?.length || 0);
  const locked = (!caption && !hasMedia) || (typeof containsBadWord === 'function' && containsBadWord(caption));
  submit.disabled = !!locked;
  }

  function updateCounter(){
    if (!counterEl) return;
    // hide the counter for video (only 1 allowed)
    const anyVideo = selected.some(f => /^video\//.test(f.type));
    if (anyVideo) { counterEl.textContent = ''; counterEl.hidden = true; }
    else {
      counterEl.hidden = false;
      counterEl.textContent = String(selected.length);
      counterEl.title = 'Media selected';
    }
  }

  function updateFilesInput(){
    if (!filesEl) return;
    const dt = new DataTransfer();
    selected.forEach(f => dt.items.add(f));
    filesEl.files = dt.files;
  }

  function renderPreviews(){
    if (!previews) return;
    previews.innerHTML = '';
    if (selected.length === 0){ previews.hidden = true; updateSubmitState(); return; }
    previews.hidden = false;

    const isVideo = selected.length === 1 && /^video\//.test(selected[0].type);
    if (isVideo){
      const file = selected[0];
      const key  = keyOf(file);
      let url = urlMap.get(key);
      if (!url){ url = URL.createObjectURL(file); urlMap.set(key, url); }

      const item = document.createElement('div');
      item.className = 'post-thumb is-video';
      item.style.cssText = 'width:128px;height:96px;position:relative;border-radius:10px;overflow:hidden;background:#f3f4f6;';
      item.innerHTML = `
        <video controls playsinline src="${url}" style="width:100%;height:100%;object-fit:cover;display:block"></video>
        <button type="button" class="remove-thumb" aria-label="Remove" style="position:absolute;top:4px;right:4px;border:none;background:#0008;color:#fff;border-radius:999px;width:24px;height:24px;line-height:24px">×</button>
      `;
      item.querySelector('.remove-thumb').addEventListener('click', () => {
        const u = urlMap.get(key); if (u){ URL.revokeObjectURL(u); urlMap.delete(key); }
        selected = [];
        filesEl.multiple = true;
        updateFilesInput(); renderPreviews();
      });
      previews.appendChild(item);
      updateSubmitState();
      return;
    }

    // images path (up to 5)
    selected.forEach((file, idx) => {
      const key = keyOf(file);
      let url = urlMap.get(key);
      if (!url){ url = URL.createObjectURL(file); urlMap.set(key, url); }

      const item = document.createElement('div');
      item.className = 'post-thumb';
      item.style.cssText = 'width:84px;height:84px;position:relative;border-radius:10px;overflow:hidden;background:#f3f4f6;';
      item.innerHTML = `
        <img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">
        <button type="button" class="remove-thumb" aria-label="Remove" style="position:absolute;top:4px;right:4px;border:none;background:#0008;color:#fff;border-radius:999px;width:20px;height:20px;line-height:20px">×</button>
      `;
      item.querySelector('.remove-thumb').addEventListener('click', () => {
        const [removed] = selected.splice(idx, 1);
        const rk = keyOf(removed);
        const u  = urlMap.get(rk); if (u){ URL.revokeObjectURL(u); urlMap.delete(rk); }
        updateFilesInput(); renderPreviews();
      });
      previews.appendChild(item);
    });

    updateSubmitState();
  }

  filesEl?.addEventListener('change', () => {
    setError('');
    const incoming = Array.from(filesEl.files || []);
    if (!incoming.length) return;

    const hasVideo = incoming.some(f => /^video\//.test(f.type));
    const hasImage = incoming.some(f => /^image\//.test(f.type));

    // no mixing images+video
    if (hasVideo && hasImage){
      setError('Please choose images OR one video.');
      filesEl.value = '';
      return;
    }

    if (hasVideo){
      const video = incoming[0];
      if (incoming.length > 1){
        setError('Only one video per post.');
        filesEl.value = '';
        return;
      }
      const mb = video.size / (1024*1024);
      if (mb > MAX_VIDEO_MB){
        setError('Video must be 25MB or less.');
        filesEl.value = '';
        return;
      }
      selected = [video];
      filesEl.multiple = false;
    } else {
      // images (merge up to 5)
      const next = (selected.filter(f => /^image\//.test(f.type))).concat(incoming);
      selected = next.slice(0, MAX_IMAGES);
      filesEl.multiple = true;
    }

    updateCounter();
    updateFilesInput();
    renderPreviews();
  });

  // update button enabled state as you type
 input?.addEventListener('input', () => {
  const caption = input.value.trim();

  // Show a *warning* (does not block posting)
  if (containsBadWord(caption)) {
    setError('Inappropriate language detected in caption.');   // same red style
  } else {
    setError(''); // clear if no other error
  }

  updateSubmitState();
});

  updateSubmitState();
})();
(() => {
  const STYLE_ID = 'confirm-v2-styles';
  const MODAL_ID = 'dcv2';

  const CSS = `
    .m2{position:fixed;inset:0;display:none;place-items:center;z-index:5000;}
    .m2[aria-hidden="false"]{display:grid;}
    .m2__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);}
    .m2__card{
      position:relative;background:#fff;border-radius:14px;
      box-shadow:0 24px 48px rgba(0,0,0,.22);padding:16px;max-width:420px;width:92%;
    }
    .m2__title{margin:0 0 12px;font-size:1.15rem;font-weight:800;color:#222;}
    .m2__actions{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}
    .m2__btn{border:1px solid transparent;border-radius:10px;padding:8px 12px;font-weight:700;cursor:pointer}
    .m2__btn--light{background:#f3f4f6;border-color:#e5e7eb}
    .m2__btn--danger{background:#b91c1c;color:#fff}
  `;

  function ensureStyles(){
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function ensureDom(){
    let el = document.getElementById(MODAL_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = MODAL_ID;
    el.className = 'm2';
    el.setAttribute('aria-hidden','true');
    el.setAttribute('role','dialog');
    el.setAttribute('aria-modal','true');
    el.setAttribute('aria-labelledby','dcv2Title');
    el.innerHTML = `
      <div class="m2__backdrop" data-close></div>
      <div class="m2__card" role="document">
        <h4 id="dcv2Title" class="m2__title">Delete this item?</h4>
        <div class="m2__actions">
          <button type="button" class="m2__btn m2__btn--light" id="dcv2Cancel">Cancel</button>
          <button type="button" class="m2__btn m2__btn--danger" id="dcv2Delete">Delete</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    return el;
  }

  function openConfirm({ title='Delete this item?', confirmText='Delete', cancelText='Cancel' } = {}){
    ensureStyles();
    const modal = ensureDom();
    const titleEl = modal.querySelector('#dcv2Title');
    const btnYes  = modal.querySelector('#dcv2Delete');
    const btnNo   = modal.querySelector('#dcv2Cancel');
    const backdrop= modal.querySelector('[data-close]');

    if (titleEl)  titleEl.textContent  = title;
    if (btnYes)   btnYes.textContent   = confirmText;
    if (btnNo)    btnNo.textContent    = cancelText;

    return new Promise((resolve) => {
      const onYes = () => { cleanup(); resolve(true); };
      const onNo  = ()   => { cleanup(); resolve(false); };
      const onEsc = (e)  => { if (e.key === 'Escape') onNo(); };

      function cleanup(){
        modal.setAttribute('aria-hidden','true');
        btnYes.removeEventListener('click', onYes);
        btnNo.removeEventListener('click', onNo);
        backdrop.removeEventListener('click', onNo);
        document.removeEventListener('keydown', onEsc);
      }

      btnYes.addEventListener('click', onYes);
      btnNo.addEventListener('click', onNo);
      backdrop.addEventListener('click', onNo);
      document.addEventListener('keydown', onEsc);

      modal.setAttribute('aria-hidden','false');
      // Try to focus the destructive action for quick keyboard confirm
      setTimeout(() => btnYes?.focus(), 0);
    });
  }

  // Public APIs (zero collision with your old functions)
  window.ConfirmV2 = {
    ask: openConfirm
  };

  // Drop-in convenience wrapper for your existing delete flows
  window.confirmDeleteV2 = (doDelete, title = 'Delete this post?') => {
    return openConfirm({ title, confirmText:'Delete', cancelText:'Cancel' })
      .then(ok => { if (ok) return doDelete?.(); });
  };
})();

// ---- mark if we're viewing someone else's profile & add CSS rule
(function () {
  const getParam = (k) => new URLSearchParams(location.search).get(k);
  const targetId = getParam('user_id') || getParam('id');      // profile we are viewing
  const meId     = window.ME?.id ? String(window.ME.id) : '';
  const viewingOther = !!(targetId && String(targetId) !== meId);

  // expose as a class we can style against
  document.documentElement.classList.toggle('viewing-other', viewingOther);


})();


// --- FINAL: comment avatars larger + perfect circle (override all earlier rules)
(() => {
  const id = 'pm-avatar-final-override';
  let s = document.getElementById(id);
  if (!s) { s = document.createElement('style'); s.id = id; document.head.appendChild(s); }
  s.textContent = `
    /* make the avatar column wider to match the new size */
    #postModal .pm-comments .cm{
      display: grid !important;
      grid-template-columns: 44px 1fr !important; /* was 26–28px in earlier blocks */
      gap: 10px !important;
    }

    /* 44px round, border included (no oval/stretch) */
    #postModal .pm-comments .cm-avatar{
      width: 44px !important;
      height: 44px !important;
      aspect-ratio: 1/1 !important;
      box-sizing: border-box !important;      /* include 2px border inside 44px */
      border: 2px solid #fff !important;
      border-radius: 50% !important;
      object-fit: cover !important;
      background: #e5e7eb !important;
      overflow: hidden !important;
      flex: 0 0 44px !important;
      box-shadow: 0 0 0 1px rgba(0,0,0,.08) inset !important;
    }
  `;
})();


(() => {
  const id='cm-kebab-hotfix';
  if (document.getElementById(id)) return;
  const s=document.createElement('style');
  s.id=id;
  s.textContent = `
    #postModal .cm-bubble{ position:relative; overflow:visible; }
    #postModal .cm .cm-row{ display:flex; align-items:center; gap:6px; }
    #postModal .cm .cm-name{ flex:1; min-width:0; }

    /* kebab visible inline */
    #postModal .cm .kebab-btn{
      position:static;
      display:inline-flex;
      width:28px; height:28px;
      align-items:center; justify-content:center;
      border:0; background:transparent; cursor:pointer;
      opacity:1;
      z-index:3;
    }
    #postModal .cm .kebab-btn svg{ width:18px; height:18px; display:block; }

    /* dropdown menu */
    #postModal .cm .kebab-menu{
      position:absolute; right:6px; top:28px;
      display:none; z-index:4; min-width:150px;
      background:#fff; border:1px solid rgba(0,0,0,.08); border-radius:10px;
      box-shadow:0 8px 24px rgba(0,0,0,.18); overflow:hidden;
    }
    #postModal .cm .kebab-menu.open{ display:block; }
  `;
  document.head.appendChild(s);
})();
(() => {
  const id='cm-kebab-hotfix';
  if (document.getElementById(id)) return;
  const s=document.createElement('style');
  s.id=id;
  s.textContent = `
    #postModal .cm-bubble{ position:relative; overflow:visible; }
    #postModal .cm .cm-row{ display:flex; align-items:center; gap:6px; }
    #postModal .cm .cm-name{ flex:1; min-width:0; }
    #postModal .cm .kebab-btn{
      position:static; display:inline-flex; align-items:center; justify-content:center;
      width:28px; height:28px; border:0; background:transparent; cursor:pointer; opacity:1; z-index:3; color:#444;
    }
    #postModal .cm .kebab-btn svg{ width:18px; height:18px; display:block; }
    #postModal .cm .kebab-menu{
      position:absolute; right:6px; top:28px; display:none; z-index:4; min-width:150px;
      background:#fff; border:1px solid rgba(0,0,0,.08); border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.18);
      overflow:hidden;
    }
    #postModal .cm .kebab-menu.open{ display:block; }
  `;
  document.head.appendChild(s);
})();
(() => {
  const id = 'cm3-css';
  const s = document.getElementById(id) || document.createElement('style');
  s.id = id;
  s.textContent = `
    /* Make the bubble allow popovers */
    #postModal .cm-bubble{ position:relative; overflow:visible; }
    /* Anchor for absolute positioning */
    #postModal .cm .cm-row{ position:relative; display:flex; align-items:center; gap:6px; }
    #postModal .cm .cm-name{ flex:1; min-width:0; }

    /* Comment-only 3 dots (PNG) — outside the bubble, hidden until hover */
    #postModal .cm .cm3-btn{
      position:absolute;
      right:-36px;          /* push OUTSIDE the bubble */
      top:6px;
      display:inline-flex; align-items:center; justify-content:center;
      width:28px; height:28px; border:0; background:transparent; cursor:pointer;
      opacity:0;            /* hidden by default */
      transition: opacity .15s ease;
      z-index:3;
    }
    #postModal .cm:hover .cm3-btn{ opacity:1; }  /* show on hover */
    #postModal .cm .cm3-icon{ width:18px; height:18px; display:block; object-fit:contain; pointer-events:none; }

    /* Dropdown — also outside the bubble, aligned under the dots */
    #postModal .cm .cm3-menu{
      position:absolute;
      right:-36px;          /* same offset as button */
      top:34px;
      display:none; z-index:4; min-width:150px;
      background:#fff; border:1px solid rgba(0,0,0,.08); border-radius:10px;
      box-shadow:0 8px 24px rgba(0,0,0,.18); overflow:hidden;
    }
    #postModal .cm .cm3-menu.open{ display:block; }
    #postModal .cm .cm3-menu button{
      display:flex; align-items:center; gap:8px; padding:8px 12px; width:100%;
      background:transparent; border:0; text-align:left; font:500 13px/1.2 Inter,system-ui,Arial; cursor:pointer;
    }
    #postModal .cm .cm3-menu button:hover{ background:#f5f7fb; }
    #postModal .cm .cm3-menu .danger{ color:#c62828; }

    /* === Comment 3-dots: outside bubble with a reserved gutter === */
#postModal .pm-comments{
  /* space at the far right so the dots/menu never hit the modal edge */
  --cm3-btn: 28px;        /* button size */
  --cm3-gap: 8px;         /* gap between bubble and button */
  --cm3-gutter: calc(var(--cm3-btn) + var(--cm3-gap));
  padding-right: calc(var(--cm3-gutter) + 6px);
}

#postModal .cm .cm-bubble{
  position: relative;
  overflow: visible;
  /* keep bubbles away from the right edge by the gutter width */
  margin-right: var(--cm3-gutter);
}

#postModal .cm .cm-row{
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
}
#postModal .cm .cm-name{ flex: 1; min-width: 0; }

/* 3 dots — lives in the reserved gutter, shows on hover */
#postModal .cm .cm3-btn{
  position: absolute;
  right: calc(-1 * var(--cm3-gutter));  /* outside the bubble */
  top: 6px;
  display: inline-flex; align-items: center; justify-content: center;
  width: var(--cm3-btn); height: var(--cm3-btn);
  border: 0; background: transparent; cursor: pointer;
  opacity: 0; transition: opacity .15s ease;
  z-index: 3;
}
#postModal .cm:hover .cm3-btn{ opacity: 1; }

#postModal .cm .cm3-icon{
  width: 18px; height: 18px; display: block; object-fit: contain; pointer-events: none;
}

/* Dropdown menu — aligned under the dots, also in the gutter */
#postModal .cm .cm3-menu{
  position: absolute;
  right: calc(-1 * var(--cm3-gutter));
  top: 34px;
  display: none; z-index: 4; min-width: 150px;
  background: #fff; border: 1px solid rgba(0,0,0,.08); border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,.18); overflow: hidden;
}
#postModal .cm .cm3-menu.open{ display: block; }
#postModal .cm .cm3-menu button{
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 8px 12px; background: transparent; border: 0; text-align: left;
  font: 500 13px/1.2 Inter, system-ui, Arial; cursor: pointer;
}
#postModal .cm .cm3-menu button:hover{ background: #f5f7fb; }
#postModal .cm .cm3-menu .danger{ color: #c62828; }

/* Optional: tighter gutter on tiny screens */
@media (max-width: 480px){
  #postModal .pm-comments{
    --cm3-btn: 24px;
    --cm3-gap: 6px;
    --cm3-gutter: calc(var(--cm3-btn) + var(--cm3-gap));
  }
}


    /* add a little gap between bubble and the 3 dots */
#postModal .cm .cm3-btn{  right:-44px; }   /* was -36px */
#postModal .cm .cm3-menu{ right:-44px; }   /* keep menu aligned with the button */


    @media (max-width: 480px){
  #postModal .cm .cm3-btn,
  #postModal .cm .cm3-menu{ right:-36px; } /* slightly closer on tiny viewports */
}
#postModal .cm .cm3-menu button .cm3-mi{
  width:16px; height:16px; object-fit:contain; display:inline-block;
}

/* — place above post modal — */
#editCaptionModal,
#confirmModal,
#postDeleteModal { position: fixed; inset: 0; z-index: 2100; }

#editCaptionModal.open,
#confirmModal.open,
#postDeleteModal.open { display: block; }

/* a bit wider cards so the copy doesn't feel cramped */
#editCaptionModal .modal-card      { max-width: 560px; width: min(560px, 92vw); }
#confirmModal .modal-card,
#postDeleteModal .modal-card       { max-width: 520px; width: min(520px, 92vw); }

/* on top of the post viewer */
#editCaptionModal,
#confirmModal,
#postDeleteModal{
  position: fixed;
  inset: 0;
  z-index: 2100;          /* above #postModal */
  display: none;
}
#editCaptionModal.open,
#confirmModal.open,
#postDeleteModal.open{ display:block; }

/* center the dialog */
#editCaptionModal .modal-card,
#confirmModal .modal-card,
#postDeleteModal .modal-card{
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  margin: 0;
  max-width: 560px;               /* edit comment */
  width: min(560px, 92vw);
}
#confirmModal .modal-card,
#postDeleteModal .modal-card{
  max-width: 520px;               /* confirm delete */
  width: min(520px, 92vw);
}


/* Avatar must always be a perfect circle */
#user-club .club-avatar,
#club-avatar,
#user-club-avatar {
  width:56px;              /* adjust if you prefer */
  height:56px;             /* keep == width */
  flex:0 0 56px;           /* never shrink or grow */
  border-radius:50%;
  background-position:center;
  background-size:cover;
  background-repeat:no-repeat;
}

/* Club name can wrap to two lines, then ellipsis */
#user-club .club-name {
  font-weight:600;
  line-height:1.25;
  min-width:0;
  overflow:hidden;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
}

.club-metric.followers{display:flex;align-items:center;gap:.5rem}
.club-metric.followers .metric-icon{width:20px;height:20px;opacity:.75}

.link-button{
  all:unset; cursor:pointer; color:var(--brand-600,#2563eb);
  font-weight:600; line-height:1.2;
}
.link-button:hover{text-decoration:underline}

.btn.btn-xs.btn-outline{
  margin-left:.25rem; padding:.25rem .6rem; border-radius:999px;
  border:1px solid var(--border,#dcdcdc); background:#fff;
}
.btn.btn-xs.btn-outline.is-following{background:#eef6ff;border-color:#a3c7ff}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;z-index:60}
.modal.open{display:flex;align-items:center;justify-content:center}
.modal .panel{background:#fff;border-radius:12px;max-width:520px;width:92%;padding:16px}
.modal .close{border:0;background:transparent;font-size:24px;line-height:1;float:right;cursor:pointer}
.vlist .vitem{display:flex;align-items:center;gap:.75rem;padding:8px 0;border-bottom:1px solid #eee}
.vlist .vitem:last-child{border-bottom:0}
.vlist .vitem .avatar{width:36px;height:36px;border-radius:50%;object-fit:cover}
.vlist .vitem .name{font-weight:600}
.vlist .vitem .role{opacity:.7;font-size:.9rem}


#postModal .pm-add { display:flex; align-items:center; gap:8px; }
#postModal .cm-avatar,
#postModal .pm-add img,
#postModal .pm-input img {
  width:36px; height:36px; border-radius:50%;
  object-fit:cover; flex:0 0 36px;
}
#postModal .pm-input { flex:1; }

#postModal #pmAddForm .cm-avatar { display:none !important; }
#postModal #pmAddForm, #postModal .pm-add { grid-template-columns: 1fr auto !important; }
/* Make the comment input panel wider so the textbox is longer */
#postModal .pm-content{
  /* Try 55/45; use 52/48 or 50/50 if you want it even longer */
  grid-template-columns: minmax(0,55%) minmax(0,45%) !important;
}

/* Keep the composer layout and let the input stretch fully */
#postModal .pm-add{ grid-template-columns: 36px 1fr auto !important; }
#postModal .pm-add input{ width: 100% !important; }
/* Profile Bio sizing */
#user-bio{
  font-size: 1.1rem;     /* bump as you like: 1.15rem / 1.2rem */
  line-height: 1.6;
}

  `;
  if (!s.parentNode) document.head.appendChild(s);
})();
