import { learningSessionSummary } from "../../../packages/alantil-core/learning.js";
import { msg } from "../../shared/i18n/index.js?v=13.9.0";
import { wordFavorites } from "../../shared/state/word-favorites.js?v=13.9.0";
import { bindResultRows, renderResultRow, renderResultScreen } from "../../shared/ui/result-list.js?v=13.10.12";
import { escapeHtml, renderStarButton } from "../../shared/ui/word-renderers.js?v=13.9.0";
import { learnState } from "./state.js?v=13.9.0";

export function renderResults(context, words, signal, { onDone } = {}) {
  context.shell.setHeaderContent?.({ title: msg("learn.rezultat_obucheniya") });
  context.shell.setCounter("");
  const summary = learningSessionSummary(learnState.studySession.wordStats || {}, words);
  const { studiedTotal, unknownTotal, leftSwipesTotal, problemWords } = summary;

  const content = problemWords.length
    ? problemWords.map((word) => renderResultRow({
        id: word.id,
        status: "bad",
        count: word.fails,
        statusLabel: msg("learn.svaypov_vlevo", { fails: word.fails }),
        primary: word.word,
        details: [{ value: word.trans }],
        trailingHtml: renderStarButton(word.id, `data-word-id="${escapeHtml(word.id)}"`),
      })).join("")
    : `<div class="smallNote noteCenter"><div class="noteTitle">${msg("learn.aperim")}</div><div class="successNoteLine">${msg("learn.ne_bylo_neznakomyh_slov")}</div></div>`;

  context.root.innerHTML = renderResultScreen({
    className: "learnResultsView",
    summaryClass: "learnResultScreenSummary",
    summaryHtml: `<div class="learnResultSummary" aria-label="${msg("learn.itogi_obucheniya")}">
      <div><strong>${studiedTotal}</strong><span>${msg("learn.izucheno")}</span></div>
      <div><strong>${unknownTotal}</strong><span>${msg("learn.slov_ne_znayu")}</span></div>
      <div><strong>${leftSwipesTotal}</strong><span>${msg("learn.svaypov_vlevo_2")}</span></div>
    </div>`,
    contentHtml: content,
    listId: "analyticsList",
    footerHtml: typeof onDone === "function"
      ? `<button class="btn actionPrimary" type="button" data-learn-result-done>${msg("learn.k_etapu")}</button>`
      : "",
  });
  bindResultRows(context.root, { signal });
  context.root.querySelectorAll(".starBtn[data-word-id]").forEach((button) => {
    button.addEventListener("click", () => button.classList.toggle("on", wordFavorites.toggle(button.dataset.wordId)), { signal });
  });
  context.root.querySelector("[data-learn-result-done]")?.addEventListener("click", onDone, { signal });
}
