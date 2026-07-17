import {
  getCurrentAuthState,
  hasAuthCallback,
  subscribeToAuth,
} from "./auth-service.js?v=13.10.1";
import { hasPersistedAuthSession } from "./supabase-client.js?v=13.10.1";
import { msg } from "../i18n/index.js?v=13.10.1";
import { escapeHtml } from "../ui/html.js?v=13.9.0";

const SESSION_KEY = "alantil_guest_profile_prompt_seen_v1";
let unsubscribeAuth = null;
let activePrompt = null;

function isCallbackVisit() {
  return hasAuthCallback() || window.location.pathname === "/auth/callback";
}

function wasShownThisVisit() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markShownThisVisit() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Restricted session storage must not block the interface.
  }
}

function promptMarkup() {
  return `<div class="guestProfilePrompt">
    <strong class="guestProfilePromptTitle">${escapeHtml(msg("account.sozdayte_profil_cherez_google_ili_apple"))}</strong>
    <p>${escapeHtml(msg("account.otdelnaya_registratsiya_i_parol_ne_nuzhny"))}</p>
    <p>${escapeHtml(msg("account.profil_pozvolit_sohranyat_progress"))}</p>
  </div>`;
}

async function showPrompt({ modal, router }) {
  if (activePrompt || wasShownThisVisit() || isCallbackVisit() || getCurrentAuthState().user) return false;
  markShownThisVisit();
  activePrompt = modal.confirm({
    message: promptMarkup(),
    confirmText: msg("account.voyti_v_akkaunt"),
    cancelText: msg("account.prodolzhit_kak_gost"),
  });
  try {
    const accepted = await activePrompt;
    if (accepted) await router.navigate("account.home");
    return accepted;
  } finally {
    activePrompt = null;
  }
}

export function initGuestProfilePrompt({ modal, router } = {}) {
  unsubscribeAuth?.();
  unsubscribeAuth = null;
  if (!modal || !router || wasShownThisVisit() || isCallbackVisit()) return () => {};

  const schedulePrompt = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => void showPrompt({ modal, router })));
  };

  const current = getCurrentAuthState();
  if (current.user) return () => {};

  if (!hasPersistedAuthSession()) {
    schedulePrompt();
    return () => {};
  }

  unsubscribeAuth = subscribeToAuth((state) => {
    if (!state.ready) return;
    unsubscribeAuth?.();
    unsubscribeAuth = null;
    if (!state.user) schedulePrompt();
  });
  return () => {
    unsubscribeAuth?.();
    unsubscribeAuth = null;
  };
}
