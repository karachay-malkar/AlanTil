import { wordFavorites } from "../state/word-favorites.js";
import { openInfoModal } from "./info-modal.js";
import { escapeHtml, renderCombinedGroups, renderStarButton } from "./word-renderers.js";

export function renderWordCard(word) {
  const groupsHost = document.createElement("div");
  renderCombinedGroups(groupsHost, word?.trans || "", word?.example || "");

  return `
    <article class="wordCard" data-word-card-id="${escapeHtml(word?.id || "")}">
      <div class="wordCardHeader">
        <div class="wordCardWord">${escapeHtml(word?.word || "")}</div>
        ${renderStarButton(word?.id || "", `data-word-card-star="1"`)}
      </div>
      <div class="wordCardMeanings">${groupsHost.innerHTML}</div>
    </article>`;
}

export function openWordCard(context, word) {
  if (!word) return null;
  wordFavorites.reload();
  const modal = openInfoModal(context.shell.modalRoot, {
    title: "",
    content: renderWordCard(word),
    closeText: "Закрыть",
  });

  const star = modal?.querySelector("[data-word-card-star='1']");
  star?.addEventListener("click", () => {
    const on = wordFavorites.toggle(word.id);
    star.classList.toggle("on", on);
  });
  return modal;
}
