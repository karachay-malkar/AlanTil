import { msg } from "../../shared/i18n/index.js?v=13.9.0";
import { masteryLevelForPercent } from "../../../packages/alantil-core/mastery.js";
import { buildPracticeScope, practiceScopeKey, practiceSelectedPool } from "../../../packages/alantil-core/practice-scope.js";
import { masteryLevelForPercent } from "../../../packages/alantil-core/mastery.js";
import { buildPracticeScope, practiceScopeKey, practiceSelectedPool } from "../../../packages/alantil-core/practice-scope.js";
import { isWordEnabledInTestModes } from "../../shared/domain/word-selection.js?v=13.13";
import { buildSelectedSources } from "../../shared/progress/session-builders.js?v=13.13";
import { wordFavorites } from "../../shared/state/word-favorites.js?v=13.9.0";
import { bindResultRows, renderResultRow, renderResultScreen } from "../../shared/ui/result-list.js?v=13.10.12";
import { escapeHtml, renderStarButton } from "../../shared/ui/word-renderers.js?v=13.9.0";
import { completeTest, pickOptions, startTest, submitAnswer } from "./engine.js?v=13.13";
import { testState } from "./state.js?v=13.9.0";

function enabledWords(words) { return words.filter(isWordEnabledInTestModes); }

function buildScope(words) {
  const dictionaries = new Map();
  words.forEach((word) => {
    const dictId = dictionaryId(word);
    const wordSectionId = sectionId(word);
    if (!dictId || !wordSectionId) return;
    if (!dictionaries.has(dictId)) dictionaries.set(dictId, { id: dictId, name: dictionaryName(word), sections: new Map(), count: 0 });
    const dictionary = dictionaries.get(dictId);
    dictionary.count += 1;
    if (!dictionary.sections.has(wordSectionId)) dictionary.sections.set(wordSectionId, { id: wordSectionId, name: sectionName(word), count: 0 });
    dictionary.sections.get(wordSectionId).count += 1;
  });
  return Array.from(dictionaries.values()).map((dictionary) => ({ ...dictionary, sections: Array.from(dictionary.sections.values()) }));
}

