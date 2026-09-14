import { msg } from "../../shared/i18n/index.js?v=13.9.0";
import { getCurrentAuthState, subscribeToAuth } from "../../shared/auth/auth-service.js?v=13.10.12";
import { panel } from "../../shared/ui/panel.js?v=13.9.0";
import { uiIcon } from "../../shared/ui/icons.js?v=13.9.0";

const ASHYK_GAME_PATH = "/assets/ashyk-game/index.html";

let controller = null;
let gameController = null;
let authUnsubscribe = null;
let gameOverlay = null;

function publicGameSession(session) {
  if (!session?.access_token || !session?.refresh_token || !session?.user?.id) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    user: { id: session.user.id },
  };
}

function closeAshykGame() {
  authUnsubscribe?.();
  authUnsubscribe = null;
  gameController?.abort();
  gameController = null;
  gameOverlay?.remove();
  gameOverlay = null;
}

function openAshykGame() {
  closeAshykGame();
  gameController = new AbortController();
  const overlay = document.createElement("section");
  overlay.className = "ashykGameOverlay";
  overlay.setAttribute("aria-label", "Ашыкъ оюн");
  overlay.innerHTML = `
    <header class="ashykGameHeader">
      <button class="iconAction ashykGameBack" type="button" aria-label="Назад" title="Назад">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/><path d="M9 12h10"/></svg>
      </button>
      <strong>Ашыкъ оюн</strong>
    </header>
    <iframe class="ashykGameFrame" src="${ASHYK_GAME_PATH}" title="Ашыкъ оюн" allow="fullscreen" referrerpolicy="same-origin"></iframe>
  `;
  document.body.appendChild(overlay);
  gameOverlay = overlay;

  const frame = overlay.querySelector(".ashykGameFrame");
  const postSession = (state = getCurrentAuthState()) => {
    frame?.contentWindow?.postMessage({
      type: "alantil-auth",
      session: publicGameSession(state?.session),
    }, window.location.origin);
  };

  frame?.addEventListener("load", () => postSession(), { signal: gameController.signal });
  overlay.querySelector(".ashykGameBack")?.addEventListener("click", closeAshykGame, { signal: gameController.signal });
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || event.source !== frame?.contentWindow || event.data?.type !== "ashyk-auth-request") return;
    postSession();
  }, { signal: gameController.signal });
  authUnsubscribe = subscribeToAuth((state) => postSession(state));
}

export function mount(context) {
  controller = new AbortController();
  context.shell.setHeaderContent?.({ title: "Alan Til!" });
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
        <button class="menuItem" type="button" data-ashyk-game><span class="menuIcon">${uiIcon("puzzle")}</span><span class="menuItemText"><strong>Ашыкъ оюн</strong><small>3D · Alan → RU</small></span></button>
      </div>`,
  });
  context.root.querySelectorAll("[data-practice-route]").forEach((button) => {
    button.addEventListener("click", () => {
      const params = button.dataset.dictionarySlug ? { dictionarySlug: button.dataset.dictionarySlug } : {};
      context.router.navigate(button.dataset.practiceRoute, params);
    }, { signal: controller.signal });
  });
  context.root.querySelector("[data-ashyk-game]")?.addEventListener("click", openAshykGame, { signal: controller.signal });
}

export function unmount() {
  closeAshykGame();
  controller?.abort();
  controller = null;
}
