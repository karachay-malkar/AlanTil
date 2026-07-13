import { STAR_ICON_SVG } from "./icons.js";

export function renderFavoriteButton({ active = false, attributes = "", label = "Избранное" } = {}) {
  return `<button class="starBtn ${active ? "on" : ""}" type="button" aria-label="${label}" title="${label}" ${attributes}>${STAR_ICON_SVG}</button>`;
}
