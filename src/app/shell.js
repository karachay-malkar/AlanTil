export function createShell() {
  const root = document.getElementById("appRoot");
  const backButton = document.getElementById("btnBackArrow");
  const counter = document.getElementById("counter");
  const mode = document.getElementById("mode");
  const modalRoot = document.getElementById("modalRoot");
  const bottomNav = document.getElementById("bottomNav");

  if (!root || !backButton || !counter || !mode || !modalRoot || !bottomNav) {
    throw new Error("Application shell is incomplete");
  }

  function renderHome() {
    root.innerHTML = `<section class="view screen"><div class="loadingState">Открываем путь…</div></section>`;
  }

  function setBackVisible(visible) {
    backButton.classList.toggle("hidden", !visible);
  }

  function setCounter(text = "") {
    counter.textContent = text;
    counter.style.display = text ? "" : "none";
  }

  function clearMode() {
    mode.textContent = "";
    mode.style.display = "none";
  }

  function setActiveNav(route = "") {
    const feature = String(route).split(".")[0];
    const active = ["test", "match", "songs", "practice"].includes(feature)
      ? "practice.home"
      : ["profile", "account", "settings"].includes(feature)
        ? "profile.home"
        : "path.home";
    bottomNav.querySelectorAll("[data-route]").forEach((button) => {
      const on = button.dataset.route === active;
      button.classList.toggle("active", on);
      button.setAttribute("aria-current", on ? "page" : "false");
    });
  }

  return { root, backButton, modalRoot, bottomNav, renderHome, setBackVisible, setCounter, clearMode, setActiveNav };
}
