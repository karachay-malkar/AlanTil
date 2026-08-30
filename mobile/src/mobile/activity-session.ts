import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/src/lib/supabase';
import type { UserSettings } from '@/src/mobile/settings';

export type ActivityKind = 'learn' | 'test' | 'match' | 'station_test';
export type ActivityRuntime = {
  id: string;
  kind: ActivityKind;
  startedAt: string;
  startedMs: number;
  translationLanguage: string;
  userId: string | null;
};

const ACTIVE_PREFIX = 'alantil_mobile_activity_v14_1_6';
const HISTORY_PREFIX = 'alantil_mobile_activity_history_v14_1_6';

function uuid() {
  const pattern = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return pattern.replace(/[xy]/g, (token) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = token === 'x' ? value : ((value & 0x3) | 0x8);
    return nibble.toString(16);
  });
}

function scope(userId?: string | null) {
  return userId ? `user:${userId}` : 'guest';
}

function activeKey(kind: ActivityKind, userId?: string | null) {
  return `${ACTIVE_PREFIX}:${scope(userId)}:${kind}`;
}

function historyKey(kind: ActivityKind) {
  return `${HISTORY_PREFIX}:guest:${kind}`;
}

export async function createActivitySession(kind: ActivityKind, settings: UserSettings, userId?: string | null) {
  const runtime: ActivityRuntime = {
    id: uuid(),
    kind,
    startedAt: new Date().toISOString(),
    startedMs: Date.now(),
    translationLanguage: settings.translation_language_code || 'ru',
    userId: userId ?? null,
  };
  await AsyncStorage.setItem(activeKey(kind, userId), JSON.stringify({ runtime, payload: {} }));
  return runtime;
}

export async function resumeActivitySession<T extends Record<string, unknown> = Record<string, unknown>>(kind: ActivityKind, userId?: string | null) {
  const raw = await AsyncStorage.getItem(activeKey(kind, userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { runtime?: ActivityRuntime; payload?: T };
    if (!parsed.runtime?.id || parsed.runtime.kind !== kind) return null;
    return { runtime: parsed.runtime, payload: (parsed.payload ?? {}) as T };
  } catch {
    return null;
  }
}

export async function persistActivitySession(runtime: ActivityRuntime, payload: Record<string, unknown>) {
  await AsyncStorage.setItem(activeKey(runtime.kind, runtime.userId), JSON.stringify({ runtime, payload }));
}

export async function discardActivitySession(kind: ActivityKind, userId?: string | null) {
  await AsyncStorage.removeItem(activeKey(kind, userId));
}

function rpcFor(kind: ActivityKind) {
  if (kind === 'learn') return 'save_learn_session';
  if (kind === 'test') return 'save_test_session';
  if (kind === 'match') return 'save_match_session';
  return 'save_station_test_session';
}

export async function completeActivitySession(runtime: ActivityRuntime, payload: Record<string, unknown>, status: 'completed' | 'interrupted' = 'completed', exitReason: string | null = null) {
  const endedAt = new Date().toISOString();
  const duration = Math.max(0, Math.round((Date.now() - runtime.startedMs) / 1000));
  const finalPayload = {
    id: runtime.id,
    translation_language_code: runtime.translationLanguage,
    started_at: runtime.startedAt,
    ended_at: endedAt,
    duration_sec: duration,
    active_duration_sec: duration,
    ...payload,
    status,
    exit_reason: status === 'completed' ? null : (exitReason || 'route_change'),
  };

  if (runtime.userId) {
    const { error } = await supabase.rpc(rpcFor(runtime.kind), { payload: finalPayload });
    if (error) throw error;
  } else {
    const key = historyKey(runtime.kind);
    const raw = await AsyncStorage.getItem(key);
    const history = raw ? JSON.parse(raw) : [];
    history.unshift(finalPayload);
    await AsyncStorage.setItem(key, JSON.stringify(history.slice(0, 50)));
  }

  await AsyncStorage.removeItem(activeKey(runtime.kind, runtime.userId));
  return finalPayload;
}

export async function interruptActivitySession(runtime: ActivityRuntime, payload: Record<string, unknown>, reason = 'route_change') {
  return completeActivitySession(runtime, payload, 'interrupted', reason);
}
