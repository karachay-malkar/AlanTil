export function renderProfileNavigation(active = "profile") {
  const items = [
    { id: "profile", label: "Профиль", route: "profile.home" },
    { id: "statistics", label: "Статистика", route: "profile.statistics" },
    { id: "settings", label: "Настройки", route: "settings.home" },
  ];
  return `<nav class="profilePrimaryNav" aria-label="Разделы профиля">
    ${items.map((item) => `<button class="profilePrimaryTab ${active === item.id ? "active" : ""}" type="button" data-profile-navigation="${item.route}" ${active === item.id ? 'aria-current="page"' : ""}>[ ${item.label} ]</button>`).join("")}
  </nav>`;
}

export function bindProfileNavigation(context, signal) {
  context.root.querySelectorAll("[data-profile-navigation]").forEach((button) => {
    button.addEventListener("click", () => context.router.navigate(button.dataset.profileNavigation), { signal });
  });
}
