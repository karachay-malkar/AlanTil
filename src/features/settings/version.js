import { msg } from "../../shared/i18n/index.js?v=13.15.10";
import { panel } from "../../shared/ui/panel.js?v=13.9.0";

export function renderVersion(context) {
  context.shell.setHeaderContent?.({ title: msg("about.versiya_prilozheniya") });
  context.root.innerHTML = panel({
    title: msg("about.versiya_prilozheniya"),
    body: `
      <dl class="settingsFacts">
        <div><dt>${msg("about.versiya")}</dt><dd>13.15.11</dd></div>
        <div><dt>${msg("about.poslednee_obnovlenie")}</dt><dd>24.08.2026</dd></div>
      </dl>`,
  });
}