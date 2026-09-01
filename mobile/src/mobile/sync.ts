import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/src/lib/supabase';
import {
  clearScopedValues,
  migrateLegacyValue,
  readScopedJson,
  storageScope,
  STORAGE_KEYS,
  writeScopedJson,
} from '@/src/mobile/storage';
import {
  entryRevision,
  mergeLatestRows,
  mergeWordProgressRows,
  nextReadyEntry,
  normalizedId,
  preferredSettingsSource,
  remoteSupersedes,
  retryDelayMs,
  timestamp,
  type ProgressRow,
} from '@/src/mobile/sync-policy';

export type SyncOperation =
  | 'learn_session'
  | 'match_session'
  | 'hidden_word'
  | 'set_progress'
  | 'song_favorite'
  | 'station_progress'
  | 'station_test_session'
  | 'test_session'
  | 'user_settings'
  | 'word_favorite'
  | 'word_progress_snapshot';

export type SyncEntry = {
  id: string;
  type: SyncOperation;
  payload: Record<string, unknown>;
  created_at: string;
  attempts: number;
  revision?: string;
  claim_id?: string;
  last_error_at?: string;
  next_attempt_at?: string;
};

const LEGACY_ACTIVITY_PREFIX = 'alantil_mobile_activity_history_v14_1_6:guest:';
const LEGACY_ACTIVE_PREFIX = 'alantil_mobile_activity_v14_1_6';
const CLAIM_KEYS = [
  STORAGE_KEYS.activityHistory,
  STORAGE_KEYS.hiddenWords,
  STORAGE_KEYS.progressQueue,
  STORAGE_KEYS.setProgress,
  STORAGE_KEYS.songFavorites,
  STORAGE_KEYS.stationProgress,
  STORAGE_KEYS.userSettings,
  STORAGE_KEYS.wordFavorites,
  STORAGE_KEYS.wordProgress,
] as const;

const flushes = new Map<string, Promise<boolean>>();
const queueTails = new Map<string, Promise<void>>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
let bound = false;
let currentUserId = '';
let guestMigration: Promise<void> | null = null;

