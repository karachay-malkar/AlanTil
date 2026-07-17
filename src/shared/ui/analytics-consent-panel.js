import { msg } from "../i18n/index.js?v=13.9.0";
let panel = null;
let controller = null;

function removePanel() {
  controller?.abort();
  controller = null;
  panel?.remove();
  panel = null;
}

export function hideAnalyticsConsentPanel() {
  removePanel();
}

export function showAnalyticsConsentPanel({ onDecline, onAccept, onPrivacy } = {}) {
  removePanel();
  controller = new AbortController();
  panel = document.createElement("aside");
  panel.className = "analyticsConsentPanel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", msg("common.nastroyka_statistiki_ispolzovaniya"));
  panel.innerHTML = `
    <div class="analyticsConsentText">
      <strong>${msg("common.pomogite_alan_til_stanovitsya_luchshe")}</strong>
      ${msg("common.statistika_ispolzovaniya_pomogaet_nam_uluchshat_prilozheni")}
      <a href="/settings/privacy" data-consent-privacy>${msg("common.politika_konfidentsialnosti")}</a>
    </div>
    <div class="analyticsConsentActions">
      <button class="btn actionText analyticsConsentButton analyticsConsentDecline" type="button" data-consent-decline>${msg("common.ne_sobirat_statistiku")}</button>
      <button class="btn actionPrimary analyticsConsentButton analyticsConsentAccept" type="button" data-consent-accept>${msg("common.prodolzhit_so_statistikoy")}</button>
    </div>`;

  panel.querySelector("[data-consent-decline]")?.addEventListener("click", () => onDecline?.(), { signal: controller.signal });
  panel.querySelector("[data-consent-accept]")?.addEventListener("click", () => onAccept?.(), { signal: controller.signal });
  panel.querySelector("[data-consent-privacy]")?.addEventListener("click", (event) => {
    event.preventDefault();
    onPrivacy?.();
  }, { signal: controller.signal });

  document.body.appendChild(panel);
  return panel;
}