export function renderTestMenu(context, words, signal) {
  const available = enabledWords(words);
  let selectedMode = testState.mode === "ru" ? "ru" : "kb";
  const scope = buildPracticeScope(available);
  const scopeHtml = scope.map((dictionary) => `<div class="scopeBlock">
    <label class="scopeDictRow"><input class="scopeCheckbox scopeDict" type="checkbox" data-dict="${escapeHtml(dictionary.id)}" checked /><span class="scopeLabel"><strong>${escapeHtml(dictionary.name)}</strong><small>${dictionary.count}</small></span></label>
    ${dictionary.sections.map((section) => {
      const checked = testState.selectedScopeKeys.size === 0 || testState.selectedScopeKeys.has(practiceScopeKey(dictionary.id, section.id));
      return `<label class="scopeSectionRow"><input class="scopeCheckbox scopeSection" type="checkbox" data-dict="${escapeHtml(dictionary.id)}" data-section="${escapeHtml(section.id)}" ${checked ? "checked" : ""} /><span class="scopeLabel"><span>${escapeHtml(section.name)}</span><small>${section.count}</small></span></label>`;
    }).join("")}
  </div>`).join("");

  context.root.innerHTML = `<section class="view screen modeView testMenuView">
    <div class="modeScroll">
      <div class="modeLead"><span id="globalTestInfo">—</span><small>${msg("test.vyberite_slovari_i_razdely")}</small></div>
      <div id="testScopeList" class="testScopeList">${scopeHtml || `<div class="hintText">${msg("test.slovari_ne_naydeny")}</div>`}</div>
      <section class="modeOptionSection">
        <div class="modeOptionLabel">${msg("test.kolichestvo_slov")}</div>
        <div class="segmentControl testLimitRadios">${[20, 40, 80].map((limit) => `<label class="segmentOption radioOpt"><input type="radio" name="testLimit" value="${limit}" ${testState.limit === limit ? "checked" : ""} /><span>${limit}</span></label>`).join("")}</div>
      </section>
    </div>
    <footer class="modeLaunchBar modeMenuLaunch">
      <div class="modeDirectionControl">
        <span>${msg("test.napravlenie")}</span>
        <div class="segmentControl modeDirectionToggle" role="radiogroup" aria-label="${msg("test.napravlenie_testa")}">
          <button class="segmentOption" type="button" role="radio" data-test-mode="kb">${msg("test.alan_rus")}</button>
          <button class="segmentOption" type="button" role="radio" data-test-mode="ru">${msg("test.rus_alan")}</button>
        </div>
      </div>
      <button id="btnGlobalTestStart" class="btn actionPrimary" type="button">${msg("test.nachat_test")}</button>
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
    const keys = new Set(sectionCheckboxes.filter((checkbox) => checkbox.checked).map((checkbox) => practiceScopeKey(checkbox.dataset.dict, checkbox.dataset.section)));
    return practiceSelectedPool(available, keys);
  }
  function selectedLimit() { return Number(context.root.querySelector('input[name="testLimit"]:checked')?.value || 40); }
  function updateInfo() { const pool = selectedPool(); info.textContent = msg("test.vybrano_test", { pool: pool.length, limit: Math.min(selectedLimit(), pool.length) }); }
  function updateMode() {
    context.root.querySelectorAll("[data-test-mode]").forEach((button) => {
      const active = button.dataset.testMode === selectedMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-checked", String(active));
    });
  }
  syncParents(); updateInfo(); updateMode();

  dictCheckboxes.forEach((checkbox) => checkbox.addEventListener("change", () => {
    sectionCheckboxes.filter((section) => section.dataset.dict === checkbox.dataset.dict).forEach((section) => { section.checked = checkbox.checked; });
    checkbox.indeterminate = false; updateInfo();
  }, { signal }));
  sectionCheckboxes.forEach((checkbox) => checkbox.addEventListener("change", () => { syncParents(); updateInfo(); }, { signal }));
  context.root.querySelectorAll('input[name="testLimit"]').forEach((radio) => radio.addEventListener("change", updateInfo, { signal }));

  async function launch(mode) {
    const pool = selectedPool();
    if (!pool.length) { context.telegram?.showAlert?.(msg("test.net_slov_dlya_vybrannogo_rezhima")) || window.alert(msg("test.net_slov_dlya_vybrannogo_rezhima")); return; }
    testState.limit = selectedLimit();
    const selected = sectionCheckboxes.filter((checkbox) => checkbox.checked);
    testState.selectedScopeKeys = new Set(selected.map((checkbox) => practiceScopeKey(checkbox.dataset.dict, checkbox.dataset.section)));
    startTest(pool, mode, testState.limit, {
      dictionaryCount: new Set(selected.map((checkbox) => checkbox.dataset.dict)).size,
      sectionCount: selected.length,
      selectedSources: buildSelectedSources(selected.map((checkbox) => ({ dictionaryId: checkbox.dataset.dict, sectionId: checkbox.dataset.section }))),
    }, words);
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
  const level = masteryLevelForPercent(percentage);
  const rows = testState.results.map((result) => {
    const details = result.isCorrect
      ? [{ label: msg("test.pravilno"), value: result.correctAnswer, tone: "correct" }]
      : [
          { label: msg("test.otvet"), value: result.userAnswer || "—", tone: "wrong" },
          { label: msg("test.pravilno"), value: result.correctAnswer, tone: "correct" },
        ];
    return renderResultRow({
      id: result.id,
      status: result.isCorrect ? "ok" : "bad",
      primary: result.questionText || result.word,
      details,
      trailingHtml: renderStarButton(result.id, `data-word-id="${escapeHtml(result.id)}"`),
    });
  }).join("");
  context.root.innerHTML = renderResultScreen({
    className: "testResultsView",
    summaryClass: "modeResultSummary",
    summaryHtml: `<span class="modeResultMark">${level ? "⌃".repeat(level) : "—"}</span><strong>${percentage}%</strong><span>${percentage >= 80 ? msg("test.test_sdan") : msg("test.test_ne_sdan")} · ${testState.correct}/${testState.items.length}</span>`,
    contentHtml: rows,
    emptyHtml: `<div class="hintText">${msg("test.net_rezultatov")}</div>`,
    footerHtml: `<button class="btn actionPrimary" id="btnTestAgain2" type="button">${msg("test.proyti_esche_raz")}</button>`,
  });
  bindResultRows(context.root, { signal });
  context.root.querySelectorAll(".starBtn[data-word-id]").forEach((button) => button.addEventListener("click", () => button.classList.toggle("on", wordFavorites.toggle(button.dataset.wordId)), { signal }));
  context.root.querySelector("#btnTestAgain2")?.addEventListener("click", async () => {
    startTest(testState.session.wordsPool, testState.mode, testState.limit, testState.session.metadata, testState.optionPool);
    await context.router.replace("test.session", {}, { force: true });
  }, { signal });
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
      <footer class="modeLaunchBar"><button id="btnTestNext" class="btn actionPrimary" type="button" disabled>${msg("test.otvetit")}</button></footer>
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
