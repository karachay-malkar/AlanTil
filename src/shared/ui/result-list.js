import { STATUS_BAD_ICON_SVG, STATUS_OK_ICON_SVG } from "./icons.js?v=13.9.0";
import { escapeHtml } from "./html.js?v=13.9.0";
import { renderContentListRow } from "./list.js?v=13.9.0";
import { bindOverflowMarquees, renderOverflowMarquee } from "./overflow-marquee.js?v=13.10.12";

function renderStatus(status, count = 0, label = "") {
  const correct = status === "ok";
  const numericCount = Math.max(0, Number(count || 0));
  return `<span class="resultStatus ${correct ? "ok" : "bad"}"${label ? ` aria-label="${escapeHtml(label)}"` : ""}>
    ${correct ? STATUS_OK_ICON_SVG : STATUS_BAD_ICON_SVG}
    ${!correct && numericCount ? `<span class="resultStatusCount" aria-hidden="true">${numericCount}</span>` : ""}
  </span>`;
}

function renderDetailLine({ label = "", value = "", tone = "" } = {}) {
  return `<span class="resultDetailLine ${tone ? `is-${escapeHtml(tone)}` : ""}">
    ${label ? `<strong>${escapeHtml(label)}</strong>` : ""}
    ${renderOverflowMarquee(value || "—", {
      clipClass: "resultDetailClip",
      trackClass: "resultDetailTrack",
    })}
  </span>`;
}

export function renderResultRow({
  id = "",
  status = "bad",
  count = 0,
  statusLabel = "",
  primary = "",
  details = [],
  trailingHtml = "",
} = {}) {
  return renderContentListRow({
    id,
    className: "resultListRow",
    leadingHtml: renderStatus(status, count, statusLabel),
    primaryHtml: renderOverflowMarquee(primary || "—", {
      clipClass: "resultPrimaryClip",
      trackClass: "resultPrimaryTrack",
    }),
    secondaryHtml: `<span class="resultDetailGroup">${details.slice(0, 2).map(renderDetailLine).join("")}</span>`,
    trailingHtml,
  });
}

export function renderResultScreen({
  className = "",
  summaryHtml = "",
  summaryClass = "",
  contentHtml = "",
  emptyHtml = "",
  footerHtml = "",
  listId = "",
} = {}) {
  const hasSummary = Boolean(summaryHtml);
  const hasFooter = Boolean(footerHtml);
  return `<section class="view screen modeView resultScreen ${hasSummary ? "hasSummary" : ""} ${hasFooter ? "hasFooter" : ""} ${className}">
    ${hasSummary ? `<div class="resultScreenSummary ${summaryClass}">${summaryHtml}</div>` : ""}
    <div${listId ? ` id="${escapeHtml(listId)}"` : ""} class="contentList modeResultList resultScreenList">${contentHtml || emptyHtml}</div>
    ${hasFooter ? `<footer class="modeLaunchBar resultScreenFooter">${footerHtml}</footer>` : ""}
  </section>`;
}

export function bindResultRows(root, { signal } = {}) {
  return bindOverflowMarquees(root, {
    signal,
    scrollRoot: root?.querySelector?.(".resultScreenList") || null,
  });
}
