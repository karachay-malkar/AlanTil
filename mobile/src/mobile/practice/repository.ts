import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/src/lib/supabase';
import { loadAllWords } from '@/src/mobile/dictionary';
import type { UserSettings } from '@/src/mobile/settings';
import { toPracticeWord, type PracticeWord } from '@/src/mobile/practice/selection';
import {
  createActivitySession,
  completeActivitySession,
  persistActivitySession,
  resumeActivitySession,
  type ActivityRuntime,
} from '@/src/mobile/activity-session';

const FAVORITES_PREFIX = 'fc_favorites_v1';

export type SessionKind = 'test' | 'match';
export type SessionRuntime = ActivityRuntime;

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
  return createActivitySession(kind, settings, userId);
}

export async function resumeSessionRuntime(kind: SessionKind, userId?: string | null) {
  return resumeActivitySession(kind, userId);
}

export async function persistActiveSession(runtime: SessionRuntime, payload: Record<string, unknown>) {
  return persistActivitySession(runtime, payload);
}

export async function finalizeSession(runtime: SessionRuntime, payload: Record<string, unknown>, status: 'completed' | 'interrupted' = 'completed', exitReason: string | null = null) {
  return completeActivitySession(runtime, payload, status, exitReason);
}
