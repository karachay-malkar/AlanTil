import { DICT_TITLES, SECTION_TITLES } from "../../config/words.js";
import { dictsFrom, isWordEnabledInTestModes, sortNatural, uniq } from "../../shared/domain/word-selection.js";
import { wordFavorites } from "../../shared/state/word-favorites.js";
import { STATUS_BAD_ICON_SVG, STATUS_OK_ICON_SVG } from "../../shared/ui/icons.js";
import { renderContentListRow } from "../../shared/ui/list.js";
import { panel } from "../../shared/ui/panel.js";
import { escapeHtml, renderStarButton } from "../../shared/ui/word-renderers.js";
import { completeTest, pickOptions, startTest, submitAnswer } from "./engine.js";
import { testState } from "./state.js";

function dictTitle(code) {
  return DICT_TITLES[code] || code;
}

function sectionTitle(code) {
  return SECTION_TITLES[code] || code;
}

function scopeKey(dict, section) {
  return `${dict}||${section || ""}`;
}

function enabledWords(words) {
  return words.filter(isWordEnabledInTestModes);
}

export function renderTestMenu(context, words, signal) {
  const available = enabledWords(words);
  const dictionaries = dictsFrom(available);
  const scopeHtml = dictionaries.map((dict) => {
    const sections = uniq(available.filter((word) => word.dict === dict).map((word) => word.section || "")).sort(sortNatural);
    return `
      <div class="scopeBlock">
        <label class="scopeDictRow"><input class="scopeCheckbox scopeDict" type="checkbox" data-dict="${escapeHtml(dict)}" checked /><span>${escapeHtml(dictTitle(dict))}</span></label>
        ${sections.map((section) => {
          const checked = testState.selectedScopeKeys.size === 0 || testState.selectedScopeKeys.has(scopeKey(dict, section));
          return `<label class="scopeSectionRow"><input class="scopeCheckbox scopeSection" type="checkbox" data-dict="${escapeHtml(dict)}" data-section="${escapeHtml(section)}" ${checked ? "checked" : ""} /><span>${escapeHtml(section ? sectionTitle(section) : "Без раздела")}</span></label>`;
        }).join("")}
      </div>`;
  }).join("");

  context.root.innerHTML = panel({
    title: "Проверь свои знания!",
    body: `
      <div class="hintText" id="globalTestInfo">—</div>
      <div class="testScopeTitle">Словари и разделы</div>
      <div id="testScopeBody" class="testScope"><div id="testScopeList" class="testScopeList">${scopeHtml || "<div class='hintText'>Словари не найдены.</div>"}</div></div>
      <div class="testLimitRow"><div class="testLimitTitle">Количество слов</div><div class="testLimitRadios">
        ${[20, 40, 80].map((limit) => `<label class="radioOpt"><input type="radio" name="testLimit" value="${limit}" ${testState.limit === limit ? "checked" : ""} /><span>${limit}</span></label>`).join("")}
      </div></div>
      <div class="row"><button id="btnGlobalModeKb" class="btn primary" type="button">АЛАН → РУС</button><button id="btnGlobalModeRu" class="btn primary" type="button">РУС → АЛАН</button></div>`,
  });

  const list = context.root.querySelector("#testScopeList");
  const info = context.root.querySelector("#globalTestInfo");
  const dictCheckboxes = Array.from(list.querySelectorAll(".scopeDict"));
  const sectionCheckboxes = Array.from(list.querySelectorAll(".scopeSection"));
  dictCheckboxes.forEach((checkbox) => {
    const children = sectionCheckboxes.filter((section) => section.dataset.dict === checkbox.dataset.dict);
    const checked = children.filter((section) => section.checked).length;
    checkbox.checked = children.length > 0 && checked === children.length;
    checkbox.indeterminate = checked > 0 && checked < children.length;
  });

  function selectedPool() {
    const selected = sectionCheckboxes.filter((checkbox) => checkbox.checked);
    const keys = new Set(selected.map((checkbox) => scopeKey(checkbox.dataset.dict, checkbox.dataset.section)));
    return available.filter((word) => keys.has(scopeKey(word.dict, word.section || "")));
  }

  function selectedLimit() {
    return Number(context.root.querySelector('input[name="testLimit"]:checked')?.value || 40);
  }

  function selectionMetadata() {
    const selected = sectionCheckboxes.filter((checkbox) => checkbox.checked);
    return {
      dictionaryCount: new Set(selected.map((checkbox) => checkbox.dataset.dict)).size,
      sectionCount: selected.length,
    };
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
    const selectedSections = sectionCheckboxes.filter((checkbox) => checkbox.checked);
    const dictionaryCount = new Set(selectedSections.map((checkbox) => checkbox.dataset.dict)).size;
    const scopeText = selectedSections.length === sectionCheckboxes.length
      ? "Все словари и разделы"
      : `Выбрано: словарей ${dictionaryCount}, разделов ${selectedSections.length}`;
    info.textContent = `Источник: ${scopeText} • Слов: ${pool.length} • Тест: ${Math.min(selectedLimit(), pool.length)} слов`;
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
  context.root.querySelectorAll('input[name="testLimit"]').forEach((radio) => radio.addEventListener("change", updateInfo, { signal }));

  async function launch(mode) {
    const pool = selectedPool();
    if (!pool.length) {
      const message = "Нет слов для выбранного режима. Проверьте настройки словаря.";
      if (context.telegram?.showAlert) context.telegram.showAlert(message);
      else window.alert(message);
      return;
    }
    testState.limit = selectedLimit();
    testState.selectedScopeKeys = new Set(sectionCheckboxes.filter((checkbox) => checkbox.checked).map((checkbox) => scopeKey(checkbox.dataset.dict, checkbox.dataset.section)));
    startTest(pool, mode, testState.limit, selectionMetadata());
    await context.router.navigate("test.session", {}, { force: true });
  }

  context.root.querySelector("#btnGlobalModeKb").addEventListener("click", () => launch("kb"), { signal });
  context.root.querySelector("#btnGlobalModeRu").addEventListener("click", () => launch("ru"), { signal });
  updateInfo();
}

export function renderTestResults(context, signal) {
  const percentage = Math.round((testState.correct / Math.max(1, testState.items.length)) * 100);
  const rows = testState.results.map((result) => renderContentListRow({
    id: result.id,
    leadingHtml: `<span class="contentListStatus ${result.isCorrect ? "ok" : "bad"}">${result.isCorrect ? STATUS_OK_ICON_SVG : STATUS_BAD_ICON_SVG}</span>`,
    primary: result.questionText || result.word,
    secondaryHtml: `<span class="contentListDetail"><strong>Правильно:</strong> ${escapeHtml(result.correctAnswer)}</span><span class="contentListDetail"><strong>Твой ответ:</strong> ${escapeHtml(result.userAnswer || "—")}</span>`,
    trailingHtml: renderStarButton(result.id, `data-word-id="${escapeHtml(result.id)}"`),
  })).join("");

  context.root.innerHTML = panel({
    title: "Результаты теста",
    body: `<div class="hintText">Правильно: ${testState.correct}/${testState.items.length} (${percentage}%)</div><div id="testOptions" class="stack resultScroll"><div class="contentList">${rows || "<div class='hintText'>Нет результатов.</div>"}</div><div class="row"><button class="btn primary" id="btnTestAgain2" type="button">Пройти ещё раз</button></div></div>`,
  });

  context.root.querySelectorAll(".starBtn[data-word-id]").forEach((button) => {
    button.addEventListener("click", () => button.classList.toggle("on", wordFavorites.toggle(button.dataset.wordId)), { signal });
  });
  context.root.querySelector("#btnTestAgain2")?.addEventListener("click", async () => {
    startTest(testState.session.wordsPool, testState.mode, testState.limit, testState.session.metadata);
    await context.router.replace("test.session", {}, { force: true });
  }, { signal });
}

export function renderTestSession(context, signal) {
  function draw() {
    if (testState.index >= testState.items.length) {
      completeTest();
      context.router.replace("test.results", {}, { force: true });
      return;
    }

    const item = testState.items[testState.index];
    const question = testState.mode === "kb" ? item.word : item.trans;
    context.root.innerHTML = panel({
      title: "Тест: выбрать перевод",
      body: `
        <div class="hintText" id="testProgress">Вопрос ${testState.index + 1} из ${testState.items.length}</div>
        <div class="testQuestion" id="testQuestion">${escapeHtml(question)}</div>
        <div id="testOptions" class="stack" style="margin-top:12px;">${pickOptions(item).map((option) => `<button class="optionBtn" type="button" data-option="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join("")}</div>
        <div class="row"><button id="btnTestNext" class="btn primary" type="button" disabled>Дальше</button></div>`,
    });

    const next = context.root.querySelector("#btnTestNext");
    const options = Array.from(context.root.querySelectorAll(".optionBtn"));
    options.forEach((button) => button.addEventListener("click", () => {
      testState.selectedAnswer = button.dataset.option;
      options.forEach((option) => option.classList.remove("selected"));
      button.classList.add("selected");
      next.disabled = false;
    }, { signal }));
    next.addEventListener("click", () => {
      if (!testState.selectedAnswer) return;
      submitAnswer(testState.selectedAnswer);
      draw();
    }, { signal });
  }

  draw();
}
