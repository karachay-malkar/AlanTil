import { screenConfig } from "./screen-registry.js?v=13.6.2";
import { revealScreen, showScreenError, showScreenLoading } from "./screen-transition.js";

export function createShell() {
  const appShell = document.getElementById("appShell");
  const header = document.getElementById("appHeader");
  const viewport = document.getElementById("appViewport");
  const root = document.getElementById("appRoot");
  const backButton = document.getElementById("btnBackArrow");
  const headerText = document.getElementById("headerText");
  const headerTabs = document.getElementById("headerTabs");
  const headerTitle = document.getElementById("headerTitle");
  const headerSubtitle = document.getElementById("headerSubtitle");
  const sessionStatus = document.getElementById("sessionStatus");
  const counter = document.getElementById("counter");
  const mode = document.getElementById("mode");
  const modalRoot = document.getElementById("modalRoot");
  const bottomNav = document.getElementById("bottomNav");

  if (!appShell || !header || !viewport || !root || !backButton || !headerText || !headerTabs || !headerTitle || !headerSubtitle || !sessionStatus || !counter || !mode || !modalRoot || !bottomNav) {
    throw new Error("Application shell is incomplete");
  }

  let currentConfig = screenConfig("path.home");

  function syncSessionStatus() {
    const visible = Boolean(counter.textContent || mode.textContent);
    sessionStatus.classList.toggle("hidden", !visible);
    viewport.classList.toggle("hasSessionStatus", visible);
  }

  function setHeaderContent({ title = "", subtitle = "" } = {}) {
    headerTabs.replaceChildren();
    headerTabs.classList.add("hidden");
    header.classList.remove("hasHeaderTabs");
    headerText.classList.remove("hidden");
    headerTitle.textContent = title;
    headerSubtitle.textContent = subtitle;
    headerSubtitle.classList.toggle("hidden", !subtitle);
    headerText.classList.toggle("hidden", !title && !subtitle);
  }

  function setHeaderTabs({ items = [], active = "", ariaLabel = "Разделы экрана", onSelect } = {}) {
    headerTabs.replaceChildren();
    const normalized = Array.isArray(items) ? items.filter((item) => item?.id && item?.label) : [];
    normalized.forEach((item) => {
      const button = document.createElement("button");
      const selected = String(item.id) === String(active);
      button.type = "button";
      button.className = `appHeaderTab${selected ? " active" : ""}`;
      button.textContent = item.bracketed === false ? String(item.label) : `[ ${item.label} ]`;
      button.setAttribute("aria-current", selected ? "page" : "false");
      button.addEventListener("click", () => onSelect?.(item.id));
      headerTabs.append(button);
    });
    headerTabs.setAttribute("aria-label", ariaLabel);
    headerTabs.classList.toggle("hidden", normalized.length === 0);
    header.classList.toggle("hasHeaderTabs", normalized.length > 0);
    headerText.classList.toggle("hidden", normalized.length > 0);
  }

  function configureScreen(route = "path.home") {
    currentConfig = screenConfig(route);
    const [feature = "path", screen = "home"] = String(route).split(".");
    appShell.dataset.feature = feature;
    appShell.dataset.screen = screen;
    appShell.dataset.layout = currentConfig.layout;
    appShell.dataset.header = currentConfig.header;
    appShell.dataset.bottomNav = String(currentConfig.bottomNav);
    bottomNav.hidden = !currentConfig.bottomNav;
    counter.textContent = "";
    mode.textContent = "";
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
      button.classList.toggle("active", on);
      if (on) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function beginNavigation(route, message = "") { configureScreen(route); showScreenLoading(root, message); }
  async function completeNavigation(options = {}) { await revealScreen(root, options); }
  function renderError(message) { showScreenError(root, message); }

  return {
    appShell, header, viewport, root, backButton, modalRoot, bottomNav,
    configureScreen, renderHome, setBackVisible, setCounter, setMode, clearMode,
    setHeaderContent, setHeaderTabs, setActiveNav, beginNavigation, completeNavigation, renderError,
  };
}
