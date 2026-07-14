function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

export async function revealScreen(root, { initial = false } = {}) {
  if (!root) return;
  root.classList.remove("is-loading", "is-leaving");
  root.setAttribute("aria-busy", "false");
  if (initial || reducedMotion()) {
    root.classList.remove("is-entering");
    return;
  }
  root.classList.add("is-entering");
  await nextFrame();
  root.classList.remove("is-entering");
}

export function showScreenLoading(root, message = "Открываем экран…") {
  if (!root) return;
  root.classList.remove("is-entering", "is-leaving");
  root.classList.add("is-loading");
  root.setAttribute("aria-busy", "true");
  root.innerHTML = `
    <section class="screenState screenStateLoading" role="status">
      <span class="screenStatePulse" aria-hidden="true"></span>
      <span>${message}</span>
    </section>`;
}

export function showScreenError(root, message = "Не удалось открыть раздел.") {
  if (!root) return;
  root.classList.remove("is-loading", "is-entering", "is-leaving");
  root.setAttribute("aria-busy", "false");
  root.innerHTML = `<section class="screenState screenStateError" role="alert">${message}</section>`;
}
