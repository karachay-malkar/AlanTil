import { msg } from "../i18n/index.js?v=13.9.0";
import { PLAY_ICON_SVG } from "./icons.js?v=13.9.0";

export function renderMediaPlayer() {
  return `
    <div class="mediaPlayer" aria-label="${msg("common.audiopleer")}">
      <button class="iconAction mediaPlayButton" type="button" data-audio-play aria-label="${msg("common.vosproizvesti_pesnyu")}">${PLAY_ICON_SVG}</button>
      <span class="mediaTime" data-audio-current>0:00</span>
      <input class="mediaProgress" type="range" min="0" max="0" step="0.1" value="0" data-audio-progress aria-label="${msg("common.pozitsiya_vosproizvedeniya")}" />
      <span class="mediaTime" data-audio-duration>0:00</span>
    </div>
    <div class="mediaError hidden" data-audio-error>${msg("common.ne_udalos_zagruzit_audiozapis")}</div>`;
}
