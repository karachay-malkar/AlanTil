import { readScopedJson, STORAGE_KEYS, updateScopedJson } from '@/src/mobile/storage';
import { enqueueSync } from '@/src/mobile/sync';

export type LearningDirection = 'alan_ru' | 'ru_alan';

function key(dictionaryId: string, sectionId: string, setId: string) {
  return [dictionaryId, sectionId, setId].join('::');
}

export async function loadStationSelection(wordIds: string[], dictionaryId: string, sectionId: string, setId: string, userId?: string | null) {
  const map = await readScopedJson<Record<string, string[]>>(STORAGE_KEYS.hiddenWords, {}, userId);
  const hidden = new Set(map[key(dictionaryId, sectionId, setId)] ?? []);
  return new Set(wordIds.filter((wordId) => !hidden.has(wordId)));
}

export async function saveStationSelection(
  selected: Set<string>,
  wordIds: string[],
  dictionaryId: string,
  sectionId: string,
  setId: string,
  userId?: string | null,
) {
  const stationKey = key(dictionaryId, sectionId, setId);
  const changes: { wordId: string; isHidden: boolean }[] = [];
  await updateScopedJson<Record<string, string[]>>(STORAGE_KEYS.hiddenWords, {}, (current) => {
    const before = new Set(current[stationKey] ?? []);
    const hidden = wordIds.filter((wordId) => !selected.has(wordId));
    const hiddenSet = new Set(hidden);
    wordIds.forEach((wordId) => {
      const isHidden = hiddenSet.has(wordId);
      if (before.has(wordId) !== isHidden) changes.push({ wordId, isHidden });
    });
    return { ...current, [stationKey]: hidden };
  }, userId);
  for (const { wordId, isHidden } of changes) {
    await enqueueSync('hidden_word', {
      dictionary_id: dictionaryId,
      section_id: sectionId,
      set_id: setId,
      word_id: wordId,
      is_hidden: isHidden,
      updated_at: new Date().toISOString(),
    }, userId, { entryId: `hidden_word:${stationKey}:${wordId}` });
  }
}

export async function loadStationDirection(userId?: string | null): Promise<LearningDirection> {
  const settings = await readScopedJson<Record<string, unknown>>(STORAGE_KEYS.routeSettings, {}, userId);
  return settings.learning_direction === 'ru_alan' ? 'ru_alan' : 'alan_ru';
}

export async function saveStationDirection(direction: LearningDirection, userId?: string | null) {
  await updateScopedJson<Record<string, unknown>>(STORAGE_KEYS.routeSettings, {}, (settings) => ({
    ...settings,
    learning_direction: direction,
    updated_at: new Date().toISOString(),
  }), userId);
}
