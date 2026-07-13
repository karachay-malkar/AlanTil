import { readJson, writeJson } from "./storage.js";

export function createFavoritesStore(key, normalizeId = (value) => String(value || "").trim()) {
  const listeners = new Set();
  let ids = new Set();

  function reload() {
    const stored = readJson(key, []);
    ids = new Set((Array.isArray(stored) ? stored : []).map(normalizeId).filter(Boolean));
    return ids;
  }

  function has(id) {
    return ids.has(normalizeId(id));
  }

  function toggle(id) {
    const normalized = normalizeId(id);
    if (!normalized) return false;
    if (ids.has(normalized)) ids.delete(normalized);
    else ids.add(normalized);
    writeJson(key, Array.from(ids));
    listeners.forEach((listener) => listener(ids));
    return ids.has(normalized);
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  reload();
  return { reload, has, toggle, subscribe };
}
