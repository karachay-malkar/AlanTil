export function normalizeFavoriteId(value) {
  return String(value ?? '').normalize('NFC').trim();
}

export function normalizeFavoriteIds(values, normalizeId = normalizeFavoriteId) {
  const result = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const id = normalizeId(value);
    if (!id || seen.has(id)) return;
    seen.add(id);
    result.push(id);
  });
  return result;
}

export function setFavoriteActive(values, id, active, normalizeId = normalizeFavoriteId) {
  const ids = normalizeFavoriteIds(values, normalizeId);
  const normalized = normalizeId(id);
  if (!normalized) return { ids, active: false, changed: false };
  const before = ids.includes(normalized);
  let next = ids;
  if (active && !before) next = [...ids, normalized];
  if (!active && before) next = ids.filter((value) => value !== normalized);
  return { ids: next, active: Boolean(active), changed: before !== Boolean(active) };
}

export function toggleFavorite(values, id, normalizeId = normalizeFavoriteId) {
  const normalized = normalizeId(id);
  const ids = normalizeFavoriteIds(values, normalizeId);
  if (!normalized) return { ids, active: false, changed: false };
  return setFavoriteActive(ids, normalized, !ids.includes(normalized), normalizeId);
}

export function filterFavoriteItems(items, favoriteIds, getId = (item) => item?.id ?? item?.word_id) {
  const ids = new Set(normalizeFavoriteIds(favoriteIds));
  return (Array.isArray(items) ? items : []).filter((item) => ids.has(normalizeFavoriteId(getId(item))));
}

export function mergeFavoriteStates(localRows = [], remoteRows = []) {
  const latest = new Map();
  const apply = (row) => {
    const id = normalizeFavoriteId(row?.word_id ?? row?.id);
    if (!id) return;
    const time = Date.parse(row?.updated_at || '') || 0;
    const current = latest.get(id);
    if (!current || time > current.time) {
      latest.set(id, { id, active: row?.is_active !== false, time, row });
    }
  };
  (Array.isArray(localRows) ? localRows : []).forEach(apply);
  (Array.isArray(remoteRows) ? remoteRows : []).forEach(apply);
  return Array.from(latest.values()).filter((entry) => entry.active).map((entry) => entry.id);
}
