import { buildStationLearningStatistics } from "../../../packages/alantil-core/statistics.js?v=16.8.0.3";
import { getInterfaceLocale, msg } from "../../shared/i18n/index.js?v=16.8.0.3";
import { getActivityHistory } from "../../shared/progress/activity-history-store.js?v=16.8.0.3";
import { escapeHtml } from "../../shared/ui/html.js?v=16.8.0.3";

function dateLabel(value, compact = false) {
  if (!value) return "—";
  const options = compact ? { day: "2-digit", month: "short" } : { day: "2-digit", month: "2-digit", year: "numeric" };
  return new Intl.DateTimeFormat(getInterfaceLocale(), options).format(new Date(value));
}

function showsLabel(value) {
  if (value == null) return "—";
  return new Intl.NumberFormat(getInterfaceLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(Number(value));
}

function graphPoint(index, count, value, mode, maxShows) {
  const left = 34, top = 16, width = 272, height = 136;
  const x = count <= 1 ? left + width / 2 : left + (index / (count - 1)) * width;
  const y = mode === "shows"
    ? top + ((maxShows - Math.max(1, Number(value))) / Math.max(1, maxShows - 1)) * height
    : top + ((100 - Math.max(0, Math.min(100, Number(value)))) / 100) * height;
  return { x, y };
}

function lineMarkup(points, className, suffix = "") {
  if (!points.length) return "";
  const line = points.length > 1 ? `<polyline class="stationGraphLine ${className}" points="${points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")}"></polyline>` : "";
  return `${line}${points.map((point, index) => {
    const current = index === points.length - 1;
    return `<circle class="stationGraphPoint ${className} ${current ? "current" : ""}" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${current ? 5.5 : 2.4}"></circle>${current ? `<text class="stationGraphValue ${className}" x="${Math.min(304, point.x + 7).toFixed(1)}" y="${Math.max(11, point.y - 7).toFixed(1)}">${escapeHtml(point.label)}${suffix}</text>` : ""}`;
  }).join("")}`;
}

function graphMarkup(stats) {
  const timeline = stats.timeline || [];
  if (!timeline.length) return `<div class="stationGraphEmpty">${msg("stage.poka_nedostatochno_dannyh")}</div>`;
  const maxShows = Math.max(2, Math.ceil(Math.max(1, ...stats.learn.map((row) => Number(row.showsPerWord || 1)))));
  const firstTry = [], shows = [], tests = [];
  timeline.forEach((row, index) => {
    if (row.type === "learn") {
      if (row.firstTryPercent != null) {
        const point = graphPoint(index, timeline.length, row.firstTryPercent, "percent", maxShows);
        firstTry.push({ ...point, label: String(row.firstTryPercent) });
      }
      if (row.showsPerWord != null) {
        const point = graphPoint(index, timeline.length, row.showsPerWord, "shows", maxShows);
        shows.push({ ...point, label: showsLabel(row.showsPerWord) });
      }
    } else if (row.type === "station_test") {
      const point = graphPoint(index, timeline.length, row.percent, "percent", maxShows);
      tests.push({ ...point, label: String(row.percent) });
    }
  });
  const tickIndexes = [...new Set([0, Math.floor((timeline.length - 1) / 2), timeline.length - 1])];
  const ticks = tickIndexes.map((index) => {
    const point = graphPoint(index, timeline.length, 0, "percent", maxShows);
    return `<text class="stationGraphAxis stationGraphDate" x="${point.x.toFixed(1)}" y="181" text-anchor="middle">${escapeHtml(dateLabel(timeline[index]?.date, true))}</text>`;
  }).join("");
  return `<div class="stationMemoryChart">
    <svg viewBox="0 0 340 190" role="img" aria-label="${escapeHtml(msg("stage.progress_memory"))}">
      <line class="stationGraphGrid" x1="34" y1="16" x2="306" y2="16"></line>
      <line class="stationGraphGrid" x1="34" y1="84" x2="306" y2="84"></line>
      <line class="stationGraphGrid" x1="34" y1="152" x2="306" y2="152"></line>
      <text class="stationGraphAxis" x="4" y="20">100%</text><text class="stationGraphAxis" x="12" y="88">50%</text><text class="stationGraphAxis" x="20" y="156">0</text>
      <text class="stationGraphAxis stationGraphAxisRight" x="312" y="20">${maxShows}</text><text class="stationGraphAxis stationGraphAxisRight" x="312" y="156">1</text>
      ${lineMarkup(firstTry, "firstTry", "%")}
      ${lineMarkup(shows, "shows")}
      ${lineMarkup(tests, "tests", "%")}
      ${ticks}
    </svg>
  </div>`;
}

function problemMarkup(stats) {
  const rows = (stats.problems || []).slice(0, 7);
  if (!rows.length) return `<div class="stationEmptyState">${msg("stage.poka_nedostatochno_dannyh")}</div>`;
  return `<div class="stationProblemList">
    <div class="stationProblemHead"><span>${msg("stage.slovo")}</span><span>${msg("stage.shows_per_word")}</span><span>${msg("stage.test_errors")}</span></div>
    ${rows.map((row) => `<div class="stationProblemRow">
      <span class="stationProblemWord" title="${escapeHtml(row.trans)}">${escapeHtml(row.word)}</span>
      <span class="stationProblemMetric">${escapeHtml(showsLabel(row.showsPerWord))}</span>
      <span class="stationProblemMetric">${row.testErrors}</span>
    </div>`).join("")}
  </div>`;
}

function historyRows(stats, mode) {
  const learnMode = mode === "learn";
  const rows = (learnMode ? stats.learn : stats.tests).slice().reverse();
  const head = learnMode
    ? `<div class="stationHistoryHead"><span>${msg("stage.date")}</span><span>${msg("stage.first_try")}</span><span>${msg("stage.shows_per_word")}</span></div>`
    : `<div class="stationHistoryHead"><span>${msg("stage.date")}</span><span>${msg("stage.correct")}</span><span>${msg("stage.result")}</span></div>`;
  const body = rows.length ? rows.map((row) => learnMode
    ? `<div class="stationHistoryRow"><span>${escapeHtml(dateLabel(row.date))}</span><strong>${row.firstTryPercent == null ? "—" : `${row.firstTryPercent}%`}</strong><strong>${escapeHtml(showsLabel(row.showsPerWord))}</strong></div>`
    : `<div class="stationHistoryRow"><span>${escapeHtml(dateLabel(row.date))}</span><strong>${row.total ? `${row.correct}/${row.total}` : "—"}</strong><strong>${row.percent}%</strong></div>`
  ).join("") : `<div class="stationEmptyState">${msg("stage.no_completed_sessions")}</div>`;
  return `${head}${body}`;
}

function openHistory(context, stats) {
  let mode = "learn";
  const panel = context.modal.openContent({ title: msg("stage.history"), className: "stationHistoryModal", contentHtml: "" });
  const draw = () => {
    if (!panel.body) return;
    panel.body.innerHTML = `<div class="stationHistoryTabs bracketTabsShell"><div class="bracketTabsTrack">
      <button class="profilePrimaryTab ${mode === "learn" ? "active" : ""}" type="button" data-history-mode="learn">[ ${msg("stage.uchit_slova")} ]</button>
      <button class="profilePrimaryTab ${mode === "tests" ? "active" : ""}" type="button" data-history-mode="tests">[ ${msg("stage.tests")} ]</button>
    </div></div><div class="stationHistoryTable">${historyRows(stats, mode)}</div>`;
    panel.body.querySelectorAll("[data-history-mode]").forEach((button) => button.addEventListener("click", () => {
      const next = button.dataset.historyMode === "tests" ? "tests" : "learn";
      if (next === mode) return;
      mode = next;
      draw();
    }));
  };
  draw();
}

export function renderStationStatistics(station) {
  const stats = buildStationLearningStatistics(getActivityHistory(), station);
  return `<section class="stationPane stationStatisticsPane" data-station-pane="statistics">
    <section class="stationStatsSection stationMemorySection">
      <div class="stationStatsTitleRow">
        <h2 class="stationStatsHeading">${msg("stage.progress_memory")}</h2>
        <button class="stationHistoryButton" type="button" data-station-history aria-label="${escapeHtml(msg("stage.history"))}" title="${escapeHtml(msg("stage.history"))}">
          <img src="/assets/icons/ui/lucide/list-checks.svg" alt="" aria-hidden="true">
        </button>
      </div>
      ${graphMarkup(stats)}
      <div class="stationStatsLegend">
        <div class="stationLegendRow"><span class="stationLegendSwatch firstTry"></span><span>${msg("stage.first_try_goal")}</span></div>
        <div class="stationLegendRow"><span class="stationLegendSwatch shows"></span><span>${msg("stage.shows_per_word_goal")}</span></div>
        <div class="stationLegendRow"><span class="stationLegendSwatch tests"></span><span>${msg("stage.test_result_goal")}</span></div>
      </div>
    </section>
    <section class="stationStatsSection">
      <h2 class="stationStatsHeading">${msg("stage.problemnye_slova")}</h2>
      ${problemMarkup(stats)}
    </section>
  </section>`;
}

export function bindStationStatistics(context, station, { signal } = {}) {
  const button = context.root.querySelector("[data-station-history]");
  button?.addEventListener("click", () => openHistory(context, buildStationLearningStatistics(getActivityHistory(), station)), { signal });
}
