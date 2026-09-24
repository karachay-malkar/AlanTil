import { STAR_ICON_SVG } from "./icons.js?v=16.8.0.2";
import { escapeHtml } from "./html.js?v=16.8.0.2";

function dataAttribute(name, value) {
  if (!name) return "";
  return ` data-${name}="${escapeHtml(value)}"`;
}

export function renderSectionMenu(items, { dataName = "item", className = "" } = {}) {
  return `<div class="sectionMenu contentList ${className}">${items.map((item) => renderContentListRow({
    id:item.id,
    primary:item.title,
    secondary:item.description||"",
    clickable:true,
    openAttributes:dataAttribute(dataName,item.id),
    leadingHtml:item.favorite?`<span class="sectionMenuFavoriteIcon" aria-hidden="true">${STAR_ICON_SVG}</span>`:"",
    trailingHtml:item.count!==undefined?`<span class="contentListService">${escapeHtml(item.count)}</span>`:"",
    className:"sectionMenuRow",
  })).join("")}</div>`;
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
