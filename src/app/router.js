import { msg } from "../shared/i18n/index.js?v=13.10.12";
import { setAnalyticsContext, trackEvent, trackPageView } from "../shared/analytics/analytics.js?v=13.9.0";
import { EVENTS } from "../shared/analytics/events.js?v=13.9.0";
import { initializeAuth } from "../shared/auth/auth-service.js?v=13.10.12";

const DEFAULT_STORY = "oblivion";
const RELEASE_VERSION = "13.15.9";
const FEATURE_PATHS = Object.freeze({
  practice: "../features/practice/index.js",
  path: "../features/path/feature.js",
  profile: "../features/profile/index.js",
  admin: "../features/admin/index.js",
  learn: "../features/learn/feature.js",
  test: "../features/test/index.js",
  match: "../features/match/index.js",
  songs: "../features/songs/index.js",
  account: "../features/account/index.js",
  settings: "../features/settings/feature.js",
});

const ROUTER_STATE_KEY = "__alanTilRouter";
const TITLE_KEY_BY_SCREEN = Object.freeze({
  path: "common.put_alan_til",
  practice: "common.praktika_alan_til",
  profile: "common.profil_alan_til",
  admin: "admin.users_alan_til",
  learn: "common.uchit_slova_alan_til",
  test: "common.test_alan_til",
  match: "common.sopostavlenie_alan_til",
  songs: "common.pesni_alan_til",
  song: "common.pesnya_alan_til",
  account: "common.akkaunt_alan_til",
  settings: "common.nastroyki_alan_til",
  privacy: "common.politika_konfidentsialnosti_alan_til",
  version: "common.versiya_prilozheniya_alan_til",
  thanks: "common.blagodarnosti_alan_til",
});

function decodeSegment(value) {
  try {
    return decodeURIComponent(value || "");
  } catch {
    return String(value || "");
  }
}

function encodeSegment(value) {
  return encodeURIComponent(String(value || "").trim());
}

function cleanPathname(pathname) {
  const path = String(pathname || "/").split("?")[0].split("#")[0];
  if (!path || path === "/") return "/";
  return `/${path.split("/").filter(Boolean).join("/")}`;
}

