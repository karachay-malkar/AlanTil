import { DICT_TITLES, SECTION_TITLES } from "../../config/words.js";
import { dictsFrom, isWordEnabledInTestModes, shuffle, sortNatural, uniq } from "../../shared/domain/word-selection.js";
import { normalizeId } from "../../shared/domain/word-normalizer.js";
import { buildSelectedSources } from "../../shared/progress/session-builders.js";
import { wordFavorites } from "../../shared/state/word-favorites.js";
import { STATUS_BAD_ICON_SVG } from "../../shared/ui/icons.js";
import { renderContentListRow } from "../../shared/ui/list.js";
import { panel } from "../../shared/ui/panel.js";
import { escapeHtml, renderStarButton } from "../../shared/ui/word-renderers.js";
import { completeMatch, markSolved, nextRound, recordMismatch, startMatch } from "./engine.js";
import { matchState } from "./state.js";

function dictTitle(code) {
  return DICT_TITLES[code] || code;
}

function sectionTitle(code) {
  return SECTION_TITLES[code] || code;
}

function scopeKey(dict, section) {
  return `${dict}||${section || ""}`;
}

export function renderMatchMenu(context, words, signal) {
  const available = words.filter(isWordEnabledInTestModes);
  const dictionaries = dictsFrom(available);
  const scopeHtml = dictionaries.map((dict) => {
    const sections = uniq(available.filter((word) => word.dict === dict).map((word) => word.section || "")).sort(sortNatural);
    return `
      <div class="scopeBlock">
        <label class="scopeDictRow"><input class="scopeCheckbox matchScopeDict" type="checkbox" data-dict="${escapeHtml(dict)}" checked /><span>${escapeHtml(dictTitle(dict))}</span></label>
        ${sections.map((section) => {
          const checked = matchState.selectedScopeKeys.size === 0 || matchState.selectedScopeKeys.has(scopeKey(dict, section));
          return `<label class="scopeSectionRow"><input class="scopeCheckbox matchScopeSection" type="checkbox" data-dict="${escapeHtml(dict)}" data-section="${escapeHtml(section)}" ${checked ? "checked" : ""} /><span>${escapeHtml(section ? sectionTitle(section) : "Без раздела")}</span></label>`;
        }).join("")}
      </div>`;
  }).join("");

  context.root.innerHTML = panel({
    title: "🔗 Сопоставь слова",
    body: `
      <div class="hintText" id="matchInfo">—</div>
      <div class="testScopeTitle">Словари и разделы</div>
      <div id="matchScopeBody" class="testScope"><div id="matchScopeList" class="testScopeList">${scopeHtml || "<div class='hintText'>Словари не найдены.</div>"}</div></div>
      <div class="testLimitRow"><div class="testLimitTitle">Количество слов</div><div class="testLimitRadios">
        ${[20, 40, 80].map((limit) => `<label class="radioOpt"><input type="radio" name="matchLimit" value="${limit}" ${matchState.limit === limit ? "checked" : ""} /><span>${limit}</span></label>`).join("")}
      </div></div>
      <div class="row"><button id="btnMatchStart" class="btn primary" type="button">Начать игру</button></div>`,
  });

  const list = context.root.querySelector("#matchScopeList");
  const info = context.root.querySelector("#matchInfo");
  const dictCheckboxes = Array.from(list.querySelectorAll(".matchScopeDict"));
  const sectionCheckboxes = Array.from(list.querySelectorAll(".matchScopeSection"));
  dictCheckboxes.forEach((checkbox) => {
    const children = sectionCheckboxes.filter((section) => section.dataset.dict === checkbox.dataset.dict);
    const checked = children.filter((section) => section.checked).length;
    checkbox.checked = children.length > 0 && checked === children.length;
    checkbox.indeterminate = checked > 0 && checked < children.length;
  });

  function selectedPool() {
    const keys = new Set(sectionCheckboxes.filter((checkbox) => checkbox.checked).map((checkbox) => scopeKey(checkbox.dataset.dict, checkbox.dataset.section)));
    return available.filter((word) => keys.has(scopeKey(word.dict, word.section || "")));
  }

  function selectedLimit() {
    return Number(context.root.querySelector('input[name="matchLimit"]:checked')?.value || 40);
  }

  function updateDictState(dict) {
    const children = sectionCheckboxes.filter((checkbox) => checkbox.dataset.dict === dict);
    const checked = children.filter((checkbox) => checkbox.checked).length;
    const parent = dictCheckboxes.find((checkbox) => checkbox.dataset.dict === dict);
    if (!parent) return;
    parent.indeterminate = checked > 0 && checked < children.length;
    parent.checked = children.length > 0 && checked === children.length;
  }

  function updateInfo() {
    const pool = selectedPool();
    info.textContent = `Выбрано: ${pool.length} • Игра: ${Math.min(selectedLimit(), pool.length)} слов`;
  }

  dictCheckboxes.forEach((checkbox) => checkbox.addEventListener("change", () => {
    sectionCheckboxes.filter((section) => section.dataset.dict === checkbox.dataset.dict).forEach((section) => { section.checked = checkbox.checked; });
    checkbox.indeterminate = false;
    updateInfo();
  }, { signal }));
  sectionCheckboxes.forEach((checkbox) => checkbox.addEventListener("change", () => {
    updateDictState(checkbox.dataset.dict);
    updateInfo();
  }, { signal }));
  context.root.querySelectorAll('input[name="matchLimit"]').forEach((radio) => radio.addEventListener("change", updateInfo, { signal }));

  context.root.querySelector("#btnMatchStart").addEventListener("click", async () => {
    const pool = selectedPool();
    if (!pool.length) {
      const message = "Нет слов для выбранного режима. Проверьте настройки словаря.";
      if (context.telegram?.showAlert) context.telegram.showAlert(message);
      else window.alert(message);
      return;
    }
    matchState.limit = selectedLimit();
    matchState.selectedScopeKeys = new Set(sectionCheckboxes.filter((checkbox) => checkbox.checked).map((checkbox) => scopeKey(checkbox.dataset.dict, checkbox.dataset.section)));
    const selectedSections = sectionCheckboxes.filter((checkbox) => checkbox.checked);
    startMatch(pool, matchState.limit, {
      dictionaryCount: new Set(selectedSections.map((checkbox) => checkbox.dataset.dict)).size,
      sectionCount: selectedSections.length,
      selectedSources: buildSelectedSources(selectedSections.map((checkbox) => ({
        dictionaryId: checkbox.dataset.dict,
        sectionId: checkbox.dataset.section,
      }))),
    });
    await context.router.navigate("match.game", {}, { force: true });
  }, { signal });
  updateInfo();
}

