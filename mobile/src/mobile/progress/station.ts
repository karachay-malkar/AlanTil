import { readScopedJson, STORAGE_KEYS, writeScopedJson } from '@/src/mobile/storage';
import { enqueueSync } from '@/src/mobile/sync';
import {
  canonicalStationStatus,
  createStationProgressRow,
  markStationCardsCompletedProgress,
  markStationStartedProgress,
  normalizeStationLifecycle,
  recordStationTestProgress,
  stationTestPhaseFromProgress,
} from '../../../../packages/alantil-core/progress.js';
import { CORE_PATH_CONFIG } from '../../../../packages/alantil-core/path-config.js';

export const REQUIRED_ACCURACY = CORE_PATH_CONFIG.stationRequiredAccuracy;

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

function fallback(station: StationDescriptor) {
  return {
    storyId: station.storyId,
    dictionaryId: station.dictionaryId,
    sectionId: station.sectionId,
    setId: station.setId,
  };
}

function empty(station: StationDescriptor): StationProgress {
  return createStationProgressRow(fallback(station)) as StationProgress;
}

function normalize(row: Partial<StationProgress> | null | undefined, station: StationDescriptor): StationProgress {
  return normalizeStationLifecycle(row ?? {}, fallback(station)) as StationProgress;
}

async function localRows(userId?: string | null) {
  const raw = await readScopedJson<unknown>(STORAGE_KEYS.stationProgress, [], userId);
  if (Array.isArray(raw)) return raw as StationProgress[];
  return Object.values((raw ?? {}) as Record<string, StationProgress>);
}

export async function getStationProgress(station: StationDescriptor, userId?: string | null): Promise<StationProgress> {
  const row = (await localRows(userId)).find((entry) => key(station) === [entry.story_type, entry.dictionary_id, entry.group_id, entry.set_id].join('::'));
  return row ? normalize(row, station) : empty(station);
}

export async function getCanonicalStationStatus(station: StationDescriptor, userId?: string | null) {
  return canonicalStationStatus(await getStationProgress(station, userId));
}

async function save(station: StationDescriptor, userId: string | null | undefined, row: StationProgress) {
  const rows = await localRows(userId);
  const stationKey = key(station);
  const normalized = normalize(row, station);
  await writeScopedJson(STORAGE_KEYS.stationProgress, [
    ...rows.filter((entry) => [entry.story_type, entry.dictionary_id, entry.group_id, entry.set_id].join('::') !== stationKey),
    normalized,
  ], userId);
  await enqueueSync('station_progress', normalized as unknown as Record<string, unknown>, userId, { entryId: `station_progress:${stationKey}` });
  return normalized;
}

export async function markStationStarted(station: StationDescriptor, userId?: string | null) {
  const current = await getStationProgress(station, userId);
  return save(station, userId, markStationStartedProgress(current) as StationProgress);
}

export async function markStationCardsCompleted(station: StationDescriptor, userId?: string | null) {
  const current = await getStationProgress(station, userId);
  return save(station, userId, markStationCardsCompletedProgress(current) as StationProgress);
}

export async function stationTestPhase(station: StationDescriptor, userId?: string | null) {
  return stationTestPhaseFromProgress(await getStationProgress(station, userId));
}

export async function recordStationTest(
  station: StationDescriptor,
  userId: string | null | undefined,
  accuracy: number,
  passed: boolean,
  phase: string,
  completedAt: string,
) {
  const current = await getStationProgress(station, userId);
  const next = recordStationTestProgress(current, {
    accuracy,
    passed,
    phase,
    completedAt,
  }) as StationProgress;
  return save(station, userId, next);
}
