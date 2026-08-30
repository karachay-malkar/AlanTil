import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/src/lib/supabase';
import { loadAllWords } from '@/src/mobile/dictionary';
import type { UserSettings } from '@/src/mobile/settings';
import { toPracticeWord, type PracticeWord } from '@/src/mobile/practice/selection';

const FAVORITES_PREFIX = 'fc_favorites_v1';
const ACTIVE_SESSION_PREFIX = 'alantil_mobile_active_session_v1';
const SESSION_HISTORY_PREFIX = 'alantil_mobile_session_history_v1';

export type SessionKind = 'test' | 'match';
export type SessionRuntime = {
  id: string;
  kind: SessionKind;
  startedAt: string;
  startedMs: number;
  translationLanguage: string;
  userId: string | null;
};

function randomId() {
  return `mob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function scope(userId?: string | null) {
  return userId ? `user:${userId}` : 'guest';
}

function scopedKey(prefix: string, userId?: string | null) {
  return `${prefix}:${scope(userId)}`;
}

async function readIds(key: string) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return new Set<string>((raw ? JSON.parse(raw) : []).map((value: unknown) => String(value ?? '').trim()).filter(Boolean));
  } catch {
    return new Set<string>();
  }
}

async function writeIds(key: string, ids: Set<string>) {
  await AsyncStorage.setItem(key, JSON.stringify(Array.from(ids)));
}

export async function loadPracticeWords(settings: UserSettings): Promise<PracticeWord[]> {
  const words = await loadAllWords();
  return words.map((word) => toPracticeWord(word, settings)).filter((word): word is PracticeWord => Boolean(word));
}

export async function loadFavoriteIds(userId?: string | null) {
  const key = scopedKey(FAVORITES_PREFIX, userId);
  const local = await readIds(key);
  if (!userId) return local;
  const { data, error } = await supabase
    .from('user_word_favorites')
    .select('word_id,is_active')
    .eq('user_id', userId);
  if (error) return local;
  const cloud = new Set<string>((data ?? []).filter((row) => row.is_active).map((row) => String(row.word_id ?? '').trim()).filter(Boolean));
  await writeIds(key, cloud);
  return cloud;
}

export async function setFavorite(userId: string | null | undefined, wordId: string, active: boolean) {
  const id = String(wordId ?? '').trim();
  if (!id) return false;
  const key = scopedKey(FAVORITES_PREFIX, userId);
  const ids = await readIds(key);
  if (active) ids.add(id); else ids.delete(id);
  await writeIds(key, ids);
  if (userId) {
    const { error } = await supabase.from('user_word_favorites').upsert({
      user_id: userId,
      word_id: id,
      is_active: active,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,word_id' });
    if (error) throw error;
  }
  return active;
}

export async function favoriteWords(settings: UserSettings, userId?: string | null) {
  const [words, ids] = await Promise.all([loadPracticeWords(settings), loadFavoriteIds(userId)]);
  return words.filter((word) => ids.has(word.id));
}

export async function createSessionRuntime(kind: SessionKind, settings: UserSettings, userId?: string | null): Promise<SessionRuntime> {
  const runtime: SessionRuntime = {
    id: randomId(),
    kind,
    startedAt: new Date().toISOString(),
    startedMs: Date.now(),
    translationLanguage: settings.translation_language_code,
    userId: userId ?? null,
  };
  await AsyncStorage.setItem(scopedKey(`${ACTIVE_SESSION_PREFIX}:${kind}`, userId), JSON.stringify(runtime));
  return runtime;
}

export async function persistActiveSession(runtime: SessionRuntime, payload: Record<string, unknown>) {
  await AsyncStorage.setItem(scopedKey(`${ACTIVE_SESSION_PREFIX}:${runtime.kind}`, runtime.userId), JSON.stringify({ runtime, payload }));
}

export async function finalizeSession(runtime: SessionRuntime, payload: Record<string, unknown>, status: 'completed' | 'interrupted' = 'completed', exitReason: string | null = null) {
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
  await AsyncStorage.removeItem(scopedKey(`${ACTIVE_SESSION_PREFIX}:${runtime.kind}`, runtime.userId));
  if (runtime.userId) {
    const rpc = runtime.kind === 'test' ? 'save_test_session' : 'save_match_session';
    const { error } = await supabase.rpc(rpc, { payload: finalPayload });
    if (error) throw error;
  } else {
    const key = scopedKey(`${SESSION_HISTORY_PREFIX}:${runtime.kind}`, null);
    const raw = await AsyncStorage.getItem(key);
    const history = raw ? JSON.parse(raw) : [];
    history.unshift(finalPayload);
    await AsyncStorage.setItem(key, JSON.stringify(history.slice(0, 40)));
  }
  return finalPayload;
}
