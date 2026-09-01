export type ProgressRow = Record<string, unknown> & { word_id?: unknown };

export type RetryableEntry = {
  id: string;
  revision?: string;
  attempts?: number;
  next_attempt_at?: string;
};

const COUNT_FIELDS = [
  'sessions_total', 'learn_sessions_total', 'learn_unfinished_total', 'test_answers_total',
  'match_sessions_total', 'match_success_total', 'match_errors_total', 'study_shown_count',
  'known_count', 'unknown_count', 'test_correct_count', 'test_wrong_count', 'learn_shows_total',
  'learn_left_swipes_total', 'learn_known_total', 'test_correct_total', 'test_wrong_total',
] as const;

const STATUS_RANK: Record<string, number> = {
  not_started: 0,
  learning: 1,
  mastered: 2,
  review: 3,
};

export function normalizedId(value: unknown) {
  return String(value ?? '').trim();
}

export function timestamp(value: unknown) {
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function count(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function mergeWordProgressRows(...collections: ProgressRow[][]) {
  const map = new Map<string, ProgressRow>();
  collections.flat().forEach((source) => {
    const wordId = normalizedId(source.word_id);
    if (!wordId) return;
    const current = map.get(wordId);
    if (!current) {
      const normalized: ProgressRow = { ...source, word_id: wordId };
      COUNT_FIELDS.forEach((field) => {
        if (field in normalized) normalized[field] = count(normalized[field]);
      });
      map.set(wordId, normalized);
      return;
    }

    const next = { ...current };
    COUNT_FIELDS.forEach((field) => {
      next[field] = Math.max(count(current[field]), count(source[field]));
    });

    const currentStatus = normalizedId(current.mastery_status) || 'not_started';
    const sourceStatus = normalizedId(source.mastery_status) || 'not_started';
    next.mastery_status = (STATUS_RANK[sourceStatus] ?? 0) > (STATUS_RANK[currentStatus] ?? 0)
      ? sourceStatus
      : currentStatus;

    ['last_seen_at', 'last_studied_at', 'last_tested_at', 'updated_at'].forEach((field) => {
      if (timestamp(source[field]) > timestamp(next[field])) next[field] = source[field];
    });
    if (timestamp(source.last_seen_at) > timestamp(current.last_seen_at)) {
      next.last_mode = source.last_mode ?? current.last_mode;
      next.last_result = source.last_result ?? current.last_result;
    }

    const mastered = [current.mastered_at, source.mastered_at]
      .filter((value) => timestamp(value) > 0)
      .sort((left, right) => timestamp(left) - timestamp(right));
    next.mastered_at = mastered[0] ?? null;
    map.set(wordId, next);
  });
  return Array.from(map.values());
}

export function mergeLatestRows(
  collections: Record<string, unknown>[][],
  keyFor: (row: Record<string, unknown>) => string,
) {
  const map = new Map<string, Record<string, unknown>>();
  collections.flat().forEach((row) => {
    const key = keyFor(row);
    if (!key.replaceAll(':', '')) return;
    const current = map.get(key);
    if (!current || timestamp(row.updated_at) > timestamp(current.updated_at)) map.set(key, row);
  });
  return Array.from(map.values());
}

export function preferredSettingsSource(
  account: Record<string, unknown> | null | undefined,
  guest: Record<string, unknown> | null | undefined,
): 'account' | 'guest' | 'none' {
  if (!account && !guest) return 'none';
  if (!account) return 'guest';
  if (!guest) return 'account';

  const accountTime = timestamp(account.updated_at);
  const guestTime = timestamp(guest.updated_at);
  if (!accountTime || !guestTime) return 'account';
  return guestTime > accountTime ? 'guest' : 'account';
}

export function remoteSupersedes(local: Record<string, unknown>, remote: Record<string, unknown> | null | undefined) {
  if (!remote) return false;
  const remoteTime = timestamp(remote.updated_at);
  const localTime = timestamp(local.updated_at);
  return remoteTime > 0 && (!localTime || remoteTime >= localTime);
}

export function retryDelayMs(attempts: number) {
  const normalized = Math.max(1, Math.floor(Number(attempts) || 1));
  return Math.min(15 * 60_000, 5_000 * (2 ** Math.min(normalized - 1, 8)));
}

export function entryRevision(entry: RetryableEntry) {
  return normalizedId(entry.revision) || `${entry.id}:${entry.attempts ?? 0}:${entry.next_attempt_at ?? ''}`;
}

export function nextReadyEntry<T extends RetryableEntry>(
  entries: T[],
  attemptedRevisions: ReadonlySet<string>,
  now = Date.now(),
  force = false,
) {
  return entries.find((entry) => {
    if (attemptedRevisions.has(entryRevision(entry))) return false;
    return force || !entry.next_attempt_at || timestamp(entry.next_attempt_at) <= now;
  });
}
