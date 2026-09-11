import { msg } from "../../shared/i18n/index.js?v=13.9.0";
import { trackEvent } from "../../shared/analytics/analytics.js?v=13.9.0";
import { panel } from "../../shared/ui/panel.js?v=13.9.0";
import { uiIcon } from "../../shared/ui/icons.js?v=13.9.0";
import { ASHYK_GAME_RENDERER_URL } from "../../../packages/alantil-core/ashyk-game.js";

let controller = null;
let gameFrame = null;

const ASHYK_ICON = `
  <svg class="uiIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M7.2 6.1a3.3 3.3 0 1 0-4.7 4.7 3.3 3.3 0 0 0 2.6.9l7.2 7.2a3.3 3.3 0 0 0 .9 2.6 3.3 3.3 0 1 0 4.7-4.7 3.3 3.3 0 0 0-2.6-.9L8.1 8.7a3.3 3.3 0 0 0-.9-2.6Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

function mountHome(context) {
  context.shell.setHeaderContent?.({ title: "" });
  context.root.innerHTML = panel({
    title: msg("practice.praktika"),
    classes: "practicePanel",
    viewClasses: "practiceView",
    body: `
      <div class="practiceMenu">
        <button class="menuItem" type="button" data-practice-route="test.menu"><span class="menuIcon">${uiIcon("listChecks")}</span><span class="menuItemText"><strong>${msg("practice.test")}</strong><small>${msg("practice.proverka_slov_iz_vybrannyh_razdelov")}</small></span></button>
        <button class="menuItem" type="button" data-practice-route="match.menu"><span class="menuIcon">${uiIcon("puzzle")}</span><span class="menuItemText"><strong>${msg("practice.sopostavlenie")}</strong><small>${msg("practice.soedinenie_slov_i_perevodov")}</small></span></button>
        <button class="menuItem" type="button" data-practice-route="learn.set" data-dictionary-slug="favorites"><span class="menuIcon">${uiIcon("favorite")}</span><span class="menuItemText"><strong>${msg("common.izbrannoe")}</strong><small>${msg("learn.uchit_slova")}</small></span></button>
        <button class="menuItem" type="button" data-practice-route="songs.playlists"><span class="menuIcon">${uiIcon("music2")}</span><span class="menuItemText"><strong>${msg("practice.pesni")}</strong><small>${msg("practice.yazyk_v_zhivom_kontekste")}</small></span></button>
        <button class="menuItem" type="button" data-practice-ashyk><span class="menuIcon ashykMenuIcon">${ASHYK_ICON}</span><span class="menuItemText"><strong>Ашыкъ оюн</strong><small>Народная 3D-игра</small></span></button>
      </div>`,
  });

  context.root.querySelectorAll("[data-practice-route]").forEach((button) => {
    button.addEventListener("click", () => {
      const params = button.dataset.dictionarySlug ? { dictionarySlug: button.dataset.dictionarySlug } : {};
      context.router.navigate(button.dataset.practiceRoute, params);
    }, { signal: controller.signal });
  });

  context.root.querySelector("[data-practice-ashyk]")?.addEventListener("click", () => {
    trackEvent("ashyk_game_open", { surface: "practice", mode: "embedded" });
    context.router.navigate("practice.home", { section: "ashyk" });
  }, { signal: controller.signal });
}

function mountAshyk(context) {
  context.shell.configureScreen?.("practice.ashyk");
  context.shell.setBackVisible?.(true);
  context.shell.setHeaderContent?.({ title: "Ашыкъ оюн" });
  context.root.innerHTML = `
    <section class="view screen ashykGameView" aria-label="Ашыкъ оюн">
      <div class="ashykGameSurface">
        <div class="ashykGameLoading" data-ashyk-loading>Подготовка игры…</div>
        <iframe
          class="ashykGameFrame"
          data-ashyk-frame
          title="Ашыкъ оюн"
          src="${ASHYK_GAME_RENDERER_URL}"
          allow="fullscreen; gamepad"
          loading="eager"
          referrerpolicy="strict-origin-when-cross-origin"
        ></iframe>
      </div>
    </section>`;
  gameFrame = context.root.querySelector("[data-ashyk-frame]");
  const loading = context.root.querySelector("[data-ashyk-loading]");
  gameFrame?.addEventListener("load", () => loading?.remove(), { once: true, signal: controller.signal });
}

export function mount(context, params = {}) {
  controller = new AbortController();
  if (params.section === "ashyk") {
    mountAshyk(context);
    return;
  }
  mountHome(context);
}

export function unmount() {
  controller?.abort();
  controller = null;
  if (gameFrame) {
    gameFrame.src = "about:blank";
    gameFrame = null;
  }
}
