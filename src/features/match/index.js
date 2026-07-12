import { getWords } from "../../shared/data/word-repository.js";
import { wordFavorites } from "../../shared/state/word-favorites.js";
import { clearMatchSession, matchState } from "./state.js";
import { renderMatchGame, renderMatchMenu, renderMatchResult } from "./view.js";

let controller = null;

export async function mount(context, params = {}) {
  context.ensureStyle("src/features/test/test.css", "test-feature-style");
  context.ensureStyle("src/features/match/match.css", "match-feature-style");
  controller = new AbortController();
  wordFavorites.reload();
  const words = await getWords();
  const screen = params.screen || "menu";
  matchState.currentScreen = screen;

  if (screen === "menu") renderMatchMenu(context, words, controller.signal);
  else if (screen === "game") renderMatchGame(context, words, controller.signal);
  else if (screen === "result") renderMatchResult(context, words, controller.signal);
  else context.router.replace("match.menu", {}, { force: true });
}

export function unmount() {
  controller?.abort();
  controller = null;
  if (matchState.currentScreen === "game" && matchState.session.inProgress) clearMatchSession();
}

export function canLeave() {
  return !(matchState.currentScreen === "game" && matchState.session.inProgress && !matchState.session.completed);
}
