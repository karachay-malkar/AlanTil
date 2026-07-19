import { parseExampleGroups } from "../domain/example-groups.js?v=13.10.12";
import { splitGroups } from "../domain/word-selection.js?v=13.9.0";
import { escapeHtml } from "./html.js?v=13.9.0";
import { renderFavoriteButton } from "./favorite-button.js?v=13.9.0";
import { wordFavorites } from "../state/word-favorites.js?v=13.9.0";

export { escapeHtml };

export function renderStarButton(id, attributes = "") {
  return renderFavoriteButton({ active: wordFavorites.has(id), attributes });
}

export function renderRuTitle(element, text) {
  const groups = splitGroups(text);
  if (!groups.length) {
    element.textContent = "";
  } else if (groups.length === 1) {
    element.textContent = groups[0];
  } else {
    element.innerHTML = groups.map((group, index) => `<div>${index + 1}. ${escapeHtml(group)}</div>`).join("");
  }
}

export function renderRuAlanFront(element, item) {
  const groups = splitGroups(item.trans);
  const examples = parseExampleGroups(item.example);
  if (!groups.length) {
    element.textContent = item.word;
    return;
  }

  element.innerHTML = `
    <div class="groups">
      ${groups.map((_, index) => {
        const example = examples.find((group) => group.index === index);
        return `
          <div class="groupRow">
            <span class="groupNum">[${index + 1}]</span>
            <div class="groupPill">
              <div class="gTrans">${escapeHtml(item.word)}</div>
              ${example ? example.lines.map((line) => `<div class="gEx">${escapeHtml(line)}</div>`).join("") : ""}
            </div>
          </div>`;
      }).join("")}
    </div>`;
}

export function renderCombinedGroups(element, translationText, exampleText) {
  const translations = splitGroups(translationText);
  const examples = parseExampleGroups(exampleText);
  const count = Math.max(translations.length, examples.length);
  if (!count) {
    element.textContent = "";
    return;
  }

  element.innerHTML = `
    <div class="groups">
      ${Array.from({ length: count }).map((_, index) => {
        const translation = translations[index];
        const example = examples.find((group) => group.index === index);
        return `
          <div class="groupRow">
            <span class="groupNum">[${index + 1}]</span>
            <div class="groupPill">
              ${translation ? `<div class="gTrans">${escapeHtml(translation)}</div>` : ""}
              ${example ? example.lines.map((line) => `<div class="gEx">${escapeHtml(line)}</div>`).join("") : ""}
            </div>
          </div>`;
      }).join("")}
    </div>`;
}
