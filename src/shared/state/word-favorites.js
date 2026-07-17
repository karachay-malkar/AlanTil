import { getAnalyticsContext, trackEvent } from "../analytics/analytics.js?v=13.8.1";
import { EVENTS } from "../analytics/events.js?v=13.8.1";
import { normalizeId } from "../domain/word-normalizer.js?v=13.8.1";
import { enqueueProgress } from "../progress/progress-queue.js?v=13.8.1";
import { createFavoritesStore } from "./favorites-store.js?v=13.8.1";

export const WORD_FAVORITES_KEY = "fc_favorites_v1";
const store = createFavoritesStore(WORD_FAVORITES_KEY, normalizeId);

function queueFavorite(id, active) {
  const wordId = normalizeId(id);
  if (!wordId) return;
  enqueueProgress("word_favorite", {
    word_id: wordId,
    is_active: Boolean(active),
    updated_at: new Date().toISOString(),
  }, { id: `word_favorite:${wordId}` });
}

export const wordFavorites = {
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
    const active = store.toggle(id);
    queueFavorite(id, active);
    trackEvent(active ? EVENTS.FAVORITE_WORD_ADD : EVENTS.FAVORITE_WORD_REMOVE, {
      item_id: normalizeId(id),
      source_screen: getAnalyticsContext().screen_name || "unknown",
    });
    return active;
  },
};
