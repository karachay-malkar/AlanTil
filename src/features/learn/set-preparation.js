import { wordFavorites } from "../../shared/state/word-favorites.js?v=13.8.1";
import { renderContentListRow } from "../../shared/ui/list.js?v=13.8.1";
import { escapeHtml, renderStarButton } from "../../shared/ui/word-renderers.js?v=13.8.1";
import { getHiddenSet, learnState, setHiddenSet } from "./state.js?v=13.8.1";

function normalizeContext(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function prepareSelection({ dictionaryId, sectionId, setId }) {
  learnState.currentDict = dictionaryId;
  learnState.currentSection = sectionId;
  learnState.currentSet = setId;
  learnState.menuHidden = getHiddenSet(dictionaryId, sectionId, setId);
}

export function renderSetPreparation(context, {
  title,
  subtitle = "",
  words = [],
  dictionaryId,
  sectionId,
  setId,
  signal,
  canStudy = true,
  canTest = false,
  testLabel = "Пройти тест",
  onStart,
  onTest,
  favoritesOnly = false,
} = {}) {
  const sourceWords = Array.isArray(words) ? words : [];
  const storageContext = {
    dictionaryId: normalizeContext(dictionaryId),
    sectionId: normalizeContext(sectionId),
    setId: normalizeContext(setId),
  };
  prepareSelection(storageContext);
  let selectedMode = learnState.currentStudyMode === "ru" ? "ru" : "kb";

  context.shell.setHeaderContent?.({ title, subtitle });

  context.root.innerHTML = `
    <section class="view screen setPreparationView">
      <div class="setPreparation">
        <div class="setPreparationToolbar">
          <div class="setSelectionTools" aria-label="Управление выбором слов">
            <button class="textAction" type="button" data-select-all>Показать все</button><span aria-hidden="true">·</span><button class="textAction" type="button" data-hide-all>Скрыть все</button>
          </div>
          <div id="setSelectionCount" class="setSelectionCount" aria-live="polite"></div>
        </div>

        <div id="setPreparationWords" class="contentList setPreparationWords"></div>

        <footer class="setPreparationFooter">
          <div class="segmentControl directionChoice" role="radiogroup" aria-label="Направление обучения">
            <button class="segmentOption directionChoiceButton" type="button" role="radio" data-study-mode="kb">АЛАН → РУС</button>
            <button class="segmentOption directionChoiceButton" type="button" role="radio" data-study-mode="ru">РУС → АЛАН</button>
          </div>
          <button class="btn actionPrimary setStudyButton" type="button" data-study-start>Начать изучение</button>
          ${canTest ? `<button class="btn actionText setTestButton" type="button" data-set-test>${escapeHtml(testLabel)}</button>` : ""}
        </footer>
      </div>
    </section>`;

  const list = context.root.querySelector("#setPreparationWords");
  const count = context.root.querySelector("#setSelectionCount");
  const modeButtons = Array.from(context.root.querySelectorAll("[data-study-mode]"));
  const startButton = context.root.querySelector("[data-study-start]");

  function visibleWords() {
    return favoritesOnly ? sourceWords.filter((word) => wordFavorites.has(word.id)) : sourceWords;
  }

  function activeWords() {
    return visibleWords().filter((word) => !learnState.menuHidden.has(word.id));
  }

  function persistSelection() {
    setHiddenSet(storageContext.dictionaryId, storageContext.sectionId, storageContext.setId, learnState.menuHidden);
  }

  function updateState() {
    const active = activeWords().length;
    count.textContent = `${active}/${visibleWords().length}`;
    modeButtons.forEach((button) => {
      const selected = button.dataset.studyMode === selectedMode;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-checked", String(selected));
      button.disabled = !canStudy;
    });
    if (startButton) startButton.disabled = !canStudy || active === 0;
  }

  function wireFavorites() {
    list.querySelectorAll(".starBtn[data-word-id]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const on = wordFavorites.toggle(button.dataset.wordId);
        button.classList.toggle("on", on);
        if (favoritesOnly && !on) draw();
      }, { signal });
    });
  }

  function draw() {
    list.innerHTML = visibleWords().map((word) => renderContentListRow({
      id: word.id,
      rowAttributes: `data-word-row="${escapeHtml(word.id)}"`,
      leadingHtml: `<label class="bracketCheckbox"><input class="contentListCheckbox" type="checkbox" ${learnState.menuHidden.has(word.id) ? "" : "checked"} aria-label="Добавить слово в обучение" /><span class="bracketCheckboxMark" aria-hidden="true"></span></label>`,
      primary: word.word,
      secondary: word.trans,
      trailingHtml: renderStarButton(word.id, `data-word-id="${escapeHtml(word.id)}"`),
      className: "setPreparationWord",
    })).join("");

    list.querySelectorAll("[data-word-row]").forEach((row) => {
      const checkbox = row.querySelector(".contentListCheckbox");
      checkbox?.addEventListener("change", () => {
        if (checkbox.checked) learnState.menuHidden.delete(row.dataset.wordRow);
        else learnState.menuHidden.add(row.dataset.wordRow);
        persistSelection();
        updateState();
      }, { signal });
    });
    wireFavorites();
    updateState();
  }

  context.root.querySelector("[data-select-all]")?.addEventListener("click", () => {
    learnState.menuHidden = new Set();
    persistSelection();
    draw();
  }, { signal });

  context.root.querySelector("[data-hide-all]")?.addEventListener("click", () => {
    learnState.menuHidden = new Set(visibleWords().map((word) => word.id));
    persistSelection();
    draw();
  }, { signal });

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      selectedMode = button.dataset.studyMode === "ru" ? "ru" : "kb";
      learnState.currentStudyMode = selectedMode;
      updateState();
    }, { signal });
  });

  startButton?.addEventListener("click", () => {
    if (startButton.disabled || typeof onStart !== "function") return;
    onStart(selectedMode, activeWords());
  }, { signal });

  context.root.querySelector("[data-set-test]")?.addEventListener("click", () => {
    if (typeof onTest === "function") onTest();
  }, { signal });

  draw();
}
