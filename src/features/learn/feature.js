import { getWords } from "../../shared/data/word-repository.js?v=13.12";
import { wordFavorites } from "../../shared/state/word-favorites.js?v=13.9.0";
import { renderSetPreparation } from "./set-preparation.js?v=13.13";
import { renderResults } from "./results.js?v=13.9.0";
import { clearStudySession, learnState } from "./state.js?v=13.13";
import { finalizeLearnSession, initializeStudy, renderStudy } from "./study.js?v=13.13";
import { msg } from "../../shared/i18n/index.js?v=13.9.0";

let controller = null;
let activeScreen = "set";

function favoriteWords(words) {
  return words.filter((word) => wordFavorites.has(word.id));
}

function canonicalFavoritesParams() {
  return { dictionarySlug: "favorites" };
}

function renderFavorites(context, words) {
  clearStudySession();
  renderSetPreparation(context, {
    title: msg("common.izbrannoe"),
    words: favoriteWords(words),
    dictionaryId: "favorites",
    sectionId: "favorites",
    setId: "favorites",
    signal: controller.signal,
    favoritesOnly: true,
    onStart(mode, selectedWords) {
      initializeStudy(words, mode, { wordsOverride: selectedWords });
      void context.router.navigate("learn.study", canonicalFavoritesParams());
    },
  });
}

function renderFavoritesStudy(context, words) {
  if (!learnState.studySession.inProgress) {
    void context.router.replace("learn.set", canonicalFavoritesParams(), { force: true });
    return;
  }
  renderStudy(context, words, controller.signal, {
    onComplete() { void context.router.replace("learn.results", canonicalFavoritesParams(), { force: true }); },
  });
}

function renderFavoritesResults(context, words) {
  if (!learnState.studySession.completed) {
    void context.router.replace("learn.set", canonicalFavoritesParams(), { force: true });
    return;
  }
  renderResults(context, words, controller.signal, {
    onDone() { void context.router.replace("learn.set", canonicalFavoritesParams(), { force: true }); },
  });
}

export async function mount(context, params = {}) {
  controller = new AbortController();
  wordFavorites.reload();
  const words = await getWords();
  const requested = params.screen || "set";
  const isFavorites = String(params.dictionarySlug || "") === "favorites";

  // Every historical /learn route is now only a compatibility alias. It can
  // never render the removed dictionary/section/set hierarchy.
  if (!isFavorites || !["set", "study", "results"].includes(requested)) {
    void context.router.replace("learn.set", canonicalFavoritesParams(), { force: true });
    return;
  }

  activeScreen = requested;
  if (requested === "study") return renderFavoritesStudy(context, words);
  if (requested === "results") return renderFavoritesResults(context, words);
  renderFavorites(context, words);
}

export function onLeave(reason = "route_change") {
  if (activeScreen === "study" && learnState.studySession.inProgress) finalizeLearnSession("interrupted", reason);
}

export function canLeave() {
  return !(activeScreen === "study" && learnState.studySession.inProgress && !learnState.studySession.completed);
}

export function unmount() {
  controller?.abort();
  controller = null;
  activeScreen = "set";
}
