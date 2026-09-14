import { msg } from "../../shared/i18n/index.js?v=13.9.0";
import { getCurrentAuthState, subscribeToAuth } from "../../shared/auth/auth-service.js?v=13.10.12";
import { getWords } from "../../shared/data/word-repository.js?v=13.15.12";
import { panel } from "../../shared/ui/panel.js?v=13.9.0";
import { uiIcon } from "../../shared/ui/icons.js?v=13.9.0";

const ASHYK_GAME_PATH = "/assets/ashyk-game/index.html?v=16.6.10.3";

let controller = null;
let gameController = null;
let authUnsubscribe = null;
let gameOverlay = null;
let restoreGameShell = null;

function publicGameSession(session) {
  if (!session?.access_token || !session?.refresh_token || !session?.user?.id) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    user: { id: session.user.id },
  };
}

function ashykDictionaryWords(words = []) {
  const seen = new Set();
  return (Array.isArray(words) ? words : []).flatMap((word) => {
    const dictionaryId = String(word?.dictionary_id || word?.dictionaryId || "").trim();
    const storyId = String(word?.story_id || word?.storyId || "").trim();
    const id = String(word?.id || word?.word_id || "").trim();
    const alan = String(word?.word || word?.wordAlanCyrillic || "").trim();
    const trans = String(word?.trans || word?.translationRu || "").trim();
    const pos = String(word?.pos || "").trim().toLowerCase();
    if (dictionaryId !== "intermediate" || storyId !== "roots" || word?.usedInTest !== true || !id || !alan || !trans || !pos || seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      word: alan,
      trans,
      pos,
      synonyms: Array.isArray(word?.synonyms) ? word.synonyms : [],
    }];
  });
}

function closeAshykGame({ restoreShell = true } = {}) {
  authUnsubscribe?.();
  authUnsubscribe = null;
  gameController?.abort();
  gameController = null;
  gameOverlay?.remove();
  gameOverlay = null;
  if (restoreShell) restoreGameShell?.();
  restoreGameShell = null;
}

async function openAshykGame(context) {
  closeAshykGame({ restoreShell: false });
  gameController = new AbortController();
  const shell = context.shell;
  const dictionaryPromise = getWords().then(ashykDictionaryWords).catch(() => []);

  shell.configureScreen?.("test.menu");
  shell.setBackVisible?.(true);
  shell.setHeaderContent?.({ title: "Ашыкъ оюн" });
  shell.setActiveNav?.("practice.home");
  restoreGameShell = () => {
    shell.configureScreen?.("practice.home");
    shell.setBackVisible?.(false);
    shell.setActiveNav?.("practice.home");
  };

  const overlay = document.createElement("section");
  overlay.className = "ashykGameOverlay";
  overlay.setAttribute("aria-label", "Ашыкъ оюн");
  overlay.innerHTML = `<iframe class="ashykGameFrame" src="${ASHYK_GAME_PATH}" title="Ашыкъ оюн" allow="fullscreen" referrerpolicy="same-origin"></iframe>`;
  shell.viewport.appendChild(overlay);
  gameOverlay = overlay;

  const frame = overlay.querySelector(".ashykGameFrame");
  const postSession = (state = getCurrentAuthState()) => {
    frame?.contentWindow?.postMessage({
      type: "alantil-auth",
      session: publicGameSession(state?.session),
    }, window.location.origin);
  };
  const postDictionary = async () => {
    const words = await dictionaryPromise;
    frame?.contentWindow?.postMessage({ type: "alantil-dictionary", words }, window.location.origin);
  };

  frame?.addEventListener("load", () => {
    postSession();
    void postDictionary();
  }, { signal: gameController.signal });
  shell.backButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeAshykGame();
  }, { capture: true, signal: gameController.signal });
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || event.source !== frame?.contentWindow) return;
    if (event.data?.type === "ashyk-auth-request") postSession();
    if (event.data?.type === "ashyk-dictionary-request") void postDictionary();
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
        <button class="menuItem" type="button" data-ashyk-game><span class="menuIcon">${uiIcon("puzzle")}</span><span class="menuItemText"><strong>Ашыкъ оюн</strong><small>3D · Возвращение к истокам · Alan → RU</small></span></button>
      </div>`,
  });
  context.root.querySelectorAll("[data-practice-route]").forEach((button) => {
    button.addEventListener("click", () => {
      const params = button.dataset.dictionarySlug ? { dictionarySlug: button.dataset.dictionarySlug } : {};
      context.router.navigate(button.dataset.practiceRoute, params);
    }, { signal: controller.signal });
  });
  context.root.querySelector("[data-ashyk-game]")?.addEventListener("click", () => void openAshykGame(context), { signal: controller.signal });
}

export function unmount() {
  closeAshykGame({ restoreShell: false });
  controller?.abort();
  controller = null;
}
