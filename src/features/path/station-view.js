import { problemWordRows, recentTestSummariesForWords, testSummariesForWords, wordProgressSummary } from "../../shared/progress/word-progress-store.js";
import { wordFavorites } from "../../shared/state/word-favorites.js";
import { escapeHtml } from "../../shared/ui/html.js";
import { renderSegmentedProgress } from "../../shared/ui/segmented-progress.js";
import { renderStarButton } from "../../shared/ui/word-renderers.js";
import { getHiddenSet, setHiddenSet } from "../learn/state.js";

function storageKey(station) {
  return station.selectionSetId || station.setId || station.key;
}


function masteryMark(percent) {
  if (percent >= 100) return { level: 3, label: "III знак", symbol: "⌃⌃⌃" };
  if (percent >= 90) return { level: 2, label: "II знак", symbol: "⌃⌃" };
  if (percent >= 80) return { level: 1, label: "I знак", symbol: "⌃" };
  return { level: 0, label: "не сдан", symbol: "—" };
}

function resultCard(result) {
  const mark = masteryMark(result.percent);
  const date = result.date ? new Intl.DateTimeFormat("ru", { day: "2-digit", month: "2-digit" }).format(new Date(result.date)) : "";
  return `<div class="stationAttempt ${result.percent >= 80 ? "isPassed" : "isFailed"}">
    <strong>${result.percent}%</strong>
    <span>${escapeHtml(mark.label)}</span>
    ${date ? `<small>${escapeHtml(date)}</small>` : ""}
  </div>`;
}

function problemRows(words) {
  const rows = problemWordRows(words, 7);
  if (!rows.length) return `<div class="stationEmptyState">Пока недостаточно данных.</div>`;
  return `<div class="stationProblemList">
    <div class="stationProblemHead"><span>Слово</span><span>Показы</span><span>«Не знаю»</span><span>Затруднение</span><span></span></div>
    ${rows.map(({ word, progress, evaluated, unknownRate }) => `<div class="stationProblemRow">
      <span class="stationProblemWord">${escapeHtml(word.word)}</span>
      <span>${evaluated}</span>
      <span>${progress.unknown_count}</span>
      <span>${unknownRate}%</span>
      ${renderStarButton(word.id, `data-stat-favorite="${escapeHtml(word.id)}"`)}
    </div>`).join("")}
  </div>`;
}

