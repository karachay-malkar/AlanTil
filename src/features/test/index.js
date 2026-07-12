import { getWords } from "../../shared/data/word-repository.js";
import { wordFavorites } from "../../shared/state/word-favorites.js";
import { clearTestSession, testState } from "./state.js";
import { renderTestMenu, renderTestSession } from "./view.js";

let controller = null;

export async function mount(context, params = {}) {
  context.ensureStyle("src/features/test/test.css", "test-feature-style");
  controller = new AbortController();
  wordFavorites.reload();
  const words = await getWords();
  const screen = params.screen || "menu";
  testState.currentScreen = screen;

  if (screen === "menu") renderTestMenu(context, words, controller.signal);
  else if (screen === "session") renderTestSession(context, controller.signal);
  else context.router.replace("test.menu", {}, { force: true });
}

export function unmount() {
  controller?.abort();
  controller = null;
  if (testState.currentScreen === "session" && testState.session.inProgress) clearTestSession();
}

export function canLeave() {
  return !(testState.currentScreen === "session" && testState.session.inProgress && !testState.session.completed);
}
