import { escapeHtml } from "./html.js?v=13.9.0";

export function renderSegmentedProgress({ value = 0, segments = 10, label = "", className = "" } = {}) {
  const percent = Math.max(0, Math.min(100, Number(value) || 0));
  const count = Math.max(1, Math.round(Number(segments) || 10));
  const filled = Math.round((percent / 100) * count);
  return `<span class="segmentedProgress ${escapeHtml(className)}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}"${label ? ` aria-label="${escapeHtml(label)}"` : ""}>
    <span class="segmentedProgressBracket" aria-hidden="true">[</span>
    <span class="segmentedProgressTrack" aria-hidden="true">${Array.from({ length: count }, (_, index) => `<span class="segmentedProgressSegment ${index < filled ? "isFilled" : ""}"></span>`).join("")}</span>
    <span class="segmentedProgressBracket" aria-hidden="true">]</span>
  </span>`;
}
