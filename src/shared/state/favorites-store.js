import {
  readScopedJson,
  subscribeStorageScope,
  writeScopedJson,
} from "../progress/storage-scope.js?v=13.9.0";
import {
  normalizeFavoriteIds,
  setFavoriteActive as applyFavoriteActive,
  toggleFavorite as applyFavoriteToggle,
} from "../../../packages/alantil-core/favorites.js";

export function createFavoritesStore(key, normalizeId = (value) => String(value || "").trim()) {
  const listeners = new Set();
  let ids = new Set();

  function notify() {
    listeners.forEach((listener) => listener(new Set(ids)));
  }

  function reload() {
    const stored = readScopedJson(key, []);
    ids = new Set(normalizeFavoriteIds(stored, normalizeId));
    notify();
    return new Set(ids);
  }

  function persist() {
    return writeScopedJson(key, Array.from(ids));
  }

  function has(id) {
    return ids.has(normalizeId(id));
  }

  function setActive(id, active, { notifyListeners = true } = {}) {
    const result = applyFavoriteActive(Array.from(ids), id, active, normalizeId);
    ids = new Set(result.ids);
    if (result.changed) {
      persist();
      if (notifyListeners) notify();
    }
    return result.active;
  }

  function toggle(id) {
    const result = applyFavoriteToggle(Array.from(ids), id, normalizeId);
    ids = new Set(result.ids);
    if (result.changed) {
      persist();
      notify();
    }
    return result.active;
  }

  function replace(values, { notifyListeners = true } = {}) {
    ids = new Set(normalizeFavoriteIds(values, normalizeId));
    persist();
    if (notifyListeners) notify();
    return new Set(ids);
  }

  function values() {
    return Array.from(ids);
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  subscribeStorageScope(() => reload());
  reload();
  return { reload, has, toggle, setActive, replace, values, subscribe };
}
