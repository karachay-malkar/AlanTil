import { msg } from "../../shared/i18n/index.js?v=13.10.7";
import { panel } from "../../shared/ui/panel.js?v=13.9.0";

export function renderVersion(context) {
  context.shell.setHeaderContent?.({ title: msg("about.versiya_prilozheniya") });
  context.root.innerHTML = panel({
    title: msg("about.versiya_prilozheniya"),
    body: `
      <dl class="settingsFacts">
        <div><dt>${msg("about.versiya")}</dt><dd>13.10.7</dd></div>
        <div><dt>${msg("about.poslednee_obnovlenie")}</dt><dd>${msg("about.iyul_2026")}</dd></div>
      </dl>`,
  });
}
