import { getWords } from "../../shared/data/word-repository.js";
import { buildLearningRoute, resolveStationFromParams, stationPathParams } from "../../shared/domain/learning-route.js";
import { allStoryProgress, computedStationStatus, stationWordProgress } from "../../shared/domain/route-progress.js";
import { getRouteSettings, updateRouteSettings } from "../../shared/progress/route-settings-store.js";
import { awardWordMilestones } from "../../shared/progress/word-progress-store.js";
import { getStationSize } from "../../shared/settings/user-settings-store.js";
import { escapeHtml } from "../../shared/ui/html.js";
import { renderBracketHeading } from "../../shared/ui/bracket-heading.js";
import { createRouteScale } from "../../shared/ui/route-scale.js";
import { renderSegmentedProgress } from "../../shared/ui/segmented-progress.js";
import { getHiddenSet, learnState } from "../learn/state.js";
import { finalizeLearnSession, renderStudy } from "../learn/study.js";
import { createStationTestSession, renderStationTest } from "./station-test.js";
import { renderStationView } from "./station-view.js";

let controller = null;
let activeStudy = false;
const pendingSelections = new Map();

function activeStoryType(route, value) {
  const key = String(value || "").trim();
  return route.stories[key] ? key : route.defaultStoryType;
}

function routeParams(station, route) { return stationPathParams(route, station); }
function routeScrollKey(story, stationSize) { return `route_scroll_v2_${story}_${stationSize}`; }

function stationMilestones(summary) {
  const count = Math.floor(summary.mastered / 20);
  if (!count) return "";
  return `<span class="stationMilestones" aria-label="${count} маршрутных отметок">${Array.from({ length: Math.min(4, count) }, () => "⌃").join("")}</span>`;
}

function stationButton(station, index) {
  const status = computedStationStatus(null, station);
  const progress = stationWordProgress(station);
  const ordinal = String(index + 1).padStart(2, "0");
  return `<button
    id="station-${escapeHtml(station.key)}"
    class="stationNode ${status}"
    style="--station-progress:${progress.percent * 3.6}deg"
    type="button"
    data-station-key="${escapeHtml(station.key)}"
    aria-label="${escapeHtml(station.name)}. Освоено ${progress.mastered} из ${progress.total} слов"
  >
    <span class="stationProgressRing" aria-hidden="true"><span class="millstoneFace"><span class="stationOrdinal">${ordinal}</span></span></span>
    <span class="stationLabel">${escapeHtml(station.name)}</span>
    <span class="stationWordCount">${progress.mastered}/${progress.total}</span>
    ${stationMilestones(progress)}
  </button>`;
}

function routeGroupSection(group, stationIndex, catalogId) {
  const reversedStations = [...group.stations].reverse();
  return `<section class="routeSection" data-route-section="${escapeHtml(`${catalogId}::${group.groupId}`)}">
    <div class="routeSectionStations">${reversedStations.map((station) => stationButton(station, stationIndex.get(station.key))).join("")}</div>
    ${renderBracketHeading(group.name, { tag: "h3", className: "routeSectionHeading" })}
  </section>`;
}

function routeCatalogSection(catalog, stationIndex) {
  const reversedGroups = [...catalog.groups].reverse();
  return `<section class="routeCatalog" data-route-catalog="${escapeHtml(catalog.catalogId)}">
    <span class="routeCatalogEnd" data-catalog-end="${escapeHtml(catalog.catalogId)}" aria-hidden="true"></span>
    <div class="routeCatalogGroups">${reversedGroups.map((group) => routeGroupSection(group, stationIndex, catalog.catalogId)).join("")}</div>
    ${renderBracketHeading(catalog.name, { tag: "h2", className: "routeCatalogHeading" })}
  </section>`;
}

function nextLayoutFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function restoreMapPosition(viewport, story, stationSize) {
  if (!viewport) return;
  viewport.classList.add("isPositioning");
  const previousBehavior = viewport.style.scrollBehavior;
  viewport.style.scrollBehavior = "auto";
  try {
    await Promise.resolve(document.fonts?.ready).catch(() => {});
    await nextLayoutFrame();
    const settings = getRouteSettings();
    const key = routeScrollKey(story, stationSize);
    const hasStored = Object.prototype.hasOwnProperty.call(settings, key);
    const stored = Number(settings[key]);
    const position = () => {
      const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      const target = hasStored && Number.isFinite(stored) ? Math.max(0, Math.min(stored, maxScroll)) : maxScroll;
      viewport.scrollTop = target;
    };
    position();
    await nextLayoutFrame();
    position();
  } finally {
    viewport.style.scrollBehavior = previousBehavior;
    viewport.classList.remove("isPositioning");
  }
}

