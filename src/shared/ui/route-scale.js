import { escapeHtml } from "./html.js";

function dotCount(height, routeHeight) {
  if (!routeHeight) return 4;
  const share = height / routeHeight;
  return Math.max(3, Math.min(10, Math.round(3 + share * 24)));
}

function selectorValue(value) {
  return CSS.escape(String(value ?? ""));
}

export function createRouteScale({ root, viewport, catalogs = [], signal }) {
  const scale = root.querySelector(".routeScale");
  const routeMap = root.querySelector(".routeMap");
  if (!scale || !viewport || !routeMap) return;
  let frame = 0;
  let progressItems = [];

  function measureAndRender() {
    const routeHeight = Math.max(1, routeMap.scrollHeight);
    const parts = [];

    catalogs.forEach((catalog) => {
      const catalogElement = root.querySelector(`[data-route-catalog="${selectorValue(catalog.catalogId)}"]`);
      if (!catalogElement) return;
      parts.push(`<button class="iconAction routeScaleDiamond" type="button" data-scroll-catalog="${escapeHtml(catalog.catalogId)}" aria-label="Перейти к рубежу словаря ${escapeHtml(catalog.name)}"><span></span></button>`);
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
  signal?.addEventListener("abort", () => frame && cancelAnimationFrame(frame), { once: true });
}
