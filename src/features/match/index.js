import { getWords } from "../../shared/data/word-repository.js";
import { wordFavorites } from "../../shared/state/word-favorites.js";
import { finalizeMatchSession } from "./engine.js";
import { clearMatchSession, matchState } from "./state.js";
import { renderMatchGame, renderMatchMenu, renderMatchResult } from "./view.js";
let controller = null;
export async function mount(context, params = {}) {
  context.ensureStyle("/src/features/test/test.css", "test-feature-style"); context.ensureStyle("/src/features/match/match.css", "match-feature-style"); controller = new AbortController(); wordFavorites.reload();
  const words = await getWords(); const screen = params.screen || "menu"; matchState.currentScreen = screen;
  const titles = { menu: "Сопоставь слова", game: "Сопоставь слова", results: "Результат игры" };
  context.shell.setHeaderContent?.({ title: titles[screen] || "Сопоставь слова", logo: true, brand: false });
  if (screen === "menu") renderMatchMenu(context, words, controller.signal); else if (screen === "game") renderMatchGame(context, words, controller.signal); else if (screen === "results") renderMatchResult(context, words, controller.signal); else context.router.replace("match.menu", {}, { force: true });
}
export function onLeave(reason = "route_change") { if (matchState.currentScreen !== "game") return; const tracker = matchState.session.tracker; if (tracker?.getStatus() === "active") tracker.abandon(reason, { items_total: matchState.total, items_completed: matchState.solvedCount, pairs_total: matchState.total, pairs_completed: matchState.solvedCount, progress_percent: Math.round((matchState.solvedCount / Math.max(1, matchState.total)) * 100), errors_count: matchState.errorsCount }); if (matchState.session.inProgress) finalizeMatchSession("interrupted", reason); }
export function unmount() { controller?.abort(); controller = null; if (matchState.currentScreen === "game" && matchState.session.inProgress) clearMatchSession(); }
export function canLeave() { return !(matchState.currentScreen === "game" && matchState.session.inProgress && !matchState.session.completed); }