export function renderMatchGame(context, words, signal) {
  context.root.innerHTML = panel({
    title: "🔗 Сопоставь слова",
    body: `<div class="hintText" id="matchProgress">Пройдено: ${matchState.solvedCount}/${matchState.total} слов</div><div class="matchColumns"><div id="matchColLeft" class="matchCol"></div><div id="matchColRight" class="matchCol"></div></div>`,
  });

  const progress = context.root.querySelector("#matchProgress");
  const left = context.root.querySelector("#matchColLeft");
  const right = context.root.querySelector("#matchColRight");

  function finish() {
    completeMatch();
    context.router.replace("match.results", {}, { force: true });
  }

  function drawRound() {
    const roundWords = nextRound();
    if (!roundWords.length) {
      finish();
      return;
    }

    const leftCards = shuffle(roundWords.map((word) => ({ kind: "w", id: word.id, text: word.word })));
    const rightCards = shuffle(roundWords.map((word) => ({ kind: "t", id: word.id, text: word.trans })));
    matchState.locked = false;
    matchState.selected = null;
    left.innerHTML = leftCards.map((card) => `<button class="matchCard" type="button" data-kind="${card.kind}" data-id="${escapeHtml(card.id)}">${escapeHtml(card.text)}</button>`).join("");
    right.innerHTML = rightCards.map((card) => `<button class="matchCard" type="button" data-kind="${card.kind}" data-id="${escapeHtml(card.id)}">${escapeHtml(card.text)}</button>`).join("");
    const buttons = Array.from(context.root.querySelectorAll(".matchCard"));

    function clearSelection() {
      buttons.forEach((button) => button.classList.remove("selected", "wrong"));
      matchState.selected = null;
    }

    function allMatched() {
      return buttons.length > 0 && buttons.every((button) => button.classList.contains("matched"));
    }

    buttons.forEach((button) => button.addEventListener("click", () => {
      if (matchState.locked || button.classList.contains("matched")) return;
      const choice = { element: button, id: normalizeId(button.dataset.id), kind: button.dataset.kind };
      if (matchState.selected?.element === button) {
        button.classList.remove("selected");
        matchState.selected = null;
        return;
      }
      if (!matchState.selected) {
        clearSelection();
        button.classList.add("selected");
        matchState.selected = choice;
        return;
      }

      const first = matchState.selected;
      if (first.kind === choice.kind) {
        clearSelection();
        button.classList.add("selected");
        matchState.selected = choice;
        return;
      }

      if (first.id === choice.id) {
        first.element.classList.remove("selected");
        button.classList.remove("selected");
        first.element.classList.add("matched");
        button.classList.add("matched");
        markSolved(first.id);
        progress.textContent = `Пройдено: ${matchState.solvedCount}/${matchState.total} слов`;
        matchState.selected = null;
        if (allMatched()) {
          matchState.locked = true;
          window.setTimeout(() => {
            matchState.locked = false;
            drawRound();
          }, 350);
        }
      } else {
        recordMismatch(first.id, choice.id);
        matchState.locked = true;
        first.element.classList.add("wrong");
        button.classList.add("wrong");
        window.setTimeout(() => {
          matchState.locked = false;
          clearSelection();
        }, 600);
      }
    }, { signal }));
  }

  drawRound();
}

export function renderMatchResult(context, words, signal) {
  const problemWords = Object.entries(matchState.failMap)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({ ...words.find((word) => word.id === id), fails: count }))
    .filter((word) => word.id)
    .sort((a, b) => b.fails - a.fails);

  const content = problemWords.length
    ? problemWords.map((word) => renderContentListRow({
        id: word.id,
        leadingHtml: `<span class="contentListStatus bad analyticsFailMark" aria-label="Ошибок: ${word.fails}">${STATUS_BAD_ICON_SVG}<span class="analyticsFailCount">${word.fails}</span></span>`,
        primary: word.word,
        secondary: word.trans,
        trailingHtml: renderStarButton(word.id, `data-word-id="${escapeHtml(word.id)}"`),
      })).join("")
    : `<div class="smallNote noteCenter"><div class="noteTitle">Аперим!</div><div class="successNoteLine">✅ Все пары собраны с первого раза</div></div>`;

  context.root.innerHTML = panel({ title: "Результат игры", body: `<div id="matchResultList" class="contentList">${content}</div>` });
  context.root.querySelectorAll(".starBtn[data-word-id]").forEach((button) => {
    button.addEventListener("click", () => button.classList.toggle("on", wordFavorites.toggle(button.dataset.wordId)), { signal });
  });
}
