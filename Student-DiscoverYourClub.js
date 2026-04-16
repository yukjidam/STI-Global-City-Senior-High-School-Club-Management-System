document.addEventListener("DOMContentLoaded", async () => {
  await Auth.requireAuth({ roles: ["student"] });
});


(() => {
  "use strict";

  const CONFIG = { DESC_SNIPPET_CHARS: 160 };

  const esc = s => (s == null ? "" : String(s).replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])));
  function mediaUrl(p){
    if (!p) return "";
    if (/^https?:\/\//i.test(p)) return p;
    try { return new URL(String(p).replace(/^\/+/, ''), document.baseURI).href; }
    catch { return String(p); }
  }
  const snippet = (s="", n=140) => {
    const t = String(s).replace(/\s+/g,' ').trim();
    if (t.length <= n) return t;
    const cut = t.slice(0, n);
    const sp = cut.lastIndexOf(' ');
    return (sp > 40 ? cut.slice(0, sp) : cut).trim() + "…";
  };
  function capitalizeTerms(arr = []) {
    const cap = s => String(s).split(/[-\s]+/).map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
    return arr.map(cap).join(', ');
  }
  
  function formatTitle(raw){
    const s = String(raw || "").trim().replace(/\s+/g, " ");
    const amp = s.indexOf("&");
    if (amp !== -1) {
      const left  = s.slice(0, amp).trim();
      const right = s.slice(amp + 1).trim();
      return `${esc(left)} &amp;<wbr><span class="nowrap">${esc(right)}</span>`;
    }
    const parts = s.split(" ");
    if (parts.length >= 3) {
      const head = parts.slice(0, -2).join(" ");
      const tail = parts.slice(-2).join(" ");
      return `${esc(head)} <wbr><span class="nowrap">${esc(tail)}</span>`;
    }
    return esc(s);
  }

  const STOPWORDS = new Set(("special challenge challenges a an and are as at be but by for from has have i if in into is it its of on or so that the their them they this to was were will with you your youre youll we us our ours about after again against all am any because been before being below between both can did do does doing down during each few further he her here hers herself him himself his how just me more most my myself no nor not now off once only other out over own same she should than then there these those through under until up very what when where which who whom why would yourself yourselves themselves").split(/\s+/));

  const norm = s => (s || "").toLowerCase().replace(/&amp;/g, "&").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const tokenize = s => norm(s).split(" ").filter(w => w && !STOPWORDS.has(w));

  // --- Lemmatize to reduce noisy plurals/variants (very light rules)
function toSingular(w){
  if (/ies$/.test(w)) return w.replace(/ies$/, "y");   // studies -> study
  if (/ses$/.test(w)) return w.replace(/es$/, "");     // processes -> process
  if (/(ches|shes|xes|zes)$/.test(w)) return w.replace(/es$/, "");
  if (/s$/.test(w) && !/ss$/.test(w)) return w.replace(/s$/, "");
  return w;
}
function lemma(w){
  // keep gerunds & -tion/-ment as-is (skill-ish)
  if (/(ing|tion|ment|ship)$/.test(w)) return w;
  return toSingular(w);
}


  const CHOICE_SYNONYMS = {
    Service: ["service","volunteer","community","outreach","fundraising","donation"],
    STEM: ["stem","science","technology","engineering","math","robotics","programming","coding","ai"],
    ArtsPerformance: ["arts","music","dance","drama","theater","band","choir","performance","stage"],
    Sports: ["sports","athletics","basketball","football","soccer","fitness","training","tournament"],
    Culinary: ["culinary","cooking","baking","food","cuisine","kitchen"],
    Business: ["business","entrepreneurship","startup","marketing","finance","commerce","sales"],
    DesignMedia: ["design","graphics","multimedia","video","film","photo","content","media","editing"],
    SafetyHealth: ["health","safety","emergency","firstaid","rescue","wellness","redcross"],
    AcademicSupport: ["academic","study","research","tutoring","mentoring","scholars"],
    Leadership: ["leadership","teamwork","collaboration","organize","lead"],
    Creative: ["creative","creativity","innovation","ideas","design-thinking"],
    Communication: ["communication","debate","public-speaking","presentation","speech"],
    IT: ["it","tech","programming","coding","software","hardware","network","cyber"],
    ProblemSolving: ["problem","solving","analysis","logic","critical","puzzle"],
    DisciplineSports: ["discipline","resilience","sportsmanship","training","fitness"],
    SocialResponsibility: ["social","responsibility","advocacy","awareness","community"],
    ResearchWriting: ["research","writing","papers","reports","literature","study"],
    EventPlanning: ["events","planning","organizing","logistics","management","programs"],
    StagePerformance: ["performance","stage","concert","showcase","recital","culture"],
    Competitions: ["competition","tournament","contest","league","meet","cup"],
    Outreach: ["outreach","volunteer","charity","drive","community","service"],
    Multimedia: ["multimedia","film","video","editing","animation","production"],
    BusinessEvents: ["business","fair","market","product","leadership","camp"],
    RoboticsScience: ["robotics","experiment","lab","science","exhibition","hackathon"],
    CulinaryEvents: ["culinary","food","expo","cookoff","bake","contest"],
    Mentoring: ["mentoring","tutoring","peer","study-group","coach"],
    LeadershipCampus: ["leadership","student","council","campus","initiative"]
  };

// ===== Category mapping (reads clubs.category straight from DB) =====
const CATEGORY_CANON = [
  { key: "Sports",            tokens: ["sport","athletic","fitness","esports","dual"] },
  { key: "Service",           tokens: ["community service","outreach","volunteer","volunteering"] },
  { key: "Culinary",          tokens: ["culinary","cook","cooking","food","baking"] },
  { key: "ArtsPerformance",   tokens: ["arts","culture","music","dance","drama","theater","theatre","performance"] },
  { key: "DesignMedia",       tokens: ["design","multimedia","media","digital","graphic","graphics","film","photo","photography","video"] },
  { key: "STEM",              tokens: ["stem","science","technology","engineering","math","robotics","coding","programming"] },
  { key: "SafetyHealth",      tokens: ["safety","health","emergency","first aid","responder"] },
  { key: "AcademicSupport",   tokens: ["academic","study","tutor","mentoring","research","scholar","humms","abm","ict","itmawe","gas"] },
  { key: "Business",          tokens: ["business","entrepreneur","commerce","market","buy","sell","resell","thrift","consign","startup"] },
];

// Static questions already cover these categories → skip dynamic for them
const STATIC_LOCKED_CATEGORIES = new Set([
  "Sports","Service","Culinary","ArtsPerformance","DesignMedia","STEM","SafetyHealth","AcademicSupport"
]);

function mapCategoryKey(cat = "") {
  const s = String(cat || "").toLowerCase();
  for (const row of CATEGORY_CANON) {
    if (row.tokens.some(tok => s.includes(tok))) return row.key;
  }
  return "Other";
}
function categoryCoveredByStatic(cat = "") {
  return STATIC_LOCKED_CATEGORIES.has(mapCategoryKey(cat));
}

  

// ===== Stoplists & helpers (avoid club names & generic words) =====
let CLUB_STOP = new Set(); // filled from current club names

// Verbs/fillers we never want as dynamic tokens
const VERB_STOP = new Set([
  "learn","learning","learned",
  "practice","practicing","practiced",
  "build","building","built",
  "develop","developing","developed",
  "plan","planning","planned",
  "choose","choosing","chosen",
  "rotate","rotating","focus","focusing","focused",
  "host","hosting","post","posting","handle","handling",
  "collaborate","collaborating","supporting","drive","driving"
]);


const PRESET_BLOCK = new Set([
  // strands / local labels / name-y tokens
  "abm","humms","stem","gas","tvl","ict","itmawe","artes","digital","sport","sports",
  // generics or awkward in labels
  "club","clubs","engagement","recreation","interest","interests",
  "initiative","initiatives","program","programs",
  // leaked from names or filler verbs
  "run","running","action","nutrition", "campus","student","students","team","teams","member","members","organization","organizations"

]);


const GENERIC_NAME_WORDS = new Set(["club","society","organization","org","team","guild","association","alliance","chapter","unit"]);

const normalize = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function tfFromTextRaw(text){
  const tf = Object.create(null);
  tokenize(text).map(lemma).forEach(t => { if (t) tf[t] = (tf[t] || 0) + 1; });
  return tf;
}


function buildClubNameStoplist(clubs){
  const S = new Set(PRESET_BLOCK);
  for (const c of clubs){
    const name = normalize(c?.name);
    if (!name) continue;
    S.add(name);
    name.split(/\s+/).forEach(tok => { if (!GENERIC_NAME_WORDS.has(tok)) S.add(tok); });
  }
  return S;
}

// Consider baseline duplicates (synonyms) too
function isBaselineish(t){
  if (BASELINE_WORDS?.has?.(t)) return true;
  if (t.endsWith("s") && BASELINE_WORDS?.has?.(t.slice(0,-1))) return true;
  if (BASELINE_WORDS?.has?.(t + "s")) return true;
  return false;
}



// ===== Dynamic survey templates + helpers =====

// Words we never want as dynamic choices (too generic / noisy)
const BANNED_DYNAMIC_TERMS = new Set([
  "club","clubs","student","students","sti","global","city","school","member","members",
  "join","official","page","email","contact","follow","like","share","activity","activities",
  "event","events","team","youth","responders","artist","recreation, special","challenge","challenges"
]);

// Flatten your canonical map so we don't re-suggest what you already have
function _flattenSynonyms(map){
  const s = new Set();
  for (const k in map){
    s.add(String(k).toLowerCase());
    for (const v of map[k] || []) s.add(String(v).toLowerCase());
  }
  return s;
}
const BASELINE_WORDS = _flattenSynonyms(CHOICE_SYNONYMS);

// Sentence/phrase templates
const TEMPLATES = {
  // Q1 (Interests) — full sentences
  interests: [
    "Getting involved in {T} initiatives",
    "Explore {t}",
    "Contributing to {T} projects and activities",
    "Promoting {T} in our community",
    "Designing and leading {T} programs",
    "Learning more about {T} on campus",
    "Building {T}-focused ideas with peers",
    "Supporting {T} efforts and outreach",
    "Organizing {T} events and campaigns",
    "Advocating for {T}",
    "Learn about {t}",
    "Driving {T} initiatives with student teams",
    "Taking part in {T} challenges and projects",
    "Get involved in {t}",
  ],
  // Q2 (Skills) — short skill phrases
skills: [
  "Strengthen {t} skills",
  "Build {t} skills",
  "Practice {t}",
  "Improve {t}"
],


  // Q3 (Activities) — short activity phrases
  activities: [
    "{t} workshops and events",
    "{t} fairs or drives",
    "{t} showcases and exhibitions",
    "{t} competitions or tournaments",
    "{t} projects and simulations",
    "{t} camps or bootcamps"
  ]
};

// === Q1 helpers: emoji + sentence case ===
// === Emoji maps for all sections ===
const EMOJI_INTERESTS = [
  ["sustainab","🌱"], ["upcycling","🌱"], ["recycle","♻️"], ["market","🛒"], ["entrepreneur","💼"],
  ["business","💼"], ["finance","💰"], ["art","🎨"], ["music","🎵"], ["dance","💃"], ["drama","🎭"],
  ["film","🎬"], ["design","🎨"], ["photo","📷"], ["write","📝"], ["research","🔎"], ["science","🔬"],
  ["tech","💻"], ["code","💻"], ["robot","🤖"], ["health","🏥"], ["safety","🛡️"], ["sport","🏅"],
  ["food","🍳"], ["culinary","🍳"], ["service","🤝"], ["community","🤝"], ["lead","👥"]
];
const EMOJI_SKILLS = [
  ["pricing","💰"], ["budget","💰"], ["finance","💰"], ["negotiation","🤝"], ["inventory","📦"], ["logistic","🚚"],
  ["ship","🚚"], ["marketing","📣"], ["promotion","📣"], ["analytics","📊"], ["data","📊"], ["photo","📷"],
  ["copywriting","✍️"], ["writing","✍️"], ["coding","💻"], ["program","💻"], ["lead","👥"], ["manage","🗂️"]
];
const EMOJI_ACTIVITIES = [
  ["workshop","🛠️"], ["bootcamp","🛠️"], ["project","🧪"], ["simulation","🧪"], ["booth","🛍️"], ["pop","🛍️"],
  ["market","🛒"], ["listing","🛒"], ["fair","🎪"], ["drive","🎯"], ["showcase","🎪"], ["exhibit","🖼️"],
  ["competition","🏆"], ["tournament","🏆"], ["mentor","📚"], ["tutor","📚"], ["study","📚"]
];

function pickEmoji(group, text){
  const s = String(text || "").toLowerCase();
  const table = group === "skills" ? EMOJI_SKILLS : group === "activities" ? EMOJI_ACTIVITIES : EMOJI_INTERESTS;
  for (const [k,e] of table){ if (s.includes(k)) return e; }
  return group === "skills" ? "🛠️" : group === "activities" ? "🎯" : "✨";
}

function toSentenceCase(s){
  const t = String(s || "").toLowerCase().replace(/\s+/g," ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}


// Make some terms read naturally and help scoring by pairing related tokens
const LABEL_OVERRIDES = {
  pricing:     { value: "pricing budgeting",   label: "Pricing & Budgeting" },
budgeting:   { value: "budgeting pricing",   label: "Budgeting & Pricing" },
inventory:   { value: "inventory tracking",  label: "Inventory Tracking" },
consignment: { value: "consignment listing", label: "Consignment & Listings" },
shipping:    { value: "shipping meetups",    label: "Safe Shipping & Meet-ups" },
marketing:   { value: "marketing promotion", label: "Marketing & Promotions" },
photography: { value: "product photography", label: "Product Photography" },

  consignment: { value: "consignment listing",     label: "Consignment & Listings" },
  shipping:    { value: "shipping meetups",        label: "Safe Shipping & Meet-ups" },
  refurbish:   { value: "repair refurbish",        label: "Repair & Refurbish" },
  upcycling:   { value: "upcycling",               label: "Upcycling" },
  thrift:      { value: "thrift sourcing",         label: "Thrift Sourcing" },
  negotiation: { value: "negotiation",             label: "Negotiation" },
  analytics:   { value: "analytics",               label: "Analytics" },
  copywriting: { value: "copywriting",             label: "Copywriting" },
};

function valueAndLabel(group, tokOrPair){
  // interest-specific nicer nouns
  const INTEREST_OVERRIDES = {
    upcycling: "Sustainable Upcycling",
    thrift: "Thrift Sourcing",
    marketplace: "Campus Marketplace",
    sustainability: "Sustainability & Zero-Waste",
    entrepreneurship: "Student Entrepreneurship"
  };

  const hasAmp = (t) => (LABEL_OVERRIDES[t]?.label || "").includes("&");

  // Pair case
  if (Array.isArray(tokOrPair)) {
    const [a,b] = tokOrPair;
    // if either already contains “&”, keep single to avoid “A & B & C”
    if (hasAmp(a) || hasAmp(b)) return valueAndLabel(group, a);

    const A = LABEL_OVERRIDES[a]?.label || cap(a);
    const B = LABEL_OVERRIDES[b]?.label || cap(b);
    return {
      value: `${LABEL_OVERRIDES[a]?.value || a} ${LABEL_OVERRIDES[b]?.value || b}`,
      label: `${A} & ${B}`
    };
  }

  // Single
  const t = tokOrPair;
  if (group === "interests") {
    const nice = INTEREST_OVERRIDES[t];
    return { value: t, label: nice || cap(t) };
  }
  const ov = LABEL_OVERRIDES[t];
  return { value: ov?.value || t, label: ov?.label || cap(t) };
}



// simple casing helpers
const cap = s => String(s).split(/[-\s]+/).map(w => w ? w[0].toUpperCase()+w.slice(1) : w).join(" ");
const prettyPair = (a,b) => `${cap(a)} & ${cap(b)}`;

// Mine distinctive terms from club descriptions
function pickDynamicTerms(clubs, idf){
  const scores = Object.create(null);
  for (const c of clubs){
const tf  = tfFromTextRaw(String(c?.description || ""));
const vec = tfidf(tf, idf);
const top = Object.entries(vec)
  .filter(([t,w]) =>
    w > 0 &&
    t.length >= 4 &&
    !VERB_STOP.has(t) &&
    !isBaselineish(t) &&
    !CLUB_STOP.has(t) &&
    !PRESET_BLOCK.has(t)
  )
  .sort((a,b) => b[1]-a[1])
  .slice(0, 3);
    for (const [t,w] of top) scores[t] = (scores[t] || 0) + w;
  }
  return Object.entries(scores)
    .sort((a,b)=>b[1]-a[1])
    .slice(0, 24) // more terms so we can pair for Q2/Q3
    .map(([t]) => t);
}

// Similar-club deduper so near-duplicates don't spawn extra choices
const SIMILARITY_DUP_THRESHOLD = 0.82;
function dedupeSimilarClubs(clubs, idf, threshold = SIMILARITY_DUP_THRESHOLD) {
  const items = clubs.map(c => ({ c, v: tfidf(tfFromFields(c), idf) }));
  const kept = [];
  for (const it of items) {
    let dup = false;
    for (const k of kept) { if (cosine(it.v, k.v) >= threshold) { dup = true; break; } }
    if (!dup) kept.push(it);
  }
  return kept.map(x => x.c);
}

// lightweight classification for where a term belongs
const SKILL_HINTS = new Set([
  "negotiation","pricing","inventory","budgeting","finance","analytics","analysis","marketing",
  "copywriting","photography","customer","service","editing","design","coding","programming",
  "it","network","troubleshooting","research","writing","public","speaking","leadership","management",
  "simulation","mentoring","tutoring","study","group","volunteering"
]);
const ACTIVITY_HINTS = new Set([
  "competition","tournament","showcase","performance","exhibition","hackathon","workshop","camp",
  "outreach","volunteer","charity","drive","fair","market","booth","listing","consignment","shipping",
  "swap","thrift","upcycling","refurbish","repair","simulation","mentoring","tutoring","study","group"
]);
// Terms that strongly indicate marketplace/commerce vibes (no competitions wording)
const COMMERCE_TERMS = new Set([
  "pricing","negotiation","inventory","photography","listing","listings","market","marketplace",
  "booth","booths","pop","popups","pop-up","pop-ups","thrift","upcycling","resell","reselling",
  "budget","budgeting","profit","loss","quality","control","customer","service","cashless",
  "payments","meetups","shipping","consignment","repair","refurbish","zero","waste","swap",
  "marketing","copywriting","analytics","sustainable","sustainability"
]);

const classify = (t) => {
  // skill-ish endings first (negotiation, budgeting, management…)
  if (/(ing|tion|ment|ship)$/.test(t)) return "skills";
  // explicit hints
  if (ACTIVITY_HINTS.has(t)) return "activities";
  if (SKILL_HINTS.has(t)) return "skills";
  // single activity nouns that shouldn’t be Q1
  if (/^(competition|tournament|showcase|exhibition|workshop|camp|drive|fair|booth|listing|simulation)$/i.test(t)) {
    return "activities";
  }
  return "interests";
};


// Template renderer (random pick per group)
function renderTemplate(group, tSingleOrPair){
  // base templates
  let arr = TEMPLATES[group] || ["{t}"];
  const pickStable = (arr, seed) => {
  if (!arr || !arr.length) return "{t}";
  const idx = hash32(String(seed)) % arr.length;
  return arr[idx];
};

  // avoid “competitions or tournaments” for commerce-y activity labels
  const isCommerce = t => {
    const x = Array.isArray(t) ? `${t[0]} ${t[1]}` : String(t || "");
    return /market|list|consign|ship|price|budget|inventory|thrift|upcycl|booth|pop/i.test(x);
  };
  if (group === "activities" && isCommerce(tSingleOrPair)) {
    arr = arr.filter(tpl => !/competitions?\s+or\s+tournaments?/i.test(tpl));
    if (!arr.length) arr = [
      "{t} workshops and events",
      "{t} booths and pop-ups",
      "{t} listings and marketplaces",
      "{t} projects and simulations",
      "{t} fairs or drives"
    ];
  }

  const nounNeedsThe = s => /^(market|marketplace|project|initiative|event|listing|booth|workshop|program|drive|fair)$/i.test(String(s).toLowerCase());

  const seedStr = Array.isArray(tSingleOrPair)
  ? `${group}:${tSingleOrPair.join("+")}`
  : `${group}:${tSingleOrPair}`;
const tpl = pickStable(arr, seedStr);

  // Single term
  if (typeof tSingleOrPair === "string") {
    const label = cap(tSingleOrPair);

    if (group === "interests") {
      const body = tpl.replaceAll("{T}", label).replaceAll("{t}", nounNeedsThe(label) ? `the ${label}` : label);
      const sentence = toSentenceCase(body);
      return `${pickEmoji(group, sentence)} ${sentence}`;
    }
    const out = tpl.replaceAll("{T}", label).replaceAll("{t}", label);
    return `${pickEmoji(group, out)} ${out}`;
  }

  // Pair
  const [a,b] = tSingleOrPair;
  const joined = `${cap(a)} & ${cap(b)}`;

  if (group === "interests") {
    const body = tpl.replaceAll("{T}", joined).replaceAll("{t}", nounNeedsThe(joined) ? `the ${joined}` : joined);
    const sentence = toSentenceCase(body);
    return `${pickEmoji(group, sentence)} ${sentence}`;
  }
  const out = tpl.replaceAll("{T}", joined).replaceAll("{t}", joined);
  return `${pickEmoji(group, out)} ${out}`;
}



// Append a checkbox label to an existing fieldset

// ===== Deterministic digest + storage helpers =====
function hash32(str = "") {
  // FNV-1a 32-bit
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
function clubsDigest(clubs = []) {
  // stable string across refreshes for the same catalog (name|category|description)
  const rows = clubs
    .map(c => [
      (c.name || "").trim().toLowerCase(),
      (c.category || "").trim().toLowerCase(),
      (c.description || c.about || "").trim().toLowerCase()
    ].join("|"))
    .sort(); // order-agnostic
  return hash32(rows.join("\n")).toString(16);
}
function saveDynChoices(key, digest, data) {
  try { localStorage.setItem(key, JSON.stringify({ digest, data })); } catch {}
}
function loadDynChoices(key, digest) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { digest: d, data } = JSON.parse(raw);
    return d === digest ? data : null;
  } catch { return null; }
}


function appendChoiceToGroup(group, value, labelText){
  const fs = document.querySelector(`fieldset input[name="${group}"]`)?.closest("fieldset");
  if (!fs) return false;
  const label = document.createElement("label");
  label.innerHTML = `<input type="checkbox" name="${group}" value="${value}"> ${labelText}`;
  fs.appendChild(label);
  return true;
}

function injectDynamicChoices(clubs, idf){
  const form = document.querySelector(".quiz-form");
  if (!form) return;

  // Use categories in the digest so refresh is stable for the same catalog
  const STORAGE_KEY = "dynChoices.v5"; // bump to a new cache shape (arrays)
  const digest = clubsDigest(clubs.map(c => ({
    name: c.name, category: c.category, description: c.description || c.about || ""
  })));

  // 1) If cached choices exist for this exact catalog, render all and exit.
  const cached = loadDynChoices(STORAGE_KEY, digest);
  if (cached && cached.interests && cached.skills && cached.activities) {
    for (const it of (cached.interests  || [])) appendChoiceToGroup("interests",  it.value, it.label);
    for (const it of (cached.skills     || [])) appendChoiceToGroup("skills",     it.value, it.label);
    for (const it of (cached.activities || [])) appendChoiceToGroup("activities", it.value, it.label);
    limitByName();
    return;
  }

  // 2) Fresh compute path — build stoplist + dedupe near-duplicate clubs
  CLUB_STOP = buildClubNameStoplist(clubs);
  const unique = dedupeSimilarClubs(clubs, idf);

  // 3) Group by canonical category, skipping ones already covered by static questions
  const groups = new Map();
  for (const c of unique) {
    const key = mapCategoryKey(c.category);
    if (STATIC_LOCKED_CATEGORIES.has(key)) continue; // sports, etc. already covered
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  if (!groups.size) { limitByName(); return; }

  // Deterministic order: category key ascending
  const catKeys = [...groups.keys()].sort();

  // Existing values to avoid dupes
  const existing = n => new Set([...document.querySelectorAll(`input[name="${n}"]`)].map(i => i.value.toLowerCase()));
  const seen = { interests: existing("interests"), skills: existing("skills"), activities: existing("activities") };

  // We’ll collect everything we add to persist it
  const added = { interests: [], skills: [], activities: [] };

  // Guardrails so we don’t flood the UI
  const MAX_PER_SECTION = 4;

  for (const key of catKeys) {
    // Stop if all sections reached their caps
    if (added.interests.length >= MAX_PER_SECTION &&
        added.skills.length    >= MAX_PER_SECTION &&
        added.activities.length>= MAX_PER_SECTION) break;

    const clubsInCat = groups.get(key);

    // 4) Mine distinctive terms from this category’s clubs (descriptions only)
    const terms = pickDynamicTerms(clubsInCat, idf);
    if (!terms.length) continue;

    // 5) Bucket terms
    const buckets = { interests: [], skills: [], activities: [] };
    for (const t of terms) buckets[classify(t)].push(t);

    // 6) For each section, add one (prefer pairing for skills/activities)
    // Q1 — Interests
    if (added.interests.length < MAX_PER_SECTION) {
      const tI = buckets.interests.find(t => !seen.interests.has(t) && !VERB_STOP.has(t));
      if (tI) {
        const label = renderTemplate("interests", tI); // emoji + sentence case
        const value = tI;
        if (appendChoiceToGroup("interests", value, label)) {
          seen.interests.add(value.toLowerCase());
          added.interests.push({ value, label });
        }
      }
    }

    // Q2 — Skills
    if (added.skills.length < MAX_PER_SECTION) {
      let s1 = buckets.skills.find(t => !seen.skills.has(t));
      let s2 = buckets.skills.find(t => !seen.skills.has(t) && t !== s1);
      if (s1) {
        const txt = renderTemplate("skills", s2 ? [s1, s2] : s1);
        const value = s2 ? `${s1} ${s2}` : s1;
        if (appendChoiceToGroup("skills", value, txt)) {
          seen.skills.add(value.toLowerCase());
          added.skills.push({ value, label: txt });
        }
      }
    }

    // Q3 — Activities
    if (added.activities.length < MAX_PER_SECTION) {
      let a1 = buckets.activities.find(t => !seen.activities.has(t));
      let a2 = buckets.activities.find(t => !seen.activities.has(t) && t !== a1);
      if (a1) {
        const txt = renderTemplate("activities", a2 ? [a1, a2] : a1);
        const value = a2 ? `${a1} ${a2}` : a1;
        if (appendChoiceToGroup("activities", value, txt)) {
          seen.activities.add(value.toLowerCase());
          added.activities.push({ value, label: txt });
        }
      }
    }
  }

  // 7) Persist arrays so refresh shows the exact same appended choices
  saveDynChoices(STORAGE_KEY, digest, added);
  limitByName();
}





  function surveyToQuery(form) {
    const txt = form.querySelector("#club-details")?.value || "";
    const take = name => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(i => i.value);
    const choices = [...take("interests"), ...take("skills"), ...take("activities")]
    const enriched = choices.flatMap(v => CHOICE_SYNONYMS[v] || [v]);
    return [txt, ...enriched].join(" ");
  }

  /* ===== TF-IDF & Cosine core =====
     tfFromFields: builds a per-club term-frequency (TF) map from name/category/description.
     - We tokenize text, weight name higher (×2) and category (×1.5), then normalize by total terms.
  */
  function tfFromFields(obj) {
    const tf = Object.create(null);
    const add = (text, w = 1) => {
  if (!text) return;
  tokenize(text).map(lemma).forEach(t => { if (t) tf[t] = (tf[t] || 0) + w; });
};
    add(obj.name, 2);
    add(obj.category, 1.5);
    add(obj.description, 1);
    const sum = Object.values(tf).reduce((a,b)=>a+b, 0) || 1;
    for (const k in tf) tf[k] /= sum;
    return tf;
  }

  /* computeIdf: computes inverse document frequency (IDF) over all clubs.
     - For each unique term, DF = number of clubs containing it.
     - IDF uses smoothed formula: log((N+1)/(DF+1)) + 1.
  */
  function computeIdf(docTFs) {
    const df = Object.create(null);
    const N = docTFs.length || 1;
    for (const tf of docTFs) for (const term in tf) df[term] = (df[term] || 0) + 1;
    const idf = Object.create(null);
    for (const term in df) idf[term] = Math.log((N + 1) / (df[term] + 1)) + 1;
    return idf;
  }

  /* tfidf: multiplies TF by IDF to produce a weighted vector per term. */
  function tfidf(tf, idf) {
    const v = Object.create(null);
    for (const term in tf) v[term] = tf[term] * (idf[term] || 0);
    return v;
  }

  /* cosine: measures angle similarity between two vectors a & b (0..1).
     - dot(a,b) / (||a|| * ||b||) where ||x|| is Euclidean norm.
  */
  function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (const t in a) { const x = a[t]; na += x * x; if (b[t]) dot += x * b[t]; }
    for (const t in b) { const y = b[t]; nb += y * y; }
    return (na && nb) ? (dot / (Math.sqrt(na) * Math.sqrt(nb))) : 0;
  }

  /* matchedKeywords: picks the top 3 user terms that also appear in the club,
     ranked by the club’s (TF×IDF) weight for that term. */
  function matchedKeywords(userTerms, clubTF, idf) {
    const user = new Set(userTerms);
    const scored = [];
    for (const term in clubTF) {
      if (user.has(term)) {
        const weight = (clubTF[term] || 0) * (idf?.[term] || 1);
        scored.push({ term, weight });
      }
    }
    scored.sort((a, b) => b.weight - a.weight);
    return scored.slice(0, 3).map(x => x.term);
  }
  /* ===== end TF-IDF & Cosine core ===== */

  async function fetchActiveClubs() {
    const base = (window.PROJECT_BASE || "");
    const urls = [`${base}/api/clubs/list.php?limit=500&status=active`, `${base}/api/clubs/list.php?limit=500`];
    for (const u of urls) {
      try { const r = await fetch(u, { credentials: "include" }); if (!r.ok) continue; const j = await r.json(); if (j && j.items) return j.items; }
      catch {}
    }
    return [];
  }

  function getResultsTargetId(){
    const t = document.querySelector(
      '.quiz-tabs .tab[data-target="results"],' +
      '.quiz-tabs .tab[data-target="#results"],' +
      '.quiz-tabs .tab[href="#results"],' +
      '.quiz-tabs .tab[data-target*="result"],' +
      '.quiz-tabs .tab[href*="#result"]'
    );
    let id = 'results';
    if (t) {
      const dt = t.getAttribute('data-target') || '';
      const href = t.getAttribute('href') || '';
      if (dt) id = dt.replace(/^#/, '');
      if (href && href.startsWith('#')) id = href.slice(1);
    }
    const p = document.querySelector(
      `#${id}.quiz-wrapper.panel, ` +
      `.quiz-wrapper.panel#results, ` +
      `.quiz-wrapper.panel[data-panel="results"], ` +
      `.quiz-wrapper.panel[id*="result"]`
    );
    if (p && p.id) id = p.id;
    return id;
  }
  function setActiveTabs(target){
    const id = String(target || '').replace(/^#/, '') || getResultsTargetId();
    document.querySelectorAll('.quiz-tabs .tab').forEach(tab => {
      const dt = (tab.getAttribute('data-target') || '').replace(/^#/, '');
      const href = (tab.getAttribute('href') || '').replace(/^#/, '');
      const matches = (dt && dt === id) || (href && href === id);
      tab.classList.toggle('active', matches);
    });
    document.querySelectorAll('.quiz-wrapper.panel').forEach(p=>{ p.classList.toggle('active', p.id === id); });
  }
  function wireTabs(){
    document.querySelectorAll(".quiz-tabs .tab").forEach(tab=>{
      tab.addEventListener("click", (ev)=>{
        const targetRaw = tab.getAttribute('data-target') || tab.getAttribute('href') || '';
        const target = targetRaw.replace(/^#/, '');
        if ((/result/i.test(target)) && isSurveyEmpty()){
          tab.classList.add('shake'); setTimeout(()=>tab.classList.remove('shake'), 260);
          ev.preventDefault(); return;
        }
        ev.preventDefault(); setActiveTabs(target);
      });
    });
  }
  function showResultsPanel(){
    const id = getResultsTargetId();
    setActiveTabs(id);
    document.getElementById(id)?.scrollIntoView({ behavior:'smooth', block:'start' });
    const gridPanel = document.getElementById('resultsGrid')?.closest('.quiz-wrapper.panel');
    if (gridPanel && !gridPanel.classList.contains('active')) {
      document.querySelectorAll('.quiz-wrapper.panel').forEach(p=>p.classList.remove('active'));
      gridPanel.classList.add('active');
      document.querySelectorAll('.quiz-tabs .tab').forEach(t=>t.classList.remove('active'));
    }
  }

  function renderResults(items, userTokens, grid){
    if (!grid) return;

    const html = (items||[]).map((c, idx) => {
      const rawName   = c.name || "Untitled Club";
      const name      = esc(rawName);
      const titleHTML = formatTitle(rawName);
      const cat    = esc(c.category || c.tags || "Club");
      const desc   = esc(snippet(c.description || c.about || "", CONFIG.DESC_SNIPPET_CHARS));
      const logo = c.profile_picture ? mediaUrl(c.profile_picture) : "";
      const hasLogo = !!logo;
      const initials = (c.name && c.name.trim()[0]) ? c.name.trim()[0].toUpperCase() : 'C';
      const color = '#64748b';
      const pct    = Math.max(0, Math.min(100, c._pct|0));
      const chips  = capitalizeTerms(c._chips || []);
      const adviser = c.adviser_name || c.adviser_fullname || "";
      const adviserEmail = c.adviser_email || "";

      return `
<article class="result-card _in" data-club-id="${c.id ?? ''}" style="--i:${idx}">
  <div class="match" aria-label="${pct}% match" style="--p:${pct}"><span>${pct}%</span></div>
  <div class="rc-title">
    ${hasLogo ? `<img class="rc-logo" src="${logo}" alt="${name} logo" loading="lazy">`
              : `<div class="rc-logo rc-logo--placeholder" style="background:${color}">${esc(initials)}</div>`}
    <h3>${titleHTML}</h3>
  </div>
  <p class="rc-desc">${desc || "—"}</p>
  <div class="meta-block">
    <div class="meta-row"><span class="meta-label">Category:</span><div class="meta-value">${cat}</div></div>
    <div class="meta-row"><span class="meta-label">Matched Keywords:</span><div class="meta-value">${chips || '<span class="muted">—</span>'}</div></div>
    <div class="meta-row"><span class="meta-label">Club Adviser:</span><div class="meta-value">${esc(adviser) || esc(adviserEmail) || '<span class="muted">—</span>'}</div></div>
  </div>
  <button class="btn-details" type="button" data-club-id="${c.id ?? ''}">View Details</button>
</article>`;
    }).join("");

    const cta = `
  <div class="results-cta _in" style="--i:${(items||[]).length}">
    <a id="browseAll" class="btn-browse-all" href="Student-ListOfClub.html">Browse All Clubs</a>
  </div>`;

    const count = Math.max(1, Math.min((items?.length || 0), 3));
    const imp = (el, prop, value) => el.style.setProperty(prop, value, 'important');

    grid.innerHTML = html + cta;

    imp(grid, 'display', 'grid');
    imp(grid, 'grid-template-columns', `repeat(${count}, minmax(340px, 420px))`);
    imp(grid, 'justify-content', 'center');
    imp(grid, 'gap', '20px');
    imp(grid, 'margin', '12px auto 32px');
    const track = 420, gap = 20;
    const maxW = count * track + (count - 1) * gap;
    imp(grid, 'max-width', `${maxW}px`);
    grid.querySelectorAll('.result-card').forEach(card => { imp(card, 'width', '100%'); imp(card, 'max-width', '420px'); });
    const ctaEl = grid.querySelector('.results-cta');
    if (ctaEl) { imp(ctaEl, 'grid-column', '1 / -1'); ctaEl.style.display = 'flex'; ctaEl.style.justifyContent = 'center'; }
    if (window.innerWidth < 760) { imp(grid, 'grid-template-columns', '1fr'); imp(grid, 'max-width', '100%'); }

    grid.querySelectorAll('.match').forEach(ring => {
      const target = ring.style.getPropertyValue('--p') || '0';
      ring.style.setProperty('--p', '0');
      requestAnimationFrame(() => requestAnimationFrame(() => ring.style.setProperty('--p', target)));
    });

    grid.querySelectorAll('.rc-title').forEach(t => {
      t.style.setProperty('display', 'flex', 'important');
      t.style.setProperty('align-items', 'center', 'important');
      t.style.setProperty('gap', '12px', 'important');
    });
    grid.querySelectorAll('.rc-title .rc-logo').forEach(img => {
      img.style.setProperty('flex', '0 0 48px', 'important');
      img.style.setProperty('width', '48px', 'important');
      img.style.setProperty('height', '48px', 'important');
      img.style.setProperty('border-radius', '50%', 'important');
      img.style.setProperty('object-fit', 'cover', 'important');
    });
    grid.querySelectorAll('.rc-title h3').forEach(h => {
      h.style.setProperty('margin', '0', 'important');
      h.style.setProperty('flex', '1 1 auto', 'important');
      h.style.setProperty('padding-right', '88px', 'important');
      h.style.setProperty('display', '-webkit-box', 'important');
      h.style.setProperty('-webkit-box-orient', 'vertical', 'important');
      h.style.setProperty('-webkit-line-clamp', '2', 'important');
      h.style.setProperty('overflow', 'hidden', 'important');
      h.style.setProperty('word-break', 'break-word', 'important');
    });
  }

  function isSurveyEmpty(){
    const form = document.querySelector(".quiz-form");
    const checks = form?.querySelectorAll('input[type="checkbox"]:checked')?.length || 0;
    const txt = form?.querySelector('#club-details')?.value?.trim() || "";
    return (checks === 0 && txt.length < 2);
  }
  function updateSubmitLock(){
    const form = document.querySelector(".quiz-form");
    const resultsTab = document.querySelector('.quiz-tabs .tab[data-target="results"], .quiz-tabs .tab[href="#results"]');
    const submitBtn = form?.querySelector('.recommend-btn, button[type="submit"], input[type="submit"]');
    const empty = isSurveyEmpty();
    if (submitBtn){ submitBtn.disabled = empty; submitBtn.classList.toggle('is-disabled', empty); }
    resultsTab?.classList.toggle('is-locked', empty);
  }
  function limitByName() {
    const form = document.querySelector(".quiz-form");
    const max = 3;
    ["interests","skills","activities"].forEach(name => {
      const boxes = Array.from(form.querySelectorAll(`input[name="${name}"]`));
      const apply = () => {
        const picked = boxes.filter(b => b.checked).length;
        const lock = picked >= max;
        boxes.forEach(b => { b.disabled = !b.checked && lock; });
        updateSubmitLock();
      };
      boxes.forEach(b => b.addEventListener('change', apply));
      apply();
    });
    form.addEventListener('input', updateSubmitLock);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const form = document.querySelector(".quiz-form");
    const grid = document.getElementById("resultsGrid");

    wireTabs();
    limitByName();
    updateSubmitLock();

    const clubs = await fetchActiveClubs();
    const clubTFs = clubs.map(c => tfFromFields(c));
    const idf = computeIdf(clubTFs);
    injectDynamicChoices(clubs, idf);

    form?.addEventListener("submit", (e) => {
      e.preventDefault();

      const query = surveyToQuery(form);
      const userTokens = tokenize(query);

      /* ===== TF-IDF & Cosine scoring (survey vs clubs) =====
         1) Build the user's TF from survey tokens (not from any club text),
            then multiply by IDF to get the query vector uVec.
         2) For each club, build its TF-IDF vector from name/category/description.
         3) Compute cosine(uVec, dVec) for geometric similarity (0..1).
         4) Compute coverage = fraction of the user's weighted terms found in the club
            (using IDF weights), then raw score = coverage + 0.2*cosine.
      */
      const userTF = Object.create(null);
      for (const t of userTokens) userTF[t] = (userTF[t] || 0) + 1.25;
      const uVec = tfidf(userTF, idf);

      const uniqUser = [...new Set(userTokens)];
      const weights = uniqUser.map(t => ({ t, w: (idf[t] || 1) }));
      const denom = weights.reduce((s,o)=> s + o.w, 0) || 1;

      const raw = clubs.map((c, i) => {
        const dTF  = clubTFs[i];
        const dVec = tfidf(dTF, idf);
        const sim = cosine(uVec, dVec);
        const covered = weights.reduce((s,o) => s + (dTF[o.t] ? o.w : 0), 0);
        const coverage = covered / denom;                 // 0..1 coverage of user's weighted terms
        const score = coverage + 0.2 * sim;               // raw score used for ranking
        return { club: c, dTF, score, coverage };
      });
      /* ===== end TF-IDF & Cosine scoring ===== */

      const matchedOnly = raw.filter(r => r.coverage > 0);
      if (matchedOnly.length === 0) {
        grid.innerHTML = `<div class="_in" style="--i:0; text-align:center; padding:16px; color:#6b7280;">No matches yet — try different choices.</div>`;
        showResultsPanel();
        return;
      }

      const top = matchedOnly.sort((a,b)=> b.score - a.score).slice(0, 3);

      const total = top.reduce((s,r)=> s + r.score, 0);
      let percents;
      if (total > 0) {
        percents = top.map(r => Math.round((r.score / total) * 100));
        let diff = 100 - percents.reduce((s,p)=>s+p,0);
        for (let i=0; diff !== 0 && i<top.length; i++) {
          const adj = diff > 0 ? 1 : -1;
          percents[i] += adj;
          diff -= adj;
          if (i === top.length - 1 && diff !== 0) i = -1;
        }
      } else {
        const even = Math.floor(100 / top.length);
        percents = top.map(()=>even);
        let rest = 100 - even * top.length;
        for (let i=0; rest>0; i++, rest--) percents[i % top.length] += 1;
      }

      const scored = top.map((r, idx) => {
        const chips = matchedKeywords(uniqUser, r.dTF, idf);
        return { ...r.club, _pct: percents[idx], _chips: chips, _score: r.score };
      });

      renderResults(scored, uniqUser, grid);
      showResultsPanel();
    });
  });
})();

(() => {
  const ROOT = '/capstone';
  const go = (rel) => { const clean = String(rel || '').replace(/^\//, ''); const url = `${ROOT}/${clean}`; window.location.assign(url); };

  const clubIndex = Object.create(null);
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  let resolveReady;
  const indexReady = new Promise(r => (resolveReady = r));
  fetch(`${ROOT}/api/clubs/list.php?limit=500`)
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(data => (data?.items || []).forEach(c => { clubIndex[norm(c.name)] = String(c.id); }))
    .catch(() => {})
    .finally(() => resolveReady());

  document.addEventListener('click', (e) => {
    const el = e.target.closest('#browseAll, .browse-all button, .browse-all-btn');
    if (!el) return;
    e.preventDefault();
    go('Student-ListOfClub.html');
  });

  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-club-id]') || e.target.closest('.btn-details, .view-details, .btn, a');
    if (!target) return;
    const label = (target.textContent || '').toLowerCase();
    const looks = /view\s*details/.test(label) || target.hasAttribute('data-club-id');
    if (!looks) return;
    e.preventDefault();

    let id = target.dataset.clubId || target.getAttribute('data-club-id') || target.closest('.result-card')?.dataset.clubId;
    if (id) { go(`Student-ClubDetails.html?id=${encodeURIComponent(id)}`); return; }

    indexReady.then(() => {
      const card = target.closest('.result-card, .card, article, li, div');
      const clubName = card?.querySelector('[data-club-name]')?.getAttribute('data-club-name') || card?.querySelector('h3, .club-name, .card-title')?.textContent || '';
      const key = norm(clubName);
      const resolved = clubIndex[key];
      if (resolved) go(`Student-ClubDetails.html?id=${encodeURIComponent(resolved)}`);
    });
  });
})();
