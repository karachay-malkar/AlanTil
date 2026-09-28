export const STORAGE_SCOPE_PREFIX = 'alantil_scope_v1';
export const GUEST_STORAGE_SCOPE = 'guest';

const EXACT_STORAGE_KEYS = Object.freeze({
  'alantil_user_settings_v1': 'settings',
  'alantil:16.1:settings': 'settings',
  'alantil:16.4.1:settings-sync': 'sync.settings',
  'fc_favorites_v1': 'favorites.words',
  'alantil:16.1:favorites': 'favorites.words',
  'alantil:16.4.1:favorite-sync': 'sync.favorites.words',
  'alantil_song_favorites_v1': 'favorites.songs',
  'alantil:16.1:song-favorites': 'favorites.songs',
  'alantil:16.4.1:song-favorite-sync': 'sync.favorites.songs',
  'fc_hidden_by_set_v7': 'words.hidden',
  'alantil:16.6.1:hidden-words-by-context': 'words.hidden',
  'alantil:16.1:hidden-words': 'words.hidden.legacy',
  'alantil:16.4.1:hidden-words-sync': 'sync.words.hidden',
  'alantil:16.6.1:hidden-words-context-migrated': 'migration.words.hidden-context',
  'fc_finished_sets_v1': 'sets.completed',
  'alantil_word_progress_v13_5': 'progress.words',
  'alantil:16.1:word-progress': 'progress.words',
  'alantil_station_progress_v13_2': 'progress.stations',
  'alantil:16.1:station-attempts': 'progress.station-attempts',
  'alantil_route_settings_v13_1': 'route.settings',
  'alantil_progress_queue_v1': 'sync.queue',
  'alantil:16.1:cloud-queue': 'sync.queue',
  'alantil_active_sessions_v1': 'sessions.active',
  'alantil_activity_history_v13_1': 'activity.history',
  'alantil:16.1:activity': 'activity.summary',
  'alantil_user_rewards_v13_1': 'rewards',
  'alantil_guided_help_v1': 'guide.state',
  'alantil_story_intro_seen_v1': 'route.story-intro-seen',
  'alantil:16.1:onboarding-complete': 'onboarding.complete',
  'alantil:16.6.3:auth-choice-complete': 'auth.choice.complete',
  'alantil:16.6.3:analytics-events': 'analytics.optional.events',
  'alantil:privacy:analytics-enabled': 'privacy.analytics-enabled',
});

const PREFIX_STORAGE_KEYS = Object.freeze([
  Object.freeze(['alantil_practice_snapshot_v1:', 'practice.snapshot.']),
  Object.freeze(['alantil:16.1:session:', 'sessions.active.']),
  Object.freeze(['route_scroll_v3_', 'route.scroll.']),
  Object.freeze(['alantil:16.4.1:guest-claim:', 'migration.guest-claim.']),
]);

const CANONICAL_EXACT_STORAGE_KEYS = new Set(Object.values(EXACT_STORAGE_KEYS));
const CANONICAL_PREFIX_STORAGE_KEYS = PREFIX_STORAGE_KEYS.map(([, canonicalPrefix]) => canonicalPrefix);

export const STORAGE_BASE_KEYS = Object.freeze({
  settings: 'settings',
  settingsSync: 'sync.settings',
  wordFavorites: 'favorites.words',
  wordFavoriteSync: 'sync.favorites.words',
  songFavorites: 'favorites.songs',
  songFavoriteSync: 'sync.favorites.songs',
  hiddenWords: 'words.hidden',
  completedSets: 'sets.completed',
  wordProgress: 'progress.words',
  stationProgress: 'progress.stations',
  routeSettings: 'route.settings',
  syncQueue: 'sync.queue',
  activeSessions: 'sessions.active',
  activityHistory: 'activity.history',
  rewards: 'rewards',
  guideState: 'guide.state',
});

export function canonicalStorageBaseKey(baseKey) {
  const value = String(baseKey || '');
  if (EXACT_STORAGE_KEYS[value]) return EXACT_STORAGE_KEYS[value];
  for (const [legacyPrefix, canonicalPrefix] of PREFIX_STORAGE_KEYS) {
    if (value.startsWith(legacyPrefix)) return canonicalPrefix + value.slice(legacyPrefix.length);
  }
  return value;
}

export function isKnownStorageBaseKey(baseKey) {
  const value = String(baseKey || '');
  if (!value) return false;
  if (Object.prototype.hasOwnProperty.call(EXACT_STORAGE_KEYS, value) || CANONICAL_EXACT_STORAGE_KEYS.has(value)) return true;
  return PREFIX_STORAGE_KEYS.some(([legacyPrefix]) => value.startsWith(legacyPrefix))
    || CANONICAL_PREFIX_STORAGE_KEYS.some((canonicalPrefix) => value.startsWith(canonicalPrefix));
}

export function legacyStorageBaseKeys(baseKey) {
  const canonical = canonicalStorageBaseKey(baseKey);
  const values = [];
  for (const [legacy, target] of Object.entries(EXACT_STORAGE_KEYS)) {
    if (target === canonical) values.push(legacy);
  }
  for (const [legacyPrefix, canonicalPrefix] of PREFIX_STORAGE_KEYS) {
    if (canonical.startsWith(canonicalPrefix)) values.push(legacyPrefix + canonical.slice(canonicalPrefix.length));
  }
  return values;
}

export function storageScopeForUser(userId) {
  const id = String(userId || '').trim();
  return id ? `user:${id}` : GUEST_STORAGE_SCOPE;
}

export function storageScopeUserId(scope = GUEST_STORAGE_SCOPE) {
  const value = String(scope || '');
  return value.startsWith('user:') ? value.slice(5) : '';
}

export function isGuestStorageScope(scope = GUEST_STORAGE_SCOPE) {
  return String(scope || GUEST_STORAGE_SCOPE) === GUEST_STORAGE_SCOPE;
}

export function rawScopedStorageKey(baseKey, scope = GUEST_STORAGE_SCOPE) {
  return `${STORAGE_SCOPE_PREFIX}:${String(scope || GUEST_STORAGE_SCOPE)}:${String(baseKey || '')}`;
}

export function scopedStorageKey(baseKey, scope = GUEST_STORAGE_SCOPE) {
  return rawScopedStorageKey(canonicalStorageBaseKey(baseKey), scope);
}

export function parseScopedStorageKey(storageKey) {
  const prefix = `${STORAGE_SCOPE_PREFIX}:`;
  const value = String(storageKey || '');
  if (!value.startsWith(prefix)) return null;
  const rest = value.slice(prefix.length);
  if (rest.startsWith(`${GUEST_STORAGE_SCOPE}:`)) {
    return { scope: GUEST_STORAGE_SCOPE, baseKey: rest.slice(GUEST_STORAGE_SCOPE.length + 1) };
  }
  if (!rest.startsWith('user:')) return null;
  const separator = rest.indexOf(':', 5);
  if (separator < 0) return null;
  return { scope: rest.slice(0, separator), baseKey: rest.slice(separator + 1) };
}
