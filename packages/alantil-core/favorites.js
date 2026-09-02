export function normalizeFavoriteIds(values, normalizeId = (value) => String(value || '').trim()) {
  return new Set((Array.isArray(values) ? values : []).map(normalizeId).filter(Boolean));
}

export function favoriteHas(ids, id, normalizeId = (value) => String(value || '').trim()) {
  return ids.has(normalizeId(id));
}

export function setFavoriteActive(ids, id, active, normalizeId = (value) => String(value || '').trim()) {
  const normalized = normalizeId(id);
  if (!normalized) return { ids, active: false, changed: false };
  const before = ids.has(normalized);
  const next = new Set(ids);
  if (active) next.add(normalized);
  else next.delete(normalized);
  return { ids: next, active: next.has(normalized), changed: before !== next.has(normalized), id: normalized };
}

export function toggleFavorite(ids, id, normalizeId = (value) => String(value || '').trim()) {
  const normalized = normalizeId(id);
  return setFavoriteActive(ids, normalized, !ids.has(normalized), normalizeId);
}

export function favoriteValues(ids) {
  return Array.from(ids || []);
}

function syncTime(value) { return Date.parse(value || '') || 0; }
export function normalizeFavoriteSyncRows(rows = [], idField = 'id') {
  const map = new Map();
  for (const raw of Array.isArray(rows) ? rows : []) {
    const id = String(raw?.[idField] ?? raw?.id ?? '').trim();
    if (!id) continue;
    const row = { id, is_active: raw?.is_active !== false, updated_at: raw?.updated_at || null };
    const previous = map.get(id);
    if (!previous || syncTime(row.updated_at) >= syncTime(previous.updated_at)) map.set(id, row);
  }
  return Array.from(map.values());
}

export function resolveFavoriteSyncRows(localRows = [], cloudRows = [], idField = 'id') {
  const resolved = new Map(normalizeFavoriteSyncRows(localRows, idField).map((row) => [row.id, row]));
  for (const cloud of normalizeFavoriteSyncRows(cloudRows, idField)) {
    const local = resolved.get(cloud.id);
    if (!local || syncTime(cloud.updated_at) >= syncTime(local.updated_at)) resolved.set(cloud.id, cloud);
  }
  return Array.from(resolved.values()).sort((a, b) => a.id.localeCompare(b.id));
}
