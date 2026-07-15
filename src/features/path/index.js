import { PATH_CONFIG } from "../../config/path.js";
import { getWords } from "../../shared/data/word-repository.js";
import { buildLearningRoute, resolveStationFromParams, stationPathParams } from "../../shared/domain/learning-route.js";
import { allStoryProgress, computedStationStatus } from "../../shared/domain/route-progress.js";
import { getStationProgress, markStationCardsCompleted, markStationStarted } from "../../shared/progress/station-progress-store.js";
import { getRouteSettings, updateRouteSettings } from "../../shared/progress/route-settings-store.js";
import { awardReward } from "../../shared/progress/reward-store.js";
import { escapeHtml } from "../../shared/ui/html.js";
import { renderBracketHeading } from "../../shared/ui/bracket-heading.js";
import { createRouteScale } from "../../shared/ui/route-scale.js";
import { renderSegmentedProgress } from "../../shared/ui/segmented-progress.js";
import { renderSetPreparation } from "../learn/set-preparation.js";
import { learnState } from "../learn/state.js";
import { finalizeLearnSession, renderStudy } from "../learn/study.js";
import { createStationTestSession, renderStationTest } from "./station-test.js";

let controller = null;
let activeStudy = false;

function storyType(value) {
  return PATH_CONFIG.storyOrder.includes(value) ? value : PATH_CONFIG.defaultStoryType;
}

function routeParams(station, route) {
  return stationPathParams(route, station);
}

function stateLabel(status) {
  const labels = {
    locked: "Закрыто",
    available: "Доступно",
    studying: "В процессе",
    test_ready: "Доступен тест",
    review_1_waiting: "Ожидает повторения",
    review_1_due: "Доступно повторение",
    review_2_waiting: "Ожидает повторения",
    review_2_due: "Доступно повторение",
    mastered: "Освоено",
  };
  return labels[status] || "";
}

function stationButton(station, route, index) {
  const status = computedStationStatus(route, station);
  const ordinal = String(index + 1).padStart(2, "0");
  return `
    <button
      id="station-${escapeHtml(station.key)}"
      class="stationNode ${status}"
      type="button"
      data-station-key="${escapeHtml(station.key)}"
      ${status === "locked" ? "disabled" : ""}
      aria-label="${escapeHtml(station.name)}. ${escapeHtml(stateLabel(status))}"
    >
      <span class="millstoneFace" aria-hidden="true"><span class="stationOrdinal">${ordinal}</span></span>
      <span class="stationLabel">${escapeHtml(station.name)}</span>
    </button>`;
}

function routeScrollKey(story) {
  return `route_scroll_${story}`;
}

function catalogSection(catalog, route, stationIndex) {
  const stations = catalog.groups.flatMap((group) => group.stations);
  return `<section class="routeCatalog" data-route-catalog="${escapeHtml(catalog.catalogId)}">
    ${renderBracketHeading(catalog.name, { tag: "h2", className: "routeCatalogHeading" })}
    <div class="routeCatalogStations">
      ${stations.map((station) => stationButton(station, route, stationIndex.get(station.key))).join("")}
    </div>
  </section>`;
}

