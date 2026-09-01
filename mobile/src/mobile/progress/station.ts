import { readScopedJson, STORAGE_KEYS, writeScopedJson } from '@/src/mobile/storage';
import { enqueueSync } from '@/src/mobile/sync';

const DAY_MS = 24 * 60 * 60 * 1000;
export const REQUIRED_ACCURACY = 80;

export type StationDescriptor = {
  storyId: string;
  dictionaryId: string;
  sectionId: string;
  setId: string;
};

export type StationProgress = {
  dictionary_id: string;
  catalog_id: string;
  group_id: string;
  set_id: string;
  story_type: string;
  status: string;
  current_phase: string;
  study_sessions_total: number;
  test_attempts_total: number;
  best_accuracy: number;
  first_test_completed_at: string | null;
  review_1_due_at: string | null;
  review_1_completed_at: string | null;
  review_2_due_at: string | null;
  review_2_completed_at: string | null;
  mastered_at: string | null;
  updated_at: string;
};

function key(station: StationDescriptor) {
  return [station.storyId, station.dictionaryId, station.sectionId, station.setId].join('::');
}

function nowIso() { return new Date().toISOString(); }
function asTime(value?: string | null) { return Date.parse(value || '') || 0; }

function empty(station: StationDescriptor): StationProgress {
  return {
    dictionary_id: station.dictionaryId,
    catalog_id: station.dictionaryId,
    group_id: station.sectionId,
    set_id: station.setId,
    story_type: station.storyId,
    status: 'available',
    current_phase: 'study',
    study_sessions_total: 0,
    test_attempts_total: 0,
    best_accuracy: 0,
    first_test_completed_at: null,
    review_1_due_at: null,
    review_1_completed_at: null,
    review_2_due_at: null,
    review_2_completed_at: null,
    mastered_at: null,
    updated_at: nowIso(),
  };
}

async function localRows(userId?: string | null) {
  const raw = await readScopedJson<unknown>(STORAGE_KEYS.stationProgress, [], userId);
  if (Array.isArray(raw)) return raw as StationProgress[];
  return Object.values((raw ?? {}) as Record<string, StationProgress>);
}

export async function getStationProgress(station: StationDescriptor, userId?: string | null): Promise<StationProgress> {
  const row = (await localRows(userId)).find((entry) => key(station) === [entry.story_type, entry.dictionary_id, entry.group_id, entry.set_id].join('::'));
  return row ? { ...empty(station), ...row } : empty(station);
}

async function save(station: StationDescriptor, userId: string | null | undefined, row: StationProgress) {
  const rows = await localRows(userId);
  const stationKey = key(station);
  await writeScopedJson(STORAGE_KEYS.stationProgress, [
    ...rows.filter((entry) => [entry.story_type, entry.dictionary_id, entry.group_id, entry.set_id].join('::') !== stationKey),
    row,
  ], userId);
  await enqueueSync('station_progress', row as unknown as Record<string, unknown>, userId, { entryId: `station_progress:${stationKey}` });
  return row;
}

export async function markStationStarted(station: StationDescriptor, userId?: string | null) {
  const current = await getStationProgress(station, userId);
  if (['mastered', 'test_ready'].includes(current.status)) return current;
  return save(station, userId, { ...current, status: 'studying', current_phase: 'study', study_sessions_total: current.study_sessions_total + 1, updated_at: nowIso() });
}

export async function markStationCardsCompleted(station: StationDescriptor, userId?: string | null) {
  const current = await getStationProgress(station, userId);
  if (current.status === 'mastered') return current;
  return save(station, userId, { ...current, status: 'test_ready', current_phase: 'first_test', updated_at: nowIso() });
}

export async function stationTestPhase(station: StationDescriptor, userId?: string | null) {
  const current = await getStationProgress(station, userId);
  const now = Date.now();
  if (current.first_test_completed_at && !current.review_1_completed_at && asTime(current.review_1_due_at) > 0 && asTime(current.review_1_due_at) <= now) return 'review_1';
  if (current.review_1_completed_at && !current.review_2_completed_at && asTime(current.review_2_due_at) > 0 && asTime(current.review_2_due_at) <= now) return 'review_2';
  if (current.status === 'mastered') return 'practice';
  return 'first_test';
}

export async function recordStationTest(station: StationDescriptor, userId: string | null | undefined, accuracy: number, passed: boolean, phase: string, completedAt: string) {
  const current = await getStationProgress(station, userId);
  const next: StationProgress = {
    ...current,
    test_attempts_total: current.test_attempts_total + 1,
    best_accuracy: Math.max(current.best_accuracy, accuracy),
    updated_at: completedAt,
  };
  if (!passed || phase === 'practice') return save(station, userId, next);
  if (phase === 'first_test') {
    next.status = 'mastered';
    next.current_phase = 'review_1';
    next.first_test_completed_at = completedAt;
    next.mastered_at = next.mastered_at ?? completedAt;
    next.review_1_due_at = new Date(Date.parse(completedAt) + DAY_MS).toISOString();
  } else if (phase === 'review_1') {
    next.status = 'mastered';
    next.current_phase = 'review_2';
    next.review_1_completed_at = completedAt;
    next.review_2_due_at = new Date(Date.parse(completedAt) + 3 * DAY_MS).toISOString();
  } else if (phase === 'review_2') {
    next.status = 'mastered';
    next.current_phase = 'mastered';
    next.review_2_completed_at = completedAt;
    next.mastered_at = next.mastered_at ?? completedAt;
  }
  return save(station, userId, next);
}
