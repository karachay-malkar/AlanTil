import { msg } from "../i18n/index.js?v=13.10.3";
import {
  DICTIONARY_CACHE_KEY,
  DICTIONARY_CONTENT_VIEW,
  DICTIONARY_KEY,
  DICTIONARY_METADATA_TABLE,
  LEGACY_DICTIONARY_CACHE_KEYS,
} from "../../config/words.js?v=13.9.0";
import { supabasePublishableKey, supabaseUrl } from "../../config/supabase.js?v=13.10.3";
import { STARTER_DICTIONARY, STARTER_DICTIONARY_VERSION } from "../../data/starter-dictionary.js?v=13.10.2";
import { getDisplayedWordCollection } from "../domain/alan-display.js?v=13.9.0";
import { getUserSettings } from "../settings/user-settings-store.js?v=13.10.12";
import { normalizeSupabaseWordEntry, normalizeWordEntry } from "../domain/word-normalizer.js?v=13.9.0";
import { readJson, writeJson } from "../state/storage.js?v=13.9.0";

const PAGE_SIZE = 1000;
const DOWNLOAD_TIMEOUT_MS = 15000;
const VERSION_TIMEOUT_MS = 5000;
const RETRY_DELAYS_MS = Object.freeze([0, 5000, 30000]);
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

function normalizeCollection(collection, sourceName = "cache") {
  const normalize = sourceName === "supabase" ? normalizeSupabaseWordEntry : normalizeWordEntry;
  return (Array.isArray(collection) ? collection : [])
    .map((row) => normalize(row))
    .filter(Boolean)
    .sort((left, right) => Number(left.global_order || left.dict_order || 0) - Number(right.global_order || right.dict_order || 0));
}

function validateDictionary(collection) {
  if (!collection.length) throw new Error(msg("service.server_vernul_pustoy_slovar"));
  const identifiers = new Set();
  for (const word of collection) {
    if (!word.id || !word.story_id || !word.dictionary_id || !word.section_id) {
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
  } catch {
    // Restricted storage must not prevent local fallback use.
  }
}

function readDictionaryCache() {
  const cached = readJson(DICTIONARY_CACHE_KEY, null);
  const cachedWords = normalizeCollection(cached?.words, "cache");
  const version = String(cached?.version || "").trim();
  if (!version || !cachedWords.length) return null;
  try {
    return { version, words: validateDictionary(cachedWords) };
  } catch {
    return null;
  }
}

function readStarterDictionary() {
  return {
    version: STARTER_DICTIONARY_VERSION,
    words: validateDictionary(normalizeCollection(STARTER_DICTIONARY, "supabase")),
  };
}

function restUrl(resource, parameters = {}) {
  const url = new URL(`/rest/v1/${resource}`, supabaseUrl);
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
      headers: {
        apikey: supabasePublishableKey,
        Accept: "application/json",
      },
    });
    if (!response.ok) throw new Error(`${label} failed: ${response.status}`);
    return response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(signal?.aborted ? `${label} aborted` : `${label} timeout`);
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
    const page = await fetchRestJson(restUrl(DICTIONARY_CONTENT_VIEW, {
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

async function fetchLatestVersion({ signal, timeoutMs = VERSION_TIMEOUT_MS } = {}) {
  const data = await fetchRestJson(restUrl(DICTIONARY_METADATA_TABLE, {
    select: "current_version",
    dictionary_key: `eq.${DICTIONARY_KEY}`,
    limit: 1,
  }), "Dictionary version", { timeoutMs, signal });
  const version = String(data?.[0]?.current_version || "").trim();
  if (!version) throw new Error(msg("service.versiya_slovarya_na_servere_ne_ukazana"));
  return version;
}

function sharedLatestVersion() {
  if (versionPromise) return versionPromise;
  versionPromise = fetchLatestVersion().finally(() => {
    versionPromise = null;
  });
  return versionPromise;
}

async function retry(operation) {
  let lastError = null;
  for (const waitMs of RETRY_DELAYS_MS) {
    if (waitMs) await delay(waitMs);
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (globalThis.navigator && navigator.onLine === false) break;
    }
  }
  throw lastError || new Error("Dictionary request failed");
}

async function downloadDictionary(expectedVersion = "", { signal } = {}) {
  const [version, rawWords] = expectedVersion
    ? [expectedVersion, await fetchContentWords({ signal })]
    : await Promise.all([fetchLatestVersion({ signal, timeoutMs: DOWNLOAD_TIMEOUT_MS }), fetchContentWords({ signal })]);
  const downloadedWords = validateDictionary(normalizeCollection(rawWords, "supabase"));
  writeJson(DICTIONARY_CACHE_KEY, { version, words: downloadedWords });
  words = downloadedWords;
  installedVersion = version;
  source = "supabase-rest";
  invalidateDisplayedWords();
  globalThis.dispatchEvent?.(new CustomEvent("alantil:dictionary-updated", {
    detail: { version, total: downloadedWords.length },
  }));
  return { version, words: downloadedWords, changed: true };
}

async function refreshDictionaryIfNeeded({ signal } = {}) {
  const currentVersion = getInstalledDictionaryVersion();
  const latestVersion = signal ? await fetchLatestVersion({ signal }) : await sharedLatestVersion();
  if (latestVersion === currentVersion) {
    return { version: currentVersion, words: words || readDictionaryCache()?.words || [], changed: false };
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
      .finally(() => {
        backgroundPromise = null;
      });
    return backgroundPromise;
  };
  if (immediate) return run();
  retryTimer = globalThis.setTimeout(run, 0);
  return null;
}

export async function getWords() {
  if (words) return displayedCollection(words);
  if (loadingPromise) return loadingPromise;

  loadingPromise = Promise.resolve().then(() => {
    clearLegacyDictionaryCaches();
    const cached = readDictionaryCache();
    const local = cached || readStarterDictionary();
    words = local.words;
    installedVersion = local.version;
    source = cached ? "cache" : "starter";
    invalidateDisplayedWords();
    scheduleBackgroundRefresh();
    return displayedCollection(words);
  }).finally(() => {
    loadingPromise = null;
  });
  return loadingPromise;
}

export function getCachedWords() {
  return displayedCollection(words || []);
}

export function getInstalledDictionaryVersion() {
  return installedVersion || readDictionaryCache()?.version || STARTER_DICTIONARY_VERSION;
}

export async function getDictionaryVersionStatus({ signal, retry: shouldRetry = false } = {}) {
  const currentVersion = getInstalledDictionaryVersion();
  const operation = () => signal ? fetchLatestVersion({ signal }) : sharedLatestVersion();
  const latestVersion = shouldRetry ? await retry(operation) : await operation();
  return { currentVersion, latestVersion, needsUpdate: currentVersion !== latestVersion };
}

export async function refreshDictionary({ signal } = {}) {
  if (loadingPromise) await loadingPromise;
  const result = await retry(() => refreshDictionaryIfNeeded({ signal }));
  return { ...result, words: displayedCollection(result.words) };
}

export function getRepositoryDiagnostics() {
  return {
    requestCount,
    cached: Array.isArray(words),
    source,
    installedVersion,
    backgroundRefreshing: Boolean(backgroundPromise),
    checkingVersion: Boolean(versionPromise),
  };
}
