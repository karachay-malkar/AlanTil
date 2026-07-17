import { STAR_ICON_SVG } from "./icons.js?v=13.8.1";
import { escapeHtml } from "./html.js?v=13.8.1";

function dataAttribute(name, value) {
  if (!name) return "";
  return ` data-${name}="${escapeHtml(value)}"`;
}

export function renderSectionMenu(items, { dataName = "item", className = "" } = {}) {
  return `<div class="sectionMenu ${className}">${items.map((item) => `
    <button class="sectionMenuItem" type="button"${dataAttribute(dataName, item.id)}>
      <span class="sectionMenuTitle">
        ${item.favorite ? `<span class="sectionMenuFavoriteIcon" aria-hidden="true">${STAR_ICON_SVG}</span>` : ""}
        <span>${escapeHtml(item.title)}</span>
      </span>
    </button>`).join("")}</div>`;
}

export function renderMetaPills(values) {
  const items = (Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (!items.length) return "";
  return `<span class="contentListPills">${items.map((value) => `<span class="contentListPill">${escapeHtml(value)}</span>`).join("")}</span>`;
}

export function renderContentListRow({
  id = "",
  rowAttributes = "",
  openAttributes = "",
  primary = "",
  primaryHtml = "",
  secondary = "",
  secondaryHtml = "",
  pills = [],
  leadingHtml = "",
  trailingHtml = "",
  clickable = false,
  className = "",
} = {}) {
  const classes = [
    "contentListRow",
    leadingHtml ? "hasLeading" : "",
    trailingHtml ? "hasTrailing" : "",
    className,
  ].filter(Boolean).join(" ");
  const mainTag = clickable ? "button" : "div";
  const mainType = clickable ? ` type="button"` : "";
  const rowId = id ? ` data-row-id="${escapeHtml(id)}"` : "";
  return `
    <div class="${classes}"${rowId} ${rowAttributes}>
      ${leadingHtml ? `<div class="contentListLeading">${leadingHtml}</div>` : ""}
      <${mainTag} class="contentListMain"${mainType} ${openAttributes}>
        <span class="contentListPrimary">${primaryHtml || escapeHtml(primary)}</span>
        ${secondaryHtml || secondary ? `<span class="contentListSecondary">${secondaryHtml || escapeHtml(secondary)}</span>` : ""}
        ${renderMetaPills(pills)}
      </${mainTag}>
      ${trailingHtml ? `<div class="contentListTrailing">${trailingHtml}</div>` : ""}
    </div>`;
}
