import { normalizeId } from "../domain/word-normalizer.js";
import { readJson, writeJson } from "./storage.js";

export const WORD_FAVORITES_KEY = "fc_favorites_v1";

class WordFavorites {
  constructor() {
    this.ids = new Set();
    this.listeners = new Set();
    this.reload();
  }

  reload() {
    const stored = readJson(WORD_FAVORITES_KEY, []);
    this.ids = new Set((Array.isArray(stored) ? stored : []).map(normalizeId).filter(Boolean));
    return this.ids;
  }

  has(id) {
    return this.ids.has(normalizeId(id));
  }

  toggle(id) {
    const normalized = normalizeId(id);
    if (!normalized) return false;
    if (this.ids.has(normalized)) this.ids.delete(normalized);
    else this.ids.add(normalized);
    writeJson(WORD_FAVORITES_KEY, Array.from(this.ids));
    this.emit();
    return this.ids.has(normalized);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    this.listeners.forEach((listener) => listener(this.ids));
  }
}

export const wordFavorites = new WordFavorites();
