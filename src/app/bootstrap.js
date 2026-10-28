import { prepareAnalytics } from "../shared/analytics/analytics.js?v=16.8.0.16";
import { APP_VERSION } from "../../packages/alantil-core/release.js?v=17.2.36";
import { hasAuthCallback, waitForAuthInitialization } from "../shared/auth/auth-service.js?v=16.8.0.16";
import { applyOneTimeAuthMigration, hasPersistedAuthSession } from "../shared/auth/supabase-client.js?v=16.8.0.16";
import { initAdminAccess } from "../shared/admin/admin-access.js?v=16.8.0.16";
import { initializeProgressSystem } from "../shared/progress/progress-sync.js?v=16.8.0.16";
import { migrateAllStorageKeys } from "../shared/progress/storage-scope.js?v=16.8.0.16";
import { getProfile } from "../shared/profile/profile-service.js?v=16.8.0.16";
import { hasCompleteProfile } from "../../packages/alantil-core/profile.js?v=16.8.0.16";
import { getInterfaceLanguage, initializeI18n, msg } from "../shared/i18n/index.js?v=16.8.0.16";
import { getSocialClient, startSocialInboxController } from "../shared/social/social-service.js?v=16.8.0.16";
import { socialMessage } from "../../packages/alantil-core/social-i18n.js?v=16.8.0.16";
import { beginAshykEntry, finishAshykEntry, isAshykEntryPending } from "../../packages/ashyk-game/entry-state.js?v=16.8.0.16";
import { ensureCurrentAshykBuild, setPendingAshykInvite } from "../shared/social/ashyk-handoff.js?v=16.8.0.16";
import { isAshykModeAllowed } from "../../packages/alantil-core/ashyk-access.js?v=16.8.0.16";
import { getCurrentAuthState } from "../shared/auth/auth-service.js?v=16.8.0.16";
import { createTelegramAdapter, initTelegram } from "../shared/platform/telegram.js?v=16.8.0.16";
import { initPrivacyController } from "../shared/privacy/privacy-controller.js?v=16.8.0.16";
import { createModalService } from "../shared/ui/modal.js?v=16.8.0.16";
import { createRouter } from "./router.js?v=17.2.36";
import { createShell } from "./shell.js?v=16.8.0.16";

const ASSET_VERSION = "17.2.36";
const FALLBACK_ROUTE_PARAM = "__alantil_route";
const PROFILE_REQUIRED_FLOWS = new Set(["legacy_google", "recovery"]);

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  // A new worker controls subsequent navigations; do not tear down a visible session.
  void navigator.serviceWorker.register(`/service-worker.js?v=${ASSET_VERSION}`, {
    scope: "/",
    updateViaCache: "none",
  }).then((registration) => registration.update()).catch((error) => {
    console.warn("Service worker registration failed", error);
  });
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
  window.history.replaceState(null, "", `/path/roots${window.location.search}${window.location.hash}`);
}
async function requiresProfileCompletion() {
  const authState = getCurrentAuthState();
  if (!authState?.user?.id) return false;
  if (PROFILE_REQUIRED_FLOWS.has(String(authState.flow || ""))) return true;
  try { return !hasCompleteProfile(await getProfile(authState.user.id)); }
  catch { return false; }
}
async function linkRestoredAccountVisit() {
  try {
    const { recordAnonymousPageView } = await import("../shared/analytics/visitor-analytics.js?v=16.8.0.16");
    await recordAnonymousPageView({ pagePath: window.location.pathname || "/", pageReferrer: document.referrer, appVersion: APP_VERSION });
  } catch {}
}
function syncFriendsNavLabel() {
  const label=document.querySelector('[data-social-nav-label]');
  if(label){const text=socialMessage(getInterfaceLanguage(),'community');label.textContent=text;label.closest('[data-route="friends.home"]')?.setAttribute('aria-label',text);}
}
function renderFriendsBadge(counts={}) {
  const badge=document.querySelector('[data-friends-badge]');
  if(!badge)return;
  const total=Math.max(0,Number(counts.total)||0);
  badge.hidden=!total;
  badge.textContent=total>99?'99+':String(total);
}

