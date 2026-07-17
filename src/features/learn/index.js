import { msg } from "../../shared/i18n/index.js?v=13.9.0";
import { trackEvent } from "../../shared/analytics/analytics.js?v=13.9.0";
import { EVENTS } from "../../shared/analytics/events.js?v=13.9.0";
import { getWords } from "../../shared/data/word-repository.js?v=13.9.0";
import { dictsFrom, sectionsFrom, setsFrom } from "../../shared/domain/word-selection.js?v=13.9.0";
import { createSlugMap } from "../../shared/domain/slugs.js?v=13.9.0";
import { wordFavorites } from "../../shared/state/word-favorites.js?v=13.9.0";
import { panel } from "../../shared/ui/panel.js?v=13.9.0";
import { renderCatalog, renderDictionaryContent, renderSections, renderSetMenu } from "./catalog.js?v=13.9.0";
import { renderResults } from "./results.js?v=13.9.0";
import { clearStudySession, getLearnItemsCompleted, learnState } from "./state.js?v=13.9.0";
import { finalizeLearnSession, renderStudy } from "./study.js?v=13.9.0";

let controller = null;
let activeContext = null;

function resolveDictionary(words, slug) {
  if (slug === "favorites") return "__fav__";
  return createSlugMap(dictsFrom(words), { reserved: ["favorites"] }).valueFor(slug);
}

function resolveSection(words, dict, slug) {
  if (!slug || dict === "__fav__") return dict === "__fav__" ? msg("learn.izbrannoe") : "";
  return createSlugMap(sectionsFrom(words, dict)).valueFor(slug);
}

function resolveSet(words, dict, section, slug) {
  if (dict === "__fav__") return 1;
  if (!slug) return null;
  const sets = setsFrom(words, dict, section);
  const value = createSlugMap(sets.map(String)).valueFor(slug);
  return sets.find((setNumber) => String(setNumber) === String(value)) ?? null;
}

function applyRouteState(words, params, requestedScreen) {
  let screen = requestedScreen;
  if (screen === "catalog") return screen;

  const dictionarySlug = String(params.dictionarySlug || "");
  if (dictionarySlug) {
    const dict = resolveDictionary(words, dictionarySlug);
    if (!dict) return null;
    learnState.currentDict = dict;
  }

  if (!learnState.currentDict) return null;
  if (learnState.currentDict === "__fav__") {
    learnState.currentSection = msg("learn.izbrannoe");
    learnState.currentSet = 1;
    if (screen === "sections") screen = "set";
    return screen;
  }

  if (params.sectionSlug) {
    const section = resolveSection(words, learnState.currentDict, params.sectionSlug);
    if (!section) return null;
    learnState.currentSection = section;
  } else if (screen === "sections" || screen === "catalog-content") {
    learnState.currentSection = "";
  }

  if (["set", "study", "results"].includes(screen)) {
    const setNumber = resolveSet(words, learnState.currentDict, learnState.currentSection, params.setSlug);
    if (setNumber === null) return null;
    learnState.currentSet = setNumber;
  }
  return screen;
}

function trackNavigation(screen) {
  if (screen === "sections" && learnState.currentSection) {
    trackEvent(EVENTS.SECTION_OPEN, {
      dictionary_id: learnState.currentDict,
      section_id: learnState.currentSection,
    });
  } else if (screen === "sections" || screen === "catalog-content") {
    trackEvent(EVENTS.DICTIONARY_OPEN, { dictionary_id: learnState.currentDict });
  } else if (screen === "set") {
    trackEvent(EVENTS.SET_OPEN, {
      dictionary_id: learnState.currentDict,
      section_id: learnState.currentSection,
      set_id: String(learnState.currentSet),
    });
  }
}

export async function mount(context, params = {}) {
  activeContext = context;
  context.ensureStyle("/src/features/learn/learn.css", "learn-feature-style");
  controller = new AbortController();
  wordFavorites.reload();
  const words = await getWords();
  const requestedScreen = params.screen || "catalog";
  const screen = applyRouteState(words, params, requestedScreen);
  learnState.currentScreen = screen || requestedScreen;

  if (!words.length) {
    context.root.innerHTML = panel({ title: msg("learn.uchit_slova"), body: `<div class="smallNote">${msg("learn.net_dannyh_prover_tablitsu_i_zagolovki_id")}</div>` });
    return;
  }
  if (!screen) {
    context.root.innerHTML = panel({ title: msg("learn.uchit_slova"), body: `<div class="errorState">${msg("learn.slovar_razdel_ili_set_po_etoy_ssylke")}</div>` });
    return;
  }

  if (screen === "set") clearStudySession();

  switch (screen) {
    case "catalog": renderCatalog(context, words, controller.signal); break;
    case "sections": renderSections(context, words, controller.signal); break;
    case "catalog-content": renderDictionaryContent(context, words, controller.signal); break;
    case "set": renderSetMenu(context, words, controller.signal); break;
    case "study": renderStudy(context, words, controller.signal, params); break;
    case "results": renderResults(context, words, controller.signal); break;
    default: context.router.replace("learn.catalog", {}, { force: true }); return;
  }
  trackNavigation(screen);
}

export function onLeave(reason = "route_change") {
  const tracker = learnState.studySession.tracker;
  if (tracker?.getStatus() === "active") {
    const itemsCompleted = getLearnItemsCompleted();
    const progress = learnState.studySession.progressData || {};
    tracker.abandon(reason, {
      items_total: learnState.totalPlanned,
      items_completed: itemsCompleted,
      progress_percent: Math.round((itemsCompleted / Math.max(1, learnState.totalPlanned)) * 100),
      known_count: progress.known || 0,
      unknown_count: progress.unknown || 0,
    });
  }
  if (learnState.studySession.inProgress) finalizeLearnSession("interrupted", reason);
}

export function unmount() {
  controller?.abort();
  controller = null;
  activeContext?.shell.setCounter("");
  if (learnState.currentScreen === "study" && learnState.studySession.inProgress) clearStudySession();
  activeContext = null;
}

export function canLeave() {
  return !(learnState.currentScreen === "study" && learnState.studySession.inProgress && !learnState.studySession.completed);
}
