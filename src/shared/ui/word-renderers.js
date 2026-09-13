import { parseExampleGroups, parseTranslationGroups } from "../domain/example-groups.js?v=13.10.12";
import { escapeHtml } from "./html.js?v=13.9.0";
import { renderFavoriteButton } from "./favorite-button.js?v=13.9.0";
import { wordFavorites } from "../state/word-favorites.js?v=13.9.0";

export { escapeHtml };

export function renderStarButton(id, attributes = "") {
  return renderFavoriteButton({ active: wordFavorites.has(id), attributes });
}

export function renderRuTitle(element, text) {
  const groups = parseTranslationGroups(text);
  if (!groups.length) {
    element.textContent = "";
  } else if (groups.length === 1) {
    element.textContent = groups[0].text;
  } else {
    element.innerHTML = groups.map((group) => `<div>${group.number}. ${escapeHtml(group.text)}</div>`).join("");
  }
}

export function renderRuAlanFront(element, item) {
  const groups = parseTranslationGroups(item.trans);
  const examples = parseExampleGroups(item.example);
  if (!groups.length) {
    element.textContent = item.word;
    return;
  }

  element.innerHTML = `
    <div class="groups">
      ${groups.map((group) => {
        const example = examples.find((row) => row.index === group.index);
        return `
          <div class="groupRow">
            <span class="groupNum">[${group.number}]</span>
            <div class="groupPill">
              <div class="gTrans">${escapeHtml(item.word)}</div>
              ${example ? example.lines.map((line) => `<div class="gEx">${escapeHtml(line)}</div>`).join("") : ""}
            </div>
          </div>`;
      }).join("")}
    </div>`;
}

export function renderCombinedGroups(element, translationText, exampleText) {
  const translations = parseTranslationGroups(translationText);
  const examples = parseExampleGroups(exampleText);
  const indexes = Array.from(new Set([...translations.map((group) => group.index), ...examples.map((group) => group.index)])).sort((a,b)=>a-b);
  if (!indexes.length) {
    element.textContent = "";
    return;
  }

  element.innerHTML = `
    <div class="groups">
      ${indexes.map((index) => {
        const translation = translations.find((group) => group.index === index);
        const example = examples.find((group) => group.index === index);
        return `
          <div class="groupRow">
            <span class="groupNum">[${index + 1}]</span>
            <div class="groupPill">
              ${translation ? `<div class="gTrans">${escapeHtml(translation.text)}</div>` : ""}
              ${example ? example.lines.map((line) => `<div class="gEx">${escapeHtml(line)}</div>`).join("") : ""}
            </div>
          </div>`;
      }).join("")}
    </div>`;
}
