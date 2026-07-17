import { msg } from "../../shared/i18n/index.js?v=13.9.0";
import { panel } from "../../shared/ui/panel.js?v=13.9.0";
import { uiIcon } from "../../shared/ui/icons.js?v=13.9.0";

let controller = null;

export function mount(context) {
  controller = new AbortController();
  context.shell.setHeaderContent?.({ title: "Alan Til!" });
  context.root.innerHTML = panel({
    title: msg("practice.praktika"),
    classes: "practicePanel",
    viewClasses: "practiceView",
    body: `
      <div class="practiceMenu">
        <button class="menuItem" type="button" data-practice-route="test.menu"><span class="menuIcon">${uiIcon("listChecks")}</span><span class="menuItemText"><strong>${msg("practice.test")}</strong><small>${msg("practice.proverka_slov_iz_vybrannyh_razdelov")}</small></span></button>
        <button class="menuItem" type="button" data-practice-route="match.menu"><span class="menuIcon">${uiIcon("puzzle")}</span><span class="menuItemText"><strong>${msg("practice.sopostavlenie")}</strong><small>${msg("practice.soedinenie_slov_i_perevodov")}</small></span></button>
        <button class="menuItem" type="button" data-practice-route="songs.playlists"><span class="menuIcon">${uiIcon("music2")}</span><span class="menuItemText"><strong>${msg("practice.pesni")}</strong><small>${msg("practice.yazyk_v_zhivom_kontekste")}</small></span></button>
      </div>`,
  });
  context.root.querySelectorAll("[data-practice-route]").forEach((button) => {
    button.addEventListener("click", () => context.router.navigate(button.dataset.practiceRoute), { signal: controller.signal });
  });
}

export function unmount() {
  controller?.abort();
  controller = null;
}
