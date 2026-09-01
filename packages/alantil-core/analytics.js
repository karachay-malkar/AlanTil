export const EVENTS = Object.freeze({
  APP_OPEN: "app_open",
  SCREEN_TIME: "screen_time",
  ACTIVITY_START: "activity_start",
  ACTIVITY_COMPLETE: "activity_complete",
  ACTIVITY_ABANDON: "activity_abandon",
  WORD_RESULT: "word_result",
  SONGS_OPEN: "songs_open",
  PLAYLIST_OPEN: "playlist_open",
  SONG_OPEN: "song_open",
  SONG_PLAY: "song_play",
  SONG_PAUSE: "song_pause",
  SONG_COMPLETE: "song_complete",
  SONG_PROGRESS: "song_progress",
  FAVORITE_WORD_ADD: "favorite_word_add",
  FAVORITE_WORD_REMOVE: "favorite_word_remove",
  FAVORITE_SONG_ADD: "favorite_song_add",
  FAVORITE_SONG_REMOVE: "favorite_song_remove",
  SEARCH_OPEN: "search_open",
  SEARCH_RESULT: "search_result",
  SEARCH_EMPTY: "search_empty",
  DICTIONARY_OPEN: "dictionary_open",
  SECTION_OPEN: "section_open",
  SET_OPEN: "set_open",
});

export const ACTIVITY_TYPES = Object.freeze({ LEARN: "learn", TEST: "test", MATCH: "match" });
export const DIRECTIONS = Object.freeze({ ALAN_RU: "alan_ru", RU_ALAN: "ru_alan", NONE: "none" });
export const CANCEL_REASONS = Object.freeze({ BACK: "back", HOME: "home", ROUTE_CHANGE: "route_change", RELOAD: "reload", CLOSE: "close", NEW_SESSION: "new_session" });
export const WORD_SOURCES = Object.freeze({ LEARN: "learn", TEST: "test", MATCH: "match", SONG: "song" });
export const WORD_RESULTS = Object.freeze({ KNOWN: "known", UNKNOWN: "unknown", CORRECT: "correct", WRONG: "wrong", OPENED: "opened" });
export const SEARCH_AREAS = Object.freeze({ SONGS: "songs", DICTIONARY: "dictionary" });
export const SEARCH_MODES = Object.freeze({ TITLE: "title", ARTIST: "artist", LYRICS: "lyrics", WORD: "word", TRANSLATION: "translation" });

export const FORBIDDEN_ANALYTICS_PARAMETER_NAMES = Object.freeze([
  "name", "email", "phone", "telephone", "telegram_id", "telegram_username", "username",
  "exact_location", "latitude", "longitude", "message", "messages", "query", "search_query",
  "free_text", "word", "translation", "lyrics", "text",
]);
const FORBIDDEN_SET = new Set(FORBIDDEN_ANALYTICS_PARAMETER_NAMES);

export function directionFromMode(mode) {
  if (mode === "kb") return DIRECTIONS.ALAN_RU;
  if (mode === "ru") return DIRECTIONS.RU_ALAN;
  return DIRECTIONS.NONE;
}

export function sanitizeAnalyticsParameters(parameters = {}, options = {}) {
  const safe = {};
  const maxEntries = Math.max(0, Number(options.maxEntries ?? Number.POSITIVE_INFINITY));
  const keyMaxLength = Math.max(1, Number(options.keyMaxLength ?? Number.POSITIVE_INFINITY));
  const stringMaxLength = Math.max(0, Number(options.stringMaxLength ?? 300));
  const normalizeKeys = options.normalizeKeys === true;
  Object.entries(parameters || {}).slice(0, maxEntries).forEach(([rawKey, value]) => {
    const sourceKey = String(rawKey || "").trim();
    const key = (normalizeKeys ? sourceKey.replace(/[^a-zA-Z0-9_]/g, "") : sourceKey).slice(0, keyMaxLength);
    if (!key || FORBIDDEN_SET.has(key.toLowerCase())) return;
    if (typeof value === "boolean") safe[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === "string") safe[key] = value.slice(0, stringMaxLength);
  });
  return safe;
}