function renderRoute(context, route, activeStory) {
  const story = route.stories[activeStory];
  const progress = allStoryProgress(route)[activeStory];
  const stationIndex = new Map(story.stations.map((station, index) => [station.key, index]));
  const reversedCatalogs = [...story.catalogs].reverse();

  context.shell.setCounter("");
  context.root.innerHTML = `
    <section class="pathView">
      <div class="pathStickyControls">
        <div class="storyTabs" role="tablist" aria-label="Ветка пути">
          ${PATH_CONFIG.storyOrder.map((type) => `<button class="storyTab ${type === activeStory ? "active" : ""}" type="button" role="tab" aria-selected="${type === activeStory}" data-story="${type}">${escapeHtml(PATH_CONFIG.storyLabels[type])}</button>`).join("")}
        </div>
        <div class="storyProgress">
          ${renderSegmentedProgress({ value: progress.percent, segments: 10, label: `Прогресс ${PATH_CONFIG.storyLabels[activeStory]}` })}
          <span class="pathProgressPercent">${progress.percent}%</span>
          <span class="pathProgressCount">${progress.masteredStations}/${progress.totalStations}</span>
        </div>
      </div>
      <div class="pathMapViewport">
        <div class="routeBackdrop" aria-hidden="true"></div>
        <div class="routeMap" data-story-map="${activeStory}">
          ${reversedCatalogs.map((catalog) => catalogSection(catalog, route, stationIndex)).join("")}
        </div>
      </div>
      <nav class="routeScale" aria-label="Рубежи маршрута"></nav>
    </section>`;

  context.root.querySelectorAll("[data-story]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = storyType(button.dataset.story);
      const viewport = context.root.querySelector(".pathMapViewport");
      updateRouteSettings({ [routeScrollKey(activeStory)]: viewport?.scrollTop || 0 }, { queue: false });
      updateRouteSettings({ active_story: next });
      context.router.navigate("path.home", { storyType: next });
    }, { signal: controller.signal });
  });

  context.root.querySelectorAll("[data-station-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const station = route.byKey.get(button.dataset.stationKey);
      if (!station || computedStationStatus(route, station) === "locked") return;
      const viewport = context.root.querySelector(".pathMapViewport");
      updateRouteSettings({ [routeScrollKey(activeStory)]: viewport?.scrollTop || 0 }, { queue: false });
      context.router.navigate("path.station", routeParams(station, route));
    }, { signal: controller.signal });
  });

  const viewport = context.root.querySelector(".pathMapViewport");
  createRouteScale({ root: context.root, viewport, catalogs: reversedCatalogs, signal: controller.signal });
  requestAnimationFrame(() => {
    const settings = getRouteSettings();
    const stored = Number(settings[routeScrollKey(activeStory)]);
    viewport.scrollTop = Number.isFinite(stored) && stored > 0 ? Math.min(stored, viewport.scrollHeight) : viewport.scrollHeight;
  });
  viewport?.addEventListener("scroll", () => {
    updateRouteSettings({ [routeScrollKey(activeStory)]: viewport.scrollTop }, { queue: false });
  }, { signal: controller.signal, passive: true });
}

function groupLabel(route, station) {
  const group = route.stories[station.storyType]?.groups.find((item) => item.catalogId === station.catalogId && item.groupId === station.groupId);
  return group?.name || station.groupId;
}

function stationTestLabel(status) {
  if (status === "review_1_due") return "Первое повторение";
  if (status === "review_2_due") return "Финальное повторение";
  if (status === "mastered") return "Повторить тест";
  return "Пройти тест";
}

function renderStation(context, route, station) {
  const status = computedStationStatus(route, station);
  const canStudy = ["available", "studying", "test_ready", "mastered"].includes(status);
  const canTest = ["test_ready", "review_1_due", "review_2_due", "mastered"].includes(status);

  renderSetPreparation(context, {
    title: station.name,
    subtitle: groupLabel(route, station),
    words: station.words,
    dictionaryId: station.catalogId,
    sectionId: station.groupId,
    setId: station.setId,
    signal: controller.signal,
    canStudy,
    canTest,
    testLabel: stationTestLabel(status),
    onStart(mode) {
      markStationStarted(station);
      context.router.navigate("path.study", { ...routeParams(station, route), mode });
    },
    onTest() {
      context.router.navigate("path.test", routeParams(station, route));
    },
  });
}

function maybeAwardCompletedGroup(route, station) {
  const group = route.stories[station.storyType]?.groups.find((item) => item.catalogId === station.catalogId && item.groupId === station.groupId);
  if (!group || !group.stations.every((item) => computedStationStatus(route, item) === "mastered")) return;
  awardReward({
    rewardId: `achievement:group:${station.catalogId}:${station.groupId}`,
    groupId: station.groupId,
    catalogId: station.catalogId,
  });
}

