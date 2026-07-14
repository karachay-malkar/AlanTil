import { wordFavorites } from "../../shared/state/word-favorites.js";
import { STATUS_BAD_ICON_SVG } from "../../shared/ui/icons.js";
import { renderContentListRow } from "../../shared/ui/list.js";
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
    ? problemWords.map((word) => renderContentListRow({
        id: word.id,
        leadingHtml: `<span class="contentListStatus bad analyticsFailMark" aria-label="Ошибок: ${word.fails}">${STATUS_BAD_ICON_SVG}<span class="analyticsFailCount">${word.fails}</span></span>`,
        primary: word.word,
        secondary: word.trans,
        trailingHtml: renderStarButton(word.id, `data-word-id="${escapeHtml(word.id)}"`),
      })).join("")
    : `<div class="smallNote noteCenter"><div class="noteTitle">Аперим!</div><div class="successNoteLine">Не было незнакомых слов</div></div>`;

  context.root.innerHTML = panel({ title: "Аналитика сессии", body: `<div id="analyticsList" class="contentList">${content}</div>` });
  context.root.querySelectorAll(".starBtn[data-word-id]").forEach((button) => {
    button.addEventListener("click", () => button.classList.toggle("on", wordFavorites.toggle(button.dataset.wordId)), { signal });
  });
}
