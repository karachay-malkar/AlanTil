import { msg } from "../i18n/index.js?v=13.9.0";
export function createModalService(root) {
  let resolver = null;

  function close(value = false) {
    root.innerHTML = "";
    document.body.classList.remove("modal-open");
    const currentResolver = resolver;
    resolver = null;
    currentResolver?.(value);
  }

  function confirm({ message, cancelText = msg("common.ostatsya"), confirmText = msg("common.ne_bolsa_da_bolsun") }) {
    if (resolver) close(false);
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
    });
  }

  return { confirm, close };
}