function renderRoute(context, route, activeStory) {
  const story = route.stories[activeStory];
  const progress = allStoryProgress(route)[activeStory];
  const stationIndex = new Map(story.stations.map((station, index) => [station.key, index]));
  const reversedCatalogs = [...story.catalogs].reverse();
  context.shell.setCounter("");
  context.root.innerHTML = `<section class="pathView">
    <div class="pathStickyControls">
      <div class="storyProgress">
        ${renderSegmentedProgress({ value: progress.percent, segments: 10, label: `Освоено ${progress.percent}% слов истории ${route.storyLabels[activeStory]}` })}
        <span class="pathProgressPercent">${progress.percent}%</span>
        <span class="pathProgressCount">${progress.masteredWords}/${progress.totalWords}</span>
      </div>
    </div>
    <div class="pathMapViewport isPositioning">
      <div class="routeBackdrop" aria-hidden="true"></div>
      <div class="routeMap" data-story-map="${escapeHtml(activeStory)}">${reversedCatalogs.map((catalog) => routeCatalogSection(catalog, stationIndex)).join("")}</div>
    </div>
    <nav class="routeScale" aria-label="Рубежи маршрута"></nav>
  </section>`;

  context.shell.setHeaderTabs?.({
    items: route.storyOrder.map((type) => ({ id: type, label: route.storyLabels[type] })),
    active: activeStory,
    ariaLabel: "История пути",
    onSelect(type) {
      const next = activeStoryType(route, type);
      if (next === activeStory) return;
      const viewport = context.root.querySelector(".pathMapViewport");
      updateRouteSettings({ [routeScrollKey(activeStory, route.stationSize)]: viewport?.scrollTop || 0 }, { queue: false });
      updateRouteSettings({ active_story: next });
      context.router.navigate("path.home", { storyType: next });
    },
  });

  context.root.querySelectorAll("[data-station-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const station = route.byKey.get(button.dataset.stationKey);
      if (!station) return;
      const viewport = context.root.querySelector(".pathMapViewport");
      updateRouteSettings({ [routeScrollKey(activeStory, route.stationSize)]: viewport?.scrollTop || 0 }, { queue: false });
      context.router.navigate("path.station", routeParams(station, route));
    }, { signal: controller.signal });
  });

  const viewport = context.root.querySelector(".pathMapViewport");
  createRouteScale({ root: context.root, viewport, catalogs: reversedCatalogs, signal: controller.signal });
  let mapPositionReady = false;
  void restoreMapPosition(viewport, activeStory, route.stationSize).then(() => {
    mapPositionReady = true;
  });
  let saveFrame = 0;
  viewport?.addEventListener("scroll", () => {
    if (!mapPositionReady) return;
    if (saveFrame) return;
    saveFrame = requestAnimationFrame(() => {
      saveFrame = 0;
      updateRouteSettings({ [routeScrollKey(activeStory, route.stationSize)]: viewport.scrollTop }, { queue: false });
    });
  }, { signal: controller.signal, passive: true });
}

function selectedWordsForStation(station) {
  const pending = pendingSelections.get(station.key);
  if (Array.isArray(pending) && pending.length) return pending;
  const hidden = getHiddenSet(station.dictionaryId, station.groupId, station.selectionSetId || station.setId || station.key);
  const active = station.words.filter((word) => !hidden.has(word.id));
  return active.length ? active : station.words;
}

function renderStation(context, route, station) {
  renderStationView(context, station, {
    signal: controller.signal,
    onStartStudy(mode, words) {
      pendingSelections.set(station.key, words);
      context.router.navigate("path.study", { ...routeParams(station, route), mode });
    },
    onStartTest(mode, words) {
      pendingSelections.set(station.key, words);
      context.router.navigate("path.test", { ...routeParams(station, route), mode });
    },
  });
}