export function parsePathname(pathname) {
  const segments = cleanPathname(pathname).split("/").filter(Boolean).map(decodeSegment);
  if (!segments.length) return { route: "path.home", params: { storyType: DEFAULT_STORY } };

  const [first, second, third, fourth, fifth, sixth] = segments;
  if (first === "practice" && !second) return { route: "practice.home", params: {} };
  if (first === "path") {
    const storyType = String(second || DEFAULT_STORY).trim() || DEFAULT_STORY;
    if (!third) return { route: "path.home", params: { storyType } };
    if (third && fourth && fifth) {
      const params = { storyType, catalogSlug: third, groupSlug: fourth, setSlug: fifth };
      if (sixth === "study") return { route: "path.study", params };
      if (sixth === "test") return { route: "path.test", params };
      if (!sixth) return { route: "path.station", params };
    }
    return { route: "path.home", params: { storyType }, notFound: true };
  }
  if (first === "profile") {
    if (!second) return { route: "profile.home", params: {} };
    if (second === "status") return { route: "profile.home", params: {}, redirected: true };
    if (second === "skills") return { route: "profile.skills", params: {} };
    if (second === "statistics") return { route: "profile.statistics", params: {} };
    if (second === "users") {
      if (!third) return { route: "admin.users", params: {} };
      if (third && fourth === "test" && fifth && !sixth) return { route: "admin.test", params: { userId: third, sessionId: fifth } };
      if (third && !fourth) return { route: "admin.user", params: { userId: third } };
      return { route: "admin.users", params: {}, notFound: true };
    }
    if (second === "account") return { route: "account.home", params: {} };
    if (second === "settings") {
      if (!third) return { route: "settings.home", params: {} };
      if (third === "privacy") return { route: "settings.privacy", params: {} };
      if (third === "version") return { route: "settings.version", params: {} };
      if (third === "thanks") return { route: "settings.thanks", params: {} };
    }
  }
  if (first === "learn") {
    if (!second) return { route: "learn.catalog", params: {} };
    if (second === "favorites") {
      if (!third) return { route: "learn.set", params: { dictionarySlug: "favorites" } };
      if (third === "study" && !fourth) return { route: "learn.study", params: { dictionarySlug: "favorites" } };
      if (third === "results" && !fourth) return { route: "learn.results", params: { dictionarySlug: "favorites" } };
      return { route: "learn.catalog", params: {}, notFound: true };
    }
    if (third === "contents" && !fourth) return { route: "learn.catalog-content", params: { dictionarySlug: second } };
    if (!third) return { route: "learn.sections", params: { dictionarySlug: second } };
    if (!fourth) return { route: "learn.sections", params: { dictionarySlug: second, sectionSlug: third } };
    const params = { dictionarySlug: second, sectionSlug: third, setSlug: fourth };
    if (!fifth) return { route: "learn.set", params };
    if (fifth === "study" && !sixth) return { route: "learn.study", params };
    if (fifth === "results" && !sixth) return { route: "learn.results", params };
    return { route: "learn.catalog", params: {}, notFound: true };
  }
  if (first === "test") {
    if (!second) return { route: "test.menu", params: {} };
    if (second === "session" && !third) return { route: "test.session", params: {} };
    if (second === "results" && !third) return { route: "test.results", params: {} };
  }
  if (first === "match") {
    if (!second) return { route: "match.menu", params: {} };
    if (second === "game" && !third) return { route: "match.game", params: {} };
    if (second === "results" && !third) return { route: "match.results", params: {} };
  }
  if (first === "songs") {
    if (!second) return { route: "songs.playlists", params: {} };
    return { route: "songs.catalog", params: { playlistSlug: second } };
  }
  if (first === "song" && second) return { route: "songs.song", params: { songId: second } };

  if (first === "account" && !second) return { route: "profile.home", params: {}, redirected: true };
  if (first === "settings") {
    if (!second) return { route: "settings.home", params: {}, redirected: true };
    if (second === "privacy") return { route: "settings.privacy", params: {}, redirected: true };
    if (second === "version") return { route: "settings.version", params: {}, redirected: true };
    if (second === "thanks") return { route: "settings.thanks", params: {}, redirected: true };
  }
  return { route: "path.home", params: { storyType: DEFAULT_STORY }, notFound: true };
}

export function buildPath(routeName, params = {}) {
  const dictionary = params.dictionarySlug ? encodeSegment(params.dictionarySlug) : "";
  const section = params.sectionSlug ? encodeSegment(params.sectionSlug) : "";
  const set = params.setSlug ? encodeSegment(params.setSlug) : "";
  const story = String(params.storyType || DEFAULT_STORY).trim() || DEFAULT_STORY;
  const stationBase = params.catalogSlug && params.groupSlug && params.setSlug
    ? `/path/${story}/${encodeSegment(params.catalogSlug)}/${encodeSegment(params.groupSlug)}/${encodeSegment(params.setSlug)}`
    : `/path/${story}`;

  if (routeName === "home" || routeName === "path.home") return `/path/${story}`;
  if (routeName === "path.station") return stationBase;
  if (routeName === "path.study") return `${stationBase}/study`;
  if (routeName === "path.test") return `${stationBase}/test`;
  if (routeName === "practice.home") return "/practice";
  if (routeName === "profile.home") return "/profile";
  if (routeName === "profile.skills") return "/profile/skills";
  if (routeName === "profile.statistics") return "/profile/statistics";
  if (routeName === "admin.users") return "/profile/users";
  if (routeName === "admin.user") return params.userId ? `/profile/users/${encodeSegment(params.userId)}` : "/profile/users";
  if (routeName === "admin.test") return params.userId && params.sessionId
    ? `/profile/users/${encodeSegment(params.userId)}/test/${encodeSegment(params.sessionId)}`
    : "/profile/users";
  if (routeName === "learn.catalog") return "/learn";
  if (routeName === "learn.catalog-content") return dictionary ? `/learn/${dictionary}/contents` : "/learn";
  if (routeName === "learn.sections") {
    if (!dictionary) return "/learn";
    return section ? `/learn/${dictionary}/${section}` : `/learn/${dictionary}`;
  }
  if (["learn.set", "learn.study", "learn.results"].includes(routeName)) {
    const suffix = routeName === "learn.study" ? "/study" : routeName === "learn.results" ? "/results" : "";
    if (dictionary === "favorites") return `/learn/favorites${suffix}`;
    if (dictionary && section && set) return `/learn/${dictionary}/${section}/${set}${suffix}`;
    return "/learn";
  }
  if (routeName === "test.menu") return "/test";
  if (routeName === "test.session") return "/test/session";
  if (routeName === "test.results") return "/test/results";
  if (routeName === "match.menu") return "/match";
  if (routeName === "match.game") return "/match/game";
  if (routeName === "match.results") return "/match/results";
  if (routeName === "songs.playlists") return "/songs";
  if (routeName === "songs.catalog") return params.playlistSlug ? `/songs/${encodeSegment(params.playlistSlug)}` : "/songs";
  if (routeName === "songs.song") return params.songId ? `/song/${encodeSegment(params.songId)}` : "/songs";
  if (routeName === "account.home") return "/profile/account";
  if (routeName === "settings.home") return "/profile/settings";
  if (routeName === "settings.privacy") return "/profile/settings/privacy";
  if (routeName === "settings.version") return "/profile/settings/version";
  if (routeName === "settings.thanks") return "/profile/settings/thanks";
  return `/path/${story}`;
}

