import { isWordEnabledInTestModes } from "../../shared/domain/word-selection.js?v=13.8.1";
import { buildSelectedSources } from "../../shared/progress/session-builders.js?v=13.8.1";
import { wordFavorites } from "../../shared/state/word-favorites.js?v=13.8.1";
import { STATUS_BAD_ICON_SVG, STATUS_OK_ICON_SVG } from "../../shared/ui/icons.js?v=13.8.1";
import { renderContentListRow } from "../../shared/ui/list.js?v=13.8.1";
import { escapeHtml, renderStarButton } from "../../shared/ui/word-renderers.js?v=13.8.1";
import { completeTest, pickOptions, startTest, submitAnswer } from "./engine.js?v=13.8.1";
import { testState } from "./state.js?v=13.8.1";

function dictionaryId(word) { return String(word.dictionary_id || word.catalog_id || word.dict || "").trim(); }
function dictionaryName(word) { return String(word.dictionary_name || word.dict || dictionaryId(word) || "Словарь").trim(); }
function sectionId(word) { return String(word.section_id || word.group_id || word.section || "").trim(); }
function sectionName(word) { return String(word.section_name || word.section || sectionId(word) || "Без раздела").trim(); }
function scopeKey(dict, section) { return `${dict}||${section || ""}`; }
function enabledWords(words) { return words.filter(isWordEnabledInTestModes); }

function buildScope(words) {
  const dictionaries = new Map();
  words.forEach((word) => {
    const dictId = dictionaryId(word);
    const secId = sectionId(word);
    if (!dictionaries.has(dictId)) dictionaries.set(dictId, { id: dictId, name: dictionaryName(word), sections: new Map(), count: 0 });
    const dictionary = dictionaries.get(dictId);
    dictionary.count += 1;
    if (!dictionary.sections.has(secId)) dictionary.sections.set(secId, { id: secId, name: sectionName(word), count: 0 });
    dictionary.sections.get(secId).count += 1;
  });
  return Array.from(dictionaries.values()).map((dictionary) => ({ ...dictionary, sections: Array.from(dictionary.sections.values()) }));
}