function nowIso() {
  return new Date().toISOString();
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function queueId(type: SyncOperation, payload: Record<string, unknown>) {
  const stable = payload.id || payload.session_id || [
    payload.dictionary_id,
    payload.section_id,
    payload.set_id,
    payload.word_id,
    payload.song_id,
  ].filter(Boolean).join(':');
  return `${type}:${normalizedId(stable) || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function revisionId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function stationKey(row: Record<string, unknown>) {
  return [row.dictionary_id, row.catalog_id, row.group_id, row.set_id].map(normalizedId).join('::');
}

function setKey(row: Record<string, unknown>) {
  return [row.dictionary_id, row.section_id, row.set_id].map(normalizedId).join('::');
}

async function withQueueLock<T>(userId: string | null | undefined, operation: () => Promise<T>) {
  const scope = storageScope(userId);
  const previous = queueTails.get(scope) ?? Promise.resolve();
  const result = previous.catch(() => undefined).then(operation);
  const tail = result.then(() => undefined, () => undefined);
  queueTails.set(scope, tail);
  try {
    return await result;
  } finally {
    if (queueTails.get(scope) === tail) queueTails.delete(scope);
  }
}

async function readQueueUnsafe(userId?: string | null): Promise<SyncEntry[]> {
  return asArray<SyncEntry>(await readScopedJson(STORAGE_KEYS.progressQueue, [], userId))
    .filter((entry) => entry?.id && entry?.type)
    .map((entry): SyncEntry => ({ ...entry, revision: entry.revision || `${entry.created_at}:${entry.id}` }));
}

async function readQueue(userId?: string | null) {
  return withQueueLock(userId, () => readQueueUnsafe(userId));
}

async function writeQueueUnsafe(entries: SyncEntry[], userId?: string | null) {
  await writeScopedJson(STORAGE_KEYS.progressQueue, entries, userId);
}

export async function enqueueSync(
  type: SyncOperation,
  payload: Record<string, unknown>,
  userId?: string | null,
  options: { entryId?: string; replace?: boolean; claimId?: string } = {},
) {
  const entryId = options.entryId || queueId(type, payload);
  const entry: SyncEntry = {
    id: entryId,
    type,
    payload,
    created_at: nowIso(),
    attempts: 0,
    revision: revisionId(),
    ...(options.claimId ? { claim_id: options.claimId } : {}),
  };
  await withQueueLock(userId, async () => {
    const queue = await readQueueUnsafe(userId);
    const index = queue.findIndex((item) => item.id === entryId);
    if (index >= 0 && options.replace !== false) queue[index] = { ...queue[index], ...entry, created_at: queue[index].created_at };
    else if (index < 0) queue.push(entry);
    await writeQueueUnsafe(queue, userId);
  });
  if (userId) void flushSyncQueue(userId);
  return entry;
}

async function execute(entry: SyncEntry, userId: string) {
  const payload = entry.payload;
  if (entry.type === 'learn_session') return supabase.rpc('save_learn_session', { payload });
  if (entry.type === 'test_session') return supabase.rpc('save_test_session', { payload });
  if (entry.type === 'match_session') return supabase.rpc('save_match_session', { payload });
  if (entry.type === 'station_test_session') return supabase.rpc('save_station_test_session', { payload });
  if (entry.type === 'word_progress_snapshot') return supabase.rpc('merge_word_progress_snapshot', { payload });
  if (entry.type === 'word_favorite') return supabase.from('user_word_favorites').upsert({ user_id: userId, ...payload }, { onConflict: 'user_id,word_id' });
  if (entry.type === 'song_favorite') return supabase.from('user_song_favorites').upsert({ user_id: userId, ...payload }, { onConflict: 'user_id,song_id' });
  if (entry.type === 'hidden_word') return supabase.from('user_hidden_words').upsert({ user_id: userId, ...payload }, { onConflict: 'user_id,dictionary_id,section_id,set_id,word_id' });
  if (entry.type === 'set_progress') return supabase.from('user_set_progress').upsert({ user_id: userId, ...payload }, { onConflict: 'user_id,dictionary_id,section_id,set_id' });
  if (entry.type === 'station_progress') return supabase.from('user_station_progress').upsert({ user_id: userId, ...payload }, { onConflict: 'user_id,dictionary_id,catalog_id,group_id,set_id' });
  if (entry.type === 'user_settings') {
    const cloud = {
      user_id: userId,
      interface_language_code: payload.interface_language_code,
      translation_language_code: payload.translation_language_code,
      alan_script_code: payload.alan_script_code,
      alan_dialect_code: payload.alan_dialect_code,
      learning_setup_completed_at: payload.learning_setup_completed_at,
      updated_at: payload.updated_at,
    };
    const full = await supabase.from('user_settings').upsert(cloud, { onConflict: 'user_id' });
    if (!full.error) return full;
    if (!['PGRST204', '42703'].includes(normalizedId(full.error.code))) return full;
    const legacy = {
      user_id: userId,
      interface_language_code: payload.interface_language_code,
      translation_language_code: payload.translation_language_code,
      alan_script_code: payload.alan_script_code,
      alan_dialect_code: payload.alan_dialect_code,
      updated_at: payload.updated_at,
    };
    return supabase.from('user_settings').upsert(legacy, { onConflict: 'user_id' });
  }
  throw new Error(`Unsupported sync operation: ${entry.type}`);
}

async function finalizeGuestClaimIfReady(userId: string) {
  const marker = await readScopedJson<Record<string, unknown> | null>(STORAGE_KEYS.guestClaim, null, userId);
  if (!marker || marker.status !== 'pending') return;
  const pending = new Set((await readQueue(userId)).map((entry) => entry.id));
  if (asArray<string>(marker.entry_ids).some((entryId) => pending.has(entryId))) return;
  await clearScopedValues(CLAIM_KEYS, null);
  await writeScopedJson(STORAGE_KEYS.guestClaim, { ...marker, status: 'completed', completed_at: nowIso() }, userId);
}

async function scheduleNextFlush(userId: string) {
  const normalizedUserId = normalizedId(userId);
  if (!normalizedUserId || normalizedUserId !== currentUserId) return;
  const queue = await readQueue(normalizedUserId);
  const existing = retryTimers.get(normalizedUserId);
  if (existing) clearTimeout(existing);
  retryTimers.delete(normalizedUserId);
  if (!queue.length) return;
  const now = Date.now();
  const dueAt = Math.min(...queue.map((entry) => timestamp(entry.next_attempt_at) || now));
  const timer = setTimeout(() => {
    retryTimers.delete(normalizedUserId);
    void flushSyncQueue(normalizedUserId);
  }, Math.max(0, Math.min(15 * 60_000, dueAt - now)));
  retryTimers.set(normalizedUserId, timer);
}

export async function flushSyncQueue(userId: string, options: { force?: boolean } = {}) {
  const normalizedUserId = normalizedId(userId);
  if (!normalizedUserId || normalizedUserId !== currentUserId) return false;
  const existing = flushes.get(normalizedUserId);
  if (existing) return existing;
  const task = (async () => {
    let ok = true;
    const attempted = new Set<string>();
    while (currentUserId === normalizedUserId) {
      const entry = await withQueueLock(normalizedUserId, async () => nextReadyEntry(
        await readQueueUnsafe(normalizedUserId),
        attempted,
        Date.now(),
        options.force === true,
      ));
      if (!entry) break;
      const revision = entryRevision(entry);
      attempted.add(revision);
      let remove = false;
      try {
        const result = await execute(entry, normalizedUserId);
        if (result.error) throw result.error;
        remove = true;
      } catch (error) {
        const code = normalizedId((error as { code?: unknown })?.code);
        if (entry.type === 'word_favorite' && code === '23503') {
          remove = true;
        } else {
          ok = false;
        }
      }
      await withQueueLock(normalizedUserId, async () => {
        const queue = await readQueueUnsafe(normalizedUserId);
        const index = queue.findIndex((item) => item.id === entry.id);
        if (index < 0 || entryRevision(queue[index]) !== revision) return;
        if (remove) queue.splice(index, 1);
        else {
          const attempts = Math.max(0, Number(queue[index].attempts || 0)) + 1;
          queue[index] = {
            ...queue[index],
            attempts,
            last_error_at: nowIso(),
            next_attempt_at: new Date(Date.now() + retryDelayMs(attempts)).toISOString(),
          };
        }
        await writeQueueUnsafe(queue, normalizedUserId);
      });
    }
    await finalizeGuestClaimIfReady(normalizedUserId);
    return ok;
  })();
  const tracked = task.finally(() => {
    if (flushes.get(normalizedUserId) === tracked) flushes.delete(normalizedUserId);
    void scheduleNextFlush(normalizedUserId);
  });
  flushes.set(normalizedUserId, tracked);
  return tracked;
}

async function optionalRows(query: PromiseLike<{ data: unknown; error: { code?: string } | null }>) {
  const { data, error } = await query;
  if (!error) return data;
  if (['42P01', 'PGRST205', 'PGRST204'].includes(normalizedId(error.code))) return [];
  throw error;
}

async function optionalHistoryRows(query: PromiseLike<{ data: unknown; error: { code?: string } | null }>) {
  try {
    return asArray<Record<string, unknown>>(await optionalRows(query));
  } catch {
    return [];
  }
}

function cloudHistoryRows(rows: Record<string, unknown>[], type: 'learn' | 'test' | 'match' | 'station_test', relation: string) {
  return rows.map((row) => {
    const { [relation]: words, ...session } = row;
    return {
      ...session,
      type,
      words: asArray<Record<string, unknown>>(words),
    };
  });
}

async function pullCloudState(userId: string) {
  const [
    wordProgress,
    stationProgress,
    setProgress,
    wordFavorites,
    songFavorites,
    hiddenWords,
    settings,
    learnSessions,
    testSessions,
    matchSessions,
    stationTestSessions,
  ] = await Promise.all([
    optionalRows(supabase.from('user_word_progress').select('*').eq('user_id', userId)),
    optionalRows(supabase.from('user_station_progress').select('*').eq('user_id', userId)),
    optionalRows(supabase.from('user_set_progress').select('*').eq('user_id', userId)),
    optionalRows(supabase.from('user_word_favorites').select('word_id,is_active,updated_at').eq('user_id', userId)),
    optionalRows(supabase.from('user_song_favorites').select('song_id,is_active,updated_at').eq('user_id', userId)),
    optionalRows(supabase.from('user_hidden_words').select('dictionary_id,section_id,set_id,word_id,is_hidden,updated_at').eq('user_id', userId)),
    optionalRows(supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()),
    optionalHistoryRows(supabase.from('learn_sessions').select('id,dictionary_id,section_id,set_id,direction,translation_language_code,started_at,ended_at,duration_sec,active_duration_sec,status,exit_reason,words_planned,unique_words_shown,card_shows_total,left_swipes_total,known_words_total,unfinished_words_total,learn_session_words(word_id,show_count,left_swipe_count,final_result,first_position)').eq('user_id', userId).order('started_at', { ascending: false }).limit(100)),
    optionalHistoryRows(supabase.from('test_sessions').select('id,selected_sources,direction,translation_language_code,started_at,ended_at,duration_sec,active_duration_sec,status,exit_reason,questions_planned,questions_answered,correct_total,wrong_total,test_session_words(word_id,result,wrong_word_id)').eq('user_id', userId).order('started_at', { ascending: false }).limit(100)),
    optionalHistoryRows(supabase.from('match_sessions').select('id,selected_sources,translation_language_code,started_at,ended_at,duration_sec,active_duration_sec,status,exit_reason,pairs_planned,pairs_completed,errors_total,rounds_total,match_session_words(word_id,matched,error_count)').eq('user_id', userId).order('started_at', { ascending: false }).limit(100)),
    optionalHistoryRows(supabase.from('station_test_sessions').select('id,dictionary_id,catalog_id,group_id,set_id,story_type,phase,status,questions_total,correct_total,wrong_total,accuracy,started_at,ended_at,duration_sec,active_duration_sec,station_test_session_words(word_id,result,wrong_word_id)').eq('user_id', userId).order('started_at', { ascending: false }).limit(100)),
  ]);
  const activityHistory = [
    ...cloudHistoryRows(learnSessions, 'learn', 'learn_session_words'),
    ...cloudHistoryRows(testSessions, 'test', 'test_session_words'),
    ...cloudHistoryRows(matchSessions, 'match', 'match_session_words'),
    ...cloudHistoryRows(stationTestSessions, 'station_test', 'station_test_session_words'),
  ];
  return { wordProgress, stationProgress, setProgress, wordFavorites, songFavorites, hiddenWords, settings, activityHistory };
}

type CloudState = Awaited<ReturnType<typeof pullCloudState>>;

function indexRows(rows: unknown, keyFor: (row: Record<string, unknown>) => string) {
  return new Map(asArray<Record<string, unknown>>(rows).map((row) => [keyFor(row), row]));
}

function cloudIndexes(cloud: CloudState | null) {
  return {
    hiddenWords: indexRows(cloud?.hiddenWords, (row) => `${setKey(row)}::${normalizedId(row.word_id)}`),
    setProgress: indexRows(cloud?.setProgress, setKey),
    songFavorites: indexRows(cloud?.songFavorites, (row) => normalizedId(row.song_id)),
    stationProgress: indexRows(cloud?.stationProgress, stationKey),
    wordFavorites: indexRows(cloud?.wordFavorites, (row) => normalizedId(row.word_id)),
    settings: cloud?.settings && !Array.isArray(cloud.settings) ? cloud.settings as Record<string, unknown> : null,
  };
}

type CloudIndexes = ReturnType<typeof cloudIndexes>;

function remoteRowForEntry(entry: SyncEntry, indexes: CloudIndexes) {
  if (entry.type === 'word_favorite') return indexes.wordFavorites.get(normalizedId(entry.payload.word_id));
  if (entry.type === 'song_favorite') return indexes.songFavorites.get(normalizedId(entry.payload.song_id));
  if (entry.type === 'hidden_word') return indexes.hiddenWords.get(`${setKey(entry.payload)}::${normalizedId(entry.payload.word_id)}`);
  if (entry.type === 'set_progress') return indexes.setProgress.get(setKey(entry.payload));
  if (entry.type === 'station_progress') return indexes.stationProgress.get(stationKey(entry.payload));
  if (entry.type === 'user_settings') return indexes.settings;
  return null;
}

async function pruneSupersededQueue(userId: string, indexes: CloudIndexes) {
  await withQueueLock(userId, async () => {
    const queue = await readQueueUnsafe(userId);
    const next = queue.filter((entry) => !remoteSupersedes(entry.payload, remoteRowForEntry(entry, indexes)));
    if (next.length !== queue.length) await writeQueueUnsafe(next, userId);
  });
}

async function applyPendingLocalChanges(userId: string) {
  for (const entry of await readQueue(userId)) {
    if (entry.type === 'word_favorite') {
      const ids = new Set(await readScopedJson<string[]>(STORAGE_KEYS.wordFavorites, [], userId));
      if (entry.payload.is_active) ids.add(normalizedId(entry.payload.word_id)); else ids.delete(normalizedId(entry.payload.word_id));
      await writeScopedJson(STORAGE_KEYS.wordFavorites, Array.from(ids), userId);
    } else if (entry.type === 'song_favorite') {
      const ids = new Set(await readScopedJson<string[]>(STORAGE_KEYS.songFavorites, [], userId));
      if (entry.payload.is_active) ids.add(normalizedId(entry.payload.song_id)); else ids.delete(normalizedId(entry.payload.song_id));
      await writeScopedJson(STORAGE_KEYS.songFavorites, Array.from(ids), userId);
    } else if (entry.type === 'set_progress') {
      const rows = await readScopedJson<Record<string, unknown>[]>(STORAGE_KEYS.setProgress, [], userId);
      await writeScopedJson(STORAGE_KEYS.setProgress, mergeLatestRows([rows, [entry.payload]], setKey), userId);
    } else if (entry.type === 'hidden_word') {
      const map = await readScopedJson<Record<string, string[]>>(STORAGE_KEYS.hiddenWords, {}, userId);
      const key = setKey(entry.payload);
      const ids = new Set(map[key] ?? []);
      if (entry.payload.is_hidden) ids.add(normalizedId(entry.payload.word_id)); else ids.delete(normalizedId(entry.payload.word_id));
      map[key] = Array.from(ids);
      await writeScopedJson(STORAGE_KEYS.hiddenWords, map, userId);
    } else if (entry.type === 'station_progress') {
      const rows = await readScopedJson<Record<string, unknown>[]>(STORAGE_KEYS.stationProgress, [], userId);
      await writeScopedJson(STORAGE_KEYS.stationProgress, mergeLatestRows([rows, [entry.payload]], stationKey), userId);
    } else if (entry.type === 'user_settings') {
      const current = await readScopedJson<Record<string, unknown>>(STORAGE_KEYS.userSettings, {}, userId);
      await writeScopedJson(STORAGE_KEYS.userSettings, {
        ...current,
        ...entry.payload,
        text_size_code: entry.payload.text_size_code ?? current.text_size_code ?? 'medium',
      }, userId);
    } else if (entry.type === 'word_progress_snapshot') {
      const local = await readScopedJson<ProgressRow[]>(STORAGE_KEYS.wordProgress, [], userId);
      await writeScopedJson(STORAGE_KEYS.wordProgress, mergeWordProgressRows(local, asArray<ProgressRow>(entry.payload.words)), userId);
    }
  }
}

export async function pullCloudProgress(userId: string) {
  const cloud = await pullCloudState(userId);
  const indexes = cloudIndexes(cloud);
  await pruneSupersededQueue(userId, indexes);
  const localSettings = await readScopedJson<Record<string, unknown> | null>(STORAGE_KEYS.userSettings, null, userId);
  const localWords = await readScopedJson<ProgressRow[]>(STORAGE_KEYS.wordProgress, [], userId);
  await writeScopedJson(STORAGE_KEYS.wordProgress, mergeWordProgressRows(localWords, asArray<ProgressRow>(cloud.wordProgress)), userId);
  await writeScopedJson(STORAGE_KEYS.stationProgress, mergeLatestRows([
    asArray<Record<string, unknown>>(cloud.stationProgress),
    await readScopedJson(STORAGE_KEYS.stationProgress, [], userId),
  ], stationKey), userId);
  await writeScopedJson(STORAGE_KEYS.setProgress, mergeLatestRows([
    asArray<Record<string, unknown>>(cloud.setProgress),
    await readScopedJson(STORAGE_KEYS.setProgress, [], userId),
  ], setKey), userId);
  await writeScopedJson(STORAGE_KEYS.wordFavorites, asArray<Record<string, unknown>>(cloud.wordFavorites).filter((row) => row.is_active).map((row) => normalizedId(row.word_id)).filter(Boolean), userId);
  await writeScopedJson(STORAGE_KEYS.songFavorites, asArray<Record<string, unknown>>(cloud.songFavorites).filter((row) => row.is_active).map((row) => normalizedId(row.song_id)).filter(Boolean), userId);
  const hiddenMap: Record<string, string[]> = {};
  asArray<Record<string, unknown>>(cloud.hiddenWords).filter((row) => row.is_hidden).forEach((row) => {
    const key = setKey(row);
    hiddenMap[key] ||= [];
    hiddenMap[key].push(normalizedId(row.word_id));
  });
  await writeScopedJson(STORAGE_KEYS.hiddenWords, hiddenMap, userId);
  const cloudSettings = cloud.settings && !Array.isArray(cloud.settings)
    ? cloud.settings as Record<string, unknown>
    : null;
  const settingsSource = preferredSettingsSource(cloudSettings, localSettings);
  if (settingsSource === 'guest' && localSettings) {
    await writeScopedJson(STORAGE_KEYS.userSettings, localSettings, userId);
  } else if (settingsSource === 'account' && cloudSettings) {
    await writeScopedJson(STORAGE_KEYS.userSettings, {
      ...cloudSettings,
      text_size_code: localSettings?.text_size_code ?? 'medium',
    }, userId);
  }
  const localHistory = await readScopedJson<Record<string, unknown>[]>(STORAGE_KEYS.activityHistory, [], userId);
  const historyById = new Map<string, Record<string, unknown>>();
  asArray<Record<string, unknown>>(cloud.activityHistory).forEach((row) => {
    const id = normalizedId(row.id);
    if (id) historyById.set(id, row);
  });
  localHistory.forEach((row) => {
    const id = normalizedId(row.id);
    if (id) historyById.set(id, { ...(historyById.get(id) ?? {}), ...row });
  });
  await writeScopedJson(STORAGE_KEYS.activityHistory, Array.from(historyById.values())
    .sort((left, right) => timestamp(right.ended_at || right.started_at) - timestamp(left.ended_at || left.started_at))
    .slice(0, 300), userId);
  await applyPendingLocalChanges(userId);
  return cloud;
}

async function migrateLegacyActivityHistory() {
  const current = await readScopedJson<Record<string, unknown>[]>(STORAGE_KEYS.activityHistory, [], null);
  const byId = new Map(current.map((row) => [normalizedId(row.id), row]));
  for (const kind of ['learn', 'test', 'match', 'station_test']) {
    let legacy: Record<string, unknown>[] = [];
    try {
      const raw = await AsyncStorage.getItem(`${LEGACY_ACTIVITY_PREFIX}${kind}`);
      legacy = raw ? asArray<Record<string, unknown>>(JSON.parse(raw)) : [];
    } catch { legacy = []; }
    legacy.forEach((row) => {
      const rowId = normalizedId(row.id);
      if (rowId) byId.set(rowId, { ...row, type: row.type || kind });
    });
  }
  await writeScopedJson(STORAGE_KEYS.activityHistory, Array.from(byId.values()), null);
}

async function migrateLegacyActiveSessions(userId?: string | null) {
  const scope = userId ? `user:${userId}` : 'guest';
  const sessions = await readScopedJson<Record<string, Record<string, unknown>>>(STORAGE_KEYS.activeSessions, {}, userId);
  const legacyKeys: string[] = [];
  let changed = false;
  for (const kind of ['learn', 'test', 'match', 'station_test']) {
    const legacyKey = `${LEGACY_ACTIVE_PREFIX}:${scope}:${kind}`;
    const raw = await AsyncStorage.getItem(legacyKey);
    if (!raw) continue;
    legacyKeys.push(legacyKey);
    if (sessions[kind]) continue;
    try {
      const parsed = JSON.parse(raw) as { runtime?: Record<string, unknown>; payload?: Record<string, unknown> };
      if (!parsed.runtime?.id) continue;
      sessions[kind] = {
        runtime: {
          ...parsed.runtime,
          activeDurationMs: Math.max(0, Number(parsed.runtime.activeDurationMs || 0)),
          activeStartedMs: 0,
        },
        payload: parsed.payload ?? {},
        saved_at: nowIso(),
      };
      changed = true;
    } catch { /* Invalid legacy sessions are ignored. */ }
  }
  if (changed) await writeScopedJson(STORAGE_KEYS.activeSessions, sessions, userId);
  if (legacyKeys.length) await AsyncStorage.multiRemove(legacyKeys);
}

export function migrateLegacyMobileStorage() {
  if (guestMigration) return guestMigration;
  const migration = (async () => {
    await Promise.all([
      migrateLegacyValue(STORAGE_KEYS.wordProgress, ['alantil_mobile_word_progress_guest_v1']),
      migrateLegacyValue(STORAGE_KEYS.stationProgress, ['alantil_mobile_station_progress_guest_v14_1_6']),
      migrateLegacyValue(STORAGE_KEYS.wordFavorites, ['fc_favorites_v1:guest']),
      migrateLegacyValue(STORAGE_KEYS.songFavorites, ['alantil_song_favorites_v1:guest']),
      migrateLegacyValue(STORAGE_KEYS.userSettings, ['alantil_user_settings_v1']),
      migrateLegacyValue(STORAGE_KEYS.hiddenWords, ['fc_hidden_by_set_v7']),
      migrateLegacyActiveSessions(null),
    ]);
    await migrateLegacyActivityHistory();
  })();
  guestMigration = migration.catch(() => { guestMigration = null; });
  return guestMigration;
}

async function claimGuestData(userId: string, cloud: CloudState | null) {
  const claimId = `claim:${userId}:${Date.now()}`;
  const guestQueue = await readQueue(null);
  const indexes = cloudIndexes(cloud);
  const guestWords = await readScopedJson<ProgressRow[]>(STORAGE_KEYS.wordProgress, [], null);
  const guestStationsRaw = await readScopedJson<unknown>(STORAGE_KEYS.stationProgress, [], null);
  const guestStations = Array.isArray(guestStationsRaw) ? guestStationsRaw as Record<string, unknown>[] : Object.values((guestStationsRaw ?? {}) as Record<string, Record<string, unknown>>);
  const guestSets = await readScopedJson<Record<string, unknown>[]>(STORAGE_KEYS.setProgress, [], null);
  const guestHidden = await readScopedJson<Record<string, string[]>>(STORAGE_KEYS.hiddenWords, {}, null);
  const guestWordFavorites = await readScopedJson<string[]>(STORAGE_KEYS.wordFavorites, [], null);
  const guestSongFavorites = await readScopedJson<string[]>(STORAGE_KEYS.songFavorites, [], null);
  const storedGuestSettings = await readScopedJson<Record<string, unknown> | null>(STORAGE_KEYS.userSettings, null, null);
  const queuedGuestSettings = guestQueue
    .filter((entry) => entry.type === 'user_settings')
    .sort((left, right) => timestamp(right.payload.updated_at || right.created_at) - timestamp(left.payload.updated_at || left.created_at))[0]?.payload ?? null;
  const guestSettings = queuedGuestSettings || storedGuestSettings;
  const guestHistory = await readScopedJson<Record<string, unknown>[]>(STORAGE_KEYS.activityHistory, [], null);
  const hasGuestData = guestQueue.length || guestWords.length || guestStations.length || guestSets.length || Object.keys(guestHidden).length || guestWordFavorites.length || guestSongFavorites.length || guestHistory.length || Boolean(guestSettings);
  if (!hasGuestData) return false;
  const claimWordFavorites = guestWordFavorites.filter((wordId) => !indexes.wordFavorites.has(normalizedId(wordId)));
  const claimSongFavorites = guestSongFavorites.filter((songId) => !indexes.songFavorites.has(normalizedId(songId)));
  const claimStations = guestStations.filter((row) => !remoteSupersedes(row, indexes.stationProgress.get(stationKey(row))));
  const claimSets = guestSets.filter((row) => !remoteSupersedes(row, indexes.setProgress.get(setKey(row))));
  const claimHidden: Record<string, string[]> = {};
  Object.entries(guestHidden).forEach(([key, values]) => {
    const filtered = values.filter((wordId) => !indexes.hiddenWords.has(`${key}::${normalizedId(wordId)}`));
    if (filtered.length) claimHidden[key] = filtered;
  });

  const accountWords = await readScopedJson<ProgressRow[]>(STORAGE_KEYS.wordProgress, [], userId);
  await writeScopedJson(STORAGE_KEYS.wordProgress, mergeWordProgressRows(accountWords, guestWords), userId);
  await writeScopedJson(STORAGE_KEYS.stationProgress, mergeLatestRows([
    await readScopedJson(STORAGE_KEYS.stationProgress, [], userId), claimStations,
  ], stationKey), userId);
  await writeScopedJson(STORAGE_KEYS.setProgress, mergeLatestRows([
    await readScopedJson(STORAGE_KEYS.setProgress, [], userId), claimSets,
  ], setKey), userId);
  const accountHidden = await readScopedJson<Record<string, string[]>>(STORAGE_KEYS.hiddenWords, {}, userId);
  Object.entries(claimHidden).forEach(([key, values]) => { accountHidden[key] = Array.from(new Set([...(accountHidden[key] ?? []), ...values])); });
  await writeScopedJson(STORAGE_KEYS.hiddenWords, accountHidden, userId);
  const accountWordFavorites = new Set(await readScopedJson<string[]>(STORAGE_KEYS.wordFavorites, [], userId));
  claimWordFavorites.forEach((wordId) => accountWordFavorites.add(wordId));
  await writeScopedJson(STORAGE_KEYS.wordFavorites, Array.from(accountWordFavorites), userId);
  const accountSongFavorites = new Set(await readScopedJson<string[]>(STORAGE_KEYS.songFavorites, [], userId));
  claimSongFavorites.forEach((songId) => accountSongFavorites.add(songId));
  await writeScopedJson(STORAGE_KEYS.songFavorites, Array.from(accountSongFavorites), userId);
  const accountHistory = await readScopedJson<Record<string, unknown>[]>(STORAGE_KEYS.activityHistory, [], userId);
  const historyById = new Map([...accountHistory, ...guestHistory].map((row) => [normalizedId(row.id), row]));
  await writeScopedJson(STORAGE_KEYS.activityHistory, Array.from(historyById.values()).filter((row) => normalizedId(row.id)), userId);
  const accountSettings = await readScopedJson<Record<string, unknown> | null>(STORAGE_KEYS.userSettings, null, userId);
  const settingsSource = preferredSettingsSource(accountSettings, guestSettings);
  const claimedGuestSettings = settingsSource === 'guest' && guestSettings
    ? { ...guestSettings, updated_at: guestSettings.updated_at || nowIso() }
    : null;
  if (claimedGuestSettings) await writeScopedJson(STORAGE_KEYS.userSettings, claimedGuestSettings, userId);

  const prepared: SyncEntry[] = guestQueue
    .filter((entry) => entry.type !== 'user_settings')
    .filter((entry) => !remoteSupersedes(entry.payload, remoteRowForEntry(entry, indexes)))
    .map((entry) => ({ ...entry, revision: revisionId(), claim_id: claimId }));
  if (guestWords.length) prepared.push({
    id: `word_progress_snapshot:${claimId}`,
    type: 'word_progress_snapshot',
    payload: { snapshot_id: claimId, words: guestWords },
    created_at: nowIso(), attempts: 0, revision: revisionId(), claim_id: claimId,
  });
  claimWordFavorites.forEach((wordId) => prepared.push({ id: `word_favorite:${wordId}`, type: 'word_favorite', payload: { word_id: wordId, is_active: true, updated_at: nowIso() }, created_at: nowIso(), attempts: 0, revision: revisionId(), claim_id: claimId }));
  claimSongFavorites.forEach((songId) => prepared.push({ id: `song_favorite:${songId}`, type: 'song_favorite', payload: { song_id: songId, is_active: true, updated_at: nowIso() }, created_at: nowIso(), attempts: 0, revision: revisionId(), claim_id: claimId }));
  claimStations.forEach((row) => prepared.push({ id: `station_progress:${stationKey(row)}`, type: 'station_progress', payload: row, created_at: nowIso(), attempts: 0, revision: revisionId(), claim_id: claimId }));
  claimSets.forEach((row) => prepared.push({ id: `set_progress:${setKey(row)}`, type: 'set_progress', payload: row, created_at: nowIso(), attempts: 0, revision: revisionId(), claim_id: claimId }));
  Object.entries(claimHidden).forEach(([key, values]) => {
    const [dictionary_id, section_id, set_id] = key.split('::');
    values.forEach((word_id) => prepared.push({ id: `hidden_word:${key}:${word_id}`, type: 'hidden_word', payload: { dictionary_id, section_id, set_id, word_id, is_hidden: true, updated_at: nowIso() }, created_at: nowIso(), attempts: 0, revision: revisionId(), claim_id: claimId }));
  });
  if (claimedGuestSettings) prepared.push({ id: 'user_settings:current', type: 'user_settings', payload: claimedGuestSettings, created_at: nowIso(), attempts: 0, revision: revisionId(), claim_id: claimId });
  guestHistory.forEach((row) => {
    const kind = normalizedId(row.type || row.kind);
    const rowId = normalizedId(row.id);
    const type = kind === 'station_test' ? 'station_test_session' : `${kind}_session`;
    if (rowId && ['learn_session', 'test_session', 'match_session', 'station_test_session'].includes(type)) prepared.push({ id: `${type}:${rowId}`, type: type as SyncOperation, payload: row, created_at: nowIso(), attempts: 0, revision: revisionId(), claim_id: claimId });
  });

  await withQueueLock(userId, async () => {
    const accountQueue = await readQueueUnsafe(userId);
    const byId = new Map(accountQueue.map((entry) => [entry.id, entry]));
    prepared.forEach((entry) => { if (!byId.has(entry.id)) byId.set(entry.id, entry); });
    await writeQueueUnsafe(Array.from(byId.values()), userId);
  });
  await writeScopedJson(STORAGE_KEYS.guestClaim, { claim_id: claimId, status: 'pending', entry_ids: prepared.map((entry) => entry.id), created_at: nowIso() }, userId);
  return true;
}

export async function synchronizeAccount(userId: string) {
  currentUserId = normalizedId(userId);
  if (!currentUserId) return false;
  await migrateLegacyMobileStorage();
  try { await migrateLegacyActiveSessions(currentUserId); } catch { /* Legacy storage must not block the current account. */ }
  let cloud: CloudState | null = null;
  try { cloud = await pullCloudProgress(currentUserId); } catch { /* The local account scope remains usable offline. */ }
  await claimGuestData(currentUserId, cloud);
  return flushSyncQueue(currentUserId, { force: true });
}

export function initializeSyncLifecycle(userId?: string | null) {
  const previousUserId = currentUserId;
  currentUserId = normalizedId(userId);
  if (previousUserId && previousUserId !== currentUserId) {
    const timer = retryTimers.get(previousUserId);
    if (timer) clearTimeout(timer);
    retryTimers.delete(previousUserId);
  }
  if (!bound) {
    bound = true;
    AppState.addEventListener('change', (state) => {
      if (state === 'active' && currentUserId) void flushSyncQueue(currentUserId, { force: true });
    });
  }
  if (currentUserId) void synchronizeAccount(currentUserId);
}
