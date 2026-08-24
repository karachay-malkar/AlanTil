import { msg } from "../i18n/index.js?v=13.9.0";
import { escapeHtml } from "./html.js?v=13.9.0";

const ROUTE_WAVE_STEPS = 4;

function dotCount(height, routeHeight) {
  if (!routeHeight) return 4;
  const share = height / routeHeight;
  return Math.max(3, Math.min(10, Math.round(3 + share * 24)));
}

function selectorValue(value) {
  return CSS.escape(String(value ?? ""));
}

function applyRouteWavePattern(routeMap) {
  const nodes = Array.from(routeMap.querySelectorAll(".stationNode"));
  nodes.forEach((node, index) => {
    const ordinal = Number.parseInt(node.querySelector(".stationOrdinal")?.textContent || "", 10);
    const sequenceIndex = Number.isFinite(ordinal) && ordinal > 0 ? ordinal - 1 : index;
    node.dataset.routeStep = String((sequenceIndex % ROUTE_WAVE_STEPS) + 1);
  });
  return nodes;
}

function ensureRouteConnector(routeMap) {
  let svg = routeMap.querySelector(":scope > .routeConnector");
  if (!svg) {
    const ns = "http://www.w3.org/2000/svg";
    svg = document.createElementNS(ns, "svg");
    svg.classList.add("routeConnector");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const path = document.createElementNS(ns, "path");
    path.classList.add("routeConnectorPath");
    svg.append(path);
    routeMap.prepend(svg);
  }
  return { svg, path: svg.querySelector(".routeConnectorPath") };
}

function drawRouteConnector(routeMap, connector) {
  const { svg, path } = connector || {};
  if (!svg || !path) return;
  const nodes = applyRouteWavePattern(routeMap);
  if (nodes.length < 2) {
    path.setAttribute("d", "");
    return;
  }

  const mapRect = routeMap.getBoundingClientRect();
  const points = nodes.map((node) => {
    const target = node.querySelector(".stationProgressRing") || node;
    const rect = target.getBoundingClientRect();
    return {
      x: rect.left - mapRect.left + rect.width / 2,
      y: rect.top - mapRect.top + rect.height / 2,
    };
  });

  const width = Math.max(1, routeMap.clientWidth);
  const height = Math.max(1, routeMap.scrollHeight);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.style.width = `${width}px`;
  svg.style.height = `${height}px`;

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const middleY = (previous.y + current.y) / 2;
    d += ` C ${previous.x.toFixed(2)} ${middleY.toFixed(2)}, ${current.x.toFixed(2)} ${middleY.toFixed(2)}, ${current.x.toFixed(2)} ${current.y.toFixed(2)}`;
  }
  path.setAttribute("d", d);
}

export function createRouteScale({ root, viewport, catalogs = [], signal }) {
  const scale = root.querySelector(".routeScale");
  const routeMap = root.querySelector(".routeMap");
  if (!scale || !viewport || !routeMap) return;
  applyRouteWavePattern(routeMap);
  const connector = ensureRouteConnector(routeMap);
  let frame = 0;
  let progressItems = [];

  function measureAndRender() {
    drawRouteConnector(routeMap, connector);
    const routeHeight = Math.max(1, routeMap.scrollHeight);
    const parts = [];

    catalogs.forEach((catalog) => {
      const catalogElement = root.querySelector(`[data-route-catalog="${selectorValue(catalog.catalogId)}"]`);
      if (!catalogElement) return;
      parts.push(`<button class="iconAction routeScaleDiamond" type="button" data-scroll-catalog="${escapeHtml(catalog.catalogId)}" aria-label="${msg("common.pereyti_k_rubezhu_slovarya", { name: escapeHtml(catalog.name) })}"><span></span></button>`);
      const groups = [...(catalog.groups || [])].reverse();
      groups.forEach((group, groupIndex) => {
        const groupElement = root.querySelector(`[data-route-section="${selectorValue(`${catalog.catalogId}::${group.groupId}`)}"]`);
        const count = dotCount(groupElement?.offsetHeight || 1, routeHeight);
        for (let index = 0; index < count; index += 1) parts.push(`<span class="routeScaleDot" data-scale-progress></span>`);
        if (groupIndex < groups.length - 1) {
          parts.push(`<span class="routeScaleSection" data-scale-progress aria-hidden="true"></span>`);
        }
      });
    });

    scale.innerHTML = parts.join("");
    progressItems = Array.from(scale.querySelectorAll("[data-scale-progress],.routeScaleDiamond"));
    scale.querySelectorAll("[data-scroll-catalog]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = root.querySelector(`[data-catalog-end="${selectorValue(button.dataset.scrollCatalog)}"]`)
          || root.querySelector(`[data-route-catalog="${selectorValue(button.dataset.scrollCatalog)}"]`);
        if (!target) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const top = Math.max(0, target.offsetTop - viewport.clientHeight * 0.16);
        viewport.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
      }, { signal });
    });
    update();
  }

  function update() {
    frame = 0;
    const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const routeProgress = maxScroll ? (maxScroll - viewport.scrollTop) / maxScroll : 0;
    const passed = Math.round(routeProgress * progressItems.length);
    progressItems.forEach((item, index) => {
      item.classList.toggle("isPassed", index >= progressItems.length - passed);
      item.classList.toggle("isCurrent", index === Math.max(0, progressItems.length - passed - 1));
    });
  }

  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  viewport.addEventListener("scroll", schedule, { signal, passive: true });
  window.addEventListener("resize", measureAndRender, { signal });
  requestAnimationFrame(measureAndRender);
  Promise.resolve(document.fonts?.ready).catch(() => {}).then(() => requestAnimationFrame(measureAndRender));
  signal?.addEventListener("abort", () => frame && cancelAnimationFrame(frame), { once: true });
}