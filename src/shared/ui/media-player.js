import { PLAY_ICON_SVG } from "./icons.js";

export function renderMediaPlayer() {
  return `
    <div class="mediaPlayer" aria-label="Аудиоплеер">
      <button class="mediaPlayButton" type="button" data-audio-play aria-label="Воспроизвести песню">${PLAY_ICON_SVG}</button>
      <span class="mediaTime" data-audio-current>0:00</span>
      <input class="mediaProgress" type="range" min="0" max="0" step="0.1" value="0" data-audio-progress aria-label="Позиция воспроизведения" />
      <span class="mediaTime" data-audio-duration>0:00</span>
    </div>
    <div class="mediaError hidden" data-audio-error>Не удалось загрузить аудиозапись.</div>`;
}
