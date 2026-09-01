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
import { readScopedJson, STORAGE_KEYS, updateScopedJson } from '@/src/mobile/storage';
import { enqueueSync } from '@/src/mobile/sync';
import {
  filterFavoriteItems,
  normalizeFavoriteIds,
  setFavoriteActive,
} from '../../../../packages/alantil-core/favorites.js';

export type SessionKind = 'test' | 'match';
export type SessionRuntime = ActivityRuntime;

async function readIds(userId?: string | null) {
  return new Set(normalizeFavoriteIds(await readScopedJson<unknown[]>(STORAGE_KEYS.wordFavorites, [], userId)));
}

export async function loadPracticeWords(settings: UserSettings): Promise<PracticeWord[]> {
  const words = await loadAllWords();
  return words.map((word) => toPracticeWord(word, settings)).filter((word): word is PracticeWord => Boolean(word));
}

export async function loadFavoriteIds(userId?: string | null) {
  return readIds(userId);
}

export async function setFavorite(userId: string | null | undefined, wordId: string, active: boolean) {
  let result = { ids: [] as string[], active: false, changed: false };
  await updateScopedJson<unknown[]>(STORAGE_KEYS.wordFavorites, [], (current) => {
    result = setFavoriteActive(current, wordId, active);
    return result.ids;
  }, userId);
  if (!result.ids.length && !String(wordId ?? '').trim()) return false;
  const id = String(wordId ?? '').normalize('NFC').trim();
  if (!id) return false;
  if (result.changed) {
    await enqueueSync('word_favorite', { word_id: id, is_active: result.active, updated_at: new Date().toISOString() }, userId, { entryId: `word_favorite:${id}` });
  }
  return result.active;
}

export async function favoriteWords(settings: UserSettings, userId?: string | null) {
  const [words, ids] = await Promise.all([loadPracticeWords(settings), loadFavoriteIds(userId)]);
  return filterFavoriteItems(words, Array.from(ids));
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
