import { loadLocalWordProgress, type WordProgress } from '@/src/mobile/progress/guest';
import { readScopedJson, STORAGE_KEYS, writeScopedJson } from '@/src/mobile/storage';
import { enqueueSync } from '@/src/mobile/sync';

export async function loadWordProgress(userId?: string | null): Promise<WordProgress[]> {
  return loadLocalWordProgress(userId);
}

export async function loadSetProgress(userId?: string | null) {
  return readScopedJson<Record<string, unknown>[]>(STORAGE_KEYS.setProgress, [], userId);
}

export async function loadStationProgress(userId?: string | null) {
  return readScopedJson<Record<string, unknown>[]>(STORAGE_KEYS.stationProgress, [], userId);
}

function setKey(row: Record<string, unknown>) {
  return [row.dictionary_id, row.section_id, row.set_id].map((value) => String(value ?? '')).join('::');
}

async function saveSetRow(userId: string | null | undefined, row: Record<string, unknown>) {
  const rows = await loadSetProgress(userId);
  const key = setKey(row);
  const next = [...rows.filter((current) => setKey(current) !== key), row];
  await writeScopedJson(STORAGE_KEYS.setProgress, next, userId);
  await enqueueSync('set_progress', row, userId, { entryId: `set_progress:${key}` });
  return row;
}

export async function markSetStarted(userId: string | null | undefined, dictionaryId: string, sectionId: string, setId: string) {
  const now = new Date().toISOString();
  const current = (await loadSetProgress(userId)).find((row) => setKey(row) === [dictionaryId, sectionId, setId].join('::'));
  return saveSetRow(userId, {
    dictionary_id: dictionaryId,
    section_id: sectionId,
    set_id: setId,
    launches_total: Number(current?.launches_total || 0) + 1,
    completed_total: Number(current?.completed_total || 0),
    is_finished: Boolean(current?.is_finished),
    last_started_at: now,
    last_completed_at: current?.last_completed_at ?? null,
    updated_at: now,
  });
}

export async function markSetCompleted(userId: string | null | undefined, dictionaryId: string, sectionId: string, setId: string) {
  const now = new Date().toISOString();
  const current = (await loadSetProgress(userId)).find((row) => setKey(row) === [dictionaryId, sectionId, setId].join('::'));
  return saveSetRow(userId, {
    dictionary_id: dictionaryId,
    section_id: sectionId,
    set_id: setId,
    launches_total: Math.max(1, Number(current?.launches_total || 0)),
    completed_total: Number(current?.completed_total || 0) + 1,
    is_finished: true,
    last_started_at: current?.last_started_at ?? now,
    last_completed_at: now,
    updated_at: now,
  });
}
