import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/src/lib/supabase';
import { legacyStructureNames, normalizeDictionaryScope } from '@/src/mobile/dictionary-policy';
import { STARTER_DICTIONARY, STARTER_DICTIONARY_VERSION } from '@/src/mobile/starter-dictionary';
import type { UserSettings } from '@/src/mobile/settings';

const PAGE_SIZE = 1000;
const DICTIONARY_CACHE_KEY = 'alantil_mobile_dictionary_cache_v14_2_0';
const STORY_CACHE_KEY = 'alantil_mobile_story_cache_v14_2_0';
const RETRY_DELAYS = [0, 1500, 5000] as const;

export type MobileWord = {
  word_id: string;
  global_order: number | null;
  story_id: string | null;
  story_name_ru: string | null;
  story_name_en: string | null;
  story_name_tr: string | null;
  dictionary_id: string | null;
  dictionary_name_ru: string | null;
  dictionary_name_en: string | null;
  dictionary_name_tr: string | null;
  section_id: string | null;
  section_name_ru: string | null;
  section_name_en: string | null;
  section_name_tr: string | null;
  set_id: string | null;
  set_name_ru: string | null;
  set_name_en: string | null;
  set_name_tr: string | null;
  pos: string | null;
  synonyms: string[] | string | null;
  word_alan_cyrillic: string | null;
  word_alan_turkic: string | null;
  translation_ru: string | null;
  translation_en: string | null;
  translation_tr: string | null;
  phrases_alan_cyrillic: string | string[] | null;
  phrases_alan_turkic: string | string[] | null;
  phrases_ru: string | string[] | null;
  phrases_en: string | string[] | null;
  phrases_tr: string | string[] | null;
};

export type StoryCopyRow = {
  entity_id: string;
  name_ru?: string | null;
  name_en?: string | null;
  name_tr?: string | null;
  intro_ru?: string | null;
  intro_en?: string | null;
  intro_tr?: string | null;
};

type DictionaryCache = { version: string; words: MobileWord[]; saved_at?: string };
export type DictionaryStatus = {
  installedVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  remoteAvailable: boolean;
};

let wordsCache: MobileWord[] | null = null;
let storyCopyCache: StoryCopyRow[] | null = null;
let installedVersion = '';
let backgroundRefresh: Promise<unknown> | null = null;
const listeners = new Set<() => void>();

function text(value: unknown) {
  return String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
}

function localized(row: Record<string, unknown>, base: string, language: UserSettings['interface_language_code']) {
  if (language === 'en') return text(row[`${base}_en`]);
  if (language === 'tr') return text(row[`${base}_tr`]);
  return text(row[`${base}_ru`]);
}

function normalizeWord(value: Record<string, unknown>): MobileWord | null {
  const scope = normalizeDictionaryScope({
    storyId: value.story_id,
    dictionaryId: value.dictionary_id,
    sectionId: value.section_id,
    setId: value.set_id,
    globalOrder: value.global_order,
  });
  const legacyNames = legacyStructureNames(scope);
  const word = {
    ...value,
    word_id: text(value.word_id),
    story_id: scope.storyId || null,
    story_name_ru: legacyNames?.story.ru || text(value.story_name_ru) || null,
    story_name_en: legacyNames?.story.en || text(value.story_name_en) || null,
    story_name_tr: legacyNames?.story.tr || text(value.story_name_tr) || null,
    dictionary_id: scope.dictionaryId || null,
    dictionary_name_ru: legacyNames?.dictionary.ru || text(value.dictionary_name_ru) || null,
    dictionary_name_en: legacyNames?.dictionary.en || text(value.dictionary_name_en) || null,
    dictionary_name_tr: legacyNames?.dictionary.tr || text(value.dictionary_name_tr) || null,
    section_id: scope.sectionId || null,
    section_name_ru: legacyNames?.section.ru || text(value.section_name_ru) || null,
    section_name_en: legacyNames?.section.en || text(value.section_name_en) || null,
    section_name_tr: legacyNames?.section.tr || text(value.section_name_tr) || null,
    set_id: scope.setId || null,
    set_name_ru: text(value.set_name_ru) || legacyNames?.set.ru || null,
    set_name_en: text(value.set_name_en) || legacyNames?.set.en || null,
    set_name_tr: text(value.set_name_tr) || legacyNames?.set.tr || null,
    global_order: Number.isFinite(Number(value.global_order)) ? Number(value.global_order) : null,
  } as MobileWord;
  if (!word.word_id || !word.story_id || !word.dictionary_id || !word.section_id) return null;
  if (!word.set_id) return null;
  return word;
}

