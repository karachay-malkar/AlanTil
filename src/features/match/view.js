import { isWordEnabledInTestModes, shuffle } from "../../shared/domain/word-selection.js?v=13.8.1";
import { normalizeId } from "../../shared/domain/word-normalizer.js?v=13.8.1";
import { buildSelectedSources } from "../../shared/progress/session-builders.js?v=13.8.1";
import { wordFavorites } from "../../shared/state/word-favorites.js?v=13.8.1";
import { STATUS_BAD_ICON_SVG } from "../../shared/ui/icons.js?v=13.8.1";
import { renderContentListRow } from "../../shared/ui/list.js?v=13.8.1";
import { escapeHtml, renderStarButton } from "../../shared/ui/word-renderers.js?v=13.8.1";
import { completeMatch, markSolved, nextRound, recordMismatch, startMatch } from "./engine.js?v=13.8.1";
import { matchState } from "./state.js?v=13.8.1";

function dictionaryId(word) { return String(word.dictionary_id || word.catalog_id || word.dict || "").trim(); }
function dictionaryName(word) { return String(word.dictionary_name || word.dict || dictionaryId(word) || "Словарь").trim(); }
function sectionId(word) { return String(word.section_id || word.group_id || word.section || "").trim(); }
function sectionName(word) { return String(word.section_name || word.section || sectionId(word) || "Без раздела").trim(); }
function scopeKey(dict, section) { return `${dict}||${section || ""}`; }

function buildScope(words) {
  const map = new Map();
  words.forEach((word) => {
    const d = dictionaryId(word); const s = sectionId(word);
    if (!map.has(d)) map.set(d, { id: d, name: dictionaryName(word), count: 0, sections: new Map() });
    const dict = map.get(d); dict.count += 1;
    if (!dict.sections.has(s)) dict.sections.set(s, { id: s, name: sectionName(word), count: 0 });
    dict.sections.get(s).count += 1;
  });
  return Array.from(map.values()).map((dict) => ({ ...dict, sections: Array.from(dict.sections.values()) }));
}

export function renderMatchMenu(context, words, signal) {
  const available = words.filter(isWordEnabledInTestModes);
  const scopeHtml = buildScope(available).map((dictionary) => `<div class="scopeBlock">
    <label class="scopeDictRow"><input class="scopeCheckbox matchScopeDict" type="checkbox" data-dict="${escapeHtml(dictionary.id)}" checked /><span class="scopeLabel"><strong>${escapeHtml(dictionary.name)}</strong><small>${dictionary.count}</small></span></label>
    ${dictionary.sections.map((section) => {
      const checked = matchState.selectedScopeKeys.size === 0 || matchState.selectedScopeKeys.has(scopeKey(dictionary.id, section.id));
      return `<label class="scopeSectionRow"><input class="scopeCheckbox matchScopeSection" type="checkbox" data-dict="${escapeHtml(dictionary.id)}" data-section="${escapeHtml(section.id)}" ${checked ? "checked" : ""} /><span class="scopeLabel"><span>${escapeHtml(section.name)}</span><small>${section.count}</small></span></label>`;
    }).join("")}
  </div>`).join("");

  context.root.innerHTML = `<section class="view screen modeView matchMenuView">
    <div class="modeScroll">
      <div class="modeLead"><span id="matchInfo">—</span><small>Выберите словари и разделы</small></div>
      <div id="matchScopeList" class="testScopeList">${scopeHtml || `<div class="hintText">Словари не найдены.</div>`}</div>
      <section class="modeOptionSection"><div class="modeOptionLabel">Количество слов</div><div class="segmentControl testLimitRadios">${[20, 40, 80].map((limit) => `<label class="segmentOption radioOpt"><input type="radio" name="matchLimit" value="${limit}" ${matchState.limit === limit ? "checked" : ""} /><span>${limit}</span></label>`).join("")}</div></section>
    </div>
    <footer class="modeLaunchBar"><button id="btnMatchStart" class="btn actionPrimary" type="button">Начать игру</button></footer>
  </section>`;

  const list = context.root.querySelector("#matchScopeList"); const info = context.root.querySelector("#matchInfo");
  const parents = Array.from(list.querySelectorAll(".matchScopeDict")); const children = Array.from(list.querySelectorAll(".matchScopeSection"));
  function syncParents() { parents.forEach((parent) => { const rows = children.filter((child) => child.dataset.dict === parent.dataset.dict); const checked = rows.filter((child) => child.checked).length; parent.checked = rows.length > 0 && checked === rows.length; parent.indeterminate = checked > 0 && checked < rows.length; }); }
  function selectedPool() { const keys = new Set(children.filter((child) => child.checked).map((child) => scopeKey(child.dataset.dict, child.dataset.section))); return available.filter((word) => keys.has(scopeKey(dictionaryId(word), sectionId(word)))); }
  function selectedLimit() { return Number(context.root.querySelector('input[name="matchLimit"]:checked')?.value || 40); }
  function updateInfo() { const pool = selectedPool(); info.textContent = `Выбрано ${pool.length} · игра ${Math.min(selectedLimit(), pool.length)}`; }
  syncParents(); updateInfo();
  parents.forEach((parent) => parent.addEventListener("change", () => { children.filter((child) => child.dataset.dict === parent.dataset.dict).forEach((child) => { child.checked = parent.checked; }); parent.indeterminate = false; updateInfo(); }, { signal }));
  children.forEach((child) => child.addEventListener("change", () => { syncParents(); updateInfo(); }, { signal }));
  context.root.querySelectorAll('input[name="matchLimit"]').forEach((radio) => radio.addEventListener("change", updateInfo, { signal }));
  context.root.querySelector("#btnMatchStart").addEventListener("click", async () => {
    const pool = selectedPool(); if (!pool.length) { context.telegram?.showAlert?.("Нет слов для выбранного режима.") || window.alert("Нет слов для выбранного режима."); return; }
    matchState.limit = selectedLimit(); const selected = children.filter((child) => child.checked);
    matchState.selectedScopeKeys = new Set(selected.map((child) => scopeKey(child.dataset.dict, child.dataset.section)));
    startMatch(pool, matchState.limit, { dictionaryCount: new Set(selected.map((child) => child.dataset.dict)).size, sectionCount: selected.length, selectedSources: buildSelectedSources(selected.map((child) => ({ dictionaryId: child.dataset.dict, sectionId: child.dataset.section }))) });
    await context.router.navigate("match.game", {}, { force: true });
  }, { signal });
}

