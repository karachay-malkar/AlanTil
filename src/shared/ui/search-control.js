import { SEARCH_ICON_SVG } from "./icons.js";
import { escapeHtml } from "./html.js";

export function renderExpandableSearch({
  idPrefix = "search",
  open = false,
  modes = [],
  selectedMode = "",
  placeholder = "Поиск...",
} = {}) {
  return {
    header: `
      <div class="expandSearchControl ${open ? "open" : ""}" data-search-control>
        <input id="${idPrefix}Input" class="expandSearchInput" type="search" placeholder="${escapeHtml(placeholder)}" autocomplete="off" aria-label="Поиск" />
        <button id="${idPrefix}Toggle" class="expandSearchToggle" type="button" aria-label="${open ? "Закрыть поиск" : "Открыть поиск"}" aria-expanded="${open}">${SEARCH_ICON_SVG}</button>
      </div>`,
    modes: `
      <div id="${idPrefix}Modes" class="searchModeList ${open ? "" : "hidden"}" role="radiogroup" aria-label="Область поиска">
        ${modes.map(({ value, label }) => `
          <label class="searchModeItem ${selectedMode === value ? "active" : ""}">
            <input type="radio" name="${idPrefix}Mode" value="${escapeHtml(value)}" ${selectedMode === value ? "checked" : ""} />
            <span class="searchModeDot" aria-hidden="true"></span>
            <span>${escapeHtml(label)}</span>
          </label>`).join("")}
      </div>`,
  };
}
