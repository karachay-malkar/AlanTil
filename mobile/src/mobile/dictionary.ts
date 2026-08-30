import { supabase } from '@/src/lib/supabase';
import type { UserSettings } from '@/src/mobile/settings';

const PAGE_SIZE = 1000;

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

let wordsCache: MobileWord[] | null = null;
let storyCopyCache: StoryCopyRow[] | null = null;

function text(value: unknown) {
  return String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
}

function localized(row: Record<string, unknown>, base: string, language: UserSettings['interface_language_code']) {
  if (language === 'en') return text(row[`${base}_en`]);
  if (language === 'tr') return text(row[`${base}_tr`]);
  return text(row[`${base}_ru`]);
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
  if (language === 'en') return text(word.translation_en);
  if (language === 'tr') return text(word.translation_tr);
  return text(word.translation_ru);
}

export function displayedStructureName(
  word: MobileWord,
  kind: 'story_name' | 'dictionary_name' | 'section_name' | 'set_name',
  settings: UserSettings,
) {
  return localized(word as unknown as Record<string, unknown>, kind, settings.interface_language_code);
}

export function displayedStoryCopy(row: StoryCopyRow | undefined, settings: UserSettings) {
  if (!row) return { name: '', intro: '' };
  const record = row as unknown as Record<string, unknown>;
  return {
    name: localized(record, 'name', settings.interface_language_code),
    intro: localized(record, 'intro', settings.interface_language_code),
  };
}

export async function loadAllWords({ force = false } = {}): Promise<MobileWord[]> {
  if (wordsCache && !force) return wordsCache;
  const rows: MobileWord[] = [];
  const select = [
    'word_id', 'global_order',
    'story_id', 'story_name_ru', 'story_name_en', 'story_name_tr',
    'dictionary_id', 'dictionary_name_ru', 'dictionary_name_en', 'dictionary_name_tr',
    'section_id', 'section_name_ru', 'section_name_en', 'section_name_tr',
    'set_id', 'set_name_ru', 'set_name_en', 'set_name_tr',
    'pos', 'synonyms', 'word_alan_cyrillic', 'word_alan_turkic',
    'translation_ru', 'translation_en', 'translation_tr',
  ].join(',');

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('v_words_app')
      .select(select)
      .order('global_order', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as MobileWord[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  wordsCache = rows.filter((word) => word.word_id && word.story_id && word.dictionary_id && word.section_id && word.set_id);
  return wordsCache;
}

export async function loadStoryCopy({ force = false } = {}): Promise<StoryCopyRow[]> {
  if (storyCopyCache && !force) return storyCopyCache;
  const { data, error } = await supabase
    .from('content_structure')
    .select('*')
    .eq('entity_type', 'story');
  if (error) throw error;
  storyCopyCache = (data ?? []) as StoryCopyRow[];
  return storyCopyCache;
}

export function clearDictionaryCache() {
  wordsCache = null;
  storyCopyCache = null;
}
