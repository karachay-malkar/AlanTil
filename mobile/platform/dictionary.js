import AsyncStorage from '@react-native-async-storage/async-storage';
import { STARTER_DICTIONARY, STARTER_DICTIONARY_VERSION } from '../../src/data/starter-dictionary.js';
import {
  DICTIONARY_CACHE_KEY,
  DICTIONARY_CONTENT_TABLE,
  DICTIONARY_DOWNLOAD_TIMEOUT_MS,
  DICTIONARY_METADATA_TABLE,
  DICTIONARY_PAGE_SIZE,
  DICTIONARY_RETRY_DELAYS_MS,
  DICTIONARY_STORIES_TABLE,
  DICTIONARY_VERSION_TIMEOUT_MS,
  dictionaryRestParameters,
  storiesByDictionary,
} from '../../packages/alantil-core/dictionary-contract.js';
import { normalizeLegacyWordEntry, normalizeSupabaseWordEntry, normalizeWordEntry } from '../../packages/alantil-core/word-normalizer.js';
import { nativeAuthFetch } from './auth.js';

const CACHE_KEY = `native:${DICTIONARY_CACHE_KEY}`;
let installed = null;
let loadingPromise = null;
let requestCount = 0;

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms))); }
function sortWords(rows) { return rows.slice().sort((a, b) => Number(a.global_order || a.dict_order || 0) - Number(b.global_order || b.dict_order || 0)); }

export function validateNativeDictionary(collection) {
  if (!Array.isArray(collection) || !collection.length) throw new Error('Dictionary is empty');
  const identifiers = new Set();
  for (const word of collection) {
    if (!word?.id || !word.story_id || !word.dictionary_id || !word.section_id || !word.set_id) throw new Error(`Dictionary structure is invalid (${word?.id || 'unknown'})`);
    if ((!word.wordAlanCyrillic && !word.wordAlanTurkic) || !word.translationRu) throw new Error(`Dictionary word text is invalid (${word.id})`);
    if (identifiers.has(word.id)) throw new Error(`Duplicate word_id (${word.id})`);
    identifiers.add(word.id);
  }
  return collection;
}

function normalizeCached(collection) {
  return validateNativeDictionary(sortWords((Array.isArray(collection) ? collection : []).map((row) => normalizeWordEntry(row)).filter(Boolean)));
}

function normalizeSupabase(collection, stories) {
  const storyMap = storiesByDictionary(stories);
  return validateNativeDictionary(sortWords((Array.isArray(collection) ? collection : []).map((row) => normalizeSupabaseWordEntry(row, storyMap.get(String(row?.dictionary_id || '').trim()) || null)).filter(Boolean)));
}

function starterSnapshot() {
  return {
    version: STARTER_DICTIONARY_VERSION,
    words: validateNativeDictionary(sortWords(STARTER_DICTIONARY.map((row) => normalizeLegacyWordEntry(row)).filter(Boolean))),
    source: 'starter-fallback',
  };
}

async function readCache() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const version = String(parsed?.version || '').trim();
    if (!version) return null;
    return { version, words: normalizeCached(parsed.words), source: 'cache' };
  } catch { return null; }
}

async function writeCache(snapshot) {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ version: snapshot.version, words: snapshot.words }));
}

async function fetchJson(path, params, timeoutMs) {
  requestCount += 1;
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') query.set(key, String(value)); });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await nativeAuthFetch(`/rest/v1/${path}?${query.toString()}`, { method: 'GET', signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Dictionary request failed (${response.status})`);
    return response.json();
  } finally { clearTimeout(timer); }
}

async function fetchVersion() {
  const rows = await fetchJson(DICTIONARY_METADATA_TABLE, dictionaryRestParameters('version'), DICTIONARY_VERSION_TIMEOUT_MS);
  const version = String(rows?.[0]?.current_version || '').trim();
  if (!version) throw new Error('Dictionary version is missing');
  return version;
}

async function fetchWords() {
  const rows = [];
  for (let offset = 0; ; offset += DICTIONARY_PAGE_SIZE) {
    const page = await fetchJson(DICTIONARY_CONTENT_TABLE, dictionaryRestParameters('words', { offset }), DICTIONARY_DOWNLOAD_TIMEOUT_MS);
    const list = Array.isArray(page) ? page : [];
    rows.push(...list);
    if (list.length < DICTIONARY_PAGE_SIZE) break;
  }
  return rows;
}

async function download(version = '') {
  const [resolvedVersion, rawWords, rawStories] = await Promise.all([
    version ? Promise.resolve(version) : fetchVersion(),
    fetchWords(),
    fetchJson(DICTIONARY_STORIES_TABLE, dictionaryRestParameters('stories'), DICTIONARY_DOWNLOAD_TIMEOUT_MS),
  ]);
  const snapshot = { version: resolvedVersion, words: normalizeSupabase(rawWords, rawStories), source: 'supabase-rest' };
  await writeCache(snapshot);
  installed = snapshot;
  return snapshot;
}

async function retry(operation) {
  let lastError = null;
  for (const waitMs of DICTIONARY_RETRY_DELAYS_MS) {
    if (waitMs) await delay(waitMs);
    try { return await operation(); } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Dictionary request failed');
}

export async function bootstrapNativeDictionary() {
  if (installed) return installed;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const cached = await readCache();
    if (cached) {
      installed = cached;
      refreshNativeDictionary().catch(() => {});
      return installed;
    }
    try { return await retry(() => download()); }
    catch { installed = starterSnapshot(); return installed; }
  })().finally(() => { loadingPromise = null; });
  return loadingPromise;
}

export async function refreshNativeDictionary() {
  const current = installed || await readCache();
  const latestVersion = await retry(fetchVersion);
  if (current?.version === latestVersion && current?.words?.length) { installed = current; return { ...current, changed: false }; }
  const snapshot = await retry(() => download(latestVersion));
  return { ...snapshot, changed: true };
}

export function getNativeDictionarySnapshot() { return installed; }
export function getNativeDictionaryDiagnostics() {
  return { requestCount, source: installed?.source || 'none', installedVersion: installed?.version || '', total: installed?.words?.length || 0 };
}
