import { msg } from "../i18n/index.js?v=16.8.0.2";

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderBracketTabs({ items = [], active = "", ariaLabel = "", dataAttribute = "profile-tab" } = {}) {
  const attribute = /^[a-z][a-z0-9-]*$/.test(dataAttribute) ? dataAttribute : "profile-tab";
  const count=Math.max(1,items.length);
  return `<nav class="profilePrimaryNav" style="--profile-tab-count:${count}" aria-label="${escapeAttribute(ariaLabel)}">
    ${items.map((item) => {
      const id = String(item?.id || "");
      const value = item?.value ?? item?.route ?? id;
      const selected = active === id;
      return `<button class="tabAction profilePrimaryTab ${selected ? "active" : ""}" type="button" data-${attribute}="${escapeAttribute(value)}" ${selected ? 'aria-current="page"' : ""}>[ ${escapeAttribute(item?.label || "")} ]</button>`;
    }).join("")}
  </nav>`;
}

export function renderProfileNavigation(active = "profile") {
  const items = [
    { id: "profile", label: msg("common.profil"), route: "profile.home" },
    { id: "statistics", label: msg("common.statistika"), route: "profile.statistics" },
    { id: "settings", label: msg("common.nastroyki"), route: "settings.home" },
  ];
  return renderBracketTabs({
    items,
    active,
    ariaLabel: msg("common.razdely_profilya"),
    dataAttribute: "profile-navigation",
  });
}

export function bindProfileNavigation(context, signal) {
  context.root.querySelectorAll("[data-profile-navigation]").forEach((button) => {
    button.addEventListener("click", () => context.router.navigate(button.dataset.profileNavigation), { signal });
  });
}
