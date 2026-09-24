import { msg } from "../i18n/index.js?v=16.8.0.3";
import {
  DICTIONARY_CACHE_KEY,
  DICTIONARY_CONTENT_TABLE,
  DICTIONARY_KEY,
  DICTIONARY_METADATA_TABLE,
  DICTIONARY_STORIES_TABLE,
  LEGACY_DICTIONARY_CACHE_KEYS,
} from "../../config/words.js?v=16.8.0.3";
import { supabasePublishableKey, supabaseUrl } from "../../config/supabase.js?v=16.8.0.3";
import { STARTER_DICTIONARY, STARTER_DICTIONARY_VERSION } from "../../data/starter-dictionary.js?v=16.8.0.3";
import { getDisplayedWordCollection } from "../domain/alan-display.js?v=16.8.0.3";
import { getUserSettings } from "../settings/user-settings-store.js?v=16.8.0.3";
import { normalizeSupabaseWordEntry, normalizeWordEntry } from "../domain/word-structure-compat.js?v=16.8.0.3";
import { readJson, writeJson } from "../state/storage.js?v=16.8.0.3";
import { DICTIONARY_STORE_SCHEMA_VERSION, readDictionarySnapshot, writeDictionarySnapshot } from "./dictionary-store.js?v=16.8.0.3";

const PAGE_SIZE = 1000;
const DOWNLOAD_TIMEOUT_MS = 15000;
const VERSION_TIMEOUT_MS = 5000;
const RETRY_DELAYS_MS = Object.freeze([0, 5000, 30000]);
const BUNDLED_DICTIONARY_URL = "/src/data/dictionary-snapshot.json?v=16.8.0.3";
const DICTIONARY_META_KEY = "alantil_dictionary_meta_v1";

let words = null;
let loadingPromise = null;
let backgroundPromise = null;
let versionPromise = null;
let retryTimer = 0;
let requestCount = 0;
let source = "none";
let installedVersion = "";
let onlineListenerBound = false;
let displayedWords = null;
let displayedWordsKey = "";

function mark(name) {
  try { globalThis.performance?.mark?.(name); } catch {}
}

function displayCacheKey() {
  const settings = getUserSettings();
  return [
    installedVersion,
    settings.interface_language_code,
    settings.translation_language_code,
    settings.alan_script_code,
    settings.alan_dialect_code,
  ].join("|");
}

function displayedCollection(collection = words || []) {
  const key = displayCacheKey();
  if (displayedWords && displayedWordsKey === key) return displayedWords;
  displayedWords = getDisplayedWordCollection(collection);
  displayedWordsKey = key;
  return displayedWords;
}

function invalidateDisplayedWords() {
  displayedWords = null;
  displayedWordsKey = "";
}

function delay(ms) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, Math.max(0, ms)));
}

function storiesByDictionary(stories = []) {
  const map = new Map();
  (Array.isArray(stories) ? stories : [])
    .slice()
    .sort((left, right) => Number(left?.story_order || 0) - Number(right?.story_order || 0))
    .forEach((story) => {
      const dictionaryIds = Array.isArray(story?.dictionary_ids) ? story.dictionary_ids : [];
      dictionaryIds.forEach((dictionaryId) => {
        const id = String(dictionaryId || "").trim();
        if (id && !map.has(id)) map.set(id, story);
      });
    });
  return map;
}

function normalizeCollection(collection, sourceName = "cache", stories = []) {
  if (sourceName === "supabase") {
    const storyMap = storiesByDictionary(stories);
    return (Array.isArray(collection) ? collection : [])
      .map((row) => normalizeSupabaseWordEntry(row, storyMap.get(String(row?.dictionary_id || "").trim()) || null))
      .filter(Boolean)
      .sort((left, right) => Number(left.global_order || 0) - Number(right.global_order || 0));
  }
  return (Array.isArray(collection) ? collection : [])
    .map((row) => normalizeWordEntry(row, { source: sourceName === "legacy" ? "legacy" : "auto" }))
    .filter(Boolean)
    .sort((left, right) => Number(left.global_order || left.dict_order || 0) - Number(right.global_order || right.dict_order || 0));
}

