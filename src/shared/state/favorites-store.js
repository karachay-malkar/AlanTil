import {
  readScopedJson,
  subscribeStorageScope,
  writeScopedJson,
} from "../progress/storage-scope.js";

export function createFavoritesStore(key, normalizeId = (value) => String(value || "").trim()) {
  const listeners = new Set();
  let ids = new Set();

  function notify() {
    listeners.forEach((listener) => listener(new Set(ids)));
  }

  function reload() {
    const stored = readScopedJson(key, []);
    ids = new Set((Array.isArray(stored) ? stored : []).map(normalizeId).filter(Boolean));
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
    const normalized = normalizeId(id);
    if (!normalized) return false;
    const before = ids.has(normalized);
    if (active) ids.add(normalized);
    else ids.delete(normalized);
    if (before !== ids.has(normalized)) {
      persist();
      if (notifyListeners) notify();
    }
    return ids.has(normalized);
  }

  function toggle(id) {
    const normalized = normalizeId(id);
    return setActive(normalized, !ids.has(normalized));
  }

  function replace(values, { notifyListeners = true } = {}) {
    ids = new Set((Array.isArray(values) ? values : []).map(normalizeId).filter(Boolean));
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
