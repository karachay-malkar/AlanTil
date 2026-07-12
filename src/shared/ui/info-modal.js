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

export function openInfoModal(root, { title = "Информация", content = "", closeText = "Закрыть" } = {}) {
  if (!root) throw new Error("Modal root is required");
  closeInfoModal();
  activeRoot = root;
  root.innerHTML = `
    <div class="exitModal infoModal" role="dialog" aria-modal="true" aria-labelledby="infoModalTitle">
      <div class="exitModalBackdrop" data-info-close="1"></div>
      <div class="exitModalCard infoModalCard">
        <div class="exitModalText infoModalTitle" id="infoModalTitle"></div>
        <div class="infoModalContent"></div>
        <div class="exitModalActions">
          <button class="btn primary" type="button" data-info-close="1"></button>
        </div>
      </div>
    </div>`;

  root.querySelector("#infoModalTitle").textContent = String(title || "Информация");
  root.querySelector(".infoModalContent").innerHTML = String(content || "");
  root.querySelector(".exitModalActions button").textContent = String(closeText || "Закрыть");
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
