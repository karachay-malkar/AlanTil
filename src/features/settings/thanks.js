import { msg } from "../../shared/i18n/index.js?v=13.9.0";
import { panel } from "../../shared/ui/panel.js?v=13.9.0";

export function renderThanks(context) {
  context.shell.setHeaderContent?.({ title: msg("about.blagodarnosti") });
  context.root.innerHTML = panel({
    title: msg("about.blagodarnosti"),
    body: `<article class="settingsDocument">
      <h1>${msg("about.blagodarstvennoe_slovo")}</h1>
      <p>${msg("about.zdes_budet_razmeschena_blagodarnost_lyudyam_kotorye_pomoga")}</p>
    </article>`,
  });
}
