import { msg } from "../../shared/i18n/index.js?v=13.9.0";
import { getWords } from "../../shared/data/word-repository.js?v=13.9.0";
import { buildLearningRoute, resolveStationFromParams, stationPathParams } from "../../shared/domain/learning-route.js?v=13.9.0";
import { allStoryProgress, computedStationStatus, createRouteProgressSnapshot, stationWordProgress } from "../../shared/domain/route-progress.js?v=13.9.0";
import { getRouteSettings, updateRouteSettings } from "../../shared/progress/route-settings-store.js?v=13.9.0";
import { awardWordMilestones } from "../../shared/progress/word-progress-store.js?v=13.9.0";
import { getStationSize } from "../../shared/settings/user-settings-store.js?v=13.9.0";
import { wordFavorites } from "../../shared/state/word-favorites.js?v=13.9.0";
import { escapeHtml } from "../../shared/ui/html.js?v=13.9.0";
import { bindResultRows, renderResultRow, renderResultScreen } from "../../shared/ui/result-list.js?v=13.10.12";
import { createRouteScale } from "../../shared/ui/route-scale.js?v=13.9.0";
import { renderSegmentedProgress } from "../../shared/ui/segmented-progress.js?v=13.9.0";
import { renderStarButton } from "../../shared/ui/word-renderers.js?v=13.9.0";
import { getHiddenSet, learnState } from "../learn/state.js?v=13.9.0";
import { renderResults as renderLearnResults } from "../learn/results.js?v=13.9.0";
import { finalizeLearnSession, renderStudy } from "../learn/study.js?v=13.9.0";
import { createStationTestSession, renderStationTest } from "./station-test.js?v=13.9.0";
import { renderStationView } from "./station-view.js?v=13.9.0";

let controller = null;
let activeStudy = false;
const pendingSelections = new Map();
let routeCache = { words: null, stationSize: 0, route: null };

function activeStoryType(route, value) {
  const key = String(value || "").trim();
  return route.stories[key] ? key : route.defaultStoryType;
}

function routeParams(station, route) { return stationPathParams(route, station); }
function routeScrollKey(story, stationSize) { return `route_scroll_v2_${story}_${stationSize}`; }

function stationMilestones(summary) {
  const count = Math.floor(summary.mastered / 20);
  if (!count) return "";
  return `<span class="stationMilestones" aria-label="${msg("path.marshrutnyh_otmetok", { count })}">${Array.from({ length: Math.min(4, count) }, () => "⌃").join("")}</span>`;
}

function stationButton(station, index, progressSnapshot) {
  const status = computedStationStatus(null, station, progressSnapshot);
  const progress = stationWordProgress(station, progressSnapshot);
  const ordinal = String(index + 1).padStart(2, "0");
  return `<button
    id="station-${escapeHtml(station.key)}"
    class="choiceControl stationNode ${status}"
    style="--station-progress:${progress.percent * 3.6}deg"
    type="button"
    data-station-key="${escapeHtml(station.key)}"
    aria-label="${msg("path.osvoeno_iz_slov", { label: escapeHtml(station.name), mastered: progress.mastered, total: progress.total })}"
  >
    <span class="stationProgressRing" aria-hidden="true"><span class="millstoneFace"><span class="stationOrdinal">${ordinal}</span></span></span>
    <span class="stationLabel">${escapeHtml(station.name)}</span>
    <span class="stationWordCount">${progress.mastered}/${progress.total}</span>
    ${stationMilestones(progress)}
  </button>`;
}

function routeGroupSection(group, stationIndex, catalogId, progressSnapshot) {
  const reversedStations = [...group.stations].reverse();
  return `<section class="routeSection" data-route-section="${escapeHtml(`${catalogId}::${group.groupId}`)}">
    <div class="routeSectionStations">${reversedStations.map((station) => stationButton(station, stationIndex.get(station.key), progressSnapshot)).join("")}</div>
    <h3 class="routeSectionHeading">${escapeHtml(group.name)}</h3>
  </section>`;
}

function routeCatalogSection(catalog, stationIndex, progressSnapshot) {
  const reversedGroups = [...catalog.groups].reverse();
  return `<section class="routeCatalog" data-route-catalog="${escapeHtml(catalog.catalogId)}">
    <span class="routeCatalogEnd" data-catalog-end="${escapeHtml(catalog.catalogId)}" aria-hidden="true"></span>
    <div class="routeCatalogGroups">${reversedGroups.map((group) => routeGroupSection(group, stationIndex, catalog.catalogId, progressSnapshot)).join("")}</div>
    <h2 class="routeCatalogHeading">${escapeHtml(catalog.name)}</h2>
  </section>`;
}

function nextLayoutFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function restoreMapPosition(viewport) {
  if (!viewport) return;
  viewport.classList.add("isPositioning");
  const previousBehavior = viewport.style.scrollBehavior;
  viewport.style.scrollBehavior = "auto";
  try {
    await Promise.resolve(document.fonts?.ready).catch(() => {});
    await nextLayoutFrame();
    const position = () => {
      const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      viewport.scrollTop = maxScroll;
    };
    position();
    await nextLayoutFrame();
    position();
  } finally {
    viewport.style.scrollBehavior = previousBehavior;
    viewport.classList.remove("isPositioning");
  }
}

function renderRoute(context, route, activeStory, progressSnapshot) {
  const story = route.stories[activeStory];
  const progress = allStoryProgress(route, progressSnapshot)[activeStory];
  const stationIndex = new Map(story.stations.map((station, index) => [station.key, index]));
  const reversedCatalogs = [...story.catalogs].reverse();
  context.shell.setCounter("");
  context.shell.setHeaderContent?.({ title: msg("common.alan_til_2") });
  context.root.innerHTML = `<section class="pathView">
    <div class="pathStickyControls">
      <nav class="storyTabs" aria-label="${msg("path.istoriya_puti")}">
        ${route.storyOrder.map((type) => `<button class="tabAction storyTab ${type === activeStory ? "active" : ""}" type="button" data-story-tab="${escapeHtml(type)}" ${type === activeStory ? 'aria-current="page"' : ""}>[ ${escapeHtml(route.storyLabels[type])} ]</button>`).join("")}
      </nav>
      <div class="storyProgress">
        ${renderSegmentedProgress({ value: progress.percent, segments: 10, label: msg("path.osvoeno_slov_istorii", { percent: progress.percent, name: route.storyLabels[activeStory] }) })}
        <span class="pathProgressPercent">${progress.percent}%</span>
        <span class="pathProgressCount">${progress.masteredWords}/${progress.totalWords}</span>
      </div>
    </div>
    <div class="pathMapViewport isPositioning">
      <div class="routeBackdrop" aria-hidden="true"></div>
      <div class="routeMap" data-story-map="${escapeHtml(activeStory)}">${reversedCatalogs.map((catalog) => routeCatalogSection(catalog, stationIndex, progressSnapshot)).join("")}</div>
    </div>
    <nav class="routeScale" aria-label="${msg("path.rubezhi_marshruta")}"></nav>
  </section>`;

  context.root.querySelectorAll("[data-story-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.storyTab;
      const next = activeStoryType(route, type);
      if (next === activeStory) return;
      const viewport = context.root.querySelector(".pathMapViewport");
      updateRouteSettings({ [routeScrollKey(activeStory, route.stationSize)]: viewport?.scrollTop || 0 }, { queue: false });
      updateRouteSettings({ active_story: next });
      context.router.navigate("path.home", { storyType: next });
    }, { signal: controller.signal });
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
  void restoreMapPosition(viewport).then(() => {
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
    onStartTest(mode) {
      context.router.navigate("path.test", { ...routeParams(station, route), mode });
    },
  });
}

function masteryLabel(level) {
  if (level === 3) return msg("path.iii_znak_vershiny");
  if (level === 2) return msg("path.ii_marshrutnyy_znak");
  if (level === 1) return msg("path.i_marshrutnyy_znak");
  return msg("path.test_ne_sdan");
}

