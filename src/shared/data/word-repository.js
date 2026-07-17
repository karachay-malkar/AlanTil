import {
  DICTIONARY_CACHE_KEY,
  DICTIONARY_CONTENT_VIEW,
  DICTIONARY_KEY,
  DICTIONARY_METADATA_TABLE,
  LEGACY_DICTIONARY_CACHE_KEYS,
} from "../../config/words.js?v=13.8";
import { getSupabaseClient } from "../auth/supabase-client.js?v=13.8";
import { getDisplayedWordCollection } from "../domain/alan-display.js?v=13.8";
import { normalizeSupabaseWordEntry, normalizeWordEntry } from "../domain/word-normalizer.js?v=13.8";
import { readJson, writeJson } from "../state/storage.js?v=13.8";

const PAGE_SIZE = 1000;
let words = null;
let loadingPromise = null;
let requestCount = 0;
let source = "none";
let installedVersion = "";

function normalizeCollection(collection, source = "cache") {
  const normalize = source === "supabase" ? normalizeSupabaseWordEntry : normalizeWordEntry;
  return (Array.isArray(collection) ? collection : [])
    .map((row) => normalize(row))
    .filter(Boolean)
    .sort((left, right) => Number(left.global_order || left.dict_order || 0) - Number(right.global_order || right.dict_order || 0));
}

function validateDictionary(collection) {
  if (!collection.length) throw new Error("Сервер вернул пустой словарь.");
  const identifiers = new Set();
  for (const word of collection) {
    if (!word.id || !word.story_id || !word.dictionary_id || !word.section_id) {
      throw new Error("Структура словаря повреждена: отсутствуют обязательные разделы.");
    }
    if ((!word.wordAlanCyrillic && !word.wordAlanTurkic) || !word.translationRu) {
      throw new Error(`Структура словаря повреждена: отсутствует текст слова ${word.id}.`);
    }
    if (identifiers.has(word.id)) throw new Error(`В словаре повторяется word_id: ${word.id}`);
    identifiers.add(word.id);
  }
  return collection;
}

function clearLegacyDictionaryCaches() {
  try {
    LEGACY_DICTIONARY_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Restricted storage must not prevent a fresh dictionary download.
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

async function fetchContentWords(client) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    requestCount += 1;
    const result = await client
      .from(DICTIONARY_CONTENT_VIEW)
      .select("*")
      .order("global_order", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (result.error) throw result.error;
    const page = Array.isArray(result.data) ? result.data : [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchLatestVersion(client) {
  requestCount += 1;
  const { data, error } = await client
    .from(DICTIONARY_METADATA_TABLE)
    .select("current_version")
    .eq("dictionary_key", DICTIONARY_KEY)
    .single();
  if (error) throw error;
  const version = String(data?.current_version || "").trim();
  if (!version) throw new Error("Версия словаря на сервере не указана.");
  return version;
}

async function downloadDictionary() {
  const client = await getSupabaseClient();
  const version = await fetchLatestVersion(client);
  const downloadedWords = validateDictionary(normalizeCollection(await fetchContentWords(client), "supabase"));
  if (!writeJson(DICTIONARY_CACHE_KEY, { version, words: downloadedWords })) {
    throw new Error("Не удалось сохранить словарь на устройстве.");
  }
  words = downloadedWords;
  installedVersion = version;
  source = "supabase";
  return { version, words: downloadedWords };
}

export async function getWords() {
  if (words) return getDisplayedWordCollection(words);
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    clearLegacyDictionaryCaches();
    const cached = readDictionaryCache();
    if (cached) {
      words = cached.words;
      installedVersion = cached.version;
      source = "cache";
      return getDisplayedWordCollection(words);
    }
    return getDisplayedWordCollection((await downloadDictionary()).words);
  })().finally(() => {
    loadingPromise = null;
  });

  return loadingPromise;
}

export function getCachedWords() {
  return getDisplayedWordCollection(words || []);
}

export function getInstalledDictionaryVersion() {
  return installedVersion || readDictionaryCache()?.version || "";
}

export async function getDictionaryVersionStatus() {
  clearLegacyDictionaryCaches();
  const currentVersion = getInstalledDictionaryVersion();
  const client = await getSupabaseClient();
  const latestVersion = await fetchLatestVersion(client);
  return {
    currentVersion,
    latestVersion,
    needsUpdate: currentVersion !== latestVersion,
  };
}

export async function refreshDictionary() {
  if (loadingPromise) await loadingPromise;
  loadingPromise = downloadDictionary().finally(() => {
    loadingPromise = null;
  });
  const result = await loadingPromise;
  globalThis.dispatchEvent?.(new CustomEvent("alantil:dictionary-updated", { detail: { version: result.version } }));
  return { ...result, words: getDisplayedWordCollection(result.words) };
}

export function getRepositoryDiagnostics() {
  return { requestCount, cached: Array.isArray(words), source, installedVersion };
}