export function renderMatchGame(context, words, signal) {
  context.root.innerHTML = `<section class="view screen modeSessionView matchGameView">
    <div class="matchColumns"><div id="matchColLeft" class="matchCol"></div><div id="matchColRight" class="matchCol"></div></div>
  </section>`;
  context.shell.setCounter(`${matchState.solvedCount}/${matchState.total}`);
  const left = context.root.querySelector("#matchColLeft"); const right = context.root.querySelector("#matchColRight");
  function finish() { completeMatch(); context.router.replace("match.results", {}, { force: true }); }
  function drawRound() {
    const roundWords = nextRound(); if (!roundWords.length) { finish(); return; }
    const leftCards = shuffle(roundWords.map((word) => ({ kind: "w", id: word.id, text: word.word }))); const rightCards = shuffle(roundWords.map((word) => ({ kind: "t", id: word.id, text: word.trans })));
    matchState.locked = false; matchState.selected = null;
    left.innerHTML = leftCards.map((card) => `<button class="choiceControl matchCard" type="button" data-kind="${card.kind}" data-id="${escapeHtml(card.id)}">${escapeHtml(card.text)}</button>`).join("");
    right.innerHTML = rightCards.map((card) => `<button class="choiceControl matchCard" type="button" data-kind="${card.kind}" data-id="${escapeHtml(card.id)}">${escapeHtml(card.text)}</button>`).join("");
    const buttons = Array.from(context.root.querySelectorAll(".matchCard"));
    function clearSelection() { buttons.forEach((button) => button.classList.remove("selected", "wrong")); matchState.selected = null; }
    function allMatched() { return buttons.length > 0 && buttons.every((button) => button.classList.contains("matched")); }
    buttons.forEach((button) => button.addEventListener("click", () => {
      if (matchState.locked || button.classList.contains("matched")) return;
      const choice = { element: button, id: normalizeId(button.dataset.id), kind: button.dataset.kind };
      if (matchState.selected?.element === button) { button.classList.remove("selected"); matchState.selected = null; return; }
      if (!matchState.selected) { clearSelection(); button.classList.add("selected"); matchState.selected = choice; return; }
      const first = matchState.selected;
      if (first.kind === choice.kind) { clearSelection(); button.classList.add("selected"); matchState.selected = choice; return; }
      if (first.id === choice.id) {
        first.element.classList.remove("selected"); button.classList.remove("selected"); first.element.classList.add("matched"); button.classList.add("matched"); markSolved(first.id); context.shell.setCounter(`${matchState.solvedCount}/${matchState.total}`); matchState.selected = null;
        if (allMatched()) { matchState.locked = true; window.setTimeout(() => { matchState.locked = false; drawRound(); }, 350); }
      } else { recordMismatch(first.id, choice.id); matchState.locked = true; first.element.classList.add("wrong"); button.classList.add("wrong"); window.setTimeout(() => { matchState.locked = false; clearSelection(); }, 600); }
    }, { signal }));
  }
  drawRound();
}

export function renderMatchResult(context, words, signal) {
  const problemWords = Object.entries(matchState.failMap).filter(([, count]) => count > 0).map(([id, count]) => ({ ...words.find((word) => word.id === id), fails: count })).filter((word) => word.id).sort((a, b) => b.fails - a.fails);
  const content = problemWords.length ? problemWords.map((word) => renderContentListRow({ id: word.id, leadingHtml: `<span class="contentListStatus bad analyticsFailMark" aria-label="Ошибок: ${word.fails}">${STATUS_BAD_ICON_SVG}<span class="analyticsFailCount">${word.fails}</span></span>`, primary: word.word, secondary: word.trans, trailingHtml: renderStarButton(word.id, `data-word-id="${escapeHtml(word.id)}"`) })).join("") : `<div class="smallNote noteCenter"><div class="noteTitle">Аперим!</div><div class="successNoteLine">Все пары собраны с первого раза</div></div>`;
  context.root.innerHTML = `<section class="view screen modeView matchResultsView"><div id="matchResultList" class="contentList modeResultList">${content}</div></section>`;
  context.root.querySelectorAll(".starBtn[data-word-id]").forEach((button) => button.addEventListener("click", () => button.classList.toggle("on", wordFavorites.toggle(button.dataset.wordId)), { signal }));
}