export function renderTestMenu(context, words, signal) {
  const available = enabledWords(words);
  let selectedMode = testState.mode === "ru" ? "ru" : "kb";
  const scope = buildScope(available);
  const scopeHtml = scope.map((dictionary) => `<div class="scopeBlock">
    <label class="scopeDictRow"><input class="scopeCheckbox scopeDict" type="checkbox" data-dict="${escapeHtml(dictionary.id)}" checked /><span class="scopeLabel"><strong>${escapeHtml(dictionary.name)}</strong><small>${dictionary.count}</small></span></label>
    ${dictionary.sections.map((section) => {
      const checked = testState.selectedScopeKeys.size === 0 || testState.selectedScopeKeys.has(scopeKey(dictionary.id, section.id));
      return `<label class="scopeSectionRow"><input class="scopeCheckbox scopeSection" type="checkbox" data-dict="${escapeHtml(dictionary.id)}" data-section="${escapeHtml(section.id)}" ${checked ? "checked" : ""} /><span class="scopeLabel"><span>${escapeHtml(section.name)}</span><small>${section.count}</small></span></label>`;
    }).join("")}
  </div>`).join("");

  context.root.innerHTML = `<section class="view screen modeView testMenuView">
    <div class="modeScroll">
      <div class="modeLead"><span id="globalTestInfo">—</span><small>Выберите словари и разделы</small></div>
      <div id="testScopeList" class="testScopeList">${scopeHtml || `<div class="hintText">Словари не найдены.</div>`}</div>
      <section class="modeOptionSection">
        <div class="modeOptionLabel">Количество слов</div>
        <div class="segmentControl testLimitRadios">${[20, 40, 80].map((limit) => `<label class="segmentOption radioOpt"><input type="radio" name="testLimit" value="${limit}" ${testState.limit === limit ? "checked" : ""} /><span>${limit}</span></label>`).join("")}</div>
      </section>
    </div>
    <footer class="modeLaunchBar modeMenuLaunch">
      <div class="modeDirectionControl">
        <span>Направление</span>
        <div class="segmentControl modeDirectionToggle" role="radiogroup" aria-label="Направление теста">
          <button class="segmentOption" type="button" role="radio" data-test-mode="kb">АЛАН → РУС</button>
          <button class="segmentOption" type="button" role="radio" data-test-mode="ru">РУС → АЛАН</button>
        </div>
      </div>
      <button id="btnGlobalTestStart" class="btn actionPrimary" type="button">Начать тест</button>
    </footer>
  </section>`;

  const list = context.root.querySelector("#testScopeList");
  const info = context.root.querySelector("#globalTestInfo");
  const dictCheckboxes = Array.from(list.querySelectorAll(".scopeDict"));
  const sectionCheckboxes = Array.from(list.querySelectorAll(".scopeSection"));

  function syncParents() {
    dictCheckboxes.forEach((checkbox) => {
      const children = sectionCheckboxes.filter((section) => section.dataset.dict === checkbox.dataset.dict);
      const checked = children.filter((section) => section.checked).length;
      checkbox.checked = children.length > 0 && checked === children.length;
      checkbox.indeterminate = checked > 0 && checked < children.length;
    });
  }
  function selectedPool() {
    const keys = new Set(sectionCheckboxes.filter((checkbox) => checkbox.checked).map((checkbox) => scopeKey(checkbox.dataset.dict, checkbox.dataset.section)));
    return available.filter((word) => keys.has(scopeKey(dictionaryId(word), sectionId(word))));
  }
  function selectedLimit() { return Number(context.root.querySelector('input[name="testLimit"]:checked')?.value || 40); }
  function updateInfo() { const pool = selectedPool(); info.textContent = `Выбрано ${pool.length} · тест ${Math.min(selectedLimit(), pool.length)}`; }
  function updateMode() {
    context.root.querySelectorAll("[data-test-mode]").forEach((button) => {
      const active = button.dataset.testMode === selectedMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-checked", String(active));
    });
  }
  syncParents(); updateInfo();
  updateMode();

  dictCheckboxes.forEach((checkbox) => checkbox.addEventListener("change", () => {
    sectionCheckboxes.filter((section) => section.dataset.dict === checkbox.dataset.dict).forEach((section) => { section.checked = checkbox.checked; });
    checkbox.indeterminate = false; updateInfo();
  }, { signal }));
  sectionCheckboxes.forEach((checkbox) => checkbox.addEventListener("change", () => { syncParents(); updateInfo(); }, { signal }));
  context.root.querySelectorAll('input[name="testLimit"]').forEach((radio) => radio.addEventListener("change", updateInfo, { signal }));

  async function launch(mode) {
    const pool = selectedPool();
    if (!pool.length) { context.telegram?.showAlert?.("Нет слов для выбранного режима.") || window.alert("Нет слов для выбранного режима."); return; }
    testState.limit = selectedLimit();
    const selected = sectionCheckboxes.filter((checkbox) => checkbox.checked);
    testState.selectedScopeKeys = new Set(selected.map((checkbox) => scopeKey(checkbox.dataset.dict, checkbox.dataset.section)));
    startTest(pool, mode, testState.limit, {
      dictionaryCount: new Set(selected.map((checkbox) => checkbox.dataset.dict)).size,
      sectionCount: selected.length,
      selectedSources: buildSelectedSources(selected.map((checkbox) => ({ dictionaryId: checkbox.dataset.dict, sectionId: checkbox.dataset.section }))),
    });
    await context.router.navigate("test.session", {}, { force: true });
  }
  context.root.querySelectorAll("[data-test-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedMode = button.dataset.testMode === "ru" ? "ru" : "kb";
      testState.mode = selectedMode;
      updateMode();
    }, { signal });
  });
  context.root.querySelector("#btnGlobalTestStart")?.addEventListener("click", () => launch(selectedMode), { signal });
}