function renderResult(context, route, station, result) {
  const nextStatus = computedStationStatus(route, station);
  if (nextStatus === "mastered") maybeAwardCompletedGroup(route, station);
  const message = result.passed
    ? result.phase === "review_2" ? "Станция освоена" : "Этап подтверждён"
    : `Нужно не менее ${result.required}%`;

  context.root.innerHTML = `
    <section class="view screen stationResultView">
      <div class="stationResult">
        <div class="stationResultScore">${result.payload.accuracy}%</div>
        <div class="stationResultText">${escapeHtml(message)}<br>${result.payload.correct_total}/${result.payload.questions_total}</div>
        <div class="stationActions">
          <button class="btn primary" type="button" data-result-return>К станции</button>
          ${result.passed ? "" : `<button class="btn secondary" type="button" data-result-repeat>Повторить</button>`}
        </div>
      </div>
    </section>`;

  context.root.querySelector("[data-result-return]")?.addEventListener("click", () => {
    context.router.replace("path.station", routeParams(station, route), { force: true });
  }, { signal: controller.signal });

  context.root.querySelector("[data-result-repeat]")?.addEventListener("click", () => {
    const session = createStationTestSession(station, Object.values(route.stories).flatMap((story) => story.stations).flatMap((item) => item.words));
    renderStationTest(context, session, { onComplete: (nextResult) => renderResult(context, route, station, nextResult) });
  }, { signal: controller.signal });
}

export async function mount(context, params = {}) {
  controller = new AbortController();
  const words = await getWords();
  const route = buildLearningRoute(words);
  const screen = params.screen || "home";
  const activeStory = storyType(params.storyType || getRouteSettings().active_story);
  updateRouteSettings({ active_story: activeStory }, { queue: false });

  if (screen === "home") {
    renderRoute(context, route, activeStory);
    return;
  }

  const station = resolveStationFromParams(route, { ...params, storyType: activeStory });
  if (!station) {
    context.router.replace("path.home", { storyType: activeStory }, { force: true });
    return;
  }

  if (screen === "station") {
    renderStation(context, route, station);
    return;
  }

  if (screen === "study") {
    const status = computedStationStatus(route, station);
    if (status === "locked") {
      context.router.replace("path.station", routeParams(station, route), { force: true });
      return;
    }
    activeStudy = true;
    learnState.currentDict = station.catalogId;
    learnState.currentSection = station.groupId;
    learnState.currentSet = station.setId;
    renderStudy(context, words, controller.signal, {
      mode: params.mode || learnState.currentStudyMode || "kb",
      stationContext: { key: station.key, ...routeParams(station, route) },
      onComplete() {
        activeStudy = false;
        markStationCardsCompleted(station);
        context.router.replace("path.station", routeParams(station, route), { force: true });
      },
    });
    return;
  }

  if (screen === "test") {
    const status = computedStationStatus(route, station);
    if (!["test_ready", "review_1_due", "review_2_due", "mastered"].includes(status)) {
      context.router.replace("path.station", routeParams(station, route), { force: true });
      return;
    }
    const allWords = Object.values(route.stories).flatMap((story) => story.stations).flatMap((item) => item.words);
    const session = createStationTestSession(station, allWords);
    renderStationTest(context, session, {
      onComplete(result) { renderResult(context, route, station, result); },
    });
  }
}

export function canLeave() {
  return !activeStudy || !learnState.studySession.inProgress;
}

export function onLeave(reason = "route_change") {
  if (activeStudy && learnState.studySession.inProgress) finalizeLearnSession("interrupted", reason);
  activeStudy = false;
}

export function unmount() {
  controller?.abort();
  controller = null;
}
