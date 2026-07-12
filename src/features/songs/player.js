import { PAUSE_ICON_SVG, PLAY_ICON_SVG } from "../../shared/ui/icons.js";
import { renderMediaPlayer } from "../../shared/ui/media-player.js";
import { resetPlayerState, songsState } from "./state.js";

let audio = null;
let cleanup = [];
let currentContainer = null;

function listen(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  cleanup.push(() => target.removeEventListener(type, handler, options));
}

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

function syncState() {
  if (!audio) return;
  songsState.player.currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  songsState.player.duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  songsState.player.playing = !audio.paused && !audio.ended;
}

function updateView() {
  if (!audio || !currentContainer) return;
  syncState();
  const playButton = currentContainer.querySelector("[data-audio-play]");
  const range = currentContainer.querySelector("[data-audio-progress]");
  const current = currentContainer.querySelector("[data-audio-current]");
  const duration = currentContainer.querySelector("[data-audio-duration]");
  const progress = songsState.player.duration > 0
    ? Math.min(100, Math.max(0, (songsState.player.currentTime / songsState.player.duration) * 100))
    : 0;

  if (playButton) {
    playButton.innerHTML = songsState.player.playing ? PAUSE_ICON_SVG : PLAY_ICON_SVG;
    playButton.setAttribute("aria-label", songsState.player.playing ? "Поставить на паузу" : "Воспроизвести песню");
  }
  if (range) {
    range.max = String(songsState.player.duration || 0);
    range.value = String(songsState.player.currentTime || 0);
    range.style.setProperty("--media-progress", `${progress}%`);
  }
  if (current) current.textContent = formatTime(songsState.player.currentTime);
  if (duration) duration.textContent = formatTime(songsState.player.duration);
}

export function disposePlayer() {
  cleanup.splice(0).forEach((remove) => remove());
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    try { audio.load(); } catch { /* no-op */ }
  }
  audio = null;
  currentContainer = null;
  resetPlayerState();
}

export function pausePlayer() {
  audio?.pause();
  updateView();
}

export function getPlayerState() {
  syncState();
  return { ...songsState.player };
}

export function mountPlayer(container, song, { onStateChange } = {}) {
  disposePlayer();
  if (!container || !song?.audioUrl) return null;

  currentContainer = container;
  songsState.player.songId = song.id || null;
  container.innerHTML = renderMediaPlayer();

  audio = new Audio();
  audio.preload = "metadata";
  audio.src = song.audioUrl;

  const notify = () => {
    updateView();
    onStateChange?.(getPlayerState());
  };
  const playButton = container.querySelector("[data-audio-play]");
  const progress = container.querySelector("[data-audio-progress]");
  const error = container.querySelector("[data-audio-error]");

  listen(playButton, "click", async () => {
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch (playError) {
        console.warn("songs-player: playback failed", playError);
        error?.classList.remove("hidden");
      }
    } else {
      audio.pause();
    }
    notify();
  });
  listen(progress, "input", () => {
    if (!audio) return;
    audio.currentTime = Number(progress.value) || 0;
    notify();
  });
  ["loadedmetadata", "durationchange", "timeupdate", "play", "pause", "ended"].forEach((eventName) => {
    listen(audio, eventName, notify);
  });
  listen(audio, "error", () => {
    error?.classList.remove("hidden");
    notify();
  });

  updateView();
  return audio;
}
