(function () {
  const tg = window.Telegram?.WebApp;
  try { tg?.ready(); } catch {}

  // Views
  const viewDicts = document.getElementById("viewDicts");
  const viewSections = document.getElementById("viewSections");
  const viewLearnMenu = document.getElementById("viewLearnMenu");
const viewSetMenu = document.getElementById("viewSetMenu");
  const viewGlobalTestMenu = document.getElementById("viewGlobalTestMenu");
  const viewMatchMenu = document.getElementById("viewMatchMenu");
  const viewMatchGame = document.getElementById("viewMatchGame");
  const viewMatchResult = document.getElementById("viewMatchResult");
  const viewTest = document.getElementById("viewTest");
  const viewStudy = document.getElementById("viewStudy");
  const viewSessionAnalytics = document.getElementById("viewSessionAnalytics");

  
// Dicts
  const dictsList = document.getElementById("dictsList");
  const btnGlobalTest = document.getElementById("btnGlobalTest");

  // Sections
  const sectionsTitle = document.getElementById("sectionsTitle");
  const sectionsList = document.getElementById("sectionsList");
  const btnBackToDicts = document.getElementById("btnBackToDicts");
  // Set menu
  const setMenuTitle = document.getElementById("setMenuTitle");
  const setMenuInfo = document.getElementById("setMenuInfo");
  const btnModeKb = document.getElementById("btnModeKb");
  const btnModeRu = document.getElementById("btnModeRu");
    const btnSetShowAll = document.getElementById("btnSetShowAll");
  const btnSetHideAll = document.getElementById("btnSetHideAll");
  const setWordsList = document.getElementById("setWordsList");
// Study
  const card = document.getElementById("card");
  const wordEl = document.getElementById("word");
  const transEl = document.getElementById("trans");
  const exampleBox = document.getElementById("exampleBox");
  const btnYes = document.getElementById("btnYes");
  const btnNo = document.getElementById("btnNo");
  const btnUndo = document.getElementById("btnUndo");
  const btnFavAction = document.getElementById("btnFavAction");
  const favActionLabel = document.getElementById("favActionLabel");
  const btnBackToSetMenu = document.getElementById("btnBackToSetMenu");

  // Top meta
  const counter = document.getElementById("counter");
  const btnBackArrow = document.getElementById("btnBackArrow");
  const modeEl = document.getElementById("mode");

  // Global test menu
  const globalTestInfo = document.getElementById("globalTestInfo");
  const btnTestScopeToggle = document.getElementById("btnTestScopeToggle");
  const testScopeBody = document.getElementById("testScopeBody");
  const testScopeList = document.getElementById("testScopeList");
  const btnGlobalModeKb = document.getElementById("btnGlobalModeKb");
  const btnGlobalModeRu = document.getElementById("btnGlobalModeRu");
  const btnGlobalTestBack = document.getElementById("btnGlobalTestBack");


  // Match words menu
  const btnMatchWords = document.getElementById("btnMatchWords");
  const matchInfo = document.getElementById("matchInfo");
  const matchScopeBody = document.getElementById("matchScopeBody");
  const matchScopeList = document.getElementById("matchScopeList");
  const btnMatchStart = document.getElementById("btnMatchStart");

  // Match game
  const matchProgress = document.getElementById("matchProgress");
  const matchColLeft = document.getElementById("matchColLeft");
  const matchColRight = document.getElementById("matchColRight");
  const matchResultList = document.getElementById("matchResultList");

  // Test view
  const testTitle = document.getElementById("testTitle");
  const testProgress = document.getElementById("testProgress");
  const testQuestion = document.getElementById("testQuestion");
  const testOptions = document.getElementById("testOptions");
  const btnTestExit = document.getElementById("btnTestExit");
  const btnTestNext = document.getElementById("btnTestNext");

  // ---------- Storage: hidden words (affects ONLY STUDY sessions)
  const HIDDEN_KEY = "fc_hidden_by_set_v7";
  function loadHiddenMap() { try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) || "{}"); } catch { return {}; } }
  function saveHiddenMap(map) { localStorage.setItem(HIDDEN_KEY, JSON.stringify(map)); }
  function keyOf(d, s, setNo) { return `${d}:${s}:${setNo}`; }
  function getHiddenSet(d, s, setNo) {
    const map = loadHiddenMap();
    const arr = Array.isArray(map[keyOf(d, s, setNo)]) ? map[keyOf(d, s, setNo)] : [];
    return new Set(arr.map(Number));
  }
  function setHiddenSet(d, s, setNo, setOfIds) {
    const map = loadHiddenMap();
    map[keyOf(d, s, setNo)] = Array.from(setOfIds);
    saveHiddenMap(map);
  }

  

  // ---------- Storage: finished sets (manual "✅") — v9.8
  const FINISHED_KEY = "fc_finished_sets_v1";
  function loadFinishedMap(){ try { return JSON.parse(localStorage.getItem(FINISHED_KEY) || "{}"); } catch { return {}; } }
  function saveFinishedMap(map){ localStorage.setItem(FINISHED_KEY, JSON.stringify(map)); }
  function isSetFinished(d, s, setNo){
    const map = loadFinishedMap();
    return !!map[keyOf(d, s, setNo)];
  }
  function toggleSetFinished(d, s, setNo){
    const map = loadFinishedMap();
    const k = keyOf(d, s, setNo);
    if (map[k]) delete map[k]; else map[k] = true;
    saveFinishedMap(map);
    return !!map[k];
  }

  // ---------- Storage: favorites (per-device)
  const FAV_KEY = "fc_favorites_v1";
  function loadFavSet() {
    try {
      const arr = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
      return new Set(Array.isArray(arr) ? arr.map(Number).filter(Boolean) : []);
    } catch {
      return new Set();
    }
  }
  function saveFavSet(setOfIds) { localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(setOfIds))); }
  function isFav(id) { return favIds.has(Number(id)); }
  function toggleFav(id) {
    const nid = Number(id);
    if (!nid) return false;
    if (favIds.has(nid)) favIds.delete(nid); else favIds.add(nid);
    saveFavSet(favIds);
    return favIds.has(nid);
  }

  // ---------- Words cache + versioning (v9.11: meta-sheet controlled)
// No external old cache key anymore. Cache keys are internal and stable.
const WORDS_STORAGE_KEY = "alan_words_cache";
const WORDS_VERSION_KEY = "alan_words_version";

function loadCachedWords() { try { return JSON.parse(localStorage.getItem(WORDS_STORAGE_KEY) || "null"); } catch { return null; } }
function saveCachedWords(data) { try { localStorage.setItem(WORDS_STORAGE_KEY, JSON.stringify(data)); } catch {} }

