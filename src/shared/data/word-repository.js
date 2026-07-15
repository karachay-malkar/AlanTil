import { WORDS_CACHE_KEY, WORDS_FALLBACK, WORDS_SHEET_URL } from "../../config/words.js";
import { normalizeWordEntry } from "../domain/word-normalizer.js";
import { readJson, writeJson } from "../state/storage.js";
import { normalizeToCsvUrl, parseCsv } from "./csv.js";

let words = null;
let loadingPromise = null;
let requestCount = 0;

function normalizeCollection(collection) {
  return (Array.isArray(collection) ? collection : [])
    .map(normalizeWordEntry)
    .filter(Boolean);
}

async function fetchWords() {
  const csvUrl = normalizeToCsvUrl(WORDS_SHEET_URL);
  if (!csvUrl || !csvUrl.startsWith("http")) return [];
  requestCount += 1;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(csvUrl, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`CSV load failed: ${response.status}`);
    return parseCsv(await response.text());
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function getWords() {
  if (words) return words;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const cached = normalizeCollection(readJson(WORDS_CACHE_KEY, null));

    try {
      const remoteWords = normalizeCollection(await fetchWords());
      if (remoteWords.length) {
        words = remoteWords;
        writeJson(WORDS_CACHE_KEY, words);
        return words;
      }
    } catch (error) {
      console.warn("word-repository: fetch failed", error);
    }

    if (cached.length) {
      words = cached;
      return words;
    }

    words = normalizeCollection(WORDS_FALLBACK);
    return words;
  })().finally(() => {
    loadingPromise = null;
  });

  return loadingPromise;
}

export function getCachedWords() {
  return words || [];
}

export function getRepositoryDiagnostics() {
  return { requestCount, cached: Array.isArray(words), size: words?.length || 0 };
}
