import { screenConfig } from "./screen-registry.js?v=13.9.0";
import { revealScreen, showScreenError, showScreenLoading } from "./screen-transition.js?v=13.9.0";

export function createShell() {
  const appShell = document.getElementById("appShell");
  const header = document.getElementById("appHeader");
  const viewport = document.getElementById("appViewport");
  const root = document.getElementById("appRoot");
  const backButton = document.getElementById("btnBackArrow");
  const headerText = document.getElementById("headerText");
  const headerTitle = document.getElementById("headerTitle");
  const headerSubtitle = document.getElementById("headerSubtitle");
  const headerActionSlot = document.getElementById("headerActionSlot");
  const sessionStatus = document.getElementById("sessionStatus");
  const counter = document.getElementById("counter");
  const mode = document.getElementById("mode");
  const modalRoot = document.getElementById("modalRoot");
  const bottomNav = document.getElementById("bottomNav");

  if (!appShell || !header || !viewport || !root || !backButton || !headerText || !headerTitle || !headerSubtitle || !headerActionSlot || !sessionStatus || !counter || !mode || !modalRoot || !bottomNav) {
    throw new Error("Application shell is incomplete");
  }

  let currentConfig = screenConfig("path.home");

  function syncSessionStatus() {
    const visible = Boolean(counter.textContent || mode.textContent);
    sessionStatus.classList.toggle("hidden", !visible);
    viewport.classList.toggle("hasSessionStatus", visible);
  }

  function setHeaderContent({ title = "", subtitle = "" } = {}) {
    headerText.classList.remove("hidden");
    headerTitle.textContent = title;
    headerSubtitle.textContent = subtitle;
    headerSubtitle.classList.toggle("hidden", !subtitle);
    headerText.classList.toggle("hidden", !title && !subtitle);
  }

  function setHeaderAction(html = "") {
    headerActionSlot.innerHTML = html;
    headerActionSlot.classList.toggle("hidden", !html);
  }

  function configureScreen(route = "path.home") {
    currentConfig = screenConfig(route);
    const [feature = "path", screen = "home"] = String(route).split(".");
    appShell.dataset.feature = feature;
    appShell.dataset.screen = screen;
    appShell.dataset.layout = currentConfig.layout;
    appShell.dataset.header = currentConfig.header;
    appShell.dataset.bottomNav = String(currentConfig.bottomNav);
    delete appShell.dataset.stationPane;
    bottomNav.hidden = !currentConfig.bottomNav;
    counter.textContent = "";
    mode.textContent = "";
    setHeaderAction();
    syncSessionStatus();
    setHeaderContent({ title: currentConfig.title || "" });
    viewport.scrollTop = 0;
    root.scrollTop = 0;
    return currentConfig;
  }

  function renderHome() { showScreenLoading(root, ""); }

  function setBackVisible(visible) {
    backButton.classList.toggle("hidden", !visible);
    header.classList.toggle("hasBack", visible);
  }

  function setCounter(text = "") { counter.textContent = text; syncSessionStatus(); }
  function clearMode() { mode.textContent = ""; syncSessionStatus(); }
  function setMode(text = "") { mode.textContent = text; syncSessionStatus(); }

  function setActiveNav(route = "") {
    void revealScreen(root);
    const feature = String(route).split(".")[0];
    const active = ["test", "match", "songs", "practice"].includes(feature)
      ? "practice.home"
      : ["profile", "account", "settings"].includes(feature)
        ? "profile.home"
        : "path.home";
    bottomNav.querySelectorAll("[data-route]").forEach((button) => {
      const on = button.dataset.route === active;
      button.classList.remove("isPending");
      button.classList.toggle("active", on);
      if (on) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    delete appShell.dataset.navigationPending;
    delete appShell.dataset.pendingRoute;
    root.setAttribute("aria-busy", "false");
  }

  function setNavigationPending(route = "", pending = true) {
    const feature = String(route || "").split(".")[0];
    const pendingRoute = ["test", "match", "songs", "practice"].includes(feature)
      ? "practice.home"
      : ["profile", "account", "settings"].includes(feature)
        ? "profile.home"
        : "path.home";
    appShell.dataset.navigationPending = String(Boolean(pending));
    appShell.dataset.pendingRoute = String(route || "");
    root.setAttribute("aria-busy", String(Boolean(pending)));
    bottomNav.querySelectorAll("[data-route]").forEach((button) => {
      button.classList.toggle("isPending", Boolean(pending) && button.dataset.route === pendingRoute);
    });
  }

  function beginNavigation(route, message = "") { configureScreen(route); showScreenLoading(root, message); }
  async function completeNavigation(options = {}) { await revealScreen(root, options); }
  function renderError(message) { showScreenError(root, message); }

  return {
    appShell, header, viewport, root, backButton, headerActionSlot, modalRoot, bottomNav,
    configureScreen, renderHome, setBackVisible, setCounter, setMode, clearMode,
    setHeaderContent, setHeaderAction, setActiveNav, beginNavigation, completeNavigation, renderError,
    setNavigationPending,
  };
}
