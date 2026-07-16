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
  let studyMode = "kb";
  let marqueeObserver = null;

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

  function scrollingLine(value, className) {
    const text = String(value || "");
    return `<span class="${className} stationTextClip" title="${escapeHtml(text)}"><span class="stationMarquee" data-station-marquee>${escapeHtml(text)}</span></span>`;
  }

  function wireVisibleMarquees() {
    marqueeObserver?.disconnect();
    marqueeObserver = null;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    const list = context.root.querySelector(".stationWordList");
    const tracks = Array.from(context.root.querySelectorAll("[data-station-marquee]"));
    requestAnimationFrame(() => {
      tracks.forEach((track) => {
        if (!track.isConnected) return;
        const clip = track.parentElement;
        const distance = Math.ceil(track.scrollWidth - clip.clientWidth);
        track.classList.toggle("isOverflowing", distance > 2);
        if (distance > 2) {
          track.style.setProperty("--marquee-distance", `${distance}px`);
          track.style.setProperty("--marquee-duration", `${Math.min(14, Math.max(7, distance / 28 + 5)).toFixed(1)}s`);
        }
      });
    });
    if (!list || typeof IntersectionObserver !== "function") return;
    marqueeObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const track = entry.target.querySelector("[data-station-marquee]");
        if (!track) return;
        track.classList.toggle("isMarqueeVisible", entry.isIntersecting && entry.intersectionRatio > 0.35);
      });
    }, { root: list, threshold: [0, 0.35, 0.75] });
    context.root.querySelectorAll("[data-station-line]").forEach((line) => marqueeObserver.observe(line));
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
        <span class="stationMenuActions">
          <button class="textAction" type="button" data-show-all>Показать все</button>
          <span aria-hidden="true">·</span>
          <button class="textAction" type="button" data-hide-all>Скрыть все</button>
        </span>
        <span class="stationSelectionCount">${selected.length}/${allWords.length}</span>
      </div>
      <div class="contentList stationWordList">
        ${allWords.map((word) => `<div class="contentListRow stationWordRow" data-station-word="${escapeHtml(word.id)}">
          <label class="stationWordToggle">
            <input class="contentListCheckbox" type="checkbox" ${hidden.has(String(word.id)) ? "" : "checked"} aria-label="Добавить слово в обучение" />
          </label>
          <span class="contentListMain"><span data-station-line>${scrollingLine(word.word, "contentListPrimary")}</span><span data-station-line>${scrollingLine(word.trans, "contentListSecondary")}</span></span>
          ${renderStarButton(word.id, `data-station-favorite="${escapeHtml(word.id)}"`)}
        </div>`).join("")}
      </div>
      <footer class="stationLaunchPanel">
        <div class="stationDirectionControl">
          <span>Направление</span>
          <div class="stationDirectionToggle" role="radiogroup" aria-label="Направление обучения">
            <button class="${studyMode === "kb" ? "active" : ""}" type="button" role="radio" aria-checked="${studyMode === "kb"}" data-station-mode="kb">АЛАН → РУС</button>
            <button class="${studyMode === "ru" ? "active" : ""}" type="button" role="radio" aria-checked="${studyMode === "ru"}" data-station-mode="ru">РУС → АЛАН</button>
          </div>
        </div>
        <div class="stationLaunchActions">
          <button class="btn neutral stationStudyButton" type="button" data-station-study ${selected.length ? "" : "disabled"}>Учить слова</button>
          <button class="btn secondary stationTestButton" type="button" data-station-test ${selected.length ? "" : "disabled"}>Проверить знания</button>
        </div>
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
    context.root.querySelectorAll("[data-station-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        studyMode = button.dataset.stationMode === "ru" ? "ru" : "kb";
        context.root.querySelectorAll("[data-station-mode]").forEach((item) => {
          const active = item.dataset.stationMode === studyMode;
          item.classList.toggle("active", active);
          item.setAttribute("aria-checked", String(active));
        });
      }, { signal });
    });
    context.root.querySelector("[data-station-study]")?.addEventListener("click", () => onStartStudy?.(studyMode, activeWords()), { signal });
    context.root.querySelector("[data-station-test]")?.addEventListener("click", () => onStartTest?.(studyMode, activeWords()), { signal });
    wireVisibleMarquees();
  }

  function wireStatistics() {
    context.root.querySelectorAll("[data-stat-favorite]").forEach((button) => {
      button.addEventListener("click", () => button.classList.toggle("on", wordFavorites.toggle(button.dataset.statFavorite)), { signal });
    });
  }

  function draw() {
    marqueeObserver?.disconnect();
    marqueeObserver = null;
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
