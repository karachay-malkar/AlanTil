import { getAnalyticsContext, trackEvent } from "../analytics/analytics.js";
import { EVENTS } from "../analytics/events.js";
import { createFavoritesStore } from "./favorites-store.js";

export const SONG_FAVORITES_KEY = "alantil_song_favorites_v1";
const store = createFavoritesStore(SONG_FAVORITES_KEY);

export const songFavorites = {
  reload: store.reload,
  has: store.has,
  subscribe: store.subscribe,
  toggle(id) {
    const normalized = String(id || "").trim();
    const active = store.toggle(normalized);
    trackEvent(active ? EVENTS.FAVORITE_SONG_ADD : EVENTS.FAVORITE_SONG_REMOVE, {
      item_id: normalized,
      source_screen: getAnalyticsContext().screen_name || "unknown",
    });
    return active;
  },
};
