import { msg } from "../i18n/index.js?v=16.8.0.2";
import { STAR_ICON_SVG } from "./icons.js?v=16.8.0.2";

export function renderFavoriteButton({ active = false, attributes = "", label = msg("common.izbrannoe") } = {}) {
  return `<button class="iconAction starBtn ${active ? "on" : ""}" type="button" aria-label="${label}" title="${label}" ${attributes}>${STAR_ICON_SVG}</button>`;
}
