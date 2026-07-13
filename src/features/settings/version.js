import { panel } from "../../shared/ui/panel.js";

export function renderVersion(context) {
  context.root.innerHTML = panel({
    title: "Версия приложения",
    body: `
      <dl class="settingsFacts">
        <div><dt>Версия</dt><dd>11.6</dd></div>
        <div><dt>Тип приложения</dt><dd>SPA</dd></div>
        <div><dt>Аналитика</dt><dd>Google Analytics 4</dd></div>
        <div><dt>Идентификатор</dt><dd>G-1WSMD45Q9D</dd></div>
        <div><dt>Последнее обновление</dt><dd>июль 2026</dd></div>
      </dl>`,
  });
}
