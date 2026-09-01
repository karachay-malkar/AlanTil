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
