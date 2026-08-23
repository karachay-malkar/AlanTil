import { getDisplayedSessionExitPhrase } from "../domain/alan-display.js?v=13.10.12";
import { msg } from "../i18n/index.js?v=13.15.10";

export function createModalService(root) {
  let resolver = null;
  let escapeHandler = null;

  function clearEscapeHandler() {
    if (!escapeHandler) return;
    document.removeEventListener("keydown", escapeHandler);
    escapeHandler = null;
  }

  function bindEscapeHandler(handler) {
    clearEscapeHandler();
    escapeHandler = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      handler();
    };
    document.addEventListener("keydown", escapeHandler);
  }

  function close(value = false) {
    root.innerHTML = "";
    document.body.classList.remove("modal-open");
    clearEscapeHandler();
    const currentResolver = resolver;
    resolver = null;
    currentResolver?.(value);
  }

  function openContent({
    title = "",
    contentHtml = "",
    className = "",
  } = {}) {
    if (root.childElementCount || resolver) close(false);
    root.innerHTML = `
      <div class="modalBackdrop appContentModalBackdrop" data-content-modal-backdrop>
        <section class="modal appContentModal ${className}" role="dialog" aria-modal="true" aria-labelledby="globalContentModalTitle">
          <header class="modalHeader">
            <div class="modalTitle" id="globalContentModalTitle">${title}</div>
            <button class="modalClose" type="button" data-content-modal-close aria-label="${msg("common.close")}" title="${msg("common.close")}">×</button>
          </header>
          <div class="modalBody" data-content-modal-body>${contentHtml}</div>
        </section>
      </div>`;
    document.body.classList.add("modal-open");

    const backdrop = root.querySelector("[data-content-modal-backdrop]");
    const closeButton = root.querySelector("[data-content-modal-close]");
    const body = root.querySelector("[data-content-modal-body]");
    const element = root.querySelector(".appContentModal");
    const closePanel = () => close(false);

    backdrop?.addEventListener("click", (event) => {
      if (event.target === backdrop) closePanel();
    });
    closeButton?.addEventListener("click", closePanel);
    bindEscapeHandler(closePanel);
    closeButton?.focus({ preventScroll: true });

    return { element, body, close: closePanel };
  }

  function confirm({ message, cancelText = msg("common.ostatsya"), confirmText = getDisplayedSessionExitPhrase() }) {
    if (root.childElementCount || resolver) close(false);
    root.innerHTML = `
      <div class="exitModal" role="dialog" aria-modal="true" aria-labelledby="globalModalTitle">
        <div class="exitModalBackdrop" data-modal-cancel="1"></div>
        <div class="exitModalCard">
          <div class="exitModalText" id="globalModalTitle">${message}</div>
          <div class="exitModalActions">
            <button class="btn actionText exitStay" type="button" data-modal-cancel="1">${cancelText}</button>
            <button class="btn actionPrimary exitConfirm" type="button" data-modal-confirm="1">${confirmText}</button>
          </div>
        </div>
      </div>`;
    document.body.classList.add("modal-open");

    return new Promise((resolve) => {
      resolver = resolve;
      root.querySelectorAll("[data-modal-cancel='1']").forEach((element) => {
        element.addEventListener("click", () => close(false));
      });
      root.querySelector("[data-modal-confirm='1']")?.addEventListener("click", () => close(true));
      bindEscapeHandler(() => close(false));
    });
  }

  return { confirm, openContent, close };
}
