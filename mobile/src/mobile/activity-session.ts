import { AppState } from 'react-native';

import { trackMobileEvent } from '@/src/mobile/analytics';
import type { UserSettings } from '@/src/mobile/settings';
import { readScopedJson, STORAGE_KEYS, updateScopedJson } from '@/src/mobile/storage';
import { enqueueSync, type SyncOperation } from '@/src/mobile/sync';

export type ActivityKind = 'learn' | 'test' | 'match' | 'station_test';
export type ActivityRuntime = {
  id: string;
  kind: ActivityKind;
  startedAt: string;
  startedMs: number;
  activeDurationMs: number;
  activeStartedMs: number;
  translationLanguage: string;
  userId: string | null;
};

type ActiveSnapshot = { runtime: ActivityRuntime; payload: Record<string, unknown>; saved_at: string };

const live = new Map<string, ActiveSnapshot>();
let lifecycleBound = false;

function uuid() {
  const pattern = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return pattern.replace(/[xy]/g, (token) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = token === 'x' ? value : ((value & 0x3) | 0x8);
    return nibble.toString(16);
  });
}

function pause(runtime: ActivityRuntime) {
  if (!runtime.activeStartedMs) return;
  runtime.activeDurationMs += Math.max(0, Date.now() - runtime.activeStartedMs);
  runtime.activeStartedMs = 0;
}

function resume(runtime: ActivityRuntime) {
  if (runtime.activeStartedMs) return;
  runtime.activeStartedMs = Date.now();
}

async function activeSessions(userId?: string | null) {
  return readScopedJson<Record<string, ActiveSnapshot>>(STORAGE_KEYS.activeSessions, {}, userId);
}

async function saveSnapshot(snapshot: ActiveSnapshot) {
  await updateScopedJson<Record<string, ActiveSnapshot>>(STORAGE_KEYS.activeSessions, {}, (sessions) => ({
    ...sessions,
    [snapshot.runtime.kind]: snapshot,
  }), snapshot.runtime.userId);
  live.set(snapshot.runtime.id, snapshot);
}

function bindLifecycle() {
  if (lifecycleBound) return;
  lifecycleBound = true;
  AppState.addEventListener('change', (state) => {
    live.forEach((snapshot) => {
      if (state === 'active') resume(snapshot.runtime); else pause(snapshot.runtime);
      void saveSnapshot({ ...snapshot, saved_at: new Date().toISOString() });
    });
  });
}

export async function createActivitySession(kind: ActivityKind, settings: UserSettings, userId?: string | null) {
  bindLifecycle();
  const runtime: ActivityRuntime = {
    id: uuid(),
    kind,
    startedAt: new Date().toISOString(),
    startedMs: Date.now(),
    activeDurationMs: 0,
    activeStartedMs: Date.now(),
    translationLanguage: settings.translation_language_code || 'ru',
    userId: userId ?? null,
  };
  await saveSnapshot({ runtime, payload: {}, saved_at: new Date().toISOString() });
  void trackMobileEvent('activity_start', { activity_type: kind, activity_id: runtime.id }, runtime.userId);
  return runtime;
}

export async function resumeActivitySession<T extends Record<string, unknown> = Record<string, unknown>>(kind: ActivityKind, userId?: string | null) {
  bindLifecycle();
  const parsed = (await activeSessions(userId))[kind];
  if (!parsed?.runtime?.id || parsed.runtime.kind !== kind) return null;
  parsed.runtime.activeDurationMs = Math.max(0, Number(parsed.runtime.activeDurationMs || 0));
  resume(parsed.runtime);
  live.set(parsed.runtime.id, parsed);
  return { runtime: parsed.runtime, payload: (parsed.payload ?? {}) as T };
}

export async function persistActivitySession(runtime: ActivityRuntime, payload: Record<string, unknown>) {
  await saveSnapshot({ runtime, payload, saved_at: new Date().toISOString() });
}

export async function discardActivitySession(kind: ActivityKind, userId?: string | null) {
  let runtimeId = '';
  await updateScopedJson<Record<string, ActiveSnapshot>>(STORAGE_KEYS.activeSessions, {}, (sessions) => {
    runtimeId = sessions[kind]?.runtime?.id ?? '';
    const next = { ...sessions };
    delete next[kind];
    return next;
  }, userId);
  if (runtimeId) live.delete(runtimeId);
}

function syncType(kind: ActivityKind): SyncOperation {
  if (kind === 'station_test') return 'station_test_session';
  return `${kind}_session` as SyncOperation;
}