function loadCachedVersion() {
  const v = localStorage.getItem(WORDS_VERSION_KEY);
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function saveCachedVersion(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return;
  try { localStorage.setItem(WORDS_VERSION_KEY, String(n)); } catch {}
}

function extractSheetId(url) {
  const u = (url || "").trim();
  const m = u.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : "";
}

function makeGvizCsvUrl(sheetId, extraParams = "") {
  if (!sheetId) return "";
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${extraParams}`;
}

// Read dictionary version from Google Sheets: sheet "meta", A1="version", B1=<number>
async function fetchRemoteVersion(sheetUrl) {
  const id = extractSheetId(sheetUrl);
  if (!id) return null;

  const metaUrl = makeGvizCsvUrl(id, "&sheet=meta&range=A1:B1");
  try {
    const res = await fetch(metaUrl, { cache: "no-store" });
    if (!res.ok) return null;
    const text = await res.text();
    const rows = parseCsvRows(text);
    if (!rows.length) return null;

    // Expected: one row, two cols: ["version", "12"]
    const row = rows[0] || [];
    const a1 = String(row[0] || "").trim().toLowerCase();
    const b1 = String(row[1] || "").trim();
    if (a1 !== "version") return null;

    const n = Number(b1);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

// Tiny CSV parser that returns table rows (no header assumptions)
function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cur); cur = ""; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (ch === '\n') {}
      else cur += ch;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }

  // remove empty trailing rows
  return rows.filter(r => Array.isArray(r) && r.some(c => String(c || "").trim() !== ""));
}

// ---------- Sheets URL -> CSV
  // ---------- Sheets URL -> CSV
  function normalizeToCsvUrl(url) {
    const u = (url || "").trim();
    if (!u) return "";
    if (u.includes("output=csv") || u.includes("out:csv") || u.includes("format=csv")) return u;
    const m = u.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!m) return u;
    const id = m[1];
    return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`;
  }

  async function loadWords() {
  const cachedWords = loadCachedWords();
  const hasCache = Array.isArray(cachedWords) && cachedWords.length > 0;
  const localVersion = loadCachedVersion();

  const sheetUrl = (window.WORDS_SHEET_URL || "").trim();

  // 1) Try to read remote version each app start (small request).
  const remoteVersion = await fetchRemoteVersion(sheetUrl);

  // If remote version is available, we can decide whether to refresh words.
  if (remoteVersion !== null) {
    // No changes → use cache
    if (hasCache && localVersion !== null && Number(localVersion) === Number(remoteVersion)) {
      return cachedWords;
    }

    // Version changed (or no local version / no cache) → try to download fresh words
    const csvUrl = normalizeToCsvUrl(sheetUrl);
    if (csvUrl && csvUrl.startsWith("http")) {
      try {
        const words = await loadWordsFromCsv(csvUrl);
        if (Array.isArray(words) && words.length) {
          saveCachedWords(words);
          saveCachedVersion(remoteVersion);
          return words;
        }
      } catch (e) {}
    }

    // If refresh failed but cache exists, keep working offline
    if (hasCache) return cachedWords;

    return Array.isArray(window.WORDS_FALLBACK) ? window.WORDS_FALLBACK : [];
  }

  // 2) If we cannot check version (offline / blocked), prefer cache.
  if (hasCache) return cachedWords;

  // 3) No cache → try to load words directly.
  const csvUrl = normalizeToCsvUrl(sheetUrl);
  if (csvUrl && csvUrl.startsWith("http")) {
    try {
      const words = await loadWordsFromCsv(csvUrl);
      if (Array.isArray(words) && words.length) {
        // Version unknown, but we can still cache words for fast next start
        saveCachedWords(words);
        return words;
      }
    } catch (e) {}
  }

  return Array.isArray(window.WORDS_FALLBACK) ? window.WORDS_FALLBACK : [];
}
async function loadWordsFromCsv(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("CSV load failed: " + res.status);
    const text = await res.text();
    return parseCsv(text);
  }

  // Expected headers: id, dict, section, set, word, trans, example
  // Backward compatible: folder -> section, dict defaults to "Словарь"
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') { cur += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cur += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { row.push(cur); cur = ""; }
        else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ""; }
        else if (ch === '\r') {}
        else cur += ch;
      }
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    if (!rows.length) return [];

    const headers = rows[0].map(h => (h || "").trim().toLowerCase());
    const idx = (name) => headers.findIndex(h => h === name);

    const idI = idx("id");
    const dictI = idx("dict");
    const sectionI = idx("section");
    const folderI = idx("folder");
    const setI = idx("set");
    const wordI = idx("word");
    const transI = idx("trans");
    const exI = idx("example");
    const posI = idx("pos");

    const dictOrderI = idx("dict_order");
    if (idI === -1 || setI === -1 || wordI === -1 || transI === -1) return [];

    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const cols = rows[r];
      if (!cols || cols.every(c => !String(c||"").trim())) continue;

      const dict = dictI !== -1 ? String(cols[dictI] || "").trim() : "Словарь";
      const section = sectionI !== -1 ? String(cols[sectionI] || "").trim()
                    : (folderI !== -1 ? String(cols[folderI] || "").trim() : "Раздел");

      const obj = {
        id: Number(cols[idI] || 0),
        dict: dict || "Словарь",
        section: section || "Раздел",
        set: Number(cols[setI] || 0),
        word: String(cols[wordI] || "").trim(),
        trans: String(cols[transI] || "").trim(),
        pos: posI !== -1 ? String(cols[posI] || "").trim() : "",
        example: exI !== -1 ? String(cols[exI] || "").trim() : "",
        dict_order: dictOrderI !== -1 ? Number(cols[dictOrderI] || 0) : 0,
      };
      if (!obj.id || !obj.set || !obj.word || !obj.trans) continue;
      out.push(obj);
    }
    return out;
  }

  // ---------- Helpers

  // ---------- RU title renderer (v8.6, stage 2)
  function renderRuTitle(el, text){
    const groups = splitGroups(text);
    if (!groups.length){
      el.textContent = "";
      return;
    }
    if (groups.length === 1){
      el.textContent = groups[0];
      return;
    }
    el.innerHTML = groups.map((g,i)=>`<div>${i+1}. ${escapeHtml(g)}</div>`).join("");
  }
  function showView(which) {
  [
    viewDicts,
    viewLearnMenu,
    viewSections,
viewSetMenu,
    viewGlobalTestMenu,
    viewMatchMenu,
    viewMatchGame,
    viewMatchResult,
    viewTest,
    viewStudy,
    viewDictContent,
    viewSessionAnalytics
  ].forEach(v => v && v.classList.add("hidden"));

  which.classList.remove("hidden");
}
  // --- Dictionary content visibility helper
  function hideDictContent(){
    if (viewDictContent) viewDictContent.classList.add("hidden");
  }


  
  // ---------- Global back navigation (single arrow in header) — v9.7 clean stack
  let currentView = viewDicts;
  const navStack = [];

  function isHomeView(v){ return v === viewDicts; }
  function isTestFlowView(v){ return v === viewGlobalTestMenu || v === viewTest; }

  function updateMeta(){
    if (!counter || !modeEl) return;

    const onStudy = (currentView === viewStudy);
    const onTest = (currentView === viewTest);

    // Counter only in study
    counter.style.display = onStudy ? "" : "none";

    // Mode: only in test (label "Тест"), never in study
    if (onTest){
      modeEl.style.display = "";
      modeEl.textContent = "Тест";
    } else {
      modeEl.style.display = "none";
      modeEl.textContent = "";
    }
  }

  function updateBackArrow(){
    if (!btnBackArrow) return;
    const shouldShow = !isHomeView(currentView) && navStack.length > 0;
    btnBackArrow.classList.toggle("hidden", !shouldShow);
  }

  function goView(nextView, opts = {}){
    hideDictContent();
    const { push = true, resetStack = false } = opts;
    if (resetStack) navStack.length = 0;
    if (push && currentView && currentView !== nextView) navStack.push(currentView);
    showView(nextView);
    currentView = nextView;
    updateBackArrow();
    updateMeta();
  }

  function navigateBack(){
    // v9.9: match game/result are временные, back всегда ведёт в меню игры
    if (currentView === viewMatchGame || currentView === viewMatchResult){
      goView(viewMatchMenu, { push:false });
      return;
    }
    const prev = navStack.pop();
    if (!prev) return;
    showView(prev);
    currentView = prev;
    updateBackArrow();
    updateMeta();
  }

  if (btnBackArrow) btnBackArrow.addEventListener("click", navigateBack);




  function uniq(arr) { return Array.from(new Set(arr)); }
  function sortNatural(a, b) { return String(a).localeCompare(String(b), "ru", { numeric: true, sensitivity: "base" }); }
  function escapeHtml(s) {
    return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  // ---------- Study renderers (v7.3)
  // ---------- RU->ALAN front renderer (v8.6)
  function renderRuAlanFront(el, item){
    // number of groups determined ONLY by Russian translation variants
    const groups = splitGroups(item.trans);
    const exRaw = String(item.example || "").trim();

    // parse examples into indexed groups
    let eGroups = [];
    if(exRaw){
      const parts = exRaw.replace(/\n+/g,";").split(/\s*[;；]\s*/g).map(s=>s.trim()).filter(Boolean);
      let cur = null;
      for(const p of parts){
        const m = p.match(/^\s*(\d+)\s*(?:[\.)]|[-–—])?\s*(.*)$/);
        if(m){
          if(cur) eGroups.push(cur);
          cur = { i: Number(m[1])-1, lines: m[2] ? [m[2]] : [] };
        }else{
          if(!cur) cur = { i: 0, lines: [p] };
          else cur.lines.push(p);
        }
      }
      if(cur) eGroups.push(cur);
    }

    if(!groups.length){
      el.textContent = escapeHtml(item.word);
      return;
    }

    el.innerHTML = `
      <div class="groups">
        ${groups.map((_,i)=>{
          const eg = eGroups.find(g=>g.i===i);
          return `
            <div class="groupRow">
              <span class="groupNum">${i+1}</span>
              <div class="groupPill">
                <div class="gTrans">${escapeHtml(item.word)}</div>
                ${eg ? eg.lines.map(l=>`<div class="gEx">${escapeHtml(l)}</div>`).join("") : ``}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  // ---------- Combined renderer: translation + examples (v8.6)
  function renderCombinedGroups(el, transText, exText){
    const tGroups = splitGroups(transText);
    const eRaw = String(exText||"").trim();

    // parse examples into indexed groups
    let eGroups = [];
    if(eRaw){
      const parts = eRaw.replace(/\n+/g,";").split(/\s*[;；]\s*/g).map(s=>s.trim()).filter(Boolean);
      let cur = null;
      for(const p of parts){
        const m = p.match(/^\s*(\d+)\s*(?:[\.)]|[-–—])?\s*(.*)$/);
        if(m){
          if(cur) eGroups.push(cur);
          cur = { i: Number(m[1])-1, lines: m[2] ? [m[2]] : [] };
        }else{
          if(!cur) cur = { i: 0, lines: [p] };
          else cur.lines.push(p);
        }
      }
      if(cur) eGroups.push(cur);
    }

    const max = Math.max(tGroups.length, eGroups.length);
    if(!max){ el.textContent=""; return; }

    el.innerHTML = `
      <div class="groups">
        ${Array.from({length:max}).map((_,i)=>{
          const t = tGroups[i];
          const eg = eGroups.find(g=>g.i===i);
          return `
            <div class="groupRow">
              <span class="groupNum">${i+1}</span>
              <div class="groupPill">
                ${t ? `<div class="gTrans">${escapeHtml(t)}</div>` : ``}
                ${eg ? eg.lines.map(l=>`<div class="gEx">${escapeHtml(l)}</div>`).join("") : ``}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }
