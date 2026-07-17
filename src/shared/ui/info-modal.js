import { msg } from "../i18n/index.js?v=13.9.0";
let activeRoot = null;
let escapeHandler = null;

function removeEscapeHandler() {
  if (!escapeHandler) return;
  document.removeEventListener("keydown", escapeHandler);
  escapeHandler = null;
}

export function closeInfoModal() {
  removeEscapeHandler();
  if (activeRoot) activeRoot.innerHTML = "";
  activeRoot = null;
  document.body.classList.remove("modal-open");
}

export function openInfoModal(root, { title = "", content = "", closeText = msg("common.zakryt") } = {}) {
  if (!root) throw new Error("Modal root is required");
  closeInfoModal();
  activeRoot = root;
  const normalizedTitle = String(title || "").trim();
  const titleMarkup = normalizedTitle
    ? `<div class="exitModalText infoModalTitle" id="infoModalTitle"></div>`
    : "";
  const accessibility = normalizedTitle
    ? `aria-labelledby="infoModalTitle"`
    : `aria-label="${msg("common.informatsiya")}"`;

  root.innerHTML = `
    <div class="exitModal infoModal" role="dialog" aria-modal="true" ${accessibility}>
      <div class="exitModalBackdrop" data-info-close="1"></div>
      <div class="exitModalCard infoModalCard ${normalizedTitle ? "hasInfoModalTitle" : "noInfoModalTitle"}">
        ${titleMarkup}
        <div class="infoModalContent"></div>
        <div class="exitModalActions">
          <button class="btn actionPrimary" type="button" data-info-close="1"></button>
        </div>
      </div>
    </div>`;

  const titleElement = root.querySelector("#infoModalTitle");
  if (titleElement) titleElement.textContent = normalizedTitle;
  root.querySelector(".infoModalContent").innerHTML = String(content || "");
  root.querySelector(".exitModalActions button").textContent = String(closeText || msg("common.zakryt"));
  root.querySelectorAll("[data-info-close='1']").forEach((element) => {
    element.addEventListener("click", closeInfoModal);
  });

  escapeHandler = (event) => {
    if (event.key === "Escape") closeInfoModal();
  };
  document.addEventListener("keydown", escapeHandler);
  document.body.classList.add("modal-open");
  return root.querySelector(".infoModalCard");
}