function featureOf(route) {
  return route === "home" ? "path" : String(route || "path.home").split(".")[0];
}

function screenNameOf(route) {
  if (route === "home") return "path";
  if (route === "songs.song") return "song";
  if (route === "settings.privacy") return "privacy";
  if (route === "settings.version") return "version";
  if (route === "settings.thanks") return "thanks";
  return featureOf(route);
}

function targetsEqual(left, right) {
  return left?.route === right?.route && JSON.stringify(left?.params || {}) === JSON.stringify(right?.params || {});
}

function compactParams(parameters = {}) {
  return Object.fromEntries(Object.entries(parameters).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

function debugSearchSuffix() {
  const debug = new URLSearchParams(window.location.search).get("analytics_debug");
  return debug === "1" ? "?analytics_debug=1" : "";
}

function safeReferrer(value) {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.origin);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

export function createRouter({ shell, modal, context }) {
  const entries = [];
  const loadedModules = new Map();
  let current = { route: "path.home", params: { storyType: DEFAULT_STORY } };
  let currentModule = null;
  let navigating = false;
  let queuedNavigation = null;
  let queuedRefresh = null;
  let started = false;
  let historyIndex = 0;
  let revertingPopState = false;
  let skipNextPopLeaveCheck = false;
  let lastTrackedLocation = "";
  let lastPageReferrer = safeReferrer(document.referrer);
  let telegramWebApp = context.telegram?.getWebApp?.() || null;
  let telegramBackButton = null;

  let currentScreen = "";
  let screenPagePath = "/";
  let screenOpenedAt = 0;
  let activeDuration = 0;
  let activeStartedAt = 0;
  let isDocumentVisible = document.visibilityState !== "hidden";

  async function importFeature(feature, retry = false) {
    const path = FEATURE_PATHS[feature];
    if (!path) throw new Error(`Unknown feature: ${feature}`);
    const suffix = retry ? `&retry=${Date.now()}` : "";
    return import(`${path}?v=${RELEASE_VERSION}${suffix}`);
  }

  async function loadModule(feature) {
    if (loadedModules.has(feature)) return loadedModules.get(feature);
    try {
      const module = await importFeature(feature);
      loadedModules.set(feature, module);
      return module;
    } catch (error) {
      console.warn(`Feature import retry: ${feature}`, error);
      const module = await importFeature(feature, true);
      loadedModules.set(feature, module);
      return module;
    }
  }

  function settleQueuedNavigation(value = false) {
    if (!queuedNavigation) return;
    queuedNavigation.resolve(value);
    queuedNavigation = null;
  }

  function queueNavigation(target, options) {
    settleQueuedNavigation(false);
    shell.setNavigationPending?.(target.route, true);
    return new Promise((resolve) => {
      queuedNavigation = { target, options, resolve };
    });
  }

  function drainPendingWork() {
    if (navigating) return;
    if (queuedNavigation) {
      const request = queuedNavigation;
      queuedNavigation = null;
      void show(request.target, request.options).then(request.resolve);
      return;
    }
    if (queuedRefresh) {
      const options = queuedRefresh;
      queuedRefresh = null;
      void refresh(options);
    }
  }

  function scheduleFeatureWarmup(route) {
    const currentFeature = featureOf(route);
    const features = currentFeature === "path"
      ? ["practice", "profile"]
      : currentFeature === "practice"
        ? ["path", "test", "match"]
        : [];
    if (!features.length) return;
    const warm = () => features.forEach((feature) => void loadModule(feature).catch(() => {}));
    if (typeof requestIdleCallback === "function") requestIdleCallback(warm, { timeout: 1800 });
    else globalThis.setTimeout(warm, 250);
  }

  function targetWithInheritedParams(route, params = {}) {
    const sameFeature = featureOf(route) === featureOf(current.route) && route !== "home" && !String(route).endsWith(".home");
    return {
      route,
      params: compactParams({ ...(sameFeature ? current.params : {}), ...params }),
    };
  }

  async function mayLeave(force) {
    if (force || !currentModule?.canLeave || currentModule.canLeave()) return true;
    const message = currentModule?.getLeaveMessage?.()
      || msg("common.vy_tochno_hotite_vyyti_sessiya_budet_sohranena").replace("\n", "<br>");
    return modal.confirm({ message });
  }

  function pauseScreenTimer() {
    if (!activeStartedAt) return;
    activeDuration += performance.now() - activeStartedAt;
    activeStartedAt = 0;
  }

  function resumeScreenTimer() {
    if (!currentScreen || !isDocumentVisible || activeStartedAt) return;
    activeStartedAt = performance.now();
  }

  function finishScreenTimer() {
    if (!currentScreen) return;
    pauseScreenTimer();
    if (activeDuration >= 1000) {
      trackEvent(EVENTS.SCREEN_TIME, {
        screen_name: currentScreen,
        duration_sec: Math.floor(activeDuration / 1000),
        page_path: screenPagePath,
      });
    }
    currentScreen = "";
    screenPagePath = "/";
    screenOpenedAt = 0;
    activeDuration = 0;
    activeStartedAt = 0;
  }

  function startScreenTimer(route) {
    currentScreen = screenNameOf(route);
    screenPagePath = window.location.pathname || "/";
    screenOpenedAt = performance.now();
    activeDuration = 0;
    activeStartedAt = isDocumentVisible ? screenOpenedAt : 0;
    setAnalyticsContext({ screen_name: currentScreen, page_path: window.location.pathname || "/" });
  }

  function setDocumentTitle(route) {
    const key = TITLE_KEY_BY_SCREEN[screenNameOf(route)];
    document.title = key ? msg(key) : msg("common.alan_til");
  }

  function syncBackControls() {
    const visible = !["home", "path.home", "practice.home", "profile.home", "profile.skills", "profile.statistics", "admin.users", "settings.home"].includes(current.route);
    shell.setBackVisible(visible);
    const backButton = telegramWebApp?.BackButton;
    try {
      if (visible) backButton?.show?.();
      else backButton?.hide?.();
    } catch (error) {
      console.warn("Telegram BackButton update failed", error);
    }
  }

  function navigationSuffix() {
    return context.telegram?.getPendingUrlSuffix?.() || debugSearchSuffix();
  }

  function historyState(target, index) {
    return { [ROUTER_STATE_KEY]: true, index, route: target.route, params: target.params };
  }

  function syncBrowserHistory(target, mode = "push") {
    const path = `${buildPath(target.route, target.params)}${navigationSuffix()}`;
    if (mode === "replace") {
      entries[historyIndex] = target;
      window.history.replaceState(historyState(target, historyIndex), "", path);
      return;
    }
    historyIndex += 1;
    entries.splice(historyIndex);
    entries[historyIndex] = target;
    window.history.pushState(historyState(target, historyIndex), "", path);
  }

  function resolveInitialRoute() {
    return parsePathname(window.location.pathname);
  }

  function canonicalize(route = current.route, params = current.params) {
    current = { route, params: compactParams(params) };
    entries[historyIndex] = current;
    const path = `${buildPath(current.route, current.params)}${navigationSuffix()}`;
    window.history.replaceState(historyState(current, historyIndex), "", path);
    return getCurrent();
  }

  async function mountCurrentRoute(preloadedModule = null) {
    shell.setCounter("");
    shell.clearMode();
    shell.beginNavigation(current.route, msg("common.otkryvaem"));
    syncBackControls();
    const feature = featureOf(current.route);
    currentModule = preloadedModule || await loadModule(feature);
    await currentModule.mount(
      { ...context, router: api },
      { ...current.params, screen: current.route.split(".")[1] || "home" },
    );
    shell.setActiveNav(current.route);
    setDocumentTitle(current.route);
  }

  function sendPageView({ initial = false, force = false } = {}) {
    const pagePath = buildPath(current.route, current.params);
    const pageLocation = `${window.location.origin}${pagePath}${debugSearchSuffix()}`;
    if (!force && !initial && pageLocation === lastTrackedLocation) return false;
    const pageReferrer = safeReferrer(lastTrackedLocation) || lastPageReferrer;
    const sent = trackPageView({
      page_path: pagePath,
      page_location: pageLocation,
      page_title: document.title,
      page_referrer: pageReferrer,
      screen_name: screenNameOf(current.route),
    });
    if (!sent) return false;
    lastPageReferrer = safeReferrer(pageLocation);
    lastTrackedLocation = pageLocation;
    return true;
  }

  function discardScreenTimer() {
    currentScreen = "";
    screenPagePath = "/";
    screenOpenedAt = 0;
    activeDuration = 0;
    activeStartedAt = 0;
  }

  function setAnalyticsActive(enabled) {
    discardScreenTimer();
    if (!enabled || !started) return false;
    startScreenTimer(current.route);
    return sendPageView({ force: true });
  }

  async function show(target, {
    historyMode = "push",
    force = false,
    reason = "route_change",
    skipLeaveCheck = false,
    initial = false,
  } = {}) {
    const options = { historyMode, force, reason, skipLeaveCheck, initial };
    shell.setNavigationPending?.(target.route, true);
    if (navigating) return queueNavigation(target, options);
    if (!initial && !force && targetsEqual(target, current)) {
      shell.setNavigationPending?.(target.route, false);
      return true;
    }
    navigating = true;

    try {
      if (!skipLeaveCheck && !(await mayLeave(force))) return false;
      const nextModule = await loadModule(featureOf(target.route));
      if (queuedNavigation && !initial) return false;

      finishScreenTimer();
      await currentModule?.onLeave?.(reason);
      currentModule?.unmount?.();
      currentModule = null;
      current = { route: target.route, params: compactParams(target.params) };

      if (historyMode !== "none") syncBrowserHistory(current, historyMode);
      await mountCurrentRoute(nextModule);
      startScreenTimer(current.route);
      sendPageView({ initial });
      scheduleFeatureWarmup(current.route);
      return true;
    } catch (error) {
      console.error("Router mount failed", error);
      context.root.innerHTML = `<section class="view screen"><div class="panel"><div class="errorState">${msg("common.ne_udalos_otkryt_razdel")}</div></div></section>`;
      syncBackControls();
      return false;
    } finally {
      navigating = false;
      if (!queuedNavigation) shell.setNavigationPending?.(current.route, false);
      drainPendingWork();
    }
  }

  async function navigate(route, params = {}, options = {}) {
    const target = targetWithInheritedParams(route, params);
    const reason = options.reason || (["home", "path.home"].includes(route) ? "home" : "route_change");
    return show(target, { historyMode: options.push === false ? "replace" : "push", force: options.force === true, reason });
  }

  async function replace(route, params = {}, options = {}) {
    const target = targetWithInheritedParams(route, params);
    return show(target, { historyMode: "replace", force: options.force === true, reason: options.reason || "route_change" });
  }

  async function refresh(options = {}) {
    const refreshTarget = options.target || { route: current.route, params: { ...current.params } };
    if (navigating) {
      queuedRefresh = { ...queuedRefresh, ...options, target: refreshTarget };
      return true;
    }
    if (options.background && !targetsEqual(refreshTarget, current)) return false;
    navigating = true;
    try {
      if (queuedNavigation) return false;
      currentModule?.unmount?.();
      currentModule = null;
      const module = await loadModule(featureOf(current.route));
      await mountCurrentRoute(module);
      return true;
    } catch (error) {
      console.error("Router refresh failed", error);
      context.root.innerHTML = `<section class="view screen"><div class="panel"><div class="errorState">${msg("common.ne_udalos_otkryt_razdel")}</div></div></section>`;
      return false;
    } finally {
      navigating = false;
      drainPendingWork();
    }
  }

  function fallbackBackTarget() {
    const params = { ...current.params };
    if (["path.study", "path.test"].includes(current.route)) return { route: "path.station", params };
    if (current.route === "path.station") return { route: "path.home", params: { storyType: params.storyType || DEFAULT_STORY } };
    if (current.route === "path.home") return null;
    if (["learn.study", "learn.results", "learn.set"].includes(current.route)) {
      if (params.dictionarySlug === "favorites") return { route: "learn.catalog", params: {} };
      return { route: "learn.sections", params: compactParams({ dictionarySlug: params.dictionarySlug, sectionSlug: params.sectionSlug }) };
    }
    if (current.route === "learn.catalog-content") return { route: "learn.sections", params: compactParams({ dictionarySlug: params.dictionarySlug }) };
    if (current.route === "learn.sections" && params.sectionSlug) return { route: "learn.sections", params: compactParams({ dictionarySlug: params.dictionarySlug }) };
    if (current.route === "learn.sections") return { route: "learn.catalog", params: {} };
    if (current.route.startsWith("learn.")) return { route: "path.home", params: { storyType: DEFAULT_STORY } };
    if (["test.session", "test.results"].includes(current.route)) return { route: "test.menu", params: {} };
    if (current.route === "test.menu") return { route: "practice.home", params: {} };
    if (["match.game", "match.results"].includes(current.route)) return { route: "match.menu", params: {} };
    if (current.route === "match.menu") return { route: "practice.home", params: {} };
    if (current.route === "songs.song") return params.playlistSlug ? { route: "songs.catalog", params: { playlistSlug: params.playlistSlug } } : { route: "songs.playlists", params: {} };
    if (current.route === "songs.catalog") return { route: "songs.playlists", params: {} };
    if (current.route === "songs.playlists") return { route: "practice.home", params: {} };
    if (current.route === "account.home") return { route: "profile.home", params: {} };
    if (["profile.skills", "profile.statistics"].includes(current.route)) return { route: "profile.home", params: {} };
    if (current.route === "admin.test") return { route: "admin.user", params: { userId: params.userId } };
    if (current.route === "admin.user") return { route: "admin.users", params: {} };
    if (current.route === "admin.users") return { route: "profile.home", params: {} };
    if (["settings.privacy", "settings.version", "settings.thanks"].includes(current.route)) return { route: "settings.home", params: {} };
    if (current.route === "settings.home") return { route: "profile.home", params: {} };
    return { route: "path.home", params: { storyType: DEFAULT_STORY } };
  }

  async function back(options = {}) {
    if (!(await mayLeave(options.force === true))) return false;
    if (historyIndex > 0) {
      skipNextPopLeaveCheck = true;
      window.history.back();
      return true;
    }
    const fallback = fallbackBackTarget();
    if (!fallback) return false;
    return show(fallback, { historyMode: "replace", force: true, reason: "back", skipLeaveCheck: true });
  }

  async function reset(route = "path.home", params = { storyType: DEFAULT_STORY }) {
    const target = { route, params: compactParams(params) };
    historyIndex = 0;
    entries.length = 0;
    return show(target, { historyMode: "replace", force: true, reason: ["home", "path.home"].includes(route) ? "home" : "route_change" });
  }

  async function handlePopState(event) {
    const state = event.state;
    if (revertingPopState) {
      revertingPopState = false;
      if (state?.[ROUTER_STATE_KEY]) historyIndex = Number(state.index) || 0;
      return;
    }

    const target = state?.[ROUTER_STATE_KEY]
      ? { route: state.route, params: compactParams(state.params) }
      : parsePathname(window.location.pathname);
    const targetIndex = state?.[ROUTER_STATE_KEY] ? Number(state.index) || 0 : Math.max(0, historyIndex - 1);
    const oldIndex = historyIndex;

    const leaveApproved = skipNextPopLeaveCheck;
    skipNextPopLeaveCheck = false;
    if (!leaveApproved && !(await mayLeave(false))) {
      revertingPopState = true;
      const delta = oldIndex - targetIndex;
      window.history.go(delta || 1);
      return;
    }

    historyIndex = targetIndex;
    entries[historyIndex] = target;
    await show(target, {
      historyMode: "none",
      force: true,
      reason: targetIndex < oldIndex ? "back" : "route_change",
      skipLeaveCheck: true,
    });
  }

  function releaseTelegramLaunchUrl() {
    context.telegram?.releaseLaunchUrl?.();
    const path = `${buildPath(current.route, current.params)}${debugSearchSuffix()}`;
    window.history.replaceState(historyState(current, historyIndex), "", path);
  }

  function attachTelegram(webApp) {
    const nextWebApp = webApp || null;
    const nextBackButton = nextWebApp?.BackButton || null;
    if (telegramBackButton === nextBackButton && telegramWebApp === nextWebApp) {
      syncBackControls();
      return nextWebApp;
    }

    try {
      telegramBackButton?.offClick?.(handleTelegramBack);
    } catch (error) {
      console.warn("Telegram BackButton unbinding failed", error);
    }

    telegramWebApp = nextWebApp;
    telegramBackButton = nextBackButton;
    context.telegram?.attach?.(nextWebApp);

    try {
      telegramBackButton?.onClick?.(handleTelegramBack);
    } catch (error) {
      console.warn("Telegram BackButton binding failed", error);
    }

    syncBackControls();
    releaseTelegramLaunchUrl();
    return nextWebApp;
  }

  function handleTelegramBack() {
    void back();
  }

  async function start() {
    if (started) return true;
    await initializeAuth();
    started = true;
    const initial = resolveInitialRoute();
    current = { route: initial.route, params: compactParams(initial.params) };
    historyIndex = 0;
    entries[0] = current;
    const canonicalPath = initial.notFound ? "/" : buildPath(current.route, current.params);
    const initialUrlSuffix = `${window.location.search || ""}${window.location.hash || ""}` || navigationSuffix();
    window.history.replaceState(historyState(current, 0), "", `${canonicalPath}${initialUrlSuffix}`);
    return show(current, { historyMode: "none", force: true, initial: true, skipLeaveCheck: true });
  }

  function getCurrent() {
    return { ...current, params: { ...current.params }, stack: entries.slice(0, historyIndex) };
  }

  const api = {
    start,
    navigate,
    replace,
    refresh,
    back,
    reset,
    getCurrent,
    parsePathname,
    buildPath,
    resolveInitialRoute,
    syncBrowserHistory,
    handlePopState,
    mountCurrentRoute,
    attachTelegram,
    releaseLaunchUrl: releaseTelegramLaunchUrl,
    releaseTelegramLaunchUrl,
    setAnalyticsActive,
    canonicalize,
  };

  shell.backButton.addEventListener("click", () => back());
  shell.root.addEventListener("click", (event) => {
    const routeElement = event.target.closest("[data-route]");
    if (!routeElement) return;
    event.preventDefault();
    navigate(routeElement.dataset.route);
  });
  shell.bottomNav.addEventListener("click", (event) => {
    const routeElement = event.target.closest("[data-route]");
    if (!routeElement) return;
    event.preventDefault();
    navigate(routeElement.dataset.route);
  });
  window.addEventListener("popstate", handlePopState);
  document.addEventListener("visibilitychange", () => {
    isDocumentVisible = document.visibilityState !== "hidden";
    if (isDocumentVisible) resumeScreenTimer();
    else pauseScreenTimer();
  });
  window.addEventListener("pagehide", finishScreenTimer);
  window.addEventListener("beforeunload", finishScreenTimer);
  window.addEventListener("pageshow", () => {
    if (!currentScreen && started) startScreenTimer(current.route);
  });

  if (telegramWebApp) attachTelegram(telegramWebApp);

  return api;
}