export function renderTestResults(context, signal) {
  const percentage = Math.round((testState.correct / Math.max(1, testState.items.length)) * 100);
  const level = percentage >= 100 ? 3 : percentage >= 90 ? 2 : percentage >= 80 ? 1 : 0;
  const rows = testState.results.map((result) => renderContentListRow({
    id: result.id,
    leadingHtml: `<span class="contentListStatus ${result.isCorrect ? "ok" : "bad"}">${result.isCorrect ? STATUS_OK_ICON_SVG : STATUS_BAD_ICON_SVG}</span>`,
    primary: result.questionText || result.word,
    secondaryHtml: `<span class="contentListDetail"><strong>Правильно:</strong> ${escapeHtml(result.correctAnswer)}</span><span class="contentListDetail"><strong>Ответ:</strong> ${escapeHtml(result.userAnswer || "—")}</span>`,
    trailingHtml: renderStarButton(result.id, `data-word-id="${escapeHtml(result.id)}"`),
  })).join("");
  context.root.innerHTML = `<section class="view screen modeView testResultsView">
    <div class="modeResultSummary"><span class="modeResultMark">${level ? "⌃".repeat(level) : "—"}</span><strong>${percentage}%</strong><span>${percentage >= 80 ? "Тест сдан" : "Тест не сдан"} · ${testState.correct}/${testState.items.length}</span></div>
    <div class="contentList modeResultList">${rows || `<div class="hintText">Нет результатов.</div>`}</div>
    <footer class="modeLaunchBar"><button class="btn actionPrimary" id="btnTestAgain2" type="button">Пройти ещё раз</button></footer>
  </section>`;
  context.root.querySelectorAll(".starBtn[data-word-id]").forEach((button) => button.addEventListener("click", () => button.classList.toggle("on", wordFavorites.toggle(button.dataset.wordId)), { signal }));
  context.root.querySelector("#btnTestAgain2")?.addEventListener("click", async () => { startTest(testState.session.wordsPool, testState.mode, testState.limit, testState.session.metadata); await context.router.replace("test.session", {}, { force: true }); }, { signal });
}

export function renderTestSession(context, signal) {
  function draw() {
    if (testState.index >= testState.items.length) { completeTest(); context.router.replace("test.results", {}, { force: true }); return; }
    const item = testState.items[testState.index];
    const question = testState.mode === "kb" ? item.word : item.trans;
    context.shell.setCounter(`${testState.index + 1}/${testState.items.length}`);
    context.root.innerHTML = `<section class="view screen modeSessionView">
      <div class="modeQuestion">${escapeHtml(question)}</div>
      <div id="testOptions" class="modeOptions">${pickOptions(item).map((option) => `<button class="choiceControl optionBtn" type="button" data-option-id="${escapeHtml(option.id)}" data-option-text="${escapeHtml(option.text)}">${escapeHtml(option.text)}</button>`).join("")}</div>
      <footer class="modeLaunchBar"><button id="btnTestNext" class="btn actionPrimary" type="button" disabled>Ответить</button></footer>
    </section>`;
    const next = context.root.querySelector("#btnTestNext");
    const options = Array.from(context.root.querySelectorAll(".optionBtn"));
    options.forEach((button) => button.addEventListener("click", () => {
      testState.selectedAnswer = { id: button.dataset.optionId, text: button.dataset.optionText };
      options.forEach((option) => option.classList.remove("selected")); button.classList.add("selected"); next.disabled = false;
    }, { signal }));
    next.addEventListener("click", () => { if (!testState.selectedAnswer) return; submitAnswer(testState.selectedAnswer); draw(); }, { signal });
  }
  draw();
}