function renderResult(context, route, station, result, allWords) {
  if (result.passed) awardWordMilestones(allWords);
  const message = result.passed ? masteryLabel(result.masteryLevel) : msg("path.nuzhno_ne_menee", { required: result.required });
  const wordsById = new Map(allWords.map((word) => [String(word.id), word]));
  const alanToTranslation = result.payload.direction !== "ru_to_alan";
  const rows = (result.payload.words || []).map((answer) => {
    const word = wordsById.get(String(answer.word_id));
    if (!word) return "";
    const wrongWord = wordsById.get(String(answer.wrong_word_id || ""));
    const correct = answer.result === "correct" || answer.is_correct === true;
    const correctAnswer = alanToTranslation ? word.trans : word.word;
    const selectedAnswer = wrongWord ? (alanToTranslation ? wrongWord.trans : wrongWord.word) : correctAnswer;
    return renderResultRow({
      id: word.id,
      status: correct ? "ok" : "bad",
      primary: alanToTranslation ? word.word : word.trans,
      details: correct
        ? [{ label: msg("test.pravilno"), value: correctAnswer, tone: "correct" }]
        : [
            { label: msg("test.otvet"), value: selectedAnswer || "—", tone: "wrong" },
            { label: msg("test.pravilno"), value: correctAnswer, tone: "correct" },
          ],
      trailingHtml: renderStarButton(word.id, `data-word-id="${escapeHtml(word.id)}"`),
    });
  }).join("");
  context.shell.setHeaderContent?.({ title: msg("path.rezultat_testa"), subtitle: station.name, logo: true, brand: false });
  context.root.innerHTML = renderResultScreen({
    className: "stationResultView",
    summaryClass: "modeResultSummary",
    summaryHtml: `<span class="modeResultMark" aria-hidden="true">${result.masteryLevel ? "⌃".repeat(result.masteryLevel) : "—"}</span><strong>${result.payload.accuracy}%</strong><span>${escapeHtml(message)} · ${result.payload.correct_total}/${result.payload.questions_total}</span>`,
    contentHtml: rows,
    emptyHtml: `<div class="hintText">${msg("test.net_rezultatov")}</div>`,
    footerHtml: `<div class="stationActions">
        <button class="btn actionText" type="button" data-result-return>${msg("path.k_etapu")}</button>
        ${result.passed ? "" : `<button class="btn actionPrimary" type="button" data-result-repeat>${msg("path.povtorit")}</button>`}
      </div>`,
  });
  bindResultRows(context.root, { signal: controller.signal });
  context.root.querySelectorAll(".starBtn[data-word-id]").forEach((button) => {
    button.addEventListener("click", () => button.classList.toggle("on", wordFavorites.toggle(button.dataset.wordId)), { signal: controller.signal });
  });
  context.root.querySelector("[data-result-return]")?.addEventListener("click", () => context.router.replace("path.station", routeParams(station, route), { force: true }), { signal: controller.signal });
  context.root.querySelector("[data-result-repeat]")?.addEventListener("click", () => {
    const mode = result.payload.direction === "ru_to_alan" ? "ru" : "kb";
    const session = createStationTestSession(station, allWords, mode);
    renderStationTest(context, session, { onComplete: (next) => renderResult(context, route, station, next, allWords) });
  }, { signal: controller.signal });
}

export async function mount(context, params = {}) {
  controller = new AbortController();
  const words = await getWords();
  const stationSize = getStationSize();
  if (routeCache.words !== words || routeCache.stationSize !== stationSize) {
    routeCache = { words, stationSize, route: buildLearningRoute(words, { stationSize }) };
  }
  const route = routeCache.route;
  const screen = params.screen || "home";
  const activeStory = activeStoryType(route, params.storyType || getRouteSettings().active_story);
  updateRouteSettings({ active_story: activeStory }, { queue: false });

  if (screen === "home") {
    const progressSnapshot = createRouteProgressSnapshot();
    if (String(params.storyType || "") !== activeStory) context.router.canonicalize?.("path.home", { storyType: activeStory });
    renderRoute(context, route, activeStory, progressSnapshot);
    return;
  }
  const station = resolveStationFromParams(route, { ...params, storyType: activeStory });
  if (!station) {
    context.router.canonicalize?.("path.home", { storyType: activeStory });
    renderRoute(context, route, activeStory, createRouteProgressSnapshot());
    return;
  }

  if (screen === "station") { renderStation(context, route, station); return; }

  if (screen === "study") {
    activeStudy = true;
    const selectedWords = selectedWordsForStation(station);
    learnState.currentDict = station.dictionaryId;
    learnState.currentSection = station.groupId;
    learnState.currentSet = station.selectionSetId || station.setId || station.key;
    context.shell.setHeaderContent?.({ title: msg("path.uchit_slova"), subtitle: station.name, logo: true, brand: false });
    renderStudy(context, words, controller.signal, {
      mode: params.mode || learnState.currentStudyMode || "kb",
      wordsOverride: selectedWords,
      stationContext: { key: station.key, wordIds: selectedWords.map((word) => word.id), ...routeParams(station, route) },
      onComplete() {
        activeStudy = false;
        pendingSelections.delete(station.key);
        renderLearnResults(context, words, controller.signal, {
          onDone: () => context.router.replace("path.station", routeParams(station, route), { force: true }),
        });
      },
    });
    return;
  }

  if (screen === "test") {
    const allWords = route.storyOrder.flatMap((type) => route.stories[type].stations).flatMap((item) => item.words);
    const session = createStationTestSession(station, allWords, params.mode || "kb");
    renderStationTest(context, session, { onComplete: (result) => renderResult(context, route, station, result, allWords) });
  }
}

export function canLeave() { return !activeStudy || !learnState.studySession.inProgress; }
export function onLeave(reason = "route_change") {
  if (activeStudy && learnState.studySession.inProgress) finalizeLearnSession("interrupted", reason);
  activeStudy = false;
}
export function unmount() { controller?.abort(); controller = null; }