function validateDictionary(collection) {
  if (!collection.length) throw new Error(msg("service.server_vernul_pustoy_slovar"));
  const identifiers = new Set();
  for (const word of collection) {
    if (!word.id || !word.story_id || !word.dictionary_id || !word.section_id || !word.set_id) {
      throw new Error(msg("service.struktura_slovarya_povrezhdena_otsutstvuyut_obyazatelnye_r"));
    }
    if ((!word.wordAlanCyrillic && !word.wordAlanTurkic) || !word.translationRu) {
      throw new Error(msg("service.struktura_slovarya_povrezhdena_otsutstvuet_tekst_slova", { id: word.id }));
    }
    if (identifiers.has(word.id)) throw new Error(msg("service.v_slovare_povtoryaetsya_word_id", { id: word.id }));
    identifiers.add(word.id);
  }
  return collection;
}

function clearLegacyDictionaryCaches() {
  try {
    LEGACY_DICTIONARY_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {}
}

function readDictionaryMeta() {
  const value = readJson(DICTIONARY_META_KEY, null);
  const version = String(value?.version || "").trim();
  return version ? { version, schemaVersion: Number(value?.schema_version || 0) } : null;
}

function writeDictionaryMeta(version) {
  writeJson(DICTIONARY_META_KEY, { version, schema_version: DICTIONARY_STORE_SCHEMA_VERSION });
}

function readLegacyDictionaryCache() {
  const cached = readJson(DICTIONARY_CACHE_KEY, null);
  const version = String(cached?.version || "").trim();
  if (!version || !Array.isArray(cached?.words) || !cached.words.length) return null;
  try {
    return { version, words: validateDictionary(normalizeCollection(cached.words, "cache")), source: "localstorage-migration" };
  } catch {
    return null;
  }
}

function removeLegacyCurrentCache() {
  try { localStorage.removeItem(DICTIONARY_CACHE_KEY); } catch {}
}

function readStarterDictionary() {
  return {
    version: STARTER_DICTIONARY_VERSION,
    words: validateDictionary(normalizeCollection(STARTER_DICTIONARY, "legacy")),
    source: "starter",
  };
}

function migrateLegacyStoryWords(collection = []) {
  return (Array.isArray(collection) ? collection : []).map((word) => {
    const storyId = String(word?.storyId || word?.story_id || word?.story_type || "").trim();
    if (storyId !== "oblivion") return word;
    return normalizeWordEntry({ ...word, storyId: "understanding", story_id: "understanding", story_type: "understanding" });
  }).filter(Boolean);
}

function installSnapshot(snapshot) {
  words = migrateLegacyStoryWords(snapshot.words);
  installedVersion = String(snapshot.version || "").trim();
  source = String(snapshot.source || "local");
  invalidateDisplayedWords();
  return snapshot;
}

async function persistSnapshot(snapshot) {
  const stored = await writeDictionarySnapshot(snapshot);
  if (stored) {
    writeDictionaryMeta(snapshot.version);
    removeLegacyCurrentCache();
    return true;
  }
  const fallback = writeJson(DICTIONARY_CACHE_KEY, { version: snapshot.version, words: snapshot.words });
  if (fallback) writeDictionaryMeta(snapshot.version);
  return fallback;
}

async function loadBundledSnapshot({ signal } = {}) {
  const response = await fetch(BUNDLED_DICTIONARY_URL, { method: "GET", cache: "force-cache", signal });
  if (!response.ok) throw new Error("Bundled dictionary failed: " + response.status);
  const bundled = await response.json();
  const version = String(bundled?.version || "").trim();
  const rawWords = Array.isArray(bundled?.words) ? bundled.words : [];
  const rawStories = Array.isArray(bundled?.stories) ? bundled.stories : [];
  if (!version || !rawWords.length) throw new Error("Bundled dictionary is invalid");
  return {
    version,
    words: validateDictionary(normalizeCollection(rawWords, "supabase", rawStories)),
    source: "bundled-snapshot",
  };
}

async function loadLocalSnapshot({ signal, includeBundled = true } = {}) {
  clearLegacyDictionaryCaches();

  const indexed = await readDictionarySnapshot();
  if (indexed?.version && Array.isArray(indexed.words) && indexed.words.length) {
    writeDictionaryMeta(indexed.version);
    mark("alantil:dictionary:local-ready");
    return installSnapshot(indexed);
  }

  const legacy = readLegacyDictionaryCache();
  if (legacy) {
    installSnapshot(legacy);
    await persistSnapshot(legacy);
    mark("alantil:dictionary:local-ready");
    return legacy;
  }

  if (!includeBundled) return null;
  try {
    const bundled = await loadBundledSnapshot({ signal });
    installSnapshot(bundled);
    await persistSnapshot(bundled);
    mark("alantil:dictionary:local-ready");
    return bundled;
  } catch {
    return null;
  }
}

function restUrl(resource, parameters = {}) {
  const url = new URL("/rest/v1/" + resource, supabaseUrl);
  Object.entries(parameters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  return url;
}

async function fetchRestJson(url, label, { timeoutMs = DOWNLOAD_TIMEOUT_MS, signal } = {}) {
  requestCount += 1;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: { apikey: supabasePublishableKey, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(label + " failed: " + response.status);
    return response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(signal?.aborted ? label + " aborted" : label + " timeout");
      timeoutError.code = signal?.aborted ? "ALANTIL_ABORTED" : "ALANTIL_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

async function fetchContentWords({ signal } = {}) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await fetchRestJson(restUrl(DICTIONARY_CONTENT_TABLE, {
      select: "*",
      order: "global_order.asc",
      offset: from,
      limit: PAGE_SIZE,
    }), "Dictionary page", { timeoutMs: DOWNLOAD_TIMEOUT_MS, signal });
    const normalizedPage = Array.isArray(page) ? page : [];
    rows.push(...normalizedPage);
    if (normalizedPage.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchContentStories({ signal } = {}) {
  const data = await fetchRestJson(restUrl(DICTIONARY_STORIES_TABLE, {
    select: "*",
    order: "story_order.asc",
  }), "Dictionary stories", { timeoutMs: DOWNLOAD_TIMEOUT_MS, signal });
  return Array.isArray(data) ? data : [];
}

async function fetchLatestVersion({ signal, timeoutMs = VERSION_TIMEOUT_MS } = {}) {
  const data = await fetchRestJson(restUrl(DICTIONARY_METADATA_TABLE, {
    select: "current_version",
    dictionary_key: "eq." + DICTIONARY_KEY,
    limit: 1,
  }), "Dictionary version", { timeoutMs, signal });
  const version = String(data?.[0]?.current_version || "").trim();
  if (!version) throw new Error(msg("service.versiya_slovarya_na_servere_ne_ukazana"));
  return version;
}

function sharedLatestVersion() {
  if (versionPromise) return versionPromise;
  versionPromise = fetchLatestVersion().finally(() => { versionPromise = null; });
  return versionPromise;
}

async function retry(operation) {
  let lastError = null;
  for (const waitMs of RETRY_DELAYS_MS) {
    if (waitMs) await delay(waitMs);
    try { return await operation(); }
    catch (error) {
      lastError = error;
      if (globalThis.navigator && navigator.onLine === false) break;
    }
  }
  throw lastError || new Error("Dictionary request failed");
}

async function downloadDictionary(expectedVersion = "", { signal } = {}) {
  const contentPromise = Promise.all([fetchContentWords({ signal }), fetchContentStories({ signal })]);
  const [version, [rawWords, rawStories]] = expectedVersion
    ? [expectedVersion, await contentPromise]
    : await Promise.all([fetchLatestVersion({ signal, timeoutMs: DOWNLOAD_TIMEOUT_MS }), contentPromise]);
  const snapshot = {
    version,
    words: validateDictionary(normalizeCollection(rawWords, "supabase", rawStories)),
    source: "supabase-rest",
  };
  installSnapshot(snapshot);
  await persistSnapshot(snapshot);
  globalThis.dispatchEvent?.(new CustomEvent("alantil:dictionary-updated", {
    detail: { version, total: snapshot.words.length },
  }));
  return { version, words: snapshot.words, changed: true };
}

async function refreshDictionaryIfNeeded({ signal } = {}) {
  const latestVersion = signal ? await fetchLatestVersion({ signal }) : await sharedLatestVersion();
  const currentVersion = getInstalledDictionaryVersion();
  if (source !== "starter" && Array.isArray(words) && words.length && latestVersion === currentVersion) {
    return { version: currentVersion, words, changed: false };
  }
  return downloadDictionary(latestVersion, { signal });
}

function bindOnlineRetry() {
  if (onlineListenerBound || !globalThis.addEventListener) return;
  onlineListenerBound = true;
  globalThis.addEventListener("online", () => scheduleBackgroundRefresh({ immediate: true }));
}

function scheduleBackgroundRefresh({ immediate = false } = {}) {
  bindOnlineRetry();
  if (backgroundPromise) return backgroundPromise;
  if (retryTimer) globalThis.clearTimeout(retryTimer);
  const run = async () => {
    retryTimer = 0;
    if (globalThis.navigator && navigator.onLine === false) return null;
    backgroundPromise = retry(refreshDictionaryIfNeeded)
      .catch((error) => {
        console.warn("Dictionary background refresh failed", error);
        retryTimer = globalThis.setTimeout(() => scheduleBackgroundRefresh({ immediate: true }), 60000);
        return null;
      })
      .finally(() => { backgroundPromise = null; });
    return backgroundPromise;
  };
  if (immediate) return run();
  retryTimer = globalThis.setTimeout(run, 900);
  return null;
}

export async function getWords() {
  if (words) return displayedCollection(words);
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const local = await loadLocalSnapshot({ includeBundled: true });
    if (local) {
      scheduleBackgroundRefresh();
      return displayedCollection(words);
    }
    installSnapshot(readStarterDictionary());
    scheduleBackgroundRefresh();
    return displayedCollection(words);
  })().finally(() => { loadingPromise = null; });
  return loadingPromise;
}

export async function getCompleteDictionaryWords({ signal } = {}) {
  if (Array.isArray(words) && words.length && source !== "starter" && source !== "none") return displayedCollection(words);
  if (loadingPromise) await loadingPromise;
  if (Array.isArray(words) && words.length && source !== "starter" && source !== "none") return displayedCollection(words);

  const local = await loadLocalSnapshot({ signal, includeBundled: true });
  if (local) {
    scheduleBackgroundRefresh();
    return displayedCollection(words);
  }

  const result = await retry(() => downloadDictionary("", { signal }));
  return displayedCollection(result.words);
}

export function getCachedWords() {
  return displayedCollection(words || []);
}

export function getInstalledDictionaryVersion() {
  return installedVersion || readDictionaryMeta()?.version || readLegacyDictionaryCache()?.version || STARTER_DICTIONARY_VERSION;
}

export async function getDictionaryVersionStatus({ signal, retry: shouldRetry = false } = {}) {
  const currentVersion = getInstalledDictionaryVersion();
  const operation = () => signal ? fetchLatestVersion({ signal }) : sharedLatestVersion();
  const latestVersion = shouldRetry ? await retry(operation) : await operation();
  return { currentVersion, latestVersion, needsUpdate: currentVersion !== latestVersion };
}

export async function refreshDictionary({ signal, force = false } = {}) {
  if (loadingPromise) await loadingPromise;
  const result = await retry(() => force ? downloadDictionary("", { signal }) : refreshDictionaryIfNeeded({ signal }));
  return { ...result, words: displayedCollection(result.words) };
}

export function getRepositoryDiagnostics() {
  return {
    requestCount,
    cached: Array.isArray(words),
    source,
    storage: source === "indexeddb" ? "indexeddb" : source === "localstorage-migration" ? "localstorage" : source,
    installedVersion,
    backgroundRefreshing: Boolean(backgroundPromise),
    checkingVersion: Boolean(versionPromise),
  };
}
