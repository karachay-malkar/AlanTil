import { PATH_CONFIG } from "../../config/path.js";
import { getWords } from "../../shared/data/word-repository.js";
import { buildLearningRoute, resolveStationFromParams, stationPathParams } from "../../shared/domain/learning-route.js";
import { allStoryProgress, computedStationStatus } from "../../shared/domain/route-progress.js";
import { formatDueDate, getStationProgress, markStationCardsCompleted, markStationStarted } from "../../shared/progress/station-progress-store.js";
import { getRouteSettings, updateRouteSettings } from "../../shared/progress/route-settings-store.js";
import { awardReward } from "../../shared/progress/reward-store.js";
import { escapeHtml } from "../../shared/ui/html.js";
import { learnState } from "../learn/state.js";
import { finalizeLearnSession, renderStudy } from "../learn/study.js";
import { createStationTestSession, renderStationTest } from "./station-test.js";

let controller = null;
let activeStudy = false;

function storyType(value) {
  return PATH_CONFIG.storyOrder.includes(value) ? value : "ascent";
}

function segmentedBar(value) {
  const filled = Math.round(Math.max(0, Math.min(100, value)) / 10);
  return `<div class="segmentedBar" aria-label="${value}%">${Array.from({ length: 10 }, (_, index) => `<span class="${index < filled ? "on" : ""}"></span>`).join("")}</div>`;
}

function stateLabel(status, row) {
  const labels = {
    locked: "Станция закрыта",
    available: "Можно начать",
    studying: "Карточки изучаются",
    test_ready: "Карточки завершены — требуется тест",
    review_1_waiting: `Первое повторение откроется ${formatDueDate(row?.review_1_due_at)}`,
    review_1_due: "Доступно первое повторение",
    review_2_waiting: `Финальное повторение откроется ${formatDueDate(row?.review_2_due_at)}`,
    review_2_due: "Доступно финальное повторение",
    mastered: "Станция освоена",
  };
  return labels[status] || status;
}

function routeParams(station, route) {
  return stationPathParams(route, station);
}

function stationButton(station, route, index) {
  const status = computedStationStatus(route, station);
  const ordinal = String(index + 1).padStart(2, "0");
  return `
    <button id="station-${escapeHtml(station.key)}" class="stationNode ${status}" type="button" data-station-key="${escapeHtml(station.key)}" ${status === "locked" ? "disabled" : ""} aria-label="${escapeHtml(station.name)}: ${escapeHtml(stateLabel(status, getStationProgress(station)))}">
      ${ordinal}
      <span class="stationLabel">${escapeHtml(station.name)}</span>
    </button>`;
}

