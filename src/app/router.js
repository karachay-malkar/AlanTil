import { setAnalyticsContext, trackEvent, trackPageView } from "../shared/analytics/analytics.js";
import { EVENTS } from "../shared/analytics/events.js";

const FEATURE_LOADERS = {
  learn: () => import("../features/learn/index.js"),
  test: () => import("../features/test/index.js"),
  match: () => import("../features/match/index.js"),
  songs: () => import("../features/songs/index.js"),
  settings: () => import("../features/settings/index.js"),
};

const ROUTER_STATE_KEY = "__alanTilRouter";
const TITLE_BY_SCREEN = Object.freeze({
  home: "Алан тил",
  learn: "Учить слова — Алан тил",
  test: "Тест — Алан тил",
  match: "Сопоставление — Алан тил",
  songs: "Песни — Алан тил",
  song: "Песня — Алан тил",
  settings: "Настройки — Алан тил",
  privacy: "Политика конфиденциальности — Алан тил",
  version: "Версия приложения — Алан тил",
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
  if (!segments.length) return { route: "home", params: {} };

  const [first, second, third, fourth] = segments;
  if (first === "learn") {
    if (!second) return { route: "learn.catalog", params: {} };
    if (!third) return { route: "learn.sections", params: { dictionarySlug: second } };
    if (!fourth) return { route: "learn.sections", params: { dictionarySlug: second, sectionSlug: third } };
    return { route: "learn.set", params: { dictionarySlug: second, sectionSlug: third, setSlug: fourth } };
  }
  if (first === "test" && !second) return { route: "test.menu", params: {} };
  if (first === "match" && !second) return { route: "match.menu", params: {} };
  if (first === "songs") {
    if (!second) return { route: "songs.playlists", params: {} };
    return { route: "songs.catalog", params: { playlistSlug: second } };
  }
  if (first === "song" && second) return { route: "songs.song", params: { songId: second } };
  if (first === "settings") {
    if (!second) return { route: "settings.home", params: {} };
    if (second === "privacy") return { route: "settings.privacy", params: {} };
    if (second === "version") return { route: "settings.version", params: {} };
  }
  return { route: "home", params: {}, notFound: true };
}

export function buildPath(routeName, params = {}) {
  const dictionary = params.dictionarySlug ? encodeSegment(params.dictionarySlug) : "";
  const section = params.sectionSlug ? encodeSegment(params.sectionSlug) : "";
  const set = params.setSlug ? encodeSegment(params.setSlug) : "";

  if (routeName === "home") return "/";
  if (routeName === "learn.catalog") return "/learn";
  if (["learn.sections", "learn.catalog-content"].includes(routeName)) {
    if (!dictionary) return "/learn";
    return section ? `/learn/${dictionary}/${section}` : `/learn/${dictionary}`;
  }
  if (["learn.set", "learn.study", "learn.results"].includes(routeName)) {
    if (dictionary === "favorites") return "/learn/favorites";
    if (dictionary && section && set) return `/learn/${dictionary}/${section}/${set}`;
    return "/learn";
  }
  if (routeName.startsWith("test.")) return "/test";
  if (routeName.startsWith("match.")) return "/match";
  if (routeName === "songs.playlists") return "/songs";
  if (routeName === "songs.catalog") return params.playlistSlug ? `/songs/${encodeSegment(params.playlistSlug)}` : "/songs";
  if (routeName === "songs.song") return params.songId ? `/song/${encodeSegment(params.songId)}` : "/songs";
  if (routeName === "settings.home") return "/settings";
  if (routeName === "settings.privacy") return "/settings/privacy";
  if (routeName === "settings.version") return "/settings/version";
  return "/";
}

function featureOf(route) {
  return route === "home" ? "home" : String(route || "").split(".")[0];
}

function screenNameOf(route) {
  if (route === "home") return "home";
  if (route === "songs.song") return "song";
  if (route === "settings.privacy") return "privacy";
  if (route === "settings.version") return "version";
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
  let current = { route: "home", params: {} };
  let currentModule = null;
  let navigating = false;
  let started = false;
  let historyIndex = 0;
  let revertingPopState = false;
  let skipNextPopLeaveCheck = false;
  let lastTrackedLocation = "";
  let lastPageReferrer = safeReferrer(document.referrer);

  let currentScreen = "";
  let screenPagePath = "/";
  let screenOpenedAt = 0;
  let activeDuration = 0;
  let activeStartedAt = 0;
  let isDocumentVisible = document.visibilityState !== "hidden";

  async function loadModule(feature) {
    if (loadedModules.has(feature)) return loadedModules.get(feature);
    const loader = FEATURE_LOADERS[feature];
    if (!loader) throw new Error(`Unknown feature: ${feature}`);
    const module = await loader();
    loadedModules.set(feature, module);
    return module;
  }

  function targetWithInheritedParams(route, params = {}) {
    const sameFeature = featureOf(route) === featureOf(current.route) && route !== "home";
    return {
      route,
      params: compactParams({ ...(sameFeature ? current.params : {}), ...params }),
    };
  }

  async function mayLeave(force) {
    if (force || !currentModule?.canLeave || currentModule.canLeave()) return true;
    return modal.confirm({ message: "Вы точно хотите выйти?<br>Прогресс сессии будет потерян." });
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
    document.title = TITLE_BY_SCREEN[screenNameOf(route)] || "Алан тил";
  }

  function syncBackControls() {
    const visible = current.route !== "home";
    shell.setBackVisible(visible);
    const backButton = context.telegram?.BackButton;
    try {
      if (visible) backButton?.show?.();
      else backButton?.hide?.();
    } catch (error) {
      console.warn("Telegram BackButton update failed", error);
    }
  }

  function historyState(target, index) {
    return { [ROUTER_STATE_KEY]: true, index, route: target.route, params: target.params };
  }

  function syncBrowserHistory(target, mode = "push") {
    const path = `${buildPath(target.route, target.params)}${debugSearchSuffix()}`;
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

  async function mountCurrentRoute() {
    shell.setCounter("");
    shell.clearMode();
    if (current.route === "home") {
      shell.renderHome();
      currentModule = null;
    } else {
      const feature = featureOf(current.route);
      currentModule = await loadModule(feature);
      await currentModule.mount(
        { ...context, router: api },
        { ...current.params, screen: current.route.split(".")[1] || "index" },
      );
    }
    setDocumentTitle(current.route);
    syncBackControls();
  }

  function sendPageView({ initial = false } = {}) {
    const pageLocation = window.location.href;
    if (!initial && pageLocation === lastTrackedLocation) return false;
    const pageReferrer = safeReferrer(lastTrackedLocation) || lastPageReferrer;
    trackPageView({
      page_path: window.location.pathname || "/",
      page_location: pageLocation,
      page_title: document.title,
      page_referrer: pageReferrer,
      screen_name: screenNameOf(current.route),
    });
    lastPageReferrer = safeReferrer(pageLocation);
    lastTrackedLocation = pageLocation;
    return true;
  }

  async function show(target, {
    historyMode = "push",
    force = false,
    reason = "route_change",
    skipLeaveCheck = false,
    initial = false,
  } = {}) {
    if (navigating) return false;
    if (!initial && targetsEqual(target, current)) return true;
    navigating = true;

    try {
      if (!skipLeaveCheck && !(await mayLeave(force))) return false;

      finishScreenTimer();
      await currentModule?.onLeave?.(reason);
      currentModule?.unmount?.();
      currentModule = null;
      current = { route: target.route, params: compactParams(target.params) };

      if (historyMode !== "none") syncBrowserHistory(current, historyMode);
      await mountCurrentRoute();
      startScreenTimer(current.route);
      sendPageView({ initial });
      return true;
    } catch (error) {
      console.error("Router mount failed", error);
      context.root.innerHTML = `<section class="view screen"><div class="panel"><div class="errorState">Не удалось открыть раздел.</div></div></section>`;
      syncBackControls();
      return false;
    } finally {
      navigating = false;
    }
  }

  async function navigate(route, params = {}, options = {}) {
    const target = targetWithInheritedParams(route, params);
    const reason = options.reason || (route === "home" ? "home" : "route_change");
    return show(target, { historyMode: options.push === false ? "replace" : "push", force: options.force === true, reason });
  }

  async function replace(route, params = {}, options = {}) {
    const target = targetWithInheritedParams(route, params);
    return show(target, { historyMode: "replace", force: options.force === true, reason: options.reason || "route_change" });
  }

  function fallbackBackTarget() {
    const params = { ...current.params };
    if (["learn.study", "learn.results", "learn.set"].includes(current.route)) {
      if (params.dictionarySlug === "favorites") return { route: "learn.catalog", params: {} };
      return { route: "learn.sections", params: compactParams({ dictionarySlug: params.dictionarySlug, sectionSlug: params.sectionSlug }) };
    }
    if (current.route === "learn.catalog-content") return { route: "learn.sections", params: compactParams({ dictionarySlug: params.dictionarySlug }) };
    if (current.route === "learn.sections" && params.sectionSlug) {
      return { route: "learn.sections", params: compactParams({ dictionarySlug: params.dictionarySlug }) };
    }
    if (current.route === "learn.sections") return { route: "learn.catalog", params: {} };
    if (current.route.startsWith("learn.")) return { route: "home", params: {} };
    if (["test.session", "test.results"].includes(current.route)) return { route: "test.menu", params: {} };
    if (current.route === "test.menu") return { route: "home", params: {} };
    if (["match.game", "match.results"].includes(current.route)) return { route: "match.menu", params: {} };
    if (current.route === "match.menu") return { route: "home", params: {} };
    if (current.route === "songs.song") {
      return params.playlistSlug
        ? { route: "songs.catalog", params: { playlistSlug: params.playlistSlug } }
        : { route: "songs.playlists", params: {} };
    }
    if (current.route === "songs.catalog") return { route: "songs.playlists", params: {} };
    if (current.route === "songs.playlists") return { route: "home", params: {} };
    if (["settings.privacy", "settings.version"].includes(current.route)) return { route: "settings.home", params: {} };
    if (current.route === "settings.home") return { route: "home", params: {} };
    return null;
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

  async function reset(route = "home", params = {}) {
    const target = { route, params: compactParams(params) };
    historyIndex = 0;
    entries.length = 0;
    return show(target, { historyMode: "replace", force: true, reason: route === "home" ? "home" : "route_change" });
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

  async function start() {
    if (started) return true;
    started = true;
    const initial = resolveInitialRoute();
    current = { route: initial.route, params: compactParams(initial.params) };
    historyIndex = 0;
    entries[0] = current;
    const canonicalPath = initial.notFound ? "/" : buildPath(current.route, current.params);
    window.history.replaceState(historyState(current, 0), "", `${canonicalPath}${debugSearchSuffix()}`);
    return show(current, { historyMode: "none", force: true, initial: true, skipLeaveCheck: true });
  }

  function getCurrent() {
    return { ...current, params: { ...current.params }, stack: entries.slice(0, historyIndex) };
  }

  const api = {
    start,
    navigate,
    replace,
    back,
    reset,
    getCurrent,
    parsePathname,
    buildPath,
    resolveInitialRoute,
    syncBrowserHistory,
    handlePopState,
    mountCurrentRoute,
  };

  shell.backButton.addEventListener("click", () => back());
  shell.root.addEventListener("click", (event) => {
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

  try {
    context.telegram?.BackButton?.onClick?.(() => back());
  } catch (error) {
    console.warn("Telegram BackButton binding failed", error);
  }

  return api;
}
