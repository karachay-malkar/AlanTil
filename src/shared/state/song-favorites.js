import { getAnalyticsContext, trackEvent } from "../analytics/analytics.js?v=13.8.1";
import { EVENTS } from "../analytics/events.js?v=13.8.1";
import { enqueueProgress } from "../progress/progress-queue.js?v=13.8.1";
import { createFavoritesStore } from "./favorites-store.js?v=13.8.1";

export const SONG_FAVORITES_KEY = "alantil_song_favorites_v1";
const store = createFavoritesStore(SONG_FAVORITES_KEY);

function normalizeSongId(id) {
  return String(id || "").trim();
}

function queueFavorite(id, active) {
  const songId = normalizeSongId(id);
  if (!songId) return;
  enqueueProgress("song_favorite", {
    song_id: songId,
    is_active: Boolean(active),
    updated_at: new Date().toISOString(),
  }, { id: `song_favorite:${songId}` });
}

export const songFavorites = {
  reload: store.reload,
  has: store.has,
  values: store.values,
  replace: store.replace,
  subscribe: store.subscribe,
  setActive(id, active, { queue = true } = {}) {
    const result = store.setActive(id, active);
    if (queue) queueFavorite(id, result);
    return result;
  },
  toggle(id) {
    const normalized = normalizeSongId(id);
    const active = store.toggle(normalized);
    queueFavorite(normalized, active);
    trackEvent(active ? EVENTS.FAVORITE_SONG_ADD : EVENTS.FAVORITE_SONG_REMOVE, {
      item_id: normalized,
      source_screen: getAnalyticsContext().screen_name || "unknown",
    });
    return active;
  },
};