function validateWords(values: unknown): MobileWord[] {
  if (!Array.isArray(values)) return [];
  const ids = new Set<string>();
  return values.map((value) => normalizeWord((value ?? {}) as Record<string, unknown>)).filter((word): word is MobileWord => {
    if (!word || ids.has(word.word_id)) return false;
    ids.add(word.word_id);
    return Boolean(word.word_alan_cyrillic || word.word_alan_turkic) && Boolean(word.translation_ru);
  }).sort((left, right) => Number(left.global_order || 0) - Number(right.global_order || 0));
}

function starterWords() {
  return validateWords(STARTER_DICTIONARY as unknown[]);
}

async function readLocalDictionary() {
  try {
    const raw = await AsyncStorage.getItem(DICTIONARY_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) as DictionaryCache : null;
    const words = validateWords(parsed?.words);
    if (parsed?.version && words.length) return { version: text(parsed.version), words };
  } catch {
    // Corrupt cache is ignored; bundled starter remains available.
  }
  return { version: STARTER_DICTIONARY_VERSION, words: starterWords() };
}

function notify() {
  listeners.forEach((listener) => listener());
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(operation: () => Promise<T>) {
  let lastError: unknown;
  for (const wait of RETRY_DELAYS) {
    if (wait) await delay(wait);
    try { return await operation(); } catch (error) { lastError = error; }
  }
  throw lastError;
}

async function latestDictionaryVersion() {
  const { data, error } = await supabase.from('dictionary_metadata').select('current_version').eq('dictionary_key', 'main').maybeSingle();
  if (error) throw error;
  const version = text(data?.current_version);
  if (!version) throw new Error('Dictionary version is missing.');
  return version;
}

export async function getDictionaryStatus({ checkRemote = true } = {}): Promise<DictionaryStatus> {
  if (!installedVersion || !wordsCache?.length) {
    const local = await readLocalDictionary();
    installedVersion = local.version;
    wordsCache = local.words;
  }
  if (!checkRemote) {
    return { installedVersion, latestVersion: null, updateAvailable: false, remoteAvailable: false };
  }
  try {
    const latestVersion = await latestDictionaryVersion();
    return {
      installedVersion,
      latestVersion,
      updateAvailable: Boolean(latestVersion && latestVersion !== installedVersion),
      remoteAvailable: true,
    };
  } catch {
    return { installedVersion, latestVersion: null, updateAvailable: false, remoteAvailable: false };
  }
}

async function downloadWords() {
  const rows: MobileWord[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from('v_words_app').select('*').order('global_order', { ascending: true }).range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...validateWords(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) break;
  }
  const result = validateWords(rows);
  if (!result.length) throw new Error('Dictionary is empty.');
  return result;
}

export async function refreshDictionary({ force = false } = {}) {
  const version = await latestDictionaryVersion();
  if (!force && version === installedVersion && wordsCache?.length) return { version, words: wordsCache, changed: false };
  const words = await downloadWords();
  await AsyncStorage.setItem(DICTIONARY_CACHE_KEY, JSON.stringify({ version, words, saved_at: new Date().toISOString() }));
  installedVersion = version;
  wordsCache = words;
  notify();
  return { version, words, changed: true };
}

function scheduleRefresh() {
  if (backgroundRefresh) return;
  backgroundRefresh = withRetry(() => refreshDictionary()).catch(() => null).finally(() => { backgroundRefresh = null; });
}

export function displayedAlanWord(word: MobileWord, settings: UserSettings) {
  if (settings.alan_script_code === 'turkic') return text(word.word_alan_turkic);
  const source = text(word.word_alan_cyrillic);
  if (settings.alan_dialect_code === 'balkar') return source.replaceAll('Җ', 'Ж').replaceAll('җ', 'ж');
  if (settings.alan_dialect_code === 'karachay') return source.replaceAll('Җ', 'Дж').replaceAll('җ', 'дж');
  return source;
}

export function displayedTranslation(word: MobileWord, settings: UserSettings) {
  const language = settings.translation_language_code;
  if (language === 'en') return text(word.translation_en) || text(word.translation_ru);
  if (language === 'tr') return text(word.translation_tr) || text(word.translation_ru);
  return text(word.translation_ru);
}

export function displayedExamples(word: MobileWord, settings: UserSettings) {
  const alanSource = settings.alan_script_code === 'turkic' ? word.phrases_alan_turkic : word.phrases_alan_cyrillic;
  const translationSource = settings.translation_language_code === 'en' ? word.phrases_en : settings.translation_language_code === 'tr' ? word.phrases_tr : word.phrases_ru;
  const list = (value: unknown) => Array.isArray(value) ? value.map(text).filter(Boolean) : text(value).split(/\n+/).map(text).filter(Boolean);
  const alan = list(alanSource);
  const translations = list(translationSource);
  return alan.map((example, index) => ({ example, translation: translations[index] || '' }));
}

export function displayedStructureName(word: MobileWord, kind: 'story_name' | 'dictionary_name' | 'section_name' | 'set_name', settings: UserSettings) {
  return localized(word as unknown as Record<string, unknown>, kind, settings.interface_language_code);
}

export function displayedStoryCopy(row: StoryCopyRow | undefined, settings: UserSettings) {
  if (!row) return { name: '', intro: '' };
  const record = row as unknown as Record<string, unknown>;
  return { name: localized(record, 'name', settings.interface_language_code), intro: localized(record, 'intro', settings.interface_language_code) };
}

export async function loadAllWords({ force = false } = {}): Promise<MobileWord[]> {
  if (force) return (await refreshDictionary({ force: true })).words;
  if (wordsCache) return wordsCache;
  const local = await readLocalDictionary();
  wordsCache = local.words;
  installedVersion = local.version;
  scheduleRefresh();
  return wordsCache;
}

export async function loadStoryCopy({ force = false } = {}): Promise<StoryCopyRow[]> {
  if (storyCopyCache && !force) return storyCopyCache;
  if (!force) {
    try {
      const raw = await AsyncStorage.getItem(STORY_CACHE_KEY);
      const cached = raw ? JSON.parse(raw) : [];
      if (Array.isArray(cached) && cached.length) {
        storyCopyCache = cached as StoryCopyRow[];
        void loadStoryCopy({ force: true }).catch(() => undefined);
        return storyCopyCache;
      }
    } catch { /* Fall through to network. */ }
  }
  const { data, error } = await supabase.from('content_structure').select('*').eq('entity_type', 'story');
  if (error) return storyCopyCache ?? [];
  storyCopyCache = (data ?? []) as StoryCopyRow[];
  await AsyncStorage.setItem(STORY_CACHE_KEY, JSON.stringify(storyCopyCache));
  return storyCopyCache;
}

export function getInstalledDictionaryVersion() {
  return installedVersion || STARTER_DICTIONARY_VERSION;
}

export async function getDictionaryVersionStatus() {
  const latestVersion = await latestDictionaryVersion();
  const currentVersion = getInstalledDictionaryVersion();
  return { currentVersion, latestVersion, needsUpdate: currentVersion !== latestVersion };
}

export function subscribeDictionary(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function clearDictionaryCache() {
  wordsCache = null;
  storyCopyCache = null;
  installedVersion = '';
}
