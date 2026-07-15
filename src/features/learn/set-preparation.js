import { wordFavorites } from "../../shared/state/word-favorites.js";
import { renderContentListRow } from "../../shared/ui/list.js";
import { escapeHtml, renderStarButton } from "../../shared/ui/word-renderers.js";
import { getHiddenSet, learnState, setHiddenSet } from "./state.js";

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

  context.root.innerHTML = `
    <section class="view screen setPreparationView">
      <div class="setPreparation">
        <header class="setPreparationHeader">
          <div>
            <h1 class="setPreparationTitle">${escapeHtml(title)}</h1>
            ${subtitle ? `<div class="setPreparationSubtitle">${escapeHtml(subtitle)}</div>` : ""}
          </div>
          <div id="setSelectionCount" class="setSelectionCount" aria-live="polite"></div>
        </header>

        <div class="setSelectionTools" aria-label="Управление выбором слов">
          <button class="textAction" type="button" data-select-all>Показать все</button>
          <button class="textAction" type="button" data-hide-all>Скрыть все</button>
        </div>

        <div id="setPreparationWords" class="contentList setPreparationWords"></div>

        <footer class="setPreparationFooter">
          <div class="directionChoice" aria-label="Направление обучения">
            <button class="directionChoiceButton" type="button" data-study-mode="kb">АЛАН → РУС</button>
            <button class="directionChoiceButton" type="button" data-study-mode="ru">РУС → АЛАН</button>
          </div>
          ${canTest ? `<button class="btn secondary setTestButton" type="button" data-set-test>${escapeHtml(testLabel)}</button>` : ""}
        </footer>
      </div>
    </section>`;

  const list = context.root.querySelector("#setPreparationWords");
  const count = context.root.querySelector("#setSelectionCount");
  const modeButtons = Array.from(context.root.querySelectorAll("[data-study-mode]"));

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
      button.disabled = !canStudy || active === 0;
    });
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
      leadingHtml: `<input class="contentListCheckbox" type="checkbox" ${learnState.menuHidden.has(word.id) ? "" : "checked"} aria-label="Добавить слово в обучение" />`,
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
      if (button.disabled || typeof onStart !== "function") return;
      onStart(button.dataset.studyMode, activeWords());
    }, { signal });
  });

  context.root.querySelector("[data-set-test]")?.addEventListener("click", () => {
    if (typeof onTest === "function") onTest();
  }, { signal });

  draw();
}