async function bootstrap() {
  try { globalThis.performance?.mark?.("alantil:bootstrap:start"); } catch {}
  restoreFallbackRoute();
  normalizeInitialLearningPath();
  migrateAllStorageKeys();
  initializeI18n();
  syncFriendsNavLabel();
  window.addEventListener('alantil:languagechange',syncFriendsNavLabel);
  prepareAnalytics();
  initAdminAccess();

  const callbackVisit = hasAuthCallback() || window.location.pathname === "/auth/callback";
  const authMigrationRequired = applyOneTimeAuthMigration({ preserveSession: callbackVisit });
  const persistedAuth = hasPersistedAuthSession();
  if (authMigrationRequired) window.history.replaceState(null, "", "/profile/account");
  const authInitialization = waitForAuthInitialization();
  const telegram = createTelegramAdapter();
  const shell = createShell();
  try { globalThis.performance?.mark?.("alantil:shell:ready"); } catch {}
  const modal = createModalService(shell.modalRoot);
  const context = { root: shell.root, shell, modal, telegram };

  if (callbackVisit || persistedAuth) await authInitialization;
  await initializeProgressSystem();
  if ((callbackVisit || persistedAuth) && await requiresProfileCompletion()) {
    window.history.replaceState(null, "", "/profile/account");
  }
  if (!callbackVisit && !persistedAuth && !authMigrationRequired) {
    const { runLearningSetup } = await import("../features/onboarding/index.js?v=16.8.0.30");
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
      const dictionaryDrivenRoute = route.startsWith("path.")
        || route.startsWith("learn.")
        || route === "test.menu"
        || route === "match.menu";
      if (!dictionaryDrivenRoute) return;
      await router.refresh({ background: true, reason: "dictionary_update" });
    }, 100);
  };
  window.addEventListener("alantil:dictionary-updated", refreshDictionaryScreen);
  window.addEventListener("alantil:scope-ready", () => {
    const route = router.getCurrent().route;
    // Account handles auth changes itself; the path patches progress in-place.
    if (route === "path.home" || route === "account.home") return;
    void router.refresh({ background: true, reason: "storage_scope" });
  });
  registerServiceWorker();
  await router.start();
  try { globalThis.performance?.mark?.("alantil:route:ready"); } catch {}
  // Install automatic Guided Help only after the first route has rendered.
  const installGuide=()=>{ void import("../features/onboarding/guide.js?v=17.2.36").catch(error=>console.warn("Guided Help could not load",error)); };
  if(typeof requestIdleCallback==="function") requestIdleCallback(installGuide,{timeout:1400});
  else globalThis.setTimeout(installGuide,200);

  let ashykNoticeKey='';
  const showGlobalAshykState=({snapshot,activeRoom}={})=>{
    const userId=String(getCurrentAuthState()?.session?.user?.id||'');
    if(!isAshykModeAllowed('online',{userId})){ashykNoticeKey='';return;}
    if(isAshykEntryPending()){ashykNoticeKey='';return;}
    const invite=Array.isArray(snapshot?.ashyk_invites)?snapshot.ashyk_invites[0]:null;
    if(router.getCurrent().route==='practice.ashyk'&&(!invite||activeRoom?.status==='playing'))return;
    const resumable=activeRoom?.status==='playing'||(activeRoom?.status==='waiting'&&activeRoom?.guest_user_id)?activeRoom:null;
    const key=invite?.invite_id?`invite:${invite.invite_id}`:resumable?.id?`room:${resumable.id}:${resumable.status}`:'';
    if(!key){ashykNoticeKey='';return;}
    if(key===ashykNoticeKey)return;
    ashykNoticeKey=key;

    const locale=getInterfaceLanguage();
    const acceptText=socialMessage(locale,'accept');
    const declineText=socialMessage(locale,'decline');
    const returnText=socialMessage(locale,'resume');
    const panel=modal.openContent({
      title:msg("practice.ashyk"),
      className:'ashykGlobalInviteModal',
      dismissible:false,
      contentHtml:invite
        ?`<p data-ashyk-global-copy></p><div class="modalActions"><button class="btn actionText" type="button" data-ashyk-global-decline>${declineText}</button><button class="btn actionPrimary" type="button" data-ashyk-global-accept>${acceptText}</button></div>`
        :`<p data-ashyk-global-copy></p><div class="modalActions"><button class="btn actionPrimary" type="button" data-ashyk-global-accept>${returnText}</button></div>`
    });
    const copy=panel.body?.querySelector('[data-ashyk-global-copy]');
    if(copy)copy.textContent=invite
      ?socialMessage(locale,'challengeFrom',{name:invite.nickname||'—'})
      :resumable.status==='playing'
        ?socialMessage(locale,'unfinishedGame')
        :socialMessage(locale,'waitingForYou');

    const accept=panel.body?.querySelector('[data-ashyk-global-accept]');
    const decline=panel.body?.querySelector('[data-ashyk-global-decline]');
    accept?.addEventListener('click',async()=>{
      accept.disabled=true;
      let entering=false;
      try{
        if(invite){
          if(!(await ensureCurrentAshykBuild({kind:'accept',inviteId:String(invite.invite_id)}))){return;}
        }else if(!(await ensureCurrentAshykBuild({kind:'room',roomId:String(resumable.id)}))){return;}
        beginAshykEntry();
        entering=true;
        if(invite){
          const [{createAshykOnlineAdapter},client]=await Promise.all([
            import("../../packages/ashyk-game/online.js?v=16.8.0.30"),
            getSocialClient()
          ]);
          const online=createAshykOnlineAdapter(client),result=await online.acceptInvite(invite.invite_id);
          if(!result?.room)throw new Error('room unavailable');
          setPendingAshykInvite(result);
        }else setPendingAshykInvite({room:resumable,invite:null});
        ashykNoticeKey='';
        panel.close();
        if(router.getCurrent().route==='practice.ashyk')await router.refresh();
        else await router.navigate('practice.ashyk');
      }catch(error){
        accept.disabled=false;
        if(copy)copy.textContent=String(error?.message||socialMessage(locale,'error'));
      }finally{
        if(entering)finishAshykEntry();
      }
    });
    decline?.addEventListener('click',async()=>{
      decline.disabled=true;
      try{
        const [{createAshykOnlineAdapter},client]=await Promise.all([
          import("../../packages/ashyk-game/online.js?v=16.8.0.30"),
          getSocialClient()
        ]);
        const online=createAshykOnlineAdapter(client);
        await online.declineInvite(invite.invite_id);
        ashykNoticeKey='';
        panel.close();
      }catch(error){
        decline.disabled=false;
        if(copy)copy.textContent=String(error?.message||socialMessage(locale,'error'));
      }
    });
  };

  let stopSocial=()=>{};
  try { stopSocial=await startSocialInboxController(renderFriendsBadge,showGlobalAshykState); } catch { renderFriendsBadge({total:0}); }
  window.addEventListener('pagehide',()=>stopSocial(),{once:true});

  if (persistedAuth && !callbackVisit) {
    // Auth initialization was awaited before router.start(); no second screen mount.
    void authInitialization.then(linkRestoredAccountVisit);
  }
  void initPrivacyController({ appRouter: router });
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
