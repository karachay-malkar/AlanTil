import { msg } from "../../shared/i18n/index.js?v=13.9.0";
import {
  getPrivacyState,
  subscribePrivacyState,
  updateAnalyticsPreference,
} from "../../shared/privacy/privacy-controller.js?v=13.9.0";
import { panel } from "../../shared/ui/panel.js?v=13.9.0";

export function renderPrivacy(context, signal, params = {}) {
  context.shell.setHeaderContent?.({ title: msg("privacy.konfidentsialnost") });
  const initialState = getPrivacyState();
  context.root.innerHTML = panel({
    title: msg("privacy.politika_konfidentsialnosti"),
    body: `
      <article class="settingsDocument">
        <p><strong>${msg("privacy.alantil_alan_til")}</strong> ${msg("privacy.prilozhenie_dlya_izucheniya_karachaevo_balkarskogo_yazyka_")} <a href="mailto:alantil0709@gmail.com">alantil0709@gmail.com</a>.</p>

        <h2>${msg("privacy.kakie_dannye_sohranyayutsya_na_ustroystve")}</h2>
        <p>${msg("privacy.prilozhenie_mozhet_lokalno_sohranyat_v_brauzere_izbrannye")}</p>
        <p>${msg("privacy.dlya_vybora_primenimogo_rezhima_statistiki_prilozhenie_moz")}</p>

        <h2>${msg("privacy.akkaunt_i_avtorizatsiya")}</h2>
        <p>${msg("privacy.registratsiya_neobyazatelna_pri_vhode_cherez_google_parol")}</p>
        <p>${msg("privacy.supabase_auth_hranit_tehnicheskiy_identifikator_akkaunta_e")}</p>
        <p>${msg("privacy.elektronnaya_pochta_otobrazhaetsya_tolko_samomu_vladeltsu_")}</p>

        <h2>${msg("privacy.oblachnyy_progress")}</h2>
        <p>${msg("privacy.dlya_avtorizovannogo_polzovatelya_supabase_mozhet_hranit_i")}</p>
        <p>${msg("privacy.v_oblachnyy_progress_peredayutsya_tehnicheskie_id_slov")}</p>

        <h2>${msg("privacy.kakie_dannye_peredayutsya_v_google_analytics")}</h2>
        <p>${msg("privacy.pri_vklyuchennoy_statistike_mogut_peredavatsya_prosmotry_r")}</p>

        <h2>${msg("privacy.kakie_dannye_ne_peredayutsya_v_google_analytics")}</h2>
        <p>${msg("privacy.prilozhenie_ne_peredaet_v_google_analytics_nikneym")}</p>

        <h2>${msg("privacy.zachem_ispolzuetsya_analitika")}</h2>
        <p>${msg("privacy.analitika_pomogaet_ponimat_kak_primenyayutsya_razdely_pril")}</p>

        <h2>${msg("privacy.udalenie_dannyh")}</h2>
        <p>${msg("privacy.lokalnye_dannye_mozhno_udalit_cherez_ochistku_dannyh")}</p>

        <section id="analytics-settings" class="analyticsSettingsSection" aria-labelledby="analytics-settings-title">
          <h2 id="analytics-settings-title">${msg("privacy.statistika_ispolzovaniya")}</h2>
          <p>${msg("privacy.statistika_ispolzovaniya_pomogaet_nam_uluchshat_prilozheni")}</p>
          <label class="analyticsPreferenceRow">
            <input id="analyticsPreferenceCheckbox" class="analyticsPreferenceCheckbox" type="checkbox" ${initialState.enabled ? "checked" : ""} />
            <span>${msg("privacy.razreshit_statistiku_ispolzovaniya")}</span>
          </label>
          <button id="saveAnalyticsPreference" class="btn actionPrimary analyticsPreferenceSave" type="button">${msg("privacy.sohranit_nastroyki")}</button>
          <div id="analyticsPreferenceMessage" class="analyticsPreferenceMessage hidden" role="status">${msg("privacy.nastroyki_statistiki_sohraneny")}</div>
        </section>

        <p class="settingsDocumentDate">${msg("privacy.redaktsiya_iyul_2026_goda")}</p>
      </article>`,
  });

  const checkbox = context.root.querySelector("#analyticsPreferenceCheckbox");
  const saveButton = context.root.querySelector("#saveAnalyticsPreference");
  const message = context.root.querySelector("#analyticsPreferenceMessage");
  let dirty = false;

  checkbox?.addEventListener("change", () => {
    dirty = true;
    message?.classList.add("hidden");
  }, { signal });

  saveButton?.addEventListener("click", async () => {
    saveButton.disabled = true;
    try {
      await updateAnalyticsPreference(Boolean(checkbox?.checked));
      dirty = false;
      message?.classList.remove("hidden");
    } finally {
      saveButton.disabled = false;
    }
  }, { signal });

  const unsubscribe = subscribePrivacyState((nextState) => {
    if (!dirty && checkbox) checkbox.checked = nextState.enabled;
  });
  signal.addEventListener("abort", unsubscribe, { once: true });

  if (params.focus === "analytics") {
    requestAnimationFrame(() => {
      context.root.querySelector("#analytics-settings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}
