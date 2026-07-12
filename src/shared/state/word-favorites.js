import { normalizeId } from "../domain/word-normalizer.js";
import { createFavoritesStore } from "./favorites-store.js";

export const WORD_FAVORITES_KEY = "fc_favorites_v1";
export const wordFavorites = createFavoritesStore(WORD_FAVORITES_KEY, normalizeId);
