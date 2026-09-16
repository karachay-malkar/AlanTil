import { prepareAnalytics } from "../shared/analytics/analytics.js?v=13.9.0";
import { hasAuthCallback, waitForAuthInitialization } from "../shared/auth/auth-service.js?v=13.10.12";
import { hasPersistedAuthSession } from "../shared/auth/supabase-client.js?v=13.10.12";
import { initGuestProfilePrompt } from "../shared/auth/guest-profile-prompt.js?v=13.10.12";
import { initAdminAccess } from "../shared/admin/admin-access.js?v=13.15.9";
import { initializeProgressSystem } from "../shared/progress/progress-sync.js?v=13.15.12";
import { getInterfaceLanguage, initializeI18n, msg } from "../shared/i18n/index.js?v=13.15.12";
import { startSocialInboxController } from "../shared/social/social-service.js?v=16.7.0";
import { socialMessage } from "../../packages/alantil-core/social-i18n.js";
import { createTelegramAdapter, initTelegram } from "../shared/platform/telegram.js?v=13.9.0";
import { initPrivacyController } from "../shared/privacy/privacy-controller.js?v=13.9.0";
import { createModalService } from "../shared/ui/modal.js?v=13.15.10";
import { runLearningSetup } from "../features/onboarding/index.js?v=13.10.12";
import { createRouter } from "./router.js?v=16.7.0";
import { createShell } from "./shell.js?v=16.7.0";

const RELEASE_VERSION = "16.7.0";
const FALLBACK_ROUTE_PARAM = "__alantil_route";

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`/service-worker.js?v=${RELEASE_VERSION}`, { scope: "/" })
      .catch((error) => console.warn("Service worker registration failed", error));
  }, { once: true });
}
function restoreFallbackRoute() {
  const url = new URL(window.location.href);
  const target = String(url.searchParams.get(FALLBACK_ROUTE_PARAM) || "");
  if (!target.startsWith("/") || target.startsWith("//")) return false;
  window.history.replaceState(null, "", target);
  return true;
}
function normalizeInitialLearningPath() {
  if (!["/", "/path", "/path/"].includes(window.location.pathname)) return;
  window.history.replaceState(null, "", `/path/oblivion${window.location.search}${window.location.hash}`);
}
async function linkRestoredAccountVisit() {
  try {
    const { recordAnonymousPageView } = await import("../shared/analytics/visitor-analytics.js?v=13.15.9");
    await recordAnonymousPageView({ pagePath: window.location.pathname || "/", pageReferrer: document.referrer, appVersion: RELEASE_VERSION });
  } catch {}
}
function syncFriendsNavLabel() {
  const label=document.querySelector('[data-social-nav-label]');
  if(label)label.textContent=socialMessage(getInterfaceLanguage(),'friends');
}
function renderFriendsBadge(counts={}) {
  const badge=document.querySelector('[data-friends-badge]');
  if(!badge)return;
  const total=Math.max(0,Number(counts.total)||0);
  badge.hidden=!total;
  badge.textContent=total>99?'99+':String(total);
}

async function bootstrap() {
  restoreFallbackRoute();
  normalizeInitialLearningPath();
  initializeI18n();
  syncFriendsNavLabel();
  window.addEventListener('alantil:languagechange',syncFriendsNavLabel);
  prepareAnalytics();
  initAdminAccess();
  registerServiceWorker();

  const callbackVisit = hasAuthCallback() || window.location.pathname === "/auth/callback";
  const persistedAuth = hasPersistedAuthSession();
  const authInitialization = waitForAuthInitialization();
  const telegram = createTelegramAdapter();
  const shell = createShell();
  const modal = createModalService(shell.modalRoot);
  const context = { root: shell.root, shell, modal, telegram, ensureStyle() {} };

  if (callbackVisit) await authInitialization;
  await initializeProgressSystem();
  if (!callbackVisit && !persistedAuth) {
    const setupWasShown = await runLearningSetup({ shell });
    if (setupWasShown) window.history.replaceState(null, "", "/profile/account");
  }

  shell.renderHome();
  const router = createRouter({ shell, modal, context });
  let dictionaryRefreshQueued = false;
  const refreshDictionaryScreen = () => {
    if (dictionaryRefreshQueued) return;
    dictionaryRefreshQueued = true;
    globalThis.setTimeout(async () => {
      dictionaryRefreshQueued = false;
      const route = router.getCurrent().route;
      if (!route.startsWith("path.") && !route.startsWith("learn.")) return;
      await router.refresh({ background: true, reason: "dictionary_update" });
    }, 100);
  };
  window.addEventListener("alantil:dictionary-updated", refreshDictionaryScreen);
  window.addEventListener("alantil:scope-ready", () => { void router.refresh({ background: true, reason: "storage_scope" }); });
  await router.start();

  let stopSocial=()=>{};
  try { stopSocial=await startSocialInboxController(renderFriendsBadge); } catch { renderFriendsBadge({total:0}); }
  window.addEventListener('pagehide',()=>stopSocial(),{once:true});

  if (persistedAuth && !callbackVisit) {
    void authInitialization.then(async () => { await linkRestoredAccountVisit(); await router.refresh({ background: true, reason: "auth_ready" }); });
  }
  void initPrivacyController({ appRouter: router });
  if (!callbackVisit) initGuestProfilePrompt({ modal, router });
  void initTelegram({ adapter: telegram, onReady(webApp) { router.attachTelegram(webApp); } }).catch((error) => {
    router.releaseTelegramLaunchUrl();
    console.warn("Telegram WebApp initialization failed", error);
  });
}

bootstrap().catch((error) => {
  console.error("Application bootstrap failed", error);
  const shell = document.getElementById("appRoot");
  if (shell) shell.innerHTML = `<section class="screenState screenStateError">${msg("common.ne_udalos_zapustit_prilozhenie")}</section>`;
});
