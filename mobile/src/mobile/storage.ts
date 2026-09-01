import AsyncStorage from '@react-native-async-storage/async-storage';

const SCOPE_PREFIX = 'alantil_mobile_scope_v14_2_0';
const listeners = new Map<string, Set<() => void>>();
const mutationTails = new Map<string, Promise<void>>();

export const STORAGE_KEYS = {
  activityHistory: 'activity_history',
  activeSessions: 'active_sessions',
  analyticsEvents: 'analytics_events',
  analyticsPreference: 'analytics_preference',
  guestClaim: 'guest_claim',
  hiddenWords: 'hidden_words',
  matchSetup: 'match_setup',
  pathState: 'path_state',
  progressQueue: 'progress_queue',
  routeSettings: 'route_settings',
  setProgress: 'set_progress',
  songFavorites: 'song_favorites',
  songsCatalogState: 'songs_catalog_state',
  stationProgress: 'station_progress',
  testSetup: 'test_setup',
  userSettings: 'user_settings',
  wordFavorites: 'word_favorites',
  wordProgress: 'word_progress',
} as const;

export type StorageScope = 'guest' | `user:${string}`;

export function storageScope(userId?: string | null): StorageScope {
  const id = String(userId ?? '').trim();
  return id ? `user:${id}` : 'guest';
}

export function scopedStorageKey(baseKey: string, userId?: string | null) {
  return `${SCOPE_PREFIX}:${storageScope(userId)}:${baseKey}`;
}

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => {
    try { listener(); } catch { /* A storage observer must not break persistence. */ }
  });
}

export function subscribeScopedValue(baseKey: string, userId: string | null | undefined, listener: () => void) {
  const key = scopedStorageKey(baseKey, userId);
  const group = listeners.get(key) ?? new Set<() => void>();
  group.add(listener);
  listeners.set(key, group);
  return () => {
    group.delete(listener);
    if (!group.size) listeners.delete(key);
  };
}

export async function readScopedJson<T>(baseKey: string, fallback: T, userId?: string | null): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(scopedStorageKey(baseKey, userId));
    return raw === null ? fallback : JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeScopedJson(baseKey: string, value: unknown, userId?: string | null) {
  const key = scopedStorageKey(baseKey, userId);
  await AsyncStorage.setItem(key, JSON.stringify(value));
  notify(key);
}

export async function updateScopedJson<T>(
  baseKey: string,
  fallback: T,
  updater: (current: T) => T | Promise<T>,
  userId?: string | null,
) {
  const key = scopedStorageKey(baseKey, userId);
  const previous = mutationTails.get(key) ?? Promise.resolve();
  const operation = previous.catch(() => {}).then(async () => {
    let current = fallback;
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw !== null) current = JSON.parse(raw) as T;
    } catch { /* A corrupt value is replaced by the caller's fallback. */ }
    const next = await updater(current);
    await AsyncStorage.setItem(key, JSON.stringify(next));
    notify(key);
    return next;
  });
  const tail = operation.then(() => {}, () => {});
  mutationTails.set(key, tail);
  try {
    return await operation;
  } finally {
    if (mutationTails.get(key) === tail) mutationTails.delete(key);
  }
}

export async function removeScopedValue(baseKey: string, userId?: string | null) {
  const key = scopedStorageKey(baseKey, userId);
  await AsyncStorage.removeItem(key);
  notify(key);
}

export async function migrateLegacyValue(baseKey: string, legacyKeys: string[]) {
  const target = scopedStorageKey(baseKey, null);
  if (await AsyncStorage.getItem(target) !== null) return false;
  for (const legacyKey of legacyKeys) {
    const raw = await AsyncStorage.getItem(legacyKey);
    if (raw === null) continue;
    await AsyncStorage.setItem(target, raw);
    notify(target);
    return true;
  }
  return false;
}

export async function clearScopedValues(baseKeys: readonly string[], userId?: string | null) {
  const keys = baseKeys.map((key) => scopedStorageKey(key, userId));
  await AsyncStorage.multiRemove(keys);
  keys.forEach(notify);
}