// ---------- Study renderers (v7.3)
  // ---------- RU->ALAN front renderer (v8.6)
  ;
        }else{
          if(!cur) cur = { i: 0, lines: [p] };
          else cur.lines.push(p);
        }
      }
      if(cur) eGroups.push(cur);
    }

    if(!groups.length){
      el.textContent = escapeHtml(item.word);
      return;
    }

    el.innerHTML = `
      <div class="groups">
        ${groups.map((_,i)=>{
          const eg = eGroups.find(g=>g.i===i);
          return `
            <div class="groupRow">
              <span class="groupNum">${i+1}</span>
              <div class="groupPill">
                <div class="gTrans">${escapeHtml(item.word)}</div>
                ${eg ? eg.lines.map(l=>`<div class="gEx">${escapeHtml(l)}</div>`).join("") : ``}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  // Split text into groups by semicolon or newline
  function splitGroups(text){
    return String(text||"")
      .split(/\s*[;；]\s*|\n+/g)
      .map(s=>s.trim())
      .filter(Boolean)
      // strip leading numbering inside group text (e.g. "1. ...", "2) ...", "3 - ...")
      .map(s=>s.replace(/^\s*\d+\s*(?:[\.)]|[-–—])\s*/,"").trim());
  }

  // Render translation groups as pills (group-level)
  function renderTransGroups(el, text){
    const groups = splitGroups(text);
    if(!groups.length){ el.textContent = ""; return; }

    const showNums = groups.length > 1;
    el.innerHTML = `
      <div class="groups">
        ${groups.map((g,i)=>`
          <div class="groupRow">
            ${showNums ? `<span class="groupNum">${i+1}</span>` : ``}
            <div class="groupPill">${escapeHtml(g)}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  // Render example groups by numeric markers (1,2,3...)
  function renderExampleGroups(el, text){
    const raw = String(text||"").trim();
    if(!raw){ el.textContent = ""; return; }

    // Split into candidate example lines by semicolons or newlines.
    const parts = raw
      .replace(/\n+/g, ";")
      .split(/\s*[;；]\s*/g)
      .map(s=>s.trim())
      .filter(Boolean);

    let groups = [];
    let current = null;

    for(const part of parts){
      const mm = part.match(/^\s*(\d+)\s*(?:[\.)]|[-–—])?\s*(.*)$/);
      if(mm){
        if(current) groups.push(current);
        const rest = (mm[2]||"").trim();
        current = { num: mm[1], lines: rest ? [rest] : [] };
      }else{
        if(!current){
          current = { num: null, lines: [part] };
        }else{
          current.lines.push(part);
        }
      }
    }
    if(current) groups.push(current);

    const numbered = groups.length >= 1 && groups.every(g => g.num);

    el.innerHTML = `
      <div class="groups examples">
        ${groups.map(g=>`
          <div class="groupRow groupRowEx">
            ${numbered ? `<span class="groupNum groupNumEx">${escapeHtml(g.num)}</span>` : ``}
            <div class="groupExample">
              ${g.lines.map(l=>`<div class="exLine">${escapeHtml(l)}</div>`).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  // Split "a, b; c, d" into blocks and pills
  // Major separator: semicolon (;). Inside each block: comma (,). Also supports slash (/) as an optional separator.
  function parseMulti(text) {
    const raw = String(text || "").trim();
    if (!raw) return [];
    // Major blocks by semicolon or newline
    const blocks = raw
      .split(/\s*[;；]\s*|\n+/g)
      .map(s => s.trim())
      .filter(Boolean);

    const splitPills = (s) => {
      // First split by commas
      let parts = s.split(/\s*,\s*/g);

      // Then (optionally) split parts by slashes if it looks like alternatives
      const out = [];
      for (const p of parts) {
        const pp = String(p || "").trim();
        if (!pp) continue;
        // if there is a slash, split, but keep very short combos like "и/или" together
        if (pp.includes("/") && !/^[^\s]{1,4}\/[^\s]{1,4}$/.test(pp)) {
          const bySlash = pp.split(/\s*\/\s*/g).map(x => x.trim()).filter(Boolean);
          out.push(...bySlash);
        } else {
          out.push(pp);
        }
      }
      return out;
    };

    return blocks.map(b => splitPills(b)).filter(arr => arr.length);
  }

  function renderMultiHtml(text) {
    const groups = parseMulti(text);
    if (!groups.length) return "";
    // If only one group with one pill — render as simple text (keeps current look)
    if (groups.length === 1 && groups[0].length <= 1) return escapeHtml(groups[0][0] || "");
    return `
      <div class="multi">
        ${groups.map((pills, i) => `
          <div class="multiRow">
            <span class="multiNum">${i + 1}</span>
            <div class="multiPills">
              ${pills.map(p => `<span class="pill">${escapeHtml(p)}</span>`).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function setRichOrText(el, text) {
    const html = renderMultiHtml(text);
    if (html) el.innerHTML = html;
    else el.textContent = "";
  }
  function dictTitle(code) { return (window.DICT_TITLES || {})[code] || code; }
  function sectionTitle(code) { return (window.SECTION_TITLES || {})[code] || code; }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---------- Data helpers
  function dictsFrom(words) { return uniq(words.map(w => w.dict)).sort(sortNatural); }
  function sectionsFrom(words, dict) { return uniq(words.filter(w => w.dict === dict).map(w => w.section)).sort(sortNatural); }
  function setsFrom(words, dict, section) {
    return uniq(words.filter(w => w.dict === dict && w.section === section).map(w => Number(w.set))).sort((a,b)=>a-b);
  }
  function wordsForSet(words, dict, section, setNo) {
    return words.filter(w => w.dict === dict && w.section === section && Number(w.set) === Number(setNo));
  }

  // ---------- App state

  // ---------- Dictionary content (Содержание словаря)
  const viewDictContent = document.getElementById("viewDictContent");
  const btnOpenDictContent = document.getElementById("btnOpenDictContent");
  const dictSearchInput = document.getElementById("dictSearchInput");
  const dictContentList = document.getElementById("dictContentList");

  function renderDictContent(filter = "") {
    if (!dictContentList) return;
    dictContentList.innerHTML = "";
    if (!Array.isArray(DATA) || !currentDict) return;

    const q = String(filter||"").toLowerCase().trim();
    const words = DATA
      .filter(w =>
        w.dict === currentDict &&
        Number(w.dict_order) > 0 &&
        (!q ||
          String(w.word||"").toLowerCase().includes(q) ||
          String(w.trans||"").toLowerCase().includes(q))
      )
      .sort((a,b)=>Number(a.dict_order)-Number(b.dict_order));

    const bySection = {};
    for (const w of words) {
      const sec = (w.section || "Раздел").trim() || "Раздел";
      (bySection[sec] ||= []).push(w);
    }

    for (const [sec, items] of Object.entries(bySection)) {
      const header = document.createElement("div");
      header.className = "sectionHeader";
      header.textContent = "▸ " + sectionTitle(sec);

      const body = document.createElement("div");
      body.classList.add("hidden");

      header.addEventListener("click", () => {
        const closed = body.classList.toggle("hidden");
        header.textContent = (closed ? "▸ " : "▾ ") + sectionTitle(sec);
      });

      for (const w of items) {
        const row = document.createElement("div");
        row.className = "dictWordRow";
        row.innerHTML = `
          <div class="dictNum">${Number(w.dict_order)}.</div>
          <div>
            <div class="w">${escapeHtml(w.word)}</div>
            <div class="t">${escapeHtml(w.trans)}</div>
          </div>
          <button class="starBtn ${isFav(w.id) ? "on" : ""}" type="button">
            ${isFav(w.id) ? "★" : "☆"}
          </button>
        `;
        const star = row.querySelector(".starBtn");
        star.addEventListener("click", (e)=>{
          e.stopPropagation();
          const on = toggleFav(w.id);
          star.classList.toggle("on", on);
          star.textContent = on ? "★" : "☆";
        });
        body.appendChild(row);
      }

      dictContentList.appendChild(header);
      dictContentList.appendChild(body);
    }
  }

  if (btnOpenDictContent && viewDictContent) {
    btnOpenDictContent.addEventListener("click", () => {
      renderDictContent("");
      goView(viewDictContent);
      if (dictSearchInput) {
        dictSearchInput.value = "";
      }
    });
  }

  if (dictSearchInput) {
    dictSearchInput.addEventListener("input", () => {
      renderDictContent(dictSearchInput.value);
    });
  }

  let DATA = [];
  let favIds = loadFavSet();
  let currentDict = "";
  let currentSection = "";
  let currentSet = 1;

  // Study mode: kb => front word, ru => front trans
  let currentStudyMode = "kb";

  // Study queues
  let mainQueue = [];
  let repeatQueue = [];
  let round = "main";
  let totalPlanned = 0;
  let currentStudyId = 0;

  // v9.3: last swipe undo (single-step)
  let swipeHistory = [];
  let sessionFailMap = {};

  function setRoundIfNeeded() { if (round === "main" && mainQueue.length === 0) round = "repeat"; }
  function currentQueue() { return round === "main" ? mainQueue : repeatQueue; }

  // ---------- Render dicts / sections / sets
  function renderDicts() {
    const dicts = dictsFrom(DATA);
    dictsList.innerHTML = `<button class="btn" data-dict="__fav__">⭐ Избранное</button>` + dicts.map(d => `<button class="btn" data-dict="${escapeHtml(d)}">${escapeHtml(dictTitle(d))}</button>`).join("");
    dictsList.querySelectorAll("button[data-dict]").forEach(btn => {
      btn.addEventListener("click", () => {
        currentDict = btn.getAttribute("data-dict");
        if (currentDict === "__fav__") {
          currentDict = "__fav__"; currentSection = "Избранное"; currentSet = 1; openSetMenu();
          return;
        }
        renderSections(currentDict);
        goView(viewSections);
      });
    });
    
    goView(viewDicts, { push:false, resetStack:true });
  }

  function renderSections(dict) {
    sectionsTitle.textContent = (dict === "__fav__") ? "Избранное" : dictTitle(dict);

    const sections = (dict === "__fav__") ? ["Избранное"] : sectionsFrom(DATA, dict);

    sectionsList.innerHTML = sections.map(sec => {
      const sets = (dict === "__fav__") ? [1] : setsFrom(DATA, dict, sec);

      const tiles = sets.map(setNo => {
        const all = (dict === "__fav__")
          ? DATA.filter(w => favIds.has(w.id))
          : wordsForSet(DATA, dict, sec, setNo);

        const finished = isSetFinished(dict, sec, setNo);

        const title = (dict === "__fav__") ? "Избранное" : `Сет ${setNo}`;
        const count = all.length;

        return `
          <button class="setTile" type="button" data-section="${escapeHtml(sec)}" data-set="${setNo}">
            <div class="setDone" data-done="1" aria-label="Отметить как выучено"><svg viewBox="0 0 24 24" class="setCheck ${finished ? 'active' : ''}">
    <rect x="3" y="3" width="18" height="18" rx="4"
          fill="none"
          stroke="rgba(15,23,42,0.25)"
          stroke-width="1.7"/>
    <path d="M7 10.5 L11.5 16 L17 6.5"
          fill="none"
          stroke-width="2.8"
          stroke-linecap="round"
          stroke-linejoin="round"/>
  </svg></div>
            <div class="setTileTitle">${escapeHtml(title)}</div>
            <div class="setTileCount">${count} слов</div>
          </button>
        `;
      }).join("");

      return `
        <div class="secBlock">
          <div class="secTitle">${escapeHtml(sectionTitle(sec))}</div>
          <div class="setsGrid">${tiles}</div>
        </div>
      `;
    }).join("");

    // Click handlers: open set vs toggle done
    sectionsList.querySelectorAll(".setTile").forEach(tile => {
      const sec = tile.getAttribute("data-section");
      const setNo = Number(tile.getAttribute("data-set"));

      // Toggle ✅
      const doneEl = tile.querySelector("[data-done='1']");
      if (doneEl) {
        doneEl.addEventListener("click", (e) => {
          e.stopPropagation();
          const on = toggleSetFinished(dict, sec, setNo);
          const svg = doneEl.querySelector("svg");
if(svg){
  svg.classList.toggle("active", on);
}
        });
      }

      // Open set menu
      tile.addEventListener("click", () => {
        currentSection = sec;
        currentSet = setNo;
        openSetMenu();
      });
    });
  }

  btnBackToDicts.addEventListener("click", () => goView(viewDicts));
// ---------- Set menu / hiding words
  let menuHidden = new Set();

  function openSetMenu() {
    menuHidden = getHiddenSet(currentDict, currentSection, currentSet);

    const all = (currentDict === "__fav__") ? DATA.filter(w => favIds.has(w.id)) : wordsForSet(DATA, currentDict, currentSection, currentSet);
    const active = all.filter(w => !menuHidden.has(w.id));
    setMenuTitle.textContent = (currentDict === "__fav__") ? "⭐ Избранное" : `${dictTitle(currentDict)} • ${sectionTitle(currentSection)} • Сет ${currentSet}`;
    setMenuInfo.textContent = `Слов в сете: ${all.length} • В сессии: ${active.length}`;

    renderSetWordsList();
    goView(viewSetMenu);
  }

  function renderSetWordsList() {
    const all = (currentDict === "__fav__") ? DATA.filter(w => favIds.has(w.id)) : wordsForSet(DATA, currentDict, currentSection, currentSet);
    const filtered = all;

    setWordsList.innerHTML = filtered.map(w => {
      const checked = !menuHidden.has(w.id);
      return `
        <div class="item" data-id="${w.id}">
          <input class="checkbox" type="checkbox" ${checked ? "checked" : ""} />
          <div>
            <div class="w">${escapeHtml(w.word)}</div>
            <div class="t">${escapeHtml(w.trans)}</div>
          </div>
          <button class="starBtn ${isFav(w.id) ? "on" : ""}" type="button" aria-label="Избранное">${isFav(w.id) ? "★" : "☆"}</button>
        </div>
      `;
    }).join("");

    setWordsList.querySelectorAll(".item").forEach(row => {
      const id = Number(row.getAttribute("data-id"));
      const cb = row.querySelector("input[type=checkbox]");
      const star = row.querySelector(".starBtn");
      star.addEventListener("click", (e) => {
        e.stopPropagation();
        const on = toggleFav(id);
        star.classList.toggle("on", on);
        star.textContent = on ? "★" : "☆";

        // В Избранном: если убрали звёздочку — слово должно сразу исчезнуть из списка
        if (currentDict === "__fav__" && !on) {
          renderSetWordsList();
          const all2 = DATA.filter(w => favIds.has(w.id));
          const active2 = all2.filter(w => !menuHidden.has(w.id));
          setMenuInfo.textContent = `Слов в сете: ${all2.length} • В сессии: ${active2.length}`;
        }
      });
      cb.addEventListener("change", () => {
        if (cb.checked) menuHidden.delete(id);
        else menuHidden.add(id);
        setHiddenSet(currentDict, currentSection, currentSet, menuHidden);

        const all2 = (currentDict === "__fav__") ? DATA.filter(w => favIds.has(w.id)) : wordsForSet(DATA, currentDict, currentSection, currentSet);
        const active2 = all2.filter(w => !menuHidden.has(w.id));
        setMenuInfo.textContent = `Слов в сете: ${all2.length} • В сессии: ${active2.length}`;
      });
    });
  }

  btnSetShowAll.addEventListener("click", () => {
    menuHidden = new Set();
    setHiddenSet(currentDict, currentSection, currentSet, menuHidden);
    renderSetWordsList();
    const all = (currentDict === "__fav__") ? DATA.filter(w => favIds.has(w.id)) : wordsForSet(DATA, currentDict, currentSection, currentSet);
    setMenuInfo.textContent = `Слов в сете: ${all.length} • В сессии: ${all.length}`;
  });

  btnSetHideAll.addEventListener("click", () => {
    const all = (currentDict === "__fav__") ? DATA.filter(w => favIds.has(w.id)) : wordsForSet(DATA, currentDict, currentSection, currentSet);
    menuHidden = new Set(all.map(w => w.id));
    setHiddenSet(currentDict, currentSection, currentSet, menuHidden);
    renderSetWordsList();
    setMenuInfo.textContent = `Слов в сете: ${all.length} • В сессии: 0`;
  });

  btnModeKb.addEventListener("click", () => { currentStudyMode = "kb"; startStudySession(); });
  btnModeRu.addEventListener("click", () => { currentStudyMode = "ru"; startStudySession(); });

  // ---------- Study counter helper
  function updateStudyCounter(){
    if (!counter) return;
    const known = Math.max(0, totalPlanned - (mainQueue.length + repeatQueue.length));
    counter.textContent = `знаю ${known}/${totalPlanned} слов`;
  }


  // v9.3: UI helpers for study action buttons
  function updateFavActionUI(){
    if (!btnFavAction) return;
    const on = isFav(currentStudyId);
    btnFavAction.classList.toggle("active", on);
    if (favActionLabel) favActionLabel.textContent = on ? "В избранном" : "Пометить слово";
    btnFavAction.setAttribute("aria-label", on ? "Убрать из избранного" : "Пометить слово");
  }

  function updateUndoUI(){
    if (!btnUndo) return;
    const can = swipeHistory.length > 0;
    btnUndo.disabled = !can || isAnimating;
  }

  
  
  function undoLastSwipe(){
    if (!swipeHistory.length || isAnimating) return;

    const { item, known, fromRound } = swipeHistory.pop();

    if (!known) {
      if (sessionFailMap[item.id]) {
        sessionFailMap[item.id]--;
        if (sessionFailMap[item.id] <= 0) delete sessionFailMap[item.id];
      }
      for (let i = repeatQueue.length - 1; i >= 0; i--) {
        if (repeatQueue[i] && repeatQueue[i].id === item.id) {
          repeatQueue.splice(i, 1);
          break;
        }
      }
    }

    if (fromRound === "main") {
      mainQueue.unshift(item);
    } else {
      repeatQueue.unshift(item);
    }

    round = fromRound;

    renderStudyCard();
    updateStudyCounter();
    updateUndoUI();
  }

// ---------- Study session

  function startStudySession() {
    const all = (currentDict === "__fav__") ? DATA.filter(w => favIds.has(w.id)) : wordsForSet(DATA, currentDict, currentSection, currentSet);
    const hidden = getHiddenSet(currentDict, currentSection, currentSet);
    const active = all.filter(w => !hidden.has(w.id));

    mainQueue = shuffle(active.slice());
    repeatQueue = [];
    round = "main";
    totalPlanned = active.length;
    swipeHistory = [];
    sessionFailMap = {};
    updateStudyCounter();

    goView(viewStudy);
    renderStudyCard();
    updateStudyCounter();
  }

  
function resetFlipInstant() {
  const inner = card.querySelector(".cardInner");
  if (!inner) {
    card.classList.remove("flipped");
    return;
  }

  const prev = inner.style.transition;
  inner.style.transition = "none";
  card.classList.remove("flipped");
  void inner.offsetWidth;
  inner.style.transition = prev || "";
}

function renderStudyCard() {
    
  resetFlipInstant();
setRoundIfNeeded();
    const q = currentQueue();

    // reset front state

    if (totalPlanned === 0) {
      wordEl.textContent = "Пусто 🤷‍♂️";
      transEl.textContent = "В этом сете все слова скрыты. Верни их в меню сета.";
      if (btnFavAction) btnFavAction.classList.add("hidden");
      if (btnUndo) btnUndo.classList.add("hidden");
return;
    } else {
}

    if (q.length === 0) {
      openSessionAnalytics();
      return;
    }

    // original finish block disabled
    if(false){
      transEl.textContent = "Сессия завершена.";
      if (btnFavAction) btnFavAction.classList.add("hidden");
      if (btnUndo) btnUndo.classList.add("hidden");
return;
    }

    const item = q[0];
    currentStudyId = item.id;
    if (btnFavAction) btnFavAction.classList.remove("hidden");
    if (btnUndo) btnUndo.classList.remove("hidden");
    updateFavActionUI();
    updateUndoUI();
    const front = currentStudyMode === "kb" ? item.word : item.trans;
    const back = currentStudyMode === "kb" ? item.trans : item.word;

    // Front rendering (stage 2)
    if (currentStudyMode === "ru") {
      renderRuTitle(wordEl, item.trans);
    } else {
      wordEl.textContent = front;
    }
    // Back rendering depends on mode
    if(currentStudyMode === "ru"){
      // RU → ALAN: pills count from Russian variants
      renderRuAlanFront(transEl, item);
    }else{
      // ALAN → RU (default)
      renderCombinedGroups(transEl, back, item.example);
    }

    const done = totalPlanned - q.length - (round === "repeat" ? 0 : 0);
    
  }

  // Tap: flip (front/back)
  card.addEventListener("click", (e) => {
    if (e.target && e.target.closest && (e.target.closest("#btnUndo") || e.target.closest("#btnFavAction"))) return;
    card.classList.toggle("flipped");
  });
function swipeDecision(known) {
    
  resetFlipInstant();
setRoundIfNeeded();
    const q = currentQueue();
    if (!q.length) return;

    // close back & example

    const fromRound = round;
    const item = q.shift();
    if (!known) {
      sessionFailMap[item.id] = (sessionFailMap[item.id] || 0) + 1;
      repeatQueue.push(item);
    }

    const switchedToRepeat = (round === "main" && mainQueue.length === 0);
    // When main is empty, switch to repeat
    if (switchedToRepeat) round = "repeat";

    // store single-step undo info
    swipeHistory.push({ item, known, fromRound });

    renderStudyCard();
    updateStudyCounter();
    updateUndoUI();
  }

  btnYes.addEventListener("click", () => animateSwipe(1, true));
  btnNo.addEventListener("click", () => animateSwipe(-1, false));

  if (btnUndo) btnUndo.addEventListener("click", (e) => { e.stopPropagation(); undoLastSwipe(); });
  if (btnFavAction) btnFavAction.addEventListener("click", (e) => {
    e.stopPropagation();
    const on = toggleFav(currentStudyId);
    updateFavActionUI();
  });

  
  // ---------- Swipe animation (v8.9 stable)
  let isAnimating = false;

  function animateSwipe(dir, known){
    if(isAnimating) return;
    isAnimating = true;
    updateUndoUI();

    card.style.pointerEvents = "none";
    card.style.transition = "transform .5s ease, opacity .5s ease, box-shadow .5s ease";
    card.style.transform = `translateX(${dir*520}px) rotate(${dir*14}deg)`;
    card.style.opacity = "0";

    setTimeout(()=>{

      swipeDecision(known);
      card.style.boxShadow = "";
      
      requestAnimationFrame(() => {
        card.style.transition = "none";
        card.style.transform = "translateY(-70px)";
        card.style.opacity = "0";

        requestAnimationFrame(() => {
          card.style.transition = "transform .5s ease, opacity .5s ease";
          card.style.transform = "translateY(0)";
          card.style.opacity = "1";
        });
      });

      card.style.pointerEvents = "";
      isAnimating = false;
      updateUndoUI();

    }, 500);
  }

  // Swipe gestures (animated)
  let startX = 0, startY = 0, dragging = false;

  card.addEventListener("touchstart", (e) => {
    if (!e.touches?.[0] || isAnimating) return;
    dragging = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    card.style.transition = "none";
    card.style.boxShadow = "";
  }, { passive: true });

  card.addEventListener("touchmove", (e) => {
  if (!dragging || !e.touches?.[0] || isAnimating) return;

  const dx = e.touches[0].clientX - startX;
  const dy = e.touches[0].clientY - startY;
  if (Math.abs(dy) > Math.abs(dx)) return;

  // Quizlet-like threshold (30% of screen width)
  const threshold = card.offsetWidth * 0.3;
  const progress = Math.min(Math.abs(dx) / threshold, 1);

  const rotate = dx / 22;
  const opacity = 1 - Math.min(Math.abs(dx) / (threshold * 1.6), 0.6);

  card.style.transform = `translateX(${dx}px) rotate(${rotate}deg)`;
  card.style.opacity = String(opacity);

  // Edge glow feedback
  if (dx > 0) {
    // right edge green
    card.style.boxShadow = `0 10px 30px rgba(17,169,232,0.18), 28px 0 100px rgba(34,197,94,${1 * progress})`;
  } else if (dx < 0) {
    // left edge red
    card.style.boxShadow = `0 10px 30px rgba(17,169,232,0.18), -28px 0 100px rgba(239,68,68,${1 * progress})`;
  } else {
    card.style.boxShadow = "";
  }
}, { passive: true });

  card.addEventListener("touchend", (e) => {
  if (!dragging || isAnimating) return;
  dragging = false;

  const endX = (e.changedTouches?.[0]?.clientX ?? startX);
  const dx = endX - startX;

  // Quizlet-like threshold (30% of screen width)
  const threshold = card.offsetWidth * 0.3;

  card.style.transition = "transform .18s ease, opacity .18s ease, box-shadow .18s ease";

  if (dx > threshold) animateSwipe(1, true);
  else if (dx < -threshold) animateSwipe(-1, false);
  else {
    // snap back
    card.style.transform = "";
    card.style.opacity = "";
    card.style.boxShadow = "";
  }
});

  btnBackToSetMenu.addEventListener("click", () => {
  favIds = loadFavSet();
  openSetMenu();
});

  // ---------- Global test (only global, with dict filter)
  let testMode = "kb"; // kb: Q=word, A=trans; ru: Q=trans, A=word
  let testItems = [];
  let testIndex = 0;
  let testCorrect = 0;
  let testSelected = null;
  let testResults = [];
  let testOptionPool = [];
  function getSelectedTestLimit() {
    const el = document.querySelector('input[name="testLimit"]:checked');
    const n = el ? Number(el.value) : 50;
    return (n === 30 || n === 50 || n === 100) ? n : 50;
  }

  function scopeKey(dict, section) {
    return `${dict}||${section || ""}`;
  }

  function renderTestScopeList() {
    // Build dict -> sections map
    const dicts = dictsFrom(DATA);
    const html = dicts.map(d => {
      const sections = uniq(DATA.filter(w => w.dict === d).map(w => w.section || "")).sort(sortNatural);
      const sectionRows = sections.map(s => {
        const label = s ? sectionTitle(s) : "Без раздела";
        return `
          <label class="scopeSectionRow">
            <input class="scopeCheckbox scopeSection" type="checkbox" data-dict="${escapeHtml(d)}" data-section="${escapeHtml(s)}">
            <span>${escapeHtml(label)}</span>
          </label>
        `;
      }).join("");

      return `
        <div class="scopeBlock">
          <label class="scopeDictRow">
            <input class="scopeCheckbox scopeDict" type="checkbox" data-dict="${escapeHtml(d)}">
            <span>${escapeHtml(dictTitle(d))}</span>
          </label>
          ${sectionRows}
        </div>
      `;
    }).join("");

    testScopeList.innerHTML = html || "<div class='hintText'>Словари не найдены.</div>";

    // Wire behavior
    const dictCbs = [...testScopeList.querySelectorAll(".scopeDict")];
    const sectionCbs = [...testScopeList.querySelectorAll(".scopeSection")];

    function updateDictState(dict) {
      const secs = sectionCbs.filter(cb => cb.dataset.dict === dict);
      const checked = secs.filter(cb => cb.checked).length;
      const dictCb = dictCbs.find(cb => cb.dataset.dict === dict);
      if (!dictCb) return;
      dictCb.indeterminate = checked > 0 && checked < secs.length;
      dictCb.checked = secs.length > 0 && checked === secs.length;
    }

    dictCbs.forEach(dictCb => {
      dictCb.addEventListener("change", () => {
        const d = dictCb.dataset.dict;
        sectionCbs.filter(cb => cb.dataset.dict === d).forEach(cb => { cb.checked = dictCb.checked; });
        dictCb.indeterminate = false;
        updateGlobalTestInfo();
      });
    });

    sectionCbs.forEach(secCb => {
      secCb.addEventListener("change", () => {
        updateDictState(secCb.dataset.dict);
        updateGlobalTestInfo();
      });
    });

    // Default: all checked (so user can quickly uncheck)
    dictCbs.forEach(dcb => { dcb.checked = true; });
    sectionCbs.forEach(scb => { scb.checked = true; });
    dictCbs.forEach(dcb => { dcb.indeterminate = false; });

    updateGlobalTestInfo();
  }

  function getSelectedScopePool() {
    const sectionCbs = [...testScopeList.querySelectorAll(".scopeSection")];
    if (!sectionCbs.length) return DATA;

    const checked = sectionCbs.filter(cb => cb.checked);
    if (checked.length === 0) return [];

    const keys = new Set(checked.map(cb => scopeKey(cb.dataset.dict, cb.dataset.section)));
    return DATA.filter(w => keys.has(scopeKey(w.dict, w.section || "")));
  }

function openGlobalTestMenu() {
    // Scope list is always visible (no accordion)
    if (testScopeBody) testScopeBody.classList.remove("hidden");

    // Build list each time (DATA may change later)
    renderTestScopeList();

    // Update info when limit changes
    document.querySelectorAll('input[name="testLimit"]').forEach(r => (r.onchange = updateGlobalTestInfo));

    goView(viewGlobalTestMenu);
  }


function updateGlobalTestInfo() {
    const pool = getSelectedScopePool();
    const limit = getSelectedTestLimit();

    // Summary counts
    const sectionCbs = [...testScopeList.querySelectorAll(".scopeSection")];
    const checkedSecs = sectionCbs.filter(cb => cb.checked);
    const dictCount = new Set(checkedSecs.map(cb => cb.dataset.dict)).size;
    const secCount = checkedSecs.length;

    const scopeText = (checkedSecs.length === sectionCbs.length)
      ? "Все словари и разделы"
      : `Выбрано: словарей ${dictCount}, разделов ${secCount}`;

    globalTestInfo.textContent = `Источник: ${scopeText} • Слов: ${pool.length} • Тест: ${Math.min(limit, pool.length)} слов`;
  }

  btnGlobalTest.addEventListener("click", openGlobalTestMenu);
  btnGlobalModeKb.addEventListener("click", () => { testMode = "kb"; startTest(); });
  btnGlobalModeRu.addEventListener("click", () => { testMode = "ru"; startTest(); });

  // ---------- Match words (v9.9) — same source scope as test, but matching pairs
  let matchItems = [];
  let matchRemaining = [];
  let matchTotal = 0;
  let matchRoundIndex = 0;
  let matchFailMap = {};
  let matchSolved = new Set();
  let matchLocked = false;
  let matchSelectedIdx = null;
  let matchSelectedRef = null;

  function getSelectedMatchLimit() {
    const el = document.querySelector('input[name="matchLimit"]:checked');
    const n = el ? Number(el.value) : 50;
    return (n === 30 || n === 50 || n === 100) ? n : 50;
  }

  function renderMatchScopeList() {
    const dicts = dictsFrom(DATA);
    const html = dicts.map(d => {
      const sections = uniq(DATA.filter(w => w.dict === d).map(w => w.section || "")).sort(sortNatural);
      const sectionRows = sections.map(s => {
        const label = s ? sectionTitle(s) : "Без раздела";
        return `
          <label class="scopeSectionRow">
            <input class="scopeCheckbox matchScopeSection" type="checkbox" data-dict="${escapeHtml(d)}" data-section="${escapeHtml(s)}">
            <span>${escapeHtml(label)}</span>
          </label>
        `;
      }).join("");

      return `
        <div class="scopeBlock">
          <label class="scopeDictRow">
            <input class="scopeCheckbox matchScopeDict" type="checkbox" data-dict="${escapeHtml(d)}">
            <span>${escapeHtml(dictTitle(d))}</span>
          </label>
          ${sectionRows}
        </div>
      `;
    }).join("");

    matchScopeList.innerHTML = html || "<div class='hintText'>Словари не найдены.</div>";

    const dictCbs = [...matchScopeList.querySelectorAll(".matchScopeDict")];
    const sectionCbs = [...matchScopeList.querySelectorAll(".matchScopeSection")];

    function updateDictState(dict) {
      const secs = sectionCbs.filter(cb => cb.dataset.dict === dict);
      const checked = secs.filter(cb => cb.checked).length;
      const dictCb = dictCbs.find(cb => cb.dataset.dict === dict);
      if (!dictCb) return;
      dictCb.indeterminate = checked > 0 && checked < secs.length;
      dictCb.checked = secs.length > 0 && checked === secs.length;
    }

    dictCbs.forEach(dictCb => {
      dictCb.addEventListener("change", () => {
        const d = dictCb.dataset.dict;
        sectionCbs.filter(cb => cb.dataset.dict === d).forEach(cb => { cb.checked = dictCb.checked; });
        dictCb.indeterminate = false;
        updateMatchInfo();
      });
    });

    sectionCbs.forEach(secCb => {
      secCb.addEventListener("change", () => {
        updateDictState(secCb.dataset.dict);
        updateMatchInfo();
      });
    });

    // Default: all checked
    dictCbs.forEach(dcb => { dcb.checked = true; });
    sectionCbs.forEach(scb => { scb.checked = true; });
    dictCbs.forEach(dcb => { dcb.indeterminate = false; });

    updateMatchInfo();
  }

  function getSelectedMatchScopePool() {
    const sectionCbs = [...matchScopeList.querySelectorAll(".matchScopeSection")];
    if (!sectionCbs.length) return DATA;

    const checked = sectionCbs.filter(cb => cb.checked);
    if (checked.length === 0) return [];

    const keys = new Set(checked.map(cb => scopeKey(cb.dataset.dict, cb.dataset.section)));
    return DATA.filter(w => keys.has(scopeKey(w.dict, w.section || "")));
  }

  function updateMatchInfo() {
    const pool = getSelectedMatchScopePool();
    const limit = getSelectedMatchLimit();

    const sectionCbs = [...matchScopeList.querySelectorAll(".matchScopeSection")];
    const checkedSecs = sectionCbs.filter(cb => cb.checked);
    const dictCount = new Set(checkedSecs.map(cb => cb.dataset.dict)).size;
    const secCount = checkedSecs.length;

    const scopeText = (checkedSecs.length === sectionCbs.length)
      ? "Все словари и разделы"
      : `Выбрано: словарей ${dictCount}, разделов ${secCount}`;

    if (matchInfo) matchInfo.textContent = `Источник: ${scopeText} • Слов: ${pool.length} • Игра: ${Math.min(limit, pool.length)} слов`;
  }

  function openMatchMenu(){
    if (matchScopeBody) matchScopeBody.classList.remove("hidden");
    renderMatchScopeList();
    document.querySelectorAll('input[name="matchLimit"]').forEach(r => (r.onchange = updateMatchInfo));
    goView(viewMatchMenu);
  }

  function randomFrom(arr){
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function startMatchGame(){
    const pool = getSelectedMatchScopePool();

    if (!pool.length){
      alert("Выберите хотя бы один словарь или раздел");
      return;
    }
    const limit = getSelectedMatchLimit();

    matchItems = shuffle(pool.slice());
    if (matchItems.length > limit) matchItems = matchItems.slice(0, limit);

    matchRemaining = matchItems.slice();
    matchTotal = matchItems.length;
    matchRoundIndex = 0;
    matchFailMap = {};
    matchSolved = new Set();
    matchLocked = false;
    matchSelectedIdx = null;
    matchSelectedRef = null;

    goView(viewMatchGame, { push:false });
    nextMatchRound();
  }

  function setMatchProgressText(extra=""){
    if (!matchProgress) return;
    const done = matchTotal - matchRemaining.length;
    const base = `Пройдено: ${done}/${matchTotal} слов`;
    matchProgress.textContent = extra ? `${base} • ${extra}` : base;
  }

  function nextMatchRound(){
    if (!matchColLeft || !matchColRight) return;

    if (matchRemaining.length === 0){
      openMatchResult();
      return;
    }

    // Pick random POS for this round from remaining
    const availablePOS = uniq(matchRemaining.map(w => (w.pos || "").trim() || "unknown"));
    const roundPOS = randomFrom(availablePOS);

    let candidates = matchRemaining.filter(w => ((w.pos || "").trim() || "unknown") === roundPOS);
    candidates = shuffle(candidates.slice());

    const roundWords = candidates.slice(0, 5);

    // Remove selected from remaining
    const roundIds = new Set(roundWords.map(w => w.id));
    matchRemaining = matchRemaining.filter(w => !roundIds.has(w.id));

    matchRoundIndex++;

    // Pair counter per round (starts at 0, grows only on correct match)
    const roundPairsTotal = roundWords.length;
    let roundPairsMatched = 0;

    if (matchProgress) matchProgress.textContent = `0 из ${roundPairsTotal} пар`;

    // Build columns: left = words, right = translations
    const leftCards = shuffle(roundWords.map(w => ({ kind:"w", id:w.id, text:w.word })));
    const rightCards = shuffle(roundWords.map(w => ({ kind:"t", id:w.id, text:w.trans })));

    // Reset selection
    matchLocked = false;
    matchSelectedIdx = null;
    matchSelectedRef = null;

    matchColLeft.innerHTML = leftCards.map((c) => `
      <button class="matchCard" type="button" data-kind="${c.kind}" data-id="${c.id}">
        ${escapeHtml(c.text)}
      </button>
    `).join("");

    matchColRight.innerHTML = rightCards.map((c) => `
      <button class="matchCard" type="button" data-kind="${c.kind}" data-id="${c.id}">
        ${escapeHtml(c.text)}
      </button>
    `).join("");

    const btns = Array.from(document.querySelectorAll("#matchColLeft .matchCard, #matchColRight .matchCard"));

    function clearSelection(){
      btns.forEach(b => b.classList.remove("selected","wrong"));
      matchSelectedIdx = null;
      matchSelectedRef = null;
    }

    function markSolved(id){
      matchSolved.add(Number(id));
    }

    function bumpFail(id){
      const nid = Number(id);
      if (!nid) return;
      if (matchSolved.has(nid)) return;
      matchFailMap[nid] = (matchFailMap[nid] || 0) + 1;
    }

    function allMatched(){
      return btns.length > 0 && btns.every(b => b.classList.contains("matched"));
    }

    function updatePairCounter(){
      if (!matchProgress) return;
      matchProgress.textContent = `${roundPairsMatched} из ${roundPairsTotal} пар`;
    }

    btns.forEach(btn => {
      btn.addEventListener("click", () => {
        if (matchLocked) return;
        if (btn.classList.contains("matched")) return;

        const id = Number(btn.dataset.id);
        const kind = btn.dataset.kind;

        // Toggle off if same selected element
        if (matchSelectedIdx && matchSelectedIdx.el === btn){
          btn.classList.remove("selected");
          matchSelectedIdx = null;
          matchSelectedRef = null;
          return;
        }

        // First pick
        if (!matchSelectedIdx){
          clearSelection();
          btn.classList.add("selected");
          matchSelectedIdx = { el: btn };
          matchSelectedRef = { id, kind };
          return;
        }

        const firstBtn = matchSelectedIdx.el;
        const first = matchSelectedRef;
        const second = { id, kind };

        // If same kind — just switch selection
        if (first && second && first.kind === second.kind){
          clearSelection();
          btn.classList.add("selected");
          matchSelectedIdx = { el: btn };
          matchSelectedRef = second;
          return;
        }

        const isCorrect = first && (first.id === second.id) && (first.kind !== second.kind);

        if (isCorrect){
          firstBtn.classList.remove("selected");
          btn.classList.remove("selected");
          firstBtn.classList.add("matched");
          btn.classList.add("matched");
          markSolved(first.id);

          roundPairsMatched++;
          updatePairCounter();

          matchSelectedIdx = null;
          matchSelectedRef = null;

          if (allMatched()){
            matchLocked = true;
            setTimeout(() => {
              matchLocked = false;
              nextMatchRound();
            }, 350);
          }
        } else {
          bumpFail(first.id);
          bumpFail(second.id);

          matchLocked = true;
          firstBtn.classList.add("wrong");
          btn.classList.add("wrong");
          setTimeout(() => {
            matchLocked = false;
            clearSelection();
          }, 600);
        }
      });
    });
  }

  function openMatchResult(){
    if (!matchResultList) return;

    const problemWords = Object.entries(matchFailMap)
      .filter(([id, count]) => count > 0)
      .map(([id, count]) => {
        const word = DATA.find(w => w.id === Number(id));
        return { ...word, fails: count };
      })
      .filter(w => w && w.id)
      .sort((a,b) => b.fails - a.fails);

    if (!problemWords.length){
      matchResultList.innerHTML = `
        <div class="smallNote" style="text-align:center;">
          <div style="font-weight:900; margin-bottom:6px;">Аперим!</div>
          <div>Все пары собраны с первого раза ✅</div>
        </div>
      `;
    } else {
      matchResultList.innerHTML = problemWords.map(w => `
        <div class="dictWordRow">
          <div class="dictNum" style="color:#ef4444;font-weight:900;">
            ❌ ${w.fails}
          </div>
          <div>
            <div class="w">${escapeHtml(w.word)}</div>
            <div class="t">${escapeHtml(w.trans)}</div>
          </div>
          <button class="starBtn ${isFav(w.id) ? "on" : ""}" type="button">
            ${isFav(w.id) ? "★" : "☆"}
          </button>
        </div>
      `).join("");

      matchResultList.querySelectorAll(".starBtn").forEach((btn, i) => {
        const word = problemWords[i];
        btn.addEventListener("click", () => {
          const on = toggleFav(word.id);
          btn.classList.toggle("on", on);
          btn.textContent = on ? "★" : "☆";
        });
      });
    }

    goView(viewMatchResult, { push:false });
  }

  if (btnMatchWords) btnMatchWords.addEventListener("click", openMatchMenu);
  if (btnMatchStart) btnMatchStart.addEventListener("click", startMatchGame);

  function startTest() {
    const pool = getSelectedScopePool();
    const testLimit = getSelectedTestLimit();

    // full scope pool for answer options
    testOptionPool = pool.slice();

    testItems = shuffle(pool.slice()); // include hidden always
    if (testItems.length > testLimit) testItems = testItems.slice(0, testLimit);

    testIndex = 0;
    testCorrect = 0;
    testSelected = null;
    testResults = [];

    btnTestNext.classList.remove("hidden");
    btnTestNext.textContent = "Дальше";
    btnTestNext.disabled = true;

    goView(viewTest);
    renderTestQuestion();
  }

  function pickOptions(correctItem) {
    const correct = testMode === "kb" ? correctItem.trans : correctItem.word;
    const targetPOS = (correctItem.pos || "").trim();

    let pool = testOptionPool.filter(w =>
      w.id !== correctItem.id &&
      (!targetPOS || (w.pos && String(w.pos).trim() === targetPOS))
    );

    if (pool.length < 3) {
      pool = testOptionPool.filter(w => w.id !== correctItem.id);
    }

    const opts = [correct];
    let guard = 0;
    while (opts.length < 4 && guard < 2000) {
      guard++;
      const cand = pool[Math.floor(Math.random() * pool.length)];
      if (!cand) break;
      const text = testMode === "kb" ? cand.trans : cand.word;
      if (!text) continue;
      if (opts.includes(text)) continue;
      opts.push(text);
    }
    return shuffle(opts);
  }

  function renderTestQuestion() {
    if (testItems.length === 0) {
      testTitle.textContent = "Тест";
      testProgress.textContent = "Нет слов для теста.";
      testQuestion.textContent = "Пусто 🤷‍♂️";
      testOptions.innerHTML = "";
      btnTestNext.classList.add("hidden");
      return;
    }

    if (testIndex >= testItems.length) {
      renderTestResults();
      return;
    }

    const item = testItems[testIndex];
    const question = testMode === "kb" ? item.word : item.trans;
    const correctAnswer = testMode === "kb" ? item.trans : item.word;

    testSelected = null;
    btnTestNext.classList.remove("hidden");
    btnTestNext.textContent = "Дальше";
    btnTestNext.disabled = true;

    testTitle.textContent = "Тест: выбрать перевод";
    testProgress.textContent = `Вопрос ${testIndex + 1} из ${testItems.length}`;
    testQuestion.textContent = question;

    const options = pickOptions(item);
    testOptions.innerHTML = options.map(opt => `
      <button class="optionBtn" data-opt="${escapeHtml(opt)}">${escapeHtml(opt)}</button>
    `).join("");

    const buttons = Array.from(testOptions.querySelectorAll("button.optionBtn"));
    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        testSelected = btn.getAttribute("data-opt");
        buttons.forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        btnTestNext.disabled = !testSelected;
      });
    });

    // Store current correct answer on the container for "Дальше"
    testOptions.setAttribute("data-correct", correctAnswer);
    testOptions.setAttribute("data-itemid", String(item.id));
  }

  function renderTestResults() {
    const pct = Math.round((testCorrect / Math.max(1, testItems.length)) * 100);

    testTitle.textContent = "Результаты теста";
    testProgress.textContent = `Правильно: ${testCorrect}/${testItems.length} (${pct}%)`;
    testQuestion.textContent = "";

    const rows = testResults.map(r => `
      <div class="resultItem" data-id="${r.id}">
        <div class="resultMark ${r.isCorrect ? "ok" : "bad"}">${r.isCorrect ? "✓" : "✕"}</div>
        <div class="resultBody">
          <div class="resultWord">${escapeHtml(r.word)}</div>
          <div class="resultLine"><span class="lbl">Правильно:</span> ${escapeHtml(r.correctAnswer)}</div>
          <div class="resultLine"><span class="lbl">Твой ответ:</span> ${escapeHtml(r.userAnswer || "—")}</div>
        </div>
        <button class="starBtn ${isFav(r.id) ? "on" : ""}" type="button" aria-label="Избранное">${isFav(r.id) ? "★" : "☆"}</button>
      </div>
    `).join("");

    testOptions.innerHTML = `
      <div class="resultList">
        ${rows || "<div class='hintText'>Нет результатов.</div>"}
      </div>
      <div class="row">
        <button class="btn primary" id="btnTestAgain2">Пройти ещё раз</button>
      </div>
    `;

    // Wire favorites
    testOptions.querySelectorAll(".resultItem").forEach(row => {
      const id = Number(row.getAttribute("data-id"));
      const star = row.querySelector(".starBtn");
      star.addEventListener("click", () => {
        const on = toggleFav(id);
        star.classList.toggle("on", on);
        star.textContent = on ? "★" : "☆";
      });
    });

    const again = document.getElementById("btnTestAgain2");
    if (again) again.addEventListener("click", startTest);

    btnTestNext.classList.add("hidden");
  }

  btnTestNext.addEventListener("click", () => {
    if (testIndex >= testItems.length) return;
    if (!testSelected) return;

    const item = testItems[testIndex];
    const correctAnswer = testMode === "kb" ? item.trans : item.word;
    const isCorrect = testSelected === correctAnswer;

    if (isCorrect) testCorrect++;

    testResults.push({
      id: item.id,
      word: item.word,
      trans: item.trans,
      correctAnswer,
      userAnswer: testSelected,
      isCorrect,
    });

    testIndex++;
    renderTestQuestion();
  });




  function openSessionAnalytics() {
    const viewSessionAnalytics = document.getElementById("viewSessionAnalytics");
    const analyticsList = document.getElementById("analyticsList");

    const problemWords = Object.entries(sessionFailMap)
      .filter(([id, count]) => count > 0)
      .map(([id, count]) => {
        const word = DATA.find(w => w.id === Number(id));
        return { ...word, fails: count };
      })
      .sort((a,b) => b.fails - a.fails);

    if (!problemWords.length) {
      analyticsList.innerHTML = `
        <div class="smallNote" style="text-align:center;">
          <div style="font-weight:900; margin-bottom:6px;">Аперим!</div>
          <div>Не было незнакомых слов ✅</div>
        </div>
      `;
    } else {
      analyticsList.innerHTML = problemWords.map(w => `
        <div class="dictWordRow">
          <div class="dictNum" style="color:#ef4444;font-weight:900;">
            ❌ ${w.fails}
          </div>
          <div>
            <div class="w">${escapeHtml(w.word)}</div>
            <div class="t">${escapeHtml(w.trans)}</div>
          </div>
          <button class="starBtn ${isFav(w.id) ? "on" : ""}" type="button">
            ${isFav(w.id) ? "★" : "☆"}
          </button>
        </div>
      `).join("");

      analyticsList.querySelectorAll(".starBtn").forEach((btn, i) => {
        const word = problemWords[i];
        btn.addEventListener("click", () => {
          const on = toggleFav(word.id);
          btn.classList.toggle("on", on);
          btn.textContent = on ? "★" : "☆";
        });
      });
    }

    goView(viewSessionAnalytics, { push:false });
  }

  // ---------- Init
  (async () => {
    DATA = await loadWords();

    if (!Array.isArray(DATA) || !DATA.length) {
      dictsList.innerHTML = "<div class='smallNote'>Нет данных. Проверь таблицу и заголовки: id, dict, section, set, word, trans, example</div>";
      goView(viewDicts);
      return;
    }

    // normalize
    DATA = DATA.map(w => ({
      ...w,
      dict: (w.dict || "Словарь").trim() || "Словарь",
      section: (w.section || "Раздел").trim() || "Раздел",
    }));

    renderDicts();

  const btnOpenLearnMenu = document.getElementById("btnOpenLearnMenu");
  if(btnOpenLearnMenu){
    btnOpenLearnMenu.addEventListener("click", () => {
      goView(viewLearnMenu);
    });
  }
  })();
})();
