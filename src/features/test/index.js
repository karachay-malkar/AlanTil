import { getWords } from "../../shared/data/word-repository.js";
import { wordFavorites } from "../../shared/state/word-favorites.js";
import { finalizeTestSession } from "./engine.js";
import { clearTestSession, testState } from "./state.js";
import { renderTestMenu, renderTestResults, renderTestSession } from "./view.js";

let controller = null;
export async function mount(context, params = {}) {
  context.ensureStyle("/src/features/test/test.css", "test-feature-style");
  controller = new AbortController(); wordFavorites.reload();
  const words = await getWords(); const screen = params.screen || "menu"; testState.currentScreen = screen;
  const titles = { menu: "Проверь знания", session: "Проверь знания", results: "Результаты теста" };
  context.shell.setHeaderContent?.({ title: titles[screen] || "Проверь знания", logo: true, brand: false });
  if (screen === "menu") renderTestMenu(context, words, controller.signal);
  else if (screen === "session") renderTestSession(context, controller.signal);
  else if (screen === "results") renderTestResults(context, controller.signal);
  else context.router.replace("test.menu", {}, { force: true });
}
export function onLeave(reason = "route_change") {
  if (testState.currentScreen !== "session") return;
  const tracker = testState.session.tracker;
  if (tracker?.getStatus() === "active") { const total = testState.items.length; tracker.abandon(reason, { items_total: total, items_completed: testState.index, questions_total: total, questions_answered: testState.index, progress_percent: Math.round((testState.index / Math.max(1, total)) * 100), correct_count: testState.correct, wrong_count: Math.max(0, testState.index - testState.correct) }); }
  if (testState.session.inProgress) finalizeTestSession("interrupted", reason);
}
export function unmount() { controller?.abort(); controller = null; if (testState.currentScreen === "session" && testState.session.inProgress) clearTestSession(); }
export function canLeave() { return !(testState.currentScreen === "session" && testState.session.inProgress && !testState.session.completed); }
