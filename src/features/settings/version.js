import { panel } from "../../shared/ui/panel.js";

export function renderVersion(context) {
  context.root.innerHTML = panel({
    title: "Версия приложения",
    body: `
      <dl class="settingsFacts">
        <div><dt>Версия</dt><dd>13.6</dd></div>
        <div><dt>Последнее обновление</dt><dd>июль 2026</dd></div>
      </dl>`,
  });
}
