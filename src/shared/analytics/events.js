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
export const CANCEL_REASONS = Object.freeze({
  BACK: "back",
  HOME: "home",
  ROUTE_CHANGE: "route_change",
  RELOAD: "reload",
  CLOSE: "close",
  NEW_SESSION: "new_session",
});
export const WORD_SOURCES = Object.freeze({ LEARN: "learn", TEST: "test", MATCH: "match", SONG: "song" });
export const WORD_RESULTS = Object.freeze({ KNOWN: "known", UNKNOWN: "unknown", CORRECT: "correct", WRONG: "wrong", OPENED: "opened" });
export const SEARCH_AREAS = Object.freeze({ SONGS: "songs", DICTIONARY: "dictionary" });
export const SEARCH_MODES = Object.freeze({ TITLE: "title", ARTIST: "artist", LYRICS: "lyrics", WORD: "word", TRANSLATION: "translation" });

export function directionFromMode(mode) {
  if (mode === "kb") return DIRECTIONS.ALAN_RU;
  if (mode === "ru") return DIRECTIONS.RU_ALAN;
  return DIRECTIONS.NONE;
}
