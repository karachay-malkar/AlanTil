import { splitGroups } from "../domain/word-selection.js";
import { escapeHtml } from "./html.js";
import { renderFavoriteButton } from "./favorite-button.js";
import { wordFavorites } from "../state/word-favorites.js";

export { escapeHtml };

export function renderStarButton(id, attributes = "") {
  return renderFavoriteButton({ active: wordFavorites.has(id), attributes });
}

function parseExampleGroups(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const parts = raw.replace(/\n+/g, ";").split(/\s*[;；]\s*/g).map((part) => part.trim()).filter(Boolean);
  const groups = [];
  let current = null;

  for (const part of parts) {
    const match = part.match(/^\s*(\d+)\s*(?:[.)]|[-–—])?\s*(.*)$/);
    if (match) {
      if (current) groups.push(current);
      current = { index: Number(match[1]) - 1, lines: match[2] ? [match[2]] : [] };
    } else if (!current) {
      current = { index: 0, lines: [part] };
    } else {
      current.lines.push(part);
    }
  }
  if (current) groups.push(current);
  return groups;
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
