import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/src/lib/supabase';
import { GUEST_STATION_PROGRESS_KEY } from '@/src/mobile/progress/guest';

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
function effectiveStatus(row?: Partial<StationProgress> | null) {
  const status = String(row?.status || 'available');
  const now = Date.now();
  if (status === 'review_1_waiting' && asTime(row?.review_1_due_at) <= now) return 'review_1_due';
  if (status === 'review_2_waiting' && asTime(row?.review_2_due_at) <= now) return 'review_2_due';
  return status;
}

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

async function guestMap() {
  const raw = await AsyncStorage.getItem(GUEST_STATION_PROGRESS_KEY);
  if (!raw) return {} as Record<string, StationProgress>;
  try { return JSON.parse(raw) as Record<string, StationProgress>; } catch { return {}; }
}

async function saveGuest(station: StationDescriptor, row: StationProgress) {
  const map = await guestMap();
  map[key(station)] = row;
  await AsyncStorage.setItem(GUEST_STATION_PROGRESS_KEY, JSON.stringify(map));
  return row;
}

export async function getStationProgress(station: StationDescriptor, userId?: string | null): Promise<StationProgress> {
  if (!userId) {
    const map = await guestMap();
    const row = map[key(station)] ?? empty(station);
    return { ...row, status: effectiveStatus(row) };
  }
  const { data, error } = await supabase.from('user_station_progress').select('*')
    .eq('user_id', userId).eq('dictionary_id', station.dictionaryId).eq('catalog_id', station.dictionaryId)
    .eq('group_id', station.sectionId).eq('set_id', station.setId).maybeSingle();
  if (error) throw error;
  const row = data ? { ...empty(station), ...data } as StationProgress : empty(station);
  return { ...row, status: effectiveStatus(row) };
}

async function saveCloud(station: StationDescriptor, userId: string, row: StationProgress) {
  const { error } = await supabase.from('user_station_progress').upsert({ user_id: userId, ...row }, {
    onConflict: 'user_id,dictionary_id,catalog_id,group_id,set_id',
  });
  if (error) throw error;
  return row;
}

async function save(station: StationDescriptor, userId: string | null | undefined, row: StationProgress) {
  return userId ? saveCloud(station, userId, row) : saveGuest(station, row);
}

export async function markStationStarted(station: StationDescriptor, userId?: string | null) {
  const current = await getStationProgress(station, userId);
  if (['mastered','review_1_waiting','review_1_due','review_2_waiting','review_2_due','test_ready'].includes(current.status)) return current;
  return save(station, userId, { ...current, status: 'studying', current_phase: 'study', study_sessions_total: current.study_sessions_total + 1, updated_at: nowIso() });
}

export async function markStationCardsCompleted(station: StationDescriptor, userId?: string | null) {
  const current = await getStationProgress(station, userId);
  if (current.status === 'mastered') return current;
  return save(station, userId, { ...current, status: 'test_ready', current_phase: 'first_test', updated_at: nowIso() });
}

export async function stationTestPhase(station: StationDescriptor, userId?: string | null) {
  const current = await getStationProgress(station, userId);
  if (current.status === 'review_1_due') return 'review_1';
  if (current.status === 'review_2_due') return 'review_2';
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
    next.status = 'review_1_waiting'; next.current_phase = 'review_1'; next.first_test_completed_at = completedAt;
    next.review_1_due_at = new Date(Date.parse(completedAt) + DAY_MS).toISOString();
  } else if (phase === 'review_1') {
    next.status = 'review_2_waiting'; next.current_phase = 'review_2'; next.review_1_completed_at = completedAt;
    next.review_2_due_at = new Date(Date.parse(completedAt) + 3 * DAY_MS).toISOString();
  } else if (phase === 'review_2') {
    next.status = 'mastered'; next.current_phase = 'mastered'; next.review_2_completed_at = completedAt; next.mastered_at = completedAt;
  }
  return save(station, userId, next);
}
