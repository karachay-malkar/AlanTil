import { SEARCH_ICON_SVG } from "./icons.js?v=13.8";
import { escapeHtml } from "./html.js?v=13.8";

export function renderExpandableSearch({
  idPrefix = "search",
  open = false,
  modes = [],
  selectedMode = "",
  placeholder = "Поиск...",
} = {}) {
  return {
    toggle: `<button id="${idPrefix}Toggle" class="iconAction appHeaderAction expandSearchToggle ${open ? "active" : ""}" type="button" aria-label="${open ? "Закрыть поиск" : "Открыть поиск"}" aria-expanded="${open}">${SEARCH_ICON_SVG}</button>`,
    bar: `
      <div id="${idPrefix}Bar" class="catalogSearchBar ${open ? "" : "hidden"}" data-search-control>
        <input id="${idPrefix}Input" class="expandSearchInput" type="search" placeholder="${escapeHtml(placeholder)}" autocomplete="off" aria-label="Поиск" />
        <div id="${idPrefix}Modes" class="searchModeList" role="radiogroup" aria-label="Область поиска">
          ${modes.map(({ value, label }) => `
            <label class="searchModeItem ${selectedMode === value ? "active" : ""}">
              <input type="radio" name="${idPrefix}Mode" value="${escapeHtml(value)}" ${selectedMode === value ? "checked" : ""} />
              <span>${escapeHtml(label)}</span>
            </label>`).join("")}
        </div>
      </div>`,
  };
}
