import { getWords } from "../../shared/data/word-repository.js";
import { wordFavorites } from "../../shared/state/word-favorites.js";
import { renderCatalog, renderDictionaryContent, renderSections, renderSetMenu } from "./catalog.js";
import { renderResults } from "./results.js";
import { clearStudySession, learnState } from "./state.js";
import { renderStudy } from "./study.js";

let controller = null;
let activeContext = null;

export async function mount(context, params = {}) {
  activeContext = context;
  context.ensureStyle("src/features/learn/learn.css", "learn-feature-style");
  controller = new AbortController();
  wordFavorites.reload();
  const words = await getWords();
  const screen = params.screen || "catalog";
  learnState.currentScreen = screen;

  if (!words.length) {
    context.root.innerHTML = `<section class="view screen"><div class="panel"><div class="smallNote">Нет данных. Проверь таблицу и заголовки: id, dict, section, set, word, trans, example</div></div></section>`;
    return;
  }

  switch (screen) {
    case "catalog": renderCatalog(context, words, controller.signal); break;
    case "sections": renderSections(context, words, controller.signal); break;
    case "catalog-content": renderDictionaryContent(context, words, controller.signal); break;
    case "set": renderSetMenu(context, words, controller.signal); break;
    case "study": renderStudy(context, words, controller.signal, params); break;
    case "results": renderResults(context, words, controller.signal); break;
    default: context.router.replace("learn.catalog", {}, { force: true });
  }
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
