import { createFavoritesStore } from "./favorites-store.js";

export const SONG_FAVORITES_KEY = "alantil_song_favorites_v1";
export const songFavorites = createFavoritesStore(SONG_FAVORITES_KEY);
