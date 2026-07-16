import { WORDS_CACHE_KEY, WORDS_FALLBACK, WORDS_SHEET_URL } from "../../config/words.js";
import { getSupabaseClient } from "../auth/supabase-client.js";
import { normalizeWordEntry } from "../domain/word-normalizer.js";
import { readJson, writeJson } from "../state/storage.js";
import { normalizeToCsvUrl, parseCsv } from "./csv.js";

const CONTENT_VIEWS = ["content_words_ru", "v_words_app"];
const PAGE_SIZE = 1000;
let words = null;
let loadingPromise = null;
let requestCount = 0;
let source = "none";

function normalizeCollection(collection) {
  return (Array.isArray(collection) ? collection : [])
    .map(normalizeWordEntry)
    .filter(Boolean)
    .sort((left, right) => Number(left.global_order || left.dict_order || 0) - Number(right.global_order || right.dict_order || 0));
}

function isMissingContentSource(error) {
  return ["42P01", "PGRST205", "PGRST204"].includes(error?.code);
}

async function fetchContentView(client, viewName) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    requestCount += 1;
    const result = await client
      .from(viewName)
      .select("*")
      .order("global_order", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (result.error) {
      if (isMissingContentSource(result.error)) return null;
      throw result.error;
    }
    const page = Array.isArray(result.data) ? result.data : [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchSupabaseWords() {
  const client = await getSupabaseClient();
  for (const viewName of CONTENT_VIEWS) {
    const rows = await fetchContentView(client, viewName);
    if (Array.isArray(rows) && rows.length) return rows;
  }
  return [];
}

async function fetchCsvWords() {
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
      const cloudWords = normalizeCollection(await fetchSupabaseWords());
      if (cloudWords.length) {
        words = cloudWords;
        source = "supabase";
        writeJson(WORDS_CACHE_KEY, words);
        return words;
      }
    } catch (error) {
      console.warn("word-repository: Supabase content load failed", error);
    }

    try {
      const remoteWords = normalizeCollection(await fetchCsvWords());
      if (remoteWords.length) {
        words = remoteWords;
        source = "csv";
        writeJson(WORDS_CACHE_KEY, words);
        return words;
      }
    } catch (error) {
      console.warn("word-repository: CSV load failed", error);
    }

    if (cached.length) {
      words = cached;
      source = "cache";
      return words;
    }

    words = normalizeCollection(WORDS_FALLBACK);
    source = "fallback";
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
  return { requestCount, cached: Array.isArray(words), size: words?.length || 0, source };
}
