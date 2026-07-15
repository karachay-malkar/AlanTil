import { escapeHtml } from "./html.js";

function dotCount(height, totalHeight) {
  if (!totalHeight) return 4;
  const ratio = height / totalHeight;
  return Math.max(3, Math.min(10, Math.round(3 + ratio * 14)));
}

export function createRouteScale({ root, viewport, catalogs, signal }) {
  const scale = root.querySelector(".routeScale");
  if (!scale || !viewport) return;
  let frame = 0;
  let items = [];

  function measureAndRender() {
    const routeHeight = Math.max(1, root.querySelector(".routeMap")?.scrollHeight || 1);
    const measured = catalogs.map((catalog) => {
      const element = root.querySelector(`[data-route-catalog="${CSS.escape(catalog.catalogId)}"]`);
      return { ...catalog, element, height: Math.max(1, element?.offsetHeight || 1) };
    });
    const totalHeight = measured.reduce((sum, catalog) => sum + catalog.height, 0) || routeHeight;
    const html = [];
    measured.forEach((catalog) => {
      const count = dotCount(catalog.height, totalHeight);
      for (let i = 0; i < count; i += 1) html.push(`<span class="routeScaleDot" data-scale-progress></span>`);
      html.push(`<button class="routeScaleDiamond" type="button" data-scroll-catalog="${escapeHtml(catalog.catalogId)}" aria-label="Перейти к концу каталога ${escapeHtml(catalog.name)}"><span></span></button>`);
    });
    scale.innerHTML = html.join("");
    items = Array.from(scale.querySelectorAll("[data-scale-progress],.routeScaleDiamond"));
    scale.querySelectorAll("[data-scroll-catalog]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = root.querySelector(`[data-route-catalog="${CSS.escape(button.dataset.scrollCatalog)}"]`);
        if (!target) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        viewport.scrollTo({ top: target.offsetTop, behavior: reduced ? "auto" : "smooth" });
      }, { signal });
    });
    update();
  }

  function update() {
    frame = 0;
    const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const progress = maxScroll ? (maxScroll - viewport.scrollTop) / maxScroll : 0;
    const passed = Math.round(progress * items.length);
    items.forEach((item, index) => item.classList.toggle("isPassed", index >= items.length - passed));
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  viewport.addEventListener("scroll", schedule, { signal, passive: true });
  window.addEventListener("resize", measureAndRender, { signal });
  requestAnimationFrame(measureAndRender);
  signal.addEventListener("abort", () => frame && cancelAnimationFrame(frame), { once: true });
}