function renderRoute(context, route, activeStory) {
  const story = route.stories[activeStory];
  const progress = allStoryProgress(route)[activeStory];
  const meta = activeStory === "trails"
    ? `${progress.completedCatalogs} тематических пути · ${progress.completedGroups}/${progress.totalGroups} рубежей`
    : `${progress.masteredStations} / ${progress.totalStations} станций`;
  const stationIndex = new Map(story.stations.map((station, index) => [station.key, index]));

  context.shell.setCounter("");
  context.root.innerHTML = `
    <section class="pathView">
      <div class="routeBackdrop" aria-hidden="true">
        ${Array.from({ length: 8 }, (_, index) => `<div class="routeBackdropSegment" data-bg-segment="${index + 1}"></div>`).join("")}
      </div>
      <header class="pathHeader">
        <div class="storyTabs" role="tablist">
          ${PATH_CONFIG.storyOrder.map((type) => `<button class="storyTab ${type === activeStory ? "active" : ""}" type="button" data-story="${type}">${escapeHtml(PATH_CONFIG.storyLabels[type])}</button>`).join("")}
        </div>
        <div class="storyProgress">
          <div class="storyProgressLine"><span>${escapeHtml(PATH_CONFIG.storyLabels[activeStory])}</span><span>${progress.percent}%</span></div>
          ${segmentedBar(progress.percent)}
          <div class="storyProgressMeta">${escapeHtml(meta)}</div>
        </div>
      </header>
      <div class="routeMap" data-story-map="${activeStory}">
        ${story.catalogs.map((catalog) => `
          <div class="routeCatalog">
            ${activeStory === "trails" ? `<div class="trailCatalogTitle">${escapeHtml(catalog.name)}</div>` : ""}
            ${catalog.groups.map((group, groupIndex) => {
              const complete = group.stations.every((station) => computedStationStatus(route, station) === "mastered");
              return `<section class="routeGroup" data-group-key="${escapeHtml(`${catalog.catalogId}::${group.groupId}`)}">
                ${group.stations.map((station) => stationButton(station, route, stationIndex.get(station.key))).join("")}
                <div class="milestoneNode ${complete ? "complete" : ""}">
                  <div class="milestoneType">[ ВЕХА ${String(groupIndex + 1).padStart(2, "0")} ]</div>
                  <div class="milestoneName">${escapeHtml(group.name)}</div>
                </div>
              </section>`;
            }).join("")}
          </div>`).join("") || `<div class="stonePanel">В этой истории пока нет станций в базе.</div>`}
      </div>
      <nav class="routeNavigator" aria-label="Навигатор истории">
        ${story.groups.flatMap((group) => [
          ...group.stations.map((station) => {
            const status = computedStationStatus(route, station);
            return `<button class="navDot ${status}" type="button" data-scroll-station="${escapeHtml(station.key)}" aria-label="${escapeHtml(station.name)}"></button>`;
          }),
          `<button class="navDot group ${group.stations.every((station) => computedStationStatus(route, station) === "mastered") ? "mastered" : ""}" type="button" data-scroll-group="${escapeHtml(`${group.catalogId}::${group.groupId}`)}" aria-label="${escapeHtml(group.name)}"></button>`,
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
  context.root.querySelectorAll("[data-scroll-station]").forEach((button) => {
    button.addEventListener("click", () => {
      const station = context.root.querySelector(`[data-station-key="${CSS.escape(button.dataset.scrollStation)}"]`);
      station?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, { signal: controller.signal });
  });
  context.root.querySelectorAll("[data-scroll-group]").forEach((button) => {
    button.addEventListener("click", () => {
      const group = context.root.querySelector(`[data-group-key="${CSS.escape(button.dataset.scrollGroup)}"]`);
      group?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, { signal: controller.signal });
  });

  const backgroundSegments = context.root.querySelectorAll("[data-bg-segment]");
  if ("IntersectionObserver" in window) {
    const backgroundObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("loaded");
        backgroundObserver.unobserve(entry.target);
      });
    }, { rootMargin: "300px 0px" });
    backgroundSegments.forEach((segment) => backgroundObserver.observe(segment));
    controller.signal.addEventListener("abort", () => backgroundObserver.disconnect(), { once: true });

    const stationObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      context.root.querySelectorAll(".navDot.current").forEach((dot) => dot.classList.remove("current"));
      context.root.querySelector(`[data-scroll-station="${CSS.escape(visible.target.dataset.stationKey)}"]`)?.classList.add("current");
    }, { rootMargin: "-35% 0px -35% 0px", threshold: [0.2, 0.6] });
    context.root.querySelectorAll("[data-station-key]").forEach((station) => stationObserver.observe(station));
    controller.signal.addEventListener("abort", () => stationObserver.disconnect(), { once: true });
  } else {
    backgroundSegments.forEach((segment) => segment.classList.add("loaded"));
  }
}

function renderStation(context, route, station) {
  const status = computedStationStatus(route, station);
  const row = getStationProgress(station);
  const canStudy = ["available", "studying", "test_ready", "mastered"].includes(status);
  const canTest = ["test_ready", "review_1_due", "review_2_due", "mastered"].includes(status);
  const primaryLabel = status === "mastered" ? "Повторить карточки" : status === "test_ready" ? "Повторить карточки" : "Изучить карточки";
  const testLabel = status === "review_1_due" ? "Первое повторение" : status === "review_2_due" ? "Финальное повторение" : status === "mastered" ? "Повторить тест" : "Пройти тест";
  context.root.innerHTML = `
    <section class="view screen stationDetailView">
      <div class="stonePanel">
        <div class="terminalEyebrow">[ ${escapeHtml(PATH_CONFIG.storyLabels[station.storyType].toUpperCase())} ]</div>
        <h1 class="stationDetailTitle">${escapeHtml(station.name)}</h1>
        <div class="stationDetailMeta">${escapeHtml(station.catalogId)} / ${escapeHtml(station.groupId)}<br>${station.words.length} слов · ${escapeHtml(station.difficulty)}</div>
        <div class="stationStatusBox"><strong>${escapeHtml(stateLabel(status, row))}</strong>${row?.best_accuracy ? `<br>Лучшая точность: ${row.best_accuracy}%` : ""}</div>
        <div class="stationActions">
          <button class="stationAction" type="button" data-station-study ${canStudy ? "" : "disabled"}>${escapeHtml(primaryLabel)}</button>
          <button class="stationAction secondary" type="button" data-station-test ${canTest ? "" : "disabled"}>${escapeHtml(testLabel)}</button>
        </div>
        <div class="stationWordPreview">${escapeHtml(station.words.slice(0, 8).map((word) => word.word).join(" · "))}${station.words.length > 8 ? " · …" : ""}</div>
      </div>
    </section>`;

  context.root.querySelector("[data-station-study]")?.addEventListener("click", () => {
    markStationStarted(station);
    context.router.navigate("path.study", routeParams(station, route));
  }, { signal: controller.signal });
  context.root.querySelector("[data-station-test]")?.addEventListener("click", () => {
    context.router.navigate("path.test", routeParams(station, route));
  }, { signal: controller.signal });
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
    ? result.phase === "review_2" ? "Станция освоена. Путь открыт дальше." : "Этап подтверждён. Следующее повторение назначено."
    : `Нужно не менее ${result.required}%. Попытка сохранена, этап не засчитан.`;
  context.root.innerHTML = `
    <section class="view screen stationResultView">
      <div class="stonePanel">
        <div class="terminalEyebrow">[ РЕЗУЛЬТАТ СТАНЦИИ ]</div>
        <div class="stationResultScore">${result.payload.accuracy}%</div>
        <div class="stationResultText">${escapeHtml(message)}<br>${result.payload.correct_total}/${result.payload.questions_total} правильных ответов</div>
        <div class="stationActions">
          <button class="stationAction" type="button" data-result-return>Вернуться к станции</button>
          ${result.passed ? "" : `<button class="stationAction secondary" type="button" data-result-repeat>Повторить тест</button>`}
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
  context.ensureStyle("/src/features/path/path.css?v=13.1", "path-feature-style");
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
      mode: "kb",
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
