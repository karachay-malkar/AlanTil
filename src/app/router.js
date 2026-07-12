const FEATURE_LOADERS = {
  learn: () => import("../features/learn/index.js"),
  test: () => import("../features/test/index.js"),
  match: () => import("../features/match/index.js"),
  songs: () => import("../features/songs/index.js"),
};

function featureOf(route) {
  return route === "home" ? "home" : String(route || "").split(".")[0];
}

export function createRouter({ shell, modal, context }) {
  const stack = [];
  const loadedModules = new Map();
  let current = { route: "home", params: {} };
  let currentModule = null;
  let navigating = false;

  async function loadModule(feature) {
    if (loadedModules.has(feature)) return loadedModules.get(feature);
    const loader = FEATURE_LOADERS[feature];
    if (!loader) throw new Error(`Unknown feature: ${feature}`);
    const module = await loader();
    loadedModules.set(feature, module);
    return module;
  }

  async function mayLeave(force) {
    if (force || !currentModule?.canLeave || currentModule.canLeave()) return true;
    return modal.confirm({
      message: "Вы точно хотите выйти?<br>Прогресс сессии будет потерян.",
    });
  }

  async function show(target, { push = true, replace = false, force = false } = {}) {
    if (navigating) return false;
    if (target.route === current.route && JSON.stringify(target.params || {}) === JSON.stringify(current.params || {})) return true;
    navigating = true;

    try {
      if (!(await mayLeave(force))) return false;

      currentModule?.unmount?.();
      shell.setCounter("");
      shell.clearMode();

      if (replace) {
        current = target;
      } else {
        if (push && current.route !== target.route) stack.push(current);
        current = target;
      }

      if (target.route === "home") {
        shell.renderHome();
        currentModule = null;
      } else {
        const feature = featureOf(target.route);
        currentModule = await loadModule(feature);
        await currentModule.mount({ ...context, router: api }, { ...target.params, screen: target.route.split(".")[1] || "index" });
      }

      shell.setBackVisible(current.route !== "home");
      return true;
    } finally {
      navigating = false;
    }
  }

  async function navigate(route, params = {}, options = {}) {
    return show({ route, params }, { push: options.push !== false, force: options.force === true });
  }

  async function replace(route, params = {}, options = {}) {
    return show({ route, params }, { push: false, replace: true, force: options.force === true });
  }

  async function back(options = {}) {
    if (!stack.length) return false;
    const previous = stack[stack.length - 1];
    if (!(await mayLeave(options.force === true))) return false;
    stack.pop();
    return show(previous, { push: false, replace: true, force: true });
  }

  async function reset(route = "home", params = {}) {
    stack.length = 0;
    return show({ route, params }, { push: false, replace: true, force: true });
  }

  function getCurrent() {
    return { ...current, stack: stack.slice() };
  }

  const api = { navigate, replace, back, reset, getCurrent };
  shell.backButton.addEventListener("click", () => back());
  shell.root.addEventListener("click", (event) => {
    const routeElement = event.target.closest("[data-route]");
    if (!routeElement) return;
    event.preventDefault();
    navigate(routeElement.dataset.route);
  });

  return api;
}
