import { trackEvent } from "../../shared/analytics/analytics.js?v=13.8.1";
import { EVENTS } from "../../shared/analytics/events.js?v=13.8.1";
import { PAUSE_ICON_SVG, PLAY_ICON_SVG } from "../../shared/ui/icons.js?v=13.8.1";
import { renderMediaPlayer } from "../../shared/ui/media-player.js?v=13.8.1";
import { resetPlayerState, songsState } from "./state.js?v=13.8.1";

const PROGRESS_THRESHOLDS = [25, 50, 75, 90];
let audio = null;
let cleanup = [];
let currentContainer = null;
let analyticsState = null;

function listen(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  cleanup.push(() => target.removeEventListener(type, handler, options));
}

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

function rounded(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function syncState() {
  if (!audio) return;
  songsState.player.currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  songsState.player.duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  songsState.player.playing = !audio.paused && !audio.ended;
}

function updateListening(force = false) {
  if (!audio || !analyticsState) return;
  const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  if (analyticsState.lastAudioTime !== null && (!audio.paused || force)) {
    const delta = currentTime - analyticsState.lastAudioTime;
    if (delta > 0 && delta <= 5) analyticsState.listenedSec += delta;
  }
  analyticsState.lastAudioTime = currentTime;
}

function analyticsParameters() {
  return {
    song_id: analyticsState?.songId || "",
    playlist_id: analyticsState?.playlistId || "",
    position_sec: rounded(audio?.currentTime),
    duration_sec: rounded(audio?.duration),
  };
}

function trackPause() {
  if (!audio || !analyticsState?.hasPlayed) return;
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  const nearEnd = duration > 0 && audio.currentTime >= duration - 0.5;
  if (audio.ended || nearEnd || analyticsState.lastEvent === "pause") return;
  updateListening(true);
  analyticsState.lastEvent = "pause";
  trackEvent(EVENTS.SONG_PAUSE, analyticsParameters());
}

function trackProgress() {
  if (!audio || !analyticsState || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
  const percent = (audio.currentTime / audio.duration) * 100;
  PROGRESS_THRESHOLDS.forEach((threshold) => {
    if (percent < threshold || analyticsState.progress.has(threshold)) return;
    analyticsState.progress.add(threshold);
    trackEvent(EVENTS.SONG_PROGRESS, {
      ...analyticsParameters(),
      progress_percent: threshold,
    });
  });
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
  if (audio && !audio.paused && !audio.ended) trackPause();
  cleanup.splice(0).forEach((remove) => remove());
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    try { audio.load(); } catch { /* no-op */ }
  }
  audio = null;
  currentContainer = null;
  analyticsState = null;
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
  analyticsState = {
    songId: song.id || "",
    playlistId: song.playlistId || "",
    listenedSec: 0,
    lastAudioTime: null,
    hasPlayed: false,
    completed: false,
    lastEvent: "",
    progress: new Set(),
  };
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
    if (analyticsState) analyticsState.lastAudioTime = audio.currentTime;
    trackProgress();
    notify();
  });
  listen(audio, "loadedmetadata", notify);
  listen(audio, "durationchange", notify);
  listen(audio, "timeupdate", () => {
    updateListening();
    trackProgress();
    notify();
  });
  listen(audio, "play", () => {
    if (analyticsState) {
      analyticsState.hasPlayed = true;
      analyticsState.lastAudioTime = audio.currentTime;
      analyticsState.lastEvent = "play";
    }
    trackEvent(EVENTS.SONG_PLAY, analyticsParameters());
    notify();
  });
  listen(audio, "pause", () => {
    trackPause();
    notify();
  });
  listen(audio, "ended", () => {
    updateListening(true);
    if (analyticsState && !analyticsState.completed) {
      analyticsState.completed = true;
      analyticsState.lastEvent = "complete";
      trackEvent(EVENTS.SONG_COMPLETE, {
        song_id: analyticsState.songId,
        playlist_id: analyticsState.playlistId,
        listened_sec: rounded(analyticsState.listenedSec),
        audio_duration_sec: rounded(audio.duration),
      });
    }
    notify();
  });
  listen(audio, "error", () => {
    error?.classList.remove("hidden");
    notify();
  });

  updateView();
  return audio;
}
