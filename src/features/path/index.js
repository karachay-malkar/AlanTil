import { PATH_CONFIG } from "../../config/path.js";
import { getWords } from "../../shared/data/word-repository.js";
import { buildLearningRoute, resolveStationFromParams, stationPathParams } from "../../shared/domain/learning-route.js";
import { allStoryProgress, computedStationStatus } from "../../shared/domain/route-progress.js";
import { getStationProgress, markStationCardsCompleted, markStationStarted } from "../../shared/progress/station-progress-store.js";
import { getRouteSettings, updateRouteSettings } from "../../shared/progress/route-settings-store.js";
import { awardReward } from "../../shared/progress/reward-store.js";
import { escapeHtml } from "../../shared/ui/html.js";
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

function progressGauge(value) {
  const percent = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const total = 14;
  const filled = Math.round((percent / 100) * total);
  const bar = `${"—".repeat(filled)}${" ".repeat(total - filled)}`;
  return `<span class="pathProgressGauge" aria-label="${percent}%">[${bar}]</span><span class="pathProgressPercent">${percent}%</span>`;
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

function renderRoute(context, route, activeStory) {
  const story = route.stories[activeStory];
  const progress = allStoryProgress(route)[activeStory];
  const stationIndex = new Map(story.stations.map((station, index) => [station.key, index]));

  context.shell.setCounter("");
  context.root.innerHTML = `
    <section class="pathView">
      <div class="pathStickyControls">
        <div class="storyTabs" role="tablist" aria-label="Ветка пути">
          ${PATH_CONFIG.storyOrder.map((type) => `
            <button
              class="storyTab ${type === activeStory ? "active" : ""}"
              type="button"
              role="tab"
              aria-selected="${type === activeStory ? "true" : "false"}"
              data-story="${type}"
            >${type === activeStory ? `<span aria-hidden="true">[</span>` : ""}${escapeHtml(PATH_CONFIG.storyLabels[type])}${type === activeStory ? `<span aria-hidden="true">]</span>` : ""}</button>`).join("")}
        </div>
        <div class="storyProgress">${progressGauge(progress.percent)}<span class="pathProgressCount">${progress.masteredStations}/${progress.totalStations}</span></div>
      </div>

      <div class="pathMapViewport">
        <div class="routeBackdrop" aria-hidden="true"></div>
        <div class="routeMap" data-story-map="${activeStory}">
          ${story.catalogs.map((catalog) => `
            <div class="routeCatalog">
              ${catalog.groups.map((group) => {
                const complete = group.stations.every((station) => computedStationStatus(route, station) === "mastered");
                return `<section class="routeGroup" data-group-key="${escapeHtml(`${catalog.catalogId}::${group.groupId}`)}">
                  <div class="milestoneNode ${complete ? "complete" : ""}"><span>[ ${escapeHtml(group.name)} ]</span></div>
                  ${group.stations.map((station) => stationButton(station, route, stationIndex.get(station.key))).join("")}
                </section>`;
              }).join("")}
            </div>`).join("")}
        </div>
      </div>

      <nav class="routeNavigator" aria-label="Позиция на маршруте">
        ${story.groups.flatMap((group) => [
          `<button class="navDot group ${group.stations.every((station) => computedStationStatus(route, station) === "mastered") ? "mastered" : ""}" type="button" data-scroll-group="${escapeHtml(`${group.catalogId}::${group.groupId}`)}" aria-label="${escapeHtml(group.name)}"></button>`,
          ...group.stations.map((station) => {
            const status = computedStationStatus(route, station);
            return `<button class="navDot ${status}" type="button" data-scroll-station="${escapeHtml(station.key)}" aria-label="${escapeHtml(station.name)}"></button>`;
          }),
        ]).join("")}
      </nav>
    </section>`;

  context.root.querySelectorAll("[data-story]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = storyType(button.dataset.story);
      updateRouteSettings({ active_story: next });
      context.router.navigate("path.home", { storyType: next });
    }, { signal: controller.signal });
  });

  context.root.querySelectorAll("[data-station-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const station = route.byKey.get(button.dataset.stationKey);
      if (!station || computedStationStatus(route, station) === "locked") return;
      context.router.navigate("path.station", routeParams(station, route));
    }, { signal: controller.signal });
  });

  const mapViewport = context.root.querySelector(".pathMapViewport");

  context.root.querySelectorAll("[data-scroll-station]").forEach((button) => {
    button.addEventListener("click", () => {
      context.root.querySelector(`[data-station-key="${CSS.escape(button.dataset.scrollStation)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, { signal: controller.signal });
  });

  context.root.querySelectorAll("[data-scroll-group]").forEach((button) => {
    button.addEventListener("click", () => {
      context.root.querySelector(`[data-group-key="${CSS.escape(button.dataset.scrollGroup)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, { signal: controller.signal });
  });

  if ("IntersectionObserver" in window && mapViewport) {
    const stationObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (!visible) return;
      context.root.querySelectorAll(".navDot.current").forEach((dot) => dot.classList.remove("current"));
      context.root.querySelector(`[data-scroll-station="${CSS.escape(visible.target.dataset.stationKey)}"]`)?.classList.add("current");
    }, { root: mapViewport, rootMargin: "-34% 0px -34% 0px", threshold: [0.2, 0.55] });

    context.root.querySelectorAll("[data-station-key]").forEach((station) => stationObserver.observe(station));
    controller.signal.addEventListener("abort", () => stationObserver.disconnect(), { once: true });
  }
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