function masteryLabel(level) {
  if (level === 3) return "III знак вершины";
  if (level === 2) return "II маршрутный знак";
  if (level === 1) return "I маршрутный знак";
  return "Тест не сдан";
}

function renderResult(context, route, station, result, allWords) {
  if (result.passed) awardWordMilestones(allWords);
  const message = result.passed ? masteryLabel(result.masteryLevel) : `Нужно не менее ${result.required}%`;
  context.shell.setHeaderContent?.({ title: "Результат теста", subtitle: station.name, logo: true, brand: false });
  context.root.innerHTML = `<section class="view screen stationResultView">
    <div class="stationResult">
      <div class="stationResultMark" aria-hidden="true">${result.masteryLevel ? "⌃".repeat(result.masteryLevel) : "—"}</div>
      <div class="stationResultScore">${result.payload.accuracy}%</div>
      <div class="stationResultText">${escapeHtml(message)}<br>${result.payload.correct_total}/${result.payload.questions_total}</div>
      <div class="stationActions">
        <button class="btn primary" type="button" data-result-return>К станции</button>
        ${result.passed ? "" : `<button class="btn secondary" type="button" data-result-repeat>Повторить</button>`}
      </div>
    </div>
  </section>`;
  context.root.querySelector("[data-result-return]")?.addEventListener("click", () => context.router.replace("path.station", routeParams(station, route), { force: true }), { signal: controller.signal });
  context.root.querySelector("[data-result-repeat]")?.addEventListener("click", () => {
    const mode = result.payload.direction === "ru_to_alan" ? "ru" : "kb";
    const session = createStationTestSession(station, allWords, selectedWordsForStation(station), mode);
    renderStationTest(context, session, { onComplete: (next) => renderResult(context, route, station, next, allWords) });
  }, { signal: controller.signal });
}

export async function mount(context, params = {}) {
  controller = new AbortController();
  const words = await getWords();
  const route = buildLearningRoute(words, { stationSize: getStationSize() });
  const screen = params.screen || "home";
  const activeStory = activeStoryType(route, params.storyType || getRouteSettings().active_story);
  updateRouteSettings({ active_story: activeStory }, { queue: false });

  if (screen === "home") {
    if (String(params.storyType || "") !== activeStory) context.router.canonicalize?.("path.home", { storyType: activeStory });
    renderRoute(context, route, activeStory);
    return;
  }
  const station = resolveStationFromParams(route, { ...params, storyType: activeStory });
  if (!station) {
    context.router.canonicalize?.("path.home", { storyType: activeStory });
    renderRoute(context, route, activeStory);
    return;
  }

  if (screen === "station") { renderStation(context, route, station); return; }

  if (screen === "study") {
    activeStudy = true;
    const selectedWords = selectedWordsForStation(station);
    learnState.currentDict = station.dictionaryId;
    learnState.currentSection = station.groupId;
    learnState.currentSet = station.selectionSetId || station.setId || station.key;
    context.shell.setHeaderContent?.({ title: "Учить слова", subtitle: station.name, logo: true, brand: false });
    renderStudy(context, words, controller.signal, {
      mode: params.mode || learnState.currentStudyMode || "kb",
      wordsOverride: selectedWords,
      stationContext: { key: station.key, wordIds: selectedWords.map((word) => word.id), ...routeParams(station, route) },
      onComplete() {
        activeStudy = false;
        pendingSelections.delete(station.key);
        context.router.replace("path.station", routeParams(station, route), { force: true });
      },
    });
    return;
  }

  if (screen === "test") {
    const allWords = route.storyOrder.flatMap((type) => route.stories[type].stations).flatMap((item) => item.words);
    const session = createStationTestSession(station, allWords, selectedWordsForStation(station), params.mode || "kb");
    renderStationTest(context, session, { onComplete: (result) => renderResult(context, route, station, result, allWords) });
  }
}

export function canLeave() { return !activeStudy || !learnState.studySession.inProgress; }
export function onLeave(reason = "route_change") {
  if (activeStudy && learnState.studySession.inProgress) finalizeLearnSession("interrupted", reason);
  activeStudy = false;
}
export function unmount() { controller?.abort(); controller = null; }
