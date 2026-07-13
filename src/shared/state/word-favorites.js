import { getAnalyticsContext, trackEvent } from "../analytics/analytics.js";
import { EVENTS } from "../analytics/events.js";
import { normalizeId } from "../domain/word-normalizer.js";
import { createFavoritesStore } from "./favorites-store.js";

export const WORD_FAVORITES_KEY = "fc_favorites_v1";
const store = createFavoritesStore(WORD_FAVORITES_KEY, normalizeId);

export const wordFavorites = {
  reload: store.reload,
  has: store.has,
  subscribe: store.subscribe,
  toggle(id) {
    const active = store.toggle(id);
    trackEvent(active ? EVENTS.FAVORITE_WORD_ADD : EVENTS.FAVORITE_WORD_REMOVE, {
      item_id: normalizeId(id),
      source_screen: getAnalyticsContext().screen_name || "unknown",
    });
    return active;
  },
};