export function renderStationView(context, station, {
  signal,
  onStartStudy,
  onStartTest,
} = {}) {
  const allWords = Array.isArray(station.words) ? station.words : [];
  const selectionId = storageKey(station);
  let activeTab = "menu";
  let hidden = getHiddenSet(station.dictionaryId, station.groupId, selectionId);
  let menuScrollTop = 0;

  context.shell.setHeaderContent?.({
    title: station.name,
    subtitle: station.groupName,
    logo: false,
    brand: false,
  });

  const stationWordIds = new Set(allWords.map((word) => String(word.id)));

  function activeWords() {
    return allWords.filter((word) => !hidden.has(String(word.id)));
  }

  function replaceCurrentStationHidden(nextIds) {
    stationWordIds.forEach((wordId) => hidden.delete(wordId));
    (nextIds || []).forEach((wordId) => hidden.add(String(wordId)));
  }

  function persist() {
    setHiddenSet(station.dictionaryId, station.groupId, selectionId, hidden);
  }

  function wireTabButtons() {
    context.root.querySelectorAll("[data-station-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = button.dataset.stationTab === "statistics" ? "statistics" : "menu";
        if (next === activeTab) return;
        const list = context.root.querySelector(".stationWordList");
        if (list) menuScrollTop = list.scrollTop;
        activeTab = next;
        draw();
      }, { signal });
    });
  }

  function renderMenu() {
    const selected = activeWords();
    return `<section class="stationPane stationMenuPane" data-station-pane="menu">
      <div class="stationMenuToolbar">
        <span class="stationSelectionCount">${selected.length}/${allWords.length}</span>
        <span class="stationMenuActions">
          <button class="textAction" type="button" data-show-all>Показать все</button>
          <span aria-hidden="true">·</span>
          <button class="textAction" type="button" data-hide-all>Скрыть все</button>
        </span>
      </div>
      <div class="contentList stationWordList">
        ${allWords.map((word) => `<div class="contentListRow stationWordRow" data-station-word="${escapeHtml(word.id)}">
          <label class="stationWordToggle">
            <input class="contentListCheckbox" type="checkbox" ${hidden.has(String(word.id)) ? "" : "checked"} aria-label="Добавить слово в обучение" />
          </label>
          <span class="contentListMain"><strong class="contentListPrimary">${escapeHtml(word.word)}</strong><span class="contentListSecondary">${escapeHtml(word.trans)}</span></span>
          ${renderStarButton(word.id, `data-station-favorite="${escapeHtml(word.id)}"`)}
        </div>`).join("")}
      </div>
      <footer class="stationLaunchPanel">
        <div class="directionChoice">
          <button class="directionChoiceButton" type="button" data-station-study="kb" ${selected.length ? "" : "disabled"}>АЛАН → РУС</button>
          <button class="directionChoiceButton" type="button" data-station-study="ru" ${selected.length ? "" : "disabled"}>РУС → АЛАН</button>
        </div>
        <button class="btn secondary stationTestButton" type="button" data-station-test ${selected.length ? "" : "disabled"}>Проверить знания</button>
      </footer>
    </section>`;
  }

  function renderStatistics() {
    const summary = wordProgressSummary(allWords);
    const recent = recentTestSummariesForWords(allWords, 3);
    const attempts = testSummariesForWords(allWords);
    const best = attempts.reduce((value, row) => Math.max(value, Number(row.percent || 0)), 0);
    const mark = masteryMark(best);
    return `<section class="stationPane stationStatisticsPane" data-station-pane="statistics">
      <div class="stationStatsSummary">
        <div class="stationMasteryBlock">
          <span class="stationStatLabel">Освоено слов</span>
          <strong>${summary.mastered}/${summary.total}</strong>
          ${renderSegmentedProgress({ value: summary.percent, segments: 10, label: `Освоено ${summary.percent}% слов`, className: "stationMasteryProgress" })}
        </div>
        <div class="stationMasteryBadge" aria-label="${escapeHtml(mark.label)}"><span>${escapeHtml(mark.symbol)}</span><small>${escapeHtml(mark.label)}</small></div>
      </div>
      <div class="stationMetricGrid">
        <div><strong>${attempts.length}</strong><span>попыток</span></div>
        <div><strong>${best}%</strong><span>лучший результат</span></div>
        <div><strong>${summary.review}</strong><span>требуют повторения</span></div>
      </div>
      <section class="stationStatsSection">
        <h2 class="bracketHeading stationStatsHeading"><span aria-hidden="true">[</span><span>Последние результаты</span><span aria-hidden="true">]</span></h2>
        <div class="stationAttempts">${recent.length ? recent.map(resultCard).join("") : `<div class="stationEmptyState">Тесты ещё не проходились.</div>`}</div>
      </section>
      <section class="stationStatsSection">
        <h2 class="bracketHeading stationStatsHeading"><span aria-hidden="true">[</span><span>Проблемные слова</span><span aria-hidden="true">]</span></h2>
        ${problemRows(allWords)}
      </section>
    </section>`;
  }

  function wireMenu() {
    const list = context.root.querySelector(".stationWordList");
    if (list) list.scrollTop = menuScrollTop;
    list?.querySelectorAll("[data-station-word]").forEach((row) => {
      row.querySelector("input")?.addEventListener("change", (event) => {
        if (event.currentTarget.checked) hidden.delete(String(row.dataset.stationWord));
        else hidden.add(String(row.dataset.stationWord));
        persist();
        draw();
      }, { signal });
    });
    context.root.querySelector("[data-show-all]")?.addEventListener("click", () => {
      replaceCurrentStationHidden([]);
      persist();
      draw();
    }, { signal });
    context.root.querySelector("[data-hide-all]")?.addEventListener("click", () => {
      replaceCurrentStationHidden(allWords.map((word) => word.id));
      persist();
      draw();
    }, { signal });
    context.root.querySelectorAll("[data-station-favorite]").forEach((button) => {
      button.addEventListener("click", () => button.classList.toggle("on", wordFavorites.toggle(button.dataset.stationFavorite)), { signal });
    });
    context.root.querySelectorAll("[data-station-study]").forEach((button) => {
      button.addEventListener("click", () => onStartStudy?.(button.dataset.stationStudy, activeWords()), { signal });
    });
    context.root.querySelector("[data-station-test]")?.addEventListener("click", () => onStartTest?.(activeWords()), { signal });
  }

  function wireStatistics() {
    context.root.querySelectorAll("[data-stat-favorite]").forEach((button) => {
      button.addEventListener("click", () => button.classList.toggle("on", wordFavorites.toggle(button.dataset.statFavorite)), { signal });
    });
  }

  function draw() {
    context.root.innerHTML = `<section class="view screen stationView">
      <div class="stationViewTabs" role="tablist" aria-label="Раздел станции">
        <button class="stationViewTab ${activeTab === "menu" ? "active" : ""}" type="button" role="tab" aria-selected="${activeTab === "menu"}" data-station-tab="menu">[ Меню ]</button>
        <button class="stationViewTab ${activeTab === "statistics" ? "active" : ""}" type="button" role="tab" aria-selected="${activeTab === "statistics"}" data-station-tab="statistics">[ Статистика ]</button>
      </div>
      ${activeTab === "menu" ? renderMenu() : renderStatistics()}
    </section>`;
    wireTabButtons();
    if (activeTab === "menu") wireMenu();
    else wireStatistics();
  }

  draw();
}
