import { msg } from "../../shared/i18n/index.js?v=16.8.0.3";
import { wordFavorites } from "../../shared/state/word-favorites.js?v=16.8.0.3";
import { escapeHtml } from "../../shared/ui/html.js?v=16.8.0.3";
import { bindOverflowMarquees, renderOverflowMarquee } from "../../shared/ui/overflow-marquee.js?v=16.8.0.3";
import { renderStarButton } from "../../shared/ui/word-renderers.js?v=16.8.0.3";
import { bindStationStatistics, renderStationStatistics } from "./station-statistics.js?v=16.8.0.3";
import { getHiddenSet, setHiddenSet } from "../learn/state.js?v=16.8.0.3";

function storageKey(station) {
  return station.selectionSetId || station.setId || station.key;
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
  let stopMarquees = () => {};

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
    return renderOverflowMarquee(value, {
      clipClass: `${className} stationTextClip`,
      trackClass: "stationMarquee",
    });
  }

  function staticLine(value, className) {
    const text = String(value || "");
    return `<span class="${className} stationTextClip stationStaticText" title="${escapeHtml(text)}">${escapeHtml(text)}</span>`;
  }

  function wireVisibleMarquees() {
    stopMarquees();
    stopMarquees = bindOverflowMarquees(context.root, {
      signal,
      scrollRoot: context.root.querySelector(".stationWordList"),
    });
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
          <button class="textAction" type="button" data-show-all>${msg("stage.pokazat_vse")}</button>
          <span aria-hidden="true">·</span>
          <button class="textAction" type="button" data-hide-all>${msg("stage.skryt_vse")}</button>
        </span>
        <span class="stationSelectionCount">${selected.length}/${allWords.length}</span>
      </div>
      <div class="contentList stationWordList">
        ${allWords.map((word) => `<div class="contentListRow stationWordRow" data-station-word="${escapeHtml(word.id)}">
          <label class="stationWordToggle bracketCheckbox">
            <input class="contentListCheckbox" type="checkbox" ${hidden.has(String(word.id)) ? "" : "checked"} aria-label="${msg("stage.dobavit_slovo_v_obuchenie")}" />
            <span class="bracketCheckboxMark" aria-hidden="true"></span>
          </label>
          <span class="contentListMain"><span data-station-line>${staticLine(word.word, "contentListPrimary")}</span><span data-station-line>${scrollingLine(word.trans, "contentListSecondary")}</span></span>
          ${renderStarButton(word.id, `data-station-favorite="${escapeHtml(word.id)}"`)}
        </div>`).join("")}
      </div>
      <footer class="stationLaunchPanel">
        <div class="stationDirectionControl">
          <span>${msg("stage.napravlenie")}</span>
          <div class="segmentControl stationDirectionToggle" role="radiogroup" aria-label="${msg("stage.napravlenie_obucheniya")}">
            <button class="segmentOption ${studyMode === "kb" ? "active" : ""}" type="button" role="radio" aria-checked="${studyMode === "kb"}" data-station-mode="kb">${msg("stage.alan_rus")}</button>
            <button class="segmentOption ${studyMode === "ru" ? "active" : ""}" type="button" role="radio" aria-checked="${studyMode === "ru"}" data-station-mode="ru">${msg("stage.rus_alan")}</button>
          </div>
        </div>
        <div class="stationLaunchActions">
          <button class="btn stationStudyButton" type="button" data-station-study ${selected.length ? "" : "disabled"}>${msg("stage.uchit_slova")}</button>
          <button class="btn actionPrimary stationTestButton" type="button" data-station-test>${msg("stage.zavershit_etap_test")}</button>
        </div>
      </footer>
    </section>`;
  }

  function renderStatistics() {
    return renderStationStatistics(station);
  }

  function wireMenu() {
    const list = context.root.querySelector(".stationWordList");
    if (list) list.scrollTop = menuScrollTop;

    function updateSelectionState() {
      const selectedCount = activeWords().length;
      const count = context.root.querySelector(".stationSelectionCount");
      if (count) count.textContent = `${selectedCount}/${allWords.length}`;
      const studyButton = context.root.querySelector("[data-station-study]");
      if (studyButton) studyButton.disabled = selectedCount === 0;
    }

    list?.querySelectorAll("[data-station-word]").forEach((row) => {
      row.querySelector("input")?.addEventListener("change", (event) => {
        if (event.currentTarget.checked) hidden.delete(String(row.dataset.stationWord));
        else hidden.add(String(row.dataset.stationWord));
        persist();
        updateSelectionState();
      }, { signal });
    });
    context.root.querySelector("[data-show-all]")?.addEventListener("click", () => {
      if (list) menuScrollTop = list.scrollTop;
      replaceCurrentStationHidden([]);
      persist();
      draw();
    }, { signal });
    context.root.querySelector("[data-hide-all]")?.addEventListener("click", () => {
      if (list) menuScrollTop = list.scrollTop;
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
    context.root.querySelector("[data-station-test]")?.addEventListener("click", () => onStartTest?.(studyMode), { signal });
    wireVisibleMarquees();
  }

  function wireStatistics() {
    bindStationStatistics(context, station, { signal });
  }

  function draw() {
    stopMarquees();
    stopMarquees = () => {};
    context.shell.appShell.dataset.stationPane = activeTab;
    context.root.innerHTML = `<section class="view screen stationView">
      <div class="stationViewTabs" role="tablist" aria-label="${msg("stage.razdel_etapa")}">
        <button class="tabAction stationViewTab ${activeTab === "menu" ? "active" : ""}" type="button" role="tab" aria-selected="${activeTab === "menu"}" data-station-tab="menu">${msg("stage.menyu")}</button>
        <button class="tabAction stationViewTab ${activeTab === "statistics" ? "active" : ""}" type="button" role="tab" aria-selected="${activeTab === "statistics"}" data-station-tab="statistics">${msg("stage.statistika")}</button>
      </div>
      ${activeTab === "menu" ? renderMenu() : renderStatistics()}
    </section>`;
    wireTabButtons();
    if (activeTab === "menu") wireMenu();
    else wireStatistics();
  }

  draw();
}
