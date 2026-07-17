import { panel } from "../../shared/ui/panel.js?v=13.8";

export function renderVersion(context) {
  context.shell.setHeaderContent?.({ title: "Версия приложения" });
  context.root.innerHTML = panel({
    title: "Версия приложения",
    body: `
      <dl class="settingsFacts">
        <div><dt>Версия</dt><dd>13.8</dd></div>
        <div><dt>Последнее обновление</dt><dd>июль 2026</dd></div>
      </dl>`,
  });
}
