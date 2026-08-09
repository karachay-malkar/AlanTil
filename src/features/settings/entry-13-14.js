import * as baseSettings from "/src/features/settings/index.js?v=13.13&base=1";

function applyReleaseLabel(root) {
  root.querySelectorAll(".settingsLinksSection small").forEach((node) => {
    if (String(node.textContent || "").trim() === "13.13") node.textContent = "13.14";
  });
}

export async function mount(context, params = {}) {
  await baseSettings.mount(context, params);
  applyReleaseLabel(context.root);
}

export function unmount() {
  baseSettings.unmount?.();
}

export function canLeave() {
  return baseSettings.canLeave?.() ?? true;
}

export function getLeaveMessage() {
  return baseSettings.getLeaveMessage?.();
}
