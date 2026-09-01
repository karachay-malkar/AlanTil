import {
  readScopedJson,
  subscribeStorageScope,
  writeScopedJson,
} from "../progress/storage-scope.js?v=13.9.0";
import {
  favoriteHas,
  favoriteValues,
  normalizeFavoriteIds,
  setFavoriteActive,
  toggleFavorite,
} from "../../../packages/alantil-core/favorites.js";

export function createFavoritesStore(key, normalizeId = (value) => String(value || "").trim()) {
  const listeners = new Set();
  let ids = new Set();

  function notify() {
    listeners.forEach((listener) => listener(new Set(ids)));
  }

  function reload() {
    const stored = readScopedJson(key, []);
    ids = normalizeFavoriteIds(stored, normalizeId);
    notify();
    return new Set(ids);
  }

  function persist() {
    return writeScopedJson(key, favoriteValues(ids));
  }

  function has(id) {
    return favoriteHas(ids, id, normalizeId);
  }

  function setActive(id, active, { notifyListeners = true } = {}) {
    const result = setFavoriteActive(ids, id, active, normalizeId);
    if (!result.id) return false;
    ids = result.ids;
    if (result.changed) {
      persist();
      if (notifyListeners) notify();
    }
    return result.active;
  }

  function toggle(id) {
    const result = toggleFavorite(ids, id, normalizeId);
    if (!result.id) return false;
    ids = result.ids;
    if (result.changed) {
      persist();
      notify();
    }
    return result.active;
  }

  function replace(values, { notifyListeners = true } = {}) {
    ids = normalizeFavoriteIds(values, normalizeId);
    persist();
    if (notifyListeners) notify();
    return new Set(ids);
  }

  function values() {
    return favoriteValues(ids);
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  subscribeStorageScope(() => reload());
  reload();
  return { reload, has, toggle, setActive, replace, values, subscribe };
}
