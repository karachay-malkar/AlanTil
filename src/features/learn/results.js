import { wordFavorites } from "../../shared/state/word-favorites.js";
import { STATUS_BAD_ICON_SVG } from "../../shared/ui/icons.js";
import { panel } from "../../shared/ui/panel.js";
import { escapeHtml, renderStarButton } from "../../shared/ui/word-renderers.js";
import { learnState } from "./state.js";

export function renderResults(context, words, signal) {
  const problemWords = Object.entries(learnState.sessionFailMap)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({ ...words.find((word) => word.id === id), fails: count }))
    .filter((word) => word.id)
    .sort((a, b) => b.fails - a.fails);

  const content = problemWords.length
    ? problemWords.map((word) => `
      <div class="resultItem analyticsResultItem" data-id="${escapeHtml(word.id)}">
        <div class="resultMark bad analyticsFailMark" aria-label="Ошибок: ${word.fails}">${STATUS_BAD_ICON_SVG}<span class="analyticsFailCount">${word.fails}</span></div>
        <div class="resultBody"><div class="resultWord">${escapeHtml(word.word)}</div><div class="resultLine analyticsTranslation">${escapeHtml(word.trans)}</div></div>
        ${renderStarButton(word.id, `data-word-id="${escapeHtml(word.id)}"`)}
      </div>`).join("")
    : `<div class="smallNote noteCenter"><div class="noteTitle">Аперим!</div><div class="successNoteLine">✅ Не было незнакомых слов</div></div>`;

  context.root.innerHTML = panel({ title: "Аналитика сессии", body: `<div id="analyticsList" class="list">${content}</div>` });
  context.root.querySelectorAll(".starBtn[data-word-id]").forEach((button) => {
    button.addEventListener("click", () => button.classList.toggle("on", wordFavorites.toggle(button.dataset.wordId)), { signal });
  });
}
