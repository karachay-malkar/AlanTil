import { APP_VERSION, RELEASE_DATE, WEB_BUILD_VERSION } from "../../../packages/alantil-core/release.js?v=16.7.0.31";
import { msg } from "../../shared/i18n/index.js?v=13.15.12";
import { panel } from "../../shared/ui/panel.js?v=13.9.0";

function displayReleaseDate(value) {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}.${month}.${year}` : String(value || "");
}

export function renderVersion(context) {
  context.shell.setHeaderContent?.({ title: msg("about.versiya_prilozheniya") });
  context.root.innerHTML = panel({
    title: msg("about.versiya_prilozheniya"),
    body: `
      <dl class="settingsFacts">
        <div><dt>${msg("about.versiya")}</dt><dd>${APP_VERSION}</dd></div>\n        <div><dt>Web build</dt><dd>${WEB_BUILD_VERSION}</dd></div>
        <div><dt>${msg("about.poslednee_obnovlenie")}</dt><dd>${displayReleaseDate(RELEASE_DATE)}</dd></div>
      </dl>`,
  });
}
