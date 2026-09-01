import type { UserSettings } from '@/src/mobile/settings';
import type { AdminWordRow } from '@/src/mobile/profile/admin-repository';

export const ADMIN_STORY_ORDER = ['oblivion', 'roots', 'ascent', 'pathways'] as const;

function text(value: unknown) {
  return String(value ?? '').normalize('NFC').trim();
}

export function adminAlanWord(row: AdminWordRow, settings: UserSettings, prefix: '' | 'wrong_' = '') {
  if (settings.alan_script_code === 'turkic') return text(row[`${prefix}word_alan_turkic` as keyof AdminWordRow]) || text(row[`${prefix}word_alan_cyrillic` as keyof AdminWordRow]);
  const source = text(row[`${prefix}word_alan_cyrillic` as keyof AdminWordRow]) || text(row[`${prefix}word_alan_turkic` as keyof AdminWordRow]);
  if (settings.alan_dialect_code === 'karachay') return source.replaceAll('Җ', 'Дж').replaceAll('җ', 'дж');
  if (settings.alan_dialect_code === 'balkar') return source.replaceAll('Җ', 'Ж').replaceAll('җ', 'ж');
  return source;
}

export function adminTranslation(row: AdminWordRow, settings: UserSettings, prefix: '' | 'wrong_' = '') {
  const language = settings.interface_language_code;
  return text(row[`${prefix}translation_${language}` as keyof AdminWordRow])
    || text(row[`${prefix}translation_ru` as keyof AdminWordRow])
    || text(row[`${prefix}translation_en` as keyof AdminWordRow])
    || text(row[`${prefix}translation_tr` as keyof AdminWordRow]);
}

export function boundedProgress(passed: unknown, total: unknown) {
  const safePassed = Math.max(0, Number(passed) || 0);
  const safeTotal = Math.max(0, Number(total) || 0);
  return { passed: safePassed, total: safeTotal, percent: safeTotal ? Math.min(100, Math.round((safePassed / safeTotal) * 100)) : 0 };
}
