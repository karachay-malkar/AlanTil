// Web origin: 13.15.12/src/config/words.js + src/shared/data/word-repository.js
export const DICTIONARY_CACHE_KEY = 'alantil_dictionary_cache_v5';
export const LEGACY_DICTIONARY_CACHE_KEYS = Object.freeze([
  'fc_words_cache_v30',
  'alantil_dictionary_cache_v1',
  'alantil_dictionary_cache_v2',
  'alantil_dictionary_cache_v3',
  'alantil_dictionary_cache_v4',
]);
export const DICTIONARY_METADATA_TABLE = 'dictionary_metadata';
export const DICTIONARY_CONTENT_TABLE = 'v_words_app';
export const DICTIONARY_STORIES_TABLE = 'content_stories';
export const DICTIONARY_KEY = 'main';
export const DICTIONARY_PAGE_SIZE = 1000;
export const DICTIONARY_DOWNLOAD_TIMEOUT_MS = 15000;
export const DICTIONARY_VERSION_TIMEOUT_MS = 5000;
export const DICTIONARY_RETRY_DELAYS_MS = Object.freeze([0, 5000, 30000]);

export function storiesByDictionary(stories = []) {
  const map = new Map();
  (Array.isArray(stories) ? stories : [])
    .slice()
    .sort((left, right) => Number(left?.story_order || 0) - Number(right?.story_order || 0))
    .forEach((story) => {
      const dictionaryIds = Array.isArray(story?.dictionary_ids) ? story.dictionary_ids : [];
      dictionaryIds.forEach((dictionaryId) => {
        const id = String(dictionaryId || '').trim();
        if (id && !map.has(id)) map.set(id, story);
      });
    });
  return map;
}

export function dictionaryRestParameters(kind, { offset = 0 } = {}) {
  if (kind === 'words') return { select: '*', order: 'global_order.asc', offset, limit: DICTIONARY_PAGE_SIZE };
  if (kind === 'stories') return { select: '*', order: 'story_order.asc' };
  if (kind === 'version') return { select: 'current_version', dictionary_key: `eq.${DICTIONARY_KEY}`, limit: 1 };
  return {};
}
