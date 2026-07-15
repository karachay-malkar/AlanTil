import { uiIcon } from "../shared/ui/icons.js";
import { screenConfig } from "./screen-registry.js";
import { revealScreen, showScreenError, showScreenLoading } from "./screen-transition.js";

export function createShell() {
  const appShell = document.getElementById("appShell");
  const header = document.getElementById("appHeader");
  const viewport = document.getElementById("appViewport");
  const root = document.getElementById("appRoot");
  const backButton = document.getElementById("btnBackArrow");
  const sectionIcon = document.getElementById("headerSectionIcon");
  const sessionStatus = document.getElementById("sessionStatus");
  const counter = document.getElementById("counter");
  const mode = document.getElementById("mode");
  const modalRoot = document.getElementById("modalRoot");
  const bottomNav = document.getElementById("bottomNav");

  if (!appShell || !header || !viewport || !root || !backButton || !sectionIcon || !sessionStatus || !counter || !mode || !modalRoot || !bottomNav) {
    throw new Error("Application shell is incomplete");
  }

  let currentConfig = screenConfig("path.home");

  function syncSessionStatus() {
    const visible = Boolean(counter.textContent || mode.textContent);
    sessionStatus.classList.toggle("hidden", !visible);
    viewport.classList.toggle("hasSessionStatus", visible);
  }

  function configureScreen(route = "path.home") {
    currentConfig = screenConfig(route);
    const [feature = "path", screen = "home"] = String(route).split(".");
    appShell.dataset.feature = feature;
    appShell.dataset.screen = screen;
    appShell.dataset.layout = currentConfig.layout;
    appShell.dataset.header = currentConfig.header;
    appShell.dataset.bottomNav = String(currentConfig.bottomNav);
    sectionIcon.innerHTML = uiIcon(currentConfig.icon, "appHeaderSectionIconSvg");
    bottomNav.hidden = !currentConfig.bottomNav;
    viewport.scrollTop = 0;
    root.scrollTop = 0;
    return currentConfig;
  }

  function renderHome() {
    showScreenLoading(root, "");
  }

  function setBackVisible(visible) {
    backButton.classList.toggle("hidden", !visible);
    sectionIcon.classList.toggle("hidden", visible);
  }

  function setCounter(text = "") {
    counter.textContent = text;
    syncSessionStatus();
  }

  function clearMode() {
    mode.textContent = "";
    syncSessionStatus();
  }

  function setMode(text = "") {
    mode.textContent = text;
    syncSessionStatus();
  }

  function setActiveNav(route = "") {
    configureScreen(route || "path.home");
    void revealScreen(root);
    const feature = String(route).split(".")[0];
    const active = ["test", "match", "songs", "practice"].includes(feature)
      ? "practice.home"
      : ["profile", "account", "settings"].includes(feature)
        ? "profile.home"
        : "path.home";
    bottomNav.querySelectorAll("[data-route]").forEach((button) => {
      const on = button.dataset.route === active;
      button.classList.toggle("active", on);
      if (on) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function beginNavigation(route, message = "") {
    configureScreen(route);
    showScreenLoading(root, message);
  }

  async function completeNavigation(options = {}) {
    await revealScreen(root, options);
  }

  function renderError(message) {
    showScreenError(root, message);
  }

  return {
    appShell,
    header,
    viewport,
    root,
    backButton,
    modalRoot,
    bottomNav,
    configureScreen,
    renderHome,
    setBackVisible,
    setCounter,
    setMode,
    clearMode,
    setActiveNav,
    beginNavigation,
    completeNavigation,
    renderError,
  };
}