async function applyLocalPracticeProgress(kind: ActivityKind, payload: Record<string, unknown>, userId?: string | null) {
  if (!['test', 'match'].includes(kind)) return;
  const completedAt = new Date().toISOString();
  const words = Array.isArray(payload.words) ? payload.words as Record<string, unknown>[] : [];
  await updateScopedJson<Record<string, unknown>[]>(STORAGE_KEYS.wordProgress, [], (rows) => {
    const byId = new Map(rows.map((row) => [String(row.word_id ?? ''), { ...row }]));
    words.forEach((entry) => {
      const wordId = String(entry.word_id ?? '').trim();
      if (!wordId) return;
      const row = byId.get(wordId) ?? { word_id: wordId, mastery_status: 'not_started' };
      if (kind === 'test') {
        const correct = entry.result === 'correct';
        row.test_answers_total = Number(row.test_answers_total || 0) + 1;
        row.test_correct_count = Number(row.test_correct_count || 0) + (correct ? 1 : 0);
        row.test_wrong_count = Number(row.test_wrong_count || 0) + (correct ? 0 : 1);
        row.last_result = correct ? 'correct' : 'wrong';
        row.last_tested_at = completedAt;
      } else {
        const errors = Math.max(0, Number(entry.error_count || 0));
        row.match_sessions_total = Number(row.match_sessions_total || 0) + 1;
        row.match_success_total = Number(row.match_success_total || 0) + (entry.matched ? 1 : 0);
        row.match_errors_total = Number(row.match_errors_total || 0) + errors;
        row.last_result = errors ? 'wrong' : 'correct';
      }
      row.sessions_total = Number(row.sessions_total || 0) + 1;
      if (row.mastery_status === 'not_started') row.mastery_status = 'learning';
      row.last_mode = kind;
      row.last_seen_at = completedAt;
      row.updated_at = completedAt;
      byId.set(wordId, row);
    });
    return Array.from(byId.values());
  }, userId);
}

export async function completeActivitySession(
  runtime: ActivityRuntime,
  payload: Record<string, unknown>,
  status: 'completed' | 'interrupted' = 'completed',
  exitReason: string | null = null,
) {
  pause(runtime);
  live.delete(runtime.id);
  const endedAt = new Date().toISOString();
  const finalPayload = {
    id: runtime.id,
    translation_language_code: runtime.translationLanguage,
    started_at: runtime.startedAt,
    ended_at: endedAt,
    duration_sec: Math.max(0, Math.round((Date.now() - runtime.startedMs) / 1000)),
    active_duration_sec: Math.max(0, Math.round(runtime.activeDurationMs / 1000)),
    ...payload,
    status,
    exit_reason: status === 'completed' ? null : (exitReason || 'route_change'),
    type: runtime.kind,
  };
  await applyLocalPracticeProgress(runtime.kind, finalPayload, runtime.userId);
  await updateScopedJson<Record<string, unknown>[]>(STORAGE_KEYS.activityHistory, [], (history) => [
    finalPayload,
    ...history.filter((row) => row.id !== runtime.id),
  ].sort((left, right) => Date.parse(String(right.ended_at || right.started_at || '')) - Date.parse(String(left.ended_at || left.started_at || '')))
    .slice(0, 300), runtime.userId);
  await enqueueSync(syncType(runtime.kind), finalPayload, runtime.userId, { entryId: `${syncType(runtime.kind)}:${runtime.id}`, replace: false });
  void trackMobileEvent(status === 'completed' ? 'activity_complete' : 'activity_abandon', {
    activity_type: runtime.kind,
    activity_id: runtime.id,
    duration_sec: finalPayload.duration_sec,
    active_duration_sec: finalPayload.active_duration_sec,
    exit_reason: finalPayload.exit_reason || '',
  }, runtime.userId);
  await discardActivitySession(runtime.kind, runtime.userId);
  return finalPayload;
}

export async function interruptActivitySession(runtime: ActivityRuntime, payload: Record<string, unknown>, reason = 'route_change') {
  return completeActivitySession(runtime, payload, 'interrupted', reason);
}

export async function recoverInterruptedSessions(userId?: string | null) {
  const sessions = await activeSessions(userId);
  for (const snapshot of Object.values(sessions)) {
    if (!snapshot?.runtime?.id) continue;
    await completeActivitySession(snapshot.runtime, snapshot.payload ?? {}, 'interrupted', 'close');
  }
}
