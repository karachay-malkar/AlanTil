const COUNT_FIELDS = Object.freeze([
  "sessions_total", "learn_sessions_total", "learn_unfinished_total", "test_answers_total",
  "match_sessions_total", "match_success_total", "match_errors_total", "study_shown_count",
  "known_count", "unknown_count", "test_correct_count", "test_wrong_count", "learn_shows_total",
  "learn_left_swipes_total", "learn_known_total", "test_correct_total", "test_wrong_total",
]);

const STATUS_RANK = Object.freeze({
  not_started: 0,
  learning: 1,
  mastered: 2,
  review: 3,
});

export function normalizedId(value) {
  return String(value ?? "").trim();
}

export function timestamp(value) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function count(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function stationProgressKey(row = {}) {
  return [row.dictionary_id, row.catalog_id, row.group_id, row.set_id].map(normalizedId).join("::");
}

export function setProgressKey(row = {}) {
  return [row.dictionary_id, row.section_id, row.set_id].map(normalizedId).join("::");
}

export function hiddenWordKey(row = {}) {
  return `${setProgressKey(row)}::${normalizedId(row.word_id)}`;
}

export function mergeFavoriteIds(...collections) {
  const values = collections.flat().map(normalizedId).filter(Boolean);
  return Array.from(new Set(values));
}

export function mergeHiddenWordMaps(...maps) {
  const merged = {};
  maps.forEach((source) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) return;
    Object.entries(source).forEach(([key, values]) => {
      const normalizedKey = normalizedId(key);
      if (!normalizedKey) return;
      merged[normalizedKey] = mergeFavoriteIds(merged[normalizedKey] || [], Array.isArray(values) ? values : []);
    });
  });
  return merged;
}

export function buildActiveHiddenWordMap(rows = []) {
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row?.is_hidden) return;
    const key = setProgressKey(row);
    const wordId = normalizedId(row.word_id);
    if (!key.replaceAll(":", "") || !wordId) return;
    map[key] = mergeFavoriteIds(map[key] || [], [wordId]);
  });
  return map;
}

export function mergeActivityHistoryRows(...collections) {
  const byId = new Map();
  collections.flat().forEach((row) => {
    const id = normalizedId(row?.id);
    if (!id) return;
    byId.set(id, { ...(byId.get(id) || {}), ...row, id });
  });
  return Array.from(byId.values()).sort((left, right) => (
    timestamp(right.ended_at || right.started_at) - timestamp(left.ended_at || left.started_at)
  ));
}

export function mergeWordProgressRows(...collections) {
  const map = new Map();
  collections.flat().forEach((source) => {
    const wordId = normalizedId(source.word_id);
    if (!wordId) return;
    const current = map.get(wordId);
    if (!current) {
      const normalized = { ...source, word_id: wordId };
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

    const currentStatus = normalizedId(current.mastery_status) || "not_started";
    const sourceStatus = normalizedId(source.mastery_status) || "not_started";
    next.mastery_status = (STATUS_RANK[sourceStatus] ?? 0) > (STATUS_RANK[currentStatus] ?? 0)
      ? sourceStatus
      : currentStatus;

    ["last_seen_at", "last_studied_at", "last_tested_at", "updated_at"].forEach((field) => {
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

export function mergeLatestRows(collections, keyFor) {
  const map = new Map();
  collections.flat().forEach((row) => {
    const key = keyFor(row);
    if (!key.replaceAll(":", "")) return;
    const current = map.get(key);
    if (!current || timestamp(row.updated_at) > timestamp(current.updated_at)) map.set(key, row);
  });
  return Array.from(map.values());
}

export function preferredSettingsSource(account, guest) {
  if (!account && !guest) return "none";
  if (!account) return "guest";
  if (!guest) return "account";

  const accountTime = timestamp(account.updated_at);
  const guestTime = timestamp(guest.updated_at);
  if (!accountTime || !guestTime) return "account";
  return guestTime > accountTime ? "guest" : "account";
}

export function remoteSupersedes(local, remote) {
  if (!remote) return false;
  const remoteTime = timestamp(remote.updated_at);
  const localTime = timestamp(local.updated_at);
  return remoteTime > 0 && (!localTime || remoteTime >= localTime);
}

export function claimableRows(localRows, remoteRows, keyFor) {
  const remote = new Map((Array.isArray(remoteRows) ? remoteRows : []).map((row) => [keyFor(row), row]));
  return (Array.isArray(localRows) ? localRows : []).filter((row) => !remoteSupersedes(row, remote.get(keyFor(row))));
}

export function claimableFavoriteIds(localIds, remoteRows, idField) {
  const remote = new Set((Array.isArray(remoteRows) ? remoteRows : [])
    .filter((row) => row?.is_active !== false)
    .map((row) => normalizedId(row?.[idField]))
    .filter(Boolean));
  return mergeFavoriteIds(localIds).filter((id) => !remote.has(id));
}

export function claimableHiddenWordMap(localMap, remoteRows) {
  const remote = new Set((Array.isArray(remoteRows) ? remoteRows : [])
    .filter((row) => row?.is_hidden !== false)
    .map(hiddenWordKey)
    .filter((key) => key.replaceAll(":", "")));
  const claimed = {};
  Object.entries(localMap && typeof localMap === "object" ? localMap : {}).forEach(([key, values]) => {
    const ids = mergeFavoriteIds(Array.isArray(values) ? values : [])
      .filter((id) => !remote.has(`${key}::${id}`));
    if (ids.length) claimed[key] = ids;
  });
  return claimed;
}

export function retryDelayMs(attempts) {
  const normalized = Math.max(1, Math.floor(Number(attempts) || 1));
  return Math.min(15 * 60_000, 5_000 * (2 ** Math.min(normalized - 1, 8)));
}

export function entryRevision(entry) {
  return normalizedId(entry.revision) || `${entry.id}:${entry.attempts ?? 0}:${entry.next_attempt_at ?? ""}`;
}

export function nextReadyEntry(entries, attemptedRevisions, now = Date.now(), force = false) {
  return entries.find((entry) => {
    if (attemptedRevisions.has(entryRevision(entry))) return false;
    return force || !entry.next_attempt_at || timestamp(entry.next_attempt_at) <= now;
  });
}
